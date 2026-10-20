/**
 * Art of the people and the life of Amsterdam (mission `ams`, docs/design/amsterdam.md §1, §5).
 * All drawn by code, 64-colour palette, 1-px ink outline, light from the top-left.
 *
 * NPC strips (feet anchor, humans 35–37 px, facing right):
 * - `npc/ams/ams-baker/<anim>`          idle talk toss walk clap cheer wave
 * - `npc/ams/ams-hotdog-vendor/<anim>`  idle salute talk wave
 * - `npc/ams/ams-staff/<look>/<anim>`   look 0–2; idle walk clap cheer wave
 *   Motion (docs/ART_GUIDE.md "Motion"): idle 4 (breathing), clap 4 and wave 4 (tweened loops);
 *   per person a `turn` (2, turnSquash of the idle frame) and `in-<mode>` (2: in-betweens from the
 *   idle frame to the mode's first frame) for the modes of `TRANSITION_MODES`; entities.ts plays
 *   them forward into the mode and backward out of it (draw only).
 * - `npc/ams/counter`                   a small Fabel Friet counter drawn in front of an NPC
 *
 * Ambient life: `npc/ams/ams-tour-boat` (2, wake), `npc/ams/ams-cyclist-bg/<look>` (4, pedalling;
 * look 0–3), `npc/ams/ams-pigeons` (5: stand, peck, step, wings up, wings down),
 * `npc/ams/ams-ducks` (4: drake bob up / down, hen bob up / down),
 * `npc/ams/ams-window-waver/person` (4: empty, idle, wave a, wave b), `…/cat` (2).
 * Decor: `decor/ams/ams-boat-platform` (2, wake), breakables `decor/ams/<id>` (0 intact,
 * 1 broken) for ams-herring-cart, ams-tulip-stall, ams-market-stall, ams-bike-rack.
 *
 * UHD art (docs/ART_GUIDE.md "UHD art"): every id here except the breakables and the boat platform
 * (their dense art lives with the city decor) has ONE density-generic generator for 2× and 4×
 * (`hd: (d) => …`): the rig at d (renderHuman), and the aprons, fry scoop, saluting forearm,
 * counter, omafiets and sash window painted natively with the UHD kit (HdCanvas, PAL_HD, outline
 * A, rim light; `…Hd` below), each fitted into its 1× footprint. The vendor's tricolour cap is
 * recoloured on the HD red ramp. The ambient pigeons, ducks, tour boat and window cat have their
 * HD art in npc-hi.art.ts.
 */
import type { Color } from '../../../../engine/color';
import { drawText } from '../../../../engine/font';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD, hdHome } from '../../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames } from '../../../../engine/sprites';
import { turnSquash } from '../../creatures/draw';
import { inbetween, tween } from '../../../art/tween';
import { HdCanvas, folds, texAll, wood, type DrawOpts, type HdMaterial, type RenderOpts, type Texture } from '../../../art/hd';
import { spanOf } from '../../../art/hd/body';
import { withPieces, type Piece } from '../../../art/human-fx';
import { withSwing } from '../../../art/human-sprites';
import { renderHuman, stackFrames, type ArmPose, type Density, type HumanStyle, type LegPose, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';

type V2 = readonly [number, number];

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand?: ArmPose['hand']): ArmPose => (hand ? { sh, el, hand } : { sh, el });

// ------------------------------------------------------------------------------------ styles

export const BAKER_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'black',
  accent: 'gold',
  top: 'cloth',
  topType: 'shirt',
  pants: 'black',
  boots: 'black',
  belt: 'black',
  gloves: null,
  build: 'normal',
  face: ['stubble'],
};

export const VENDOR_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'red',
  accent: 'navy',
  top: 'sky',
  topType: 'shirt',
  pants: 'slate',
  boots: 'black',
  belt: 'brown',
  gloves: null,
  build: 'heavy',
  face: ['moustache'],
};

/** Fabel Friet staff, `look` 0–2. */
export const STAFF_STYLES: readonly HumanStyle[] = [
  { skin: 'skinA', hair: 'hairC', hairStyle: 'ponytail', headgear: 'none', top: 'cloth', topType: 'shirt', pants: 'black', boots: 'black', belt: 'black', gloves: null, build: 'slim', face: ['freckles'] },
  { skin: 'skinC', hair: 'hairA', hairStyle: 'curly', headgear: 'cap', gear: 'black', accent: 'gold', top: 'teal', topType: 'shirt', pants: 'slate', boots: 'black', belt: 'black', gloves: null, build: 'normal' },
  { skin: 'skinB', hair: 'hairA', hairStyle: 'bob', headgear: 'none', top: 'red', topType: 'shirt', pants: 'black', boots: 'brown', belt: 'black', gloves: null, build: 'slim', face: ['glasses'] },
];

export const STAFF_LOOKS = STAFF_STYLES.length;

// ------------------------------------------------------------------------------------ poses

const ARMS_DOWN: Pose = { armN: A(6, 24, 'open'), armF: A(-4, 20, 'open') };

/** Breathing at rest, the arms loose (4 hand-keyed frames: shoulders drop, head nods). */
export const IDLE: readonly Pose[] = P.seq({ ...P.STAND, ...ARMS_DOWN }, P.BREATH4);

/** Clapping: the two hands meet in front of the chest, then part. (The far shoulder sits 2 px ahead.) */
export const CLAP: readonly Pose[] = [
  { ...P.STAND, armN: { to: [9, 1], hand: 'open' }, armF: { to: [7, 1], hand: 'open' }, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, 3], hand: 'open' }, armF: { to: [3, 3], hand: 'open' }, expr: 'shout', bob: 1 },
];

/** A friendly wave with the near hand high beside the head. */
export const WAVE: readonly Pose[] = [
  { ...P.STAND, armN: { to: [7, -10], hand: 'open' }, armF: A(-4, 20, 'open'), expr: 'happy' },
  { ...P.STAND, armN: { to: [10, -7], hand: 'open' }, armF: A(-4, 20, 'open'), expr: 'happy' },
];

/** The vendor's salute: P.SALUTE with a calm, friendly face and a straight back. */
export const SALUTE_CALM: readonly Pose[] = P.SALUTE.map((p, i) => ({
  ...p,
  ...P.STAND,
  armN: { to: i === 0 ? [9, -11] : [10, -11], hand: 'open', bend: 'up' } as ArmPose,
  lean: 0,
  expr: i === 0 ? 'happy' : 'normal',
}));

/** Talking: the near hand (with the fry scoop) gestures, the mouth opens and shuts. */
export const TALK: readonly Pose[] = [
  { ...P.STAND, armN: { to: [8, -1], hand: 'grip' }, armF: A(-4, 20, 'open'), expr: 'shout' },
  { ...P.STAND, armN: { to: [9, -5], hand: 'grip' }, armF: { to: [6, 2], hand: 'open' }, expr: 'happy' },
  { ...P.STAND, armN: { to: [8, -2], hand: 'grip' }, armF: { to: [7, 1], hand: 'open' }, expr: 'shout', bob: 1 },
  { ...P.STAND, armN: { to: [7, 3], hand: 'grip' }, armF: A(-4, 20, 'open'), expr: 'normal' },
];

/** The baker holds the scoop at his belt (breathing, 4 frames). */
const HOLD_SCOOP: readonly Pose[] = P.seq({ ...P.STAND, armN: { to: [6, 7], hand: 'grip' }, armF: A(-4, 20, 'open') }, P.BREATH4);

/** Toss: wind-up, overhead, release (frame 2: the item leaves the `hand` point), follow-through. */
export const TOSS: readonly Pose[] = [
  { ...P.STAND, armN: A(-100, 80, 'fist'), armF: A(20, 40, 'open'), lean: -6, expr: 'shout' },
  { ...P.STAND, armN: A(-160, 50, 'fist'), armF: A(30, 40, 'open'), lean: -10, expr: 'shout' },
  { legN: L(30, 14), legF: L(-20, 12), armN: { to: [10, -8], hand: 'open' }, armF: A(10, 30, 'open'), lean: 8, expr: 'happy' },
  { legN: L(30, 14), legF: L(-20, 12), armN: A(80, 10, 'open'), armF: A(0, 24, 'open'), lean: 8, expr: 'happy' },
];
/** Frame of TOSS on which the item leaves the hand. */
export const TOSS_RELEASE = 2;
export const TOSS_TICKS = 7;

const WALK_POSES: readonly Pose[] = withSwing(P.WALK, 0.6, 30);

/** Clap and wave as 4-frame loops: one eased in-between at each turning point. */
export const CLAP4: readonly Pose[] = tween(BAKER_STYLE, CLAP, { counts: 1, loop: true, ease: 'inOut' });
export const WAVE4: readonly Pose[] = tween(BAKER_STYLE, WAVE, { counts: 1, loop: true, ease: 'inOut' });

/** Modes with a 2-frame `in-<mode>` transition strip (from the idle frame; played backward to leave). */
export const TRANSITION_MODES: readonly string[] = ['talk', 'clap', 'cheer', 'wave'];
/** Ticks per frame of the `in-<mode>` and `turn` strips. */
export const PERSON_TR_TICKS = 3;
export const PERSON_TURN_TICKS = 2;
/** Walk speed (px/tick) the person walk strips are drawn for (6 ticks per frame). */
export const PERSON_WALK_SPEED = 0.8;

// ------------------------------------------------------------------------------------ pieces

