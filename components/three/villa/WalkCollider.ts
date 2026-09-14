import { BoxGeometry, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { colliderScale, type WalkCollider } from '../tower/WalkCollider';
import type { BoxSpec, VillaLayout } from './VillaTypes';

/**
 * The surfaces a visitor can stand on and bump into, walking the residence.
 *
 * Same technique as the tower's own collider (`colliderScale` is imported
 * from there rather than restated, so a wall thin enough to walk through on
 * one building is thin enough to walk through on both): plain unchamfered
 * boxes from the parts of `VillaLayout` that are actually architecture —
 * mass, slabs, glazing, balustrades, the stair — merged into one BVH.
 *
 * Left out, same reasoning as the tower: instanced furniture, which has no
 * `BoxSpec` to collide against, and the interior partition walls, which are
 * drawn by the interior fit-out rather than carried on `VillaLayout` itself.
 * A visitor can walk through a doorway that has not been cut yet; they
 * cannot walk through an exterior wall, a window, the roof, or off the
 * upper terrace's edge.
 */
const UNIT = new BoxGeometry(1, 1, 1);

function boxesToGeometry(specs: readonly BoxSpec[]): BufferGeometry[] {
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  return specs.map((spec) => {
    const part = UNIT.clone();
    position.set(...spec.position);
    quaternion.setFromAxisAngle(new Vector3(0, 1, 0), spec.rotationY ?? 0);
    scale.set(...colliderScale(spec.scale));
    matrix.compose(position, quaternion, scale);
    part.applyMatrix4(matrix);
    return part;
  });
}

export function createVillaWalkCollider(layout: VillaLayout): WalkCollider {
  const { openings } = layout;
  const groups: readonly (readonly BoxSpec[])[] = [
    // The ground the building sits on, and its own mass and entrance reveal.
    layout.foundation.plinth,
    layout.groundFloor.mass,
    layout.groundFloor.entrance,
    // The upper floor's mass, its own slab underfoot, and the cantilever.
    layout.upperFloor.mass,
    layout.upperFloor.slab,
    layout.upperFloor.cantilever,
    // The roof — walked under, not on, but a parapet is what stops someone
    // stepping off the upper terrace, and the slab is what stops the glass
    // above the entrance void reading as open air.
    layout.roof.slabs,
    layout.roof.parapets,
    // The terrace deck itself and the trim at its edge.
    layout.terrace.deck,
    layout.terrace.trim,
    // The glass balustrade to the upper terrace — the same rule the tower's
    // balcony glass follows: a guard rail that does not guard is worse than
    // no rail at all.
    layout.railings.glass,
    layout.railings.rails,
    layout.railings.posts,
    // The one way between floors on foot.
    layout.stairs,
    // Glazing. You cannot walk through a window any more than you can walk
    // through the wall it is set in.
    openings.windows.frames,
    openings.windows.glassClear,
    openings.windows.glassOpaque,
    openings.sliding.frames,
    openings.sliding.glassClear,
    openings.sliding.glassOpaque,
    openings.entrance.frames,
    openings.entrance.glassClear,
    openings.entrance.glassOpaque,
    openings.entrance.leaf,
  ];

  const parts = groups.flatMap((specs) => boxesToGeometry(specs));
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());

  // Non-indexed and position-only, same as the tower's: the BVH never needs
  // a normal or a UV.
  merged.deleteAttribute('normal');
  merged.deleteAttribute('uv');

  return { geometry: merged, bvh: new MeshBVH(merged) };
}

export default createVillaWalkCollider;
