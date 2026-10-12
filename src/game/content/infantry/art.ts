/**
 * Content category "infantry": sprite definitions only (docs/ARCHITECTURE.md §6.1, §7).
 * Enemy foot soldiers are rig styles registered with defineSoldierSprites
 * (docs/ART_GUIDE.md §5), plus the extra soldier strips of GDD §9.0 / §15.6 built here.
 *
 * ┌─ SHARED SOLDIER ART KIT (rhythm/art.ts, winds/art.ts import it) ───────────────────────────
 * │ Outfits (GDD §9.0, `params.outfit`): `outfitStyle(style, outfit, { keepHat })` — deck (white
 * │   cap, navy sailor collar), desert (sand headgear, sand shirt sleeves), snow (brown hood, red
 * │   greatcoat), night (black tunic, gold trim); `keepHat` keeps a type's own headgear (only its
 * │   colour changes); `OUTFIT_HAT[outfit]` = the hat ramp for hats drawn as pieces; `OUTFITS`.
 * │   Register a variant as `enemy/<id>-<outfit>/…` (the game picks it with `outfitArt`).
 * │ Extra strips: `defineSoldierExtras(id, look)` registers `double-take` (4f), `salute` (2f),
 * │   `confused` (4f), `queue` (2f, a coin), `photo-pose` (1f, a peace sign), `ears` (2f),
 * │   `stumble` (4f), `frozen` (2f), `die-crush` (5f), `die-shatter` (4f), `slip` (4f), `skate`
 * │   (4f), `ski` (2f), `ski-crash` (3f), `emerge` (5f) and `hat` (4 tumble frames, feet
 * │   anchor) for `enemy/<id>/`. A `SoldierLook` says how he holds his weapon or instrument:
 * │   `carry` / `oneHand` (near hand free) / `noHands` pose fields, an optional `dress(frame, pose,
 * │   hold, strip)` that adds instrument pieces, `dropped` (lies at his feet in `ears`), `hat`.
 * │ Geometry and pieces: `handsOf(frame, pose)` (both wrists — the rig only gives the near
 * │   `hand`), `handOffset(arm)`, `pieceAt(buf, at, px, py, behind?)`, `outlined(buf)`,
 * │   `handPiece(shape, glove, quarter)` (+ `HAND_WRIST`), `peaceSign(glove)`, `coinArt()`,
 * │   `headgearArt(style)` (the rig's headgear alone), `hatFrames(hat)`.
 * │ Frame effects: `frozenFrame(f, glint)`, `crushFrames(f)`, `shatterFrames(f)`,
 * │   `emergeFrames(f, n)`, `burnStrip(style, base, frames)` (fire death with a 30-tick run).
 * │ Pose tables: `ATTENTION`, `DOUBLE_TAKE`, `SALUTE`, `CONFUSED`, `QUEUE`, `PHOTO`, `EARS`,
 * │   `STUMBLE`, `SLIP`, `SKATE`, `SKI`, `SKI_CRASH`, `CLIMB`.
 * │ Rifleman gags: ./rifleman-gags.art.ts (`gag-<name>` strips + the props `snowman`,
 * │   `snowman-head`, `cone`), registered for every rifleman outfit.
 * └─────────────────────────────────────────────────────────────────────────────────────────────
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, type SpriteOpts } from '../../../engine/sprites';
import { crumble, scorch, sootify, withFlames, withPieces, type Piece } from '../../art/human-fx';
import { blastFrames, defineSoldierSprites } from '../../art/human-sprites';
import { DEFAULT_POSE, renderHuman, type ArmPose, type HandShape, type HumanStyle, type LegPose, type Pose } from '../../art/humanoid';
import { drawHand, gunArt } from '../../art/humanoid-gear';
import { renderHead } from '../../art/humanoid-head';
import { R, type RampLike } from '../../art/paint';
import * as P from '../../art/poses';
import { defineRiflemanGags } from './rifleman-gags.art';

/**
 * `rifleman` — the enemy's basic soldier: crimson tunic with a white cross-belt and brass
 * buttons, white trousers, black boots, tall black shako with a gold badge and plume, white
 * gloves and a proud moustache.
 */
export const RIFLEMAN_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'shako',
  gear: 'black',
  accent: 'gold',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'normal',
  accessories: ['cross-belt'],
  face: ['moustache'],
};

// ---------------------------------------------------------------------------------------------
// Outfits (GDD §9.0: a palette and headgear swap of the same rig)
// ---------------------------------------------------------------------------------------------

export type Outfit = 'parade' | 'deck' | 'desert' | 'snow' | 'night';
export const OUTFITS: readonly Outfit[] = ['parade', 'deck', 'desert', 'snow', 'night'];

export interface OutfitOpts {
  /** Keep the type's own headgear (a busby, a tall shako drawn as a piece): only colours change. */
  keepHat?: boolean;
}

