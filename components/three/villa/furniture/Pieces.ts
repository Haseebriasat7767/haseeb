import type { Vector3Tuple } from 'three';
import type { Form } from './FormTypes';

/**
 * The furniture catalogue, built from soft and turned forms.
 *
 * Every piece here replaces one that was previously assembled from
 * rectangular prisms. The rule the brief sets is the right one: a bevel on
 * a box is not a rounded object, and no amount of bevel makes a stack of
 * boxes into a bed. So these are authored the way the real pieces are made
 * — a frame, a filled cushion that sags, a turned base, a shade with a
 * taper — and the geometry follows from that rather than from what is
 * cheapest to describe.
 *
 * Pieces are pure: they take a placement and push forms onto a list. The
 * scene graph, the materials and the merging all happen elsewhere.
 */

/** Which way a piece faces. Yaw in radians, measured about the vertical. */
export type Facing = 'north' | 'south' | 'east' | 'west';

export const YAW: Record<Facing, number> = {
  // A piece faces the direction it looks in: 'south' looks toward +Z.
  south: 0,
  north: Math.PI,
  east: Math.PI / 2,
  west: -Math.PI / 2,
};

/** Deterministic jitter in [0,1), so a piece is the same piece every render. */
export function wobble(seed: number, index: number): number {
  const s = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Maps a point authored in a piece's own frame — across, up, forward — into
 * world space for a given facing and origin. Every builder below is written
 * once, facing forward, and works at any orientation.
 */
function place(
  origin: readonly [number, number, number],
  facing: Facing,
  across: number,
  up: number,
  forward: number,
): Vector3Tuple {
  const yaw = YAW[facing];
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    origin[0] + across * cos + forward * sin,
    origin[1] + up,
    origin[2] - across * sin + forward * cos,
  ];
}

type Placement = {
  /** Floor point the piece stands on. */
  at: readonly [number, number];
  floorY: number;
  facing: Facing;
  seed: number;
};

/**
 * A tapered leg with a rounded foot, as a turned profile.
 *
 * Legs were slim rectangular sticks, which is the detail that gives a
 * render away at floor level faster than almost anything else — real legs
 * are turned or moulded, they taper, and they meet the floor on a radius
 * rather than on a corner.
 */
function leg(
  forms: Form[],
  key: string,
  position: Vector3Tuple,
  height: number,
  topRadius: number,
  material: 'bronze' | 'joinery' | 'darkMetal' = 'bronze',
): void {
  const foot = topRadius * 0.62;
  forms.push({
    kind: 'turned',
    key,
    material,
    position,
    profile: [
      [foot * 0.55, 0],
      [foot, 0.008],
      [foot * 0.94, height * 0.18],
      [topRadius * 0.86, height * 0.62],
      [topRadius, height],
      [topRadius * 0.9, height + 0.006],
    ],
    segments: 12,
  });
}

// ── Seating ──────────────────────────────────────────────────────────────

/**
 * A deep upholstered sofa.
 *
 * Built the way one is upholstered: a plinth carrying the frame, a pair of
 * swept arms, individual seat cushions that sag under their own weight, and
 * back cushions standing slightly proud of the frame and leaning back into
 * it. The cushions are separate forms with their own seeds, so the seam
 * lines between them are real gaps and no two compress identically — which
 * is what stops a long sofa reading as one extruded slab.
 */
