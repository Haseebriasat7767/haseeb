import type { BoxSpec, ColumnSpec, Range } from '../VillaTypes';
import { box, column, mid, span } from '../SpecBuilders';

/**
 * Which way a piece of furniture looks. Everything below is authored once,
 * in the piece's own terms — across its width, up from its floor, and back
 * from its front — and mapped onto world axes from this. A sofa is written
 * the same way whether it ends up against the north wall or the east one.
 */
export type Facing = 'north' | 'south' | 'east' | 'west';

/**
 * Furniture, sorted by the material it is made of rather than by the piece
 * it belongs to. Every bucket becomes exactly one merged mesh, so an entire
 * furnished residence costs about a dozen draw calls.
 */
export type Parts = {
  /** Timber cabinetry, table tops, bed frames, built-ins. */
  joinery: BoxSpec[];
  /** Primary upholstery — sofas, beds, headboards. */
  soft: BoxSpec[];
  /** Accent upholstery — occasional chairs, stools, throws. */
  softDark: BoxSpec[];
  /** Marble tops, hearths, vanity slabs. */
  stone: BoxSpec[];
  /** Bronze legs, rails, frames, and hardware. */
  metal: BoxSpec[];
  /** Blackened steel — firebox linings, screens, appliance fronts. */
  dark: BoxSpec[];
  /** Sanitaryware and tableware. */
  ceramic: BoxSpec[];
  /** Screens, balustrades, glazed table tops, dark display panels. */
  glass: BoxSpec[];
  /** Wool rugs. */
  rugs: BoxSpec[];
  /** Emissive fixture faces and integrated joinery lighting. */
  glow: BoxSpec[];
  /** Plaster reveals, niches, and feature-wall panels. */
  plaster: BoxSpec[];
  /** Turned elements — pendant stems, lamp columns, rails. */
  posts: ColumnSpec[];
  /** Heavy curtain panels, gathered at the ends of an opening. */
  drapery: BoxSpec[];
  /** The sheer layer behind them — translucent, and lit from outside. */
  sheer: BoxSpec[];
  /** Books, artwork canvas edges, paper. */
  paper: BoxSpec[];
  /** Indoor planting. */
  foliage: BoxSpec[];
};

export function emptyParts(): Parts {
  return {
    joinery: [],
    soft: [],
    softDark: [],
    stone: [],
    metal: [],
    dark: [],
    ceramic: [],
    glass: [],
    rugs: [],
    glow: [],
    plaster: [],
    posts: [],
    drapery: [],
    sheer: [],
    paper: [],
    foliage: [],
  };
}

/**
 * Builds a volume in a piece's own frame: `a` runs across its width from
 * the centre, `y` is height above the floor, and `d` is depth measured back
 * from its front face. The returned function handles all four orientations,
 * which is what makes every builder below orientation-agnostic.
 */
type Local = (key: string, a: Range, y: Range, d: Range) => BoxSpec;

function localFrame(facing: Facing, cx: number, cz: number, deep: number, floorY: number): Local {
  const half = deep / 2;
  return (key, a, y, d) => {
    const yy: Range = [floorY + y[0], floorY + y[1]];
    switch (facing) {
      case 'south':
        return box(key, [cx + a[0], cx + a[1]], yy, [cz + half - d[1], cz + half - d[0]]);
      case 'north':
        return box(key, [cx - a[1], cx - a[0]], yy, [cz - half + d[0], cz - half + d[1]]);
      case 'east':
        return box(key, [cx + half - d[1], cx + half - d[0]], yy, [cz - a[1], cz - a[0]]);
      case 'west':
        return box(key, [cx - half + d[0], cx - half + d[1]], yy, [cz + a[0], cz + a[1]]);
    }
  };
}

/** World-space footprint of a piece described by its width, depth, and facing. */
function footprint(
  facing: Facing,
  cx: number,
  cz: number,
  width: number,
  depth: number,
): [Range, Range] {
  const alongX = facing === 'north' || facing === 'south';
  const halfX = (alongX ? width : depth) / 2;
  const halfZ = (alongX ? depth : width) / 2;
  return [
    [cx - halfX, cx + halfX],
    [cz - halfZ, cz + halfZ],
  ];
}

