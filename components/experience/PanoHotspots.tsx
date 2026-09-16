'use client';

import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { panoHotspotsFor, type PanoHotspot } from '@/lib/pano/hotspots';
import { hasPanorama } from '@/lib/pano/manifest';
import { horizontalHalfFov, offscreenHint } from '@/lib/pano/offscreen';
import { cn } from '@/lib/utils/cn';

/**
 * How a visitor gets from one room to the next.
 *
 * Markers are HTML rather than sprites. A sprite has to reimplement hit
 * testing, hover, focus, tooltips and a touch target that clears 44px; the
 * DOM already does all of that, and — the part no sprite recovers — it is
 * reachable by keyboard and announced by a screen reader.
 */

/** Metres out from the camera. Well inside the shell, so never clipped. */
const MARKER_DISTANCE = 6;

export type PanoHotspotsProps = {
  /** The room currently being stood in. */
  spaceId: string;
  onNavigate: (targetId: string) => void;
  /** Suppresses interaction while a transition is running. */
  disabled?: boolean;
};

/**
 * Which doors are currently off-screen, and which way to turn for them.
 *
 * Recomputed on a rAF loop rather than per React render: the answer changes
 * continuously while the visitor drags, and a state update per frame to move
 * two chevrons would cost more than the panorama behind them. Only a change
 * in the *set* of off-screen doors reaches React.
 */
