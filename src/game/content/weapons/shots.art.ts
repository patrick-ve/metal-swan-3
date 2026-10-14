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
import { HI, HiPen, asHi, outlineHi, turnFrame, turnHi } from '../../art/hi';
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

/**
 * `ringFrame` on the 2× grid: the same arcs measured per 2× row (a smooth curve instead of 1×
 * steps), the stripes at the 1× widths, but the white-hot leading edge 1 px (finer) with the gold
 * body behind it, and a 2-px INK outline. Same logical size and anchor.
 */
function ringFrameHi(size: number): Frame {
  const base = ringFrame(size);
  const h = size;
  const a = Math.max(3, Math.round(size * 0.22));
  const b = new PixelBuffer(base.buf.w * HI, base.buf.h * HI);
  const cx = base.ox;
  const cy = (base.buf.h - 1) / 2;
  const R = h / 2;
  // Logical x → 2× column of its centre (an integer logical x = the right half of that pixel).
  const col = (x: number): number => Math.round(x * HI + 0.5);
  for (let y = 0; y < b.h; y++) {
    const v = ((y + 0.5) / HI - 0.5 - cy) / R;
    if (Math.abs(v) > 1) continue;
    const s = Math.sqrt(1 - v * v);
    const xf = col(cx + a * s);
    const xb = col(cx - 4 + (a - 1) * s);
    const tip = Math.abs(v) > 0.82;
    // xf - 1 … xf + 2 is the 1× front pixel and the one ahead of it.
    b.set(xf + 2, y, tip ? PAL.gold[3] : PAL.snow[3]);
    for (let x = xf - 1; x <= xf + 1; x++) b.set(x, y, PAL.gold[3]);
    if (!tip) {
      b.set(xf - 2, y, PAL.gold[2]);
      b.set(xf - 3, y, PAL.gold[2]);
    }
    if (Math.abs(v) < 0.9) {
      b.set(xb, y, PAL.gold[2]);
      b.set(xb - 1, y, PAL.gold[2]);
      if (Math.abs(v) < 0.6) {
        b.set(xb - 2, y, PAL.gold[1]);
        b.set(xb - 3, y, PAL.gold[1]);
      }
    }
  }
  outlineHi(b, HI);
  return asHi(b, base);
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

/** The 2× twin of `ringStrip` (the quarter turn through the density-aware `turnFrame`). */
function ringStripHi(up: boolean): Frame[] {
  return RING_SIZES.map((s) => (up ? turnFrame(ringFrameHi(s), -1) : ringFrameHi(s)));
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
function flameBlob(r: number, ramp: readonly Color[], flick: number, seed: number, d = 1): Frame {
  const size = r * 2 + 6;
  const b = new PixelBuffer(size * d, (size + 3) * d);
  const cx = size / 2;
  const cy = size / 2 + 2;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const dx = (x + 0.5) / d - cx;
      const dy = (y + 0.5) / d - cy;
      // The tongue: the upper half stretches up and leans with the flicker.
      const up = dy < 0 ? dy / 1.45 : dy;
      const lean = dy < 0 ? (flick ? 0.35 : -0.35) * -dy : 0;
      const dist = Math.hypot(dx - lean, up) / r;
      if (dist > 1) continue;
      // Ragged rim (fixed per frame): whole logical pixels, tested at the logical pixel's centre,
      // so 2× art keeps the 1× bites (and neighbouring blobs merge as at 1×).
      const lx = Math.floor(x / d);
      const ly = Math.floor(y / d);
      if (d === 1) {
        if (dist > 0.82 && hash2(x, y, seed) > 0.72) continue;
      } else {
        const ldy = ly + 0.5 - cy;
        const lup = ldy < 0 ? ldy / 1.45 : ldy;
        const llean = ldy < 0 ? (flick ? 0.35 : -0.35) * -ldy : 0;
        const ldist = Math.hypot(lx + 0.5 - cx - llean, lup) / r;
        if (ldist > 0.82 && hash2(lx, ly, seed) > 0.72) continue;
      }
      // Band dither on whole logical pixels (a 2 × 2 cell at 2×), never a single-2×-px checker.
      const k = Math.min(ramp.length - 1, Math.floor(dist * ramp.length + (bayer(lx, ly) - 0.5) * 0.6));
      b.set(x, y, ramp[Math.max(0, k)]);
    }
  }
  const rim = ramp.length > 2 ? PAL.red[1] : PAL.orange[2];
  if (d === 1) b.outline(rim);
  else {
    const body = b.data.slice();
    // The 2× rim is broken into dashes (a ragged edge, like the 1× bites), so overlapping blobs
    // merge into one stream instead of a chain of outlined discs. Each rim pixel belongs to the
    // logical pixel of the body it borders (ring 2 through ring 1), so a dash spans the full rim
    // width and never leaves a lone 2× pixel.
    const { w } = b;
    const owner = new Int32Array(b.w * b.h).fill(-1);
    for (let i = 0; i < owner.length; i++) if (b.data[i] & 255) owner[i] = ((i % w) >> 1) + ((((i / w) | 0) >> 1) << 12);
    outlineHi(b, HI, rim);
    for (let ring = 0; ring < HI; ring++) {
      const prev = owner.slice();
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (prev[i] >= 0 || (b.data[i] & 255) === 0) continue;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]]) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= b.h || prev[ny * w + nx] < 0) continue;
            owner[i] = prev[ny * w + nx];
            break;
          }
        }
      }
    }
    for (let i = 0; i < owner.length; i++) {
      if ((body[i] & 255) !== 0 || owner[i] < 0) continue;
      if (hash2(owner[i] & 4095, owner[i] >> 12, seed + 17) > 0.6) b.data[i] = 0;
    }
    b.touch();
  }
  const f: Frame = { buf: b, ox: Math.floor(cx), oy: Math.floor(cy) };
  return d === 1 ? f : { ...f, density: d };
}

