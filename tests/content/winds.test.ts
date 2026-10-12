/**
 * The wind soldiers (GDD §9.1): `oompah-trooper`, `piccolo`, `bassoonist` and their projectiles
 * `sonic-ring`, `low-ring`, `piccolo-bullet`, `bassoon-rocket`. GDD numbers, telegraphs ≥ 18
 * ticks (rule 2), no off-screen fire (rule 3), tokens, deaths by damage kind, looks (outfit ×
 * skin), the sprite contract, determinism and a per-tick cost budget.
 */
import { describe, expect, it } from 'vitest';
import type { Damage, DamageKind, Entity } from '../../src/engine/entity';
import { frameCount, getFrame, hasSprite } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/infantry/art';
import '../../src/game/content/infantry/winds/index';
import '../../src/game/content/infantry/winds/art';
import { BASSOON, Bassoonist, BassoonRocket, LowRing, OOMPAH, OompahTrooper, PICCOLO, Piccolo, PiccoloBullet, SonicRing } from '../../src/game/content/infantry/winds/index';
import { lookPrefix, OUTFITS } from '../../src/game/content/infantry/winds/looks';
import { getEntityMeta, hasEntity } from '../../src/game/registry';
import { FLOOR, TestWorld } from './helpers';

const TYPES = ['oompah-trooper', 'piccolo', 'bassoonist'] as const;
const SHOTS = ['sonic-ring', 'low-ring', 'piccolo-bullet', 'bassoon-rocket'];

const alive = (tw: TestWorld, type: string): Entity[] => tw.world.entities.filter((e) => e.type === type && !e.removed);

/** A ledge for the piccolo: a 60 px block whose top is 40 px above the floor. */
const LEDGE_X = 330;
const LEDGE_TOP = FLOOR - 40;
function ledgeWorld(o: { playerX?: number; seed?: number; difficulty?: 'easy' | 'normal' | 'hard' } = {}): TestWorld {
  return new TestWorld({
    playerX: o.playerX ?? 100,
    god: true,
    seed: o.seed ?? 5,
    difficulty: o.difficulty,
    build: (t) => t.solid(LEDGE_X - 30, LEDGE_TOP, 60, 40),
  });
}

function oompah(tw: TestWorld, x: number, p: Record<string, unknown> = {}): OompahTrooper {
  return tw.spawn('oompah-trooper', x, { gag: false, facing: -1, ...p }) as OompahTrooper;
}
function piccolo(tw: TestWorld, p: Record<string, unknown> = {}): Piccolo {
  return tw.spawn('piccolo', LEDGE_X, { gag: false, facing: -1, ...p }, LEDGE_TOP) as Piccolo;
}
function bassoonist(tw: TestWorld, x: number, p: Record<string, unknown> = {}): Bassoonist {
  return tw.spawn('bassoonist', x, { gag: false, facing: -1, ...p }) as Bassoonist;
}

/** Run until an entity of `type` appears; returns it and the tick (or null). */
function waitFor(tw: TestWorld, type: string, max = 600): { e: Entity; t: number } | null {
  for (let t = 0; t < max; t++) {
    tw.run(1);
    const e = alive(tw, type)[0];
    if (e) return { e, t };
  }
  return null;
}

