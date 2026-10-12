/**
 * Machines sub-area "transport" (GDD §9.2, §9.5): band-truck, piano-bomber (+ piano),
 * baton-copter (+ note-bullet), rowboat, tank-barge, subway-train, parade-float. Spawning with
 * params, the truck's unload at stopX, telegraphs, carrying and crushing, no off-screen attacks.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { type Damage, Entity } from '../../src/engine/entity';
import type { World } from '../../src/engine/world';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/items/index';
import '../../src/game/content/machines/transport/index';
import '../../src/game/content/machines/transport/art';
import { VirtualPad } from '../../src/engine/input';
import { PALETTE } from '../../src/engine/palette';
import { getFrames, hasSprite } from '../../src/engine/sprites';
import { Player } from '../../src/game/player/player';
import {
  BandTruck,
  BatonCopter,
  BOMBER,
  COPTER,
  FLOAT,
  ParadeFloat,
  Piano,
  PIANO,
  PianoBomber,
  Rowboat,
  ROWBOAT,
  SubwayTrain,
  TankBarge,
  TRAIN,
  TRUCK,
} from '../../src/game/content/machines/transport/index';
import { hasEntity, defineEntity, type SpawnParams } from '../../src/game/registry';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, TestWorld, type TestWorldOptions } from './helpers';

const IDS = ['band-truck', 'piano-bomber', 'baton-copter', 'rowboat', 'tank-barge', 'subway-train', 'parade-float', 'piano', 'note-bullet'];

/** A river: dry bank 0–300, deep water 300–1300 (no floor under it), bank again. */
function riverWorld(o: TestWorldOptions = {}): TestWorld {
  return new TestWorld({
    width: 1600,
    noFloor: true,
    build: (t) => {
      t.ground().at(0, FLOOR).flat(300).gap(1000).flat(300);
      t.hazard('water', 300, FLOOR + 4, 1000, 60);
    },
    ...o,
  });
}

/** A tiny driven vehicle for the ram test. */
class TestCar extends Vehicle {
  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, { art: 'vehicle/test-car', w: 36, h: 26, seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20], cells: 4 });
  }
}
defineEntity('transport-test-car', (w, x, y, p) => new TestCar(w, x, y, p), { category: 'vehicle' });

describe('transport machines: registration', () => {
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
});