function flameFrames(d = 1): Frame[] {
  const out: Frame[] = [];
  for (let k = 0; k < 6; k++) for (let f = 0; f < 2; f++) out.push(flameBlob(2 + k, FLAME_RAMPS[k], f, k * 7 + f, d));
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

// ------------------------------------------------------------------------------------ 2× twins

/*
 * 2× art for mission ams (docs/ART_GUIDE.md "2x art (mission ams)"): every shot and flash above
 * on the 2× grid, each frame with its 1× frame's logical size and anchor (the registry copies the
 * points). Hand-placed rows where the 1× art is hand-placed, the same shapes measured on the 2×
 * grid where it is computed; INK outlines 2 px (the 1× weight); turns through the density-aware
 * `turnHi` / `turnFrame` (never `turnFlash` / the `ringStrip` turn on a 2× buffer).
 */

/** Rows drawn into a buffer of exactly w × h (rows may be shorter: transparent to the right). */
function hiRows(rows: readonly string[], key: Readonly<Record<string, Color>>, w: number, h: number): PixelBuffer {
  // A row past the box would be cut silently: fail loudly (the registry lists the id as 'id@2x').
  if (rows.length > h || rows.some((r) => r.length > w)) throw new Error(`2× rows exceed ${w}×${h}`);
  return new PixelBuffer(w, h).blit(ascii(rows, key), 0, 0);
}

/** The 2× rocket (28×10): a white-hot exhaust, gold fins, a steel body lit from above, a crimson band and nose. */
function rocketBitmapHi(): PixelBuffer {
  return hiRows(
    [
      '.....Ff', //
      '....FFff',
      '..eEFFssssssssssnnnnssnnn',
      '.eEWfFSSSSSSSSSSbbbbSSnnnn',
      'eEWWffSSSSSSSSSSbbbbSSNNNNnn',
      'eEWWffSSSSSSSSSSBBBBSSNNNNN',
      '.eEWfFddddddddddBBBBddNNNN',
      '..eEFFDDDDDDDDDDBBBBDDBBB',
      '....FFff',
      '.....ff',
    ],
    {
      W: PAL.snow[3],
      E: PAL.gold[3],
      e: PAL.gold[2],
      f: PAL.gold[1],
      F: PAL.gold[2],
      s: PAL.steel[4],
      S: PAL.steel[3],
      d: PAL.steel[2],
      D: PAL.steel[1],
      n: PAL.red[3],
      b: PAL.red[2],
      N: PAL.red[2],
      B: PAL.red[1],
    },
    28,
    10,
  );
}

/** The 2× homing missile (24×6): the ivory capsule, a sky band, a red nose, a gold exhaust. */
function homingBitmapHi(): PixelBuffer {
  return hiRows(
    [
      '...vvvvvvvvvvvvvqqq', //
      '..vwwwwwwwwwwwwwqqqq',
      'EEwwwwwwwwbbwwwwRRRRRRqq',
      'eewwwwwwwwbbwwwwRRRRRRq',
      '..dddddddddddddddrrrr',
      '...ddddddddddddd.rr',
    ],
    {
      E: PAL.gold[3],
      e: PAL.gold[2],
      v: PAL.snow[3],
      w: PAL.snow[2],
      d: PAL.snow[0],
      b: PAL.sky[1],
      q: PAL.red[3],
      R: PAL.red[2],
      r: PAL.red[1],
    },
    24,
    6,
  );
}

/** The 2× twin of `directionStrip(src1)`: the 2× source turned the same way, outlined 2 px. */
function directionStripHi(src1: PixelBuffer, src2: PixelBuffer): Frame[] {
  const lo = directionStrip(src1);
  const padded = src2.padded(2 * HI);
  return lo.map((f, i) => turnHi(padded, (i / 16) * Math.PI * 2, f, { outline: INK }));
}

/** The bounce mine at 2×: a lit dome, a shaded gold band whose rivets turn, a blinking light with a spark. */
function mineFramesHi(): Frame[] {
  const lo = mineFrames();
  return [0, 1, 2, 3].map((i) => {
    const b = hiRows(
      [
        '....ssssSSSSSS', //
        '..ssSSSSSSSSSSSSSd',
        '..sSSSSSSSSSSSSSdd',
        '..SSSSSSSSSSSStddd',
        'GGGGGGGGGGGGGGGGGG',
        'gggggggggggggggggg',
        '..dddddddddddddd',
        '..dddddddddddddD',
        '....ddddddddDD',
        '.....DDDDDDDD',
      ],
      { s: PAL.steel[4], S: PAL.steel[3], t: PAL.steel[2], d: PAL.steel[2], D: PAL.steel[1], g: PAL.gold[1], G: PAL.gold[2] },
      18,
      10,
    );
    // Rivets travel along the band (the disc spins): lit on top, shaded below.
    for (let x = 0; x < 9; x++) {
      if ((x + i) % 3 !== 0) continue;
      b.rect(x * HI, 4, HI, 1, PAL.gold[3]);
      b.rect(x * HI, 5, HI, 1, PAL.gold[2]);
    }
    const out = b.padded(HI, 2 * HI, HI, HI);
    const on = i < 2;
    out.rect(10, 2, HI, HI, on ? PAL.red[3] : PAL.red[1]);
    out.set(10, 2, on ? PAL.snow[3] : PAL.red[2]);
    if (on) {
      out.set(10, 1, PAL.gold[3]);
      out.set(11, 1, PAL.gold[3]);
      out.set(11, 0, PAL.gold[3]);
    }
    return asHi(outlineHi(out, HI), lo[i]);
  });
}

/** The hand grenade at 2×: a shaded olive ball, a 2-px gold band that turns, a tiny swan stencil, a steel cap. */
function grenadeFramesHi(): Frame[] {
  const lo = grenadeFrames();
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(8 * HI, 9 * HI);
    b.sphere(8, 10, 6, [PAL.olive[0], PAL.olive[1], PAL.olive[2], PAL.olive[3]], { dither: false });
    // Band through the centre (between 2× px 8 and 9): horizontal, diagonal, vertical, other diagonal.
    for (let k = -7; k <= 6; k++) {
      for (let t = 0; t < 2; t++) {
        const [x, y] =
          i === 0 ? [8 + k, 9 + t] : i === 1 ? [8 + k + t, 9 - k] : i === 2 ? [7 + t, 10 + k] : [8 + k + t, 10 + k];
        if (b.get(x, y) & 255) b.set(x, y, k < 0 ? PAL.gold[2] : PAL.gold[1]);
      }
    }
    // The swan stencil (a body and a neck, 3 white px) turning on the ball.
    const st: ReadonlyArray<readonly [number, number, number, number]> = [
      [5, 8, 1, -1],
      [10, 8, -1, -1],
      [10, 12, -1, 1],
      [5, 12, 1, 1],
    ];
    const [sx, sy, fx, fy] = st[i];
    b.set(sx, sy, PAL.snow[3]);
    b.set(sx + fx, sy, PAL.snow[3]);
    b.set(sx + fx, sy + fy, PAL.snow[3]);
    // Steel cap and lever on top.
    b.rect(8, 2, HI, HI, PAL.steel[3]);
    b.set(8, 2, PAL.steel[4]);
    b.rect(10, 2, HI, HI, PAL.steel[2]);
    b.set(11, 3, PAL.steel[1]);
    return asHi(outlineHi(b, HI), lo[i]);
  });
}

