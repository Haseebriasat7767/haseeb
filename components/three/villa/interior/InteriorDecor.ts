import type { BoxSpec, ColumnSpec, Range } from '../VillaTypes';
import { box, mid, span } from '../SpecBuilders';
import type { Parts } from './Furniture';

/**
 * The layer of an interior that an interior designer actually adds.
 *
 * Aurelia's rooms have been correctly *planned* since Phase 2 — seventeen
 * of them, each with the right furniture in the right place — and have
 * still read as procedurally generated, because planning is not staging. A
 * luxury interior photograph is roughly seventy per cent things nobody
 * specified: the fall of a curtain, the fold of a duvet, a stack of books
 * left on a table. None of it is architecture and all of it is what makes
 * a room look inhabited.
 *
 * Everything here emits into the same `Parts` groups the furniture uses, so
 * a fully styled house still costs one merged mesh per material.
 */

/** A deterministic hash, so a room's styling never shifts between renders. */
function wobble(seed: number, index: number): number {
  const s = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// ── Curtains ─────────────────────────────────────────────────────────────

export type CurtainOptions = {
  /** Wall run the treatment covers. */
  across: Range;
  /** Depth range of the curtain plane — the wall face it hangs off. */
  at: Range;
  /** Floor and ceiling of the drop. */
  y: Range;
  /** Which end the heavy panels gather at. */
  gather?: 'both' | 'left' | 'right';
  /** Folds per metre of gathered panel. Higher reads as heavier fabric. */
  density?: number;
};

/**
 * A floor-to-ceiling curtain treatment: a sheer layer across the full
 * opening, and heavy panels gathered at the ends.
 *
 * The folds are the point. A curtain drawn as a flat plane is a coloured
 * rectangle and reads as one; what makes fabric legible at architectural
 * distance is the vertical rhythm of light and shadow down its face. Each
 * fold here is a slim box stepped in depth, alternating forward and back,
 * with a deterministic wobble on width and projection so the rhythm is
 * regular without being periodic.
 *
 * Cheap by construction: a three-metre panel is a dozen boxes that merge
 * into the same mesh as every other fabric surface in the house.
 */
export function createCurtains(parts: Parts, key: string, options: CurtainOptions): void {
  const { across, at, y, gather = 'both', density = 9 } = options;
  const width = span(across);
  if (width <= 0.4) return;

  // The sheer: one thin plane across the whole opening, set back against
  // the glass. It softens the daylight and gives the heavy panels
  // something to read against.
  parts.sheer.push(box(`${key}-sheer`, across, [y[0] + 0.02, y[1] - 0.02], [at[0], at[0] + 0.012]));

  // A pelmet, which is also what hides the head of every panel.
  parts.joinery.push(box(`${key}-track`, across, [y[1] - 0.12, y[1]], [at[0], at[1]]));

  const panelWidth = Math.min(width * 0.3, 1.15);
  const ends: { at: number; direction: 1 | -1 }[] = [];
  if (gather !== 'right') ends.push({ at: across[0], direction: 1 });
  if (gather !== 'left') ends.push({ at: across[1], direction: -1 });

  ends.forEach((end, panelIndex) => {
    const folds = Math.max(3, Math.round(panelWidth * density));
    const step = panelWidth / folds;

    for (let i = 0; i < folds; i += 1) {
      const seed = panelIndex * 31 + i;
      const x0 = end.at + end.direction * step * i;
      const x1 = x0 + end.direction * step * (0.82 + wobble(seed, 1) * 0.3);
      // Alternating projection is what turns a row of boxes into a fold.
      const forward = i % 2 === 0;
      const depth = at[0] + (forward ? 0.02 : 0.05) + wobble(seed, 2) * 0.03;
      const thickness = 0.055 + wobble(seed, 3) * 0.035;
      // Curtains break on the floor rather than stopping level with it.
      const hem = y[0] + (forward ? 0 : 0.015);

      parts.drapery.push(
        box(
          `${key}-fold-${panelIndex}-${i}`,
          end.direction > 0 ? [x0, x1] : [x1, x0],
          [hem, y[1] - 0.1],
          [depth, depth + thickness],
        ),
      );
    }
  });
}

// ── Bedding ──────────────────────────────────────────────────────────────

export type BeddingOptions = {
  /** Plan extent of the mattress. */
  x: Range;
  z: Range;
  floorY: number;
  /** Which way the sleeper faces — the head end is opposite. */
  headAt: 'north' | 'south';
  /** Seeds the fold pattern, so no two beds in the house are identical. */
  seed: number;
};

/**
 * A dressed bed: base, mattress, fitted sheet, a turned-back duvet with a
 * fold at its head, pillows in two ranks, and a folded throw at the foot.
 *
 * The existing `createBed` produced a mattress slab and two pillow boxes,
 * which is a bed in the sense that a plan is a house. Bedding is the single
 * largest soft mass in a bedroom and the thing the eye reads first, so it
 * gets real layers: the duvet sits proud of the mattress and overhangs it,
 * the turn-back is a separate thicker band, and the pillow ranks step in
 * height. No simulation — just layers offset the way made beds actually
 * are.
 */
export function createBedding(parts: Parts, key: string, options: BeddingOptions): void {
  const { x, z, floorY, headAt, seed } = options;
  const head = headAt === 'north' ? z[0] : z[1];
  const foot = headAt === 'north' ? z[1] : z[0];
  const toFoot = headAt === 'north' ? 1 : -1;

  const baseTop = floorY + 0.32;
  const mattressTop = baseTop + 0.28;

  // Divan base, inset so the mattress overhangs it slightly.
  parts.joinery.push(
    box(
      `${key}-base`,
      [x[0] + 0.05, x[1] - 0.05],
      [floorY + 0.06, baseTop],
      [Math.min(head, foot) + 0.05, Math.max(head, foot) - 0.05],
    ),
  );
  parts.softDark.push(
    box(`${key}-mattress`, x, [baseTop, mattressTop], [Math.min(head, foot), Math.max(head, foot)]),
  );

  // Fitted sheet: a hair proud of the mattress on every face.
  parts.soft.push(
    box(
      `${key}-sheet`,
      [x[0] - 0.01, x[1] + 0.01],
      [mattressTop - 0.06, mattressTop + 0.02],
      [Math.min(head, foot) - 0.01, Math.max(head, foot) + 0.01],
    ),
  );

  // Duvet: covers the lower two thirds, overhangs both sides, and is
  // slightly deeper than the sheet it lies on.
  const duvetHead = head + toFoot * (span(z) * 0.34);
  const duvetRange: Range = toFoot > 0 ? [duvetHead, foot + 0.16] : [foot - 0.16, duvetHead];
  parts.soft.push(
    box(`${key}-duvet`, [x[0] - 0.07, x[1] + 0.07], [mattressTop, mattressTop + 0.13], duvetRange),
  );
  // The turn-back at its head, thicker because the fabric doubles there.
  parts.soft.push(
    box(
      `${key}-turnback`,
      [x[0] - 0.07, x[1] + 0.07],
      [mattressTop + 0.02, mattressTop + 0.2],
      toFoot > 0 ? [duvetHead, duvetHead + 0.26] : [duvetHead - 0.26, duvetHead],
    ),
  );

  // Two ranks of pillows: standing at the head, sleeping in front of them.
  const pillowWidth = (span(x) - 0.24) / 2;
  for (let i = 0; i < 2; i += 1) {
    const px0 = x[0] + 0.08 + i * (pillowWidth + 0.08);
    const jitter = wobble(seed, i) * 0.04;
    parts.soft.push(
      box(
        `${key}-pillow-back-${i}`,
        [px0, px0 + pillowWidth],
        [mattressTop + 0.02, mattressTop + 0.26 + jitter],
        toFoot > 0 ? [head + 0.06, head + 0.28] : [head - 0.28, head - 0.06],
      ),
    );
    parts.soft.push(
      box(
        `${key}-pillow-front-${i}`,
        [px0 + 0.03, px0 + pillowWidth - 0.03],
        [mattressTop + 0.02, mattressTop + 0.19 - jitter],
        toFoot > 0 ? [head + 0.28, head + 0.52] : [head - 0.52, head - 0.28],
      ),
    );
  }

  // Two decorative cushions, off-centre, in the accent fabric.
  const cushionX = mid(x) + (wobble(seed, 7) - 0.5) * span(x) * 0.3;
  parts.softDark.push(
    box(
      `${key}-cushion-a`,
      [cushionX - 0.28, cushionX + 0.02],
      [mattressTop + 0.02, mattressTop + 0.2],
      toFoot > 0 ? [head + 0.5, head + 0.66] : [head - 0.66, head - 0.5],
    ),
  );
  parts.softDark.push(
    box(
      `${key}-cushion-b`,
      [cushionX + 0.06, cushionX + 0.34],
      [mattressTop + 0.02, mattressTop + 0.17],
      toFoot > 0 ? [head + 0.52, head + 0.68] : [head - 0.68, head - 0.52],
    ),
  );

  // A throw folded across the foot — the detail that most reliably makes a
  // bed read as dressed rather than merely made.
  parts.softDark.push(
    box(
      `${key}-throw`,
      [x[0] - 0.09, x[1] + 0.09],
      [mattressTop + 0.1, mattressTop + 0.19],
      toFoot > 0 ? [foot - 0.62, foot - 0.1] : [foot + 0.1, foot + 0.62],
    ),
  );
}

/** An upholstered headboard, wider and taller than the bed it serves. */
export function createHeadboard(
  parts: Parts,
  key: string,
  x: Range,
  atZ: number,
  facing: 1 | -1,
  floorY: number,
  height = 1.15,
): void {
  const panel: Range = facing > 0 ? [atZ, atZ + 0.14] : [atZ - 0.14, atZ];
  parts.soft.push(
    box(`${key}-panel`, [x[0] - 0.16, x[1] + 0.16], [floorY + 0.32, floorY + height], panel),
  );
  // A slim timber surround, which is what stops upholstery reading as a
  // padded cell.
  const surround: Range = facing > 0 ? [atZ + 0.14, atZ + 0.2] : [atZ - 0.2, atZ - 0.14];
  parts.joinery.push(
    box(
      `${key}-surround`,
      [x[0] - 0.22, x[1] + 0.22],
      [floorY + 0.28, floorY + height + 0.06],
      surround,
    ),
  );
}

// ── Wall art ─────────────────────────────────────────────────────────────

/**
 * A framed canvas on a wall.
 *
 * Abstract by construction: a plaster ground with two or three offset
 * bands of stone and metal across it. There is no recognisable image and
 * nothing is reproduced from anywhere — which is both the licensing
 * position and, at the distance a wall reads from, indistinguishable from
 * the large-format abstracts that actually hang in houses like this.
 */
export function createArtwork(
  parts: Parts,
  key: string,
  across: Range,
  y: Range,
  at: Range,
  axis: 'x' | 'z',
  seed: number,
): void {
  const make = (a: Range, yy: Range, d: Range, k: string): BoxSpec =>
    axis === 'z' ? box(k, a, yy, d) : box(k, d, yy, a);

  parts.dark.push(make(across, y, at, `${key}-frame`));

  const face: Range = [at[1] - 0.012, at[1] - 0.004];
  const inner: Range = [across[0] + 0.05, across[1] - 0.05];
  const innerY: Range = [y[0] + 0.05, y[1] - 0.05];
  parts.plaster.push(make(inner, innerY, face, `${key}-canvas`));

  const bandFace: Range = [at[1] - 0.02, at[1] - 0.013];
  const bands = 2 + Math.floor(wobble(seed, 0) * 2);
  for (let i = 0; i < bands; i += 1) {
    const t0 = 0.12 + wobble(seed, i * 2 + 1) * 0.55;
    const t1 = t0 + 0.08 + wobble(seed, i * 2 + 2) * 0.22;
    const band: Range = [
      innerY[0] + span(innerY) * t0,
      innerY[0] + span(innerY) * Math.min(t1, 0.96),
    ];
    const target = i % 2 === 0 ? parts.stone : parts.metal;
    target.push(
      make(
        [inner[0] + span(inner) * 0.06, inner[1] - span(inner) * (0.05 + wobble(seed, i) * 0.3)],
        band,
        bandFace,
        `${key}-band-${i}`,
      ),
    );
  }
}

// ── Plants ───────────────────────────────────────────────────────────────

/**
 * A sculptural indoor plant: a ceramic pot, a short trunk, and a canopy of
 * stepped foliage boxes.
 *
 * Deliberately not the exterior foliage-card system. Those cards are
 * alpha-tested and excluded from ambient occlusion, which is right outdoors
 * and wrong for an object standing a metre from an interior camera in a
 * room whose whole quality comes from contact shading. A handful of boxes
 * merges into the existing foliage mesh and behaves like every other solid
 * in the room.
 */
export function createPlant(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  floorY: number,
  height: number,
  seed: number,
): void {
  const potHeight = height * 0.22;
  const potRadius = height * 0.13;

  parts.ceramic.push(
    box(
      `${key}-pot`,
      [cx - potRadius, cx + potRadius],
      [floorY, floorY + potHeight],
      [cz - potRadius, cz + potRadius],
    ),
  );
  parts.posts.push({
    key: `${key}-stem`,
    position: [cx, floorY + potHeight + height * 0.18, cz],
    scale: [height * 0.022, height * 0.36, height * 0.022],
  });

  // Clusters roughly as deep as they are wide. The first version made them
  // four times wider than tall, which read as a stack of shelves rather
  // than as a plant — the one proportion that has to be right for a mass of
  // boxes to pass as foliage.
  const canopyBase = floorY + potHeight + height * 0.26;
  const clusters = 7;
  for (let i = 0; i < clusters; i += 1) {
    const t = i / (clusters - 1);
    const spread = height * (0.24 - t * 0.1) * (0.72 + wobble(seed, i) * 0.55);
    const ox = (wobble(seed, i * 3 + 1) - 0.5) * height * 0.3;
    const oz = (wobble(seed, i * 3 + 2) - 0.5) * height * 0.3;
    const y0 = canopyBase + t * height * 0.48;
    const tall = spread * (1.25 + wobble(seed, i * 3 + 3) * 0.8);
    parts.foliage.push(
      box(
        `${key}-leaf-${i}`,
        [cx + ox - spread, cx + ox + spread],
        [y0, y0 + tall],
        [cz + oz - spread * 0.85, cz + oz + spread * 0.85],
      ),
    );
  }
}

// ── Small objects ────────────────────────────────────────────────────────

/** A shallow tray, the thing every styled surface actually starts from. */
export function createTray(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  top: number,
  width = 0.42,
  depth = 0.3,
): void {
  parts.metal.push(
    box(
      `${key}-tray`,
      [cx - width / 2, cx + width / 2],
      [top, top + 0.022],
      [cz - depth / 2, cz + depth / 2],
    ),
  );
}

/** A short stack of books, each offset from the one beneath it. */
export function createBooks(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  top: number,
  count: number,
  seed: number,
): void {
  let y = top;
  for (let i = 0; i < count; i += 1) {
    const w = 0.2 + wobble(seed, i) * 0.07;
    const d = 0.15 + wobble(seed, i + 9) * 0.05;
    const ox = (wobble(seed, i + 3) - 0.5) * 0.05;
    const oz = (wobble(seed, i + 5) - 0.5) * 0.04;
    const thickness = 0.028 + wobble(seed, i + 7) * 0.022;
    parts.paper.push(
      box(
        `${key}-book-${i}`,
        [cx + ox - w / 2, cx + ox + w / 2],
        [y, y + thickness],
        [cz + oz - d / 2, cz + oz + d / 2],
      ),
    );
    y += thickness;
  }
}

/** A tall vessel — vase, carafe, sculpture — as a tapered two-part form. */
export function createVessel(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  top: number,
  height: number,
  radius: number,
  material: 'ceramic' | 'stone' | 'metal' = 'ceramic',
): void {
  const target =
    material === 'ceramic' ? parts.ceramic : material === 'stone' ? parts.stone : parts.metal;
  target.push(
    box(
      `${key}-body`,
      [cx - radius, cx + radius],
      [top, top + height * 0.7],
      [cz - radius, cz + radius],
    ),
  );
  target.push(
    box(
      `${key}-neck`,
      [cx - radius * 0.52, cx + radius * 0.52],
      [top + height * 0.7, top + height],
      [cz - radius * 0.52, cz + radius * 0.52],
    ),
  );
}

/** A stack of folded towels, for bathrooms and the poolside alike. */
export function createTowels(
  parts: Parts,
  key: string,
  cx: number,
  cz: number,
  top: number,
  count = 2,
): void {
  for (let i = 0; i < count; i += 1) {
    const inset = i * 0.018;
    parts.soft.push(
      box(
        `${key}-towel-${i}`,
        [cx - 0.16 + inset, cx + 0.16 - inset],
        [top + i * 0.055, top + (i + 1) * 0.055],
        [cz - 0.11 + inset, cz + 0.11 - inset],
      ),
    );
  }
}

export type { ColumnSpec };
