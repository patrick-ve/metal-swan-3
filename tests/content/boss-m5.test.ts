/**
 * The m5 final boss (GDD §10.5): THE GRAND ORGAN (`grand-organ`), THE CONSOLE (`organ-console`),
 * THE MAESTRO (`maestro`) and the prop `wreck-block`. Spawn, every attack after its telegraph,
 * parts and phases in order, fights won from fair spots (time to kill printed), the defeat
 * sequences and 'bossDefeated', 3000 quiet ticks on HARD, palette-clean art.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import { inPalette } from '../../src/engine/palette';
import { getFrames, listSprites } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/creatures/index';
import '../../src/game/content/machines/index';
import '../../src/game/content/vehicles/fleet/index';
import '../../src/game/content/missions/m5/entities';
import '../../src/game/content/bosses/m5/index';
import { GrandOrgan } from '../../src/game/content/bosses/m5/grand-organ';
import { Maestro } from '../../src/game/content/bosses/m5/maestro';
import { OrganConsole, STOPS } from '../../src/game/content/bosses/m5/organ-console';
import { screamReaches } from '../../src/game/content/bosses/m5/common';
import { CONSOLE, MAESTRO, ORGAN, PHRASES, PIPE_NAMES } from '../../src/game/content/bosses/m5/geom';
import { WreckBlock } from '../../src/game/content/bosses/m5/wreck-block';
import type { Player } from '../../src/game/player/player';
import { FLOOR, TestWorld } from './helpers';

type Diff = 'easy' | 'normal' | 'hard';

function room(o: { god?: boolean; difficulty?: Diff; playerX?: number | null } = {}): TestWorld {
  const tw = new TestWorld({ width: 384, god: o.god, difficulty: o.difficulty, playerX: o.playerX === undefined ? 40 : o.playerX });
  tw.world.camera.lock(0, 384);
  tw.world.camera.snap();
  return tw;
}

const count = (tw: TestWorld, type: string) => tw.ofType(type).length;
const fight = (b: { state: string }) => b.state === 'fight';
const hit = (b: GrandOrgan | OrganConsole | Maestro, part: string, amount: number) => b.onHit({ amount, kind: 'explosion', dirX: 1, owner: 0 }, b.part(part)!.index);

function runAttack(tw: TestWorld, owner: Entity, gen: Generator<unknown, void, unknown>, probe: () => boolean, max = 400): number {
  tw.world.scripts.run(gen as never, { owner });
  for (let i = 0; i < max; i++) {
    tw.run(1);
    if (probe()) return i + 1;
  }
  return -1;
}

function events(tw: TestWorld): string[] {
  const got: string[] = [];
  tw.world.events.on('bossDefeated', (e: { boss: Entity }) => got.push(e.boss.type));
  return got;
}

// ---------------------------------------------------------------------------------------------
// Stage 1
// ---------------------------------------------------------------------------------------------

describe('THE GRAND ORGAN', () => {
  function organ(o: { god?: boolean; difficulty?: Diff } = {}) {
    const tw = room({ god: o.god, difficulty: o.difficulty, playerX: 80 });
    const boss = tw.spawn('grand-organ', 350, { left: 0 }, 108) as GrandOrgan;
    return { tw, boss };
  }

  it('flies in to view x 200 and fights with the GDD parts', () => {
    const { tw, boss } = organ();
    expect(boss.parts.map((p) => p.name)).toEqual([...PIPE_NAMES, 'bellows', 'speaker', 'hull']);
    expect(boss.part('speaker')!.required).toBe(true);
    expect(boss.part('speaker')!.enabled).toBe(false);
    expect(boss.part('bellows')!.required).toBe(false);
    const t = tw.until(() => fight(boss), 400);
    expect(t).toBeGreaterThanOrEqual(110);
    expect(Math.round(boss.x)).toBe(ORGAN.homeVX);
    // Bar: two clusters + the speaker.
    expect(boss.maxHp).toBe(1000 * 2 + 1200);
    tw.run(400);
    expect(boss.y).toBeGreaterThan(ORGAN.homeVY - ORGAN.drift - 1);
    expect(boss.y).toBeLessThan(ORGAN.homeVY + ORGAN.drift + 1);
    expect(tw.world.errors).toEqual([]);
  });

  it('fires every attack only after its telegraph', () => {
    const { tw, boss } = organ({ god: true });
    boss.phases = [];
    tw.until(() => fight(boss), 400);
    tw.run(2);
    // A Chord Spray: 30 ticks, then 3 fans of 5.
    const tA = runAttack(tw, boss, boss.chordSpray(), () => count(tw, 'chord-note') > 0);
    expect(tA).toBeGreaterThanOrEqual(30);
    tw.run(45);
    expect(count(tw, 'chord-note')).toBe(15);
    tw.run(200);
    // B Bellows Breath: 45 ticks, then a wind and 6 slow notes.
    const before = count(tw, 'chord-note');
    const tB = runAttack(tw, boss, boss.bellowsBreath(), () => boss.windT > 0);
    expect(tB).toBeGreaterThanOrEqual(45);
    tw.run(60);
    expect(count(tw, 'chord-note') - before).toBeGreaterThanOrEqual(6);
    // D Anthem Beam: 50 ticks of the stripe, then the beam.
    boss.part('speaker')!.enabled = true;
    tw.run(100);
    const tD = runAttack(tw, boss, boss.anthemBeam(), () => count(tw, 'anthem-beam') > 0);
    expect(tD).toBeGreaterThanOrEqual(50);
    // C Kazoo Escort: a formation leaves the hatch.
    boss.kazooEscort();
    tw.world.flush();
    expect(count(tw, 'kazoo-drone')).toBeGreaterThan(0);
    expect(tw.world.errors).toEqual([]);
  });

  it('the bellows Breath pushes a Trumpeter left', () => {
    const { tw, boss } = organ({ god: true });
    const p = tw.player as Player;
    const v = tw.spawn('trumpeter', 120, {}, 110);
    (v as unknown as { mount(p: Player): void }).mount(p);
    boss.phases = [];
    tw.until(() => fight(boss), 400);
    const x0 = v.x;
    runAttack(tw, boss, boss.bellowsBreath(), () => boss.windT > 0);
    tw.run(40);
    expect(v.x).toBeLessThan(x0 - 20);
  });

  it('opens the speaker after 2 clusters, ends on the speaker and leaves the landing hatch', () => {
    const { tw, boss } = organ({ god: true });
    const got = events(tw);
    tw.until(() => fight(boss), 400);
    hit(boss, 'pipes-mid', 5000);
    expect(boss.phase).toBe(0);
    hit(boss, 'pipes-top', 5000);
    expect(boss.phase).toBe(1);
    expect(boss.maxHp).toBe(2000 + 1200);
    expect(boss.hp).toBe(1200);
    tw.run(70); // the intermission: the shutters creak open
    expect(boss.part('speaker')!.enabled).toBe(true);
    // The bellows: +5,000 in all.
    const s0 = tw.session.slot(0)!.score;
    hit(boss, 'bellows', 5000);
    expect(tw.session.slot(0)!.score - s0).toBe(5000);
    hit(boss, 'speaker', 5000);
    expect(boss.state).toBe('dying');
    tw.until(() => boss.defeated, 400);
    expect(got).toEqual(['grand-organ']);
    expect(boss.removed).toBe(false);
    expect(boss.hatch.x).toBeGreaterThan(boss.x);
    expect(tw.world.errors).toEqual([]);
  });

  it('can be won in a Trumpeter with the twin gun and dive bombs (time to kill)', () => {
    const { tw, boss } = organ({ god: true });
    const p = tw.player as Player;
    const v = tw.spawn('trumpeter', 100, {}, 110);
    (v as unknown as { mount(p: Player): void }).mount(p);
    let ticks = 0;
    let off = Number.NaN;
    while (!boss.defeated && ticks < 20000) {
      // Target: the middle cluster, then the low one, then the speaker.
      const name = !boss.part('pipes-mid')!.destroyed ? 'pipes-mid' : !boss.part('pipes-low')!.destroyed ? 'pipes-low' : 'speaker';
      const r = boss.part(name)!.box;
      const ty = boss.y + r.y + r.h / 2;
      // A player who keeps his Trumpeter (in the mission a lost one is replaced at once).
      const ship = v as unknown as { cells: number; maxCells: number; repair(n: number): void };
      if (ship.cells < ship.maxCells) ship.repair(ship.maxCells);
      if (Number.isNaN(off)) {
        const b = tw.ofType('twin-bullet')[0];
        if (b) off = b.y - v.y;
      }
      const gy = v.y + (Number.isNaN(off) ? 0 : off);
      const b: Button[] = [];
      if (gy < ty - 3) b.push('down');
      else if (gy > ty + 3) b.push('up');
      if (v.x > 110) b.push('left');
      if (ticks % 2 === 0) b.push('fire');
      if (ticks % 240 === 120) b.push('bomb');
      tw.hold(...b);
      tw.run(1);
      ticks++;
    }
    if (!boss.defeated) console.log('[boss-m5] organ not defeated:', boss.state, boss.phase, v.x, v.y, off, p.state, boss.y, boss.parts.map((q) => Math.round(q.hp)).join(' '), tw.ofType('twin-bullet').length);
    console.log(`[boss-m5] GRAND ORGAN: defeated after ${ticks} ticks (${(ticks / 60).toFixed(1)} s) in a Trumpeter (twin gun + dive bombs)`);
    expect(boss.defeated).toBe(true);
    expect(ticks).toBeLessThan(9000);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks on HARD without errors', () => {
    const { tw } = organ({ difficulty: 'hard' });
    for (let i = 0; i < 3000; i++) {
      tw.hold(...((((i / 40) | 0) % 2 ? ['up', 'fire'] : ['down', 'fire']) as Button[]));
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Stage 2
// ---------------------------------------------------------------------------------------------

describe('THE CONSOLE', () => {
  function stage(o: { god?: boolean; difficulty?: Diff; playerX?: number } = {}) {
    const tw = room({ god: o.god, difficulty: o.difficulty, playerX: o.playerX ?? 40 });
    const boss = tw.spawn('organ-console', CONSOLE.spawnX, { left: 0 }) as OrganConsole;
    return { tw, boss };
  }

  it('spawns with the GDD parts and builds the tiers in a bare room', () => {
    const { tw, boss } = stage();
    expect(boss.parts.map((p) => p.name)).toEqual(['pipe-bank-left', 'pipe-bank-right', 'console']);
    expect(boss.part('console')!.required).toBe(true);
    expect(boss.part('console')!.armored).toBe(true);
    expect(boss.roomLeft).toBe(0);
    expect(boss.roomTop).toBe(0);
    tw.until(() => fight(boss), 300);
    expect(count(tw, 'm5-console-tier')).toBe(3);
    expect(boss.maxHp).toBe(1500 + 3000);
    expect(tw.world.errors).toEqual([]);
  });

  it('the sheet music telegraphs every lane blast by 64 ticks (43 in the fugue)', () => {
    const { tw, boss } = stage({ god: true });
    tw.until(() => fight(boss), 300);
    // Track each note from its first tick to its blast.
    const seen = new Map<object, number>();
    const waits: number[] = [];
    for (let i = 0; i < 400; i++) {
      for (const n of boss.notes) {
        if (n.active && !seen.has(n)) seen.set(n, tw.world.tick);
        if (!n.active && seen.has(n)) {
          waits.push(tw.world.tick - (seen.get(n) as number));
          seen.delete(n);
        }
      }
      tw.run(1);
    }
    expect(waits.length).toBeGreaterThan(3);
    for (const w of waits) expect(w).toBeGreaterThanOrEqual(63);
    expect(count(tw, 'lane-blast') + boss.blasts).toBeGreaterThan(0);
  });

  it('the score never blasts more than 2 lanes at once (3 on HARD) and always leaves a safe lane', () => {
    for (const ph of PHRASES) for (const sym of ph) expect(sym.length).toBeLessThanOrEqual(2);
    const { tw, boss } = stage({ god: true, difficulty: 'hard' });
    tw.until(() => fight(boss), 300);
    let maxLanes = 0;
    for (let i = 0; i < 1200; i++) {
      for (const n of boss.notes) if (n.active) maxLanes = Math.max(maxLanes, ((n.mask & 1) + ((n.mask >> 1) & 1) + ((n.mask >> 2) & 1) + ((n.mask >> 3) & 1)));
      tw.run(1);
    }
    expect(maxLanes).toBe(3);
  });

  it('fires Pedal Notes and every stop after their telegraphs', () => {
    const { tw, boss } = stage({ god: true, playerX: 200 });
    boss.phases = [];
    tw.until(() => fight(boss), 300);
    tw.run(2);
    const tA = runAttack(tw, boss, boss.pedalNotes(), () => count(tw, 'shockwave') > 0, 300);
    expect(tA).toBeGreaterThanOrEqual(30);
    tw.run(140);
    expect(count(tw, 'shockwave')).toBe(0); // it reached the left wall
    const probes: Record<string, () => boolean> = {
      TRUMPET: () => count(tw, 'rifleman') > 0,
      FLUTE: () => count(tw, 'homing-note') > 0,
      PICCOLO: () => count(tw, 'piccolo') > 0,
      BOMBARDE: () => count(tw, 'note-bomb') > 0,
    };
    for (const s of STOPS) {
      const t = runAttack(tw, boss, boss.stopPull(s), probes[s], 300);
      expect(t, s).toBeGreaterThanOrEqual(40);
      tw.run(120);
    }
    expect(tw.world.errors).toEqual([]);
  });

  it('breaks in order: a bank opens the console, the console ends it; tiers fall, blocks land', () => {
    const { tw, boss } = stage({ god: true });
    const got = events(tw);
    tw.until(() => fight(boss), 300);
    const hp0 = boss.part('console')!.hp;
    hit(boss, 'console', 500);
    expect(boss.part('console')!.hp).toBe(hp0); // armoured until a bank is gone
    hit(boss, 'pipe-bank-left', 5000);
    expect(boss.phase).toBe(1);
    expect(boss.part('console')!.armored).toBe(false);
    tw.run(70);
    hit(boss, 'console', 5000);
    expect(boss.state).toBe('dying');
    tw.until(() => boss.defeated, 400);
    expect(got).toEqual(['organ-console']);
    tw.run(120);
    expect(count(tw, 'm5-console-tier')).toBe(0);
    const blocks = tw.ofType('wreck-block') as WreckBlock[];
    expect(blocks.map((b) => Math.round(b.x))).toEqual([...CONSOLE.wrecks]);
    expect(blocks.every((b) => b.landed)).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('can be won with the pistol and grenades (time to kill)', () => {
    const { tw, boss } = stage({ god: true, playerX: 300 });
    const p = tw.player as Player;
    let ticks = 0;
    let onTop = false;
    // Phase 1: on the floor at x 300, shooting the right pipe bank. Phase 2: on tier 3, shooting
    // the music stand (chest height). A grenade every 4 s.
    while (!boss.defeated && ticks < 20000) {
      if (boss.phase >= 1 && !onTop && boss.state === 'fight') {
        p.placeAt(250, 84, 0);
        onTop = true;
      }
      const b: Button[] = [];
      if (p.facing < 0) b.push('right');
      if (ticks % 2 === 0) b.push('fire');
      if (ticks % 240 === 120) b.push('bomb');
      tw.hold(...b);
      tw.run(1);
      ticks++;
    }
    console.log(`[boss-m5] CONSOLE: defeated after ${ticks} ticks (${(ticks / 60).toFixed(1)} s) with the pistol + grenades`);
    expect(boss.defeated).toBe(true);
    expect(ticks).toBeLessThan(12000);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks on HARD without errors', () => {
    const { tw } = stage({ difficulty: 'hard' });
    for (let i = 0; i < 3000; i++) {
      tw.hold(...((((i / 50) | 0) % 2 ? ['left', 'fire'] : ['right', 'fire']) as Button[]));
      if (i % 70 === 0) tw.hold('jump');
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Stage 3
// ---------------------------------------------------------------------------------------------

describe('THE MAESTRO', () => {
  function stage(o: { god?: boolean; difficulty?: Diff; playerX?: number } = {}) {
    const tw = room({ god: o.god, difficulty: o.difficulty, playerX: o.playerX ?? 40 });
    const boss = tw.spawn('maestro', 322, { left: 0 }, 84) as Maestro;
    return { tw, boss };
  }

  it('drops into his podium, lands the wreck blocks and fights with the GDD parts', () => {
    const { tw, boss } = stage();
    expect(boss.parts.map((p) => p.name)).toEqual(['speaker-left', 'speaker-right', 'podium']);
    expect(boss.part('podium')!.required).toBe(true);
    expect(boss.roomTop).toBe(0);
    const t = tw.until(() => fight(boss), 400);
    expect(t).toBeGreaterThan(60);
    const blocks = tw.ofType('wreck-block') as WreckBlock[];
    expect(blocks.map((b) => Math.round(b.x))).toEqual([72, 192, 312]);
    // The figure-eight stays in y 40–120 (podium centre) and inside the room.
    let minY = 999;
    let maxY = -999;
    for (let i = 0; i < 720; i++) {
      tw.run(1);
      if (boss.mode === 'fly') {
        minY = Math.min(minY, boss.ay);
        maxY = Math.max(maxY, boss.ay);
      }
      expect(boss.x).toBeGreaterThan(20);
      expect(boss.x).toBeLessThan(364);
    }
    const e = MAESTRO.eight;
    expect(minY).toBeGreaterThanOrEqual(e.cy - e.ay - 2);
    expect(maxY).toBeLessThanOrEqual(e.cy + e.ay + 2);
    // His hat stays in view and the podium clears the wreck blocks (top y 144).
    expect(e.cy - e.ay - 14 - 44).toBeGreaterThanOrEqual(0);
    expect(e.cy + e.ay + 12).toBeLessThan(144);
    expect(tw.world.errors).toEqual([]);
  });

  it('fires every attack only after its telegraph', () => {
    const { tw, boss } = stage({ god: true, playerX: 100 });
    boss.phases = [];
    tw.until(() => fight(boss), 400);
    boss.mode = 'hold';
    const tA = runAttack(tw, boss, boss.batonLash(), () => count(tw, 'baton-beam') > 0);
    expect(tA).toBeGreaterThanOrEqual(30);
    tw.run(90);
    const tB = runAttack(tw, boss, boss.tempo(), () => boss.tempoT > 0);
    expect(tB).toBeGreaterThanOrEqual(60);
    const tC = runAttack(tw, boss, boss.speakerVolley(), () => count(tw, 'note-bullet') > 0);
    expect(tC).toBeGreaterThanOrEqual(24);
    tw.run(120);
    expect(boss.done.volley).toBe(2);
    let arrived = -1;
    const tD = runAttack(
      tw,
      boss,
      boss.bravissimo(),
      () => {
        if (arrived < 0 && boss.screamLetters > 0) arrived = tw.world.tick;
        return count(tw, 'scream') > 0;
      },
      400,
    );
    expect(tD).toBeGreaterThan(0);
    expect(tw.world.tick - arrived).toBeGreaterThanOrEqual(60);
    tw.run(60);
    expect(boss.hoarse).toBe(true);
    expect(boss.part('podium')!.knifeable).toBe(true);
    tw.run(200);
    expect(boss.hoarse).toBe(false);
    expect(tw.world.errors).toEqual([]);
  });

  it('the scream misses a head behind an outer wreck block and hits one in the open', () => {
    const { tw, boss } = stage({ god: true });
    tw.until(() => fight(boss), 400);
    const mx = MAESTRO.screamAt[0];
    const my = MAESTRO.screamAt[1] + MAESTRO.mouthDY;
    // Crouching close behind the left block (x 60–84, top 144): head at about y 160.
    expect(screamReaches(tw.world, mx, my, 52, 160)).toBe(false);
    expect(screamReaches(tw.world, mx, my, 52, 146)).toBe(true); // standing there is not enough
    expect(screamReaches(tw.world, mx, my, 120, 150)).toBe(true);
    // A player in the open loses a life.
    const p = tw.player as Player;
    tw.world.god = false;
    p.placeAt(130, FLOOR, 0);
    p.invulnTicks = 0;
    const lives = tw.session.slot(0)!.lives;
    boss.phases = [];
    boss.mode = 'hold';
    runAttack(tw, boss, boss.bravissimo(), () => count(tw, 'scream') > 0, 400);
    tw.run(30);
    expect(tw.session.slot(0)!.lives).toBeLessThan(lives);
  });

  it('uses BRAVISSIMO! once the podium is under 1,200, then ends with the long death and the event', () => {
    const { tw, boss } = stage({ god: true });
    const got = events(tw);
    tw.until(() => fight(boss), 400);
    hit(boss, 'podium', 1300);
    tw.until(() => boss.done.bravissimo > 0, 900);
    hit(boss, 'speaker-left', 1000);
    expect(boss.part('speaker-left')!.destroyed).toBe(true);
    hit(boss, 'podium', 5000);
    expect(boss.state).toBe('dying');
    const t = tw.until(() => boss.defeated, 600);
    expect(t).toBeGreaterThanOrEqual(340);
    expect(got).toEqual(['maestro']);
    expect(tw.world.errors).toEqual([]);
  });

  it('can be won with the pistol and grenades (time to kill)', () => {
    const { tw, boss } = stage({ god: true, playerX: 192 });
    const p = tw.player as Player;
    let ticks = 0;
    // Under him, aiming up; on the middle block's top while he coughs. A grenade every 4 s.
    while (!boss.defeated && ticks < 30000) {
      const b: Button[] = [];
      const want = boss.x;
      if (Math.abs(p.x - want) > 6) b.push(p.x < want ? 'right' : 'left');
      b.push('up');
      if (ticks % 2 === 0) b.push('fire');
      if (ticks % 240 === 120) b.push('bomb');
      if (ticks % 40 === 0) b.push('jump');
      tw.hold(...b);
      tw.run(1);
      ticks++;
    }
    console.log(`[boss-m5] MAESTRO: defeated after ${ticks} ticks (${(ticks / 60).toFixed(1)} s) with the pistol + grenades`);
    expect(boss.defeated).toBe(true);
    expect(ticks).toBeLessThan(15000);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks on HARD without errors', () => {
    const { tw } = stage({ difficulty: 'hard' });
    for (let i = 0; i < 3000; i++) {
      tw.hold(...((((i / 50) | 0) % 2 ? ['left', 'fire'] : ['right', 'fire', 'up']) as Button[]));
      if (i % 70 === 0) tw.hold('jump');
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
  });
});

describe('m5 boss art', () => {
  it('has every part strip in 3 states and stays inside the palette', () => {
    const ids = [...listSprites('boss/grand-organ/'), ...listSprites('boss/organ-console/'), ...listSprites('boss/maestro/'), 'prop/wreck-block/idle'];
    const need: Array<[string, string[]]> = [
      ['boss/grand-organ', [...PIPE_NAMES, 'bellows', 'speaker']],
      ['boss/organ-console', ['pipe-bank-left', 'pipe-bank-right', 'console']],
      ['boss/maestro', ['speaker-left', 'speaker-right', 'podium']],
    ];
    for (const [art, parts] of need) for (const part of parts) for (const s of [0, 1, 2]) expect(ids).toContain(`${art}/${part}-${s}`);
    for (const id of ids) {
      for (const f of getFrames(id)) {
        const d = f.buf.data;
        let bad = 0;
        for (let i = 0; i < d.length; i++) if ((d[i] & 255) !== 0 && ((d[i] & 255) !== 255 || !inPalette(d[i]))) bad++;
        expect(bad, id).toBe(0);
      }
    }
  });
});
