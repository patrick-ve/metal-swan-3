/**
 * THE ZWAAN KIT (art) — shared by the art of all five parts of the ZWAAN train (docs/design/ring.md
 * §R.3; docs/ART_GUIDE.md "UHD art"; docs/api/ring.md "ZWAAN train: controller, container, cab").
 * Owner: TRAIN-1; TRAIN-2 builds its parts' art on it.
 *
 * - The pen and the strips: `Pen` (an `HdCanvas` in local coordinates), `defStrip(id, gen, o)` (1×
 *   now, 2× / 4× from the SAME density-generic drawer, every frame cropped to its 1× box: geometry
 *   is law), the point transform `turnPt` / `Turn` (tipping frames), `roll`, `frac`, `hash2`,
 *   `lineW`.
 * - The materials: `zwaanMats(c)` (white, orange, red, black, plastic, glass, chrome, steel, the
 *   lamps, rust, rustIn, wood, tyre, plate).
 * - THE LIVERY (our own; no real hauler's colours, names or badges): a white cab with an orange band
 *   and a thin red line; the rust-red ZWAAN colour (`zwaanMats(c).rust`) along every trailer; the
 *   name `ZWAAN` in our own wide block letters (`wideHit`, `wideWidth`); the SWAN MARK (`swanHit`,
 *   `swanMark`: a swan with an S-neck swimming to the right — trailers face right, never mirror);
 *   made-up plates (`ZWAAN_PLATES`) and box codes (`ZWAAN_BOX_CODES`); our own small glyphs
 *   (`glyphHit` / `glyphHitC`, traffic/lettering.ts).
 * - Damage: `holes` (dents and bullet holes), `soot`.
 * - THE KIT SPRITES (all under `boss/ring-zwaan/kit/`, logic ids in kit.ts `KIT_SPR`; add the prefix
 *   to your part's `defineRingArt`): `drawbar` (2: coupled, loose), `hitch` (the towing jaw),
 *   `dolly` (the converter dolly's frame), `rim` (4: a blown tyre on its rim).
 */
import type { Frame } from '../../../../engine/render';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { defStrip, frac, Pen } from '../boss/art-kit';
import { lorryMats, rimFrame, type LorryMats } from '../boss/art-lorry';
import { KIT_SPR, ZWAAN_KIT } from './kit';

export { defStrip, frac, frameOf, hash2, lineW, Pen, roll, swanHit, swanMark, turnPt, type Turn } from '../boss/art-kit';
export { BOX_CODE, holes, LINE_NAME, PLATE, soot, WIDE, wideHit, wideWidth } from '../boss/art-lorry';
export { glyphHit, glyphHitC } from '../traffic/lettering';
export { bot, finishA, mat, top, type Dn };

/** The train's materials (the old lorry's set). */
export type ZwaanMats = LorryMats;
export const zwaanMats = lorryMats;

/** Made-up plates (never a real plate format's letters in order; no country band). */
export const ZWAAN_PLATES: readonly string[] = ['ZW-99', 'OZ-31-ZW', 'ZW-12-AA', 'ZW-40-VT', 'ZW-77-JX'];
/** Made-up box / tank codes along the trailers (ZWA_: never a real owner code). */
export const ZWAAN_BOX_CODES: readonly string[] = ['ZWAU 619072', 'ZWAA 300415', 'ZWAT 771120', 'ZWAV 052288'];

const HY = ZWAAN_KIT.hitchY;

// ---------------------------------------------------------------------------------------------
// The drawbar (anchor: the part's FRONT on the road)
// ---------------------------------------------------------------------------------------------

/** The air lines (red, yellow) hanging along the drawbar from `a` to `b` with a sag. */
function airLines(p: Pen, m: LorryMats, ax: number, ay: number, bx: number, by: number, sag: number): void {
  const d = p.d;
  const yellow = mat(p.c, 'gold', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const w = d === 1 ? 0.5 : 0.36;
  for (const [dy, mt] of [[0, m.red], [0.9, yellow]] as const) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([ax + (bx - ax) * t, ay + (by - ay) * t + Math.sin(t * Math.PI) * sag + dy]);
    }
    p.stroke(pts, w, w, { mat: mt, z: 2.2 });
  }
}

/**
 * The drawbar: 0 coupled — a level steel bar from its pivot on the dolly (`drawbarBack` behind the
 * front) through the coupling gap to its eye in the jaw of the part ahead; 1 loose — dropped, its eye
 * scraping on the road, the air lines torn and dangling.
 */
function drawbarFrame(f: number, d: Dn): Frame {
  const back = ZWAAN_KIT.drawbarBack;
  const eye = 10 + ZWAAN_KIT.drawbarEye;
  const p = new Pen(-back - 2, HY - 6, back + eye + 6, -HY + 8, d);
  const c = p.c;
  const m = zwaanMats(c);
  const ax = -back;
  const ay = HY + 0.5;
  const bx = f === 0 ? eye - 1.5 : eye - 4;
  const by = f === 0 ? HY : -1.6;
  // The bar: a steel tube (the A-frame's near leg) with a reinforcing gusset near the pivot.
  p.capsule(ax, ay, bx, by, 1.15, 1, { mat: m.steel, z: 1.2 });
  p.capsule(ax, ay - 0.2, ax + 6, ay + (by - ay) * (6 / Math.max(1, bx - ax)) - 0.2, 1.6, 1.1, { mat: m.black, z: 1.25 });
  // The eye: a forged ring at the tip, the pivot's pin.
  p.ellipsoid(bx, by, 1.9, 1.9, { mat: m.chrome, z: 1.4, round: 0.6 });
  p.ellipsoid(bx, by, 0.75, 0.75, { mat: m.well, z: 1.5, round: 0.2 });
  p.ellipsoid(ax, ay, 1.5, 1.5, { mat: m.black, z: 1.35, round: 0.5 });
  if (f === 0) {
    // The air lines and the cable to the jaw ahead, sagging under the bar.
    airLines(p, m, ax + 2, ay + 1.2, bx - 1, by + 1.4, 2.4);
  } else {
    // Torn lines dangle from the pivot; sparks are the logic's (kit `uncoupleFx`).
    airLines(p, m, ax + 2, ay + 1.2, ax + 9, ay + 6.5, 1.2);
    // A bright scrape mark on the eye.
    const hot = top('gold', d, d === 1 ? 0 : 1);
    p.paint(bx - 1.5, by + 0.5, 3, 1.5, (x, y) => (y > by + 0.9 && Math.abs(x - bx) < 1.2 ? hot : 0), 4);
  }
  return p.frame(finishA(c, 0.3));
}

