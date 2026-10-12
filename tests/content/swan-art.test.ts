/**
 * SWAN-3 art (docs/design/swan-mount/look.md §7–§12, GDD §8.2, §15.6): every sprite id of the
 * look.md §9 list exists in its prefixes with its frame count, timing and named points (§8); the
 * rest and check values of §8.1; the neck geometry of §11 (9 aim angles, water = land for the up
 * aims, `-fire` recoil, `muzzle` = `cannon`); the Mute and socks variants; the damage decals, the
 * egg, the tin feather and the beak flash; the shared head drawing for the UI; palette only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inPalette, PAL } from '../../src/engine/palette';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { getFrames, hasSprite, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import type * as SwanArt from '../../src/game/content/vehicles/swan/art';

let art: typeof SwanArt;

beforeAll(async () => {
  art = await import('../../src/game/content/vehicles/swan/art');
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

  it('`move` is the `run` strip', () => {
    for (const pre of BODY) expect(getFrames(`${pre}/move`).map((f) => f.buf)).toEqual(getFrames(`${pre}/run`).map((f) => f.buf));
  });

  it('every body frame carries the named points of §8.1; baked strips a head, parked strips a bubble', () => {
    for (const anim of [...Object.keys(RIDDEN), ...Object.keys(RIDERLESS)]) {
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
    // The parked hull does not jump when the code switches between `empty` and `empty-look`.
    for (const anim of ['empty', 'empty-look']) for (const f of getFrames(`vehicle/swan/${anim}`)) expect(pt(f, 'seat')).toEqual([-4, -20]);
    expect(pt(getFrames('vehicle/swan/empty')[0], 'bubble')).toEqual([-4, -29]);
    const lay = getFrames('vehicle/swan/empty-lay');
    for (const i of [5, 6, 7]) expect(pt(lay[i], 'egg')).toEqual([-30, 0]);
  });

  it('matches the rest and check values of §8.1', () => {
    const idle = getFrames('vehicle/swan/idle')[0];
    expect(pt(idle, 'seat')).toEqual([-4, -48]);
    expect(pt(idle, 'neck')).toEqual([16, -45]);
    expect(pt(idle, 'hull')).toEqual([-3, -38]);
    expect(pt(idle, 'smoke')).toEqual([-20, -50]);
    expect(pt(idle, 'perch')).toEqual([-26, -48]);
    expect(pt(idle, 'wake')).toEqual([-27, -34]);
    const run1 = getFrames('vehicle/swan/run')[1];
    expect(pt(run1, 'seat')).toEqual([-3, -46]);
    expect(pt(run1, 'neck')).toEqual([16, -42]);
    expect(pt(run1, 'perch')).toEqual([-25, -47]);
    const skid1 = getFrames('vehicle/swan/skid')[1];
    expect(pt(skid1, 'seat')).toEqual([-6, -45]);
    expect(pt(skid1, 'neck')).toEqual([14, -45]);
    const jump0 = getFrames('vehicle/swan/jump')[0];
    expect(pt(jump0, 'seat')).toEqual([-5, -50]);
    expect(pt(jump0, 'neck')).toEqual([15, -48]);
    // Posture sockets (§11.3) and the crouch seat.
    const crouch = getFrames('vehicle/swan/crouch')[0];
    expect(pt(crouch, 'seat')).toEqual([-4, -16]);
    expect(pt(crouch, 'neck')).toEqual([16, -17]);
    expect(pt(getFrames('vehicle/swan/swim')[0], 'neck')).toEqual([16, -27]);
    expect(pt(getFrames('vehicle/swan/water-duck')[0], 'neck')).toEqual([16, -19]);
  });

  it('stands on the feet anchor: the paddles reach the ground in the standing strips', () => {
    for (const anim of ['idle', 'run', 'crouch', 'empty']) {
      const f = getFrames(`vehicle/swan/${anim}`)[0];
      const b = f.buf.trimBounds()!;
      expect(b.y + b.h - f.oy, anim).toBeGreaterThanOrEqual(-1);
      expect(b.y + b.h - f.oy, anim).toBeLessThanOrEqual(1);
    }
  });
});

describe('swan art: neck strips (look.md §11)', () => {
  it('registers every posture with its four face variants, the relaxed S and the honk', () => {
    const ticks: Readonly<Record<string, number>> = { '': 30, '-fire': 2, '-shell': 6, '-blink': 6, '-hurt': 12 };
    for (const pre of COLOUR) {
      for (const [name, n] of Object.entries(NECKS)) {
        for (const face of FACES) {
          const id = `${pre}/${name}${face}`;
          for (const f of frames(id, n)) {
            expect(pt(f, 'muzzle'), `${id} muzzle = cannon`).toEqual(pt(f, 'cannon'));
            pt(f, 'head');
          }
          expect(spriteAnim(id).ticksPerFrame, id).toBe(ticks[face]);
        }
      }
      expect(spriteAnim(`${pre}/neck-fire`).ticksPerFrame).toBe(2);
      frames(`${pre}/neck-relax`, 2);
      frames(`${pre}/swim-neck-relax`, 2);
      expect(spriteAnim(`${pre}/neck-relax`).durations).toEqual([180, 6]);
      frames(`${pre}/neck-honk`, 3);
      expect(spriteAnim(`${pre}/neck-honk`).loop).toBe(false);
    }
  });

  it('turns the beak along each aim angle θ = +45° − 22.5°·i, 12 px past the head', () => {
    for (const name of ['neck', 'swim-neck']) {
      getFrames(`vehicle/swan/${name}`).forEach((f, i) => {
        const theta = name === 'swim-neck' && i < 2 ? 0 : ((45 - 22.5 * i) * Math.PI) / 180;
        const h = pt(f, 'head');
        const m = pt(f, 'muzzle');
        const dx = m[0] - h[0];
        const dy = m[1] - h[1];
        expect(Math.hypot(dx, dy), `${name} ${i} beak length`).toBeGreaterThan(10.5);
        expect(Math.hypot(dx, dy), `${name} ${i} beak length`).toBeLessThan(13.5);
        const err = Math.abs(Math.atan2(dy, dx) - theta);
        expect(Math.min(err, Math.PI * 2 - err), `${name} ${i} beak angle`).toBeLessThan(0.15);
      });
    }
  });

  it('places the beak gun of §11.3 for the up aims, water, crouch and duck', () => {
    const land = getFrames('vehicle/swan/neck').map((f) => pt(f, 'muzzle'));
    expect(land.slice(4)).toEqual([[19, -13], [11, -25], [-2, -31], [-16, -36], [-28, -33]]);
    const water = getFrames('vehicle/swan/swim-neck').map((f) => pt(f, 'muzzle'));
    expect(water.slice(0, 4)).toEqual([[26, 4], [26, 4], [26, 4], [24, -11]]);
    // Water frames 4–8 are the land frames: the socket and the rider sink together (§11.2).
    expect(water.slice(4)).toEqual(land.slice(4));
    expect(pt(getFrames('vehicle/swan/crouch-neck')[0], 'muzzle')).toEqual([22, 3]);
    expect(pt(getFrames('vehicle/swan/duck-neck')[0], 'muzzle')).toEqual([24, 1]);
    // Down-forward aims reach at least the §11.3 distance (the head clears the breast).
    const spec = [[19, 30], [23, 26], [24, 21], [24, 3]];
    land.slice(0, 4).forEach((m, i) => {
      expect(m[0], `land ${i}`).toBeGreaterThanOrEqual(spec[i][0]);
      expect(m[0] - spec[i][0], `land ${i}`).toBeLessThanOrEqual(4);
      expect(Math.abs(m[1] - spec[i][1]), `land ${i}`).toBeLessThanOrEqual(1);
    });
  });

  it('-fire pulls the head 1 px back; -shell opens the beak and keeps cannon at its tip', () => {
    const base = getFrames('vehicle/swan/neck');
    const fire = getFrames('vehicle/swan/neck-fire');
    const shell = getFrames('vehicle/swan/neck-shell');
    base.forEach((f, i) => {
      const b = pt(f, 'muzzle');
      const r = pt(fire[i], 'muzzle');
      expect(Math.hypot(r[0] - b[0], r[1] - b[1]), `fire ${i}`).toBeLessThanOrEqual(1.5);
      expect(shell[i].buf.data).not.toEqual(f.buf.data);
      expect(pt(shell[i], 'cannon')).toEqual(pt(shell[i], 'muzzle'));
    });
  });
});

describe('swan art: variants and damage (look.md §12)', () => {
  it('paints the Mute neck and head black, SWAN-3 ivory; the hull stays ivory in both', () => {
    const ivory = getFrames('vehicle/swan/neck')[2];
    const mute = getFrames('vehicle/swan-mute/neck')[2];
    expect(countColour(mute, PAL.black)).toBeGreaterThan(countColour(ivory, PAL.black) + 40);
    expect(countColour(ivory, PAL.snow.slice(1))).toBeGreaterThan(countColour(mute, PAL.snow.slice(1)) + 40);
    const hullIvory = countColour(getFrames('vehicle/swan/idle')[0], PAL.snow.slice(1));
    const hullMute = countColour(getFrames('vehicle/swan-mute/idle')[0], PAL.snow.slice(1));
    expect(Math.abs(hullIvory - hullMute)).toBeLessThan(hullIvory * 0.1);
  });

  it('puts knitted socks (red stripes) on the paddles of the socks prefixes only', () => {
    expect(countColour(getFrames('vehicle/swan-socks/idle')[0], PAL.red)).toBeGreaterThan(20);
    expect(countColour(getFrames('vehicle/swan-mute-socks/run')[2], PAL.red)).toBeGreaterThan(20);
    expect(countColour(getFrames('vehicle/swan/idle')[0], PAL.red)).toBe(0);
  });

  it('draws the sooty migration darker than the clean one', () => {
    const lum = (f: Frame): number => {
      let s = 0;
      for (const c of f.buf.data) if ((c & 255) !== 0) s += ((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255);
      return s / opaque(f);
    };
    expect(lum(getFrames('vehicle/swan/migrate-soot')[0])).toBeLessThan(lum(getFrames('vehicle/swan/migrate')[0]) * 0.8);
  });

  it('has two scuff decals (≤ 2 cells, ≤ 1 cell) that land on the visible hull', () => {
    const [s0, s1] = frames('vehicle/swan/scuffs', 2);
    expect(opaque(s1)).toBeGreaterThan(opaque(s0) * 2);
    // Composite on idle: the decal must change pixels that the front overlay leaves visible.
    const body = getFrames('vehicle/swan/idle')[0];
    const front = getFrames('vehicle/swan/idle-front')[0];
    const draw = (s?: Frame): PixelBuffer => {
      const b = new PixelBuffer(120, 90);
      b.blitFrame(body, 60, 80);
      if (s) b.blitFrame(s, 60 + pt(body, 'hull')[0], 80 + pt(body, 'hull')[1]);
      b.blitFrame(front, 60, 80);
      return b;
    };
    const clean = draw();
    for (const [s, min] of [[s0, 12], [s1, 35]] as const) {
      const d = draw(s);
      let n = 0;
      for (let i = 0; i < d.data.length; i++) if (d.data[i] !== clean.data[i]) n++;
      expect(n).toBeGreaterThanOrEqual(min);
    }
  });

  it('has the egg, the tin feather and the beak flash', () => {
    frames('vehicle/swan/egg', 4);
    expect(spriteAnim('vehicle/swan/egg').durations).toEqual([6, 10, 10, 20]);
    expect(spriteAnim('vehicle/swan/egg').loop).toBe(false);
    for (const f of frames('fx/tin-feather', 4)) {
      expect(opaque(f)).toBeGreaterThan(6);
      expect(countColour(f, PAL.gold)).toBeGreaterThan(0);
    }
    frames('fx/muzzle-swan-beak-gun', 2);
    expect(spriteAnim('fx/muzzle-swan-beak-gun').loop).toBe(false);
    // The logic draws the Swan-owned copy (immune to a second `fx/muzzle-swan-beak-gun`).
    frames('vehicle/swan/beak-flash', 2);
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
    const ids = [...listSprites('vehicle/swan'), 'fx/tin-feather', 'fx/muzzle-swan-beak-gun'];
    for (const id of ids) for (const f of getFrames(id)) expect(offPalette(f), id).toBe(0);
    expect(spriteErrors().filter((e) => e.id.startsWith('vehicle/swan') || e.id.startsWith('fx/tin-feather') || e.id.startsWith('fx/muzzle-swan'))).toEqual([]);
    const known = new Set<string>(['vehicle/swan/scuffs', 'vehicle/swan/egg', 'vehicle/swan/beak-flash']);
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
