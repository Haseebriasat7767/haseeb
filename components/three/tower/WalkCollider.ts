import { BoxGeometry, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import type { BoxSpec } from '../villa/VillaTypes';
import type { TowerLayout } from './TowerTypes';
import type { AmenityLayout } from './AmenityGeometry';
import type { CoreLayout } from './CoreGeometry';
import type { ApartmentLayout } from './ApartmentGeometry';

/**
 * The surfaces a visitor can stand on and bump into.
 *
 * ## Why this is a second geometry and not the building
 *
 * The building is drawn as chamfered boxes merged per material, tens of
 * thousands of triangles with rounded edges, instanced furniture and
 * alpha-cut foliage. None of that is any use to walk on: a chamfer is a
 * ramp the player slides off, foliage is a cloud of cards, and querying it
 * all per frame would cost more than drawing it.
 *
 * So the collider is built from the same `BoxSpec` arrays the building is,
 * as plain unchamfered boxes, and only from the parts that are actually
 * architecture — floors, walls, the core, balustrades, the podium shell.
 * One merged geometry, one BVH, built once.
 *
 * ## What is deliberately left out
 *
 * Furniture. You can walk through a sofa. That is a real limitation and it is
 * the right trade for now: every piece is instanced from a glTF whose
 * triangles are not in any `BoxSpec`, so colliding against them means
 * colliding against the render geometry, and a lounge chair is two thousand
 * triangles of upholstery nobody should be paying to walk around. Rooms are
 * bounded by their walls, which is what stops you leaving the building.
 */

const UNIT = new BoxGeometry(1, 1, 1);

/**
 * Thinnest a collider box may be in plan.
 *
 * ## Why the collider is not the building's thickness
 *
 * The visitor is a capsule 640mm across. A shopfront pane is 100mm and the
 * podium shell 450mm, so the capsule does not merely touch such a wall — it
 * straddles it, and picks up a contact from the face in front AND the face
 * behind. The two pushes are equal and opposite, they cancel, and the
 * visitor strolls through the glass. That is not a bug in the resolver;
 * every capsule-vs-triangle resolver behaves this way against a slab thinner
 * than its own diameter.
 *
 * Measured, not reasoned: a capsule probe on the ocean elevation returned
 * four contacts at x = 31.2, normals `[-1,0,0]`, `[-1,0,0]`, `[+1,0,0]`,
 * `[-1,0,0]` — the collision was found and then undone.
 *
 * So every box is fattened in plan to clear the capsule's diameter. It is
 * invisible: the collider is never drawn, and standing 350mm off a window
 * instead of 50mm is where a person stands anyway. Y is deliberately left
 * alone — floor plates are thin too, and thickening those would raise every
 * floor level in the building by half the correction.
 */
const MIN_PLAN_THICKNESS = 0.7;

/**
 * How tall a box has to be before it counts as a wall.
 *
 * The fattening above is for walls, and applying it to everything ruins the
 * one thing that most needs to be exact: a stair. A tread is 300mm deep, and
 * grown to 700mm it swallows its neighbours and the flight becomes a lumpy
 * ramp. So only box-like-a-wall gets fattened. 0.9m clears every tread and
 * floor plate in the building while still catching the balcony balustrades
 * at 1.12m — which must be solid, because the alternative is walking through
 * a guard rail seventy metres up.
 */
const MIN_WALL_HEIGHT = 0.9;

function boxesToGeometry(specs: readonly BoxSpec[]): BufferGeometry[] {
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  return specs.map((spec) => {
    const part = UNIT.clone();
    position.set(...spec.position);
    quaternion.setFromAxisAngle(new Vector3(0, 1, 0), spec.rotationY ?? 0);
    scale.set(...spec.scale);
    if (scale.y >= MIN_WALL_HEIGHT) {
      scale.x = Math.max(scale.x, MIN_PLAN_THICKNESS);
      scale.z = Math.max(scale.z, MIN_PLAN_THICKNESS);
    }
    matrix.compose(position, quaternion, scale);
    part.applyMatrix4(matrix);
    return part;
  });
}

export type WalkCollider = {
  geometry: BufferGeometry;
  bvh: MeshBVH;
};

/**
 * Builds the collider for the whole tower.
 *
 * Glazing is included — you cannot walk through a window — but balcony glass
 * and balustrades are too, because the alternative is stepping off a
 * seventy-metre balcony, and a guard rail that does not guard is worse than
 * no rail.
 */
export function createWalkCollider(
  layout: TowerLayout,
  amenity: AmenityLayout,
  core: CoreLayout,
  apartment: ApartmentLayout,
  shoreline: { boardwalk: BoxSpec[]; steps: BoxSpec[] },
  plaza: readonly BoxSpec[],
): WalkCollider {
  const groups: readonly (readonly BoxSpec[])[] = [
    // Podium: the shell you walk inside, the plates you stand on, the glass.
    layout.podium.mass,
    layout.podium.floors,
    layout.podium.glazing,
    layout.podium.balustrades,
    // The stair, which is the only way between floors on foot.
    layout.stair.steps,
    layout.stair.walls,
    // Tower: core, plates, glazing, and the balcony edge.
    layout.tower.core,
    layout.tower.plates,
    layout.tower.glazing,
    layout.balconies.slabs,
    layout.balconies.glass,
    // The deck on the podium roof, and its parapet.
    layout.deck.paving,
    layout.deck.parapet,
    layout.deck.glass,
    layout.deck.planters,
    // Fit-out that is architecture rather than furniture.
    amenity.walls,
    amenity.tiling,
    amenity.joinery,
    amenity.plungeShell,
    // Not `core.joinery`: that is the front-door leaf and the head over it,
    // millimetres thick and standing in an opening. Everything here gets a
    // wall's thickness in plan so a pane of glass can stop somebody, and a
    // door leaf given that treatment fills its own doorway.
    core.screens,
    apartment.walls,
    // Outside.
    shoreline.boardwalk,
    shoreline.steps,
    plaza,
  ];

  const parts = groups.flatMap((specs) => boxesToGeometry(specs));
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());

  // Non-indexed and position-only: the BVH never needs a normal or a UV, and
  // dropping them roughly halves what has to be built and kept.
  merged.deleteAttribute('normal');
  merged.deleteAttribute('uv');

  return { geometry: merged, bvh: new MeshBVH(merged) };
}
