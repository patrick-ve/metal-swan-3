/**
 * Hostage sprites (`item/hostage/<kind>/<anim>`; docs/ARCHITECTURE.md §6.1, GDD §2.3, §7.2).
 * Every kind is a fully dressed humanoid-rig style with its own props:
 *
 * - `critic`   tweed suit, grey parted hair, round glasses, red bow tie, a notepad and a star card;
 * - `roadie`   heavy build, black tank top and cap, beard, cargo trousers, a black flight case;
 * - `tea-lady` white curly hair in pink curlers, pink dress, a white floral apron, a teapot;
 * - `tourist`  orange palm-print shirt, sun hat, shades, a camera bag and a flash camera;
 * - `composer` wild white hair, black tail coat, white bow tie, a conductor's baton (the 1UP);
 * - `dollop`   Mrs. Dollop: pink uniform, white paper hat, blond bob, a mint-striped apron.
 *
 * Strips per kind: `tied` (chair: rest, blink, struggle), `caged`, `mast` (same three frames),
 * `sack` (4-frame hop), `dangle` (2), `chute` (2, parachute), `freed` (4), `walk` (8), `gag` (4,
 * the kind's own beat), `give` (4, `hand`), `bow` (2, a curtain-call bow — never a salute),
 * `run` (8); the roadie adds `carry` (8, walking with his case). `item/hostage/<anim>` (no kind)
 * are the critic's strips. Small effects: `item/hostage/star`, `flash`, `note`, `steam`,
 * `case-open`. All feet-anchored unless noted.
 *
 * UHD art (docs/ART_GUIDE.md "UHD art"): every hostage id has ONE density-generic generator for
 * 2× and 4×: the rig at d (renderHuman), the props, aprons, raised fists, baton, dropped rope and
 * small effects painted natively with the UHD kit (HdCanvas, PAL_HD, outline A; `…Hd` below, each
 * in its 1× box), the palm print, curlers and rope coils laid onto the HD figure, and a warm blush
 * where the rig would paint the teal accent. ams frees only tourists, so the tourist's strips and
 * the camera flash are registered at 2× and 4×, the rest at 2× (`HD4_KINDS`).
 *
 * Motion (tourist only, docs/ART_GUIDE.md "Motion"; the timings stay inside the Hostage state
 * ticks): `bow` 5 (open arms, two eased in-betweens, the deep bow, a rise; 12 ticks), `freed` 7
 * (a crouch, the hop, an in-between, the landing with arms up, the stretch, an in-between, relax;
 * 20 ticks), `turn` (2: turnSquash of the standing frame, turn-to-run) and `sack-turn` (2: the
 * sack squeezed). hostages.ts plays the turn strips on a facing change (draw only).
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { PAL_HD } from '../../../engine/palette-hd';
import { defineHdSprite, defineSprite, getFrames, type SpriteOpts } from '../../../engine/sprites';
import { BLACK_ONE_HUE, HdCanvas, folds, type TexSample, type Texture } from '../../art/hd';
import { spanOf } from '../../art/hd/body';
import { withPieces, type Piece } from '../../art/human-fx';
import { withSwing } from '../../art/human-sprites';
import { renderHuman, stackFrames, type ArmPose, type Density, type HumanStyle, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { turnSquash } from '../creatures/draw';
import { tween } from '../../art/tween';
import {
  HD_RENDER,
  cageBack,
  cageBackHd,
  cageFront,
  cageFrontHd,
  canopyPiece,
  canopyPieceHd,
  chairPiece,
  chairPieceHd,
  fitHd,
  hdCached,
  hdOf,
  sackPiece,
  sackPieceHd,
  type HdD,
} from './binds.art';
import { DANGLE_HANDS, HOSTAGE_KINDS, type HostageKindId } from './ids';

type V2 = readonly [number, number];
type Pts = Record<string, readonly [number, number]>;

// ------------------------------------------------------------------------------------ styles

/** Rig styles (GDD §7.2 table; `ink` boots and tops use the `black` ramp so they stay lighter than the outline). */
export const HOSTAGE_STYLES: Readonly<Record<HostageKindId, HumanStyle>> = {
  critic: {
    skin: 'skinC',
    hair: 'stone',
    hairStyle: 'parted',
    headgear: 'none',
    accent: 'red',
    top: 'brown',
    topType: 'jacket',
    shirt: 'cloth',
    pants: 'brown',
    boots: 'black',
    belt: 'black',
    gloves: null,
    build: 'normal',
    accessories: ['bowtie'],
    face: ['glasses'],
  },
  roadie: {
    skin: 'skinB',
    hair: 'hairB',
    hairStyle: 'short',
    headgear: 'cap',
    gear: 'black',
    accent: 'gold',
    top: 'black',
    topType: 'tank',
    pants: 'steel',
    boots: 'black',
    belt: 'brown',
    gloves: null,
    build: 'heavy',
    face: ['beard'],
  },
  'tea-lady': {
    skin: 'skinA',
    hair: 'snow',
    hairStyle: 'curly',
    headgear: 'none',
    accent: 'pink',
    top: 'pink',
    topType: 'tunic',
    pants: 'pink',
    boots: 'brown',
    belt: 'pink',
    gloves: null,
    build: 'normal',
    face: ['blush'],
  },
  tourist: {
    skin: 'skinA',
    hair: 'hairC',
    hairStyle: 'short',
    headgear: 'rainhat',
    gear: 'sand',
    accent: 'teal',
    top: 'orange',
    topType: 'shirt',
    pants: 'sand',
    boots: 'brown',
    belt: 'brown',
    gloves: null,
    build: 'normal',
    accessories: ['satchel'],
    face: ['shades', 'blush'],
  },
  composer: {
    skin: 'skinA',
    hair: 'snow',
    hairStyle: 'spiky',
    headgear: 'none',
    accent: 'cloth',
    top: 'black',
    topType: 'coat',
    shirt: 'cloth',
    pants: 'black',
    boots: 'black',
    belt: 'black',
    gloves: null,
    build: 'slim',
    accessories: ['bowtie'],
  },
  dollop: {
    skin: 'skinB',
    hair: 'hairC',
    hairStyle: 'bob',
    headgear: 'cap',
    gear: 'cloth',
    accent: 'teal',
    top: 'pink',
    topType: 'tunic',
    pants: 'pink',
    boots: 'cloth',
    belt: 'pink',
    gloves: null,
    build: 'normal',
    face: ['blush'],
  },
};

// ------------------------------------------------------------------------------------ props

/** A buffer from rows (+ outline): the props are tiny hand-made drawings. */
function art(rows: readonly string[], key: Readonly<Record<string, Color>>): PixelBuffer {
  return ascii(rows, key).padded(1).outline(INK);
}

const W = PAL.snow;
const PROPS = {
  /** The critic's notepad (spiral on top). */
  notepad: (): PixelBuffer => art(['sss', 'www', 'wnw', 'www', 'wnw'], { s: PAL.steel[3], w: W[2], n: PAL.navy[1] }),
  /** The star card (stars drawn at run time on its `card` point). */
  card: (): PixelBuffer => {
    const b = new PixelBuffer(15, 11);
    b.rect(0, 0, 15, 11, W[3]);
    b.strokeRect(1, 1, 13, 9, W[1]);
    b.hline(0, 14, 10, W[0]);
    b.vline(14, 0, 10, W[0]);
    return b.padded(1).outline(INK);
  },
  /** The roadie's black flight case (steel corners, a handle). */
  ampCase: (): PixelBuffer => {
    const b = new PixelBuffer(14, 10);
    b.rect(0, 2, 14, 8, PAL.black[2]);
    b.hline(0, 13, 2, PAL.black[3]);
    b.hline(0, 13, 9, PAL.black[1]);
    b.hline(0, 13, 5, PAL.black[1]);
    for (const [x, y] of [[0, 2], [12, 2], [0, 8], [12, 8]] as const) {
      b.rect(x, y, 2, 2, PAL.steel[3]);
      b.set(x, y, PAL.steel[4]);
    }
    b.rect(5, 0, 4, 2, PAL.steel[2]);
    b.rect(6, 1, 2, 1, 0);
    b.hline(4, 9, 6, PAL.gold[1]);
    return b.padded(1).outline(INK);
  },
  /** The open, empty case left behind (lid up behind it). */
  caseOpen: (): PixelBuffer => {
    const b = new PixelBuffer(16, 14);
    b.rect(1, 0, 13, 6, PAL.black[2]);
    b.hline(1, 13, 0, PAL.black[3]);
    b.rect(2, 1, 11, 4, PAL.red[1]);
    b.rect(0, 7, 15, 7, PAL.black[2]);
    b.hline(0, 14, 7, PAL.black[3]);
    b.rect(2, 7, 11, 2, PAL.red[1]);
    for (const [x, y] of [[0, 12], [13, 12]] as const) b.rect(x, y, 2, 2, PAL.steel[3]);
    return b.padded(1).outline(INK);
  },
  /** White teapot with a navy band (spout right). */
  teapot: (): PixelBuffer =>
    art(
      ['..bb....', '.wWWw...', 'wWWWWw.w', 'hnnnnnww', 'hwwwwwws', '.wwwwws.'],
      { b: PAL.navy[1], w: W[2], W: W[3], n: PAL.navy[1], h: W[1], s: W[1] },
    ),
  /** Teacup on a saucer. */
  cup: (): PixelBuffer => art(['wWw.', 'wwwh', 'sss.'], { w: W[2], W: W[3], h: W[1], s: PAL.navy[1] }),
  /** The tourist's flash camera (lens forward, flash cube on top). */
  camera: (): PixelBuffer => art(['.ff....', 'kkkkkk.', 'kKKKllk', 'kkkkllk', '.kkkkk.'], { f: W[3], k: PAL.black[1], K: PAL.black[3], l: PAL.sky[2] }),
};
type PropName = keyof typeof PROPS;

