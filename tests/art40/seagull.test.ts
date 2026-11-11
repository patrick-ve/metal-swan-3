/**
 * The herring gull at 40 px (docs/design/ams40.md wave 4): the baked set `seagull`
 * (src/game/content/art40/seagull.gen.ts, drawn by tools/art40/chars/seagull/) keeps the strip
 * contract of docs/design/ams40/contract.md "herring gull (seagull)": the 19 ids, the frame counts of
 * the plan's class table, the logic times (take-off 10 and pull-up 6 ticks: TAKEOFF_TIMING /
 * PULLUP_TIMING; the turn 2 frames x TURN_TICKS; the tell 20; the gloat 44 with the peck on
 * GLOAT_PECK at the old tick 16; the death totals: the corpse timer), the two anchors (the body
 * centre in the air, the feet when standing), the points head / mouth on every frame, 1x pixels at
 * every art tier (rule 7), 28 colours (D1). The gull's own update loop (seagull.ts) picks an existing
 * frame at every tick of every state, the peck sound plays on GLOAT_PECK, and the gameplay numbers
 * (hitboxes, speeds, HP, timings) are the ones from before this work (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { DamageKind } from '../../src/engine/entity';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { denseTarget, frameCount, getFrames, hasHiSprite, hasSprite, isDeferredSprite, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/seagull.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { SEAGULL, type Seagull } from '../../src/game/content/locals/index';
import { GLOAT_PECK, PULLUP_TIMING, TAKEOFF_TIMING, TURN_FRAMES, TURN_TICKS } from '../../src/game/content/locals/seagull.art';
import { reactInArea, startGloatHold } from '../../src/game/enemy';
import { getEntityMeta } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { FLOOR, TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PREFIX = 'enemy/seagull';

interface ContractEntry {
  character: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  defer?: boolean;
  totalTicks?: number;
  durations?: number[];
  anchor: [number, number];
  events?: { name: string }[];
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT).filter((id) => CONTRACT[id].character === 'seagull').sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const rep = (n: number, d: number): number[] => Array<number>(n).fill(d);

type Anchor = 'centre' | 'feet' | 'takeoff' | 'death' | 'prop';
/**
 * Frames, durations, loop, defer, class and anchor kind of every strip (the plan's class table;
 * 'flap' is the class table's alias of 'ride': a flap cycle, 12 frames, no foot contact).
 */
const STRIPS: Readonly<Record<string, readonly [n: number, durations: readonly number[], loop: boolean, defer: boolean, cls: string, anchor: Anchor]>> = {
  walk: [12, [2, 2, 2, 3, 3, 3, 2, 3, 3, 2, 3, 3], true, false, 'flap', 'centre'],
  idle: [12, [2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 3], true, false, 'flap', 'centre'],
  takeoff: [6, [2, 2, 1, 1, 2, 2], false, false, 'jump', 'takeoff'],
  'pull-up': [6, rep(6, 1), false, false, 'jump', 'centre'],
  turn: [2, [2, 2], true, false, 'turn', 'centre'],
  tell: [8, [3, 2, 2, 3, 3, 2, 2, 3], true, false, 'telegraph', 'centre'],
  attack: [10, rep(10, 2), true, false, 'shoot', 'centre'],
  perch: [4, [16, 8, 16, 10], true, false, 'idle-breathing', 'feet'],
  gag: [8, [10, 8, 10, 8, 6, 6, 6, 6], true, false, 'idle-fidget', 'feet'],
  'gag-fries': [8, [8, 4, 2, 6, 5, 3, 8, 10], true, false, 'idle-fidget', 'feet'],
  alert: [4, [4, 2, 2, 4], true, false, 'telegraph', 'feet'],
  'photo-pose': [6, [6, 4, 4, 6, 4, 4], true, false, 'victory', 'centre'],
  gloat: [7, [10, 4, 2, 8, 8, 6, 6], true, true, 'victory', 'feet'],
  cower: [6, rep(6, 3), true, true, 'reaction', 'centre'],
  die: [10, [3, 4, 4, 4, 4, 4, 4, 3, 5, 17], false, false, 'death-shot', 'death'],
  'die-blast': [10, [4, 4, 4, 4, 4, 4, 4, 5, 6, 8], false, false, 'death-blast', 'death'],
  'die-burn': [8, [4, 4, 5, 6, 6, 8, 9, 20], false, false, 'death-burn', 'death'],
  'die-crush': [6, [4, 2, 14, 6, 8, 13], false, false, 'death-crush', 'death'],
  feather: [8, rep(8, 3), true, false, 'prop', 'prop'],
};
/**
 * The logic time of a strip whose length the game reads (or sims see) stays the old total; the
 * others changed on purpose, each with its reason (the plan's class counts at a readable pace).
 */
