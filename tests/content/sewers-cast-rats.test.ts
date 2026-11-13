/**
 * The rats of mission `sewers` (docs/design/sewers.md §3, §5.1; wave P1a RATS): a test arena per
 * rat. Registration, scores and euro rows; the stand-in sprites (ids carry `sewers-`, every frame
 * has its `eye` point); every tell ≥ 18 ticks on screen with its sound, then the attack; the dodges
 * (a jump over the runner's bite, the brute's charge and its stomp wave; a step away from the
 * leaper's pounce and the spitter's lob); the defeats (score, squeak, flip, removed); the entries
 * (edge packs, holes, drops, pipes, grates, plinths); a god-mode mini bot for 1,200 ticks; and the
 * light: the sim is identical with `isLit` forced true and forced false, the eyes-only state, and
 * the white eye flash on every tell.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import type { Renderer } from '../../src/engine/render';
import { getFrames, listSprites } from '../../src/engine/sprites';
import { spawnOffscreen } from '../../src/game/enemy';
import type { SectionContext } from '../../src/game/mission/index';
import { getEntityMeta } from '../../src/game/registry';
import { killCents } from '../../src/game/budget/euro-table';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/sfx/sewers';
import { isSewersSpriteId } from '../../src/game/content/missions/sewers/ids';
import { setLitOverride } from '../../src/game/content/sewers/light-test';
import {
  BRUTE,
  BruteRat,
  LEAPER,
  LeaperRat,
  PLINTH,
  RAT,
  RAT_ART,
  RUNNER,
  Rat,
  RunnerRat,
  SPITTER,
  SpitterRat,
  ratPack,
  spitterPlinths,
} from '../../src/game/content/sewers/rats/index';
import { FLOOR, TestWorld, watchFairness, type FairnessOpts, type TestWorldOptions } from './helpers';

const IDS = {
  runner: 'sewers-rat-runner',
  leaper: 'sewers-rat-leaper',
  spitter: 'sewers-rat-spitter',
  brute: 'sewers-rat-brute',
} as const;
const SCORE: Record<string, number> = { [IDS.runner]: RUNNER.score, [IDS.leaper]: LEAPER.score, [IDS.spitter]: SPITTER.score, [IDS.brute]: BRUTE.score };
const EURO: Record<string, number> = { [IDS.runner]: 200, [IDS.leaper]: 300, [IDS.spitter]: 400, [IDS.brute]: 1500 };
const HP: Record<string, number> = { [IDS.runner]: 10, [IDS.leaper]: 10, [IDS.spitter]: 20, [IDS.brute]: 120 };

const FAIR: FairnessOpts = {
  attacks: { bite: 'tell', jump: 'ltell', spit: 'tell', charge: 'tell', stomp: 'stell' },
  tells: new Set(['tell', 'ltell', 'stell']),
};
/** The sound of each tell, by rat type and tell mode. */
const TELL_SFX: Record<string, Record<string, string>> = {
  [IDS.runner]: { tell: 'sewers/rat-squeak' },
  [IDS.leaper]: { ltell: 'sewers/rat-hiss', tell: 'sewers/rat-squeak' },
  [IDS.spitter]: { tell: 'sewers/spit-gurgle' },
  [IDS.brute]: { tell: 'sewers/brute-snort', stell: 'sewers/brute-snort' },
};

afterEach(() => setLitOverride(null));

/** A flat arena with the spitter's plinths at 400 / 496 and room to run. */
function arena(o: TestWorldOptions = {}): TestWorld {
  return new TestWorld({ width: 1600, seed: 9, ...o, build: (t) => spitterPlinths(t, 400) });
}

/** Every sfx played, with its tick. */
function recordSfx(tw: TestWorld): Array<{ id: string; tick: number }> {
  const out: Array<{ id: string; tick: number }> = [];
  const audio = tw.world.audio;
  const orig = audio.sfx.bind(audio);
  vi.spyOn(audio, 'sfx').mockImplementation((id: string, o?: unknown) => {
    out.push({ id, tick: tw.world.tick });
    return (orig as (i: string, o?: unknown) => ReturnType<typeof audio.sfx>)(id, o);
  });
  return out;
}

