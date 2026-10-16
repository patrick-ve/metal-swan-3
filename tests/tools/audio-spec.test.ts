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
import { LINES, MUSIC, SFX, VOICES } from '../../tools/audio/spec';

const SRC = new URL('../../src/', import.meta.url).pathname;
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
    expect(SFX.filter((s) => s.isNew).length).toBe(16);
    expect(SFX.length).toBe(100 + 17);
    expect(SFX.some((s) => s.id === 'ui/mil-shutter')).toBe(true);
    expect(SFX.some((s) => s.id === 'ui/mil-clank')).toBe(true);
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
    for (const m of MUSIC) expect(hasSong(m.id), m.id).toBe(true);
    expect(new Set(MUSIC.map((m) => m.id)).size).toBe(MUSIC.length);
    expect(MUSIC.map((m) => m.id).sort()).toEqual(
      ['ams', 'ams-boss', 'briefing', 'continue', 'game-over', 'high-score', 'mission-complete', 'select', 'title'].sort(),
    );
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
    const loopBars: Record<string, number> = { title: 32, select: 16, briefing: 8, ams: 48, 'ams-boss': 40, continue: 6, 'high-score': 8 };
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
    for (const l of LINES) expect(all.includes(asLiteral(l.text)), JSON.stringify(l.text)).toBe(true);
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