/** Props are built once per generation pass. */
const propCache = new Map<string, PixelBuffer>();
function prop(name: PropName): PixelBuffer {
  let b = propCache.get(name);
  if (!b) {
    b = PROPS[name]();
    propCache.set(name, b);
  }
  return b;
}

// ---- UHD props (one drawer per prop for d 2 and 4, each in its 1× prop's box) ----------------

const porcelainMat = (c: HdCanvas): number => c.material({ ramp: PAL_HD.snow, lo: 1, hi: 5, spec: 1, shine: 30, wrap: 0.1 });
const blackMat = (c: HdCanvas): number => c.material({ ramp: BLACK_ONE_HUE, lo: 1, hi: 5, spec: 0.5, shine: 16 });
const steelMat = (c: HdCanvas): number => c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 1, shine: 26 });

/** True on the one art-px row that holds logical y = `at` (a hairline rule at any density). */
function onRow(s: TexSample, at: number): boolean {
  return Math.floor(s.y * s.d) === Math.floor(at * s.d);
}

const PROPS_HD: Readonly<Record<PropName, (c: HdCanvas) => void>> = {
  // A reporter's pad: white pages with navy rules, a steel spiral along the top.
  notepad: (c) => {
    const paper = c.material({ ramp: PAL_HD.snow, lo: 2, hi: 6, spec: 0.1 });
    const rule = c.material({ ramp: PAL_HD.navy, lo: 2, hi: 4 });
    c.box(1, 1.8, 3, 4.2, {
      mat: paper,
      z: 0,
      bevel: 0.35,
      tex: (s) => {
        if (onRow(s, 3.5) || onRow(s, 5)) s.mat = rule;
      },
    });
    const st = steelMat(c);
    for (const x of [1.6, 2.5, 3.4]) c.capsule(x, 1.2, x, 2.3, 0.3, 0.3, { mat: st, z: 1 });
  },
  // The star card: a thick white card with an inset frame line, its edges turned from the light.
  card: (c) => {
    const card = c.material({ ramp: PAL_HD.snow, lo: 2, hi: 6, spec: 0.3, shine: 12, amb: 0.3 });
    c.box(1, 1, 15, 11, {
      mat: card,
      z: 0,
      bevel: 0.5,
      tex: (s) => {
        const m = Math.min(s.x - 2, 15 - s.x, s.y - 2, 11 - s.y);
        if (m >= 0 && m < 1 / s.d) s.tone -= 0.3;
      },
    });
  },
  // The flight case: black ply with a lid seam, steel corner caps, a steel handle, a brass latch.
  ampCase: (c) => {
    const k = blackMat(c);
    const st = steelMat(c);
    c.box(1, 3, 14, 8, {
      mat: k,
      z: 0,
      bevel: 0.6,
      tex: (s) => {
        if (onRow(s, 6.5)) s.tone -= 0.4;
      },
    });
    for (const [x, y] of [[1, 3], [13, 3], [1, 9], [13, 9]] as const) c.box(x, y, 2, 2, { mat: st, z: 1, bevel: 0.5, r: 0.3 });
    c.box(6, 1, 4, 2.2, { mat: st, z: 0.5, bevel: 0.5, r: 0.5, tone: -0.1 });
    c.erase(7, 2, 2, 1, () => true);
    c.box(5, 6.7, 6, 0.9, { mat: c.material({ ramp: PAL_HD.gold, lo: 1, hi: 5, spec: 0.9, shine: 22 }), z: 1.2, bevel: 0.3 });
  },
  // The open case: the lid up behind with its red lining, the box with the red inside, steel corners.
  caseOpen: (c) => {
    const k = blackMat(c);
    const lining = c.material({ ramp: PAL_HD.red, lo: 1, hi: 4, wrap: 0.1 });
    c.box(2, 1, 13, 6, { mat: k, z: 0, bevel: 0.5 });
    c.box(3, 2, 11, 4, { mat: lining, z: 0.4, bevel: 0.4, tex: folds({ angle: 0.3, spacing: 1.4, amp: 0.8, seed: 9 }) });
    c.box(1, 8, 15, 7, { mat: k, z: 1, bevel: 0.6 });
    c.box(3, 8, 11, 2, { mat: lining, z: 1.3, bevel: 0.3, tone: -0.25 });
    for (const [x, y] of [[1, 13], [14, 13]] as const) c.box(x, y, 2, 2, { mat: steelMat(c), z: 2, bevel: 0.5, r: 0.3 });
  },
  // A white porcelain teapot with a navy band, its lid and knob, the spout to the right, the handle left.
  teapot: (c) => {
    const p = porcelainMat(c);
    const navy = c.material({ ramp: PAL_HD.navy, lo: 2, hi: 5, spec: 0.9, shine: 26 });
    c.ellipsoid(4.2, 4.9, 3.1, 2.2, {
      mat: p,
      z: 0,
      tex: (s) => {
        if (s.y > 4 && s.y < 5) s.mat = navy;
      },
    });
    c.capsule(6.6, 5.4, 8.5, 3.4, 0.6, 0.35, { mat: p, z: 0.4 });
    c.stroke([[1.8, 3.9], [1.1, 4.4], [1.1, 5.4], [1.8, 5.9]], 0.45, 0.45, { mat: p, z: -0.2, tone: -0.1 });
    c.ellipsoid(4.2, 2.7, 2.1, 0.8, { mat: p, z: 1 });
    c.ellipsoid(4, 1.6, 0.75, 0.65, { mat: navy, z: 1.4 });
  },
  // A teacup on its saucer.
  cup: (c) => {
    const p = porcelainMat(c);
    c.ellipsoid(2.5, 4, 2.1, 0.55, { mat: c.material({ ramp: PAL_HD.navy, lo: 2, hi: 5, spec: 0.8 }), z: 0 });
    c.cylinder(1, 1, 3, 2.8, { mat: p, z: 0.5, cap: 0.7 });
    c.stroke([[3.9, 1.6], [4.6, 2], [4, 2.7]], 0.3, 0.3, { mat: p, z: 0.3, tone: -0.1 });
  },
  // The flash camera: leatherette body, a chrome top plate, the lens barrel with a lit glass front, the flash cube.
  camera: (c) => {
    const k = blackMat(c);
    const st = steelMat(c);
    const glass = c.material({ ramp: PAL_HD.sky, lo: 0, hi: 5, spec: 1, shine: 30 });
    c.box(1, 2, 6, 4, {
      mat: k,
      z: 0,
      bevel: 0.5,
      r: 0.3,
      tex: (s) => {
        if (s.d >= 4) s.tone += ((Math.floor(s.x * 4) + Math.floor(s.y * 4)) & 1) * 0.08;
      },
    });
    c.box(1, 2, 6, 0.8, { mat: st, z: 0.6, bevel: 0.3 });
    c.cylinder(5.2, 2.9, 2.4, 2.4, { mat: k, z: 1, axis: 'h', tone: 0.05 });
    c.ellipsoid(7.2, 4.1, 0.55, 1.05, { mat: glass, z: 1.6 });
    c.box(2, 1, 2, 1.2, { mat: c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6, spec: 0.6 }), z: 1, bevel: 0.3 });
  },
};

/** A prop as a piece at density `d`: the 1× drawing at d 1, else its UHD drawing (the same logical box). */
function propAt(name: PropName, d: Density): { buf: PixelBuffer; density?: number } {
  if (d === 1) return { buf: prop(name) };
  const hd = hdOf(d);
  const lo = prop(name);
  return {
    buf: hdCached(`hostage-prop:${name}@${hd}`, () => {
      const c = new HdCanvas(lo.w, lo.h, hd);
      PROPS_HD[name](c);
      fitHd(c, lo);
      return c.render(HD_RENDER);
    }),
    density: hd,
  };
}

/** A conductor's baton (ivory stick, cork grip) from the hand at `angle` degrees (0 = forward). */
function baton(angle: number): { buf: PixelBuffer; grip: V2; tip: V2 } {
  const b = new PixelBuffer(17, 17);
  const a = (angle * Math.PI) / 180;
  const c = 8;
  const tx = Math.round(c + Math.cos(a) * 7);
  const ty = Math.round(c + Math.sin(a) * 7);
  b.line(c, c, tx, ty, W[3]);
  b.set(c, c, PAL.sand[1]);
  return { buf: b.outline(INK), grip: [c, c], tip: [tx, ty] };
}

/** The baton at density d (same box, grip and tip): a tapering lacquered ivory stick, a cork grip. */
function batonAt(angle: number, d: Density): { buf: PixelBuffer; grip: V2; tip: V2; density?: number } {
  const lo = baton(angle);
  if (d === 1) return lo;
  const hd = hdOf(d);
  const buf = hdCached(`baton:${angle}@${hd}`, () => {
    const c = new HdCanvas(17, 17, hd);
    c.capsule(8.5, 8.5, lo.tip[0] + 0.5, lo.tip[1] + 0.5, 0.42, 0.28, { mat: c.material({ ramp: PAL_HD.cloth, lo: 3, hi: 5, spec: 1, shine: 28 }), z: 0 });
    c.ellipsoid(8.5, 8.5, 0.75, 0.75, { mat: c.material({ ramp: PAL_HD.sand, lo: 1, hi: 5, spec: 0.2 }), z: 1 });
    fitHd(c, lo.buf);
    return c.render(HD_RENDER);
  });
  return { buf, grip: lo.grip, tip: lo.tip, density: hd };
}

/** A tilted copy of the teapot (pouring), rotated about its centre. */
function teapotTilted(deg: number): PixelBuffer {
  return prop('teapot').rotated((deg * Math.PI) / 180, { quality: 'fast' });
}

