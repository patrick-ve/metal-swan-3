/**
 * HUD weapon icons (GDD §13.7: 16×8 at (4, 12), ammo digits at x 22): `ui/icon-<weapon id>`
 * (ARCHITECTURE §7.1) with the GDD aliases `ui/icon-weapon-<id>` and the old art aliases
 * (`rocket`, `flame`, `bouncer`). Side views facing right, top-left anchored, 1 px ink outline,
 * every icon at most 16×8 with its outline. One silhouette per weapon so they read at 1×.
 *
 * HD (UHD wave, 2× and 4×): every icon is drawn natively by one density-generic drawer
 * (`ICON_HD`, the HD kit) inside the 1× frame (same logical size, top-left anchor), PAL_HD only,
 * outline A, light from the upper left: bevelled gunmetal with near-white glints, grained wood,
 * olive and crimson paint, brass, glowing coils and flames; fine detail (serrations, vents,
 * rivets, grain, valve caps, studs) at 4× only. The weapons-art HUD icons `ui/icon-bomb`,
 * `ui/icon-hostage` and `ui/icon-shell` get their HD art here too (`defineWeaponIcons` runs
 * after weapons/art.ts registered their 1× art). One dense alias per extra name: the art of a
 * weapon is built and held once.
 */
import { ascii, type AsciiKey } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD, hdHome } from '../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineDenseAlias, defineHdSprite, defineSprite, getFrames, type DenseDensity } from '../../../engine/sprites';
import { HdCanvas, heldArtHd, wood, type RenderOpts, type Texture } from '../../art/hd/index';
import { hash2 } from '../../art/paint';

const KEY: AsciiKey = {
  // steel (0 dark … 4 light)
  '0': PAL.steel[0],
  '1': PAL.steel[1],
  '2': PAL.steel[2],
  '3': PAL.steel[3],
  '4': PAL.steel[4],
  // wood
  w: PAL.brown[1],
  W: PAL.brown[2],
  // olive
  o: PAL.olive[1],
  O: PAL.olive[2],
  P: PAL.olive[3],
  // crimson
  r: PAL.red[1],
  R: PAL.red[2],
  q: PAL.red[3],
  // teal / cyan
  t: PAL.teal[2],
  T: PAL.teal[3],
  // gold / brass
  g: PAL.gold[0],
  G: PAL.gold[1],
  y: PAL.gold[2],
  Y: PAL.gold[3],
  // ivory, sky
  v: PAL.snow[1],
  V: PAL.snow[3],
  s: PAL.sky[1],
  // flame
  f: PAL.orange[1],
  F: PAL.fire[5],
};

/** Icon drawings (≤ 14×6 inside the outline). */
export const ICON_ROWS: Readonly<Record<string, readonly string[]>> = {
  // A compact service pistol.
  pistol: [
    '.33333334', //
    '.22222223',
    '.1101....',
    '.00......',
    '.00......',
  ],
  // Carry handle, receiver, ventilated shroud, drum magazine, grips.
  'machine-gun': [
    '...111........', //
    '23333333444443',
    '2222222121212.',
    '11111111111111',
    '..00.GyG.00...',
    '.....GGG......',
  ],
  // Wooden stock, long barrel, pump grip.
  shotgun: [
    '...........34.', //
    'WWWW2222222223',
    'wwWW1111111111',
    'ww....wWWw....',
  ],
  // An olive tube with a crimson warhead peeking out, a grip and a sight.
  'rocket-launcher': [
    '....1.........', //
    'POOOOOOOOOOqq.',
    'OoOoooooooOqRR',
    'oooooooooooRr.',
    '.....00.......',
  ],
  // Fuel tank (crimson) under a long nozzle with a pilot flame.
  flamethrower: [
    '.............F', //
    '3333333333332f',
    '2222222222221.',
    '.qRRq..00.....',
    '.RRRr.........',
  ],
  // A sleek emitter with cyan coils and a glowing lens.
  laser: [
    '....tTTt......', //
    '33334TT433333T',
    '2222tttt22222t',
    '..00.....00...',
  ],
  // Two ivory missiles with crimson tips.
  homing: [
    '.vVVVVVVVVq.', //
    '1vvvvvvvvvRq',
    '............',
    '.vVVVVVVVVq.',
    '1vvvvvvvvvRq',
  ],
  // A brass tuba held like a gun: three valve caps on the tubing, the bell flaring forward
  // (side view: a cone that opens to a rim, the dark mouth inside).
  tuba: [
    '...........yY.', //
    '..V.V.V...yyY.',
    '.GyyyyyyyyyggY',
    '.GGGGGGGGGyggY',
    '..oo......yyY.',
    '...........yY.',
  ],
  // The disc mine hopping forward (motion lines behind it).
  'bounce-mine': [
    '........q.....', //
    '......34443...',
    '..yy.GyGyGyG..',
    'yy....22222...',
  ],
  // The hand grenade (the bomb button; GDD: 6×6).
  grenade: [
    '.33.', //
    'PPOo',
    'yYyG',
    'OOoo',
    '.oo.',
  ],
  // The knife (melee).
  knife: [
    '...4444.', //
    'ww333333',
    '...222..',
  ],
};

