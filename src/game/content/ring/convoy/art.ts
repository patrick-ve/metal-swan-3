/**
 * Sprites of content area `ring/convoy` — the enforcement convoy (docs/design/ring.md §5.3, §9;
 * docs/ART_GUIDE.md "UHD art"). Every id has its 1× frames (the 64-colour palette) and 2× / 4×
 * frames from ONE density-generic drawer with the 1× geometry (size, anchor, points):
 *
 * - `ring/scan-car/{body-0..2, cabin, wheel, text, blink}`: the ams scan car's own drawers
 *   (art-car.ts); `ring/scan-car/box` the smaller ring roof box (new).
 * - `ring/tow-truck/{body, hook, wheel, blink}`: the ams tow truck's drawers; `cower` (deferred):
 *   the driver ducking below the window sill (art-car.ts `towCower`).
 * - `ring/handhaver-moto/*`: the handhaver on his motorbike (art-moto.ts), the fine sticker and
 *   its HUD icon. `gloat` / `cower` are deferred (the continue only).
 */
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import type { Dn } from '../../stag/kit.art';
import { boxBrokenFrame, boxFrame, scanBlink, scanBody, scanCabin, scanText, scanWheel, towBody, towCower, towHook } from './art-car';
import {
  batonFrames,
  cowerFrames,
  downFrames,
  fineFrames,
  gloatFrames,
  iconFrames,
  MOTO_GLOAT_TIMING,
  MOTO_TPF,
  rideFrames,
  sitFrames,
  stickerFrames,
  tellBatonFrames,
  tellStickerFrames,
  tumbleFrames,
  wobbleFrames,
} from './art-moto';
import { MOTO_ID, SCAN_CAR_ID, TOW_TRUCK_ID } from './geometry';

type Gen = (d: Dn) => Frame[];

/** Register a strip from one density-generic generator. */
const def = (id: string, gen: Gen, o: { ticksPerFrame?: number; durations?: readonly number[]; loop?: boolean; defer?: boolean; anchor?: 'center' } = {}): void =>
  defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d as Dn) });

// ---------------------------------------------------------------------------------------------
// The scan car
// ---------------------------------------------------------------------------------------------

const S3 = [0, 1, 2] as const;
const F4 = [0, 1, 2, 3] as const;
for (const s of S3) def(SCAN_CAR_ID.body[s], (d) => [scanBody(s, d)]);
def(SCAN_CAR_ID.cabin, (d) => [0, 1, 2, 3, 4].map((f) => scanCabin(f, d)));
def(SCAN_CAR_ID.wheel, (d) => F4.map((f) => scanWheel(f, d)));
def(SCAN_CAR_ID.text, (d) => [scanText(0, d), scanText(1, d)]);
def(SCAN_CAR_ID.blink, (d) => [scanBlink(d)]);
def(SCAN_CAR_ID.box, (d) => [...S3.map((f) => boxFrame(f, d)), boxBrokenFrame(3, d), boxBrokenFrame(4, d)]);

// ---------------------------------------------------------------------------------------------
// The tow truck
// ---------------------------------------------------------------------------------------------

def(TOW_TRUCK_ID.body, (d) => [towBody(false, d), towBody(true, d)]);
def(TOW_TRUCK_ID.hook, (d) => [towHook(d)]);
def(TOW_TRUCK_ID.wheel, (d) => F4.map((f) => scanWheel(f, d)));
def(TOW_TRUCK_ID.blink, (d) => [scanBlink(d)]);
// The cower (the continue only): 0–2 over the clean body, 3–5 over the damaged one.
def(TOW_TRUCK_ID.cower, (d) => [0, 1, 2, 3, 4, 5].map((f) => towCower(f % 3, f >= 3, d)), { ticksPerFrame: 6, defer: true });

// ---------------------------------------------------------------------------------------------
// The handhaver motorbike (cropped to each 1× frame's opaque box + 1 px, the same logical
// rectangle at every density: the fixed canvas is mostly air)
// ---------------------------------------------------------------------------------------------

