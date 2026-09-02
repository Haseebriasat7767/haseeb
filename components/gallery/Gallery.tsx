'use client';

import { useCallback, useState } from 'react';
import { Reveal } from '@/components/effects/Reveal';
import { TimeOfDayControl } from '@/components/explorer/TimeOfDayControl';
import { DEFAULT_TIME_OF_DAY } from '@/lib/three/lighting';
import { SPACES } from '@/lib/experience/spaces';
import type { TimeOfDay } from '@/types';
import { cn } from '@/lib/utils/cn';
import { GalleryLightbox } from './GalleryLightbox';

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
      <TimeOfDayControl value={timeOfDay} onChange={setTimeOfDay} className="max-w-md" />

      <ul className="border-alabaster/10 bg-alabaster/10 grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
        {SPACES.map((space, index) => (
          <Reveal key={space.id} as="li" delay={index * 40} className="bg-obsidian">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              data-cursor="view"
              className={cn(
                'group ease-luxe flex aspect-[4/3] w-full flex-col items-start p-7 text-left sm:p-8',
                'hover:bg-ink transition-colors duration-500',
              )}
            >
              <span className="text-eyebrow text-stone flex w-full items-center justify-between uppercase">
                <span>{space.eyebrow}</span>
                <span className="text-gold tabular-nums">{String(index + 1).padStart(2, '0')}</span>
              </span>

              <span className="font-display text-alabaster mt-auto text-3xl leading-none font-light">
                {space.name}
              </span>

              <span className="text-mist mt-3 text-sm leading-relaxed">{space.feature}</span>

              <span
                aria-hidden="true"
                className="bg-gold ease-luxe mt-6 h-px w-8 transition-all duration-500 group-hover:w-full"
              />
            </button>
          </Reveal>
        ))}
      </ul>

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
