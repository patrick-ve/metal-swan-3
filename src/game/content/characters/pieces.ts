/**
 * Small hand-drawn props the heroes use in their fidgets, victories and deaths (GDD §3.1–§3.4),
 * stacked onto rig frames with `withPieces` (docs/ART_GUIDE.md "Props and instruments"). Every
 * piece is a tiny ascii drawing with its own 1-px INK outline (withPieces does not outline),
 * built once and cached. Letters per piece are listed in its key.
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import { frameW, type Frame } from '../../../engine/render';
import { setHiTwin, withPieces, type Piece } from '../../art/human-fx';
import { outlineHi } from '../../art/hi';

const cache = new Map<string, PixelBuffer>();

/**
 * Build (once) an outlined piece from ascii rows. `hiRows` (mission ams, docs/ART_GUIDE.md "2x
 * art (mission ams)"): a hand-drawn 2× twin, exactly twice the 1× rows, with the same key plus
 * any extra letters in `hiKey`; it gets the 2-px outline and is registered with `setHiTwin`, so
 * `withPieces` draws it on 2× frames.
 */
function piece(
  name: string,
  rows: readonly string[],
  key: Readonly<Record<string, Color>>,
  outline = true,
  hiRows?: readonly string[],
  hiKey: Readonly<Record<string, Color>> = {},
): PixelBuffer {
  let b = cache.get(name);
  if (!b) {
    const raw = ascii(rows as string[], key);
    // One px of room on every side for the outline.
    b = new PixelBuffer(raw.w + 2, raw.h + 2);
    b.blit(raw, 1, 1);
    if (outline) b.outline(INK);
    cache.set(name, b);
    if (hiRows) {
      if (hiRows.length !== raw.h * 2 || hiRows.some((r) => r.length !== raw.w * 2)) {
        throw new Error(`2× piece ${name}: ${hiRows[0]?.length ?? 0}×${hiRows.length}, expected ${raw.w * 2}×${raw.h * 2}`);
      }
      const rawHi = ascii(hiRows as string[], { ...key, ...hiKey });
      const hb = new PixelBuffer(b.w * 2, b.h * 2);
      hb.blit(rawHi, 2, 2);
      if (outline) outlineHi(hb, 2);
      setHiTwin(b, hb);
    }
  }
  return b;
}

/** Grace's pocket watch: a gold case with a white face and a chain. */
export function pocketWatch(): PixelBuffer {
  return piece('watch', ['.gg.', 'gWwg', 'gwWg', '.gg.'], { g: PAL.gold[2], W: PAL.snow[3], w: PAL.snow[1] });
}

/** A ball of red yarn (Mittens). */
export function yarnBall(): PixelBuffer {
  // 2×: wound strands (1-px dark lines) across a ball lit from the top-left.
  return piece('yarn', ['.rR.', 'rRrR', 'rrRr', '.rr.'], { r: PAL.red[1], R: PAL.red[3] }, true, [
    '..RRRr..',
    '.RRrRRr.',
    'RRrRRrrd',
    'RrRRrrdr',
    'rRRrrdrr',
    'rrrrdrrd',
    '.rrdrrd.',
    '..rrdd..',
  ], { d: PAL.red[0] });
}

/** A few rows of knitting hanging off the needles (cream with a red stripe). */
export function knitting(): PixelBuffer {
  return piece('knitting', ['ccc', 'rrr', 'ccc'], { c: PAL.snow[2], r: PAL.red[2] });
}

/** Mittens' freshly knitted tiny swan: cream body, red scarf stripe, orange beak. */
export function knittedSwan(): PixelBuffer {
  return piece(
    'knit-swan',
    ['...ww.', '...wwo', '....w.', 'wwwww.', 'wrrrw.', '.www..'],
    { w: PAL.snow[2], r: PAL.red[2], o: PAL.orange[2] },
  );
}

/** Mittens' bobble hat on its own (it pops off in his death). */
export function bobbleHat(): PixelBuffer {
  return piece('bobble', ['..rR..', '..rr..', '.cCCc.', 'cCCCcc', 'rRrRrr', 'cccccc'], {
    r: PAL.red[1],
    R: PAL.red[3],
    c: PAL.snow[1],
    C: PAL.snow[3],
  });
}

/** Pip's steel helmet on its own (it bounces off in his death). */
export function helmet(): PixelBuffer {
  return piece('helmet', ['..sSSs..', '.sSSSSs.', 'ssssssss'], { s: PAL.steel[2], S: PAL.steel[4] });
}

