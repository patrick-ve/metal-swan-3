/**
 * The fatbike youth, look 0, at 40 px (docs/design/ams40.md wave 4): the baked set `fatbike-youth`
 * (src/game/content/art40/fatbike-youth.gen.ts, drawn by tools/art40/chars/fatbike-youth/) with the
 * palette variants -0b and -0c keeps the strip contract of docs/design/ams40/contract.md "fatbike
 * youth": the 58 ids (20 + 19 + 19: the cap only on the base set), the frame counts of the plan's
 * class table, the logic times (two loops logged as changed), the feet anchor of the bike frames on
 * the road, the points hand / head / hip on the rider-only frames, smear frames only where drawn,
 * 1× pixels at every art tier (rule 7), 28 colours (D1), skins as palette swaps (rule 6); the kick
 * event KICK_HIT inside the kick window; the youth's own update loop picks an existing frame at
 * every tick of every state; the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, isDeferredSprite, listSprites, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/fatbike-youth.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { FATBIKE, type FatbikeYouth } from '../../src/game/content/locals/fatbike-youth';
import { YOUTH0_IDS } from '../../src/game/content/locals/fatbike-youth.art';
import { KICK_BOX, RIDER_BOX, RIDER_TURN } from '../../src/game/content/locals/rider';
import { youthSet } from '../../src/game/content/locals/rider.art';
import { getEntityMeta } from '../../src/game/registry';
import { FLOOR, TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PREFIX = 'enemy/fatbike-youth';
const VARIANTS = ['enemy/fatbike-youth-0b', 'enemy/fatbike-youth-0c'];
const PREFIXES = [PREFIX, ...VARIANTS];

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
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT)
  .filter((id) => CONTRACT[id].character === 'fatbike-youth' && PREFIXES.some((p) => CONTRACT[id].set === `${p}/`))
  .sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Frame counts (the plan's class table), durations, loop and defer flags, the class. */
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
  die: [10, [4, 4, 4, 4, 4, 4, 5, 5, 6, 10], false, false, 'die'],
  'die-knife': [11, [3, 3, 4, 4, 4, 4, 4, 3, 3, 4, 10], false, false, 'die'],
  'die-blast': [10, [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], false, false, 'die-blast'],
  'die-burn': [7, [3, 5, 5, 10, 6, 6, 7], false, false, 'die-burn'],
  'die-crush': [5, [7, 3, 13, 10, 14], false, false, 'die-crush'],
  'die-seat': [12, [3, 3, 3, 4, 2, 4, 4, 4, 4, 4, 3, 3], false, true, 'die'],
  'get-up': [6, [6, 4, 4, 4, 4, 4], false, true, 'get-up'],
  flee: [12, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], true, false, 'locomotion'],
  bike: [6, [6, 6, 6, 8, 6, 6], false, false, 'prop'],
  cap: [8, [2, 2, 2, 2, 2, 2, 2, 2], true, false, 'prop'],
};

/** Logic times that changed on purpose (loops the code never times): strip -> [old, new, why]. */
const CHANGED: Readonly<Record<string, readonly [number, number, string]>> = {
  flee: [16, 24, 'the 12-frame run at 2 ticks a frame: 48 px a cycle at 2 px/tick (4 frames x 4 before)'],
  cower: [6, 12, 'a 4-frame shiver loop (2 x 3 before); the cower reaction lasts as long as the game says'],
};

/** The strips on the bike: the wheels stand on the anchor line. */
const ON_BIKE = ['ride', 'idle', 'turn', 'alert', 'tell', 'kick', 'gag', 'photo-pose'];
/** The strips with smear frames (index list). */
const SMEARS: Readonly<Record<string, readonly number[]>> = { kick: [1, 4], 'die-blast': [5], 'die-crush': [1], 'die-seat': [4] };