export function createSofa(
  forms: Form[],
  key: string,
  placement: Placement,
  options: { width?: number; depth?: number; dark?: boolean } = {},
): void {
  const { at, floorY, facing, seed } = placement;
  const width = options.width ?? 2.6;
  const depth = options.depth ?? 1.02;
  const fabric = options.dark ? 'upholsteryDark' : 'upholstery';
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  const armWidth = 0.26;
  const seatWidth = width - armWidth * 2;
  const seatTop = 0.42;

  // Plinth: the frame the whole piece sits on, held back from the floor so
  // a shadow line runs under it.
  forms.push({
    kind: 'soft',
    key: `${key}-plinth`,
    material: fabric,
    position: put(0, 0.14, 0),
    rotationY: yaw,
    size: [width - 0.06, 0.28, depth - 0.06],
    radius: 0.05,
    detail: 2,
    seed: seed + 1,
    crease: 0.004,
  });

  // Arms, swept round rather than square.
  for (const side of [-1, 1] as const) {
    forms.push({
      kind: 'soft',
      key: `${key}-arm-${side}`,
      material: fabric,
      position: put(side * (width / 2 - armWidth / 2), 0.44, -0.02),
      rotationY: yaw,
      size: [armWidth, 0.34, depth - 0.04],
      radius: 0.125,
      detail: 3,
      seed: seed + 10 + side,
      crease: 0.005,
    });
  }

  // Seat cushions. Two on a small sofa, three on a long one.
  const seats = width > 2.3 ? 3 : 2;
  const seatSpan = seatWidth / seats;
  for (let i = 0; i < seats; i += 1) {
    const across = -seatWidth / 2 + seatSpan * (i + 0.5);
    forms.push({
      kind: 'soft',
      key: `${key}-seat-${i}`,
      material: fabric,
      position: put(across, seatTop, 0.055),
      rotationY: yaw,
      size: [seatSpan - 0.022, 0.18, depth - 0.2],
      radius: 0.075,
      detail: 3,
      // A seat cushion carries weight and shows it.
      sag: 0.24 + wobble(seed, i) * 0.08,
      crease: 0.009,
      seed: seed + 20 + i,
    });
  }

  // Back cushions, leaning into the frame.
  for (let i = 0; i < seats; i += 1) {
    const across = -seatWidth / 2 + seatSpan * (i + 0.5);
    forms.push({
      kind: 'soft',
      key: `${key}-back-${i}`,
      material: fabric,
      position: put(across, 0.66, -depth / 2 + 0.24),
      rotationY: yaw,
      tiltX: -0.13,
      size: [seatSpan - 0.03, 0.46, 0.2],
      radius: 0.085,
      detail: 3,
      sag: 0.16,
      crease: 0.012,
      seed: seed + 40 + i,
    });
  }

  // Two scatter cushions, turned on the corner the way they actually land.
  for (const side of [-1, 1] as const) {
    forms.push({
      kind: 'soft',
      key: `${key}-scatter-${side}`,
      material: options.dark ? 'upholstery' : 'upholsteryDark',
      position: put(side * (seatWidth / 2 - 0.2), 0.62, -depth / 2 + 0.34),
      rotationY: yaw + side * 0.42,
      tiltX: -0.36 + wobble(seed, side + 3) * 0.16,
      size: [0.42, 0.42, 0.13],
      radius: 0.09,
      detail: 3,
      sag: 0.2,
      crease: 0.016,
      seed: seed + 60 + side,
    });
  }

  forms.push({
    kind: 'soft',
    key: `${key}-shadowgap`,
    material: 'darkMetal',
    position: put(0, 0.035, 0),
    rotationY: yaw,
    size: [width - 0.34, 0.07, depth - 0.34],
    radius: 0.02,
    detail: 1,
    seed: seed + 2,
  });
}

/**
 * An upholstered lounge chair: a curved shell on splayed legs.
 *
 * The previous chair was a seat box, a back box and four sticks, which read
 * as a waiting room. This one has a continuous shell — arms and back as one
 * swept form — a loose seat cushion inside it, and legs that are turned.
 */
