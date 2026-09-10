import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests run in Node, not jsdom.
 *
 * What is worth testing here is logic that does not need a DOM: the enquiry
 * route's decision table, form validation, the geometry emitters, and the
 * collider's rules about which boxes become walls. Rendering is covered by
 * the axe and smoke passes against a real production build, which exercise
 * the actual browser rather than a simulation of one.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { reporter: ['text-summary'], include: ['lib/**', 'app/api/**'] },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
