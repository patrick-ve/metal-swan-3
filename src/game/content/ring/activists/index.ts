/**
 * The blockade's people (wave B; docs/design/ring.md §R.6; docs/api/ring.md "R.B Wave B contracts",
 * "R.B1 The activists and the police"): the four activist kinds (kinds.ts), the police (police.ts),
 * the hero opt-ins (status.ts: status effects, off unless a ring entity adds them), the thrown things
 * and puddles (fx.ts), the art (art.ts). Loaded by `ring/foot` (foot/index.ts) and by the content
 * manifest entry `ring/activists`.
 */
import { ACTIVIST_HOOKS, type ActivistImpl } from './api';
import './kinds';
import { callPoliceImpl } from './police';
import { glueHero, pushHero, stunHero } from './status';
import './art';

/** The implementation behind api.ts's delegating functions. */
export const ACTIVIST_IMPL: ActivistImpl = { callPolice: callPoliceImpl, glueHero, pushHero, stunHero };
ACTIVIST_HOOKS.impl = ACTIVIST_IMPL;

export * from './api';
export { GLUE_PUDDLE_TAG, GluePuddle, ShoutRing, Splat, ACT_FX } from './fx';
export { Activist, ACT } from './kit';
export { Lijmer, Ketting, Megafoon, Loper, RoadProp, ACT_TELL, LOB_TICKS, CRATE_H, SQUEAL_REACH, LIJMER, KETTING, MEGAFOON, LOPER } from './kinds';
export { Agent, PoliceJob, CARRY_HALF, LIFT_PX } from './police';
export { GLUE_STATUS, STUN_STATUS, PUSH_STATUS } from './status';
export { ACT_ART, ACT_STYLE, AGENT_STYLE, LOOKS, lookOf } from './looks';
