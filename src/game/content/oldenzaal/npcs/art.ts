/**
 * Mission oldenzaal — the art of Meneer Wu and Mevrouw Winkel (docs/design/oldenzaal.md §4.2, §6;
 * docs/api/oldenzaal.md). Owner: WUGHOST. Manifest id 'oldenzaal/npcs/art'. All drawn by code;
 * no photo, no likeness of a real person.
 *
 * MENEER WU (`npc/oz-wu/<anim>`, feet anchor, facing right, ~37 px): our own design — a
 * hard-working middle-aged snack-bar owner. The squad's rig (renderHuman) draws his face with the
 * same care as the heroes' (normal open eyes, the rig's own features); straight black hair with
 * grey at the temples, a short-sleeved shirt with the sleeves rolled up, a long white bib apron,
 * a tea towel over the near shoulder, the steel fry scoop. No stereotype in any detail (spec §4.2).
 * Strips: `idle` (4, at the door, breathing, the scoop at his belt), `wave` (4, waves them in),
 * `talk` (4, the scoop gestures), `wipe` (4, wipes with the towel), `scoop` (4, shakes the fries),
 * `toss` (4, the tray leaves the `hand` point on frame `WU_TOSS_RELEASE`), `nod` (3, a firm nod),
 * `walk` (8), `turn` (2), `in-talk` / `in-wave` (2: from the idle frame).
 *
 * MEVROUW WINKEL (`npc/oz-winkel/<anim>`, feet anchor = the hem, facing right, ~38 px): fictional;
 * a middle-aged woman, dark grey hair pinned up in a bun, an old-fashioned long dark dress with a
 * high collar, a shawl, an old lantern (its flame drawn apart: `npc/oz-winkel/flame`). She is
 * drawn with `drawGhost` (see-through, the cold green pass), so her art is plain and light: the
 * ghost passes make the look. Strips: `stand` (4, the lantern low), `raise` (2, the lantern up),
 * `glide` (4, a lean, the hem trailing), `shriek` (2, arms wide, the head back), `dive` (2, flat,
 * arms ahead), `flee` (2, turned away, the shawl flying); `glow` (1, a soft round glow for the
 * additive pass), `flame` (4, the green lantern flame; point `hand` of every strip = the lantern).
 *
 * UHD art (docs/ART_GUIDE.md "UHD art"): every id has ONE density-generic generator for 2× and 4×
 * (`hd: (d) => …`): the rig at d and the pieces (apron, towel, scoop, tray, skirt, bun, lantern)
 * painted natively with the HD kit (HdCanvas, PAL_HD, outline A), each fitted into its 1× box at
 * the same logical place (geometry is law).
 */
import { luma, type Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames } from '../../../../engine/sprites';
import { folds, HdCanvas, type RenderOpts } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { withSwing } from '../../../art/human-sprites';
import { renderHuman, stackFrames, type ArmPose, type Density, type HumanStyle, type LegPose, type Pose } from '../../../art/humanoid';
import { inbetween } from '../../../art/tween';
import * as P from '../../../art/poses';
import { turnSquash } from '../../creatures/draw';

type V2 = readonly [number, number];
type HdD = 2 | 4;

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand?: ArmPose['hand']): ArmPose => (hand ? { sh, el, hand } : { sh, el });
const hdOf = (d: number): HdD => (d >= 4 ? 4 : 2);

/** The cast's sprite look (as the ams people): outline A, a cool rim light, AO. */
const HD_RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

/** Finished HD pieces (a pure function of the key). */
const hdPieces = new Map<string, PixelBuffer>();
function hdCached(key: string, make: () => PixelBuffer): PixelBuffer {
  let b = hdPieces.get(key);
  if (!b) {
    b = make();
    hdPieces.set(key, b);
  }
  return b;
}

// =============================================================================== MENEER WU

/** Straight black hair (a cool blue-black with a soft sheen; wave B: no purple cast). */
const WU_HAIR: Ramp = [PAL.ink[0], PAL.black[2], PAL.steel[1]];

/** Meneer Wu's look (the squad's rig; the face is the rig's own, drawn as the heroes' faces). */
export const WU_STYLE: HumanStyle = {
  skin: 'skinB',
  hair: WU_HAIR,
  hairStyle: 'short',
  headgear: 'none',
  top: 'teal',
  topType: 'tee',
  pants: 'black',
  boots: 'black',
  belt: 'black',
  gloves: null,
  build: 'normal',
  face: ['eyeshine'],
};

/** The scoop held at the belt, breathing (4 frames). */
const WU_IDLE: readonly Pose[] = P.seq({ ...P.STAND, armN: { to: [6, 7], hand: 'grip' }, armF: A(-4, 20, 'open'), expr: 'normal' }, P.BREATH4);

/** Waving them in: the far hand on the hip, the near hand high, beckoning (4 frames). */
const WU_WAVE: readonly Pose[] = [
  { ...P.STAND, armN: { to: [7, -10], hand: 'open' }, armF: A(-4, 20, 'open'), expr: 'smile' },
  { ...P.STAND, armN: { to: [9, -8], hand: 'open' }, armF: A(-4, 20, 'open'), expr: 'shout' },
  { ...P.STAND, armN: { to: [6, -4], hand: 'open' }, armF: A(-4, 20, 'open'), expr: 'smile' },
  { ...P.STAND, armN: { to: [9, -8], hand: 'open' }, armF: A(-4, 20, 'open'), expr: 'shout' },
];

