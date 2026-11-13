/**
 * sewers-b DE STEEGJES + THE RAT ERUPTION (docs/design/sewers.md §2.2, §5.3; wave P1b B): the section
 * builds as the spec says, the `sewers-grate` prop (rattle, burst, the lid, the decor rats; cosmetic
 * only), the eruption (the crooks flee untargetable, three waves of runners out of the holes, the
 * leaper in the middle grate, the lock always opens), the jump into the big grate (`SPRING!`, the
 * `cut` exit; 2P: the second hero follows within 120 ticks or is carried), and the god-bot runs
 * (1P, 2P) through the section with no errors.
 */
import { describe, expect, it } from 'vitest';
import { hasSprite, listSprites } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { isSewersContent, loadContent } from '../../src/game/content/index';
import { B_PLAY, SEWERS_B_EXIT } from '../../src/game/content/missions/sewers/section-b';
import { SEWERS_B } from '../../src/game/content/missions/sewers/terrain';
import { SEWERS_ID, SEWERS_PIECE, isSewersSpriteId } from '../../src/game/content/missions/sewers/ids';
import { GRATE, GRATE_ART, SewersGrate } from '../../src/game/content/sewers/set-pieces/grate';
import { STREET_TAG, StreetPerson } from '../../src/game/content/sewers/street/index';
import { getEntityMeta, getMission } from '../../src/game/registry';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';

await loadContent();
await loadContent(isSewersContent);
const SECTION = getMission(SEWERS_ID)!.sections['sewers-b'];

function grates(g: HeadlessGame): SewersGrate[] {
  return (g.world?.entities ?? []).filter((e): e is SewersGrate => e instanceof SewersGrate);
}

function headless(players: 1 | 2, bot: boolean) {
  return createHeadlessGame({ missionId: SEWERS_ID, sectionId: 'sewers-b', seed: 7, players, god: true, bot, captureConsole: true, loadContent: false });
}

describe('sewers-b: the section of spec §2.2', () => {
  it('flat at y 176, the checkpoints, the cut exit into the big grate (disabled until the lock is done)', () => {
    expect(SECTION.width).toBe(2560);
    const t = new Terrain(SECTION.terrain);
    for (let x = 4; x < SECTION.width; x += 32) expect(t.surfaceY(x, 170, 182)).toBe(176);
    expect(SECTION.checkpoints).toEqual([1200, 2000]);
    const ex = SECTION.exits![0];
    expect(ex).toMatchObject({ id: SEWERS_B_EXIT, to: 'sewers-c', transition: 'cut', disabled: true });
    expect(ex.rect).toMatchObject({ x: 2384, w: 64 });
    expect(SEWERS_B.grates).toEqual([1980, 2100, 2220]);
    expect(SEWERS_B.gutters).toEqual([400, 760, 1120]);
    expect(SEWERS_B.lock).toEqual([1920, 2304]);
    expect(B_PLAY.rattle).toBe(60);
    expect(B_PLAY.waves * B_PLAY.perWave).toBe(15);
    expect(B_PLAY.follow).toBe(120);
  });

  it('the grate is a registered prop with stand-in sprites under a sewers- segment', () => {
    expect(getEntityMeta(SEWERS_PIECE.grate)?.category).toBe('prop');
    const ids = listSprites(GRATE_ART);
    for (const id of ['gutter', 'eruption', 'big', 'gutter-lid', 'eruption-lid', 'big-lid', 'rat'].map((k) => `${GRATE_ART}/${k}`)) {
      expect(ids, id).toContain(id);
      expect(hasSprite(id), id).toBe(true);
      expect(isSewersSpriteId(id), id).toBe(true);
    }
    expect(SECTION.art).toContain(GRATE_ART);
  });
});

