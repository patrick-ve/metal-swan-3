/**
 * SWAN-3 "Metal Swan", the ridden mount (GDD §8.2; docs/design/swan-mount/feel.md). Every number
 * is the feel.md value; [engine] values come from the engine step (vy += g, then y += vy) and are
 * 3–4 % under the formulas. The art is drawn in parallel: missing frames use the logic fallbacks.
 */
import { describe, expect, it, vi } from 'vitest';
import type { NullAudio } from '../../src/engine/audio';
import type { Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import { buttonMask, VirtualPad } from '../../src/engine/input';
import { Terrain, terrain, type TerrainBuilder } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import '../../src/game/content/characters/index';
import { HonkRing, isSwan, SWAN, Swan } from '../../src/game/content/vehicles/swan/index';
import '../../src/game/content/weapons/index';
import { attachGame, gameOf, HudState } from '../../src/game/context';
import { Enemy } from '../../src/game/enemy';
import { Player } from '../../src/game/player/player';
import { Projectile } from '../../src/game/projectile';
import { defineEntity, gameEntityFactory, getWeapon, type SpawnParams } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { applyTuning, TUNING } from '../../src/game/tuning';

applyTuning();

const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[art]')) return;
  warn(...args);
});

const FLOOR = 176;
/** m1-c river: the surface at y 180, her float line at 196, the bed at 216. */
const SURFACE = 180;
const FLOAT = SURFACE + SWAN.swimDepth;
const RIVER_X = 600;

/** A Legion soldier stand-in: soft, 30 HP, answers the reactions (HONK ears). */
class Soldier extends Enemy {
  readonly hits: { amount: number; kind: string }[] = [];
  constructor(world: World, x: number, y: number, params: SpawnParams = {}) {
    super(world, x, y, params, { art: 'enemy/test-soldier', hp: 30, w: 14, h: 28, soft: params.soft !== false });
    this.addTag('legion');
  }
  override onHit(d: Parameters<Enemy['onHit']>[0], part = 0): boolean {
    this.hits.push({ amount: d.amount, kind: d.kind });
    return super.onHit(d, part);
  }
}
defineEntity('swan-test-soldier', (w, x, y, p) => new Soldier(w, x, y, p), { category: 'enemy' });

interface RigOpts {
  /** Deep river from x 600 (bank at y 176, surface 180, bed 216). */
  river?: boolean;
  build?: (t: TerrainBuilder) => void;
  players?: 1 | 2;
  /** Swan start x, y (default 200 on the floor; in the river: the float line). */
  x?: number;
  y?: number;
  /** Mount player 1 and wait for the 12-tick rise (default true). */
  mount?: boolean;
  params?: SpawnParams;
}

class SwanRig {
  readonly world: World;
  readonly hud = new HudState();
  readonly pads = [new VirtualPad(), new VirtualPad()];
  readonly masks = [0, 0];
  readonly players: Player[] = [];
  readonly swan: Swan;

  constructor(o: RigOpts = {}) {
    const t = terrain(4000, 216);
    if (o.river) {
      t.ground().at(0, FLOOR).flat(RIVER_X).step(216 - FLOOR).flat(4000 - RIVER_X);
      t.hazard('water', RIVER_X, SURFACE, 4000 - RIVER_X, 216 - SURFACE);
    } else t.ground().at(0, FLOOR).flat(4000);
    o.build?.(t);
    this.world = new World({ terrain: new Terrain(t.build()), seed: 5, factory: gameEntityFactory });
    const session = new GameSession({ characters: ['recruit', 'recruit'], seed: 5 });
    attachGame(this.world, session, this.hud);
    const x = o.x ?? 200;
    for (let i = 0; i < (o.players ?? 1); i++) {
      // Players start on dry land (in a river rig: on the bank).
      const px = o.river ? Math.min(x, RIVER_X) - 60 - 30 * i : x - 60 - 30 * i;
      const p = new Player(this.world, px, FLOOR, { pad: this.pads[i], index: i as 0 | 1 });
      this.world.add(p);
      p.placeAt(px, FLOOR, 0);
      this.players.push(p);
    }
    const y = o.y ?? (o.river && x >= RIVER_X ? FLOAT : FLOOR);
    this.swan = this.world.spawn('swan', x, y, o.params ?? {}) as Swan;
    this.world.flush();
    this.world.camera.follow(this.world.players);
    this.world.camera.snap();
    this.run(1);
    if (o.mount !== false) {
      this.swan.mount(this.p);
      this.run(SWAN.riseTicks);
    }
  }

  get p(): Player {
    return this.players[0];
  }

  get audio(): NullAudio {
    return this.world.audio as NullAudio;
  }

  hold(buttons: Button[], slot = 0): this {
    this.masks[slot] = buttonMask(...buttons);
    return this;
  }

  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pads[0].update(this.masks[0]);
      this.pads[1].update(this.masks[1]);
      this.world.update();
    }
    return this;
  }

  /** These buttons are down for one tick on top of the held ones. */
  tap(buttons: Button[], slot = 0): this {
    const keep = this.masks[slot];
    this.masks[slot] = keep | buttonMask(...buttons);
    this.run(1);
    this.masks[slot] = keep;
    return this;
  }

  until(pred: () => boolean, max = 600): number {
    for (let i = 0; i < max; i++) {
      if (pred()) return i;
      this.run(1);
    }
    throw new Error(`condition not met within ${max} ticks`);
  }

  soldier(x: number, params: SpawnParams = {}, y = FLOOR): Soldier {
    const e = this.world.spawn('swan-test-soldier', x, y, params) as Soldier;
    this.world.flush();
    return e;
  }

  /** Full sprint to the right (2.6 px/tick). */
  sprint(): this {
    this.hold(['right']).run(40);
    expect(this.swan.vx).toBeCloseTo(SWAN.runMax, 6);
    return this;
  }

  ofType(type: string): Entity[] {
    return this.world.entities.filter((e) => e.type === type && !e.removed);
  }
}

/** Ticks from now until she is airborne, and the airtime with its apex (px above the take-off y). */
function measureJump(rig: SwanRig): { squat: number; apex: number; air: number; length: number; landY: number } {
  const s = rig.swan;
  const y0 = s.y;
  let squat = 0;
  while (s.medium !== 'air') {
    rig.run(1);
    squat++;
    if (squat > 20) throw new Error('no take-off');
  }
  const x0 = s.x;
  let top = s.y;
  let air = 1;
  while (s.medium === 'air') {
    rig.run(1);
    air++;
    top = Math.min(top, s.y);
    if (air > 400) throw new Error('no landing');
  }
  return { squat, apex: y0 - top, air: air - 1, length: s.x - x0, landY: s.y };
}