/** A long dark Fabel Friet apron with gold piping, hanging from the belt. */
function darkApron(): PixelBuffer {
  const b = new PixelBuffer(8, 13);
  b.rect(0, 0, 8, 13, PAL.black[2]);
  b.vline(0, 0, 12, PAL.black[3]);
  b.vline(7, 0, 12, PAL.black[1]);
  b.hline(0, 7, 0, PAL.gold[1]);
  b.hline(0, 7, 12, PAL.gold[1]);
  // A small gold "F" on the pocket.
  b.vline(3, 4, 7, PAL.gold[2]);
  b.hline(3, 5, 4, PAL.gold[2]);
  b.set(4, 5, PAL.gold[2]);
  return b.padded(1).outline(INK);
}

/** The vendor's white apron with a mustard smear. */
function whiteApron(): PixelBuffer {
  const b = new PixelBuffer(9, 11);
  b.rect(0, 0, 9, 11, PAL.cloth[2]);
  b.hline(0, 8, 0, PAL.cloth[3]);
  b.vline(8, 1, 10, PAL.cloth[1]);
  b.set(5, 6, PAL.gold[2]);
  b.set(6, 6, PAL.gold[1]);
  b.set(2, 3, PAL.red[2]);
  return b.padded(1).outline(INK);
}

/** A steel fry scoop full of golden fries (hand at its handle, (1, 6)). */
function scoop(): PixelBuffer {
  const b = new PixelBuffer(9, 10);
  for (const [x, top] of [[3, 0], [4, 1], [5, 0], [6, 2], [7, 1]] as const) b.vline(x, top + 1, 5, PAL.gold[top & 1 ? 2 : 3]);
  b.poly([[2, 4], [8, 4], [7, 8], [3, 8]], PAL.steel[3]);
  b.hline(3, 7, 8, PAL.steel[2]);
  b.line(1, 7, 3, 6, PAL.steel[2]);
  return b.outline(INK);
}

// ------------------------------------------------------------------------------------ UHD pieces

/** A dense density of the UHD art. */
export type HdD = 2 | 4;

/** The cast's sprite look (style decisions): outline A, a cool rim light, AO — as the rig. */
export const HD_RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

/** Finished HD pieces (each a pure function of its key: same input, same pixels). */
const hdPieces = new Map<string, PixelBuffer>();
function hdCached(key: string, make: () => PixelBuffer): PixelBuffer {
  let b = hdPieces.get(key);
  if (!b) {
    b = make();
    hdPieces.set(key, b);
  }
  return b;
}

/** 2 or 4 for a dense density. */
export function hdOf(d: number): HdD {
  return d >= 4 ? 4 : 2;
}

/**
 * Keep a drawing inside the 1× footprint `lo` placed at logical (ox, oy) on the canvas (geometry
 * is law): every art px outside the opaque box of the 1× piece less its 1-px outline is dropped
 * BEFORE the render, so outline A wraps a clean edge inside the 1× box instead of being cut by it
 * (as the rig's `fitFrame`).
 */
export function fitHd(c: HdCanvas, lo: PixelBuffer, ox = 0, oy = 0): void {
  const b = lo.trimBounds();
  if (!b) return;
  const x0 = b.x + ox + 1;
  const y0 = b.y + oy + 1;
  const x1 = b.x + ox + b.w - 1;
  const y1 = b.y + oy + b.h - 1;
  c.erase(0, 0, c.w, c.h, (x, y) => x < x0 || x > x1 || y < y0 || y > y1);
}

/** A short stable key of a ramp (piece caches). */
function rampKey(r: Ramp): string {
  let k = '';
  for (const c of r) k += (c >>> 0).toString(36) + '.';
  return k;
}

/** Cloth of a 1× style ramp in the rig's bands (hd/body.ts `spanOf`), so a piece matches the figure's cloth. */
export function clothOf(c: HdCanvas, r: Ramp, o: Partial<HdMaterial> = {}): number {
  const s = spanOf(r);
  return c.material({ ramp: s.ramp, lo: s.lo, hi: s.hi, wrap: 0.05, rim: 0.05, ...o });
}

/** Skin of a 1× skin ramp in the rig's bands (hd/body.ts `Painter.skin`). */
export function skinOf(c: HdCanvas, r: Ramp): number {
  const s = spanOf(r);
  const top = Math.min(s.ramp.length - 2, s.hi);
  return c.material({ ramp: s.ramp, lo: Math.max(1, top - 3), hi: top, spec: 0.2, shine: 18, wrap: 0.1, rim: 0.05, amb: 0.12 });
}

const goldMat = (c: HdCanvas): number => c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 0.9, shine: 22 });
const steelMat = (c: HdCanvas): number => c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 1, shine: 26 });

/** A dashed seam `inset` logical px inside the box x, y, w, h (stitches: dashes at 4×, a dotted line at 2×). */
function stitches(x: number, y: number, w: number, h: number, inset = 0.5): Texture {
  return (s) => {
    const dl = s.x - x;
    const dr = x + w - s.x;
    const dt = s.y - y;
    const db = y + h - s.y;
    const m = Math.min(dl, dr, dt, db);
    if (Math.floor(m * s.d) !== Math.floor(inset * s.d)) return;
    const along = dl === m || dr === m ? s.y : s.x;
    const per = s.d >= 4 ? 0.75 : 1;
    if ((((along / per) % 1) + 1) % 1 < 0.5) s.tone -= 0.32;
  };
}

/**
 * The dark Fabel Friet apron (the `darkApron` box, 10 × 15 with its outline): heavy black cloth
 * hanging in soft vertical folds, the torso's shadow under the waistband, gold piping at the
 * waist and the hem, a stitched pocket with the gold "F" standing off it.
 */
function darkApronHd(d: HdD): PixelBuffer {
  return hdCached(`dark-apron@${d}`, () => {
    const c = new HdCanvas(10, 15, d);
    const cloth = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, wrap: 0.05, spec: 0.35, shine: 10, rim: 0.12 });
    const gold = goldMat(c);
    const body = c.newPart();
    c.blob([[1, 1], [9, 1], [9, 14], [1, 14]], 1.1, { mat: cloth, part: body, bulge: 0.25, tex: folds({ angle: Math.PI / 2, spacing: 2, amp: 1, cover: 0.8, seed: 21 }) });
    c.shade(1, 2, 8, 2.5, (_x, y) => -0.35 * Math.max(0, 1 - (y - 2) / 2.5), body);
    c.box(1, 1, 8, 1.1, { mat: gold, z: 2, bevel: 0.4 });
    c.box(1, 13, 8, 1, { mat: gold, z: 2, bevel: 0.4 });
    c.box(3, 4.2, 5, 5.4, { mat: cloth, z: 2, bevel: 0.45, r: 0.25, tone: 0.08, tex: stitches(3, 4.2, 5, 5.4) });
    const F = { mat: gold, z: 2.6, bevel: 0.3 };
    c.box(4, 5, 1, 4, F);
    c.box(4, 5, 3, 0.95, F);
    c.box(4, 6.6, 2, 0.8, F);
    return c.render(HD_RENDER);
  });
}

/**
 * The vendor's white apron (the `whiteApron` box, 11 × 13): warm white cotton in folds, a rolled
 * waistband, a slanted mustard smear and a glossy ketchup drop.
 */
function whiteApronHd(d: HdD): PixelBuffer {
  return hdCached(`white-apron@${d}`, () => {
    const c = new HdCanvas(11, 13, d);
    const cloth = c.material({ ramp: PAL_HD.cloth, lo: 1, hi: 5, wrap: 0.1, spec: 0.1, shine: 8 });
    const mustard = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.5, shine: 16 });
    const ketchup = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, spec: 0.9, shine: 24 });
    const body = c.newPart();
    const smear: Texture = (s) => {
      const u = (s.x - 7) * 0.9 + (s.y - 7.6) * 0.45;
      const v = -(s.x - 7) * 0.45 + (s.y - 7.6) * 0.9;
      if ((u / 1.6) ** 2 + (v / 0.55) ** 2 < 1) {
        s.mat = mustard;
        s.tone += 0.05;
      }
    };
    c.blob([[1, 1], [10, 1], [10, 12], [1, 12]], 1, { mat: cloth, part: body, bulge: 0.25, tex: texAll(folds({ angle: Math.PI / 2, spacing: 2.8, amp: 0.7, cover: 0.6, seed: 23 }), smear) });
    c.shade(1, 2, 9, 2.5, (_x, y) => -0.3 * Math.max(0, 1 - (y - 2) / 2.5), body);
    c.box(1, 1, 9, 1.2, { mat: cloth, z: 2, bevel: 0.45, tone: 0.1 });
    c.ellipsoid(3.5, 4.6, 0.75, 0.85, { mat: ketchup, z: 2, round: 0.6 });
    return c.render(HD_RENDER);
  });
}

/**
 * The steel fry scoop (the `scoop` box, 9 × 10; hand at its handle): single golden fries of
 * different heights and slants with crisp darker tips, a polished scoop with a rolled bright rim
 * and a darker belly, the handle.
 */
