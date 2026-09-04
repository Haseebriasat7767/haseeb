import type { BoxSpec, Range } from '../VillaTypes';
import { box, column, span } from '../SpecBuilders';
import type {
  FacadeWall,
  OpeningAssembly,
  OpeningParams,
  OpeningsGeometry,
  WallOpening,
} from './OpeningTypes';

/**
 * Converts a pair of outward depth offsets into a world-space range on the
 * wall's axis, so every builder below can think in "distance out from the
 * facade" regardless of which way the wall faces.
 */
function depthRange(wall: FacadeWall, from: number, to: number): Range {
  const a = wall.face + from * wall.facing;
  const b = wall.face + to * wall.facing;
  return a < b ? [a, b] : [b, a];
}

/** A volume placed in wall-local terms: along the wall, in height, and in depth. */
function wallBox(
  key: string,
  wall: FacadeWall,
  across: Range,
  y: Range,
  from: number,
  to: number,
): BoxSpec {
  const depth = depthRange(wall, from, to);
  return wall.axis === 'z' ? box(key, across, y, depth) : box(key, depth, y, across);
}

function emptyAssembly(): OpeningAssembly {
  return { frames: [], glassClear: [], glassOpaque: [], thresholds: [] };
}

/** Vertical divisions derived from the opening's own width. */
function mullionCount(opening: WallOpening, params: OpeningParams): number {
  if (opening.mullions !== undefined) return opening.mullions;
  return Math.max(0, Math.round(span(opening.across) / params.mullionSpacing) - 1);
}

/**
 * Tiles the wall face with skin panels, leaving each opening out. Sweeping
 * along the wall and emitting a full-height strip between openings, plus a
 * spandrel below and above each one, is what punches the holes.
 */
function buildSkin(wall: FacadeWall, params: OpeningParams, out: OpeningsGeometry): void {
  if (!wall.skin) return;

  const panels = wall.stone ? out.skinStone : out.skin;
  const gap = params.revealGap;
  const skinBottom = wall.y[0] + gap;
  const push = (key: string, across: Range, y: Range) => {
    if (span(across) <= 0.001 || span(y) <= 0.001) return;
    panels.push(wallBox(key, wall, across, y, 0, params.skinDepth));
  };

  const openings = [...wall.openings].sort((a, b) => a.across[0] - b.across[0]);
  let cursor = wall.across[0];

  openings.forEach((opening) => {
    if (opening.across[0] > cursor) {
      push(`${wall.key}-pier-${opening.key}`, [cursor, opening.across[0]], [skinBottom, wall.y[1]]);
    }
    push(`${wall.key}-sill-${opening.key}`, opening.across, [skinBottom, opening.y[0]]);
    push(`${wall.key}-head-${opening.key}`, opening.across, [opening.y[1], wall.y[1]]);
    cursor = Math.max(cursor, opening.across[1]);
  });

  if (cursor < wall.across[1]) {
    push(`${wall.key}-pier-end`, [cursor, wall.across[1]], [skinBottom, wall.y[1]]);
  }

  // The skin stops short of the base, and a shallower dark band fills the
  // gap — a genuine recessed shadow line rather than a painted-on one.
  out.skinReveals.push(
    wallBox(
      `${wall.key}-base-reveal`,
      wall,
      wall.across,
      [wall.y[0], skinBottom],
      0,
      params.skinDepth * 0.35,
    ),
  );
}

/**
 * Depths of the three layers in an opening, measured outward from the
 * structural face. On a skinned wall the perimeter becomes a deep sleeve
 * lining the whole recess and meeting the facade plane, which is what makes
 * a slim dark frame legible from outside; the glass stays at the back.
 */
function layerDepths(wall: FacadeWall, params: OpeningParams) {
  const perimeter: Range = wall.skin ? [0.02, params.skinDepth] : [0, params.frameDepth];
  const glassAt = wall.skin ? params.skinDepth * 0.22 : params.frameDepth * 0.16;
  const mullion: Range = [glassAt - 0.015, glassAt + params.frameDepth * 0.8];
  return { perimeter, mullion, glassAt };
}

/** Outer frame, vertical mullions, and an optional transom. */
function buildFrame(
  wall: FacadeWall,
  opening: WallOpening,
  params: OpeningParams,
  frames: BoxSpec[],
  perimeter: Range,
  mullion: Range,
): void {
  const { frameWidth: fw } = params;
  const [a0, a1] = opening.across;
  const [y0, y1] = opening.y;
  const [d0, d1] = perimeter;
  const [m0, m1] = mullion;

  frames.push(
    wallBox(`${opening.key}-sill`, wall, opening.across, [y0, y0 + fw], d0, d1),
    wallBox(`${opening.key}-head`, wall, opening.across, [y1 - fw, y1], d0, d1),
    wallBox(`${opening.key}-jamb-a`, wall, [a0, a0 + fw], [y0, y1], d0, d1),
    wallBox(`${opening.key}-jamb-b`, wall, [a1 - fw, a1], [y0, y1], d0, d1),
  );

  const divisions = mullionCount(opening, params);
  const step = span(opening.across) / (divisions + 1);
  for (let i = 1; i <= divisions; i += 1) {
    const at = a0 + step * i;
    frames.push(
      wallBox(`${opening.key}-mullion-${i}`, wall, [at - fw / 2, at + fw / 2], [y0, y1], m0, m1),
    );
  }

  if (opening.transomY !== undefined) {
    frames.push(
      wallBox(
        `${opening.key}-transom`,
        wall,
        opening.across,
        [opening.transomY - fw / 2, opening.transomY + fw / 2],
        m0,
        m1,
      ),
    );
  }
}

