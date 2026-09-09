"""
Authors the project's PBR surface library in Blender and bakes it to the
tiling maps `ScannedMaps.ts` already knows how to load.

Run headless:
    python3 tools/blender/surfaces.py [family ...]

## Seamlessness

Blender's procedural noise is 3D and does not tile. Every material here is
driven through `torus_coords`, which maps the unit UV square onto a torus in
four dimensions:

    (cos 2piu, sin 2piu, cos 2piv), w = sin 2piv

Sampling 4D noise along that surface is periodic in both u and v by
construction, so the tile is seamless without any offset-blending or
clone-stamping afterwards. It is the one technique that gives genuinely
tileable procedural texture rather than something that looks tileable until
you put four copies side by side.

## Honesty

These are procedurally authored and baked, NOT photographic scans. They are
a large step up from the runtime canvas bakes they replace — real cell
structure for aggregate, real ring geometry for timber, normals baked from
actual displacement rather than approximated in 2D — but nothing here is a
photograph of a real material, and the asset audit must keep saying so.
"""

import math
import os
import sys

import bpy

TAU = math.pi * 2.0
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT = os.path.normpath(os.path.join(ROOT, "public", "assets", "surfaces"))


# ── scene plumbing ────────────────────────────────────────────────────────

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    # These bake types read the surface directly; they are not light
    # transport, so one sample is exact and anything more is wasted time.
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 64


def make_plane():
    bpy.ops.mesh.primitive_plane_add(size=2)
    plane = bpy.context.active_object
    # A single UV-unit face: the bake target is exactly one tile.
    return plane


# ── node helpers ──────────────────────────────────────────────────────────

def O(node, idx=0):
    """
    The output socket that actually carries this node's result.

    `ShaderNodeMix` exposes one output per data type — float on 0, vector on
    1, colour on 2 — so a colour mix read from socket 0 silently hands the
    next node a single grey number instead of an image. That is not a
    hypothetical: it flattened every albedo in the first bake, and it is
    invisible in the node graph because the link is legal.
    """
    if idx == 0 and node.bl_idname == "ShaderNodeMix" and node.data_type == "RGBA":
        return node.outputs[2]
    return node.outputs[idx]


class G:
    """Thin wrapper over a node tree, so material code reads as maths."""

    def __init__(self, tree):
        self.t = tree
        self.n = tree.nodes
        self.l = tree.links
        self._x = 0

    def new(self, kind, **kw):
        node = self.n.new(kind)
        node.location = (self._x, 0)
        self._x += 180
        for k, v in kw.items():
            setattr(node, k, v)
        return node

    def link(self, a, ao, b, bi):
        self.l.new(O(a, ao) if isinstance(ao, int) else a.outputs[ao], b.inputs[bi])

    def math(self, op, a, b=None, ai=0):
        node = self.new("ShaderNodeMath", operation=op)
        if hasattr(a, "outputs"):
            self.link(a, ai, node, 0)
        else:
            node.inputs[0].default_value = a
        if b is not None:
            if hasattr(b, "outputs"):
                self.link(b, 0, node, 1)
            else:
                node.inputs[1].default_value = b
        return node

    def ramp(self, src, stops, si=0):
        node = self.new("ShaderNodeValToRGB")
        self.link(src, si, node, 0)
        el = node.color_ramp.elements
        while len(el) > 1:
            el.remove(el[-1])
        el[0].position, el[0].color = stops[0][0], stops[0][1]
        for pos, col in stops[1:]:
            e = el.new(pos)
            e.color = col
        return node

    def mixrgb(self, fac, a, b, fi=0):
        node = self.new("ShaderNodeMix", data_type="RGBA", blend_type="MIX")
        if hasattr(fac, "outputs"):
            self.link(fac, fi, node, 0)
        else:
            node.inputs[0].default_value = fac
        for slot, v in ((6, a), (7, b)):
            if hasattr(v, "outputs"):
                self.l.new(O(v), node.inputs[slot])
            else:
                node.inputs[slot].default_value = v
        return node


