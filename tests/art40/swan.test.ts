/**
 * The Swan at 40 px, stage 1 (docs/design/ams40.md wave 7, "The Swan"): the baked set `swan`
 * (src/game/content/art40/swan.gen.ts, drawn by tools/art40/chars/swan/) keeps the strip contract
 * of docs/design/ams40/contract.md: the ids (P1 vehicle/swan, P2 vehicle/swan-mute: the same
 * pixels with the black swan's palette), the frame counts and timing the game reads, every point
 * name on every frame, the -front overlays, 1× pixels at every tier; the code picks an existing
 * frame at every tick of every state; the gameplay numbers stay (plan D7).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { bakedPalette, decodeBakedFrame, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import { buttonMask, VirtualPad, type Button } from '../../src/engine/input';
import { PixelBuffer } from '../../src/engine/pixel';
import { frameCount, framePoint, getFrame, getFrames, hasHiSprite, hasSprite, spriteAnim, type Frame } from '../../src/engine/sprites';
import { Terrain, terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import * as GEN from '../../src/game/content/art40/swan.gen';
import '../../src/game/content/characters/index';
import { CROUCH_STRIPS, HULL_DY, HURT, PERCH_TOP, REST, SEAT_ZONE, SWAN } from '../../src/game/content/vehicles/swan/constants';
import '../../src/game/content/vehicles/swan/index';
import type { Swan } from '../../src/game/content/vehicles/swan/index';
import { frameAt, loopAt, stripDurations } from '../../src/game/content/vehicles/swan/swan';
import '../../src/game/content/weapons/index';
import { attachGame, HudState } from '../../src/game/context';
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

const SET: BakedSet = GEN.SET;
const P1 = 'vehicle/swan';
const P2 = 'vehicle/swan-mute';
/** Strips only P1 has (the Swan falls back to vehicle/swan/<name>). */
const P1_ONLY = new Set(['egg', 'scuffs']);

interface ContractEntry {
  frames: number;
  framePoints: string[][];
  readPoints?: string[];
  loop?: boolean;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;

/**
 * Frame counts, durations, loop and the plan's class (docs/design/ams40.md, the class table):
 * the logic time of every timed strip is the contract's (swan.ts reads the strip's own durations).
 */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean]>> = {
  idle: [4, [12, 12, 12, 12], true],
  run: [12, Array(12).fill(3), true],
  move: [12, Array(12).fill(3), true],
  squat: [2, [2, 2], false],
  jump: [3, [4, 6, 54], false],
  fall: [2, [6, 6], true],
  land: [3, [2, 1, 1], false],
  stomp: [2, [2, 2], false],
  skid: [3, [3, 30, 30], false],
  crouch: [4, [12, 12, 12, 12], true],
  waddle: [7, Array(7).fill(4), true],
  slide: [4, [3, 3, 3, 3], true],
  honk: [10, Array(10).fill(2), false],
  wreck: [4, [6, 6, 6, 6], true],
  hiss: [3, [2, 2, 2], false],
  bash: [3, [2, 2, 2], false],
  tumble: [4, [2, 2, 2, 2], false],
  dazed: [8, Array(8).fill(8), true],
  right: [6, [1, 1, 3, 3, 3, 1], false],
  shake: [6, [2, 1, 1, 1, 1, 2], false],
  empty: [4, [15, 15, 15, 15], true],
  'empty-look': [5, [30, 30, 30, 30, 30], true],
  'empty-lay': [8, [20, 10, 10, 6, 6, 8, 20, 30], false],
  egg: [4, [6, 10, 10, 20], false],
  scuffs: [2, [6, 6], false],
};
/** The ridden strips: a rider and a -front overlay with the body's frame count (swan.ts FRONT). */
const RIDDEN = ['idle', 'run', 'move', 'squat', 'jump', 'fall', 'land', 'stomp', 'skid', 'crouch', 'waddle', 'slide', 'honk', 'wreck'];
/** The pictures with the neck, the head and the gun inside (swan.ts SELF_CONTAINED). */
const CONTAINED = ['wreck', 'hiss', 'bash', 'tumble', 'dazed', 'right', 'shake', 'empty', 'empty-look', 'empty-lay'];
/** Smear frames, only where the motion is faster than 3 px a tick (plan: at most 2 a strip). */
const SMEARS: Readonly<Record<string, readonly number[]>> = { hiss: [1], bash: [0], tumble: [0, 1], right: [0, 1] };

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const pt = (f: Frame, n: string): readonly [number, number] => {
  const p = f.pts?.[n];
  expect(p, n).toBeDefined();
  return p as readonly [number, number];
};
/** The lowest opaque row relative to the anchor (0 = standing on the line). */
const bottom = (f: Frame): number => {
  const b = f.buf.trimBounds();
  return b ? b.y + b.h - f.oy : 0;
};
const starts = (d: readonly number[]): number[] => d.map((_, i) => sum(d.slice(0, i)));

