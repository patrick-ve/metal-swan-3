/**
 * The rally teams (FIELD, wave B; docs/design/rally.md §2, §6; docs/api/rally.md "B.F"): seven odd
 * teams in made-up junk cars (our own designs: no maker badges, made-up yellow plates, each team's
 * name on the doors and the roof in our lettering). Each has a character in its `CarSpec` (mass,
 * top speed, acceleration, grip), a share of the difficulty's pace, a horn (a synth placeholder id;
 * wave C makes the sound) and a DJ mention (a line id; wave C writes the text).
 *
 * Registered here (lazy content): the team models, the teams (`defineRallyTeams`: the rivals in grid
 * order, 7 in 1P and the first 6 in 2P), FIELD's system 'rivals' (src/game/rally/ai-rival.ts: the
 * rival AI) and the results part of the HUD (`results.ts`: UITSLAG with all 8).
 */
import { installRivals, type RivalSpec } from '../../../rally/ai-rival';
import { RALLY_MODEL } from '../../../rally/ids';
import { defineRallyHud, defineRallyModel, defineRallySystem, defineRallyTeams, type RivalEntry } from '../../../rally/registry';
import { TEAM_MODEL_IDS as M, TEAM_MODELS } from '../models/team-index';
import { createResults } from './results';

/** A rally team: its car (spec) and its share of the difficulty's pace. */
export interface Team extends RivalEntry {
  readonly spec: RivalSpec;
  readonly pace: number;
}

const team = (id: string, name: string, model: string, s: Omit<RivalSpec, 'id' | 'team' | 'model'>, pace: number): Team => ({
  spec: { id, team: name, model, horn: `rally/horn/${id}`, dj: `rally/dj/team/${id}`, ...s },
  pace,
});

/**
 * The teams in grid order (1P: all seven; 2P: the first six). Pace × the difficulty's `PACE`
 * (runner.ts) drives each one; the handling gives the character:
 * - DE LAATSTE RIT: the black hearse — fast and heavy, rear-wheel drive.
 * - OMA TRUUS: a tiny 1990s hatchback driven far too fast — light, quick, grippy, a high pace.
 * - VRIJGEZELLEN: the white stretch limousine — fast on the straights, long and lazy in bends.
 * - DE FRIETBAK: the snack van with the giant cone of fries — heavy and tall.
 * - HUISJE OP WIELEN: the 1970s camper — slow on the straights, leans in corners, driven flat out.
 * - ACHTERUIT: the small 1970s saloon with a belt drive — as fast backwards as forwards (its gag).
 * - DE IJSCOMAN: the ice-cream van (wave C: its tune when it is near).
 */
export const TEAMS: readonly Team[] = [
  team('laatste-rit', 'DE LAATSTE RIT', RALLY_MODEL.rival, { mass: 1800, topSpeed: 60.5, accel: 6.0, grip: 0.95, fwd: false, bias: -0.7 }, 0.955),
  team('oma-truus', 'OMA TRUUS', M.oma, { mass: 820, topSpeed: 57, accel: 7.2, grip: 1.02, bias: 0.5 }, 0.97),
  team('vrijgezellen', 'VRIJGEZELLEN', M.limo, { mass: 2400, topSpeed: 60, accel: 6.0, grip: 0.92, fwd: false, bias: -1.2 }, 0.95),
  team('frietbak', 'DE FRIETBAK', M.frietbak, { mass: 2100, topSpeed: 55, accel: 5.8, grip: 0.94, fwd: false, lean: 1.6, bias: 1.0 }, 0.962),
  team('huisje', 'HUISJE OP WIELEN', M.camper, { mass: 2300, topSpeed: 51.5, accel: 5.2, grip: 0.97, fwd: false, lean: 2.6, bias: 0.2 }, 0.985),
  team('achteruit', 'ACHTERUIT', M.achteruit, { mass: 850, topSpeed: 55, accel: 6.6, grip: 1.0, reverseAccel: 6.6, reverseTop: 55, gag: 'reverse', bias: -0.3 }, 0.945),
  team('ijscoman', 'DE IJSCOMAN', M.ijsco, { mass: 1900, topSpeed: 54, accel: 5.9, grip: 0.95, lean: 1.5, bias: 1.3 }, 0.965),
];

/** The team names in grid order (the UITSLAG, the tests). */
export const TEAM_NAMES: readonly string[] = TEAMS.map((t) => t.spec.team);
/** Each team's share of the difficulty's pace (grid order). */
export const TEAM_PACE: readonly number[] = TEAMS.map((t) => t.pace);

for (const def of TEAM_MODELS) defineRallyModel(def);

defineRallyTeams({ id: 'teams', rivals: (count) => TEAMS.slice(0, Math.max(0, count)) });
defineRallySystem({ id: 'rivals', order: 110, install: (runner) => void installRivals(runner) });
defineRallyHud({ id: 'results', order: 900, create: createResults });
