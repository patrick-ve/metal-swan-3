/**
 * The FABEL FRIET baker at 40 px (docs/design/ams40.md wave 5): the baked set `ams-baker`
 * (src/game/content/art40/ams-baker.gen.ts, drawn by tools/art40/chars/ams-baker/) keeps the strip
 * contract of docs/design/ams40/contract.md "Fabel Friet baker": the 12 ids, the frame counts of the
 * plan's class table, the logic times (idle 60, talk 32, walk 36 (drawn for 0.8 px/tick: a 28.8 px stride), toss 28 with the release at tick
 * 14, clap 12, cheer 32, wave 20, in-<mode> 6, turn 4), the feet anchor and the points hand / head /
 * hip on every frame, the walk stride for 0.8 px/tick (rule 5), 1× pixels at every art tier
 * (rule 7), 28 colours (D1); the fit behind the FABEL FRIET counter (rule 10); the baker's own
 * update loop (AmsPerson / AmsBaker in entities.ts) picks an existing frame at every tick of every
 * mode and tosses the prize from the scoop on TOSS_RELEASE; the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { Entity } from '../../src/engine/entity';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/ams-baker.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/missions/ams/entities';
import type { AmsBaker } from '../../src/game/content/missions/ams/entities';
import { PERSON_TR_TICKS, PERSON_TURN_TICKS, PERSON_WALK_SPEED, TOSS_RELEASE, TRANSITION_MODES } from '../../src/game/content/missions/ams/npc.art';
import { getEntityMeta } from '../../src/game/registry';
import { FLOOR, TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PREFIX = 'npc/ams/ams-baker';

interface ContractEntry {
  character: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  totalTicks?: number;
  anchorKind?: string;
  speed?: number;
  events?: { name: string; tick: number; kind: string }[];
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT).filter((id) => CONTRACT[id].character === 'baker').sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Frame counts (the plan's class table), durations and loop flags (the contract's logic time). */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, cls: string]>> = {
  idle: [4, [15, 15, 15, 15], true, 'idle-breathing'],
  talk: [8, [4, 4, 4, 4, 4, 4, 4, 4], true, 'idle-fidget'],
  walk: [12, Array(12).fill(3), true, 'locomotion'],
  toss: [6, [6, 5, 3, 3, 6, 5], false, 'throw'],
  clap: [6, [2, 2, 2, 2, 2, 2], true, 'victory'],
  cheer: [6, [6, 4, 6, 6, 4, 6], true, 'victory'],
  wave: [6, [4, 3, 3, 4, 3, 3], true, 'victory'],
  'in-talk': [2, [3, 3], false, 'turn'],
  'in-clap': [2, [3, 3], false, 'turn'],
  'in-cheer': [2, [3, 3], false, 'turn'],
  'in-wave': [2, [3, 3], false, 'turn'],
  turn: [2, [2, 2], true, 'turn'],
};
/** The one smear frame: the toss's underhand swing (the scoop's arc trails it). */
const SMEARS: Readonly<Record<string, readonly number[]>> = { toss: [2] };
/** The toss's old logic time (4 frames x TOSS_TICKS 7) and release (frame 2 of 4: tick 14). */
const OLD_TOSS_TICKS = 28;
const OLD_RELEASE_TICK = 14;

