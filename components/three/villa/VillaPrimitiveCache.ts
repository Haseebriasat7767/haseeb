import { BoxGeometry, CylinderGeometry, type BufferGeometry } from 'three';
import { createChamferedBox } from './ChamferedBox';

type VillaGeometries = {
  box: BoxGeometry;
  column: CylinderGeometry;
};

let geometryCache: VillaGeometries | null = null;

/**
 * Two unit primitives shared by every mesh in the villa — each spec is
 * applied as a transform, so the building costs two geometry allocations
 * rather than one per volume.
 *
 * These remain the path for anything drawn without a chamfer, which is the
 * whole scene on the low quality tier.
 */
export function getVillaGeometries(): VillaGeometries {
  geometryCache ??= {
    box: new BoxGeometry(1, 1, 1),
    column: new CylinderGeometry(1, 1, 1, 12),
  };
  return geometryCache;
}

/**
 * Chamfered volumes cannot be a single shared unit cube, because a chamfer
 * does not survive non-uniform scaling — see `ChamferedBox.ts`. They are
 * built at true size instead, which would mean one allocation per volume if
 * nothing deduplicated them.
 *
 * Architecture deduplicates extremely well: a facade's mullions are all the
 * same section, a stair's treads are all the same tread, a run of joinery is
 * the same carcass repeated. Quantising each dimension to the millimetre and
 * keying on the result collapses those back to one geometry each, so the
 * chamfer costs far closer to the old two allocations than to one per box.
 */
const chamferedCache = new Map<string, BufferGeometry>();

/** Rounds to whole millimetres — finer than any edge this scene resolves. */
function mm(value: number): number {
  return Math.round(value * 1000);
}

export function getChamferedBox(
  width: number,
  height: number,
  depth: number,
  chamfer: number,
): BufferGeometry {
  const key = `${mm(width)}:${mm(height)}:${mm(depth)}:${mm(chamfer)}`;
  let geometry = chamferedCache.get(key);
  if (!geometry) {
    geometry = createChamferedBox(width, height, depth, chamfer);
    chamferedCache.set(key, geometry);
  }
  return geometry;
}

/** Releases the shared primitives when the experience unmounts. */
export function disposeVillaGeometries(): void {
  for (const geometry of chamferedCache.values()) geometry.dispose();
  chamferedCache.clear();

  if (!geometryCache) return;
  for (const geometry of Object.values(geometryCache)) geometry.dispose();
  geometryCache = null;
}
