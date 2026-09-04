import type { Vector3Tuple } from 'three';
import type { BoxSpec, DetailTier } from '../VillaTypes';
import { box, span } from '../SpecBuilders';
import type {
  BladeSpec,
  BlobSpec,
  BranchSpec,
  FeatureTreeConfig,
  LandscapeConfig,
  LandscapeContext,
  LandscapeLayout,
} from './LandscapeTypes';

/**
 * Default landscape proportions and densities — the same pattern as
 * `VILLA_CONFIG` and `SITE_CONFIG`. A future configurator hands a partial
 * override of this object to `createLandscapeLayout`.
 */
export const LANDSCAPE_CONFIG: LandscapeConfig = {
  style: 'mediterranean',
  featureTree: {
    count: 7,
    trunkHeight: 4.6,
    trunkRadius: 0.24,
    branchCount: 5,
    canopyClusters: 18,
    canopyRadius: 1.15,
    canopySpread: 2.6,
  },
  shrub: {
    poolsideCount: 6,
    entranceCount: 8,
    loungeCount: 6,
    edgeCount: 8,
    radius: 0.55,
    blobsPerShrub: 2,
  },
  grass: {
    clusterCount: 14,
    bladesPerCluster: 10,
    bladeHeight: 0.45,
    bladeWidth: 0.035,
    clusterRadius: 0.5,
  },
  hedge: { height: 0.55, width: 0.4, offset: 0.9 },
  rock: { count: 8, minRadius: 0.18, maxRadius: 0.4 },
  planterPlanting: { soilInset: 0.15, soilDepth: 0.08 },
  poolsideOffset: 0.9,
  entranceBedOffset: 0.7,
  villaEdgeOffset: 1.2,
  loungeEdgeInset: 0.35,
};

/** Repeated landscape detail thins out on weaker GPUs, mirroring the villa's own tiers. */
const LANDSCAPE_DETAIL: Record<
  DetailTier,
  {
    canopy: number;
    /**
     * Icosahedron subdivision level for canopy masses.
     *
     * Dialled back down in Phase 7E. Subdivision was raised in Phase 6 to
     * fight the faceted low-poly silhouette, which it could only ever
     * partly do — a closed convex surface has the wrong outline at any
     * vertex count. Now that foliage cards draw the silhouette and these
     * volumes are only the shadow-casting inner mass, their tessellation
     * is no longer visible and the triangles are better spent elsewhere.
     */
    canopyDetail: BlobSpec['detail'];
    /** The same, for shrub masses, which sit closest to the camera. */
    shrubDetail: BlobSpec['detail'];
    shrubs: number;
    grass: number;
    bladeScale: number;
    rocks: number;
  }
> = {
  low: {
    canopy: 0.5,
    canopyDetail: 0,
    shrubDetail: 0,
    shrubs: 0.4,
    grass: 0.25,
    bladeScale: 0.7,
    rocks: 0.5,
  },
  medium: {
    canopy: 0.8,
    canopyDetail: 1,
    shrubDetail: 1,
    shrubs: 0.7,
    grass: 0.6,
    bladeScale: 0.85,
    rocks: 0.75,
  },
  high: {
    canopy: 1,
    canopyDetail: 1,
    shrubDetail: 1,
    shrubs: 1,
    grass: 1,
    bladeScale: 1,
    rocks: 1,
  },
};

/**
 * A small deterministic PRNG (mulberry32). Landscape generation never calls
 * `Math.random()` — the same config and context always produce the same
 * layout, since a fresh generator with this fixed seed is created on every
 * call to `createLandscapeLayout`.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LANDSCAPE_SEED = 0x41555245; // 'AURE'

type Rng = () => number;
const between = (rng: Rng, a: number, b: number) => a + rng() * (b - a);
const scaleCount = (base: number, factor: number) => Math.max(1, Math.round(base * factor));

/** A shrub as a small cluster of overlapping deformed blobs — never a single sphere. */
function makeShrub(
  keyPrefix: string,
  position: Vector3Tuple,
  radius: number,
  blobCount: number,
  detail: BlobSpec['detail'],
  rng: Rng,
  nextSeed: () => number,
): { mid: BlobSpec[]; dark: BlobSpec[] } {
  const mid: BlobSpec[] = [];
  const dark: BlobSpec[] = [];

  for (let i = 0; i < blobCount; i += 1) {
    const r = radius * between(rng, 0.7, 1.05);
    const spec: BlobSpec = {
      key: `${keyPrefix}-${i}`,
      position: [
        position[0] + between(rng, -radius * 0.35, radius * 0.35),
        position[1] + r * between(rng, 0.5, 0.8),
        position[2] + between(rng, -radius * 0.35, radius * 0.35),
      ],
      radius: r,
      scale: [between(rng, 0.9, 1.15), between(rng, 0.75, 1.05), between(rng, 0.9, 1.15)],
      seed: nextSeed(),
      deform: between(rng, 0.22, 0.38),
      detail,
    };
    (i % 3 === 0 ? dark : mid).push(spec);
  }

  return { mid, dark };
}

