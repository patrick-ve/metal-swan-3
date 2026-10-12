/**
 * Machines sub-area "armor" (GDD §9.2, §9.5, §4.11): oompah-tank (+ tank-crewman, bell-shell),
 * metronome-turret (+ metronome-bullet), gramophone-mortar (+ record), pipe-battery
 * (+ note-rocket), anthem-speaker, drum-barricade. Spawning with params, HP and scores,
 * telegraphs of at least 18 ticks, no off-screen fire, the wreck, the crewman and the anthem.
 */
import { describe, expect, it } from 'vitest';
import type { Damage, Entity } from '../../src/engine/entity';
import { NullAudio } from '../../src/engine/audio';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/machines/armor/index';
import '../../src/game/content/machines/armor/art';
import {
  AnthemSpeaker,
  ANTHEM,
  DRUM_BARRICADE,
  DrumBarricade,
  GRAMOPHONE,
  GramophoneMortar,
  METRONOME_TURRET,
  MetronomeTurret,
  NoteRocket,
  OOMPAH_TANK,
  OompahTank,
  PIPE_BATTERY,
  PipeBattery,
  playAnthem,
  TankCrewman,
  VinylRecord,
} from '../../src/game/content/machines/armor/index';
import { VirtualPad } from '../../src/engine/input';
import { Enemy } from '../../src/game/enemy';
import { Player } from '../../src/game/player/player';
import { getEntityMeta, hasEntity } from '../../src/game/registry';
import { getFrames, hasSprite } from '../../src/engine/sprites';
import { PALETTE } from '../../src/engine/palette';
import { FLOOR, TestWorld, type TestWorldOptions } from './helpers';

const IDS = ['oompah-tank', 'tank-crewman', 'bell-shell', 'metronome-turret', 'metronome-bullet', 'gramophone-mortar', 'record', 'pipe-battery', 'note-rocket', 'anthem-speaker', 'drum-barricade'];

const SHOT = (amount: number, kind: Damage['kind'] = 'bullet'): Damage => ({ amount, kind, dirX: 1, owner: 0 });

function live(tw: TestWorld, type: string): Entity[] {
  return tw.world.entities.filter((e) => e.type === type && !e.removed && !e.dead);
}

function enemyShots(tw: TestWorld): Entity[] {
  return tw.world.entities.filter((e) => e.team === 'enemy' && e.hasTag('shot') && !e.removed);
}

/**
 * Run until `start()` turns true (the telegraph begins), then until a shot of `type` exists.
 * Returns the ticks between the two (the telegraph length the player sees).
 */
function telegraphToShot(tw: TestWorld, start: () => boolean, type: string, max = 900): number {
  tw.until(start, max);
  const t0 = tw.world.tick;
  tw.until(() => live(tw, type).length > 0, max);
  return tw.world.tick - t0;
}

/** A world with a 20 px ceiling block over x 150–550 (its underside at y 40). */
function ceilingWorld(o: TestWorldOptions = {}): TestWorld {
  return new TestWorld({ build: (t) => t.solid(150, 20, 400, 20), ...o });
}

