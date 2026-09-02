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
cantilever, or terrace depth recomposes the architecture coherently — inside
and out, since the interiors below are generated from the same layout.

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

### Procedural interiors

The residence is a complete house, not a facade: the ground and upper
volumes are built as _enclosures_ rather than solid blocks, and every room
inside them is generated from the villa's own plan lines.

`SpecBuilders.punchedWall()` builds a wall as the solid remainder around its
voids — a pier between each pair of openings, a sill below and a head above
every one. `shell()` wraps that into a four-sided enclosure whose outer
faces land exactly where the Phase 2A massing put them, so the elevations
are unchanged while the space inside becomes real. The same opening
schedule is now punched twice: once through the cladding by the facade
builder, and once through the structure, so a window is a hole in the
building and not only in its skin.

`components/three/villa/interior/` holds the interior in the same
config → pure layout → merged geometry shape as the villa, the site, and
the landscape:

- **`InteriorPlan.ts`** — `createInteriorPlan()`, the room schedule. It
  returns twenty-one rooms across both storeys (foyer, living, dining,
  kitchen, pantry, utility, stair hall, guest suite and bathroom, study,
  media room; master bedroom, bathroom and dressing room, upper landing,
  two further bedrooms and a bathroom, upper hall, upper lounge, library),
  the partitions dividing them, which shell faces are omitted or pierced by
  doors, and where the upper slab is voided for the stair. It is pure and
  is called **twice** — once by `createVillaLayout` to hollow its masses,
  once by `createInteriorLayout` to furnish the result — so the structure
  and the rooms can never disagree.
- **`Furniture.ts`** — reusable procedural builders: `createSofa`,
  `createArmchair`, `createDiningSet`, `createBed`, `createNightstand`,
  `createBuiltIn`, `createShelving`, `createCounterRun`, `createIsland`,
  `createVanity`, `createBathtub`, `createShower`, `createWC`,
  `createDesk`, `createConsole`, `createMediaUnit`, `createFireplace`,
  `createNiche`, `createRug`, `createPendant`, `createFloorLamp`,
  `createCove`, and `createBalustrade`. Each is written once in the piece's
  own frame — across its width, up from its floor, back from its front —
  and mapped onto world axes by a `facing`, so a sofa is authored the same
  way whether it ends up against the north wall or the east one.
- **`InteriorGeometry.ts`** — `INTERIOR_CONFIG` and `createInteriorLayout()`,
  the pure counterpart of `createVillaLayout()`, `createSiteLayout()`, and
  `createLandscapeLayout()`. It resolves floor and ceiling finishes, the
  dog-leg stair connecting the two storeys, the balustrades guarding every
  edge that stair opens up, the foyer laylight, and the furniture in each
  room. There is no randomness of any kind — the same villa always
  furnishes identically.

Two pieces of architecture fall out of connecting the interior to the
structure rather than drawing it to fit. The stair is sized from the storey
height, not the room: two equal flights either side of a half-landing, with
the slab above voided over exactly the length that needs headroom — which is
why `slab-link` is now built in two pieces. And the two-storey entrance slot
had no floor plate above it, so the foyer is roofed at parapet level in a
glazed laylight and becomes the daylit heart of the plan.

Furniture is sorted by **material** rather than by room, and each bucket
becomes exactly one merged mesh, so a fully furnished two-storey house costs
about a dozen draw calls. The enclosure walls merge the same way. Materials
are additions to the single existing cache in `lib/three/materials.ts` —
`plaster`, `interiorStone`, `joinery`, `marble`, `upholstery`,
`upholsteryDark`, `rug`, `ceramic`, and an emissive `lightGlow` — resolved
through the same `getMaterials()` and released by the same
`disposeMaterials()`. There is no second material cache and no second
quality-tier system.

The quality tier scales only what is safe to scale. Floors, ceilings,
partitions, built-ins, and the stair are identical at every tier, because a
room with no walls is not a cheaper room. What thins out is decorative
accessories, seating density, shelf counts, and the number of soft interior
fill lights — seven on `high`, three on `medium`, and none on `low`, where
the emissive fixtures carry the read on their own. Those fills are plain
shadowless point lights placed by the layout; cinematic lighting, exposure,
and any post-processing remain out of scope here.

