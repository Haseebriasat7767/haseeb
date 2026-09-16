import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Runs the scene exporter. Separate from `vitest.config.ts` so the export is
 * not part of `npm run check` — it writes a file, which a test run should
 * not do, and it is a build step that happens to need the test runner's
 * module resolution.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/blender/export-scene.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('../..', import.meta.url)) },
  },
});
