/**
 * Art of the people and the life of Amsterdam (mission `ams`, docs/design/amsterdam.md §1, §5).
 * All drawn by code, 64-colour palette, 1-px ink outline, light from the top-left.
 *
 * NPC strips (feet anchor, humans 35–37 px, facing right):
 * - `npc/ams/ams-baker/<anim>`          idle talk toss walk clap cheer wave
 * - `npc/ams/ams-hotdog-vendor/<anim>`  idle salute talk wave
 * - `npc/ams/ams-staff/<look>/<anim>`   look 0–2; idle walk clap cheer wave
 * - `npc/ams/counter`                   a small Fabel Friet counter drawn in front of an NPC
 *
 * Ambient life: `npc/ams/ams-tour-boat` (2, wake), `npc/ams/ams-cyclist-bg/<look>` (4, pedalling;
 * look 0–3), `npc/ams/ams-pigeons` (5: stand, peck, step, wings up, wings down),
 * `npc/ams/ams-ducks` (4: drake bob up / down, hen bob up / down),
 * `npc/ams/ams-window-waver/person` (4: empty, idle, wave a, wave b), `…/cat` (2).
 * Decor: `decor/ams/ams-boat-platform` (2, wake), breakables `decor/ams/<id>` (0 intact,
 * 1 broken) for ams-herring-cart, ams-tulip-stall, ams-market-stall, ams-bike-rack.
 */
import type { Color } from '../../../../engine/color';
import { drawText } from '../../../../engine/font';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import { withSwing } from '../../../art/human-sprites';
import { renderHuman, stackFrames, type ArmPose, type HumanStyle, type LegPose, type Pose } from '../../../art/humanoid';
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

/** Breathing at rest, the arms loose. */
export const IDLE: readonly Pose[] = P.seq({ ...P.STAND, ...ARMS_DOWN }, [{}, { hunch: 1 }]);

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

/** The baker holds the scoop at his belt. */
const HOLD_SCOOP: readonly Pose[] = P.seq({ ...P.STAND, armN: { to: [6, 7], hand: 'grip' }, armF: A(-4, 20, 'open') }, [{}, { hunch: 1 }]);

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

/** Lower body with an apron hung at the hip, then the torso on top (like the hostage aprons). */
function figure(style: HumanStyle, pose: Pose, apron: PixelBuffer | null): Frame {
  if (!apron || pose.rot) return renderHuman(style, pose, 'full');
  const lower = renderHuman(style, pose, 'lower');
  const upper = renderHuman(style, pose, 'upper');
  const hip = lower.pts?.hip ?? [0, -15];
  const legs = withPieces(lower, [{ buf: apron, x: hip[0] - 4, y: hip[1] - 1 }]);
  return stackFrames(legs, upper);
}

/** The scoop in the near hand. */
function withScoop(f: Frame, sc: PixelBuffer): Frame {
  const h: V2 = f.pts?.hand ?? [4, -16];
  const pieces: Piece[] = [{ buf: sc, x: h[0] - 2, y: h[1] - 8 }];
  return withPieces(f, pieces);
}

/** The saluting forearm: a sleeve from the chest up to a flat hand at the cap peak. */
function withSaluteArm(f: Frame, style: HumanStyle): Frame {
  const h: V2 = f.pts?.hand ?? [6, -28];
  const top: readonly Color[] = typeof style.top === 'string' ? PAL[style.top as keyof typeof PAL] : PAL.sky;
  const skin: readonly Color[] = typeof style.skin === 'string' && PAL[style.skin as keyof typeof PAL].length >= 4 ? PAL[style.skin as keyof typeof PAL] : PAL.skinA;
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
  const b = f.buf.clone();
  const reds = new Set<number>([PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]]);
  const yMax = f.oy + head[1] - 1;
  let top = -1;
  for (let y = 0; y <= yMax && top < 0; y++) for (let x = 0; x < b.w; x++) if (reds.has(b.get(x, y))) { top = y; break; }
  if (top < 0) return f;
  for (let y = top; y <= Math.min(yMax, top + 6); y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (!reds.has(c)) continue;
      const row = y - top;
      if (row === 2) b.set(x, y, c === PAL.red[3] || c === PAL.red[2] ? PAL.snow[3] : PAL.cloth[1]);
      else if (row >= 3) b.set(x, y, c === PAL.red[3] || c === PAL.red[2] ? PAL.sky[1] : PAL.navy[1]);
    }
  }
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
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