`lib/three/scene-config.ts` gains `INTERIOR_VIEWS` — foyer, living room,
kitchen, stair hall, master suite, and library. They are ordinary
`CameraView` objects feeding the existing `CameraController`; no second
camera or navigation system was added. Because they sit inside the
building they are intended for the `fixed` camera mode rather than the
orbit rig, whose minimum distance deliberately keeps the exterior model in
frame, and they are kept out of `CAMERA_VIEWS` so the public explore page
still lists approaches to the house rather than rooms within it.

### Cinematic lighting and atmosphere

Every lighting decision in the project lives in `lib/three/lighting.ts`.
Nothing is scattered across components: the module owns the sun, the sky,
the bounce, the fog, the exposure, which practical fixtures are switched on,
and how the shared materials respond — and `resolveLighting(hour, tier)` is
the one pure function that turns an hour and a rendering tier into the rig
the renderer mounts.

The sun is authored as **elevation and azimuth**, not as a position vector.
"A thirteen-degree key raking across the front elevation" is an
architectural decision; `[26, 34, 18]` is not. It also lets the shadow
frustum be sized from the elevation, which matters — a nine-metre building
under a thirteen-degree sun throws a forty-metre shadow, and a frustum tuned
for midday clips it off mid-terrace.

Five states compose the day. They are not samples along a continuous sun
curve: each is a photograph, which is why colour temperature, contrast,
exposure, and which fixtures are lit all move together.

| State           | What it is for                                                                        |
| --------------- | ------------------------------------------------------------------------------------- |
| **Morning**     | Soft warm key at 22°, cool sky, restrained contrast — the house waking up.            |
| **Day**         | The neutral reference. Clean 47° sun, readable façade, honest material colour.        |
| **Golden hour** | **The hero.** 13° key, long shadows, warm stone, interiors just coming up.            |
| **Blue hour**   | Cool exterior against warm windows — the strongest warm/cool contrast of the day.     |
| **Night**       | Dark but not crushed. Warm rooms, lit entrance, a pool that glows rather than shines. |

`DEFAULT_TIME_OF_DAY` is golden hour, and `Scene`, `ExperienceCanvas`, and
`ExperienceViewport` all take an optional `timeOfDay` prop, so the hour is
presentation state rather than something the scene decides for itself. There
is no animated transition and no lighting choreography — that is Phase 4's
job, and a tween nothing can currently trigger would be dead code.

**Three lights, whatever the hour.** The rig is one key sun, one sky/ground
hemisphere, and one shadowless directional standing in for light returned
off the paving and the plinth, aimed relative to the sun so it always fills
the shaded side. Everything else that changes between morning and night is
colour, angle, exposure, and which _practical_ fixtures elsewhere in the
scene are switched on.

**Exterior architectural lighting** gets the same treatment as every other
system: `components/three/villa/lighting/LightingGeometry.ts` is a pure
function of the villa's plan lines and the site's resolved bounds. Every
fixture exists because a piece of architecture needs it — a slot recessed
into the entrance canopy soffit, a wash under the cantilever where it hangs
over the terrace, in-ground grazers raking the two stone wings, niches under
the pool coping on the three sides water does not run over, a cove in the
sunken lounge, markers flanking the approach slabs, and a few discreet
uplights in the poolside planting. They are _geometry_ — two merged meshes,
a dark housing and an emissive face — and they carry most of the read on
their own.

Only three real dynamic exterior lights exist, and they are ranked: an
entrance spot, a submerged pool light, and a lounge fill. How far down that
list the renderer gets is the product of the hour and the tier — none in
daylight, where they would be invisible anyway.

**Interior practicals** were already positioned by the Phase 2F room plan.
Phase 3 took the _policy_ out of the geometry: `createInteriorLayout` now
emits all seven ranked by how much a room needs to read as inhabited, with
relative weights only, and the lighting state supplies the absolute candela
and decides how many are mounted. Two in daylight so the glazing never reads
as black rectangles, five at golden hour, all seven after dark.

**Glazing, pool, and fixture faces** are the three material families that
belong to the hour rather than to themselves, and `applyLightingToMaterials`
is the single place that says so. Glazing opacity drops after dark so lit
rooms read through the glass; the fixture emissive comes up; and the pool is
lit through the **water body** rather than the basin walls — an early
version glowed at the basin, which outlined the pool in cyan and looked like
a nightclub. It now reads as a soft luminous plane.