/**
 * The outfit variant of a soldier style. deck (m1): white cap, navy sailor collar (a navy
 * neckerchief + collar trim); desert (m2): sand headgear, sand shirt sleeves under the tunic
 * (rolled up); snow (m3): brown hood, red greatcoat with tails; night (m4–m5): black tunic with
 * gold trim (the `black` ramp, so it stays lighter than the INK outline).
 */
export function outfitStyle(base: HumanStyle, outfit: string, o: OutfitOpts = {}): HumanStyle {
  const acc = base.accessories ?? [];
  switch (outfit) {
    case 'deck':
      return {
        ...base,
        ...(o.keepHat ? { gear: 'snow' } : { headgear: 'cap', gear: 'snow' }),
        accent: 'navy',
        accessories: acc.includes('scarf') ? acc : [...acc, 'scarf'],
      };
    case 'desert':
      return { ...base, gear: 'sand', topType: base.topType === 'tunic' ? 'vest' : base.topType, shirt: 'sand' };
    case 'snow':
      return { ...base, ...(o.keepHat ? { gear: 'brown' } : { headgear: 'hood', gear: 'brown' }), top: 'red', topType: 'coat' };
    case 'night':
      return { ...base, top: 'black', accent: 'gold' };
    default:
      return base;
  }
}

/** Hat colour of each outfit, for hats drawn as pieces (busby, tall shako). */
export const OUTFIT_HAT: Readonly<Record<Outfit, RampLike>> = {
  parade: 'black',
  deck: 'snow',
  desert: 'sand',
  snow: 'brown',
  night: 'black',
};

// ---------------------------------------------------------------------------------------------
// Rig geometry and pieces
// ---------------------------------------------------------------------------------------------

export type V2 = [number, number];
const DEG = Math.PI / 180;

/** Wrist offset from its shoulder for an arm pose — the rig's own IK / FK (upper arm and forearm 6 px). */
export function handOffset(a: ArmPose): V2 {
  if (a.to) {
    const d = Math.hypot(a.to[0], a.to[1]);
    const k = d > 11.99 ? 11.99 / d : 1;
    return [a.to[0] * k, a.to[1] * k];
  }
  const sh = (a.sh ?? 5) * DEG;
  const fe = ((a.sh ?? 5) + (a.el ?? 20)) * DEG;
  return [Math.sin(sh) * 6 + Math.sin(fe) * 6, Math.cos(sh) * 6 + Math.cos(fe) * 6];
}

/**
 * Both wrists of a rendered frame (relative to its anchor), from its pose, the way the rig puts
 * them: shoulders 7 px above the pelvis along the torso, the near one 1 px back, the far one 1 px
 * forward. The rig's `hand` point is only the near one; use this for two-handed props (mallets,
 * cymbals). Poses with `rot` are not supported (use it on upright frames).
 */
export function handsOf(f: Frame, pose: Pose): { near: V2; far: V2 } {
  const hip = f.pts?.hip ?? [0, 0];
  const L = (pose.lean ?? 0) * DEG;
  const k = 7 - (pose.hunch ?? 0);
  const ux = Math.sin(L) * k;
  const uy = -Math.cos(L) * k;
  const fx = Math.cos(L);
  const fy = Math.sin(L);
  const n = handOffset(pose.armN ?? DEFAULT_POSE.armN);
  const r = handOffset(pose.armF ?? DEFAULT_POSE.armF);
  return {
    near: [Math.round(hip[0] + ux - fx + n[0]), Math.round(hip[1] + uy - fy + n[1])],
    far: [Math.round(hip[0] + ux + fx + r[0]), Math.round(hip[1] + uy + fy + r[1])],
  };
}

/** A piece placed so that its pixel (px, py) lands on the frame point `at`. */
export function pieceAt(buf: PixelBuffer, at: readonly [number, number], px: number, py: number, behind = false): Piece {
  return { buf, x: Math.round(at[0] - px), y: Math.round(at[1] - py), behind };
}

/** Pad by one pixel and add the INK outline (pieces are outlined on their own). */
export function outlined(buf: PixelBuffer): PixelBuffer {
  return buf.padded(1).outline(INK);
}

/** Wrist pixel of a `handPiece` buffer. */
export const HAND_WRIST: V2 = [5, 5];

/**
 * A hand drawn as a piece (outlined), wrist at `HAND_WRIST`: for hands that must show in front
 * of the face (salutes, scratching, ears). `quarter` turns it clockwise (0 = fingers forward,
 * 1 = down, 2 = back, 3 = up).
 */
export function handPiece(shape: HandShape, glove: RampLike, quarter = 0): PixelBuffer {
  const b = new PixelBuffer(11, 11);
  drawHand(b, shape, HAND_WRIST[0], HAND_WRIST[1], R(glove), quarter);
  return b.outline(INK);
}