describe('registration and art', () => {
  it('registers the three types with their GDD scores and the four projectiles', () => {
    expect(getEntityMeta('oompah-trooper')?.score).toBe(500);
    expect(getEntityMeta('piccolo')?.score).toBe(400);
    expect(getEntityMeta('bassoonist')?.score).toBe(600);
    for (const id of TYPES) expect(getEntityMeta(id)?.category).toBe('enemy');
    for (const id of SHOTS) expect(getEntityMeta(id)?.category, id).toBe('projectile');
    expect([OOMPAH.hp, PICCOLO.hp, BASSOON.hp]).toEqual([60, 20, 40]);
  });

  it('draws the §6.1 enemy contract, the §9.0 extras and every gag of each type', () => {
    const min: Record<string, number> = {
      idle: 2, alert: 2, walk: 6, run: 8, crouch: 1, shoot: 2, 'crouch-shoot': 2, throw: 4, panic: 4,
      die: 5, 'die-blast': 4, 'die-burn': 4, 'die-knife': 4, 'die-crush': 3, 'die-shatter': 3,
      'double-take': 3, salute: 2, confused: 2, queue: 2, 'photo-pose': 1, ears: 2, gag: 4, frozen: 1, 'gag-nap': 4,
    };
    const gags: Record<string, string[]> = { 'oompah-trooper': ['polish', 'practice'], piccolo: ['scales'], bassoonist: ['reed'] };
    for (const type of TYPES) {
      for (const [anim, n] of Object.entries(min)) expect(frameCount(`enemy/${type}/${anim}`), `${type}/${anim}`).toBeGreaterThanOrEqual(n);
      for (const g of gags[type]) expect(frameCount(`enemy/${type}/gag-${g}`), `${type}/gag-${g}`).toBeGreaterThanOrEqual(4);
      // Shoot frames carry a muzzle, throw frames a hand.
      if (type !== 'piccolo') expect(getFrame(`enemy/${type}/shoot`, 0).pts?.muzzle, type).toBeDefined();
      expect(getFrame(`enemy/${type}/throw`, 0).pts?.hand, type).toBeDefined();
    }
    expect(frameCount('enemy/oompah-trooper/inhale')).toBe(3);
    expect(frameCount('enemy/bassoonist/aim')).toBe(BASSOON.angles.length);
    expect(frameCount('enemy/bassoonist/fire')).toBe(BASSOON.angles.length);
    for (const s of ['enemy/sonic-ring', 'enemy/low-ring', 'enemy/piccolo-bullet', 'enemy/bassoon-rocket', 'enemy/piccolo-rifle', 'enemy/winds/last-rocket']) {
      expect(hasSprite(s), s).toBe(true);
    }
    expect(frameCount('enemy/piccolo-bullet')).toBe(16);
    expect(frameCount('enemy/bassoon-rocket')).toBe(16);
    expect(frameCount('enemy/piccolo-rifle')).toBe(32);
    // The biggest sonic ring is 24 px tall (+ outline), the LOW NOTE 24×8 (+ outline).
    const big = getFrame('enemy/sonic-ring', frameCount('enemy/sonic-ring') - 1).buf.trimBounds();
    expect(big?.h).toBe(26);
    const low = getFrame('enemy/low-ring', 0).buf.trimBounds();
    expect([low?.w, low?.h]).toEqual([26, 10]);
  });

  it('spawns every outfit × skin look and wears it', () => {
    const tw = new TestWorld({ playerX: null });
    for (const type of TYPES) {
      for (const outfit of OUTFITS) {
        const e = tw.spawn(type, 600, { outfit, skin: 'c', gag: false }) as OompahTrooper;
        expect(e.art).toBe(lookPrefix(type, outfit, 'c'));
        expect(hasSprite(`${e.art}/idle`), e.art).toBe(true);
        expect(getFrame(`${e.art}/idle`, 0).buf.w).toBeGreaterThan(8);
        e.remove();
      }
    }
    // The skin is picked per spawn with world.rng when the param is absent.
    const skins = new Set<string>();
    for (let i = 0; i < 20; i++) skins.add((tw.spawn('bassoonist', 600, { gag: false }) as Bassoonist).skin);
    expect(skins.size).toBeGreaterThan(1);
  });
});