describe('ams-baker: the set', () => {
  it('registers exactly the contract ids (docs/design/ams40/contract.json), no variants', () => {
    expect(CONTRACT_IDS.length).toBe(12);
    expect([...bakedSetIds(SET)].sort()).toEqual(CONTRACT_IDS);
    expect(SET.prefix).toBe(PREFIX);
    expect(SET.variants ?? {}).toEqual({});
    for (const id of CONTRACT_IDS) expect(hasSprite(id), id).toBe(true);
  });

  it('frame counts, durations, loop and defer flags: the class table and the contract logic time', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [name, [n, d, loop, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[name];
      const c = CONTRACT[`${PREFIX}/${name}`];
      expect(st.frames.length, name).toBe(n);
      expect(st.durations, name).toEqual(d);
      expect(st.loop, name).toBe(loop);
      expect(st.loop, `${name} loop = contract`).toBe(c.loop);
      expect(st.defer ?? false, name).toBe(false);
      expect(st.cls, name).toBe(cls);
      expect(sum(st.durations), `${name} logic time`).toBe(c.totalTicks);
      // the registry plays the baked durations
      expect(frameCount(`${PREFIX}/${name}`), name).toBe(n);
      expect(spriteAnim(`${PREFIX}/${name}`).durations, name).toEqual(d);
      expect(spriteAnim(`${PREFIX}/${name}`).loop, name).toBe(loop);
    }
  });

  it('every frame decodes: w*h pixels, palette indices in range, 28 colours (FX outside), the one outline', () => {
    expect(SET.budget).toBe(28);
    const fx = new Set(SET.fx ?? []);
    const body = SET.pal.slice(1).filter((_, i) => !fx.has(i + 1));
    expect(body.length).toBeLessThanOrEqual(28);
    expect(new Set(SET.pal.slice(1)).size).toBe(SET.pal.length - 1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    // the FX letters are the shared FX ramp (the clap lines, the swing arc)
    for (const i of fx) expect(['#ffffff', '#fffbd8', '#ffe070', '#7a6e70']).toContain(SET.pal[i]);
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
        // a whole figure (the turn's narrowest squeeze has the fewest pixels)
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(name === 'turn' ? 150 : 400);
      });
    }
  });

  it('the feet anchor and every contract point on every frame; smears only on the toss swing', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const c = CONTRACT[`${PREFIX}/${name}`];
      st.frames.forEach((f, i) => {
        // feet: the line under the soles (the cheer's hop lifts the feet over it)
        if (name === 'cheer') expect(f.oy, `${name}#${i}`).toBeGreaterThanOrEqual(f.h);
        else expect(f.oy, `${name}#${i}`).toBe(f.h);
        expect(f.ox, `${name}#${i}`).toBeGreaterThanOrEqual(0);
        expect(f.ox, `${name}#${i}`).toBeLessThan(f.w);
        // the game's points (the walk also carries 'plant', the planted foot of the foot gate)
        const want = c.framePoints[Math.min(i, c.framePoints.length - 1)];
        for (const p of ['hand', 'head', 'hip']) expect(want, `${name}#${i}`).toContain(p);
        expect(want.filter((p) => !['hand', 'head', 'hip'].includes(p)), `${name}#${i}`).toEqual(name === 'walk' ? ['plant'] : []);
        for (const p of want) {
          if (p === 'plant') continue; // on the floor line: checked by the walk test below
          const pt = f.pts?.[p];
          expect(pt, `${name}#${i} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${name}#${i} ${p}`).toBe(true);
          expect(pt![1], `${name}#${i} ${p}`).toBeLessThan(0);
          expect(pt![1], `${name}#${i} ${p}`).toBeGreaterThanOrEqual(-f.oy);
        }
        // the hip is the pelvis (15-20 px over the floor), the head over it
        expect(-f.pts!.hip[1], `${name}#${i} hip`).toBeGreaterThanOrEqual(14);
        expect(-f.pts!.hip[1], `${name}#${i} hip`).toBeLessThanOrEqual(21);
        expect(f.pts!.head[1], `${name}#${i} head`).toBeLessThan(f.pts!.hip[1] - 10);
        expect(f.smear ?? false, `${name}#${i} smear`).toBe((SMEARS[name] ?? []).includes(i));
      });
    }
  });

  it('a 40 px figure (D7): 40-45 px standing (the cap included), as wide as a person', () => {
    for (const name of ['idle', 'talk', 'clap', 'turn', 'in-talk']) {
      for (const f of SET.strips[name].frames) {
        expect(f.h, name).toBeGreaterThanOrEqual(40);
        expect(f.h, name).toBeLessThanOrEqual(45);
      }
    }
    for (const f of SET.strips.idle.frames) expect(f.w).toBeLessThanOrEqual(28);
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

  it('the walk: the planted foot drifts at most 1 px a frame at 0.8 px/tick (rule 5), a 28.8 px cycle (the handhaver stride)', () => {
    const walk = SET.strips.walk;
    const c = CONTRACT[`${PREFIX}/walk`];
    expect(c.speed).toBe(PERSON_WALK_SPEED);
    // the old cycle: 8 frames x 6 ticks at 0.8 px/tick = 38.4 px (a lunge on 40 px legs); the new: 12 x 3 at
    // 0.8 = 28.8 px, the stride of the approved handhaver and the crew (only the speed is contract)
    expect(sum(walk.durations) * PERSON_WALK_SPEED).toBeCloseTo(28.8, 6);
    let same = 0;
    for (let i = 0; i < walk.frames.length; i++) {
      const a = walk.frames[i].pts?.plant;
      const b = walk.frames[(i + 1) % walk.frames.length].pts?.plant;
      expect(a, `walk#${i} plant`).toBeDefined();
      if (!a || !b) continue;
      // facing right and walking right: the planted foot moves back by speed x hold, or the other foot takes over
      const dx = b[0] - a[0];
      const step = -PERSON_WALK_SPEED * walk.durations[i];
      if (Math.abs(dx - step) <= 1) same++;
      else expect(Math.abs(dx), `walk#${i}: a foot change`).toBeGreaterThanOrEqual(6);
      expect(Math.abs(a[1]), `walk#${i} plant on the floor`).toBeLessThanOrEqual(1);
    }
    expect(same).toBeGreaterThanOrEqual(9);
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
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}#${i}`).toEqual([one[i].buf.w, one[i].buf.h, one[i].ox, one[i].oy]);
          expect(Array.from(f.buf.data), `${id}@${d}#${i}`).toEqual(Array.from(one[i].buf.data));
        });
      }
    }
  });

  it('the look: the gold fries in the scoop at rest and in the talk, none at the top of the toss, half a scoop at the settle', () => {
    const gold = ['#ffe27a', '#e0a630'].map((h) => SET.pal.indexOf(h));
    expect(gold.every((k) => k > 0)).toBe(true);
    const goldOver = (f: (typeof SET.strips)['idle']['frames'][number], above: number): number => {
      const idx = decodeBakedIndices(f);
      let n = 0;
      // gold pixels above the belt (the buckle and the apron piping are lower)
      for (let y = 0; y < f.oy - above; y++) for (let x = 0; x < f.w; x++) if (gold.includes(idx[y * f.w + x])) n++;
      return n;
    };
    // the cap badge and peak piping are gold too (about 8 px): the scoop of fries adds more than 10
    // the reference: the clap (the scoop in the apron pocket, only the cap's gold over the belt)
    const cap = goldOver(SET.strips.clap.frames[0], 24);
    expect(goldOver(SET.strips.toss.frames[4], 24), 'the top of the toss: the bowl is empty (one fry in the air)').toBeLessThan(cap + 6);
    for (const f of SET.strips.idle.frames) expect(goldOver(f, 24)).toBeGreaterThan(cap + 10);
    for (const f of SET.strips.talk.frames) expect(goldOver(f, 24)).toBeGreaterThan(cap + 10);
    // the settle dips the scoop back: some fries again (no pop to the full idle scoop), fewer than at rest
    const settle = goldOver(SET.strips.toss.frames[5], 24);
    expect(settle).toBeGreaterThan(cap + 2);
    expect(settle).toBeLessThan(goldOver(SET.strips.idle.frames[0], 24));
  });
});

