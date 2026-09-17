# Interior panorama pipeline

How the residence's interiors are rendered, delivered and displayed, and
which numbers in that chain are measured rather than assumed.

The exterior stays procedural and real-time. Inside the building the pixels
come from offline path-traced cubemaps instead — one per room, six faces
each — mapped to the inside of a sphere the camera sits at the centre of.
There is nothing to light and nothing to shade at runtime, so a room costs
one draw call.

## Format

**Cubemap primary, equirectangular fallback.**

At matched angular resolution (~11.4 px/degree, which is what a 1024² face
at 90° gives) an equirectangular image costs _more_, not less:

|                       | Pixels | VRAM, RGBA8 |
| --------------------- | ------ | ----------- |
| Cube, 6 × 1024²       | 6.29 M | 24 MiB      |
| Equirect, 4096 × 2048 | 8.39 M | 33.5 MiB    |

Equirect spends the difference over-sampling the poles, which in an interior
are ceiling and floor. The loader handles both (`panoLoader.ts`), and the
equirect path stays for any panorama that arrives as a single file.

**JPEG q90, not PNG.** PNG is lossless encoding on photographic content. At
1024² it cost 564 KiB per room against roughly a sixth of that for q90, for
no visible difference on a face read at 11 px/degree. See _Encoding_ below
for the one caveat.

## Resolution, cache limit, and the two budgets

VRAM and download are one decision seen from two ends, and neither number
means anything quoted alone.

| Face size | VRAM/room | Peak, limit 6, no mips | Peak, limit 6, with mips |
| --------- | --------- | ---------------------- | ------------------------ |
| 1024²     | 24 MiB    | 168 MiB                | **224 MiB**              |
| 1536²     | 54 MiB    | 378 MiB                | 504 MiB                  |
| 2048²     | 96 MiB    | 672 MiB                | 896 MiB                  |

**Mipmaps are on.** `CubeTexture` extends `Texture`, whose default
`minFilter` is `LinearMipmapLinearFilter`, so three builds the chain unless
it is explicitly disabled. A full chain adds 1/3. The deployed figure at the
chosen pair is therefore **224 MiB**, not 168 — and 224 MiB is also the
mobile budget the render job warns against, so the recommended pair sits
exactly on the line with no headroom. `peakMiB()` defaults `mips` to true
for this reason: the optimistic default is the one that gets called without
arguments.

**Peak is `limit + 1`, not `limit`.** The cache limit is an eviction policy
— `evict()` runs on load, so residency never exceeds it — but
`PanoTransition` holds the outgoing shell through the ~600 ms crossfade and
React still references its texture after the cache has let go. There is no
prefetch, in the loader or the transition, which is what keeps the figure at
`limit + 1` with no in-flight term.

**Chosen pair: 1024², limit 6.** Move up only with a residency measurement
on a real device. If the measured peak exceeds the budget, drop the limit,
not the resolution — a smaller limit costs a reload when a visitor
backtracks, a smaller face costs every visitor every frame.

**Byte budget, measured — and the saving is far smaller than expected.**
The same room rendered twice at 1024², 4 samples:

|          | Total     | px        | nz           |
| -------- | --------- | --------- | ------------ |
| PNG      | 564.2 KiB | 230.2 KiB | 13.5 KiB     |
| JPEG q90 | 461.2 KiB | 135.7 KiB | **13.8 KiB** |

**18%, not the ~83% the format change predicts.** The reason is the source:
a 4-sample path trace is mostly high-frequency noise, which is precisely
what JPEG cannot compress. Note `nz` — a near-black, nearly flat face —
where JPEG came out _larger_ than PNG.

So this number is a **lower bound distorted by unconverged input**, not the
production figure. A converged render is smooth gradients and soft
shadowing, which compresses the way the format change assumes. Re-measure
once TBD-2 fixes the sample count; do not quote 18% as the expected saving.

A single room is six requests, fetched on entry, cached by content hash
thereafter.

