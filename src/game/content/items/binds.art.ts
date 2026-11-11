/**
 * The pieces hostage.art.ts stacks onto the code-drawn hostage kinds (critic, roadie, tea lady,
 * composer, Mrs. Dollop): the folding chair, the hanging cage (back and front bars), the burlap sack,
 * the parachute canopy, at 1× and as density-generic UHD drawers (`…Hd`: HdCanvas, PAL_HD, outline A,
 * rim light; oiled wood with grain, woven burlap, lit steel) fitted into the 1× footprint.
 * `HD_RENDER`, `hdOf`, `fitHd` and `hdCached` are shared with hostage.art.ts.
 *
 * The bind props (`item/bind/…`: `rope`, `rope-bit`, `rope-band`, `chair-break`, `cage-break`,
 * `sack-off`, `mast`, `balloon`) are the baked 40 px set `bind` (src/game/content/art40/bind.gen.ts,
 * drawn by tools/art40/chars/bind/ from the tied tourist's props; docs/design/ams40.md wave 3).
 */
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { defineBakedSet } from '../../../engine/baked';
import { SET as BIND_SET } from '../art40/bind.gen';
import { HdCanvas, wood, type RenderOpts, type Texture } from '../../art/hd';
import { hash2, shadeLayer } from '../../art/paint';

// ------------------------------------------------------------------------------------ chair

/**
 * Wooden folding chair seen from the side, drawn behind a sitting figure. `broken` 0 = whole,
 * 1 = legs splayed, 2 = backrest gone. Origin = the seat's back corner at (2, 12).
 */
export function chairPiece(broken = 0): PixelBuffer {
  const b = new PixelBuffer(16, 22);
  const wood = PAL.brown;
  if (broken < 2) {
    b.rect(2, 1, 2, 12, wood[2]);
    b.rect(1, 2, 4, 2, wood[3]);
  }
  b.rect(2, 12, 12, 2, wood[2]);
  b.hline(2, 13, 12, wood[3]);
  if (broken < 1) {
    b.line(3, 14, 3, 20, wood[1]);
    b.line(12, 14, 12, 20, wood[1]);
    b.line(4, 15, 11, 19, wood[1]);
  } else {
    b.line(3, 14, 6, 20, wood[1]);
    b.line(12, 14, 9, 20, wood[1]);
  }
  shadeLayer(b, wood, {});
  return b.padded(1).outline(INK);
}



// ------------------------------------------------------------------------------------ cage

/** Cage frame size (GDD §7.2: 20×30), plus 1 px of outline each side. */
export const CAGE = { w: 20, h: 30 } as const;
const BAR_XS = [1, 5, 9, 14, 18];

/**
 * The cage behind the figure: dark back bars, the floor plate, the domed roof and the hanging
 * ring. Top-left at (−11, −32) from the feet anchor (the cage stands on y 0).
 */
export function cageBack(): PixelBuffer {
  const b = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  const s = PAL.steel;
  // Silhouette (outlined), then the back bars and plates.
  const sil = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  sil.rect(1, 5, CAGE.w, CAGE.h - 4, s[0]);
  sil.ellipse(1, 2, CAGE.w, 8, s[0]);
  sil.rect(CAGE.w / 2 - 1, 0, 4, 3, s[0]);
  for (let y = 0; y < sil.h; y++) for (let x = 0; x < sil.w; x++) if ((sil.get(x, y) & 255) !== 0) b.set(x, y, 0);
  // Back bars (darker, between the front bars).
  for (const x of [3, 7, 12, 16]) b.vline(x + 1, 6, CAGE.h - 2, s[1]);
  // Roof dome and ring.
  b.ellipse(1, 2, CAGE.w, 8, s[2]);
  b.ellipse(3, 3, CAGE.w - 4, 5, s[3]);
  b.hline(2, CAGE.w - 1, 6, s[1]);
  b.rect(CAGE.w / 2, 0, 2, 3, PAL.gold[1]);
  b.set(CAGE.w / 2, 0, PAL.gold[2]);
  // Floor plate.
  b.rect(1, CAGE.h - 2, CAGE.w, 3, s[2]);
  b.hline(1, CAGE.w, CAGE.h - 2, s[3]);
  b.hline(1, CAGE.w, CAGE.h, s[0]);
  b.outline(INK);
  // Clear the inside between the back bars so the figure shows there (the back is open air).
  return b;
}

