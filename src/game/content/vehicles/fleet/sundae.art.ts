/**
 * SUNDAE DRIVER art (GDD §8.3): Mrs. Dollop's pastel-pink ice-cream van with mint stripes, a
 * striped awning over the serving hatch, four round wheels, a roof loudspeaker and the giant
 * three-scoop cone turret with its blinking cherry. Plus its shots and crumbs.
 *
 * Registers (`vehicle/sundae-driver/…`, body space of ./numbers.ts, feet anchor = ground centre):
 * - `cab` (the dark cab interior behind the window), `body` (2: intact, battered; the cab window
 *   is a hole), `wheels` (4, centre anchor), `special` (3: the loudspeaker, rest / playing),
 *   `turret` (15 cone angles +15° … −195°, anchor = the roof pivot), `cherry` (15, the lit cherry),
 *   `name` (the painted `DOLLOP'S`, centre anchor, drawn unflipped), `empty-gag` (12, the serving
 *   shutter rolls up on an OPEN sign, centre anchor, drawn unflipped), `wreck`, and the
 *   whole-van strips `idle` / `move` (4) for the base class and the sheets.
 * - fx: `note` (2), `scoop` (3: chocolate, vanilla, strawberry), `splat` (6), `bits` (6: three
 *   crumbs, three sprinkles).
 * - shots: `weapon/sprinkle` (+ `-lemon`, `-mint`, `-sky`, `-vanilla`; 16 directions) and
 *   `weapon/sundae-shell` (4, tumbling).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, seededRand, type Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { damage, wheel } from '../../../art/machines';
import { FLAT, shadeLayer } from '../../../art/paint';
import { scorch } from '../../../art/human-fx';
import { blob, center, WHITE, CHROME, cutHole, directionStrip, microText, microWidth, MINT, PINK, Sheet, stackFrames, VANILLA, WAFFLE, type Pt } from './kit.art';
import { ART, coneAngle, SUNDAE } from './numbers';

const A = ART.sundae;
const CHOC: Ramp = PAL.brown;
const BERRY: Ramp = [PAL.pink[0], PAL.pink[1], PAL.pink[2], PAL.skinA[3]];
const CHERRY: Ramp = PAL.red;

// ------------------------------------------------------------------------------------ body

/** The van shell outline (body space, facing right): tall box, sloped windscreen, short hood. */
const SHELL: readonly Pt[] = [
  [-40, -8],
  [-40, -41],
  [-37, -44],
  [27, -44],
  [34, -30],
  [39, -29],
  [40, -26],
  [40, -8],
];

/** Sheet for the body: 92 × 64, body (0, 0) at buffer (46, 60). */
const sheet = (): Sheet => new Sheet(92, 64, 46, 60);

/** Serving hatch (x, y, w, h) on the van's flank; the gag's shutter covers exactly this. */
const HATCH = { x: -31, y: -34, w: 27, h: 11 } as const;

