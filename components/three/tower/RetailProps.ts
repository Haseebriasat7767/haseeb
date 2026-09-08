import type { ModelName } from '../models/ModelLibrary';
import type { PropPlacement } from './SiteProps';
import type { TowerPlan } from './TowerTypes';

/**
 * The retail fit-out, level by level.
 *
 * Five storeys of shopping mall were, until now, five empty floor plates
 * with a lit void through the middle. Then they were five copies of the same
 * clothes shop, which fixed the emptiness and introduced a worse problem: a
 * mall is not one shop repeated, it is a sequence of different rooms, and
 * the sequence is the thing a visitor actually experiences. Five identical
 * levels stacked in a void read as a rendering artefact — you can see at a
 * glance that the building is generated, because no real developer lets the
 * same tenant have all five floors.
 *
 * So each level has a programme, and they are the ordinary ones for a podium
 * of this size: entrance and lobby at grade, fashion above it, home and
 * design above that, the food hall where the smell can vent, and the cinema
 * at the top where it needs no daylight and pulls people past everything
 * else on the way up.
 *
 * Everything is placed at the void's edge rather than distributed across the
 * plates. That is both how a mall is actually planned — the shopfronts face
 * the atrium because the atrium is the street — and the only place any of it
 * is visible from, since every camera in the podium looks across or up
 * through the void.
 *
 * ## On the cost of all this
 *
 * These are drawn by `InstancedModels`, one instanced mesh per distinct
 * primitive rather than one draw call per placement. That is what makes a
 * per-level programme affordable at all: mounted the old way, the single
 * repeated fit-out this replaces was already costing 802 draw calls against
 * a budget of 250, and five different ones would have been worse.
 */

/** Deterministic jitter, matching the rest of the project. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const HALF_PI = Math.PI / 2;

/**
 * What each retail level is.
 *
 * Ground to top, and in the order a developer would actually stack them —
 * see the file docstring for why each sits where it does.
 */
const PROGRAMMES = ['lobby', 'fashion', 'home', 'foodHall', 'cinema'] as const;
type Programme = (typeof PROGRAMMES)[number];

type Bay = {
  /** Called with a position along the void's long axis, and a yaw. */
  put: (key: string, name: ModelName, alongZ: number, outward: number, yaw?: number) => void;
  /** Hangs a pendant from this level's ceiling. */
  hang: (key: string, alongZ: number, outward: number) => void;
  /** A deterministic value for this bay. */
  r: (n: number) => number;
};

/**
 * One side of one level, laid out as its programme.
 *
 * `outward` is metres away from the void edge into the plate, so a single
 * layout serves both sides and the west/east mirroring is handled once by
 * the caller rather than in every line here.
 */
function fitOut(programme: Programme, bay: Bay): void {
  const { put, hang, r } = bay;

  if (programme === 'lobby') {
    // A concierge desk and a place to wait. No shopfronts at grade on this
    // side of the void: the ground floor is arrival, and treating it as
    // retail is what makes a lobby feel like a corridor between two shops.
    put('desk', 'retail-counter', -3.4, 1.0);
    put('vessel', 'vessel-tall', -3.4, 2.2);
    put('sofa', 'sofa-3seat', 1.2, 1.6, Math.PI);
    put('chair-a', 'lounge-chair', -0.4, 2.6, -HALF_PI);
    put('chair-b', 'lounge-chair', 2.8, 2.6, -HALF_PI);
    put('table', 'organic-table-lg', 1.2, 2.6);
    put('trough-a', 'planter-trough', -6.0, 0.9);
    put('trough-b', 'planter-trough', 5.2, 0.9);
    put('lamp', 'floor-lamp', 3.6, 1.4);
    hang('pendant-a', -1.0, 1.8);
    hang('pendant-b', 2.2, 1.8);
    return;
  }

  if (programme === 'fashion') {
    put('shelf-a', 'retail-shelf', -4.2, 1.4);
    put('shelf-b', 'retail-shelf', 4.2, 1.4);
    put('counter', 'retail-counter', 1.9, 0.9);
    put('rack', 'retail-rack', -1.6, -0.4);
    put('vitrine', 'vitrine', 5.4, -0.5);
    for (let m = 0; m < 2; m += 1) {
      const j = r(m * 17);
      put(`mq-${m}`, 'mannequin', -5.6 + m * 1.7, -(0.7 + j * 0.5), (j - 0.5) * 0.9);
    }
    return;
  }

  if (programme === 'home') {
    // The same shelving, dressed as a furniture showroom rather than a
    // wardrobe: pieces on the floor and objects on the shelves.
    put('shelf-a', 'retail-shelf', -5.0, 1.4);
    put('shelf-b', 'retail-shelf', 5.0, 1.4);
    put('sofa', 'sofa-3seat', -1.8, 1.9, Math.PI);
    put('table', 'organic-table-lg', -1.8, 3.0);
    put('chair', 'wingback', 1.4, 2.6, -HALF_PI);
    put('drum', 'side-drum', 2.6, 1.7);
    // Well off the void's midpoint. At 0.2 this stood exactly where the
    // upper-gallery camera does, and filled half that framing with a lamp
    // shade — the camera positions are as much a constraint on the fit-out
    // as the walls are.
    put('lamp', 'floor-lamp', 4.4, 1.2);
    put('vessel', 'vessel-round', -6.2, -0.4);
    put('bowl', 'bowl', 3.8, -0.4);
    put('books', 'book-stack', 4.6, -0.4);
    return;
  }

  if (programme === 'foodHall') {
    // A servery with stools at it, and communal tables behind. The counter
    // faces the void because that is the queue.
    // The counter stands back from the balustrade and the stools sit between
    // the two, which is the only arrangement that leaves anywhere to queue.
    // A negative offset here puts them on the wrong side of the edge — the
    // first pass had five stools hovering over a fifteen-metre drop.
    put('counter-a', 'retail-counter', -4.0, 1.9);
    put('counter-b', 'retail-counter', -1.4, 1.9);
    for (let i = 0; i < 5; i += 1) {
      put(`stool-${i}`, 'bar-stool', -5.0 + i * 1.05, 1.0, Math.PI);
    }
    put('table', 'dining-table', 3.4, 3.0);
    for (let i = 0; i < 4; i += 1) {
      const side = i % 2 === 0 ? 1 : -1;
      put(
        `chair-${i}`,
        'dining-chair',
        3.4 + (i < 2 ? -0.8 : 0.8),
        2.3 + side * 0.85,
        side > 0 ? Math.PI : 0,
      );
    }
    put('trough', 'planter-trough', 6.2, 1.1);
    hang('pendant-a', -4.0, 1.9);
    hang('pendant-b', -1.4, 1.9);
    hang('pendant-c', 3.4, 3.0);
    return;
  }

  // cinema — a box office on the void, and the auditorium behind it.
  put('desk', 'retail-counter', -4.6, 0.9);
  put('sofa', 'outdoor-sofa', -1.2, 1.5, Math.PI);
  put('ottoman', 'ottoman', 0.6, 1.5);
  for (let row = 0; row < 4; row += 1) {
    // Two blocks side by side with an aisle between, four rows deep. One
    // column of four seats read as a bench rather than as an auditorium.
    put(`row-${row}-a`, 'cinema-row', 3.0, 2.2 + row * 0.95, Math.PI);
    put(`row-${row}-b`, 'cinema-row', 5.6, 2.2 + row * 0.95, Math.PI);
  }
  put('trough', 'planter-trough', 1.8, 0.8);
  hang('pendant-a', -3.0, 1.2);
  hang('pendant-b', 1.0, 1.2);
}

