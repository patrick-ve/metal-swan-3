/**
 * `creature/bullfrog/…` — the Baritone Bullfrog (GDD §9.3): an olive frog with a big gold throat
 * sac and a tiny crimson Legion cap with a gold badge. 28×20 sitting, anchored at the feet.
 *
 * Strips: idle (2), walk (4: the hop — crouch, launch, air, land), tell (4: the sac inflates),
 * attack (2: the croak), tell-tongue (2: eyes bulge), tongue (1: mouth open, the tongue is drawn
 * by the game), alert, gag (6: catches a fly, burps a note), photo-pose, die (6: inflates and
 * pops), die-blast, die-burn, die-crush, froglet (2: the small plain frog left behind),
 * croak-ring (3: the rolling ground ring, centre anchor).
 * Points: `mouth` (tongue origin), `head` (stun stars), `sac` (where the croak ring starts).
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, eye, xEye } from './draw';

const SKIN = PAL.olive;
const BELLY = PAL.sand;
const SAC = PAL.gold;

export type FrogEye = 'normal' | 'bulge' | 'shut' | 'x' | 'happy' | 'up';
export type FrogMouth = 'shut' | 'open' | 'wide' | 'smile';
export type FrogLegs = 'sit' | 'crouch' | 'launch' | 'air' | 'land';

export interface FrogPose {
  legs?: FrogLegs;
  /** 0 deflated … 1 a full balloon under the chin. */
  sac?: number;
  mouth?: FrogMouth;
  eye?: FrogEye;
  /** Pupil direction. */
  lookX?: number;
  lookY?: number;
  /** Death: the whole frog swells (0 … 1). */
  inflate?: number;
  /** The Legion cap (false for the plain froglet); `capUp` lifts it off the head. */
  cap?: boolean;
  capUp?: number;
  /** Extra front arm raise (photo pose wave). */
  wave?: boolean;
}

const W = 46;
const H = 36;
const OX = 22;
const OY = 33;

