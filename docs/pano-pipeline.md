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

**Byte budget.** Measured at 1024², 4 samples: PNG 564 KiB/room → 16.0 MiB
for 29 rooms. JPEG q90: see the commit that made the switch for the measured
delta. A single room is six requests, fetched on entry, cached by content
hash thereafter.

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

## Encoding caveat

The brief calls for 4:4:4 chroma so cube-face seams do not show. Faces are
captured through CDP `Page.captureScreenshot`, which exposes `quality` but
**not** chroma subsampling — Chrome's encoder chooses. Whether the output is
4:4:4 or 4:2:0 is recorded in the commit that made the switch, read from the
JPEG's own SOF0 sampling factors rather than assumed. Forcing 4:4:4 would
mean encoding outside the browser, which means a new dependency; that is a
decision to take on evidence, not pre-emptively.

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
