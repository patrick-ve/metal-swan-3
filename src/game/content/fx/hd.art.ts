/**
 * HD art registration of the small fx that mission ams shows (docs/ART_GUIDE.md "UHD art"):
 * one density-generic drawer per id (fx/hd/small.ts) makes its 2× and its 4× frames, with the
 * 1× frames' logical size, anchor and points. The explosions register in fx/art.ts, the chute in
 * chute.art.ts, the snore in snore.art.ts, the flashes and shots in weapons/art.ts and
 * weapons/shots.art.ts.
 */
import type { Frame } from '../../../engine/render';
import { defineHdSprite } from '../../../engine/sprites';
import { confettiBitsHd, confettiHd, debrisHd, DEBRIS_HD, dustHd, hitHd, impactHd, noteHd, poofHd, splashHd } from './hd/small';

const reg = (id: string, draw: (id: string, d: number) => Frame[]): void => defineHdSprite(id, (d) => draw(id, d));

reg('fx/impact', impactHd);
reg('fx/hit', hitHd);
reg('fx/hit-spark', hitHd);
reg('fx/dust', dustHd);
reg('fx/splash', splashHd);
for (const kind of DEBRIS_HD) reg(`fx/debris-${kind}`, (id, d) => debrisHd(id, d, kind));
reg('fx/poof', poofHd);
reg('fx/confetti', confettiHd);
reg('fx/confetti-bit', confettiBitsHd);
reg('fx/music-note', noteHd);
