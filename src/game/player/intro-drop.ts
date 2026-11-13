/**
 * The mission-start parachute drop (MissionDef.introDrop, e.g. ams): the player starts above the
 * view under a wing chute and floats down onto the section's `playerStart` while the mission
 * banner shows. Horizontal input is ignored; the pistol and the aim work; no jump, bomb, crouch
 * or mount; hits are absorbed (the drop is part of the intro). The Player drives the fall itself
 * (`Player.introDrop`) and removes this status on landing; the status gives the rules and draws
 * the canopy. Not the Trumpeter's `swan-parachute` (a different status with its own art).
 *
 * Art: `fx/chute` (looping sway; its `harness` point is drawn at the player's shoulders)
 * and `fx/chute-collapse` (one-shot, drawn by the Player at the landing spot). Both are optional:
 * without them the drop still works, only the canopy is missing.
 */
import type { DrawOpts, Renderer } from '../../engine/render';
import { framePoint, getFrame, hasSprite } from '../../engine/sprites';
import { stripFrame, type Player } from './player';
import type { StatusEffectDef } from './status';

export const INTRO_DROP_ID = 'intro-drop';
export const CHUTE_SPRITE = 'fx/chute';
export const CHUTE_COLLAPSE_SPRITE = 'fx/chute-collapse';
/** The chute's `harness` point sits this far above the player's feet (his shoulders). */
export const CHUTE_HANG_Y = 22;

const chuteOpts: DrawOpts = {};
const harnessPt: [number, number] = [0, 0];

/**
 * Draw a chute strip (`fx/chute` or `fx/chute-collapse`) with its `harness` point on the
 * shoulders of a player standing at (x, y) (the anchor when the frame has no harness point).
 */
export function drawChute(r: Renderer, id: string, frame: number, x: number, y: number): void {
  const h = framePoint(getFrame(id, frame), 'harness', false, false, harnessPt);
  chuteOpts.flipX = false;
  r.sprite(id, frame, x - (h ? h[0] : 0), y - CHUTE_HANG_Y - (h ? h[1] : 0), chuteOpts);
}

/**
 * The plain FALL of a section's own intro drop (`SectionDef.introDrop` with `chute: false`;
 * docs/design/sewers.md §5.2, the drop down the burst shaft into sewers-c): the same rules as the
 * chute drop, but no canopy and no forced pistol (the hero keeps his weapon); the Player shows the
 * fall pose. Same status id, so everything that asks for the intro drop sees this one too.
 */
export const INTRO_FALL: StatusEffectDef = {
  id: INTRO_DROP_ID,
  ticks: Infinity,
  speed: 0,
  gravity: 0,
  noJump: true,
  noBomb: true,
  noCrouch: true,
  noMount: true,
  onHit: () => true,
};

export const INTRO_DROP: StatusEffectDef = {
  id: INTRO_DROP_ID,
  ticks: Infinity,
  speed: 0,
  gravity: 0,
  weapon: 'pistol',
  noJump: true,
  noBomb: true,
  noCrouch: true,
  noMount: true,
  onHit: () => true,
  onDraw(p: Player, r: Renderer) {
    if (p.state !== 'play' || !hasSprite(CHUTE_SPRITE)) return;
    drawChute(r, CHUTE_SPRITE, stripFrame(CHUTE_SPRITE, p.world.tick), p.x, p.y);
  },
};
