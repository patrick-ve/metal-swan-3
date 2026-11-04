/**
 * The Swan riders at 40 px, stage 2 (docs/design/ams40.md wave 7): the five heroes' ride-<pose>,
 * mount and mount-hop strips (tools/art40/chars/_hero/ride.py, baked into
 * src/game/content/art40/<hero>.gen.ts) fitted to the natural Swan of stage 1: the contract ids and
 * timing, every frame decodes, the points the code reads, the hip on her seat with the fists on her
 * grips and the near leg in her -front overlay's window, the hop that settles into ride-sit, the
 * hang (mount frame 0) the ending hangs by its hand; headless, the Swan's rider picks read an
 * existing frame at every tick of every state, and the hop is draw-only (plan D7).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeBakedIndices, type BakedFrame, type BakedSet } from '../../src/engine/baked';
import { buttonMask, VirtualPad, type Button } from '../../src/engine/input';
import type { Renderer } from '../../src/engine/render';
import { frameCount, getFrames, hasFramesAt, hasSprite, spriteAnim } from '../../src/engine/sprites';
import { Terrain, terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { SET as BOB } from '../../src/game/content/art40/bob.gen';
import { SET as DIRK } from '../../src/game/content/art40/dirk.gen';
import { SET as PATRICK } from '../../src/game/content/art40/patrick.gen';
import { SET as SWAN_SET } from '../../src/game/content/art40/swan.gen';
import { SET as THOM } from '../../src/game/content/art40/thom.gen';
import { SET as VINCENT } from '../../src/game/content/art40/vincent.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/vehicles/swan/index';
import type { Swan } from '../../src/game/content/vehicles/swan/index';
import '../../src/game/content/weapons/index';
import { attachGame, HudState } from '../../src/game/context';
import { MOUNT_HIP_DROP } from '../../src/game/player/hero-art';
import { Player } from '../../src/game/player/player';
import { gameEntityFactory } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { applyTuning } from '../../src/game/tuning';

applyTuning();
const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[art]')) return;
  warn(...args);
});

const SETS: ReadonlyArray<[string, BakedSet]> = [
  ['vincent', VINCENT],
  ['thom', THOM],
  ['dirk', DIRK],
  ['bob', BOB],
  ['patrick', PATRICK],
];

interface ContractEntry {
  frames: number;
  framePoints: string[][];
  readPoints?: string[];
  durations?: number[];
  totalTicks: number;
  loop?: boolean;
  defer?: boolean;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;

/** The nine rider poses (Player RIDE_POSES): frame count and the contract's hold of each frame. */
const RIDE: Readonly<Record<string, readonly number[]>> = {
  sit: [20, 20],
  lean: [6, 6],
  up: [30],
  hunch: [30],
  hold: [4, 4],
  brace: [30],
  duck: [30],
  ears: [6, 6],
  cheer: [8, 8],
};
/** The mount-hop holds (ride.py HOP_TICKS): the logic time stays 16 (drawHop reads stripTicks). */
const HOP = [3, 4, 4, 4, 1];
/** Every strip this stage draws; all others in the hero sets stay byte-identical (the bake diff). */
const STRIPS = [...Object.keys(RIDE).map((n) => `ride-${n}`), 'mount', 'mount-hop'];

/**
 * The Swan's grips, relative to the rider's hip on her seat (swan body.grips; ride.py GRIPS): the
 * near fist (the wrist point 'hand') lands 1 px behind the near grip. In the crouch strips the
 * rider lies 4 px deeper on the same grips (GRIPS_LOW).
 */
const GRIP: readonly [number, number] = [9, -5];
const GRIP_LOW: readonly [number, number] = [9, -9];
/** The raised back of the saddle: the 'up' pose braces its near hand there (out of the barrel). */
const CANTLE: readonly [number, number] = [-7, -2];

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** The opaque pixels of a baked frame as 'x,y' keys, its anchor moved to (dx, dy). */
function mask(f: BakedFrame, dx = 0, dy = 0): Set<string> {
  const ix = decodeBakedIndices(f);
  const s = new Set<string>();
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (ix[y * f.w + x]) s.add(`${x - f.ox + dx},${y - f.oy + dy}`);
  return s;
}

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
  await import('../../src/game/content/vehicles/swan/art');
});

