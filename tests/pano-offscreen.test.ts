import { describe, expect, it } from 'vitest';
import { bearingDelta, horizontalHalfFov, offscreenHint } from '@/lib/pano/offscreen';

const deg = (d: number) => (d * Math.PI) / 180;

describe('bearing arithmetic', () => {
  it('wraps the short way round', () => {
    expect(bearingDelta(deg(170), deg(-170))).toBeCloseTo(deg(20), 6);
    expect(bearingDelta(deg(-170), deg(170))).toBeCloseTo(deg(-20), 6);
    expect(bearingDelta(0, 0)).toBe(0);
  });
});

describe('horizontal field of view', () => {
  it('is wider than the vertical one in landscape and narrower in portrait', () => {
    // The reason this exists. A 72° vertical fov on a phone held upright
    // shows less horizontally than vertically, so doors leave the frame
    // sooner there than the vertical number suggests.
    const landscape = horizontalHalfFov(72, 16 / 10);
    const portrait = horizontalHalfFov(72, 390 / 844);
    expect(landscape).toBeGreaterThan(deg(36));
    expect(portrait).toBeLessThan(deg(36));
    expect(portrait).toBeLessThan(landscape);
  });
});

describe('off-screen hint', () => {
  const halfFov = deg(30);

  it('says nothing about a door the visitor is already looking at', () => {
    expect(offscreenHint(0, 0, halfFov)).toBeNull();
    expect(offscreenHint(0, deg(20), halfFov)).toBeNull();
    expect(offscreenHint(deg(90), deg(100), halfFov)).toBeNull();
  });

  it('points to the side the door is actually on', () => {
    expect(offscreenHint(0, deg(80), halfFov)?.side).toBe('right');
    expect(offscreenHint(0, deg(-80), halfFov)?.side).toBe('left');
  });

  it('points the short way round a door directly behind', () => {
    // 190° to the right is 170° to the left, and the chevron must agree
    // with the shorter turn or it sends the visitor the long way.
    expect(offscreenHint(0, deg(190), halfFov)?.side).toBe('left');
    expect(offscreenHint(0, deg(170), halfFov)?.side).toBe('right');
  });

  it('holds the boundary inside the frame edge so it cannot flicker', () => {
    // Just inside the margin: still on screen as far as the hint is
    // concerned, so nothing is drawn.
    expect(offscreenHint(0, halfFov - 0.06, halfFov)).toBeNull();
    expect(offscreenHint(0, halfFov + 0.02, halfFov)).not.toBeNull();
  });

  it('fires far more often in portrait than in landscape, for one door', () => {
    const door = deg(40);
    expect(offscreenHint(0, door, horizontalHalfFov(72, 16 / 10))).toBeNull();
    expect(offscreenHint(0, door, horizontalHalfFov(72, 390 / 844))).not.toBeNull();
  });
});
