/**
 * Art of the beer bike (docs/design/ams-extras.md §2.2, §2.3), 1× (PAL), 2× and 4× (PAL_HD) from
 * one density-generic drawer per strip (content/stag/kit.art.ts: an `HdCanvas` with the ramps of
 * the density). Geometry: geometry.ts. Outline A (it moves and can be hit).
 *
 * Every strip but the wheels, the keg, the cork, the foam and the debris is anchored at the bike's
 * anchor (the ground under its middle), so the parts are drawn at (x, y) with the facing's flip:
 * - `vehicle/beer-bike/body` (3): the bike behind the riders — canopy roof with red and cream
 *   stripes and a scalloped valance, the far posts, the oak bar counter (planks, a lit top, a brass
 *   tap tower, beer glasses), the steel chassis, four red stools with pedal hubs, the driver's
 *   saddle, the steering column with handlebar and bell, the lamp, the keg rack at the back, the
 *   keg on the roof and its hose down the front post;
 *   frame 1 = damaged (cracked planks, a torn stripe, a glass gone).
 * - `…/posts` (1): the two near roof posts, drawn over the riders.
 * - `…/turret` (5): the brass tap on the front crate (the cork cannon, fed by the roof keg through
 *   a hose), steps 0° … −90°.
 * - `…/wheel`, `…/wheel-far` (4 each, centre anchor): spoked wheels turning by 22.5° a frame.
 * - `…/wreck` (1): the burnt-out bike. `…/keg` (4, centre): the rolling keg (end view, a lit
 *   fuse). `…/cork` (4): the cannon's cork. `…/foam` (4, anchor at the nozzle): the foam spray
 *   cone. `…/debris` (4): a plank, a keg hoop, a stool cushion, a beer glass.
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../../engine/sprites';
import { HdCanvas, wood } from '../../../art/hd';
import { onBoxes } from '../../locals/rider.hd';
import { corkFrames, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { BEER_BIKE as G, TURRET_STEPS, turretAngle } from './geometry';

export const ART = 'vehicle/beer-bike';

/** Canvas origin of the body-anchored strips: body x −54 … +60, y −80 … +2. */
const OX = 54;
const OY = 80;
const CW = 114;
const CH = 82;
const X = (x: number): number => x + OX;
const Y = (y: number): number => y + OY;