describe('swan: registration and riding', () => {
  it('registers the swan, her weapons and their projectiles (GDD 15.2)', () => {
    const rig = new SwanRig({ mount: false });
    expect(isSwan(rig.swan)).toBe(true);
    expect(rig.swan.hudName).toBe('SWAN-3');
    for (const id of ['swan-beak-gun', 'swan-beak-shell', 'swan-honk']) expect(getWeapon(id).id).toBe(id);
    for (const id of ['beak-bullet', 'beak-shell', 'honk-ring']) {
      const e = rig.world.spawn(id, 300, 120, {});
      rig.world.flush();
      expect(e.type).toBe(id);
    }
    expect(Object.isFrozen(SWAN)).toBe(true);
    expect(Object.isFrozen(SWAN.dive)).toBe(true);
  });

  it('a player falling onto her parked back mounts; the driver anchor is her feet, not the seat', () => {
    const rig = new SwanRig({ mount: false });
    const s = rig.swan;
    rig.run(60); // stand → sit → parked (28×20 body)
    rig.p.placeAt(s.x, 100, 0);
    rig.p.y = 100;
    rig.p.body.onGround = false;
    rig.until(() => rig.p.state === 'mounted', 90);
    expect(s.driver).toBe(rig.p);
    rig.run(SWAN.riseTicks + 2);
    expect(rig.p.x).toBe(s.x);
    expect(rig.p.y).toBe(s.y);
    expect(s.hasTag('shootable')).toBe(true);
    // The pilot is never hit; his box is part of hers (3 boxes standing: legs, hull, rider).
    const boxes = s.hurtboxes();
    expect(boxes.length).toBe(3);
    expect(boxes[2]).toEqual({ x: s.x - 10, y: s.y - 66, w: 12, h: 18 });
  });

  it('is P2’s Mute when player 2 rides her (and stays painted so); `variant` and `socks` pick the prefix', () => {
    const rig = new SwanRig({ players: 2, mount: false });
    rig.swan.mount(rig.players[1]);
    expect(rig.swan.mute).toBe(true);
    const ivory = new SwanRig({ mount: false, params: { variant: 'ivory', socks: true } });
    ivory.swan.mount(ivory.p);
    expect(ivory.swan.mute).toBe(false);
  });

  it('moves the camera lead to 64 and its max speed to 4 while ridden, and back after (GDD 4.12)', () => {
    const rig = new SwanRig();
    expect(rig.world.camera.lead).toBe(SWAN.cameraLead);
    expect(rig.world.camera.maxSpeed).toBe(SWAN.cameraMaxSpeed);
    rig.hold(['down']).run(1).hold(['down', 'jump']).run(1).hold([]);
    expect(rig.p.state).toBe('play');
    expect(rig.world.camera.lead).toBe(TUNING.camera.lead);
    expect(rig.world.camera.maxSpeed).toBe(TUNING.camera.maxSpeed);
    // A swan that was never ridden leaves a section's own camera values alone when she goes.
    const parked = new SwanRig({ mount: false });
    parked.world.camera.lead = 20;
    parked.swan.remove();
    parked.run(1);
    expect(parked.world.camera.lead).toBe(20);
  });

  it('a driven Swan stays inside the view', () => {
    const rig = new SwanRig();
    rig.world.camera.lock(0, 384);
    rig.hold(['right']).run(300);
    expect(rig.swan.x).toBeLessThanOrEqual(rig.world.camera.right - SWAN.bodyW / 2 + 1e-6);
  });
});

describe('swan: ground movement (feel §3)', () => {
  it('runs 2.6 px/tick: trot 1.5 after 6 ticks, full sprint after 25 ticks and ~45 px', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    const x0 = s.x;
    rig.hold(['right']);
    let t15 = 0;
    let t26 = 0;
    for (let t = 1; t <= 40; t++) {
      rig.run(1);
      expect(s.vx).toBeLessThanOrEqual(SWAN.runMax + 1e-9);
      if (!t15 && s.vx >= SWAN.trotSpeed - 1e-9) t15 = t;
      if (!t26 && s.vx >= SWAN.runMax - 1e-9) t26 = t;
      if (t === t26) expect(s.x - x0).toBeCloseTo(45, -1);
    }
    expect(t15).toBe(6);
    expect(t26).toBeGreaterThanOrEqual(24);
    expect(t26).toBeLessThanOrEqual(26);
    // The 384 px view in about 148 ticks at full speed.
    const xa = s.x;
    rig.run(148);
    expect(s.x - xa).toBeCloseTo(384.8, 0);
  });

  it('brakes from 2.6 in 13–14 ticks over ~15.6 px [engine]', () => {
    const rig = new SwanRig().sprint();
    const s = rig.swan;
    const x0 = s.x;
    rig.hold([]);
    const t = rig.until(() => s.vx === 0, 30);
    expect(t).toBeGreaterThanOrEqual(13);
    expect(t).toBeLessThanOrEqual(14);
    expect(s.x - x0).toBeCloseTo(15.6, 0);
  });

  it('skids on a reverse at ≥ 1.6: 7 ticks, ~9.8 px, still facing (and firing) forward; then flips', () => {
    const rig = new SwanRig().sprint();
    const s = rig.swan;
    const x0 = s.x;
    rig.hold(['left']);
    rig.run(1);
    expect(s.skidding).toBe(true);
    const t = rig.until(() => s.facing < 0, 20) + 1;
    expect(t).toBe(7);
    expect(s.x - x0).toBeCloseTo(9.8, 0);
    rig.run(20);
    expect(s.vx).toBeLessThan(-1);
  });

  it('turns at once below 1.6 px/tick', () => {
    const rig = new SwanRig();
    rig.hold(['right']).run(6);
    expect(rig.swan.vx).toBeCloseTo(1.5, 6);
    rig.hold(['left']).run(1);
    expect(rig.swan.facing).toBe(-1);
    expect(rig.swan.skidding).toBe(false);
  });

  it('up locks her facing: up + back back-pedals at 1.2 px/tick', () => {
    const rig = new SwanRig();
    rig.hold(['up', 'left']).run(30);
    expect(rig.swan.facing).toBe(1);
    expect(rig.swan.vx).toBeCloseTo(-SWAN.backpedalMax, 6);
  });

  it('limps at ≤ 1 cell: every 4th foot contact frame of the run hangs 3 ticks longer (cosmetic)', () => {
    const longestContact = (cells: number): number => {
      const rig = new SwanRig();
      const s = rig.swan;
      s.cells = cells;
      rig.sprint();
      let best = 0;
      let streak = 0;
      let last = -1;
      for (let i = 0; i < 240; i++) {
        rig.run(1);
        const f = s.anim.index;
        streak = f === last ? streak + 1 : 1;
        last = f;
        if (f === 0 || f === 4) best = Math.max(best, streak);
      }
      expect(s.vx).toBeCloseTo(SWAN.runMax, 6); // the limp never slows her
      return best;
    };
    expect(longestContact(3)).toBeLessThanOrEqual(3);
    expect(longestContact(1)).toBeGreaterThanOrEqual(5);
  });

  it('crouches to a 20 px box, waddles at 0.8 and belly-slides from a sprint (9 ticks to 0.8)', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.hold(['down', 'right']).run(20);
    expect(s.crouching).toBe(true);
    expect(s.vx).toBeCloseTo(SWAN.crouchSpeed, 6);
    expect(s.hitbox.h).toBe(SWAN.crouchBodyH);
    expect(s.hurtboxes()).toEqual([{ x: s.x - 22, y: s.y - 20, w: 40, h: 20 }]);
    const slide = new SwanRig().sprint();
    slide.hold(['down']).run(1);
    const t = slide.until(() => slide.swan.vx <= SWAN.crouchSpeed + 1e-9, 20) + 1;
    expect(t).toBe(9);
    slide.hold([]).run(2);
    expect(slide.swan.crouching).toBe(false);
  });

  it('a chest-high enemy shot passes over her crouch and hits her standing', () => {
    for (const crouch of [true, false]) {
      const rig = new SwanRig();
      const s = rig.swan;
      s.invulnTicks = 0;
      rig.hold(crouch ? ['down'] : []).run(4);
      Projectile.spawn(rig.world, { team: 'enemy', x: s.x + 60, y: FLOOR - 24, vx: -2.5, vy: 0, damage: 10, w: 8, h: 3 });
      rig.run(40);
      expect(s.cells).toBe(crouch ? SWAN.cells : SWAN.cells - 0.5);
    }
  });

  it('slides 68 px on ice from a sprint (brake 0.05)', () => {
    const rig = new SwanRig();
    gameOf(rig.world).ice = [[0, 4000]];
    rig.sprint();
    const x0 = rig.swan.x;
    rig.hold([]);
    const t = rig.until(() => rig.swan.vx === 0, 80);
    expect(t).toBeGreaterThanOrEqual(52);
    expect(t).toBeLessThanOrEqual(53);
    expect(rig.swan.x - x0).toBeCloseTo(66.3, 0);
  });

  it('steps up 12 px curbs at a run (on foot 4)', () => {
    const rig = new SwanRig({ build: (t) => t.solid(320, FLOOR - 12, 400, 12) });
    rig.hold(['right']).run(120);
    expect(rig.swan.x).toBeGreaterThan(400);
    expect(rig.swan.y).toBe(FLOOR - 12);
  });
});

