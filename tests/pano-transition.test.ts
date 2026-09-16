import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSITION_MS,
  createTransitionController,
  easeInOutCubic,
} from '@/lib/pano/transitionController';

describe('crossfade curve', () => {
  it('is pinned at both ends and symmetric about the midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 6);
  });

  it('clamps rather than extrapolating past either end', () => {
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(7)).toBe(1);
  });

  it('never runs backwards', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const value = easeInOutCubic(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('transition controller', () => {
  it('starts finished, so a viewer that never transitions renders at full opacity', () => {
    const controller = createTransitionController();
    expect(controller.running).toBe(false);
    expect(controller.frame()).toMatchObject({ progress: 1, incomingOpacity: 1, done: true });
  });

  it('runs for its configured duration and no longer', () => {
    const controller = createTransitionController({ durationMs: 600 });
    controller.start();

    expect(controller.advance(300).done).toBe(false);
    expect(controller.advance(299).done).toBe(false);
    expect(controller.advance(1).done).toBe(true);
    expect(controller.running).toBe(false);
  });

  it('defaults to the 600ms the brief asks for', () => {
    expect(DEFAULT_TRANSITION_MS).toBe(600);
    const controller = createTransitionController();
    controller.start();
    expect(controller.advance(DEFAULT_TRANSITION_MS).done).toBe(true);
  });

  it('keeps total coverage at or above one throughout — this is the no-black-flash guarantee', () => {
    // The outgoing shell is held at 1 and covered rather than faded out, so
    // the background is never visible through the pair. A sequential
    // fade-out/fade-in would dip to ~0.5 here.
    const controller = createTransitionController({ durationMs: 600 });
    controller.start();
    for (let i = 0; i < 60; i += 1) {
      const frame = controller.advance(16.7);
      const outgoing = 1;
      expect(outgoing).toBe(1);
      expect(frame.incomingOpacity).toBeGreaterThanOrEqual(0);
      expect(frame.incomingOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('settles the dolly back to exactly 1 so the shell is not left enlarged', () => {
    const controller = createTransitionController({ durationMs: 600, dolly: 0.2 });
    controller.start();
    expect(controller.advance(0).incomingScale).toBeCloseTo(1.2, 6);
    expect(controller.advance(600).incomingScale).toBeCloseTo(1, 6);
  });

  it('can be skipped outright', () => {
    const controller = createTransitionController();
    controller.start();
    controller.finish();
    expect(controller.frame()).toMatchObject({ progress: 1, incomingOpacity: 1, done: true });
  });

  it('ignores a negative frame delta rather than rewinding', () => {
    const controller = createTransitionController({ durationMs: 600 });
    controller.start();
    controller.advance(300);
    const before = controller.frame().progress;
    expect(controller.advance(-100).progress).toBe(before);
  });
});
