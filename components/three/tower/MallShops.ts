import { SIGNAGE_ASPECT, TENANTS, tenantCell } from '../textures/DecalMaps';
import type { DecalSpec } from '../DecalPlanes';
import type { ModelName } from '../models/ModelLibrary';
import type { PropPlacement } from './SiteProps';
import type { BoxSpec, Range } from '../villa/VillaTypes';
import type { TowerPlan } from './TowerTypes';

/**
 * The shops themselves.
 *
 * ## What was missing
 *
 * The podium had five levels of retail programme — a concierge desk, racks,
 * counters, a food hall, a cinema — laid out along the edge of the atrium
 * void. What it did not have was shops. Every prop stood on an open plate,
 * so the mall read as a furniture showroom in a car park: no tenancies, no
 * shopfronts, no thresholds, and nothing at all to tell you where one
 * business ended and the next began. The signage existed and was on the
 * OUTSIDE of the building, which is the one place a mall's tenants are not.
 *
 * A mall is a street of demised units. Each has party walls it shares with
 * its neighbours, a glazed front onto the circulation with a way in, a
 * fascia over the opening with its name on it, and a floor finish that
 * changes at the threshold. That list is what this file builds.
 *
 * ## About the names
 *
 * Every tenant is invented — see `TENANTS` in `DecalMaps`. Putting a real
 * retailer's wordmark on the front of a building that is not theirs is a
 * trademark problem that no amount of "it is only a render" survives, and
 * it stays a problem whether the name is modelled, textured or typed. The
 * sixteen names here are the same sixteen already baked into the DEC-01
 * signage atlas, so the mall's shopfronts and the building's exterior
 * signage advertise the same businesses.
 */

const mid = (r: Range) => (r[0] + r[1]) / 2;
const span = (r: Range) => r[1] - r[0];

function box(key: string, x: Range, y: Range, z: Range): BoxSpec {
  return { key, position: [mid(x), mid(y), mid(z)], scale: [span(x), span(y), span(z)] };
}

/** Deterministic jitter, matching the rest of the project. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export type MallLayout = {
  /** Party walls between units and the back wall of each. */
  walls: BoxSpec[];
  /** The shopfront glazing, either side of each entrance. */
  glazing: BoxSpec[];
  /** The signage band over each opening, and the bulkhead behind it. */
  fascia: BoxSpec[];
  /** The unit's own floor finish, which changes at the threshold. */
  floors: BoxSpec[];
  /** A lit reveal under each fascia. */
  coves: BoxSpec[];
  /** Tenant names, on the fascias, facing the mall. */
  signage: DecalSpec[];
  /** The fit-out inside each unit. */
  models: PropPlacement[];
};

/**
 * How the sixteen tenancies are distributed.
 *
 * Three units a side on the fashion and design levels, two a side in the
 * food hall because a restaurant needs a bigger box than a boutique. That
 * comes to exactly sixteen, which is how many names the signage atlas holds
 * — a constraint worth designing to rather than working around, because the
 * alternative is a mall where two units carry the same sign.
 *
 * Grade is left alone: the ground floor is arrival, and lining the entrance
 * hall with shopfronts is what turns a lobby into a corridor between two
 * shops. The top level is the cinema, which is one tenant and already built.
 */
const LEVELS: readonly { level: number; perSide: number; trade: Trade }[] = [
  { level: 1, perSide: 3, trade: 'fashion' },
  { level: 2, perSide: 3, trade: 'home' },
  { level: 3, perSide: 2, trade: 'food' },
];

type Trade = 'fashion' | 'home' | 'food';

/** Depth of a unit back from the mall, and the glazed head height. */
const UNIT_DEPTH = 6.0;
const SHOPFRONT_HEAD = 4.0;
const FASCIA: Range = [4.05, 4.72];
const ENTRANCE_WIDTH = 2.4;
const PARTY_WALL = 0.18;

/**
 * One unit's fit-out.
 *
 * `across` runs along the shopfront and `back` runs into the unit from the
 * threshold, so a single layout serves both sides of the mall and the
 * mirroring is done once by the caller.
 */
