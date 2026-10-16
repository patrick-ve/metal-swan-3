/**
 * The menu backdrop (docs/design/squad.md §2.3): a military base at night. A dark sky with stars
 * and two searchlights sweeping it, a far tree line, two quonset hangars (one door ajar, warm
 * light), a lattice radio mast with blinking red lights, a parked SWAN-3 under camo netting,
 * drifting smoke from a stove pipe, and in front a sandbag wall topped with barbed wire.
 *
 * Used by the title, mode select, options, HOW TO PLAY, high scores and name entry (the lake in
 * lake.ts stays for the ending). The static parts are built once into three buffers (sky, land,
 * wall); each frame adds the beams, the smoke and the mast lights with a few rects, no
 * allocation. `veil()` (lake.ts) still works on top.
 *
 * The title draws its patrolling SWAN-3 between the land and the wall: `drawBase(r, t, NO_WALL)`,
 * the swan, then `drawBaseWall(r)`. With `parked: false` the camo netting hangs empty (the swan is
 * out on patrol).
 */
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Renderer } from '../../engine/render';
import { Rng } from '../../engine/rng';
import { frameW, getFrame, hasSprite } from '../../engine/sprites';
import { centerText, UI_GOLD } from '../app';
import { stencilId } from '../content/ui/military.art';

/** The ground line of the base (hangars and mast stand on it). */
export const BASE_GROUND = 160;
/** The top of the sandbag wall; the patrol walks with its feet a little below it. */
export const BASE_WALL_TOP = 186;
/** The feet line of the title's patrolling swan (her legs hide behind the wall). */
export const BASE_PATROL_Y = 194;

export interface BaseOpts {
  /** Draw the sandbag wall (default true). */
  wall?: boolean;
  /** A SWAN-3 parked under the netting (default true). */
  parked?: boolean;
}

/** Shared option records (no allocation per frame). */
export const NO_WALL: BaseOpts = { wall: false, parked: false };
const DEFAULT: BaseOpts = {};

const W = 384;
const H = 216;
const MAST_X = 168;
const MAST_TOP = 38;
const NET_X = 286;
/** The parked SWAN-3: standing riderless, head up (her neck is baked into this strip). */
const PARKED = 'vehicle/swan/shake';
/** The searchlights: base x, base y, phase, speed. */
const BEAMS: readonly (readonly [number, number, number, number])[] = [
  [78, 150, 0, 0.0105],
  [262, 156, 2.1, 0.0085],
];

let sky: PixelBuffer | null = null;
let land: PixelBuffer | null = null;
let landEmpty: PixelBuffer | null = null;
let wall: PixelBuffer | null = null;
let puff: PixelBuffer | null = null;
/** Was the swan art there when the land buffer was built (else rebuild once it is)? */
let landHadSwan = false;

const plain: DrawOpts = { screen: true };
const beamOpts: DrawOpts = { screen: true, alpha: 0.08 };
const coreOpts: DrawOpts = { screen: true, alpha: 0.1 };
const smokeOpts: DrawOpts = { screen: true, alpha: 0.3 };
const glowOpts: DrawOpts = { screen: true, alpha: 0.35 };

// ---------------------------------------------------------------------------------------------
// The static layers
// ---------------------------------------------------------------------------------------------

const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function buildSky(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const bands: Color[] = [PAL.ink[0], PAL.ink[1], PAL.navy[0], PAL.navy[1]];
  const top = 0;
  const bottom = BASE_GROUND;
  for (let y = 0; y < H; y++) {
    const f = Math.min(0.999, Math.max(0, (y - top) / (bottom - top)));
    const pos = f * (bands.length - 1);
    const i = Math.floor(pos);
    const frac = pos - i;
    for (let x = 0; x < W; x++) {
      // Ordered 4 × 4 Bayer dither into the next band over the last 40 % of each band.
      const th = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const c = frac > 0.6 && th < (frac - 0.6) / 0.4 ? bands[Math.min(bands.length - 1, i + 1)] : bands[i];
      b.set(x, y, c);
    }
  }
  const rng = new Rng('base-sky');
  for (let i = 0; i < 46; i++) {
    const x = rng.int(0, W - 2);
    const y = rng.int(2, 110);
    const big = rng.next() < 0.15;
    b.set(x, y, big ? PAL.snow[2] : rng.next() < 0.5 ? PAL.steel[3] : PAL.steel[2]);
    if (big) b.set(x + 1, y, PAL.steel[2]);
  }
  // The far tree line.
  for (let x = 0; x < W; x++) {
    const h = 6 + Math.round(3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.23 + 1) + ((x * 37) % 5 === 0 ? 2 : 0));
    b.rect(x, BASE_GROUND - 8 - h, 1, h + 8, PAL.ink[1]);
  }
  return b;
}

