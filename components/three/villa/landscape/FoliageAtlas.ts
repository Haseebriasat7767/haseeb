import { CanvasTexture, LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace } from 'three';

/**
 * A foliage atlas, drawn at runtime into a canvas.
 *
 * Aurelia has never downloaded an asset and does not start here. The
 * alternative — a CC0 leaf cut-out from ambientCG or Poly Haven — would
 * have been defensible under the Route B decision, but a foliage alpha is
 * one of the few textures a program can actually draw convincingly: it is
 * a few dozen small blades scattered inside a ragged outline, which is
 * exactly the kind of thing a seeded loop is good at and a photograph is
 * merely convenient for.
 *
 * Four cells in a 2x2 grid. Instances pick a cell through a per-instance
 * UV offset, so all four variants still share one texture and one draw
 * call.
 */

/** Side of the whole atlas, in pixels. Four 256 px cells. */
const ATLAS_SIZE = 512;
const CELL = ATLAS_SIZE / 2;

/** Deterministic PRNG — the same generator the landscape placement uses. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

/**
 * Draws one leaf: a tapered blade rather than an ellipse.
 *
 * The shape matters more than it looks like it should. A cluster of
 * ellipses reads as gravel; the pointed tip and the asymmetric curve of a
 * real leaf are what make a silhouette read as foliage at the distance
 * these cards are actually seen from.
 */
function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  fill: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -length / 2);
  ctx.quadraticCurveTo(width / 2, -length * 0.1, width * 0.22, length / 2);
  ctx.quadraticCurveTo(-width * 0.22, length * 0.36, -width / 2, -length * 0.1);
  ctx.quadraticCurveTo(-width * 0.3, -length * 0.36, 0, -length / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/**
 * Fills one atlas cell with an irregular cluster.
 *
 * Leaves are scattered inside a squashed disc whose radius is itself
 * modulated by angle, so the outline is ragged rather than round — a
 * circular cluster is the single clearest way to give away that a canopy
 * is made of cards. Density falls toward the edge so the silhouette
 * dissolves into individual leaves instead of ending on a hard rim.
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  seed: number,
  leafCount: number,
): void {
  const rng = mulberry32(seed);
  const cx = originX + CELL / 2;
  const cy = originY + CELL / 2;

  // Clip to the cell. Leaves are kept well inside it by the radius below,
  // but a stray one crossing into a neighbour would show up as foliage
  // hanging off the edge of an unrelated card.
  ctx.save();
  ctx.beginPath();
  ctx.rect(originX, originY, CELL, CELL);
  ctx.clip();

  // A per-cell outline: six harmonics of radius against angle.
  //
  // The ceiling of 0.66 matters more than it looks. The first version let
  // the cluster reach the full half-cell, which meant the leaves covered
  // every pixel of the card — so there was no transparency for the alpha
  // test to cut, and every card rendered as an opaque grey rectangle. A
  // foliage card is mostly hole; the cluster has to sit well inside its own
  // tile for the technique to work at all.
  const lobes = Array.from({ length: 6 }, () => between(rng, 0.62, 1.0));
  const radiusAt = (angle: number) => {
    let r = 0.52;
    for (let i = 0; i < lobes.length; i += 1) {
      r += Math.cos(angle * (i + 1) + lobes[i]! * 6.283) * 0.07 * lobes[i]!;
    }
    return Math.min(r, 0.66);
  };

  for (let i = 0; i < leafCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    // Square-root bias fills the middle before the edge; the extra factor
    // pulls a minority of leaves out past the outline as stragglers.
    const t = Math.sqrt(rng()) * (rng() > 0.9 ? 1.08 : 0.94);
    const reach = radiusAt(angle) * t * (CELL / 2);
    const x = cx + Math.cos(angle) * reach;
    const y = cy + Math.sin(angle) * reach * 0.9;

    // Darker toward the middle: a canopy is lit from outside, and the tonal
    // gradient is what gives a flat card the appearance of depth.
    const depth = 1 - t * 0.55;
    const hue = 78 + between(rng, -12, 14);
    const sat = 26 + between(rng, -8, 12);
    const light = 20 + (1 - depth) * 26 + between(rng, -5, 7);

    const length = between(rng, 19, 34) * (0.78 + (1 - t) * 0.36);
    drawLeaf(
      ctx,
      x,
      y,
      length,
      length * between(rng, 0.3, 0.46),
      rng() * Math.PI * 2,
      `hsl(${hue.toFixed(1)} ${sat.toFixed(1)}% ${light.toFixed(1)}%)`,
    );
  }

  ctx.restore();
}

let atlas: CanvasTexture | null = null;

/**
 * The shared foliage texture. Built once and reused by every card in the
 * scene, so the whole canopy costs one upload.
 */
export function getFoliageAtlas(): CanvasTexture {
  if (atlas) return atlas;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Four cells, each a different density and seed: two full clusters for
    // the body of a crown, one sparse for its edge, one small for shrubs.
    drawCell(ctx, 0, 0, 0x466f4c, 420);
    drawCell(ctx, CELL, 0, 0x2f5a38, 370);
    drawCell(ctx, 0, CELL, 0x6a8f52, 215);
    drawCell(ctx, CELL, CELL, 0x3d7a44, 275);
  }

  atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.magFilter = LinearFilter;
  atlas.minFilter = LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 4;
  atlas.needsUpdate = true;
  return atlas;
}

/** Releases the atlas when the experience unmounts. */
export function disposeFoliageAtlas(): void {
  atlas?.dispose();
  atlas = null;
}

/** UV offset of each atlas cell, in the order `drawCell` wrote them. */
export const ATLAS_CELLS: readonly [number, number][] = [
  [0, 0.5],
  [0.5, 0.5],
  [0, 0],
  [0.5, 0],
];

export const ATLAS_CELL_SCALE = 0.5;
