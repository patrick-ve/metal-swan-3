/**
 * Data for the flow screens (GDD §13): the mission cards (intro card + newspaper headline) and
 * the fixed texts of the title, mode select, tally, ending and credits. Pure data — no scene
 * imports — so content modules can register cards without import cycles.
 *
 * Mission cards are registered by `content/ui/index.ts` for m0–m5 (GDD §2.4, §13.6, §13.11);
 * a mission module may register its own with `defineMissionCard`. A mission without a card gets
 * one built from its MissionDef (`missionCard`).
 */
import type { CampaignRecord } from '../app';
import type { Difficulty } from '../session';
import { getMission } from '../registry';
import { OLDENZAAL_ID } from '../content/missions/oldenzaal/ids';

/** A polyline of the intro card's line map: x, y pairs in screen px (384 × 216). */
export type MapLine = readonly number[];

export interface MissionCard {
  id: string;
  /** Big white line at y 24: 'MISSION 1' (m5: 'FINAL MISSION'). */
  label: string;
  /** Big gold line at y 40: the mission name. */
  name: string;
  /** Small line at y 54: place and time ('PUDDLEWICK, LOWMERE - 0900 HOURS'). */
  place: string;
  /** Gusto's briefing, typed in the radio box: at most 2 lines (GDD §2.4). */
  briefing: readonly string[];
  /** The newspaper headline after the mission (GDD §13.11). */
  headline: string;
  /** Announcer line at the mission start (GDD §12.3). */
  announce?: string;
  /** Second line of the gameplay start banner (GDD §13.6: 'START!'). */
  startSub?: string;
  /** The line map behind the card (screen px), its blinking dot and region names ([text, x, y]). */
  map?: {
    readonly lines: readonly MapLine[];
    readonly dot: readonly [number, number];
    readonly labels?: readonly (readonly [string, number, number])[];
  };
}

/**
 * The speaker of every card's `briefing` lines (Brigadier Gusto on the radio): the intro card
 * voices each line with `AudioOut.say(line, BRIEFING_SPEAKER)` when its typing starts (the sample
 * is keyed by the exact line text; no sample = the card stays silent apart from the static).
 */
export const BRIEFING_SPEAKER = 'gusto';

const cards = new Map<string, MissionCard>();

/** Register (or replace) the intro card and headline of a mission. */
export function defineMissionCard(card: MissionCard): MissionCard {
  cards.set(card.id, card);
  return card;
}

export function hasMissionCard(id: string): boolean {
  return cards.has(id);
}

/**
 * The campaign's missions in play order (the Amsterdam prologue `ams` first). Mission numbers on
 * the cards, labels and the high-score column come from the place in this list.
 */
export const CAMPAIGN_MISSIONS: readonly string[] = ['ams', 'm1', 'm2', 'm3', 'm4', 'm5'];

/**
 * The normal route (docs/design/fps.md §1.9, docs/design/ring.md §1, docs/design/oldenzaal.md §1):
 * ams (MISSION 1), the ring road (MISSION 2), the two fps floors (level 3, `MISSION 3`), then the
 * haunted town `oldenzaal` (MISSION 4). ALL GOLDEN RECORDS on this route needs the record of each
 * of them.
 */
export const FPS_ROUTE: readonly string[] = ['ams', 'ring', 'fps-1', 'fps-2', OLDENZAAL_ID];

/**
 * The level number of a 2D mission on the route: its place in FPS_ROUTE with the first-person
 * floors counted as ONE level (MISSION 3), so ams = 1, ring = 2, oldenzaal = 4. 0 when it is not
 * on the route (or is an fps floor).
 */
function routeNumber(id: string): number {
  if (id.startsWith('fps-')) return 0;
  let n = 0;
  let fps = false;
  for (const r of FPS_ROUTE) {
    if (r.startsWith('fps-')) {
      if (fps) continue;
      fps = true;
    }
    n++;
    if (r === id) return n;
  }
  return 0;
}

/**
 * The missions ALL GOLDEN RECORDS needs: FPS_ROUTE once the campaign played the ring or `fps-1`,
 * else CAMPAIGN_MISSIONS.
 */
export function goldenRecordRoute(c: CampaignRecord | null): readonly string[] {
  return c?.missions.includes('ring') || c?.missions.includes('fps-1') ? FPS_ROUTE : CAMPAIGN_MISSIONS;
}

/**
 * The number of a mission: its level on the route (`routeNumber`: ams = 1, ring = 2, the fps
 * floors together 3, oldenzaal = 4), else its place in CAMPAIGN_MISSIONS (the passive m1–m5 keep
 * their old numbers); 0 when it is neither. The fps floors are numbered by the high-score column
 * (F1, F2), not here.
 */
