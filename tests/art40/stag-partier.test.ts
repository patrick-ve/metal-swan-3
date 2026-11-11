/**
 * The stag partier at 40 px, looks 0 and 2 (docs/design/ams40.md wave 3): the baked sets
 * `stag-partier` and `stag-partier-2` (src/game/content/art40/stag-partier*.gen.ts, drawn by
 * tools/art40/chars/stag-partier/ (the shared stag kit and strips) and stag-partier-2/) keep the strip
 * contract of docs/design/ams40/contract.md "stag partier": the ids (look 0 also holds the selfie
 * flash), the frame counts of the plan's class table, the logic times (fire 21 ticks with the pop at
 * tick 3, the toast 70 with the clink on TOAST_CLINK, deaths, sit strips), the feet anchor, the
 * seated hip SEAT_HIP over the stool's floor point, the points hand / head / hip on every frame, the
 * walk stride for 0.7 px/tick (rule 5), 1× pixels at every art tier (rule 7), 28 colours (D1); the
 * partier's own update loop (StagPartier, on foot and on the beer bike's stool) picks an existing
 * frame at every tick of every state, fires the cork on the pop frame and clinks on TOAST_CLINK; the
 * gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as GEN0 from '../../src/game/content/art40/stag-partier.gen';
import * as GEN2 from '../../src/game/content/art40/stag-partier-2.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/stag/index';
import { FIRE_POP, FIRE_POP_TICK, SIT_CRANK_FRAMES, TOAST_CLINK } from '../../src/game/content/stag/art';
import '../../src/game/content/vehicles/beer-bike/index';
import '../../src/game/content/vehicles/beer-bike/art';
import { STAG, StagBeerBike, StagPartier } from '../../src/game/content/stag/index';
import { getEntityMeta } from '../../src/game/registry';
import { FLOOR, TestWorld } from '../content/helpers';

interface ContractEntry {
  character: string;
  set: string;
  strip: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  defer?: boolean;
  totalTicks?: number;
  anchorKind?: string;
  speed?: number;
  events?: { name: string; tick: number; kind: string }[];
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const JOINTS = (slug: string): Record<string, Record<string, [number, number]>[]> =>
  JSON.parse(readFileSync(`tools/art40/joints/${slug}.json`, 'utf8')).strips;

const LOOKS: ReadonlyArray<readonly [slug: string, set: BakedSet, prefix: string]> = [
  ['stag-partier', GEN0.SET, 'enemy/stag-partier'],
  ['stag-partier-2', GEN2.SET, 'enemy/stag-partier-2'],
];
const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const contractIds = (prefix: string): string[] =>
  Object.keys(CONTRACT).filter((id) => CONTRACT[id].set === `${prefix}/`).sort();

/** Frame counts (the plan's class table), durations, loop, defer and class of every strip. */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, defer: boolean, cls: string]>> = {
  idle: [4, [12, 12, 12, 12], true, false, 'idle-breathing'],
  walk: [12, Array(12).fill(4), true, false, 'locomotion'],
  turn: [2, [2, 2], true, false, 'turn'],
  alert: [1, [30], true, false, 'telegraph'],
  tell: [6, Array(6).fill(4), true, false, 'telegraph'],
  fire: [10, [2, 1, 2, 2, 2, 2, 2, 2, 3, 3], false, false, 'shoot'],
  'gag-toast': [8, [8, 6, 6, 5, 7, 12, 12, 14], true, false, 'idle-fidget'],
  'gag-selfie': [8, [6, 6, 6, 4, 8, 8, 5, 5], true, false, 'idle-fidget'],
  'photo-pose': [6, [8, 6, 10, 10, 6, 8], true, true, 'victory'],
  gloat: [6, [5, 4, 5, 5, 4, 5], true, true, 'victory'],
  cower: [4, [3, 3, 3, 3], true, true, 'reaction'],
  die: [10, [4, 5, 5, 6, 4, 5, 6, 6, 8, 20], false, false, 'death-shot'],
  'die-knife': [10, [3, 3, 4, 4, 4, 4, 5, 3, 6, 20], false, true, 'death-shot'],
  'die-blast': [10, [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], false, true, 'death-blast'],
  'die-burn': [8, [3, 4, 4, 10, 7, 5, 4, 5], false, true, 'death-burn'],
  'die-crush': [6, [7, 3, 10, 6, 6, 15], false, true, 'death-crush'],
  sit: [8, [4, 3, 4, 3, 4, 3, 4, 3], true, false, 'idle-breathing'],
  'sit-tell': [6, Array(6).fill(4), true, false, 'telegraph'],
  'sit-fire': [10, [2, 1, 2, 2, 2, 2, 2, 2, 3, 3], false, false, 'shoot'],
  'sit-gloat': [6, [5, 4, 5, 5, 4, 5], true, true, 'victory'],
  'sit-cower': [4, [3, 3, 3, 3], true, true, 'reaction'],
  'die-stool': [10, [4, 5, 5, 3, 5, 5, 5, 6, 4, 12], false, false, 'death-shot'],
  flash: [3, [2, 3, 4], false, true, 'prop'],
};
/**
 * The loops whose length changed (no code reads them as time; logged in the plan's sense): the walk
 * 8 x 7 = 56 -> 12 x 4 = 48 ticks (a 33.6 px stride at 0.7 px/tick for 40 px legs: the old 39.2 px
 * lunge was the old 37 px rig's; only the speed is contract, like the baker and the handhaver), the
 * tell 3 x 4 -> 6 x 4 (two shakes per loop; the telegraph STAG.tele runs whatever it is), cower 2 x 3
 * -> 4 x 3 (the knees knock), photo-pose 1 x 6 -> 6 frames (48: the SAY CHEESE pose and its blink).
 */