function vanBody(battered: boolean): Frame {
  const s = sheet();
  // Chassis rail and bumpers (behind the shell's lower edge).
  const ch = s.layer();
  s.rect(ch, -38, -11, 76, 5, FLAT);
  s.add(ch, PAL.steel, { base: 1 });
  const bump = s.layer();
  s.rect(bump, 35, -11, 7, 4, FLAT);
  s.rect(bump, -42, -11, 7, 4, FLAT);
  // Shell.
  const sh = s.layer();
  s.poly(sh, SHELL, FLAT);
  s.add(sh, PINK, { glint: true });
  s.add(bump, CHROME, { glint: true });
  // Mint band along the flank (painted on: no ring line).
  const band = s.layer();
  s.rect(band, -40, -21, 81, 6, FLAT);
  for (let x = -40; x <= 40; x++) {
    // Keep the band inside the shell (the front face is vertical below the hood).
    if (!s.buf.inBounds(s.X(x), s.Y(-18)) || (s.buf.get(s.X(x), s.Y(-18)) & 255) === 0) for (let y = -21; y < -15; y++) band.set(s.X(x), s.Y(y), 0);
  }
  shadeLayer(band, MINT);
  s.comp.add(band, { ramp: MINT, ring: false });
  // Thin cream pinstripe under the band.
  const pin = s.layer();
  s.rect(pin, -39, -14, 79, 1, PAL.cloth[2]);
  s.paint(pin);
  // Wheel arches: dark recesses the wheels sit in.
  const arch = s.layer();
  for (const wx of SUNDAE.wheels) {
    for (let y = -17; y <= -8; y++) {
      for (let x = wx - 10; x <= wx + 10; x++) {
        const d = Math.hypot(x - wx, y - SUNDAE.wheelY);
        if (d <= 9.5) arch.set(s.X(x), s.Y(y), d > 8.5 ? PAL.pink[0] : PAL.black[1]);
      }
    }
  }
  s.paint(arch);
  // Awning over the serving hatch: mint / cream stripes, a scalloped hem.
  const aw = s.layer();
  for (let x = HATCH.x - 2; x <= HATCH.x + HATCH.w + 1; x++) {
    const mint = Math.floor((x - HATCH.x + 2) / 3) % 2 === 0;
    const r: Ramp = mint ? MINT : VANILLA;
    const hem = (x - HATCH.x + 2) % 3 === 1 ? 1 : 0;
    for (let y = -40; y <= -36 + hem; y++) aw.set(s.X(x), s.Y(y), y === -40 ? r[3] : y >= -36 ? r[1] : r[2]);
  }
  s.comp.add(aw, { ramp: PAL.teal, ring: true });
  // Serving hatch: a cream roller shutter in a chrome frame, a counter shelf under it.
  const fr = s.layer();
  s.rect(fr, HATCH.x - 1, HATCH.y - 1, HATCH.w + 2, HATCH.h + 2, FLAT);
  s.add(fr, CHROME, { base: 2 });
  const sht = s.layer();
  for (let y = 0; y < HATCH.h; y++) {
    for (let x = 0; x < HATCH.w; x++) sht.set(s.X(HATCH.x + x), s.Y(HATCH.y + y), y % 2 === 1 ? VANILLA[1] : y === 0 ? VANILLA[3] : VANILLA[2]);
  }
  s.comp.add(sht, { ramp: VANILLA, ring: false });
  const shelf = s.layer();
  s.rect(shelf, HATCH.x - 2, HATCH.y + HATCH.h + 1, HATCH.w + 4, 2, FLAT);
  s.add(shelf, CHROME, { base: 3 });
  // Cab window frame (the hole is cut after the outline), door seam and handle.
  const wf = s.layer();
  s.rect(wf, 13, -36, 16, 15, FLAT);
  s.add(wf, CHROME, { base: 2 });
  const det = s.layer();
  for (let y = -40; y <= -9; y++) if (y < -36 || y > -21) det.set(s.X(11), s.Y(y), PAL.pink[0]);
  s.rect(det, 15, -19, 3, 1, PAL.steel[4]);
  // Windscreen glass along the slope.
  for (let i = 0; i <= 12; i++) {
    const x = 28 + Math.round(i * 0.5);
    const y = -43 + i;
    det.set(s.X(x), s.Y(y), PAL.sky[3]);
    det.set(s.X(x - 1), s.Y(y), PAL.sky[2]);
    det.set(s.X(x - 2), s.Y(y), PAL.sky[1]);
  }
  // Headlight, grille, tail light.
  s.rect(det, 37, -27, 2, 2, PAL.gold[3]);
  det.set(s.X(37), s.Y(-27), WHITE);
  for (let y = -13; y <= -12; y++) for (let x = 35; x <= 39; x += 2) det.set(s.X(x), s.Y(y), PAL.steel[1]);
  s.rect(det, -40, -31, 1, 5, PAL.red[2]);
  // Roof: the turret socket ring and a roof rim.
  s.rect(det, -36, -44, 62, 1, PAL.skinA[3]);
  s.paint(det);
  const ring = s.layer();
  s.rect(ring, SUNDAE.pivot[0] - 4, SUNDAE.pivot[1] - 1, 9, 3, FLAT);
  s.add(ring, CHROME, { glint: true });
  let f = s.finish();
  if (battered) {
    const b = damage(f.buf, 0.55, 7);
    // A cracked shutter slat and a scorch on the hood.
    for (let x = -24; x <= -14; x++) b.set(s.X(x), s.Y(-29 + ((x * 3) & 1)), PAL.stone[0]);
    f = { ...f, buf: b };
  }
  const win = SUNDAE.window;
  cutHole(f, win.x, win.y, win.w, win.h);
  return f;
}

