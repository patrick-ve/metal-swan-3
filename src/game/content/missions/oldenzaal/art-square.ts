/**
 * Plechelmusplein (oz-c) — the square's layout and its own art (STATUE, wave B; spec §2, §5.1,
 * §10.1, §10.3; revision 2: abandoned, night, a full moon). A likeness by eye, never traced.
 *
 * - Layout: the approach (x 0 … ARENA_L) and the camera-lock arena (ARENA_L … OZ_C_W2) with the
 *   statue's plinth at STATUE_X and the basilica's red doors (the exit to oz-d) at DOOR_X.
 * - The backdrop: the night sky with the full moon, the far town, and the basilica's long side
 *   NEAR (TOWN's `oz-basilica` generator at s = BASILICA_S, moving with the world): its tower
 *   rises at the arena's left, the nave's tall windows stand behind the statue, its red doors
 *   at DOOR_X are the exit. `squareDoors()` is the door overlay that opens after the fight.
 * - Decor: TOWN's double street lamps (most dead, one by the statue still burning), benches,
 *   bins and bollards; our own abandoned things (`decor/oz-square/litter`: a toppled bin with
 *   rubbish, blown newspapers, a dropped umbrella, a fallen crowd barrier, a lost bike) and
 *   cracks with weeds in the pavers (`decor/oz-square/cracks`). Outline C (static decor).
 *
 * Sprites (1×, 2×, 4× from one drawer each, `decor/oz-square/…`): `litter` (5), `cracks` (3),
 * `doors` (5: closed → open; frame 0 draws nothing, the background's closed doors show).
 */
import type { Color } from '../../../../engine/color';
import type { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { Entity as BaseEntity } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import type { BackgroundDef, DecorDef } from '../../../mission/index';
import { defineEntity } from '../../../registry';
import { LIGHT_TAG, type LightSource, type LightSpot, type StaticLight } from '../../oldenzaal/kit/light-api';
import { archPointed, dim, F, h2, outlineC, Pen, snap, T, type Dn, type FrameGeom } from './art-kit';
import { defineSprite } from '../../../../engine/sprites';
import type { Frame } from '../../../../engine/render';
import { LAMP_HEADS } from './art-street';
import { G } from './terrain';

// ------------------------------------------------------------------------------------ layout

/** The square's width (the approach + the arena). */
export const OZ_C_W2 = 1088;
/** The camera-lock arena (one view wide). */
export const ARENA_L = OZ_C_W2 - 384;
export const ARENA_R = OZ_C_W2;
/** The statue's plinth (foot centre x). */
export const STATUE_X = ARENA_L + 268;
/** The checkpoints (≤ 1,400 px apart; the arena's own one). */
export const OZ_C_CHECKPOINTS: readonly number[] = [ARENA_L + 40];

/** The basilica layer: the generator's left `x`, its scale, and where the layer sits in the world. */
export const BASILICA_S = 7;
const BASILICA_X = 16;
const BASILICA_LAYER_W = 420;
/** TOWN's drawBasilica: the doors' bay starts 30.6 units right of the tower's left; the doors' centre 35.6 units. */
const DOOR_BAY_UNITS = 30.6;
const DOOR_CENTER_UNITS = 35.6;
/** The doors' centre in the world (the exit). */
export const DOOR_X = STATUE_X + 74;
/** The layer's world offset that puts the generator's doors at DOOR_X. */
export const BASILICA_OFFSET = DOOR_X - BASILICA_X - DOOR_CENTER_UNITS * BASILICA_S;
/** The doors' opening (both leaves) in world px: left, top, width, height (TOWN's arch numbers × s). */
export const DOOR_RECT = {
  x: BASILICA_OFFSET + BASILICA_X + (DOOR_BAY_UNITS + 3) * BASILICA_S,
  y: G - 5.2 * BASILICA_S,
  w: (2.1 + 1.8) * BASILICA_S,
  h: 5.2 * BASILICA_S,
} as const;
/** The exit rect (a hero's feet in the open doorway). */
export const OZ_C_EXIT = { x: Math.round(DOOR_RECT.x + 2), y: G - 40, w: Math.round(DOOR_RECT.w - 4), h: 40 } as const;

/** oz-c: night, a full moon over Plechelmusplein, the basilica's long side near. */
export const BG_OZ_C_SQUARE: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'oz-sky', params: { light: 'night', moonX: 0.13, moonY: 0.15 }, width: 384, factorX: 0 },
    { gen: 'oz-far', params: { light: 'night', y: 0.6, air: 0.45 }, width: 768, factorX: 0.08 },
    { gen: 'oz-basilica', params: { light: 'night', x: BASILICA_X, base: G, s: BASILICA_S, air: 0.06 }, width: BASILICA_LAYER_W, factorX: 1, offsetX: BASILICA_OFFSET, repeatX: false },
  ],
};