const CHANGED: Readonly<Record<string, readonly [old: number, now: number, why: string]>> = {
  tell: [6, 20, 'one 8-frame KAW cycle = the telegraph at NORMAL (SEAGULL.tele 20); it loops for the tell'],
  walk: [20, 31, 'the 12-frame flap at most 3 px a tick at the wing tips (the smoothness gate); nothing reads it'],
  idle: [24, 26, 'the 12-frame hover, two eased turning points; nothing reads it'],
  attack: [8, 20, 'the 10-frame dive loop (two pecks); it loops for the whole dive'],
  'photo-pose': [6, 28, 'the 6-frame showy glide (was 1 frame); it loops for the reaction'],
  cower: [6, 18, 'the 6-frame frantic hover (was 2); it loops for the reaction'],
};
/** The smear frames (at most 2 per strip): the blurred wing sweeps, the strikes, the impacts. */
const SMEARS: Readonly<Record<string, readonly number[]>> = {
  takeoff: [2, 3],
  'gag-fries': [2],
  gloat: [2],
  die: [0, 5],
  'die-blast': [3, 6],
  'die-burn': [2],
  'die-crush': [1],
};
/** The FX ramp colours this set uses (rules.json fxRamp): flames, smoke, the wind streaks. */
const FX_RAMP = ['#ffffff', '#fffbd8', '#ffe070', '#ffd040', '#ff8a24', '#e0401c', '#bfe4ff', '#7fb4e8', '#7a6e70', '#4a4046'];

/** The gameplay numbers from before this work (seagull.ts at wave 0; docs/design/ams40/contract.md). */
const OLD_SEAGULL = {
  hp: 10, score: 150, wake: 96, fly: 1.4, amp: 9, wave: 70, diveEvery: 110, tele: 20, dive: 3, diveMax: 170, climb: 1.5,
  climbTicks: 36, hoverDx: 60, hoverDy: 64, flockDx: 22, flockDy: 12, flockStagger: 40, maxFlock: 5,
  box: { x: -10, y: -7, w: 20, h: 13 }, perchBox: { x: -9, y: -19, w: 18, h: 18 },
  gloatNear: 10, gloatSpread: 14, gloatEdge: 16, gloatHover: 40,
};

