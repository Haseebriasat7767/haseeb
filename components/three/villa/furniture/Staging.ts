import type { Range } from '../VillaTypes';
import type { BlobSpec } from '../landscape/LandscapeTypes';
import type { Form } from './FormTypes';
import { createFloorLamp, wobble } from './Pieces';

/**
 * Staging: the things that turn a built room into a photographed one.
 *
 * Curtains, planting and the small styled objects. All of it soft or turned
 * geometry, for the same reason the furniture is — these are precisely the
 * objects with no straight edges anywhere on them, and drawing them as
 * prisms is what made the interiors read as a plan rather than a place.
 */

/**
 * A dressed window: a sheer behind, a pair of heavy panels in front.
 *
 * The layering is the point. A single opaque panel reads as a board over a
 * hole; a sheer glowing with the daylight behind it, with weighty side
 * panels stacked against the reveal, is what a window in a house looks
 * like. Both layers fall in real folds — see `createFolds` — so light runs
 * down the crests and dies in the troughs, which is the entire visual
 * argument for having curtains in the frame at all.
 *
 * `across` is the opening's extent on its long axis; `at` is the single
 * coordinate on the other horizontal axis the track sits at.
 */
export function createDressedWindow(
  forms: Form[],
  key: string,
  options: {
    across: Range;
    at: number;
    y: Range;
    /** Which world axis the run follows. Defaults to X. */
    axis?: 'x' | 'z';
    seed: number;
  },
): void {
  const { across, at, y, axis = 'x', seed } = options;
  const run = across[1] - across[0];
  const centre = (across[0] + across[1]) / 2;
  const drop = y[1] - y[0];
  const midY = (y[0] + y[1]) / 2;
  // A run along Z is the same panel turned a quarter turn.
  const yaw = axis === 'x' ? 0 : Math.PI / 2;
  const at3 = (offset: number, along: number): [number, number, number] =>
    axis === 'x' ? [centre + along, midY, at + offset] : [at + offset, midY, centre + along];

  // The sheer spans the whole opening and hangs almost flat — it is under
  // tension, not gathered.
  forms.push({
    kind: 'fold',
    key: `${key}-sheer`,
    material: 'sheer',
    position: at3(0.02, 0),
    rotationY: yaw,
    width: run,
    height: drop,
    depth: 0.035,
    pleats: Math.max(6, Math.round(run / 0.42)),
    rows: 12,
    seed,
  });

  // Two heavy panels, stacked back at the reveals rather than drawn across.
  const panelWidth = Math.min(run * 0.26, 1.15);
  for (const side of [-1, 1] as const) {
    forms.push({
      kind: 'fold',
      key: `${key}-panel-${side}`,
      material: 'drapery',
      position: at3(-0.09, side * (run / 2 - panelWidth / 2)),
      rotationY: yaw,
      width: panelWidth,
      height: drop,
      depth: 0.075,
      pleats: Math.max(3, Math.round(panelWidth / 0.2)),
      rows: 14,
      seed: seed + 17 + side,
    });
  }

  // The track, boxed in above the panels.
  forms.push({
    kind: 'soft',
    key: `${key}-track`,
    material: 'darkMetal',
    position: at3(-0.06, 0),
    rotationY: yaw,
    size: [run, 0.05, 0.09],
    radius: 0.012,
    detail: 1,
    seed: seed + 3,
  });
  forms[forms.length - 1]!.position[1] = y[1] - 0.025;
}

/**
 * An indoor specimen tree: a turned pot, soil, a tapering trunk that forks,
 * and foliage clusters the card pass turns into leaves.
 *
 * The previous plant was a stack of green boxes on a stick, which the
 * earlier audit called the most artificial object in the living room and
 * which no material could have saved. The structure here is the one a real
 * ficus has — a trunk that narrows as it rises and divides two or three
 * times, with foliage massed at the ends of the divisions rather than
 * threaded up the stem — so the silhouette has somewhere to come from.
 *
 * Clusters go into the existing `foliageClusters` list, so they are drawn
 * by the same alpha-cut card technique as the trees outside: one draw call,
 * and an outline decided by a texture with gaps in it.
 */
