/**
 * Mission `oat` (level 2, MISSION 2 "OAT OF CONTROL"; docs/design/oat.md, docs/api/oat.md): EVERY
 * id of the oat waves, with its owner. Builders import their ids from here and never invent ids
 * under another owner's prefix.
 *
 * Owners (wave A, spec §12.1): CORE (this file, the mission stub, the flow, the contracts), BUDGET
 * (src/game/budget/ and its hooks), STRIPS (src/game/mission/strips/, view.ts), LIGHT-WATER
 * (missions/oat/light/, mission/light/*, mission/floor/reflect.ts, the oat water tiles), GRAMMAR
 * (missions/oat/facade/), STREET-A (missions/oat/floor/ for oat-a, backgrounds.ts,
 * missions/oat/art/), AUDIO (the sample group, the ElevenLabs spec, the synth fallbacks).
 * Waves B and C (spec §12.2, §12.3): CAST-DAY, MAKELAAR, PIECES, QUEUE-B, KADE, NIGHT, CAST-NIGHT,
 * HUISJESMELKER, TAXIRIT, SOUND.
 *
 * Pure data: no imports, so every module (and tests, tools, the non-lazy flow and card code) may
 * import it without pulling in the lazy oat chunk.
 */

/** The mission id (a registered `defineMission` mission, LAZY: content/index.ts `isOatContent`; `?mission=oat`). */
export const OAT_ID = 'oat';

// ---------------------------------------------------------------------------------------------
// Sections (spec §2, decision 41: never bare `a` … `e`, those are ams's light / floor keys)
// ---------------------------------------------------------------------------------------------

export const OAT_SECTION = {
  /** DE 9 STRAATJES, 09:30 (4,608 px): the shops, the bins, the hijsbalk, the draaiorgel, De Makelaar. */
  a: 'oat-a',
  /** FORT NEGEN & ZESTIG, 12:30 (2,816 px): the bakery, DE RIJ (camera lock), the blauwe envelop. */
  b: 'oat-b',
  /** DE KADEMUUR on foot, 17:15 (2,048 px): the quay, the taxi lesson, the Swan returns. */
  c: 'oat-c',
  /** The chase on the water, 17:30 → 18:00 (4,096 px, auto-scroll, `startVehicle: 'swan'`). */
  c1: 'oat-c1',
  /** DE WALLEN BY NIGHT, 22:30 → 03:00 (4,352 px): the tour group, the alley, 03:00, De Huisjesmelker. */
  d: 'oat-d',
  /** DE TAXIRIT, 03:20 → 04:30 (6,144 px): the taxi ride to the A10 (a scripted carrier, wave C). */
  e: 'oat-e',
} as const;

/** The six sections in play order (spec §2). */
export const OAT_SECTIONS = [OAT_SECTION.a, OAT_SECTION.b, OAT_SECTION.c, OAT_SECTION.c1, OAT_SECTION.d, OAT_SECTION.e] as const;
export type OatSectionId = (typeof OAT_SECTIONS)[number];

/** Section widths (spec §2 table). */
export const OAT_WIDTH: Readonly<Record<OatSectionId, number>> = {
  'oat-a': 4608,
  'oat-b': 2816,
  'oat-c': 2048,
  'oat-c1': 4096,
  'oat-d': 4352,
  'oat-e': 6144,
};

// ---------------------------------------------------------------------------------------------
// Entities (defineEntity ids; spec §3–§6)
// ---------------------------------------------------------------------------------------------

/** The enemies (spec §3). CAST-DAY (wave B): brammobiel, bakfiets, taxi. CAST-NIGHT (wave C): dealer, scooter. */
export const OAT_ENEMY = {
  /** The brommobiel influencer (HP 60, € 15,00; `cutter`, `chase` params). Category 'enemy'. */
  brammobiel: 'oat-brammobiel',
  /** The bakfiets-ouder (HP 40, € 12,00; the box is a shield, `LAKSCHADE`). Category 'enemy'. */
  bakfiets: 'oat-bakfiets',
  /** The aggressive taxi (HP 120, € 25,00; `RITPRIJS` when left alive). Category 'enemy'. */
  taxi: 'oat-taxi',
  /** The Wallen dealer (HP 10, € 5,00; the pickpocket). Category 'enemy'. */
  dealer: 'oat-dealer',
  /** The handhaver on a white e-scooter beside the taxi (oat-e only; HP 30, € 8,00). Category 'enemy'. */
  scooter: 'oat-handhaver-scooter',
} as const;

/** The reused `ams` locals (spec §3 "Reused"; code and art unchanged). */
export const OAT_LOCALS = {
  handhaver: 'handhaver',
  fatbike: 'fatbike-youth',
  rider: 'delivery-rider',
  ticket: 'boete-ticket',
} as const;

/** The bosses (spec §4, §5). MAKELAAR (wave B), HUISJESMELKER (wave C). Category 'boss'. */
export const OAT_BOSS = {
  /** De Makelaar, the mini-boss at the end of oat-a (`bossStart` x 4,250). */
  makelaar: 'oat-makelaar',
  /** De Huisjesmelker, the boss in the oat-d arena (`bossStart` x 3,990). */
  huisjesmelker: 'oat-huisjesmelker',
  /** The viewing crowd of de bezichtiging (one entity, about 20 bodies; MAKELAAR, npcs/). */
  viewers: 'oat-viewers',
} as const;

