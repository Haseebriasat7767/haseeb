"""
Authors the project's furniture library in Blender and exports it to glTF.

Run headless:
    python3 tools/blender/models.py            # build and export everything
    python3 tools/blender/models.py sofa bed   # or just some
    python3 tools/blender/models.py --preview  # render a contact sheet

## Why this exists

The furniture in the residence and the tower is assembled from chamfered
boxes and lathed profiles at runtime. That was the right call while there
was no asset pipeline — it costs nothing to download and it merges into a
handful of draw calls — but a box with its corners knocked off is not a
sofa, and no amount of shading fixes the silhouette.

These are real models: subdivision surfaces with proper edge flow, built to
the spec in the asset schedule so they drop straight into a three.js scene.

## The export contract

Every piece obeys the same rules, because a loader cannot guess:

  * glTF 2.0 binary, one .glb per piece, Draco-compressed
  * metres, Y-up, -Z forward  (Blender is Z-up; the exporter converts)
  * origin at the FLOOR CONTACT POINT, centred in plan — so placing a piece
    is `position = [x, floorY, z]` with no per-asset offset to remember
  * PBR metal-rough only, no custom nodes
  * triangulated on export, no n-gons downstream
"""

import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "models")

TAU = math.pi * 2.0


# ── scene ─────────────────────────────────────────────────────────────────

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"


def wobble(seed, index):
    """
    Deterministic jitter in [0, 1).

    Named to match the helper the TypeScript furniture uses, and present for
    the same reason: a rail of evenly spaced garments reads as a comb, and a
    shelf whose stock sits on a grid reads as a diagram. The variation has
    to be repeatable, though — a shop that rearranges itself on every mount
    is worse than one that never moves.
    """
    x = math.sin(seed * 127.1 + index * 311.7) * 43758.5453
    return x - math.floor(x)


# ── materials ─────────────────────────────────────────────────────────────
#
# Colours track the project's own material library so a loaded model sits in
# the same palette as the procedural geometry it stands next to.

def srgb(r, g, b):
    """
    An sRGB colour as the linear value Blender and glTF actually store.

    This is not pedantry. Base Color on a Principled BSDF is linear, and
    glTF's baseColorFactor is linear, so a value picked by eye from a
    swatch — which is always sRGB — arrives about a stop and a half too
    bright. The first furniture batch was authored that way and every piece
    rendered near-white against the procedural furniture beside it: a warm
    beige at 0.72 sRGB is 0.48 linear, and 0.72 linear is very nearly paper.
    """
    def c(u):
        return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4

    return (c(r), c(g), c(b), 1.0)


