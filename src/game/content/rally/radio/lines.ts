/**
 * FILE FM — the car radio of mission rally, BINNEN DE RING (docs/design/rally.md §8, §11, §12.6;
 * docs/api/rally.md "C. Wave C contracts"). The lines table, the songs and the jingles. Pure data
 * (no engine or game imports beyond the voice key), headless-safe; wave C's PREP wrote it.
 *
 * - FILE FM, "WIJ STAAN ER ALTIJD" (we are always there / we always stand still), and its DJ
 *   FREEK FLITS: cheerful, fast, a bit too much; standard Dutch. Our own station and DJ; his voice
 *   is DESIGNED (never a clone, never an imitation of a real presenter).
 * - Every line's `text` is the exact game text: the HUD ticker shows it while the take plays, and
 *   `voiceKey(text)` (engine/samples.ts) is the key of its take in the group 'mission:rally'. The
 *   audio spec's LineSpecs (tools/audio/spec.ts, AUDIO-GEN) use these texts verbatim.
 * - The DJ teases the situation (traffic, fines, the waiting list), never a player's skill; he names
 *   the estates by their liveries (DE ROZZERS, MAJOR COCKTAILS), never a car's brand. The heroes say
 *   nothing in the car; Brigadier Gusto voices only the MISSION 3 card (`RALLY_CARD_LINES`, group 'boot').
 * - `priority` (0 … 10, higher first in the queue), `cooldown` (ticks at 60 Hz before the same line
 *   may play again; `RADIO_ONCE` = once per race) and the category's `gap` / `maxWait`
 *   (`RADIO_CATEGORIES`) are for the radio scheduler (src/engine/radio.ts, RADIO) and the director
 *   (src/game/rally/radio.ts). `on` names the trigger (a runner event of RallyEventsB, or a radio
 *   moment); the selectors `lap` / `clock` / `car` / `tunnel` / `result` pick the line.
 */
import { voiceKey } from '../../../../engine/samples';

/** The station, its slogan and its DJ (spec §8; the DJ's name is the lead's choice). */
export const RADIO_STATION = 'FILE FM';
export const RADIO_SLOGAN = 'WIJ STAAN ER ALTIJD';
export const DJ_NAME = 'FREEK FLITS';
/** The DJ's speaker id in the audio spec (a designed Dutch `VoiceSpec` with `radio: true`). */
export const DJ_SPEAKER = 'freek';
/** The sample group of FILE FM (content/samples/rally.ts). */
export const RADIO_GROUP = 'mission:rally';

/** A cooldown that means: once per race. */
export const RADIO_ONCE = -1;

export type RadioCategory =
  | 'station'
  | 'intro'
  | 'start'
  | 'lap'
  | 'time'
  | 'flash'
  | 'zone'
  | 'redx'
  | 'roadworks'
  | 'spitsstrook'
  | 'jam'
  | 'police'
  | 'pulledOver'
  | 'released'
  | 'tunnel'
  | 'leader'
  | 'finish'
  | 'filler';

/** How a category queues (the scheduler's defaults; every line carries its own priority and cooldown). */
export interface RadioCategoryDef {
  /** 0 … 10: higher plays first; 10 is timed (the start) and is dropped when late. */
  readonly priority: number;
  /** Ticks before the same line may play again (`RADIO_ONCE` = once per race). */
  readonly cooldown: number;
  /** Ticks after any line of this category before the next one of it. */
  readonly gap: number;
  /** Ticks a line of this category may wait in the queue before it is stale (dropped). */
  readonly maxWait: number;
}

/** Seconds → ticks (60 Hz). */
const s = (sec: number): number => Math.round(sec * 60);

export const RADIO_CATEGORIES: Readonly<Record<RadioCategory, RadioCategoryDef>> = {
  station: { priority: 1, cooldown: s(90), gap: s(45), maxWait: s(20) },
  intro: { priority: 8, cooldown: RADIO_ONCE, gap: 0, maxWait: s(15) },
  start: { priority: 10, cooldown: RADIO_ONCE, gap: 0, maxWait: s(1) },
  lap: { priority: 7, cooldown: RADIO_ONCE, gap: s(6), maxWait: s(8) },
  time: { priority: 4, cooldown: RADIO_ONCE, gap: s(30), maxWait: s(20) },
  flash: { priority: 6, cooldown: s(40), gap: s(15), maxWait: s(4) },
  zone: { priority: 6, cooldown: s(60), gap: s(60), maxWait: s(6) },
  redx: { priority: 6, cooldown: s(30), gap: s(15), maxWait: s(4) },
  roadworks: { priority: 6, cooldown: s(45), gap: s(30), maxWait: s(8) },
  spitsstrook: { priority: 6, cooldown: RADIO_ONCE, gap: 0, maxWait: s(10) },
  jam: { priority: 5, cooldown: s(60), gap: s(30), maxWait: s(8) },
  police: { priority: 7, cooldown: s(60), gap: s(30), maxWait: s(8) },
  pulledOver: { priority: 7, cooldown: s(30), gap: s(20), maxWait: s(4) },
  released: { priority: 5, cooldown: s(30), gap: s(20), maxWait: s(4) },
  tunnel: { priority: 9, cooldown: s(30), gap: s(10), maxWait: s(1) },
  leader: { priority: 5, cooldown: s(45), gap: s(20), maxWait: s(4) },
  finish: { priority: 9, cooldown: RADIO_ONCE, gap: 0, maxWait: s(10) },
  filler: { priority: 1, cooldown: s(120), gap: s(45), maxWait: s(20) },
};