describe('band-truck', () => {
  it('drives in with spawn armour, stops at stopX, unloads its cargo every 20 ticks, honks and reverses out', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 2000 });
    const audio = tw.world.audio as NullAudio;
    const t = tw.spawn('band-truck', 520, { stopX: 300, cargo: ['rifleman', 'rifleman', { id: 'rifleman', params: { hp: 30 } }] }) as BandTruck;
    expect(t.facing).toBe(-1);
    // Shots ping off while it drives in.
    tw.run(20);
    tw.world.damage(t, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(t.hp).toBe(t.maxHp);
    expect(t.state).toBe('drive');
    expect(t.vx).toBeCloseTo(-TRUCK.speed, 5);
    tw.until(() => t.state !== 'drive', 400);
    const arrive = tw.world.tick;
    expect(t.x).toBe(300);
    expect(t.armourTicks).toBe(0);
    expect(audio.log).toContain('sfx:machine/brake');
    // Unload: one soldier every 20 ticks, standing up from the stage.
    const times: number[] = [];
    for (let i = 0; i < 200 && t.unloaded < 3; i++) {
      const n = t.unloaded;
      tw.run(1);
      if (t.unloaded > n) times.push(tw.world.tick);
    }
    expect(t.crew.length).toBe(3);
    expect(times[1] - times[0]).toBe(TRUCK.unloadEvery);
    expect(times[2] - times[1]).toBe(TRUCK.unloadEvery);
    for (const c of t.crew) {
      expect(c.type).toBe('rifleman');
      expect((c as Entity & { params: SpawnParams }).params.entry).toBe('truck');
    }
    expect(t.crew[2].maxHp).toBe(30); // per-soldier params win
    // Now it can be hurt.
    tw.world.damage(t, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(t.hp).toBe(t.maxHp - 10);
    tw.until(() => t.state === 'wait', 100);
    expect(audio.log).toContain('sfx:machine/truck-horn');
    // 300 ticks after the stop it reverses out at 1.5 px/tick (the way it came).
    tw.until(() => t.state === 'reverse', 400);
    expect(tw.world.tick - arrive).toBeGreaterThanOrEqual(TRUCK.stay - 5);
    expect(tw.world.tick - arrive).toBeLessThanOrEqual(TRUCK.stay + 5);
    tw.run(2);
    expect(t.vx).toBeCloseTo(TRUCK.reverse, 5);
  });

  it('spawn armour also ends after 240 ticks when the stop is never reached', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 3000 });
    const t = tw.spawn('band-truck', 2600, { stopX: 100 }) as BandTruck;
    tw.run(239);
    expect(t.armourTicks).toBeGreaterThan(0);
    tw.run(2);
    expect(t.armourTicks).toBe(0);
  });

  it('kills a player it drives into, but a parked truck is harmless', () => {
    const tw = new TestWorld({ playerX: 200 });
    tw.spawn('band-truck', 420, { stopX: 120 });
    tw.until(() => tw.player?.dead === true, 200);
    const tw2 = new TestWorld({ playerX: 200 });
    const t2 = tw2.spawn('band-truck', 200, { stopX: 200, cargo: [] }) as BandTruck;
    tw2.run(120);
    expect(t2.moving).toBe(false);
    expect(tw2.player?.dead).toBe(false);
  });

  it('comes from the left with `from: left` and the m2-b overtake speed', () => {
    const tw = new TestWorld({ god: true, playerX: 200, width: 2000 });
    const t = tw.spawn('band-truck', -40, { from: 'left', stopX: 330, speed: 3 }) as BandTruck;
    tw.run(2);
    expect(t.facing).toBe(1);
    expect(t.vx).toBeCloseTo(3, 5);
  });

  it('dies for 2,000 points, rains instruments and leaves a wreck that goes away', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const t = tw.spawn('band-truck', 300, { stopX: 300, cargo: [] }) as BandTruck;
    tw.run(5);
    tw.world.damage(t, { amount: 9999, kind: 'explosion', dirX: 1, owner: 0 });
    expect(t.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(TRUCK.score);
    tw.run(2);
    expect(tw.world.entities.filter((e) => e.type === 'machine-debris').length).toBeGreaterThanOrEqual(4);
    tw.run(TRUCK.wreckTicks);
    expect(t.removed).toBe(false);
    tw.run(40);
    expect(t.removed).toBe(true);
  });

  it('ram mode: rams a driven player vehicle (a big hit) and blows up, no points', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 2000 });
    const car = tw.spawn('transport-test-car', 150) as TestCar;
    const p = tw.player!;
    p.placeAt(150, 120, 0);
    p.y = 120;
    p.body.onGround = false;
    tw.until(() => p.state === 'mounted', 120);
    const t = tw.spawn('band-truck', 440, { ram: true }) as BandTruck;
    expect(t.state).toBe('ram');
    tw.until(() => t.dead, 300);
    expect(car.cells).toBe(3); // 4 → 3: a big hit (1 cell)
    expect(tw.session.slots[0].score).toBe(0);
  });
});