/** A quonset hangar: a half-round corrugated roof from x0 to x1 standing on the ground line. */
function hangar(b: PixelBuffer, x0: number, x1: number, h: number, door: { x: number; w: number; ajar: number }): void {
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const g = BASE_GROUND;
  for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx;
    const top = Math.round(g - h * Math.sqrt(Math.max(0, 1 - dx * dx)));
    for (let y = top; y < g; y++) {
      // Corrugation: vertical ribs every 4 px; moonlight on the upper left of the roof.
      const rib = (x - x0) % 4 === 0;
      let c: Color = rib ? PAL.navy[0] : PAL.steel[0];
      if (dx < -0.2 && y < top + 3) c = PAL.steel[1];
      b.set(x, y, c);
    }
    b.set(x, top, dx < 0 ? PAL.steel[2] : PAL.steel[1]);
    if (top > 0) b.set(x, top - 1, INK);
  }
  // The end wall door: dark, ajar with a slice of warm light, a gold glow spilling on the ground.
  const dy = g - Math.round(h * 0.62);
  b.rect(door.x - 1, dy - 1, door.w + 2, g - dy + 1, INK);
  b.rect(door.x, dy, door.w, g - dy, PAL.ink[1]);
  b.rect(door.x + door.w - door.ajar, dy, door.ajar, g - dy, PAL.gold[1]);
  b.rect(door.x + door.w - door.ajar, dy, 1, g - dy, PAL.gold[3]);
  b.rect(door.x + door.w - door.ajar - 2, g, door.ajar + 6, 1, PAL.gold[0]);
}

/** The lattice radio mast (base 12 px wide, tapering to 2) with its guy wires. */
function mast(b: PixelBuffer): void {
  const g = BASE_GROUND;
  const half = (y: number): number => 1 + Math.round(((y - MAST_TOP) / (g - MAST_TOP)) * 5);
  for (let y = MAST_TOP; y < g; y++) {
    const hw = half(y);
    b.set(MAST_X - hw, y, PAL.steel[1]);
    b.set(MAST_X + hw, y, PAL.steel[0]);
  }
  // Cross bracing: zig-zags between the legs every 8 px.
  for (let y = MAST_TOP + 4; y < g - 2; y += 8) {
    const a = half(y);
    const c = half(y + 8);
    b.line(MAST_X - a, y, MAST_X + c, y + 8, PAL.steel[0]);
    b.line(MAST_X + a, y, MAST_X - c, y + 8, PAL.navy[0]);
    b.hline(MAST_X - a, MAST_X + a, y, PAL.steel[1]);
  }
  // Guy wires to the ground.
  b.line(MAST_X, MAST_TOP + 20, MAST_X - 46, g, PAL.navy[0]);
  b.line(MAST_X, MAST_TOP + 20, MAST_X + 46, g, PAL.navy[0]);
  // The antenna tip and the dark lamp housings (the lights blink at draw time).
  b.vline(MAST_X, MAST_TOP - 8, MAST_TOP, PAL.steel[1]);
  b.rect(MAST_X - 1, MAST_TOP - 2, 3, 2, INK);
  b.rect(MAST_X - 2, MAST_TOP + 44, 5, 2, INK);
}