function scoopHd(d: HdD): PixelBuffer {
  return hdCached(`scoop@${d}`, () => {
    const c = new HdCanvas(9, 10, d);
    const steel = steelMat(c);
    const fry = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.25, shine: 10, wrap: 0.1 });
    const fries: ReadonlyArray<readonly [number, number, number]> = [
      [3.5, 1.3, -0.3],
      [4.4, 2.3, 0.2],
      [5.4, 1.1, 0.1],
      [6.4, 3.0, 0.4],
      [7.3, 2.1, 0.5],
      [4.9, 2.7, -0.2],
      [6.0, 2.4, 0.3],
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

/**
 * The saluting forearm (the 1× piece's 10 × 13 box): a sleeve of the shirt's cloth rising steeply
 * in front of the face, narrowed so the eye and the moustache stay clear, a cuff, and the flat
 * hand at the cap peak (fingers forward; finger lines at 4×).
 */
function saluteArmHd(top: Ramp, skin: Ramp, d: HdD): PixelBuffer {
  return hdCached(`salute:${rampKey(top)}:${rampKey(skin)}@${d}`, () => {
    const c = new HdCanvas(10, 13, d);
    const sleeve = clothOf(c, top);
    const sk = skinOf(c, skin);
    c.capsule(2.4, 11.2, 5.6, 5.4, 1.05, 0.8, { mat: sleeve, z: 0, tex: folds({ angle: 1.1, spacing: 1.6, amp: 0.6, seed: 31 }) });
    c.capsule(5.4, 5.6, 6.1, 4.3, 0.85, 0.75, { mat: sleeve, z: 0.5, tone: 0.12 });
    c.blob([[4.7, 1.2], [7.9, 1.1], [8.5, 2.2], [8, 3.6], [5.4, 4], [4.6, 2.9]], 0.6, {
      mat: sk,
      z: 1,
      bulge: 0.2,
      tex: (s) => {
        if (s.d >= 4 && s.x > 6.2 && (Math.abs(s.y - 2.05) < 0.13 || Math.abs(s.y - 2.85) < 0.13)) s.tone -= 0.3;
      },
    });
    return c.render(HD_RENDER);
  });
}

/** Map every tone of ramp `from` in rows y0 ≤ y < y1 of `b` (art px) to the same-index tone of `to`. */
function remap(b: PixelBuffer, y0: number, y1: number, from: Ramp, to: Ramp): void {
  for (let y = Math.max(0, y0); y < Math.min(b.h, y1); y++) {
    for (let x = 0; x < b.w; x++) {
      const i = from.indexOf(b.get(x, y));
      if (i >= 0) b.set(x, y, to[Math.min(to.length - 1, i)]);
    }
  }
}

/** The cap's white band and blue peak (HD tones, index for index with the red crown's ramp). */
const CAP_BAND: Ramp = [PAL_HD.snow[0], PAL_HD.snow[1], PAL_HD.snow[2], PAL_HD.snow[3], PAL_HD.snow[4], PAL_HD.snow[5], PAL_HD.snow[6], PAL_HD.snow[6]];
const CAP_PEAK: Ramp = [PAL_HD.navy[0], PAL_HD.navy[1], PAL_HD.navy[2], PAL_HD.navy[3], PAL_HD.navy[4], PAL_HD.sky[1], PAL_HD.sky[2], PAL_HD.sky[3]];

/** `tricolorCap` on an HD frame: the crown stays red, logical row 2 of the cap turns white, rows 3+ blue (the HD red ramp, tone for tone). */
function tricolorCapHd(f: Frame): Frame {
  const head = f.pts?.head;
  const d = f.density ?? 1;
  if (!head || d === 1) return f;
  const b = f.buf.clone();
  const RED = PAL_HD.red;
  const yMax = (f.oy + head[1]) * d;
  let top = -1;
  for (let y = 0; y < yMax && top < 0; y++) for (let x = 0; x < b.w; x++) if (RED.includes(b.get(x, y))) { top = y; break; }
  if (top < 0) return f;
  remap(b, top + 2 * d, Math.min(yMax, top + 3 * d), RED, CAP_BAND);
  remap(b, top + 3 * d, Math.min(yMax, top + 7 * d), RED, CAP_PEAK);
  return { ...f, buf: b };
}

/** Lower body with an apron hung at the hip, then the torso on top (like the hostage aprons). `apron` has density `d`. */
function figure(style: HumanStyle, pose: Pose, apron: PixelBuffer | null, d: Density = 1): Frame {
  if (!apron || pose.rot) return renderHuman(style, pose, 'full', d);
  const lower = renderHuman(style, pose, 'lower', d);
  const upper = renderHuman(style, pose, 'upper', d);
  const hip = lower.pts?.hip ?? [0, -15];
  const piece: Piece = { buf: apron, x: hip[0] - 4, y: hip[1] - 1 };
  if (d !== 1) piece.density = d;
  const legs = withPieces(lower, [piece]);
  return stackFrames(legs, upper);
}

/** The scoop in the near hand (`sc` has density `d`). */
function withScoop(f: Frame, sc: PixelBuffer, d: Density = 1): Frame {
  const h: V2 = f.pts?.hand ?? [4, -16];
  const pieces: Piece[] = [d === 1 ? { buf: sc, x: h[0] - 2, y: h[1] - 8 } : { buf: sc, x: h[0] - 2, y: h[1] - 8, density: d }];
  return withPieces(f, pieces);
}

/** The saluting forearm: a sleeve from the chest up to a flat hand at the cap peak (`d` ≥ 2: the HD piece in the same box). */
function withSaluteArm(f: Frame, style: HumanStyle, d: Density = 1): Frame {
  const h: V2 = f.pts?.hand ?? [6, -28];
  const top: readonly Color[] = typeof style.top === 'string' ? PAL[style.top as keyof typeof PAL] : PAL.sky;
  const skin: readonly Color[] = typeof style.skin === 'string' && PAL[style.skin as keyof typeof PAL].length >= 4 ? PAL[style.skin as keyof typeof PAL] : PAL.skinA;
  if (d !== 1) return withPieces(f, [{ buf: saluteArmHd(top, skin, hdOf(d)), x: Math.round(h[0]) - 6, y: Math.round(h[1]) - 1, density: d }]);
  const b = new PixelBuffer(10, 13);
  b.thickLine(2, 10, 5, 4, 2, top[Math.min(2, top.length - 1)]);
  b.line(1, 11, 4, 5, top[Math.min(1, top.length - 1)]);
  b.rect(4, 1, 4, 3, skin[2]);
  b.hline(4, 7, 1, skin[3]);
  b.outline(INK);
  return withPieces(f, [{ buf: b, x: Math.round(h[0]) - 6, y: Math.round(h[1]) - 1 }]);
}

/** Paint the vendor's cap red (crown) / white (band) / navy (peak): the cap is the red area over the head. */
function tricolorCap(f: Frame): Frame {
  const head = f.pts?.head;
  if (!head) return f;
  const d = f.density ?? 1;
  const b = f.buf.clone();
  const reds = new Set<number>([PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]]);
  const yMax = (f.oy + head[1]) * d - 1;
  let top = -1;
  for (let y = 0; y <= yMax && top < 0; y++) for (let x = 0; x < b.w; x++) if (reds.has(b.get(x, y))) { top = y; break; }
  if (top < 0) return f;
  for (let y = top; y <= Math.min(yMax, top + 7 * d - 1); y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (!reds.has(c)) continue;
      const row = Math.floor((y - top) / d);
      if (row === 2) b.set(x, y, c === PAL.red[3] || c === PAL.red[2] ? PAL.snow[3] : PAL.cloth[1]);
      else if (row >= 3) b.set(x, y, c === PAL.red[3] || c === PAL.red[2] ? PAL.sky[1] : PAL.navy[1]);
    }
  }
  return { ...f, buf: b };
}

// ------------------------------------------------------------------------------------ NPC strips

interface Strip {
  poses: readonly Pose[];
  ticks: number;
  loop?: boolean;
  scoop?: boolean;
  /** Draw the saluting forearm in front of the face (the rig hides a near arm that crosses it). */
  salute?: boolean;
}

function defineStrips(prefix: string, style: HumanStyle, apron: (d: Density) => PixelBuffer | null, strips: Readonly<Record<string, Strip>>, post?: (f: Frame) => Frame): void {
  const ap: Array<PixelBuffer | null | undefined> = [];
  const sc: Array<PixelBuffer | undefined> = [];
  const gen = (s: Strip, d: Density) => (): Frame[] => {
    if (ap[d] === undefined) ap[d] = apron(d);
    return s.poses.map((p) => {
      let f = figure(style, { weapon: 'none', ...p }, ap[d] ?? null, d);
      if (s.scoop) f = withScoop(f, (sc[d] ??= d === 1 ? scoop() : scoopHd(hdOf(d))), d);
      if (s.salute) f = withSaluteArm(f, style, d);
      return post ? post(f) : f;
    });
  };
  for (const [name, s] of Object.entries(strips)) {
    defineSprite(`${prefix}/${name}`, gen(s, 1), { ticksPerFrame: s.ticks, loop: s.loop ?? true, hd: (d) => gen(s, d)() });
  }
  // Mode transitions: two eased in-betweens from the idle frame to the mode's first frame.
  const idle = strips.idle;
  if (!idle) return;
  for (const m of TRANSITION_MODES) {
    const to = strips[m];
    if (!to) continue;
    const a = idle.poses[0];
    const b = to.poses[0];
    // The wave's second in-between bends the elbow up (a straight arm held out at shoulder height
    // read as an odd reach); the other modes ease straight in.
    const second = m === 'wave' ? { ...inbetween(style, a, b, 0.7, { hold: 'b' }), armN: A(95, 45, 'open') } : inbetween(style, a, b, 0.7, { hold: 'b' });
    const tr: Strip = { poses: [inbetween(style, a, b, 0.35, { hold: 'b' }), second], ticks: PERSON_TR_TICKS, scoop: to.scoop };
    defineSprite(`${prefix}/in-${m}`, gen(tr, 1), { ticksPerFrame: PERSON_TR_TICKS, loop: false, hd: (d) => gen(tr, d)() });
  }
  // Turn-around: the idle frame squeezed (play narrowing, flip, widening). The HD turn squeezes
  // its own idle frame (made here, not read from the registry: a deferred 4× read would hand
  // back the 2× frame).
  defineSprite(`${prefix}/turn`, () => turnSquash(getFrames(`${prefix}/idle`, 1)[0]), {
    ticksPerFrame: PERSON_TURN_TICKS,
    hd: (d) => turnSquash(gen(idle, d)()[0]),
  });
}