/** The nozzle's pilot flame at 2× (additive, no outline): rounder rings and a 2 × 2 white core. */
function flameGlowFramesHi(): Frame[] {
  const lo = flameGlowFrames();
  return [0, 1].map((i) => {
    const b = new PixelBuffer(9 * HI, 9 * HI);
    const p = new HiPen(b, 0, 0);
    p.circle(4, 4, 3 - i, PAL.orange[2]);
    p.circle(4, 4, 2 - i, PAL.gold[3]);
    p.px(4, 4, PAL.snow[3]);
    if (i === 0) p.dot(3.5, 3.5, PAL.snow[3]);
    return asHi(b, lo[i]);
  });
}

/** The laser's muzzle star at 2× (additive): 2-px rays with dimmer 1-px tips, a round white core. */
function laserFlareFramesHi(): Frame[] {
  const lo = laserFlareFrames();
  return [0, 1].map((i) => {
    const b = new PixelBuffer(11 * HI, 11 * HI);
    const p = new HiPen(b, 0, 0);
    const s = 4 - i;
    p.hline(5 - s, 5 + s, 5, PAL.teal[3]);
    p.vline(5, 5 - s + 1, 5 + s - 1, PAL.teal[3]);
    // Thin tips: the outermost 2× px of each ray in the dimmer teal.
    for (const y of [10, 11]) {
      b.set((5 - s) * HI, y, PAL.teal[2]);
      b.set((5 + s) * HI + 1, y, PAL.teal[2]);
    }
    for (const x of [10, 11]) {
      b.set(x, (5 - s + 1) * HI, PAL.teal[2]);
      b.set(x, (5 + s - 1) * HI + 1, PAL.teal[2]);
    }
    p.circle(5, 5, 2, PAL.teal[3]);
    p.circle(5, 5, 1, PAL.snow[3]);
    if (i === 0) {
      // Diagonal glints: short 1-px lines pointing at the core.
      for (const [x, y, dx, dy] of [[6, 6, 1, 1], [15, 6, -1, 1], [15, 15, -1, -1], [6, 15, 1, -1]] as const) {
        b.set(x, y, PAL.teal[2]);
        b.set(x + dx, y + dy, PAL.teal[2]);
      }
    }
    return asHi(b, lo[i]);
  });
}

