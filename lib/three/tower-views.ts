import type { CameraView } from '@/types';

/**
 * Interior framings open up by the same stop the residence's do, and for
 * the same reason: a camera is set for its subject. Standing in a lit
 * atrium or an apartment with a wall of glass, the room wants exposing for
 * and the view wants blowing out — which is what an interior photograph
 * actually looks like.
 */
const INTERIOR_EXPOSURE = 1.05;

/**
 * The walkthrough, in the order a visitor would actually move through the
 * building: off the plaza, in under the colonnade, up through the retail
 * atrium, out onto the amenity deck, into an apartment on the twelfth
 * residential floor, onto its balcony, and then two framings that step back
 * and look at the whole thing from the water.
 *
 * Every position is a standing eye height where a person could stand, and
 * every one is derived from the geometry in `TowerGeometry` rather than
 * guessed — the deck really is at twenty-five metres, the apartment floor
 * really is at sixty-two, and the balcony camera really is outside the
 * glass line and inside the balustrade.
 */
export const TOWER_VIEWS: readonly CameraView[] = [
  {
    id: 'arrival',
    label: 'Arrival',
    // Across the plaza at standing height. Far enough back that all eighty
    // metres sits inside the frame — a tower shot from its own doorstep is
    // a photograph of a podium.
    position: [-118, 1.8, 62],
    target: [-10, 34, 6],
    fov: 52,
  },
  {
    id: 'colonnade',
    label: 'Colonnade',
    // Under the soffit at the ocean entrance, with the sea behind you.
    position: [34.5, 1.7, 7],
    target: [26, 3.4, -4],
    fov: 60,
  },
  {
    id: 'atrium',
    label: 'Atrium',
    // Standing in the void on the ground floor, looking up five levels to
    // the roof light.
    position: [19, 1.7, -10],
    target: [15.5, 19, -13.5],
    fov: 62,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'gallery',
    label: 'Upper gallery',
    // Third retail level, standing on the plate at the balustrade — not, as
    // the first cut had it, hovering in the middle of the void.
    position: [6.5, 11.7, -12],
    target: [22, 5.5, -13],
    fov: 62,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'deck',
    label: 'Pool deck',
    // On the podium roof beside the pool, facing the water.
    position: [11, 27.4, 15],
    target: [44, 27.2, 7],
    fov: 56,
  },
  {
    id: 'residence',
    label: 'Residence',
    // Twelfth residential floor, inside the glass, looking out over the
    // balcony to the sea.
    // Aimed a shade above the horizon, not below it. Pitched down, a room
    // with a thirty-metre floor plate and a wall of glass at the end of it
    // shows almost nothing but its own floor.
    position: [-9, 64.6, -4.5],
    target: [6, 64.9, -1],
    fov: 60,
    exposure: INTERIOR_EXPOSURE,
  },
  {
    id: 'balcony',
    label: 'Balcony',
    // Outside the glass line, inside the balustrade, turned toward the sun.
    position: [5.0, 64.1, -4],
    target: [40, 64.8, 12],
    fov: 54,
  },
  {
    id: 'elevation',
    label: 'From the water',
    // Far enough out that the whole eighty metres sits inside the frame.
    position: [130, 4, 46],
    target: [-6, 36, 0],
    fov: 40,
  },
  {
    id: 'aerial',
    label: 'The site',
    position: [120, 96, 110],
    target: [0, 30, 0],
    fov: 38,
  },
] as const;

export const DEFAULT_TOWER_VIEW: CameraView = TOWER_VIEWS[0]!;

/** Short captions for the walkthrough chrome, keyed by view id. */
export const TOWER_VIEW_NOTES: Record<string, string> = {
  arrival:
    'Twenty storeys on a five-storey retail base. The podium carries the horizontal banding; the tower above it is glass, bronze fins and a balcony on every floor.',
  colonnade:
    'The ocean entrance, under a deep soffit carried on stone columns — the point where the beach hands you over to the building.',
  atrium:
    'The void runs the full five retail levels to a roof light set into the pool deck above. Lit coves at every floor edge do most of the work after dark.',
  gallery:
    'Third retail level. Frameless glass at the balustrade with a bronze capping rail — the same detail the apartment balconies use, because it is the same condition.',
  deck: 'The amenity deck occupies the whole ocean half of the podium roof, twenty-five metres up, with the pool set back from the edge so a swimmer faces the water.',
  residence:
    'A residence on the twelfth floor. Floor-to-ceiling glazing the full width of the ocean elevation, with the balcony beyond it.',
  balcony:
    'Two and a half metres of balcony, frameless glass, and the sun going down over the water. This is the view the upper floors are sold on.',
  elevation:
    'The ocean elevation from the water. The banding on the podium and the slab lines on the tower are the same idea at two different scales.',
  aerial: 'The whole site — plaza, podium, tower, deck, boardwalk and beach.',
};
