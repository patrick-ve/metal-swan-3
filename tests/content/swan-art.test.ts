/**
 * SWAN-3 art from the OLD robot rig (docs/design/swan-mount/look.md §7–§12, GDD §8.2, §15.6): the
 * strips no baked 40 px set has yet (docs/design/ams40.md wave 7; stage 2: the necks, swim and
 * flight) and the Swan in socks (m3 only, out of the ams40 scope) exist in their prefixes with
 * their frame count, timing and named points (§8); the neck geometry of §11 (9 aim angles, water
 * = land for the up aims, `-fire` recoil, `muzzle` = `cannon`); the Mute neck and the socks; the
 * tin feather and the beak flash; the shared head drawing for the UI; palette only. The baked
 * strips (the ground strips, the riderless strips, the egg, the scuffs) are tested in
 * tests/art40/swan.test.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inPalette, PAL } from '../../src/engine/palette';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { getFrames, hasSprite, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import type * as SwanArt from '../../src/game/content/vehicles/swan/art';

let art: typeof SwanArt;
/** Strip names a baked Swan set draws (the old rig no longer registers them in the colour prefixes). */
let BAKED = new Set<string>();
const old = (anim: string): boolean => !BAKED.has(anim);

beforeAll(async () => {
  art = await import('../../src/game/content/vehicles/swan/art');
  BAKED = new Set(art.SWAN_SETS.flatMap((set) => Object.keys(set.strips)));
});

const BODY = ['vehicle/swan', 'vehicle/swan-mute', 'vehicle/swan-socks', 'vehicle/swan-mute-socks'] as const;
const COLOUR = ['vehicle/swan', 'vehicle/swan-mute'] as const;

/** Frames, timing (a number = ticks per frame; an array = durations) and loop (look.md §9). */
type Spec = readonly [frames: number, timing: number | readonly number[] | null, loop: boolean | null];

/** Ridden strips (column R): a rider and a `-front` overlay. `null` = picked or paced by code. */
const RIDDEN: Readonly<Record<string, Spec>> = {
  idle: [2, 24, true],
  run: [8, null, true],
  move: [8, null, true],
  squat: [2, [2, 2], false],
  jump: [2, null, false],
  fall: [2, 6, true],
  stomp: [1, 4, false],
  land: [2, [2, 2], false],
  flap: [2, [3, 3], false],
  glide: [2, 8, true],
  'glide-tired': [2, 2, true],
  fold: [1, 2, false],
  skid: [2, null, false],
  crouch: [2, 24, true],
  waddle: [6, null, true],
  slide: [2, 3, true],
  settle: [2, [2, 2], false],
  swim: [4, null, true],
  'water-duck': [2, 24, true],
  'paddle-up': [4, [2, 2, 2, 2], false],
  honk: [5, [4, 3, 3, 4, 6], false],
  'honk-air': [5, [4, 3, 3, 4, 6], false],
  'honk-swim': [5, [4, 3, 3, 4, 6], false],
  rise: [3, [4, 4, 4], false],
  wreck: [2, 6, true],
};

/** Riderless strips (neck baked in). */
const RIDERLESS: Readonly<Record<string, Spec>> = {
  'sit-down': [3, [6, 6, 8], false],
  empty: [2, 30, true],
  'empty-look': [5, null, null],
  'empty-lay': [8, [20, 10, 10, 6, 6, 8, 20, 30], false],
  hiss: [2, [3, 3], false],
  dive: [8, null, true],
  bash: [1, 6, false],
  tumble: [2, [4, 4], false],
  dazed: [4, 8, true],
  right: [3, [4, 4, 4], false],
  shake: [2, [4, 4], false],
  migrate: [4, 4, true],
  'migrate-soot': [4, 4, true],
};

/** Strips that contain the neck and head (look.md §7 step 1): they carry a `head` point. */
const SELF_CONTAINED = new Set(['rise', 'wreck', ...Object.keys(RIDERLESS)]);
/** Parked strips: the `RIDE?` bubble point (look.md §8.1, §13.8). */
const PARKED = new Set(['empty', 'empty-look', 'empty-lay']);

