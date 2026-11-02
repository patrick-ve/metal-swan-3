/**
 * Mission oat's sample group 'mission:oat' (docs/design/oat.md §9.2, §9.3; docs/api/oat.md "Audio")
 * and the text of every voiced line of the mission. Owner: AUDIO (wave A: the plumbing and the
 * texts; the takes come in wave C, after the user's OK on the credits).
 *
 * The group: the ams group's sound effects and voices WITHOUT its songs (the reused handhaver,
 * delivery-rider and fatbike-youth takes play in oat; the ams songs would decode to about 60 MB),
 * merged with oat's own takes from the manifest (`SAMPLE_MANIFEST['mission:oat']`, written by the
 * audio tool once something of it is picked). Oat's entries win on a shared id. Oat's songs (1–2
 * min each) are STREAMED like the rally's (`SampleSong.stream`): decoded, the five would hold about
 * 140 MB. The entries are the manifest's own objects, so the sample bank decodes a shared file once
 * for both groups.
 *
 * Registered at import (content manifest id 'samples/oat', lazy with the oat chunk: content/index.ts
 * `isOatContent`), so the MISSION 2 card's `preloadMissionAudio` and a direct `?mission=oat` boot
 * find it. Until the takes ship, the group is the ams sfx and voices alone and the synth plays
 * every oat id (content/sfx/oat*.ts, content/music/oat.ts).
 *
 * The lines (`OAT_VOICE`, `OAT_QUEUE_CALLS`, `oatVoiceLines()`): the bubble texts verbatim (≤ 24
 * characters × 2 lines, '\n' breaks, no diacritics; `€` is one glyph and is spoken "euro"), by
 * speaker (ids.ts `OAT_SPEAKER`). The runner voices a bubble by its text (`voiceKey`), so the
 * builders of waves B and C take their lines from here, never inline text; INTEGRATE moves them
 * into missions/oat/lines.ts `voicedLines()` (that file is CORE's). tools/audio/spec.ts makes one
 * take request per line (`oatLines`: its `say` from `OAT_SAY`, its `maxSeconds` from
 * `oatLineSeconds`). A voiced bubble lives `oatSayTicks(text)` ticks (the longest take plus a pause:
 * tests/content/oat-voice-fit.test.ts). Gusto's two card lines and oat's announce are not here: they
 * live with the card (missions/oat/card.ts, index.ts) and sit in group 'boot'.
 */
import type { SampleGroup, SampleSong } from '../../../engine/samples';
import { defineSampleGroup } from '../../../engine/samples';
import { SAMPLE_MANIFEST } from './manifest';
import { STREAM_MIN_SECONDS } from './rally';

export const OAT_SAMPLE_GROUP = 'mission:oat';
const AMS_SAMPLE_GROUP = 'mission:ams';

