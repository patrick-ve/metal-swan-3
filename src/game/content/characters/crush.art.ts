/**
 * The rig's crushed-flat death (anim wave p1) for a character drawn by the rig: the shared pancake /
 * peel strip over its standing pose, `<prefix>/die-flat`. Frame 2 (the long hold) is the pancake
 * settling with its arms splayed, so no two frames match. Used by the retired heroes and the recruit
 * (art.ts) and the stored style trials (styles/index.ts); the squad's own crush is in its 40 px set.
 */
import { defineSprite, getFrames } from '../../../engine/sprites';
import { crushStripHi } from '../../art/hi-strips';
import { renderHuman, type Density, type HumanStyle } from '../../art/humanoid';
import * as P from '../../art/poses';
import { CRUSH_TIMING, crushStrip } from '../creatures/draw';

export function defineRigCrush(prefix: string, style: HumanStyle): void {
  const stand = (d: Density) => renderHuman(style, P.STAND, 'full', d);
  const splay = (d: Density) => renderHuman(style, { ...P.STAND, armN: { sh: 80, el: 10, hand: 'open' }, armF: { sh: -70, el: 10, hand: 'open' }, expr: 'dazed' }, 'full', d);
  const flat = `${prefix}/die-flat`;
  defineSprite(
    flat,
    () => {
      const a = crushStrip(stand(1));
      a[2] = crushStrip(splay(1))[1];
      return a;
    },
    {
      durations: CRUSH_TIMING,
      loop: false,
      defer: true,
      hd: (d) => {
        const a = crushStripHi(stand(1), stand(d), getFrames(flat, 1));
        a[2] = crushStripHi(splay(1), splay(d), crushStrip(splay(1)))[1];
        return a;
      },
    },
  );
}
