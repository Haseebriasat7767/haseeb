import { createFloorPlanModel, type PlanRoom } from '@/lib/experience/floorplan';
import { ROOM_SPACES, findSpace, type Space } from '@/lib/experience/spaces';

/**
 * Where a visitor standing in one room can go next, and which way they have
 * to turn to see it.
 *
 * Nothing here is authored. The rooms come from `createFloorPlanModel`,
 * which is the same generated plan the 3D model is built from, and the
 * standing positions come from the camera each space already carries in
 * `spaces.ts`. A hand-written adjacency list would be a second opinion about
 * the building, free to drift from the model the moment a partition moves —
 * which is a failure this project has already had once.
 *
 * ## Rooms the tour cannot stop in
 *
 * The plan contains more rooms than `SPACES` names: a landing, an upper
 * hall, a pantry. They are not places to stand and look around, but they
 * are how the named rooms reach each other — the master suite does not
 * share a wall with the stair, it shares one with the landing between them.
 * So adjacency is worked out over *every* generated room, and then collapsed
 * onto the named ones by walking through the unnamed connectors.
 */

/**
 * The widest gap, in metres, between two rectangles that nonetheless share a
 * wall. The generator insets corridor-facing rooms, so touching rooms are
 * not always flush; this is measured from the plan it emits, not chosen.
 */
const WALL_TOLERANCE = 0.7;

/** ...and they must share at least this much of that wall — a door's worth. */
const MIN_SHARED_EDGE = 0.8;

/** How many unnamed connectors a link may pass through before it stops being a door. */
const MAX_CONNECTOR_HOPS = 1;

export type PanoHotspot = {
  /** The space this hotspot leads to. */
  id: string;
  label: string;
  /** Compass bearing from the viewpoint, radians, 0 = world +Z. */
  yaw: number;
  /** Elevation from the viewpoint, radians, positive looking up. */
  pitch: number;
  /** Straight-line metres from the viewpoint to the target room's centre. */
  distance: number;
  /** Unit direction in world space, for placing a marker on a sphere. */
  direction: readonly [number, number, number];
};

type Rect = { x: number; z: number; width: number; depth: number };

type RoomNode = {
  id: string;
  level: 'ground' | 'upper';
  rect: Rect;
  /** The space that stops here, if any. */
  spaceId: string | null;
};

function rectOf(room: PlanRoom): Rect {
  return { x: room.x, z: room.y, width: room.width, depth: room.height };
}

function overlap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

function touching(a: Rect, b: Rect): boolean {
  const x = overlap(a.x, a.x + a.width, b.x, b.x + b.width);
  const z = overlap(a.z, a.z + a.depth, b.z, b.z + b.depth);

  const alongZ = x >= MIN_SHARED_EDGE && z >= -WALL_TOLERANCE && z <= WALL_TOLERANCE;
  const alongX = z >= MIN_SHARED_EDGE && x >= -WALL_TOLERANCE && x <= WALL_TOLERANCE;
  return alongZ || alongX;
}

function planOverlapArea(a: Rect, b: Rect): number {
  return (
    Math.max(0, overlap(a.x, a.x + a.width, b.x, b.x + b.width)) *
    Math.max(0, overlap(a.z, a.z + a.depth, b.z, b.z + b.depth))
  );
}

function centre(rect: Rect): { x: number; z: number } {
  return { x: rect.x + rect.width / 2, z: rect.z + rect.depth / 2 };
}

function hotspotBetween(from: Space, to: Space, target: Rect): PanoHotspot {
  const [ex, ey, ez] = from.view.position;
  const { x: cx, z: cz } = centre(target);
  // Aim at the height a visitor would be standing at in the target room,
  // which the target's own framing already records.
  const dx = cx - ex;
  const dy = to.view.position[1] - ey;
  const dz = cz - ez;
  const distance = Math.hypot(dx, dy, dz) || 1;

  return {
    id: to.id,
    label: to.name,
    yaw: Math.atan2(dx, dz),
    pitch: Math.asin(dy / distance),
    distance,
    direction: [dx / distance, dy / distance, dz / distance] as const,
  };
}

function buildNodes(): RoomNode[] {
  const plan = createFloorPlanModel();
  const spaceByRoom = new Map<string, string>();
  for (const space of ROOM_SPACES) {
    if (space.room) spaceByRoom.set(space.room, space.id);
  }

  return plan.levels.flatMap((level) =>
    level.rooms.map((room) => ({
      id: room.id,
      level: level.id,
      rect: rectOf(room),
      spaceId: spaceByRoom.get(room.id) ?? null,
    })),
  );
}