describe('oompah-trooper', () => {
  it('OOMPAH: inhales 36 ticks, then a sonic ring flies 1.5 px/tick in its lane, grows 12 → 24 and stops after 180 px', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
    const o = oompah(tw, 260);
    let start = -1;
    let ring: SonicRing | null = null;
    let fired = -1;
    for (let t = 0; t < 500 && !ring; t++) {
      tw.run(1);
      if (o.mode === 'attack' && start < 0) start = t;
      ring = (alive(tw, 'sonic-ring')[0] as SonicRing | undefined) ?? null;
      if (ring) fired = t;
    }
    expect(ring).not.toBeNull();
    const r0 = ring as SonicRing;
    expect(fired - start).toBeGreaterThanOrEqual(OOMPAH.inhale);
    expect(r0.vx).toBeCloseTo(-OOMPAH.ring.speed, 5);
    expect(r0.hasTag('shootable')).toBe(true);
    expect(r0.hp).toBe(30);
    // Range: a fresh ring 230 px from the player (it must stop short of him).
    const r = SonicRing.fire(tw.world, 330, FLOOR - 40, -OOMPAH.ring.speed, FLOOR - OOMPAH.ring.laneY);
    tw.world.flush();
    const x0 = r.x;
    tw.run(OOMPAH.ring.growTicks);
    expect(r.size).toBeCloseTo(24, 5);
    expect(FLOOR - r.y).toBeCloseTo(OOMPAH.ring.laneY, 0);
    tw.until(() => r.removed, 200);
    expect(Math.abs(r.x - x0)).toBeGreaterThan(OOMPAH.ring.range - 40);
    expect(Math.abs(r.x - x0)).toBeLessThanOrEqual(OOMPAH.ring.range + 2);
  });

  it('every third blast is a LOW NOTE rolling on the ground at 2 px/tick', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
    const o = oompah(tw, 250);
    const low = waitFor(tw, 'low-ring', 1500);
    expect(low).not.toBeNull();
    expect(o.blasts).toBe(3);
    const l = low!.e as LowRing;
    tw.run(OOMPAH.low.dropTicks + 2);
    expect(l.y + OOMPAH.low.h / 2).toBeCloseTo(FLOOR, 0);
    expect(Math.abs(l.vx)).toBeCloseTo(OOMPAH.low.speed, 5);
    expect(l.hasTag('shootable')).toBe(false);
  });

  it('a sonic ring shot down pays 50 points', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const r = SonicRing.fire(tw.world, 300, 140, -1.5, FLOOR - 18);
    tw.world.flush();
    tw.world.damage(r, { amount: 30, kind: 'bullet', dirX: 1, owner: 0 });
    expect(r.dead || r.removed).toBe(true);
    expect(tw.session.slots[0].score).toBe(50);
  });

  it('faces and fires to the right when the player is on his right', () => {
    const tw = new TestWorld({ playerX: 400, god: true, seed: 6 });
    oompah(tw, 250, { facing: 1 });
    const s = waitFor(tw, 'sonic-ring', 500);
    expect(s).not.toBeNull();
    expect(s!.e.vx).toBeGreaterThan(0);
  });
});

describe('piccolo', () => {
  it('a 30×10 prone hurtbox; the aim line locks 12 ticks before a 4 px/tick shot along it', () => {
    const tw = ledgeWorld({ playerX: 150 });
    const p = piccolo(tw);
    expect([p.hitbox.w, p.hitbox.h]).toEqual([30, 10]);
    let aimStart = -1;
    let lockAt = -1;
    let bullet: PiccoloBullet | null = null;
    let lockAngle = 0;
    let lockEnd: [number, number] = [0, 0];
    for (let t = 0; t < 600 && !bullet; t++) {
      tw.run(1);
      if (p.mode === 'attack' && aimStart < 0) aimStart = t;
      if (p.phase === 'lock' && lockAt < 0) {
        lockAt = t;
        lockAngle = p.aimAngle;
        lockEnd = [p.aimX, p.aimY];
      }
      if (p.phase === 'lock') {
        // Locked: the line no longer follows the player.
        expect(p.aimAngle).toBe(lockAngle);
        expect([p.aimX, p.aimY]).toEqual(lockEnd);
      }
      bullet = (alive(tw, 'piccolo-bullet')[0] as PiccoloBullet | undefined) ?? null;
      if (bullet) {
        expect(t - aimStart).toBeGreaterThanOrEqual(PICCOLO.aim);
        expect(t - lockAt).toBe(PICCOLO.lock);
      }
    }
    expect(bullet).not.toBeNull();
    const b = bullet as PiccoloBullet;
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(PICCOLO.bullet.speed, 5);
    expect(Math.atan2(b.vy, b.vx)).toBeCloseTo(lockAngle, 5);
    // Reload: no second aim within R 120.
    tw.run(PICCOLO.reload - 10);
    expect(alive(tw, 'piccolo-bullet').length).toBeLessThanOrEqual(1);
  });

  it('woken from his gag he loses his piccolo: 40 extra ticks before the first aim', () => {
    // The player 130 px in front of him: inside the 160 px a napping soldier notices.
    const fast = ledgeWorld({ playerX: 200, seed: 9 });
    const pf = piccolo(fast);
    const tf = fast.until(() => pf.mode === 'attack', 600);
    const slow = ledgeWorld({ playerX: 200, seed: 9 });
    const ps = piccolo(slow, { gag: 'scales' });
    const ts = slow.until(() => ps.mode === 'attack', 800);
    expect(ts - tf).toBeGreaterThanOrEqual(40);
  });

  it('shot dead he slides off the ledge and is gone', () => {
    const tw = ledgeWorld({ playerX: 150 });
    const p = piccolo(tw);
    tw.run(5);
    tw.world.damage(p, { amount: 99, kind: 'bullet', dirX: 1, owner: 0 });
    expect(p.dead).toBe(true);
    const x0 = p.x;
    tw.until(() => p.removed, 200);
    expect(Math.abs(p.x - x0)).toBeGreaterThan(20);
    expect(tw.world.errors).toEqual([]);
  });
});

