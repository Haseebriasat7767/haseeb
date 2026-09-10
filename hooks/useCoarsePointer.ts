'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the visitor is driving this with a thumb rather than a mouse.
 *
 * Pointer type, not viewport width: a narrow desktop window is still a
 * mouse, and a large tablet is still a thumb. Sizing behaviour off the
 * breakpoint gets both of those wrong.
 *
 * Starts false so the server's markup and the first client render agree,
 * then corrects on mount.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const read = () => setCoarse(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  return coarse;
}