describe('swan: jump (feel §4)', () => {
  it('a 4-tick squat, then a fixed jump: apex ~93.8 px (2.05 × on foot), 65 ticks in the air', () => {
    const rig = new SwanRig();
    rig.tap(['jump']);
    const j = measureJump(rig);
    expect(j.squat).toBe(SWAN.squatTicks); // she takes off on the 5th tick (the press tick + 4)
    expect(j.apex).toBeGreaterThan(93);
    expect(j.apex).toBeLessThan(94.5);
    expect(j.air).toBeGreaterThanOrEqual(64);
    expect(j.air).toBeLessThanOrEqual(66);
    // On foot the same engine gives 45.4 px: ~2.05×.
    const foot = new SwanRig({ mount: false });
    const p = foot.p;
    foot.tap(['jump']);
    let top = p.y;
    foot.until(() => {
      top = Math.min(top, p.y);
      return p.body.onGround && p.vy === 0 && p.y === FLOOR && top < FLOOR - 10;
    }, 120);
    const ratio = j.apex / (FLOOR - top);
    expect(ratio).toBeGreaterThan(1.95);
    expect(ratio).toBeLessThan(2.15);
  });

  it('every jump has the same height: holding jump only adds the glide, never height', () => {
    const tapRig = new SwanRig();
    tapRig.tap(['jump']);
    const a = measureJump(tapRig);
    const holdRig = new SwanRig();
    holdRig.hold(['jump']);
    const b = measureJump(holdRig);
    expect(b.apex).toBeLessThan(a.apex + 1.3);
    expect(b.apex).toBeGreaterThanOrEqual(a.apex);
  });

  it('a sprint jump covers ~169 px; a standing jump with forward held ~87 px (air cap)', () => {
    const run = new SwanRig().sprint();
    run.tap(['jump']);
    const a = measureJump(run);
    expect(a.length).toBeGreaterThan(164);
    expect(a.length).toBeLessThan(172);
    const stand = new SwanRig();
    stand.tap(['jump']);
    stand.hold(['right']);
    const b = measureJump(stand);
    expect(b.length).toBeGreaterThan(80);
    expect(b.length).toBeLessThan(92);
  });

  it('a coyote press after running off a ledge takes off at once (no squat)', () => {
    const rig = new SwanRig({ build: (t) => t.solid(150, FLOOR - 60, 120, 60), y: FLOOR - 60, x: 200 });
    const s = rig.swan;
    rig.hold(['right']);
    rig.until(() => s.medium === 'air', 120);
    const vy0 = s.vy;
    rig.run(2).tap(['jump', 'right']);
    expect(s.vy).toBeLessThan(vy0 - 5);
  });

  it('a press just before landing is buffered and jumps on landing', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.tap(['jump']);
    rig.until(() => s.medium === 'air' && s.vy > 4 && s.y > FLOOR - 24, 120);
    rig.tap(['jump']);
    expect(s.glide).toBe('ready'); // near the floor: no glide
    rig.until(() => s.medium === 'ground', 20);
    rig.until(() => s.medium === 'air', 8);
    expect(s.vy).toBeLessThan(-5);
  });
});

