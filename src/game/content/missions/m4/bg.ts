/**
 * Mission m4 background generators (GDD §15.5): `neon-signs`, `crowd-barrier`, `subway-tiles`,
 * `opera-hall`, plus `m4-confetti` (a falling confetti layer for the parade, m4-b).
 *
 * Contract (docs/ART_GUIDE.md §7): exactly w × h, horizontally seamless (every shape stays inside
 * the tile or is drawn again at x − w), deterministic per seed, palette colours only. Use layer
 * widths that are multiples of 4.
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import { PixelBuffer } from '../../../../engine/pixel';
import { PAL } from '../../../../engine/palette';
import { defineBgGenerator } from '../../../art/art-registry';
import { bayer, hash2 } from '../../../art/paint';
import { fanfaroniFace, NEON, neonPanel } from './paint';

type Params = Readonly<Record<string, unknown>>;

function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function strs(p: Params, k: string, d: readonly string[]): readonly string[] {
  const v = p[k];
  return Array.isArray(v) && v.every((s) => typeof s === 'string') ? (v as string[]) : d;
}

/** Wrapped pixel write (seamless tiles). */
function setW(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (y < 0 || y >= b.h) return;
  b.set(((Math.round(x) % b.w) + b.w) % b.w, y, c);
}

function rectW(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setW(b, xx, yy, c);
}

const NEON_SETS = [NEON.pink, NEON.cyan, NEON.gold, NEON.pink, NEON.cyan] as const;

// ------------------------------------------------------------------------------- neon-signs

/**
 * neon-signs — a row of night shop fronts with lit windows and neon signs (alleys between them
 * let the far skyline through). Params: `signs` (texts), `crossed` (a painted-over sign, e.g.
 * `LITTLE HUSHING`), `top` (highest roof, px, 34), `low` (lowest roof, 84), `billboards` (true:
 * rooftop billboards of Fanfaroni instead of shop fronts; m4-c2), `ramp` (facade colours).
 */
function neonSigns(w: number, h: number, p: Params, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  if (p.billboards === true) return billboards(b, p, seed);
  const signs = strs(p, 'signs', ['FANFARONI LAUNDRY', 'FANFARONI BAKERY', 'FANFARONI AVENUE']);
  const crossed = typeof p.crossed === 'string' ? p.crossed : '';
  const top = num(p, 'top', 34);
  const low = num(p, 'low', 84);
  const facade = [PAL.ink[1], PAL.navy[0], PAL.purple[0], PAL.navy[1]];
  const all = crossed ? [...signs, crossed] : [...signs];
  // One building per sign; the rest of the tile is split into plain buildings and alleys.
  const n = Math.max(all.length, 3);
  const slot = Math.floor(w / n);
  for (let i = 0; i < n; i++) {
    const alley = 10 + Math.floor(hash2(i, 7, seed) * 18);
    const x0 = i * slot + Math.floor(alley / 2);
    const bw = slot - alley;
    const by = Math.round(top + hash2(i, 3, seed) * (low - top));
    // Facade: dark brick with a slightly lit left edge, a cornice, dithered toward the street.
    for (let y = by; y < h; y++) {
      for (let x = x0; x < x0 + bw; x++) {
        let v = 1 + ((x - x0) % 16 === 0 ? 1 : 0);
        if (y < by + 3) v = 3;
        if (y > by + 3 && bayer(x, y) < (y - by) / (h - by) * 0.6) v = 0;
        b.set(x, y, facade[Math.min(3, v)]);
      }
    }
    b.hline(x0, x0 + bw - 1, by, PAL.purple[1]);
    // Warm windows in a 10×14 grid (some dark, some with a figure).
    for (let wy = by + 10; wy < h - 60; wy += 14) {
      for (let wx = x0 + 6; wx < x0 + bw - 10; wx += 12) {
        const k = hash2(wx, wy, seed);
        // Muted warm light (the actors in front must stay the brightest thing on screen).
        const c = k < 0.3 ? PAL.gold[0] : k < 0.42 ? PAL.rust[1] : PAL.ink[0];
        b.rect(wx, wy, 6, 8, c);
        if (k < 0.3) {
          b.hline(wx, wx + 5, wy, PAL.gold[1]);
          if (k < 0.12) b.rect(wx + 2, wy + 3, 2, 5, PAL.ink[1]);
        }
        b.hline(wx - 1, wx + 6, wy + 8, PAL.stone[0]);
      }
    }
    // The neon sign (centred on the building).
    const text = all[i];
    if (text) {
      const neon = NEON_SETS[(i + seed) % NEON_SETS.length];
      const isCrossed = text === crossed;
      const font = measure(text, 'big') + 10 <= bw - 4 ? 'big' : 'small';
      const tw = measure(text, font) + 10;
      const sx = x0 + Math.max(2, Math.floor((bw - tw) / 2));
      const sy = by + 14 + Math.floor(hash2(i, 5, seed) * 18);
      neonPanel(b, sx, sy, text, neon, { font, crossed: isCrossed });
      // A glowing halo on the facade around a lit sign.
      if (!isCrossed) {
        for (let y = sy - 3; y < sy + 23; y++) {
          for (let x = sx - 3; x < sx + tw + 3; x++) {
            if (b.get(x, y) === facade[1] || b.get(x, y) === facade[2]) {
              if (bayer(x, y) < 0.35) b.set(x, y, neon[0]);
            }
          }
        }
      }
    }
    // A striped awning over the shop door near the street.
    const ay = h - 66;
    for (let x = x0 + 4; x < x0 + bw - 4; x++) {
      const stripe = ((x - x0) >> 2) % 2 === 0 ? PAL.red[0] : PAL.stone[1];
      b.vline(x, ay, ay + 4, stripe);
      b.set(x, ay + 5, (x & 1) === 0 ? stripe : PAL.ink[0]);
    }
  }
  return b.touch();
}

