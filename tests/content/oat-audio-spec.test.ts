/**
 * Mission oat's ElevenLabs spec (tools/audio/spec.ts; docs/design/oat.md §9; wave A: the plan only,
 * no generation): every registered 'oat/' sfx is requested in group 'mission:oat' or listed as synth
 * only; the songs follow their synth fallbacks and take forms (content/music/oat.ts `OAT_TAKES`);
 * every voiced line of content/samples/oat.ts is requested verbatim in its designed voice; the card's
 * lines sit in 'boot'; the voices are designed, Dutch and never an imitation; the plan stays under the
 * user's cap of 35,000 credits (tmp/oat/audio-estimate.md).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasSfx } from '../../src/engine/audio';
import { voiceKey } from '../../src/engine/samples';
import { listSfx } from '../../src/engine/synth';
import { OAT_AMBIENCE, OAT_AUDIO_GROUP, OAT_SONG, OAT_SPEAKER } from '../../src/game/content/missions/oat/ids';
import { OAT_SONGS, OAT_TAKES, takeBeats, takeLoopBeat, takeSlotBeats } from '../../src/game/content/music/oat';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';
import { oatLineSeconds, oatVoiceLines } from '../../src/game/content/samples/oat';
import '../../src/game/content/sfx/index';
import { OAT_SFX_IDS } from '../../src/game/content/sfx/oat';
import { MISSION_CARDS } from '../../src/game/content/ui/cards';
import { creditsPerTake, items, itemsOfGroups, paths } from '../../tools/audio/lib';
import { planShip, renderManifest } from '../../tools/audio/ship';
import { LINES, MUSIC, OAT_SAY, OAT_SYNTH_ONLY, SFX, VOICES } from '../../tools/audio/spec';

const isOat = (x: { group: string }): boolean => x.group === OAT_AUDIO_GROUP;
const oatSfx = SFX.filter(isOat);
const oatMusic = MUSIC.filter(isOat);
const oatLines = LINES.filter(isOat);
const CAP = 35000;

describe("audio spec, mission oat: sfx (group 'mission:oat')", () => {
  it("every registered 'oat/' recipe is requested once, or stays synth for a stated reason", () => {
    const requested = new Set(oatSfx.map((s) => s.id));
    expect(requested.size).toBe(oatSfx.length);
    for (const id of OAT_SYNTH_ONLY) {
      expect(OAT_SFX_IDS, id).toContain(id);
      expect(requested.has(id), id).toBe(false);
    }
    const missing = listSfx('oat/').filter((id) => !requested.has(id) && !OAT_SYNTH_ONLY.includes(id));
    expect(missing, "registered 'oat/' sfx the spec neither requests nor lists as synth only").toEqual([]);
    expect([...requested, ...OAT_SYNTH_ONLY].sort()).toEqual([...OAT_SFX_IDS].sort());
  });

  it('every request has its synth fallback, is marked new (lazy content), and no oat id sits in another group', () => {
    for (const s of oatSfx) {
      expect(s.id.startsWith('oat/'), s.id).toBe(true);
      expect(hasSfx(s.id), s.id).toBe(true);
      expect(s.isNew, s.id).toBe(true);
      // No gulls (the user's rule since ams): a prompt only names them to rule them out.
      expect(s.prompt.replace(/no seagulls/gi, ''), s.id).not.toMatch(/gull/i);
    }
    for (const s of SFX.filter((x) => !isOat(x))) expect(s.id.startsWith('oat/'), s.id).toBe(false);
  });

  it('the section ambience: loops (the chase stays synth: the chase music covers it); no gulls', () => {
    for (const id of Object.values(OAT_AMBIENCE)) {
      if (OAT_SYNTH_ONLY.includes(id)) continue;
      const s = oatSfx.find((x) => x.id === id);
      expect(s, id).toBeDefined();
      expect(s?.loop, id).toBe(true);
      expect(s?.prompt, id).toMatch(/no seagulls|no radio/i);
    }
  });

  it('prompts name no brand, game, film or person (generic sounds only)', () => {
    for (const s of oatSfx) expect(s.prompt, s.id).not.toMatch(/\b(in the style of|like the|famous|brand)\b/i);
  });
});

describe('audio spec, mission oat: songs', () => {
  it('the five OAT_SONG ids, built from their take forms: tempo, meter, intro bars, length and slot marks', () => {
    expect(oatMusic.map((m) => m.id).sort()).toEqual(Object.values(OAT_SONG).sort());
    for (const m of oatMusic) {
      const form = OAT_TAKES[m.id];
      expect(m.bpm, m.id).toBe(OAT_SONGS[m.id].bpm);
      expect(m.loop, m.id).toBe(true);
      expect(m.takes, m.id).toBe(2);
      const meter = form.parts.find((p) => p.name === form.loopFrom)!.beatsPerBar;
      expect(m.beatsPerBar, m.id).toBe(meter);
      expect(m.introBars, m.id).toBe(takeLoopBeat(m.id) / meter);
      expect(Number.isInteger(m.introBars), m.id).toBe(true);
      // The whole take plus 2 s to cut the loop (audio:process cuts it on the bar grid).
      expect(m.seconds, m.id).toBeGreaterThanOrEqual((takeBeats(m.id) * 60) / m.bpm + 2);
      expect(m.seconds, m.id).toBeLessThanOrEqual((takeBeats(m.id) * 60) / m.bpm + 3);
      expect(m.slotBeats, m.id).toEqual(takeSlotBeats(m.id));
    }
  });

  it('prompts in our own words: tempo, instrumental, original, never a named song, artist, game or composer', () => {
    for (const m of oatMusic) {
      expect(m.prompt, m.id).toContain(`${m.bpm} BPM`);
      expect(m.prompt, m.id).toMatch(/original composition/i);
      expect(m.prompt, m.id).toMatch(/no vocals/i);
      expect(m.prompt, m.id).toMatch(/all melodies are new/i);
      expect(m.prompt, m.id).not.toMatch(/\bin the style of\b|\blike the\b|\bsounds like\b/i);
    }
    // The spec's moods (§9.1).
    const p = (id: string): string => oatMusic.find((m) => m.id === id)?.prompt ?? '';
    expect(p(OAT_SONG.a)).toMatch(/marimba/i);
    expect(p(OAT_SONG.a)).toMatch(/claps/i);
    expect(p(OAT_SONG.b)).toMatch(/ticking/i);
    expect(p(OAT_SONG.b)).toMatch(/pizzicato/i);
    expect(p(OAT_SONG.b)).toMatch(/shop-door bell/i);
    expect(p(OAT_SONG.c)).toMatch(/chase/i);
    expect(p(OAT_SONG.c)).toMatch(/brass/i);
    expect(p(OAT_SONG.d)).toMatch(/neon synth/i);
    expect(p(OAT_SONG.d)).toMatch(/arpeggios/i);
    expect(p(OAT_SONG.boss)).toMatch(/waltz/i);
    expect(p(OAT_SONG.boss)).toMatch(/cash register/i);
  });
});

describe('audio spec, mission oat: shipping a song take', () => {
  it("audio:ship writes the song's `marks` (seconds per synth slot, from `slotBeats`) into the manifest", () => {
    const root = mkdtempSync(join(tmpdir(), 'ms3-oat-audio-'));
    try {
      const p = paths(root);
      const dir = join(p.cand, 'music', 'oat-boss');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'take-1.mp3'), 'x');
      writeFileSync(join(dir, 'take-1.json'), JSON.stringify({ duration: 81.5, loopStart: 35.455, loopEnd: 79.091, warnings: [] }));
      const plan = planShip(items({ SFX, MUSIC, VOICES, LINES }), { 'music:oat-boss': [1] }, p);
      expect(plan.errors).toEqual([]);
      const song = plan.groups[OAT_AUDIO_GROUP].music['oat-boss'];
      const beat = 60 / OAT_TAKES['oat-boss'].bpm;
      expect(song.marks).toEqual(takeSlotBeats('oat-boss').map((b) => Math.round(b * beat * 1000) / 1000));
      // The waltz (De Huisjesmelker's part) enters 2 bars of 3/4 before the take's loop.
      expect(song.marks?.[OAT_SONGS['oat-boss'].order.indexOf('Bi')]).toBeCloseTo(35.455 - 6 * beat, 2);
      expect(renderManifest(plan.groups)).toContain(`marks: [${song.marks?.join(', ')}]`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('audio spec, mission oat: voices and lines', () => {
  const designed = [OAT_SPEAKER.makelaar, OAT_SPEAKER.huisjesmelker, OAT_SPEAKER.taxi, OAT_SPEAKER.barista, OAT_SPEAKER.influencer, OAT_SPEAKER.bakfiets, OAT_SPEAKER.dealer, OAT_SPEAKER.rijStaf, OAT_SPEAKER.rij, OAT_SPEAKER.gids, OAT_SPEAKER.huurder];

  it('eleven designed voices: Dutch speakers, original characters, never an imitation, no accent as a joke', () => {
    for (const speaker of designed) {
      const v = VOICES.find((x) => x.speaker === speaker);
      expect(v, speaker).toBeDefined();
      expect(v?.description, speaker).toMatch(/original character voice/i);
      expect(v?.description, speaker).toMatch(/never an imitation/i);
      expect(v?.description, speaker).toMatch(/standard Dutch with a neutral accent/i);
      expect(v?.robot, speaker).toBeFalsy();
      expect(v?.radio, speaker).toBeFalsy();
    }
    // The reused handhaver keeps its ams design.
    expect(VOICES.filter((v) => v.speaker === OAT_SPEAKER.handhaver).length).toBe(1);
  });

  it("every voiced line of samples/oat.ts is requested verbatim, Dutch, in its speaker's voice, with its time budget", () => {
    const lines = oatVoiceLines();
    expect(oatLines.length).toBe(lines.length);
    for (const { speaker, text } of lines) {
      const l = oatLines.find((x) => x.text === text);
      expect(l, text).toBeDefined();
      expect(l?.speaker, text).toBe(speaker);
      expect(l?.lang, text).toBe('nl');
      expect(l?.maxSeconds, text).toBe(oatLineSeconds(text));
      // `€` is spoken "euro" (the bubble shows the glyph).
      if (text.includes('€')) expect(l?.say, text).toMatch(/euro/i);
      expect(l?.say, text).not.toContain('€');
    }
    // Every `say` is used (no stale entry).
    for (const t of Object.keys(OAT_SAY)) expect(lines.some((l) => l.text === t), t).toBe(true);
    // The queue: 21 number calls (39–60; 47 is the player's own line).
    expect(oatLines.filter((l) => /^NUMMER \d+!$/.test(l.text)).length).toBe(21);
  });

  it("no oat line reuses the voice key of a shipped take (a take is found by its text: it would speak in another voice)", () => {
    const shipped = new Set([...Object.keys(SAMPLE_MANIFEST['mission:ams']?.voice ?? {}), ...Object.keys(SAMPLE_MANIFEST.boot?.voice ?? {})]);
    for (const l of oatLines) expect(shipped.has(voiceKey(l.text)), l.text).toBe(false);
  });

  it("the card's two Gusto lines and the announce are in group 'boot' (the card plays before the oat group loads)", () => {
    const card = MISSION_CARDS.find((c) => c.id === 'oat')!;
    expect(card).toBeDefined();
    for (const t of card.briefing) {
      const l = LINES.find((x) => x.text === t);
      expect(l?.speaker, t).toBe('gusto');
      expect(l?.group, t).toBe('boot');
      expect(l?.lang, t).toBe('en');
    }
    const a = LINES.find((x) => x.text === card.announce);
    expect(a?.speaker).toBe('announcer');
    expect(a?.group).toBe('boot');
    expect(a?.lang).toBe('nl');
  });

  it('the group filter selects the oat items and the twelve voice designs they need', () => {
    const all = items({ SFX, MUSIC, VOICES, LINES });
    const oat = [...itemsOfGroups(all, [OAT_AUDIO_GROUP])];
    expect([...new Set(oat.map((it) => it.kind))].sort()).toEqual(['line', 'music', 'sfx', 'voice']);
    expect(oat.filter((it) => it.kind === 'voice').map((it) => it.id).sort()).toEqual([...designed, OAT_SPEAKER.handhaver].sort());
  });
});

describe('audio spec, mission oat: the credit plan', () => {
  it("the plan (every oat take, one design call per new voice, the card's boot lines) stays under the cap of 35,000", () => {
    const all = items({ SFX, MUSIC, VOICES, LINES });
    const oat = [...itemsOfGroups(all, [OAT_AUDIO_GROUP])];
    let credits = 0;
    for (const it of oat) {
      if (it.kind === 'voice') {
        if (it.id !== OAT_SPEAKER.handhaver) credits += creditsPerTake('voice', it.spec);
      } else credits += it.takes * creditsPerTake(it.kind, it.spec);
    }
    const card = MISSION_CARDS.find((c) => c.id === 'oat')!;
    for (const t of [...card.briefing, card.announce ?? '']) {
      const l = LINES.find((x) => x.text === t)!;
      credits += l.takes * creditsPerTake('line', l);
    }
    expect(credits).toBeGreaterThan(25000);
    expect(credits).toBeLessThanOrEqual(CAP - 1500);
  });
});
