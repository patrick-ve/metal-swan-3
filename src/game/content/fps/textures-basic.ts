/**
 * Placeholder raycaster art (group fps-shell; hand-over to group art, docs/design/fps.md §11):
 * simple, palette-only 64 × 64 wall and door textures for every §8.1 id, and plain placeholder
 * billboards for the §4.5 items and §5.1 props. Each id is defined only when nothing else
 * registered it yet, so the real art (content/fps/art.ts) wins whatever the load order; the
 * art group may empty this file once its own ids exist.
 *
 * The banner walls here carry a plain red banner with a white disc only (the real art adds the
 * historical symbol, spec §8.1).
 */
import type { Color } from '../../../engine/color';
import { PAL } from '../../../engine/palette';
import { PixelBuffer, seededRand } from '../../../engine/pixel';
import { defineRayBillboard, defineRayTexture, hasRayBillboard, hasRayTexture, RAY_TEX } from '../../../engine/ray';

const S = RAY_TEX;

function tex(id: string, paint: (b: PixelBuffer) => void): void {
  if (hasRayTexture(id)) return;
  defineRayTexture(id, () => {
    const b = new PixelBuffer(S, S);
    paint(b);
    return b.touch();
  });
}

/** Speckle: `n` single texels of `c` from a fixed seed (deterministic). */
function speckle(b: PixelBuffer, seed: number, n: number, c: Color, x0 = 0, y0 = 0, w = S, h = S): void {
  const r = seededRand(seed);
  for (let i = 0; i < n; i++) b.set(x0 + Math.floor(r() * w), y0 + Math.floor(r() * h), c);
}

function concrete(b: PixelBuffer): void {
  b.fill(PAL.stone[1]);
  speckle(b, 11, 140, PAL.stone[2]);
  speckle(b, 12, 90, PAL.stone[0]);
  // Form-board lines and panel joints.
  for (let y = 0; y < S; y += 8) b.hline(0, S - 1, y, PAL.stone[0]);
  b.rect(0, 0, 1, S, PAL.ink[1]);
  b.rect(0, 31, S, 2, PAL.ink[1]);
  // A rust stain under a bolt.
  b.rect(44, 12, 2, 2, PAL.steel[0]);
  b.rect(44, 14, 2, 10, PAL.rust[1]);
  b.rect(45, 24, 1, 6, PAL.rust[1]);
}

function banner(b: PixelBuffer, x: number, y0: number, w: number, y1: number): void {
  b.rect(x - 2, y0 - 2, w + 4, 2, PAL.steel[0]); // the rod
  b.rect(x, y0, w, y1 - y0, PAL.red[1]);
  b.rect(x + 1, y0, 1, y1 - y0, PAL.red[2]);
  b.rect(x + w - 2, y0, 1, y1 - y0, PAL.red[0]);
  const cx = x + (w >> 1);
  const cy = y0 + ((y1 - y0) >> 1) - 4;
  b.circle(cx, cy, Math.min(9, (w >> 1) - 3), PAL.snow[2]);
  b.circle(cx, cy, Math.min(9, (w >> 1) - 3), PAL.stone[2], false);
  // Swallow-tail hem.
  for (let i = 0; i < 4; i++) b.hline(x + i, x + w - 1 - i, y1 + i, PAL.red[0]);
}

function brick(b: PixelBuffer, base: Color, lit: Color, dark: Color, mortar: Color): void {
  b.fill(mortar);
  for (let row = 0; row < 8; row++) {
    const off = row & 1 ? 8 : 0;
    for (let col = -1; col < 4; col++) {
      const x = col * 16 + off;
      const y = row * 8;
      for (let xx = 1; xx < 16; xx++) {
        const px = (x + xx + S) % S;
        b.vline(px, y + 1, y + 7, base);
        b.set(px, y + 1, lit);
        b.set(px, y + 7, dark);
      }
    }
  }
  speckle(b, 21, 60, dark);
}

