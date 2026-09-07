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
