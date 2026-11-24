import type { ModelName } from '../models/ModelLibrary';
import type { TowerPlan } from './TowerTypes';

/**
 * The things that make the site look inhabited rather than surveyed.
 *
 * People, cars, a boat, and the loose furniture on the amenity deck. None
 * of it is architecture and all of it is the difference between a render of
 * a building and a render of a place: a plaza with nobody crossing it and
 * no car on it reads as a massing model however good the facade is, and it
 * reads that way instantly, before a viewer could tell you why.
 *
 * Figures are placed rather than scattered — on the path, at the pool, by
 * the entrance — because people stand where there is a reason to stand.
 */

export type PropPlacement = {
  key: string;
  name: ModelName;
  position: [number, number, number];
  rotationY: number;
  /** Spatial batch, so instancing does not defeat frustum culling. */
  chunk?: string;
};

/** Deterministic hash, matching the rest of the project. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** The park path's centreline, mirroring `Park.pathX`. */
function pathX(z: number, backX: number): number {
  return backX + 15 + Math.sin(z * 0.021) * 7.5 + Math.sin(z * 0.052 + 1.3) * 3.2;
}

export function createSiteProps(plan: TowerPlan, parkBackX: number): PropPlacement[] {
  const out: PropPlacement[] = [];
  const put = (key: string, name: ModelName, x: number, y: number, z: number, yaw: number) => {
    out.push({ key, name, position: [x, y, z], rotationY: yaw });
  };

  // ── On the park path ──────────────────────────────────────────────────
  for (let i = 0; i < 7; i += 1) {
    const z = -70 + i * 26 + (rand(11 + i) - 0.5) * 12;
    const x = pathX(z, parkBackX) + (rand(31 + i) - 0.5) * 2.2;
    put(`walker-${i}`, 'person-standing', x, 0.05, z, rand(53 + i) * Math.PI * 2);
  }

  // ── The plaza: arrival, and two cars at the entrance ───────────────────
  const plazaX = plan.podiumX[0] - 9;
  for (let i = 0; i < 4; i += 1) {
    put(
      `arrival-${i}`,
      'person-standing',
      plazaX + (rand(71 + i) - 0.5) * 9,
      0.05,
      -14 + i * 9 + (rand(97 + i) - 0.5) * 5,
      rand(113 + i) * Math.PI * 2,
    );
  }
  put('car-a', 'car-saloon', plazaX - 5.5, 0.02, 6, Math.PI / 2 + 0.06);
  put('car-b', 'car-suv', plazaX - 5.5, 0.02, 13.5, Math.PI / 2 - 0.04);

  // ── The amenity deck ──────────────────────────────────────────────────
  const deckY = plan.podiumTopY + 0.12;
  put('deck-cabana-a', 'cabana', 10.5, deckY, 14.5, 0);
  put('deck-cabana-b', 'cabana', 10.5, deckY, 4.0, 0);
  put('deck-osofa', 'outdoor-sofa', 8.5, deckY, -9.0, Math.PI / 2);
  // Blender-built timber pergola + string lights over the deck
  // sofa (long axis Z, matching the sofa's pi/2 yaw).
  put('deck-pergola', 'pergola-lights', 8.5, deckY, -9.0, 0);
  put('deck-parasol-a', 'parasol', 17.5, deckY, -1.5, 0);
  put('deck-parasol-b', 'parasol', 17.5, deckY, 15.5, 0);
  // Phase 5: real sun loungers in place of the flat box
  // loungers TowerGeometry used to draw (deck-lounger-* is
  // removed there). West row: backrest west, feet east
  // toward the pool; east row the mirror of it.
  for (let i = 0; i < 4; i += 1) {
    const z = -1.1 + i * 6.4;
    put(`deck-lounger-w-${i}`, 'lounger-white', 18.5, deckY, z, Math.PI / 2);
    put(`deck-lounger-e-${i}`, 'lounger-white', 29.5, deckY, z, -Math.PI / 2);
  }
  // Phase 5: hero palms in the four planters bracketing the
  // pool (planter tops at deckY + 0.85).
  const planterPalms: [number, number][] = [
    [20.1, -4.9],
    [28.7, -4.9],
    [20.1, 21.9],
    [28.7, 21.9],
  ];
  for (let i = 0; i < planterPalms.length; i += 1) {
    const [px, pz] = planterPalms[i]!;
    put(`deck-planter-palm-${i}`, 'palm-hero', px, deckY + 0.85, pz, (i * Math.PI) / 2);
  }
  // Phase 5: clipped hedge runs along the deck's north and
  // south parapets, clear of the roof light and the pool.
  for (let i = 0; i < 5; i += 1) {
    const x = 7.2 + i * 2.4;
    put(`deck-hedge-n-${i}`, 'hedge-row', x, deckY, -20.2, 0);
    put(`deck-hedge-s-${i}`, 'hedge-row', x, deckY, 20.2, 0);
  }
  // Phase 5: deck lanterns flanking the pergola over the sofa.
  put('deck-lantern-w', 'lantern-deck', 6.0, deckY, -11.8, 0);
  put('deck-lantern-e', 'lantern-deck', 11.0, deckY, -11.8, 0);
  put('deck-swimmer', 'person-seated', 18.6, deckY, 5.4, -Math.PI / 2);
  put('deck-guest', 'person-standing', 14.0, deckY, 18.5, Math.PI * 0.8);

  // ── On the water, off the point ───────────────────────────────────────
  put('tender', 'boat-tender', 168, -0.1, -46, Math.PI * 0.16);

  // ── The water edge (boardwalk) ────────────────────────────────────
  // Phase 5: riverside-terrace dressing at the water's edge.
  // The site is oceanfront and has no river channel, so the
  // deck, lights and loungers stand on the boardwalk facing
  // the sea instead (no river water plane was added).
  put('boardwalk-lounger-a', 'lounger-white', 37.0, 0.18, -8.0, Math.PI / 2);
  put('boardwalk-lounger-b', 'lounger-white', 37.0, 0.18, -5.2, Math.PI / 2);
  put('boardwalk-lantern-a', 'lantern-deck', 35.8, 0.18, -9.6, 0);
  put('boardwalk-lantern-b', 'lantern-deck', 35.8, 0.18, -3.6, 0);
  put('boardwalk-palm', 'palm-hero', 39.8, 0.18, -6.6, 0);

  return out;
}