/** The tilted teapot at density d: the HD pot rotated, centred in the 1× tilted pot's box × d (same logical size). */
function teapotTiltedAt(deg: number, d: Density): { buf: PixelBuffer; density?: number } {
  const lo = teapotTilted(deg);
  if (d === 1) return { buf: lo };
  const hd = hdOf(d);
  const buf = hdCached(`teapot-tilt:${deg}@${hd}`, () => {
    const r = propAt('teapot', d).buf.rotated((deg * Math.PI) / 180, { quality: 'fast' });
    const out = new PixelBuffer(lo.w * hd, lo.h * hd);
    out.blit(r, Math.round((out.w - r.w) / 2), Math.round((out.h - r.h) / 2));
    return out;
  });
  return { buf, density: hd };
}

// ------------------------------------------------------------------------------------ figure

/** Where the rig puts both wrists (only the near one is a frame point), for two-handed props. */
function farHand(f: Frame, pose: Pose): V2 {
  const hand = f.pts?.hand ?? [0, -20];
  const n = reach(pose.armN);
  const r = reach(pose.armF);
  // The far shoulder sits 2 px in front of the near one (3/4 view).
  return [Math.round(hand[0] - n[0] + 2 + r[0]), Math.round(hand[1] - n[1] + r[1])];
}

/** Wrist offset from its shoulder for an arm pose (IK reach ≤ 12 px; FK with 6 + 6 px bones). */
function reach(a: ArmPose | undefined): V2 {
  if (!a) return [0, 10];
  if (a.to) {
    const d = Math.hypot(a.to[0], a.to[1]);
    const k = d > 11.9 ? 11.9 / d : 1;
    return [a.to[0] * k, a.to[1] * k];
  }
  const D = Math.PI / 180;
  const sh = (a.sh ?? 5) * D;
  const fe = ((a.sh ?? 5) + (a.el ?? 20)) * D;
  return [Math.sin(sh) * 6 + Math.sin(fe) * 6, Math.cos(sh) * 6 + Math.cos(fe) * 6];
}

/** An apron hanging from the belt (tea lady: white with pink flowers; Mrs. Dollop: mint stripes). */
function apron(kind: HostageKindId): PixelBuffer {
  const b = new PixelBuffer(7, 10);
  b.rect(0, 0, 7, 10, PAL.cloth[2]);
  b.hline(0, 6, 0, PAL.cloth[3]);
  b.vline(6, 1, 9, PAL.cloth[1]);
  b.hline(0, 6, 9, kind === 'dollop' ? PAL.teal[2] : PAL.pink[2]);
  if (kind === 'dollop') {
    for (const x of [1, 4]) b.vline(x, 1, 8, PAL.teal[2]);
  } else {
    // Two small flowers.
    for (const [x, y] of [[1, 2], [4, 5]] as const) {
      b.set(x, y, PAL.pink[2]);
      b.set(x + 1, y, PAL.pink[1]);
      b.set(x, y + 1, PAL.gold[2]);
    }
  }
  return b.padded(1).outline(INK);
}

/**
 * The HD apron (the `apron` box, 9 × 12): white cotton in soft folds with a coloured hem; Mrs.
 * Dollop's mint stripes, or the tea lady's two pink flowers with gold hearts.
 */
function apronHd(kind: HostageKindId, d: HdD): PixelBuffer {
  return hdCached(`hostage-apron:${kind}@${d}`, () => {
    const c = new HdCanvas(9, 12, d);
    const cloth = c.material({ ramp: PAL_HD.cloth, lo: 2, hi: 5, wrap: 0.1, spec: 0.1, amb: 0.2 });
    const trim = c.material({ ramp: kind === 'dollop' ? PAL_HD.teal : PAL_HD.pink, lo: 2, hi: 5, wrap: 0.1 });
    const pink = c.material({ ramp: PAL_HD.pink, lo: 2, hi: 6, spec: 0.3 });
    const gold = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.5 });
    const dollop = kind === 'dollop';
    const fl = folds({ angle: Math.PI / 2, spacing: 2.2, amp: 0.7, seed: 17 });
    c.blob([[1, 1], [8, 1], [8, 11], [1, 11]], 0.8, {
      mat: cloth,
      z: 0,
      bulge: 0.2,
      tex: (s) => {
        if (s.y > 10) s.mat = trim;
        else if (dollop && s.y > 2 && (Math.abs(s.x - 2.5) < 0.5 || Math.abs(s.x - 5.5) < 0.5)) s.mat = trim;
        fl(s);
      },
    });
    c.box(1, 1, 7, 1, { mat: cloth, z: 2, bevel: 0.35, tone: 0.1 });
    if (!dollop) {
      for (const [x, y] of [[2.6, 3.6], [5.6, 6.6]] as const) {
        for (const [dx, dy] of [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45]] as const) c.ellipsoid(x + dx, y + dy, 0.45, 0.45, { mat: pink, z: 2.2 });
        c.ellipsoid(x, y, 0.3, 0.3, { mat: gold, z: 2.8 });
      }
    }
    return c.render(HD_RENDER);
  });
}

/** Pink curlers in the tea lady's white hair (only where there is hair). */
function curlers(f: Frame): Frame {
  const head = f.pts?.head;
  if (!head) return f;
  const b = f.buf.clone();
  const hair = new Set<number>([PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]]);
  for (const [dx, dy] of [[-5, -4], [-1, -6], [-6, 0]] as const) {
    const x = f.ox + head[0] + dx;
    const y = f.oy + head[1] + dy;
    if (!hair.has(b.get(x, y)) || !hair.has(b.get(x + 1, y + 1))) continue;
    b.set(x, y, PAL.pink[2]);
    b.set(x + 1, y, PAL.pink[2]);
    b.set(x, y + 1, PAL.pink[1]);
    b.set(x + 1, y + 1, PAL.pink[1]);
  }
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** A lit pink curler (a 2 × 2 logical roll lying across the hair) at density d. */
function curlerHd(d: HdD): PixelBuffer {
  return hdCached(`curler@${d}`, () => {
    const c = new HdCanvas(2, 2, d);
    c.cylinder(0.1, 0.25, 1.8, 1.5, { mat: c.material({ ramp: PAL_HD.pink, lo: 2, hi: 6, spec: 0.8, shine: 20 }), z: 0, axis: 'h' });
    return c.render({ outline: 'none', ao: 0, rimLight: 0 });
  });
}

/** `curlers` on an HD frame: lit rollers at the same logical spots, drawn only over the HD white hair. */
function curlersHd(f: Frame): Frame {
  const head = f.pts?.head;
  const d = f.density ?? 1;
  if (!head) return f;
  const b = f.buf.clone();
  const cur = curlerHd(hdOf(d));
  for (const [dx, dy] of [[-5, -4], [-1, -6], [-6, 0]] as const) {
    const X = (f.ox + head[0] + dx) * d;
    const Y = (f.oy + head[1] + dy) * d;
    if (!PAL_HD.snow.includes(b.get(X + (d >> 1), Y + (d >> 1))) || !PAL_HD.snow.includes(b.get(X + d + (d >> 1), Y + d + (d >> 1)))) continue;
    for (let y = 0; y < cur.h; y++) {
      for (let x = 0; x < cur.w; x++) {
        const c = cur.get(x, y);
        if ((c & 255) !== 0 && PAL_HD.snow.includes(b.get(X + x, Y + y))) b.set(X + x, Y + y, c);
      }
    }
  }
  return { ...f, buf: b };
}

/** Green palm leaves printed on the tourist's orange shirt (2-px clusters on a loose lattice). */
function palmPrint(f: Frame): Frame {
  const b = f.buf.clone();
  const shirt = new Set<number>([PAL.orange[1], PAL.orange[2]]);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w - 1; x++) {
      const wx = x - f.ox;
      const wy = y - f.oy;
      if ((((wx + 64) * 3 + (wy + 64) * 5) % 11 + 11) % 11 !== 0) continue;
      if (!shirt.has(b.get(x, y)) || !shirt.has(b.get(x + 1, y))) continue;
      b.set(x, y, PAL.green[3]);
      b.set(x + 1, y, PAL.green[2]);
    }
  }
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/**
 * The palm print on an HD frame: the 1× lattice (whole logical px), each print a slanted leaf of
 * art px (a lighter midrib over the blade) whose green follows the shirt's light under it (a leaf
 * in the shirt's shade is a darker green), printed only on the orange shirt.
 */
function palmPrintHd(f: Frame): Frame {
  const d = f.density ?? 1;
  const b = f.buf.clone();
  const O = PAL_HD.orange;
  const G = PAL_HD.green;
  const lw = b.w / d;
  const lh = b.h / d;
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw - 1; x++) {
      const wx = x - f.ox;
      const wy = y - f.oy;
      if ((((wx + 64) * 3 + (wy + 64) * 5) % 11 + 11) % 11 !== 0) continue;
      if (O.indexOf(f.buf.get(x * d, y * d + (d >> 1))) < 0 || O.indexOf(f.buf.get(x * d + d + (d >> 1), y * d + (d >> 1))) < 0) continue;
      // A leaf about 1.7 × 0.8 logical px tilted up to the right, across the lattice's own
      // down-right rows (so the prints never join into stripes): an ellipse round the point.
      const cx = x + 1;
      const cy = y + 0.5;
      for (let Y = y * d - d; Y < (y + 2) * d; Y++) {
        for (let X = x * d; X < (x + 2) * d; X++) {
          const px = (X + 0.5) / d - cx;
          const py = (Y + 0.5) / d - cy;
          const u = px * 0.8 - py * 0.6;
          const v = px * 0.6 + py * 0.8;
          if ((u / 0.88) ** 2 + (v / 0.4) ** 2 > 1) continue;
          const o = O.indexOf(f.buf.get(X, Y));
          if (o < 0) continue;
          const rib = d >= 4 && Math.abs(v) < 0.5 / d;
          b.set(X, Y, G[Math.min(G.length - 1, Math.max(1, o + (rib ? 2 : 1)))]);
        }
      }
    }
  }
  return { ...f, buf: b };
}