describe('armor machines: registration', () => {
  it('registers every id of the sub-area', () => {
    for (const id of IDS) expect(hasEntity(id), id).toBe(true);
  });

  it.each(IDS)('%s spawns with no params and runs 300 ticks without errors', (id) => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const e = tw.spawn(id, 230);
    expect(e.hasTag('placeholder')).toBe(false);
    tw.run(300);
    expect(tw.world.errors.map((x) => `${x.where}: ${x.message}`)).toEqual([]);
  });

  it('uses the GDD HP and scores (NORMAL, 1 player)', () => {
    const tw = new TestWorld({ god: true });
    const hp: Record<string, number> = { 'oompah-tank': 500, 'metronome-turret': 300, 'gramophone-mortar': 240, 'pipe-battery': 600, 'anthem-speaker': 100, 'drum-barricade': 600, 'tank-crewman': 10 };
    for (const [id, v] of Object.entries(hp)) expect(tw.spawn(id, 300).maxHp, id).toBe(v);
    const score: Record<string, number> = { 'oompah-tank': 3000, 'metronome-turret': 1500, 'gramophone-mortar': 1200, 'pipe-battery': 3000, 'anthem-speaker': 500, 'drum-barricade': 2000, 'tank-crewman': 100 };
    for (const [id, v] of Object.entries(score)) expect(getEntityMeta(id)?.score, id).toBe(v);
  });

  it('scales machine HP by difficulty and is not knifeable', () => {
    const hard = new TestWorld({ god: true, difficulty: 'hard' });
    expect(hard.spawn('oompah-tank', 300).maxHp).toBe(625);
    expect(hard.spawn('oompah-tank', 300).hasTag('soft')).toBe(false);
    const easy = new TestWorld({ god: true, difficulty: 'easy' });
    expect(easy.spawn('metronome-turret', 300, { floor: true }).maxHp).toBe(240);
  });

  it('draws every strip the logic asks for, in palette colours only', () => {
    const strips = [
      'machine/oompah-tank/body', 'machine/oompah-tank/body-dented', 'machine/oompah-tank/turret', 'machine/oompah-tank/turret-front',
      'machine/oompah-tank/tell', 'machine/oompah-tank/fire', 'machine/oompah-tank/flip', 'machine/oompah-tank/wreck',
      'machine/oompah-tank/shell', 'machine/oompah-tank/pulse',
      'machine/metronome-turret/body', 'machine/metronome-turret/body-floor', 'machine/metronome-turret/dent', 'machine/metronome-turret/dent-floor',
      'machine/metronome-turret/pendulum', 'machine/metronome-turret/pendulum-floor', 'machine/metronome-turret/weight', 'machine/metronome-turret/weight-floor',
      'machine/metronome-turret/wreck', 'machine/metronome-turret/wreck-floor', 'machine/metronome-turret/snap', 'machine/metronome-turret/bullet',
      'machine/gramophone-mortar/body', 'machine/gramophone-mortar/dent', 'machine/gramophone-mortar/horn', 'machine/gramophone-mortar/wreck',
      'machine/gramophone-mortar/record', 'machine/gramophone-mortar/record-roll', 'machine/gramophone-mortar/horn-top',
      'machine/pipe-battery/pipe-0', 'machine/pipe-battery/pipe-4', 'machine/pipe-battery/body', 'machine/pipe-battery/wreck',
      'machine/pipe-battery/rocket', 'machine/pipe-battery/rocket-down', 'machine/pipe-battery/shadow',
      'machine/anthem-speaker/body', 'machine/anthem-speaker/tell', 'machine/anthem-speaker/dent', 'machine/anthem-speaker/wreck', 'machine/anthem-speaker/note-bubble',
      'machine/drum-barricade/body', 'machine/drum-barricade/wreck', 'machine/drum-barricade/drum',
      'enemy/tank-crewman/panic', 'enemy/tank-crewman/hop', 'enemy/tank-crewman/die', 'enemy/tank-crewman/salute',
    ];
    const pal = new Set(PALETTE.map((c) => c >>> 0));
    for (const id of strips) {
      expect(hasSprite(id), id).toBe(true);
      for (const f of getFrames(id)) {
        for (const c of f.buf.data) if ((c & 255) !== 0) expect(pal.has(c >>> 0), `${id}: #${(c >>> 0).toString(16)}`).toBe(true);
      }
    }
    expect(getFrames('machine/metronome-turret/pendulum').length).toBe(21);
    expect(getFrames('machine/gramophone-mortar/horn').length).toBe(5);
    expect(getFrames('machine/drum-barricade/body').length).toBe(3);
  });
});