/** Where the beam hits, at 2× (additive): the same crackling burst with fine sparks and a round core. */
function laserHitFramesHi(): Frame[] {
  const lo = laserHitFrames();
  const rows: string[][] = [
    [
      '.........c',
      '........cT',
      '....c...TT...c',
      '.....c..TT..c',
      '.......TWWT',
      '......TWWWWT',
      'ccTTTTWWWWWWTTTTc',
      '.cTTTTWWWWWWTTTTcc',
      '......TWWWWT',
      '.......TWWT',
      '.....c..TT..c',
      '....c...TT...c',
      '........Tc',
      '........c',
    ],
    [
      '....c........c',
      '.....c......c',
      '......c.TT.c',
      '.......cTTc',
      '....TTTTWWTTTT',
      '....TTTWWWWTTT',
      '..cTTTWWWWWWTTTc',
      '..cTTTWWWWWWTTTc',
      '....TTTWWWWTTT',
      '....TTTTWWTTTT',
      '.......cTTc',
      '......c.TT.c',
      '.....c......c',
      '....c........c',
    ],
    [
      '',
      '',
      '..c.....TT.....c',
      '...c....TT....c',
      '.......TWWT',
      '......TWWWWT',
      '.....TWWWWWWT',
      '.....TWWWWWWT',
      '......TWWWWT',
      '.......TWWT',
      '...c....TT....c',
      '..c.....TT.....c',
    ],
  ];
  const key = { c: PAL.teal[2], T: PAL.teal[3], W: PAL.snow[3] };
  return rows.map((r, i) => asHi(hiRows(r, key, 18, 14).padded(HI), lo[i]));
}