/** Camo netting draped from two poles over the parking spot (with or without a swan under it). */
function netting(b: PixelBuffer, parked: boolean): void {
  const g = BASE_GROUND + 14;
  const x0 = NET_X - 40;
  const x1 = NET_X + 52;
  if (parked && hasSprite(PARKED)) {
    const f = getFrame(PARKED, 0);
    b.blitFrame(f, NET_X + 2, g);
  }
  // The net: a sagging canopy between two poles; holes let the dark (or the swan) show through.
  const poleL = x0 + 8;
  const poleR = x1 - 8;
  const topY = g - 54;
  b.rect(poleL, topY, 2, g - topY, PAL.brown[0]);
  b.rect(poleR, topY, 2, g - topY, PAL.brown[0]);
  for (let x = x0; x <= x1; x++) {
    // Canopy top: high over the poles, sagging between them; skirts slope to the ground outside.
    let top: number;
    if (x < poleL) top = topY + Math.round(((poleL - x) / (poleL - x0)) * (g - topY - 4));
    else if (x > poleR) top = topY + Math.round(((x - poleR) / (x1 - poleR)) * (g - topY - 4));
    else top = topY + 3 + Math.round(5 * Math.sin(((x - poleL) / (poleR - poleL)) * Math.PI));
    const skirt = x < poleL || x > poleR;
    const bottom = skirt ? g : top + 14 + ((x * 7) % 5);
    for (let y = top; y < bottom; y++) {
      const cell = ((x >> 1) + (y >> 1)) % 3;
      const hole = ((x + y) & 3) === 0 && ((x - y) & 3) === 0;
      if (hole && y > top + 1) continue;
      const patch = ((Math.floor(x / 9) * 7 + Math.floor(y / 6) * 3) % 4) as 0 | 1 | 2 | 3;
      const ramp: Color[] = [PAL.olive[0], PAL.olive[1], PAL.green[1], PAL.brown[1]];
      b.set(x, y, cell === 0 ? PAL.olive[0] : ramp[patch]);
    }
    b.set(x, top, x < NET_X ? PAL.olive[2] : PAL.olive[1]);
    if (top > 0) b.set(x, top - 1, INK);
    // Tassels of the hanging edge.
    if (!skirt && x % 3 === 0) b.vline(x, bottom, bottom + 2, PAL.olive[0]);
  }
}

function buildLand(parked: boolean): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const g = BASE_GROUND;
  // Hangars: a big one on the left, a small one right of the mast.
  hangar(b, 8, 128, 46, { x: 92, w: 18, ajar: 4 });
  hangar(b, 196, 252, 28, { x: 214, w: 14, ajar: 0 });
  // The stove pipe on the big hangar (the smoke rises from it).
  b.rect(44, g - 52, 4, 10, PAL.steel[1]);
  b.rect(44, g - 52, 4, 1, PAL.steel[2]);
  b.rect(48, g - 52, 1, 10, INK);
  mast(b);
  // Fuel drums and crates by the small hangar.
  for (const x of [258, 266]) {
    b.rect(x, g - 9, 7, 9, PAL.olive[1]);
    b.rect(x, g - 9, 7, 1, PAL.olive[2]);
    b.rect(x, g - 5, 7, 1, PAL.olive[0]);
    b.rect(x + 6, g - 9, 1, 9, INK);
  }
  b.rect(150, g - 8, 12, 8, PAL.brown[1]);
  b.rect(150, g - 8, 12, 1, PAL.brown[2]);
  b.line(150, g - 8, 161, g - 1, PAL.brown[0]);
  // The ground: dark earth, a tarmac apron with painted dashes.
  b.rect(0, g, W, H - g, PAL.ink[1]);
  b.rect(0, g, W, 1, PAL.stone[0]);
  for (let x = 6; x < W; x += 22) b.rect(x, g + 10, 10, 1, PAL.stone[0]);
  netting(b, parked);
  return b;
}

/** One sandbag (16 × 8) at (x, y): a stuffed bag with rounded ends, a lit bulge, a dark crease, a tied ear. */
function sandbag(b: PixelBuffer, x: number, y: number, olive: boolean): void {
  const r = olive ? PAL.olive : PAL.sand;
  b.roundRect(x, y, 16, 8, 3, INK);
  b.roundRect(x + 1, y + 1, 14, 6, 2, r[1]);
  b.rect(x + 3, y + 1, 10, 2, r[2]);
  b.rect(x + 5, y + 1, 5, 1, r[3]);
  b.rect(x + 2, y + 5, 12, 1, r[0]);
  // The seam across the middle and the tied ear at the right end.
  b.vline(x + 8, y + 3, y + 5, r[0]);
  b.set(x + 14, y + 2, r[0]);
  b.set(x + 15, y + 3, r[1]);
}

