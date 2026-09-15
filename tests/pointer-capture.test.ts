import { describe, expect, it, vi } from 'vitest';
import { capturePointer, releasePointer } from '@/lib/utils/pointer-capture';

/**
 * Reproduces the production failure these helpers exist for.
 *
 * Vercel reported twenty uncaught `InvalidStateError`s from
 * `setPointerCapture` on `/tower`, from a real Android device and desktop
 * Chrome. The throw abandoned the rest of the pointerdown handler, so the
 * thumb stick never engaged and the drag did nothing.
 */

function elementThatThrows(): Element {
  return {
    setPointerCapture() {
      throw new DOMException('Failed to execute setPointerCapture', 'InvalidStateError');
    },
    releasePointerCapture() {
      throw new DOMException('no capture', 'InvalidStateError');
    },
    hasPointerCapture() {
      return true;
    },
  } as unknown as Element;
}

describe('capturePointer', () => {
  it('captures and reports success when the browser allows it', () => {
    const set = vi.fn();
    const element = { setPointerCapture: set } as unknown as Element;
    expect(capturePointer(element, 7)).toBe(true);
    expect(set).toHaveBeenCalledWith(7);
  });

  it('survives the InvalidStateError seen in production', () => {
    expect(() => capturePointer(elementThatThrows(), 7)).not.toThrow();
    expect(capturePointer(elementThatThrows(), 7)).toBe(false);
  });

  it('survives an element with no pointer-capture support at all', () => {
    expect(() => capturePointer({} as Element, 1)).not.toThrow();
    expect(capturePointer({} as Element, 1)).toBe(false);
  });
});

describe('releasePointer', () => {
  it('releases a capture it actually holds', () => {
    const release = vi.fn();
    const element = {
      hasPointerCapture: () => true,
      releasePointerCapture: release,
    } as unknown as Element;
    releasePointer(element, 3);
    expect(release).toHaveBeenCalledWith(3);
  });

  it('does not attempt a release it never took', () => {
    const release = vi.fn();
    const element = {
      hasPointerCapture: () => false,
      releasePointerCapture: release,
    } as unknown as Element;
    releasePointer(element, 3);
    expect(release).not.toHaveBeenCalled();
  });

  it('never throws, whatever the element does', () => {
    expect(() => releasePointer(elementThatThrows(), 3)).not.toThrow();
    expect(() => releasePointer({} as Element, 3)).not.toThrow();
  });
});
