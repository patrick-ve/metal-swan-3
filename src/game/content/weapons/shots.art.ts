/**
 * Sprites of the player weapons' shots and flashes (GDD §5, §15.6; ARCHITECTURE §7.1).
 * Imported by weapons/art.ts. All centre-anchored, palette colours only, 1 px outline.
 *
 * - Direction strips (16 frames, frame 0 points right, clockwise; `look: 'angle'`):
 *   `weapon/rocket`, `weapon/homing`.
 * - `weapon/tuba-ring` (8 sizes, 12 → 40 px tall, flying right) and `weapon/tuba-ring-up`.
 * - `weapon/mine-disc` (4f spin + blinking light), `weapon/grenade` (4f spin, GDD §6.1 look).
 * - `weapon/flame` (6 sizes × 2 flickers, hot → cool), `weapon/flame-glow` (nozzle, 2f).
 * - `weapon/laser-flare` (muzzle, 2f), `weapon/laser-hit` (impact, 3f).
 * - Muzzle flashes `fx/muzzle-<weapon>[-up|-diag]` (anchored at the flash base): shotgun,
 *   rocket-launcher, flamethrower, laser, homing, tuba, bounce-mine; the pistol and the machine
 *   gun alias the generic `fx/muzzle` / `fx/muzzle-heavy` families. `fx/muzzle-swan-beak-gun`
 *   belongs to the Swan art (vehicles/swan/art.ts).
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite, type SpriteOpts } from '../../../engine/sprites';
import {
  familyFlashHd,
  flameGlowHd,
  flameHd,
  grenadeHd,
  homingHd,
  laserFlareHd,
  laserHitHd,
  mineHd,
  ringHd,
  rocketHd,
} from '../fx/hd/shots';
import { bayer, hash2 } from '../../art/paint';

const center = (buf: PixelBuffer): Frame => ({ buf, ox: buf.w >> 1, oy: buf.h >> 1 });

/** 16 directions (22.5° steps) by rotating a right-pointing bitmap; outline after rotation. */
function directionStrip(src: PixelBuffer, outline: Color = INK): Frame[] {
  const padded = src.padded(2);
  return Array.from({ length: 16 }, (_, i) => center(padded.rotated((i / 16) * Math.PI * 2).outline(outline).padded(1)));
}

// ------------------------------------------------------------------------------------ rocket

/**
 * The launcher's rocket, pointing right (14×5): a gold exhaust, gold tail fins, a pale steel
 * body lit from above, a crimson band and a crimson nose cone.
 */
function rocketBitmap(): PixelBuffer {
  return ascii(
    [
      '..ff..........', //
      'efFsssssbbsnn.',
      'EEfSSSSSBBSNNn',
      'efFdddddbbdnn.',
      '..ff..........',
    ],
    {
      E: PAL.snow[3],
      e: PAL.gold[3],
      f: PAL.gold[1],
      F: PAL.gold[2],
      s: PAL.steel[4],
      S: PAL.steel[3],
      d: PAL.steel[2],
      b: PAL.red[2],
      B: PAL.red[1],
      n: PAL.red[3],
      N: PAL.red[2],
    },
  );
}

/** A homing missile, pointing right (12×3): an ivory capsule with a sky band and a red nose. */
function homingBitmap(): PixelBuffer {
  return ascii(
    [
      '.vvvvvvvqq..', //
      'ewwwwbwwwRRq',
      '.dddddddrr..',
    ],
    {
      e: PAL.gold[3],
      v: PAL.snow[3],
      w: PAL.snow[2],
      d: PAL.snow[0],
      b: PAL.sky[1],
      q: PAL.red[3],
      R: PAL.red[2],
      r: PAL.red[1],
    },
  );
}

// ------------------------------------------------------------------------------------ tuba ring

/** Ring heights of the 8 frames (GDD §5: 12 → 40 px). */
export const RING_SIZES: readonly number[] = [12, 16, 20, 24, 28, 32, 36, 40];

/**
 * One sonic ring flying right, `size` px tall: a bright crescent (the wave front) with a softer
 * second arc behind it — two brass "oom-pah" waves. Centre anchor = the hitbox centre.
 */