describe('ams-baker: the code', () => {
  it('TOSS_RELEASE: exported by the bake, read by entities.ts, inside the toss, starting at the old release tick 14', () => {
    expect(GEN.TOSS_RELEASE).toBe(3);
    expect(SET.events?.TOSS_RELEASE).toBe(GEN.TOSS_RELEASE);
    // npc.art.ts re-exports the bake's constant (entities.ts imports it from there)
    expect(TOSS_RELEASE).toBe(GEN.TOSS_RELEASE);
    const toss = SET.strips.toss;
    expect(TOSS_RELEASE).toBeGreaterThan(0);
    expect(TOSS_RELEASE).toBeLessThan(toss.frames.length);
    const ev = CONTRACT[`${PREFIX}/toss`].events ?? [];
    expect(ev).toEqual([{ name: 'TOSS_RELEASE', tick: OLD_RELEASE_TICK, kind: 'frame' }]);
    expect(sum(toss.durations.slice(0, TOSS_RELEASE))).toBe(OLD_RELEASE_TICK);
    expect(sum(toss.durations)).toBe(OLD_TOSS_TICKS);
    // anticipation before the release (2 wind-up frames + the swing), follow-through and settle after it
    expect(TOSS_RELEASE).toBeGreaterThanOrEqual(3);
    expect(toss.frames.length - TOSS_RELEASE - 1).toBeGreaterThanOrEqual(2);
  });

  it("the release frame's hand point is the scoop's bowl: in front of him, at his face (the prize leaves from there)", () => {
    const f = SET.strips.toss.frames[TOSS_RELEASE];
    const [hx, hy] = f.pts!.hand;
    expect(hx).toBeGreaterThanOrEqual(8);
    expect(hx).toBeLessThanOrEqual(24);
    expect(hy).toBeLessThanOrEqual(-26);
    expect(hy).toBeGreaterThanOrEqual(-38);
    // the old release point was the fist at (9, -30); the bowl is 13 px further out on the stretched
    // arm (the prize homes in on the catcher: sim ams --section a is the same with either point)
    expect(Math.hypot(hx - 9, hy + 30)).toBeLessThanOrEqual(16);
    // the wind-up holds the scoop behind him
    expect(SET.strips.toss.frames[1].pts!.hand[0]).toBeLessThan(0);
  });

  it('the transitions and the turn keep 2 frames at PERSON_TR_TICKS / PERSON_TURN_TICKS (entities.ts indexes them so)', () => {
    expect(PERSON_TR_TICKS).toBe(3);
    expect(PERSON_TURN_TICKS).toBe(2);
    expect([...TRANSITION_MODES].sort()).toEqual(['cheer', 'clap', 'talk', 'wave']);
    for (const m of TRANSITION_MODES) {
      expect(hasSprite(`${PREFIX}/in-${m}`), m).toBe(true);
      expect(SET.strips[`in-${m}`].durations).toEqual([PERSON_TR_TICKS, PERSON_TR_TICKS]);
    }
    expect(SET.strips.turn.durations).toEqual([PERSON_TURN_TICKS, PERSON_TURN_TICKS]);
  });

  it('the fit (rule 10): behind the FABEL FRIET counter (18 rows) his head and shoulders show, the scoop over the counter', () => {
    const COUNTER = 18;
    for (const name of ['idle', 'talk', 'wave', 'cheer', 'clap']) {
      for (const f of SET.strips[name].frames) expect(f.oy - COUNTER, `${name}: rows over the counter`).toBeGreaterThanOrEqual(20);
    }
    // the scoop's hand at rest is at the counter top: the scoop of fries shows over it
    for (const f of SET.strips.idle.frames) expect(-f.pts!.hand[1]).toBeGreaterThanOrEqual(COUNTER);
    // the door of the shop (art.ts: about 40 rows under the lintel): the cap never pokes into the sign
    // (the toss's flying fries and the raised scoop leave the door on purpose)
    for (const name of ['idle', 'talk', 'clap', 'turn', 'in-talk']) {
      for (const f of SET.strips[name].frames) expect(f.oy, name).toBeLessThanOrEqual(44);
    }
  });
});

