/**
 * Art of the people and the life of Amsterdam (mission `ams`, docs/design/amsterdam.md §1, §5).
 * All drawn by code, 64-colour palette, 1-px ink outline, light from the top-left.
 *
 * NPC strips (feet anchor, humans 35–37 px, facing right):
 * - `npc/ams/ams-baker/<anim>`          idle talk toss walk clap cheer wave in-<mode> turn: the baked 40 px
 *   set (docs/design/ams40.md wave 5; tools/art40/chars/ams-baker/, `npc/ams/ams-baker` below)
 * - `npc/ams/ams-hotdog-vendor/<anim>`  idle salute talk wave in-talk in-wave turn: the baked 40 px set
 *   (docs/design/ams40.md wave 5; tools/art40/chars/ams-hotdog-vendor/, `npc/ams/ams-hotdog-vendor` below)
 * - `npc/ams/ams-staff/<look>/<anim>`   look 0–2; baked 40 px sets (staff.art.ts)
 *   Motion (docs/ART_GUIDE.md "Motion"): idle 4 (breathing), clap 4 and wave 4 (tweened loops);
 *   per person a `turn` (2, turnSquash of the idle frame) and `in-<mode>` (2: in-betweens from the
 *   idle frame to the mode's first frame) for the modes of `TRANSITION_MODES`; entities.ts plays
 *   them forward into the mode and backward out of it (draw only).
 * - `npc/ams/counter`                   a small Fabel Friet counter drawn in front of an NPC
 *
 * Ambient life: `npc/ams/ams-tour-boat` (2, wake), `npc/ams/ams-cyclist-bg/<look>` (4, pedalling;
 * look 0–3), `npc/ams/ams-pigeons` (5: stand, peck, step, wings up, wings down),
 * `npc/ams/ams-ducks` (4: drake bob up / down, hen bob up / down),
 * `npc/ams/ams-window-waver/<strip>` (person, lean, cat-swish, cat): the baked 40 px set (below).
 * Decor: `decor/ams/ams-boat-platform` (2, wake), breakables `decor/ams/<id>` (0 intact,
 * 1 broken) for ams-herring-cart, ams-tulip-stall, ams-market-stall, ams-bike-rack.
 *
 * UHD art (docs/ART_GUIDE.md "UHD art"): every id here except the breakables and the boat platform
 * (their dense art lives with the city decor) has ONE density-generic generator for 2× and 4×
 * (`hd: (d) => …`), except the baked 40 px people (1× at every tier): the rig at d (renderHuman),
 * the counter and omafiets painted natively with the UHD kit (HdCanvas, PAL_HD, outline
 * A, rim light; `…Hd` below), each fitted into its 1× footprint. The ambient pigeons, ducks and tour boat have their
 * HD art in npc-hi.art.ts.
 */
import { defineBakedSet } from '../../../../engine/baked';
import type { Color } from '../../../../engine/color';
import { drawText } from '../../../../engine/font';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD, hdHome } from '../../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { BLACK_ONE_HUE, HdCanvas, type DrawOpts, type HdMaterial, type RenderOpts, type Texture } from '../../../art/hd';
import { spanOf } from '../../../art/hd/body';
import { renderHuman, stackFrames, type Density, type HumanStyle, type LegPose, type Pose } from '../../../art/humanoid';
import { SET as VENDOR } from '../../art40/ams-hotdog-vendor.gen';
import { SET as BAKER } from '../../art40/ams-baker.gen';
import { SET as WINDOW } from '../../art40/ams-window-waver.gen';

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });

// ------------------------------------------------------------------------------------ styles

/** The Fabel Friet crew, `look` 0–2: baked 40 px sets (staff.art.ts registers them). */
export { STAFF_LOOKS } from './staff.art';

// ------------------------------------------------------------------------------------ poses

/**
 * The baker's toss (npc/ams/ams-baker/toss, the baked 40 px set): the frame on which the item
 * leaves the scoop (the `hand` point of that frame), exported by the bake (plan rule 4).
 */
export { TOSS_RELEASE } from '../../art40/ams-baker.gen';

/** Modes with a 2-frame `in-<mode>` transition strip (from the idle frame; played backward to leave). */
export const TRANSITION_MODES: readonly string[] = ['talk', 'clap', 'cheer', 'wave'];
/** Ticks per frame of the `in-<mode>` and `turn` strips. */
export const PERSON_TR_TICKS = 3;
export const PERSON_TURN_TICKS = 2;
/** Walk speed (px/tick) the person walk strips are drawn for (entities.ts: the Animator rate is strideRate(speed, this)). */
export const PERSON_WALK_SPEED = 0.8;

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

/**
 * The FABEL FRIET baker: the baked 40 px set (tools/art40/chars/ams-baker/; one 1× picture at every
 * art tier, plan rule 7): idle 4, talk 8, walk 12 (4 ticks a frame: 38.4 px a cycle at 0.8 px/tick),
 * toss 6 (28 ticks; the prize leaves the scoop on TOSS_RELEASE), clap 6, cheer 6, wave 6, in-<mode> 2,
 * turn 2.
 */
defineBakedSet(BAKER);

/** The hot-dog vendor: the baked 40 px set (one 1× picture at every art tier, plan rule 7). */
defineBakedSet(VENDOR);

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
  const rubber = c.material({ ramp: BLACK_ONE_HUE, lo: 0, hi: 3, spec: 0.3, shine: 12 });
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
    const rubber = c.material({ ramp: BLACK_ONE_HUE, lo: 0, hi: 3, spec: 0.3, shine: 12 });
    const steel = steelMat(c);
    const leather = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 5, spec: 0.5, shine: 18 });
    const wicker = c.material({ ramp: PAL_HD.wood, lo: 2, hi: 6, spec: 0.1 });
    const grip = c.material({ ramp: BLACK_ONE_HUE, lo: 1, hi: 4, spec: 0.4, shine: 14 });
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

/**
 * The canal-house window with the waver or the cat: the baked 40 px set (docs/design/ams40.md wave 5;
 * tools/art40/chars/ams-window-waver/): `person` (the frame roles WAVER_* that ambient.ts picks),
 * `lean`, `cat-swish`, `cat`. One 1× picture at every art tier, every frame inside the entity's
 * 20 × 26 window box above the sill (plan rule 10).
 */
defineBakedSet(WINDOW);

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
