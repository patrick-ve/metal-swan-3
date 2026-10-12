/**
 * The strips every standing wind soldier shares (docs/ARCHITECTURE.md §6.1 enemy contract + the
 * GDD §9.0 extras), built from the humanoid rig + the type's instrument (`TypeArt.dress`):
 *
 * idle · walk · run · alert · double-take · crouch · panic · salute · confused · queue ·
 * photo-pose · ears · stumble · frozen · die · die-blast · die-burn · die-knife · die-crush ·
 * die-shatter · gag-nap · hat · shatter-head · emerge · ski · ski-crash · slip · skate.
 *
 * A type adds its own strips (attack, gags, `shoot`, `crouch-shoot`, `throw`) and may replace any
 * of these (the prone piccolo replaces most). `defineStrips` registers a strip table under a
 * look prefix (`enemy/<type>[-<outfit>][-skin<b|c>]`).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../../engine/sprites';
import { crumble, scorch, sootify, withFlames } from '../../../art/human-fx';
import { renderHuman, type ArmPose, type HumanStyle, type Pose } from '../../../art/humanoid';
import { R } from '../../../art/paint';
import * as P from '../../../art/poses';
import { CLIMB, emergeFrames, hatFrames, headgearArt, SKATE, SKI, SKI_CRASH, SLIP } from '../art';
import { bubbleArt, coinArt, iceBlock, iceCubes, nudge, pancake, renderDressed, reskin, skinMap, stamp, type Body, type WPose } from './kit';
import type { Skin } from './looks';

/** One registered strip: poses rendered with the type's instrument, or a custom generator. */
export interface StripDef {
  poses?: readonly WPose<unknown>[];
  /** Style override for these poses (e.g. no headgear once the hat has popped off). */
  style?: (s: HumanStyle) => HumanStyle;
  /** Post-process the rendered frames (soot, flames, ice …). */
  post?: (frames: Frame[], style: HumanStyle) => Frame[];
  /** Fully custom frames. */
  frames?: (style: HumanStyle) => Frame[];
  opts: SpriteOpts;
}

export type Strips = Record<string, StripDef>;

/** What the common strips need from a type. */
export interface TypeArt {
  /** Draws the instrument onto a rendered rig frame. */
  dress: (f: Frame, b: Body, p: WPose<unknown>) => Frame;
  /** Arms holding the instrument (standing, walking). */
  hold: Pose;
  /** Arms hugging the instrument to the chest (panic). */
  hug: Pose;
  /** The far arm while the near arm salutes / scratches / waves (keeps the instrument). */
  farHold: Pose;
  /** The hat that pops off on death (default: the rig's headgear alone); null = none (hoods stay on). */
  hat?: (s: HumanStyle) => PixelBuffer | null;
  /** Walk timing (ticks per frame). */
  walkTicks?: number;
}

/** Render one pose with the type's instrument. */
export function render(style: HumanStyle, t: TypeArt, p: WPose<unknown>): Frame {
  return renderDressed(style, p, t.dress);
}

/** Register every strip of a table under `prefix`. */
export function defineStrips(prefix: string, style: HumanStyle, t: TypeArt, strips: Strips): void {
  for (const [name, s] of Object.entries(strips)) {
    defineSprite(
      `${prefix}/${name}`,
      () => {
        const st = s.style ? s.style(style) : style;
        let out: Frame[];
        if (s.frames) out = s.frames(st);
        else out = (s.poses ?? []).map((p) => render(st, t, p));
        return s.post ? s.post(out, st) : out;
      },
      s.opts,
    );
  }
}

/**
 * Register a skin-tone variant of a look: every strip is the skin-A strip of the same outfit,
 * recoloured (fast, no rig render; generated lazily like any strip).
 */
export function defineSkinVariant(prefix: string, basePrefix: string, strips: Strips, skin: Skin): void {
  const map = skinMap(skin);
  for (const [name, s] of Object.entries(strips)) {
    defineSprite(`${prefix}/${name}`, () => getFrames(`${basePrefix}/${name}`).map((f) => reskin(f, map)), s.opts);
  }
}

// ---------------------------------------------------------------------------------------------
// Pose helpers
// ---------------------------------------------------------------------------------------------

const A = (sh: number, el: number, hand?: ArmPose['hand']): ArmPose => (hand ? { sh, el, hand } : { sh, el });
const L = (hip: number, knee: number, foot?: number) => (foot === undefined ? { hip, knee } : { hip, knee, foot });