/** Flash families at 2×: per frame rows (pointing right), exactly twice the 1× rows. */
const FLASHES_HI: Readonly<Record<string, readonly (readonly string[])[]>> = {
  shotgun: [
    [
      '..y............y',
      '...yy.........yy',
      '....yY......Yy......o',
      '.....yYY..YYy......oO',
      'YYWWWWWWWWWWWWYYYYyyOOoo..o',
      'YWWWWWWWWWWWWWWYYYyyyOOo...oo',
      'WWWWWWWWWWWWWWWWYYYYyyyyOOoo',
      'WWWWWWWWWWWWWWWWYYYyyyyOOOoo',
      'YWWWWWWWWWWWWWWYYYyyyOOo...oo',
      'YYWWWWWWWWWWWWYYYYyyOOoo..o',
      '.....yYY..YYy......oO',
      '....yY......Yy......o',
      '...yy.........yy',
      '..y............y',
    ],
    [
      '',
      '',
      '......y.......y',
      '.......y.....yy',
      '..YYYYWWWWYYYYyyyyoooo',
      '.YYWWWWWWWWYYYYyyyyoooo',
      'YYWWWWWWWWWWYYYYyyyyOOoo',
      'YWWWWWWWWWWYYYYyyyyOOooo',
      '.YYWWWWWWWWYYYYyyyyoooo',
      '..YYYYWWWWYYYYyyyyoooo',
      '.......y.....yy',
      '......y.......y',
    ],
    [
      '',
      '',
      '',
      '',
      '....sSSSSs..s',
      '...sSSSSSSs.ss',
      '..sSSSSSSSSskks',
      '..ssSSSSSSsskkss',
      '...ssSSSSss.ss',
      '....ssssss..s',
    ],
  ],
  'rocket-launcher': [
    [
      '.....yYYy',
      '....yYYYYyy',
      '..yyYWWWWYYoo',
      '.yYWWWWWWWYYOo',
      'YYWWWWWWWWWWYYOOoo',
      'YWWWWWWWWWWWYYOOo',
      '.yYWWWWWWWYYOo',
      '..yyWWWWWYYoo',
      '....yyYYYyo',
      '.....yyyy',
    ],
    ['', '', '.....yYYYo', '....yYYYYYoo', '..yYYWWWWYYOO', '..yyYWWWWYYOo', '....yYYYYYoo', '.....yyyyo'],
    ['', '', '.......sS', '......sSSs', '.....SSSSSs', '....sSSSSss', '......sSss', '.......ss'],
  ],
  flamethrower: [
    ['...yYY', '..yYWWYo', 'YYWWWWWYYoo', 'YWWWWWYYYoo', '..yYWWYo', '...yyY'],
    ['...y', '..yY', 'YYWWYYoo', 'YWWYYYoo', '..yY', '...y'],
  ],
  laser: [
    ['....c', '....cc', '...cCCc', '..cCWCCc', 'ccCWWWWCcc', 'ccCCWWCCcc', '..cCCCCc', '...cCCc', '....cc', '.....c'],
    ['', '', '....cc', '...cCCc', '..cCWWCc', '..cCWWCc', '...cCCc', '....cc'],
  ],
  homing: [
    ['..yYWWo', '.YYWWWYo', 'YWWWWWYYoo', 'YYWWWYYoo', '', '', 'YYWWWWYYoo', 'YWWWWYYYoo', '.YYWWWYo', '..yYWWo'],
    ['', '', '..YYYo', '.yYYYoo', '', '', '.yYYYoo', '..yYYo'],
  ],
  tuba: [
    [
      '....YY',
      '...yYY',
      '...yYY....YY',
      '..yyYY....yYY',
      '..yyYY....yyYY',
      '..yyYY.....yYY',
      '..yyYY.....yYY',
      '..yyYY.....yYY',
      '..yyYY.....yYY',
      '..yyYY....yyYY',
      '..yyYY....yYY',
      '...yYY....YY',
      '...yYY',
      '....YY',
    ],
    [
      '',
      '',
      '....YY',
      '....yYY',
      '....yyYY....YY',
      '....yyYY....yYY',
      '....yyYY....yYY',
      '....yyYY....yYY',
      '....yyYY....yYY',
      '....yyYY....YY',
      '....yYY',
      '....YY',
    ],
  ],
  'bounce-mine': [
    ['..SSSS', '.SSSSSS', 'SSSSSSSSs', 'SSSSSSSsss', '.sSSSsss', '..ssss'],
    ['', '', '...sSSs', '..sSSSss', '...ssss', '....ss'],
  ],
};

