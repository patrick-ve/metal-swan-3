/**
 * The fatbike youths' looks 1–3 and the pairs 0–3 at 40 px (docs/design/ams40.md wave 4 stage 2):
 * the baked sets fatbike-youth-1a..3a (solo) and fatbike-youth-pair-0a..3a (src/game/content/art40/,
 * drawn by tools/art40/chars/fatbike-youth-pair-kit/ on the stage-1 kit), each with the palette
 * variants of skins b and c, keep the strip contract of docs/design/ams40/contract.md "fatbike
 * youth": the 411 ids (9 solo sets × 19, 12 pair sets × 20), the frame counts and logic times of
 * look 0 (the same animation: rule 6), die and die-knife as one never-played frame, the pairs'
 * passenger-flee at 2.2 px/tick, the points, 1× at every tier (rule 7), 28 / 40 colours (D1),
 * skins as palette swaps (rule 6), the pairs' rider-only strips the solo twin's pictures, KICK_HIT;
 * the youth's own update loop draws an existing frame at every tick for every look and pair; the
 * gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, isDeferredSprite, listSprites, spriteAnim } from '../../src/engine/sprites';
import * as LOOK0 from '../../src/game/content/art40/fatbike-youth.gen';
import * as L1 from '../../src/game/content/art40/fatbike-youth-1a.gen';
import * as L2 from '../../src/game/content/art40/fatbike-youth-2a.gen';
import * as L3 from '../../src/game/content/art40/fatbike-youth-3a.gen';
import * as P0 from '../../src/game/content/art40/fatbike-youth-pair-0a.gen';
import * as P1 from '../../src/game/content/art40/fatbike-youth-pair-1a.gen';
import * as P2 from '../../src/game/content/art40/fatbike-youth-pair-2a.gen';
import * as P3 from '../../src/game/content/art40/fatbike-youth-pair-3a.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { FATBIKE, type FatbikeYouth } from '../../src/game/content/locals/fatbike-youth';
import { KICK_BOX, RIDER_BOX, RIDER_TURN } from '../../src/game/content/locals/rider';
import { passengerOf, youthSet, YOUTH_LOOK_SETS, YOUTH_LOOKS, YOUTH_PAIR_SETS, type SkinKey } from '../../src/game/content/locals/rider.art';
import { FLOOR, TestWorld } from '../content/helpers';

const SKINS: readonly SkinKey[] = ['a', 'b', 'c'];
const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

interface Look {
  set: BakedSet;
  KICK_HIT: number;
  look: number;
  pair: boolean;
}
const LOOKS: readonly Look[] = [
  { set: L1.SET, KICK_HIT: L1.KICK_HIT, look: 1, pair: false },
  { set: L2.SET, KICK_HIT: L2.KICK_HIT, look: 2, pair: false },
  { set: L3.SET, KICK_HIT: L3.KICK_HIT, look: 3, pair: false },
  { set: P0.SET, KICK_HIT: P0.KICK_HIT, look: 0, pair: true },
  { set: P1.SET, KICK_HIT: P1.KICK_HIT, look: 1, pair: true },
  { set: P2.SET, KICK_HIT: P2.KICK_HIT, look: 2, pair: true },
  { set: P3.SET, KICK_HIT: P3.KICK_HIT, look: 3, pair: true },
];
const prefixes = (l: Look): string[] => SKINS.map((s) => `enemy/${youthSet(l.look, s, l.pair)}`);
const ALL_PREFIXES = LOOKS.flatMap(prefixes);

interface ContractEntry {
  character: string;
  set: string;
  strip: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  defer?: boolean;
  totalTicks?: number;
  speed?: number;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT)
  .filter((id) => CONTRACT[id].character === 'fatbike-youth' && ALL_PREFIXES.some((p) => CONTRACT[id].set === `${p}/`))
  .sort();

/** Frame counts, durations, loop and defer flags, the class: look 0's (stage 1), but die / die-knife. */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, defer: boolean, cls: string]>> = {
  ride: [12, [2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2, 1], true, false, 'locomotion'],
  idle: [4, [10, 5, 10, 5], true, false, 'idle'],
  turn: [3, [2, 2, 2], false, false, 'turn'],
  alert: [1, [30], true, false, 'telegraph'],
  tell: [6, [3, 3, 3, 3, 2, 2], false, false, 'telegraph'],
  kick: [6, [2, 1, 2, 1, 1, 29], false, false, 'melee'],
  gag: [8, [4, 3, 4, 3, 4, 3, 4, 3], true, false, 'fidget'],
  gloat: [6, [6, 6, 6, 6, 6, 6], true, true, 'victory'],
  'photo-pose': [6, [4, 3, 3, 4, 3, 3], true, false, 'victory'],
  cower: [4, [3, 3, 3, 3], true, true, 'reaction'],
  // never played (FatbikeYouth.deathEffects starts die-seat in the same tick): one frame, the same total
  die: [1, [50], false, false, 'die'],
  'die-knife': [1, [46], false, false, 'die'],
  'die-blast': [10, [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], false, false, 'die-blast'],
  'die-burn': [7, [3, 5, 5, 10, 6, 6, 7], false, false, 'die-burn'],
  'die-crush': [5, [7, 3, 13, 10, 14], false, false, 'die-crush'],
  'die-seat': [12, [3, 3, 3, 4, 2, 4, 4, 4, 4, 4, 3, 3], false, true, 'die'],
  'get-up': [6, [6, 4, 4, 4, 4, 4], false, true, 'get-up'],
  flee: [12, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], true, false, 'locomotion'],
  bike: [6, [6, 6, 6, 8, 6, 6], false, false, 'prop'],
};
const PAIR_ONLY: typeof STRIPS = { 'passenger-flee': [12, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], true, false, 'locomotion'] };
/** Logic times that changed on purpose (loops the code never times): strip -> [old, new]. */
const CHANGED: Readonly<Record<string, readonly [number, number]>> = { flee: [16, 24], cower: [6, 12], 'passenger-flee': [16, 24] };
const ON_BIKE = ['ride', 'idle', 'turn', 'alert', 'tell', 'kick', 'gag', 'photo-pose'];
/** The strips with both youths in a pair (the rest is the rider alone or the riderless bike). */
const BOTH = ['ride', 'idle', 'turn', 'alert', 'tell', 'kick', 'gag', 'gloat', 'photo-pose', 'cower'];
const RIDER_ONLY = ['die-blast', 'die-burn', 'die-crush', 'die-seat', 'get-up', 'flee', 'bike'];
const SMEARS: Readonly<Record<string, readonly number[]>> = { kick: [1, 4], 'die-blast': [5], 'die-crush': [1], 'die-seat': [4] };
const SKIN_TONES = ['#ffe4cc', '#f6c39e', '#dc9670', '#a8522e', '#e8b890', '#c98b62', '#a1643f', '#5e3424', '#b77a52', '#8a5236', '#663a26', '#3c2016'];
/** The hoodie's lit tone of each look (the J letter). */
const HOODIE = ['#f06045', '#ad84de', '#62d8c6', '#ffb456'];