export function createPlanted(
  forms: Form[],
  clusters: BlobSpec[],
  key: string,
  options: { at: readonly [number, number]; floorY: number; height: number; seed: number },
): void {
  const { at, floorY, height, seed } = options;
  const potHeight = height * 0.19;
  const potRadius = height * 0.115;

  // A thrown pot with a rolled rim and a foot, rather than a cube.
  forms.push({
    kind: 'turned',
    key: `${key}-pot`,
    material: 'ceramic',
    position: [at[0], floorY, at[1]],
    profile: [
      [potRadius * 0.62, 0],
      [potRadius * 0.66, 0.012],
      [potRadius * 0.6, 0.03],
      [potRadius * 0.86, potHeight * 0.42],
      [potRadius, potHeight - 0.02],
      [potRadius * 1.04, potHeight],
      [potRadius * 0.94, potHeight],
      [potRadius * 0.9, potHeight - 0.035],
    ],
    segments: 28,
  });

  forms.push({
    kind: 'turned',
    key: `${key}-soil`,
    material: 'darkMetal',
    position: [at[0], floorY + potHeight - 0.045, at[1]],
    profile: [
      [0, 0.012],
      [potRadius * 0.66, 0.016],
      [potRadius * 0.88, 0],
    ],
    segments: 20,
  });

  // Trunk, tapering from the soil to the first fork.
  //
  // Slim and tall. The previous version forked low and threw five limbs out
  // at wide angles, and because the foliage sat only at their tips the
  // whole armature stayed visible — the rendered plant read as green balls
  // on crossed sticks. A specimen ficus of this kind has one clean stem
  // that divides high and late, and almost none of its structure showing.
  const trunkBase = floorY + potHeight - 0.03;
  const forkY = trunkBase + height * 0.44;
  forms.push({
    kind: 'turned',
    key: `${key}-trunk`,
    material: 'joinery',
    position: [at[0], trunkBase, at[1]],
    profile: [
      [height * 0.023, 0],
      [height * 0.019, height * 0.12],
      [height * 0.015, height * 0.3],
      [height * 0.012, forkY - trunkBase],
    ],
    segments: 12,
  });

  // Three limbs, leaning far less than before, and foliage massed *along*
  // them rather than parked on the ends — which is both how a canopy grows
  // and what hides the branch that carries it.
  const limbs = 3;
  for (let i = 0; i < limbs; i += 1) {
    const angle = (i / limbs) * Math.PI * 2 + wobble(seed, i) * 1.4;
    const rise = height * (0.3 + wobble(seed, i + 3) * 0.12);
    const reach = height * (0.13 + wobble(seed, i + 7) * 0.09);
    const tipX = at[0] + Math.cos(angle) * reach;
    const tipZ = at[1] + Math.sin(angle) * reach;
    const span = Math.hypot(reach, rise);

    forms.push({
      kind: 'turned',
      key: `${key}-limb-${i}`,
      material: 'joinery',
      position: [(at[0] + tipX) / 2, forkY + rise / 2 - 0.02, (at[1] + tipZ) / 2],
      rotationY: -angle,
      tiltX: Math.atan2(reach, rise),
      profile: [
        [height * 0.011, -span / 2],
        [height * 0.007, span / 2],
      ],
      segments: 8,
    });

    // Four masses up each limb, growing toward the top and drifting off
    // its axis, so the crown is a loose vertical drift rather than a ball.
    const masses = 5;
    for (let j = 0; j < masses; j += 1) {
      const t = (j + 0.6) / masses;
      const drift = height * 0.13;
      clusters.push({
        key: `${key}-crown-${i}-${j}`,
        position: [
          at[0] + (tipX - at[0]) * t + (wobble(seed, i * 9 + j) - 0.5) * drift,
          forkY + rise * t - height * 0.04 + (wobble(seed, i * 9 + j + 11) - 0.5) * drift * 0.7,
          at[1] + (tipZ - at[1]) * t + (wobble(seed, i * 9 + j + 23) - 0.5) * drift,
        ],
        // Smaller and more numerous than the old tip-masses: a mass the
        // size of the whole crown can only ever be a ball.
        radius: height * (0.115 + wobble(seed, i * 13 + j) * 0.055) * (0.75 + t * 0.55),
        scale: [1, 0.82, 1],
        seed: seed + i * 131 + j * 17,
        deform: 0.4,
        detail: 0,
      });
    }
  }
}

