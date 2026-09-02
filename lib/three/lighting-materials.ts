import { getMaterials } from './materials';
import type { LightingState } from './lighting';

/**
 * Pushes the hour into the shared material library. A handful of surfaces —
 * lit fixture faces, glazing, the pool basin — belong to the time of day
 * rather than to themselves, and this is the single place that decides so.
 *
 * It mutates the existing singletons from `getMaterials()` rather than
 * building a second set: no new material is allocated, no shader is
 * recompiled (none of these properties is part of a program cache key), and
 * `disposeMaterials()` still releases everything.
 */
export function applyLightingToMaterials(state: LightingState): void {
  const materials = getMaterials();

  materials.lightGlow.emissiveIntensity = state.surfaces.fixtureEmissive;
  materials.glazing.opacity = state.surfaces.glazingOpacity;
  materials.poolWater.emissiveIntensity = state.surfaces.poolGlow;
  materials.poolInterior.emissiveIntensity = state.surfaces.poolGlow * 0.4;
}
