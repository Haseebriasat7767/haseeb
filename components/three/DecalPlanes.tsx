'use client';

import { useEffect, useMemo } from 'react';
import {
  Color,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Vector3Tuple,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { getDecalSheet, type AtlasRect } from './textures/DecalMaps';
import { registerAoExclusion } from './post/aoExclusions';

/**
 * One decal: a quad somewhere on the building, showing one cell of a sheet.
 *
 * `rotationY` is the only rotation exposed because every decal in this
 * building is upright on a vertical surface. A plane faces +Z unrotated, so
 * the four elevations are 0, pi, pi/2 and -pi/2 — the same convention
 * `ApartmentGeometry`'s `FACE` table already uses, for the same reason.
 */
export type DecalSpec = {
  key: string;
  /** Centre of the quad, in world metres. */
  position: Vector3Tuple;
  /** Width and height in metres. */
  size: [number, number];
  rotationY: number;
  cell: AtlasRect;
};

/**
 * Alpha below which a decal texel is cut away. Lower than the foliage
 * cutoff: a serif's hairline is genuinely a partial texel at distance, and
 * cutting at the same threshold a leaf uses eats the thin strokes off
 * Cormorant entirely by the third mip.
 */
const DECAL_ALPHA_CUTOFF = 0.22;

/**
 * Redirects the material's texture lookups through the per-instance cell.
 *
 * The same `onBeforeCompile` technique the foliage cards use, with one
 * addition: the emissive lookup is patched as well as the diffuse one. Both
 * sample the same sheet, and if only the first is redirected then by night
 * every sign in the building glows with the whole atlas — sixteen tenant
 * names stacked on top of each other — while showing the correct one.
 */
function patchAtlasLookup(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aDecalCell;
varying vec4 vDecalCell;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
  vDecalCell = aDecalCell;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vDecalCell;`)
      .replace(
        '#include <map_fragment>',
        `{
    vec4 sampled = texture2D(map, vMapUv * vDecalCell.zw + vDecalCell.xy);
    // Cut here, on the sample, rather than leaving it to the stock alpha
    // chunk further down — the same reason the foliage material does it.
    if (sampled.a < ${DECAL_ALPHA_CUTOFF.toFixed(2)}) discard;
    diffuseColor *= sampled;
  }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `{
    vec4 emissiveTexel = texture2D(emissiveMap, vEmissiveMapUv * vDecalCell.zw + vDecalCell.xy);
    totalEmissiveRadiance *= emissiveTexel.rgb * emissiveTexel.a;
  }`,
      );
  };

  material.customProgramCacheKey = () => 'aurelia-decal';
}

type DecalPlanesProps = {
  name: string;
  sheet: string;
  decals: readonly DecalSpec[];
  /**
   * How brightly the lettering carries its own light. Signage and the crown
   * are illuminated; a painted level number on a wall is not.
   */
  emissiveIntensity?: number;
  /**
   * What colour the lettering is in daylight.
   *
   * The sheets are baked warm white and carry no colour decision, so this is
   * where one gets made. Shopfront signage stays near-white — it sits on
   * glass and in shade. The crown does not: cut lettering on a pale stone
   * parapet is bronze or dark metal in every building this one is drawn
   * from, and warm white on warm cream at 130 m is not lettering, it is a
   * slightly different cream.
   */
  tint?: string;
};

/**
 * Every decal on one sheet, in a single instanced draw call.
 *
 * ## Why these are not just textured boxes
 *
 * A decal is the one thing in this project that genuinely wants a plane. It
 * has no thickness to model, it must not cast a shadow — an illuminated
 * letter that throws one reads as a cut-out taped to the wall — and the whole
 * point of it is a cut alpha, which the merged-box primitives have no path
 * for. Instancing keeps the count honest: fifty shopfront signs and a
 * wayfinding scheme cost two draw calls between them.
 *
 * ## Why they are emissive
 *
 * The sheet is carried twice, as `map` and as `emissiveMap`. By day the
 * emissive term is swamped by the sun and the sign reads as paint; after dark
 * it is most of what is left, and the podium picks up the row of lit fascias
 * a retail street actually has. The project's `lightStrip` material makes the
 * same bargain and for the same reason: nothing here re-reads the hour, and
 * exposure does the rest.
 */
export function DecalPlanes({
  name,
  sheet,
  decals,
  emissiveIntensity = 0.5,
  tint = '#f0eade',
}: DecalPlanesProps) {
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);

  const material = useMemo(() => {
    const texture = getDecalSheet(sheet);
    const standard = new MeshStandardMaterial({
      map: texture,
      color: new Color(tint),
      emissiveMap: texture,
      emissive: new Color('#ffe9cf'),
      emissiveIntensity,
      alphaTest: DECAL_ALPHA_CUTOFF,
      transparent: false,
      roughness: 0.62,
      metalness: 0,
      envMapIntensity: 0.5,
      // Coplanar with the surface it sits on would z-fight; the placements
      // hold it a few centimetres proud instead, and this closes the rest.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    patchAtlasLookup(standard);
    return standard;
  }, [sheet, emissiveIntensity, tint]);

  const mesh = useMemo(() => {
    const instanced = new InstancedMesh(geometry, material, Math.max(1, decals.length));
    instanced.name = name;
    // A letter has no thickness and casts no shadow. One that does reads as
    // a card held off the wall, which is the exact opposite of a decal.
    instanced.castShadow = false;
    instanced.receiveShadow = false;
    instanced.frustumCulled = true;

    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();
    const cells = new Float32Array(Math.max(1, decals.length) * 4);

    decals.forEach((decal, index) => {
      position.set(...decal.position);
      euler.set(0, decal.rotationY, 0);
      quaternion.setFromEuler(euler);
      scale.set(decal.size[0], decal.size[1], 1);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(index, matrix);
      cells.set(decal.cell, index * 4);
    });

    instanced.count = decals.length;
    instanced.instanceMatrix.needsUpdate = true;
    instanced.geometry.setAttribute('aDecalCell', new InstancedBufferAttribute(cells, 4));
    instanced.computeBoundingSphere();
    return instanced;
  }, [decals, geometry, material, name]);

  // Kept out of the ambient-occlusion prepass for the same reason foliage is:
  // the prepass sees the quad, not the cut letter, and darkens a rectangle of
  // wall around every sign.
  useEffect(() => registerAoExclusion(mesh), [mesh]);

  useEffect(
    () => () => {
      mesh.dispose();
    },
    [mesh],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  if (decals.length === 0) return null;

  return <primitive object={mesh} />;
}

export default DecalPlanes;
