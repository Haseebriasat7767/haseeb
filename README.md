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

### Current baseline (Phase 2B.5)

Renderer counters, read directly from `renderer.info` on the default villa
view:

| Metric     | Value |
| ---------- | ----- |
| Draw calls | 58    |
| Triangles  | 3,590 |
| Geometries | 21    |
| Textures   | 1     |

Both are well inside the "Excellent" band. Frame-time and FPS numbers were
exercised in this sandbox using headless Chromium with SwiftShader — a
software GL rasterizer, not a GPU — so those figures reflect the
instrumentation working correctly, not real-world performance:

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
