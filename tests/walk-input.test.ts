import { describe, expect, it } from 'vitest';
import {
  resetWalkInput,
  STICK_DEADZONE,
  STICK_RANGE,
  stickDeflection,
  walkLook,
  walkMove,
} from '@/lib/three/walk-input';

/**
 * The thumb-stick maths.
 *
 * Screen coordinates run downward, so a thumb pushed UP the screen produces a
 * negative `y` — which the controller reads as forward. Getting that sign
 * wrong sends the visitor backwards through the wall behind them, and it is
 * not the sort of thing a screenshot makes obvious.
 */

const origin = { x: 200, y: 500 };
const at = (dx: number, dy: number) => ({ x: origin.x + dx, y: origin.y + dy });

describe('stickDeflection', () => {
  it('reads a resting thumb as no input at all', () => {
    expect(stickDeflection(origin, origin)).toEqual({ x: 0, y: 0 });
  });

  it('ignores a tremor inside the deadzone', () => {
    const justInside = STICK_RANGE * STICK_DEADZONE * 0.9;
    expect(stickDeflection(origin, at(justInside, 0))).toEqual({ x: 0, y: 0 });
  });

  it('responds just outside the deadzone', () => {
    const justOutside = STICK_RANGE * STICK_DEADZONE * 1.2;
    expect(stickDeflection(origin, at(justOutside, 0)).x).toBeGreaterThan(0);
  });

  it('reads a thumb pushed up the screen as forward', () => {
    // Up the screen is a smaller clientY.
    expect(stickDeflection(origin, at(0, -STICK_RANGE)).y).toBeCloseTo(-1);
  });

  it('reads a thumb pushed down the screen as backward', () => {
    expect(stickDeflection(origin, at(0, STICK_RANGE)).y).toBeCloseTo(1);
  });

  it('reads right and left as strafe in the matching direction', () => {
    expect(stickDeflection(origin, at(STICK_RANGE, 0)).x).toBeCloseTo(1);
    expect(stickDeflection(origin, at(-STICK_RANGE, 0)).x).toBeCloseTo(-1);
  });

  it('never exceeds full deflection however far the thumb travels', () => {
    for (const distance of [STICK_RANGE, STICK_RANGE * 3, STICK_RANGE * 40]) {
      const out = stickDeflection(origin, at(distance, -distance));
      expect(Math.hypot(out.x, out.y)).toBeLessThanOrEqual(1.0001);
    }
  });

  it('makes a diagonal no faster than a straight line', () => {
    // Clamped to the circle, not the square. Otherwise walking diagonally is
    // √2 times faster and the building lurches when you round a corner.
    const straight = stickDeflection(origin, at(0, -STICK_RANGE * 5));
    const diagonal = stickDeflection(origin, at(STICK_RANGE * 5, -STICK_RANGE * 5));

    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(Math.hypot(straight.x, straight.y), 4);
  });

  it('scales smoothly between the deadzone and full deflection', () => {
    const half = stickDeflection(origin, at(0, -STICK_RANGE / 2));
    expect(Math.abs(half.y)).toBeGreaterThan(0.4);
    expect(Math.abs(half.y)).toBeLessThan(0.6);
  });
});

describe('resetWalkInput', () => {
  it('centres both sticks', () => {
    walkMove.current.x = 0.8;
    walkMove.current.y = -0.5;
    walkLook.current.x = -0.3;
    walkLook.current.y = 0.9;

    resetWalkInput();

    // Leaving walk mode with a thumb down would otherwise leave the camera
    // turning for as long as the page stayed open.
    expect(walkMove.current).toEqual({ x: 0, y: 0 });
    expect(walkLook.current).toEqual({ x: 0, y: 0 });
  });

  it('keeps the same objects so the controller references stay live', () => {
    const move = walkMove.current;
    resetWalkInput();
    expect(walkMove.current).toBe(move);
  });
});