export function createLoungeChair(
  forms: Form[],
  key: string,
  placement: Placement,
  options: { dark?: boolean; width?: number } = {},
): void {
  const { at, floorY, facing, seed } = placement;
  const width = options.width ?? 0.86;
  const depth = 0.82;
  const fabric = options.dark ? 'upholsteryDark' : 'upholstery';
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  const legHeight = 0.2;
  const seatY = legHeight + 0.2;

  // The seat pad, carrying the weight and showing it.
  forms.push({
    kind: 'soft',
    key: `${key}-seat`,
    material: fabric,
    position: put(0, seatY, 0.02),
    rotationY: yaw,
    size: [width, 0.19, depth - 0.06],
    radius: 0.075,
    detail: 3,
    sag: 0.28,
    crease: 0.01,
    seed: seed + 2,
  });

  // The back, raked and slightly narrower at the top.
  forms.push({
    kind: 'soft',
    key: `${key}-back`,
    material: fabric,
    position: put(0, seatY + 0.31, -depth / 2 + 0.13),
    rotationY: yaw,
    tiltX: -0.16,
    size: [width, 0.58, 0.19],
    radius: 0.09,
    detail: 3,
    taper: 0.1,
    sag: 0.12,
    crease: 0.009,
    seed: seed + 3,
  });

  // Two arms, lower than the back and swept round — the profile that reads
  // as a chair from any angle without closing the seat in.
  for (const side of [-1, 1] as const) {
    forms.push({
      kind: 'soft',
      key: `${key}-arm-${side}`,
      material: fabric,
      position: put(side * (width / 2 - 0.075), seatY + 0.16, -0.02),
      rotationY: yaw,
      size: [0.15, 0.24, depth - 0.14],
      radius: 0.072,
      detail: 3,
      crease: 0.006,
      seed: seed + 10 + side,
    });
  }

  // One scatter cushion, thrown into the corner of the seat.
  forms.push({
    kind: 'soft',
    key: `${key}-cushion`,
    material: options.dark ? 'upholstery' : 'upholsteryDark',
    position: put(-0.06, seatY + 0.26, -depth / 2 + 0.28),
    rotationY: yaw + 0.3,
    tiltX: -0.42,
    size: [0.34, 0.34, 0.11],
    radius: 0.075,
    detail: 3,
    sag: 0.24,
    crease: 0.016,
    seed: seed + 4,
  });

  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      leg(
        forms,
        `${key}-leg-${sx}-${sz}`,
        put(sx * (width / 2 - 0.11), 0, sz * (depth / 2 - 0.11)),
        legHeight,
        0.022,
      );
    }
  }
}

// ── Tables ───────────────────────────────────────────────────────────────

/**
 * A low table: a stone top on a recessed timber base.
 *
 * The top is a soft form with a small radius rather than a slab, so its
 * edge catches a highlight along its whole length — which is how a honed
 * stone top actually reads — and the base is inset so the top appears to
 * float clear of it.
 */
export function createLowTable(
  forms: Form[],
  key: string,
  placement: Placement,
  options: { width?: number; depth?: number; height?: number } = {},
): void {
  const { at, floorY, facing, seed } = placement;
  const width = options.width ?? 1.35;
  const depth = options.depth ?? 0.78;
  const height = options.height ?? 0.36;
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  forms.push({
    kind: 'soft',
    key: `${key}-top`,
    material: 'marble',
    position: put(0, height - 0.025, 0),
    rotationY: yaw,
    size: [width, 0.05, depth],
    radius: 0.014,
    detail: 2,
    seed: seed + 1,
  });

  forms.push({
    kind: 'soft',
    key: `${key}-base`,
    material: 'joinery',
    position: put(0, (height - 0.05) / 2 + 0.02, 0),
    rotationY: yaw,
    size: [width - 0.34, height - 0.07, depth - 0.28],
    radius: 0.018,
    detail: 2,
    seed: seed + 2,
  });

  // A shadow reveal under the base, so the piece does not grow out of the
  // floor.
  forms.push({
    kind: 'soft',
    key: `${key}-recess`,
    material: 'darkMetal',
    position: put(0, 0.011, 0),
    rotationY: yaw,
    size: [width - 0.42, 0.022, depth - 0.36],
    radius: 0.008,
    detail: 1,
    seed: seed + 3,
  });
}

