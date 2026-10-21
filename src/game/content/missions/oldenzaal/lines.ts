/**
 * ALL the text of mission `oldenzaal` (docs/design/oldenzaal.md §1, §4.2, §5.2, §6; REVISION 2):
 * the story card, Meneer Wu's scene, the meal's name, Mevrouw Winkel's wake lines on
 * Plechelmusplein, the statue's stony lines, the signs. Our own text: short, English with Dutch
 * flavour, grim with dry humour. Builders take their lines from here (never inline text) so the
 * AUDIO spec, the voice keys and the tests see one list.
 *
 * Revision 2 (the user's feedback after wave A): the enemies are the dead soldiers of the old war
 * who walk again since Mevrouw Winkel's ghost came back; NO souls, NO possession, NO townspeople
 * (the town is abandoned; only Meneer Wu still works). Mevrouw Winkel appears ONCE, on the square:
 * she wakes the statue (`WINKEL_LINES.wake` → `.call` → `.statue`, then her laugh; torn out of the
 * stone at the end: `.flee`). Removed in revision 2: Winkel's roof / doors / tower lines and the
 * townspeople's lines.
 *
 * Limits:
 * - Speech bubbles (HUD, context.ts `BUBBLE_LINE_CHARS`): at most 24 characters per line and 2
 *   lines; a two-line bubble has its own '\n' (the voice key folds it to a space).
 * - Story card lines: one row of the small font, at most 352 px (the glitch bridge's rule).
 *
 * The rules (spec §4.2, §7, docs/ORIGINALITY.md): Meneer Wu speaks plain, correct Dutch and
 * English (no accent, no broken language, no joke about his origin); his joke is his work ethic.
 * Mevrouw Winkel is eerie and brief. Nothing mocks the church or the saint (he is a victim and is
 * freed). No real units, names, slogans or quotes of the war. Pure data: no imports.
 */

/** The typed story card after the first-person floors (StoryCardScene; 3–5 lines). */
export const STORY_CARD_LINES: readonly string[] = [
  'BACK IN THE PRESENT. THE RING IS CLEAN. THE FRIES ARE COLD.',
  'THEN A CALL FROM OLDENZAAL, FAR OUT EAST: "COME QUICKLY."',
  'A GHOST WAS SEEN THERE. NOW THE DEAD OF THE OLD WAR WALK.',
  'THE TOWN HAS FLED. THE SWAN FLIES THE SQUAD EAST AT DUSK.',
  'OVER THE DARK ROOFS THE CHUTES OPEN. NOT ONE LIGHT BELOW.',
];

/** The TO BE CONTINUED card (ToBeContinuedScene): the big line and the small line under it. */
export const TBC_TITLE = 'TO BE CONTINUED';
export const TBC_SUB = 'MEVROUW WINKEL IS NOT DONE WITH OLDENZAAL.';

// ---------------------------------------------------------------------------------------------
// Meneer Wu (WUGHOST: the oz-b scene, voiced by speaker 'wu')
// ---------------------------------------------------------------------------------------------

/**
 * The scene's lines in order (like the ams FABEL FRIET briefing; one bubble each). Revision 2: the
 * dead soldiers walk since Mevrouw Winkel's ghost came back; the whole town fled; he is the last one
 * who still works and keeps the fryer going (R2-12).
 */
export const WU_LINES: readonly string[] = [
  'GOEDENAVOND! INSIDE,\nQUICK. MIND THE FLOOR.',
  'MEVROUW WINKEL CAME\nBACK. HER GHOST, I MEAN.',
  'SINCE THEN THE DEAD\nSOLDIERS CLIMB OUT.',
  'THE TOWN FLED. I STAY.\nTHE FRYER IS STILL HOT.',
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
// Mevrouw Winkel (STATUE plays her ONE scene with WUGHOST's `oz-winkel`; speaker 'winkel'; §5.2, §6)
// ---------------------------------------------------------------------------------------------

export const WINKEL_LINES = {
  /** oz-c, the wake: she fades in beside the plinth and looks at the heroes. */
  wake: 'SO. YOU CAME FOR\nMY LITTLE TOWN.',
  /** oz-c, the wake: she turns to the statue. */
  call: 'MY DEAD ARE TIRED.\nLET THE STONE WALK.',
  /** oz-c, the wake: she laughs and flies into the statue. */
  statue: 'STA OP, OUDE STEEN.',
  /** oz-c, the end: torn out of the stone, she flees with a shriek (not seen again in this level). */
  flee: 'THIS IS NOT OVER...',
} as const;

/** The wake scene's lines in order (STATUE: one bubble each, then `laugh()`, then `possessInto`). */
export const WINKEL_WAKE_LINES: readonly string[] = [WINKEL_LINES.wake, WINKEL_LINES.call, WINKEL_LINES.statue];

// ---------------------------------------------------------------------------------------------
// St. Plechelmus (STATUE; speaker 'plechelmus': a deep stony rumble, spec §11: 1–3 lines)
// ---------------------------------------------------------------------------------------------

/**
 * The statue's few words. Under the curse he only groans (the saint is a victim: he never threatens
 * or mocks); freed and back on his plinth he thanks the squad.
 */
export const PLECHELMUS_LINES = {
  /** The cracks open and the eyes glow (the wake): the cursed stone groans. */
  wake: 'ZO... ZWAAR...',
  /** Phase 2: he steps down off the plinth, against his will. */
  step: 'VERGEEF MIJ...',
  /** Freed, back on his plinth, whole: the only clear words he says. */
  freed: 'DANK U, KINDEREN.',
} as const;

/** The statue's plaque (spec §0 #23: only this, in our own lettering). */
export const PLAQUE_TEXT = 'ST. PLECHELMUS';

/** The boss bar name (STATUE; marked as a mini-boss). */
export const STATUE_BOSS_NAME = 'ST. PLECHELMUS';

// ---------------------------------------------------------------------------------------------
// Signs (TOWN / RUIN: our own pixel lettering)
// ---------------------------------------------------------------------------------------------

/** The snack bar's sign board (cream script on dark green, our own script lettering). */
export const SMULHOEK_SIGN = 'de Smulhoek';

/** The signpost arms (from the user's photo's signpost; real names allowed, spec §12). */
export const SIGNPOST: readonly string[] = ['MUSEUM', 'PLECHELMUSBASILIEK', 'STADHUIS', 'GANZENMARKT'];

/** The notes on boarded doors and windows (RUIN, spec §10.3: our own short Dutch notes). */
export const RUIN_NOTES: readonly string[] = ['GESLOTEN', 'NIET BETREDEN'];

/**
 * Every voiced speech line of the mission (revision 2) with its speaker (the AUDIO spec and the
 * voice tests read it).
 */
export function voicedLines(): ReadonlyArray<{ readonly speaker: 'wu' | 'winkel' | 'plechelmus'; readonly text: string }> {
  return [
    ...WU_LINES.map((text) => ({ speaker: 'wu' as const, text })),
    { speaker: 'wu', text: WU_CALL },
    ...WINKEL_WAKE_LINES.map((text) => ({ speaker: 'winkel' as const, text })),
    { speaker: 'winkel', text: WINKEL_LINES.flee },
    ...Object.values(PLECHELMUS_LINES).map((text) => ({ speaker: 'plechelmus' as const, text })),
  ];
}