describe('oompah-tank', () => {
  it('drives in to stopX with spawn armour (shots ping off), then takes damage', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const tank = tw.spawn('oompah-tank', 420, { stopX: 300, enter: 'right' }) as OompahTank;
    expect(tank.facing).toBe(-1);
    expect(tank.mode).toBe('drive');
    tw.run(20);
    expect(tank.armored).toBe(true);
    tank.onHit(SHOT(50));
    expect(tank.hp).toBe(500);
    tw.until(() => tank.mode !== 'drive', 400);
    expect(Math.abs(tank.x - 300)).toBeLessThan(1);
    expect(tank.armored).toBe(false);
    tank.onHit(SHOT(50));
    expect(tank.hp).toBe(450);
  });

  it('loses its spawn armour after 240 ticks even when stopX is far', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 3000 });
    const tank = tw.spawn('oompah-tank', 1400, { stopX: 200, enter: 'right' }) as OompahTank;
    tw.run(OOMPAH_TANK.armourTicks - 5);
    expect(tank.armored).toBe(true);
    tw.run(10);
    expect(tank.armored).toBe(false);
  });

  it('never moves right of params.maxX (the m1-c leash)', () => {
    const tw = new TestWorld({ god: true, playerX: 640, width: 2000 });
    const tank = tw.spawn('oompah-tank', 720, { facing: -1, maxX: 744 }) as OompahTank;
    let maxX = tank.x;
    for (let i = 0; i < 900; i++) {
      tw.run(1);
      maxX = Math.max(maxX, tank.x);
    }
    expect(maxX).toBeLessThanOrEqual(744);
    // It did try to back away from the player (who stands 80 px from it).
    expect(maxX).toBeGreaterThan(730);
  });

  it('telegraphs the bell shell 45 ticks, then lobs it (vx 2.2, vy −2.5) and recovers 80', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as OompahTank;
    const t = telegraphToShot(tw, () => tank.mode === 'shell', 'bell-shell');
    expect(t).toBeGreaterThanOrEqual(18);
    expect(t).toBe(OOMPAH_TANK.shellTell);
    const shell = live(tw, 'bell-shell')[0];
    expect(shell.vx).toBeCloseTo(-2.2, 5);
    expect(shell.vy).toBeLessThan(-2.3);
    expect(tank.mode).toBe('recover');
    expect((tw.world.audio as NullAudio).log).toContain('sfx:enemy/tuba-inhale');
    tw.until(() => tank.mode !== 'recover');
    // The shell lands in front of the tank and bursts (r 18).
    tw.until(() => live(tw, 'bell-shell').length === 0, 300);
  });

  it('bass-pulses a player within 64 px after a 24-tick rumble; the wave runs 48 px each side', () => {
    const tw = new TestWorld({ god: true, playerX: 220 });
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as OompahTank;
    const t = telegraphToShot(tw, () => tank.mode === 'pulse', 'bass-pulse');
    expect(t).toBe(OOMPAH_TANK.pulseTell);
    const waves = live(tw, 'bass-pulse');
    expect(waves.length).toBe(2);
    expect(Math.sign(waves[0].vx)).not.toBe(Math.sign(waves[1].vx));
    // 10 px tall, on the floor: a jump clears it.
    expect(waves[0].hitbox.h).toBe(10);
    expect(waves[0].y + 5).toBeCloseTo(FLOOR, 0);
    tw.run(30);
    expect(live(tw, 'bass-pulse').length).toBe(0);
  });

  it('never fires from outside the view: a telegraph the camera scrolls away from is cancelled', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 3000 });
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as OompahTank;
    tw.until(() => tank.mode === 'shell', 600);
    // The view jumps far away (a section with the tank behind the camera).
    tw.player!.placeAt(1500, FLOOR, 0);
    tw.world.camera.lock(1300, 1684);
    tw.world.camera.snap();
    tw.run(120);
    expect(live(tw, 'bell-shell').length).toBe(0);
    expect(live(tw, 'bass-pulse').length).toBe(0);
  });

  it('dies: sad notes, the crewman pops out of the hatch, a solid 56×20 wreck stays 600 ticks', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as OompahTank;
    tw.run(5);
    tank.onHit(SHOT(600));
    expect(tank.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(3000);
    expect((tw.world.audio as NullAudio).log).toContain('sfx:machine/sad-notes');
    tw.run(OOMPAH_TANK.crewAt + 1);
    const crew = live(tw, 'tank-crewman');
    expect(crew.length).toBe(1);
    tw.run(OOMPAH_TANK.boomAt - OOMPAH_TANK.crewAt);
    const wreck = tw.world.solids.find((s) => s.owner === tank && !s.oneWay);
    expect(wreck).toBeDefined();
    expect(wreck!.w).toBe(56);
    expect(wreck!.h).toBe(20);
    expect(wreck!.y + wreck!.h).toBeCloseTo(FLOOR, 5);
    expect(tank.removed).toBe(false);
    tw.run(590);
    expect(tank.removed).toBe(false);
    tw.run(20);
    expect(tank.removed).toBe(true);
    expect(tw.world.solids.includes(wreck!)).toBe(false);
  });

  it('carries a player on its hull top (a one-way deck)', () => {
    const tw = new TestWorld({ god: true, playerX: 260 });
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as OompahTank;
    tw.player!.placeAt(260, FLOOR - 40, 0);
    tw.run(30);
    expect(tw.player!.y).toBeCloseTo(tank.y - 28, 0);
  });
});

