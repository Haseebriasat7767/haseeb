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

W, H = 1024, 512
VARIANTS = 2
# Supersampled, then reduced: a leaflet is a couple of pixels wide at the tip
# and aliases into dashes without it.
SS = 3


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

    count = 58
    for i in range(count):
        t = i / (count - 1)
        # A few gaps, as every real frond has.
        if rng.random() < 0.04:
            continue
        x = base_x + span * t
        # Leaflets are longest just past halfway and shortest at both ends.
        profile = math.sin(math.pi * (0.06 + 0.94 * t)) ** 0.62
        length = cell_h * 0.46 * profile * rng.uniform(0.86, 1.06)
        # Swept toward the tip: steep at the base, shallow at the end.
        sweep = math.radians(64 - 30 * t) * rng.uniform(0.94, 1.06)
        width = cell_h * 0.016 * rng.uniform(0.8, 1.15)
        # Greener in the middle of the frond, yellower at the tip.
        g = int(120 + 46 * profile - 18 * t + rng.uniform(-10, 10))
        colour = (int(46 + 26 * t), max(70, min(200, g)), int(44 + 10 * (1 - t)), 255)
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