/** The cab interior: dark upholstery, the steering wheel rim in front of the driver. */
function cabFrame(): Frame {
  const s = sheet();
  const L = s.layer();
  const win = SUNDAE.window;
  s.rect(L, win.x, win.y, win.w, win.h, PAL.navy[1]);
  s.rect(L, 14, -35, 14, 2, PAL.navy[0]);
  s.rect(L, 14, -33, 3, 11, PAL.navy[0]);
  for (let y = -27; y <= -23; y++) L.set(s.X(26 - ((y + 27) >> 1)), s.Y(y), PAL.steel[1]);
  s.paint(L);
  return s.finish(undefined, false);
}

function wheelFrame(phase: number): Frame {
  const w = wheel(SUNDAE.wheelR, phase, { rim: 'snow', bolts: 4, steps: 1 });
  const b = new PixelBuffer(w.w + 2, w.h + 2);
  b.blit(w, 1, 1);
  // Pink hubcap dot.
  b.set(b.w >> 1, b.h >> 1, PAL.pink[1]);
  return center(b.outline(INK));
}

/** Roof loudspeaker: a horn on a post; playing, it shakes and sound arcs leave it. */
function speakerFrame(k: number): Frame {
  const s = sheet();
  const sh = k === 0 ? 0 : k === 1 ? -1 : 1;
  const post = s.layer();
  s.rect(post, 20, -48, 2, 5, FLAT);
  s.add(post, CHROME, { base: 1 });
  const box = s.layer();
  box.circle(s.X(18), s.Y(-50 + sh), 2, FLAT);
  s.add(box, PAL.steel, { base: 2 });
  const horn = s.layer();
  s.poly(horn, [[19, -51 + sh], [27, -55 + sh], [27, -45 + sh], [19, -49 + sh]], FLAT);
  s.add(horn, VANILLA, { glint: true });
  const mouth = s.layer();
  s.rect(mouth, 27, -55 + sh, 1, 11, PAL.stone[1]);
  s.paint(mouth);
  if (k > 0) {
    const arcs = s.layer();
    for (const [r, c] of [[4, WHITE], [7, PAL.pink[2]]] as const) {
      for (let dy = -r; dy <= r; dy++) {
        const dx = Math.round(Math.sqrt(r * r - dy * dy) * 0.6);
        if (Math.abs(dy) < r - 1 || (dy + k) % 2 === 0) arcs.set(s.X(28 + dx), s.Y(-50 + sh + dy), c);
      }
    }
    s.paint(arcs);
  }
  return s.finish();
}

// ------------------------------------------------------------------------------------ cone turret

/**
 * The cone at turret step `step` (0 forward … 12 back), anchored at the roof pivot: a waffle
 * cone from the pivot, then chocolate, vanilla and strawberry scoops, and the cherry (dim in the
 * turret strip; the `cherry` strip is its lit overlay).
 */