/** m4-c2: rooftop billboards of the Grand Marshal on stilts, over a row of low roofs. */
function billboards(b: PixelBuffer, p: Params, seed: number): PixelBuffer {
  const w = b.w;
  const h = b.h;
  const roof = num(p, 'roof', 120);
  const slogans = strs(p, 'signs', ['HIS LOUDNESS\nIS LISTENING', 'APPLAUD\nLOUDER', 'STAND UP\nSTRAIGHT']);
  // Low roofs: a band of chimneys and parapets.
  for (let x = 0; x < w; x++) {
    const bump = hash2(x >> 4, 1, seed) < 0.3 ? 6 : 0;
    for (let y = roof - bump; y < h; y++) b.set(x, y, y === roof - bump ? PAL.purple[0] : PAL.ink[1]);
  }
  const n = slogans.length;
  const slot = Math.floor(w / n);
  for (let i = 0; i < n; i++) {
    // Far boards: smaller than the rooftop billboards in front (decor) and dimmed, so the
    // playfield boards read as the near ones.
    const bw = 84;
    const bh = 46;
    const x0 = i * slot + Math.floor((slot - bw) / 2);
    const y0 = roof - bh - 26 - Math.floor(hash2(i, 2, seed) * 16);
    // Stilts and a catwalk.
    for (const sx of [x0 + 10, x0 + bw - 14]) b.rect(sx, y0 + bh, 3, roof - (y0 + bh), PAL.ink[1]);
    b.rect(x0 + 4, y0 + bh + 2, bw - 8, 2, PAL.steel[0]);
    // The board: dark frame, a dusky painted background, the face on the left, the slogan.
    b.rect(x0, y0, bw, bh, PAL.ink[1]);
    b.rect(x0 + 2, y0 + 2, bw - 4, bh - 4, PAL.stone[1]);
    b.rect(x0 + 2, y0 + bh - 10, bw - 4, 8, PAL.red[0]);
    fanfaroniFace(b, x0 + 22, y0 + 24, 1.4, (i % 3) - 1);
    drawText(b, slogans[i], x0 + 40, y0 + 8, { font: 'small', color: PAL.red[0] });
    // Night shade: dither the board toward the sky so it sits behind the playfield.
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) if (bayer(x, y) < 0.45) b.set(x, y, PAL.navy[0]);
    // Lamps on top lighting the board.
    for (let lx = x0 + 12; lx < x0 + bw - 8; lx += 28) {
      b.rect(lx, y0 - 3, 4, 2, PAL.steel[1]);
      b.set(lx + 1, y0 - 1, PAL.gold[1]);
    }
  }
  return b.touch();
}