/** A small round side table on a turned pedestal. */
export function createPedestalTable(
  forms: Form[],
  key: string,
  at: readonly [number, number],
  floorY: number,
  options: { height?: number; radius?: number; seed?: number } = {},
): void {
  const height = options.height ?? 0.52;
  const radius = options.radius ?? 0.24;

  forms.push({
    kind: 'turned',
    key: `${key}-pedestal`,
    material: 'bronze',
    position: [at[0], floorY, at[1]],
    profile: [
      [radius * 0.78, 0],
      [radius * 0.8, 0.012],
      [radius * 0.2, 0.05],
      [radius * 0.12, height * 0.55],
      [radius * 0.14, height - 0.03],
      [radius * 0.36, height - 0.02],
    ],
    segments: 20,
  });

  forms.push({
    kind: 'turned',
    key: `${key}-top`,
    material: 'marble',
    position: [at[0], floorY + height - 0.02, at[1]],
    profile: [
      [radius * 0.9, 0],
      [radius, 0.006],
      [radius, 0.032],
      [radius * 0.94, 0.038],
      [0, 0.038],
    ],
    segments: 28,
  });
}

// ── Lighting ─────────────────────────────────────────────────────────────

/**
 * A table lamp: a turned base, a stem, and a tapered shade with a warm
 * inner face.
 *
 * The shade is the piece that matters. A cylinder reads as a tin can; a
 * shade has a slight taper and a lip, and it glows from inside rather than
 * being uniformly bright, which is why the inner surface is a separate
 * emissive form set just inside the outer one.
 */
export function createTableLamp(
  forms: Form[],
  key: string,
  at: readonly [number, number],
  standY: number,
  options: { height?: number; shadeRadius?: number } = {},
): void {
  const height = options.height ?? 0.52;
  const shadeRadius = options.shadeRadius ?? 0.16;
  const shadeHeight = height * 0.42;
  const shadeBase = height - shadeHeight;

  forms.push({
    kind: 'turned',
    key: `${key}-base`,
    material: 'bronze',
    position: [at[0], standY, at[1]],
    profile: [
      [shadeRadius * 0.52, 0],
      [shadeRadius * 0.56, 0.012],
      [shadeRadius * 0.5, 0.045],
      [shadeRadius * 0.2, 0.09],
      [shadeRadius * 0.055, 0.16],
      [shadeRadius * 0.05, shadeBase],
    ],
    segments: 20,
  });

  // Outer shade: narrower at the top, with the wall thickness implied by
  // the emissive liner sitting just inside it.
  forms.push({
    kind: 'turned',
    key: `${key}-shade`,
    material: 'paper',
    position: [at[0], standY + shadeBase, at[1]],
    profile: [
      [shadeRadius, 0],
      [shadeRadius, 0.004],
      [shadeRadius * 0.82, shadeHeight - 0.004],
      [shadeRadius * 0.82, shadeHeight],
    ],
    segments: 28,
  });

  forms.push({
    kind: 'turned',
    key: `${key}-liner`,
    material: 'glow',
    position: [at[0], standY + shadeBase + 0.006, at[1]],
    profile: [
      [shadeRadius * 0.96, 0],
      [shadeRadius * 0.79, shadeHeight - 0.012],
    ],
    segments: 20,
  });
}

/** A floor lamp: the table lamp's proportions on a slim turned column. */
export function createFloorLamp(
  forms: Form[],
  key: string,
  at: readonly [number, number],
  floorY: number,
  height = 1.55,
): void {
  forms.push({
    kind: 'turned',
    key: `${key}-column`,
    material: 'bronze',
    position: [at[0], floorY, at[1]],
    profile: [
      [0.14, 0],
      [0.145, 0.014],
      [0.13, 0.026],
      [0.03, 0.06],
      [0.017, height * 0.7],
      [0.016, height - 0.34],
    ],
    segments: 20,
  });
  createTableLamp(forms, `${key}-head`, at, floorY + height - 0.36, {
    height: 0.36,
    shadeRadius: 0.19,
  });
}

// ── Bedroom ──────────────────────────────────────────────────────────────