/** The lamps of the square: x and burning (most are dead after the outbreak). */
export const OZ_C_LAMPS: ReadonlyArray<readonly [number, boolean]> = [
  [120, false],
  [360, true],
  [600, false],
  [STATUE_X - 64, true],
];

const WARM: Color = PAL_HD_OZ.candle[5];
const MOON: Color = PAL_HD_OZ.night[6];

/** The light pass's lamps: the burning lamps' left heads, the moonlight on the statue, the doors' gloom. */
export const OZ_C_LAMP_LIGHTS: readonly StaticLight[] = [
  ...OZ_C_LAMPS.filter(([, lit]) => lit).flatMap(([x], i): StaticLight[] => [
    { x: x + LAMP_HEADS[0][0], y: G + LAMP_HEADS[0][1], r: 50, color: WARM, intensity: 0.9, flicker: i === 0 ? 0.35 : 0.06 },
    { x: x + LAMP_HEADS[1][0], y: G + LAMP_HEADS[1][1], r: 30, color: WARM, intensity: 0.4, flicker: 0.5 },
  ]),
  { x: STATUE_X, y: G - 80, r: 56, color: MOON, intensity: 0.3 },
];

/** The square's decor (behind the entities). */
export const OZ_C_DECOR: readonly DecorDef[] = [
  ...OZ_C_LAMPS.map(([x, lit]): DecorDef => ({ sprite: 'decor/oz/lamp', frame: lit ? 0 : 1, x, y: G })),
  { sprite: 'decor/oz-square/cracks', frame: 0, x: 70, y: G },
  { sprite: 'decor/oz/bench', x: 200, y: G },
  { sprite: 'decor/oz-square/litter', frame: 0, x: 236, y: G },
  { sprite: 'decor/oz-square/cracks', frame: 1, x: 300, y: G },
  { sprite: 'decor/oz/bin', x: 410, y: G },
  { sprite: 'decor/oz-square/litter', frame: 1, x: 452, y: G },
  { sprite: 'decor/oz-square/litter', frame: 4, x: 520, y: G },
  { sprite: 'decor/oz-square/cracks', frame: 2, x: 566, y: G },
  { sprite: 'decor/oz/bollard', x: 650, y: G },
  { sprite: 'decor/oz/bollard', x: 676, y: G },
  { sprite: 'decor/oz-square/litter', frame: 3, x: ARENA_L + 34, y: G },
  { sprite: 'decor/oz/bench', x: ARENA_L + 110, y: G },
  { sprite: 'decor/oz-square/cracks', frame: 0, x: ARENA_L + 150, y: G },
  { sprite: 'decor/oz-square/litter', frame: 2, x: STATUE_X - 104, y: G },
  { sprite: 'decor/oz-square/cracks', frame: 1, x: STATUE_X + 30, y: G },
];

/** The square's sprite prefixes (the section's tier-4 `art`). */
export const OZ_SQUARE_ART: readonly string[] = ['decor/oz-square/'];

// ------------------------------------------------------------------------------------ art

/** Every sprite id this module registers (tests). */
export const OZ_SQUARE_SPRITES: string[] = [];

/** Register sprite `id`: one frame per geometry, each drawn by `draw(pen, i)` at d 1, 2 and 4. */
function reg(id: string, geoms: readonly FrameGeom[], draw: (p: Pen, i: number) => void, o: { ticksPerFrame?: number } = {}): void {
  const frames = (d: Dn): Frame[] =>
    geoms.map((g, i) => {
      const p = new Pen(g.w, g.h, d);
      draw(p, i);
      return p.frame(g.ox, g.oy);
    });
  defineSprite(id, () => frames(1), { hd: (d) => frames(d as Dn), ticksPerFrame: o.ticksPerFrame ?? 8 });
  OZ_SQUARE_SPRITES.push(id);
}

const tone = (n: Parameters<typeof T>[0], k: number, d: Dn): Color => T(n, k, d);

/** `decor/oz-square/litter`: 0 a toppled bin with rubbish, 1 blown newspapers, 2 a dropped umbrella, 3 a fallen crowd barrier, 4 a lost bike. */
const LITTER = [
  { w: 26, h: 12 },
  { w: 24, h: 6 },
  { w: 18, h: 9 },
  { w: 40, h: 14 },
  { w: 30, h: 12 },
] as const;

