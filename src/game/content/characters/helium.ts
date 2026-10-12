/**
 * Helium Head (GDD §4.13): the one status gimmick. It changes the head and the jump, never the
 * body. The `helium-tank` prop (props agent) applies it by id:
 * ```ts
 * const st = getStatus('helium-head');
 * if (st && isPlayer(e) && e.state === 'play') e.status.add(st);   // again later = refresh
 * ```
 * - 600 ticks; jump vy −4.5 (apex ≈ 78 px with gravity 0.13); falling with jump held: gravity 0.05
 *   and max fall 1.0; run speed × 0.9; no crouch (down bobs the head instead); vehicles cannot
 *   be entered (touching an empty seat floats the player off it with a `?` bubble); the player's
 *   sounds play at pitch × 1.6; art infix `helium` (`char/<id>/helium-<anim>`, head at 2× with a
 *   pink rim). Announcer "HELIUM HEAD!", a squeaky `HI!` bubble, HUD icon `ui/icon-balloon`.
 * - One-hit shield: the first hit that would kill pops the head (BANG, confetti,
 *   `player/helium-pop`), ends the status and gives 60 invulnerable ticks. Crushers still kill;
 *   pits, deep water and kill zones kill through the player's hazard check, never via a hit.
 * - The last 120 ticks the head wobbles and hisses. At 0: "PFFFT" (`player/helium-deflate`), the
 *   player spins twice in place (status `helium-deflate`: 30 ticks, no control, invulnerable) and
 *   the head is back to normal. Death (or any other removal) ends it without the spin.
 *
 * The wobble and the bob swap the art infix to `helium-wob` (the same head 1 px down and forward)
 * by writing `player.status.art` from `onTick`; StatusEffects recomputes that field only when its
 * list changes, so the swap holds until the next tick.
 */
import type { Damage } from '../../../engine/entity';
import type { ParticlePreset } from '../../../engine/particles';
import { PAL } from '../../../engine/palette';
import type { Rect } from '../../../engine/math';
import { overlaps } from '../../../engine/math';
import { hudOf } from '../../context';
import type { Player } from '../../player/player';
import type { StatusEffectDef } from '../../player/status';
import { defineStatus } from '../../registry';
import { TUNING } from '../../tuning';

/** GDD §4.13 numbers (ticks, px/tick, px/tick²). */
export const HELIUM = {
  id: 'helium-head',
  ticks: 600,
  /** Take-off speed: apex 4.5² / (2 × 0.13) ≈ 78 px. */
  jumpVy: -4.5,
  fallGravity: 0.05,
  maxFall: 1.0,
  speed: 0.9,
  sfxPitch: 1.6,
  /** Invulnerable ticks after the head pops. */
  popInvuln: 60,
  /** The head wobbles and hisses for the last 120 ticks. */
  wobbleTicks: 120,
  /** The deflate spin: 30 ticks, two turns. */
  spinTicks: 30,
  spinTurns: 2,
  art: 'helium',
  /** Art infix of the wobbling / bobbing head. */
  wobArt: 'helium-wob',
  icon: 'ui/icon-balloon',
  /** Ticks between two `?` bubbles at an empty seat. */
  seatBubbleCooldown: 60,
} as const;

export const HELIUM_DEFLATE_ID = 'helium-deflate';

/** Per-player bookkeeping (the status definition is shared by every player). */
interface HeliumState {
  /** The timer ran out (onEnd then starts the spin). */
  expired: boolean;
  /** The head popped (onEnd then skips the spin). */
  popped: boolean;
  /** Next tick a seat may show the `?` bubble. */
  seatReadyAt: number;
}
const states = new WeakMap<Player, HeliumState>();

function stateOf(p: Player): HeliumState {
  let s = states.get(p);
  if (!s) {
    s = { expired: false, popped: false, seatReadyAt: 0 };
    states.set(p, s);
  }
  return s;
}

/** Pink puffs of escaping helium (cosmetic). */
const HISS: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 1,
  life: [10, 16],
  gravity: -0.03,
  drag: 0.94,
  colors: [PAL.pink[2], PAL.pink[1], PAL.snow[1]],
  fadeFrom: 0.5,
};

/** Confetti for the pop (colours are picked per piece). */
const CONFETTI: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 1,
  life: [30, 48],
  gravity: 0.06,
  drag: 0.97,
  fadeFrom: 0.7,
  ground: 'bounce',
  bounce: 0.2,
};
const CONFETTI_COLORS = [PAL.pink[2], PAL.gold[2], PAL.sky[2], PAL.green[3], PAL.snow[3], PAL.red[3]];

/** Head centre in world space (the big head sits about 30 px above the feet). */
function headY(p: Player): number {
  return p.y - 30;
}

function confetti(p: Player): void {
  const w = p.world;
  const rng = w.fxRng;
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI / 2 + (rng.next() - 0.5) * 2.6;
    const s = 0.8 + rng.next() * 2.2;
    const c = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    w.particles.emit(CONFETTI, p.x + (rng.next() - 0.5) * 10, headY(p), Math.cos(a) * s, Math.sin(a) * s, undefined, c);
  }
}

function hiss(p: Player, n: number): void {
  const w = p.world;
  const rng = w.fxRng;
  for (let i = 0; i < n; i++) {
    const back = -p.facing * (0.4 + rng.next() * 0.6);
    w.particles.emit(HISS, p.x - p.facing * 6, headY(p) - 6 + rng.next() * 6, back, -0.3 - rng.next() * 0.4);
  }
}