describe('swan: GLIDE (feel §5)', () => {
  it('a sprint jump with jump held glides 60 ticks: ~268 px in ~112 ticks, never faster than 2.2 or falling over 1.0', () => {
    const rig = new SwanRig().sprint();
    const s = rig.swan;
    rig.hold(['right', 'jump']);
    let opened = -1;
    let ticks = 0;
    let maxGlideFall = 0;
    let maxGlideSpeed = 0;
    let top = s.y;
    const x0 = s.x;
    rig.until(() => s.medium === 'air', 10);
    const xa = s.x;
    while (s.medium === 'air') {
      rig.run(1);
      ticks++;
      top = Math.min(top, s.y);
      if (s.glide === 'open') {
        if (opened < 0) opened = ticks;
        if (ticks - opened > 9) maxGlideSpeed = Math.max(maxGlideSpeed, Math.abs(s.vx));
        maxGlideFall = Math.max(maxGlideFall, s.vy);
      }
    }
    expect(opened).toBeGreaterThan(30);
    expect(maxGlideFall).toBeLessThanOrEqual(SWAN.glideMaxFall + 1e-9);
    expect(maxGlideSpeed).toBeLessThanOrEqual(SWAN.glideSpeed + 1e-9);
    expect(ticks + 1).toBeGreaterThanOrEqual(110);
    expect(ticks + 1).toBeLessThanOrEqual(113);
    expect(s.x - xa).toBeGreaterThan(260);
    expect(s.x - xa).toBeLessThan(272);
    expect(FLOOR - top).toBeLessThan(93.8 + 1.4); // the flap is her only lift
    expect(s.x - x0).toBeGreaterThan(268);
  });

  it('one glide per airtime: releasing folds the wings until she lands; a landing gives it back', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.hold(['jump']);
    rig.until(() => s.glide === 'open', 80);
    rig.hold([]).run(1);
    expect(s.glide).toBe('folded');
    expect(rig.audio.log).toContain('sfx:swan/fold');
    rig.hold(['jump']).run(10);
    expect(s.glide).toBe('folded');
    rig.hold([]);
    rig.until(() => s.medium === 'ground', 120);
    expect(s.glide).toBe('ready');
  });

  it('the opening flap stops a fast fall at once (vy = min(vy, −0.4))', () => {
    const rig = new SwanRig({ build: (t) => t.solid(100, 40, 200, 20), y: 40, x: 200 });
    const s = rig.swan;
    rig.hold(['right']);
    rig.until(() => s.medium === 'air', 120);
    rig.run(25);
    expect(s.vy).toBeGreaterThan(3);
    rig.hold(['right', 'jump']).run(1);
    expect(s.glide).toBe('open');
    expect(s.vy).toBeLessThanOrEqual(SWAN.glideFlapVy + SWAN.glideGravity + 1e-9);
  });

  it('a sprint run-off (no jump) glides at 2.2: her air cap is her speed when she leaves the ledge', () => {
    // levels.md m1-c: the run-off glide from the judges' box (52 px above the jetty) lands on the jetty.
    const rig = new SwanRig({ build: (t) => t.solid(0, FLOOR - 52, 400, 52), y: FLOOR - 52, x: 160 });
    const s = rig.swan;
    rig.hold(['right']);
    rig.until(() => s.medium === 'air', 200);
    const x0 = s.x;
    expect(s.vx).toBeCloseTo(SWAN.runMax, 6);
    rig.run(6).hold(['right', 'jump']).run(30);
    expect(s.glide).toBe('open');
    expect(s.vx).toBeCloseTo(SWAN.glideSpeed, 6);
    rig.until(() => s.y >= FLOOR - 1e-6 || s.medium === 'ground', 120);
    // Engine: about 159 px after she left the ledge (a 6-tick fall, then the 60-tick glide).
    expect(s.x - x0).toBeGreaterThan(150);
    expect(s.x - x0).toBeLessThan(165);
  });

  it('the wings fold by themselves after 60 ticks', () => {
    const rig = new SwanRig({ build: (t) => t.solid(100, 20, 200, 20), y: 20, x: 200 });
    const s = rig.swan;
    rig.hold(['right']);
    rig.until(() => s.medium === 'air', 120);
    rig.run(6).hold(['jump']);
    const t = rig.until(() => s.glide === 'open', 5);
    expect(t).toBeLessThanOrEqual(1);
    const g = rig.until(() => s.glide !== 'open', 80);
    expect(g).toBe(SWAN.glideTicks);
  });
});

describe('swan: STOMP (feel §4.5)', () => {
  it('falling onto a soldier kills it with 100 crush, bounces her (vy −3.4) and gives the glide back', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    const foe = rig.soldier(s.x + 2);
    rig.tap(['jump']);
    rig.until(() => s.medium === 'air' && s.vy > 0, 60);
    let bounced = false;
    rig.until(() => {
      if (s.vy < -3) bounced = true;
      return bounced;
    }, 60);
    expect(foe.hits).toEqual([{ amount: SWAN.stompDamage, kind: 'crush' }]);
    expect(foe.alive).toBe(false);
    expect(s.vy).toBeCloseTo(SWAN.stompBounceVy, 6);
    expect(s.glide).toBe('ready');
    expect(rig.audio.log).toContain('sfx:swan/stomp');
  });

  it('never stomps from a glide, nor a hard (non-soft) enemy; on the ground she passes through infantry', () => {
    const rig = new SwanRig({ build: (t) => t.solid(100, 60, 200, 20), y: 60, x: 200 });
    const s = rig.swan;
    const a = rig.soldier(330);
    rig.hold(['right']);
    rig.until(() => s.medium === 'air', 120);
    rig.run(4).hold(['right', 'jump']);
    rig.until(() => s.medium === 'ground', 200);
    expect(a.hits.length).toBe(0);
    const hard = new SwanRig();
    const m = hard.soldier(hard.swan.x + 2, { soft: false });
    hard.tap(['jump']);
    measureJump(hard);
    expect(m.hits.length).toBe(0);
    const walk = new SwanRig();
    const w = walk.soldier(walk.swan.x + 60);
    walk.hold(['right']).run(80);
    expect(w.hits.length).toBe(0);
    expect(walk.swan.x).toBeGreaterThan(w.x + 40);
  });
});

