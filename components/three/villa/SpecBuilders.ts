import type { BoxSpec, ColumnSpec, Range } from './VillaTypes';

export const mid = (r: Range) => (r[0] + r[1]) / 2;
export const span = (r: Range) => r[1] - r[0];

/** Authors a volume by its bounds, which reads far closer to a section drawing. */
export function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return {
    key,
    position: [mid(x), mid(y), mid(z)],
    scale: [span(x), span(y), span(z)],
  };
}

export function column(key: string, x: number, z: number, y: Range, radius: number): ColumnSpec {
  return { key, position: [x, mid(y), z], scale: [radius, span(y), radius] };
}

/**
 * A run of steps between two levels, generated from tread count and going —
 * the same technique the villa's own approach stairs use, factored out so
 * other systems can build a run along either axis in one call. Each tread
 * is a solid block down to `baseY`, so a run never floats above whatever
 * is beneath it.
 */
export function stairRun(
  keyPrefix: string,
  axis: 'x' | 'z',
  across: Range,
  start: number,
  direction: 1 | -1,
  treads: number,
  going: number,
  topY: number,
  bottomY: number,
  baseY: number,
): BoxSpec[] {
  const rise = (topY - bottomY) / treads;
  return Array.from({ length: treads }, (_, index) => {
    const top = topY - index * rise;
    const s0 = start + direction * index * going;
    const s1 = s0 + direction * going;
    const stepping: Range = s0 < s1 ? [s0, s1] : [s1, s0];
    return axis === 'z'
      ? box(`${keyPrefix}-${index}`, across, [baseY, top], stepping)
      : box(`${keyPrefix}-${index}`, stepping, [baseY, top], across);
  });
}
