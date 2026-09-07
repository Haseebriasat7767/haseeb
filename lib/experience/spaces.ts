import type { CameraView } from '@/types';

/**
 * A named place in the residence. One record serves every system that
 * needs to talk about a space: the scroll journey, the 3D hotspots, the
 * space rail, the floor plans, and the gallery. Adding a space here adds it
 * everywhere, which is why none of those components carry a list of their
 * own.
 */
export type Space = {
  id: string;
  name: string;
  /** Small label above the name — where the space sits in the residence. */
  eyebrow: string;
  description: string;
  /** The single thing worth knowing about this space. */
  feature: string;
  view: CameraView;
  /** Which level the space belongs to, for the floor plans. */
  level: 'site' | 'ground' | 'upper';
  /**
   * Room in the generated interior plan this space corresponds to, when it
   * is a room. Used by the floor plans to highlight the right outline.
   */
  room?: string;
  /**
   * Where this space's 3D marker sits. Only spaces that actually read from
   * outside the building carry one — a marker floating over the roof to
   * indicate a rear service room would be a diagram, not architecture. The
   * world position itself is resolved from the real geometry in
   * `components/three/hotspots/anchors.ts`, never restated here.
   */
  anchor?: AnchorKey;
};

/** The exterior positions a hotspot can be pinned to. */
export type AnchorKey =
  | 'approach'
  | 'entrance'
  | 'livingGlass'
  | 'terrace'
  | 'cantilever'
  | 'roofTerrace'
  | 'pool'
  | 'lounge';

/** A framing, written once so the journey and the rail cannot disagree. */
function view(
  id: string,
  label: string,
  position: CameraView['position'],
  target: CameraView['target'],
  fov: number,
  /** Exposure compensation in stops — see `CameraView`. */
  exposure?: number,
): CameraView {
  return exposure === undefined
    ? { id, label, position, target, fov }
    : { id, label, position, target, fov, exposure };
}

/**
 * Every framing inside the house opens up by the same amount, matching
 * `INTERIOR_EXPOSURE` in `lib/three/scene-config.ts`. Duplicated as a value
 * rather than imported because that module pulls in the villa's geometry
 * constants, and the journey has no business depending on those.
 */
const INSIDE = 1.05;

