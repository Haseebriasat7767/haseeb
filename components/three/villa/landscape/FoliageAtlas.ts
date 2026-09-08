import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  SRGBColorSpace,
  type Texture,
} from 'three';

/**
 * A foliage atlas, baked in Blender and drawn at runtime as a fallback.
 *
 * Four cells in a 2x2 grid. Instances pick a cell through a per-instance
 * UV offset, so all four variants still share one texture and one draw
 * call.
 *
 * Two implementations of the same layout live here. `tools/blender/foliage.py`
 * bakes it to `/assets/foliage/atlas.png` at 2048 px with every leaf modelled
 * as a polygon; the canvas below draws it at 1024 px out of filled quadratic
 * curves. The canvas one is not dead code and not a placeholder — it is what
 * fills the texture on the first frame, before any request has returned, and
 * what the scene keeps if the request never does.
 *
 * Neither is downloaded from anywhere. A foliage alpha is one of the few
 * textures a program can genuinely author: a few thousand small blades
 * scattered inside a ragged outline, which is what a seeded loop is good at
 * and what a photograph is merely convenient for. The CC0 cut-outs from
 * ambientCG and Poly Haven that would otherwise be the obvious source are
 * blocked by this environment's egress policy in any case.
 */

/**
 * Side of the whole atlas, in pixels. Four 512 px cells.
 *
 * Doubled from 256. At the old size a leaf was drawn 19-34 px long inside a
 * 256 px cell — a tenth of the card each — so by the time a shrub was two
 * metres across on screen its leaves had merged into one green mass. The
 * shape of an individual leaf is the whole reason this technique works;
 * below a certain relative size it stops being foliage and starts being a
 * cabbage. Four megabytes of texture, uploaded once, is the cheapest fix
 * available to that problem.
 */
const ATLAS_SIZE = 1024;
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
 * One twig: a thin, slightly bowed taper from the cluster's middle outward.
 *
 * Real planting is not a solid ball of leaf. There is woody structure under
 * it, and the glimpses of it through the gaps are a large part of what the
 * eye reads as a plant rather than as a painted volume. These are drawn
 * first and mostly covered; what survives is the point.
 */
function drawTwig(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  length: number,
  width: number,
  fill: string,
): void {
  const bow = (angle % 1) * 0.5 - 0.25;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -width / 2);
  ctx.quadraticCurveTo(length * 0.55, -width * 0.3 + length * bow * 0.25, length, 0);
  ctx.quadraticCurveTo(length * 0.55, width * 0.3 + length * bow * 0.25, 0, width / 2);
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

  // A per-cell outline: nine harmonics of radius against angle.
  //
  // The ceiling of 0.66 matters more than it looks. The first version let
  // the cluster reach the full half-cell, which meant the leaves covered
  // every pixel of the card — so there was no transparency for the alpha
  // test to cut, and every card rendered as an opaque grey rectangle. A
  // foliage card is mostly hole; the cluster has to sit well inside its own
  // tile for the technique to work at all.
  //
  // Three more harmonics than before, at nearly twice the amplitude, and a
  // floor that lets the outline collapse to a third of its reach. Six
  // gentle harmonics still described a disc, and a disc is what made every
  // shrub in the scene read as a topiary ball. A real crown is lopsided:
  // it has a side the light came from and a side it did not.
  const lobes = Array.from({ length: 9 }, () => between(rng, 0.45, 1.0));
  // Each cell is stretched on one axis, so the four variants are not four
  // versions of the same rounded mass.
  const aspect = between(rng, 0.72, 1.24);
  const radiusAt = (angle: number) => {
    let r = 0.5;
    for (let i = 0; i < lobes.length; i += 1) {
      r += Math.cos(angle * (i + 1) + lobes[i]! * 6.283) * 0.062 * lobes[i]!;
    }
    return Math.min(Math.max(r, 0.3), 0.66);
  };

  // A slow angular mask that thins the cluster in two or three places, so
  // sky shows through the crown instead of stopping at its rim.
  const gapPhase = between(rng, 0, 6.283);
  const gapLobes = Math.round(between(rng, 2, 3));
  const gapAt = (angle: number) => 0.34 + 0.66 * Math.abs(Math.cos(angle * gapLobes + gapPhase));

  // Woody structure first. Everything below is drawn over it.
  const twigs = Math.round(between(rng, 9, 16));
  for (let i = 0; i < twigs; i += 1) {
    const angle = (i / twigs) * Math.PI * 2 + between(rng, -0.3, 0.3);
    drawTwig(
      ctx,
      cx,
      cy,
      angle,
      radiusAt(angle) * (CELL / 2) * between(rng, 0.55, 1.0),
      between(rng, 1.6, 3.4),
      `hsl(${between(rng, 28, 46).toFixed(1)} ${between(rng, 14, 26).toFixed(1)}% ${between(rng, 11, 19).toFixed(1)}%)`,
    );
  }

  for (let i = 0; i < leafCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    // Square-root bias fills the middle before the edge; the extra factor
    // pulls a minority of leaves out past the outline as stragglers.
    const t = Math.sqrt(rng()) * (rng() > 0.9 ? 1.1 : 0.94);
    // Thinned where the gap mask is low, so the crown has genuine holes
    // rather than a uniformly dense interior.
    if (rng() > gapAt(angle) + 0.14) continue;

    const reach = radiusAt(angle) * t * (CELL / 2);
    const x = cx + Math.cos(angle) * reach * aspect;
    const y = cy + Math.sin(angle) * reach * (0.9 / aspect);

    // Darker toward the middle: a canopy is lit from outside, and the tonal
    // gradient is what gives a flat card the appearance of depth. The range
    // is far wider than it was — a real crown runs from near-black in its
    // own shadow to a bright rim, and compressing that into twenty-six
    // points of lightness is most of what made these read as flat cut-outs.
    const depth = 1 - t * 0.55;
    const rim = t > 0.82 && rng() > 0.55;
    const hue = (rim ? 71 : 80) + between(rng, -13, 16);
    const sat = (rim ? 34 : 24) + between(rng, -9, 14);
    const light = 9 + (1 - depth) * 44 + (rim ? 9 : 0) + between(rng, -5, 8);

    // Small. Each leaf is now a twentieth of the cell rather than a tenth,
    // which is the difference between reading a plant and reading a mass.
    const length = between(rng, 13, 27) * (0.8 + (1 - t) * 0.34);
    drawLeaf(
      ctx,
      x,
      y,
      length,
      length * between(rng, 0.26, 0.44),
      rng() * Math.PI * 2,
      `hsl(${hue.toFixed(1)} ${sat.toFixed(1)}% ${light.toFixed(1)}%)`,
    );
  }

  ctx.restore();
}