const APRONS: Readonly<Partial<Record<HostageKindId, true>>> = { 'tea-lady': true, dollop: true };

/** The kind's figure in a pose: the rig, plus its apron, curlers or shirt print (`d` 2 / 4: the rig at d with the UHD pieces). */
function figure(kind: HostageKindId, pose: Pose, d: Density = 1): Frame {
  const style = HOSTAGE_STYLES[kind];
  let f: Frame;
  if (APRONS[kind] && !pose.rot) {
    // The apron hangs between the legs and the arms: legs → apron → torso and arms.
    const lower = renderHuman(style, pose, 'lower', d);
    const upper = renderHuman(style, pose, 'upper', d);
    const hip = lower.pts.hip ?? [0, -15];
    const lean = pose.crouch || (pose.legN && pose.legN.hip > 70) ? 1 : 0;
    const piece: Piece = d === 1 ? { buf: apron(kind), x: hip[0] - 3 + lean, y: hip[1] - 1 } : { buf: apronHd(kind, hdOf(d)), x: hip[0] - 3 + lean, y: hip[1] - 1, density: d };
    const legs = withPieces(lower, [piece]);
    f = stackFrames(legs, upper);
  } else f = renderHuman(style, pose, 'full', d);
  if (d === 1) {
    if (kind === 'tourist') f = palmPrint(f);
    if (kind === 'tea-lady') f = curlers(f);
    return f;
  }
  if (kind === 'tourist') f = palmPrintHd(f);
  if (kind === 'tea-lady') f = curlersHd(f);
  return f;
}

/** Add pieces (props) to a frame; extra points ride along. */
function dress(f: Frame, pieces: readonly Piece[], pts?: Pts): Frame {
  return pieces.length || pts ? withPieces(f, pieces, pts) : f;
}

/** A piece placed so that its pixel (px, py) lands on the frame point `at` (`density`: of `buf`; px, py stay logical). */
function at(buf: PixelBuffer, p: V2, px: number, py: number, behind = false, density?: number): Piece {
  const piece: Piece = { buf, x: Math.round(p[0] - px), y: Math.round(p[1] - py), behind };
  if (density !== undefined && density !== 1) piece.density = density;
  return piece;
}

/** `at` for a prop at density d. */
function atProp(name: PropName, d: Density, p: V2, px: number, py: number, behind = false): Piece {
  const pr = propAt(name, d);
  return at(pr.buf, p, px, py, behind, pr.density);
}

// ------------------------------------------------------------------------------------ poses

const L = (hip: number, knee: number, foot?: number) => (foot === undefined ? { hip, knee } : { hip, knee, foot });

/** Sitting on the chair: thighs forward, shins down, hands tied behind the back. */
const SIT: Pose = {
  legN: L(88, 92),
  legF: L(82, 96),
  armN: { sh: -30, el: -10, hand: 'fist' },
  armF: { sh: -40, el: -10, hand: 'fist' },
};

/** Kneeling in the cage, hands on the front bars. */
const KNEEL: Pose = {
  ...P.CROUCH,
  lean: 6,
  armN: { to: [7, -2], hand: 'grip' },
  armF: { to: [8, -1], hand: 'grip' },
};

/** Standing against the mast, feet together, hands tied behind it. */
const POLE: Pose = {
  legN: L(6, 6),
  legF: L(-4, 6),
  armN: { sh: -35, el: -15, hand: 'fist' },
  armF: { sh: -42, el: -12, hand: 'fist' },
};

/** Hanging by the raised wrists under the balloon, legs dangling. */
const HANG: Pose = {
  legN: L(12, 18),
  legF: L(-8, 26),
  armN: { sh: 168, el: 4, hand: 'fist' },
  armF: { sh: 174, el: 2, hand: 'fist' },

  grounded: false,
};

/** Struggle-frame overrides: lean and kick, mouth open (MMF!). */
const STRUGGLE: Pose = { expr: 'shout' };

/** The rest / blink / struggle triple of a tied pose. */
function tiedTriple(base: Pose, struggle: Pose): Pose[] {
  return [
    { ...base, expr: 'normal' },
    { ...base, expr: 'blink' },
    { ...base, ...STRUGGLE, ...struggle },
  ];
}

/** Freed: hop up as the ropes drop, land with the arms up, stretch, relax. */
const FREED: readonly Pose[] = [
  { ...P.JUMP[0], armN: { sh: 160, el: 20, hand: 'open' }, armF: { sh: 170, el: 20, hand: 'open' }, dy: -3, expr: 'panic' },
  { ...P.STAND, armN: { to: [-2, -12], hand: 'open' }, armF: { to: [4, -12], hand: 'open' }, expr: 'happy' },
  { ...P.STAND, armN: { to: [-3, -12], hand: 'fist' }, armF: { to: [3, -12], hand: 'fist' }, lean: -6, expr: 'blink' },
  { ...P.STAND, armN: { sh: 20, el: 40, hand: 'fist' }, armF: { sh: -6, el: 30 }, expr: 'happy' },
];

/** Give: reach into a pocket, pull out the gift, hold it out (×2: the hand-over), let go. */
const GIVE: readonly Pose[] = [
  { ...P.STAND, armN: { to: [3, 7], hand: 'fist' }, lean: 4, expr: 'normal' },
  { ...P.STAND, armN: { to: [8, 1], hand: 'grip' }, held: 'gift', lean: 4, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, 2], hand: 'grip' }, held: 'gift', lean: 6, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, 3], hand: 'open' }, lean: 6, expr: 'happy' },
];

/** The curtain-call bow: arms open wide, then a deep bow (hostages never salute). */
const BOW: readonly Pose[] = [
  { ...P.STAND, armN: { sh: 105, el: 10, hand: 'open' }, armF: { sh: 115, el: 10, hand: 'open' }, lean: -4, expr: 'happy' },
  { ...P.STAND, lean: 38, armN: { to: [2, 7], hand: 'open' }, armF: { sh: -50, el: 10, hand: 'open' }, head: { tilt: 10 }, expr: 'blink' },
];

/** The critic doffs an imaginary hat, then bows with the "hat" swept low. */
const BOW_CRITIC: readonly Pose[] = [
  { ...P.STAND, armN: { to: [3, -13], hand: 'grip' }, armF: { sh: -10, el: 20 }, expr: 'happy' },
  { ...P.STAND, lean: 36, armN: { sh: 70, el: 10, hand: 'grip' }, armF: { sh: -45, el: 10, hand: 'open' }, head: { tilt: 10 }, expr: 'blink' },
];

/** Tourist bow (5): open arms → two eased in-betweens → deep bow → rise back toward the stance. */
const BOW_RISE: Pose = { ...P.STAND, lean: 14, armN: { to: [4, 4], hand: 'open' }, armF: { sh: -20, el: 14, hand: 'open' }, expr: 'happy' };
const BOW_OPEN: Pose = { ...BOW[0], armF: { sh: 80, el: 14, hand: 'open' } };
const BOW_DEEP: Pose = { ...BOW[1], armF: { sh: -24, el: 14, hand: 'open' } };
export const BOW5 = (k: HostageKindId): Pose[] => tween(HOSTAGE_STYLES[k], [BOW_OPEN, BOW_DEEP, BOW_RISE], { perKey: [2, 0], ease: 'linear' });
export const TOURIST_BOW_TIMING: readonly number[] = [3, 3, 3, 2, 1];

/** Tourist freed (7): a crouch (anticipation), the hop, in-between, land arms up, in-between, stretch, relax. */
const FREED_CROUCH: Pose = { legN: P.LAND.legN, legF: P.LAND.legF, armN: { sh: 30, el: 60, hand: 'open' }, armF: { sh: 20, el: 60, hand: 'open' }, expr: 'panic' };
/** The tourist relaxes with the hands at the belly (the arms come halfway down: a smaller drop). */
const FREED_RELAX: Pose = { ...P.STAND, armN: { to: [5, 0], hand: 'fist' }, armF: { to: [7, 0], hand: 'fist' }, expr: 'happy' };
export const FREED7 = (k: HostageKindId): Pose[] => tween(HOSTAGE_STYLES[k], [FREED_CROUCH, FREED[0], FREED[1], FREED[2], FREED_RELAX], { perKey: [0, 1, 0, 1], ease: ['out', 'in', 'inOut', 'inOut'] });
export const TOURIST_FREED_TIMING: readonly number[] = [3, 3, 2, 3, 3, 4, 2];

const WALK = withSwing(P.WALK, 0.9, 30).map((p) => ({ ...p, expr: 'happy' as const }));
const RUN = withSwing(P.RUN, 1.1, 80).map((p) => ({ ...p, lean: 10, expr: 'happy' as const }));

// ------------------------------------------------------------------------------------ strips

/** Bind strips stacked from pieces: the chair, the cage, the sack, the parachute. */