/**
 * The bed.
 *
 * This is the single most important object in the residence's most
 * important frame, and it was six stacked rectangles. A real bed is a
 * layered soft assembly and every layer earns its place in the image:
 *
 * - an upholstered base with a recessed plinth, so the bed appears to float
 * - a mattress with a rolled edge, proud of the base on every side
 * - a fitted sheet reading as a thin bright layer over it
 * - a duvet that drapes over the sides and is turned back at the head,
 *   which is the fold that says *made bed* rather than *slab*
 * - pillows standing against the headboard, each sagging and creased
 *   differently, none of them square
 * - a folded throw across the foot
 *
 * The pillows are the tell. Four identical rounded boxes still read as
 * geometry; four forms with different sags, creases and yaws read as linen.
 */
export function createBed(
  forms: Form[],
  key: string,
  placement: Placement,
  options: { width?: number; length?: number } = {},
): void {
  const { at, floorY, facing, seed } = placement;
  const width = options.width ?? 1.94;
  const length = options.length ?? 2.08;
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  // The piece is authored with the head at negative "forward".
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  const plinthHeight = 0.12;
  const baseHeight = 0.26;
  const baseTop = plinthHeight + baseHeight;
  const mattressHeight = 0.3;
  const mattressTop = baseTop + mattressHeight;

  // Recessed plinth, so the base reads as lifted clear of the floor.
  forms.push({
    kind: 'soft',
    key: `${key}-plinth`,
    material: 'darkMetal',
    position: put(0, plinthHeight / 2, 0),
    rotationY: yaw,
    size: [width - 0.26, plinthHeight, length - 0.26],
    radius: 0.02,
    detail: 1,
    seed: seed + 1,
  });

  forms.push({
    kind: 'soft',
    key: `${key}-base`,
    material: 'upholsteryDark',
    position: put(0, plinthHeight + baseHeight / 2, 0),
    rotationY: yaw,
    size: [width, baseHeight, length],
    radius: 0.035,
    detail: 2,
    crease: 0.003,
    seed: seed + 2,
  });

  // Mattress: proud of the base, with a generous rolled edge.
  forms.push({
    kind: 'soft',
    key: `${key}-mattress`,
    material: 'upholstery',
    position: put(0, baseTop + mattressHeight / 2, 0),
    rotationY: yaw,
    size: [width - 0.05, mattressHeight, length - 0.05],
    radius: 0.075,
    detail: 3,
    sag: 0.06,
    crease: 0.005,
    seed: seed + 3,
  });

  // Duvet. In a different cloth from the sheet beneath it, because the two
  // rendered in one colour merged into a single beige slab and the bed lost
  // every layer it had. It hangs well over the sides — a duvet is wider
  // than its mattress and the drape down the side is most of what reads —
  // and stops short of the head, where the pillows sit on the sheet.
  const duvetLength = length * 0.7;
  forms.push({
    kind: 'soft',
    key: `${key}-duvet`,
    material: 'upholsteryDark',
    position: put(0, mattressTop + 0.03, length / 2 - duvetLength / 2 - 0.02),
    rotationY: yaw,
    size: [width + 0.24, 0.26, duvetLength],
    radius: 0.11,
    detail: 3,
    sag: 0.34,
    // The one place a fabric crease should be plainly visible.
    crease: 0.02,
    seed: seed + 4,
  });

  // The turn-back at the head of the duvet — a thick roll of folded fabric
  // showing the sheet inside it, which is what a made bed reads by and the
  // detail that most separates a dressed bed from a covered one.
  forms.push({
    kind: 'soft',
    key: `${key}-turnback`,
    material: 'upholstery',
    position: put(0, mattressTop + 0.115, length / 2 - duvetLength - 0.02),
    rotationY: yaw,
    size: [width + 0.2, 0.16, 0.34],
    radius: 0.075,
    detail: 3,
    sag: 0.1,
    crease: 0.014,
    seed: seed + 5,
  });

  // Pillows: two sleeping pillows standing against the headboard, two
  // smaller ones in front, and one bolster. None square, none identical.
  const pillowY = mattressTop + 0.075;
  for (const side of [-1, 1] as const) {
    forms.push({
      kind: 'soft',
      key: `${key}-pillow-${side}`,
      material: 'upholstery',
      position: put(side * width * 0.23, pillowY + 0.03, -length / 2 + 0.31),
      rotationY: yaw + side * 0.05,
      tiltX: -0.5 - wobble(seed, side + 1) * 0.12,
      size: [0.7, 0.46, 0.21],
      radius: 0.1,
      detail: 3,
      sag: 0.3,
      crease: 0.019,
      seed: seed + 10 + side,
    });
    forms.push({
      kind: 'soft',
      key: `${key}-cushion-${side}`,
      material: 'upholsteryDark',
      position: put(side * width * 0.22, pillowY + 0.01, -length / 2 + 0.55),
      rotationY: yaw + side * 0.28,
      tiltX: -0.22,
      size: [0.42, 0.36, 0.14],
      radius: 0.075,
      detail: 3,
      sag: 0.26,
      crease: 0.02,
      seed: seed + 20 + side,
    });
  }

  forms.push({
    kind: 'soft',
    key: `${key}-bolster`,
    material: 'upholsteryDark',
    position: put(0, pillowY + 0.02, -length / 2 + 0.74),
    rotationY: yaw + 0.02,
    size: [0.72, 0.16, 0.16],
    radius: 0.078,
    detail: 3,
    crease: 0.014,
    seed: seed + 30,
  });

  // Throw across the foot, overhanging both sides.
  forms.push({
    kind: 'soft',
    key: `${key}-throw`,
    material: 'rug',
    position: put(0, mattressTop + 0.025, length / 2 - 0.34),
    rotationY: yaw,
    size: [width + 0.2, 0.055, 0.46],
    radius: 0.026,
    detail: 3,
    sag: 0.34,
    crease: 0.014,
    seed: seed + 40,
  });
}