const dark = (d: Density): PixelBuffer => (d === 1 ? darkApron() : darkApronHd(hdOf(d)));
const white = (d: Density): PixelBuffer => (d === 1 ? whiteApron() : whiteApronHd(hdOf(d)));

defineStrips('npc/ams/ams-baker', BAKER_STYLE, dark, {
  idle: { poses: HOLD_SCOOP, ticks: 15, scoop: true },
  talk: { poses: TALK, ticks: 8, scoop: true },
  toss: { poses: TOSS, ticks: TOSS_TICKS, loop: false },
  walk: { poses: WALK_POSES, ticks: 6 },
  clap: { poses: CLAP4, ticks: 3 },
  cheer: { poses: P.VICTORY, ticks: 8 },
  wave: { poses: WAVE4, ticks: 5 },
});

defineStrips(
  'npc/ams/ams-hotdog-vendor',
  VENDOR_STYLE,
  white,
  {
    idle: { poses: IDLE, ticks: 15 },
    salute: { poses: SALUTE_CALM, ticks: 20, salute: true },
    talk: { poses: TALK, ticks: 8 },
    wave: { poses: WAVE4, ticks: 5 },
  },
  (f) => ((f.density ?? 1) === 1 ? tricolorCap(f) : tricolorCapHd(f)),
);

STAFF_STYLES.forEach((style, i) => {
  defineStrips(`npc/ams/ams-staff/${i}`, style, dark, {
    idle: { poses: IDLE, ticks: 15 + i * 2 },
    walk: { poses: WALK_POSES, ticks: 6 },
    clap: { poses: CLAP4, ticks: 3 + (i % 2) },
    cheer: { poses: P.VICTORY, ticks: 8 },
    wave: { poses: WAVE4, ticks: 5 },
  });
});

/** A small cream Fabel Friet counter (26×15, feet anchor) with two paper fry cones on it. */
defineSprite('npc/ams/counter', () => {
  const b = new PixelBuffer(28, 18);
  // Fry cones (red-white paper, gold fries).
  for (const cx of [6, 20]) {
    b.poly([[cx - 2, 5], [cx + 2, 5], [cx, 9]], PAL.red[2]);
    b.set(cx, 6, PAL.cloth[3]);
    for (const dx of [-2, -1, 0, 1, 2]) b.vline(cx + dx, 2 + (dx & 1), 4, PAL.gold[dx & 1 ? 2 : 3]);
  }
  b.rect(1, 8, 26, 9, PAL.cloth[2]);
  b.hline(1, 26, 8, PAL.cloth[3]);
  b.hline(1, 26, 9, PAL.gold[1]);
  b.strokeRect(4, 11, 9, 5, PAL.cloth[1]);
  b.strokeRect(15, 11, 9, 5, PAL.cloth[1]);
  b.vline(26, 9, 16, PAL.stone[3]);
  b.hline(1, 26, 16, PAL.stone[2]);
  return { buf: b.outline(INK), ox: 14, oy: 18 };
}, { hd: (d) => counterHd(hdOf(d)) });

/**
 * The HD counter (the 1× 28 × 18 box, feet anchor): a cream-painted front with two moulded
 * panels (the recess shaded from the top-left), a lit counter-top slab with a gold trim, a stone
 * kick plate, the shaded side face; two red-and-white striped paper cones of single fries on top.
 */
function counterHd(d: HdD): Frame {
  const c = new HdCanvas(28, 18, d);
  const cream = c.material({ ramp: PAL_HD.cloth, lo: 2, hi: 5, spec: 0.3, shine: 14, wrap: 0.05, amb: 0.3 });
  const gold = goldMat(c);
  const stone = c.material({ ramp: PAL_HD.stone, lo: 1, hi: 5, spec: 0.1 });
  const paper = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, spec: 0.2, shine: 10 });
  const white = c.material({ ramp: PAL_HD.cloth, lo: 3, hi: 6, spec: 0.2, shine: 10 });
  const fry = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.25, shine: 10, wrap: 0.1 });
  const front = c.newPart();
  c.box(1, 9, 25, 8, { mat: cream, part: front, z: 0, bevel: 0.25 });
  // Panels: a raised moulding ring; inside it the panel face lies deeper (shade at its top and left).
  for (const x0 of [4, 15]) {
    const m = { mat: cream, z: 0.5, bevel: 0.35 };
    c.box(x0, 11, 9, 0.8, m);
    c.box(x0, 15.2, 9, 0.8, m);
    c.box(x0, 11, 0.8, 5, m);
    c.box(x0 + 8.2, 11, 0.8, 5, m);
    c.shade(x0 + 0.8, 11.8, 7.4, 3.4, (x, y) => (y < 12.4 || x < x0 + 1.3 ? -0.3 : x > x0 + 7.7 || y > 14.7 ? 0.12 : 0), front);
  }
  // The side face (turned away from the light), the kick plate, the slab and its gold trim.
  c.box(26, 9, 1, 8, { mat: cream, z: 0.2, n: [0.85, 0.1, 0.5] });
  c.box(1, 15.9, 26, 1.1, { mat: stone, z: 0.8, bevel: 0.35 });
  c.box(1, 9, 26, 1, { mat: gold, z: 1, bevel: 0.35 });
  c.box(1, 8, 26, 1.1, { mat: cream, z: 1.4, bevel: 0.4, tone: 0.2 });
  // Paper cones of fries.
  for (const cx of [6.5, 20.5]) {
    const stripes: Texture = (s) => {
      if ((((s.x - cx) * 1.2 + s.y * 0.7) % 2 + 2) % 2 < 0.8) s.mat = white;
    };
    const fries: ReadonlyArray<readonly [number, number]> = [[-1.9, 2.6], [-0.9, 2.0], [0.1, 2.4], [1.0, 1.9], [1.9, 2.8], [-0.4, 3.0], [0.6, 3.1]];
    fries.forEach(([dx, top], k) => c.capsule(cx + dx + dx * 0.15, top, cx + dx * 0.7, 6, 0.42, 0.42, {
      mat: fry,
      z: 2 + (k % 3) * 0.15,
      round: 0.8,
      tone: k % 2 ? -0.06 : 0.06,
      tex: (s) => {
        if (s.y < top + 0.5) s.tone -= 0.3;
      },
    }));
    c.blob([[cx - 2.6, 5], [cx + 2.6, 5], [cx + 0.4, 9.6], [cx - 0.4, 9.6]], 0.9, { mat: paper, z: 2.6, bulge: 0.2, tex: stripes });
    c.box(cx - 2.6, 4.9, 5.2, 0.7, { mat: white, z: 2.8, bevel: 0.25 });
  }
  return { buf: c.render(HD_RENDER), ox: 14, oy: 18, density: d };
}

// ------------------------------------------------------------------------------------ tour boat

/** A long canal tour boat with a glass roof and tourists (112×30; feet = the water line). */
function tourBoat(phase: number): Frame {
  const W = 116;
  const b = new PixelBuffer(W, 32);
  // Hull.
  b.poly([[4, 20], [104, 20], [112, 21], [109, 27], [7, 27]], PAL.navy[1]);
  b.hline(5, 109, 20, PAL.sky[1]);
  b.hline(6, 108, 22, PAL.cloth[3]);
  b.hline(7, 107, 26, PAL.navy[0]);
  // Glass cabin: dark interior, tourists, struts, a curved glass roof.
  b.rect(14, 12, 86, 8, PAL.navy[0]);
  const skins: readonly Color[] = [PAL.skinA[2], PAL.skinB[2], PAL.skinC[2], PAL.skinA[3]];
  const hairs: readonly Color[] = [PAL.hairC[2], PAL.hairA[2], PAL.hairB[1], PAL.red[1], PAL.snow[2]];
  for (let i = 0; i < 12; i++) {
    const x = 18 + i * 7 + ((i * 5) % 3);
    b.circle(x, 16, 1, skins[i % skins.length]);
    b.hline(x - 1, x + 1, 14, hairs[(i * 3) % hairs.length]);
    b.rect(x - 2, 18, 5, 2, i % 3 === 0 ? PAL.red[2] : i % 3 === 1 ? PAL.gold[2] : PAL.teal[2]);
  }
  b.ellipse(12, 6, 90, 14, PAL.sky[2]);
  b.rect(12, 12, 90, 1, PAL.sky[3]);
  b.rect(14, 13, 86, 6, 0);
  // Re-draw the cabin interior under the arc so the roof is a band of glass.
  b.rect(14, 12, 86, 1, PAL.sky[3]);
  for (let x = 16; x < 100; x += 10) b.vline(x, 8, 19, PAL.snow[2]);
  b.hline(18, 96, 8, PAL.snow[3]);
  // Repaint the tourists over the cleared band.
  for (let i = 0; i < 12; i++) {
    const x = 18 + i * 7 + ((i * 5) % 3);
    b.rect(x - 2, 17, 5, 3, i % 3 === 0 ? PAL.red[2] : i % 3 === 1 ? PAL.gold[2] : PAL.teal[2]);
    b.circle(x, 15, 1, skins[i % skins.length]);
    b.hline(x - 1, x + 1, 13, hairs[(i * 3) % hairs.length]);
  }
  for (let x = 14; x < 100; x++) for (let y = 13; y < 20; y++) if (b.get(x, y) === 0) b.set(x, y, PAL.navy[0]);
  for (let x = 16; x < 100; x += 10) b.vline(x, 12, 19, PAL.snow[1]);
  // Pilot's window and the bow.
  b.rect(100, 14, 5, 6, PAL.sky[2]);
  b.set(101, 15, PAL.snow[3]);
  // A Dutch flag at the stern.
  b.vline(5, 6, 19, PAL.stone[3]);
  b.rect(6, 6, 6, 2, PAL.red[2]);
  b.rect(6, 8, 6, 2, PAL.cloth[3]);
  b.rect(6, 10, 6, 2, PAL.sky[1]);
  b.outline(INK);
  // Wake (no outline): foam at the bow and stern.
  const foam = phase ? [[112, 28], [108, 29], [3, 28], [0, 29], [104, 29]] : [[110, 28], [113, 29], [5, 29], [1, 28], [99, 29]];
  for (const [x, y] of foam) b.hline(x, Math.min(W - 1, x + 2), y, PAL.snow[3]);
  b.hline(10, 104, 28, PAL.sky[2]);
  return { buf: b, ox: 58, oy: 28 };
}
defineSprite('npc/ams/ams-tour-boat', () => [tourBoat(0), tourBoat(1)], { ticksPerFrame: 14 });