const stripsOf = (l: Look): typeof STRIPS => (l.pair ? { ...STRIPS, ...PAIR_ONLY } : STRIPS);
const rgba = (id: string): unknown[] => getFrames(id, 1).map((f) => [f.ox, f.oy, f.buf.w, f.buf.h, f.pts ?? null, Array.from(f.buf.data)]);

describe('fatbike looks 1-3 and pairs: the sets', () => {
  it('register exactly the contract ids (docs/design/ams40/contract.json): 9 x 19 + 12 x 20 = 411', () => {
    expect(CONTRACT_IDS.length).toBe(411);
    const baked = LOOKS.flatMap((l) => bakedSetIds(l.set)).sort();
    expect(baked).toEqual(CONTRACT_IDS);
    for (const id of CONTRACT_IDS) expect(hasSprite(id), id).toBe(true);
    expect(ALL_PREFIXES.flatMap((p) => listSprites(`${p}/`)).sort()).toEqual(CONTRACT_IDS);
    for (const p of ALL_PREFIXES) expect(hasSprite(`${p}/cap`), `${p}/cap`).toBe(false);
    expect([...YOUTH_LOOK_SETS, ...YOUTH_PAIR_SETS]).toEqual(LOOKS.map((l) => l.set));
  });

  it('the set ids are the ones the game spawns (youthSet) and the passenger rule (look + 2, a->c, b->a, c->b)', () => {
    expect(YOUTH_LOOKS.length).toBe(4);
    for (const l of LOOKS) {
      expect(l.set.prefix).toBe(`enemy/${youthSet(l.look, 'a', l.pair)}`);
      expect(Object.keys(l.set.variants ?? {}).sort()).toEqual([`enemy/${youthSet(l.look, 'b', l.pair)}`, `enemy/${youthSet(l.look, 'c', l.pair)}`]);
    }
    expect(passengerOf(0, 'a')).toEqual({ look: 2, skin: 'c' });
    expect(passengerOf(1, 'b')).toEqual({ look: 3, skin: 'a' });
    expect(passengerOf(3, 'c')).toEqual({ look: 1, skin: 'b' });
  });

  it('frame counts, durations, loop and defer flags: look 0 (the same animation) and the contract logic time', () => {
    for (const l of LOOKS) {
      const S = stripsOf(l);
      expect(Object.keys(l.set.strips).sort(), l.set.slug).toEqual(Object.keys(S).sort());
      for (const [name, [n, d, loop, defer, cls]] of Object.entries(S)) {
        const st = l.set.strips[name];
        const where = `${l.set.slug} ${name}`;
        const c = CONTRACT[`${l.set.prefix}/${name}`];
        expect(st.frames.length, where).toBe(n);
        expect(st.durations, where).toEqual(d);
        expect(st.loop, where).toBe(loop);
        expect(st.loop, `${where} loop = contract`).toBe(c.loop);
        expect(st.defer ?? false, where).toBe(defer);
        expect(st.cls, where).toBe(cls);
        const ch = CHANGED[name];
        if (ch) {
          expect(c.totalTicks, `${where} old logic time`).toBe(ch[0]);
          expect(sum(st.durations), `${where} new logic time`).toBe(ch[1]);
        } else expect(sum(st.durations), `${where} logic time`).toBe(c.totalTicks);
        // the same animation as look 0 (rule 6): count, durations, loop, defer
        const z = LOOK0.SET.strips[name];
        if (z && name !== 'die' && name !== 'die-knife') {
          expect([z.frames.length, z.durations, z.loop, z.defer ?? false], `${where} = look 0`).toEqual([n, d, loop, defer]);
        }
        if (n < 2 && (name === 'die' || name === 'die-knife')) expect(st.why, where).toMatch(/never played/);
        for (const p of prefixes(l)) {
          const id = `${p}/${name}`;
          expect(frameCount(id), id).toBe(n);
          expect(spriteAnim(id).durations, id).toEqual(d);
          expect(spriteAnim(id).loop, id).toBe(loop);
          expect(isDeferredSprite(id), id).toBe(defer);
        }
      }
    }
  });

  it('every frame decodes: w*h pixels, indices in range, 28 colours a solo palette, 40 a pair, the one outline', () => {
    for (const l of LOOKS) {
      const s = l.set;
      expect(s.budget, s.slug).toBe(l.pair ? 40 : 28);
      const fx = new Set(s.fx ?? []);
      for (const pal of [s.pal, ...Object.values(s.variants ?? {})]) {
        expect(pal.length).toBe(s.pal.length);
        expect(new Set(pal.filter((_, i) => i > 0 && !fx.has(i))).size, s.slug).toBeLessThanOrEqual(s.budget);
      }
      expect(s.pal[s.outline]).toBe('#140c0e');
      for (const [name, st] of Object.entries(s.strips)) {
        st.frames.forEach((f, i) => {
          const idx = decodeBakedIndices(f);
          expect(idx.length, `${s.slug} ${name}#${i}`).toBe(f.w * f.h);
          let max = 0;
          let solid = 0;
          for (const v of idx) {
            if (v > max) max = v;
            if (v) solid++;
          }
          expect(max, `${s.slug} ${name}#${i}`).toBeLessThan(s.pal.length);
          expect(solid, `${s.slug} ${name}#${i}`).toBeGreaterThan(name === 'bike' ? 15 : 200);
        });
      }
    }
  });

  it('skins b and c are palette swaps of the same pixels (rule 6): only skin tones (and look 0 hair) change', () => {
    for (const l of LOOKS) {
      for (const [v, pal] of Object.entries(l.set.variants ?? {})) {
        let changed = 0;
        l.set.pal.forEach((c, i) => {
          if (pal[i] === c) return;
          changed++;
          expect(SKIN_TONES.includes(c) || c === '#4a3a40' || c === '#2c221c', `${v}: ${c} -> ${pal[i]}`).toBe(true);
        });
        expect(changed, v).toBeGreaterThanOrEqual(l.pair ? 6 : 4);
      }
    }
  });

  it('the looks: each solo look and each pair rider wears its own hoodie; the passenger wears his look', () => {
    for (const l of LOOKS) {
      const f = l.set.strips.ride.frames[0];
      const idx = decodeBakedIndices(f);
      const count = (hex: string): number => {
        const k = l.set.pal.indexOf(hex);
        return k < 0 ? 0 : idx.filter((v) => v === k).length;
      };
      expect(count(HOODIE[l.look]), `${l.set.slug} rider hoodie`).toBeGreaterThan(10);
      if (l.pair) expect(count(HOODIE[(l.look + 2) % 4]), `${l.set.slug} passenger hoodie`).toBeGreaterThan(10);
      else for (const k of [0, 1, 2, 3].filter((k) => k !== l.look)) expect(count(HOODIE[k]), `${l.set.slug}: not look ${k}`).toBe(0);
    }
  });

  it('the anchor: the bike frames stand on the road; the points hand / head / hip where the contract has them', () => {
    for (const l of LOOKS) {
      for (const [name, st] of Object.entries(l.set.strips)) {
        const c = CONTRACT[`${l.set.prefix}/${name}`];
        st.frames.forEach((f, i) => {
          const where = `${l.set.slug} ${name}#${i}`;
          expect(f.ox, where).toBeGreaterThanOrEqual(0);
          expect(f.ox, where).toBeLessThan(f.w);
          if (ON_BIKE.includes(name)) expect(f.oy, `${where}: the tyres on the road`).toBe(f.h);
          const want = c.framePoints[Math.min(i, c.framePoints.length - 1)] ?? [];
          for (const p of want) {
            const pt = f.pts?.[p];
            expect(pt, `${where} ${p}`).toBeDefined();
            expect(pt![1], `${where} ${p}`).toBeLessThanOrEqual(0);
            expect(pt![1], `${where} ${p}`).toBeGreaterThanOrEqual(-f.oy - 1);
          }
        });
      }
      for (const name of ['die', 'die-knife', 'die-blast', 'die-burn', 'die-crush', 'die-seat', 'get-up']) {
        const st = l.set.strips[name];
        const f = st.frames[st.frames.length - 1];
        expect(f.oy, `${l.set.slug} ${name} ends on the road`).toBe(f.h);
      }
      const ride = l.set.strips.ride.frames[0];
      expect(ride.w).toBeLessThanOrEqual(l.pair ? 62 : 56);
      expect(ride.h).toBeLessThanOrEqual(56);
    }
  });

  it('smear frames only where drawn (at most 2 a strip); no two consecutive frames alike', () => {
    for (const l of LOOKS) {
      for (const [name, st] of Object.entries(l.set.strips)) {
        const smears = st.frames.flatMap((f, i) => (f.smear ? [i] : []));
        expect(smears, `${l.set.slug} ${name}`).toEqual(SMEARS[name] ?? []);
        const n = st.frames.length;
        if (n < 2) continue;
        for (let i = 0; i < (st.loop ? n : n - 1); i++) {
          const a = st.frames[i];
          const b = st.frames[(i + 1) % n];
          expect(a.px === b.px && a.w === b.w, `${l.set.slug} ${name} ${i}`).toBe(false);
        }
      }
    }
  });

  it('a pair: both youths on every bike strip; the rider-only strips are the solo twin\'s pictures', () => {
    for (const l of LOOKS.filter((x) => x.pair)) {
      for (const skin of SKINS) {
        const pair = `enemy/${youthSet(l.look, skin, true)}`;
        const solo = `enemy/${youthSet(l.look, skin, false)}`;
        for (const name of RIDER_ONLY) expect(rgba(`${pair}/${name}`), `${pair}/${name}`).toEqual(rgba(`${solo}/${name}`));
        for (const name of BOTH) {
          const a = getFrames(`${pair}/${name}`, 1);
          const b = getFrames(`${solo}/${name}`, 1);
          a.forEach((f, i) => {
            const opaque = (x: typeof f): number => x.buf.data.reduce((n, c) => n + ((c & 255) !== 0 ? 1 : 0), 0);
            expect(opaque(f), `${pair}/${name}#${i}: the passenger adds pixels`).toBeGreaterThan(opaque(b[i]) + 60);
          });
        }
        // the passenger's flee: his own look's colours, not the rider's hoodie
        const pass = passengerOf(l.look, skin);
        const pf = getFrames(`${pair}/passenger-flee`, 1);
        const colours = new Set(pf.flatMap((f) => Array.from(f.buf.data)));
        const hex = (c: number): string => `#${((c >>> 24) & 255).toString(16).padStart(2, '0')}${((c >>> 16) & 255).toString(16).padStart(2, '0')}${((c >>> 8) & 255).toString(16).padStart(2, '0')}`;
        const hexes = new Set([...colours].filter((c) => (c & 255) !== 0).map(hex));
        expect(hexes.has(HOODIE[pass.look]), `${pair}/passenger-flee wears look ${pass.look}`).toBe(true);
        expect(hexes.has(HOODIE[l.look]), `${pair}/passenger-flee is not the rider`).toBe(false);
      }
    }
  });

  it('the flee and the passenger flee: the planted foot moves back at the contract speed (2 / 2.2 px a tick)', () => {
    for (const l of LOOKS) {
      for (const [name, speed] of [['flee', FATBIKE.flee], ...(l.pair ? [['passenger-flee', FATBIKE.flee * 1.1]] : [])] as Array<[string, number]>) {
        const st = l.set.strips[name];
        const c = CONTRACT[`${l.set.prefix}/${name}`];
        expect(c.speed, `${l.set.slug} ${name} contract speed`).toBeCloseTo(speed, 5);
        // walk the cycle twice: within one plant the foot's drift against the ground (its move in
        // the sprite plus the body's move) stays within 1 px from the plant's first frame on
        let planted = 0;
        let start: readonly [number, number] | undefined;
        let ticks = 0;
        const n = st.frames.length;
        for (let k = 0; k < 2 * n; k++) {
          const i = k % n;
          const a = st.frames[i].pts?.plant;
          const b = st.frames[(i + 1) % n].pts?.plant;
          if (!a || !b) {
            start = undefined;
            continue;
          }
          const dx = b[0] - a[0];
          if (dx > 0) {
            start = undefined;           // a new step lands ahead
            continue;
          }
          if (!start) {
            start = a;
            ticks = 0;
          }
          ticks += st.durations[i];
          expect(Math.abs(b[0] - start[0] + speed * ticks), `${l.set.slug} ${name} plant drift at frame ${(i + 1) % n}`).toBeLessThanOrEqual(1);
          planted++;
        }
        expect(planted, `${l.set.slug} ${name}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('1x pixels at every art tier (rule 7): no dense art, getFrames(id, 2|4) is the 1x strip', () => {
    for (const id of CONTRACT_IDS) {
      expect(hasHiSprite(id, 2) || hasHiSprite(id, 4), id).toBe(false);
      const one = getFrames(id, 1);
      expect(getFrames(id, 2), id).toBe(one);
      expect(getFrames(id, 4), id).toBe(one);
    }
  });
});

describe('fatbike looks 1-3 and pairs: the code', () => {
  it('KICK_HIT: the extended frame from tick 3, inside the 8-tick kick window, in every set (= look 0)', () => {
    for (const l of LOOKS) {
      expect(l.KICK_HIT, l.set.slug).toBe(LOOK0.KICK_HIT);
      expect(l.set.events?.KICK_HIT, l.set.slug).toBe(l.KICK_HIT);
      const d = l.set.strips.kick.durations;
      expect(sum(d.slice(0, l.KICK_HIT)), l.set.slug).toBe(3);
      expect(sum(d.slice(0, l.KICK_HIT)) + d[l.KICK_HIT]).toBeLessThanOrEqual(FATBIKE.kick);
      const ext = l.set.strips.kick.frames[l.KICK_HIT];
      const chamber = l.set.strips.kick.frames[0];
      expect(rightmost(ext) - ext.ox, l.set.slug).toBeGreaterThan(rightmost(chamber) - chamber.ox);
    }
  });

  it('the gloat rocks once per bass thump; the turn strip has RIDER_TURN frames', () => {
    for (const l of LOOKS) {
      expect(sum(l.set.strips.gloat.durations)).toBe(FATBIKE.thump);
      expect(l.set.strips.turn.frames.length).toBe(RIDER_TURN.frames);
      expect(l.set.strips.turn.durations.every((d) => d === RIDER_TURN.ticksPerFrame)).toBe(true);
    }
  });
});

function rightmost(f: { w: number; h: number; px: string }): number {
  const idx = decodeBakedIndices(f as Parameters<typeof decodeBakedIndices>[0]);
  let r = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (idx[y * f.w + x] && x > r) r = x;
  return r;
}

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

function drawAll(tw: TestWorld, r: SoftRenderer): void {
  for (const e of tw.world.entities) if (!e.removed) e.draw(r);
}

describe('fatbike looks 1-3 and pairs: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): hp and score solo / pair, the hitbox and the kick box', () => {
    expect(FATBIKE.hp).toBe(20);
    expect(FATBIKE.pairHp).toBe(30);
    expect(FATBIKE.score).toBe(300);
    expect(FATBIKE.pairScore).toBe(500);
    expect(FATBIKE.flee).toBe(2);
    expect(FATBIKE.kick).toBe(8);
    expect(RIDER_BOX).toEqual({ w: 24, h: 34 });
    expect(KICK_BOX).toEqual({ x: 4, y: -22, w: 20, h: 16 });
    const tw = new TestWorld({ playerX: 60, god: true });
    const solo = tw.spawn('fatbike-youth', 300, { look: 2, skin: 'b' }) as FatbikeYouth;
    const pair = tw.spawn('fatbike-youth', 340, { look: 3, skin: 'c', pair: true }) as FatbikeYouth;
    expect(solo.art).toBe('enemy/fatbike-youth-2b');
    expect(pair.art).toBe('enemy/fatbike-youth-pair-3c');
    expect([solo.hp, pair.hp]).toEqual([20, 30]);
    expect([pair.hitbox.w, pair.hitbox.h]).toEqual([24, 34]);
  });

  LOOKS.forEach((l, n) => {
    const skin = SKINS[n % 3];
    const art = `enemy/${youthSet(l.look, skin, l.pair)}`;
    it(`${art}: ride, tell, kick, away, turn, gag, the reactions and every death draw an existing frame at every tick`, () => {
      const { r, calls } = recorder();
      {
        const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
        const y = tw.spawn('fatbike-youth', 330, { look: l.look, skin, pair: l.pair, turn: true }) as FatbikeYouth;
        expect(y.art).toBe(art);
        const modes = new Set<string>();
        for (let t = 0; t < 420 && !y.removed; t++) {
          tw.run(1);
          modes.add(y.mode);
          drawAll(tw, r);
        }
        for (const m of ['ride', 'tell', 'kick', 'away']) expect(modes.has(m), m).toBe(true);
      }
      {
        const tw = new TestWorld({ playerX: 40, god: true, seed: 4 });
        const y = tw.spawn('fatbike-youth', 220, { look: l.look, skin, pair: l.pair, gag: 'circles' }, FLOOR) as FatbikeYouth;
        for (let t = 0; t < 60; t++) {
          tw.run(1);
          drawAll(tw, r);
        }
        expect(y.mode).toBe('gag');
        for (const kind of ['photo', 'gloat', 'cower'] as const) {
          expect(y.react(kind, 80, tw.player), kind).toBe(true);
          for (let t = 0; t < 90; t++) {
            tw.run(1);
            drawAll(tw, r);
          }
        }
      }
      for (const kind of ['bullet', 'knife', 'explosion', 'fire', 'crush'] as const) {
        const tw = new TestWorld({ playerX: 40, god: true, seed: 5 });
        const y = tw.spawn('fatbike-youth', 200, { look: l.look, skin, pair: l.pair, gag: true }, FLOOR) as FatbikeYouth;
        tw.run(2);
        tw.world.damage(y, { amount: 100, kind, dirX: 1, owner: 0 });
        const seen = new Set<string>();
        for (let t = 0; t < 400 && !y.removed; t++) {
          tw.run(1);
          drawAll(tw, r);
          seen.add(y.anim.id);
        }
        if (kind === 'bullet' || kind === 'knife') for (const s of ['die-seat', 'get-up', 'flee']) expect(seen.has(`${art}/${s}`), `${kind}: ${s}`).toBe(true);
        expect(tw.world.errors, kind).toEqual([]);
      }
      for (const [id, i] of calls) {
        if (!id.startsWith('enemy/fatbike-youth')) continue;
        expect(hasSprite(id), id).toBe(true);
        expect(Number.isInteger(i) && i >= 0 && i < frameCount(id), `${id} index ${i}`).toBe(true);
      }
      const drawn = new Set(calls.map(([id]) => id));
      const want = ['ride', 'tell', 'kick', 'turn', 'gag', 'photo-pose', 'gloat', 'cower', 'die-seat', 'get-up', 'flee', 'die-blast', 'die-burn', 'die-crush', 'bike'];
      if (l.pair) want.push('passenger-flee');
      for (const s of want) expect(drawn.has(`${art}/${s}`), `${art}/${s} drawn`).toBe(true);
      // never played: a shot or knifed youth falls off the seat (deathEffects, the same tick)
      for (const s of ['die', 'die-knife']) expect(drawn.has(`${art}/${s}`), `${art}/${s} never drawn`).toBe(false);
      // the cap fx is the base set's (looks 0 and 2 wear a cap)
      expect(drawn.has('enemy/fatbike-youth/cap')).toBe(l.look === 0 || l.look === 2);
    });
  });
});