describe('tank-crewman', () => {
  it('has 10 HP, hops out, scurries away from the player in the panic pose and never attacks', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const crew = tw.spawn('tank-crewman', 240, { entry: 'hatch', facing: 1 }, FLOOR - 42) as TankCrewman;
    expect(crew.hp).toBe(10);
    expect(crew.hasTag('legion')).toBe(true);
    expect(crew.mode).toBe('hop');
    tw.run(60);
    expect(crew.mode).not.toBe('hop');
    expect(crew.x).toBeGreaterThan(260);
    expect(crew.anim.id).toBe('enemy/tank-crewman/panic');
    expect(enemyShots(tw).length).toBe(0);
    crew.onHit(SHOT(10));
    expect(crew.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(100);
  });
});

describe('metronome-turret', () => {
  it('hangs from a ceiling: swings ±50°, glows 18 ticks before each extreme, fires 3 bullets downward', () => {
    const tw = ceilingWorld({ god: true, playerX: 100 });
    const m = tw.spawn('metronome-turret', 300, {}, 40) as MetronomeTurret;
    expect(m.floor).toBe(false);
    const t = telegraphToShot(tw, () => m.glowing, 'metronome-bullet');
    expect(t).toBeGreaterThanOrEqual(18);
    tw.run(15);
    const b = live(tw, 'metronome-bullet');
    expect(b.length).toBe(METRONOME_TURRET.burst);
    for (const s of b) expect(s.vy).toBeGreaterThan(0);
    expect(Math.hypot(b[0].vx, b[0].vy)).toBeCloseTo(2.5, 5);
    // ±50°: the bullets leave along the pendulum, 40° below the horizon.
    expect(Math.abs(Math.atan2(b[0].vy, Math.abs(b[0].vx)) * (180 / Math.PI))).toBeCloseTo(40, 0);
    let maxA = 0;
    for (let i = 0; i < 200; i++) {
      tw.run(1);
      maxA = Math.max(maxA, Math.abs(m.angle));
    }
    expect(maxA).toBeLessThanOrEqual(50.001);
    expect(maxA).toBeGreaterThan(49);
  });

  it('stands upright with floor: true and fires upward; one swing takes 60 ticks', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const m = tw.spawn('metronome-turret', 300, { floor: true }) as MetronomeTurret;
    expect(m.floor).toBe(true);
    expect(m.period).toBe(METRONOME_TURRET.swing);
    tw.until(() => live(tw, 'metronome-bullet').length > 0, 300);
    for (const s of live(tw, 'metronome-bullet')) expect(s.vy).toBeLessThan(0);
  });

  it('accelerando: 600 ticks after it came into view the weight slides down and a swing takes 45', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const m = tw.spawn('metronome-turret', 300, { floor: true }) as MetronomeTurret;
    tw.run(590);
    expect(m.fast).toBe(false);
    tw.run(80);
    expect(m.fast).toBe(true);
    expect(m.period).toBe(METRONOME_TURRET.fastSwing);
  });

  it('never fires while outside the view, and dies into a wreck (1,500 points)', () => {
    const tw = new TestWorld({ god: true, playerX: 100, width: 3000 });
    const far = tw.spawn('metronome-turret', 1200, { floor: true }) as MetronomeTurret;
    tw.run(300);
    expect(live(tw, 'metronome-bullet').length).toBe(0);
    expect(far.activated).toBe(false);
    const m = tw.spawn('metronome-turret', 300, { floor: true }) as MetronomeTurret;
    m.onHit(SHOT(400));
    expect(m.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(1500);
    tw.run(120);
    expect(m.removed).toBe(false);
  });
});

