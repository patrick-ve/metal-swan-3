import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    // Keep class names in the minified build: tools/smoke.ts finds scenes by
    // `constructor.name`, so the smoke test also works against the built (deployed) site.
    rolldownOptions: { output: { keepNames: true } },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