/** A minimal section context for the pack helper. */
function ctxOf(tw: TestWorld): SectionContext {
  return {
    world: tw.world,
    spawn: (id: string, x: number, y: number | 'ground', p?: Record<string, unknown>) => {
      const e = tw.world.spawn(id, x, y === 'ground' ? FLOOR : y, p);
      return e;
    },
    enter: (id: string, side: 'left' | 'right', o: { margin?: number; params?: Record<string, unknown>; tag?: string } = {}) =>
      spawnOffscreen(tw.world, id, side, { margin: o.margin, params: o.tag ? { ...o.params, tag: o.tag } : o.params }),
  } as unknown as SectionContext;
}

const rats = (tw: TestWorld): Rat[] => tw.world.entities.filter((e): e is Rat => e instanceof Rat && !e.removed);

/**
 * The god-mode mini bot: faces the nearest living rat, fires on every other tick, aims up and
 * toward at a rat above the chest line (a spitter on its plinth).
 */
function botMask(tw: TestWorld): Button[] {
  const p = tw.player!;
  let best: Entity | null = null;
  let bd = Infinity;
  for (const r of rats(tw)) {
    if (!r.alive || r.mode === 'wait') continue;
    const d = Math.abs(r.x - p.x);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  if (!best) return [];
  const out: Button[] = [];
  const dir = best.x < p.x ? 'left' : 'right';
  if ((dir === 'left') !== (p.facing < 0) || p.y - best.y > 20) out.push(dir);
  if (p.y - best.y > 20) out.push('up');
  if (tw.world.tick % 2 === 0) out.push('fire');
  return out;
}

describe('rats: registration, euro, stand-in sprites', () => {
  it.each(Object.values(IDS))('%s is an enemy with its score, HP and euro row', (id) => {
    const meta = getEntityMeta(id);
    expect(meta?.category).toBe('enemy');
    expect(meta?.score).toBe(SCORE[id]);
    expect(killCents(id, SCORE[id], false)).toBe(EURO[id]);
    const tw = arena({ god: true });
    const e = tw.spawn(id, 700, {}, id === IDS.spitter ? PLINTH.y : FLOOR);
    expect(e.maxHp).toBe(HP[id]);
    expect(e.hasTag('placeholder')).toBe(false);
  });

  it('every rat sprite routes to the lazy chunk and has frames with an eye point', () => {
    const ids = [...listSprites('enemy/sewers-rat-'), ...listSprites(RAT_ART.slime)];
    expect(ids.length).toBeGreaterThan(50);
    for (const id of ids) {
      expect(isSewersSpriteId(id), id).toBe(true);
      const frames = getFrames(id);
      expect(frames.length, id).toBeGreaterThan(0);
      if (id.startsWith('enemy/') && !id.endsWith('/eyes')) for (const f of frames) expect(f.pts?.eye, id).toBeDefined();
    }
    for (const kind of ['runner', 'leaper', 'spitter', 'brute'] as const) {
      const art = RAT_ART[kind];
      for (const a of ['idle', 'tell', 'rise', 'fall', 'gloat', 'cower', 'die', 'die-crush', 'die-blast', 'eyes']) expect(getFrames(`${art}/${a}`).length, `${art}/${a}`).toBeGreaterThan(0);
      expect(getFrames(`${art}/eyes`).length).toBe(2);
    }
    // The sizes of the stand-ins (spec P1a: runner ~22 px long, brute ~56 long and ~34 high).
    const size = (id: string): { w: number; h: number } => {
      const b = getFrames(id)[0].buf.trimBounds()!;
      return { w: b.w, h: b.h };
    };
    const brute = size(`${RAT_ART.brute}/idle`);
    expect(brute.h).toBeGreaterThanOrEqual(30);
    expect(brute.h).toBeLessThanOrEqual(40);
    expect(size(`${RAT_ART.runner}/idle`).h).toBeLessThanOrEqual(18);
  });
});

describe('rats: the arena (tells ≥ 18 on screen with a sound, then the attack)', () => {
  const scenes: Array<[string, string, number, number, Record<string, unknown>]> = [
    ['runner', IDS.runner, 320, FLOOR, {}],
    ['runner pack from the right', IDS.runner, 0, FLOOR, { pack: 'right' }],
    ['leaper in a pipe', IDS.leaper, 260, LEAPER.pipeY, { entry: 'pipe' }],
    ['leaper in a grate', IDS.leaper, 240, FLOOR, { entry: 'grate' }],
    ['spitter on its plinths', IDS.spitter, 400, PLINTH.y, { other: 496 }],
    ['brute (charge)', IDS.brute, 300, FLOOR, {}],
    ['brute (stomp)', IDS.brute, 190, FLOOR, {}],
  ];
  for (const difficulty of ['normal', 'hard'] as const) {
    it.each(scenes)(`${difficulty}: %s`, (_name, id, x, y, p) => {
      const tw = arena({ god: true, playerX: id === IDS.spitter ? 280 : 150, difficulty });
      const sfx = recordSfx(tw);
      if (p.pack) ratPack(ctxOf(tw), 4, { from: 'right' });
      else tw.spawn(id, x, p, y);
      // Track tell starts per type and mode.
      const starts: Array<{ id: string; mode: string; tick: number }> = [];
      const last = new Map<Rat, string>();
      const w = watchFairness(tw, 600, FAIR, () => {
        for (const r of rats(tw)) {
          const m = r.mode;
          if (m !== last.get(r) && FAIR.tells.has(m)) starts.push({ id: r.type, mode: m, tick: tw.world.tick });
          last.set(r, m);
        }
      });
      expect(w.attacks.length, 'it attacked').toBeGreaterThan(0);
      for (const a of w.attacks) {
        expect(a.prev, `${a.id} ${a.mode}`).toBe(FAIR.attacks[a.mode]);
        expect(a.tell, `${a.id} ${a.mode} tell`).toBeGreaterThanOrEqual(18);
        expect(a.tellInView, `${a.id} ${a.mode} tell on screen`).toBeGreaterThanOrEqual(18);
        expect(a.inView).toBe(true);
      }
      for (const n of w.tells) expect(n).toBeGreaterThanOrEqual(18);
      expect(w.outsideShots).toBe(0);
      expect(w.maxTokens).toBeLessThanOrEqual(difficulty === 'hard' ? 6 : 4);
      // Every tell start played its sound in the same tick.
      expect(starts.length).toBeGreaterThan(0);
      for (const s of starts) {
        const want = TELL_SFX[s.id][s.mode];
        expect(sfx.some((e) => e.id === want && Math.abs(e.tick - s.tick) <= 1), `${s.id} ${s.mode} sound ${want}`).toBe(true);
      }
      if (_name === 'brute (stomp)') expect(w.attacks.some((a) => a.mode === 'stomp')).toBe(true);
      if (_name === 'brute (charge)') expect(w.attacks.some((a) => a.mode === 'charge')).toBe(true);
      expect(tw.world.errors).toEqual([]);
    });
  }
});

/** A mortal scene: the hero stands (or dodges when `dodge` says so); deaths until `stop` holds. */
function mortal(setup: (tw: TestWorld) => Rat, dodge: ((r: Rat, tw: TestWorld) => Button[]) | null, stop: (r: Rat) => boolean, max = 500): { deaths: number; attacked: boolean } {
  const tw = arena({ god: false, playerX: 150 });
  const r = setup(tw);
  let deaths = 0;
  let attacked = false;
  tw.world.events.on('playerDied', () => deaths++);
  for (let t = 0; t < max && !r.removed; t++) {
    tw.hold(...(dodge ? dodge(r, tw) : []));
    tw.run(1);
    if (r.contactDamage) attacked = true;
    if (stop(r)) break;
  }
  expect(tw.world.errors).toEqual([]);
  return { deaths, attacked };
}

describe('rats: the dodges', () => {
  it('the runner bites a standing hero; a jump at the end of its tell clears the bite', () => {
    const spawn = (tw: TestWorld): Rat => tw.spawn(IDS.runner, 300, { facing: -1 }) as Rat;
    let bitten = false;
    const stand = mortal(spawn, null, (r) => {
      if (r.mode === 'bite') bitten = true;
      return bitten && r.mode === 'recover';
    });
    expect(stand.attacked).toBe(true);
    expect(stand.deaths).toBe(1);
    let jumped = -1;
    let bit = false;
    const jump = mortal(
      spawn,
      (r, tw) => {
        if (jumped < 0 && r.mode === 'tell' && r.modeT >= 14) jumped = tw.world.tick;
        return jumped >= 0 && tw.world.tick - jumped < 3 ? ['jump'] : [];
      },
      (r) => {
        if (r.mode === 'bite') bit = true;
        return bit && r.mode === 'recover';
      },
    );
    expect(jump.attacked).toBe(true);
    expect(jump.deaths).toBe(0);
  });

  it('the leaper pounces on the spot the hero stood on at its tell start: standing dies, a step away is safe', () => {
    const spawn = (tw: TestWorld): Rat => tw.spawn(IDS.leaper, 260, { entry: 'pipe' }, LEAPER.pipeY) as Rat;
    let jumped = false;
    const landed = (r: Rat): boolean => {
      if (r.mode === 'jump') jumped = true;
      return jumped && r.mode === 'recover' && r.modeT > 3;
    };
    const stand = mortal(spawn, null, landed);
    expect(stand.attacked).toBe(true);
    expect(stand.deaths).toBe(1);
    jumped = false;
    let tellAt = -1;
    const step = mortal(
      spawn,
      (r, tw) => {
        if (tellAt < 0 && r.mode === 'ltell') tellAt = tw.world.tick;
        return tellAt >= 0 && tw.world.tick - tellAt < 30 ? ['left'] : [];
      },
      landed,
    );
    expect(step.attacked).toBe(true);
    expect(step.deaths).toBe(0);
  });

  it('the leaper aims at the x of the hero at the tell start and peaks 48 px over the mouth', () => {
    const tw = arena({ god: true, playerX: 150 });
    const r = tw.spawn(IDS.leaper, 260, { entry: 'pipe' }, LEAPER.pipeY) as LeaperRat;
    tw.until(() => r.mode === 'ltell', 200);
    const aim = tw.player!.x;
    expect(r.aimX).toBe(aim);
    tw.until(() => r.mode === 'jump', 100);
    let top = Infinity;
    tw.until(() => {
      top = Math.min(top, r.y);
      return r.mode !== 'jump';
    }, 200);
    expect(LEAPER.pipeY - top).toBeGreaterThanOrEqual(LEAPER.peak - 2);
    expect(LEAPER.pipeY - top).toBeLessThanOrEqual(LEAPER.peak + 1);
    expect(r.x).toBeCloseTo(aim, 5);
    expect(r.y).toBe(FLOOR);
  });

  it('the spitter lob hits a standing hero; a run after the spit is safe; the puddle does no harm', () => {
    const spawn = (tw: TestWorld): Rat => tw.spawn(IDS.spitter, 400, { other: 496 }, PLINTH.y) as Rat;
    let spat = 0;
    const stop = (r: Rat): boolean => {
      if (r.mode === 'spit' && r.modeT === 1) spat++;
      return spat > 0 && r.mode === 'sit' && r.modeT > 60;
    };
    const tw = arena({ god: false, playerX: 250 });
    const r = spawn(tw);
    let deaths = 0;
    tw.world.events.on('playerDied', () => deaths++);
    tw.until(() => r.mode === 'spit', 300);
    tw.run(80);
    expect(deaths).toBe(1);
    spat = 0;
    let spitAt = -1;
    const run = mortal(
      (tw2) => {
        tw2.player!.placeAt(250, FLOOR, 0);
        return spawn(tw2);
      },
      (s, tw2) => {
        if (spitAt < 0 && s.mode === 'spit') spitAt = tw2.world.tick;
        return spitAt >= 0 && tw2.world.tick - spitAt < 40 ? ['left'] : [];
      },
      stop,
    );
    expect(spat).toBe(1);
    expect(run.deaths).toBe(0);
    // A hero standing in the puddle after the splash is never hurt.
    const tw3 = arena({ god: false, playerX: 60 });
    const sp = spawn(tw3) as SpitterRat;
    let deaths3 = 0;
    tw3.world.events.on('playerDied', () => deaths3++);
    tw3.player!.placeAt(250, FLOOR, 0);
    tw3.until(() => sp.mode === 'spit', 300);
    // Leave before the blob lands, come back into the puddle after the splash.
    tw3.hold('left').run(40);
    tw3.until(() => tw3.world.entities.some((e) => (e as { sprite?: string }).sprite === `${RAT_ART.slime}/puddle`), 100);
    sp.react('photo', 300);
    tw3.hold('right').run(30).hold().run(60);
    expect(deaths3).toBe(0);
  });

  it('the spitter hops to its other plinth after every 3rd spit and sits above the chest line', () => {
    const tw = arena({ god: true, playerX: 300 });
    const s = tw.spawn(IDS.spitter, 400, { other: 496 }, PLINTH.y) as SpitterRat;
    tw.run(5);
    expect(s.y).toBe(PLINTH.y);
    expect(s.hitRect().y + s.hitRect().h).toBeLessThanOrEqual(PLINTH.y + 0.5);
    const xs = new Set<number>();
    let spits = 0;
    for (let t = 0; t < 1200; t++) {
      tw.run(1);
      if (s.mode === 'spit' && s.modeT === 1) spits++;
      if (s.mode === 'sit') xs.add(Math.round(s.x));
    }
    expect(spits).toBeGreaterThanOrEqual(4);
    expect([...xs].sort()).toEqual([400, 496]);
    expect(s.y).toBe(PLINTH.y);
  });

  it('the brute charge kills a standing hero; a jump at the end of the tell clears its back', () => {
    const spawn = (tw: TestWorld): Rat => tw.spawn(IDS.brute, 260, { facing: -1 }) as Rat;
    let charged = false;
    const done = (r: Rat): boolean => {
      if (r.mode === 'charge') charged = true;
      return charged && r.mode === 'recover';
    };
    const stand = mortal(spawn, null, done);
    expect(stand.attacked).toBe(true);
    expect(stand.deaths).toBe(1);
    charged = false;
    let jumped = -1;
    const jump = mortal(
      spawn,
      (r, tw) => {
        if (jumped < 0 && r.mode === 'tell' && r.modeT >= (r as BruteRat).telegraph - 6) jumped = tw.world.tick;
        return jumped >= 0 && tw.world.tick - jumped < 3 ? ['jump'] : [];
      },
      done,
    );
    expect(jump.attacked).toBe(true);
    expect(jump.deaths).toBe(0);
    // Its back is at 30 px: the charge box is no taller.
    expect(-BRUTE.chargeBox.y).toBe(30);
  });

  it('the brute stomp wave kills a standing hero within 48 px; a jump clears it', () => {
    const spawn = (tw: TestWorld): Rat => tw.spawn(IDS.brute, 186, { facing: -1 }) as Rat;
    let stomped = false;
    const done = (r: Rat): boolean => {
      if (r.mode === 'stomp') stomped = true;
      return stomped && r.mode === 'recover';
    };
    const stand = mortal(spawn, null, done);
    expect(stand.attacked).toBe(true);
    expect(stand.deaths).toBe(1);
    stomped = false;
    let jumped = -1;
    const jump = mortal(
      spawn,
      (r, tw) => {
        if (jumped < 0 && r.mode === 'stell' && r.modeT >= (r as BruteRat).telegraph - 4) jumped = tw.world.tick;
        return jumped >= 0 && tw.world.tick - jumped < 3 ? ['jump'] : [];
      },
      done,
    );
    expect(jump.attacked).toBe(true);
    expect(jump.deaths).toBe(0);
  });
});

describe('rats: defeats and entries', () => {
  it('a kill scores, squeaks, flips the rat (die strip), drops slime and removes it; a crush flattens', () => {
    for (const id of Object.values(IDS)) {
      const tw = arena({ god: true, playerX: 100 });
      const sfx = recordSfx(tw);
      const r = tw.spawn(id, 300, id === IDS.leaper ? { entry: 'grate' } : {}, id === IDS.spitter ? PLINTH.y : FLOOR) as Rat;
      tw.run(3);
      tw.world.damage(r, { amount: 1000, kind: 'bullet', dirX: 1, owner: 0 });
      tw.run(1);
      expect(tw.session.slot(0)?.score, id).toBe(SCORE[id]);
      expect(r.playing('die'), id).toBe(true);
      expect(sfx.some((s) => s.id === 'sewers/rat-flip')).toBe(true);
      tw.run(200);
      expect(r.removed, id).toBe(true);
      expect(tw.world.errors).toEqual([]);
    }
    const tw = arena({ god: true });
    const r = tw.spawn(IDS.runner, 300) as Rat;
    tw.run(2);
    tw.world.damage(r, { amount: 100, kind: 'crush', dirX: 1, owner: 0 });
    tw.run(1);
    expect(r.playing('die-crush')).toBe(true);
  });

  it('packs: from an edge one behind the other, out of a hole one by one, off a height onto the floor', () => {
    const tw = arena({ god: true, playerX: 300 });
    const ctx = ctxOf(tw);
    const edge = ratPack(ctx, 5, { from: 'right', tag: 'p1' });
    const hole = ratPack(ctx, 4, { hole: { x: 500, y: FLOOR }, every: 14 });
    const drop = ratPack(ctx, 3, { drop: { x: 200, y: 90 } });
    tw.world.flush();
    expect(edge.every((e) => e.x > tw.world.camera.right)).toBe(true);
    expect(new Set(edge.map((e) => Math.round(e.x))).size).toBe(5);
    expect(edge.every((e) => e.hasTag('p1'))).toBe(true);
    // The hole: one rat more out every 14 ticks (hidden, untargetable while it waits).
    const out = (): number => (hole as Rat[]).filter((r) => r.mode !== 'wait').length;
    tw.run(2);
    expect(out()).toBe(1);
    expect((hole[3] as Rat).hurtboxes().length).toBe(0);
    tw.run(14 * 3);
    expect(out()).toBe(4);
    tw.run(RAT.rise + 4);
    for (const r of hole as Rat[]) expect(['rise', 'wait']).not.toContain(r.mode);
    // The drop: all three land on the floor.
    tw.run(80);
    for (const r of drop as Rat[]) {
      expect(r.y).toBe(FLOOR);
      expect(r.mode).not.toBe('fall');
    }
    expect(tw.world.errors).toEqual([]);
  });

  it('a rat out of a hole above the floor (a fatberg rat hole) hops out and lands on the floor', () => {
    const tw = arena({ god: true, playerX: 150 });
    const r = tw.spawn(IDS.runner, 340, { entry: 'hole' }, 140) as Rat;
    tw.run(RAT.rise + 2);
    expect(r.mode).toBe('fall');
    tw.until(() => r.mode !== 'fall', 120);
    expect(r.y).toBe(FLOOR);
  });

  it('every rat answers the gloat and the cower without attacking', () => {
    const tw = arena({ god: true, playerX: 200 });
    for (const [id, x, y, p] of [
      [IDS.runner, 260, FLOOR, {}],
      [IDS.leaper, 300, LEAPER.pipeY, { entry: 'pipe' }],
      [IDS.spitter, 400, PLINTH.y, {}],
      [IDS.brute, 520, FLOOR, {}],
    ] as const) tw.spawn(id, x, p, y);
    tw.run(2);
    for (const r of rats(tw)) {
      expect(r.react('gloat', 200, tw.player)).toBe(true);
    }
    for (let t = 0; t < 200; t++) {
      tw.run(1);
      for (const r of rats(tw)) expect(r.contactDamage, r.type).toBeNull();
    }
    expect(rats(tw).every((r) => r.playing('gloat') || r.playing('lurk'))).toBe(true);
    for (const r of rats(tw)) r.react('cower', 60, tw.player);
    tw.run(2);
    expect(rats(tw).filter((r) => r.playing('cower')).length).toBeGreaterThanOrEqual(3);
    expect(tw.world.errors).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------------
// The light (spec §5.1): the sim never depends on isLit; the eyes-only state; the white eye flash
// -------------------------------------------------------------------------------------------------

/** The full arena with the god mini bot: a trace of every tick (rng, rats, kills, hero). */
function litRun(lit: boolean | null): { trace: string[]; kills: number; drawn: { dark: number; body: number } } {
  setLitOverride(lit);
  const tw = arena({ god: true, playerX: 150, seed: 21 });
  const ctx = ctxOf(tw);
  ratPack(ctx, 4, { from: 'right' });
  tw.spawn(IDS.leaper, 300, { entry: 'pipe' }, LEAPER.pipeY);
  tw.spawn(IDS.spitter, 400, { other: 496 }, PLINTH.y);
  tw.spawn(IDS.brute, 620, {});
  ratPack(ctx, 3, { hole: { x: 520, y: FLOOR } });
  const trace: string[] = [];
  const drawn = { dark: 0, body: 0 };
  const r = stubRenderer((id) => {
    if (id.endsWith('/eyes')) drawn.dark++;
    else if (id.startsWith('enemy/sewers-rat-')) drawn.body++;
  });
  for (let t = 0; t < 1200; t++) {
    tw.hold(...(t < 300 ? [] : botMask(tw)));
    tw.run(1);
    if (t % 20 === 0) for (const e of rats(tw)) e.draw(r);
    const rs = rats(tw)
      .map((e) => `${e.type}:${e.x.toFixed(3)},${e.y.toFixed(3)},${e.mode},${e.hp}`)
      .join('|');
    trace.push(`${t} ${JSON.stringify(tw.world.rng.getState())} ${tw.player!.x.toFixed(3)} ${rs}`);
  }
  expect(tw.world.errors).toEqual([]);
  setLitOverride(null);
  return { trace, kills: tw.session.slot(0)!.stats.kills, drawn };
}

function stubRenderer(onSprite: (id: string, frame: number) => void): Renderer {
  return new Proxy({} as Renderer, {
    get: (_t, k) => (k === 'sprite' ? (id: string, frame: number) => onSprite(id, frame) : () => undefined),
  });
}

describe('rats: the light', () => {
  it('the sim is identical with isLit forced true and forced false (ticks, positions, modes, rng, kills)', () => {
    const base = litRun(null);
    const on = litRun(true);
    const off = litRun(false);
    expect(base.kills).toBeGreaterThan(4);
    expect(on.kills).toBe(base.kills);
    expect(off.kills).toBe(base.kills);
    for (let i = 0; i < base.trace.length; i++) {
      expect(on.trace[i]).toBe(base.trace[i]);
      expect(off.trace[i]).toBe(base.trace[i]);
    }
    // Lit: whole bodies; dark: the eyes only (dead rats draw their flip in both).
    expect(on.drawn.body).toBeGreaterThan(0);
    expect(off.drawn.dark).toBeGreaterThan(0);
    expect(off.drawn.dark).toBeGreaterThan(off.drawn.body);
  });

  it('in the dark a living rat draws only its eyes, and can still be shot', () => {
    setLitOverride(false);
    const tw = arena({ god: true, playerX: 100 });
    const r = tw.spawn(IDS.runner, 220, { gag: true }) as RunnerRat;
    tw.run(3);
    expect(r.lit).toBe(false);
    const ids: string[] = [];
    r.draw(stubRenderer((id) => ids.push(id)));
    expect(ids).toEqual([`${RAT_ART.runner}/eyes`]);
    tw.hold('right', 'fire');
    tw.until(() => r.dead, 120);
    setLitOverride(true);
    tw.run(1);
    const lit: string[] = [];
    const r2 = tw.spawn(IDS.runner, 260, { gag: true }) as RunnerRat;
    tw.run(2);
    r2.draw(stubRenderer((id) => lit.push(id)));
    expect(lit.length).toBe(1);
    expect(lit[0]).not.toContain('/eyes');
  });

  it.each([
    ['runner', IDS.runner, 260, FLOOR, {}, 'tell'],
    ['leaper', IDS.leaper, 260, LEAPER.pipeY, { entry: 'pipe' }, 'ltell'],
    ['spitter', IDS.spitter, 400, PLINTH.y, {}, 'tell'],
    ['brute', IDS.brute, 260, FLOOR, { facing: -1 }, 'tell'],
  ] as const)('%s: the eyes flash white for the first 6 ticks of a tell, lit and dark', (_n, id, x, y, p, tell) => {
    for (const lit of [true, false]) {
      setLitOverride(lit);
      const tw = arena({ god: true, playerX: id === IDS.spitter ? 280 : 150 });
      const r = tw.spawn(id, x, p, y) as Rat;
      tw.until(() => r.mode === tell, 400);
      const frames: number[] = [];
      for (let k = 0; k < 10; k++) {
        const eyes: number[] = [];
        r.draw(stubRenderer((sid, f) => sid.endsWith('/eyes') && eyes.push(f)));
        frames.push(eyes.length ? eyes[0] : -1);
        tw.run(1);
      }
      expect(frames.slice(0, RAT.eyeFlash), `${id} lit=${lit}`).toEqual(Array(RAT.eyeFlash).fill(1));
      expect(frames.slice(RAT.eyeFlash), `${id} lit=${lit}`).toEqual(Array(10 - RAT.eyeFlash).fill(lit ? -1 : 0));
    }
  });
});
