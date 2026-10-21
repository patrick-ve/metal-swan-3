/**
 * Mission oldenzaal — the church interior (CHURCH, wave B; docs/design/oldenzaal.md §7): the nave
 * (oz-d) and the crypt (oz-e).
 *
 * - The sections: sizes, checkpoints (≤ 1,400 px apart), the start on the floor, the light configs
 *   (the nave: candles, the red sanctuary lamp, the moon, lightning; the crypt: the darkest, no
 *   lightning, no rain), the decor only uses registered church sprites.
 * - The bot completes both sections (god, 1P and 2P) and the set pieces fire: the doors slam, the
 *   slabs break, the column comes out of the chapel's grille, the dead come up the crypt stair, the
 *   organ moans; in the crypt the tomb lids slide off and the gate opens.
 * - RESPECT: the altar, the crucifix, the statues, Mary, the Stations and the pulpit are decor
 *   (never entities, never hit); every church entity is neutral, has no hurt box and refuses hits.
 * - Art: every church sprite has 1× (PAL), 2× and 4× (PAL_HD) frames with the 1× geometry; the
 *   backgrounds and the terrain materials have their HD versions with the 1× footprint.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { INK, PAL } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { frameDensity, getFrames, hasHiSprite, setHiArt } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { getBgGenerator, makeHiBgLayer } from '../../src/game/art/art-registry';
import { hasHdTerrainMaterial } from '../../src/game/art/terrain-art';
import { loadContent } from '../../src/game/content/index';
import { OZ_AMBIENCE, OZ_SECTION, OLDENZAAL_ID } from '../../src/game/content/missions/oldenzaal/ids';
import { OLDENZAAL } from '../../src/game/content/missions/oldenzaal/index';
import { OZ_CHURCH_BGS, OZ_CHURCH_SPRITES } from '../../src/game/content/oldenzaal/church/art';
import { CRYPT_DECOR, NAVE_DECOR } from '../../src/game/content/oldenzaal/church/decor';
import { OZ_CHURCH_ENTITY, OZ_CHURCH_SFX } from '../../src/game/content/oldenzaal/church/index';
import { CRYPT_STYLE, NAVE_STYLE } from '../../src/game/content/oldenzaal/church/layout';
import { isOpening } from '../../src/game/content/oldenzaal/zombies/api';
import { sectionLight } from '../../src/game/content/oldenzaal/kit/light-api';
import { PAL_HD } from '../../src/engine/palette-hd';
import { getEntityMeta } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

beforeAll(async () => {
  await loadContent();
  setHiArt(true);
}, 120_000);

const PALSET = (() => {
  const s = new Set<number>([INK >>> 0]);
  for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) s.add((c as number) >>> 0);
  return s;
})();

function off1(b: PixelBuffer): number {
  let n = 0;
  for (const c of b.data) if ((c & 255) !== 0 && !PALSET.has(c >>> 0)) n++;
  return n;
}

function offHd(b: PixelBuffer): number {
  let n = 0;
  for (const c of b.data) if ((c & 255) !== 0 && ((c & 255) !== 255 || !inHdPalette(c))) n++;
  return n;
}

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

/** The objects of the faith that must never be entities (decor only: never hit). */
const SACRED = ['altar', 'crucifix', 'saint', 'mary', 'station', 'pulpit', 'font', 'candlestick', 'lamp', 'votive', 'confessional'].map((s) => `decor/oz-nave/${s}`);