/** Talking: the scoop gestures, the far hand open (4 frames). */
const WU_TALK: readonly Pose[] = [
  { ...P.STAND, armN: { to: [8, -1], hand: 'grip' }, armF: A(-4, 20, 'open'), expr: 'shout' },
  { ...P.STAND, armN: { to: [9, -4], hand: 'grip' }, armF: { to: [6, 2], hand: 'open' }, expr: 'smile' },
  { ...P.STAND, armN: { to: [8, -2], hand: 'grip' }, armF: { to: [7, 1], hand: 'open' }, expr: 'shout', bob: 1 },
  { ...P.STAND, armN: { to: [7, 3], hand: 'grip' }, armF: A(-4, 20, 'open'), expr: 'normal' },
];

/** Wiping: bent a little over the counter top, the towel hand sweeps forward and back (4 frames). */
const WU_WIPE: readonly Pose[] = [
  { ...P.STAND, lean: 6, armN: { to: [7, 7], hand: 'open' }, armF: A(-4, 20, 'open'), head: { dy: 1 }, expr: 'normal' },
  { ...P.STAND, lean: 7, armN: { to: [10, 7], hand: 'open' }, armF: A(-4, 20, 'open'), head: { dy: 1 }, expr: 'normal' },
  { ...P.STAND, lean: 6, armN: { to: [12, 8], hand: 'open' }, armF: A(-4, 20, 'open'), head: { dy: 1 }, expr: 'normal' },
  { ...P.STAND, lean: 7, armN: { to: [9, 8], hand: 'open' }, armF: A(-4, 20, 'open'), head: { dy: 1 }, expr: 'normal' },
];

/** Scooping: the scoop dips to the fryer and lifts, a shake (4 frames). */
const WU_SCOOP: readonly Pose[] = [
  { ...P.STAND, lean: 4, armN: { to: [9, 6], hand: 'grip' }, armF: { to: [6, 4], hand: 'open' }, expr: 'normal' },
  { ...P.STAND, lean: 6, armN: { to: [10, 9], hand: 'grip' }, armF: { to: [6, 5], hand: 'open' }, expr: 'normal' },
  { ...P.STAND, lean: 3, armN: { to: [9, 3], hand: 'grip' }, armF: { to: [6, 4], hand: 'open' }, expr: 'smile', bob: 1 },
  { ...P.STAND, lean: 3, armN: { to: [10, 4], hand: 'grip' }, armF: { to: [6, 4], hand: 'open' }, expr: 'smile' },
];

/** Toss: the tray up at the shoulder, overhead, release (frame 2: `hand`), follow-through. */
const WU_TOSS: readonly Pose[] = [
  { ...P.STAND, armN: A(-100, 80, 'grip'), armF: A(20, 40, 'open'), lean: -6, expr: 'smile' },
  { ...P.STAND, armN: A(-150, 60, 'grip'), armF: A(30, 40, 'open'), lean: -8, expr: 'shout' },
  { legN: L(30, 14), legF: L(-20, 12), armN: { to: [10, -8], hand: 'open' }, armF: A(10, 30, 'open'), lean: 8, expr: 'smile' },
  { legN: L(30, 14), legF: L(-20, 12), armN: A(80, 10, 'open'), armF: A(0, 24, 'open'), lean: 6, expr: 'smile' },
];
/** Frame of `toss` on which the tray leaves the hand. */
export const WU_TOSS_RELEASE = 2;
export const WU_TOSS_TICKS = 7;

/** A firm nod: the chin drops and comes back up (3 frames; arms folded at the waist). */
const WU_NOD: readonly Pose[] = [
  { ...P.STAND, armN: { to: [6, 7], hand: 'grip' }, armF: { to: [7, 6], hand: 'open' }, expr: 'normal' },
  { ...P.STAND, armN: { to: [6, 7], hand: 'grip' }, armF: { to: [7, 6], hand: 'open' }, head: { dy: 1, tilt: 12 }, expr: 'smile' },
  { ...P.STAND, armN: { to: [6, 7], hand: 'grip' }, armF: { to: [7, 6], hand: 'open' }, head: { dy: 1, tilt: 6 }, expr: 'smile' },
];

const WU_WALK: readonly Pose[] = withSwing(P.WALK, 0.6, 30);

/** Ticks per frame of the `in-<mode>` and `turn` strips; the walk speed the strip is drawn for. */
export const WU_TR_TICKS = 3;
export const WU_TURN_TICKS = 2;
export const WU_WALK_SPEED = 0.8;
/** Modes with an `in-<mode>` strip (from the idle frame; played backward to leave the mode). */
export const WU_TRANSITIONS: readonly string[] = ['talk', 'wave'];

// ------------------------------------------------------------------------------- Wu's pieces

/** The long white bib apron (1×: 8 × 17 with its outline; the bib top sits at the chest). */
function apron1(): PixelBuffer {
  const b = new PixelBuffer(6, 15);
  b.rect(1, 0, 4, 6, PAL.cloth[2]);
  b.rect(0, 6, 6, 9, PAL.cloth[2]);
  b.hline(1, 4, 0, PAL.cloth[3]);
  b.vline(5, 6, 14, PAL.cloth[1]);
  b.vline(0, 7, 14, PAL.cloth[3]);
  b.hline(0, 5, 6, PAL.cloth[1]);
  // A fold and a faint grease mark of an honest day's work.
  b.vline(3, 8, 13, PAL.cloth[1]);
  b.set(4, 11, PAL.sand[2]);
  return b.padded(1).outline(INK);
}

