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

export type ManifestEntry = {
  /** The space id. Also the loader's cache key, so it must stay stable. */
  id: string;
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
