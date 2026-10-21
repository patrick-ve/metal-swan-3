/**
 * Mission `oldenzaal` (level 4, MISSION 4 "A HAUNTING IN OTOWN"; docs/design/oldenzaal.md,
 * docs/api/oldenzaal.md): EVERY id of the oldenzaal waves, with its owner. Builders import their
 * ids from here and never invent ids under another owner's prefix.
 *
 * Owners (wave A): CORE (this file, the mission stub, the flow, the lines, the contracts),
 * LIGHT (the light pass, weather, y eviction), TOWN (oz-a / oz-b art and layout), POSSESSED (the
 * hosts, the souls, the townspeople), WUGHOST (Meneer Wu, the meal, Mevrouw Winkel), AUDIO (the
 * sample group, the ElevenLabs spec, the synth fallbacks). Wave B: STATUE, NAVE, TOWER, FINALE.
 *
 * Pure data: no imports, so every module (and tests, tools) may import it.
 */

/** The mission id (a registered `defineMission` mission; `?mission=oldenzaal`). */
export const OLDENZAAL_ID = 'oldenzaal';

// ---------------------------------------------------------------------------------------------
// Sections (the art packs are keyed by section id: never `a` … `e`, those are ams's)
// ---------------------------------------------------------------------------------------------

export const OZ_SECTION = {
  /** The drop over the roofs + the main shopping street (dusk). TOWN (art, layout), INTEGRATE (script). */
  a: 'oz-a',
  /** The corner with De Smulhoek, Meneer Wu's scene (late dusk). TOWN, WUGHOST, INTEGRATE. */
  b: 'oz-b',
  /** Plechelmusplein, the statue boss (night). Wave B: STATUE. */
  c: 'oz-c',
  /** The nave of the basilica (candles, lightning). Wave B: NAVE. */
  d: 'oz-d',
  /** The tower, scrolling up (storm), the Swan finale. Wave B: TOWER, FINALE. */
  e: 'oz-e',
} as const;

export const OZ_SECTIONS = [OZ_SECTION.a, OZ_SECTION.b, OZ_SECTION.c, OZ_SECTION.d, OZ_SECTION.e] as const;
export type OzSectionId = (typeof OZ_SECTIONS)[number];

// ---------------------------------------------------------------------------------------------
// Entities (defineEntity ids)
// ---------------------------------------------------------------------------------------------

/** POSSESSED (src/game/content/oldenzaal/possessed/). */
export const OZ_POSSESSED = {
  /** Slow walker, arms forward; grab / claw at close range (tell ≥ 18 ticks). Category 'enemy'. */
  shambler: 'oz-shambler',
  /** The host stands; its soul raises a ghost rifle (a slow spectral shot). Category 'enemy'. */
  gunner: 'oz-gunner',
  /** A big host (the butcher, a bouncer): more HP, a heavy charge. Category 'enemy'. */
  brute: 'oz-brute',
  /** A free soul (a flyer, `body: false`): drifts, swoops, dies in a few shots. Category 'enemy'. */
  soul: 'oz-soul',
  /** A frightened townsperson (neutral NPC): runs and hides; can be (re-)possessed. Category 'npc'. */
  townsperson: 'oz-townsperson',
  /** The ejected soul: rises with a wail, flickers, fades (~40 ticks). Category 'fx'. */
  soulEject: 'oz-soul-eject',
  /** The gunner's spectral shot (a projectile). */
  ghostShot: 'oz-ghost-shot',
} as const;

/** WUGHOST (src/game/content/oldenzaal/npcs/ and items/). */
export const OZ_WUGHOST = {
  /** Meneer Wu at De Smulhoek's door (the scene in oz-b). Category 'npc'. */
  wu: 'oz-wu',
  /** Mevrouw Winkel, the ghost: never a target (shots pass through). Category 'npc'. */
  winkel: 'oz-winkel',
  /** The meal (the paper tray Wu tosses): gives snack power + 2 frikandel bombs. Category 'item'. */
  meal: 'pickup-oz-meal',
  /** The thrown frikandel (a bomb-button weapon id AND its projectile entity id). */
  frikandel: 'oz-frikandel',
  /** The holy-mayo blast where it lands (ejects every soul in it). Category 'fx'. */
  blast: 'oz-frikandel-blast',
  /** The mayo splat that absorbs one hit under snack power. Category 'fx'. */
  splat: 'oz-mayo-splat',
} as const;

/** The snack power status (`defineStatus`; WUGHOST): 20 s (Patrick 30 s), fire ×1.5, one hit absorbed. */
export const OZ_STATUS_SNACK = 'snack-power';

