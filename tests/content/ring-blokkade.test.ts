/**
 * Mission ring, revision R wave B — `rf-b` DE BLOKKADE (docs/design/ring.md §R.6, §R.9;
 * docs/api/ring.md "R.B2"): the section loads with its layout (checkpoints ≤ 1,400 px apart, locks
 * one screen wide), the spandoek's text and our mark (a round-bellied hourglass with a smoke puff,
 * NEVER inside a circle or a ring), the decor never mirrored, the blockade's art at 1× / 2× / 4×
 * with the 1× geometry, and the bots cross it and beat the boat (god, 1P / 2P) at the planned pace
 * with no empty stretch over 4 s before the boat.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { ACTIVIST_OUT_EVENT, type ActivistOutEvent } from '../../src/game/content/ring/activists/api';
import { PinkBoat } from '../../src/game/content/ring/boot/boat';
import {
  BLOK_SPR,
  markHit,
  RF_B_ARENA_L,
  RF_B_ARENAS,
  RF_B_ART,
  RF_B_CHECKPOINTS,
  RF_B_SCENE,
  RF_B_W,
  RING_FOOT,
  RING_FOOT_HOSTAGES,
  sectionRfB,
  SPANDOEK,
} from '../../src/game/content/ring/foot/index';
import { hasEntity } from '../../src/game/registry';
import { createHeadlessRing } from '../../src/sim/headless-ring';

beforeAll(async () => {
  await loadContent();
}, 120_000);

describe('rf-b DE BLOKKADE: the section', () => {
  it('is the foot def’s second section with its own set, the boat at the end', () => {
    expect(RING_FOOT.sections?.['rf-b']).toBe(sectionRfB);
    expect(sectionRfB.width).toBe(RF_B_W);
    expect(sectionRfB.bossStart?.x).toBeGreaterThanOrEqual(RF_B_ARENA_L);
    expect(hasEntity(RF_B_SCENE)).toBe(true);
    expect(RING_FOOT_HOSTAGES['rf-b']).toBe(0);
  });

  it('checkpoints at most 1,400 px apart (the arena’s own at its left edge)', () => {
    const cps = [0, ...RF_B_CHECKPOINTS, RF_B_ARENA_L + 40];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1], `${cps[i - 1]} → ${cps[i]}`).toBeLessThanOrEqual(1400);
  });

  it('every camera lock is one screen wide (camera.ts lock: the view’s left and right)', () => {
    for (const [a, b] of Object.values(RF_B_ARENAS)) expect(b - a).toBe(384);
  });

  it('the tier-4 list never reaches under the prefixes ams preloads', () => {
    for (const p of RF_B_ART) for (const bad of ['item/pickup-', 'weapon/', 'ui/icon-', 'fx/hit', 'fx/dust', 'npc/ams/']) expect(p.startsWith(bad), p).toBe(false);
    expect(RF_B_ART).toContain('ring/foot/blok/');
    expect(RF_B_ART).toContain('boss/ring-boot/');
  });

  it('the lettered decor is never mirrored', () => {
    for (const d of sectionRfB.decor ?? []) expect(d.flipX ?? false, d.sprite).toBe(false);
  });
});

describe('the spandoek and our mark', () => {
  it('carries the user’s parody name exactly and the Dutch line', () => {
    expect(SPANDOEK.title).toBe('EXHAUSTING REBELLION');
    expect(SPANDOEK.sub).toBe('WIJ ZIJN MOE. NU JULLIE OOK.');
    expect((sectionRfB.decor ?? []).some((d) => d.sprite === BLOK_SPR.spandoek)).toBe(true);
  });

  it('the mark is a round-bellied hourglass with sand and a smoke puff on top — never inside a circle or ring', () => {
    const kinds = new Set<number>();
    for (let y = -10; y < 60; y += 0.25) for (let x = -20; x < 40; x += 0.25) kinds.add(markHit(x, y, 0, 0));
    expect([...kinds].sort()).toEqual([0, 1, 2, 3]);
    // The smoke is above the glass (it rises from its top).
    let smokeLow = -Infinity;
    let glassTop = Infinity;
    for (let y = -10; y < 60; y += 0.25)
      for (let x = -20; x < 40; x += 0.25) {
        const k = markHit(x, y, 0, 0);
        if (k === 3) smokeLow = Math.max(smokeLow, y);
        if (k === 1) glassTop = Math.min(glassTop, y);
      }
    expect(smokeLow).toBeLessThanOrEqual(glassTop + 0.5);
    // No ring: on every circle round the mark's middle that clears the hourglass, most of the
    // circle is empty cloth (a ring around it would paint all of it).
    const cx = 11;
    const cy = 27;
    for (let r = 17; r <= 34; r += 1) {
      let painted = 0;
      const n = 180;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (markHit(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0, 0) !== 0) painted++;
      }
      expect(painted / n, `radius ${r}`).toBeLessThan(0.3);
    }
  });
});

describe('the blockade’s art (1×, 2×, 4×; geometry is law)', () => {
  it('every ring/foot/blok id has one HD drawer at 2× and 4× with the 1× geometry and PAL_HD colours', () => {
    const ids = listSprites('ring/foot/blok/');
    expect(ids.length).toBe(Object.keys(BLOK_SPR).length);
    for (const id of ids) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(true);
        const hi = getFrames(id, d);
        expect(hi.length).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          expect([hi[i].buf.w, hi[i].buf.h, hi[i].ox, hi[i].oy], `${id}@${d}x[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          let odd = 0;
          for (const c of hi[i].buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) odd++;
          expect(odd, `${id}@${d}x[${i}] colours`).toBe(0);
        }
      }
    }
  }, 120_000);
});

/** rf-b from its start (god, the bots): ticks, the longest empty stretch before the boat, the outs. */
async function runRfB(players: 1 | 2): Promise<{ complete: boolean; ticks: number; gapBeforeBoat: number; outs: ActivistOutEvent[]; boatBeaten: boolean }> {
  const h = await createHeadlessRing({ seed: 1, god: true, bot: true, section: 'rf-b', players, loadContent: false } as never);
  const outs: ActivistOutEvent[] = [];
  let wired = false;
  let gap = 0;
  let longest = 0;
  let boat: PinkBoat | null = null;
  let t = 0;
  for (; t < 14_000 && !h.complete; t++) {
    h.step(1);
    const w = h.world;
    if (!w || !h.footRunner) continue;
    if (!wired) {
      wired = true;
      w.events.on(ACTIVIST_OUT_EVENT, (e) => outs.push(e));
    }
    boat = boat ?? ((w.byTag('boss').find((e: Entity) => e instanceof PinkBoat) as PinkBoat | undefined) ?? null);
    if (boat) continue;
    let foe = false;
    for (const e of w.entities) if (e.alive && e.team === 'enemy' && e.hasTag('shootable') && w.onScreen(e, 0)) foe = true;
    gap = foe ? 0 : gap + 1;
    // The first screen (the police line) starts empty: the lopers run in after 40 ticks.
    if (t > 60) longest = Math.max(longest, gap);
  }
  return { complete: h.complete, ticks: t, gapBeforeBoat: longest, outs, boatBeaten: boat?.defeated === true };
}

describe('the bots cross rf-b and beat the boat (god)', () => {
  for (const players of [1, 2] as const) {
    it(`${players}P: complete in about 9,000 ticks with the boat; never 4 s without an activist before it`, async () => {
      const r = await runRfB(players);
      expect(r.complete).toBe(true);
      expect(r.boatBeaten).toBe(true);
      expect(r.ticks).toBeGreaterThanOrEqual(6_500);
      expect(r.ticks).toBeLessThanOrEqual(10_500);
      expect(r.gapBeforeBoat).toBeLessThanOrEqual(240);
      expect(r.outs.some((e) => e.how === 'runoff')).toBe(true);
      expect(r.outs.some((e) => e.kind === 'ketting' && e.how === 'carried')).toBe(true);
    }, 120_000);
  }
});
