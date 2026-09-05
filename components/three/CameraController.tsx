'use client';

import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, PerspectiveCamera as ThreePerspectiveCamera, Vector3 } from 'three';
import type { CameraMode, CameraView } from '@/types';

type CameraControllerProps = {
  view: CameraView;
  mode?: CameraMode;
  /** Cinematic mode only: radians per second of slow orbital drift. */
  driftSpeed?: number;
  /**
   * Metres of pointer-driven parallax at the edge of the viewport. Small on
   * purpose — it should read as a hand-held camera breathing, not as a
   * mouse-follow effect.
   */
  parallax?: number;
  reducedMotion?: boolean;
};

/** Seconds-independent critical damping: the fraction remaining after `dt`. */
function damp(current: number, target: number, smoothing: number, delta: number): number {
  return current + (target - current) * (1 - Math.pow(smoothing, delta));
}

/** The aspect every framing in the project was composed against. */
const REFERENCE_ASPECT = 16 / 9;

/**
 * How wide the focal length may be opened to keep a composed elevation in
 * frame on a narrow viewport.
 *
 * Seventy-eight degrees was too generous, and generous is the wrong
 * instinct here. Three's field of view is vertical, so opening it to hold
 * the building's *width* on a phone also opens it vertically — and a
 * portrait phone is nearly twice as tall as it is wide, so the extra
 * vertical angle is spent almost entirely on empty sky above the roofline
 * and empty ground below the plinth. The rendered phone frames showed
 * exactly that: about forty-five percent sky, with the residence squeezed
 * into the lower half behind the headline.
 *
 * Sixty-six is the balance found by rendering both ends: at seventy-eight
 * the phone frame was half empty sky, and at fifty-eight the crop closed in
 * so far that the hero showed a wall of glazing rather than a residence.
 */
const MAX_FOV = 66;

/**
 * How much taller a frustum is rendered on a portrait viewport, and where
 * the visible window sits inside it.
 *
 * Capping the focal length keeps the building a reasonable size but leaves
 * it centred, which on a phone means it sits directly behind the copy. A
 * photographer would not centre it: they would compose the subject in the
 * upper part of the frame and leave the lower part for the type.
 *
 * `setViewOffset` does exactly that without touching the camera. Rendering
 * a frustum a third taller and showing its *lower* slice puts the camera's
 * own axis — and therefore the residence — near the top of what the phone
 * actually displays, and gives the headline deliberate negative space to
 * sit in rather than the architecture.
 */
const PORTRAIT_FRUSTUM = 1.26;
const PORTRAIT_OFFSET = 0.22;
/** Below this aspect a viewport is treated as a phone held upright. */
const PORTRAIT_ASPECT = 0.8;

function fovForAspect(fov: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0 || aspect >= REFERENCE_ASPECT) return fov;
  const half = Math.tan(MathUtils.degToRad(fov) / 2) * (REFERENCE_ASPECT / aspect);
  return Math.min(MAX_FOV, MathUtils.radToDeg(2 * Math.atan(half)));
}

/**
 * Owns all camera behaviour so pages never touch the camera directly.
 *
 * - `orbit` hands control to the user, within architectural limits.
 * - `cinematic` drifts slowly around the target.
 * - `fixed` holds a framing.
 * - `journey` tweens between named views as the page scrolls, easing
 *   position, target, *and* focal length together so a change of viewpoint
 *   reads as one camera move rather than a cut.
 *
 * Every transition is critically damped and frame-rate independent, so a
 * view change is smooth on any device and never overshoots into a jump.
 */
export function CameraController({
  view,
  mode = 'orbit',
  driftSpeed = 0.05,
  parallax = 0,
  reducedMotion = false,
}: CameraControllerProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const pointer = useThree((state) => state.pointer);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const targetFov = fovForAspect(view.fov, size.width / size.height);

  const target = useRef(new Vector3(...view.target));
  const desired = useRef(new Vector3(...view.position));
  const current = useRef(new Vector3(...view.target));
  const angle = useRef(Math.atan2(view.position[2], view.position[0]));
  const offset = useRef(new Vector3());
  const framed = useRef(new Vector3());

  useEffect(() => {
    target.current.set(...view.target);
    desired.current.set(...view.position);
    angle.current = Math.atan2(view.position[2], view.position[0]);
    // A demand-rendered scene has to be told a new framing has arrived.
    invalidate();
  }, [view, invalidate]);

  // Orbit mode never runs the frame loop below, so it needs the corrected
  // focal length applied directly when the viewport changes.
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera || mode !== 'orbit') return;
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
    invalidate();
  }, [mode, targetFov, invalidate]);

  // Portrait recomposition. See `PORTRAIT_FRUSTUM`: on a phone the subject
  // is lifted into the upper part of the frame so the copy below it sits in
  // negative space rather than over the architecture.
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const portrait = size.width / size.height < PORTRAIT_ASPECT;
    if (portrait) {
      const full = size.height * PORTRAIT_FRUSTUM;
      camera.setViewOffset(
        size.width,
        full,
        0,
        size.height * PORTRAIT_OFFSET,
        size.width,
        size.height,
      );
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    invalidate();

    return () => {
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [size.width, size.height, invalidate]);

  useFrame((_state, delta) => {
    const camera = cameraRef.current;
    if (!camera || mode === 'orbit') return;

    // Clamp the step so a backgrounded tab returning does not teleport.
    const step = Math.min(delta, 0.1);

    if (mode === 'cinematic') {
      const radius = Math.hypot(view.position[0], view.position[2]);
      if (!reducedMotion) angle.current += driftSpeed * step;
      desired.current.set(
        Math.cos(angle.current) * radius,
        view.position[1],
        Math.sin(angle.current) * radius,
      );
    }

    framed.current.copy(desired.current);

    // Parallax is applied perpendicular to the view axis, so the camera
    // slides across the subject rather than pushing into it.
    if (parallax > 0 && !reducedMotion) {
      const forward = offset.current.copy(target.current).sub(desired.current).normalize();
      const right = offset.current.set(forward.z, 0, -forward.x).normalize();
      framed.current.addScaledVector(right, pointer.x * parallax);
      framed.current.y += pointer.y * parallax * 0.45;
    }

    const smoothing = mode === 'journey' ? 0.0015 : 0.001;
    camera.position.lerp(framed.current, 1 - Math.pow(smoothing, step));

    // Easing the look-at target as well is what keeps a long move reading as
    // a single camera gesture instead of a pan snapped onto a dolly.
    current.current.set(
      damp(current.current.x, target.current.x, smoothing, step),
      damp(current.current.y, target.current.y, smoothing, step),
      damp(current.current.z, target.current.z, smoothing, step),
    );
    camera.lookAt(current.current);

    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = damp(camera.fov, targetFov, smoothing, step);
      camera.updateProjectionMatrix();
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={targetFov}
        near={0.1}
        far={260}
        position={view.position}
      />
      {mode === 'orbit' ? (
        <OrbitControls
          makeDefault
          target={view.target}
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          // Rotation is deliberately bounded: an architectural camera stays
          // above the horizon and outside the building envelope.
          minDistance={24}
          maxDistance={130}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.15}
          rotateSpeed={0.55}
          zoomSpeed={0.6}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.25}
        />
      ) : null}
    </>
  );
}
