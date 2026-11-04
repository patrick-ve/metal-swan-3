/**
 * The select screen's portraits at 40 px (docs/design/select40.md, the portrait contract): one baked
 * set per friend (tools/art40/chars/select-<id>/ on the portrait kit tools/art40/chars/_portrait/),
 * prefix `char/<id>` shared with the hero set, 64 colours, 1× only, three strips: `select-grey`
 * (the unlit state: 1 frame or a 2-frame breath, cold grey), `select` (the lit loop: 6-12 frames,
 * 2-4 s, long holds, a few pixels of motion) and `select-pick` (the confirm reaction: 8-14 frames,
 * 24-40 ticks, played once). Every frame is a full 64 × 120 window with a top-left anchor. The
 * three states are one rig: the same face, the same light, the same framing.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { bakedPalette, bakedSetIds, decodeBakedFrame, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import { getFrames, hasHiSprite, hasSprite, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import * as BOB from '../../src/game/content/art40/select-bob.gen';
import * as DIRK from '../../src/game/content/art40/select-dirk.gen';
import * as PATRICK from '../../src/game/content/art40/select-patrick.gen';
import * as THOM from '../../src/game/content/art40/select-thom.gen';
import * as VINCENT from '../../src/game/content/art40/select-vincent.gen';
import { SELECT_SETS, SELECT_STRIPS, SQUAD, type SquadId } from '../../src/game/content/characters/select.art';

const GEN: Readonly<Record<SquadId, { SET: BakedSet; SELECT_PICK_TICKS: number }>> = { vincent: VINCENT, thom: THOM, dirk: DIRK, bob: BOB, patrick: PATRICK };
const W = 64;
const H = 120;

beforeAll(async () => {
  // The hero sets share the prefix char/<id>: both registrations must live side by side.
  await import('../../src/game/content/characters/art');
});

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const luma = (hex: string): number => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
/** Palette indices of a strip frame. */
const indices = (set: BakedSet, strip: string, i: number): Uint8Array => decodeBakedIndices(set.strips[strip].frames[i]);
/** Share of pixels that differ between two index frames. */
const diff = (a: Uint8Array, b: Uint8Array): number => {
  let n = 0;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) n++;
  return n / a.length;
};

