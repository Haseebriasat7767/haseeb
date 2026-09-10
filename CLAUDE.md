# Model & effort routing

Optimize for the lowest Claude usage that reliably solves the task. Do not
default to the strongest model or highest effort.

## Tiers

**Tier 1 — trivial.** CSS/typography/spacing tweaks, renames, obvious syntax
fixes, text/content changes, adding/removing a class, config value changes.
Cheapest model, low effort. No full builds or browser screenshots needed —
typecheck/lint is enough verification.

**Tier 2 — normal development.** New components with known requirements,
API integration, straightforward multi-file changes, ordinary responsive
work, small/medium refactors, routine bug fixes. Default tier for most work
on this repo.

**Tier 3 — complex.** Difficult bugs, multi-file architectural changes,
performance problems, hard Three.js/R3F issues, state-management problems,
deployment problems, anything touching multiple interacting systems. Try
the default model at higher effort before escalating.

**Tier 4 — expert only.** Major architecture decisions, hard-to-reproduce
bugs, deep 3D rendering/performance problems, large refactors across many
systems — or Tier 3 that a lower effort already failed to solve. Not for
CSS, text, simple components, or routine debugging, no matter how large the
diff looks.

Escalate only when the current attempt reports genuine uncertainty about
root cause, needs architectural reasoning, or has already failed once — not
because a task touches many files. Large ≠ difficult. After solving a
Tier 3/4 problem, return to the default tier for whatever comes next; don't
stay escalated for unrelated follow-up work.

## Task boundaries

Do the smallest change that completely solves what was asked. If asked to
fix one thing, don't also refactor, redesign, or optimize adjacent code.
Audits: inspect, rank by impact, fix only what's requested or clearly
highest-priority — don't re-audit the whole project after every small
change.

## Context discipline

Read only the files a task touches. Don't re-read files already in
context. Prefer targeted `grep`/`sed -n` over reading whole files. Don't
paste full file contents into responses when a diff or targeted excerpt
says the same thing.

## Coding preferences

Minimal diffs. Reuse existing components, materials, and 3D primitives
before adding new ones. Don't rewrite working systems to "improve" them
unless asked. Don't introduce a new dependency when an existing one covers
the need — check `package.json` first.

## This project (Aurelia)

A procedurally generated property demo (a coastal residence and an
oceanfront tower), built to be pitched to real developers/agents as a
sales tool, not a real listing. Two rules that override normal instincts:

- **Never invent a fact about the property, its price, its developer, or
  any contact detail.** Values are `null` until a real one is configured,
  and every component that reads `CLIENT`/`SITE` must treat `null` as
  "don't render" rather than filling in a placeholder.
- **Every published figure (area, room counts, storey counts, etc.) must
  be computed from the same generator the 3D scene uses** —
  `lib/property/schedule.ts` for the residence, `lib/property/tower.ts`
  for the tower — never typed by hand next to it. See
  `tests/property-figures.test.ts` and `tests/tower-figures.test.ts` for
  why: a hand-typed figure silently drifted from the model for most of
  this project's life before those existed.

Preserve existing 3D work unless explicitly asked to replace it. Priority
order for 3D changes: photorealism → lighting → materials → camera
composition → mobile performance → conversion impact. Routine Three.js/R3F
work, material/camera adjustments, and UI are Tier 2. Genuinely hard
rendering/architecture problems are Tier 4.
