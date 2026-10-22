/**
 * m5-c finale (GDD §10.5 stage 3 death sequence): while the Maestro's room falls apart, the
 * players auto-run right and jump into a Trumpeter flown by Gramps ("I'M A PILOT NOW TOO."). If Gramps is a player, Brigadier Gusto flies it, singing (there is no Gusto
 * sprite in the game: the ship then flies the `mute` skin with no visible pilot, notes rise from
 * the seat and his line comes as a radio bubble). Then the ship flies off and the mission ends.
 *
 * - `m5-gramps-ship` — the cosmetic rescue Trumpeter. It is a `Mountable` (players climb in with
 *   `enterVehicle`), but NOT a `Vehicle`: no cells, no HUD, a zero hitbox (pickups never see it).
 *   It flies in from the right to its hover point, takes every player who jumps into the seat
 *   zone, and `leave()` sends it up and away with its passengers.
 * - `autoRun(ctx, ship)` — takes the players' pads over (a private `VirtualPad` per player):
 *   run to the ship, hop the wreck blocks, jump in. Players who never make it (e.g. stuck in a
 *   respawn drop) are seated by `boardAll()` when the script's patience runs out.
 * - `clearRoom(ctx)` — the room falls apart: leftover enemies die and enemy shots are erased, so
 *   the auto-run (no control) can never be hit. Players are not made invulnerable (that blinks).
 */
import { Entity } from '../../../../engine/entity';
import { toMask, VirtualPad, type Button } from '../../../../engine/input';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import { hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { musicNotes } from '../../../fx';
import { eraseEnemyShots } from '../../../projectile';
import type { SectionContext } from '../../../mission/index';
import type { Mountable, Player } from '../../../player/player';
import { defineEntity, paramStr, type SpawnParams } from '../../../registry';

/** Hover point (room / world coords of the hull anchor), seat zone and timings. */
export const SHIP = {
  /** The ship drops in through the hole Fanfaroni left in the roof, then hovers here. */
  hoverX: 334,
  hoverY: 150,
  /** Seat zone around the anchor: a player whose feet are in it is aboard. */
  zone: { x: -34, y: -50, w: 56, h: 40 },
  /** Passenger seats behind the pilot (draw offsets from the anchor). */
  seats: [
    [-15, -16],
    [-28, -15],
  ],
  pilotSeat: [-1, -17],
  enterSpeed: 2.5,
} as const;

const opts: DrawOpts = {};

export type ShipMode = 'enter' | 'hover' | 'leave';

export class GrampsShip extends Entity implements Mountable {
  mode: ShipMode = 'enter';
  /** 'gramps' (default) or 'gusto' (Gramps is a player). */
  readonly pilot: 'gramps' | 'gusto';
  readonly passengers: Player[] = [];
  private t = 0;
  private bobT = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y);
    this.pilot = paramStr(params, 'pilot', 'gramps') === 'gusto' ? 'gusto' : 'gramps';
    this.z = 70;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    this.addTag('decor');
  }

  get arrived(): boolean {
    return this.mode === 'hover';
  }

  /** Hover point in world coordinates (the room is the view). */
  private hoverX(): number {
    return this.world.camera.left + SHIP.hoverX;
  }

  private hoverY(): number {
    return this.world.camera.top + SHIP.hoverY;
  }

  /** Is this player's feet point inside the seat zone? */
  inZone(p: Player): boolean {
    const z = SHIP.zone;
    return p.x >= this.x + z.x && p.x <= this.x + z.x + z.w && p.y >= this.y + z.y && p.y <= this.y + z.y + z.h;
  }

  canMount(p: Player): boolean {
    return this.mode === 'hover' && p.state === 'play' && !this.passengers.includes(p) && this.passengers.length < SHIP.seats.length;
  }

  mount(p: Player): void {
    if (this.passengers.includes(p)) return;
    // A mounted player cannot be hit (Player.onHit), and invulnerability would make him blink.
    p.enterVehicle(this, 0);
    p.invulnTicks = 0;
    this.passengers.push(p);
    this.world.audio.sfx('swan/honk', { vol: 0.6, pitch: 1.2 });
    this.world.particles.dust(p.x, p.y);
  }

  /** Seat every player still on foot (the script's patience ran out). */
  boardAll(players: readonly Player[]): void {
    for (const p of players) if (this.canMount(p)) this.mount(p);
  }

  /** Every player who can still play is aboard. */
  allAboard(players: readonly Player[]): boolean {
    for (const p of players) {
      if (this.passengers.includes(p)) continue;
      if (p.state === 'out' || p.state === 'victory') continue;
      return false;
    }
    return true;
  }

  leave(): void {
    if (this.mode === 'leave') return;
    this.mode = 'leave';
    this.t = 0;
    this.world.audio.sfx('trumpeter/flap', { vol: 0.8 });
  }

  override update(): void {
    this.t++;
    this.bobT++;
    if (this.mode === 'enter') {
      const tx = this.hoverX();
      const ty = this.hoverY();
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= SHIP.enterSpeed) {
        this.x = tx;
        this.y = ty;
        this.mode = 'hover';
        this.t = 0;
      } else {
        this.x += (dx / d) * SHIP.enterSpeed;
        this.y += (dy / d) * SHIP.enterSpeed;
      }
    } else if (this.mode === 'hover') {
      this.x = this.hoverX();
      this.y = this.hoverY() + Math.round(Math.sin(this.bobT / 12) * 2);
      for (const p of this.world.players as unknown as Player[]) if (this.inZone(p) && this.canMount(p)) this.mount(p);
    } else {
      // Up and away: a short climb, then off to the right.
      this.x += Math.min(4, 0.5 + this.t * 0.06);
      this.y -= Math.min(1.6, this.t * 0.03);
    }
    if (this.mode !== 'hover' && this.t % 6 === 0) this.world.particles.dust(this.x - 30, this.y + 4);
    if (this.pilot === 'gusto' && this.t % 20 === 0) musicNotes(this.world, this.x - 2, this.y - 40, 1);
    // Passengers ride along (their own update does nothing while mounted).
    for (let i = 0; i < this.passengers.length; i++) {
      const p = this.passengers[i];
      p.x = this.x + SHIP.seats[i][0];
      p.y = this.y + SHIP.seats[i][1];
    }
  }

  override draw(r: Renderer): void {
    const skin = this.pilot === 'gusto' ? 'vehicle/trumpeter-mute' : 'vehicle/trumpeter';
    const x = Math.round(this.x);
    const t = this.world.tick;
    const frame = Math.floor(t / (this.mode === 'leave' ? 3 : 5)) % 4;
    const y = Math.round(this.y) + (frame === 1 ? -1 : frame === 3 ? 1 : 0);
    opts.flipX = false;
    opts.flash = false;
    r.sprite(`${skin}/jet`, t % 3, x, y, opts);
    r.sprite(`${skin}/idle`, frame, x, y, opts);
    for (let i = this.passengers.length - 1; i >= 0; i--) {
      this.passengers[i].drawRide(r, x + SHIP.seats[i][0], y + SHIP.seats[i][1], false, 'cheer');
    }
    if (this.pilot === 'gramps') {
      const id = hasSprite('char/gramps/ride-lean') ? 'char/gramps/ride-lean' : 'char/gramps/ride-sit';
      if (hasSprite(id)) r.sprite(id, (t >> 4) & 1, x + SHIP.pilotSeat[0], y + SHIP.pilotSeat[1], opts);
    }
    r.sprite(`${skin}/front`, frame, x, y, opts);
  }
}

