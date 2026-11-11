/**
 * The delivery rider at 40 px (docs/design/ams40.md wave 4): the baked set `delivery-rider`
 * (src/game/content/art40/delivery-rider.gen.ts, drawn by tools/art40/chars/delivery-rider/) keeps
 * the strip contract of docs/design/ams40/contract.md "delivery rider": the 52 ids of skins a, b, c
 * (skins a and c are palette variants; the food-cube prop is the base id's only), the frame counts
 * of the plan's class table, the logic times (two listed changes), the anchor (the tyres stand on
 * the anchor line) and the points hand / head / hip on the on-foot strips, 1× pixels at every art
 * tier (rule 7), 28 colours (D1); the kick's extended frame KICK_HIT at tick 3 inside the 6-tick
 * kick window; the rider's own update loop (Rider / DeliveryRider) picks an existing frame at every
 * tick of every mode, deaths and FX included; the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { Damage, DamageKind } from '../../src/engine/entity';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, isDeferredSprite, listDenseAliases, listSprites, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/delivery-rider.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { KICK_HIT } from '../../src/game/content/locals/delivery-rider.art';
import { DELIVERY, DeliveryRider } from '../../src/game/content/locals/delivery-rider';
import { KICK_BOX, RIDER_BOX, RIDER_TURN } from '../../src/game/content/locals/rider';
import { gloatHoldOf, reactInArea, startGloatHold } from '../../src/game/enemy';
import { FxEntity } from '../../src/game/fx';
import { getEntityMeta } from '../../src/game/registry';
import { TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PREFIX = 'enemy/delivery-rider';
const PREFIXES = [PREFIX, `${PREFIX}-a`, `${PREFIX}-c`];

interface ContractEntry {
  character: string;
  set: string;
  strip: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  defer?: boolean;
  totalTicks?: number;
  events?: Array<{ name: string; tick: number }>;
  shownTicks?: number;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT).filter((id) => CONTRACT[id].character === 'delivery-rider').sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const R3 = [2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2, 1];

/** Frame counts (the plan's class table), durations, loop, defer and class of every strip. */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, defer: boolean, cls: string]>> = {
  ride: [12, R3, true, false, 'ride'],
  idle: [4, [10, 5, 10, 5], true, false, 'idle'],
  turn: [3, [2, 2, 2], false, false, 'turn'],
  alert: [1, [30], true, false, 'telegraph'],
  tell: [12, R3, true, false, 'telegraph'],
  gag: [12, Array(12).fill(2), true, false, 'fidget'],
  kick: [6, [1, 1, 1, 2, 2, 29], false, false, 'melee'],
  'photo-pose': [6, [4, 3, 3, 4, 3, 3], true, false, 'victory'],
  gloat: [6, [6, 4, 4, 6, 4, 4], true, true, 'victory'],
  cower: [4, [3, 3, 3, 3], true, true, 'reaction'],
  die: [10, [5, 5, 4, 4, 3, 5, 4, 5, 5, 10], false, false, 'die'],
  'die-knife': [10, [3, 3, 4, 4, 4, 4, 5, 4, 5, 10], false, false, 'die'],
  'die-blast': [10, [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], false, false, 'die-blast'],
  'die-burn': [8, [3, 4, 4, 10, 7, 5, 4, 5], false, false, 'die-burn'],
  'die-crush': [6, [6, 3, 10, 6, 6, 16], false, false, 'die-crush'],
  flee: [12, [1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2], true, false, 'locomotion'],
  bike: [6, [6, 6, 6, 8, 6, 6], false, false, 'prop'],
  'food-cube': [4, [5, 5, 5, 5], true, false, 'prop'],
};

/**
 * Logic time changes against the contract (no code reads these totals): the tell pedals a whole
 * crank turn (20 ticks, the ride's cadence: the legs never swap at the loop) and rings the bell
 * twice (every 10 ticks, the old rhythm); the cower trembles over 4 frames at the old 3 ticks.
 */
const TIME_CHANGES: Readonly<Record<string, readonly [before: number, after: number]>> = { tell: [10, 20], cower: [6, 12] };

/** The strips drawn on the bike (the tyres stand on the anchor line). */
const ON_BIKE = ['ride', 'idle', 'turn', 'alert', 'tell', 'gag', 'kick', 'photo-pose', 'gloat', 'cower'];
/** Smear frames, the only ones the strips may mark. */
const SMEARS: Readonly<Record<string, readonly number[]>> = { kick: [1, 2], die: [4], 'die-blast': [5], 'die-crush': [1] };