/** The merged 'mission:oat' group (ams sfx + voices, oat's own takes; oat's long songs streamed). */
export function oatSampleGroup(manifest: Readonly<Record<string, SampleGroup>>): SampleGroup {
  const ams = manifest[AMS_SAMPLE_GROUP];
  const oat = manifest[OAT_SAMPLE_GROUP];
  const g: SampleGroup = {
    sfx: { ...ams?.sfx, ...oat?.sfx },
    voice: { ...ams?.voice, ...oat?.voice },
  };
  if (oat?.music) {
    const music: Record<string, SampleSong> = {};
    for (const [id, s] of Object.entries(oat.music)) music[id] = s.duration >= STREAM_MIN_SECONDS ? { ...s, stream: true } : s;
    g.music = music;
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// The voiced lines (spec §9.2): Dutch, plain standard Dutch, designed voices
// ---------------------------------------------------------------------------------------------

/** Every voiced bubble of the mission by speaker and beat (keys are for the builders; texts verbatim). */
export const OAT_VOICE = {
  /** DE HAVERBAR's barista (a, the c kiosk; PIECES). */
  barista: {
    welcome: 'GOEDEMORGEN! HAVER\nOF HAVER?',
    paid: 'BETAALD! FIJNE DAG!',
    inflation: 'INFLATIE, SORRY!',
    refused: 'GEWEIGERD. HEEFT U\nEEN ANDERE PAS?',
  },
  /** De Makelaar, the mini-boss of oat-a (MAKELAAR). */
  makelaar: {
    welcome: 'WELKOM BIJ DE\nBEZICHTIGING!',
    price: 'VRAAGPRIJS? DAT IS\nMAAR EEN BEGIN.',
    outbid: 'OVERBIEDEN!',
    plusTen: '+10%!',
    viewing: 'DE BEZICHTIGING IS\nGEOPEND!',
    sold: 'VERKOCHT, O.V.!',
    fall: 'ONDER VOORBEHOUD\nVAN FINANCIERING...',
  },
  /** The brommobiel influencer (CAST-DAY). */
  influencer: {
    live: 'LIVE!',
    hello: 'HOI LIEVE VOLGERS!',
    hyped: 'DIT IS ZO HYPED!',
    code: 'GEBRUIK MIJN CODE!',
    wait: 'WACHT NOU!',
    content: 'MIJN CONTENT!',
  },
  /** The bakfiets-ouder (CAST-DAY). */
  bakfiets: {
    aside: 'AAN DE KANT!',
    kids: 'ER ZITTEN KINDEREN\nIN, HOOR!',
    paint: 'LAKSCHADE!',
    creche: 'IK BEL DE CRECHE!',
  },
  /** The bakery staff of FORT NEGEN & ZESTIG (QUEUE-B); the number calls are `OAT_QUEUE_CALLS`. */
  rijStaf: {
    yourTurn: 'NUMMER 47! KOMT U\nMAAR.',
    soldOut: 'SORRY, UITVERKOCHT!\nMORGEN WEER!',
  },
  /** The people in DE RIJ (QUEUE-B). */
  rij: {
    back: 'HE! ACHTERAAN\nAANSLUITEN!',
    since: 'IK STA HIER AL\nSINDS ZES UUR.',
    three: 'NOG MAAR DRIE\nBRIOCHES!',
  },
  /** The aggressive taxi's driver, and the driver of the taxi ride (CAST-DAY, TAXIRIT). */
  taxi: {
    short: 'TE KORT!',
    meter: 'DE METER LOOPT, HOOR!',
    board: 'INSTAPPEN! DE METER\nLOOPT AL!',
    red: 'ROOD? DAT IS MEER\nEEN ADVIES.',
    night: 'NACHTTARIEF, HE.',
    fare: '€87,50. CONTANT,\nALSJEBLIEFT.',
  },
  /**
   * The Wallen dealer (CAST-NIGHT): a whisper; his "pills" are mints. `thanks` is not the spec's bare
   * `DANKJEWEL!`: that text is an ams line with a shipped take (staff1), and a take is found by its
   * text alone, so the dealer would speak in the shop girl's voice.
   */
  dealer: {
    offer: 'COKE? XTC?',
    psst: 'PSST. VRIEND.',
    thanks: 'DANKJEWEL, VRIEND!',
    back: 'OKE, OKE, TERUG!',
  },
  /** The guide of the tour group on the bridge (CAST-NIGHT). */
  gids: {
    bridge: 'EN HIER ZIET U\nDE OUDSTE BRUG...',
    photos: 'NIET FOTOGRAFEREN\nBIJ DE RAMEN!',
    view: 'MAAR... HET\nUITZICHT!',
  },
  /** The reused handhaver's new lines (its designed voice; CAST-NIGHT, NIGHT). */
  handhaver: {
    bridge: 'STILSTAAN OP DE BRUG?\n€190 BOETE.',
    blowverbod: 'BLOWVERBOD. BOETE!',
  },
  /** De Huisjesmelker, the boss of oat-d (HUISJESMELKER). */
  huisjesmelker: {
    rent: 'DE HUUR, GRAAG.',
    rise: 'HUURVERHOGING!',
    rise1: '€1.900. EXCLUSIEF.',
    rise2: '€2.400. PLUS\nSERVICEKOSTEN.',
    rise3: '€3.100. DAT IS\nDE MARKT, HE.',
    keys: 'WIE MOET ER\nEEN SLEUTEL?',
    mould: 'DAT IS GEEN SCHIMMEL,\nDAT IS KARAKTER!',
    air: 'VENTILEREN, HE!',
    fall: 'MIJN... MIJN\nBELEGGING...',
  },
  /** The freed tenant at the end of the fight (HUISJESMELKER). */
  huurder: {
    studio: '€1.900 PER MAAND\nEN GEEN KEUKEN!',
  },
} as const;

/**
 * The bakery staff's number calls (spec §6.7: every 300 ticks the next number, `NUMMER 39!` up to
 * 60; one short take each). 47 is the player's own: `OAT_VOICE.rijStaf.yourTurn`.
 */
export const OAT_QUEUE_CALLS: Readonly<Record<number, string>> = {
  39: 'NUMMER 39!',
  40: 'NUMMER 40!',
  41: 'NUMMER 41!',
  42: 'NUMMER 42!',
  43: 'NUMMER 43!',
  44: 'NUMMER 44!',
  45: 'NUMMER 45!',
  46: 'NUMMER 46!',
  47: OAT_VOICE.rijStaf.yourTurn,
  48: 'NUMMER 48!',
  49: 'NUMMER 49!',
  50: 'NUMMER 50!',
  51: 'NUMMER 51!',
  52: 'NUMMER 52!',
  53: 'NUMMER 53!',
  54: 'NUMMER 54!',
  55: 'NUMMER 55!',
  56: 'NUMMER 56!',
  57: 'NUMMER 57!',
  58: 'NUMMER 58!',
  59: 'NUMMER 59!',
  60: 'NUMMER 60!',
};

/** The first and the last number the staff call (spec §6.7: `NU: 38` at the start). */
export const OAT_QUEUE_FIRST = 39;
export const OAT_QUEUE_LAST = 60;

/** The call for number `n` (39–60), or null outside the voiced range. */
export function queueCall(n: number): string | null {
  return OAT_QUEUE_CALLS[n] ?? null;
}

/** The speaker id of each `OAT_VOICE` group (ids.ts `OAT_SPEAKER`). */
const SPEAKER_OF: Readonly<Record<keyof typeof OAT_VOICE, string>> = {
  barista: 'barista',
  makelaar: 'makelaar',
  influencer: 'influencer',
  bakfiets: 'bakfiets',
  rijStaf: 'rij-staf',
  rij: 'rij',
  taxi: 'taxi',
  dealer: 'dealer',
  gids: 'gids',
  handhaver: 'handhaver',
  huisjesmelker: 'huisjesmelker',
  huurder: 'huurder',
};

/** Seconds of quiet after a take before its bubble goes (the voice is never cut off). */
export const OAT_SAY_PAUSE = 12;

/**
 * The longest a take of `text` may be, in seconds (the audio spec's `maxSeconds`): plain Dutch at a
 * brisk pace, 0.08 s a letter or digit plus 0.6 s, longer for a spoken amount (`€1.900` is said
 * "negentienhonderd euro") or a percentage, and for every '...' pause; between 1.2 and 4 s.
 */
export function oatLineSeconds(text: string): number {
  const letters = text.replace(/[^A-Z0-9]/g, '').length;
  let s = 0.6 + letters * 0.08;
  if (text.includes('€')) s += 1.2;
  if (text.includes('%')) s += 0.6;
  s += (text.match(/\.\.\./g)?.length ?? 0) * 0.3;
  return Math.round(Math.min(4, Math.max(1.2, s)) * 10) / 10;
}

/**
 * The bubble life of a voiced line in ticks (`ctx.bubble(who, text, { ticks: oatSayTicks(text),
 * speaker })`): its longest take plus the pause, at least the default 120. A speaker's next bubble
 * cuts the line that plays (`SpeechLane`), so a scene beat lasts at least this long.
 */
export function oatSayTicks(text: string): number {
  return Math.max(120, Math.ceil(oatLineSeconds(text) * 60) + OAT_SAY_PAUSE);
}

/** A voiced line: its speaker (ids.ts `OAT_SPEAKER`) and the bubble text, verbatim. */
export interface OatVoiceLine {
  readonly speaker: string;
  readonly text: string;
}

/** Every voiced line of the mission (the audio spec's source; each text once). */
export function oatVoiceLines(): OatVoiceLine[] {
  const out: OatVoiceLine[] = [];
  for (const [group, lines] of Object.entries(OAT_VOICE) as [keyof typeof OAT_VOICE, Record<string, string>][]) {
    for (const text of Object.values(lines)) out.push({ speaker: SPEAKER_OF[group], text });
  }
  for (let n = OAT_QUEUE_FIRST; n <= OAT_QUEUE_LAST; n++) {
    const text = OAT_QUEUE_CALLS[n];
    if (text !== OAT_VOICE.rijStaf.yourTurn) out.push({ speaker: SPEAKER_OF.rijStaf, text });
  }
  return out;
}

defineSampleGroup(OAT_SAMPLE_GROUP, oatSampleGroup(SAMPLE_MANIFEST));