/**
 * An upholstered headboard: a padded panel in a slim timber surround, with
 * vertical channelling.
 *
 * The channels are separate soft forms rather than a texture, because the
 * light running down the round of each flute is the whole point of a
 * channelled headboard and a normal map at this distance cannot fake it.
 */
export function createHeadboard(
  forms: Form[],
  key: string,
  placement: Placement,
  options: { width?: number; height?: number } = {},
): void {
  const { at, floorY, facing, seed } = placement;
  const width = options.width ?? 2.4;
  const height = options.height ?? 1.15;
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  forms.push({
    kind: 'soft',
    key: `${key}-surround`,
    material: 'joinery',
    position: put(0, 0.28 + height / 2, -0.09),
    rotationY: yaw,
    size: [width + 0.1, height + 0.09, 0.07],
    radius: 0.014,
    detail: 2,
    seed: seed + 1,
  });

  const flutes = Math.max(4, Math.round(width / 0.3));
  const fluteWidth = width / flutes;
  for (let i = 0; i < flutes; i += 1) {
    const across = -width / 2 + fluteWidth * (i + 0.5);
    forms.push({
      kind: 'soft',
      key: `${key}-flute-${i}`,
      material: 'upholstery',
      position: put(across, 0.28 + height / 2, -0.03),
      rotationY: yaw,
      size: [fluteWidth - 0.012, height, 0.11],
      radius: 0.052,
      detail: 3,
      crease: 0.004,
      seed: seed + 10 + i,
    });
  }
}

/**
 * A bedside cabinet: a rounded carcass on a recessed plinth, with two
 * drawer fronts separated by a real reveal and a stone top.
 */