describe.each(SQUAD.map((id) => [id] as const))('select set %s', (id) => {
  const set = GEN[id].SET;
  const P = `char/${id}/`;

  it('is the registered set: slug select-<id>, prefix char/<id>, 64 colours, exactly the three strips', () => {
    expect(SELECT_SETS[id]).toBe(set);
    expect(set.slug).toBe(`select-${id}`);
    expect(set.prefix).toBe(`char/${id}`);
    expect(set.budget).toBe(64);
    expect(Object.keys(set.strips).sort()).toEqual([...SELECT_STRIPS].sort());
    expect(set.variants ?? {}).toEqual({});
    expect(bakedSetIds(set).sort()).toEqual(SELECT_STRIPS.map((s) => P + s).sort());
    // Distinct colours without transparent: within the budget.
    expect(new Set(set.pal.slice(1).map((c) => c.toLowerCase())).size).toBeLessThanOrEqual(64);
    expect(set.pal.length).toBeLessThanOrEqual(65);
  });

  it('registers char/<id>/select, select-grey and select-pick beside the hero strips and the menu portrait', () => {
    for (const s of SELECT_STRIPS) expect(hasSprite(P + s), P + s).toBe(true);
    expect(hasSprite(P + 'portrait')).toBe(true);
    const select = listSprites(P).filter((x) => /\/select(-|$)/.test(x));
    expect(select.sort()).toEqual(SELECT_STRIPS.map((s) => P + s).sort());
    expect(spriteErrors().filter((e) => e.id.startsWith(P + 'select')), id).toEqual([]);
  });

  it('every frame is a full 64 × 120 window anchored top-left and decodes within the palette', () => {
    const pal = bakedPalette(set.pal);
    for (const [name, st] of Object.entries(set.strips)) {
      expect(st.frames.length, name).toBe(st.durations.length);
      st.frames.forEach((f, i) => {
        expect([f.w, f.h, f.ox, f.oy], `${name}#${i}`).toEqual([W, H, 0, 0]);
        const idx = decodeBakedIndices(f);
        expect(idx.length, `${name}#${i}`).toBe(W * H);
        let max = 0;
        let clear = 0;
        for (const k of idx) {
          if (k > max) max = k;
          if (k === 0) clear++;
        }
        expect(max, `${name}#${i} index`).toBeLessThan(set.pal.length);
        // The window is opaque: the booth's backdrop fills it, the print edge is the outline.
        expect(clear, `${name}#${i} transparent pixels`).toBe(0);
        const fr = decodeBakedFrame(f, pal);
        expect([fr.buf.w, fr.buf.h]).toEqual([W, H]);
        for (const x of [0, W - 1]) for (const y of [0, 60, H - 1]) expect(idx[y * W + x], `${name}#${i} edge ${x},${y}`).toBe(set.outline);
      });
    }
  });

  it('keeps the contract timing: grey 1-2 frames (loop), select 6-12 frames in 2-4 s (loop), pick 8-14 frames in 24-40 ticks (once)', () => {
    const g = set.strips['select-grey'];
    expect(g.frames.length).toBeGreaterThanOrEqual(1);
    expect(g.frames.length).toBeLessThanOrEqual(2);
    expect(g.loop).toBe(true);
    const s = set.strips.select;
    expect(s.frames.length).toBeGreaterThanOrEqual(6);
    expect(s.frames.length).toBeLessThanOrEqual(12);
    expect(sum(s.durations)).toBeGreaterThanOrEqual(120);
    expect(sum(s.durations)).toBeLessThanOrEqual(240);
    expect(s.loop).toBe(true);
    // Long holds: the key pose (frame 0) is held longest-but-one at least, never a flicker loop.
    expect(s.durations[0]).toBeGreaterThanOrEqual(24);
    expect(Math.max(...s.durations)).toBeGreaterThanOrEqual(24);
    const p = set.strips['select-pick'];
    expect(p.frames.length).toBeGreaterThanOrEqual(8);
    expect(p.frames.length).toBeLessThanOrEqual(14);
    expect(sum(p.durations)).toBeGreaterThanOrEqual(24);
    expect(sum(p.durations)).toBeLessThanOrEqual(40);
    expect(p.loop).toBe(false);
    // It ends on a held pose: the last frame is held at least as long as any other.
    expect(p.durations[p.durations.length - 1]).toBe(Math.max(...p.durations));
    expect(GEN[id].SELECT_PICK_TICKS).toBe(sum(p.durations));
    expect(set.events?.SELECT_PICK_TICKS).toBe(sum(p.durations));
  });

  it('the registry plays the strips with the baked timing and gives 1× frames at every density', () => {
    for (const name of SELECT_STRIPS) {
      const id1 = P + name;
      const st = set.strips[name];
      const a = spriteAnim(id1);
      expect(a.durations ? [...a.durations] : null, id1).toEqual(st.durations);
      expect(a.loop, id1).toBe(st.loop);
      expect(hasHiSprite(id1, 2), id1).toBe(false);
      expect(hasHiSprite(id1, 4), id1).toBe(false);
      const f1 = getFrames(id1, 1);
      expect(f1.length).toBe(st.frames.length);
      for (const d of [2, 4]) {
        const fd = getFrames(id1, d);
        expect(fd.length, `${id1}@${d}`).toBe(f1.length);
        fd.forEach((f, i) => {
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id1}@${d}#${i}`).toEqual([W, H, 0, 0]);
          expect(f.density ?? 1, `${id1}@${d}#${i}`).toBe(1);
          expect(f.buf.data, `${id1}@${d}#${i}`).toEqual(f1[i].buf.data);
        });
      }
    }
  });

  it('the grey state is the same picture, unlit: cold grey only, darker, the same outline and framing', () => {
    const grey = set.strips['select-grey'];
    const colour = indices(set, 'select', 0);
    for (let i = 0; i < grey.frames.length; i++) {
      const g = indices(set, 'select-grey', i);
      let lg = 0;
      let lc = 0;
      let both = 0;
      let outline = 0;
      for (let k = 0; k < g.length; k++) {
        const hex = set.pal[g[k]];
        const [r, gg, b] = rgb(hex);
        if (g[k] !== set.outline) {
          // Cold monochrome: no saturated colour, blue at least red (the warm outline is the one exception).
          expect(Math.max(r, gg, b) - Math.min(r, gg, b), `grey#${i} ${hex}`).toBeLessThanOrEqual(40);
          expect(b, `grey#${i} ${hex} is cold`).toBeGreaterThanOrEqual(r);
        }
        lg += luma(hex);
        lc += luma(set.pal[colour[k]]);
        if (colour[k] === set.outline) {
          outline++;
          if (g[k] === set.outline) both++;
        }
      }
      expect(lg / g.length, `grey#${i} is darker`).toBeLessThan((lc / colour.length) * 0.85);
      // The same face: (nearly) every outline pixel of the lit key pose is an outline pixel unlit.
      expect(both / outline, `grey#${i} outline overlap`).toBeGreaterThan(0.85);
      // Low-key, but not black: the drawing stays (at least 6 grey tones).
      expect(new Set(g).size).toBeGreaterThanOrEqual(6);
    }
  });

  it('the lit loop moves a few pixels only; the pick is a real reaction and differs from the loop', () => {
    const s = set.strips.select;
    const key = indices(set, 'select', 0);
    for (let i = 1; i < s.frames.length; i++) {
      const d = diff(key, indices(set, 'select', i));
      expect(d, `select#${i} vs key`).toBeGreaterThan(0);
      // A breath (1 px), a blink, a sweat drop, a dart: never a different picture (a 1-px breath
      // of a stubbled, textured face changes about a third of the window's pixels).
      expect(d, `select#${i} vs key`).toBeLessThan(0.36);
    }
    const p = set.strips['select-pick'];
    const last = indices(set, 'select-pick', p.frames.length - 1);
    // The reaction changes the face (eyes, mouth, sweat, the gag) but keeps the framing.
    expect(diff(key, last), 'pick end vs key').toBeGreaterThan(0.02);
    expect(diff(key, last), 'pick end vs key').toBeLessThan(0.6);
    // No two consecutive pick frames are the same picture (every frame earns its ticks).
    for (let i = 1; i < p.frames.length; i++) expect(diff(indices(set, 'select-pick', i - 1), indices(set, 'select-pick', i)), `pick#${i}`).toBeGreaterThan(0);
  });
});

