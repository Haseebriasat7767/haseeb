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
      <div className="border-alabaster/10 bg-obsidian/60 flex gap-px overflow-x-auto border backdrop-blur-sm">
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
                'ease-luxe flex-1 px-3 py-2.5 font-sans text-[0.625rem] tracking-[0.2em] uppercase',
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
