/**
 * Mission oldenzaal — the tower (oz-f, docs/design/oldenzaal.md §8, §9; TOWER, wave B): the section
 * loads with its art (1×, 2× and 4× from one drawer, geometry is law), the horde tide kills on
 * contact and stops for good at its stop line, the bells toll and stun, the bot climbs it (1P / 2P,
 * god and normal) and the finale boards every living hero onto the jet Swan and completes the
 * mission, and the tall section keeps its dense terrain flat in memory (y eviction).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getFrames, hasSprite, setArtTier } from '../../src/engine/sprites';
import { SoftRenderer } from '../../src/engine/render-soft';
import { Terrain } from '../../src/engine/terrain';
import { hasBgGenerator } from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { OLDENZAAL_ID, OZ_SECTION, OZ_TOWER } from '../../src/game/content/missions/oldenzaal/ids';
import { OZ_F_DECOR, sectionOzF } from '../../src/game/content/missions/oldenzaal/section-oz-f';
import { TOWER_BGS, TOWER_SPRITES } from '../../src/game/content/oldenzaal/tower/art';
import { Bell, BELL, BELLS, ledgeX, ledgeY, SwanJet, Tide, TIDE, TOWER } from '../../src/game/content/oldenzaal/tower/index';
import { isZombie, spawnZombie } from '../../src/game/content/oldenzaal/zombies/api';
import { CHUNK, EVICT_ROWS_AWAY, SectionView } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/headless';

beforeAll(async () => {
  await loadContent();
}, 120_000);

afterEach(() => setArtTier(2));

describe('oz-f: the tower section and its art', () => {
  it('is the tower: up, 384 × 1,800, 45 landings 36 px apart that overlap at the climb column, the roof, the storm', () => {
    const s = getMission(OLDENZAAL_ID)!.sections[OZ_SECTION.f];
    expect(s).toBe(sectionOzF);
    expect(s.scroll).toBe('up');
    const t = new Terrain(s.terrain);
    for (let k = 1; k <= TOWER.ledges; k++) {
      expect(t.surfaceY(ledgeX(k) + 88, ledgeY(k) - 2, ledgeY(k) + 2)).toBe(ledgeY(k));
      // The climb column (x 184–200) is on every landing: a hero can always jump to the next.
      expect(ledgeX(k)).toBeLessThanOrEqual(184);
      expect(ledgeX(k) + TOWER.ledgeW).toBeGreaterThanOrEqual(200);
    }
    expect(t.surfaceY(192, TOWER.roofY - 2, TOWER.roofY + 2)).toBe(TOWER.roofY);
    // The finale completes the mission: the exit over the roof is only a disabled fallback.
    expect(s.exits?.every((e) => e.disabled)).toBe(true);
    // Every decor sprite and both background generators are registered.
    for (const d of OZ_F_DECOR) expect(hasSprite(d.sprite), d.sprite).toBe(true);
    for (const g of TOWER_BGS) expect(hasBgGenerator(g), g).toBe(true);
    for (const l of s.background.layers) expect(hasBgGenerator(l.gen), l.gen).toBe(true);
  });

  it('every tower sprite has 1×, 2× and 4× frames with the same logical size and anchor (geometry is law)', () => {
    expect(TOWER_SPRITES.length).toBeGreaterThanOrEqual(24);
    for (const id of TOWER_SPRITES) {
      const one = getFrames(id, 1);
      expect(one.length, id).toBeGreaterThan(0);
      for (const d of [2, 4]) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id} @${d}`).toBe(one.length);
        for (let i = 0; i < one.length; i++) {
          expect(hd[i].density, `${id}#${i} @${d}`).toBe(d);
          expect(hd[i].buf.w, `${id}#${i} @${d}`).toBe(one[i].buf.w * d);
          expect(hd[i].buf.h, `${id}#${i} @${d}`).toBe(one[i].buf.h * d);
          expect([hd[i].ox, hd[i].oy]).toEqual([one[i].ox, one[i].oy]);
        }
      }
    }
  }, 120_000);
});

/** A quiet game at the foot of the tower (no bot, mortal). */
async function quiet(god = false): Promise<HeadlessGame> {
  const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: OZ_SECTION.f, seed: 1, players: 1, bot: false, god, captureConsole: true });
  g.step(30);
  return g;
}