/** A raised V sign (two fingers), outlined; the wrist is the bottom-centre pixel (3, 6). */
export function peaceSign(glove: RampLike): PixelBuffer {
  const g = R(glove);
  return outlined(ascii(['a...a', 'a..a.', '.aba.', '.bbb.', '.bb..'], { a: g[g.length - 1], b: g[2] ?? g[1] }));
}

/** A gold coin (4×4 + outline). */
export function coinArt(): PixelBuffer {
  return outlined(ascii(['.ab.', 'abbc', 'bbcc', '.cc.'], { a: PAL.gold[3], b: PAL.gold[2], c: PAL.gold[1] }));
}

function luma(c: Color): number {
  return (((c >>> 24) & 255) * 299 + ((c >>> 16) & 255) * 587 + ((c >>> 8) & 255) * 114) / 1000;
}

/**
 * The style's headgear alone (no skin, no hair), outlined and trimmed — the hat that pops off on
 * death. Rendered once with stand-in ramps nobody else uses, then recoloured, so black hats on
 * black hair still come out whole. Null for 'none'.
 */
export function headgearArt(style: HumanStyle): PixelBuffer | null {
  if (style.headgear === 'none') return null;
  const gear = R(style.gear ?? 'olive');
  const accent = R(style.accent ?? 'red');
  const base = { skin: R(style.skin), hair: R(style.hair), hairStyle: style.hairStyle, headgear: style.headgear, extras: [] };
  const a = renderHead({ ...base, gear: PAL.pink, accent: PAL.teal }, 'normal');
  const b = renderHead({ ...base, gear: PAL.pink, accent: PAL.teal, hat: false }, 'normal');
  const out = new PixelBuffer(a.w, a.h);
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const c = a.get(x, y);
      if ((c & 255) === 0) continue;
      const gi = PAL.pink.indexOf(c);
      const ai = PAL.teal.indexOf(c);
      if (gi >= 0) out.set(x, y, gear[Math.min(gi, gear.length - 1)]);
      else if (ai >= 0) out.set(x, y, accent[Math.min(ai, accent.length - 1)]);
      else if (c !== b.get(x, y) && (c === PAL.gold[2] || c === PAL.gold[3] || c === INK)) out.set(x, y, c);
    }
  }
  const tb = out.trimBounds();
  if (!tb) return null;
  return outlined(out.crop(tb.x, tb.y, tb.w, tb.h));
}

/** Four tumbling frames of a hat (quarter turns), each anchored at its bottom centre. */
export function hatFrames(hat: PixelBuffer): Frame[] {
  return [0, 1, 2, 3].map((q) => {
    const buf = hat.rotated((q * Math.PI) / 2);
    return { buf, ox: buf.w >> 1, oy: buf.h };
  });
}

// ---------------------------------------------------------------------------------------------
// Frame effects
// ---------------------------------------------------------------------------------------------

/** Ice colour for a pixel brightness (frozen soldiers). */
function iceOf(c: Color): Color {
  const l = luma(c);
  if (l < 45) return PAL.navy[1];
  if (l < 90) return PAL.sky[0];
  if (l < 140) return PAL.sky[1];
  if (l < 200) return PAL.sky[2];
  return PAL.snow[3];
}

/**
 * The figure frozen in a block of ice (GDD §6.3 sundae mortar): a pale block standing on the
 * ground, the soldier inside in ice blues, a white rim on the lit edges and a glint that moves
 * with `glint` (0..3).
 */
export function frozenFrame(f: Frame, glint = 0): Frame {
  const tb = f.buf.trimBounds();
  if (!tb) return f;
  // The block in the source frame's pixels: 2 px around the figure, the bottom on the ground row.
  const bx = tb.x - 2;
  const by = tb.y - 2;
  const bw = tb.w + 4;
  const bh = f.oy - by;
  const out = new PixelBuffer(bw + 2, bh + 2);
  const ox = 1 - bx;
  const oy = 1 - by;
  out.rect(1, 1, bw, bh, PAL.sky[3]);
  for (let y = 0; y < f.buf.h; y++) {
    for (let x = 0; x < f.buf.w; x++) {
      const c = f.buf.get(x, y);
      if ((c & 255) === 0) continue;
      const tx = x + ox;
      const ty = y + oy;
      if (tx < 1 || ty < 1 || tx > bw || ty > bh) continue;
      out.set(tx, ty, c === INK ? PAL.sky[0] : iceOf(c));
    }
  }
  // Rim: lit top and left, darker bottom and right.
  out.hline(1, bw, 1, PAL.snow[3]);
  out.vline(1, 1, bh, PAL.snow[3]);
  out.hline(1, bw, bh, PAL.sky[1]);
  out.vline(bw, 1, bh, PAL.sky[1]);
  // A diagonal glint near the top-left corner.
  const g = 3 + (glint & 3) * 2;
  for (let k = 0; k < 3; k++) out.set(g + k, 3 + 2 - k, PAL.snow[3]);
  out.outline(INK);
  return { buf: out, ox: f.ox + ox, oy: f.oy + oy, pts: f.pts };
}