/** Bubble-gum bubbles for Pip's fidget: size 0 (small) … 2 (big). */
export function bubble(size: 0 | 1 | 2): PixelBuffer {
  const key = { p: PAL.pink[1], P: PAL.pink[2], w: PAL.snow[3] };
  // 2×: a round bubble with a 1-px glint at the top-left and a darker rim at the bottom-right.
  const dk = { d: PAL.pink[0] };
  if (size === 0) return piece('bubble0', ['Pp', 'pp'], key, true, ['.Pp.', 'PwPp', 'Pppp', '.pd.'], dk);
  if (size === 1) {
    return piece('bubble1', ['.Pp.', 'Pwpp', 'pppp', '.pp.'], key, true, [
      '..PPpp..',
      '.PwPPpp.',
      'PwPPpppp',
      'PPPppppp',
      'Pppppppp',
      'pppppppd',
      '.ppppdd.',
      '..pddd..',
    ], dk);
  }
  return piece('bubble2', ['..PPp..', '.PwPppp.', 'PwPpppp', 'PPppppp', 'ppppppp', '.ppppp.', '..ppp..'], key, true, [
    '....PPPpp.......',
    '..PPPPPPpppp....',
    '..PwwPPPppppp...',
    '.PwPPPPpppppp...',
    'PwPPPPppppppp...',
    'PPPPPppppppppp..',
    'PPPPpppppppppp..',
    'PPPppppppppppp..',
    'Ppppppppppppp...',
    'pppppppppppppd..',
    '.pppppppppppdd..',
    '.ppppppppppdd...',
    '...ppppppddd....',
    '....pppddd......',
  ], dk);
}

/** The popped bubble: pink gum splattered over a face (no outline: it sits on the face). */
export function gumSplat(): PixelBuffer {
  return piece('splat', ['.p.pp.', 'pPppPp', 'ppPppp', '.pp.p.'], { p: PAL.pink[1], P: PAL.pink[2] }, false, [
    '..p...pp....',
    '.ppp.pPPp...',
    '.pPpppPpppp.',
    'ppPPppppPpp.',
    'pppppPpppppp',
    '.ppPpppppPp.',
    '..pp..ppp...',
    '...p...p....',
  ]);
}

/** Gramps' screwdriver: steel shaft, red handle. */
export function screwdriver(): PixelBuffer {
  return piece('screwdriver', ['rR33', 'rr2.'], { r: PAL.red[1], R: PAL.red[3], '3': PAL.steel[3], '2': PAL.steel[2] });
}

/** Gramps' dentures: open (chattering) or shut. */
export function dentures(open: boolean): PixelBuffer {
  const key = { t: PAL.snow[3], g: PAL.pink[2] };
  return open ? piece('dentures-open', ['gttg', '....', 'gttg'], key) : piece('dentures', ['gttg', 'gttg'], key);
}

/** The end of Grace's ivory scarf, bunched in a hand (boot polish). */
export function scarfEnd(): PixelBuffer {
  // 2×: the bunched cloth with 1-px fold lines and a frayed end.
  return piece('scarf-end', ['wW.', 'WwW', '.ww', '..w'], { w: PAL.snow[1], W: PAL.snow[3] }, true, [
    'wWWW..',
    'WWWw..',
    'WWfWWW',
    'WfWWww',
    '..wwWw',
    '..wfww',
    '....fw',
    '....w.',
  ], { f: PAL.snow[0] });
}

/** A polishing rag (cloth). */
export function rag(): PixelBuffer {
  return piece('rag', ['cCc', 'Ccc', '.cC'], { c: PAL.cloth[1], C: PAL.cloth[3] });
}

/** A sparkle star (no outline: it glows). */
export function sparkle(big: boolean): PixelBuffer {
  const key = { w: PAL.snow[3], y: PAL.gold[3] };
  // 2×: thin twinkle rays (1-px gold tips) round a white core.
  return big
    ? piece('sparkle-big', ['..y..', '..w..', 'ywwwy', '..w..', '..y..'], key, false, [
        '....y.....',
        '....w.....',
        '....ww....',
        '...wwww...',
        'ywwwwwwww.',
        '.wwwwwwwwy',
        '...wwww...',
        '....ww....',
        '.....w....',
        '.....y....',
      ])
    : piece('sparkle', ['.y.', 'ywy', '.y.'], key, false, ['...y..', '..ww..', '.wwwwy', 'ywwww.', '..ww..', '..y...']);
}