export function missionNumber(id: string): number {
  const r = routeNumber(id);
  if (r > 0) return r;
  return CAMPAIGN_MISSIONS.indexOf(id) + 1;
}

/**
 * 'ams' → 'MISSION 1', 'ring' → 'MISSION 2', 'oldenzaal' → 'MISSION 4' (the route); 'm1' →
 * 'MISSION 2' … 'm4' → 'MISSION 5' (passive, their campaign place); the last campaign mission
 * (m5) → 'FINAL MISSION'; other ids `mN` → 'MISSION N' (m0), else their upper-case name.
 */
export function missionLabel(id: string): string {
  const n = missionNumber(id);
  if (n === CAMPAIGN_MISSIONS.length) return 'FINAL MISSION';
  if (n > 0) return `MISSION ${n}`;
  const m = /^m(\d+)$/.exec(id);
  return m ? `MISSION ${m[1]}` : id.toUpperCase();
}

/** The card of a mission: the registered one, else one made from its MissionDef. */
export function missionCard(id: string): MissionCard {
  const c = cards.get(id);
  if (c) return c;
  const def = getMission(id);
  return {
    id,
    label: missionLabel(id),
    name: def?.name ?? missionLabel(id),
    place: def?.subtitle ?? '',
    briefing: [],
    headline: `${def?.name ?? missionLabel(id)}: MISSION ACCOMPLISHED!`,
  };
}

// ---------------------------------------------------------------------------------------------
// Fixed texts (GDD §1.3, §13.3–§13.14, §2.6)
// ---------------------------------------------------------------------------------------------

/** Title tagline and the attract-mode alternates (300 ticks each; military, docs/design/squad.md §3.2). */
export const TAGLINES: readonly string[] = [
  'THE SWAN HAS LANDED. THE ENEMY HAS NOT.',
  'ONE SWAN. FIVE IDIOTS. ZERO RETREAT.',
  'LOCK. LOAD. HONK.',
  'OPERATION FRIKANDEL IS A GO.',
];

/** HOW TO PLAY card (GDD §13.3, §15.9 item 5): [keys, action]; an empty action = one line. */
export const HOW_TO_PLAY: readonly (readonly [string, string])[] = [
  ['ARROWS / WASD', 'MOVE AND AIM'],
  ['UP + LEFT / RIGHT', 'AIM DIAGONALLY'],
  ['FIRE', 'SHOOT (KNIFE UP CLOSE)'],
  ['JUMP', 'JUMP'],
  ['HOLD JUMP', 'GLIDE (SWAN)'],
  ['DOWN + JUMP', 'DROP DOWN / LEAVE A VEHICLE'],
  ['BOMB', 'THROW A GRENADE'],
  ['FIRE + BOMB', 'VEHICLE SPECIAL'],
  ['FIRE + JUMP', 'RAM!'],
  ['FREE THE CRITICS. STOP THE ANTHEM.', ''],
];

/**
 * The HOW TO PLAY card for a gamepad (docs/design/ams-extras.md §10): the same lines with the
 * pad's own labels (pad-prompt.ts `drawPadLine` tokens `{FIRE}` `{JUMP}` `{BOMB}` `{START}`:
 * PlayStation ✕ ○ □ △ glyphs, Xbox A B X Y, Nintendo B A Y X, generic positions).
 */
export const HOW_TO_PLAY_PAD: readonly (readonly [string, string])[] = [
  ['D-PAD / LEFT STICK', 'MOVE AND AIM'],
  ['↑ + ← / →', 'AIM DIAGONALLY'],
  ['{FIRE}', 'SHOOT (KNIFE UP CLOSE)'],
  ['{JUMP}', 'JUMP'],
  ['HOLD {JUMP}', 'GLIDE (SWAN)'],
  ['↓ + {JUMP}', 'DROP DOWN / LEAVE A VEHICLE'],
  ['{BOMB}', 'THROW A GRENADE'],
  ['{FIRE} + {BOMB}', 'VEHICLE SPECIAL'],
  ['{FIRE} + {JUMP}', 'RAM!'],
  ['{START}', 'PAUSE / PLAYER 2 JOINS'],
];