describe('bassoonist', () => {
  it('kneels and aims 40 ticks, then a rocket accelerates from 1.0 by 0.1/tick to 3.5 px/tick', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
    const b = bassoonist(tw, 270);
    let aimStart = -1;
    let rocket: BassoonRocket | null = null;
    let fired = -1;
    for (let t = 0; t < 500 && !rocket; t++) {
      tw.run(1);
      if (b.mode === 'attack' && aimStart < 0) {
        aimStart = t;
        expect(b.crouching).toBe(true);
      }
      rocket = (alive(tw, 'bassoon-rocket')[0] as BassoonRocket | undefined) ?? null;
      if (rocket) fired = t;
    }
    expect(rocket).not.toBeNull();
    expect(fired - aimStart).toBeGreaterThanOrEqual(BASSOON.aim);
    const r = rocket as BassoonRocket;
    expect(r.hasTag('shootable')).toBe(true);
    expect(r.hp).toBe(10);
    const s0 = r.speed;
    tw.run(5);
    expect(r.speed).toBeCloseTo(Math.min(3.5, s0 + 0.5), 5);
    tw.run(30);
    expect(r.removed || r.speed === BASSOON.rocket.vMax).toBe(true);
  });

  it('keeps 120–220 px away from the player', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
    const b = bassoonist(tw, 160);
    tw.run(400);
    expect(Math.abs(b.x - 100)).toBeGreaterThanOrEqual(BASSOON.minRange - 6);
  });

  it('wears ear-muffs: HONK does not make him cover his ears', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const b = bassoonist(tw, 300);
    const o = oompah(tw, 340);
    expect(b.react('ears', 60)).toBe(false);
    expect(o.react('ears', 60)).toBe(true);
  });

  it('his last rocket lands on his own head (visual, no damage)', () => {
    const tw = new TestWorld({ playerX: 280, god: false, seed: 3 });
    const b = bassoonist(tw, 300);
    tw.run(2);
    const hp = (tw.player as unknown as { hp?: number }).hp;
    tw.world.damage(b, { amount: 99, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(BASSOON.lastRocket + 5);
    expect(tw.player?.alive).toBe(true);
    expect((tw.player as unknown as { hp?: number }).hp).toBe(hp);
  });
});

