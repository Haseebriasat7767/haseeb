import { BoxGeometry, CylinderGeometry } from 'three';

type VillaGeometries = {
  box: BoxGeometry;
  column: CylinderGeometry;
};

let geometryCache: VillaGeometries | null = null;

/**
 * Two unit primitives shared by every mesh in the villa — each spec is
 * applied as a transform, so the building costs two geometry allocations
 * rather than one per volume.
 */
export function getVillaGeometries(): VillaGeometries {
  geometryCache ??= {
    box: new BoxGeometry(1, 1, 1),
    column: new CylinderGeometry(1, 1, 1, 12),
  };
  return geometryCache;
}

/** Releases the shared primitives when the experience unmounts. */
export function disposeVillaGeometries(): void {
  if (!geometryCache) return;
  for (const geometry of Object.values(geometryCache)) geometry.dispose();
  geometryCache = null;
}