function ringFrame(size: number): Frame {
  const h = size;
  const a = Math.max(3, Math.round(size * 0.22)); // half-width of the front arc
  const w = a * 2 + 8;
  const b = new PixelBuffer(w + 4, h + 4);
  const cx = Math.floor(b.w / 2) - 1;
  const cy = (b.h - 1) / 2;
  const R = h / 2;
  // Front arc (2 px thick: a white-hot leading edge and a gold body), then a fainter arc 4 px behind.
  for (let y = 0; y < b.h; y++) {
    const v = (y - cy) / R;
    if (Math.abs(v) > 1) continue;
    const s = Math.sqrt(1 - v * v);
    const front = cx + a * s;
    const back = cx - 4 + (a - 1) * s;
    const xf = Math.round(front);
    const xb = Math.round(back);
    const tip = Math.abs(v) > 0.82;
    b.set(xf + 1, y, tip ? PAL.gold[3] : PAL.snow[3]);
    b.set(xf, y, PAL.gold[3]);
    if (!tip) b.set(xf - 1, y, PAL.gold[2]);
    if (Math.abs(v) < 0.9) {
      b.set(xb, y, PAL.gold[2]);
      if (Math.abs(v) < 0.6) b.set(xb - 1, y, PAL.gold[1]);
    }
  }
  b.outline(INK);
  return { buf: b, ox: cx, oy: Math.round(cy) };
}

function ringStrip(up: boolean): Frame[] {
  return RING_SIZES.map((s) => {
    const f = ringFrame(s);
    if (!up) return f;
    // A quarter turn counter-clockwise: the wave front points up.
    const buf = f.buf.rotated(-Math.PI / 2);
    return { buf, ox: f.oy, oy: f.buf.w - 1 - f.ox };
  });
}

// ------------------------------------------------------------------------------------ mines, grenades

/**
 * The bounce mine, 9×5 side view: a steel disc with a gold rim band whose rivets turn as it
 * spins, and a red light on top that blinks (2 frames on, 2 off).
 */
function mineFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = ascii(['..sSSSs..', '.SSSSSSSd', 'gGgGgGgGg', '.ddddddd.', '..ddddd..'], {
      s: PAL.steel[4],
      S: PAL.steel[3],
      d: PAL.steel[2],
      g: PAL.gold[1],
      G: PAL.gold[2],
    });
    // Rivets travel along the band (the disc spins).
    for (let x = 0; x < 9; x++) if ((x + i) % 3 === 0) b.set(x, 2, PAL.gold[3]);
    const out = b.padded(1, 2, 1, 1);
    out.set(5, 1, i < 2 ? PAL.red[3] : PAL.red[1]);
    out.set(5, 0, i < 2 ? PAL.gold[3] : 0);
    return center(out.outline(INK));
  });
}

/**
 * The hand grenade in flight (GDD §6.1): a 6×6 olive ball with a gold band and a tiny white
 * swan stencil, a steel cap; 4 frames of spin (the band and the stencil turn).
 */
function grenadeFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(8, 9);
    b.sphere(4, 5, 3, [PAL.olive[0], PAL.olive[1], PAL.olive[2], PAL.olive[3]], { dither: false });
    // Band: horizontal, diagonal, vertical, other diagonal.
    for (let k = -3; k <= 3; k++) {
      const [x, y] = i === 0 ? [4 + k, 5] : i === 1 ? [4 + k, 5 - k] : i === 2 ? [4, 5 + k] : [4 + k, 5 + k];
      if (b.get(x, y) & 255) b.set(x, y, k < 0 ? PAL.gold[2] : PAL.gold[1]);
    }
    // The stencil (one white pixel on the lit side, turning).
    const st: ReadonlyArray<readonly [number, number]> = [
      [3, 4],
      [5, 4],
      [5, 6],
      [3, 6],
    ];
    b.set(st[i][0], st[i][1], PAL.snow[3]);
    // Steel cap and lever on top.
    b.set(4, 1, PAL.steel[3]);
    b.set(5, 1, PAL.steel[2]);
    return center(b.outline(INK));
  });
}

// ------------------------------------------------------------------------------------ flame

/** Flame colours per size step (core → rim), hot (small) to cool (big). */
const FLAME_RAMPS: ReadonlyArray<readonly Color[]> = [
  [PAL.snow[3], PAL.gold[3]],
  [PAL.snow[3], PAL.gold[3], PAL.gold[2]],
  [PAL.gold[3], PAL.gold[2], PAL.orange[2]],
  [PAL.gold[2], PAL.orange[2], PAL.orange[1]],
  [PAL.orange[2], PAL.orange[1], PAL.red[2]],
  [PAL.orange[1], PAL.red[2], PAL.red[1]],
];

/**
 * A flame blob of radius `r` (a round body with a tongue licking up; `flick` moves the
 * tongue): rings of the ramp from the core outward, a darker rim instead of an ink line.
 */
