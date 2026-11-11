/**
 * The stag groom at 40 px (docs/design/ams40.md wave 3): the baked set `stag-groom`
 * (src/game/content/art40/stag-groom.gen.ts, drawn by tools/art40/chars/stag-groom/ on the shared
 * stag kit of tools/art40/chars/stag-partier/) keeps the strip contract of
 * docs/design/ams40/contract.md "stag partier" for `enemy/stag-groom/*`: the 22 partier strips with
 * his parts (the L-plate, the pink tutu, the veil with the tiara) and `veil` (the veil flying off
 * his head, tumbled by the game on his death). Frame counts of the plan's class table, the logic
 * times, the feet anchor, the seated hip, the points, the walk stride, 1x pixels at every tier, 28
 * colours; the veil's and the tutu's secondary motion (the veil on every live frame, never on a
 * death; it flies back on the pop); the groom's update loop (three corks on the pop frame, the veil
 * tumbling off on every death kind, the beer bike's front stool); the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/stag-groom.gen';
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
  set: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  defer?: boolean;
  totalTicks?: number;
  anchor?: unknown;
  size?: unknown;
  speed?: number;
  events?: { name: string; tick: number; kind: string }[];
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const J: Record<string, Record<string, [number, number]>[]> = JSON.parse(readFileSync('tools/art40/joints/stag-groom.json', 'utf8')).strips;

const SET: BakedSet = GEN.SET;
const PREFIX = 'enemy/stag-groom';
const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const ids = Object.keys(CONTRACT).filter((id) => CONTRACT[id].set === `${PREFIX}/`).sort();

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
  veil: [4, [6, 6, 6, 6], true, true, 'prop'],
};
/** The loops whose length changed with the partier looks (no code reads them as time; tests/art40/stag-partier.test.ts). */
const CHANGED_LOOPS: Readonly<Record<string, readonly [old: number, now: number]>> = {
  walk: [56, 48],
  tell: [12, 24],
  'sit-tell': [12, 24],
  cower: [6, 12],
  'sit-cower': [6, 12],
  'photo-pose': [6, 48],
};
const SMEARS: Readonly<Record<string, readonly number[]>> = { fire: [2], 'sit-fire': [2], 'die-blast': [5], 'die-crush': [1], 'die-stool': [3] };
const SEATED = ['sit', 'sit-tell', 'sit-fire', 'sit-gloat', 'sit-cower'];
const DEATHS = ['die', 'die-knife', 'die-blast', 'die-burn', 'die-crush', 'die-stool'];
const COWERS = ['cower', 'sit-cower'];
const FIGURE = Object.keys(STRIPS).filter((n) => n !== 'veil');

const idx = (hex: string): number => SET.pal.indexOf(hex);
const PINK = ['#ffb2d6', '#f0609a', '#a82e62'];
const LIME = ['#c8f04a', '#8cc828', '#4f8a1c'];
const RED_L = '#d8303c';
type BakedFrame = BakedSet['strips'][string]['frames'][number];
const has = (f: BakedFrame, hexes: readonly string[]): boolean => {
  const ks = hexes.map(idx);
  return decodeBakedIndices(f).some((v) => ks.includes(v));
};
/** How far the picture reaches behind the anchor (px; the set faces right, so behind = left). */
const behind = (f: BakedFrame): number => f.ox;

