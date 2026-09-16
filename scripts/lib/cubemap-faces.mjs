/**
 * Runtime mirror of `scripts/lib/cubemapFaces.ts`, for the `.mjs` scripts.
 *
 * Kept to ids only. The dir/up vectors are the render bridge's business and
 * live in the typed module, which is the single source the browser reads;
 * duplicating them here would be a second opinion about the cube basis, and
 * `tests/cubemap-faces.test.ts` guards the typed one.
 */
export const CUBE_FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