// ------------------------------------------------------------------------------- crowd-barrier

/**
 * crowd-barrier — steel crowd barriers along the boulevard with cheering silhouettes behind
 * them (arms up, little crimson flags). Params: `y` (street line, 176), `rows` (2).
 */
function crowdBarrier(w: number, h: number, p: Params, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const ground = Math.round(num(p, 'y', 176));
  const rows = Math.max(1, Math.round(num(p, 'rows', 2)));
  const tones = [PAL.navy[0], PAL.purple[0], PAL.ink[1], PAL.navy[1]];
  for (let row = 0; row < rows; row++) {
    const base = ground - 6 - row * 8;
    for (let x = 4 + row * 5; x < w; x += 9) {
      const k = hash2(x, row, seed);
      const c = tones[(row * 2 + Math.floor(k * 3)) % tones.length];
      const hgt = 22 + Math.floor(k * 8);
      const top = base - hgt;
      rectW(b, x - 3, top + 7, 7, hgt - 7, c);
      for (let dy = 0; dy < 7; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + (dy - 3) * (dy - 3) <= 9) setW(b, x + dx, top + dy, c);
      // Arms up (cheering) or a flag on a stick.
      if (k < 0.55) {
        for (let i = 0; i < 6; i++) {
          setW(b, x - 4 - (i >> 2), top + 9 - i, c);
          setW(b, x + 4 + (i >> 2), top + 9 - i, c);
        }
      } else if (k < 0.75) {
        for (let i = 0; i < 12; i++) setW(b, x + 4, top + 10 - i, PAL.stone[1]);
        rectW(b, x + 5, top - 2, 6, 4, PAL.red[1]);
        setW(b, x + 5, top - 2, PAL.gold[2]);
      }
    }
  }
  // The barriers: two rails, feet and vertical bars, steel with highlights.
  const bt = ground - 18;
  for (let x = 0; x < w; x++) {
    const seg = x % 48;
    if (seg === 46 || seg === 47) continue;
    setW(b, x, bt, PAL.steel[3]);
    setW(b, x, bt + 1, PAL.steel[2]);
    setW(b, x, bt + 12, PAL.steel[2]);
    if (seg % 4 === 0) for (let y = bt + 2; y < bt + 12; y++) setW(b, x, y, PAL.steel[1]);
    if (seg === 2 || seg === 43) for (let y = bt + 13; y < ground; y++) setW(b, x, y, PAL.steel[1]);
    // A hanging crimson banner every other barrier.
    if ((x / 48 | 0) % 2 === 0 && seg > 12 && seg < 34) for (let y = bt + 2; y < bt + 11; y++) setW(b, x, y, seg === 13 || seg === 33 ? PAL.gold[1] : PAL.red[1]);
  }
  return b.touch();
}

// ------------------------------------------------------------------------------- confetti

/**
 * m4-confetti — sparse confetti pixels on a transparent tile (use it with `repeatY` and a
 * `driftY` so it keeps falling). Params: `count` (60).
 */
function confetti(w: number, h: number, p: Params, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const n = Math.round(num(p, 'count', 60));
  const cols = [PAL.pink[2], PAL.gold[2], PAL.teal[3], PAL.snow[2], PAL.red[2]];
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 1, seed) * w);
    const y = Math.floor(hash2(i, 2, seed) * h);
    const c = cols[i % cols.length];
    setW(b, x, y, c);
    if (hash2(i, 3, seed) < 0.5) setW(b, x + 1, y, c);
    else if (y + 1 < h) setW(b, x, y + 1, c);
  }
  return b.touch();
}