describe('oz-f: the horde tide', () => {
  it('kills a hero on contact', async () => {
    const g = await quiet();
    const w = g.world!;
    const p = g.runner!.players[0];
    let died = 0;
    w.events.on('playerDied', () => died++);
    w.spawn(OZ_TOWER.tide, 192, p.y - 20, { startY: p.y - 20, speed: 0 });
    g.step(5);
    expect(died).toBe(1);
    g.dispose();
  }, 60_000);

  it('never rises past its stop line, and after the last toll it stays (it recoils a little)', async () => {
    const g = await quiet(true);
    const w = g.world!;
    const tide = w.spawn(OZ_TOWER.tide, 192, 1000, { startY: 1000, speed: 6 }) as Tide;
    expect(tide).toBeInstanceOf(Tide);
    g.step(400);
    expect(tide.top).toBe(TIDE.stopY);
    tide.lastToll();
    g.step(30);
    const after = tide.top;
    expect(after).toBeGreaterThan(TIDE.stopY);
    g.step(200);
    expect(tide.top).toBe(after);
    expect(tide.stopped).toBe(true);
    g.dispose();
  }, 60_000);

  it('holds at a checkpoint for its grace, then rises at its steady rate', async () => {
    const g = await quiet(true);
    const w = g.world!;
    const tide = w.spawn(OZ_TOWER.tide, 192, 1795, { startY: 1795 }) as Tide;
    g.step(2);
    tide.hold(60);
    const y0 = tide.top;
    g.step(59);
    expect(tide.top).toBe(y0);
    g.step(41);
    expect(y0 - tide.top).toBeCloseTo(TIDE.speed * 40, 0);
    // A death: it sinks out of the view and waits (the drop-in never lands in it).
    w.events.emit('playerDied', { player: g.runner!.players[0], slot: 0, cause: 'timeout' });
    g.step(30);
    expect(tide.top).toBeGreaterThanOrEqual(w.camera.bottom + TIDE.sinkTo - 0.01);
    expect(tide.holding).toBe(true);
    g.dispose();
  }, 60_000);
});

describe('oz-f: the bells', () => {
  it('a bell tells (≥ 18 ticks), swings, tolls and stuns the dead near it', async () => {
    expect(BELL.tell).toBeGreaterThanOrEqual(18);
    const g = await quiet();
    const w = g.world!;
    const p = g.runner!.players[0];
    const b = w.spawn(OZ_TOWER.bell, p.x + 120, p.y - 70, { size: 'small', mode: 'script' }) as Bell;
    expect(b).toBeInstanceOf(Bell);
    const z = spawnZombie(w, 'grunt', p.x + 130, p.y, 'walk');
    g.step(2);
    b.toll(2);
    expect(b.state).toBe('tell');
    g.step(BELL.tell - 1);
    expect(b.angle).toBeLessThan(0.1);
    let tolled = false;
    g.runUntil(() => {
      tolled = b.tolls > 0;
      return tolled;
    }, 400);
    expect(tolled).toBe(true);
    expect(isZombie(z)).toBe(true);
    g.dispose();
  }, 60_000);

  it('a swinging bell hits a hero it swings at — never during its tell', async () => {
    const g = await quiet();
    const w = g.world!;
    const p = g.runner!.players[0];
    let died = 0;
    w.events.on('playerDied', () => died++);
    const b = w.spawn(OZ_TOWER.bell, p.x - 12, p.y - 36, { size: 'small', mode: 'script' }) as Bell;
    g.step(2);
    b.toll(2);
    g.step(BELL.tell);
    expect(died).toBe(0);
    g.runUntil(() => died > 0, 200);
    expect(died).toBe(1);
    g.dispose();
  }, 60_000);

  it('the small bells hang off the climb column (x 184–200) and the big one waits in the lantern', () => {
    for (const b of BELLS) {
      if (b.size === 'small') expect(Math.abs(b.x - 192)).toBeGreaterThan(100);
      else expect(b.mode).toBe('script');
    }
  });
});

describe('oz-f: the bot climbs it and the jet Swan takes every hero', () => {
  it.each([
    [1, true],
    [2, true],
    [1, false],
    [2, false],
  ] as const)('%iP god %s: the climb, the roof, everyone aboard, MISSION COMPLETE', async (players, god) => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: OZ_SECTION.f, seed: 3, players, god, bot: true, captureConsole: true });
    let checked = false;
    let aboard = -1;
    let living = -1;
    g.runUntil((gg) => {
      const w = gg.world;
      if (w && !checked) {
        const s = w.byTag('oz-swan-jet')[0] as SwanJet | undefined;
        if (s && (s.mode === 'turn' || s.mode === 'leave')) {
          checked = true;
          aboard = s.passengers.length;
          living = gg.runner!.players.filter((p) => p.state !== 'out').length;
        }
      }
      return gg.missionComplete;
    }, 9000);
    expect(g.missionComplete).toBe(true);
    expect(checked).toBe(true);
    expect(aboard).toBe(living);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 180_000);
});

describe('oz-f: the tall section keeps its dense terrain flat (y eviction)', () => {
  it('climbing 1,800 px at 4× keeps only the chunk rows near the view', () => {
    setArtTier(4);
    const view = new SectionView(sectionOzF, new Terrain(sectionOzF.terrain), 3, 4);
    view.evictRows = true;
    let peak = 0;
    for (let y = TOWER.h - 216; y >= 0; y -= 48) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: 4 });
      r.begin(view.sky);
      r.setCamera(0, y);
      view.drawBack(r, 0);
      view.drawFront(r, 0);
      r.end();
      peak = Math.max(peak, view.hiChunkCount(4));
    }
    const cols = Math.ceil(TOWER.w / CHUNK) + 2;
    expect(peak).toBeLessThanOrEqual((2 + 2 * (EVICT_ROWS_AWAY - 1)) * cols);
    expect(view.evicted).toBeGreaterThan(0);
  }, 120_000);
});
