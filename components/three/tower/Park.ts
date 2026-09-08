import type { BoxSpec, Range } from '../villa/VillaTypes';
import type { PalmSpec } from './TowerTypes';

/**
 * The park between the road and the boardwalk.
 *
 * The land side of the site was a bare plane taking the villa's terrain
 * material, which is fine as a backdrop and wrong as a foreground: on this
 * coast the strip behind the beach is mown lawn under a coconut grove with
 * a path winding through it, and that planting is most of what says where
 * you are. A tower standing on grass reads as a building in a city; a tower
 * standing on nothing reads as a massing model.
 *
 * Pure, like every other layout function here.
 */

/** Deterministic hash, matching the rest of the project. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function palm(key: string, x: number, z: number, y: number, seed: number): PalmSpec {
  const r1 = rand(seed);
  const r2 = rand(seed + 17);
  const r3 = rand(seed + 41);
  return {
    key,
    position: [x, y, z],
    trunkHeight: 7.5 + r1 * 7.5,
    trunkRadius: 0.2 + r2 * 0.09,
    lean: 0.04 + r3 * 0.12,
    leanAngle: r1 * Math.PI * 2,
    frondCount: 10 + Math.floor(r2 * 4),
    frondLength: 2.8 + r3 * 1.6,
    seed,
  };
}

export type ParkLayout = {
  /** The mown ground itself. */
  lawn: BoxSpec[];
  /** Paved path, as overlapping slabs following a curve. */
  path: BoxSpec[];
  /** Kerbs and low retaining to the beds. */
  edging: BoxSpec[];
  /** Beds of low planting either side of the path. */
  beds: BoxSpec[];
  palms: PalmSpec[];
  /** Broadleaf trees, as trunk plus canopy clusters for the card renderer. */
  trees: { trunks: BoxSpec[]; canopy: { key: string; position: [number, number, number]; radius: number; seed: number }[] };
  /** Benches along the path. */
  benches: BoxSpec[];
};

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return { key, position: [mid(x), mid(y), mid(z)], scale: [span(x), span(y), span(z)] };
}

/**
 * The path's centreline, as a function of z.
 *
 * Two sine terms at different wavelengths, because a path laid out on one
 * is a snake and reads as decoration. Real park paths wander because they
 * were desire lines first.
 */
function pathX(z: number, backX: number): number {
  return backX + 15 + Math.sin(z * 0.021) * 7.5 + Math.sin(z * 0.052 + 1.3) * 3.2;
}

export function createParkLayout(
  /** Where the plaza ends and the park begins, on X. */
  backX: number,
  /** How far the park runs along the shore. */
  spanZ: number,
): ParkLayout {
  const lawn: BoxSpec[] = [];
  const path: BoxSpec[] = [];
  const edging: BoxSpec[] = [];
  const beds: BoxSpec[] = [];
  const palms: PalmSpec[] = [];
  const benches: BoxSpec[] = [];
  const trunks: BoxSpec[] = [];
  const canopy: ParkLayout['trees']['canopy'] = [];

  const zRange: Range = [-spanZ / 2, spanZ / 2];
  const parkX: Range = [backX - 46, backX + 34];

  // No lawn slab: the tower scene's ground plane carries the grass itself,
  // so there is no patch to have an edge. The field stays on the layout
  // because the villa's site may want a bounded lawn later.

  const STEP = 2.6;
  const steps = Math.floor(span(zRange) / STEP);

  for (let i = 0; i <= steps; i += 1) {
    const z = zRange[0] + i * STEP;
    const cx = pathX(z, backX);

    // Overlapping slabs, each turned to the local heading, so the path
    // bends rather than stair-stepping.
    const ahead = pathX(z + STEP, backX);
    const heading = Math.atan2(ahead - cx, STEP);
    path.push({
      key: `park-path-${i}`,
      position: [cx, 0.08, z + STEP / 2],
      scale: [2.5, 0.1, STEP * 1.5],
      rotationY: -heading,
    });

    // A bench every so often, set back off the path.
    if (i % 14 === 6) {
      const side = i % 28 === 6 ? -1 : 1;
      benches.push({
        key: `park-bench-${i}`,
        position: [cx + side * 2.4, 0.29, z],
        scale: [0.55, 0.42, 1.8],
        rotationY: -heading,
      });
    }
  }

  // A coconut grove either side of the path, thinning with distance from
  // it — planting that stops dead at a boundary reads as a hedge.
  for (let i = 0; i < 74; i += 1) {
    const r1 = rand(300 + i * 11);
    const r2 = rand(500 + i * 23);
    const r3 = rand(700 + i * 7);
    const z = zRange[0] + r1 * span(zRange);
    const side = r2 > 0.5 ? 1 : -1;
    // Squared falloff clusters them near the path without lining them up.
    const off = 3.4 + r3 * r3 * 30;
    const x = pathX(z, backX) + side * off;
    if (x < parkX[0] + 2 || x > parkX[1] - 2) continue;
    palms.push(palm(`park-palm-${i}`, x, z, 0.05, 2400 + i * 37));
  }

  // A few broadleaf trees for the flowering colour in the reference — the
  // yellow poinciana. Trunk as geometry, crown as clusters the card
  // renderer draws.
  for (let i = 0; i < 11; i += 1) {
    const r1 = rand(900 + i * 19);
    const r2 = rand(1100 + i * 31);
    const z = zRange[0] + 12 + r1 * (span(zRange) - 24);
    const x = pathX(z, backX) + (r2 > 0.5 ? 1 : -1) * (7 + r2 * 16);
    if (x < parkX[0] + 3 || x > parkX[1] - 3) continue;
    const h = 6.5 + r2 * 4.5;
    trunks.push({
      key: `park-trunk-${i}`,
      position: [x, h / 2, z],
      scale: [0.42 + r1 * 0.2, h, 0.42 + r1 * 0.2],
    });
    for (let c = 0; c < 4; c += 1) {
      const rc = rand(1300 + i * 13 + c * 5);
      canopy.push({
        key: `park-canopy-${i}-${c}`,
        position: [x + (rc - 0.5) * 4.4, h + 0.6 + (rand(1500 + i + c) - 0.5) * 2.2, z + (rand(1700 + i + c) - 0.5) * 4.4],
        radius: 2.4 + rc * 1.5,
        seed: 1900 + i * 7 + c,
      });
    }
  }

  // Beds of low planting, held off the path so it never reads as a trench.
  for (let i = 0; i < 16; i += 1) {
    const r1 = rand(2100 + i * 29);
    const z = zRange[0] + 8 + r1 * (span(zRange) - 16);
    const side = i % 2 === 0 ? 1 : -1;
    const x = pathX(z, backX) + side * (4.2 + rand(2300 + i * 17) * 9);
    const w = 3.2 + rand(2500 + i * 11) * 5;
    const d = 2.4 + rand(2700 + i * 13) * 4;
    beds.push(box(`park-bed-${i}`, [x - w / 2, x + w / 2], [0.06, 0.5], [z - d / 2, z + d / 2]));
    edging.push(box(`park-edge-${i}`, [x - w / 2 - 0.12, x + w / 2 + 0.12], [0.05, 0.2], [z - d / 2 - 0.12, z + d / 2 + 0.12]));
  }

  return { lawn, path, edging, beds, palms, trees: { trunks, canopy }, benches };
}
