/**
 * Sprite geometry sample for tests/engine/hires.test.ts: a digest of every frame's size, anchor
 * and named points for every 12th registered sprite id. The high-resolution backbuffer must not
 * change any of it (game logic reads anchors and points).
 */
import { frameH, frameW, getFrames, listSprites } from '../../src/engine/sprites';

export const SAMPLE_EVERY = 12;

/** Every SAMPLE_EVERY-th registered id (sorted). */
export function sampleIds(): string[] {
  return listSprites().filter((_, i) => i % SAMPLE_EVERY === 0);
}

/**
 * id → "w×h@ox,oy[name:x,y …]|…" (logical size) for the given ids (default: the sample), with the
 * frames of art density `density` (2: the 2× frames where an id has them).
 */
export function spriteGeometrySample(ids: readonly string[] = sampleIds(), density = 1): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ids) {
    out[id] = getFrames(id, density)
      .map((f) => {
        const pts = f.pts
          ? Object.keys(f.pts)
              .sort()
              .map((k) => `${k}:${f.pts?.[k][0]},${f.pts?.[k][1]}`)
              .join(' ')
          : '';
        return `${frameW(f)}x${frameH(f)}@${f.ox},${f.oy}[${pts}]`;
      })
      .join('|');
  }
  return out;
}