/**
 * The one link a plan projection cannot express. Rooms on different levels
 * never touch when both are flattened onto the same drawing, so the stair —
 * which `spaces.ts` already describes as rising into the upper landing — is
 * resolved as the upper-level room sitting most directly above it.
 */
function verticalEdge(nodes: readonly RoomNode[]): [string, string] | null {
  const stair = nodes.find((node) => node.spaceId === 'stair');
  if (!stair) return null;

  let best: { id: string; area: number } | null = null;
  for (const node of nodes) {
    if (node.level !== 'upper') continue;
    const area = planOverlapArea(stair.rect, node.rect);
    if (area > 0 && (best === null || area > best.area)) best = { id: node.id, area };
  }
  return best ? [stair.id, best.id] : null;
}

function buildRoomAdjacency(nodes: readonly RoomNode[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));
  const link = (a: string, b: string) => {
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  };

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (a.level !== b.level) continue;
      if (touching(a.rect, b.rect)) link(a.id, b.id);
    }
  }

  const vertical = verticalEdge(nodes);
  if (vertical) link(vertical[0], vertical[1]);

  return adjacency;
}

/**
 * Collapses the room graph onto the named spaces: from each named room, walk
 * outward through unnamed connectors only, and record the first named room
 * reached along each branch.
 */
function namedNeighbours(
  start: RoomNode,
  adjacency: Map<string, Set<string>>,
  byId: Map<string, RoomNode>,
): Set<string> {
  const found = new Set<string>();
  const seen = new Set<string>([start.id]);
  let frontier: Array<{ id: string; hops: number }> = [{ id: start.id, hops: 0 }];

  while (frontier.length > 0) {
    const next: Array<{ id: string; hops: number }> = [];
    for (const { id, hops } of frontier) {
      for (const neighbourId of adjacency.get(id) ?? []) {
        if (seen.has(neighbourId)) continue;
        seen.add(neighbourId);
        const neighbour = byId.get(neighbourId);
        if (!neighbour) continue;

        if (neighbour.spaceId) {
          // A named room is a destination, not a corridor: stop here rather
          // than tunnelling through it to whatever lies beyond.
          found.add(neighbour.spaceId);
        } else if (hops < MAX_CONNECTOR_HOPS) {
          next.push({ id: neighbourId, hops: hops + 1 });
        }
      }
    }
    frontier = next;
  }

  return found;
}

let cached: ReadonlyMap<string, readonly PanoHotspot[]> | null = null;

/** Every room's outbound links, keyed by space id. */
export function panoGraph(): ReadonlyMap<string, readonly PanoHotspot[]> {
  if (cached) return cached;

  const nodes = buildNodes();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = buildRoomAdjacency(nodes);
  const named = nodes.filter(
    (node): node is RoomNode & { spaceId: string } => node.spaceId !== null,
  );
  const rectBySpace = new Map(named.map((node) => [node.spaceId, node.rect]));

  // Reached through a connector, the link is not necessarily reciprocal —
  // the walk out of A can find B while the walk out of B stops short. A door
  // only opens one way in a plan drawing by mistake, so the union is taken.
  const links = new Map<string, Set<string>>(
    named.map((node) => [node.spaceId, new Set<string>()]),
  );
  for (const node of named) {
    for (const targetId of namedNeighbours(node, adjacency, byId)) {
      if (targetId === node.spaceId) continue;
      links.get(node.spaceId)?.add(targetId);
      links.get(targetId)?.add(node.spaceId);
    }
  }

  const graph = new Map<string, readonly PanoHotspot[]>();
  for (const [spaceId, targets] of links) {
    const from = findSpace(spaceId);
    if (!from || targets.size === 0) continue;

    const hotspots = [...targets]
      .map((targetId) => {
        const to = findSpace(targetId);
        const rect = rectBySpace.get(targetId);
        return to && rect ? hotspotBetween(from, to, rect) : null;
      })
      .filter((hotspot): hotspot is PanoHotspot => hotspot !== null)
      .sort((a, b) => a.distance - b.distance);

    graph.set(spaceId, hotspots);
  }

  cached = graph;
  return graph;
}

export function panoHotspotsFor(spaceId: string): readonly PanoHotspot[] {
  return panoGraph().get(spaceId) ?? [];
}

/** The spaces a panorama tour can actually reach, in `SPACES` order. */
export function panoReachableSpaces(): readonly Space[] {
  const graph = panoGraph();
  return ROOM_SPACES.filter((space) => (graph.get(space.id)?.length ?? 0) > 0);
}
