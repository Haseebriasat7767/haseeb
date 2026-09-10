'use client';

import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SITE } from '@/lib/constants/site';
import { cn } from '@/lib/utils/cn';

/**
 * What the visitor reads while the scene loads.
 *
 * Phrased as the building opening rather than as a machine working. They
 * cycle on a timer, but the timer only drives the WORDS — the bar underneath
 * is real. That distinction matters: a fake progress bar that fills smoothly
 * and then waits at 100% is the single most common lie in a loading screen,
 * and a visitor who has seen one stops trusting the next.
 */
const PHRASES = ['Preparing the view', 'Adjusting the light', 'Opening the doors'] as const;

/** How long each phrase holds, in milliseconds. */
const PHRASE_MS = 2200;

type LoadingScreenProps = {
  /** Hide once the scene reports ready — never on a timer. */
  visible: boolean;
  className?: string;
};

/**
 * The branded loading state.
 *
 * Progress comes from three's own `LoadingManager` through drei's
 * `useProgress`, so the bar tracks real textures and models: every glTF,
 * every surface map, every foliage atlas. Nothing here is a simulated
 * timer, and the screen dismisses when the scene reports ready rather than
 * when a countdown ends.
 */
export function LoadingScreen({ visible, className }: LoadingScreenProps) {
  const { progress, item } = useProgress();
  const reducedMotion = useReducedMotion();
  const percent = Math.min(100, Math.round(progress));
  const [phrase, setPhrase] = useState(0);

  // Stops when the screen is hidden: an interval left running behind a
  // dismissed overlay wakes the main thread for nothing on every tick.
  useEffect(() => {
    if (!visible || reducedMotion) return;
    const id = window.setInterval(() => setPhrase((n) => (n + 1) % PHRASES.length), PHRASE_MS);
    return () => window.clearInterval(id);
  }, [visible, reducedMotion]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      hidden={!visible}
      className={cn(
        'bg-obsidian absolute inset-0 z-20 flex flex-col items-center justify-center gap-10 px-6',
        'ease-luxe transition-opacity duration-700',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="font-display text-alabaster text-3xl tracking-[0.5em] sm:text-4xl">
          {SITE.name}
        </span>

        {/* The hairline under the wordmark. It draws itself as the scene
            loads, so the mark and the measure are the same gesture. */}
        <span aria-hidden="true" className="bg-alabaster/15 relative h-px w-40 sm:w-52">
          <span
            className="bg-gold ease-luxe absolute inset-y-0 left-0 transition-[width] duration-700"
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        {/* Cross-faded rather than swapped: text that pops between strings
            reads as a glitch, and this screen is the first thing a visitor
            sees. Both lines are stacked so the block never changes height. */}
        <span aria-hidden="true" className="relative block h-4 w-64 text-center sm:w-72">
          {PHRASES.map((text, index) => (
            <span
              key={text}
              className={cn(
                'text-eyebrow text-stone ease-luxe absolute inset-0 uppercase',
                'transition-opacity duration-700',
                index === phrase ? 'opacity-100' : 'opacity-0',
              )}
            >
              {text}
            </span>
          ))}
        </span>

        <span className="text-stone text-[0.625rem] tracking-[0.28em] tabular-nums">
          {percent}%
        </span>
      </div>

      {/* The only part a screen reader gets: the visual cycle above is
          decorative, and announcing three rotating phrases would talk over
          the percentage that actually carries the information. */}
      <span className="sr-only">
        {item ? `Loading ${item}, ${percent}% complete` : `Preparing the experience, ${percent}%`}
      </span>
    </div>
  );
}

export default LoadingScreen;
