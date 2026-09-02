import type { BoxSpec, ColumnSpec, DetailTier, Range, VillaPlan } from '../VillaTypes';
import { box, mid } from '../SpecBuilders';
import type { ArrivalConfig, EstateLayout, OutdoorConfig, PavingRect } from './EstateTypes';
import type { SiteLayout } from './SiteTypes';

/**
 * The arrival sequence, in metres.
 *
 * Placement is derived from the building, not chosen. The court's near
 * edge sits at Z 17.2, just clear of where the entrance stairs meet grade
 * at 16.5, and its east edge at -4.5 clears the pool deck's retaining
 * skirt; the drive then runs off it on the front door's own axis.
 *
 * The first attempt started the court at Z 25.8, beyond the end of the
 * villa's existing stepping stones. It read as a helipad: a slab of paving
 * on the lawn with a gap of grass between it and the house. An arrival
 * sequence has to actually arrive, so the court now runs up to the stair
 * foot, and the stones it supersedes are no longer drawn.
 *
 * The far end stops at Z 45.5 for a reason worth recording: the terrain
 * holds dead level out to a radius of 46 m and then takes its relief, so
 * paving laid beyond that line would either float above the ground or sink
 * into it. The drive simply leaves frame instead, which is also how it
 * reads on a real estate.
 */
export const ARRIVAL_CONFIG: ArrivalConfig = {
  driveWidth: 6,
  driveZ: [31, 45.5],
  courtX: [-17, -4.5],
  courtZ: [17.2, 31],
  module: 1.2,
  joint: 0.018,
  kerbHeight: 0.11,
};

/**
 * Where outdoor life happens. The terrace is a thirty-metre paved band
 * eight metres deep between the living glass and the pool steps, and it
 * has been empty since Phase 2 — which is most of why the property read as
 * a building on a lawn rather than as somewhere anyone lives.
 */
export const OUTDOOR_CONFIG: OutdoorConfig = {
  terraceY: 1.02,
  deckY: 0.4,
  loungeCenter: [2.5, 9.4],
  diningCenter: [11.2, 9.2],
  loungerX: 10,
  loungerZ: [17.9, 20.4, 22.9],
};

/**
 * How much of the estate each tier carries.
 *
 * The arrival sequence is never dropped: it is ground plane, it is what
 * the hero and entrance framings stand on, and a property whose drive
 * vanishes on a phone is a different property. Furniture thins from the
 * back of the composition forward, so the pieces that survive on the
 * weakest hardware are the ones nearest the camera in the money shots.
 */
const ESTATE_DETAIL: Record<
  DetailTier,
  { lounge: boolean; dining: boolean; loungers: number; details: boolean; diningSeats: number }
> = {
  low: { lounge: false, dining: false, loungers: 2, details: false, diningSeats: 0 },
  medium: { lounge: true, dining: true, loungers: 2, details: false, diningSeats: 6 },
  high: { lounge: true, dining: true, loungers: 3, details: true, diningSeats: 6 },
};

/**
 * Lays a rectangle in large-format modules with open joints.
 *
 * Real stone paving is a grid of slabs with a shadow line between them,
 * and that line is most of what separates expensive paving from a tinted
 * plane. The last module in each direction is stretched rather than cut,
 * so the field always finishes flush with its own edge.
 */
function pave(key: string, x: Range, z: Range, y: Range, module: number, joint: number): BoxSpec[] {
  const slabs: BoxSpec[] = [];
  const columns = Math.max(1, Math.round((x[1] - x[0]) / module));
  const rows = Math.max(1, Math.round((z[1] - z[0]) / module));
  const dx = (x[1] - x[0]) / columns;
  const dz = (z[1] - z[0]) / rows;

  for (let c = 0; c < columns; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const x0 = x[0] + c * dx;
      const z0 = z[0] + r * dz;
      slabs.push(
        box(`${key}-${c}-${r}`, [x0 + joint, x0 + dx - joint], y, [z0 + joint, z0 + dz - joint]),
      );
    }
  }
  return slabs;
}