/** The floor lamp, re-exported under a name that cannot collide with the
 *  box-built one the secondary rooms still use. */
export function createStandingLamp(
  forms: Form[],
  key: string,
  at: readonly [number, number],
  floorY: number,
  height = 1.55,
): void {
  createFloorLamp(forms, key, at, floorY, height);
}

/**
 * A wall-mounted screen with a real bezel and a shadow gap behind it.
 *
 * A pure black rectangle flush on a wall is a hole, not a television. The
 * bracket holds the panel a few centimetres off the plaster so a shadow
 * runs behind it, and the bezel gives the panel an edge to catch light on.
 */
export function createScreen(
  forms: Form[],
  key: string,
  options: {
    across: Range;
    y: Range;
    at: number;
    axis: 'x' | 'z';
    /** Which way the screen faces along its axis: +1 toward increasing. */
    towards: 1 | -1;
  },
): void {
  const { across, y, at, axis, towards } = options;
  const run = across[1] - across[0];
  const drop = y[1] - y[0];
  const centre = (across[0] + across[1]) / 2;
  const midY = (y[0] + y[1]) / 2;
  const yaw = axis === 'x' ? Math.PI / 2 : 0;
  const at3 = (offset: number): [number, number, number] =>
    axis === 'z' ? [centre, midY, at + offset * towards] : [at + offset * towards, midY, centre];

  forms.push({
    kind: 'soft',
    key: `${key}-bracket`,
    material: 'darkMetal',
    position: at3(0.022),
    rotationY: yaw,
    size: [run * 0.4, drop * 0.5, 0.04],
    radius: 0.008,
    detail: 1,
    seed: 3,
  });
  forms.push({
    kind: 'soft',
    key: `${key}-bezel`,
    material: 'darkMetal',
    position: at3(0.062),
    rotationY: yaw,
    size: [run, drop, 0.035],
    radius: 0.006,
    detail: 1,
    seed: 4,
  });
  forms.push({
    kind: 'soft',
    key: `${key}-panel`,
    material: 'darkMetal',
    position: at3(0.081),
    rotationY: yaw,
    size: [run - 0.022, drop - 0.022, 0.006],
    radius: 0.002,
    detail: 1,
    seed: 5,
  });
}

/**
 * A stack of books, a shallow tray and a vessel — the three-object
 * composition every interior photograph uses, because three heights read as
 * arrangement and four read as clutter.
 */
export function createStyling(
  forms: Form[],
  key: string,
  at: readonly [number, number],
  top: number,
  seed: number,
): void {
  forms.push({
    kind: 'soft',
    key: `${key}-tray`,
    material: 'bronze',
    position: [at[0] - 0.2, top + 0.012, at[1] + 0.04],
    rotationY: 0.14,
    size: [0.36, 0.024, 0.26],
    radius: 0.008,
    detail: 2,
    seed,
  });

  let stack = top;
  for (let i = 0; i < 3; i += 1) {
    const h = 0.028 + wobble(seed, i) * 0.014;
    forms.push({
      kind: 'soft',
      key: `${key}-book-${i}`,
      material: i % 2 === 0 ? 'paper' : 'upholsteryDark',
      position: [at[0] + 0.26, stack + h / 2, at[1] - 0.05],
      rotationY: 0.1 + (wobble(seed, i + 5) - 0.5) * 0.24,
      size: [0.24 - i * 0.014, h, 0.31 - i * 0.016],
      radius: 0.004,
      detail: 1,
      seed: seed + i,
    });
    stack += h;
  }

  forms.push({
    kind: 'turned',
    key: `${key}-vessel`,
    material: 'ceramic',
    position: [at[0] - 0.19, top + 0.024, at[1] + 0.03],
    profile: [
      [0.045, 0],
      [0.062, 0.02],
      [0.086, 0.09],
      [0.078, 0.16],
      [0.05, 0.21],
      [0.044, 0.235],
      [0.048, 0.245],
      [0.04, 0.246],
    ],
    segments: 24,
  });
}

