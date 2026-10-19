/**
 * The Amsterdam enemies (docs/design/amsterdam.md §2; GDD §4.11): registration and scores, every
 * param combination spawns and runs, telegraphs of at least 18 ticks ON SCREEN before every
 * attack (NORMAL and HARD), the kick hits a standing player and misses a jumping one, a crouch
 * dodges the ticket, a gull only hurts while diving, a rider from behind tells on screen first.
 */
import { describe, expect, it } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import { getFrames, hasSprite, listSprites } from '../../src/engine/sprites';
import { FxEntity } from '../../src/game/fx';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { DeliveryRider, FatbikeYouth, Handhaver, Rider, Seagull } from '../../src/game/content/locals/index';
import { cubePack } from '../../src/game/content/locals/rider.art';
import { getEntityMeta } from '../../src/game/registry';
import type { Difficulty } from '../../src/game/session';
import { FLOOR, TestWorld, watchFairness, type FairnessOpts, type ModeEntity } from './helpers';

const SCORES: Record<string, number> = { 'fatbike-youth': 300, 'delivery-rider': 200, seagull: 150, handhaver: 300 };
const FAIR: FairnessOpts = { attacks: { kick: 'tell', dive: 'tell', throw: 'tell' }, tells: new Set(['tell']) };

interface Scene {
  id: string;
  x: number;
  y?: number;
  params?: Record<string, unknown>;
  playerX?: number;
}

const SCENES: Scene[] = [
  { id: 'fatbike-youth', x: 330 },
  { id: 'fatbike-youth', x: 330, params: { pair: true, turn: true } },
  { id: 'fatbike-youth', x: 200, params: { gag: 'circles' } },
  { id: 'delivery-rider', x: 300 },
  { id: 'delivery-rider', x: 300, params: { from: 'behind' }, playerX: 260 },
  { id: 'seagull', x: 220, params: {} },
  { id: 'seagull', x: 160, y: FLOOR - 40, params: { perch: true } },
  { id: 'seagull', x: 240, params: { flock: 3 } },
  { id: 'handhaver', x: 280 },
];

function scene(sc: Scene, difficulty: Difficulty = 'normal', god = true, seed = 5): { tw: TestWorld; e: ModeEntity } {
  const tw = new TestWorld({ playerX: sc.playerX ?? 100, god, seed, difficulty, width: 2000 });
  const e = tw.spawn(sc.id, sc.x, sc.params ?? {}, sc.y ?? FLOOR) as unknown as ModeEntity;
  return { tw, e };
}