// ------------------------------------------------------------------------------- subway-tiles

/**
 * subway-tiles — white tiled station walls (muted so the actors read), a crimson trim band,
 * FANFARONI posters and enamel name plates; the track pit wall below the platform line is dark.
 * Params: `y0` (top of the wall, 40), `y1` (platform line, 152), `name` (station name).
 */
function subwayTiles(w: number, h: number, p: Params, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const y0 = Math.round(num(p, 'y0', 40));
  const y1 = Math.round(num(p, 'y1', 152));
  const name = typeof p.name === 'string' ? p.name : 'FANFARONI SQ.';
  const tile = PAL.stone[3];
  const tileLit = PAL.snow[0];
  const grout = PAL.stone[1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c: Color;
      if (y < y0) c = PAL.ink[1];
      else if (y >= y1) c = (y - y1) % 12 === 0 ? PAL.navy[0] : PAL.ink[1];
      else {
        const ty = (y - y0) % 6;
        const row = Math.floor((y - y0) / 6);
        const tx = (x + (row % 2) * 6) % 12;
        c = ty === 5 || tx === 11 ? grout : ty === 0 ? tileLit : tile;
        // Dado: dark teal tiles in the lower part, a crimson trim above it.
        if (y >= y1 - 30) c = ty === 5 || tx === 11 ? PAL.ink[1] : ty === 0 ? PAL.teal[1] : PAL.teal[0];
        if (y >= y1 - 36 && y < y1 - 32) c = y === y1 - 36 ? PAL.red[2] : PAL.red[1];
        // Grime gathers toward the ceiling.
        if (y < y0 + 10 && bayer(x, y) < (y0 + 10 - y) / 14) c = grout;
      }
      b.set(x, y, c);
    }
  }
  // Cables along the track pit wall.
  for (let x = 0; x < w; x++) {
    const sag = Math.round(2 * Math.sin((x / w) * Math.PI * 2 * 4));
    b.set(x, y1 + 8 + sag, PAL.steel[0]);
    b.set(x, y1 + 12 + sag, PAL.brown[0]);
  }
  // Posters and name plates alternate every 128 px.
  for (let i = 0; i * 128 < w; i++) {
    const cx = i * 128 + 64;
    if (i % 2 === 0) {
      const px = cx - 22;
      const py = y0 + 22;
      b.rect(px - 1, py - 1, 46, 58, PAL.ink[0]);
      b.rect(px, py, 44, 56, PAL.gold[1]);
      b.rect(px + 2, py + 2, 40, 52, PAL.red[1]);
      fanfaroniFace(b, cx, py + 26, 1.4, 0);
      drawText(b, 'FANFARONI', cx, py + 44, { font: 'small', color: PAL.gold[3], align: 'center' });
      // A torn corner and a scribbled moustache tip.
      b.tri(px + 44, py + 56, px + 34, py + 56, px + 44, py + 46, tile);
      if (hash2(i, 9, seed) < 0.5) b.line(px + 4, py + 4, px + 10, py + 2, PAL.ink[0]);
    } else {
      const tw = measure(name, 'small') + 12;
      const px = cx - Math.floor(tw / 2);
      const py = y0 + 34;
      b.roundRect(px, py, tw, 15, 3, PAL.ink[0]);
      b.roundRect(px + 1, py + 1, tw - 2, 13, 2, PAL.navy[1]);
      b.hline(px + 3, px + tw - 4, py + 2, PAL.sky[1]);
      drawText(b, name, cx, py + 4, { font: 'small', color: PAL.snow[3], align: 'center' });
    }
  }
  return b.touch();
}

// ------------------------------------------------------------------------------- opera-hall

/**
 * opera-hall — the auditorium of the Opera House: crimson velvet walls with folds, two tiers of
 * gold balconies with audience silhouettes, gilt pillars and chandeliers. Params: `tiers` (2).
 */