/** One frog frame (facing right). */
export function frog(p: FrogPose = {}): Frame {
  const legs = p.legs ?? 'sit';
  const sac = p.sac ?? 0;
  const inflate = p.inflate ?? 0;
  const s = new Sketch(W, H, OX, OY);
  // Pose numbers: body height, lift off the ground and stretch.
  const crouch = legs === 'crouch' || legs === 'land';
  const airborne = legs === 'launch' || legs === 'air';
  const bodyH = crouch ? 11 : airborne ? 11 : 13;
  const lift = legs === 'launch' ? 4 : legs === 'air' ? 6 : 0;
  const stretch = airborne ? 3 : crouch ? 1 : 0;
  const top = -bodyH - 3 - lift;
  const swell = Math.round(inflate * 9);

  // Far legs (a shade darker): only visible when the legs swing out.
  if (legs === 'launch' || legs === 'air') {
    s.add(SKIN, (b, X, Y) => {
      b.taper(X(-8), Y(top + 10), X(-17), Y(-lift - 1), 4, 2, FLAT);
      b.capsule(X(-17), Y(-lift - 1), X(-22), Y(-lift + 1), 2, FLAT);
    }, { shift: -1 });
  }
  // Rear haunch (the folded thigh) and the long webbed foot.
  if (!airborne && inflate === 0) {
    s.add(SKIN, (b, X, Y) => {
      b.ellipse(X(-14 - stretch), Y(-12 + (crouch ? 2 : 0)), 13, crouch ? 11 : 12, FLAT);
    });
    s.add(SKIN, (b, X, Y) => {
      b.capsule(X(-12), Y(-1), X(-2), Y(-1), 2, FLAT);
      b.rect(X(-2), Y(-2), 3, 2, FLAT);
    }, { base: 1, hi: 0 });
  }
  // Body: the big back and belly.
  s.add(SKIN, (b, X, Y) => {
    b.ellipse(X(-12 - stretch - swell), Y(top + 2 - swell), 22 + stretch + swell * 2, bodyH + swell * 2, FLAT);
    // Head and snout in front.
    b.ellipse(X(-1), Y(top + 3 - Math.round(swell / 2)), 15 + stretch + swell, 10 + swell, FLAT);
  }, { glint: true });
  // Belly highlight along the bottom front.
  s.add(BELLY, (b, X, Y) => {
    b.ellipse(X(-3 - swell), Y(top + 7 + bodyH - 8), 15 + swell * 2, 5 + Math.round(swell / 2), FLAT);
  }, { base: 2, ring: false });
  // Back spots (2×2 clusters).
  s.detail((b, X, Y) => {
    if (inflate > 0.6) return;
    for (const [sx, sy] of [[-8, top + 4], [-4, top + 2], [-11, top + 8], [-1, top + 4]] as const) {
      b.rect(X(sx), Y(sy), 2, 2, SKIN[0]);
    }
  });
  // Throat: a pale patch under the jaw that swells into a gold balloon when the frog croaks.
  if (sac > 0) {
    const r = Math.round(2 + sac * 5);
    const cx = 6 + Math.round(sac * 5) + stretch;
    const cy = top + 11 - Math.round(sac * 2);
    s.add(SAC, (b, X, Y) => b.circle(X(cx), Y(cy), r, FLAT), { glint: sac > 0.4 });
    if (sac > 0.5) s.detail((b, X, Y) => b.hline(X(cx - r + 2), X(cx - 1), Y(cy + r - 2), SAC[1]));
  } else if (inflate === 0) {
    s.add(BELLY, (b, X, Y) => b.ellipse(X(4 + stretch), Y(top + 8), 7, 3, FLAT), { base: 3, hi: 0, lo: 0, ring: false });
  }
  // Front arm and toes.
  if (inflate < 0.5) {
    s.add(SKIN, (b, X, Y) => {
      if (p.wave) {
        b.taper(X(6 + stretch), Y(top + 10), X(12 + stretch), Y(top + 2), 3, 2, FLAT);
        b.rect(X(11 + stretch), Y(top), 3, 3, FLAT);
      } else if (airborne) {
        b.taper(X(7 + stretch), Y(top + 9), X(13 + stretch), Y(top + 12), 3, 2, FLAT);
      } else {
        b.taper(X(6), Y(top + 9), X(7), Y(-2), 3, 2, FLAT);
        b.rect(X(6), Y(-2), 4, 2, FLAT);
      }
    }, { base: 2 });
  }
  // Launch / air: the near hind leg kicks back.
  if (airborne) {
    s.add(SKIN, (b, X, Y) => {
      b.taper(X(-9), Y(top + 8), X(-16), Y(-lift + 2), 5, 3, FLAT);
      b.capsule(X(-16), Y(-lift + 2), X(-23), Y(-lift + 4), 2, FLAT);
    }, { base: 2 });
  }
  // Eye on top of the head (the highest point), mouth line, cap.
  const ex = 4 + stretch;
  const ey = top + 1 - Math.round(swell / 2);
  s.add(SKIN, (b, X, Y) => b.circle(X(ex), Y(ey), 4, FLAT), { glint: true });
  s.detail((b, X, Y) => {
    const e = p.eye ?? 'normal';
    const r = e === 'bulge' ? 3 : 2;
    if (e === 'x') xEye(b, X(ex), Y(ey));
    else if (e === 'shut') b.hline(X(ex - 2), X(ex + 2), Y(ey), INK);
    else if (e === 'happy') {
      b.hline(X(ex - 1), X(ex + 1), Y(ey - 1), INK);
      b.set(X(ex - 2), Y(ey), INK);
      b.set(X(ex + 2), Y(ey), INK);
    } else eye(b, X(ex), Y(ey), r, p.lookX ?? 1, p.lookY ?? (e === 'up' ? -1 : 0), e === 'normal' ? SKIN[2] : undefined);
    // Mouth: a long smile line from under the eye to the snout.
    const mouth = p.mouth ?? 'shut';
    const my = top + 7;
    const snout = 13 + stretch;
    if (mouth === 'open' || mouth === 'wide') {
      const h = mouth === 'wide' ? 4 : 2;
      b.rect(X(3), Y(my), snout - 3, h, PAL.red[0]);
      b.rect(X(4), Y(my + h - 1), snout - 6, 1, PAL.pink[1]);
      b.hline(X(2), X(snout), Y(my - 1), INK);
    } else {
      b.hline(X(3), X(snout - 1), Y(my), INK);
      b.set(X(2), Y(my - 1), INK);
      if (mouth === 'smile') b.set(X(snout - 1), Y(my - 1), INK);
    }
    // Nostril.
    b.set(X(snout - 2), Y(top + 4), SKIN[0]);
  });
  if (p.cap !== false) {
    const up = p.capUp ?? 0;
    const cy = ey - 5 - up;
    s.add(PAL.red, (b, X, Y) => {
      b.rect(X(-4), Y(cy), 5, 4, FLAT);
      b.rect(X(-3), Y(cy - 1), 3, 1, FLAT);
    }, { glint: true });
    s.detail((b, X, Y) => {
      b.hline(X(-4), X(0), Y(cy + 3), PAL.gold[2]);
      b.set(X(-2), Y(cy + 1), PAL.gold[3]);
      b.hline(X(1), X(2), Y(cy + 3), INK);
    });
  }
  const mouthPt: readonly [number, number] = [13 + stretch, top + 8];
  return s.frame({ mouth: mouthPt, head: [ex, ey], sac: [10 + stretch, top + 10] });
}