describe('sewers-grate: rattle, burst, the lid, the decor rats (cosmetic only)', () => {
  it('the eruption: rattle 60 → burst; the lid lands beside the hole; decor rats pour 240 ticks; play rng untouched', async () => {
    const g = await headless(1, false);
    try {
      g.step(2);
      const w = g.world!;
      const gr = grates(g).find((e) => e.kind === 'eruption')!;
      const rng0 = w.rng.int(0, 1e9);
      const ctl = await headless(1, false);
      ctl.step(2);
      expect(ctl.world!.rng.int(0, 1e9)).toBe(rng0);
      gr.rattle();
      expect(gr.rattling).toBe(true);
      for (let i = 0; i < GRATE.rattle; i++) {
        gr.update();
      }
      expect(gr.rattling).toBe(false);
      gr.burst({ lidDir: 1 });
      expect(gr.open).toBe(true);
      expect(gr.hole).toEqual({ x: gr.x, y: 176 });
      for (let i = 0; i < 120; i++) gr.update();
      // The lid lies beside the hole, never on it.
      const lid = gr as unknown as { lidDown: boolean; lidX: number; lidFlying: boolean };
      expect(lid.lidFlying).toBe(false);
      expect(lid.lidDown).toBe(true);
      expect(Math.abs(lid.lidX - gr.x)).toBeGreaterThanOrEqual(gr.w / 2 + 10);
      const rats = gr as unknown as { rlife: Uint16Array };
      expect([...rats.rlife].some((v) => v > 0)).toBe(true);
      for (let i = 0; i < GRATE.pourTicks + 60; i++) gr.update();
      expect([...rats.rlife].every((v) => v === 0)).toBe(true);
      // The grate never drew from the play rng.
      ctl.step(0);
      expect(w.rng.int(0, 1e9)).toBe(ctl.world!.rng.int(0, 1e9));
      ctl.dispose();
    } finally {
      g.dispose();
    }
  });

  it('a gutter grate rattles once when a hero comes near; the big grate pours for good', async () => {
    const g = await headless(1, false);
    try {
      g.step(2);
      const gut = grates(g).filter((e) => e.kind === 'gutter');
      expect(gut.map((e) => e.x)).toEqual([400, 760, 1120]);
      g.teleport(400 - GRATE.autoNear + 10);
      g.step(2);
      expect(gut[0].rattling).toBe(true);
      g.step(GRATE.gutterRattle + 2);
      expect(gut[0].rattling).toBe(false);
      g.step(60);
      expect(gut[0].rattling).toBe(false); // once only
      const big = grates(g).find((e) => e.kind === 'big')!;
      big.burst({ pour: true });
      for (let i = 0; i < GRATE.pourTicks * 3; i++) big.update();
      const rats = big as unknown as { rlife: Uint16Array };
      expect([...rats.rlife].some((v) => v > 0)).toBe(true);
    } finally {
      g.dispose();
    }
  });
});

