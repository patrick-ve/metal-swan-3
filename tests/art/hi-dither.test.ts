/**
 * 2× art keeps its dither on whole logical pixels (docs/ART_GUIDE.md "2x art (mission ams)"): a
 * band dither at single-2×-px period reads as dotted rings. For every 2× fx, weapon and pickup
 * id, the share of "checker" 2× pixels (an opaque pixel whose four neighbours are one other
 * colour) stays low. Fine intentional detail (record grooves, gem facets, glints) stays well
 * under the limit; a 2× flame dithered per 2× pixel was about 0.04.
 */
import { describe, expect, it } from 'vitest';
import { getFrames, hasHiSprite, listSprites } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';

/** Highest allowed share of checker pixels among the opaque 2× pixels of an id. */
const MAX_CHECKER = 0.03;

/** Share of checker pixels among the opaque pixels of all 2× frames of `id`. */
function checkerShare(id: string): number {
  let all = 0;
  let checker = 0;
  for (const f of getFrames(id, 2)) {
    const { w, h, data } = f.buf;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const c = data[y * w + x];
        if ((c & 255) === 0) continue;
        all++;
        const l = data[y * w + x - 1];
        if ((l & 255) !== 0 && l !== c && l === data[y * w + x + 1] && l === data[(y - 1) * w + x] && l === data[(y + 1) * w + x]) checker++;
      }
    }
  }
  return all ? checker / all : 0;
}

describe('2× art: dither on logical pixels', () => {
  it('no 2× fx, weapon or pickup id dithers at single-2×-px period', async () => {
    await loadContent();
    const ids = listSprites().filter((id) => hasHiSprite(id) && /^(fx\/|weapon\/|item\/pickup|enemy\/(bullet|grenade)$)/.test(id));
    expect(ids).toContain('weapon/flame');
    expect(ids).toContain('fx/explosion-xl');
    const over = ids.map((id) => [id, checkerShare(id)] as const).filter(([, s]) => s > MAX_CHECKER);
    expect(over).toEqual([]);
  }, 120_000);
});
