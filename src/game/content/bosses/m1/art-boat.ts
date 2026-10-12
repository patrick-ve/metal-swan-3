/**
 * THE ENCORE — the riverboat's pixel art (GDD §10.1, §15.6). Procedural, palette only, lit from
 * the top-left, drawn FACING RIGHT (bow right); the boss flips the strips in phase 1.
 *
 * - `boss/encore/hull-0|1|2`    hull, cabin, bridge, trumpet-bell funnels, wheel arms (anchor =
 *                                the bow tip on the waterline; the bridge window is a hole)
 * - `boss/encore/bridge-back`   the dark bridge interior behind Blare (same anchor as the hull)
 * - `boss/encore/horn-0|1|2`    the bow foghorn on its swivel (anchor = the pivot): frames level,
 *                                tilted down, tilted up; `horn-2` adds frame 3 = the broken stump
 * - `boss/encore/calliope-0|1|2` the 6-pipe steam calliope (anchor = the base centre on the deck):
 *                                frames idle, playing; `calliope-2` adds frame 2 = the stump
 * - `boss/encore/wheel-0|1|2`   the red paddle wheel (centre anchor): 4 turning frames;
 *                                `wheel-2` adds frame 4 = the bare hub
 * - `boss/encore/wheel-blur`    the spinning wheel (Paddle Wave telegraph), 2 frames
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Color } from '../../../../engine/color';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { damage, rivet } from '../../../art/machines';
import { ENC } from './geometry';

const { OX, OY, W, H } = ENC;
const X = (lx: number): number => OX + lx;
const Y = (ly: number): number => OY + ly;

// ------------------------------------------------------------------------------------- hull

/** A trumpet-bell funnel: pipe from the roof up, a flaring gold bell, the dark mouth on top. */
function funnel(b: PixelBuffer, cx: number, top: number, roof: number): void {
  const g = PAL.gold;
  const bellH = 20;
  for (let y = top; y <= roof; y++) {
    const t = y < top + bellH ? 1 - (y - top) / bellH : 0;
    const half = Math.round(4 + 10 * Math.pow(t, 2.2));
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - (cx - half)) / Math.max(1, 2 * half);
      b.set(x, y, u < 0.22 ? g[3] : u > 0.82 ? g[0] : u > 0.62 ? g[1] : g[2]);
    }
  }
  // Rim and the mouth seen from slightly above.
  b.hline(cx - 14, cx + 14, top, g[3]);
  b.hline(cx - 13, cx + 13, top + 1, g[1]);
  b.ellipse(cx - 11, top - 2, 23, 4, PAL.ink[1]);
  b.hline(cx - 9, cx + 9, top - 1, PAL.brown[0]);
  // A red band where the pipe leaves the roof and a gold ring half-way.
  b.rect(cx - 5, roof - 6, 11, 4, PAL.red[2]);
  b.hline(cx - 5, cx + 5, roof - 6, PAL.red[3]);
  b.hline(cx - 5, cx + 5, roof - 3, PAL.red[0]);
  const ring = top + bellH + Math.round((roof - top - bellH) / 2);
  b.hline(cx - 5, cx + 5, ring, g[3]);
  b.hline(cx - 5, cx + 5, ring + 1, g[0]);
}

/** Windows with an arched top (navy glass, a sky glint). */
function arched(b: PixelBuffer, x: number, y: number, w: number, h: number): void {
  b.rect(x, y + 2, w, h - 2, PAL.navy[1]);
  b.hline(x + 1, x + w - 2, y + 1, PAL.navy[1]);
  b.hline(x + 2, x + w - 3, y, PAL.navy[1]);
  b.set(x + 1, y + 3, PAL.sky[2]);
  b.set(x + 1, y + 4, PAL.sky[1]);
  b.hline(x, x + w - 1, y + h, PAL.gold[1]);
}