function apronHd(d: HdD): PixelBuffer {
  return hdCached(`wu-apron@${d}`, () => {
    const c = new HdCanvas(8, 17, d);
    const cloth = c.material({ ramp: PAL_HD.cloth, lo: 1, hi: 5, wrap: 0.1, spec: 0.1, shine: 8 });
    const tie = c.material({ ramp: PAL_HD.cloth, lo: 1, hi: 4, spec: 0.1 });
    const body = c.newPart();
    c.blob([[2, 1], [6, 1], [6, 7], [7, 7.2], [7.2, 16], [0.8, 16], [1, 7.2], [2, 7]], 0.7, {
      mat: cloth,
      part: body,
      bulge: 0.3,
      tex: folds({ angle: Math.PI / 2, spacing: 2.2, amp: 0.8, cover: 0.7, seed: 41 }),
    });
    c.shade(1, 7, 6, 2, (_x, y) => -0.3 * Math.max(0, 1 - (y - 7) / 2), body);
    c.box(1, 7, 6, 0.8, { mat: tie, z: 1.5, bevel: 0.35, tone: -0.05 });
    c.ellipsoid(5, 12.2, 0.55, 0.45, { mat: c.material({ ramp: PAL_HD.sand, lo: 2, hi: 4, spec: 0.2 }), z: 1.4, round: 0.4 });
    return c.render(HD_RENDER);
  });
}

/** The tea towel over the near shoulder (1×: 4 × 7 with its outline): white with a blue stripe. */
function towel1(): PixelBuffer {
  const b = new PixelBuffer(2, 5);
  b.rect(0, 0, 2, 5, PAL.snow[2]);
  b.hline(0, 1, 2, PAL.sky[2]);
  b.set(1, 4, PAL.cloth[1]);
  return b.padded(1).outline(INK);
}

function towelHd(d: HdD): PixelBuffer {
  return hdCached(`wu-towel@${d}`, () => {
    const c = new HdCanvas(4, 7, d);
    const cot = c.material({ ramp: PAL_HD.snow, lo: 2, hi: 5, wrap: 0.1, spec: 0.1 });
    const blue = c.material({ ramp: PAL_HD.sky, lo: 2, hi: 5, spec: 0.1 });
    c.blob([[1, 1], [3, 1], [3, 6], [1, 6]], 0.5, {
      mat: cot,
      bulge: 0.4,
      tex: (s) => {
        if ((s.y > 2.7 && s.y < 3.3) || (s.y > 3.7 && s.y < 4.1)) s.mat = blue;
        if (s.d >= 4 && s.y > 5.6 && Math.floor(s.x * 4) % 2 === 0) s.tone -= 0.2;
      },
    });
    return c.render(HD_RENDER);
  });
}

/**
 * Grey at the temples: the hair tones (taken from the crown) in a small zone behind the eye and
 * above the ear turn to soft greys, light to light (the same zone at every density).
 */
function greyTemples(f: Frame): Frame {
  const head = f.pts?.head;
  if (!head) return f;
  const d = f.density ?? 1;
  const b = f.buf.clone();
  const hx = (f.ox + head[0]) * d;
  const hy = (f.oy + head[1]) * d;
  const greys: readonly Color[] = d === 1 ? [PAL.stone[1], PAL.stone[2]] : [PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4]];
  const isHair = (c: number): boolean => (c & 255) !== 0 && c !== INK && c !== PAL_HD.ink[0] && luma(c) < 72;
  // The temple and the sideburn: the hair just behind the eye and above the ear (the head faces
  // right, so the back is −x). Salt and pepper: about every other hair px turns grey, the lit
  // ones lighter; the 1× frame gets a single grey px or two.
  const x0 = Math.round(hx - 4.5 * d);
  const x1 = Math.round(hx - 0.5 * d);
  const y0 = Math.round(hy - 2.5 * d);
  const y1 = Math.round(hy + 1.5 * d);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const c = b.get(x, y);
      if (!isHair(c)) continue;
      // Only hair at the edge of the face side (a skin px within 2 art px to the right / below) or every other px.
      const nearSkin = !isHair(b.get(x + 1, y)) && (b.get(x + 1, y) & 255) !== 0 && b.get(x + 1, y) !== INK && b.get(x + 1, y) !== PAL_HD.ink[0];
      if (!nearSkin && (x + y * 3) % (d === 1 ? 4 : 3) !== 0) continue;
      const l = luma(c);
      b.set(x, y, greys[Math.min(greys.length - 1, Math.floor((l / 72) * greys.length))]);
    }
  }
  return { ...f, buf: b };
}

/** The steel fry scoop full of fries (1× 9 × 10; hand at its handle (1, 6)). */
function scoop1(): PixelBuffer {
  const b = new PixelBuffer(9, 10);
  for (const [x, top] of [[3, 0], [4, 1], [5, 0], [6, 2], [7, 1]] as const) b.vline(x, top + 1, 5, PAL.gold[top & 1 ? 2 : 3]);
  b.poly([[2, 4], [8, 4], [7, 8], [3, 8]], PAL.steel[3]);
  b.hline(3, 7, 8, PAL.steel[2]);
  b.line(1, 7, 3, 6, PAL.steel[2]);
  return b.outline(INK);
}

