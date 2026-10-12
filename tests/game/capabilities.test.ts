/**
 * Shared hooks added for the content agents (fixer round): enemy reactions, section respawn
 * rules and start vehicles, the boss part model, status-effect physics / art / input hooks,
 * erasable enemy shots, damage weapon ids and tags, auto-scroll and vertical checkpoints, ice,
 * settings and flashes, HUD bubbles / callouts / pop-ups, score extends and difficulty rules,
 * water floating, looping sounds — plus the browser-review fixes that are pure game logic
 * (shots leave from this tick's legs pose, ground blasts rise from the floor).
 */
import { describe, expect, it } from 'vitest';
import { NullAudio, type AudioOut, type SfxOpts } from '../../src/engine/audio';
import type { Damage } from '../../src/engine/entity';
import { Body } from '../../src/engine/physics';
import type { ScriptGen } from '../../src/engine/script';
import { terrain } from '../../src/engine/terrain';
import { VirtualPad, buttonMask } from '../../src/engine/input';
import type { World } from '../../src/engine/world';
import { Boss } from '../../src/game/boss';
import { flash, settingsOf, attachGame, HudState } from '../../src/game/context';
import { Enemy, reactInArea, telegraphTicks, type ReactionKind } from '../../src/game/enemy';
import { explosion, FxEntity } from '../../src/game/fx';
import { MissionRunner, type MissionDef, type SectionDef } from '../../src/game/mission/index';
import { Projectile, eraseEnemyShots } from '../../src/game/projectile';
import { defineEntity, defineStatus, getStatus, type SpawnParams } from '../../src/game/registry';
import { DIFFICULTY, GameSession, MAX_LIVES } from '../../src/game/session';
import { DEFAULT_SETTINGS } from '../../src/game/settings';
import { TUNING } from '../../src/game/tuning';
import { Vehicle } from '../../src/game/vehicle';
import { floatOnWater, waterSurfaceAt } from '../../src/game/water';
import { FLOOR, Rig } from './helpers';

// ---------------------------------------------------------------------------------------------
// Test entities
// ---------------------------------------------------------------------------------------------

class Soldier extends Enemy {
  thinks = 0;
  readonly reactions: ReactionKind[] = [];
  constructor(w: World, x: number, y: number, p: SpawnParams = {}) {
    super(w, x, y, p, { art: 'enemy/test-soldier', hp: 10 });
    if (p.legion !== false) this.addTag('legion');
  }
  protected override think(): void {
    this.thinks++;
  }
  protected override onReact(kind: ReactionKind): void {
    this.reactions.push(kind);
  }
}
defineEntity('cap-soldier', (w, x, y, p) => new Soldier(w, x, y, p), { category: 'enemy' });

class Parted extends Boss {
  readonly order: string[] = [];
  constructor(w: World, x: number, y: number, p: SpawnParams = {}) {
    super(w, x, y, p, { art: 'boss/test-parted', name: 'PARTED', hp: 999 });
    this.addPart('hull', { box: { x: -40, y: -40, w: 80, h: 40 }, armored: false, contact: true });
    this.addPart('horn', { box: { x: 30, y: -60, w: 12, h: 12 }, hp: 100, required: true, knifeable: true });
    this.addPart('wheel', { box: { x: -50, y: -30, w: 10, h: 30 }, hp: 300, required: true });
    this.addPart('flag', { box: { x: -10, y: -70, w: 8, h: 10 }, hp: 50 });
    this.phases = [{ at: 1, pattern: (b) => b.sequence([(x) => x.step('a'), (x) => x.step('b'), (x) => x.step('c')], 1) }];
  }
  *step(name: string): ScriptGen {
    this.order.push(name);
    yield 1;
  }
}
defineEntity('cap-parted', (w, x, y, p) => new Parted(w, x, y, p), { category: 'boss' });

class Flyer extends Vehicle {
  constructor(w: World, x: number, y: number, p: SpawnParams = {}) {
    super(w, x, y, p, { art: 'vehicle/test-flyer', w: 28, h: 14, seat: { x: -10, y: -24, w: 20, h: 12 }, seatPoint: [0, -14], pilotDiesWithVehicle: true });
  }
}
defineEntity('cap-flyer', (w, x, y, p) => new Flyer(w, x, y, p), { category: 'vehicle' });

