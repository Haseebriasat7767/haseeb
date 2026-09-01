'use client';

import { useEffect } from 'react';

/** Locks body scroll while an overlay (e.g. the mobile menu) is open. */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [locked]);
}
