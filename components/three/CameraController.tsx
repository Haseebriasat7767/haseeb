'use client';

import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { PerspectiveCamera as ThreePerspectiveCamera, Vector3 } from 'three';
import type { CameraMode, CameraView } from '@/types';

type CameraControllerProps = {
  view: CameraView;
  mode?: CameraMode;
  /** Cinematic mode only: radians per second of slow orbital drift. */
  driftSpeed?: number;
  reducedMotion?: boolean;
};

/**
 * Owns all camera behaviour so pages never touch the camera directly.
 * `orbit` hands control to the user, `cinematic` drifts around the target,
 * `fixed` simply holds the framing. Switching views tweens the position.
 */
export function CameraController({
  view,
  mode = 'orbit',
  driftSpeed = 0.05,
  reducedMotion = false,
}: CameraControllerProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const target = useRef(new Vector3(...view.target));
  const desired = useRef(new Vector3(...view.position));
  const angle = useRef(Math.atan2(view.position[2], view.position[0]));

  useEffect(() => {
    target.current.set(...view.target);
    desired.current.set(...view.position);
    angle.current = Math.atan2(view.position[2], view.position[0]);
  }, [view]);

  useFrame((_state, delta) => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (mode === 'cinematic') {
      const radius = Math.hypot(view.position[0], view.position[2]);
      if (!reducedMotion) angle.current += driftSpeed * delta;
      desired.current.set(
        Math.cos(angle.current) * radius,
        view.position[1],
        Math.sin(angle.current) * radius,
      );
    }

    if (mode !== 'orbit') {
      // Critically-damped approach keeps view changes smooth and frame-rate
      // independent without pulling in an animation library.
      camera.position.lerp(desired.current, 1 - Math.pow(0.001, delta));
      camera.lookAt(target.current);
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={view.fov}
        near={0.1}
        far={200}
        position={view.position}
      />
      {mode === 'orbit' ? (
        <OrbitControls
          makeDefault
          target={view.target}
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={24}
          maxDistance={130}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.15}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.25}
        />
      ) : null}
    </>
  );
}
