/**
 * Grand Marshal Bombastian Fanfaroni for the final-boss stages (GDD §2.2): about 30 px tall,
 * round, a giant crimson-and-gold bicorne (as wide as he is tall) with three plumes, huge gold
 * epaulettes, a curled moustache whose points reach past his ears, white gloves and a giant
 * conductor's baton. Faces right (flip for left). Same look as the ending's `ui/fanfaroni`, drawn
 * here with the poses the fight needs.
 *
 * `fanfaroni(o)` → Frame (feet anchor) with the points `mouth`, `baton` (tip), `hand`, `head`.
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';

export type FanfLegs = 'stand' | 'sit' | 'kick' | 'dangle-a' | 'dangle-b';
export type FanfArms =
  | 'down'
  | 'baton-up'
  | 'baton-fwd'
  | 'tap'
  | 'play-a'
  | 'play-b'
  | 'pull'
  | 'up-a'
  | 'up-b'
  | 'breath'
  | 'scream'
  | 'cough'
  | 'fist';
export type FanfMouth = 'shut' | 'open' | 'wide' | 'puff' | 'small';
export type FanfHat = 'on' | 'off' | 'lift' | 'fire-a' | 'fire-b';

export interface FanfOpts {
  legs?: FanfLegs;
  arms?: FanfArms;
  mouth?: FanfMouth;
  hat?: FanfHat;
  /** Black plumes after the hat fire (stage 3). */
  sooty?: boolean;
  /** Sweat drops / dizzy face (hoarse after BRAVISSIMO!). */
  tired?: boolean;
}

const W = 52;
const H = 60;
const FX = 26;
const FY = 57;

type Pt = readonly [number, number];

