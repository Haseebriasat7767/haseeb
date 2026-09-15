'use client';

import { useEffect, useState } from 'react';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { cn } from '@/lib/utils/cn';

/**
 * What a visitor can actually do with the frame in front of them.
 *
 * ## Why this replaced a fixed string
 *
 * The explorer and the tower both showed touch visitors "Drag to look
 * around · Pinch to zoom" in a mode that mounts no `OrbitControls` and, on
 * a coarse pointer, no parallax either — so neither gesture did anything at
 * all. A first-time visitor on a phone was told to do the one thing the
 * page would not respond to, which is worse than saying nothing: they try
 * it, nothing happens, and they conclude the image is a picture.
 *
 * So the hint takes the controls as data and each mode passes its own.
 * Nothing here knows what the controls are; the component that owns the
 * mode does.
 *
 * ## Why it leaves
 *
 * It dismisses on the first real interaction and on a timer, because a hint
 * still on screen after the visitor has worked it out is just something
 * covering the architecture. `CONTROLS` brings it back for anyone who
 * wants it again.
 */

export type ControlPair = {
  /** The input: `Click`, `Drag`, `W A S D`. */
  input: string;
  /** What it does: `Enter a space`. */
  action: string;
};

/** How long the hint holds before fading, in milliseconds. */
const HOLD_MS = 6000;

export function ControlHint({
  controls,
  /** Hidden while something more important is on screen — the tour intro. */
  hidden = false,
}: {
  controls: readonly ControlPair[];
  hidden?: boolean;
}) {
  const coarse = useCoarsePointer();
  const [shown, setShown] = useState(true);
  // Once dismissed, only the CONTROLS button brings it back — the timer and
  // the interaction listeners are not re-armed, or reopening it would close
  // itself again on the visitor's next click.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed || !shown) return;

    const id = window.setTimeout(() => {
      setShown(false);
      setDismissed(true);
    }, HOLD_MS);

    const dismiss = () => {
      setShown(false);
      setDismissed(true);
    };

    // Whichever comes first: a touch, a drag, or a key that means movement.
    window.addEventListener('touchstart', dismiss, { once: true, passive: true });
    window.addEventListener('pointerdown', dismiss, { once: true });
    window.addEventListener('keydown', dismiss, { once: true });

    return () => {
      window.clearTimeout(id);
      window.removeEventListener('touchstart', dismiss);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [dismissed, shown]);

  if (hidden || controls.length === 0) return null;

  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        data-cursor="link"
        className="text-eyebrow ease-luxe border-alabaster/15 bg-obsidian/40 text-stone hover:text-alabaster hover:border-alabaster/40 absolute bottom-6 left-6 z-20 inline-flex min-h-11 items-center border px-3 py-2 uppercase backdrop-blur-sm transition-colors duration-300"
      >
        Controls
      </button>
    );
  }

  return (
    <div
      // Decorative in the sense that every control it names is reachable by
      // other means — the buttons it describes are real, labelled buttons
      // elsewhere in the frame. Announcing it would read a list of key names
      // to somebody who navigates by those labels instead.
      aria-hidden="true"
      className={cn(
        'ease-luxe pointer-events-none absolute bottom-6 left-6 z-20 transition-opacity duration-700',
        'border-alabaster/15 bg-obsidian/40 border px-4 py-3 backdrop-blur-sm',
      )}
    >
      <ul className="flex flex-col gap-1.5">
        {controls.map((control) => (
          <li key={control.input} className="flex items-baseline gap-3">
            <span className="text-eyebrow text-alabaster/90 min-w-[4.5rem] uppercase">
              {control.input}
            </span>
            <span className="text-eyebrow text-stone uppercase">{control.action}</span>
          </li>
        ))}
      </ul>
      {coarse ? null : (
        <p className="text-stone mt-2 text-[0.5rem] tracking-[0.3em] uppercase">Esc to exit</p>
      )}
    </div>
  );
}

export default ControlHint;