function flameBlob(r: number, ramp: readonly Color[], flick: number, seed: number): Frame {
  const size = r * 2 + 6;
  const b = new PixelBuffer(size, size + 3);
  const cx = size / 2;
  const cy = size / 2 + 2;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      // The tongue: the upper half stretches up and leans with the flicker.
      const up = dy < 0 ? dy / 1.45 : dy;
      const lean = dy < 0 ? (flick ? 0.35 : -0.35) * -dy : 0;
      const dist = Math.hypot(dx - lean, up) / r;
      if (dist > 1) continue;
      // Ragged rim (fixed per frame).
      if (dist > 0.82 && hash2(x, y, seed) > 0.72) continue;
      const k = Math.min(ramp.length - 1, Math.floor(dist * ramp.length + (bayer(x, y) - 0.5) * 0.6));
      b.set(x, y, ramp[Math.max(0, k)]);
    }
  }
  b.outline(ramp.length > 2 ? PAL.red[1] : PAL.orange[2]);
  return { buf: b, ox: Math.floor(cx), oy: Math.floor(cy) };
}

function flameFrames(): Frame[] {
  const out: Frame[] = [];
  for (let k = 0; k < 6; k++) for (let f = 0; f < 2; f++) out.push(flameBlob(2 + k, FLAME_RAMPS[k], f, k * 7 + f));
  return out;
}

/** The pilot flame at the nozzle (2 frames, drawn additively). */
function flameGlowFrames(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(9, 9);
    b.circle(4, 4, 3 - i, PAL.orange[2]);
    b.circle(4, 4, 2 - i, PAL.gold[3]);
    b.set(4, 4, PAL.snow[3]);
    return center(b);
  });
}

// ------------------------------------------------------------------------------------ laser

/** A cyan-white star at the gun (2 frames, additive). */
function laserFlareFrames(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(11, 11);
    const s = 4 - i;
    b.hline(5 - s, 5 + s, 5, PAL.teal[3]);
    b.vline(5, 5 - s + 1, 5 + s - 1, PAL.teal[3]);
    b.circle(5, 5, 2, PAL.teal[3]);
    b.circle(5, 5, 1, PAL.snow[3]);
    if (i === 0) {
      b.set(3, 3, PAL.teal[2]);
      b.set(7, 7, PAL.teal[2]);
      b.set(7, 3, PAL.teal[2]);
      b.set(3, 7, PAL.teal[2]);
    }
    return center(b);
  });
}

/** Where the beam hits: a crackling cyan burst (3 frames, additive). */
function laserHitFrames(): Frame[] {
  const rows: string[][] = [
    ['....c....', '..c.T.c..', '...TWT...', 'cTTWWWTTc', '...TWT...', '..c.T.c..', '....c....'],
    ['..c...c..', '...cTc...', '..TTWTT..', '.cTWWWTc.', '..TTWTT..', '...cTc...', '..c...c..'],
    ['.........', '.c..T..c.', '...TWT...', '..TWWWT..', '...TWT...', '.c..T..c.', '.........'],
  ];
  return rows.map((r) => center(ascii(r, { c: PAL.teal[2], T: PAL.teal[3], W: PAL.snow[3] }).padded(1)));
}

// ------------------------------------------------------------------------------------ muzzle flashes

/**
 * A muzzle flash pointing right, anchored at its base (left middle). `rows` are drawn from the
 * key; the flash family then gets '-up' (quarter turn) and '-diag' (45°) variants.
 */
function flashFrame(rows: readonly string[], key: Readonly<Record<string, Color>>, outline: Color | null): Frame {
  const b = ascii(rows, key).padded(1);
  if (outline !== null) b.outline(outline);
  return { buf: b, ox: 1, oy: b.h >> 1 };
}

/** Turn a right-pointing flash (anchor at the base) a quarter up or 45° up-right. */
function turnFlash(f: Frame, how: 'up' | 'diag'): Frame {
  if (how === 'up') {
    const buf = f.buf.rotated(-Math.PI / 2);
    return { buf, ox: f.oy, oy: f.buf.w - 1 - f.ox };
  }
  const d = f.buf.w / 2 - f.ox;
  const buf = f.buf.rotated(-Math.PI / 4).padded(1);
  return { buf, ox: Math.round(buf.w / 2 - d * Math.SQRT1_2), oy: Math.round(buf.h / 2 + d * Math.SQRT1_2) };
}

const FIRE_KEY: Readonly<Record<string, Color>> = {
  W: PAL.snow[3],
  Y: PAL.gold[3],
  y: PAL.gold[2],
  O: PAL.orange[2],
  o: PAL.orange[1],
  r: PAL.red[2],
  s: PAL.stone[2],
  S: PAL.stone[3],
  c: PAL.teal[2],
  C: PAL.teal[3],
  g: PAL.gold[1],
  k: PAL.stone[1],
};