function crates(b: PixelBuffer): void {
  b.fill(PAL.brown[0]);
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const x = cx * 32;
      const y = cy * 32;
      b.rect(x + 1, y + 1, 30, 30, PAL.brown[2]);
      for (let k = 0; k < 30; k += 6) b.hline(x + 1, x + 30, y + 1 + k, PAL.brown[1]);
      b.strokeRect(x + 1, y + 1, 30, 30, PAL.brown[1]);
      b.thickLine(x + 3, y + 28, x + 28, y + 3, 2, PAL.brown[1]);
      b.rect(x + 10, y + 13, 12, 5, PAL.sand[2]); // stencil bar
      b.rect(x + 12, y + 14, 8, 3, PAL.brown[1]);
    }
  }
}

function wood(b: PixelBuffer): void {
  b.fill(PAL.brown[1]);
  for (let x = 0; x < S; x += 16) {
    b.vline(x, 0, S - 1, PAL.brown[0]);
    b.vline(x + 1, 0, S - 1, PAL.brown[2]);
  }
  const r = seededRand(31);
  for (let i = 0; i < 26; i++) {
    const x = 3 + Math.floor(r() * 60);
    const y = Math.floor(r() * 56);
    b.vline(x, y, y + 6 + Math.floor(r() * 8), PAL.brown[0]);
  }
  b.rect(0, 56, S, 8, PAL.brown[0]); // skirting
  b.hline(0, S - 1, 56, PAL.brown[2]);
}

function steel(b: PixelBuffer): void {
  b.fill(PAL.steel[1]);
  for (let py = 0; py < 2; py++) {
    for (let px = 0; px < 2; px++) {
      const x = px * 32;
      const y = py * 32;
      b.hline(x, x + 31, y, PAL.steel[2]);
      b.vline(x, y, y + 31, PAL.steel[2]);
      b.hline(x, x + 31, y + 31, PAL.steel[0]);
      b.vline(x + 31, y, y + 31, PAL.steel[0]);
      for (const [rx, ry] of [[3, 3], [28, 3], [3, 28], [28, 28]] as const) {
        b.set(x + rx, y + ry, PAL.steel[3]);
        b.set(x + rx + 1, y + ry + 1, PAL.steel[0]);
      }
    }
  }
}

function corrugated(b: PixelBuffer): void {
  for (let x = 0; x < S; x++) b.vline(x, 0, S - 1, [PAL.steel[1], PAL.steel[2], PAL.steel[2], PAL.steel[1], PAL.steel[0]][x % 4 === 3 ? 4 : x % 4]);
  b.hline(0, S - 1, 20, PAL.steel[0]);
  b.hline(0, S - 1, 44, PAL.steel[0]);
  speckle(b, 41, 40, PAL.rust[1]);
}

function elevator(b: PixelBuffer): void {
  for (let x = 0; x < S; x++) b.vline(x, 0, S - 1, x & 1 ? PAL.steel[2] : PAL.steel[3]);
  b.vline(0, 0, S - 1, PAL.steel[0]);
  b.hline(0, S - 1, 0, PAL.steel[0]);
  b.hline(0, S - 1, 63, PAL.steel[0]);
  b.hline(0, S - 1, 32, PAL.steel[1]);
}

function switchWall(b: PixelBuffer, on: boolean): void {
  elevator(b);
  b.rect(20, 16, 24, 32, PAL.steel[0]);
  b.strokeRect(20, 16, 24, 32, PAL.ink[1]);
  b.rect(30, 22, 4, 20, PAL.ink[1]); // slot
  const ly = on ? 20 : 36;
  b.rect(26, ly, 12, 5, PAL.stone[3]); // the lever handle
  b.circle(32, 11, 3, on ? PAL.green[3] : PAL.red[2]);
}

function door(b: PixelBuffer, plate: Color | null): void {
  b.fill(PAL.steel[1]);
  for (let y = 4; y < S; y += 8) {
    b.hline(2, 61, y, PAL.steel[2]);
    b.hline(2, 61, y + 1, PAL.steel[0]);
  }
  b.vline(0, 0, S - 1, PAL.ink[1]);
  b.vline(63, 0, S - 1, PAL.ink[1]);
  b.rect(52, 28, 4, 10, PAL.steel[3]); // handle
  if (plate !== null) {
    b.rect(8, 24, 14, 18, plate);
    b.strokeRect(8, 24, 14, 18, PAL.ink[1]);
    b.rect(14, 30, 2, 6, PAL.ink[0]); // keyhole
  }
}

