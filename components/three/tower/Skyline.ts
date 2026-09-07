import type { BoxSpec, Range } from '../villa/VillaTypes';

/**
 * A city across the water.
 *
 * The single largest thing missing from the tower's views, and it is not a
 * rendering problem — it is a content one. Every photograph of a residence
 * on this coast has a skyline in it. The window is not selling a sea; it is
 * selling a city seen across a sea, at the hour the city lights up and the
 * sun goes down behind it. An empty horizon reads as an island, and an
 * island is a different and much cheaper product.
 *
 * Placed in the same quarter as the low sun, so golden hour puts the sky
 * behind the towers and the towers into silhouette, which is the shot.
 *
 * Deliberately simple geometry: at five hundred metres, through most of a
 * kilometre of haze, a tower is a silhouette with a few lit faces. Anything
 * more is detail nobody can resolve, paid for on every frame.
 */

/** The band the city occupies, in metres. */
// Held clear of the beach on X so the whole city stands across open water,
// and pushed out on Z so it sits five hundred to nine hundred metres off —
// far enough that the haze does most of the modelling for us.
const CITY_X: Range = [150, 820];
const CITY_Z: Range = [420, 900];

/** Where the tall core sits inside that band. */
const CORE_X = 430;
const CORE_Z = 640;
/** How far the core's influence reaches before the city drops to low-rise. */
const CORE_FALLOFF = 260;

const COUNT = 68;

/** Deterministic hash — the city is the same city on every mount. */
function rand(seed: number): number {
  const s = Math.sin(seed * 78.233 + 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export type SkylineLayout = {
  /** The land the city stands on. */
  ground: BoxSpec[];
  /** Tower masses. */
  masses: BoxSpec[];
  /** Lit faces, which come up with the hour. */
  glass: BoxSpec[];
};

export function createSkyline(): SkylineLayout {
  const ground: BoxSpec[] = [];
  const masses: BoxSpec[] = [];
  const glass: BoxSpec[] = [];

  // The spit of land under it. Low and long, so the city has a waterline
  // rather than standing directly out of the sea.
  const groundX: Range = [120, 1040];
  const groundZ: Range = [360, 1320];
  ground.push({
    key: 'city-ground',
    position: [
      (groundX[0] + groundX[1]) / 2,
      0.4,
      (groundZ[0] + groundZ[1]) / 2,
    ],
    scale: [groundX[1] - groundX[0], 2.4, groundZ[1] - groundZ[0]],
  });

  for (let i = 0; i < COUNT; i += 1) {
    const rx = rand(i * 13 + 1);
    const rz = rand(i * 29 + 7);
    const rh = rand(i * 47 + 3);
    const rw = rand(i * 71 + 11);

    const x = CITY_X[0] + rx * (CITY_X[1] - CITY_X[0]);
    const z = CITY_Z[0] + rz * (CITY_Z[1] - CITY_Z[0]);

    // Height falls off with distance from the core, the way a real downtown
    // does — a city of uniformly tall towers reads as a bar chart.
    const reach = Math.hypot(x - CORE_X, z - CORE_Z) / CORE_FALLOFF;
    const core = Math.exp(-reach * reach);
    const height = 22 + core * 150 * (0.45 + rh * 0.55) + rh * 26;

    const width = 16 + rw * 24;
    const depth = 14 + rand(i * 17 + 5) * 22;

    const xr: Range = [x - width / 2, x + width / 2];
    const zr: Range = [z - depth / 2, z + depth / 2];

    masses.push({
      key: `city-${i}`,
      position: [x, height / 2 + 1.2, z],
      scale: [width, height, depth],
    });

    // A setback on the taller ones, which is what gives a skyline its
    // stepped profile rather than a row of equal-topped slabs.
    if (height > 70) {
      const upper = height * (0.16 + rw * 0.16);
      masses.push({
        key: `city-${i}-cap`,
        position: [x, height + 1.2 + upper / 2, z],
        scale: [width * 0.62, upper, depth * 0.62],
      });
    }

    // The seaward face, as a lit plane. At night this is the city; by day
    // it is a slightly different value from the mass, which is enough to
    // stop every tower reading as one flat silhouette.
    glass.push({
      key: `city-${i}-glass`,
      position: [x, height / 2 + 1.2, zr[0] - 0.3],
      scale: [width * 0.86, height * 0.9, 0.6],
    });
    glass.push({
      key: `city-${i}-glass-w`,
      position: [xr[0] - 0.3, height / 2 + 1.2, z],
      scale: [0.6, height * 0.9, depth * 0.86],
    });
  }

  return { ground, masses, glass };
}
