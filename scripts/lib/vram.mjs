/**
 * What a chosen face resolution actually costs on the GPU.
 *
 * Every figure here is computed, not quoted. The numbers that decide the
 * resolution are large enough that a remembered one is a liability.
 */

export const FACE_SIZES = [1024, 1536, 2048];

/** Uploaded as RGBA8. Compressed formats (KTX2/Basis) are not wired. */
const BYTES_PER_PX = 4;
const MIB = 1024 * 1024;

/** A full mip chain adds 1/4 + 1/16 + ... = 1/3 on top of the base level. */
const MIP_FACTOR = 4 / 3;

export function vramPerRoomMiB(face) {
  return (6 * face * face * BYTES_PER_PX) / MIB;
}

/**
 * Peak residency, not steady state.
 *
 * The loader's cache limit is an eviction policy — `evict()` runs on load, so
 * residency never exceeds it. But `PanoTransition` holds the outgoing shell
 * through the ~600ms crossfade, and React still references its texture after
 * the cache has let go. So peak is `limit + 1`.
 *
 * `inFlight` is zero today: there is no prefetch in `panoLoader.ts` or
 * `PanoTransition.tsx`, and Phase 3 ships without one. The parameter exists
 * so this figure stays honest if that changes.
 *
 * `mips` defaults to true because that is the deployed case: `CubeTexture`
 * extends `Texture`, whose default `minFilter` is `LinearMipmapLinearFilter`,
 * so three builds the chain unless it is explicitly turned off. A default of
 * false would understate every call by a third.
 */
export function peakMiB(face, limit, { inFlight = 0, mips = true } = {}) {
  const base = vramPerRoomMiB(face) * (limit + 1 + inFlight);
  return mips ? base * MIP_FACTOR : base;
}

export function resolveFaceSize(raw) {
  const value = Number(raw);
  if (!FACE_SIZES.includes(value)) {
    throw new Error(`face size must be one of ${FACE_SIZES.join(', ')}; got ${String(raw)}`);
  }
  return value;
}