function defineStrips(prefix: string, style: HumanStyle, apron: () => PixelBuffer | null, strips: Readonly<Record<string, Strip>>, post?: (f: Frame) => Frame): void {
  let ap: PixelBuffer | null | undefined;
  let sc: PixelBuffer | null = null;
  for (const [name, s] of Object.entries(strips)) {
    defineSprite(
      `${prefix}/${name}`,
      () => {
        if (ap === undefined) ap = apron();
        return s.poses.map((p) => {
          let f = figure(style, { weapon: 'none', ...p }, ap ?? null);
          if (s.scoop) f = withScoop(f, (sc ??= scoop()));
          if (s.salute) f = withSaluteArm(f, style);
          return post ? post(f) : f;
        });
      },
      { ticksPerFrame: s.ticks, loop: s.loop ?? true },
    );
  }
}

defineStrips('npc/ams/ams-baker', BAKER_STYLE, darkApron, {
  idle: { poses: HOLD_SCOOP, ticks: 30, scoop: true },
  talk: { poses: TALK, ticks: 8, scoop: true },
  toss: { poses: TOSS, ticks: TOSS_TICKS, loop: false },
  walk: { poses: WALK_POSES, ticks: 6 },
  clap: { poses: CLAP, ticks: 6 },
  cheer: { poses: P.VICTORY, ticks: 8 },
  wave: { poses: WAVE, ticks: 10 },
});

defineStrips(
  'npc/ams/ams-hotdog-vendor',
  VENDOR_STYLE,
  whiteApron,
  {
    idle: { poses: IDLE, ticks: 30 },
    salute: { poses: SALUTE_CALM, ticks: 20, salute: true },
    talk: { poses: TALK, ticks: 8 },
    wave: { poses: WAVE, ticks: 10 },
  },
  tricolorCap,
);

STAFF_STYLES.forEach((style, i) => {
  defineStrips(`npc/ams/ams-staff/${i}`, style, darkApron, {
    idle: { poses: IDLE, ticks: 30 + i * 4 },
    walk: { poses: WALK_POSES, ticks: 6 },
    clap: { poses: CLAP, ticks: 6 + (i % 2) },
    cheer: { poses: P.VICTORY, ticks: 8 },
    wave: { poses: WAVE, ticks: 10 },
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
});

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

CYCLISTS.forEach((c, look) => {
  defineSprite(
    `npc/ams/ams-cyclist-bg/${look}`,
    () =>
      PEDAL.map((pose, i) => {
        const upper = renderHuman(c.style, { weapon: 'none', ...pose }, 'upper');
        const lower = renderHuman(c.style, { weapon: 'none', ...pose }, 'lower');
        const body = stackFrames(lower, upper);
        const hip = lower.pts?.hip ?? [0, -15];
        // Wheels rest on the anchor line; the saddle (12, 3) under the hip.
        const bk = bike(c.bike, i);
        const out = new PixelBuffer(44, 46);
        const ox = 18;
        const oy = 45;
        out.blit(bk, ox - 16, oy - 20);
        // Place the hip 1 px over the saddle: saddle at (ox − 16 + 12, oy − 20 + 3).
        const hx = ox - 16 + 12;
        const hy = oy - 20 + 2;
        out.blitFrame(body, hx - hip[0], hy - hip[1]);
        return { buf: out, ox, oy };
      }),
    { ticksPerFrame: 6, trim: true },
  );
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
function windowFrame(): PixelBuffer {
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

function windowDone(b: PixelBuffer, inner: PixelBuffer | null): Frame {
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

const WAVER_STYLE: HumanStyle = { skin: 'skinA', hair: 'hairC', hairStyle: 'bob', headgear: 'none', top: 'teal', topType: 'sweater', pants: 'slate', boots: 'black', gloves: null, build: 'slim' };

defineSprite('npc/ams/ams-window-waver/person', () => {
  const out: Frame[] = [];
  const poses: (Pose | null)[] = [null, { armN: A(6, 30, 'open'), armF: A(-4, 30, 'open'), expr: 'normal' }, { ...WAVE[0] }, { ...WAVE[1] }];
  for (const p of poses) {
    let inner: PixelBuffer | null = null;
    if (p) {
      const f = renderHuman(WAVER_STYLE, { weapon: 'none', ...p }, 'upper');
      inner = new PixelBuffer(14, 16);
      // Hip 9 px below the window bottom: the chest, head and a raised hand show.
      inner.blitFrame(f, 7, 16 + 1);
    }
    out.push(windowDone(windowFrame(), inner));
  }
  return out;
}, { ticksPerFrame: 10 });

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
