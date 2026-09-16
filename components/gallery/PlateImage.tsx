import Image from 'next/image';
import { plateFor, type PlateBuilding } from '@/lib/experience/plates';
import { cn } from '@/lib/utils/cn';

/**
 * The rendered plate behind a gallery tile.
 *
 * ## Why a tile has one now
 *
 * It did not, on purpose: there was nothing to put there, and this gallery
 * would rather show a typographic device than a fake preview. That reason
 * expires the moment real plates exist, and a dark card next to a finished
 * render is the thing that now reads as broken.
 *
 * ## What it does when there is no plate
 *
 * Returns `null`, and the tile keeps the oversized initial it already had.
 * Spaces gain plates a few at a time, so a half-covered gallery is the
 * normal state for a while — it has to look deliberate rather than like a
 * page with images missing. The initial is still a real device; it simply
 * sits under a photograph wherever one has arrived.
 */
export function PlateImage({
  building,
  space,
  /** Tiles are small and there are eighteen; the lightbox gets the full file. */
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  className,
  priority = false,
}: {
  /** Which building's framing list `space` names — the two overlap. */
  building: PlateBuilding;
  space: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const plate = plateFor(building, space);
  if (!plate) return null;

  return (
    <>
      <Image
        src={plate.src}
        // Decorative: the tile states the room's name and its feature in
        // real text directly beside this, so describing the picture again
        // would read the same room twice to a screen reader.
        alt=""
        width={plate.width}
        height={plate.height}
        sizes={sizes}
        priority={priority}
        className={cn(
          'ease-luxe absolute inset-0 h-full w-full object-cover',
          // Shown, not hinted at. An earlier pass held these at 55% under a
          // full-bleed scrim and the renders all but disappeared — which
          // defeats the only reason the tile has one. The plate carries the
          // tile; the gradient below does the work of keeping type legible.
          'transition-transform duration-700 group-hover:scale-[1.03]',
          className,
        )}
      />
      {/* The ground the caption sits on — bottom-weighted, so it darkens the
          band the type occupies and leaves the architecture above it alone.
          Without any scrim the lower type falls on whatever the render puts
          there, which on a bright exterior plate is white sky. */}
      <span
        aria-hidden="true"
        className="from-obsidian/95 via-obsidian/55 pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t to-transparent"
      />
      {/* A light hold over the whole plate: enough for the eyebrow and the
          index in the top corners, not enough to mute the image. */}
      <span
        aria-hidden="true"
        className="from-obsidian/70 pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b to-transparent"
      />
    </>
  );
}

export default PlateImage;