function buildWall(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const top = BASE_WALL_TOP;
  // The ground in front of the wall.
  b.rect(0, top + 18, W, H - top - 18, PAL.ink[0]);
  b.rect(0, top + 4, W, 16, INK);
  // Three courses of bags, staggered, each bag a little higher or lower than its neighbours.
  const rng = new Rng('base-wall');
  for (let row = 2; row >= 0; row--) {
    const y = top + row * 6;
    for (let x = row % 2 ? -8 : -2; x < W; x += 15) {
      const dy = rng.int(0, 1);
      sandbag(b, x, y + dy, rng.next() < 0.3);
    }
  }
  // Concertina wire on stakes above the wall: wide coils with a lit top, barbs along the strand.
  for (let x = 10; x < W; x += 48) {
    b.rect(x, top - 14, 2, 15, PAL.brown[0]);
    b.set(x, top - 14, PAL.brown[2]);
  }
  for (let x = -8; x < W + 8; x += 9) {
    b.ellipse(x, top - 13, 14, 12, PAL.steel[1], false);
  }
  for (let x = -8; x < W + 8; x += 9) {
    // The lit upper arc of each coil.
    b.set(x + 5, top - 13, PAL.steel[3]);
    b.set(x + 6, top - 13, PAL.steel[3]);
    b.set(x + 8, top - 13, PAL.steel[2]);
    // Barbs: a small cross on the strand.
    b.set(x + 2, top - 10, PAL.steel[3]);
    b.set(x + 1, top - 11, PAL.steel[2]);
    b.set(x + 3, top - 9, PAL.steel[2]);
  }
  return b;
}

