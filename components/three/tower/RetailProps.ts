import type { ModelName } from '../models/ModelLibrary';
import type { PropPlacement } from './SiteProps';
import type { TowerPlan } from './TowerTypes';

/**
 * The retail fit-out, laid out around the atrium on every level.
 *
 * Five storeys of shopping mall were, until now, five empty floor plates
 * with a lit void through the middle. The void was doing all the work and
 * the levels either side of it were doing none — which is the mall
 * equivalent of a furnished lounge in an otherwise empty house.
 *
 * Everything is placed at the void's edge rather than distributed across
 * the plates. That is both how a mall is actually planned — the shopfronts
 * face the atrium because the atrium is the street — and the only place any
 * of it is visible from, since every camera in the podium looks across or
 * up through the void.
 */

/** Deterministic jitter, matching the rest of the project. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const HALF_PI = Math.PI / 2;

export function createRetailProps(plan: TowerPlan): PropPlacement[] {
  const out: PropPlacement[] = [];
  const put = (key: string, name: ModelName, x: number, y: number, z: number, yaw: number) => {
    out.push({ key, name, position: [x, y, z], rotationY: yaw });
  };

  const { atriumX, atriumZ, podiumLevels, podiumLevelHeight } = plan;
  const zMid = (atriumZ[0] + atriumZ[1]) / 2;

  for (let level = 0; level < podiumLevels; level += 1) {
    const y = level * podiumLevelHeight;

    // Two shopfronts a level, one either side of the void, facing into it.
    for (const [side, sx, facing] of [
      ['w', atriumX[0] - 1.6, HALF_PI],
      ['e', atriumX[1] + 1.6, -HALF_PI],
    ] as const) {
      const inward = side === 'w' ? 1 : -1;
      const k = (n: string) => `retail-${level}-${side}-${n}`;

      put(k('shelf-a'), 'retail-shelf', sx - inward * 1.4, y, zMid - 4.2, facing);
      put(k('shelf-b'), 'retail-shelf', sx - inward * 1.4, y, zMid + 4.2, facing);
      put(k('counter'), 'retail-counter', sx - inward * 0.9, y, zMid + 1.9, facing);
      put(k('rack'), 'retail-rack', sx + inward * 0.4, y, zMid - 1.6, facing);
      put(k('vitrine'), 'vitrine', sx + inward * 0.5, y, zMid + 5.4, facing);

      for (let m = 0; m < 2; m += 1) {
        const r = rand(level * 31 + m * 17 + (side === 'w' ? 5 : 11));
        put(
          k(`mq-${m}`),
          'mannequin',
          sx + inward * (0.7 + r * 0.5),
          y,
          zMid - 5.6 + m * 1.7,
          facing + (r - 0.5) * 0.9,
        );
      }

      // A shopper or two, so the level is occupied rather than stocked.
      if (level < 4) {
        put(
          k('shopper'),
          rand(level * 7 + (side === 'w' ? 1 : 2)) > 0.5 ? 'person-standing' : 'person-seated',
          sx + inward * 1.5,
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
