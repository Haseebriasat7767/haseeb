/**
 * The finishes the residence is actually built from. Every entry below
 * corresponds to a material in `lib/three/materials.ts` that the model
 * renders with — this is a schedule of what you are looking at, not a
 * mood board written to fill a page.
 */
export type Finish = {
  name: string;
  where: string;
  note: string;
};

export const PALETTE: readonly Finish[] = [
  {
    name: 'Honed limestone',
    where: 'Plinth, terrace, pool coping, interior floors',
    note: 'Warm off-white, quarried in large format and laid without a border.',
  },
  {
    name: 'Fair-faced concrete',
    where: 'Structural frame, soffits, parapets',
    note: 'Cast in place and left as struck; the formwork grain is the finish.',
  },
  {
    name: 'Dark timber',
    where: 'Entrance leaf, joinery, bedroom floors',
    note: 'Vertical grain on the pivot door, running its full height.',
  },
  {
    name: 'Bronze',
    where: 'Hardware, rails, lighting fixtures',
    note: 'Satin rather than polished, so it reads as weight and not as trim.',
  },
  {
    name: 'Architectural glazing',
    where: 'Living wall, cantilever, foyer laylight',
    note: 'Slim frames set deep in the reveal, so the glass sits in shadow.',
  },
  {
    name: 'Book-matched marble',
    where: 'Island, vanities, fireplace surround',
    note: 'Veining drawn across each slab rather than repeated between them.',
  },
] as const;
