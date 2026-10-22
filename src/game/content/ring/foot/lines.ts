/**
 * ALL the new text of the ring's blockade (`rf-b` DE BLOKKADE) and its pink boat, plus the voiced
 * lines of wave A's ZWAAN train (docs/design/ring.md §R.6–§R.9; docs/api/ring.md "R.B Wave B
 * contracts"). Written by PREP (wave B); the builders take their text from here (never inline), so the
 * AUDIO spec, the voice keys and the tests see one list.
 *
 * Rules (spec §R.8, §R.9, docs/ORIGINALITY.md):
 * - Every bubble, sign and voiced line is DUTCH (plain, standard Dutch; no diacritics: the pixel font
 *   has none). The spandoek title `EXHAUSTING REBELLION` stays (the user's parody name, exactly so).
 *   HUD words stay English (MINI-BOSS, CHECKPOINT ...).
 * - Bubbles: at most 24 characters per line and 2 lines (context.ts `BUBBLE_LINE_CHARS`); the bubble
 *   wraps at a space; a two-line line may carry its own '\n' (the voice key folds it to a space, so a
 *   '\n' never changes a line's take).
 * - Gentle satire: the joke is the situation (glue, soup, a pink boat on a motorway, lunch), never the
 *   people. The parody is of "a real activist movement": never its name, logo, fonts or slogans.
 * - CHANGING A TEXT CHANGES ITS VOICE KEY (`voiceKey(text)`): its take must be made again. Say so in
 *   the report when you change one.
 *
 * Pure data: no imports.
 */

// ---------------------------------------------------------------------------------------------
// Voices (`AudioOut.say(text, speaker)`, `BubbleOpts.speaker`, `gagBubble(..., speaker)`)
// ---------------------------------------------------------------------------------------------

/**
 * The voice speakers of the blockade (designed Dutch voices, never a clone; AUDIO-1 designs them):
 * two activists (the four kinds share them) and the leader on the boat.
 */
export const RING_SPEAKER = {
  /** Young and eager. */
  activistA: 'activist-a',
  /** Older and dry. */
  activistB: 'activist-b',
  /** The megaphone leader on the pink boat. */
  leider: 'leider',
  /** Wave A: ZWARE JONGEN, the ZWAAN cab's driver. */
  cab: 'zware-jongen',
  /** Wave A: the farmhand on the livestock trailer. */
  boer: 'boerenknecht',
} as const;
export type RingSpeaker = (typeof RING_SPEAKER)[keyof typeof RING_SPEAKER];

// ---------------------------------------------------------------------------------------------
// The activists (ACTIVISTS: bubbles and voices)
// ---------------------------------------------------------------------------------------------

export const ACTIVIST_LINES = {
  /** A general shout (any kind). */
  klimaatnood: 'KLIMAATNOOD!',
  /** A glued sitter, content. */
  zitten: 'WIJ ZITTEN HIER GOED!',
  /** A glued sitter, defiant. */
  lijm: 'LIJM IS GEEN MISDAAD!',
  /** A `loper` sits down (the glue tell). */
  sit: 'ZITTEN BLIJVEN!',
  /** The glue lets go with a rip (a beaten `lijmer`). */
  los: 'LOS!',
  /** The chain snaps (a beaten `ketting`). */
  ketting: 'MIJN KETTING!',
  /** The `megafoon`'s shout. */
  toeter: 'TOETER NIET, DOE MEE!',
  /** One runs off in a huff. */
  moeder: 'IK BEL MIJN MOEDER!',
} as const;

/** Who voices which activist line (both voices may get takes under the same key; this is the main one). */
export const ACTIVIST_LINE_SPEAKER: Readonly<Record<keyof typeof ACTIVIST_LINES, RingSpeaker>> = {
  klimaatnood: RING_SPEAKER.activistA,
  zitten: RING_SPEAKER.activistB,
  lijm: RING_SPEAKER.activistA,
  sit: RING_SPEAKER.activistA,
  los: RING_SPEAKER.activistA,
  ketting: RING_SPEAKER.activistB,
  toeter: RING_SPEAKER.activistA,
  moeder: RING_SPEAKER.activistB,
};

// ---------------------------------------------------------------------------------------------
// The leader on the boat (BLOCKADE+BOAT)
// ---------------------------------------------------------------------------------------------