/** Swap the infix between the normal and the wobbling big head (only while it is ours). */
function setHeadArt(p: Player, wob: boolean): void {
  const cur = p.status.art;
  if (cur !== HELIUM.art && cur !== HELIUM.wobArt) return;
  p.status.art = wob ? HELIUM.wobArt : HELIUM.art;
}

interface SeatLike {
  state: string;
  alive: boolean;
  seatRect(): Rect;
}

function isSeatLike(e: unknown): e is SeatLike {
  const v = e as Partial<SeatLike>;
  return typeof v.seatRect === 'function' && typeof v.state === 'string';
}

const footBox: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * An empty vehicle whose seat the player would enter right now (the Vehicle.canMount rule:
 * falling onto the seat, or touching it with down held), ignoring the status' `noMount`.
 */
function touchesEmptySeat(p: Player): boolean {
  if (p.state !== 'play') return false;
  const list = p.world.byTag('vehicle');
  footBox.x = p.x - 4;
  footBox.y = p.y - 4;
  footBox.w = 8;
  footBox.h = 5;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (!isSeatLike(v) || !v.alive || v.state !== 'idle') continue;
    const seat = v.seatRect();
    if ((p.vy > 0 && overlaps(footBox, seat)) || (p.pad.held('down') && overlaps(p.hitRect(), seat))) return true;
  }
  return false;
}

/** The shared Helium Head definition (registered as `helium-head`). */
export const HELIUM_HEAD: StatusEffectDef = {
  id: HELIUM.id,
  ticks: HELIUM.ticks,
  /** A multiplier of the on-foot take-off speed, so the jump is vy −4.5 whatever TUNING says. */
  get jump(): number {
    return HELIUM.jumpVy / TUNING.player.jumpVelocity;
  },
  speed: HELIUM.speed,
  fallGravity: HELIUM.fallGravity,
  maxFall: HELIUM.maxFall,
  noCrouch: true,
  noMount: true,
  sfxPitch: HELIUM.sfxPitch,
  art: HELIUM.art,
  icon: HELIUM.icon,

  onStart(p) {
    const s = stateOf(p);
    s.expired = false;
    s.popped = false;
    s.seatReadyAt = 0;
    p.world.audio.sfx('player/helium-on');
    p.world.audio.voice('HELIUM HEAD!');
    hudOf(p.world).bubble(p, 'HI!', { kind: 'gag', ticks: 60, dy: 16 });
  },

  onTick(p, left) {
    const s = stateOf(p);
    if (left <= 0) s.expired = true;
    const t = p.world.tick;
    // Down cannot crouch: the big head bobs instead (on the ground, in play).
    const bob = p.state === 'play' && p.onGround && p.pad.held('down') && !p.pad.held('up');
    // The last 120 ticks: the head wobbles (a fast jiggle) and hisses.
    const wobble = left <= HELIUM.wobbleTicks;
    if (wobble) setHeadArt(p, (t >> 2) % 2 === 1);
    else setHeadArt(p, bob && (t >> 3) % 2 === 1);
    if (wobble && left % 6 === 0 && p.state !== 'dead') hiss(p, left < 40 ? 2 : 1);
    // An empty seat refuses the balloon-headed pilot: he floats off it, puzzled.
    if (t >= s.seatReadyAt && touchesEmptySeat(p)) {
      s.seatReadyAt = t + HELIUM.seatBubbleCooldown;
      p.vy = Math.min(p.vy, -1.6);
      hudOf(p.world).bubble(p, '?', { kind: 'gag', ticks: 50, dy: 16 });
    }
  },

  onHit(p, d: Damage) {
    // Crushers still kill (pits, deep water and kill zones never arrive as hits).
    if (d.kind === 'crush') return false;
    const s = stateOf(p);
    s.popped = true;
    p.status.remove(HELIUM.id);
    p.invulnTicks = Math.max(p.invulnTicks, HELIUM.popInvuln);
    p.world.audio.sfx('player/helium-pop');
    confetti(p);
    hudOf(p.world).bubble(p, 'BANG!', { kind: 'gag', ticks: 40, dy: 4 });
    return true;
  },

  onEnd(p) {
    const s = stateOf(p);
    const spin = s.expired && !s.popped && (p.state === 'play' || p.state === 'spawn');
    s.expired = false;
    s.popped = false;
    if (!spin) return;
    // PFFFT: the head deflates (normal pitch: the aggregate pitch is still 1.6 here).
    p.world.audio.sfx('player/helium-deflate');
    hiss(p, 6);
    p.status.add(HELIUM_DEFLATE);
  },
};

/**
 * The deflate spin after Helium Head runs out: 30 ticks of no control, two turns in place
 * (the facing flips every 7 ticks: 4 flips), hits absorbed (crushers aside) without the blink.
 */
export const HELIUM_DEFLATE: StatusEffectDef = {
  id: HELIUM_DEFLATE_ID,
  ticks: HELIUM.spinTicks,
  noControl: true,
  noCrouch: true,
  noMount: true,

  onTick(p, left) {
    const done = HELIUM.spinTicks - left;
    const step = Math.floor(HELIUM.spinTicks / (HELIUM.spinTurns * 2));
    if (done > 0 && done % step === 0 && done <= step * HELIUM.spinTurns * 2) p.facing = p.facing > 0 ? -1 : 1;
    if (left % 5 === 0) hiss(p, 1);
  },

  onHit(_p, d: Damage) {
    return d.kind !== 'crush';
  },
};

defineStatus(HELIUM_HEAD);
defineStatus(HELIUM_DEFLATE);