/** An ice cube (4×4 + outline). */
function iceCube(): PixelBuffer {
  return outlined(ascii(['abbc', 'bbbc', 'bbcc', 'cccd'], { a: PAL.snow[3], b: PAL.sky[3], c: PAL.sky[2], d: PAL.sky[1] }));
}

/**
 * Frozen and hit (GDD §9.0 `die-shatter`): the ice block, cracks, a burst of ice cubes with the
 * surprised face in the middle, then the cubes on the ground and the face sliding away.
 * `surprised` is the same figure rendered with a surprised expression (its head is cut out).
 */
export function shatterFrames(f: Frame, surprised: Frame): Frame[] {
  const block = frozenFrame(f, 0);
  const cracked = frozenFrame(f, 1);
  const cb = cracked.buf.clone();
  // Two jagged cracks across the block.
  const w = cb.w;
  const h = cb.h;
  let x = Math.round(w * 0.3);
  for (let y = 2; y < h - 2; y++) {
    cb.set(x, y, PAL.snow[3]);
    if (y % 3 === 0) x += y % 2 === 0 ? 1 : -1;
  }
  let y2 = Math.round(h * 0.45);
  for (let xx = 2; xx < w - 2; xx++) {
    cb.set(xx, y2, PAL.sky[0]);
    if (xx % 3 === 0) y2 += xx % 2 === 0 ? 1 : -1;
  }
  const crackedF: Frame = { buf: cb, ox: cracked.ox, oy: cracked.oy, pts: cracked.pts };
  // The surprised face: the head region of the surprised frame.
  const head = surprised.pts?.head ?? [2, -30];
  const hx = surprised.ox + head[0] - 7;
  const hy = surprised.oy + head[1] - 8;
  const face = surprised.buf.crop(hx, hy, 15, 15);
  const cube = iceCube();
  const burst: V2[] = [[-14, -30], [8, -36], [-6, -22], [14, -20], [-16, -12], [6, -10], [-2, -40], [16, -32]];
  const settled: V2[] = [[-22, -6], [12, -6], [-12, -6], [22, -6], [-28, -6], [4, -6], [-4, -6], [28, -6]];
  const empty: Frame = { buf: new PixelBuffer(1, 1), ox: 0, oy: 1, pts: f.pts };
  const scatter = (pts: readonly V2[], faceAt: V2): Frame =>
    withPieces(empty, [...pts.map((p) => pieceAt(cube, p, 3, 3)), pieceAt(face, faceAt, 7, 8)]);
  return [block, crackedF, scatter(burst, [-2, -18]), scatter(settled, [-18, -7])];
}

/**
 * Crushed (GDD §9.0 `die-crush`): flattened like a pancake, peels off the ground like paper and
 * flutters away upward.
 */
export function crushFrames(f: Frame): Frame[] {
  const tb = f.buf.trimBounds();
  if (!tb) return [f, f, f];
  const fig = f.buf.crop(tb.x, tb.y, tb.w, tb.h);
  // Squash to 5 px tall and 1.5× wide (nearest rows, so the uniform's colour bands survive).
  const pw = Math.round(tb.w * 1.5);
  const ph = 5;
  const pan = new PixelBuffer(pw, ph);
  for (let y = 0; y < ph; y++) {
    const sy = Math.min(tb.h - 1, Math.floor(((y + 0.5) / ph) * tb.h));
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(tb.w - 1, Math.floor(((x + 0.5) / pw) * tb.w));
      const c = fig.get(sx, sy);
      if ((c & 255) !== 0) pan.set(x, y, c === INK ? PAL.ink[1] : c);
    }
  }
  const flat = outlined(pan);
  const at = (buf: PixelBuffer, dx: number, lift: number): Frame => ({ buf, ox: (buf.w >> 1) - dx, oy: buf.h + lift, pts: f.pts });
  return [
    at(flat, 0, 0),
    at(flat.rotated(-14 * DEG), 2, 2),
    at(flat.rotated(10 * DEG), 4, 12),
    at(flat.rotated(-12 * DEG), 6, 24),
    at(flat.rotated(8 * DEG), 8, 36),
  ];
}

/**
 * Rising out of a chimney or a manhole (`emerge`): n frames that show more and more of the figure
 * above the anchor line (the opening); the last frame shows all of it.
 */
export function emergeFrames(f: Frame, n = 5): Frame[] {
  const tb = f.buf.trimBounds();
  if (!tb) return [f];
  const out: Frame[] = [];
  const top = tb.y;
  const full = f.oy - top;
  for (let k = 1; k <= n; k++) {
    const vis = Math.max(2, Math.round((full * k) / n));
    const buf = f.buf.crop(0, top, f.buf.w, vis);
    if (k < n) {
      // The cut edge is the rim: an INK line keeps it clean.
      for (let x = 0; x < buf.w; x++) if ((buf.get(x, vis - 1) & 255) !== 0) buf.set(x, vis - 1, INK);
    }
    out.push({ buf, ox: f.ox, oy: vis, pts: f.pts });
  }
  return out;
}