/** Rope coils around a sitting figure, drawn only over its own pixels (they hug the silhouette). */
function roped(f: Frame): Frame {
  const b = f.buf.clone();
  const hip = f.pts?.hip ?? [0, -10];
  const rope = PAL.sand;
  for (const dy of [3, 7]) {
    const y = f.oy + hip[1] - dy;
    let first = -1;
    let last = -1;
    for (let x = 0; x < b.w; x++) {
      const c = f.buf.get(x, y);
      if ((c & 255) !== 0 && c !== INK) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0) continue;
    for (let x = first - 1; x <= last + 1; x++) {
      b.set(x, y, (x & 1) === 0 ? rope[3] : rope[2]);
      if ((f.buf.get(x, y + 1) & 255) !== 0) b.set(x, y + 1, rope[0]);
    }
    b.set(first - 2, y, INK);
    b.set(last + 2, y, INK);
    b.set(first - 1, y - 1, INK);
    b.set(last + 1, y - 1, INK);
  }
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Is `c` an outline px (the ink tones)? */
function isInk(c: Color): boolean {
  return c === PAL_HD.ink[0] || c === PAL_HD.ink[1];
}

/**
 * `roped` on an HD frame: the same two coils on the same logical rows, each a twisted rope one
 * logical px thick (strands lit from above, dark grooves), a soft shadow under it on the figure,
 * and an ink edge only where the rope sticks out past the silhouette.
 */
function ropedHd(f: Frame): Frame {
  const d = f.density ?? 1;
  const b = f.buf.clone();
  const hip = f.pts?.hip ?? [0, -10];
  const S = PAL_HD.sand;
  for (const dy of [3, 7]) {
    const y = f.oy + hip[1] - dy;
    const mid = y * d + (d >> 1);
    let first = -1;
    let last = -1;
    for (let x = 0; x < b.w; x++) {
      const c = f.buf.get(x, mid);
      if ((c & 255) !== 0 && !isInk(c)) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0) continue;
    const X0 = first - d;
    const X1 = last + d;
    const rope = new PixelBuffer(b.w, b.h);
    for (let Y = y * d; Y < (y + 1) * d; Y++) {
      const v = (Y - y * d + 0.5) / d;
      for (let X = X0; X <= X1; X++) {
        const f2 = ((((X + 0.5) / d) * 1.1 + v * 0.9) % 1 + 1) % 1;
        const t = f2 < 0.18 ? 1 : v < 0.35 ? 5 : v < 0.7 ? 4 : 2;
        rope.set(X, Y, S[t]);
      }
    }
    // The shadow under the coil on the figure (half a logical px), then the coil.
    for (let Y = (y + 1) * d; Y < (y + 1) * d + Math.max(1, d >> 1); Y++) {
      for (let X = X0; X <= X1; X++) if ((f.buf.get(X, Y) & 255) !== 0 && !isInk(f.buf.get(X, Y))) b.set(X, Y, S[0]);
    }
    for (let Y = y * d; Y < (y + 1) * d; Y++) for (let X = X0; X <= X1; X++) b.set(X, Y, rope.get(X, Y));
    // Ink where the rope meets empty space (its ends and its top edge past the silhouette).
    for (let Y = y * d - d; Y < (y + 1) * d + d; Y++) {
      for (let X = X0 - d; X <= X1 + d; X++) {
        if ((b.get(X, Y) & 255) !== 0) continue;
        let near = false;
        for (let k = -d; k <= d && !near; k++) for (let j = -d; j <= d && !near; j++) if ((rope.get(X + j, Y + k) & 255) !== 0) near = true;
        if (near) b.set(X, Y, PAL_HD.ink[0]);
      }
    }
  }
  return { ...f, buf: b };
}

/** Loose rope pieces on the ground (freed). */
function droppedRope(): PixelBuffer {
  const b = new PixelBuffer(14, 4);
  b.line(1, 2, 5, 1, PAL.sand[2]).line(6, 2, 12, 2, PAL.sand[3]);
  return b.outline(INK);
}

/** The dropped rope at density d (the 14 × 4 box): two twisted rope ends, one frayed. */
function droppedRopeHd(d: HdD): PixelBuffer {
  return hdCached(`dropped-rope@${d}`, () => {
    const c = new HdCanvas(14, 4, d);
    const m = c.material({ ramp: PAL_HD.sand, lo: 1, hi: 6, wrap: 0.1, spec: 0.15 });
    const tw = (ux: number, uy: number): Texture => (s) => {
      const f = (((s.x * ux + s.y * uy) * 0.9 + (-s.x * uy + s.y * ux) * 0.8) % 1 + 1) % 1;
      if (f < 0.18) s.tone -= 0.3;
    };
    c.capsule(1.6, 2.6, 5.4, 1.6, 0.5, 0.5, { mat: m, z: 0, tex: tw(0.97, -0.25) });
    c.capsule(6.6, 2.5, 12.4, 2.5, 0.5, 0.5, { mat: m, z: 0.2, tone: 0.1, tex: tw(1, 0) });
    c.capsule(12.4, 2.5, 13, 1.9, 0.25, 0.2, { mat: m, z: 0.3, tone: 0.2 });
    c.capsule(12.4, 2.5, 13, 3, 0.25, 0.2, { mat: m, z: 0.3, tone: 0.2 });
    fitHd(c, droppedRope());
    return c.render(HD_RENDER);
  });
}

function hipOf(f: Frame): V2 {
  return f.pts?.hip ?? [0, -14];
}

/** A piece at density d: the 1× buffer at d 1, else the HD one. */
function pieceAt(lo: () => PixelBuffer, hd: (d: HdD) => PixelBuffer, d: Density): { buf: PixelBuffer; density?: number } {
  return d === 1 ? { buf: lo() } : { buf: hd(hdOf(d)), density: d };
}

/** Tied to the chair (rest, blink, struggle: lean back and kick). */
function tiedFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  return tiedTriple(SIT, { lean: -8, legN: L(70, 50) }).map((p) => {
    const f = figure(kind, p, d);
    const [hx, hy] = hipOf(f);
    if (d !== 1) return ropedHd(withPieces(f, [{ buf: chairPieceHd(0, hdOf(d)), x: hx - 8, y: hy - 13, behind: true, density: d }]));
    return roped(withPieces(f, [{ buf: chairPiece(), x: hx - 8, y: hy - 13, behind: true }]));
  });
}

/** Kneeling in the hanging cage, gripping the bars (rest, blink, struggle: shake the bars). */
function cagedFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  const back = pieceAt(cageBack, cageBackHd, d);
  const front = pieceAt(cageFront, cageFrontHd, d);
  return tiedTriple(KNEEL, { lean: 12, armN: { to: [8, -4], hand: 'grip' } }).map((p) => {
    const f = figure(kind, p, d);
    return withPieces(f, [
      { ...back, x: -11, y: -31, behind: true },
      { ...front, x: -11, y: -31 },
    ]);
  });
}

/** Tied to the float mast, ropes drawn by the bind (rest, blink, struggle). */
function mastFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  return tiedTriple(POLE, { lean: -4, legN: L(14, 20) }).map((p) => figure(kind, p, d));
}

/** Hopping blindly in a sack: only the shoes show (squash, push off, airborne, land). */
function sackFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  const style = HOSTAGE_STYLES[kind];
  const steps: Array<{ legs: Pose; w: number; h: number; dy: number; tilt: number }> = [
    { legs: { legN: L(30, 50), legF: L(10, 50) }, w: 18, h: 27, dy: 0, tilt: 0 },
    { legs: { legN: L(8, 10, -20), legF: L(-6, 12, -20) }, w: 15, h: 30, dy: 0, tilt: 1 },
    { legs: { legN: L(16, 30), legF: L(0, 34), grounded: false, dy: -4 }, w: 15, h: 30, dy: -5, tilt: 1 },
    { legs: { legN: L(24, 36), legF: L(4, 36) }, w: 17, h: 28, dy: 0, tilt: 0 },
  ];
  return steps.map((s) => {
    const legs = renderHuman(style, s.legs, 'lower', d);
    // Keep only the shoes (the rows under the ankles); the sack covers the rest.
    const b = legs.buf.clone();
    for (let y = 0; y < b.h; y++) if (Math.floor(y / d) - legs.oy < -5 + (s.legs.dy ?? 0)) for (let x = 0; x < b.w; x++) b.set(x, y, 0);
    const feet: Frame = d === 1 ? { buf: b, ox: legs.ox, oy: legs.oy } : { buf: b, ox: legs.ox, oy: legs.oy, density: d };
    const bottom = s.dy - 3;
    if (d !== 1) return withPieces(feet, [{ buf: sackPieceHd(s.w, s.h, s.tilt, hdOf(d)), x: -((s.w + 6) >> 1), y: bottom - (s.h + 3), density: d }]);
    const sack = sackPiece(s.w, s.h, s.tilt);
    return withPieces(feet, [{ buf: sack, x: -(sack.w >> 1), y: bottom - (s.h + 3) }]);
  });
}

/** Hanging from the balloon rope by the wrists, legs kicking (the rope is drawn by the bind). */
function dangleFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  return [
    { ...HANG, expr: 'panic' as const },
    { ...HANG, legN: L(-4, 30), legF: L(14, 20), expr: 'shout' as const },
  ].map((p) => {
    // The rig's raised arms end behind the head: drawn-on forearms and fists stick up over it
    // and grip the rope, so the hang reads at 1x.
    const f = figure(kind, p, d);
    const head = f.pts?.head ?? [0, -29];
    const y = head[1] - 9;
    const grip: Pts = { hand: [head[0], y + 2] };
    const fists = pieceAt(() => raisedFists(kind), (hd) => raisedFistsHd(kind, hd), d);
    return fitHands(withPieces(f, [{ ...fists, x: head[0] - 3, y }], grip));
  });
}

/** Raised forearms (sleeves) with both fists on top: the hanging hostage's grip on the rope. */
function raisedFists(kind: HostageKindId): PixelBuffer {
  const st = HOSTAGE_STYLES[kind];
  const skin = PAL[st.skin as keyof typeof PAL];
  const top = PAL[st.top as keyof typeof PAL];
  // Both fists together round the rope, the sleeves spreading down to the shoulders.
  return art(['.Ssm.', '.ssm.', '.c.d.', 'c...d'], {
    S: skin[3] ?? INK,
    s: skin[2] ?? INK,
    m: skin[1] ?? INK,
    c: top[2] ?? INK,
    d: top[1] ?? INK,
  });
}