function coneFrame(step: number, part: 'turret' | 'cherry'): Frame {
  const s = new Sheet(64, 64, 32, 32);
  const a = coneAngle(step);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const P = (d: number, o: number): Pt => [d * ux - o * uy, d * uy + o * ux];
  if (part === 'cherry') {
    const c = s.layer();
    const q = P(23.5, 0);
    c.circle(Math.round(s.X(q[0])), Math.round(s.Y(q[1])), 2, FLAT);
    s.add(c, CHERRY, { base: 2, glint: true });
    const g = q;
    s.dot(Math.round(g[0]) - 1, Math.round(g[1]) - 1, WHITE);
    return s.finish();
  }
  const m = s.layer();
  m.circle(s.X(0), s.Y(0), 2, FLAT);
  s.add(m, CHROME, { glint: true });
  // Waffle cone with a diagonal grid in its own frame.
  const c = s.layer();
  s.poly(c, [P(0, -1), P(0, 1), P(11, 5), P(11, -5)], FLAT);
  shadeLayer(c, WAFFLE);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if ((c.get(x, y) & 255) === 0) continue;
      const dx = x - s.ox;
      const dy = y - s.oy;
      const d = dx * ux + dy * uy;
      const o = -dx * uy + dy * ux;
      if (Math.round(d + o) % 4 === 0 || Math.round(d - o) % 4 === 0) c.set(x, y, WAFFLE[1]);
    }
  }
  s.comp.add(c, { ramp: WAFFLE });
  const scoop = (d: number, r: number, ramp: Ramp): void => {
    const L = s.layer();
    const q = P(d, 0);
    L.circle(Math.round(s.X(q[0])), Math.round(s.Y(q[1])), r, FLAT);
    // Drips on the scoop's lower rim (toward the cone).
    for (const o of [-r + 1, 0, r - 1]) {
      const p = P(d - r + 0.5, o);
      L.set(Math.round(s.X(p[0])), Math.round(s.Y(p[1])), FLAT);
    }
    s.add(L, ramp, { glint: true });
  };
  scoop(12, 5, CHOC);
  scoop(15.5, 5, VANILLA);
  scoop(19, 4, BERRY);
  // Two sprinkles on the top scoop.
  const sp = P(19.5, -1.5);
  s.dot(Math.round(sp[0]), Math.round(sp[1]), PAL.gold[3]);
  const sp2 = P(18, 2);
  s.dot(Math.round(sp2[0]), Math.round(sp2[1]), PAL.teal[3]);
  const ch = s.layer();
  const q = P(23.5, 0);
  ch.circle(Math.round(s.X(q[0])), Math.round(s.Y(q[1])), 2, FLAT);
  s.add(ch, CHERRY, { base: 1 });
  return s.finish();
}

// ------------------------------------------------------------------------------------ overlays

/** `DOLLOP'S` in sign-writer letters (cream with a teal drop shadow), centre anchor. */
function nameFrame(): Frame {
  const text = "DOLLOP'S";
  const w = microWidth(text) + 1;
  const b = new PixelBuffer(w, 6);
  microText(b, text, 1, 1, PAL.teal[0]);
  microText(b, text, 0, 0, WHITE);
  return { buf: b, ox: w >> 1, oy: 3 };
}

/**
 * Empty gag, frame k (played from 11 down to 0): the shutter rolls up, an OPEN sign swings in
 * the hatch, then the shutter rolls down again. Centre anchor on the hatch, drawn unflipped.
 */
function gagFrame(k: number): Frame {
  const open = Math.min(3, k, 11 - k);
  const b = new PixelBuffer(HATCH.w, HATCH.h);
  // Interior: a mint counter room with a tub rack.
  b.rect(0, 0, b.w, b.h, PAL.teal[1]);
  b.rect(0, b.h - 3, b.w, 3, PAL.teal[0]);
  for (let x = 2; x < b.w - 2; x += 5) {
    b.rect(x, b.h - 5, 3, 2, x % 10 === 2 ? PAL.pink[2] : PAL.cloth[2]);
  }
  if (open >= 2) {
    // The OPEN sign on two strings, swinging 1 px.
    const sw = k % 2 === 0 ? 0 : 1;
    const sx = 4 + sw;
    b.rect(sx, 2, 19, 8, WHITE);
    b.strokeRect(sx, 2, 19, 8, PAL.red[1]);
    microText(b, 'OPEN', sx + 2, 3, PAL.red[2]);
    b.set(sx + 4, 1, PAL.stone[2]);
    b.set(sx + 14, 1, PAL.stone[2]);
  }
  // The rolled shutter: its slats cover the hatch from the top down to its bottom edge.
  const shut = Math.round(HATCH.h * (1 - open / 3));
  const top = open === 3 ? 2 : shut;
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < b.w; x++) b.set(x, y, y === top - 1 ? VANILLA[0] : y % 2 === 1 ? VANILLA[1] : VANILLA[2]);
  }
  return { buf: b, ox: HATCH.w >> 1, oy: HATCH.h >> 1 };
}

function wreckFrame(): Frame {
  const body = vanBody(true);
  const wl = wheelFrame(0);
  const stump = coneFrame(2, 'turret');
  // Cone knocked flat, cracked: use the forward-up cone, scorched below.
  const f = stackFrames(96, 72, 48, 64, [
    [stump, SUNDAE.pivot[0], SUNDAE.pivot[1] + 4],
    [body, 0, 3],
    [wl, SUNDAE.wheels[0], SUNDAE.wheelY],
    [wl, SUNDAE.wheels[1], SUNDAE.wheelY + 1],
  ]);
  return scorch(f, 3);
}