/** The front bars and rims, drawn over the figure (same placement as `cageBack`). */
export function cageFront(): PixelBuffer {
  const b = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  const s = PAL.steel;
  for (const x of BAR_XS) {
    b.vline(x + 1, 6, CAGE.h - 2, s[3]);
    // Bars are lit on the left: a dark right edge only on the outer bars.
  }
  b.vline(CAGE.w, 6, CAGE.h - 2, s[2]);
  // Rims: top band under the dome, middle band, the floor lip.
  b.hline(1, CAGE.w, 7, s[3]);
  b.hline(1, CAGE.w, 8, s[1]);
  b.hline(1, CAGE.w, 18, s[2]);
  b.hline(1, CAGE.w, CAGE.h - 3, s[3]);
  // A padlock on the front bar.
  b.rect(CAGE.w - 6, 16, 4, 4, PAL.gold[1]);
  b.set(CAGE.w - 6, 16, PAL.gold[3]);
  b.set(CAGE.w - 5, 15, PAL.gold[2]);
  b.set(CAGE.w - 4, 15, PAL.gold[2]);
  return b;
}



// ------------------------------------------------------------------------------------ sack

/**
 * A burlap sack with a figure inside (tied at the top), `h` px tall, `w` wide at the bottom.
 * The bottom edge sits on row h + 1 of the buffer (1 px outline margin).
 */
export function sackPiece(w: number, h: number, tilt = 0): PixelBuffer {
  const b = new PixelBuffer(w + 6, h + 6);
  const cx = (w + 6) / 2;
  const body: Array<[number, number]> = [
    [cx - w / 2, h + 2],
    [cx + w / 2, h + 2],
    [cx + w / 2 - 1 + tilt, 10],
    [cx + 2 + tilt, 5],
    [cx - 2 + tilt, 5],
    [cx - w / 2 + 1 + tilt, 10],
  ];
  b.poly(body.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]), PAL.sand[1]);
  shadeLayer(b, PAL.sand, { base: 1 });
  // The tied neck and the tuft above it.
  const nx = Math.round(cx + tilt);
  b.rect(nx - 2, 4, 4, 2, PAL.brown[2]);
  b.hline(nx - 2, nx + 1, 5, PAL.brown[1]);
  b.set(nx - 2, 2, PAL.sand[2]);
  b.set(nx - 1, 1, PAL.sand[2]);
  b.set(nx, 2, PAL.sand[1]);
  b.set(nx + 1, 1, PAL.sand[2]);
  b.set(nx - 1, 3, PAL.sand[2]);
  b.set(nx, 3, PAL.sand[1]);
  // Weave seams and a stitched patch.
  for (let y = 12; y < h; y += 5) {
    for (let x = Math.round(cx - w / 2) + 2; x < cx + w / 2 - 2; x += 4) {
      if ((b.get(x, y) & 255) !== 0) b.set(x, y, PAL.sand[0]);
    }
  }
  const px = Math.round(cx + 1);
  const py = Math.round(h * 0.55);
  b.rect(px, py, 4, 4, PAL.brown[2]);
  b.set(px, py, PAL.brown[3]);
  b.set(px + 3, py + 3, PAL.brown[1]);
  // Stamped lettering: a little crimson Legion stencil mark.
  b.hline(Math.round(cx - 4), Math.round(cx - 2), py - 4, PAL.red[1]);
  b.hline(Math.round(cx - 4), Math.round(cx - 2), py - 2, PAL.red[1]);
  return b.outline(INK);
}


// ------------------------------------------------------------------------------------ parachute

/** A small round parachute canopy (crimson and ivory gores), 26 px wide. */
export function canopyPiece(phase = 0): PixelBuffer {
  const w = 26;
  const b = new PixelBuffer(w + 2, 12);
  const sag = phase ? 1 : 0;
  b.ellipse(1, 1, w, 16, PAL.snow[2]);
  // Cut the lower half off: a dome with a scalloped hem.
  for (let y = 9 - sag; y < 12; y++) for (let x = 0; x < w + 2; x++) b.set(x, y, 0);
  for (let x = 1; x < w + 1; x += 5) {
    b.set(x + 2, 9 - sag, PAL.snow[1]);
    b.set(x + 3, 9 - sag, PAL.snow[1]);
  }
  // Crimson gores.
  for (let y = 1; y < 10; y++) {
    for (let x = 1; x < w + 1; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const gore = Math.floor(((x - 1) / w) * 5);
      if (gore % 2 === 1) b.set(x, y, y < 4 ? PAL.red[3] : PAL.red[2]);
      else if (y < 4) b.set(x, y, PAL.snow[3]);
    }
  }
  return b.outline(INK);
}

// ------------------------------------------------------------------------------------ UHD

/** A dense density of the UHD art. */
export type HdD = 2 | 4;

