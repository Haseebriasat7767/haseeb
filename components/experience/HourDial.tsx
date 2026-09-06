'use client';

import { useId } from 'react';
import { HOURS, hourAt, hourIndex, hourLabel, hourTheme } from '@/lib/experience/hour-theme';
import { cn } from '@/lib/utils/cn';
import type { TimeOfDay } from '@/types';

type HourDialProps = {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
};

const LAST = HOURS.length - 1;

/**
 * The hour dial — Aurelia's signature control.
 *
 * A buyer looking at a house wants to know what it is like in the morning
 * and what it is like at night, and that is the one question a photograph
 * cannot answer. So the control is not filed away in a settings strip
 * below the fold: it stands at the edge of the frame, drawn as an
 * architectural scale, and moving it moves the light.
 *
 * The visible parts — track, ticks, diamond, the hour names running down
 * the side — are decoration over a real `input[type=range]`. The input is
 * transparent and sits on top, so every native affordance still works:
 * drag, click-to-jump anywhere on the track, arrow keys, Home and End,
 * touch, and the value announced to a screen reader. The visuals are
 * `pointer-events-none` and read the same state, so the two cannot
 * disagree. A wheel over the control does nothing, which is deliberate —
 * a range input ignores wheel events, and the page keeps scrolling.
 *
 * The vertical form is a horizontal range rotated a quarter turn, rather
 * than `writing-mode: vertical-lr`, because the rotation behaves the same
 * on every browser this site supports and keeps the native key mapping
 * intact: Right and Up move later in the day, Left and Down move earlier,
 * Home returns to morning and End goes to night.
 *
 * The five stops are the five lighting states the renderer actually has.
 * The dial does not blend between them and does not display a clock time,
 * because neither exists in the scene — showing "18:15" would be inventing
 * a precision the model cannot back.
 */
