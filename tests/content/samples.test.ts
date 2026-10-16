/**
 * Sampled audio (src/engine/samples.ts, docs/api/media.md §9.5): the manifest's integrity, the
 * voice keys, the pure helpers of the Web Audio output (take picker, loop folding, speech lane),
 * the sample bank with a mocked fetch and decoder, and the bubble-voice hook of the runner.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasSfx, NullAudio, type AudioOut } from '../../src/engine/audio';
import { VirtualPad } from '../../src/engine/input';
import { hasSong } from '../../src/engine/music';
import {
  ANNOUNCE_MAX_WAIT,
  BUBBLE_MAX_WAIT,
  defineSampleGroup,
  foldLoopPosition,
  getSampleGroup,
  listSampleGroups,
  pickTake,
  SAMPLE_GROUPS,
  songLoopEnd,
  SpeechLane,
  voiceKey,
  type SampleGroup,
} from '../../src/engine/samples';
import { SampleBank } from '../../src/engine/samples.browser';
import { GameAudio } from '../../src/game/app';
import { loadContent } from '../../src/game/content/index';
import { HAND_MUSIC } from '../../src/game/content/samples/index';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';
import { MissionRunner } from '../../src/game/mission/runner';
import { GameSession } from '../../src/game/session';
import { DEFAULT_SETTINGS } from '../../src/game/settings';

const report = await loadContent((id) => id === 'sfx' || id.startsWith('music') || id === 'samples');
const PUBLIC_AUDIO = new URL('../../public/audio/', import.meta.url);

describe('voiceKey', () => {
  it('slugs the spoken text', () => {
    expect(voiceKey('HOI! WELKOM BIJ\nFABEL FRIET!')).toBe('hoi-welkom-bij-fabel-friet');
    expect(voiceKey('MISSION ONE. VLIEG OP, ZWAAN!')).toBe('mission-one-vlieg-op-zwaan');
    expect(voiceKey('SWAN-3. SHORE LEAVE TOO.')).toBe('swan-3-shore-leave-too');
    expect(voiceKey('TIME UP!')).toBe('time-up');
  });

  it('drops a speaker prefix, apostrophes and accents', () => {
    expect(voiceKey('GRAMPS: KEEP THE LINE!')).toBe('keep-the-line');
    expect(voiceKey('GRAMPS: KEEP THE LINE!')).toBe(voiceKey('KEEP THE LINE!'));
    expect(voiceKey("DON'T STOP!")).toBe('dont-stop');
    expect(voiceKey('CAFÉ ÉÉN')).toBe('cafe-een');
    expect(voiceKey('  ...  ')).toBe('');
  });

  it('is at most 64 characters and never ends with a dash', () => {
    const k = voiceKey('A VERY LONG LINE THAT GOES ON AND ON ABOUT FRIES AND SWANS AND CANALS AND BIKES');
    expect(k.length).toBeLessThanOrEqual(64);
    expect(k.endsWith('-')).toBe(false);
    expect(k.startsWith('a-very-long-line')).toBe(true);
  });
});

describe('take picker and loop folding (the pure helpers of audio.browser.ts)', () => {
  it('never picks the last take twice in a row and reaches every other take', () => {
    expect(pickTake(1, 0, 0.7)).toBe(0);
    expect(pickTake(0, -1, 0.3)).toBe(0);
    for (const n of [2, 3, 5]) {
      for (let last = 0; last < n; last++) {
        const seen = new Set<number>();
        for (let i = 0; i < 100; i++) {
          const t = pickTake(n, last, i / 100);
          expect(t).not.toBe(last);
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThan(n);
          seen.add(t);
        }
        expect(seen.size).toBe(n - 1);
      }
      // No last take yet: every take can come first; r = 1 stays in range.
      expect(new Set([0, 0.34, 0.67, 0.99].map((r) => pickTake(3, -1, r))).size).toBe(3);
      expect(pickTake(n, -1, 1)).toBe(n - 1);
    }
  });

  it('folds a play position into the loop (intro once, then the loop)', () => {
    // Intro 0..4 s, loop 4..10 s.
    expect(foldLoopPosition(0, 4, 10, 10.05)).toBe(0);
    expect(foldLoopPosition(3, 4, 10, 10.05)).toBe(3);
    expect(foldLoopPosition(9.5, 4, 10, 10.05)).toBe(9.5);
    expect(foldLoopPosition(10, 4, 10, 10.05)).toBeCloseTo(4);
    expect(foldLoopPosition(13, 4, 10, 10.05)).toBeCloseTo(7);
    expect(foldLoopPosition(22, 4, 10, 10.05)).toBeCloseTo(4);
    expect(foldLoopPosition(-1, 4, 10, 10.05)).toBe(0);
    // A one-shot stops at its end.
    expect(foldLoopPosition(3, null, 6, 6)).toBe(3);
    expect(foldLoopPosition(9, null, 6, 6)).toBe(6);
    // A broken loop (end <= start) never loops.
    expect(foldLoopPosition(12, 5, 5, 8)).toBe(5);
    expect(songLoopEnd({ file: 'x.mp3', loopStart: 1, duration: 9 })).toBe(9);
    expect(songLoopEnd({ file: 'x.mp3', loopStart: 1, loopEnd: 8, duration: 9 })).toBe(8);
  });
});

describe('speech lane (one voice sample at a time)', () => {
  it('ignores the line that plays or waits, and a quick repeat of a line that ended', () => {
    const l = new SpeechLane();
    expect(l.offer('a', 'bubble', 0)).toBe('play');
    expect(l.offer('a', 'bubble', 0.1)).toBe('drop');
    expect(l.done(1)).toBe(null);
    expect(l.offer('a', 'bubble', 1.5)).toBe('drop');
    expect(l.offer('a', 'bubble', 2.1)).toBe('play');
  });

  it("a speaker's bubble line replaces their own playing line; announcer lines wait (queue of one)", () => {
    const baker = { speaker: 'baker' };
    const l = new SpeechLane();
    expect(l.offer('b1', 'bubble', 0, baker)).toBe('play');
    expect(l.offer('b2', 'bubble', 0.2, baker)).toBe('replace');
    expect(l.playing?.key).toBe('b2');
    expect(l.offer('a1', 'announce', 0.3)).toBe('queue');
    // The same speaker still replaces the playing bubble; the announcer line keeps waiting.
    expect(l.offer('b3', 'bubble', 0.4, baker)).toBe('replace');
    expect(l.offer('a2', 'announce', 0.5)).toBe('queue');
    expect(l.done(1)?.key).toBe('a2');
    // While the announcer speaks, a bubble line waits and the newest waiting one wins.
    expect(l.offer('b4', 'bubble', 1.1, baker)).toBe('queue');
    expect(l.offer('b5', 'bubble', 1.2, baker)).toBe('queue');
    expect(l.done(2)?.key).toBe('b5');
    // A bubble never pushes out a waiting announcer line.
    expect(l.offer('a4', 'announce', 2.1)).toBe('queue');
    expect(l.offer('b6', 'bubble', 2.2, baker)).toBe('replace');
    l.offer('a5', 'announce', 2.3);
    expect(l.playing?.kind).toBe('bubble');
    const m = new SpeechLane();
    m.offer('a6', 'announce', 0);
    m.offer('a7', 'announce', 0.1);
    expect(m.offer('b7', 'bubble', 0.2)).toBe('drop');
    expect(m.done(1)?.key).toBe('a7');
  });

  it('a gag bark never cuts off another speaker; a hint or radio line cuts off a gag bark', () => {
    // The finale: 'LEKKER!' (staff, gag) while the baker's 'FABEL FRIET BLIJFT OPEN!' plays.
    const l = new SpeechLane();
    expect(l.offer('fabel-friet-blijft-open', 'bubble', 0, { speaker: 'baker', important: true })).toBe('play');
    expect(l.offer('lekker', 'bubble', 1, { speaker: 'staff2' })).toBe('queue');
    expect(l.playing?.key).toBe('fabel-friet-blijft-open');
    // Another gag bark waits instead (the newest waiting gag line wins).
    expect(l.offer('dankjewel', 'bubble', 1.2, { speaker: 'staff1' })).toBe('queue');
    expect(l.done(2)?.key).toBe('dankjewel');
    // A radio hint cuts off the gag bark that plays.
    expect(l.offer('hold-jump', 'bubble', 2.1, { speaker: 'gramps', important: true })).toBe('replace');
    expect(l.playing?.key).toBe('hold-jump');
    // A gag bark from an unknown speaker waits, and never pushes out a waiting important line.
    expect(l.offer('mama', 'bubble', 2.2)).toBe('queue');
    expect(l.offer('radio-2', 'bubble', 2.3, { speaker: 'gusto', important: true })).toBe('queue');
    expect(l.offer('mmf', 'bubble', 2.4, { speaker: 'tourist' })).toBe('drop');
    expect(l.done(3)?.key).toBe('radio-2');
    // An important line from another speaker does not cut off an important line either.
    expect(l.offer('hint-2', 'bubble', 3.1, { speaker: 'baker', important: true })).toBe('queue');
  });

  it('drops a line that waited too long; clear forgets everything', () => {
    const l = new SpeechLane();
    l.offer('a1', 'announce', 0);
    l.offer('b1', 'bubble', 0.1);
    expect(l.done(0.1 + BUBBLE_MAX_WAIT + 0.01)).toBe(null);
    expect(l.playing).toBe(null);
    l.offer('a2', 'announce', 10);
    l.offer('a3', 'announce', 10);
    expect(l.done(10 + ANNOUNCE_MAX_WAIT - 0.1)?.key).toBe('a3');
    l.clear();
    expect(l.playing).toBe(null);
    expect(l.offer('a3', 'announce', 13)).toBe('play');
  });
});

/** String literals the mayor says (bosses/ams/mayor.ts: say2 / sayTwo and the taunt table). */
function mayorLines(): string[] {
  const src = readFileSync(new URL('../../src/game/content/bosses/ams/mayor.ts', import.meta.url), 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(/(?:say2|sayTwo)\(\s*'((?:[^'\\]|\\.)*)'(?:,\s*'((?:[^'\\]|\\.)*)')?/g)) {
    out.push(m[1].replace(/\\n/g, '\n'));
    if (m[2]) out.push(m[2].replace(/\\n/g, '\n'));
  }
  for (const m of src.matchAll(/text:\s*'((?:[^'\\]|\\.)*)'/g)) out.push(m[1].replace(/\\n/g, '\n'));
  return out;
}

