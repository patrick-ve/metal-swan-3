import { describe, expect, it, vi } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { PixelBuffer } from '../../src/engine/pixel';
import { frameH, frameW, type Frame } from '../../src/engine/render';
import { withPieces, type Piece } from '../../src/game/art/human-fx';
import { poseFrames, type PlayerArtOpts } from '../../src/game/art/human-sprites';
import type { HumanStyle, Pose } from '../../src/game/art/humanoid';
import { BOB_ART, BOB_STYLE } from '../../src/game/content/characters/bob.art';
import { GRACE_ART, GRACE_STYLE } from '../../src/game/content/characters/grace.art';
import { GRAMPS_ART, GRAMPS_STYLE } from '../../src/game/content/characters/gramps.art';
import { MITTENS_ART, MITTENS_STYLE } from '../../src/game/content/characters/mittens.art';
import { PATRICK_ART, PATRICK_STYLE } from '../../src/game/content/characters/patrick.art';
import { PIP_ART, PIP_STYLE } from '../../src/game/content/characters/pip.art';
import { allPieces, at, bobbleHat, decorateFrames, hdPiece, onGround, pieceHd, yarnBall } from '../../src/game/content/characters/pieces';
import { VINCENT_ART, VINCENT_STYLE } from '../../src/game/content/characters/vincent.art';

const opaque = (c: number): boolean => (c & 255) !== 0;

/** Logical px covered (any art px opaque in its d × d block). */
function cover(b: PixelBuffer, d: number): boolean[] {
  const w = b.w / d;
  const h = b.h / d;
  const out: boolean[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = false;
      for (let k = 0; k < d * d && !on; k++) on = opaque(b.data[(y * d + Math.floor(k / d)) * b.w + x * d + (k % d)]);
      out.push(on);
    }
  }
  return out;
}

/** Opaque bounds and centroid in logical px. */
function extent(b: PixelBuffer, d: number): { x0: number; x1: number; y0: number; y1: number; cx: number; cy: number } {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!opaque(b.data[y * b.w + x])) continue;
      n++;
      sx += (x + 0.5) / d;
      sy += (y + 0.5) / d;
      x0 = Math.min(x0, x / d);
      y0 = Math.min(y0, y / d);
      x1 = Math.max(x1, (x + 1) / d);
      y1 = Math.max(y1, (y + 1) / d);
    }
  }
  return { x0, x1, y0, y1, cx: sx / n, cy: sy / n };
}

const geom = (f: Frame): string => `${frameW(f)}x${frameH(f)}@${f.ox},${f.oy} ${JSON.stringify(f.pts ?? {})}`;

describe('HD hero pieces (pieces.ts hd drawers)', () => {
  const pieces = allPieces();

  it('every piece has an HD drawer', () => {
    expect(pieces.length).toBe(24);
    expect(new Set(pieces.map(([n]) => n)).size).toBe(pieces.length);
    for (const [name, lo] of pieces) {
      expect(name).not.toBe('?');
      expect(pieceHd(lo, 2), name).toBeDefined();
      expect(pieceHd(lo, 4), name).toBeDefined();
    }
  });

  for (const d of [2, 4] as const) {
    it(`d ${d}: exactly d × the 1× size, HD colours only, cached`, () => {
      for (const [name, lo] of pieces) {
        const hd = pieceHd(lo, d)!;
        expect([hd.w, hd.h], name).toEqual([lo.w * d, lo.h * d]);
        expect(pieceHd(lo, d), name).toBe(hd);
        for (const c of hd.data) if (opaque(c)) expect(inHdPalette(c), `${name}@${d}x ${c.toString(16)}`).toBe(true);
      }
    });

    it(`d ${d}: the same logical footprint, extent and centre as the 1× piece (at / onGround anchors)`, () => {
      for (const [name, lo] of pieces) {
        const hd = pieceHd(lo, d)!;
        const a = cover(lo, 1);
        const b = cover(hd, d);
        let both = 0;
        let either = 0;
        for (let i = 0; i < a.length; i++) {
          if (a[i] && b[i]) both++;
          if (a[i] || b[i]) either++;
        }
        expect(both / either, `${name}@${d}x overlap`).toBeGreaterThan(0.6);
        const e1 = extent(lo, 1);
        const ed = extent(hd, d);
        for (const k of ['x0', 'x1', 'y0', 'y1'] as const) expect(Math.abs(ed[k] - e1[k]), `${name}@${d}x ${k}`).toBeLessThanOrEqual(0.5);
        expect(Math.hypot(ed.cx - e1.cx, ed.cy - e1.cy), `${name}@${d}x centre`).toBeLessThan(0.35);
      }
    });
  }

  it('pieces placed on the ground keep the 1× bottom edge exactly (no floating, no sinking)', () => {
    const grounded = new Set(['yarn', 'bobble', 'dentures', 'dentures-open']);
    for (const [name, lo] of pieces) {
      if (!grounded.has(name)) continue;
      for (const d of [2, 4] as const) expect(extent(pieceHd(lo, d)!, d).y1, `${name}@${d}x`).toBe(extent(lo, 1).y1);
    }
  });

  it('a non-piece buffer has no HD art; hdPiece leaves it (and dense pieces) as they are', () => {
    const plain = new PixelBuffer(3, 3);
    expect(pieceHd(plain, 4)).toBeUndefined();
    const p = { buf: plain, x: 1, y: 2 };
    expect(hdPiece(p, 4)).toBe(p);
    const dense = { buf: pieceHd(yarnBall(), 2)!, x: 0, y: 0, density: 2 };
    expect(hdPiece(dense, 4)).toBe(dense);
    expect(hdPiece({ buf: yarnBall(), x: 3, y: -4, behind: true }, 4)).toEqual({ buf: pieceHd(yarnBall(), 4), x: 3, y: -4, behind: true, density: 4 });
  });

  it('is deterministic: a fresh module draws the same pixels', async () => {
    const before = allPieces().map(([n, b]) => [n, Array.from(pieceHd(b, 4)!.data), Array.from(pieceHd(b, 2)!.data)]);
    vi.resetModules();
    const fresh = await import('../../src/game/content/characters/pieces');
    const after = fresh.allPieces().map(([n, b]) => [n, Array.from(fresh.pieceHd(b, 4)!.data), Array.from(fresh.pieceHd(b, 2)!.data)]);
    expect(after).toEqual(before);
  });
});