// ------------------------------------------------------------------------------------ boat platform

/** A small open wooden canal boat (60×18): the deck rail is the platform (top at the anchor). */
function smallBoat(phase: number): Frame {
  const b = new PixelBuffer(64, 22);
  b.poly([[2, 3], [61, 3], [57, 13], [8, 13]], PAL.brown[2]);
  b.hline(2, 61, 3, PAL.cloth[3]);
  b.hline(3, 60, 4, PAL.brown[3]);
  b.hline(5, 59, 8, PAL.brown[1]);
  b.hline(8, 57, 12, PAL.brown[0]);
  b.hline(6, 58, 10, PAL.teal[2]);
  // Outboard motor at the stern.
  b.rect(1, 0, 4, 6, PAL.steel[2]);
  b.hline(1, 4, 0, PAL.steel[3]);
  b.vline(3, 6, 14, PAL.steel[1]);
  // Bow fender.
  b.circle(59, 6, 1, PAL.cloth[2]);
  b.outline(INK);
  const foam = phase ? [[0, 15], [58, 14], [52, 15]] : [[2, 14], [60, 15], [48, 15]];
  for (const [x, y] of foam) b.hline(x, x + 3, y, PAL.snow[3]);
  b.hline(10, 54, 15, PAL.sky[2]);
  return { buf: b, ox: 32, oy: 2 };
}
defineSprite('decor/ams/ams-boat-platform', () => [smallBoat(0), smallBoat(1)], { ticksPerFrame: 12, anchor: 'top-left' });

// ------------------------------------------------------------------------------------ background cyclist

/** Rider looks: shirt, trousers, hair, bike frame colours. */
const CYCLISTS: readonly { style: HumanStyle; bike: Color }[] = [
  { style: { skin: 'skinA', hair: 'hairC', hairStyle: 'long', headgear: 'none', top: 'red', topType: 'jacket', pants: 'slate', boots: 'brown', gloves: null, build: 'slim', accessories: ['scarf'], accent: 'gold' }, bike: PAL.black[2] },
  { style: { skin: 'skinC', hair: 'hairA', hairStyle: 'short', headgear: 'none', top: 'teal', topType: 'shirt', pants: 'sand', boots: 'black', gloves: null, build: 'normal' }, bike: PAL.red[1] },
  { style: { skin: 'skinB', hair: 'hairB', hairStyle: 'bob', headgear: 'none', top: 'gold', topType: 'sweater', pants: 'black', boots: 'black', gloves: null, build: 'slim' }, bike: PAL.teal[1] },
  { style: { skin: 'skinA', hair: 'snow', hairStyle: 'parted', headgear: 'none', top: 'slate', topType: 'coat', pants: 'brown', boots: 'black', gloves: null, build: 'normal', face: ['glasses'] }, bike: PAL.olive[1] },
];
export const CYCLIST_LOOKS = CYCLISTS.length;

/** A Dutch bike (omafiets) 30×18 with the crank at the given phase; seat at (12, 3), bars at (24, 1). */
function bike(frame: Color, phase: number): PixelBuffer {
  const b = new PixelBuffer(34, 20);
  for (const cx of [7, 26]) {
    b.circle(cx, 13, 6, PAL.ink[1], false);
    b.circle(cx, 13, 5, PAL.stone[2], false);
    b.set(cx, 13, PAL.steel[3]);
  }
  // Step-through frame.
  b.line(7, 13, 14, 13, frame);
  b.line(14, 13, 12, 4, frame);
  b.line(14, 13, 24, 6, frame);
  b.line(24, 3, 26, 13, frame);
  b.line(12, 4, 7, 13, frame);
  // Saddle, bars, a front basket.
  b.hline(10, 14, 3, PAL.brown[1]);
  b.hline(22, 25, 2, PAL.steel[3]);
  b.rect(26, 4, 5, 4, PAL.brown[2]);
  b.hline(26, 30, 4, PAL.brown[3]);
  // Crank and pedals.
  const a = (phase / 4) * Math.PI * 2;
  const px = Math.round(14 + Math.cos(a) * 3);
  const py = Math.round(13 + Math.sin(a) * 3);
  b.line(14, 13, px, py, PAL.steel[2]);
  b.hline(px - 1, px + 1, py, PAL.black[3]);
  return b.outline(INK);
}

/** The seated rider with the legs on the pedals. */
const PEDAL: readonly Pose[] = [
  { legN: L(70, 70), legF: L(40, 100), armN: { to: [9, 2], hand: 'grip' }, armF: { to: [8, 2], hand: 'grip' }, lean: 14, grounded: false },
  { legN: L(55, 100), legF: L(60, 70), armN: { to: [9, 2], hand: 'grip' }, armF: { to: [8, 2], hand: 'grip' }, lean: 14, grounded: false },
  { legN: L(40, 100), legF: L(70, 70), armN: { to: [9, 2], hand: 'grip' }, armF: { to: [8, 2], hand: 'grip' }, lean: 14, grounded: false, bob: 1 },
  { legN: L(60, 70), legF: L(55, 100), armN: { to: [9, 2], hand: 'grip' }, armF: { to: [8, 2], hand: 'grip' }, lean: 14, grounded: false },
];

/** A ring (tyre, rim, fender) round (cx, cy) between radii r0 and r1, shaded as a tube; `arc` limits it to angles a0..a1 (rad, 0 = +x, y down). */
function ring(c: HdCanvas, cx: number, cy: number, r0: number, r1: number, o: DrawOpts, arc?: readonly [number, number]): void {
  const rm = (r0 + r1) / 2;
  const hw = (r1 - r0) / 2;
  c.plane(cx - r1, cy - r1, 2 * r1, 2 * r1, {
    ...o,
    mask: (x, y) => {
      const q = Math.hypot(x - cx, y - cy);
      if (q < r0 || q >= r1) return false;
      if (!arc) return true;
      const a = Math.atan2(y - cy, x - cx);
      return a >= arc[0] && a <= arc[1];
    },
    normal: (x, y, out) => {
      const dx = x - cx;
      const dy = y - cy;
      const q = Math.hypot(dx, dy) || 1;
      const t = Math.max(-1, Math.min(1, (q - rm) / hw));
      out[0] = (t * dx) / q;
      out[1] = (t * dy) / q;
      out[2] = Math.sqrt(Math.max(0.05, 1 - t * t));
    },
  });
}

/**
 * The HD omafiets (the `bike` box, 34 × 20; wheels at (7, 13) and (26, 13) on the 1× grid): black
 * rubber tyres, polished rims and fine spokes turning with the crank (a layer under the outlined
 * bike, so the spokes stay one art px thin), mudguards, the lacquered step-through frame with a
 * chain case, a sprung leather saddle, the handlebar with a grip, a wicker basket, the chain ring;
 * the crank arm and pedal on top at the pedalling phase. Fitted into the 1× bike's footprint.
 * The bike without the crank is painted once per colour and density (`bikeBaseHd`).
 */