/** Without the headgear (it popped off) — deaths. */
export const hatless = (s: HumanStyle): HumanStyle => ({ ...s, headgear: 'none' });
/** Blown up: no headgear, frazzled hair. */
export const frazzled = (s: HumanStyle): HumanStyle => ({ ...s, headgear: 'none', hairStyle: 'spiky' });

/**
 * "Pulls his headgear down over his eyes" (the panic look): paint the face rows from the brow
 * to the eyes in the headgear colour.
 */
export function hatDown(f: Frame, style: HumanStyle): Frame {
  const head = f.pts?.head;
  if (!head || style.headgear === 'none') return f;
  const ramp = R(style.gear ?? 'olive');
  const b = f.buf.clone();
  const cx = f.ox + head[0];
  const cy = f.oy + head[1];
  for (let y = cy - 3; y <= cy + 1; y++) {
    for (let x = cx - 2; x <= cx + 7; x++) {
      const c = b.get(x, y);
      if ((c & 255) === 0 || c === INK) continue;
      b.set(x, y, y === cy + 1 ? ramp[0] : y === cy - 3 ? ramp[2] : ramp[1]);
    }
  }
  // The brim's lower edge.
  b.touch();
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Ash-pile burn sequence with the instrument (flames → soot statue → crumble). */
export function burnSeq(style: HumanStyle, t: TypeArt, base: Pose = {}): Frame[] {
  const out: Frame[] = [];
  P.BURN.forEach((p, i) => out.push(withFlames(scorch(render(style, t, { ...t.hold, ...base, ...p, armN: p.armN, armF: p.armF }), 1), i * 2 + 1, 9)));
  const statue = sootify(render(style, t, { ...P.STAND, ...t.hold, ...base, expr: 'soot' }), 1, true, 9);
  out.push(withFlames(statue, 5, 12, 3));
  out.push(statue);
  out.push(crumble(statue, 0.35, 9));
  out.push(crumble(statue, 0.7, 9));
  out.push(crumble(statue, 1, 9));
  return out;
}

// ---------------------------------------------------------------------------------------------
// The common strip table
// ---------------------------------------------------------------------------------------------

/** Tiptoe: heels up, short quick steps (the Legion panics quietly). */
const TIPTOE: readonly Pose[] = [
  { legN: L(16, 30, -40), legF: L(-6, 34, -40), bob: -1 },
  { legN: L(4, 36, -40), legF: L(6, 30, -40) },
  { legN: L(-6, 34, -40), legF: L(16, 30, -40), bob: -1 },
  { legN: L(6, 30, -40), legF: L(4, 36, -40) },
];

/** Head-first in the ground after a blast: legs kicking in the air (two frames). */
const HEAD_FIRST: readonly Pose[] = [
  { legN: L(30, 60), legF: L(-20, 30), armN: A(150, 10, 'open'), armF: A(200, 10, 'open'), rot: 180, expr: 'soot' },
  { legN: L(-10, 30), legF: L(26, 70), armN: A(160, 10, 'open'), armF: A(190, 10, 'open'), rot: 176, expr: 'soot' },
];

/** The operatic swoon (GDD §6.2): kneels, raises one arm, sings one note, collapses. */
function swoon(t: TypeArt): WPose<unknown>[] {
  const kneel = { legN: L(92, 96), legF: L(-6, 120), legScale: 0.85 };
  return [
    { ...P.STAND, ...t.hold, lean: -4, expr: 'dazed' },
    { ...kneel, ...t.farHold, armN: A(120, 20, 'open'), lean: -10, head: { tilt: -14 }, expr: 'shout' },
    { ...kneel, ...t.farHold, armN: A(130, 10, 'open'), lean: -14, head: { tilt: -18 }, expr: 'shout', hunch: -1 },
    { legN: L(20, 40), legF: L(0, 60), armN: A(120, 10, 'open'), armF: A(100, 10, 'open'), rot: 50, expr: 'hurt' },
    { legN: L(0, 10), legF: L(-10, 20), armN: A(170, 0, 'open'), armF: A(160, 0, 'open'), rot: 88, expr: 'blink' },
  ];
}

/** Every common strip for a standing soldier type. */
export function commonStrips(t: TypeArt): Strips {
  const h = t.hold;
  const far = t.farHold;
  const walkTicks = t.walkTicks ?? 6;
  const stand: Pose = { ...P.STAND, ...h };
  return {
    idle: { poses: P.seq(stand, P.BREATH), opts: { ticksPerFrame: 24 } },
    walk: { poses: P.seq(h, P.WALK), opts: { ticksPerFrame: walkTicks } },
    run: { poses: P.seq({ ...h, lean: 8 }, P.RUN), opts: { ticksPerFrame: 4 } },
    alert: {
      poses: [
        { ...stand, legN: L(30, 40), legF: L(-10, 40), grounded: false, dy: -3, expr: 'panic' },
        { ...stand, expr: 'shout' },
      ],
      opts: { durations: [10, 12], loop: false },
    },
    'double-take': {
      poses: [
        { ...stand, expr: 'normal' },
        { ...stand, expr: 'blink', head: { dx: -1, tilt: 12 }, lean: 2 },
        { ...stand, expr: 'panic', head: { dy: -1 }, lean: -4, dy: -1 },
      ],
      opts: { durations: [8, 8, 8], loop: false },
    },
    crouch: { poses: [{ ...P.CROUCH, ...h }], opts: { ticksPerFrame: 30 } },
    panic: {
      poses: P.seq({ ...t.hug, expr: 'blink', head: { dy: 1 } }, TIPTOE),
      post: (fs, st) => fs.map((f) => hatDown(f, st)),
      opts: { ticksPerFrame: 4 },
    },
    salute: {
      poses: [
        { ...P.STAND, ...far, armN: { to: [7, -9], hand: 'open' }, expr: 'normal' },
        { ...P.STAND, ...far, armN: { to: [7, -9], hand: 'open' }, lean: -3, expr: 'happy', hunch: -1 },
      ],
      opts: { durations: [20, 40] },
    },
    confused: {
      poses: [
        { ...P.STAND, ...far, armN: { to: [4, -12], hand: 'point' }, head: { tilt: -10 }, expr: 'dazed' },
        { ...P.STAND, ...far, armN: { to: [3, -13], hand: 'point' }, head: { tilt: 10 }, expr: 'blink' },
      ],
      opts: { ticksPerFrame: 15 },
    },
    queue: {
      poses: [
        { ...P.STAND, ...far, armN: { to: [10, -6], hand: 'grip' }, expr: 'happy' },
        { ...P.STAND, ...far, armN: { to: [10, -5], hand: 'grip' }, expr: 'blink', bob: 1 },
      ],
      post: (fs) => fs.map((f) => (f.pts?.hand ? stamp(f, coinArt(), f.pts.hand[0] - 2, f.pts.hand[1] - 6) : f)),
      opts: { ticksPerFrame: 20 },
    },
    'photo-pose': {
      poses: [{ ...P.STAND, ...far, armN: { to: [7, -12], hand: 'point' }, head: { tilt: -8 }, expr: 'happy', lean: -2 }],
      post: (fs) => fs.map((f) => (f.pts?.hand ? stamp(f, vSign(), f.pts.hand[0] - 1, f.pts.hand[1] - 5) : f)),
      opts: { ticksPerFrame: 30 },
    },
    ears: {
      poses: [
        { ...stand, armN: { to: [0, -8], hand: 'open' }, armF: { to: [4, -8], hand: 'open' }, expr: 'hurt' },
        { ...stand, armN: { to: [0, -7], hand: 'open' }, armF: { to: [4, -7], hand: 'open' }, expr: 'blink', hunch: 1, bob: 1 },
      ],
      opts: { ticksPerFrame: 8 },
    },
    stumble: {
      poses: [
        { legN: L(40, 20), legF: L(-40, 30), ...far, armN: A(70, 20, 'open'), lean: 18, expr: 'panic' },
        { legN: L(24, 40), legF: L(-20, 50), ...far, armN: A(110, 30, 'open'), lean: -12, expr: 'panic', dy: -1 },
        { ...stand, lean: 6, expr: 'dazed' },
      ],
      opts: { durations: [10, 10, 12] },
    },
    frozen: { poses: [{ ...stand, expr: 'panic' }], post: (fs) => fs.map((f) => iceBlock(f)), opts: { ticksPerFrame: 30 } },
    die: {
      poses: P.DIE.map((p, i) => ({ ...p, ...(i === 0 ? h : {}) })),
      style: hatless,
      opts: { durations: [5, 5, 6, 6, 8, 30], loop: false },
    },
    'die-blast': {
      poses: [...P.DIE_BLAST.slice(0, 3), HEAD_FIRST[0], HEAD_FIRST[1], HEAD_FIRST[0], HEAD_FIRST[1]].map((p) => ({ ...p, expr: 'soot' as const })),
      style: frazzled,
      post: (fs) => fs.map((f) => scorch(f, 2)),
      opts: { durations: [5, 5, 6, 7, 7, 7, 7], loop: false },
    },
    'die-burn': { frames: (st) => burnSeq(st, t), opts: { durations: [5, 5, 8, 12, 8, 8, 14], loop: false } },
    'die-knife': { poses: swoon(t), style: hatless, opts: { durations: [8, 14, 16, 6, 30], loop: false } },
    'die-crush': {
      frames: (st) => {
        const f = render(st, t, { ...stand, expr: 'panic' });
        return [pancake(f, 0.55, 1.2), pancake(f, 0.18, 1.5), pancake(f, 0.16, 1.5, 0.6), pancake(f, 0.14, 1.4, 0, 20), pancake(f, 0.14, 1.4, 0, -20)];
      },
      opts: { durations: [4, 30, 8, 10, 10], loop: false },
    },
    'die-shatter': {
      frames: (st) => {
        const f = render(st, t, { ...stand, expr: 'panic' });
        return [iceBlock(f, 1), iceBlock(f, 2), iceCubes(9, 22, 3, 10), iceCubes(5, 18, 4, 0)];
      },
      opts: { durations: [4, 4, 10, 30], loop: false },
    },
    'gag-nap': {
      poses: P.seq({ ...stand, expr: 'blink', head: { dy: 1, tilt: 8 }, lean: 3 }, [{}, { hunch: 1 }, { hunch: 1 }, {}]),
      post: (fs) => fs.map((f, i) => (f.pts?.head ? stamp(f, bubbleArt([1, 2, 3, 1][i]), f.pts.head[0] + 6, f.pts.head[1] - 2 - i) : f)),
      opts: { durations: [24, 24, 24, 12] },
    },
    // The hat that pops 24 px on death: 4 tumbling frames, bottom-centre anchor (SoldierProp).
    hat: {
      frames: (st) => {
        const b = t.hat ? t.hat(st) : st.headgear === 'hood' ? null : headgearArt(st);
        return b ? hatFrames(b) : [blank()];
      },
      opts: { ticksPerFrame: 5 },
    },
    // Optional entry strips (the Soldier base falls back without them).
    emerge: { frames: (st) => emergeFrames(render(st, t, { ...stand, ...CLIMB, ...far, armN: CLIMB.armN })), opts: { ticksPerFrame: 4, loop: false } },
    ski: { poses: SKI.map((p) => ({ ...h, ...p })), opts: { ticksPerFrame: 8 } },
    'ski-crash': { poses: SKI_CRASH.map((p) => ({ ...h, ...p })), opts: { durations: [6, 7, 7], loop: false } },
    slip: { poses: SLIP.map((p) => ({ ...h, ...p })), opts: { durations: [6, 10, 12, 12], loop: false } },
    skate: { poses: SKATE.map((p) => ({ ...h, ...p })), opts: { ticksPerFrame: 10 } },
    'shatter-head': {
      frames: (st) => [headOnly(renderHuman(st, { armN: A(4, 10), armF: A(-4, 10), expr: 'panic' }, 'upper'))],
      opts: { ticksPerFrame: 30 },
    },
  };
}

/** The head of an upper-body frame, cropped, standing on its chin (feet anchor). */
export function headOnly(f: Frame): Frame {
  const h = f.pts?.head ?? [0, -14];
  const x0 = f.ox + h[0] - 9;
  const y0 = f.oy + h[1] - 10;
  const c = f.buf.crop(x0, y0, 19, 17);
  const t = c.trimBounds();
  if (!t) return { buf: c, ox: 9, oy: 17 };
  const out = c.crop(t.x, t.y, t.w, t.h);
  return { buf: out, ox: out.w >> 1, oy: out.h };
}

function blank(): Frame {
  return { buf: new PixelBuffer(1, 1), ox: 0, oy: 0 };
}

/** Two raised fingers (the photo-pose peace sign), 3×4 + outline. */
function vSign(): PixelBuffer {
  const b = new PixelBuffer(5, 6);
  const g = PAL.snow;
  b.set(1, 1, g[3]);
  b.set(1, 2, g[2]);
  b.set(3, 1, g[3]);
  b.set(3, 2, g[2]);
  b.set(2, 3, g[2]);
  return b.outline(INK);
}

export { nudge };
