/**
 * Shared runtime additions for the mission wave (GDD §15.9 item 3, §10.0): campaign records,
 * music start index, body walls, the vertical respawn rule, drop-in hole exits, ice ranges,
 * boss timing over several boss sections, and the Boss hooks (conditional phases, broken-part
 * counts, speech, difficulty helpers, scripted death sequences).
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { Entity } from '../../src/engine/entity';
import { VirtualPad, buttonMask, type Button } from '../../src/engine/input';
import { SolidBox } from '../../src/engine/physics';
import type { ScriptGen } from '../../src/engine/script';
import { terrain } from '../../src/engine/terrain';
import type { World } from '../../src/engine/world';
import { Boss } from '../../src/game/boss';
import { iceAt } from '../../src/game/context';
import { MissionRunner, type MissionDef, type SectionDef } from '../../src/game/mission/index';
import { defineEntity, type SpawnParams } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, Rig } from './helpers';

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const idle = function* idleScript(): ScriptGen {
  yield () => false;
};

function flat(id: string, width = 1200, extra: Partial<SectionDef> = {}): SectionDef {
  const t = terrain(width, 216);
  t.ground().at(0, FLOOR).flat(width);
  return {
    id,
    width,
    height: 216,
    scroll: 'right',
    background: { sky: 0x203040ff, layers: [] },
    terrain: t.build(),
    terrainStyle: { ground: 'dirt' },
    playerStart: { x: 60, y: FLOOR },
    timeLimit: 0,
    script: idle,
    ...extra,
  };
}

function mission(sections: SectionDef[], extra: Partial<MissionDef> = {}): MissionDef {
  const map: Record<string, SectionDef> = {};
  for (const s of sections) map[s.id] = s;
  return { id: 'prep', name: 'PREP', music: 'stage-song', start: sections[0].id, sections: map, ...extra };
}

interface Harness {
  runner: MissionRunner;
  audio: NullAudio;
  run(n: number, ...held: Button[]): void;
  until(pred: () => boolean, max?: number): void;
}

function harness(def: MissionDef, session = new GameSession({ seed: 9 })): Harness {
  const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  const audio = new NullAudio();
  const runner = new MissionRunner({ session, mission: def, pads, audio, seed: 9 });
  runner.start();
  const run = (n: number, ...held: Button[]): void => {
    const mask = held.length ? buttonMask(...held) : 0;
    for (let i = 0; i < n; i++) {
      pads[0].update(mask);
      pads[1].update(0);
      runner.update();
    }
  };
  const until = (pred: () => boolean, max = 2000): void => {
    for (let i = 0; i < max && !pred(); i++) run(1);
    if (!pred()) throw new Error('condition not met');
  };
  return { runner, audio, run, until };
}

class Cart extends Vehicle {
  constructor(w: World, x: number, y: number, p: SpawnParams = {}) {
    super(w, x, y, p, { art: 'vehicle/prep-cart', seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20] });
  }
}
defineEntity('prep-cart', (w, x, y, p) => new Cart(w, x, y, p), { category: 'vehicle' });

// ---------------------------------------------------------------------------------------------
// Mission runtime
// ---------------------------------------------------------------------------------------------

describe('campaign records', () => {
  it('keep state across sections and missions of one game; a new game starts empty', () => {
    const lift: { variant: string; cells: number; shells: number }[] = [];
    const a = flat('a', 800, {
      script: function* writeRecord(ctx) {
        ctx.records.set('m3/lift', [{ variant: 'ivory', cells: 2, shells: 7 }]);
        yield ctx.exitTo('c');
      },
    });
    const c = flat('c', 800, {
      script: function* readRecord(ctx) {
        lift.push(...ctx.records.get('m3/lift', [] as typeof lift));
        yield () => false;
      },
    });
    const session = new GameSession({ seed: 9 });
    const h = harness(mission([a, c]), session);
    h.until(() => h.runner.section.id === 'c');
    h.run(2);
    expect(lift).toEqual([{ variant: 'ivory', cells: 2, shells: 7 }]);
    expect(h.runner.records).toBe(session.records);
    // The next mission of the same game still sees it.
    const h2 = harness(mission([flat('x')], { id: 'prep-2' }), session);
    expect(h2.runner.records.get('m3/lift')).toEqual(lift);
    // A new game: a new session, no records; missing keys give the fallback.
    const fresh = new GameSession();
    expect(fresh.records.has('m3/lift')).toBe(false);
    expect(fresh.records.get('m3/lift', 'none')).toBe('none');
    session.records.clear();
    expect(session.records.size).toBe(0);
  });
});

describe('music start index', () => {
  it('ctx.music and bossIntro pass `from`; resumeMusic keeps it', () => {
    const a = flat('a', 800, {
      script: function* songs(ctx) {
        ctx.music('m5-theme', 10, { from: 3 });
        yield 5;
        ctx.music('m5-theme', 10, { from: 1 }); // same song: keeps playing
        yield 5;
        yield ctx.bossIntro('ORGAN', { music: 'boss-final', musicFrom: 2 });
        yield () => false;
      },
    });
    const h = harness(mission([a]));
    h.run(30);
    expect(h.audio.log.filter((l) => l.startsWith('music:'))).toEqual(['music:stage-song', 'music:m5-theme@3', 'music:boss-final@2']);
    h.runner.resumeMusic();
    expect(h.audio.log[h.audio.log.length - 1]).toBe('music:boss-final@2');
  });
});

describe('body walls', () => {
  it('stop players on foot and vehicles (with the rider), never shots; filter, remove, section end', () => {
    const h = harness(mission([flat('a', 1200), flat('b', 1200)]));
    h.run(2);
    const r = h.runner;
    const p = r.players[0];
    const wall = r.addBodyWall(200);
    h.run(150, 'right');
    expect(p.x).toBeLessThanOrEqual(200 - p.body.w / 2 + 0.001);
    expect(p.x).toBeGreaterThan(180);
    // A Swan-only style wall (filter) lets the player pass.
    wall.remove();
    const touched: Entity[] = [];
    r.addBodyWall(320, { players: false, filter: (e) => e instanceof Cart, onTouch: (e) => touched.push(e) });
    h.run(120, 'right');
    expect(p.x).toBeGreaterThan(330);
    // A vehicle is clamped and carries its rider back with it.
    const cart = r.world.spawn('prep-cart', 300, FLOOR) as Cart;
    r.world.flush();
    p.placeAt(300, FLOOR, 0);
    cart.mount(p);
    h.run(150, 'right');
    expect(cart.x).toBeLessThanOrEqual(320);
    expect(touched.length).toBeGreaterThan(0);
    expect(Math.abs(p.x - cart.x)).toBeLessThan(2);
    expect(r.bodyWallBetween(cart, 300, 340)).not.toBeNull();
    expect(r.bodyWallBetween(p, 300, 340)).toBeNull(); // the filter only takes carts
    r.exitTo('b');
    h.until(() => r.section.id === 'b');
    expect(r.bodyWalls.length).toBe(0);
  });
});

describe('vertical respawn rule (GDD §11.0)', () => {
  function shaft(): SectionDef {
    const t = terrain(384, 900);
    t.ground().at(0, 880).flat(384);
    t.platform(40, 820, 100);
    t.platform(220, 770, 120);
    return { ...flat('up'), width: 384, height: 900, scroll: 'up', terrain: t.build(), playerStart: { x: 280, y: 770 } };
  }

  it('without a moving platform: the lowest free floor in view', () => {
    const h = harness(mission([shaft()]));
    h.run(30);
    const p = h.runner.players[0];
    expect(p.y).toBe(770);
    // View 608..824: the ground (880) is below it; the lowest floor in view is the platform at 820.
    p.kill('bullet');
    h.until(() => p.state === 'play', 400);
    expect(p.y).toBe(820);
    expect(p.x).toBeLessThanOrEqual(140);
  });

  it('a moving platform in view wins (its position is predicted for the landing)', () => {
    const h = harness(mission([shaft()]));
    h.run(30);
    const w = h.runner.world;
    const lift = w.addSolid(new SolidBox(100, 760, 48, 8, true));
    w.scripts.run(
      (function* rise(): ScriptGen {
        for (;;) {
          w.moveSolid(lift, 0, -0.25);
          yield 1;
        }
      })(),
    );
    const p = h.runner.players[0];
    p.kill('bullet');
    h.until(() => p.state === 'play', 400);
    expect(p.x).toBeGreaterThanOrEqual(100);
    expect(p.x).toBeLessThanOrEqual(148);
    expect(Math.abs(p.y - lift.y)).toBeLessThanOrEqual(1);
  });
});

describe('y checkpoints in vertical sections', () => {
  function tower(scroll: 'up' | 'down'): SectionDef {
    const t = terrain(384, 900);
    t.ground().at(0, 880).flat(384);
    for (let y = 820; y > 60; y -= 60) t.platform(y % 120 === 100 ? 40 : 200, y, 140);
    const start = scroll === 'up' ? { x: 192, y: 880 } : { x: 260, y: 160 };
    return { ...flat(scroll), width: 384, height: 900, scroll, terrain: t.build(), playerStart: start, checkpoints: [scroll === 'up' ? 500 : 400], timeLimit: 30 };
  }

  for (const dir of ['up', 'down'] as const) {
    it(`'${dir}': passing the camera-centre y sets the checkpoint, refills the timer and calls it out`, () => {
      const h = harness(mission([tower(dir)]));
      h.run(2);
      const r = h.runner;
      const cps: { x: number; y: number }[] = [];
      r.world.events.on('checkpoint', (c) => cps.push({ x: c.x, y: c.y }));
      const p = r.players[0];
      p.invulnTicks = 5000;
      // Carry the player towards the far end; the camera follows (never back).
      const target = dir === 'up' ? 300 : 700;
      let y = p.y;
      for (let i = 0; i < 400 && cps.length === 0; i++) {
        y = dir === 'up' ? Math.max(target, y - 2) : Math.min(target, y + 2);
        p.placeAt(192, y, 0);
        p.vy = 0;
        h.run(1);
      }
      expect(cps.length).toBe(1);
      const cy = r.world.camera.centerY;
      expect(dir === 'up' ? cy <= 500 : cy >= 400).toBe(true);
      expect(h.audio.log).toContain('sfx:mission/checkpoint');
      expect(r.checkpoint.y).toBeGreaterThan(0);
    });
  }
});

describe('exits as drop-in holes, ice ranges', () => {
  it('falling into a hole takes the exit; the next section starts at its entry', () => {
    const t = terrain(800, 216);
    t.ground().at(0, FLOOR).flat(300);
    t.ground().at(340, FLOOR).flat(460);
    const a: SectionDef = {
      ...flat('a', 800),
      terrain: t.build(),
      exits: [{ rect: { x: 300, y: FLOOR + 10, w: 40, h: 30 }, to: 'b', entry: { x: 100, y: 40 } }],
    };
    const b = flat('b', 800, { iceRanges: [[200, 400]] });
    const h = harness(mission([a, b]));
    for (let i = 0; i < 600 && h.runner.section.id !== 'b'; i++) h.run(1, 'right');
    expect(h.runner.section.id).toBe('b');
    h.run(1);
    expect(h.runner.players[0].x).toBeCloseTo(100, 0);
    expect(iceAt(h.runner.world, 300)).toBe(true);
    expect(iceAt(h.runner.world, 100)).toBe(false);
  });
});

describe('boss speed timing over several boss sections', () => {
  it('adds up the fights and skips the walk between them', () => {
    const def = mission([flat('a'), flat('b'), flat('c')], { bossSection: 'c', bossSections: ['a', 'c'] });
    const h = harness(def);
    const r = h.runner;
    const fake = new (class extends Entity {})(r.world, 0, 0);
    h.run(1);
    r.world.events.emit('bossPhase', { boss: fake, phase: 0 });
    h.run(100);
    r.world.events.emit('bossDefeated', { boss: fake, player: 0 });
    r.exitTo('b');
    h.until(() => r.section.id === 'b');
    r.world.events.emit('bossPhase', { boss: fake, phase: 0 }); // a mid-boss: not counted
    h.run(200);
    r.world.events.emit('bossDefeated', { boss: fake, player: 0 });
    r.exitTo('c');
    h.until(() => r.section.id === 'c');
    r.world.events.emit('bossPhase', { boss: fake, phase: 0 });
    h.run(50);
    r.world.events.emit('bossDefeated', { boss: fake, player: 0 });
    const st = r.session.slots[0].mission;
    expect(st.bossEndTick - st.bossStartTick).toBe(150);
  });
});

// ---------------------------------------------------------------------------------------------
// Boss hooks
// ---------------------------------------------------------------------------------------------

class Kit extends Boss {
  readonly log: string[] = [];
  scripted = false;
  constructor(w: World, x: number, y: number, p: SpawnParams = {}) {
    super(w, x, y, p, { art: 'boss/prep-kit', name: 'PREP KIT', hp: 1 });
    this.addPart('tom-a', { box: { x: -60, y: -40, w: 20, h: 20 }, hp: 100 });
    this.addPart('tom-b', { box: { x: -30, y: -40, w: 20, h: 20 }, hp: 100 });
    this.addPart('tom-c', { box: { x: 0, y: -40, w: 20, h: 20 }, hp: 100 });
    this.addPart('core', { box: { x: 30, y: -60, w: 40, h: 60 }, hp: 400, required: true });
    this.phases = [
      { at: 1, name: 'warm-up' },
      { when: (b) => b.brokenCount(['tom-a', 'tom-b', 'tom-c']) >= 2, name: 'solo', onEnter: (b) => b.log.push('solo') },
      { at: 0.5, name: 'finish', onEnter: (b) => b.log.push('finish') },
    ];
    this.scripted = p.scripted === true;
  }
  protected override deathSequence(): ScriptGen | null {
    if (!this.scripted) return null;
    const self = this;
    return (function* fill(): ScriptGen {
      self.log.push('fill');
      yield 30;
      self.log.push('dust');
    })();
  }
}
defineEntity('prep-kit', (w, x, y, p) => new Kit(w, x, y, p), { category: 'boss' });

const shot = (amount: number) => ({ amount, kind: 'bullet' as const, dirX: 1, owner: 0 });

describe('boss hooks', () => {
  it('phases start on a condition (2 of 3 parts) as well as on an HP fraction', () => {
    const rig = new Rig();
    const b = rig.world.spawn('prep-kit', 300, FLOOR) as Kit;
    rig.world.flush();
    rig.run(2);
    expect(b.state).toBe('fight');
    expect(b.phase).toBe(0);
    rig.world.damage(b, shot(500), 0);
    expect(b.brokenCount()).toBe(1);
    expect((rig.world.audio as NullAudio).log).toContain('sfx:boss/part-break');
    expect(b.phase).toBe(0);
    rig.world.damage(b, shot(500), 2);
    expect(b.brokenCount(['tom-a', 'tom-b', 'tom-c'])).toBe(2);
    expect(b.partAlive('tom-b')).toBe(true);
    expect(b.partAlive('tom-a')).toBe(false);
    expect(b.phase).toBe(1);
    rig.world.damage(b, shot(250), 3); // core 400 → 150 (< 50 %)
    expect(b.phase).toBe(2);
    expect(b.log).toEqual(['solo', 'finish']);
  });

  it('say() puts a bubble at the speaker point; difficulty helpers', () => {
    const rig = new Rig();
    const b = rig.world.spawn('prep-kit', 300, FLOOR) as Kit;
    rig.world.flush();
    b.facing = -1;
    b.say('THAT WAS ONLY THE FIRST ACT!', { at: [20, -70], ticks: 90 });
    expect(rig.hud.bubbles.length).toBe(1);
    const bubble = rig.hud.bubbles[0];
    expect(bubble.target.x).toBe(280); // mirrored
    expect(bubble.target.y).toBe(FLOOR - 70);
    b.x += 10;
    expect(bubble.target.x).toBe(290); // follows the boss
    b.hush();
    expect(rig.hud.bubbles.length).toBe(0);
    expect(b.volleySize(3)).toBe(3);
    expect(b.telegraphFor(10)).toBeGreaterThanOrEqual(18);
    rig.session.difficulty = 'hard';
    expect(b.volleySize(3)).toBe(4);
    expect(b.recoveryFor(40)).toBeGreaterThan(0);
  });

  it('a scripted death sequence replaces the explosion chain; bossDefeated comes after it', () => {
    const rig = new Rig();
    const b = rig.world.spawn('prep-kit', 300, FLOOR, { scripted: true }) as Kit;
    rig.world.flush();
    let defeated = -1;
    rig.world.events.on('bossDefeated', () => (defeated = rig.world.tick));
    rig.run(2);
    const t0 = rig.world.tick;
    rig.world.damage(b, shot(1000), 3);
    expect(b.state).toBe('dying');
    rig.run(20);
    expect(defeated).toBe(-1);
    rig.run(20);
    expect(b.log).toEqual(['fill', 'dust']);
    expect(defeated).toBeGreaterThanOrEqual(t0 + 28);
    expect(defeated).toBeLessThan(t0 + 34);
    expect(b.defeated).toBe(true);
    expect(b.removed).toBe(true);
  });
});