/** The whole boat body (facing right). `state` 0 clean, 1 dented and holed, 2 scorched. */
function hullFrame(state: number): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const red = PAL.red;
  const g = PAL.gold;
  const cl = PAL.cloth;
  // Wheel arms (pitmans) from the stern to the hub, behind everything else.
  const [hx, hy] = ENC.wheel.c;
  b.thickLine(X(-224), Y(-44), X(hx), Y(hy), 4, PAL.brown[1]);
  b.thickLine(X(-224), Y(-12), X(hx), Y(hy), 4, PAL.brown[1]);
  b.line(X(-224), Y(-45), X(hx), Y(hy - 1), PAL.brown[2]);
  b.thickLine(X(-218), Y(-56), X(hx - 8), Y(-62), 3, PAL.steel[1]);
  b.thickLine(X(hx - 8), Y(-62), X(hx), Y(hy), 3, PAL.steel[1]);
  // Hull: raked bow, rounded stern.
  const pts: Array<[number, number]> = [
    [X(-230), Y(-52)],
    [X(0), Y(-52)],
    [X(-6), Y(-34)],
    [X(-14), Y(-14)],
    [X(-26), Y(4)],
    [X(-218), Y(4)],
    [X(-226), Y(-8)],
    [X(-230), Y(-30)],
  ];
  b.poly(pts, red[2]);
  // Trim, stripes and boot-top (only on hull pixels).
  for (let y = Y(-52); y <= Y(4); y++) {
    for (let x = X(-231); x <= X(1); x++) {
      if (b.get(x, y) !== red[2]) continue;
      const ly = y - OY;
      const lx = x - OX;
      let c: Color = red[2];
      if (ly <= -50) c = ly === -52 ? g[3] : g[2];
      else if (ly === -49) c = g[0];
      else if (ly === -48) c = red[3];
      else if (ly === -17 || ly === -16) c = ly === -17 ? g[3] : g[1];
      else if (ly >= -4) c = ly <= -3 ? red[0] : PAL.ink[1];
      else if (ly >= -15) c = red[1];
      // Bow highlight edge, stern shadow edge.
      if (lx > -10 + (ly + 52) * -0.4 && ly < -18 && c === red[2]) c = red[3];
      if (lx < -224 && c === red[2]) c = red[1];
      b.set(x, y, c);
    }
  }
  // Plank seams.
  for (let ly = -42; ly < -20; ly += 7) b.hline(X(-226), X(-12 + (ly + 52) * -0.3), Y(ly), red[1]);
  // Portholes.
  for (let lx = -212; lx < -40; lx += 18) {
    const cx = X(lx);
    const cy = Y(-32);
    b.circle(cx, cy, 3, g[1]);
    b.circle(cx, cy, 2, PAL.navy[1]);
    b.set(cx - 1, cy - 1, PAL.sky[2]);
    b.set(cx - 3, cy - 1, g[3]);
    b.set(cx - 2, cy - 3, g[3]);
  }
  // The bow crest: a gold disc with a red star (the Commodore's colours).
  {
    const cx = X(-32);
    const cy = Y(-32);
    b.circle(cx, cy, 6, g[1]);
    b.circle(cx, cy, 5, g[2]);
    b.circle(cx - 1, cy - 1, 3, g[3]);
    b.poly(
      [
        [cx, cy - 4],
        [cx + 1, cy - 1],
        [cx + 4, cy - 1],
        [cx + 2, cy + 1],
        [cx + 3, cy + 4],
        [cx, cy + 2],
        [cx - 3, cy + 4],
        [cx - 2, cy + 1],
        [cx - 4, cy - 1],
        [cx - 1, cy - 1],
      ],
      red[2],
    );
  }
  // Funnels (behind the cabin roof line).
  funnel(b, X(ENC.funnels[1][0]), Y(ENC.funnels[1][1]), Y(-88));
  funnel(b, X(ENC.funnels[0][0]), Y(ENC.funnels[0][1]), Y(-88));
  // Cabin (saloon): white walls, arched windows, red roof with gold trim.
  b.rect(X(-216), Y(-84), 64, 32, cl[2]);
  b.hline(X(-216), X(-153), Y(-84), cl[3]);
  b.vline(X(-216), Y(-84), Y(-53), cl[3]);
  b.hline(X(-216), X(-153), Y(-53), cl[1]);
  b.hline(X(-216), X(-153), Y(-58), cl[1]);
  for (let lx = -212; lx < -158; lx += 11) arched(b, X(lx), Y(-78), 7, 13);
  b.rect(X(-220), Y(-90), 72, 6, red[2]);
  b.hline(X(-220), X(-149), Y(-90), g[3]);
  b.hline(X(-220), X(-149), Y(-89), g[2]);
  b.hline(X(-220), X(-149), Y(-85), red[0]);
  // Pilot house (the bridge) with the big window (a hole: Blare shows through it).
  b.rect(X(-154), Y(-104), 34, 52, cl[2]);
  b.vline(X(-154), Y(-104), Y(-53), cl[3]);
  b.vline(X(-121), Y(-104), Y(-53), cl[1]);
  b.hline(X(-154), X(-121), Y(-53), cl[1]);
  b.rect(X(-158), Y(-110), 42, 6, red[2]);
  b.hline(X(-158), X(-117), Y(-110), g[3]);
  b.hline(X(-158), X(-117), Y(-109), g[2]);
  b.hline(X(-158), X(-117), Y(-105), red[0]);
  // Little domed lantern and the pennant pole on the bridge roof.
  b.rect(X(-142), Y(-115), 7, 5, g[2]);
  b.hline(X(-142), X(-136), Y(-115), g[3]);
  b.vline(X(-126), Y(-128), Y(-111), PAL.steel[2]);
  b.poly(
    [
      [X(-125), Y(-128)],
      [X(-110), Y(-125)],
      [X(-125), Y(-122)],
    ],
    red[3],
  );
  b.hline(X(-125), X(-116), Y(-125), red[2]);
  // Window frame (gold) and the bridge door.
  const hole = ENC.bridge.hole;
  b.strokeRect(X(hole.x) - 2, Y(hole.y) - 2, hole.w + 4, hole.h + 4, g[1]);
  b.hline(X(hole.x) - 2, X(hole.x) + hole.w + 1, Y(hole.y) - 2, g[3]);
  b.rect(X(-126), Y(-72), 3, 18, PAL.brown[1]);
  // Deck furniture: a life ring on the cabin wall, a capstan on the fore deck.
  b.circle(X(-170), Y(-66), 5, red[3]);
  b.circle(X(-170), Y(-66), 2, cl[2]);
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]] as const) b.set(X(-170) + dx, Y(-66) + dy, cl[3]);
  b.rect(X(-52), Y(-58), 6, 6, PAL.steel[2]);
  b.hline(X(-53), X(-46), Y(-58), PAL.steel[3]);
  let out = b.outline(INK);
  // The bridge window opening.
  for (let y = 0; y < hole.h; y++) for (let x = 0; x < hole.w; x++) out.set(X(hole.x) + x, Y(hole.y) + y, 0);
  if (state > 0) out = damage(out, state === 1 ? 0.3 : 0.75, 41 + state);
  // Railings (drawn after the outline: thin white bars with a grey shade).
  railing(out, -230, -4, -52);
  railing(out, -220, -150, -90);
  return out;
}