function scoopHd(d: HdD): PixelBuffer {
  return hdCached(`wu-scoop@${d}`, () => {
    const c = new HdCanvas(9, 10, d);
    const steel = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 1, shine: 26 });
    const fry = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.25, shine: 10, wrap: 0.1 });
    const fries: ReadonlyArray<readonly [number, number, number]> = [
      [3.4, 1.4, -0.3],
      [4.4, 2.2, 0.2],
      [5.3, 1.2, 0.1],
      [6.3, 2.9, 0.4],
      [7.2, 2.0, 0.5],
      [5.8, 2.5, 0.3],
    ];
    fries.forEach(([x, top, lean], k) =>
      c.capsule(x + lean, top + 0.4, x, 5.6, 0.42, 0.42, {
        mat: fry,
        z: 0.4 + (k % 3) * 0.15,
        round: 0.8,
        tone: k % 2 ? -0.06 : 0.06,
        tex: (s) => {
          if (s.y < top + 0.7) s.tone -= 0.3;
        },
      }),
    );
    c.blob([[2, 4.4], [8, 4.4], [7.2, 8.4], [2.8, 8.4]], 0.7, { mat: steel, z: 1.2, bulge: 0.3 });
    c.box(1.9, 4, 6.2, 0.8, { mat: steel, z: 2.6, bevel: 0.35, r: 0.3, tone: 0.15 });
    c.capsule(1.4, 7.6, 3.3, 6.5, 0.45, 0.4, { mat: steel, z: 1, tone: -0.1 });
    return c.render(HD_RENDER);
  });
}

/** The cleaning cloth in the wiping hand (1× 6 × 5): the towel bunched up. */
function rag1(): PixelBuffer {
  const b = new PixelBuffer(4, 3);
  b.rect(0, 0, 4, 3, PAL.snow[2]);
  b.hline(0, 3, 1, PAL.sky[2]);
  b.set(3, 2, PAL.cloth[1]);
  return b.padded(1).outline(INK);
}

function ragHd(d: HdD): PixelBuffer {
  return hdCached(`wu-rag@${d}`, () => {
    const c = new HdCanvas(6, 5, d);
    const cot = c.material({ ramp: PAL_HD.snow, lo: 2, hi: 5, wrap: 0.1, spec: 0.1 });
    const blue = c.material({ ramp: PAL_HD.sky, lo: 2, hi: 5, spec: 0.1 });
    c.blob([[1, 1.2], [5, 1], [5, 4], [1, 4]], 0.7, {
      mat: cot,
      bulge: 0.5,
      tex: (s) => {
        if (s.y > 2.1 && s.y < 2.7) s.mat = blue;
      },
    });
    return c.render(HD_RENDER);
  });
}

/** The paper tray he tosses (the meal), held flat in the hand (1× 9 × 6; the meal pickup's look). */
export function tray1(): PixelBuffer {
  const b = new PixelBuffer(9, 5);
  // Fries and the two frikandellen over the rim, a dab of mayo.
  for (const x of [1, 2, 3]) b.vline(x, 0, 2, PAL.gold[x & 1 ? 3 : 2]);
  b.hline(4, 8, 1, PAL.rust[2]);
  b.hline(4, 8, 0, PAL.rust[3]);
  b.set(2, 0, PAL.snow[3]);
  b.set(3, 1, PAL.snow[3]);
  b.rect(0, 2, 9, 3, PAL.cloth[2]);
  b.hline(0, 8, 2, PAL.cloth[3]);
  b.hline(1, 7, 4, PAL.cloth[1]);
  return b.outline(INK);
}

export function trayHd(d: HdD): PixelBuffer {
  return hdCached(`wu-tray@${d}`, () => {
    const c = new HdCanvas(9, 5, d);
    const paper = c.material({ ramp: PAL_HD.cloth, lo: 2, hi: 5, spec: 0.15, wrap: 0.1 });
    const fry = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.25, shine: 10 });
    const frik = c.material({ ramp: PAL_HD.rust, lo: 1, hi: 5, spec: 0.5, shine: 16 });
    const mayo = c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6, spec: 0.9, shine: 26 });
    for (const [x, top] of [[1.2, 0.3], [1.9, 0.8], [2.6, 0.2], [3.3, 0.9]] as const) c.capsule(x, top, x + 0.1, 2.6, 0.4, 0.4, { mat: fry, z: 0.6, round: 0.8 });
    c.capsule(4.3, 1.5, 8.2, 1.5, 0.55, 0.55, { mat: frik, z: 0.8, round: 0.9 });
    c.capsule(4.6, 0.7, 8.4, 0.7, 0.5, 0.5, { mat: frik, z: 0.6, round: 0.9, tone: 0.08 });
    c.ellipsoid(2.6, 1.4, 0.9, 0.6, { mat: mayo, z: 1.4, round: 0.7 });
    c.blob([[0.2, 2.2], [8.8, 2.2], [8.3, 4.8], [0.7, 4.8]], 0.4, { mat: paper, z: 1.2, bulge: 0.2 });
    return c.render(HD_RENDER);
  });
}

// ------------------------------------------------------------------------------- Wu's figure

/** Lower body with the apron (bottom) under the torso; the bib (top of the same piece) over the torso, under the near arm's reach. */
function wuFigure(pose: Pose, d: Density): Frame {
  const ap = d === 1 ? apron1() : apronHd(hdOf(d));
  if (pose.rot) return renderHuman(WU_STYLE, pose, 'full', d);
  const lower = renderHuman(WU_STYLE, pose, 'lower', d);
  const upper = renderHuman(WU_STYLE, pose, 'upper', d);
  const hip = lower.pts?.hip ?? [0, -15];
  const piece = (y0: number): Piece => {
    const p: Piece = { buf: ap, x: Math.round(hip[0]) - 3 + Math.round((pose.lean ?? 0) / 8), y: Math.round(hip[1]) - y0 };
    if (d !== 1) p.density = d;
    return p;
  };
  // The skirt of the apron hangs from the hip in front of the legs; the bib is drawn over the
  // torso as part of the same piece (the near arm reaches past its edge).
  const legs = withPieces(lower, [piece(8)]);
  const body = stackFrames(legs, upper);
  return greyTemples(withPieces(body, [piece(8)]));
}

