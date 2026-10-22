/**
 * The ElevenLabs generation spec (tools/audio/spec.ts) stays in step with the game: every sfx id
 * is a registered recipe or a marked new gap sound, every music id is a registered song, every
 * spoken line is the game text verbatim, and the mayor never gets a voice.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasSfx, hasSong } from '../../src/engine/audio';
import { voiceKey } from '../../src/engine/samples';
import { SFX_ALIASES } from '../../src/game/content/sfx/index';
import '../../src/game/content/music/index';
import '../../src/game/content/music/missions';
import '../../src/game/content/music/ams';
import '../../src/game/content/music/oldenzaal';
import { RING_FOOT_SONGS } from '../../src/game/content/music/ring-foot';
import { loadContent } from '../../src/game/content/index';
import { listSfx } from '../../src/engine/synth';
import { OZ_AMBIENCE, OZ_AUDIO_GROUP, OZ_SFX, OZ_SONG, OZ_SPEAKER } from '../../src/game/content/missions/oldenzaal/ids';
import { SNACK_POWER_CALLOUT, voicedLines } from '../../src/game/content/missions/oldenzaal/lines';
import { OZ_ENV_SFX } from '../../src/game/content/sfx/oldenzaal';
import { MISSION_CARDS } from '../../src/game/content/ui/cards';
import { ringVoicedLines } from '../../src/game/content/ring/foot/lines';
import { itemsOfGroups, items, selectItems } from '../../tools/audio/lib';
import { LINES, MUSIC, SFX, VOICES } from '../../tools/audio/spec';

const SRC = new URL('../../src/', import.meta.url).pathname;
const FPS_SPEC = new URL('../../docs/design/fps.md', import.meta.url).pathname;

/** The first-person mode's ids (group 'mode:fps') vs. the rest of the game. */
const isFps = (x: { group: string }): boolean => x.group === 'mode:fps';
/** Mission oldenzaal's ids (group 'mission:oldenzaal', docs/design/oldenzaal.md §11). */
const isOz = (x: { group: string }): boolean => x.group === OZ_AUDIO_GROUP;
/** Mission ring's ids (group 'mission:ring', docs/design/ring.md §R.8). */
const isRing = (x: { group: string }): boolean => x.group === 'mission:ring';
/** The rest of the game (the start screens and ams). */
const isBase = (x: { group: string }): boolean => !isFps(x) && !isOz(x) && !isRing(x);

/** Every backticked `fps/…` sfx id in docs/design/fps.md §9.1. */
function fpsSpecSfx(): Set<string> {
  const doc = readFileSync(FPS_SPEC, 'utf8');
  const sec = doc.slice(doc.indexOf('### 9.1'), doc.indexOf('### 9.2'));
  return new Set([...sec.matchAll(/`(fps\/[a-z0-9/-]+)`/g)].map((m) => m[1]));
}
const MAYOR_FILE = join(SRC, 'game/content/bosses/ams/mayor.ts');

/** Every .ts file under src/, path → contents. */
function sources(dir = SRC, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (p.endsWith('.ts')) out.set(p, readFileSync(p, 'utf8'));
  }
  return out;
}

/** How the text sits in a TS string literal: a newline is written as the escape `\n`. */
function asLiteral(text: string): string {
  return text.replace(/\n/g, '\\n');
}

