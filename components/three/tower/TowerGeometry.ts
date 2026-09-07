import type { BoxSpec, ColumnSpec, Range } from '../villa/VillaTypes';
import type { PalmSpec, ShorelineLayout, TowerConfig, TowerLayout, TowerPlan } from './TowerTypes';

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
): void {
  const innerZ: Range = [z[0] + thickness, z[1] - thickness];
  out.push(box(`${key}-n`, x, y, [z[0], z[0] + thickness]));
  out.push(box(`${key}-s`, x, y, [z[1] - thickness, z[1]]));
  out.push(box(`${key}-w`, [x[0], x[0] + thickness], y, innerZ));
  out.push(box(`${key}-e`, [x[1] - thickness, x[1]], y, innerZ));
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
    trunkRadius: 0.19 + r2 * 0.08,
    lean: 0.05 + r3 * 0.13,
    leanAngle: r1 * Math.PI * 2,
    frondCount: 9 + Math.floor(r2 * 4),
    frondLength: 2.6 + r3 * 1.5,
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

  // The shell behind the shopfronts. A ring rather than a solid block: the
  // retail levels are a real volume you can stand inside, and filling them
  // with stone would make the whole podium a prop that only works from
  // outside — which is exactly what a five-storey mall must not be.
  ring(mass, 'podium-shell', innerX, [0, podiumTopY], innerZ, 0.45);

  // Ground floor, solid: the atrium void starts above it.
  floors.push(box('podium-floor-0', innerX, [-0.2, 0], innerZ));

  /** A floor plate with the atrium punched out of it. */
  const plate = (key: string, y: Range): void => {
    floors.push(box(`${key}-n`, innerX, y, [innerZ[0], atriumZ[0]]));
    floors.push(box(`${key}-s`, innerX, y, [atriumZ[1], innerZ[1]]));
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
    ring(
      podiumRails,
      `atrium-rail-${level}`,
      atriumX,
      [railY[1], railY[1] + 0.07],
      atriumZ,
      0.1,
    );

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
    ring(
      bands,
      `podium-band-${level}`,
      podiumX,
      [y - (level === 0 ? 0 : height / 2), y + (level === 0 ? height : height / 2)],
      podiumZ,
      podiumBandDepth,
    );

    // A lit reveal tucked under every band. This is the detail that makes
    // the podium read at night: the retail levels become five stacked lines
    // of light rather than a dark block under a lit tower.
    if (level > 0) {
      const glowY: Range = [y - height / 2 - 0.16, y - height / 2 - 0.04];
      ring(signage, `podium-glow-${level}`, podiumX, glowY, podiumZ, podiumBandDepth * 0.55);
    }
  }

  // Shopfronts, one glazed band per retail level on all four elevations.
  for (let level = 0; level < podiumLevels; level += 1) {
    const y0 = level * podiumLevelHeight + (level === 0 ? podiumBandHeight : podiumBandHeight / 2);
    const y1 = (level + 1) * podiumLevelHeight - podiumBandHeight / 2;
    const y: Range = [y0, y1];

    glazedWall(podiumGlass, mullions, `shop-e-${level}`, 'z', innerZ, innerX[1], y, 0.1, 9, 0.16);
    glazedWall(podiumGlass, mullions, `shop-w-${level}`, 'z', innerZ, innerX[0], y, 0.1, 9, 0.16);
    glazedWall(podiumGlass, mullions, `shop-s-${level}`, 'x', innerX, innerZ[1], y, 0.1, 13, 0.16);
    glazedWall(podiumGlass, mullions, `shop-n-${level}`, 'x', innerX, innerZ[0], y, 0.1, 13, 0.16);
  }

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
  const balconySlabs: BoxSpec[] = [];
  const balconyGlass: BoxSpec[] = [];
  const balconyRails: BoxSpec[] = [];

  const coreX: Range = [towerX[0], towerX[0] + coreWidth];
  const glazedX: Range = [coreX[1], towerX[1]];

  // The service blade. Solid, full height, and deliberately reading as a
  // different material from the glass it braces.
  core.push(box('tower-core', coreX, [towerBaseY, crownTopY], towerZ));

  const slabX: Range = [towerX[0] - slabProjection, towerX[1] + slabProjection];
  const slabZ: Range = [towerZ[0] - slabProjection, towerZ[1] + slabProjection];

  for (let level = 0; level < towerLevels; level += 1) {
    const y = plan.levelY(level);
    const nextY = plan.levelY(level + 1);

    // The floor plate, expressed all the way round. Wrapping the corners is
    // the whole streamline: stop the band at the corner and the tower reads
    // as four separate elevations bolted together.
    ring(slabs, `tower-slab-${level}`, slabX, [y, y + slabThickness], slabZ, 1.1);

    // The plate itself, spanning the apartment. The band above is only the
    // expressed edge of it; without this the residential floors are a glass
    // shell with nothing to stand on, which is exactly what the interior
    // camera on level twelve would have looked down into.
    plates.push(box(`tower-plate-${level}`, glazedX, [y, y + slabThickness], towerZ));
    // The plaster soffit under the plate above. Without it the apartment
    // ceiling is the polished underside of a stone floor, which is why the
    // first interior render came back as a marble slot.
    if (level > 0) {
      ceilings.push(
        box(`tower-ceiling-${level}`, glazedX, [y - 0.09, y], towerZ),
      );
    }

    const glassY: Range = [y + slabThickness, nextY];

    glazedWall(
      towerGlass,
      fins,
      `tower-e-${level}`,
      'z',
      towerZ,
      towerX[1],
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
      glazedX,
      towerZ[1],
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
      glazedX,
      towerZ[0],
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
        [towerX[1] - 0.12, towerX[1] + 0.06],
        [y + slabThickness, y + slabThickness + 0.45],
        towerZ,
      ),
    );

    // ── Balconies ───────────────────────────────────────────────────────
    // Every level, across the whole ocean elevation, returning around both
    // ends. A tower on this coast is bought for the outside space.
    const balconyOuterX = towerX[1] + balconyDepth;
    const balconyZ: Range = [towerZ[0] - balconyDepth * 0.35, towerZ[1] + balconyDepth * 0.35];

    balconySlabs.push(
      box(
        `balcony-slab-${level}`,
        [towerX[1], balconyOuterX],
        [y, y + slabThickness],
        balconyZ,
      ),
    );

    const railY: Range = [y + slabThickness, y + slabThickness + balustradeHeight];
    // Frameless glass on three sides of the balcony.
    balconyGlass.push(
      box(`balcony-glass-e-${level}`, [balconyOuterX - 0.04, balconyOuterX], railY, balconyZ),
    );
    balconyGlass.push(
      box(
        `balcony-glass-n-${level}`,
        [towerX[1], balconyOuterX],
        railY,
        [balconyZ[0], balconyZ[0] + 0.04],
      ),
    );
    balconyGlass.push(
      box(
        `balcony-glass-s-${level}`,
        [towerX[1], balconyOuterX],
        railY,
        [balconyZ[1] - 0.04, balconyZ[1]],
      ),
    );

    // The capping rail, which is what stops frameless glass reading as a
    // sheet of blue plastic stuck to the slab.
    const capY: Range = [railY[1], railY[1] + 0.07];
    ring(balconyRails, `balcony-rail-${level}`, [towerX[1], balconyOuterX], capY, balconyZ, 0.09);
  }

  // ── Crown ─────────────────────────────────────────────────────────────

  const parapets: BoxSpec[] = [];
  const crownGlow: BoxSpec[] = [];

  plates.push(box('tower-plate-roof', glazedX, [towerTopY, towerTopY + slabThickness], towerZ));
  ring(parapets, 'crown-parapet', slabX, [towerTopY, crownTopY], slabZ, 1.0);
  // Recessed, so the light source itself is never in frame — only the wash
  // it throws on the parapet return.
  ring(
    crownGlow,
    'crown-glow',
    [slabX[0] + 0.5, slabX[1] - 0.5],
    [towerTopY + crownHeight * 0.45, towerTopY + crownHeight * 0.62],
    [slabZ[0] + 0.5, slabZ[1] - 0.5],
    0.3,
  );

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
  ring(deckParapet, 'deck-upstand', podiumX, [deckY, deckY + 0.42], podiumZ, 0.55);
  ring(
    deckGlass,
    'deck-balustrade',
    [podiumX[0] + 0.24, podiumX[1] - 0.24],
    [deckY + 0.42, deckY + deckParapetHeight],
    [podiumZ[0] + 0.24, podiumZ[1] - 0.24],
    0.045,
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
  const palmSouthLimit = lightZ[1] + 1.6;
  for (let i = 0; i < 10; i += 1) {
    const r = rand(200 + i * 13);
    const r2 = rand(600 + i * 9);
    const grove = i % 2 === 0;
    const z = grove
      ? poolZ[1] + 2.8 + r * 7
      : Math.max(palmSouthLimit, poolZ[0] - 1 + r * (poolLength * 0.6));
    const x = grove ? poolX[0] - 3 + r2 * (poolWidth + 7) : deckX[0] + 1.5 + r2 * 6;
    palms.push(palm(`deck-palm-${i}`, x, z, deckTop, 900 + i * 31));
  }

  // ── One furnished apartment ───────────────────────────────────────────
  // Laid out against the ocean glazing on the entered level, so the room a
  // visitor stands in is a room rather than an empty plate.

  const rug: BoxSpec[] = [];
  const soft: BoxSpec[] = [];
  const softStone: BoxSpec[] = [];
  const softJoinery: BoxSpec[] = [];

  {
    const f = plan.levelY(furnishedLevel) + slabThickness;
    const glassLine = towerX[1];
    // The lounge sits in the bay nearest the glass, off-centre on Z so the
    // camera looking out has furniture in the frame rather than behind it.
    const cz = -1.5;

    rug.push(box('res-rug', [glassLine - 8.6, glassLine - 1.4], [f, f + 0.02], [cz - 3.1, cz + 3.1]));

    // A long sofa facing the water, its back to the room.
    const sofaX: Range = [glassLine - 8.2, glassLine - 7.2];
    softJoinery.push(box('res-sofa-base', [sofaX[0], sofaX[1] + 1.9], [f, f + 0.32], [cz - 2.5, cz + 2.5]));
    soft.push(box('res-sofa-seat', [sofaX[0] + 0.35, sofaX[1] + 1.9], [f + 0.32, f + 0.46], [cz - 2.4, cz + 2.4]));
    soft.push(box('res-sofa-back', sofaX, [f + 0.32, f + 0.86], [cz - 2.5, cz + 2.5]));
    soft.push(box('res-sofa-arm-n', [sofaX[0], sofaX[1] + 1.9], [f + 0.32, f + 0.68], [cz - 2.5, cz - 2.2]));
    soft.push(box('res-sofa-arm-s', [sofaX[0], sofaX[1] + 1.9], [f + 0.32, f + 0.68], [cz + 2.2, cz + 2.5]));

    // Two chairs turned toward the glass, and a low table between.
    for (let i = 0; i < 2; i += 1) {
      const z = cz + (i === 0 ? -2.0 : 2.0);
      softJoinery.push(box(`res-chair-${i}-base`, [glassLine - 3.5, glassLine - 2.5], [f, f + 0.3], [z - 0.45, z + 0.45]));
      soft.push(box(`res-chair-${i}-seat`, [glassLine - 3.5, glassLine - 2.5], [f + 0.3, f + 0.46], [z - 0.45, z + 0.45]));
      soft.push(box(`res-chair-${i}-back`, [glassLine - 3.5, glassLine - 3.2], [f + 0.46, f + 0.92], [z - 0.45, z + 0.45]));
    }

    softStone.push(box('res-table', [glassLine - 5.6, glassLine - 4.0], [f + 0.28, f + 0.36], [cz - 0.7, cz + 0.7]));
    softStone.push(box('res-table-leg', [glassLine - 5.1, glassLine - 4.5], [f, f + 0.28], [cz - 0.35, cz + 0.35]));

    // A run of low joinery against the core end, giving the room a back.
    softJoinery.push(box('res-credenza', [glazedX[0] + 0.4, glazedX[0] + 0.95], [f, f + 0.72], [cz - 2.2, cz + 2.2]));
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
    residence: { rug, soft, stone: softStone, joinery: softJoinery },
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
      parasols.push(box(`beach-parasol-${i}`, [x + 2.2, x + 2.34], [0.02, 2.3], [z - 0.07, z + 0.07]));
      parasols.push(
        box(`beach-canopy-${i}`, [x + 0.1, x + 4.4], [2.3, 2.44], [z - 2.05, z + 2.05]),
      );
    }
  }

  return { boardwalk, steps, beachX, shallowsX, oceanX, spanZ, palms, loungers, parasols };
}