// ----------------------------------------------------------------------------- wall textures

tex('fps/wall/concrete', concrete);
tex('fps/wall/concrete-banner', (b) => {
  concrete(b);
  banner(b, 18, 6, 28, 50);
});
tex('fps/wall/brick', (b) => brick(b, PAL.red[1], PAL.red[2], PAL.red[0], PAL.stone[2]));
tex('fps/wall/brick-notice', (b) => {
  brick(b, PAL.red[1], PAL.red[2], PAL.red[0], PAL.stone[2]);
  b.rect(16, 14, 32, 26, PAL.brown[1]);
  b.rect(18, 16, 28, 22, PAL.sand[3]);
  for (let y = 19; y < 36; y += 3) b.hline(20, 20 + ((y * 7) % 20) + 4, y, PAL.stone[1]);
  b.set(32, 15, PAL.red[2]);
});
tex('fps/wall/crates', crates);
tex('fps/wall/wood', wood);
tex('fps/wall/wood-map', (b) => {
  wood(b);
  b.rect(12, 12, 40, 30, PAL.sand[2]);
  b.strokeRect(12, 12, 40, 30, PAL.brown[0]);
  b.ellipse(18, 16, 14, 10, PAL.olive[2]);
  b.ellipse(34, 26, 12, 12, PAL.olive[2]);
  b.ellipse(22, 30, 8, 6, PAL.olive[1]);
  for (const [x, y] of [[24, 20], [40, 30], [28, 34]] as const) b.rect(x, y, 2, 2, PAL.red[2]);
});
tex('fps/wall/steel', steel);
tex('fps/wall/steel-vent', (b) => {
  steel(b);
  b.rect(16, 20, 32, 24, PAL.ink[1]);
  for (let y = 22; y < 43; y += 3) b.hline(17, 46, y, PAL.steel[2]);
  b.strokeRect(16, 20, 32, 24, PAL.steel[3]);
});
tex('fps/wall/hangar', corrugated);
tex('fps/wall/hangar-banner', (b) => {
  corrugated(b);
  banner(b, 20, 4, 24, 56);
});
tex('fps/wall/freight', (b) => {
  b.fill(PAL.brown[1]);
  for (let y = 8; y < S; y += 8) {
    b.hline(0, S - 1, y, PAL.brown[0]);
    b.hline(0, S - 1, y + 1, PAL.rust[1]);
  }
  speckle(b, 51, 70, PAL.brown[2]);
  b.rect(0, 2, S, 3, PAL.steel[0]); // the door rail
  b.hline(0, S - 1, 2, PAL.steel[2]);
});
tex('fps/wall/tile', (b) => {
  b.fill(PAL.stone[2]);
  for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) {
    b.rect(x + 1, y + 1, 15, 15, PAL.snow[1]);
    b.hline(x + 1, x + 15, y + 1, PAL.snow[2]);
  }
  speckle(b, 61, 20, PAL.stone[1]);
});
tex('fps/wall/cellar', (b) => {
  b.fill(PAL.ink[1]);
  const widths = [14, 18, 12, 20];
  for (let row = 0; row < 6; row++) {
    let x = (row * 7) % 16;
    const y = Math.floor((row * 64) / 6);
    const hh = Math.floor(((row + 1) * 64) / 6) - y;
    for (let k = 0; x < S + 16; k++) {
      const w = widths[(row + k) % 4];
      b.roundRect(x - 16, y + 1, w - 1, hh - 1, 2, (row + k) % 3 ? PAL.stone[0] : PAL.stone[1]);
      x += w;
    }
  }
  // Tile the left edge with the right one.
  for (let y = 0; y < S; y++) b.set(0, y, b.get(63, y));
});
tex('fps/wall/sandbags', (b) => {
  b.fill(PAL.sand[0]);
  for (let row = 0; row < 8; row++) {
    const off = row & 1 ? 10 : 0;
    for (let k = -1; k < 4; k++) {
      const x = k * 20 + off;
      b.roundRect(x + 1, row * 8 + 1, 19, 7, 3, PAL.sand[1]);
      b.hline(x + 3, x + 16, row * 8 + 2, PAL.sand[2]);
    }
  }
});
tex('fps/wall/steel-pipes', (b) => {
  steel(b);
  for (const y of [18, 40]) {
    b.rect(0, y, S, 7, PAL.steel[2]);
    b.hline(0, S - 1, y + 1, PAL.steel[3]);
    b.hline(0, S - 1, y + 6, PAL.steel[0]);
  }
  b.circle(44, 21, 6, PAL.red[1], false);
  b.circle(44, 21, 5, PAL.red[2], false);
  b.rect(43, 20, 3, 3, PAL.red[0]);
});
tex('fps/wall/elevator', elevator);
tex('fps/wall/switch', (b) => switchWall(b, false));
tex('fps/wall/switch-on', (b) => switchWall(b, true));