export function bikeHd(frame: Color, phase: number, d: HdD): PixelBuffer {
  const W = 34;
  const H = 20;
  const lo = bike(frame, phase);
  // Spokes (one art px, no outline) under the bike.
  const sp = new HdCanvas(W, H, d);
  const spoke = sp.material({ ramp: PAL_HD.steel, lo: 3, hi: 6, flat: true });
  for (const cx of BIKE_WHEELS) {
    for (let k = 0; k < 4; k++) {
      const t = ((k + phase / 2) / 4) * Math.PI;
      const dx = Math.cos(t) * 4.6;
      const dy = Math.sin(t) * 4.6;
      sp.capsule(cx - dx, BIKE_HUB_Y - dy, cx + dx, BIKE_HUB_Y + dy, 0.5 / d, 0.5 / d, { mat: spoke, z: 0, tone: k & 1 ? 0.1 : -0.1 });
    }
  }
  const out = sp.render({ outline: 'none', ao: 0, clean: false, sep: false });
  out.blit(bikeBaseHd(frame, d), 0, 0);
  // The crank arm and pedal at the phase, outlined on their own (in front of the chain case).
  const c = new HdCanvas(W, H, d);
  const steel = steelMat(c);
  const rubber = c.material({ ramp: PAL_HD.black, lo: 0, hi: 3, spec: 0.3, shine: 12 });
  const a = (phase / 4) * Math.PI * 2;
  const px = 14.5 + Math.cos(a) * 3;
  const py = 13.5 + Math.sin(a) * 3;
  c.capsule(14.5, 13.5, px, py, 0.38, 0.38, { mat: steel, z: 2 });
  c.box(px - 1.2, py - 0.4, 2.4, 0.8, { mat: rubber, z: 2.2, bevel: 0.25, tone: 0.15 });
  fitHd(c, lo);
  out.blit(c.render(HD_RENDER), 0, 0);
  return out;
}

const BIKE_WHEELS: readonly number[] = [7.5, 26.5];
const BIKE_HUB_Y = 13.5;

/** The omafiets without its crank and spokes, per frame colour and density (cached). */
function bikeBaseHd(frame: Color, d: HdD): PixelBuffer {
  return hdCached(`bike:${frame >>> 0}@${d}`, () => {
    const home = hdHome(frame);
    const fr = home?.ramp ?? PAL_HD.black;
    const fi = home?.i ?? 2;
    const c = new HdCanvas(34, 20, d);
    const paint = c.material({ ramp: fr, lo: Math.max(1, fi - 2), hi: Math.min(fr.length - 2, fi + 2), spec: 0.8, shine: 26 });
    const rubber = c.material({ ramp: PAL_HD.black, lo: 0, hi: 3, spec: 0.3, shine: 12 });
    const steel = steelMat(c);
    const leather = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 5, spec: 0.5, shine: 18 });
    const wicker = c.material({ ramp: PAL_HD.wood, lo: 2, hi: 6, spec: 0.1 });
    const grip = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.4, shine: 14 });
    for (const cx of BIKE_WHEELS) {
      ring(c, cx, BIKE_HUB_Y, 5.35, 6.45, { mat: rubber, z: 0 });
      ring(c, cx, BIKE_HUB_Y, 4.55, 5.35, { mat: steel, z: 0.2 });
      c.ellipsoid(cx, BIKE_HUB_Y, 0.75, 0.75, { mat: steel, z: 0.5 });
      // The mudguard over the top of the tyre.
      ring(c, cx, BIKE_HUB_Y, 6.3, 6.9, { mat: paint, z: 0.6, tone: -0.05 }, [-Math.PI * 0.86, -Math.PI * 0.14]);
    }
    const tube = (x0: number, y0: number, x1: number, y1: number, z = 1): void => {
      c.capsule(x0 + 0.5, y0 + 0.5, x1 + 0.5, y1 + 0.5, 0.55, 0.55, { mat: paint, z });
    };
    tube(12, 4, 7, 13, 0.9);
    tube(14, 13, 12, 4);
    tube(14, 13, 24, 6, 1.1);
    tube(24, 3, 26, 13, 1.2);
    // The chain case along the chain stay, the chain ring.
    c.blob([[7.6, 12.6], [15.6, 12.4], [15.8, 14.6], [7.8, 14.4]], 0.5, { mat: paint, z: 1.3, bulge: 0.15, tone: -0.12 });
    c.ellipsoid(14.5, 13.5, 1.35, 1.35, { mat: steel, z: 1.8, round: 0.6 });
    // Saddle with two springs, the handlebar and its grip, the basket on the front carrier.
    c.capsule(10.8, 4.2, 10.9, 4.9, 0.22, 0.22, { mat: steel, z: 1.4 });
    c.capsule(13.6, 4.2, 13.5, 4.9, 0.22, 0.22, { mat: steel, z: 1.4 });
    c.blob([[9.8, 2.9], [14.6, 3], [14.3, 4.3], [10.3, 4.4]], 0.45, { mat: leather, z: 1.6, bulge: 0.25 });
    c.capsule(21.8, 2.6, 25.6, 2.4, 0.42, 0.42, { mat: steel, z: 1.5 });
    c.capsule(21.6, 2.7, 22.8, 2.6, 0.55, 0.55, { mat: grip, z: 1.7 });
    c.box(26, 4, 5, 4, {
      mat: wicker,
      z: 1.6,
      bevel: 0.35,
      tex: (s) => {
        const k = Math.floor(s.x * 1.4) + Math.floor(s.y * 1.4);
        s.tone += (k & 1 ? -0.14 : 0.08) + (Math.floor(s.y * 1.4) & 1 ? 0 : -0.05);
      },
    });
    c.box(25.8, 3.6, 5.4, 0.85, { mat: wicker, z: 1.9, bevel: 0.3, tone: 0.18 });
    fitHd(c, bike(frame, 0));
    return c.render(HD_RENDER);
  });
}

/** One background cyclist frame (`d` 2 / 4: the rig at d on the HD omafiets). */
function cyclist(c: { style: HumanStyle; bike: Color }, pose: Pose, i: number, d: Density): Frame {
  const upper = renderHuman(c.style, { weapon: 'none', ...pose }, 'upper', d);
  const lower = renderHuman(c.style, { weapon: 'none', ...pose }, 'lower', d);
  const body = stackFrames(lower, upper);
  const hip = lower.pts?.hip ?? [0, -15];
  // Wheels rest on the anchor line; the saddle (12, 3) under the hip.
  const bk = d === 1 ? bike(c.bike, i) : bikeHd(c.bike, i, hdOf(d));
  const out = new PixelBuffer(44 * d, 46 * d);
  const ox = 18;
  const oy = 45;
  out.blit(bk, (ox - 16) * d, (oy - 20) * d);
  // Place the hip 1 px over the saddle: saddle at (ox − 16 + 12, oy − 20 + 3).
  const hx = ox - 16 + 12;
  const hy = oy - 20 + 2;
  if (d === 1) {
    out.blitFrame(body, hx - hip[0], hy - hip[1]);
    return { buf: out, ox, oy };
  }
  out.blitFrame(body, (hx - hip[0]) * d, (hy - hip[1]) * d, undefined, d);
  return { buf: out, ox, oy, density: d };
}

CYCLISTS.forEach((c, look) => {
  defineSprite(`npc/ams/ams-cyclist-bg/${look}`, () => PEDAL.map((pose, i) => cyclist(c, pose, i, 1)), {
    ticksPerFrame: 6,
    trim: true,
    hd: (d) => PEDAL.map((pose, i) => cyclist(c, pose, i, d)),
  });
});

// ------------------------------------------------------------------------------------ pigeons

/** One city pigeon (12×10, feet anchor): stand, peck, step, wings up, wings down. */
function pigeon(f: number): Frame {
  const b = new PixelBuffer(14, 12);
  const fly = f >= 3;
  const peck = f === 1;
  // Tail and body.
  b.poly([[1, 6], [4, 5], [4, 8]], PAL.steel[1]);
  b.ellipse(3, 4, 7, 5, PAL.steel[2]);
  b.hline(4, 8, 5, PAL.steel[3]);
  b.hline(5, 8, 8, PAL.steel[1]);
  // Head and neck.
  const hx = peck ? 10 : 9;
  const hy = peck ? 7 : 3;
  b.rect(hx - 1, hy + 1, 2, 2, PAL.teal[2]);
  b.set(hx - 1, hy + 2, PAL.purple[2]);
  b.circle(hx, hy, 1, PAL.steel[2]);
  b.set(hx + 2, hy, PAL.stone[1]);
  b.set(hx, hy - 1, PAL.steel[3]);
  // Wing.
  if (f === 3) b.poly([[4, 5], [8, 5], [5, 0], [3, 1]], PAL.steel[3]);
  else if (f === 4) b.poly([[4, 6], [8, 6], [6, 10], [3, 10]], PAL.steel[1]);
  else b.hline(4, 7, 6, PAL.steel[1]);
  b.outline(INK);
  b.set(hx, hy, INK);
  if (!fly) {
    b.set(6, 9, PAL.pink[1]);
    b.set(f === 2 ? 8 : 7, 9, PAL.pink[1]);
  }
  return { buf: b, ox: 6, oy: 10 };
}
defineSprite('npc/ams/ams-pigeons', () => [0, 1, 2, 3, 4].map(pigeon), { ticksPerFrame: 8 });

// ------------------------------------------------------------------------------------ ducks

/** A mallard on the canal (10×7, waterline anchor): paddle bob up, down. Drake: green head. */
function duck(f: number, drake: boolean): Frame {
  const b = new PixelBuffer(12, 9);
  const dy = f === 1 ? 1 : 0;
  b.ellipse(1, 3 + dy, 8, 4, drake ? PAL.stone[2] : PAL.brown[2]);
  b.hline(2, 7, 3 + dy, drake ? PAL.stone[3] : PAL.brown[3]);
  b.set(1, 4 + dy, drake ? PAL.ink[1] : PAL.brown[1]);
  b.rect(4, 5 + dy, 3, 1, drake ? PAL.sky[1] : PAL.brown[1]);
  b.circle(8, 2 + dy, 1, drake ? PAL.green[1] : PAL.brown[2]);
  b.rect(7, 1 + dy, 2, 2, drake ? PAL.green[2] : PAL.brown[2]);
  b.outline(INK);
  b.set(9, 1 + dy, INK);
  b.rect(10, 2 + dy, 2, 1, PAL.gold[2]);
  // Ripple at the waterline.
  b.hline(0, 9, 7, PAL.snow[2]);
  return { buf: b, ox: 5, oy: 7 };
}
defineSprite('npc/ams/ams-ducks', () => [duck(0, true), duck(1, true), duck(0, false), duck(1, false)], { ticksPerFrame: 12 });