function icon(rows: readonly string[]): Frame[] {
  return [{ buf: ascii(rows, KEY).padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** HUD icon ids per weapon id: the weapon ids, the GDD names and the old art aliases. */
export const ICON_IDS: Readonly<Record<string, readonly string[]>> = {
  pistol: ['pistol'],
  'machine-gun': ['machine-gun'],
  shotgun: ['shotgun'],
  'rocket-launcher': ['rocket-launcher', 'rocket'],
  flamethrower: ['flamethrower', 'flame'],
  laser: ['laser'],
  homing: ['homing'],
  tuba: ['tuba'],
  'bounce-mine': ['bounce-mine', 'bouncer'],
  grenade: ['grenade'],
  knife: ['knife'],
};

export function defineWeaponIcons(): void {
  const opts = { anchor: 'top-left' } as const;
  for (const [weapon, names] of Object.entries(ICON_IDS)) {
    const gen = (): Frame[] => icon(ICON_ROWS[weapon]);
    const draw = ICON_HD[weapon];
    // The first name owns the HD art; the other names and the GDD alias show the same frames.
    const own = `ui/icon-${names[0]}`;
    for (const n of names) defineSprite(`ui/icon-${n}`, gen, opts);
    defineSprite(`ui/icon-weapon-${weapon}`, gen, opts);
    if (!draw) continue;
    defineHdSprite(own, (d) => iconHd(ICON_ROWS[weapon], d, draw));
    for (const n of names.slice(1)) defineDenseAlias(`ui/icon-${n}`, own);
    defineDenseAlias(`ui/icon-weapon-${weapon}`, own);
  }
  // The HUD icons of weapons/art.ts (their 1× art lives there): HD here.
  defineHdSprite('ui/icon-bomb', (d) => bombHd(d));
  defineHdSprite('ui/icon-hostage', (d) => framedHd('ui/icon-hostage', d, drawBowTie));
  defineHdSprite('ui/icon-shell', (d) => framedHd('ui/icon-shell', d, drawShell));
}

// ---------------------------------------------------------------------------------------------
// HD icons (2× and 4×)
// ---------------------------------------------------------------------------------------------

/** The render of every HD HUD icon: outline A, soft AO, separations, the thin cool rim. */
export const ICON_RENDER: RenderOpts = { outline: 'A', ao: 0.3, sep: true, sepZ: 0.3, rimLight: 1 };

/** The materials of the HD icons (one set per canvas). */
export interface IconMats {
  /** Gunmetal: strong specular, cool shade. */
  readonly steel: number;
  /** Blued / polymer parts: the dark end of the steel ramp, satin. */
  readonly dark: number;
  readonly wood: number;
  readonly olive: number;
  readonly red: number;
  /** Brass and gold: polished. */
  readonly gold: number;
  /** Ivory enamel (missiles). */
  readonly ivory: number;
  /** Emissive teal (laser coils, lens). */
  readonly glow: number;
  /** Emissive fire (pilot flame). */
  readonly fire: number;
}

export function iconMats(c: HdCanvas): IconMats {
  return {
    steel: c.material({ ramp: PAL_HD.steel, spec: 1, shine: 34, rim: 0.4, gain: 1.1, bounce: 0.3 }),
    dark: c.material({ ramp: PAL_HD.steel, lo: 1, hi: 4, spec: 0.6, shine: 22, rim: 0.4, gain: 1.05, amb: 0.15 }),
    wood: c.material({ ramp: PAL_HD.wood, lo: 1, hi: 6, spec: 0.35, shine: 16, gain: 1.1, wrap: 0.05 }),
    olive: c.material({ ramp: PAL_HD.olive, lo: 2, hi: 6, spec: 0.45, shine: 18, gain: 1.05, wrap: 0.05 }),
    red: c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, spec: 0.7, shine: 24, gain: 1.05, wrap: 0.05 }),
    gold: c.material({ ramp: PAL_HD.gold, lo: 1, hi: 6, spec: 1, shine: 30, rim: 0.4, gain: 1.1, bounce: 0.3 }),
    ivory: c.material({ ramp: PAL_HD.snow, lo: 1, hi: 5, spec: 0.8, shine: 26, gain: 1.05, wrap: 0.05 }),
    glow: c.material({ ramp: PAL_HD.teal, flat: true, lo: 2, hi: 6 }),
    fire: c.material({ ramp: PAL_HD.fire.slice(1), flat: true, lo: 1, hi: 6 }),
  };
}

/** An HD icon drawer: paints into a canvas of the 1× frame's logical size (the drawing at (1, 1)). */
export type IconDraw = (c: HdCanvas, m: IconMats) => void;

/** The HD frame of an ascii icon (`icon(rows)` geometry: the rows padded by 1, top-left anchored). */
function iconHd(rows: readonly string[], d: DenseDensity, draw: IconDraw): Frame[] {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const h = rows.length + 2;
  return [{ buf: paintIcon(w, h, d, draw), ox: 0, oy: 0, density: d }];
}

/** One HD frame of a w × h logical icon drawn by `draw` (outline A). */
export function paintIcon(w: number, h: number, d: DenseDensity, draw: IconDraw): PixelBuffer {
  const c = new HdCanvas(w, h, d);
  draw(c, iconMats(c));
  return c.render(ICON_RENDER);
}

/** The HD frame of a 1× HUD icon registered elsewhere (its 1× frame gives the size). */
function framedHd(id: string, d: DenseDensity, draw: IconDraw): Frame[] {
  return getFrames(id, 1).map((f) => ({ buf: paintIcon(f.buf.w, f.buf.h, d, draw), ox: f.ox, oy: f.oy, density: d }));
}

/** The bomb icon: the HD hand grenade of the rig (gear.ts) inside the 1× frame, outline A. */
function bombHd(d: DenseDensity): Frame[] {
  return getFrames('ui/icon-bomb', 1).map((f) => {
    const g = heldArtHd('grenade', d);
    const c = new HdCanvas(f.buf.w, f.buf.h, d);
    c.image(g, (f.buf.w - g.w / d) / 2, (f.buf.h - g.h / d) / 2);
    return { buf: c.render(ICON_RENDER), ox: f.ox, oy: f.oy, density: d };
  });
}

/** True for the art px of a line 1 art px wide every `step` logical px along `a`. */
function every(a: number, step: number, d: number, off = 0): boolean {
  const f = (((a - off) % step) + step) % step;
  return f < 1 / d;
}

/** A rivet or screw head (4×): lit upper-left px, dark lower-right px. */
function rivet(c: HdCanvas, x: number, y: number, ramp: Ramp = PAL_HD.steel, r = 0.3): void {
  const n = ramp.length;
  c.paint(x - r - 0.1, y - r - 0.1, 2 * r + 0.2, 2 * r + 0.2, (px, py) => {
    const dx = px - x;
    const dy = py - y;
    if (Math.hypot(dx, dy) > r) return 0;
    return dx + dy < -0.05 ? ramp[n - 2] : dx + dy > 0.05 ? ramp[2] : ramp[n - 4];
  }, 50);
}

/** Fine wear on metal: a soft mottle, tiny lit scratches and dark pits at 4×. */
function wear(seed: number, amount = 1): Texture {
  return (s) => {
    if (s.d < 4) return;
    const h = hash2(s.X, s.Y, seed);
    if (h > 0.985) s.tone += 0.22 * amount;
    else if (h < 0.012) s.tone -= 0.18 * amount;
  };
}

/** Chequered grip (4×): diamonds 2 art px wide. */
const chequer: Texture = (s) => {
  if (s.d >= 4 && ((Math.floor((s.X + s.Y) / 2) + Math.floor((s.X - s.Y + 64) / 2)) & 1) === 0) s.tone -= 0.16;
};

/** A dark bore at the muzzle: an ink slot with a lit lower lip at 4×. */
function bore(c: HdCanvas, x: number, y: number, h: number): void {
  const fine = c.d >= 4;
  c.paint(x, y, 0.5, h, (_px, py) => (fine && py > y + h - 0.25 ? PAL_HD.steel[3] : PAL_HD.ink[0]));
}

/** A specular glint: a white core with a short warm cross (4×), one white px at 2×. */
function glint(c: HdCanvas, x: number, y: number): void {
  if (c.d < 4) {
    c.dot(x, y, PAL_HD.snow[6]);
    return;
  }
  c.paint(x - 0.75, y - 0.75, 1.5, 1.5, (px, py) => {
    const dx = Math.abs(px - x);
    const dy = Math.abs(py - y);
    if (dx < 0.25 && dy < 0.25) return PAL_HD.snow[6];
    if ((dx < 0.13 && dy < 0.6) || (dy < 0.13 && dx < 0.6)) return PAL_HD.gold[7];
    return 0;
  });
}

/** The weapon drawers, by weapon id (coordinates: the 1× frame, the rows at (1, 1)). */
const ICON_HD: Readonly<Record<string, IconDraw>> = {
  pistol: drawPistol,
  'machine-gun': drawMachineGun,
  shotgun: drawShotgun,
  'rocket-launcher': drawRocketLauncher,
  flamethrower: drawFlamethrower,
  laser: drawLaser,
  homing: drawHoming,
  tuba: drawTuba,
  'bounce-mine': drawBounceMine,
  grenade: drawGrenade,
  knife: drawKnife,
};

/** Compact service pistol (11 × 7): bevelled slide with serrations, frame and guard, raked grip. */
function drawPistol(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  c.blob([[2, 3.4], [4.2, 3.4], [4.05, 6], [2, 6]], 0.45, { mat: m.dark, z: 0, bulge: 0.15, tex: chequer });
  if (fine) {
    rivet(c, 3.1, 4.7);
    c.shade(2, 5.55, 2.1, 0.25, () => -0.35); // the magazine base plate
  }
  c.box(2, 3, 3.6, 1, { mat: m.steel, z: 0.6, bevel: 0.3, tone: -0.25 });
  c.stroke([[4.4, 3.4], [4.6, 4.45], [5.9, 4.35], [6.1, 3.4]], 0.24, 0.24, { mat: m.steel, z: 0.5, tone: -0.35 });
  if (fine) c.capsule(5.0, 3.5, 4.9, 4.0, 0.16, 0.12, { mat: m.dark, z: 0.45 });
  const slide = c.newPart();
  c.box(2, 1, 8.6, 2, { mat: m.steel, z: 1.1, bevel: fine ? 0.45 : 0.35, r: 0.25, part: slide, tex: wear(41) });
  // Rear serrations, the ejection port and the sights.
  c.shade(2.4, 1.45, 1.8, 1.1, (x) => (every(x, fine ? 0.5 : 1, c.d, 2.4) ? -0.5 : 0), slide);
  if (fine) {
    c.shade(5.4, 1.3, 1.6, 0.5, (_x, y) => (y < 1.55 ? -0.6 : 0.15), slide);
    c.paint(9.7, 1.0, 0.25, 0.25, () => PAL_HD.snow[6]);
  }
  bore(c, 10.1, 1.5, 1);
  glint(c, 3.0, 1.25);
}

/** The machine gun (16 × 8): receiver, carry handle, vented shroud, brass drum, two grips. */
function drawMachineGun(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  // Grips (behind the receiver) and the drum.
  c.poly([[3.2, 4.6], [5.0, 4.6], [4.7, 6.8], [3.3, 6.8]], { mat: m.dark, z: 0, tex: chequer });
  c.box(10, 4.6, 2.1, 1.9, { mat: m.dark, z: 0, r: 0.3, bevel: 0.3 });
  if (fine) for (let i = 0; i < 3; i++) c.shade(10.2, 5.05 + i * 0.45, 1.7, 0.2, () => -0.35);
  const drum = c.newPart();
  c.ellipsoid(7.55, 5.7, 1.75, 1.3, { mat: m.gold, z: 0.4, part: drum });
  if (fine) {
    c.shade(5.8, 6.15, 3.5, 0.25, () => -0.45, drum);
    rivet(c, 7.55, 5.35, PAL_HD.gold);
  }
  // Carry handle.
  c.box(4, 1, 3.2, 1.2, { mat: m.dark, z: 1.2, r: 0.3, bevel: 0.3 });
  if (fine) c.shade(4.6, 1.45, 2.0, 0.45, () => -0.6);
  // Receiver, lower rail, shroud with vents, muzzle.
  const body = c.newPart();
  c.box(1, 2, 8.2, 3, { mat: m.steel, z: 1, bevel: 0.45, r: 0.2, part: body, tex: wear(43) });
  c.shade(1, 2, 1.4, 3, () => -0.35, body);
  if (fine) {
    c.shade(4.5, 2.6, 2.2, 0.6, (_x, y) => (y < 2.85 ? -0.55 : 0.1), body);
    rivet(c, 2.0, 2.6);
    rivet(c, 7.8, 4.3);
  }
  c.box(9, 4, 6, 1, { mat: m.dark, z: 0.8, bevel: 0.25 });
  const shroud = c.newPart();
  c.cylinder(9, 2, 5.6, 2.1, { mat: m.steel, z: 1.1, axis: 'h', part: shroud });
  c.shade(9.4, 2.35, 5, 1.4, (x, y) => (Math.abs(y - 3.05) < 0.4 && ((x - 9.4) % 1.25) < 0.62 ? -0.8 : 0), shroud);
  c.box(14.4, 2.3, 0.9, 1.5, { mat: m.steel, z: 1.3, bevel: 0.25 });
  bore(c, 14.8, 2.75, 0.75);
  glint(c, 2.6, 2.35);
}

/** The pump shotgun (16 × 6): wooden stock, long barrel over the magazine tube, ribbed pump. */
function drawShotgun(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  c.blob([[1, 2], [5.4, 2], [5.4, 4], [3.2, 4.1], [3, 5], [1, 5]], 0.5, { mat: m.wood, z: 0, bulge: 0.2, tex: wood({ dir: 'h', seed: 11 }) });
  if (fine) c.shade(1, 4.4, 2, 0.6, () => -0.4); // the rubber butt pad
  c.box(5, 2, 2.2, 2, { mat: m.steel, z: 0.5, bevel: 0.35, tone: -0.15 });
  c.cylinder(5.6, 3, 9.4, 1, { mat: m.dark, z: 0.6, axis: 'h' });
  c.cylinder(5.6, 2, 9.6, 1.05, { mat: m.steel, z: 0.9, axis: 'h', tex: wear(47) });
  c.box(12.2, 1.3, 1.6, 0.75, { mat: m.steel, z: 1, bevel: 0.2 });
  const pump = c.newPart();
  c.box(7, 3.6, 4, 1.4, { mat: m.wood, z: 1.2, r: 0.35, bevel: 0.35, part: pump, tex: wood({ dir: 'h', seed: 13 }) });
  c.shade(7.4, 3.7, 3.2, 1.2, (x) => (every(x, fine ? 0.5 : 1, c.d, 7.4) ? -0.45 : 0), pump);
  bore(c, 15.0, 2.15, 0.75);
  glint(c, 8, 2.2);
}

/** The rocket launcher (16 × 7): an olive tube with bands, a sight, the crimson warhead. */
function drawRocketLauncher(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  c.ellipsoid(12.9, 3.5, 2.1, 1.5, { mat: m.red, z: 0.3 });
  if (fine) c.shade(12.6, 2, 0.4, 3, () => -0.4);
  c.poly([[6.0, 4.5], [7.9, 4.5], [7.6, 6], [6.2, 6]], { mat: m.dark, z: 0, tex: chequer });
  c.box(4.5, 1, 1.6, 1.3, { mat: m.dark, z: 0.6, bevel: 0.25, r: 0.2 });
  if (fine) c.paint(5.6, 1.25, 0.5, 0.5, (px, py) => (Math.hypot(px - 5.85, py - 1.5) < 0.22 ? PAL_HD.glass[5] : 0));
  const tube = c.newPart();
  c.cylinder(1, 2, 11.2, 3, { mat: m.olive, z: 1, axis: 'h', part: tube });
  // Darker end bands, a sand stencil band at 4×, the open rear and front rims.
  c.shade(1, 2, 11.2, 3, (x) => (x < 1.9 || (x > 10.3 && x < 11.1) ? -0.45 : 0), tube);
  if (fine) {
    c.shade(8.2, 2, 0.5, 3, () => 0.5, tube);
    rivet(c, 2.6, 2.6, PAL_HD.olive);
    rivet(c, 9.4, 2.6, PAL_HD.olive);
  }
  glint(c, 4, 2.4);
}

/** The flamethrower (16 × 7): long nozzle, pilot flame, crimson fuel tank with a brass cap, grip. */
function drawFlamethrower(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  c.capsule(2.9, 5.0, 4.7, 5.0, 0.95, 0.95, { mat: m.red, z: 0.4 });
  c.ellipsoid(2.3, 4.7, 0.45, 0.5, { mat: m.gold, z: 0.7 });
  if (fine) c.stroke([[5.6, 5.0], [6.6, 4.6], [7.4, 3.9]], 0.18, 0.18, { mat: m.dark, z: 0.5 });
  c.box(8, 4, 2, 1.4, { mat: m.dark, z: 0.3, r: 0.3, bevel: 0.3, tex: chequer });
  const pipe = c.newPart();
  c.cylinder(1, 2, 12.6, 2, { mat: m.steel, z: 1, axis: 'h', part: pipe, tex: wear(53) });
  if (fine) c.shade(1, 2, 12.6, 2, (x) => (every(x, 2.5, c.d, 3) ? -0.5 : 0), pipe);
  c.box(12.7, 2.2, 1.2, 1.6, { mat: m.dark, z: 1.2, bevel: 0.3 });
  // The pilot flame: a hot core licking up from the nozzle.
  c.heightField(13.6, 0.9, 1.5, 3.2, (x, y) => {
    const t = (y - 1.0) / 2.9;
    if (t < 0 || t > 1) return NaN;
    const w = 0.62 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.55 + 0.45 * t);
    const cx = 14.25 + 0.15 * (1 - t);
    const u = Math.abs(x - cx) / Math.max(0.05, w);
    return u > 1 ? NaN : 1 - u;
  }, { mat: m.fire, z: 1.4, tex: (s) => (s.tone = 0.1 + 0.5 * Math.max(0, 1 - Math.abs(s.u - 0.5) * 2.2) * Math.min(1, s.v * 1.3)) });
  glint(c, 3.0, 2.3);
}

