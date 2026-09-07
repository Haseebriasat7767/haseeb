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
  // The architectural runs sit a little under the fittings: they are a
  // wash, not a source you look at.
  materials.lightStrip.emissiveIntensity = state.surfaces.fixtureEmissive * 0.8;
  materials.glazing.opacity = state.surfaces.glazingOpacity;
  materials.poolWater.emissiveIntensity = state.surfaces.poolGlow;
  materials.poolInterior.emissiveIntensity = state.surfaces.poolGlow * 0.4;
  // Retail glazing is lit from behind by the units themselves, so it comes
  // up harder than any architectural fitting and stays up after the tower
  // above it has gone to a handful of windows. A shopping podium at dusk is
  // the brightest thing on a street, which is the whole reason it works as
  // a base for something dark and vertical.
  materials.shopfront.emissiveIntensity = state.surfaces.fixtureEmissive * 1.35;
}
