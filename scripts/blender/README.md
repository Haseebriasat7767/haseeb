# Offline rendering with Blender

Path-traced frames of the residence, rendered by Cycles on the CPU. This
exists because the site's own path tracer needs a GPU the build environment
does not have, and Cycles is designed to run well without one.

**Status: proven, incomplete.** A frame renders correctly end to end — real
global illumination, transmissive glazing, the generator's own practicals —
but the soft furniture is not exported yet, so rooms come out close to empty.
Nothing here is wired into the site, and no rendered output is committed.

## The rule this pipeline exists to keep

Nothing is modelled in Blender. The geometry is exported from
`createVillaLayout` and `createInteriorLayout` — the same functions the web
scene, the floor plans, the accommodation schedule, the panorama door graph
and the brochure figures all derive from. A building modelled by hand would
be a second source for those facts, free to drift from the first, which is
exactly what `tests/property-figures.test.ts` was written to catch.

Blender renders the building. It never becomes a second building.

## Running it

```sh
# 1. Export the scene (1246 boxes, 18 material groups, 11 lights)
SCENE_OUT=/tmp/villa.json npx vitest run --config scripts/blender/export.config.ts

# 2. Render one space
python3 scripts/blender/render-villa.py /tmp/villa.json living out.png [samples] [w] [h]
```

`bpy` is a pip package (`pip install bpy`, needs Python 3.11). No Blender
application install is required.

## Measured cost

On 4 CPU cores, adaptive sampling with OpenImageDenoise:

| Resolution | Samples | Scene                | Time  |
| ---------- | ------- | -------------------- | ----- |
| 1280×720   | 48      | the real villa       | 93 s  |
| 1920×1080  | 64      | a bare test interior | 213 s |

So budget roughly 5–6 minutes per 1080p frame of the villa. A walkthrough
still per space is ~31 frames across both buildings; a full cubemap set is
150 faces, and a cube face is square, so 1080p does not apply to one.

## What is missing

- **`forms` are not exported.** The generator keeps soft, turned and folded
  geometry — the sofas, chairs, cushions, plants, the rug — in a separate
  list from the box specs, because they are not prisms. That list is most of
  what a visitor sees in a room, and until it is exported a Cycles render is
  a well-lit empty shell. This is the next piece of work and every other
  path depends on it.
- **Materials are flat colours**, mapped per generator group. The web scene
  has considerably more variation.
- **No tower exporter.** The tower comes from a different generator
  (`lib/property/tower.ts`) with no room schedule.