/** The laser (16 × 6): a sleek emitter with a glowing teal coil and lens, two grips. */
function drawLaser(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  c.box(3, 4, 2, 1.3, { mat: m.dark, z: 0, r: 0.3, bevel: 0.3, tex: chequer });
  c.box(10, 4, 2, 1.3, { mat: m.dark, z: 0, r: 0.3, bevel: 0.3 });
  const body = c.newPart();
  c.box(1, 2, 13.2, 2, { mat: m.steel, z: 1, r: 0.6, bevel: 0.5, part: body, tex: wear(59) });
  if (fine) c.shade(1.6, 2.4, 2.6, 0.3, () => -0.5, body);
  // The coil: glowing windings round the barrel, dark gaps between them.
  const coil = c.newPart();
  c.cylinder(5, 1, 4, 3.3, { mat: m.glow, z: 1.6, axis: 'h', part: coil });
  c.shade(5, 1, 4, 3.3, (x, y) => {
    const gap = every(x, fine ? 0.75 : 1, c.d, 5.3) ? -0.55 : 0;
    return gap + 0.7 * (1 - Math.abs(y - 2.4) / 1.7) - 0.15;
  }, coil);
  c.ellipsoid(14.3, 3, 0.75, 1.0, { mat: m.glow, z: 1.4, tone: 0.6 });
  if (fine) c.paint(14.25, 2.6, 0.5, 0.75, () => PAL_HD.teal[6]);
  glint(c, 2.4, 2.4);
}

