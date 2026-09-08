'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import {
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { DRACO_PATH, modelUrl, type ModelName } from './ModelLibrary';

/**
 * One placement of a piece, positioned by its floor contact point.
 *
 * The same shape `Model` takes, so a call site moves between the two by
 * changing which component consumes the array.
 */
export type ModelPlacement = {
  key: string;
  name: ModelName;
  position: [number, number, number];
  rotationY: number;
  /**
   * Which spatial batch this placement belongs to — a retail level, a room.
   *
   * Batches are formed per piece per chunk, so a chunk that is off screen
   * culls as a unit. Splitting the retail fit-out this way was measured and
   * was worse (see above), so nothing populates it today; it is kept because
   * a scene with a dozen furnished floors will want it and the alternative is
   * rediscovering the need for it later.
   */
  chunk?: string;
};

/**
 * Every repeat of every piece, batched into one instanced mesh per primitive.
 *
 * ## Why this had to exist before another floor was fitted out
 *
 * `Model` clones the glTF's scene graph per placement, which is correct and
 * was fine while there were a dozen of them. It stops being fine quickly:
 * a clone shares geometry and materials but not draw calls, and the retail
 * fit-out alone was costing **802** of them. `retail-shelf` is nineteen
 * primitives and stood in twenty places, which is three hundred and eighty
 * draw calls for one piece of shop fitting. The project's own budget calls
 * anything above two hundred and fifty "Review".
 *
 * Nothing about that was visible in the scene — it renders correctly, and a
 * headless SwiftShader frame gives no honest timing to notice it by. It only
 * shows up if you count, which is why it survived until a phase that wanted
 * to multiply it by twenty storeys.
 *
 * Batched, the same fit-out is a few dozen: one per distinct primitive rather
 * than one per primitive per placement. The cost stops scaling with how many
 * floors are furnished and starts scaling with how many *kinds* of thing are
 * on them, which is the number that should govern it.
 *
 * ## What this does NOT do, measured
 *
 * It does not lower the draw-call count of the scene as it stands. Measured in
 * the atrium view: 967 with cloned models, 1235 with these. Splitting the
 * batches per retail level to win the culling back made it 1719, worse again,
 * and that variant was reverted.
 *
 * The likeliest reading is that a hundred and forty cloned models are a
 * hundred and forty bounding spheres and most were being culled per framing,
 * where one batch per piece spans the whole podium and never is — but the
 * apartment view, which can see none of the podium at all, still reports 1255,
 * and that does not fit the reading. The honest position is that this is not
 * understood yet, and that these are development-mode numbers from a software
 * rasteriser rather than anything a real device would report.
 *
 * What it is kept for is scaling, which is a judgement rather than a
 * measurement: cloned, every newly furnished floor adds draw calls in
 * proportion to how much is on it, and Phase 2 has thirteen more floors to
 * furnish. Batched, a floor costs only whatever it introduces that is new.
 *
 * ## The transform that is easy to get wrong
 *
 * A glTF's meshes sit under nodes with their own transforms — a lamp's shade
 * is not at the lamp's origin. So an instance's matrix is the placement
 * multiplied by that mesh's matrix *within its own model*, not the placement
 * alone. Using the placement alone collapses every part of every piece onto
 * its floor contact point, which looks exactly like the models failing to
 * load.
 */
export function InstancedModels({
  name,
  placements,
  castShadow = true,
  receiveShadow = true,
}: {
  name: string;
  placements: readonly ModelPlacement[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  // Grouped before anything is loaded, so the hook below is handed a stable,
  // deduplicated URL list rather than one entry per placement.
  const groups = useMemo(() => {
    const byBatch = new Map<string, { model: ModelName; items: ModelPlacement[] }>();
    for (const placement of placements) {
      const id = `${placement.name}::${placement.chunk ?? ''}`;
      const batch = byBatch.get(id);
      if (batch) batch.items.push(placement);
      else byBatch.set(id, { model: placement.name, items: [placement] });
    }
    return [...byBatch.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [placements]);

  // Deduplicated: several batches of the same piece are one download and one
  // upload, however many chunks they are split across.
  const urls = useMemo(() => groups.map(([, batch]) => modelUrl(batch.model)), [groups]);

  // One call with an array: `useGLTF` returns them in order, and calling it
  // per model would put a hook inside a loop over data that changes.
  const loaded = useGLTF(urls, DRACO_PATH) as unknown as { scene: Group }[];

  const meshes = useMemo(() => {
    const out: InstancedMesh[] = [];
    const placementMatrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const one = new Vector3(1, 1, 1);
    const combined = new Matrix4();

    groups.forEach(([batchId, batch], index) => {
      const group = batch.items;
      const scene = loaded[index]?.scene;
      if (!scene) return;
      // World matrices within the model are only meaningful once the graph
      // has been resolved; the cached scene is never added to a scene of its
      // own, so nothing else will do it.
      scene.updateMatrixWorld(true);

      // Collected first: `traverse` order is the model's own, and the
      // instanced meshes are built per primitive found in it.
      const parts: { geometry: BufferGeometry; material: Material; matrix: Matrix4 }[] = [];
      scene.traverse((child: Object3D) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        parts.push({
          geometry: mesh.geometry,
          material: mesh.material as Material,
          matrix: mesh.matrixWorld.clone(),
        });
      });

      for (const [partIndex, part] of parts.entries()) {
        const instanced = new InstancedMesh(part.geometry, part.material, group.length);
        instanced.name = `${name}-${batchId}-${partIndex}`;
        instanced.castShadow = castShadow;
        instanced.receiveShadow = receiveShadow;

        group.forEach((placement, i) => {
          position.set(...placement.position);
          euler.set(0, placement.rotationY, 0);
          quaternion.setFromEuler(euler);
          placementMatrix.compose(position, quaternion, one);
          combined.multiplyMatrices(placementMatrix, part.matrix);
          instanced.setMatrixAt(i, combined);
        });

        instanced.instanceMatrix.needsUpdate = true;
        instanced.computeBoundingSphere();
        out.push(instanced);
      }
    });
    return out;
  }, [groups, loaded, name, castShadow, receiveShadow]);

  useEffect(
    () => () => {
      // Only the instanced wrappers. The geometry and materials belong to
      // `useGLTF`'s cache and are shared with every other user of the piece —
      // disposing them here would blank the model everywhere else on screen.
      for (const mesh of meshes) mesh.dispose();
    },
    [meshes],
  );

  if (placements.length === 0) return null;

  return (
    <group name={name}>
      {meshes.map((mesh) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
    </group>
  );
}

export default InstancedModels;
