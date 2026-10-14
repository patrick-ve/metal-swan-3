/**
 * Content category "fx": sprite definitions only (docs/ARCHITECTURE.md §5.12, §7).
 *
 * All fx sprites are centre-anchored (src/game/fx.ts draws them at the effect position):
 * fx/explosion-s|m|l|xl, fx/smoke-puff (GDD alias fx/smoke), fx/soot-cloud (GDD alias
 * fx/soot), fx/spark, fx/impact, fx/hit-spark (alias fx/hit), fx/dust, fx/splash,
 * fx/debris-<kind> (4 tumbling frames each; kinds metal, wood, rock, dirt, glass, plant, snow,
 * cloth), fx/stun-stars (the older 6-frame dizzy stars; GDD fx/stars-dizzy is in gags.art.ts)
 * and fx/parachute (the Legion's drop canopy). The comedy set of GDD §15.6 (poof, confetti,
 * music-note, steam-puff, helium-cloud, shadow, aim-line, stars-dizzy, flying-shako,
 * stick-on-moustache, snow-puff, ice-cubes): gags.art.ts; fx/tin-feather is the Swan art's. Muzzle flashes
 * fx/muzzle-*: weapons/art.ts.
 *
 * 2× art (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): the explosions in
 * explosion.art.ts (`explosionFramesHi`), the other fx that ams shows in hi.art.ts; the muzzle
 * flashes have theirs next to their 1× art (weapons/art.ts, weapons/shots.art.ts).
 *
 * This module also loads the shared art rigs that register at import time: background
 * generators (bg.ts) and the terrain painter (terrain-art.ts). UI art has its own manifest
 * entry ('ui/art').
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import '../../art/bg';
import '../../art/terrain-art';
import { bayer } from '../../art/paint';
import { cloudFrames, explosionFrames, explosionFramesHi, type ExplosionSpec } from './explosion.art';
import { defineGagSprites } from './gags.art';
// 2× art of the fx that mission ams shows (registers at import).
import './hi.art';

const center = (buf: PixelBuffer): Frame => ({ buf, ox: buf.w >> 1, oy: buf.h >> 1 });

// ------------------------------------------------------------------------------------ explosions

const EXPLOSIONS: ReadonlyArray<[string, ExplosionSpec, number]> = [
  ['s', { radius: 9, frames: 7, seed: 11, puffs: 5 }, 3],
  ['m', { radius: 16, frames: 9, seed: 23, puffs: 7 }, 3],
  ['l', { radius: 26, frames: 10, seed: 37, puffs: 8, chunky: true }, 4],
  ['xl', { radius: 40, frames: 12, seed: 51, puffs: 10, chunky: true }, 4],
];
for (const [size, spec, tpf] of EXPLOSIONS) {
  defineSprite(`fx/explosion-${size}`, () => explosionFrames(spec), { ticksPerFrame: tpf, loop: false, hi: () => explosionFramesHi(spec) });
}

const smokePuff = (): Frame[] => cloudFrames(6, 6, [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]], PAL.ink[1], 5);
const sootCloud = (): Frame[] => cloudFrames(8, 6, [PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.stone[0], PAL.stone[1]], INK, 9);
const cloudOpts = { ticksPerFrame: 5, loop: false } as const;
defineSprite('fx/smoke-puff', smokePuff, cloudOpts);
defineSprite('fx/smoke', smokePuff, cloudOpts);
defineSprite('fx/soot-cloud', sootCloud, cloudOpts);
defineSprite('fx/soot', sootCloud, cloudOpts);

// ------------------------------------------------------------------------------------ small fx

/** Four-point star spark that shrinks (4 frames). */
function sparkFrames(): Frame[] {
  const sizes = [3, 2, 1, 1];
  return sizes.map((s, i) => {
    const b = new PixelBuffer(9, 9);
    const c = 4;
    const col = i < 2 ? PAL.fire[6] : PAL.fire[4];
    b.hline(c - s, c + s, c, PAL.fire[5]);
    b.vline(c, c - s, c + s, PAL.fire[5]);
    b.set(c, c, col);
    if (i === 0) {
      b.set(c - 1, c - 1, PAL.fire[4]);
      b.set(c + 1, c + 1, PAL.fire[4]);
      b.set(c + 1, c - 1, PAL.fire[4]);
      b.set(c - 1, c + 1, PAL.fire[4]);
    }
    return center(b);
  });
}

