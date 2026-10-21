/**
 * Mission oldenzaal, revision 2 — THE RUIN (RUIN; docs/design/oldenzaal.md §3.3, §10.3, R2-2,
 * R2-5, R2-7; docs/api/oldenzaal.md R2.5): the town abandoned and worn down after the outbreak.
 *
 * - Art: every ruin sprite (`decor/oz-ruin/…`, `prop/oz-boarded/…`, `prop/oz-manhole/…`) has 1× art
 *   in the 64-colour PAL and 2× / 4× art with its 1× frames' logical size and anchor, in the HD
 *   palettes (with `PAL_HD_OZ_R2`), new detail, deterministic; no red blood anywhere is moot here,
 *   but the banners stay few (R2-2).
 * - The openings (`oz-boarded`, `oz-manhole`) keep THE OPENING CONTRACT: the tag, tell → telling,
 *   open() idempotent and broken for good, never hit; a zombie's 'burst' / 'manhole' entrance
 *   opens them.
 * - Layout: every boarded opening sits exactly on a shop's window / door; none in Meneer Wu's
 *   lock; openings, cars, walls and rise spots never overlap; the car roofs are platforms; the
 *   arenas are wider than a view; checkpoints ≤ 1,400 px apart; most lamps dead.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { INK, PAL } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { frameDensity, getFrames, hasHiSprite, setHiArt, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { OZ_A_DECOR, OZ_A_LAMP_LIGHTS, OZ_A_LAMPS, OZ_A_LIT, OZ_B_DECOR, OZ_B_LAMPS, OZ_B_LIT } from '../../src/game/content/missions/oldenzaal/art-layout';
import { SHOP_DOOR_W, SHOPS, shopDoorX, shopWindowX } from '../../src/game/content/missions/oldenzaal/art-street';
import { OLDENZAAL_ID, OZ_RUIN, OZ_SECTION } from '../../src/game/content/missions/oldenzaal/ids';
import { OLDENZAAL } from '../../src/game/content/missions/oldenzaal/index';
import {
  carRoofs,
  G,
  OZ_A_ARENAS,
  OZ_A_CARS,
  OZ_A_OPENINGS,
  OZ_A_RISE,
  OZ_A_SHOPS,
  OZ_A_W,
  OZ_A_WALLS,
  OZ_B_ARENAS,
  OZ_B_CARS,
  OZ_B_OPENINGS,
  OZ_B_RISE,
  OZ_B_SHOPS,
  OZ_B_W,
  OZ_B_WALLS,
  OZ_B_WU_ARENA,
  type Block,
  type OzCar,
} from '../../src/game/content/missions/oldenzaal/terrain';
import { CAR_W, OZ_RUIN_SPRITES } from '../../src/game/content/oldenzaal/ruin/art';
import { OzBoarded, OzManhole, openingNear, placeRuin, ruinOpenings, ruinSpotX, type RuinOpeningDef } from '../../src/game/content/oldenzaal/ruin/index';
import { isOpening, OZ_OPENING_TAG, spawnZombie } from '../../src/game/content/oldenzaal/zombies/api';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';

beforeAll(async () => {
  await loadContent();
  setHiArt(true);
}, 120_000);

let g: HeadlessGame | null = null;
afterEach(() => {
  g?.dispose();
  g = null;
});

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

describe('oldenzaal ruin: art', () => {
  it('registers the ruin sprites under RUIN\'s prefixes with 1×, 2× and 4× art', () => {
    expect(OZ_RUIN_SPRITES.length).toBeGreaterThanOrEqual(16);
    for (const id of OZ_RUIN_SPRITES) {
      expect(['decor/oz-ruin/', 'prop/oz-boarded/', 'prop/oz-manhole/'].some((p) => id.startsWith(p)), id).toBe(true);
      expect(hasHiSprite(id, 2), `${id}@2`).toBe(true);
      expect(hasHiSprite(id, 4), `${id}@4`).toBe(true);
    }
    for (const id of ['prop/oz-boarded/window', 'prop/oz-boarded/door', 'prop/oz-manhole/cover', 'decor/oz-ruin/car', 'decor/oz-ruin/banner', 'decor/oz-ruin/barrier', 'decor/oz-ruin/tape', 'decor/oz-ruin/sign']) expect(OZ_RUIN_SPRITES).toContain(id);
  });

  it('dense frames have the 1× geometry, palette only, new detail, deterministic', { timeout: 120_000 }, () => {
    for (const id of OZ_RUIN_SPRITES) {
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
          expect([f.buf.w, f.buf.h], `${id}@${d}#${i} size`).toEqual([lo.buf.w * d, lo.buf.h * d]);
          expect([f.ox, f.oy], `${id}@${d}#${i} anchor`).toEqual([lo.ox, lo.oy]);
          expect(offHd(f.buf), `${id}@${d}#${i} palette`).toBe(0);
          // Thin things (tape, weeds, glints) agree less than solid ones.
          expect(agree(mask(f.buf, d), mask(lo.buf, 1)), `${id}@${d}#${i} footprint`).toBeGreaterThan(0.7);
          const flat = f.buf.downsampled(d).scaled(d);
          for (let k = 0; k < f.buf.data.length; k++) if (f.buf.data[k] !== flat.data[k]) detail++;
        });
        expect(detail, `${id}@${d} has dense detail`).toBeGreaterThan(10);
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('decor/oz-ruin/') || e.id.startsWith('prop/oz-'))).toEqual([]);
  });

  it('the boarded window frames match the shop windows\' widths; intact and broken differ', () => {
    const widths = new Set(SHOPS.map((s) => shopWindowX(s).w));
    const frames = getFrames('prop/oz-boarded/window', 1);
    expect(frames.length).toBe(widths.size * 2);
    const ws = [...frames].map((f) => f.buf.w - 2);
    for (const w of widths) expect(ws, `window ${w}`).toContain(w);
    for (let i = 0; i < frames.length; i += 2) expect(frames[i].buf.data).not.toEqual(frames[i + 1].buf.data);
  });
});

describe('oldenzaal ruin: the openings (THE OPENING CONTRACT)', () => {
  async function street(): Promise<HeadlessGame> {
    g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: OZ_SECTION.c, seed: 5, players: 1, god: true, bot: false, captureConsole: true });
    g.step(2);
    return g;
  }

  it('oz-boarded: the tag, tell → telling, open → broken for good, never hit', async () => {
    const game = await street();
    const w = game.world!;
    const b = w.spawn(OZ_RUIN.boarded, 0, G, { kind: 'window', left: 200, w: 35 }) as OzBoarded;
    const d = w.spawn(OZ_RUIN.boarded, 0, G, { kind: 'door', left: 300 }) as OzBoarded;
    game.step(1);
    expect(isOpening(b)).toBe(true);
    expect(w.byTag(OZ_OPENING_TAG)).toContain(b);
    expect([b.openingKind, b.spotX, b.floorY, b.closed, b.busy]).toEqual(['window', 217.5, G, true, false]);
    expect([d.openingKind, d.spotX]).toEqual(['door', 300 + SHOP_DOOR_W / 2]);
    expect(b.hurtboxes().length).toBe(0);
    expect(b.contactBoxes().length).toBe(0);
    b.tell(24);
    expect(b.telling).toBe(true);
    game.step(24);
    expect(b.telling).toBe(false);
    expect(b.closed).toBe(true);
    b.open(1);
    expect(b.closed).toBe(false);
    b.open(-1);
    b.tell(20);
    expect([b.closed, b.telling]).toEqual([false, false]);
    expect(game.stats.errorList()).toEqual([]);
  });

  it('oz-manhole: tell, open; a zombie\'s manhole and burst entrances open their openings', async () => {
    const game = await street();
    const w = game.world!;
    const m = w.spawn(OZ_RUIN.manhole, 260, G, {}) as OzManhole;
    const b = w.spawn(OZ_RUIN.boarded, 0, G, { kind: 'door', left: 330 }) as OzBoarded;
    game.step(1);
    expect(isOpening(m)).toBe(true);
    expect(m.openingKind).toBe('manhole');
    spawnZombie(w, 'grunt', m.spotX, 'ground', { kind: 'manhole', target: m });
    spawnZombie(w, 'grunt', b.spotX, 'ground', { kind: 'burst', target: b });
    let told = false;
    for (let t = 0; t < 400 && (m.closed || b.closed); t++) {
      game.step(1);
      if (m.telling || b.telling) told = true;
    }
    expect(told).toBe(true);
    expect(m.closed).toBe(false);
    expect(b.closed).toBe(false);
  });

  it('placeRuin spawns a section\'s openings; the finders see the closed ones a tick later', async () => {
    const game = await street();
    const w = game.world!;
    const defs: RuinOpeningDef[] = [
      { kind: 'manhole', x: 120, y: G },
      { kind: 'window', x: 200, y: G, w: 31 },
      { kind: 'door', x: 400, y: G },
    ];
    const ents = placeRuin(w, defs);
    expect(ents.map((e) => e.openingKind)).toEqual(['manhole', 'window', 'door']);
    expect(ents.map((e) => e.spotX)).toEqual(defs.map(ruinSpotX));
    game.step(1);
    expect(ruinOpenings(w).length).toBe(3);
    expect(openingNear(w, 230)?.openingKind).toBe('window');
    expect(openingNear(w, 230, 'manhole')?.spotX).toBe(120);
    ents[1].open(0);
    expect(openingNear(w, 230, 'window')).toBeNull();
  });

  it('oz-a and oz-b place their openings at the start (the layout)', async () => {
    for (const [sec, defs] of [
      [OZ_SECTION.a, OZ_A_OPENINGS],
      [OZ_SECTION.b, OZ_B_OPENINGS],
    ] as const) {
      g?.dispose();
      g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: sec, seed: 1, players: 1, god: true, bot: false, captureConsole: true });
      g.step(3);
      const found = g.world!.byTag(OZ_OPENING_TAG).filter((e) => e instanceof OzBoarded || e instanceof OzManhole);
      expect(found.length, sec).toBe(defs.length);
    }
  });
});

describe('oldenzaal ruin: the layout of oz-a and oz-b', () => {
  type Shop = { frame: number; x: number };
  const sections = [
    { id: 'oz-a', w: OZ_A_W, shops: OZ_A_SHOPS as readonly Shop[], openings: OZ_A_OPENINGS, cars: OZ_A_CARS, walls: OZ_A_WALLS, rise: OZ_A_RISE, arenas: Object.values(OZ_A_ARENAS), decor: OZ_A_DECOR },
    { id: 'oz-b', w: OZ_B_W, shops: OZ_B_SHOPS as readonly Shop[], openings: OZ_B_OPENINGS, cars: OZ_B_CARS, walls: OZ_B_WALLS, rise: OZ_B_RISE, arenas: Object.values(OZ_B_ARENAS), decor: OZ_B_DECOR },
  ] as const;

  /** The x span an opening / car / wall takes on the street. */
  const spanOf = (o: RuinOpeningDef): [number, number] => (o.kind === 'manhole' ? [o.x - 9, o.x + 21] : [o.x - 1, o.x + (o.kind === 'door' ? SHOP_DOOR_W : o.w ?? 0) + 1]);
  const carSpan = (c: OzCar): [number, number] => [c.x, c.x + CAR_W];
  const wallSpan = (b: Block): [number, number] => [b[0], b[0] + b[2]];
  const overlap = (a: [number, number], b: [number, number]): boolean => a[0] < b[1] && b[0] < a[1];

  it('every boarded opening is exactly a shop\'s window or door', () => {
    for (const s of sections) {
      for (const o of s.openings) {
        if (o.kind === 'manhole') continue;
        const hit = s.shops.some((sh) => {
          const spec = SHOPS[sh.frame];
          if (o.kind === 'door') return sh.x + shopDoorX(spec) === o.x;
          const wx = shopWindowX(spec);
          return sh.x + wx.x === o.x && wx.w === o.w;
        });
        expect(hit, `${s.id} ${o.kind} at ${o.x}`).toBe(true);
      }
    }
  });

  it('openings, cars, walls and rise spots never overlap; all inside the section', () => {
    for (const s of sections) {
      const spans: Array<[string, [number, number]]> = [
        ...s.openings.map((o): [string, [number, number]] => [`${o.kind}@${o.x}`, spanOf(o)]),
        ...s.cars.map((c): [string, [number, number]] => [`car@${c.x}`, carSpan(c)]),
        ...s.walls.map((b): [string, [number, number]] => [`wall@${b[0]}`, wallSpan(b)]),
      ];
      for (let i = 0; i < spans.length; i++) {
        expect(spans[i][1][0], `${s.id} ${spans[i][0]}`).toBeGreaterThan(0);
        expect(spans[i][1][1], `${s.id} ${spans[i][0]}`).toBeLessThan(s.w - 24);
        for (let j = i + 1; j < spans.length; j++) expect(overlap(spans[i][1], spans[j][1]), `${s.id} ${spans[i][0]} × ${spans[j][0]}`).toBe(false);
      }
      for (const x of s.rise) {
        for (const [name, sp] of spans) expect(overlap([x - 24, x + 24], sp), `${s.id} rise ${x} × ${name}`).toBe(false);
      }
    }
  });

  it('Meneer Wu\'s corner stays calm: no opening, car or rise spot in his lock', () => {
    const [a, b] = OZ_B_WU_ARENA;
    for (const o of OZ_B_OPENINGS) expect(overlap(spanOf(o), [a, b]), `${o.kind}@${o.x}`).toBe(false);
    for (const c of OZ_B_CARS) expect(overlap(carSpan(c), [a, b])).toBe(false);
    for (const x of OZ_B_RISE) expect(x < a || x > b).toBe(true);
  });

  it('wider arenas for the slow fights, each with openings and rise spots in it', () => {
    for (const s of sections) {
      for (const [a, b] of s.arenas) {
        expect(b - a, `${s.id} arena ${a}`).toBeGreaterThanOrEqual(440);
        expect(b, `${s.id} arena ${a}`).toBeLessThanOrEqual(s.w);
        expect(s.openings.filter((o) => ruinSpotX(o) > a && ruinSpotX(o) < b).length, `${s.id} arena ${a} openings`).toBeGreaterThanOrEqual(2);
        expect(s.rise.filter((x) => x > a && x < b).length, `${s.id} arena ${a} rise`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('the car roofs are one-way platforms of the terrain', () => {
    for (const [id, cars] of [
      ['oz-a', OZ_A_CARS],
      ['oz-b', OZ_B_CARS],
    ] as const) {
      const t = OLDENZAAL.sections[id].terrain;
      for (const [x, y, w] of carRoofs(cars)) {
        const hit = t.platforms.some((pl) => pl.length >= 2 && pl[0][0] === x && pl[0][1] === y && pl[pl.length - 1][0] === x + w);
        expect(hit, `${id} car roof ${x}`).toBe(true);
      }
    }
  });

  it('checkpoints ≤ 1,400 px apart; the openings\' art in the sections\' tier-4 art', () => {
    for (const id of ['oz-a', 'oz-b']) {
      const sec = OLDENZAAL.sections[id];
      const cps = [0, ...(sec.checkpoints ?? []), sec.width];
      for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1], id).toBeLessThanOrEqual(1400);
      for (const p of ['prop/oz-boarded/', 'prop/oz-manhole/', 'decor/oz-ruin/car']) expect(sec.art ?? [], `${id} ${p}`).toContain(p);
    }
  });

  it('abandoned: most lamps dead, a few burning; only those give light; banners few (R2-2)', () => {
    expect(OZ_A_LIT.size).toBeLessThanOrEqual(Math.floor(OZ_A_LAMPS.length / 3));
    expect(OZ_B_LIT.size).toBeLessThanOrEqual(Math.ceil(OZ_B_LAMPS.length / 3));
    const lamps = OZ_A_DECOR.filter((d) => d.sprite === 'decor/oz/lamp');
    expect(lamps.filter((d) => d.frame === 0).length).toBe(OZ_A_LIT.size);
    // Lamp lights only at the burning lamps (both heads; plus the emergency sign's lamp).
    expect(OZ_A_LAMP_LIGHTS.length).toBe(OZ_A_LIT.size * 2 + 1);
    const banners = [...OZ_A_DECOR, ...OZ_B_DECOR].filter((d) => d.sprite === 'decor/oz-ruin/banner');
    expect(banners.length).toBeGreaterThanOrEqual(1);
    expect(OZ_A_DECOR.filter((d) => d.sprite === 'decor/oz-ruin/banner').length).toBeLessThanOrEqual(2);
    expect(OZ_B_DECOR.filter((d) => d.sprite === 'decor/oz-ruin/banner').length).toBeLessThanOrEqual(1);
    // Never in front of the players, never low on a front (above the shop signs).
    for (const b of banners) {
      expect(b.front ?? false).toBe(false);
      expect(b.y + 42).toBeLessThan(G - 37);
    }
  });
});