const CHANGED_LOOPS: Readonly<Record<string, readonly [old: number, now: number]>> = {
  walk: [56, 48],
  tell: [12, 24],
  'sit-tell': [12, 24],
  cower: [6, 12],
  'sit-cower': [6, 12],
  'photo-pose': [6, 48],
};
/** Smear frames: the pop (the kick and the jet), the blast's whirl, the crush's impact, the stool's tip over. */
const SMEARS: Readonly<Record<string, readonly number[]>> = { fire: [2], 'sit-fire': [2], 'die-blast': [5], 'die-crush': [1], 'die-stool': [3] };
const SEATED = ['sit', 'sit-tell', 'sit-fire', 'sit-gloat', 'sit-cower'];
const DEATHS = ['die', 'die-knife', 'die-blast', 'die-burn', 'die-crush', 'die-stool'];
/** The game's old numbers (src/game/content/stag/partier.ts before this work, docs/design/ams40/contract.md). */
const OLD = {
  hp: 20, groomHp: 40, score: 300, groomScore: 1000, walk: 0.7, far: 160, back: 48, backTo: 64, range: 230, seatedRange: 260,
  tele: 24, fireTicks: 21, popAt: 3, recover: 50, cool: 60, coolJitter: 30, corkSpeed: 2.2, chestY: 25, corkW: 6, corkH: 4,
  corkLife: 300, seatBox: { x: -7, y: -40, w: 14, h: 27 }, flashEvery: 50, phone: [9, -39], seatedPhone: [9, -42],
};