/** The cast's sprite look (style decisions): outline A, a cool rim light, AO — as the rig. */
export const HD_RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

/** 2 or 4 for a dense density. */
export function hdOf(d: number): HdD {
  return d >= 4 ? 4 : 2;
}

/**
 * Keep a drawing inside the 1× footprint `lo` (geometry is law): every art px outside the opaque
 * box of the 1× buffer less its 1-px outline is dropped BEFORE the render, so outline A wraps a
 * clean edge inside the 1× box (as the rig's `fitFrame`).
 */
export function fitHd(c: HdCanvas, lo: PixelBuffer): void {
  const b = lo.trimBounds();
  if (!b) return;
  const x0 = b.x + 1;
  const y0 = b.y + 1;
  const x1 = b.x + b.w - 1;
  const y1 = b.y + b.h - 1;
  c.erase(0, 0, c.w, c.h, (x, y) => x < x0 || x > x1 || y < y0 || y > y1);
}

/** Finished HD pieces (each a pure function of its key). */
const hdPieces = new Map<string, PixelBuffer>();
export function hdCached(key: string, make: () => PixelBuffer): PixelBuffer {
  let b = hdPieces.get(key);
  if (!b) {
    b = make();
    hdPieces.set(key, b);
  }
  return b;
}

/**
 * Twisted rope along a direction (ux, uy): strands as diagonal ridges with dark grooves between
 * them (the normal rolls across each strand), `phase` shifts the twist along the rope.
 */
function twist(ux: number, uy: number, x0: number, y0: number, pitch = 1.1, phase = 0): Texture {
  return (s) => {
    const a = (s.x - x0) * ux + (s.y - y0) * uy;
    const b = -(s.x - x0) * uy + (s.y - y0) * ux;
    const f = ((((a + b * 0.9) / pitch + phase) % 1) + 1) % 1;
    const r = (f - 0.5) * 2;
    s.nx += ux * r * 0.45;
    s.ny += uy * r * 0.45;
    if (f < 0.16) s.tone -= 0.3;
  };
}





/** Wood (the chair, planks): the 1× brown family, oiled, with grain. */
const woodMat = (c: HdCanvas): number => c.material({ ramp: PAL_HD.brown, lo: 2, hi: 7, spec: 0.3, shine: 14, wrap: 0.05 });

/**
 * The HD folding chair (the `chairPiece` box, 18 × 24 with its outline; `broken` as there):
 * bevelled slats with wood grain, a lit seat edge, splayed legs when broken, steel screws.
 */
export function chairPieceHd(broken: number, d: HdD): PixelBuffer {
  return hdCached(`chair:${broken}@${d}`, () => {
    const c = new HdCanvas(18, 24, d);
    const w = woodMat(c);
    const steel = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 1, shine: 26 });
    const leg = (x0: number, y0: number, x1: number, y1: number, z: number): void => {
      c.capsule(x0, y0, x1, y1, 0.55, 0.55, { mat: w, z, tone: -0.12, tex: wood({ seed: 7 + x0, dir: 'v' }) });
    };
    if (broken < 1) {
      leg(5.5, 16.5, 12.5, 20.5, 0);
      leg(4.5, 15.5, 4.5, 21.5, 0.5);
      leg(13.5, 15.5, 13.5, 21.5, 0.5);
    } else {
      leg(4.5, 15.5, 7.5, 21.5, 0.5);
      leg(13.5, 15.5, 10.5, 21.5, 0.5);
    }
    if (broken < 2) {
      c.box(3, 2, 2, 12, { mat: w, z: 1, bevel: 0.45, tex: wood({ seed: 11, dir: 'v' }) });
      c.box(2, 3, 4, 2, { mat: w, z: 1.4, bevel: 0.5, tone: 0.1, tex: wood({ seed: 12 }) });
      c.ellipsoid(4, 13.4, 0.35, 0.35, { mat: steel, z: 2.4 });
    }
    c.box(3, 13, 12, 2, { mat: w, z: 2, bevel: 0.5, tex: wood({ seed: 13 }) });
    c.ellipsoid(13.2, 14, 0.35, 0.35, { mat: steel, z: 2.6 });
    fitHd(c, chairPiece(broken));
    return c.render(HD_RENDER);
  });
}


/** Steel of the cage. */
const cageSteel = (c: HdCanvas): number => c.material({ ramp: PAL_HD.steel, lo: 1, hi: 6, spec: 1, shine: 26 });

