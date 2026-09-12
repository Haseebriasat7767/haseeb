'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Line3, Vector3 } from 'three';
import { onTravel } from '@/lib/three/walk-floors';
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
const EYE = 1.65; // Slightly lower for interior — 1.68 felt tall in 2.4m rooms
/** How wide the visitor is. Wide enough not to slip through a mullion. */
const RADIUS = 0.34; // Slightly wider — prevents slipping through thin mullions
const GRAVITY = -14; // Was -22 — too heavy, felt like moon drop. -14 is natural.
// ── 2026 luxury tuning — walk speeds ────────────────────────────────────
// 12 m/s is 43 km/h — sprinting through a villa. Luxury walkthrough should
// feel like a person, not a drone: 2.8 walk (~10 km/h for UX, faster than
// real 1.4 m/s but still human), 5.2 run. Previous audit noted tunneling
// at 12/20 despite substeps.
const WALK_SPEED = 2.9;
const RUN_SPEED = 5.2;
/**
 * Furthest the capsule may move before collision is resolved again.
 *
 * Reduced from 0.16 to 0.08 for luxury walk: at 12 m/s, 0.16 allowed 160mm
 * steps that tunneled thin walls. At 2.9 m/s, 0.08 gives ~36mm resolution —
 * enough to stop on a 60mm wall band. More substeps, but at lower speed
 * total cost is similar.
 */