describe('gramophone-mortar', () => {
  it('aims 30 + scratches 20 ticks, then lobs a record that lands near the player and rolls 96 px', () => {
    const tw = new TestWorld({ god: true, playerX: 200 });
    const g = tw.spawn('gramophone-mortar', 300) as GramophoneMortar;
    const t = telegraphToShot(tw, () => g.mode === 'aim', 'record');
    expect(t).toBe(GRAMOPHONE.tell);
    expect((tw.world.audio as NullAudio).log).toContain('sfx:machine/scratch');
    const rec = live(tw, 'record')[0] as VinylRecord;
    expect(rec.vy).toBeCloseTo(GRAMOPHONE.recordVy, 5);
    expect(Math.abs(rec.vx)).toBeLessThanOrEqual(GRAMOPHONE.maxVx);
    expect(rec.hp).toBe(GRAMOPHONE.recordHp);
    expect(rec.hasTag('shootable')).toBe(true);
    expect(rec.hasTag('soft')).toBe(true);
    expect(rec.score).toBe(50);
    // The player steps away (the record would hit a player who stays put).
    tw.player!.placeAt(40, FLOOR, 0);
    tw.until(() => rec.rolling, 200);
    // It lands at the player's x (within a few px), on the floor.
    expect(Math.abs(rec.x - 200)).toBeLessThan(6);
    expect(rec.y + 3).toBeCloseTo(FLOOR, 0);
    expect(rec.hitbox.h).toBe(6);
    const x0 = rec.x;
    tw.until(() => rec.removed, 200);
    expect(Math.abs(rec.x - x0)).toBeGreaterThan(90);
  });

  it('attacks every 150 ticks', () => {
    const tw = new TestWorld({ god: true, playerX: 200 });
    tw.spawn('gramophone-mortar', 300);
    tw.until(() => live(tw, 'record').length > 0, 400);
    const t0 = tw.world.tick;
    let t1 = 0;
    let n = 1;
    for (let i = 0; i < 400 && !t1; i++) {
      tw.run(1);
      const k = live(tw, 'record').length;
      if (k > n) t1 = tw.world.tick;
      n = Math.max(n, k);
      if (k === 0) n = 0;
    }
    expect(t1 - t0).toBe(GRAMOPHONE.cycle);
  });

  it('dies into a wreck (1,200 points); the horn spins off', () => {
    const tw = new TestWorld({ god: true, playerX: 200 });
    const g = tw.spawn('gramophone-mortar', 300) as GramophoneMortar;
    g.onHit(SHOT(240));
    expect(g.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(1200);
    tw.run(1);
    expect(tw.world.entities.some((e) => e.type === 'fx' && !e.removed)).toBe(true);
    // The broken box stays.
    tw.run(120);
    expect(g.removed).toBe(false);
  });
});

describe('pipe-battery', () => {
  it('has 5 pipe parts of 120 HP; the chest is armoured; +300 per pipe and 3,000 for the battery', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const b = tw.spawn('pipe-battery', 300) as PipeBattery;
    expect(b.hurtboxes().length).toBe(6);
    expect(b.pipeMax).toBe(PIPE_BATTERY.pipeHp);
    b.onHit(SHOT(50), 0);
    expect(b.hp).toBe(600);
    for (let i = 1; i <= 5; i++) {
      b.onHit(SHOT(120), i);
      expect(b.pipesLeft).toBe(5 - i);
    }
    expect(b.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(5 * 300 + 3000);
  });

  it('a broken pipe never fires again and reports no hurtbox in the world', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const b = tw.spawn('pipe-battery', 300) as PipeBattery;
    b.onHit(SHOT(120), 3);
    const box = b.hurtboxes()[3];
    expect(box.x).toBeLessThan(-1e5);
    for (let i = 0; i < 400; i++) {
      tw.run(1);
      expect(b.glowPipe).not.toBe(2);
    }
  });

  it('each pipe glows 30 ticks, then fires a note-rocket that falls near a player after a 40-tick shadow', () => {
    const tw = new TestWorld({ god: true, playerX: 150 });
    const b = tw.spawn('pipe-battery', 300) as PipeBattery;
    const t = telegraphToShot(tw, () => b.glowPipe >= 0, 'note-rocket');
    expect(t).toBe(PIPE_BATTERY.glow);
    const rocket = live(tw, 'note-rocket')[0] as NoteRocket;
    expect(rocket.vy).toBeLessThan(0);
    expect(rocket.hasTag('shootable')).toBe(true);
    tw.until(() => rocket.phase !== 'up', 120);
    const shadowAt = tw.world.tick;
    expect(Math.abs(rocket.targetX - 150)).toBeLessThanOrEqual(PIPE_BATTERY.spread);
    tw.until(() => rocket.removed, 200);
    expect(tw.world.tick - shadowAt).toBeGreaterThanOrEqual(PIPE_BATTERY.shadow);
  });

  it('the chord: the pipes take turns in chord order within one 180-tick cycle', () => {
    const tw = new TestWorld({ god: true, playerX: 150 });
    const b = tw.spawn('pipe-battery', 300) as PipeBattery;
    const order: number[] = [];
    let last = -1;
    for (let i = 0; i < 180 && order.length < 5; i++) {
      tw.run(1);
      if (b.glowPipe >= 0 && b.glowPipe !== last) order.push(b.glowPipe);
      last = b.glowPipe;
    }
    expect(order).toEqual([2, 1, 3, 0, 4]);
  });
});