// ------------------------------------------------------------------------------------ window waver

/** A canal-house sash window (18×24, feet anchor at the sill) with a flower box. */
export function windowFrame(): PixelBuffer {
  const b = new PixelBuffer(20, 26);
  b.rect(1, 1, 18, 22, PAL.cloth[3]);
  b.rect(3, 3, 14, 16, PAL.navy[0]);
  // Curtains.
  b.rect(3, 3, 3, 16, PAL.red[1]);
  b.rect(14, 3, 3, 16, PAL.red[1]);
  b.vline(4, 3, 18, PAL.red[2]);
  b.vline(15, 3, 18, PAL.red[2]);
  return b;
}

export function windowDone(b: PixelBuffer, inner: PixelBuffer | null): Frame {
  if (inner) b.blit(inner, 3, 3);
  // Sash bars over everything.
  b.hline(3, 16, 6, PAL.cloth[2]);
  // Flower box with tulips.
  b.rect(1, 19, 18, 4, PAL.brown[1]);
  b.hline(1, 18, 19, PAL.brown[2]);
  const tulips: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.pink[2], PAL.red[3], PAL.orange[2]];
  for (let i = 0; i < 5; i++) {
    const x = 3 + i * 3;
    b.vline(x, 16, 18, PAL.green[2]);
    b.rect(x, 15, 2, 2, tulips[i]);
  }
  b.outline(INK);
  return { buf: b, ox: 10, oy: 24 };
}

/** Who or what is at the HD window: a finished picture of the inner 14 × 16 box (density d), or lit shapes drawn into the room. */
export interface WindowInner {
  img?: PixelBuffer | null;
  /** Draw into the room canvas (inner logical px, z ≥ 2: in front of the curtains). */
  draw?: (c: HdCanvas) => void;
}

/**
 * The HD canal-house sash window (the `windowFrame` box, 20 × 26, feet anchor at the sill): a dim
 * room behind the glass with a soft falloff, red curtains in deep folds gathered by gold
 * tie-backs, whoever is at the window, the frame's shadow on the room; the painted white frame
 * and sash bar (bevelled), an oiled plank flower box with a lit lip and five tulips (each with a
 * stem, a leaf and a notched cup).
 */
export function windowHd(d: HdD, inner: WindowInner | null): Frame {
  const r = new HdCanvas(14, 16, d);
  const room = r.material({ ramp: PAL_HD.navy, lo: 0, hi: 4, flat: true, dither: 0.3 });
  r.plane(0, 0, 14, 16, {
    mat: room,
    z: 0,
    tex: (s) => {
      s.tone = 0.3 - s.y * 0.035 - Math.abs(s.x - 8) * 0.025;
    },
  });
  const curtain = r.material({ ramp: PAL_HD.red, lo: 1, hi: 5, wrap: 0.1, spec: 0.15, shine: 10 });
  const tie = goldMat(r);
  const sides: ReadonlyArray<readonly [ReadonlyArray<readonly [number, number]>, number]> = [
    [[[0, 0], [3.2, 0], [3.2, 0.6], [1.8, 9.2], [2.6, 16], [0, 16]], 0],
    [[[10.8, 0], [14, 0], [14, 16], [11.4, 16], [12.2, 9.2], [10.8, 0.6]], 11.8],
  ];
  for (const [pts, tx] of sides) {
    r.blob(pts, 0.8, { mat: curtain, z: 0.6, bulge: 0.3, tex: folds({ angle: Math.PI / 2, spacing: 1.1, amp: 0.9, cover: 0.9, seed: 41 + tx }) });
    r.box(tx, 8.7, 2.2, 0.8, { mat: tie, z: 2.4, bevel: 0.3 });
  }
  if (inner?.img) r.image(inner.img, 0, 0, { z: 4 });
  inner?.draw?.(r);
  // The frame and the sash bar throw a shadow into the room (light from the upper left).
  r.shade(0, 0, 14, 16, (x, y) => (y < 0.9 || x < 0.7 ? -0.3 : y > 3 && y < 3.9 ? -0.2 : 0));
  const pic = r.render({ outline: 'none', ao: 0.25 });

  const c = new HdCanvas(20, 26, d);
  c.image(pic, 3, 3, { z: 0 });
  const trim = c.material({ ramp: PAL_HD.gable, lo: 2, hi: 5, spec: 0.35, shine: 16, amb: 0.35 });
  const frameOpts = { mat: trim, z: 1, bevel: 0.5 };
  c.box(1, 1, 18, 2, frameOpts);
  c.box(1, 3, 2, 16, frameOpts);
  c.box(17, 3, 2, 16, frameOpts);
  c.box(3, 6, 14, 1, { mat: trim, z: 1.4, bevel: 0.35 });
  const plank = c.material({ ramp: PAL_HD.wood, lo: 1, hi: 5, spec: 0.2, shine: 10 });
  c.box(1, 19.3, 18, 3.7, { mat: plank, z: 2, bevel: 0.35, tex: wood({ seed: 43, plank: 1.8 }) });
  c.box(1, 19, 18, 0.9, { mat: plank, z: 2.4, bevel: 0.3, tone: 0.2 });
  const stem = c.material({ ramp: PAL_HD.green, lo: 2, hi: 6, wrap: 0.1 });
  const cups: readonly Ramp[] = [PAL_HD.red, PAL_HD.gold, PAL_HD.pink, PAL_HD.red, PAL_HD.orange];
  for (let i = 0; i < 5; i++) {
    const x = 3 + i * 3;
    const cx = x + 1;
    const cupR = cups[i];
    const cup = c.material({ ramp: cupR, lo: i === 3 ? 3 : 2, hi: cupR.length - 2, spec: 0.45, shine: 16 });
    c.capsule(x + 0.5, 16.6, x + 0.5, 19.4, 0.3, 0.3, { mat: stem, z: 2.6 });
    c.ellipsoid(x + 1.3, 18.3, 0.9, 0.38, { mat: stem, z: 2.7 });
    c.ellipsoid(cx, 16, 1, 1.15, {
      mat: cup,
      z: 3,
      tex: (s) => {
        // A notch between the outer petals at the top, a crease down each petal edge (4×).
        if (s.y < 15.35 && Math.abs(s.x - cx) < 0.28) s.cut = true;
        else if (s.d >= 4 && s.y < 16.4 && Math.abs(Math.abs(s.x - cx) - 0.38) < 0.12) s.tone -= 0.22;
      },
    });
  }
  return { buf: c.render(HD_RENDER), ox: 10, oy: 24, density: d };
}

export const WAVER_STYLE: HumanStyle = { skin: 'skinA', hair: 'hairC', hairStyle: 'bob', headgear: 'none', top: 'teal', topType: 'sweater', pants: 'slate', boots: 'black', gloves: null, build: 'slim' };

/** The window waver's person strip (`d` 2 / 4: the HD window and the rig at d). */
function waverFrames(d: Density): Frame[] {
  const out: Frame[] = [];
  const poses: (Pose | null)[] = [null, { armN: A(6, 30, 'open'), armF: A(-4, 30, 'open'), expr: 'normal' }, { ...WAVE[0] }, { ...WAVE[1] }];
  for (const p of poses) {
    let inner: PixelBuffer | null = null;
    if (p) {
      const f = renderHuman(WAVER_STYLE, { weapon: 'none', ...p }, 'upper', d);
      inner = new PixelBuffer(14 * d, 16 * d);
      // Hip 9 px below the window bottom: the chest, head and a raised hand show.
      inner.blitFrame(f, 7 * d, (16 + 1) * d, undefined, d);
    }
    out.push(d === 1 ? windowDone(windowFrame(), inner) : windowHd(hdOf(d), { img: inner }));
  }
  return out;
}

defineSprite('npc/ams/ams-window-waver/person', () => waverFrames(1), { ticksPerFrame: 10, hd: (d) => waverFrames(d) });

defineSprite('npc/ams/ams-window-waver/cat', () =>
  [0, 1].map((t) => {
    const inner = new PixelBuffer(14, 16);
    // A ginger cat sitting on the sill, tail swishing.
    inner.ellipse(3, 7, 9, 9, PAL.orange[1]);
    inner.hline(5, 9, 8, PAL.orange[2]);
    inner.circle(8, 6, 3, PAL.orange[2]);
    inner.tri(5, 4, 6, 1, 7, 4, PAL.orange[2]);
    inner.tri(9, 4, 10, 1, 11, 4, PAL.orange[2]);
    inner.set(7, 6, PAL.green[3]);
    inner.set(10, 6, PAL.green[3]);
    inner.set(8, 8, PAL.pink[2]);
    inner.thickLine(3, 14, t ? 0 : 1, t ? 8 : 7, 2, PAL.orange[0]);
    return windowDone(windowFrame(), inner);
  }),
{ ticksPerFrame: 24 });

// ------------------------------------------------------------------------------------ breakables

/** 0 intact, 1 broken; feet anchor. */
function breakable(id: string, w: number, h: number, draw: (b: PixelBuffer, broken: boolean) => void): void {
  defineSprite(`decor/ams/${id}`, () =>
    [false, true].map((broken) => {
      const b = new PixelBuffer(w + 2, h + 2);
      draw(b, broken);
      b.outline(INK);
      return { buf: b, ox: Math.floor((w + 2) / 2), oy: h + 1 };
    }),
  );
}

