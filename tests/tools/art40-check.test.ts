/**
 * art40-check (tools/art40/check): every gate catches its fault on small hand-made sets, and a
 * clean set passes. Plan docs/design/ams40.md "Gates", "Tools".
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ACTION_CLASSES, actionClass } from '../../tools/art40/check/classes';
import { contractFromJson, parseSpeedRule, type ContractEntry } from '../../tools/art40/check/contract';
import { bestPlantDrifts, checkSet, plantDrifts, setPassed } from '../../tools/art40/check/core';
import { decodeIndices, encodeIndices } from '../../tools/art40/check/decode';
import { checkAll, checkLoaded, loadSet } from '../../tools/art40/check/load';
import { FX_RAMP, rulesJson, RULES_PATH } from '../../tools/art40/check/rules';
import { coverage } from '../../tools/art40/check/coverage';
import { bakedPalette, decodeBakedFrame, decodeBakedIndices, defineBakedSet, type BakedFrame, type BakedSet } from '../../src/engine/baked';
import { defineDenseAlias, defineSprite } from '../../src/engine/sprites';
import { PixelBuffer } from '../../src/engine/pixel';
import type { CheckFrame, CheckSet, CheckStrip, Gate, SetReport } from '../../tools/art40/check/types';

// Palette: 0 transparent, 1 warm near-black outline, 2 fill, 3 shade, 4 eye (hl), 5 spare.
const PAL = ['#000000', '#2a1810', '#c08050', '#804020', '#ffffff', '#40a040'];
const W = 8;
const H = 10;

interface FrameOpts {
  /** Block position step (0..11): makes frames differ. */
  step: number;
  ring?: boolean;
  pts?: Record<string, [number, number]>;
  /** Extra pixels [x, y, index] set last. */
  put?: Array<[number, number, number]>;
  w?: number;
  smear?: true;
}

function frame(o: FrameOpts): CheckFrame {
  const w = o.w ?? W;
  const idx = new Array<number>(w * H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) idx[y * w + x] = o.ring !== false && (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 1 : 2;
  const bx = 1 + (o.step % 3);
  const by = 1 + Math.floor(o.step / 3);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) idx[(by + dy) * w + bx + dx] = 3;
  idx[8 * w + 6] = 4;
  for (const [x, y, v] of o.put ?? []) idx[y * w + x] = v;
  return { w, h: H, ox: W >> 1, oy: H, px: encodeIndices(idx), ...(o.pts ? { pts: o.pts } : {}), ...(o.smear ? { smear: true as const } : {}) };
}

function strip(n: number, cls: string, extra: Partial<CheckStrip> = {}, f: (i: number) => Partial<FrameOpts> = () => ({})): CheckStrip {
  return {
    frames: Array.from({ length: n }, (_, i) => frame({ step: i, pts: { hand: [i % 2, -5] }, ...f(i) })),
    durations: Array.from({ length: n }, () => 4),
    loop: true,
    cls,
    ...extra,
  };
}

/** 12-frame walk: the planted foot moves back 2 px per 4 ticks (0.5 px/tick), the other foot plants at +5. */
function walk(speedScale = 1): CheckStrip {
  return strip(12, 'locomotion', {}, (i) => ({ pts: { hand: [i % 2, -5], plant: [5 - 2 * speedScale * (i % 6), 0] } }));
}

function goodSet(): CheckSet {
  return {
    v: 2,
    slug: 'probe',
    prefix: 'test/probe',
    budget: 28,
    face: 1,
    pal: PAL,
    outline: 1,
    hl: [4],
    variants: { 'test/probe-b': ['#000000', '#2a1810', '#5080c0', '#204080', '#ffffff', '#40a040'] },
    strips: {
      idle: strip(4, 'idle-breathing'),
      walk: walk(),
      throw: { ...strip(6, 'throw'), loop: false, durations: [3, 3, 2, 2, 4, 6] },
    },
    events: { THROW_RELEASE: 4 },
  };
}

const CONTRACT = contractFromJson({
  ids: {
    'test/probe/idle': { frames: 4, durations: [8, 8, 8, 8], loop: true, framePoints: [['hand'], ['hand'], ['hand'], ['hand']] },
    'test/probe/walk': { frames: 8, durations: [6, 6, 6, 6, 6, 6, 6, 6], loop: true, speed: 0.5, framePoints: Array.from({ length: 8 }, () => ['hand']) },
    'test/probe/throw': { frames: 3, durations: [6, 6, 8], loop: false, logicTicks: 20, events: [{ name: 'THROW_RELEASE', tick: 10, kind: 'frame' }] },
    'test/probe-b/idle': {},
    'test/probe-b/walk': {},
    'test/probe-b/throw': {},
  },
});

