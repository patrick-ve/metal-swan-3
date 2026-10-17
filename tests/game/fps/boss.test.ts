import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { ACTION_BIT as B } from '../../../src/engine/input-actions';
import { PAL } from '../../../src/engine/palette';
import { CELL_PROP } from '../../../src/engine/ray';
import { BOSS_TAUNTS } from '../../../src/game/content/fps/lines';
import { ST_ATTACK, ST_CHASE, ST_DEAD, ST_RECOVER, ST_STAND, ST_TELL } from '../../../src/game/fps/actors';
import { damageActor } from '../../../src/game/fps/ai';
import {
  BOSS_ATTACK_CAP,
  BOSS_HP,
  BOSS_MIN_CHASE_1,
  BOSS_TELL_1,
  BREAK_TICKS,
  SPAWN_CLEAR,
  REINFORCE_MESSAGE,
  REINFORCE_REACT,
  subtitleTicks,
  DEATHCAM_FADE,
  DEATHCAM_HOLD,
  DEATHCAM_SLOW,
  type FpsBoss,
} from '../../../src/game/fps/boss';
import { FpsGame, WEAPON_LOWER_PX } from '../../../src/game/fps/game';
import { getFpsFloor } from '../../../src/game/fps/registry';
import type { FloorResult, FpsFloorDef, FpsInput } from '../../../src/game/fps/types';
import { PlayerSlot, type Difficulty } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
  await import('../../../src/game/content/fps/floors');
});

const idle = (): FpsInput => ({ held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 });

function hangar(difficulty: Difficulty = 'normal', seed = 1): FpsGame {
  const g = new FpsGame({ floor: getFpsFloor('fps-2')!, difficulty, seed, slot: new PlayerSlot(0), carry: null, audio: new NullAudio(), god: true });
  g.skipUnfold();
  return g;
}

/** A plain arena: the boss at (8, 2), the player at (8, 9) facing north (line of sight). */
function arena(seed = 1): FpsGame {
  const rows = [
    'JJJJJJJJJJJJJJJJ',
    'J..............J',
    'J.......@......J',
    'J..............J',
    'J..............J',
    'J..............J',
    'J..............J',
    'J..............J',
    'J..............J',
    'J.......^......J',
    'J..............J',
    'JJJJJJJJJJJJJJJJ',
  ];
  const def: FpsFloorDef = { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 0, rows, ceil: PAL.navy[0], floor: PAL.steel[1], music: 'fps-floor', boss: true };
  const g = new FpsGame({ floor: def, difficulty: 'normal', seed, slot: new PlayerSlot(0), carry: null, audio: new NullAudio(), god: true });
  g.skipUnfold();
  return g;
}

function boss(g: FpsGame): FpsBoss {
  expect(g.boss).not.toBeNull();
  return g.boss!;
}