/** The set pieces and the budget props (spec §6). PIECES (wave B) unless named. */
export const OAT_PIECE = {
  /** A statiegeld bin (100 L / 200 L, HP 30). */
  bin: 'oat-bin',
  /** Its pickups: a can (+€ 0,15), a small bottle (+€ 0,15), a big bottle (+€ 0,25). Category 'item'. */
  can: 'oat-can',
  bottleS: 'oat-bottle-s',
  bottleL: 'oat-bottle-l',
  /** DE HAVERBAR, the havermelk-bar shop window (a and the c kiosk). */
  haverbar: 'oat-haverbar',
  /** The blauwe envelop (TERUGGAAF / AANSLAG). */
  envelope: 'oat-envelope',
  /** The hijsbalk with its load (a piano in a, a sofa in d). */
  hoist: 'oat-hoist',
  /** Het draaiorgel (a, once). */
  organ: 'oat-street-organ',
  /** De conceptstore's glass case with the €85 sock (a weapon crate in disguise). */
  conceptstore: 'oat-conceptstore',
  /** DE RIJ and U BENT NUMMER 47 (one entity draws the queue; QUEUE-B). */
  queue: 'oat-queue',
  /** Gids op de brug: the guide and his tour group (oat-d; CAST-NIGHT). */
  tourGroup: 'oat-tour-group',
  /** The crumbling quay wall of the chase (oat-c1; KADE). */
  collapse: 'oat-kade-collapse',
  /** The sinkhole that swallows the scan car (oat-c1; KADE). */
  sinkhole: 'oat-sinkhole',
  /** The 03:00 switch: the neon goes out group by group (oat-d; NIGHT). */
  neonOut: 'oat-neon-out',
  /** The taxi ride's carrier and its window seat (oat-e; TAXIRIT). */
  taxiRide: 'oat-taxi-ride',
  seat: 'oat-seat',
} as const;

/** Player statuses (`defineStatus`; PIECES, QUEUE-B). */
export const OAT_STATUS = {
  flatWhite: 'oat-flat-white',
  matcha: 'oat-matcha',
  zuurdesem: 'oat-zuurdesem',
  brioche: 'oat-brioche-power',
} as const;

// ---------------------------------------------------------------------------------------------
// Sprite, generator and painter prefixes per owner (SectionDef.art / MissionDef.art use them)
// ---------------------------------------------------------------------------------------------

/**
 * Sprite id prefixes of the oat waves (spec §8.12: unique, never under an `ams` prefix: ams sits at
 * 251.6 of 256 MB). A builder defines sprites only under its own sub-prefix: STREET-A `decor/oat/a/`,
 * NIGHT `decor/oat/d/`, PIECES `decor/oat/piece/` and `item/oat/`, CAST-DAY `enemy/oat-brammobiel/` …
 */
export const OAT_SPRITE_PREFIXES = ['item/oat/', 'ui/oat/', 'npc/oat/', 'decor/oat/', 'fx/oat/', 'enemy/oat-', 'boss/oat-'] as const;

/** Is `id` an oat sprite id (the art worker loads the lazy oat chunk for it: src/game/art-worker.ts)? */
export function isOatSpriteId(id: string): boolean {
  for (const p of OAT_SPRITE_PREFIXES) if (id.startsWith(p)) return true;
  return false;
}

/**
 * Background generator, terrain material, floor painter, floor tile and strip source ids start with
 * this (`defineBgGenerator('oat-a-sky', …)`, `defineFloorPainter('oat-street', …)`,
 * `defineStripSource('oat-facade', …)`). Each owner adds its own second part: `oat-a-…` STREET-A,
 * `oat-water-…` LIGHT-WATER, `oat-facade…` GRAMMAR, `oat-d-…` NIGHT, `oat-stub-…` CORE's placeholders.
 */
export const OAT_GEN_PREFIX = 'oat-';

/** The strip source of the façade grammar (GRAMMAR registers it; SectionDef.strips.source). */
export const OAT_STRIP_SOURCE = 'oat-facade';

// ---------------------------------------------------------------------------------------------
// Audio ids (AUDIO: synth fallbacks for every one; the ElevenLabs takes in wave C)
// ---------------------------------------------------------------------------------------------

/** The songs (spec §9.1; `content/music/oat.ts`). Part markers are the songs' own (`ctx.music(id, fade, { from })`). */
export const OAT_SONG = {
  a: 'oat-a',
  b: 'oat-b',
  /** Part A the afternoon quay, part B the chase (also the taxi ride). */
  c: 'oat-c',
  d: 'oat-d',
  /** Part A De Makelaar, part B De Huisjesmelker. */
  boss: 'oat-boss',
} as const;

/** Sound effect id prefix (`defineSfx('oat/bin/burst', …)`; content/sfx/oat*.ts). */
export const OAT_SFX_PREFIX = 'oat/';

/** Ambience loop ids per section (AUDIO defines them). */
export const OAT_AMBIENCE: Readonly<Record<OatSectionId, string>> = {
  'oat-a': 'oat/env/morning',
  'oat-b': 'oat/env/noon',
  'oat-c': 'oat/env/quay',
  'oat-c1': 'oat/env/chase',
  'oat-d': 'oat/env/night',
  'oat-e': 'oat/env/taxi',
};

/** Voice speakers (spec §9.2; `AudioOut.say(line, speaker)`, `BubbleOpts.speaker`). */
export const OAT_SPEAKER = {
  makelaar: 'makelaar',
  huisjesmelker: 'huisjesmelker',
  taxi: 'taxi',
  barista: 'barista',
  influencer: 'influencer',
  bakfiets: 'bakfiets',
  dealer: 'dealer',
  /** The bakery staff. */
  rijStaf: 'rij-staf',
  /** The queue people. */
  rij: 'rij',
  gids: 'gids',
  huurder: 'huurder',
  /** Reused (new lines in its designed voice). */
  handhaver: 'handhaver',
} as const;

/** The mission's sample group (spec §9.3; AUDIO adds it to SAMPLE_GROUPS, GROUP_DIRS, LAZY_GROUPS). */
export const OAT_AUDIO_GROUP = 'mission:oat';
