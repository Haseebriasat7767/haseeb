import { describe, expect, it } from 'vitest';
import { COLLIDER_LIMITS, colliderScale } from '@/components/three/tower/WalkCollider';

/**
 * The rule that decides what a visitor can walk through.
 *
 * Both bugs this rule exists to prevent were shipped and had to be found by
 * probing a running scene: the capsule walked straight through 100mm glass,
 * and then a first attempt at the fix swallowed the stair treads and turned
 * the flight into a lumpy ramp. The cases below are those two bugs, pinned.
 */

const { minPlanThickness, minWallHeight } = COLLIDER_LIMITS;

describe('walls are fattened so the capsule cannot straddle them', () => {
  it.each([
    ['shopfront glazing', [0.1, 3.4, 6] as const],
    ['podium shell', [0.45, 4.2, 12] as const],
    ['balcony balustrade', [0.08, 1.12, 3.2] as const],
  ])('%s becomes at least the capsule diameter in plan', (_part, scale) => {
    const [x, y, z] = colliderScale(scale);

    expect(x).toBeGreaterThanOrEqual(minPlanThickness);
    expect(z).toBeGreaterThanOrEqual(minPlanThickness);
    // Height is never touched: raising it would lift every floor in the
    // building by half the correction.
    expect(y).toBe(scale[1]);
  });

  it('never shrinks a wall that is already thick enough', () => {
    expect(colliderScale([1.8, 3, 2.4])).toEqual([1.8, 3, 2.4]);
  });

  it('catches the balustrade, which must be solid seventy metres up', () => {
    expect(1.12).toBeGreaterThanOrEqual(minWallHeight);
    expect(colliderScale([0.08, 1.12, 3.2])[0]).toBeGreaterThanOrEqual(minPlanThickness);
  });
});

describe('things you stand on are left exactly as drawn', () => {
  it.each([
    ['stair tread', [1.35, 0.175, 0.22] as const],
    ['floor plate', [18, 0.28, 18] as const],
    ['deck paving', [6, 0.12, 6] as const],
  ])('%s keeps its real size', (_part, scale) => {
    // A 220mm tread grown to 700mm swallows its neighbours and the flight
    // stops being a stair.
    expect(colliderScale(scale)).toEqual([...scale]);
  });

  it('leaves every box below the wall threshold untouched', () => {
    const belowThreshold = minWallHeight - 0.001;
    expect(colliderScale([0.05, belowThreshold, 0.05])).toEqual([0.05, belowThreshold, 0.05]);
  });

  it('treats the threshold itself as a wall', () => {
    expect(colliderScale([0.05, minWallHeight, 0.05])[0]).toBe(minPlanThickness);
  });
});

describe('the thresholds themselves', () => {
  it('clears the capsule diameter', () => {
    // The visitor is a capsule of radius 0.32, so 640mm across.
    expect(minPlanThickness).toBeGreaterThan(0.64);
  });

  it('sits below the shortest thing that must be solid', () => {
    // The balcony balustrade, at 1.12m.
    expect(minWallHeight).toBeLessThan(1.12);
  });

  it('sits above the tallest thing that must not be fattened', () => {
    // A stair riser, at 175mm.
    expect(minWallHeight).toBeGreaterThan(0.175);
  });
});