/**
 * Burning death (GDD §9.0): `runFrames` flaming frames (two looks, alternating — the game runs
 * him in a small circle meanwhile), the soot statue, the crumble, the ash pile, and the eyes
 * blinking twice in the pile. `render` draws a pose (default: the plain rig of `style`).
 */
export function burnStrip(style: HumanStyle, base: Pose = {}, runFrames = 6, seed = 9, render?: (p: Pose) => Frame): Frame[] {
  // `render` dresses the figure (a hat or an instrument drawn as pieces); default: the plain rig.
  const draw = render ?? ((p: Pose): Frame => renderHuman(style, p, 'full'));
  const out: Frame[] = [];
  for (let i = 0; i < runFrames; i++) {
    const p = P.BURN[i % 2];
    out.push(withFlames(scorch(draw({ ...base, ...p }), 1), i * 2 + 1, seed));
  }
  const statue = sootify(draw({ ...base, ...P.STAND, armN: { sh: 30, el: 60, hand: 'open' }, armF: { sh: -20, el: 50, hand: 'open' }, expr: 'soot' }), 1, true, seed);
  out.push(withFlames(statue, 5, seed + 3, 3));
  out.push(statue);
  out.push(crumble(statue, 0.5, seed));
  const pile = crumble(statue, 1, seed);
  out.push(pile);
  // Two white eyes blink in the ash pile.
  const eyes = pile.buf.clone();
  const ex = pile.ox - 2;
  const ey = pile.oy - 3;
  if (ey >= 0) {
    eyes.set(ex, ey, PAL.snow[3]);
    eyes.set(ex + 3, ey, PAL.snow[3]);
  }
  const lit: Frame = { buf: eyes, ox: pile.ox, oy: pile.oy, pts: pile.pts };
  out.push(lit, pile, lit, pile);
  return out;
}

/** Durations for `burnStrip` (the run frames 5 ticks each = 30 ticks for 6). */
export function burnDurations(runFrames = 6): number[] {
  return [...new Array<number>(runFrames).fill(5), 8, 12, 8, 10, 8, 6, 8, 20];
}

// ---------------------------------------------------------------------------------------------
// Pose tables for the extra strips (legs, lean, head, face; arms where the strip needs them)
// ---------------------------------------------------------------------------------------------

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });

/** Stand to attention: heels together, chest out. */
export const ATTENTION: Pose = { legN: L(5, 2), legF: L(-3, 2) };

/** The double-take (GDD §4.11 rule 1): looks, looks away, looks back, jolts. */
export const DOUBLE_TAKE: readonly Pose[] = [
  { ...P.STAND, expr: 'normal' },
  { ...P.STAND, head: { tilt: -12, dx: -1 }, lean: -3, expr: 'blink' },
  { ...P.STAND, head: { dx: 1 }, lean: 4, expr: 'panic' },
  { ...P.STAND, head: { dx: 1, dy: -1 }, lean: 6, expr: 'panic', dy: -2 },
];

/** Salute: heels together, the near hand at the brow (a hand piece is added in front of the head). */
export const SALUTE: readonly Pose[] = [
  { ...ATTENTION, armN: { to: [5, -10], hand: 'open' }, head: { tilt: -6 }, expr: 'normal', gunAngle: -84 },
  { ...ATTENTION, armN: { to: [5, -10], hand: 'open' }, head: { tilt: -6 }, expr: 'shout', gunAngle: -84, hunch: 1 },
];

/** Confused (GDD §4.11 rule 6): scratches his head, tilts it, puzzled eyes. */
export const CONFUSED: readonly Pose[] = [
  { ...P.STAND, armN: { to: [1, -13], hand: 'open' }, head: { tilt: 10 }, expr: 'dazed' },
  { ...P.STAND, armN: { to: [-1, -12], hand: 'open' }, head: { tilt: 10 }, expr: 'dazed' },
  { ...P.STAND, armN: { to: [1, -13], hand: 'open' }, head: { tilt: -8 }, expr: 'blink' },
  { ...P.STAND, armN: { to: [-1, -12], hand: 'open' }, head: { tilt: -8 }, expr: 'dazed' },
];

/** In the JINGLE queue: a coin held out, weight on one leg, then the other. */
export const QUEUE: readonly Pose[] = [
  { ...P.STAND, armN: { to: [7, 2], hand: 'grip' }, armF: { sh: -8, el: 20 }, expr: 'happy' },
  { legN: L(10, 8), legF: L(-10, 14), armN: { to: [7, 3], hand: 'grip' }, armF: { sh: -8, el: 20 }, expr: 'normal', bob: 1 },
];

