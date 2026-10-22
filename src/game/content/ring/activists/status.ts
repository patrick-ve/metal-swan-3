/**
 * The hero opt-ins of the blockade (wave B; docs/design/ring.md §R.6; docs/api/ring.md "R.B1"):
 * three STATUS EFFECTS (player/status.ts `defineStatus`; NO change to the Player: they are off unless
 * a ring entity adds them, so every other mission stays byte-identical).
 *
 * - `ring-glue` (`glueHero`, 40 ticks): the hero's boots stick in a glue puddle — speed 0, no jump, no
 *   crouch; the hero CAN still shoot and turn. Glue strands stretch from the boots to the road.
 * - `ring-stun` (`stunHero`, 20 ticks): the megaphone's feedback squeal — no control (physics runs);
 *   little squiggles circle over the head. No damage.
 * - `ring-push` (`pushHero`, 10 ticks): a shout ring knocks the hero back in a small hop along `dir`
 *   (no control while it lasts). No damage.
 */
import { PAL } from '../../../../engine/palette';
import type { Renderer } from '../../../../engine/render';
import { jump } from '../../../../engine/physics';
import type { Player } from '../../../player/player';
import { defineStatus } from '../../../registry';
import { ACTIVIST_TUNE, HERO_STATUS } from './api';
import { ACT_ART } from './looks';

/** The push's hop (px/tick, up). */
const PUSH_HOP = -1.6;

const glueOpts = { flipX: false };

export const GLUE_STATUS = defineStatus({
  id: HERO_STATUS.glue,
  ticks: ACTIVIST_TUNE.glueTicks,
  speed: 0,
  noJump: true,
  noCrouch: true,
  noMount: true,
  tint: PAL.snow[2],
  tintAlpha: 0.12,
  onStart(p) {
    p.vx = 0;
  },
  onTick(p) {
    // The boots stay put (no slide out of the puddle on the run's momentum).
    p.vx = 0;
  },
  onDraw(p: Player, r: Renderer, left: number) {
    // The strands stretch while the glue holds (frame 0 … 2), then sag as it lets go (3).
    const f = left > 26 ? 0 : left > 14 ? 1 : left > 4 ? 2 : 3;
    glueOpts.flipX = p.facing < 0;
    r.sprite(ACT_ART.strands, f, Math.round(p.x), Math.round(p.y), glueOpts);
  },
});

export const STUN_STATUS = defineStatus({
  id: HERO_STATUS.stun,
  ticks: ACTIVIST_TUNE.stunTicks,
  noControl: true,
  tint: PAL.snow[3],
  tintAlpha: 0.18,
  onDraw(p: Player, r: Renderer, left: number) {
    // Squiggly sound marks circling over the head (the ears still ring).
    const t = ACTIVIST_TUNE.stunTicks - left;
    const y = Math.round(p.y + p.hitbox.y - 4);
    for (let i = 0; i < 3; i++) {
      const a = t * 0.22 + (i * Math.PI * 2) / 3;
      const sx = Math.round(p.x + Math.cos(a) * 7);
      const sy = Math.round(y + Math.sin(a) * 2.5);
      r.rect(sx - 1, sy, 1, 1, PAL.sky[3]);
      r.rect(sx, sy - 1, 1, 1, PAL.snow[3]);
      r.rect(sx + 1, sy, 1, 1, PAL.sky[3]);
    }
  },
});

export const PUSH_STATUS = defineStatus({ id: HERO_STATUS.push, ticks: ACTIVIST_TUNE.pushTicks, noControl: true });

/** Glue a hero to the road: no move, no jump; the hero can still shoot. */
export function glueHero(p: Player, ticks: number = ACTIVIST_TUNE.glueTicks): void {
  p.status.add(GLUE_STATUS, ticks);
  p.vx = 0;
}

/** The feedback squeal stuns a hero (no control). */
export function stunHero(p: Player, ticks: number = ACTIVIST_TUNE.stunTicks): void {
  p.status.add(STUN_STATUS, ticks);
}

/** A shout ring knocks a hero back along `dir` in a small hop (no damage, no control for a moment). */
export function pushHero(p: Player, dir: 1 | -1, speed: number = ACTIVIST_TUNE.pushSpeed): void {
  p.status.add(PUSH_STATUS, ACTIVIST_TUNE.pushTicks);
  p.vx = dir * speed;
  // A hero on the ground hops back; a glued one stays put (the glue's speed 0 wins on its next tick).
  if (p.body.onGround && !p.status.has(HERO_STATUS.glue)) jump(p, PUSH_HOP);
}
