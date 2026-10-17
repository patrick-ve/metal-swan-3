/**
 * The first-person mode's art (docs/design/fps.md §8): every id of §8.1–§8.5 exists with its
 * size and frame count, every texel is a palette colour, wall textures tile without a seam, no
 * id falls back to the magenta checker, and the 8-yaw billboards really differ per yaw.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import {
  billboardColumns,
  getRayBillboard,
  hasRayBillboard,
  hasRayTexture,
  RAY_TEX,
  rayTextureColumns,
  rayTextureIndex,
} from '../../src/engine/ray';
import { getFrames, hasSprite, spriteErrors } from '../../src/engine/sprites';

const TEXTURES = [
  'concrete', 'concrete-banner', 'brick', 'brick-notice', 'crates', 'wood', 'wood-map', 'steel', 'steel-vent',
  'hangar', 'hangar-banner', 'freight', 'tile', 'cellar', 'sandbags', 'steel-pipes', 'switch', 'switch-on', 'elevator',
].map((t) => `fps/wall/${t}`).concat(['plain', 'gold', 'silver', 'lift', 'edge'].map((d) => `fps/door/${d}`));

const ITEMS = [
  'first-aid', 'food', 'ration', 'blood-pool', 'clip', 'clip-drop', 'mg', 'chaingun', 'one-up', 'key-gold', 'key-silver',
  'pocket-watch', 'tuning-fork', 'gold-bars', 'music-box', 'golden-record',
];
const PROPS = ['barrel', 'crates', 'pillar', 'table', 'banner-pole', 'lamp-stand', 'sandbags', 'oil-drum', 'ceiling-lamp', 'debris', 'chains'];

/** [id, size, yaws, frames] (§8.2). */
const BILLBOARDS: ReadonlyArray<readonly [string, number, number, number]> = [
  ...(['guard', 'officer', 'ss'] as const).flatMap((k) => [
    [`fps/${k}/move`, 64, 8, 5] as const,
    [`fps/${k}/act`, 64, 1, 8] as const,
  ]),
  ['fps/dog/move', 64, 8, 5],
  ['fps/dog/act', 64, 1, 6],
  ['fps/boss/mech/move', 96, 8, 5],
  ['fps/boss/mech/act', 96, 1, 9],
  ['fps/boss/foot/move', 64, 8, 5],
  ['fps/boss/foot/act', 64, 1, 11],
  ['fps/boss/wreck', 96, 1, 1],
  ['fps/fx/blood-pool', 64, 1, 3],
  ['fps/fx/spurt', 64, 1, 3],
  ['fps/fx/sparks', 96, 1, 3],
  ...ITEMS.map((i) => [`fps/item/${i}`, 64, 1, 1] as const),
  ...PROPS.map((p) => [`fps/prop/${p}`, 64, 1, 1] as const),
];

/** [id, w, h, frames] (§8.3–§8.5). */
const SPRITES: ReadonlyArray<readonly [string, number, number, number]> = [
  ...['knife', 'pistol', 'mg', 'chaingun'].map((w) => [`fps/view/${w}`, 112, 80, 4] as const),
  ...['vincent', 'thom', 'dirk', 'bob', 'patrick', 'recruit'].map((c) => [`fps/face/${c}`, 32, 32, 24] as const),
  ['fps/hud/bar', 384, 40, 1],
  ['fps/hud/weapon', 48, 20, 4],
  ['fps/hud/key', 8, 14, 2],
];

const warn = vi.spyOn(console, 'warn');

beforeAll(async () => {
  await import('../../src/game/content/fps/art');
}, 60_000);

function offPalette(px: Iterable<number>): number {
  let n = 0;
  for (const c of px) if ((c & 255) !== 0 && !inPalette(c)) n++;
  return n;
}

describe('fps wall and door textures (§8.1)', () => {
  it.each(TEXTURES)('%s exists, palette-only, opaque', (id) => {
    expect(hasRayTexture(id)).toBe(true);
    const cols = rayTextureColumns(rayTextureIndex(id));
    expect(cols.length).toBe(RAY_TEX * RAY_TEX);
    expect(offPalette(cols)).toBe(0);
    expect(offPalette(rayTextureColumns(rayTextureIndex(id), true))).toBe(0);
  });

  // walls repeat along a run of cells; a door slab stands alone in its cell (framed on purpose)
  it.each(TEXTURES.filter((id) => id.startsWith('fps/wall/')))('%s tiles without a seam (left / right edges)', (id) => {
    const cols = rayTextureColumns(rayTextureIndex(id));
    const diff = (u0: number, u1: number): number => {
      let d = 0;
      for (let v = 0; v < RAY_TEX; v++) if (cols[u0 * RAY_TEX + v] !== cols[u1 * RAY_TEX + v]) d++;
      return d;
    };
    let sum = 0;
    let max = 0;
    for (let u = 0; u < RAY_TEX - 1; u++) {
      const d = diff(u, u + 1);
      sum += d;
      max = Math.max(max, d);
    }
    // the wrap from column 63 to column 0 is no harsher than the texture's own column steps
    expect(diff(RAY_TEX - 1, 0)).toBeLessThanOrEqual(Math.max(max, (sum / (RAY_TEX - 1)) * 2 + 4));
  });
});