/** Whole van at rest (cone forward), for the base class and the sheets. */
function wholeVan(phase: number): Frame {
  const cab = cabFrame();
  const wl = wheelFrame(phase);
  return stackFrames(96, 76, 48, 66, [
    [cab, 0, 0],
    [vanBody(false), 0, 0],
    [wl, SUNDAE.wheels[0], SUNDAE.wheelY],
    [wl, SUNDAE.wheels[1], SUNDAE.wheelY],
    [speakerFrame(0), 0, 0],
    [coneFrame(2, 'turret'), SUNDAE.pivot[0], SUNDAE.pivot[1]],
  ]);
}

// ------------------------------------------------------------------------------------ fx

function noteFrame(k: number): Frame {
  const b = new PixelBuffer(9, 11);
  const c = k === 0 ? PAL.pink[2] : PAL.teal[2];
  if (k === 0) {
    // Eighth note.
    b.circle(3, 8, 2, c);
    b.rect(5, 1, 1, 8, c);
    b.rect(6, 2, 1, 1, c);
    b.rect(7, 3, 1, 2, c);
  } else {
    // Two beamed notes.
    b.circle(2, 8, 1, c);
    b.circle(6, 7, 1, c);
    b.rect(3, 2, 1, 6, c);
    b.rect(7, 1, 1, 6, c);
    b.rect(3, 1, 5, 2, c);
  }
  b.set(2, 7, WHITE);
  return center(b.outline(INK));
}

const SCOOPS: readonly Ramp[] = [CHOC, VANILLA, BERRY];

function scoopFrame(k: number): Frame {
  const b = new PixelBuffer(12, 11);
  blob(b, 6, 5, 4, SCOOPS[k], { glint: true });
  // Drippy lower rim.
  for (const x of [3, 6, 9]) b.set(x, 9, SCOOPS[k][1]);
  return center(b.outline(INK));
}

/** Ice-cream splat: a white flash, flying blobs and ice crystals that spread to r 24, drips. */
function splatFrame(k: number): Frame {
  const W = 60;
  const H = 46;
  const b = new PixelBuffer(W, H);
  const cx = W >> 1;
  const cy = H >> 1;
  const rand = seededRand(31);
  if (k === 0) {
    blob(b, cx, cy, 9, PAL.snow);
    blob(b, cx, cy, 5, [WHITE, WHITE, WHITE, WHITE]);
  } else if (k < 4) {
    // The splat itself: a melting vanilla puddle with a strawberry heart, sinking as it spreads.
    blob(b, cx, cy + k, 8 - k, VANILLA);
    blob(b, cx - 1, cy + k - 1, 5 - k, BERRY);
  }
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rand() * 0.4;
    const dist = 4 + k * 4.2 + rand() * 4;
    const r = Math.max(0, 3 - Math.floor(k / 2) + (rand() < 0.4 ? 1 : 0));
    const x = cx + Math.cos(ang) * Math.min(24, dist);
    const y = cy + Math.sin(ang) * Math.min(20, dist) * 0.85 + (k > 2 ? (k - 2) * 1.5 : 0);
    const ramp = i % 4 === 3 ? PAL.sky : SCOOPS[i % 3];
    if (k >= 5 && i % 2 === 0) continue;
    if (r === 0) b.rect(Math.round(x), Math.round(y), 2, 2, ramp[2]);
    else blob(b, x, y, r, ramp);
  }
  return center(b.outline(INK));
}

function bitsFrame(k: number): Frame {
  const b = new PixelBuffer(6, 6);
  if (k < 3) {
    const r = SCOOPS[k];
    b.rect(1, 1, 3, 3, r[2]);
    b.set(1, 1, r[3]);
    b.set(3, 3, r[1]);
  } else {
    const c = [PAL.pink[2], PAL.gold[3], PAL.teal[3]][k - 3];
    b.rect(1, 2, 4, 2, c);
  }
  return center(b.outline(INK));
}

// ------------------------------------------------------------------------------------ shots