/** A fixed window: frame set back inside the skin recess, glass behind it. */
function buildWindow(
  wall: FacadeWall,
  opening: WallOpening,
  params: OpeningParams,
  out: OpeningsGeometry,
): void {
  const { frameWidth: fw, glassThickness: gt } = params;
  const { perimeter, mullion, glassAt } = layerDepths(wall, params);
  buildFrame(wall, opening, params, out.windows.frames, perimeter, mullion);

  const pane = wallBox(
    `${opening.key}-glass`,
    wall,
    [opening.across[0] + fw, opening.across[1] - fw],
    [opening.y[0] + fw, opening.y[1] - fw],
    glassAt,
    glassAt + gt,
  );
  (opening.solidBehind ? out.windows.glassOpaque : out.windows.glassClear).push(pane);
}

/**
 * A sliding door. Leaves alternate between two tracks so the assembly reads
 * as sliding panels rather than one fixed sheet, and the bottom rail is
 * dropped into a recessed threshold instead of standing on the floor.
 */
function buildSlidingDoor(
  wall: FacadeWall,
  opening: WallOpening,
  params: OpeningParams,
  out: OpeningsGeometry,
): void {
  const { frameDepth: fd, frameWidth: fw, glassThickness: gt } = params;
  const leaves = mullionCount(opening, params) + 1;
  const a0 = opening.across[0];
  const [y0, y1] = opening.y;
  const { perimeter, mullion, glassAt } = layerDepths(wall, params);

  buildFrame(wall, opening, params, out.sliding.frames, perimeter, mullion);

  out.sliding.thresholds.push(
    wallBox(
      `${opening.key}-threshold`,
      wall,
      opening.across,
      [y0 - 0.1, y0 + 0.02],
      perimeter[0],
      perimeter[1],
    ),
  );

  const step = span(opening.across) / leaves;
  for (let i = 0; i < leaves; i += 1) {
    // Alternating track depth is what makes the leaves read as overlapping.
    const track = glassAt + (i % 2 === 0 ? 0 : fd * 0.35);
    const pane = wallBox(
      `${opening.key}-leaf-${i}`,
      wall,
      [a0 + step * i + fw, a0 + step * (i + 1) - fw],
      [y0 + fw, y1 - fw],
      track,
      track + gt,
    );
    (opening.solidBehind ? out.sliding.glassOpaque : out.sliding.glassClear).push(pane);
  }
}

/**
 * An oversized pivot entrance: a slim surround, a solid leaf offset toward
 * one jamb, a glazed sidelight filling the rest, and a single tall handle.
 */
function buildEntranceDoor(
  wall: FacadeWall,
  opening: WallOpening,
  params: OpeningParams,
  out: OpeningsGeometry,
): void {
  const { frameDepth: fd, frameWidth: fw, glassThickness: gt } = params;
  const [a0, a1] = opening.across;
  const [y0, y1] = opening.y;

  const { perimeter, mullion } = layerDepths(wall, params);
  buildFrame(wall, { ...opening, mullions: 0 }, params, out.entrance.frames, perimeter, mullion);

  const leafWidth = Math.min(1.7, span(opening.across) * 0.66);
  const leafA0 = a0 + fw;
  const leafA1 = leafA0 + leafWidth;
  const leafDepth = fd * 0.9;

  out.entrance.leaf.push(
    wallBox(
      `${opening.key}-leaf`,
      wall,
      [leafA0, leafA1],
      [y0 + 0.02, y1 - fw],
      fd * 0.15,
      fd * 0.15 + leafDepth,
    ),
  );

  // Sidelight glazing fills the remainder of the opening.
  if (a1 - fw - leafA1 > 0.2) {
    const glassAt = fd * 0.35;
    out.entrance.glassClear.push(
      wallBox(
        `${opening.key}-sidelight`,
        wall,
        [leafA1 + 0.04, a1 - fw],
        [y0 + fw, y1 - fw],
        glassAt,
        glassAt + gt,
      ),
    );
  }

  const handleAt = leafA1 - 0.14;
  const handleDepth = wall.face + (fd * 0.15 + leafDepth + 0.05) * wall.facing;
  const handleY: Range = [y0 + (y1 - y0) * 0.34, y0 + (y1 - y0) * 0.34 + 1.3];
  out.entrance.handle.push(
    wall.axis === 'z'
      ? column(`${opening.key}-handle`, handleAt, handleDepth, handleY, 0.028)
      : column(`${opening.key}-handle`, handleDepth, handleAt, handleY, 0.028),
  );
}

/**
 * Resolves a facade schedule into geometry. Pure and deterministic, so the
 * whole result can be memoised alongside the villa layout.
 */
export function buildOpenings(
  walls: readonly FacadeWall[],
  params: OpeningParams,
): OpeningsGeometry {
  const out: OpeningsGeometry = {
    skin: [],
    skinStone: [],
    skinReveals: [],
    windows: emptyAssembly(),
    sliding: emptyAssembly(),
    entrance: { ...emptyAssembly(), leaf: [], handle: [] },
  };

  walls.forEach((wall) => {
    buildSkin(wall, params, out);

    wall.openings.forEach((opening) => {
      if (opening.kind === 'sliding') buildSlidingDoor(wall, opening, params, out);
      else if (opening.kind === 'entrance') buildEntranceDoor(wall, opening, params, out);
      else buildWindow(wall, opening, params, out);
    });
  });

  return out;
}