/** White deck railing along local y `deck`, from x0 to x1. */
function railing(b: PixelBuffer, x0: number, x1: number, deck: number): void {
  for (let lx = x0; lx <= x1; lx += 6) {
    if (b.get(X(lx), Y(deck - 4)) !== 0 && b.get(X(lx), Y(deck - 4)) !== PAL.snow[3]) continue;
    b.vline(X(lx), Y(deck - 7), Y(deck - 1), PAL.snow[2]);
  }
  for (let lx = x0; lx <= x1; lx++) {
    const top = b.get(X(lx), Y(deck - 8));
    if (top === 0 || top === PAL.snow[3]) b.set(X(lx), Y(deck - 8), PAL.snow[3]);
    const low = b.get(X(lx), Y(deck - 7));
    if (low === 0) b.set(X(lx), Y(deck - 7), PAL.steel[2]);
    const mid = b.get(X(lx), Y(deck - 4));
    if (mid === 0) b.set(X(lx), Y(deck - 4), PAL.snow[1]);
  }
}

defineSprite('boss/encore/hull-0', () => ({ buf: hullFrame(0), ox: OX, oy: OY }));
defineSprite('boss/encore/hull-1', () => ({ buf: hullFrame(1), ox: OX, oy: OY }));
defineSprite('boss/encore/hull-2', () => ({ buf: hullFrame(2), ox: OX, oy: OY }));