export function fanfaroni(o: FanfOpts = {}): Frame {
  const legs = o.legs ?? 'stand';
  const arms = o.arms ?? 'down';
  const mouth = o.mouth ?? 'shut';
  const hat = o.hat ?? 'on';
  const b = new PixelBuffer(W, H);
  const seated = legs === 'sit' || legs === 'kick';
  const hunch = arms === 'cough' ? 2 : 0;
  const puffed = arms === 'breath';

  // ---- legs: white breeches, black boots.
  const boot = (x: number, y: number, flip = false): void => {
    b.rect(x, y, 5, 2, PAL.black[1]);
    b.hline(x, x + 4, y, PAL.black[2]);
    b.set(flip ? x : x + 4, y + 1, PAL.black[0]);
  };
  const leg = (x: number, y: number, h: number, far: boolean): void => {
    b.rect(x, y, 3, h, far ? PAL.snow[1] : PAL.snow[2]);
    if (!far) b.vline(x, y, y + h - 1, PAL.snow[3]);
  };
  const ly = FY - 7;
  switch (legs) {
    case 'stand':
      leg(FX - 4, ly, 5, true);
      leg(FX + 1, ly, 5, false);
      boot(FX - 5, FY - 2);
      boot(FX + 1, FY - 2);
      break;
    case 'sit':
      // Thighs forward on the bench, shins down.
      b.rect(FX - 1, FY - 9, 9, 3, PAL.snow[1]);
      b.rect(FX + 1, FY - 8, 9, 3, PAL.snow[2]);
      b.hline(FX + 1, FX + 9, FY - 8, PAL.snow[3]);
      b.rect(FX + 7, FY - 6, 3, 4, PAL.snow[2]);
      b.rect(FX + 5, FY - 6, 2, 4, PAL.snow[1]);
      boot(FX + 6, FY - 2);
      boot(FX + 4, FY - 2);
      break;
    case 'kick':
      // Both feet stamp forward and down onto the pedals.
      b.rect(FX - 1, FY - 9, 9, 3, PAL.snow[1]);
      b.rect(FX + 1, FY - 8, 9, 3, PAL.snow[2]);
      b.line(FX + 9, FY - 6, FX + 12, FY - 2, PAL.snow[2]);
      b.line(FX + 10, FY - 6, FX + 13, FY - 2, PAL.snow[2]);
      boot(FX + 11, FY - 1);
      break;
    case 'dangle-a':
    case 'dangle-b': {
      const k = legs === 'dangle-a' ? 1 : -1;
      leg(FX - 4, ly - 1, 5, true);
      leg(FX + 1, ly - 1, 5, false);
      boot(FX - 5 + k, ly + 4);
      boot(FX + 1 - k, ly + 4);
      break;
    }
  }

  // ---- the round body: crimson tunic, gold cross-cords, white belt.
  const bodyTop = (seated ? FY - 22 : FY - 19) + hunch;
  const bw = puffed ? 19 : 17;
  const bh = puffed ? 16 : 15;
  const body = new PixelBuffer(W, H);
  body.ellipse(FX - (bw >> 1), bodyTop, bw, bh, PAL.red[2]);
  body.bevel(PAL.red, { light: 'tl', depth: 1, base: 2 });
  b.blit(body, 0, 0);
  b.line(FX - 4, bodyTop + 3, FX + 4, bodyTop + 10, PAL.gold[3]);
  b.line(FX + 4, bodyTop + 3, FX - 4, bodyTop + 10, PAL.gold[2]);
  b.rect(FX - 7, bodyTop + 11, 15, 2, PAL.snow[3]);
  b.set(FX, bodyTop + 11, PAL.gold[3]);
  // Huge gold epaulettes with a fringe.
  for (const ex of [FX - 12, FX + 5]) {
    b.ellipse(ex, bodyTop, 8, 5, PAL.gold[3]);
    b.hline(ex + 1, ex + 6, bodyTop + 3, PAL.gold[1]);
    for (let i = 0; i < 4; i++) b.set(ex + 1 + i * 2, bodyTop + 5, PAL.gold[2]);
  }

  // ---- head with the curled moustache.
  const hy = bodyTop - 8;
  const head = new PixelBuffer(W, H);
  head.ellipse(FX - 5, hy, 11, 10, PAL.skinA[2]);
  head.bevel(PAL.skinA, { light: 'tl', depth: 1, base: 2 });
  b.blit(head, 0, 0);
  // Nose.
  b.set(FX + 6, hy + 4, PAL.skinA[2]);
  b.set(FX + 6, hy + 5, PAL.skinA[1]);
  b.set(FX + 7, hy + 5, PAL.skinA[1]);
  // Eye and a proud eyebrow (squeezed shut when screaming or coughing).
  if (mouth === 'wide' || arms === 'cough') {
    b.hline(FX + 2, FX + 4, hy + 3, INK);
    b.line(FX + 1, hy + 1, FX + 4, hy + 2, PAL.hairA[0]);
  } else {
    b.set(FX + 3, hy + 3, INK);
    b.set(FX + 3, hy + 2, INK);
    b.hline(FX + 2, FX + 4, hy + 1, PAL.hairA[1]);
  }
  if (o.tired) {
    b.set(FX - 3, hy + 2, PAL.sky[3]);
    b.set(FX - 3, hy + 3, PAL.sky[2]);
  }
  // Mouth (under the moustache) then the moustache over it.
  const my = hy + 7;
  const mx = FX + 3;
  if (mouth === 'open') {
    b.rect(mx - 1, my + 1, 3, 2, PAL.red[0]);
  } else if (mouth === 'wide') {
    b.rect(mx - 2, my + 1, 5, 4, PAL.red[0]);
    b.rect(mx - 1, my + 3, 3, 1, PAL.red[2]);
  } else if (mouth === 'small') {
    b.set(mx, my + 2, PAL.red[0]);
  } else if (mouth === 'puff') {
    b.circle(FX + 4, hy + 6, 2, PAL.skinA[3]);
  }
  b.rect(FX - 3, my, 11, 1, INK);
  b.rect(FX - 1, my + 1, 7, 1, INK);
  // Curled points past the ears.
  b.set(FX - 4, my - 1, INK);
  b.set(FX - 5, my - 2, INK);
  b.set(FX - 4, my - 3, INK);
  b.set(FX + 8, my - 1, INK);
  b.set(FX + 9, my - 2, INK);
  b.set(FX + 8, my - 3, INK);

  // ---- arms (sleeves + white gloves) and the baton.
  const sy = bodyTop + 3;
  const shN: Pt = [FX + 6, sy];
  const shF: Pt = [FX - 6, sy];
  let hn: Pt;
  let hf: Pt;
  /** Baton direction from the near hand (null = no baton in hand). */
  let bd: Pt | null = [6, -6];
  switch (arms) {
    case 'baton-up':
      hn = [FX + 8, hy - 4];
      hf = [FX - 9, sy + 6];
      bd = [3, -14];
      break;
    case 'baton-fwd':
      hn = [FX + 13, sy + 1];
      hf = [FX - 9, sy + 5];
      bd = [15, -2];
      break;
    case 'tap':
      hn = [FX + 10, sy + 8];
      hf = [FX - 8, sy + 6];
      bd = [6, 10];
      break;
    case 'play-a':
      hn = [FX + 12, sy + 6];
      hf = [FX + 9, sy + 4];
      bd = null;
      break;
    case 'play-b':
      hn = [FX + 12, sy + 4];
      hf = [FX + 9, sy + 7];
      bd = null;
      break;
    case 'pull':
      hn = [FX + 4, sy + 3];
      hf = [FX + 11, sy + 6];
      bd = null;
      break;
    case 'up-a':
      hn = [FX + 10, hy - 6];
      hf = [FX - 11, hy - 3];
      bd = [8, -8];
      break;
    case 'up-b':
      hn = [FX + 11, hy - 2];
      hf = [FX - 10, hy - 7];
      bd = [9, -5];
      break;
    case 'breath':
      hn = [FX - 2, sy + 9];
      hf = [FX - 11, sy + 7];
      bd = [-8, 4];
      break;
    case 'scream':
      hn = [FX + 15, sy - 4];
      hf = [FX - 15, sy - 4];
      bd = [9, -9];
      break;
    case 'cough':
      hn = [FX + 6, my];
      hf = [FX - 8, sy + 7];
      bd = [-4, 12];
      break;
    case 'fist':
      hn = [FX + 9, hy - 3];
      hf = [FX - 8, sy + 7];
      bd = null;
      break;
    default:
      hn = [FX + 8, sy + 8];
      hf = [FX - 9, sy + 7];
      bd = [7, -7];
  }
  const glove = (p: Pt, far: boolean): void => {
    b.rect(p[0] - 1, p[1] - 1, 4, 4, far ? PAL.snow[2] : PAL.snow[3]);
    b.set(p[0] + 2, p[1] + 2, PAL.snow[1]);
  };
  // Far arm first (darker), then the baton, then the near arm over it.
  b.thickLine(shF[0], shF[1], hf[0], hf[1], 3, PAL.red[1]);
  glove(hf, true);
  let tip: Pt = hn;
  if (bd) {
    tip = [hn[0] + bd[0], hn[1] + bd[1]];
    b.line(hn[0] + 1, hn[1], tip[0] + 1, tip[1], PAL.snow[2]);
    b.line(hn[0], hn[1], tip[0], tip[1], PAL.snow[3]);
    b.rect(tip[0] - 1, tip[1] - 1, 2, 2, PAL.gold[3]);
  }
  b.thickLine(shN[0], shN[1], hn[0], hn[1], 3, PAL.red[2]);
  b.set(shN[0], shN[1], PAL.red[3]);
  glove(hn, false);

  // ---- the bicorne: a crimson crescent, gold edge, cockade, three plumes.
  if (hat !== 'off') {
    const top = hy - 9 + (hat === 'lift' ? -12 : 0);
    const hx = FX - 14;
    const hatB = new PixelBuffer(W, H);
    hatB.poly(
      [hx, top + 11, hx + 3, top + 6, hx + 9, top + 3, hx + 15, top + 2, hx + 21, top + 3, hx + 27, top + 6, hx + 30, top + 11, hx + 22, top + 10, hx + 15, top + 10, hx + 8, top + 10],
      PAL.red[2],
    );
    hatB.bevel(PAL.red, { light: 'tl', depth: 1, base: 2 });
    b.blit(hatB, 0, 0);
    b.line(hx, top + 11, hx + 8, top + 10, PAL.gold[3]);
    b.line(hx + 8, top + 10, hx + 22, top + 10, PAL.gold[3]);
    b.line(hx + 22, top + 10, hx + 30, top + 11, PAL.gold[2]);
    b.circle(hx + 15, top + 6, 2, PAL.gold[3]);
    b.set(hx + 15, top + 6, PAL.snow[3]);
    const plume = o.sooty ? PAL.black : PAL.snow;
    for (const [px, lean] of [[hx + 10, -1], [hx + 15, 0], [hx + 20, 1]] as const) {
      b.line(px, top + 2, px + lean, top - 4, plume[3]);
      b.set(px + lean - 1, top - 3, plume[2]);
      b.set(px + lean + 1, top - 4, plume[2]);
    }
    if (hat === 'fire-a' || hat === 'fire-b') {
      const k = hat === 'fire-a' ? 0 : 1;
      for (let i = 0; i < 4; i++) {
        const fx = hx + 7 + i * 6 + (k ? 1 : 0);
        const fh = 5 + ((i + k) % 2) * 3;
        b.tri(fx - 2, top + 3, fx + 2, top + 3, fx + (k ? 1 : -1), top + 3 - fh, PAL.orange[2]);
        b.line(fx, top + 2, fx, top + 3 - fh + 2, PAL.gold[3]);
      }
    }
  } else {
    // Bald crown with a brave tuft.
    b.hline(FX - 3, FX + 2, hy, PAL.hairA[1]);
    b.set(FX, hy - 1, PAL.hairA[1]);
    b.set(FX + 1, hy - 2, PAL.hairA[1]);
  }
  b.outline(INK);
  const ax = FX;
  const ay = FY + 1;
  return {
    buf: b,
    ox: ax,
    oy: ay,
    pts: {
      mouth: [mx - ax, my + 2 - ay],
      baton: [tip[0] - ax, tip[1] - ay],
      hand: [hn[0] - ax, hn[1] - ay],
      head: [FX - ax, hy + 4 - ay],
    },
  };
}