export function createRetailProps(plan: TowerPlan): PropPlacement[] {
  const out: PropPlacement[] = [];
  // Chunked by level. Instancing without this draws every piece of shop
  // fitting on all five floors in every framing, because one batch spanning
  // the whole podium is one bounding sphere and is never off screen.
  let chunk = '';
  const put = (key: string, name: ModelName, x: number, y: number, z: number, yaw: number) => {
    out.push({ key, name, position: [x, y, z], rotationY: yaw, chunk });
  };

  const { atriumX, atriumZ, podiumLevels, podiumLevelHeight } = plan;
  const zMid = (atriumZ[0] + atriumZ[1]) / 2;

  for (let level = 0; level < podiumLevels; level += 1) {
    const y = level * podiumLevelHeight;
    chunk = `retail-${level}`;
    const programme = PROGRAMMES[level % PROGRAMMES.length]!;
    // Just under this level's slab. Pendants carry their own drop, so what
    // they want is the soffit, not the floor.
    const ceilingY = (level + 1) * podiumLevelHeight - 0.4;

    for (const [side, edge, facing] of [
      ['w', atriumX[0], HALF_PI],
      ['e', atriumX[1], -HALF_PI],
    ] as const) {
      // West of the void, "outward" is −X; east of it, +X.
      const inward = side === 'w' ? -1 : 1;
      const prefix = `retail-${level}-${side}`;

      fitOut(programme, {
        r: (n) => rand(level * 131 + n * 17 + (side === 'w' ? 5 : 11)),
        put: (key, name, alongZ, outward, yaw = 0) =>
          put(
            `${prefix}-${key}`,
            name,
            edge + inward * outward,
            y,
            zMid + alongZ,
            facing + yaw * inward,
          ),
        hang: (key, alongZ, outward) =>
          put(`${prefix}-${key}`, 'pendant', edge + inward * outward, ceilingY, zMid + alongZ, 0),
      });

      // One or two people, so the level is occupied rather than merely
      // stocked. Below the top floor only — a cinema level at this hour is
      // between screenings.
      if (level < podiumLevels - 1) {
        put(
          `${prefix}-shopper`,
          rand(level * 7 + (side === 'w' ? 1 : 2)) > 0.5 ? 'person-standing' : 'person-seated',
          edge + inward * 2.6,
          y,
          zMid + 2.6,
          rand(level * 13 + 3) * Math.PI * 2,
        );
      }
    }

    // Lift entrances on the void's north wall, every level.
    put(`lift-${level}-a`, 'lift-doors', atriumX[0] + 4.0, y, atriumZ[0] - 0.1, 0);
    put(`lift-${level}-b`, 'lift-doors', atriumX[0] + 6.0, y, atriumZ[0] - 0.1, 0);

    // Escalators, alternating direction so the bank scissors the way a
    // real one does. The run is fixed by the rise at thirty degrees, so
    // each flight starts where the last one finished.
    if (level < podiumLevels - 1) {
      const up = level % 2 === 0;
      // Hugging the void's west edge rather than crossing its middle.
      //
      // Run down the centre they are two long diagonals straight across the
      // vertical view, and the atrium camera looks *up* — so they blocked
      // the roof light and most of the levels above. Real atrium banks sit
      // against one side for exactly this reason.
      const x = atriumX[0] + (up ? 2.0 : 3.6);
      // At thirty degrees the run is the rise over tan 30, so a five-metre
      // storey needs 8.66 m of floor — which is what decides that these
      // fit inside a fourteen-metre void at all.
      const start = up ? atriumZ[1] - 1.2 : atriumZ[0] + 1.2;
      put(`esc-${level}`, 'escalator', x, y, start, up ? 0 : Math.PI);
    }
  }

  return out;
}