describe('piano-bomber and its pianos', () => {
  it('telegraphs every drop for 50 ticks (bay, shadow, whistle) and drops at most 3 pianos near the player', () => {
    const tw = new TestWorld({ god: true, playerX: 200, width: 1600 });
    const audio = tw.world.audio as NullAudio;
    const b = tw.spawn('piano-bomber', 520, { dir: 'left' }, 36) as PianoBomber;
    expect(b.y).toBe(36);
    const tells: number[] = [];
    const drops: Array<{ t: number; x: number }> = [];
    let seen = new Set<Entity>();
    for (let i = 0; i < 900 && !b.removed; i++) {
      const st = b.state;
      tw.run(1);
      if (st !== 'tell' && b.state === 'tell') tells.push(i);
      for (const e of tw.world.entities) {
        if (e instanceof Piano && !seen.has(e)) {
          seen.add(e);
          drops.push({ t: i, x: e.x });
          // GDD §4.11 rule 3: the bay was inside the view (8 px margin) at the release.
          expect(tw.world.camera.containsPoint(e.x, e.y - PIANO.h, -8)).toBe(true);
        }
      }
    }
    expect(drops.length).toBeGreaterThanOrEqual(2);
    expect(drops.length).toBeLessThanOrEqual(BOMBER.pianos);
    for (let k = 0; k < drops.length; k++) {
      expect(drops[k].t - tells[k]).toBeGreaterThanOrEqual(BOMBER.telegraph);
      expect(Math.abs(drops[k].x - 200)).toBeLessThanOrEqual(BOMBER.near + BOMBER.aimJitter + 4);
    }
    expect(audio.log.filter((s) => s === 'sfx:machine/piano-whistle').length).toBeGreaterThanOrEqual(drops.length);
    seen = new Set();
  });

  it('never opens its bay while the drop point is outside the view', () => {
    const tw = new TestWorld({ god: true, playerX: 360, width: 1600 });
    tw.world.camera.lock(0, 384);
    const b = tw.spawn('piano-bomber', 700, { dir: 'left' }, 36) as PianoBomber;
    for (let i = 0; i < 360; i++) {
      tw.run(1);
      if (b.state === 'tell') expect(tw.world.camera.containsPoint(b.dropX, b.y + BOMBER.bayY, -8)).toBe(true);
    }
  });

  it('a landing piano kills a player under it', () => {
    const tw = new TestWorld({ playerX: 120 });
    const piano = tw.spawn('piano', 120, {}, 60) as Piano;
    tw.until(() => piano.state === 'stand', 120);
    expect(tw.player?.dead).toBe(true);
    expect(tw.player?.cause).toBe('impact');
  });

  it('a landing piano flattens a rifleman (SET PIECE +200) and stands as cover for 600 ticks', () => {
    const tw = new TestWorld({ playerX: 120, god: true });
    const r = tw.spawn('rifleman', 300, { gag: false, facing: -1 });
    const piano = tw.spawn('piano', 300, {}, 60) as Piano;
    tw.until(() => piano.state === 'stand', 120);
    expect(r.dead).toBe(true);
    expect((r as Entity & { killedBy: Damage | null }).killedBy?.kind).toBe('crush');
    expect(tw.session.slots[0].score).toBe(PIANO.setPiece);
    expect(tw.hud.callouts.some((c) => c.text.startsWith('SET PIECE'))).toBe(true);
    expect(piano.box).not.toBeNull();
    expect(piano.hasTag('cover')).toBe(true);
    expect(tw.world.solids).toContain(piano.box);
    tw.run(PIANO.standTicks);
    expect(piano.state).toBe('collapse');
    expect(piano.box).toBeNull();
    tw.run(PIANO.collapseTicks + PIANO.pileTicks + 30);
    expect(piano.removed).toBe(true);
  });

  it('on deep water a piano floats as a bobbing one-way platform, then sinks', () => {
    const tw = riverWorld({ god: true, playerX: 100 });
    const piano = tw.spawn('piano', 600, {}, 40) as Piano;
    tw.until(() => piano.state === 'float', 120);
    const box = piano.box!;
    expect(box.oneWay).toBe(true);
    const ys = new Set<number>();
    for (let i = 0; i < 120; i++) {
      tw.run(1);
      ys.add(box.y);
    }
    const span = Math.max(...ys) - Math.min(...ys);
    expect(span).toBeGreaterThan(0);
    expect(span).toBeLessThanOrEqual(2 * PIANO.bob);
    tw.run(PIANO.floatTicks);
    expect(piano.state).toBe('sink');
    tw.run(PIANO.sinkTicks + 2);
    expect(piano.removed).toBe(true);
  });

  it('flight mode: the pianos fall through the screen and a ! marker telegraphs 40 ticks', () => {
    const tw = new TestWorld({ god: true, playerX: 200, width: 1600 });
    const b = tw.spawn('piano-bomber', 500, { mode: 'air', dir: 'left' }, 20) as PianoBomber;
    expect(b.y).toBe(20);
    tw.until(() => b.state === 'tell', 400);
    tw.until(() => b.state === 'fly', 100);
    const p = tw.world.entities.find((e) => e instanceof Piano) as Piano;
    expect(p.air).toBe(true);
    tw.until(() => p.removed, 120);
    expect(p.state).toBe('fall');
  });

  it('death: it rolls over, its last piano lands on its own belly, the wreck falls and blows up', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const audio = tw.world.audio as NullAudio;
    const b = tw.spawn('piano-bomber', 260, { dir: 'left', pianos: 0 }, 36) as PianoBomber;
    tw.run(2);
    tw.world.damage(b, { amount: 9999, kind: 'bullet', dirX: 1, owner: 0 });
    expect(tw.session.slots[0].score).toBe(BOMBER.score);
    tw.until(() => b.deathPhase === 'crash', 120);
    expect(audio.log).toContain('sfx:machine/piano-crash');
    tw.until(() => b.removed, 200);
  });
});

