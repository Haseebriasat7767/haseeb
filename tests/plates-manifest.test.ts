import { describe, expect, it } from 'vitest';
import { ALL_PLATES, RESIDENCE_PLATES, TOWER_PLATES } from '../scripts/plates.manifest.mjs';
import { SPACES } from '@/lib/experience/spaces';
import { TOWER_VIEWS } from '@/lib/three/tower-views';

/**
 * The capture manifest against the framings that actually exist.
 *
 * A capture run takes tens of minutes per plate. A mistyped id does not
 * fail loudly there — it either throws deep into a run that has already
 * cost an hour, or worse, silently produces one fewer plate than the
 * operator thinks they asked for. Both are caught here in milliseconds.
 */

describe('capture manifest', () => {
  it('names only spaces that exist in the residence', () => {
    const ids = new Set(SPACES.map((space) => space.id));
    for (const plate of RESIDENCE_PLATES) {
      expect(ids, `"${plate.space}" is not a space`).toContain(plate.space);
    }
  });

  it('names only views that exist in the tower', () => {
    const ids = new Set(TOWER_VIEWS.map((view) => view.id));
    for (const plate of TOWER_PLATES) {
      expect(ids, `"${plate.view}" is not a tower view`).toContain(plate.view);
    }
  });

  it('covers every residence space', () => {
    // The gallery shows all of them, so a missing plate is a visibly
    // empty tile rather than an omission nobody notices.
    const covered = new Set(RESIDENCE_PLATES.map((plate) => plate.space));
    for (const space of SPACES) {
      expect(covered, `${space.id} has no plate`).toContain(space.id);
    }
  });

  it('writes every plate to a distinct file', () => {
    const files = ALL_PLATES.map((plate) => plate.file);
    const seen = new Set(files);
    expect(seen.size, 'two plates share a filename and would overwrite each other').toBe(
      files.length,
    );
  });

  it('gives every plate a caption and a jpg filename', () => {
    for (const plate of ALL_PLATES) {
      expect(plate.caption.length, `${plate.file} has no caption`).toBeGreaterThan(0);
      expect(plate.file).toMatch(/\.jpg$/);
    }
  });

  it('tags each plate with the building it belongs to', () => {
    const residence = ALL_PLATES.filter((p) => p.building === 'residence');
    const tower = ALL_PLATES.filter((p) => p.building === 'tower');
    expect(residence).toHaveLength(RESIDENCE_PLATES.length);
    expect(tower).toHaveLength(TOWER_PLATES.length);
    expect(residence.length + tower.length).toBe(ALL_PLATES.length);
  });
});