/** A tiny note glyph (♪) drawn into a buffer. */
function note(b: PixelBuffer, x: number, y: number): void {
  b.rect(x, y + 3, 2, 2, PAL.gold[2]);
  b.vline(x + 1, y, y + 3, PAL.gold[2]);
  b.set(x + 2, y, PAL.gold[2]);
  b.set(x + 2, y + 1, PAL.gold[1]);
}

/** Gag: watches a fly, snaps it up, chews and burps one tiny note. */
function gagFrames(): Frame[] {
  const fly = (f: Frame, fx: number, fy: number): Frame => {
    const b = f.buf.clone();
    const x = f.ox + fx;
    const y = f.oy + fy;
    b.rect(x, y, 2, 1, INK);
    b.set(x, y - 1, PAL.snow[2]);
    b.set(x + 1, y - 1, PAL.snow[2]);
    return { ...f, buf: b };
  };
  const tongue = (f: Frame, tx: number, ty: number): Frame => {
    const b = f.buf.clone();
    const m = f.pts!.mouth;
    b.line(f.ox + m[0] - 1, f.oy + m[1], f.ox + tx, f.oy + ty, PAL.pink[1]);
    b.line(f.ox + m[0] - 1, f.oy + m[1] + 1, f.ox + tx, f.oy + ty + 1, PAL.pink[0]);
    b.rect(f.ox + tx - 1, f.oy + ty - 1, 3, 3, PAL.pink[2]);
    return { ...f, buf: b };
  };
  const burp = (f: Frame): Frame => {
    const b = f.buf.clone();
    note(b, f.ox + 15, f.oy - 25);
    return { ...f, buf: b };
  };
  return [
    fly(frog({ eye: 'up', lookX: 1, lookY: -1 }), 15, -24),
    fly(frog({ eye: 'up', lookX: 1, lookY: -1 }), 18, -22),
    tongue(frog({ mouth: 'open', eye: 'bulge', lookX: 1, lookY: -1 }), 18, -22),
    frog({ eye: 'shut', sac: 0.3 }),
    frog({ eye: 'happy', sac: 0.6 }),
    burp(frog({ mouth: 'open', eye: 'happy' })),
  ];
}

/** Death: inflates like a balloon, pops into bubbles (the froglet is spawned by the game). */
function dieFrames(): Frame[] {
  const pop = (): Frame => {
    const b = new PixelBuffer(W, H);
    const rings: ReadonlyArray<readonly [number, number, number]> = [[-6, -14, 3], [4, -18, 2], [8, -9, 3], [-11, -6, 2], [0, -8, 4], [12, -16, 1], [-3, -22, 1]];
    for (const [x, y, r] of rings) {
      b.circle(OX + x, OY + y, r, PAL.sky[3], false);
      b.set(OX + x - Math.max(0, r - 1), OY + y - Math.max(0, r - 1), PAL.snow[3]);
    }
    b.outline(PAL.sky[1]);
    return { buf: b, ox: OX, oy: OY };
  };
  return [
    frog({ eye: 'x', mouth: 'open', sac: 0.5 }),
    frog({ eye: 'x', mouth: 'shut', inflate: 0.4, capUp: 2 }),
    frog({ eye: 'x', mouth: 'shut', inflate: 0.8, capUp: 4 }),
    frog({ eye: 'x', mouth: 'shut', inflate: 1, capUp: 6 }),
    pop(),
    pop(),
  ];
}

