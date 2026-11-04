/**
 * The FABEL FRIET crew at 40 px (docs/design/ams40.md wave 5): the baked sets ams-staff-0, -1, -2
 * (src/game/content/art40/ams-staff-<look>.gen.ts, drawn by tools/art40/chars/ams-staff/ with the
 * looks in ams-staff-0/, -1/, -2/; registered by src/game/content/missions/ams/staff.art.ts) keep
 * the strip contract of docs/design/ams40/contract.md "Fabel Friet crew 0–2": the ids, the frame
 * counts of the plan's class table, the logic times (the looks' tempo, the transitions and the turn
 * the entity plays), every point name on every frame, the colour budget, 1× pixels at every tier,
 * the walk drawn for PERSON_WALK_SPEED (no foot slide), the looks as part swaps (rule 6); the crew's
 * own update loop draws an existing frame at every tick; the gameplay numbers stay (plan D7).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { Renderer } from '../../src/engine/render';
import { frameCount, getFrames, hasHiSprite, hasSprite, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import { SET as CREW_0 } from '../../src/game/content/art40/ams-staff-0.gen';
import { SET as CREW_1 } from '../../src/game/content/art40/ams-staff-1.gen';
import { SET as CREW_2 } from '../../src/game/content/art40/ams-staff-2.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/items/index';
import '../../src/game/content/props/index';
import type { AmsStaff } from '../../src/game/content/missions/ams/entities';
import { PERSON_TR_TICKS, PERSON_TURN_TICKS, PERSON_WALK_SPEED, STAFF_LOOKS, TRANSITION_MODES } from '../../src/game/content/missions/ams/npc.art';
import { STAFF_SETS } from '../../src/game/content/missions/ams/staff.art';
import { TestWorld } from '../content/helpers';

const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[art]')) return;
  warn(...args);
});

beforeAll(async () => {
  await import('../../src/game/content/missions/ams/index');
});

const SETS: readonly BakedSet[] = [CREW_0, CREW_1, CREW_2];
const prefix = (look: number): string => `npc/ams/ams-staff/${look}`;

interface ContractEntry {
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  totalTicks?: number;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** The looks' tempo (contract: idle 15 / 17 / 19 ticks a frame, clap 3 / 4 / 3) as totals. */
const IDLE_TOTAL = [60, 68, 76];
const CLAP_TOTAL = [12, 16, 12];

/** Frame counts (plan class table: idle-breathing 4, locomotion 12, victory 6-8; the transitions and the turn 2, as the entity plays them). */
const COUNTS: Readonly<Record<string, number>> = {
  idle: 4, walk: 12, clap: 6, cheer: 8, wave: 6, 'in-clap': 2, 'in-cheer': 2, 'in-wave': 2, turn: 2,
};
/** The total ticks of each strip per look (the old logic and loop times; walk: 12 x 3, see walk test). */
const TOTAL = (look: number): Readonly<Record<string, number>> => ({
  idle: IDLE_TOTAL[look], walk: 36, clap: CLAP_TOTAL[look], cheer: 32, wave: 20,
  'in-clap': 2 * PERSON_TR_TICKS, 'in-cheer': 2 * PERSON_TR_TICKS, 'in-wave': 2 * PERSON_TR_TICKS, turn: 2 * PERSON_TURN_TICKS,
});

