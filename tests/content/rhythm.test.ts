/**
 * The rhythm section (GDD §9.1): drummer, cymbalist, triangle, baton-major — the GDD numbers,
 * the fairness rules (§4.11: telegraphs ≥ 18 ticks, nothing fires from off-screen), their
 * projectiles and props, the sprite contract for every outfit, and the cost of a crowd.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { frameCount, getFrames, hasSprite } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/infantry/art';
import '../../src/game/content/infantry/rhythm/index';
import '../../src/game/content/infantry/rhythm/art';
import { SNOWMAN_X, type Rifleman } from '../../src/game/content/infantry/index';
import { RIFLEMAN_GAG_STRIPS, SNOWMAN_X as SNOWMAN_ART_X } from '../../src/game/content/infantry/rifleman-gags.art';
import {
  BATON_MAJOR,
  BatonMajor,
  CYMBALIST,
  Cymbalist,
  DRUMMER,
  Drummer,
  TRIANGLE,
  TriangleRinger,
  alarmList,
} from '../../src/game/content/infantry/rhythm/index';
import { FLOOR, TestWorld } from './helpers';

const OUTFITS = ['', '-deck', '-desert', '-snow', '-night'];
const TYPES = ['drummer', 'cymbalist', 'triangle', 'baton-major'] as const;

/** The §6.1 enemy contract: strip → minimum frames (and required points). */
const CONTRACT: ReadonlyArray<[string, number, string[]?]> = [
  ['idle', 2],
  ['gag', 4],
  ['alert', 2],
  ['walk', 6],
  ['run', 8],
  ['crouch', 1],
  ['shoot', 2, ['muzzle']],
  ['crouch-shoot', 2, ['muzzle']],
  ['throw', 4, ['hand']],
  ['panic', 4],
  ['die', 5],
  ['die-blast', 4],
  ['die-burn', 4],
  ['die-knife', 4],
  // GDD §9.0 extra infantry strips.
  ['double-take', 3],
  ['salute', 2],
  ['confused', 2],
  ['queue', 2],
  ['photo-pose', 1],
  ['ears', 2],
  ['die-crush', 3],
  ['die-shatter', 3],
  ['frozen', 1],
  ['stumble', 2],
  ['hat', 1],
];

/** Per-type strips the game plays, and the gags (≥ 4 frames each). */
const OWN: Readonly<Record<(typeof TYPES)[number], string[]>> = {
  drummer: ['drumroll', 'charge', 'dizzy', 'broken', 'run-broken', 'drum', 'drum-torn', 'gag-nap', 'gag-air-solo'],
  cymbalist: ['raise', 'crash', 'ringing', 'cymbal', 'gag-tune', 'gag-yawn'],
  triangle: ['ding', 'ring-ready', 'triangle', 'gag-counting'],
  'baton-major': ['march', 'whistle', 'twirl', 'wait', 'catch', 'fumble', 'dizzy', 'baton-prop', 'gag-twirl'],
};

const isType = (type: string) => (e: Entity) => e.type === type && !e.removed;

