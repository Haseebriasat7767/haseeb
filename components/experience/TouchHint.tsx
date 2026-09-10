'use client';

import { useEffect, useState } from 'react';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { cn } from '@/lib/utils/cn';

/** How long the hint stays before fading, in milliseconds. */
const HOLD_MS = 5000;

/**
 * Tells a touch visitor the frame is theirs to move.
 *
 * On a desktop the cursor changing over the canvas is enough of a signal.
 * On a phone there is no cursor and no hover, so a visitor who is not told
 * the image responds to a drag will read it as a picture and scroll past
 * the most expensive thing on the page.
 *
 * It dismisses itself, and on the first touch — a hint still on screen
 * after the visitor has already worked it out is just something in the way.
 */
export function TouchHint({ label }: { label: string }) {
  const coarse = useCoarsePointer();
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (!coarse) return;
    const id = window.setTimeout(() => setShown(false), HOLD_MS);
    const dismiss = () => setShown(false);
    window.addEventListener('touchstart', dismiss, { once: true, passive: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('touchstart', dismiss);
    };
  }, [coarse]);

  if (!coarse) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'text-eyebrow text-mist/80 bg-obsidian/50 pointer-events-none absolute bottom-6 left-1/2',
        'z-20 -translate-x-1/2 rounded-sm px-4 py-2.5 text-center uppercase backdrop-blur-sm',
        'ease-luxe transition-opacity duration-700',
        shown ? 'opacity-100' : 'opacity-0',
      )}
    >
      {label}
    </div>
  );
}

export default TouchHint;