describe('fps wall textures: no dark seam on the eye line', () => {
  // At eyeZ 0.5 the texture rows v 28–36 land on the horizon row at every distance: a dark joint
  // there joins into one flat line across every wall in view (it read as a render seam).
  const lum = (c: number): number => ((c >>> 24) & 255) * 0.3 + ((c >>> 16) & 255) * 0.59 + ((c >>> 8) & 255) * 0.11;
  it.each(['fps/wall/concrete', 'fps/wall/steel', 'fps/wall/hangar', 'fps/wall/concrete-banner', 'fps/wall/hangar-banner', 'fps/wall/steel-pipes'])('%s', (id) => {
    const cols = rayTextureColumns(rayTextureIndex(id));
    let total = 0;
    for (const c of cols) total += lum(c);
    const mean = total / cols.length;
    for (let v = 28; v <= 36; v++) {
      let row = 0;
      for (let u = 0; u < RAY_TEX; u++) row += lum(cols[u * RAY_TEX + v]);
      expect(row / RAY_TEX, `${id} row ${v}`).toBeGreaterThan(mean * 0.55);
    }
  });
});

describe('fps billboards (§8.2)', () => {
  it.each(BILLBOARDS)('%s: size %i, %i yaws, %i frames, palette-only, not empty', (id, size, yaws, frames) => {
    expect(hasRayBillboard(id)).toBe(true);
    const bb = getRayBillboard(id);
    expect([bb.size, bb.yaws, bb.frames]).toEqual([size, yaws, frames]);
    for (let f = 0; f < frames; f++) {
      for (let y = 0; y < yaws; y++) {
        const cols = billboardColumns(bb, f, y);
        expect(cols.length).toBe(size * size);
        expect(offPalette(cols)).toBe(0);
        let opaque = 0;
        for (const c of cols) if ((c & 255) !== 0) opaque++;
        expect(opaque, `${id} frame ${f} yaw ${y}`).toBeGreaterThan(8);
      }
    }
  });

  it('the 8-yaw actors look different from the front, the side and the back', () => {
    for (const id of ['fps/guard/move', 'fps/dog/move', 'fps/boss/mech/move', 'fps/boss/foot/move']) {
      const bb = getRayBillboard(id);
      const a = billboardColumns(bb, 0, 0);
      const s = billboardColumns(bb, 0, 2);
      const b = billboardColumns(bb, 0, 4);
      expect(a).not.toEqual(s);
      expect(a).not.toEqual(b);
      // yaw 6 is the registry's mirror of yaw 2
      const m = billboardColumns(bb, 0, 6);
      const N = bb.size;
      expect(m.slice(0, N)).toEqual(s.slice((N - 1) * N, N * N));
    }
  });

  it('no fps art id falls back to the magenta checker', () => {
    const fallbacks = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('[ray]') && m.includes('fps/'));
    expect(fallbacks).toEqual([]);
  });
});

describe('fps weapon views, faces and status bar (§8.3–§8.5)', () => {
  it.each(SPRITES)('%s: %i × %i, %i frames, palette-only', (id, w, h, frames) => {
    expect(hasSprite(id)).toBe(true);
    const fr = getFrames(id);
    expect(fr.length).toBe(frames);
    for (const f of fr) {
      expect([f.buf.w, f.buf.h]).toEqual([w, h]);
      expect(offPalette(f.buf.data)).toBe(0);
    }
    expect(spriteErrors().filter((e) => e.id.startsWith(id))).toEqual([]);
  });

  it('the weapon views are anchored bottom-centre', () => {
    for (const id of ['fps/view/knife', 'fps/view/pistol', 'fps/view/mg', 'fps/view/chaingun']) {
      const f = getFrames(id)[0];
      expect([f.ox, f.oy]).toEqual([56, 80]);
    }
  });

  it('a face has distinct glances, grin, ouch and dead frames', () => {
    const fr = getFrames('fps/face/dirk');
    expect(fr[0].buf.data).not.toEqual(fr[2].buf.data);
    expect(fr[1].buf.data).not.toEqual(fr[19].buf.data);
    expect(fr[21].buf.data).not.toEqual(fr[1].buf.data);
    expect(fr[22].buf.data).not.toEqual(fr[1].buf.data);
    expect(fr[23].buf.data).not.toEqual(fr[1].buf.data);
  });
});
