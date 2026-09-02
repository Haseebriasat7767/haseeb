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
const MAX_FOV = 78;

/**
 * Widens the focal length on narrower viewports. Three's field of view is
 * vertical, so a portrait phone would otherwise crop a composed elevation
 * down its sides — the building has to stay in frame on a phone without
 * every view needing a second set of numbers for it.
 */
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
