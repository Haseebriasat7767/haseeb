import type { CameraView } from '@/types';
import { findSpace } from './spaces';

/**
 * One movement of the scroll narrative: a framing of the residence and the
 * copy that belongs with it. The camera is not decoration here — each
 * section is written for the view it is seen from.
 */
export type JourneyChapter = {
  id: string;
  /** Two-digit index shown in the margin. */
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  view: CameraView;
  /** Optional space this chapter hands off to in the explorer. */
  space?: string;
};

function chapterView(spaceId: string): CameraView {
  const space = findSpace(spaceId);
  if (!space) throw new Error(`Unknown space in journey: ${spaceId}`);
  return space.view;
}

/**
 * The eight movements of the journey. Deliberately a fixed sequence rather
 * than a free camera: the residence has an order it should be read in, and
 * the scroll position is the only thing driving it.
 */
export const JOURNEY: readonly JourneyChapter[] = [
  {
    id: 'exterior',
    index: '01',
    eyebrow: 'The Residence',
    title: 'Where architecture meets timeless living.',
    body: 'A private house on a coastal ridge, composed from stone, cast concrete, and glass — and rendered here in real time, entirely from code.',
    view: chapterView('arrival'),
    space: 'arrival',
  },
  {
    id: 'architecture',
    index: '02',
    eyebrow: 'Architecture',
    title: 'Two stone wings, and the light between them.',
    body: 'The plan is a rear service bar with two wings pushed forward from it. The glazed living volume sits in the gap they leave, and the upper floor cantilevers four metres past the building line above the terrace.',
    view: {
      id: 'architecture',
      label: 'Elevation',
      position: [58, 9, 8],
      target: [0, 4.5, 0],
      fov: 26,
    },
  },
  {
    id: 'living',
    index: '03',
    eyebrow: 'Living',
    title: 'A single level, from the hearth to the water.',
    body: 'The living floor runs out through a full-width sliding wall onto the terrace without a step, and the terrace runs on to the pool deck. Inside and outside are one continuous plane.',
    view: chapterView('terrace'),
    space: 'terrace',
  },
  {
    id: 'interior',
    index: '04',
    eyebrow: 'Interior',
    title: 'Rooms built from the same drawing as the walls.',
    body: 'Twenty-one rooms across two storeys, every one of them resolved from the building’s own plan lines — the partitions, the joinery, and the furniture all derive from the structure that contains them.',
    view: chapterView('living'),
    space: 'living',
  },
  {
    id: 'amenities',
    index: '05',
    eyebrow: 'Amenities',
    title: 'Water held at the edge of the ridge.',
    body: 'The infinity pool sits below the terrace with its far wall dropped to a weir. A sunken lounge is cut into the deck beside it, and the planting screens both from the approach.',
    view: chapterView('pool'),
    space: 'pool',
  },
  {
    id: 'plan',
    index: '06',
    eyebrow: 'Spatial',
    title: 'Read the residence as a plan.',
    body: 'Seen from above, the composition resolves: the rear bar holding the service rooms, the wings framing the void, and the cantilever reaching out over the water.',
    view: {
      id: 'plan',
      label: 'Aerial',
      position: [30, 44, 42],
      target: [0, 2, 0],
      fov: 34,
    },
  },
  {
    id: 'location',
    index: '07',
    eyebrow: 'Setting',
    title: 'Oriented for one uninterrupted view.',
    body: 'Every principal room faces the same way. The service rooms take the rear elevation, the circulation takes the middle, and the whole west end of the upper floor is given to a single suite.',
    view: chapterView('master'),
    space: 'master',
  },
  {
    id: 'enquire',
    index: '08',
    eyebrow: 'Enquire',
    title: 'The residence, seen whole.',
    body: 'Everything above is one continuous model, generated in real time. Continue into the explorer to move through it space by space, or arrange to see it in person.',
    view: {
      id: 'enquire',
      label: 'Front',
      position: [0, 9, 58],
      target: [0, 4.5, 0],
      fov: 28,
    },
  },
] as const;