/** The 2× twin of `flashFrame`: rows of exactly twice the 1× size, the outline 2 px. */
function flashFrameHi(rows: readonly string[], base: Frame, outline: Color | null): Frame {
  const b = hiRows(rows, FIRE_KEY, base.buf.w * HI - 2 * HI, base.buf.h * HI - 2 * HI).padded(HI);
  if (outline !== null) outlineHi(b, HI, outline);
  return asHi(b, base);
}

const flashOpts: SpriteOpts = { ticksPerFrame: 2, loop: false };

export function defineShotSprites(): void {
  const rocketHi = (): Frame[] => directionStripHi(rocketBitmap(), rocketBitmapHi());
  const homingHi = (): Frame[] => directionStripHi(homingBitmap(), homingBitmapHi());
  defineSprite('weapon/rocket', () => directionStrip(rocketBitmap()), { hi: rocketHi });
  defineSprite('weapon/homing', () => directionStrip(homingBitmap()), { hi: homingHi });
  defineSprite('weapon/homing-missile', () => directionStrip(homingBitmap()), { hi: homingHi });
  defineSprite('weapon/tuba-ring', () => ringStrip(false), { ticksPerFrame: 4, hi: () => ringStripHi(false) });
  defineSprite('weapon/tuba-ring-up', () => ringStrip(true), { ticksPerFrame: 4, hi: () => ringStripHi(true) });
  defineSprite('weapon/mine-disc', mineFrames, { ticksPerFrame: 3, hi: mineFramesHi });
  defineSprite('weapon/grenade', grenadeFrames, { ticksPerFrame: 3, hi: grenadeFramesHi });
  defineSprite('weapon/flame', () => flameFrames(), { ticksPerFrame: 2, hi: () => flameFrames(HI) });
  defineSprite('weapon/flame-glow', flameGlowFrames, { ticksPerFrame: 2, hi: flameGlowFramesHi });
  defineSprite('weapon/laser-flare', laserFlareFrames, { ticksPerFrame: 2, hi: laserFlareFramesHi });
  defineSprite('weapon/laser-hit', laserHitFrames, { ticksPerFrame: 2, hi: laserHitFramesHi });

  for (const [id, f] of Object.entries(FLASHES)) {
    const fwd = (): Frame[] => f.frames.map((rows) => flashFrame(rows, FIRE_KEY, f.outline));
    const fwdHi = (): Frame[] => {
      const lo = fwd();
      return FLASHES_HI[id].map((rows, i) => flashFrameHi(rows, lo[i], f.outline));
    };
    defineSprite(`fx/muzzle-${id}`, fwd, { ...flashOpts, hi: fwdHi });
    defineSprite(`fx/muzzle-${id}-up`, () => fwd().map((fr) => turnFlash(fr, 'up')), {
      ...flashOpts,
      hi: () => fwdHi().map((fr) => turnFrame(fr, -1)),
    });
    defineSprite(`fx/muzzle-${id}-diag`, () => fwd().map((fr) => turnFlash(fr, 'diag')), {
      ...flashOpts,
      hi: () => {
        const lo = fwd();
        return fwdHi().map((fr, i) => turnHi(fr.buf, -Math.PI / 4, turnFlash(lo[i], 'diag')));
      },
    });
  }
}