/** Homing missiles (14 × 7): two ivory missiles with crimson noses and steel fins. */
function drawHoming(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  for (const y of [1, 4]) {
    c.ellipsoid(11.2, y + 1, 1.8, 1.0, { mat: m.red, z: 0.4 });
    c.poly([[1, y + 0.5], [2.6, y + 1], [2.6, y + 2], [1, y + 2]], { mat: m.steel, z: 0.3, tone: -0.2 });
    const body = c.newPart();
    c.cylinder(2, y, 9.3, 2, { mat: m.ivory, z: 1, axis: 'h', part: body });
    c.shade(9.6, y, 0.6, 2, () => -0.35, body);
    if (fine) {
      c.shade(3.2, y, 0.25, 2, () => -0.4, body);
      c.paint(5.2, y + 1.6, 1.6, 0.25, () => PAL_HD.red[4]);
    }
  }
  glint(c, 4, 1.4);
}

/** The tuba (16 × 8): brass tubing with three pearl valve caps, the flared bell, a grip. */
function drawTuba(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  const pearl = c.material({ ramp: PAL_HD.cloth, lo: 2, hi: 5, spec: 0.9, shine: 30 });
  c.box(3, 5, 2, 1.2, { mat: m.olive, z: 0, r: 0.3, bevel: 0.3 });
  for (const x of [3, 5, 7]) {
    c.cylinder(x - 0.05, 2.1, 1.0, 1.4, { mat: m.gold, z: 0.8, axis: 'v' });
    c.ellipsoid(x + 0.45, 2.05, 0.6, 0.42, { mat: pearl, z: 1.4 });
  }
  const tube = c.newPart();
  c.cylinder(2, 3, 10, 2, { mat: m.gold, z: 1, axis: 'h', part: tube });
  if (fine) c.shade(2, 3, 10, 2, (x) => (x > 9.2 && x < 9.45 ? -0.5 : 0), tube);
  // The bell: a flaring brass cone opening to the right, then its rim and the dark mouth.
  c.heightField(10, 0.9, 5.2, 6.4, (x, y) => {
    if (x > 14.6) return NaN;
    const t = Math.max(0, (x - 10.3) / 4.3);
    const r = 1.0 + 2.05 * t * t;
    const e = Math.abs(y - 4) / r;
    return e > 1 ? NaN : r * Math.sqrt(1 - e * e);
  }, { mat: m.gold, z: 1.2 });
  c.ellipsoid(14.6, 4, 0.5, 3.0, { mat: m.gold, z: 4.5, tone: 0.35 });
  c.paint(14.5, 1.4, 0.6, 5.2, (px, py) => {
    const e = ((px - 14.85) / 0.33) ** 2 + ((py - 4) / 2.35) ** 2;
    return e <= 1 ? (py < 3.2 ? PAL_HD.brown[1] : PAL_HD.ink[0]) : 0;
  });
  glint(c, 4.3, 3.35);
  glint(c, 12.6, 2.5);
}