/** SAY CHEESE: a grin and a V sign beside the face (the sign is a piece). */
export const PHOTO: readonly Pose[] = [{ legN: L(30, 30), legF: L(-14, 8), armN: { to: [4, -11], hand: 'open' }, lean: -4, head: { tilt: -8 }, expr: 'happy' }];

/** HONK: hands clapped over the ears, wincing, knees knocking. */
export const EARS: readonly Pose[] = [
  { legN: L(14, 34), legF: L(-4, 30), armN: { to: [0, -7], hand: 'open' }, armF: { to: [0, -8], hand: 'open' }, hunch: 1, expr: 'hurt' },
  { legN: L(2, 44), legF: L(6, 40), armN: { to: [0, -7], hand: 'open' }, armF: { to: [0, -8], hand: 'open' }, hunch: 1, expr: 'hurt', dx: 1 },
];

/** The column stumbles (its drummer fell): a trip, a flail, a catch, a wobble. */
export const STUMBLE: readonly Pose[] = [
  { legN: L(44, 40), legF: L(-34, 10), lean: 18, expr: 'panic' },
  { legN: L(10, 64), legF: L(-12, 24), lean: 28, expr: 'panic', dy: -1 },
  { legN: L(52, 22), legF: L(-22, 50), lean: 12, expr: 'hurt' },
  { ...P.STAND, lean: 4, head: { tilt: 8 }, expr: 'dazed' },
];

/** A skater falls flat: feet fly up, flat on his back, sits up, back on his skates. */
export const SLIP: readonly Pose[] = [
  { legN: L(84, 4), legF: L(64, 12), lean: -12, rot: -40, grounded: false, dy: -6, expr: 'panic' },
  { legN: L(70, 10), legF: L(60, 20), rot: -82, expr: 'panic' },
  { legN: L(76, 30), legF: L(52, 40), rot: -82, expr: 'dazed' },
  { ...P.CROUCH, lean: -10, expr: 'dazed' },
];

/** Gliding on skates: one leg back, leaning in, then the other leg. */
export const SKATE: readonly Pose[] = [
  { legN: L(24, 20), legF: L(-52, 4, -20), lean: 14 },
  { legN: L(26, 24), legF: L(-48, 8, -18), lean: 14, bob: 1 },
  { legN: L(-52, 4, -20), legF: L(24, 20), lean: 14 },
  { legN: L(-48, 8, -18), legF: L(26, 24), lean: 14, bob: 1 },
];

/** Downhill tuck on skis. */
export const SKI: readonly Pose[] = [
  { legN: L(70, 100), legF: L(62, 104), lean: 30, expr: 'shout' },
  { legN: L(70, 100), legF: L(62, 104), lean: 30, expr: 'shout', bob: 1 },
];

/** Head first into the snowbank, legs kicking in the air. */
export const SKI_CRASH: readonly Pose[] = [
  { legN: L(20, 10), legF: L(-10, 20), rot: 150, expr: 'panic' },
  { legN: L(40, 50), legF: L(-20, 10), rot: 160, expr: 'panic' },
  { legN: L(0, 20), legF: L(10, 60), rot: 160, expr: 'panic' },
];

/** Climbing out of an opening: both hands up on the rim. */
export const CLIMB: Pose = { ...P.STAND, armN: { sh: 150, el: 20, hand: 'open' }, armF: { sh: 140, el: 30, hand: 'open' }, expr: 'shout' };

// ---------------------------------------------------------------------------------------------
// The extra soldier strips
// ---------------------------------------------------------------------------------------------

/** How a frame holds the soldier's weapon or instrument. */
export type Hold = 'carry' | 'oneHand' | 'noHands';

/** What a soldier looks like and how he holds his weapon / instrument (for `defineSoldierExtras`). */
export interface SoldierLook {
  style: HumanStyle;
  /** Pose fields for carrying normally (double-take, stumble, skates, frozen, crush …): weapon / arms / held only. */
  carry: Pose;
  /** Pose fields with the near hand free (salute, confused, photo-pose): never set `armN` here. */
  oneHand: Pose;
  /** Pose fields with both hands free (ears, queue): usually `{ weapon: 'none' }`. */
  noHands: Pose;
  /** Add instrument / weapon pieces to a frame. */
  dress?: (f: Frame, pose: Pose, hold: Hold, strip: string) => Frame;
  /** Hand pieces: default the style's gloves (else its skin). */
  glove?: RampLike;
  /** The weapon lying at his feet in `ears` (null = none). */
  dropped?: PixelBuffer | null;
  /** The hat for the `hat` strip (default: the style's headgear; null = no hat strip). */
  hat?: PixelBuffer | null;
  /** Extra pose fields for every frame (a build tweak, a smaller frame …). */
  body?: Pose;
}