describe('locals: registration', () => {
  it.each(Object.keys(SCORES))('%s is registered as an enemy with its score', (id) => {
    const meta = getEntityMeta(id);
    expect(meta?.category).toBe('enemy');
    expect(meta?.score).toBe(SCORES[id]);
  });

  it('boete-ticket is a projectile', () => {
    expect(getEntityMeta('boete-ticket')?.category).toBe('projectile');
  });

  it('a fatbike pair has +10 HP and scores 500', () => {
    const tw = new TestWorld({ god: true });
    const solo = tw.spawn('fatbike-youth', 300) as FatbikeYouth;
    const pair = tw.spawn('fatbike-youth', 340, { pair: true }) as FatbikeYouth;
    expect(solo.maxHp).toBe(20);
    expect(pair.maxHp).toBe(30);
    expect(pair.score).toBe(500);
  });

  it('every param combination spawns and runs 300 ticks without errors', () => {
    const specs: Array<[string, Record<string, unknown>, number]> = [
      ['fatbike-youth', {}, FLOOR],
      ['fatbike-youth', { pair: true }, FLOOR],
      ['fatbike-youth', { gag: 'circles' }, FLOOR],
      ['fatbike-youth', { gag: true, pair: true }, FLOOR],
      ['fatbike-youth', { enter: 'left' }, FLOOR],
      ['fatbike-youth', { enter: 'right', look: 3, skin: 'c', turn: true }, FLOOR],
      ['fatbike-youth', { look: 1, skin: 'b', turn: false }, FLOOR],
      ['delivery-rider', {}, FLOOR],
      ['delivery-rider', { from: 'behind' }, FLOOR],
      ['delivery-rider', { from: 'right' }, FLOOR],
      ['delivery-rider', { gag: true }, FLOOR],
      ['delivery-rider', { gag: 'phone', skin: 'a' }, FLOOR],
      ['seagull', {}, FLOOR],
      ['seagull', { perch: true }, FLOOR - 60],
      ['seagull', { gag: 'fries' }, FLOOR],
      ['seagull', { gag: 'sleep', flock: 3 }, FLOOR - 60],
      ['seagull', { flock: 5 }, FLOOR - 40],
      ['seagull', { flock: 2, enter: 'right' }, FLOOR - 40],
      ['handhaver', {}, FLOOR],
      ['handhaver', { enter: 'left', skin: 'c' }, FLOOR],
      ['handhaver', { hold: 60 }, FLOOR],
      ['boete-ticket', { facing: -1 }, FLOOR],
    ];
    for (const [id, p, y] of specs) {
      const tw = new TestWorld({ god: true, playerX: 100 });
      const e = tw.spawn(id, 260, p, y);
      expect(e.hasTag('placeholder'), id).toBe(false);
      tw.run(300);
      expect(tw.world.errors.map((x) => `${id} ${JSON.stringify(p)}: ${x.message}`)).toEqual([]);
    }
    // A flock spawns its members.
    const tw = new TestWorld({ god: true, playerX: 100 });
    tw.spawn('seagull', 260, { flock: 4 }, FLOOR - 40);
    tw.run(2);
    expect(tw.ofType('seagull').length).toBe(4);
  });

  it('every sprite is palette-only and has frames', () => {
    const ids = [...listSprites('enemy/fatbike-youth'), ...listSprites('enemy/delivery-rider'), ...listSprites('enemy/seagull/'), ...listSprites('enemy/handhaver'), ...listSprites('enemy/boete-ticket/')];
    expect(ids.length).toBeGreaterThan(100);
    for (const id of ids) {
      const frames = getFrames(id);
      expect(frames.length, id).toBeGreaterThan(0);
      for (const f of frames) {
        const d = f.buf.data;
        for (let i = 0; i < d.length; i++) if ((d[i] & 255) !== 0 && !inPalette(d[i])) throw new Error(`${id}: colour ${d[i].toString(16)} not in the palette`);
      }
    }
  });
});

describe('locals: fairness (GDD §4.11)', () => {
  for (const difficulty of ['normal', 'hard'] as const) {
    it.each(SCENES.map((s) => [`${s.id} ${JSON.stringify(s.params ?? {})}`, s] as const))(
      `${difficulty}: %s telegraphs at least 18 ticks on screen before every attack`,
      (_name, sc) => {
        const { tw } = scene(sc, difficulty);
        const w = watchFairness(tw, 800, FAIR);
        expect(w.attacks.length, 'it attacked').toBeGreaterThan(0);
        for (const a of w.attacks) {
          expect(a.prev, `${a.id} ${a.mode} after ${a.prev}`).toBe('tell');
          expect(a.tell, `${a.id} ${a.mode}`).toBeGreaterThanOrEqual(18);
          expect(a.tellInView, `${a.id} ${a.mode} tell on screen`).toBeGreaterThanOrEqual(18);
          expect(a.inView, `${a.id} ${a.mode} in view`).toBe(true);
        }
        for (const n of w.tells) expect(n).toBeGreaterThanOrEqual(18);
        expect(w.outsideShots).toBe(0);
        expect(tw.world.errors).toEqual([]);
      },
    );
  }

  it('gags are free time: a circling youth, a phoning rider and a sleeping gull far away do not attack', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4, width: 2000 });
    tw.spawn('fatbike-youth', 330, { gag: 'circles' });
    tw.spawn('seagull', 300, { perch: true }, FLOOR - 70);
    const w = watchFairness(tw, 240, FAIR);
    expect(w.attacks).toEqual([]);
    const tw2 = new TestWorld({ playerX: 100, god: true, seed: 4 });
    tw2.spawn('delivery-rider', 330, { gag: true });
    const w2 = watchFairness(tw2, 240, FAIR);
    expect(w2.attacks).toEqual([]);
  });
});

