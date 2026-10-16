/**
 * The episode of the first-person mode (docs/design/fps.md §1.1, §6): floor 1 "SUPPLY DEPOT"
 * (par 3:30, music `fps-floor`), then floor 2 "HANGAR" (par 2:30, `fps-floor` → `fps-boss` when
 * MechaHitler wakes). The par times and songs live on the floor defs; this is the order.
 * Floor 0 (the test range) is never part of the episode.
 */
import { defineFpsEpisode } from '../../fps/registry';
import { FLOOR_1 } from './floor-1';
import { FLOOR_2 } from './floor-2';

export const FPS_EPISODE_ID = 'ostia';

export const FPS_EPISODE = defineFpsEpisode({ id: FPS_EPISODE_ID, floors: [FLOOR_1.id, FLOOR_2.id] });