function useOffscreenDoors(hotspots: readonly PanoHotspot[]): Record<string, 'left' | 'right'> {
  const camera = useThree((state) => state.camera);
  const [sides, setSides] = useState<Record<string, 'left' | 'right'>>({});
  const previous = useRef('');

  useEffect(() => {
    if (hotspots.length === 0) {
      setSides({});
      return;
    }
    let raf = 0;
    const scratch = new Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!(camera instanceof PerspectiveCamera)) return;

      const forward = camera.getWorldDirection(scratch);
      const yaw = Math.atan2(forward.x, forward.z);
      // Portrait is the case this exists for: there the horizontal angle is
      // narrower than the vertical fov, so doors leave the frame sooner than
      // the camera's own `fov` number suggests.
      const halfFov = horizontalHalfFov(camera.fov, camera.aspect);

      const next: Record<string, 'left' | 'right'> = {};
      for (const hotspot of hotspots) {
        const hint = offscreenHint(yaw, hotspot.yaw, halfFov);
        if (hint) next[hotspot.id] = hint.side;
      }

      const key = Object.entries(next)
        .map(([id, side]) => `${id}:${side}`)
        .sort()
        .join('|');
      if (key !== previous.current) {
        previous.current = key;
        setSides(next);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [camera, hotspots]);

  return sides;
}

export function PanoHotspots({ spaceId, onNavigate, disabled = false }: PanoHotspotsProps) {
  // Only offer a door that leads somewhere rendered. A marker onto a room
  // with no panorama is a promise the experience cannot keep.
  const hotspots = useMemo(
    () => panoHotspotsFor(spaceId).filter((hotspot) => hasPanorama(hotspot.id)),
    [spaceId],
  );

  const offscreen = useOffscreenDoors(hotspots);

  return (
    <>
      {/* Doors the visitor cannot see. Without this, a phone held upright
          shows about 50 degrees of a room that has exits all around it, and
          nothing on screen says there is anywhere to go. The compass gives
          heading, which answers a different question. */}
      {hotspots.some((hotspot) => offscreen[hotspot.id]) ? (
        <Html fullscreen zIndexRange={[30, 20]}>
          <div className="pointer-events-none absolute inset-0">
            {(['left', 'right'] as const).map((side) => {
              const waiting = hotspots.filter((hotspot) => offscreen[hotspot.id] === side);
              if (waiting.length === 0) return null;
              return (
                <div
                  key={side}
                  data-pano-offscreen={side}
                  className={cn(
                    'text-alabaster/70 absolute top-1/2 -translate-y-1/2 text-2xl',
                    side === 'left' ? 'left-3' : 'right-3',
                  )}
                >
                  <span aria-hidden="true">{side === 'left' ? '\u2039' : '\u203a'}</span>
                  <span className="sr-only">
                    {waiting.length === 1
                      ? `${waiting[0]!.label} is to the ${side}. Turn to see it.`
                      : `${waiting.length} more rooms are to the ${side}. Turn to see them.`}
                  </span>
                </div>
              );
            })}
          </div>
        </Html>
      ) : null}

      {hotspots.map((hotspot) => (
        <Html
          key={hotspot.id}
          position={[
            hotspot.direction[0] * MARKER_DISTANCE,
            hotspot.direction[1] * MARKER_DISTANCE,
            hotspot.direction[2] * MARKER_DISTANCE,
          ]}
          center
          // Occlusion has no meaning inside a panorama: there is one surface
          // and it is behind everything.
          zIndexRange={[20, 10]}
        >
          <HotspotMarker hotspot={hotspot} disabled={disabled} onNavigate={onNavigate} />
        </Html>
      ))}
    </>
  );
}

function HotspotMarker({
  hotspot,
  disabled,
  onNavigate,
}: {
  hotspot: PanoHotspot;
  disabled: boolean;
  onNavigate: (targetId: string) => void;
}) {
  // Hover is a desktop idea. On touch there is no hover state to enter, so
  // the first tap reveals the label and the second commits — which also
  // stops a stray thumb from teleporting someone into another room.
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Move to ${hotspot.label}`}
      className={cn(
        'group ease-luxe relative flex h-11 w-11 items-center justify-center',
        'transition-transform duration-300 hover:scale-110 focus-visible:scale-110',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') setRevealed(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') setRevealed(false);
      }}
      onFocus={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
      onClick={() => {
        // A click the label has not been revealed for came from a tap:
        // pointerenter never fired, and keyboard activation sets it on
        // focus. So reveal first and commit on the second press.
        if (!revealed) {
          setRevealed(true);
          return;
        }
        onNavigate(hotspot.id);
      }}
    >
      {/* The ring is the visible mark; the button around it is the 44px
          target. Drawing them as one would mean a 44px ring, which reads as
          a traffic sign rather than a threshold. */}
      <span
        aria-hidden="true"
        className="border-alabaster/70 bg-obsidian/30 block h-5 w-5 rounded-full border backdrop-blur-sm"
      />
      <span
        aria-hidden="true"
        className="bg-alabaster/80 absolute block h-1.5 w-1.5 rounded-full"
      />
      <span
        aria-hidden="true"
        className={cn(
          'text-eyebrow bg-obsidian/80 text-alabaster pointer-events-none absolute top-full mt-2',
          'ease-luxe border border-white/10 px-2 py-1 whitespace-nowrap uppercase backdrop-blur-sm',
          'transition-opacity duration-200',
          revealed ? 'opacity-100' : 'opacity-0',
        )}
      >
        {hotspot.label}
      </span>
    </button>
  );
}

export type PanoCompassProps = {
  /** Compass bearing in radians, 0 = world +Z. Read from the live camera. */
  yawRef: { current: number };
  className?: string;
};

/**
 * Which way the visitor is facing. Without it a panorama is disorienting in
 * a specific way: every wall looks like a plausible front, and there is no
 * cue that you have turned 180° from where you came in.
 *
 * The needle is moved by writing a transform directly, outside React, for
 * the same reason the shells sample refs.
 */
export function PanoCompass({ yawRef, className }: PanoCompassProps) {
  const [needle, setNeedle] = useState<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!needle) return;
    let raf = 0;
    const tick = () => {
      needle.style.transform = `rotate(${-yawRef.current}rad)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [needle, yawRef]);

  return (
    <div
      className={cn(
        'border-alabaster/20 bg-obsidian/60 relative h-14 w-14 rounded-full border backdrop-blur-sm',
        className,
      )}
      role="img"
      aria-label="Compass showing which way the view is facing"
    >
      <span className="text-eyebrow text-stone absolute inset-x-0 top-1 text-center">N</span>
      <span ref={setNeedle} className="absolute inset-0 flex items-center justify-center">
        <span aria-hidden="true" className="bg-gold block h-5 w-px origin-bottom" />
      </span>
    </div>
  );
}