function wuPieces(f: Frame, s: WuStrip, i: number, d: Density): Frame {
  const h: V2 = f.pts?.hand ?? [4, -16];
  const head: V2 = f.pts?.head ?? [0, -30];
  const pieces: Piece[] = [];
  const dd = (p: Piece): Piece => (d === 1 ? p : { ...p, density: d });
  // The towel over the near shoulder (just behind the neck, hanging down the front).
  if (s.towel !== false) pieces.push(dd({ buf: d === 1 ? towel1() : towelHd(hdOf(d)), x: Math.round(head[0]) - 4, y: Math.round(head[1]) + 4 }));
  if (s.hold === 'scoop') pieces.push(dd({ buf: d === 1 ? scoop1() : scoopHd(hdOf(d)), x: Math.round(h[0]) - 2, y: Math.round(h[1]) - 8 }));
  if (s.hold === 'rag') pieces.push(dd({ buf: d === 1 ? rag1() : ragHd(hdOf(d)), x: Math.round(h[0]) - 2, y: Math.round(h[1]) - 3 }));
  if (s.hold === 'tray' && i < WU_TOSS_RELEASE) pieces.push(dd({ buf: d === 1 ? tray1() : trayHd(hdOf(d)), x: Math.round(h[0]) - 4, y: Math.round(h[1]) - 4 }));
  return pieces.length ? withPieces(f, pieces) : f;
}

interface WuStrip {
  poses: readonly Pose[];
  ticks: number;
  loop?: boolean;
  hold?: 'scoop' | 'rag' | 'tray';
  towel?: boolean;
}

const WU_STRIPS: Readonly<Record<string, WuStrip>> = {
  idle: { poses: WU_IDLE, ticks: 15, hold: 'scoop' },
  wave: { poses: WU_WAVE, ticks: 6 },
  talk: { poses: WU_TALK, ticks: 8, hold: 'scoop' },
  wipe: { poses: WU_WIPE, ticks: 7, hold: 'rag', towel: false },
  scoop: { poses: WU_SCOOP, ticks: 8, hold: 'scoop' },
  toss: { poses: WU_TOSS, ticks: WU_TOSS_TICKS, loop: false, hold: 'tray' },
  nod: { poses: WU_NOD, ticks: 8, loop: false, hold: 'scoop' },
  walk: { poses: WU_WALK, ticks: 6 },
};

function wuGen(s: WuStrip, d: Density): () => Frame[] {
  return () => s.poses.map((p, i) => wuPieces(wuFigure({ weapon: 'none', ...p }, d), s, i, d));
}

for (const [name, s] of Object.entries(WU_STRIPS)) {
  defineSprite(`npc/oz-wu/${name}`, wuGen(s, 1), { ticksPerFrame: s.ticks, loop: s.loop ?? true, hd: (d) => wuGen(s, d)() });
}
for (const m of WU_TRANSITIONS) {
  const a = WU_STRIPS.idle.poses[0];
  const to = WU_STRIPS[m];
  const b = to.poses[0];
  const tr: WuStrip = { poses: [inbetween(WU_STYLE, a, b, 0.35, { hold: 'b' }), inbetween(WU_STYLE, a, b, 0.7, { hold: 'b' })], ticks: WU_TR_TICKS, hold: to.hold };
  defineSprite(`npc/oz-wu/in-${m}`, wuGen(tr, 1), { ticksPerFrame: WU_TR_TICKS, loop: false, hd: (d) => wuGen(tr, d)() });
}
defineSprite('npc/oz-wu/turn', () => turnSquash(getFrames('npc/oz-wu/idle', 1)[0]), {
  ticksPerFrame: WU_TURN_TICKS,
  hd: (d) => turnSquash(wuGen(WU_STRIPS.idle, d)()[0]),
});

// ============================================================================ MEVROUW WINKEL

/** Dark grey hair, pinned up (a cool grey ramp). */
const WINKEL_HAIR: Ramp = [PAL.ink[1], PAL.steel[1], PAL.steel[2]];

/** The dark dress: a near-black violet-grey (cold, old-fashioned). */
const WINKEL_DRESS: Ramp = [PAL.ink[0], PAL.black[1], PAL.black[2], PAL.stone[0]];

/** Mevrouw Winkel's look (fictional): the long dark dress is a piece over the legs. */
export const WINKEL_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: WINKEL_HAIR,
  hairStyle: 'slick-back',
  headgear: 'none',
  top: WINKEL_DRESS,
  topType: 'coat',
  accent: 'stone',
  pants: WINKEL_DRESS,
  boots: 'black',
  belt: WINKEL_DRESS,
  gloves: null,
  build: 'slim',
  accessories: ['scarf'],
  face: [],
};