describe('audio spec: sfx', () => {
  it('every id is a registered recipe (not an alias) or a new gap sound', () => {
    for (const s of SFX) {
      // A new gap sound may already have its synth fallback registered (the wiring adds it).
      if (!s.isNew) expect(hasSfx(s.id), `${s.id} is not a registered sfx`).toBe(true);
      expect(SFX_ALIASES[s.id], `${s.id} is an alias: generate its target once`).toBeUndefined();
    }
  });

  it('ids are unique; 100 recipes (98 + the 2 REPORT FOR DUTY shutter sounds) plus the 16 gap and wiring ids and the mayor babble', () => {
    expect(new Set(SFX.map((s) => s.id)).size).toBe(SFX.length);
    const game = SFX.filter(isBase);
    expect(game.filter((s) => s.isNew).length).toBe(16);
    expect(game.length).toBe(100 + 17);
    expect(SFX.some((s) => s.id === 'ui/mil-shutter')).toBe(true);
    expect(SFX.some((s) => s.id === 'ui/mil-clank')).toBe(true);
  });

  it('the first-person mode has exactly the sfx ids of docs/design/fps.md §9.1 (group mode:fps)', () => {
    const fps = SFX.filter(isFps);
    expect(fps.map((s) => s.id).sort()).toEqual([...fpsSpecSfx()].sort());
    for (const s of fps) {
      expect(s.id.startsWith('fps/'), s.id).toBe(true);
      // Their synth fallbacks live in the lazy fps content (group fps-sound): marked like gap sounds.
      expect(s.isNew, s.id).toBe(true);
    }
    for (const s of SFX.filter((x) => !isFps(x))) expect(s.id.startsWith('fps/'), s.id).toBe(false);
    for (const s of SFX.filter((x) => !isOz(x))) expect(s.id.startsWith('oz/'), s.id).toBe(false);
  });

  it('requests fit the API and the take rule', () => {
    for (const s of SFX) {
      expect(s.seconds, s.id).toBeGreaterThanOrEqual(0.5);
      expect(s.seconds, s.id).toBeLessThanOrEqual(30);
      if (s.trimTo !== undefined) expect(s.trimTo, s.id).toBeLessThanOrEqual(s.seconds);
      if (s.loop) expect(s.seconds, s.id).toBeGreaterThanOrEqual(8);
      if (s.loop) expect(s.seconds, s.id).toBeLessThanOrEqual(20);
      expect(s.takes, s.id).toBe(Math.max(3, s.keep + 1));
      expect(s.prompt.length, s.id).toBeLessThanOrEqual(450);
    }
  });

  it('the hard timings are in the spec', () => {
    const timing = (id: string): string => SFX.find((s) => s.id === id)?.timing ?? '';
    expect(timing('ams/stamp')).toContain('0.50 s');
    expect(timing('ams/bell')).toContain('0.36 s');
    expect(timing('ams/bass-thump')).toContain('0.42 s');
    expect(timing('ams/gull')).toContain('0.36 s');
    expect(timing('ams/chain')).toContain('0.45 s');
  });
});

describe('audio spec: music', () => {
  it('every id is a registered song, once', () => {
    // The fps songs register with the lazy fps content (group fps-sound), not at boot.
    for (const m of MUSIC.filter((x) => !isFps(x))) expect(hasSong(m.id), m.id).toBe(true);
    expect(new Set(MUSIC.map((m) => m.id)).size).toBe(MUSIC.length);
    expect(MUSIC.filter(isBase).map((m) => m.id).sort()).toEqual(
      ['ams', 'ams-boss', 'briefing', 'continue', 'game-over', 'high-score', 'mission-complete', 'select', 'title'].sort(),
    );
    // docs/design/fps.md §9.2: the four first-person songs.
    expect(MUSIC.filter(isFps).map((m) => m.id).sort()).toEqual(['fps-boss', 'fps-bridge', 'fps-floor', 'fps-tally']);
    expect(MUSIC.find((m) => m.id === 'fps-tally')?.loop).toBe(false);
    // docs/design/oldenzaal.md §11: the four oldenzaal songs (ids.ts OZ_SONG), the sting played once.
    expect(MUSIC.filter(isOz).map((m) => m.id).sort()).toEqual(Object.values(OZ_SONG).sort());
    expect(MUSIC.find((m) => m.id === OZ_SONG.tbc)?.loop).toBe(false);
    // docs/design/ring.md §R.8: the two songs on foot (the stage theme and ring-boss stay synth).
    expect(MUSIC.filter(isRing).map((m) => m.id).sort()).toEqual(['ring-boot', 'ring-foot']);
  });

  it('the military title and select prompts are v2 takes (3-4); the v1 takes 1-2 keep their prompt on record', async () => {
    const spec = await import('../../tools/audio/spec');
    for (const id of ['title', 'select']) {
      const m = MUSIC.find((x) => x.id === id);
      expect(m?.takes, id).toBe(4);
      expect(m?.prompt, id).toMatch(/snare/i);
      expect(m?.prompt, id).toMatch(/brass|trumpet|horn/i);
    }
    expect(spec.TITLE_V1_PROMPT).toContain('112 BPM');
    expect(spec.SELECT_V1_PROMPT).toContain('128 BPM');
  });

  it('a loop is long enough for its intro, one full loop and 2 s to cut', () => {
    const loopBars: Record<string, number> = { title: 32, select: 16, briefing: 8, ams: 48, 'ams-boss': 40, continue: 6, 'high-score': 8, 'fps-floor': 32, 'fps-boss': 32, 'fps-bridge': 4, oldenzaal: 24, 'oldenzaal-boss': 24, 'oldenzaal-tower': 32, 'ring-foot': 32, 'ring-boot': 24 };
    for (const m of MUSIC.filter((x) => x.loop)) {
      const bar = (60 / m.bpm) * m.beatsPerBar;
      const need = ((m.introBars ?? 0) + loopBars[m.id]) * bar + 2;
      expect(m.seconds, m.id).toBeGreaterThanOrEqual(need - 0.01);
      expect(m.prompt, m.id).toContain(`${m.bpm} BPM`);
    }
  });
});

