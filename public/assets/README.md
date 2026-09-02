# External assets

**This directory is empty by design.** Nothing here is required for the site
to run, and no file in it is fetched today.

## Why it exists

Phase 7G selected Route B — procedural geometry plus CC0 PBR texture maps
from ambientCG or Poly Haven. Neither could be fetched: this build
environment's egress proxy denies CONNECT to both.

```
ambientcg.com:443      403  connect_rejected (policy denial)
api.polyhaven.com:443  403  connect_rejected (policy denial)
```

Rather than keep retrying blocked hosts, the material pipeline was built to
accept real maps and is currently fed by maps generated at runtime in a
canvas (`components/three/textures/SurfaceMaps.ts`). Those are honest
stand-ins, not scans, and the README's asset audit says so.

## What to drop in

Eight families, each needing three maps. Filenames are what the loader will
look for; resolution 1K is enough for every one of them at the distances
these surfaces are seen from, except marble and oak where 2K is worth it.

| Family    | Files                                                        | Suggested source (CC0)      | Res |
| --------- | ------------------------------------------------------------ | --------------------------- | --- |
| `plaster` | `plaster_color.jpg` `plaster_rough.jpg` `plaster_normal.jpg` | ambientCG `Plaster###`      | 1K  |
| `stone`   | `stone_color.jpg` `stone_rough.jpg` `stone_normal.jpg`       | ambientCG `Travertine###`   | 1K  |
| `oak`     | `oak_color.jpg` `oak_rough.jpg` `oak_normal.jpg`             | ambientCG `WoodFloor###`    | 2K  |
| `marble`  | `marble_color.jpg` `marble_rough.jpg` `marble_normal.jpg`    | ambientCG `Marble###`       | 2K  |
| `linen`   | `linen_color.jpg` `linen_rough.jpg` `linen_normal.jpg`       | ambientCG `Fabric###`       | 1K  |
| `wool`    | `wool_color.jpg` `wool_rough.jpg` `wool_normal.jpg`          | ambientCG `Carpet###`       | 1K  |
| `leather` | `leather_color.jpg` `leather_rough.jpg` `leather_normal.jpg` | ambientCG `Leather###`      | 1K  |
| `paving`  | `paving_color.jpg` `paving_rough.jpg` `paving_normal.jpg`    | ambientCG `PavingStones###` | 1K  |

Put them in `public/assets/textures/`.

## Licensing

Only clearly CC0 or public-domain sources. ambientCG and Poly Haven both
publish everything CC0, which permits commercial use and redistribution
without attribution — attribution is still recorded in the project README's
asset audit, because a reader deserves to know which pixels were authored
elsewhere.

**Do not** add anything whose licence is unclear, and record every file that
does land here in the README audit table: filename, source, licence,
resolution, purpose.

## Wiring them up

`SurfaceMaps.ts` exposes `getSurfaceMaps(family)` returning
`{ map, roughnessMap, normalMap, metres, normalScale }`. Replace the `bake()`
call with a `TextureLoader` reading the files above and return the same
shape. Everything downstream is already correct and tuned: metre-scale UV
tiling, per-family repeat, colour space, mipmaps, anisotropy, restrained
normal strengths, and the low-tier gate that keeps maps off geometry whose
UVs are not in metres.
