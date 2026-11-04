/**
 * The hot-dog vendor at 40 px (docs/design/ams40.md wave 5): the baked set `ams-hotdog-vendor`
 * (src/game/content/art40/ams-hotdog-vendor.gen.ts, drawn by tools/art40/chars/ams-hotdog-vendor/)
 * keeps the strip contract of docs/design/ams40/contract.md "hot-dog vendor": the 7 ids, the frame
 * counts of the plan's class table, the logic times (idle 60, in-talk 6, in-wave 6, salute 70 (one pass of the 70-tick mode; the old strip looped 40),
 * talk 32, turn 4, wave 20), the anchor and the points hand / head / hip on every frame, 1× pixels
 * at every art tier (rule 7), 28 colours (D1); the fit in the stand's hatch (rule 10: STAND_DY);
 * the vendor's own update loop (AmsPerson / AmsHotdogVendor in entities.ts) picks an existing frame
 * at every tick of every mode; the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/ams-hotdog-vendor.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/vehicles/swan/index';
import '../../src/game/content/missions/ams/entities';
import type { AmsHotdogVendor } from '../../src/game/content/missions/ams/entities';
import { PERSON_TR_TICKS, PERSON_TURN_TICKS, TRANSITION_MODES } from '../../src/game/content/missions/ams/npc.art';
import { getEntityMeta } from '../../src/game/registry';
import { B_VENDOR } from '../../src/game/content/missions/ams/section-b';
import { G } from '../../src/game/content/missions/ams/terrain';
import { FLOOR, TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PREFIX = 'npc/ams/ams-hotdog-vendor';

interface ContractEntry {
  character: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  totalTicks?: number;
  anchorKind?: string;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT).filter((id) => CONTRACT[id].character === 'hotdog-vendor').sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Frame counts (the plan's class table), durations and loop flags (the contract's logic time). */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, cls: string]>> = {
  idle: [4, [16, 14, 16, 14], true, 'idle'],
  'in-talk': [2, [3, 3], false, 'turn'],
  'in-wave': [2, [3, 3], false, 'turn'],
  salute: [8, [4, 3, 4, 6, 12, 12, 17, 12], true, 'victory'],
  talk: [8, [4, 4, 4, 4, 4, 4, 4, 4], true, 'idle-fidget'],
  turn: [2, [2, 2], true, 'turn'],
  wave: [6, [4, 3, 3, 4, 3, 3], true, 'victory'],
};

/** The section b stand (src/game/content/missions/ams/art.ts hotdogStand; G = the ground line):
 * the hatch's inner top row and the first row the stand's front piece covers, relative to G. */
const HATCH_TOP = -45;          // box top 12 + hatch 5 in a 62-row picture whose bottom is G
const COUNTER = -28;            // hotdog-front keeps rows 34+ of the 62
const OLD_FEET = -8;            // B_VENDOR.y = G - 8 (the old 38-px figure)
/** The strips with a hand raised over the cap. */
const RAISED = ['salute', 'wave', 'in-wave'];