## Determinism

**Cube centre = `space.view.position`, exactly.** The hotspot bearings in
`lib/pano/hotspots.ts` are measured from that same record. Rendering from
any other point falsifies every door in that room — by an amount nothing in
the running site could detect, because the panorama would look perfectly
fine and the doors would simply be in the wrong places.
`CubeFaceCamera` reads the space record directly rather than taking a
position argument, so there is no second place to get it wrong.

**Face orientation is dir+up, not yaw/pitch.** A YXZ Euler gimbal-locks at
pitch ±π/2: yaw and roll collapse onto the same axis, so no yaw value
produces the correct roll for the pole faces. The table in
`lib/pano/cube-faces.ts` is copied from three's own `CubeCamera`, and
`tests/cubemap-faces.test.ts` demonstrates that the Euler derivation puts
both poles 180° out.

A face is 90° **and square**. Ninety degrees alone is not sufficient —
three's `CubeCamera` pairs it with `aspect = 1`, and a non-square render
target bakes a wrong projection into every face.

## Doorways

Openings are **retained from generation, never reconstructed**.
`partition()` knows exactly where it cut each gap; it now records a
`PlanOpening` for every `door()` and `portal()`, and its partition lines as
`PlanWall`. Recovering openings from the spaces between consecutive wall
boxes would be a derivation that moves whenever a tolerance does.

Adjacency asks the real question, in three cases:

- No shared boundary → not connected.
- A shared boundary with **no partition on it** → connected. This is the
  open plan, and it is the normal case for the principal rooms: they share
  no wall to put a door in, and requiring one would disconnect the living
  room from the dining room.
- A shared boundary with a partition → connected only if a retained opening
  falls inside the shared span.

Rooms with no `Space` (landing, upper hall, pantry) are corridors: routed
_through_, never stopped in. The master suite reaches the stair through the
landing, not by sharing a wall with it.

## Partial coverage

**`hasPanorama()` returning false is the designed normal, not an error.**
Renders run per room and take minutes each, so "some rooms, or none" is the
ordinary state of the output directory. A room without a render is not
offered: no hotspot points at it, and the Interior tab does not appear at
all until at least one room exists. A placeholder cubemap would put an
invented interior in front of a buyer, which is the failure the manifest
exists to prevent.

The manifest emitter **merges** rather than replaces. `render:panoramas
living` renders one room; emitting only that room's entry would delete the
other twelve from the site.

## Encoding: 4:4:4 is specified and not currently achieved

Faces are wanted at 4:4:4 chroma because a cube-face edge is exactly where
subsampling shows: 4:2:0 averages chroma over 2×2 blocks, and at a face
boundary the neighbouring face's pixels do not exist, so the edge chroma is
computed from padding. Two faces that should agree along a shared edge then
disagree, and the seam is visible as a colour shift.

**What the pipeline actually emits is 4:2:0.** Read from the JPEG's own
SOF0 marker, not assumed:

```
nx.jpg: components=3  luma sampling=2x2  -> 4:2:0
```

CDP `Page.captureScreenshot` exposes `quality` and nothing else; Chrome's
encoder picks the subsampling. There is no flag for it.

The options, none taken yet:

1. **Encode outside the browser** (`sharp`, which has an explicit
   `chromaSubsampling: '4:4:4'`). Correct, and a new native dependency for
   a pipeline that currently has none.
2. **Keep PNG for the faces.** Lossless, no subsampling at all — and on the
   measurement above it costs only 18% more, though that figure is
   noise-distorted and will widen once renders converge.
3. **Measure whether the seam is actually visible** at the final sample
   count and face size, and accept 4:2:0 if it is not.

Option 3 first. The seam mechanism is real, but its visibility at 1024² and
11 px/degree is an empirical question, and it cannot be answered against a
noise field — the noise swamps exactly the edge detail being judged. Settle
it on the first converged render; take option 1 only if the seam shows.

## A cautionary note: the manifest that 404s