describe.each(LOOKS)('%s: the set', (slug, SET, PREFIX) => {
  const ids = contractIds(PREFIX);
  const strips = Object.keys(STRIPS).filter((n) => slug === 'stag-partier' || n !== 'flash');

  it('registers exactly the contract ids (docs/design/ams40/contract.json), no variants; look 0 holds the flash', () => {
    expect(ids.length).toBe(slug === 'stag-partier' ? 23 : 22);
    expect([...bakedSetIds(SET)].sort()).toEqual(ids);
    expect(SET.prefix).toBe(PREFIX);
    expect(SET.slug).toBe(slug);
    expect(SET.variants ?? {}).toEqual({});
    expect(SET.face).toBe(1);
    for (const id of ids) expect(hasSprite(id), id).toBe(true);
    expect(Object.keys(SET.strips).sort()).toEqual([...strips].sort());
  });

  it('frame counts, durations, loop and defer flags: the class table and the contract logic time', () => {
    for (const name of strips) {
      const [n, d, loop, defer, cls] = STRIPS[name];
      const st = SET.strips[name];
      const c = CONTRACT[`${PREFIX}/${name}`];
      expect(st.frames.length, name).toBe(n);
      expect(st.durations, name).toEqual(d);
      expect(st.loop, name).toBe(loop);
      expect(st.loop, `${name} loop = contract`).toBe(c.loop);
      expect(st.defer ?? false, name).toBe(defer);
      expect(st.defer ?? false, `${name} defer = contract`).toBe(c.defer ?? false);
      expect(st.cls, name).toBe(cls);
      if (CHANGED_LOOPS[name]) {
        expect([c.totalTicks, sum(st.durations)], `${name}: a logged loop change`).toEqual(CHANGED_LOOPS[name]);
        expect(st.loop, `${name} is a loop`).toBe(true);
      } else expect(sum(st.durations), `${name} logic time`).toBe(c.totalTicks);
      // the registry plays the baked durations
      expect(frameCount(`${PREFIX}/${name}`), name).toBe(n);
      expect(spriteAnim(`${PREFIX}/${name}`).durations, name).toEqual(d);
      expect(spriteAnim(`${PREFIX}/${name}`).loop, name).toBe(loop);
    }
  });

  it('every frame decodes: w*h pixels, palette indices in range, at most 28 colours (FX outside), the one outline', () => {
    expect(SET.budget).toBe(28);
    const fx = new Set(SET.fx ?? []);
    const body = SET.pal.slice(1).filter((_, i) => !fx.has(i + 1));
    expect(body.length).toBeLessThanOrEqual(28);
    expect(new Set(SET.pal.slice(1)).size).toBe(SET.pal.length - 1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    for (const i of fx) expect(['#ffffff', '#fffbd8', '#ffe070', '#ffd040', '#ff8a24', '#e0401c', '#bfe4ff', '#7fb4e8', '#7a6e70', '#4a4046']).toContain(SET.pal[i]);
    for (const [name, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const idx = decodeBakedIndices(f);
        expect(idx.length, `${name}#${i}`).toBe(f.w * f.h);
        let max = 0;
        let solid = 0;
        for (const v of idx) {
          if (v > max) max = v;
          if (v) solid++;
        }
        expect(max, `${name}#${i}`).toBeLessThan(SET.pal.length);
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(name === 'flash' ? 8 : name === 'turn' ? 150 : 300);
      });
    }
  });

  it('the anchor and every contract point on every frame; the seated hip SEAT_HIP over the stool; smears only where allowed', () => {
    for (const name of strips) {
      const st = SET.strips[name];
      const c = CONTRACT[`${PREFIX}/${name}`];
      st.frames.forEach((f, i) => {
        const at = `${name}#${i}`;
        expect(f.smear ?? false, `${at} smear`).toBe((SMEARS[name] ?? []).includes(i));
        if (name === 'flash') {
          // the centre anchor (the FX spawns at the phone)
          expect([f.ox, f.oy], at).toEqual([(f.w - 1) / 2, (f.h - 1) / 2]);
          expect(f.w, at).toBeLessThanOrEqual(11);
          return;
        }
        expect(f.ox, at).toBeGreaterThanOrEqual(0);
        expect(f.ox, at).toBeLessThan(f.w);
        if (SEATED.includes(name)) {
          // the floor under the stool: the feet rest on the pedals above it
          expect(f.oy, at).toBeGreaterThanOrEqual(f.h);
          expect(f.pts!.hip, at).toEqual([0, -18]);
        } else if ((name === 'die-blast' && i < 6) || (name === 'die-stool' && i < 5)) {
          // airborne in the game's launch arc, or still on (and tipping off) the stool: never under
          // the floor line
          expect(f.oy, at).toBeGreaterThanOrEqual(f.h);
        } else expect(f.oy, at).toBe(f.h); // feet: the line under the soles (lying: under the body)
        // the contract's points of the old frame (the old crush lost them on its flat frames): every
        // new frame carries all three
        const old = c.framePoints[Math.min(i, c.framePoints.length - 1)];
        for (const p of old) expect(['hand', 'head', 'hip'], at).toContain(p);
        const want = ['hand', 'head', 'hip'];
        const extra = Object.keys(f.pts ?? {}).filter((p) => !want.includes(p));
        expect(extra, at).toEqual(name === 'walk' ? ['plant'].filter((p) => f.pts?.[p]) : []);
        for (const p of want) {
          const pt = f.pts?.[p];
          expect(pt, `${at} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${at} ${p}`).toBe(true);
        }
        if (!DEATHS.includes(name) && name !== 'cower' && name !== 'sit-cower') {
          // upright: the hip 15-19 px over the floor, the head over the hip
          expect(-f.pts!.hip[1], `${at} hip`).toBeGreaterThanOrEqual(15);
          expect(-f.pts!.hip[1], `${at} hip`).toBeLessThanOrEqual(19);
          expect(f.pts!.head[1], `${at} head`).toBeLessThan(f.pts!.hip[1] - 10);
        }
      });
    }
  });

  it('a 40 px figure (D7): 40-44 px standing, wider than tall never (heavy / stocky, not taller)', () => {
    for (const name of ['idle', 'walk', 'tell', 'fire', 'gag-toast']) {
      for (const f of SET.strips[name].frames) {
        expect(f.oy, name).toBeGreaterThanOrEqual(40);
        expect(f.oy, name).toBeLessThanOrEqual(44);
      }
    }
    for (const f of SET.strips.idle.frames) expect(f.w).toBeLessThanOrEqual(26);
  });

  it('no two consecutive frames are the same picture (loops: also the last and the first)', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const n = st.frames.length;
      if (n < 2) continue; // the alert: one held pose (class telegraph)
      for (let i = 0; i < (st.loop ? n : n - 1); i++) {
        const a = st.frames[i];
        const b = st.frames[(i + 1) % n];
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${name} ${i}->${(i + 1) % n}`).toBe(false);
      }
    }
  });

  it('the walk: the planted foot drifts at most 1 px a frame at 0.7 px/tick (rule 5), a 33.6 px cycle', () => {
    const walk = SET.strips.walk;
    expect(CONTRACT[`${PREFIX}/walk`].speed).toBe(STAG.walk);
    expect(sum(walk.durations) * STAG.walk).toBeCloseTo(33.6, 6);
    let same = 0;
    for (let i = 0; i < walk.frames.length; i++) {
      const a = walk.frames[i].pts?.plant;
      const b = walk.frames[(i + 1) % walk.frames.length].pts?.plant;
      expect(a, `walk#${i} plant`).toBeDefined();
      if (!a || !b) continue;
      // facing right and walking right: the planted foot moves back by speed x hold, or the other foot takes over
      const dx = b[0] - a[0];
      const step = -STAG.walk * walk.durations[i];
      if (Math.abs(dx - step) <= 1) same++;
      else expect(Math.abs(dx), `walk#${i}: a foot change`).toBeGreaterThanOrEqual(6);
      expect(Math.abs(a[1]), `walk#${i} plant on the floor`).toBeLessThanOrEqual(1);
    }
    expect(same).toBeGreaterThanOrEqual(9);
  });

  it('1x pixels at every art tier (rule 7): no dense art, getFrames(id, 2|4) give the 1x frames', () => {
    for (const id of ids) {
      expect(hasHiSprite(id, 2), id).toBe(false);
      expect(hasHiSprite(id, 4), id).toBe(false);
      const one = getFrames(id, 1);
      for (const d of [2, 4]) {
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}`).toBe(one.length);
        hi.forEach((f, i) => {
          expect(f.density ?? 1, `${id}@${d}#${i}`).toBe(1);
          expect(Array.from(f.buf.data), `${id}@${d}#${i}`).toEqual(Array.from(one[i].buf.data));
        });
      }
    }
  });

  it('the look: the lime party shirt in every frame but the cower and the soot statue; the bottle green in the attacks', () => {
    const idxOf = (hex: string): number => SET.pal.indexOf(hex);
    const lime = ['#c8f04a', '#8cc828', '#4f8a1c'].map(idxOf);
    const glass = ['#2f8a58', '#1a5a3a'].map(idxOf);
    expect(lime.every((k) => k > 0) && glass.every((k) => k > 0)).toBe(true);
    const has = (f: BakedSet['strips'][string]['frames'][number], ks: number[]): boolean => decodeBakedIndices(f).some((v) => ks.includes(v));
    for (const [name, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        if (name === 'flash' || (name === 'die-burn' && i >= 3)) return;
        // the cower: the shirt pulled over his head (a lime bundle) - still lime
        expect(has(f, lime), `${name}#${i} lime`).toBe(true);
      });
    }
    // a blast keeps the party shirt green (no singe to ink)
    for (const f of SET.strips['die-blast'].frames) expect(has(f, lime)).toBe(true);
    for (const name of ['tell', 'fire', 'sit-tell', 'sit-fire', 'gag-toast']) for (const f of SET.strips[name].frames) expect(has(f, glass), name).toBe(true);
  });
});