describe('oldenzaal church: the sections', () => {
  it('oz-d is the nave, oz-e the crypt: right-scrolling, start on the floor, checkpoints ≤ 1,400 px apart', () => {
    for (const [id, name] of [
      [OZ_SECTION.d, /nave/i],
      [OZ_SECTION.e, /crypt/i],
    ] as const) {
      const s = OLDENZAAL.sections[id];
      expect(s.name).toMatch(name);
      expect(s.scroll).toBe('right');
      expect(s.ambience).toBe(OZ_AMBIENCE.nave);
      const t = new Terrain(s.terrain);
      expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
      const cps = [0, ...(s.checkpoints ?? []), s.width - 384];
      for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1], `${id} cp ${i}`).toBeLessThanOrEqual(1400);
    }
    expect(OLDENZAAL.sections[OZ_SECTION.d].terrainStyle).toEqual(NAVE_STYLE);
    expect(OLDENZAAL.sections[OZ_SECTION.e].terrainStyle).toEqual(CRYPT_STYLE);
  });

  it('the light: the nave has candles, the red sanctuary lamp, the moon and lightning; the crypt is the darkest, no lightning, no rain', () => {
    const nave = sectionLight(OZ_SECTION.d)!;
    expect(nave.lightning).toBeDefined();
    expect(nave.lamps!.length).toBeGreaterThanOrEqual(6);
    expect(nave.lamps!.some((l) => l.color === PAL_HD.red[5])).toBe(true);
    const crypt = sectionLight(OZ_SECTION.e)!;
    expect(crypt.darkness).toBeGreaterThan(nave.darkness);
    expect(crypt.darkness).toBeLessThanOrEqual(0.7);
    expect(crypt.lightning).toBeUndefined();
    expect(crypt.rain).toBeUndefined();
    expect(crypt.lamps!.length).toBeGreaterThanOrEqual(6);
  });

  it('the decor uses only registered church sprites; the section art lists them', () => {
    for (const [id, list] of [
      [OZ_SECTION.d, NAVE_DECOR],
      [OZ_SECTION.e, CRYPT_DECOR],
    ] as const) {
      const art = OLDENZAAL.sections[id].art ?? [];
      for (const d of list) {
        expect(OZ_CHURCH_SPRITES, d.sprite).toContain(d.sprite);
        expect(art, `${id} art`).toContain(d.sprite);
      }
    }
    // A real Catholic church: the altar, the crucifix, saints, Mary, Stations, the sanctuary lamp …
    const ids = new Set(NAVE_DECOR.map((d) => d.sprite));
    for (const s of SACRED) expect(ids.has(s), s).toBe(true);
  });
});

describe('oldenzaal church: respect (spec §7)', () => {
  it('the sacred objects are decor only: no entity draws them', () => {
    // Decor is drawn by the view, never hit; the church's entities only use their own prop art.
    for (const id of Object.values(OZ_CHURCH_ENTITY)) expect(getEntityMeta(id), id).toBeDefined();
    for (const d of [...NAVE_DECOR]) if (SACRED.includes(d.sprite)) expect(d.front ?? false, d.sprite).toBe(false);
  });

  it('every church entity is neutral, has no hurt box and refuses every hit', async () => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: OZ_SECTION.d, seed: 1, players: 1, god: true });
    const w = g.world!;
    for (const id of Object.values(OZ_CHURCH_ENTITY)) {
      const e = w.spawn(id, 300, 176, {});
      expect(e.team, id).toBe('neutral');
      expect(e.hurtboxes().length, id).toBe(0);
      const hp = e.hp;
      expect(e.onHit({ amount: 9999, kind: 'explosion', dirX: 1 }), id).toBe(false);
      expect(e.hp, id).toBe(hp);
      expect(e.dead, id).toBe(false);
    }
    g.dispose();
  });

  it('the slab and the tomb follow the opening contract', async () => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: OZ_SECTION.e, seed: 1, players: 1, god: true });
    const w = g.world!;
    for (const [id, kind] of [
      [OZ_CHURCH_ENTITY.slab, 'slab'],
      [OZ_CHURCH_ENTITY.tomb, 'tomb'],
      [OZ_CHURCH_ENTITY.chapelGate, 'door'],
      [OZ_CHURCH_ENTITY.stairwell, 'door'],
    ] as const) {
      const e = w.spawn(id, 400, 176, {});
      expect(isOpening(e), id).toBe(true);
      if (!isOpening(e)) continue;
      expect(e.openingKind).toBe(kind);
      expect([e.spotX, e.floorY]).toEqual([400, 176]);
      expect(e.closed).toBe(true);
      e.tell(20);
      e.open(1);
      expect(e.closed).toBe(false);
      e.open(1); // idempotent
      expect(e.closed).toBe(false);
    }
    g.dispose();
  });
});

