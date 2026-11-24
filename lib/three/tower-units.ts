import { TOWER_CONFIG } from '@/components/three/tower/TowerGeometry';
import { TOWER_VIEWS } from './tower-views';
import type { CameraView } from '@/types';

/**
 * The show unit: the click-to-enter destination.
 *
 * The tower's walkthrough used to be an 18-step slideshow with no way to
 * touch the building itself. Phase 2 opens on the aerial with a marker per
 * residential floor; the marker on the furnished floor flies the visitor
 * into the one fitted apartment, and door markers carry them room to room.
 * Every other floor's marker frames that floor from outside, as the
 * inventory already did — there is no interior to enter there.
 */

/** The furnished floor — the only unit with a fitted interior to enter. */
export const SHOW_UNIT_FLOOR = TOWER_CONFIG.furnishedLevel;
/** e.g. "11A" — floor 11, the only unit on it. */
export const SHOW_UNIT_ID = `${SHOW_UNIT_FLOOR}A`;
/**
 * Finished floor level of the show unit (TowerGeometry's furnishedFloorY),
 * for the door markers' height.
 */
export const SHOW_UNIT_FLOOR_Y = 62.74;

export type TowerRoomId = 'living' | 'dining' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony';

export const ROOM_ORDER: readonly TowerRoomId[] = [
  'living',
  'dining',
  'bedroom',
  'kitchen',
  'bathroom',
  'balcony',
];

const stepIndexOf = (id: string): number => TOWER_VIEWS.findIndex((entry) => entry.id === id);

export type TowerRoom = {
  label: string;
  note: string;
  /**
   * Index into TOWER_VIEWS, for the step rail — the dining room has no
   * entry of its own, so it reuses the living room's step.
   */
  stepIndex: number;
  view: CameraView;
};

/**
 * The show unit's room graph. Living, bedroom, kitchen, bathroom and
 * balcony reuse the tour's own framings (the cameras were already composed
 * for these rooms); the dining room gets a new framing across the table
 * toward the kitchen, since the tour never stood there.
 */
export const TOWER_ROOMS: Record<TowerRoomId, TowerRoom> = {
  living: {
    label: 'Living room',
    note: 'Turned to face the room, not the window — the glass lights it and frames the furniture.',
    stepIndex: stepIndexOf('residence'),
    view: TOWER_VIEWS[stepIndexOf('residence')]!,
  },
  dining: {
    label: 'Dining room',
    note: 'Between the kitchen and the lounge glazing — the table the flat eats at.',
    stepIndex: stepIndexOf('residence'),
    view: {
      ...TOWER_VIEWS[stepIndexOf('residence')]!,
      id: 'dining-room',
      label: 'Dining room',
      position: [-10.5, 64.3, -3.0],
      target: [-13.5, 63.9, -6.2],
    },
  },
  bedroom: {
    label: 'Master bedroom',
    note: 'Behind the lounge, against the northern glazing, so the bed has a window on one side and a fluted wall behind it.',
    stepIndex: stepIndexOf('bedroom'),
    view: TOWER_VIEWS[stepIndexOf('bedroom')]!,
  },
  kitchen: {
    label: 'Kitchen',
    note: 'Across the island toward the run, which is the way a kitchen is photographed: the island is the object, the run is the backdrop.',
    stepIndex: stepIndexOf('kitchen'),
    view: TOWER_VIEWS[stepIndexOf('kitchen')]!,
  },
  bathroom: {
    label: 'Bathroom',
    note: 'Stone underfoot, vanity on the party wall, bath freestanding in the light.',
    stepIndex: stepIndexOf('bathroom'),
    view: TOWER_VIEWS[stepIndexOf('bathroom')]!,
  },
  balcony: {
    label: 'Balcony',
    note: 'Outside the glass line, inside the balustrade, turned toward the sun.',
    stepIndex: stepIndexOf('balcony'),
    view: TOWER_VIEWS[stepIndexOf('balcony')]!,
  },
};

/**
 * The fly-through into the show unit, as a chain of framings the camera
 * eases through one at a time (~1.4 s apart, so the damped controller is
 * still travelling when the target moves — a flight, not a slideshow).
 * Starts wide on the tower, closes on the ocean facade, crosses the
 * balcony glass line above the balustrade, and lands in the living room.
 * The balcony doorway has no modelled open leaf, so the camera crosses the
 * transparent glazing plane briefly — the same transition the tour's own
 * steps already make.
 */
export const SHOW_UNIT_FLYTHROUGH: readonly CameraView[] = [
  { id: 'fly-approach', label: 'Approach', position: [60, 80, 42], target: [0, 62, 0], fov: 50 },
  { id: 'fly-facade', label: 'Facade', position: [26, 66, -2], target: [6, 64, -4], fov: 50 },
  { id: 'fly-balcony', label: 'Balcony', position: [5.0, 64.6, -4], target: [-8, 64, 0], fov: 54 },
];

/**
 * A walkable doorway between two rooms of the show unit. Positions are the
 * door openings cut into the flat's partitions in ApartmentGeometry (plus
 * the balcony glass line, which needs no cut) — not one coordinate is
 * authored independently of the plan.
 */
export type TowerDoor = {
  from: TowerRoomId;
  to: TowerRoomId;
  position: [number, number, number];
};

export const SHOW_UNIT_DOORS: readonly TowerDoor[] = [
  { from: 'living', to: 'dining', position: [-9.07, SHOW_UNIT_FLOOR_Y + 1.6, -8.0] },
  { from: 'dining', to: 'bedroom', position: [-13.0, SHOW_UNIT_FLOOR_Y + 1.6, -1.48] },
  { from: 'dining', to: 'kitchen', position: [-16.6, SHOW_UNIT_FLOOR_Y + 1.6, -0.4] },
  { from: 'kitchen', to: 'bathroom', position: [-16.6, SHOW_UNIT_FLOOR_Y + 1.6, 5.2] },
  { from: 'living', to: 'balcony', position: [4, SHOW_UNIT_FLOOR_Y + 1.6, -4] },
];