// ----------------------------------------------------------------------------- door textures

tex('fps/door/plain', (b) => door(b, null));
tex('fps/door/gold', (b) => door(b, PAL.gold[2]));
tex('fps/door/silver', (b) => door(b, PAL.snow[2]));
tex('fps/door/lift', (b) => {
  elevator(b);
  b.vline(31, 0, S - 1, PAL.ink[1]);
  b.vline(32, 0, S - 1, PAL.steel[1]);
});
tex('fps/door/edge', (b) => {
  b.fill(PAL.steel[0]);
  for (let x = 4; x < S; x += 12) {
    b.vline(x, 0, S - 1, PAL.steel[1]);
    b.vline(x + 1, 0, S - 1, PAL.ink[1]);
  }
});

// -------------------------------------------------------------------------- item / prop stand-ins

function billboard(id: string, paint: (b: PixelBuffer) => void): void {
  if (hasRayBillboard(id)) return;
  defineRayBillboard(id, {
    yaws: 1,
    frames: 1,
    gen: () => {
      const b = new PixelBuffer(64, 64);
      paint(b);
      return b.touch();
    },
  });
}

/** A small box on the floor (the item in the lower third). */
function box(b: PixelBuffer, w: number, h: number, c: Color, lit: Color, dark: Color): void {
  const x = 32 - (w >> 1);
  const y = 63 - h;
  b.rect(x, y, w, h, c);
  b.hline(x, x + w - 1, y, lit);
  b.vline(x + w - 1, y, y + h - 1, dark);
  b.hline(x, x + w - 1, y + h - 1, dark);
}

function key(b: PixelBuffer, c: Color, dark: Color): void {
  b.circle(26, 54, 5, c);
  b.circle(26, 54, 2, 0);
  b.rect(30, 53, 14, 3, c);
  b.rect(40, 56, 2, 4, c);
  b.rect(36, 56, 2, 3, c);
  b.hline(30, 43, 55, dark);
  b.rect(20, 44, 8, 6, PAL.sand[3]); // paper tag
}

