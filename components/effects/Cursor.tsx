'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A refined pointer. A hairline ring that trails the cursor and opens over
 * anything marked `data-cursor`, with the label the mark carries.
 *
 * Mounted only for fine pointers that are not asking for reduced motion, so
 * touch devices and motion-sensitive visitors keep the native cursor and
 * pay nothing for this at all. Writes only `transform` and `opacity`, from
 * a single rAF loop.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => setEnabled(fine.matches && !still.matches);
    update();

    fine.addEventListener('change', update);
    still.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      still.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const ring = ringRef.current;
    const label = labelRef.current;
    if (!ring || !label) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let renderedX = x;
    let renderedY = y;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      ring.style.opacity = '1';

      const target = (event.target as HTMLElement | null)?.closest?.('[data-cursor]');
      const kind = target?.getAttribute('data-cursor') ?? '';
      ring.dataset.state = kind || 'default';
      label.textContent = kind === 'view' ? 'View' : '';
    };

    const onLeave = () => {
      ring.style.opacity = '0';
    };

    const tick = () => {
      // Light trailing so the ring reads as attached to the hand rather
      // than glued to the OS cursor.
      renderedX += (x - renderedX) * 0.22;
      renderedY += (y - renderedY) * 0.22;
      ring.style.transform = `translate3d(${renderedX}px, ${renderedY}px, 0) translate(-50%, -50%)`;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      data-state="default"
      style={{ opacity: 0 }}
      className="border-alabaster/50 pointer-events-none fixed top-0 left-0 z-[60] flex h-7 w-7 items-center justify-center rounded-full border transition-[width,height,background-color,border-color,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=link]:h-12 data-[state=link]:w-12 data-[state=link]:border-transparent data-[state=link]:bg-[rgb(185_154_99_/_0.22)] data-[state=view]:h-16 data-[state=view]:w-16 data-[state=view]:border-transparent data-[state=view]:bg-[rgb(185_154_99_/_0.22)]"
    >
      <span ref={labelRef} className="text-alabaster text-[0.5rem] tracking-[0.2em] uppercase" />
    </div>
  );
}