function buildPuff(): PixelBuffer {
  const b = new PixelBuffer(20, 12);
  b.ellipse(0, 0, 20, 12, PAL.stone[1]);
  b.ellipse(3, 1, 12, 7, PAL.stone[2]);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------

/** Draw the sky, the beams, the base and (by default) the wall. `t` = frames (any clock). */
export function drawBase(r: Renderer, t: number, o: BaseOpts = DEFAULT): void {
  const parked = o.parked !== false;
  sky ??= buildSky();
  r.image(sky, 0, 0, plain);
  // Searchlights: long thin wedges sweeping the sky (drawn in 2-px rows).
  for (const [bx, by, phase, speed] of BEAMS) {
    const a = Math.sin(t * speed + phase) * 0.62;
    const tan = Math.tan(a);
    for (let y = by - 2; y > -2; y -= 2) {
      const d = by - y;
      const cx = bx + d * tan;
      const hw = 1 + d * 0.085;
      r.rect(Math.round(cx - hw), y, Math.round(hw * 2), 2, PAL.sky[3], beamOpts);
      r.rect(Math.round(cx - hw * 0.4), y, Math.max(1, Math.round(hw * 0.8)), 2, PAL.snow[3], coreOpts);
    }
  }
  const swanNow = hasSprite(PARKED);
  if (parked) {
    if (!land || (swanNow && !landHadSwan)) {
      land = buildLand(true);
      landHadSwan = swanNow;
    }
  } else landEmpty ??= buildLand(false);
  r.image(parked ? (land as PixelBuffer) : (landEmpty as PixelBuffer), 0, 0, plain);
  // Smoke from the stove pipe: five puffs rising and drifting right, fading as they go.
  puff ??= buildPuff();
  for (let i = 0; i < 5; i++) {
    const life = (t * 0.35 + i * 34) % 170;
    const x = 36 + life * 0.55 + Math.sin((t + i * 40) * 0.02) * 3;
    const y = BASE_GROUND - 58 - life * 0.42;
    smokeOpts.alpha = 0.32 * (1 - life / 170);
    r.image(puff, Math.round(x), Math.round(y), smokeOpts);
  }
  // The mast lights: the top one blinks slowly, the middle one answers half a beat later.
  const on1 = t % 80 < 40;
  const on2 = (t + 40) % 80 < 30;
  mastLight(r, MAST_X, MAST_TOP - 2, on1);
  mastLight(r, MAST_X, MAST_TOP + 44, on2);
  // A warning light on the hangar roof.
  mastLight(r, 68, BASE_GROUND - 47, t % 120 < 12);
  if (o.wall !== false) drawBaseWall(r);
}

function mastLight(r: Renderer, x: number, y: number, on: boolean): void {
  if (!on) {
    r.rect(x - 1, y, 3, 2, PAL.red[0], plain);
    return;
  }
  glowOpts.alpha = 0.35;
  r.rect(x - 3, y - 2, 7, 6, PAL.red[2], glowOpts);
  r.rect(x - 1, y, 3, 2, PAL.red[3], plain);
}

/** The sandbag wall with its barbed wire (the title draws it after its patrol). */
export function drawBaseWall(r: Renderer): void {
  wall ??= buildWall();
  r.image(wall, 0, 0, plain);
}

/** The title patrol walks 0.4 px/tick between x 40 and w − 40, then turns round. */
const PATROL_SPEED = 0.4;

/** The patrol's x at time t. */
export function patrolX(t: number, w = W): number {
  const span = w - 80;
  const d = (t * PATROL_SPEED) % (span * 2);
  return 40 + (d < span ? d : span * 2 - d);
}

/** True while the patrol walks back to the left (draw it flipped). */
export function patrolFlip(t: number, w = W): boolean {
  const span = w - 80;
  return (t * PATROL_SPEED) % (span * 2) >= span;
}

const titleOpts: DrawOpts = { screen: true };

/**
 * A menu title as stencil lettering (`ui/mil/stencil-<slug>`, content/ui/military.art.ts),
 * centred with its top at y; the big font in gold when the sprite is missing.
 */
export function drawStencilTitle(r: Renderer, text: string, y: number): void {
  const id = stencilId(text);
  if (hasSprite(id)) {
    const f = getFrame(id, 0);
    r.sprite(id, 0, (r.w - frameW(f)) >> 1, y, titleOpts);
  } else centerText(r, text, y + 4, UI_GOLD, 'big');
}

const panelOpts: DrawOpts = { screen: true };

/**
 * A military menu box: a gunmetal fill at `alpha` inside a rust-brown steel rim (2 px, lit
 * top-left) with an ink edge and a bolt in each corner. Rects only.
 */
export function drawMilPanel(r: Renderer, x: number, y: number, w: number, h: number, alpha = 0.92): void {
  panelOpts.alpha = 1;
  r.rect(x - 3, y - 3, w + 6, h + 6, INK, panelOpts);
  r.rect(x - 2, y - 2, w + 4, h + 4, PAL.brown[1], panelOpts);
  r.rect(x - 2, y - 2, w + 4, 1, PAL.brown[3], panelOpts);
  r.rect(x - 2, y - 2, 1, h + 4, PAL.brown[2], panelOpts);
  r.rect(x - 2, y + h + 1, w + 4, 1, PAL.brown[0], panelOpts);
  r.rect(x + w + 1, y - 2, 1, h + 4, PAL.brown[0], panelOpts);
  r.rect(x - 1, y - 1, w + 2, h + 2, INK, panelOpts);
  panelOpts.alpha = alpha;
  r.rect(x, y, w, h, PAL.steel[0], panelOpts);
  panelOpts.alpha = 1;
  r.rect(x, y, w, 1, PAL.steel[1], panelOpts);
  for (let i = 0; i < 4; i++) {
    const bx = i & 1 ? x + w - 2 : x - 3;
    const by = i & 2 ? y + h - 2 : y - 3;
    r.rect(bx, by, 5, 5, INK, panelOpts);
    r.rect(bx + 1, by + 1, 3, 3, PAL.stone[2], panelOpts);
    r.rect(bx + 1, by + 1, 2, 1, PAL.stone[3], panelOpts);
    r.rect(bx + 3, by + 2, 1, 2, PAL.stone[0], panelOpts);
  }
}
