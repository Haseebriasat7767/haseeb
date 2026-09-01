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
