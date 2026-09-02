'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reports which of a set of sections currently owns the middle of the
 * viewport. Built on IntersectionObserver rather than a scroll listener, so
 * it costs nothing while the user is not scrolling and never runs layout
 * reads on the main thread per frame.
 */
export function useActiveSection(ids: readonly string[], initial = ids[0] ?? '') {
  const [active, setActive] = useState(initial);
  const ratios = useRef(new Map<string, number>());

  useEffect(() => {
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);

    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.current.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let best = '';
        let bestRatio = 0;
        ratios.current.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        });

        if (best) setActive(best);
      },
      // A band across the middle of the viewport: whichever section owns it
      // is the one being read.
      { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
