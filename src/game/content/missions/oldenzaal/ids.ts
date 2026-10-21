/**
 * Mission `oldenzaal` (level 4, MISSION 4 "A HAUNTING IN OTOWN"; docs/design/oldenzaal.md,
 * docs/api/oldenzaal.md): EVERY id of the oldenzaal waves, with its owner. Builders import their
 * ids from here and never invent ids under another owner's prefix.
 *
 * Owners (wave A): CORE (this file, the mission stub, the flow, the lines, the contracts),
 * LIGHT (the light pass, weather, y eviction), TOWN (oz-a / oz-b art and layout), POSSESSED (the
 * hosts, the souls, the townspeople), WUGHOST (Meneer Wu, the meal, Mevrouw Winkel), AUDIO (the
 * sample group, the ElevenLabs spec, the synth fallbacks).
 *
 * Owners (wave B, REVISION 2 of the spec, §0): PREP (this file, the section stubs, the lines, the
 * zombie API, the contracts), ZOMBIES (the four dead soldiers, the entrances, the frikandel
 * explosion), RUIN (oz-a / oz-b abandoned: boarded doors and windows, manholes, cars, banners),
 * STATUE (oz-c: the square, Mevrouw Winkel's wake scene, the mini-boss St. Plechelmus, the TO BE
 * CONTINUED face), CHURCH (oz-d the nave, oz-e the crypt), TOWER (oz-f: the climb, the tide, the
 * bells, the jet Swan finale), then INTEGRATE (switched the oz-a / oz-b scripts to the zombies and
 * removed the wave-A possessed, the free souls, the townspeople and the roof ghost: R2-6).
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
  /** Plechelmusplein: Mevrouw Winkel wakes the statue, the mini-boss St. Plechelmus (night, full moon). Wave B: STATUE. */
  c: 'oz-c',
  /** The nave of the basilica: the spooky Catholic church (candle light, lightning). Wave B: CHURCH. */
  d: 'oz-d',
  /** The crypt under the choir (almost dark: votive candles, a lantern glow). Wave B: CHURCH. Revision 2 (was the tower). */
  e: 'oz-e',
  /** The tower, scrolling up (storm), the horde tide, the bells, the jet Swan finale. Wave B: TOWER. Revision 2 (new). */
  f: 'oz-f',
} as const;

/** The six sections in play order (revision 2, spec §2). */
export const OZ_SECTIONS = [OZ_SECTION.a, OZ_SECTION.b, OZ_SECTION.c, OZ_SECTION.d, OZ_SECTION.e, OZ_SECTION.f] as const;
export type OzSectionId = (typeof OZ_SECTIONS)[number];

// ---------------------------------------------------------------------------------------------
// Entities (defineEntity ids)
// ---------------------------------------------------------------------------------------------

