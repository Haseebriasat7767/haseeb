'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Reveal } from '@/components/effects/Reveal';
import { HourDial } from '@/components/experience/HourDial';
import { FinalExperienceCTA } from '@/components/property/FinalExperienceCTA';
import { DEFAULT_TIME_OF_DAY } from '@/lib/three/lighting';
import { SPACES } from '@/lib/experience/spaces';
import type { TimeOfDay } from '@/types';
import { cn } from '@/lib/utils/cn';
import { GalleryLightbox } from './GalleryLightbox';
import { PlateImage } from './PlateImage';

/**
 * The gallery index. Each entry is a framing of the residence rather than a
 * photograph: opening one renders it live at that camera, under whichever
 * hour is selected. Nothing here is a stock image, and nothing is
 * pre-rendered.
 */
export function Gallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(DEFAULT_TIME_OF_DAY);

  const total = SPACES.length;
  const close = useCallback(() => setOpenIndex(null), []);
  const previous = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current - 1 + total) % total)),
    [total],
  );
  const next = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current + 1) % total)),
    [total],
  );

  return (
    <div className="flex flex-col gap-12">
      <HourDial
        value={timeOfDay}
        onChange={setTimeOfDay}
        orientation="horizontal"
        className="max-w-md"
      />

      <ul className="border-alabaster/10 bg-alabaster/10 grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
        {SPACES.map((space, index) => (
          <Reveal key={space.id} as="li" delay={index * 40} className="bg-obsidian">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              data-cursor="view"
              // Read by `scripts/brochure-stills.mjs`, which opens the
              // cinematic lightbox for a given space by clicking its tile
              // rather than driving React state directly.
              data-space={space.id}
              className={cn(
                'group ease-luxe relative flex aspect-[4/3] w-full flex-col items-start overflow-hidden p-7 text-left sm:p-8',
                'hover:bg-ink transition-colors duration-500',
              )}
            >
              {/* The plate, where one has been rendered. `PlateImage`
                  returns nothing for a space that has none, so the tile
                  falls back to the device below — plates arrive a few at a
                  time and a half-covered grid has to read as deliberate.
                  The first two are eager: they are above the fold on every
                  width and a gallery that greys in under the cursor is the
                  opposite of the impression this page exists to make. */}
              <PlateImage space={space.id} priority={index < 2} />

              {/* The device under the plate, and the whole tile without one:
                  the space's own initial, oversized and faint, angled by its
                  position so eighteen dark cards don't read as one cell
                  repeated. Nothing here claims to be a photograph — the
                  standfirst above says what these are.
              */}
              <span
                aria-hidden="true"
                className="text-alabaster/[0.05] font-display pointer-events-none absolute -top-6 -right-2 text-[9rem] leading-none font-semibold select-none"
                style={{ transform: `rotate(${((index * 37) % 11) - 5}deg)` }}
              >
                {space.name.charAt(0)}
              </span>

              <span className="text-eyebrow text-stone relative flex w-full items-center justify-between uppercase">
                <span>{space.eyebrow}</span>
                <span className="text-gold tabular-nums">{String(index + 1).padStart(2, '0')}</span>
              </span>

              <span className="font-display text-alabaster relative mt-auto text-3xl leading-none font-semibold">
                {space.name}
              </span>

              <span className="text-mist relative mt-3 text-sm leading-relaxed">
                {space.feature}
              </span>

              <span
                aria-hidden="true"
                className="bg-gold ease-luxe relative mt-6 h-px w-8 transition-all duration-500 group-hover:w-full"
              />
            </button>
          </Reveal>
        ))}
        {/*
          The cell that closes the grid.

          Seventeen framings in a grid of two or three columns leave a
          ragged last row, and a gap in a hairline grid is not neutral — it
          shows as a pale block where the page ran out of things to say.
          Eighteen divides by both, so this cell squares the grid at either
          width. Filling it with the one thing a visitor who has just looked
          through every room might want next costs nothing and reads as
          composition rather than as a patch.
        */}
        <Reveal as="li" delay={SPACES.length * 40} className="bg-obsidian">
          <Link
            href="/contact"
            data-cursor="link"
            className={cn(
              'group ease-luxe flex aspect-[4/3] w-full flex-col items-start p-7 text-left sm:p-8',
              'hover:bg-ink transition-colors duration-500',
            )}
          >
            <span className="text-eyebrow text-stone uppercase">By appointment</span>
            <span className="font-display text-alabaster mt-auto text-3xl leading-none font-semibold">
              See it in person
            </span>
            <span className="text-mist mt-3 text-sm leading-relaxed">
              Request a private viewing of the residence.
            </span>
            <span
              aria-hidden="true"
              className="bg-gold ease-luxe mt-6 h-px w-8 transition-all duration-500 group-hover:w-full"
            />
          </Link>
        </Reveal>
      </ul>

      <FinalExperienceCTA />

      <GalleryLightbox
        space={openIndex === null ? null : (SPACES[openIndex] ?? null)}
        index={openIndex ?? 0}
        total={total}
        timeOfDay={timeOfDay}
        onClose={close}
        onPrevious={previous}
        onNext={next}
      />
    </div>
  );
}

export default Gallery;