/** The bounce mine (16 × 6): a steel dome on a studded brass rim, a red light, motion lines. */
function drawBounceMine(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  const dash = c.material({ ramp: PAL_HD.gold, flat: true, lo: 3, hi: 6 });
  c.capsule(3.4, 3.5, 4.7, 3.5, 0.42, 0.3, { mat: dash, z: 0, tone: 0.5 });
  c.capsule(1.4, 4.5, 2.7, 4.5, 0.42, 0.3, { mat: dash, z: 0, tone: 0.3 });
  c.ellipsoid(9.6, 4.35, 2.6, 0.75, { mat: m.dark, z: 0.4 });
  const rim = c.newPart();
  c.cylinder(6, 3.05, 7.2, 1.0, { mat: m.gold, z: 1, axis: 'h', part: rim, round: 0.8 });
  c.shade(6, 3, 7.2, 1.1, (x) => (Math.abs(((x - 6.6) % 1.5) - 0.75) < (fine ? 0.25 : 0.3) ? -0.5 : 0), rim);
  c.heightField(7, 1.8, 5.2, 1.4, (x, y) => {
    const e = ((x - 9.6) / 2.55) ** 2 + ((y - 3.1) / 1.2) ** 2;
    return y > 3.15 || e > 1 ? NaN : 1.1 * Math.sqrt(1 - e);
  }, { mat: m.steel, z: 0.8, tex: wear(61) });
  c.ellipsoid(9.6, 1.55, 0.6, 0.55, { mat: c.material({ ramp: PAL_HD.red, flat: true, lo: 4, hi: 7 }), z: 2, tone: 0.6 });
  c.dot(9.4, 1.35, PAL_HD.red[7]);
  glint(c, 8.4, 2.3);
}