/** Her legs never show (the dress); a still, upright stance. */
const W_LEGS: Pose = { legN: L(6, 4), legF: L(-4, 4) };
const W_STAND: readonly Pose[] = P.seq({ ...W_LEGS, armN: { to: [5, 8], hand: 'grip' }, armF: A(-2, 30, 'open'), expr: 'normal' }, P.BREATH4);
const W_RAISE: readonly Pose[] = [
  { ...W_LEGS, armN: { to: [8, -2], hand: 'grip' }, armF: A(-2, 30, 'open'), expr: 'normal', head: { tilt: -4 } },
  { ...W_LEGS, armN: { to: [8, -10], hand: 'grip', bend: 'up' }, armF: A(-2, 30, 'open'), expr: 'happy', head: { tilt: -8 } },
];
const W_GLIDE: readonly Pose[] = [
  { ...W_LEGS, lean: 10, armN: { to: [9, 4], hand: 'grip' }, armF: A(-20, 30, 'open'), expr: 'normal', bob: 0 },
  { ...W_LEGS, lean: 12, armN: { to: [10, 3], hand: 'grip' }, armF: A(-24, 28, 'open'), expr: 'normal', bob: 1 },
  { ...W_LEGS, lean: 10, armN: { to: [9, 4], hand: 'grip' }, armF: A(-20, 30, 'open'), expr: 'normal', bob: 1 },
  { ...W_LEGS, lean: 8, armN: { to: [9, 5], hand: 'grip' }, armF: A(-16, 32, 'open'), expr: 'normal', bob: 0 },
];
const W_SHRIEK: readonly Pose[] = [
  { ...W_LEGS, lean: -6, armN: { to: [9, -9], hand: 'grip', bend: 'up' }, armF: A(130, 20, 'open'), expr: 'shout', head: { tilt: -14 } },
  { ...W_LEGS, lean: -8, armN: { to: [10, -11], hand: 'grip', bend: 'up' }, armF: A(140, 16, 'open'), expr: 'shout', head: { tilt: -18, dy: -1 } },
];
const W_DIVE: readonly Pose[] = [
  { ...W_LEGS, lean: 40, armN: { to: [12, -2], hand: 'grip' }, armF: A(110, 10, 'open'), expr: 'shout' },
  { ...W_LEGS, lean: 48, armN: { to: [13, -3], hand: 'grip' }, armF: A(120, 8, 'open'), expr: 'shout' },
];
const W_FLEE: readonly Pose[] = [
  { ...W_LEGS, lean: 18, armN: { to: [6, 6], hand: 'grip' }, armF: A(-40, 30, 'open'), expr: 'panic', head: { tilt: 8 } },
  { ...W_LEGS, lean: 20, armN: { to: [7, 5], hand: 'grip' }, armF: A(-50, 26, 'open'), expr: 'panic', head: { tilt: 10 } },
];

/** Strip name → poses, ticks; `trail` = the hem's mist wisps lean back (glide, dive, flee). */
const WINKEL_STRIPS: Readonly<Record<string, { poses: readonly Pose[]; ticks: number; trail: number }>> = {
  stand: { poses: W_STAND, ticks: 14, trail: 0 },
  raise: { poses: W_RAISE, ticks: 10, trail: 0 },
  glide: { poses: W_GLIDE, ticks: 8, trail: 2 },
  shriek: { poses: W_SHRIEK, ticks: 5, trail: 1 },
  dive: { poses: W_DIVE, ticks: 5, trail: 3 },
  flee: { poses: W_FLEE, ticks: 5, trail: 3 },
};

/** The long dark dress from the hip down: a bell of heavy cloth ending in mist wisps (1×: 14 × 18). */
function skirt1(trail: number, i: number): PixelBuffer {
  const b = new PixelBuffer(12, 16);
  const D = [PAL.ink[0], PAL.black[1], PAL.black[2]];
  for (let y = 0; y < 16; y++) {
    const half = 2.5 + y * 0.22;
    const cx = 6 - (y * trail) / 16;
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    for (let x = x0; x <= x1; x++) {
      // Ragged mist hem: the bottom rows break up into wisps.
      if (y >= 12 && ((x + i + (y >> 1)) % 3 === 0 || y === 15 && (x + i) % 2 === 0)) continue;
      b.set(x, y, x === x0 ? D[2] : x >= x1 - 1 ? D[0] : D[1]);
    }
  }
  // Folds.
  for (const fx of [4, 7]) for (let y = 3; y < 12; y++) if (b.get(fx + Math.round(-(y * trail) / 16), y) & 255) b.set(fx + Math.round(-(y * trail) / 16), y, D[0]);
  return b.padded(1).outline(INK);
}

function skirtHd(trail: number, i: number, d: HdD): PixelBuffer {
  return hdCached(`winkel-skirt:${trail}:${i}@${d}`, () => {
    const c = new HdCanvas(14, 18, d);
    const cloth = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, wrap: 0.05, spec: 0.25, shine: 10, rim: 0.1 });
    const pts: Array<readonly [number, number]> = [];
    for (let y = 1; y <= 17; y += 2) pts.push([7 - ((y - 1) * trail) / 16 + 2.5 + (y - 1) * 0.22, y]);
    for (let y = 17; y >= 1; y -= 2) pts.push([7 - ((y - 1) * trail) / 16 - 2.5 - (y - 1) * 0.22, y]);
    c.blob(pts, 0.6, {
      mat: cloth,
      bulge: 0.3,
      tex: (s) => {
        // The hem frays into mist: whole cells cut on a wavy line (no single-px checker).
        const edge = 13.4 + Math.sin(s.x * 1.7 + i * 1.3) * 0.9;
        if (s.y > edge) s.cut = true;
        const fold = Math.sin((s.x + (s.y * trail) / 16) * 1.6);
        s.tone += fold * 0.12;
      },
    });
    return c.render(HD_RENDER);
  });
}