function operaHall(w: number, h: number, p: Params, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const tiers = Math.max(1, Math.min(3, Math.round(num(p, 'tiers', 2))));
  const top = Math.round(num(p, 'top', 58));
  const gap = Math.round(num(p, 'gap', 46));
  const velvet = [PAL.ink[1], PAL.red[0], PAL.red[1]];
  // Velvet: vertical folds every 16 px (period w), darker toward the floor.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = (x % 16) / 16;
      const v = 1 + Math.sin(f * Math.PI) * 0.9 - (y / h) * 0.6;
      const k = Math.floor(v + (bayer(x, y) - 0.5) * 0.8);
      b.set(x, y, velvet[k < 0 ? 0 : k > 2 ? 2 : k]);
    }
  }
  // Balcony tiers: gold rail fronts with audience heads above them.
  for (let t = 0; t < tiers; t++) {
    const ry = top + t * gap;
    for (let x = 0; x < w; x++) {
      const box = x % 64;
      if (box < 4) continue; // pillars between boxes
      // Heads and shoulders of the audience (some with opera glasses or tall hats).
      const k = hash2(x >> 3, t, seed);
      const hx = (x >> 3) * 8 + 4;
      if (x === hx && box > 6 && box < 60) {
        const tone = k < 0.5 ? PAL.ink[0] : PAL.navy[0];
        b.circle(hx, ry - 9, 3, tone);
        b.rect(hx - 4, ry - 6, 9, 6, tone);
        if (k > 0.85) b.rect(hx - 2, ry - 17, 5, 6, tone);
        if (k < 0.15) b.hline(hx - 2, hx + 2, ry - 10, PAL.gold[2]);
      }
      // The rail front: a gold band with a darker scroll pattern.
      for (let y = ry; y < ry + 10; y++) {
        // Muted gilt (the actors must stay brighter than the hall).
        let c = y === ry ? PAL.gold[1] : y === ry + 9 ? PAL.brown[0] : PAL.gold[0];
        if (y > ry + 2 && y < ry + 8 && (box % 8 === 4 || box % 8 === 5) && y % 2 === 0) c = PAL.orange[0];
        b.set(x, y, c);
      }
      b.set(x, ry + 10, PAL.ink[1]);
    }
  }
  // Gilt pillars between the boxes.
  for (let x0 = 0; x0 < w; x0 += 64) {
    for (let y = 30; y < h; y++) {
      b.set(x0, y, PAL.brown[0]);
      b.set(x0 + 1, y, PAL.gold[1]);
      b.set(x0 + 2, y, PAL.gold[0]);
      b.set(x0 + 3, y, PAL.brown[0]);
    }
  }
  // Small, dim chandeliers far up in the hall (one every 128 px): never mistaken for the stage's
  // real ones (bright crystal, the boss's falling props).
  for (let i = 0; i * 128 < w; i++) {
    const cx = i * 128 + 96;
    b.vline(cx, 0, 6, PAL.brown[0]);
    b.ellipse(cx - 8, 6, 17, 6, PAL.gold[0]);
    b.ellipse(cx - 6, 7, 13, 3, PAL.orange[0]);
    for (let k = -6; k <= 6; k += 4) b.vline(cx + k, 12, 14 + ((k / 4) & 1), PAL.stone[1]);
  }
  // A dark wainscot and a gold dado rail near the floor.
  for (let x = 0; x < w; x++) {
    b.set(x, h - 52, PAL.gold[2]);
    for (let y = h - 51; y < h; y++) b.set(x, y, (x % 32 === 0 || y === h - 51) ? PAL.ink[0] : PAL.brown[0]);
  }
  return b.touch();
}

defineBgGenerator('neon-signs', neonSigns);
defineBgGenerator('crowd-barrier', crowdBarrier);
defineBgGenerator('m4-confetti', confetti);
defineBgGenerator('subway-tiles', subwayTiles);
defineBgGenerator('opera-hall', operaHall);

/** The generator ids this module registers (tests). */
export const M4_BG_IDS = ['neon-signs', 'crowd-barrier', 'm4-confetti', 'subway-tiles', 'opera-hall'] as const;

