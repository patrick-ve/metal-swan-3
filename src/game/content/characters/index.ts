/**
 * Content category "characters": playable characters (docs/ARCHITECTURE.md §6.1, §7; GDD §3).
 * Registers at import time. Art lives in characters/art.ts under `char/<id>/…`; the Helium Head
 * status (GDD §4.13) lives in characters/helium.ts, Gramps' squeaky boot in characters/squeak.ts.
 *
 * The playable roster is the squad of five friends (docs/design/squad.md §1, user decision
 * 2026-10-16): vincent, thom, dirk, bob, patrick. Their first names and bios are the user's own
 * words. The four GDD heroes (grace, mittens, pip, gramps) stay registered but not playable, so
 * the m1–m5 code, Gramps' radio role in ams and their tests keep working.
 *
 * Every hero shares one set of stats (GDD §3: the same hitbox, speeds, jump, weapons and knife).
 * They differ in look, idle fidget, knife look (cosmetic), death flourish, victory pose and
 * lines. Bombs per life are left to the difficulty (10, EASY 15; GDD §6.1).
 */
import { PAL } from '../../../engine/palette';
import { defineCharacter, type CharacterDef, type CharacterStats } from '../../registry';
import './helium';
import { SQUEAK } from './squeak';

/** The held prop of a hero's knife look (GDD §3, §6.2; drawn in `torso-<w>-knife`). */
export type KnifeProp = 'knife' | 'umbrella' | 'needles' | 'pan' | 'wrench' | 'plan' | 'pistol-butt' | 'plunger' | 'airliner' | 'frikandel';

/**
 * A CharacterDef with the heroes' cosmetic extras. `defineCharacter` keeps the object as it is, so
 * `getCharacter(id)` returns these fields too: read them with a structural cast, e.g.
 * `(player.character as { knifeSfx?: string }).knifeSfx ?? 'weapon/knife'`.
 */
export interface HeroDef extends CharacterDef {
  /** Knife look: the prop held in the knife strips (`knife` = the standard knife). */
  knifeProp?: KnifeProp;
  /** The character's knife sound (GDD §6.2, §15.7), played instead of `weapon/knife`. */
  knifeSfx?: string;
  /** A status to apply when the `bored` fidget ends (Gramps: `squeaky-boot`, GDD §3.4). */
  boredStatus?: string;
}

/** Identical for every hero (GDD §3). No `bombs`: the difficulty gives 10 (EASY 15). */
export const HERO_STATS: CharacterStats = { speed: 1, jump: 1, weapon: 'pistol', bomb: 'grenade', melee: 'knife', ammo: 1 };

/**
 * Select-screen order (docs/design/squad.md §1, §3.4: P1 starts on 0, P2 on 1). `recruit` and the
 * retired heroes (RETIRED) are not listed.
 */
export const PLAYABLE: readonly string[] = ['vincent', 'thom', 'dirk', 'bob', 'patrick'];

/** The GDD heroes: registered (m1–m5, Gramps' radio role, tests), not on the select screen. */
export const RETIRED: readonly string[] = ['grace', 'mittens', 'pip', 'gramps'];

/** The squad (docs/design/squad.md §1): first names only; the bios are the user's words. */
const SQUAD: readonly HeroDef[] = [
  {
    id: 'vincent',
    name: 'VINCENT',
    fullName: 'VINCENT',
    title: 'THE CONSULTANT',
    role: 'THE CONSULTANT',
    callsign: 'THE CONSULTANT',
    art: 'char/vincent',
    description: 'An overpriced consultant who looks like a famous British comedian. Always has a battle plan ready.',
    quote: '"I HAVE A PLAN. IT\'S BILLABLE."',
    endingLine: '"ALL AS PER MY BATTLE PLAN. MY INVOICE IS IN THE POST."',
    voice: 'VINCENT!',
    color: PAL.red[2],
    stats: HERO_STATS,
    knifeProp: 'plan',
    knifeSfx: 'weapon/knife-umbrella',
  },
  {
    id: 'thom',
    name: 'THOM',
    fullName: 'THOM',
    title: 'LITTLE NAPOLEON',
    role: 'LITTLE NAPOLEON',
    callsign: 'LITTLE NAPOLEON',
    art: 'char/thom',
    description: 'Little Napoleon. 1900 headshots with his akimbo pistols.',
    quote: '"TWO PISTOLS. TWICE THE HEADSHOTS."',
    endingLine: '"1901 HEADSHOTS. I\'M STILL COUNTING."',
    voice: 'THOM!',
    color: PAL.sky[1],
    stats: HERO_STATS,
    knifeProp: 'pistol-butt',
    knifeSfx: 'weapon/knife-wrench',
  },
  {
    id: 'dirk',
    name: 'DIRK',
    fullName: 'DIRK',
    title: 'THE PLUMBER',
    role: 'THE PLUMBER',
    callsign: 'THE PLUMBER',
    art: 'char/dirk',
    description: 'A plumber with a mustache, wielding exceptional combat abilities.',
    quote: '"I FIX LEAKS. AND ENEMIES."',
    endingLine: '"ALL CLEAR. THE PIPES ARE QUIET AGAIN."',
    voice: 'DIRK!',
    color: PAL.gold[2],
    stats: HERO_STATS,
    knifeProp: 'plunger',
    knifeSfx: 'weapon/knife-pan',
  },
  {
    id: 'bob',
    name: 'BOB',
    fullName: 'BOB',
    title: 'CAPTAIN CLIMATE',
    role: 'CAPTAIN CLIMATE',
    callsign: 'CAPTAIN CLIMATE',
    art: 'char/bob',
    description: 'A Jewish superhero who tries to save the climate by flying to Istanbul every month.',
    quote: '"SAVE THE PLANET! MY FLIGHT\'S AT SIX."',
    endingLine: '"PLANET SAVED. NOW, IF YOU\'LL EXCUSE ME, I HAVE A FLIGHT."',
    voice: 'BOB!',
    color: PAL.green[3],
    stats: HERO_STATS,
    knifeProp: 'airliner',
    knifeSfx: 'weapon/knife-needles',
  },
  {
    id: 'patrick',
    name: 'PATRICK',
    fullName: 'PATRICK',
    title: 'THE SUPERNERD',
    role: 'THE SUPERNERD',
    callsign: 'THE SUPERNERD',
    art: 'char/patrick',
    description: 'A supernerd with a keen appetite for AI and master of eating frikandellen.',
    quote: '"ASK THE AI. THEN PASS THE FRIKANDEL."',
    endingLine: '"FRIKANDELLEN FOR EVERYONE! THE AI ORDERED THEM."',
    voice: 'PATRICK!',
    color: PAL.teal[2],
    stats: HERO_STATS,
    knifeProp: 'frikandel',
    knifeSfx: 'weapon/knife',
  },
];

