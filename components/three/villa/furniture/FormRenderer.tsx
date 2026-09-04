'use client';

import { useEffect, useMemo } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMaterials } from '@/lib/three/materials';
import type { Material } from 'three';
import { createFolds, createSoftBox, createTurned } from './SoftGeometry';
import type { Form, FormMaterial } from './FormTypes';

/**
 * Draws every soft, turned and folded form in the scene, one merged mesh
 * per material.
 *
 * This is the same bargain `MergedBoxes` already makes and for the same
 * reason: a furnished residence contains several hundred of these, and at
 * one draw call each the furniture alone would cost more than the entire
 * building. Sorting by material instead of by piece keeps a house full of
 * rounded, sagging, turned geometry inside roughly a dozen calls.
 *
 * Shadow casting is decided per material group rather than per form,
 * because that is the granularity a merged mesh can express. The two forms
 * that must not cast — sheers, which would shadow the room they are meant
 * to fill with light, and emissive faces — are already separate materials.
 */
const NEVER_CASTS: ReadonlySet<FormMaterial> = new Set(['sheer', 'glow']);
const NEVER_RECEIVES: ReadonlySet<FormMaterial> = new Set(['glow']);

/**
 * Form material names to entries in the shared cache. Explicit rather than
 * an index, because the two vocabularies are deliberately different: forms
 * name what a piece is *made of* and the cache names surfaces of the
 * building, so `glow` is the emissive face and `wood` is the dark timber
 * the entrance leaf uses.
 */
const MATERIAL_KEY: Record<FormMaterial, keyof ReturnType<typeof getMaterials>> = {
  joinery: 'joinery',
  wood: 'wood',
  upholstery: 'upholstery',
  upholsteryDark: 'upholsteryDark',
  marble: 'marble',
  stone: 'interiorStone',
  bronze: 'bronze',
  darkMetal: 'darkMetal',
  frameMetal: 'frameMetal',
  ceramic: 'ceramic',
  rug: 'rug',
  drapery: 'drapery',
  sheer: 'sheer',
  glow: 'lightGlow',
  plaster: 'plaster',
  paper: 'paper',
  glazing: 'glazing',
  indoorFoliage: 'indoorFoliage',
};

/**
 * Builds one form's geometry, always non-indexed.
 *
 * The three primitives disagree about indexing — a soft box inherits the
 * icosphere's non-indexed triangle soup, while lathes and fold surfaces are
 * indexed — and `mergeGeometries` requires every input to agree. Rather
 * than index the soft box (whose vertices are genuinely unshared once sag
 * and creasing move them), everything is flattened to the common form.
 */
function build(form: Form): BufferGeometry {
  const geometry = buildRaw(form);
  if (!geometry.getIndex()) return geometry;
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  return flat;
}

function buildRaw(form: Form): BufferGeometry {
  switch (form.kind) {
    case 'soft':
      return createSoftBox(form.size[0], form.size[1], form.size[2], {
        radius: form.radius,
        detail: form.detail,
        sag: form.sag,
        crease: form.crease,
        seed: form.seed,
        taper: form.taper,
      });
    case 'turned':
      return createTurned(form.profile, form.segments);
    case 'fold':
      return createFolds({
        width: form.width,
        height: form.height,
        depth: form.depth,
        pleats: form.pleats,
        rows: form.rows,
        seed: form.seed,
      });
  }
}

export function FormRenderer({ name, forms }: { name: string; forms: readonly Form[] }) {
  const materials = getMaterials();

  const groups = useMemo(() => {
    const byMaterial = new Map<FormMaterial, BufferGeometry[]>();

    const quaternion = new Quaternion();
    const euler = new Euler();
    const matrix = new Matrix4();
    const scale = new Vector3(1, 1, 1);
    const position = new Vector3();

    for (const form of forms) {
      const geometry = build(form);
      // Tilt then yaw, in the piece's own frame — a lounger back is raked
      // about its own axis and then the whole chair is turned to face the
      // pool, which is the order the two are authored in.
      euler.set(form.tiltX ?? 0, form.rotationY ?? 0, 0, 'YXZ');
      quaternion.setFromEuler(euler);
      position.fromArray(form.position);
      matrix.compose(position, quaternion, scale);
      geometry.applyMatrix4(matrix);

      const bucket = byMaterial.get(form.material);
      if (bucket) bucket.push(geometry);
      else byMaterial.set(form.material, [geometry]);
    }

    const merged: { material: FormMaterial; geometry: BufferGeometry }[] = [];
    for (const [material, parts] of byMaterial) {
      const geometry = mergeGeometries(parts, false);
      parts.forEach((part) => part.dispose());
      if (geometry) merged.push({ material, geometry });
    }
    return merged;
  }, [forms]);

  useEffect(
    () => () => {
      groups.forEach((group) => group.geometry.dispose());
    },
    [groups],
  );

  return (
    <group name={name}>
      {groups.map((group) => (
        <mesh
          key={group.material}
          name={`${name}-${group.material}`}
          geometry={group.geometry}
          material={materials[MATERIAL_KEY[group.material]] as Material}
          castShadow={!NEVER_CASTS.has(group.material)}
          receiveShadow={!NEVER_RECEIVES.has(group.material)}
        />
      ))}
    </group>
  );
}

export default FormRenderer;