describe('swan: water (feel §6)', () => {
  it('her feet ride the float line 16 px under the surface (a one-way floor only she uses)', () => {
    const rig = new SwanRig({ river: true, x: 800 });
    const s = rig.swan;
    expect(s.swimming).toBe(true);
    expect(s.y).toBe(FLOAT);
    expect(s.vy).toBe(0);
    expect(s.hurtboxes()).toEqual([
      { x: s.x - 22, y: FLOAT - 30, w: 40, h: 16 },
      { x: s.x - 10, y: FLOAT - 48, w: 12, h: 18 },
    ]);
    rig.run(200);
    expect(s.y).toBe(FLOAT);
    expect(rig.p.alive).toBe(true);
  });

  it('swims at 2.0 px/tick: 25 ticks to full speed, drifts ~25 px when let go, pivots at once', () => {
    const rig = new SwanRig({ river: true, x: 800 });
    const s = rig.swan;
    rig.hold(['right']);
    const t = rig.until(() => s.vx >= SWAN.swimMax - 1e-9, 40);
    expect(t).toBeGreaterThanOrEqual(24);
    expect(t).toBeLessThanOrEqual(26);
    rig.run(30);
    expect(s.vx).toBeCloseTo(SWAN.swimMax, 6);
    const x0 = s.x;
    rig.hold([]);
    const d = rig.until(() => s.vx === 0, 40);
    expect(d).toBeGreaterThanOrEqual(24);
    expect(d).toBeLessThanOrEqual(26);
    expect(s.x - x0).toBeCloseTo(25, -1);
    rig.hold(['right']).run(40).hold(['left']).run(1);
    expect(s.facing).toBe(-1);
    expect(s.skidding).toBe(false);
  });

  it('walks off the bank into the water and floats (a splash, no damage)', () => {
    const rig = new SwanRig({ river: true, x: 560 });
    const s = rig.swan;
    rig.hold(['right']);
    rig.until(() => s.swimming, 80);
    expect(s.y).toBe(FLOAT);
    expect(s.cells).toBe(SWAN.cells);
  });

  it('ducks 8 px lower (down): chest-high shots from a boat pass over her', () => {
    const rig = new SwanRig({ river: true, x: 800 });
    const s = rig.swan;
    s.invulnTicks = 0;
    rig.hold(['down']).run(3);
    expect(s.ducking).toBe(true);
    expect(s.hurtboxes()[0]).toEqual({ x: s.x - 22, y: FLOAT - 24, w: 40, h: 12 });
    Projectile.spawn(rig.world, { team: 'enemy', x: s.x + 60, y: SURFACE - 24, vx: -2.5, vy: 0, damage: 10, w: 8, h: 3 });
    rig.run(40);
    expect(s.cells).toBe(SWAN.cells);
  });

  it('jumps out of the water after an 8-tick paddle-up: feet peak ~77.8 px above the surface', () => {
    const rig = new SwanRig({ river: true, x: 800 });
    const s = rig.swan;
    rig.tap(['jump']);
    const j = measureJump(rig);
    expect(j.squat).toBe(SWAN.waterSquatTicks);
    expect(j.apex - SWAN.swimDepth).toBeGreaterThan(77);
    expect(j.apex - SWAN.swimDepth).toBeLessThan(78.5);
    expect(j.landY).toBe(FLOAT); // the float line catches the landing
    expect(s.swimming).toBe(true);
  });

  it('ground shockwaves miss her while she swims', () => {
    const rig = new SwanRig({ river: true, x: 800 });
    rig.swan.invulnTicks = 0;
    rig.world.damage(rig.swan, { amount: 50, kind: 'impact', dirX: 1, tags: ['boss', 'shockwave'] });
    expect(rig.swan.cells).toBe(SWAN.cells);
  });

  it('a jump that starts over water keeps the perch on and carries the partner; over land it is off', () => {
    const water = new SwanRig({ river: true, x: 800, players: 2 });
    const s = water.swan;
    const p2 = water.players[1];
    p2.placeAt(s.x - 19, FLOAT - 30, 0);
    p2.x = s.x - 19;
    p2.y = s.perch.y;
    water.run(2);
    expect(p2.body.onGround).toBe(true);
    expect(p2.y).toBeCloseTo(s.perch.y, 6);
    water.tap(['jump']);
    water.hold(['right']);
    measureJump(water);
    water.run(4);
    expect(p2.alive).toBe(true);
    expect(p2.y).toBeCloseTo(s.perch.y, 6);
    expect(Math.abs(p2.x - (s.x - 19))).toBeLessThan(4);

    const land = new SwanRig({ players: 2 });
    land.players[1].placeAt(land.swan.x - 19, land.swan.perch.y, 0);
    land.players[1].y = land.swan.perch.y;
    land.run(2);
    expect(land.players[1].y).toBeCloseTo(land.swan.perch.y, 6);
    land.tap(['jump']);
    land.run(2);
    expect(land.swan.perch.enabled).toBe(false);
    land.run(40);
    expect(land.players[1].y).toBe(FLOOR);
  });

  it('a coyote jump takes the perch rule from its own take-off point (over land: off)', () => {
    // A ledge 40 px high from x 260; she was last over water in an earlier jump (stale flag).
    const rig = new SwanRig({ x: 200, build: (t) => t.solid(0, FLOOR - 40, 260, 40) });
    const s = rig.swan;
    s.y = FLOOR - 40;
    rig.run(4);
    s.overWaterJump = true;
    rig.hold(['right']);
    rig.until(() => s.medium === 'air', 120);
    expect(s.perch.enabled).toBe(true); // ran off the ledge: no jump yet, the partner rides along
    rig.tap(['jump', 'right']);
    expect(s.jumped).toBe(true);
    expect(s.overWaterJump).toBe(false);
    rig.run(1);
    expect(s.perch.enabled).toBe(false);
  });

  it('carries a partner on the perch at her speed (co-op tail gunner)', () => {
    const rig = new SwanRig({ players: 2 });
    const s = rig.swan;
    const p2 = rig.players[1];
    p2.placeAt(s.x - 19, s.perch.y, 0);
    p2.y = s.perch.y;
    rig.run(2);
    expect(p2.body.onGround).toBe(true);
    const dx = p2.x - s.x;
    rig.hold(['right']).run(60);
    expect(p2.x - s.x).toBeCloseTo(dx, 0);
    expect(p2.y).toBeCloseTo(s.perch.y, 6);
    // The partner keeps his own controls: he can shoot from up there.
    rig.hold(['fire'], 1).run(2);
    expect(p2.alive).toBe(true);
  });
});

describe('swan: eject, catch and the empty gags (feel §6.8, §9.1)', () => {
  it('ejects when jump comes within 4 ticks after down; a jump from a held crouch is a jump', () => {
    const same = new SwanRig();
    same.hold(['down', 'jump']).run(1);
    expect(same.p.state).toBe('play');
    expect(same.p.vy).toBeLessThan(0);
    const four = new SwanRig();
    four.hold(['down']).run(4); // down on tick t, jump on t + 4
    four.hold(['down', 'jump']).run(1);
    expect(four.p.state).toBe('play');
    const held = new SwanRig();
    held.hold(['down']).run(5); // jump on t + 5: a jump out of the crouch
    held.hold(['down', 'jump']).run(1);
    expect(held.p.state).toBe('mounted');
    held.run(4);
    expect(held.swan.medium).toBe('air');
    // Down pressed again with jump leaves her.
    const again = new SwanRig();
    again.hold(['down']).run(10).hold([]).run(1).hold(['down', 'jump']).run(1);
    expect(again.p.state).toBe('play');
  });

  it('no eject in the air: down + jump there is a down-aim and a glide press', () => {
    const rig = new SwanRig();
    rig.tap(['jump']);
    rig.until(() => rig.swan.medium === 'air' && rig.swan.vy > 0.5, 80);
    rig.hold(['down']).run(1).hold(['down', 'jump']).run(1);
    expect(rig.p.state).toBe('mounted');
    expect(rig.swan.glide).toBe('open');
  });

  it('after an eject on land she stands 20 ticks, sits down, parks and shows RIDE?', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.hold(['down', 'jump']).run(1).hold([]);
    expect(s.phase).toBe('stand');
    rig.run(SWAN.standTicks);
    expect(s.phase).toBe('sit');
    rig.run(SWAN.sitTicks + 1);
    expect(s.phase).toBe('parked');
    expect(s.hitbox.h).toBe(SWAN.crouchBodyH);
    rig.run(31);
    expect(rig.hud.bubbles.some((b) => b.target === s && b.text === 'RIDE?')).toBe(true);
  });

  it('left alone 600 ticks she lays her nervous egg once: it pops into a pickup-bombs', () => {
    const rig = new SwanRig({ mount: false });
    rig.p.placeAt(1200, FLOOR, 0);
    const spawned: string[] = [];
    rig.world.events.on('spawn', (e) => spawned.push(e.type));
    rig.run(SWAN.standTicks + SWAN.sitTicks + SWAN.eggAfter + 120);
    expect(spawned.filter((t) => t === 'pickup-bombs').length).toBe(1);
    rig.run(800);
    expect(spawned.filter((t) => t === 'pickup-bombs').length).toBe(1);
  });

  it('in water she stops at once and catches her own pilot as he falls back (ticks 30–90)', () => {
    const rig = new SwanRig({ river: true, x: 800 });
    const s = rig.swan;
    rig.hold(['right']).run(30);
    expect(s.vx).toBeGreaterThan(1);
    rig.hold(['down']).run(1).hold(['down', 'jump']).run(1).hold([]);
    expect(rig.p.state).toBe('play');
    expect(s.vx).toBe(0);
    const t = rig.until(() => rig.p.state === 'mounted', 80) + 2;
    expect(t).toBeGreaterThanOrEqual(SWAN.catchFrom);
    expect(t).toBeLessThanOrEqual(60);
    expect(rig.p.alive).toBe(true);
  });

  it('at 0 cells her wings fold at once and a jump press ejects anywhere, also in the air', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.hold(['jump']);
    rig.until(() => s.glide === 'open', 80);
    s.invulnTicks = 0;
    s.cells = 0.5;
    rig.world.damage(s, { amount: 10, kind: 'bullet', dirX: 1 });
    expect(s.state).toBe('doomed');
    expect(s.glide).toBe('folded');
    rig.hold([]).run(12);
    expect(s.vy).toBeGreaterThan(SWAN.glideMaxFall);
    expect(s.medium).toBe('air');
    rig.tap(['jump']);
    expect(rig.p.state).toBe('play');
    rig.until(() => s.removed, 300);
    expect(rig.p.alive).toBe(true);
  });

  it('at 0 cells in water she does not catch him', () => {
    const rig = new SwanRig({ river: true, x: 800 });
    const s = rig.swan;
    s.invulnTicks = 0;
    s.cells = 0.5;
    rig.world.damage(s, { amount: 10, kind: 'bullet', dirX: 1 });
    rig.tap(['jump']);
    expect(rig.p.state).toBe('play');
    rig.run(70);
    expect(rig.p.state).not.toBe('mounted');
  });
});

