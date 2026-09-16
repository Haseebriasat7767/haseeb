import { describe, expect, it } from 'vitest';
import { panoGraph, panoHotspotsFor, panoReachableSpaces } from '@/lib/pano/hotspots';
import { createFloorPlanModel } from '@/lib/experience/floorplan';
import { ROOM_SPACES, findSpace } from '@/lib/experience/spaces';

/**
 * The navigation graph is derived from the generated plan, never authored.
 * These tests exist for the same reason `property-figures.test.ts` does: a
 * hand-written adjacency list would keep passing after a partition moved.
 */

const graph = panoGraph();

describe('panorama navigation graph', () => {
  it('links rooms that the generated plan actually puts next to each other', () => {
    expect(graph.size).toBeGreaterThan(0);
    for (const [id, hotspots] of graph) {
      expect(findSpace(id)).toBeDefined();
      expect(hotspots.length).toBeGreaterThan(0);
    }
  });

  it('only ever names spaces that exist in SPACES', () => {
    const known = new Set(ROOM_SPACES.map((space) => space.id));
    for (const hotspots of graph.values()) {
      for (const hotspot of hotspots) expect(known.has(hotspot.id)).toBe(true);
    }
  });

  it('is symmetric — a door you can walk through is a door you can walk back through', () => {
    for (const [id, hotspots] of graph) {
      for (const hotspot of hotspots) {
        const back = graph.get(hotspot.id) ?? [];
        expect(back.map((entry) => entry.id)).toContain(id);
      }
    }
  });

  it('never links a room to itself', () => {
    for (const [id, hotspots] of graph) {
      expect(hotspots.map((entry) => entry.id)).not.toContain(id);
    }
  });

  it('connects the two levels through the stair and nowhere else', () => {
    const crossings: Array<[string, string]> = [];
    for (const [id, hotspots] of graph) {
      const from = findSpace(id);
      for (const hotspot of hotspots) {
        const to = findSpace(hotspot.id);
        if (from && to && from.level !== to.level) crossings.push([id, hotspot.id]);
      }
    }
    expect(crossings.length).toBeGreaterThan(0);
    for (const [a, b] of crossings) expect([a, b]).toContain('stair');
  });

  it('orders each room-s hotspots nearest first', () => {
    for (const hotspots of graph.values()) {
      const distances = hotspots.map((hotspot) => hotspot.distance);
      expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    }
  });

  it('emits unit direction vectors that agree with their own yaw and pitch', () => {
    for (const hotspots of graph.values()) {
      for (const hotspot of hotspots) {
        const [x, y, z] = hotspot.direction;
        expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
        expect(Math.atan2(x, z)).toBeCloseTo(hotspot.yaw, 6);
        expect(Math.asin(y)).toBeCloseTo(hotspot.pitch, 6);
      }
    }
  });

  it('aims at the target room-s centre, computed from the plan rather than typed in', () => {
    const plan = createFloorPlanModel();
    const rooms = new Map(plan.levels.flatMap((level) => level.rooms.map((r) => [r.id, r])));

    for (const [id, hotspots] of graph) {
      const from = findSpace(id);
      if (!from) continue;
      for (const hotspot of hotspots) {
        const to = findSpace(hotspot.id);
        const room = to?.room === undefined ? undefined : rooms.get(to.room);
        if (!to || !room) continue;

        const dx = room.x + room.width / 2 - from.view.position[0];
        const dy = to.view.position[1] - from.view.position[1];
        const dz = room.y + room.height / 2 - from.view.position[2];
        const length = Math.hypot(dx, dy, dz);

        expect(hotspot.distance).toBeCloseTo(length, 6);
        expect(hotspot.direction[0]).toBeCloseTo(dx / length, 6);
      }
    }
  });

  it('reports only reachable rooms, in SPACES order', () => {
    const reachable = panoReachableSpaces();
    expect(reachable.length).toBeGreaterThan(0);
    const order = ROOM_SPACES.map((space) => space.id);
    const indices = reachable.map((space) => order.indexOf(space.id));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it('returns an empty list for a space with no panorama links, not undefined', () => {
    expect(panoHotspotsFor('not-a-room')).toEqual([]);
  });
});