/** How the race ended for the finish lines: any racer crossed the line; a player won; no player won. */
export type RadioResult = 'any' | 'win' | 'lose';

/** One DJ line (or Gusto's card line). */
export interface RadioLine {
  /** Stable id: `rally/dj/<category>/<n>`; a leader line is `rally/dj/team/<car id>` (the team spec's `dj`). */
  readonly id: string;
  readonly category: RadioCategory;
  /** The exact game text (the ticker shows it; `voiceKey(text)` keys the take). */
  readonly text: string;
  /** The speaker id of the audio spec (`DJ_SPEAKER`). */
  readonly speaker: string;
  readonly priority: number;
  /** Ticks before this line may play again (`RADIO_ONCE` = once per race). */
  readonly cooldown: number;
  /** The trigger: a runner event ('flash:camera', 'tunnelIn', …) or a radio moment ('race:intro', 'radio:between', …). */
  readonly on: string;
  /** Lap lines: the lap that starts (2 or 3). */
  readonly lap?: number;
  /** Time lines: the HUD clock in minutes after midnight (daylight.ts: 975 = 16:15 … 1110 = 18:30). */
  readonly clock?: number;
  /** Leader lines: the car id that took the lead ('white', 'green' or a team id). */
  readonly car?: string;
  /** Tunnel lines: the tunnel's name of the track table ('COENTUNNEL', 'ZEEBURGERTUNNEL'). */
  readonly tunnel?: string;
  /** Finish lines. */
  readonly result?: RadioResult;
}

type Extra = Partial<Pick<RadioLine, 'lap' | 'clock' | 'car' | 'tunnel' | 'result' | 'priority' | 'cooldown'>>;

/** A DJ line with its category's priority and cooldown (the extra fields may override them). */
function dj(category: RadioCategory, n: number, text: string, on: string, extra: Extra = {}): RadioLine {
  const c = RADIO_CATEGORIES[category];
  return { id: `rally/dj/${category}/${n}`, category, text, speaker: DJ_SPEAKER, priority: c.priority, cooldown: c.cooldown, on, ...extra };
}

/** A leader line: id `rally/dj/team/<car>` (the rival team specs carry it as `dj`). */
function leader(car: string, text: string): RadioLine {
  const c = RADIO_CATEGORIES.leader;
  return { id: `rally/dj/team/${car}`, category: 'leader', text, speaker: DJ_SPEAKER, priority: c.priority, cooldown: c.cooldown, on: 'place:1', car };
}

/** The car ids of the leader lines: the two estates and the seven rally teams (content/rally/teams). */
export const LEADER_CARS = ['laatste-rit', 'huisje', 'frietbak', 'vrijgezellen', 'ijscoman', 'achteruit', 'oma-truus', 'white', 'green'] as const;