const hit = (amount: number, part = 0, kind: Damage['kind'] = 'bullet'): [Damage, number] => [{ amount, kind, dirX: 1, owner: 0 }, part];

// ---------------------------------------------------------------------------------------------

describe('enemy reactions', () => {
  it('Legion soldiers salute (no thinking = no attacks) and recover; damage still applies', () => {
    const rig = new Rig();
    const s = rig.world.spawn('cap-soldier', 200, FLOOR, { hp: 50 }) as Soldier;
    rig.world.flush();
    rig.run(2);
    const before = s.thinks;
    expect(reactInArea(rig.world, { x: 200, y: FLOOR - 10, r: 60 }, 'salute', 30)).toBe(1);
    expect(s.reacting).toBe(true);
    rig.run(10);
    expect(s.thinks).toBe(before);
    rig.world.damage(s, { amount: 5, kind: 'bullet', dirX: 1 });
    expect(s.hp).toBe(5 * 10 - 5);
    rig.run(25);
    expect(s.reacting).toBe(false);
    expect(s.thinks).toBeGreaterThan(before);
    expect(s.reactions).toEqual(['salute']);
  });

  it('every enemy accepts the SAY CHEESE photo pose; only opted-in ones dance', () => {
    const rig = new Rig();
    const plain = rig.world.spawn('cap-soldier', 200, FLOOR, { legion: false }) as Soldier;
    rig.world.flush();
    expect(plain.react('salute', 30)).toBe(false);
    expect(plain.react('dance', 30)).toBe(false);
    expect(plain.react('photo', 45)).toBe(true);
    expect(reactInArea(rig.world, rig.world.camera.view(), 'photo', 45, { onScreen: true })).toBe(1);
  });

  it('telegraphs scale with the difficulty and never drop below 18 ticks', () => {
    const rig = new Rig();
    rig.session.difficulty = 'hard';
    expect(telegraphTicks(rig.world, 18)).toBe(18);
    expect(telegraphTicks(rig.world, 40)).toBe(36);
    rig.session.difficulty = 'easy';
    expect(telegraphTicks(rig.world, 40)).toBe(50);
  });
});

