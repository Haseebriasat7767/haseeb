import { createStair } from './StairGeometry';
import type { WalkFloor } from '@/lib/three/walk-floors';
import type { BoxSpec, ColumnSpec, Range } from '../villa/VillaTypes';
import type {
  PalmSpec,
  ResidentialPlate,
  ShorelineLayout,
  TowerConfig,
  TowerLayout,
  TowerPlan,
} from './TowerTypes';

/**
 * The default tower, in metres.
 *
 * Five retail levels at five metres and fifteen residential at three-four
 * is the brief, and both numbers are ordinary for the building type: retail
 * wants the height for mezzanines and signage, apartments do not. Everything
 * else here is proportion rather than requirement — the podium is wide and
 * low so the tower reads as standing *on* something, and the tower is set
 * toward the landward end so the whole ocean face of the podium roof is
 * left as deck.
 */
/**
 * The entrance doors on the ocean elevation, in Z, and their head height.
 *
 * Centred on the colonnade, five metres wide: a retail podium's main door is
 * not a domestic one, and this is the opening a visitor on foot walks through
 * from the boardwalk. Shared by the shell, the plinth and the shopfront so
 * the three cannot drift apart and leave a doorway with a wall behind it.
 */
export const ENTRANCE_Z: Range = [-2.6, 2.6];
export const ENTRANCE_HEAD = 2.7;

/**
 * The front door of each apartment, in the wall between it and the lobby.
 *
 * Shared with `CoreGeometry`, which hangs the leaf and lines the reveal, so
 * the opening and the joinery in it cannot drift apart.
 */
export const APT_DOOR_Z: Range = [-0.6, 0.6];
export const APT_DOOR_HEIGHT = 2.25;

/**
 * The base: where the building stops and the ground starts.
 *
 * There was no such place. The podium's finished floor sat at zero and the
 * plaza's paving at plus forty millimetres, so the building was fractionally
 * BELOW its own forecourt and met it with no step, no kerb and no plinth —
 * the two surfaces just abutted. That is why the tower looked like it had
 * been dropped onto the site rather than built on it: every real building of
 * this size stands on something, and the height you climb to get in is the
 * first thing that tells you you have arrived.
 *
 * The forecourt drops instead of the building rising, because raising the
 * podium would move fifteen floor levels, a stair and a lift schedule for a
 * 450 mm change of datum.
 */
export const PLAZA_TOP = -0.45;
/** Risers from the forecourt up to the terrace. Three, at 150 mm. */
export const ENTRANCE_RISERS = 3;

export const TOWER_CONFIG: TowerConfig = {
  podiumWidth: 64,
  podiumDepth: 44,
  podiumLevels: 5,
  podiumLevelHeight: 5,
  podiumBandDepth: 0.9,
  podiumBandHeight: 0.62,
  shopfrontInset: 0.8,
  // Set toward the ocean end of the podium, clear of the tower footprint
  // above it, so the void can run all five levels and come out under a
  // roof light in the amenity deck rather than dead-ending at a slab.
  atriumX: [9, 25],
  atriumZ: [-19, -5],
  atriumBalustradeHeight: 1.1,

  towerWidth: 34,
  towerDepth: 22,
  towerLevels: 15,
  towerLevelHeight: 3.4,
  towerOffsetX: -13,
  slabProjection: 0.5,
  slabThickness: 0.34,

  balconyDepth: 2.4,
  balustradeHeight: 1.12,
  bayCount: 8,
  finWidth: 0.26,
  finDepth: 0.5,

  coreWidth: 5,
  // Twelfth residential floor: high enough that the view is the point,
  // low enough that the beach below still reads as a beach.
  furnishedLevel: 11,
  // The banded towers on this coast are rounded rectangles in plan, and
  // they step as they rise. Both are silhouette, which is the half of a
  // facade you read from a distance.
  cornerRadius: 4.2,
  // Generous on the base: a banded podium turns its corner over a much
  // longer radius than the tower does, which is what stops the two reading
  // as the same building at two scales.
  podiumCornerRadius: 7.5,
  // Both steps sit ABOVE the fitted level.
  //
  // Set lower, they shrink the floor plate out from under the apartment —
  // its furniture, its walls and every interior camera are laid out against
  // the full plate, so the camera ends up standing outside the building
  // looking into a solid mass. The stepped silhouette is worth having; it
  // is not worth breaking six framings for.
  setbacks: [
    { level: 12, inset: 1.7 },
    { level: 14, inset: 1.9 },
  ],
  crownHeight: 4,

  columnRadius: 0.42,
  columnCount: 7,

  deckParapetHeight: 1.15,
  poolLength: 22,
  poolWidth: 7,
  poolDepth: 1.5,
};

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

/** A volume from its bounds on each axis, which is how a building is drawn. */
function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return {
    key,
    position: [mid(x), mid(y), mid(z)],
    scale: [span(x), span(y), span(z)],
  };
}

/**
 * A band that rings a rectangular plan — the projecting slab edge that
 * gives both halves of this building their horizontal grain.
 *
 * Written as four bars rather than as a box with a hole because that is
 * what it is: two spanning the full width, two filling between them. The
 * corners meet without overlapping, so the merged geometry has no z-fighting
 * seam where a chamfer would otherwise double up.
 */
function ring(
  out: BoxSpec[],
  key: string,
  x: Range,
  y: Range,
  z: Range,
  thickness: number,
  /** A stretch of the ocean (east) run to leave out — see `roundedRing`. */
  openEastZ?: Range,
): void {
  const innerZ: Range = [z[0] + thickness, z[1] - thickness];
  out.push(box(`${key}-n`, x, y, [z[0], z[0] + thickness]));
  out.push(box(`${key}-s`, x, y, [z[1] - thickness, z[1]]));
  out.push(box(`${key}-w`, [x[0], x[0] + thickness], y, innerZ));
  const eastX: Range = [x[1] - thickness, x[1]];
  if (openEastZ) {
    out.push(box(`${key}-e0`, eastX, y, [innerZ[0], openEastZ[0]]));
    out.push(box(`${key}-e1`, eastX, y, [openEastZ[1], innerZ[1]]));
  } else {
    out.push(box(`${key}-e`, eastX, y, innerZ));
  }
}

/**
 * Boxes stepped along a quarter-circle, each turned to the local tangent.
 *
 * A rounded corner is the whole signature of the banded towers this facade
 * is drawn from, and it cannot be faked with a chamfer: the band has to
 * carry continuously round, holding its own depth, or the building reads as
 * four flat elevations with the corners knocked off.
 *
 * Rotation is `-(t + pi/2)`: a box's local +X maps to `(cos t, -sin t)` in
 * world XZ, and the tangent at angle `t` is `(-sin t, cos t)`, which those
 * two together only satisfy at that angle. Getting it wrong leaves the
 * segments fanned out like a broken zip, which is exactly how it looked
 * the first time.
 */
function arcRun(
  out: BoxSpec[],
  key: string,
  centreX: number,
  centreZ: number,
  radius: number,
  startAngle: number,
  y: Range,
  thickness: number,
  steps: number,
): void {
  const quarter = Math.PI / 2;
  const mid = radius - thickness / 2;
  // Overlapped a little so no seam opens between segments.
  const len = (quarter / steps) * mid * 1.35;

  for (let i = 0; i < steps; i += 1) {
    const t = startAngle + (quarter * (i + 0.5)) / steps;
    out.push({
      key: `${key}-${i}`,
      position: [centreX + Math.cos(t) * mid, (y[0] + y[1]) / 2, centreZ + Math.sin(t) * mid],
      scale: [len, y[1] - y[0], thickness],
      rotationY: -(t + quarter),
    });
  }
}