reg(
  'decor/oz-square/litter',
  LITTER.map((g) => ({ w: g.w, h: g.h, ox: g.w / 2, oy: g.h })),
  (p, i) => {
    const d = p.d;
    const H = LITTER[i].h;
    if (i === 0) {
      // A green bin on its side, its lid open, rubbish spilled on the pavers.
      p.poly(
        [
          [2, H - 1],
          [2, H - 8],
          [16, H - 9],
          [16, H - 1],
        ],
        (X, Y) => tone('green', 2 + (Y / d < H - 6 ? 1 : 0) + (X % (3 * d) === 0 && d >= 2 ? -1 : 0), d),
      );
      p.disc(16.5, H - 5, 1.6, 4, tone('green', 1, d));
      p.rect(17, H - 9, 1, 8, tone('black', 1, d));
      for (let k = 0; k < 7; k++) {
        const x = 18 + h2(k, 1, 4) * 7;
        const w = 1 + h2(k, 2, 4) * 2.5;
        p.rect(x, H - 1.6 - h2(k, 3, 4) * 1.2, w, 1.2, k % 3 === 0 ? tone('cloth', 3, d) : k % 3 === 1 ? tone('brown', 3, d) : tone('stone', 4, d));
      }
    } else if (i === 1) {
      // Newspapers blown flat against the pavers, one page lifting.
      for (let k = 0; k < 3; k++) {
        const x = 2 + k * 7;
        p.poly(
          [
            [x, H - 1],
            [x + 6, H - 1.5 - (k === 1 ? 2.5 : 0)],
            [x + 7, H - 0.5],
            [x + 1, H],
          ],
          (_X, Y) => (d >= 2 && Y % (2 * d) === 0 ? tone('stone', 3, d) : tone('cloth', 3 - (k === 1 ? 1 : 0), d)),
        );
      }
    } else if (i === 2) {
      // A black umbrella dropped open, its handle up.
      p.disc(9, H - 1, 8, 4.5, (X, Y) => (Y / d > H - 1 ? 0 : tone('black', 2 + (Math.floor(X / (3 * d)) % 2), d)));
      p.line(9, H - 5, 13, H - 8.5, tone('wood', 2, d), d);
    } else if (i === 3) {
      // A grey crowd barrier lying on its side, one foot up.
      const iron = (k: number): Color => tone('steel', k, d);
      p.rect(2, H - 4, 34, 1.4, iron(4));
      p.rect(2, H - 8, 34, 1.2, iron(3));
      for (let k = 0; k <= 8; k++) p.rect(3 + k * 4, H - 8, 0.8, 4, iron(3));
      p.rect(1, H - 9, 1.6, 7, iron(2));
      p.rect(35.5, H - 9, 1.6, 7, iron(2));
      p.line(36, H - 2, 39, H - 12, iron(2), d);
      p.rect(0, H - 2, 6, 1.4, iron(1));
    } else {
      // A bike left lying on the pavers: two wheels, the frame, a basket.
      const blk = tone('black', 1, d);
      const steel = tone('steel', 3, d);
      for (const cx of [7, 23]) {
        p.disc(cx, H - 5, 5, 3.4, (_X, _Y, u, v) => (u * u + v * v > 0.6 ? blk : 0));
        if (d >= 2) p.disc(cx, H - 5, 0.8, 0.6, steel);
      }
      p.line(7, H - 5, 15, H - 8, tone('red', 2, d), d);
      p.line(15, H - 8, 23, H - 5, tone('red', 2, d), d);
      p.line(12, H - 5, 15, H - 8, tone('red', 2, d), d);
      p.rect(25, H - 11, 5, 3, tone('wood', 3, d));
    }
    outlineC(p);
  },
);

reg(
  'decor/oz-square/cracks',
  [0, 1, 2].map(() => ({ w: 34, h: 6, ox: 17, oy: 2 })),
  (p, i) => {
    // Dark cracks across the pavers' top, weeds and a dead tuft in them (drawn on the floor line).
    const d = p.d;
    const deep = snap(PAL_HD.ink[1], d);
    let x = 1;
    let y = 2 + h2(i, 0, 5) * 1.5;
    for (let s = 0; s < 8; s++) {
      const nx = x + 3 + h2(s, i, 7) * 2;
      const ny = Math.max(1.5, Math.min(4.5, y + (h2(s, i, 9) - 0.5) * 2.4));
      p.line(x, y, nx, ny, deep, 1);
      if (d >= 4) p.line(x, y + 0.25, nx, ny + 0.25, dim(deep, 2, d), 1);
      x = nx;
      y = ny;
    }
    for (let k = 0; k < 3; k++) {
      const wx = 4 + k * 11 + h2(k, i, 3) * 4;
      const live = (k + i) % 3 !== 0;
      const c = live ? F('moss', 0.55, d) : F('sand', 0.35, d);
      p.line(wx, 2, wx - 1, -1 + 2, c, 1);
      p.line(wx + 0.5, 2, wx + 1.5, 0.5, c, 1);
      if (d >= 2) p.line(wx + 0.25, 2, wx + 0.25, 0, c, 1);
    }
  },
);

