'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resetWalkInput, walkMove } from '@/lib/three/walk-input';
import { cn } from '@/lib/utils/cn';

/**
 * Arrows to walk with.
 *
 * ## Why this exists
 *
 * Walk mode had exactly two ways to move: W A S D, and the thumb sticks —
 * and the sticks only ever appear on a coarse pointer. So on a laptop the
 * only way through the building was a keyboard shortcut nobody is told
 * about, on a page being shown to a client who has never played a
 * first-person game. Dragging to look made that worse rather than better:
 * the mouse now turns the camera beautifully and still cannot take a single
 * step forward.
 *
 * These are that missing half. Press and hold an arrow and the visitor
 * walks; the pad is ordinary DOM over the canvas, so it costs nothing in
 * the frame and can be operated with the same free cursor that turns the
 * view.
 *
 * ## Why it writes to `walkMove` rather than faking key events
 *
 * Synthesising `keydown` for `KeyW` would work and would be a lie: the
 * analog channel already exists for exactly this, `WalkControls` already
 * sums it with the keys, and a held arrow is closer to a stick than to a
 * key anyway. Writing the vector directly also means a diagonal is a
 * diagonal — hold forward and left together and you get one normalised
 * step, not two competing ones.
 */

/** Screen-space, matching the sticks: `y` is negative going forward. */
const VECTORS = {
  forward: { x: 0, y: -1 },
  back: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

type Direction = keyof typeof VECTORS;

const ARROWS: { dir: Direction; glyph: string; label: string; className: string }[] = [
  { dir: 'forward', glyph: '↑', label: 'Walk forward', className: 'col-start-2 row-start-1' },
  { dir: 'left', glyph: '←', label: 'Step left', className: 'col-start-1 row-start-2' },
  { dir: 'back', glyph: '↓', label: 'Walk backward', className: 'col-start-2 row-start-2' },
  { dir: 'right', glyph: '→', label: 'Step right', className: 'col-start-3 row-start-2' },
];

export function WalkPad({ active }: { active: boolean }) {
  // A mouse only. Where there is a thumb there are already sticks, and two
  // sets of movement controls on one screen is worse than either alone.
  const [fine, setFine] = useState(false);
  const held = useRef(new Set<Direction>());
  const [lit, setLit] = useState<Direction[]>([]);

  useEffect(() => {
    const query = window.matchMedia('(pointer: fine)');
    const read = () => setFine(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  const apply = useCallback(() => {
    let x = 0;
    let y = 0;
    for (const dir of held.current) {
      x += VECTORS[dir].x;
      y += VECTORS[dir].y;
    }
    // Clamped to the unit circle for the same reason the sticks are: a
    // diagonal built from two full-length axes is √2 times too fast.
    const length = Math.hypot(x, y);
    walkMove.current.x = length > 1 ? x / length : x;
    walkMove.current.y = length > 1 ? y / length : y;
    setLit([...held.current]);
  }, []);

  const press = useCallback(
    (dir: Direction) => {
      held.current.add(dir);
      apply();
    },
    [apply],
  );

  const release = useCallback(
    (dir: Direction) => {
      held.current.delete(dir);
      apply();
    },
    [apply],
  );

  // Anything that can take the pointer away mid-press has to stop the walk,
  // or the visitor keeps walking into a wall with nothing held down. A
  // pointer released outside the button never fires that button's pointerup.
  useEffect(() => {
    const stop = () => {
      if (held.current.size === 0) return;
      held.current.clear();
      apply();
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
    };
  }, [apply]);

  // Leaving walk mode with an arrow down would otherwise walk forever.
  useEffect(() => {
    if (active) return;
    held.current.clear();
    setLit([]);
    resetWalkInput();
  }, [active]);

  useEffect(() => () => resetWalkInput(), []);

  if (!active || !fine) return null;

  return (
    <div
      // Bottom-left, clear of the hint at bottom-centre and the step
      // controls at bottom-right.
      className="absolute bottom-6 left-6 z-20 grid grid-cols-3 grid-rows-2 gap-1.5"
      role="group"
      aria-label="Move through the building"
    >
      {ARROWS.map(({ dir, glyph, label, className }) => (
        <button
          key={dir}
          type="button"
          aria-label={label}
          onPointerDown={(e) => {
            // Left button only, and the canvas must not also start a
            // look-drag underneath this press.
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            press(dir);
          }}
          onPointerUp={() => release(dir)}
          onPointerLeave={() => release(dir)}
          // Held with the keyboard too: a visitor who tabs to the pad should
          // be able to walk with it, not just see it.
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              press(dir);
            }
          }}
          onKeyUp={(e) => {
            if (e.key === 'Enter' || e.key === ' ') release(dir);
          }}
          onBlur={() => release(dir)}
          className={cn(
            className,
            'ease-luxe flex h-11 w-11 touch-none items-center justify-center border text-base',
            'bg-obsidian/50 backdrop-blur-sm transition-colors duration-200 select-none',
            'focus-visible:outline-gold focus-visible:outline-2 focus-visible:outline-offset-2',
            lit.includes(dir)
              ? 'border-gold text-gold bg-obsidian/70'
              : 'border-alabaster/30 text-alabaster/80 hover:border-alabaster/60 hover:text-alabaster',
          )}
        >
          <span aria-hidden="true">{glyph}</span>
        </button>
      ))}
    </div>
  );
}

export default WalkPad;