describe('sample manifest (src/game/content/samples)', () => {
  it('registers the two groups through the content manifest', () => {
    expect(report.failed).toEqual([]);
    expect(Object.keys(SAMPLE_MANIFEST).sort()).toEqual([...SAMPLE_GROUPS].sort());
    for (const g of SAMPLE_GROUPS) expect(listSampleGroups()).toContain(g);
    const boot = getSampleGroup('boot')!;
    expect(boot.sfx).toBe(SAMPLE_MANIFEST.boot!.sfx);
    expect(boot.music).toEqual({ ...SAMPLE_MANIFEST.boot!.music, ...HAND_MUSIC.boot });
  });

  it("the user's music tracks (public/audio/user/music) replace the generated takes and loop sanely", () => {
    const ids: Record<string, string[]> = { boot: ['title', 'select'], 'mission:ams': ['ams', 'ams-boss'] };
    for (const [group, songs] of Object.entries(ids)) {
      for (const id of songs) {
        const song = getSampleGroup(group)!.music![id]!;
        expect(song.file, id).toMatch(/^user\/music\/[a-z0-9-]+\.mp3$/);
        expect(song).toBe(HAND_MUSIC[group]![id]);
        const url = new URL(song.file, PUBLIC_AUDIO);
        expect(existsSync(url), `missing public/audio/${song.file}`).toBe(true);
        expect(statSync(url).size).toBeGreaterThan(100_000);
        expect(song.loopStart).toBe(0);
        expect(song.loopEnd!).toBeGreaterThan(20);
        expect(song.loopEnd!).toBeLessThan(song.duration);
        expect(hasSong(id), id).toBe(true);
      }
    }
  });

  it('keys are registered sound effect ids and song ids; files exist; loop points are sane', () => {
    const fileOk = (f: string): void => {
      expect(f, f).toMatch(/^(boot|ams)\/(sfx|music|voice)\/[a-z0-9._-]+\.mp3$/);
      const url = new URL(f, PUBLIC_AUDIO);
      expect(existsSync(url), `missing public/audio/${f}`).toBe(true);
      expect(statSync(url).size, f).toBeGreaterThan(0);
    };
    for (const g of Object.values(SAMPLE_MANIFEST) as SampleGroup[]) {
      for (const [id, s] of Object.entries(g.sfx ?? {})) {
        expect(hasSfx(id), `unknown sfx id ${id}`).toBe(true);
        expect(s.files.length, id).toBeGreaterThan(0);
        s.files.forEach(fileOk);
        if (s.loopStart !== undefined || s.loopEnd !== undefined) {
          expect(s.loopStart ?? 0, id).toBeGreaterThanOrEqual(0);
          if (s.loopEnd !== undefined) expect(s.loopEnd, id).toBeGreaterThan(s.loopStart ?? 0);
        }
        if (s.vol !== undefined) expect(s.vol).toBeGreaterThan(0);
      }
      for (const [id, s] of Object.entries(g.music ?? {})) {
        expect(hasSong(id), `unknown song id ${id}`).toBe(true);
        fileOk(s.file);
        expect(s.duration, id).toBeGreaterThan(0);
        const end = songLoopEnd(s);
        expect(end, id).toBeLessThanOrEqual(s.duration + 1e-6);
        if (s.loopStart !== null) {
          expect(s.loopStart, id).toBeGreaterThanOrEqual(0);
          expect(end - s.loopStart, id).toBeGreaterThan(1);
        }
      }
      for (const [key, v] of Object.entries(g.voice ?? {})) {
        expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(key.length).toBeLessThanOrEqual(64);
        expect(v.files.length, key).toBeGreaterThan(0);
        expect(v.duration, key).toBeGreaterThan(0);
        v.files.forEach(fileOk);
      }
    }
  });

  it('voice keys belong to known lines; ROBO-HALSEMA never has a voice', async () => {
    const keys = (Object.values(SAMPLE_MANIFEST) as SampleGroup[]).flatMap((g) => Object.keys(g.voice ?? {}));
    const mayor = new Set(mayorLines().map(voiceKey));
    expect(mayor.size).toBeGreaterThan(3);
    for (const k of keys) expect(mayor.has(k), `mayor line voiced: ${k}`).toBe(false);
    if (keys.length === 0) return;
    // The lines come from the generation spec (tools/audio/spec.ts), which the manifest is made from.
    const spec = (await import('../../tools/audio/spec')) as { LINES: ReadonlyArray<{ speaker: string; text: string }> };
    const known = new Set(spec.LINES.map((l) => voiceKey(l.text)));
    for (const k of keys) expect(known.has(k), `voice key ${k} is not a line of tools/audio/spec.ts`).toBe(true);
    expect(spec.LINES.filter((l) => /HALSEMA|MAYOR/i.test(l.speaker))).toEqual([]);
  });
});