describe('anthem-speaker', () => {
  function anthemWorld(): { tw: TestWorld; sp: AnthemSpeaker; near: Enemy[]; far: Enemy } {
    const tw = new TestWorld({ god: true, playerX: 40, width: 2000 });
    const sp = tw.spawn('anthem-speaker', 250, { first: 10 }) as AnthemSpeaker;
    const near = [tw.spawn('rifleman', 200, { gag: false, facing: -1 }), tw.spawn('rifleman', 340, { gag: false, facing: -1 })] as Enemy[];
    const far = tw.spawn('rifleman', 700, { gag: false, facing: -1 }) as Enemy;
    return { tw, sp, near, far };
  }

  it('is a support machine: no enemy tag (never holds a wave), 100 HP, never shoots', () => {
    const { tw, sp } = anthemWorld();
    expect(sp.hasTag('enemy')).toBe(false);
    expect(sp.hasTag('shootable')).toBe(true);
    expect(sp.team).toBe('enemy');
    expect(sp.maxHp).toBe(ANTHEM.hp);
    tw.run(400);
    expect(tw.world.entities.some((e) => e.hasTag('shot') && (e as { shooter?: unknown }).shooter === sp)).toBe(false);
  });

  it('crackles 30 ticks, then plays 180: Legion soldiers within 240 px salute (no attacks), others do not', () => {
    const { tw, sp, near, far } = anthemWorld();
    tw.until(() => sp.mode === 'crackle', 100);
    expect((tw.world.audio as NullAudio).log).toContain('sfx:machine/anthem-crackle');
    tw.run(ANTHEM.crackle);
    expect(sp.mode).toBe('play');
    expect((tw.world.audio as NullAudio).log).toContain('sfx:env/anthem-sting');
    for (const e of near) expect(e.reaction).toBe('salute');
    expect(far.reaction).toBeNull();
    // Saluting soldiers fire nothing for the whole anthem.
    const before = enemyShots(tw).length;
    tw.run(ANTHEM.play - 10);
    for (const e of near) expect(e.reaction).toBe('salute');
    expect(enemyShots(tw).length).toBe(before);
    tw.run(20);
    expect(sp.mode).toBe('idle');
    for (const e of near) expect(e.reaction).toBeNull();
  });

  it('plays again every `interval` ticks (start to start)', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const sp = tw.spawn('anthem-speaker', 250, { interval: 600, first: 5 }) as AnthemSpeaker;
    tw.until(() => sp.mode === 'crackle', 50);
    const t0 = tw.world.tick;
    tw.until(() => sp.mode === 'idle', 400);
    tw.until(() => sp.mode === 'crackle', 700);
    expect(tw.world.tick - t0).toBe(600);
  });

  it('starts at once on a script command or when a player passes triggerX', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const sp = tw.spawn('anthem-speaker', 250, { auto: false }) as AnthemSpeaker;
    tw.run(1000);
    expect(sp.mode).toBe('idle');
    expect(playAnthem(sp)).toBe(true);
    expect(sp.mode).toBe('crackle');
    const tw2 = new TestWorld({ god: true, playerX: 100 });
    const sp2 = tw2.spawn('anthem-speaker', 300, { triggerX: 180 }) as AnthemSpeaker;
    tw2.run(20);
    expect(sp2.mode).toBe('idle');
    tw2.player!.placeAt(190, FLOOR, 0);
    tw2.run(2);
    expect(sp2.mode).toBe('crackle');
  });

  it('destroyed while playing: the saluting soldiers stay frozen 60 more ticks', () => {
    const { tw, sp, near } = anthemWorld();
    tw.until(() => sp.mode === 'play', 200);
    tw.run(20);
    sp.onHit(SHOT(100));
    expect(sp.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(500);
    tw.run(ANTHEM.linger - 5);
    for (const e of near) expect(e.reaction).toBe('salute');
    tw.run(10);
    for (const e of near) expect(e.reaction).toBeNull();
  });

  it('a soldier who walks into range during the anthem joins the salute', () => {
    const { tw, sp, far } = anthemWorld();
    tw.until(() => sp.mode === 'play', 200);
    expect(far.reaction).toBeNull();
    far.x = 420;
    tw.run(ANTHEM.recheck + 1);
    expect(far.reaction).toBe('salute');
  });
});