/** A dust puff (cartoon cloud) of size 0 (small) or 1 (big). */
export function dustPuff(size: 0 | 1): PixelBuffer {
  const key = { s: PAL.stone[2], S: PAL.stone[3] };
  // 2×: rounder puffs, lit on top, a 1-px shadow along the underside.
  const dk = { d: PAL.stone[1] };
  return size === 0
    ? piece('dust0', ['.SS.S.', 'SSsSSs', '.sssS.'], key, true, [
        '..SSS...SS..',
        '.SSSSS.SSSs.',
        'SSSSsSSSSSss',
        'SSsssSSSssss',
        '.sssssssssd.',
        '..ddsssddd..',
      ], dk)
    : piece('dust1', ['..SS..SS..', '.SSSsSSSs.', 'SSsssSSssS', '.ssssssss.'], key, true, [
        '....SSS.....SSS.....',
        '...SSSSS...SSSSSs...',
        '..SSSSSSssSSSSSSss..',
        '.SSSSsssssSSSSssss..',
        'SSSsssssSSSssssssSSs',
        'SSssssssSsssssssssss',
        '.sssssssssssssssssd.',
        '..dddsssssddsssddd..',
      ], dk);
}

/** Pink puffs of helium (the head deflates). */
export function heliumPuff(): PixelBuffer {
  return piece('helium-puff', ['.pP.', 'pPPp', '.pp.'], { p: PAL.pink[1], P: PAL.pink[2] });
}

// ------------------------------------------------------------------------------------ the squad

/** Vincent's battle plan, unrolled: cream paper, a blue route with arrows, red target crosses. */
export function planSheet(): PixelBuffer {
  return piece('plan-sheet', ['PPPPPPP', 'PbPPRPP', 'PPbPPPP', 'PPPbbbR', 'ppppppp'], { P: PAL.sand[3], p: PAL.sand[2], b: PAL.sky[1], R: PAL.red[2] }, true, [
    'PPPPPPPPPPPPPP',
    'PPPPPPPPPPPPPP',
    'PPbPPPPPRPPRPP',
    'PPbbPPPPPRRPPP',
    'PPPbbPPPPRRPPP',
    'PPPPbbPPRPPRPP',
    'PPPPPbbPPPPPPP',
    'PPPPPPbbbbbbRR',
    'pppppppppppppp',
    'pPpppppppppPpp',
  ]);
}

/** Bob's boarding pass: a blue stub and a white ticket with a barcode. */
export function boardingPass(): PixelBuffer {
  return piece('boarding-pass', ['bbSSS', 'bbS1S', 'bbSSS'], { b: PAL.sky[1], S: PAL.snow[3], '1': PAL.steel[1] }, true, [
    'bbbSSSSSSS',
    'bBbSS1S1SS',
    'bbbSSSSSSS',
    'bBbS1S1S1S',
    'bbbSSSSSSS',
    'bbbSSSSSSS',
  ], { B: PAL.sky[2] });
}

/** Patrick's pocket device: a small glowing screen (the outline is its bezel). */
export function pocketDevice(): PixelBuffer {
  return piece('pocket-device', ['cCc', 'ccc'], { c: PAL.teal[3], C: PAL.snow[3] }, true, ['ccCCcc', 'cCCccc', 'cccccc', 'ccctcc'], { t: PAL.teal[2] });
}

/** The device's glow on the face (no outline: light). */
export function deviceGlow(): PixelBuffer {
  return piece('device-glow', ['c.', '.c'], { c: PAL.teal[3] }, false, ['c...', '.c..', '..c.', '...c']);
}

// ------------------------------------------------------------------------------------ placing

/** Point of a frame (relative to its anchor), or the fallback. */
export function pt(f: Frame, name: string, fb: readonly [number, number]): [number, number] {
  const p = f.pts?.[name];
  return p ? [p[0], p[1]] : [fb[0], fb[1]];
}

/** Put `buf` centred on (x, y) relative to the frame anchor. */
export function at(buf: PixelBuffer, x: number, y: number, behind = false): Piece {
  return { buf, x: Math.round(x - buf.w / 2), y: Math.round(y - buf.h / 2), behind };
}

/** Put `buf` standing on line y (default the ground line y = 0): its lowest row is y − 1. */
export function onGround(buf: PixelBuffer, x: number, y = 0): Piece {
  return { buf, x: Math.round(x - buf.w / 2), y: y - buf.h };
}

/** Stack pieces onto frame i (null = keep the frame). */
export function decorateFrames(frames: readonly Frame[], fn: (f: Frame, i: number) => Piece[] | null): Frame[] {
  return frames.map((f, i) => {
    const p = fn(f, i);
    return p && p.length ? withPieces(f, p) : f;
  });
}

/**
 * Mirror a full-body frame about its anchor (a spin frame: the figure faces the other way).
 * Works on 2× frames too: the anchor and pts are logical px, so the logical width is used.
 */
export function mirrored(f: Frame): Frame {
  const buf = f.buf.flipped(true, false);
  const pts: Record<string, readonly [number, number]> = {};
  for (const [k, p] of Object.entries(f.pts ?? {})) pts[k] = [-p[0], p[1]];
  const out: Frame = { buf, ox: frameW(f) - 1 - f.ox, oy: f.oy, pts };
  return f.density === undefined ? out : { ...out, density: f.density };
}