billboard('fps/item/key-gold', (b) => key(b, PAL.gold[2], PAL.gold[0]));
billboard('fps/item/key-silver', (b) => key(b, PAL.snow[2], PAL.steel[1]));
billboard('fps/item/golden-record', (b) => {
  b.rect(18, 44, 22, 20, PAL.sand[2]);
  b.circle(38, 54, 9, PAL.gold[2]);
  b.circle(38, 54, 6, PAL.gold[1], false);
  b.circle(38, 54, 2, PAL.red[2]);
});
billboard('fps/item/first-aid', (b) => {
  box(b, 18, 10, PAL.olive[2], PAL.olive[3], PAL.olive[0]);
  b.rect(23, 57, 18, 2, PAL.snow[2]);
});
billboard('fps/item/food', (b) => box(b, 18, 7, PAL.steel[2], PAL.steel[3], PAL.steel[0]));
billboard('fps/item/ration', (b) => box(b, 10, 8, PAL.olive[1], PAL.olive[2], PAL.olive[0]));
billboard('fps/item/blood-pool', (b) => b.ellipse(20, 60, 24, 4, PAL.red[1]));
billboard('fps/item/clip', (b) => box(b, 12, 7, PAL.sand[1], PAL.sand[2], PAL.sand[0]));
billboard('fps/item/clip-drop', (b) => box(b, 8, 3, PAL.gold[1], PAL.gold[2], PAL.gold[0]));
billboard('fps/item/mg', (b) => box(b, 30, 5, PAL.steel[1], PAL.steel[2], PAL.ink[1]));
billboard('fps/item/chaingun', (b) => box(b, 34, 8, PAL.steel[1], PAL.steel[3], PAL.ink[1]));
billboard('fps/item/one-up', (b) => {
  box(b, 14, 10, PAL.snow[2], PAL.snow[3], PAL.stone[2]);
  b.rect(36, 46, 3, 8, PAL.snow[2]);
});
billboard('fps/item/pocket-watch', (b) => b.circle(32, 58, 5, PAL.gold[2]));
billboard('fps/item/tuning-fork', (b) => box(b, 12, 6, PAL.purple[1], PAL.purple[2], PAL.purple[0]));
billboard('fps/item/gold-bars', (b) => box(b, 20, 8, PAL.gold[2], PAL.gold[3], PAL.gold[0]));
billboard('fps/item/music-box', (b) => box(b, 16, 10, PAL.brown[2], PAL.gold[2], PAL.brown[0]));

/** A solid prop: a column `w` wide and `h` tall standing on the floor. */
function column(b: PixelBuffer, w: number, h: number, c: Color, lit: Color, dark: Color): void {
  const x = 32 - (w >> 1);
  const y = 64 - h;
  b.rect(x, y, w, h, c);
  b.vline(x, y, 63, lit);
  b.vline(x + w - 1, y, 63, dark);
}
billboard('fps/prop/barrel', (b) => {
  column(b, 22, 30, PAL.brown[1], PAL.brown[2], PAL.brown[0]);
  for (const y of [38, 48, 58]) b.hline(21, 42, y, PAL.steel[0]);
});
billboard('fps/prop/oil-drum', (b) => {
  column(b, 22, 32, PAL.rust[1], PAL.rust[2], PAL.rust[0]);
  b.hline(21, 42, 44, PAL.steel[0]);
});
billboard('fps/prop/crates', (b) => column(b, 40, 36, PAL.brown[2], PAL.brown[3], PAL.brown[0]));
billboard('fps/prop/pillar', (b) => column(b, 20, 64, PAL.stone[1], PAL.stone[2], PAL.stone[0]));
billboard('fps/prop/table', (b) => {
  b.rect(12, 40, 40, 4, PAL.brown[2]);
  b.rect(14, 44, 3, 20, PAL.brown[0]);
  b.rect(47, 44, 3, 20, PAL.brown[0]);
});
billboard('fps/prop/banner-pole', (b) => {
  b.rect(31, 4, 2, 60, PAL.steel[2]);
  b.rect(33, 6, 16, 26, PAL.red[1]);
  b.circle(41, 18, 5, PAL.snow[2]);
});
billboard('fps/prop/lamp-stand', (b) => {
  b.rect(31, 14, 2, 50, PAL.steel[1]);
  b.rect(26, 8, 12, 7, PAL.gold[2]);
});
billboard('fps/prop/sandbags', (b) => column(b, 44, 18, PAL.sand[1], PAL.sand[2], PAL.sand[0]));
billboard('fps/prop/ceiling-lamp', (b) => {
  b.rect(31, 0, 2, 6, PAL.steel[0]);
  b.rect(26, 6, 12, 4, PAL.gold[3]);
});
billboard('fps/prop/debris', (b) => {
  b.rect(18, 61, 8, 3, PAL.stone[1]);
  b.rect(36, 60, 6, 4, PAL.stone[0]);
});
billboard('fps/prop/chains', (b) => {
  for (let y = 0; y < 30; y += 3) b.set(30 + (y & 2 ? 1 : 0), y, PAL.steel[2]);
});
