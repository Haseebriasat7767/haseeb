import {
  createInteriorPlan,
  type PlanOpening,
  type PlanWall,
  type Room,
} from '@/components/three/villa/interior/InteriorPlan';
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

/**
 * A doorway, projected onto the plan. Carries the level it pierces, which
 * the raw `PlanOpening` can only express as a floor height.
 */
export type PlanDoorway = {
  partition: string;
  level: 'ground' | 'upper';
  /** `'x'` means the wall stands at a constant x and runs along z. */
  axis: 'x' | 'z';
  /** The wall's plan line, on `axis`. */
  at: number;
  /** Plan-space centre of the opening: world x, world z. */
  x: number;
  y: number;
  /** Clear width, in metres. */
  width: number;
};

/** A partition line, projected onto the plan and tagged with its storey. */
export type PlanPartition = {
  key: string;
  level: 'ground' | 'upper';
  axis: 'x' | 'z';
  at: number;
  across: Range;
};

/** Plan-space inclusive range, in metres. */
export type Range = readonly [number, number];

export type FloorPlanModel = {
  /** Drawing extent in metres, used as the SVG viewBox. */
  bounds: { x: number; y: number; width: number; height: number };
  levels: readonly PlanLevel[];
  /**
   * Every opening the generator cut, retained from generation. This is what
   * makes "are these two rooms connected" answerable: two rooms can share a
   * wall and have no way through it.
   */
  doorways: readonly PlanDoorway[];
  /**
   * Every partition the generator raised. Paired with `doorways`, this is
   * what distinguishes "a wall with no door" from "no wall at all" — the
   * first disconnects two rooms, the second joins them.
   */
  partitions: readonly PlanPartition[];
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
/**
 * Which storey an opening belongs to. The opening records its own sill
 * height, and the two floor levels are far enough apart that the comparison
 * is unambiguous.
 */
function doorwayLevel(opening: PlanOpening, upperFloorY: number): 'ground' | 'upper' {
  return opening.y[0] >= upperFloorY ? 'upper' : 'ground';
}

function toDoorway(opening: PlanOpening, upperFloorY: number): PlanDoorway {
  const [x, , z] = opening.midpoint;
  return {
    partition: opening.partition,
    level: doorwayLevel(opening, upperFloorY),
    axis: opening.axis,
    at: opening.at,
    x,
    y: z,
    width: opening.width,
  };
}

export function createFloorPlanModel(): FloorPlanModel {
  const layout = createVillaLayout(VILLA_CONFIG, 'high');
  const { rooms, openings, walls } = createInteriorPlan(layout.plan, layout.levels);
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
    doorways: openings.map((entry) => toDoorway(entry, layout.levels.upperFloorY)),
    partitions: walls.map((entry: PlanWall): PlanPartition => ({
      key: entry.key,
      level: entry.y[0] >= layout.levels.upperFloorY ? 'upper' : 'ground',
      axis: entry.axis,
      at: entry.at,
      across: entry.across,
    })),
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
