# AURELIA — Phase 1 Foundation

A production-grade foundation for a cinematic luxury real-estate experience.
Phase 1 establishes the architecture, design system, and a working React Three
Fiber pipeline. The detailed procedural villa is intentionally **not** built yet.

## Requirements

- Node.js 20+
- npm 10+

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Development server                        |
| `npm run build`     | Production build                          |
| `npm run start`     | Serve the production build                |
| `npm run typecheck` | TypeScript, no emit                       |
| `npm run lint`      | ESLint (`lint:fix` to autofix)            |
| `npm run format`    | Prettier write (`format:check` to verify) |
| `npm run check`     | typecheck + lint + format check           |

## Architecture

```
app/            Routes, metadata, global styles, error boundaries
components/
  ui/           Design-system primitives (Button, Container, headings)
  navigation/   Header, mobile menu, footer, wordmark
  three/        Canvas, camera, lighting, terrain, loading, fallbacks
    villa/      Procedural residence: config, layout, and building parts
      openings/ Window, sliding-door, and entrance systems
  experience/   Bridge between UI and the 3D layer, landing preview
  property/     Editorial landing-page sections
  configurator/ Phase 2 placeholder
  effects/      Reveal-on-scroll, grain overlay
lib/
  three/        Scene config, materials, WebGL detection
  constants/    Site copy, navigation, motion tokens
  utils/        Small helpers
hooks/          Media queries, reduced motion, WebGL, quality tier
types/          Shared scene types
```

### The 3D layer

All three.js code is reachable only through
`components/experience/ExperienceViewport.tsx`. It detects WebGL, waits until
the region approaches the viewport, then dynamically imports the canvas chunk
(`ssr: false`). Nothing from `three` or `drei` enters the initial bundle.

Camera behaviour (`orbit` / `cinematic` / `fixed`), lighting, materials, and
quality tiers live in separate modules so pages never touch three.js directly.

### The procedural villa

The residence is generated entirely in code — no model, texture, or asset of
any kind is downloaded. `components/three/villa/VillaGeometry.ts` holds
`VILLA_CONFIG` (every dimension, in metres) and `createVillaLayout`, a pure
function that resolves it into the whole building. Each part component
(foundation, lower floor, upper floor, roof, terrace, glazing, columns,
stairs) only reads from that layout, so changing width, depth, floor heights,
cantilever, or terrace depth recomposes the architecture coherently.

### Openings and facade detailing

Windows are not planes laid on the walls. Each facade carries a _punched
skin_ — a thin layer over the structural mass with the openings left out of
it — so every opening is a real hole with real depth and its own shadow. The
frame lines that recess as a slim dark sleeve meeting the facade plane, and
the glass sits at the back of it. `openings/OpeningBuilder.ts` resolves a
schedule of walls and openings into that geometry; the three components in
`openings/` render fixed windows, sliding doors, and the entrance pivot door.

Repeated detail — skin panels, frames, mullions, fins, railings — is baked
into merged geometries, so a facade's worth of members costs one draw call.
The building is roughly 290 volumes and 3,600 triangles in about 48 draw
calls, and repeated detail thins out on the lower quality tiers.

To render the Phase 1 diagnostic massing instead, pass `content="placeholder"`
to `ExperienceViewport`, `ExperienceCanvas`, or `Scene`.

### The exterior site

`components/three/villa/site/` extends the villa onto its own site — pool,
deck, approach path, planters, and the retaining edges that ground them —
as a continuation of the terrace axis rather than a feature bolted on
beside the house. `SiteGeometry.ts` holds `SITE_CONFIG` and
`createSiteLayout`, a pure function exactly like the villa's own
`createVillaLayout`; it positions everything from `VillaLayout.plan` (the
villa's own plan lines — envelope, terrace edge, entrance stairs, living
axis), so nothing is placed by a guessed coordinate. Steps down from the
terrace lead onto a deck of large paving slabs framing the infinity pool;
the pool's far wall is a shorter weir with an overflow channel behind it,
so water reads as running to the edge instead of being held by a visible
parapet. A sunken lounge with its own broad stepped edge sits east of the
deck, and the existing entrance stairs continue as a stepping-stone
approach path. Repeated detail (paving, planters, retaining) is merged the
same way the facade is — a handful of draw calls regardless of how many
slabs or steps a given run contains.

