/**
 * `machine/parade-float/…` — the Legion parade float (GDD §9.5, m4-b): a crimson stage on
 * hidden wheels, a gold tassel skirt, bunting and the Legion crest on the front panel, a mast
 * with a pennant at the back (a `float` hostage is tied to it), and a giant instrument at the
 * nose: a brass tuba (`variant: 'tuba'`) or a bass drum with crossed mallets (`'drum'`).
 *
 * Feet anchor = the road under the middle, facing right (the instrument at +x). The deck (the
 * solid's top, where riders stand) is 42 px above the road (`FLOAT.deckH`); the riders stand at
 * x −30 and −6, the mast is at x −40.
 * Strips: `tuba`, `drum` (4, bunting and fringe sway, wheels turn), `tuba-dmg`, `drum-dmg`,
 * `wreck` (1, the burnt chassis without its deck), `topper-tuba`, `topper-drum` (4 tumbling
 * frames each: the instrument bouncing off the wreck).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { wheel } from '../../../art/machines';
import { bunting, burnt, crest, dented, frame, fringe, horn, PENNANTS_ON_RED, slab } from './kit.art';

const A = 'machine/parade-float';
const W = 102;
const H = 92;
const OX = 51;
const OY = H - 1;
const X = (x: number): number => OX + x;
const Y = (y: number): number => OY + y;
const DECK = -42;

export type FloatVariant = 'tuba' | 'drum';

/** The giant tuba: a coiled brass body standing on the deck with its bell up and forward. */
function tuba(b: PixelBuffer, x: number, y: number): void {
  const g = PAL.gold;
  // The coil: a fat brass ring (body) with a darker hole.
  b.circle(x + 12, y - 16, 11, g[1]);
  b.circle(x + 11, y - 17, 10, g[2]);
  b.circle(x + 10, y - 18, 6, g[3]);
  b.circle(x + 12, y - 16, 5, g[1]);
  b.circle(x + 12, y - 16, 3, PAL.brown[0]);
  // The bell tube rising up and forward to a huge mouth.
  horn(b, x + 8, y - 22, -1.05, 26, 3, 12, { flare: 2.2, depth: 3 });
  // Valves: three steel pistons with pearl caps on the side of the coil.
  for (let k = 0; k < 3; k++) {
    const vx = x + 1 + k * 3;
    b.rect(vx, y - 30, 2, 6, PAL.steel[2]);
    b.set(vx, y - 30, PAL.steel[4]);
    b.set(vx, y - 31, PAL.cloth[3]);
  }
  // The stand: a little crimson plinth with a gold rim.
  b.rect(x + 2, y - 4, 22, 4, PAL.red[1]);
  b.hline(x + 2, x + 23, y - 4, g[3]);
}

/** The giant bass drum, face on, on a stand: white head with a crimson note, crimson rim, gold hoop. */
function drum(b: PixelBuffer, cx: number, y: number): void {
  const g = PAL.gold;
  const cy = y - 22;
  b.circle(cx, cy, 17, PAL.red[1]);
  b.circle(cx - 1, cy - 1, 16, PAL.red[2]);
  b.circle(cx, cy, 14, g[1]);
  b.circle(cx - 1, cy - 1, 13, g[3]);
  b.circle(cx, cy, 12, PAL.cloth[2]);
  b.circle(cx - 2, cy - 2, 8, PAL.cloth[3]);
  // Tension lugs around the rim.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    b.set(Math.round(cx + Math.cos(a) * 15.5), Math.round(cy + Math.sin(a) * 15.5), g[3]);
  }
  // A big crimson eighth note painted on the head, drawn mirrored: floats drive left (the
  // sprite is flipped), so on the road the note reads the right way round.
  b.ellipse(cx + 1, cy + 2, 8, 6, PAL.red[2]);
  b.hline(cx + 4, cx + 7, cy + 3, PAL.red[3]);
  b.rect(cx - 1, cy - 9, 2, 14, PAL.red[2]);
  b.line(cx - 2, cy - 9, cx - 6, cy - 4, PAL.red[2]);
  b.line(cx - 2, cy - 8, cx - 6, cy - 3, PAL.red[1]);
  // The stand: two gold legs and a crimson plinth.
  b.line(cx - 10, cy + 13, cx - 13, y - 3, g[2]);
  b.line(cx + 10, cy + 13, cx + 13, y - 3, g[1]);
  b.rect(cx - 15, y - 3, 31, 3, PAL.red[1]);
  b.hline(cx - 15, cx + 15, y - 3, g[3]);
}

