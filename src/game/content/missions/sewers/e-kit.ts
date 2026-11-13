/**
 * Wave P1b E's helpers for sewers-e DE AFVALHAL and sewers-end DAGERAAD (docs/design/sewers.md
 * §2.5, §2.6): the props of the dawn.
 *
 * - `sewers-manhole` — the lid in the quiet street. It holds the heroes at the start of sewers-end
 *   (hidden: the player is "mounted" in it, as in a vehicle, without the `vehicle` tag) and lets
 *   them climb out one by one (`release(p)`: the lid lifts, the hero hops out).
 * - `sewers-wagon` — the squad's white ROZZERS wagon (spec §0 row 56; the ring's white estate, a
 *   likeness without badge): a thin wrapper that draws the ring's wagon art (content/ring/wagon:
 *   1×, 2×, 4×; read only) with a squad hero who does not play at the wheel, behind the front door
 *   glass as on the ring. It drives in from the right facing left (its left side), makes the
 *   ring's handbrake turn (the spin frames 4 → 0) and stops facing right (`arrived`); the heroes
 *   hop into its windows (`board(p)`: the somersault, then the hero's `ride-sit` behind the glass),
 *   then it drives off to the right (`leave()`; `gone` once it is out of the view).
 * - `sewers-slimed` — the green slime on the heroes at dawn (a tint; cosmetic).
 * - `decor/sewers-e-junk` — lost things in the sewer (a phone, keys, a wheel, a selfie stick).
 */