defineEntity('m5-gramps-ship', (w, x, y, p) => new GrampsShip(w, x, y, p), {
  category: 'other',
  description: 'm5-c finale: the rescue Trumpeter flown by Gramps (pilot "gusto": no visible pilot, notes). Players jump in; leave() flies it off.',
});

// ---------------------------------------------------------------------------------------------
// The auto-run
// ---------------------------------------------------------------------------------------------

const ROOM_RECT = { x: 0, y: 0, w: 0, h: 0 };

/** The room falls apart: every leftover enemy dies, every enemy shot is erased. */
export function clearRoom(ctx: SectionContext): void {
  const cam = ctx.camera;
  ROOM_RECT.x = cam.left - 32;
  ROOM_RECT.y = cam.top - 32;
  ROOM_RECT.w = cam.w + 64;
  ROOM_RECT.h = cam.h + 64;
  eraseEnemyShots(ctx.world, ROOM_RECT);
  for (const e of ctx.world.byTag('enemy').slice()) {
    if (!e.alive || e.hasTag('boss')) continue;
    e.onHit({ amount: 99999, kind: 'explosion', dirX: 0, tags: ['heavy'] });
  }
}

const RIGHT: Button[] = ['right'];
const LEFT: Button[] = ['left'];
const RIGHT_JUMP: Button[] = ['right', 'jump'];
const LEFT_JUMP: Button[] = ['left', 'jump'];
const JUMP: Button[] = ['jump'];

/** Is a wreck block (or any solid) right ahead of this player at foot height? */
function blockedAhead(world: World, p: Player, dir: number): boolean {
  const probeX = p.x + dir * 14;
  for (const e of world.entities) {
    if (e.type !== 'wreck-block' || e.removed) continue;
    const r = (e as { solidRect?: { x: number; y: number; w: number; h: number } | null }).solidRect;
    if (r && probeX >= r.x && probeX <= r.x + r.w && p.y > r.y) return true;
  }
  return false;
}

/**
 * The players auto-run to the ship and jump in. Runs until every player is aboard or out;
 * `patience` ticks after the ship arrives, the stragglers are seated.
 */
export function* autoRun(ctx: SectionContext, ship: GrampsShip, patience = 300): ScriptGen {
  const players = ctx.players as readonly Player[];
  const pads = players.map(() => new VirtualPad());
  const lastX = players.map((p) => p.x);
  const prevJump = players.map(() => false);
  for (let i = 0; i < players.length; i++) players[i].pad = pads[i];
  let waited = 0;
  for (;;) {
    if (ship.allAboard(players)) return;
    if (ship.arrived && ++waited > patience) {
      ship.boardAll(players);
      return;
    }
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (ship.passengers.includes(p)) continue;
      const target = ship.x + SHIP.zone.x + SHIP.zone.w / 2;
      const dx = target - p.x;
      const dir = Math.abs(dx) < 4 ? 0 : Math.sign(dx);
      const stuck = dir !== 0 && Math.abs(p.x - lastX[i]) < 0.2 && p.onGround;
      const wantJump = p.onGround && !prevJump[i] && ((dir !== 0 && (blockedAhead(ctx.world, p, dir) || stuck)) || (ship.arrived && Math.abs(dx) < 20));
      const spec = dir > 0 ? (wantJump ? RIGHT_JUMP : RIGHT) : dir < 0 ? (wantJump ? LEFT_JUMP : LEFT) : wantJump ? JUMP : null;
      pads[i].update(toMask(spec));
      prevJump[i] = wantJump;
      lastX[i] = p.x;
    }
    yield;
  }
}