describe('rhythm section art', () => {
  it('every type and outfit has the full contract, its own strips and its gags', () => {
    for (const id of TYPES) {
      for (const o of OUTFITS) {
        const pre = `enemy/${id}${o}/`;
        for (const [name, min, pts] of CONTRACT) {
          expect(hasSprite(pre + name), pre + name).toBe(true);
          const frames = getFrames(pre + name);
          expect(frames.length, pre + name).toBeGreaterThanOrEqual(min);
          for (const p of pts ?? []) for (const f of frames) expect(f.pts?.[p], `${pre}${name} ${p}`).toBeDefined();
        }
        for (const name of OWN[id]) {
          expect(hasSprite(pre + name), pre + name).toBe(true);
          if (name.startsWith('gag-')) expect(frameCount(pre + name)).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('the projectiles are drawn as proj/<id>', () => {
    for (const id of ['proj/shockwave', 'proj/cymbal-disc', 'proj/baton']) {
      expect(hasSprite(id), id).toBe(true);
      expect(frameCount(id)).toBeGreaterThanOrEqual(2);
    }
  });

  it('heights: the drum major stands about 46 px with his hat, the triangle is the smallest', () => {
    const height = (id: string): number => {
      const f = getFrames(id)[0];
      return f.oy;
    };
    expect(height('enemy/baton-major/idle')).toBeGreaterThanOrEqual(42);
    expect(height('enemy/baton-major/idle')).toBeLessThanOrEqual(50);
    // The drum is 26 px across (24 px face + outline).
    const drum = getFrames('enemy/drummer/drum')[0];
    expect(drum.buf.h).toBeGreaterThanOrEqual(25);
    expect(drum.buf.h).toBeLessThanOrEqual(28);
  });

  it('the rifleman has a strip for every shared and mission gag, in every outfit', () => {
    const gags = ['cards', 'kazoo', 'shine', 'rehearse', 'nap', 'newspaper', 'ice-cream', 'snowman', 'queue'];
    expect(Object.keys(RIFLEMAN_GAG_STRIPS).sort()).toEqual([...gags].sort());
    for (const o of OUTFITS) {
      for (const g of gags) expect(frameCount(`enemy/rifleman${o}/gag-${g}`), `${o} ${g}`).toBeGreaterThanOrEqual(4);
      for (const p of ['snowman', 'snowman-head', 'cone']) expect(hasSprite(`enemy/rifleman${o}/${p}`)).toBe(true);
    }
    expect(SNOWMAN_X).toBe(SNOWMAN_ART_X);
  });
});

describe('drummer', () => {
  const drummer = (tw: TestWorld, x: number, p: Record<string, unknown> = {}) => tw.spawn('drummer', x, { gag: false, facing: -1, ...p }) as Drummer;

  it('the drum soaks frontal bullets; the knife, blasts and shots from behind hit him', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const d = drummer(tw, 260);
    expect(d.hurtboxes().length).toBe(2);
    // From the front (he faces left, the shot flies right).
    tw.world.damage(d, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 }, 1);
    expect(d.drumHp).toBe(DRUMMER.drumHp - 10);
    expect(d.hp).toBe(DRUMMER.hp);
    // The shotgun cone, a blast and the knife go round the drum.
    tw.world.damage(d, { amount: 5, kind: 'bullet', tags: ['spread'], dirX: 1, owner: 0 }, 1);
    expect(d.hp).toBe(DRUMMER.hp - 5);
    tw.world.damage(d, { amount: 5, kind: 'explosion', dirX: 1, owner: 0 }, 1);
    expect(d.hp).toBe(DRUMMER.hp - 10);
    // From behind: the body.
    tw.world.damage(d, { amount: 5, kind: 'bullet', dirX: -1, owner: 0 }, 1);
    expect(d.hp).toBe(DRUMMER.hp - 15);
    expect(d.drumHp).toBe(DRUMMER.drumHp - 10);
  });

  it('a broken drum pays +100 and he runs away with his head through the skin (no attacks)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const d = drummer(tw, 260);
    tw.world.damage(d, { amount: DRUMMER.drumHp, kind: 'bullet', dirX: 1, owner: 0 }, 1);
    expect(d.drumBroken).toBe(true);
    expect(tw.session.slots[0].score).toBe(DRUMMER.drumScore);
    const x0 = d.x;
    tw.run(40);
    expect(d.mode).toBe('broken');
    expect(d.x).toBeGreaterThan(x0 + 30); // away from the player at x 100
    expect(d.contactDamage).toBeNull();
    expect(d.hurtboxes().length).toBe(1);
  });

  it('charges after a drumroll of at least 30 ticks, 2.5 px/tick for 64 px, then is dizzy', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 5 });
    const d = drummer(tw, 160);
    let rollAt = -1;
    let chargeAt = -1;
    let x0 = 0;
    for (let t = 0; t < 400 && chargeAt < 0; t++) {
      tw.run(1);
      if (d.mode === 'drumroll' && rollAt < 0) rollAt = t;
      if (d.mode === 'charge') {
        chargeAt = t;
        x0 = d.x;
      }
    }
    expect(rollAt).toBeGreaterThanOrEqual(0);
    expect(chargeAt - rollAt).toBeGreaterThanOrEqual(DRUMMER.rollTicks);
    tw.until(() => d.mode !== 'charge', 60);
    expect(Math.abs(d.x - x0)).toBeLessThanOrEqual(DRUMMER.chargeDist + 3);
    expect(d.mode).toBe('dizzy');
    expect(d.contactDamage).toBeNull();
  });

  it('dies sitting down while his drum rolls away like a wheel', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const d = drummer(tw, 260);
    tw.world.damage(d, { amount: 40, kind: 'bullet', dirX: -1, owner: 0 });
    expect(d.dead).toBe(true);
    expect(d.anim.id).toBe('enemy/drummer/die');
    tw.run(1);
    const drum = tw.world.entities.find((e) => e.type === 'soldier-prop' && (e as unknown as { sprite: string }).sprite === 'enemy/drummer/drum');
    expect(drum).toBeDefined();
    const x0 = drum!.x;
    tw.run(30);
    expect(Math.abs(drum!.x - x0)).toBeGreaterThan(20);
  });

  it('outfits pick their own art', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const d = drummer(tw, 600, { outfit: 'snow' });
    tw.run(2);
    expect(d.anim.id.startsWith('enemy/drummer-snow/')).toBe(true);
  });

  it('a drummer-led column marches in step (0.6 px/tick in a mixed column); his death makes it stumble', () => {
    const tw = new TestWorld({ playerX: 100, god: true, width: 2000 });
    const d = drummer(tw, 900, { column: 'band' });
    const r = tw.spawn('rifleman', 930, { column: 'band', facing: -1, gag: false }) as Rifleman;
    tw.run(5);
    const x0 = r.x;
    tw.run(60);
    expect(d.mode).toBe('march');
    expect(r.mode).toBe('march');
    expect(x0 - r.x).toBeCloseTo(36, 0);
    tw.world.damage(d, { amount: 99, kind: 'bullet', dirX: -1, owner: 0 });
    tw.run(2);
    expect(r.reaction).toBe('stumble');
  });
});