describe('stag partier: the code', () => {
  it('the bake exports the frame roles; art.ts re-exports them; both looks agree', () => {
    for (const G of [GEN0, GEN2]) {
      expect(G.FIRE_POP).toBe(FIRE_POP);
      expect(G.FIRE_POP_TICK).toBe(FIRE_POP_TICK);
      expect(G.TOAST_CLINK).toBe(TOAST_CLINK);
      expect(G.SIT_CRANK_FRAMES).toBe(SIT_CRANK_FRAMES);
      expect(G.SET.events).toEqual({ FIRE_POP, FIRE_POP_TICK, TOAST_CLINK, SIT_CRANK_FRAMES });
    }
  });

  it('FIRE_POP: inside the fire strips, starting at STAG.popAt (the contract event tick 3), the strip 21 ticks = STAG.fireTicks', () => {
    for (const [, SET, PREFIX] of LOOKS) {
      for (const name of ['fire', 'sit-fire']) {
        const st = SET.strips[name];
        expect(FIRE_POP).toBeGreaterThan(0);
        expect(FIRE_POP).toBeLessThan(st.frames.length);
        expect(sum(st.durations.slice(0, FIRE_POP))).toBe(FIRE_POP_TICK);
        expect(FIRE_POP_TICK).toBe(STAG.popAt);
        expect(CONTRACT[`${PREFIX}/${name}`].events).toEqual([{ name: 'FIRE_POP', tick: STAG.popAt, kind: 'frame' }]);
        expect(sum(st.durations)).toBe(STAG.fireTicks);
        // anticipation before the pop, a recoil and a settle after it
        expect(st.frames.length - FIRE_POP - 1).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("the pop frame's bottle mouth is where the cork leaves (x + 12, y - 25): within 4 px; the gloat's phone at STAG.phone", () => {
    for (const [slug] of LOOKS) {
      const J = JOINTS(slug);
      for (const name of ['fire', 'sit-fire']) {
        const m = J[name][FIRE_POP]['armN.mouth'];
        expect(m, `${slug} ${name}`).toBeDefined();
        expect(Math.hypot(m[0] - 12, m[1] + STAG.chestY), `${slug} ${name} mouth ${m}`).toBeLessThanOrEqual(4);
      }
      for (const [name, ph] of [['gloat', STAG.phone], ['sit-gloat', STAG.seatedPhone]] as const) {
        for (const j of J[name]) {
          const cam = j['armN.cam'];
          expect(Math.hypot(cam[0] - ph[0], cam[1] - ph[1]), `${slug} ${name} cam ${cam}`).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it('TOAST_CLINK: the bottle thrust out to the neighbour, inside the toast; SIT_CRANK_FRAMES: the pedal cycle', () => {
    for (const [slug, SET] of LOOKS) {
      const toast = SET.strips['gag-toast'];
      expect(TOAST_CLINK).toBeGreaterThan(0);
      expect(TOAST_CLINK).toBeLessThan(toast.frames.length);
      // the bottle's mouth is furthest forward on the clink frame (the neighbour stands 16 px away)
      const J = JOINTS(slug)['gag-toast'];
      const xs = J.map((j) => j['armN.mouth'][0]);
      expect(Math.max(...xs), slug).toBe(xs[TOAST_CLINK]);
      expect(xs[TOAST_CLINK]).toBeGreaterThanOrEqual(10);
      expect(SET.strips.sit.frames.length).toBe(SIT_CRANK_FRAMES);
    }
  });

  it('the turn keeps 2 frames at 2 ticks (the Turner: widths 2, ticksPerFrame 2)', () => {
    for (const [, SET] of LOOKS) expect(SET.strips.turn.durations).toEqual([2, 2]);
  });
});

/** Every sprite drawn, through a recording renderer. */
function recorder(): { r: SoftRenderer; calls: Array<[string, number]> } {
  const r = new SoftRenderer();
  const calls: Array<[string, number]> = [];
  const own = r.sprite.bind(r);
  r.sprite = (id: string, i: number, x: number, y: number, o?: DrawOpts) => {
    calls.push([id, i]);
    own(id, i, x, y, o);
  };
  return { r, calls };
}

function expectValid(calls: Array<[string, number]>): number {
  let n = 0;
  for (const [id, i] of calls) {
    if (!/^enemy\/stag-partier(-2)?\//.test(id)) continue;
    n++;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} index ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
  return n;
}

describe('stag partier: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): STAG, the hitbox 14 x 30, hp, score, the seated box', () => {
    expect({ ...STAG, groomVy: undefined }).toEqual({ ...OLD, groomVy: undefined });
    expect(STAG.groomVy).toEqual([0, -0.22, -0.44]);
    expect(getEntityMeta('stag-partier')?.score).toBe(300);
    for (const look of [0, 2]) {
      const tw = new TestWorld({ playerX: 60, god: true });
      const e = tw.spawn('stag-partier', 300, { look }) as StagPartier;
      expect(e.hitbox).toEqual({ x: -7, y: -30, w: 14, h: 30 });
      expect(e.hp).toBe(20);
      expect(e.spriteId('idle')).toBe(look === 0 ? 'enemy/stag-partier/idle' : 'enemy/stag-partier-2/idle');
    }
  });

  for (const look of [0, 2]) {
    it(`look ${look} on foot: walk, tell, fire (the cork on FIRE_POP at tick popAt), recover; every tick draws an existing frame`, () => {
      const tw = new TestWorld({ playerX: 60, god: true, seed: 3 });
      const e = tw.spawn('stag-partier', 330, { look, facing: -1 }, FLOOR) as StagPartier;
      const { r, calls } = recorder();
      const seen = new Set<string>();
      let corks = 0;
      let popChecked = 0;
      let prev = -1;
      const live = new Set<unknown>();
      for (let t = 0; t < 900; t++) {
        tw.run(1);
        e.draw(r);
        seen.add(e.mode);
        const fresh = tw.ofType('cork').filter((c) => !live.has(c));
        for (const c of fresh) live.add(c);
        if (fresh.length > 0) {
          // the cork leaves while the pop frame shows: the strip starts on the tick of setMode('fire'),
          // so the pop frame (from strip tick popAt) shows one tick before modeT reaches popAt, exactly
          // as the old 3-frame strip did
          corks += fresh.length;
          expect(e.mode).toBe('fire');
          expect(e.modeT).toBe(STAG.popAt);
          expect(e.anim.id).toBe(e.spriteId('fire'));
          expect(e.anim.index).toBe(FIRE_POP);
          expect(prev).toBe(FIRE_POP);
          popChecked++;
        }
        prev = e.anim.id === e.spriteId('fire') ? e.anim.index : -1;
        if (e.mode === 'walk' && e.playing('walk')) expect(Math.abs(e.vx)).toBeCloseTo(STAG.walk, 6);
      }
      expect(seen.has('walk')).toBe(true);
      expect(seen.has('tell')).toBe(true);
      expect(seen.has('fire')).toBe(true);
      expect(seen.has('recover')).toBe(true);
      expect(popChecked).toBeGreaterThan(0);
      expect(corks).toBe(popChecked);
      expect(expectValid(calls)).toBeGreaterThan(800);
      expect(tw.world.errors).toEqual([]);
    });
  }

  it('the toast gag clinks (ams/clink) exactly when the frame becomes TOAST_CLINK; the selfie gag runs', () => {
    const tw = new TestWorld({ playerX: null });
    const a = tw.spawn('stag-partier', 300, { gag: 'toast', facing: 1, look: 0 }, FLOOR) as StagPartier;
    const b = tw.spawn('stag-partier', 316, { gag: 'selfie', facing: -1, look: 2 }, FLOOR) as StagPartier;
    const sfx: string[] = [];
    const own = tw.world.audio.sfx.bind(tw.world.audio);
    tw.world.audio.sfx = ((id: string, o?: Record<string, unknown>) => {
      sfx.push(`${id}@${a.anim.index}`);
      return own(id, o as never);
    }) as typeof tw.world.audio.sfx;
    const { r, calls } = recorder();
    for (let t = 0; t < 200; t++) {
      tw.run(1);
      a.draw(r);
      b.draw(r);
    }
    expect(a.playing('gag-toast')).toBe(true);
    expect(b.playing('gag-selfie')).toBe(true);
    const clinks = sfx.filter((s) => s.startsWith('ams/clink'));
    expect(clinks.length).toBeGreaterThanOrEqual(2);
    for (const c of clinks) expect(c).toBe(`ams/clink@${TOAST_CLINK}`);
    expectValid(calls);
    expect(tw.world.errors).toEqual([]);
  });

  it('reactions: photo, gloat (the flash from the phone point), cower; then every death kind plays to its end', () => {
    for (const look of [0, 2]) {
      for (const kind of ['photo', 'gloat', 'cower'] as const) {
        const tw = new TestWorld({ playerX: 60, god: true });
        const e = tw.spawn('stag-partier', 250, { look }, FLOOR) as StagPartier;
        tw.run(2);
        expect(e.react(kind, 120, null)).toBe(true);
        const { r, calls } = recorder();
        for (let t = 0; t < 120; t++) {
          tw.run(1);
          e.draw(r);
        }
        expect(expectValid(calls)).toBeGreaterThan(100);
        expect(tw.world.errors).toEqual([]);
      }
      for (const dk of ['bullet', 'knife', 'explosion', 'fire', 'crush'] as const) {
        const tw = new TestWorld({ playerX: 60, god: true });
        const e = tw.spawn('stag-partier', 250, { look }, FLOOR) as StagPartier;
        tw.run(2);
        tw.world.damage(e, { amount: 100, kind: dk, dirX: 1, owner: 0 });
        const want = { bullet: 'die', knife: 'die-knife', explosion: 'die-blast', fire: 'die-burn', crush: 'die-crush' }[dk];
        expect(e.anim.id, dk).toBe(e.spriteId(want));
        const { r, calls } = recorder();
        let t = 0;
        while (!e.anim.done && t < 200) {
          tw.run(1);
          e.draw(r);
          t++;
        }
        expect(t, `${dk} plays its strip`).toBe(sum(spriteAnim(e.spriteId(want)).durations ?? [0]) );
        expectValid(calls);
        expect(tw.world.errors).toEqual([]);
      }
    }
  });

  it('on the beer bike: the riders pedal (sit), tell and fire from the stool, a hit tips them off (die-stool); every frame exists', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 5, width: 2000 });
    const bike = tw.spawn('stag-beer-bike', 380, { riders: 4, looks: [0, 2, 0, 2], facing: -1 }, FLOOR) as StagBeerBike;
    const { r, calls } = recorder();
    const strips = new Set<string>();
    for (let t = 0; t < 700; t++) {
      tw.run(1);
      bike.draw(r);
      for (const p of tw.ofType('stag-partier') as StagPartier[]) if (p.seat) strips.add(p.anim.id.split('/').pop()!);
    }
    expect(strips.has('sit')).toBe(true);
    expect(strips.has('sit-tell')).toBe(true);
    expect(strips.has('sit-fire')).toBe(true);
    const riders = (tw.ofType('stag-partier') as StagPartier[]).filter((p) => p.seat);
    expect(riders.length).toBeGreaterThan(0);
    for (const p of riders) expect(p.hitbox).toEqual(STAG.seatBox);
    const victim = riders[0];
    tw.world.damage(victim, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    expect(victim.anim.id).toBe(victim.spriteId('die-stool'));
    for (let t = 0; t < 60; t++) {
      tw.run(1);
      bike.draw(r);
      victim.draw(r);
    }
    expect(expectValid(calls)).toBeGreaterThan(1000);
    expect(tw.world.errors).toEqual([]);
  });
});