describe('seagull: the set', () => {
  it('registers exactly the contract ids (docs/design/ams40/contract.json), no variants, no dense art or alias', () => {
    expect(CONTRACT_IDS.length).toBe(19);
    expect([...bakedSetIds(SET)].sort()).toEqual(CONTRACT_IDS);
    expect(SET.prefix).toBe(PREFIX);
    expect(SET.slug).toBe('seagull');
    expect(SET.variants ?? {}).toEqual({});
    expect(SET.face ?? 1).toBe(1);
    for (const id of CONTRACT_IDS) {
      expect(hasSprite(id), id).toBe(true);
      expect(hasHiSprite(id, 2) || hasHiSprite(id, 4), id).toBe(false);
      // the old idle was a dense alias of the walk: now its own hover flap, no alias left
      expect(denseTarget(id, 4), id).toBe(id);
    }
  });

  it('frame counts, durations, loop and defer flags, classes: the class table and the contract logic time', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [name, [n, d, loop, defer, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[name];
      const id = `${PREFIX}/${name}`;
      const c = CONTRACT[id];
      expect(st.frames.length, name).toBe(n);
      expect(st.durations, name).toEqual(d);
      expect(st.loop, name).toBe(loop);
      expect(st.loop, `${name} loop = contract`).toBe(c.loop);
      expect(st.defer ?? false, name).toBe(defer);
      expect(st.defer ?? false, `${name} defer = contract`).toBe(c.defer ?? false);
      expect(isDeferredSprite(id), name).toBe(defer);
      expect(st.cls, name).toBe(cls);
      if (CHANGED[name]) {
        expect(c.totalTicks, `${name} old logic time`).toBe(CHANGED[name][0]);
        expect(sum(st.durations), `${name}: ${CHANGED[name][2]}`).toBe(CHANGED[name][1]);
      } else {
        expect(sum(st.durations), `${name} logic time = contract`).toBe(c.totalTicks);
      }
      // the registry plays the baked durations
      expect(frameCount(id), name).toBe(n);
      expect(spriteAnim(id).durations, name).toEqual(d);
      expect(spriteAnim(id).loop, name).toBe(loop);
    }
    // the frame counts of the plan's class table (a flap cycle is a locomotion cycle: 12)
    expect(SET.strips.walk.frames.length).toBe(12);
    expect(SET.strips.attack.frames.length).toBe(10);
    expect(SET.strips.die.frames.length).toBeGreaterThanOrEqual(10);
    expect(SET.strips['die-blast'].frames.length).toBe(10);
    expect(SET.strips['die-burn'].frames.length).toBeGreaterThanOrEqual(7);
    expect(SET.strips['die-crush'].frames.length).toBeGreaterThanOrEqual(5);
    expect(SET.strips.gloat.frames.length).toBeGreaterThanOrEqual(6);
    expect(SET.strips.gloat.frames.length).toBeLessThanOrEqual(8);
  });

  it('every frame decodes: w*h pixels, palette indices in range, 28 colours (FX outside), the one outline', () => {
    expect(SET.budget).toBe(28);
    const fx = new Set(SET.fx ?? []);
    const body = SET.pal.slice(1).filter((_, i) => !fx.has(i + 1));
    expect(body.length).toBeLessThanOrEqual(28);
    expect(new Set(SET.pal.slice(1)).size).toBe(SET.pal.length - 1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    for (const i of fx) expect(FX_RAMP).toContain(SET.pal[i]);
    // the look of the approved sample: white feathers, the silver-grey mantle, the yellow beak with
    // the red spot, the pink feet
    for (const c of ['#fdfcf6', '#cdd5e1', '#ffd43a', '#d8322a', '#f2a0a6']) expect(SET.pal, c).toContain(c);
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
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(name === 'feather' ? 10 : 200);
      });
    }
  });

  it('the anchors (as today) and the points head / mouth on every frame; smears only where listed', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const kind = STRIPS[name][5];
      const c = CONTRACT[`${PREFIX}/${name}`];
      st.frames.forEach((f, i) => {
        const at = `${name}#${i}`;
        expect(f.smear ?? false, `${at} smear`).toBe((SMEARS[name] ?? []).includes(i));
        if (kind === 'prop') return;
        // the contract's points (head and mouth: the drawn head and the beak tip) on every frame that
        // had them (the old crush squash dropped them on some frames); the new art has both everywhere
        const want = c.framePoints[Math.min(i, c.framePoints.length - 1)];
        for (const p of want) expect(['head', 'mouth'], at).toContain(p);
        expect(Object.keys(f.pts ?? {}).sort(), at).toEqual(['head', 'mouth']);
        const [hx, hy] = f.pts!.head;
        const [mx, my] = f.pts!.mouth;
        expect(Number.isFinite(hx) && Number.isFinite(hy) && Number.isFinite(mx) && Number.isFinite(my), at).toBe(true);
        // both inside the frame box
        for (const [x, y] of [f.pts!.head, f.pts!.mouth]) {
          expect(x + f.ox, at).toBeGreaterThanOrEqual(-1);
          expect(x + f.ox, at).toBeLessThanOrEqual(f.w + 1);
          expect(y + f.oy, at).toBeGreaterThanOrEqual(-1);
          expect(y + f.oy, at).toBeLessThanOrEqual(f.h + 1);
        }
        if (kind === 'feet') {
          // standing: the feet on the anchor line, the body centre 11 px (PERCH_LIFT) over it
          expect(f.oy, at).toBe(f.h);
          expect(hy, at).toBeLessThan(-8);
        } else if (kind === 'centre') {
          // flying: the anchor is the body centre, inside the bird
          expect(f.oy, at).toBeGreaterThan(4);
          expect(f.oy, at).toBeLessThan(f.h - 2);
          expect(f.ox, at).toBeGreaterThan(4);
          expect(f.ox, at).toBeLessThan(f.w - 4);
        }
      });
    }
    // the take-off: the perched art at the flying anchor (the feet 11 px under the body centre) on
    // the frames that still stand on the post
    for (const i of [0, 1, 2]) expect(SET.strips.takeoff.frames[i].h - SET.strips.takeoff.frames[i].oy, `takeoff#${i}`).toBe(11);
    // the deaths: the body centre 7 px over the anchor in the air (the game moves the anchor 7 px
    // down when it dies), and the corpse on the anchor line at the end
    for (const name of ['die', 'die-blast', 'die-burn', 'die-crush']) {
      const fs = SET.strips[name].frames;
      expect(fs[fs.length - 1].oy, `${name} last`).toBe(fs[fs.length - 1].h);
      // nothing under the anchor (the body falls onto the floor: no frame sinks into it)
      for (const f of fs) expect(f.oy, name).toBeGreaterThanOrEqual(f.h);
    }
    // at most 2 smears per strip (plan "animation design")
    for (const [name, st] of Object.entries(SET.strips)) expect(st.frames.filter((f) => f.smear).length, name).toBeLessThanOrEqual(2);
  });

  it('a 40 px cast member (D7): the standing gull 22-30 px tall, the flying gull 30-46 px wide, the feather small', () => {
    for (const f of SET.strips.perch.frames) {
      expect(f.h).toBeGreaterThanOrEqual(22);
      expect(f.h).toBeLessThanOrEqual(30);
    }
    for (const f of SET.strips.walk.frames) {
      expect(f.w).toBeGreaterThanOrEqual(30);
      expect(f.w).toBeLessThanOrEqual(46);
    }
    for (const f of SET.strips.feather.frames) expect(Math.max(f.w, f.h)).toBeLessThanOrEqual(12);
  });

  it('no two consecutive frames are the same picture (loops: also the last and the first)', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const n = st.frames.length;
      for (let i = 0; i < (st.loop ? n : n - 1); i++) {
        const a = st.frames[i];
        const b = st.frames[(i + 1) % n];
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${name} ${i}->${(i + 1) % n}`).toBe(false);
      }
    }
  });

  it('1x pixels at every art tier (rule 7): getFrames(id, 2|4) give the 1x frames', () => {
    for (const id of CONTRACT_IDS) {
      const one = getFrames(id, 1);
      for (const d of [2, 4]) {
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}`).toBe(one.length);
        hi.forEach((f, i) => {
          expect(f.density ?? 1, `${id}@${d}#${i}`).toBe(1);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}#${i}`).toEqual([one[i].buf.w, one[i].buf.h, one[i].ox, one[i].oy]);
          expect(Array.from(f.buf.data), `${id}@${d}#${i}`).toEqual(Array.from(one[i].buf.data));
        });
      }
    }
  });
});

