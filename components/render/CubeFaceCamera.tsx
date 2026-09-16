'use client';

import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { PerspectiveCamera } from 'three';
import { CUBE_FACES, CUBE_FACE_FOV, type CubeFaceId } from '@/lib/pano/cube-faces';

/**
 * Points the scene camera at one cube face.
 *
 * Mounted inside the canvas, because the thing it has to set — `camera.up`
 * before `lookAt` — has no expression in the `CameraView` record the rest of
 * the site frames shots with. A `CameraView` is position plus target, which
 * is fine for every framing a person looks at, and degenerate for exactly
 * the two this needs: looking straight up or straight down leaves `lookAt`
 * with a direction parallel to the default up vector and no defined roll.
 */
export type CubeFaceCameraProps = {
  /** Cube centre. Must be the space's own `view.position` — see below. */
  centre: readonly [number, number, number];
  face: CubeFaceId;
};

export function CubeFaceCamera({ centre, face }: CubeFaceCameraProps) {
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    const entry = CUBE_FACES.find((candidate) => candidate.id === face);
    if (!entry || !(camera instanceof PerspectiveCamera)) return;

    const [dx, dy, dz] = entry.dir;
    const [ux, uy, uz] = entry.up;
    const [cx, cy, cz] = centre;

    // The cube centre is the space's authored camera position, exactly. The
    // hotspot bearings in `lib/pano/hotspots.ts` are measured from that same
    // record, so any other point here silently falsifies every door in this
    // room — by an amount nothing in the running site could detect.
    camera.position.set(cx, cy, cz);

    // `up` before `lookAt`: three reads `camera.up` inside it. This is what
    // a yaw/pitch Euler cannot express for the pole faces.
    camera.up.set(ux, uy, uz);
    camera.lookAt(cx + dx, cy + dy, cz + dz);

    // 90°, square. Not the space's browse fov — six faces at any other
    // angle do not tile. Aspect is forced rather than trusted: R3F derives
    // it from the container, and a container that is not square would bake
    // a wrong projection into every face.
    camera.fov = CUBE_FACE_FOV;
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }, [camera, centre, face]);

  return null;
}