/** Mode select difficulty row (GDD §13.4; military nicknames, docs/design/squad.md §3.3): the gold subtitle and the hint. */
export const DIFFICULTY_INFO: Readonly<Record<Difficulty, { readonly name: string; readonly nick: string; readonly hint: string }>> = {
  easy: { name: 'EASY', nick: '"RECRUIT"', hint: 'MORE LIVES. SLOWER BULLETS.' },
  normal: { name: 'NORMAL', nick: '"VETERAN"', hint: 'THE REAL WAR.' },
  hard: { name: 'HARD', nick: '"COMMANDO"', hint: 'NO MERCY. NO MEDALS.' },
};

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** THE CRITICS SAY quotes by stars (1–5, GDD §13.11). */
export const CRITIC_QUOTES: readonly string[] = [
  '"LOUD. MESSY. WE LEFT AT THE INTERVAL."',
  '"SOME NICE MOMENTS. MOSTLY EXPLOSIONS."',
  '"A SOLID PERFORMANCE. THE DUCKS LOVED IT."',
  '"GRACEFUL! FURIOUS! WE WEPT A LITTLE."',
  '"FIVE STARS. WE HAVE NOTHING BAD TO SAY, AND IT HURTS."',
];

/**
 * The playable roster in select-screen order: the squad of friends (docs/design/squad.md §1).
 * `recruit` and the retired GDD heroes (grace, mittens, pip, gramps) are not shown.
 */
export const ROSTER: readonly string[] = ['vincent', 'thom', 'dirk', 'bob', 'patrick'];

/**
 * Select-screen texts per character (GDD §3, §13.5), used when the character module does not
 * give `fullName` / `role` / `quote` / `quoteSub` / `endingLine` itself.
 */
export const CHARACTER_TEXTS: Readonly<Record<string, { fullName: string; role: string; quote: string; quoteSub?: string; endingLine: string; callsign: string }>> = {
  vincent: {
    fullName: 'VINCENT',
    role: 'THE CONSULTANT',
    quote: '"I HAVE A PLAN. IT\'S BILLABLE."',
    endingLine: '"ALL AS PER MY BATTLE PLAN. MY INVOICE IS IN THE POST."',
    callsign: 'THE CONSULTANT',
  },
  thom: {
    fullName: 'THOM',
    role: 'LITTLE NAPOLEON',
    quote: '"TWO PISTOLS. TWICE THE HEADSHOTS."',
    endingLine: '"1901 HEADSHOTS. I\'M STILL COUNTING."',
    callsign: 'LITTLE NAPOLEON',
  },
  dirk: {
    fullName: 'DIRK',
    role: 'THE PLUMBER',
    quote: '"I FIX LEAKS. AND ENEMIES."',
    endingLine: '"ALL CLEAR. THE PIPES ARE QUIET AGAIN."',
    callsign: 'THE PLUMBER',
  },
  bob: {
    fullName: 'BOB',
    role: 'CAPTAIN CLIMATE',
    quote: '"SAVE THE PLANET! MY FLIGHT\'S AT SIX."',
    endingLine: '"PLANET SAVED. NOW, IF YOU\'LL EXCUSE ME, I HAVE A FLIGHT."',
    callsign: 'CAPTAIN CLIMATE',
  },
  patrick: {
    fullName: 'PATRICK',
    role: 'THE SUPERNERD',
    quote: '"ASK THE AI. THEN PASS THE FRIKANDEL."',
    endingLine: '"FRIKANDELLEN FOR EVERYONE! THE AI ORDERED THEM."',
    callsign: 'THE SUPERNERD',
  },
  grace: {
    fullName: 'CAPT. GRACE STILLMERE',
    role: 'SQUAD LEADER',
    quote: '"PARDON ME. I\'M HERE TO STOP THE MUSIC."',
    endingLine: '"THANK YOU, EVERYONE. YOU MAY NOW RESUME BEING QUIET."',
    callsign: 'GRACE',
  },
  mittens: {
    fullName: 'SGT. TORVALD "MITTENS" MAGNUSSON',
    role: 'HEAVY WEAPONS. KNITTING.',
    quote: '"..."',
    quoteSub: '(HE NODS. HE HAS KNITTED YOU A SCARF.)',
    endingLine: '(HE GIVES FANFARONI A SCARF. IT SAYS SHHH.)',
    callsign: 'MITTENS',
  },
  pip: {
    fullName: 'PVT. PIP OKAFOR',
    role: 'ROOKIE',
    quote: '"IS THIS THE REAL WAR? THE BROCHURE HAD MORE BALLOONS!"',
    endingLine: '"CAN WE DO THAT AGAIN? FROM THE START?"',
    callsign: 'PIP',
  },
  gramps: {
    fullName: 'W.O. AMBROSE "GRAMPS" FENWICK',
    role: 'ENGINEER. BUILT THE SWAN.',
    quote: '"BACK IN MY DAY, TANKS DIDN\'T HAVE LEGS. THEN I GAVE THEM LEGS."',
    endingLine: '"RIGHT. WHO WANTS TO SEE THE MK4? IT\'S A SUBMARINE. DON\'T TELL ACCOUNTING."',
    callsign: 'GRAMPS',
  },
};