describe('stag groom: the set', () => {
  it('registers exactly the 23 contract ids (the veil, no flash), no variants', () => {
    expect(ids.length).toBe(23);
    expect(ids).toContain(`${PREFIX}/veil`);
    expect([...bakedSetIds(SET)].sort()).toEqual(ids);
    expect(SET.prefix).toBe(PREFIX);
    expect(SET.slug).toBe('stag-groom');
    expect(SET.variants ?? {}).toEqual({});
    expect(SET.face).toBe(1);
    for (const id of ids) expect(hasSprite(id), id).toBe(true);
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
  });

  it('frame counts, durations, loop and defer flags: the class table and the contract logic time', () => {
    for (const [name, [n, d, loop, defer, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[name];
      const c = CONTRACT[`${PREFIX}/${name}`];
      expect(st.frames.length, name).toBe(n);
      expect(st.durations, name).toEqual(d);
      expect(st.loop, name).toBe(loop);
      expect(st.loop, `${name} loop = contract`).toBe(c.loop);
      expect(st.defer ?? false, name).toBe(defer);
      expect(st.defer ?? false, `${name} defer = contract`).toBe(c.defer ?? false);
      expect(st.cls, name).toBe(cls);
      if (CHANGED_LOOPS[name]) expect([c.totalTicks, sum(st.durations)], `${name}: a logged loop change`).toEqual(CHANGED_LOOPS[name]);
      else expect(sum(st.durations), `${name} logic time`).toBe(c.totalTicks);
      expect(frameCount(`${PREFIX}/${name}`), name).toBe(n);
      expect(spriteAnim(`${PREFIX}/${name}`).durations, name).toEqual(d);
      expect(spriteAnim(`${PREFIX}/${name}`).loop, name).toBe(loop);
    }
  });

  it('every frame decodes: w*h pixels, indices in range, at most 28 colours (FX outside), the one outline', () => {
    expect(SET.budget).toBe(28);
    const fx = new Set(SET.fx ?? []);
    const body = SET.pal.slice(1).filter((_, i) => !fx.has(i + 1));
    expect(body.length).toBeLessThanOrEqual(28);
    expect(new Set(SET.pal.slice(1)).size).toBe(SET.pal.length - 1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    for (const i of fx) expect(['#ffffff', '#fffbd8', '#ffe070', '#ffd040', '#ff8a24', '#e0401c', '#bfe4ff', '#7fb4e8', '#7a6e70', '#4a4046']).toContain(SET.pal[i]);
    for (const [name, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const px = decodeBakedIndices(f);
        expect(px.length, `${name}#${i}`).toBe(f.w * f.h);
        let max = 0;
        let solid = 0;
        for (const v of px) {
          if (v > max) max = v;
          if (v) solid++;
        }
        expect(max, `${name}#${i}`).toBeLessThan(SET.pal.length);
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(name === 'veil' ? 40 : name === 'turn' ? 150 : 300);
      });
    }
  });

  it('the anchor and the points hand / head / hip on every figure frame; the seated hip; smears only where allowed; the veil centred', () => {
    for (const name of Object.keys(STRIPS)) {
      const c = CONTRACT[`${PREFIX}/${name}`];
      SET.strips[name].frames.forEach((f, i) => {
        const at = `${name}#${i}`;
        expect(f.smear ?? false, `${at} smear`).toBe((SMEARS[name] ?? []).includes(i));
        if (name === 'veil') {
          // the centre anchor (the game tumbles it from the head): within a pixel of the middle
          expect(Math.abs(f.ox - f.w / 2), at).toBeLessThanOrEqual(1);
          expect(Math.abs(f.oy - f.h / 2), at).toBeLessThanOrEqual(1);
          expect(f.w <= 18 && f.h <= 18, `${at} ${f.w}x${f.h}`).toBe(true);
          expect(f.pts ?? {}, at).toEqual({});
          return;
        }
        if (SEATED.includes(name)) {
          expect(f.oy, at).toBeGreaterThanOrEqual(f.h);
          expect(f.pts!.hip, at).toEqual([0, -18]);
        } else if ((name === 'die-blast' && i < 6) || (name === 'die-stool' && i < 5)) {
          expect(f.oy, at).toBeGreaterThanOrEqual(f.h);
        } else expect(f.oy, at).toBe(f.h);
        for (const p of c.framePoints[Math.min(i, c.framePoints.length - 1)]) expect(['hand', 'head', 'hip'], at).toContain(p);
        const extra = Object.keys(f.pts ?? {}).filter((p) => !['hand', 'head', 'hip'].includes(p));
        expect(extra, at).toEqual(name === 'walk' ? ['plant'].filter((p) => f.pts?.[p]) : []);
        for (const p of ['hand', 'head', 'hip']) {
          const pt = f.pts?.[p];
          expect(pt, `${at} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${at} ${p}`).toBe(true);
        }
        if (!DEATHS.includes(name) && !COWERS.includes(name)) {
          expect(-f.pts!.hip[1], `${at} hip`).toBeGreaterThanOrEqual(15);
          expect(-f.pts!.hip[1], `${at} hip`).toBeLessThanOrEqual(19);
          expect(f.pts!.head[1], `${at} head`).toBeLessThan(f.pts!.hip[1] - 10);
        }
      });
    }
  });

  it('a 40 px figure (D7): 42-46 px standing with the tiara; the veil adds width behind, not height', () => {
    for (const name of ['idle', 'walk', 'tell', 'fire', 'gag-toast']) {
      for (const f of SET.strips[name].frames) {
        expect(f.oy, name).toBeGreaterThanOrEqual(42);
        expect(f.oy, name).toBeLessThanOrEqual(46);
      }
    }
    for (const f of SET.strips.idle.frames) expect(f.w).toBeLessThanOrEqual(30);
  });

  it('no two consecutive frames are the same picture (loops: also the last and the first)', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const n = st.frames.length;
      if (n < 2) continue;
      for (let i = 0; i < (st.loop ? n : n - 1); i++) {
        const a = st.frames[i];
        const b = st.frames[(i + 1) % n];
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${name} ${i}->${(i + 1) % n}`).toBe(false);
      }
    }
  });

  it('the walk: the planted foot drifts at most 1 px a frame at 0.7 px/tick (rule 5)', () => {
    const walk = SET.strips.walk;
    expect(CONTRACT[`${PREFIX}/walk`].speed).toBe(STAG.walk);
    let same = 0;
    for (let i = 0; i < walk.frames.length; i++) {
      const a = walk.frames[i].pts?.plant;
      const b = walk.frames[(i + 1) % walk.frames.length].pts?.plant;
      expect(a, `walk#${i} plant`).toBeDefined();
      if (!a || !b) continue;
      const dx = b[0] - a[0];
      if (Math.abs(dx + STAG.walk * walk.durations[i]) <= 1) same++;
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
});

describe('stag groom: the costume and its secondary motion', () => {
  it('the colours of his parts exist: the tutu pinks, the L red, the lime tee, the gold tiara', () => {
    for (const h of [...PINK, ...LIME, RED_L, '#f6cc48']) expect(idx(h), h).toBeGreaterThan(0);
  });

  it('the tutu in every frame but the soot statue; the lime tee in every frame but the soot statue; the L-plate on the chest standing', () => {
    for (const name of FIGURE) {
      SET.strips[name].frames.forEach((f, i) => {
        if (name === 'die-burn' && i >= 3) return;
        expect(has(f, PINK), `${name}#${i} tutu`).toBe(true);
        expect(has(f, LIME), `${name}#${i} tee`).toBe(true);
      });
    }
    // the near arm swings over it in some walk frames, the phone arms in the gloat, the shirt is
    // over his head in the cower
    for (const name of ['idle', 'alert', 'tell', 'fire', 'gag-toast', 'gag-selfie', 'photo-pose', 'sit', 'sit-tell']) {
      SET.strips[name].frames.forEach((f, i) => {
        if (name === 'fire' && i >= 8) return;
        expect(has(f, [RED_L]), `${name}#${i} L-plate`).toBe(true);
      });
    }
    expect(SET.strips.walk.frames.filter((f) => has(f, [RED_L])).length).toBeGreaterThanOrEqual(8);
  });

  it('the veil hangs from his head on every live frame (the comb point), never on a death or under the shirt', () => {
    for (const name of FIGURE) {
      (J[name] ?? []).forEach((j, i) => {
        const live = !DEATHS.includes(name) && !COWERS.includes(name) && name !== 'turn';
        if (name === 'turn') return; // the Turner's squeeze of the idle (no joint track of its own)
        expect(j['head.veil'] !== undefined, `${name}#${i} veil`).toBe(live);
        if (live) {
          // the comb sits at the back of the crown: about 25 px over the pelvis, not in front of it
          expect(j['pel'][1] - j['head.veil'][1], `${name}#${i}`).toBeGreaterThanOrEqual(20);
          expect(j['head.veil'][0] - j['pel'][0], `${name}#${i}`).toBeLessThanOrEqual(3);
        }
      });
    }
  });

  it('the veil flies back on the pop and settles (follow-through): the picture reaches furthest behind after FIRE_POP', () => {
    for (const name of ['fire', 'sit-fire']) {
      const fr = SET.strips[name].frames;
      const back = fr.map(behind);
      const peak = back.indexOf(Math.max(...back));
      expect(peak, `${name} peak ${back}`).toBeGreaterThanOrEqual(FIRE_POP);
      expect(peak, `${name} peak ${back}`).toBeLessThanOrEqual(FIRE_POP + 2);
      // standing it flies far back; on the bike it already streams in the ride's wind
      expect(back[peak] - back[0], `${name} ${back}`).toBeGreaterThanOrEqual(name === 'fire' ? 6 : 3);
      // it settles back down over the recovery
      expect(back[fr.length - 1], `${name} ${back}`).toBeLessThan(back[peak] - (name === 'fire' ? 4 : 2));
    }
  });

  it('the veil streams behind him in the walk and on the bike, and moves every frame', () => {
    const mean = (a: number[]): number => sum(a) / a.length;
    const idle = mean(SET.strips.idle.frames.map(behind));
    for (const name of ['walk', 'sit']) {
      const back = SET.strips[name].frames.map(behind);
      expect(mean(back), `${name} ${back} vs idle ${idle}`).toBeGreaterThan(idle);
      expect(new Set(back).size, `${name} ${back}`).toBeGreaterThan(1);
    }
  });
});

describe('stag groom: the code', () => {
  it('the bake exports the same frame roles as the partier looks (art.ts re-exports them)', () => {
    expect(GEN.FIRE_POP).toBe(FIRE_POP);
    expect(GEN.FIRE_POP_TICK).toBe(FIRE_POP_TICK);
    expect(GEN.TOAST_CLINK).toBe(TOAST_CLINK);
    expect(GEN.SIT_CRANK_FRAMES).toBe(SIT_CRANK_FRAMES);
    expect(SET.events).toEqual({ FIRE_POP, FIRE_POP_TICK, TOAST_CLINK, SIT_CRANK_FRAMES });
  });

  it('FIRE_POP inside the fire strips from tick STAG.popAt; 21 ticks; the bottle mouth on the pop frame at (12, -25) within 4 px', () => {
    for (const name of ['fire', 'sit-fire']) {
      const st = SET.strips[name];
      expect(FIRE_POP).toBeGreaterThan(0);
      expect(FIRE_POP).toBeLessThan(st.frames.length);
      expect(sum(st.durations.slice(0, FIRE_POP))).toBe(STAG.popAt);
      expect(CONTRACT[`${PREFIX}/${name}`].events).toEqual([{ name: 'FIRE_POP', tick: STAG.popAt, kind: 'frame' }]);
      expect(sum(st.durations)).toBe(STAG.fireTicks);
      const m = J[name][FIRE_POP]['armN.mouth'];
      expect(Math.hypot(m[0] - 12, m[1] + STAG.chestY), `${name} mouth ${m}`).toBeLessThanOrEqual(4);
    }
  });

  it("the gloat's phone at STAG.phone / seatedPhone (within 6 px); TOAST_CLINK the furthest reach; SIT_CRANK_FRAMES; the turn 2 x 2", () => {
    for (const [name, ph] of [['gloat', STAG.phone], ['sit-gloat', STAG.seatedPhone]] as const) {
      for (const j of J[name]) expect(Math.hypot(j['armN.cam'][0] - ph[0], j['armN.cam'][1] - ph[1]), name).toBeLessThanOrEqual(6);
    }
    const xs = J['gag-toast'].map((j) => j['armN.mouth'][0]);
    expect(Math.max(...xs)).toBe(xs[TOAST_CLINK]);
    expect(SET.strips.sit.frames.length).toBe(SIT_CRANK_FRAMES);
    expect(SET.strips.turn.durations).toEqual([2, 2]);
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
    if (!id.startsWith(`${PREFIX}/`)) continue;
    n++;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} index ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
  return n;
}

describe('stag groom: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): 40 HP, 1,000 points, the 14 x 30 box, three corks (vy 0, -0.22, -0.44)', () => {
    expect(STAG.groomHp).toBe(40);
    expect(STAG.groomScore).toBe(1000);
    expect(STAG.groomVy).toEqual([0, -0.22, -0.44]);
    expect(getEntityMeta('stag-partier')?.score).toBe(300);
    const tw = new TestWorld({ playerX: 60, god: true });
    const g = tw.spawn('stag-partier', 300, { groom: true }) as StagPartier;
    expect(g.hitbox).toEqual({ x: -7, y: -30, w: 14, h: 30 });
    expect([g.maxHp, g.score, g.art]).toEqual([40, 1000, PREFIX]);
    expect(g.spriteId('idle')).toBe(`${PREFIX}/idle`);
  });

  it('on foot: walk, tell, fire (three corks on FIRE_POP at tick popAt), recover; every tick draws an existing frame', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 3 });
    const e = tw.spawn('stag-partier', 330, { groom: true, facing: -1 }, FLOOR) as StagPartier;
    const { r, calls } = recorder();
    const seen = new Set<string>();
    const live = new Set<unknown>();
    let pops = 0;
    let prev = -1;
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      e.draw(r);
      seen.add(e.mode);
      const fresh = tw.ofType('cork').filter((c) => !live.has(c));
      for (const c of fresh) live.add(c);
      if (fresh.length > 0) {
        expect(fresh.length).toBe(3);
        expect(e.mode).toBe('fire');
        expect(e.modeT).toBe(STAG.popAt);
        expect(e.anim.id).toBe(`${PREFIX}/fire`);
        expect(e.anim.index).toBe(FIRE_POP);
        expect(prev).toBe(FIRE_POP);
        pops++;
      }
      prev = e.anim.id === `${PREFIX}/fire` ? e.anim.index : -1;
      if (e.mode === 'walk' && e.playing('walk')) expect(Math.abs(e.vx)).toBeCloseTo(STAG.walk, 6);
    }
    for (const m of ['walk', 'tell', 'fire', 'recover']) expect(seen.has(m), m).toBe(true);
    expect(pops).toBeGreaterThan(0);
    expect(expectValid(calls)).toBeGreaterThan(800);
    expect(tw.world.errors).toEqual([]);
  });

  it('reactions (photo, gloat, cower) and every death kind: the strip plays to its end, the veil tumbles off with existing frames', () => {
    for (const kind of ['photo', 'gloat', 'cower'] as const) {
      const tw = new TestWorld({ playerX: 60, god: true });
      const e = tw.spawn('stag-partier', 250, { groom: true }, FLOOR) as StagPartier;
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
      const e = tw.spawn('stag-partier', 250, { groom: true }, FLOOR) as StagPartier;
      tw.run(2);
      tw.world.damage(e, { amount: 100, kind: dk, dirX: 1, owner: 0 });
      const want = { bullet: 'die', knife: 'die-knife', explosion: 'die-blast', fire: 'die-burn', crush: 'die-crush' }[dk];
      expect(e.anim.id, dk).toBe(`${PREFIX}/${want}`);
      const { r, calls } = recorder();
      let t = 0;
      let veilTicks = 0;
      while (!e.anim.done && t < 200) {
        tw.run(1);
        e.draw(r);
        for (const v of tw.world.entities as Array<{ anim?: { id?: string; index: number }; draw?: (r: SoftRenderer) => void }>) {
          if (v.anim?.id !== `${PREFIX}/veil`) continue;
          veilTicks++;
          expect(v.anim.index).toBeGreaterThanOrEqual(0);
          expect(v.anim.index).toBeLessThan(frameCount(`${PREFIX}/veil`));
          v.draw?.(r);
        }
        t++;
      }
      expect(t, `${dk} plays its strip`).toBe(sum(spriteAnim(`${PREFIX}/${want}`).durations ?? [0]));
      expect(veilTicks, `${dk}: the veil flies`).toBeGreaterThan(20);
      expectValid(calls);
      expect(tw.world.errors).toEqual([]);
    }
  });

  it('on the beer bike (groom: true): he rides the front stool, pedals, tells and fires three corks; a hit tips him off', () => {
    const tw = new TestWorld({ playerX: 60, god: true, seed: 5, width: 2000 });
    const bike = tw.spawn('stag-beer-bike', 380, { riders: 3, groom: true, looks: [0, 2, 0], facing: -1 }, FLOOR) as StagBeerBike;
    const { r, calls } = recorder();
    const strips = new Set<string>();
    const live = new Set<unknown>();
    let volley = 0;
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      bike.draw(r);
      const g = (tw.ofType('stag-partier') as StagPartier[]).find((p) => p.groom);
      if (g?.seat) strips.add(g.anim.id.split('/').pop()!);
      const fresh = tw.ofType('cork').filter((c) => !live.has(c));
      for (const c of fresh) live.add(c);
      if (fresh.length === 3) volley++;
    }
    for (const s of ['sit', 'sit-tell', 'sit-fire']) expect(strips.has(s), s).toBe(true);
    expect(volley).toBeGreaterThan(0);
    const groom = (tw.ofType('stag-partier') as StagPartier[]).find((p) => p.groom && p.seat)!;
    expect(groom.hitbox).toEqual(STAG.seatBox);
    tw.world.damage(groom, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    expect(groom.anim.id).toBe(`${PREFIX}/die-stool`);
    for (let t = 0; t < 60; t++) {
      tw.run(1);
      bike.draw(r);
      groom.draw(r);
    }
    expect(expectValid(calls)).toBeGreaterThan(600);
    expect(tw.world.errors).toEqual([]);
  });
});