/** The bun pinned up at the back of the head (1×: 6 × 6 with its outline; a hairpin across it). */
function bun1(): PixelBuffer {
  const b = new PixelBuffer(4, 4);
  b.rect(0, 0, 4, 4, PAL.steel[1]);
  b.set(0, 0, 0);
  b.set(3, 3, 0);
  b.set(1, 1, PAL.steel[2]);
  b.set(2, 1, PAL.steel[2]);
  b.set(2, 2, PAL.ink[1]);
  b.set(3, 0, PAL.stone[2]);
  return b.padded(1).outline(INK);
}

function bunHd(d: HdD): PixelBuffer {
  return hdCached(`winkel-bun@${d}`, () => {
    const c = new HdCanvas(6, 6, d);
    const hair = c.material({ ramp: PAL_HD.steel, lo: 0, hi: 3, spec: 0.45, shine: 16 });
    const pin = c.material({ ramp: PAL_HD.stone, lo: 2, hi: 4, spec: 0.6, shine: 20 });
    c.ellipsoid(3, 3, 2.1, 2, {
      mat: hair,
      round: 0.85,
      z: 1,
      tex: (s) => {
        // The hair wound round the bun: a soft spiral of darker strands.
        const a = Math.atan2(s.y - 3, s.x - 3);
        const r = Math.hypot(s.x - 3, s.y - 3);
        if (Math.sin(a * 2 + r * 4.2) > 0.55) s.tone -= 0.2;
      },
    });
    // A hairpin across it.
    c.capsule(1.4, 4.4, 4.8, 1.5, 0.28, 0.28, { mat: pin, z: 2 });
    return c.render(HD_RENDER);
  });
}

/** The old lantern (no flame; the flame is its own strip): 1× 7 × 10 with its outline; hand at (3, 1). */
function lantern1(): PixelBuffer {
  const b = new PixelBuffer(5, 8);
  b.hline(1, 3, 0, PAL.steel[1]);
  b.rect(0, 1, 5, 1, PAL.steel[2]);
  b.rect(0, 2, 5, 5, PAL.teal[1]);
  b.vline(0, 2, 6, PAL.steel[1]);
  b.vline(4, 2, 6, PAL.steel[1]);
  b.vline(2, 2, 6, PAL.steel[0]);
  b.rect(0, 7, 5, 1, PAL.steel[2]);
  return b.padded(1).outline(INK);
}

function lanternHd(d: HdD): PixelBuffer {
  return hdCached(`winkel-lantern@${d}`, () => {
    const c = new HdCanvas(7, 10, d);
    const iron = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 4, spec: 0.7, shine: 22 });
    const glass = c.material({ ramp: PAL_HD_OZ.ghost, flat: true, lo: 1, hi: 4 });
    c.box(1, 3, 5, 5, { mat: glass, z: 0, tex: (s) => (s.tone = 0.35 + 0.4 * Math.max(0, 1 - Math.hypot(s.x - 3.5, s.y - 5.6) / 2.6)) });
    c.box(1, 2, 5, 1.1, { mat: iron, z: 1, bevel: 0.35 });
    c.box(1, 8, 5, 1, { mat: iron, z: 1, bevel: 0.35 });
    c.box(2, 1, 3, 1, { mat: iron, z: 1, bevel: 0.3 });
    for (const x of [1, 3.25, 5.5]) c.box(x - 0.25, 3, 0.5, 5, { mat: iron, z: 1.5, bevel: 0.2 });
    c.capsule(2.6, 1.2, 4.4, 1.2, 0.3, 0.3, { mat: iron, z: 1.4 });
    return c.render(HD_RENDER);
  });
}

/** Lantern box offset from the `hand` point (1× px): the ring sits in the hand. */
const LANTERN_DX = -3;
const LANTERN_DY = -1;
/** The flame's centre in the lantern box. */
export const WINKEL_FLAME_DX = LANTERN_DX + 3.5;
export const WINKEL_FLAME_DY = LANTERN_DY + 5.5;

function winkelFrame(pose: Pose, trail: number, i: number, d: Density): Frame {
  const dd = (p: Piece): Piece => (d === 1 ? p : { ...p, density: d });
  const upper = renderHuman(WINKEL_STYLE, { weapon: 'none', ...pose }, 'upper', d);
  const lower = renderHuman(WINKEL_STYLE, { weapon: 'none', ...pose }, 'lower', d);
  const hip = lower.pts?.hip ?? [0, -15];
  // The dress hides the legs: an empty lower frame of the same geometry carries the skirt.
  const sk = d === 1 ? skirt1(trail, i) : skirtHd(trail, i, hdOf(d));
  const blank: Frame = { buf: new PixelBuffer(lower.buf.w, lower.buf.h), ox: lower.ox, oy: lower.oy, pts: lower.pts, density: lower.density };
  const legs = withPieces(blank, [dd({ buf: sk, x: Math.round(hip[0]) - 7 + Math.round((pose.lean ?? 0) / 10), y: Math.round(hip[1]) - 2 })]);
  let f = stackFrames(legs, upper);
  const head: V2 = f.pts?.head ?? [0, -30];
  const h: V2 = f.pts?.hand ?? [5, -14];
  f = withPieces(f, [
    dd({ buf: d === 1 ? bun1() : bunHd(hdOf(d)), x: Math.round(head[0]) - 9, y: Math.round(head[1]) - 8, behind: true }),
    dd({ buf: d === 1 ? lantern1() : lanternHd(hdOf(d)), x: Math.round(h[0]) + LANTERN_DX, y: Math.round(h[1]) + LANTERN_DY }),
  ]);
  if (d !== 1) ageLines(f, head, d);
  return f;
}