/** One sprinkle colour: a 6 px rounded rod along the flight direction. */
function sprinkleStrip(ramp: Ramp): () => Frame[] {
  return () =>
    directionStrip((a) => {
      const b = new PixelBuffer(11, 11);
      const dx = Math.cos(a) * 2.5;
      const dy = Math.sin(a) * 2.5;
      b.capsule(Math.round(5 - dx), Math.round(5 - dy), Math.round(5 + dx), Math.round(5 + dy), 2, ramp[2]);
      // A light fleck on the rear upper half.
      b.set(Math.round(5 - dx * 0.5), Math.round(5 - dy * 0.5) - (Math.abs(dy) < 2 ? 0 : 0), ramp[3]);
      return b;
    });
}

/** The mortar shell: a frozen vanilla scoop with a pink crown and sprinkles, tumbling. */
function shellFrame(k: number): Frame {
  const b = new PixelBuffer(13, 13);
  blob(b, 6, 6, 4, VANILLA, { glint: true });
  const a = (k / 4) * Math.PI * 2 - Math.PI / 2;
  const L = new PixelBuffer(13, 13);
  L.circle(Math.round(6 + Math.cos(a) * 2), Math.round(6 + Math.sin(a) * 2), 3, FLAT);
  // Clip the crown to the scoop.
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if ((b.get(x, y) & 255) === 0) L.set(x, y, 0);
  shadeLayer(L, BERRY);
  b.blit(L, 0, 0);
  const sp = [PAL.gold[3], PAL.teal[3], PAL.sky[2]];
  for (let i = 0; i < 3; i++) {
    const q = a + 2 + i * 1.3;
    b.set(Math.round(6 + Math.cos(q) * 2.5), Math.round(6 + Math.sin(q) * 2.5), sp[i]);
  }
  // The cherry rides on the crown.
  b.set(Math.round(6 + Math.cos(a) * 4), Math.round(6 + Math.sin(a) * 4), PAL.red[2]);
  return center(b.outline(INK));
}

// ------------------------------------------------------------------------------------ register

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const STEPS = SUNDAE.turretMax - SUNDAE.turretMin + 1;

defineSprite(`${A}/cab`, () => [cabFrame()]);
defineSprite(`${A}/body`, () => [vanBody(false), vanBody(true)]);
defineSprite(`${A}/wheels`, () => range(4).map(wheelFrame), { ticksPerFrame: 3 });
defineSprite(`${A}/special`, () => range(3).map(speakerFrame), { ticksPerFrame: 4 });
defineSprite(`${A}/turret`, () => range(STEPS).map((i) => coneFrame(i + SUNDAE.turretMin, 'turret')));
defineSprite(`${A}/cherry`, () => range(STEPS).map((i) => coneFrame(i + SUNDAE.turretMin, 'cherry')));
defineSprite(`${A}/name`, () => [nameFrame()]);
defineSprite(`${A}/empty-gag`, () => range(12).map(gagFrame), { ticksPerFrame: 8 });
defineSprite(`${A}/wreck`, () => [wreckFrame()]);
defineSprite(`${A}/idle`, () => [wholeVan(0)]);
defineSprite(`${A}/move`, () => range(4).map(wholeVan), { ticksPerFrame: 3 });
defineSprite(`${A}/note`, () => [noteFrame(0), noteFrame(1)], { ticksPerFrame: 11 });
defineSprite(`${A}/scoop`, () => range(3).map(scoopFrame));
defineSprite(`${A}/splat`, () => range(6).map(splatFrame), { ticksPerFrame: 4, loop: false });
defineSprite(`${A}/bits`, () => range(6).map(bitsFrame));

const SPRINKLE_RAMPS: readonly Ramp[] = [BERRY, PAL.gold, MINT, PAL.sky, VANILLA];
ART.sprinkles.forEach((id, i) => defineSprite(id, sprinkleStrip(SPRINKLE_RAMPS[i])));
defineSprite(ART.sundaeShell, () => range(4).map(shellFrame), { ticksPerFrame: 4 });

/** Exported for tests: the colour of each sprinkle strip. */
export const SPRINKLE_COLOURS: readonly Color[] = SPRINKLE_RAMPS.map((r) => r[2]);
