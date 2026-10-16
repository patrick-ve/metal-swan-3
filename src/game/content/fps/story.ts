/**
 * Story text of the first-person mode (docs/design/fps.md §1.4): the glitch bridge's story card
 * and the fps ending's captions. Pure data with no imports (no `define*` calls), so eager scenes
 * (the bridge, the ending) may import it without loading the lazy fps content.
 *
 * Every bridge line fits one row of the small font (≤ 352 px) with the longest callsign
 * (tests/game/fps/flow.test.ts checks it).
 */

/** The placeholder for the fps slot's callsign (`getCharacter(slot.character).name`). */
export const CALLSIGN = '{CALLSIGN}';

/** The story card after the glitch, one row per line (typed at 2 ticks per character). */
export const BRIDGE_LINES: readonly string[] = [
  "ROBO-HALSEMA'S LAST STAMP HIT THE WRONG BUTTON.",
  'AMSTERDAM FOLDED UP LIKE A CHEAP TOURIST MAP.',
  '{CALLSIGN} WOKE UP IN A FREIGHT CAR. THE YEAR: 1944.',
  'EVERYTHING LOOKED CLOSER. AND MUCH MORE FIRST-PERSON.',
  'OUTSIDE: A SUPPLY DEPOT FULL OF VERY SERIOUS SOLDIERS.',
  'SOMEWHERE ABOVE THEM, THEIR LEADER HAS BUILT HIMSELF A MECH.',
];

/** The captions of the fps ending (EndingScene variant 'fps'), the last one in gold. */
export const FPS_ENDING_CAPTIONS: readonly string[] = [
  'THE STEEL SUIT WAS SOLD FOR SCRAP. IT FETCHED VERY LITTLE.',
  'THE SUPPLY DEPOT IS A BICYCLE SHED NOW.',
  'TASK FORCE CYGNET WOKE UP ON A BENCH IN AMSTERDAM, HOLDING FRIES.',
  'NOBODY BELIEVED A WORD OF IT.',
  'THE END ... FOR NOW.',
];

/** A story line with the callsign filled in. */
export function withCallsign(line: string, callsign: string): string {
  return line.split(CALLSIGN).join(callsign);
}