describe('seagull: the code', () => {
  it('GLOAT_PECK: exported by the bake, re-exported for seagull.ts, inside the gloat, at the old peck tick 16', () => {
    expect(GEN.GLOAT_PECK).toBe(3);
    expect(SET.events?.GLOAT_PECK).toBe(GEN.GLOAT_PECK);
    expect(GLOAT_PECK).toBe(GEN.GLOAT_PECK);
    const g = SET.strips.gloat;
    expect(GLOAT_PECK).toBeGreaterThan(0);
    expect(GLOAT_PECK).toBeLessThan(g.frames.length);
    expect(CONTRACT[`${PREFIX}/gloat`].events).toEqual([{ name: 'GLOAT_PECK' }]);
    // the old gloat pecked on frame 1 after 16 ticks: the same tick now
    expect(sum(g.durations.slice(0, GLOAT_PECK))).toBe(16);
    // anticipation before (the look, the rear back, the strike smear), the gulp and settle after
    expect(GLOAT_PECK).toBeGreaterThanOrEqual(2);
    expect(g.frames.length - GLOAT_PECK - 1).toBeGreaterThanOrEqual(2);
    // the peck frame: the beak low, at the cobbles (lower than on any other gloat frame)
    const low = (i: number): number => g.frames[i].pts!.mouth[1];
    for (let i = 0; i < g.frames.length; i++) if (i !== GLOAT_PECK) expect(low(GLOAT_PECK), `vs ${i}`).toBeGreaterThan(low(i));
  });

  it('TAKEOFF_TIMING, PULLUP_TIMING, TURN_TICKS, TURN_FRAMES: the baked strips, the old logic time (10, 6, 2 x 2)', () => {
    expect(TAKEOFF_TIMING).toEqual(SET.strips.takeoff.durations);
    expect(PULLUP_TIMING).toEqual(SET.strips['pull-up'].durations);
    expect(sum(TAKEOFF_TIMING)).toBe(10);
    expect(sum(PULLUP_TIMING)).toBe(6);
    expect(TURN_TICKS).toBe(2);
    expect(TURN_FRAMES).toBe(2);
    expect(TURN_FRAMES).toBe(SET.strips.turn.frames.length);
    expect(SET.strips.turn.durations).toEqual([TURN_TICKS, TURN_TICKS]);
  });

  it('the draw-only strip pick (stripFrame in seagull.ts) gives an existing frame at every tick', () => {
    // the same function as seagull.ts: the frame of `timing` with `left` ticks to go
    const pick = (timing: readonly number[], total: number, left: number): number => {
      let t = total - left;
      for (let i = 0; i < timing.length; i++) {
        if (t < timing[i]) return i;
        t -= timing[i];
      }
      return timing.length - 1;
    };
    for (const [timing, name] of [[TAKEOFF_TIMING, 'takeoff'], [PULLUP_TIMING, 'pull-up']] as const) {
      const total = sum(timing);
      const seen = new Set<number>();
      for (let left = total; left >= 1; left--) {
        const i = pick(timing, total, left);
        expect(Number.isInteger(i) && i >= 0 && i < frameCount(`${PREFIX}/${name}`), `${name} left ${left}`).toBe(true);
        seen.add(i);
      }
      // every drawn frame is shown
      expect(seen.size, name).toBe(timing.length);
    }
  });
});