beforeAll(async () => {
  await import('../../src/game/content/vehicles/swan/art');
});

describe('the Swan set at 40 px (stage 1)', () => {
  it('registers exactly its contract ids in P1 and P2 (P2 without the P1-only props); every id is a contract id', () => {
    const names = Object.keys(SET.strips).sort();
    expect(names).toEqual([...Object.keys(STRIPS), ...RIDDEN.map((n) => `${n}-front`)].sort());
    for (const n of names) {
      expect(CONTRACT[`${P1}/${n}`], `${P1}/${n} is a contract id`).toBeDefined();
      expect(hasSprite(`${P1}/${n}`), `${P1}/${n}`).toBe(true);
      if (P1_ONLY.has(n)) {
        expect(CONTRACT[`${P2}/${n}`], `${P2}/${n} not in the contract`).toBeUndefined();
        expect(hasSprite(`${P2}/${n}`), `${P2}/${n} not registered`).toBe(false);
      } else {
        expect(CONTRACT[`${P2}/${n}`], `${P2}/${n} is a contract id`).toBeDefined();
        expect(hasSprite(`${P2}/${n}`), `${P2}/${n}`).toBe(true);
      }
    }
    expect(Object.keys(SET.variants ?? {})).toEqual([P2]);
    expect(SET.prefix).toBe(P1);
    expect(SET.budget).toBe(40);
  });

  it('frame counts, durations and loop flags of the class table; the game draws these durations', () => {
    for (const [n, [frames, durations, loop]] of Object.entries(STRIPS)) {
      const st = SET.strips[n];
      expect(st.frames.length, n).toBe(frames);
      expect([...st.durations], n).toEqual(durations);
      expect(st.loop, n).toBe(loop);
      for (const pre of P1_ONLY.has(n) ? [P1] : [P1, P2]) {
        expect(frameCount(`${pre}/${n}`), `${pre}/${n}`).toBe(frames);
        expect(spriteAnim(`${pre}/${n}`).durations, `${pre}/${n}`).toEqual(durations);
        expect(spriteAnim(`${pre}/${n}`).loop, `${pre}/${n}`).toBe(loop);
      }
    }
    for (const n of RIDDEN) {
      const front = SET.strips[`${n}-front`];
      expect(front.frames.length, `${n}-front`).toBe(SET.strips[n].frames.length);
      expect([...front.durations], `${n}-front`).toEqual([...SET.strips[n].durations]);
      expect(front.loop, `${n}-front`).toBe(SET.strips[n].loop);
    }
  });

  it('every frame decodes: w*h indices inside the palette; at most 40 colours (both palettes, FX outside)', () => {
    const fx = new Set(SET.fx ?? []);
    for (const pal of [SET.pal, ...Object.values(SET.variants ?? {})]) {
      expect(pal.length).toBe(SET.pal.length);
      const used = new Set<string>();
      for (const [n, st] of Object.entries(SET.strips)) {
        for (const f of st.frames) {
          const idx = decodeBakedIndices(f);
          expect(idx.length, n).toBe(f.w * f.h);
          for (const i of idx) {
            expect(i, n).toBeLessThan(pal.length);
            if (i && !fx.has(i)) used.add(pal[i]);
          }
        }
      }
      expect(used.size).toBeLessThanOrEqual(40);
      expect(used.size).toBeGreaterThan(20);
    }
  });

  it('P2 is the black swan: the same pixels, black plumage, a red bill and a red cloth; the steel stays', () => {
    const p2 = (SET.variants ?? {})[P2];
    const lum = (h: string): number => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    let darker = 0;
    let same = 0;
    for (let i = 1; i < SET.pal.length; i++) {
      if (lum(p2[i]) < lum(SET.pal[i]) - 60) darker++;
      if (p2[i] === SET.pal[i]) same++;
    }
    expect(darker).toBeGreaterThanOrEqual(5);
    expect(same).toBeGreaterThanOrEqual(12);
    // The plumage: the idle body is mostly dark in P2, mostly light in P1.
    const share = (id: string): number => {
      let light = 0;
      let n = 0;
      for (const c of getFrames(id)[0].buf.data) {
        if ((c & 255) === 0) continue;
        n++;
        if (((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255) > 560) light++;
      }
      return light / n;
    };
    expect(share(`${P1}/idle`)).toBeGreaterThan(0.4);
    expect(share(`${P2}/idle`)).toBeLessThan(0.1);
    // A red bill: the bill colours are red in P2 (more red than green and blue).
    const reds = p2.filter((h, i) => h !== SET.pal[i] && parseInt(h.slice(1, 3), 16) > parseInt(h.slice(3, 5), 16) + 80);
    expect(reds.length).toBeGreaterThanOrEqual(5);
    for (const [n, st] of Object.entries(SET.strips)) {
      if (P1_ONLY.has(n)) continue;
      const a = getFrames(`${P1}/${n}`);
      const b = getFrames(`${P2}/${n}`);
      a.forEach((f, i) => {
        expect([b[i].buf.w, b[i].buf.h, b[i].ox, b[i].oy], `${n} ${i}`).toEqual([f.buf.w, f.buf.h, f.ox, f.oy]);
        expect(b[i].pts, `${n} ${i}`).toEqual(f.pts);
      });
      expect(st.frames.length).toBe(a.length);
    }
  });

  it('every contract point name on every frame that had it (the seat, the neck socket, hull, smoke, head ...)', () => {
    for (const n of Object.keys(SET.strips)) {
      const c = CONTRACT[`${P1}/${n}`];
      const names = new Set(c.framePoints.flat());
      // The egg lands from frame LAY_EGG_FRAME on (the old strip had it on f5-f7 of the same 8).
      const perFrame = n === 'empty-lay';
      getFrames(`${P1}/${n}`).forEach((f, i) => {
        for (const p of names) {
          if (perFrame && p === 'egg' && i < GEN.LAY_EGG_FRAME) continue;
          expect(f.pts?.[p], `${n} #${i} ${p}`).toBeDefined();
        }
      });
    }
  });

  it('keeps the rest points: the seat (-3, -48), the socket (16, -43), the hull and the deck; the low seats', () => {
    const idle = getFrames(`${P1}/idle`)[0];
    expect(pt(idle, 'seat')).toEqual(REST.seat);
    expect(pt(idle, 'neck')).toEqual(REST.neck);
    expect(pt(idle, 'hull')).toEqual(REST.hull);
    expect(pt(idle, 'smoke')).toEqual(REST.smoke);
    expect(pt(idle, 'perch')[1]).toBe(PERCH_TOP.stand);
    for (const n of ['crouch', 'waddle', 'slide']) {
      for (const f of getFrames(`${P1}/${n}`)) {
        // The rider lies flat 4 px deeper (CROUCH_STRIPS); the socket where crouch-neck hangs.
        expect(CROUCH_STRIPS.has(n)).toBe(true);
        expect(Math.abs(pt(f, 'seat')[1] - -16), n).toBeLessThanOrEqual(2);
        expect(Math.abs(pt(f, 'neck')[1] - -17), n).toBeLessThanOrEqual(2);
      }
    }
    for (const n of ['empty', 'empty-look', 'empty-lay']) {
      getFrames(`${P1}/${n}`).forEach((f, i) => {
        expect(Math.abs(pt(f, 'seat')[1] - -20), `${n} ${i}`).toBeLessThanOrEqual(n === 'empty-lay' ? 4 : 2);
        const b = pt(f, 'bubble');
        expect(b[1], `${n} ${i} bubble 9 px above the seat`).toBe(pt(f, 'seat')[1] - 9);
      });
    }
    const lay = getFrames(`${P1}/empty-lay`);
    for (let i = GEN.LAY_EGG_FRAME; i < lay.length; i++) expect(pt(lay[i], 'egg')).toEqual([-30, 0]);
  });

  it('HULL_DY (the perch deck) has one entry per baked frame: the drawn deck (perch - (-48))', () => {
    for (const n of RIDDEN.concat(['empty', 'empty-look', 'empty-lay'])) {
      const fs = getFrames(`${P1}/${n}`);
      expect(HULL_DY[n], n).toBeDefined();
      expect(HULL_DY[n].length, n).toBe(fs.length);
      fs.forEach((f, i) => expect(HULL_DY[n][i], `${n} ${i}`).toBe(pt(f, 'perch')[1] - PERCH_TOP.stand));
    }
  });

  it('stands on the feet anchor: the webs (or the belly) on the line, never below it on the ground', () => {
    const ground = ['idle', 'run', 'move', 'squat', 'land', 'skid', 'crouch', 'waddle', 'slide', 'honk', 'wreck', 'hiss', 'bash', 'dazed', 'shake', 'empty', 'empty-look', 'empty-lay', 'egg'];
    for (const n of ground) {
      getFrames(`${P1}/${n}`).forEach((f, i) => {
        expect(bottom(f), `${n} ${i}`).toBeLessThanOrEqual(0);
        // The standing and sitting pictures touch the line (the strain of the egg lifts her 3 px).
        if (!['bash', 'empty-lay', 'waddle', 'slide'].includes(n)) expect(bottom(f), `${n} ${i}`).toBe(0);
      });
    }
  });

  it('smears only where the motion is too fast for the in-betweens, at most 2 a strip', () => {
    for (const [n, st] of Object.entries(SET.strips)) {
      const sm = st.frames.map((f, i) => (f.smear ? i : -1)).filter((i) => i >= 0);
      expect(sm, n).toEqual([...(SMEARS[n] ?? SMEARS[n.replace(/-front$/, '')] ?? [])]);
      expect(sm.length).toBeLessThanOrEqual(2);
    }
  });

  it('1× pixels at every tier: getFrames(id, 2) and (id, 4) are the 1× frames; no 2× / 4× generator', () => {
    for (const n of Object.keys(SET.strips)) {
      for (const pre of P1_ONLY.has(n) ? [P1] : [P1, P2]) {
        const id = `${pre}/${n}`;
        const one = getFrames(id, 1);
        expect(getFrames(id, 2), id).toBe(one);
        expect(getFrames(id, 4), id).toBe(one);
        expect(hasHiSprite(id, 2) || hasHiSprite(id, 4), id).toBe(false);
        const want = SET.strips[n].frames.map((f) => decodeBakedFrame(f, bakedPalette(pre === P1 ? SET.pal : (SET.variants ?? {})[P2])));
        one.forEach((f, i) => expect(f.buf.data, `${id} ${i}`).toEqual(want[i].buf.data));
      }
    }
  });

  it('-front overlays: the body pixels near the rider, the leg window open, the scuffs decal visible', () => {
    for (const n of RIDDEN) {
      const body = getFrames(`${P1}/${n}`);
      const front = getFrames(`${P1}/${n}-front`);
      front.forEach((f, i) => {
        expect(f.pts?.seat, `${n} ${i}`).toEqual(body[i].pts?.seat);
        // The overlay draws the body's own pixels (layer f over b): at most a few differ (orphans).
        const b = body[i];
        let opaque = 0;
        let same = 0;
        for (let y = 0; y < f.buf.h; y++) {
          for (let x = 0; x < f.buf.w; x++) {
            const c = f.buf.data[y * f.buf.w + x];
            if ((c & 255) === 0) continue;
            opaque++;
            const bx = x - f.ox + b.ox;
            const by = y - f.oy + b.oy;
            if (bx >= 0 && by >= 0 && bx < b.buf.w && by < b.buf.h && b.buf.data[by * b.buf.w + bx] === c) same++;
          }
        }
        expect(opaque, `${n} ${i} front is drawn`).toBeGreaterThan(20);
        expect(same / opaque, `${n} ${i}`).toBeGreaterThan(0.95);
        // Nothing below the rider's hip line + 4: his near leg shows over her flank and the drum
        // (wreck: the drooping neck is in the overlay too).
        const seat = pt(f, 'seat');
        const bb = f.buf.trimBounds()!;
        if (!CONTAINED.includes(n)) expect(bb.y + bb.h - f.oy - 1, `${n} ${i}`).toBeLessThanOrEqual(seat[1] + 4);
      });
    }
    // The scuffs land on her visible flank in the low-tilt strips (swan.ts LOW_TILT).
    const [s0, s1] = getFrames(`${P1}/scuffs`);
    for (const n of ['idle', 'run', 'fall', 'crouch', 'slide', 'squat']) {
      const body = getFrames(`${P1}/${n}`)[0];
      const front = getFrames(`${P1}/${n}-front`)[0];
      const draw = (s?: Frame): PixelBuffer => {
        const b = new PixelBuffer(140, 110);
        b.blitFrame(body, 70, 100);
        if (s) b.blitFrame(s, 70 + pt(body, 'hull')[0], 100 + pt(body, 'hull')[1]);
        b.blitFrame(front, 70, 100);
        return b;
      };
      const clean = draw();
      for (const [s, min] of [[s0, 8], [s1, 18]] as const) {
        const d = draw(s);
        let n2 = 0;
        for (let i = 0; i < d.data.length; i++) if (d.data[i] !== clean.data[i] && (clean.data[i] & 255) !== 0) n2++;
        expect(n2, `${n} scuffs on her flank`).toBeGreaterThanOrEqual(min);
      }
    }
  });
});

describe('the Swan code reads the set (plan rule 4)', () => {
  it('the events exist, lie inside their strips and keep the logic ticks', () => {
    const run = SET.strips.run;
    expect(GEN.RUN_CONTACT_A).toBe(0);
    expect(GEN.RUN_CONTACT_B).toBe(run.frames.length / 2);
    expect(GEN.RUN_PX).toBe(6);
    expect(GEN.WADDLE_PX).toBe(3);
    expect(GEN.SKID_CHATTER).toBeGreaterThanOrEqual(1);
    expect(SET.events).toEqual({
      RUN_PX: GEN.RUN_PX, RUN_CONTACT_A: GEN.RUN_CONTACT_A, RUN_CONTACT_B: GEN.RUN_CONTACT_B, WADDLE_PX: GEN.WADDLE_PX,
      HONK_BLAST: GEN.HONK_BLAST, LAY_EGG_FRAME: GEN.LAY_EGG_FRAME, SKID_CHATTER: GEN.SKID_CHATTER,
    });
    // The honk: 20 ticks; the ring leaves at the wind-up's end = the start of the HONK frame.
    const honk = SET.strips.honk.durations;
    expect(sum(honk)).toBe(SWAN.honk.stripTicks);
    expect(GEN.HONK_BLAST).toBeLessThan(honk.length);
    expect(starts(honk)[GEN.HONK_BLAST]).toBe(SWAN.honk.windup);
    // The egg: the strip is SWAN.layDurations, the egg lands at layEggAt = the start of LAY_EGG_FRAME.
    const lay = SET.strips['empty-lay'].durations;
    expect([...lay]).toEqual([...SWAN.layDurations]);
    expect(starts(lay)[GEN.LAY_EGG_FRAME]).toBe(SWAN.layEggAt);
    // Logic times of the timed strips.
    expect(sum(SET.strips.squat.durations)).toBe(SWAN.squatTicks);
    expect(sum(SET.strips.land.durations)).toBe(SWAN.landTicks);
    expect(sum(SET.strips.hiss.durations)).toBe(SWAN.dive.hissTicks);
    expect(sum(SET.strips.bash.durations)).toBe(SWAN.dive.bashTicks);
    expect(sum(SET.strips.tumble.durations)).toBe(SWAN.dive.tumbleTicks);
    expect(sum(SET.strips.right.durations)).toBe(SWAN.dive.rightingTicks);
    expect(sum(SET.strips.shake.durations)).toBe(SWAN.dive.shakeTicks);
    expect(sum(SET.strips.stomp.durations)).toBe(4);
    // The skid's brake frame is the old 3 ticks.
    expect(SET.strips.skid.durations[0]).toBe(3);
  });

  it('the run and the waddle do not slide: the planted web moves back RUN_PX / WADDLE_PX a frame', () => {
    for (const [n, px] of [['run', GEN.RUN_PX], ['waddle', GEN.WADDLE_PX]] as const) {
      const fs = getFrames(`${P1}/${n}`);
      let plants = 0;
      for (let i = 0; i < fs.length; i++) {
        const a = pt(fs[i], 'plant');
        const b = pt(fs[(i + 1) % fs.length], 'plant');
        // the same web (it moved back) or the next one strikes ahead
        if (b[0] < a[0]) {
          expect(Math.abs(a[0] - b[0] - px), `${n} ${i}`).toBeLessThanOrEqual(1);
          plants++;
        } else expect(b[0] - a[0], `${n} ${i}: a new web ahead`).toBeGreaterThanOrEqual(2);
        expect(a[1], `${n} ${i} on the line`).toBe(-1);
      }
      expect(plants).toBeGreaterThanOrEqual(fs.length - 2);
    }
  });

  it('frameAt / loopAt / stripDurations give an existing frame at every tick of every strip', () => {
    for (const n of Object.keys(SET.strips)) {
      const id = `${P1}/${n}`;
      const d = stripDurations(id);
      expect([...d], id).toEqual([...SET.strips[n].durations]);
      const len = frameCount(id);
      for (let t = -3; t < sum(d) * 2 + 5; t++) {
        const a = loopAt(d, t);
        const b = frameAt(d, Math.max(0, t));
        for (const f of [a, b]) {
          expect(Number.isInteger(f), `${id} @${t}`).toBe(true);
          expect(f, `${id} @${t}`).toBeGreaterThanOrEqual(0);
          expect(f, `${id} @${t}`).toBeLessThan(len);
        }
      }
      // Without the art (logic tests, the headless sims) the same timing comes from the set.
      expect([...stripDurations(`vehicle/swan-unloaded/${n}`)]).toEqual([...SET.strips[n].durations]);
    }
    // loopAt cycles over the durations: the idle breath changes frame every 12 ticks.
    expect([0, 11, 12, 24, 36, 47, 48].map((t) => loopAt(SET.strips.idle.durations, t))).toEqual([0, 0, 1, 2, 3, 3, 0]);
    expect([0, 3, 9, 10, 13, 14, 19, 25].map((t) => frameAt(SET.strips.honk.durations, t))).toEqual([0, 1, 4, 5, 6, 7, 9, 9]);
  });

  it('the gameplay numbers stay (plan D7): hurtboxes, seat zones, the perch deck, speeds, timings', () => {
    expect(HURT).toEqual({
      stand: [[-8, -28, 16, 28], [-22, -48, 40, 20], [-10, -66, 12, 18]],
      crouch: [[-22, -20, 40, 20]],
      swim: [[-22, -30, 40, 16], [-10, -48, 12, 18]],
      duck: [[-22, -24, 40, 12], [-10, -37, 12, 15]],
    });
    expect(SEAT_ZONE).toEqual({ parked: [-10, -32, 20, 16], water: [-10, -44, 20, 16], stand: [-10, -60, 20, 16] });
    expect(PERCH_TOP).toEqual({ stand: -48, crouch: -20, swim: -30, duck: -22 });
    expect([SWAN.runMax, SWAN.trotSpeed, SWAN.crouchSpeed, SWAN.bodyW, SWAN.bodyH, SWAN.crouchBodyH]).toEqual([2.6, 1.5, 0.8, 28, 48, 20]);
    expect([SWAN.jumpVelocity, SWAN.gravity, SWAN.squatTicks, SWAN.landTicks, SWAN.riseTicks]).toEqual([-5.9, 0.18, 4, 4, 12]);
    expect([SWAN.honk.windup, SWAN.honk.stripTicks, SWAN.layEggAt, SWAN.eggAfter, SWAN.cells]).toEqual([10, 20, 52, 600, 3]);
    expect([SWAN.dive.hissTicks, SWAN.dive.bashTicks, SWAN.dive.tumbleTicks, SWAN.dive.rightingTicks, SWAN.dive.shakeTicks, SWAN.dive.dazedTicks]).toEqual([6, 6, 8, 12, 8, 180]);
    expect([SWAN.gun.damage, SWAN.gun.cooldown, SWAN.gun.speed, SWAN.shell.direct, SWAN.stompDamage]).toEqual([10, 4, 8, 200, 100]);
  });
});

// ------------------------------------------------------------------------------------ behaviour

const FLOOR = 176;

class Rig {
  readonly world: World;
  readonly pad = new VirtualPad();
  mask = 0;
  readonly p: Player;
  readonly swan: Swan;
  readonly seen = new Map<string, Set<number>>();

  constructor(mute = false) {
    const t = terrain(6000, 216);
    t.ground().at(0, FLOOR).flat(6000);
    this.world = new World({ terrain: new Terrain(t.build()), seed: 7, factory: gameEntityFactory });
    attachGame(this.world, new GameSession({ characters: ['recruit', 'recruit'], seed: 7 }), new HudState());
    this.p = new Player(this.world, 140, FLOOR, { pad: this.pad, index: 0 });
    this.world.add(this.p);
    this.p.placeAt(140, FLOOR, 0);
    this.swan = this.world.spawn('swan', 200, FLOOR, mute ? { variant: 'mute' } : {}) as Swan;
    this.world.flush();
    this.world.camera.follow(this.world.players);
    this.run(1);
  }

  /** One tick; checks what the presentation reads (the shown body frame and its overlay). */
  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pad.update(this.mask);
      this.world.update();
      this.check();
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

  check(): void {
    const s = this.swan as unknown as { anim: { id: string; index: number }; bodyName: string; bodyFrame: number; state: string; facing: number };
    const id = s.anim.id;
    if (!id) return;
    expect(hasSprite(id), `${id} registered`).toBe(true);
    const n = frameCount(id);
    expect(Number.isInteger(s.anim.index), `${id} index`).toBe(true);
    expect(s.anim.index, id).toBeGreaterThanOrEqual(0);
    expect(s.anim.index, id).toBeLessThan(n);
    // The held animator never steps by itself (a baked strip's durations would win over its
    // ticksPerFrame): the frame drawn is the frame the Swan picked this tick.
    expect(s.anim.index, `${id}: drawn frame = picked frame`).toBe(s.bodyFrame);
    const f = getFrame(id, s.anim.index);
    for (const p of ['seat', 'neck', 'hull', 'smoke']) expect(framePoint(f, p, s.facing < 0, false, [0, 0]), `${id} #${s.anim.index} ${p}`).toBeDefined();
    if (hasSprite(`${id}-front`)) expect(frameCount(`${id}-front`), `${id}-front`).toBe(n);
    const name = s.bodyName;
    let set = this.seen.get(name);
    if (!set) this.seen.set(name, (set = new Set()));
    set.add(s.anim.index);
  }
}

describe('the Swan plays every stage 1 strip headless (spawn, ride, the moves, the dive, parked)', () => {
  for (const mute of [false, true]) {
    it(`${mute ? 'P2 black swan' : 'P1'}: every pick is an existing frame; the strips and their frames are reached`, () => {
      const r = new Rig(mute);
      const s = r.swan;
      r.run(30);                                       // parked
      s.mount(r.p);
      r.run(SWAN.riseTicks + 30);                      // rise, idle
      r.hold('right').run(80);                         // run at full speed
      expect(s.vx).toBeCloseTo(SWAN.runMax, 6);
      r.hold('left').run(14);                          // the skid and the turn
      r.hold().run(30);
      r.hold('down').run(60);                          // crouch
      r.hold('down', 'right').run(60);                 // waddle
      r.hold('right').run(60).hold('down', 'right').run(6).hold('down').run(10); // the belly slide
      r.hold().run(20);
      r.tap('jump').run(120);                          // squat, jump, fall, land
      r.run(250);
      r.tap('fire', 'bomb').run(30);                   // HONK
      r.run(30);
      r.hold().tap('fire').tap('jump').run(6);         // SWAN DIVE: hiss, dive, bash ...
      r.run(400);                                      // ... tumble, dazed, right, shake, sit-down, parked
      r.run(SWAN.eggAfter + 160);                      // the nervous egg
      const want: Record<string, number> = {
        idle: 4, run: 12, skid: 2, crouch: 4, waddle: 7, slide: 4, squat: 2, jump: 3, fall: 1, land: 3, honk: 10,
        hiss: 3, bash: 3, tumble: 4, dazed: 8, right: 6, shake: 6, empty: 4, 'empty-lay': 8,
      };
      for (const [n, k] of Object.entries(want)) {
        const got = r.seen.get(n);
        expect(got, `${n} shown`).toBeDefined();
        expect(got!.size, `${n} frames shown: ${[...(got ?? [])].join(',')}`).toBeGreaterThanOrEqual(k);
      }
      expect(r.world.entities.some((e) => e.type === 'swan-egg') || r.seen.get('empty-lay')!.has(GEN.LAY_EGG_FRAME)).toBe(true);
    });
  }
});
