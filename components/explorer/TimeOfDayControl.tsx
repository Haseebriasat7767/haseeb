'use client';

import { TIME_OF_DAY, TIME_OF_DAY_ORDER } from '@/lib/three/lighting';
import { cn } from '@/lib/utils/cn';
import type { TimeOfDay } from '@/types';

type TimeOfDayControlProps = {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  className?: string;
};

/**
 * The hour control. Deterministic and instant: picking an hour swaps a
 * lighting state, it does not animate a sun across the sky, so there is
 * nothing here for reduced motion to suppress.
 */
export function TimeOfDayControl({ value, onChange, className }: TimeOfDayControlProps) {
  return (
    // `min-w-0` is load-bearing: a fieldset's default `min-width:
    // min-content` overrides flex shrinking, so without it the scroll
    // container below never engages and the control widens the page.
    <fieldset className={cn('flex min-w-0 flex-col gap-3', className)}>
      <legend className="text-eyebrow text-stone mb-3 uppercase">Hour</legend>
      {/*
        Wraps rather than scrolls on a phone.
        
        Five labels with `whitespace-nowrap` need about 424 pixels, and a
        390-pixel viewport leaves roughly 350 after the gutters — so the
        strip overflowed and the container scrolled it. Functionally the
        fifth hour was still reachable; visually it was not there. The last
        item still on screen ended flush against the container's right
        border, which gives a viewer no reason to suspect the control
        scrolls at all, so a phone visitor simply saw four hours and
        concluded the residence had four. Night is the state this property
        arguably shows best, and it was the one that fell off.
        
        Wrapping to a second row puts all five on screen with no hidden
        affordance to discover. `overflow-x-auto` is kept as the safety net
        it always was: once the rows wrap there is nothing left to scroll,
        and it still catches any width narrower than a single button.
      */}
      <div className="border-alabaster/10 bg-obsidian/60 flex flex-wrap gap-px overflow-x-auto border backdrop-blur-sm sm:flex-nowrap">
        {TIME_OF_DAY_ORDER.map((id) => {
          const active = id === value;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={active}
              data-cursor="link"
              className={cn(
                // A basis narrow enough that three fit on the first row and
                // `flex-1` then grows them to fill it, so neither row ends
                // with a dead cell. Cleared at `sm`, where all five fit.
                'ease-luxe flex-1 basis-[5.5rem] px-3 py-2.5 sm:basis-auto',
                'font-sans text-[0.625rem] tracking-[0.2em] uppercase',
                'whitespace-nowrap transition-colors duration-300',
                active ? 'bg-alabaster text-obsidian' : 'text-mist hover:text-alabaster',
              )}
            >
              {TIME_OF_DAY[id].label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
