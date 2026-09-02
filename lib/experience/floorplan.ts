import { createInteriorPlan, type Room } from '@/components/three/villa/interior/InteriorPlan';
import { VILLA_CONFIG, createVillaLayout } from '@/components/three/villa/VillaGeometry';

/** A room outline projected into plan-view coordinates, in metres. */
export type PlanRoom = {
  id: string;
  label: string;
  level: Room['level'];
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlanLevel = {
  id: 'ground' | 'upper';
  label: string;
  detail: string;
  rooms: readonly PlanRoom[];
};

export type FloorPlanModel = {
  /** Drawing extent in metres, used as the SVG viewBox. */
  bounds: { x: number; y: number; width: number; height: number };
  levels: readonly PlanLevel[];
};

/**
 * Projects a world-space box onto the plan. World +Z runs toward the front
 * elevation, and a drawn plan reads with the front at the bottom, so Z maps
 * straight onto the SVG's Y axis.
 */
function toPlan(room: Room): PlanRoom {
  return {
    id: room.id,
    label: room.label,
    level: room.level,
    x: room.x[0],
    y: room.z[0],
    width: room.x[1] - room.x[0],
    height: room.z[1] - room.z[0],
  };
}

/**
 * Builds the drawn floor plans from the *same* room schedule the 3D model
 * is generated from. These are not a redrawing of the residence — they are
 * the residence, projected. Change a partition in `InteriorPlan.ts` and the
 * plans below change with it.
 *
 * Pure, and free of any three.js runtime import, so it can be evaluated on
 * the server and shipped without the renderer.
 */
export function createFloorPlanModel(): FloorPlanModel {
  const layout = createVillaLayout(VILLA_CONFIG, 'high');
  const { rooms } = createInteriorPlan(layout.plan, layout.levels);
  const all = Object.values(rooms) as Room[];

  // The drawing is cropped to the building envelope. Including the plinth
  // put nearly half the frame below the last room, which reads as a
  // mistake rather than as site.
  const margin = 1.2;
  const { plan } = layout;

  return {
    bounds: {
      x: -plan.halfWidth - margin,
      y: -plan.halfDepth - margin,
      width: plan.halfWidth * 2 + margin * 2,
      height: plan.halfDepth + plan.frontZ + margin * 2,
    },
    levels: [
      {
        id: 'ground',
        label: 'Ground level',
        detail: 'Arrival, principal rooms, service band, and the guest suite',
        rooms: all.filter((room) => room.level === 'ground').map(toPlan),
      },
      {
        id: 'upper',
        label: 'Upper level',
        detail: 'Master suite, two further bedrooms, upper living, and the library',
        rooms: all.filter((room) => room.level === 'upper').map(toPlan),
      },
    ],
  };
}

/** The building outline, so the plan reads inside its own envelope. */
export function createPlanEnvelope(): { x: number; y: number; width: number; height: number } {
  const layout = createVillaLayout(VILLA_CONFIG, 'high');
  const { plan } = layout;
  return {
    x: -plan.halfWidth,
    y: -plan.halfDepth,
    width: plan.halfWidth * 2,
    height: plan.halfDepth + plan.frontZ,
  };
}