/** A rectangular frame of upstand around a paved field. */
function kerb(key: string, x: Range, z: Range, y: Range, thickness: number): BoxSpec[] {
  return [
    box(`${key}-w`, [x[0] - thickness, x[0]], y, [z[0] - thickness, z[1] + thickness]),
    box(`${key}-e`, [x[1], x[1] + thickness], y, [z[0] - thickness, z[1] + thickness]),
    box(`${key}-n`, x, y, [z[0] - thickness, z[0]]),
    box(`${key}-s`, x, y, [z[1], z[1] + thickness]),
  ];
}

/**
 * A deep outdoor sofa: a timber plinth, a continuous seat, a low back and
 * two arms. Deliberately the same anatomy as the interior sofa so the two
 * read as one family of furniture, at outdoor proportions — lower, deeper,
 * and with the cushions sitting proud of the frame rather than inside it.
 */
function outdoorSofa(
  out: EstateLayout,
  key: string,
  cx: number,
  cz: number,
  y: number,
  width: number,
  depth: number,
): void {
  const half = width / 2;
  const front = cz - depth / 2;
  const back = cz + depth / 2;

  out.timber.push(box(`${key}-plinth`, [-half + cx, half + cx], [y, y + 0.16], [front, back]));
  out.timber.push(
    box(`${key}-arm-w`, [cx - half, cx - half + 0.2], [y + 0.16, y + 0.58], [front, back]),
  );
  out.timber.push(
    box(`${key}-arm-e`, [cx + half - 0.2, cx + half], [y + 0.16, y + 0.58], [front, back]),
  );
  out.timber.push(
    box(`${key}-back`, [cx - half, cx + half], [y + 0.16, y + 0.66], [back - 0.18, back]),
  );

  // Seat cushions, split into modules the way a real bench cushion is.
  const seats = Math.max(2, Math.round(width / 1.0));
  const step = (width - 0.4) / seats;
  for (let i = 0; i < seats; i += 1) {
    const x0 = cx - half + 0.2 + step * i;
    out.cushions.push(
      box(
        `${key}-seat-${i}`,
        [x0 + 0.015, x0 + step - 0.015],
        [y + 0.16, y + 0.34],
        [front + 0.08, back - 0.2],
      ),
    );
    out.cushions.push(
      box(
        `${key}-back-${i}`,
        [x0 + 0.015, x0 + step - 0.015],
        [y + 0.34, y + 0.62],
        [back - 0.34, back - 0.19],
      ),
    );
  }

  // Two scatter cushions, off-centre. Symmetry is what makes furniture
  // read as a product shot rather than as a room someone uses.
  out.accents.push(
    box(
      `${key}-scatter-a`,
      [cx - half + 0.34, cx - half + 0.74],
      [y + 0.34, y + 0.62],
      [back - 0.42, back - 0.3],
    ),
  );
  out.accents.push(
    box(
      `${key}-scatter-b`,
      [cx + half - 0.86, cx + half - 0.46],
      [y + 0.34, y + 0.6],
      [back - 0.4, back - 0.29],
    ),
  );
}

/** A single lounge chair, the sofa's anatomy at one seat. */
function outdoorChair(
  out: EstateLayout,
  key: string,
  cx: number,
  cz: number,
  y: number,
  facing: 1 | -1,
): void {
  const half = 0.44;
  const depth = 0.84;
  const front = cz - (facing * depth) / 2;
  const back = cz + (facing * depth) / 2;
  const zr: Range = facing > 0 ? [front, back] : [back, front];
  const backBand: Range = facing > 0 ? [back - 0.18, back] : [back, back + 0.18];

  out.timber.push(box(`${key}-plinth`, [cx - half, cx + half], [y, y + 0.14], zr));
  out.timber.push(box(`${key}-back`, [cx - half, cx + half], [y + 0.14, y + 0.68], backBand));
  out.timber.push(box(`${key}-arm-w`, [cx - half, cx - half + 0.14], [y + 0.14, y + 0.56], zr));
  out.timber.push(box(`${key}-arm-e`, [cx + half - 0.14, cx + half], [y + 0.14, y + 0.56], zr));

  const inner: Range = facing > 0 ? [zr[0] + 0.08, zr[1] - 0.2] : [zr[0] + 0.2, zr[1] - 0.08];
  out.cushions.push(
    box(`${key}-seat`, [cx - half + 0.15, cx + half - 0.15], [y + 0.14, y + 0.32], inner),
  );
}

