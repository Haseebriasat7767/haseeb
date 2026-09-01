'use client';

import { useEffect, useMemo } from 'react';
import {
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BladeSpec, BlobSpec, BranchSpec } from './LandscapeTypes';

/**
 * A stateless per-position hash in [0, 1) — not a stream. Vertex
 * deformation must key off each vertex's own coordinates rather than a
 * sequential RNG: adjacent icosahedron faces share corner vertices, and a
 * stream would displace each shared corner differently and crack the mesh.
 * The same position always hashes to the same value, so shared corners
 * deform identically.
 */
function hashVertex(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.001) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * An irregular low-poly blob: an icosahedron with each vertex pushed in or
 * out along its own direction from centre, by an amount keyed to its
 * position — so it reads as a rounded, hand-shaped volume rather than a
 * perfect sphere, at the cost of one cheap primitive.
 */
function deformedIcosahedron(spec: BlobSpec): BufferGeometry {
  const geometry = new IcosahedronGeometry(spec.radius, spec.detail);
  const position = geometry.getAttribute('position');
  const v = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const factor = 1 + (hashVertex(v.x, v.y, v.z, spec.seed) - 0.5) * 2 * spec.deform;
    v.multiplyScalar(factor);
    position.setXYZ(i, v.x, v.y, v.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.scale(...spec.scale);
  geometry.translate(...spec.position);
  return geometry;
}

/** A tapered cylinder oriented and positioned between two arbitrary points. */
function cylinderBetween(spec: BranchSpec): BufferGeometry | null {
  const start = new Vector3(...spec.from);
  const end = new Vector3(...spec.to);
  const direction = new Vector3().subVectors(end, start);
  const length = direction.length();
  if (length <= 0.001) return null;

  const geometry = new CylinderGeometry(spec.topRadius, spec.bottomRadius, length, 6, 1);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.normalize(),
  );
  geometry.applyQuaternion(quaternion);
  const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
  geometry.translate(mid.x, mid.y, mid.z);
  return geometry;
}

/** A single flat-tapered blade, growing up from its base. */
function bladeGeometry(spec: BladeSpec): BufferGeometry {
  const geometry = new ConeGeometry(spec.width / 2, spec.height, 3, 1, false);
  geometry.translate(0, spec.height / 2, 0);
  geometry.rotateZ(spec.tilt);
  geometry.rotateY(spec.rotationY);
  geometry.translate(...spec.position);
  return geometry;
}

type MergedProps<T> = {
  specs: readonly T[];
  material: Material;
  name: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

/** Renders deformed-icosahedron blobs — canopy, shrubs, and rocks. */
export function MergedBlobs({
  specs,
  material,
  name,
  castShadow = true,
  receiveShadow = true,
}: MergedProps<BlobSpec>) {
  const geometry = useMemo<BufferGeometry | null>(() => {
    if (specs.length === 0) return null;
    const parts = specs.map(deformedIcosahedron);
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return merged;
  }, [specs]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <mesh
      name={name}
      geometry={geometry}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** Renders trunk and branch segments as oriented tapered cylinders. */
export function MergedBranches({
  specs,
  material,
  name,
  castShadow = true,
  receiveShadow = true,
}: MergedProps<BranchSpec>) {
  const geometry = useMemo<BufferGeometry | null>(() => {
    if (specs.length === 0) return null;
    const parts = specs.map(cylinderBetween).filter((g): g is BufferGeometry => g !== null);
    if (parts.length === 0) return null;
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return merged;
  }, [specs]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <mesh
      name={name}
      geometry={geometry}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** Renders grass blades as merged tapered cones — one draw call for every blade on site. */
export function MergedBlades({ specs, material, name }: MergedProps<BladeSpec>) {
  const geometry = useMemo<BufferGeometry | null>(() => {
    if (specs.length === 0) return null;
    const parts = specs.map(bladeGeometry);
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return merged;
  }, [specs]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return <mesh name={name} geometry={geometry} material={material} receiveShadow />;
}
