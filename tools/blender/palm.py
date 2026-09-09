"""
Bakes the palm frond sheet — `public/assets/foliage/palm.png`.

## Why this exists

The palms were drawn with one flat box per frond. The comment in `Palms.tsx`
admitted the problem and picked the wrong fix: a frond at true width "reads
as a dark stick", so the blade was made wider to stand in for the leaflets
that were not being drawn. A wide flat blade does not read as a leaf, it
reads as a plank, and a dozen planks radiating from a point read as a star.
From the arrival camera the beach was a field of them.

A palm frond is a comb: a rachis with a hundred or so leaflets and as much
air as leaf. That is a silhouette problem, and silhouette with holes in it
is what an alpha-cut texture is for — the same trick the broadleaf canopies
already use, which is why they read and the palms did not.

## Why PIL rather than Blender

Everything else in this directory is Blender because it is geometry or a
node graph. This is neither: it is a flat shape with an alpha channel, and
drawing polygons into a raster is the whole job. Rendering it through Cycles
would mean lighting a plane to get a picture of an outline.

Two variants, stacked, so no two fronds on a tree are identical.
"""

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "assets", "foliage", "palm.png")

# 1024 x 512 PER FROND, not per sheet.
#
# The first bake gave each frond a 1024x256 cell, which put a leaflet at four
# pixels wide. Four pixels does not survive a mip chain: by the second level
# the leaflets are grey mush, and an alpha test then cuts that into a dashed
# line. The palms in the park read as strings of dots hanging off a stick.
# Each frond gets a 2048 x 512 cell — four to one, which is the proportion a
# coconut frond actually is. The first bake used two to one and produced a
# feather; the second had the right leaflets in the wrong envelope.
W, H = 2048, 1024
VARIANTS = 2
# Supersampled, then reduced: a leaflet is a couple of pixels wide at the tip
# and aliases into dashes without it.
SS = 2


def leaflet(draw, x0, y0, angle, length, width, colour):
    """One leaflet: a long tapered blade, slightly curved toward the tip."""
    pts_a, pts_b = [], []
    steps = 6
    for k in range(steps + 1):
        t = k / steps
        # Droop: the outer half of a leaflet bends away from the rachis.
        a = angle + t * t * 0.32 * (1 if angle > 0 else -1)
        r = length * t
        cx = x0 + math.cos(a) * r
        cy = y0 + math.sin(a) * r
        # Width peaks early and tapers to a point.
        hw = width * math.sin(math.pi * min(1.0, t * 0.86 + 0.07)) ** 0.7 * (1 - t * 0.55)
        nx, ny = -math.sin(a), math.cos(a)
        pts_a.append((cx + nx * hw, cy + ny * hw))
        pts_b.append((cx - nx * hw, cy - ny * hw))
    draw.polygon(pts_a + list(reversed(pts_b)), fill=colour)


def frond(draw, ox, oy, cell_w, cell_h, seed):
    rng = random.Random(seed)
    base_x = ox + cell_w * 0.035
    tip_x = ox + cell_w * 0.985
    mid_y = oy + cell_h / 2
    span = tip_x - base_x

    count = 74
    for i in range(count):
        t = i / (count - 1)
        # A few gaps, as every real frond has.
        if rng.random() < 0.035:
            continue
        x = base_x + span * t
        # A coconut frond is not a lens. Its leaflets reach full length within
        # the first fifth and hold it across most of the leaf, dropping away
        # only near the tip — which is why the silhouette is a long blade and
        # not the pointed oval the first bake produced.
        profile = min(1.0, (t / 0.18) ** 0.7) * (1.0 - max(0.0, (t - 0.72) / 0.28) ** 1.6)
        profile = max(0.06, profile)
        length = cell_h * 0.44 * profile * rng.uniform(0.88, 1.05)
        # Swept toward the tip: steep at the base, shallow at the end.
        sweep = math.radians(72 - 34 * t) * rng.uniform(0.95, 1.05)
        width = cell_h * 0.019 * rng.uniform(0.85, 1.12)
        # Greener in the middle of the frond, yellower at the tip.
        # Tone varies leaflet to leaflet. A frond in one flat green is the
        # other half of why these read as cut paper.
        shade = rng.uniform(0.78, 1.18)
        g = int((132 + 34 * profile - 22 * t) * shade)
        colour = (
            int((44 + 30 * t) * shade),
            max(64, min(205, g)),
            int((40 + 14 * (1 - t)) * shade),
            255,
        )
        for side in (-1, 1):
            leaflet(draw, x, mid_y, side * sweep, length, width, colour)

    # The rachis, over the leaflet roots so it reads as one leaf.
    rachis = []
    steps = 24
    for k in range(steps + 1):
        t = k / steps
        x = base_x + span * t
        hw = cell_h * 0.020 * (1 - t) ** 0.8 + 0.6
        rachis.append((x, mid_y - hw))
    for k in range(steps, -1, -1):
        t = k / steps
        x = base_x + span * t
        hw = cell_h * 0.020 * (1 - t) ** 0.8 + 0.6
        rachis.append((x, mid_y + hw))
    draw.polygon(rachis, fill=(58, 92, 48, 255))


def main():
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cell_h = H * SS // VARIANTS
    for v in range(VARIANTS):
        frond(draw, 0, v * cell_h, W * SS, cell_h, seed=1700 + v * 37)

    img = img.resize((W, H), Image.LANCZOS)
    # A touch of blur on the alpha only, so the cutout edge is not a staircase
    # at the grazing angles a beach full of these is seen at.
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(0.6))
    img = Image.merge("RGBA", (r, g, b, a))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    opaque = sum(1 for p in img.getdata() if p[3] > 24)
    print(f"  palm.png  {W}x{H}  {opaque * 100 // (W * H)}% covered  "
          f"{os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