PALETTE = {
    "upholstery": (srgb(0.86, 0.83, 0.77), 0.88, 0.0),
    "upholsteryDark": (srgb(0.36, 0.34, 0.31), 0.86, 0.0),
    "joinery": (srgb(0.42, 0.31, 0.22), 0.46, 0.0),
    "marble": (srgb(0.90, 0.89, 0.86), 0.22, 0.0),
    "stone": (srgb(0.78, 0.73, 0.65), 0.62, 0.0),
    "travertine": (srgb(0.82, 0.76, 0.66), 0.66, 0.0),
    "bronze": (srgb(0.70, 0.56, 0.36), 0.28, 0.95),
    "darkMetal": (srgb(0.22, 0.22, 0.24), 0.35, 0.90),
    "ceramic": (srgb(0.95, 0.95, 0.94), 0.16, 0.02),
    "linen": (srgb(0.93, 0.91, 0.87), 0.90, 0.0),
    "paper": (srgb(0.80, 0.76, 0.70), 0.88, 0.0),
    "glow": (srgb(1.0, 0.94, 0.82), 0.5, 0.0),
}


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    color, rough, metal = PALETTE[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if name == "glow":
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = 1.4
    return mat


def assign(obj, name):
    obj.data.materials.clear()
    obj.data.materials.append(material(name))
    return obj


# ── primitives ────────────────────────────────────────────────────────────

def rounded_box(name, size, location=(0, 0, 0), bevel=0.03, segments=3, subsurf=0):
    """
    A box with a real radius on every edge.

    The workhorse. Bevel then (optionally) subdivide: bevelling first gives
    the subdivision something to hold on to, so the result keeps its
    proportions instead of shrinking into a pillow.
    """
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = Vector(size)
    bpy.ops.object.transform_apply(scale=True)

    b = obj.modifiers.new("bevel", "BEVEL")
    b.width = bevel
    b.segments = segments
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(30)
    b.harden_normals = False

    if subsurf:
        s = obj.modifiers.new("subsurf", "SUBSURF")
        s.levels = subsurf
        s.render_levels = subsurf
    return obj


def cylinder(name, radius, height, location=(0, 0, 0), verts=32, bevel=0.006):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=height, vertices=verts, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if bevel:
        b = obj.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = 2
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(30)
    return obj


def sphere(name, radius, location=(0, 0, 0), segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location,
                                         segments=segments, ring_count=rings)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return obj


def lathe(name, profile, verts=32):
    """
    A turned solid from a 2-D profile of (radius, height) pairs.

    Vessels, lamp bases, table drums — anything that came off a wheel. The
    profile is swept about Z, which is Blender's up; the exporter turns it
    into the Y the web expects.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    # A single edge chain up the profile, then spun.
    prev = None
    for r, h in profile:
        v = bm.verts.new((max(r, 1e-4), 0.0, h))
        if prev is not None:
            bm.edges.new((prev, v))
        prev = v
    bm.verts.ensure_lookup_table()

    geom = list(bm.verts) + list(bm.edges)
    bmesh.ops.spin(
        bm, geom=geom, axis=(0, 0, 1), cent=(0, 0, 0),
        dvec=(0, 0, 0), angle=TAU, steps=verts, use_merge=True,
    )
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj


def swept_arc(name, radius, arc_deg, section, height, verts=40, corner=0.05):
    """
    A rounded section swept along a circular arc, built vertex by vertex.

    The shape the reference interiors are full of, and the one thing a box
    genuinely cannot approximate: a sofa back that wraps around the seating
    rather than standing behind it.

    Built explicitly rather than with a Bend modifier. The modifier route
    works interactively, where you can see what it did; headless it silently
    curled the sofa back around the wrong origin and left it standing a
    metre away from the sofa, which the .glb reported no problem with at
    all. Placing the vertices means the geometry is exactly what the numbers
    say.

    The arc is centred on the object origin and opens toward +Y, so its
    midpoint sits at local (0, -radius, 0). Callers place the origin at the
    centre of curvature, which is the one point on a curved piece you can
    reason about.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    # Cross-section: a rectangle with its corners taken off, in (radial, up).
    hw, hh = section / 2, height / 2
    c = min(corner, hw * 0.9, hh * 0.9)
    steps = 4
    profile = []
    for cx, cy, a0 in ((hw - c, hh - c, 0.0), (-(hw - c), hh - c, math.pi / 2),
                       (-(hw - c), -(hh - c), math.pi), (hw - c, -(hh - c), 3 * math.pi / 2)):
        for k in range(steps + 1):
            a = a0 + (math.pi / 2) * (k / steps)
            profile.append((cx + math.cos(a) * c, cy + math.sin(a) * c))

    bm = bmesh.new()
    half = math.radians(arc_deg) / 2
    rings = []
    for i in range(verts + 1):
        t = -half + (2 * half) * (i / verts)
        # Measured from -Y, so the arc's midpoint lands at (0, -radius).
        ang = -math.pi / 2 + t
        cx, cy = math.cos(ang) * radius, math.sin(ang) * radius
        rad = Vector((math.cos(ang), math.sin(ang), 0.0))
        ring = []
        for px, pz in profile:
            v = bm.verts.new((cx + rad.x * px, cy + rad.y * px, pz))
            ring.append(v)
        rings.append(ring)

    bm.verts.ensure_lookup_table()
    n = len(profile)
    for i in range(verts):
        a, b = rings[i], rings[i + 1]
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new((a[j], a[k], b[k], b[j]))
    # Cap both ends.
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj


def organic_slab(name, radius, height, lobes=3, wobble=0.22, verts=64,
                 phase=0.0, squash=1.0, bevel=0.02):
    """
    A slab whose plan is a soft, lobed blob rather than a circle.

    The kidney-shaped travertine tables the reference interiors cluster in
    threes. The plan is a radius modulated by two sine terms at different
    frequencies, which is what stops it reading as a rounded triangle: one
    lobe count gives a regular clover, two beating against each other give
    a shape that looks drawn rather than generated.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    ring = []
    for i in range(verts):
        t = TAU * i / verts
        r = radius * (
            1.0
            + wobble * math.sin(lobes * t + phase)
            + wobble * 0.42 * math.sin((lobes + 2) * t - phase * 1.7)
        )
        ring.append(bm.verts.new((math.cos(t) * r, math.sin(t) * r * squash, 0.0)))
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(ring)

    up = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [v for v in up["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, 0, height))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    b = obj.modifiers.new("bevel", "BEVEL")
    b.width = bevel
    b.segments = 3
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(30)
    return obj


def extruded_profile(name, outline, width, bevel=0.02, centred=True):
    """
    A closed 2-D outline in (y, z), extruded along X.

    How a carved stone piece is actually drawn: the spa loungers in the
    reference are one section swept across their width, and the whole
    character of them is in that section — the dip of the seat, the rise of
    the headrest, the thickness of the shell.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    x0 = -width / 2 if centred else 0.0
    bm = bmesh.new()
    ring = [bm.verts.new((x0, y, z)) for y, z in outline]
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(ring)
    out = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [v for v in out["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(width, 0, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    b = obj.modifiers.new("bevel", "BEVEL")
    b.width = bevel
    b.segments = 3
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(25)
    return obj


def join(name, objs, mat_name):
    """Joins parts into one object and gives it a single material."""
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.select_all(action="DESELECT")
    return assign(obj, mat_name)


# ── the furniture ─────────────────────────────────────────────────────────
#
# Every builder leaves its parts standing on z = 0 and centred in plan, and
# returns them as a list. Nothing is joined across materials: glTF carries
# several meshes in one file quite happily, and keeping upholstery separate
# from timber is what lets the loader swap a fabric later.

def p_sofa_3seat():
    """Curved three-seat sofa — the reference piece for the lounge."""
    parts = []
    w, d = 2.9, 1.02

    plinth = rounded_box("sofa_plinth", (w - 0.34, d - 0.22, 0.13), (0, 0, 0.075), bevel=0.02)
    parts.append(assign(plinth, "joinery"))

    seat = rounded_box("sofa_seat", (w - 0.16, d, 0.2), (0, 0, 0.24), bevel=0.07, segments=4)
    parts.append(assign(seat, "upholstery"))

    # Three cushions, each a little different — identical cushions are the
    # fastest way to make a sofa read as extruded.
    for i, off in enumerate((-0.92, 0.0, 0.92)):
        c = rounded_box(
            f"sofa_cushion_{i}",
            (0.86, d - 0.13, 0.17 + i * 0.004),
            (off, 0.02, 0.42),
            bevel=0.075, segments=4, subsurf=1,
        )
        parts.append(assign(c, "upholstery"))

    # The back wraps around the seat rather than standing behind it.
    # Radius 3.2 over 50 degrees gives a 2.7 m chord — a gentle wrap across
    # a 2.9 m sofa, not a horseshoe.
    back_r = 3.2
    # Carried down far enough to meet the seat platform at the arc's
    # midpoint: the back stands 0.19 m proud of the seat there, and a back
    # that starts above the cushion line leaves daylight under it.
    back = swept_arc("sofa_back", radius=back_r, arc_deg=50, section=0.26, height=0.74, verts=32)
    back.location = (0, -0.42 + back_r, 0.66)
    parts.append(assign(back, "upholstery"))

    for side, x in (("l", -1), ("r", 1)):
        arm = rounded_box(
            f"sofa_arm_{side}",
            (0.24, d - 0.08, 0.42),
            (x * (w / 2 - 0.12), -0.02, 0.47),
            bevel=0.1, segments=4, subsurf=1,
        )
        parts.append(assign(arm, "upholstery"))

    return parts


def p_lounge_chair():
    """A legless tub chair — low, wide, and round in plan."""
    parts = []
    shell = lathe(
        "chair_shell",
        [(0.0, 0.0), (0.5, 0.0), (0.52, 0.12), (0.50, 0.34), (0.47, 0.40), (0.40, 0.41), (0.0, 0.41)],
        verts=40,
    )
    parts.append(assign(shell, "upholstery"))

    chair_r = 0.46
    back = swept_arc("chair_back", radius=chair_r, arc_deg=210, section=0.15, height=0.42, verts=34)
    back.location = (0, chair_r, 0.6)
    parts.append(assign(back, "upholstery"))

    cushion = rounded_box("chair_cushion", (0.78, 0.7, 0.14), (0, 0.03, 0.47),
                          bevel=0.06, segments=4, subsurf=1)
    parts.append(assign(cushion, "upholstery"))
    return parts


def p_ottoman():
    parts = []
    body = lathe(
        "ottoman_body",
        [(0.0, 0.0), (0.44, 0.0), (0.46, 0.1), (0.44, 0.38), (0.36, 0.42), (0.0, 0.42)],
        verts=36,
    )
    parts.append(assign(body, "upholsteryDark"))
    return parts


def p_low_table():
    """A waisted stone drum carrying a honed top."""
    parts = []
    drum = lathe(
        "table_drum",
        [(0.0, 0.0), (0.30, 0.0), (0.30, 0.03), (0.22, 0.16), (0.22, 0.26), (0.30, 0.35),
         (0.30, 0.37), (0.0, 0.37)],
        verts=40,
    )
    parts.append(assign(drum, "stone"))
    top = cylinder("table_top", 0.46, 0.05, (0, 0, 0.395), verts=48, bevel=0.012)
    parts.append(assign(top, "marble"))
    return parts


def p_side_drum():
    parts = []
    drum = lathe(
        "drum_body",
        [(0.0, 0.0), (0.24, 0.0), (0.24, 0.03), (0.17, 0.22), (0.17, 0.38), (0.24, 0.5),
         (0.24, 0.53), (0.0, 0.53)],
        verts=36,
    )
    parts.append(assign(drum, "stone"))
    return parts


def p_bed():
    parts = []
    base = rounded_box("bed_base", (1.98, 2.12, 0.28), (0, 0, 0.16), bevel=0.03)
    parts.append(assign(base, "joinery"))

    mattress = rounded_box("bed_mattress", (1.94, 2.08, 0.3), (0, 0, 0.45),
                           bevel=0.06, segments=4, subsurf=1)
    parts.append(assign(mattress, "linen"))

    head_r = 5.0
    head = swept_arc("bed_head", radius=head_r, arc_deg=24, section=0.14, height=1.04, verts=26)
    head.location = (0, -1.1 + head_r, 0.52)
    parts.append(assign(head, "upholstery"))

    for i, (x, y, rot) in enumerate(((-0.44, -0.78, 6), (0.44, -0.8, -5), (-0.3, -0.62, -9), (0.32, -0.6, 8))):
        p = rounded_box(f"bed_pillow_{i}", (0.62, 0.34, 0.15), (x, y, 0.68),
                        bevel=0.07, segments=4, subsurf=1)
        p.rotation_euler = (0, 0, math.radians(rot))
        parts.append(assign(p, "linen"))

    throw = rounded_box("bed_throw", (1.96, 0.62, 0.06), (0, 0.62, 0.62), bevel=0.03, segments=3)
    parts.append(assign(throw, "upholstery"))
    return parts


def p_nightstand():
    parts = []
    body = rounded_box("night_body", (0.56, 0.44, 0.44), (0, 0, 0.3), bevel=0.012)
    parts.append(assign(body, "joinery"))
    for i, z in enumerate((0.18, 0.38)):
        pull = cylinder(f"night_pull_{i}", 0.012, 0.16, (0, -0.225, z), verts=10, bevel=0.003)
        pull.rotation_euler = (0, math.radians(90), 0)
        parts.append(assign(pull, "bronze"))
    return parts


def p_table_lamp():
    parts = []
    base = lathe(
        "lamp_base",
        [(0.0, 0.0), (0.09, 0.0), (0.095, 0.02), (0.04, 0.09), (0.032, 0.26), (0.0, 0.27)],
        verts=28,
    )
    parts.append(assign(base, "bronze"))
    shade = lathe(
        "lamp_shade",
        [(0.0, 0.5), (0.155, 0.5), (0.125, 0.28), (0.0, 0.28)],
        verts=32,
    )
    parts.append(assign(shade, "glow"))
    return parts


def p_floor_lamp():
    parts = []
    base = lathe(
        "floorlamp_base",
        [(0.0, 0.0), (0.15, 0.0), (0.155, 0.018), (0.03, 0.06), (0.024, 1.3), (0.0, 1.3)],
        verts=28,
    )
    parts.append(assign(base, "bronze"))
    shade = lathe(
        "floorlamp_shade",
        [(0.0, 1.62), (0.19, 1.62), (0.155, 1.3), (0.0, 1.3)],
        verts=32,
    )
    parts.append(assign(shade, "glow"))
    return parts


def p_vessel_tall():
    parts = [lathe(
        "vessel_tall",
        [(0.0, 0.0), (0.10, 0.0), (0.12, 0.06), (0.17, 0.3), (0.15, 0.52), (0.09, 0.66),
         (0.085, 0.7), (0.075, 0.7), (0.08, 0.66), (0.14, 0.52), (0.16, 0.3), (0.10, 0.06), (0.0, 0.02)],
        verts=36,
    )]
    return [assign(parts[0], "ceramic")]


def p_vessel_round():
    parts = [lathe(
        "vessel_round",
        [(0.0, 0.0), (0.08, 0.0), (0.14, 0.08), (0.19, 0.24), (0.14, 0.38), (0.10, 0.42),
         (0.093, 0.42), (0.132, 0.38), (0.18, 0.24), (0.13, 0.08), (0.07, 0.01), (0.0, 0.01)],
        verts=36,
    )]
    return [assign(parts[0], "ceramic")]


def p_bowl():
    parts = [lathe(
        "bowl",
        [(0.0, 0.0), (0.11, 0.005), (0.20, 0.07), (0.225, 0.13), (0.215, 0.13),
         (0.19, 0.075), (0.10, 0.02), (0.0, 0.015)],
        verts=36,
    )]
    return [assign(parts[0], "marble")]


def p_organic_table_lg():
    """The larger of the kidney travertine tables, on a chunky drum foot."""
    parts = []
    top = organic_slab("otable_lg_top", 0.62, 0.075, lobes=3, wobble=0.20,
                       phase=0.4, squash=0.86, bevel=0.028)
    top.location = (0, 0, 0.355)
    parts.append(assign(top, "travertine"))

    foot = organic_slab("otable_lg_foot", 0.27, 0.355, lobes=3, wobble=0.13,
                        phase=1.1, squash=0.9, bevel=0.02)
    parts.append(assign(foot, "travertine"))
    return parts


def p_organic_table_sm():
    """The lower companion — always a different height, never a matching pair."""
    parts = []
    top = organic_slab("otable_sm_top", 0.42, 0.065, lobes=4, wobble=0.17,
                       phase=2.2, squash=0.92, bevel=0.024)
    top.location = (0, 0, 0.275)
    parts.append(assign(top, "travertine"))

    foot = organic_slab("otable_sm_foot", 0.20, 0.275, lobes=4, wobble=0.11,
                        phase=0.6, bevel=0.018)
    parts.append(assign(foot, "travertine"))
    return parts


def p_stone_lounger():
    """
    A carved chaise — the spa piece.

    One section swept across the width, which is how the real thing is
    made: the whole character sits in the dip of the seat and the rise of
    the headrest, and both live in this outline.
    """
    outline = [
        (-1.06, 0.26), (-0.68, 0.34), (-0.24, 0.30), (0.18, 0.31),
        (0.54, 0.42), (0.82, 0.62), (0.97, 0.86), (1.04, 0.83),
        (0.94, 0.56), (0.72, 0.32), (0.40, 0.18), (0.0, 0.13),
        (-0.44, 0.12), (-0.86, 0.16), (-1.08, 0.21),
    ]
    body = extruded_profile("lounger_body", outline, 0.62, bevel=0.03)
    parts = [assign(body, "travertine")]

    plinth = rounded_box("lounger_plinth", (0.5, 0.9, 0.13), (0, -0.1, 0.065), bevel=0.02)
    parts.append(assign(plinth, "travertine"))
    return parts


def p_wingback():
    """A tall enveloping chair — the one beside the bed in the reference."""
    parts = []
    shell = lathe(
        "wing_shell",
        [(0.0, 0.0), (0.42, 0.0), (0.44, 0.1), (0.42, 0.36), (0.38, 0.42), (0.0, 0.42)],
        verts=36,
    )
    parts.append(assign(shell, "upholstery"))

    r = 0.42
    back = swept_arc("wing_back", radius=r, arc_deg=232, section=0.16, height=0.86, verts=36)
    back.location = (0, r, 0.85)
    parts.append(assign(back, "upholstery"))

    cushion = rounded_box("wing_cushion", (0.66, 0.6, 0.13), (0, 0.02, 0.48),
                          bevel=0.055, segments=4, subsurf=1)
    parts.append(assign(cushion, "upholstery"))
    return parts


def p_planter_cyl():
    """The white cylinder every one of these rooms has a tree standing in."""
    parts = [lathe(
        "planter",
        [(0.0, 0.0), (0.24, 0.0), (0.27, 0.05), (0.30, 0.34), (0.30, 0.40),
         (0.275, 0.40), (0.275, 0.06), (0.24, 0.03), (0.0, 0.03)],
        verts=40,
    )]
    return [assign(parts[0], "ceramic")]


def p_tray():
    parts = []
    base = organic_slab("tray_base", 0.21, 0.014, lobes=2, wobble=0.14,
                        phase=0.9, squash=0.62, bevel=0.008)
    parts.append(assign(base, "joinery"))
    rim = organic_slab("tray_rim", 0.215, 0.032, lobes=2, wobble=0.14,
                       phase=0.9, squash=0.62, bevel=0.008)
    rim.location = (0, 0, 0.008)
    parts.append(assign(rim, "bronze"))
    return parts


def p_book_stack():
    """Three books, none of them square to the others."""
    parts = []
    for i, (w, d, h, rot) in enumerate((
        (0.26, 0.20, 0.032, 0.0),
        (0.24, 0.185, 0.028, 0.16),
        (0.215, 0.17, 0.024, -0.11),
    )):
        z = 0.016 + i * 0.03
        b = rounded_box(f"book_{i}", (w, d, h), (0, 0, z), bevel=0.004)
        b.rotation_euler = (0, 0, rot)
        parts.append(assign(b, "paper" if i % 2 == 0 else "joinery"))
    return parts


def p_candle_cluster():
    parts = []
    for i, (x, y, r, h) in enumerate(((0, 0, 0.045, 0.13), (0.11, 0.04, 0.037, 0.09),
                                      (0.05, -0.1, 0.032, 0.16))):
        c = cylinder(f"candle_{i}", r, h, (x, y, h / 2), verts=18, bevel=0.004)
        parts.append(assign(c, "ceramic"))
        flame = cylinder(f"flame_{i}", r * 0.16, 0.02, (x, y, h + 0.012), verts=8, bevel=0)
        parts.append(assign(flame, "glow"))
    return parts


def p_ceiling_soffit():
    """
    The dropped soffit, as a soft amoeba rather than a rectangle.

    The single most recognisable thing about the reference living room and
    the one piece of it that is architecture rather than furniture: a
    curved plane floating below the slab with light washing out around its
    whole edge. A rectangular drop reads as a bulkhead; this reads as a
    ceiling somebody designed.

    Authored upside down in the sense that its origin is the soffit's own
    underside, so it is placed by the height you want to stand under.
    """
    parts = []
    drop = 0.26

    panel = organic_slab("soffit_panel", 3.5, drop, lobes=3, wobble=0.19,
                         phase=0.8, squash=0.74, bevel=0.05)
    parts.append(assign(panel, "linen"))

    # The cove: a slightly larger blob sitting just above the panel's edge,
    # so what the room sees is a lit rim, never the source.
    cove = organic_slab("soffit_cove", 3.62, 0.05, lobes=3, wobble=0.19,
                        phase=0.8, squash=0.74, bevel=0.02)
    cove.location = (0, 0, drop - 0.005)
    parts.append(assign(cove, "glow"))
    return parts


def p_kitchen_island():
    """A stone island with waterfall ends — the piece a kitchen is sold on."""
    parts = []
    w, d, h = 2.6, 1.05, 0.9
    top_t = 0.055

    body = rounded_box("island_body", (w - 0.14, d - 0.1, h - top_t),
                       (0, 0, (h - top_t) / 2), bevel=0.008)
    parts.append(assign(body, "joinery"))

    top = rounded_box("island_top", (w, d, top_t), (0, 0, h - top_t / 2), bevel=0.01)
    parts.append(assign(top, "marble"))
    # The waterfall: the top's own material carried down both ends to the
    # floor, which is the whole detail and the reason islands cost what they
    # cost.
    for side, x in (("l", -1), ("r", 1)):
        fall = rounded_box(f"island_fall_{side}", (top_t, d, h - top_t),
                           (x * (w / 2 - top_t / 2), 0, (h - top_t) / 2), bevel=0.01)
        parts.append(assign(fall, "marble"))

    # A sunk basin and a slim tap.
    sink = rounded_box("island_sink", (0.62, 0.42, 0.02), (-0.55, 0.06, h - 0.05), bevel=0.01)
    parts.append(assign(sink, "darkMetal"))
    tap = lathe("island_tap",
                [(0.0, 0.0), (0.032, 0.0), (0.032, 0.02), (0.017, 0.05), (0.017, 0.30), (0.0, 0.30)],
                verts=16)
    tap.location = (-0.55, -0.3, h)
    parts.append(assign(tap, "bronze"))
    spout = cylinder("island_spout", 0.017, 0.2, (-0.55, -0.2, h + 0.29), verts=14, bevel=0.004)
    spout.rotation_euler = (math.radians(90), 0, 0)
    parts.append(assign(spout, "bronze"))
    return parts


def p_kitchen_run():
    """Tall units with a worktop and a splashback — the wall side."""
    parts = []
    w, d = 3.6, 0.66

    tall = rounded_box("run_tall", (w, d, 2.4), (0, 0, 1.2), bevel=0.006)
    parts.append(assign(tall, "joinery"))

    # Shadow gaps between the door leaves, which is what stops a run of
    # units reading as one slab of timber.
    for i in range(1, 5):
        x = -w / 2 + (w / 5) * i
        gap = rounded_box(f"run_gap_{i}", (0.014, 0.02, 2.3), (x, -d / 2, 1.2), bevel=0.002)
        parts.append(assign(gap, "darkMetal"))

    worktop = rounded_box("run_worktop", (w, d + 0.04, 0.05), (0, -0.02, 0.925), bevel=0.008)
    parts.append(assign(worktop, "marble"))
    splash = rounded_box("run_splash", (w, 0.02, 0.5), (0, d / 2 - 0.02, 1.2), bevel=0.004)
    parts.append(assign(splash, "marble"))
    return parts


def p_vanity():
    """A hung vanity with a countertop basin."""
    parts = []
    w, d = 1.5, 0.52

    body = rounded_box("vanity_body", (w, d, 0.42), (0, 0, 0.71), bevel=0.008)
    parts.append(assign(body, "joinery"))
    top = rounded_box("vanity_top", (w + 0.04, d + 0.03, 0.045), (0, 0, 0.9525), bevel=0.008)
    parts.append(assign(top, "marble"))

    basin = lathe("vanity_basin",
                  [(0.0, 0.0), (0.20, 0.0), (0.235, 0.05), (0.245, 0.15), (0.245, 0.16),
                   (0.225, 0.16), (0.225, 0.055), (0.185, 0.02), (0.0, 0.02)],
                  verts=32)
    basin.location = (0, 0, 0.975)
    parts.append(assign(basin, "ceramic"))

    tap = lathe("vanity_tap",
                [(0.0, 0.0), (0.026, 0.0), (0.026, 0.015), (0.014, 0.04), (0.014, 0.26), (0.0, 0.26)],
                verts=14)
    tap.location = (0, 0.19, 0.975)
    parts.append(assign(tap, "bronze"))

    mirror = rounded_box("vanity_mirror", (w - 0.2, 0.02, 1.0), (0, d / 2 - 0.01, 1.62), bevel=0.006)
    parts.append(assign(mirror, "darkMetal"))
    return parts


def p_bath():
    """A freestanding stone bath — a lathed vessel, squashed to an oval."""
    parts = []
    body = lathe(
        "bath_body",
        [(0.0, 0.0), (0.48, 0.0), (0.56, 0.07), (0.60, 0.50), (0.60, 0.56),
         (0.545, 0.56), (0.545, 0.12), (0.46, 0.05), (0.0, 0.05)],
        verts=44,
    )
    # Real baths are ovals, and a circular one reads as a paddling pool.
    body.scale = Vector((1.0, 1.9, 1.0))
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    body.select_set(False)
    parts.append(assign(body, "marble"))

    tap = cylinder("bath_tap", 0.02, 0.34, (0, -1.02, 0.17), verts=14, bevel=0.004)
    parts.append(assign(tap, "bronze"))
    return parts


def p_wc():
    parts = []
    body = rounded_box("wc_body", (0.38, 0.56, 0.34), (0, 0, 0.42), bevel=0.07,
                       segments=4, subsurf=1)
    parts.append(assign(body, "ceramic"))
    lid = rounded_box("wc_lid", (0.36, 0.5, 0.035), (0, 0.02, 0.60), bevel=0.015)
    parts.append(assign(lid, "ceramic"))
    plate = rounded_box("wc_plate", (0.15, 0.015, 0.09), (0, 0.29, 0.95), bevel=0.004)
    parts.append(assign(plate, "bronze"))
    return parts


def p_shower_screen():
    """Frameless glass on a bronze channel."""
    parts = []
    glass = rounded_box("screen_glass", (1.1, 0.012, 2.1), (0, 0, 1.06), bevel=0.004)
    parts.append(assign(glass, "marble"))
    channel = rounded_box("screen_channel", (1.14, 0.05, 0.03), (0, 0, 0.015), bevel=0.004)
    parts.append(assign(channel, "bronze"))
    post = cylinder("screen_post", 0.018, 2.12, (0.56, 0, 1.06), verts=12, bevel=0.004)
    parts.append(assign(post, "bronze"))
    return parts


def _limb(name, top_r, bot_r, length, verts=10):
    return lathe(name, [(0.0, 0.0), (bot_r, 0.0), (bot_r * 0.96, length * 0.12),
                        (top_r, length * 0.9), (top_r * 0.9, length), (0.0, length)], verts=verts)


def _figure(seated: bool):
    """
    Architectural entourage: a person, simplified.

    Deliberately not detailed. These stand at ten to forty metres in a
    render and their whole job is scale and life — a plaza with nobody on
    it reads as a model however good the building is. Detail at this
    distance is triangles nobody resolves, and a half-realistic face is far
    worse than an obvious abstraction.
    """
    parts = []
    hip = 0.50 if seated else 0.90
    torso_h = 0.64

    for side in (-1, 1):
        if seated:
            thigh = _limb(f"leg_t_{side}", 0.075, 0.085, 0.44)
            thigh.rotation_euler = (math.radians(90), 0, 0)
            thigh.location = (side * 0.10, 0.02, hip - 0.04)
            parts.append(assign(thigh, "upholsteryDark"))
            shin = _limb(f"leg_s_{side}", 0.055, 0.07, 0.46)
            shin.location = (side * 0.10, 0.44, 0.02)
            parts.append(assign(shin, "upholsteryDark"))
        else:
            leg = _limb(f"leg_{side}", 0.062, 0.088, hip)
            leg.location = (side * 0.095, 0, 0)
            parts.append(assign(leg, "upholsteryDark"))

    torso = rounded_box("torso", (0.36, 0.21, torso_h), (0, 0, hip + torso_h / 2),
                        bevel=0.07, segments=3, subsurf=1)
    parts.append(assign(torso, "linen"))

    # Thinner, longer, and tucked in against the ribs. At the first sizing
    # they were short fat blocks starting at the torso's own edge, so they
    # merged into the shirt and read as shoulders rather than arms.
    for side in (-1, 1):
        arm = _limb(f"arm_{side}", 0.040, 0.052, 0.66)
        arm.rotation_euler = (0, math.radians(180), math.radians(side * 4))
        arm.location = (side * 0.215, 0.01, hip + torso_h + 0.02)
        parts.append(assign(arm, "linen"))

    neck_y = hip + torso_h
    head = sphere("head", 0.105, (0, 0, neck_y + 0.13), segments=14, rings=9)
    head.scale = Vector((0.86, 0.94, 1.12))
    bpy.context.view_layer.objects.active = head
    head.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    head.select_set(False)
    parts.append(assign(head, "stone"))
    return parts


def p_person_standing():
    return _figure(seated=False)


def p_person_seated():
    return _figure(seated=True)


def _wheel(name, x, y, r, w):
    tyre = cylinder(name, r, w, (x, y, r), verts=16, bevel=0.012)
    tyre.rotation_euler = (0, math.radians(90), 0)
    return assign(tyre, "darkMetal")


def p_car_saloon():
    parts = []
    L, W = 4.72, 1.86
    # No subdivision on the body.
    #
    # Subsurf pulls a bevelled box in hard, and the shrink is what made the
    # first car read as a pickup: the flanks retreated behind the wheels so
    # they stood proud like castors, and the cabin ended up perched on a
    # flat deck rather than growing out of the body. A heavy multi-segment
    # bevel gives the same softness and keeps the dimensions honest.
    # Lifted so the wheels stand in arches. Sat lower it swallowed them
    # and the whole thing read as a loaf.
    body = rounded_box("car_body", (W, L, 0.60), (0, 0, 0.66), bevel=0.20, segments=6)
    parts.append(assign(body, "upholsteryDark"))
    # The greenhouse, set back, narrower, and overlapping the body so the
    # two read as one shell.
    cabin = rounded_box("car_cabin", (W - 0.30, L * 0.44, 0.54), (0, -0.18, 1.13),
                        bevel=0.20, segments=6)
    parts.append(assign(cabin, "darkMetal"))
    for x in (-1, 1):
        for y in (L / 2 - 0.92, -(L / 2 - 0.88)):
            parts.append(_wheel(f"car_wheel_{x}_{y:.0f}", x * (W / 2 - 0.15), y, 0.33, 0.22))
    return parts


def p_car_suv():
    parts = []
    L, W = 4.95, 2.00
    body = rounded_box("suv_body", (W, L, 0.78), (0, 0, 0.82), bevel=0.18, segments=6)
    parts.append(assign(body, "stone"))
    cabin = rounded_box("suv_cabin", (W - 0.22, L * 0.50, 0.62), (0, -0.12, 1.52),
                        bevel=0.17, segments=6)
    parts.append(assign(cabin, "darkMetal"))
    for x in (-1, 1):
        for y in (L / 2 - 1.0, -(L / 2 - 0.96)):
            parts.append(_wheel(f"suv_wheel_{x}_{y:.0f}", x * (W / 2 - 0.17), y, 0.39, 0.26))
    return parts


def p_boat_tender():
    """A small motor tender — hull, screen, outboard."""
    parts = []
    hull = extruded_profile(
        "tender_hull",
        [(-3.4, 0.30), (-2.4, 0.14), (-0.6, 0.05), (1.6, 0.06), (3.1, 0.22), (3.5, 0.52),
         (3.4, 0.98), (1.6, 0.86), (-1.0, 0.80), (-3.2, 0.86), (-3.5, 0.72)],
        1.85, bevel=0.06,
    )
    parts.append(assign(hull, "linen"))
    deck = rounded_box("tender_deck", (1.7, 2.4, 0.06), (0, 1.4, 0.86), bevel=0.02)
    parts.append(assign(deck, "teak" if "teak" in PALETTE else "joinery"))
    screen = rounded_box("tender_screen", (1.4, 0.05, 0.42), (0, 0.3, 1.08), bevel=0.02)
    parts.append(assign(screen, "marble"))
    engine = rounded_box("tender_engine", (0.42, 0.5, 0.72), (0, -3.2, 0.96), bevel=0.05)
    parts.append(assign(engine, "darkMetal"))
    return parts


def p_dining_table():
    parts = []
    top = rounded_box("dining_top", (1.1, 2.4, 0.05), (0, 0, 0.735), bevel=0.012)
    parts.append(assign(top, "marble"))
    for y in (-0.82, 0.82):
        leg = lathe(f"dining_leg_{y:.0f}",
                    [(0.0, 0.0), (0.30, 0.0), (0.30, 0.04), (0.11, 0.16), (0.11, 0.71), (0.0, 0.71)],
                    verts=24)
        leg.location = (0, y, 0)
        parts.append(assign(leg, "stone"))
    return parts


def p_dining_chair():
    parts = []
    seat = rounded_box("dchair_seat", (0.46, 0.46, 0.09), (0, 0, 0.44),
                       bevel=0.04, segments=3, subsurf=1)
    parts.append(assign(seat, "upholstery"))
    back = swept_arc("dchair_back", radius=0.30, arc_deg=150, section=0.09, height=0.44, verts=20)
    back.location = (0, 0.30, 0.70)
    parts.append(assign(back, "upholstery"))
    for x in (-1, 1):
        for y in (-1, 1):
            leg = _limb(f"dchair_leg_{x}_{y}", 0.016, 0.024, 0.44, verts=8)
            leg.location = (x * 0.18, y * 0.18, 0)
            parts.append(assign(leg, "bronze"))
    return parts


def p_parasol():
    parts = []
    post = lathe("parasol_post",
                 [(0.0, 0.0), (0.22, 0.0), (0.22, 0.05), (0.035, 0.09), (0.03, 2.35), (0.0, 2.35)],
                 verts=20)
    parts.append(assign(post, "bronze"))
    canopy = lathe("parasol_canopy",
                   [(0.0, 2.52), (0.42, 2.36), (1.30, 2.06), (1.42, 2.00), (1.40, 1.98),
                    (1.26, 2.03), (0.40, 2.33), (0.0, 2.49)],
                   verts=10)
    parts.append(assign(canopy, "linen"))
    return parts


def p_outdoor_sofa():
    parts = []
    base = rounded_box("osofa_base", (2.2, 0.9, 0.3), (0, 0, 0.15), bevel=0.03)
    parts.append(assign(base, "teak" if "teak" in PALETTE else "joinery"))
    seat = rounded_box("osofa_seat", (2.1, 0.84, 0.16), (0, 0, 0.38),
                       bevel=0.06, segments=4, subsurf=1)
    parts.append(assign(seat, "linen"))
    back = rounded_box("osofa_back", (2.1, 0.18, 0.42), (0, -0.33, 0.61),
                       bevel=0.06, segments=4, subsurf=1)
    parts.append(assign(back, "linen"))
    return parts


def p_cabana():
    """Four posts, a flat canopy and a daybed under it."""
    parts = []
    w, d, h = 2.6, 2.6, 2.5
    for x in (-1, 1):
        for y in (-1, 1):
            post = cylinder(f"cab_post_{x}_{y}", 0.055, h, (x * (w / 2 - 0.1), y * (d / 2 - 0.1), h / 2),
                            verts=12, bevel=0.006)
            parts.append(assign(post, "bronze"))
    roof = rounded_box("cab_roof", (w + 0.3, d + 0.3, 0.12), (0, 0, h + 0.06), bevel=0.03)
    parts.append(assign(roof, "linen"))
    bed = rounded_box("cab_bed", (1.9, 1.9, 0.34), (0, 0, 0.17), bevel=0.05, segments=3)
    parts.append(assign(bed, "teak" if "teak" in PALETTE else "joinery"))
    mattress = rounded_box("cab_mattress", (1.82, 1.82, 0.18), (0, 0, 0.43),
                           bevel=0.07, segments=4, subsurf=1)
    parts.append(assign(mattress, "linen"))
    return parts


def p_retail_counter():
    """A cash desk: solid body, stone top, lit toe recess."""
    parts = []
    w, d, h = 2.4, 0.72, 0.98
    body = rounded_box("counter_body", (w, d, h - 0.06), (0, 0, (h - 0.06) / 2 + 0.06), bevel=0.01)
    parts.append(assign(body, "joinery"))
    top = rounded_box("counter_top", (w + 0.06, d + 0.06, 0.05), (0, 0, h), bevel=0.012)
    parts.append(assign(top, "marble"))
    # The toe recess, which is what stops joinery reading as a crate.
    toe = rounded_box("counter_toe", (w - 0.16, d - 0.14, 0.07), (0, 0, 0.035), bevel=0.006)
    parts.append(assign(toe, "darkMetal"))
    return parts


def p_retail_rack():
    """A hanging rail with garments on it."""
    parts = []
    L = 1.9
    for x in (-1, 1):
        post = cylinder(f"rack_post_{x}", 0.022, 1.5, (x * L / 2, 0, 0.75), verts=12, bevel=0.004)
        parts.append(assign(post, "bronze"))
        foot = rounded_box(f"rack_foot_{x}", (0.06, 0.5, 0.03), (x * L / 2, 0, 0.015), bevel=0.006)
        parts.append(assign(foot, "bronze"))
    rail = cylinder("rack_rail", 0.016, L, (0, 0, 1.46), verts=12, bevel=0.003)
    rail.rotation_euler = (0, math.radians(90), 0)
    parts.append(assign(rail, "bronze"))

    # Garments: thin tapered slabs at irregular spacing. Evenly spaced they
    # read as a comb; a rail nobody has touched is the giveaway.
    for i in range(11):
        r = wobble(41, i)
        x = -L / 2 + 0.1 + (L - 0.2) * (i / 10) + (r - 0.5) * 0.05
        g = rounded_box(f"rack_gmt_{i}", (0.05 + r * 0.02, 0.34, 0.86 + r * 0.2),
                        (x, 0, 1.46 - (0.86 + r * 0.2) / 2 - 0.03), bevel=0.02, segments=3)
        g.rotation_euler = (0, 0, (r - 0.5) * 0.18)
        parts.append(assign(g, "linen" if i % 3 else "upholsteryDark"))
    return parts


def p_retail_shelf():
    """Open display shelving — the wall side of a shop."""
    parts = []
    w, d, h = 2.0, 0.4, 2.3
    for x in (-1, 1):
        side = rounded_box(f"shelf_side_{x}", (0.05, d, h), (x * (w / 2), 0, h / 2), bevel=0.006)
        parts.append(assign(side, "joinery"))
    for i in range(5):
        z = 0.28 + i * 0.48
        sh = rounded_box(f"shelf_{i}", (w, d, 0.035), (0, 0, z), bevel=0.006)
        parts.append(assign(sh, "joinery"))
        strip = rounded_box(f"shelf_light_{i}", (w - 0.12, 0.05, 0.018), (0, -d / 2 + 0.05, z - 0.03),
                            bevel=0.004)
        parts.append(assign(strip, "glow"))
        # Stock: a few objects per shelf, never a full row.
        for j in range(3):
            r = wobble(97 + i, j)
            if r < 0.35:
                continue
            ox = -w / 2 + 0.3 + (w - 0.6) * (j / 2) + (r - 0.5) * 0.16
            box_h = 0.14 + r * 0.16
            item = rounded_box(f"shelf_item_{i}_{j}", (0.16 + r * 0.1, 0.2, box_h),
                               (ox, 0.02, z + box_h / 2 + 0.018), bevel=0.012)
            parts.append(assign(item, "ceramic" if j % 2 else "stone"))
    return parts


def p_vitrine():
    """A glass display case on a plinth."""
    parts = []
    w, d = 0.9, 0.9
    plinth = rounded_box("vit_plinth", (w, d, 0.85), (0, 0, 0.425), bevel=0.01)
    parts.append(assign(plinth, "joinery"))
    for x in (-1, 1):
        for y in (-1, 1):
            post = cylinder(f"vit_post_{x}_{y}", 0.012, 0.8,
                            (x * (w / 2 - 0.02), y * (d / 2 - 0.02), 1.25), verts=8, bevel=0.002)
            parts.append(assign(post, "bronze"))
    cap = rounded_box("vit_cap", (w, d, 0.03), (0, 0, 1.665), bevel=0.006)
    parts.append(assign(cap, "bronze"))
    glassed = rounded_box("vit_glass", (w - 0.05, d - 0.05, 0.78), (0, 0, 1.25), bevel=0.004)
    parts.append(assign(glassed, "marble"))
    piece = lathe("vit_object",
                  [(0.0, 0.0), (0.09, 0.0), (0.12, 0.05), (0.10, 0.22), (0.06, 0.3), (0.0, 0.31)],
                  verts=24)
    piece.location = (0, 0, 0.86)
    parts.append(assign(piece, "ceramic"))
    return parts


def p_mannequin():
    """A headless torso on a stem — a shop form, not a person."""
    parts = []
    stand = lathe("mq_stand",
                  [(0.0, 0.0), (0.20, 0.0), (0.20, 0.02), (0.03, 0.05), (0.028, 0.78), (0.0, 0.78)],
                  verts=20)
    parts.append(assign(stand, "darkMetal"))
    torso = lathe("mq_torso",
                  [(0.0, 0.74), (0.10, 0.76), (0.155, 0.92), (0.13, 1.10), (0.16, 1.26),
                   (0.145, 1.38), (0.09, 1.44), (0.0, 1.45)],
                  verts=28)
    parts.append(assign(torso, "ceramic"))
    return parts


def p_escalator():
    """
    One escalator run, rising a single retail storey.

    Thirty degrees is the standard, and it is not an arbitrary choice: it
    fixes the run from the rise, so a 5 m floor-to-floor needs 8.66 m of
    floor. Getting that wrong is how an atrium ends up with an escalator
    that lands in a wall.
    """
    parts = []
    rise, angle = 5.0, math.radians(30)
    run = rise / math.tan(angle)
    length = math.hypot(rise, run)
    w = 1.05

    truss = rounded_box("esc_truss", (w, length, 0.72), (0, 0, 0), bevel=0.02)
    truss.rotation_euler = (angle, 0, 0)
    truss.location = (0, run / 2, rise / 2 - 0.1)
    # Stone, not blackened steel. A dark truss reads as a solid slab from
    # below, and the underside of an escalator is the thing an atrium
    # camera looking up sees most of.
    parts.append(assign(truss, "stone"))

    steps = rounded_box("esc_steps", (w - 0.14, length, 0.06), (0, 0, 0), bevel=0.008)
    steps.rotation_euler = (angle, 0, 0)
    steps.location = (0, run / 2, rise / 2 + 0.30)
    parts.append(assign(steps, "stone"))

    for x in (-1, 1):
        bal = rounded_box(f"esc_bal_{x}", (0.03, length, 0.95), (0, 0, 0), bevel=0.006)
        bal.rotation_euler = (angle, 0, 0)
        bal.location = (x * (w / 2 - 0.02), run / 2, rise / 2 + 0.78)
        parts.append(assign(bal, "marble"))
        rail = rounded_box(f"esc_rail_{x}", (0.075, length, 0.05), (0, 0, 0), bevel=0.02)
        rail.rotation_euler = (angle, 0, 0)
        rail.location = (x * (w / 2 - 0.02), run / 2, rise / 2 + 1.27)
        parts.append(assign(rail, "darkMetal"))
    return parts


def p_lift_doors():
    """A lift entrance: bronze architrave, two leaves, a call plate."""
    parts = []
    w, h = 1.15, 2.35
    frame = rounded_box("lift_frame", (w + 0.34, 0.09, h + 0.17), (0, 0, (h + 0.17) / 2), bevel=0.01)
    parts.append(assign(frame, "bronze"))
    for x in (-1, 1):
        leaf = rounded_box(f"lift_leaf_{x}", (w / 2 - 0.01, 0.04, h),
                           (x * w / 4, -0.05, h / 2), bevel=0.006)
        parts.append(assign(leaf, "darkMetal"))
    plate = rounded_box("lift_plate", (0.11, 0.02, 0.2), (w / 2 + 0.24, -0.06, 1.15), bevel=0.004)
    parts.append(assign(plate, "bronze"))
    return parts


def p_gym_bench():
    parts = []
    for x in (-1, 1):
        foot = rounded_box(f"gym_foot_{x}", (0.07, 0.62, 0.42), (x * 0.5, 0, 0.21), bevel=0.012)
        parts.append(assign(foot, "darkMetal"))
    pad = rounded_box("gym_pad", (1.3, 0.32, 0.11), (0, 0, 0.48), bevel=0.05, segments=3, subsurf=1)
    parts.append(assign(pad, "upholsteryDark"))
    return parts



# ── Phase 2: the pieces the other floors need ─────────────────────────────
#
# Five retail levels with one fit-out repeated on all of them is five copies
# of a clothes shop, and that is what the podium was. A mall is a sequence of
# different rooms: a lobby, then fashion, then home, then the food hall, then
# the cinema. These are the pieces that sequence needs and the library did
# not have.


def p_bar_stool():
    """A counter stool: round seat, splayed legs, a footring."""
    parts = []
    h = 0.74
    seat = cylinder("stool_seat", 0.17, 0.07, (0, 0, h), verts=24, bevel=0.014)
    parts.append(assign(seat, "upholsteryDark"))
    # Splayed, not vertical. A stool with parallel legs falls over, and reads
    # as though it would.
    for i in range(4):
        a = math.radians(45 + i * 90)
        r0, r1 = 0.055, 0.155
        leg = cylinder(f"stool_leg_{i}", 0.012, h, (0, 0, h / 2), verts=8, bevel=0.002)
        lean = math.atan2(r1 - r0, h)
        leg.rotation_euler = (lean * math.sin(a), -lean * math.cos(a), 0)
        leg.location = (math.cos(a) * (r0 + r1) / 2, math.sin(a) * (r0 + r1) / 2, h / 2)
        parts.append(assign(leg, "bronze"))
    # `swept_arc` takes a radial width and a height, not a section tuple.
    ring = swept_arc("stool_ring", 0.14, 350, 0.020, 0.020, verts=24, corner=0.006)
    ring.location = (0, 0, 0.24)
    parts.append(assign(ring, "bronze"))
    return parts


def p_cinema_row():
    """Four auditorium seats as one piece.

    Modelled as a row rather than a seat because that is how they are placed:
    an auditorium is rows, not a scatter, and one model per row is a quarter
    of the instances for the same result.

    Seats down rather than folded up. Two attempts at a folded row read as a
    stack of loose cushions — the fold is a subtlety that needs the seat, the
    pedestal and the back to describe each other, and at the size an
    auditorium is ever seen from here none of that survives. A row of seats
    in the down position reads as seating immediately, which is the whole job.
    """
    parts = []
    pitch = 0.58
    for i in range(4):
        x = (i - 1.5) * pitch
        # The pedestal each seat cantilevers off.
        base = rounded_box(f"cin_base_{i}", (pitch - 0.20, 0.30, 0.38), (x, 0.06, 0.19), bevel=0.02)
        parts.append(assign(base, "darkMetal"))
        seat = rounded_box(f"cin_seat_{i}", (pitch - 0.07, 0.50, 0.13), (x, -0.02, 0.44),
                           bevel=0.045, segments=3)
        parts.append(assign(seat, "upholsteryDark"))
        back = rounded_box(f"cin_back_{i}", (pitch - 0.07, 0.14, 0.62), (x, 0.27, 0.77),
                           bevel=0.045, segments=3)
        back.rotation_euler = (math.radians(11), 0, 0)
        parts.append(assign(back, "upholsteryDark"))
    # Arms between and either side — five for four seats, running the depth of
    # the seat rather than of the whole row.
    for i in range(5):
        x = (i - 2) * pitch
        arm = rounded_box(f"cin_arm_{i}", (0.08, 0.46, 0.09), (x, -0.02, 0.57), bevel=0.03)
        parts.append(assign(arm, "joinery"))
    return parts


def p_pendant():
    """A hanging shade on a drop, hung from the ceiling rather than standing.

    The origin is at the CEILING, not the floor — the one piece in the library
    where that is right. Everything else is placed by where it stands; a
    pendant is placed by what it hangs from, and giving it a floor origin
    would mean every call site subtracting a storey height it should not need
    to know.
    """
    parts = []
    drop = 0.9
    cord = cylinder("pend_cord", 0.006, drop, (0, 0, -drop / 2), verts=6, bevel=0.001)
    parts.append(assign(cord, "darkMetal"))
    shade = lathe("pend_shade", [
        (0.02, -drop), (0.10, -drop - 0.05), (0.17, -drop - 0.16),
        (0.19, -drop - 0.26), (0.185, -drop - 0.30),
    ], verts=24)
    parts.append(assign(shade, "bronze"))
    lamp = sphere("pend_lamp", 0.055, (0, 0, -drop - 0.28), segments=12, rings=8)
    parts.append(assign(lamp, "glow"))
    return parts


def p_wall_light():
    """A wall washer: a small bracket and a lit slot.

    Authored facing +Y like everything else, so it applies to a wall whose
    face points the way the piece does.
    """
    parts = []
    plate = rounded_box("wall_plate", (0.16, 0.05, 0.30), (0, 0.025, 0), bevel=0.012)
    parts.append(assign(plate, "bronze"))
    slot = rounded_box("wall_slot", (0.10, 0.02, 0.22), (0, 0.05, 0), bevel=0.006)
    parts.append(assign(slot, "glow"))
    return parts


def p_planter_trough():
    """A long trough of planting — the mall's own landscape.

    The soil is a separate part and sits below the rim, because a planter
    filled level to its own edge reads as a box of paint. What grows out of
    it is placed by the scene as foliage cards; this is the vessel and the
    soil only.
    """
    parts = []
    w, d, h, t = 2.2, 0.62, 0.52, 0.08
    # Four walls and a floor, not a solid block. The first version buried the
    # soil inside the body, where it was geometry nobody would ever see: a
    # planter is a container, and the whole of what reads is the fact that
    # you can see into it.
    for name, size, loc in (
        ("n", (w, t, h), (0, -(d - t) / 2, h / 2)),
        ("s", (w, t, h), (0, (d - t) / 2, h / 2)),
        ("w", (t, d - t * 2, h), (-(w - t) / 2, 0, h / 2)),
        ("e", (t, d - t * 2, h), ((w - t) / 2, 0, h / 2)),
        ("floor", (w - t * 2, d - t * 2, t), (0, 0, t / 2)),
    ):
        parts.append(assign(rounded_box(f"trough_{name}", size, loc, bevel=0.014), "travertine"))
    soil = rounded_box("trough_soil", (w - t * 2, d - t * 2, 0.10), (0, 0, h - 0.13), bevel=0.01)
    parts.append(assign(soil, "upholsteryDark"))
    return parts


def p_gym_rack():
    """A dumbbell rack — two tiers, loaded.

    Weights are spheres on a short bar rather than proper hex heads. At the
    distance a gym is ever seen from here that reads correctly, and the
    honest alternative costs eight hundred triangles a pair.
    """
    parts = []
    w = 1.6
    for tier, z in ((0, 0.36), (1, 0.78)):
        shelf = rounded_box(f"gym_shelf_{tier}", (w, 0.34, 0.05), (0, 0, z), bevel=0.01)
        parts.append(assign(shelf, "darkMetal"))
        for i in range(6):
            x = -w / 2 + 0.16 + (w - 0.32) * (i / 5)
            r = 0.055 + wobble(77 + tier, i) * 0.02
            bar = cylinder(f"gym_bar_{tier}_{i}", 0.014, 0.30, (x, 0, z + r + 0.02),
                           verts=8, bevel=0.002)
            bar.rotation_euler = (math.radians(90), 0, 0)
            parts.append(assign(bar, "darkMetal"))
            for side in (-1, 1):
                head = sphere(f"gym_w_{tier}_{i}_{side}", r,
                              (x, side * 0.12, z + r + 0.02), segments=10, rings=6)
                parts.append(assign(head, "darkMetal"))
    for side in (-1, 1):
        leg = rounded_box(f"gym_leg_{side}", (0.06, 0.34, 0.82), (side * (w / 2 - 0.05), 0, 0.41),
                          bevel=0.01)
        parts.append(assign(leg, "darkMetal"))
    return parts



def p_treadmill():
    """A treadmill: deck, running belt, uprights and a console.

    The one gym machine worth modelling. A gym reads as a gym from its
    silhouette against a window, and a treadmill's — a raked deck with two
    uprights and a bar across them — is the one everybody recognises. The
    rest of a gym is racks, benches and mats, all of which the library
    already has or can make out of boxes.
    """
    parts = []
    # The deck, raked slightly nose-up the way a running belt sits.
    # Authored facing +Y like everything else: the console is at the FRONT,
    # so `FACE.east` turns a treadmill to look at the ocean rather than away
    # from it. Building it mirrored and correcting at the call site is how a
    # library ends up with a different rule per piece.
    deck = rounded_box("tm_deck", (0.78, 1.55, 0.13), (0, -0.05, 0.20), bevel=0.02)
    deck.rotation_euler = (math.radians(3), 0, 0)
    parts.append(assign(deck, "darkMetal"))
    belt = rounded_box("tm_belt", (0.56, 1.34, 0.03), (0, -0.05, 0.275), bevel=0.008)
    belt.rotation_euler = (math.radians(3), 0, 0)
    parts.append(assign(belt, "upholsteryDark"))
    # Side rails either side of the belt, which is what you grab.
    for x in (-1, 1):
        rail = rounded_box(f"tm_rail_{x}", (0.09, 1.10, 0.05), (x * 0.34, -0.02, 0.33), bevel=0.018)
        parts.append(assign(rail, "bronze"))
    # Uprights, raked forward, carrying the console.
    for x in (-1, 1):
        post = rounded_box(f"tm_post_{x}", (0.07, 0.09, 1.05), (x * 0.33, 0.60, 0.72), bevel=0.02)
        post.rotation_euler = (math.radians(-11), 0, 0)
        parts.append(assign(post, "darkMetal"))
    console = rounded_box("tm_console", (0.72, 0.10, 0.34), (0, 0.72, 1.22), bevel=0.02)
    console.rotation_euler = (math.radians(-24), 0, 0)
    parts.append(assign(console, "darkMetal"))
    screen = rounded_box("tm_screen", (0.56, 0.03, 0.22), (0, 0.775, 1.23), bevel=0.008)
    screen.rotation_euler = (math.radians(-24), 0, 0)
    parts.append(assign(screen, "glow"))
    bar = cylinder("tm_bar", 0.019, 0.70, (0, 0.63, 1.02), verts=10, bevel=0.003)
    bar.rotation_euler = (0, math.radians(90), 0)
    parts.append(assign(bar, "bronze"))
    return parts


def p_treatment_table():
    """A spa treatment table: padded top, face cradle, a plinth under it.

    Deliberately not the bed model. A massage table is narrower, higher and
    has no headboard, and dressing a treatment room with a double bed is the
    single quickest way to make a spa read as a hotel room.
    """
    parts = []
    plinth = rounded_box("spa_plinth", (0.62, 1.70, 0.56), (0, 0, 0.28), bevel=0.03)
    parts.append(assign(plinth, "joinery"))
    pad = rounded_box("spa_pad", (0.74, 1.92, 0.14), (0, 0, 0.63), bevel=0.06, segments=3, subsurf=1)
    parts.append(assign(pad, "linen"))
    # The face cradle, which is most of what says "treatment" rather than "bed".
    cradle = rounded_box("spa_cradle", (0.30, 0.16, 0.09), (0, -1.02, 0.66), bevel=0.03)
    parts.append(assign(cradle, "upholsteryDark"))
    towel = rounded_box("spa_towel", (0.66, 0.44, 0.05), (0, 0.52, 0.72), bevel=0.02)
    parts.append(assign(towel, "linen"))
    return parts


def p_locker_bank():
    """Six changing-room lockers with a bench in front.

    One piece rather than six, for the same reason the auditorium row is one
    piece: they are only ever placed as a run.

    Doors and bench on +Y, so the run faces the way the convention says a
    piece faces and a wall of lockers put against a wall has its doors in the
    room rather than in the plaster.
    """
    parts = []
    w, d, h = 2.10, 0.52, 1.85
    carcass = rounded_box("lkr_carcass", (w, d, h), (0, 0, h / 2), bevel=0.012)
    parts.append(assign(carcass, "joinery"))
    # Door faces proud of the carcass, with a reveal between each.
    for i in range(6):
        col = i % 3
        row = i // 3
        dw = (w - 0.10) / 3 - 0.02
        dh = (h - 0.12) / 2 - 0.02
        x = -w / 2 + 0.05 + ((w - 0.10) / 3) * (col + 0.5)
        z = 0.06 + ((h - 0.12) / 2) * (row + 0.5)
        door = rounded_box(f"lkr_door_{i}", (dw, 0.03, dh), (x, d / 2 + 0.012, z), bevel=0.008)
        parts.append(assign(door, "bronze"))
        pull = cylinder(f"lkr_pull_{i}", 0.010, 0.11, (x + dw / 2 - 0.06, d / 2 + 0.035, z),
                        verts=8, bevel=0.002)
        parts.append(assign(pull, "darkMetal"))
    bench = rounded_box("lkr_bench", (w - 0.20, 0.34, 0.07), (0, 0.86, 0.44), bevel=0.02)
    parts.append(assign(bench, "joinery"))
    for x in (-1, 1):
        leg = rounded_box(f"lkr_leg_{x}", (0.06, 0.30, 0.41), (x * (w / 2 - 0.28), 0.86, 0.205),
                          bevel=0.012)
        parts.append(assign(leg, "darkMetal"))
    return parts


PIECES = {
    "sofa-3seat": (p_sofa_3seat, "MDL-01"),
    "lounge-chair": (p_lounge_chair, "MDL-02"),
    "ottoman": (p_ottoman, "MDL-02"),
    "low-table": (p_low_table, "MDL-03"),
    "side-drum": (p_side_drum, "MDL-03"),
    "bed": (p_bed, "MDL-04"),
    "nightstand": (p_nightstand, "MDL-05"),
    "table-lamp": (p_table_lamp, "MDL-05"),
    "floor-lamp": (p_floor_lamp, "MDL-11"),
    "vessel-tall": (p_vessel_tall, "MDL-10"),
    "vessel-round": (p_vessel_round, "MDL-10"),
    "bowl": (p_bowl, "MDL-10"),
    "organic-table-lg": (p_organic_table_lg, "MDL-03"),
    "organic-table-sm": (p_organic_table_sm, "MDL-03"),
    "stone-lounger": (p_stone_lounger, "MDL-12"),
    "wingback": (p_wingback, "MDL-02"),
    "planter-cyl": (p_planter_cyl, "MDL-10"),
    "tray": (p_tray, "MDL-10"),
    "book-stack": (p_book_stack, "MDL-10"),
    "candle-cluster": (p_candle_cluster, "MDL-10"),
    "ceiling-soffit": (p_ceiling_soffit, "MDL-09"),
    "kitchen-island": (p_kitchen_island, "MDL-07"),
    "kitchen-run": (p_kitchen_run, "MDL-07"),
    "vanity": (p_vanity, "MDL-08"),
    "bath": (p_bath, "MDL-08"),
    "wc": (p_wc, "MDL-08"),
    "shower-screen": (p_shower_screen, "MDL-08"),
    "person-standing": (p_person_standing, "MDL-16"),
    "person-seated": (p_person_seated, "MDL-16"),
    "car-saloon": (p_car_saloon, "MDL-17"),
    "car-suv": (p_car_suv, "MDL-17"),
    "boat-tender": (p_boat_tender, "MDL-18"),
    "dining-table": (p_dining_table, "MDL-06"),
    "dining-chair": (p_dining_chair, "MDL-06"),
    "parasol": (p_parasol, "MDL-12"),
    "outdoor-sofa": (p_outdoor_sofa, "MDL-12"),
    "cabana": (p_cabana, "MDL-12"),
    "retail-counter": (p_retail_counter, "MDL-13"),
    "retail-rack": (p_retail_rack, "MDL-13"),
    "retail-shelf": (p_retail_shelf, "MDL-13"),
    "vitrine": (p_vitrine, "MDL-13"),
    "mannequin": (p_mannequin, "MDL-13"),
    "escalator": (p_escalator, "MDL-14"),
    "lift-doors": (p_lift_doors, "MDL-14"),
    "gym-bench": (p_gym_bench, "MDL-15"),
    "gym-rack": (p_gym_rack, "MDL-15"),
    "treadmill": (p_treadmill, "MDL-15"),
    "treatment-table": (p_treatment_table, "MDL-15"),
    "locker-bank": (p_locker_bank, "MDL-15"),
    "bar-stool": (p_bar_stool, "MDL-06"),
    "cinema-row": (p_cinema_row, "MDL-13"),
    "pendant": (p_pendant, "MDL-11"),
    "wall-light": (p_wall_light, "MDL-11"),
    "planter-trough": (p_planter_trough, "MDL-12"),
}


# ── export ────────────────────────────────────────────────────────────────

def tri_count():
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        eval_obj = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = eval_obj.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        eval_obj.to_mesh_clear()
    return total


def build(name):
    reset()
    builder, ref = PIECES[name]
    parts = builder()
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    return parts, ref


def export(name):
    parts, ref = build(name)
    tris = tri_count()
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,          # modifiers baked; no subsurf at runtime
        export_yup=True,            # Blender Z-up -> glTF/three Y-up
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    size = os.path.getsize(path)
    flag = "" if tris <= 25000 else "  ** over budget **"
    print(f"  {name:<14} {ref:<8} {tris:>7,} tris   {size // 1024:>5} KB{flag}")
    return tris, size


# ── preview ───────────────────────────────────────────────────────────────

def preview(name, outdir):
    """
    Renders one piece three-quarter on a neutral ground.

    Worth having because a .glb tells you nothing by looking at it, and the
    failure mode of procedural furniture is silhouette — a chair whose back
    has bent the wrong way exports perfectly and weighs the right amount.
    """
    build(name)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 520
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"

    # Ground.
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("ground")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.32, 0.32, 0.31, 1)
    gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    ground.data.materials.append(gm)

    # A soft key and a fill, which is all a product shot needs.
    bpy.ops.object.light_add(type="AREA", location=(2.6, -2.4, 3.2))
    key = bpy.context.active_object
    key.data.energy = 260
    key.data.size = 3.5
    key.rotation_euler = (math.radians(42), 0, math.radians(46))

    bpy.ops.object.light_add(type="AREA", location=(-3.0, 1.8, 2.0))
    fill = bpy.context.active_object
    fill.data.energy = 70
    fill.data.size = 4.0
    fill.rotation_euler = (math.radians(64), 0, math.radians(-125))

    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.30, 0.33, 0.36, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

    # Frame the piece from its own bounds, so every preview is composed the
    # same way whatever size the object happens to be.
    objs = [o for o in scene.objects if o.type == "MESH" and o is not ground]
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for corner in o.bound_box:
            p = o.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
    centre = (lo + hi) / 2
    reach = max((hi - lo).length, 0.6)

    bpy.ops.object.camera_add(location=(centre.x + reach * 1.15, centre.y - reach * 1.35, centre.z + reach * 0.72))
    cam = bpy.context.active_object
    cam.data.lens = 60
    direction = centre - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    os.makedirs(outdir, exist_ok=True)
    scene.render.filepath = os.path.join(outdir, f"{name}.png")
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print(f"  preview {name}")


def main():
    args = [a for a in sys.argv[1:]]
    do_preview = "--preview" in args
    args = [a for a in args if not a.startswith("--")]
    wanted = args or list(PIECES)
    unknown = [w for w in wanted if w not in PIECES]
    if unknown:
        raise SystemExit(f"unknown pieces: {unknown}")

    if do_preview:
        outdir = os.environ.get("PREVIEW_DIR", os.path.join(ROOT, "preview"))
        for name in wanted:
            preview(name, outdir)
        return

    total_tris = 0
    total_size = 0
    print(f"{'piece':<16}{'ref':<9}{'tris':>9}{'size':>10}")
    for name in wanted:
        t, s = export(name)
        total_tris += t
        total_size += s
    print(f"\n  {len(wanted)} pieces   {total_tris:,} tris   {total_size // 1024} KB total")


if __name__ == "__main__":
    main()