export const SPACES: readonly Space[] = [
  {
    id: 'arrival',
    name: 'Arrival',
    eyebrow: 'Approach',
    description:
      'The drive arrives obliquely, so the residence is never seen head-on until you are standing on it. Stepping slabs cross the grade to a recessed entrance held between two full-height blades.',
    feature: 'Two-storey entrance slot, roofed in glass',
    view: view('arrival', 'Arrival', [21, 3.8, 27], [-4, 4.9, 0], 46),
    level: 'site',
    anchor: 'approach',
  },
  {
    id: 'foyer',
    name: 'Entrance foyer',
    eyebrow: 'Ground level',
    description:
      'A double-height slot cut through both storeys and closed at the top by a glazed laylight. The stair hall opens off it to the north; the principal rooms open east.',
    feature: 'Daylit through a roof-level laylight',
    view: view('foyer', 'Foyer', [-6, 2.6, 2.7], [-6.2, 2.1, -3.4], 58, INSIDE),
    level: 'ground',
    room: 'foyer',
    anchor: 'entrance',
  },
  {
    id: 'living',
    name: 'Living room',
    eyebrow: 'Ground level',
    description:
      'The glazed volume between the two stone wings, opening onto the terrace through a full-width sliding wall. A stone chimney breast anchors the back wall.',
    feature: 'Full-width sliding glazing to the terrace',
    // Re-framed in Phase 7F. The old camera stood against the east glazing
    // and looked away from it into the room's back wall, so the one thing
    // that makes this room worth photographing — a full-height glazed corner
    // onto the terrace — was behind the lens. It now looks across the
    // seating toward the glass, which also gives the frame a real
    // foreground, midground and background.
    view: view('living', 'Living room', [2.95, 2.6, -3.6], [9.6, 1.45, 3.6], 54, INSIDE),
    level: 'ground',
    room: 'living',
    anchor: 'livingGlass',
  },
  {
    id: 'dining',
    name: 'Dining',
    eyebrow: 'Ground level',
    description:
      'Set between the foyer and the living room, with the kitchen opening directly behind it. A row of pendants marks the table axis.',
    feature: 'Open to both the kitchen and the terrace',
    view: view('dining', 'Dining', [-3.4, 2.3, 3.4], [0.4, 1.8, -3.6], 56, INSIDE),
    level: 'ground',
    room: 'dining',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    eyebrow: 'Ground level',
    description:
      'A working island parallel to a full run of cabinetry along the north wall, with the pantry and utility rooms continuing east behind it.',
    feature: 'Four-metre island with integrated seating',
    view: view('kitchen', 'Kitchen', [-3.4, 2.3, 1.6], [1.4, 1.6, -7.4], 58, INSIDE),
    level: 'ground',
    room: 'kitchen',
  },
  {
    id: 'study',
    name: 'Study',
    eyebrow: 'Ground level',
    description:
      'The west end of the ground floor, running the full depth of the wing. Set apart from the arrival sequence, so it can be worked in while the house is in use.',
    feature: 'The full depth of the west wing, to itself',
    view: view('study', 'Study', [-13.6, 2.4, -2.4], [-9.4, 1.7, 4.2], 55, INSIDE),
    level: 'ground',
    room: 'study',
  },
  {
    id: 'guest',
    name: 'Guest suite',
    eyebrow: 'Ground level',
    description:
      'Set into the rear service band with its own bathroom beside it, entered off the stair hall rather than through the principal rooms.',
    feature: 'Self-contained, with its own bathroom',
    view: view('guest', 'Guest suite', [-11.3, 2.4, -5.2], [-14.2, 1.6, -10.2], 58, INSIDE),
    level: 'ground',
    room: 'guestBedroom',
  },
  {
    id: 'stair',
    name: 'Stair hall',
    eyebrow: 'Circulation',
    description:
      'A dog-leg stair in two equal flights around a half-landing, rising through a void cut in the floor plate above and arriving on the upper landing.',
    feature: 'Open stairwell with frameless glass guarding',
    view: view('stair', 'Stair hall', [-6.0, 2.3, -1.4], [-6.4, 3.4, -8.4], 58, INSIDE),
    level: 'ground',
    room: 'stairHall',
  },
  {
    id: 'upperLounge',
    name: 'Upper lounge',
    eyebrow: 'Upper level',
    description:
      'The landing widens into a sitting room at the front of the upper floor, between the bedrooms and the library.',
    feature: 'Front-facing, between the bedrooms and the library',
    view: view('upperLounge', 'Upper lounge', [-3.2, 6.65, -2.8], [2.4, 5.9, 3.3], 54, INSIDE),
    level: 'upper',
    room: 'upperLounge',
  },
  {
    id: 'master',
    name: 'Master suite',
    eyebrow: 'Upper level',
    description:
      'The whole west end of the upper floor: bedroom facing the roof terrace, with the bathroom and dressing room behind it across a single partition.',
    feature: 'Private roof terrace through a sliding wall',
    view: view('master', 'Master suite', [-8.4, 6.8, -0.8], [-12.6, 6.1, -5.2], 56, INSIDE),
    level: 'upper',
    room: 'masterBedroom',
    anchor: 'roofTerrace',
  },
  {
    id: 'dressing',
    name: 'Dressing room',
    eyebrow: 'Upper level',
    description:
      'Between the master bedroom and its bathroom: a full-height run of timber joinery down one wall, with an island facing it.',
    feature: 'A wall of joinery, and an island',
    view: view('dressing', 'Dressing room', [-8.25, 6.8, -6.35], [-10.9, 5.9, -10.3], 66, INSIDE),
    level: 'upper',
    room: 'dressing',
  },
  {
    id: 'masterBath',
    name: 'Master bathroom',
    eyebrow: 'Upper level',
    description:
      'The west corner of the upper floor, taken as one room: a freestanding bath, a double vanity, and a separate shower.',
    feature: 'Freestanding bath in the west corner',
    view: view(
      'masterBath',
      'Master bathroom',
      [-11.9, 6.6, -6.5],
      [-14.2, 5.85, -10.2],
      60,
      INSIDE,
    ),
    level: 'upper',
    room: 'masterBath',
  },
  {
    id: 'bedroom2',
    name: 'Second bedroom',
    eyebrow: 'Upper level',
    description:
      'The larger of the two bedrooms along the rear of the upper floor, with its own bathroom next door and a window to the sea.',
    feature: 'Its own bathroom, and a sea window',
    view: view('bedroom2', 'Second bedroom', [2.1, 6.55, -6.9], [-3.5, 5.8, -10.2], 56, INSIDE),
    level: 'upper',
    room: 'bedroom2',
  },
  {
    id: 'library',
    name: 'Library',
    eyebrow: 'Upper level',
    description:
      'Inside the cantilever, projecting four metres past the building line over the terrace. Glazed on two sides, with a double-sided bookcase dividing it from the upper hall.',
    feature: 'Cantilevered over the terrace on two glazed sides',
    view: view('library', 'Library', [13.8, 6.6, 7.2], [5.2, 5.9, -3.2], 56, INSIDE),
    level: 'upper',
    room: 'library',
    anchor: 'cantilever',
  },
  {
    id: 'terrace',
    name: 'Terrace',
    eyebrow: 'Site',
    description:
      'The paved plinth the residence stands on, running the full width of the building and stepping down to the pool deck beyond.',
    feature: 'Continuous with the living floor at a single level',
    view: view('terrace', 'Terrace', [15, 4.2, 19], [1, 3.2, 5], 44),
    level: 'site',
    anchor: 'terrace',
  },
  {
    id: 'pool',
    name: 'Pool',
    eyebrow: 'Site',
    description:
      'An infinity pool set below the terrace, its far wall dropped to a weir so the water runs to the edge rather than being held behind a parapet.',
    feature: 'Infinity edge with a submerged perimeter light',
    view: view('pool', 'Pool', [11.5, 2.1, 29], [0, 3.2, 11], 46),
    level: 'site',
    anchor: 'pool',
  },
  {
    id: 'lounge',
    name: 'Sunken lounge',
    eyebrow: 'Site',
    description:
      'A seating court dropped below the deck beside the pool, sheltered by its own retaining walls and lit from a cove cut into them.',
    feature: 'Dropped below the deck for shelter',
    view: view('lounge', 'Sunken lounge', [-2, 3.2, 30], [-1, 1.2, 19], 48),
    level: 'site',
    anchor: 'lounge',
  },
] as const;

/**
 * What the canvas needs in order to mount the markers. Passed as data
 * rather than as rendered nodes, so a page can ask for hotspots without
 * importing anything from three.
 */
export type HotspotConfig = {
  activeId: string | null;
  onSelect: (space: Space) => void;
};

export function findSpace(id: string): Space | undefined {
  return SPACES.find((space) => space.id === id);
}

/** Spaces that carry a 3D marker on the model. */
export const HOTSPOT_SPACES: readonly Space[] = SPACES.filter(
  (space) => space.anchor !== undefined,
);

/** Spaces grouped for the floor plans, which only draw enclosed rooms. */
export const ROOM_SPACES: readonly Space[] = SPACES.filter((space) => space.room !== undefined);
