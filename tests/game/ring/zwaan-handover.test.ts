/**
 * Revision R (docs/design/ring.md §R.3, §R.4, §R.10; docs/api/ring.md "Revision R"): the ZWAAN
 * train contract and the hand-over chain, on real headless runs (`section: 'zwaan'`, god, the bots):
 *
 * - the controller spawns the parts in the fixed order; one live part at a time; a part's fight
 *   starts only after the previous one is beaten; the catch-ups take 130–180 ticks;
 * - the pips count down; the bar shows the active part's name;
 * - the ring's boss end (`bossEndTick`), the music and the speed bonus follow the WHOLE train
 *   ('ringTrainDone' once, after the cab), never a part's 'bossDefeated';
 * - the drive hands over to the foot part without a tally: lives, score, bombs, weapon, the
 *   per-mission stats stay; ONE MISSION COMPLETE page at the end;
 * - a 2P slot that is out at the hand-over gets a fresh continue countdown on foot.
 */
import { describe, expect, it } from 'vitest';
import { VirtualPad } from '../../../src/engine/input';
import { loadContent } from '../../../src/game/content/index';
import { ringFootDef } from '../../../src/game/content/ring/foot/index';
import { RING_ZWAAN_ORDER, ZWAAN, ZWAAN_NAMES, ZwaanPart } from '../../../src/game/content/ring/zwaan/index';
import { MissionRunner } from '../../../src/game/mission/runner';
import { bossSpeedBonus } from '../../../src/game/scenes/mission-complete';
import { MissionCompleteScene } from '../../../src/game/scenes/mission-complete';
import { GameSession } from '../../../src/game/session';
import { TUNING } from '../../../src/game/tuning';
import { createHeadlessRing } from '../../../src/sim/headless-ring';

await loadContent();