/** The hand grenade (6 × 7): a segmented olive body, a brass band, the steel fuse cap. */
function drawGrenade(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  const body = c.newPart();
  c.ellipsoid(3, 4.35, 2, 2.15, { mat: m.olive, z: 0, part: body });
  c.shade(1, 2, 4, 5, (x, y) => (fine && (Math.abs(x - 3) < 0.12 || Math.abs(y - 5.3) < 0.12) ? -0.4 : 0), body);
  c.cylinder(1.05, 3.05, 3.9, 0.9, { mat: m.gold, z: 0.6, axis: 'h' });
  c.box(2, 1, 2, 1.4, { mat: m.steel, z: 1, bevel: 0.3, r: 0.2 });
  if (fine) c.stroke([[3.9, 1.6], [4.6, 2.4], [4.8, 3.0]], 0.15, 0.15, { mat: m.steel, z: 1.1 });
  glint(c, 2.2, 3.4);
}

/** The knife (10 × 5): a wooden handle, a dark guard, a ground steel blade with a bright edge. */
function drawKnife(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  c.capsule(1.6, 2.5, 3.0, 2.5, 0.55, 0.6, { mat: m.wood, z: 0, tex: wood({ dir: 'h', seed: 17 }) });
  if (fine) rivet(c, 2.2, 2.45, PAL_HD.gold, 0.25);
  c.box(3.3, 1.7, 0.7, 1.8, { mat: m.dark, z: 0.6, bevel: 0.25, r: 0.15 });
  const blade = c.newPart();
  c.poly([[3.8, 1.0], [8.0, 1.0], [9.0, 1.9], [8.6, 2.5], [7.3, 3.3], [4.2, 4.0], [3.8, 4.0]], { mat: m.steel, z: 0.4, part: blade, tex: wear(67) });
  // The ground edge (lighter) below the spine, the fuller line at 4×.
  c.shade(3.8, 1, 5.3, 3, (x, y) => (y > 2.55 - (x - 3.8) * 0.05 ? 0.35 : y < 1.35 ? 0.2 : 0) + (fine && Math.abs(y - 1.75) < 0.12 && x < 7.4 ? -0.4 : 0), blade);
  glint(c, 8.2, 1.6);
}

