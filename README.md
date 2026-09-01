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

## Design system

Tokens are defined once in `app/globals.css` under Tailwind v4's `@theme`:
palette, typographic scale, spacing, radii, shadows, easings, and breakpoints.
Cormorant Garamond carries editorial headings; Inter carries UI and body text.

## Deployment

Vercel-compatible with no extra configuration — push and import the repository.