describe('crew sets: the contract', () => {
  it('registers exactly the contract ids of the three looks (rule 1), no more', () => {
    expect(STAFF_SETS).toEqual(SETS);
    expect(STAFF_LOOKS).toBe(3);
    for (let look = 0; look < 3; look++) {
      const set = SETS[look];
      expect(set.prefix).toBe(prefix(look));
      expect(set.variants ?? {}).toEqual({});
      const want = Object.keys(CONTRACT).filter((id) => id.startsWith(`${prefix(look)}/`)).sort();
      expect(want.length).toBe(9);
      expect([...bakedSetIds(set)].sort()).toEqual(want);
      for (const id of want) expect(hasSprite(id), id).toBe(true);
    }
    expect(spriteErrors().filter((e) => e.id.includes('ams-staff'))).toEqual([]);
  });

  it('frame counts, durations and loop flags: the class table and the logic times', () => {
    for (let look = 0; look < 3; look++) {
      const set = SETS[look];
      const total = TOTAL(look);
      expect(Object.keys(set.strips).sort()).toEqual(Object.keys(COUNTS).sort());
      for (const [name, n] of Object.entries(COUNTS)) {
        const id = `${prefix(look)}/${name}`;
        const st = set.strips[name];
        expect(st.frames.length, id).toBe(n);
        expect(st.durations.length, id).toBe(n);
        expect(frameCount(id), id).toBe(n);
        expect(sum(st.durations), id).toBe(total[name]);
        expect(spriteAnim(id).durations, id).toEqual(st.durations);
        for (const d of st.durations) expect(Number.isInteger(d) && d >= 1, id).toBe(true);
        // loop flags as the contract (the transitions play once, everything else loops)
        expect(st.loop, id).toBe(CONTRACT[id].loop ?? true);
        expect(spriteAnim(id).loop, id).toBe(st.loop);
        expect(st.defer, id).toBeUndefined();
      }
      // the logic times the code relies on (contract totals) stay, except the walk (drawn for the speed)
      for (const name of ['idle', 'clap', 'cheer', 'wave', 'in-clap', 'in-cheer', 'in-wave', 'turn']) {
        expect(total[name], name).toBe(CONTRACT[`${prefix(look)}/${name}`].totalTicks);
      }
      // the transitions and the turn: the entity plays 2 frames of PERSON_TR_TICKS / PERSON_TURN_TICKS
      for (const m of TRANSITION_MODES) {
        const st = set.strips[`in-${m}`];
        if (st) expect(st.durations, m).toEqual([PERSON_TR_TICKS, PERSON_TR_TICKS]);
      }
      expect(set.strips.turn.durations).toEqual([PERSON_TURN_TICKS, PERSON_TURN_TICKS]);
    }
  });

  it('every frame decodes inside the palette and the colour budget (28), with the feet anchor and the contract points', () => {
    for (let look = 0; look < 3; look++) {
      const set = SETS[look];
      expect(set.budget).toBe(28);
      const fx = new Set(set.fx ?? []);
      const used = new Set<number>();
      for (const [name, st] of Object.entries(set.strips)) {
        const id = `${prefix(look)}/${name}`;
        const cpts = CONTRACT[id].framePoints;
        expect(st.frames.filter((f) => f.smear).length, id).toBeLessThanOrEqual(2);
        st.frames.forEach((f, i) => {
          const idx = decodeBakedIndices(f);
          expect(idx.length, `${id}#${i}`).toBe(f.w * f.h);
          let opaque = 0;
          for (const c of idx) {
            expect(c, `${id}#${i}`).toBeLessThan(set.pal.length);
            if (c) {
              opaque++;
              used.add(c);
            }
          }
          expect(opaque, `${id}#${i}`).toBeGreaterThan(100);
          // feet anchor: inside the frame horizontally, on the floor line (no pixel under the feet);
          // the cheer's hop lifts the body off the floor on its airborne frames 2-4 (the anchor stays the floor)
          expect(f.ox >= 0 && f.ox <= f.w, `${id}#${i}`).toBe(true);
          if (name === 'cheer' && i >= 2 && i <= 4) expect(f.oy, `${id}#${i}`).toBeGreaterThan(f.h);
          else expect(f.oy, `${id}#${i}`).toBe(f.h);
          // every point name the old frame had (contract), on every frame
          for (const p of cpts[Math.min(i, cpts.length - 1)]) expect(f.pts?.[p], `${id}#${i} ${p}`).toBeDefined();
        });
      }
      const colours = [...used].filter((c) => !fx.has(c)).map((c) => set.pal[c]);
      expect(new Set(colours).size, `look ${look}`).toBeLessThanOrEqual(28);
      expect(set.pal[set.outline]).toBe('#140c0e');
    }
  });

  it('1x pixels at every art tier: no 2x / 4x generator, no dense alias (rule 7)', () => {
    for (let look = 0; look < 3; look++) {
      for (const name of Object.keys(COUNTS)) {
        const id = `${prefix(look)}/${name}`;
        expect(hasHiSprite(id, 2), id).toBe(false);
        expect(hasHiSprite(id, 4), id).toBe(false);
        const lo = getFrames(id, 1);
        for (const d of [2, 4]) {
          const hi = getFrames(id, d);
          expect(hi.length, id).toBe(lo.length);
          hi.forEach((f, i) => {
            expect(f.density ?? 1, id).toBe(1);
            expect(f.buf, `${id}#${i}@${d}`).toBe(lo[i].buf);
          });
        }
      }
    }
  });

  it('the crew is about 40 px tall standing (plan D7: 37 -> about 42), every look the same body', () => {
    for (let look = 0; look < 3; look++) {
      for (const f of getFrames(`${prefix(look)}/idle`)) {
        expect(f.buf.h).toBeGreaterThanOrEqual(39);
        expect(f.buf.h).toBeLessThanOrEqual(44);
      }
    }
    // looks are part swaps on one animation (rule 6): the same hip on every frame of every strip
    for (const name of Object.keys(COUNTS)) {
      const hips = SETS.map((s) => s.strips[name].frames.map((f) => f.pts?.hip));
      expect(hips[1], name).toEqual(hips[0]);
      expect(hips[2], name).toEqual(hips[0]);
      const hands = SETS.map((s) => s.strips[name].frames.map((f) => f.pts?.hand));
      expect(hands[1], name).toEqual(hands[0]);
      expect(hands[2], name).toEqual(hands[0]);
    }
    // the shared shop uniform: apron black, gold piping, trousers
    for (const c of ['#2c2a33', '#e0a630', '#6c6a78']) for (const s of SETS) expect(s.pal, c).toContain(c);
  });

  it('the walk is drawn for PERSON_WALK_SPEED: the planted foot keeps still on the floor (rule 5)', () => {
    expect(PERSON_WALK_SPEED).toBe(0.8);
    for (let look = 0; look < 3; look++) {
      const st = SETS[look].strips.walk;
      expect(SETS[look].face).toBe(1);
      // the same foot stays planted while the floor moves under it: the planted point moves back (the
      // sprite faces right) by the floor's travel; the drift over one plant (the sum of the errors
      // from heel strike to toe-off) stays within 1 px
      let planted = 0;
      let drift = 0;
      for (let i = 0; i < st.frames.length; i++) {
        const a = st.frames[i].pts?.plant;
        const b = st.frames[(i + 1) % st.frames.length].pts?.plant;
        const travel = st.durations[i] * PERSON_WALK_SPEED;
        if (!a || !b || Math.abs(b[0] - a[0] + travel) > 4) {
          drift = 0; // the other foot took over (heel strike): a new plant
          continue;
        }
        planted++;
        drift += b[0] - a[0] + travel;
        expect(Math.abs(drift), `look ${look} walk #${i}: drift over the plant`).toBeLessThanOrEqual(1);
        expect(b[1], `look ${look} walk #${i}`).toBe(a[1]);
      }
      expect(planted).toBeGreaterThanOrEqual(8);
    }
  });
});