### The procedural landscape

`components/three/villa/landscape/` plants the site: feature trees, shrubs,
ornamental grass, hedges, rocks, and planting on the Phase 2C planters —
every element generated from geometry, never a texture or a downloaded
model. `LandscapeGeometry.ts` holds `LANDSCAPE_CONFIG` and
`createLandscapeLayout`, the same pure-function pattern as the villa and
site; `LandscapeExterior.tsx` builds its `LandscapeContext` from
`VillaPlan` and the site's own resolved bounds (calling the same
`createSiteLayout` the site itself calls), so beds, poolside planting, and
the entrance trees line up with the real paving rather than a guessed
coordinate.

Two techniques do the actual generation. A **deformed icosahedron** —
`IcosahedronGeometry(radius, 0)` with each vertex nudged along its own
direction from centre by a hash of its own position — is the one primitive
behind canopy clusters, shrub blobs, and rocks; hashing by position rather
than drawing from a random stream keeps shared corners in sync, so
adjacent faces never crack apart. **Tapered cylinders oriented between two
points** (`Quaternion.setFromUnitVectors`, the standard three.js technique
for "a cylinder from A to B") build every trunk and branch. Grass blades
are a single low-poly cone each. Landscape generation never calls
`Math.random()` — one seeded PRNG (mulberry32, fixed seed) drives every
placement, so the same configuration always produces the same layout.

Every category — trunks, two foliage tones of canopy, two of shrub, all
grass, hedges, rocks, planter soil — is merged into exactly one mesh
regardless of how many trees, shrubs, or blades it contains: nine draw
calls for the whole landscape. Density and canopy/shrub cluster counts
thin out on the existing `low`/`medium`/`high` detail tiers — there is no
second quality system.

### Procedural material realism

`lib/three/materials.ts` upgrades every "natural" material — stone,
concrete, wood, bark, foliage, grass, soil, and the darker metals — with
subtle deterministic surface variation, entirely without a texture. A
shared `withVariation()` helper patches each material's shader via
`onBeforeCompile`, injecting a small value-noise function (built from a
handful of `sin`/`fract` operations, no texture fetch) that reads the
fragment's real world position and nudges albedo and roughness by a few
percent. Two offset noise samples are blended per material so the pattern
never tiles obviously, and an optional per-axis anisotropy compresses the
noise cells along one axis — stretched tall on `wood` and `bark` so it
reads as directional grain rather than blotchy stone-like patches. Every
material has its own fixed integer seed, so identical geometry at
different world positions never samples identically, and the same
material always compiles to the same shader — no `Math.random()`,
fully deterministic.

Because this costs a handful of ALU instructions per fragment and no
texture, render target, or extra draw call, it runs identically across
`low`/`medium`/`high` — the existing tier system keeps controlling the
parameters that actually cost GPU time (DPR, shadow map resolution,
antialiasing, geometry/cluster counts), rather than gaining a redundant
second tiering scheme for material complexity.

Per material:

- **Stone** — lightened and warmed toward honed limestone/travertine,
  coarse noise cells so it reads as large quarried slabs rather than
  aggregate. Used for the foundation, stairs, pool coping, retaining
  edges, planters, and landscape rocks.
- **Concrete** — a refined fair-faced tone, finer-grained noise for a
  subtle aggregate/formwork character up close that disappears into a
  flat premium surface from the hero camera.
- **Wood** — darkened and warmed, anisotropic noise compressed vertically
  so the entrance leaf reads as grain running its height.
- **Metals** — `darkMetal` lifted off pure black and pulled back from
  maximum metalness so it still catches the hemisphere fill in shadow
  instead of reading as a flat cutout; `frameMetal` and `bronze` tuned
  distinctly so structural trim, window framing, and hardware accents
  stay visually separate.