const BODY_POINTS = ['seat', 'neck', 'hull', 'smoke', 'perch', 'wake', 'footN', 'footF'] as const;

/** Neck postures and their frame counts; each has the four face variants (look.md §9). */
const NECKS: Readonly<Record<string, number>> = { neck: 9, 'swim-neck': 9, 'crouch-neck': 1, 'duck-neck': 1 };
const FACES = ['', '-fire', '-shell', '-blink', '-hurt'] as const;

function frames(id: string, n: number): readonly Frame[] {
  expect(hasSprite(id), `${id} is registered`).toBe(true);
  const fs = getFrames(id);
  expect(fs.length, `${id} frame count`).toBe(n);
  return fs;
}

function pt(f: Frame, name: string): readonly [number, number] {
  const p = f.pts?.[name];
  expect(p, `point ${name}`).toBeDefined();
  return p!;
}

function checkTiming(id: string, [, timing, loop]: Spec): void {
  const a = spriteAnim(id);
  if (loop !== null) expect(a.loop, `${id} loop`).toBe(loop);
  if (timing === null) return;
  if (typeof timing === 'number') {
    expect(a.durations, `${id} durations`).toBeUndefined();
    expect(a.ticksPerFrame, `${id} ticks`).toBe(timing);
  } else {
    expect(a.durations, `${id} durations`).toEqual(timing);
  }
}

function opaque(f: Frame): number {
  let n = 0;
  for (const c of f.buf.data) if ((c & 255) !== 0) n++;
  return n;
}

/** Every opaque pixel is a palette colour (ART_GUIDE: palette ramps only). */
function offPalette(f: Frame): number {
  let n = 0;
  for (const c of f.buf.data) if ((c & 255) !== 0 && !inPalette(c)) n++;
  return n;
}

function countColour(f: Frame, ramp: readonly number[]): number {
  const set = new Set(ramp.map((c) => c >>> 0));
  let n = 0;
  for (const c of f.buf.data) if (set.has(c >>> 0)) n++;
  return n;
}