/**
 * A band ringing a rounded-rectangle plan.
 *
 * The straight runs are held back by the corner radius and the four
 * quarters are stepped round, so the band is continuous the whole way and
 * every segment keeps the same depth.
 */
function roundedRing(
  out: BoxSpec[],
  key: string,
  x: Range,
  y: Range,
  z: Range,
  thickness: number,
  cornerR: number,
  steps = 5,
  /**
   * A stretch of the ocean (east) run to leave out, in Z.
   *
   * A doorway, in other words. The podium shell was a closed ring for its
   * full twenty-five metres, which is right for a massing study and wrong
   * for a building — there was no way in. It only mattered once the camera
   * came off its rails and someone tried to walk through the front of it.
   */
  openEastZ?: Range,
): void {
  const r = Math.max(0, Math.min(cornerR, (x[1] - x[0]) / 2 - 0.01, (z[1] - z[0]) / 2 - 0.01));

  if (r <= thickness) {
    ring(out, key, x, y, z, thickness, openEastZ);
    return;
  }

  const innerX: Range = [x[0] + r, x[1] - r];
  const innerZ: Range = [z[0] + r, z[1] - r];

  out.push(box(`${key}-n`, innerX, y, [z[0], z[0] + thickness]));
  out.push(box(`${key}-s`, innerX, y, [z[1] - thickness, z[1]]));
  out.push(box(`${key}-w`, [x[0], x[0] + thickness], y, innerZ));
  const eastX: Range = [x[1] - thickness, x[1]];
  if (openEastZ) {
    out.push(box(`${key}-e0`, eastX, y, [innerZ[0], openEastZ[0]]));
    out.push(box(`${key}-e1`, eastX, y, [openEastZ[1], innerZ[1]]));
  } else {
    out.push(box(`${key}-e`, eastX, y, innerZ));
  }

  arcRun(out, `${key}-cnw`, x[0] + r, z[0] + r, r, Math.PI, y, thickness, steps);
  arcRun(out, `${key}-cne`, x[1] - r, z[0] + r, r, -Math.PI / 2, y, thickness, steps);
  arcRun(out, `${key}-cse`, x[1] - r, z[1] - r, r, 0, y, thickness, steps);
  arcRun(out, `${key}-csw`, x[0] + r, z[1] - r, r, Math.PI / 2, y, thickness, steps);
}

/**
 * A glazed elevation, divided into bays by vertical mullions.
 *
 * `axis` is the axis the wall runs along; `at` is its position on the other
 * one. One sheet of glass and `bays - 1` mullions, so a forty-metre shopfront
 * costs two entries in two merged meshes rather than forty.
 */
function glazedWall(
  glass: BoxSpec[],
  mullions: BoxSpec[],
  key: string,
  axis: 'x' | 'z',
  along: Range,
  at: number,
  y: Range,
  thickness: number,
  bays: number,
  mullionWidth: number,
  /**
   * How far the mullion stands proud of the glass. A shopfront divider is
   * flush joinery; a residential fin is a projecting blade that reads as a
   * vertical shadow line all the way up the elevation, and the difference
   * between the two is most of what separates a retail base from a tower.
   */
  mullionDepth = thickness,
): void {
  const face: Range = [at - thickness / 2, at + thickness / 2];
  const alongX = axis === 'x';
  // Fins project outward — away from the building centre, which for every
  // elevation here is whichever side of the glass plane faces away from
  // the origin on that axis.
  const outward = Math.sign(at) || 1;

  glass.push(alongX ? box(`${key}-glass`, along, y, face) : box(`${key}-glass`, face, y, along));

  const step = span(along) / bays;
  // Interior divisions only: the corners are already held by the structure.
  for (let i = 1; i < bays; i += 1) {
    const centre = along[0] + step * i;
    const bar: Range = [centre - mullionWidth / 2, centre + mullionWidth / 2];
    const near = at - (thickness / 2) * outward;
    const far = at + mullionDepth * outward;
    const depth: Range = near < far ? [near, far] : [far, near];
    mullions.push(
      alongX ? box(`${key}-mull-${i}`, bar, y, depth) : box(`${key}-mull-${i}`, depth, y, bar),
    );
  }
}

/**
 * A horizontal plate with a rectangular void punched out of it, as four
 * bars. The retail floors, the amenity deck and anything else that has to
 * let something through it are all this shape.
 */
function plateWithHole(
  out: BoxSpec[],
  key: string,
  x: Range,
  y: Range,
  z: Range,
  holeX: Range,
  holeZ: Range,
): void {
  out.push(box(`${key}-n`, x, y, [z[0], holeZ[0]]));
  out.push(box(`${key}-s`, x, y, [holeZ[1], z[1]]));
  out.push(box(`${key}-w`, [x[0], holeX[0]], y, holeZ));
  out.push(box(`${key}-e`, [holeX[1], x[1]], y, holeZ));
}

/** Deterministic hash, so a palm is the same palm on every mount. */
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
    // Real palms on a beach are wildly uneven in height; a row of identical
    // ones is the single fastest way to make planting read as a stamp.
    trunkHeight: 6.5 + r1 * 6,
    // Thinner. At 190-270mm of radius on a twelve-metre trunk these read as
    // telephone poles, and the crown on top of them read as a broom.
    trunkRadius: 0.14 + r2 * 0.06,
    lean: 0.05 + r3 * 0.13,
    leanAngle: r1 * Math.PI * 2,
    // A palm carries twenty-odd live fronds, and at nine the crown reads as
    // a thin spider. Affordable now the frond is a ten-triangle ribbon
    // rather than a twelve-triangle box.
    // You can see the sky through a crown of fifteen. A mature coconut palm
    // carries something like thirty fronds at once.
    frondCount: 27 + Math.floor(r2 * 8),
    // The thing that was most wrong. A coconut frond is four to six metres
    // on a trunk of ten to fifteen — at 2.6 to 4.1 the crown was a tuft on a
    // pole, which is the whole reason these read as brooms rather than palms.
    frondLength: 4.3 + r3 * 1.7,
    seed,
  };
}

/**
 * Builds the whole mixed-use tower from the config.
 *
 * Pure: same config in, same geometry out, no three.js objects and nothing
 * that touches the GPU. Every array it returns is consumed by exactly one
 * merged mesh, which is what keeps a twenty-storey building with fifteen
 * floors of balconies inside the same draw-call budget the villa has.
 */
