/**
 * Announcer voice through the Web Speech API (speechSynthesis): punchy rate, low pitch, an
 * English voice, and a queue of at most one waiting line (newer lines replace it). Safe when
 * speech is unavailable: say() then returns false so the caller can play a jingle instead.
 */

export interface AnnouncerOpts {
  /** Speaking rate (default 1.15). */
  rate?: number;
  /** Voice pitch (default 0.7). */
  pitch?: number;
  /** BCP-47 language prefix (default 'en'). */
  lang?: string;
}

export interface Announcer {
  readonly available: boolean;
  enabled: boolean;
  /** 0..1 */
  volume: number;
  /** Speak a line; false when speech is unavailable or disabled. */
  say(line: string): boolean;
  cancel(): void;
}

/** Voices that tend to sound like an arcade announcer, in order of preference. */
const PREFERRED = /\b(daniel|alex|fred|david|george|james|guy|male|ralph|aaron|arthur)\b/i;

export function createAnnouncer(opts: AnnouncerOpts = {}): Announcer {
  const synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
      ? window.speechSynthesis
      : null;
  const lang = (opts.lang ?? 'en').toLowerCase();
  let voice: SpeechSynthesisVoice | null = null;
  let speaking = false;
  let queued: string | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  function pickVoice(): void {
    if (!synth) return;
    const all = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    voice = all.find((v) => PREFERRED.test(v.name)) ?? all.find((v) => v.localService) ?? all[0] ?? null;
  }

  if (synth) {
    pickVoice();
    synth.addEventListener?.('voiceschanged', pickVoice);
  }

  const self: Announcer = {
    available: synth !== null,
    enabled: true,
    volume: 1,
    say(line: string): boolean {
      if (!synth || !self.enabled || line.trim() === '') return false;
      if (speaking) {
        queued = line; // queue limit 1: the newest waiting line wins
        return true;
      }
      speak(line);
      return true;
    },
    cancel(): void {
      queued = null;
      speaking = false;
      if (watchdog) clearTimeout(watchdog);
      try {
        synth?.cancel();
      } catch {
        // ignore: some browsers throw when nothing is queued
      }
    },
  };

  function done(): void {
    speaking = false;
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
    const next = queued;
    queued = null;
    if (next !== null) speak(next);
  }

  function speak(line: string): void {
    if (!synth) return;
    try {
      const u = new SpeechSynthesisUtterance(line);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = opts.rate ?? 1.15;
      u.pitch = opts.pitch ?? 0.7;
      u.volume = Math.max(0, Math.min(1, self.volume));
      u.onend = done;
      u.onerror = done;
      speaking = true;
      synth.speak(u);
      // Some engines never fire 'end'; never stay stuck.
      watchdog = setTimeout(done, 1500 + line.length * 120);
    } catch {
      speaking = false;
    }
  }

  return self;
}