/** A slim leg at each corner of a footprint, used by tables and seating. */
function legs(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  floorY: number,
  topY: number,
  thickness: number,
  inset: number,
): void {
  const xs: Range[] = [
    [x[0] + inset, x[0] + inset + thickness],
    [x[1] - inset - thickness, x[1] - inset],
  ];
  const zs: Range[] = [
    [z[0] + inset, z[0] + inset + thickness],
    [z[1] - inset - thickness, z[1] - inset],
  ];
  xs.forEach((lx, i) =>
    zs.forEach((lz, j) => {
      parts.metal.push(box(`${key}-leg-${i}${j}`, lx, [floorY, topY], lz));
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Seating
// ─────────────────────────────────────────────────────────────────────────

/**
 * A deep sectional sofa: a timber plinth, split seat cushions, a full-width
 * back, and two arms. Splitting the seat is what stops it reading as one
 * extruded block from across a room.
 */
export function createSofa(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  width: number,
  depth: number,
  facing: Facing,
): void {
  const at = localFrame(facing, cx, cz, depth, floorY);
  const half = width / 2;
  const arm = 0.24;

  parts.joinery.push(at(`${key}-plinth`, [-half, half], [0.05, 0.3], [0.08, depth - 0.05]));
  parts.softDark.push(at(`${key}-shadow`, [-half, half], [0.0, 0.05], [0.12, depth - 0.09]));

  // Cushions, separated and individually nudged.
  //
  // They were flush blocks butted edge to edge, which is what made the sofa
  // read as a bench with lines drawn on it. Real seat cushions sit proud of
  // the frame, have a gap between them, and are never quite level with each
  // other; the deterministic wobble below is small enough to read as use
  // rather than as damage.
  const seats = Math.max(2, Math.round(width / 1.1));
  const step = (width - arm * 2) / seats;
  for (let i = 0; i < seats; i += 1) {
    const a0 = -half + arm + step * i;
    const settle = ((Math.sin(i * 12.9898 + width) * 43758.5453) % 1) * 0.02;
    parts.soft.push(
      at(
        `${key}-seat-${i}`,
        [a0 + 0.035, a0 + step - 0.035],
        [0.3, 0.46 - settle],
        [0.07, depth - 0.48],
      ),
    );
    parts.soft.push(
      at(
        `${key}-back-${i}`,
        [a0 + 0.045, a0 + step - 0.045],
        [0.46 - settle, 0.8 - settle * 1.5],
        [depth - 0.52, depth - 0.14],
      ),
    );
  }

  parts.soft.push(at(`${key}-back-rail`, [-half, half], [0.3, 0.86], [depth - 0.24, depth - 0.05]));
  parts.soft.push(at(`${key}-arm-a`, [-half, -half + arm], [0.3, 0.66], [0.08, depth - 0.05]));
  parts.soft.push(at(`${key}-arm-b`, [half - arm, half], [0.3, 0.66], [0.08, depth - 0.05]));

  // Cushions leaning into the back, at the two inner corners.
  parts.softDark.push(
    at(
      `${key}-cushion-a`,
      [-half + 0.34, -half + 0.78],
      [0.44, 0.78],
      [depth - 0.56, depth - 0.44],
    ),
  );
  parts.softDark.push(
    at(`${key}-cushion-b`, [half - 0.78, half - 0.34], [0.44, 0.78], [depth - 0.56, depth - 0.44]),
  );
}

/** A low lounge chair — the same anatomy as the sofa, at a single seat. */
export function createArmchair(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  facing: Facing,
  width = 0.9,
  depth = 0.86,
): void {
  const at = localFrame(facing, cx, cz, depth, floorY);
  const half = width / 2;

  parts.softDark.push(at(`${key}-seat`, [-half, half], [0.34, 0.46], [0.06, depth - 0.22]));
  parts.softDark.push(at(`${key}-back`, [-half, half], [0.34, 0.82], [depth - 0.22, depth - 0.04]));
  parts.softDark.push(
    at(`${key}-arm-a`, [-half, -half + 0.11], [0.34, 0.62], [0.06, depth - 0.04]),
  );
  parts.softDark.push(at(`${key}-arm-b`, [half - 0.11, half], [0.34, 0.62], [0.06, depth - 0.04]));

  const [fx, fz] = footprint(facing, cx, cz, width, depth);
  legs(parts, key, fx, fz, floorY, floorY + 0.34, 0.05, 0.08);
}

/** A dining chair: seat, upright back, four slim legs. */
export function createDiningChair(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  facing: Facing,
): void {
  const width = 0.48;
  const depth = 0.5;
  const at = localFrame(facing, cx, cz, depth, floorY);
  const half = width / 2;

  parts.softDark.push(at(`${key}-seat`, [-half, half], [0.44, 0.51], [0.02, depth - 0.02]));
  parts.softDark.push(at(`${key}-back`, [-half, half], [0.51, 0.94], [depth - 0.09, depth - 0.02]));

  const [fx, fz] = footprint(facing, cx, cz, width, depth);
  legs(parts, key, fx, fz, floorY, floorY + 0.45, 0.035, 0.03);
}

/** A counter or island stool — round seat on a slim column. */
export function createStool(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  seatY: number,
): void {
  parts.posts.push(column(`${key}-stem`, cx, cz, [floorY, floorY + seatY], 0.04));
  parts.metal.push(
    box(`${key}-foot`, [cx - 0.17, cx + 0.17], [floorY, floorY + 0.03], [cz - 0.17, cz + 0.17]),
  );
  parts.softDark.push(
    box(
      `${key}-seat`,
      [cx - 0.19, cx + 0.19],
      [floorY + seatY, floorY + seatY + 0.09],
      [cz - 0.19, cz + 0.19],
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tables and surfaces
// ─────────────────────────────────────────────────────────────────────────

/** A low table: a stone slab on a recessed metal plinth. */
export function createCoffeeTable(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  width: number,
  depth: number,
): void {
  const x: Range = [cx - width / 2, cx + width / 2];
  const z: Range = [cz - depth / 2, cz + depth / 2];
  parts.stone.push(box(`${key}-top`, x, [floorY + 0.32, floorY + 0.4], z));
  parts.metal.push(
    box(
      `${key}-plinth`,
      [x[0] + 0.18, x[1] - 0.18],
      [floorY + 0.02, floorY + 0.32],
      [z[0] + 0.14, z[1] - 0.14],
    ),
  );
}

/** A small occasional table beside a chair or bed. */
export function createSideTable(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  size = 0.44,
): void {
  const x: Range = [cx - size / 2, cx + size / 2];
  const z: Range = [cz - size / 2, cz + size / 2];
  parts.stone.push(box(`${key}-top`, x, [floorY + 0.5, floorY + 0.56], z));
  parts.posts.push(column(`${key}-stem`, cx, cz, [floorY + 0.02, floorY + 0.5], 0.035));
  parts.metal.push(
    box(`${key}-base`, [cx - 0.16, cx + 0.16], [floorY, floorY + 0.02], [cz - 0.16, cz + 0.16]),
  );
}

/**
 * A dining table with chairs down both long sides and one at each end.
 * `seatDensity` thins the chair count on weaker tiers without changing the
 * table itself, so the room still reads correctly.
 */
export function createDiningSet(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  width: number,
  depth: number,
  seatDensity: number,
): void {
  const x: Range = [cx - width / 2, cx + width / 2];
  const z: Range = [cz - depth / 2, cz + depth / 2];

  parts.joinery.push(box(`${key}-top`, x, [floorY + 0.71, floorY + 0.78], z));
  parts.joinery.push(
    box(
      `${key}-apron`,
      [x[0] + 0.1, x[1] - 0.1],
      [floorY + 0.63, floorY + 0.71],
      [z[0] + 0.08, z[1] - 0.08],
    ),
  );
  const trestles: Range[] = [
    [x[0] + 0.35, x[0] + 0.5],
    [x[1] - 0.5, x[1] - 0.35],
  ];
  trestles.forEach((lx, i) => {
    parts.metal.push(
      box(`${key}-trestle-${i}`, lx, [floorY, floorY + 0.63], [z[0] + 0.2, z[1] - 0.2]),
    );
  });

  const perSide = Math.max(1, Math.round((width / 0.72) * seatDensity));
  const step = width / perSide;
  for (let i = 0; i < perSide; i += 1) {
    const at = x[0] + step * (i + 0.5);
    createDiningChair(parts, `${key}-chair-n-${i}`, at, z[0] - 0.36, floorY, 'north');
    createDiningChair(parts, `${key}-chair-s-${i}`, at, z[1] + 0.36, floorY, 'south');
  }
}

/** A console or sideboard against a wall. */
export function createConsole(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  width: number,
  facing: Facing,
  depth = 0.44,
): void {
  const at = localFrame(facing, cx, cz, depth, floorY);
  const half = width / 2;
  parts.joinery.push(at(`${key}-body`, [-half, half], [0.16, 0.78], [0.02, depth - 0.02]));
  parts.joinery.push(at(`${key}-top`, [-half - 0.02, half + 0.02], [0.78, 0.83], [0, depth]));
  parts.metal.push(
    at(`${key}-rail`, [-half + 0.1, half - 0.1], [0.06, 0.16], [0.08, depth - 0.08]),
  );
  // A shadow gap under the carcass makes it read as hung, not sitting.
  parts.glow.push(at(`${key}-underlight`, [-half + 0.2, half - 0.2], [0.14, 0.16], [0.06, 0.1]));
}

// ─────────────────────────────────────────────────────────────────────────
// Joinery and built-ins
// ─────────────────────────────────────────────────────────────────────────

/**
 * A full-height run of cabinetry with vertical shadow reveals between the
 * doors — the reveals are what make a wall of joinery read as cabinetry
 * rather than a plain panel, and they cost one thin box each.
 */
export function createBuiltIn(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  y: Range,
  doorWidth = 0.9,
): void {
  parts.joinery.push(box(`${key}-carcass`, x, y, z));

  const doors = Math.max(1, Math.round(span(x) / doorWidth));
  const step = span(x) / doors;
  const face: Range = [z[1] - 0.02, z[1] + 0.006];
  for (let i = 1; i < doors; i += 1) {
    const at = x[0] + step * i;
    parts.metal.push(box(`${key}-reveal-${i}`, [at - 0.008, at + 0.008], [y[0], y[1]], face));
  }
}

/**
 * An open shelving wall: a carcass, horizontal shelves, and a warm strip
 * washing each one. Used in the library and study.
 */
export function createShelving(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  y: Range,
  shelfCount: number,
): void {
  const back: Range = [z[0], z[0] + 0.04];
  parts.joinery.push(box(`${key}-back`, x, y, back));
  parts.joinery.push(box(`${key}-side-a`, [x[0], x[0] + 0.05], y, z));
  parts.joinery.push(box(`${key}-side-b`, [x[1] - 0.05, x[1]], y, z));

  const step = span(y) / shelfCount;
  for (let i = 0; i <= shelfCount; i += 1) {
    const at = y[0] + step * i;
    parts.joinery.push(box(`${key}-shelf-${i}`, x, [at - 0.02, at + 0.02], z));
    if (i < shelfCount) {
      parts.glow.push(
        box(
          `${key}-wash-${i}`,
          [x[0] + 0.08, x[1] - 0.08],
          [at + 0.02, at + 0.05],
          [z[0] + 0.05, z[0] + 0.11],
        ),
      );
    }
  }
}

/**
 * A kitchen or utility run: base cabinets, a stone worktop, an upstand, and
 * an optional band of wall units above.
 */
export function createCounterRun(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  floorY: number,
  options: { upper?: boolean; upperFrom?: number } = {},
): void {
  parts.joinery.push(box(`${key}-base`, x, [floorY + 0.1, floorY + 0.86], [z[0], z[1] - 0.02]));
  parts.metal.push(box(`${key}-plinth`, [x[0], x[1]], [floorY, floorY + 0.1], [z[0], z[1] - 0.09]));
  parts.stone.push(box(`${key}-top`, x, [floorY + 0.86, floorY + 0.92], z));
  parts.stone.push(box(`${key}-upstand`, x, [floorY + 0.92, floorY + 1.42], [z[0], z[0] + 0.03]));
  parts.glow.push(
    box(
      `${key}-task`,
      [x[0] + 0.1, x[1] - 0.1],
      [floorY + 1.4, floorY + 1.44],
      [z[0] + 0.03, z[0] + 0.16],
    ),
  );

  if (options.upper) {
    const from = options.upperFrom ?? floorY + 1.5;
    createBuiltIn(parts, `${key}-wall-units`, x, [z[0], z[0] + 0.36], [from, from + 0.9]);
  }
}

/** A kitchen island: a solid body, an overhanging stone top, and stools. */
export function createIsland(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  floorY: number,
  stools: number,
): void {
  parts.joinery.push(box(`${key}-body`, [x[0], x[1] - 0.45], [floorY + 0.08, floorY + 0.86], z));
  parts.metal.push(
    box(
      `${key}-plinth`,
      [x[0] + 0.05, x[1] - 0.5],
      [floorY, floorY + 0.08],
      [z[0] + 0.05, z[1] - 0.05],
    ),
  );
  parts.stone.push(
    box(
      `${key}-top`,
      [x[0] - 0.04, x[1]],
      [floorY + 0.86, floorY + 0.94],
      [z[0] - 0.04, z[1] + 0.04],
    ),
  );
  // A slim sink recess reads as a working island rather than a plinth.
  parts.metal.push(
    box(
      `${key}-sink`,
      [x[0] + 0.5, x[0] + 1.4],
      [floorY + 0.84, floorY + 0.87],
      [z[0] + 0.18, z[1] - 0.18],
    ),
  );

  const step = span(z) / Math.max(1, stools);
  for (let i = 0; i < stools; i += 1) {
    createStool(parts, `${key}-stool-${i}`, x[1] + 0.42, z[0] + step * (i + 0.5), floorY, 0.66);
  }
}

/** A low media unit with a dark screen panel above it. */
export function createMediaUnit(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  floorY: number,
): void {
  parts.joinery.push(box(`${key}-body`, x, [floorY + 0.18, floorY + 0.62], z));
  parts.glow.push(
    box(
      `${key}-underlight`,
      [x[0] + 0.2, x[1] - 0.2],
      [floorY + 0.16, floorY + 0.18],
      [z[0] + 0.06, z[1] - 0.06],
    ),
  );
  parts.glass.push(
    box(
      `${key}-screen`,
      [mid(x) - 0.85, mid(x) + 0.85],
      [floorY + 0.95, floorY + 1.92],
      [z[0] + 0.02, z[0] + 0.07],
    ),
  );
}

/** A writing desk with a chair pulled up to it. */
export function createDesk(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  facing: Facing,
  width = 1.7,
): void {
  const depth = 0.72;
  const at = localFrame(facing, cx, cz, depth, floorY);
  const half = width / 2;
  parts.joinery.push(at(`${key}-top`, [-half, half], [0.72, 0.78], [0, depth]));
  parts.joinery.push(
    at(`${key}-drawer`, [half - 0.62, half - 0.06], [0.5, 0.72], [0.08, depth - 0.06]),
  );
  parts.metal.push(
    at(`${key}-leg-a`, [-half + 0.06, -half + 0.12], [0, 0.72], [0.08, depth - 0.08]),
  );
  parts.metal.push(at(`${key}-leg-b`, [half - 0.12, half - 0.06], [0, 0.72], [0.08, depth - 0.08]));
}

// ─────────────────────────────────────────────────────────────────────────
// Bedrooms
// ─────────────────────────────────────────────────────────────────────────

/**
 * A bed: an upholstered headboard against the wall behind it, a timber
 * platform, mattress, folded throw, and pillows. `facing` is the direction
 * you look when lying in it.
 */
export function createBed(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  width: number,
  length: number,
  facing: Facing,
): void {
  const at = localFrame(facing, cx, cz, length, floorY);
  const half = width / 2;

  parts.soft.push(
    at(`${key}-headboard`, [-half - 0.22, half + 0.22], [0.3, 1.25], [length - 0.12, length]),
  );
  parts.joinery.push(at(`${key}-platform`, [-half, half], [0.12, 0.36], [0.06, length - 0.12]));
  parts.softDark.push(
    at(`${key}-shadow`, [-half + 0.04, half - 0.04], [0, 0.12], [0.1, length - 0.16]),
  );
  parts.soft.push(
    at(`${key}-mattress`, [-half + 0.02, half - 0.02], [0.36, 0.62], [0.08, length - 0.14]),
  );
  parts.softDark.push(
    at(`${key}-throw`, [-half + 0.02, half - 0.02], [0.6, 0.66], [0.1, length * 0.42]),
  );

  const pillow = width / 2 - 0.12;
  parts.soft.push(
    at(`${key}-pillow-a`, [-pillow, -0.06], [0.62, 0.78], [length - 0.7, length - 0.24]),
  );
  parts.soft.push(
    at(`${key}-pillow-b`, [0.06, pillow], [0.62, 0.78], [length - 0.7, length - 0.24]),
  );
}

/** A bedside cabinet with a lamp on it. */
export function createNightstand(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  lamp: boolean,
): void {
  parts.joinery.push(
    box(
      `${key}-body`,
      [cx - 0.26, cx + 0.26],
      [floorY + 0.22, floorY + 0.56],
      [cz - 0.22, cz + 0.22],
    ),
  );
  parts.metal.push(
    box(`${key}-base`, [cx - 0.2, cx + 0.2], [floorY, floorY + 0.22], [cz - 0.16, cz + 0.16]),
  );
  if (!lamp) return;
  parts.posts.push(column(`${key}-lamp-stem`, cx, cz, [floorY + 0.56, floorY + 0.86], 0.02));
  parts.glow.push(
    box(
      `${key}-lamp-shade`,
      [cx - 0.13, cx + 0.13],
      [floorY + 0.86, floorY + 1.06],
      [cz - 0.13, cz + 0.13],
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bathrooms
// ─────────────────────────────────────────────────────────────────────────

/** A vanity: cabinet, stone slab, inset basin, and a lit mirror behind it. */
export function createVanity(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  floorY: number,
  ceilingY: number,
): void {
  parts.joinery.push(box(`${key}-cabinet`, x, [floorY + 0.35, floorY + 0.82], [z[0], z[1] - 0.02]));
  parts.stone.push(box(`${key}-top`, x, [floorY + 0.82, floorY + 0.9], z));
  parts.ceramic.push(
    box(
      `${key}-basin`,
      [mid(x) - 0.28, mid(x) + 0.28],
      [floorY + 0.9, floorY + 1.02],
      [z[0] + 0.12, z[1] - 0.08],
    ),
  );
  parts.posts.push(column(`${key}-tap`, mid(x), z[0] + 0.12, [floorY + 0.9, floorY + 1.18], 0.018));
  parts.glow.push(
    box(
      `${key}-underlight`,
      [x[0] + 0.1, x[1] - 0.1],
      [floorY + 0.33, floorY + 0.35],
      [z[0] + 0.06, z[1] - 0.1],
    ),
  );

  const mirrorTop = Math.min(ceilingY - 0.5, floorY + 2.2);
  parts.glass.push(
    box(
      `${key}-mirror`,
      [x[0] + 0.06, x[1] - 0.06],
      [floorY + 1.15, mirrorTop],
      [z[0] + 0.01, z[0] + 0.04],
    ),
  );
  parts.glow.push(
    box(
      `${key}-mirror-light`,
      [x[0] + 0.06, x[1] - 0.06],
      [mirrorTop, mirrorTop + 0.04],
      [z[0] + 0.01, z[0] + 0.08],
    ),
  );
}

/** A freestanding stone bath — an open shell rather than a solid block. */
export function createBathtub(parts: Parts, key: string, x: Range, z: Range, floorY: number): void {
  const rim = 0.09;
  const top = floorY + 0.56;
  parts.ceramic.push(box(`${key}-floor`, x, [floorY + 0.06, floorY + 0.22], z));
  parts.ceramic.push(box(`${key}-side-a`, [x[0], x[0] + rim], [floorY + 0.06, top], z));
  parts.ceramic.push(box(`${key}-side-b`, [x[1] - rim, x[1]], [floorY + 0.06, top], z));
  parts.ceramic.push(
    box(`${key}-end-a`, [x[0] + rim, x[1] - rim], [floorY + 0.06, top], [z[0], z[0] + rim]),
  );
  parts.ceramic.push(
    box(`${key}-end-b`, [x[0] + rim, x[1] - rim], [floorY + 0.06, top], [z[1] - rim, z[1]]),
  );
  parts.metal.push(
    box(
      `${key}-shadow`,
      [x[0] + 0.06, x[1] - 0.06],
      [floorY, floorY + 0.06],
      [z[0] + 0.06, z[1] - 0.06],
    ),
  );
}

/** A walk-in shower: stone tray, a frameless glass screen, and a rain head. */
export function createShower(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  floorY: number,
  screenHeight: number,
): void {
  parts.stone.push(box(`${key}-tray`, x, [floorY, floorY + 0.03], z));
  parts.glass.push(
    box(`${key}-screen`, [x[1] - 0.012, x[1] + 0.012], [floorY + 0.03, floorY + screenHeight], z),
  );
  parts.metal.push(
    box(
      `${key}-screen-post`,
      [x[1] - 0.03, x[1] + 0.03],
      [floorY + 0.03, floorY + screenHeight],
      [z[1] - 0.03, z[1]],
    ),
  );
  parts.metal.push(
    box(
      `${key}-head`,
      [mid(x) - 0.14, mid(x) + 0.14],
      [floorY + 2.24, floorY + 2.27],
      [mid(z) - 0.14, mid(z) + 0.14],
    ),
  );
}

/** A wall-hung WC on a duct panel. */
export function createWC(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  facing: Facing,
): void {
  const at = localFrame(facing, cx, cz, 0.62, floorY);
  parts.plaster.push(at(`${key}-duct`, [-0.3, 0.3], [0, 1.05], [0.42, 0.62]));
  parts.ceramic.push(at(`${key}-pan`, [-0.19, 0.19], [0.4, 0.58], [0.04, 0.44]));
  parts.ceramic.push(at(`${key}-seat`, [-0.19, 0.19], [0.58, 0.61], [0.06, 0.42]));
  parts.metal.push(at(`${key}-plate`, [-0.11, 0.11], [0.9, 1.04], [0.4, 0.43]));
}

// ─────────────────────────────────────────────────────────────────────────
// Soft furnishing, lighting, and architectural detail
// ─────────────────────────────────────────────────────────────────────────

/** A wool rug, laid just above the floor finish. */
export function createRug(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  width: number,
  depth: number,
): void {
  parts.rugs.push(
    box(
      key,
      [cx - width / 2, cx + width / 2],
      [floorY + 0.004, floorY + 0.022],
      [cz - depth / 2, cz + depth / 2],
    ),
  );
}

/** A pendant on a slim drop, hung from a ceiling. */
export function createPendant(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  ceilingY: number,
  drop: number,
  radius: number,
): void {
  parts.posts.push(column(`${key}-drop`, cx, cz, [ceilingY - drop, ceilingY], 0.012));
  parts.metal.push(
    box(
      `${key}-canopy`,
      [cx - 0.07, cx + 0.07],
      [ceilingY - 0.03, ceilingY],
      [cz - 0.07, cz + 0.07],
    ),
  );
  parts.glow.push(
    box(
      `${key}-shade`,
      [cx - radius, cx + radius],
      [ceilingY - drop - radius * 0.9, ceilingY - drop],
      [cz - radius, cz + radius],
    ),
  );
}

/** A floor lamp beside a seat. */
export function createFloorLamp(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
): void {
  parts.metal.push(
    box(`${key}-base`, [cx - 0.16, cx + 0.16], [floorY, floorY + 0.03], [cz - 0.16, cz + 0.16]),
  );
  parts.posts.push(column(`${key}-stem`, cx, cz, [floorY + 0.03, floorY + 1.42], 0.018));
  parts.glow.push(
    box(
      `${key}-shade`,
      [cx - 0.17, cx + 0.17],
      [floorY + 1.42, floorY + 1.66],
      [cz - 0.17, cz + 0.17],
    ),
  );
}

/** A continuous cove strip washing a wall or ceiling junction. */
export function createCove(parts: Parts, key: string, x: Range, z: Range, y: number): void {
  parts.glow.push(box(key, x, [y - 0.035, y], z));
}

/**
 * A recessed display niche: a plaster back set into the wall, a shadow
 * reveal around it, and a light washing down its face.
 */
export function createNiche(parts: Parts, key: string, x: Range, z: Range, y: Range): void {
  parts.plaster.push(box(`${key}-back`, x, y, z));
  parts.metal.push(box(`${key}-reveal-a`, [x[0] - 0.03, x[0]], y, z));
  parts.metal.push(box(`${key}-reveal-b`, [x[1], x[1] + 0.03], y, z));
  parts.glow.push(box(`${key}-wash`, [x[0], x[1]], [y[1] - 0.03, y[1]], [z[0], z[1] + 0.06]));
}

/**
 * A stone fireplace: a full-height surround, a recessed firebox, and the
 * fire itself as an emissive band.
 */
export function createFireplace(
  parts: Parts,
  key: string,
  x: Range,
  z: Range,
  floorY: number,
  height: number,
): void {
  const top = floorY + height;
  const openingX: Range = [mid(x) - 0.8, mid(x) + 0.8];
  // The opening sits above seat-back height so it stays legible across the
  // room rather than disappearing behind the sofa in front of it.
  const sillY = floorY + 0.62;
  const lintelY = floorY + 1.95;

  parts.stone.push(box(`${key}-jamb-a`, [x[0], openingX[0]], [floorY, top], z));
  parts.stone.push(box(`${key}-jamb-b`, [openingX[1], x[1]], [floorY, top], z));
  parts.stone.push(box(`${key}-head`, openingX, [lintelY, top], z));
  parts.stone.push(box(`${key}-hearth`, openingX, [floorY, sillY], z));

  // The firebox lines the inside of the surround — back plate, then a
  // blackened reveal on all four sides — so the opening reads as a real
  // recess with its own shadow rather than a dark rectangle painted on the
  // wall, and the fire sits just proud of the back plate.
  const backZ: Range = [z[0], z[0] + 0.05];
  parts.dark.push(box(`${key}-back`, openingX, [sillY, lintelY], backZ));
  parts.dark.push(box(`${key}-reveal-head`, openingX, [lintelY - 0.05, lintelY], z));
  parts.dark.push(box(`${key}-reveal-sill`, openingX, [sillY, sillY + 0.05], z));
  parts.dark.push(
    box(`${key}-reveal-jamb-a`, [openingX[0], openingX[0] + 0.05], [sillY, lintelY], z),
  );
  parts.dark.push(
    box(`${key}-reveal-jamb-b`, [openingX[1] - 0.05, openingX[1]], [sillY, lintelY], z),
  );
  parts.glow.push(
    box(
      `${key}-fire`,
      [openingX[0] + 0.14, openingX[1] - 0.14],
      [sillY + 0.07, sillY + 0.5],
      [backZ[1], backZ[1] + 0.14],
    ),
  );
}

/**
 * A frameless glass balustrade with a slim top rail — the interior twin of
 * the villa's terrace railings, used at stairwells and void edges.
 */
export function createBalustrade(
  parts: Parts,
  key: string,
  axis: 'x' | 'z',
  at: number,
  run: Range,
  baseY: number,
  height: number,
): void {
  const thickness: Range = [at - 0.012, at + 0.012];
  const railThickness: Range = [at - 0.035, at + 0.035];
  const glassTop = baseY + height - 0.06;

  const shape = (t: Range, y: Range, key2: string): BoxSpec =>
    axis === 'x' ? box(key2, t, y, run) : box(key2, run, y, t);

  parts.glass.push(shape(thickness, [baseY + 0.05, glassTop], `${key}-glass`));
  parts.metal.push(shape(railThickness, [glassTop, baseY + height], `${key}-rail`));
  parts.metal.push(shape(railThickness, [baseY, baseY + 0.05], `${key}-shoe`));
}
