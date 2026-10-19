import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/engine/palette';
import { PAL_HD, inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { HdCanvas, limb, polyDist, brick, cobbles, folds, gunArtHd, heldArtHd, knifeArtHd, leaves, plaster, propArtHd, renderHeadHd, ripples, strands, wood, type Outline } from '../../src/game/art/hd/index';
import { HEAD_H, HEAD_W, NECK, type Expression, type HeadStyle } from '../../src/game/art/humanoid-head';
import { giftArt, grenadeArt, gunArt, knifeArt, propArt, snackArt, type PropKind } from '../../src/game/art/humanoid-gear';

const DS = [2, 4] as const;

function ball(d: number, outline: Outline, spec = 0.6): PixelBuffer {
  const c = new HdCanvas(16, 16, d);
  const m = c.material({ ramp: PAL_HD.steel, spec });
  c.ellipsoid(8, 8, 6, 6, { mat: m });
  return c.render({ outline });
}

const opaque = (b: PixelBuffer, x: number, y: number): boolean => (b.get(x, y) & 255) !== 0;

describe('HdCanvas', () => {
  it('renders w·d × h·d, deterministically, in PAL_HD only', () => {
    for (const d of DS) {
      const a = ball(d, 'A');
      const b = ball(d, 'A');
      expect([a.w, a.h]).toEqual([16 * d, 16 * d]);
      expect(Array.from(a.data)).toEqual(Array.from(b.data));
      for (const c of a.data) if ((c & 255) !== 0) expect(inHdPalette(c)).toBe(true);
    }
  });

  it('a lit sphere at 4× shows at least 5 tones of its ramp plus a specular', () => {
    const b = ball(4, 'none');
    const tones = new Set<number>();
    for (const c of b.data) if ((c & 255) !== 0) tones.add(c);
    expect(tones.size).toBeGreaterThanOrEqual(6);
    expect(tones.has(PAL_HD.steel[7])).toBe(true);
    // Light from the upper left: the upper-left quadrant is lighter than the lower right.
    const lum = (x: number, y: number): number => PAL_HD.steel.indexOf(b.get(x, y));
    expect(lum(20, 20)).toBeGreaterThan(lum(44, 44));
  });

  it('outline A is d art px wide, B ½ logical px, C uses the deepest tone on the lit side and ink on the shadow side', () => {
    for (const d of DS) {
      const a = ball(d, 'A');
      const bb = ball(d, 'B');
      const cc = ball(d, 'C');
      // The sphere's left edge is at logical x = 2 (row through the centre).
      const y = 8 * d;
      const x0 = 2 * d;
      for (let k = 1; k <= d; k++) expect(a.get(x0 - k, y), `A d${d} k${k}`).toBe(PAL_HD.ink[0]);
      expect(opaque(a, x0 - d - 1, y)).toBe(false);
      for (let k = 1; k <= d / 2; k++) expect(bb.get(x0 - k, y)).toBe(PAL_HD.ink[0]);
      expect(opaque(bb, x0 - d / 2 - 1, y)).toBe(false);
      expect(cc.get(x0 - 1, y)).toBe(PAL_HD.steel[0]);
      expect(cc.get(14 * d, y)).toBe(PAL_HD.ink[0]);
    }
  });

  it('clean-up leaves no orphan art px in a matte sprite', () => {
    for (const d of DS) {
      const c = new HdCanvas(24, 24, d);
      const m = c.material({ ramp: PAL_HD.olive });
      c.capsule(4, 4, 18, 18, 4, 3, { mat: m, tex: folds({ spacing: 2, amp: 0.9 }) });
      const b = c.render({ outline: 'none', sep: false, ao: 0 });
      let orphans = 0;
      for (let y = 1; y < b.h - 1; y++) {
        for (let x = 1; x < b.w - 1; x++) {
          const v = b.get(x, y);
          if ((v & 255) === 0) continue;
          const n = [b.get(x - 1, y), b.get(x + 1, y), b.get(x, y - 1), b.get(x, y + 1)];
          if (n.every((u) => (u & 255) !== 0) && !n.includes(v)) orphans++;
        }
      }
      expect(orphans, `d${d}`).toBe(0);
    }
  });

  it('a nearer part gets a separation in the deepest tone of the part behind it, and casts a shadow', () => {
    const d = 4;
    const c = new HdCanvas(20, 20, d);
    const back = c.material({ ramp: PAL_HD.sand });
    const front = c.material({ ramp: PAL_HD.red });
    c.box(0, 0, 20, 20, { mat: back, z: 0 });
    c.box(6, 6, 6, 6, { mat: front, z: 3 });
    const b = c.render({ outline: 'none', ao: 0, shadow: 0.4 });
    expect(b.get(6 * d - 1, 9 * d)).toBe(PAL_HD.sand[0]);
    // Down-right of the box the wall is in shade; up-left it is not.
    const shadeIdx = PAL_HD.sand.indexOf(b.get(12 * d + 2, 12 * d + 2));
    const litIdx = PAL_HD.sand.indexOf(b.get(4 * d, 4 * d));
    expect(shadeIdx).toBeLessThan(litIdx);
  });

  it('textures, primitives and dither stay in PAL_HD at both densities', () => {
    for (const d of DS) {
      const c = new HdCanvas(48, 32, d);
      const mortar = c.material({ ramp: PAL_HD.stone });
      const w = c.material({ ramp: PAL_HD.brick });
      const p = c.material({ ramp: PAL_HD.plaster });
      const wd = c.material({ ramp: PAL_HD.wood });
      const st = c.material({ ramp: PAL_HD.stone });
      const g = c.material({ ramp: PAL_HD.sand });
      const lf = c.material({ ramp: PAL_HD.green });
      const wa = c.material({ ramp: PAL_HD.canal, dither: true });
      const h = c.material({ ramp: PAL_HD.hairB });
      c.box(0, 0, 16, 16, { mat: w, tex: brick({ mortar }) });
      c.box(16, 0, 16, 16, { mat: p, tex: plaster() });
      c.box(32, 0, 16, 16, { mat: wd, tex: wood({ plank: 3 }) });
      c.box(0, 16, 16, 16, { mat: st, tex: cobbles({ gap: g }) });
      c.ellipsoid(24, 24, 7, 7, { mat: lf, tex: leaves() });
      c.box(32, 16, 16, 8, { mat: wa, tex: ripples() });
      c.cylinder(32, 24, 16, 8, { mat: h, axis: 'h', tex: strands() });
      c.heightField(10, 20, 6, 6, (x, y) => 3 - Math.hypot(x - 13, y - 23), { mat: st, z: 2 });
      c.poly([[40, 0], [47, 0], [44, 6]], { mat: st, z: 4 });
      const b = c.render({ outline: 'A', shadow: 0.3 });
      for (const v of b.data) if ((v & 255) !== 0) expect(inHdPalette(v), v.toString(16)).toBe(true);
    }
  });
});

const STYLE: HeadStyle = { skin: PAL.skinA, hair: PAL.hairB, hairStyle: 'short', headgear: 'none', gear: PAL.olive, accent: PAL.red, extras: [] };

describe('rig contracts (prototypes)', () => {
  it('renderHeadHd: HEAD_W·d × HEAD_H·d, the neck at d × NECK, HD palette', () => {
    const exprs: Expression[] = ['normal', 'shout', 'blink', 'happy', 'panic'];
    for (const d of DS) {
      for (const style of [STYLE, { ...STYLE, headgear: 'helmet' as const }, { ...STYLE, hairStyle: 'long' as const, skin: PAL.skinC }, { ...STYLE, hairStyle: 'bald' as const, headgear: 'cap' as const }]) {
        for (const e of exprs) {
          const b = renderHeadHd(style, e, d);
          expect([b.w, b.h]).toEqual([HEAD_W * d, HEAD_H * d]);
          expect(opaque(b, NECK[0] * d + d / 2, NECK[1] * d + d / 2)).toBe(true);
          for (const v of b.data) if ((v & 255) !== 0) expect(inHdPalette(v)).toBe(true);
        }
      }
      expect(Array.from(renderHeadHd(STYLE, 'normal', d, { glint: false }).data)).toEqual(Array.from(renderHeadHd(STYLE, 'normal', d, { glint: false }).data));
    }
  });

  it('gear: d × the 1× size; grips and the barrel end are drawn', () => {
    for (const d of DS) {
      for (const k of ['pistol', 'heavy', 'rifle'] as const) {
        const lo = gunArt(k);
        const b = gunArtHd(k, d);
        expect([b.w, b.h], k).toEqual([lo.buf.w * d, lo.buf.h * d]);
        for (const p of [lo.grip, lo.grip2]) expect(opaque(b, p[0] * d + d / 2, p[1] * d + d / 2), `${k} grip`).toBe(true);
        expect(opaque(b, (lo.muzzle[0] - 1) * d + d / 2, lo.muzzle[1] * d + d / 2), `${k} muzzle`).toBe(true);
      }
      const held: Array<['grenade' | 'snack' | 'gift', PixelBuffer]> = [
        ['grenade', grenadeArt()],
        ['snack', snackArt()],
        ['gift', giftArt()],
      ];
      for (const [item, lo] of held) {
        const b = heldArtHd(item, d);
        expect([b.w, b.h], item).toEqual([lo.w * d, lo.h * d]);
      }
      const kn = knifeArtHd(d);
      expect([kn.w, kn.h]).toEqual([knifeArt().w * d, knifeArt().h * d]);
      const kinds: PropKind[] = ['umbrella', 'needles', 'pan', 'wrench', 'plan', 'pistol-butt', 'plunger', 'airliner', 'frikandel'];
      for (const k of kinds) {
        const lo = propArt(k);
        const b = propArtHd(k, d);
        expect([b.w, b.h], k).toEqual([lo.buf.w * d, lo.buf.h * d]);
        for (const v of b.data) if ((v & 255) !== 0) expect(inHdPalette(v)).toBe(true);
      }
    }
  });

  it('blob: a soft volume over a polygon — flat middle, edges rolling away, deterministic, PAL_HD', () => {
    for (const d of DS) {
      const draw = (): PixelBuffer => {
        const c = new HdCanvas(16, 12, d);
        const m = c.material({ ramp: PAL_HD.olive });
        c.blob([[2, 2], [14, 2], [14, 10], [2, 10]], 1.5, { mat: m });
        return c.render({ outline: 'none', ao: 0 });
      };
      const b = draw();
      expect(b.data).toEqual(draw().data);
      // Inside the polygon only; the lit (left) edge is lighter than the shadow (right) edge.
      expect(opaque(b, 1 * d, 6 * d)).toBe(false);
      expect(opaque(b, 8 * d, 6 * d)).toBe(true);
      const idx = (x: number): number => PAL_HD.olive.indexOf(b.get(Math.floor(x * d), 6 * d));
      expect(idx(2.2)).toBeGreaterThan(idx(13.8));
      for (const v of b.data) if ((v & 255) !== 0) expect(inHdPalette(v)).toBe(true);
    }
  });

  it('limb: a closed outline around the joints with the given half widths', () => {
    const pts = limb([[0, 0], [0, 6], [4, 10]], [2, 1.5, 1], 3);
    const inside = (x: number, y: number): boolean => {
      let r = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
      }
      return r;
    };
    expect(inside(0, 3)).toBe(true);
    expect(inside(1.6, 3)).toBe(true);
    expect(inside(2.4, 3)).toBe(false);
    expect(inside(2, 8)).toBe(true);
    // The round caps reach past both end joints.
    expect(inside(0, -1.5)).toBe(true);
    expect(polyDist(0, 3, pts)).toBeGreaterThan(1.5);
  });

  it('rimLight lifts shadow-side silhouette px only; edge C outlines decor on the parts behind it', () => {
    for (const d of DS) {
      const c = new HdCanvas(16, 16, d);
      const m = c.material({ ramp: PAL_HD.olive });
      c.ellipsoid(8, 8, 6, 6, { mat: m });
      const plain = c.render({ outline: 'none', ao: 0 });
      const rim = c.render({ outline: 'none', ao: 0, rimLight: 2 });
      const at = (b: PixelBuffer, x: number, y: number): number => PAL_HD.olive.indexOf(b.get(x, y));
      // Rightmost px of the centre row: lifted to at least lo + 2; the lit left edge unchanged.
      const row = 8 * d;
      let xr = 16 * d - 1;
      while (!opaque(plain, xr, row)) xr--;
      let xl = 0;
      while (!opaque(plain, xl, row)) xl++;
      expect(at(rim, xr, row)).toBeGreaterThanOrEqual(3);
      expect(at(rim, xr, row)).toBeGreaterThan(at(plain, xr, row));
      expect(rim.get(xl, row)).toBe(plain.get(xl, row));

      // Decor (edge C) in front of a wall: the wall px left of it take the decor's deepest tone,
      // the px right of it ink; away from the decor the wall is untouched.
      const s = new HdCanvas(24, 12, d);
      const wall = s.material({ ramp: PAL_HD.stone });
      const deco = s.material({ ramp: PAL_HD.green, edge: 'C' });
      s.plane(0, 0, 24, 12, { mat: wall, z: -10 });
      s.box(10, 2, 4, 8, { mat: deco, z: 0 });
      const b = s.render({ outline: 'none', sep: false, ao: 0 });
      const y = 6 * d;
      expect(b.get(10 * d - 1, y)).toBe(PAL_HD.green[0]);
      expect(b.get(14 * d, y)).toBe(PAL_HD.ink[0]);
      expect(PAL_HD.stone.includes(b.get(4 * d, y))).toBe(true);
    }
  });

  it('outline A rings even a lone art px far from the rest (the summed-area skip drops nothing)', () => {
    for (const d of DS) {
      const c = new HdCanvas(40, 40, d);
      const m = c.material({ ramp: PAL_HD.steel, flat: true });
      c.box(3, 3, 1 / d, 1 / d, { mat: m });
      c.box(30, 30, 1 / d, 1 / d, { mat: m });
      const b = c.render({ outline: 'A', ao: 0, clean: false });
      let ring = 0;
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        const q = dx * dx + dy * dy;
        if (q > 0 && q <= d * d + (d > 1 ? d * 0.5 : 0)) ring++;
      }
      let ink = 0;
      for (const v of b.data) if (v === PAL_HD.ink[0]) ink++;
      expect(ink, `d${d}`).toBe(2 * ring);
    }
  });

  it('heightField evaluates the field once per art px (plus a 1 art px border) and keeps its normals', () => {
    for (const d of DS) {
      const c = new HdCanvas(12, 12, d);
      const m = c.material({ ramp: PAL_HD.steel });
      let calls = 0;
      c.heightField(2, 2, 8, 8, (x, y) => {
        calls++;
        const q = 16 - (x - 6) ** 2 - (y - 6) ** 2;
        return q > 0 ? Math.sqrt(q) : NaN;
      }, { mat: m });
      expect(calls, `d${d}`).toBe((8 * d + 2) * (8 * d + 2));
      const i = 6 * d * 12 * d + 3 * d; // left of the centre: the normal leans left
      expect(c.nx[i]).toBeLessThan(-0.3);
      expect(c.nx[6 * d * 12 * d + 9 * d]).toBeGreaterThan(0.3);
    }
  });
});
