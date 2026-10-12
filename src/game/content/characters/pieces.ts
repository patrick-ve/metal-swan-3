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
import type { Frame } from '../../../engine/render';
import { withPieces, type Piece } from '../../art/human-fx';

const cache = new Map<string, PixelBuffer>();

/** Build (once) an outlined piece from ascii rows. */
function piece(name: string, rows: readonly string[], key: Readonly<Record<string, Color>>, outline = true): PixelBuffer {
  let b = cache.get(name);
  if (!b) {
    const raw = ascii(rows as string[], key);
    // One px of room on every side for the outline.
    b = new PixelBuffer(raw.w + 2, raw.h + 2);
    b.blit(raw, 1, 1);
    if (outline) b.outline(INK);
    cache.set(name, b);
  }
  return b;
}

/** Grace's pocket watch: a gold case with a white face and a chain. */
export function pocketWatch(): PixelBuffer {
  return piece('watch', ['.gg.', 'gWwg', 'gwWg', '.gg.'], { g: PAL.gold[2], W: PAL.snow[3], w: PAL.snow[1] });
}

/** A ball of red yarn (Mittens). */
export function yarnBall(): PixelBuffer {
  return piece('yarn', ['.rR.', 'rRrR', 'rrRr', '.rr.'], { r: PAL.red[1], R: PAL.red[3] });
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
  if (size === 0) return piece('bubble0', ['Pp', 'pp'], key);
  if (size === 1) return piece('bubble1', ['.Pp.', 'Pwpp', 'pppp', '.pp.'], key);
  return piece('bubble2', ['..PPp..', '.PwPppp.', 'PwPpppp', 'PPppppp', 'ppppppp', '.ppppp.', '..ppp..'], key);
}

/** The popped bubble: pink gum splattered over a face (no outline: it sits on the face). */
export function gumSplat(): PixelBuffer {
  return piece('splat', ['.p.pp.', 'pPppPp', 'ppPppp', '.pp.p.'], { p: PAL.pink[1], P: PAL.pink[2] }, false);
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
  return piece('scarf-end', ['wW.', 'WwW', '.ww', '..w'], { w: PAL.snow[1], W: PAL.snow[3] });
}

/** A polishing rag (cloth). */
export function rag(): PixelBuffer {
  return piece('rag', ['cCc', 'Ccc', '.cC'], { c: PAL.cloth[1], C: PAL.cloth[3] });
}

/** A sparkle star (no outline: it glows). */
export function sparkle(big: boolean): PixelBuffer {
  const key = { w: PAL.snow[3], y: PAL.gold[3] };
  return big ? piece('sparkle-big', ['..y..', '..w..', 'ywwwy', '..w..', '..y..'], key, false) : piece('sparkle', ['.y.', 'ywy', '.y.'], key, false);
}

/** A dust puff (cartoon cloud) of size 0 (small) or 1 (big). */
export function dustPuff(size: 0 | 1): PixelBuffer {
  const key = { s: PAL.stone[2], S: PAL.stone[3] };
  return size === 0
    ? piece('dust0', ['.SS.S.', 'SSsSSs', '.sssS.'], key)
    : piece('dust1', ['..SS..SS..', '.SSSsSSSs.', 'SSsssSSssS', '.ssssssss.'], key);
}

/** Pink puffs of helium (the head deflates). */
export function heliumPuff(): PixelBuffer {
  return piece('helium-puff', ['.pP.', 'pPPp', '.pp.'], { p: PAL.pink[1], P: PAL.pink[2] });
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

/** Mirror a full-body frame about its anchor (a spin frame: the figure faces the other way). */
export function mirrored(f: Frame): Frame {
  const buf = f.buf.flipped(true, false);
  const pts: Record<string, readonly [number, number]> = {};
  for (const [k, p] of Object.entries(f.pts ?? {})) pts[k] = [-p[0], p[1]];
  return { buf, ox: f.buf.w - 1 - f.ox, oy: f.oy, pts };
}