/** The retired GDD heroes (GDD §3.1–§3.4). */
const GDD_HEROES: readonly HeroDef[] = [
  {
    id: 'grace',
    name: 'GRACE',
    fullName: 'CAPT. GRACE STILLMERE',
    title: 'SQUAD LEADER',
    role: 'SQUAD LEADER',
    callsign: 'GRACE',
    art: 'char/grace',
    description: 'Squad leader. Unflappable, polite, dry. Says "pardon me" before throwing a grenade.',
    quote: '"PARDON ME. I\'M HERE TO STOP THE MUSIC."',
    endingLine: '"THANK YOU, EVERYONE. YOU MAY NOW RESUME BEING QUIET."',
    voice: 'GRACE!',
    color: PAL.sky[2],
    stats: HERO_STATS,
    knifeProp: 'umbrella',
    knifeSfx: 'weapon/knife-umbrella',
  },
  {
    id: 'mittens',
    name: 'MITTENS',
    fullName: 'SGT. TORVALD "MITTENS" MAGNUSSON',
    title: 'HEAVY WEAPONS. KNITTING.',
    role: 'HEAVY WEAPONS. KNITTING.',
    callsign: 'MITTENS',
    art: 'char/mittens',
    description: 'A gentle giant who almost never speaks. Knits between firefights.',
    quote: '"..."',
    quoteSub: '(HE NODS. HE HAS KNITTED YOU A SCARF.)',
    endingLine: '(HE GIVES FANFARONI A SCARF. IT SAYS SHHH.)',
    voice: 'MITTENS!',
    color: PAL.red[3],
    stats: HERO_STATS,
    knifeProp: 'needles',
    knifeSfx: 'weapon/knife-needles',
  },
  {
    id: 'pip',
    name: 'PIP',
    fullName: 'PVT. PIP OKAFOR',
    title: 'ROOKIE',
    role: 'ROOKIE',
    callsign: 'PIP',
    art: 'char/pip',
    description: 'The rookie. Read the whole recruitment brochure and believes every word.',
    quote: '"IS THIS THE REAL WAR? THE BROCHURE HAD MORE BALLOONS!"',
    endingLine: '"CAN WE DO THAT AGAIN? FROM THE START?"',
    voice: 'PIP!',
    color: PAL.gold[2],
    stats: HERO_STATS,
    knifeProp: 'pan',
    knifeSfx: 'weapon/knife-pan',
  },
  {
    id: 'gramps',
    name: 'GRAMPS',
    fullName: 'W.O. AMBROSE "GRAMPS" FENWICK',
    title: 'ENGINEER. BUILT THE SWAN.',
    role: 'ENGINEER. BUILT THE SWAN.',
    callsign: 'GRAMPS',
    art: 'char/gramps',
    description: 'Seventy, and a bit. Designed every Metal Swan. Grumpy, proud, secretly very sweet.',
    quote: '"BACK IN MY DAY, TANKS DIDN\'T HAVE LEGS. THEN I GAVE THEM LEGS."',
    endingLine: '"RIGHT. WHO WANTS TO SEE THE MK4? IT\'S A SUBMARINE. DON\'T TELL ACCOUNTING."',
    voice: 'GRAMPS!',
    color: PAL.orange[1],
    stats: HERO_STATS,
    knifeProp: 'wrench',
    knifeSfx: 'weapon/knife-wrench',
    boredStatus: SQUEAK.id,
  },
];

const HEROES: readonly HeroDef[] = [...SQUAD, ...GDD_HEROES];

for (const h of HEROES) defineCharacter(h);

/** Knife sound per character id (GDD §6.2); characters without one use `weapon/knife`. */
export const KNIFE_SFX: Readonly<Record<string, string>> = Object.fromEntries(
  HEROES.filter((h) => h.knifeSfx).map((h) => [h.id, h.knifeSfx as string]),
);

/** The knife sound for a character id: its variant, else `weapon/knife`. */
export function knifeSfxFor(characterId: string): string {
  return KNIFE_SFX[characterId] ?? 'weapon/knife';
}

// The plain test character (mission m0 and debugging; not on the select screen): standard kit.
defineCharacter({
  id: 'recruit',
  name: 'RECRUIT',
  title: 'PRIVATE, FIRST DAY',
  art: 'char/recruit',
  description: 'Fresh out of basic training. Standard issue everything, and keen to prove it.',
  stats: { speed: 1, jump: 1, weapon: 'pistol', bomb: 'grenade', melee: 'knife', ammo: 1 },
  color: PAL.olive[3],
  voice: 'Recruit, reporting for duty!',
});
