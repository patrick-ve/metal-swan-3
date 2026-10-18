import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { offlineCache } from './tools/sw/plugin.ts';

/**
 * The build tag: git commit and build time. The sprite cache and the offline cache key on it, so
 * every build (every deploy) starts with fresh caches (docs/ARCHITECTURE.md §5.4).
 */
function buildTag(): string {
  let commit = process.env.GITHUB_SHA ?? '';
  if (!commit) {
    try {
      commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      commit = 'local';
    }
  }
  return `${commit.slice(0, 12)}-${Date.now().toString(36)}`;
}

const BUILD = buildTag();

export default defineConfig({
  base: './',
  define: { __MS3_BUILD__: JSON.stringify(BUILD) },
  plugins: [offlineCache(BUILD)],
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
