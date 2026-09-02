'use client';

import { useEffect, useMemo } from 'react';
import {
  Color,
  DoubleSide,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RGBADepthPacking,
  Vector3,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { ATLAS_CELL_SCALE, ATLAS_CELLS, getFoliageAtlas } from './FoliageAtlas';
import { registerAoExclusion } from '../../post/aoExclusions';
import type { FoliageCard } from './FoliageGeometry';

/**
 * Alpha below which a foliage texel is cut away. High enough to keep the
 * silhouette crisp through the mip chain, low enough that thinning edges do
 * not dissolve at distance.
 */
const FOLIAGE_ALPHA_CUTOFF = 0.38;

type FoliageCardsProps = {
  name: string;
  cards: readonly FoliageCard[];
  /** Alpha-tested shadows are affordable only on the top tier. */
  castShadow?: boolean;
};

/**
 * Every foliage card in one instanced mesh — one draw call for a canopy of
 * any size.
 *
 * ## Alpha testing, not blending
 *
 * The material is opaque with `alphaTest`. That is the whole reason this
 * technique is affordable: a cut-out writes depth like any solid surface,
 * so cards need no sorting, produce no order-dependent artefacts where two
 * crowns overlap, and cast a real shadow through three's depth material,
 * which copies `map` and `alphaTest` across on its own. Blended foliage
 * would need per-card sorting and would still show seams wherever two
 * cards from different trees crossed.
 *
 * ## Four variants in one draw call
 *
 * `InstancedMesh` has no per-instance UV, so a four-cell atlas would
 * normally mean four meshes. A single instanced attribute carrying each
 * card's atlas offset, plus three lines patched into the shader, keeps it
 * at one — the same `onBeforeCompile` technique the material library
 * already uses for its surface variation.
 */
/**
 * Redirects a material's texture lookup through the per-instance atlas cell.
 *
 * Applied to the lit material *and* to a matching depth material. That
 * second application is not optional: three builds the shadow pass from its
 * own `MeshDepthMaterial`, copying `map` and `alphaTest` across but knowing
 * nothing about a custom shader. Without it every card sampled the whole
 * atlas over its own quad, found leaves almost everywhere, and cast a solid
 * rectangular shadow — which is exactly how the first version looked: a
 * tree wearing a stack of grey playing cards.
 */
function patchAtlasLookup(material: Material, cacheKey: string): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aAtlasOffset;
varying vec2 vAtlasOffset;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
  vAtlasOffset = aAtlasOffset;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vAtlasOffset;`)
      .replace(
        '#include <map_fragment>',
        `{
    vec4 sampledDiffuseColor = texture2D(map, vMapUv * ${ATLAS_CELL_SCALE.toFixed(2)} + vAtlasOffset);
    // The cut-out is done here, on the sample, rather than left to the
    // stock alpha-test chunk further down. Relying on that chunk did not
    // work: the atlas measured 87% transparent and the cards still rendered
    // as solid rectangles, so whatever USE_ALPHATEST was resolving to,
    // the discard was not reaching the shader. Testing the texel the moment
    // it is read depends on no define at all and is one instruction earlier
    // besides.
    if (sampledDiffuseColor.a < ${FOLIAGE_ALPHA_CUTOFF.toFixed(2)}) discard;
    diffuseColor *= sampledDiffuseColor;
  }`,
      );
  };

  material.customProgramCacheKey = () => `aurelia-foliage-${cacheKey}`;
}

export function FoliageCards({ name, cards, castShadow = false }: FoliageCardsProps) {
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);

  const material = useMemo(() => {
    const standard = new MeshStandardMaterial({
      map: getFoliageAtlas(),
      // Both faces: a leaf is thin, and a card lit only from one side goes
      // black the moment the sun is behind the tree.
      side: DoubleSide,
      alphaTest: FOLIAGE_ALPHA_CUTOFF,
      transparent: false,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.55,
    });

    patchAtlasLookup(standard, 'lit');
    return standard;
  }, []);

  const depthMaterial = useMemo(() => {
    const depth = new MeshDepthMaterial({
      depthPacking: RGBADepthPacking,
      map: getFoliageAtlas(),
      alphaTest: FOLIAGE_ALPHA_CUTOFF,
    });
    patchAtlasLookup(depth, 'depth');
    return depth;
  }, []);

  const mesh = useMemo(() => {
    const instanced = new InstancedMesh(geometry, material, Math.max(1, cards.length));
    instanced.name = name;
    instanced.castShadow = castShadow;
    // The shadow pass has to sample the same atlas cell the lit pass does.
    instanced.customDepthMaterial = depthMaterial;
    instanced.receiveShadow = true;
    instanced.frustumCulled = true;

    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();
    const tint = new Color();
    const offsets = new Float32Array(Math.max(1, cards.length) * 2);

    cards.forEach((card, index) => {
      position.set(...card.position);
      euler.set(card.rotation[0], card.rotation[1], card.rotation[2]);
      quaternion.setFromEuler(euler);
      scale.set(card.size[0], card.size[1], 1);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(index, matrix);
      instanced.setColorAt(index, tint.setRGB(...card.tint));

      const cell = ATLAS_CELLS[card.cell % ATLAS_CELLS.length]!;
      offsets[index * 2] = cell[0];
      offsets[index * 2 + 1] = cell[1];
    });

    instanced.count = cards.length;
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    instanced.geometry.setAttribute('aAtlasOffset', new InstancedBufferAttribute(offsets, 2));
    instanced.computeBoundingSphere();
    return instanced;
  }, [cards, geometry, material, depthMaterial, name, castShadow]);

  // Foliage is kept out of the ambient-occlusion prepass; see
  // `post/aoExclusions.ts` for why a cut-out card cannot take part in it.
  useEffect(() => registerAoExclusion(mesh), [mesh]);

  useEffect(() => {
    return () => {
      mesh.dispose();
    };
  }, [mesh]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      depthMaterial.dispose();
    };
  }, [geometry, material, depthMaterial]);

  if (cards.length === 0) return null;

  return <primitive object={mesh} />;
}

export default FoliageCards;