describe('drum-barricade', () => {
  it('is a solid 32×64 wall of 600 HP that blocks the player until destroyed (2,000 points)', () => {
    const tw = new TestWorld({ god: true, playerX: 200 });
    const b = tw.spawn('drum-barricade', 300) as DrumBarricade;
    expect(b.maxHp).toBe(DRUM_BARRICADE.hp);
    expect(b.hasTag('soft')).toBe(false);
    const solid = tw.world.solids.find((s) => s.owner === b);
    tw.hold('right').run(120);
    expect(solid).toBeDefined();
    expect(solid!.w).toBe(32);
    expect(solid!.h).toBe(64);
    expect(tw.player!.x).toBeLessThan(300 - 16);
    b.onHit(SHOT(300));
    expect(b.damageState).toBe(1);
    b.onHit(SHOT(300));
    expect(b.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(2000);
    expect(tw.world.solids.includes(solid!)).toBe(false);
    tw.run(80);
    expect(tw.player!.x).toBeGreaterThan(320);
  });
});

describe('fairness (GDD §4.11)', () => {
  it('machines out of view never shoot', () => {
    const tw = new TestWorld({ god: true, playerX: 100, width: 4000, build: (t) => t.solid(1500, 20, 300, 20) });
    tw.spawn('oompah-tank', 900, { facing: -1 });
    tw.spawn('gramophone-mortar', 1100);
    tw.spawn('pipe-battery', 1300);
    tw.spawn('metronome-turret', 1600, {}, 40);
    tw.spawn('metronome-turret', 1900, { floor: true });
    for (let i = 0; i < 600; i++) {
      tw.run(1);
      expect(enemyShots(tw).length).toBe(0);
    }
  });

  it('respects the attack-token limit (4 on NORMAL)', () => {
    const tw = new TestWorld({ god: true, playerX: 40 });
    const ms: Enemy[] = [];
    for (let i = 0; i < 6; i++) ms.push(tw.spawn('gramophone-mortar', 120 + i * 40) as Enemy);
    let most = 0;
    for (let i = 0; i < 400; i++) {
      tw.run(1);
      most = Math.max(most, ms.filter((m) => (m as GramophoneMortar).mode !== 'wait').length);
    }
    expect(most).toBeLessThanOrEqual(4);
    expect(most).toBeGreaterThan(0);
  });

  it('every machine telegraph is at least 18 ticks on HARD', () => {
    const tw = new TestWorld({ god: true, playerX: 60, difficulty: 'hard' });
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as OompahTank;
    expect(telegraphToShot(tw, () => tank.mode === 'shell', 'bell-shell')).toBeGreaterThanOrEqual(18);
    const tw2 = new TestWorld({ god: true, playerX: 60, difficulty: 'hard' });
    const m = tw2.spawn('metronome-turret', 250, { floor: true }) as MetronomeTurret;
    expect(telegraphToShot(tw2, () => m.glowing, 'metronome-bullet')).toBeGreaterThanOrEqual(18);
    const tw3 = new TestWorld({ god: true, playerX: 60, difficulty: 'hard' });
    const p = tw3.spawn('pipe-battery', 260) as PipeBattery;
    expect(telegraphToShot(tw3, () => p.glowPipe >= 0, 'note-rocket')).toBeGreaterThanOrEqual(18);
  });

  it('machines only take SAY CHEESE, never the anthem', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as Enemy;
    expect(tank.react('salute', 100)).toBe(false);
    expect(tank.react('photo', 30)).toBe(true);
  });
});

