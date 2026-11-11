/**
 * The hostage binds at 40 px (docs/design/ams40.md wave 3): the baked set `bind`
 * (src/game/content/art40/bind.gen.ts, drawn by tools/art40/chars/bind/ from the tied tourist's
 * props) keeps the strip contract of docs/design/ams40/contract.md "tied tourist ... and the binds":
 * the 8 ids, their frame counts and durations (the release animations keep their old totals), the
 * anchors the code places them by (rope: the top; rope-band: the band's centre; chair-break,
 * cage-break, mast: the floor; balloon: the knot; rope-bit: the centre), 1x pixels at every tier
 * (rule 7), 28 colours. The release animations start where the tourist's strips leave off (rule 10:
 * the chair of the tied strip, the sack of the sack strip, the cage of the caged strip), and the
 * bind code (binds.ts) only ever draws existing frames.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet, type BakedFrame } from '../../src/engine/baked';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as BIND from '../../src/game/content/art40/bind.gen';
import * as TOUR from '../../src/game/content/art40/hostage-tourist.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import { FxEntity } from '../../src/game/fx';
import type { Hostage } from '../../src/game/hostage';
import { TestWorld } from '../content/helpers';

const SET: BakedSet = BIND.SET;

interface ContractEntry {
  character: string;
  frames: number;
  loop?: boolean;
  totalTicks?: number;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT).filter((id) => id.startsWith('item/bind/')).sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean]>> = {
  rope: [8, Array(8).fill(60), true],
  'rope-bit': [4, [4, 4, 4, 4], true],
  'rope-band': [2, [60, 60], true],
  'chair-break': [6, [3, 3, 4, 5, 10, 20], false],
  'sack-off': [5, [3, 3, 4, 5, 36], false],
  'cage-break': [6, [3, 3, 4, 4, 6, 33], false],
  mast: [1, [60], true],
  balloon: [2, [16, 16], true],
};

/** The anchor-relative box of a baked frame's opaque pixels: [left, top, right, bottom) . */
function box(f: BakedFrame): [number, number, number, number] {
  const idx = decodeBakedIndices(f);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if (idx[y * f.w + x]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
  return [x0 - f.ox, y0 - f.oy, x1 - f.ox, y1 - f.oy];
}

describe('bind: the set', () => {
  it('registers exactly the 8 contract ids, no variants', () => {
    expect(CONTRACT_IDS.length).toBe(8);
    expect([...bakedSetIds(SET)].sort()).toEqual(CONTRACT_IDS);
    expect(SET.prefix).toBe('item/bind');
    expect(SET.variants ?? {}).toEqual({});
  });

  it('frame counts, durations and loop flags; every total is the old one (the release animations keep their time)', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [name, [n, d, loop]] of Object.entries(STRIPS)) {
      const st = SET.strips[name];
      const c = CONTRACT[`item/bind/${name}`];
      expect(st.frames.length, name).toBe(n);
      expect(st.durations, name).toEqual(d);
      expect(st.loop, name).toBe(loop);
      expect(st.loop, `${name} loop = contract`).toBe(c.loop);
      expect(sum(st.durations), `${name} total`).toBe(c.totalTicks);
      expect(st.cls, name).toBe('prop');
      expect(frameCount(`item/bind/${name}`), name).toBe(n);
      expect(spriteAnim(`item/bind/${name}`).durations, name).toEqual(d);
      st.frames.forEach((f, i) => expect(f.smear ?? false, `${name}#${i}`).toBe(false));
    }
    // the code's frame picks: a rope segment of n px is frame n - 1 (8 frames), the balloon bobs on
    // stateT / 16 % 2, the mast draws frame 0
    expect(SET.strips.rope.frames.map((f) => f.h)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(SET.strips.balloon.frames.length).toBe(2);
    expect(SET.strips.mast.frames.length).toBe(1);
  });

  it('every frame decodes: palette indices in range, 28 colours, the one outline; the wood, rope and steel are the tourist palette', () => {
    expect(SET.budget).toBe(28);
    expect(SET.pal.length - 1).toBeLessThanOrEqual(28);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    expect(new Set(SET.pal.slice(1)).size).toBe(SET.pal.length - 1);
    for (const c of SET.pal.slice(1)) expect(TOUR.SET.pal, c).toContain(c);
    for (const [name, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const idx = decodeBakedIndices(f);
        expect(idx.length, `${name}#${i}`).toBe(f.w * f.h);
        let solid = 0;
        for (const v of idx) {
          expect(v, `${name}#${i}`).toBeLessThan(SET.pal.length);
          if (v) solid++;
        }
        expect(solid, `${name}#${i}`).toBeGreaterThan(0);
      });
    }
  });

  it('the anchors the code places them by', () => {
    // rope: the top centre of a 4 px wide rope
    for (const f of SET.strips.rope.frames) expect([f.w, f.ox, f.oy]).toEqual([4, 2, 0]);
    // rope-band: the band's centre row (binds.ts draws it at y - 20 and y - 8)
    for (const f of SET.strips['rope-band'].frames) {
      expect(f.oy).toBe(3);
      expect(Math.abs(f.ox - f.w / 2)).toBeLessThanOrEqual(1);
    }
    // the bit tumbles round its centre
    for (const f of SET.strips['rope-bit'].frames) expect(Math.abs(f.ox - (f.w - 1) / 2) + Math.abs(f.oy - (f.h - 1) / 2)).toBeLessThanOrEqual(2);
    // on the floor: nothing below the feet anchor
    for (const name of ['chair-break', 'cage-break', 'mast', 'sack-off', 'balloon']) {
      SET.strips[name].frames.forEach((f, i) => expect(box(f)[3], `${name}#${i}`).toBeLessThanOrEqual(0));
    }
    // the mast pole stands on its anchor (the pole's foot), 40+ px tall
    const m = box(SET.strips.mast.frames[0]);
    expect(m[3]).toBe(0);
    expect(-m[1]).toBeGreaterThanOrEqual(40);
  });

  it('one pixel size: getFrames(id, 2) and getFrames(id, 4) are the 1x frames (no dense art left)', () => {
    for (const id of bakedSetIds(SET)) {
      expect(hasHiSprite(id, 2), id).toBe(false);
      expect(hasHiSprite(id, 4), id).toBe(false);
      const one = getFrames(id, 1);
      for (const d of [2, 4]) getFrames(id, d).forEach((f, i) => expect(f.buf, `${id}@${d}#${i}`).toBe(one[i].buf));
    }
  });
});