Phase 3's emitter hashed the six faces in `latest/` and recorded
`basePath: /assets/pano/<id>/<hash>`. Nothing created that directory. The
manifest was syntactically perfect, typechecked, passed every unit test, and
every single face 404'd.

No unit test could have caught it, because the bug was the relationship
between a generated file and the filesystem. It is why the end-to-end gate
reads faces over HTTP from disk rather than asserting against a constructed
object, and why `emitManifest` now publishes the faces to the hashed path
itself instead of trusting something else to.

## Open questions

|                                | Status                          | Filled by                                                                  |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------------- |
| **TBD-1** GPU throughput       | Open                            | First GPU-provisioned run of `npm run calibrate:panoramas living`          |
| **TBD-2** Sample count         | Open — default 128, unvalidated | 128-vs-320 A/B on one room, judged on quality                              |
| **TBD-3** Setup vs convergence | Open                            | The same calibration run; the script isolates setup via a second page load |

## Why the tower is still rasterised

All twelve tower standpoints have been rendered with Cycles, and the set is
**not published**. The renderer bugs it exposed are fixed — no interior face
now has more than 0.1% black pixels, against a first attempt whose atrium
floor was 100% black — but on a side-by-side against the rasterised faces
production serves, Cycles loses on the things this building is sold on. Four
gaps, in the order they matter:

1. **No site.** `export-tower.ts` exports the building and nothing else, so
   every window in an oceanfront tower looks onto the sky texture's bare
   horizon. The rasterised `bedroom` face shows sea and lawn through the
   glazing; the traced one shows a white void. This is the blocking one.
2. **No procedural finishes.** The web materials carry marble veining the
   Blender materials have no equivalent for — flat pale stone where the
   raster has a figured floor.
3. **No signage.** `DecalPlanes` puts "VERDANT", "FOOD HALL" and "W C" on
   the podium; the traced atrium has bare walls where the raster reads as a
   retail street.
4. **Overexposure in the daylit podium.** Even with the boost off (see
   `render-villa.py` on why a scene with no practicals gets none), `spa`
   clips 48% of one face, `gym` 22.6%, `atrium` 18.8%. The residence, lit by
   practicals, does not do this.

Two of these are not renderer problems at all. `bedroom`'s forward face is a
blank wall in _both_ renderers, because `TOWER_VIEWS` entries are composed
framings authored to be looked at from one direction, not panoramic
standpoints — the same camera that makes a good plate makes a bad cubemap.

So the manifest keeps `quality: "raster"` for all twelve tower entries, and
`"traced"` for the thirteen residence rooms, which is what the per-entry
field is for. Closing gap 1 is the prerequisite for revisiting this.

The render budget is a formula, not a number:

```
T = 78 × (T_setup + S × T_sample)
```

**78, not 174.** Thirteen rooms × six faces. The earlier figure came from the
brochure plate manifest (17 residence + 12 tower), which is a different
artifact. Pinned in `tests/pano-spaces.test.ts`. Single-plate via
`EquirectCamera` would be 13 jobs, saving 65 setups — worth scoping only if
TBD-3 says setup dominates.

**Face cost is not uniform, and the budget needs a stated error.** Measured
on SwiftShader at 1024²/4 samples:

```
px 85.7s   nx 54.0s   py 58.1s   ny 49.4s   pz 73.0s   nz 48.0s
```

The spread is **1.74×** between `px` (toward the glazing) and `ny` (floor) —
physical in direction, though software rendering likely inflates the
magnitude. `calibrate-panoramas.mjs` therefore measures `pz` and `ny` and
reports both; a budget calibrated on one arbitrary face and multiplied by
six has no error bar.

**None of the SwiftShader timings are a bound on GPU performance.** They are
recorded for shape only. Likewise the Phase 2 figure of ~854 ms
"time to first frame" — that was software first-paint of a 256 px test cube,
and is not a download, a decode, or a bound on anything.