describe('MechaHitler (§7)', () => {
  it('stands until he sees the player, then wakes: taunt 1, the bar', () => {
    const g = hangar();
    const b = boss(g);
    expect(b.actor.hp).toBe(BOSS_HP[1][1]);
    for (let t = 0; t < 120; t++) g.step(idle());
    expect(b.awake).toBe(false);
    expect(g.bossBar.visible).toBe(false);
    g.setPose(15.5, 12.5, 3072); // in the arena, facing north
    g.step(idle());
    expect(b.awake).toBe(true);
    expect(g.bossBar.visible).toBe(true);
    expect(g.subtitle.text).toBe(BOSS_TAUNTS[0].text);
    expect(g.bossBar.phase).toBe(1);
  });

  it('phases and events: 75 % taunt 2, 50 % taunt 3 + reinforcements, the break, the wreck, phase 2, death-cam', () => {
    const g = hangar('normal');
    const b = boss(g);
    const a = b.actor;
    g.setPose(15.5, 17.5, 3072);
    g.step(idle());
    expect(b.awake).toBe(true);
    const max = a.maxHp;
    damageActor(g, a, Math.ceil(max * 0.25));
    expect(g.subtitle.text).toBe(BOSS_TAUNTS[1].text);
    const before = g.actors.count;
    damageActor(g, a, Math.ceil(max * 0.25));
    expect(g.subtitle.text).toBe(BOSS_TAUNTS[2].text);
    // NORMAL: 3 SS in two waves. 50 %: the bay farther from the player (east, 1 point) opens.
    expect(g.actors.count - before).toBe(1);
    expect(b.firstBay).toBe(1);
    expect(g.messages.at(-1)?.text).toBe(REINFORCE_MESSAGE);
    // 25 %: the other bay (west, 2 points).
    damageActor(g, a, Math.ceil(max * 0.25));
    expect(g.actors.count - before).toBe(3);
    for (let i = before; i < g.actors.count; i++) {
      // They count for no kill %, stand REINFORCE_REACT ticks in the door, then chase.
      expect(g.actors.actors[i].type).toBe('ss');
      expect(g.actors.actors[i].placed).toBe(false);
      expect(g.actors.actors[i].state).toBe(ST_STAND);
      expect(g.actors.actors[i].react).toBe(REINFORCE_REACT);
    }
    for (let t = 0; t < REINFORCE_REACT; t++) g.step(idle());
    for (let i = before; i < g.actors.count; i++) expect(g.actors.actors[i].state).toBeGreaterThanOrEqual(ST_CHASE);
    const placed = g.actors.placedTotal;
    // The suit breaks: invulnerable for 120 ticks, 25,000 points.
    const score0 = g.slot.score;
    damageActor(g, a, max);
    expect(b.breakT).toBe(0);
    expect(g.slot.score - score0).toBe(25000);
    expect(damageActor(g, a, 50)).toBe(0);
    const wx = Math.floor(a.x);
    const wy = Math.floor(a.y);
    const items0 = g.items.count;
    for (let t = 0; t < BREAK_TICKS; t++) g.step(idle());
    expect(b.phase).toBe(2);
    expect(a.hp).toBe(BOSS_HP[2][1]);
    expect(a.def.radius).toBe(0.34);
    expect(g.subtitle.text).toBe(BOSS_TAUNTS[3].meaning);
    expect(g.bossBar.phase).toBe(2);
    // The wreck is a solid prop; he stands next to it; two clips spilled next to it.
    expect([b.wreckX, b.wreckY]).toEqual([wx, wy]);
    expect(g.grid.flags[g.grid.idx(wx, wy)] & CELL_PROP).toBe(CELL_PROP);
    expect(Math.max(Math.abs(a.cx - wx), Math.abs(a.cy - wy))).toBe(1);
    const spilled = [];
    for (let k = items0; k < g.items.count; k++) spilled.push(g.items.id[k]);
    expect(spilled.filter((id) => id === 'clip').length).toBe(2);
    // On foot 50 % → taunt 5.
    damageActor(g, a, Math.ceil(a.maxHp / 2));
    expect(g.subtitle.text).toBe(BOSS_TAUNTS[4].meaning);
    // 0 HP → the death-cam; the clock stops; the boss counts as one kill.
    const kills0 = g.actors.kills;
    const clock = g.clock;
    const score1 = g.slot.score;
    let result: FloorResult | null = null;
    g.events.on('floorComplete', ({ result: r }) => (result = r));
    damageActor(g, a, a.maxHp);
    expect(g.state).toBe('deathcam');
    expect(g.slot.score - score1).toBe(50000);
    expect(g.actors.kills).toBe(kills0 + 1);
    expect(g.subtitle.text).toBe(BOSS_TAUNTS[5].meaning);
    const total = DEATHCAM_SLOW + DEATHCAM_HOLD + DEATHCAM_FADE;
    for (let t = 0; t < total - 1; t++) g.step(idle());
    expect(result).toBeNull();
    g.step(idle());
    expect(result).not.toBeNull();
    expect(result!.ticks).toBe(clock);
    expect(result!.killsTotal).toBe(placed);
    expect(a.state).toBe(ST_DEAD);
    expect(g.fade).toBe(1);
  });

  it('the death-cam: slow motion, input off, the others freeze, the camera turns to him', () => {
    const g = hangar('hard');
    const b = boss(g);
    const a = b.actor;
    g.setPose(15.5, 17.5, 3072);
    g.step(idle());
    damageActor(g, a, a.maxHp); // break (reinforcements came at 50 %)
    for (let t = 0; t < BREAK_TICKS; t++) g.step(idle());
    g.setPose(20.5, 17.5, 0); // facing east, away from him
    const ss = g.actors.actors.slice(0, g.actors.count).filter((x) => x.type === 'ss' && !x.placed);
    damageActor(g, a, a.maxHp);
    expect(g.state).toBe('deathcam');
    const pos = ss.map((x) => [x.x, x.y]);
    const p0 = [g.player.x, g.player.y];
    const fwd: FpsInput = { held: B.forward | B.fire, pressed: B.fire, turn: 0, moveX: 0, moveY: 0 };
    for (let t = 0; t < 30; t++) g.step(fwd);
    expect([g.player.x, g.player.y]).toEqual(p0);
    expect(ss.map((x) => [x.x, x.y])).toEqual(pos);
    // He is in front now.
    const want = Math.atan2(a.y - g.player.y, a.x - g.player.x);
    const got = (g.player.angle / 4096) * Math.PI * 2;
    expect(Math.abs(Math.atan2(Math.sin(want - got), Math.cos(want - got)))).toBeLessThan(0.05);
    // Die frames run at a third of the speed: after 30 ticks the actor timer moved 10.
    expect(a.timer).toBe(10);
    expect(g.hurt(50, a.x, a.y)).toBeUndefined();
    expect(g.player.hp).toBe(100);
  });

  it('attack rhythm: tell 30, a burst of 8 every 4 ticks, recover 45; gaps ≥ recover + 45; the 120-tick cap', () => {
    for (const seed of [1, 2, 3]) {
      const g = arena(seed);
      const b = boss(g);
      const a = b.actor;
      const shots: Array<{ tick: number; tell: number }> = [];
      g.actors.onShot = (e) => {
        if (e.actor === a) shots.push({ tick: g.tick, tell: e.tell });
      };
      let prev = a.state;
      let tellAt = -1;
      let recoverEnd = -1;
      let burstEnd = -1;
      const tells: number[] = [];
      const chaseToTell: number[] = [];
      const gaps: number[] = [];
      for (let t = 0; t < 3000; t++) {
        g.step(idle());
        if (a.state !== prev) {
          if (a.state === ST_TELL) {
            tellAt = g.tick;
            if (recoverEnd >= 0) chaseToTell.push(g.tick - recoverEnd);
            if (burstEnd >= 0) gaps.push(g.tick - burstEnd);
          }
          if (prev === ST_TELL && a.state === ST_ATTACK) tells.push(g.tick - tellAt);
          if (prev === ST_ATTACK && a.state === ST_RECOVER) burstEnd = g.tick;
          if (prev === ST_RECOVER && a.state === ST_CHASE) recoverEnd = g.tick;
          prev = a.state;
        }
      }
      expect(tells.length, `seed ${seed}`).toBeGreaterThan(5);
      for (const t of tells) expect(t).toBe(BOSS_TELL_1);
      for (const s of shots) expect(s.tell).toBeGreaterThanOrEqual(18);
      // Bursts of 8, 4 ticks apart.
      expect(shots.length % 8).toBe(0);
      expect(shots[1].tick - shots[0].tick).toBe(4);
      for (const c of chaseToTell) {
        expect(c).toBeGreaterThanOrEqual(BOSS_MIN_CHASE_1);
        expect(c).toBeLessThanOrEqual(BOSS_ATTACK_CAP + 1);
      }
      for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(45 + BOSS_MIN_CHASE_1);
    }
  });

  it('the wreck blocks the player', () => {
    const g = hangar('easy');
    const b = boss(g);
    const a = b.actor;
    g.setPose(15.5, 17.5, 3072);
    g.step(idle());
    damageActor(g, a, a.maxHp);
    for (let t = 0; t < BREAK_TICKS; t++) g.step(idle());
    // Stand two cells south of the wreck, face north, walk.
    a.hp = 1;
    const wx = b.wreckX;
    const wy = b.wreckY;
    g.setPose(wx + 0.5, wy + 2.5, 3072);
    g.actors.releaseAll(a);
    a.x = 1.5; // move him aside (test only)
    a.y = 1.5;
    const fwd: FpsInput = { held: B.forward, pressed: 0, turn: 0, moveX: 0, moveY: 0 };
    for (let t = 0; t < 60; t++) g.step(fwd);
    expect(g.player.y).toBeGreaterThan(wy + 1);
  });

  it('never leaves the arena (the leash), even when the player waits outside', () => {
    const g = hangar('normal', 2);
    const b = boss(g);
    const a = b.actor;
    g.setPose(15.5, 19.5, 3072);
    g.step(idle());
    expect(b.awake).toBe(true);
    g.setPose(15.5, 24.5, 3072); // the antechamber
    for (let t = 0; t < 2000; t++) {
      g.step(idle());
      expect(b.leash[a.cy * g.grid.w + a.cx]).toBe(1);
      expect(a.cx).toBeGreaterThanOrEqual(7);
      expect(a.cx).toBeLessThanOrEqual(24);
      expect(a.cy).toBeGreaterThanOrEqual(2);
      expect(a.cy).toBeLessThanOrEqual(19);
    }
  });

  it('a restart brings the suit back (phase 1, full HP, no wreck)', () => {
    const g = hangar();
    const a = boss(g).actor;
    g.setPose(15.5, 17.5, 3072);
    g.step(idle());
    damageActor(g, a, a.maxHp);
    for (let t = 0; t < BREAK_TICKS; t++) g.step(idle());
    g.restart();
    const b2 = boss(g);
    expect(b2.phase).toBe(1);
    expect(b2.actor.hp).toBe(BOSS_HP[1][1]);
    expect(b2.awake).toBe(false);
    expect(g.map.props.some((p) => p.id === 'fps/boss/wreck')).toBe(false);
    expect(g.bossBar.visible).toBe(false);
  });

  it('debug F4 (§1.11): phase 1 → the suit breaks, phase 2 → he dies; floor 1 → the elevator', () => {
    const g = hangar();
    const b = boss(g);
    g.debugSkip();
    expect(b.awake).toBe(true);
    expect(b.breakT).toBe(0);
    g.debugSkip(); // nothing while the suit breaks
    expect(b.phase).toBe(1);
    for (let t = 0; t <= BREAK_TICKS; t++) g.step(idle());
    expect(b.phase).toBe(2);
    g.debugSkip();
    expect(g.state).toBe('deathcam');
    expect(g.actors.kills).toBe(1);
    const f1 = new FpsGame({ floor: getFpsFloor('fps-1')!, difficulty: 'normal', seed: 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio(), god: true });
    f1.skipUnfold();
    f1.debugSkip();
    expect(f1.state).toBe('elevator');
  });

  it('no reinforcement spawns at the player\'s back: a player in the west bay leaves its points empty', () => {
    const g = hangar('hard');
    const a = boss(g).actor;
    g.setPose(4.5, 11.5, 0); // in the west bay (points (4, 9) and (4, 10))
    damageActor(g, a, 1); // wakes him
    const before = g.actors.count;
    damageActor(g, a, Math.ceil(a.maxHp * 0.5));
    // HARD: 4 points, the 2 west ones are within SPAWN_CLEAR of the player.
    expect(g.actors.count - before).toBe(2);
    for (let i = before; i < g.actors.count; i++) {
      const ss = g.actors.actors[i];
      expect(Math.max(Math.abs(ss.x - g.player.x), Math.abs(ss.y - g.player.y))).toBeGreaterThanOrEqual(SPAWN_CLEAR);
    }
  });

  it('fire is off while the suit breaks: holding the chaingun through the break spends no round', () => {
    const g = hangar('normal');
    const b = boss(g);
    const a = b.actor;
    g.giveAll(); // chaingun, 99 rounds
    g.setPose(15.5, 9.5, 3072); // facing north, the boss at (15, 4)
    g.step(idle());
    expect(b.awake).toBe(true);
    const fire: FpsInput = { held: B.fire, pressed: 0, turn: 0, moveX: 0, moveY: 0 };
    damageActor(g, a, a.hp); // the suit breaks
    expect(b.breakT).toBe(0);
    const ammo0 = g.player.ammo;
    let lowest = 0;
    for (let t = 0; t < BREAK_TICKS - 1; t++) {
      g.step(fire);
      lowest = Math.max(lowest, g.weaponLower);
    }
    expect(g.player.ammo).toBe(ammo0);
    expect(lowest).toBe(WEAPON_LOWER_PX);
    // Phase 2: the weapon comes back up, then the held fire shoots again.
    for (let t = 0; t < 30; t++) g.step(fire);
    expect(b.phase).toBe(2);
    expect(g.weaponLower).toBe(0);
    expect(g.player.ammo).toBeLessThan(ammo0);
  });

  it('the boss on foot walks around his wreck to a player behind it (the wreck is off the leash)', () => {
    const g = hangar('normal');
    const b = boss(g);
    const a = b.actor;
    g.setPose(15.5, 9.5, 3072);
    g.step(idle());
    damageActor(g, a, a.hp);
    for (let t = 0; t <= BREAK_TICKS; t++) g.step(idle());
    expect(b.phase).toBe(2);
    expect(b.leash[b.wreckY * g.grid.w + b.wreckX]).toBe(0);
    // Put him on the far side of the wreck from the player, 3 tiles apart across it.
    const wx = b.wreckX;
    const wy = b.wreckY;
    g.actors.releaseAll(a);
    a.x = wx + 0.5;
    a.y = wy + 1.5;
    a.cx = a.tx = wx;
    a.cy = a.ty = wy + 1;
    a.dir = -1;
    g.actors.claim(a, wx, wy + 1);
    const x0 = a.x;
    const y0 = a.y;
    let walked = 0;
    for (let t = 0; t < 240; t++) {
      g.setPose(wx + 0.5, wy - 1.5, 1024); // the player stays put behind the wreck
      g.step(idle());
      walked = Math.max(walked, Math.hypot(a.x - x0, a.y - y0));
    }
    expect(walked).toBeGreaterThan(1);
  });

  it('a taunt subtitle never ends before its voice clip (§7.4: 150 or the clip + 30 ticks)', async () => {
    const { SAMPLE_MANIFEST } = await import('../../../src/game/content/samples/manifest');
    const { defineSampleGroup, voiceKey } = await import('../../../src/engine/samples');
    const group = SAMPLE_MANIFEST['mode:fps'];
    defineSampleGroup('mode:fps', group);
    for (const line of BOSS_TAUNTS) {
      const dur = group.voice?.[voiceKey(line.text)]?.duration;
      expect(dur, line.text).toBeGreaterThan(0);
      const ticks = subtitleTicks(line.text);
      expect(ticks, line.text).toBeGreaterThanOrEqual(150);
      expect(ticks, line.text).toBeGreaterThanOrEqual(Math.round(dur! * 60) + 30);
    }
    // The boss uses it: taunt 1 on wake.
    const g = hangar();
    g.setPose(15.5, 12.5, 3072);
    g.step(idle());
    expect(g.subtitle.ticks).toBeGreaterThanOrEqual(Math.round(group.voice![voiceKey(BOSS_TAUNTS[0].text)].duration * 60) + 30 - 1);
  });
});
