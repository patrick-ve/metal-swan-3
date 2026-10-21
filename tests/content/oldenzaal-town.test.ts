/**
 * Mission oldenzaal — THE TOWN (wave A; docs/design/oldenzaal.md §2, §4.1, §10; docs/api/oldenzaal.md):
 * the town's art and the layout of oz-a and oz-b.
 *
 * - Every town sprite (`decor/oz/…`) has 1× art in the 64-colour PAL and 2× / 4× art with exactly
 *   its 1× frames' logical size and anchor (one drawer per id), in PAL_HD + PAL_HD_OZ only, new
 *   detail (not the 1× art scaled), deterministic.
 * - Every town background generator (`oz-…`) makes a 1× layer in PAL and 2× / 4× layers d times
 *   the size with the 1× footprint, palette only, deterministic.
 * - The terrain materials `oz-pavers`, `oz-ledge`, `oz-brick` have HD art with the 1× footprint.
 * - Layout: the start on the floor, checkpoints ≤ 1,400 px apart, exits inside, the decor on the
 *   collision (awnings, balconies on their platforms), the climb to the golden record's ledge in
 *   steps a jump makes, Meneer Wu's door inside De Smulhoek and the scene's lock, the light-pass
 *   lamps inside the sections, no mirrored lettering.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { INK, PAL } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { frameDensity, getFrames, hasHiSprite, setHiArt, spriteErrors } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { getBgGenerator, getTerrainPainter, makeHiBgLayer, makeHiTerrain } from '../../src/game/art/art-registry';
import { hasHdTerrainMaterial } from '../../src/game/art/terrain-art';
import { loadContent } from '../../src/game/content/index';
import { OZ_TOWN_BGS, OZ_TOWN_SPRITES } from '../../src/game/content/missions/oldenzaal/art';
import { OZ_A_DECOR, OZ_A_LAMP_LIGHTS, OZ_B_DECOR, OZ_B_LAMP_LIGHTS } from '../../src/game/content/missions/oldenzaal/art-layout';
import { SMULHOEK_W } from '../../src/game/content/missions/oldenzaal/art-smulhoek';
import { AWNING_H } from '../../src/game/content/missions/oldenzaal/art-street';
import { OZ_SECTION } from '../../src/game/content/missions/oldenzaal/ids';
import { OZ_RUIN_SPRITES } from '../../src/game/content/oldenzaal/ruin/art';
import { OLDENZAAL } from '../../src/game/content/missions/oldenzaal/index';
import {
  G,
  OZ_A_AWNINGS,
  OZ_A_BALCONIES,
  OZ_A_LEDGE,
  OZ_A_RECORD,
  OZ_B_DOOR_X,
  OZ_B_SMULHOEK_X,
  OZ_B_WU_ARENA,
  type Plat,
} from '../../src/game/content/missions/oldenzaal/terrain';
import { sectionLight } from '../../src/game/content/oldenzaal/kit/light-api';

beforeAll(async () => {
  await loadContent();
  setHiArt(true);
}, 120_000);

const PALSET = (() => {
  const s = new Set<number>([INK >>> 0]);
  for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) s.add((c as number) >>> 0);
  return s;
})();

/** Opaque px of a 1× buffer outside the 64-colour palette. */
function off1(b: PixelBuffer): number {
  let n = 0;
  for (const c of b.data) if ((c & 255) !== 0 && !PALSET.has(c >>> 0)) n++;
  return n;
}

/** Opaque px of a dense buffer outside PAL_HD + PAL_HD_OZ (or not fully opaque). */
function offHd(b: PixelBuffer): number {
  let n = 0;
  for (const c of b.data) if ((c & 255) !== 0 && ((c & 255) !== 255 || !inHdPalette(c))) n++;
  return n;
}