import { Entity } from '../../../../engine/entity';
import { overlaps, type Rect } from '../../../../engine/math';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../../../engine/render';
import { defineSprite, frameCount, getFrame, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { dust, splash } from '../../../fx';
import type { Mountable, Player } from '../../../player/player';
import type { StatusEffectDef } from '../../../player/status';
import { defineEntity, defineStatus } from '../../../registry';
// The ring's wagon art (1×, 2×, 4×: its strips register at import; the ring content is not lazy, so
// this only keeps the sewers chunk independent of that) and its numbers. Not the ring mission.
import '../../ring/wagon/art';
import { CABIN_LEFT, CAR, ID, POSE, SEAT } from '../../ring/wagon/geometry';
import { SEWERS_E_IDS } from './ids';

/** Sprite prefixes (the `sewers-` segment keeps them in the lazy chunk). */
export const END_ART = {
  manhole: 'prop/sewers-manhole',
  junk: 'decor/sewers-e-junk',
} as const;

/** The slimed heroes at dawn (green, cosmetic; it fades on its own). */
export const SEWERS_SLIMED: StatusEffectDef = defineStatus({ id: 'sewers-slimed', ticks: 900, tint: PAL.green[2], tintAlpha: 0.35 });

const drawOpts: DrawOpts = {};

// ---------------------------------------------------------------------------------------------
// The manhole
// ---------------------------------------------------------------------------------------------

export class SewersManhole extends Entity implements Mountable {
  /** Heroes still inside. */
  readonly inside: Player[] = [];
  /** 0 shut … 1 the lid aside. */
  lift = 0;
  private opening = false;

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 44;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -12, y: -4, w: 24, h: 6 };
    this.addTag('prop');
  }

  /** Never entered by walking onto it. */
  canMount(_p: Player): boolean {
    return false;
  }

  /** Hide a hero inside (the start of sewers-end). */
  mount(p: Player): void {
    if (this.inside.includes(p)) return;
    p.enterVehicle(this, 0);
    p.x = p.prevX = this.x;
    p.y = p.prevY = this.y;
    this.inside.push(p);
  }

  /** The lid lifts. */
  open(): void {
    if (this.opening) return;
    this.opening = true;
    this.world.audio.sfx('sewers/manhole-lid');
    dust(this.world, this.x, this.y, 3);
  }

  /** A hero climbs out (a hop up and to the right). */
  release(p: Player): void {
    const i = this.inside.indexOf(p);
    if (i < 0) return;
    this.inside.splice(i, 1);
    if (p.state !== 'mounted' || p.vehicle !== this) return;
    p.leaveVehicle({ x: this.x, y: this.y, vx: 0.9, vy: -3.4, invuln: 30 });
    splash(this.world, this.x, this.y - 2, 6);
    this.world.audio.sfx('sewers/spit-splat', { vol: 0.6 });
  }

  override update(): void {
    if (this.opening && this.lift < 1) this.lift = Math.min(1, this.lift + 1 / 20);
  }

  override onOutOfWorld(): void {}

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.alpha = 1;
    // The hole (open) and the lid: shut on it, then lifted and slid to the left.
    if (this.lift > 0) r.sprite(`${END_ART.manhole}/hole`, 0, this.x, this.y, drawOpts);
    const lx = Math.round(this.x - this.lift * 22);
    const ly = Math.round(this.y - Math.sin(this.lift * Math.PI) * 6);
    r.sprite(`${END_ART.manhole}/lid`, this.lift > 0 && this.lift < 1 ? 1 : 0, lx, ly, drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The white wagon (spec §0 row 56: the ring's white ROZZERS estate, its art reused)
// ---------------------------------------------------------------------------------------------

/** A passenger window (facing right): the hero's hip x and the glass (x0 … x1), from the anchor. */
interface WagonWindow {
  readonly hipX: number;
  readonly x0: number;
  readonly x1: number;
}

export const WAGON = {
  /** Down the street facing left (px/tick); the handbrake turn starts `slide` px right of the stop. */
  speed: 3.6,
  slide: 34,
  /** Ticks per spin frame of the turn (frames 4 → 0, as the ring's boarding). */
  turnFrame: 4,
  /** The brake dip after the stop and the nose-up at the start of the leave (ticks of the pose). */
  dip: 10,
  rise: 24,
  /** The leave: acceleration and top speed (px/tick). */
  accel: 0.08,
  top: 3.6,
  /** The box heroes board through (relative to the anchor: the road point under its middle). */
  door: { x: -50, y: -34, w: 120, h: 34 } as Rect,
  /** A hero's somersault into his window: ticks per px of the way, and its bounds. */
  hopPerPx: 0.2,
  hopMin: 16,
  hopMax: 36,
  /**
   * The driver's hip below the ring's (`SEAT.driverY` −10 was set for the ring's smaller heroes):
   * a 40 px hero's face fills the front door glass from here.
   */
  driverY: -4,
  /** The passengers' hip y and their windows: P1's rear door, then the load space's side window. */
  seatY: -4,
  windows: [
    { hipX: -11, x0: -20.6, x1: -0.3 },
    { hipX: -32, x0: -42.4, x1: -22.2 },
  ] as readonly WagonWindow[],
} as const;

type WagonView = 'left' | 'spin' | 'right';
type WagonPhase = 'come' | 'turn' | 'stop' | 'leave' | 'gone';

/** A hero who got in: where his hop started, its length and his window. */
interface WagonSeat {
  readonly p: Player;
  readonly fx: number;
  readonly fy: number;
  readonly hop: number;
  readonly seat: number;
  t: number;
}

const wheelOpts: DrawOpts = {};
const wheelFlipOpts: DrawOpts = { flipX: true };
const hopOpts: DrawOpts = {};
const clipSrc = { x: 0, y: 0, w: 0, h: 0 };
const clipOpts: DrawOpts = { src: clipSrc };
const clipFlipOpts: DrawOpts = { src: clipSrc, flipX: true };

export class SewersWagon extends Entity implements Mountable {
  /** Where it stops (its centre) and where the handbrake turn starts. */
  readonly stopX: number;
  readonly turnX: number;
  /** The squad hero at the wheel (a hero nobody plays), or null. */
  readonly driver: string | null;
  arrived = false;
  /** The doors are open: heroes may board. */
  open = false;
  gone = false;
  /** 'left' its left side facing left, 'spin' the turn, 'right' its right side facing right. */
  view: WagonView = 'left';
  /** Heroes inside. */
  readonly riders: Player[] = [];
  private readonly seats: WagonSeat[] = [];
  private phase: WagonPhase = 'come';
  private t = 0;
  private spinFrame = 4;
  private v = 0;
  private wheel = 0;
  /** Ticks the driver still talks ('ride-hold'). */
  private talkT = 0;
  private readonly doorRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly rideIds: { readonly sit: string; readonly hold: string } | null;

  constructor(world: World, x: number, y: number, stopX: number, driver: string | null) {
    super(world, x, y);
    this.stopX = stopX;
    this.turnX = stopX + WAGON.slide;
    this.driver = driver;
    this.rideIds = driver ? { sit: `char/${driver}/ride-sit`, hold: `char/${driver}/ride-hold` } : null;
    this.team = 'neutral';
    this.z = 36;
    this.facing = -1;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -46, y: -28, w: 92, h: 28 };
    this.addTag('prop');
  }

  canMount(_p: Player): boolean {
    return false;
  }

  mount(p: Player): void {
    this.board(p);
  }

  /** The door box in world px (reused). */
  door(): Rect {
    const d = WAGON.door;
    const r = this.doorRect;
    r.x = this.x + d.x;
    r.y = this.y + d.y;
    r.w = d.w;
    r.h = d.h;
    return r;
  }

  /** Is a hero at the door now? */
  touches(p: Player): boolean {
    return this.open && p.state === 'play' && overlaps(p.hitRect(), this.door());
  }

  /** A hero gets in: a somersault into his window, then he rides behind the glass (safe). */
  board(p: Player): void {
    if (this.riders.includes(p) || (p.state !== 'play' && p.state !== 'victory')) return;
    const seat = Math.min(this.riders.length, WAGON.windows.length - 1);
    const tx = this.x + WAGON.windows[seat].hipX;
    const hop = Math.round(Math.min(WAGON.hopMax, Math.max(WAGON.hopMin, Math.abs(tx - p.x) * WAGON.hopPerPx)));
    this.seats.push({ p, fx: p.x, fy: p.y, hop, seat, t: 0 });
    p.enterVehicle(this, 0);
    p.x = p.prevX = this.x;
    this.riders.push(p);
    this.world.audio.sfx('ui/confirm', { vol: 0.4 });
  }

  /** Every hop has landed (the heroes sit behind the glass). */
  get seated(): boolean {
    for (const s of this.seats) if (s.t < s.hop) return false;
    return true;
  }

  /** The driver talks for `ticks` (his `ride-hold` strip). */
  talk(ticks: number): void {
    this.talkT = Math.max(this.talkT, ticks);
  }

  /** The tail of the driver's bubble: over the front door glass (the ring's `bubbleTip`). */
  bubbleTip(): readonly [number, number] {
    const dx = SEAT.driverX + 2;
    return [this.view === 'left' ? -dx : dx, -29];
  }

  /** Doors shut, it drives off to the right. */
  leave(): void {
    if (this.phase === 'leave' || this.phase === 'gone') return;
    this.open = false;
    this.phase = 'leave';
    this.view = 'right';
    this.t = 0;
    this.v = 0;
    this.world.audio.sfx('sewers/taxi');
  }

  override update(): void {
    this.t++;
    if (this.talkT > 0) this.talkT--;
    switch (this.phase) {
      case 'come':
        // Down the street facing left, then the turn.
        this.x -= WAGON.speed;
        this.wheel += WAGON.speed;
        if (this.x <= this.turnX) {
          this.x = this.turnX;
          this.phase = 'turn';
          this.view = 'spin';
          this.spinFrame = 4;
          this.t = 0;
        }
        break;
      case 'turn': {
        // The handbrake turn: the tail swings round (4 → 0) while the car slides to its stop.
        const k = Math.min(1, this.t / (4 * WAGON.turnFrame));
        this.spinFrame = Math.max(0, 4 - Math.floor(k * 4 + 1e-6));
        this.x = this.turnX + (this.stopX - this.turnX) * (1 - (1 - k) * (1 - k));
        if (this.t % 3 === 0) dust(this.world, this.x + (this.t % 2 ? -24 : 26), this.y, 3);
        if (k >= 1) {
          this.x = this.stopX;
          this.phase = 'stop';
          this.view = 'right';
          this.arrived = true;
          this.t = 0;
        }
        break;
      }
      case 'stop':
        break;
      case 'leave':
        this.v = Math.min(WAGON.top, this.v + WAGON.accel);
        this.x += this.v;
        this.wheel += this.v;
        if (this.world.tick % 6 === 0) dust(this.world, this.x - 44, this.y, 1);
        if (this.x > this.world.camera.left + this.world.camera.w + 60) {
          this.phase = 'gone';
          this.gone = true;
        }
        break;
      case 'gone':
        break;
    }
    // The riders ride along (hidden as players; the wagon draws them).
    for (const s of this.seats) if (s.t < s.hop) s.t++;
    for (const p of this.riders) {
      p.x = p.prevX = this.x;
      p.y = p.prevY = this.y;
    }
  }

  override onOutOfWorld(): void {}

  /** The body pose: the brake dip after the stop, the nose up as it pulls away. */
  private pose(): number {
    if (this.phase === 'stop' && this.t < WAGON.dip) return POSE.down;
    if (this.phase === 'leave' && this.t < WAGON.rise) return POSE.up;
    return POSE.level;
  }

  override draw(r: Renderer): void {
    if (this.gone) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.view === 'spin') {
      // The turn: the spin strip (wheels and opaque glass drawn in).
      const id = ID.white.spin[0];
      if (hasSprite(id)) r.sprite(id, this.spinFrame % frameCount(id), x, y, drawOpts);
      return;
    }
    const left = this.view === 'left';
    const pose = left ? 0 : this.pose();
    drawOpts.flipX = false;
    drawOpts.alpha = 1;
    // As the ring draws it: the cabin and the wells, the wheels, the people behind the glass, the body.
    if (hasSprite(ID.cabin)) r.sprite(ID.cabin, left ? CABIN_LEFT : pose, x, y, drawOpts);
    this.drawWheels(r, x, y, left);
    this.drawDriver(r, x, y, left);
    if (!left) this.drawRiders(r, x, y);
    const body = left ? ID.white.left : ID.white.body[0];
    if (hasSprite(body)) r.sprite(body, pose, x, y, drawOpts);
    if (!left) this.drawHops(r, x, y);
  }

  private drawWheels(r: Renderer, x: number, y: number, left: boolean): void {
    const id = ID.white.wheel;
    if (!hasSprite(id)) return;
    const f = Math.floor(this.wheel / 2.1) % frameCount(id);
    for (const wx of CAR.wheelX) r.sprite(id, f, x + Math.round(left ? -wx : wx), y - 7, left ? wheelFlipOpts : wheelOpts);
  }

  /** The driver behind the front door glass: his ride strip, clipped to the glass (the ring's SEAT). */
  private drawDriver(r: Renderer, x: number, y: number, left: boolean): void {
    const ids = this.rideIds;
    if (!ids) return;
    const id = this.talkT > 0 && hasSprite(ids.hold) ? ids.hold : ids.sit;
    if (!hasSprite(id)) return;
    const f = Math.floor(this.world.tick / (this.talkT > 0 ? 8 : 20)) % frameCount(id);
    const hx = x + (left ? -SEAT.driverX : SEAT.driverX);
    const hy = y + WAGON.driverY;
    const [c0, c1, c2, c3] = SEAT.driverClip;
    r.sprite(id, f, hx, hy, clipTo(id, f, hx, hy, left ? x - c1 : x + c0, left ? x - c0 : x + c1, y + c2, y + c3, left));
  }

  /** The heroes who landed: their `ride-sit` behind their window's glass. */
  private drawRiders(r: Renderer, x: number, y: number): void {
    for (const s of this.seats) {
      if (s.t < s.hop) continue;
      const id = `${s.p.art}/ride-sit`;
      if (!hasSprite(id)) continue;
      const w = WAGON.windows[s.seat];
      const f = Math.floor(this.world.tick / 20) % frameCount(id);
      const hx = x + w.hipX;
      const hy = y + WAGON.seatY;
      r.sprite(id, f, hx, hy, clipTo(id, f, hx, hy, x + w.x0, x + w.x1, y + CAR.glassTop, y + CAR.beltY, false));
    }
  }

  /** The heroes still in the air: the somersault (`flip`) from where they stood to their window. */
  private drawHops(r: Renderer, x: number, y: number): void {
    for (const s of this.seats) {
      if (s.t >= s.hop) continue;
      const id = `${s.p.art}/flip`;
      if (!hasSprite(id)) continue;
      const k = s.t / s.hop;
      const tx = x + WAGON.windows[s.seat].hipX;
      const ty = y + CAR.beltY + 6;
      const px = s.fx + (tx - s.fx) * k;
      const py = s.fy + (ty - s.fy) * k - Math.sin(k * Math.PI) * 22;
      const n = frameCount(id);
      hopOpts.flipX = tx < s.fx;
      r.sprite(id, Math.min(n - 1, Math.floor(k * n)), Math.round(px), Math.round(py), hopOpts);
    }
  }
}

