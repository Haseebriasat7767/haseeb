'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Gives an element a small magnetic pull toward the pointer. The movement
 * is capped at a few pixels — enough that a call to action feels alive
 * under the hand, not so much that it becomes a toy.
 *
 * Disabled outright for coarse pointers and for reduced motion, and it
 * writes only to `transform`, so it never triggers layout.
 */
export function useMagnetic<T extends HTMLElement>(enabled = true, strength = 0.28) {
  const ref = useRef<T>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || reducedMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let frame = 0;

    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const cap = Math.min(10, rect.height * 0.3);
        const x = Math.max(-cap, Math.min(cap, dx * strength));
        const y = Math.max(-cap, Math.min(cap, dy * strength));
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      node.style.transform = '';
    };

    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', reset);
    node.addEventListener('blur', reset);

    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', reset);
      node.removeEventListener('blur', reset);
      node.style.transform = '';
    };
  }, [enabled, reducedMotion, strength]);

  return ref;
}
