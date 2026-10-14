/**
 * The people and life of Amsterdam (mission `ams`, docs/design/amsterdam.md §1, §5):
 * src/game/content/missions/ams/{entities,ambient,breakables,npc.art}.ts.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { getFrames, hasSprite } from '../../src/engine/sprites';
import { inPalette } from '../../src/engine/palette';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/props/index';
import '../../src/game/content/vehicles/swan/index';
import {
  AmsBaker,
  AmsBoatPlatform,
  AmsBreakable,
  AmsHotdogVendor,
  AmsPigeons,
  AmsStaff,
  AMS_BREAKABLES,
} from '../../src/game/content/missions/ams/entities';
import { Player } from '../../src/game/player/player';
import { getEntityMeta } from '../../src/game/registry';
import { FLOOR, TestWorld } from './helpers';

const NPCS = ['ams-baker', 'ams-hotdog-vendor', 'ams-staff', 'ams-tour-boat', 'ams-cyclist-bg', 'ams-pigeons', 'ams-ducks', 'ams-window-waver'];
const PROPS = ['ams-boat-platform', ...Object.keys(AMS_BREAKABLES)];
const shot = (amount: number, owner = 0) => ({ amount, kind: 'bullet' as const, dirX: 1, owner });

describe('ams npcs: registration', () => {
  it('registers every id with the right category', () => {
    for (const id of NPCS) expect(getEntityMeta(id)?.category, id).toBe('npc');
    for (const id of PROPS) expect(getEntityMeta(id)?.category, id).toBe('prop');
  });

  it('spawns and runs every id with {} params', () => {
    const tw = new TestWorld({ playerX: 40 });
    for (const [i, id] of [...NPCS, ...PROPS].entries()) {
      const e = tw.spawn(id, 120 + i * 60, {}, id === 'ams-boat-platform' ? 140 : FLOOR);
      expect(e?.type, id).toBe(id);
    }
    tw.run(240);
    expect(tw.world.errors).toEqual([]);
  });

  it('has all strips, inside the palette', () => {
    const ids = [
      ...['idle', 'talk', 'toss', 'walk', 'clap', 'cheer', 'wave'].map((a) => `npc/ams/ams-baker/${a}`),
      ...['idle', 'salute', 'talk', 'wave'].map((a) => `npc/ams/ams-hotdog-vendor/${a}`),
      ...[0, 1, 2].flatMap((l) => ['idle', 'walk', 'clap', 'cheer', 'wave'].map((a) => `npc/ams/ams-staff/${l}/${a}`)),
      'npc/ams/counter',
      'npc/ams/ams-tour-boat',
      'npc/ams/ams-cyclist-bg/0',
      'npc/ams/ams-pigeons',
      'npc/ams/ams-ducks',
      'npc/ams/ams-window-waver/person',
      'npc/ams/ams-window-waver/cat',
      'decor/ams/ams-boat-platform',
      ...Object.keys(AMS_BREAKABLES).map((id) => `decor/ams/${id}`),
    ];
    for (const id of ids) {
      expect(hasSprite(id), id).toBe(true);
      for (const f of getFrames(id)) {
        for (const c of f.buf.data) if (c !== 0) expect(inPalette(c), `${id} colour ${c.toString(16)}`).toBe(true);
      }
    }
    // Humans are 35–37 px tall standing.
    for (const id of ['npc/ams/ams-baker/idle', 'npc/ams/ams-hotdog-vendor/idle', 'npc/ams/ams-staff/0/idle']) {
      const h = getFrames(id)[0].buf.h;
      expect(h, id).toBeGreaterThanOrEqual(35);
      expect(h, id).toBeLessThanOrEqual(39);
    }
  });
});

describe('ams npcs: friendly', () => {
  it('are not counted by waitClear and cannot be shot (shots pass through)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const people = [tw.spawn('ams-baker', 150), tw.spawn('ams-hotdog-vendor', 170), tw.spawn('ams-staff', 190), tw.spawn('ams-pigeons', 400)] as Entity[];
    const cart = tw.spawn('ams-herring-cart', 240) as AmsBreakable;
    expect(tw.world.countAlive('enemy')).toBe(0);
    for (const e of people) {
      expect(e.hasTag('enemy')).toBe(false);
      expect(e.hasTag('shootable')).toBe(false);
    }
    tw.hold('fire').run(90);
    for (const e of people.slice(0, 3)) {
      expect(e.removed).toBe(false);
      expect(e.alive).toBe(true);
      expect(e.flashTicks).toBe(0);
    }
    // The shots went through the people and broke the cart behind them.
    expect(cart.broken).toBe(true);
    expect(tw.world.countAlive('enemy')).toBe(0);
    expect(tw.world.errors).toEqual([]);
  });

  it('the vendor salutes once per player passing on foot', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const v = tw.spawn('ams-hotdog-vendor', 220) as AmsHotdogVendor;
    tw.run(5);
    expect(v.mode).toBe('idle');
    tw.hold('right');
    tw.until(() => v.mode === 'salute', 200);
    expect(v.saluted).toBe(1);
    expect(tw.hud.bubbles.some((b) => b.target === v && b.text === 'HALLO DAAR!')).toBe(true);
    expect(v.facing).toBe(-1);
    tw.hold().run(90);
    expect(v.mode).toBe('idle');
    // Walking back past him: no second salute.
    tw.hold('left').run(80);
    expect(v.mode).toBe('idle');
    // A second player gets his own salute.
    const p2 = new Player(tw.world, 120, FLOOR, { pad: tw.pad, index: 1 });
    tw.world.add(p2);
    p2.placeAt(210, FLOOR, 0);
    tw.world.flush();
    tw.hold().run(3);
    expect(v.mode).toBe('salute');
    expect(v.saluted).toBe(3);
  });

  it('the vendor salutes a player riding the Swan (NEPNAGELS)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const swan = tw.spawn('swan', 100) as Entity & { mount(p: unknown): void };
    swan.mount(tw.player!);
    tw.run(5);
    expect(tw.player!.state).toBe('mounted');
    const v = tw.spawn('ams-hotdog-vendor', 300) as AmsHotdogVendor;
    tw.hold('right');
    tw.until(() => v.mode === 'salute', 300);
    expect(tw.hud.bubbles.some((b) => b.target === v && b.text === 'HEB JIJ NOG NEPNAGELS\nVOOR MIJ?')).toBe(true);
    expect(v.saluted).toBe(1);
  });

  it('the baker talks and tosses an item toward the player; staff walk, clap and cheer', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const b = tw.spawn('ams-baker', 200, { counter: true }) as AmsBaker;
    b.talk(30);
    expect(b.mode).toBe('talk');
    tw.run(31);
    expect(b.mode).toBe('idle');
    b.toss({ id: 'pickup-bombs' });
    tw.until(() => b.tossed === 1, 60);
    tw.until(() => b.mode === 'idle', 60);
    expect(tw.ofType('pickup-bombs').length).toBe(1);
    const s = tw.spawn('ams-staff', 40, { look: 2, mode: 'walk', to: 160 }) as AmsStaff;
    expect(s.look).toBe(2);
    expect(s.mode).toBe('walk');
    tw.until(() => s.arrived, 400);
    expect(s.x).toBe(160);
    s.clap();
    expect(s.anim.id).toBe('npc/ams/ams-staff/2/clap');
    s.cheer(20);
    tw.run(21);
    expect(s.mode).toBe('idle');
    expect(tw.world.errors).toEqual([]);
  });

  it('pigeons fly up when a player comes near and leave', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const f = tw.spawn('ams-pigeons', 220) as AmsPigeons;
    tw.run(30);
    expect(f.fled).toBe(false);
    tw.hold('right');
    tw.until(() => f.fled, 200);
    tw.hold();
    tw.until(() => f.removed, 400);
  });
});

describe('ams boat platform', () => {
  it('carries a player standing on it', () => {
    const tw = new TestWorld({ playerX: 200, god: true });
    const boat = tw.spawn('ams-boat-platform', 200, { range: 200, speed: 1, pause: 0, bob: 0 }, 150) as AmsBoatPlatform;
    tw.player!.placeAt(200, 140, 0);
    tw.run(30);
    const p = tw.player!;
    expect(p.body.onGround).toBe(true);
    expect(p.body.supportSolid).toBe(boat.box);
    const x0 = p.x;
    const b0 = boat.x;
    tw.run(60);
    expect(boat.x - b0).toBeGreaterThan(50);
    expect(p.x - x0).toBeCloseTo(boat.x - b0, 0);
    expect(p.body.supportSolid).toBe(boat.box);
  });
});

describe('ams breakables', () => {
  it('break and reveal their items', () => {
    const tw = new TestWorld({ playerX: 40 });
    const before = tw.world.entities.length;
    for (const [i, id] of Object.keys(AMS_BREAKABLES).entries()) {
      const b = tw.spawn(id, 200 + i * 80) as AmsBreakable;
      expect(b.hasTag('shootable')).toBe(true);
      expect(b.hasTag('enemy')).toBe(false);
      tw.world.damage(b, shot(5));
      expect(b.broken).toBe(false);
      tw.world.damage(b, shot(100));
      expect(b.broken).toBe(true);
      expect(b.hasTag('shootable')).toBe(false);
    }
    tw.run(2);
    expect(tw.world.entities.length).toBeGreaterThan(before + 4);
    expect(tw.ofType('pickup-food').length).toBe(1);
    expect(tw.ofType('pickup-bombs').length).toBe(1);
    const r = tw.spawn('ams-tulip-stall', 600, { contains: 'none', reveal: [{ id: 'pickup-bombs', dx: 10 }, 'pickup-1up'] }) as AmsBreakable;
    tw.world.damage(r, shot(100));
    tw.run(1);
    expect(tw.ofType('pickup-bombs').length).toBe(2);
    expect(tw.ofType('pickup-1up').length).toBe(1);
    expect(tw.world.errors).toEqual([]);
  });
});