describe('swan art: body strips (look.md §9, §10)', () => {
  it('registers every ridden and riderless strip in the four body prefixes with its frames and timing', () => {
    for (const pre of BODY) {
      for (const [anim, spec] of Object.entries({ ...RIDDEN, ...RIDERLESS })) {
        if (!pre.endsWith('-socks') && !old(anim)) continue;
        const id = `${pre}/${anim}`;
        const fs = frames(id, spec[0]);
        checkTiming(id, spec);
        for (const f of fs) expect(opaque(f), `${id} is drawn`).toBeGreaterThan(200);
      }
    }
  });

  it('gives every ridden strip a -front overlay in the colour prefixes only (socks never show in it)', () => {
    for (const pre of COLOUR) {
      for (const [anim, spec] of Object.entries(RIDDEN)) {
        if (!old(anim)) continue;
        const body = getFrames(`${pre}/${anim}`);
        const front = frames(`${pre}/${anim}-front`, spec[0]);
        checkTiming(`${pre}/${anim}-front`, spec);
        front.forEach((f, i) => {
          // Same anchor and points as the body frame it covers (look.md §7 step 4).
          expect(f.pts?.seat).toEqual(body[i].pts?.seat);
          expect(opaque(f)).toBeLessThan(opaque(body[i]));
        });
      }
      for (const anim of Object.keys(RIDERLESS)) expect(hasSprite(`${pre}/${anim}-front`), `${pre}/${anim}-front`).toBe(false);
    }
    for (const anim of Object.keys(RIDDEN)) {
      expect(hasSprite(`vehicle/swan-socks/${anim}-front`)).toBe(false);
      expect(hasSprite(`vehicle/swan-mute-socks/${anim}-front`)).toBe(false);
    }
  });

  it('`move` is the `run` strip (socks)', () => {
    for (const pre of BODY.filter((p) => p.endsWith('-socks'))) expect(getFrames(`${pre}/move`).map((f) => f.buf)).toEqual(getFrames(`${pre}/run`).map((f) => f.buf));
  });

  it('every body frame carries the named points of §8.1; baked strips a head, parked strips a bubble', () => {
    for (const anim of [...Object.keys(RIDDEN), ...Object.keys(RIDERLESS)].filter(old)) {
      getFrames(`vehicle/swan/${anim}`).forEach((f) => {
        for (const p of BODY_POINTS) pt(f, p);
        if (SELF_CONTAINED.has(anim)) pt(f, 'head');
        if (PARKED.has(anim)) {
          // 8 px above the pad; the egg wiggle (empty-lay f3–f5) lifts the hull 1–2 px.
          const b = pt(f, 'bubble');
          expect(b[0]).toBe(-4);
          expect(b[1]).toBeGreaterThanOrEqual(-29);
          expect(b[1]).toBeLessThanOrEqual(-27);
        }
      });
    }
  });

  it('matches the rest and check values of §8.1 (the old strips: the water sockets; socks)', () => {
    const idle = getFrames('vehicle/swan-socks/idle')[0];
    expect(pt(idle, 'seat')).toEqual([-4, -48]);
    expect(pt(idle, 'neck')).toEqual([16, -45]);
    expect(pt(idle, 'hull')).toEqual([-3, -38]);
    if (old('swim')) expect(pt(getFrames('vehicle/swan/swim')[0], 'neck')).toEqual([16, -27]);
    if (old('water-duck')) expect(pt(getFrames('vehicle/swan/water-duck')[0], 'neck')).toEqual([16, -19]);
  });

  it('stands on the feet anchor: the paddles reach the ground in the standing strips (socks)', () => {
    for (const anim of ['idle', 'run', 'crouch', 'empty']) {
      const f = getFrames(`vehicle/swan-socks/${anim}`)[0];
      const b = f.buf.trimBounds()!;
      expect(b.y + b.h - f.oy, anim).toBeGreaterThanOrEqual(-1);
      expect(b.y + b.h - f.oy, anim).toBeLessThanOrEqual(1);
    }
  });
});

// The neck strips (the baked set swan-neck: aims x phases, the barrel's muzzle): tests/art40/swan-neck.test.ts.

