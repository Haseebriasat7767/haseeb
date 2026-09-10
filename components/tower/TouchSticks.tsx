'use client';

import { useEffect, useRef, useState } from 'react';
import {
  resetWalkInput,
  stickDeflection,
  STICK_RANGE,
  walkLook,
  walkMove,
} from '@/lib/three/walk-input';

/**
 * Thumb controls for walking on a touch screen.
 *
 * Walk mode was keys-and-mouse only, which meant the twenty-storey building
 * could not be walked at all on the devices most people open a property link
 * on. Two zones, the way every first-person game on a phone does it: the left
 * thumb walks, the right thumb looks.
 *
 * ## Why the stick follows the thumb
 *
 * A stick fixed to one spot makes the visitor find it before they can move,
 * and on a phone held one-handed that spot is rarely where the thumb already
 * is. Touching anywhere in the zone places the stick there instead, so the
 * control arrives where the hand is.
 *
 * ## Why it is hidden from assistive technology
 *
 * These are a pointer-only mirror of the keyboard controls, which do the
 * same job and are reachable. Exposing two unlabelled drag targets that a
 * screen reader cannot operate would add noise, not access.
 */

const RANGE = STICK_RANGE;

type Stick = { id: number; originX: number; originY: number; x: number; y: number };

const deflection = (stick: Stick) =>
  stickDeflection({ x: stick.originX, y: stick.originY }, { x: stick.x, y: stick.y });

export function TouchSticks({ active }: { active: boolean }) {
  const [touch, setTouch] = useState(false);
  const [move, setMove] = useState<Stick | null>(null);
  const [look, setLook] = useState<Stick | null>(null);
  const running = useRef(false);

  // Coarse pointer, not screen width: a small laptop window is still a mouse,
  // and a large tablet is still a thumb.
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const read = () => setTouch(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  // Leaving walk mode with a thumb down would otherwise leave the camera
  // turning for as long as the page is open.
  useEffect(() => {
    if (active) return;
    setMove(null);
    setLook(null);
    running.current = false;
    resetWalkInput();
  }, [active]);

  if (!active || !touch) return null;

  function zone(
    which: 'move' | 'look',
    stick: Stick | null,
    setStick: (next: Stick | null) => void,
  ) {
    const write = (next: Stick | null) => {
      const out = next ? deflection(next) : { x: 0, y: 0 };
      if (which === 'move') {
        walkMove.current.x = out.x;
        walkMove.current.y = out.y;
      } else {
        walkLook.current.x = out.x;
        walkLook.current.y = out.y;
      }
    };

    return {
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        if (stick) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const next = {
          id: event.pointerId,
          originX: event.clientX,
          originY: event.clientY,
          x: event.clientX,
          y: event.clientY,
        };
        setStick(next);
        write(next);
        // Sprint: a second finger in the walk zone. There is no shift key on
        // a phone, and a separate run button is a third thing to hold.
        if (which === 'move') running.current = true;
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!stick || stick.id !== event.pointerId) return;
        const next = { ...stick, x: event.clientX, y: event.clientY };
        setStick(next);
        write(next);
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!stick || stick.id !== event.pointerId) return;
        setStick(null);
        write(null);
        if (which === 'move') running.current = false;
      },
      onPointerCancel: () => {
        setStick(null);
        write(null);
        if (which === 'move') running.current = false;
      },
    };
  }

  const knob = (stick: Stick | null) => {
    if (!stick) return null;
    const out = deflection(stick);
    return (
      <>
        <span
          className="border-alabaster/30 absolute rounded-full border"
          style={{
            left: stick.originX - RANGE,
            top: stick.originY - RANGE,
            width: RANGE * 2,
            height: RANGE * 2,
          }}
        />
        <span
          className="bg-alabaster/70 absolute rounded-full"
          style={{
            left: stick.originX + out.x * RANGE - 22,
            top: stick.originY + out.y * RANGE - 22,
            width: 44,
            height: 44,
          }}
        />
      </>
    );
  };

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 select-none">
      {/* The zones sit below the chrome so the walk toggle and floor picker
          still take a tap, and stop short of the very bottom edge, which on
          iOS is the home indicator's swipe area. */}
      <div
        className="pointer-events-auto absolute bottom-0 left-0 h-[52%] w-1/2 touch-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        {...zone('move', move, setMove)}
      />
      <div
        className="pointer-events-auto absolute right-0 bottom-0 h-[52%] w-1/2 touch-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        {...zone('look', look, setLook)}
      />
      {knob(move)}
      {knob(look)}
    </div>
  );
}

export default TouchSticks;