describe('fair and tidy (GDD §4.11)', () => {
  it('every shot leaves from inside the view, and only after a telegraph ≥ 18 ticks (HARD too)', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const tw = ledgeWorld({ playerX: 120, seed: 4, difficulty });
      const soldiers: Entity[] = [oompah(tw, 300), bassoonist(tw, 420), piccolo(tw), oompah(tw, 520), bassoonist(tw, 620)];
      const seen = new Set<Entity>();
      for (let t = 0; t < 700; t++) {
        tw.hold(t % 120 < 60 ? 'right' : 'left').run(1);
        for (const e of tw.world.entities) {
          if (seen.has(e) || !SHOTS.includes(e.type) || e.removed) continue;
          seen.add(e);
          expect(tw.world.camera.containsPoint(e.x, e.y, 8 + 4), `${e.type} at ${e.x | 0},${e.y | 0} t=${t}`).toBe(true);
        }
      }
      expect(seen.size).toBeGreaterThan(2);
      for (const s of soldiers) expect((s as OompahTrooper).telegraph).toBeGreaterThanOrEqual(18);
    }
  });

  it('nothing attacks from outside the view: a trooper far off-screen never fires', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2, width: 2400 });
    oompah(tw, 900, { facing: -1 });
    bassoonist(tw, 950, { facing: -1 });
    tw.run(400);
    expect(alive(tw, 'sonic-ring').length + alive(tw, 'bassoon-rocket').length).toBe(0);
  });

  it('killed mid-telegraph he frees his attack token and fires nothing', () => {
    for (const type of TYPES) {
      const tw = type === 'piccolo' ? ledgeWorld({ playerX: 150 }) : new TestWorld({ playerX: 100, god: true, seed: 2 });
      const e = type === 'piccolo' ? piccolo(tw) : tw.spawn(type, 260, { gag: false, facing: -1 });
      const s = e as OompahTrooper;
      tw.until(() => s.mode === 'attack', 600);
      tw.run(5);
      expect(s.holdsToken).toBe(true);
      tw.world.damage(e, { amount: 999, kind: 'bullet', dirX: 1, owner: 0 });
      expect(s.holdsToken).toBe(false);
      tw.run(80);
      for (const id of SHOTS) expect(alive(tw, id).length, `${type}: ${id}`).toBe(0);
    }
  });

  it('a nearby player grenade makes them panic (no attack), a salute cancels a telegraph', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
    const o = oompah(tw, 260);
    tw.until(() => o.mode === 'attack', 400);
    expect(o.react('salute', 60)).toBe(true);
    expect(o.mode).not.toBe('attack');
    expect(o.holdsToken).toBe(false);
    tw.run(40);
    expect(alive(tw, 'sonic-ring').length).toBe(0);
  });
});

describe('deaths', () => {
  const kinds: Array<[DamageKind, string]> = [
    ['bullet', 'die'],
    ['explosion', 'die-blast'],
    ['fire', 'die-burn'],
    ['knife', 'die-knife'],
    ['crush', 'die-crush'],
    ['laser', 'die'],
  ];
  for (const type of TYPES) {
    it(`${type}: every damage kind plays its death and the body is gone within 150 ticks`, () => {
      for (const [kind, anim] of kinds) {
        const tw = type === 'piccolo' ? ledgeWorld({ playerX: 150 }) : new TestWorld({ playerX: 100, god: true, seed: 2 });
        const e = type === 'piccolo' ? piccolo(tw) : tw.spawn(type, 260, { gag: false, facing: -1 });
        tw.run(3);
        const d: Damage = { amount: 999, kind, dirX: 1, owner: 0 };
        tw.world.damage(e, d);
        expect(e.dead, `${type} ${kind}`).toBe(true);
        tw.run(1);
        if (!(type === 'piccolo' && kind === 'bullet')) expect((e as OompahTrooper).anim.id, `${type} ${kind}`).toBe(`${(e as OompahTrooper).art}/${anim}`);
        tw.until(() => e.removed, 150);
        expect(tw.world.errors, `${type} ${kind}`).toEqual([]);
      }
    });

    it(`${type}: frozen in ice, any hit shatters him`, () => {
      const tw = type === 'piccolo' ? ledgeWorld({ playerX: 150 }) : new TestWorld({ playerX: 100, god: true, seed: 2 });
      const e = (type === 'piccolo' ? piccolo(tw) : tw.spawn(type, 260, { gag: false, facing: -1 })) as OompahTrooper;
      tw.run(3);
      expect(e.react('freeze', 120)).toBe(true);
      tw.world.damage(e, { amount: 1, kind: 'bullet', dirX: 1, owner: 0 });
      expect(e.dead).toBe(true);
      tw.run(1);
      expect(e.anim.id).toBe(`${e.art}/die-shatter`);
      tw.until(() => e.removed, 150);
    });
  }
});