- **Glass** — deepened tint, slightly higher reflectivity and a crisper
  clearcoat response; still no transmission/refraction, unchanged from
  the Phase 2B/2C performance-conscious decision. Left free of the
  procedural-noise pass — glazing should read flawless and machined.
- **Pool water** — shifted toward a deeper turquoise, with a very
  low-amplitude noise pass reading as gentle depth variation across the
  surface. Still a single static plane — no reflection target, no
  simulation.
- **Landscape** — bark, both foliage tones, grass, and soil each carry
  their own seed and scale, so the many shrubs/blades merged into one
  mesh each read as individually varied rather than mathematically
  identical, purely from where they sit in world space.

No material assignment, geometry, layout, or dependency changed in this
pass — only material definitions in `lib/three/materials.ts`.

## External Asset Policy & Audit

| Asset / Resource                 | Status       |
| -------------------------------- | ------------ |
| **External 3D assets**           | **NONE — 0** |
| **External textures**            | **NONE — 0** |
| **HDRIs / environment maps**     | **NONE — 0** |
| **External asset URLs**          | **NONE — 0** |
| **3D model loaders**             | **NONE — 0** |
| **Texture loaders**              | **NONE — 0** |
| **Downloaded vegetation models** | **NONE — 0** |
| **New asset dependencies**       | **NONE — 0** |

> **AURELIA's 3D scene is 100% procedurally generated in TypeScript/Three.js.
> No externally created or downloaded 3D models, textures, HDRIs,
> environment maps, or asset URLs are used.**

Prohibited external model formats: `.glb`, `.gltf`, `.fbx`, `.obj`, `.blend`,
`.dae`, `.3ds`, `.abc`.

No Meshy, Sketchfab, Poly Haven, downloaded Blender models, downloaded
vegetation models, stock 3D assets, external model repositories, or
equivalent asset services are used.

No JPG, JPEG, PNG, WEBP, HDR, EXR, downloaded material textures, bark
textures, leaf textures, ground textures, normal maps, roughness maps,
displacement maps, or external texture URLs are used.

No HDRI files, downloaded environment maps, remote environment maps, or
external skybox assets are used.

Visual variation is generated procedurally through Three.js geometry, solid
material properties, deterministic vertex deformation, seeded placement,
primitive geometry, and scene lighting.

### Phase 2D Audit

```text
External 3D assets: 0
External textures: 0
HDRIs: 0
External asset URLs: 0
3D model loaders: 0
Texture loaders: 0
HDRI/environment loaders: 0
New asset dependencies: 0
Math.random() calls in landscape generation: 0
```

Phase 2D landscaping is entirely procedural and introduces no external asset
dependency.

The `TEXTURES` counter the performance overlay reports (currently `1`) is
`renderer.info.memory.textures` — a runtime GPU resource count Three.js
maintains internally (render targets and internal buffers included), not a
count of imported image files. It does not indicate an external texture
asset was loaded; the audit above, which covers external/downloaded texture
assets specifically, remains zero.

## Performance diagnostics

A development-only HUD reports real runtime behaviour — FPS, frame time,
renderer counters — instead of relying on static estimates. It lives in
`components/three/dev/`:

- `performance-types.ts` — the metric shapes and `PERFORMANCE_BUDGET`, the
  project's own engineering targets (not universal Three.js limits).
- `usePerformanceMetrics.ts` — samples every frame inside `useFrame`, purely
  into refs, so it never triggers a React re-render at 60 Hz. A rolling
  4-second window of frame times (average, P95, worst) and `renderer.info`
  counters are published to state at a fixed 4 Hz instead.
- `PerformanceMonitor.tsx` — the Canvas-side half; renders nothing, forwards
  the throttled snapshot to the DOM via a callback.
- `PerformanceOverlay.tsx` — the DOM-side HUD, styled with the existing
  design tokens. A "snapshot" button logs the full `PerformanceSnapshot`
  object to the console.
- `useDevOverlayEnabled.ts` — the gate. Returns `false` unconditionally when
  `NODE_ENV === 'production'`, regardless of the query string; otherwise
  reads `?debug=performance` from the URL.