describe('ams-hotdog-vendor: the set', () => {
  it('registers exactly the contract ids (docs/design/ams40/contract.json), no variants', () => {
    expect(CONTRACT_IDS.length).toBe(7);
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

  it('every frame decodes: w*h pixels, palette indices in range, 28 colours, the one outline', () => {
    expect(SET.budget).toBe(28);
    // index 0 is transparent: the other entries are the colours (D1: at most 28)
    expect(SET.pal.length - 1).toBeLessThanOrEqual(28);
    expect(new Set(SET.pal.slice(1)).size).toBe(SET.pal.length - 1);
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
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(200);
      });
    }
  });

  it('the feet anchor and every contract point on every frame; no smear frames', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const c = CONTRACT[`${PREFIX}/${name}`];
      expect(c.anchorKind).toBe('feet');
      st.frames.forEach((f, i) => {
        // feet: the line under the soles; the anchor column inside the frame
        expect(f.oy, `${name}#${i}`).toBe(f.h);
        expect(f.ox, `${name}#${i}`).toBeGreaterThanOrEqual(0);
        expect(f.ox, `${name}#${i}`).toBeLessThan(f.w);
        const want = c.framePoints[Math.min(i, c.framePoints.length - 1)];
        for (const p of want) {
          const pt = f.pts?.[p];
          expect(pt, `${name}#${i} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${name}#${i} ${p}`).toBe(true);
          // inside the figure's box (relative to the anchor)
          expect(pt![1], `${name}#${i} ${p}`).toBeLessThanOrEqual(0);
          expect(pt![1], `${name}#${i} ${p}`).toBeGreaterThanOrEqual(-f.h);
        }
        expect(f.smear, `${name}#${i}`).toBeUndefined();
      });
    }
  });

  it('a 40 px figure (D7): 41-44 px standing, the wave and the salute reach the cap', () => {
    for (const name of ['idle', 'talk', 'salute', 'wave', 'turn']) {
      for (const f of SET.strips[name].frames) {
        expect(f.h, name).toBeGreaterThanOrEqual(41);
        expect(f.h, name).toBeLessThanOrEqual(45);
      }
    }
    // the raised hand is above the head point (the cap) in the wave, at it in the salute
    for (const f of SET.strips.wave.frames) expect(f.pts!.hand[1]).toBeLessThanOrEqual(f.pts!.head[1] + 2);
    // the waving hand stays in front of the nose line (verifier fix): the cuff never lies on the face
    SET.strips.wave.frames.forEach((f, i) =>
      expect(f.pts!.hand[0] - f.pts!.head[0], `wave#${i} hand in front of the face`).toBeGreaterThanOrEqual(10));
    // the salute: the hand comes up (0, 1), salutes at the cap (2..6) and comes down again (7)
    const sal = SET.strips.salute.frames;
    sal.slice(2, 7).forEach((f, i) => expect(Math.abs(f.pts!.hand[1] - f.pts!.head[1]), `salute#${i + 2}`).toBeLessThanOrEqual(4));
    for (const k of [0, 7]) expect(sal[k].pts!.hand[1], `salute#${k} below the cap`).toBeGreaterThan(sal[3].pts!.hand[1] + 4);
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
          expect(f.buf.w, `${id}@${d}#${i}`).toBe(one[i].buf.w);
          expect(f.buf.h, `${id}@${d}#${i}`).toBe(one[i].buf.h);
          expect(Array.from(f.buf.data), `${id}@${d}#${i}`).toEqual(Array.from(one[i].buf.data));
        });
      }
    }
  });

  it('the look: the tricolour cap (red crown, white band, blue peak) over the face on the idle frame', () => {
    const f = SET.strips.idle.frames[0];
    const idx = decodeBakedIndices(f);
    const rowHas = (y: number, hex: string): boolean => {
      const k = SET.pal.indexOf(hex);
      for (let x = 0; x < f.w; x++) if (idx[y * f.w + x] === k) return true;
      return false;
    };
    const firstRow = (hex: string): number => {
      for (let y = 0; y < f.h; y++) if (rowHas(y, hex)) return y;
      return -1;
    };
    const red = firstRow('#ee5450');
    const white = firstRow('#fbf8f0');
    const blue = firstRow('#4058a0');
    const sky = firstRow('#a8d8f4');
    expect(red).toBeGreaterThanOrEqual(0);
    expect(red).toBeLessThan(white);
    expect(white).toBeLessThan(blue);
    expect(blue).toBeLessThan(sky); // the shirt below the cap
  });
});

describe('ams-hotdog-vendor: the code', () => {
  it('STAND_DY: with his feet at G - 8 + STAND_DY the cap stays in the hatch and the counter hides him from the chest down', () => {
    expect(GEN.STAND_DY).toBe(5);
    // the section's hook places him so (rule 10: the fit is fixed in the hook, not by scaling)
    expect(B_VENDOR.y).toBe(G + OLD_FEET + GEN.STAND_DY);
    expect(SET.events?.STAND_DY).toBe(GEN.STAND_DY);
    const feet = OLD_FEET + GEN.STAND_DY;
    for (const [name, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const top = feet - f.oy; // the top row relative to G
        // the head in the hatch (one row of the steel frame may show the crown over it): the cap
        // top is the frame top where no hand is raised over it (idle, talk, turn, in-talk)
        const capTop = RAISED.includes(name) ? feet + f.pts!.head[1] - 6 : top;
        // (the salute's snap lifts him one row more for its 4 ticks)
        expect(capTop, `${name}#${i} cap top`).toBeGreaterThanOrEqual(HATCH_TOP - (RAISED.includes(name) ? 2 : 1));
        // the head and the shoulders show over the counter (at least 15 rows)
        expect(COUNTER - top, `${name}#${i} visible rows`).toBeGreaterThanOrEqual(15);
      });
    }
  });

  it('the transitions and the turn keep 2 frames at PERSON_TR_TICKS / PERSON_TURN_TICKS (entities.ts indexes them so)', () => {
    expect(PERSON_TR_TICKS).toBe(3);
    expect(PERSON_TURN_TICKS).toBe(2);
    for (const m of TRANSITION_MODES) {
      const id = `${PREFIX}/in-${m}`;
      if (!hasSprite(id)) continue;
      expect(SET.strips[`in-${m}`].durations).toEqual([PERSON_TR_TICKS, PERSON_TR_TICKS]);
    }
    expect(hasSprite(`${PREFIX}/in-talk`)).toBe(true);
    expect(hasSprite(`${PREFIX}/in-wave`)).toBe(true);
    expect(SET.strips.turn.durations).toEqual([PERSON_TURN_TICKS, PERSON_TURN_TICKS]);
  });
});