/** A cluster of 5–15 tapered blades scattered within a small radius. */
function makeGrassCluster(
  keyPrefix: string,
  center: Vector3Tuple,
  clusterRadius: number,
  bladeCount: number,
  heightBase: number,
  widthBase: number,
  bladeScale: number,
  rng: Rng,
): BladeSpec[] {
  return Array.from({ length: bladeCount }, (_, i) => {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * clusterRadius;
    return {
      key: `${keyPrefix}-${i}`,
      position: [center[0] + Math.cos(angle) * dist, center[1], center[2] + Math.sin(angle) * dist],
      rotationY: rng() * Math.PI * 2,
      tilt: between(rng, 0.05, 0.22),
      height: heightBase * bladeScale * between(rng, 0.75, 1.2),
      width: widthBase * between(rng, 0.85, 1.15),
    };
  });
}

function makeRock(
  key: string,
  position: Vector3Tuple,
  minRadius: number,
  maxRadius: number,
  rng: Rng,
  nextSeed: () => number,
): BlobSpec {
  const r = between(rng, minRadius, maxRadius);
  return {
    key,
    position: [position[0], r * 0.32, position[2]],
    radius: r,
    scale: [between(rng, 0.9, 1.3), between(rng, 0.42, 0.68), between(rng, 0.9, 1.3)],
    seed: nextSeed(),
    deform: between(rng, 0.26, 0.42),
    detail: 0,
  };
}

/**
 * A feature tree: a leaning trunk, a small number of major branches, and
 * several overlapping canopy clusters at the branch tips — never one
 * perfect sphere on a pole.
 */
function makeTree(
  keyPrefix: string,
  base: Vector3Tuple,
  cfg: FeatureTreeConfig,
  canopyClusters: number,
  canopyDetail: BlobSpec['detail'],
  rng: Rng,
  nextSeed: () => number,
): { trunks: BranchSpec[]; canopyMid: BlobSpec[]; canopyDark: BlobSpec[] } {
  const trunks: BranchSpec[] = [];
  const canopyMid: BlobSpec[] = [];
  const canopyDark: BlobSpec[] = [];

  const trunkTop: Vector3Tuple = [
    base[0] + between(rng, -0.3, 0.3),
    base[1] + cfg.trunkHeight,
    base[2] + between(rng, -0.3, 0.3),
  ];
  trunks.push({
    key: `${keyPrefix}-trunk`,
    from: base,
    to: trunkTop,
    topRadius: cfg.trunkRadius * 0.55,
    bottomRadius: cfg.trunkRadius,
  });

  const branchCount = Math.max(1, Math.round(cfg.branchCount));
  const clusterCenters: Vector3Tuple[] = [
    [trunkTop[0], trunkTop[1] + cfg.trunkHeight * 0.12, trunkTop[2]],
  ];

  for (let b = 0; b < branchCount; b += 1) {
    const angle = (b / branchCount) * Math.PI * 2 + between(rng, -0.5, 0.5);
    const length = cfg.trunkHeight * between(rng, 0.4, 0.6);
    const lift = between(rng, 0.55, 0.95);
    const tip: Vector3Tuple = [
      trunkTop[0] + Math.cos(angle) * length * 0.7,
      trunkTop[1] + length * lift * 1.05,
      trunkTop[2] + Math.sin(angle) * length * 0.7,
    ];
    trunks.push({
      key: `${keyPrefix}-branch-${b}`,
      from: trunkTop,
      to: tip,
      topRadius: cfg.trunkRadius * 0.14,
      bottomRadius: cfg.trunkRadius * 0.4,
    });
    clusterCenters.push(tip);
  }

  const clusterTotal = Math.max(1, canopyClusters);
  for (let c = 0; c < clusterTotal; c += 1) {
    const center = clusterCenters[c % clusterCenters.length]!;
    const r = cfg.canopyRadius * between(rng, 0.34, 0.6);
    const spec: BlobSpec = {
      key: `${keyPrefix}-canopy-${c}`,
      position: [
        center[0] + between(rng, -cfg.canopySpread * 0.42, cfg.canopySpread * 0.42),
        center[1] + between(rng, -0.55, 1.15),
        center[2] + between(rng, -cfg.canopySpread * 0.42, cfg.canopySpread * 0.42),
      ],
      radius: r,
      scale: [between(rng, 0.85, 1.3), between(rng, 0.72, 1.0), between(rng, 0.85, 1.3)],
      seed: nextSeed(),
      // Heavier deformation than a shrub: a canopy edge is ragged, and a
      // near-spherical mass is what makes a tree read as a lollipop.
      deform: between(rng, 0.34, 0.52),
      detail: canopyDetail,
    };
    (c % 3 === 2 ? canopyDark : canopyMid).push(spec);
  }

  return { trunks, canopyMid, canopyDark };
}