describe('the five select portraits', () => {
  it('show five different faces (lit key poses differ in most pixels outside the backdrop)', () => {
    const keys = SQUAD.map((id) => indices(GEN[id].SET, 'select', 0));
    const cols = SQUAD.map((id) => GEN[id].SET.pal);
    for (let i = 0; i < SQUAD.length; i++) {
      for (let j = i + 1; j < SQUAD.length; j++) {
        let n = 0;
        for (let k = 0; k < keys[i].length; k++) if (cols[i][keys[i][k]] !== cols[j][keys[j][k]]) n++;
        expect(n / keys[i].length, `${SQUAD[i]} vs ${SQUAD[j]}`).toBeGreaterThan(0.3);
      }
    }
  });

  it('share the photo booth: one outline and one cold grey ramp for the unlit state of all five', () => {
    const outline = GEN.vincent.SET.pal[GEN.vincent.SET.outline].toLowerCase();
    const ramp = new Set<string>();
    for (const id of SQUAD) {
      const set = GEN[id].SET;
      expect(set.pal[set.outline].toLowerCase(), id).toBe(outline);
      for (const f of set.strips['select-grey'].frames) for (const k of decodeBakedIndices(f)) if (k !== set.outline) ramp.add(set.pal[k].toLowerCase());
    }
    // A ramp of 6-9 steps from near-black, shared (five private ramps would hold far more).
    expect(ramp.size).toBeGreaterThanOrEqual(6);
    expect(ramp.size).toBeLessThanOrEqual(9);
  });
});

const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url));
const hasPy = spawnSync('python3', ['-c', 'import sys; sys.exit(0)']).status === 0;

// Every select set (VINCENT's included: he has no test file of his own) bakes to the checked-in
// file byte for byte, under two hash seeds (the kit's bake is deterministic).
describe.skipIf(!hasPy)('the select bakes (python3)', () => {
  it.each(SQUAD.map((id) => [id] as const))('select-%s: --check matches the checked-in file under PYTHONHASHSEED 0 and 7', (id) => {
    for (const seed of ['0', '7']) {
      const r = spawnSync('python3', ['tools/art40/bake.py', `select-${id}`, '--check'], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        env: { ...process.env, PYTHONHASHSEED: seed, PYTHONDONTWRITEBYTECODE: '1' },
      });
      expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
      expect(r.stdout).toMatch(new RegExp(`ok select-${id}`));
    }
  }, 300_000);
});
