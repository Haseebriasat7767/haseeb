"""
Bakes Tier 4 — decals, signage and 2D.

Run headless:
    python3 tools/blender/decals.py                 # everything
    python3 tools/blender/decals.py signage masks   # or just some

## Why these are worth their weight

Nothing here is architecture. A retail podium with no tenant names on it is
not a quiet podium, it is an unlet one, and the eye reads that immediately
even when it cannot say why. The same goes for a lift lobby with no level
number and an apartment wall with nothing on it. These are the cheapest
assets in the whole schedule and close to the most effective.

## Typefaces

AURELIA's own two, vendored under `fonts/` with their licences: Cormorant
Garamond for anything that speaks as the building, Inter for anything that
speaks as a sign. The site's headings are already set in Cormorant Light and
its body in Inter, so lettering cut into a crown or etched on a lobby wall is
the same lettering as the page around it. Both are SIL Open Font License 1.1,
which permits redistribution and places no restriction at all on rendered
output.

## Nothing here is a real mark

Every tenant name below is invented. The schedule is explicit about this and
so is the licence position: reproducing a real retailer's wordmark on a
building that is not theirs is a trademark problem no amount of "it is only a
render" survives. If real tenants are ever signed, their marks replace these
files and nothing else changes.

## Why the type is rasterised here rather than rendered

Blender is the wrong tool for setting type and this file is the evidence.
`convert(target="MESH")` on a text object fills every counter bounded by
straight strokes solid — A, M, N, V, K and W all block in, while O, D and R
come out fine. It is not a setting: extrude, fill mode, curve resolution and
tracking were each tried and each reproduces it. Triangulating the contours
by hand with `tessellate_polygon` gets further and then fails for the real
reason: a TrueType glyph is filled by NONZERO WINDING and is free to be a
single self-intersecting contour, which Cormorant's A is. No triangulator
resolves that, because the filled region is not a polygon.

So the outlines are taken from Blender — `convert(target="CURVE")` yields the
typeface's own Beziers exactly — and filled by the scanline rasteriser below,
which implements the winding rule the format actually specifies. The same
contours are written to SVG with `fill-rule="nonzero"`, so the vector and the
raster are the same shape by construction and cannot drift.

Cycles is still used, for the two jobs it is good at: the artwork and the
tiling imperfection masks.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.geometry import interpolate_bezier  # noqa: E402
from surfaces import TAU, G, O, noise, voronoi  # noqa: E402

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "decals")
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

CORMORANT = os.path.join(FONTS, "CormorantGaramond-Light.ttf")
INTER = os.path.join(FONTS, "Inter-Regular.ttf")
INTER_MED = os.path.join(FONTS, "Inter-Medium.ttf")
# The crown and the lobby lockup are set in the Medium, not the Light the
# site's headings use. Not a brand inconsistency — a weight decision. Nobody
# cuts a hairline serif into a parapet: the stroke has to survive fabrication
# and it has to survive the distance, and at 1.2 m cap height read from the
# beach a Light's thin stroke is under half a pixel and simply is not there.
CORMORANT_MED = os.path.join(FONTS, "CormorantGaramond-Medium.ttf")

# Warm white. Signage and wayfinding bake as a single tone: the file carries
# silhouette, and the scene decides whether that silhouette is a lit letter at
# night or a painted one at noon. Baking a colour here would fix that decision
# into the texture, which is the one thing a decal must not do.
WHITE = (0.94, 0.92, 0.87)

# Supersampling for the rasteriser, per axis. Four is 16 samples a pixel,
# which on a hairline serif at 2048 px is the difference between a stem and a
# staircase, and costs about a second a sheet.
SS = 4


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# ── stretched noise ───────────────────────────────────────────────────────

def torus_aniso(g, tile_u, tile_v):
    """The surface library's tiling torus, with a different radius per axis.

    `torus_coords` takes one scale and so can only produce features that are
    as wide as they are tall. Rain does not run that way and neither does a
    scratch. Feature size along an axis goes as the reciprocal of its radius,
    so a large `tile_u` against a small `tile_v` gives something narrow across
    and long down — while still closing on itself in both directions, which is
    the entire reason for mapping onto a torus in the first place.
    """
    uv = g.new("ShaderNodeTexCoord")
    sep = g.new("ShaderNodeSeparateXYZ")
    g.link(uv, "UV", sep, 0)

    def circle(index, tile):
        r = tile / TAU
        ang = g.math("MULTIPLY", sep, TAU, ai=index)
        return (g.math("MULTIPLY", g.math("COSINE", ang), r),
                g.math("MULTIPLY", g.math("SINE", ang), r))

    ux, uy = circle(0, tile_u)
    vx, vy = circle(1, tile_v)
    comb = g.new("ShaderNodeCombineXYZ")
    g.link(ux, 0, comb, 0)
    g.link(uy, 0, comb, 1)
    g.link(vx, 0, comb, 2)
    return comb, vy


def stretched_noise(g, scale, tile_u, tile_v, detail=8.0, rough=0.5):
    vec, w = torus_aniso(g, tile_u, tile_v)
    n = g.new("ShaderNodeTexNoise", noise_dimensions="4D")
    g.link(vec, 0, n, "Vector")
    g.link(w, 0, n, "W")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    return n


def stretched_voronoi(g, scale, tile_u, tile_v, feature="DISTANCE_TO_EDGE"):
    vec, w = torus_aniso(g, tile_u, tile_v)
    v = g.new("ShaderNodeTexVoronoi", voronoi_dimensions="4D", feature=feature)
    g.link(vec, 0, v, "Vector")
    g.link(w, 0, v, "W")
    v.inputs["Scale"].default_value = scale
    return v


# ── outlines ──────────────────────────────────────────────────────────────

def type_curves(body, font_path, tracking=1.0):
    """One line of type, converted to its own Bezier contours."""
    bpy.ops.object.text_add()
    obj = bpy.context.active_object
    data = obj.data
    data.body = body
    data.font = bpy.data.fonts.load(font_path)
    data.align_x = "CENTER"
    data.align_y = "CENTER"
    # Tracking. Architectural lettering is set far looser than running text —
    # a wordmark cut into a parapet at 1.4 m tall and read from the beach is
    # spaced for the distance, not for the paragraph.
    data.space_character = tracking
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="CURVE")
    bpy.context.view_layer.update()
    return obj


def contours(obj, samples=12):
    """Each closed contour of a curve object, as a list of (x, y).

    `samples` is per Bezier segment. Twelve is past what 2048 px resolves on
    a letter this size and costs nothing: this runs once at bake time.
    """
    out = []
    for spline in obj.data.splines:
        if spline.type != "BEZIER" or len(spline.bezier_points) < 2:
            continue
        pts = list(spline.bezier_points)
        seq = pts + [pts[0]]
        poly = []
        for a, b in zip(seq, seq[1:]):
            seg = interpolate_bezier(a.co, a.handle_right, b.handle_left, b.co, samples)
            # Drop each segment's last point: it is the next segment's first.
            poly += [(p.x, p.y) for p in seg[:-1]]
        if len(poly) >= 3:
            out.append(poly)
    return out


def text_outline(body, font_path, tracking=1.0):
    """The contours of a line of type, with the scaffolding cleaned up."""
    curve = type_curves(body, font_path, tracking)
    cs = contours(curve)
    bpy.data.objects.remove(curve, do_unlink=True)
    return cs


def bounds(cs):
    xs = [x for c in cs for x, _ in c]
    ys = [y for c in cs for _, y in c]
    return min(xs), min(ys), max(xs), max(ys)


def fit(cs, cx, cy, max_w, max_h, flip_y=True):
    """Scales contours into a box and centres them on (cx, cy), in pixels.

    Fitting by the tighter of the two axes is what keeps a long name and a
    short one optically the same weight on the same fascia. Centring works
    from the real bounding box rather than the type's origin, because that
    origin sits on the baseline and descenders hang below it.

    `flip_y` because outlines arrive with Y up and an image has row 0 at the
    top. Getting it wrong produces a legible sheet that is upside down, which
    at least announces itself.
    """
    if not cs:
        return []
    x0, y0, x1, y1 = bounds(cs)
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return []
    s = min(max_w / w, max_h / h)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    sy = -s if flip_y else s
    return [[(cx + (x - mx) * s, cy + (y - my) * sy) for x, y in c] for c in cs]


# ── the rasteriser ────────────────────────────────────────────────────────

def rasterise(shapes, width, height):
    """Coverage for a set of closed contours, by the nonzero winding rule.

    Every crossing of a sample row by an edge contributes +1 or -1 at the
    crossing's column depending on which way the edge runs; a running sum
    along the row is then the winding number at every pixel, and anything
    non-zero is inside. That is the rule TrueType is defined by, and it is
    what makes a self-intersecting contour — Cormorant's capital A is one —
    fill correctly instead of turning inside out.

    Everything is done on a grid `SS` times finer in both axes and box-filtered
    down, which is where the antialiasing comes from. Rows are processed in
    blocks: the intermediate is one float per edge per sample row, and for a
    sheet of sixteen names that product is tens of millions.
    """
    edges = []
    for contour in shapes:
        for (ax, ay), (bx, by) in zip(contour, contour[1:] + contour[:1]):
            if ay != by:
                edges.append((ax, ay, bx, by))
    if not edges:
        return np.zeros((height, width), dtype=np.float32)

    e = np.asarray(edges, dtype=np.float64)
    ax, ay, bx, by = e[:, 0] * SS, e[:, 1] * SS, e[:, 2] * SS, e[:, 3] * SS
    direction = np.where(by > ay, 1, -1).astype(np.int32)
    ylo = np.minimum(ay, by)
    yhi = np.maximum(ay, by)

    H, W = height * SS, width * SS
    acc = np.zeros((H, W + 1), dtype=np.int32)

    block = max(1, 2_000_000 // max(1, len(edges)))
    for start in range(0, H, block):
        stop = min(H, start + block)
        # Sample at row centres. Sampling on the boundary makes a horizontal
        # edge land exactly on a sample row, which double-counts it.
        ys = np.arange(start, stop, dtype=np.float64) + 0.5
        crosses = (ys[:, None] >= ylo[None, :]) & (ys[:, None] < yhi[None, :])
        rows, cols = np.nonzero(crosses)
        if rows.size == 0:
            continue
        t = (ys[rows] - ay[cols]) / (by[cols] - ay[cols])
        xs = ax[cols] + t * (bx[cols] - ax[cols])
        xi = np.clip(np.ceil(xs).astype(np.int64), 0, W)
        np.add.at(acc, (rows + start, xi), direction[cols])

    inside = (np.cumsum(acc[:, :W], axis=1) != 0).astype(np.float32)
    return inside.reshape(height, SS, width, SS).mean(axis=(1, 3))


def write_sheet(path, coverage, colour=WHITE):
    """Writes a coverage field out as a flat-coloured RGBA PNG.

    Blender's image buffers are scene-linear, and saving through an sRGB image
    applies the transform on the way out — so the colour goes in linear and
    comes back as the value asked for. Alpha is not colour-managed and goes in
    as it is.
    """
    height, width = coverage.shape
    img = bpy.data.images.new("sheet", width, height, alpha=True)
    img.colorspace_settings.name = "sRGB"
    rgb = [srgb_to_linear(c) for c in colour]
    px = np.empty((height, width, 4), dtype=np.float32)
    px[..., 0], px[..., 1], px[..., 2] = rgb
    px[..., 3] = coverage
    # Blender indexes image rows from the bottom; the raster runs top-down.
    img.pixels.foreach_set(px[::-1].ravel())
    img.file_format = "PNG"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(filepath=path)
    bpy.data.images.remove(img)
    print(f"  {os.path.relpath(path, ROOT)}  {width}x{height}  "
          f"{os.path.getsize(path) // 1024} KB")


def new_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ── DEC-01 · retail tenant signage ────────────────────────────────────────
#
# Sixteen fascia signs on one sheet, two columns of eight. Each cell is 4:1,
# which is the shape a shopfront fascia actually is — a square cell would
# spend three quarters of its pixels on air above and below the type.
#
# Every name is invented. See the module docstring.

SIGNAGE = (2048, 2048, 2, 8)

TENANTS = [
    ("MARENNE", CORMORANT, 1.9),
    ("CASA VELA", CORMORANT, 1.9),
    ("ATELIER SUD", CORMORANT, 1.7),
    ("OSSIA", CORMORANT, 2.2),
    ("BLEU HORIZON", CORMORANT, 1.6),
    ("PALMA", CORMORANT, 2.2),
    ("THE CONSERVATORY", CORMORANT, 1.4),
    ("MERIDIAN BOOKS", CORMORANT, 1.5),
    ("LUMEN", INTER, 1.9),
    ("SALT + STONE", INTER, 1.5),
    ("VERDANT", INTER, 1.7),
    ("NORD & CO", INTER, 1.7),
    ("HOUSE OF FEN", INTER, 1.5),
    ("KIN AND KIND", INTER, 1.5),
    ("SOLARIS", INTER, 1.8),
    ("AURELIA GALLERY", CORMORANT, 1.5),
]


def cell_box(sheet, index):
    """Centre and size of one atlas cell, in pixels."""
    width, height, cols, rows = sheet
    cw, ch = width / cols, height / rows
    col, row = index % cols, index // cols
    return (col + 0.5) * cw, (row + 0.5) * ch, cw, ch


def bake_signage():
    new_scene()
    shapes = []
    for i, (body, font, tracking) in enumerate(TENANTS):
        cx, cy, cw, ch = cell_box(SIGNAGE, i)
        # 78% of the cell width, 44% of its height: a fascia sign is set well
        # inside its band, and letters that touch the edge of their own cell
        # will touch the edge of the sign in the scene.
        shapes += fit(text_outline(body, font, tracking), cx, cy, cw * 0.78, ch * 0.44)
    write_sheet(os.path.join(OUT, "signage.png"), rasterise(shapes, SIGNAGE[0], SIGNAGE[1]))


# ── DEC-02 · wayfinding and level numbers ─────────────────────────────────
#
# Four columns of eight, cells 2:1. Numbers and words are type; the arrows,
# the lift and the stair are drawn, because a pictogram assembled out of
# glyphs is a pictogram that changes shape when the font does.

WAYFINDING_SHEET = (2048, 2048, 4, 5)


def arrow(cx, cy, size, angle):
    """A plain shafted arrow, pointing +X before rotation."""
    w = h = size
    pts = [
        (-w / 2, -h * 0.17), (w * 0.08, -h * 0.17), (w * 0.08, -h / 2),
        (w / 2, 0.0), (w * 0.08, h / 2), (w * 0.08, h * 0.17), (-w / 2, h * 0.17),
    ]
    ca, sa = math.cos(angle), math.sin(angle)
    return [[(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]]


def box(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def lift_glyph(cx, cy, s):
    """A car between two jambs, with the up and down triangles beside it."""
    return [
        box(cx - s * 0.42, cy - s * 0.5, cx - s * 0.34, cy + s * 0.5),
        box(cx + s * 0.34, cy - s * 0.5, cx + s * 0.42, cy + s * 0.5),
        box(cx - s * 0.42, cy + s * 0.42, cx + s * 0.42, cy + s * 0.5),
        box(cx - s * 0.42, cy - s * 0.5, cx + s * 0.42, cy - s * 0.42),
        [(cx - s * 0.17, cy - s * 0.03), (cx, cy - s * 0.28), (cx + s * 0.17, cy - s * 0.03)],
        [(cx - s * 0.17, cy + s * 0.03), (cx, cy + s * 0.28), (cx + s * 0.17, cy + s * 0.03)],
    ]


def stair_glyph(cx, cy, s):
    """Four risers in section — the profile, not a perspective of a stair."""
    steps = 4
    tread, rise = s * 0.9 / steps, s * 0.78 / steps
    pts = [(cx - s * 0.45, cy + s * 0.4)]
    for i in range(steps):
        x = cx - s * 0.45 + tread * i
        y = cy + s * 0.4 - rise * i
        pts += [(x, y - rise), (x + tread, y - rise)]
    pts += [(cx + s * 0.45, cy + s * 0.4)]
    return [pts]


WAYFINDING = [
    ("text", "01", INTER_MED, 1.0), ("text", "02", INTER_MED, 1.0),
    ("text", "03", INTER_MED, 1.0), ("text", "04", INTER_MED, 1.0),
    ("text", "05", INTER_MED, 1.0), ("arrow", 0.0, None, None),
    ("arrow", math.pi, None, None), ("arrow", -math.pi / 2, None, None),
    ("arrow", math.pi / 2, None, None), ("lift", None, None, None),
    ("stair", None, None, None), ("text", "WC", INTER_MED, 1.4),
    ("text", "EXIT", INTER_MED, 1.4), ("text", "RESIDENCES", INTER, 1.5),
    ("text", "BEACH", INTER, 1.5), ("text", "ATRIUM", INTER, 1.5),
    ("text", "FOOD HALL", INTER, 1.4), ("text", "CINEMA", INTER, 1.5),
    ("text", "CAR PARK", INTER, 1.4), ("text", "CONCIERGE", INTER, 1.4),
]


def bake_wayfinding():
    new_scene()
    _, _, cw, ch = cell_box(WAYFINDING_SHEET, 0)

    # Numerals and short codes are set large — each is a sign in itself. The
    # words share ONE cap height, because a wayfinding system with a different
    # type size per word is not a system. That height is whatever the longest
    # word can manage in its cell, found by measuring them all first: fitting
    # each to its own box instead left RESIDENCES half the size of BEACH.
    outlines = {}
    word_scale = None
    for kind, a, b, c in WAYFINDING:
        if kind != "text" or len(a) <= 4:
            continue
        outlines[a] = text_outline(a, b, c)
        x0, y0, x1, y1 = bounds(outlines[a])
        s = min(cw * 0.86 / (x1 - x0), ch * 0.24 / (y1 - y0))
        word_scale = s if word_scale is None else min(word_scale, s)

    shapes = []
    for i, (kind, a, b, c) in enumerate(WAYFINDING):
        cx, cy, cw, ch = cell_box(WAYFINDING_SHEET, i)
        if kind == "text":
            if len(a) <= 4:
                shapes += fit(text_outline(a, b, c), cx, cy, cw * 0.84, ch * 0.56)
            else:
                x0, y0, x1, y1 = bounds(outlines[a])
                shapes += fit(outlines[a], cx, cy,
                              (x1 - x0) * word_scale, (y1 - y0) * word_scale)
        elif kind == "arrow":
            shapes += arrow(cx, cy, ch * 0.62, a)
        elif kind == "lift":
            shapes += lift_glyph(cx, cy, ch * 0.66)
        elif kind == "stair":
            shapes += stair_glyph(cx, cy, ch * 0.66)
    write_sheet(os.path.join(OUT, "wayfinding.png"),
                rasterise(shapes, WAYFINDING_SHEET[0], WAYFINDING_SHEET[1]))


# ── DEC-04 · project identity ─────────────────────────────────────────────
#
# Two lockups on one 4:1 sheet: the wordmark alone, for the crown, and the
# wordmark over a rule with its descriptor, for the lobby wall.

IDENTITY_SHEET = (2048, 512, 1, 2)


def bake_identity():
    new_scene()
    width, height = IDENTITY_SHEET[0], IDENTITY_SHEET[1]
    shapes = []

    cx, cy, cw, ch = cell_box(IDENTITY_SHEET, 0)
    shapes += fit(text_outline("AURELIA", CORMORANT_MED, 2.6), cx, cy, cw * 0.86, ch * 0.62)

    # The lockup, with air in it. The first attempt set the rule six pixels
    # under the wordmark's serifs, which at any size a viewer sees is touching.
    cx, cy, cw, ch = cell_box(IDENTITY_SHEET, 1)
    shapes += fit(text_outline("AURELIA", CORMORANT_MED, 2.6),
                  cx, cy - ch * 0.26, cw * 0.62, ch * 0.30)
    shapes.append(box(cx - cw * 0.19, cy + ch * 0.058, cx + cw * 0.19, cy + ch * 0.068))
    shapes += fit(text_outline("OCEANFRONT RESIDENCES", INTER, 3.4),
                  cx, cy + ch * 0.285, cw * 0.42, ch * 0.070)

    write_sheet(os.path.join(OUT, "identity.png"), rasterise(shapes, width, height))


# ── DEC-02 / DEC-04 · the same lettering, as vector ───────────────────────

def svg_path(contour):
    return "M" + "L".join(f"{x:.4f},{-y:.4f}" for x, y in contour) + "Z"


def write_svg(path, cs, pad=0.05):
    """Contours as an SVG, filled by the same rule the rasteriser uses.

    `fill-rule="nonzero"` is not a stylistic choice: it is the rule TrueType
    outlines are defined by, and the default `evenodd` turns a self-intersecting
    glyph inside out. The paths are polylines rather than curves — they come
    off the Bezier sampling above at twelve points a segment, which is well
    inside a hairline at any size a sign is cut or printed at.
    """
    x0, y0, x1, y1 = bounds(cs)
    # SVG's Y runs down, so the vertical bounds invert with the coordinates.
    y0, y1 = -y1, -y0
    x0 -= pad
    y0 -= pad
    x1 += pad
    y1 += pad
    body = "\n".join(f'    <path d="{svg_path(c)}"/>' for c in cs)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{x0:.4f} {y0:.4f} {x1 - x0:.4f} {y1 - y0:.4f}" '
        f'width="{(x1 - x0) * 400:.0f}" height="{(y1 - y0) * 400:.0f}">\n'
        '  <g fill="currentColor" fill-rule="nonzero">\n'
        f"{body}\n"
        "  </g>\n"
        "</svg>\n"
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svg)
    print(f"  {os.path.relpath(path, ROOT)}  {len(cs)} contours  "
          f"{os.path.getsize(path) // 1024} KB")


def bake_vector():
    """The wordmark and the level numerals as vector.

    The PNGs above are what the renderer samples; these are what a sign
    fabricator or a print item takes. Both come off the same outlines, so
    they cannot drift apart.
    """
    new_scene()
    write_svg(os.path.join(OUT, "identity", "aurelia-wordmark.svg"),
              text_outline("AURELIA", CORMORANT_MED, 2.6))
    for n in ("01", "02", "03", "04", "05"):
        write_svg(os.path.join(OUT, "wayfinding", f"level-{n}.svg"),
                  text_outline(n, INTER_MED, 1.0))


# ── DEC-03 · artwork ──────────────────────────────────────────────────────
#
# Original abstract compositions, authored as node graphs and rendered flat.
# Not photographs of anything and not derived from any existing work, so not a
# licensing question at all — which is the whole reason to author them rather
# than source them.
#
# Rendered at 1024 rather than the schedule's 2K, deliberately. These hang at
# roughly 1.2 m across and the nearest camera stops 2.4 m away, so on a 1280 px
# viewport a canvas covers about 260 px. 1024 is already four times what the
# framing can resolve, and six 2K JPEGs would spend 2.5 MB of the streamed
# budget to be visible at no framing in the walkthrough.

def lin(hex_int):
    r = ((hex_int >> 16) & 255) / 255
    g = ((hex_int >> 8) & 255) / 255
    b = (hex_int & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def art_wash(g, stops, angle, scale, warp):
    """A colour field: a gradient along one axis, pushed about by noise.

    The rotation is about the middle of the canvas, not about its corner.
    Rotating a unit square about (0, 0) sends most of it negative, where every
    ramp clamps to its first stop — which is why the first bake of this came
    out as four flat rectangles of beige. Blender's Mapping node applies
    Location last, so the centre is subtracted going in and added coming out.
    """
    coord = g.new("ShaderNodeTexCoord")
    centred = g.new("ShaderNodeVectorMath", operation="SUBTRACT")
    g.link(coord, "UV", centred, 0)
    centred.inputs[1].default_value = (0.5, 0.5, 0.0)

    mapping = g.new("ShaderNodeMapping")
    g.link(centred, 0, mapping, "Vector")
    mapping.inputs["Rotation"].default_value = (0.0, 0.0, angle)
    mapping.inputs["Location"].default_value = (0.5, 0.5, 0.0)

    n = noise(g, scale, detail=6.0, rough=0.55)
    sep = g.new("ShaderNodeSeparateXYZ")
    g.link(mapping, 0, sep, 0)
    pushed = g.math("ADD", sep, g.math("MULTIPLY", n, warp, ai=1))
    return g.ramp(pushed, stops)


ARTWORKS = {
    "art-01": (1024, 1024, "horizon"),
    "art-02": (1024, 1024, "tide"),
    "art-03": (1024, 1024, "strata"),
    "art-04": (768, 1024, "column"),
    "art-05": (768, 1024, "bloom"),
    "art-06": (1280, 768, "shoreline"),
}


def band(g, count, angle, warp, softness=0.32):
    """A set of soft parallel bands — the gestural element in these pieces.

    A colour field on its own is a gradient, and a gradient is wallpaper.
    What makes an abstract read as a made object is a second order of marks
    laid across the field at a different rate and a different angle.
    """
    coord = g.new("ShaderNodeTexCoord")
    centred = g.new("ShaderNodeVectorMath", operation="SUBTRACT")
    g.link(coord, "UV", centred, 0)
    centred.inputs[1].default_value = (0.5, 0.5, 0.0)
    mapping = g.new("ShaderNodeMapping")
    g.link(centred, 0, mapping, "Vector")
    mapping.inputs["Rotation"].default_value = (0.0, 0.0, angle)
    mapping.inputs["Location"].default_value = (0.5, 0.5, 0.0)

    sep = g.new("ShaderNodeSeparateXYZ")
    g.link(mapping, 0, sep, 0)
    n = noise(g, 1.4, detail=5.0, rough=0.6)
    pushed = g.math("ADD", g.math("MULTIPLY", sep, float(count)),
                    g.math("MULTIPLY", n, warp * count))
    wave = g.math("SINE", g.math("MULTIPLY", pushed, math.tau))
    return g.ramp(wave, [(0.5 - softness, (0.0,) * 4), (0.5 + softness, (1.0,) * 4)])


def build_artwork(g, kind):
    if kind == "horizon":
        base = art_wash(g, [(0.0, lin(0xE8DFD1)), (0.42, lin(0xD9CBB4)),
                            (0.5, lin(0x8FA3A8)), (0.58, lin(0x4C6670)),
                            (1.0, lin(0x2E4551))], math.radians(90), 2.4, 0.10)
        veil = noise(g, 9.0, detail=10.0, rough=0.62)
        lit = g.mixrgb(g.math("MULTIPLY", veil, 0.16), base, lin(0xF2ECE1))
        # One high, thin line of light across the field: the horizon the
        # piece is named for, and the only hard edge in it.
        edge = band(g, 1.0, math.radians(90), 0.05, softness=0.06)
        return g.mixrgb(g.math("MULTIPLY", edge, 0.30), lit, lin(0xFBF6EA))
    if kind == "tide":
        base = art_wash(g, [(0.0, lin(0x203A42)), (0.35, lin(0x38636B)),
                            (0.7, lin(0x9FBDB8)), (1.0, lin(0xE6E2D4))],
                        math.radians(74), 1.6, 0.34)
        # Cell walls, kept thin. At the first setting these were fat white
        # ropes and the piece read as a diagram of foam rather than as foam.
        cells = voronoi(g, 19.0, feature="DISTANCE_TO_EDGE", randomness=0.95)
        edge = g.ramp(cells, [(0.0, (1, 1, 1, 1)), (0.014, (0, 0, 0, 1))])
        foamed = g.mixrgb(g.math("MULTIPLY", edge, 0.11), base, lin(0xF6F1E6))
        swell = band(g, 4.0, math.radians(74), 0.34, softness=0.34)
        return g.mixrgb(g.math("MULTIPLY", swell, 0.16), foamed, lin(0xBFD3CC))
    if kind == "strata":
        base = art_wash(g, [(0.0, lin(0xC8A882)), (0.22, lin(0xE3D4BC)),
                            (0.44, lin(0xA98F72)), (0.62, lin(0xEDE4D5)),
                            (0.82, lin(0x7C6B58)), (1.0, lin(0xD8C9B2))],
                        math.radians(6), 1.1, 0.22)
        beds = band(g, 7.0, math.radians(6), 0.16, softness=0.20)
        layered = g.mixrgb(g.math("MULTIPLY", beds, 0.34), base, lin(0x59493A))
        grain = noise(g, 26.0, detail=4.0, rough=0.4)
        return g.mixrgb(g.math("MULTIPLY", grain, 0.13), layered, lin(0x4A3F33))
    if kind == "column":
        base = art_wash(g, [(0.0, lin(0xF0E9DC)), (0.34, lin(0xE0C9A8)),
                            (0.62, lin(0xB9563A)), (1.0, lin(0x2C2A28))],
                        0.0, 1.3, 0.44)
        soft = noise(g, 3.2, detail=8.0, rough=0.6)
        washed = g.mixrgb(g.math("MULTIPLY", soft, 0.3), base, lin(0xE8DCC8))
        stripe = band(g, 2.0, 0.0, 0.22, softness=0.26)
        return g.mixrgb(g.math("MULTIPLY", stripe, 0.26), washed, lin(0xF6EEDF))
    if kind == "bloom":
        cells = voronoi(g, 3.2, feature="F1", randomness=1.0)
        base = g.ramp(cells, [(0.0, lin(0xEFE7D8)), (0.34, lin(0xCBB89A)),
                              (0.66, lin(0x6E8478)), (1.0, lin(0x2F3B38))])
        wash = art_wash(g, [(0.0, lin(0xF4EEE2)), (1.0, lin(0x39443F))],
                        math.radians(30), 1.0, 0.2)
        mixed = g.mixrgb(0.42, base, wash)
        # No cell outlines. Drawing them turned this into leaded glass — a
        # Voronoi's edges are the one part of it that always looks generated.
        grain = noise(g, 22.0, detail=9.0, rough=0.6)
        return g.mixrgb(g.math("MULTIPLY", grain, 0.15), mixed, lin(0xF3EDE0))
    # shoreline
    base = art_wash(g, [(0.0, lin(0xEFE6D4)), (0.3, lin(0xDCC9A6)),
                        (0.52, lin(0x7FA2A0)), (0.74, lin(0x365A66)),
                        (1.0, lin(0x16262F))], math.radians(94), 1.8, 0.16)
    swell = band(g, 5.0, math.radians(94), 0.30, softness=0.30)
    moved = g.mixrgb(g.math("MULTIPLY", swell, 0.22), base, lin(0x8FB0AE))
    foam = noise(g, 16.0, detail=12.0, rough=0.7)
    return g.mixrgb(g.math("MULTIPLY", foam, 0.2), moved, lin(0xFAF6EC))


def bake_artwork(only=None):
    for key, (w, h, kind) in ARTWORKS.items():
        if only and key not in only:
            continue
        new_scene()
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 8
        scene.cycles.use_denoising = False
        scene.render.resolution_x = w
        scene.render.resolution_y = h
        scene.view_settings.view_transform = "Standard"
        scene.render.image_settings.file_format = "JPEG"
        scene.render.image_settings.quality = 92

        bpy.ops.mesh.primitive_plane_add(size=2)
        plane = bpy.context.active_object
        plane.scale = (max(1.0, w / h), max(1.0, h / w), 1.0)

        mat = bpy.data.materials.new(key)
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        g = G(nt)
        out = g.new("ShaderNodeOutputMaterial")
        emit = g.new("ShaderNodeEmission")
        nt.links.new(O(build_artwork(g, kind)), emit.inputs["Color"])
        g.link(emit, "Emission", out, "Surface")
        plane.data.materials.append(mat)

        bpy.ops.object.camera_add(location=(0, 0, 4))
        cam = bpy.context.active_object
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = 2.0 * max(1.0, w / h)
        scene.camera = cam

        path = os.path.join(OUT, "artwork", f"{key}.jpg")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"  {os.path.relpath(path, ROOT)}  {w}x{h}  "
              f"{os.path.getsize(path) // 1024} KB")


# ── DEC-05 · surface imperfection masks ───────────────────────────────────
#
# Greyscale, tiling, and the only Tier 4 item that is not a decal at all:
# these multiply into the roughness of surfaces that already exist. White is
# untouched, black is fully affected.
#
# Baked on the same 4D torus the surface library uses, so they tile against
# the maps they are layered over.

def m_streaks(g):
    """Rain running down a facade — long vertical washes, thin and uneven.

    Fourteen to one across against down. The first version used the isotropic
    helper and produced a field of round cells, which is a crackle glaze, not
    weathering: a run is defined by being far longer than it is wide, and
    nothing else about it matters.
    """
    lanes = stretched_noise(g, 6.0, tile_u=2.6, tile_v=0.19, detail=9.0, rough=0.6)
    # Where a run happens at all — most of a wall is dry.
    where = stretched_noise(g, 1.6, tile_u=1.4, tile_v=0.5, detail=5.0, rough=0.5)
    gate = g.ramp(where, [(0.42, (0.0,) * 4), (0.72, (1.0,) * 4)])
    run = g.ramp(lanes, [(0.34, (1.0,) * 4), (0.62, (0.0,) * 4)])
    wet = g.math("MULTIPLY", run, gate)
    return g.ramp(wet, [
        (0.0, (1.0, 1.0, 1.0, 1)), (0.45, (0.86, 0.86, 0.86, 1)),
        (1.0, (0.46, 0.46, 0.46, 1))])


def m_staining(g):
    """Soft water staining — large, low-contrast, with no direction at all."""
    broad = noise(g, 1.5, detail=6.0, rough=0.68, distortion=0.6)
    fine = noise(g, 7.0, detail=8.0, rough=0.5)
    both = g.math("ADD", g.math("MULTIPLY", broad, 0.72), g.math("MULTIPLY", fine, 0.28))
    return g.ramp(both, [
        (0.30, (0.55, 0.55, 0.55, 1)), (0.52, (0.9, 0.9, 0.9, 1)),
        (0.78, (1.0, 1.0, 1.0, 1))])


def m_edgewear(g):
    """Abrasion — directional scratching, concentrated where a hand reaches.

    Scratches are drawn the same way the runs are, stretched hard along one
    axis, because that is what a scratch is. The isotropic version of this
    was a fine even speckle, which reads as dust on the lens rather than as
    wear on the surface.
    """
    scratch = stretched_voronoi(g, 26.0, tile_u=0.16, tile_v=3.2)
    lines = g.ramp(scratch, [(0.0, (1.0,) * 4), (0.035, (0.0,) * 4)])
    where = noise(g, 2.2, detail=5.0, rough=0.5)
    mask = g.ramp(where, [(0.40, (0.0,) * 4), (0.68, (1.0,) * 4)])
    worn = g.math("MULTIPLY", lines, mask)
    return g.ramp(worn, [(0.0, (1.0, 1.0, 1.0, 1)), (1.0, (0.52, 0.52, 0.52, 1))])


MASKS = {
    "streaks": (m_streaks, "rain runs on a vertical face"),
    "staining": (m_staining, "diffuse water staining"),
    "edgewear": (m_edgewear, "abrasion and fine scratching"),
}


def bake_masks(only=None):
    for name, (builder, note) in MASKS.items():
        if only and name not in only:
            continue
        new_scene()
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 1
        scene.cycles.use_denoising = False
        scene.render.bake.use_pass_direct = False
        scene.render.bake.use_pass_indirect = False
        scene.render.bake.use_pass_color = True
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"

        bpy.ops.mesh.primitive_plane_add(size=2)
        plane = bpy.context.active_object
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        g = G(nt)
        out = g.new("ShaderNodeOutputMaterial")
        bsdf = g.new("ShaderNodeBsdfPrincipled")
        g.link(bsdf, "BSDF", out, "Surface")
        nt.links.new(O(builder(g)), bsdf.inputs["Base Color"])
        plane.data.materials.append(mat)

        target = nt.nodes.new("ShaderNodeTexImage")
        nt.nodes.active = target
        img = bpy.data.images.new(name, 1024, 1024, alpha=False, float_buffer=True)
        # Non-colour: a mask is a number per texel, not a colour, and writing
        # it through an sRGB transform would bend every value it carries.
        img.colorspace_settings.name = "Non-Color"
        target.image = img
        bpy.ops.object.select_all(action="DESELECT")
        plane.select_set(True)
        bpy.context.view_layer.objects.active = plane
        bpy.ops.object.bake(type="DIFFUSE", margin=64)

        path = os.path.join(OUT, "imperfection", f"{name}.png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.file_format = "PNG"
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "BW"
        scene.render.image_settings.color_depth = "8"
        img.save_render(filepath=path)
        print(f"  {os.path.relpath(path, ROOT)}  1024px  "
              f"{os.path.getsize(path) // 1024} KB  ({note})")


# ── entry point ───────────────────────────────────────────────────────────

STEPS = {
    "signage": bake_signage,
    "wayfinding": bake_wayfinding,
    "identity": bake_identity,
    "vector": bake_vector,
    "artwork": bake_artwork,
    "masks": bake_masks,
}


def main():
    wanted = sys.argv[1:] or list(STEPS)
    unknown = [w for w in wanted if w not in STEPS]
    if unknown:
        raise SystemExit(f"unknown steps: {unknown}  (have: {', '.join(STEPS)})")
    os.makedirs(OUT, exist_ok=True)
    for name in wanted:
        print(f"{name}:")
        STEPS[name]()


if __name__ == "__main__":
    sys.exit(main())