describe('bind: the fit with the tourist (plan rule 10)', () => {
  it('chair-break starts as the chair of the tied strip: the same left post, the same floor', () => {
    const tied = TOUR.SET.strips['tourist/tied'].frames[0];
    const chair = box(SET.strips['chair-break'].frames[0]);
    const fig = box(tied);
    expect(chair[0]).toBe(fig[0]); // the backrest post is the tied frame's leftmost column
    expect(chair[3]).toBe(0);
    // the chair is under the sitter: from the post to the front legs, about 12 px + the outline
    expect(chair[2] - chair[0]).toBeGreaterThanOrEqual(12);
    expect(chair[2] - chair[0]).toBeLessThanOrEqual(16);
    // its pieces fly apart and lie on the street at the end
    const last = box(SET.strips['chair-break'].frames[5]);
    expect(last[2] - last[0]).toBeGreaterThan(chair[2] - chair[0]);
    expect(-last[1]).toBeLessThanOrEqual(6);
  });

  it('sack-off starts as wide as the sack strip and sinks to a pile', () => {
    const sack = box(TOUR.SET.strips['tourist/sack'].frames[0]);
    const off = SET.strips['sack-off'].frames.map(box);
    expect(Math.abs(off[0][2] - off[0][0] - (sack[2] - sack[0]))).toBeLessThanOrEqual(3);
    for (let i = 1; i < off.length; i++) expect(-off[i][1], `sack-off#${i}`).toBeLessThanOrEqual(-off[i - 1][1]);
    expect(-off[off.length - 1][1]).toBeLessThanOrEqual(8);
  });

  it('cage-break starts as the cage of the caged strip (20 x 30 + the outline)', () => {
    const caged = box(TOUR.SET.strips['tourist/caged'].frames[0]);
    const cb = box(SET.strips['cage-break'].frames[0]);
    expect(Math.abs(cb[2] - cb[0] - (caged[2] - caged[0]))).toBeLessThanOrEqual(3);
    expect(cb[3]).toBe(0);
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

function run(bind: string, params: Record<string, unknown>, free: (h: Hostage, tw: TestWorld) => void, ticks: number): { calls: Array<[string, number]>; fx: Set<string> } {
  const tw = new TestWorld({ playerX: null });
  const h = tw.spawn('hostage', 300, { kind: 'tourist', bind, ...params }, params.y as number | undefined) as Hostage;
  const { r, calls } = recorder();
  const fx = new Set<string>();
  for (let t = 0; t < ticks; t++) {
    if (t === 30) free(h, tw);
    tw.run(1);
    for (const e of tw.ofType('fx')) {
      if (!(e instanceof FxEntity)) continue;
      fx.add(e.sprite);
      e.draw(r);
    }
    if (!h.removed) h.draw(r);
  }
  for (const [id, i] of calls) {
    if (!id.startsWith('item/bind/')) continue;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
  return { calls, fx };
}

describe('bind: behaviour (the bind code with the real update loop, headless)', () => {
  it('chair: freeing plays item/bind/chair-break at the hostage', () => {
    const { fx } = run('chair', {}, (h) => h.free(0), 120);
    expect(fx.has('item/bind/chair-break')).toBe(true);
  });

  it('sack: freeing plays item/bind/sack-off', () => {
    const { fx } = run('sack', {}, (h) => h.free(0), 120);
    expect(fx.has('item/bind/sack-off')).toBe(true);
  });

  it('cage: the rope (stacked rope segments) holds it; cut, it drops and plays item/bind/cage-break and the rope bit', () => {
    const { calls, fx } = run('cage', { ropeTop: 50, y: 120 }, (h) => h.free(0), 240);
    expect(calls.some(([id]) => id === 'item/bind/rope')).toBe(true);
    expect(fx.has('item/bind/cage-break')).toBe(true);
  });

  it('balloon: the balloon bobs (frames 0 and 1) on its rope; cut, it drifts off with the rope bit', () => {
    const { calls, fx } = run('balloon', { y: 120 }, (h) => h.free(0), 120);
    const balloon = calls.filter(([id]) => id === 'item/bind/balloon').map(([, i]) => i);
    expect(new Set(balloon)).toEqual(new Set([0, 1]));
    expect(fx.has('item/bind/balloon')).toBe(true);
  });
});