describe('decorateFrames at every density', () => {
  /** A blank body frame of logical size 20 × 30, anchored at the feet, with a hand point. */
  const body = (d: number): Frame => ({ buf: new PixelBuffer(20 * d, 30 * d), ox: 10, oy: 29, pts: { hand: [6, -12] }, ...(d > 1 ? { density: d } : {}) });
  const deco = (): Piece[] => [at(yarnBall(), 14, -20), onGround(bobbleHat(), -12, 0), { ...at(yarnBall(), 0, -40), behind: true }];

  it('1×: exactly withPieces with the 1× pieces (1× art unchanged)', () => {
    const f = body(1);
    const [out] = decorateFrames([f], deco);
    const ref = withPieces(f, deco());
    expect(geom(out)).toBe(geom(ref));
    expect(Array.from(out.buf.data)).toEqual(Array.from(ref.buf.data));
  });

  for (const d of [2, 4] as const) {
    it(`${d}×: the 1× geometry, every piece drawn as its HD art at its logical place`, () => {
      const [lo] = decorateFrames([body(1)], deco);
      const [hi] = decorateFrames([body(d)], deco);
      expect(hi.density).toBe(d);
      expect(geom(hi)).toBe(geom(lo));
      const left = -lo.ox;
      const top = -lo.oy;
      for (const p of deco()) {
        const art = pieceHd(p.buf, d)!;
        const X0 = (p.x - left) * d;
        const Y0 = (p.y - top) * d;
        for (let y = 0; y < art.h; y++) {
          for (let x = 0; x < art.w; x++) {
            const c = art.data[y * art.w + x];
            if (opaque(c)) expect(hi.buf.get(X0 + x, Y0 + y)).toBe(c);
          }
        }
      }
    });
  }

  it('keeps frames without pieces as they are', () => {
    const f = body(4);
    expect(decorateFrames([f], () => null)[0]).toBe(f);
    expect(decorateFrames([f], () => [])[0]).toBe(f);
  });
});

describe('hero strips with pieces: the same geometry at 1×, 2× and 4×', () => {
  type Strip = 'bored' | 'fidget-a' | 'die' | 'victory';
  const KEY: Record<Strip, keyof PlayerArtOpts> = { bored: 'bored', 'fidget-a': 'fidgetA', die: 'die', victory: 'victory' };
  const HEROES: Array<[string, HumanStyle, PlayerArtOpts]> = [
    ['vincent', VINCENT_STYLE, VINCENT_ART],
    ['bob', BOB_STYLE, BOB_ART],
    ['patrick', PATRICK_STYLE, PATRICK_ART],
    ['grace', GRACE_STYLE, GRACE_ART],
    ['mittens', MITTENS_STYLE, MITTENS_ART],
    ['pip', PIP_STYLE, PIP_ART],
    ['gramps', GRAMPS_STYLE, GRAMPS_ART],
  ];

  for (const [id, style, o] of HEROES) {
    it(id, () => {
      let decorated = 0;
      for (const [name, dec] of Object.entries(o.decorate ?? {}) as Array<[Strip, (f: Frame[], p: readonly Pose[]) => Frame[]]>) {
        const poses = o[KEY[name]] as readonly Pose[];
        expect(poses, `${id} ${name} poses`).toBeDefined();
        const raw1 = poseFrames(style, poses, 'full', 1);
        const raw2 = poseFrames(style, poses, 'full', 2);
        // 4×: a stand-in body (the 2× frame doubled) until the rig draws 4× bodies.
        const raw4 = raw2.map((f) => ({ ...f, buf: f.buf.scaled(2), density: 4 }));
        const d1 = dec(raw1, poses);
        const d2 = dec(raw2, poses);
        const d4 = dec(raw4, poses);
        for (let i = 0; i < poses.length; i++) {
          if (d1[i] !== raw1[i]) decorated++;
          expect(geom(d2[i]), `${id} ${name}[${i}]@2x`).toBe(geom(d1[i]));
          expect(geom(d4[i]), `${id} ${name}[${i}]@4x`).toBe(geom(d1[i]));
          expect(d4[i].density, `${id} ${name}[${i}]@4x density`).toBe(4);
        }
      }
      expect(decorated, `${id}: frames with pieces`).toBeGreaterThan(0);
    }, 60_000);
  }
});