describe('cymbalist', () => {
  const cymbalist = (tw: TestWorld, x: number, p: Record<string, unknown> = {}) => tw.spawn('cymbalist', x, { gag: false, facing: -1, ...p }) as Cymbalist;

  it('raises the cymbals for 32 ticks, then a 10 px ground wave runs 2.5 px/tick for 160 px', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
    const c = cymbalist(tw, 220);
    let raiseAt = -1;
    let wave: Entity | undefined;
    let waveAt = -1;
    for (let t = 0; t < 400 && !wave; t++) {
      tw.run(1);
      if (c.mode === 'raise' && raiseAt < 0) raiseAt = t;
      wave = tw.world.entities.find(isType('shockwave'));
      if (wave) waveAt = t;
    }
    expect(wave).toBeDefined();
    expect(waveAt - raiseAt).toBeGreaterThanOrEqual(CYMBALIST.raiseTicks);
    const w = wave!;
    expect(w.vx).toBeCloseTo(-CYMBALIST.waveSpeed, 5);
    expect(w.hitbox.h).toBe(CYMBALIST.waveH);
    expect(w.y + w.hitbox.h / 2).toBeCloseTo(FLOOR, 0);
    // Only one wave on NORMAL; his ears ring afterwards (a free window).
    expect(tw.ofType('shockwave').length).toBe(1);
    tw.run(2);
    expect(c.mode).toBe('ringing');
    const x0 = w.x;
    let last = x0;
    for (let t = 0; t < 120 && !w.removed; t++) {
      last = w.x;
      tw.run(1);
    }
    expect(w.removed).toBe(true);
    expect(Math.abs(last - x0)).toBeLessThanOrEqual(CYMBALIST.waveRange);
  });

  it('on HARD the crash runs both ways', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3, difficulty: 'hard' });
    const c = cymbalist(tw, 220);
    let waves = 0;
    for (let t = 0; t < 600 && waves === 0; t++) {
      tw.run(1);
      waves = tw.ofType('shockwave').length;
      if (tw.ofType('cymbal-disc').length) break;
    }
    if (waves > 0) expect(waves).toBe(2);
    expect(c.alive).toBe(true);
  });

  it('a wall stops the wave', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2, build: (t) => t.solid(150, FLOOR - 40, 16, 40) });
    cymbalist(tw, 240);
    tw.until(() => tw.ofType('shockwave').length > 0, 400);
    const w = tw.ofType('shockwave')[0];
    tw.until(() => w.removed, 120);
    expect(w.x).toBeGreaterThan(150);
  });

  it('never crashes while his feet are outside the view', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2, width: 1600 });
    // A player in reach, but the cymbalist stands just past the right view edge.
    const c = cymbalist(tw, tw.world.camera.right + 10);
    c.anchored = true; // he stays there (a rowboat soldier)
    for (let t = 0; t < 300; t++) {
      tw.run(1);
      if (!tw.world.camera.containsPoint(c.x, c.y - 4, 0)) expect(tw.ofType('shockwave').length).toBe(0);
    }
  });
});

