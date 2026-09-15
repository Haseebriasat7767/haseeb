import { describe, expect, it } from 'vitest';
import { GUIDED_TOUR, GUIDED_TOUR_LENGTH, resolveTourStep } from '@/lib/experience/guided-tour';
import { TIME_OF_DAY } from '@/lib/three/lighting';
import { findSpace } from '@/lib/experience/spaces';

/**
 * The tour's data, and the boundaries the replay depends on.
 *
 * Replay is `setTourIndex(0)` against this list, so what actually has to
 * hold is that index 0 resolves, that the last index is the last step, and
 * that stepping past it resolves to nothing rather than throwing — the
 * component treats `null` as "leave the tour", and a throw would take the
 * page down instead.
 */

describe('guided tour data', () => {
  it('names only spaces that exist', () => {
    for (const step of GUIDED_TOUR) {
      expect(findSpace(step.space), `step ${step.id} names a missing space`).toBeDefined();
    }
  });

  it('names only hours the renderer actually has', () => {
    for (const step of GUIDED_TOUR) {
      if (!step.timeOfDay) continue;
      expect(TIME_OF_DAY, `step ${step.id} names an unknown hour`).toHaveProperty(step.timeOfDay);
    }
  });

  it('has no duplicate step ids', () => {
    const ids = GUIDED_TOUR.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('tour step resolution', () => {
  it('resolves the first step, which is where replay restarts', () => {
    const first = resolveTourStep(0);
    expect(first).not.toBeNull();
    expect(first?.position).toBe(1);
    expect(first?.total).toBe(GUIDED_TOUR_LENGTH);
  });

  it('resolves the last step as the last position', () => {
    const last = resolveTourStep(GUIDED_TOUR_LENGTH - 1);
    expect(last?.position).toBe(GUIDED_TOUR_LENGTH);
    expect(last?.position).toBe(last?.total);
  });

  it('returns null past the end rather than throwing', () => {
    expect(resolveTourStep(GUIDED_TOUR_LENGTH)).toBeNull();
    expect(resolveTourStep(999)).toBeNull();
  });

  it('returns null for a negative index rather than throwing', () => {
    expect(resolveTourStep(-1)).toBeNull();
  });

  it('gives every step something to say without inventing it', () => {
    for (let i = 0; i < GUIDED_TOUR_LENGTH; i += 1) {
      const step = resolveTourStep(i);
      expect(step, `step ${i}`).not.toBeNull();
      expect(step?.name.length).toBeGreaterThan(0);
      expect(step?.description.length).toBeGreaterThan(0);
      // A step with no description of its own falls back to the space's
      // `feature`, which is written against the geometry — never to filler.
      const space = findSpace(step!.step.space)!;
      expect([space.feature, step!.step.description]).toContain(step!.description);
    }
  });

  it('is stable across repeated resolution, so replay reads identically', () => {
    expect(resolveTourStep(0)).toEqual(resolveTourStep(0));
    expect(resolveTourStep(3)).toEqual(resolveTourStep(3));
  });
});