/** Bullet hits the ground: a flash with dirt kicked up (4 frames). */
function impactFrames(): Frame[] {
  const rows: string[][] = [
    ['...W...', '..WYW..', '.WYOYW.', '..WYW..', '...W...'],
    ['.d...d.', '..dYd..', '.dYOYd.', 'd.dOd.d', '..d.d..'],
    ['d.....d', '.d...d.', '...d...', '.d.d.d.', 'd.....d'],
    ['.......', 'd.....d', '.......', '..d.d..', '.......'],
  ];
  return rows.map((r) => center(ascii(r, { W: PAL.fire[6], Y: PAL.fire[5], O: PAL.fire[3], d: PAL.brown[2] }).padded(1)));
}

/** Hit on an enemy: a bright splintered star pointing back at the shooter (3 frames). */
function hitFrames(): Frame[] {
  const rows: string[][] = [
    ['..W....W', '...W..W.', 'WWWYYW..', '...YW...', '..W..W..', '.W....W.'],
    ['.......Y', '..Y..Y..', '.YYOO...', '...OY...', '..Y..Y..', '........'],
    ['........', '...O....', '..O.O...', '...O....', '........', '........'],
  ];
  return rows.map((r) => center(ascii(r, { W: PAL.fire[6], Y: PAL.fire[5], O: PAL.fire[3] }).padded(1)));
}

/** Dust cloud at the feet: two puffs spreading sideways (4 frames, centre 3 px above ground). */
function dustFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(24, 9);
    const spread = 3 + i * 3;
    const r = [2, 3, 3, 2][i];
    for (const s of [-1, 1]) {
      const cx = 12 + s * spread;
      b.circle(cx, 5, r, PAL.sand[2]);
      if (r > 1) b.circle(cx - 1, 4, r - 1, PAL.sand[3]);
    }
    if (i >= 2) {
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (bayer(x, y) < (i - 1) * 0.35) b.set(x, y, 0);
    }
    // Drawn at ground − 3 (src/game/fx.ts): the puffs' lowest row lands on the row above the ground.
    return { buf: b, ox: 12, oy: 6 };
  });
}

/** Water splash: a crown of water rising and falling back (5 frames). */
function splashFrames(): Frame[] {
  const out: Frame[] = [];
  const W = 26;
  const H = 22;
  for (let i = 0; i < 5; i++) {
    const b = new PixelBuffer(W, H);
    const t = i / 4;
    const hgt = Math.round(Math.sin(Math.min(1, t * 1.6) * Math.PI) * 12) + 2;
    const spread = 3 + Math.round(t * 7);
    // Central column and side arcs.
    for (let k = 0; k < hgt; k++) {
      const y = H - 3 - k;
      const w = Math.max(1, Math.round(2 - k / 6));
      b.hline(13 - w, 13 + w - 1, y, k > hgt - 3 ? PAL.snow[3] : PAL.sky[2]);
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < Math.round(hgt * 0.6); k++) {
        const x = 13 + s * (spread - Math.round(k * 0.3));
        b.set(x, H - 3 - k, k % 3 === 0 ? PAL.snow[3] : PAL.sky[1]);
      }
      // Droplets.
      b.set(13 + s * (spread + 3), H - 4 - Math.round(hgt * 0.7), PAL.snow[2]);
    }
    // Ring on the surface.
    b.hline(13 - spread - 2, 13 + spread + 1, H - 2, PAL.sky[3]);
    out.push({ buf: b.outline(PAL.navy[1]), ox: 13, oy: H - 2 - 6 });
  }
  return out;
}

/** Comic stun stars circling over a head (6 frames; draw at the 'head' point − 8 px). */
function stunFrames(): Frame[] {
  const star = ascii(['.y.', 'yYy', '.y.'], { y: PAL.gold[2], Y: PAL.gold[3] });
  return Array.from({ length: 6 }, (_, i) => {
    const b = new PixelBuffer(22, 10);
    for (let k = 0; k < 3; k++) {
      const a = (i / 6 + k / 3) * Math.PI * 2;
      const x = Math.round(10 + Math.cos(a) * 8);
      const y = Math.round(4 + Math.sin(a) * 2.5);
      const back = Math.sin(a) < 0;
      b.blit(back ? star.clone().recolor((c) => (c === PAL.gold[3] ? PAL.gold[2] : PAL.gold[1])) : star, x - 1, y - 1);
    }
    return center(b.outline(INK));
  });
}

// ------------------------------------------------------------------------------------ parachute

/**
 * The Legion drop canopy (2 frames: full, then flattened by a gust), 34×16 with the outline:
 * a dome of crimson and ivory panels (the Legion colours), lit from the upper left, with a
 * scalloped gold hem. Drawn centre-anchored 8 px below the canopy top; the cords meet the
 * hem at x ±14 (infantry/index.ts draws them).
 */
