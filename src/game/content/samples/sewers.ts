/**
 * Mission sewers' sample group 'mission:sewers' (docs/design/sewers.md §7; docs/api/audio-pipeline.md)
 * and the text of every voiced line of the mission. Owner: P0 (the plumbing and the texts); the
 * takes come after the user's OK on the credits (the lead's audio wave).
 *
 * The group: the ams group's sound effects and voices WITHOUT its songs (the returning delivery
 * rider and fatbike youth takes play in sewers; the ams songs would decode to about 60 MB), merged
 * with sewers' own takes from the manifest (`SAMPLE_MANIFEST['mission:sewers']`, written by the
 * audio tool once something of it is picked). Sewers' entries win on a shared id. Its long songs are
 * STREAMED like the rally's (`SampleSong.stream`). The entries are the manifest's own objects, so the
 * sample bank decodes a shared file once for both groups. (The pattern of the former level 2:
 * `git show eb3316a:src/game/content/samples/oat.ts`.)
 *
 * Registered at import (content manifest id 'samples/sewers', lazy with the sewers chunk:
 * content/index.ts `isSewersContent`), so the MISSION 2 card's `preloadMissionAudio` and a direct
 * `?mission=sewers` boot find it. Until the takes ship, the group is the ams sfx and voices alone and
 * the synth plays every sewers id (content/sfx/sewers.ts, content/music/sewers.ts).
 *
 * The lines (`SEWERS_VOICE`, `sewersVoiceLines()`): the bubble texts verbatim (spec §7: ≤ 24
 * characters × 2 lines, no diacritics), by speaker. The runner voices a bubble by its text
 * (`voiceKey`), so the builders take their lines from here, never inline text. A voiced bubble lives
 * `sewersSayTicks(text)` ticks (the longest take plus a pause). Gusto's two card lines and the
 * announce are not here: they live with the card (missions/sewers/card.ts) and sit in group 'boot'.
 * The Rattenjong and the rats make creature sounds, no words.
 */
import type { SampleGroup, SampleSong } from '../../../engine/samples';
import { defineSampleGroup } from '../../../engine/samples';
import { SAMPLE_MANIFEST } from './manifest';
import { STREAM_MIN_SECONDS } from './rally';

export const SEWERS_SAMPLE_GROUP = 'mission:sewers';
const AMS_SAMPLE_GROUP = 'mission:ams';

/** The merged 'mission:sewers' group (ams sfx + voices, sewers' own takes; its long songs streamed). */
export function sewersSampleGroup(manifest: Readonly<Record<string, SampleGroup>>): SampleGroup {
  const ams = manifest[AMS_SAMPLE_GROUP];
  const own = manifest[SEWERS_SAMPLE_GROUP];
  const g: SampleGroup = {
    sfx: { ...ams?.sfx, ...own?.sfx },
    voice: { ...ams?.voice, ...own?.voice },
  };
  if (own?.music) {
    const music: Record<string, SampleSong> = {};
    for (const [id, s] of Object.entries(own.music)) music[id] = s.duration >= STREAM_MIN_SECONDS ? { ...s, stream: true } : s;
    g.music = music;
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// The voiced lines (spec §7): plain standard Dutch, designed voices
// ---------------------------------------------------------------------------------------------

/** Every voiced bubble of the mission by speaker and beat (keys are for the builders; texts verbatim). */
export const SEWERS_VOICE = {
  /** The dealer (P1a STREET): a whisper. */
  dealer: {
    psst: 'PSST. VRIEND.',
    offer: 'WIL JE IETS?',
  },
  /** The pimp (P1a STREET). */
  pimp: {
    street: 'HE! MIJN STRAAT!',
    boys: 'JONGENS!',
  },
  /** GOUDEN GERRIT, the mini-boss of sewers-a (wave A). */
  gerrit: {
    gold: 'GOUD IS GOUD!',
    limo: 'MIJN LIMO!!',
    notOver: 'DIT IS NIET VOORBIJ!',
  },
  /** The freed tourists (a, b). */
  tourist: {
    thanks: 'DANK JE, MAN!',
  },
  /** The sewer workers (c: wave C; d: wave D). */
  worker: {
    light: 'EINDELIJK LICHT!',
    battery: 'HIER, EEN BATTERIJ!',
    plugs: 'PAK DIE PROPPEN AAN!',
    fire: 'MET VUUR!',
  },
  /**
   * The squad at dawn (sewers-end, spec §2.6, §0 row 56): TEXT ONLY, never voiced (the five heroes
   * are real friends, never imitated). `getIn`: the hero at the wheel of the white wagon (a hero
   * nobody plays); `smell`: the living P1 hero.
   */
  hero: {
    getIn: 'STAP IN, ZWAAN!',
    smell: 'IK RUIK NAAR RIOOL.',
  },
} as const;

/** The speaker id of each `SEWERS_VOICE` group. */
const SPEAKER_OF: Readonly<Record<keyof typeof SEWERS_VOICE, string>> = {
  dealer: 'sewers-dealer',
  pimp: 'sewers-pimp',
  gerrit: 'gerrit',
  // The banana tourist is a young man on a stag night: his own designed voice (the ams `tourist` is a woman).
  tourist: 'stag-tourist',
  worker: 'sewer-worker',
  hero: 'hero',
};

/** Seconds of quiet after a take before its bubble goes (the voice is never cut off). */
export const SEWERS_SAY_PAUSE = 12;

/**
 * The longest a take of `text` may be, in seconds (the audio spec's `maxSeconds`): plain Dutch at a
 * brisk pace, 0.08 s a letter or digit plus 0.6 s, 0.3 s more for every '...' pause; 1.2 to 4 s.
 */
export function sewersLineSeconds(text: string): number {
  const letters = text.replace(/[^A-Z0-9]/g, '').length;
  let s = 0.6 + letters * 0.08;
  s += (text.match(/\.\.\./g)?.length ?? 0) * 0.3;
  return Math.round(Math.min(4, Math.max(1.2, s)) * 10) / 10;
}

/**
 * The bubble life of a voiced line in ticks (`ctx.bubble(who, text, { ticks: sewersSayTicks(text),
 * speaker })`): its longest take plus the pause, at least the default 120.
 */
export function sewersSayTicks(text: string): number {
  return Math.max(120, Math.ceil(sewersLineSeconds(text) * 60) + SEWERS_SAY_PAUSE);
}

/** A voiced line: its speaker and the bubble text, verbatim. */
export interface SewersVoiceLine {
  readonly speaker: string;
  readonly text: string;
}

/** Every voiced line of the mission (the audio spec's source; each text once). */
export function sewersVoiceLines(): SewersVoiceLine[] {
  const out: SewersVoiceLine[] = [];
  for (const [group, lines] of Object.entries(SEWERS_VOICE) as [keyof typeof SEWERS_VOICE, Record<string, string>][]) {
    for (const text of Object.values(lines)) out.push({ speaker: SPEAKER_OF[group], text });
  }
  return out;
}

defineSampleGroup(SEWERS_SAMPLE_GROUP, sewersSampleGroup(SAMPLE_MANIFEST));