/** Render one pose of a look with a hold, then dress it. */
export function lookFrame(look: SoldierLook, pose: Pose, hold: Hold, strip: string): Frame {
  const p: Pose = { ...look.body, ...look[hold], ...pose };
  const f = renderHuman(look.style, p, 'full');
  return look.dress ? look.dress(f, p, hold, strip) : f;
}

function lookFrames(look: SoldierLook, poses: readonly Pose[], hold: Hold, strip: string): Frame[] {
  return poses.map((p) => lookFrame(look, p, hold, strip));
}

/** The rifle lying flat on the ground (outlined). */
export function rifleDropped(): PixelBuffer {
  return outlined(gunArt('rifle').buf);
}

/**
 * Register the GDD §9.0 / §15.6 extra strips for `enemy/<id>/`: double-take, salute, confused,
 * queue, photo-pose, ears, stumble, frozen, die-crush, die-shatter, slip, skate, ski, ski-crash,
 * emerge and hat. `skip` leaves strips out (the type registers its own or does not need them).
 */
export function defineSoldierExtras(id: string, look: SoldierLook, skip: readonly string[] = []): void {
  const pre = `enemy/${id}/`;
  const glove = look.glove ?? look.style.gloves ?? look.style.skin;
  const def = (name: string, gen: () => Frame[], opts: SpriteOpts): void => {
    if (!skip.includes(name)) defineSprite(pre + name, gen, opts);
  };

  def('double-take', () => lookFrames(look, DOUBLE_TAKE, 'carry', 'double-take'), { ticksPerFrame: 6, loop: false });

  def(
    'salute',
    () =>
      SALUTE.map((p) => {
        const f = lookFrame(look, p, 'oneHand', 'salute');
        // The hand at the brow, in front of the head, fingers pointing back over the brim.
        const head = f.pts?.head ?? [2, -30];
        return withPieces(f, [pieceAt(handPiece('open', glove, 2), [head[0] + 6, head[1] - 2 + (p.hunch ?? 0)], HAND_WRIST[0], HAND_WRIST[1])]);
      }),
    { durations: [18, 18] },
  );

  def(
    'confused',
    () => lookFrames(look, CONFUSED, 'oneHand', 'confused'),
    { ticksPerFrame: 8 },
  );

  def(
    'queue',
    () =>
      QUEUE.map((p) => {
        const f = lookFrame(look, p, 'noHands', 'queue');
        const hand = f.pts?.hand ?? [8, -16];
        return withPieces(f, [pieceAt(coinArt(), [hand[0] + 2, hand[1] - 2], 3, 3)]);
      }),
    { ticksPerFrame: 24 },
  );

  def(
    'photo-pose',
    () =>
      PHOTO.map((p) => {
        const f = lookFrame(look, p, 'oneHand', 'photo-pose');
        const head = f.pts?.head ?? [2, -30];
        return withPieces(f, [pieceAt(peaceSign(glove), [head[0] + 7, head[1] - 3], 3, 6)]);
      }),
    { ticksPerFrame: 60 },
  );

  def(
    'ears',
    () =>
      EARS.map((p) => {
        const f = lookFrame(look, p, 'noHands', 'ears');
        return look.dropped ? withPieces(f, [pieceAt(look.dropped, [-14, -1], 0, look.dropped.h - 1, true)]) : f;
      }),
    { ticksPerFrame: 4 },
  );

  def('stumble', () => lookFrames(look, STUMBLE, 'carry', 'stumble'), { durations: [8, 8, 8, 12] });

  def('frozen', () => {
    const f = lookFrame(look, { ...P.STAND, expr: 'panic' }, 'carry', 'frozen');
    return [frozenFrame(f, 0), frozenFrame(f, 2)];
  }, { ticksPerFrame: 20 });

  def('die-crush', () => crushFrames(lookFrame(look, { ...P.STAND, expr: 'hurt' }, 'carry', 'die-crush')), { durations: [24, 8, 8, 8, 30], loop: false });

  def(
    'die-shatter',
    () => shatterFrames(lookFrame(look, { ...P.STAND, expr: 'panic' }, 'carry', 'frozen'), lookFrame(look, { ...P.STAND, expr: 'panic' }, 'carry', 'die-shatter')),
    { durations: [6, 6, 10, 40], loop: false },
  );

  def('slip', () => lookFrames(look, SLIP, 'carry', 'slip'), { durations: [6, 14, 12, 8], loop: false });
  def('skate', () => lookFrames(look, SKATE, 'carry', 'skate'), { ticksPerFrame: 14 });
  def('ski', () => lookFrames(look, SKI, 'carry', 'ski').map(withSkis), { ticksPerFrame: 10 });
  def('ski-crash', () => lookFrames(look, SKI_CRASH, 'carry', 'ski-crash').map(withSnowbank), { durations: [8, 6, 6] });
  def('emerge', () => emergeFrames(lookFrame(look, CLIMB, 'noHands', 'emerge'), 5), { durations: [3, 3, 3, 4, 8], loop: false });

  const hat = look.hat === undefined ? headgearArt(look.style) : look.hat;
  if (hat) def('hat', () => hatFrames(hat), { ticksPerFrame: 4 });
}

