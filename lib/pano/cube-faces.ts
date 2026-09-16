/**
 * The six cube faces, and the one fov a cubemap face may have.
 *
 * Lives under `lib/` rather than beside the render script because the render
 * bridge is app code and imports it. `tsconfig.json` includes every `.ts`
 * with only `node_modules` excluded, so a module under `scripts/` is already
 * in the app's type graph — and pointing app code at it is how node built-ins
 * end up one careless value-import from a client chunk. The scripts keep a
 * runtime mirror of the ids in `.mjs`, guarded by `tests/cubemap-faces.test.ts`.
 */

/**
 * Copied from three's `CubeCamera` (WebGL coordinate system), which is the
 * reference implementation for this convention.
 *
 * Expressed as dir+up rather than yaw/pitch. A YXZ Euler gimbal-locks at
 * pitch ±π/2, where yaw and roll collapse onto the same axis — so there is
 * no yaw value that produces the correct roll for `py` or `ny`. A naive
 * table derived that way puts both pole faces 180° out, which reads as a
 * seam break along all eight horizontal edges.
 *
 * Order matches `CUBE_FACE_ORDER` in `lib/pano/panoLoader.ts`, which is the
 * order `CubeTextureLoader` reads its six URLs in.
 */
export const CUBE_FACES = [
  { id: 'px', dir: [1, 0, 0], up: [0, 1, 0] },
  { id: 'nx', dir: [-1, 0, 0], up: [0, 1, 0] },
  { id: 'py', dir: [0, 1, 0], up: [0, 0, -1] },
  { id: 'ny', dir: [0, -1, 0], up: [0, 0, 1] },
  { id: 'pz', dir: [0, 0, 1], up: [0, 1, 0] },
  { id: 'nz', dir: [0, 0, -1], up: [0, 1, 0] },
] as const;

export type CubeFace = (typeof CUBE_FACES)[number];
export type CubeFaceId = CubeFace['id'];

/**
 * A cubemap face is 90° square.
 *
 * This is not the browse fov and must never inherit it: six faces at a
 * space's authored fov do not tile — they overlap or leave gaps, and the
 * result is a panorama that is wrong everywhere except dead centre.
 *
 * Necessary but not sufficient. The render target must also be square;
 * three's own `CubeCamera` pairs this constant with `aspect = 1`.
 */
export const CUBE_FACE_FOV = 90;