/** Logical opaque mask of a buffer of density d. */
function mask(b: PixelBuffer, d: number): Uint8Array {
  const w = b.w / d;
  const h = b.h / d;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if ((b.data[y * b.w + x] & 255) !== 0) m[Math.floor(y / d) * w + Math.floor(x / d)] = 1;
  return m;
}

function agree(a: Uint8Array, b: Uint8Array): number {
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}

describe('oldenzaal town: sprites', () => {
  it('registers the town sprites (decor/oz/…) with 1×, 2× and 4× art', () => {
    expect(OZ_TOWN_SPRITES.length).toBeGreaterThanOrEqual(14);
    for (const id of OZ_TOWN_SPRITES) {
      expect(id.startsWith('decor/oz/'), id).toBe(true);
      expect(hasHiSprite(id, 2), `${id}@2`).toBe(true);
      expect(hasHiSprite(id, 4), `${id}@4`).toBe(true);
    }
    for (const id of ['decor/oz/shop', 'decor/oz/smulhoek', 'decor/oz/lamp', 'decor/oz/signpost', 'decor/oz/awning', 'decor/oz/balcony']) expect(OZ_TOWN_SPRITES).toContain(id);
  });

  it('dense frames have the 1× geometry, palette only, new detail, deterministic', { timeout: 120_000 }, () => {
    for (const id of OZ_TOWN_SPRITES) {
      const one = getFrames(id, 1);
      for (const f of one) {
        expect(frameDensity(f), id).toBe(1);
        expect(off1(f.buf), `${id} 1× palette`).toBe(0);
      }
      for (const d of [2, 4] as const) {
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d} frames`).toBe(one.length);
        let detail = 0;
        hi.forEach((f, i) => {
          const lo = one[i];
          expect(frameDensity(f), `${id}@${d}`).toBe(d);
          expect([f.buf.w, f.buf.h], `${id}@${d}#${i} size`).toEqual([lo.buf.w * d, lo.buf.h * d]);
          expect([f.ox, f.oy], `${id}@${d}#${i} anchor`).toEqual([lo.ox, lo.oy]);
          expect(offHd(f.buf), `${id}@${d}#${i} palette`).toBe(0);
          // Outline C differs by design (1× : 1 px on the shadow side; dense: ½ px on both sides), so thin
          // railings and bars agree less than solid fronts.
          expect(agree(mask(f.buf, d), mask(lo.buf, 1)), `${id}@${d}#${i} footprint`).toBeGreaterThan(0.75);
          const flat = f.buf.downsampled(d).scaled(d);
          for (let k = 0; k < f.buf.data.length; k++) if (f.buf.data[k] !== flat.data[k]) detail++;
        });
        expect(detail, `${id}@${d} has dense detail`).toBeGreaterThan(20);
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('decor/oz/'))).toEqual([]);
  });
});

