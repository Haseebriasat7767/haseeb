'use client';

import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scene } from '@/components/three/Scene';
import { CubeFaceCamera } from './CubeFaceCamera';
import { CUBE_FACES, type CubeFaceId } from '@/lib/pano/cube-faces';
import { findSpace } from '@/lib/experience/spaces';
import { TOWER_VIEWS } from '@/lib/three/tower-views';
import type { PanoBuilding } from '@/lib/pano/manifest-types';
import type { CameraView, SceneContent } from '@/types';

/**
 * The camera a building frames a given space with.
 *
 * Both buildings are rendered by the same `Scene`; only the content flag and
 * the source of framings differ. The tower has no room schedule — its twelve
 * interiors are camera positions, not a generated plan — so it is rendered
 * from `TOWER_VIEWS` directly.
 */
function viewFor(building: PanoBuilding, spaceId: string): CameraView | undefined {
  if (building === 'tower') return TOWER_VIEWS.find((view) => view.id === spaceId);
  return findSpace(spaceId)?.view;
}

const CONTENT: Record<PanoBuilding, SceneContent> = { residence: 'villa', tower: 'tower' };

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
  /** The camera's live world direction, for asserting the face is aimed right. */
  dir?: number[];
  /** Whether that direction matches the face currently requested. */
  aimed?: boolean;
};

declare global {
  interface Window {
    __panoRender?: PanoRenderApi;
    __AURELIA_STILL_SAMPLES__?: number;
  }
}

export type PanoRenderBridgeProps = {
  spaceId: string;
  building?: PanoBuilding;
  /**
   * `false` captures the rasterizer instead of the path tracer.
   *
   * Not a shortcut — it is the only mode that produces a usable face without
   * a GPU, and what it captures is exactly the image a visitor with WebGL
   * already sees at that camera position. Path tracing at a real sample
   * count is hours per room in software, and what it produces short of that
   * is noise. A raster face is honest and clean; it simply is not photoreal,
   * and the manifest records which it is.
   */
  trace?: boolean;
};

/**
 * Frames to let the rasterizer settle before the shutter.
 *
 * Only the camera changes between faces — the scene, its lights and its
 * shadow maps are all static — so this needs to cover a few frames of
 * material and environment settling, not a convergence. Each frame is
 * seconds under software rendering, so the number is worth being honest
 * about rather than padding.
 */
const RASTER_SETTLE_FRAMES = Number(process.env.NEXT_PUBLIC_PANO_SETTLE_FRAMES ?? 4);

/**
 * Reports when the rasterizer has drawn enough frames for the new camera.
 *
 * A raster frame has no convergence to wait for, but it does have work that
 * lands over several frames: shadow maps re-render, the environment
 * resolves, and drei's own effects settle. Capturing on the first frame
 * after a camera move catches the scene mid-update. Counting frames is
 * crude and sufficient — there is nothing to converge, only to finish.
 */
function RasterSettle({ epoch, onSettled }: { epoch: number; onSettled: () => void }) {
  const frames = useRef(0);
  const fired = useRef(-1);

  useEffect(() => {
    frames.current = 0;
  }, [epoch]);

  useFrame(() => {
    frames.current += 1;
    if (frames.current >= RASTER_SETTLE_FRAMES && fired.current !== epoch) {
      fired.current = epoch;
      onSettled();
    }
  });

  return null;
}

export function PanoRenderBridge({
  spaceId,
  building = 'residence',
  trace = true,
}: PanoRenderBridgeProps) {
  const view = viewFor(building, spaceId);
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
          // In raster mode `ready` is re-earned per face by RasterSettle;
          // in traced mode by the first sample. Either way it is false
          // until this face has actually been drawn.
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

  /** The raster equivalent of convergence: enough frames have been drawn. */
  const onRasterSettled = useCallback(() => {
    const self = api.current;
    if (self) {
      self.ready = true;
      self.done = true;
    }
    setTracing(false);
  }, []);

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
    if (!view || !api.current) return;
    window.__panoRender = api.current;
    return () => {
      delete window.__panoRender;
    };
  }, [view]);

  const framing = useMemo((): CameraView | undefined => {
    if (!view) return undefined;
    // Position is what matters; the target is overridden by
    // `CubeFaceCamera`, which is the only thing that can express a pole
    // face's roll. Exposure is carried through so all six faces of a room
    // are graded identically — a per-face difference shows as a seam.
    return { ...view, fov: 90 };
  }, [view]);

  if (!view || !framing) {
    return <div data-pano-error={`unknown ${building} space: ${spaceId}`} />;
  }

  return (
    <>
      <Scene
        view={framing}
        content={CONTENT[building]}
        mode="fixed"
        // The render job aims the camera itself, face by face. Without this
        // `CameraController` eases it back to the authored framing every
        // frame and the six faces come out as six copies of one shot.
        cameraExternal
        timeOfDay="goldenHour"
        parallax={0}
        drift={0}
        {...(trace
          ? {
              cinematic: true as const,
              cinematicCameraEpoch: epoch,
              ...(maxSamples ? { cinematicMaxSamples: maxSamples } : {}),
              onCinematicProgress: onProgress,
            }
          : {})}
        overlay={
          <>
            <CubeFaceCamera centre={view.position} face={face} />
            {trace ? null : <RasterSettle epoch={epoch} onSettled={onRasterSettled} />}
          </>
        }
      />
      {/* The same convergence signal the stills job already waits on: this
          node exists for exactly as long as the trace is still resolving,
          and its removal is the "done" edge. */}
      {tracing ? <div data-cinematic-progress={samples.current} /> : null}
    </>
  );
}