/** Every sprite the baker draws, through a recording renderer. */
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
    if (!id.startsWith(PREFIX)) continue;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} index ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
}

describe('ams-baker: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): npc, no enemy / shootable tag, hitbox 14 x 36, z 27, speed 0.8, the voice', () => {
    expect(getEntityMeta('ams-baker')?.category).toBe('npc');
    const tw = new TestWorld({ playerX: null });
    const b = tw.spawn('ams-baker', 200) as AmsBaker;
    expect(b.hitbox).toEqual({ x: -7, y: -36, w: 14, h: 36 });
    expect(b.z).toBe(27);
    expect(b.speed).toBe(0.8);
    expect(b.hasTag('enemy')).toBe(false);
    expect(b.hasTag('shootable')).toBe(false);
    expect(b.facing).toBe(-1);
    expect(b.speaker).toBe('baker');
    expect(b.tossed).toBe(0);
  });

  it('the toss: the prize leaves the scoop at tick 14 from the hand point, he is back in idle at tick 28', () => {
    for (const facing of [-1, 1]) {
      const tw = new TestWorld({ playerX: 100, god: true });
      const b = tw.spawn('ams-baker', 200, { facing }, FLOOR) as AmsBaker;
      tw.run(3);
      const spawned: Array<[string, number, number]> = [];
      const own = tw.world.spawn.bind(tw.world);
      tw.world.spawn = ((id: string, x: number, y: number, p?: Record<string, unknown>): Entity | null => {
        spawned.push([id, x, y]);
        return own(id, x, y, p);
      }) as typeof tw.world.spawn;
      b.toss({ id: 'pickup-bombs' });
      expect(b.mode).toBe('toss');
      let t = 0;
      while (b.tossed === 0 && t < 60) {
        tw.run(1);
        t++;
      }
      expect(t).toBe(OLD_RELEASE_TICK);
      expect(b.anim.index).toBe(TOSS_RELEASE);
      const item = spawned.find(([id]) => id === 'pickup-bombs');
      expect(item).toBeDefined();
      const hand = SET.strips.toss.frames[TOSS_RELEASE].pts!.hand;
      // the hand point, mirrored when he faces left (the game flips the sprite)
      expect(item![1]).toBeCloseTo(b.x + (facing < 0 ? -hand[0] : hand[0]), 6);
      expect(item![2]).toBeCloseTo(b.y + hand[1], 6);
      while (b.mode === 'toss' && t < 80) {
        tw.run(1);
        t++;
      }
      expect(t).toBe(OLD_TOSS_TICKS);
      expect(b.mode).toBe('idle');
      expect(b.tossed).toBe(1);
      expect(tw.world.errors).toEqual([]);
    }
  });

  it('the walk: 0.8 px a tick, a full 12-frame cycle in 36 ticks (28.8 px), the finale walk at 1.1 cycles faster', () => {
    const tw = new TestWorld({ playerX: null });
    const b = tw.spawn('ams-baker', 100, { mode: 'walk', to: 400, facing: 1 }, FLOOR) as AmsBaker;
    expect(b.mode).toBe('walk');
    const x0 = b.x;
    const seen: number[] = [];
    for (let k = 0; k < 36; k++) {
      if (seen[seen.length - 1] !== b.anim.index) seen.push(b.anim.index);
      tw.run(1);
    }
    expect(b.x - x0).toBeCloseTo(28.8, 6);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(b.anim.index).toBe(0);
    const f = tw.spawn('ams-baker', 100, { mode: 'walk', to: 400, facing: 1, speed: 1.1 }, FLOOR) as AmsBaker;
    tw.run(18);
    // 18 ticks at 0.8 px/tick show frame 6; at 1.1 the cadence follows the speed (strideRate)
    expect(f.anim.index).toBeGreaterThanOrEqual(8);
    expect(tw.world.errors).toEqual([]);
  });

  it('every mode, every tick: the presentation draws an existing frame (briefing, finale, transitions, turns)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const b = tw.spawn('ams-baker', 220, { counter: true }, FLOOR) as AmsBaker;
    const { r, calls } = recorder();
    const step = (n: number): void => {
      for (let k = 0; k < n; k++) {
        tw.run(1);
        b.draw(r);
      }
    };
    step(70);
    expect(b.mode).toBe('idle');
    // the briefing: talk (in-talk forward, the loop, in-talk backward), the toss
    b.talk(150);
    expect(b.trT).toBe(2 * PERSON_TR_TICKS);
    step(160);
    expect(b.mode).toBe('idle');
    b.toss({ id: 'pickup-bombs' });
    step(40);
    expect(b.mode).toBe('idle');
    // the finale: walk in, clap, cheer; the wave
    b.walkTo(320, 'clap');
    step(200);
    expect(b.arrived).toBe(true);
    expect(b.mode).toBe('clap');
    step(40);
    b.cheer(100);
    step(105);
    b.idle();
    step(10);
    for (const m of ['clap', 'cheer', 'wave'] as const) {
      b.setMode(m, 50);
      expect(b.trT, m).toBe(2 * PERSON_TR_TICKS);
      step(60);
      expect(b.mode).toBe('idle');
    }
    // turning around (draw-only turn strip), several times
    for (const x of [400, 0, 400]) {
      b.face(x);
      step(12);
    }
    expectValid(calls);
    const all = Object.keys(STRIPS);
    const drawn = new Set(calls.map(([id]) => id).filter((id) => id.startsWith(PREFIX)));
    for (const s of all) expect(drawn.has(`${PREFIX}/${s}`), s).toBe(true);
    // every frame of every strip was shown
    for (const s of all) {
      const id = `${PREFIX}/${s}`;
      const seen = new Set(calls.filter(([c]) => c === id).map(([, i]) => i));
      expect(seen.size, s).toBe(frameCount(id));
    }
    // the counter (param counter) is drawn in front of him
    expect(calls.some(([id]) => id === 'npc/ams/counter')).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });
});