export const LEIDER_LINES = {
  /** Calls a wave of `loper`s (24 characters: one line). */
  wave: 'MEDE-REBELLEN... ZITTEN!',
  /** A taunt between waves. */
  vreedzaam: 'DIT IS EEN VREEDZAAM\nPROTEST!',
  /** Phase 2: the drum band. */
  drums: 'TROMMELS... NU!',
  /** Carried off by the police at the end. */
  lunch: 'WIJ KOMEN TERUG...\nNA DE LUNCH!',
} as const;

// ---------------------------------------------------------------------------------------------
// Signs and banners (NOT voiced; our own pixel lettering, never mirrored)
// ---------------------------------------------------------------------------------------------

/**
 * The big spandoek across the road. The title is the user's parody name (keep it exactly); our mark
 * beside it is a round-bellied hourglass with a smoke puff rising from its top, NEVER inside a circle
 * or a ring.
 */
export const SPANDOEK = {
  title: 'EXHAUSTING REBELLION',
  sub: 'WIJ ZIJN MOE. NU JULLIE OOK.',
} as const;

/** The small banners and signs (the activists hold them; `ActivistParams.sign` takes one of these). */
export const BANNERS: readonly string[] = ['STOP UITLAATGAS', 'LIJM IS GEEN MISDAAD', 'TOETER NIET, DOE MEE', 'KLIMAATNOOD!'];

/** The sign the activists hold up in the in-world continue (they never point or laugh). */
export const CONTINUE_SIGN = 'WIJ HADDEN HET GEZEGD';

/** The pennants on the boat's mast (the spandoek's title, our lettering). */
export const PENNANT_TEXT = SPANDOEK.title;

/** The pink boat's name (on the hull and the boss bar) and the bossIntro's subtitle (a HUD word). */
export const BOAT_TITLE = 'DE LAATSTE DRUPPEL';
export const BOAT_SUBTITLE = 'MINI-BOSS';

// ---------------------------------------------------------------------------------------------
// Wave A's voiced lines (already in the game; AUDIO-1 voices them). Copies of zwaan/cab.ts
// `CAB_LINES` and zwaan/vee.ts `VEE_LINES` (a test holds them equal; those files keep theirs).
// ---------------------------------------------------------------------------------------------

export const WAVE_A_LINES = {
  cab: { rage: 'UIT MIJN SPIEGEL!', beaten: 'MIJN VRACHT...!' },
  boer: { lob: ['HOOI VOOR JOU!', 'VERSE MELK!', 'VAN DE BOER!'], dazed: 'IK ZIE STERRETJES...' },
} as const;

/** One voiced line with its speaker and where it plays. */
export interface RingVoicedLine {
  readonly speaker: RingSpeaker;
  readonly text: string;
  /** `drive`: the RingScene (the train); `foot`: the GameplayScene (rf-a / rf-b). */
  readonly scene: 'drive' | 'foot';
}

/**
 * Every voiced line of the ring (wave A's train and wave B's blockade) with its speaker: the AUDIO
 * spec (tools/audio/spec.ts) and the voice-fit test read it. A bubble whose text has a shipped take
 * (`SAMPLE_MANIFEST['mission:ring'].voice[voiceKey(text)]`) plays it in either scene.
 */
export function ringVoicedLines(): readonly RingVoicedLine[] {
  const foot = (speaker: RingSpeaker, text: string): RingVoicedLine => ({ speaker, text, scene: 'foot' });
  const drive = (speaker: RingSpeaker, text: string): RingVoicedLine => ({ speaker, text, scene: 'drive' });
  return [
    ...(Object.keys(ACTIVIST_LINES) as (keyof typeof ACTIVIST_LINES)[]).map((k) => foot(ACTIVIST_LINE_SPEAKER[k], ACTIVIST_LINES[k])),
    ...Object.values(LEIDER_LINES).map((t) => foot(RING_SPEAKER.leider, t)),
    drive(RING_SPEAKER.cab, WAVE_A_LINES.cab.rage),
    drive(RING_SPEAKER.cab, WAVE_A_LINES.cab.beaten),
    ...WAVE_A_LINES.boer.lob.map((t) => drive(RING_SPEAKER.boer, t)),
    drive(RING_SPEAKER.boer, WAVE_A_LINES.boer.dazed),
  ];
}