**Reflections and post-processing: neither was added.** There is still no
environment map, no render target, no cube camera, and no composer, and no
dependency was added. The pool was fixed the way §17 asks — by material
response, not by a reflection system: near-zero roughness returns black
without an environment to reflect, so the water was given enough scatter to
pick up the hemisphere sky. Exposure and tone are handled inside the ACES
pipeline the Canvas already had, per state, owned by `SceneEnvironment` so
the renderer and the hour cannot disagree. A bloom or vignette pass would
have cost a full-screen render target for an effect the emissive fixtures
already deliver.

**Tiers** reuse the existing `QualityTier` — the villa, site, landscape, and
interior all carry a tier map of their own, and the lighting system now has
one too. Only the genuinely expensive things scale: the number of dynamic
lights, and the shadow frustum. Colour, exposure, fog, and every emissive
fixture are free and identical everywhere, so a phone still gets the same
photograph with fewer lights carrying it. The high tier's shadow map moved
from 2048 to 4096 — not on principle, but because the wide frustum a low sun
needs visibly stair-stepped the parapet edges from the aerial view at 2048,
and an A/B at high tier showed the increase actually fixing it.

### The experience layer

Phase 4 turns the model into a site. Everything below is driven by one
record type — `lib/experience/spaces.ts`. A space carries its copy, its
camera framing, the room in the generated plan it corresponds to, and where
its marker sits on the model. Adding a space adds it to the scroll journey,
the explorer rail, the 3D hotspots, the floor plans, and the gallery at
once, which is why none of those components carries a list of its own.

**The scroll journey** (`components/journey/`) pins one canvas for eight
chapters and scrolls the copy over it. Whichever chapter owns the middle of
the viewport supplies the camera framing, and the camera's `journey` mode
eases position, target, _and_ focal length toward it so a change of chapter
reads as one camera move rather than a cut. The chapters are real in-flow
markup, not text painted onto the stage, so the narrative survives both a
search engine and a failure of the 3D layer.

**The explorer** (`/experience`) is the same canvas with a space rail, the
markers, a details panel, and the hour control. Selecting a space moves the
camera; nothing navigates and the scene is never torn down.

**The plans** (`/floor-plan`) are generated, not drawn.
`lib/experience/floorplan.ts` projects the _same_ room schedule that
generates the 3D model into SVG — change a partition in `InteriorPlan.ts`
and the drawing changes with it. Room areas are computed from those
outlines. This is the residence seen from above, not an illustration of it.

**The gallery** (`/gallery`) has no photography, because there is no
photograph to take. Each entry opens a full-screen frame rendered live at
the framing its caption names, under whichever of the five hours is
selected. Keyboard: arrows to move, Escape to close, focus held inside
while open.

**Camera.** `CameraController` gained the `journey` mode, a small
pointer-driven parallax (fine pointers only, off under reduced motion), and
aspect-aware framing: three's field of view is vertical, so a portrait phone
would crop a composed elevation down its sides. Every framing is authored
once against a 16:9 reference and widened automatically on narrower
viewports, which is why no view needs a second set of numbers for mobile.

### What Phase 4 does not do

The contact form has real validation, error, loading, and success states,
but this repository has **no backend**. Rather than fake a submission, an
unconfigured build composes the enquiry and hands it to the visitor's mail
client, and says so on screen. Set `NEXT_PUBLIC_ENQUIRY_ENDPOINT` (see
`.env.example`) and the same form posts JSON to it with no other change —
that variable is a public form-action URL, not a credential, and no secret
of any kind is read anywhere in the client.

Property areas, elevations, and grounds are demonstration figures for a
fictional residence. Counts that can be derived — levels, rooms, bedrooms,
bathrooms — are read from the generated room schedule and marked as such in
the specification table, so nothing invented is presented as surveyed fact.

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

### Phase 2F Audit

```text
External 3D assets: 0
External textures: 0
HDRIs: 0
External asset URLs: 0
3D model loaders: 0
Texture loaders: 0
HDRI/environment loaders: 0
New asset dependencies: 0
Image planes used as furniture: 0
Math.random() calls in interior generation: 0
```

Every room, every fitting, and every piece of furniture in Phase 2F is
built from Three.js box and cylinder primitives resolved by pure functions.
No furniture model, fabric texture, timber texture, marble texture, or
interior HDRI is loaded, and `package.json` is unchanged. The only
`Math.random` occurrences anywhere in the repository are the two prose
mentions in these documentation comments stating that it is not used.