/** Ending captions (GDD §2.6 step 4; big font, centred at y 96, 180 ticks each). */
export const ENDING_CAPTIONS: readonly string[] = [
  'THE ANTHEM WAS NEVER BROADCAST.',
  'THE CRITICS WERE RELEASED, AND WROTE VERY KIND REVIEWS.',
  'GRAND MARSHAL FANFARONI NOW PLAYS THE TRIANGLE.',
  'HE IS STILL NOT VERY GOOD.',
  'TASK FORCE CYGNET RETURNED TO THE NEST.',
  'THE END ... OF THE NOISE.',
];

/** One credits line: headings use the big font (GDD §13.12); credits name team roles, never people. */
export interface CreditLine {
  text: string;
  style: 'title' | 'heading' | 'line';
}

/** The credits roll (GDD §13.12), top to bottom. */
export const CREDITS: readonly CreditLine[] = [
  { text: 'METAL SWAN 3', style: 'title' },
  { text: 'MADE ENTIRELY OUT OF CODE', style: 'line' },
  { text: 'BY THE METAL SWAN 3 TEAM', style: 'line' },
  { text: 'STARRING', style: 'heading' },
  { text: 'VINCENT, THE CONSULTANT', style: 'line' },
  { text: 'THOM, LITTLE NAPOLEON', style: 'line' },
  { text: 'DIRK, THE PLUMBER', style: 'line' },
  { text: 'BOB, CAPTAIN CLIMATE', style: 'line' },
  { text: 'PATRICK, THE SUPERNERD', style: 'line' },
  { text: 'AND THE SWAN-3', style: 'line' },
  { text: 'WITH', style: 'heading' },
  { text: 'BRIGADIER LIONEL GUSTO', style: 'line' },
  { text: 'MRS. DOLLOP AS HERSELF', style: 'line' },
  { text: 'INTRODUCING', style: 'heading' },
  { text: 'HIS LOUDNESS, GRAND MARSHAL BOMBASTIAN FANFARONI', style: 'line' },
  { text: 'COMMODORE BLARE', style: 'line' },
  { text: 'COLONEL RIMSHOT', style: 'line' },
  { text: 'WING COMMANDER PUFFINGTON', style: 'line' },
  { text: 'COUNTESS PIZZICATA', style: 'line' },
  { text: 'ALL PIXELS GENERATED BY CODE', style: 'heading' },
  { text: 'ALL SOUNDS SYNTHESIZED', style: 'heading' },
  { text: 'NO CRITICS WERE HARMED IN THE MAKING OF THIS GAME', style: 'line' },
  { text: 'THANK YOU FOR PLAYING', style: 'heading' },
  { text: 'THE END ... OF THE NOISE.', style: 'title' },
];

/**
 * HUD callout texts (GDD §13.7, §14.2): content shows them with `hud.callout(CALLOUTS.drumRoll)`
 * (centred, small, y 60, 90 ticks) and adds the points itself.
 */
export const CALLOUTS = {
  checkpoint: 'CHECKPOINT',
  caughtNapping: 'CAUGHT NAPPING +100',
  quietPlease: 'QUIET PLEASE +800',
  strike: 'STRIKE! +1000',
  fullSet: 'FULL SET! +1000',
  vandalism: 'VANDALISM +500',
  setPiece: 'SET PIECE! +200',
  stylePoints: 'STYLE POINTS 9.5! +2000',
  drumRoll: 'DRUM ROLL! +1000',
  noScratches: 'NO SCRATCHES! +10000',
  oneMoreTry: 'ONE MORE TRY!',
} as const;

/** Pointer hints over a target (`hud.pointer(target, HINTS.stomp)`; GDD §11.1, §15.9 item 5). */
export const HINTS = {
  stomp: 'STOMP!',
  shoot: 'SHOOT!',
  ride: 'RIDE?',
} as const;

/** Announcer lines of the flow screens (GDD §12.3). */
export const VOICE = {
  missionComplete: 'MISSION COMPLETE! BRAVO!',
  ovation: 'STANDING OVATION!',
  continue: 'CONTINUE?',
  gameOver: 'GAME OVER... UITGEZWAAND!',
  highScore: "NEW HIGH SCORE! YOU'RE GREAT!",
} as const;

/** The 7-digit high score rank labels. */
export function rankLabel(i: number): string {
  const n = i + 1;
  const suffix = n % 10 === 1 && n !== 11 ? 'ST' : n % 10 === 2 && n !== 12 ? 'ND' : n % 10 === 3 && n !== 13 ? 'RD' : 'TH';
  return `${n}${suffix}`;
}