def torus_coords(g, scale):
    """
    Unit UV mapped onto a 4D torus, so any noise sampled on it tiles.

    `scale` is in tiles-per-unit: the feature size relative to one tile.
    The radius is divided by tau so a scale of 1 gives features about the
    size of the tile itself, which keeps the numbers meaning something.
    """
    uv = g.new("ShaderNodeTexCoord")
    sep = g.new("ShaderNodeSeparateXYZ")
    g.link(uv, "UV", sep, 0)

    r = scale / TAU

    def circle(index):
        ang = g.math("MULTIPLY", sep, TAU, ai=index)
        c = g.math("COSINE", ang)
        s = g.math("SINE", ang)
        return g.math("MULTIPLY", c, r), g.math("MULTIPLY", s, r)

    ux, uy = circle(0)
    vx, vy = circle(1)

    comb = g.new("ShaderNodeCombineXYZ")
    g.link(ux, 0, comb, 0)
    g.link(uy, 0, comb, 1)
    g.link(vx, 0, comb, 2)
    return comb, vy


def noise(g, scale, detail=8.0, rough=0.5, distortion=0.0, tile=1.0):
    """4D noise on the torus — the seamless primitive everything is built on."""
    vec, w = torus_coords(g, tile)
    n = g.new("ShaderNodeTexNoise", noise_dimensions="4D")
    g.link(vec, 0, n, "Vector")
    g.link(w, 0, n, "W")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    if "Distortion" in n.inputs:
        n.inputs["Distortion"].default_value = distortion
    return n


def voronoi(g, scale, feature="F1", randomness=1.0, tile=1.0):
    vec, w = torus_coords(g, tile)
    v = g.new("ShaderNodeTexVoronoi", voronoi_dimensions="4D", feature=feature)
    g.link(vec, 0, v, "Vector")
    g.link(w, 0, v, "W")
    v.inputs["Scale"].default_value = scale
    if "Randomness" in v.inputs:
        v.inputs["Randomness"].default_value = randomness
    return v


def board_random(g, axis_index, count, seed=0.0):
    """
    One random value per board, constant across that board's width.

    Without it every plank in the floor carries identical grain at an
    identical phase, and eight of them stacked read as corduroy rather than
    as eight pieces of timber. Floor the axis to get a board index, then
    hash it — the value is flat within a board and jumps at every joint,
    which is exactly what a real floor does.
    """
    uv = g.new("ShaderNodeTexCoord")
    sep = g.new("ShaderNodeSeparateXYZ")
    g.link(uv, "UV", sep, 0)
    scaled = g.math("MULTIPLY", sep, float(count), ai=axis_index)
    idx = g.math("FLOOR", scaled)
    shifted = g.math("ADD", idx, seed)
    wn = g.new("ShaderNodeTexWhiteNoise", noise_dimensions="1D")
    g.link(shifted, 0, wn, "W")
    return wn


def wave(g, axis_index, count, distort_src=None, distort=0.0):
    """A periodic band along one UV axis — planks, boards, weave, veining."""
    uv = g.new("ShaderNodeTexCoord")
    sep = g.new("ShaderNodeSeparateXYZ")
    g.link(uv, "UV", sep, 0)
    scaled = g.math("MULTIPLY", sep, float(count), ai=axis_index)
    if distort_src is not None and distort:
        d = g.math("MULTIPLY", distort_src, distort)
        scaled = g.math("ADD", scaled, d)
    return g.math("FRACT", scaled), scaled


# ── the material library ──────────────────────────────────────────────────
#
# Each builder wires base colour, roughness and a bump into the BSDF. The
# bump is what the normal bake reads, so displacement is authored once and
# both the shading and the exported normal map follow from it.

