# design-sync notes

Findings from the first sync attempt, so the next one does not re-derive them.

## Shape

`package`. There is no Storybook and no `*.stories.*` anywhere in the repo —
both were searched for, outside `node_modules`, before this was recorded.

## The package being synced is not the app

The repository root is the AURELIA **application**: `private: true`, no
`main`/`module`/`exports`/`files`, and `npm run build` emits a Next app into
`.next/`. There is nothing compiled there for a design tool to consume.

The syncable package is `design-system/` (`@aurelia/primitives`), added for
this purpose. `npm run build:ds` emits:

- `design-system/dist/index.js` — the five primitives, ESM, React external
- `design-system/dist/index.css` — tokens plus only the utilities those five use
- `design-system/dist/types/` — declarations, entry at
  `dist/types/design-system/src/index.d.ts`

`design-system/dist` is gitignored; run `npm run build:ds` before syncing.

## Scope is deliberate: 5 of 117 components

Only `components/ui/*` can render standalone. Everything else is bound to a
route, a React Three Fiber scene, or explorer state, and would render broken
wherever a design agent placed it. Do not widen this without checking what a
component actually needs at runtime.

## The one substitution

`next/link` cannot exist outside the app, so it is aliased to
`design-system/src/link.tsx` — an anchor, which is what `next/link` degrades
to. This happens twice: in the esbuild bundle, and as a post-emit rewrite of
the `next/link` type import in `Button.d.ts` (without it, the package's
primary component ships a type no consumer can resolve). The build throws if
that import ever stops being present, so the rewrite cannot rot into a no-op.

## Blocked: authorization

The first attempt could not reach `DesignSync` — design-system authorization
cannot be granted from a remote (claude.ai/code) session. Nothing was
uploaded and no project was created, so `config.json` holds no `projectId`:
the next run is still a first-time import.