/** A frame cropped to `box` (logical px) at density d. */
function boxed(f: Frame, box: { x: number; y: number; w: number; h: number }, d: Dn): Frame {
  const buf = f.buf.crop(box.x * d, box.y * d, box.w * d, box.h * d);
  const ox = f.ox - box.x;
  const oy = f.oy - box.y;
  const pts = f.pts;
  return d === 1 ? { buf, ox, oy, ...(pts ? { pts } : {}) } : { buf, ox, oy, density: d, ...(pts ? { pts } : {}) };
}

/** The crop box of a 1× frame (its opaque box grown by 1 px, inside the frame). */
function boxOf(f1: Frame): { x: number; y: number; w: number; h: number } {
  const t = f1.buf.trimBounds();
  if (!t) return { x: 0, y: 0, w: f1.buf.w, h: f1.buf.h };
  const x = Math.max(0, t.x - 1);
  const y = Math.max(0, t.y - 1);
  return { x, y, w: Math.min(f1.buf.w, t.x + t.w + 1) - x, h: Math.min(f1.buf.h, t.y + t.h + 1) - y };
}

/** A strip at density d, each frame cropped to its 1× box. */
function cropped(gen: Gen, d: Dn): Frame[] {
  const lo = gen(1);
  const fs = d === 1 ? lo : gen(d);
  return fs.map((f, i) => boxed(f, boxOf(lo[i]), d));
}

const defCropped = (id: string, gen: Gen, o: { ticksPerFrame?: number; durations?: readonly number[]; loop?: boolean; defer?: boolean } = {}): void =>
  defineSprite(id, () => cropped(gen, 1), { ...o, hd: (d) => cropped(gen, d as Dn) });

defCropped(MOTO_ID.ride, rideFrames, { ticksPerFrame: MOTO_TPF.ride });
defCropped(MOTO_ID.tellBaton, tellBatonFrames, { ticksPerFrame: MOTO_TPF.tell, loop: false });
defCropped(MOTO_ID.baton, batonFrames, { ticksPerFrame: MOTO_TPF.strike, loop: false });
defCropped(MOTO_ID.tellSticker, tellStickerFrames, { ticksPerFrame: MOTO_TPF.tell, loop: false });
defCropped(MOTO_ID.sticker, stickerFrames, { ticksPerFrame: MOTO_TPF.strike, loop: false });
defCropped(MOTO_ID.wobble, wobbleFrames, { ticksPerFrame: MOTO_TPF.wobble });
defCropped(MOTO_ID.gloat, gloatFrames, { durations: MOTO_GLOAT_TIMING, loop: false, defer: true });
defCropped(MOTO_ID.cower, cowerFrames, { ticksPerFrame: MOTO_TPF.cower, defer: true });
defCropped(MOTO_ID.down, downFrames, { ticksPerFrame: MOTO_TPF.down, loop: false });
defCropped(MOTO_ID.tumble, tumbleFrames, { ticksPerFrame: 4 });
defCropped(MOTO_ID.sit, sitFrames, { ticksPerFrame: 30 });
def(MOTO_ID.fine, fineFrames, { ticksPerFrame: 6 });
def(MOTO_ID.icon, iconFrames);

/** Every convoy sprite id (tests, the art list). */
export const CONVOY_ART_IDS: readonly string[] = [
  ...SCAN_CAR_ID.body,
  SCAN_CAR_ID.cabin,
  SCAN_CAR_ID.wheel,
  SCAN_CAR_ID.text,
  SCAN_CAR_ID.blink,
  SCAN_CAR_ID.box,
  TOW_TRUCK_ID.body,
  TOW_TRUCK_ID.hook,
  TOW_TRUCK_ID.wheel,
  TOW_TRUCK_ID.blink,
  TOW_TRUCK_ID.cower,
  ...Object.values(MOTO_ID),
];