describe('fatbike-youth: the set', () => {
  it('registers exactly the contract ids of look 0 (docs/design/ams40/contract.json): 20 + 19 + 19', () => {
    expect(CONTRACT_IDS.length).toBe(58);
    expect([...YOUTH0_IDS].sort()).toEqual(CONTRACT_IDS);
    // the baked set itself holds the cap for every prefix: the registration leaves the variants' out
    expect(bakedSetIds(SET).filter((id) => !id.endsWith('/cap') || id.startsWith(`${PREFIX}/`)).sort()).toEqual(CONTRACT_IDS);
    for (const id of CONTRACT_IDS) expect(hasSprite(id), id).toBe(true);
    for (const v of VARIANTS) expect(hasSprite(`${v}/cap`), `${v}/cap`).toBe(false);
    const registered = PREFIXES.flatMap((p) => listSprites(`${p}/`));
    expect(registered.sort()).toEqual(CONTRACT_IDS);
    expect(SET.prefix).toBe(PREFIX);
    expect(Object.keys(SET.variants ?? {}).sort()).toEqual(VARIANTS);
  });

  it('the set ids are the ones the game spawns (youthSet: look 0, skins a, b, c, solo)', () => {
    expect(`enemy/${youthSet(0, 'a', false)}`).toBe(PREFIX);
    expect(`enemy/${youthSet(0, 'b', false)}`).toBe(VARIANTS[0]);
    expect(`enemy/${youthSet(0, 'c', false)}`).toBe(VARIANTS[1]);
  });

  it('frame counts, durations, loop and defer flags: the class table and the contract logic time', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [name, [n, d, loop, defer, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[name];
      const c = CONTRACT[`${PREFIX}/${name}`];
      expect(st.frames.length, name).toBe(n);
      expect(st.durations, name).toEqual(d);
      expect(st.loop, name).toBe(loop);
      expect(st.loop, `${name} loop = contract`).toBe(c.loop);
      expect(st.defer ?? false, name).toBe(defer);
      expect(defer, `${name} defer = contract`).toBe(c.defer ?? false);
      expect(st.cls, name).toBe(cls);
      const ch = CHANGED[name];
      if (ch) {
        expect(c.totalTicks, `${name} old logic time`).toBe(ch[0]);
        expect(sum(st.durations), `${name} new logic time (${ch[2]})`).toBe(ch[1]);
      } else expect(sum(st.durations), `${name} logic time`).toBe(c.totalTicks);
      for (const p of PREFIXES) {
        const id = `${p}/${name}`;
        if (!hasSprite(id)) continue;
        expect(frameCount(id), id).toBe(n);
        expect(spriteAnim(id).durations, id).toEqual(d);
        expect(spriteAnim(id).loop, id).toBe(loop);
        expect(isDeferredSprite(id), id).toBe(defer);
      }
    }
  });

  it('every frame decodes: w*h pixels, palette indices in range, 28 colours per palette, the one outline', () => {
    expect(SET.budget).toBe(28);
    const fx = new Set(SET.fx ?? []);
    for (const pal of [SET.pal, ...Object.values(SET.variants ?? {})]) {
      expect(pal.length).toBe(SET.pal.length);
      const body = new Set(pal.filter((_, i) => i > 0 && !fx.has(i)));
      expect(body.size).toBeLessThanOrEqual(28);
    }
    expect(SET.pal[SET.outline]).toBe('#140c0e');
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
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(name === 'cap' ? 20 : name === 'bike' ? 15 : 200);
      });
    }
  });

  it('skins b and c are palette swaps of the same pixels (rule 6): only the skin and hair tones differ', () => {
    const skin = ['#ffe4cc', '#f6c39e', '#dc9670', '#a8522e', '#4a3a40'];
    for (const v of VARIANTS) {
      const pal = SET.variants![v];
      SET.pal.forEach((c, i) => {
        if (skin.includes(c)) expect(pal[i], `${v} ${c}`).not.toBe(c);
        else expect(pal[i], `${v} ${c}`).toBe(c);
      });
    }
  });

  it('the anchor: bike frames stand on the road line; the points hand / head / hip where the contract has them', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const c = CONTRACT[`${PREFIX}/${name}`];
      st.frames.forEach((f, i) => {
        expect(f.ox, `${name}#${i}`).toBeGreaterThanOrEqual(0);
        expect(f.ox, `${name}#${i}`).toBeLessThan(f.w);
        if (ON_BIKE.includes(name)) expect(f.oy, `${name}#${i}: the tyres on the road`).toBe(f.h);
        if (name === 'cap') expect([f.ox, f.oy], `cap#${i} centre`).toEqual([Math.floor(f.w / 2) + (f.ox - Math.floor(f.w / 2)), f.oy]);
        const want = c.framePoints[Math.min(i, c.framePoints.length - 1)] ?? [];
        for (const p of want) {
          const pt = f.pts?.[p];
          expect(pt, `${name}#${i} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${name}#${i} ${p}`).toBe(true);
          expect(pt![1], `${name}#${i} ${p}`).toBeLessThanOrEqual(0);
          expect(pt![1], `${name}#${i} ${p}`).toBeGreaterThanOrEqual(-f.oy - 1);
        }
      });
    }
    // the deaths end on the road: the last frame of every death lies on the anchor line
    for (const name of ['die', 'die-knife', 'die-blast', 'die-burn', 'die-crush', 'die-seat', 'get-up']) {
      const st = SET.strips[name];
      const f = st.frames[st.frames.length - 1];
      expect(f.oy, name).toBe(f.h);
    }
    // the wheels: 18 px fat tyres, about the old bike's size (D7: the hitbox stays 24 x 34)
    const ride = SET.strips.ride.frames[0];
    expect(ride.w).toBeGreaterThanOrEqual(40);
    expect(ride.w).toBeLessThanOrEqual(56);
    expect(ride.h).toBeGreaterThanOrEqual(44);
    expect(ride.h).toBeLessThanOrEqual(54);
  });

  it('smear frames only where drawn (at most 2 a strip)', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const smears = st.frames.flatMap((f, i) => (f.smear ? [i] : []));
      expect(smears, name).toEqual(SMEARS[name] ?? []);
      expect(smears.length, name).toBeLessThanOrEqual(2);
    }
  });

  it('no two consecutive frames are the same picture (loops: also the last and the first)', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const n = st.frames.length;
      for (let i = 0; i < (st.loop ? n : n - 1); i++) {
        const a = st.frames[i];
        const b = st.frames[(i + 1) % n];
        if (n === 1) continue;
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${name} ${i}->${(i + 1) % n}`).toBe(false);
      }
    }
  });

  it('the flee: the planted foot moves back 2 px a tick (the contract speed), no foot slide', () => {
    const st = SET.strips.flee;
    let checked = 0;
    for (let i = 0; i < st.frames.length; i++) {
      const a = st.frames[i].pts?.plant;
      const b = st.frames[(i + 1) % st.frames.length].pts?.plant;
      if (!a || !b) continue;
      const dx = b[0] - a[0];
      // the same foot stays planted (or the other one lands ahead of it: a new step)
      if (Math.abs(dx + FATBIKE.flee * st.durations[i]) <= 1) checked++;
      else expect(dx, `flee ${i}: a new step lands ahead`).toBeGreaterThan(0);
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it('1x pixels at every art tier (rule 7): no dense art, getFrames(id, 2|4) give the 1x frames', () => {
    for (const id of CONTRACT_IDS) {
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

  it('the look: the gold frame, the red hoodie and the black cap on the ride frame', () => {
    const f = SET.strips.ride.frames[0];
    const idx = decodeBakedIndices(f);
    const count = (hex: string): number => {
      const k = SET.pal.indexOf(hex);
      return k < 0 ? 0 : idx.filter((v) => v === k).length;
    };
    expect(count('#f6c537') + count('#fff184'), 'gold frame').toBeGreaterThan(20);
    expect(count('#f06045') + count('#c62f30'), 'red hoodie').toBeGreaterThan(40);
    expect(count('#3a3d48') + count('#4f5360'), 'black cap and tyres').toBeGreaterThan(60);
  });
});

describe('fatbike-youth: the code', () => {
  it('KICK_HIT: the leg is out from tick 3, inside the 8-tick kick window the code shows', () => {
    expect(GEN.KICK_HIT).toBe(2);
    expect(SET.events?.KICK_HIT).toBe(GEN.KICK_HIT);
    const d = SET.strips.kick.durations;
    expect(GEN.KICK_HIT).toBeLessThan(d.length);
    expect(sum(d.slice(0, GEN.KICK_HIT)), 'start tick of the extended frame').toBe(3);
    expect(sum(d.slice(0, GEN.KICK_HIT)) + d[GEN.KICK_HIT]).toBeLessThanOrEqual(FATBIKE.kick);
    // every kick frame starts inside the window the code shows (FATBIKE.kick ticks)
    let t = 0;
    for (const n of d) {
      expect(t).toBeLessThan(FATBIKE.kick);
      t += n;
    }
    // the extended frame reaches further forward than the chamber
    const ext = SET.strips.kick.frames[GEN.KICK_HIT];
    const chamber = SET.strips.kick.frames[0];
    expect(ext.pts ?? {}).toEqual({});
    expect(rightmost(ext) - ext.ox).toBeGreaterThanOrEqual(rightmost(chamber) - chamber.ox);
  });

  it('the gloat rocks once per bass thump; the turn strip has RIDER_TURN frames', () => {
    expect(sum(SET.strips.gloat.durations)).toBe(FATBIKE.thump);
    expect(SET.strips.turn.frames.length).toBe(RIDER_TURN.frames);
    expect(SET.strips.turn.durations.every((d) => d === RIDER_TURN.ticksPerFrame)).toBe(true);
  });
});

function rightmost(f: { w: number; h: number; px: string }): number {
  const idx = decodeBakedIndices(f as Parameters<typeof decodeBakedIndices>[0]);
  let r = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (idx[y * f.w + x] && x > r) r = x;
  return r;
}

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

function expectValid(calls: Array<[string, number]>): void {
  for (const [id, i] of calls) {
    if (!PREFIXES.some((p) => id.startsWith(`${p}/`))) continue;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} index ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
}

/** Draw every entity of the world each tick (the fx too: the cap, the wreck, the flee). */
function drawAll(tw: TestWorld, r: SoftRenderer): void {
  for (const e of tw.world.entities) if (!e.removed) e.draw(r);
}

describe('fatbike-youth: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): hp, score, speeds, timings, the hitbox and the kick box', () => {
    expect(getEntityMeta('fatbike-youth')?.category).toBe('enemy');
    expect(getEntityMeta('fatbike-youth')?.score).toBe(300);
    expect(FATBIKE).toEqual({
      hp: 20, pairHp: 30, score: 300, pairScore: 500, fast: 1.8, slow: 0.8, brake: 90, tellAt: 48, tele: 24, kick: 8,
      notice: 120, circle: 40, turnChance: 0.5, turnPast: 100, turnTicks: 20, thump: 36, flee: 2,
    });
    expect(RIDER_BOX).toEqual({ w: 24, h: 34 });
    expect(KICK_BOX).toEqual({ x: 4, y: -22, w: 20, h: 16 });
    const tw = new TestWorld({ playerX: 60, god: true });
    const y = tw.spawn('fatbike-youth', 300, { look: 0, skin: 'a' }) as FatbikeYouth;
    expect(y.art).toBe(PREFIX);
    expect(y.hp).toBe(20);
    expect(y.hitbox.w).toBe(24);
    expect(y.hitbox.h).toBe(34);
  });

  for (const skin of ['a', 'b', 'c'] as const) {
    it(`skin ${skin}: ride, tell, kick, away, turn, gag, the reactions and every death draw an existing frame at every tick`, () => {
      const art = `enemy/${youthSet(0, skin, false)}`;
      const { r, calls } = recorder();
      // ride in, tell, kick (the god player stands), ride away, turn round once
      {
        const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
        const y = tw.spawn('fatbike-youth', 330, { look: 0, skin, turn: true }) as FatbikeYouth;
        expect(y.art).toBe(art);
        const modes = new Set<string>();
        for (let t = 0; t < 420 && !y.removed; t++) {
          tw.run(1);
          modes.add(y.mode);
          drawAll(tw, r);
        }
        for (const m of ['ride', 'tell', 'kick', 'away']) expect(modes.has(m), m).toBe(true);
      }
      // the gag laps, the reactions (photo, gloat, cower)
      {
        const tw = new TestWorld({ playerX: 40, god: true, seed: 4 });
        const y = tw.spawn('fatbike-youth', 220, { look: 0, skin, gag: 'circles' }, FLOOR) as FatbikeYouth;
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
      // every death: shot (die-seat, get-up, flee), knife, blast, fire, crush
      for (const kind of ['bullet', 'knife', 'explosion', 'fire', 'crush'] as const) {
        const tw = new TestWorld({ playerX: 40, god: true, seed: 5 });
        const y = tw.spawn('fatbike-youth', 200, { look: 0, skin, gag: true }, FLOOR) as FatbikeYouth;
        tw.run(2);
        tw.world.damage(y, { amount: 100, kind, dirX: 1, owner: 0 });
        const seen = new Set<string>();
        for (let t = 0; t < 400 && !y.removed; t++) {
          tw.run(1);
          drawAll(tw, r);
          seen.add(y.anim.id);
        }
        if (kind === 'bullet') for (const s of ['die-seat', 'get-up', 'flee']) expect(seen.has(`${art}/${s}`), `${kind}: ${s}`).toBe(true);
        expect(tw.world.errors, kind).toEqual([]);
      }
      expectValid(calls);
      const drawn = new Set(calls.map(([id]) => id));
      for (const s of ['ride', 'tell', 'kick', 'turn', 'gag', 'photo-pose', 'gloat', 'cower', 'die-seat', 'get-up', 'flee', 'die-blast', 'die-burn', 'die-crush', 'bike']) {
        expect(drawn.has(`${art}/${s}`), `${art}/${s} drawn`).toBe(true);
      }
      // (die and die-knife: a shot or knifed youth falls off the seat instead, FatbikeYouth.deathEffects)
      // the cap fx is the base set's (every capped look tumbles it)
      expect(drawn.has(`${PREFIX}/cap`)).toBe(true);
    });
  }

  it('the frame pick of the turn (Rider.turnFrame) is always inside the strip', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const y = tw.spawn('fatbike-youth', 300, { look: 0, skin: 'a', gag: 'circles' }, FLOOR) as FatbikeYouth;
    let turned = 0;
    for (let t = 0; t < 400; t++) {
      tw.run(1);
      const k = y.turnFrame();
      if (k >= 0) {
        turned++;
        expect(k).toBeLessThan(frameCount(`${PREFIX}/turn`));
      }
    }
    expect(turned).toBeGreaterThan(0);
  });
});