/**
 * Resolves the landscape configuration against the villa/site context into
 * every tree, shrub, grass cluster, hedge, rock, and planter planting. Pure
 * and deterministic, exactly like `createVillaLayout` and
 * `createSiteLayout` — callers memoise the result.
 */
export function createLandscapeLayout(
  config: LandscapeConfig = LANDSCAPE_CONFIG,
  ctx: LandscapeContext,
  detail: DetailTier = 'high',
): LandscapeLayout {
  const tier = LANDSCAPE_DETAIL[detail];
  const rng = mulberry32(LANDSCAPE_SEED);
  const nextSeed = () => Math.floor(rng() * 1_000_000);

  const trunks: BranchSpec[] = [];
  const canopyMid: BlobSpec[] = [];
  const canopyDark: BlobSpec[] = [];
  const shrubsMid: BlobSpec[] = [];
  const shrubsDark: BlobSpec[] = [];
  const grass: BladeSpec[] = [];
  const rocks: BlobSpec[] = [];
  const hedges: BoxSpec[] = [];
  const planterSoil: BoxSpec[] = [];

  const addShrub = (key: string, position: Vector3Tuple, radius: number, blobs: number) => {
    const { mid, dark } = makeShrub(key, position, radius, blobs, shrubDetail, rng, nextSeed);
    shrubsMid.push(...mid);
    shrubsDark.push(...dark);
  };

  const addGrass = (key: string, center: Vector3Tuple, clusterRadius: number, blades: number) => {
    grass.push(
      ...makeGrassCluster(
        key,
        center,
        clusterRadius,
        blades,
        config.grass.bladeHeight,
        config.grass.bladeWidth,
        tier.bladeScale,
        rng,
      ),
    );
  };

  // ── Feature trees near the approach ─────────────────────────────────────
  const shrubDetail = tier.shrubDetail;
  const canopyClusters = scaleCount(config.featureTree.canopyClusters, tier.canopy);
  const treeCount = config.featureTree.count;
  const approachMidZ = ctx.approachZ[0] + span(ctx.approachZ) * 0.32;
  // Two specimens frame the approach; the rest stand off the property
  // boundary, where they give the elevations a treeline to sit against
  // instead of a bare horizon. Placed on a ring at deterministic angles
  // biased away from the front, so nothing grows into the hero view.
  //
  // The first two specimens used to stand just off the entrance stepping
  // stones, which was right until Phase 7D paved that whole strip: one
  // ended up inside the turning court and the other on the pool deck's
  // edge. They now flank the arrival rather than stand in it — one well
  // west of the court, one east of the drive beyond where the court ends —
  // so they frame the approach instead of blocking it.
  const treePositions: Vector3Tuple[] = [
    [ctx.approachX[0] - 13.4, 0, approachMidZ + 3.6],
    [ctx.approachX[1] + 2.4, 0, ctx.approachZ[1] + 8.5],
    // Two specimens in the south-east foreground.
    //
    // The hero camera now stands at eye height on that side rather than
    // looking down from thirty metres, and at eye height the whole near
    // half of the frame was an empty lawn running to the plinth. A
    // photograph of a property is built in depth — something close, the
    // building beyond it, landscape behind that — and without a foreground
    // there is no depth to read. These two stand off the corner of the
    // approach, well clear of the elevation they frame.
    [30.5, 0, 33.5],
    [39, 0, 15],
  ];
  const ringCount = Math.max(0, treeCount - treePositions.length);
  for (let i = 0; i < ringCount; i += 1) {
    // Sweep the rear and flanks, never the front elevation.
    const angle = Math.PI * 0.32 + (i / Math.max(1, ringCount - 1)) * Math.PI * 1.36;
    const radius = 30 + between(rng, 0, 16);
    treePositions.push([
      Math.sin(angle) * radius + between(rng, -3, 3),
      0,
      -Math.cos(angle) * radius + between(rng, -3, 3),
    ]);
  }

  for (let i = 0; i < treeCount; i += 1) {
    const position = treePositions[i];
    if (!position) break;
    // Every specimen a different size, so a row of them never reads as one
    // tree copied along a line.
    const scale = i === 0 ? 1 : 0.6 + between(rng, 0, 0.62);
    const cfg: FeatureTreeConfig = {
      ...config.featureTree,
      trunkHeight: config.featureTree.trunkHeight * scale,
      trunkRadius: config.featureTree.trunkRadius * scale,
      canopyRadius: config.featureTree.canopyRadius * scale,
    };
    const tree = makeTree(
      `tree-${i}`,
      position,
      cfg,
      Math.max(1, Math.round(canopyClusters * scale)),
      tier.canopyDetail,
      rng,
      nextSeed,
    );
    trunks.push(...tree.trunks);
    canopyMid.push(...tree.canopyMid);
    canopyDark.push(...tree.canopyDark);
  }

  // ── Entrance landscaping: beds flanking the approach, plus the stairs ──
  const bedWestX = ctx.approachX[0] - config.entranceBedOffset;
  const bedEastX = ctx.approachX[1] + config.entranceBedOffset;
  const entranceShrubs = scaleCount(config.shrub.entranceCount, tier.shrubs);
  for (let i = 0; i < entranceShrubs; i += 1) {
    const side = i % 2 === 0 ? bedWestX : bedEastX;
    const z = between(rng, ctx.approachZ[0], ctx.approachZ[1]);
    addShrub(`entrance-shrub-${i}`, [side, 0, z], config.shrub.radius, config.shrub.blobsPerShrub);
    addGrass(
      `entrance-grass-${i}`,
      [side + between(rng, -0.4, 0.4), 0, z],
      config.grass.clusterRadius,
      scaleCount(6, tier.grass),
    );
  }

  [ctx.entranceStairsX[0] - 1.1, ctx.entranceStairsX[1] + 1.1].forEach((x, i) => {
    addShrub(
      `stairs-shrub-${i}`,
      [x, ctx.groundY, ctx.entranceStairsOuterZ - 1],
      config.shrub.radius * 1.1,
      config.shrub.blobsPerShrub + 1,
    );
  });

  // Hedges reinforce the approach path's own line.
  hedges.push(
    box(
      'hedge-west',
      [bedWestX - config.hedge.offset - config.hedge.width, bedWestX - config.hedge.offset],
      [0, config.hedge.height],
      ctx.approachZ,
    ),
    box(
      'hedge-east',
      [bedEastX + config.hedge.offset, bedEastX + config.hedge.offset + config.hedge.width],
      [0, config.hedge.height],
      ctx.approachZ,
    ),
  );

  // ── Poolside vegetation: framing the west/east coping, view kept clear ──
  const poolsideShrubs = scaleCount(config.shrub.poolsideCount, tier.shrubs);
  const poolsideStations = Math.max(2, Math.round(poolsideShrubs / 2));
  for (let s = 0; s < poolsideStations; s += 1) {
    const z = ctx.poolZ[0] + (span(ctx.poolZ) * (s + 0.5)) / poolsideStations;
    const westX = ctx.poolX[0] - config.poolsideOffset;
    const eastX = ctx.poolX[1] + config.poolsideOffset;
    addShrub(
      `pool-shrub-w-${s}`,
      [westX, ctx.deckY, z],
      config.shrub.radius * 0.85,
      config.shrub.blobsPerShrub,
    );
    addShrub(
      `pool-shrub-e-${s}`,
      [eastX, ctx.deckY, z],
      config.shrub.radius * 0.85,
      config.shrub.blobsPerShrub,
    );
    addGrass(
      `pool-grass-w-${s}`,
      [westX - 0.5, ctx.deckY, z],
      config.grass.clusterRadius * 0.8,
      scaleCount(6, tier.grass),
    );
    addGrass(
      `pool-grass-e-${s}`,
      [eastX + 0.5, ctx.deckY, z],
      config.grass.clusterRadius * 0.8,
      scaleCount(6, tier.grass),
    );
  }

  // ── Sunken lounge: planting along the three enclosing walls' tops ──────
  const loungeShrubs = scaleCount(config.shrub.loungeCount, tier.shrubs);
  const loungeStations = Math.max(2, Math.round(loungeShrubs / 3));
  const inset = config.loungeEdgeInset;
  for (let s = 0; s < loungeStations; s += 1) {
    const x = ctx.loungeFloorX[0] + (span(ctx.loungeFloorX) * (s + 0.5)) / loungeStations;
    addShrub(
      `lounge-shrub-near-${s}`,
      [x, ctx.deckY, ctx.loungeZ[0] + inset],
      config.shrub.radius * 0.8,
      config.shrub.blobsPerShrub,
    );
    addShrub(
      `lounge-shrub-far-${s}`,
      [x, ctx.deckY, ctx.loungeZ[1] - inset],
      config.shrub.radius * 0.8,
      config.shrub.blobsPerShrub,
    );
  }
  addShrub(
    'lounge-shrub-east',
    [ctx.loungeX[1] - inset, ctx.deckY, (ctx.loungeZ[0] + ctx.loungeZ[1]) / 2],
    config.shrub.radius,
    config.shrub.blobsPerShrub + 1,
  );
  addGrass(
    'lounge-grass',
    [ctx.loungeFloorX[0] + inset, ctx.deckY, ctx.loungeZ[0] + inset],
    config.grass.clusterRadius,
    scaleCount(8, tier.grass),
  );

  // ── Villa edge planting: a soft strip along the plinth's east and west ──
  const edgeShrubs = scaleCount(config.shrub.edgeCount, tier.shrubs);
  const edgeStations = Math.max(2, Math.round(edgeShrubs / 2));
  const edgeZRange: [number, number] = [-ctx.halfDepth * 0.7, ctx.halfDepth * 0.55];
  for (let s = 0; s < edgeStations; s += 1) {
    const z = edgeZRange[0] + (span(edgeZRange) * (s + 0.5)) / edgeStations;
    const westX = -ctx.plinthHalfWidth - config.villaEdgeOffset;
    const eastX = ctx.plinthHalfWidth + config.villaEdgeOffset;
    addShrub(
      `edge-shrub-w-${s}`,
      [westX, 0, z],
      config.shrub.radius * 0.8,
      config.shrub.blobsPerShrub,
    );
    addShrub(
      `edge-shrub-e-${s}`,
      [eastX, 0, z],
      config.shrub.radius * 0.8,
      config.shrub.blobsPerShrub,
    );
    addGrass(
      `edge-grass-w-${s}`,
      [westX, 0, z + 0.6],
      config.grass.clusterRadius * 0.9,
      scaleCount(7, tier.grass),
    );
    addGrass(
      `edge-grass-e-${s}`,
      [eastX, 0, z + 0.6],
      config.grass.clusterRadius * 0.9,
      scaleCount(7, tier.grass),
    );
  }

  // ── Landscape rocks: a handful near the trees and entrance beds ────────
  const rockCount = scaleCount(config.rock.count, tier.rocks);
  const rockZones: Vector3Tuple[] = [
    [treePositions[0]![0] - 0.9, 0, treePositions[0]![2] + 1.1],
    [treePositions[0]![0] + 1.2, 0, treePositions[0]![2] - 0.7],
    [bedWestX - 0.5, 0, ctx.approachZ[0] + 1.5],
    [bedEastX + 0.5, 0, ctx.approachZ[1] - 1.5],
    [treePositions[1]![0], 0, treePositions[1]![2] + 1],
  ];
  for (let i = 0; i < rockCount; i += 1) {
    const zone = rockZones[i % rockZones.length]!;
    rocks.push(
      makeRock(
        `rock-${i}`,
        [zone[0] + between(rng, -0.6, 0.6), 0, zone[2] + between(rng, -0.6, 0.6)],
        config.rock.minRadius,
        config.rock.maxRadius,
        rng,
        nextSeed,
      ),
    );
  }

  // ── Planters: soil cap plus a shrub or grass cluster on each ────────────
  ctx.planters.forEach((planter, index) => {
    const [w, h, d] = planter.scale;
    const top = planter.position[1] + h / 2;
    const inset2 = config.planterPlanting.soilInset;
    planterSoil.push(
      box(
        `planter-soil-${index}`,
        [planter.position[0] - w / 2 + inset2, planter.position[0] + w / 2 - inset2],
        [top - config.planterPlanting.soilDepth, top],
        [planter.position[2] - d / 2 + inset2, planter.position[2] + d / 2 - inset2],
      ),
    );

    const plantPosition: Vector3Tuple = [planter.position[0], top, planter.position[2]];
    if (index % 2 === 0) {
      addShrub(`planter-shrub-${index}`, plantPosition, config.shrub.radius * 0.6, 2);
    } else {
      addGrass(
        `planter-grass-${index}`,
        plantPosition,
        Math.min(w, d) * 0.35,
        scaleCount(7, tier.grass),
      );
    }
  });

  return {
    trees: { trunks, canopyMid, canopyDark },
    shrubsMid,
    shrubsDark,
    grass,
    hedges,
    rocks,
    planterSoil,
  };
}