describe.each(SETS)('%s rides the natural Swan', (hero, set) => {
  const P = `char/${hero}/`;

  it('registers the 11 rider strips at the contract counts, timing and flags; 1× pixels only', () => {
    for (const n of STRIPS) {
      const id = P + n;
      const c = CONTRACT[id];
      expect(c, `${id} is a contract id`).toBeDefined();
      expect(hasSprite(id), id).toBe(true);
      const s = set.strips[n];
      expect(s.frames.length, id).toBe(c.frames);
      expect(frameCount(id), id).toBe(c.frames);
      expect(s.loop, `${id} loop`).toBe(c.loop ?? true);
      expect(!!s.defer, `${id} defer`).toBe(!!c.defer);
      expect(sum(s.durations), `${id} logic time`).toBe(c.totalTicks);
      expect([...(spriteAnim(id).durations ?? [])], id).toEqual(s.durations);
      // No dense art: getFrames at 2× and 4× give the 1× frames.
      expect(hasFramesAt(id, 2), `${id} 2×`).toBe(false);
      expect(hasFramesAt(id, 4), `${id} 4×`).toBe(false);
      expect(getFrames(id, 2)).toBe(getFrames(id, 1));
      expect(getFrames(id, 4)).toBe(getFrames(id, 1));
    }
    for (const [n, d] of Object.entries(RIDE)) {
      expect(set.strips[`ride-${n}`].durations, n).toEqual(d);
      expect(CONTRACT[`${P}ride-${n}`].durations, n).toEqual(d);
      expect(set.strips[`ride-${n}`].cls, n).toBe('held');
    }
    expect(set.strips.mount.durations).toEqual([16, 16]);
    expect(set.strips['mount-hop'].durations).toEqual(HOP);
    expect(set.strips['mount-hop'].cls).toBe('mount-hop');
    expect(set.events?.MOUNT_HIP_DROP).toBe(MOUNT_HIP_DROP);
  });

  it('every frame decodes (w·h pixels, indices in the palette); the set keeps its colour budget', () => {
    const fx = new Set(set.fx ?? []);
    const used = new Set<number>();
    for (const s of Object.values(set.strips)) {
      for (const f of s.frames) {
        const ix = decodeBakedIndices(f);
        expect(ix.length).toBe(f.w * f.h);
        for (const i of ix) {
          expect(i).toBeLessThan(set.pal.length);
          if (i && !fx.has(i)) used.add(i);
        }
      }
    }
    expect(used.size).toBeLessThanOrEqual(set.budget);
    for (const n of STRIPS) for (const f of set.strips[n].frames) expect(mask(f).size, n).toBeGreaterThan(200);
  });

  it('every frame carries the contract points; a smear only where the hop springs (frame 0)', () => {
    for (const n of STRIPS) {
      const c = CONTRACT[P + n];
      set.strips[n].frames.forEach((f, i) => {
        for (const name of c.framePoints[i] ?? c.framePoints[0]) expect(f.pts?.[name], `${n} #${i} ${name}`).toBeDefined();
        for (const name of c.readPoints ?? []) expect(f.pts?.[name], `${n} #${i} reads ${name}`).toBeDefined();
        expect(!!f.smear, `${n} #${i} smear`).toBe(n === 'mount-hop' && i === 0);
      });
    }
  });

  it('the hip on her seat, the fists on her grips; up braces on the cantle (out of the barrel); the hands of ears and cheer go up', () => {
    const hand = (n: string, i: number): readonly [number, number] => set.strips[`ride-${n}`].frames[i].pts!.hand;
    for (const n of ['sit', 'lean', 'hold', 'brace', 'hunch']) {
      set.strips[`ride-${n}`].frames.forEach((_, i) => {
        const h = hand(n, i);
        expect(Math.abs(h[0] - GRIP[0]), `${n} #${i} x`).toBeLessThanOrEqual(1);
        expect(Math.abs(h[1] - GRIP[1]), `${n} #${i} y`).toBeLessThanOrEqual(1);
      });
    }
    const d = hand('duck', 0);
    expect(Math.abs(d[0] - GRIP_LOW[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(d[1] - GRIP_LOW[1])).toBeLessThanOrEqual(1);
    const u = hand('up', 0);
    expect(Math.abs(u[0] - CANTLE[0])).toBeLessThanOrEqual(2);
    expect(Math.abs(u[1] - CANTLE[1])).toBeLessThanOrEqual(2);
    // The barrel at aim 6 points straight up from the drum (hip + (8, 12)) to the near grip: the
    // hand in 'up' is behind the hip, far from it.
    expect(u[0]).toBeLessThan(0);
    for (const i of [0, 1]) {
      expect(hand('ears', i)[1], `ears #${i}`).toBeLessThan(-10);
      expect(hand('cheer', i)[1], `cheer #${i}`).toBeLessThan(GRIP[1]);
    }
    // The head stays above the hip; the hunch and the duck lower it.
    const head = (n: string): number => set.strips[`ride-${n}`].frames[0].pts!.head[1];
    expect(head('hunch')).toBeGreaterThan(head('sit'));
    expect(head('duck')).toBeGreaterThan(head('hunch'));
  });

  it('on her ridden strips the near leg shows over her flank, the -front overlay hides little of him', () => {
    // [body strip, frame, rider pose, frame]: what swan.ts pickPose / pickRiderFrame put together.
    const PAIRS: [string, number, string, number][] = [
      ['idle', 0, 'sit', 0], ['idle', 2, 'sit', 1], ['run', 0, 'lean', 0], ['run', 2, 'lean', 1], ['squat', 0, 'hold', 0],
      ['land', 0, 'brace', 0], ['idle', 0, 'up', 0], ['idle', 0, 'hunch', 0], ['idle', 0, 'cheer', 0], ['idle', 0, 'cheer', 1],
      ['crouch', 0, 'duck', 0], ['honk', 2, 'ears', 0], ['honk', 6, 'ears', 1],
    ];
    for (const [b, bi, r, ri] of PAIRS) {
      const body = SWAN_SET.strips[b].frames[bi];
      const seat = body.pts!.seat;
      const rider = mask(set.strips[`ride-${r}`].frames[ri], seat[0], seat[1]);
      const front = mask(SWAN_SET.strips[`${b}-front`].frames[bi]);
      let covered = 0;
      let leg = 0;
      for (const k of rider) {
        const c = front.has(k);
        if (c) covered++;
        else if (Number(k.split(',')[1]) > seat[1]) leg++;
      }
      const tag = `${r}#${ri} on ${b}#${bi}`;
      // Below the hip line: the near leg (thigh, knee over the drum, shin, shoe) stays visible.
      expect(leg, tag).toBeGreaterThanOrEqual(100);
      // Upright, the overlay only tucks his seat and the cape's hem in; flat or rearing (duck,
      // ears) he lies down into her back.
      expect(covered / rider.size, tag).toBeLessThanOrEqual(r === 'duck' || r === 'ears' ? 0.25 : 0.15);
    }
  });

  it('the hop lands its hip on the seat in the ride-sit pose; mount frame 0 hangs below its hands', () => {
    const hop = set.strips['mount-hop'].frames;
    const last = hop[hop.length - 1];
    const hip = last.pts!.hip;
    const a = mask(last, -hip[0], -hip[1]);
    const s = mask(set.strips['ride-sit'].frames[0]);
    let inter = 0;
    for (const k of a) if (s.has(k)) inter++;
    expect(inter / (a.size + s.size - inter)).toBeGreaterThanOrEqual(0.85);
    // The flight frames rise above the seat (the near leg swings over her flank).
    const top = (f: BakedFrame): number => -f.oy;
    expect(top(hop[1])).toBeLessThan(top(hop[0]));
    // The hang (the ending hangs him by 'hand' from the flyer): the fists as high as his head, the
    // body hanging a full figure below them; frame 1 is the seated fallback (hip 0, -17).
    const [hang, seated] = set.strips.mount.frames;
    expect(hang.pts!.hand[1]).toBeLessThanOrEqual(hang.pts!.head[1] + 1);
    expect(hang.h - hang.oy - hang.pts!.hand[1]).toBeGreaterThanOrEqual(25);
    expect(hang.pts!.hand[1]).toBeLessThan(seated.pts!.hand[1]);
    expect(seated.pts!.hip).toEqual([0, -MOUNT_HIP_DROP]);
  });
});

// ------------------------------------------------------------------------------------ behaviour

const FLOOR = 176;

interface Draw {
  id: string;
  frame: number;
}

/** A renderer that logs the sprites (and ignores every other call). */
function spriteLog(): { r: Renderer; calls: Draw[] } {
  const calls: Draw[] = [];
  const r = new Proxy(
    { sprite: (id: string, frame: number) => calls.push({ id, frame }) },
    { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : () => {}) },
  ) as unknown as Renderer;
  return { r, calls };
}

class Rig {
  readonly world: World;
  readonly pad = new VirtualPad();
  mask = 0;
  readonly p: Player;
  readonly swan: Swan;
  /** pose → the rider frames drawn ('hop' = mount-hop). */
  readonly seen = new Map<string, Set<number>>();
  /** One line per tick: the logic state (positions, states, the Swan's strip): never the art. */
  readonly trace: string[] = [];
  readonly hero: string;
  private readonly draw: boolean;

  constructor(hero: string, mute = false, draw = true) {
    this.hero = hero;
    const t = terrain(6000, 216);
    t.ground().at(0, FLOOR).flat(6000);
    this.world = new World({ terrain: new Terrain(t.build()), seed: 7, factory: gameEntityFactory });
    attachGame(this.world, new GameSession({ characters: [hero, hero], seed: 7 }), new HudState());
    this.p = new Player(this.world, 140, FLOOR, { pad: this.pad, index: 0 });
    this.world.add(this.p);
    this.p.placeAt(140, FLOOR, 0);
    this.swan = this.world.spawn('swan', 200, FLOOR, mute ? { variant: 'mute' } : {}) as Swan;
    this.world.flush();
    this.world.camera.follow(this.world.players);
    this.draw = draw;
    this.run(1);
  }

  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pad.update(this.mask);
      this.world.update();
      const s = this.swan as unknown as { bodyName: string; state: string };
      this.trace.push(`${this.world.tick} ${this.p.state} ${this.p.x.toFixed(3)},${this.p.y.toFixed(3)} ${s.state} ${this.swan.x.toFixed(3)},${this.swan.y.toFixed(3)} ${s.bodyName}`);
      if (this.draw) this.check();
    }
    return this;
  }

  hold(...b: Button[]): this {
    this.mask = b.length ? buttonMask(...b) : 0;
    return this;
  }

  tap(...b: Button[]): this {
    const keep = this.mask;
    this.mask = keep | buttonMask(...b);
    this.run(1);
    this.mask = keep;
    return this;
  }

  /** Draw the Swan; every rider sprite it draws is a registered strip and an existing frame. */
  check(): void {
    const { r, calls } = spriteLog();
    this.swan.draw(r);
    const art = `char/${this.hero}/`;
    for (const c of calls) {
      if (!c.id.startsWith(art)) continue;
      expect(hasSprite(c.id), c.id).toBe(true);
      expect(Number.isInteger(c.frame), `${c.id} frame ${c.frame}`).toBe(true);
      expect(c.frame, c.id).toBeGreaterThanOrEqual(0);
      const name = c.id.slice(art.length);
      // ride-* strips loop on the world tick (the sprite system wraps), the picks and the hop do not.
      if (name === 'mount-hop' || this.picked()) expect(c.frame, c.id).toBeLessThan(frameCount(c.id));
      const key = name === 'mount-hop' ? 'hop' : name.replace('ride-', '');
      let s = this.seen.get(key);
      if (!s) this.seen.set(key, (s = new Set()));
      s.add(c.frame % frameCount(c.id));
    }
  }

  private picked(): boolean {
    return (this.swan as unknown as { riderFrame: number }).riderFrame >= 0;
  }

  /** Aim the neck to frame i (0..8) and hold it there (presentation: the pose follows the neck). */
  aim(i: number, n: number): this {
    const s = this.swan as unknown as { neckAngle: number; neckTarget: number };
    const a = SWAN_NECK_MIN - i * SWAN_NECK_STEP;
    for (let k = 0; k < n; k++) {
      s.neckAngle = a;
      s.neckTarget = a;
      this.run(1);
    }
    return this;
  }
}