describe('baton-copter', () => {
  it('hovers 60–90 px over the ground and fires a telegraphed 60/90/120° note spread', () => {
    const tw = new TestWorld({ god: true, playerX: 200 });
    const c = tw.spawn('baton-copter', 330, {}, FLOOR) as BatonCopter;
    let tellStart = -1;
    let shotAt = -1;
    let notes: Entity[] = [];
    for (let i = 0; i < 600 && shotAt < 0; i++) {
      const st = c.state;
      tw.run(1);
      if (st !== 'tell' && c.state === 'tell') tellStart = i;
      notes = tw.world.entities.filter((e) => e.type === 'note-bullet' && e.alive);
      if (notes.length > 0) shotAt = i;
    }
    expect(shotAt).toBeGreaterThan(0);
    expect(shotAt - tellStart).toBeGreaterThanOrEqual(18);
    const skids = FLOOR - (c.y + COPTER.skids);
    expect(skids).toBeGreaterThanOrEqual(COPTER.hoverMin - 2);
    expect(skids).toBeLessThanOrEqual(COPTER.hoverMax + 2);
    expect(notes.length).toBe(3);
    const angles = notes.map((n) => {
      const a = (Math.atan2(n.vy, n.vx * c.facing) * 180) / Math.PI;
      return Math.round(a);
    });
    expect(angles.sort((a, b) => a - b)).toEqual([60, 90, 120]);
    for (const n of notes) expect(Math.hypot(n.vx, n.vy)).toBeCloseTo(COPTER.noteSpeed, 5);
  });

  it('flight mode: level flight at 1.2 px/tick and a spread aimed at the player (±15°)', () => {
    const tw = new TestWorld({ god: true, playerX: 150 });
    const c = tw.spawn('baton-copter', 360, { mode: 'air', dir: 'left' }, 60) as BatonCopter;
    tw.run(3);
    expect(c.vx).toBeCloseTo(-COPTER.speed, 5);
    tw.until(() => c.volleys > 0, 400);
    expect(c.y).toBe(60);
    const notes = tw.world.entities.filter((e) => e.type === 'note-bullet' && e.alive);
    expect(notes.length).toBe(3);
    const p = tw.player!;
    const toPlayer = Math.atan2(p.y - 15 - (60 + COPTER.gunDy), p.x - (c.x + COPTER.gunDx * c.facing));
    const diffs = notes.map((n) => Math.round(((Math.atan2(n.vy, n.vx) - toPlayer) * 180) / Math.PI)).sort((a, b) => a - b);
    expect(Math.abs(diffs[0] + COPTER.airSpread)).toBeLessThanOrEqual(8);
    expect(Math.abs(diffs[1])).toBeLessThanOrEqual(8);
    expect(Math.abs(diffs[2] - COPTER.airSpread)).toBeLessThanOrEqual(8);
  });

  it('never fires from outside the view', () => {
    const tw = new TestWorld({ god: true, playerX: 100, width: 2000 });
    tw.world.camera.lock(0, 384);
    tw.spawn('baton-copter', 520, { mode: 'air', dir: 'right' }, 60);
    tw.run(400);
    expect(tw.world.entities.filter((e) => e.type === 'note-bullet').length).toBe(0);
  });

  it('death: spins down, the pilot bails out under a parachute, 1,500 points', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const c = tw.spawn('baton-copter', 250, {}, 90) as BatonCopter;
    tw.run(3);
    tw.world.damage(c, { amount: 9999, kind: 'bullet', dirX: 1, owner: 0 });
    expect(tw.session.slots[0].score).toBe(COPTER.score);
    tw.run(1);
    expect(tw.world.entities.some((e) => e.type === 'machine-pilot')).toBe(true);
    tw.until(() => c.removed, 300);
  });
});