/** Dark bridge interior (a brass wheel and a lamp glow), drawn behind Blare. */
defineSprite('boss/encore/bridge-back', () => {
  const h = ENC.bridge.hole;
  const b = new PixelBuffer(h.w, h.h).fill(PAL.navy[0]);
  b.rect(0, 0, h.w, 3, PAL.ink[1]);
  b.circle(h.w - 5, h.h - 4, 4, PAL.brown[1], false);
  b.set(h.w - 5, h.h - 4, PAL.gold[2]);
  b.rect(2, 4, 3, 3, PAL.gold[1]);
  b.set(3, 5, PAL.gold[3]);
  return { buf: b, ox: -h.x, oy: -h.y };
});

// ------------------------------------------------------------------------------------- horn

/** Horn buffer: pivot at (HPX, HPY). */
const HW = 72;
const HH = 56;
const HPX = 32;
const HPY = 34;

/**
 * The foghorn at `deg` (+ = mouth down): a gold cone from a narrow throat behind the pivot to a
 * 28-px bell mouth in front, a steel clamp on a swivel post. `broken` = only the jagged throat.
 */
function hornFrame(deg: number, state: number, broken = false): Frame {
  const b = new PixelBuffer(HW, HH);
  const g = PAL.gold;
  const st = PAL.steel;
  // Swivel post and base plate (to the deck, 6 px under the pivot).
  b.rect(HPX - 2, HPY, 5, 7, st[2]);
  b.vline(HPX - 2, HPY, HPY + 6, st[3]);
  b.vline(HPX + 2, HPY, HPY + 6, st[1]);
  b.rect(HPX - 8, HPY + 5, 17, 3, st[2]);
  b.hline(HPX - 8, HPX + 8, HPY + 5, st[3]);
  rivet(b, HPX - 6, HPY + 6, st);
  rivet(b, HPX + 5, HPY + 6, st);
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const s0 = -22;
  const s1 = broken ? -4 : 24;
  const rad = (s: number): number => {
    const t = (s - s0) / (24 - s0);
    return 3 + 11 * t * t * t + 1.5 * t;
  };
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < HW; x++) {
      const px = x - HPX;
      const py = y - (HPY - 2);
      const s = px * dx + py * dy;
      const d = -px * dy + py * dx;
      if (s < s0 || s > s1) continue;
      const r = rad(s);
      if (Math.abs(d) > r) continue;
      if (broken && s > s1 - 3 && ((Math.round(d) * 7) & 3) === 0) continue;
      let c: Color = g[2];
      if (d < -r * 0.45) c = g[3];
      else if (d > r * 0.55) c = g[1];
      if (d > r * 0.85) c = g[0];
      if (Math.abs(s + 10) < 0.8 || Math.abs(s - 2) < 0.8) c = g[0];
      if (!broken && s > 21.5) c = d < 0 ? g[3] : g[1];
      if (!broken && s > 19 && s <= 21.5 && Math.abs(d) < r - 2.5) c = PAL.ink[1];
      if (!broken && s > 16 && s <= 19 && Math.abs(d) < r - 4) c = PAL.brown[0];
      b.set(x, y, c);
    }
  }
  // Steel clamp over the pivot.
  for (let k = -1; k <= 1; k++) {
    const cx = Math.round(HPX + dx * (-4 + k));
    const cy = Math.round(HPY - 2 + dy * (-4 + k));
    b.line(Math.round(cx + dy * 6), Math.round(cy - dx * 6), Math.round(cx - dy * 6), Math.round(cy + dx * 6), k === -1 ? st[3] : st[1]);
  }
  b.circle(HPX, HPY, 2, st[2]);
  b.set(HPX - 1, HPY - 1, st[4]);
  let out = b.outline(INK);
  if (broken) {
    out = damage(out, 1, 77);
    // Scorched, jagged end.
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < HW; x++) {
        const px = x - HPX;
        const py = y - (HPY - 2);
        const s = px * dx + py * dy;
        if (s > -9 && s <= s1 && out.get(x, y) !== 0 && out.get(x, y) !== INK && (x + y) % 3 !== 0) out.set(x, y, PAL.ink[1]);
      }
    }
  } else if (state > 0) out = damage(out, state === 1 ? 0.6 : 1.4, 13 + state);
  return { buf: out, ox: HPX, oy: HPY };
}

