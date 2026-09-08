'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Line3, Matrix4, Vector2, Vector3 } from 'three';
import type { WalkCollider } from './tower/WalkCollider';

/**
 * First-person movement through the building, with real collision.
 *
 * ## How the collision works
 *
 * The visitor is a capsule — a line segment with a radius — and the building
 * is one merged BVH of plain boxes. Each frame the capsule is moved by
 * gravity and by input, and then pushed back out of anything it ended up
 * inside: `shapecast` walks only the BVH nodes the capsule's box touches, and
 * for each triangle in those it finds the closest point on the triangle to
 * the capsule's segment. Anything closer than the radius is a penetration,
 * and the sum of those pushes is the correction.
 *
 * That is what makes floors and stairs work without either being special.
 * A step is a box; the capsule lands on it, is pushed up out of it, and the
 * upward component of the push is what tells us we are standing on something
 * rather than falling. Nothing here knows what a stair is.
 *
 * ## Why a capsule rather than a ray
 *
 * A downward ray finds the floor and nothing else — it walks through walls,
 * because a wall is not under your feet. The capsule is the cheapest shape
 * that has both a height and a width, which is the minimum needed to stand on
 * a floor AND be stopped by a pane of glass.
 */

/** Eye height, and so the height of a person, in metres. */
const EYE = 1.68;
/** How wide the visitor is. Wide enough not to slip through a mullion. */
const RADIUS = 0.32;
const GRAVITY = -22;
const WALK_SPEED = 3.4;
const RUN_SPEED = 7.0;
/** Steps taller than this stop you; anything less you walk up. */
const STEP_UP = 0.42;

export type WalkControlsProps = {
  collider: WalkCollider;
  /** Where the visitor starts, at floor level. */
  start: [number, number, number];
  /** Initial heading, in radians. */
  heading?: number;
  /** Set by the on-screen joystick on touch devices. */
  moveRef?: { current: { x: number; y: number } };
  lookRef?: { current: { x: number; y: number } };
  onMove?: (position: Vector3, heading: number) => void;
};

export function WalkControls({
  collider,
  start,
  heading = 0,
  moveRef,
  lookRef,
  onMove,
}: WalkControlsProps) {
  const { camera, gl } = useThree();

  const state = useRef({
    // The capsule's lower and upper sphere centres, in world space.
    position: new Vector3(start[0], start[1] + EYE, start[2]),
    velocity: new Vector3(),
    grounded: false,
    yaw: heading,
    pitch: 0,
    keys: new Set<string>(),
  });

  // Scratch, allocated once. A first-person controller runs every frame and
  // allocating vectors in it is how a walkthrough acquires a stutter.
  const scratch = useMemo(
    () => ({
      segment: new Line3(),
      box: new Box3(),
      triPoint: new Vector3(),
      capsulePoint: new Vector3(),
      delta: new Vector3(),
      forward: new Vector3(),
      right: new Vector3(),
      wish: new Vector3(),
      inverse: new Matrix4(),
      before: new Vector3(),
      resolved: new Vector3(),
      look: new Vector2(),
    }),
    [],
  );

  // ── Input ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;
    const s = state.current;

    const down = (e: KeyboardEvent) => {
      s.keys.add(e.code);
      // Arrow keys and space scroll the page underneath; in a walkthrough
      // that means the building slides away while you are trying to walk.
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => s.keys.delete(e.code);
    const blur = () => s.keys.clear();

    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      s.yaw -= e.movementX * 0.0022;
      s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch - e.movementY * 0.0022));
    };
    const click = () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock?.();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('mousemove', move);
    canvas.addEventListener('click', click);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('mousemove', move);
      canvas.removeEventListener('click', click);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
  }, [gl]);

  useFrame((_, rawDelta) => {
    const s = state.current;
    // Clamped: a tab that has been in the background hands back a delta of
    // several seconds, and integrating that puts the visitor through a wall
    // and out the far side of the building.
    const delta = Math.min(rawDelta, 0.05);

    // ── Look ──────────────────────────────────────────────────────────────
    if (lookRef?.current) {
      s.yaw -= lookRef.current.x * delta * 2.4;
      s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch - lookRef.current.y * delta * 2.4));
    }
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');

    // ── Wish direction ────────────────────────────────────────────────────
    const { forward, right, wish } = scratch;
    forward.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    wish.set(0, 0, 0);

    const k = s.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) wish.add(forward);
    if (k.has('KeyS') || k.has('ArrowDown')) wish.sub(forward);
    if (k.has('KeyD') || k.has('ArrowRight')) wish.add(right);
    if (k.has('KeyA') || k.has('ArrowLeft')) wish.sub(right);
    if (moveRef?.current) {
      wish.addScaledVector(right, moveRef.current.x);
      wish.addScaledVector(forward, -moveRef.current.y);
    }

    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    // ── Integrate ─────────────────────────────────────────────────────────
    s.velocity.y += GRAVITY * delta;
    if (s.grounded && (k.has('Space') || false)) s.velocity.y = 6.2;

    s.position.addScaledVector(wish, delta);
    s.position.addScaledVector(s.velocity, delta);

    // ── Resolve ───────────────────────────────────────────────────────────
    const { segment, box, triPoint, capsulePoint, delta: push, before, resolved } = scratch;
    before.copy(s.position);

    // The capsule, from the feet-sphere centre to the head-sphere centre.
    segment.start.set(s.position.x, s.position.y - EYE + RADIUS, s.position.z);
    segment.end.set(s.position.x, s.position.y - RADIUS, s.position.z);

    box.makeEmpty();
    box.expandByPoint(segment.start);
    box.expandByPoint(segment.end);
    box.min.addScalar(-RADIUS);
    box.max.addScalar(RADIUS);

    collider.bvh.shapecast({
      intersectsBounds: (nodeBox) => nodeBox.intersectsBox(box),
      intersectsTriangle: (tri) => {
        const distance = tri.closestPointToSegment(segment, triPoint, capsulePoint);
        if (distance < RADIUS) {
          const depth = RADIUS - distance;
          push.copy(capsulePoint).sub(triPoint).normalize();
          segment.start.addScaledVector(push, depth);
          segment.end.addScaledVector(push, depth);
        }
        return false;
      },
    });

    // Where the capsule ended up after being pushed out of everything. The
    // eye sits a radius above the head sphere's centre.
    resolved.copy(segment.end).y += RADIUS;
    push.copy(resolved).sub(before);

    s.position.copy(resolved);

    // Grounded whenever anything pushed us up at all.
    //
    // The first version of this asked for the correction to be MOSTLY
    // upward — `push.y > |push.x| + |push.z|`. Pressed against a wall it
    // read false every frame, because the wall's horizontal push dwarfs the
    // millimetre the floor gives back, so `velocity.y` kept integrating
    // downward the whole time the visitor leant on the glass. Step away and
    // they drop at whatever speed had built up. Every surface here is
    // axis-aligned, so there are no slopes to be fooled by: an upward
    // component means a floor is under us.
    s.grounded = push.y > 1e-4;
    if (s.grounded) s.velocity.y = 0;
    // Fell out of the world: put them back rather than let them drop forever.
    if (s.position.y < -60) {
      s.position.set(start[0], start[1] + EYE, start[2]);
      s.velocity.set(0, 0, 0);
    }

    camera.position.copy(s.position);
    onMove?.(s.position, s.yaw);
  });

  // Nothing rendered: this is behaviour attached to the camera.
  return null;
}

export { EYE as WALK_EYE_HEIGHT, STEP_UP as WALK_STEP_UP };
export default WalkControls;