describe('oldenzaal town: backgrounds and terrain', () => {
  it('every town layer: 1× in PAL, 2× / 4× d times the size with the 1× footprint, palette only, deterministic', { timeout: 120_000 }, () => {
    expect([...OZ_TOWN_BGS].sort()).toEqual(['oz-basilica', 'oz-far', 'oz-roofs', 'oz-sky', 'oz-tower']);
    const cases: Array<readonly [string, Record<string, unknown>, number]> = [
      ['oz-sky', { light: 'dusk' }, 384],
      ['oz-sky', { light: 'late' }, 384],
      ['oz-sky', { light: 'night' }, 384],
      ['oz-far', { light: 'dusk' }, 768],
      ['oz-roofs', { light: 'late' }, 640],
      ['oz-tower', { light: 'dusk', s: 3.6, base: 160 }, 72],
      ['oz-basilica', { light: 'night' }, 320],
    ];
    for (const [id, params, w] of cases) {
      const one = getBgGenerator(id)(w, 216, params, 7);
      expect(off1(one), `${id} ${String(params.light)} 1× palette`).toBe(0);
      for (const d of [2, 4]) {
        const hi = makeHiBgLayer(id, w, 216, params, 7, d);
        expect(hi, `${id}@${d}`).not.toBeNull();
        if (!hi) continue;
        expect([hi.w, hi.h]).toEqual([w * d, 216 * d]);
        expect(offHd(hi), `${id}@${d} palette`).toBe(0);
        expect(agree(mask(hi, d), mask(one, 1)), `${id}@${d} footprint`).toBeGreaterThan(0.97);
        expect(Array.from(hi.data)).toEqual(Array.from((makeHiBgLayer(id, w, 216, params, 7, d) as PixelBuffer).data));
      }
    }
  });

  it('the town materials have HD art with the 1× footprint', () => {
    expect(hasHdTerrainMaterial('ground', 'oz-pavers')).toBe(true);
    expect(hasHdTerrainMaterial('platform', 'oz-ledge')).toBe(true);
    expect(hasHdTerrainMaterial('solid', 'oz-brick')).toBe(true);
    for (const id of [OZ_SECTION.a, OZ_SECTION.b]) {
      const s = OLDENZAAL.sections[id];
      const t = new Terrain(s.terrain);
      const sample = (x: number, y: number) => t.cellAt(x, y);
      for (const x0 of [0, 768]) {
        const one = getTerrainPainter()(sample, s.terrainStyle!, x0, 0, 256, 216);
        expect(off1(one), `${id} terrain 1× palette`).toBe(0);
        for (const d of [2, 4]) {
          const hi = makeHiTerrain(sample, s.terrainStyle!, x0, 0, 256, 216, d);
          expect(hi, `${id} terrain@${d}`).not.toBeNull();
          if (!hi) continue;
          expect(offHd(hi), `${id} terrain@${d} palette`).toBe(0);
          expect(agree(mask(hi, d), mask(one, 1))).toBe(1);
        }
      }
    }
  });
});