describe('sample bank (mocked fetch and decoder)', () => {
  type Res = { ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> };
  const fakeBuffer = (name: string): AudioBuffer => ({ duration: 1, name }) as unknown as AudioBuffer;

  function bank(fail: readonly string[] = []): { b: SampleBank; urls: string[]; warns: string[] } {
    const urls: string[] = [];
    const warns: string[] = [];
    const enc = new TextEncoder();
    const b = new SampleBank(() => Promise.reject(new Error('unused')), {
      baseUrl: 'http://game.test/play/index.html',
      fetch: (url: string): Promise<Res> => {
        urls.push(url);
        const ok = !fail.some((f) => url.endsWith(f));
        return Promise.resolve({ ok, status: ok ? 200 : 404, arrayBuffer: () => Promise.resolve(enc.encode(url).buffer as ArrayBuffer) });
      },
      decode: (bytes) => Promise.resolve(fakeBuffer(new TextDecoder().decode(bytes))),
      warn: (m) => warns.push(m),
    });
    return { b, urls, warns };
  }

  defineSampleGroup('test:bank', {
    sfx: { 'ui/move': { files: ['boot/sfx/ui-move-1.mp3', 'boot/sfx/ui-move-2.mp3', 'boot/sfx/ui-move-3.mp3'], vol: 0.8 }, 'ui/cancel': { files: ['boot/sfx/gone.mp3'] } },
    music: { title: { file: 'boot/music/title-1.mp3', loopStart: 4, loopEnd: 60, duration: 61 } },
    voice: { 'time-up': { files: ['boot/voice/time-up-1.mp3'], duration: 0.8 } },
  });

  it('fetches next to the page, decodes, reports progress and warns once per failed file', async () => {
    const { b, urls, warns } = bank(['gone.mp3']);
    const progress: string[] = [];
    await b.load('test:bank', (d, t) => progress.push(`${d}/${t}`));
    expect(urls).toContain('http://game.test/play/audio/boot/sfx/ui-move-1.mp3');
    expect(urls.length).toBe(6);
    expect(progress[0]).toBe('0/6');
    expect(progress[progress.length - 1]).toBe('6/6');
    expect(b.state('sfx', 'ui/move')).toBe('ready');
    expect(b.state('sfx', 'ui/cancel')).toBe('failed');
    expect(b.sfx('ui/cancel')).toBe(null);
    expect(b.sfxDef('ui/move')?.vol).toBe(0.8);
    expect(b.song('title')?.def.loopStart).toBe(4);
    expect(b.voice('time-up')).not.toBe(null);
    expect(b.state('voice', 'nope')).toBe(null);
    expect(warns.length).toBe(1);
    // Loading again is a no-op (the same promise).
    await b.load('test:bank');
    expect(urls.length).toBe(6);
    // An unknown group resolves at once.
    await b.load('no-such-group');
  });

  it('never plays the same take twice in a row; release drops the group', async () => {
    const { b } = bank();
    await b.load('test:bank');
    let last = '';
    for (let i = 0; i < 30; i++) {
      const name = (b.sfx('ui/move')?.buffer as unknown as { name: string }).name;
      expect(name).not.toBe(last);
      last = name;
    }
    expect(b.ready('sfx').sort()).toEqual(['ui/cancel', 'ui/move']);
    b.release('test:bank');
    expect(b.sfx('ui/move')).toBe(null);
    expect(b.song('title')).toBe(null);
    expect(b.state('voice', 'time-up')).toBe(null);
  });
});