/** Every sprite the gulls draw, through a recording renderer. */
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

function expectValid(calls: ReadonlyArray<[string, number]>): void {
  for (const [id, i] of calls) {
    if (!id.startsWith(PREFIX)) continue;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} index ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
}

/** The frame the anim shows (the base Enemy.draw path) is inside its strip. */
function expectAnimValid(g: Seagull): void {
  if (g.anim.id === '') return; // not played yet (the spawn tick)
  expect(hasSprite(g.anim.id), g.anim.id).toBe(true);
  expect(g.anim.index, g.anim.id).toBeGreaterThanOrEqual(0);
  expect(g.anim.index, g.anim.id).toBeLessThan(frameCount(g.anim.id));
}

describe('seagull: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): HP, score, speeds, timings, the flying and the perched hitbox', () => {
    expect(SEAGULL).toEqual(OLD_SEAGULL);
    expect(getEntityMeta('seagull')?.category).toBe('enemy');
    const tw = new TestWorld({ god: true, playerX: 100 });
    const perched = tw.spawn('seagull', 300, { perch: true }, FLOOR - 50) as Seagull;
    const flying = tw.spawn('seagull', 220) as Seagull;
    expect(perched.hp).toBe(10);
    expect(flying.hp).toBe(10);
    expect({ ...perched.hitbox }).toEqual(OLD_SEAGULL.perchBox);
    expect({ ...flying.hitbox }).toEqual(OLD_SEAGULL.box);
  });

  it('perch, notice, take-off, flight, tell, dive, pull-up, turn: every drawn frame exists, the dive keeps its speed and its peck window', () => {
    const tw = new TestWorld({ god: true, playerX: 100, seed: 6 });
    const a = tw.spawn('seagull', 300, { perch: true }, FLOOR - 50) as Seagull;
    const b = tw.spawn('seagull', 200, { gag: 'fries' }) as Seagull;
    const c = tw.spawn('seagull', 160) as Seagull;
    const gulls = [a, b, c];
    const { r, calls } = recorder();
    const modes = new Set<string>();
    let diveTicks = 0;
    let peckTicks = 0;
    let tellLen = 0;
    const tells: number[] = [];
    tw.hold('right');
    for (let t = 0; t < 1400; t++) {
      for (const g of gulls) {
        if (!g.alive) continue;
        modes.add(g.mode);
        if (g.mode === 'dive' && (g.vx || g.vy)) {
          diveTicks++;
          // the dive: 3 px a tick, the peck (contact damage) only while diving
          expect(Math.hypot(g.vx, g.vy)).toBeCloseTo(SEAGULL.dive, 5);
          if (g.contactDamage) peckTicks++;
        } else if (g.mode !== 'dive') expect(g.contactDamage, g.mode).toBe(null);
        g.draw(r);
        expectAnimValid(g);
      }
      if (c.mode === 'tell') tellLen++;
      else if (tellLen) {
        tells.push(tellLen);
        tellLen = 0;
      }
      // switch the hero's side now and then: the turn
      if (t % 300 === 150) tw.player!.x = tw.player!.x < 200 ? 320 : 80;
      tw.run(1);
    }
    expectValid(calls);
    for (const m of ['gag', 'notice', 'fly', 'tell', 'dive', 'climb']) expect(modes, m).toContain(m);
    const strips = new Set(calls.map(([id]) => id));
    for (const s of ['gag', 'gag-fries', 'alert', 'takeoff', 'walk', 'tell', 'attack', 'pull-up', 'turn']) expect(strips, s).toContain(`${PREFIX}/${s}`);
    // every take-off and pull-up frame was drawn
    for (const s of ['takeoff', 'pull-up']) {
      const shown = new Set(calls.filter(([id]) => id === `${PREFIX}/${s}`).map(([, i]) => i));
      expect(shown.size, s).toBe(frameCount(`${PREFIX}/${s}`));
    }
    expect(diveTicks).toBeGreaterThan(0);
    expect(peckTicks).toBe(diveTicks);
    // the tell window: the telegraph of NORMAL (20 ticks), never shorter
    expect(tells.length).toBeGreaterThan(0);
    for (const n of tells) expect(n).toBeGreaterThanOrEqual(SEAGULL.tele - 1);
  });

  it('every death strip by damage kind: plays every frame that exists, lies the old total, then the corpse goes', () => {
    const kinds: Array<[DamageKind, string]> = [['bullet', 'die'], ['knife', 'die'], ['explosion', 'die-blast'], ['fire', 'die-burn'], ['crush', 'die-crush']];
    for (const [kind, strip] of kinds) {
      for (const perch of [false, true]) {
        const tw = new TestWorld({ god: true, playerX: 60 });
        const g = (perch ? tw.spawn('seagull', 240, { perch: true }) : tw.spawn('seagull', 240)) as Seagull;
        tw.run(2);
        tw.world.damage(g, { amount: 100, kind, dirX: 1, owner: 0 });
        expect(g.dead, `${kind} perch ${perch}`).toBe(true);
        const { r, calls } = recorder();
        let n = 0;
        while (!g.removed && n < 400) {
          g.draw(r);
          if (!g.removed) expectAnimValid(g);
          tw.run(1);
          n++;
        }
        expectValid(calls);
        expect(g.removed, `${kind} perch ${perch}: the corpse goes`).toBe(true);
        const drawn = calls.filter(([id]) => id === `${PREFIX}/${strip}`);
        expect(drawn.length, `${kind}: ${strip} drawn`).toBeGreaterThan(0);
        // the strip plays to its end (the corpse timer starts after it): its total ticks or more
        expect(n, `${kind} perch ${perch}`).toBeGreaterThanOrEqual(sum(SET.strips[strip].durations));
        expect(new Set(drawn.map(([, i]) => i)).size, `${kind}: every ${strip} frame`).toBe(frameCount(`${PREFIX}/${strip}`));
      }
    }
  });

  it('the death puff: 5 feathers (enemy/seagull/feather), each frame index inside the strip', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const g = tw.spawn('seagull', 240) as Seagull;
    tw.run(2);
    tw.world.damage(g, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(1);
    const fx = tw.world.entities.filter((e) => (e as unknown as { sprite?: string }).sprite === `${PREFIX}/feather`);
    expect(fx.length).toBe(5);
    const { r, calls } = recorder();
    for (let t = 0; t < 30; t++) {
      for (const e of fx) if (!e.removed) e.draw(r);
      tw.run(1);
    }
    expectValid(calls);
    expect(calls.some(([id]) => id === `${PREFIX}/feather`)).toBe(true);
  });

  it('the gloat: lands, pecks with the peck sound on GLOAT_PECK, every frame exists; the cower and SAY CHEESE too', () => {
    const C = TUNING.continues;
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const g = tw.spawn('seagull', 260) as Seagull;
    const p = tw.spawn('seagull', 200, { perch: true }, FLOOR - 40) as Seagull;
    // the frame the pecking gull just changed to when the peck sound plays (the sound is played in
    // its think, right after its anim changed)
    const pecks: number[][] = [];
    const sfx = vi.spyOn(tw.world.audio, 'sfx').mockImplementation((name: string) => {
      if (name === 'ams/gloat-peck') pecks.push([g, p].filter((x) => x.anim.id === `${PREFIX}/gloat` && x.anim.changed).map((x) => x.anim.index));
      return undefined as never;
    });
    const { r, calls } = recorder();
    startGloatHold(tw.world);
    for (let t = 1; t <= 300; t++) {
      if (t % C.gloatEvery === 1) reactInArea(tw.world, tw.world.camera.view(), 'gloat', C.gloatTicks, { onScreen: true, source: spot });
      tw.run(1);
      for (const x of [g, p]) {
        x.draw(r);
        expectAnimValid(x);
      }
    }
    expect(g.anim.id).toBe(`${PREFIX}/gloat`);
    expect(pecks.length).toBeGreaterThan(0);
    for (const at of pecks) expect(at).toContain(GLOAT_PECK);
    // the cower (in the air) and SAY CHEESE
    reactInArea(tw.world, tw.world.camera.view(), 'cower', C.cowerTicks, { onScreen: true, source: spot });
    for (let t = 0; t < 40; t++) {
      tw.run(1);
      for (const x of [g, p]) {
        x.draw(r);
        expectAnimValid(x);
      }
    }
    reactInArea(tw.world, tw.world.camera.view(), 'photo', 60, { onScreen: true, source: spot });
    for (let t = 0; t < 70; t++) {
      tw.run(1);
      for (const x of [g, p]) {
        x.draw(r);
        expectAnimValid(x);
      }
    }
    sfx.mockRestore();
    expectValid(calls);
    const strips = new Set(calls.map(([id]) => id));
    for (const s of ['gloat', 'cower']) expect(strips, s).toContain(`${PREFIX}/${s}`);
  });
});