/** WUGHOST (src/game/content/oldenzaal/npcs/ and items/). */
export const OZ_WUGHOST = {
  /** Meneer Wu at De Smulhoek's door (the scene in oz-b). Category 'npc'. */
  wu: 'oz-wu',
  /** Mevrouw Winkel, the ghost: never a target (shots pass through). Revision 2: only in the oz-c wake scene. Category 'npc'. */
  winkel: 'oz-winkel',
  /** The meal (the paper tray Wu tosses): gives snack power + 2 frikandel bombs. Category 'item'. */
  meal: 'pickup-oz-meal',
  /** The thrown frikandel (a bomb-button weapon id AND its projectile entity id). */
  frikandel: 'oz-frikandel',
  /** The blast where it lands. Revision 2 (R2-11): a big explosion, heavy damage to every zombie in a wide radius + a stagger (ZOMBIES). Category 'fx'. */
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

// ---------------------------------------------------------------------------------------------
// Revision 2 (wave B): the dead soldiers, the ruin, the statue, the church, the tower
// ---------------------------------------------------------------------------------------------

/**
 * ZOMBIES (src/game/content/oldenzaal/zombies/; THE ZOMBIE API: zombies/api.ts, spec §3). The
 * four dead soldiers (category 'enemy', tag `oz-zombie`) and their shots / effects. The MG
 * zombie is `oz-mg` (wave A's removed possessed gunner was `oz-gunner`; never reuse that id).
 */
export const OZ_ZOMBIES = {
  /** The common one: shambles forward, swings a rifle butt / trench shovel at close range. */
  grunt: 'oz-grunt',
  /** Stops at range, raises a rusty rifle (a long tell), one slow visible shot, a slow reload. */
  rifleman: 'oz-rifleman',
  /** The big one with a machine gun: plants the bipod, a clear tell, a short sweeping burst. */
  gunner: 'oz-mg',
  /** Legless: drags itself along the floor, grabs a hero's feet (tap to break free). */
  crawler: 'oz-crawler',
  /** The rifleman's slow shot (`Enemy.shoot` names it `<type>-shot`). Projectile. */
  rifleShot: 'oz-rifleman-shot',
  /** The MG burst's bullets. Projectile. */
  mgShot: 'oz-mg-shot',
  /** The ground / slab / tomb cracking open where a zombie rises (the rise tell). Category 'fx'. */
  rise: 'oz-rise',
  /** The collapse at 0 HP: a pile of bones and dust that settles and fades. Category 'fx'. */
  bones: 'oz-bones',
  /** A helmet knocked off (a hit or the collapse): it flies and rolls. Category 'fx'. */
  helmet: 'oz-helmet',
} as const;

/** The zombie tag (every dead soldier carries it: `anyAlive(ctx, OZ_ZOMBIE_TAG)`, `waitClear`). */
export const OZ_ZOMBIE_TAG = 'oz-zombie';

/** RUIN (oz-a / oz-b abandoned and worn down, spec §10.3; the opening contract: zombies/api.ts). */
export const OZ_RUIN = {
  /** A boarded-up door or shop window a zombie bursts through (implements `ZombieOpening`). */
  boarded: 'oz-boarded',
  /** A drain cover in the pavers that lifts and slides away (implements `ZombieOpening`). */
  manhole: 'oz-manhole',
} as const;

/** STATUE (oz-c: Plechelmusplein, the wake scene, the mini-boss; spec §5, §6). */
export const OZ_STATUE = {
  /** The statue of St. Plechelmus: the mini-boss (2 phases; parts head / crozier / body). Category 'boss'. */
  boss: 'oz-plechelmus',
  /** The block it breaks off the plinth and lobs (phase 1). Projectile. */
  stone: 'oz-plechelmus-stone',
  /** The small stones the block shatters into (they bounce). Projectile. */
  stoneBit: 'oz-plechelmus-bit',
  /** The ground slam's shockwave along the pavers (phase 2: jump it). Projectile. */
  shockwave: 'oz-plechelmus-wave',
} as const;

/** CHURCH (oz-d the nave, oz-e the crypt; spec §7). */
export const OZ_CHURCH = {
  /** A grave slab in the nave floor a zombie breaks out of (implements `ZombieOpening`). */
  slab: 'oz-slab',
  /** A tomb in the crypt whose lid slides off as a zombie climbs out (implements `ZombieOpening`). */
  tomb: 'oz-tomb',
} as const;

/** TOWER (oz-f: the climb, the horde tide, the bells, the jet Swan finale; spec §8, §9). */
export const OZ_TOWER = {
  /** The horde tide that climbs up behind the players (kills on contact). */
  tide: 'oz-tide',
  /** A swinging bell (a hazard when it swings at a hero, a platform at rest; its toll stuns zombies). */
  bell: 'oz-bell',
  /** The scripted jet Swan of the finale (a `Mountable`, like the m5 finale's ship). */
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
  wughost: ['npc/oz-wu/', 'npc/oz-winkel/', 'item/pickup-oz-meal', 'weapon/oz-frikandel', 'fx/oz/mayo/', 'ui/icon-oz-'],
  light: ['fx/oz/light/', 'fx/oz/weather/'],
  /** TOWN (wave A) → RUIN (wave B) for oz-a / oz-b: the street, De Smulhoek, the basilica exterior. */
  town: ['decor/oz/'],
  /** Revision 2. ZOMBIES: the four dead soldiers, their shots, the rise / collapse / helmet effects. */
  zombies: ['enemy/oz-grunt/', 'enemy/oz-rifleman/', 'enemy/oz-mg/', 'enemy/oz-crawler/', 'enemy/oz-zshot/', 'fx/oz/zombie/'],
  /** Revision 2. RUIN: the worn-down extras (boards, rubbish, cars, tape, torn banners) and the openings. */
  ruin: ['decor/oz-ruin/', 'prop/oz-boarded/', 'prop/oz-manhole/'],
  /** Revision 2. STATUE: the mini-boss, its effects, the square's own decor, the TO BE CONTINUED face. */
  statue: ['boss/oz-plechelmus/', 'fx/oz/statue/', 'decor/oz-square/', 'ui/oz-tbc/'],
  /** Revision 2. CHURCH: the nave and the crypt (decor, the grave slabs, the tombs). `defer: true`. */
  church: ['decor/oz-nave/', 'decor/oz-crypt/', 'prop/oz-slab/', 'prop/oz-tomb/', 'fx/oz/church/'],
  /** Revision 2. TOWER: the tower inside, the tide, the bells, the jet Swan. `defer: true`. */
  tower: ['decor/oz-tower/', 'enemy/oz-tide/', 'prop/oz-bell/', 'vehicle/oz-swan-jet/', 'fx/oz/tower/'],
} as const;

/**
 * Every prefix of the mission (its 1× `art` list for a direct boot adds the shared item / weapon /
 * fx prefixes).
 */
export const OZ_ART_PREFIXES: readonly string[] = [
  ...OZ_SPRITES.wughost,
  ...OZ_SPRITES.light,
  ...OZ_SPRITES.town,
  ...OZ_SPRITES.zombies,
  ...OZ_SPRITES.ruin,
  ...OZ_SPRITES.statue,
  ...OZ_SPRITES.church,
  ...OZ_SPRITES.tower,
];

/**
 * Background generator ids start with this (`defineBgGenerator('oz-street', …)`). Wave B: each
 * owner adds its own second part (`oz-nave-…`, `oz-crypt-…` CHURCH; `oz-tower-…` TOWER;
 * `oz-square-…` STATUE; `oz-ruin-…` RUIN), so ids never clash.
 */
export const OZ_BG_PREFIX = 'oz-';
/** Terrain material ids start with this (`setTerrainPainter('oz-pavers', …)`; wave B as above). */
export const OZ_TERRAIN_PREFIX = 'oz-';

// ---------------------------------------------------------------------------------------------
// Audio ids (synth fallbacks for every one; AUDIO writes the ElevenLabs spec)
// ---------------------------------------------------------------------------------------------

/** Sound effect id prefixes per owner (`defineSfx('oz/zombie/groan', …)`). */
export const OZ_SFX = {
  wu: 'oz/wu/',
  /** Mevrouw Winkel (WUGHOST's recipes; STATUE plays them in the wake scene). */
  ghost: 'oz/ghost/',
  meal: 'oz/meal/',
  /** AUDIO: thunder, rain and wind loops, bells, doors, candles, the town ambience. LIGHT plays thunder. */
  env: 'oz/env/',
  /** Revision 2. ZOMBIES: groans, the rifle shot, the MG burst, the crawler's drag and grab, the collapse into bones, the ground breaking. */
  zombie: 'oz/zombie/',
  /** Revision 2. RUIN: boards and glass bursting, the manhole cover, the town's creaks. */
  ruin: 'oz/ruin/',
  /** Revision 2. STATUE: the wake, the stone crack, the crozier sweep / hook, the throw, the slam, the freed saint. */
  statue: 'oz/statue/',
  /** Revision 2. CHURCH: the organ moan, the doors slamming, slabs and tomb lids, candles. */
  church: 'oz/church/',
  /** Revision 2. TOWER: the tide, the bells' swing and toll, the wind in the openings. */
  tower: 'oz/tower/',
  /** Revision 2. TOWER: the jet Swan (the rocket units, the flyby). */
  swan: 'oz/swan/',
} as const;

/** Song ids (AUDIO: synth fallbacks in content/music/oldenzaal.ts; ElevenLabs takes in wave B). */
export const OZ_SONG = {
  /** The level theme (oz-a, oz-b; the nave and the crypt). */
  theme: 'oldenzaal',
  /** The statue mini-boss (oz-c). */
  boss: 'oldenzaal-boss',
  /** The tower chase (oz-f; revision 2: was oz-e). */
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

/** Ambience loop ids per section (AUDIO defines them under `oz/env/`): street oz-a … oz-c, nave oz-d and oz-e (the crypt), storm oz-f. */
export const OZ_AMBIENCE = {
  street: 'oz/env/street',
  nave: 'oz/env/nave',
  storm: 'oz/env/storm',
} as const;