function fitOut(
  trade: Trade,
  seed: number,
  place: (key: string, name: ModelName, across: number, back: number, turn?: number) => void,
  dressed = true,
): void {
  const r = (n: number) => rand(seed * 31 + n);

  if (trade === 'fashion') {
    // Rails down both flanks, a table of folded goods in the middle, and
    // the till at the back — which is where a till goes, because it is the
    // last thing you reach and the first thing staff can see the door from.
    // The three that make it a clothes shop from inside it: something to
    // buy from, something to buy off, and a figure in the window.
    place('till', 'retail-counter', 1.3, UNIT_DEPTH - 1.4, Math.PI);
    place('rail-a', 'retail-rack', -1.5, 1.8, Math.PI / 2);
    place('form-a', 'mannequin', -1.9 + r(1) * 0.3, 0.9);
    if (!dressed) return;
    place('rail-b', 'retail-rack', 1.5, 1.8, -Math.PI / 2);
    place('rail-c', 'retail-rack', -1.5, 3.6, Math.PI / 2);
    place('shelf', 'retail-shelf', 0, UNIT_DEPTH - 0.5);
    place('table', 'low-table', 0.2, 2.4);
    place('form-b', 'mannequin', -1.1 + r(2) * 0.3, 1.3);
    place('form-c', 'mannequin', 1.7 + r(3) * 0.3, 1.0);
    return;
  }

  if (trade === 'home') {
    // A design shop is a room dressed as a room. The stock is the setting.
    place('sofa', 'sofa-3seat', -0.6, 2.6, Math.PI);
    place('table', 'organic-table-lg', 0.1, 3.4);
    place('till', 'retail-counter', 1.4, UNIT_DEPTH - 1.5, Math.PI);
    if (!dressed) return;
    place('chair', 'lounge-chair', 1.4, 2.2, -Math.PI / 2);
    place('drum', 'side-drum', 1.6, 3.6);
    place('lamp', 'floor-lamp', -1.9, 3.2);
    place('shelf', 'retail-shelf', 0, UNIT_DEPTH - 0.5);
    place('case', 'vitrine', -1.8, 1.2);
    place('vessel', 'vessel-tall', 1.9, 1.1);
    return;
  }

  // Food: a counter across the front, tables behind it, pendants over.
  place('counter', 'retail-counter', 0, 1.6, Math.PI);
  place('back', 'kitchen-run', 0, UNIT_DEPTH - 0.6);
  // One laid table is a restaurant. Three is a restaurant with covers.
  const covers = dressed ? 3 : 1;
  for (let i = 0; i < covers; i += 1) {
    const across = -2.2 + i * 2.2;
    place(`table-${i}`, 'dining-table', across, 3.6);
    place(`chair-${i}a`, 'dining-chair', across - 0.9, 3.6, Math.PI / 2);
    place(`chair-${i}b`, 'dining-chair', across + 0.9, 3.6, -Math.PI / 2);
  }
  if (!dressed) return;
  place('stool-a', 'bar-stool', -2.4, 2.5);
  place('stool-b', 'bar-stool', -1.2, 2.5);
}

/**
 * Where the shops go, and how much floor is left in front of them.
 *
 * A mall is void, then walkway, then shopfront. The first cut of this put
 * the fronts hard on the void edge with no circulation at all, which built a
 * unit around the camera that stands on the upper gallery — you looked out
 * at the inside of a shop wall.
 *
 * The runs are west and south because those are the sides with the depth.
 * The atrium sits toward the ocean end of the podium: there is 40m of plate
 * west of it and 6m east, so an east run would be a two-metre-deep shop.
 */
const WALKWAY = 4.0;

type Run = {
  /** The axis units are laid out along. */
  axis: 'x' | 'z';
  /** Extent along that axis — the void's own span, so shops face the void. */
  along: Range;
  /** Where the shopfronts stand, on the other axis. */
  frontAt: number;
  /** Which way the units run back from the front. */
  dir: 1 | -1;
  /** Yaw for a piece facing the mall, and for the fascia's lettering. */
  faceYaw: number;
  signYaw: number;
};

/**
 * Options for the mall.
 *
 * ## What the stock costs, measured
 *
 * Sixteen fitted units add 1,189k triangles a frame and 148 draw calls —
 * about 74k a shop, and almost all of it the glTF stock rather than the
 * shell. The draw calls are the bigger surprise: the shops introduce models
 * the site-props batch did not previously carry, and each new piece is new
 * instanced meshes in that batch however few of it there are.
 *
 * On a phone the stock comes out and the shells stay. A unit with a glazed
 * front, a lit fascia and its name on it still reads as a shop from the
 * walkway opposite, which is where a visitor sees fifteen of the sixteen
 * from. It is the rails and the mannequins inside that nobody resolves.
 */
export type MallOptions = {
  /** Whether to put stock in the units. */
  dressed?: boolean;
};