def m_plaster(g, bsdf):
    fine = noise(g, 46.0, detail=9.0, rough=0.62)
    broad = noise(g, 5.0, detail=4.0, rough=0.5)
    col = g.ramp(fine, [(0.34, (0.86, 0.84, 0.80, 1)), (0.72, (0.94, 0.93, 0.90, 1))])
    tint = g.mixrgb(0.25, col, g.ramp(broad, [(0.4, (0.88, 0.86, 0.82, 1)), (0.6, (0.93, 0.92, 0.89, 1))]))
    g.l.new(O(tint), bsdf.inputs["Base Color"])
    r = g.ramp(fine, [(0.3, (0.86,) * 3 + (1,)), (0.8, (0.95,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    return fine, 0.28


def m_stone(g, bsdf):
    # Travertine: a bedded stone. Broad layering across one axis, with
    # elongated pores lying in those beds.
    bed = noise(g, 3.2, detail=6.0, rough=0.55)
    pore = voronoi(g, 62.0, feature="F1", randomness=0.9)
    grain = noise(g, 120.0, detail=6.0, rough=0.7)
    col = g.ramp(bed, [(0.32, (0.74, 0.70, 0.63, 1)), (0.68, (0.87, 0.84, 0.78, 1))])
    dark = g.ramp(pore, [(0.0, (0.55, 0.51, 0.45, 1)), (0.11, (1, 1, 1, 1))])
    mixed = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    mixed.inputs[0].default_value = 0.75
    g.l.new(O(col), mixed.inputs[6])
    g.l.new(O(dark), mixed.inputs[7])
    g.l.new(O(mixed), bsdf.inputs["Base Color"])
    r = g.ramp(grain, [(0.3, (0.42,) * 3 + (1,)), (0.75, (0.58,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.6, bed, pore)
    return h, 0.34


def m_oak(g, bsdf):
    # 180 mm boards across a 1.44 m tile is exactly eight.
    warp = noise(g, 2.6, detail=4.0, rough=0.5)
    plank, _ = wave(g, 1, 8)
    brand = board_random(g, 1, 8)
    # Rings vary ACROSS the board's width, so the grain lines run ALONG its
    # length. Varying them along the length instead — the first cut —
    # produces grain at right angles to the boards, which no piece of sawn
    # timber has ever done and reads instantly as wrong.
    #
    # The ring coordinate is shifted by the board's own random, so adjacent
    # boards never line up, and heavily distorted so the rings wander and
    # bunch the way growth rings actually do rather than sitting at even
    # centres like a corrugated sheet.
    rings_src = noise(g, 2.2, detail=5.0, rough=0.55)
    phase = g.math("MULTIPLY", brand, 7.0, ai="Value")
    wander = g.math("MULTIPLY", rings_src, 5.5, ai="Fac")
    combined = g.math("ADD", phase, wander)
    ring_band, _ = wave(g, 1, 52, distort_src=combined, distort=1.0)
    ring = g.ramp(ring_band, [(0.0, (0.40, 0.27, 0.16, 1)), (0.45, (0.62, 0.45, 0.29, 1)), (1.0, (0.44, 0.30, 0.18, 1))])
    fibre = noise(g, 300.0, detail=3.0, rough=0.7)
    fib = g.ramp(fibre, [(0.35, (0.85, 0.85, 0.85, 1)), (0.65, (1, 1, 1, 1))])
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 0.35
    g.l.new(O(ring), body.inputs[6])
    g.l.new(O(fib), body.inputs[7])
    # Board-to-board tonal variation, so no two planks read the same.
    board_tone = g.ramp(brand, [(0.0, (0.80, 0.76, 0.72, 1)), (1.0, (1.12, 1.08, 1.03, 1))], si="Value")
    final = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    final.inputs[0].default_value = 0.5
    g.l.new(O(body), final.inputs[6])
    g.l.new(O(board_tone), final.inputs[7])
    g.l.new(O(final), bsdf.inputs["Base Color"])
    r = g.ramp(ring_band, [(0.0, (0.34,) * 3 + (1,)), (0.5, (0.46,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    # The joint between boards is the deepest thing on the surface.
    joint = g.ramp(plank, [(0.0, (0.0,) * 3 + (1,)), (0.03, (1, 1, 1, 1)), (0.97, (1, 1, 1, 1)), (1.0, (0.0,) * 3 + (1,))])
    h = g.mixrgb(0.35, joint, ring_band)
    return h, 0.20


def m_marble(g, bsdf):
    warp = noise(g, 1.6, detail=6.0, rough=0.62)
    vein_band, _ = wave(g, 0, 3, distort_src=warp, distort=5.2)
    fine = noise(g, 8.0, detail=8.0, rough=0.55)
    vein_band2, _ = wave(g, 1, 2, distort_src=fine, distort=4.4)
    v1 = g.ramp(vein_band, [(0.44, (1, 1, 1, 1)), (0.5, (0.45, 0.44, 0.46, 1)), (0.56, (1, 1, 1, 1))])
    v2 = g.ramp(vein_band2, [(0.46, (1, 1, 1, 1)), (0.5, (0.66, 0.65, 0.68, 1)), (0.54, (1, 1, 1, 1))])
    veins = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    veins.inputs[0].default_value = 1.0
    g.l.new(O(v1), veins.inputs[6])
    g.l.new(O(v2), veins.inputs[7])
    base = g.ramp(fine, [(0.4, (0.93, 0.93, 0.92, 1)), (0.7, (0.98, 0.98, 0.97, 1))])
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 1.0
    g.l.new(O(base), body.inputs[6])
    g.l.new(O(veins), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    # Honed, not polished, and the veins sit very slightly proud.
    r = g.ramp(vein_band, [(0.45, (0.24,) * 3 + (1,)), (0.55, (0.19,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    return fine, 0.05


def m_linen(g, bsdf):
    warp_b, _ = wave(g, 0, 130)
    weft_b, _ = wave(g, 1, 130)
    warp = g.ramp(warp_b, [(0.0, (0.0,) * 3 + (1,)), (0.5, (1, 1, 1, 1)), (1.0, (0.0,) * 3 + (1,))])
    weft = g.ramp(weft_b, [(0.0, (0.0,) * 3 + (1,)), (0.5, (1, 1, 1, 1)), (1.0, (0.0,) * 3 + (1,))])
    weave = g.new("ShaderNodeMix", data_type="RGBA", blend_type="ADD")
    weave.inputs[0].default_value = 0.5
    g.l.new(O(warp), weave.inputs[6])
    g.l.new(O(weft), weave.inputs[7])
    slub = noise(g, 40.0, detail=5.0, rough=0.7)
    col = g.ramp(weave, [(0.15, (0.72, 0.69, 0.63, 1)), (0.85, (0.86, 0.83, 0.77, 1))])
    tone = g.mixrgb(0.3, col, g.ramp(slub, [(0.4, (0.78, 0.75, 0.69, 1)), (0.6, (0.87, 0.85, 0.79, 1))]))
    g.l.new(O(tone), bsdf.inputs["Base Color"])
    r = g.ramp(weave, [(0.2, (0.94,) * 3 + (1,)), (0.8, (0.82,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.25, weave, slub)
    return h, 0.55


def m_wool(g, bsdf):
    pile = noise(g, 240.0, detail=8.0, rough=0.72)
    tuft = voronoi(g, 90.0, feature="F1", randomness=1.0)
    drift = noise(g, 6.0, detail=4.0, rough=0.5)
    col = g.ramp(pile, [(0.32, (0.55, 0.53, 0.49, 1)), (0.72, (0.74, 0.72, 0.67, 1))])
    tone = g.mixrgb(0.28, col, g.ramp(drift, [(0.4, (0.60, 0.58, 0.54, 1)), (0.6, (0.71, 0.69, 0.65, 1))]))
    g.l.new(O(tone), bsdf.inputs["Base Color"])
    r = g.ramp(pile, [(0.3, (0.98,) * 3 + (1,)), (0.8, (0.88,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.45, pile, tuft)
    return h, 0.9


def m_leather(g, bsdf):
    cell = voronoi(g, 140.0, feature="F1", randomness=1.0)
    crease = voronoi(g, 140.0, feature="DISTANCE_TO_EDGE", randomness=1.0)
    fine = noise(g, 420.0, detail=4.0, rough=0.7)
    col = g.ramp(cell, [(0.0, (0.28, 0.21, 0.16, 1)), (1.0, (0.42, 0.32, 0.24, 1))])
    edge = g.ramp(crease, [(0.0, (0.55, 0.45, 0.36, 1)), (0.09, (1, 1, 1, 1))])
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 0.8
    g.l.new(O(col), body.inputs[6])
    g.l.new(O(edge), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    r = g.ramp(fine, [(0.3, (0.44,) * 3 + (1,)), (0.75, (0.56,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.6, crease, fine)
    return h, 0.32


def m_paving(g, bsdf):
    slab = voronoi(g, 5.0, feature="DISTANCE_TO_EDGE", randomness=0.35)
    cellid = voronoi(g, 5.0, feature="F1", randomness=0.35)
    grain = noise(g, 90.0, detail=7.0, rough=0.6)
    joint = g.ramp(slab, [(0.0, (0.16, 0.15, 0.14, 1)), (0.035, (1, 1, 1, 1))])
    tone = g.ramp(cellid, [(0.0, (0.55, 0.53, 0.49, 1)), (1.0, (0.70, 0.68, 0.63, 1))])
    grainy = g.mixrgb(0.3, tone, g.ramp(grain, [(0.35, (0.56, 0.54, 0.50, 1)), (0.7, (0.70, 0.68, 0.64, 1))]))
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 1.0
    g.l.new(O(grainy), body.inputs[6])
    g.l.new(O(joint), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    r = g.ramp(grain, [(0.3, (0.58,) * 3 + (1,)), (0.75, (0.72,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.25, slab, grain)
    return h, 0.45


def m_concrete(g, bsdf):
    # Board-marked: horizontal shutter boards with a lipped joint, plus
    # blowholes from the pour.
    board, _ = wave(g, 1, 12)
    fine = noise(g, 70.0, detail=8.0, rough=0.6)
    blow = voronoi(g, 40.0, feature="F1", randomness=1.0)
    joint = g.ramp(board, [(0.0, (0.62, 0.62, 0.61, 1)), (0.05, (1, 1, 1, 1)), (0.95, (1, 1, 1, 1)), (1.0, (0.66, 0.66, 0.65, 1))])
    base = g.ramp(fine, [(0.32, (0.66, 0.66, 0.64, 1)), (0.72, (0.78, 0.78, 0.76, 1))])
    holes = g.ramp(blow, [(0.0, (0.48, 0.48, 0.47, 1)), (0.05, (1, 1, 1, 1))])
    m1 = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    m1.inputs[0].default_value = 1.0
    g.l.new(O(base), m1.inputs[6])
    g.l.new(O(joint), m1.inputs[7])
    m2 = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    m2.inputs[0].default_value = 0.6
    g.l.new(O(m1), m2.inputs[6])
    g.l.new(O(holes), m2.inputs[7])
    g.l.new(O(m2), bsdf.inputs["Base Color"])
    r = g.ramp(fine, [(0.3, (0.72,) * 3 + (1,)), (0.75, (0.86,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.4, board, blow)
    return h, 0.30


def m_terrazzo(g, bsdf):
    chip = voronoi(g, 46.0, feature="F1", randomness=1.0)
    edge = voronoi(g, 46.0, feature="DISTANCE_TO_EDGE", randomness=1.0)
    fine = noise(g, 300.0, detail=4.0, rough=0.6)
    # Aggregate in four tones against a pale matrix — the chips are the
    # whole material, so they get real cell geometry rather than noise.
    chips = g.ramp(chip, [
        (0.00, (0.90, 0.89, 0.86, 1)),
        (0.30, (0.42, 0.40, 0.38, 1)),
        (0.52, (0.88, 0.86, 0.82, 1)),
        (0.70, (0.62, 0.55, 0.48, 1)),
        (0.88, (0.95, 0.94, 0.92, 1)),
    ])
    matrix = g.ramp(edge, [(0.0, (0.83, 0.82, 0.79, 1)), (0.06, (1, 1, 1, 1))])
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 0.55
    g.l.new(O(chips), body.inputs[6])
    g.l.new(O(matrix), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    r = g.ramp(fine, [(0.35, (0.22,) * 3 + (1,)), (0.7, (0.30,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    return edge, 0.04


def m_teak(g, bsdf):
    # Deck boards with a caulked joint between them.
    board, _ = wave(g, 1, 10)
    grain_src = noise(g, 4.0, detail=3.0, rough=0.45)
    # As oak: grain runs along the board, so the rings vary across it.
    grain_b, _ = wave(g, 1, 110, distort_src=grain_src, distort=1.4)
    fibre = noise(g, 260.0, detail=4.0, rough=0.7)
    caulk = g.ramp(board, [(0.0, (0.10, 0.10, 0.10, 1)), (0.06, (1, 1, 1, 1)), (0.94, (1, 1, 1, 1)), (1.0, (0.10, 0.10, 0.10, 1))])
    wood = g.ramp(grain_b, [(0.0, (0.54, 0.45, 0.34, 1)), (0.5, (0.70, 0.61, 0.47, 1)), (1.0, (0.56, 0.47, 0.36, 1))])
    weath = g.mixrgb(0.4, wood, g.ramp(fibre, [(0.35, (0.62, 0.58, 0.52, 1)), (0.7, (0.74, 0.70, 0.63, 1))]))
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 1.0
    g.l.new(O(weath), body.inputs[6])
    g.l.new(O(caulk), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    r = g.ramp(fibre, [(0.3, (0.66,) * 3 + (1,)), (0.75, (0.80,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.5, caulk, grain_b)
    return h, 0.38


def m_bronze(g, bsdf):
    # Brushed metal is a directional material: the whole look is thousands
    # of parallel scratches, and noise without direction reads as cast.
    streak = noise(g, 900.0, detail=3.0, rough=0.75)
    broad = noise(g, 14.0, detail=4.0, rough=0.5)
    band, _ = wave(g, 1, 700, distort_src=streak, distort=0.9)
    col = g.ramp(band, [(0.0, (0.42, 0.31, 0.17, 1)), (0.5, (0.60, 0.46, 0.26, 1)), (1.0, (0.44, 0.33, 0.18, 1))])
    tone = g.mixrgb(0.3, col, g.ramp(broad, [(0.4, (0.48, 0.36, 0.20, 1)), (0.6, (0.58, 0.45, 0.26, 1))]))
    g.l.new(O(tone), bsdf.inputs["Base Color"])
    # Deliberately NOT metallic for the bake.
    #
    # A metal has no diffuse component, so baking Diffuse off a metallic
    # BSDF returns black — which is exactly what the first bronze bake did,
    # a 16 KB albedo of nothing. The map's job is to carry the colour and
    # the brush marks; `materials.ts` sets metalness at runtime, where it
    # belongs.
    r = g.ramp(band, [(0.0, (0.20,) * 3 + (1,)), (0.5, (0.34,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    return band, 0.06


def m_tile(g, bsdf):
    # Large format, thin joint. The joint is the whole read: without it a
    # tiled floor is just a stone floor.
    across, _ = wave(g, 0, 2)
    down, _ = wave(g, 1, 4)
    fine = noise(g, 90.0, detail=6.0, rough=0.6)
    drift = noise(g, 3.0, detail=5.0, rough=0.55)
    jx = g.ramp(across, [(0.0, (0.30, 0.29, 0.28, 1)), (0.012, (1, 1, 1, 1)), (0.988, (1, 1, 1, 1)), (1.0, (0.30, 0.29, 0.28, 1))])
    jz = g.ramp(down, [(0.0, (0.30, 0.29, 0.28, 1)), (0.02, (1, 1, 1, 1)), (0.98, (1, 1, 1, 1)), (1.0, (0.30, 0.29, 0.28, 1))])
    joints = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    joints.inputs[0].default_value = 1.0
    g.l.new(O(jx), joints.inputs[6])
    g.l.new(O(jz), joints.inputs[7])
    base = g.mixrgb(0.35, g.ramp(fine, [(0.35, (0.78, 0.76, 0.72, 1)), (0.7, (0.87, 0.85, 0.81, 1))]),
                    g.ramp(drift, [(0.4, (0.74, 0.72, 0.68, 1)), (0.6, (0.86, 0.84, 0.80, 1))]))
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 1.0
    g.l.new(O(base), body.inputs[6])
    g.l.new(O(joints), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    r = g.ramp(fine, [(0.3, (0.24,) * 3 + (1,)), (0.75, (0.34,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    return joints, 0.22


def m_sand(g, bsdf):
    # Combed by wind and tide: the ripples are directional and the grain is
    # not, so both go in.
    ripple_src = noise(g, 5.0, detail=4.0, rough=0.5)
    ripple, _ = wave(g, 0, 34, distort_src=ripple_src, distort=3.2)
    grain = noise(g, 520.0, detail=3.0, rough=0.7)
    drift = noise(g, 8.0, detail=5.0, rough=0.55)
    col = g.ramp(grain, [(0.3, (0.80, 0.75, 0.65, 1)), (0.75, (0.92, 0.88, 0.79, 1))])
    tone = g.mixrgb(0.25, col, g.ramp(drift, [(0.4, (0.83, 0.78, 0.68, 1)), (0.6, (0.91, 0.87, 0.78, 1))]))
    g.l.new(O(tone), bsdf.inputs["Base Color"])
    r = g.ramp(grain, [(0.3, (0.90,) * 3 + (1,)), (0.75, (0.97,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.55, ripple, grain)
    return h, 0.5


def m_boucle(g, bsdf):
    # Looped yarn: a field of little bobbles, which is what separates
    # boucle from every other pale upholstery and why the reference rooms
    # read as soft.
    loop = voronoi(g, 190.0, feature="F1", randomness=1.0)
    edge = voronoi(g, 190.0, feature="DISTANCE_TO_EDGE", randomness=1.0)
    fibre = noise(g, 700.0, detail=3.0, rough=0.7)
    col = g.ramp(loop, [(0.0, (0.80, 0.77, 0.71, 1)), (1.0, (0.94, 0.92, 0.87, 1))])
    shade = g.ramp(edge, [(0.0, (0.72, 0.70, 0.66, 1)), (0.14, (1, 1, 1, 1))])
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 0.85
    g.l.new(O(col), body.inputs[6])
    g.l.new(O(shade), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    r = g.ramp(fibre, [(0.3, (0.92,) * 3 + (1,)), (0.75, (0.98,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    h = g.mixrgb(0.7, edge, fibre)
    return h, 0.85


def m_glass_grime(g, bsdf):
    # Greyscale only, and very faint. Salt film and dust in the corners is
    # the detail that most sells real glass; overdone it reads as a dirty
    # window, which sells nothing.
    film = noise(g, 6.0, detail=6.0, rough=0.6)
    runs_src = noise(g, 3.0, detail=4.0, rough=0.5)
    runs, _ = wave(g, 1, 26, distort_src=runs_src, distort=4.5)
    spec = noise(g, 240.0, detail=3.0, rough=0.7)
    base = g.ramp(film, [(0.35, (0.90, 0.90, 0.90, 1)), (0.75, (1.0, 1.0, 1.0, 1))])
    streak = g.ramp(runs, [(0.44, (1, 1, 1, 1)), (0.5, (0.93, 0.93, 0.93, 1)), (0.56, (1, 1, 1, 1))])
    body = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    body.inputs[0].default_value = 0.7
    g.l.new(O(base), body.inputs[6])
    g.l.new(O(streak), body.inputs[7])
    g.l.new(O(body), bsdf.inputs["Base Color"])
    r = g.ramp(spec, [(0.35, (0.06,) * 3 + (1,)), (0.8, (0.14,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])
    return film, 0.03


# family -> (builder, resolution, tile in metres, note)
def m_grass(g, bsdf):
    """
    Mown lawn.

    ## Why this family had to exist

    The lawn is the largest single surface in the project — it fills the
    bottom half of the arrival and park framings — and it was the one thing
    with no maps at all: a flat green with a little tint drift, which reads as
    billiard felt. Every hard surface in the building had albedo, roughness
    and normals baked from displacement; the ground they stand on had none.

    ## What is authored, and at what scale

    The first attempt put nearly all its detail at blade scale and baked out
    almost flat, because at a tile of 0.85 m a blade is three pixels and three
    pixels of high-frequency noise average to their own mean. What actually
    reads on a lawn from ten metres is not blades at all: it is patchiness at
    a hand's width and larger — clumps growing at different rates, wear where
    people walk, damp in the hollows, dry on the crowns. So most of the
    contrast lives there, with the blade speckle sitting on top for anyone
    standing on it.

    Colour runs bleached yellow-green to deep blue-green rather than light to
    dark of one hue. That hue shift is most of what separates turf from a
    green surface: dry blades go yellow, shaded ones go blue, and a lawn is
    always some of each.

    Nothing here is directional at mower scale. The runtime lays its own mown
    bands over this and two periodic patterns at similar scales would moire.
    """
    blade = noise(g, 220.0, detail=8.0, rough=0.8)
    clump = voronoi(g, 21.0, feature="F1", randomness=1.0)
    patch = noise(g, 7.0, detail=6.0, rough=0.62, distortion=0.8)
    wear = noise(g, 2.4, detail=4.0, rough=0.5)

    # The patch tone does most of the work, and it is a wide range.
    base = g.ramp(patch, [
        (0.24, (0.20, 0.27, 0.10, 1)),
        (0.44, (0.28, 0.37, 0.15, 1)),
        (0.62, (0.38, 0.46, 0.20, 1)),
        (0.80, (0.50, 0.55, 0.26, 1)),
    ])
    # Clump boundaries are the shadow between tufts — genuinely dark.
    gaps = g.ramp(clump, [(0.0, (0.42, 0.46, 0.38, 1)), (0.22, (1, 1, 1, 1))])
    clumped = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    clumped.inputs[0].default_value = 0.85
    g.l.new(O(base), clumped.inputs[6])
    g.l.new(O(gaps), clumped.inputs[7])

    # Blade speckle, for anybody standing on it.
    speck = g.ramp(blade, [(0.34, (0.72, 0.76, 0.66, 1)), (0.70, (1.12, 1.10, 1.02, 1))])
    bladed = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    bladed.inputs[0].default_value = 0.55
    g.l.new(O(clumped), bladed.inputs[6])
    g.l.new(O(speck), bladed.inputs[7])

    # Broad dry patches over the top of all of it.
    dry = g.ramp(wear, [(0.34, (0.86, 0.84, 0.62, 1)), (0.70, (1.0, 1.0, 0.96, 1))])
    tinted = g.new("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    tinted.inputs[0].default_value = 0.6
    g.l.new(O(bladed), tinted.inputs[6])
    g.l.new(O(dry), tinted.inputs[7])
    g.l.new(O(tinted), bsdf.inputs["Base Color"])

    # Matte everywhere; the worn patches are the shiniest thing on a lawn,
    # which is not saying much.
    r = g.ramp(wear, [(0.3, (0.84,) * 3 + (1,)), (0.8, (0.97,) * 3 + (1,))])
    g.l.new(O(r), bsdf.inputs["Roughness"])

    # Relief from the clumps first, blades second: a lawn's silhouette against
    # raking light is tufts, not individual leaves.
    h = g.mixrgb(0.4, clump, blade)
    return h, 0.75


FAMILIES = {
    "plaster":  (m_plaster,  1024, 1.60, "Fine lime render"),
    "stone":    (m_stone,    1024, 1.20, "Honed travertine"),
    "oak":      (m_oak,      2048, 1.44, "European oak, 180 mm boards"),
    "marble":   (m_marble,   2048, 2.00, "Statuario"),
    "linen":    (m_linen,    1024, 0.10, "Plain-weave linen"),
    "wool":     (m_wool,     1024, 0.32, "Cut-pile wool"),
    "leather":  (m_leather,  1024, 0.35, "Fine-grain aniline"),
    "paving":   (m_paving,   1024, 1.20, "Sawn stone paving"),
    "concrete": (m_concrete, 1024, 2.40, "Board-marked concrete"),
    "terrazzo": (m_terrazzo, 1024, 1.80, "Fine-aggregate terrazzo"),
    "teak":     (m_teak,     1024, 1.20, "Weathered teak decking"),
    "bronze":     (m_bronze,     1024, 0.60, "Brushed anodised bronze"),
    "tile":       (m_tile,       1024, 1.20, "Large-format stone tile"),
    "sand":       (m_sand,       1024, 3.00, "Wind-combed beach sand"),
    "boucle":     (m_boucle,     1024, 0.12, "Looped boucle upholstery"),
    "glassGrime": (m_glass_grime, 1024, 4.00, "Salt film and dust on glass"),
    "grass":      (m_grass,      1024, 0.85, "Mown lawn at blade scale"),
}


# ── baking ────────────────────────────────────────────────────────────────

def bake_family(name):
    builder, res, tile, note = FAMILIES[name]
    reset_scene()
    scene = bpy.context.scene
    # Bake raw values; no view transform is to be written into the files.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    plane = make_plane()
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    plane.data.materials.append(mat)

    tree = mat.node_tree
    tree.nodes.clear()
    g = G(tree)
    out = g.new("ShaderNodeOutputMaterial")
    bsdf = g.new("ShaderNodeBsdfPrincipled")
    g.link(bsdf, "BSDF", out, "Surface")

    height, strength = builder(g, bsdf)
    bump = g.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    # Distance is in the plane's own units, where the whole tile is 2 units
    # across, so this reads as a fraction of the tile rather than metres.
    bump.inputs["Distance"].default_value = 0.06
    g.l.new(O(height), bump.inputs["Height"])
    g.l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    target = tree.nodes.new("ShaderNodeTexImage")
    tree.nodes.active = target

    outdir = os.path.join(OUT, name)
    os.makedirs(outdir, exist_ok=True)

    passes = (
        ("albedo", "DIFFUSE", "sRGB"),
        ("roughness", "ROUGHNESS", "Non-Color"),
        ("normal", "NORMAL", "Non-Color"),
    )

    for fname, bake_type, colorspace in passes:
        img = bpy.data.images.new(f"{name}_{fname}", res, res, alpha=False, float_buffer=True)
        img.colorspace_settings.name = colorspace
        target.image = img
        bpy.ops.object.select_all(action="DESELECT")
        plane.select_set(True)
        bpy.context.view_layer.objects.active = plane
        bpy.ops.object.bake(type=bake_type, normal_space="TANGENT", margin=64)
        img.file_format = "JPEG"
        scene.render.image_settings.file_format = "JPEG"
        scene.render.image_settings.quality = 94
        path = os.path.join(outdir, f"{fname}.jpg")
        img.save_render(filepath=path)
        size = os.path.getsize(path)
        print(f"  {name}/{fname}.jpg  {res}px  {size // 1024} KB")
        bpy.data.images.remove(img)

    print(f"{name}: done  ({note}, tile {tile} m)")


def main():
    wanted = sys.argv[1:] or list(FAMILIES)
    unknown = [w for w in wanted if w not in FAMILIES]
    if unknown:
        raise SystemExit(f"unknown families: {unknown}")
    os.makedirs(OUT, exist_ok=True)
    for name in wanted:
        bake_family(name)


if __name__ == "__main__":
    main()
