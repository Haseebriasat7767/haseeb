"""
Bakes the foliage atlas — real leaf silhouettes with a clean alpha.

Run headless:
    python3 tools/blender/foliage.py

## What this replaces

`FoliageAtlas.ts` draws its leaves into a 2-D canvas at runtime: a few
thousand filled blobs with a stroked midrib. That was the right call with
no asset pipeline, and it is the reason a crown reads as a texture of green
smudges rather than as leaves — a canvas leaf has no taper into the tip, no
asymmetry across the midrib, and no serration on its margin, and those
three things are most of what a leaf's outline is.

Here each leaf is real geometry: an outline sampled from a width profile
that runs to zero at both ends, drawn about a curved midrib, with the
margin perturbed. Rendered orthographically over a transparent film, so
what lands in the file is silhouette and colour and nothing else.

## The layout is not negotiable

`ATLAS_CELLS` maps four quadrants to four UV offsets, and the card shader
indexes them directly. Canvas Y runs down and UV V runs up, so the file's
TOP row is V = 0.5 and its BOTTOM row is V = 0. The cells here are placed
to match `getFoliageAtlas`'s own draw order, colour for colour and density
for density — get it wrong and every shrub in the project quietly swaps
species with every tree. That is also why there is no palm variant in the
fourth cell, tempting as it is: the fourth slot is a mid-density broadleaf
cluster everywhere in the scene graph, and palms have their own model.

## A card is mostly hole

The first bake filled 87% of every cell. That is the one failure mode this
technique cannot survive: with no transparency for the alpha test to cut,
every card renders as an opaque green rectangle and a tree becomes a stack
of playing cards. The cluster has to sit well inside its own tile, its
outline has to be ragged rather than round, and the crown has to have
genuine holes in it — all three are enforced below, and none of them are
cosmetic.
"""

import colorsys
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "foliage")

RESOLUTION = 2048

# Half-width of one atlas cell in scene units. The four cells tile the
# two-unit square the orthographic camera frames.
HALF = 0.5

# Ceiling on how far the cluster may reach into its own cell, as a fraction
# of `HALF`. Lifted straight from the runtime atlas, where it is the line
# between foliage and an opaque rectangle.
REACH = 0.66


