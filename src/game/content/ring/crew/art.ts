/**
 * Sprites of content area `ring/crew` (docs/design/ring.md §5.5, §7.2; docs/ART_GUIDE.md "UHD
 * art"). ONE density-generic drawer per strip (art-truck.ts, art-people.ts): `PAL` at 1×, `PAL_HD`
 * at 2× and 4×, outline A (everything here moves or can be hit). Geometry is law: each frame is
 * cropped to its 1× frame's opaque box plus a 1 px margin, the same logical rectangle at every
 * density (anchor and points included).
 *
 * - `ring/roadworks/truck` (5) and `ring/roadworks/side` (3): the road-works truck (art-truck.ts).
 *   The arrow trailer and its board, the laid and the thrown cones are the wave-A closure's sprites
 *   (`ring/hazard/arrow-trailer`, `arrow-board`, `cone`).
 * - `ring/roadworks/worker/<0|1|2>/`: idle (2), tell (3), throw (3), gloat (3, deferred: the coffee
 *   break), cower (2, deferred), tumble (4), sit (2).
 * - `ring/boarder/<set>/` for the sets of `BOARDER_SETS` (handhaver, handhaver-b, handhaver-c,
 *   stag-partier, stag-partier-1 … 3): idle (2), run (8), crouch (2), hop (2), perch (2), tell-hit (2),
 *   hit (2), tumble (4), sit (2). Their gloat and cower are the ams sets' own strips.
 */
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import type { Dn } from '../../stag/kit.art';
import {
  boarderCrouch,
  boarderHit,
  boarderHop,
  boarderIdle,
  boarderPerch,
  boarderRun,
  boarderSit,
  boarderTellHit,
  boarderTumble,
  sitFigure,
  tumbleFigure,
  workerCower,
  workerGloat,
  workerIdle,
  workerTell,
  workerThrow,
} from './art-people';
import { sideFrame, truckFrame } from './art-truck';
import { BOARDER_SETS, boarderArt, TRUCK_ID, WORKER_LOOKS, workerArt } from './geometry';

type Gen = (d: Dn) => Frame[];

/** The crop box of a 1× frame (its opaque box grown by 1 px, inside the frame). */
function boxOf(f1: Frame): { x: number; y: number; w: number; h: number } {
  const t = f1.buf.trimBounds();
  if (!t) return { x: 0, y: 0, w: f1.buf.w, h: f1.buf.h };
  const x = Math.max(0, t.x - 1);
  const y = Math.max(0, t.y - 1);
  return { x, y, w: Math.min(f1.buf.w, t.x + t.w + 1) - x, h: Math.min(f1.buf.h, t.y + t.h + 1) - y };
}

/**
 * Frame `f` (density d) cut to the logical box `box` of its 1× frame `f1` (the same logical
 * rectangle, anchor and points at every density; an HD frame whose anchor sits elsewhere in its own
 * buffer is placed by the anchors).
 */
function boxed(f: Frame, f1: Frame, box: { x: number; y: number; w: number; h: number }, d: Dn): Frame {
  const sx = (f.ox - f1.ox + box.x) * d;
  const sy = (f.oy - f1.oy + box.y) * d;
  const buf = f.buf.crop(sx, sy, box.w * d, box.h * d);
  const ox = f1.ox - box.x;
  const oy = f1.oy - box.y;
  const pts = f1.pts;
  return d === 1 ? { buf, ox, oy, ...(pts ? { pts } : {}) } : { buf, ox, oy, density: d, ...(pts ? { pts } : {}) };
}

/** A strip at density d, each frame cut to its 1× box (see `boxed`). */
export function cropped(gen: Gen, d: Dn): Frame[] {
  const lo = gen(1);
  const fs = d === 1 ? lo : gen(d);
  return fs.map((f, i) => boxed(f, lo[i], boxOf(lo[i]), d));
}

const def = (id: string, gen: Gen, o: { ticksPerFrame?: number; durations?: readonly number[]; loop?: boolean; defer?: boolean } = {}): void =>
  defineSprite(id, () => cropped(gen, 1), { ...o, hd: (d) => cropped(gen, d as Dn) });

/** Strip timings (ticks per frame). */
export const CREW_TPF = { truck: 12, idle: 20, tell: 8, throw: 4, gloat: 24, cower: 3, tumble: 4, sit: 30, run: 4, crouch: 8, hop: 8, perch: 18, tellHit: 9, hit: 5 } as const;

// The truck.
def(TRUCK_ID.truck, (d) => [truckFrame(0, 0, d), truckFrame(1, 0, d), truckFrame(0, 1, d), truckFrame(1, 1, d), truckFrame(0, 2, d)], { ticksPerFrame: CREW_TPF.truck });
def(TRUCK_ID.side, (d) => [sideFrame(0, d), sideFrame(1, d), sideFrame(2, d)]);

// The road workers.
WORKER_LOOKS.forEach((s, k) => {
  const pre = `${workerArt(k)}/`;
  def(pre + 'idle', (d) => workerIdle(s, d), { ticksPerFrame: CREW_TPF.idle });
  def(pre + 'tell', (d) => workerTell(s, d), { ticksPerFrame: CREW_TPF.tell, loop: false });
  def(pre + 'throw', (d) => workerThrow(s, d), { durations: [3, 6, 10], loop: false });
  def(pre + 'gloat', (d) => workerGloat(s, d), { durations: [30, 40, 30], defer: true });
  def(pre + 'cower', (d) => workerCower(s, d), { ticksPerFrame: CREW_TPF.cower, defer: true });
  def(pre + 'tumble', (d) => tumbleFigure(s, d), { ticksPerFrame: CREW_TPF.tumble });
  def(pre + 'sit', (d) => sitFigure(s, d), { ticksPerFrame: CREW_TPF.sit });
});

// The jam boarders.
BOARDER_SETS.forEach((_, i) => {
  const pre = `${boarderArt(i)}/`;
  def(pre + 'idle', (d) => boarderIdle(i, d), { ticksPerFrame: CREW_TPF.idle });
  def(pre + 'run', (d) => boarderRun(i, d), { ticksPerFrame: CREW_TPF.run });
  def(pre + 'crouch', (d) => boarderCrouch(i, d), { ticksPerFrame: CREW_TPF.crouch, loop: false });
  def(pre + 'hop', (d) => boarderHop(i, d), { ticksPerFrame: CREW_TPF.hop, loop: false });
  def(pre + 'perch', (d) => boarderPerch(i, d), { ticksPerFrame: CREW_TPF.perch });
  def(pre + 'tell-hit', (d) => boarderTellHit(i, d), { ticksPerFrame: CREW_TPF.tellHit, loop: false });
  def(pre + 'hit', (d) => boarderHit(i, d), { ticksPerFrame: CREW_TPF.hit, loop: false });
  def(pre + 'tumble', (d) => boarderTumble(i, d), { ticksPerFrame: CREW_TPF.tumble });
  def(pre + 'sit', (d) => boarderSit(i, d), { ticksPerFrame: CREW_TPF.sit });
});