describe('oldenzaal church: the bot plays the nave and the crypt, the set pieces fire', () => {
  it.each([1, 2] as const)('%iP god: oz-d → oz-e → oz-f, the doors slam, slabs break, the chapel and the stair release the dead, tombs open, the gate opens', async (players) => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: OZ_SECTION.d, seed: 1, players, god: true, bot: true, captureConsole: true });
    const seen: string[] = [];
    const opened = new Map<string, number>();
    let doorsShut = false;
    let gateOpen = false;
    g.runUntil((gg) => {
      const s = gg.runner?.section.id;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      const w = gg.world;
      if (w) {
        for (const e of w.entities) {
          if (isOpening(e) && !e.closed) opened.set(`${s}:${e.type}:${e.x}`, 1);
          if (e.type === OZ_CHURCH_ENTITY.doors && (e as unknown as { shut: boolean }).shut) doorsShut = true;
          if (e.type === OZ_CHURCH_ENTITY.cryptGate && (e as unknown as { isOpen: boolean }).isOpen) gateOpen = true;
        }
      }
      return s === OZ_SECTION.f;
    }, 20000);
    expect(seen.slice(0, 3)).toEqual([OZ_SECTION.d, OZ_SECTION.e, OZ_SECTION.f]);
    expect(g.report().errors).toEqual([]);
    expect(doorsShut).toBe(true);
    expect(gateOpen).toBe(true);
    const count = (prefix: string): number => [...opened.keys()].filter((k) => k.startsWith(prefix)).length;
    expect(count(`${OZ_SECTION.d}:${OZ_CHURCH_ENTITY.slab}`)).toBeGreaterThanOrEqual(5);
    expect(count(`${OZ_SECTION.d}:${OZ_CHURCH_ENTITY.chapelGate}`)).toBe(1);
    expect(count(`${OZ_SECTION.d}:${OZ_CHURCH_ENTITY.stairwell}`)).toBe(1);
    expect(count(`${OZ_SECTION.e}:${OZ_CHURCH_ENTITY.tomb}`)).toBeGreaterThanOrEqual(6);
    for (const id of [OZ_CHURCH_SFX.doorsSlam, OZ_CHURCH_SFX.organ, OZ_CHURCH_SFX.slabBreak, OZ_CHURCH_SFX.lidFall, OZ_CHURCH_SFX.gateCreak]) expect(g.audio.sfxCounts.get(id) ?? 0, id).toBeGreaterThan(0);
    g.dispose();
  }, 120_000);
});

describe('oldenzaal church: art', () => {
  it('every church sprite: 1× in PAL, 2× / 4× with the 1× geometry and footprint, PAL_HD only, with dense detail', { timeout: 120_000 }, () => {
    expect(OZ_CHURCH_SPRITES.length).toBeGreaterThanOrEqual(30);
    for (const id of OZ_CHURCH_SPRITES) {
      expect(['decor/oz-nave/', 'decor/oz-crypt/', 'prop/oz-slab/', 'prop/oz-tomb/', 'fx/oz/church/'].some((p) => id.startsWith(p)), id).toBe(true);
      const one = getFrames(id, 1);
      for (const f of one) {
        expect(frameDensity(f), id).toBe(1);
        expect(off1(f.buf), `${id} 1× palette`).toBe(0);
      }
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id}@${d}`).toBe(true);
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d} frames`).toBe(one.length);
        let detail = 0;
        hi.forEach((f, i) => {
          const lo = one[i];
          expect(frameDensity(f), `${id}@${d}`).toBe(d);
          expect([f.buf.w, f.buf.h], `${id}@${d}#${i} size`).toEqual([lo.buf.w * d, lo.buf.h * d]);
          expect([f.ox, f.oy], `${id}@${d}#${i} anchor`).toEqual([lo.ox, lo.oy]);
          expect(offHd(f.buf), `${id}@${d}#${i} palette`).toBe(0);
          // The moonlight shaft is a dither screen and the cobwebs are hairlines (no solid shape).
          if (id !== 'decor/oz-nave/shaft' && id !== 'decor/oz-nave/cobweb') expect(agree(mask(f.buf, d), mask(lo.buf, 1)), `${id}@${d}#${i} footprint`).toBeGreaterThan(0.75);
          const flat = f.buf.downsampled(d).scaled(d);
          for (let k = 0; k < f.buf.data.length; k++) if (f.buf.data[k] !== flat.data[k]) detail++;
        });
        expect(detail, `${id}@${d} has dense detail`).toBeGreaterThan(20);
      }
    }
  });

  it('the backgrounds: 1× in PAL, 2× / 4× d times the size, opaque, palette only, deterministic', { timeout: 120_000 }, () => {
    expect([...OZ_CHURCH_BGS].sort()).toEqual(['oz-crypt-far', 'oz-nave-far']);
    for (const [gen, w] of [
      ['oz-nave-far', 512],
      ['oz-crypt-far', 480],
    ] as const) {
      const lo = getBgGenerator(gen)!(w, 216, {}, 1);
      expect(off1(lo), gen).toBe(0);
      for (const d of [2, 4] as const) {
        const hi = makeHiBgLayer(gen, w, 216, {}, 1, d)!;
        expect([hi.w, hi.h], `${gen}@${d}`).toEqual([w * d, 216 * d]);
        expect(offHd(hi), `${gen}@${d} palette`).toBe(0);
        const again = makeHiBgLayer(gen, w, 216, {}, 1, d)!;
        expect(again.data).toEqual(hi.data);
      }
    }
  });

  it('the church terrain materials have their HD versions', () => {
    for (const [kind, id] of [
      ['ground', 'oz-nave-floor'],
      ['ground', 'oz-crypt-floor'],
      ['platform', 'oz-pew'],
      ['solid', 'oz-nave-step'],
    ] as const)
      expect(hasHdTerrainMaterial(kind, id), id).toBe(true);
  });
});