describe('sewers-b: THE RAT ERUPTION and the jump into the grate', () => {
  it('a hero who never shoots: the crooks flee at the burst (untargetable, no score), three waves of runners + the leaper, the lock opens, SPRING!, the cut exit', async () => {
    const g = await headless(1, false);
    try {
      g.step(2);
      g.teleport(2100);
      const w = g.world!;
      const er = grates(g).filter((e) => e.kind === 'eruption');
      expect(er.map((e) => e.x)).toEqual([1980, 2100, 2220]);
      expect(g.runUntil(() => er[0].rattling, 600)).toBe(true);
      const crooks = w.entities.filter((e): e is StreetPerson => e instanceof StreetPerson && e.alive);
      expect(crooks.length).toBeGreaterThanOrEqual(3);
      const rattleTick = w.tick;
      expect(g.runUntil(() => er[0].open, 120)).toBe(true);
      expect(w.tick - rattleTick).toBeGreaterThanOrEqual(B_PLAY.rattle - 1);
      g.step(1);
      for (const c of crooks) {
        if (c.removed || c.dead) continue;
        expect(c.fleeing).toBe(true);
        expect(c.hasTag('enemy')).toBe(false);
        expect(c.hasTag('shootable')).toBe(false);
      }
      // The runners rise out of the three holes; a leaper waits in the middle one in the last wave.
      const seen = new Set<number>();
      let leaper = false;
      const big = grates(g).find((e) => e.kind === 'big')!;
      const opened = g.runUntil(() => {
        for (const e of w.entities) {
          if (e.type === 'sewers-rat-runner') seen.add(e.id);
          if (e.type === 'sewers-rat-leaper') leaper = true;
        }
        return big.open;
      }, 3 * B_PLAY.maxGap + B_PLAY.lastWave + 200);
      expect(opened).toBe(true);
      expect(seen.size).toBe(15);
      expect(leaper).toBe(true);
      // The crooks are gone (off screen) and gave no kill.
      expect(w.byTag(STREET_TAG).filter((e) => e.alive).length).toBe(0);
      // The pointer SPRING! over the big grate; the exit opens when the hero reaches it.
      const hud = g.runner!.hud;
      expect(hud.pointers.some((p) => p.text === 'SPRING!' && p.target === big)).toBe(true);
      expect(g.runner!.isExitOpen(SEWERS_B_EXIT)).toBe(false);
      g.teleport(2416);
      expect(g.runUntil((gg) => gg.runner?.section.id === 'sewers-c', 30)).toBe(true);
      const r = g.report();
      expect(r.errors).toEqual([]);
      expect(r.killsByType['sewers-dealer'] ?? 0).toBe(0);
      expect(r.killsByType['sewers-pimp'] ?? 0).toBe(0);
    } finally {
      g.dispose();
    }
  }, 60_000);

  it('2P: the first hero at the grate waits for the second at most 120 ticks, then both go down (carried)', async () => {
    const g = await headless(2, false);
    try {
      g.step(2);
      g.teleport(2100);
      const big = grates(g).find((e) => e.kind === 'big')!;
      expect(g.runUntil(() => big.open, 3 * B_PLAY.maxGap + B_PLAY.lastWave + 400)).toBe(true);
      const p0 = g.player(0)!;
      const p1 = g.player(1)!;
      // Walk the pair up (the co-op camera keeps both in view): p1 lags behind on the square.
      p1.placeAt(2160, 176, 60);
      p0.placeAt(2300, 176, 60);
      g.step(60);
      p0.placeAt(2400, 176, 60);
      g.step(2);
      expect(p0.x).toBeGreaterThanOrEqual(2384);
      g.step(B_PLAY.follow - 20);
      expect(g.runner!.section.id).toBe('sewers-b');
      expect(g.runner!.isExitOpen(SEWERS_B_EXIT)).toBe(false);
      expect(g.runUntil((gg) => gg.runner?.section.id === 'sewers-c', 60)).toBe(true);
      expect(g.player(1)).not.toBeNull();
      expect(g.report().errors).toEqual([]);
    } finally {
      g.dispose();
    }
  }, 60_000);
});

describe('sewers-b: the god bot', () => {
  it.each([1, 2] as const)('%iP: plays sewers-b to the cut into sewers-c (hostage freed, every rat of the eruption killed), no errors', async (players) => {
    const g = await headless(players, true);
    try {
      expect(g.runUntil((gg) => gg.runner?.section.id === 'sewers-c', 9000)).toBe(true);
      const r = g.report();
      expect(r.errors).toEqual([]);
      expect(r.warnings.filter((x) => /unknown entity/.test(x))).toEqual([]);
      expect(r.hostages).toBeGreaterThanOrEqual(1);
      expect(r.killsByType['sewers-rat-runner'] ?? 0).toBeGreaterThanOrEqual(15);
      expect(r.killsByType['sewers-rat-leaper'] ?? 0).toBe(1);
      expect(r.maxEntities).toBeLessThanOrEqual(300);
      // Both heroes went down the grate together.
      if (players === 2) expect(g.player(1)).not.toBeNull();
    } finally {
      g.dispose();
    }
  }, 120_000);
});