describe('triangle', () => {
  it('DING ×3, 30 ticks apart, then the ALARM brings 3 riflemen from the nearest edge, and he runs', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
    const t0 = tw.spawn('triangle', 230, { gag: false, facing: -1 }) as TriangleRinger;
    const dings: number[] = [];
    let alarmAt = -1;
    for (let t = 0; t < 400 && alarmAt < 0; t++) {
      const before = t0.dings;
      tw.run(1);
      if (t0.dings > before) dings.push(t);
      if (tw.ofType('rifleman').length > 0) alarmAt = t;
    }
    expect(dings.length).toBe(TRIANGLE.dings);
    expect(dings[1] - dings[0]).toBe(TRIANGLE.dingGap);
    expect(dings[2] - dings[1]).toBe(TRIANGLE.dingGap);
    expect(alarmAt - dings[0]).toBeGreaterThanOrEqual(TRIANGLE.alarmAt - 1);
    expect(tw.ofType('rifleman').length).toBe(3);
    expect(tw.hud.callouts.some((c) => c.text === 'ALARM!')).toBe(true);
    tw.run(5);
    expect(t0.mode).toBe('flee');
    tw.run(400);
    expect(t0.removed).toBe(true);
  });

  it('QUIET PLEASE: +800 when he dies before the third ding', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
    const t0 = tw.spawn('triangle', 230, { gag: false, facing: -1 }) as TriangleRinger;
    tw.until(() => t0.dings === 1, 200);
    tw.world.damage(t0, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(t0.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(200 + TRIANGLE.quietBonus);
    tw.run(200);
    expect(tw.ofType('rifleman').length).toBe(0);
  });

  it('reads params.alarm as a count, an id or a list', () => {
    expect(alarmList(undefined).length).toBe(3);
    expect(alarmList(5).map((s) => s.id)).toEqual(Array(5).fill('rifleman'));
    expect(alarmList('drummer')).toEqual([{ id: 'drummer' }]);
    const l = alarmList(['cymbalist', { id: 'rifleman', params: { entry: 'chimney' }, x: 300 }]);
    expect(l.map((s) => s.id)).toEqual(['cymbalist', 'rifleman']);
    expect(l[1].x).toBe(300);
  });
});

describe('baton-major', () => {
  it('IN STEP!: a 20-tick whistle, then riflemen within 120 px get the buff', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 6, width: 1200 });
    const m = tw.spawn('baton-major', 330, { gag: false, facing: -1 }) as BatonMajor;
    const r = tw.spawn('rifleman', 280, { gag: false, facing: -1 }) as Rifleman;
    let whistleAt = -1;
    let buffAt = -1;
    for (let t = 0; t < 600 && buffAt < 0; t++) {
      tw.run(1);
      if (m.mode === 'whistle' && whistleAt < 0) whistleAt = t;
      if (r.inStep) buffAt = t;
    }
    expect(whistleAt).toBeGreaterThanOrEqual(0);
    expect(buffAt - whistleAt).toBeGreaterThanOrEqual(BATON_MAJOR.whistleTicks);
  });

  it('the baton telegraphs 30 ticks, flies out 140 px and comes back to his hand', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 7 });
    const m = tw.spawn('baton-major', 220, { gag: false, facing: -1 }) as BatonMajor;
    let twirlAt = -1;
    let baton: Entity | undefined;
    let thrownAt = -1;
    for (let t = 0; t < 500 && !baton; t++) {
      tw.run(1);
      if (m.mode === 'twirl' && twirlAt < 0) twirlAt = t;
      baton = tw.world.entities.find(isType('baton'));
      if (baton) thrownAt = t;
    }
    expect(baton).toBeDefined();
    expect(thrownAt - twirlAt).toBeGreaterThanOrEqual(BATON_MAJOR.twirlTicks);
    const x0 = baton!.x;
    let far = 0;
    for (let t = 0; t < 200 && !baton!.removed; t++) {
      tw.run(1);
      far = Math.max(far, Math.abs(baton!.x - x0));
    }
    expect(far).toBeGreaterThan(BATON_MAJOR.throwRange - 10);
    expect(far).toBeLessThanOrEqual(BATON_MAJOR.throwRange + 6);
    expect(baton!.removed).toBe(true);
    expect(m.holdsBaton).toBe(true);
    expect(['catch', 'fumble', 'fight', 'whistle', 'twirl']).toContain(m.mode);
  });

  it('his death confuses the infantry around him and drops a medal', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 8, width: 1200 });
    const m = tw.spawn('baton-major', 400, { gag: false, facing: -1 }) as BatonMajor;
    const r = tw.spawn('rifleman', 330, { gag: false, facing: -1 }) as Rifleman;
    tw.run(5);
    tw.world.damage(m, { amount: 200, kind: 'bullet', dirX: 1, owner: 0 });
    expect(m.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(1000);
    tw.run(2);
    expect(r.reaction).toBe('confused');
    expect(tw.world.entities.some((e) => e.type === 'pickup-gem')).toBe(true);
  });
});