/** Every DJ line (spec §8; the lead's table of wave C, verbatim). */
export const RADIO_LINES: readonly RadioLine[] = [
  // Station ids: between songs, after a jingle.
  dj('station', 1, 'FILE FM. Wij staan er altijd!', 'radio:between'),
  dj('station', 2, 'Je luistert naar FILE FM, met Freek Flits!', 'radio:between'),
  dj('station', 3, 'FILE FM. De zender die nooit doorrijdt.', 'radio:between'),
  // The race intro (the fly-over) and the grid, in this order.
  dj('intro', 1, 'Goedemiddag Amsterdam! Vandaag op de A10: de Ringrally!', 'race:intro'),
  dj('intro', 2, "Acht auto's, drie rondjes, en één parkeervergunning binnen de ring!", 'race:intro'),
  dj('intro', 3, 'De wachtlijst is twaalf jaar. Of je wint vandaag.', 'race:grid'),
  // The start: timed to the gantry's countdown (the game's countdown stays the master).
  dj('start', 1, 'Drie... twee... één... GAAN!', 'race:countdown'),
  // Laps.
  dj('lap', 1, 'Ronde twee! De zon zakt boven de Ring.', 'lap', { lap: 2 }),
  dj('lap', 2, 'Laatste ronde! En het is spits, mensen!', 'lap', { lap: 3 }),
  dj('lap', 3, 'Nog één rondje voor die vergunning!', 'lap', { lap: 3 }),
  // The time (the HUD clock passes it).
  dj('time', 1, 'Het is kwart over vier. Droog, en de zon staat laag.', 'clock', { clock: 16 * 60 + 15 }),
  dj('time', 2, 'Vijf uur. Lichten aan, mensen!', 'clock', { clock: 17 * 60 }),
  dj('time', 3, 'Kwart voor zes, en het is al donker op de Ring.', 'clock', { clock: 17 * 60 + 45 }),
  // Traffic news from the race state.
  dj('flash', 1, 'Flits! Dat wordt een envelop op de mat.', 'flash:camera'),
  dj('flash', 2, 'Weer een flitser. De schatkist bedankt u!', 'flash:camera'),
  dj('flash', 3, 'Voet van het gas bij de flitspaal, mensen!', 'flash:camera'),
  dj('zone', 1, 'Trajectcontrole op Ring West. Gemiddeld te hard is ook te hard!', 'flash:zone'),
  dj('redx', 1, 'Onder het rode kruis door? Dat kost je!', 'redx'),
  dj('redx', 2, 'Rood kruis is rood kruis!', 'redx'),
  dj('roadworks', 1, 'Werk in uitvoering op de Ring. Ritsen, mensen, ritsen!', 'roadworksAhead'),
  dj('roadworks', 2, 'Rijstroken dicht. Geduld open!', 'roadworksAhead'),
  dj('spitsstrook', 1, 'De spitsstrook is open! Pak die extra baan!', 'spitsstrookOpen'),
  dj('jam', 1, 'File op de Ring. Wat een verrassing!', 'jam'),
  dj('jam', 2, 'Het staat vast. Gelukkig heb je de radio.', 'jam'),
  dj('police', 1, 'De politie is op de Ring. Gedraag je!', 'policeActive'),
  dj('police', 2, 'Blauwe lampen in de spiegel? Die zijn voor jou!', 'police:chase'),
  dj('pulledOver', 1, 'Daar wordt er eentje aan de kant gezet!', 'pulledOver'),
  dj('pulledOver', 2, 'Rijbewijs en kentekenbewijs, alstublieft!', 'pulledOver'),
  dj('released', 1, 'En hij mag weer verder. Met een boete, natuurlijk.', 'released'),
  // The tunnels: the take ends cut off; the radio then drops to static (setRadio) until the exit.
  dj('tunnel', 1, 'De Coentunnel in. Even geen ontva...', 'tunnelIn', { tunnel: 'COENTUNNEL' }),
  dj('tunnel', 2, 'Zeeburgertunnel! Ksst... even geen bereik...', 'tunnelIn', { tunnel: 'ZEEBURGERTUNNEL' }),
  // A new leader (one line per car; never the car's brand).
  leader('laatste-rit', 'De lijkwagen gaat aan kop! Die heeft haast.'),
  leader('huisje', 'Huisje op Wielen voorop! Dat had niemand verwacht.'),
  leader('frietbak', 'De Frietbak aan kop! Met mayo!'),
  leader('vrijgezellen', 'Vrijgezellen voorop! Feest op de Ring!'),
  leader('ijscoman', 'De IJscoman rijdt voorop! Wie wil er een ijsje?'),
  leader('achteruit', 'Achteruit aan kop... en hij rijdt nog vooruit ook!'),
  leader('oma-truus', 'Oma Truus aan kop! Niemand houdt Oma Truus tegen!'),
  leader('white', 'De Rozzers nemen de leiding!'),
  leader('green', 'Major Cocktails pakt de kop!'),
  // The finish.
  dj('finish', 1, 'Finish! Wat een race op de Ring!', 'finish', { result: 'any' }),
  dj('finish', 2, 'We hebben een winnaar! Die vergunning is binnen!', 'finish', { result: 'win' }),
  dj('finish', 3, 'Geen vergunning vandaag. Terug op de wachtlijst!', 'finish', { result: 'lose' }),
  // Fillers between songs.
  dj('filler', 1, 'Dit was het verkeer. Het staat overal stil. Behalve hier!', 'radio:between'),
  dj('filler', 2, 'Muziek! Want stilstaan doe je maar in de file.', 'radio:between'),
  dj('filler', 3, 'Een parkeervergunning binnen de ring. Wie droomt daar niet van?', 'radio:between'),
];