describe('boss part model', () => {
  function fight(): { rig: Rig; boss: Parted } {
    const rig = new Rig();
    const boss = rig.world.spawn('cap-parted', 300, FLOOR) as Parted;
    rig.world.flush();
    rig.run(2);
    return { rig, boss };
  }

  it('HP and the bar follow the required parts; a hit never takes more than a part had', () => {
    const { rig, boss } = fight();
    expect(boss.usesRequiredParts).toBe(true);
    expect(boss.maxHp).toBe(400);
    rig.world.damage(boss, ...hit(1000, 1)); // overkill on the horn
    expect(boss.part('horn')?.destroyed).toBe(true);
    expect(boss.hp).toBe(300);
    expect(boss.healthFrac).toBeCloseTo(0.75, 5);
    rig.world.damage(boss, ...hit(50, 0)); // the hull has no HP: it only pings
    expect(boss.hp).toBe(300);
    rig.world.damage(boss, ...hit(25, 3)); // an optional part: its own pool only
    expect(boss.hp).toBe(300);
    expect(boss.dead).toBe(false);
    rig.world.damage(boss, ...hit(300, 2));
    expect(boss.dead).toBe(true); // every required part is gone
  });

  it('patterns run in a fixed order with sequence()', () => {
    const { rig, boss } = fight();
    rig.run(12);
    expect(boss.order.slice(0, 4)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('contact damage only from parts flagged contact; the knife only on knifeable parts', () => {
    const { boss } = fight();
    const contact = boss.contactBoxes();
    expect(contact.length).toBe(1);
    expect(contact[0].w).toBe(80);
    expect(boss.hasTag('soft')).toBe(true);
    expect(boss.isKnifeable(0)).toBe(false);
    expect(boss.isKnifeable(1)).toBe(true);
  });

  it('an intermission makes everyone invulnerable and erases the enemy shots on screen', () => {
    const { rig, boss } = fight();
    const shot = Projectile.spawn(rig.world, { team: 'enemy', x: 200, y: FLOOR - 20, vx: -1, vy: 0, damage: 10 });
    rig.world.flush();
    expect(boss.intermission(60)).toBe(60);
    expect(shot.removed).toBe(true);
    expect(rig.p.invulnTicks).toBeGreaterThanOrEqual(60);
    expect(rig.world.damage(boss, ...hit(100, 1))).toBe(true);
    expect(boss.part('horn')?.hp).toBe(100); // absorbed
  });
});

describe('status effects', () => {
  it('registry, float physics while jump is held, no control, sound pitch', () => {
    defineStatus({ id: 'cap-helium', ticks: 600, jump: 4.5 / 3.5, fallGravity: 0.05, maxFall: 1, sfxPitch: 1.6, noMount: true });
    const def = getStatus('cap-helium');
    expect(def).toBeDefined();
    const rig = new Rig();
    const pitches: number[] = [];
    const audio: AudioOut = Object.assign(new NullAudio(), {
      sfx(id: string, o?: SfxOpts): void {
        if (id === 'player/jump') pitches.push(o?.pitch ?? 1);
      },
    });
    rig.world.audio = audio;
    rig.p.status.add(def!);
    rig.hold(['jump']).run(1);
    expect(pitches).toEqual([1.6]);
    rig.run(40); // up and past the apex, still holding jump
    rig.until(() => rig.p.vy > 0, 60);
    rig.run(10);
    expect(rig.p.vy).toBeLessThanOrEqual(1.0001);
    expect(rig.p.body.gravity).toBeCloseTo(0.05, 5);
    rig.release().run(1);
    expect(rig.p.body.gravity).toBeCloseTo(TUNING.physics.gravity, 5);

    const rig2 = new Rig();
    rig2.p.status.add({ id: 'cap-dizzy', ticks: 30, noControl: true });
    const x0 = rig2.p.x;
    rig2.hold(['right']).run(20);
    expect(rig2.p.x).toBeCloseTo(x0, 5);
    rig2.run(20);
    expect(rig2.p.x).toBeGreaterThan(x0 + 10);
  });

  it('extra drawing hooks run while the effect lasts', () => {
    const rig = new Rig();
    let drawn = 0;
    rig.p.status.add({ id: 'cap-balloon', ticks: 100, onDraw: () => drawn++ });
    rig.p.draw({ sprite() {}, frame() {}, image() {}, rect() {}, line() {}, text() {}, parallax() {}, fade() {}, begin() {}, end() {}, setCamera() {}, w: 384, h: 216, camX: 0, camY: 0 });
    expect(drawn).toBe(1);
  });
});

describe('erasable enemy shots and shot-down scores', () => {
  it('enemy shots are erasable by default; beams opt out; shooting one down pays its score', () => {
    const rig = new Rig();
    const bullet = Projectile.spawn(rig.world, { team: 'enemy', x: 150, y: FLOOR - 20, vx: -1, vy: 0, damage: 10 });
    const beam = Projectile.spawn(rig.world, { team: 'enemy', x: 160, y: FLOOR - 20, vx: -1, vy: 0, damage: 10, erasable: false });
    const rocket = Projectile.spawn(rig.world, { team: 'enemy', x: 400, y: FLOOR - 20, vx: 0, vy: 0, damage: 10, shootable: true, hp: 10, score: 50 });
    rig.world.flush();
    expect(bullet.hasTag('erasable')).toBe(true);
    expect(eraseEnemyShots(rig.world, { x: 155, y: FLOOR - 20, r: 30 })).toBe(1);
    expect(bullet.removed).toBe(true);
    expect(beam.removed).toBe(false);
    rig.world.damage(rocket, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(rig.session.slots[0].score).toBe(50);
  });

  it('a respawn landing erases enemy shots within 64 px (POOF)', () => {
    const rig = new Rig();
    rig.p.kill('bullet');
    rig.until(() => rig.p.state === 'spawn', 200);
    const near = Projectile.spawn(rig.world, { team: 'enemy', x: rig.p.x + 30, y: FLOOR - 15, vx: 0, vy: 0, damage: 10, life: 999 });
    rig.world.flush();
    rig.until(() => rig.p.state === 'play', 120);
    rig.run(1);
    expect(near.removed).toBe(true);
  });

  it('player shots carry their weapon id', () => {
    const rig = new Rig();
    let weapon = '';
    rig.world.events.on('hit', (e) => (weapon = e.damage.weapon ?? ''));
    rig.dummy(160, { hp: 100 });
    rig.tap(['fire']).run(10);
    expect(weapon).toBe('pistol');
  });
});

describe('players: legs before arms, ice, extends, difficulty', () => {
  it('crouch + fire on the same tick: the shot leaves from the crouched muzzle', () => {
    const rig = new Rig();
    rig.run(3);
    const ys: number[] = [];
    rig.world.events.on('spawn', (e) => {
      if (e.type === 'pistol') ys.push(e.y);
    });
    rig.hold(['down', 'fire']).run(1);
    rig.release().run(1);
    expect(ys.length).toBe(1);
    expect(ys[0]).toBeGreaterThan(FLOOR - 18); // crouch height (standing shots leave ~23 px up)
  });

  it('ice: slow to stop', () => {
    const rig = new Rig();
    // Put the whole floor in ice (the runner does this from SectionDef.iceRanges).
    attachGame(rig.world, rig.session, rig.hud).ice = [[0, 3000]];
    rig.hold(['right']).run(30);
    rig.release().run(4);
    expect(rig.p.vx).toBeGreaterThan(1);
  });

  it('score extends at 500,000 and 1,500,000 with a 9-in-reserve cap', () => {
    const rig = new Rig();
    const s = rig.session.slots[0];
    const lives = s.lives;
    rig.p.addScore(600000);
    expect(s.lives).toBe(lives + 1);
    expect(rig.hud.callouts.some((c) => c.text === 'ONE MORE TRY!')).toBe(true);
    s.lives = MAX_LIVES;
    rig.p.addScore(1000000);
    expect(s.lives).toBe(MAX_LIVES);
  });

  it('EASY: 5 lives and 15 grenades per life', () => {
    const session = new GameSession({ difficulty: 'easy' });
    expect(session.slots[0].lives).toBe(5);
    expect(session.slots[0].bombs).toBe(15);
    expect(DIFFICULTY.hard.tokens).toBe(6);
  });

  it('the same weapon again: "MORE <NAME>!"', () => {
    const rig = new Rig();
    const audio = new NullAudio();
    rig.world.audio = audio;
    rig.p.giveWeapon('machine-gun');
    rig.p.giveWeapon('machine-gun');
    expect(audio.log).toContain('voice:MORE MACHINE GUN!');
  });
});

describe('fx', () => {
  it('a blast on the ground rises from it (the fireball is drawn above the floor)', () => {
    const rig = new Rig();
    const fx: FxEntity = explosion(rig.world, 200, FLOOR, 'm');
    expect(fx.y).toBeLessThan(FLOOR - 8);
    const air = explosion(rig.world, 200, FLOOR - 80, 'm');
    expect(air.y).toBe(FLOOR - 80);
  });
});

describe('settings, flashes, HUD requests', () => {
  it('settings are reachable from a world; REDUCE FLASHES caps a flash at 30 %', () => {
    const rig = new Rig();
    expect(settingsOf(rig.world).speechBubbles).toBe(true);
    flash(rig.world, 0xffffffff, 1, 10);
    expect(rig.hud.flash?.alpha).toBe(1);
    const hud = new HudState();
    const g = attachGame(rig.world, rig.session, hud, { ...DEFAULT_SETTINGS, reduceFlashes: true });
    flash(rig.world, 0xffffffff, 1, 10);
    expect(g.hud.flash?.alpha).toBeCloseTo(0.3, 5);
  });

  it('bubbles follow a speaker (one per speaker), callouts stack, both expire', () => {
    const hud = new HudState();
    const speaker = { x: 10, y: 20 };
    hud.bubble(speaker, 'MMF!', { ticks: 3 });
    hud.bubble(speaker, 'HELP!', { ticks: 3 });
    expect(hud.bubbles.length).toBe(1);
    expect(hud.bubbles[0].text).toBe('HELP!');
    hud.callout('CHECKPOINT', { ticks: 2 });
    hud.callout('SET PIECE! +200', { ticks: 5 });
    for (let i = 0; i < 3; i++) hud.update();
    expect(hud.bubbles.length).toBe(0);
    expect(hud.callouts.map((c) => c.text)).toEqual(['SET PIECE! +200']);
  });
});

describe('water', () => {
  it('floatOnWater keeps a body at its draft on the surface', () => {
    const rig = new Rig({
      noFloor: true,
      build: (t) => {
        t.ground().at(0, FLOOR + 40).flat(3000);
        t.hazard('water', 0, FLOOR, 3000, 60);
      },
    });
    const boat = rig.dummy(300, { hp: 100 });
    boat.body = new Body({ w: 20, h: 10 });
    boat.y = FLOOR - 20;
    for (let i = 0; i < 40; i++) {
      boat.vy = Math.min(4, boat.vy + 0.13);
      boat.y += boat.vy;
      floatOnWater(boat, 6);
    }
    expect(waterSurfaceAt(boat, 300)).toBe(FLOOR);
    expect(boat.y).toBe(FLOOR + 6);
  });
});

// ---------------------------------------------------------------------------------------------
// Mission runtime: respawn rules, start vehicles, auto-scroll, vertical checkpoints
// ---------------------------------------------------------------------------------------------

function section(id: string, extra: Partial<SectionDef>, w = 1600, h = 216): SectionDef {
  const t = terrain(w, h);
  t.ground().at(0, FLOOR).flat(w);
  return {
    id,
    width: w,
    height: h,
    scroll: 'right',
    background: { sky: 0x203040ff, layers: [] },
    terrain: t.build(),
    terrainStyle: { ground: 'dirt' },
    playerStart: { x: 60, y: FLOOR },
    script: function* idle() {
      yield () => false;
    },
    ...extra,
  };
}

function runnerFor(def: SectionDef): { runner: MissionRunner; run: (n: number, mask?: number) => void } {
  const mission: MissionDef = { id: `cap-${def.id}`, name: 'CAP', music: '', start: def.id, sections: { [def.id]: def } };
  const session = new GameSession({ seed: 5 });
  const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  const runner = new MissionRunner({ session, mission, pads, audio: new NullAudio(), seed: 5 });
  runner.start();
  const run = (n: number, mask = 0): void => {
    for (let i = 0; i < n; i++) {
      pads[0].update(mask);
      pads[1].update(0);
      runner.update();
    }
  };
  return { runner, run };
}

describe('mission runtime hooks', () => {
  it('a section respawn rule picks the drop-in spot', () => {
    const { runner, run } = runnerFor(section('r', { respawn: () => ({ x: 300, y: FLOOR }) }));
    run(2);
    const p = runner.players[0];
    p.kill('bullet');
    for (let i = 0; i < 300 && p.state !== 'play'; i++) run(1);
    expect(p.state).toBe('play');
    expect(p.x).toBe(300);
  });

  it('startVehicle: players start mounted and get a new one after a respawn; flyers take the pilot down', () => {
    const { runner, run } = runnerFor(section('v', { startVehicle: 'cap-flyer', respawn: () => ({ x: 200, y: FLOOR }) }));
    run(2);
    const p = runner.players[0];
    expect(p.state).toBe('mounted');
    const v = p.vehicle as Flyer;
    v.invulnTicks = 0;
    v.cells = 0.5;
    runner.world.damage(v, { amount: 10, kind: 'bullet', dirX: 1 });
    expect(p.state).toBe('dead');
    for (let i = 0; i < 300 && p.state !== 'mounted'; i++) run(1);
    expect(p.state).toBe('mounted');
    expect(p.vehicle).not.toBe(v);
  });

  it('autoScroll moves the view exactly; a camera lock stops it', () => {
    const { runner, run } = runnerFor(section('a', {}, 3000));
    run(2);
    const cam = runner.world.camera;
    const x0 = cam.x;
    runner.autoScroll(1);
    run(120);
    expect(cam.x).toBeCloseTo(x0 + 120, 0);
    expect(runner.players[0].x).toBeGreaterThanOrEqual(cam.x + 6);
    runner.stopAutoScroll();
    expect(runner.autoScrolling).toBe(false);
  });

  it("'up' sections: checkpoints are camera-centre y values", () => {
    const t = terrain(384, 900);
    t.ground().at(0, 880).flat(384);
    for (let y = 820; y > 100; y -= 40) t.platform(y % 80 === 20 ? 60 : 200, y, 120);
    const def: SectionDef = {
      ...section('up', {}),
      width: 384,
      height: 900,
      scroll: 'up',
      terrain: t.build(),
      playerStart: { x: 120, y: 880 },
      checkpoints: [600],
      timeLimit: 0,
    };
    const { runner, run } = runnerFor(def);
    run(2);
    const points: number[] = [];
    runner.world.events.on('checkpoint', (e) => points.push(e.y));
    // Teleport the player up the shaft: the camera follows it upward.
    const p = runner.players[0];
    p.placeAt(120, 300, 0);
    run(200, buttonMask());
    expect(points.length).toBe(1);
  });
});