export function HourDial({ value, onChange, orientation = 'vertical', className }: HourDialProps) {
  const id = useId();
  const index = hourIndex(value);
  const theme = hourTheme(value);
  const vertical = orientation === 'vertical';

  // Position along the track, as a percentage. Morning sits at the top of
  // the vertical form and at the left of the horizontal one — the day runs
  // in reading order either way.
  const at = (i: number) => `${(i / LAST) * 100}%`;

  const track = (
    // The hit area. 44px on the cross axis in both forms, which is the
    // touch target; the track itself is one pixel down the middle of it.
    <div className={cn('relative', vertical ? 'h-60 w-11' : 'h-11 w-full')}>
      <input
        id={id}
        type="range"
        min={0}
        max={LAST}
        step={1}
        value={index}
        onChange={(event) => onChange(hourAt(Number(event.target.value)))}
        aria-labelledby={`${id}-legend`}
        aria-valuetext={hourLabel(value)}
        data-cursor="link"
        className={cn(
          'peer absolute z-10 cursor-pointer opacity-0',
          vertical
            ? 'top-1/2 left-1/2 h-11 w-60 -translate-x-1/2 -translate-y-1/2 rotate-90'
            : 'inset-0 h-11 w-full',
        )}
      />

      <span
        aria-hidden="true"
        className={cn(
          'bg-alabaster/15 pointer-events-none absolute',
          vertical
            ? 'top-0 bottom-0 left-1/2 w-px -translate-x-1/2'
            : 'inset-x-0 top-1/2 h-px -translate-y-1/2',
        )}
      />

      {/* The part of the day already passed, drawn in the hour's own accent
          so the track carries a trace of the light. */}
      <span
        aria-hidden="true"
        className={cn(
          'ease-luxe pointer-events-none absolute opacity-70 transition-all duration-700',
          vertical
            ? 'top-0 left-1/2 w-px -translate-x-1/2'
            : 'top-1/2 left-0 h-px -translate-y-1/2',
        )}
        style={{
          background: 'var(--hour-accent)',
          ...(vertical ? { height: at(index) } : { width: at(index) }),
        }}
      />

      {HOURS.map((hour, i) => (
        <span
          key={hour}
          aria-hidden="true"
          className={cn(
            'ease-luxe pointer-events-none absolute transition-opacity duration-500',
            'bg-alabaster/35',
            i === index ? 'opacity-0' : 'opacity-100',
            vertical ? 'left-1/2 h-px w-2 -translate-x-1/2' : 'top-1/2 h-2 w-px -translate-y-1/2',
          )}
          style={vertical ? { top: at(i) } : { left: at(i) }}
        />
      ))}

      {/* The diamond. Focus is drawn here because the real input is
          transparent — without this the control would be operable by
          keyboard with nothing on screen to show it. */}
      <span
        aria-hidden="true"
        className={cn(
          'ease-luxe pointer-events-none absolute h-2.5 w-2.5 rotate-45',
          'transition-[top,left] duration-500',
          'peer-focus-visible:ring-gold peer-focus-visible:ring-1 peer-focus-visible:ring-offset-4',
          'peer-focus-visible:ring-offset-obsidian',
          vertical
            ? 'left-1/2 -translate-x-1/2 -translate-y-1/2'
            : 'top-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
        style={{
          background: 'var(--hour-accent)',
          boxShadow: '0 0 0 3px rgb(10 10 11 / 0.5), 0 0 18px -2px var(--hour-accent)',
          ...(vertical ? { top: at(index) } : { left: at(index) }),
        }}
      />
    </div>
  );

  const legend = (
    <span id={`${id}-legend`} className="text-mist/85 text-[0.5rem] tracking-[0.42em] uppercase">
      Time of day
    </span>
  );

  const current = (
    <span
      aria-hidden="true"
      className="ease-luxe text-[0.5rem] tracking-[0.34em] whitespace-nowrap uppercase transition-colors duration-500"
      style={{ color: 'var(--hour-accent)' }}
    >
      {hourLabel(value)}
    </span>
  );

  if (!vertical) {
    // The compact form. Every hour named would not fit across a phone, so
    // the scale is given by its two ends and the live reading sits beside
    // the legend, where it is read rather than hunted for.
    return (
      <div
        className={cn('pointer-events-auto w-full select-none', className)}
        style={{
          ['--hour-accent' as string]: theme.accent,
          textShadow: '0 1px 4px rgb(0 0 0 / 0.75)',
        }}
      >
        <div className="mb-1 flex items-baseline justify-between gap-4">
          {legend}
          {current}
        </div>
        {track}
        <div className="text-mist/75 -mt-1 flex justify-between text-[0.5rem] tracking-[0.28em] uppercase">
          <span aria-hidden="true">{hourLabel(HOURS[0]!)}</span>
          <span aria-hidden="true">{hourLabel(HOURS[LAST]!)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('pointer-events-auto select-none', className)}
      style={{
        ['--hour-accent' as string]: theme.accent,
        textShadow: '0 1px 4px rgb(0 0 0 / 0.75)',
      }}
    >
      <div className="mb-5">{legend}</div>

      <div className="flex items-stretch gap-3">
        {track}

        {/* The scale. Every supported hour is named, so the range of the
            control is legible at a glance and needs no instruction; the
            current one is lit. */}
        <div className="pointer-events-none relative w-[5.5rem]">
          {HOURS.map((hour, i) => {
            const isCurrent = i === index;

            return (
              <span
                key={hour}
                aria-hidden="true"
                className={cn(
                  'ease-luxe absolute left-0 -translate-y-1/2 text-[0.5rem] whitespace-nowrap uppercase',
                  'transition-all duration-500',
                  isCurrent
                    ? 'tracking-[0.34em] opacity-100'
                    : 'text-mist tracking-[0.28em] opacity-70',
                )}
                style={{ top: at(i), color: isCurrent ? 'var(--hour-accent)' : undefined }}
              >
                {hourLabel(hour)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HourDial;