/**
 * A boarded timber lining: real boards with real gaps between them.
 *
 * The master's feature wall was one slab carrying a wood texture, and a
 * texture cannot produce what makes boarding read — the shadow in each
 * joint, which deepens as the light rakes and disappears as it comes
 * square on. These are individual boards on a recessed backing, so the
 * joints are geometry and behave correctly at every hour.
 *
 * Board widths vary slightly, because a wall of identical boards is a
 * texture by another means.
 */
export function createBoardedWall(
  forms: Form[],
  key: string,
  options: {
    across: Range;
    at: number;
    y: Range;
    axis: 'x' | 'z';
    depth: number;
    boardHeight: number;
  },
): void {
  const { across, at, y, axis, depth, boardHeight } = options;
  const run = across[1] - across[0];
  const centre = (across[0] + across[1]) / 2;
  const yaw = axis === 'x' ? 0 : Math.PI / 2;
  const at3 = (height: number, offset: number): [number, number, number] =>
    axis === 'x' ? [centre, height, at + offset] : [at + offset, height, centre];

  // The recessed backing the boards stand off, which is what the joints
  // show a shadow against.
  forms.push({
    kind: 'soft',
    key: `${key}-backing`,
    material: 'darkMetal',
    position: at3((y[0] + y[1]) / 2, depth * 0.2),
    rotationY: yaw,
    size: [run, y[1] - y[0], depth * 0.4],
    radius: 0.006,
    detail: 1,
    seed: 1,
  });

  const boards = Math.max(2, Math.round((y[1] - y[0]) / boardHeight));
  const pitch = (y[1] - y[0]) / boards;
  for (let i = 0; i < boards; i += 1) {
    const height = y[0] + pitch * (i + 0.5);
    // A hair of variation per board, so the joints do not march.
    const wiggle = (wobble(7, i) - 0.5) * pitch * 0.1;
    forms.push({
      kind: 'soft',
      key: `${key}-board-${i}`,
      material: 'wood',
      position: at3(height + wiggle * 0.4, depth * 0.72),
      rotationY: yaw,
      size: [run, pitch - 0.012 + wiggle, depth * 0.56],
      radius: 0.005,
      detail: 1,
      seed: 20 + i,
    });
  }
}

/**
 * A deep-pile rug.
 *
 * Drawn as a slab, a rug is a flat rectangle of colour lying on the floor
 * with four razor edges — which is exactly how the frames read it, and why
 * the brief calls it out by name. A real rug has thickness you can see at
 * its edge, a slightly uneven surface where the pile lies differently
 * across it, and a soft corner. All three come from one soft form with a
 * generous crease and almost no radius.
 */
export function createPileRug(
  forms: Form[],
  key: string,
  at: readonly [number, number],
  floorY: number,
  width: number,
  depth: number,
  seed: number,
): void {
  forms.push({
    kind: 'soft',
    key,
    material: 'rug',
    position: [at[0], floorY + 0.011, at[1]],
    size: [width, 0.024, depth],
    radius: 0.009,
    detail: 3,
    // The nap does not lie perfectly flat, and the few millimetres of
    // relief across it is what separates pile from paint.
    crease: 0.005,
    seed,
  });
}
