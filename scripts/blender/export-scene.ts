import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VILLA_CONFIG, createVillaLayout } from '@/components/three/villa/VillaGeometry';
import {
  INTERIOR_CONFIG,
  createInteriorLayout,
} from '@/components/three/villa/interior/InteriorGeometry';
import { SPACES } from '@/lib/experience/spaces';

/**
 * Dumps the generated residence for the offline renderer.
 *
 * ## Why this reads the generator instead of exporting a model
 *
 * The floor plans, the accommodation schedule, the panorama door graph and
 * the brochure figures are all derived from `createVillaLayout` and
 * `createInteriorLayout`. A building modelled by hand in Blender would be a
 * second source for the same facts, free to drift from the first — which is
 * the failure `tests/property-figures.test.ts` exists to catch. So Blender
 * gets a better renderer to point at the same building, and never becomes a
 * second building.
 *
 * It runs under vitest because that is the only runner configured here that
 * resolves the `@/` alias, and it asserts the shape of what it writes so a
 * silently empty export fails rather than producing an empty render.
 *
 *   npx vitest run --config scripts/blender/export.config.ts
 */

type Box = { key: string; position: number[]; scale: number[]; rotationY?: number };

/** Collects everything shaped like a box, wherever it sits in the structure. */
function boxes(value: unknown, into: Box[] = []): Box[] {
  if (Array.isArray(value)) {
    for (const entry of value) boxes(entry, into);
  } else if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if ('position' in candidate && 'scale' in candidate && 'key' in candidate) {
      into.push(candidate as unknown as Box);
    } else {
      for (const entry of Object.values(candidate)) boxes(entry, into);
    }
  }
  return into;
}

const OUT = process.env.SCENE_OUT ?? 'scene.json';

describe('residence scene export', () => {
  const layout = createVillaLayout(VILLA_CONFIG, 'high');
  const interior = createInteriorLayout(INTERIOR_CONFIG, layout.plan, layout.levels, 'high');

  const groups: Record<string, Box[]> = {};
  const add = (name: string, value: unknown) => {
    const found = boxes(value);
    if (found.length > 0) groups[name] = found;
  };
  for (const [name, value] of Object.entries(layout)) add(`shell.${name}`, value);
  for (const [name, value] of Object.entries(interior)) add(`int.${name}`, value);

  const lights = (interior as unknown as { lights?: unknown[] }).lights ?? [];

  // The soft, turned and folded geometry — sofas, cushions, lamp bases,
  // vessels, rugs, drapery. Kept apart from the box specs by the generator
  // because they are not prisms, and carried through here verbatim: each
  // form already names its own material and its own construction, so the
  // renderer rebuilds it rather than approximating it with a box.
  const forms = (interior as unknown as { forms?: unknown[] }).forms ?? [];
  const spaces = SPACES.filter((space) => space.room).map((space) => ({
    id: space.id,
    name: space.name,
    position: space.view.position,
    target: space.view.target,
    fov: space.view.fov,
    exposure: space.view.exposure ?? 1,
  }));

  it('carries the building, its lights and its framings', () => {
    expect(Object.keys(groups).length).toBeGreaterThan(10);
    expect(Object.values(groups).reduce((n, g) => n + g.length, 0)).toBeGreaterThan(1000);
    expect(lights.length).toBeGreaterThan(0);
    expect(spaces.length).toBe(13);
  });

  it('carries the soft furniture, which is most of what a room looks like', () => {
    // Without these a render is a well-lit empty shell: the boxes are the
    // fireplace and the carcasses, and every sofa, cushion, lamp and rug
    // lives here instead.
    expect(forms.length).toBeGreaterThan(100);
    const kinds = new Set(forms.map((f) => (f as { kind: string }).kind));
    expect([...kinds].sort()).toEqual(['fold', 'soft', 'turned']);
  });

  it('keeps the glazing separate, so the renderer can make it glass', () => {
    // Rendered opaque this seals the building and no daylight reaches the
    // interior — the one grouping mistake that ruins every frame at once.
    expect(groups['shell.openings']?.length ?? 0).toBeGreaterThan(100);
  });

  it('writes the scene', () => {
    writeFileSync(OUT, JSON.stringify({ groups, forms, lights, spaces }));
    console.log(
      `wrote ${OUT}: ${Object.keys(groups).length} groups, ` +
        `${Object.values(groups).reduce((n, g) => n + g.length, 0)} boxes, ` +
        `${forms.length} forms, ${lights.length} lights, ${spaces.length} framings`,
    );
  });
});