describe('swan: aim and weapons (feel §7)', () => {
  function shots(rig: SwanRig, type: string): Projectile[] {
    return rig.ofType(type) as Projectile[];
  }

  it('the neck aims in 9 steps (+45° … −135°) and turns 22.5° per 2 ticks (0° → −90° in 8 ticks)', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    expect(s.neckAngle).toBe(0);
    rig.hold(['up']);
    const t = rig.until(() => s.neckAngle === -Math.PI / 2, 20);
    expect(t).toBe(8);
    expect(s.neckIndex).toBe(6);
    rig.hold(['up', 'left']).run(8);
    expect(s.facing).toBe(1); // up locks the facing
    expect(s.neckAngle).toBeCloseTo((-3 * Math.PI) / 4, 9);
    expect(s.neckIndex).toBe(8);
    rig.hold(['up', 'right']).run(12);
    expect(s.neckAngle).toBeCloseTo(-Math.PI / 4, 9);
    // Down aims +45° only in the air; on the ground it is the crouch (0°).
    rig.hold(['down']).run(12);
    expect(s.shotAngle).toBe(0);
    rig.hold([]).run(1).tap(['jump']);
    rig.until(() => s.medium === 'air', 10);
    rig.hold(['down']).run(8);
    expect(s.neckAngle).toBeCloseTo(Math.PI / 4, 9);
    expect(s.neckIndex).toBe(0);
  });

  it('BEAK GUN: a tap is a 5-round burst at 1 round per 4 ticks, 10 damage, 8 px/tick, from the beak tip (44, −24: the art point; GDD 40)', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    const ticks: number[] = [];
    rig.world.events.on('spawn', (e) => {
      if (e.type === 'beak-bullet') ticks.push(rig.world.tick);
    });
    rig.tap(['fire']);
    const b = shots(rig, 'beak-bullet')[0];
    expect(b).toBeDefined();
    expect(b.damage.amount).toBe(10);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(8, 6);
    expect(b.x).toBeCloseTo(s.x + 44, 0);
    expect(Math.abs(b.y - (s.y - 24))).toBeLessThanOrEqual(1);
    rig.run(40);
    expect(ticks.length).toBe(5);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBe(4);
  });

  it('facing left everything mirrors: the beak tip at (−44, −24), rounds fly left; up + back fires up-right behind her', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.hold(['left']).run(1).hold([]).run(20);
    expect(s.facing).toBe(-1);
    rig.tap(['fire']);
    const b = shots(rig, 'beak-bullet')[0];
    expect(b.x).toBeCloseTo(s.x - 44, 0);
    // ±1 px jitter, and the idle breath (hull dy 0 / 1) moves the neck socket with the hull.
    expect(Math.abs(b.y - (s.y - 24))).toBeLessThanOrEqual(2);
    expect(b.vx).toBeCloseTo(-8, 6);
    rig.run(40);
    rig.hold(['up', 'right']).run(20);
    expect(s.facing).toBe(-1);
    expect(s.neckIndex).toBe(8);
    const before = shots(rig, 'beak-bullet').length;
    rig.tap(['up', 'right', 'fire']);
    const back = shots(rig, 'beak-bullet')[before];
    expect(back.vx).toBeGreaterThan(0);
    expect(back.vy).toBeLessThan(0);
    // look.md: the −135° tip is (−12, −78), mirrored; ±1 px jitter across the aim.
    expect(Math.abs(back.x - (s.x + 12))).toBeLessThanOrEqual(1);
    expect(Math.abs(back.y - (s.y - 78))).toBeLessThanOrEqual(2);
  });

  it('BEAK GUN: a held stream fans out through the in-between angles while the neck turns', () => {
    // The neck steps every 2 ticks and the gun fires every 4: the cooldown phase picks the steps.
    const all = new Set<number>();
    for (const lead of [8, 10]) {
      const rig = new SwanRig();
      const angles = new Set<number>();
      rig.world.events.on('spawn', (e) => {
        if (e.type === 'beak-bullet') angles.add(Math.round((Math.atan2(e.vy, e.vx) * 180) / Math.PI));
      });
      rig.hold(['fire']).run(lead).hold(['fire', 'up']).run(24);
      expect(angles.size).toBeGreaterThanOrEqual(3);
      for (const a of angles) all.add(a);
    }
    expect([...all].sort((a, b) => a - b)).toEqual([-90, -67, -45, -23, 0]);
  });

  it('BEAK GUN rates: hold = 15 rounds per second, at most 24 on screen', () => {
    const rig = new SwanRig();
    let n = 0;
    rig.world.events.on('spawn', (e) => {
      if (e.type === 'beak-bullet') n++;
    });
    rig.hold(['fire']).run(60);
    expect(n).toBeGreaterThanOrEqual(14);
    expect(n).toBeLessThanOrEqual(16);
    expect(getWeapon('swan-beak-gun').maxShotsOnScreen).toBe(24);
  });

  it('BEAK SHELL: 4 px/tick plus her vx; a 0° shell lands ~113 px ahead of her standing or sprinting; 10 shells', () => {
    for (const sprint of [false, true]) {
      const rig = new SwanRig();
      const s = rig.swan;
      if (sprint) rig.sprint();
      expect(s.shells).toBe(SWAN.shells);
      rig.tap(['bomb']);
      const shell = shots(rig, 'beak-shell')[0];
      expect(shell).toBeDefined();
      expect(shell.vx).toBeCloseTo(SWAN.shell.speed + (sprint ? SWAN.runMax : 0), 6);
      expect(shell.damage.amount).toBe(SWAN.shell.direct);
      expect(s.shells).toBe(SWAN.shells - 1);
      let landX = 0;
      rig.world.events.on('explosion', (e) => (landX = e.x));
      rig.until(() => shell.removed, 80);
      // 113 px [112] in front of the beak tip (+40), wherever she is now.
      expect(landX - (s.x + 40)).toBeGreaterThan(106);
      expect(landX - (s.x + 40)).toBeLessThan(118);
    }
  });

  it('BEAK SHELL: 200 to the target it hits and 100 to others in r 24; cooldown 30', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    const a = rig.soldier(s.x + 90, { hp: 500 });
    const b = rig.soldier(s.x + 104, { hp: 500 });
    rig.tap(['bomb']);
    rig.run(10).tap(['bomb']);
    rig.run(40);
    expect(a.hits[0]).toEqual({ amount: 200, kind: 'explosion' });
    expect(b.hits.some((h) => h.amount === 100)).toBe(true);
    expect(s.shells).toBe(SWAN.shells - 1); // the second press came during the 30-tick cooldown
  });

  it('HONK: fire + bomb, 10-tick wind-up, a ring 0 → 128 px in 16 ticks; 80 per part, erases enemy shots, ears; 3 shells, cooldown 240', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    const near = rig.soldier(s.x + 60, { hp: 500 });
    const far = rig.soldier(s.x + 200, { hp: 500 });
    const shot = Projectile.spawn(rig.world, { team: 'enemy', x: s.x + 100, y: FLOOR - 24, vx: 0, vy: 0, damage: 10, life: 200 });
    rig.hold(['fire', 'bomb']).run(1).hold([]);
    expect(s.shells).toBe(SWAN.shells - SWAN.honk.cost);
    expect(s.honkT).toBeGreaterThanOrEqual(0);
    rig.run(SWAN.honk.windup - 1);
    expect(rig.ofType('honk-ring').length).toBe(0);
    rig.run(1); // the ring leaves when the 10-tick wind-up ends
    const ring = rig.ofType('honk-ring')[0] as HonkRing;
    expect(ring).toBeDefined();
    rig.run(SWAN.honk.growTicks);
    expect(ring.r).toBe(SWAN.honk.radius);
    expect(near.hits.some((h) => h.amount === SWAN.honk.damage && h.kind === 'impact')).toBe(true);
    expect(near.reaction).toBe('ears');
    expect(far.hits.length).toBe(0);
    expect(shot.removed).toBe(true);
    // Cooldown 240: a second honk now is refused (a squeak, no shells paid).
    rig.hold(['fire', 'bomb']).run(1).hold([]);
    expect(s.shells).toBe(SWAN.shells - SWAN.honk.cost);
    expect(rig.audio.log).toContain('sfx:swan/squeak');
  });

  it('HONK with fewer than 3 shells: a sad squeak and nothing else', () => {
    const rig = new SwanRig();
    rig.swan.shells = 2;
    rig.hold(['fire', 'bomb']).run(1).hold([]).run(30);
    expect(rig.swan.shells).toBe(2);
    expect(rig.ofType('honk-ring').length).toBe(0);
    expect(rig.audio.log).toContain('sfx:swan/squeak');
  });

  it('specialReady (the HUD gem, bug 7.3): lit when driven, HONK cooled down and shells ≥ cost; dark otherwise', () => {
    const parked = new SwanRig({ mount: false });
    expect(parked.swan.specialReady).toBe(false); // not driven
    const rig = new SwanRig();
    const s = rig.swan;
    expect(s.specialReady).toBe(true);
    rig.hold(['fire', 'bomb']).run(1).hold([]);
    expect(s.specialReady).toBe(false); // wind-up, then the 240-tick cooldown
    rig.run(SWAN.honk.windup + 2);
    expect(s.specialReady).toBe(false);
    rig.until(() => s.specialReady, SWAN.honk.cooldown + 5);
    expect(s.specialReady).toBe(true);
    s.shells = SWAN.honk.cost - 1;
    expect(s.specialReady).toBe(false);
    s.shells = SWAN.honk.cost;
    expect(s.specialReady).toBe(true);
  });

  it('HONK in the air: she hangs (vy 0) for the 10-tick wind-up', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.tap(['jump']);
    rig.until(() => s.medium === 'air', 10);
    rig.run(10);
    const y0 = s.y;
    rig.hold(['fire', 'bomb']).run(1).hold([]);
    rig.run(SWAN.honk.windup - 2);
    expect(s.vy).toBe(0);
    expect(Math.abs(s.y - y0)).toBeLessThan(6);
    rig.run(4);
    expect(s.vy).toBeGreaterThan(0);
  });

  it('a HONK pressed during the take-off squat keeps the jump (the combo cancels nothing)', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.tap(['jump']).run(1);
    expect(s.squatT).toBeGreaterThan(0);
    rig.hold(['fire', 'bomb']).run(1).hold([]);
    expect(s.honkT).toBeGreaterThanOrEqual(0);
    const { apex } = measureJump(rig);
    expect(apex).toBeGreaterThan(90);
    expect(rig.ofType('honk-ring').length + (rig.audio.log.includes('sfx:swan/honk') ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe('swan: SWAN DIVE (feel §9.2)', () => {
  it('fire + jump on the same tick: the pilot pops up, she hisses 6 ticks, charges at 3.4 for up to 192 px and BEAK-BASHES', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    const x0 = s.x;
    let bashX = 0;
    rig.world.events.on('explosion', (e) => (bashX = e.x));
    rig.hold(['fire', 'jump']).run(1).hold([]);
    expect(rig.p.state).toBe('play');
    expect(rig.p.vy).toBeLessThan(-3.5);
    expect(s.state).toBe('ram');
    expect(s.phase).toBe('hiss');
    rig.run(SWAN.dive.hissTicks);
    expect(s.phase).toBe('dive');
    let top = 0;
    rig.until(() => {
      top = Math.max(top, Math.abs(s.vx));
      return s.phase !== 'dive';
    }, 100);
    expect(top).toBeCloseTo(SWAN.dive.speed, 6);
    expect(s.x - x0).toBeGreaterThan(SWAN.dive.distance - 4);
    expect(bashX).not.toBe(0);
    expect(s.cells).toBe(SWAN.cells - 1);
    expect(s.alive).toBe(true);
  });

  it('a jump that comes first is a jump (the squat), fire 1 tick before jump is a dive', () => {
    const first = new SwanRig();
    first.tap(['jump']).tap(['fire']);
    expect(first.swan.state).toBe('driven');
    expect(first.p.state).toBe('mounted');
    first.run(4);
    expect(first.swan.medium).toBe('air');
    const fireFirst = new SwanRig();
    fireFirst.tap(['fire']).tap(['jump']);
    expect(fireFirst.swan.state).toBe('ram');
    const late = new SwanRig();
    late.tap(['fire']).run(1).tap(['jump']);
    expect(late.swan.state).toBe('driven');
  });

  it('tramples soft enemies (100 crush each) and bashes the first hard one: 400 in r 40', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    const soft = rig.soldier(s.x + 60, { hp: 500 });
    const hard = rig.soldier(s.x + 120, { soft: false, hp: 1000 });
    rig.hold(['fire', 'jump']).run(1).hold([]);
    rig.until(() => s.phase !== 'hiss' && s.phase !== 'dive', 120);
    expect(soft.hits.some((h) => h.amount === SWAN.dive.trample && h.kind === 'crush')).toBe(true);
    expect(hard.hits.some((h) => h.amount === SWAN.dive.damage)).toBe(true);
    expect(s.x).toBeLessThan(hard.x);
  });

  it('with ≥ 2 cells she is dazed 180 ticks, rights herself and can be ridden again', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    rig.hold(['fire', 'jump']).run(1).hold([]);
    rig.until(() => s.phase === 'bash', 120);
    const t = rig.until(() => s.state === 'idle', 400);
    expect(t).toBeGreaterThanOrEqual(SWAN.dive.dazedTicks + SWAN.dive.rightingTicks);
    expect(t).toBeLessThanOrEqual(SWAN.dive.dazedTicks + SWAN.dive.rightingTicks + SWAN.dive.shakeTicks + 2);
    expect(s.cells).toBe(SWAN.cells - 1);
    expect(s.canMount(rig.p)).toBe(false); // he is not falling onto her
  });

  it('with 1 cell left she migrates: flies off and is lost', () => {
    const rig = new SwanRig();
    const s = rig.swan;
    s.cells = 1;
    let lost = false;
    rig.world.events.on('vehicleDestroyed', () => (lost = true));
    rig.hold(['fire', 'jump']).run(1).hold([]);
    rig.until(() => s.phase === 'migrate', 120);
    expect(lost).toBe(true);
    expect(rig.audio.log).toContain('sfx:swan/migrate');
    rig.until(() => s.removed, 400);
  });

  it('is refused in water (she shakes her head, the pilot stays) and in the air (no combo)', () => {
    const water = new SwanRig({ river: true, x: 800 });
    water.hold(['fire', 'jump']).run(1).hold([]);
    expect(water.p.state).toBe('mounted');
    expect(water.swan.state).toBe('driven');
    const air = new SwanRig();
    air.tap(['jump']);
    air.until(() => air.swan.medium === 'air', 10);
    air.hold(['fire', 'jump']).run(1).hold([]);
    expect(air.p.state).toBe('mounted');
    expect(air.swan.state).toBe('driven');
  });

  it('a charge off the bank into water ends there with the BEAK BASH, and she floats dazed', () => {
    const rig = new SwanRig({ river: true, x: 520 });
    const s = rig.swan;
    rig.hold(['fire', 'jump']).run(1).hold([]);
    rig.until(() => s.phase === 'bash' || s.phase === 'tumble' || s.phase === 'dazed', 120);
    expect(s.x).toBeLessThan(RIVER_X + 40);
    rig.run(30);
    expect(s.swimming).toBe(true);
    expect(s.y).toBe(FLOAT);
  });

  it('a wall ends the charge', () => {
    const rig = new SwanRig({ build: (t) => t.solid(300, FLOOR - 80, 30, 80) });
    const s = rig.swan;
    rig.hold(['fire', 'jump']).run(1).hold([]);
    rig.until(() => s.phase === 'bash', 120);
    expect(s.x).toBeLessThan(300);
  });

  it('the view edge ahead ends the charge too: she never bashes out of sight', () => {
    const rig = new SwanRig({ x: 300 });
    const s = rig.swan;
    // A locked view whose right edge is 100 px ahead of her.
    rig.world.camera.lock(s.x - 284, s.x + 100);
    rig.run(30);
    rig.hold(['fire', 'jump']).run(1).hold([]);
    rig.until(() => s.phase === 'bash', 120);
    expect(s.x + SWAN.bodyW / 2).toBeLessThanOrEqual(rig.world.camera.x + rig.world.camera.w + 3.5);
    expect(s.x - 300).toBeLessThan(SWAN.dive.distance);
  });
});