/** Flash families: per frame rows (pointing right). */
const FLASHES: Readonly<Record<string, { frames: readonly (readonly string[])[]; outline: Color | null }>> = {
  // A wide, flat burst with side spikes and a smoke tail.
  shotgun: {
    outline: PAL.red[1],
    frames: [
      ['.y.....y......', '..yY..Yy..o...', 'YWWWWWWYYyOo.o.', 'WWWWWWWWYYyyOo.', 'YWWWWWWYYyOo.o.', '..yY..Yy..o...', '.y.....y......'],
      ['..............', '...y...y......', '.YYWWYYyyoo....', 'YWWWWWYYyyOo...', '.YYWWYYyyoo....', '...y...y......', '..............'],
      ['..............', '..............', '..sSSs.s......', '.sSSSSsks.....', '..sSSs.s......', '..............', '..............'],
    ],
  },
  // Back-blast is the smoke puff; the front is a round orange bloom.
  'rocket-launcher': {
    outline: PAL.red[1],
    frames: [
      ['..yYy....', '.yWWWYo..', 'YWWWWWYOo', '.yWWWYo..', '..yYy....'],
      ['.........', '..yYYo...', '.yYWWYO..', '..yYYo...', '.........'],
      ['.........', '...sS....', '..sSSs...', '...sS....', '.........'],
    ],
  },
  // A short pilot flare (the stream itself does the rest).
  flamethrower: {
    outline: PAL.red[1],
    frames: [
      ['.yY...', 'YWWYo.', '.yY...'],
      ['.y....', 'YWYo..', '.y....'],
    ],
  },
  // A cyan ring of light.
  laser: {
    outline: null,
    frames: [
      ['..c..', '.cCc.', 'cCWCc', '.cCc.', '..c..'],
      ['.....', '..c..', '.cWc.', '..c..', '.....'],
    ],
  },
  // A twin puff (two missiles).
  homing: {
    outline: PAL.red[1],
    frames: [
      ['.YWo..', 'YWWYo.', '......', 'YWWYo.', '.YWo..'],
      ['......', '.YYo..', '......', '.YYo..', '......'],
    ],
  },
  // Sound bursting from the bell: two brass arcs.
  tuba: {
    outline: INK,
    frames: [
      ['..Y.....', '.yY..Y..', '.yY..yY.', '.yY..yY.', '.yY..yY.', '.yY..Y..', '..Y.....'],
      ['........', '..Y.....', '..yY..Y.', '..yY..Y.', '..yY..Y.', '..Y.....', '........'],
    ],
  },
  // A soft "thunk" puff.
  'bounce-mine': {
    outline: null,
    frames: [
      ['.SS..', 'SSSSs', '.SSs.'],
      ['.....', '.sSs.', '..s..'],
    ],
  },
};

const flashOpts: SpriteOpts = { ticksPerFrame: 2, loop: false };

export function defineShotSprites(): void {
  // HD art (2× and 4×, mission ams): fx/hd/shots.ts, drawn natively per frame and direction.
  const def = (id: string, gen: () => Frame[], opts: SpriteOpts, hd: (id: string, d: number) => Frame[]): void =>
    defineSprite(id, gen, { ...opts, hd: (d) => hd(id, d) });
  def('weapon/rocket', () => directionStrip(rocketBitmap()), {}, rocketHd);
  def('weapon/homing', () => directionStrip(homingBitmap()), {}, homingHd);
  def('weapon/homing-missile', () => directionStrip(homingBitmap()), {}, homingHd);
  def('weapon/tuba-ring', () => ringStrip(false), { ticksPerFrame: 4 }, (id, d) => ringHd(id, d, false));
  def('weapon/tuba-ring-up', () => ringStrip(true), { ticksPerFrame: 4 }, (id, d) => ringHd(id, d, true));
  def('weapon/mine-disc', mineFrames, { ticksPerFrame: 3 }, mineHd);
  def('weapon/grenade', grenadeFrames, { ticksPerFrame: 3 }, grenadeHd);
  def('weapon/flame', () => flameFrames(), { ticksPerFrame: 2 }, flameHd);
  def('weapon/flame-glow', flameGlowFrames, { ticksPerFrame: 2 }, flameGlowHd);
  def('weapon/laser-flare', laserFlareFrames, { ticksPerFrame: 2 }, laserFlareHd);
  def('weapon/laser-hit', laserHitFrames, { ticksPerFrame: 2 }, laserHitHd);

  for (const [id, f] of Object.entries(FLASHES)) {
    const fwd = (): Frame[] => f.frames.map((rows) => flashFrame(rows, FIRE_KEY, f.outline));
    def(`fx/muzzle-${id}`, fwd, flashOpts, (sid, d) => familyFlashHd(sid, d, id, 'fwd'));
    def(`fx/muzzle-${id}-up`, () => fwd().map((fr) => turnFlash(fr, 'up')), flashOpts, (sid, d) => familyFlashHd(sid, d, id, 'up'));
    def(`fx/muzzle-${id}-diag`, () => fwd().map((fr) => turnFlash(fr, 'diag')), flashOpts, (sid, d) => familyFlashHd(sid, d, id, 'diag'));
  }
}