`Scene` mounts `PerformanceMonitor` only when `diagnosticsEnabled` is passed
in, and `ExperienceCanvas` only passes it in when the gate returns `true`.
Everything lives inside the already lazy (`ssr: false`) three.js chunk, so a
production visitor loads none of this differently — the code is present but
inert, gated at both the environment and the query-string level.

### Enabling it

```
http://localhost:3000/experience?debug=performance
```

Development only (`npm run dev`). A production build (`npm run build && npm
run start`) never shows the overlay, even with the query string present.

### Manual test procedure

**Test 1 — Desktop**

1. Open `/experience?debug=performance` in development.
2. Wait for the loading screen to dismiss.
3. Let the scene warm up for at least 5 seconds.
4. Orbit around the villa.
5. Read FPS, P95 frame time, draw calls, and triangles off the HUD.

**Test 2 — Static camera**
Leave the camera untouched for ~5 seconds and read the HUD — this isolates
steady-state cost from input-driven re-renders.

**Test 3 — Active orbit**
Drag continuously for ~10 seconds and read the HUD again — this is the
worst-case interactive load.

**Test 4 — Mobile**
Repeat Tests 1–3 using Chrome DevTools device emulation or a real device.
Confirm the QUALITY row reads `LOW` or `MEDIUM` as appropriate and that the
scene stays usable.

### Budgets

These are AURELIA's own project targets, not general Three.js limits, and
are centralized in `PERFORMANCE_BUDGET` for easy retuning:

| Draw calls | Triangles |                      |
| ---------- | --------- | -------------------- |
| < 100      | < 50k     | Excellent            |
| 100–150    | 50k–100k  | Acceptable / Healthy |
| 150–250    | 100k–250k | Investigate          |
| > 250      | > 250k    | Review               |

|                        | Target    | Ideal        |
| ---------------------- | --------- | ------------ |
| Desktop FPS            | ≥ 55      | ≥ 60         |
| Desktop P95 frame time | ≤ 20 ms   | ≤ 16.7–18 ms |
| Mobile FPS             | ≥ 30      | 45–60        |
| Mobile P95 frame time  | ≤ 33.3 ms | —            |

These are runtime evaluation targets — a slow machine varying below them is
not a CI failure.

### Current baseline (Phase 2E)

Renderer counters, read directly from `renderer.info` on the default villa

- site + landscape view:

| Metric     | Phase 2B.5 | Phase 2C | Phase 2D | Phase 2E |
| ---------- | ---------- | -------- | -------- | -------- |
| Draw calls | 58         | 65       | 74       | 74       |
| Triangles  | 3,590      | 4,046    | 5,964    | 5,964    |
| Geometries | 21         | 27       | 36       | 36       |
| Textures   | 1          | 1        | 1        | 1        |

Phase 2E changed material definitions only — no geometry, mesh, or draw
call was added or removed, so every counter above is identical to Phase
2D. The procedural surface-variation shaders (see above) run inside the
existing materials' compiled programs, at no additional draw-call or
geometry cost.

Frame-time and FPS numbers were exercised in this sandbox using headless
Chromium with SwiftShader — a software GL rasterizer, not a GPU — so those
figures reflect the instrumentation working correctly, not real-world
performance. The measured Phase 2E frame time under SwiftShader was
modestly higher than Phase 2D's (roughly 5 FPS vs. 7 FPS in this sandbox):
the injected noise adds real per-fragment ALU work, and a CPU-based
rasterizer pays proportionally more for that than dedicated GPU shader
cores would. This is expected software-rasterizer overhead, not a claim
about real-hardware cost, which has not been measured:

```
Runtime FPS (real desktop GPU): not yet measured
Runtime FPS (real mobile device): not yet measured
```

Re-run the manual test procedure above on real hardware to establish the
first real baseline; the HUD and `PERFORMANCE_BUDGET` are what that baseline
gets compared against going forward.

## Design system

Tokens are defined once in `app/globals.css` under Tailwind v4's `@theme`:
palette, typographic scale, spacing, radii, shadows, easings, and breakpoints.
Cormorant Garamond carries editorial headings; Inter carries UI and body text.

## Deployment

Vercel-compatible with no extra configuration — push and import the repository.