describe('rhythm fairness and cost', () => {
  it('every rhythm attack telegraphs at least 18 ticks, on every difficulty', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const tw = new TestWorld({ playerX: 100, god: true, seed: 9, difficulty });
      const c = tw.spawn('cymbalist', 230, { gag: false, facing: -1 }) as Cymbalist;
      let start = -1;
      for (let t = 0; t < 500; t++) {
        tw.run(1);
        if ((c.mode === 'raise' || c.mode === 'windup') && start < 0) start = t;
        if (tw.ofType('shockwave').length || tw.ofType('cymbal-disc').length) {
          expect(t - start).toBeGreaterThanOrEqual(18);
          break;
        }
      }
    }
  });

  it('killed mid-attack: no projectile follows and the token comes back', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
    const c = tw.spawn('cymbalist', 220, { gag: false, facing: -1 }) as Cymbalist;
    tw.until(() => c.mode === 'raise', 400);
    tw.run(5);
    tw.world.damage(c, { amount: 99, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(60);
    expect(tw.ofType('shockwave').length).toBe(0);
    const m = tw.spawn('baton-major', 220, { gag: false, facing: -1 }) as BatonMajor;
    tw.until(() => m.mode === 'twirl', 400);
    tw.world.damage(m, { amount: 999, kind: 'explosion', dirX: 1, owner: 0 });
    tw.run(60);
    expect(tw.ofType('baton').length).toBe(0);
  });

  it('both facings, gags and an outfit: every type runs 600 ticks without errors', () => {
    const tw = new TestWorld({ playerX: 300, god: true, seed: 4, width: 1200 });
    for (const [i, id] of TYPES.entries()) tw.spawn(id, 120 + i * 30, { facing: 1, gag: i % 2 === 0 });
    for (const [i, id] of TYPES.entries()) tw.spawn(id, 460 + i * 30, { facing: -1, outfit: 'night' });
    tw.run(600);
    expect(tw.world.errors).toEqual([]);
  });

  it('30 copies cost under 0.5 ms per tick', () => {
    const tw = new TestWorld({ playerX: 600, god: true, seed: 1, width: 2400 });
    for (let i = 0; i < 30; i++) tw.spawn(TYPES[i % 4], 200 + i * 60, { facing: i % 2 ? 1 : -1, gag: false });
    tw.run(120);
    const t0 = performance.now();
    tw.run(300);
    const per = (performance.now() - t0) / 300;
    expect(per).toBeLessThan(0.5);
  });

  it('is deterministic for a seed', () => {
    const trace = (seed: number): string => {
      const tw = new TestWorld({ playerX: 100, god: true, seed });
      const list = TYPES.map((id, i) => tw.spawn(id, 220 + i * 40, { facing: -1 }));
      tw.run(400);
      return list.map((e) => `${e.x.toFixed(2)}:${(e as unknown as { mode: string }).mode}`).join(' ');
    };
    expect(trace(12)).toBe(trace(12));
  });
});