const HORN_DEG = [0, 14, -14] as const;
for (const s of [0, 1, 2]) {
  defineSprite(`boss/encore/horn-${s}`, () => {
    const frames = HORN_DEG.map((d) => hornFrame(d, s));
    if (s === 2) frames.push(hornFrame(0, 2, true));
    return frames;
  });
}

// ------------------------------------------------------------------------------------- calliope

const CW = 66;
const CH = 48;
const CAX = 33;
const CAY = 44;

/** The steam calliope: a red cabinet with gold scrolls and six brass pipes (low → high). */
function calliopeFrame(state: number, playing: boolean, broken = false): Frame {
  const b = new PixelBuffer(CW, CH);
  const g = PAL.gold;
  const red = PAL.red;
  const [ax, ay] = ENC.calliope.anchor;
  // Pipes.
  ENC.calliope.pipes.forEach(([px, py], i) => {
    const x0 = CAX + (px - ax) - 3;
    let top = CAY + (py - ay) - (playing ? 1 : 0);
    if (broken) top = CAY - 8 - ((i * 5 + 3) % 9) - 3;
    const bottom = CAY - 8;
    for (let y = top; y <= bottom; y++) {
      b.set(x0, y, g[3]);
      b.set(x0 + 1, y, g[2]);
      b.set(x0 + 2, y, g[2]);
      b.set(x0 + 3, y, g[2]);
      b.set(x0 + 4, y, g[1]);
      b.set(x0 + 5, y, g[0]);
    }
    if (broken) {
      for (let x = 0; x < 6; x += 2) b.set(x0 + x, top, 0);
      b.set(x0 + 1, top + 1, PAL.ink[1]);
      return;
    }
    // Cap (lifted while playing) and the whistle mouth.
    b.hline(x0 - 1, x0 + 6, top, g[3]);
    b.hline(x0 + 1, x0 + 4, top + 1, PAL.ink[1]);
    if (playing) b.hline(x0, x0 + 5, top - 2, g[2]);
    b.rect(x0 + 1, bottom - 5, 3, 2, PAL.ink[1]);
    b.set(x0 + 1, bottom - 6, g[3]);
    // A band.
    b.hline(x0, x0 + 5, top + 5, g[1]);
  });
  // Cabinet.
  b.rect(CAX - 29, CAY - 9, 58, 9, red[2]);
  b.hline(CAX - 29, CAX + 28, CAY - 9, g[3]);
  b.hline(CAX - 29, CAX + 28, CAY - 8, g[1]);
  b.hline(CAX - 29, CAX + 28, CAY - 1, red[0]);
  b.vline(CAX - 29, CAY - 8, CAY - 2, red[3]);
  for (let k = 0; k < 4; k++) {
    const cx = CAX - 21 + k * 14;
    b.circle(cx, CAY - 4, 2, g[2], false);
    b.set(cx, CAY - 4, g[3]);
  }
  // Pressure gauge on the side.
  b.circle(CAX + 25, CAY - 12, 3, PAL.snow[2]);
  b.circle(CAX + 25, CAY - 12, 3, g[1], false);
  b.line(CAX + 25, CAY - 12, CAX + 26, CAY - 14, red[1]);
  let out = b.outline(INK);
  if (broken) out = damage(out, 1.2, 91);
  else if (state > 0) out = damage(out, state === 1 ? 0.5 : 1.2, 23 + state);
  return { buf: out, ox: CAX, oy: CAY };
}

for (const s of [0, 1, 2]) {
  defineSprite(`boss/encore/calliope-${s}`, () => {
    const frames = [calliopeFrame(s, false), calliopeFrame(s, true)];
    if (s === 2) frames.push(calliopeFrame(2, false, true));
    return frames;
  });
}