describe('the ZWAAN train and the hand-over (section zwaan, god, the bots)', () => {
  it('parts in order, one at a time, catch-ups 130–180 ticks, one train end; then the hand-over keeps the stats and ends in ONE tally', async () => {
    const h = await createHeadlessRing({ seed: 3, god: true, bot: true, section: 'zwaan', loadContent: false });
    try {
      const ring = h.runner!;
      expect(ring.plan.route).toBe('short');
      const starts: string[] = [];
      const beaten: string[] = [];
      let done = 0;
      let endAtDone = -2;
      let musicDuring = new Set<string | null>();
      let bossDefeatedParts = 0;
      ring.world.events.on('ringTrainPart', (e) => (e.phase === 'start' ? starts : beaten).push(e.part));
      ring.world.events.on('ringTrainDone', () => {
        done++;
        endAtDone = h.session.slots[0].mission.bossEndTick;
      });
      ring.world.events.on('bossDefeated', (e) => {
        if (e.boss instanceof ZwaanPart) {
          bossDefeatedParts++;
          // A part's defeat never sets the ring's boss end while the train still runs.
          if (done === 0) expect(h.session.slots[0].mission.bossEndTick).toBe(-1);
        }
      });
      let maxLive = 0;
      let pipsSeen: number[] = [];
      let before: { lives: number; score: number; bombs: number; weapon: string; kills: number; route: string[] } | null = null;
      for (let t = 0; t < 20_000 && !h.footScene; t++) {
        h.step(1);
        const r = h.runner;
        // The hand-over's fade: the RingScene is still on top, its runner is done.
        if (!r) continue;
        const live = r.world.byTag('ring-zwaan-part').filter((e) => e instanceof ZwaanPart && !e.beaten && e.alive) as ZwaanPart[];
        maxLive = Math.max(maxLive, live.length);
        if (live.length === 1) {
          const p = live[0];
          if (p.barPips && pipsSeen[pipsSeen.length - 1] !== p.barPips.left) pipsSeen.push(p.barPips.left);
          expect(p.name).toBe(ZWAAN_NAMES[p.type]);
          if (starts.length > 0 && done === 0) musicDuring.add(r.currentMusic);
        }
        const s = h.session.slots[0];
        if (r.handedOver) continue;
        before = { lives: s.lives, score: s.score, bombs: s.bombs, weapon: s.weapon, kills: s.stats.kills, route: [...s.mission.route] };
      }
      // The train.
      expect(starts).toEqual([...RING_ZWAAN_ORDER]);
      expect(beaten).toEqual([...RING_ZWAAN_ORDER]);
      expect(maxLive).toBe(1);
      expect(done).toBe(1);
      expect(endAtDone).toBeGreaterThan(0);
      expect(bossDefeatedParts).toBeGreaterThanOrEqual(RING_ZWAAN_ORDER.length - 1);
      expect(pipsSeen).toEqual([5, 4, 3, 2, 1]);
      expect([...musicDuring]).toEqual(['ring-boss']);
      const rep = ring.report();
      expect(rep.train?.done).toBe(true);
      expect(rep.train?.parts.map((p) => p.id)).toEqual([...RING_ZWAAN_ORDER]);
      for (const c of rep.train?.catchUps ?? []) {
        expect(c).toBeGreaterThanOrEqual(ZWAAN.catchUp.min);
        expect(c).toBeLessThanOrEqual(ZWAAN.catchUp.max + 2);
      }
      expect(rep.train?.catchUps).toHaveLength(4);
      // The hand-over: the foot part with the same session and stats; no page yet.
      expect(h.footScene).not.toBeNull();
      expect(rep.handedOver).toBe(true);
      expect(h.session.completed).not.toContain('ring');
      h.step(1);
      const foot = h.footRunner!;
      expect(foot.mission.id).toBe('ring');
      expect(foot.section.id).toBe('rf-a');
      expect(foot.hud.banner).toBeNull();
      const s = h.session.slots[0];
      expect(before).not.toBeNull();
      expect(s.lives).toBe(before!.lives);
      expect(s.score).toBe(before!.score);
      expect(s.bombs).toBe(before!.bombs);
      expect(s.weapon).toBe(before!.weapon);
      expect(s.stats.kills).toBeGreaterThanOrEqual(before!.kills);
      expect(s.mission.route).toEqual([...before!.route, 'rf-a']);
      expect(s.mission.bossEndTick).toBe(endAtDone);
      // The foot part to the end: ONE MISSION COMPLETE page with the drive's fines and seed.
      h.runUntil((x) => x.done, 16_000);
      expect(h.complete).toBe(true);
      h.runUntil((x) => x.app.scenes.top instanceof MissionCompleteScene, 900);
      const page = h.app.scenes.top as MissionCompleteScene;
      expect(page).toBeInstanceOf(MissionCompleteScene);
      expect(page.runner.mission.id).toBe('ring');
      expect(page.runner.tallyFooter).toBe('RING SEED 3');
      expect(page.runner.mission.hostages?.['rf-a']).toBe(1);
      expect(page.runner.mission.hostages?.zuid).toBeGreaterThanOrEqual(1);
      expect(h.session.completed.filter((m) => m === 'ring')).toHaveLength(1);
      const r = h.report();
      expect(r.errors).toEqual([]);
      expect(r.foot?.sectionsVisited).toEqual(['rf-a', 'rf-b']);
      expect(r.bossDefeated).toBe(true);
    } finally {
      h.dispose();
    }
  }, 120_000);

  it('the ring’s speed bonus counts the whole train against 240 s (like m5)', () => {
    expect(bossSpeedBonus('ring', 0, 180 * 60)).toBe(60 * TUNING.score.bossSpeedPerSecond);
    expect(bossSpeedBonus('ring', 0, 250 * 60)).toBe(0);
    expect(bossSpeedBonus('ams', 0, 60 * 60)).toBe(Math.min(TUNING.score.bossSpeedMax, (TUNING.score.bossSpeedSeconds - 60) * TUNING.score.bossSpeedPerSecond));
  });

  it('continueMission: the foot runner keeps the per-mission stats; a 2P slot out at the hand-over gets a fresh countdown', () => {
    const session = new GameSession({ characters: ['vincent', 'thom'], seed: 1 });
    session.startMission('ring');
    session.slots[0].mission.kills['ring-scooter'] = 7;
    session.slots[0].rescued = 2;
    session.slots[0].mission.route.push('oost', 'amstel', 'zuid');
    session.slots[1].lives = 0;
    session.slots[1].gameOver = true;
    const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
    const runner = new MissionRunner({ session, mission: ringFootDef(null), pads, continueMission: true });
    runner.start();
    expect(session.missionId).toBe('ring');
    expect(session.slots[0].mission.kills['ring-scooter']).toBe(7);
    expect(session.slots[0].rescued).toBe(2);
    expect(session.slots[0].mission.route).toEqual(['oost', 'amstel', 'zuid', 'rf-a']);
    expect(runner.players.map((p) => p.index)).toEqual([0]);
    expect(runner.continueTicks[1]).toBe(TUNING.continues.seconds * TUNING.continues.ticksPerCount);
    expect(runner.hud.banner).toBeNull();
    // START on pad 2 continues the slot on foot.
    expect(runner.continuePlayer(1)).toBe(true);
    expect(runner.players.map((p) => p.index).sort()).toEqual([0, 1]);
    // Without the option nothing changes: a fresh start resets the stats and shows the banner.
    const fresh = new MissionRunner({ session, mission: ringFootDef(null), pads });
    fresh.start();
    expect(session.slots[0].rescued).toBe(0);
    expect(fresh.hud.banner).not.toBeNull();
  });
});