/** The registered ids (the base prefix also has food-cube). */
const registered = (): string[] => listSprites(PREFIX).filter((id) => PREFIXES.some((p) => id.startsWith(`${p}/`))).sort();

describe('delivery-rider: the set', () => {
  it('registers exactly the contract ids: skins a, b, c, the food-cube under the base prefix only', () => {
    expect(CONTRACT_IDS.length).toBe(52);
    expect(registered()).toEqual(CONTRACT_IDS);
    expect(SET.prefix).toBe(PREFIX);
    expect(Object.keys(SET.variants ?? {}).sort()).toEqual([`${PREFIX}-a`, `${PREFIX}-c`]);
    // the full set would add the variants' food-cube: the registration's `only` keeps it off
    expect(bakedSetIds(SET).length).toBe(54);
    expect(hasSprite(`${PREFIX}-a/food-cube`)).toBe(false);
    expect(hasSprite(`${PREFIX}-c/food-cube`)).toBe(false);
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
      expect(st.defer ?? false, `${name} defer = contract`).toBe(c.defer ?? false);
      expect(st.cls, name).toBe(cls);
      const change = TIME_CHANGES[name];
      if (change) {
        expect(c.totalTicks, `${name} old`).toBe(change[0]);
        expect(sum(st.durations), `${name} new`).toBe(change[1]);
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

  it('every frame decodes: w*h pixels, palette indices in range, 28 colours, the one outline; skins swap only the skin', () => {
    expect(SET.budget).toBe(28);
    const fx = new Set(SET.fx ?? []);
    const body = SET.pal.filter((_, i) => i > 0 && !fx.has(i));
    expect(new Set(body).size).toBeLessThanOrEqual(28);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    for (const [p, pal] of Object.entries(SET.variants ?? {})) {
      expect(pal.length, p).toBe(SET.pal.length);
      const diff = pal.flatMap((c, i) => (c !== SET.pal[i] ? [i] : []));
      expect(diff.length, `${p}: the four skin tones`).toBe(4);
    }
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
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(name === 'food-cube' ? 100 : 150);
      });
    }
  });

  it('the anchor: the tyres stand on the line on every bike frame; the contract points on the on-foot strips; smears only where allowed', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const c = CONTRACT[`${PREFIX}/${name}`];
      st.frames.forEach((f, i) => {
        expect(f.ox, `${name}#${i}`).toBeGreaterThanOrEqual(0);
        expect(f.ox, `${name}#${i}`).toBeLessThan(f.w);
        if (ON_BIKE.includes(name) || name === 'bike') expect(f.oy, `${name}#${i} on the line`).toBe(f.h);
        const want = c.framePoints[Math.min(i, c.framePoints.length - 1)] ?? [];
        for (const p of want) {
          const pt = f.pts?.[p];
          expect(pt, `${name}#${i} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${name}#${i} ${p}`).toBe(true);
        }
        expect(f.smear === true, `${name}#${i} smear`).toBe((SMEARS[name] ?? []).includes(i));
      });
    }
    // a 40 px rider: the helmet top 41-46 px over the road while riding (D7: the hitbox stays 34)
    for (const f of SET.strips.ride.frames) {
      expect(f.oy).toBeGreaterThanOrEqual(41);
      expect(f.oy).toBeLessThanOrEqual(46);
    }
    // the food cube: centred on its anchor
    for (const f of SET.strips['food-cube'].frames) {
      expect(Math.abs(f.ox - f.w / 2)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(f.oy - f.h / 2)).toBeLessThanOrEqual(1.5);
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

  it('1x pixels at every art tier (rule 7): no dense art, no dense alias, getFrames(id, 2|4) give the 1x frames', () => {
    const aliases = new Set([...listDenseAliases(2), ...listDenseAliases(4)].flatMap(([a, b]) => [a, b]));
    for (const id of CONTRACT_IDS) {
      expect(hasHiSprite(id, 2), id).toBe(false);
      expect(hasHiSprite(id, 4), id).toBe(false);
      expect(aliases.has(id), id).toBe(false);
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

/** The opaque pixels of a frame relative to its anchor. */
function opaque(f: BakedSet['strips'][string]['frames'][number]): Array<[number, number]> {
  const idx = decodeBakedIndices(f);
  const out: Array<[number, number]> = [];
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (idx[y * f.w + x]) out.push([x - f.ox, y - f.oy]);
  return out;
}

describe('delivery-rider: the code', () => {
  it('KICK_HIT: the exported constant is the set event, a frame index that starts at tick 3 inside the 6-tick kick window', () => {
    expect(KICK_HIT).toBe(GEN.KICK_HIT);
    expect(SET.events?.KICK_HIT).toBe(KICK_HIT);
    const st = SET.strips.kick;
    expect(KICK_HIT).toBeGreaterThanOrEqual(0);
    expect(KICK_HIT).toBeLessThan(st.frames.length);
    const ev = CONTRACT[`${PREFIX}/kick`].events?.find((e) => e.name === 'KICK_HIT');
    expect(ev?.tick).toBe(3);
    expect(sum(st.durations.slice(0, KICK_HIT))).toBe(ev?.tick);
    // the hit frame (and the recoil after it) start before the code leaves the kick
    expect(sum(st.durations.slice(0, KICK_HIT + 1))).toBeLessThan(DELIVERY.kick);
    expect(CONTRACT[`${PREFIX}/kick`].shownTicks).toBe(DELIVERY.kick);
  });

  it('the hit frame reaches into the kick box: the sole is out past every ride frame at shin height', () => {
    const box = (p: [number, number]): boolean => p[1] >= KICK_BOX.y && p[1] < KICK_BOX.y + KICK_BOX.h && p[0] >= KICK_BOX.x && p[0] < KICK_BOX.x + KICK_BOX.w;
    const reach = (f: BakedSet['strips'][string]['frames'][number]): number => Math.max(...opaque(f).filter(box).map((p) => p[0]));
    const ride = Math.max(...SET.strips.ride.frames.map(reach));
    const hit = reach(SET.strips.kick.frames[KICK_HIT]);
    expect(hit).toBeGreaterThan(ride);
    // the anticipation frame does not reach out yet
    expect(reach(SET.strips.kick.frames[0])).toBeLessThanOrEqual(ride + 1);
  });

  it('the turn strip has RIDER_TURN frames; turnFrame never leaves the strip', () => {
    expect(SET.strips.turn.frames.length).toBe(RIDER_TURN.frames);
    expect(SET.strips.turn.durations.every((d) => d === RIDER_TURN.ticksPerFrame)).toBe(true);
    // the squeeze narrows frame by frame and keeps the line
    const w = SET.strips.turn.frames.map((f) => f.w);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
  });

  it('the ride keeps the old 20-tick crank turn at 2.2 px a tick (the wheels carry him: no foot gate)', () => {
    expect(sum(SET.strips.ride.durations)).toBe(20);
    expect(DELIVERY.speed).toBe(2.2);
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
    if (!PREFIXES.some((p) => id.startsWith(`${p}/`))) continue;
    n++;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} index ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
  return n;
}

/** Run `ticks` ticks (each(t) after the tick), drawing the world's riders and their FX each tick; returns the modes seen and the strips drawn. */
function drive(tw: TestWorld, ticks: number, each?: (t: number) => void): { modes: Set<string>; strips: Set<string>; draws: number } {
  const { r, calls } = recorder();
  const modes = new Set<string>();
  for (let t = 0; t < ticks; t++) {
    tw.run(1);
    each?.(t);
    for (const e of tw.world.entities) {
      if (e instanceof DeliveryRider) {
        modes.add(e.dead ? 'dead' : e.mode);
        e.draw(r);
      } else if (e instanceof FxEntity && PREFIXES.some((p) => e.sprite.startsWith(`${p}/`))) e.draw(r);
    }
  }
  const draws = expectValid(calls);
  return { modes, strips: new Set(calls.map(([id]) => id.slice(id.lastIndexOf('/') + 1))), draws };
}

describe('delivery-rider: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): 10 hp, 200 points, the 24 x 34 hitbox, tell 20, kick 6 at reach 22, the kick box', () => {
    expect(DELIVERY).toMatchObject({ hp: 10, score: 200, speed: 2.2, tele: 20, kick: 6, reach: 22, chat: 120, behind: 20, circle: 22, circleSpeed: 1.1 });
    expect(KICK_BOX).toEqual({ x: 4, y: -22, w: 20, h: 16 });
    expect(RIDER_BOX).toEqual({ w: 24, h: 34 });
    expect(RIDER_TURN).toEqual({ frames: 3, ticksPerFrame: 2 });
    expect(getEntityMeta('delivery-rider')?.score).toBe(200);
    const tw = new TestWorld({ playerX: 100, god: true });
    const d = tw.spawn('delivery-rider', 300, { skin: 'a' }) as DeliveryRider;
    expect(d.art).toBe(`${PREFIX}-a`);
    expect(d.hp).toBe(10);
    expect(d.hitbox.w).toBe(24);
    expect(d.hitbox.h).toBe(34);
    const skins = (['a', 'b', 'c'] as const).map((s) => (tw.spawn('delivery-rider', 320, { skin: s }) as DeliveryRider).art);
    expect(skins).toEqual([`${PREFIX}-a`, PREFIX, `${PREFIX}-c`]);
  });

  it('rides in, rings (tell), kicks (the box live exactly DELIVERY.kick ticks at 2.2 px a tick), rides off: every frame drawn exists', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
    const d = tw.spawn('delivery-rider', 300, { skin: 'c' }) as DeliveryRider;
    let live = 0;
    const speeds = new Set<number>();
    const run = drive(tw, 150, () => {
      if (d.contactDamage) live++; // only the kick sets it (its last live tick already switches to 'away')
      if (!d.dead && (d.mode === 'ride' || d.mode === 'tell' || d.mode === 'kick' || d.mode === 'away')) speeds.add(Math.abs(d.vx));
    });
    expect(d.mode === 'ride' || run.modes.has('ride') || run.modes.has('tell')).toBe(true);
    for (const m of ['tell', 'kick', 'away']) expect(run.modes.has(m), m).toBe(true);
    for (const s of ['ride', 'tell', 'kick']) expect(run.strips.has(s), s).toBe(true);
    expect(live).toBe(DELIVERY.kick);
    expect([...speeds].every((v) => v === 0 || Math.abs(v - DELIVERY.speed) < 1e-9)).toBe(true);
    expect(run.draws).toBeGreaterThan(100);
    expect(tw.world.errors).toEqual([]);
  });

  it('the gag (the phone), the gloat lap with its turns, the phone, then the cower and the photo: every frame drawn exists', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4 });
    const g = tw.spawn('delivery-rider', 330, { gag: true }) as DeliveryRider;
    const a = drive(tw, 40);
    expect(a.strips.has('gag')).toBe(true);
    expect(g.mode).toBe('gag');
    const tw2 = new TestWorld({ playerX: 100, god: true });
    const spot = tw2.player!;
    tw2.spawn('delivery-rider', 250, { facing: 'right', gag: false });
    tw2.run(1);
    startGloatHold(tw2.world);
    expect(gloatHoldOf(tw2.world)).toBeGreaterThan(0);
    const b = drive(tw2, 160, (t) => {
      if (t % 60 === 0) reactInArea(tw2.world, tw2.world.camera.view(), 'gloat', 70, { onScreen: true, source: spot });
    });
    for (const s of ['ride', 'turn', 'gloat']) expect(b.strips.has(s), s).toBe(true);
    reactInArea(tw2.world, tw2.world.camera.view(), 'cower', 30, { onScreen: true, source: spot });
    const c = drive(tw2, 30);
    expect(c.strips.has('cower')).toBe(true);
    const tw3 = new TestWorld({ playerX: 100, god: true });
    const p = tw3.spawn('delivery-rider', 200, { gag: true }) as DeliveryRider;
    p.react('photo', 40);
    const e = drive(tw3, 40);
    expect(e.strips.has('photo-pose')).toBe(true);
    expect(tw.world.errors.concat(tw2.world.errors, tw3.world.errors)).toEqual([]);
  });

  it('every death kind plays its strip once, the bike wreck and the food cube fly as FX, the body is removed: every frame drawn exists', () => {
    const kinds: Array<[DamageKind, string]> = [['bullet', 'die'], ['knife', 'die-knife'], ['explosion', 'die-blast'], ['fire', 'die-burn'], ['crush', 'die-crush']];
    for (const [kind, strip] of kinds) {
      const tw = new TestWorld({ playerX: 100, god: true, seed: 5 });
      const d = tw.spawn('delivery-rider', 220, { gag: true }) as DeliveryRider;
      tw.run(2);
      const dmg: Damage = { amount: 100, kind, dirX: 1 };
      tw.world.damage(d, dmg);
      expect(d.dead, kind).toBe(true);
      expect(d.anim.id, kind).toBe(`${d.art}/${strip}`);
      const run = drive(tw, 160);
      expect(run.strips.has(strip), kind).toBe(true);
      expect(run.strips.has('bike'), `${kind}: the wreck`).toBe(true);
      expect(run.strips.has('food-cube'), `${kind}: the bag`).toBe(true);
      expect(d.removed, `${kind}: the corpse goes`).toBe(true);
      expect(tw.world.errors, kind).toEqual([]);
    }
  });
});