/** The raised fists at density d (the 7 × 6 box): two sleeves of the top's cloth, both fists round the rope (knuckles at 4×). */
function raisedFistsHd(kind: HostageKindId, d: HdD): PixelBuffer {
  return hdCached(`fists:${kind}@${d}`, () => {
    const st = HOSTAGE_STYLES[kind];
    const skin = spanOf(PAL[st.skin as keyof typeof PAL]);
    const top = spanOf(PAL[st.top as keyof typeof PAL]);
    const c = new HdCanvas(7, 6, d);
    const cloth = c.material({ ramp: top.ramp, lo: top.lo, hi: top.hi, wrap: 0.05 });
    const sk = c.material({ ramp: skin.ramp, lo: Math.max(1, skin.hi - 3), hi: Math.min(skin.ramp.length - 2, skin.hi), spec: 0.2, wrap: 0.1, amb: 0.12 });
    c.capsule(2.6, 3.4, 1.6, 4.9, 0.6, 0.55, { mat: cloth, z: 0 });
    c.capsule(4.4, 3.4, 5.4, 4.9, 0.6, 0.55, { mat: cloth, z: 0, tone: -0.1 });
    c.ellipsoid(3.5, 2, 1.5, 1.1, {
      mat: sk,
      z: 1,
      tex: (s) => {
        if (s.d >= 4 && s.y < 1.8 && Math.abs(((s.x - 2) % 0.75) - 0.37) < 0.08) s.tone -= 0.3;
      },
    });
    fitHd(c, raisedFists(kind));
    return c.render(HD_RENDER);
  });
}

/** Parachuting: both hands on the risers, the canopy above. */
function chuteFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  return [0, 1].map((i) => {
    const f = fitHands(figure(kind, { ...HANG, armN: { sh: 150, el: 26, hand: 'fist' }, armF: { sh: 160, el: 24, hand: 'fist' }, legN: L(i ? 20 : 8, 24), legF: L(i ? -2 : 6, 30), expr: 'happy' }, d));
    const hand = f.pts?.hand ?? [4, DANGLE_HANDS];
    const canopy = canopyPiece(i);
    const top = hand[1] - 22;
    const cx = canopy.w >> 1;
    if (d !== 1) {
      // Risers: fine lines (one art px) from the canopy hem down to the hands, no outline.
      const lines = new PixelBuffer(canopy.w * d, 22 * d);
      const seg = (x0: number, y0: number, x1: number, y1: number, c: Color): void => {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * d);
        for (let k = 0; k <= n; k++) lines.set(Math.floor((x0 + ((x1 - x0) * k) / n) * d), Math.floor((y0 + ((y1 - y0) * k) / n) * d), c);
      };
      seg(2.5, 0.5, cx - 0.5, 20.5, PAL_HD.stone[4]);
      seg(canopy.w - 2.5, 0.5, cx + 1.5, 20.5, PAL_HD.stone[3]);
      seg(cx + 0.5, 0.5, cx + 0.5, 20.5, PAL_HD.stone[5]);
      return withPieces(f, [
        { buf: lines, x: hand[0] - cx, y: top + 9, behind: true, density: d },
        { buf: canopyPieceHd(i, hdOf(d)), x: hand[0] - cx, y: top, density: d },
      ]);
    }
    const lines = new PixelBuffer(canopy.w, 22);
    // Risers from the canopy hem down to the hands.
    lines.line(2, 0, cx - 1, 20, PAL.stone[2]);
    lines.line(canopy.w - 3, 0, cx + 1, 20, PAL.stone[2]);
    lines.line(cx, 0, cx, 20, PAL.stone[3]);
    return withPieces(f, [
      { buf: lines, x: hand[0] - cx, y: top + 9, behind: true },
      { buf: canopy, x: hand[0] - cx, y: top },
    ]);
  });
}

/** Shift a hanging figure so its hands meet the rope end (DANGLE_HANDS above the anchor). */
function fitHands(f: Frame): Frame {
  const hand = f.pts?.hand;
  if (!hand) return f;
  const dy = DANGLE_HANDS - hand[1];
  const dx = -hand[0];
  const pts: Pts = {};
  for (const [k, p] of Object.entries(f.pts ?? {})) pts[k] = [p[0] + dx, p[1] + dy];
  const g: Frame = { buf: f.buf, ox: f.ox - dx, oy: f.oy - dy, pts };
  return f.density === undefined ? g : { ...g, density: f.density };
}

/** Freed: the ropes drop to the ground while they hop up, stretch and relax. */
function freedFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  const rope = d === 1 ? droppedRope() : droppedRopeHd(hdOf(d));
  // The tourist's tweened hop (the rope lies at the feet until the stretch).
  const seven = kind === 'tourist';
  const poses = seven ? FREED7(kind) : FREED;
  const ropeUntil = seven ? 5 : 3;
  return poses.map((p, i) => {
    const f = figure(kind, p, d);
    if (i >= ropeUntil) return f;
    if (seven) {
      const piece: Piece = { buf: rope, x: -8 + Math.min(2, Math.floor(i / 2)), y: -4, behind: i > 1 };
      if (d !== 1) piece.density = d;
      return withPieces(f, [piece]);
    }
    const piece: Piece = { buf: rope, x: -8 + i, y: -4, behind: i > 0 };
    if (d !== 1) piece.density = d;
    return withPieces(f, [piece]);
  });
}

// ---- per-kind dressing --------------------------------------------------------------------

/** Near-arm override and prop for the kind's walk (critic: notepad; tea lady: teapot; composer: baton). */
function walkFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  return WALK.map((p) => {
    if (kind === 'critic') {
      const pose: Pose = { ...p, armN: { to: [5, 3], hand: 'grip' } };
      const f = figure(kind, pose, d);
      return dress(f, [atProp('notepad', d, f.pts?.hand ?? [4, -16], 2, 3)]);
    }
    if (kind === 'tea-lady') {
      const pose: Pose = { ...p, armN: { sh: 6, el: 16, hand: 'grip' } };
      const f = figure(kind, pose, d);
      return dress(f, [atProp('teapot', d, f.pts?.hand ?? [2, -10], 1, 1)]);
    }
    if (kind === 'composer') {
      const f = figure(kind, p, d);
      const b = batonAt(-40, d);
      return dress(f, [at(b.buf, f.pts?.hand ?? [2, -10], b.grip[0], b.grip[1], false, b.density)]);
    }
    return figure(kind, p, d);
  });
}

/** The roadie walks with the heavy case held in front with both hands, leaning back. */
function carryFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  return WALK.map((p) => {
    const pose: Pose = { ...p, armN: { to: [7, 6], hand: 'grip' }, armF: { to: [7, 6], hand: 'grip' }, lean: -6, expr: 'normal' };
    const f = figure(kind, pose, d);
    const hand = f.pts?.hand ?? [6, -10];
    return dress(f, [atProp('ampCase', d, hand, 7, 1)]);
  });
}