/** Run a rider scene with a mortal player; `jumpAt` presses jump that many ticks before the kick. */
function riderRun(id: string, params: Record<string, unknown>, jump: boolean, seed = 3): { deaths: number; kicks: number } {
  const tw = new TestWorld({ playerX: 100, god: false, seed });
  const r = tw.spawn(id, 300, params) as Rider;
  let deaths = 0;
  let kicks = 0;
  tw.world.events.on('playerDied', () => deaths++);
  let jumpT = -1;
  for (let t = 0; t < 260 && !r.removed; t++) {
    if (jump && r.mode === 'tell' && jumpT < 0) {
      // Jump so the feet are high (> 22 px) when the kick box is live.
      const left = (r as unknown as { telegraph: number }).telegraph - r.modeT;
      if (left <= 10 || id === 'delivery-rider') jumpT = t;
    }
    tw.hold(...(jumpT >= 0 && t - jumpT < 3 ? (['jump'] as const) : ([] as const)));
    tw.run(1);
    if (r.mode === 'kick' && r.modeT === 1) kicks++;
  }
  return { deaths, kicks };
}

describe('locals: the kick', () => {
  it('a fatbike kick hits a standing player', () => {
    const s = riderRun('fatbike-youth', { turn: false }, false);
    expect(s.kicks).toBeGreaterThan(0);
    expect(s.deaths).toBeGreaterThan(0);
  });

  it('a fatbike kick misses a jumping player', () => {
    const s = riderRun('fatbike-youth', { turn: false }, true);
    expect(s.kicks).toBeGreaterThan(0);
    expect(s.deaths).toBe(0);
  });

  it('a delivery kick hits a standing player and misses a jumping one', () => {
    const hit = riderRun('delivery-rider', {}, false);
    expect(hit.kicks).toBe(1);
    expect(hit.deaths).toBe(1);
    // He rings as soon as he is in view; the player jumps when he comes into kick reach.
    const tw = new TestWorld({ playerX: 100, god: false, seed: 3 });
    const r = tw.spawn('delivery-rider', 300) as DeliveryRider;
    let deaths = 0;
    let kicks = 0;
    let jumpT = -1;
    tw.world.events.on('playerDied', () => deaths++);
    for (let t = 0; t < 200 && !r.removed; t++) {
      if (jumpT < 0 && r.x - 100 < 50) jumpT = t;
      tw.hold(...(jumpT >= 0 && t - jumpT < 3 ? (['jump'] as const) : ([] as const)));
      tw.run(1);
      if (r.mode === 'kick' && r.modeT === 1) kicks++;
    }
    expect(deaths).toBe(0);
    expect(kicks + (r.mode === 'away' ? 1 : 0)).toBeGreaterThan(0);
  });

  it('bumping into a rider outside the kick is harmless', () => {
    const tw = new TestWorld({ playerX: 100, god: false, seed: 3 });
    let deaths = 0;
    tw.world.events.on('playerDied', () => deaths++);
    // A rider with a photo reaction rolls into the player without attacking.
    const r = tw.spawn('fatbike-youth', 104, { facing: -1 }) as FatbikeYouth;
    r.react('photo', 60);
    tw.run(50);
    expect(deaths).toBe(0);
  });

  it('a rider from behind tells on screen before it can hit', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const tw = new TestWorld({ playerX: 300, god: false, seed: 7, difficulty, width: 2000 });
      const r = tw.spawn('delivery-rider', 400, { from: 'behind' }) as DeliveryRider;
      expect(r.x).toBeLessThan(tw.world.camera.left);
      let firstDeath = -1;
      let tellOnScreen = 0;
      tw.world.events.on('playerDied', () => {
        if (firstDeath < 0) firstDeath = tellOnScreen;
      });
      for (let t = 0; t < 300 && !r.removed; t++) {
        tw.run(1);
        if (r.mode === 'tell' && r.onScreen(0)) tellOnScreen++;
      }
      expect(firstDeath, difficulty).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('locals: tickets and gulls', () => {
  it('the ticket flies at chest height: a crouch dodges it, a standing player is hit', () => {
    for (const crouch of [true, false]) {
      const tw = new TestWorld({ playerX: 100, god: false, seed: 2 });
      tw.spawn('handhaver', 240, { hold: 200 });
      let deaths = 0;
      let passed = 0;
      tw.world.events.on('playerDied', () => deaths++);
      for (let t = 0; t < 400; t++) {
        tw.hold(...(crouch ? (['down'] as const) : ([] as const)));
        tw.run(1);
        for (const e of tw.ofType('boete-ticket')) if (e.x < 80) passed++;
      }
      if (crouch) {
        expect(deaths).toBe(0);
        expect(passed).toBeGreaterThan(0);
      } else expect(deaths).toBeGreaterThan(0);
    }
  });

  it('never more than 2 tickets in the air per officer', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 2, difficulty: 'hard' });
    tw.spawn('handhaver', 250, { hold: 400 });
    let most = 0;
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      most = Math.max(most, tw.ofType('boete-ticket').length);
    }
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
  });

  it('a gull only hurts while diving', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 6 });
    tw.spawn('seagull', 200, { flock: 3 }, FLOOR - 30);
    let dives = 0;
    for (let t = 0; t < 700; t++) {
      tw.run(1);
      for (const e of tw.ofType('seagull') as Seagull[]) {
        if (e.contactDamage) expect(e.mode).toBe('dive');
        if (e.mode === 'dive') dives++;
      }
    }
    expect(dives).toBeGreaterThan(0);
  });

  it('a perched gull wakes within 96 px and is harmless while perched', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 6 });
    const g = tw.spawn('seagull', 300, { perch: true }, FLOOR - 50) as Seagull;
    tw.run(60);
    expect(g.mode).toBe('gag');
    expect(g.contactDamage).toBeNull();
    tw.hold('right');
    tw.until(() => g.mode !== 'gag', 300);
    expect(Math.abs(tw.player!.x - g.x)).toBeLessThanOrEqual(100);
  });

  it('kills: score, death strip, the delivery rider drops food, the handhaver scatters tickets', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const d = tw.spawn('delivery-rider', 200) as DeliveryRider;
    const h = tw.spawn('handhaver', 260) as Handhaver;
    const y = tw.spawn('fatbike-youth', 320) as FatbikeYouth;
    for (const e of [d, h, y]) tw.world.damage(e, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(1);
    expect(tw.session.slot(0)?.score).toBe(200 + 300 + 300);
    expect(d.playing('die') && h.playing('die') && y.playing('die-seat')).toBe(true); // anim wave: the youth falls off the seat
    tw.run(10);
    expect(tw.ofType('pickup-food').length).toBe(1);
    tw.run(200);
    expect(tw.world.errors).toEqual([]);
  });

  it("a pair's passenger jumps off and runs away from the player when the pair dies", () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const y = tw.spawn('fatbike-youth', 240, { pair: true, gag: true }) as FatbikeYouth;
    tw.world.damage(y, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(1);
    const fx = tw.world.entities.filter((e): e is FxEntity => e instanceof FxEntity && e.sprite.endsWith('/passenger-flee'));
    expect(fx.length).toBe(1);
    expect(hasSprite(fx[0].sprite)).toBe(true);
    const x0 = fx[0].x;
    tw.run(20);
    expect(fx[0].x).toBeGreaterThan(x0 + 20);
    expect(tw.world.errors).toEqual([]);
  });
});

describe('delivery-rider backpack logo', () => {
  it('is mirror-symmetric, so it never reads backwards when the rider faces left', () => {
    for (const open of [false, true]) {
      const b = cubePack(open);
      const y = open ? 8 : 7;
      for (let row = y; row < y + 4; row++) {
        for (let x = 2; x <= 12; x++) expect(b.get(x, row), `open ${open} (${x}, ${row})`).toBe(b.get(14 - x, row));
      }
    }
  });
});