/**
 * The baked sheet, authored by `tools/blender/foliage.py`.
 *
 * Same four cells at the same four offsets, at twice the resolution, with
 * every leaf a real polygon: a width profile that runs to zero at the tip,
 * a curved midrib, and two margins perturbed independently. The canvas
 * below draws a filled quadratic instead, which is a good approximation of
 * a leaf and not a leaf.
 *
 * A manifest rather than a probe, for the reason `ScannedMaps` gives: a
 * missing file resolves asynchronously, long after the material has been
 * built and handed out.
 */
const BAKED_ATLAS = '/assets/foliage/atlas.png';

let atlas: CanvasTexture | null = null;

/**
 * Replaces the canvas the texture was seeded with, once the baked sheet has
 * decoded.
 *
 * The swap is an image swap, not a texture swap. `getFoliageAtlas` is
 * called synchronously from a `useMemo` and its result is written straight
 * into a `MeshStandardMaterial` and a `MeshDepthMaterial`, so handing back a
 * different object later would mean reaching into both — and the depth one
 * is three's own, rebuilt when it feels like it. Keeping one `Texture` and
 * changing what is inside it leaves every reference in the scene correct.
 *
 * The canvas is drawn first regardless, so a slow or failed request costs
 * fidelity and never a frame of invisible planting: an empty texture samples
 * as fully transparent and the alpha test would discard the entire canopy.
 */
function upgradeToBakedAtlas(texture: Texture): void {
  const image = new Image();
  image.onload = () => {
    texture.image = image;
    texture.needsUpdate = true;
  };
  // No handler on failure. The canvas bake is already in the texture and is
  // a complete atlas in its own right; there is nothing to recover to.
  image.src = BAKED_ATLAS;
}

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
    //
    // Counts are roughly four times what they were, which keeps the same
    // coverage now that each leaf covers a quarter of the area. Drawing
    // costs a few tens of milliseconds, once, on a canvas that is never
    // touched again.
    drawCell(ctx, 0, 0, 0x466f4c, 1700);
    drawCell(ctx, CELL, 0, 0x2f5a38, 1500);
    drawCell(ctx, 0, CELL, 0x6a8f52, 900);
    drawCell(ctx, CELL, CELL, 0x3d7a44, 1150);
  }

  atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.magFilter = LinearFilter;
  atlas.minFilter = LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 8;
  atlas.needsUpdate = true;
  upgradeToBakedAtlas(atlas);
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
