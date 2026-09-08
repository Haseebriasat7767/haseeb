import type { DecalSpec } from '../DecalPlanes';
import {
  IDENTITY_ASPECT,
  IDENTITY_LOCKUP,
  IDENTITY_WORDMARK,
  SIGNAGE_ASPECT,
  TENANTS,
  WAYFINDING_ASPECT,
  tenantCell,
  wayfindingCell,
  type WayfindingKey,
} from '../textures/DecalMaps';
import type { BoxSpec } from '../villa/VillaTypes';
import type { TowerLayout, TowerPlan } from './TowerTypes';

/**
 * Where every decal in the tower goes, derived from the building's own plan.
 *
 * Nothing here restates a dimension. The shopfront line, the atrium void, the
 * crown and the colonnade are all read off `TowerPlan`, so re-proportioning
 * the building from `TOWER_CONFIG` moves the signage with it rather than
 * leaving fifty tenant names floating where the facade used to be.
 *
 * ## Facing
 *
 * A plane faces +Z unrotated, so an elevation's outward normal fixes its yaw.
 * The four are collected here rather than written out at each site, because
 * a sign facing into its own wall is invisible and therefore silent.
 */
const FACE = {
  /** Outward normal +Z — the landward elevation. */
  south: 0,
  /** Outward normal −Z. */
  north: Math.PI,
  /** Outward normal +X — the ocean elevation. */
  east: Math.PI / 2,
  /** Outward normal −X — the park elevation. */
  west: -Math.PI / 2,
} as const;

/** How far a decal stands off the surface it is applied to. */
const STANDOFF = 0.07;

/** Deterministic per-site pick, so a shopfront keeps its tenant across mounts. */
function pick(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** World bounds of a set of boxes on one axis — 0 for X, 2 for Z. */
function extent(specs: readonly BoxSpec[], axis: 0 | 2): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const spec of specs) {
    const half = spec.scale[axis] / 2;
    lo = Math.min(lo, spec.position[axis] - half);
    hi = Math.max(hi, spec.position[axis] + half);
  }
  return [lo, hi];
}

function spread(from: number, to: number, count: number): number[] {
  const step = (to - from) / count;
  return Array.from({ length: count }, (_, i) => from + step * (i + 0.5));
}

// ── DEC-01 · shopfront signage ────────────────────────────────────────────

/**
 * Height of a fascia sign's quad, and so — at 44% of the cell — a cap height
 * of about 0.66 m.
 *
 * Sized against the reading distance, not against the shopfront. The first
 * pass used 0.78 m, which is what a real high-street fascia is and which
 * disappeared completely: the ocean elevation is framed from 130 m away,
 * where the whole 64 m podium is 400 px wide and a 0.34 m letter is two
 * pixels tall. A flagship sign on a podium this long runs six metres, and
 * that is what survives the mip chain at the distance this building is
 * actually looked at from.
 */
const SIGN_HEIGHT = 1.5;

/**
 * Tenant names on the retail shopfronts.
 *
 * Ground and first floor only, on all four elevations. Real malls do not sign
 * their upper levels externally — those tenants are read from inside the
 * atrium, which is where the rest of these go. Signing all five would also
 * turn a banded podium into a billboard, and the bands are the facade.
 */
function shopfrontSignage(plan: TowerPlan): DecalSpec[] {
  const { podiumX, podiumZ, podiumLevelHeight } = plan;
  const out: DecalSpec[] = [];

  // The glazing line, which is where a fascia sign actually sits — not on the
  // band, which is only 0.62 m deep and would crop the lettering.
  const inset = 0.8;
  const glassX: [number, number] = [podiumX[0] + inset, podiumX[1] - inset];
  const glassZ: [number, number] = [podiumZ[0] + inset, podiumZ[1] - inset];
  // Held back by the corner radius, exactly as the shopfronts themselves are.
  const pr = 6.7;

  let seed = 0;
  for (const level of [0, 1]) {
    // Just under the head of that level's glazing.
    const y = (level + 1) * podiumLevelHeight - 0.31 - SIGN_HEIGHT * 0.9;

    const runs: [number, [number, number], 'x' | 'z', number, number][] = [
      [glassX[1] + STANDOFF, [glassZ[0] + pr, glassZ[1] - pr], 'z', FACE.east, 2],
      [glassX[0] - STANDOFF, [glassZ[0] + pr, glassZ[1] - pr], 'z', FACE.west, 2],
      [glassZ[1] + STANDOFF, [glassX[0] + pr, glassX[1] - pr], 'x', FACE.south, 3],
      [glassZ[0] - STANDOFF, [glassX[0] + pr, glassX[1] - pr], 'x', FACE.north, 3],
    ];

    for (const [fixed, along, axis, rotationY, count] of runs) {
      for (const at of spread(along[0], along[1], count)) {
        seed += 1;
        const index = Math.floor(pick(seed) * TENANTS.length);
        out.push({
          key: `shop-sign-${level}-${axis}-${at.toFixed(1)}`,
          position: axis === 'z' ? [fixed, y, at] : [at, y, fixed],
          size: [SIGN_HEIGHT * SIGNAGE_ASPECT, SIGN_HEIGHT],
          rotationY,
          cell: tenantCell(index),
        });
      }
    }
  }
  return out;
}