### Phase 3 Audit

```text
External 3D assets: 0
External textures: 0
HDRIs: 0
External environment maps: 0
Image-based lighting assets: 0
3D model loaders: 0
Texture loaders: 0
External asset URLs: 0
Reflection render targets / cube cameras: 0
Post-processing passes: 0
New dependencies: 0
Math.random() calls in lighting: 0
```

Phase 3 is lighting, colour, and atmosphere only. Every light is a Three.js
light constructed in code, every fixture is procedural geometry, and every
material response is a property set on the existing shared materials. No
HDRI or environment map is fetched — which is also why the metals stay
pulled back from maximum metalness, since with nothing to reflect they would
render as flat black. `package.json` is unchanged.

### Phase 4 Audit

```text
External 3D assets: 0
External textures: 0
Stock photography: 0
HDRIs / environment maps: 0
Model or texture loaders: 0
External asset URLs: 0
New dependencies: 0
Secrets or API keys in the client: 0
```

Phase 4 added no dependency and no asset. The gallery contains no image
files because it renders the model instead; the floor plans are SVG
generated at runtime from the room schedule; the loading screen, cursor,
and markers are all DOM and CSS. `package.json` is unchanged.

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

### Current baseline (Phase 3)

Renderer counters, read directly from `renderer.info` on the default villa

- site + landscape view, at the `high` tier and the default golden hour:

| Metric     | Phase 2C | Phase 2D | Phase 2E | Phase 2F | Phase 3 |
| ---------- | -------- | -------- | -------- | -------- | ------- |
| Draw calls | 65       | 74       | 74       | 93       | 95      |
| Triangles  | 4,046    | 5,964    | 5,964    | 15,320   | 17,144  |
| Geometries | 36       | 36       | 36       | 57       | 59      |
| Textures   | 1        | 1        | 1        | 1        | 1       |

Phase 3 added the entire exterior lighting scheme for **two draw calls** —
one merged mesh of dark housings, one of emissive faces — and about 1,800
triangles. Both counters stay well inside the "Excellent" band. The counters
do not move with the time of day, because the fixtures are the same geometry
at every hour; what changes is how many dynamic lights are mounted, which
costs shader time rather than draw calls:

| Hour        | Environment | Interior practicals | Exterior | Total (high) |
| ----------- | ----------- | ------------------- | -------- | ------------ |
| Day         | 3           | 2                   | 0        | 5            |
| Morning     | 3           | 3                   | 0        | 6            |
| Golden hour | 3           | 5                   | 1        | 9            |
| Blue hour   | 3           | 7                   | 3        | 13           |
| Night       | 3           | 7                   | 3        | 13           |

The `medium` tier caps that at three interior and one exterior, and `low`
mounts no practicals at all — the emissive fixtures carry the read. The
default presentation state is therefore also one of the cheaper ones.

The high tier's shadow map moved from 2048 to 4096, which costs GPU memory
rather than frame time and applies to no other tier.

### Route weights (Phase 4)

Three.js is never in a page bundle. Every route loads the renderer only
through `ExperienceViewport`'s dynamic import, and only once the canvas
approaches the viewport:

| Route         | Page JS | First load |
| ------------- | ------- | ---------- |
| `/`           | 3.98 kB | 114 kB     |
| `/experience` | 4.8 kB  | 115 kB     |
| `/gallery`    | 4.21 kB | 111 kB     |
| `/floor-plan` | 10 kB   | 116 kB     |
| `/contact`    | 3.47 kB | 110 kB     |

Two leaks were found and closed while building this. Passing the hotspots
in as rendered nodes pulled all of three into `/experience` (252 kB); they
are now constructed inside the dynamically imported canvas. The hour
control importing the lighting presets pulled it in again (106 kB), because
those presets sat in the same module as the function that mutates the
shared materials; that bridge now lives in `lib/three/lighting-materials.ts`
and the presets are pure data. `/experience` ends at 4.8 kB.

Frame-time and FPS numbers were exercised in this sandbox using headless
Chromium with SwiftShader — a software GL rasterizer, not a GPU — so those
figures reflect the instrumentation working correctly, not real-world
performance. Under SwiftShader the scene renders at roughly 2 FPS, the same
order as Phase 2F; a CPU rasterizer pays disproportionately for extra lights
and a larger shadow map, and its numbers say nothing about what a real GPU
does with either:

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
