/**
 * Pointer capture that cannot take the page down with it.
 *
 * ## Why this exists
 *
 * `setPointerCapture` throws `InvalidStateError` when the pointer id it is
 * given is no longer active — the finger was already lifted, the browser
 * cancelled the pointer, or the element left the document between the
 * event being queued and React handing it to a handler. That is a race
 * nobody can prevent from inside a handler, and it was throwing in
 * production: twenty uncaught `InvalidStateError`s came back from the
 * tower's thumb sticks on a real Android phone and on desktop Chrome,
 * reported through `/api/client-error`.
 *
 * An uncaught throw in a pointerdown handler abandons the rest of that
 * handler, so the stick never registered and the visitor's drag did
 * nothing — the failure a buyer would describe as "the controls don't
 * work on my phone".
 *
 * ## Why swallowing is the right answer here
 *
 * Capture is an enhancement, not the mechanism. It only guarantees that
 * the matching `pointerup` is reported to the same element when the finger
 * drifts outside it; without it the drag still works and the browser
 * routes the release to whatever is underneath. So a capture that cannot
 * be taken is worth continuing past, never worth losing the interaction
 * over. `?.` does not help: it guards a missing method, not a method that
 * throws.
 */

/** Captures the pointer if the browser will allow it. Returns whether it did. */
export function capturePointer(element: Element, pointerId: number): boolean {
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    // Pointer already gone, or the element is detached. The drag continues.
    return false;
  }
}

/** Releases a captured pointer, ignoring a capture that was never taken. */
export function releasePointer(element: Element, pointerId: number): void {
  try {
    // Asking first avoids throwing in the common case where the capture was
    // refused on the way in, or the browser has already released it.
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Nothing to release. The drag has already ended either way.
  }
}
