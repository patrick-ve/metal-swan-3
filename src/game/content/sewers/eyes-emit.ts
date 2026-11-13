/**
 * The rat eyes as EMITTERS (docs/design/sewers.md §5.1: "in the dark a rat is only its eyes"; the
 * eyes must stay bright in the dark). The light pass darkens everything drawn before it; this hook
 * (`SectionLight.emissive`, set on c, d and e in missions/sewers/light.ts) draws the eye pair of
 * every rat that shows its eyes this frame AGAIN, right after the darkness, so the eyes keep their
 * full colour: a dark rat's red eyes, and the white flash of every tell (lit and dark).
 *
 * The rule is the rat's own (rats/base.ts `draw`): a living rat out of its wait shows its eyes when
 * it is dark (`!lit`) or flashing. Draw only: it reads the rats, it never changes them (owner: wave
 * P1b C; the rats are P1a's). No allocation per frame.
 */
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { Rat } from './rats/base';

const opts: DrawOpts = {};
const at: [number, number] = [0, 0];

/** Draw the eyes of every rat that shows them now (after the darkness). */
export function drawRatEyes(world: World, r: Renderer): void {
  const list = world.byTag('enemy');
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!(e instanceof Rat) || e.removed || e.dead || e.mode === 'wait' || !e.anim.id) continue;
    const flash = e.flashing();
    if (e.lit && !flash) continue;
    e.point('eye', 6, -8, at);
    opts.flipX = e.facing < 0;
    r.sprite(e.spriteId('eyes'), flash ? 1 : 0, Math.round(at[0]), Math.round(at[1]), opts);
  }
}