/** Draw options that show only the part of a frame inside the world box x0 … x1, y0 … y1 (the ring wagon's clip). */
function clipTo(id: string, f: number, ax: number, ay: number, x0: number, x1: number, y0: number, y1: number, flip: boolean): DrawOpts {
  let fr: Frame;
  try {
    fr = getFrame(id, f);
  } catch {
    return flip ? wheelFlipOpts : wheelOpts;
  }
  const d = fr.density ?? 1;
  const w = fr.buf.w / d;
  const h = fr.buf.h / d;
  // Frame-local box (unflipped buffer px): the frame's top-left is (ax − ox, ay − oy).
  const left = flip ? ax - (w - fr.ox) : ax - fr.ox;
  const top = ay - fr.oy;
  let sx0 = Math.max(0, Math.floor(x0 - left));
  let sx1 = Math.min(w, Math.ceil(x1 - left));
  if (flip) {
    const a = w - sx1;
    const b = w - sx0;
    sx0 = Math.max(0, a);
    sx1 = Math.min(w, b);
  }
  const sy0 = Math.max(0, Math.floor(y0 - top));
  const sy1 = Math.min(h, Math.ceil(y1 - top));
  clipSrc.x = sx0;
  clipSrc.y = sy0;
  clipSrc.w = Math.max(0, sx1 - sx0);
  clipSrc.h = Math.max(0, sy1 - sy0);
  return flip ? clipFlipOpts : clipOpts;
}

