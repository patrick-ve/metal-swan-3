/**
 * SNACK POWER (mission oldenzaal, docs/design/oldenzaal.md §4.3; docs/api/oldenzaal.md "WUGHOST"):
 * the status Meneer Wu's meal (`PATAT MAYO MET 2 FRIKANDELLEN`, the `pickup-oz-meal`) gives.
 *
 * - `snack-power` (ids.ts `OZ_STATUS_SNACK`): 1,200 ticks (20 s; Patrick, "master of eating
 *   frikandellen", 1,800 = 30 s); the main gun fires ×1.5 (`fireRate`, Gun.rate); ONE hit is
 *   absorbed by a mayo splat (`oz-mayo-splat`: a white splash and a `SPLAT!` pop, 60 invulnerable
 *   ticks; crushers still kill); a warm tint pulse on the hero; the HUD icon `ui/icon-oz-meal`
 *   (a tray of fries) whose frames draw the countdown ring (`iconFrame`; no timer bar).
 * - `snack-frikandel` (`OZ_STATUS_FRIKANDEL`): while it lasts, BOMB throws a frikandel
 *   (`oz-frikandel`: items/index.ts) instead of a grenade (`bomb`), 2 per meal; the HUD's bomb
 *   slot shows `ui/icon-oz-frikandel` and the count; after the last one the grenades are back.
 *   It has no timer (it ends with the last throw or a death).
 *
 * Both carry over a section change (`carry`) and end with a death: a continue gives no new meal.
 * `eatMeal(player)` starts both (the meal pickup and Meneer Wu's scene call it). Per-slot state
 * (the shield, the frikandel count) lives in WeakMaps keyed by the session slot.
 */
import type { Damage } from '../../../engine/entity';
import { PAL } from '../../../engine/palette';
import type { ParticlePreset } from '../../../engine/particles';
import { hudOf } from '../../context';
import type { Player } from '../../player/player';
import type { StatusEffectDef } from '../../player/status';
import { defineStatus } from '../../registry';
import { OZ_STATUS_SNACK, OZ_WUGHOST } from '../missions/oldenzaal/ids';
import { SNACK_POWER_CALLOUT, SPLAT_POP } from '../missions/oldenzaal/lines';

/** The status id of the frikandel throws (a WUGHOST id; the snack power's is ids.ts `OZ_STATUS_SNACK`). */
export const OZ_STATUS_FRIKANDEL = 'snack-frikandel';

/** Spec §4.3 numbers (ticks). */
export const SNACK = {
  ticks: 1200,
  /** Patrick's bio: the master of eating frikandellen. */
  patrickTicks: 1800,
  fireRate: 1.5,
  frikandels: 2,
  /** Invulnerable ticks after the mayo splat took a hit. */
  splatInvuln: 60,
  /** The warm tint pulse: period (ticks) and the strongest alpha. */
  pulsePeriod: 48,
  pulseAlpha: 0.22,
  /** Frames of the HUD icon's countdown ring (frame 0 = empty … RING_STEPS = full). */
  ringSteps: 12,
  icon: 'ui/icon-oz-meal',
  bombIcon: 'ui/icon-oz-frikandel',
} as const;

/** The warm tint of the pulse (a fryer-gold glow). */
const WARM = PAL.gold[3];

interface SnackState {
  /** The mayo splat is still ready to take a hit. */
  shield: boolean;
  /** The duration this meal started with (the ring's full turn). */
  total: number;
  /** Frikandels left. */
  frikandels: number;
}
const states = new WeakMap<object, SnackState>();

function stateOf(p: Player): SnackState {
  let s = states.get(p.slot);
  if (!s) {
    s = { shield: false, total: SNACK.ticks, frikandels: 0 };
    states.set(p.slot, s);
  }
  return s;
}

/** Snack power ticks for this hero (Patrick 30 s). */
export function snackTicks(p: Player): number {
  return p.character.id === 'patrick' ? SNACK.patrickTicks : SNACK.ticks;
}

/** Frikandels the hero has left (0 = grenades). */
export function frikandelsLeft(p: Player): number {
  return p.status.has(OZ_STATUS_FRIKANDEL) ? (states.get(p.slot)?.frikandels ?? 0) : 0;
}