let skisArt: PixelBuffer | null = null;
/** A pair of skis (crimson with a gold stripe and upturned tips), 24 × 3. */
function skis(): PixelBuffer {
  skisArt ??= outlined(ascii(['.....................aa', 'abbbbbbbbbbbbbbbbbbbba.', 'cccccccccccccccccccccc.'], { a: PAL.red[3], b: PAL.gold[2], c: PAL.red[1] }));
  return skisArt;
}

function withSkis(f: Frame): Frame {
  return withPieces(f, [pieceAt(skis(), [-10, -1], 0, 2)]);
}

let bankArt: PixelBuffer | null = null;
/** The snowbank a skier crashes into (a heap of snow round his head). */
function snowbank(): PixelBuffer {
  if (!bankArt) {
    const b = new PixelBuffer(22, 9);
    b.ellipse(0, 0, 22, 18, PAL.snow[2]);
    b.ellipse(2, 1, 10, 6, PAL.snow[3]);
    b.rect(0, 8, 22, 1, PAL.snow[1]);
    bankArt = b.outline(INK);
  }
  return bankArt;
}

function withSnowbank(f: Frame): Frame {
  return withPieces(f, [pieceAt(snowbank(), [0, -1], 11, 8)]);
}

// ---------------------------------------------------------------------------------------------
// Rifleman: extras, burning death with the run, outfit variants
// ---------------------------------------------------------------------------------------------

/** How a rifleman holds his rifle in the extra strips. */
export function riflemanLook(style: HumanStyle): SoldierLook {
  return {
    style,
    carry: { weapon: 'rifle', lowGun: true },
    oneHand: { weapon: 'rifle', gunHand: 'far', gunAngle: 75 },
    noHands: { weapon: 'none' },
    dropped: rifleDropped(),
  };
}

/** The whole rifleman set for one outfit: the §6.1 contract, the extras and the long burn. */
/** Skin ramps of the infantry rig by suffix letter (GDD §9.0). */
export const SKIN_TONES = { a: 'skinA', b: 'skinB', c: 'skinC' } as const;

/**
 * The two skin tones a style does not wear, as [suffix letter, ramp] (`enemy/<id>-skin<letter>`;
 * the plain set keeps the style's own tone).
 */
export function otherSkins(style: HumanStyle): [string, HumanStyle['skin']][] {
  const out: [string, HumanStyle['skin']][] = [];
  for (const [k, v] of Object.entries(SKIN_TONES)) if (style.skin !== v) out.push([k, v]);
  return out;
}

function defineRiflemanSet(id: string, style: HumanStyle): void {
  defineSoldierSprites(id, style);
  defineSoldierExtras(id, riflemanLook(style));
  // One strip per gag (`gag-<name>`, GDD §15.6) and the props they leave behind.
  defineRiflemanGags(id, style);
  // Fire: he runs a small circle on fire for 30 ticks first (GDD §9.0), then the soot statue.
  defineSprite(`enemy/${id}/die-burn`, () => burnStrip(style, { weapon: 'none' }), { durations: burnDurations(), loop: false });
  // Shot, blasted, knifed: the shako pops off at the hit (the game spawns `hat`), so these
  // frames are bare-headed (otherwise he would wear a second shako while the first one flies).
  const bare = (poses: readonly Pose[]) => (): Frame[] => poses.map((p) => renderHuman(style, { ...p, hat: false }, 'full'));
  defineSprite(`enemy/${id}/die`, bare(P.DIE), { durations: [5, 5, 6, 6, 8, 30], loop: false });
  defineSprite(`enemy/${id}/die-knife`, bare(P.DIE_KNIFE), { durations: [8, 6, 6, 6, 30], loop: false });
  defineSprite(`enemy/${id}/die-blast`, () => blastFrames(style, { hat: false }), { durations: [5, 5, 5, 5, 30], loop: false });
}

defineRiflemanSet('rifleman', RIFLEMAN_STYLE);
for (const o of OUTFITS) if (o !== 'parade') defineRiflemanSet(`rifleman-${o}`, outfitStyle(RIFLEMAN_STYLE, o));
// The other two skin tones of every outfit (GDD §9.0: skin per spawn; Soldier picks `-skin<x>`).
for (const o of OUTFITS) {
  const id = o === 'parade' ? 'rifleman' : `rifleman-${o}`;
  const style = o === 'parade' ? RIFLEMAN_STYLE : outfitStyle(RIFLEMAN_STYLE, o);
  for (const [suffix, skin] of otherSkins(style)) defineRiflemanSet(`${id}-skin${suffix}`, { ...style, skin });
}