/** The HD cage behind the figure (the `cageBack` box): dark back bars, the lit dome, the brass ring, the floor plate. */
export function cageBackHd(d: HdD): PixelBuffer {
  return hdCached(`cage-back@${d}`, () => {
    const c = new HdCanvas(CAGE.w + 2, CAGE.h + 2, d);
    const st = cageSteel(c);
    const gold = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 24 });
    for (const x of [3, 7, 12, 16]) c.cylinder(x + 1, 6, 1, CAGE.h - 7, { mat: st, z: 0, tone: -0.3 });
    c.plane(1, 2, CAGE.w, 4.6, {
      mat: st,
      z: 1,
      mask: (x, y) => ((x - 11) / 10) ** 2 + ((y - 6.5) / 4.5) ** 2 < 1 && y < 6.6,
      normal: (x, y, out) => {
        out[0] = ((x - 11) / 10) * 0.9;
        out[1] = (y - 6.5) / 4.5;
        out[2] = 0.6;
      },
    });
    c.box(1, 6, CAGE.w, 1, { mat: st, z: 1.2, bevel: 0.3, tone: -0.2 });
    c.capsule(11, 0.9, 11, 2.4, 0.9, 0.9, { mat: gold, z: 1.5 });
    c.box(1, CAGE.h - 2, CAGE.w, 3, { mat: st, z: 2, bevel: 0.5 });
    fitHd(c, cageBack());
    return c.render(HD_RENDER);
  });
}

/** The HD front bars and rims (drawn over the figure, no ink outline as at 1×): lit round bars, rims, a brass padlock. */
export function cageFrontHd(d: HdD): PixelBuffer {
  return hdCached(`cage-front@${d}`, () => {
    const c = new HdCanvas(CAGE.w + 2, CAGE.h + 2, d);
    const st = cageSteel(c);
    const gold = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 24 });
    for (const x of BAR_XS) c.cylinder(x + 1, 6, 1, CAGE.h - 7, { mat: st, z: 1 });
    c.cylinder(CAGE.w, 6, 1, CAGE.h - 7, { mat: st, z: 1, tone: -0.15 });
    for (const [y, t] of [[7, 0.1], [18, 0], [CAGE.h - 3, 0.1]] as const) c.cylinder(1, y, CAGE.w, 1.1, { mat: st, z: 2, axis: 'h', tone: t });
    c.box(CAGE.w - 6, 16, 4, 4, { mat: gold, z: 3, bevel: 0.6, r: 0.4 });
    c.capsule(CAGE.w - 5.2, 16, CAGE.w - 4.4, 15, 0.3, 0.3, { mat: gold, z: 3 });
    c.capsule(CAGE.w - 3.6, 15, CAGE.w - 2.8, 16, 0.3, 0.3, { mat: gold, z: 3 });
    return c.render({ outline: 'none', ao: 0.2, rimLight: 0 });
  });
}


/**
 * The HD burlap sack with a figure inside (the `sackPiece` box): coarse woven burlap (a fine weave
 * at 4×) with creases pulled from the tied neck, stitched seams, a rope tie wound twice with a
 * frayed tuft above it, a stitched patch and the red stencil mark. A low sack (h < 8, slumped
 * and empty) is a heap with its neck lying at the top.
 */