describe('edge cases (review)', () => {
  /** A test world with a second player (joined in the session, so co-op scaling applies). */
  function twoPlayers(o: TestWorldOptions = {}): { tw: TestWorld; p2: Player } {
    const tw = new TestWorld({ god: true, playerX: 60, ...o });
    tw.session.join(1, tw.session.slots[0].character);
    const p2 = new Player(tw.world, 320, FLOOR, { pad: new VirtualPad(), index: 1 });
    tw.world.add(p2);
    p2.placeAt(320, FLOOR, 0);
    tw.world.flush();
    return { tw, p2 };
  }

  it('2 players: machine HP ×1.25 and the tank turns to face the nearer player', () => {
    const { tw } = twoPlayers();
    const tank = tw.spawn('oompah-tank', 260, { facing: -1 }) as OompahTank;
    expect(tank.maxHp).toBe(Math.round(OOMPAH_TANK.hp * 1.25));
    expect((tw.spawn('drum-barricade', 600) as DrumBarricade).maxHp).toBe(Math.round(DRUM_BARRICADE.hp * 1.25));
    // P2 at 320 stands 60 px behind the tank's centre: it turns around in 40 ticks.
    tw.until(() => tank.facing === 1, 120);
    tw.run(600);
    expect(tw.world.errors).toEqual([]);
  });

  it('killed mid-telegraph: no shot follows and the attack token is given back', () => {
    const cases: [string, (e: Entity) => boolean, string, Record<string, unknown>, number?][] = [
      ['oompah-tank', (e) => (e as OompahTank).mode === 'shell', 'bell-shell', { facing: -1 }],
      ['gramophone-mortar', (e) => (e as GramophoneMortar).mode === 'aim', 'record', {}],
      ['metronome-turret', (e) => (e as MetronomeTurret).glowing, 'metronome-bullet', { floor: true }],
      ['pipe-battery', (e) => (e as PipeBattery).glowPipe >= 0, 'note-rocket', {}],
    ];
    for (const [id, telegraphing, shotId, params] of cases) {
      const tw = new TestWorld({ god: true, playerX: 60 });
      const m = tw.spawn(id, 260, params) as Enemy;
      tw.until(() => telegraphing(m), 600);
      expect(live(tw, shotId).length, id).toBe(0);
      // The pipe battery dies when all five pipes (parts 1–5) are gone.
      if (id === 'pipe-battery') for (let i = 1; i <= 5; i++) m.onHit(SHOT(10_000), i);
      else m.onHit(SHOT(10_000));
      expect(m.dead, id).toBe(true);
      tw.run(200);
      expect(live(tw, shotId).length, id).toBe(0);
      expect((m as unknown as { holdsToken: boolean }).holdsToken, id).toBe(false);
      expect(tw.world.errors, id).toEqual([]);
    }
  });

  it('the gramophone telegraph is at least 18 ticks on HARD (aim + scratch)', () => {
    const tw = new TestWorld({ god: true, playerX: 200, difficulty: 'hard' });
    const g = tw.spawn('gramophone-mortar', 300) as GramophoneMortar;
    expect(telegraphToShot(tw, () => g.mode === 'aim', 'record')).toBeGreaterThanOrEqual(18);
  });

  it('a tank on a slope keeps its treads on the ground and never leaves its floor', () => {
    const tw = new TestWorld({
      god: true,
      playerX: 60,
      noFloor: true,
      build: (t) => t.ground().at(0, FLOOR).flat(200).slope(160, -32).flat(1240),
    });
    const tank = tw.spawn('oompah-tank', 400, { facing: -1 }, FLOOR - 32) as OompahTank;
    for (let i = 0; i < 600; i++) {
      tw.run(1);
      const floor = tw.world.terrain.surfaceY(tank.x, tank.y - 16, tank.y + 16);
      expect(Number.isFinite(floor)).toBe(true);
    }
    expect(tw.world.errors).toEqual([]);
  });
});
