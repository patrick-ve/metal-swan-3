/**
 * Mission `sewers` (level 2, MISSION 2 "RATTENJONG MET DE RATTENITEMS"; docs/design/sewers.md): EVERY
 * id of the sewers waves. Builders import their ids from here and never invent ids under another
 * owner's prefix (spec §9: P0 the scaffold; P1a RATS / STREET the cast; P1b A–E the sections, the
 * bosses and the set pieces).
 *
 * Pure data: no imports, so every module (tests, tools, the non-lazy flow and card code) may import
 * it without pulling in the lazy sewers chunk.
 */

/** The mission id (a registered `defineMission` mission, LAZY: content/index.ts `isSewersContent`; `?mission=sewers`). */
export const SEWERS_ID = 'sewers';

/** The mission's name on its card and banner (spec §1). */
export const SEWERS_NAME = 'RATTENJONG MET DE RATTENITEMS';

// ---------------------------------------------------------------------------------------------
// Sections (spec §2; never bare `a` … `e`: those are ams's light / floor keys)
// ---------------------------------------------------------------------------------------------

export const SEWERS_SECTION = {
  /** DE WALLEN, 23:00 (3,072 px): the quay, GOUDEN GERRIT's limo at the bridge head. */
  a: 'sewers-a',
  /** DE STEEGJES, 01:00 (2,560 px): the alleys, the square, the rat eruption, the burst grate. */
  b: 'sewers-b',
  /** DE PUT, 01:30 (1,920 px): the fall, FLASHLIGHTS ON, the first brick tunnel. */
  c: 'sewers-c',
  /** HET RIOOL, 02:30 (2,816 px): the sewer tunnels, the fatberg. */
  d: 'sewers-d',
  /** DE AFVALHAL, 05:00 (1,280 px): the trash hall, DE RATTENJONG, the flood. */
  e: 'sewers-e',
  /** DAGERAAD, 07:15 (384 px): script only, the manhole at dawn, the squad's white wagon. */
  end: 'sewers-end',
} as const;

/** The six sections in play order (spec §1). */
export const SEWERS_SECTIONS = [SEWERS_SECTION.a, SEWERS_SECTION.b, SEWERS_SECTION.c, SEWERS_SECTION.d, SEWERS_SECTION.e, SEWERS_SECTION.end] as const;
export type SewersSectionId = (typeof SEWERS_SECTIONS)[number];

/** Section widths (spec §2 table; *start*). */
export const SEWERS_WIDTH: Readonly<Record<SewersSectionId, number>> = {
  'sewers-a': 3072,
  'sewers-b': 2560,
  'sewers-c': 1920,
  'sewers-d': 2816,
  'sewers-e': 1280,
  'sewers-end': 384,
};

/** The section banners: the place and the clock (spec §1). */
export const SEWERS_BANNER: Readonly<Record<SewersSectionId, string>> = {
  'sewers-a': 'DE WALLEN - 23:00',
  'sewers-b': 'DE STEEGJES - 01:00',
  'sewers-c': 'DE PUT - 01:30',
  'sewers-d': 'HET RIOOL - 02:30',
  'sewers-e': 'DE AFVALHAL - 05:00',
  'sewers-end': 'DAGERAAD - 07:15',
};

// ---------------------------------------------------------------------------------------------
// Entities (defineEntity ids; spec §3–§5). None exists yet in P0: the cast waves add them.
// ---------------------------------------------------------------------------------------------

/** The street cast (spec §3; P1a STREET, `content/sewers/street/`). Category 'enemy'. */
export const SEWERS_STREET = {
  dealer: 'sewers-dealer',
  pimp: 'sewers-pimp',
  bodyguard: 'sewers-bodyguard',
} as const;

/** The rats (spec §3; P1a RATS, `content/sewers/rats/`). Category 'enemy'. */
export const SEWERS_RAT = {
  runner: 'sewers-rat-runner',
  leaper: 'sewers-rat-leaper',
  spitter: 'sewers-rat-spitter',
  brute: 'sewers-rat-brute',
} as const;