/**
 * Tenant names on the atrium balustrades, one band per upper retail level.
 *
 * This is what a five-storey void is for. From the ground floor looking up,
 * the lit fascias stack away above you and give the space a scale that the
 * geometry alone does not — an empty atrium reads as an architectural model
 * of an atrium.
 */
function atriumSignage(plan: TowerPlan): DecalSpec[] {
  const { atriumX, atriumZ, podiumLevelHeight, podiumLevels } = plan;
  const out: DecalSpec[] = [];
  const height = 0.62;

  let seed = 500;
  for (let level = 1; level < podiumLevels; level += 1) {
    // On the balustrade glass, at its mid-height, facing into the void.
    const y = level * podiumLevelHeight + 0.55;
    const runs: [number, [number, number], 'x' | 'z', number, number][] = [
      // The void's own edges face inward, so these are the reverse of the
      // podium's outward set.
      [atriumZ[0] + STANDOFF, [atriumX[0] + 1.6, atriumX[1] - 1.6], 'x', FACE.south, 2],
      [atriumZ[1] - STANDOFF, [atriumX[0] + 1.6, atriumX[1] - 1.6], 'x', FACE.north, 2],
      [atriumX[0] + STANDOFF, [atriumZ[0] + 1.6, atriumZ[1] - 1.6], 'z', FACE.east, 2],
      [atriumX[1] - STANDOFF, [atriumZ[0] + 1.6, atriumZ[1] - 1.6], 'z', FACE.west, 2],
    ];

    for (const [fixed, along, axis, rotationY, count] of runs) {
      for (const at of spread(along[0], along[1], count)) {
        seed += 1;
        out.push({
          key: `atrium-sign-${level}-${axis}-${at.toFixed(1)}`,
          position: axis === 'z' ? [fixed, y, at] : [at, y, fixed],
          size: [height * SIGNAGE_ASPECT, height],
          rotationY,
          cell: tenantCell(Math.floor(pick(seed) * TENANTS.length)),
        });
      }
    }
  }
  return out;
}

export function createSignageDecals(plan: TowerPlan): DecalSpec[] {
  return [...shopfrontSignage(plan), ...atriumSignage(plan)];
}

// ── DEC-02 · wayfinding ───────────────────────────────────────────────────

const LEVEL_KEYS: WayfindingKey[] = ['01', '02', '03', '04', '05'];

/**
 * Level numbers and direction signs, in and around the atrium.
 *
 * The numerals are the load-bearing ones: a five-storey void with no floor
 * numbers in it is a space nobody can place themselves in, and it is the
 * single cheapest thing that makes a mall read as a mall rather than as
 * stacked slabs.
 */