/** LIGHT (the mission light pass and weather; contract: content/oldenzaal/kit/light-api.ts). */
export const OZ_LIGHT = {
  /** The tag of every entity that gives light (it implements `LightSource.lightOf`). */
  tag: 'oz-light',
  /** An invisible point light a script or a section can place (params: r, color, flicker). Category 'fx'. */
  point: 'oz-light-point',
  /** Background layer generator ids (`defineBgGenerator`): drifting fog bands, rain streaks. */
  fogLayer: 'oz-fog',
  rainLayer: 'oz-rain',
} as const;

/** Wave B (reserved; do not use in wave A). */
export const OZ_WAVE_B = {
  /** The statue of St. Plechelmus (the oz-c boss). STATUE. */
  statue: 'oz-statue',
  /** The scripted jet Swan of the finale. FINALE. */
  swanJet: 'oz-swan-jet',
} as const;

// ---------------------------------------------------------------------------------------------
// Sprite prefixes per owner (SectionDef.art / MissionDef.art / preloadFirst use them)
// ---------------------------------------------------------------------------------------------

/**
 * Sprite id prefixes per owner. A builder defines sprites only under its own prefixes; every
 * prefix ends in '/' or is a full id.
 */
export const OZ_SPRITES = {
  possessed: ['enemy/oz-shambler/', 'enemy/oz-gunner/', 'enemy/oz-brute/', 'enemy/oz-soul/', 'enemy/oz-ghost-shot/', 'npc/oz-town/', 'fx/oz/soul/'],
  wughost: ['npc/oz-wu/', 'npc/oz-winkel/', 'item/pickup-oz-meal', 'weapon/oz-frikandel', 'fx/oz/mayo/', 'ui/icon-oz-'],
  light: ['fx/oz/light/', 'fx/oz/weather/'],
  town: ['decor/oz/'],
  /** Wave B. */
  statue: ['boss/oz-statue/'],
  finale: ['vehicle/oz-swan-jet/'],
} as const;

/** Every wave-A prefix (the mission's `art` adds the shared item / weapon / fx prefixes). */
export const OZ_ART_PREFIXES: readonly string[] = [...OZ_SPRITES.possessed, ...OZ_SPRITES.wughost, ...OZ_SPRITES.light, ...OZ_SPRITES.town];

/** TOWN's background generator ids start with this (`defineBgGenerator('oz-street', …)`). */
export const OZ_BG_PREFIX = 'oz-';
/** TOWN's terrain material ids start with this (`setTerrainPainter('oz-pavers', …)`). */
export const OZ_TERRAIN_PREFIX = 'oz-';

// ---------------------------------------------------------------------------------------------
// Audio ids (synth fallbacks for every one; AUDIO writes the ElevenLabs spec)
// ---------------------------------------------------------------------------------------------

/** Sound effect id prefixes per owner (`defineSfx('oz/possessed/groan', …)`). */
export const OZ_SFX = {
  possessed: 'oz/possessed/',
  wu: 'oz/wu/',
  ghost: 'oz/ghost/',
  meal: 'oz/meal/',
  /** AUDIO: thunder, rain and wind loops, bells, doors, candles, the town ambience. LIGHT plays thunder. */
  env: 'oz/env/',
  /** Wave B. */
  statue: 'oz/statue/',
  swan: 'oz/swan/',
} as const;

/** Song ids (AUDIO: synth fallbacks in content/music/oldenzaal.ts; ElevenLabs takes in wave B). */
export const OZ_SONG = {
  /** The level theme (oz-a, oz-b; the nave). */
  theme: 'oldenzaal',
  /** The statue boss (oz-c). */
  boss: 'oldenzaal-boss',
  /** The tower chase (oz-e). */
  tower: 'oldenzaal-tower',
  /** The TO BE CONTINUED sting. */
  tbc: 'oldenzaal-tbc',
} as const;

/** Voice speakers (`AudioOut.say(line, speaker)`, `BubbleOpts.speaker`). */
export const OZ_SPEAKER = {
  wu: 'wu',
  winkel: 'winkel',
  plechelmus: 'plechelmus',
} as const;

/** The mission's sample group (AUDIO plumbs it; the mission sets `audioGroup` once it exists). */
export const OZ_AUDIO_GROUP = 'mission:oldenzaal';

/** Ambience loop ids per section (AUDIO defines them under `oz/env/`). */
export const OZ_AMBIENCE = {
  street: 'oz/env/street',
  nave: 'oz/env/nave',
  storm: 'oz/env/storm',
} as const;