function wheel(b: PixelBuffer, x: number, y: number, r: number): void {
  b.circle(x, y, r, PAL.black[2]);
  b.circle(x, y, r - 1, PAL.stone[2], false);
  b.set(x, y, PAL.steel[3]);
}

/** Herring cart (48×36): a white kiosk on wheels, blue band with HARING, a fish and a Dutch flag. */
breakable('ams-herring-cart', 48, 38, (b, broken) => {
  if (broken) {
    // The kiosk box keeled over: a tilted white body with its blue HARING band, the striped roof
    // edge snapped off on the floor, one loose wheel and silver fish spilled on the street.
    b.poly([[4, 37], [6, 22], [34, 18], [38, 33]], PAL.cloth[2]);
    b.line(6, 22, 34, 18, PAL.cloth[3]);
    b.poly([[5, 30], [36, 26], [37, 32], [5, 36]], PAL.sky[1]);
    drawText(b, 'HAR', 12, 28, { font: 'small', color: PAL.cloth[3] });
    b.rect(10, 22, 18, 4, PAL.navy[0]);
    // Snapped roof edge.
    for (let x = 30; x < 46; x += 6) b.rect(x, 34, 3, 3, PAL.cloth[3]);
    for (let x = 33; x < 46; x += 6) b.rect(x, 34, 3, 3, PAL.sky[1]);
    b.hline(30, 46, 33, PAL.sky[2]);
    // Flag pole on the floor.
    b.line(36, 31, 46, 26, PAL.stone[3]);
    b.rect(43, 24, 3, 1, PAL.red[2]);
    b.rect(43, 25, 3, 1, PAL.cloth[3]);
    wheel(b, 42, 18 + 16, 3);
    // Spilled fish.
    b.ellipse(2, 34, 5, 2, PAL.steel[3]);
    b.ellipse(22, 35, 5, 2, PAL.snow[2]);
    b.ellipse(14, 17, 5, 2, PAL.steel[3]);
    return;
  }
  // Roof with a blue-white striped edge.
  b.rect(2, 4, 44, 4, PAL.sky[1]);
  for (let x = 2; x < 46; x += 6) b.rect(x, 7, 3, 3, PAL.cloth[3]);
  for (let x = 5; x < 46; x += 6) b.rect(x, 7, 3, 3, PAL.sky[1]);
  b.hline(2, 45, 4, PAL.sky[2]);
  // Flag.
  b.vline(40, 0, 4, PAL.stone[3]);
  b.rect(41, 0, 5, 1, PAL.red[2]);
  b.rect(41, 1, 5, 1, PAL.cloth[3]);
  b.rect(41, 2, 5, 1, PAL.sky[1]);
  // Hatch: a dark window with a counter of fish.
  b.rect(4, 10, 40, 22, PAL.cloth[2]);
  b.hline(4, 43, 10, PAL.cloth[3]);
  b.rect(8, 11, 32, 7, PAL.navy[0]);
  for (let i = 0; i < 5; i++) b.ellipse(10 + i * 6, 15, 5, 2, i & 1 ? PAL.steel[3] : PAL.snow[2]);
  b.hline(6, 41, 18, PAL.stone[3]);
  // Blue band with the name.
  b.rect(4, 20, 40, 8, PAL.sky[1]);
  drawText(b, 'HARING', 24, 21, { font: 'small', color: PAL.cloth[3], align: 'center' });
  b.hline(4, 43, 31, PAL.stone[2]);
  wheel(b, 12, 34, 4);
  wheel(b, 36, 34, 4);
  b.line(44, 28, 48, 30, PAL.stone[2]);
});

/** Tulip stall (48×34): tiered buckets of tulips under a green-white awning. */
breakable('ams-tulip-stall', 48, 36, (b, broken) => {
  const tulips: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.pink[2], PAL.purple[2], PAL.orange[2], PAL.red[3]];
  if (broken) {
    b.poly([[2, 32], [46, 30], [46, 35], [2, 35]], PAL.brown[1]);
    for (let i = 0; i < 12; i++) {
      const x = 3 + ((i * 7) % 42);
      const y = 28 + ((i * 5) % 6);
      b.line(x, y, x + 3, y + 1, PAL.green[2]);
      b.rect(x + 3, y, 2, 2, tulips[i % tulips.length]);
    }
    b.ellipse(30, 26, 8, 6, PAL.steel[2]);
    return;
  }
  // Awning.
  b.rect(1, 0, 46, 5, PAL.green[2]);
  for (let x = 1; x < 47; x += 6) b.rect(x, 0, 3, 7, PAL.cloth[3]);
  for (let x = 4; x < 47; x += 6) b.rect(x, 5, 3, 2, PAL.green[2]);
  b.vline(3, 7, 35, PAL.brown[1]);
  b.vline(44, 7, 35, PAL.brown[1]);
  // Tiers of buckets.
  for (let row = 0; row < 3; row++) {
    const y = 14 + row * 7;
    b.rect(5, y + 4, 38, 2, PAL.brown[row === 2 ? 1 : 2]);
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 6 + (row & 1) * 2;
      b.rect(x, y + 1, 5, 4, PAL.steel[2]);
      b.hline(x, x + 4, y + 1, PAL.steel[3]);
      const c = tulips[(i + row * 2) % tulips.length];
      for (const dx of [0, 2, 4]) {
        b.vline(x + dx, y - 2, y, PAL.green[2]);
        b.rect(x + dx, y - 3, 1, 2, c);
      }
    }
  }
  b.rect(5, 33, 38, 3, PAL.brown[1]);
});

/** Waterlooplein flea-market stall (56×38): red-white awning, a table of second-hand goods. */
breakable('ams-market-stall', 56, 38, (b, broken) => {
  if (broken) {
    b.poly([[2, 30], [28, 24], [54, 31], [54, 37], [2, 37]], PAL.red[1]);
    for (let x = 6; x < 52; x += 8) b.line(x, 31, x + 4, 29, PAL.cloth[3]);
    b.circle(14, 33, 3, PAL.black[2]);
    b.rect(36, 32, 7, 4, PAL.brown[2]);
    b.line(4, 36, 50, 34, PAL.brown[0]);
    return;
  }
  b.rect(1, 0, 54, 6, PAL.red[2]);
  for (let x = 1; x < 55; x += 8) b.rect(x, 0, 4, 6, PAL.cloth[3]);
  for (let x = 1; x < 55; x += 4) b.rect(x, 6, 2, 2, x % 8 === 1 ? PAL.cloth[3] : PAL.red[2]);
  b.vline(3, 8, 37, PAL.steel[1]);
  b.vline(52, 8, 37, PAL.steel[1]);
  // Table and goods.
  b.rect(4, 24, 48, 3, PAL.brown[2]);
  b.hline(4, 51, 24, PAL.brown[3]);
  b.rect(6, 27, 44, 8, PAL.sky[0]);
  // Records, a radio, a lamp, books.
  b.circle(10, 20, 3, PAL.black[2]);
  b.set(10, 20, PAL.red[2]);
  b.circle(17, 21, 3, PAL.black[2]);
  b.set(17, 21, PAL.gold[2]);
  b.rect(22, 17, 9, 7, PAL.brown[1]);
  b.circle(25, 20, 2, PAL.stone[3]);
  b.rect(28, 18, 2, 4, PAL.stone[2]);
  b.vline(36, 14, 23, PAL.gold[1]);
  b.poly([[33, 14], [39, 14], [37, 10], [35, 10]], PAL.gold[3]);
  for (let i = 0; i < 4; i++) b.rect(42 + i * 2, 17 + (i & 1), 2, 7 - (i & 1), [PAL.teal[1], PAL.red[1], PAL.gold[1], PAL.purple[1]][i]);
});

/** Bike rack (52×24): three Dutch bikes chained to a steel rack. */
breakable('ams-bike-rack', 52, 24, (b, broken) => {
  const colors: readonly Color[] = [PAL.black[2], PAL.red[1], PAL.teal[1]];
  if (broken) {
    b.hline(2, 50, 23, PAL.steel[2]);
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 15;
      b.ellipse(x, 18, 11, 6, PAL.black[2], false);
      b.line(x - 2, 20, x + 10, 17, colors[i]);
      b.circle(x + 9, 21, 2, PAL.stone[2], false);
    }
    return;
  }
  // The rack.
  b.hline(1, 51, 22, PAL.steel[2]);
  for (let x = 4; x < 50; x += 8) {
    b.vline(x, 12, 22, PAL.steel[3]);
    b.vline(x + 4, 12, 22, PAL.steel[2]);
    b.hline(x, x + 4, 12, PAL.steel[3]);
  }
  // Bikes (front wheels in the rack, turned slightly).
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 16;
    const c = colors[i];
    b.circle(x, 17, 5, PAL.ink[1], false);
    b.circle(x + 12, 17, 5, PAL.ink[1], false);
    b.line(x, 17, x + 6, 17, c);
    b.line(x + 6, 17, x + 4, 9, c);
    b.line(x + 6, 17, x + 10, 10, c);
    b.line(x + 10, 8, x + 12, 17, c);
    b.line(x + 4, 9, x, 17, c);
    b.hline(x + 2, x + 6, 8, PAL.brown[1]);
    b.hline(x + 9, x + 12, 7, PAL.steel[3]);
  }
});