/** A low table: a slab on a recessed base, so it reads as floating. */
function lowTable(
  out: EstateLayout,
  key: string,
  cx: number,
  cz: number,
  y: number,
  width: number,
  depth: number,
  height: number,
): void {
  const hw = width / 2;
  const hd = depth / 2;
  out.metal.push(
    box(
      `${key}-base`,
      [cx - hw + 0.18, cx + hw - 0.18],
      [y, y + height - 0.05],
      [cz - hd + 0.15, cz + hd - 0.15],
    ),
  );
  out.stone.push(
    box(`${key}-top`, [cx - hw, cx + hw], [y + height - 0.05, y + height], [cz - hd, cz + hd]),
  );
}

/** A sun lounger: raked back, flat pad, low frame, laid along Z. */
function lounger(out: EstateLayout, key: string, cx: number, cz: number, y: number): void {
  const hw = 0.39;
  const length = 2.0;
  const head = cz - length / 2;
  const foot = cz + length / 2;

  out.timber.push(box(`${key}-frame`, [cx - hw, cx + hw], [y + 0.26, y + 0.34], [head, foot]));
  out.cushions.push(
    box(
      `${key}-pad`,
      [cx - hw + 0.04, cx + hw - 0.04],
      [y + 0.34, y + 0.42],
      [head + 0.66, foot - 0.05],
    ),
  );

  // The backrest. Specs carry no rotation, so a rake has to be approximated
  // in steps — but the first attempt used three 12 cm risers over 45 cm and
  // read unmistakably as a flight of stairs. Four shallow risers over a
  // longer run reads as a raked head instead, which is all this needs to be
  // at any distance a lounger is seen from.
  const steps = 4;
  const run = 0.62;
  for (let i = 0; i < steps; i += 1) {
    const z0 = head + 0.04 + (i * run) / steps;
    const z1 = head + 0.04 + ((i + 1) * run) / steps + 0.02;
    const top = y + 0.4 + 0.062 * (steps - i);
    out.cushions.push(
      box(`${key}-rest-${i}`, [cx - hw + 0.04, cx + hw - 0.04], [y + 0.34, top], [z0, z1]),
    );
  }

  out.posts.push({
    key: `${key}-leg-a`,
    position: [cx - hw + 0.08, y + 0.13, head + 0.25],
    scale: [0.03, 0.26, 0.03],
  });
  out.posts.push({
    key: `${key}-leg-b`,
    position: [cx + hw - 0.08, y + 0.13, head + 0.25],
    scale: [0.03, 0.26, 0.03],
  });
  out.posts.push({
    key: `${key}-leg-c`,
    position: [cx - hw + 0.08, y + 0.13, foot - 0.25],
    scale: [0.03, 0.26, 0.03],
  });
  out.posts.push({
    key: `${key}-leg-d`,
    position: [cx + hw - 0.08, y + 0.13, foot - 0.25],
    scale: [0.03, 0.26, 0.03],
  });
}

/** A dining chair: seat, raked back, four slim legs. */
function diningChair(
  out: EstateLayout,
  key: string,
  cx: number,
  cz: number,
  y: number,
  facing: 1 | -1,
): void {
  const hw = 0.24;
  const hd = 0.26;
  out.timber.push(box(`${key}-seat`, [cx - hw, cx + hw], [y + 0.44, y + 0.5], [cz - hd, cz + hd]));
  const backZ: Range = facing > 0 ? [cz + hd - 0.06, cz + hd] : [cz - hd, cz - hd + 0.06];
  out.timber.push(box(`${key}-back`, [cx - hw, cx + hw], [y + 0.5, y + 0.94], backZ));
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    out.posts.push({
      key: `${key}-leg-${sx}-${sz}`,
      position: [cx + sx * (hw - 0.04), y + 0.22, cz + sz * (hd - 0.04)],
      scale: [0.024, 0.44, 0.024],
    });
  }
}