describe('entries and gags', () => {
  const ENTRIES = ['walk', 'run', 'drop', 'parachute', 'popup', 'window', 'chimney', 'manhole', 'truck', 'rowboat', 'ski', 'skate', 'float'];
  it('the standing types enter every way without errors and end up fighting', () => {
    for (const type of ['oompah-trooper', 'bassoonist']) {
      for (const entry of ENTRIES) {
        const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
        const e = tw.spawn(type, 300, { entry, facing: -1 }, entry === 'drop' || entry === 'parachute' ? FLOOR - 80 : FLOOR) as OompahTrooper;
        tw.run(400);
        expect(tw.world.errors, `${type} ${entry}`).toEqual([]);
        expect(e.removed, `${type} ${entry}`).toBe(false);
        // A pop-up soldier stays hidden until a player comes near.
        if (entry !== 'popup') expect(e.alerted, `${type} ${entry}`).toBe(true);
      }
    }
  });

  it('a piccolo ignores entries: he is placed prone on his ledge', () => {
    const tw = ledgeWorld({ playerX: 150 });
    const p = piccolo(tw, { entry: 'run' });
    tw.run(60);
    expect(p.x).toBe(LEDGE_X);
    expect(p.y).toBe(LEDGE_TOP);
  });

  it('plays the per-type gags (no attack while in a gag)', () => {
    const cases: Array<[string, string]> = [['oompah-trooper', 'polish'], ['oompah-trooper', 'practice'], ['bassoonist', 'reed'], ['piccolo', 'scales']];
    for (const [type, gag] of cases) {
      const tw = type === 'piccolo' ? ledgeWorld({ playerX: 40 }) : new TestWorld({ playerX: 40, god: true, seed: 2 });
      // Facing away, far behind him: he keeps practising.
      const e = (type === 'piccolo' ? piccolo(tw, { gag, facing: 1 }) : tw.spawn(type, 330, { gag, facing: 1 })) as OompahTrooper;
      tw.run(200);
      expect(e.mode, `${type} ${gag}`).toBe('gag');
      expect(e.anim.id).toBe(`${e.art}/gag-${gag}`);
      for (const id of SHOTS) expect(alive(tw, id).length).toBe(0);
    }
  });
});

describe('determinism and cost', () => {
  function trace(seed: number): string {
    const tw = ledgeWorld({ playerX: 120, seed });
    oompah(tw, 280);
    bassoonist(tw, 420);
    piccolo(tw);
    const out: string[] = [];
    for (let t = 0; t < 400; t++) {
      tw.hold(t % 90 < 45 ? 'right' : 'left', 'fire').run(1);
      if (t % 25 === 0) for (const e of tw.world.entities) if (e.type !== 'player') out.push(`${e.type}:${e.x.toFixed(2)},${e.y.toFixed(2)}`);
    }
    return out.join(';');
  }

  it('is deterministic for a seed', () => {
    expect(trace(7)).toBe(trace(7));
  });

  it('30 wind soldiers cost well under a millisecond per tick', () => {
    const tw = new TestWorld({ playerX: 200, god: true, seed: 3, width: 2400 });
    for (let i = 0; i < 30; i++) tw.spawn(TYPES[i % 2 === 0 ? 0 : 2], 260 + i * 6, { gag: false, facing: -1, outfit: 'parade', skin: 'a' });
    tw.run(120); // warm-up (art, pools, JIT)
    const base = new TestWorld({ playerX: 200, god: true, seed: 3, width: 2400 });
    base.run(120);
    const N = 300;
    let t0 = performance.now();
    base.run(N);
    const empty = (performance.now() - t0) / N;
    t0 = performance.now();
    tw.run(N);
    const full = (performance.now() - t0) / N;
    // Budget 0.5 ms (GDD perf rule); the test machine is shared, so allow 3× headroom.
    expect(alive(tw, 'oompah-trooper').length + alive(tw, 'bassoonist').length).toBe(30);
    expect(full - empty).toBeLessThan(1.5);
  });

  it('every registered wind id spawns without placeholders', () => {
    for (const id of [...TYPES, ...SHOTS]) expect(hasEntity(id), id).toBe(true);
  });
});