export function createNightstand(
  forms: Form[],
  key: string,
  at: readonly [number, number],
  floorY: number,
  seed: number,
  facing: Facing = 'south',
): void {
  const width = 0.56;
  const depth = 0.44;
  const height = 0.52;
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  forms.push({
    kind: 'soft',
    key: `${key}-plinth`,
    material: 'darkMetal',
    position: put(0, 0.035, 0),
    rotationY: yaw,
    size: [width - 0.16, 0.07, depth - 0.16],
    radius: 0.014,
    detail: 1,
    seed: seed + 1,
  });

  forms.push({
    kind: 'soft',
    key: `${key}-carcass`,
    material: 'joinery',
    position: put(0, 0.07 + (height - 0.11) / 2, 0),
    rotationY: yaw,
    size: [width, height - 0.11, depth],
    radius: 0.016,
    detail: 2,
    seed: seed + 2,
  });

  // Two drawer fronts standing a few millimetres proud, so the gap between
  // them reads as a joint rather than as a drawn line.
  for (let i = 0; i < 2; i += 1) {
    const centre = 0.11 + (height - 0.11) * (i === 0 ? 0.27 : 0.73);
    forms.push({
      kind: 'soft',
      key: `${key}-drawer-${i}`,
      material: 'joinery',
      position: put(0, centre, depth / 2 + 0.004),
      rotationY: yaw,
      size: [width - 0.036, (height - 0.11) * 0.42, 0.016],
      radius: 0.006,
      detail: 1,
      seed: seed + 10 + i,
    });
  }

  forms.push({
    kind: 'soft',
    key: `${key}-top`,
    material: 'marble',
    position: put(0, height - 0.015, 0),
    rotationY: yaw,
    size: [width + 0.03, 0.03, depth + 0.03],
    radius: 0.008,
    detail: 2,
    seed: seed + 3,
  });
}

// ── Outdoor ──────────────────────────────────────────────────────────────

/**
 * A pool lounger: a raked frame on a slim base, with a mattress that
 * actually follows the rake.
 *
 * The previous lounger was three stacked steps, which the earlier audit
 * described as reading like a staircase. This is a continuous frame with
 * one long seat mattress and a separate back mattress tipped up on it,
 * which is how such a chair is actually built.
 */
export function createLounger(forms: Form[], key: string, placement: Placement): void {
  const { at, floorY, facing, seed } = placement;
  const width = 0.78;
  const length = 2.0;
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  const frameY = 0.36;

  forms.push({
    kind: 'soft',
    key: `${key}-frame`,
    material: 'joinery',
    position: put(0, frameY, 0),
    rotationY: yaw,
    size: [width, 0.07, length],
    radius: 0.02,
    detail: 2,
    seed: seed + 1,
  });

  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      leg(
        forms,
        `${key}-leg-${sx}-${sz}`,
        put(sx * (width / 2 - 0.07), 0, sz * (length / 2 - 0.16)),
        frameY - 0.035,
        0.016,
        'darkMetal',
      );
    }
  }

  // Seat mattress: long, soft, and sagging between the frame rails.
  forms.push({
    kind: 'soft',
    key: `${key}-mattress`,
    material: 'upholstery',
    position: put(0, frameY + 0.075, 0.24),
    rotationY: yaw,
    size: [width - 0.04, 0.16, length * 0.62],
    radius: 0.07,
    detail: 3,
    sag: 0.22,
    crease: 0.008,
    seed: seed + 2,
  });

  // The raked back, tipped up on the same frame.
  forms.push({
    kind: 'soft',
    key: `${key}-back`,
    material: 'upholstery',
    position: put(0, frameY + 0.24, -length * 0.24),
    rotationY: yaw,
    tiltX: 0.52,
    size: [width - 0.04, 0.15, length * 0.36],
    radius: 0.065,
    detail: 3,
    sag: 0.14,
    crease: 0.009,
    seed: seed + 3,
  });

  forms.push({
    kind: 'soft',
    key: `${key}-headroll`,
    material: 'upholsteryDark',
    position: put(0, frameY + 0.4, -length * 0.36),
    rotationY: yaw,
    tiltX: 0.52,
    size: [0.42, 0.13, 0.13],
    radius: 0.062,
    detail: 3,
    crease: 0.012,
    seed: seed + 4,
  });

  // A folded towel, which is the accessory that turns a lounger into a
  // lounger someone uses.
  forms.push({
    kind: 'soft',
    key: `${key}-towel`,
    material: 'rug',
    position: put(0, frameY + 0.155, 0.5),
    rotationY: yaw + 0.06,
    size: [width - 0.18, 0.05, 0.42],
    radius: 0.022,
    detail: 2,
    sag: 0.2,
    crease: 0.01,
    seed: seed + 5,
  });
}