function parachuteFrames(): Frame[] {
  return [0, 1].map((f) => {
    const W = 32;
    const H = f === 0 ? 14 : 12;
    const b = new PixelBuffer(W, 14);
    const top = 14 - H;
    const cx = (W - 1) / 2;
    for (let y = top; y < 14; y++) {
      // Dome profile: a half ellipse, the hem row the widest.
      const v = (14 - y) / H;
      const half = Math.round(Math.sqrt(Math.max(0, 1 - v * v)) * (W / 2));
      for (let x = Math.round(cx - half + 0.5); x <= Math.round(cx + half - 0.5); x++) {
        // Panels fan out from the apex: 6 gores, alternating crimson and ivory.
        const gore = Math.floor(((x - cx) / Math.max(1, half) + 1) * 3);
        const ivory = gore % 2 === 1;
        // Light from the upper left: lighter on the left half and near the top.
        const lit = (cx - x) / W + (1 - v) * -0.2 + 0.25;
        const shade = lit > 0.35 ? 2 : lit > 0.05 ? 1 : 0;
        const ramp = ivory ? [PAL.snow[0], PAL.snow[1], PAL.snow[2]] : [PAL.red[1], PAL.red[2], PAL.red[3]];
        b.set(x, y, ramp[shade]);
      }
    }
    // Scalloped gold hem (every other pixel dips one row).
    for (let x = 1; x < W - 1; x++) {
      if (!(b.get(x, 13) & 255)) continue;
      b.set(x, 13, x % 4 < 2 ? PAL.gold[2] : PAL.gold[1]);
      if (x % 4 === 1) b.set(x, 12, PAL.gold[3]);
    }
    // The vent at the apex.
    b.set(Math.floor(cx), top, PAL.black[1]);
    b.set(Math.ceil(cx), top, PAL.black[1]);
    const out = b.padded(1).outline(INK);
    return center(out);
  });
}

// ------------------------------------------------------------------------------------ debris

const DEBRIS: Readonly<Record<string, { rows: readonly string[]; key: Readonly<Record<string, Color>> }>> = {
  metal: { rows: ['.33..', '3221.', '.2111', '..11.'], key: { '1': PAL.steel[1], '2': PAL.steel[2], '3': PAL.steel[4] } },
  wood: { rows: ['tTTTTT.', '.wwwwww'], key: { t: PAL.brown[3], T: PAL.brown[2], w: PAL.brown[1] } },
  rock: { rows: ['.32.', '3221', '2211', '.11.'], key: { '1': PAL.stone[1], '2': PAL.stone[2], '3': PAL.stone[3] } },
  dirt: { rows: ['.2.', '211', '.1.'], key: { '1': PAL.brown[1], '2': PAL.brown[2] } },
  glass: { rows: ['3...', '23..', '.22.', '..1.'], key: { '1': PAL.sky[1], '2': PAL.sky[2], '3': PAL.snow[3] } },
  plant: { rows: ['..3.', '.32.', '221.', '1...'], key: { '1': PAL.green[1], '2': PAL.green[2], '3': PAL.green[3] } },
  snow: { rows: ['.3.', '322', '.1.'], key: { '1': PAL.snow[0], '2': PAL.snow[2], '3': PAL.snow[3] } },
  cloth: { rows: ['22..', '.21.', '..11'], key: { '1': PAL.red[1], '2': PAL.red[2] } },
};

function debrisFrames(kind: string): Frame[] {
  const d = DEBRIS[kind];
  const base = ascii(d.rows, d.key);
  return [0, 1, 2, 3].map((q) => center(base.rotated((q * Math.PI) / 2).padded(1).outline(INK)));
}

defineSprite('fx/spark', sparkFrames, { ticksPerFrame: 2, loop: false });
defineSprite('fx/impact', impactFrames, { ticksPerFrame: 3, loop: false });
defineSprite('fx/hit-spark', hitFrames, { ticksPerFrame: 2, loop: false });
defineSprite('fx/hit', hitFrames, { ticksPerFrame: 2, loop: false });
defineSprite('fx/dust', dustFrames, { ticksPerFrame: 4, loop: false });
defineSprite('fx/splash', splashFrames, { ticksPerFrame: 4, loop: false });
defineSprite('fx/stun-stars', stunFrames, { ticksPerFrame: 4 });
defineSprite('fx/parachute', parachuteFrames, { ticksPerFrame: 12 });
for (const kind of Object.keys(DEBRIS)) defineSprite(`fx/debris-${kind}`, () => debrisFrames(kind), { ticksPerFrame: 4 });

// The comedy set of GDD §15.6.
defineGagSprites();

// Shared rigs: bg.ts and terrain-art.ts register at import (above). The demo sheets of the
// rigs (machine/demo-*, demo/bg …) are registered by tools/sprites.ts only, so the game never
// spends boot time on them.

