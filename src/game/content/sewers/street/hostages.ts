/**
 * Mission sewers' hostages (docs/design/sewers.md §3; owner P1a STREET), registered from the lazy
 * chunk through the hostage table's hooks (items/hostages.ts `registerHostageKind`,
 * `registerHostageLook`):
 *
 * - **the sewer worker**, kind `sewers-worker` (waves C and D place one each): orange overalls, a
 *   helmet with a dead head-lamp, tangled in wet wipes. Freed: he walks over, says his two gag lines
 *   (spawn param `lines`: two bubble texts; c `['EINDELIJK LICHT!', 'HIER, EEN BATTERIJ!']` (the
 *   default), d `['PAK DIE PROPPEN AAN!', 'MET VUUR!']`), gives the normal `drop` param (c
 *   `pickup-battery`, d `{ id: 'pickup-weapon', params: { weapon: … } }`), bows and runs off.
 *   ```ts
 *   ctx.spawn('hostage', 1000, 'ground', { kind: 'sewers-worker', bind: 'sack', drop: 'pickup-battery' });
 *   ctx.spawn('hostage', 1700, 'ground', { kind: 'sewers-worker', bind: 'float', lines: [SEWERS_VOICE.worker.plugs, SEWERS_VOICE.worker.fire], drop: … });
 *   ```
 * - **the banana tourist**: a look of the existing `tourist` kind (`look: 'banana'`), the stag-party
 *   guy in a banana costume; he acts as the tourist does (SAY CHEESE's photo flash) but his line is
 *   `DANK JE, MAN!`. The plain tourist (no `look`) is unchanged.
 *   ```ts
 *   ctx.spawn('hostage', 1150, 'ground', { kind: 'tourist', look: 'banana', bind: 'chair' });
 *   ```
 *
 * Their sprites (stand-ins, hostages.art.ts) carry the `sewers-` segment
 * (`item/hostage/sewers-worker/tied`, `item/hostage/sewers-banana/tied`).
 */
import type { Hostage, HostageKind } from '../../../hostage';
import { hudOf } from '../../../context';
import { registerHostageKind, registerHostageLook } from '../../items/hostages';
import { SEWERS_VOICE, sewersSayTicks } from '../../samples/sewers';
import { BANANA_ART, WORKER_ART } from './hostages.art';

/** The kind id of the sewer worker (missions/sewers/ids.ts `SEWERS_HOSTAGE_WORKER`). */
export const WORKER_KIND = 'sewers-worker';
/** The look id of the banana tourist (`{ kind: 'tourist', look: 'banana' }`). */
export const BANANA_LOOK = 'banana';
/** The worker's voice (content/samples/sewers.ts speaker of the `worker` lines). */
const WORKER_SPEAKER = 'sewer-worker';

/** The worker's gag: line 1 at once, line 2 when line 1 is read; then the gift and the bow. */
export const WORKER_GAG = { second: 75, ticks: 130 } as const;

/** The default lines (section c). */
const DEFAULT_LINES: readonly [string, string] = [SEWERS_VOICE.worker.light, SEWERS_VOICE.worker.battery];

/** The two gag lines of a worker from its `lines` param (two strings), else the c lines. */
export function workerLines(h: Hostage): readonly [string, string] {
  const v = h.params.lines;
  if (Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string') return [v[0], v[1]];
  return DEFAULT_LINES;
}

const WORKER: HostageKind = {
  id: WORKER_KIND,
  gagTicks: WORKER_GAG.ticks,
  gag(h, t) {
    if (t !== 0 && t !== WORKER_GAG.second) return;
    const text = workerLines(h)[t === 0 ? 0 : 1];
    hudOf(h.world).bubble(h, text, { ticks: Math.min(sewersSayTicks(text), WORKER_GAG.ticks - t + 30), kind: 'gag', speaker: WORKER_SPEAKER });
  },
  gagFrame(_h, t) {
    return t < WORKER_GAG.second ? (t >> 3) & 1 : 2 + ((t >> 3) & 1);
  },
};

registerHostageKind(WORKER);
registerHostageLook('tourist', BANANA_LOOK, { art: BANANA_ART, line: SEWERS_VOICE.tourist.thanks });

export { BANANA_ART, WORKER_ART };