/** The skin ramp's tones one step darker (for the lines of her face). */
const SKIN_DOWN = new Map<number, number>();
{
  const sk = PAL_HD.skinA as unknown as readonly number[];
  for (let i = 3; i < sk.length; i++) SKIN_DOWN.set(sk[i] >>> 0, sk[i - 1] >>> 0);
}
/** Her face's lines (head-centre offsets, logical px; she faces right): under the eye, the cheek fold. */
const AGE_LINES: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.4, 2.7, 2.4, 3.0],
  [3.1, 3.3, 2.5, 4.7],
];

/**
 * A middle-aged face at 2× / 4× (spec §6): a soft line under the eye and the fold from the nose
 * to the mouth corner, one dense px wide, only on skin (a tilted head never paints the hair).
 */
function ageLines(f: Frame, head: V2, d: number): void {
  const b = f.buf;
  for (const [x0, y0, x1, y1] of AGE_LINES) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * d) + 1;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const X = Math.round((f.ox + head[0] + x0 + (x1 - x0) * u) * d);
      const Y = Math.round((f.oy + head[1] + y0 + (y1 - y0) * u) * d);
      if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue;
      const c = b.data[Y * b.w + X] >>> 0;
      const to = SKIN_DOWN.get(c);
      if (to !== undefined) b.data[Y * b.w + X] = to;
    }
  }
}

for (const [name, s] of Object.entries(WINKEL_STRIPS)) {
  const gen = (d: Density) => (): Frame[] => s.poses.map((p, i) => winkelFrame(p, s.trail, i, d));
  defineSprite(`npc/oz-winkel/${name}`, gen(1), { ticksPerFrame: s.ticks, hd: (d) => gen(d)() });
}

/** The soft glow behind her (additive pass of drawGhost): 1× 24 × 40, feet anchor. */
function glowFrame(d: number): Frame {
  const W = 24;
  const H = 40;
  const b = new PixelBuffer(W * d, H * d);
  const ramp: readonly Color[] = d === 1 ? [PAL.green[0], PAL.green[1], PAL.green[2]] : [PAL_HD_OZ.ghost[0], PAL_HD_OZ.ghost[1], PAL_HD_OZ.ghost[2], PAL_HD_OZ.ghost[3]];
  for (let Y = 0; Y < H * d; Y++) {
    for (let X = 0; X < W * d; X++) {
      const x = (X + 0.5) / d - W / 2;
      const y = (Y + 0.5) / d - H * 0.55;
      const r = Math.hypot(x / 11, y / 19);
      if (r >= 1) continue;
      const k = 1 - r;
      // Ordered steps on 2 × 2 logical cells: soft without a single-px checker.
      const cell = ((((X / d) >> 1) & 1) * 2 + (((Y / d) >> 1) & 1)) / 4;
      const t = Math.min(ramp.length - 1, Math.floor(k * ramp.length + cell * 0.6));
      b.set(X, Y, ramp[t]);
    }
  }
  return d === 1 ? { buf: b, ox: W / 2, oy: H } : { buf: b, ox: W / 2, oy: H, density: d };
}
defineSprite('npc/oz-winkel/glow', () => [glowFrame(1)], { hd: (d) => [glowFrame(d)] });

/** The green lantern flame (4 frames, centre anchor, 1× 5 × 7): flat emissive, no ink (it is light). */
function flameFrame(i: number, d: number): Frame {
  const W = 5;
  const H = 7;
  const b = new PixelBuffer(W * d, H * d);
  const ramp: readonly Color[] = d === 1 ? [PAL.green[1], PAL.green[2], PAL.green[3], PAL.snow[3]] : [PAL_HD_OZ.ghost[2], PAL_HD_OZ.ghost[3], PAL_HD_OZ.ghost[4], PAL_HD_OZ.ghost[5], PAL_HD_OZ.ghost[6]];
  const sway = [0, 0.4, 0.1, -0.35][i & 3];
  const tall = [1, 0.9, 1.05, 0.95][i & 3];
  for (let Y = 0; Y < H * d; Y++) {
    for (let X = 0; X < W * d; X++) {
      const y = (Y + 0.5) / d;
      const t = (H - y) / (H * tall);
      if (t <= 0 || t >= 1) continue;
      const cx = W / 2 + sway * t * 2;
      const half = 1.9 * Math.sin(Math.PI * Math.min(1, (1 - t) * 1.15)) * (1 - t * 0.35);
      const x = (X + 0.5) / d - cx;
      if (Math.abs(x) >= half) continue;
      const heat = (1 - Math.abs(x) / half) * (1 - t * 0.6);
      b.set(X, Y, ramp[Math.min(ramp.length - 1, Math.floor(heat * ramp.length))]);
    }
  }
  return d === 1 ? { buf: b, ox: 2, oy: 4 } : { buf: b, ox: 2, oy: 4, density: d };
}
defineSprite('npc/oz-winkel/flame', () => [0, 1, 2, 3].map((i) => flameFrame(i, 1)), { ticksPerFrame: 5, hd: (d) => [0, 1, 2, 3].map((i) => flameFrame(i, d)) });
