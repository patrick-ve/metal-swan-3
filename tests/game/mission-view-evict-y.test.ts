/**
 * Vertical chunk eviction (src/game/mission/view.ts `evictRows`, an opt-in; docs/design/
 * oldenzaal.md §10.2): a tall section that scrolls up keeps only the dense chunks near the camera;
 * without the opt-in every dense chunk it showed stays (the old behaviour, unchanged).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PAL } from '../../src/engine/palette';
import { PixelBuffer } from '../../src/engine/pixel';
import { SoftRenderer } from '../../src/engine/render-soft';
import { setArtTier } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { setHdTerrainPainter, setTerrainPainter } from '../../src/game/art/art-registry';
import type { SectionDef } from '../../src/game/mission/types';
import { CHUNK, EVICT_ROWS_AWAY, SectionView } from '../../src/game/mission/view';

const W = 384;
const H = 1800;
/** A wall on both sides and a ledge every 72 px: every chunk has opaque terrain. */
const def: SectionDef = {
  id: 'evict-y',
  width: W,
  height: H,
  scroll: 'up',
  background: { sky: PAL.navy[1], layers: [] },
  terrain: {
    bounds: { x: 0, y: 0, w: W, h: H },
    ground: [[[0, H - 20], [W, H - 20]]],
    platforms: Array.from({ length: Math.floor(H / 72) }, (_, i) => [[40, 40 + i * 72], [W - 40, 40 + i * 72]] as [number, number][]),
    solids: [
      { x: 0, y: 0, w: 24, h: H },
      { x: W - 24, y: 0, w: 24, h: H },
    ],
    hazards: [],
  },
  terrainStyle: { ground: 'evict-y-ground' },
  playerStart: { x: 192, y: H - 20 },
  *script() {},
};

function setup(): void {
  setTerrainPainter((sample, _style, x0, y0, w, h) => {
    const b = new PixelBuffer(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sample(x0 + x, y0 + y) !== 0) b.set(x, y, PAL.stone[2]);
    return b;
  });
  setHdTerrainPainter(
    (sample, _style, x0, y0, w, h, d) => {
      const b = new PixelBuffer(w * d, h * d);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sample(x0 + x, y0 + y) !== 0) b.rect(x * d, y * d, d, d, PAL.stone[3]);
      return b;
    },
    (style, d) => style.ground === 'evict-y-ground' && d === 4,
    [4],
  );
}

/** Climb from the bottom to the top in 48 px steps, drawing every step at res 4; the peak count. */
function climb(view: SectionView): number {
  let peak = 0;
  for (let y = H - 216; y >= 0; y -= 48) {
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 4 });
    r.begin(view.sky);
    r.setCamera(0, y);
    view.drawBack(r, 0);
    view.drawFront(r, 0);
    r.end();
    peak = Math.max(peak, view.hiChunkCount(4));
  }
  return peak;
}

afterEach(() => setArtTier(2));

describe('vertical (y) chunk eviction', () => {
  it('is off by default; a 1,800 px tall section then keeps every dense chunk it showed', () => {
    setup();
    setArtTier(4);
    const view = new SectionView(def, new Terrain(def.terrain), 3, 4);
    expect(view.evictRows).toBe(false);
    climb(view);
    const rows = Math.ceil(H / CHUNK);
    expect(view.hiChunkCount(4)).toBeGreaterThanOrEqual(rows * 2);
    expect(view.evicted).toBe(0);
  });

  it('with evictRows a 1,800 px tall section keeps only the dense chunks near the camera', () => {
    setup();
    setArtTier(4);
    const view = new SectionView(def, new Terrain(def.terrain), 3, 4);
    view.evictRows = true;
    const peak = climb(view);
    // The view spans at most 2 chunk rows; kept: those and the rows inside EVICT_ROWS_AWAY
    // (exclusive) above and below, over the 2 visible columns and the 2 the x prefetch probes
    // (left and right of the section: empty, recorded as null entries, which count too).
    const cols = Math.ceil(W / CHUNK) + 2;
    expect(peak).toBeLessThanOrEqual((2 + 2 * (EVICT_ROWS_AWAY - 1)) * cols);
    expect(view.hiChunkCount(4)).toBeLessThanOrEqual((2 + 2 * (EVICT_ROWS_AWAY - 1)) * cols);
    expect(view.evicted).toBeGreaterThan(0);
    // The rows at the bottom are gone, the top rows are there.
    const v = view as unknown as { hiChunkMaps: Record<4, Map<number, unknown>> };
    const rowsKept = [...v.hiChunkMaps[4].keys()].map((k) => Math.floor(k / 65536) - 64);
    expect(Math.max(...rowsKept)).toBeLessThan(Math.floor((H - 1) / CHUNK) - 1);
    expect(Math.min(...rowsKept)).toBeLessThanOrEqual(0);
  });

  it('a section coming back down rebuilds the released chunks', () => {
    setup();
    setArtTier(4);
    const view = new SectionView(def, new Terrain(def.terrain), 3, 4);
    view.evictRows = true;
    climb(view);
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 4 });
    r.begin(view.sky);
    r.setCamera(0, H - 216);
    view.drawBack(r, 0);
    r.end();
    const bottomRow = Math.floor((H - 1) / CHUNK);
    expect(view.hiChunk(0, bottomRow, 4)).not.toBeNull();
  });
});