function fails(r: SetReport, gate: Gate): string[] {
  return r.findings.filter((f) => f.gate === gate && f.level === 'fail').map((f) => `${f.strip ?? ''}#${f.frame ?? ''} ${f.msg}`);
}

type Draft = CheckSet & { strips: Record<string, CheckStrip> };

function edit(fn: (s: Draft) => void): CheckSet {
  const s = structuredClone(goodSet()) as Draft;
  fn(s);
  return s;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

describe('art40-check: the pixel stream', () => {
  it('round-trips and rejects broken streams', () => {
    const idx = [0, 0, 0, 1, 1, 2, ...new Array<number>(300).fill(3)];
    expect([...decodeIndices(encodeIndices(idx), idx.length, 1)]).toEqual(idx);
    expect(() => decodeIndices(encodeIndices([1, 1]), 3, 1)).toThrow(/covers 2 of 3/);
    expect(() => decodeIndices(encodeIndices([1, 1, 1, 1]), 3, 1)).toThrow(/overruns/);
    expect(() => decodeIndices('#\\', 1, 1)).toThrow(/outside the alphabet at 1/);
    expect(() => decodeIndices('#', 1, 1)).toThrow(/odd stream length/);
    expect(() => encodeIndices([91])).toThrow(/outside 0..90/);
  });
});

describe('art40-check: a clean set passes', () => {
  it('passes every gate with the contract', () => {
    const r = checkSet(goodSet(), { contract: CONTRACT });
    expect(r.findings.filter((f) => f.level === 'fail')).toEqual([]);
    expect(setPassed(r)).toBe(true);
    expect(r.outlineShare).toBe(1);
    expect(r.worstDrift?.drift).toBe(0);
    expect(r.gates.contract).not.toBe('skip');
  });
  it('skips the contract gate without a contract', () => {
    const r = checkSet(goodSet());
    expect(r.gates.contract).toBe('skip');
    expect(r.gates.foot).toBe('warn'); // no speed known
  });
});

describe('art40-check: each fault is caught', () => {
  it('format: bad stream, index outside the palette, durations, events, smears, variants', () => {
    expect(fails(checkSet(edit((s) => ((s.strips.idle.frames[0] as Mutable<CheckFrame>).px = encodeIndices([1, 2])))), 'format')[0]).toMatch(/pixel stream/);
    expect(fails(checkSet(edit((s) => ((s.strips.idle.frames[0] as Mutable<CheckFrame>).px = encodeIndices(new Array<number>(W * H).fill(9))))), 'format')[0]).toMatch(/outside the palette/);
    expect(fails(checkSet(edit((s) => ((s.strips.idle as Mutable<CheckStrip>).durations = [4, 4]))), 'format')[0]).toMatch(/2 durations for 4 frames/);
    expect(fails(checkSet(edit((s) => (s.events = { release: 3 }))), 'format')[0]).toMatch(/UPPER_CASE/);
    expect(fails(checkSet(edit((s) => (s.variants = { 'test/probe-b': ['#000000'] }))), 'format')[0]).toMatch(/1 entries, the palette 6/);
    const smeared = edit((s) => {
      for (let i = 0; i < 3; i++) (s.strips.walk.frames[i] as Mutable<CheckFrame>).smear = true;
    });
    expect(fails(checkSet(smeared), 'format')[0]).toMatch(/3 smear frames/);
  });

  it('colour: over budget, 64 outside the mayor, unknown budget', () => {
    const big = edit((s) => (s.pal = [...PAL, ...Array.from({ length: 24 }, (_, i) => `#10${(16 + i).toString(16)}10`)]));
    expect(fails(checkSet(big), 'colour')[0]).toMatch(/29 palette colours > budget 28/);
    // The FX ramp is outside the budget; duplicates count once.
    expect(checkSet(edit((s) => ((s.pal = [...big.pal.slice(0, 29), FX_RAMP[3]]), (s.variants = {}), (s.fx = [29])))).gates.colour).not.toBe('fail');
    // fx colours come from the one shared ramp
    expect(fails(checkSet(edit((s) => ((s.pal = [...big.pal]), (s.fx = [29])))), 'colour')[0]).toMatch(/fx index 29 is #10.*not a colour of the shared FX ramp/);
    expect(checkSet(edit((s) => (s.pal = [...big.pal.slice(0, 29), '#2a1810']))).gates.colour).not.toBe('fail');
    expect(fails(checkSet(edit((s) => (s.fx = [1]))), 'format')[0]).toMatch(/fx index 1/);
    expect(fails(checkSet(edit((s) => (s.budget = 64))), 'colour')[0]).toMatch(/only for ams-mayor/);
    // 40 only for the machines and multi-part sprites (plan D1)
    expect(fails(checkSet(edit((s) => (s.budget = 40))), 'colour')[0]).toMatch(/budget 40 is only for beer-bike/);
    expect(checkSet(edit((s) => ((s.slug = 'beer-bike'), (s.prefix = 'vehicle/beer-bike'), (s.budget = 40)))).gates.colour).not.toBe('fail');
    expect(fails(checkSet(edit((s) => (s.budget = 32))), 'colour')[0]).toMatch(/not one of/);
    expect(checkSet(edit((s) => ((s.slug = 'ams-mayor'), (s.prefix = 'boss/ams-mayor'), (s.budget = 64)))).gates.colour).not.toBe('fail');
  });

  it('outline: not a near-black, too few edge pixels', () => {
    expect(fails(checkSet(edit((s) => (s.pal = ['#000000', '#f0f0f0', ...PAL.slice(2)]))), 'outline')[0]).toMatch(/not a near-black/);
    const cool = checkSet(edit((s) => (s.pal = ['#000000', '#101830', ...PAL.slice(2)])));
    expect(fails(cool, 'outline')[0]).toMatch(/cool/);
    const noRing = edit((s) => {
      s.strips = { idle: strip(4, 'idle-breathing', {}, () => ({ ring: false })) };
    });
    const r = checkSet(noRing);
    expect(r.outlineShare).toBe(0);
    expect(fails(r, 'outline')[0]).toMatch(/outline on 0.0 %/);
  });

  it('orphan: a lone pixel on the edge fails; inside the figure it is material detail (every budget); hl and fx do not count', () => {
    const lone = edit((s) => ((s.strips.idle.frames as CheckFrame[])[1] = frame({ step: 1, put: [[0, 5, 5]], pts: { hand: [1, -5] } })));
    expect(fails(checkSet(lone), 'orphan')[0]).toMatch(/1 orphan pixel\(s\) at 0,5/);
    const inner = checkSet(edit((s) => ((s.strips.idle.frames as CheckFrame[])[1] = frame({ step: 1, put: [[6, 6, 5]], pts: { hand: [1, -5] } }))));
    expect(inner.gates.orphan).toBe('pass');
    expect(inner.findings.some((f) => f.gate === 'orphan' && f.level === 'info' && /1 single pixel\(s\) inside the figure/.test(f.msg))).toBe(true);
    expect(checkSet(edit((s) => ((s.strips.idle.frames as CheckFrame[])[1] = frame({ step: 1, put: [[0, 5, 4]], pts: { hand: [1, -5] } })))).gates.orphan).toBe('pass');
    const fxSet = edit((s) => {
      s.pal = [...PAL.slice(0, 5), FX_RAMP[0]];
      s.variants = {};
      s.fx = [5];
      (s.strips.idle.frames as CheckFrame[])[1] = frame({ step: 1, put: [[0, 5, 5]], pts: { hand: [1, -5] } });
    });
    expect(checkSet(fxSet).gates.orphan).toBe('pass');
  });

  it('aa: a pixel hanging outside the outline fails', () => {
    const halo = edit((s) => ((s.strips.idle.frames as CheckFrame[])[2] = frame({ step: 2, w: W + 1, put: [[W, 4, 2]], pts: { hand: [0, -5] } })));
    expect(fails(checkSet(halo), 'aa')[0]).toMatch(/1 pixel\(s\) outside the outline .* at 8,4/);
  });

  it('class: too few frames without a reason, unknown and missing classes', () => {
    const short = edit((s) => (s.strips.walk = strip(8, 'locomotion')));
    expect(fails(checkSet(short), 'class')[0]).toMatch(/8 frames < locomotion 12 and no logged reason/);
    const why = edit((s) => (s.strips.walk = strip(8, 'locomotion', { why: 'the code holds a pose' })));
    expect(checkSet(why).gates.class).toBe('pass');
    expect(fails(checkSet(edit((s) => (s.strips.idle = strip(4, 'breakdance')))), 'class')[0]).toMatch(/unknown action class/);
    expect(fails(checkSet(edit((s) => ((s.strips.idle as Mutable<CheckStrip>).cls = undefined))), 'class')[0]).toMatch(/no action class/);
    expect(actionClass('Idle breathing')?.name).toBe('idle-breathing');
    expect(actionClass('die')?.min).toBe(10);
  });

  it('smooth: identical consecutive frames, fast points, smear frames exempt', () => {
    const dup = edit((s) => ((s.strips.idle.frames as CheckFrame[])[2] = s.strips.idle.frames[1]));
    expect(fails(checkSet(dup), 'smooth')[0]).toMatch(/frames 1 and 2 are identical/);
    const fast = edit((s) => ((s.strips.idle.frames as CheckFrame[])[1] = frame({ step: 1, pts: { hand: [14, -5] } })));
    const fr = checkSet(fast);
    expect(fails(fr, 'smooth')[0]).toMatch(/"hand" travels 3.50 px\/tick/);
    const smear = edit((s) => {
      (s.strips.idle.frames as CheckFrame[])[1] = frame({ step: 1, pts: { hand: [14, -5] }, smear: true });
      (s.strips.idle.frames as CheckFrame[])[0] = frame({ step: 0, pts: { hand: [0, -5] }, smear: true });
    });
    expect(checkSet(smear).gates.smooth).toBe('pass');
    // A wrapped loop step counts too (frame 3 -> 0).
    const wrap = edit((s) => ((s.strips.idle.frames as CheckFrame[])[3] = frame({ step: 3, pts: { hand: [-13, -5] } })));
    expect(fails(checkSet(wrap), 'smooth').some((m) => /from frame 3/.test(m))).toBe(true);
  });

  it('smooth: the joint track (bake sidecar) is measured when present, every joint', () => {
    const calm = (i: number): Record<string, [number, number]> => ({ hand: [i % 2, -5], 'legN.knee': [2, -6] });
    const joints = { idle: [calm(0), calm(1), { ...calm(2), 'legN.knee': [2, -20] as [number, number] }, calm(3)] };
    const r = checkSet(edit((s) => (s.joints = joints)));
    expect(fails(r, 'smooth')).toEqual(expect.arrayContaining([expect.stringMatching(/joint "legN.knee" travels 3.50 px\/tick .* from frame 1/)]));
    expect(fails(checkSet(edit((s) => (s.joints = { idle: [calm(0)] }))), 'smooth')[0]).toMatch(/joint track has 1 frames, the strip 4/);
    // No joints and no points: the outline box only, as a warning.
    const bare = checkSet(edit((s) => (s.strips.idle = strip(4, 'idle-breathing', {}, () => ({ pts: undefined })))));
    expect(bare.findings.some((f) => f.gate === 'smooth' && f.level === 'warn' && /outline box only/.test(f.msg))).toBe(true);
  });

  it('foot: drift against the contract speed, a missing plant point', () => {
    const slide = edit((s) => (s.strips.walk = walk(0.5)));
    const r = checkSet(slide, { contract: CONTRACT });
    expect(fails(r, 'foot')[0]).toMatch(/"plant" drifts 5.00 px/);
    const noPlant = edit((s) => (s.strips.walk = strip(12, 'locomotion')));
    expect(fails(checkSet(noPlant, { contract: CONTRACT }), 'foot')[0]).toMatch(/without a planted-foot point/);
    // A loop whose plant crosses the wrap: rotate the walk by 3 frames.
    const w = walk();
    const rot: CheckStrip = { ...w, frames: [...w.frames.slice(3), ...w.frames.slice(0, 3)] };
    expect(plantDrifts(rot, 0.5).map((d) => d.drift)).toEqual([0, 0]);
    expect(plantDrifts(walk(), 0.25).map((d) => d.drift)).toEqual([5, 5]);
    // The set's face fixes the walking direction: a reversed stride no longer fits by a guess.
    expect(fails(checkSet(edit((s) => (s.face = -1)), { contract: CONTRACT }), 'foot')[0]).toMatch(/drifts \d+\.\d+ px .* walking left/);
    const guess = checkSet(edit((s) => delete s.face), { contract: CONTRACT });
    expect(guess.findings.some((f) => f.gate === 'foot' && f.level === 'warn' && /no face/.test(f.msg))).toBe(true);
  });

  it('contract: missing ids, loop, logic time, events, points', () => {
    const c = new Map<string, ContractEntry>(CONTRACT);
    c.set('test/probe/kick', { id: 'test/probe/kick' });
    c.set('test/probe-b/kick', { id: 'test/probe-b/kick' });
    const missing = fails(checkSet(goodSet(), { contract: c }), 'contract');
    expect(missing).toEqual(expect.arrayContaining([expect.stringMatching(/"test\/probe\/kick" has no strip/), expect.stringMatching(/"test\/probe-b\/kick" has no strip/)]));
    expect(fails(checkSet(edit((s) => ((s.strips.throw as Mutable<CheckStrip>).loop = true)), { contract: CONTRACT }), 'contract')[0]).toMatch(/loop true, contract false/);
    expect(fails(checkSet(edit((s) => ((s.strips.throw as Mutable<CheckStrip>).durations = [3, 3, 2, 2, 4, 7])), { contract: CONTRACT }), 'contract')[0]).toMatch(/21 ticks, the code relies on 20/);
    expect(fails(checkSet(edit((s) => (s.events = {})), { contract: CONTRACT }), 'contract')[0]).toMatch(/THROW_RELEASE is missing/);
    expect(fails(checkSet(edit((s) => (s.events = { THROW_RELEASE: 2 })), { contract: CONTRACT }), 'contract')[0]).toMatch(/THROW_RELEASE = 2 \(frame start tick 6\), the contract tick is 10/);
    const noHand = edit((s) => ((s.strips.idle.frames as CheckFrame[])[2] = frame({ step: 2 })));
    expect(fails(checkSet(noHand, { contract: CONTRACT }), 'contract')[0]).toMatch(/idle#2 missing point\(s\) hand \(old frame 2 had them/);
    // readPoints (the code reads none here): the old frame's points are free.
    const c2 = new Map<string, ContractEntry>(CONTRACT);
    c2.set('test/probe/idle', { ...(CONTRACT.get('test/probe/idle') as ContractEntry), readPoints: [] });
    expect(fails(checkSet(noHand, { contract: c2 }), 'contract')).toEqual([]);
    // shownTicks: frames after the window are never seen (a warning).
    c2.set('test/probe/throw', { ...(CONTRACT.get('test/probe/throw') as ContractEntry), shownTicks: 6 });
    expect(checkSet(goodSet(), { contract: c2 }).findings.some((f) => f.level === 'warn' && /shows only the first 6 ticks: frame\(s\) 2, 3, 4, 5 are never seen/.test(f.msg))).toBe(true);
    // New ids are a warning, not a failure.
    const extra = edit((s) => (s.strips.bored = strip(8, 'idle-fidget')));
    const er = checkSet(extra, { contract: CONTRACT });
    expect(er.gates.contract).toBe('warn');
  });

  it('module: one named const per event, the file named after the slug', () => {
    const r = checkLoaded({ file: 'src/game/content/art40/probe.gen.ts', set: goodSet(), consts: { THROW_RELEASE: 3 } });
    expect(r.gates.format).toBe('fail');
    expect(r.findings.some((f) => /export const THROW_RELEASE is 3/.test(f.msg))).toBe(true);
    const ok = checkLoaded({ file: 'src/game/content/art40/probe.gen.ts', set: goodSet(), consts: { THROW_RELEASE: 4 } }, CONTRACT);
    expect(setPassed(ok)).toBe(true);
    expect(checkLoaded({ file: 'x/other.gen.ts', set: goodSet(), consts: { THROW_RELEASE: 4 } }).gates.format).toBe('fail');
  });
});

describe('art40-check: the contract file (extract.ts shape)', () => {
  const real = contractFromJson({
    characters: [
      {
        key: 'probe',
        rules: [
          { kind: 'speed', strips: ['walk'], text: 'Walks at 0.5 px/tick; the walk strip plays 8 frames.' },
          { kind: 'speed', strips: ['ride'], text: 'Rides at 2.2 px/tick: pedalling, no foot contact on the floor (the wheels).' },
          { kind: 'time', strips: ['throw'], text: 'Throw: the ticket spawns when the strip starts; recover 40 ticks.' },
        ],
      },
    ],
    ids: {
      'test/probe/idle': { character: 'probe', set: 'test/probe/', strip: 'idle', frames: 4, size: [[8, 10], [8, 10], [8, 10], [8, 10]], anchor: [[4, 10], [4, 10], [4, 10], [4, 10]], points: ['hand'], ticksPerFrame: 8, loop: true, defer: false, totalTicks: 32, class: 'idle-breath' },
      'test/probe/walk': { character: 'probe', set: 'test/probe/', strip: 'walk', frames: 8, points: [['hand'], ['hand'], [], [], [], [], [], []], ticksPerFrame: 6, loop: true, totalTicks: 48, class: 'locomotion' },
      'test/probe/throw': { character: 'probe', set: 'test/probe/', strip: 'throw', frames: 5, points: [], durations: [3, 5, 4, 4, 4], loop: false, totalTicks: 20, class: 'throw' },
      'test/probe/portrait': { character: 'probe', set: 'test/probe/', strip: 'portrait', frames: 1, points: [], loop: true, totalTicks: 6, class: 'ui', skip: 'UI: out of scope' },
    },
  });

  it('reads speeds, odometer and no-contact rules, uniform points, feet anchors, skips and time rules', () => {
    expect(real.get('test/probe/walk')?.speed).toBe(0.5);
    expect(real.get('test/probe/idle')?.readPoints).toEqual(['hand']);
    expect(real.get('test/probe/idle')?.anchor).toBe('feet');
    expect(real.get('test/probe/walk')?.framePoints?.[0]).toEqual(['hand']);
    expect(real.get('test/probe/portrait')?.skip).toMatch(/UI/);
    expect(real.get('test/probe/throw')?.timeRules?.[0]).toMatch(/recover 40 ticks/);
    expect(parseSpeedRule('Run: the odometer drives the frames (6 px per frame, 48 px per 8-frame cycle) at any speed up to 2.6 px/tick')).toEqual({ speed: 6, perFrame: true });
    expect(parseSpeedRule('`walk` is the flight flap: flies at 1.4 px/tick. No floor contact.').noFoot).toBeTruthy();
    expect(parseSpeedRule('Steps 0.5 px every 4 ticks (0.125 px/tick) while stepping.')).toEqual({ speed: 0.125 });
  });

  it('checks a set against it: the clean set passes, skipped ids are not required', () => {
    const r = checkSet(goodSet(), { contract: real });
    expect(r.findings.filter((f) => f.level === 'fail')).toEqual([]);
    // The throw keeps 20 ticks; 21 warns with the time rule.
    const slow = checkSet(edit((s) => ((s.strips.throw as Mutable<CheckStrip>).durations = [3, 3, 2, 2, 4, 7])), { contract: real });
    expect(slow.findings.some((f) => f.gate === 'contract' && f.level === 'warn' && /21 ticks, today 20; time rule/.test(f.msg))).toBe(true);
    // Uniform points: every frame needs them.
    const noHand = edit((s) => ((s.strips.idle.frames as CheckFrame[])[3] = frame({ step: 3 })));
    expect(fails(checkSet(noHand, { contract: real }), 'contract')[0]).toMatch(/idle#3 missing point\(s\) hand \(on every old frame\)/);
    // Feet anchor: pixels below it fail (rule 2); a frame above it (airborne) warns.
    const sunk = edit((s) => ((s.strips.idle.frames[1] as Mutable<CheckFrame>).oy = 9));
    expect(fails(checkSet(sunk, { contract: real }), 'contract')[0]).toMatch(/pixels below the feet anchor on frame\(s\) 1/);
    const lifted = edit((s) => ((s.strips.idle.frames[1] as Mutable<CheckFrame>).oy = 11));
    expect(checkSet(lifted, { contract: real }).findings.some((f) => f.level === 'warn' && /frame\(s\) 1 drawn above the feet anchor/.test(f.msg))).toBe(true);
    // Class mismatch: a warning.
    const cls = edit((s) => ((s.strips.idle as Mutable<CheckStrip>).cls = 'fidget'));
    expect(checkSet(cls, { contract: real }).findings.some((f) => /class fidget, the contract says idle-breath/.test(f.msg))).toBe(true);
  });

  it('foot: a left-walking strip fits with dir -1; odometer strips use px per frame', () => {
    const w = walk();
    const left: CheckStrip = { ...w, frames: w.frames.map((f) => ({ ...f, pts: { plant: [-(f.pts?.plant?.[0] ?? 0), 0] } })) };
    expect(plantDrifts(left, 0.5).some((d) => d.drift > 1)).toBe(true);
    expect(bestPlantDrifts(left, 0.5)).toEqual({ dir: -1, drifts: [{ point: 'plant', from: 0, drift: 0 }, { point: 'plant', from: 6, drift: 0 }] });
    expect(plantDrifts(w, 2, { perFrame: true }).map((d) => d.drift)).toEqual([0, 0]);
  });

  it('reads the structured contract fields: anchorKind, noFoot (wins over speed), shownTicks', () => {
    const c = contractFromJson({
      ids: {
        'test/x/ride': { anchor: [[3, 9]], anchorKind: 'feet', speed: 0.8, noFoot: 'on the bike', shownTicks: 6, readPoints: [] },
        'test/x/walk': { anchor: [[13, 41], [12, 40]], size: [[24, 41], [23, 40]] },
      },
    });
    expect(c.get('test/x/ride')).toMatchObject({ anchor: 'feet', speed: 0.8, noFoot: 'on the bike', shownTicks: 6, readPoints: [] });
    expect(c.get('test/x/walk')?.anchor).toBe('feet');
    // noFoot wins over the speed in the foot gate.
    const ride = edit((s) => (s.strips = { ride: strip(12, 'locomotion') }));
    const r = checkSet({ ...ride, prefix: 'test/x', slug: 'x', variants: {} }, { contract: c });
    expect(r.findings.filter((f) => f.gate === 'foot').map((f) => f.level)).toEqual(['info']);
  });

  it('rules.json (the bake reads it) is the TypeScript rules; every class of the contract resolves, with the same count', () => {
    expect(readFileSync(RULES_PATH, 'utf8')).toBe(rulesJson());
    const rules = JSON.parse(rulesJson()) as { classes: Array<{ name: string; min: number }>; aliases: Record<string, string> };
    for (const c of rules.classes) expect(actionClass(c.name)?.min).toBe(c.min);
    for (const a of Object.keys(rules.aliases)) expect(actionClass(a), a).toBeDefined();
    if (existsSync('docs/design/ams40/contract.json')) {
      const c = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')) as { classes: Record<string, { target: number | null }> };
      for (const [k, v] of Object.entries(c.classes)) expect([k, actionClass(k)?.min], k).toEqual([k, v.target ?? 1]);
    }
    expect(new Set(ACTION_CLASSES.map((c) => c.name)).size).toBe(ACTION_CLASSES.length);
  });
});

describe('art40-check: files and the command', () => {
  mkdirSync('tmp', { recursive: true });
  const dir = mkdtempSync(join('tmp', 'art40-check-test-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const write = (slug: string, set: CheckSet, consts = 'export const THROW_RELEASE = 4;'): void => {
    writeFileSync(join(dir, `${slug}.gen.ts`), `export const SET = ${JSON.stringify(set)};\n${consts}\n`);
  };

  it('loads .gen.ts files, checks them and exits 1 on a failure', async () => {
    write('probe', goodSet());
    let run = await checkAll([], dir, join(dir, 'no-contract.json'));
    expect(run.errors).toEqual([]);
    expect(run.reports.map((r) => [r.slug, setPassed(r)])).toEqual([['probe', true]]);
    const ok = spawnSync(process.execPath, ['--import', 'tsx', 'tools/art40/check/index.ts', '--dir', dir, '--contract', join(dir, 'none.json')], { encoding: 'utf8' });
    expect(ok.stdout).toMatch(/art40-check: pass/);
    expect(ok.status).toBe(0);
    write('bad', { ...goodSet(), slug: 'bad', prefix: 'test/bad', budget: 32 });
    run = await checkAll(['bad'], dir);
    expect(run.reports.map((r) => r.gates.colour)).toEqual(['fail']);
    const bad = spawnSync(process.execPath, ['--import', 'tsx', 'tools/art40/check/index.ts', '--dir', dir, '--json', 'bad'], { encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout).passed).toBe(false);
  }, 30_000);

  const probe = 'tests/fixtures/art40/_probe.gen.ts';
  it.skipIf(!existsSync(probe))('reads the bake probe fixture (format and colour gates; the same indices as the engine loader)', async () => {
    const l = await loadSet(probe);
    const r = checkLoaded({ ...l, file: `${l.set.slug}.gen.ts` });
    // A toy set: only the format and colour gates must pass (its pixels are not production art).
    expect(r.findings.filter((f) => (f.gate === 'format' || f.gate === 'colour') && f.level === 'fail')).toEqual([]);
    expect(r.frames).toBeGreaterThan(0);
    // The check's own decoder reads the same indices as the engine loader.
    for (const st of Object.values(l.set.strips)) for (const f of st.frames) expect([...decodeIndices(f.px, f.w, f.h)]).toEqual([...decodeBakedIndices(f as BakedFrame)]);
  });
});

describe('art40-check: coverage of replaced ids in the sprite registry', () => {
  it('a registered set is covered; old art, missing registrations and dense art are problems', async () => {
    const probe = (await loadSet('tests/fixtures/art40/_probe.gen.ts')).set;
    expect(coverage([probe]).problems).toEqual([`set ${probe.slug}: no id is registered with its frames (baked but never registered: defineBakedSet missing?)`]);
    const ids = defineBakedSet(probe as BakedSet);
    const cov = coverage([probe]);
    expect(cov.problems).toEqual([]);
    expect(cov.replaced).toEqual(ids);
    // Old art under a set's id: not replaced, a problem (gate 1).
    const old: CheckSet = { ...goodSet(), slug: 'cov', prefix: 'test/cov', variants: {} };
    const pal = bakedPalette([...old.pal]);
    defineSprite('test/cov/idle', () => [decodeBakedFrame(frame({ step: 7 }) as BakedFrame, pal)]);
    const c2 = coverage([old]);
    expect(c2.notReplaced).toEqual(['test/cov/idle']);
    expect(c2.unregistered).toEqual(['test/cov/walk', 'test/cov/throw']);
    expect(c2.problems).toEqual([
      'test/cov/idle: the game draws other frames than the baked set (an old drawer registers it again?)',
      'set cov: no id is registered with its frames (baked but never registered: defineBakedSet missing?)',
    ]);
    // The baked frames with a 2x generator left behind: replaced, but dense art is a problem; a
    // contract id of the prefix that is missing, or baked but not registered, too.
    defineSprite('test/cov/walk', () => old.strips.walk.frames.map((f) => decodeBakedFrame(f as BakedFrame, pal)), { durations: [...old.strips.walk.durations], hi: () => old.strips.walk.frames.map(() => new PixelBuffer(2 * W, 2 * H)) });
    const c3 = coverage([old], new Map([['test/cov/kick', { id: 'test/cov/kick' }], ['test/cov/throw', { id: 'test/cov/throw' }], ['test/cov/skip', { id: 'test/cov/skip', skip: 'UI' }]]));
    expect(c3.replaced).toEqual(['test/cov/walk']);
    expect(c3.problems).toEqual(expect.arrayContaining(['test/cov/walk: getFrames(2) is not the 1x strip', 'test/cov/walk: has a 2x generator', 'test/cov/kick: contract id missing (rule 1)', 'test/cov/throw: in the contract, baked, but not registered (defineBakedSet only?)']));
    expect(c3.problems.some((p) => p.startsWith('test/cov/skip'))).toBe(false);
  });

  it('an old drawer that registers a baked id again (after defineBakedSet) is caught, and so is a late alias error', async () => {
    const probe = (await loadSet('tests/fixtures/art40/_probe.gen.ts')).set;
    const set = { ...(JSON.parse(JSON.stringify(probe)) as CheckSet), slug: 'late', prefix: 'test/late', variants: {} };
    defineBakedSet(set as BakedSet);
    expect(coverage([set]).problems).toEqual([]);
    defineSprite('test/late/idle', () => [new PixelBuffer(3, 3)]);
    expect(coverage([set]).problems).toEqual(['test/late/idle: the game draws other frames than the baked set (an old drawer registers it again?)']);
    const set2 = { ...(JSON.parse(JSON.stringify(probe)) as CheckSet), slug: 'late2', prefix: 'test/late2', variants: {} };
    defineBakedSet(set2 as BakedSet);
    defineSprite('test/late2-other/x', () => [new PixelBuffer(2, 2)], { hi: () => [new PixelBuffer(4, 4)] });
    defineDenseAlias('test/late2/swing', 'test/late2-other/x');
    const warn = console.warn;
    console.warn = () => {};
    try {
      const p = coverage([set2]).problems;
      expect(p.some((m) => /^test\/late2\/swing: /.test(m))).toBe(true);
    } finally {
      console.warn = warn;
    }
  });
});