let SWAN_NECK_MIN = 0;
let SWAN_NECK_STEP = 0;

describe('the riders headless on the Swan: every pick an existing frame; the hop is draw-only', () => {
  beforeAll(async () => {
    const { SWAN } = await import('../../src/game/content/vehicles/swan/constants');
    SWAN_NECK_MIN = (SWAN as unknown as { neckMin: number }).neckMin;
    SWAN_NECK_STEP = (SWAN as unknown as { neckStep: number }).neckStep;
  });

  const ride = (r: Rig, hop = true): Rig => {
    const s = r.swan;
    r.run(10);
    (r.p as unknown as { hopArmed: boolean }).hopArmed = hop;
    s.mount(r.p);
    (r.p as unknown as { hopArmed: boolean }).hopArmed = false;
    r.run(40);                                       // the hop, the rise, idle
    r.hold('right').run(80);                         // run (lean 0 / 1)
    r.hold('left').run(14);                          // the skid (up)
    r.hold().run(40);
    r.aim(5, 10).aim(6, 40).aim(7, 20).aim(8, 20).aim(2, 10); // up, hunch, back to forward
    r.hold('down').run(40);                          // crouch (duck)
    r.hold('down', 'right').run(40);                 // waddle
    r.hold().run(20);
    r.tap('jump').run(120);                          // squat (hold), jump, fall, land (brace)
    r.run(250);
    r.tap('fire', 'bomb').run(40);                   // HONK (ears)
    (s as unknown as { bossCheer: boolean }).bossCheer = true;
    r.run(40);                                       // cheer
    (s as unknown as { bossCheer: boolean }).bossCheer = false;
    r.run(20);
    return r;
  };

  for (const [hero] of SETS) {
    for (const mute of [false, true]) {
      it(`${hero}${mute ? ' on the black swan (P2)' : ''}: the hop, then every rider pose; each drawn frame exists`, () => {
        const r = ride(new Rig(hero, mute));
        const want: Record<string, number> = { hop: 5, sit: 2, lean: 2, up: 1, hunch: 1, hold: 1, brace: 1, duck: 1, ears: 2, cheer: 2 };
        for (const [k, n] of Object.entries(want)) {
          const got = r.seen.get(k);
          expect(got, `${k} drawn`).toBeDefined();
          expect(got!.size, `${k} frames drawn: ${[...(got ?? [])].join(',')}`).toBeGreaterThanOrEqual(n);
        }
      });
    }
  }

  it('the hop and the rider art never touch the logic: with or without them, the same run tick by tick', () => {
    const a = ride(new Rig('vincent', false, true));
    const b = ride(new Rig('vincent', false, false), false);
    expect(a.trace.length).toBeGreaterThan(700);
    expect(b.trace).toEqual(a.trace);
  });
});