defineEntity(SEWERS_E_IDS.manhole, (w, x, y) => new SewersManhole(w, x, y), {
  category: 'prop',
  description: 'sewers-end: the manhole the heroes climb out of at dawn (holds them hidden, then lets them out one by one).',
});
defineEntity(
  SEWERS_E_IDS.wagon,
  (w, x, y, p) => new SewersWagon(w, x, y, typeof p?.stopX === 'number' ? p.stopX : x - 160, typeof p?.driver === 'string' ? p.driver : null),
  {
    category: 'prop',
    description: "sewers-end: the squad's white wagon (the ring's art); drives in from the right, turns, stops at `stopX`, takes the heroes in, drives off to the right (params stopX, driver: a squad hero id).",
  },
);

// ---------------------------------------------------------------------------------------------
// STAND-IN art (the manhole's frames are canal sprites while the scene draws)
// ---------------------------------------------------------------------------------------------

defineSprite(`${END_ART.manhole}/lid`, () => {
  const frames: PixelBuffer[] = [];
  for (let k = 0; k < 2; k++) {
    const b = new PixelBuffer(26, 6);
    b.ellipse(0, k, 26, 5 - k, PAL.steel[1]);
    b.hline(4, 21, 2, PAL.steel[0]);
    b.hline(6, 19, 3, PAL.steel[2]);
    frames.push(b);
  }
  return frames;
});
defineSprite(`${END_ART.manhole}/hole`, () => {
  const b = new PixelBuffer(26, 6);
  b.ellipse(0, 0, 26, 6, INK);
  b.ellipse(3, 1, 20, 4, PAL.green[0]);
  return b;
});

defineSprite(`${END_ART.junk}`, () => {
  const out: PixelBuffer[] = [];
  // A phone.
  let b = new PixelBuffer(8, 5);
  b.rect(0, 1, 8, 4, INK);
  b.rect(1, 2, 6, 2, PAL.sky[1]);
  out.push(b);
  // Keys.
  b = new PixelBuffer(8, 5);
  b.circle(2, 2, 2, PAL.gold[2], false);
  b.hline(4, 7, 3, PAL.steel[2]);
  out.push(b);
  // A bike wheel half in the water.
  b = new PixelBuffer(16, 9);
  b.circle(8, 8, 7, PAL.steel[1], false);
  b.hline(1, 15, 8, PAL.teal[1]);
  out.push(b);
  // A selfie stick.
  b = new PixelBuffer(14, 6);
  b.line(0, 5, 11, 1, PAL.steel[2]);
  b.rect(10, 0, 4, 3, INK);
  out.push(b);
  return out;
});
