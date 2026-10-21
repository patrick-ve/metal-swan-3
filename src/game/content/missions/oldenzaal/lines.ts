/**
 * ALL the text of mission `oldenzaal` (docs/design/oldenzaal.md §1, §3.3, §4.2, §6): the story
 * card, Meneer Wu's scene, the meal's name, Mevrouw Winkel's lines, the townspeople's lines. Our
 * own text: short, English with Dutch flavour, grim with dry humour. Builders take their lines
 * from here (never inline text) so the AUDIO spec, the voice keys and the tests see one list.
 *
 * Limits:
 * - Speech bubbles (HUD, context.ts `BUBBLE_LINE_CHARS`): at most 24 characters per line and 2
 *   lines; a two-line bubble has its own '\n' (the voice key folds it to a space).
 * - Story card lines: one row of the small font, at most 352 px (the glitch bridge's rule).
 *
 * The rules (spec §4.2, docs/ORIGINALITY.md): Meneer Wu speaks plain, correct Dutch and English
 * (no accent, no broken language, no joke about his origin); his joke is his work ethic. Mevrouw
 * Winkel is eerie and brief. Nothing mocks the church or the saint. Pure data: no imports.
 */

/** The typed story card after the first-person floors (StoryCardScene; 3–5 lines). */
export const STORY_CARD_LINES: readonly string[] = [
  'BACK IN THE PRESENT. THE RING IS CLEAN. THE FRIES ARE COLD.',
  'THEN A CALL FROM OLDENZAAL, FAR OUT EAST: "COME QUICKLY."',
  'SOMETHING FROM THAT OLD WAR DID NOT STAY IN THE GROUND.',
  'THE SWAN FLIES THE SQUAD EAST. THE SUN GOES DOWN RED.',
  'OVER THE ROOFTOPS THE CHUTES OPEN. NOT ONE LIGHT IN TOWN.',
];

/** The TO BE CONTINUED card (ToBeContinuedScene): the big line and the small line under it. */
export const TBC_TITLE = 'TO BE CONTINUED';
export const TBC_SUB = 'MEVROUW WINKEL IS NOT DONE WITH OLDENZAAL.';

// ---------------------------------------------------------------------------------------------
// Meneer Wu (WUGHOST: the oz-b scene, voiced by speaker 'wu')
// ---------------------------------------------------------------------------------------------

/** The scene's lines in order (like the ams FABEL FRIET briefing; one bubble each). */
export const WU_LINES: readonly string[] = [
  'GOEDENAVOND! INSIDE,\nQUICK. MIND THE FLOOR.',
  'MEVROUW WINKEL IS BACK.\nWELL. HER GHOST IS.',
  'SHE WAKES THE SOULS OF\nOLD SOLDIERS.',
  'THEY CRAWL INTO PEOPLE.\nBAD FOR BUSINESS.',
  'CLOSE? NEE. IK SLUIT\nPAS OM TIEN UUR.',
  'HERE. EAT FIRST.\nTHEN SAVE MY TOWN.',
];

/** Wu's waves from the door before the scene (a short call; optional). */
export const WU_CALL = 'HE! IN HERE!';

/** The meal's name (the toss callout, the HUD, the spec): spelled exactly like this. */
export const MEAL_NAME = 'PATAT MAYO MET 2 FRIKANDELLEN';

/** The callout when a hero catches the meal (SNACK POWER!). */
export const SNACK_POWER_CALLOUT = 'SNACK POWER!';

/** The mayo splat's pop when it absorbs a hit. */
export const SPLAT_POP = 'SPLAT!';

// ---------------------------------------------------------------------------------------------
// Mevrouw Winkel (WUGHOST; voiced by speaker 'winkel'; story moments only, spec §6)
// ---------------------------------------------------------------------------------------------

export const WINKEL_LINES = {
  /** oz-a: on a roof at dusk as the heroes drop; she raises the lantern and vanishes. */
  roof: 'WELKOM...\nIN MIJN STAD.',
  /** oz-c (wave B): she flies into the statue. */
  statue: 'RISE, OLD STONE.',
  /** oz-c (wave B): torn out of the stone, she flees into the basilica. */
  flee: 'THIS IS NOT OVER...',
  /** oz-d (wave B): she slams the doors of the nave. */
  doors: 'NIEMAND GAAT WEG.',
  /** oz-e top (wave B): she watches the Swan fly off. */
  tower: 'FLY, LITTLE BIRDS.\nFOR NOW.',
} as const;

// ---------------------------------------------------------------------------------------------
// The townspeople (POSSESSED: freed hosts and frightened people; no speaker voice in wave A)
// ---------------------------------------------------------------------------------------------

/** A freed host as it runs off (now and then, spec §3.3). */
export const FREED_LINES: readonly string[] = [
  'BEDANKT!',
  'WAT IS ER GEBEURD?',
  'MIJN HOOFD...',
  'WAAR IS MIJN FIETS?',
  'IK WIL NAAR HUIS!',
  'DANK JE WEL!',
  'WAS IK DAT?',
  'BRRR. ZO KOUD.',
];

/** A frightened townsperson as a soul comes near (rare; never mocking). */
export const FRIGHT_LINES: readonly string[] = ['HELP!', 'NIET SCHIETEN!', 'RENNEN!'];

// ---------------------------------------------------------------------------------------------
// St. Plechelmus (wave B, STATUE; speaker 'plechelmus': a deep stony rumble, 1–3 lines)
// ---------------------------------------------------------------------------------------------

/** The freed saint, back on his plinth (the only words he says). */
export const PLECHELMUS_LINES: readonly string[] = ['DANK U, KINDEREN.'];

/** The statue's plaque (spec §0 #23: only this, in our own lettering). */
export const PLAQUE_TEXT = 'ST. PLECHELMUS';

/** The boss bar name (wave B). */
export const STATUE_BOSS_NAME = 'ST. PLECHELMUS';

// ---------------------------------------------------------------------------------------------
// Signs (TOWN: our own pixel lettering)
// ---------------------------------------------------------------------------------------------

/** The snack bar's sign board (cream script on dark green, our own script lettering). */
export const SMULHOEK_SIGN = 'de Smulhoek';

/** The signpost arms (from the user's photo's signpost; real names allowed, spec §12). */
export const SIGNPOST: readonly string[] = ['MUSEUM', 'PLECHELMUSBASILIEK', 'STADHUIS', 'GANZENMARKT'];

/** Every speech line of the mission with its speaker (the AUDIO spec and the voice tests read it). */
export function voicedLines(): ReadonlyArray<{ readonly speaker: 'wu' | 'winkel' | 'plechelmus'; readonly text: string }> {
  return [
    ...WU_LINES.map((text) => ({ speaker: 'wu' as const, text })),
    { speaker: 'wu', text: WU_CALL },
    ...Object.values(WINKEL_LINES).map((text) => ({ speaker: 'winkel' as const, text })),
    ...PLECHELMUS_LINES.map((text) => ({ speaker: 'plechelmus' as const, text })),
  ];
}