/** Every sprite the vendor draws, through a recording renderer. */
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

describe('ams-hotdog-vendor: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): npc, neutral, no shootable, hitbox 14 x 36, z 27, range 40', () => {
    expect(getEntityMeta('ams-hotdog-vendor')?.category).toBe('npc');
    const tw = new TestWorld({ playerX: null });
    const v = tw.spawn('ams-hotdog-vendor', 200) as AmsHotdogVendor;
    expect(v.hitbox).toEqual({ x: -7, y: -36, w: 14, h: 36 });
    expect(v.z).toBe(27);
    expect(v.range).toBe(40);
    expect(v.hasTag('enemy')).toBe(false);
    expect(v.hasTag('shootable')).toBe(false);
    expect(v.facing).toBe(-1);
    expect(v.speaker).toBe('vendor');
  });

  it('every mode, every tick: the presentation draws an existing frame (salute 70 ticks, transitions, turns)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const v = tw.spawn('ams-hotdog-vendor', 220, {}, FLOOR) as AmsHotdogVendor;
    const { r, calls } = recorder();
    const step = (n: number): void => {
      for (let k = 0; k < n; k++) {
        tw.run(1);
        v.draw(r);
      }
    };
    step(10);
    expect(v.mode).toBe('idle');
    // the player walks up: the salute (70 ticks) with HALLO DAAR!, then idle
    tw.hold('right');
    let t = 0;
    while (v.mode !== 'salute' && t++ < 200) step(1);
    expect(v.mode).toBe('salute');
    expect(v.anim.id).toBe(`${PREFIX}/salute`);
    expect(tw.hud.bubbles.some((b) => b.target === v && b.text === 'HALLO DAAR!')).toBe(true);
    tw.hold();
    let salute = 0;
    while (v.mode === 'salute' && salute < 200) {
      step(1);
      salute++;
    }
    expect(salute).toBe(70);
    expect(v.mode).toBe('idle');
    // talk and wave: into the mode through in-<mode>, out of it backward
    for (const m of ['talk', 'wave'] as const) {
      if (m === 'talk') v.talk(40);
      else v.wave(40);
      expect(v.trT).toBe(2 * PERSON_TR_TICKS);
      step(45);
      expect(v.mode).toBe('idle');
    }
    // a long loop of every mode (each strip wraps several times)
    v.setMode('salute', 130);
    step(135);
    v.talk(130);
    step(135);
    v.wave(130);
    step(135);
    // turning around (draw-only turn strip), several times
    for (const x of [400, 0, 400]) {
      v.face(x);
      step(12);
    }
    expectValid(calls);
    const drawn = new Set(calls.map(([id]) => id).filter((id) => id.startsWith(PREFIX)));
    for (const s of ['idle', 'salute', 'talk', 'wave', 'turn', 'in-talk', 'in-wave']) expect(drawn.has(`${PREFIX}/${s}`), s).toBe(true);
    // every frame of every strip was shown
    for (const s of ['idle', 'salute', 'talk', 'wave', 'turn', 'in-talk', 'in-wave']) {
      const id = `${PREFIX}/${s}`;
      const seen = new Set(calls.filter(([c]) => c === id).map(([, i]) => i));
      expect(seen.size, s).toBe(frameCount(id));
    }
    expect(tw.world.errors).toEqual([]);
  });

  it('the salute is one 70-tick pass: every frame once, in order, ending on the lowered hand, then idle', () => {
    const tw = new TestWorld({ playerX: null });
    const v = tw.spawn('ams-hotdog-vendor', 200) as AmsHotdogVendor;
    v.setMode('salute', 70);
    const seen: number[] = [];
    for (let k = 0; k < 70; k++) {
      if (seen[seen.length - 1] !== v.anim.index) seen.push(v.anim.index);
      tw.run(1);
    }
    // 70 ticks = the strip: no restart inside the mode (the old 40-tick loop snapped again at 40)
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(v.mode).toBe('idle');
  });
});