export function createWayfindingDecals(plan: TowerPlan): DecalSpec[] {
  const { atriumX, atriumZ, podiumLevelHeight, podiumLevels, podiumX, podiumZ } = plan;
  const out: DecalSpec[] = [];

  // From level 1 up. The ground floor's void edge is solid slab, not a
  // balustrade, so a numeral placed there hangs in the air above the lobby;
  // level 01 is signed at the entrance instead, with the lockup.
  const numeral = 0.9;
  for (let level = 1; level < podiumLevels; level += 1) {
    const y = level * podiumLevelHeight + 0.55;
    const key = LEVEL_KEYS[level]!;
    // One numeral at each end of the void's long sides, which is where the
    // eye goes from the escalators.
    for (const [x, rotationY] of [
      [atriumX[0] + 2.4, FACE.south],
      [atriumX[1] - 2.4, FACE.south],
    ] as const) {
      out.push({
        key: `level-${level}-n-${x}`,
        position: [x, y, atriumZ[0] + STANDOFF],
        size: [numeral * WAYFINDING_ASPECT, numeral],
        rotationY,
        cell: wayfindingCell(key),
      });
    }
    out.push({
      key: `level-${level}-w`,
      position: [atriumX[0] + STANDOFF, y, (atriumZ[0] + atriumZ[1]) / 2],
      size: [numeral * WAYFINDING_ASPECT, numeral],
      rotationY: FACE.east,
      cell: wayfindingCell(key),
    });
  }

  // Direction signs at ground level, on the void's south wall where the
  // circulation actually arrives.
  const sign = 0.52;
  const groundY = 3.4;
  const destinations: [WayfindingKey, number][] = [
    ['lift', -2.6],
    ['stair', 0.0],
    ['wc', 2.6],
    ['foodHall', 5.2],
  ];
  for (const [key, offset] of destinations) {
    out.push({
      key: `wayfinding-${key}`,
      position: [(atriumX[0] + atriumX[1]) / 2 + offset, groundY, atriumZ[1] - STANDOFF],
      size: [sign * WAYFINDING_ASPECT, sign],
      rotationY: FACE.north,
      cell: wayfindingCell(key),
    });
  }

  // And on the podium itself, where the plaza meets the building: the two
  // things a visitor arriving from the road is looking for.
  const entry = 0.44;
  out.push({
    key: 'wayfinding-residences',
    position: [podiumX[0] - 0.8 - STANDOFF, 3.9, -8],
    size: [entry * WAYFINDING_ASPECT, entry],
    rotationY: FACE.west,
    cell: wayfindingCell('residences'),
  });
  out.push({
    key: 'wayfinding-level-01',
    position: [podiumX[0] - 0.8 - STANDOFF, 3.9, -12.4],
    size: [entry * WAYFINDING_ASPECT, entry],
    rotationY: FACE.west,
    cell: wayfindingCell('01'),
  });
  out.push({
    key: 'wayfinding-beach',
    position: [podiumX[1] - 0.8 + STANDOFF, 3.9, podiumZ[1] - 11],
    size: [entry * WAYFINDING_ASPECT, entry],
    rotationY: FACE.east,
    cell: wayfindingCell('beach'),
  });
  return out;
}

// ── DEC-04 · project identity ─────────────────────────────────────────────

/**
 * The building's own name: cut into the crown, and set on the lobby wall.
 *
 * The crown lettering is sized against the parapet rather than chosen — it
 * runs 62% of the tower's width, which at this height is the proportion that
 * reads from the beach without turning the top of the building into a sign.
 */
export function createIdentityDecals(layout: TowerLayout): DecalSpec[] {
  const { plan, crown } = layout;
  const { towerZ, towerTopY, crownTopY, podiumX } = plan;
  // Measured off the parapet the lettering is applied to, not off the tower
  // envelope. The setbacks pull the top of the building in by 3.6 m, so a
  // sign placed against `towerX` hangs almost two metres out in mid-air —
  // which is exactly what the first version did, and the reason this reads
  // the geometry instead of restating it.
  const towerX = extent(crown.parapets, 0);
  const width = (towerX[1] - towerX[0]) * 0.74;
  const height = width / IDENTITY_ASPECT;
  const y = (towerTopY + crownTopY) / 2;
  const cx = (towerX[0] + towerX[1]) / 2;

  const out: DecalSpec[] = [
    {
      key: 'crown-ocean',
      // The setbacks pull the top of the tower in; the crown sits at the
      // topmost inset, so the lettering is held off that face and not the
      // original envelope.
      position: [towerX[1] + STANDOFF, y, (towerZ[0] + towerZ[1]) / 2],
      size: [width, height],
      rotationY: FACE.east,
      cell: IDENTITY_WORDMARK,
    },
    {
      key: 'crown-park',
      position: [towerX[0] - STANDOFF, y, (towerZ[0] + towerZ[1]) / 2],
      size: [width, height],
      rotationY: FACE.west,
      cell: IDENTITY_WORDMARK,
    },
    {
      key: 'crown-north',
      position: [cx, y, extent(crown.parapets, 2)[0] - STANDOFF],
      size: [width * 0.72, height * 0.72],
      rotationY: FACE.north,
      cell: IDENTITY_WORDMARK,
    },
  ];

  // The lobby lockup, on the shell behind the colonnade — read on the way in
  // rather than from the road, so it carries the descriptor as well.
  const lockup = 7.4;
  out.push({
    key: 'lobby-lockup',
    position: [podiumX[0] + 0.8 + STANDOFF, 3.5, -2],
    size: [lockup, lockup / IDENTITY_ASPECT],
    rotationY: FACE.west,
    cell: IDENTITY_LOCKUP,
  });
  return out;
}