describe('speech bubbles are voiced through AudioOut.say (audio only)', () => {
  class SayAudio extends NullAudio implements AudioOut {
    readonly said: string[] = [];
    readonly important: (boolean | undefined)[] = [];
    say(text: string, _speaker?: string, o?: { important?: boolean }): void {
      this.said.push(text);
      this.important.push(o?.important);
    }
  }

  it('the runner voices bubbles that show; voice:false and hidden gag bubbles stay silent', () => {
    const audio = new SayAudio();
    const settings = { ...DEFAULT_SETTINGS };
    const runner = new MissionRunner({ session: new GameSession({ seed: 1 }), mission: 'no-such-mission', pads: [new VirtualPad(), new VirtualPad()], audio, settings });
    const who = { x: 10, y: 10 };
    runner.hud.bubble(who, 'HALLO DAAR!', { kind: 'gag' });
    runner.hud.bubble(who, 'TOT ZIENS...', { kind: 'gag', voice: false });
    settings.speechBubbles = false;
    runner.hud.bubble(who, 'LEKKER!', { kind: 'gag' });
    runner.hud.bubble(who, 'SWAN-3. SHORE LEAVE TOO.', { kind: 'hint' });
    expect(audio.said).toEqual(['HALLO DAAR!', 'SWAN-3. SHORE LEAVE TOO.']);
    // Hint and radio bubbles are important (a gag bark never cuts them off).
    expect(audio.important).toEqual([undefined, true]);
    // No NullAudio log entries for say.
    expect(audio.log).toEqual([]);
  });

  it('GameAudio forwards say unless VOICE VOLUME is 0, and loadSamples resolves without samples', async () => {
    const inner = new SayAudio();
    const settings = { ...DEFAULT_SETTINGS };
    const ga = new GameAudio(inner, settings);
    ga.say('HALLO DAAR!');
    settings.voiceVolume = 0;
    ga.say('LEKKER!');
    expect(inner.said).toEqual(['HALLO DAAR!']);
    await ga.loadSamples('boot');
    const plain = new GameAudio(new NullAudio(), settings);
    plain.say('HALLO DAAR!');
    await plain.loadSamples('mission:ams');
    expect((plain.inner as NullAudio).log).toEqual([]);
  });
});