def rand(seed):
    x = math.sin(seed * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def between(seed, lo, hi):
    return lo + rand(seed) * (hi - lo)


def srgb(r, g, b):
    """sRGB triple to linear, for a float colour attribute.

    Byte colour layers carry their own sRGB tag and Blender linearises them
    on read; float layers do not, so the conversion has to happen here. The
    first bake wrote pre-converted values into a byte layer and got the
    transform applied twice, which took a mid green of (70, 111, 76) down to
    (16, 41, 18) — near black, and unrecoverable by any amount of relighting.
    """

    def c(u):
        return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4

    return (c(r), c(g), c(b))


def leaf_outline(bm, cx, cy, z, length, width, angle, seed, colour, layer):
    """
    One leaf, as a filled polygon about a curved midrib.

    The width profile peaks a third of the way up rather than at the middle,
    which is what gives a leaf its shoulder and its long taper to the tip;
    a symmetric profile reads as a petal. The two margins are perturbed
    independently so no leaf is a mirror of itself.
    """
    steps = 9
    bend = (rand(seed + 7) - 0.5) * 0.5
    ca, sa = math.cos(angle), math.sin(angle)

    def place(u, v):
        # `u` along the midrib, `v` across it; the midrib itself curves.
        vx = v + bend * math.sin(math.pi * u) * width * 0.6
        # Shifted back by the shoulder so the leaf balances about its
        # placement point rather than trailing off one side of it.
        x, y = (u - 0.4) * length, vx
        return Vector((cx + x * ca - y * sa, cy + x * sa + y * ca, z))

    left, right = [], []
    for i in range(steps + 1):
        u = i / steps
        # Peaks at u = 1/3, zero at both ends. The multiplier has to carry
        # `u` all the way to 1.0 at the tip: an earlier 0.75 topped out at
        # 0.83, so every leaf ended blunt at half its own width and the whole
        # cell read as a heap of ovals — which is precisely the failing of
        # the canvas atlas this exists to replace.
        prof = math.sin(math.pi * (u * 0.92 + 0.08)) ** 0.85
        w = width * prof
        jl = 1.0 + (rand(seed + i * 3) - 0.5) * 0.22
        jr = 1.0 + (rand(seed + i * 5 + 100) - 0.5) * 0.22
        left.append(place(u, w * jl))
        right.append(place(u, -w * jr))

    verts = [bm.verts.new(p) for p in left] + [bm.verts.new(p) for p in reversed(right)]
    bm.verts.ensure_lookup_table()
    try:
        face = bm.faces.new(verts)
    except ValueError:
        return
    for loop in face.loops:
        loop[layer] = (*colour, 1.0)


def twig(bm, cx, cy, z, angle, length, width, seed, colour, layer):
    """One bowed taper of woody structure, drawn under the leaves.

    Real planting is not a solid ball of leaf. There is structure beneath it,
    and the glimpses of it through the gaps are a large part of what the eye
    reads as a plant rather than as a painted volume.
    """
    bow = between(seed + 3, -0.25, 0.25)
    ca, sa = math.cos(angle), math.sin(angle)

    def place(u, v):
        x, y = u * length, v + bow * math.sin(math.pi * u) * length * 0.25
        return Vector((cx + x * ca - y * sa, cy + x * sa + y * ca, z))

    steps = 5
    left = [place(i / steps, width * (1.0 - i / steps) * 0.5) for i in range(steps + 1)]
    right = [place(i / steps, -width * (1.0 - i / steps) * 0.5) for i in range(steps + 1)]
    verts = [bm.verts.new(p) for p in left] + [bm.verts.new(p) for p in reversed(right[1:])]
    bm.verts.ensure_lookup_table()
    try:
        face = bm.faces.new(verts)
    except ValueError:
        return
    for loop in face.loops:
        loop[layer] = (*colour, 1.0)


def build_cell(bm, layer, ox, oy, count, seed_base):
    """Fills one cell with an irregular, holed cluster.

    Mirrors the runtime atlas's construction — ragged outline, angular gap
    mask, square-root radial bias, tone falling toward the middle — because
    the two have to be interchangeable at the same UV offsets. What is new
    is that every leaf here is a polygon with a real margin instead of a
    filled curve.
    """
    # Nine harmonics of radius against angle. A disc is the single clearest
    # way to give away that a canopy is made of cards; six gentle harmonics
    # still described one.
    lobes = [between(seed_base + i * 17, 0.45, 1.0) for i in range(9)]
    aspect = between(seed_base + 991, 0.72, 1.24)

    def radius_at(angle):
        r = 0.5
        for i, lobe in enumerate(lobes):
            r += math.cos(angle * (i + 1) + lobe * math.tau) * 0.062 * lobe
        return min(max(r, 0.3), REACH)

    # A slow angular mask that thins the cluster in two or three places, so
    # sky shows through the crown instead of stopping at its rim.
    gap_phase = between(seed_base + 733, 0.0, math.tau)
    gap_lobes = round(between(seed_base + 737, 2, 3))

    def gap_at(angle):
        return 0.34 + 0.66 * abs(math.cos(angle * gap_lobes + gap_phase))

    # Woody structure first, a hair below the leaves in z.
    twigs = round(between(seed_base + 401, 9, 16))
    for i in range(twigs):
        s = seed_base + 5000 + i * 31
        angle = (i / twigs) * math.tau + between(s, -0.3, 0.3)
        twig(
            bm, ox, oy, -0.02, angle,
            radius_at(angle) * HALF * between(s + 1, 0.55, 1.0),
            between(s + 2, 0.004, 0.009),
            s,
            srgb(*colorsys.hls_to_rgb(
                between(s + 4, 28, 46) / 360,
                between(s + 5, 0.11, 0.19),
                between(s + 6, 0.14, 0.26),
            )),
            layer,
        )

    placed = 0
    for i in range(count):
        s = seed_base + i * 13
        angle = rand(s) * math.tau
        # Square-root bias fills the middle before the edge; the extra factor
        # pulls a minority of leaves out past the outline as stragglers.
        t = math.sqrt(rand(s + 1)) * (1.1 if rand(s + 2) > 0.9 else 0.94)
        if rand(s + 3) > gap_at(angle) + 0.14:
            continue

        reach = radius_at(angle) * t * HALF
        cx = ox + math.cos(angle) * reach * aspect
        cy = oy + math.sin(angle) * reach * (0.9 / aspect)

        # Darker toward the middle: a canopy is lit from outside, and the
        # tonal gradient is what gives a flat card the appearance of depth.
        depth = 1 - t * 0.55
        rim = t > 0.82 and rand(s + 4) > 0.55
        hue = (71 if rim else 80) + between(s + 5, -13, 16)
        sat = ((34 if rim else 24) + between(s + 6, -9, 14)) / 100
        light = (9 + (1 - depth) * 44 + (9 if rim else 0) + between(s + 7, -5, 8)) / 100

        length = between(s + 8, 0.026, 0.053) * (0.8 + (1 - t) * 0.34)
        # Nothing may cross into a neighbouring cell: the shader samples a
        # fixed 0.5 x 0.5 window per card, so one stray leaf becomes foliage
        # hanging off the edge of an unrelated shrub.
        if abs(cx - ox) + length > HALF or abs(cy - oy) + length > HALF:
            continue

        # A per-leaf z, so coplanar overlaps resolve the same way every bake.
        leaf_outline(
            bm, cx, cy, rand(s + 9) * 0.01, length,
            length * between(s + 10, 0.26, 0.44),
            rand(s + 11) * math.tau, s,
            srgb(*colorsys.hls_to_rgb(hue / 360, light, sat)),
            layer,
        )
        placed += 1
    return placed


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    # Emission over a transparent film: samples buy antialiasing on the leaf
    # margins and nothing else, and the margin is the whole product here.
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    scene.render.resolution_x = RESOLUTION
    scene.render.resolution_y = RESOLUTION
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    mesh = bpy.data.meshes.new("foliage")
    obj = bpy.data.objects.new("foliage", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    layer = bm.loops.layers.float_color.new("leaf")

    # Order and density mirror `getFoliageAtlas`. Top row is V = 0.5: two
    # full clusters for the body of a crown, one sparse for its edge, one
    # mid for shrubs.
    cells = [
        (-HALF, HALF, 1700, 1000),
        (HALF, HALF, 1500, 2000),
        (-HALF, -HALF, 900, 3000),
        (HALF, -HALF, 1150, 4000),
    ]
    for ox, oy, count, seed in cells:
        placed = build_cell(bm, layer, ox, oy, count, seed)
        print(f"  cell ({ox:+.1f},{oy:+.1f})  {placed} leaves")

    bm.to_mesh(mesh)
    bm.free()

    mat = bpy.data.materials.new("leaf")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "leaf"
    nt.links.new(attr.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    mesh.materials.append(mat)

    # Straight down, orthographic, framing exactly the two-unit square the
    # four cells occupy.
    bpy.ops.object.camera_add(location=(0, 0, 4))
    cam = bpy.context.active_object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.0
    scene.camera = cam

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "atlas.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"  atlas.png  {RESOLUTION}px  {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