// ------------------------------------------------------------------------------------- wheel

const WR = ENC.wheel.r;
const WD = WR * 2 + 5;
const WC = WR + 2;

/** Paddle wheel at rotation `phase` (0..3 = 0°, 11.25°, 22.5°, 33.75°), `missing` paddles gone. */
function wheelFrame(phase: number, state: number, missing: readonly number[] = [], hubOnly = false): Frame {
  const b = new PixelBuffer(WD, WD);
  const red = PAL.red;
  const g = PAL.gold;
  const rot = (phase * Math.PI) / 16;
  if (!hubOnly) {
    // Rims.
    b.circle(WC, WC, WR - 3, red[1], false);
    b.circle(WC, WC, WR - 4, red[2], false);
    b.circle(WC, WC, 15, red[1], false);
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Spoke.
      b.thickLine(WC, WC, Math.round(WC + ca * (WR - 4)), Math.round(WC + sa * (WR - 4)), 2, red[1]);
      if (missing.includes(i)) continue;
      // Paddle board: from r 15 to r WR, 6 wide across the spoke.
      for (let s = 15; s <= WR; s += 0.5) {
        for (let k = -3; k <= 3; k++) {
          const x = Math.round(WC + ca * s - sa * k);
          const y = Math.round(WC + sa * s + ca * k);
          const lit = k * -sa + k * -ca < 0;
          b.set(x, y, s > WR - 1.5 ? red[3] : lit ? red[3] : k === 3 || k === -3 ? red[1] : red[2]);
        }
      }
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const a = rot + (i * Math.PI * 2) / 3 + 0.4;
      b.thickLine(WC, WC, Math.round(WC + Math.cos(a) * 10), Math.round(WC + Math.sin(a) * 10), 2, red[0]);
    }
  }
  // Hub.
  b.circle(WC, WC, 5, g[1]);
  b.circle(WC - 1, WC - 1, 3, g[2]);
  b.set(WC - 2, WC - 2, g[3]);
  b.set(WC, WC, PAL.ink[1]);
  let out = b.outline(INK);
  if (hubOnly) out = damage(out, 1, 5);
  else if (state > 0) out = damage(out, state === 1 ? 0.5 : 1.1, 31 + state + phase);
  return { buf: out, ox: WC, oy: WC };
}

defineSprite('boss/encore/wheel-0', () => [0, 1, 2, 3].map((p) => wheelFrame(p, 0)), { ticksPerFrame: 4 });
defineSprite('boss/encore/wheel-1', () => [0, 1, 2, 3].map((p) => wheelFrame(p, 1, [5])), { ticksPerFrame: 4 });
defineSprite(
  'boss/encore/wheel-2',
  () => {
    const f = [0, 1, 2, 3].map((p) => wheelFrame(p, 2, [2, 5]));
    f.push(wheelFrame(0, 2, [], true));
    return f;
  },
  { ticksPerFrame: 4 },
);

/** The wheel spinning fast: a red blur disc with spray streaks (2 frames). */
defineSprite(
  'boss/encore/wheel-blur',
  () =>
    [0, 1].map((p) => {
      const b = new PixelBuffer(WD, WD);
      b.circle(WC, WC, WR, PAL.red[1]);
      b.circle(WC, WC, WR - 3, PAL.red[2]);
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8 + p * 0.2;
        if (i % 2 === p) b.line(Math.round(WC + Math.cos(a) * 16), Math.round(WC + Math.sin(a) * 16), Math.round(WC + Math.cos(a + 0.35) * (WR - 2)), Math.round(WC + Math.sin(a + 0.35) * (WR - 2)), PAL.red[3]);
      }
      b.circle(WC, WC, 15, PAL.red[0], false);
      b.circle(WC, WC, 5, PAL.gold[2]);
      b.set(WC - 1, WC - 1, PAL.gold[3]);
      return { buf: b.outline(INK), ox: WC, oy: WC };
    }),
  { ticksPerFrame: 2 },
);

/** Used by the boss: the stump frame index of each part's `-2` strip. */
export const STUMP = { horn: 3, calliope: 2, wheel: 4 } as const;