/** The kind's 4-frame comedy beat (frames picked by the kind's `gagFrame`). */
function gagFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  switch (kind) {
    case 'critic': {
      // Scribbling on the notepad (the hand moves), then the star card held up high.
      const scribble = [3, 5].map((x) => {
        const pose: Pose = { ...P.STAND, armN: { to: [x, 2], hand: 'grip' }, armF: { to: [6, 3], hand: 'grip' }, head: { tilt: 8 }, expr: 'normal' };
        const f = figure(kind, pose, d);
        const far = farHand(f, pose);
        return dress(f, [atProp('notepad', d, far, 2, 2)]);
      });
      const up = [0, 1].map((i) => {
        const pose: Pose = { ...P.STAND, armN: { to: [2, -12], hand: 'grip' }, armF: { to: [4, -12], hand: 'grip' }, expr: 'happy', bob: i };
        const f = figure(kind, pose, d);
        const hand = f.pts?.hand ?? [2, -34];
        const cardAt: V2 = [hand[0] + 1, hand[1] - 6];
        return dress(f, [atProp('card', d, cardAt, 8, 6)], { card: [cardAt[0], cardAt[1]] });
      });
      return [...scribble, ...up];
    }
    case 'roadie': {
      const caseAt: V2 = [10, -1];
      const poses: Pose[] = [
        { ...P.STAND, lean: 22, armN: { to: [6, 9], hand: 'open' }, armF: { to: [7, 9], hand: 'open' }, expr: 'normal' },
        { ...P.STAND, armN: { to: [4, -9], hand: 'open' }, armF: { sh: -6, el: 20 }, expr: 'blink' },
        { ...P.STAND, lean: -6, armN: { sh: 30, el: 60, hand: 'fist' }, armF: { sh: -20, el: 60, hand: 'fist' }, expr: 'shout' },
        { ...P.STAND, lean: -4, armN: { sh: 30, el: 60, hand: 'fist' }, armF: { sh: -20, el: 60, hand: 'fist' }, expr: 'blink' },
      ];
      return poses.map((p) => dress(figure(kind, p, d), [atProp('ampCase', d, caseAt, 0, 11)]));
    }
    case 'tea-lady': {
      const poses: Array<{ pose: Pose; pot: number | null }> = [
        { pose: { ...P.STAND, armN: { to: [7, -3], hand: 'grip' }, armF: { to: [7, 3], hand: 'grip' }, expr: 'happy' }, pot: 35 },
        { pose: { ...P.STAND, armN: { to: [7, -4], hand: 'grip' }, armF: { to: [7, 3], hand: 'grip' }, expr: 'happy' }, pot: 55 },
        { pose: { ...P.STAND, armN: { sh: 6, el: 16, hand: 'grip' }, armF: { to: [6, -5], hand: 'grip' }, head: { tilt: -8 }, expr: 'blink' }, pot: 0 },
        { pose: { ...P.STAND, armN: { sh: 6, el: 16, hand: 'grip' }, armF: { to: [7, 2], hand: 'grip' }, expr: 'happy' }, pot: 0 },
      ];
      return poses.map(({ pose, pot }) => {
        const f = figure(kind, pose, d);
        const hand = f.pts?.hand ?? [5, -20];
        const far = farHand(f, pose);
        const lo = pot ? teapotTilted(pot) : prop('teapot');
        const pt = pot ? teapotTiltedAt(pot, d) : propAt('teapot', d);
        const pieces: Piece[] = [at(pt.buf, hand, pot ? lo.w >> 1 : 1, pot ? (lo.h >> 1) + 1 : 1, false, pt.density), atProp('cup', d, far, 2, 1)];
        return dress(f, pieces, { cup: [far[0], far[1] - 2] });
      });
    }
    case 'tourist': {
      const cam = propAt('camera', d);
      const poses: Pose[] = [
        { ...P.STAND, armN: { to: [6, -2], hand: 'grip' }, armF: { to: [7, -1], hand: 'grip' }, expr: 'happy' },
        { ...P.STAND, armN: { to: [7, -5], hand: 'grip' }, armF: { to: [8, -4], hand: 'grip' }, lean: 4, expr: 'blink' },
        { ...P.STAND, armN: { to: [7, -5], hand: 'grip' }, armF: { to: [8, -4], hand: 'grip' }, lean: 4, expr: 'happy' },
        { ...P.STAND, armN: { to: [5, 3], hand: 'grip' }, armF: { to: [6, 3], hand: 'grip' }, expr: 'happy' },
      ];
      return poses.map((p) => {
        const f = figure(kind, p, d);
        const hand = f.pts?.hand ?? [6, -26];
        const camAt: V2 = [hand[0] + 1, hand[1] - 2];
        return dress(f, [at(cam.buf, camAt, 2, 3, false, cam.density)], { flash: [camAt[0], camAt[1] - 3] });
      });
    }
    case 'composer': {
      // A 4/4 pattern with the eyes closed: down, in, out, up.
      const beats: Array<{ to: V2; angle: number }> = [
        { to: [6, 3], angle: 20 },
        { to: [1, -4], angle: -60 },
        { to: [9, -3], angle: -20 },
        { to: [5, -11], angle: -80 },
      ];
      return beats.map((b, i) => {
        const pose: Pose = { ...P.STAND, armN: { to: b.to, hand: 'grip' }, armF: { sh: 40 + i * 10, el: 50, hand: 'open' }, lean: i === 3 ? -4 : 2, expr: 'blink' };
        const f = figure(kind, pose, d);
        const hand = f.pts?.hand ?? [5, -20];
        const bt = batonAt(b.angle, d);
        return dress(f, [at(bt.buf, hand, bt.grip[0], bt.grip[1], false, bt.density)], { baton: [hand[0] + bt.tip[0] - bt.grip[0], hand[1] + bt.tip[1] - bt.grip[1]] });
      });
    }
    case 'dollop': {
      const poses: Pose[] = [
        { ...P.STAND, armN: { to: [5, -9], hand: 'fist' }, armF: { to: [2, 6], hand: 'open' }, expr: 'shout' },
        { ...P.STAND, armN: { to: [6, -10], hand: 'fist' }, armF: { to: [2, 6], hand: 'open' }, lean: 3, expr: 'shout' },
        { ...P.STAND, armN: { to: [11, -3], hand: 'point' }, armF: { to: [2, 6], hand: 'open' }, lean: 4, expr: 'happy' },
        { ...P.STAND, armN: { to: [11, -4], hand: 'point' }, armF: { to: [2, 6], hand: 'open' }, lean: 5, expr: 'normal' },
      ];
      return poses.map((p) => figure(kind, p, d));
    }
    default:
      return GIVE.map((p) => figure(kind, p, d));
  }
}

/** Give: generic gift box; the roadie opens his case instead; Mrs. Dollop gestures to the shed. */
function giveFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  if (kind === 'roadie') {
    const caseAt: V2 = [10, -1];
    const poses: Pose[] = [
      { ...P.CROUCH, armN: { to: [7, 4], hand: 'open' }, armF: { to: [7, 5], hand: 'open' }, lean: 10, expr: 'normal' },
      { ...P.CROUCH, armN: { to: [8, -2], hand: 'open' }, armF: { to: [7, 5], hand: 'open' }, lean: 6, expr: 'happy' },
      { ...P.CROUCH, armN: { to: [8, -3], hand: 'open' }, armF: { to: [7, 5], hand: 'open' }, lean: 6, expr: 'happy' },
      { ...P.STAND, armN: { sh: 160, el: 30, hand: 'thumb' }, armF: { sh: -6, el: 20 }, expr: 'happy' },
    ];
    return poses.map((p, i) => {
      const f = figure(kind, p, d);
      const piece = i === 0 ? atProp('ampCase', d, caseAt, 0, 11) : atProp('caseOpen', d, [caseAt[0] - 1, caseAt[1] + 1], 0, 15);
      // The gift pops out of the open case.
      return dress(f, [piece], i === 1 || i === 2 ? { hand: [caseAt[0] + 7, caseAt[1] - 8] } : undefined);
    });
  }
  if (kind === 'dollop') {
    const poses: Pose[] = [
      { ...P.STAND, armN: { to: [9, -6], hand: 'point' }, expr: 'happy' },
      { ...P.STAND, armN: { to: [11, -2], hand: 'open' }, lean: 4, expr: 'happy' },
      { ...P.STAND, armN: { to: [11, -1], hand: 'open' }, lean: 5, expr: 'happy' },
      { ...P.STAND, armN: { to: [4, -11], hand: 'open' }, expr: 'happy' },
    ];
    return poses.map((p) => figure(kind, p, d));
  }
  return GIVE.map((p) => {
    if (kind === 'composer') {
      // A flourish of the baton in the far hand would hide; he hands the gift over with a bow of the head.
      return figure(kind, { ...p, head: { tilt: 6 } }, d);
    }
    return figure(kind, p, d);
  });
}

function bowFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  if (kind === 'tourist') return BOW5(kind).map((p) => figure(kind, p, d));
  const poses = kind === 'critic' ? BOW_CRITIC : kind === 'composer' ? BOW.map((p, i) => (i === 1 ? { ...p, lean: 46 } : { ...p, armN: { sh: 150, el: 10, hand: 'grip' as const } })) : BOW;
  return poses.map((p, i) => {
    const f = figure(kind, p, d);
    if (kind === 'composer' && i === 0) {
      const b = batonAt(-70, d);
      return dress(f, [at(b.buf, f.pts?.hand ?? [4, -30], b.grip[0], b.grip[1], false, b.density)]);
    }
    return f;
  });
}

function runFrames(kind: HostageKindId, d: Density = 1): Frame[] {
  return RUN.map((p) => figure(kind, p, d));
}

// ------------------------------------------------------------------------------------ small fx

/** A gold star (3×3 plus with a white heart) for the critic's card (centre anchor). */
function starFrames(): Frame[] {
  const b = ascii(['.g.', 'gwg', '.g.'], { g: PAL.gold[2], w: PAL.gold[3] });
  return [{ buf: b, ox: 1, oy: 1 }];
}

/** The star at density d: a lit gold four-point star with a white-hot heart (no outline, as at 1×). */
function starFramesHd(d: HdD): Frame[] {
  const c = new HdCanvas(3, 3, d);
  const gold = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 1, shine: 20 });
  c.poly([[1.5, 0], [1.95, 1.05], [3, 1.5], [1.95, 1.95], [1.5, 3], [1.05, 1.95], [0, 1.5], [1.05, 1.05]], { mat: gold, z: 0 });
  c.ellipsoid(1.5, 1.5, 0.55, 0.55, { mat: gold, z: 1, tone: 0.4 });
  return [{ buf: c.render({ outline: 'none', ao: 0, rimLight: 0 }), ox: 1, oy: 1, density: d }];
}

/** The camera flash: a white burst shrinking to a twinkle (centre anchor). */
function flashFrames(): Frame[] {
  return [9, 6, 3].map((r) => {
    const s = r * 2 + 3;
    const b = new PixelBuffer(s, s);
    const c = s >> 1;
    b.circle(c, c, Math.max(1, r >> 1), W[3]);
    b.line(c - r, c, c + r, c, W[3]);
    b.line(c, c - r, c, c + r, W[3]);
    if (r > 3) {
      b.line(c - (r >> 1), c - (r >> 1), c + (r >> 1), c + (r >> 1), PAL.gold[3]);
      b.line(c - (r >> 1), c + (r >> 1), c + (r >> 1), c - (r >> 1), PAL.gold[3]);
    }
    return { buf: b, ox: c, oy: c };
  });
}

/**
 * The camera flash at density d (the same boxes): a white-hot core with a warm glow ring (an
 * ordered dither at its rim), long rays tapering to one art px, short gold diagonals (emissive,
 * no outline).
 */
