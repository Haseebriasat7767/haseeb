import type { Object3D } from 'three';

/**
 * Objects hidden while the ambient-occlusion prepass runs.
 *
 * GTAO builds its normal buffer by setting `scene.overrideMaterial` to a
 * single `MeshNormalMaterial` — no map, no alpha test — so alpha-cut
 * geometry writes its full quad rather than its silhouette. For the foliage
 * cards that meant every leaf card contributed a solid rectangle of
 * occlusion, which showed up as grey rectangular patches hanging around
 * every tree and smeared across the wall behind them. Nothing about the
 * cards' own material could fix it; the artefact was produced by a pass
 * that never looked at that material.
 *
 * The right answer is not to make alpha-cut foliage drive a screen-space
 * occlusion term at all. Cards are hidden for the AO pass and restored
 * immediately after, so they still light, still shade, still cast their own
 * shadow, and simply do not participate in an effect that cannot represent
 * them.
 *
 * A registry rather than a scene traversal: membership changes only when
 * vegetation mounts or unmounts, and the passes run every frame.
 */
const excluded = new Set<Object3D>();

export function registerAoExclusion(object: Object3D): () => void {
  excluded.add(object);
  return () => {
    excluded.delete(object);
  };
}

/** Hides every registered object, returning those that were actually visible. */
export function hideAoExclusions(): Object3D[] {
  const hidden: Object3D[] = [];
  for (const object of excluded) {
    if (object.visible) {
      object.visible = false;
      hidden.push(object);
    }
  }
  return hidden;
}

export function restoreAoExclusions(hidden: readonly Object3D[]): void {
  for (const object of hidden) object.visible = true;
}