function frameOf(buf: PixelBuffer, d: Dn, ox = OX, oy = OY): Frame {
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

const frac = (v: number): number => v - Math.floor(v);

type BodyState = 'ok' | 'damaged' | 'wreck';

/** The bike behind the riders (see the header). */
function bodyFrame(state: BodyState, d: Dn): Frame {
  const c = new HdCanvas(CW, CH, d);
  const wreck = state === 'wreck';
  const dark = wreck ? -0.55 : 0;
  const steel = mat(c, wreck ? 'black' : 'steel', { spec: wreck ? 0.2 : 0.9, shine: 28, lo1: 1, hi1: 3 });
  const steelDk = mat(c, wreck ? 'black' : 'slate', { spec: 0.5, shine: 20, lo1: 0, hi1: 2 });
  const oak = mat(c, wreck ? 'black' : 'wood', { spec: 0.35, shine: 14, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const oakTop = mat(c, wreck ? 'black' : 'wood', { spec: 0.6, shine: 22, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const red = mat(c, wreck ? 'black' : 'red', { spec: 0.3, shine: 12, lo1: 0, hi1: 3 });
  const cream = mat(c, wreck ? 'stone' : 'snow', { spec: 0.15, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const leather = mat(c, wreck ? 'black' : 'red', { spec: 0.6, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const black = mat(c, 'black', { spec: 0.5, shine: 18, lo1: 0, hi1: 3 });
  const brass = mat(c, wreck ? 'brown' : 'gold', { spec: 1.2, shine: 36, lo1: 0, hi1: 3, lo: 2, hi: 6 });
  const amber = mat(c, wreck ? 'black' : 'orange', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const torn = (x: number, y: number): boolean => wreck && frac(Math.sin(x * 1.7 + y * 3.1) * 43758.5453) > 0.86;

  // Far roof posts (behind everything).
  for (const px of [-41, 41]) c.capsule(X(px), Y(G.roof.bottom), X(px), Y(-12), 0.6, 0.6, { mat: steelDk, z: 0, tone: -0.2 + dark });

  // The canopy roof: red and cream stripes, a lit front lip, the scalloped valance.
  const rx0 = G.roof.x0;
  const rw = G.roof.x1 - G.roof.x0;
  const stripe = (x: number): boolean => Math.floor((x - X(rx0)) / 6) % 2 === 0;
  const roofTex = (t: { x: number; y: number; mat: number; tone: number; cut: boolean }): void => {
    t.mat = stripe(t.x) ? red : cream;
    if (state === 'damaged' && t.x > X(-14) && t.x < X(-8) && t.y > Y(-60)) t.cut = true;
    if (torn(t.x, t.y)) t.cut = true;
  };
  c.box(X(rx0), Y(G.roof.top), rw, 4.5, { mat: red, z: 4, r: 0.6, bevel: 0.8, tex: roofTex });
  c.box(X(rx0), Y(G.roof.top + 4.3), rw, 3.4, {
    mat: red,
    z: 4.2,
    round: 0.4,
    tex: (t) => {
      roofTex(t);
      // Scallops: each 6-px stripe ends in a half disc.
      const u = frac((t.x - X(rx0)) / 6) * 2 - 1;
      if (t.y - Y(G.roof.top + 4.3) > 1.2 + 2.2 * Math.sqrt(Math.max(0, 1 - u * u))) t.cut = true;
      t.tone -= 0.12;
    },
  });
  // A brass trim rail along the roof edge.
  c.capsule(X(rx0 + 0.5), Y(G.roof.top + 0.3), X(G.roof.x1 - 0.5), Y(G.roof.top + 0.3), 0.45, 0.45, { mat: brass, z: 4.6, tone: dark });
  roofKeg(c, wreck);

  // Keg rack at the back: a standing keg in a steel cradle.
  c.cylinder(X(-50), Y(-24), 6, 12, { mat: oak, z: 1.2, tex: wood({ seed: 4, dir: 'v', plank: 1.5 }), tone: dark });
  for (const hy of [-22, -15]) c.box(X(-50.2), Y(hy), 6.4, 1, { mat: steel, z: 1.4, round: 0.8 });
  c.capsule(X(-50), Y(-11.5), X(-44), Y(-11.5), 0.6, 0.6, { mat: steelDk, z: 1.3 });

  // The bar counter: a planked front panel and a thick lit top.
  const cx0 = G.counter.x0;
  const cx1 = G.counter.x1;
  c.box(X(cx0 + 2), Y(G.counter.top + 3), cx1 - cx0 - 4, 11, {
    mat: oak,
    z: 1,
    tex: (t) => {
      wood({ seed: 7, dir: 'h', plank: 2.6 })(t as never);
      if (state === 'damaged' && Math.abs(t.y - Y(-19) - (t.x - X(-30)) * 0.35) < 0.35 && t.x > X(-34) && t.x < X(-20)) t.tone -= 0.8;
      if (torn(t.x, t.y)) t.tone -= 0.6;
      t.tone += dark;
    },
  });
  // Vertical posts of the counter panel (every 13 px, between the stools).
  for (let px = cx0 + 4; px < cx1 - 2; px += 13) c.box(X(px), Y(G.counter.top + 3), 1.4, 11, { mat: oak, z: 1.3, round: 0.6, tone: -0.2 + dark });
  c.box(X(cx0), Y(G.counter.top), cx1 - cx0, 3.2, { mat: oakTop, z: 2, r: 0.4, bevel: 0.7, tex: wood({ seed: 9, dir: 'h' }), tone: dark });

  if (!wreck) {
    // The tap tower in the middle: a brass column, two black handles, a drip tray.
    c.cylinder(X(-16), Y(-34), 3.4, 7.2, { mat: brass, z: 2.6, cap: 0.6 });
    c.capsule(X(-15.6), Y(-34), X(-16.2), Y(-37.5), 0.55, 0.65, { mat: black, z: 2.8 });
    c.capsule(X(-13.4), Y(-34), X(-12.8), Y(-37.5), 0.55, 0.65, { mat: black, z: 2.8 });
    c.capsule(X(-12.5), Y(-31.5), X(-11.2), Y(-30.8), 0.45, 0.4, { mat: brass, z: 2.8 });
    // Beer glasses on the counter (amber with a white head).
    const glasses = state === 'damaged' ? [-38, 9] : [-38, -3, 9];
    for (const gx of glasses) {
      c.box(X(gx), Y(-30.4), 2.2, 3.3, { mat: amber, z: 2.3, round: 0.7 });
      c.box(X(gx - 0.1), Y(-31.4), 2.4, 1.2, { mat: cream, z: 2.35, round: 0.6, tone: 0.2 });
    }
  }

  // The steel chassis under it all.
  c.box(X(-48), Y(-13), 88, 3, { mat: steel, z: 1.5, r: 0.4, bevel: 0.6, tone: dark });

  // Stools: red leather seats on short posts; a pedal hub in front of each.
  for (const sx of G.stools) {
    c.capsule(X(sx), Y(-15.5), X(sx), Y(-11.5), 0.6, 0.6, { mat: steel, z: 1.8, tone: dark });
    c.box(X(sx - 3), Y(-17.4), 6, 2.2, { mat: leather, z: 2, r: 0.9, bevel: 0.6, tone: dark });
    c.ellipsoid(X(sx + 6), Y(-7), 1.1, 1.1, { mat: steelDk, z: 1.7 });
    c.capsule(X(sx + 6), Y(-7), X(sx + 5), Y(-11), 0.45, 0.45, { mat: steelDk, z: 1.6 });
  }

  // The driver's saddle, its post, the steering column, the handlebar and the bell.
  const [dx] = G.driver;
  c.capsule(X(dx), Y(-16.5), X(dx - 1), Y(-11), 0.6, 0.6, { mat: steel, z: 1.8, tone: dark });
  c.box(X(dx - 3.5), Y(-19.4), 7, 2.4, { mat: black, z: 2.1, r: 1, bevel: 0.6 });
  c.ellipsoid(X(dx + 6), Y(-7), 1.1, 1.1, { mat: steelDk, z: 1.7 });
  const [bx, by] = G.bar;
  c.capsule(X(37), Y(-10.5), X(bx + 1.5), Y(by + 0.5), 0.8, 0.7, { mat: steel, z: 2.4, tone: dark });
  c.capsule(X(bx - 2.5), Y(by), X(bx + 2), Y(by), 0.6, 0.6, { mat: black, z: 2.6 });
  if (!wreck) c.ellipsoid(X(bx + 2.6), Y(by - 0.9), 0.9, 0.8, { mat: brass, z: 2.7 });
  // The front: a small wooden crate on the fork and the lamp.
  c.box(X(38), Y(-18), 6, 6, { mat: oak, z: 2.2, r: 0.5, bevel: 0.5, tex: wood({ seed: 2, dir: 'h', plank: 2 }), tone: dark });
  c.capsule(X(38), Y(-12), X(44), Y(-11.5), 0.7, 0.7, { mat: steel, z: 1.6, tone: dark });
  if (!wreck) {
    c.ellipsoid(X(44.5), Y(-15), 1.3, 1.3, { mat: brass, z: 2.5 });
    c.dot(X(45), Y(-15.3), top('gold', d, 0));
  }
  if (wreck) {
    // Soot and a broken roof edge: cut a few bites out of the canopy.
    c.erase(X(-20), Y(-66), 30, 10, (x, y) => y < Y(-58) && frac(Math.sin(x * 0.9) * 91.7) > 0.6 && y > Y(-64.5) + frac(x * 0.37) * 3);
  }
  return frameOf(finishA(c, 0.3), d);
}

/** The two near roof posts (drawn over the riders). */
function postsFrame(d: Dn): Frame {
  const c = new HdCanvas(CW, CH, d);
  const steel = mat(c, 'steel', { spec: 0.9, shine: 28, lo1: 1, hi1: 3 });
  for (const px of [-46, 39]) c.capsule(X(px), Y(G.roof.bottom + 0.5), X(px), Y(-11.5), 0.7, 0.7, { mat: steel, z: 3 });
  return frameOf(finishA(c, 0.2), d);
}

/** The roof keg on its bracket (static, part of the body) and the hose down the front post. */
function roofKeg(c: HdCanvas, wreck: boolean): void {
  const oak = mat(c, wreck ? 'black' : 'wood', { spec: 0.4, shine: 14, lo1: 0, hi1: 3 });
  const steel = mat(c, wreck ? 'black' : 'steel', { spec: 0.9, shine: 30, lo1: 1, hi1: 3 });
  const hose = mat(c, 'black', { spec: 0.6, shine: 20, lo1: 0, hi1: 3 });
  c.box(X(-7), Y(-65.6), 10, 2, { mat: steel, z: 4.8, r: 0.4, bevel: 0.4 });
  c.cylinder(X(-10), Y(-73), 12, 8, { mat: oak, z: 5, axis: 'h', tex: wood({ seed: 11, dir: 'h', plank: 2 }) });
  for (const hx of [-8.5, -1.5]) c.cylinder(X(hx), Y(-73.2), 1.1, 8.4, { mat: steel, z: 5.2 });
  c.ellipsoid(X(2), Y(-69), 1.5, 4, { mat: steel, z: 5.3 });
  if (wreck) return;
  // The hose: from the keg's tap end over the roof's front edge, down beside the front post.
  c.stroke([[X(3), Y(-68)], [X(10), Y(-66.5)], [X(30), Y(-65.5)], [X(41), Y(-64.5)], [X(43.5), Y(-60)], [X(43.5), Y(-28)], [X(45), Y(-25)]], 0.55, 0.55, { mat: hose, z: 3.5 });
}

/** The brass tap on the front crate (the cork cannon) at step `s` (0 forward … 4 up). */
function turretFrame(s: number, d: Dn): Frame {
  const c = new HdCanvas(CW, CH, d);
  const brass = mat(c, 'gold', { spec: 1.2, shine: 36, lo1: 0, hi1: 3, lo: 2, hi: 6 });
  const black = mat(c, 'black', { spec: 0.5, shine: 18, lo1: 0, hi1: 3 });
  const steel = mat(c, 'steel', { spec: 0.9, shine: 30, lo1: 1, hi1: 3 });
  const a = turretAngle(s);
  const [px, py] = G.pivot;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const tip = G.spout;
  // The swivel collar on the crate, the brass tube along the step's angle, a wide mouth.
  c.box(X(px - 2.2), Y(py + 1.2), 3.4, 2.4, { mat: steel, z: 1, r: 0.4, bevel: 0.4 });
  c.ellipsoid(X(px), Y(py), 1.7, 1.7, { mat: brass, z: 2 });
  c.capsule(X(px), Y(py), X(px + ux * (tip - 1.2)), Y(py + uy * (tip - 1.2)), 1.0, 0.9, { mat: brass, z: 2.2 });
  c.capsule(X(px + ux * (tip - 1.6)), Y(py + uy * (tip - 1.6)), X(px + ux * tip), Y(py + uy * tip), 1.2, 1.5, { mat: brass, z: 2.3 });
  // The handle sticks up from the tube (perpendicular, on its upper side).
  const hx0 = px + ux * 2.4;
  const hy0 = py + uy * 2.4;
  c.capsule(X(hx0), Y(hy0), X(hx0 + uy * 3.4), Y(hy0 - ux * 3.4), 0.55, 0.75, { mat: black, z: 2.4 });
  return frameOf(finishA(c, 0.25), d);
}

/** A spoked wheel (`far`: the darker far pair) turned by `phase` × 22.5°. */
function wheelFrame(phase: number, far: boolean, d: Dn): Frame {
  const R0 = G.wheelR;
  const S = 2 * R0 + 4;
  const c = new HdCanvas(S, S, d);
  const cx = S / 2;
  const tyre = mat(c, 'black', { spec: 0.35, shine: 14, lo1: 0, hi1: 3 });
  const rim = mat(c, 'steel', { spec: 1, shine: 34, lo1: 1, hi1: 3 });
  const hub = mat(c, 'red', { spec: 0.6, shine: 20, lo1: 0, hi1: 3 });
  const tone = far ? -0.3 : 0;
  c.ellipsoid(cx, cx, R0, R0, {
    mat: tyre,
    z: 0,
    tone,
    tex: (t) => {
      const r = Math.hypot(t.x - cx, t.y - cx);
      if (r < R0 - 1.6) {
        t.mat = rim;
        t.nx *= 0.3;
        t.ny *= 0.3;
        // The rim's inside is open: spokes only.
        const ang = Math.atan2(t.y - cx, t.x - cx) - (phase * Math.PI) / 8;
        const spoke = Math.abs(Math.sin(ang * 3)) * r;
        if (r > R0 - 2.6) t.tone += 0.1;
        else if (r > 1.6 && spoke > (d === 1 ? 0.75 : 0.42)) t.cut = true;
      } else if (d === 4 && frac((Math.atan2(t.y - cx, t.x - cx) / (Math.PI * 2)) * 24 + phase / 4) < 0.25) t.tone -= 0.12;
    },
  });
  c.ellipsoid(cx, cx, 1.4, 1.4, { mat: hub, z: 1, tone });
  const buf = finishA(c, 0.2);
  return frameOf(buf, d, cx, cx);
}

/** The rolling keg seen from its end: oak staves in a steel chime, a brass bung with a fuse. */
function kegFrame(i: number, d: Dn): Frame {
  const c = new HdCanvas(12, 12, d);
  const oak = mat(c, 'wood', { spec: 0.4, shine: 14, lo1: 0, hi1: 3 });
  const steel = mat(c, 'steel', { spec: 1, shine: 30, lo1: 1, hi1: 3 });
  const brass = mat(c, 'gold', { spec: 1.2, shine: 36, lo1: 0, hi1: 3 });
  const rot = (i * Math.PI) / 4;
  c.ellipsoid(6, 6, 4.6, 4.6, {
    mat: steel,
    z: 0,
    tex: (t) => {
      const r = Math.hypot(t.x - 6, t.y - 6);
      if (r < 3.6) {
        t.mat = oak;
        t.nx *= 0.4;
        t.ny *= 0.4;
        const ang = Math.atan2(t.y - 6, t.x - 6) - rot;
        if (Math.abs(Math.sin(ang * 3)) < (d === 1 ? 0.18 : 0.1) * (4 / Math.max(1, r))) t.tone -= 0.35;
      }
    },
  });
  const bx = 6 + Math.cos(rot + 0.7) * 2;
  const by = 6 + Math.sin(rot + 0.7) * 2;
  c.ellipsoid(bx, by, 0.9, 0.9, { mat: brass, z: 1 });
  if (i % 2 === 0) c.dot(bx + 0.2, by - 0.6, top('gold', d, 0));
  else c.dot(bx + 0.2, by - 0.6, top('orange', d, 0));
  return frameOf(finishA(c, 0.2), d, 6, 6);
}

/** The foam spray cone from the nozzle (anchor at its left middle): 4 frames. */
function foamFrame(i: number, d: Dn): Frame {
  const W = 68;
  const H = 32;
  const c = new HdCanvas(W, H, d);
  const foam = mat(c, 'snow', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 7, wrap: 0.3 });
  const cream = mat(c, 'sand', { spec: 0.15, lo1: 2, hi1: 3, lo: 4, hi: 6, wrap: 0.3 });
  const reach = [26, 60, 62, 58][i];
  const n = [16, 38, 42, 22][i];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = 2 + t * reach;
    const spread = 1.2 + t * 8.5;
    // A golden-angle walk across the cone keeps the bubbles evenly mixed.
    const y = H / 2 + Math.sin(k * 2.39996 + i * 0.7) * spread;
    const r = (1.6 + t * 3.0) * (i === 3 ? 0.75 : 1);
    if (i === 3 && k % 3 === 0) continue;
    c.ellipsoid(x, y, r, r * 0.9, { mat: k % 5 === 2 ? cream : foam, z: 1 + t + (k % 3) * 0.2 });
  }
  return frameOf(finishA(c, 0.15), d, 0, H / 2);
}

/** Wreck debris: a plank, a keg hoop, a stool cushion, a beer glass (random frames). */
function debrisFrame(i: number, d: Dn): Frame {
  const c = new HdCanvas(10, 10, d);
  if (i === 0) {
    const oak = mat(c, 'wood', { spec: 0.3, lo1: 0, hi1: 3 });
    c.box(1, 3.5, 8, 2.6, { mat: oak, z: 0, r: 0.3, bevel: 0.4, tex: wood({ seed: 5 }) });
  } else if (i === 1) {
    const steel = mat(c, 'steel', { spec: 1, shine: 30, lo1: 1, hi1: 3 });
    c.ellipsoid(5, 5, 3.6, 2.4, { mat: steel, z: 0, tex: (t) => {
      if (((t.x - 5) / 2.6) ** 2 + ((t.y - 5) / 1.4) ** 2 < 1) t.cut = true;
    } });
  } else if (i === 2) {
    const red = mat(c, 'red', { spec: 0.6, shine: 22, lo1: 0, hi1: 3 });
    c.box(2, 3.5, 6, 3, { mat: red, z: 0, r: 1, bevel: 0.7 });
  } else {
    const amber = mat(c, 'orange', { spec: 1, shine: 40, lo1: 1, hi1: 3 });
    const cream = mat(c, 'snow', { spec: 0.1, lo1: 2, hi1: 3 });
    c.box(3.6, 3.4, 2.8, 4, { mat: amber, z: 0, round: 0.7 });
    c.box(3.4, 2.4, 3.2, 1.3, { mat: cream, z: 0.1, round: 0.6 });
  }
  return frameOf(finishA(c, 0.2), d, 5, 5);
}

// ------------------------------------------------------------------------------------ registry

/** Register a strip at 1× and its 2× / 4× art cut to the 1× boxes (geometry is law). */
function defHi(id: string, gen: (d: Dn) => Frame[], o: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...o, hd: (d) => onBoxes(gen(d), getFrames(id, 1), d) });
}

const o: SpriteOpts = { trim: true };
defHi(`${ART}/body`, (d) => [bodyFrame('ok', d), bodyFrame('damaged', d)], { ...o, ticksPerFrame: 9999 });
defHi(`${ART}/posts`, (d) => [postsFrame(d)], o);
defHi(`${ART}/turret`, (d) => Array.from({ length: TURRET_STEPS }, (_, s) => turretFrame(s, d)), { ...o, ticksPerFrame: 9999 });
defHi(`${ART}/wheel`, (d) => [0, 1, 2, 3].map((p) => wheelFrame(p, false, d)), { ticksPerFrame: 9999 });
defHi(`${ART}/wheel-far`, (d) => [0, 1, 2, 3].map((p) => wheelFrame(p, true, d)), { ticksPerFrame: 9999 });
defHi(`${ART}/wreck`, (d) => [bodyFrame('wreck', d)], { ...o, defer: true });
defHi(`${ART}/keg`, (d) => [0, 1, 2, 3].map((i) => kegFrame(i, d)), { ticksPerFrame: 4 });
defHi(`${ART}/foam`, (d) => [0, 1, 2, 3].map((i) => foamFrame(i, d)), { durations: [3, 5, 6, 6], loop: false, defer: true });
defHi(`${ART}/debris`, (d) => [0, 1, 2, 3].map((i) => debrisFrame(i, d)), { ticksPerFrame: 9999, defer: true });
defineSprite(`${ART}/cork`, () => corkFrames(1), { ticksPerFrame: 3, hd: (d) => corkFrames(d) });