describe('swan art: variants and damage (look.md §12)', () => {
  it('paints the old Mute neck and head black, SWAN-3 ivory', () => {
    if (!old('neck')) return;
    const ivory = getFrames('vehicle/swan/neck')[2];
    const mute = getFrames('vehicle/swan-mute/neck')[2];
    expect(countColour(mute, PAL.black)).toBeGreaterThan(countColour(ivory, PAL.black) + 40);
    expect(countColour(ivory, PAL.snow.slice(1))).toBeGreaterThan(countColour(mute, PAL.snow.slice(1)) + 40);
  });

  it('puts knitted socks (red stripes) on the paddles of the socks prefixes only', () => {
    expect(countColour(getFrames('vehicle/swan-socks/idle')[0], PAL.red)).toBeGreaterThan(20);
    expect(countColour(getFrames('vehicle/swan-mute-socks/run')[2], PAL.red)).toBeGreaterThan(20);
    expect(countColour(getFrames('vehicle/swan/idle')[0], PAL.red)).toBe(0);
  });

  it('draws the sooty migration darker than the clean one', () => {
    if (!old('migrate')) return;
    const lum = (f: Frame): number => {
      let s = 0;
      for (const c of f.buf.data) if ((c & 255) !== 0) s += ((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255);
      return s / opaque(f);
    };
    expect(lum(getFrames('vehicle/swan/migrate-soot')[0])).toBeLessThan(lum(getFrames('vehicle/swan/migrate')[0]) * 0.8);
  });

  it('has the tin feather and the beak flash', () => {
    for (const f of frames('fx/tin-feather', 4)) {
      expect(opaque(f)).toBeGreaterThan(6);
      expect(countColour(f, PAL.gold)).toBeGreaterThan(0);
    }
    frames('fx/muzzle-swan-beak-gun', 2);
    expect(spriteAnim('fx/muzzle-swan-beak-gun').loop).toBe(false);
    // The logic draws the Swan-owned copy (immune to a second `fx/muzzle-swan-beak-gun`).
    if (old('beak-flash')) frames('vehicle/swan/beak-flash', 2);
  });
});

describe('swan art: shared head and the palette', () => {
  it('exports the head drawing for ui/icon-life and ui/cursor-swan', () => {
    const icon = art.swanHeadIcon();
    expect(icon.buf.w).toBeGreaterThan(8);
    expect(icon.buf.w).toBeLessThanOrEqual(32);
    const f: Frame = { buf: icon.buf, ox: icon.cx, oy: icon.cy };
    expect(offPalette(f)).toBe(0);
    expect(countColour(f, PAL.orange)).toBeGreaterThan(3);
    const mute = art.swanHeadIcon({ colour: 'mute' });
    expect(countColour({ buf: mute.buf, ox: 0, oy: 0 }, PAL.black)).toBeGreaterThan(countColour(f, PAL.black));
    const b = new PixelBuffer(32, 24);
    art.drawSwanHead(b, 12, 12, { eye: 'angry', gap: 2 });
    expect(b.trimBounds()).not.toBeNull();
  });

  it('uses palette colours only, generates without errors, and registers nothing outside the list', () => {
    // The baked 40 px strips have their own palette (docs/design/ams40.md "Rules: colour design").
    const baked = new Set(art.SWAN_BAKED_IDS);
    const ids = [...listSprites('vehicle/swan'), 'fx/tin-feather', 'fx/muzzle-swan-beak-gun'];
    for (const id of ids) if (!baked.has(id)) for (const f of getFrames(id)) expect(offPalette(f), id).toBe(0);
    expect(spriteErrors().filter((e) => e.id.startsWith('vehicle/swan') || e.id.startsWith('fx/tin-feather') || e.id.startsWith('fx/muzzle-swan'))).toEqual([]);
    const known = new Set<string>(['vehicle/swan/scuffs', 'vehicle/swan/egg', 'vehicle/swan/beak-flash', ...art.SWAN_BAKED_IDS]);
    for (const pre of BODY) for (const a of [...Object.keys(RIDDEN), ...Object.keys(RIDERLESS)]) known.add(`${pre}/${a}`);
    for (const pre of COLOUR) {
      for (const a of Object.keys(RIDDEN)) known.add(`${pre}/${a}-front`);
      for (const n of Object.keys(NECKS)) for (const face of FACES) known.add(`${pre}/${n}${face}`);
      for (const n of ['neck-relax', 'swim-neck-relax', 'neck-honk']) known.add(`${pre}/${n}`);
    }
    const swanIds = ids.filter((id) => id.startsWith('vehicle/swan'));
    expect(swanIds.filter((id) => !known.has(id))).toEqual([]);
    expect(swanIds.length).toBe(known.size);
  });
});

describe('logic fallbacks agree with the art', () => {
  it('MUZZLE_REL (constants.ts) equals the neck strips\' `muzzle` points per posture and aim', async () => {
    const { MUZZLE_REL } = await import('../../src/game/content/vehicles/swan/constants');
    const strips = { land: 'neck', water: 'swim-neck', crouch: 'crouch-neck', duck: 'duck-neck' } as const;
    for (const [posture, strip] of Object.entries(strips) as [keyof typeof strips, string][]) {
      const frames = getFrames(`vehicle/swan/${strip}`);
      const table = MUZZLE_REL[posture];
      expect(frames.length, strip).toBe(table.length);
      frames.forEach((f, i) => expect(f.pts?.muzzle, `${strip} ${i}`).toEqual(table[i]));
    }
  });
});
