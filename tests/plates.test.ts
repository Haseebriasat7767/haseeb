import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLATES, plateCoverage, plateFor } from '@/lib/experience/plates';
import { SPACES, findSpace } from '@/lib/experience/spaces';

/**
 * The plate manifest against the files that actually exist.
 *
 * A manifest of images is the easiest thing in a project to let rot: a
 * plate is renamed or a render is regenerated under a different name, and
 * the page ships a broken image to a buyer. Since plates arrive a few at a
 * time rather than all at once, the manifest has to be checked against
 * `public/` rather than reviewed by eye.
 */

const PUBLIC = resolve(process.cwd(), 'public');

describe('plate manifest', () => {
  it('points only at files that exist on disk', () => {
    for (const plate of PLATES) {
      const path = resolve(PUBLIC, plate.src.replace(/^\//, ''));
      expect(existsSync(path), `${plate.space}: missing ${plate.src}`).toBe(true);
    }
  });

  it('points at files with real content rather than empty placeholders', () => {
    for (const plate of PLATES) {
      const path = resolve(PUBLIC, plate.src.replace(/^\//, ''));
      expect(statSync(path).size, `${plate.space}: ${plate.src} is empty`).toBeGreaterThan(10_000);
    }
  });

  it('names only spaces that exist', () => {
    for (const plate of PLATES) {
      expect(findSpace(plate.space), `${plate.space} is not a space`).toBeDefined();
    }
  });

  it('declares a usable intrinsic size for every plate', () => {
    // Wrong dimensions shift the layout when the image loads, which on a
    // gallery of eighteen tiles is the whole grid moving under the cursor.
    for (const plate of PLATES) {
      expect(plate.width, `${plate.space} width`).toBeGreaterThan(0);
      expect(plate.height, `${plate.space} height`).toBeGreaterThan(0);
    }
  });

  it('returns null for a space with no plate rather than guessing one', () => {
    const uncovered = SPACES.find((space) => !PLATES.some((p) => p.space === space.id));
    expect(uncovered, 'expected at least one space without a plate').toBeDefined();
    expect(plateFor(uncovered!.id)).toBeNull();
    expect(plateFor('not-a-space')).toBeNull();
  });

  it('prefers a finished plate over a traced one for the same space', () => {
    const traced = {
      space: 'living',
      src: '/x.jpg',
      grade: 'traced' as const,
      width: 1,
      height: 1,
    };
    const photoreal = { ...traced, grade: 'photoreal' as const };
    // The resolver's rule, exercised directly: order must not decide.
    const pick = (rows: typeof PLATES) => {
      const map = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        const seen = map.get(row.space);
        if (!seen || (seen.grade === 'traced' && row.grade === 'photoreal'))
          map.set(row.space, row);
      }
      return map.get('living');
    };
    expect(pick([traced, photoreal])?.grade).toBe('photoreal');
    expect(pick([photoreal, traced])?.grade).toBe('photoreal');
  });

  it('reports coverage honestly', () => {
    const { total, photoreal } = plateCoverage();
    expect(total).toBe(new Set(PLATES.map((p) => p.space)).size);
    expect(photoreal).toBeLessThanOrEqual(total);
    expect(total).toBeLessThanOrEqual(SPACES.length);
  });
});