/** The bow tie (7 × 5): two crimson satin wings with folds round a gold knot. */
function drawBowTie(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  const satin = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, spec: 0.8, shine: 20, wrap: 0.1 });
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [[3.5 + s * 0.4, 2.2], [3.5 + s * 2.5, 1.0], [3.5 + s * 2.5, 4.0], [3.5 + s * 0.4, 2.8]];
    const wing = c.newPart();
    c.blob(pts, 0.6, { mat: satin, z: 0, part: wing, bulge: 0.3 });
    // Folds fanning out from the knot.
    c.shade(1, 1, 5, 3, (x, y) => {
      const a = Math.atan2(y - 2.5, (x - 3.5) * s);
      return fine && Math.abs(Math.sin(a * 3)) < 0.18 && Math.abs(x - 3.5) > 0.9 ? -0.35 : 0;
    }, wing);
  }
  c.box(3.0, 1.85, 1.0, 1.3, { mat: m.gold, z: 0.8, r: 0.3, bevel: 0.35 });
}

/** The vehicle shell (10 × 5): a steel ogive nose (left), the brass case, its rim and primer. */
function drawShell(c: HdCanvas, m: IconMats): void {
  const fine = c.d >= 4;
  c.heightField(1, 1, 3.2, 3, (x, y) => {
    const t = (x - 1) / 3.0;
    if (t < 0 || t > 1.05) return NaN;
    const r = 1.5 * Math.sqrt(Math.min(1, t * 1.6));
    const e = Math.abs(y - 2.5) / Math.max(0.05, r);
    return e > 1 ? NaN : r * Math.sqrt(1 - e * e);
  }, { mat: m.steel, z: 0.5 });
  const kase = c.newPart();
  c.cylinder(3.8, 1, 3.7, 3, { mat: m.gold, z: 0.6, axis: 'h', part: kase });
  if (fine) c.shade(3.8, 1, 0.3, 3, () => -0.45, kase);
  c.cylinder(7.3, 1, 0.9, 3, { mat: m.gold, z: 0.9, axis: 'h', tone: 0.2 });
  c.box(8.1, 2, 0.9, 1, { mat: m.gold, z: 1.1, bevel: 0.25, tone: -0.2 });
  glint(c, 5.3, 1.6);
}

/** The HD ramp of a 64-colour palette swatch (or `fallback` when it has none). */
export function hdRampOf(c: Color, fallback: Ramp = PAL_HD.gold): Ramp {
  return hdHome(c)?.ramp ?? fallback;
}