describe('swan: robustness', () => {
  it('mounted under a low roof she starts crouched (no 20 px "standing" body) and stands up in the open', () => {
    const rig = new SwanRig({ mount: false, build: (t) => t.solid(150, FLOOR - 40, 100, 10) });
    const s = rig.swan;
    rig.run(70); // she is parked (20 px tall) under the 30 px gap
    s.mount(rig.p);
    expect(s.crouching).toBe(true);
    expect(s.hitbox.h).toBe(SWAN.crouchBodyH);
    rig.hold(['right']).run(110); // a waddle at 0.8 out from under it
    expect(s.x).toBeGreaterThan(250 + SWAN.bodyW / 2);
    expect(s.crouching).toBe(false);
    expect(s.hitbox.h).toBe(SWAN.bodyH);
  });

  it('two players on two swans (P2 = the Mute): random input for 3000 ticks, no NaN, no errors', () => {
    const rig = new SwanRig({ river: true, x: 420, players: 2 });
    const s2 = rig.world.spawn('swan', 380, FLOOR, { variant: 'mute' }) as Swan;
    rig.world.flush();
    s2.mount(rig.players[1]);
    for (let i = 0; i < 6; i++) rig.soldier(500 + i * 120);
    const buttons: Button[] = ['left', 'right', 'up', 'down', 'fire', 'jump', 'bomb'];
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let t = 0; t < 3000; t++) {
      if (t % 7 === 0) {
        for (const slot of [0, 1]) {
          const held = buttons.filter(() => rnd() < 0.3);
          rig.hold(held, slot);
        }
      }
      rig.run(1);
      for (const s of [rig.swan, s2]) {
        if (s.removed) continue;
        for (const v of [s.x, s.y, s.vx, s.vy, s.neckAngle, s.cells]) expect(Number.isFinite(v)).toBe(true);
      }
      for (const p of rig.players) for (const v of [p.x, p.y]) expect(Number.isFinite(v)).toBe(true);
    }
    expect(s2.mute).toBe(true);
    expect(rig.world.errors?.length ?? 0).toBe(0);
  });
});