/** A renderer that records the sprites an entity draws (the presentation reads only ids and indices). */
function recorder(): { r: Renderer; calls: Array<[string, number]> } {
  const calls: Array<[string, number]> = [];
  const r = { sprite: (id: string, i: number) => calls.push([id, i]) } as unknown as Renderer;
  return { r, calls };
}

function checkDrawn(calls: Array<[string, number]>): void {
  for (const [id, i] of calls) {
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} ${i}`).toBe(true);
    expect(i >= 0 && i < frameCount(id), `${id} ${i}`).toBe(true);
  }
}

describe('crew: the entity draws an existing frame at every tick', () => {
  it('walks, turns, claps, cheers and waves (every look, both facings) with the gameplay numbers of before', () => {
    for (let look = 0; look < STAFF_LOOKS; look++) {
      const tw = new TestWorld({ playerX: 40, god: true });
      const s = tw.spawn('ams-staff', 120, { look, mode: 'walk', to: 260 }) as AmsStaff;
      // gameplay numbers (entities.ts, unchanged by the art: plan D7)
      expect(s.look).toBe(look);
      expect(s.hitbox).toEqual({ x: -7, y: -36, w: 14, h: 36 });
      expect(s.speed).toBe(0.8);
      expect(s.z).toBe(27);
      expect(s.hasTag('npc')).toBe(true);
      expect(s.hasTag('shootable')).toBe(false);
      const { r, calls } = recorder();
      const step = (n: number): void => {
        for (let k = 0; k < n; k++) {
          tw.run(1);
          s.draw(r);
        }
      };
      const t0 = tw.until(() => {
        s.draw(r);
        return s.arrived;
      }, 400);
      // 140 px at 0.8 px a tick: the walk takes the same time as before
      expect(t0).toBeGreaterThanOrEqual(174);
      expect(t0).toBeLessThanOrEqual(177);
      expect(s.x).toBe(260);
      expect(s.mode).toBe('idle');
      // turn back (draw-only turn), each mode in and out (draw-only transitions)
      s.face(0);
      step(12);
      for (const m of ['clap', 'cheer', 'wave'] as const) {
        s[m](40);
        expect(s.anim.id).toBe(`${prefix(look)}/${m}`);
        step(50);
        expect(s.mode).toBe('idle');
      }
      // the finale: walk in at 1.1 px a tick (strideRate), clap, then cheer
      s.speed = 1.1;
      s.walkTo(100, 'clap');
      step(170);
      expect(s.mode).toBe('clap');
      s.cheer();
      step(80);
      checkDrawn(calls);
      // every strip of the look was drawn
      const seen = new Set(calls.map(([id]) => id));
      for (const name of Object.keys(COUNTS)) expect(seen.has(`${prefix(look)}/${name}`), `${look} ${name}`).toBe(true);
      expect(tw.world.errors).toEqual([]);
    }
  });

  it('a look out of range is clamped to an existing set', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    for (const [p, want] of [[-1, 0], [7, 2], [1.4, 1]] as const) {
      const s = tw.spawn('ams-staff', 100, { look: p }) as AmsStaff;
      expect(s.look).toBe(want);
      const { r, calls } = recorder();
      s.draw(r);
      checkDrawn(calls);
      expect(calls[0][0]).toBe(`${prefix(want)}/idle`);
    }
  });
});