// ------------------------------------------------------------------------------------ the doors

/** The doors' overlay frame: 0 nothing (closed: the background shows), 1 … 4 opening → open. */
function drawDoors(p: Pen, frame: number): void {
  if (frame === 0) return;
  const d = p.d;
  const s = BASILICA_S;
  const leafW = 1.8 * s;
  const leafH = 5.2 * s;
  const open = frame / 4;
  // The dark nave inside: deep blue-black with a warm candle glow low down.
  for (let k = 0; k < 2; k++) {
    const lx = 1 + k * 2.1 * s;
    archPointed(p, lx, 1, leafW, leafH, (X, Y) => {
      const v = (Y / d - 1) / leafH;
      const glow = Math.max(0, v - 0.55) * 2.2 * (0.6 + 0.4 * h2(Math.floor(X / (2 * d)), 0, 3));
      return glow > 0.45 ? T('candle', 1 + Math.min(2, glow * 2), d) : T('night', 0 + Math.min(1, v * 1.4), d);
    });
    // The leaf swinging inward: narrower each frame, hinged on the outer side.
    const lw = leafW * (1 - open);
    if (lw > 0.5) {
      const x0 = k === 0 ? lx : lx + leafW - lw;
      archPointed(p, x0, 1 + (k === 0 ? 0 : 0), lw, leafH, (X) => {
        const u = (X / d - x0) / Math.max(0.5, lw);
        const kk = 2.2 - u * 1.2 - open * 0.8 + (d >= 4 && X % Math.max(1, Math.round(0.6 * s * d)) === 0 ? -0.8 : 0);
        return T('red', kk, d);
      });
    }
  }
}

reg(
  'decor/oz-square/doors',
  [0, 1, 2, 3, 4].map(() => ({ w: Math.ceil(DOOR_RECT.w) + 2, h: Math.ceil(DOOR_RECT.h) + 2, ox: 1, oy: Math.ceil(DOOR_RECT.h) + 1 })),
  (p, i) => drawDoors(p, i),
  { ticksPerFrame: 10 },
);

const doorOpts: DrawOpts = {};

/** The basilica's red doors (oz-c's exit): closed until `open()`, then they creak open. */
export class SquareDoors extends BaseEntity implements LightSource {
  frame = 0;
  opening = false;
  private t = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 4;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: -DOOR_RECT.h, w: DOOR_RECT.w, h: DOOR_RECT.h };
    this.addTag(LIGHT_TAG);
  }

  get isOpen(): boolean {
    return this.frame >= 4;
  }

  open(): void {
    if (this.opening || this.isOpen) return;
    this.opening = true;
    this.world.audio.sfx('oz/statue/doors');
  }

  override hurtboxes(): readonly import('../../../../engine/math').Rect[] {
    return NONE;
  }

  override update(): void {
    if (!this.opening) return;
    this.t++;
    this.frame = Math.min(4, 1 + Math.floor(this.t / 14));
    if (this.frame >= 4) this.opening = false;
  }

  lightOf(out: LightSpot, _tick: number): boolean {
    if (this.frame === 0) return false;
    out.x = this.x + DOOR_RECT.w / 2;
    out.y = this.y - 10;
    out.r = 26 + this.frame * 4;
    out.color = WARM;
    out.intensity = 0.15 * this.frame;
    out.flicker = 0.3;
    return true;
  }

  override draw(r: Renderer): void {
    if (this.frame > 0) r.sprite('decor/oz-square/doors', this.frame, this.x - 1, this.y + 1, doorOpts);
  }
}

const NONE: readonly import('../../../../engine/math').Rect[] = [];

/** The door overlay's entity id (oz-c only). */
export const OZ_SQUARE_DOORS = 'oz-square-doors';

defineEntity(OZ_SQUARE_DOORS, (w, x, y) => new SquareDoors(w, x, y), {
  category: 'prop',
  description: 'oldenzaal oz-c: the basilica\'s red doors (an overlay on the backdrop): closed until open(), then they creak open (the exit to the nave).',
});

/** Spawn the doors' overlay at their place (x = the opening's left, y = the floor). */
export function squareDoors(spawn: (id: string, x: number, y: number) => Entity): SquareDoors {
  return spawn(OZ_SQUARE_DOORS, DOOR_RECT.x, G) as SquareDoors;
}

