'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scene } from '@/components/three/Scene';
import { CubeFaceCamera } from './CubeFaceCamera';
import { CUBE_FACES, type CubeFaceId } from '@/lib/pano/cube-faces';
import { findSpace } from '@/lib/experience/spaces';
import type { CameraView } from '@/types';

/**
 * The render job's view of the scene: the residence, path-traced, pointed at
 * one cube face at a time. No chrome, no hotspots, no drag control — nothing
 * that could composite into a face.
 *
 * ## The control surface
 *
 * Deliberately the same one `brochure-stills.mjs` already drives, rather
 * than a fourth ad-hoc bridge: convergence is signalled by
 * `[data-cinematic-progress]` attaching and then detaching from the DOM, and
 * the sample budget is read from `window.__AURELIA_STILL_SAMPLES__`. Twenty
 * nine plates have been captured through that contract.
 *
 * What is added on top is a face stepper: `window.__panoRender`, with
 * `ready` flipped only once a frame has actually been traced, so the job
 * cannot photograph a blank canvas.
 */

type PanoRenderApi = {
  ready: boolean;
  done: boolean;
  face: CubeFaceId;
  /** Points the camera at a face and resets accumulation. */
  renderFace(face: CubeFaceId): void;
  /** Sample count of the trace in flight, for calibration. */
  samples(): number;
};

declare global {
  interface Window {
    __panoRender?: PanoRenderApi;
    __AURELIA_STILL_SAMPLES__?: number;
  }
}

export function PanoRenderBridge({ spaceId }: { spaceId: string }) {
  const space = findSpace(spaceId);
  const [face, setFace] = useState<CubeFaceId>(CUBE_FACES[0].id);
  const [epoch, setEpoch] = useState(0);
  const [tracing, setTracing] = useState(true);
  const samples = useRef(0);

  const maxSamples = typeof window === 'undefined' ? undefined : window.__AURELIA_STILL_SAMPLES__;

  // The API object is created once and then mutated in place.
  //
  // It cannot be rebuilt per render: the job holds no reference to it beyond
  // `window.__panoRender`, and rebuilding resets `ready` to false after it
  // has already been earned. Nor can its flags be pushed from an effect —
  // convergence arrives through a callback that writes refs, so there is no
  // state change to key an effect on, and `ready` would sit false while the
  // tracer quietly finished.
  const api = useRef<PanoRenderApi | null>(null);
  if (api.current === null) {
    api.current = {
      ready: false,
      done: false,
      face: CUBE_FACES[0].id,
      renderFace(next: CubeFaceId) {
        const self = api.current;
        if (self) {
          self.ready = false;
          self.done = false;
          self.face = next;
        }
        samples.current = 0;
        setTracing(true);
        setFace(next);
        // Bumping the epoch is what makes `PathTracer` call
        // `updateCamera()`, which resets accumulation. Without it the tracer
        // keeps adding samples from the new orientation to the image made
        // from the old one, and six faces come out as six smears.
        setEpoch((value) => value + 1);
      },
      samples: () => samples.current,
    };
  }

  const onProgress = useCallback((value: number, limit: number) => {
    samples.current = value;
    const self = api.current;
    if (self) {
      // `ready` means a frame has been traced, not that the component
      // mounted — the job waits on it so it cannot photograph a blank canvas.
      if (value >= 1) self.ready = true;
      self.done = value >= limit;
    }
    setTracing(value < limit);
  }, []);

  useEffect(() => {
    if (!space || !api.current) return;
    window.__panoRender = api.current;
    return () => {
      delete window.__panoRender;
    };
  }, [space]);

  const view = useMemo((): CameraView | undefined => {
    if (!space) return undefined;
    // Position is what matters; the target is overridden by
    // `CubeFaceCamera`, which is the only thing that can express a pole
    // face's roll. Exposure is carried through so all six faces of a room
    // are graded identically — a per-face difference shows as a seam.
    return { ...space.view, fov: 90 };
  }, [space]);

  if (!space || !view) {
    return <div data-pano-error={`unknown space: ${spaceId}`} />;
  }

  return (
    <>
      <Scene
        view={view}
        mode="fixed"
        timeOfDay="goldenHour"
        parallax={0}
        drift={0}
        cinematic
        cinematicCameraEpoch={epoch}
        {...(maxSamples ? { cinematicMaxSamples: maxSamples } : {})}
        onCinematicProgress={onProgress}
        overlay={<CubeFaceCamera centre={space.view.position} face={face} />}
      />
      {/* The same convergence signal the stills job already waits on: this
          node exists for exactly as long as the trace is still resolving,
          and its removal is the "done" edge. */}
      {tracing ? <div data-cinematic-progress={samples.current} /> : null}
    </>
  );
}
