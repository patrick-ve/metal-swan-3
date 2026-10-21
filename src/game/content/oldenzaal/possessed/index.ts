/**
 * Mission oldenzaal — the possessed (docs/design/oldenzaal.md §3; docs/api/oldenzaal.md
 * "POSSESSED"). Owner: POSSESSED. Registers at import time; art in ./art.ts, synth sfx in
 * content/sfx/oldenzaal-possessed.ts ('oz/possessed/…').
 *
 * | id | category | params (+ the Enemy params `hp`, `drop`, `tag`, `facing`) |
 * |---|---|---|
 * | `oz-shambler` | enemy | `look` (looks.ts: shopper jogger student vendor pensioner churchgoer churchgoer-b; default a street look), `entry` ('left' / 'right': walks in; 'rise': the spasm of a fresh possession, no attack until it stands), `repossessed` (counts toward the cap) |
 * | `oz-gunner` | enemy | `look`, `entry`, `hold` (px: stands this far from the player, default 170) |
 * | `oz-brute` | enemy | `look` ('butcher' / 'bouncer'), `entry` |
 * | `oz-soul` | enemy (flyer) | `from` ('drain' / 'chimney' / 'chandelier' / 'air'): it rises out of a drain (y = the drain), out of a chimney top, drops from a chandelier, or fades in (air) |
 * | `oz-townsperson` | npc (neutral) | `look`, `mode` ('idle' / 'run' / 'hide' / 'freed'), `flee` (default true), `dirX` (freed) |
 * | `oz-soul-eject` | fx | (spawned by a host's death) `facing` |
 * | `oz-ghost-shot` | projectile | `facing`, `arc` (true: the lob), `floor` (feet y for the ground flight; default y + 20) |
 *
 * Script API: `possessTownsperson(e, count?)`, `ejectSoul(e, owner?, dirX?)`,
 * `ejectSoulsInArea(world, x, y, r, owner?)`, `holyDamage(owner?, dirX?)`, `OZ_HOLY_TAG`, the tags
 * `OZ_HOST_TAG` / `OZ_SOUL_TAG` / `OZ_TOWN_TAG` (e.g. `anyAlive(ctx, …)` waits), `canRepossess`.
 */
import { paramBool, paramFacing, paramNum, defineEntity } from '../../../registry';
import { OZ_POSSESSED } from '../../missions/oldenzaal/ids';
import { Brute, Gunner, Shambler } from './host';
import { BRUTE, GUNNER, SHAMBLER, SOUL } from './numbers';
import { fireGhostShot } from './shot';
import { FreeSoul, SoulEject } from './soul';
import { Townsperson } from './townsperson';

export * from './api';
export { Brute, Gunner, PossessedHost, Shambler, lookParam } from './host';
export * from './looks';
export * from './numbers';
export { mistAt } from './mist';
export { GhostShot, fireGhostShot } from './shot';
export { FreeSoul, SoulEject, type SoulFrom } from './soul';
export { Townsperson, isTownsperson, possessTownsperson, type TownMode } from './townsperson';

defineEntity(OZ_POSSESSED.shambler, (w, x, y, p) => new Shambler(w, x, y, p), {
  category: 'enemy',
  score: SHAMBLER.score,
  description: 'Possessed townsperson: slow shamble (0.5 px/tick), arms forward; grab / claw at close range (tell 24, box live only in the strike). At 0 HP the soul is ejected and the person freed (oldenzaal).',
});
defineEntity(OZ_POSSESSED.gunner, (w, x, y, p) => new Gunner(w, x, y, p), {
  category: 'enemy',
  score: GUNNER.score,
  description: 'Possessed townsperson who stands while his soul raises a ghost rifle: a long glowing tell (48), a slow spectral shot along the ground or a low arc (oldenzaal).',
});
defineEntity(OZ_POSSESSED.brute, (w, x, y, p) => new Brute(w, x, y, p), {
  category: 'enemy',
  score: BRUTE.score,
  description: 'Possessed big host (the butcher, a bouncer): more HP, a heavy charge after a tell (36), knocks over street furniture (oldenzaal).',
});
defineEntity(OZ_POSSESSED.soul, (w, x, y, p) => new FreeSoul(w, x, y, p), {
  category: 'enemy',
  score: SOUL.score,
  description: 'Free soldier soul (flyer): drifts, swoops after a tell (30), few HP; re-possesses a frightened townsperson (circle tell 30, then a dive; max 2 on screen). Params from: drain / chimney / chandelier / air (oldenzaal).',
});
defineEntity(OZ_POSSESSED.townsperson, (w, x, y, p) => new Townsperson(w, x, y, p), {
  category: 'npc',
  description: 'Frightened townsperson (neutral): runs from the possessed and hides; freed hosts fall, sit dazed, get up and leave. Can be (re-)possessed (oldenzaal).',
});
defineEntity(OZ_POSSESSED.soulEject, (w, x, y, p) => new SoulEject(w, x, y, p), {
  category: 'fx',
  description: 'The ejected soul: rises with a wail, flickers and fades (40 ticks); shoot it for a bonus (oldenzaal).',
});
defineEntity(
  OZ_POSSESSED.ghostShot,
  (w, x, y, p) => fireGhostShot(w, x, y, paramFacing(p, -1), paramNum(p, 'floor', y + 20), paramBool(p, 'arc', false), null),
  { category: 'projectile', description: 'Spectral ghost-rifle shot: slow, glowing; along the ground at knee height or a low arc; can be shot down (params facing, arc, floor).' },
);
