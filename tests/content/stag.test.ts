/**
 * The stag party of mission ams (docs/design/ams-extras.md §2.1, §2.2; GDD §4.11): registration and
 * scores, every param combination spawns and runs 600 ticks, telegraphs of at least 18 ticks ON
 * SCREEN before every cork (NORMAL and HARD), a crouch dodges a standing partier's cork, gags are
 * free time, the bike's riders fire in turn, the bike's armour, the wreck (400 explosion damage),
 * the hijack (every rider down → the rideable `beer-bike`), the gloat / cower strips, deaths, and
 * the art (1× palette; 2× / 4× in PAL_HD with the 1× geometry).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inPalette, PAL } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/stag/index';
import '../../src/game/content/stag/art';
import '../../src/game/content/vehicles/beer-bike/index';
import '../../src/game/content/vehicles/beer-bike/art';
import { PARTY_BIKE, STAG, StagBeerBike, StagPartier } from '../../src/game/content/stag/index';
import { BeerBike } from '../../src/game/content/vehicles/beer-bike/index';
import { getEntityMeta } from '../../src/game/registry';
import type { Difficulty } from '../../src/game/session';
import { FLOOR, TestWorld, watchFairness, type FairnessOpts } from './helpers';

const FAIR: FairnessOpts = { attacks: { fire: 'tell' }, tells: new Set(['tell']) };

function world(o: { playerX?: number; god?: boolean; seed?: number; difficulty?: Difficulty } = {}): TestWorld {
  return new TestWorld({ playerX: o.playerX ?? 100, god: o.god ?? true, seed: o.seed ?? 5, difficulty: o.difficulty ?? 'normal', width: 2000 });
}

const partiersOf = (tw: TestWorld): StagPartier[] => tw.ofType('stag-partier') as StagPartier[];

describe('stag: registration', () => {
  it('stag-partier (300) and stag-beer-bike (2,000) are enemies; cork is a projectile', () => {
    expect(getEntityMeta('stag-partier')?.category).toBe('enemy');
    expect(getEntityMeta('stag-partier')?.score).toBe(300);
    expect(getEntityMeta('stag-beer-bike')?.category).toBe('enemy');
    expect(getEntityMeta('stag-beer-bike')?.score).toBe(2000);
    expect(getEntityMeta('cork')?.category).toBe('projectile');
  });

  it('a partier has 20 HP and scores 300; the groom 40 HP and 1,000', () => {
    const tw = world();
    const a = tw.spawn('stag-partier', 300) as StagPartier;
    const g = tw.spawn('stag-partier', 340, { groom: true }) as StagPartier;
    expect([a.maxHp, a.score]).toEqual([20, 300]);
    expect([g.maxHp, g.score, g.art]).toEqual([40, 1000, 'enemy/stag-groom']);
  });

  it('every param combination spawns and runs 600 ticks without errors', () => {
    const specs: Array<[string, Record<string, unknown>]> = [
      ['stag-partier', {}],
      ['stag-partier', { groom: true }],
      ['stag-partier', { gag: 'toast' }],
      ['stag-partier', { gag: 'selfie', look: 2 }],
      ['stag-partier', { gag: true, look: 1 }],
      ['stag-partier', { enter: 'left', look: 3 }],
      ['stag-partier', { from: 'right', facing: -1 }],
      ['stag-beer-bike', {}],
      ['stag-beer-bike', { riders: 2 }],
      ['stag-beer-bike', { riders: 4, groom: true }],
      ['stag-beer-bike', { enter: 'right', looks: [0, 1, 2] }],
      ['stag-beer-bike', { facing: 1, stop: 150 }],
      ['cork', { facing: -1 }],
      ['cork', { facing: 1, speed: 3, vy: -0.2 }],
    ];
    for (const [id, p] of specs) {
      for (const god of [true, false]) {
        const tw = world({ god });
        const e = tw.spawn(id, 300, p);
        expect(e.hasTag('placeholder'), id).toBe(false);
        tw.run(600);
        expect(tw.world.errors.map((x) => `${id} ${JSON.stringify(p)}: ${x.message}`)).toEqual([]);
      }
    }
  });
});

describe('stag: fairness (GDD §4.11)', () => {
  const SCENES: Array<[string, string, Record<string, unknown>, number]> = [
    ['partier', 'stag-partier', {}, 300],
    ['groom', 'stag-partier', { groom: true }, 300],
    ['beer bike', 'stag-beer-bike', { riders: 4 }, 330],
  ];
  for (const difficulty of ['normal', 'hard'] as const) {
    it.each(SCENES)(`${difficulty}: %s telegraphs at least 18 ticks on screen before every cork`, (_n, id, p, x) => {
      const tw = world({ difficulty });
      tw.spawn(id, x, p);
      const w = watchFairness(tw, 900, FAIR);
      expect(w.attacks.length, 'it fired').toBeGreaterThan(0);
      for (const a of w.attacks) {
        expect(a.prev, `${a.id} ${a.mode} after ${a.prev}`).toBe('tell');
        expect(a.tell).toBeGreaterThanOrEqual(18);
        expect(a.tellInView, 'tell on screen').toBeGreaterThanOrEqual(18);
        expect(a.inView).toBe(true);
      }
      for (const n of w.tells) expect(n).toBeGreaterThanOrEqual(18);
      expect(w.outsideShots).toBe(0);
      expect(tw.world.errors).toEqual([]);
    });
  }

  it('a partier offscreen never tells or fires', () => {
    const tw = world();
    tw.spawn('stag-partier', 900);
    const w = watchFairness(tw, 300, FAIR);
    expect(w.attacks).toEqual([]);
    expect(w.tells).toEqual([]);
  });

  it('gags are free time: a toasting and a selfie partier far ahead do not fire', () => {
    const tw = world({ playerX: 60 });
    const a = tw.spawn('stag-partier', 330, { gag: 'toast', facing: 1 }) as StagPartier;
    const b = tw.spawn('stag-partier', 345, { gag: 'selfie', facing: -1 }) as StagPartier;
    tw.run(300);
    expect(a.mode).toBe('gag');
    expect(b.mode).toBe('gag');
    expect(tw.ofType('cork')).toEqual([]);
    expect(a.playing('gag-toast')).toBe(true);
    expect(b.playing('gag-selfie')).toBe(true);
  });

  it('walks in to 160 px, steps back when the player comes within 48 px', () => {
    const tw = world({ playerX: 100 });
    const e = tw.spawn('stag-partier', 400) as StagPartier;
    tw.run(500);
    expect(e.x - 100).toBeLessThanOrEqual(STAG.far + 1);
    expect(e.x - 100).toBeGreaterThan(STAG.far - 30);
    const tw2 = world({ playerX: 100 });
    const b = tw2.spawn('stag-partier', 130) as StagPartier;
    const x0 = b.x;
    tw2.run(40);
    expect(b.x).toBeGreaterThan(x0 + 10);
  });
});

describe('stag: the cork', () => {
  it('flies straight at chest height: a crouch dodges a standing partier, a standing player is hit', () => {
    for (const crouch of [true, false]) {
      const tw = world({ god: false, seed: 2 });
      tw.spawn('stag-partier', 250);
      let deaths = 0;
      let passed = 0;
      tw.world.events.on('playerDied', () => deaths++);
      for (let t = 0; t < 500; t++) {
        tw.hold(...(crouch ? (['down'] as const) : ([] as const)));
        tw.run(1);
        for (const c of tw.ofType('cork')) {
          if (c.x < 80) passed++;
          expect(c.vy).toBe(0);
          expect(FLOOR - c.y).toBeCloseTo(STAG.chestY, 5);
        }
      }
      if (crouch) {
        expect(deaths).toBe(0);
        expect(passed).toBeGreaterThan(0);
      } else expect(deaths).toBeGreaterThan(0);
    }
  });

  it('flies 2.2 px/tick (× the difficulty), the groom fires 3 (one straight, two rising)', () => {
    const tw = world();
    tw.spawn('stag-partier', 250, { groom: true });
    tw.until(() => tw.ofType('cork').length > 0, 400);
    const corks = tw.ofType('cork');
    expect(corks.length).toBe(3);
    expect(corks.map((c) => Math.abs(c.vx))).toEqual([2.2, 2.2, 2.2]);
    expect(corks.map((c) => c.vy).sort((a, b) => b - a)).toEqual([0, -0.22, -0.44]);
    for (const c of corks) expect(c.hasTag('erasable')).toBe(true);
  });
});

describe('stag: the beer bike', () => {
  it('seats 2–4 riders on its stools; they ride along, draw on the bike, never despawn alone', () => {
    const tw = world({ playerX: 60 });
    const b = tw.spawn('stag-beer-bike', 420, { riders: 4, facing: -1 }) as StagBeerBike;
    tw.run(2);
    const riders = partiersOf(tw);
    expect(riders.length).toBe(4);
    for (const r of riders) {
      expect(r.seat).toBe(b);
      expect(r.mode === 'ride' || r.mode === 'tell').toBe(true);
    }
    const x0 = b.x;
    tw.run(60);
    expect(b.x).toBeLessThan(x0 - 10);
    for (const r of partiersOf(tw)) expect(r.x).toBeCloseTo(b.x + r.stoolX * b.facing, 5);
  });

  it('rolls at 0.6 px/tick and stops 140–200 px from the player', () => {
    const tw = world({ playerX: 60 });
    const b = tw.spawn('stag-beer-bike', 600, { facing: -1 }) as StagBeerBike;
    let top = 0;
    for (let i = 0; i < 900; i++) {
      tw.run(1);
      top = Math.max(top, Math.abs(b.vx));
    }
    expect(top).toBeCloseTo(PARTY_BIKE.roll, 5);
    expect(b.mode).toBe('stop');
    expect(b.x - 60).toBeGreaterThanOrEqual(PARTY_BIKE.stopMin - 1);
    expect(b.x - 60).toBeLessThanOrEqual(PARTY_BIKE.stopMax + 1);
  });

  it('stops at a drop (a canal edge) and at a wall instead of rolling off', () => {
    const tw = new TestWorld({ playerX: 60, god: true, width: 2000, noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(500).gap(200).flat(1300) });
    const b = tw.spawn('stag-beer-bike', 900, { riders: 2, facing: -1, stop: 20 }) as StagBeerBike;
    tw.run(500);
    expect(b.dead).toBe(false);
    expect(b.y).toBe(FLOOR);
    expect(b.x - 53).toBeGreaterThanOrEqual(700 - 4);
    const tw2 = new TestWorld({ playerX: 60, god: true, width: 2000, build: (t) => t.solid(500, FLOOR - 40, 20, 40) });
    const b2 = tw2.spawn('stag-beer-bike', 800, { riders: 2, facing: -1, stop: 20 }) as StagBeerBike;
    tw2.run(600);
    expect(b2.x - 53).toBeGreaterThanOrEqual(520 - 4);
  });

  it('its riders fire in turn: never two riders in a tell or a pop at once', () => {
    const tw = world();
    tw.spawn('stag-beer-bike', 320, { riders: 4 });
    let fired = 0;
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      const busy = partiersOf(tw).filter((r) => !r.dead && (r.mode === 'tell' || r.mode === 'fire'));
      expect(busy.length).toBeLessThanOrEqual(1);
      fired += tw.ofType('cork').filter((c) => (c as { t?: number }).t === 1).length;
    }
    expect(tw.world.errors).toEqual([]);
    expect(fired).toBeGreaterThan(1);
  });

  it('its body is armoured: bullets ping, blasts count; 400 explosion damage wreck it (+2,000)', () => {
    const tw = world();
    const b = tw.spawn('stag-beer-bike', 320, { riders: 3 }) as StagBeerBike;
    tw.run(2);
    tw.world.damage(b, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    tw.world.damage(b, { amount: 100, kind: 'laser', dirX: 1, owner: 0 });
    expect(b.hp).toBe(400);
    const before = tw.session.slot(0)?.score ?? 0;
    tw.world.damage(b, { amount: 250, kind: 'knife', dirX: 1, owner: 0 });
    expect(b.hp).toBe(150);
    tw.world.damage(b, { amount: 150, kind: 'explosion', dirX: 1, owner: 0 });
    expect(b.dead).toBe(true);
    // The riders on board are thrown off (killed, credited), the bike scores 2,000.
    expect(partiersOf(tw).every((r) => r.dead)).toBe(true);
    expect((tw.session.slot(0)?.score ?? 0) - before).toBe(2000 + 3 * 300);
    tw.run(200);
    expect(tw.ofType('stag-beer-bike')).toEqual([]);
    expect(tw.ofType('beer-bike')).toEqual([]);
  });

  it('every rider down: the driver runs, the bike rolls to a stop and becomes the rideable beer-bike', () => {
    const tw = world({ playerX: 60 });
    const b = tw.spawn('stag-beer-bike', 330, { riders: 2, facing: -1 }) as StagBeerBike;
    tw.run(10);
    const before = tw.session.slot(0)?.score ?? 0;
    for (const r of partiersOf(tw)) tw.world.damage(r, { amount: 100, kind: 'bullet', dirX: -1, owner: 0 });
    expect(partiersOf(tw).every((r) => r.dead && r.playing('die-stool'))).toBe(true);
    tw.run(1);
    expect(b.mode).toBe('abandon');
    expect(b.driverOn).toBe(false);
    expect(tw.hud.bubbles.some((x) => x.text === 'MIJN FIETS!')).toBe(true);
    tw.until(() => tw.ofType('beer-bike').length > 0, 200);
    const v = tw.ofType('beer-bike')[0] as BeerBike;
    expect(v).toBeInstanceOf(BeerBike);
    expect(v.x).toBeCloseTo(b.x, 5);
    expect(v.facing).toBe(-1);
    expect(v.state).toBe('idle');
    expect(tw.ofType('stag-beer-bike')).toEqual([]);
    // The riders scored; the hijack itself does not.
    expect((tw.session.slot(0)?.score ?? 0) - before).toBe(2 * 300);
  });

  it('unload(): the riders hop off and walk, the bike is left as the rideable beer-bike', () => {
    const tw = world({ playerX: 60 });
    const b = tw.spawn('stag-beer-bike', 330, { riders: 3 }) as StagBeerBike;
    tw.run(5);
    b.unload();
    tw.run(120);
    const ps = partiersOf(tw);
    expect(ps.length).toBe(3);
    for (const p of ps) {
      expect(p.seat).toBe(null);
      expect(p.body).not.toBe(null);
    }
    expect(tw.ofType('beer-bike').length).toBe(1);
  });
});

describe('stag: reactions and deaths', () => {
  it('cower: standing he pulls the T-shirt over his head; seated the stool strip plays', () => {
    const tw = world({ playerX: 60 });
    const a = tw.spawn('stag-partier', 250) as StagPartier;
    tw.spawn('stag-beer-bike', 360, { riders: 2 });
    tw.run(2);
    const r = partiersOf(tw).find((p) => p.seat) as StagPartier;
    expect(a.react('cower', 30)).toBe(true);
    expect(r.react('cower', 30)).toBe(true);
    tw.run(2);
    expect(a.playing('cower')).toBe(true);
    expect(r.playing('sit-cower')).toBe(true);
  });

  it('gloat: the group selfie with the spot (his back to it, phone up), one line per hold, a small flash; no attacks', () => {
    const tw = world({ playerX: 60 });
    const a = tw.spawn('stag-partier', 250) as StagPartier;
    tw.run(2);
    let flashes = 0;
    tw.world.events.on('spawn', (e) => {
      if ((e as { sprite?: string }).sprite === 'enemy/stag-partier/flash') flashes++;
    });
    for (let t = 0; t < 120; t++) {
      if (t % 15 === 0) expect(a.react('gloat', 24, tw.player)).toBe(true);
      tw.run(1);
      expect(a.mode === 'tell' || a.mode === 'fire').toBe(false);
    }
    expect(a.playing('gloat')).toBe(true);
    // The spot (the player at x 60) is behind him: he faces away from it.
    expect(a.facing).toBe(1);
    expect(tw.hud.bubbles.filter((b) => b.text === 'FOR THE GROUP CHAT!').length).toBe(1);
    expect(flashes).toBeGreaterThanOrEqual(2);
  });

  it('the bike under a gloat or a cower rolls to a stop and never turns on the spot', () => {
    const tw = world({ playerX: 60 });
    const b = tw.spawn('stag-beer-bike', 330, { riders: 2, facing: -1, stop: 40 }) as StagBeerBike;
    tw.run(40);
    expect(Math.abs(b.vx)).toBeGreaterThan(0.3);
    tw.player!.x = 600; // the spot is now behind the bike
    for (let t = 0; t < 60; t++) {
      if (t % 15 === 0) for (const k of ['gloat', 'cower'] as const) b.react(k, 24, tw.player);
      tw.run(1);
    }
    expect(b.facing).toBe(-1);
    expect(b.vx).toBe(0);
    expect(b.dead).toBe(false);
  });

  it('deaths: he sits down hard (die), seated he tips off the stool, the groom loses his veil', () => {
    const tw = world({ playerX: 60 });
    const a = tw.spawn('stag-partier', 250) as StagPartier;
    const g = tw.spawn('stag-partier', 280, { groom: true }) as StagPartier;
    tw.run(2);
    tw.world.damage(a, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    tw.world.damage(g, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    expect(a.playing('die')).toBe(true);
    expect(g.playing('die')).toBe(true);
    tw.run(1);
    expect(tw.world.entities.some((e) => (e as { anim?: { id?: string } }).anim?.id === 'enemy/stag-groom/veil')).toBe(true);
  });

  it('breaks on a driven vehicle by contact (½ cell to the vehicle)', () => {
    const tw = world({ playerX: 200 });
    const v = tw.spawn('beer-bike', 200) as BeerBike;
    v.mount(tw.player!);
    v.invulnTicks = 0; // the mount's invulnerable ticks
    const a = tw.spawn('stag-partier', 250, { gag: 'selfie' }) as StagPartier;
    tw.run(3);
    expect(a.dead).toBe(true);
    expect(v.cells).toBe(2.5);
  });
});

describe('stag: the costume in the death strips', () => {
  const has = (id: string, f: number, colors: readonly number[]): boolean => {
    const fr = getFrames(id, 1)[f];
    const set = new Set(colors.map((c) => c >>> 0));
    for (let i = 0; i < fr.buf.data.length; i++) if (set.has(fr.buf.data[i] >>> 0)) return true;
    return false;
  };
  it("the groom keeps his pink tutu in every frame of every death strip (but the crush's flat ones)", () => {
    for (const s of ['die', 'die-knife', 'die-blast', 'die-burn', 'die-stool']) {
      const id = `enemy/stag-groom/${s}`;
      const n = s === 'die-burn' ? 2 : getFrames(id, 1).length; // then the soot statue
      for (let f = 0; f < n; f++) expect(has(id, f, PAL.pink), `${id} ${f}`).toBe(true);
    }
    expect(has('enemy/stag-groom/die-crush', 0, PAL.pink)).toBe(true);
  });
  it('a blast keeps the party shirt green (it singes one shade, never to steel or ink)', () => {
    for (const set of ['stag-partier', 'stag-partier-2', 'stag-groom']) {
      const id = `enemy/${set}/die-blast`;
      for (let f = 0; f < getFrames(id, 1).length; f++) expect(has(id, f, PAL.green), `${id} ${f}`).toBe(true);
    }
  });
});

describe('stag: art', () => {
  const PREFIXES = ['enemy/stag-', 'enemy/cork/', 'vehicle/beer-bike/'];
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  let ids: string[] = [];
  beforeAll(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    ids = listSprites().filter((id) => PREFIXES.some((p) => id.startsWith(p)));
  });
  afterAll(() => warn.mockRestore());

  it('every 1× strip is palette-only and has frames; the logic’s strips exist for every set', () => {
    expect(ids.length).toBeGreaterThan(110);
    for (const id of ids) {
      const frames = getFrames(id, 1);
      expect(frames.length, id).toBeGreaterThan(0);
      for (const f of frames) for (const c of f.buf.data) if ((c & 255) !== 0 && !inPalette(c)) expect.fail(`${id}: ${c.toString(16)} not in PAL`);
    }
    const sets = ['stag-partier', 'stag-partier-1', 'stag-partier-2', 'stag-partier-3', 'stag-groom'];
    const strips = ['idle', 'walk', 'turn', 'alert', 'tell', 'fire', 'gag-toast', 'gag-selfie', 'photo-pose', 'gloat', 'cower', 'die', 'die-knife', 'die-blast', 'die-burn', 'die-crush', 'sit', 'sit-tell', 'sit-fire', 'sit-gloat', 'sit-cower', 'die-stool'];
    for (const s of sets) for (const a of strips) expect(ids, `enemy/${s}/${a}`).toContain(`enemy/${s}/${a}`);
  });

  it('every id has 2× and 4× art with the 1× geometry, PAL_HD only, nothing cut', () => {
    for (const id of ids) {
      expect(hasHiSprite(id, 2) && hasHiSprite(id, 4), id).toBe(true);
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id}@${d}`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = hd[i];
          expect(f.density, `${id}@${d}[${i}]`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) expect.fail(`${id}@${d}[${i}]: ${c.toString(16)} not in PAL_HD`);
        }
      }
    }
    const mine = (e: string): boolean => ids.some((id) => e === `${id}@2x` || e === `${id}@4x`);
    expect(spriteErrors().filter((e) => mine(e.id))).toEqual([]);
    const cut = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('outside the 1× frame') && ids.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 240_000);
});
