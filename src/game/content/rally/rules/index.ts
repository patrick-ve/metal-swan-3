/**
 * The race's rules (RULES, wave B; docs/design/rally.md §2, §4, §5, §7.6, §9, §10; docs/api/rally.md
 * "B.R"), registered with the plug-in hooks of registry.ts when the lazy rally content loads:
 *
 * - the system `rules` (order 200): `RallyRules` (src/game/rally/rules/) — the event director, the
 *   matrix signs, the speed cameras, the average-speed zone, the red X, the road works of lap 2, the
 *   police of lap 3, the overtakes, best laps and tunnels; the safe point of a mid-race join;
 * - the scenery `rules/works` (order 300): the road works (cones, barriers, the arrow-board truck,
 *   the yellow temporary lines, a mobile camera) and the police's beacons and `STOP POLITIE` display;
 * - the HUD part `rules/hud` (order 200): the clock, the warnings (`FLITSER`, a red X ahead, road
 *   works, the average-speed zone, `POLITIE`, the open spitsstrook), the white flash of a camera,
 *   `BOETE EUR n`, `AAN DE KANT!`, the speed dial, the ring mini-map and the radio ticker's slot.
 */
import { defineRallyHud, defineRallyScenery, defineRallySystem } from '../../../rally/registry';
import { installRules } from '../../../rally/rules/rules';
import { createRulesHud } from './hud';
import { buildRulesScenery } from './scenery';
import './sfx';

defineRallySystem({ id: 'rules', order: 200, install: (runner) => void installRules(runner) });
defineRallyScenery({ id: 'rules/works', order: 300, build: buildRulesScenery });
defineRallyHud({ id: 'rules/hud', order: 200, create: createRulesHud });