export function sackPieceHd(w: number, h: number, tilt: number, d: HdD): PixelBuffer {
  return hdCached(`sack:${w}:${h}:${tilt}@${d}`, () => {
    const c = new HdCanvas(w + 6, h + 6, d);
    const cx = (w + 6) / 2;
    const L = (x: number): number => Math.round(x);
    const R = (x: number): number => Math.round(x) + 1;
    const burlap = c.material({ ramp: PAL_HD.sand, lo: 2, hi: 6, wrap: 0.1, spec: 0.05, amb: 0.15 });
    const patch = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 4, wrap: 0.1 });
    const red = c.material({ ramp: PAL_HD.red, lo: 2, hi: 5 });
    const tie = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 6, spec: 0.2, shine: 10 });
    const nx = Math.round(cx + tilt) + 0.5;
    const py = Math.round(h * 0.55);
    const px = Math.round(cx + 1);
    const sx = Math.round(cx - 4);
    const weave: Texture = (s) => {
      // Coarse weave: alternating thread bumps; seams every 5 px, creases from the neck.
      if (s.d >= 4 && hash2(Math.floor(s.x * 2), Math.floor(s.y * 4), 61) > 0.88) s.tone -= 0.2;
      const cr = Math.abs((((s.x - nx) * 1.1 - (s.y - 5) * 0.25 * Math.sign(s.x - nx)) % 2.6) / 2.6);
      if (s.y > 7 && cr < 0.12) s.tone -= 0.22;
      if (s.y > 11 && (s.y - 12) % 5 < 1 / s.d && (Math.floor(s.x * 1.5) & 1) === 0) s.tone -= 0.3;
      // The stencil mark (two bars with bridge gaps) and the patch.
      if (s.x >= sx && s.x < sx + 3 && ((s.y >= py - 4 && s.y < py - 3) || (s.y >= py - 2 && s.y < py - 1)) && Math.abs(s.x - sx - 1.25) > 0.25) s.mat = red;
    };
    const body: ReadonlyArray<readonly [number, number]> =
      h >= 8
        ? [[L(cx - w / 2), R(h + 2)], [R(cx + w / 2), R(h + 2)], [R(cx + w / 2 - 1 + tilt), L(10)], [R(cx + 2 + tilt), L(5)], [L(cx - 2 + tilt), L(5)], [L(cx - w / 2 + 1 + tilt), L(10)]]
        : [[L(cx - w / 2), h + 5], [R(cx + w / 2), h + 5], [R(cx + w / 2) - 1.5, h + 1], [nx + 2.5, 5], [nx - 1.5, 5], [L(cx - w / 2) + 1.5, h + 1.5]];
    c.blob(body, 1.6, { mat: burlap, z: 0, bulge: 0.5, tex: weave });
    if (h >= 8) {
      c.box(px, py, 4, 4, {
        mat: patch,
        z: 4,
        bevel: 0.4,
        tex: (s) => {
          if (Math.abs(Math.min(s.x - px, px + 4 - s.x, s.y - py, py + 4 - s.y) - 0.45) < 0.5 / s.d && (Math.floor((s.x + s.y) * 2) & 1) === 0) s.tone += 0.35;
        },
      });
    }
    // The tie: rope wound twice round the neck, the frayed tuft above.
    c.capsule(nx - 2, 4.5, nx + 1.6, 4.5, 0.55, 0.55, { mat: tie, z: 4.5, tex: twist(1, 0, 0, 0, 0.9) });
    c.capsule(nx - 1.8, 5.5, nx + 1.4, 5.6, 0.5, 0.5, { mat: tie, z: 4.6, tex: twist(1, 0, 0, 0, 0.9, 0.4) });
    for (const [x, y, r] of [[-1.2, 2.3, 0.5], [-0.3, 1.6, 0.55], [0.6, 2.1, 0.5], [1.3, 2.9, 0.4], [-1.6, 3.3, 0.4]] as const) {
      c.capsule(nx + x * 0.5, 3.9, nx + x, y, 0.45, r * 0.6, { mat: burlap, z: 4, tone: 0.12 });
    }
    fitHd(c, sackPiece(w, h, tilt));
    return c.render(HD_RENDER);
  });
}

/**
 * The HD parachute canopy (the `canopyPiece` box, 28 × 12): a lit dome of five gores, crimson and
 * ivory, each gore bulging between its seams, the scalloped hem (lifting on `phase` 1).
 */
export function canopyPieceHd(phase: number, d: HdD): PixelBuffer {
  return hdCached(`canopy:${phase}@${d}`, () => {
    const w = 26;
    const c = new HdCanvas(w + 2, 12, d);
    const ivory = c.material({ ramp: PAL_HD.snow, lo: 1, hi: 5, wrap: 0.1, spec: 0.2 });
    const crimson = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, wrap: 0.1, spec: 0.2 });
    const sag = phase ? 1 : 0;
    c.plane(1, 1, w, 10, {
      mat: ivory,
      z: 0,
      mask: (x, y) => {
        const g = ((x - 1) / w) * 5;
        const hem = 9 - sag - 0.7 * Math.abs(Math.sin(g * Math.PI));
        return ((x - 14) / 13) ** 2 + ((y - 9) / 8) ** 2 < 1 && y < hem + 0.7;
      },
      normal: (x, y, out) => {
        const g = ((x - 1) / w) * 5;
        const f = g - Math.floor(g) - 0.5;
        out[0] = ((x - 14) / 13) * 0.8 + f * 0.6;
        out[1] = ((y - 9) / 8) * 0.9;
        out[2] = 0.6;
      },
      tex: (s) => {
        const g = Math.floor(((s.x - 1) / w) * 5);
        if (g % 2 === 1) s.mat = crimson;
      },
    });
    fitHd(c, canopyPiece(phase));
    return c.render(HD_RENDER);
  });
}



// ------------------------------------------------------------------------------------ register



export function defineBindSprites(): void {
  // Every bind prop (item/bind/*): the baked 40 px set `bind` (1× at every tier, plan rule 7).
  defineBakedSet(BIND_SET);
}