/** The bosses (spec §4). Category 'boss'. */
export const SEWERS_BOSS = {
  /** GOUDEN GERRIT and his limo, the mini-boss at the end of sewers-a (wave A). */
  gerrit: 'sewers-gerrit',
  /** DE RATTENJONG, the boss of the sewers-e arena (wave E). */
  rattenjong: 'sewers-rattenjong',
} as const;

/** The set pieces and the new pickup (spec §5). */
export const SEWERS_PIECE = {
  /** The eruption grates of sewers-b (wave B). */
  grate: 'sewers-grate',
  /** The fatberg of sewers-d and the small secret one (wave D). */
  fatberg: 'sewers-fatberg',
  /** The flashlight battery (wave C). */
  battery: 'pickup-battery',
} as const;

/** The returning ams locals (spec §3 "Returning"; code and art unchanged). */
export const SEWERS_LOCALS = {
  rider: 'delivery-rider',
  fatbike: 'fatbike-youth',
} as const;

/**
 * The new hostage kind (spec §3, the lead's id 2026-11-12: the mission prefix keeps it in the lazy
 * chunk). P1a STREET registers it (content/sewers/street/hostages.ts); its voice speaker stays
 * `sewer-worker` (content/samples/sewers.ts).
 */
export const SEWERS_HOSTAGE_WORKER = 'sewers-worker';

// ---------------------------------------------------------------------------------------------
// Sprites (spec §1: every sprite id of this mission has a path segment starting with `sewers-`)
// ---------------------------------------------------------------------------------------------

/**
 * Is `id` a sewers sprite id (`enemy/sewers-rat-runner/run`, `boss/sewers-rattenjong/throw`,
 * `decor/sewers-grate/burst`)? The art worker loads the lazy sewers chunk for it
 * (src/game/art-worker.ts). No allocation.
 */
export function isSewersSpriteId(id: string): boolean {
  return id.startsWith('sewers-') || id.includes('/sewers-');
}

// ---------------------------------------------------------------------------------------------
// Audio ids (spec §7; synth fallbacks in content/music/sewers.ts and content/sfx/sewers.ts)
// ---------------------------------------------------------------------------------------------

/** The songs (spec §7). */
export const SEWERS_SONG = {
  /** a, b: slow sleazy synth-funk, ~90 BPM. */
  street: 'sewers-street',
  /** The mini-boss GOUDEN GERRIT: a short funky boss loop. */
  gerrit: 'sewers-gerrit',
  /** c, d: dark drones, drips, a low pulse. */
  sewer: 'sewers-sewer',
  /** e: heavy and grimy; its outro plays on sewers-end. */
  boss: 'sewers-boss',
} as const;

/** Sound effect id prefix (`sewers/rat-squeak`; content/sfx/sewers.ts `SEWERS_SFX`). */
export const SEWERS_SFX_PREFIX = 'sewers/';

/** The mission's sample group (engine/samples.ts SAMPLE_GROUPS, tools/audio/lib.ts GROUP_DIRS, LAZY_GROUPS). */
export const SEWERS_AUDIO_GROUP = 'mission:sewers';

// ---------------------------------------------------------------------------------------------
// Wave P1b E: DE RATTENJONG's fight (content/bosses/sewers-rattenjong/) and the dawn (sewers-end)
// ---------------------------------------------------------------------------------------------

/** The Rattenjong's throne, his throws, the flood (spec §4.2) and the props of the dawn (spec §2.6). */
export const SEWERS_E_IDS = {
  /** The trash mountain he sits on (decor in depth; it lowers in phase 2). */
  throne: 'sewers-rattenjong-throne',
  /** Phase 1/2 throws: the bike (shootable 24 HP), its two bouncing parts, the cart, the scooter. */
  bike: 'sewers-rattenjong-bike',
  bikePart: 'sewers-rattenjong-bike-part',
  cart: 'sewers-rattenjong-cart',
  scooter: 'sewers-rattenjong-scooter',
  /** The water that comes down through the cracked vault at the end (cosmetic, no kill). */
  flood: 'sewers-flood',
  /** sewers-end: the manhole the heroes climb out of, and the squad's white wagon that picks them up. */
  manhole: 'sewers-manhole',
  wagon: 'sewers-wagon',
} as const;