function flashFramesHd(d: HdD): Frame[] {
  return [9, 6, 3].map((r) => {
    const s = r * 2 + 3;
    const k = s >> 1;
    const C = k + 0.5;
    const c = new HdCanvas(s, s, d);
    const glow = c.material({ ramp: PAL_HD.gold, lo: 4, hi: 7, flat: true, dither: 0.35 });
    const white = c.material({ ramp: PAL_HD.snow, lo: 4, hi: 6, flat: true });
    const core = Math.max(1, r >> 1) + 0.5;
    c.plane(C - core - 1, C - core - 1, (core + 1) * 2, (core + 1) * 2, {
      mat: glow,
      z: 0,
      mask: (x, y) => Math.hypot(x - C, y - C) < core + 0.9,
      tex: (sm) => {
        const q = Math.hypot(sm.x - C, sm.y - C) / (core + 0.9);
        if (q < 0.6) sm.mat = white;
        sm.tone = 0.5 - q * 0.9;
      },
    });
    const ray = (x0: number, y0: number, x1: number, y1: number, w0: number): void => {
      c.capsule(x0, y0, x1, y1, w0, 0.5 / d, { mat: white, z: 1, tone: 0.3 });
    };
    ray(C, C, C - r, C, 0.6);
    ray(C, C, C + r, C, 0.6);
    ray(C, C, C, C - r, 0.6);
    ray(C, C, C, C + r, 0.6);
    if (r > 3) {
      const q = r >> 1;
      for (const [sx, sy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]] as const) c.capsule(C, C, C + sx * q, C + sy * q, 0.4, 0.5 / d, { mat: glow, z: 0.5, tone: 0.3 });
    }
    return { buf: c.render({ outline: 'none', ao: 0, rimLight: 0, clean: false, sep: false }), ox: k, oy: k, density: d };
  });
}

/** A floating music note (the composer's phrase), 2 frames (centre anchor). */
function noteFrames(): Frame[] {
  const rows = [
    ['...k', '..kk', '..k.', '..k.', 'kkk.', 'kkk.'],
    ['..k.', '..kk', '..k.', '..k.', 'kkk.', 'kkk.'],
  ];
  return rows.map((r) => {
    const b = ascii(r, { k: PAL.navy[1] }).padded(1);
    // A white rim keeps the dark note readable on dark backgrounds.
    b.outline(W[2]);
    return { buf: b, ox: b.w >> 1, oy: b.h >> 1 };
  });
}

/** The music note at density d (the same boxes): a glossy navy head and stem with its flag (waving), a white rim. */
function noteFramesHd(d: HdD): Frame[] {
  return [0, 1].map((i) => {
    const c = new HdCanvas(6, 8, d);
    const navy = c.material({ ramp: PAL_HD.navy, lo: 1, hi: 4, spec: 0.9, shine: 22 });
    c.ellipsoid(2.5, 6, 1.5, 1.05, { mat: navy, z: 0 });
    c.capsule(3.6, 6, 3.6, 2, 0.4, 0.4, { mat: navy, z: 0.2 });
    c.capsule(3.6, 2, i ? 4.6 : 4.8, i ? 2.6 : 3.1, 0.45, 0.35, { mat: navy, z: 0.4 });
    c.capsule(i ? 3.6 : 3.8, 1.3, i ? 4.4 : 4.9, i ? 2 : 1.6, 0.4, 0.3, { mat: navy, z: 0.4 });
    fitHd(c, noteFrames()[i].buf);
    return { buf: c.render({ ...HD_RENDER, ink: PAL_HD.snow[5] }), ox: 3, oy: 4, density: d };
  });
}

/** A wisp of tea steam (3 frames, centre anchor). */
function steamFrames(): Frame[] {
  const rows = [['.w', 'w.', '.w', 'w.'], ['w.', '.w', 'w.'], ['.w', 'w.']];
  return rows.map((r) => {
    const b = ascii(r, { w: W[2] });
    return { buf: b, ox: 1, oy: b.h >> 1 };
  });
}

/** Tea steam at density d (the same boxes): a soft S-curving wisp, light at its core, dithered at its edge (no outline). */
function steamFramesHd(d: HdD): Frame[] {
  return steamFrames().map((lo, i) => {
    const h = lo.buf.h;
    const c = new HdCanvas(2, h, d);
    const m = c.material({ ramp: PAL_HD.snow, lo: 2, hi: 6, flat: true, dither: 0.4 });
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= h * 2; k++) {
      const y = k / 2;
      pts.push([1 + Math.sin((y + i) * 1.6) * 0.55, y]);
    }
    c.stroke(pts, 0.45, 0.3, {
      mat: m,
      z: 0,
      tex: (s) => {
        s.tone = 0.25 - Math.abs(s.v) * 0.5;
      },
    });
    return { buf: c.render({ outline: 'none', ao: 0, rimLight: 0, clean: false, sep: false }), ox: 1, oy: h >> 1, density: d };
  });
}

/** The roadie's empty open case (feet anchor). */
function caseOpenFrames(): Frame[] {
  const b = prop('caseOpen');
  return [{ buf: b, ox: b.w >> 1, oy: b.h }];
}

/** The open case at density d. */
function caseOpenFramesHd(d: HdD): Frame[] {
  const lo = prop('caseOpen');
  return [{ buf: propAt('caseOpen', d).buf.clone(), ox: lo.w >> 1, oy: lo.h, density: d }];
}

// ------------------------------------------------------------------------------------ register

/** Strip builders (density 1, 2 or 4) and timings (ticks). */
const STRIPS: ReadonlyArray<readonly [string, (k: HostageKindId, d?: Density) => Frame[], SpriteOpts]> = [
  ['tied', tiedFrames, { ticksPerFrame: 30 }],
  ['caged', cagedFrames, { ticksPerFrame: 30 }],
  ['mast', mastFrames, { ticksPerFrame: 30 }],
  ['sack', sackFrames, { durations: [7, 5, 8, 6] }],
  ['dangle', dangleFrames, { ticksPerFrame: 14 }],
  ['chute', chuteFrames, { ticksPerFrame: 20 }],
  ['freed', freedFrames, { durations: [6, 6, 4, 4], loop: false }],
  ['walk', walkFrames, { ticksPerFrame: 6 }],
  ['gag', gagFrames, { ticksPerFrame: 8 }],
  ['give', giveFrames, { ticksPerFrame: 6, loop: false }],
  ['bow', bowFrames, { durations: [4, 8], loop: false }],
  ['run', runFrames, { ticksPerFrame: 4 }],
];

/**
 * Hostage kinds mission ams frees (its only kind is the tourist): their strips have HD art at 2×
 * AND 4×. Every other kind (and the kind-less critic strips, the cage, mast and balloon binds and
 * the critic / composer / tea-lady effects) has the same HD drawers registered at 2× only: no
 * mission at tier 4 shows them, so the tier-4 working set (`item/` is in ams's preload) does not
 * build them (the 4 → 2 fallback is automatic). Add a kind here to give it 4× art.
 */
export const HD4_KINDS: readonly HostageKindId[] = ['tourist'];
const D2: readonly (2 | 4)[] = [2];
const D24: readonly (2 | 4)[] = [4, 2];

/** Tourist timing overrides (its bow and freed strips have more frames, same total ticks). */
const TOURIST_OPTS: Readonly<Record<string, SpriteOpts>> = {
  bow: { durations: TOURIST_BOW_TIMING, loop: false },
  freed: { durations: TOURIST_FREED_TIMING, loop: false },
};

/** Ticks per turn frame (hostages.ts plays narrowing, flip, widening). */
export const HOSTAGE_TURN_TICKS = 2;

/** Register an id with its 1× generator and one HD generator at `densities`. */
function defineWithHd(id: string, gen: () => Frame[], hd: (d: Density) => Frame[], opts: SpriteOpts, densities: readonly (2 | 4)[]): void {
  defineSprite(id, gen, opts);
  defineHdSprite(id, (d) => hd(d), densities);
}

export function defineHostageSprites(): void {
  for (const kind of HOSTAGE_KINDS) {
    const dens = HD4_KINDS.includes(kind) ? D24 : D2;
    for (const [name, gen, base] of STRIPS) {
      const opts = (kind === 'tourist' && TOURIST_OPTS[name]) || base;
      defineWithHd(`item/hostage/${kind}/${name}`, () => gen(kind), (d) => gen(kind, d), opts, dens);
    }
  }
  // Tourist turn strips (turn-to-run, the blind sack turn); the HD turns squeeze their own frames
  // (a deferred 4× registry read would hand back the 2× frame).
  const T = 'item/hostage/tourist/';
  const stand = (d: Density): Frame => figure('tourist', { ...P.STAND, armN: { sh: 10, el: 30, hand: 'fist' }, armF: { sh: -6, el: 30 }, expr: 'happy' }, d);
  defineWithHd(T + 'turn', () => turnSquash(stand(1)), (d) => turnSquash(stand(d)), { ticksPerFrame: HOSTAGE_TURN_TICKS }, D24);
  defineWithHd(T + 'sack-turn', () => turnSquash(getFrames(T + 'sack', 1)[0]), (d) => turnSquash(sackFrames('tourist', d)[0]), { ticksPerFrame: HOSTAGE_TURN_TICKS }, D24);
  defineWithHd('item/hostage/roadie/carry', () => carryFrames('roadie'), (d) => carryFrames('roadie', d), { ticksPerFrame: 7 }, D2);
  // The kind-less strips are the critic's (the default kind).
  for (const [name, gen, opts] of STRIPS) defineWithHd(`item/hostage/${name}`, () => [...getFrames(`item/hostage/critic/${name}`)], (d) => gen('critic', d), opts, D2);
  defineWithHd('item/hostage/star', starFrames, (d) => starFramesHd(hdOf(d)), { anchor: 'center' }, D2);
  defineWithHd('item/hostage/flash', flashFrames, (d) => flashFramesHd(hdOf(d)), { durations: [2, 3, 3], loop: false }, D24);
  defineWithHd('item/hostage/note', noteFrames, (d) => noteFramesHd(hdOf(d)), { ticksPerFrame: 10 }, D2);
  defineWithHd('item/hostage/steam', steamFrames, (d) => steamFramesHd(hdOf(d)), { ticksPerFrame: 8 }, D2);
  defineWithHd('item/hostage/case-open', caseOpenFrames, (d) => caseOpenFramesHd(hdOf(d)), { ticksPerFrame: 60 }, D2);
}