export function createTowerLayout(config: TowerConfig = TOWER_CONFIG): TowerLayout {
  const {
    podiumWidth,
    podiumDepth,
    podiumLevels,
    podiumLevelHeight,
    podiumBandDepth,
    podiumBandHeight,
    shopfrontInset,
    atriumX,
    atriumZ,
    atriumBalustradeHeight,
    towerWidth,
    towerDepth,
    towerLevels,
    towerLevelHeight,
    towerOffsetX,
    slabProjection,
    slabThickness,
    balconyDepth,
    balustradeHeight,
    bayCount,
    finWidth,
    finDepth,
    coreWidth,
    furnishedLevel,
    cornerRadius,
    podiumCornerRadius,
    setbacks,
    crownHeight,
    columnRadius,
    columnCount,
    deckParapetHeight,
    poolLength,
    poolWidth,
    poolDepth,
  } = config;

  const podiumX: Range = [-podiumWidth / 2, podiumWidth / 2];
  const podiumZ: Range = [-podiumDepth / 2, podiumDepth / 2];
  const podiumTopY = podiumLevels * podiumLevelHeight;

  const towerX: Range = [towerOffsetX - towerWidth / 2, towerOffsetX + towerWidth / 2];
  const towerZ: Range = [-towerDepth / 2, towerDepth / 2];
  const towerBaseY = podiumTopY;
  const towerTopY = towerBaseY + towerLevels * towerLevelHeight;
  const crownTopY = towerTopY + crownHeight;

  const plan: TowerPlan = {
    podiumX,
    podiumZ,
    podiumTopY,
    towerX,
    towerZ,
    towerBaseY,
    towerTopY,
    crownTopY,
    seaFrontX: podiumX[1],
    deckBackX: towerX[1],
    levelHeight: towerLevelHeight,
    furnishedLevel,
    furnishedFloorY: towerBaseY + furnishedLevel * towerLevelHeight + slabThickness,
    // The plaster soffit under the plate above, not the plate itself.
    furnishedCeilingY: towerBaseY + (furnishedLevel + 1) * towerLevelHeight - 0.09,
    glazedX: [towerX[0] + coreWidth, towerX[1]],
    atriumX,
    atriumZ,
    podiumLevels,
    podiumLevelHeight,
    levelY: (level: number) => towerBaseY + level * towerLevelHeight,
  };

  // ── Podium ────────────────────────────────────────────────────────────

  const mass: BoxSpec[] = [];
  const floors: BoxSpec[] = [];
  const bands: BoxSpec[] = [];
  const podiumGlass: BoxSpec[] = [];
  const mullions: BoxSpec[] = [];
  const soffits: BoxSpec[] = [];
  const signage: BoxSpec[] = [];
  const balustrades: BoxSpec[] = [];
  const podiumRails: BoxSpec[] = [];
  const skylight: BoxSpec[] = [];
  const coves: BoxSpec[] = [];

  const innerX: Range = [podiumX[0] + shopfrontInset, podiumX[1] - shopfrontInset];
  const innerZ: Range = [podiumZ[0] + shopfrontInset, podiumZ[1] - shopfrontInset];

  // The stair shaft, declared here because both halves of the building have
  // to agree about it: the podium plates are punched around it and the
  // tower's service blade is hollowed out to become it. One shaft from the
  // pavement to the top floor, which is what a fire stair is.
  const coreXFull: Range = [towerX[0], towerX[0] + coreWidth];
  const stairZ: Range = [3.2, towerZ[1] - 0.6];
  const stairX: Range = coreXFull;

  // The shell behind the shopfronts. A ring rather than a solid block: the
  // retail levels are a real volume you can stand inside, and filling them
  // with stone would make the whole podium a prop that only works from
  // outside — which is exactly what a five-storey mall must not be.
  // Built in two lifts so the ocean elevation can be opened at street level:
  // the ring is closed above the door head and split around the doors below
  // it. Two extra boxes, and the difference between a building you can enter
  // and a solid drum with shopfronts painted on it.
  roundedRing(
    mass,
    'podium-shell',
    innerX,
    [ENTRANCE_HEAD, podiumTopY],
    innerZ,
    0.45,
    podiumCornerRadius - shopfrontInset,
    7,
  );
  roundedRing(
    mass,
    'podium-shell-base',
    innerX,
    [0, ENTRANCE_HEAD],
    innerZ,
    0.45,
    podiumCornerRadius - shopfrontInset,
    7,
    ENTRANCE_Z,
  );

  // Ground floor, solid: the atrium void starts above it.
  floors.push(box('podium-floor-0', innerX, [-0.2, 0], innerZ));
  // The ground slab is solid — the stair starts on it rather than through it.

  /** A floor plate with the atrium punched out of it. */
  const plate = (key: string, y: Range): void => {
    floors.push(box(`${key}-n`, innerX, y, [innerZ[0], atriumZ[0]]));
    // The southern band carries the stair shaft, so it is split around it as
    // well. A plate with no hole in it is a stair that arrives at a ceiling.
    floors.push(box(`${key}-s0`, innerX, y, [atriumZ[1], stairZ[0]]));
    floors.push(box(`${key}-s1`, innerX, y, [stairZ[1], innerZ[1]]));
    floors.push(box(`${key}-s2`, [innerX[0], stairX[0]], y, stairZ));
    floors.push(box(`${key}-s3`, [stairX[1], innerX[1]], y, stairZ));
    floors.push(box(`${key}-w`, [innerX[0], atriumX[0]], y, atriumZ));
    floors.push(box(`${key}-e`, [atriumX[1], innerX[1]], y, atriumZ));
  };

  for (let level = 1; level < podiumLevels; level += 1) {
    const y = level * podiumLevelHeight;
    plate(`podium-floor-${level}`, [y - 0.35, y]);

    // Frameless glass at the void edge, with a capping rail — the same
    // detail the balconies use, because it is the same condition.
    const railY: Range = [y, y + atriumBalustradeHeight];
    ring(balustrades, `atrium-glass-${level}`, atriumX, railY, atriumZ, 0.05);
    ring(podiumRails, `atrium-rail-${level}`, atriumX, [railY[1], railY[1] + 0.07], atriumZ, 0.1);

    // A lit cove running the void edge on the underside of each plate. In a
    // real mall this is most of the light in the space, and it is what makes
    // the atrium read as five stacked lines of light from the ground floor.
    ring(
      coves,
      `atrium-cove-${level}`,
      [atriumX[0] - 0.7, atriumX[1] + 0.7],
      [y - 0.5, y - 0.36],
      [atriumZ[0] - 0.7, atriumZ[1] + 0.7],
      0.5,
    );
  }

  // The podium roof, as a plate like every other — punched for the atrium so
  // the roof light still reaches the ground floor.
  //
  // Missing entirely until the cinema level was given a camera to be seen
  // from. The plate loop above stops one short of the top, which is right for
  // FLOORS — nobody stands on the podium roof from inside — but it left the
  // uppermost retail level with no ceiling at all, so from the foyer you
  // looked straight up past the parapet at the pool, the parasols and the
  // palms on the deck. An empty level hides that; a furnished one with a
  // camera in it does not.
  plate('podium-roof', [podiumTopY - 0.35, podiumTopY]);

  // The roof light. Set into the amenity deck above, so the atrium is
  // daylit from the top for the whole five storeys — and so the deck has a
  // lantern glowing in it after dark.
  skylight.push(
    box(
      'atrium-skylight',
      [atriumX[0] - 0.4, atriumX[1] + 0.4],
      [podiumTopY + 0.12, podiumTopY + 0.22],
      [atriumZ[0] - 0.4, atriumZ[1] + 0.4],
    ),
  );

  // Six bands: one at grade, one at each floor, one capping the roof. The
  // cap is deeper — it is the edge the whole deck sits behind, and at
  // twenty-five metres a thin one disappears.
  for (let level = 0; level <= podiumLevels; level += 1) {
    const y = level * podiumLevelHeight;
    const cap = level === podiumLevels;
    const height = cap ? podiumBandHeight * 1.9 : podiumBandHeight;
    roundedRing(
      bands,
      `podium-band-${level}`,
      podiumX,
      [y - (level === 0 ? 0 : height / 2), y + (level === 0 ? height : height / 2)],
      podiumZ,
      podiumBandDepth,
      podiumCornerRadius,
      7,
      // The band at grade is a plinth. Carried across the doors it would be
      // a 620mm kerb in the entrance, which is not a threshold, it is a trip.
      level === 0 ? ENTRANCE_Z : undefined,
    );

    // A lit reveal tucked under every band. This is the detail that makes
    // the podium read at night: the retail levels become five stacked lines
    // of light rather than a dark block under a lit tower.
    if (level > 0) {
      const glowY: Range = [y - height / 2 - 0.16, y - height / 2 - 0.04];
      roundedRing(
        signage,
        `podium-glow-${level}`,
        podiumX,
        glowY,
        podiumZ,
        podiumBandDepth * 0.55,
        podiumCornerRadius,
        7,
      );
    }
  }

  // Shopfronts, one glazed band per retail level on all four elevations.
  for (let level = 0; level < podiumLevels; level += 1) {
    const y0 = level * podiumLevelHeight + (level === 0 ? podiumBandHeight : podiumBandHeight / 2);
    const y1 = (level + 1) * podiumLevelHeight - podiumBandHeight / 2;
    const y: Range = [y0, y1];

    // Held back by the corner radius, with the glazing carried round the
    // four quarters so the shopfront ribbon is continuous like the bands.
    const pr = podiumCornerRadius - shopfrontInset;
    const shopZ: Range = [innerZ[0] + pr, innerZ[1] - pr];
    const shopX: Range = [innerX[0] + pr, innerX[1] - pr];

    if (level === 0) {
      // The entrance. Glass either side of the opening for its full height,
      // and a transom over it — the doors themselves are the void.
      glazedWall(podiumGlass, mullions, `shop-e-0a`, 'z', [shopZ[0], ENTRANCE_Z[0]], innerX[1], y, 0.1, 3, 0.16); // prettier-ignore
      glazedWall(podiumGlass, mullions, `shop-e-0b`, 'z', [ENTRANCE_Z[1], shopZ[1]], innerX[1], y, 0.1, 3, 0.16); // prettier-ignore
      glazedWall(podiumGlass, mullions, `shop-e-0t`, 'z', ENTRANCE_Z, innerX[1], [ENTRANCE_HEAD, y[1]], 0.1, 2, 0.16); // prettier-ignore
    } else {
      glazedWall(podiumGlass, mullions, `shop-e-${level}`, 'z', shopZ, innerX[1], y, 0.1, 7, 0.16);
    }
    glazedWall(podiumGlass, mullions, `shop-w-${level}`, 'z', shopZ, innerX[0], y, 0.1, 7, 0.16);
    glazedWall(podiumGlass, mullions, `shop-s-${level}`, 'x', shopX, innerZ[1], y, 0.1, 11, 0.16);
    glazedWall(podiumGlass, mullions, `shop-n-${level}`, 'x', shopX, innerZ[0], y, 0.1, 11, 0.16);

    for (const [ck, cx, cz, a0] of [
      ['nw', innerX[0] + pr, innerZ[0] + pr, Math.PI],
      ['ne', innerX[1] - pr, innerZ[0] + pr, -Math.PI / 2],
      ['se', innerX[1] - pr, innerZ[1] - pr, 0],
      ['sw', innerX[0] + pr, innerZ[1] - pr, Math.PI / 2],
    ] as const) {
      arcRun(podiumGlass, `shop-c-${level}-${ck}`, cx, cz, pr, a0, y, 0.1, 7);
    }
  }

  // ── The base ──────────────────────────────────────────────────────────
  const terrace: BoxSpec[] = [];
  const steps: BoxSpec[] = [];
  const seatWalls: BoxSpec[] = [];
  const portal: BoxSpec[] = [];

  // A terrace the building stands on, projecting furthest on the ocean side
  // where the colonnade and the doors are.
  const eastReach = 7.2;
  const sideReach = 3.0;
  const terraceX: Range = [podiumX[0] - sideReach, podiumX[1] + eastReach];
  const terraceZ: Range = [podiumZ[0] - sideReach, podiumZ[1] + sideReach];
  terrace.push(box('terrace', terraceX, [PLAZA_TOP - 0.35, 0], terraceZ));

  // The flight up to it, running the full width of the colonnade. A grand
  // stair rather than three steps at the door: this is the elevation the
  // building is approached from, and the climb is the arrival.
  const riser = -PLAZA_TOP / ENTRANCE_RISERS;
  const going = 0.44;
  const flightZ: Range = [podiumZ[0] + 2, podiumZ[1] - 2];
  for (let i = 0; i < ENTRANCE_RISERS; i += 1) {
    const y = PLAZA_TOP + riser * (i + 1);
    const x0 = terraceX[1] - going * (ENTRANCE_RISERS - i);
    steps.push(box(`entry-step-${i}`, [x0, terraceX[1]], [y - riser - 0.3, y], flightZ));
  }

  // Seat walls either side of the flight, and along the terrace edge.
  //
  // Deliberately thick rather than tall. The collider gives a wall's
  // thickness to anything tall and thin so glass can stop somebody, and it
  // leaves low things alone so a stair tread is not swallowed — which means a
  // 500 mm wall has to be wide enough to stop a visitor on its own.
  const seatH: Range = [0, 0.52];
  const seatT = 0.7;
  for (const [tag, z] of [
    ['n', flightZ[0]],
    ['s', flightZ[1]],
  ] as const) {
    seatWalls.push(
      box(
        `entry-cheek-${tag}`,
        [terraceX[1] - going * ENTRANCE_RISERS - 0.2, terraceX[1] + 0.1],
        [PLAZA_TOP, 0.52],
        tag === 'n' ? [z - seatT, z] : [z, z + seatT],
      ),
    );
  }
  // The terrace edge on the three sides with no stair, so the platform reads
  // as a platform and not as paving that happens to be higher.
  seatWalls.push(box('terrace-edge-n', terraceX, seatH, [terraceZ[0], terraceZ[0] + seatT]));
  seatWalls.push(box('terrace-edge-s', terraceX, seatH, [terraceZ[1] - seatT, terraceZ[1]]));
  seatWalls.push(box('terrace-edge-w', [terraceX[0], terraceX[0] + seatT], seatH, terraceZ));

  // ── The front door ────────────────────────────────────────────────────
  //
  // There was an opening. An opening is not an entrance: a hole the same
  // width as a shop window, in the same plane as the glass either side of it,
  // with nothing marking it. The main door of a twenty-storey building is
  // supposed to be findable from the far side of the forecourt.
  const portalFace = innerX[1];
  const portalOut = 0.34;
  const portalHead = ENTRANCE_HEAD + 0.5;
  for (const [tag, z] of [
    ['n', ENTRANCE_Z[0]],
    ['s', ENTRANCE_Z[1]],
  ] as const) {
    portal.push(
      box(
        `portal-jamb-${tag}`,
        [portalFace - 0.1, portalFace + portalOut],
        [0, portalHead],
        tag === 'n' ? [z - 0.42, z] : [z, z + 0.42],
      ),
    );
  }
  portal.push(
    box(
      'portal-head',
      [portalFace - 0.1, portalFace + portalOut],
      [ENTRANCE_HEAD, portalHead],
      [ENTRANCE_Z[0] - 0.42, ENTRANCE_Z[1] + 0.42],
    ),
  );

  // The colonnade at the ocean entrance, and the deep soffit it holds up.
  const columns: ColumnSpec[] = [];
  const colonnadeX = podiumX[1] - 1.4;
  const colonnadeTop = podiumLevelHeight - podiumBandHeight / 2;
  for (let i = 0; i < columnCount; i += 1) {
    const t = columnCount === 1 ? 0.5 : i / (columnCount - 1);
    const z = podiumZ[0] + 4 + t * (span(podiumZ) - 8);
    columns.push({
      key: `podium-column-${i}`,
      position: [colonnadeX, colonnadeTop / 2, z],
      scale: [columnRadius, colonnadeTop / 2, columnRadius],
    });
  }
  soffits.push(
    box(
      'podium-soffit',
      [colonnadeX - 1.6, podiumX[1]],
      [colonnadeTop - 0.05, colonnadeTop],
      [podiumZ[0] + 2, podiumZ[1] - 2],
    ),
  );

  // ── Residential tower ─────────────────────────────────────────────────

  const core: BoxSpec[] = [];
  const slabs: BoxSpec[] = [];
  const plates: BoxSpec[] = [];
  const ceilings: BoxSpec[] = [];
  const towerGlass: BoxSpec[] = [];
  const fins: BoxSpec[] = [];
  const spandrels: BoxSpec[] = [];
  const residentialPlates: ResidentialPlate[] = [];
  const balconySlabs: BoxSpec[] = [];
  const balconyGlass: BoxSpec[] = [];
  const balconyRails: BoxSpec[] = [];

  const coreX: Range = [towerX[0], towerX[0] + coreWidth];
  const glazedX: Range = [coreX[1], towerX[1]];

  // The service blade, full height, and deliberately reading as a different
  // material from the glass it braces.
  //
  // Hollowed through the middle for the lift lobby. Solid, it was structurally
  // honest and architecturally impossible: fifteen floors of apartments with
  // no way into any of them, and the walkthrough stepping from a spa on level
  // one straight into a living room on level twelve with nothing in between.
  // The blade keeps its two ends — lifts in one, the escape stair in the other
  // — and gives up the six metres between them.
  const coreZ: Range = [towerZ[0] + 0.6, towerZ[1] - 0.6];
  const lobbyZ: Range = [-3.2, 3.2];
  const coreWall = 0.35;
  core.push(box('tower-core-n', coreX, [towerBaseY, crownTopY], [coreZ[0], lobbyZ[0]]));
  // The south end of the blade is no longer solid: it is the stair shaft, and
  // it now starts at the pavement rather than at the podium roof. `createStair`
  // supplies its walls, so pushing a box here as well would fill it back in.
  core.push(box('tower-core-w', [coreX[0], coreX[0] + coreWall], [towerBaseY, crownTopY], lobbyZ));
  // The wall between the lobby and the apartment beyond it, with a front
  // door in it on every residential level.
  //
  // It was solid. The lift lobby was built to fix exactly this on the
  // vertical axis — fifteen floors with no way between them — and left the
  // horizontal one alone, which was invisible while the camera was on rails
  // and became the whole problem the moment the lift would take a visitor to
  // any floor: you arrived in a lobby with two lift doors, a rug, and no way
  // into the flat you had come to see.
  const eastWallX: Range = [coreX[1] - coreWall, coreX[1]];
  core.push(box('tower-core-e-n', eastWallX, [towerBaseY, crownTopY], [lobbyZ[0], APT_DOOR_Z[0]]));
  core.push(box('tower-core-e-s', eastWallX, [towerBaseY, crownTopY], [APT_DOOR_Z[1], lobbyZ[1]]));
  {
    // The strip of wall the doors are cut out of: over each opening and under
    // the next, all the way up.
    let y = towerBaseY;
    for (let level = 0; level < towerLevels; level += 1) {
      const floor = plan.levelY(level) + slabThickness;
      if (floor > y) core.push(box(`tower-core-e-u${level}`, eastWallX, [y, floor], APT_DOOR_Z));
      y = floor + APT_DOOR_HEIGHT;
    }
    if (crownTopY > y) core.push(box('tower-core-e-top', eastWallX, [y, crownTopY], APT_DOOR_Z));
  }

  // The stair. Every floor a person can stand on, from the pavement to the
  // top residential level: five podium storeys at 5m, then fifteen at 3.4m.
  // The podium's finished floors sit at the top of their plates and the
  // tower's at the top of their slabs, which is why these are two lists.
  const stairLevels = [
    ...Array.from({ length: podiumLevels }, (_, level) => level * podiumLevelHeight),
    ...Array.from({ length: towerLevels }, (_, level) => plan.levelY(level) + slabThickness),
  ];
  const stair = createStair({
    key: 'stair',
    x: stairX,
    z: stairZ,
    wall: coreWall,
    levels: stairLevels,
    topY: crownTopY,
    // The doors open north, into the lift lobby on every residential level
    // and into the retail floor on every podium one.
    doorEnd: 'min',
  });

  // Where the lift will put you. Derived from the same numbers the stair is,
  // so the picker can never offer a floor the building does not have.
  const shaftCentreX = mid(stair.doorX);
  const lobbyCentreX = mid([coreX[0] + coreWall, coreX[1] - coreWall] as Range);
  const walkFloors: WalkFloor[] = [
    ...Array.from({ length: podiumLevels }, (_, level) => ({
      id: `podium-${level}`,
      label: level === 0 ? 'Ground floor' : `Retail level ${level + 1}`,
      // On the retail floors there is no lift lobby, so you arrive on the
      // shop floor a stride outside the stair door, facing it.
      position: [shaftCentreX, level * podiumLevelHeight, stairZ[0] - 1.3] as const,
      heading: Math.PI,
    })),
    ...Array.from({ length: towerLevels }, (_, level) => ({
      id: `tower-${level}`,
      label:
        level === 0
          ? 'Amenity deck'
          : level === furnishedLevel
            ? `Residence ${level} — the fitted home`
            : `Residence ${level}`,
      // In the lift lobby, facing the flat's own front door.
      //
      // Facing the lift doors is what a lift actually does to you and it is
      // the wrong thing here: you arrive looking at the inside of the doors
      // you came out of, and the flat you pressed the button for is behind
      // you. Turned east, the first thing in frame is the way in.
      position: [lobbyCentreX, plan.levelY(level) + slabThickness, 0] as const,
      heading: -Math.PI / 2,
    })),
  ];

  // ── The blade's elevation ─────────────────────────────────────────────
  //
  // The service core is the one part of this building with no window in it,
  // and it was drawn as a single stone box fifty-five metres tall. From the
  // arrival camera that is a blank grey slab beside a glass tower — the
  // building's worst elevation by a distance, and the reason the whole thing
  // read as a massing study from the west.
  //
  // A stone elevation of this size is never one plane. It is panelised, and
  // what you actually see at two hundred metres is the shadow in the joints:
  // a vertical rhythm that gives the blade a grain, and a horizontal one at
  // every floor that ties it to the glass beside it. Both are shallow
  // reveals, which is what a real drained-and-backventilated stone facade
  // gives you, and neither costs more than a thin box.
  // Concrete, not bronze. The first version put these in `fins`, which is the
  // bronze mesh, and a joint grid in polished metal on a stone blade reads as
  // a cage bolted to the building rather than as the way the stone is hung.
  const REVEAL = 0.05;
  /** How far a joint stands off the face. Enough to throw a line of shadow. */
  const PROUD = 0.035;
  const bladeTop = crownTopY;
  // Vertical joints down the west face, at a panel width that divides the
  // blade evenly rather than a round number that leaves a sliver at one end.
  const bladePanels = 7;
  for (let i = 1; i < bladePanels; i += 1) {
    const z = coreZ[0] + (span(coreZ) / bladePanels) * i;
    spandrels.push(
      box(
        `blade-joint-v-${i}`,
        [towerX[0] - PROUD, towerX[0] + 0.01],
        [towerBaseY, bladeTop],
        [z - REVEAL / 2, z + REVEAL / 2],
      ),
    );
  }
  // And the same on the two return faces, so the blade reads as one panelised
  // object turning a corner rather than a decorated front with plain sides.
  for (const [tag, zr] of [
    ['n', [coreZ[0] - PROUD, coreZ[0] + 0.01]],
    ['s', [coreZ[1] - 0.01, coreZ[1] + PROUD]],
  ] as const) {
    for (let i = 1; i < 3; i += 1) {
      const x = coreX[0] + (coreWidth / 3) * i;
      spandrels.push(
        box(
          `blade-joint-${tag}-${i}`,
          [x - REVEAL / 2, x + REVEAL / 2],
          [towerBaseY, bladeTop],
          zr,
        ),
      );
    }
  }
  // A horizontal joint at every floor line, carried round all three faces.
  for (let level = 1; level < towerLevels; level += 1) {
    const y = plan.levelY(level);
    const jointY: Range = [y - REVEAL / 2, y + REVEAL / 2];
    spandrels.push(
      box(`blade-joint-h-w-${level}`, [towerX[0] - PROUD, towerX[0] + 0.01], jointY, coreZ),
    );
    spandrels.push(
      box(`blade-joint-h-n-${level}`, coreX, jointY, [coreZ[0] - PROUD, coreZ[0] + 0.01]),
    );
    spandrels.push(
      box(`blade-joint-h-s-${level}`, coreX, jointY, [coreZ[1] - 0.01, coreZ[1] + PROUD]),
    );
  }

  /** How far the tower has stepped in by a given level. */
  const insetAt = (level: number) =>
    setbacks.reduce((sum, s) => (level >= s.level ? sum + s.inset : sum), 0);

  for (let level = 0; level < towerLevels; level += 1) {
    const y = plan.levelY(level);
    const nextY = plan.levelY(level + 1);

    const inset = insetAt(level);
    const lx: Range = [towerX[0] + inset, towerX[1] - inset];
    const lz: Range = [towerZ[0] + inset, towerZ[1] - inset];
    const lSlabX: Range = [lx[0] - slabProjection, lx[1] + slabProjection];
    const lSlabZ: Range = [lz[0] - slabProjection, lz[1] + slabProjection];
    const lGlazedX: Range = [Math.max(glazedX[0], lx[0]), lx[1]];

    // The floor plate, expressed all the way round a rounded plan. Stop the
    // band at a corner and the tower reads as four flat elevations bolted
    // together; carry it round and the whole thing becomes one object.
    roundedRing(
      slabs,
      `tower-slab-${level}`,
      lSlabX,
      [y, y + slabThickness],
      lSlabZ,
      1.1,
      cornerRadius + slabProjection,
    );

    // Glazing wrapping the same corners, so the ribbon is continuous.
    const glazeY: Range = [y + slabThickness, nextY];
    for (const [ck, cx, cz, a0] of [
      ['nw', lx[0] + cornerRadius, lz[0] + cornerRadius, Math.PI],
      ['ne', lx[1] - cornerRadius, lz[0] + cornerRadius, -Math.PI / 2],
      ['se', lx[1] - cornerRadius, lz[1] - cornerRadius, 0],
      ['sw', lx[0] + cornerRadius, lz[1] - cornerRadius, Math.PI / 2],
    ] as const) {
      arcRun(towerGlass, `tower-cglass-${level}-${ck}`, cx, cz, cornerRadius, a0, glazeY, 0.09, 5);
    }

    // The plate itself, spanning the apartment. The band above is only the
    // expressed edge of it; without this the residential floors are a glass
    // shell with nothing to stand on, which is exactly what the interior
    // camera on level twelve would have looked down into.
    plates.push(box(`tower-plate-${level}`, lGlazedX, [y, y + slabThickness], lz));
    // The dimensions a fit-out has to live inside, published rather than
    // recomputed. The tower steps in twice on the way up, so the top three
    // plates are smaller than the rest, and an apartment laid out to the
    // full plate would have its kitchen hanging in mid air.
    residentialPlates.push({
      level,
      x: lGlazedX,
      z: lz,
      floorY: y + slabThickness,
      ceilingY: nextY - 0.09,
    });
    // And the lobby's own floor, inside the hollowed core. The plate above
    // spans the apartment only, so without this the lift lobby is a shaft.
    plates.push(
      box(
        `tower-lobby-plate-${level}`,
        [coreX[0] + coreWall, coreX[1] - coreWall],
        [y, y + slabThickness],
        lobbyZ,
      ),
    );
    // The plaster soffit under the plate above. Without it the apartment
    // ceiling is the polished underside of a stone floor, which is why the
    // first interior render came back as a marble slot.
    if (level > 0) {
      ceilings.push(box(`tower-ceiling-${level}`, lGlazedX, [y - 0.09, y], lz));
      ceilings.push(
        box(
          `tower-lobby-ceiling-${level}`,
          [coreX[0] + coreWall, coreX[1] - coreWall],
          [y - 0.09, y],
          lobbyZ,
        ),
      );
    }

    const glassY: Range = glazeY;
    const straightZ: Range = [lz[0] + cornerRadius, lz[1] - cornerRadius];
    const straightX: Range = [Math.max(lGlazedX[0], lx[0] + cornerRadius), lx[1] - cornerRadius];

    glazedWall(
      towerGlass,
      fins,
      `tower-e-${level}`,
      'z',
      straightZ,
      lx[1],
      glassY,
      0.09,
      bayCount,
      finWidth,
      finDepth,
    );
    glazedWall(
      towerGlass,
      fins,
      `tower-s-${level}`,
      'x',
      straightX,
      lz[1],
      glassY,
      0.09,
      6,
      finWidth,
      finDepth,
    );
    glazedWall(
      towerGlass,
      fins,
      `tower-n-${level}`,
      'x',
      straightX,
      lz[0],
      glassY,
      0.09,
      6,
      finWidth,
      finDepth,
    );

    // A low upstand behind the balustrade, so the floor line stays solid
    // where a room meets a balcony.
    spandrels.push(
      box(
        `tower-spandrel-${level}`,
        [lx[1] - 0.12, lx[1] + 0.06],
        [y + slabThickness, y + slabThickness + 0.45],
        straightZ,
      ),
    );

    // ── Balconies ───────────────────────────────────────────────────────
    // The ocean elevation only, and held inside the corner radius.
    //
    // They used to wrap all four sides and return round both ends, which is
    // a fine tower and not this one: the banded reference has no projecting
    // balconies at all, and a balcony crossing a rounded corner destroys
    // the one line the whole facade is built on. Keeping them on the view
    // elevation keeps the outside space a resident is actually buying while
    // leaving the other three sides as continuous ribbon.
    const balconyOuterX = lx[1] + balconyDepth;
    const balconyZ: Range = straightZ;

    balconySlabs.push(
      box(`balcony-slab-${level}`, [lx[1], balconyOuterX], [y, y + slabThickness], balconyZ),
    );

    const railY: Range = [y + slabThickness, y + slabThickness + balustradeHeight];
    // Frameless glass on three sides of the balcony.
    balconyGlass.push(
      box(`balcony-glass-e-${level}`, [balconyOuterX - 0.04, balconyOuterX], railY, balconyZ),
    );
    balconyGlass.push(
      box(`balcony-glass-n-${level}`, [lx[1], balconyOuterX], railY, [
        balconyZ[0],
        balconyZ[0] + 0.04,
      ]),
    );
    balconyGlass.push(
      box(`balcony-glass-s-${level}`, [lx[1], balconyOuterX], railY, [
        balconyZ[1] - 0.04,
        balconyZ[1],
      ]),
    );

    // The capping rail, which is what stops frameless glass reading as a
    // sheet of blue plastic stuck to the slab.
    const capY: Range = [railY[1], railY[1] + 0.07];
    ring(balconyRails, `balcony-rail-${level}`, [lx[1], balconyOuterX], capY, balconyZ, 0.09);
  }

  // ── Crown ─────────────────────────────────────────────────────────────

  const parapets: BoxSpec[] = [];
  const crownGlow: BoxSpec[] = [];

  const topInset = insetAt(towerLevels - 1);
  const topX: Range = [towerX[0] + topInset, towerX[1] - topInset];
  const topZ: Range = [towerZ[0] + topInset, towerZ[1] - topInset];
  plates.push(
    box(
      'tower-plate-roof',
      [Math.max(glazedX[0], topX[0]), topX[1]],
      [towerTopY, towerTopY + slabThickness],
      topZ,
    ),
  );
  roundedRing(
    parapets,
    'crown-parapet',
    [topX[0] - slabProjection, topX[1] + slabProjection],
    [towerTopY, crownTopY],
    [topZ[0] - slabProjection, topZ[1] + slabProjection],
    1.0,
    cornerRadius + slabProjection,
  );
  // Recessed, so the light source itself is never in frame — only the wash
  // it throws on the parapet return.
  // On the crown's own bounds, not the tower's base ones. Left on `slabX`
  // it hung a lit frame three metres out past a parapet that had stepped
  // in twice — a rectangle floating in the air above a rounded building.
  roundedRing(
    crownGlow,
    'crown-glow',
    [topX[0] - slabProjection + 0.5, topX[1] + slabProjection - 0.5],
    [towerTopY + crownHeight * 0.45, towerTopY + crownHeight * 0.62],
    [topZ[0] - slabProjection + 0.5, topZ[1] + slabProjection - 0.5],
    0.3,
    cornerRadius,
  );

  // ── Roof plant ────────────────────────────────────────────────────────
  //
  // What is actually on top of a tower, and until now was not: the lift
  // overrun, the tanks and the air-handling plant, all inside a screened
  // enclosure, with a maintenance rail round the edge and a mast on top.
  //
  // It matters more than a roof anybody can walk on would, because nobody
  // ever does walk on this one — it is only ever read as silhouette, from the
  // beach and from the water. A flat parapet with nothing behind it is the
  // clearest sign in any render that a building stops at the height its
  // author got bored.
  const plantX: Range = [topX[0] + 3.4, topX[0] + 14.2];
  const plantZ: Range = [topZ[0] + 3.0, topZ[1] - 3.0];
  // Above the crown, not tucked behind it. Screened plant that clears the
  // parapet by nothing at all is geometry no camera in this project can see:
  // the aerial framing sits level with the top of the building rather than
  // above it, so a roof is only ever read as the silhouette it breaks.
  const plantTop = crownTopY + 1.6;

  // The screen: four louvred walls rather than a solid box, so the enclosure
  // reads as plant screening and not as another storey.
  for (const [key, ex, ez] of [
    ['n', plantX, [plantZ[0], plantZ[0] + 0.16]],
    ['s', plantX, [plantZ[1] - 0.16, plantZ[1]]],
    ['w', [plantX[0], plantX[0] + 0.16], plantZ],
    ['e', [plantX[1] - 0.16, plantX[1]], plantZ],
  ] as [string, Range, Range][]) {
    parapets.push(box(`roof-screen-${key}`, ex, [towerTopY + slabThickness, plantTop], ez));
  }

  // The lift overrun, which has to clear the topmost car and so is the one
  // thing up here whose height is not a choice.
  parapets.push(
    box(
      'roof-overrun',
      [coreX[0] + 0.4, coreX[1] - 0.4],
      [towerTopY + slabThickness, plantTop + 1.4],
      [lobbyZ[0] - 3.0, lobbyZ[1] + 3.0],
    ),
  );

  // Tanks and air handling inside the screen, low enough to be hidden from
  // the ground and tall enough to break the skyline from the aerial.
  for (let i = 0; i < 3; i += 1) {
    const cx = plantX[0] + 2.2 + i * 3.4;
    parapets.push(
      box(
        `roof-plant-${i}`,
        [cx, cx + 2.4],
        [towerTopY + slabThickness, crownTopY + 0.2 + i * 0.4],
        [plantZ[0] + 1.4, plantZ[1] - 1.4],
      ),
    );
  }

  // The mast. Slender, and the last thing on the building.
  //
  // Twenty-two metres, not eight. The plant behind it is correctly invisible
  // from the ground — that is what screening it is for — but the same sight
  // line hides a mast too, and a mast nobody can see is not a mast. From a
  // camera two metres up and a hundred and thirty out, the parapet occludes
  // everything behind it below about ninety-seven metres; the first attempt
  // topped out at ninety-four and vanished, which looked exactly like the
  // geometry failing to generate.
  parapets.push(
    box(
      'roof-mast-base',
      [mid(coreX) - 0.55, mid(coreX) + 0.55],
      [crownTopY + 3.6, crownTopY + 4.2],
      [mid(lobbyZ) - 0.55, mid(lobbyZ) + 0.55],
    ),
  );
  parapets.push(
    box(
      'roof-mast',
      [mid(coreX) - 0.2, mid(coreX) + 0.2],
      [crownTopY + 4.2, crownTopY + 22.0],
      [mid(lobbyZ) - 0.2, mid(lobbyZ) + 0.2],
    ),
  );

  // A maintenance rail set in from the parapet, on the two long elevations.
  for (const zz of [topZ[0] + 1.2, topZ[1] - 1.2]) {
    parapets.push(
      box(
        `roof-rail-${zz.toFixed(1)}`,
        [topX[0] + 1.2, topX[1] - 1.2],
        [crownTopY - 0.06, crownTopY],
        [zz - 0.05, zz + 0.05],
      ),
    );
  }

  // ── Amenity deck on the podium roof ───────────────────────────────────

  const paving: BoxSpec[] = [];
  const deckParapet: BoxSpec[] = [];
  const deckGlass: BoxSpec[] = [];
  const planters: BoxSpec[] = [];
  const poolShell: BoxSpec[] = [];
  const water: BoxSpec[] = [];
  const furniture: BoxSpec[] = [];

  const deckY = podiumTopY;
  const deckTop = deckY + 0.12;
  const deckX: Range = [towerX[1], podiumX[1] - 0.9];
  const deckZ: Range = [podiumZ[0] + 0.9, podiumZ[1] - 0.9];

  // The deck has two things to let through it: the atrium roof light to the
  // north and the pool to the south. One plate cannot carry two holes, so
  // it is split along Z and each half is punched separately — without this
  // the pool is simply paved over, which is exactly how the first render of
  // this deck came back.
  const lightX: Range = [atriumX[0] - 0.4, atriumX[1] + 0.4];
  const lightZ: Range = [atriumZ[0] - 0.4, atriumZ[1] + 0.4];
  const deckSplitZ = -3.5;
  // The two returns beside the tower, so the roof reads as one continuous
  // deck wrapping the building rather than a terrace stuck on its front.
  paving.push(
    box('deck-return-n', [podiumX[0] + 0.9, towerX[1]], [deckY, deckTop], [deckZ[0], towerZ[0]]),
  );
  paving.push(
    box('deck-return-s', [podiumX[0] + 0.9, towerX[1]], [deckY, deckTop], [towerZ[1], deckZ[1]]),
  );

  // Parapet upstand plus frameless glass above it, all the way round.
  roundedRing(
    deckParapet,
    'deck-upstand',
    podiumX,
    [deckY, deckY + 0.42],
    podiumZ,
    0.55,
    podiumCornerRadius,
    7,
  );
  roundedRing(
    deckGlass,
    'deck-balustrade',
    [podiumX[0] + 0.24, podiumX[1] - 0.24],
    [deckY + 0.42, deckY + deckParapetHeight],
    [podiumZ[0] + 0.24, podiumZ[1] - 0.24],
    0.045,
    podiumCornerRadius - 0.24,
    7,
  );

  // The pool, set out from the ocean edge so a swimmer faces the water.
  const poolX: Range = [podiumX[1] - 4.5 - poolWidth, podiumX[1] - 4.5];
  // Offset to the southern half of the deck: the northern half is taken by
  // the atrium roof light below, and a pool over a skylight is a detail no
  // engineer would sign.
  const poolCentreZ = 8.5;
  const poolZ: Range = [poolCentreZ - poolLength / 2, poolCentreZ + poolLength / 2];
  const poolBase = deckTop - poolDepth;

  // Now the pool bounds are known, the deck can be laid around both voids.
  plateWithHole(
    paving,
    'deck-north',
    deckX,
    [deckY, deckTop],
    [deckZ[0], deckSplitZ],
    lightX,
    lightZ,
  );
  plateWithHole(
    paving,
    'deck-south',
    deckX,
    [deckY, deckTop],
    [deckSplitZ, deckZ[1]],
    poolX,
    poolZ,
  );

  ring(poolShell, 'pool-wall', poolX, [poolBase, deckTop], poolZ, 0.35);
  poolShell.push(box('pool-floor', poolX, [poolBase - 0.3, poolBase], poolZ));
  water.push(
    box(
      'pool-water',
      [poolX[0] + 0.35, poolX[1] - 0.35],
      [poolBase, deckTop - 0.09],
      [poolZ[0] + 0.35, poolZ[1] - 0.35],
    ),
  );

  // Planters bracketing the pool at each end. Held clear of the roof light
  // to the north — everything on this half of the deck has to stay off it.
  const planterZ = [poolZ[0] - 2.4, poolZ[1] + 2.4];
  for (let i = 0; i < 4; i += 1) {
    const z = planterZ[i < 2 ? 0 : 1] ?? poolZ[1] + 2.4;
    const x0 = poolX[0] - 1.2 + (i % 2) * (poolWidth + 1.6);
    planters.push(
      box(`deck-planter-${i}`, [x0, x0 + 1.6], [deckTop, deckTop + 0.85], [z - 1.2, z + 1.2]),
    );
  }

  for (let i = 0; i < 8; i += 1) {
    const z = poolZ[0] + 1.4 + (i % 4) * ((poolLength - 2.8) / 3);
    const x = i < 4 ? poolX[0] - 2.9 : poolX[1] + 1.1;
    furniture.push(
      box(`deck-lounger-${i}`, [x, x + 1.8], [deckTop, deckTop + 0.42], [z - 0.38, z + 0.38]),
    );
  }

  // ── Planting ──────────────────────────────────────────────────────────

  const palms: PalmSpec[] = [];
  // On the deck: a loose grove south of the pool and a second group between
  // the pool and the tower, never a row. Both are held south of the roof
  // light, which owns the northern half of the deck.
  //
  // Every position is tested against the deck it is supposed to be standing
  // on. The first version generated z from `poolZ[1] + 2.8` upward, which
  // runs to 29 m against a deck that stops at 21 — so half the grove stood
  // in mid-air off the roof edge, ten storeys up. A palm floating beside a
  // tower is the single most obvious kind of wrong, and nothing in the
  // maths said so; only the bounds do.
  const margin = 1.6;
  const standable = (x: number, z: number): boolean => {
    if (x < deckX[0] + margin || x > deckX[1] - margin) return false;
    if (z < deckZ[0] + margin || z > deckZ[1] - margin) return false;
    // Not through the roof light, and not in the water.
    if (
      x > lightX[0] - margin &&
      x < lightX[1] + margin &&
      z > lightZ[0] - margin &&
      z < lightZ[1] + margin
    )
      return false;
    if (
      x > poolX[0] - margin &&
      x < poolX[1] + margin &&
      z > poolZ[0] - margin &&
      z < poolZ[1] + margin
    )
      return false;
    return true;
  };

  for (let i = 0, placed = 0; i < 90 && placed < 10; i += 1) {
    const r = rand(200 + i * 13);
    const r2 = rand(600 + i * 9);
    const x = deckX[0] + r2 * (deckX[1] - deckX[0]);
    const z = deckZ[0] + r * (deckZ[1] - deckZ[0]);
    if (!standable(x, z)) continue;
    palms.push(palm(`deck-palm-${placed}`, x, z, deckTop, 900 + i * 31));
    placed += 1;
  }

  return {
    plan,
    podium: {
      mass,
      floors,
      bands,
      glazing: podiumGlass,
      mullions,
      soffits,
      signage,
      balustrades,
      rails: podiumRails,
      skylight,
      coves,
    },
    columns,
    tower: { core, slabs, plates, ceilings, glazing: towerGlass, fins, spandrels },
    stair,
    base: { terrace, steps, seatWalls, portal },
    walkFloors,
    residentialPlates,
    balconies: { slabs: balconySlabs, glass: balconyGlass, rails: balconyRails },
    crown: { parapets, glow: crownGlow },
    deck: {
      paving,
      parapet: deckParapet,
      glass: deckGlass,
      planters,
      poolShell,
      water,
      furniture,
    },
    palms,
  };
}

