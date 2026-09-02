import type { BoxSpec, ColumnSpec, Range, ShellSides, WallGap } from './VillaTypes';

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
 * Narrowest void worth punching. A gap clipped to a sliver by the wall it
 * lands on is dropped rather than left as an unbuildable slot — which is
 * what keeps a window schedule written for a whole elevation from leaving
 * 5cm holes in the individual rooms behind it.
 */
const MIN_GAP_WIDTH = 0.4;

/**
 * A wall built as the solid remainder around its voids: a pier between each
 * pair of openings, plus a sill below and a head above every one. This is
 * the same technique the facade skin uses to punch windows without CSG,
 * factored out so the building's structure — not just its cladding — can
 * carry real holes.
 *
 * `at` is the wall's thickness range on the axis it faces; `across` runs
 * along its length. Gaps are clipped to the wall and must not overlap.
 */
export function punchedWall(
  key: string,
  axis: 'x' | 'z',
  at: Range,
  across: Range,
  y: Range,
  gaps: readonly WallGap[] = [],
): BoxSpec[] {
  const make = (a: Range, yy: Range, k: string): BoxSpec =>
    axis === 'z' ? box(k, a, yy, at) : box(k, at, yy, a);

  const clipped = gaps
    .map((gap) => ({
      across: [Math.max(across[0], gap.across[0]), Math.min(across[1], gap.across[1])] as Range,
      y: [Math.max(y[0], gap.y[0]), Math.min(y[1], gap.y[1])] as Range,
    }))
    .filter((gap) => span(gap.across) >= MIN_GAP_WIDTH && span(gap.y) > 0.01)
    .sort((a, b) => a.across[0] - b.across[0]);

  const parts: BoxSpec[] = [];
  let cursor = across[0];

  clipped.forEach((gap, index) => {
    if (gap.across[0] > cursor) {
      parts.push(make([cursor, gap.across[0]], y, `${key}-pier-${index}`));
    }
    if (gap.y[0] > y[0]) parts.push(make(gap.across, [y[0], gap.y[0]], `${key}-sill-${index}`));
    if (gap.y[1] < y[1]) parts.push(make(gap.across, [gap.y[1], y[1]], `${key}-head-${index}`));
    cursor = Math.max(cursor, gap.across[1]);
  });

  if (cursor < across[1]) parts.push(make([cursor, across[1]], y, `${key}-pier-end`));
  return parts;
}

/**
 * Turns a solid volume into an enclosure: four perimeter walls of thickness
 * `t`, each optionally punched or omitted. The outer faces land exactly on
 * the bounds given, so a mass replaced by its own shell is identical from
 * outside and habitable from within.
 *
 * The ±X walls run the full depth and the ±Z walls fill between them, so
 * corners meet once rather than overlapping.
 */
export function shell(
  key: string,
  x: Range,
  y: Range,
  z: Range,
  t: number,
  sides: ShellSides = {},
): BoxSpec[] {
  const parts: BoxSpec[] = [];
  const inner: Range = [x[0] + t, x[1] - t];

  if (sides.west !== false) {
    parts.push(...punchedWall(`${key}-w`, 'x', [x[0], x[0] + t], z, y, sides.west ?? []));
  }
  if (sides.east !== false) {
    parts.push(...punchedWall(`${key}-e`, 'x', [x[1] - t, x[1]], z, y, sides.east ?? []));
  }
  if (sides.north !== false) {
    parts.push(...punchedWall(`${key}-n`, 'z', [z[0], z[0] + t], inner, y, sides.north ?? []));
  }
  if (sides.south !== false) {
    parts.push(...punchedWall(`${key}-s`, 'z', [z[1] - t, z[1]], inner, y, sides.south ?? []));
  }

  return parts;
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
