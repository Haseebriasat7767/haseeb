/**
 * The shape the render job emits and the loader consumes.
 *
 * It lives under `lib/` rather than beside the render script on purpose:
 * the script imports from here, not the reverse. `tsconfig.json` includes
 * `**\/*.ts` with only `node_modules` excluded, so anything under `scripts/`
 * is already in the app's type graph — and a generated app module importing
 * its type from a file that pulls in `node:crypto` puts node built-ins one
 * careless value-import away from a client chunk.
 */

/**
 * How the faces were produced.
 *
 * `raster` is the real-time renderer's own output — the same image a visitor
 * with WebGL already sees at that camera position, captured once instead of
 * drawn every frame. `traced` is the path-traced render. Both are genuine
 * renders of the real model; only the second is photoreal, and nothing is
 * allowed to describe a `raster` face as if it were.
 */
export type PanoQuality = 'raster' | 'traced';

/** Which building the room belongs to. Ids collide across the two. */
export type PanoBuilding = 'residence' | 'tower';

export type ManifestEntry = {
  /**
   * The space id, unique within its building. Not unique across both —
   * `kitchen` and `bathroom` exist in the residence and the tower alike, so
   * the loader's cache key is `building:id`, never `id` alone.
   */
  id: string;
  building: PanoBuilding;
  quality: PanoQuality;
  /** Content hash of the six faces, in fixed order. */
  hash: string;
  /** Directory the faces sit in. Carries the hash, so it is immutable. */
  basePath: string;
  /**
   * Face file extension, without the dot.
   *
   * Carried explicitly rather than defaulted at either end. `cubeFaceUrls`
   * falls back to `jpg`; a job that wrote `.png` and said nothing produces a
   * manifest whose every URL 404s, six faces at a time, silently.
   */
  extension: string;
  /** Face size in pixels. Square, by definition. */
  size: number;
};