/** A lantern: a slim stone body with one lit face. */
function lantern(out: EstateLayout, key: string, cx: number, cz: number, y: number): void {
  out.stone.push(box(`${key}-body`, [cx - 0.09, cx + 0.09], [y, y + 0.92], [cz - 0.09, cz + 0.09]));
  out.glow.push(
    box(`${key}-lens`, [cx - 0.065, cx + 0.065], [y + 0.66, y + 0.86], [cz - 0.095, cz - 0.085]),
  );
  out.glow.push(
    box(`${key}-lens-b`, [cx - 0.065, cx + 0.065], [y + 0.66, y + 0.86], [cz + 0.085, cz + 0.095]),
  );
}

function emptyLayout(): EstateLayout {
  return {
    paving: [],
    kerbs: [],
    timber: [],
    cushions: [],
    accents: [],
    stone: [],
    metal: [],
    posts: [],
    glow: [],
    pavedGround: [],
  };
}

/**
 * Resolves the whole estate: the arrival sequence, the terrace furniture,
 * the poolside, and the handful of lifestyle objects that make the
 * property read as inhabited.
 *
 * A pure function of the villa's plan and the site's resolved bounds, in
 * the same shape as every other generator here, so a configurator that
 * moves the building moves the estate with it.
 */
export function createEstateLayout(
  arrival: ArrivalConfig,
  outdoor: OutdoorConfig,
  plan: VillaPlan,
  site: SiteLayout,
  detail: DetailTier = 'high',
): EstateLayout {
  const tier = ESTATE_DETAIL[detail];
  const out = emptyLayout();

  // ── Arrival: a turning court on the door's axis, and the drive off it ──
  const courtY: Range = [0, arrival.kerbHeight];
  const driveCenterX = mid(arrival.courtX);
  const driveX: Range = [
    driveCenterX - arrival.driveWidth / 2,
    driveCenterX + arrival.driveWidth / 2,
  ];

  out.paving.push(
    ...pave('court', arrival.courtX, arrival.courtZ, courtY, arrival.module, arrival.joint),
    ...pave('drive', driveX, arrival.driveZ, courtY, arrival.module, arrival.joint),
  );

  out.kerbs.push(
    ...kerb('court-kerb', arrival.courtX, arrival.courtZ, [0, arrival.kerbHeight + 0.02], 0.16),
    ...kerb('drive-kerb', driveX, arrival.driveZ, [0, arrival.kerbHeight + 0.02], 0.16),
  );

  // Planted margins were tried either side of the drive and removed. Bare
  // soil beside paving reads as a road shoulder, not as landscaping, and
  // the two dark strips flanking the approach were the single ugliest
  // thing in the frame. Lawn running clean to the kerb is both the more
  // restrained answer and the one an estate of this kind actually uses.

  out.pavedGround.push(
    {
      x: [arrival.courtX[0] - 0.4, arrival.courtX[1] + 0.4],
      z: [arrival.courtZ[0] - 0.4, arrival.courtZ[1] + 0.4],
    },
    {
      x: [driveX[0] - 0.4, driveX[1] + 0.4],
      z: [arrival.driveZ[0] - 0.4, arrival.driveZ[1] + 0.4],
    },
  );

  // Two lanterns marking the court's mouth, on the drive's own centreline
  // offsets — an entrance is announced by a pair, never by one.
  lantern(out, 'lantern-w', driveX[0] - 0.7, arrival.courtZ[1] - 0.6, arrival.kerbHeight);
  lantern(out, 'lantern-e', driveX[1] + 0.7, arrival.courtZ[1] - 0.6, arrival.kerbHeight);

  // ── Terrace lounge, facing the pool ────────────────────────────────────
  const [lx, lz] = outdoor.loungeCenter;
  if (tier.lounge) {
    outdoorSofa(out, 'terrace-sofa', lx, lz - 1.35, outdoor.terraceY, 2.5, 0.95);
    lowTable(out, 'terrace-table', lx, lz + 0.35, outdoor.terraceY, 1.25, 0.7, 0.34);
    outdoorChair(out, 'terrace-chair-w', lx - 1.05, lz + 1.7, outdoor.terraceY, -1);
    outdoorChair(out, 'terrace-chair-e', lx + 1.05, lz + 1.7, outdoor.terraceY, -1);

    if (tier.details) {
      // A tray on the table. One object, off-centre.
      out.metal.push(
        box(
          'terrace-tray',
          [lx - 0.12, lx + 0.34],
          [outdoor.terraceY + 0.34, outdoor.terraceY + 0.37],
          [lz + 0.22, lz + 0.52],
        ),
      );
    }
  }

  // ── Terrace dining, off the living glass ──────────────────────────────
  const [dx, dz] = outdoor.diningCenter;
  if (tier.dining) {
    const tableW = 2.4;
    const tableD = 1.0;
    out.timber.push(
      box(
        'dining-top',
        [dx - tableW / 2, dx + tableW / 2],
        [outdoor.terraceY + 0.68, outdoor.terraceY + 0.74],
        [dz - tableD / 2, dz + tableD / 2],
      ),
    );
    for (const side of [-1, 1] as const) {
      out.metal.push(
        box(
          `dining-trestle-${side}`,
          [dx + side * 0.78, dx + side * 0.84],
          [outdoor.terraceY, outdoor.terraceY + 0.68],
          [dz - tableD / 2 + 0.14, dz + tableD / 2 - 0.14],
        ),
      );
    }

    const perSide = Math.max(0, Math.round(tier.diningSeats / 2));
    for (let i = 0; i < perSide; i += 1) {
      const offset = (i - (perSide - 1) / 2) * 0.78;
      diningChair(out, `dining-chair-n-${i}`, dx + offset, dz - 0.92, outdoor.terraceY, 1);
      diningChair(out, `dining-chair-s-${i}`, dx + offset, dz + 0.92, outdoor.terraceY, -1);
    }
  }

  // ── Poolside: loungers along the deck's east margin ────────────────────
  const loungerZs = outdoor.loungerZ.slice(0, tier.loungers);
  loungerZs.forEach((z, index) => {
    lounger(out, `lounger-${index}`, outdoor.loungerX, z, outdoor.deckY);
  });

  if (loungerZs.length >= 2) {
    const between = (loungerZs[0]! + loungerZs[1]!) / 2;
    lowTable(out, 'pool-side-table', outdoor.loungerX, between, outdoor.deckY, 0.5, 0.5, 0.42);

    if (tier.details) {
      // A folded towel over the foot of the first lounger — the smallest
      // possible signal that the property is used rather than staged.
      out.accents.push(
        box(
          'pool-towel',
          [outdoor.loungerX - 0.3, outdoor.loungerX + 0.3],
          [outdoor.deckY + 0.34, outdoor.deckY + 0.42],
          [loungerZs[0]! + 0.62, loungerZs[0]! + 0.92],
        ),
      );
    }
  }

  // A pair of lanterns where the terrace meets the pool steps, aligned to
  // the living opening rather than to the terrace's own centre.
  if (tier.details) {
    lantern(
      out,
      'terrace-lantern-w',
      plan.livingAxisX[0] + 0.6,
      plan.terraceFrontZ - 0.7,
      outdoor.terraceY,
    );
    lantern(
      out,
      'terrace-lantern-e',
      plan.livingAxisX[1] - 0.6,
      plan.terraceFrontZ - 0.7,
      outdoor.terraceY,
    );
  }

  void site;
  return out;
}

export type { EstateLayout, PavingRect, ColumnSpec };