describe('rowboat', () => {
  it('floats with its crew aboard, rows to stopX, keeps the crew on deck, sinks when empty (no points)', () => {
    const tw = riverWorld({ god: true, playerX: 120 });
    const b = tw.spawn('rowboat', 900, { stopX: 700, outfit: 'deck' }, FLOOR) as Rowboat;
    tw.run(2);
    expect(b.afloat).toBe(true);
    expect(b.y).toBe(FLOOR + 4 + ROWBOAT.draft);
    expect(b.crew.length).toBe(2);
    expect((b.crew[0] as Entity & { params: SpawnParams }).params.entry).toBe('rowboat');
    expect((b.crew[0] as Entity & { params: SpawnParams }).params.outfit).toBe('deck');
    tw.until(() => b.state === 'wait', 400);
    expect(b.x).toBe(700);
    tw.run(240);
    for (const c of b.crew) {
      expect(c.alive).toBe(true);
      expect(Math.abs(c.x - b.x)).toBeLessThanOrEqual(ROWBOAT.deckW / 2);
      expect(c.y).toBeCloseTo(b.y - ROWBOAT.deckY, 0);
    }
    for (const c of b.crew) tw.world.damage(c, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
    const score = tw.session.slots[0].score;
    tw.run(3);
    expect(b.state).toBe('sink');
    tw.run(ROWBOAT.sinkTicks + 2);
    expect(b.removed).toBe(true);
    expect(tw.session.slots[0].score).toBe(score);
  });

  it('destroyed: 200 points and the crew is lost in deep water; it never holds a wave', () => {
    const tw = riverWorld({ god: true, playerX: 120 });
    const b = tw.spawn('rowboat', 600, {}, FLOOR) as Rowboat;
    tw.run(3);
    expect(b.hasTag('enemy')).toBe(false);
    tw.world.damage(b, { amount: 99, kind: 'explosion', dirX: 1, owner: 0 });
    expect(b.dead).toBe(true);
    expect(tw.session.slots[0].stats.kills).toBe(2); // the crew, not the boat
    expect(tw.session.slots[0].score).toBe(ROWBOAT.score + 2 * 100);
    for (const c of b.crew) expect(c.dead).toBe(true);
  });
});

describe('tank-barge', () => {
  it('floats left at 0.3 px/tick and carries its cargo on board', () => {
    const tw = riverWorld({ god: true, playerX: 120 });
    const barge = tw.spawn('tank-barge', 1000, { cargo: { id: 'rifleman', params: { gag: false } } }, FLOOR) as TankBarge;
    tw.run(2);
    const cargo = barge.cargo!;
    expect(cargo.type).toBe('rifleman');
    const x0 = barge.x;
    tw.run(300);
    expect(barge.x - x0).toBeCloseTo(-0.3 * 300, 0);
    expect(cargo.alive).toBe(true);
    expect(Math.abs(cargo.x - barge.x)).toBeLessThanOrEqual(46);
    expect(cargo.body?.onGround).toBe(true);
    // Its cargo gone, the raft drifts to a halt.
    tw.world.damage(cargo, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(80);
    const x1 = barge.x;
    tw.run(30);
    expect(barge.x).toBe(x1);
  });

  it('puts an oompah-tank on board by default (stopX = its spawn x)', () => {
    const tw = riverWorld({ god: true, playerX: 120 });
    const barge = tw.spawn('tank-barge', 1000, {}, FLOOR) as TankBarge;
    tw.run(1);
    expect(barge.cargo?.type).toBe('oompah-tank');
  });

  it('is a raft players can ride', () => {
    const tw = riverWorld({ god: true, playerX: 120 });
    const barge = tw.spawn('tank-barge', 360, { cargo: 'none' }, FLOOR) as TankBarge;
    tw.run(2);
    const p = tw.player!;
    p.placeAt(345, barge.deck!.top - 30, 0);
    tw.run(40);
    expect(p.dead).toBe(false);
    expect(p.y).toBeCloseTo(barge.deck!.top, 0);
    const dx = p.x - barge.x;
    tw.run(60);
    expect(p.x - barge.x).toBeCloseTo(dx, 0);
  });
});

describe('subway-train', () => {
  function station(o: TestWorldOptions = {}): TestWorld {
    return new TestWorld({
      width: 1600,
      noFloor: true,
      build: (t) => {
        t.ground().at(0, 192).flat(1600);
        t.platform(0, 152, 260);
      },
      ...o,
    });
  }

  it('telegraphs 120 ticks (bell, sparks, headlight), then runs at 6 px/tick and kills a player on the track bed', () => {
    const tw = station({ playerX: 320 });
    const audio = tw.world.audio as NullAudio;
    const p = tw.player!;
    p.placeAt(320, 192, 0);
    const t = tw.spawn('subway-train', 0, {}, 192) as SubwayTrain;
    tw.run(TRAIN.telegraph - 2);
    expect(t.state).toBe('telegraph');
    expect(p.dead).toBe(false);
    expect(audio.log.filter((s) => s === 'sfx:env/train-bell').length).toBe(2);
    tw.run(3);
    expect(t.state).toBe('run');
    expect(audio.log).toContain('sfx:env/train-pass');
    const x0 = t.x;
    tw.run(1);
    expect(x0 - t.x).toBe(TRAIN.speed);
    tw.until(() => p.dead, 60);
    expect(p.cause).toBe('impact');
    tw.until(() => t.removed, 200);
  });

  it('spares a player standing on the station platform, and flattens Legion soldiers on the track', () => {
    const tw = station({ playerX: 120 });
    const p = tw.player!;
    p.placeAt(120, 152, 0);
    const r = tw.spawn('rifleman', 330, { gag: true, facing: 1 }, 192);
    const t = tw.spawn('subway-train', 0, { from: 'left' }, 192) as SubwayTrain;
    expect(t.dir).toBe(1);
    tw.until(() => t.removed, 400);
    expect(p.dead).toBe(false);
    expect(r.dead).toBe(true);
  });
});

describe('parade-float', () => {
  it('drives left at 0.5 px/tick with its riders on the deck and halts for a player in front', () => {
    const tw = new TestWorld({ god: true, playerX: 150, width: 1600 });
    const f = tw.spawn('parade-float', 330, { variant: 'drum', outfit: 'night' }) as ParadeFloat;
    tw.run(2);
    expect(f.variant).toBe('drum');
    expect(f.riders.length).toBe(2);
    expect((f.riders[0] as Entity & { params: SpawnParams }).params.entry).toBe('float');
    const x0 = f.x;
    tw.run(40);
    expect(f.x - x0).toBeCloseTo(-0.5 * 40, 0);
    for (const r of f.riders) {
      expect(r.y).toBeCloseTo(FLOOR - FLOAT.deckH, 0);
      expect(Math.abs(r.x - f.x)).toBeLessThanOrEqual(FLOAT.w / 2);
    }
    // It reaches the player and stops (never shoves a player).
    const p = tw.player!;
    tw.until(() => f.blocked, 400);
    const px = p.x;
    tw.run(60);
    expect(p.x).toBeCloseTo(px, 5);
    expect(f.x - FLOAT.w / 2).toBeGreaterThanOrEqual(p.x);
  });

  it('is a solid platform a player can ride; destroyed it frees its hostage and pays 1,500', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 1600 });
    const f = tw.spawn('parade-float', 330, { riders: [], hostage: { id: 'hostage', params: { kind: 'critic' } } }) as ParadeFloat;
    tw.run(2);
    const h = f.hostage as Entity & { state: string };
    expect(h.state).toBe('tied');
    const p = tw.player!;
    p.placeAt(f.x, FLOOR - FLOAT.deckH - 20, 0);
    tw.run(30);
    expect(p.y).toBeCloseTo(FLOOR - FLOAT.deckH, 0);
    const dx = p.x - f.x;
    tw.run(40);
    expect(p.x - f.x).toBeCloseTo(dx, 0);
    // The tied hostage rides along at the mast.
    expect(Math.abs(h.x - (f.x + FLOAT.mastDx * f.facing))).toBeLessThanOrEqual(2);
    expect(f.hasTag('enemy')).toBe(false);
    tw.world.damage(f, { amount: 9999, kind: 'explosion', dirX: 1, owner: 0 });
    expect(tw.session.slots[0].score).toBeGreaterThanOrEqual(FLOAT.score);
    expect(h.state).not.toBe('tied');
    expect(tw.world.solids.length).toBe(0);
  });
});

