/**
 * Where the lift can take you, and the means of getting there.
 *
 * ## Why this is a store and not a prop
 *
 * The floor picker is ordinary DOM, drawn over the canvas by the page. The
 * thing it moves is a camera thirty modules deep inside it, behind
 * `ExperienceViewport` and `Scene` — components the villa shares and which
 * have no business knowing a tower has floors. Threading a `walkFloor` prop
 * through all of them would put a tower's plan into the villa's signature.
 *
 * So the two ends talk directly: the scene publishes the floors it actually
 * built, the page renders them, and a selection goes back the same way. The
 * list is never written by hand, which is what stops the picker offering a
 * floor the building does not have.
 */

export type WalkFloor = {
  id: string;
  label: string;
  /** Where the visitor arrives, at floor level. */
  position: readonly [number, number, number];
  /** Which way they are facing when they get there. */
  heading: number;
};

export type WalkDestination = Pick<WalkFloor, 'position' | 'heading'>;

let floors: readonly WalkFloor[] = [];
const floorListeners = new Set<() => void>();
const travelListeners = new Set<(destination: WalkDestination) => void>();

export function setWalkFloors(next: readonly WalkFloor[]): void {
  floors = next;
  for (const listener of floorListeners) listener();
}

export function getWalkFloors(): readonly WalkFloor[] {
  return floors;
}

export function subscribeWalkFloors(listener: () => void): () => void {
  floorListeners.add(listener);
  return () => floorListeners.delete(listener);
}

/** Take the lift. Nothing happens if no walk controller is mounted. */
export function travelTo(destination: WalkDestination): void {
  for (const listener of travelListeners) listener(destination);
}

export function onTravel(listener: (destination: WalkDestination) => void): () => void {
  travelListeners.add(listener);
  return () => travelListeners.delete(listener);
}