export function createMallShops(plan: TowerPlan, { dressed = true }: MallOptions = {}): MallLayout {
  const { atriumX, atriumZ, podiumLevelHeight } = plan;

  const walls: BoxSpec[] = [];
  const glazing: BoxSpec[] = [];
  const fascia: BoxSpec[] = [];
  const floors: BoxSpec[] = [];
  const coves: BoxSpec[] = [];
  const signage: DecalSpec[] = [];
  const models: PropPlacement[] = [];

  const runs: readonly Run[] = [
    // West of the void, fronts facing +X across the walkway into it.
    {
      axis: 'z',
      along: atriumZ,
      frontAt: atriumX[0] - WALKWAY,
      dir: -1,
      faceYaw: -Math.PI / 2,
      signYaw: Math.PI / 2,
    },
    // South of the void, fronts facing -Z.
    {
      axis: 'x',
      along: atriumX,
      frontAt: atriumZ[1] + WALKWAY,
      dir: 1,
      faceYaw: 0,
      signYaw: Math.PI,
    },
  ];

  let tenant = 0;

  for (const { level, perSide, trade } of LEVELS) {
    const floorY = level * podiumLevelHeight;

    for (const run of runs) {
      const unitWidth = span(run.along) / perSide;

      for (let i = 0; i < perSide; i += 1) {
        const name = TENANTS[tenant % TENANTS.length] as string;
        const cell = tenantCell(tenant);
        tenant += 1;

        const key = `shop-${level}-${run.axis}-${i}`;
        const a0 = run.along[0] + unitWidth * i;
        const a1 = a0 + unitWidth;
        const centreA = (a0 + a1) / 2;

        /** A box given its span along the run and its depth into the unit. */
        const at = (boxKey: string, along: Range, y: Range, depth: Range): BoxSpec => {
          const near = run.frontAt + run.dir * depth[0];
          const far = run.frontAt + run.dir * depth[1];
          const other: Range = near < far ? [near, far] : [far, near];
          return run.axis === 'x' ? box(boxKey, along, y, other) : box(boxKey, other, y, along);
        };

        const fullY: Range = [floorY, floorY + FASCIA[1]];

        // ── The box ────────────────────────────────────────────────────
        // Party walls on both edges. Neighbours share one, so only the far
        // edge is drawn except on the first unit, which needs both.
        for (const [edge, a] of [
          ['a', a0],
          ['b', a1],
        ] as const) {
          if (edge === 'a' && i > 0) continue;
          walls.push(
            at(`${key}-party-${edge}`, [a - PARTY_WALL / 2, a + PARTY_WALL / 2], fullY, [
              0,
              UNIT_DEPTH,
            ]),
          );
        }
        walls.push(at(`${key}-back`, [a0, a1], fullY, [UNIT_DEPTH - 0.2, UNIT_DEPTH]));
        floors.push(
          at(
            `${key}-floor`,
            [a0 + PARTY_WALL, a1 - PARTY_WALL],
            [floorY, floorY + 0.02],
            [0, UNIT_DEPTH],
          ),
        );

        // ── The shopfront ──────────────────────────────────────────────
        // Glass either side of a clear opening, and the bulkhead over the
        // whole width. The opening is the shop: a unit with a sealed front
        // is a vitrine, and you cannot walk into a vitrine.
        const doorA: Range = [centreA - ENTRANCE_WIDTH / 2, centreA + ENTRANCE_WIDTH / 2];
        const headY: Range = [floorY, floorY + SHOPFRONT_HEAD];
        glazing.push(at(`${key}-glass-a`, [a0, doorA[0]], headY, [0, 0.06]));
        glazing.push(at(`${key}-glass-b`, [doorA[1], a1], headY, [0, 0.06]));

        fascia.push(
          at(`${key}-fascia`, [a0, a1], [floorY + FASCIA[0], floorY + FASCIA[1]], [-0.3, 0.02]),
        );
        // The bulkhead between the glass head and the fascia, so there is no
        // slot of daylight from the level above.
        fascia.push(
          at(`${key}-bulkhead`, [a0, a1], [floorY + SHOPFRONT_HEAD, floorY + FASCIA[0]], [0, 0.06]),
        );
        coves.push(
          at(
            `${key}-cove`,
            [a0 + 0.3, a1 - 0.3],
            [floorY + FASCIA[0] - 0.07, floorY + FASCIA[0] - 0.02],
            [-0.16, -0.04],
          ),
        );

        // ── The name ───────────────────────────────────────────────────
        // Height set from the fascia, width following the atlas cell's 4:1,
        // so a long name and a short one share a cap height rather than a
        // length — which is how a fascia scheme in a real centre is written.
        const signHeight = 0.42;
        const signAt = run.frontAt - run.dir * 0.32;
        signage.push({
          key: `${key}-sign`,
          position:
            run.axis === 'x'
              ? [centreA, floorY + mid(FASCIA), signAt]
              : [signAt, floorY + mid(FASCIA), centreA],
          size: [Math.min(signHeight * SIGNAGE_ASPECT, unitWidth - 0.7), signHeight],
          rotationY: run.signYaw,
          cell,
        });

        // ── The fit-out ────────────────────────────────────────────────
        //
        // This used to `continue` here on the low tier, which left sixteen
        // lit, signed, glazed units with absolutely nothing inside them.
        // The reasoning was that nobody resolves a rail from across the
        // walkway — true, and it stops being true the moment a visitor
        // walks in through the door, which the walkthrough invites them to
        // do. An empty shop is not a cheaper shop, it is a shop that has
        // gone out of business.
        //
        // So the tier now takes out the long tail and leaves the two or
        // three pieces that make each unit read as its trade from inside
        // it. Roughly a third of the stock, and no empty rooms.
        void name;
        fitOut(
          trade,
          tenant,
          (partKey, model, across, back, turn = 0) => {
            const depthAt = run.frontAt + run.dir * back;
            models.push({
              key: `${key}-${partKey}`,
              name: model,
              position:
                run.axis === 'x'
                  ? [centreA + across, floorY, depthAt]
                  : [depthAt, floorY, centreA + across],
              rotationY: run.faceYaw + turn,
            });
          },
          dressed,
        );
      }
    }
  }

  return { walls, glazing, fascia, floors, coves, signage, models };
}