describe('transport machines: review (art, fairness, co-op, cost)', () => {
  /** A test world with a second player (joined in the session, so co-op scaling applies). */
  function twoPlayers(o: TestWorldOptions = {}, p2x = 320): { tw: TestWorld; p2: Player } {
    const tw = new TestWorld({ god: true, playerX: 60, ...o });
    tw.session.join(1, tw.session.slots[0].character);
    const p2 = new Player(tw.world, p2x, FLOOR, { pad: new VirtualPad(), index: 1 });
    tw.world.add(p2);
    p2.placeAt(p2x, FLOOR, 0);
    tw.world.flush();
    return { tw, p2 };
  }

  it('every strip the machines draw is registered and uses palette colours only', () => {
    const strips: Record<string, string[]> = {
      'band-truck': ['move', 'idle', 'move-dmg', 'idle-dmg', 'wreck', 'body', 'drum', 'horn', 'cymbal', 'triangle', 'bandsman-horn', 'bandsman-drum'],
      'piano-bomber': ['body', 'tell', 'body-dmg', 'tell-dmg', 'roll', 'wreck', 'piano', 'piano-landed', 'piano-collapse'],
      'baton-copter': ['body', 'tell', 'fire', 'body-dmg', 'tell-dmg', 'spin', 'note-bullet', 'pilot-chute', 'pilot-run'],
      rowboat: ['idle', 'row', 'sink', 'idle-dmg', 'row-dmg'],
      'tank-barge': ['body'],
      'subway-train': ['head', 'car'],
      'parade-float': ['tuba', 'drum', 'tuba-dmg', 'drum-dmg', 'wreck', 'topper-tuba', 'topper-drum'],
    };
    const pal = new Set(PALETTE.map((c) => c >>> 0));
    for (const [id, names] of Object.entries(strips)) {
      for (const n of names) {
        const sid = `machine/${id}/${n}`;
        expect(hasSprite(sid), sid).toBe(true);
        const frames = getFrames(sid);
        expect(frames.length, sid).toBeGreaterThan(0);
        for (const f of frames) {
          for (const c of f.buf.data) if ((c & 255) !== 0) expect(pal.has(c >>> 0), `${sid}: #${(c >>> 0).toString(16)}`).toBe(true);
        }
      }
    }
    // The train cars are exactly 100 px apart: the drawn car is 100 px long (+ the outline).
    expect(getFrames('machine/subway-train/car')[0].buf.w).toBe(TRAIN.carW + 2);
  });

  it('HARD: the copter and the bomber still telegraph at least 18 ticks (and the GDD length × 0.9)', () => {
    const tw = new TestWorld({ god: true, playerX: 200, difficulty: 'hard' });
    const c = tw.spawn('baton-copter', 330, {}, FLOOR) as BatonCopter;
    let tellStart = -1;
    let shotAt = -1;
    for (let i = 0; i < 600 && shotAt < 0; i++) {
      const st = c.state;
      tw.run(1);
      if (st !== 'tell' && c.state === 'tell') tellStart = i;
      if (tw.ofType('note-bullet').length > 0) shotAt = i;
    }
    expect(shotAt - tellStart).toBeGreaterThanOrEqual(Math.max(18, Math.round(COPTER.telegraph * 0.9)));

    const tw2 = new TestWorld({ god: true, playerX: 200, difficulty: 'hard' });
    const b = tw2.spawn('piano-bomber', 520, { dir: 'left' }, 36) as PianoBomber;
    let tell = -1;
    let drop = -1;
    for (let i = 0; i < 600 && drop < 0; i++) {
      const st = b.state;
      tw2.run(1);
      if (st !== 'tell' && b.state === 'tell') tell = i;
      if (tw2.ofType('piano').length > 0) drop = i;
    }
    expect(drop - tell).toBeGreaterThanOrEqual(Math.round(BOMBER.telegraph * 0.9));
  });

  it('a copter shot down during its telegraph fires nothing and gives its attack token back', () => {
    const tw = new TestWorld({ god: true, playerX: 200 });
    const c = tw.spawn('baton-copter', 330, {}, FLOOR) as BatonCopter;
    tw.until(() => c.state === 'tell', 600);
    tw.world.damage(c, { amount: 9999, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(120);
    expect(tw.world.entities.some((e) => e.type === 'note-bullet')).toBe(false);
    expect((c as unknown as { holdsToken: boolean }).holdsToken).toBe(false);
  });

  it('a bomber shot down with its bay open drops no aimed piano (only the gag piano on itself)', () => {
    const tw = new TestWorld({ god: true, playerX: 200 });
    const b = tw.spawn('piano-bomber', 520, { dir: 'left' }, 36) as PianoBomber;
    tw.until(() => b.state === 'tell', 600);
    tw.world.damage(b, { amount: 9999, kind: 'bullet', dirX: 1, owner: 0 });
    expect(tw.session.slots[0].score).toBe(BOMBER.score);
    tw.run(200);
    expect(tw.world.entities.some((e) => e instanceof Piano)).toBe(false);
    expect(tw.player?.dead).toBe(false);
  });

  it('2 players: machine HP ×1.25 and the parade halts for player 2 as well', () => {
    const { tw, p2 } = twoPlayers({ width: 1600 }, 200);
    const truck = tw.spawn('band-truck', 600, { stopX: 600, cargo: [] }) as BandTruck;
    expect(truck.maxHp).toBe(Math.round(TRUCK.hp * 1.25));
    const f = tw.spawn('parade-float', 330, { riders: [] }) as ParadeFloat;
    tw.until(() => f.blocked, 400);
    const x = p2.x;
    tw.run(60);
    expect(p2.x).toBeCloseTo(x, 5);
    expect(f.x - FLOAT.w / 2).toBeGreaterThanOrEqual(p2.x);
  });

  it('a crew list can be empty: a decoy boat and a bare float stay without riders', () => {
    const tw = riverWorld({ god: true, playerX: 100 });
    const boat = tw.spawn('rowboat', 600, { crew: 'none' }, FLOOR) as Rowboat;
    const f = tw.spawn('parade-float', 1450, { riders: [] }) as ParadeFloat;
    tw.run(30);
    expect(boat.crew.length).toBe(0);
    expect(boat.state).toBe('wait');
    expect(f.riders.length).toBe(0);
  });

  it.each(['band-truck', 'piano-bomber', 'baton-copter', 'rowboat', 'tank-barge', 'subway-train', 'parade-float'])(
    '30 copies of %s run a tick in under 0.5 ms (riders not counted)',
    (id) => {
      const tw = riverWorld({ god: true, playerX: 100, width: 4000 });
      const air = id === 'piano-bomber' || id === 'baton-copter';
      const params: SpawnParams = { cargo: 'none', crew: 'none', riders: 'none' };
      for (let i = 0; i < 30; i++) tw.spawn(id, 40 + i * 50, params, air ? 60 : FLOOR);
      tw.run(30);
      // The best of three 60-tick windows (one GC pause on a busy machine is not the content).
      let per = Infinity;
      for (let k = 0; k < 3; k++) {
        const t0 = performance.now();
        tw.run(60);
        per = Math.min(per, (performance.now() - t0) / 60);
      }
      expect(per).toBeLessThan(0.5);
      expect(tw.world.errors).toEqual([]);
    },
  );
});