/** The lines of a category, in table order. */
export function radioLines(category: RadioCategory): RadioLine[] {
  return RADIO_LINES.filter((l) => l.category === category);
}

/** A line by id, or undefined. */
export function radioLine(id: string): RadioLine | undefined {
  return RADIO_LINES.find((l) => l.id === id);
}

/** The leader line of a car id ('white', 'green', a team id), or undefined. */
export function leaderLine(car: string): RadioLine | undefined {
  return RADIO_LINES.find((l) => l.category === 'leader' && l.car === car);
}

/** The voice key of a line's take (engine/samples.ts `voiceKey`). */
export function radioKey(line: Pick<RadioLine, 'text'>): string {
  return voiceKey(line.text);
}

/**
 * The ticker's text of a line: the game's small font has no accented letters ('één' would show
 * '?'), so the accents fold ('een'). The line's `text` (and its voice key) stays exact.
 */
export function tickerText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ---------------------------------------------------------------------------------------------
// Gusto on the MISSION 3 card (English; group 'boot', like the ring's card lines)
// ---------------------------------------------------------------------------------------------

/**
 * Gusto's two briefing lines: the rally card's `briefing` (content/ui/cards.ts uses this list).
 * Level 3 since the oat wave (docs/design/oat.md (deleted; git show eb3316a) §0 #61): the first line follows the taxi ride
 * (`TAXI PAID.`; a new take in wave C, until then the card types it silently).
 */
export const RALLY_CARD_LINES: readonly string[] = [
  'TAXI PAID. NOW THE SQUAD RACES DE RINGRALLY: THREE LAPS OF THE A10.',
  'FIRST PRIZE: A PARKING PERMIT BINNEN DE RING. THE WAITING LIST IS 12 YEARS!',
];
/** Gusto's speaker id (the existing designed voice). */
export const GUSTO_SPEAKER = 'gusto';
/** The announcer's line of the MISSION 3 start (speaker 'announcer', group 'boot'; a new take in wave C). */
export const RALLY_ANNOUNCE = 'MISSION THREE. VOL GAS!';

// ---------------------------------------------------------------------------------------------
// The songs and the jingles (synth fallbacks: content/music/rally.ts; takes: AUDIO-GEN)
// ---------------------------------------------------------------------------------------------

/** One FILE FM song: one per lap, instrumental, about 2:30, a clean loop (spec §8). */
export interface RadioSong {
  readonly id: string;
  /** Its title on the ticker. */
  readonly title: string;
  /** The lap it belongs to. */
  readonly lap: 1 | 2 | 3;
  readonly bpm: number;
  /** The nominal length (seconds): the scheduler's clock when the output has none (`songState` null). */
  readonly seconds: number;
  /** The genre (the generation prompt's core; never an artist, a song, a station, a band, a film, a person or a game). */
  readonly style: string;
}

export const RADIO_SONGS: readonly RadioSong[] = [
  { id: 'rally-lap1', title: 'RONDJE RING', lap: 1, bpm: 140, seconds: 150, style: 'an upbeat late-1990s Dutch dance-pop drive with bright synth stabs' },
  { id: 'rally-lap2', title: 'ZON OP DE ZUIDAS', lap: 2, bpm: 138, seconds: 150, style: 'euphoric sunset trance-pop with warm pads' },
  { id: 'rally-lap3', title: 'NACHTSPITS', lap: 3, bpm: 128, seconds: 150, style: 'a dark night-drive synth groove with a pulsing bass' },
];

/** One station jingle (3–6 s, played once). */
export interface RadioJingle {
  readonly id: string;
  readonly title: string;
  readonly seconds: number;
  readonly style: string;
}

export const RADIO_JINGLES: readonly RadioJingle[] = [
  { id: 'rally-jingle-1', title: 'FILE FM!', seconds: 4, style: "a sung 'FILE FM!' with a brass hit" },
  { id: 'rally-jingle-2', title: 'WIJ STAAN ER ALTIJD', seconds: 5, style: "a short synth sweep with 'Wij staan er altijd'" },
  { id: 'rally-jingle-3', title: 'FILE FM', seconds: 3, style: 'an instrumental sting' },
];

/** The song of a lap (1 … 3). */
export function lapSong(lap: number): RadioSong {
  return RADIO_SONGS[Math.max(0, Math.min(RADIO_SONGS.length - 1, Math.floor(lap) - 1))];
}