/** Is the mayo splat still ready (snack power on and no hit absorbed yet)? */
export function splatReady(p: Player): boolean {
  return p.status.has(OZ_STATUS_SNACK) && (states.get(p.slot)?.shield ?? false);
}

/** Eat the meal: snack power (refreshed if on) and 2 frikandels. Returns false for a hero not in play. */
export function eatMeal(p: Player): boolean {
  if (!p.alive || p.state === 'dead' || p.state === 'out') return false;
  const s = stateOf(p);
  const ticks = snackTicks(p);
  s.total = ticks;
  s.shield = true;
  s.frikandels = SNACK.frikandels;
  p.status.add(SNACK_POWER, ticks);
  p.status.add(FRIKANDEL_STATUS);
  return true;
}

/** Cream drops of the splat (cosmetic). */
const DROPS: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 1,
  life: [14, 24],
  gravity: 0.12,
  drag: 0.95,
  colors: [PAL.snow[3], PAL.cloth[3], PAL.cloth[2]],
  fadeFrom: 0.6,
  ground: 'stop',
};

export const SNACK_POWER: StatusEffectDef = {
  id: OZ_STATUS_SNACK,
  ticks: SNACK.ticks,
  fireRate: SNACK.fireRate,
  icon: SNACK.icon,
  hudBar: false,
  carry: true,
  iconFrame(p, left) {
    const total = states.get(p.slot)?.total ?? SNACK.ticks;
    return Math.max(0, Math.min(SNACK.ringSteps, Math.ceil((left / total) * SNACK.ringSteps)));
  },
  onStart(p) {
    p.world.audio.sfx('oz/meal/eat');
    hudOf(p.world).bubble(p, SNACK_POWER_CALLOUT, { kind: 'gag', ticks: 70, dy: 4, voice: false });
    // The announcer's call (AUDIO: a voiced line of the mission's sample group; the synth jingle until then).
    p.world.audio.voice(SNACK_POWER_CALLOUT);
  },
  onTick(p, left) {
    // A warm pulse: a soft glow every pulsePeriod ticks (faster in the last 3 s).
    const period = left < 180 ? SNACK.pulsePeriod / 2 : SNACK.pulsePeriod;
    const ph = (p.world.tick % period) / period;
    const k = Math.max(0, Math.sin(ph * Math.PI * 2));
    p.status.tint = WARM;
    p.status.tintAlpha = SNACK.pulseAlpha * k * k;
  },
  onHit(p, d: Damage) {
    if (d.kind === 'crush') return false;
    const s = stateOf(p);
    if (!s.shield) return false;
    s.shield = false;
    p.invulnTicks = Math.max(p.invulnTicks, SNACK.splatInvuln);
    const w = p.world;
    w.spawn(OZ_WUGHOST.splat, p.x, p.y - 14, { facing: p.facing });
    w.particles.burst(DROPS, p.x, p.y - 16, 10, 0.8, 2.4);
    w.audio.sfx('oz/meal/splat');
    hudOf(w).bubble(p, SPLAT_POP, { kind: 'gag', ticks: 40, dy: 4, voice: false });
    return true;
  },
  onEnd(p) {
    const s = states.get(p.slot);
    if (s) s.shield = false;
  },
};

export const FRIKANDEL_STATUS: StatusEffectDef = {
  id: OZ_STATUS_FRIKANDEL,
  ticks: Infinity,
  carry: true,
  bomb: {
    weapon: OZ_WUGHOST.frikandel,
    icon: SNACK.bombIcon,
    left: (p) => states.get(p.slot)?.frikandels ?? 0,
    onThrow(p) {
      const s = stateOf(p);
      s.frikandels = Math.max(0, s.frikandels - 1);
      if (s.frikandels <= 0) p.status.remove(OZ_STATUS_FRIKANDEL);
    },
  },
  onEnd(p) {
    const s = states.get(p.slot);
    if (s) s.frikandels = 0;
  },
};

defineStatus(SNACK_POWER);
defineStatus(FRIKANDEL_STATUS);