describe('oldenzaal town: the layout of oz-a and oz-b', () => {
  it.each([OZ_SECTION.a, OZ_SECTION.b])('%s: start on the floor, checkpoints ≤ 1,400 px apart, exits inside, decor registered', (id) => {
    const s = OLDENZAAL.sections[id];
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    const cps = [0, ...(s.checkpoints ?? []), s.width - 384];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1]).toBeLessThanOrEqual(1400);
    expect(s.exits?.length).toBeGreaterThan(0);
    for (const ex of s.exits ?? []) {
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
      expect(ex.rect.y + ex.rect.h).toBeGreaterThanOrEqual(G);
    }
    for (const dd of s.decor ?? []) {
      // The town's own sprites, or (revision 2) RUIN's worn-down extras.
      expect([...OZ_TOWN_SPRITES, ...OZ_RUIN_SPRITES], dd.sprite).toContain(dd.sprite);
      expect(s.art, dd.sprite).toContain(dd.sprite);
      // Our lettering is never mirrored (only a crow, which has none, may face the other way).
      if (dd.sprite !== 'decor/oz-ruin/crow') expect(dd.flipX ?? false, dd.sprite).toBe(false);
    }
    // The street is covered by fronts from end to end (no hole to the sky at street level wider than an alley).
    const shops = (s.decor ?? []).filter((dd) => dd.sprite === 'decor/oz/shop' || dd.sprite === 'decor/oz/smulhoek');
    expect(Math.min(...shops.map((dd) => dd.x))).toBeLessThanOrEqual(0);
  });

  it('awnings and balconies sit on their platforms; the ledge of the golden record is a climb of jumps', () => {
    const s = OLDENZAAL.sections[OZ_SECTION.a];
    const t = new Terrain(s.terrain);
    const decorAt = (sprite: string, [x, y]: Plat) => (s.decor ?? []).some((dd) => dd.sprite === sprite && dd.x === x && dd.y === y);
    for (const p of OZ_A_AWNINGS) {
      expect(decorAt('decor/oz/awning', p), `awning ${p}`).toBe(true);
      expect(t.surfaceY(p[0] + p[2] / 2, p[1] - 2, p[1] + 2)).toBe(p[1]);
      // An awning is one jump from the street.
      expect(G - p[1]).toBeLessThanOrEqual(36);
      expect(G - p[1] - AWNING_H).toBeGreaterThan(4);
    }
    for (const p of [...OZ_A_BALCONIES, OZ_A_LEDGE]) {
      expect(decorAt('decor/oz/balcony', p), `balcony ${p}`).toBe(true);
      // Each is one jump (≤ 36 px) above a platform or the street under it.
      const below = [...OZ_A_AWNINGS, ...OZ_A_BALCONIES].filter((q) => q[1] > p[1] && q[0] < p[0] + p[2] && q[0] + q[2] > p[0]).map((q) => q[1]);
      const step = Math.min(G, ...below) - p[1];
      expect(step, `step to ${p}`).toBeLessThanOrEqual(36);
    }
    const [rx, ry] = OZ_A_RECORD;
    expect(rx).toBeGreaterThanOrEqual(OZ_A_LEDGE[0]);
    expect(rx).toBeLessThanOrEqual(OZ_A_LEDGE[0] + OZ_A_LEDGE[2]);
    expect(ry).toBeLessThan(OZ_A_LEDGE[1]);
  });

  it('De Smulhoek: Meneer Wu\'s door inside the building and the scene\'s lock; the warm lights', () => {
    const s = OLDENZAAL.sections[OZ_SECTION.b];
    expect((s.decor ?? []).some((dd) => dd.sprite === 'decor/oz/smulhoek' && dd.x === OZ_B_SMULHOEK_X)).toBe(true);
    expect(OZ_B_DOOR_X).toBeGreaterThan(OZ_B_SMULHOEK_X);
    expect(OZ_B_DOOR_X).toBeLessThan(OZ_B_SMULHOEK_X + SMULHOEK_W);
    expect(OZ_B_WU_ARENA[1] - OZ_B_WU_ARENA[0]).toBe(384);
    expect(OZ_B_DOOR_X).toBeGreaterThan(OZ_B_WU_ARENA[0]);
    expect(OZ_B_DOOR_X).toBeLessThan(OZ_B_WU_ARENA[1]);
    // The warm lights of the building are around it (and in the section).
    const warm = OZ_B_LAMP_LIGHTS.filter((l) => l.x >= OZ_B_SMULHOEK_X && l.x <= OZ_B_SMULHOEK_X + SMULHOEK_W);
    expect(warm.length).toBeGreaterThanOrEqual(5);
  });

  it('the light configs list the street lamps inside their sections', () => {
    for (const [id, lamps] of [
      [OZ_SECTION.a, OZ_A_LAMP_LIGHTS],
      [OZ_SECTION.b, OZ_B_LAMP_LIGHTS],
    ] as const) {
      const l = sectionLight(id);
      expect(l?.lamps).toBe(lamps);
      const w = OLDENZAAL.sections[id].width;
      for (const lamp of lamps) {
        expect(lamp.x).toBeGreaterThanOrEqual(0);
        expect(lamp.x).toBeLessThanOrEqual(w);
        expect(lamp.y).toBeGreaterThan(0);
        expect(lamp.y).toBeLessThan(G);
        expect(inHdPalette(lamp.color)).toBe(true);
      }
    }
    // Revision 2: only the lamps that still burn (frame 0) light up (both heads), plus the
    // emergency sign's amber lamp.
    expect(OZ_A_DECOR.filter((d) => d.sprite === 'decor/oz/lamp' && (d.frame ?? 0) === 0).length * 2 + 1).toBe(OZ_A_LAMP_LIGHTS.length);
    expect(OZ_B_DECOR.filter((d) => d.sprite === 'decor/oz/lamp').length).toBeGreaterThan(3);
  });
});
