'use client';

import { useEffect, useMemo } from 'react';
import {
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Vector3Tuple,
} from 'three';
import { registerAoExclusion } from './post/aoExclusions';
import { getDecalSheet } from './textures/DecalMaps';

/**
 * One hung work: a canvas face, on a wall, at a size.
 *
 * `rotationY` follows the decal convention, not the model one — a plane faces
 * +Z unrotated, where a glTF piece authored in Blender faces −Z. The two sit
 * a few lines apart in this codebase and mean different things, which is
 * exactly why each says so.
 */
export type ArtworkPlacement = {
  key: string;
  /** File under `/assets/decals/artwork`, without extension. */
  art: string;
  position: Vector3Tuple;
  size: [number, number];
  rotationY: number;
};

/**
 * DEC-03. The pictures on the apartment walls.
 *
 * ## One mesh per image, not per picture
 *
 * Every other decal in the building shares one atlas and one draw call. These
 * cannot: each is a different image, and six images are six textures. That is
 * the correct trade — a painting is the one decal a viewer stops and looks at,
 * and putting six of them on a single sheet would spend a quarter of the
 * resolution each.
 *
 * But a mesh per PICTURE is a different thing from a mesh per IMAGE, and it
 * only stopped being free when the whole tower was fitted out: five works on
 * each of fourteen floors is seventy meshes and seventy materials for six
 * pictures. So the placements are grouped by the image they carry and each
 * group is one instance batch — six draw calls whether the building has one
 * furnished floor or fifteen.
 *
 * ## What they are
 *
 * Original abstract compositions, authored as node graphs by
 * `tools/blender/decals.py` and rendered flat. Not photographs of anything,
 * not derived from any existing work, and so not a licensing question at all —
 * which is the whole reason to author them rather than source them. The
 * schedule's line on DEC-03 is "must be licensed to you"; authoring is the
 * cheapest way to satisfy it and the only way to satisfy it with certainty.
 */
const UP = new Vector3(0, 1, 0);

export function ArtworkPanels({
  name,
  works,
}: {
  name: string;
  works: readonly ArtworkPlacement[];
}) {
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);

  const meshes = useMemo(() => {
    const byArt = new Map<string, ArtworkPlacement[]>();
    for (const work of works) {
      const group = byArt.get(work.art);
      if (group) group.push(work);
      else byArt.set(work.art, [work]);
    }

    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();

    return [...byArt.entries()].map(([art, group]) => {
      const material = new MeshStandardMaterial({
        map: getDecalSheet(`/assets/decals/artwork/${art}.jpg`),
        // A canvas is matte and takes no reflection worth speaking of. Any
        // gloss here reads as a framed print behind glass, which is a
        // different object with a different price.
        roughness: 0.92,
        metalness: 0,
        envMapIntensity: 0.35,
        // Both faces: these hang on partitions the cameras pass on either
        // side of, and a single-sided canvas seen from behind is a hole.
        side: DoubleSide,
      });
      const mesh = new InstancedMesh(geometry, material, group.length);
      mesh.name = `${name}-${art}`;
      group.forEach((work, index) => {
        position.set(...work.position);
        quaternion.setFromAxisAngle(UP, work.rotationY);
        scale.set(work.size[0], work.size[1], 1);
        mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // The batch spans a whole tower, so its own bounds are the building's.
      // Without this three culls it by the first instance's box and the
      // pictures wink out as soon as that one leaves frame.
      mesh.computeBoundingSphere();
      return mesh;
    });
  }, [works, geometry, name]);

  // Out of the ambient-occlusion prepass, like the decals and the foliage.
  // A canvas hangs five centimetres off its wall, which the prepass reads as
  // a crevice and fills solid — the picture came back black with the AO
  // buffer's own stair-stepped edge across it, and the image underneath was
  // never the problem.
  useEffect(() => {
    const undo = meshes.map((mesh) => registerAoExclusion(mesh));
    return () => {
      for (const off of undo) off();
    };
  }, [meshes]);

  useEffect(
    () => () => {
      for (const mesh of meshes) {
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.dispose();
      }
    },
    [meshes],
  );
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return (
    <group name={name}>
      {meshes.map((mesh) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
    </group>
  );
}

export default ArtworkPanels;