/**
 * The beach, the boardwalk and the sea in front of the podium.
 *
 * Laid out from the building's own plan rather than from constants, so
 * moving the tower moves the shoreline with it.
 */
export function createShorelineLayout(plan: TowerPlan): ShorelineLayout {
  const boardwalk: BoxSpec[] = [];
  const steps: BoxSpec[] = [];
  const loungers: BoxSpec[] = [];
  const parasols: BoxSpec[] = [];
  const palms: PalmSpec[] = [];

  const spanZ = 260;
  const zRange: Range = [-spanZ / 2, spanZ / 2];

  const walkX: Range = [plan.seaFrontX + 1.5, plan.seaFrontX + 9];
  const beachX: Range = [walkX[1], walkX[1] + 46];
  const shallowsX: Range = [beachX[1] - 3, beachX[1] + 52];
  const oceanX: Range = [beachX[1] + 6, beachX[1] + 900];

  boardwalk.push(box('boardwalk', walkX, [-0.06, 0.18], zRange));

  // Three shallow treads down to the sand, run the full length of the walk.
  for (let i = 0; i < 3; i += 1) {
    steps.push(
      box(
        `boardwalk-step-${i}`,
        [walkX[1] + i * 0.55, walkX[1] + (i + 1) * 0.55 + 0.3],
        [-0.1, 0.14 - i * 0.05],
        [zRange[0] + 30, zRange[1] - 30],
      ),
    );
  }

  // Palms along the back of the beach, thinning as they run away from the
  // building so the row never reads as a fence.
  for (let i = 0; i < 26; i += 1) {
    const t = i / 25;
    const r = rand(50 + i * 19);
    const z = zRange[0] + 18 + t * (spanZ - 36) + (r - 0.5) * 7;
    const x = walkX[1] + 1.5 + rand(80 + i * 11) * 7;
    palms.push(palm(`beach-palm-${i}`, x, z, 0.02, 1500 + i * 23));
  }

  // Loungers and parasols in pairs, only near the building — a beach is
  // busy where the hotel is and empty two hundred metres along.
  for (let i = 0; i < 14; i += 1) {
    const row = Math.floor(i / 7);
    const r = rand(700 + i * 29);
    const x = beachX[0] + 8 + row * 6 + r * 2;
    const z = -22 + (i % 7) * 7.5 + (r - 0.5) * 2;
    loungers.push(box(`beach-lounger-${i}`, [x, x + 1.9], [0.02, 0.4], [z - 0.36, z + 0.36]));
    if (i % 2 === 0) {
      parasols.push(
        box(`beach-parasol-${i}`, [x + 2.2, x + 2.34], [0.02, 2.3], [z - 0.07, z + 0.07]),
      );
      parasols.push(
        box(`beach-canopy-${i}`, [x + 0.1, x + 4.4], [2.3, 2.44], [z - 2.05, z + 2.05]),
      );
    }
  }

  return { boardwalk, steps, beachX, shallowsX, oceanX, spanZ, palms, loungers, parasols };
}
