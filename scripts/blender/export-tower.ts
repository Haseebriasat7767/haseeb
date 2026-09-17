import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TOWER_CONFIG,
  createShorelineLayout,
  createTowerLayout,
} from '@/components/three/tower/TowerGeometry';
import { createAmenity } from '@/components/three/tower/AmenityGeometry';
import { createCore } from '@/components/three/tower/CoreGeometry';
import { createApartment, mergeApartments } from '@/components/three/tower/ApartmentGeometry';
import { TOWER_VIEWS } from '@/lib/three/tower-views';
import { towerSpaceIds } from '@/scripts/lib/pano-spaces.mjs';

/**
 * Dumps the generated tower for the offline renderer.
 *
 * Same rule as the residence: nothing is modelled, everything is read from
 * the generator that the website's own scene, the tower specification and
 * `tower-figures.test.ts` all derive from.
 *
 * The composition mirrors `TowerScene` exactly — shell, amenity deck, lift
 * core, and every residential plate above level 0 fitted out, merged the way
 * the scene merges them. An export that assembled a different building
 * would render a different building.
 *
 *   TOWER_OUT=/tmp/tower.json npx vitest run --config scripts/blender/export-tower.config.ts
 */

type Box = { key: string; position: number[]; scale: number[]; rotationY?: number };

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

/**
 * Model placements — the tower's furniture.
 *
 * Unlike the residence, whose rooms are furnished entirely with box specs
 * and forms, the tower places 500-odd instances of a glTF library: sofas,
 * dining chairs, beds, baths, kitchen runs. They are the reason a flat
 * looks furnished, and an export without them renders a glazed empty plate.
 */
function models(value: unknown, into: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const entry of value) models(entry, into);
  } else if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if ('name' in candidate && 'position' in candidate && !('scale' in candidate)) {
      into.push(candidate);
    } else {
      for (const entry of Object.values(candidate)) models(entry, into);
    }
  }
  return into;
}

function forms(value: unknown, into: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const entry of value) forms(entry, into);
  } else if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if ('kind' in candidate && 'material' in candidate && 'position' in candidate) {
      into.push(candidate);
    } else {
      for (const entry of Object.values(candidate)) forms(entry, into);
    }
  }
  return into;
}

const OUT = process.env.TOWER_OUT ?? 'tower.json';

describe('tower scene export', () => {
  const layout = createTowerLayout(TOWER_CONFIG);
  const shoreline = createShorelineLayout(layout.plan);
  const amenity = createAmenity(layout.plan);
  const core = createCore(layout.plan, TOWER_CONFIG.towerLevels, layout.stair.doorX);
  const apartments = mergeApartments(
    layout.residentialPlates
      .filter((plate) => plate.level > 0)
      .map((plate) =>
        createApartment(plate.x, plate.z, plate.floorY, plate.ceilingY, {
          variant: plate.level,
          prefix: `apt${plate.level}`,
          dressed: true,
        }),
      ),
  );

  const groups: Record<string, Box[]> = {};

  /**
   * Emits one group per material, descending into nested records.
   *
   * Flattening a level too early is not cosmetic: `tower` alone holds the
   * core, the slabs, the plates, the ceilings, the glazing, the fins and
   * the spandrels, and collapsing them into one group paints the curtain
   * wall the same colour as the concrete behind it. The generator sorts by
   * material, so the path to an array IS the material name.
   */
  const add = (name: string, value: unknown, depth = 0) => {
    if (Array.isArray(value)) {
      const found = boxes(value);
      if (found.length > 0) groups[name] = (groups[name] ?? []).concat(found);
      return;
    }
    if (value && typeof value === 'object' && depth < 2) {
      const record = value as Record<string, unknown>;
      if ('position' in record && 'scale' in record && 'key' in record) {
        groups[name] = (groups[name] ?? []).concat(record as unknown as Box);
        return;
      }
      for (const [child, entry] of Object.entries(record))
        add(`${name}.${child}`, entry, depth + 1);
      return;
    }
    const found = boxes(value);
    if (found.length > 0) groups[name] = (groups[name] ?? []).concat(found);
  };

  for (const [name, value] of Object.entries(layout)) add(`t.${name}`, value);
  add('t.shoreline', shoreline);
  for (const [name, value] of Object.entries(amenity)) add(`am.${name}`, value);
  for (const [name, value] of Object.entries(core)) add(`core.${name}`, value);
  for (const [name, value] of Object.entries(apartments)) add(`apt.${name}`, value);

  const allForms = [...forms(amenity), ...forms(apartments)];
  const allModels = [...models(amenity), ...models(core), ...models(apartments)];

  // Only the interior standpoints. A cubemap of the outdoors is what the
  // real-time scene already does better, live.
  const spaces = TOWER_VIEWS.filter((view) => towerSpaceIds.includes(view.id)).map((view) => ({
    id: view.id,
    name: view.label,
    position: view.position,
    target: view.target,
    fov: view.fov,
    exposure: view.exposure ?? 1,
  }));

  it('assembles the same building the scene does', () => {
    expect(Object.keys(groups).length).toBeGreaterThan(10);
    expect(Object.values(groups).reduce((n, g) => n + g.length, 0)).toBeGreaterThan(2000);
  });

  it('keeps the curtain wall separate from what stands behind it', () => {
    // The one grouping mistake that ruins every frame at once: glazing
    // painted as concrete seals the building, and an 80m tower of sealed
    // floors is lit by nothing.
    expect(groups['t.tower.glazing']?.length ?? 0).toBeGreaterThan(50);
    expect(groups['t.podium.glazing']?.length ?? 0).toBeGreaterThan(10);
  });

  it('fits out every residential plate above the amenity deck', () => {
    // Level 0 is the amenity deck and is fitted by createAmenity, so the
    // flats start at 1. Thirteen empty glazed plates is worse than not
    // offering the floors at all.
    const fitted = layout.residentialPlates.filter((plate) => plate.level > 0).length;
    expect(fitted).toBeGreaterThan(10);
    expect(allForms.length).toBeGreaterThan(50);
  });

  it('carries the furniture, which is placed as glTF instances not boxes', () => {
    // The tower furnishes its flats from a model library rather than with
    // box specs. Miss these and every apartment renders as an empty plate.
    expect(allModels.length).toBeGreaterThan(300);
    const names = new Set(allModels.map((m) => (m as { name: string }).name));
    expect(names.has('sofa-3seat')).toBe(true);
    expect(names.has('dining-chair')).toBe(true);
  });

  it('carries the shoreline, which is the whole reason for the framings', () => {
    const shore = Object.keys(groups).filter((name) => name.startsWith('t.shoreline.'));
    expect(shore.length).toBeGreaterThan(0);
  });

  it('covers every interior standpoint the render list names', () => {
    expect(spaces.map((s) => s.id).sort()).toEqual([...towerSpaceIds].sort());
  });

  it('writes the scene', () => {
    writeFileSync(
      OUT,
      JSON.stringify({ groups, forms: allForms, models: allModels, lights: [], spaces }),
    );
    console.log(
      `wrote ${OUT}: ${Object.keys(groups).length} groups, ` +
        `${Object.values(groups).reduce((n, g) => n + g.length, 0)} boxes, ` +
        `${allForms.length} forms, ${allModels.length} models, ${spaces.length} framings`,
    );
  });
});