function floatBody(variant: FloatVariant, phase: number): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const red = PAL.red;
  const gold = PAL.gold;
  // Wheels peek out under the skirt.
  for (const wx of [-34, 34]) b.blit(wheel(4, phase, { tyre: 'black', rim: 'gold' }), X(wx - 4), Y(-9));
  // The stage box, a wooden deck edge on top, a white scalloped trim under it.
  slab(b, X(-48), Y(DECK), 97, 36, 'red', 1);
  b.hline(X(-48), X(48), Y(DECK), PAL.brown[3]);
  b.hline(X(-48), X(48), Y(DECK + 1), PAL.brown[1]);
  for (let x = -47; x <= 47; x++) {
    const s = ((x + 48) % 6) / 5;
    const dy = s < 0.5 ? 0 : 1;
    b.set(X(x), Y(DECK + 2), PAL.cloth[3]);
    b.set(X(x), Y(DECK + 3 + dy), (x + 48) % 6 === 0 ? red[2] : PAL.cloth[2]);
    if (dy === 0) b.set(X(x), Y(DECK + 4), PAL.cloth[1]);
  }
  // Panels: gold frames, bunting swag across, the crest medallion in the middle.
  b.strokeRect(X(-44), Y(DECK + 8), 40, 16, gold[2]);
  b.strokeRect(X(4), Y(DECK + 8), 40, 16, gold[2]);
  b.hline(X(-43), X(-6), Y(DECK + 9), gold[1]);
  b.hline(X(5), X(42), Y(DECK + 9), gold[1]);
  bunting(b, X(-46), X(46), Y(DECK + 5), 5, PENNANTS_ON_RED, 6, phase);
  b.circle(X(0), Y(DECK + 16), 6, gold[1]);
  b.circle(X(-1), Y(DECK + 15), 5, gold[3]);
  crest(b, X(0), Y(DECK + 16));
  // Big gold lettering dots: a row of studs like marquee lights (alternate lit by the phase).
  for (let x = -42; x <= 42; x += 6) b.set(X(x), Y(DECK + 26), (x / 6 + phase) % 2 === 0 ? gold[3] : gold[1]);
  // The gold tassel skirt, down to just over the road.
  fringe(b, X(-48), X(48), Y(-12), 8, phase);
  // The mast at the back: a gold pole with a pennant and a ball on top.
  const mx = X(-40);
  b.vline(mx, Y(DECK - 38), Y(DECK - 1), gold[2]);
  b.vline(mx + 1, Y(DECK - 38), Y(DECK - 1), gold[1]);
  b.circle(mx, Y(DECK - 40), 1, gold[3]);
  for (let k = 0; k < 14; k++) {
    const half = Math.round(3.5 * (1 - k / 14));
    const wave = Math.round(Math.sin((k + phase * 2) * 0.6) * (k / 14) * 2);
    for (let j = -half; j <= half; j++) b.set(mx + 2 + k, Y(DECK - 34) + j + wave, j === -half ? gold[3] : j === half ? red[0] : red[2]);
  }
  // A bunting garland from the mast top to the instrument.
  bunting(b, mx + 2, X(variant === 'tuba' ? 26 : 22), Y(DECK - 30), 6, [gold[2], PAL.snow[3], red[3]], 6, phase + 1);
  if (variant === 'tuba') tuba(b, X(16), Y(DECK));
  else drum(b, X(28), Y(DECK));
  return b;
}

function floatFrame(variant: FloatVariant, phase: number): Frame {
  return frame(floatBody(variant, phase).outline(INK), OX, OY);
}

/** The burnt chassis: the skirt, the wheels and a broken stub of the stage. */
function wreckFrame(): Frame {
  const b = new PixelBuffer(W, H);
  for (const wx of [-34, 34]) b.blit(wheel(4, 0, { tyre: 'black', rim: 'steel' }), X(wx - 4), Y(-9));
  slab(b, X(-48), Y(-22), 97, 16, 'red', 1);
  // A jagged broken top edge.
  for (let x = -48; x <= 48; x++) {
    const cut = Math.round(Math.abs(Math.sin(x * 0.7) * 3 + Math.sin(x * 0.23) * 3));
    for (let y = -22; y < -22 + cut; y++) b.set(X(x), Y(y), 0);
  }
  fringe(b, X(-48), X(48), Y(-12), 8, 0);
  // The stump of the mast.
  b.vline(X(-40), Y(-30), Y(-20), PAL.gold[1]);
  return frame(burnt(b.outline(INK), 9, 10), OX, OY);
}

/** Just the instrument (the topper that bounces off), feet anchor. */
function topper(variant: FloatVariant): PixelBuffer {
  const b = new PixelBuffer(44, 46);
  if (variant === 'tuba') tuba(b, 4, 44);
  else drum(b, 22, 44);
  return b.outline(INK);
}

function tumble(variant: FloatVariant): PixelBuffer[] {
  const p = topper(variant);
  return [0, 1, 2, 3].map((q) => p.rotated((q * Math.PI) / 2));
}

export function defineFloatArt(): void {
  for (const v of ['tuba', 'drum'] as const) {
    defineSprite(`${A}/${v}`, () => [0, 1, 2, 3].map((p) => floatFrame(v, p)), { ticksPerFrame: 10 });
    defineSprite(`${A}/${v}-dmg`, () => [0, 1, 2, 3].map((p) => frame(dented(floatFrame(v, p).buf, 0.6, 8), OX, OY)), { ticksPerFrame: 10 });
    defineSprite(`${A}/topper-${v}`, () => tumble(v), { ticksPerFrame: 5 });
  }
  defineSprite(`${A}/wreck`, () => [wreckFrame()], { ticksPerFrame: 60 });
}