// ---------------------------------------------------------------------------------------------
// The towing jaw (anchor: the part's REAR on the road)
// ---------------------------------------------------------------------------------------------

function hitchFrame(d: Dn): Frame {
  const p = new Pen(-6, HY - 7, 12, 12, d);
  const c = p.c;
  const m = zwaanMats(c);
  // The mounting plate on the rear cross member, the jaw (a funnel open to the rear), its pin.
  p.box(-1, HY - 3.5, 4.2, 7, { mat: m.black, z: 1, r: 0.5, bevel: 0.5 });
  p.box(-4.6, HY - 2.2, 4.4, 4.4, { mat: m.steel, z: 1.3, r: 0.8, bevel: 0.6 });
  p.box(-5, HY - 1.1, 2.4, 2.2, { mat: m.well, z: 1.4, r: 0.4 });
  p.capsule(-2.6, HY - 4.6, -2.6, HY - 2, 0.6, 0.6, { mat: m.chrome, z: 1.5 });
  // The red and yellow couplings' heads on the plate.
  const yellow = mat(c, 'gold', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  p.box(1.2, HY + 1.6, 1.4, 1.2, { mat: m.red, z: 1.6, r: 0.3 });
  p.box(1.2, HY - 2.8, 1.4, 1.2, { mat: yellow, z: 1.6, r: 0.3 });
  return p.frame(finishA(c, 0.3));
}

// ---------------------------------------------------------------------------------------------
// The converter dolly (anchor: its middle on the road; the wheels are the kit's wheel strip)
// ---------------------------------------------------------------------------------------------

function dollyFrame(d: Dn): Frame {
  const p = new Pen(-17, -25, 34, 26, d);
  const c = p.c;
  const m = zwaanMats(c);
  const [a0, a1] = ZWAAN_KIT.dollyAxles;
  const R = ZWAAN_KIT.wheelR;
  // The frame: a deep black beam over both axles, the turntable ring, the fifth-wheel plate with
  // its grease and the jaw slot.
  p.box(-15, -18.6, 30, 4.4, { mat: m.black, z: 0.6, r: 0.5, bevel: 0.6 });
  p.box(-9, -20.6, 18, 2, { mat: m.steel, z: 0.7, r: 0.4, bevel: 0.4, tone: -0.2 });
  p.box(-10, -23.4, 20, 2.8, {
    mat: m.steel,
    z: 0.9,
    r: 0.6,
    bevel: 0.6,
    tex: (t) => {
      // Black grease smeared over the plate's middle.
      const x = t.x + p.x0;
      if (Math.abs(x) < 6 && frac(x * 0.7 + 0.2) < 0.55) t.tone -= 0.7;
    },
  });
  p.box(-1.2, -23.4, 2.4, 1.2, { mat: m.well, z: 1, r: 0.2 });
  // Mudguards: black quarter arcs over both wheels, a rubber flap behind the rear one.
  // One tandem guard: down over the rear wheel's back, flat over both tops, down over the front.
  const guard: [number, number][] = [];
  for (let a = 195; a <= 270; a += 15) guard.push([a0 + Math.cos((a * Math.PI) / 180) * (R + 1.7), -R + Math.sin((a * Math.PI) / 180) * (R + 1.7)]);
  for (let a = 270; a <= 345; a += 15) guard.push([a1 + Math.cos((a * Math.PI) / 180) * (R + 1.7), -R + Math.sin((a * Math.PI) / 180) * (R + 1.7)]);
  p.stroke(guard, 0.95, 0.95, { mat: m.black, z: 1.2 });
  p.box(a0 - R - 2.6, -10.5, 1.6, 9, { mat: m.plastic, z: 1.1, r: 0.3 });
  // A small amber side marker on the beam, a reflector at its rear end.
  p.box(-1, -17.6, 2, 1.2, { mat: m.amber, z: 1.3, r: 0.3, bevel: 0.3 });
  p.box(-14.6, -17.8, 1.4, 1.6, { mat: m.tail, z: 1.3, r: 0.3 });
  return p.frame(finishA(c, 0.3));
}

defStrip(KIT_SPR.drawbar, (d) => [drawbarFrame(0, d), drawbarFrame(1, d)]);
defStrip(KIT_SPR.hitch, (d) => [hitchFrame(d)]);
defStrip(KIT_SPR.dolly, (d) => [dollyFrame(d)]);
defStrip(KIT_SPR.rim, (d) => [0, 1, 2, 3].map((f) => rimFrame(f, d)), { ticksPerFrame: 3 });