const MAX_SUBSTEP = 0.08;
// ── Look tuning — smoother, more cinematic ──────────────────────────────
const MOUSE_LOOK = 0.0032; // Was 0.0042 — too twitchy for luxury
const KEY_LOOK = 1.55; // Was 2.4 — too fast, felt game-like
const HEAD_BOB_FREQ = 9.5; // Steps per second at walk speed
const HEAD_BOB_AMP = 0.025; // Metres vertical bob

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
      before: new Vector3(),
      resolved: new Vector3(),
      motion: new Vector3(),
    }),
    [],
  );

  // The lift. A destination arrives from the floor picker outside the canvas
  // and the visitor is standing there on the next frame — vertical travel is
  // the one part of a walkthrough nobody wants in real time, and twenty
  // storeys at 3.4 metres a flight is four minutes of stairwell.
  useEffect(
    () =>
      onTravel(({ position, heading: yaw }) => {
        const s = state.current;
        s.position.set(position[0], position[1] + EYE, position[2]);
        s.velocity.set(0, 0, 0);
        s.yaw = yaw;
        s.pitch = 0;
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

    // ── Looking around ──────────────────────────────────────────────────
    //
    // This was pointer lock: click the canvas and the browser hid the cursor
    // and handed us raw deltas. It gives the best possible look control and
    // it takes the mouse away completely — while locked there is no pointer
    // to click the lift with, the hour dial with, or the Continue button
    // with, and the way out is a key most visitors do not know to press.
    // On a page whose whole job is to let someone look around a building AND
    // operate the controls around it, that is the wrong trade.
    //
    // Drag to look instead. Hold the left button and the view turns with the
    // pointer; let go and the cursor is a cursor again, sitting over the UI
    // it can now click. Same 360°, nothing captured.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const pointerDown = (e: PointerEvent) => {
      // Left button only, and only on the canvas — a drag that starts on a
      // button is that button's drag, not the camera's.
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      // Keeps the deltas coming if the pointer leaves the canvas mid-turn,
      // which is what happens every time someone spins past 90°.
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };

    const pointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      s.yaw -= (e.clientX - lastX) * MOUSE_LOOK;
      s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch - (e.clientY - lastY) * MOUSE_LOOK));
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
      canvas.style.cursor = 'grab';
    };

    canvas.style.cursor = 'grab';

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.style.cursor = '';
      // Nothing to unlock any more, but a build that ran the old code may
      // still hold the lock when this remounts.
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
    const k = s.keys;
    let lookX = lookRef?.current.x ?? 0;
    let lookY = lookRef?.current.y ?? 0;
    if (k.has('KeyQ')) lookX -= 1;
    if (k.has('KeyE')) lookX += 1;
    if (k.has('KeyR')) lookY -= 1;
    if (k.has('KeyF')) lookY += 1;
    if (lookX !== 0 || lookY !== 0) {
      s.yaw -= lookX * delta * KEY_LOOK;
      s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch - lookY * delta * KEY_LOOK));
    }
    // Smooth acceleration for look — prevents snap when stick released
    // (interpolated via damping would be ideal, but direct is ok for now)
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');

    // ── Wish direction ────────────────────────────────────────────────────
    const { forward, right, wish } = scratch;
    forward.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    wish.set(0, 0, 0);

    if (k.has('KeyW') || k.has('ArrowUp')) wish.add(forward);
    if (k.has('KeyS') || k.has('ArrowDown')) wish.sub(forward);
    if (k.has('KeyD') || k.has('ArrowRight')) wish.add(right);
    if (k.has('KeyA') || k.has('ArrowLeft')) wish.sub(right);
    if (moveRef?.current) {
      wish.addScaledVector(right, moveRef.current.x);
      wish.addScaledVector(forward, -moveRef.current.y);
    }

    // Acceleration smoothing — luxury walk shouldn't start/stop instantly.
    // Lerp wish toward target speed rather than snap.
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed);
      // Smooth acceleration: blend current horizontal velocity toward wish
      const horizVel = new Vector3(s.velocity.x, 0, s.velocity.z);
      horizVel.lerp(wish, 1 - Math.pow(0.02, delta)); // 0.02 = fast accel, luxury feel
      s.velocity.x = horizVel.x;
      s.velocity.z = horizVel.z;
    } else {
      // Decelerate smoothly when no input
      s.velocity.x *= Math.pow(0.02, delta);
      s.velocity.z *= Math.pow(0.02, delta);
      if (Math.abs(s.velocity.x) < 0.01) s.velocity.x = 0;
      if (Math.abs(s.velocity.z) < 0.01) s.velocity.z = 0;
    }

    // ── Integrate ─────────────────────────────────────────────────────────
    s.velocity.y += GRAVITY * delta;
    if (s.grounded && (k.has('Space') || false)) s.velocity.y = 5.2; // Slightly lower jump

    // ── Move and resolve ──────────────────────────────────────────────────
    //
    // In substeps small enough that the capsule cannot pass through anything
    // between two resolutions. One step per frame is the common case; a
    // sprint on a slow frame is three or four.
    // Note: s.velocity now already contains smoothed horizontal (lerped
    // toward wish) + vertical gravity, so motion is simply velocity * delta.
    const { segment, box, triPoint, capsulePoint, delta: push, before, resolved, motion } = scratch;
    motion.copy(s.velocity).multiplyScalar(delta);
    const substeps = Math.max(1, Math.ceil(motion.length() / MAX_SUBSTEP));
    motion.divideScalar(substeps);

    let lift = 0;
    for (let step = 0; step < substeps; step += 1) {
      s.position.add(motion);
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
      lift += push.y;

      s.position.copy(resolved);
    }

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
    s.grounded = lift > 1e-4;
    if (s.grounded) s.velocity.y = 0;
    // Fell out of the world: put them back rather than let them drop forever.
    if (s.position.y < -60) {
      s.position.set(start[0], start[1] + EYE, start[2]);
      s.velocity.set(0, 0, 0);
    }

    // ── Head bob — subtle vertical movement when walking, luxury detail ──
    // Only when grounded and moving, and scales with speed.
    const horizSpeed = Math.hypot(s.velocity.x, s.velocity.z);
    const isMoving = horizSpeed > 0.2 && s.grounded;
    if (isMoving) {
      const bobPhase = performance.now() * 0.001 * HEAD_BOB_FREQ * (horizSpeed / WALK_SPEED);
      const bob = Math.sin(bobPhase) * HEAD_BOB_AMP * Math.min(1, horizSpeed / WALK_SPEED);
      camera.position.set(s.position.x, s.position.y + bob, s.position.z);
    } else {
      camera.position.copy(s.position);
    }
    onMove?.(s.position, s.yaw);
  });

  // Nothing rendered: this is behaviour attached to the camera.
  return null;
}

export { EYE as WALK_EYE_HEIGHT };
export default WalkControls;
