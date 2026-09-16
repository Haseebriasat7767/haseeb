'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanoShell, useFadeIn, usePanorama } from './InteriorPanoViewer';
import { createTransitionController, DEFAULT_TRANSITION_MS } from '@/lib/pano/transitionController';
import { panoramaFor } from '@/lib/pano/manifest';
import { peekPanorama, releasePanorama, type LoadedPanorama } from '@/lib/pano/panoLoader';

/**
 * Moving between rooms without a cut.
 *
 * ## Why this is not the fade-out-then-fade-in the brief describes
 *
 * Fading the outgoing room to zero while fading the incoming room up means
 * that at the midpoint both sit near 50% over an empty background, and an
 * empty background is black. That midpoint dip is the "flash of black" the
 * acceptance criteria rule out — it is caused by the sequence, not by a bug
 * in it.
 *
 * So the outgoing room is held fully opaque and simply covered: the incoming
 * shell is drawn after it, at a smaller radius, and fades in on top. The
 * visible result is the same crossfade, and there is no frame in which the
 * total coverage is less than one.
 *
 * Two concentric shells with depth testing off and an explicit `renderOrder`
 * is the react-three-fiber equivalent of the two-scene, two-camera technique
 * — same guarantee about draw order, without a second render pass to keep in
 * step with the first.
 */

export type PanoTransitionProps = {
  /** The space to show. Changing it starts a transition. */
  spaceId: string | null;
  durationMs?: number;
  /**
   * Fires when a room's panorama is on screen — the moment "which room am I
   * in" becomes true. This is the single source of that fact: `spaceId` is
   * only the request, and between the request and this callback the picture
   * is still the previous room.
   */
  onCurrentSpaceChange?: (spaceId: string) => void;
  /** Fires once the incoming room has fully covered the one behind it. */
  onTransitionEnd?: (spaceId: string) => void;
};

type Layer = { spaceId: string; panorama: LoadedPanorama };

export function PanoTransition({
  spaceId,
  durationMs = DEFAULT_TRANSITION_MS,
  onCurrentSpaceChange,
  onTransitionEnd,
}: PanoTransitionProps) {
  const source = useMemo(() => (spaceId ? panoramaFor(spaceId) : null), [spaceId]);
  const state = usePanorama(source);

  /** The room being left. Null on the very first arrival. */
  const [outgoing, setOutgoing] = useState<Layer | null>(null);
  const [incoming, setIncoming] = useState<Layer | null>(null);

  const controller = useMemo(() => createTransitionController({ durationMs }), [durationMs]);

  // Sampled by the shells every frame. Holding them as state would re-render
  // the tree for each of the transition's ~36 frames.
  const incomingOpacity = useRef(1);
  const incomingScale = useRef(1);

  // The first room has nothing to cross-fade from, so it gets the plain
  // load fade instead — otherwise it would pop in at full opacity.
  const firstArrival = outgoing === null && incoming !== null;
  const fade = useFadeIn(firstArrival);

  const endRef = useRef(onTransitionEnd);
  endRef.current = onTransitionEnd;
  const currentRef = useRef(onCurrentSpaceChange);
  currentRef.current = onCurrentSpaceChange;

  useEffect(() => {
    if (state.status !== 'ready' || !spaceId) return;
    if (incoming?.spaceId === spaceId) return;
    // `spaceId` changes a render before the loader has been told about it,
    // so for one commit `state` still holds the room being LEFT while
    // `spaceId` already names the room being entered. Promoting then puts
    // the old room's texture behind the new room's name — the caption
    // changes and the picture does not. Wait until the panorama in hand is
    // the one asked for.
    if (state.panorama.id !== source?.id) return;

    setOutgoing(incoming);
    setIncoming({ spaceId, panorama: state.panorama });
    controller.start();
    currentRef.current?.(spaceId);
    // `incoming` is read to promote it, and including it would restart the
    // transition it is the product of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, spaceId, source, controller]);

  useFrame((_, delta) => {
    if (!controller.running) return;
    const next = controller.advance(delta * 1000);
    incomingOpacity.current = next.incomingOpacity;
    incomingScale.current = next.incomingScale;
    if (next.done && incoming) {
      // The room behind is now completely covered. Drop it, and let go of
      // its texture unless the cache decided to keep it — the cache owns
      // residency, this component only owns what is on screen.
      const left = outgoing;
      setOutgoing(null);
      if (left && !peekPanorama(left.spaceId)) releasePanorama(left.spaceId);
      endRef.current?.(incoming.spaceId);
    }
  });

  if (!incoming) return null;

  return (
    <>
      {outgoing ? <PanoShell panorama={outgoing.panorama} opacity={1} renderOrder={0} /> : null}
      <PanoShell
        panorama={incoming.panorama}
        opacity={firstArrival ? fade : incomingOpacity}
        scale={incomingScale}
        renderOrder={1}
      />
    </>
  );
}