/** A deep outdoor sofa — the indoor piece in teak with weatherproof cushions. */
export function createOutdoorSofa(
  forms: Form[],
  key: string,
  placement: Placement,
  width = 2.2,
): void {
  const { at, floorY, facing, seed } = placement;
  const depth = 0.92;
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);

  forms.push({
    kind: 'soft',
    key: `${key}-frame`,
    material: 'joinery',
    position: put(0, 0.19, 0),
    rotationY: yaw,
    size: [width, 0.38, depth],
    radius: 0.03,
    detail: 2,
    seed: seed + 1,
  });

  for (const side of [-1, 1] as const) {
    forms.push({
      kind: 'soft',
      key: `${key}-arm-${side}`,
      material: 'joinery',
      position: put(side * (width / 2 - 0.1), 0.5, -0.02),
      rotationY: yaw,
      size: [0.2, 0.26, depth - 0.06],
      radius: 0.055,
      detail: 2,
      seed: seed + 10 + side,
    });
  }

  const seats = 2;
  const seatWidth = (width - 0.4) / seats;
  for (let i = 0; i < seats; i += 1) {
    const across = -(width - 0.4) / 2 + seatWidth * (i + 0.5);
    forms.push({
      kind: 'soft',
      key: `${key}-seat-${i}`,
      material: 'upholstery',
      position: put(across, 0.44, 0.05),
      rotationY: yaw,
      size: [seatWidth - 0.02, 0.14, depth - 0.2],
      radius: 0.055,
      detail: 3,
      sag: 0.2,
      crease: 0.008,
      seed: seed + 20 + i,
    });
    forms.push({
      kind: 'soft',
      key: `${key}-back-${i}`,
      material: 'upholstery',
      position: put(across, 0.63, -depth / 2 + 0.2),
      rotationY: yaw,
      tiltX: -0.16,
      size: [seatWidth - 0.03, 0.38, 0.16],
      radius: 0.065,
      detail: 3,
      sag: 0.14,
      crease: 0.011,
      seed: seed + 30 + i,
    });
  }
}

/** A dining chair: an upholstered shell on four turned legs. */
export function createDiningChair(
  forms: Form[],
  key: string,
  placement: Placement,
  outdoor = false,
): void {
  const { at, floorY, facing, seed } = placement;
  const width = 0.5;
  const depth = 0.5;
  const seatY = 0.45;
  const origin: Vector3Tuple = [at[0], floorY, at[1]];
  const yaw = YAW[facing];
  const put = (across: number, up: number, forward: number) =>
    place(origin, facing, across, up, forward);
  const fabric = outdoor ? 'joinery' : 'upholsteryDark';

  forms.push({
    kind: 'soft',
    key: `${key}-seat`,
    material: fabric,
    position: put(0, seatY, 0),
    rotationY: yaw,
    size: [width, 0.1, depth],
    radius: 0.042,
    detail: 3,
    sag: outdoor ? 0.04 : 0.16,
    crease: outdoor ? 0.002 : 0.008,
    seed: seed + 1,
  });

  forms.push({
    kind: 'soft',
    key: `${key}-back`,
    material: fabric,
    position: put(0, seatY + 0.29, -depth / 2 + 0.07),
    rotationY: yaw,
    tiltX: -0.14,
    size: [width - 0.03, 0.5, 0.09],
    radius: 0.042,
    detail: 3,
    taper: 0.08,
    crease: outdoor ? 0.002 : 0.007,
    seed: seed + 2,
  });

  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      leg(
        forms,
        `${key}-leg-${sx}-${sz}`,
        put(sx * (width / 2 - 0.055), 0, sz * (depth / 2 - 0.055)),
        seatY - 0.05,
        0.016,
        outdoor ? 'darkMetal' : 'bronze',
      );
    }
  }
}