/** The small plain frog left behind by the pop: no cap, a little lighter and greener. */
function froglet(hop: boolean): Frame {
  const s = new Sketch(16, 12, 8, 11);
  s.add(PAL.green, (b, X, Y) => {
    b.ellipse(X(-5), Y(hop ? -8 : -6), 10, 5, FLAT);
    b.ellipse(X(0), Y(hop ? -9 : -7), 6, 5, FLAT);
    if (hop) b.capsule(X(-4), Y(-4), X(-7), Y(-2), 2, FLAT);
    else b.ellipse(X(-5), Y(-4), 5, 4, FLAT);
  }, { base: 3, glint: true });
  s.detail((b, X, Y) => {
    eye(b, X(3), Y(hop ? -9 : -7), 1);
    b.hline(X(1), X(5), Y(hop ? -5 : -3), INK);
  });
  return s.frame({ head: [2, -8] });
}

/** The croak ring: an upright gold hoop that rolls along the ground (centre anchor). */
function croakRing(i: number): Frame {
  const b = new PixelBuffer(14, 14);
  const h = 10 + (i === 1 ? 1 : 0);
  const w = 7 + (i === 2 ? 1 : 0);
  const x = 7 - (w >> 1);
  const y = 7 - (h >> 1);
  b.ellipse(x, y, w, h, PAL.gold[2], false);
  b.ellipse(x + 1, y + 1, w - 2, h - 2, PAL.gold[3], false);
  // Trailing echo arc and a rolling highlight.
  b.vline(x - 2, y + 2, y + h - 3, PAL.gold[1]);
  const spots: ReadonlyArray<readonly [number, number]> = [[x + 1, y + 1], [x + w - 2, y + 2], [x + 1, y + h - 3]];
  const [hx, hy] = spots[i % 3];
  b.set(hx, hy, PAL.snow[3]);
  b.outline(INK);
  return { buf: b, ox: 7, oy: 7 };
}

const A = 'creature/bullfrog/';

defineSprite(A + 'idle', () => [frog(), frog({ sac: 0.2 })], { durations: [24, 14] });
defineSprite(A + 'walk', () => [frog({ legs: 'crouch' }), frog({ legs: 'launch' }), frog({ legs: 'air' }), frog({ legs: 'land' })], { ticksPerFrame: 6, loop: false });
defineSprite(A + 'tell', () => [frog({ sac: 0.25 }), frog({ sac: 0.5, eye: 'shut' }), frog({ sac: 0.75, eye: 'shut' }), frog({ sac: 1, eye: 'bulge' })], { ticksPerFrame: 10, loop: false });
defineSprite(A + 'attack', () => [frog({ mouth: 'wide', sac: 0.6, eye: 'shut' }), frog({ mouth: 'open', sac: 0.2 })], { durations: [14, 26], loop: false });
defineSprite(A + 'tell-tongue', () => [frog({ eye: 'bulge' }), frog({ eye: 'bulge', legs: 'crouch' })], { ticksPerFrame: 6 });
defineSprite(A + 'tongue', () => frog({ mouth: 'open', eye: 'bulge', legs: 'crouch' }), { loop: false });
defineSprite(A + 'alert', () => [frog({ eye: 'bulge', capUp: 2 }), frog({ eye: 'bulge' })], { ticksPerFrame: 6 });
defineSprite(A + 'gag', gagFrames, { durations: [18, 12, 4, 10, 12, 24] });
defineSprite(A + 'photo-pose', () => frog({ eye: 'happy', mouth: 'smile', wave: true }));
defineSprite(A + 'die', dieFrames, { durations: [6, 5, 5, 6, 5, 5], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(frog({ eye: 'x', mouth: 'open' }), [3, -14]), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(frog({ eye: 'shut' }), [3, -15]), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(frog({ eye: 'x' })), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'froglet', () => [froglet(false), froglet(true)], { ticksPerFrame: 10 });
defineSprite(A + 'croak-ring', () => [0, 1, 2].map(croakRing), { ticksPerFrame: 4 });