describe('audio spec: voices and lines', () => {
  const src = sources();
  const all = [...src.values()].join('\n');

  it('every line is the game text verbatim', () => {
    const missing = LINES.filter((l) => !all.includes(asLiteral(l.text))).map((l) => l.text);
    expect(missing, 'line texts not found in src/').toEqual([]);
  });

  it('the first-person lines: German shouts and taunts (docs/design/fps.md §9.3, §7.4), the suit in Dutch', () => {
    const fps = LINES.filter(isFps);
    const by = (speaker: string): string[] => fps.filter((l) => l.speaker === speaker).map((l) => l.text);
    expect(by('guard')).toEqual(['DA DRÜBEN!', 'EINDRINGLING!', 'MEINE BRILLE...!', 'NICHT SCHON WIEDER...']);
    expect(by('officer')).toEqual(['ALLE MANN AUF POSTEN!', 'MEIN SCHÖNER HUT...!']);
    expect(by('ss')).toEqual(['FEUER FREI!', 'DAS STEHT NICHT IM HANDBUCH...!']);
    expect(by('mechahitler')).toEqual(['MEIN SCHÖNER ANZUG! DAS ZAHLT IHR MIR!', 'DAS IST NICHT FAIR! ICH HATTE VORTRITT!', 'DAS... STAND NICHT... IM PLAN...']);
    expect(by('mecha').length).toBe(3);
    for (const l of fps) expect(l.lang, l.text).toBe(l.speaker === 'mecha' ? 'nl' : 'de');
    // Only the suit gets the robot filter; the boss on foot speaks plain.
    expect(VOICES.find((v) => v.speaker === 'mecha')?.robot).toBe(true);
    expect(VOICES.find((v) => v.speaker === 'mechahitler')?.robot).toBeFalsy();
  });

  it('the first-person voices are designed cartoon voices that name no real person', () => {
    for (const speaker of ['guard', 'officer', 'ss', 'mechahitler']) {
      const v = VOICES.find((x) => x.speaker === speaker);
      expect(v, speaker).toBeDefined();
      expect(`${v?.name} ${v?.description} ${v?.previewText}`, speaker).not.toMatch(/hitler|adolf|f(ü|ue)hrer/i);
      expect(v?.description, speaker).toMatch(/original cartoon character voice/i);
    }
  });

  it("the gag 'MMF?!' shares the clip of 'MMF!'", () => {
    expect(all.includes("'MMF?!'")).toBe(true);
    expect(LINES.some((l) => voiceKey(l.text) === voiceKey('MMF?!'))).toBe(true);
  });

  it('no line and no voice belongs to the mayor', () => {
    const mayor = src.get(MAYOR_FILE) ?? '';
    expect(mayor.length).toBeGreaterThan(0);
    const elsewhere = [...src.entries()].filter(([p]) => p !== MAYOR_FILE).map(([, s]) => s).join('\n');
    for (const l of LINES) {
      expect(l.speaker, l.text).not.toMatch(/mayor|halsema/i);
      // A line that only the mayor's file contains is hers.
      expect(!mayor.includes(asLiteral(l.text)) || elsewhere.includes(asLiteral(l.text)), l.text).toBe(true);
    }
    for (const v of VOICES) {
      expect(`${v.speaker} ${v.name} ${v.description}`).not.toMatch(/mayor|halsema|burgemeester/i);
    }
  });

  it('every speaker has a designed voice, and every voice is used', () => {
    const speakers = new Set(VOICES.map((v) => v.speaker));
    expect(speakers.size).toBe(VOICES.length);
    for (const l of LINES) expect(speakers.has(l.speaker), l.speaker).toBe(true);
    for (const v of VOICES) expect(LINES.some((l) => l.speaker === v.speaker), v.speaker).toBe(true);
  });

  it('Voice Design inputs fit the API', () => {
    for (const v of VOICES) {
      expect(v.description.length, v.speaker).toBeGreaterThanOrEqual(20);
      expect(v.description.length, v.speaker).toBeLessThanOrEqual(1000);
      expect(v.previewText.length, v.speaker).toBeGreaterThanOrEqual(100);
      expect(v.previewText.length, v.speaker).toBeLessThanOrEqual(1000);
    }
  });

  it('voice keys are unique and every line has a budget and takes', () => {
    const keys = LINES.map((l) => voiceKey(l.text));
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of LINES) {
      expect(voiceKey(l.text).length, l.text).toBeGreaterThan(0);
      expect(l.takes, l.text).toBeGreaterThanOrEqual(2);
      expect(l.maxSeconds ?? 0, l.text).toBeGreaterThan(0);
      expect(l.say.length, l.text).toBeGreaterThan(0);
    }
    expect(voiceKey('HOI! WELKOM BIJ\nFABEL FRIET!')).toBe('hoi-welkom-bij-fabel-friet');
    expect(voiceKey('GRAMPS: I BROUGHT HER ALONG.')).toBe('i-brought-her-along');
  });

  it('the squad name callouts are voiced by the designed drill sergeant (never the friends\' own voices)', async () => {
    const { getCharacter, hasCharacter } = await import('../../src/game/registry');
    await import('../../src/game/content/characters/index');
    const { ROSTER } = await import('../../src/game/scenes/flow-data');
    for (const id of ROSTER) {
      if (!hasCharacter(id)) continue;
      const v = getCharacter(id).voice ?? '';
      const l = LINES.find((x) => x.text === v);
      expect(l, `${id}: ${v}`).toBeDefined();
      if (['vincent', 'thom', 'dirk', 'bob', 'patrick'].includes(id)) expect(l?.speaker, id).toBe('drill');
    }
    expect(VOICES.find((v) => v.speaker === 'drill')?.description).toMatch(/drill sergeant/i);
  });

  it('the weapon pickup lines (name and MORE) are all voiced', async () => {
    const { VOICE } = await import('../../src/game/content/weapons/stats');
    const texts = new Set(LINES.map((l) => l.text));
    for (const pair of Object.values(VOICE)) for (const t of pair) expect(texts.has(t), t).toBe(true);
  });

  it('every line of the ams briefing is voiced', async () => {
    const { BRIEFING } = await import('../../src/game/content/missions/ams/section-a');
    const texts = new Set(LINES.map((l) => l.text));
    for (const t of BRIEFING) expect(texts.has(t), t).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------ oldenzaal

describe("audio spec: mission oldenzaal (group 'mission:oldenzaal', docs/design/oldenzaal.md §11)", () => {
  it('every oz sfx id is in the spec once, in its group, with an owner prefix; the town ids are the AUDIO recipes', async () => {
    const oz = SFX.filter(isOz);
    expect(oz.length).toBeGreaterThanOrEqual(55);
    const prefixes = Object.values(OZ_SFX);
    for (const s of oz) {
      expect(prefixes.some((p) => s.id.startsWith(p)), s.id).toBe(true);
      // The synth fallbacks are registered by each owner in its own folder: marked like gap sounds.
      expect(s.isNew, s.id).toBe(true);
    }
    const ids = new Set(oz.map((s) => s.id));
    for (const id of OZ_ENV_SFX) expect(ids.has(id), id).toBe(true);
    for (const id of Object.values(OZ_AMBIENCE)) {
      expect(ids.has(id), id).toBe(true);
      expect(oz.find((s) => s.id === id)?.loop, id).toBe(true);
    }
    for (const s of oz.filter((x) => x.id.startsWith(OZ_SFX.env))) expect(hasSfx(s.id), `${s.id}: no synth recipe`).toBe(true);
  });

  it('every registered oz/ sfx recipe (any owner) is listed in the spec', async () => {
    await loadContent((id) => id === 'sfx' || id === 'missions/oldenzaal' || id === 'sfx/oldenzaal' || id === 'music/oldenzaal' || ((id.startsWith('oldenzaal/') || id.startsWith('bosses/oldenzaal')) && !id.endsWith('/art')));
    const listed = new Set(SFX.filter(isOz).map((s) => s.id));
    const missing = listSfx('oz/').filter((id) => !listed.has(id) && !SFX_ALIASES[id]);
    expect(missing, 'registered oz/ sfx ids that tools/audio/spec.ts does not list').toEqual([]);
  });

  it('the songs: dark prompts in our own words, tempo and key as the synth fallbacks', () => {
    const tempo: Record<string, number> = { [OZ_SONG.theme]: 76, [OZ_SONG.boss]: 100, [OZ_SONG.tower]: 168, [OZ_SONG.tbc]: 96 };
    for (const m of MUSIC.filter(isOz)) {
      expect(m.bpm, m.id).toBe(tempo[m.id]);
      expect(m.prompt, m.id).toMatch(/original composition/i);
      expect(m.prompt, m.id).toMatch(/dark|grim|spooky/i);
      expect(m.prompt, m.id).not.toMatch(/\bin the style of\b|\blike the\b/i);
    }
  });

  it('the designed voices: wu, winkel and plechelmus, no stereotype, no real person', () => {
    for (const speaker of Object.values(OZ_SPEAKER)) {
      const v = VOICES.find((x) => x.speaker === speaker);
      expect(v, speaker).toBeDefined();
      expect(v?.description, speaker).toMatch(/original character voice/i);
      expect(v?.description, speaker).toMatch(/never an imitation/i);
    }
    // Meneer Wu (spec §4.2): a plain Dutch voice, no accent play, nothing about his origin.
    const wu = VOICES.find((x) => x.speaker === OZ_SPEAKER.wu);
    const text = `${wu?.name} ${wu?.description} ${wu?.previewText}`;
    expect(text).not.toMatch(/chin|asia|oriental|canton|mandarin|broken|pidgin/i);
    expect(wu?.description).toMatch(/never a caricature of any accent/i);
  });

  it("every voiced line of lines.ts is in the spec (group 'mission:oldenzaal'), with the meal's callout", () => {
    const oz = LINES.filter(isOz);
    const texts = new Set(oz.map((l) => l.text));
    for (const { speaker, text } of voicedLines()) {
      expect(texts.has(text), text).toBe(true);
      expect(oz.find((l) => l.text === text)?.speaker, text).toBe(speaker);
    }
    expect(texts.has(SNACK_POWER_CALLOUT)).toBe(true);
    for (const l of oz) {
      // Bubbles: at most 24 characters per line and 2 lines (the announcer lines have no bubble).
      if (l.speaker !== 'announcer') {
        const rows = l.text.split('\n');
        expect(rows.length, l.text).toBeLessThanOrEqual(2);
        for (const r of rows) expect(r.length, l.text).toBeLessThanOrEqual(24);
      }
    }
  });

  it('the group filter selects the oldenzaal items and the voice designs they need', () => {
    const all = items({ SFX, MUSIC, VOICES, LINES });
    const oz = itemsOfGroups(all, [OZ_AUDIO_GROUP]);
    const kinds = new Set([...oz].map((it) => it.kind));
    expect([...kinds].sort()).toEqual(['line', 'music', 'sfx', 'voice']);
    for (const it of oz) if (it.kind !== 'voice') expect(it.group, it.id).toBe(OZ_AUDIO_GROUP);
    const voices = [...oz].filter((it) => it.kind === 'voice').map((it) => it.id).sort();
    expect(voices).toEqual(['announcer', 'plechelmus', 'winkel', 'wu']);
    expect(selectItems(all, ['sfx'], null, [OZ_AUDIO_GROUP]).every((it) => it.kind === 'sfx' && it.group === OZ_AUDIO_GROUP)).toBe(true);
    expect(selectItems(all, null, null).length).toBe(all.length);
  });
});

// ------------------------------------------------------------------------------------------ ring

describe("audio spec: mission ring (group 'mission:ring', docs/design/ring.md §R.8)", () => {
  it('the ring sfx are registered ring/ recipes (wave A: the train, the jam, rf-a), once', async () => {
    await loadContent((id) => id === 'sfx' || id === 'ring/foot' || id === 'ring/zwaan');
    const ring = SFX.filter(isRing);
    expect(ring.length).toBeGreaterThanOrEqual(20);
    for (const s of ring) {
      expect(s.id.startsWith('ring/'), s.id).toBe(true);
      expect(hasSfx(s.id), `${s.id}: no synth recipe`).toBe(true);
    }
    // No ring/ id in another group (the drive and the foot part load 'mission:ring').
    for (const s of SFX.filter((x) => !isRing(x))) expect(s.id.startsWith('ring/'), s.id).toBe(false);
  });

  it('the songs: comic prompts in our own words, tempo, key and form as the synth fallbacks', () => {
    const form: Record<string, { bpm: number; key: string; bars: number }> = {
      'ring-foot': { bpm: 132, key: 'B-flat major', bars: 32 },
      'ring-boot': { bpm: 150, key: 'G minor', bars: 24 },
    };
    for (const m of MUSIC.filter(isRing)) {
      const f = form[m.id];
      expect(m.bpm, m.id).toBe(f.bpm);
      expect(m.prompt, m.id).toContain(f.key);
      expect(m.prompt, m.id).toContain(`${f.bars}-bar loop`);
      expect(m.prompt, m.id).toMatch(/original composition/i);
      expect(m.prompt, m.id).toMatch(/no vocals/i);
      expect(m.prompt, m.id).not.toMatch(/\bin the style of\b|\blike the\b/i);
      const def = RING_FOOT_SONGS[m.id];
      expect(def.bpm, m.id).toBe(m.bpm);
      expect(hasSong(m.id), m.id).toBe(true);
    }
  });

  it('the designed voices: Dutch speakers, original characters, no real person', () => {
    const speakers = new Set(ringVoicedLines().map((l) => l.speaker));
    expect([...speakers].sort()).toEqual(['activist-a', 'activist-b', 'boerenknecht', 'leider', 'zware-jongen']);
    for (const speaker of speakers) {
      const v = VOICES.find((x) => x.speaker === speaker);
      expect(v, speaker).toBeDefined();
      expect(v?.description, speaker).toMatch(/original character voice/i);
      expect(v?.description, speaker).toMatch(/never an imitation/i);
      expect(v?.description, speaker).toMatch(/standard Dutch with a neutral accent/i);
    }
  });

  it("every voiced line of lines.ts is in the spec (group 'mission:ring', Dutch), with the card's lines", () => {
    const ring = LINES.filter(isRing);
    for (const { speaker, text } of ringVoicedLines()) {
      const l = ring.find((x) => x.text === text);
      expect(l, text).toBeDefined();
      expect(l?.speaker, text).toBe(speaker);
      expect(l?.lang, text).toBe('nl');
    }
    const card = MISSION_CARDS.find((c) => c.id === 'ring')!;
    // The announcer's start banner line plays when the drive starts ('mission:ring' is loaded).
    expect(ring.find((l) => l.text === card.announce)?.speaker).toBe('announcer');
    // Gusto's two briefing lines play on the card, before the mission's group: 'boot' (as ams).
    for (const t of card.briefing) expect(LINES.find((l) => l.text === t && l.group === 'boot')?.speaker, t).toBe('gusto');
  });

  it('the group filter selects the ring items and the voice designs they need', () => {
    const all = items({ SFX, MUSIC, VOICES, LINES });
    const ring = itemsOfGroups(all, ['mission:ring']);
    const voices = [...ring].filter((it) => it.kind === 'voice').map((it) => it.id).sort();
    expect(voices).toEqual(['activist-a', 'activist-b', 'announcer', 'boerenknecht', 'leider', 'zware-jongen']);
  });
});
