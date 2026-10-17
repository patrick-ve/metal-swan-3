/**
 * ElevenLabs audio pipeline tools (tools/elevenlabs.ts, tools/audio/*): spec checks, request
 * building, idempotent planning, a generation run against a mocked fetch, ffmpeg processing of a
 * tiny sine (skipped without ffmpeg), the review server and the shipped manifest. Never touches
 * the network or the real .env.local.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, pool, type FetchLike } from '../../tools/audio/client';
import { clearRegen, planJobs, runJobs } from '../../tools/audio/gen';
import {
  creditsPerTake,
  designRequest,
  items,
  lineRequest,
  musicRequest,
  parseEnv,
  paths,
  pickKey,
  rawDir,
  readApiKey,
  selectItems,
  sfxRequest,
  slug,
  validateSpec,
  voiceKey,
  type Paths,
  type Spec,
} from '../../tools/audio/lib';
import { integrated, momentaryMax } from '../../tools/audio/loudness';
import { decode, FFMPEG, hasFfmpeg, loopSeam, musicLoop, processTake, soundRange } from '../../tools/audio/process';
import { createReviewServer, reviewItems, sameOrigin } from '../../tools/audio/review';
import { applyShip, planShip, renderManifest } from '../../tools/audio/ship';
import * as realSpec from '../../tools/audio/spec';
import type { LineSpec, MusicSpec, SfxSpec, VoiceSpec } from '../../tools/audio/spec-types';

// ------------------------------------------------------------------------------------------ fixtures

const SFX: SfxSpec[] = [
  { id: 'ui/confirm', group: 'boot', prompt: 'bright rising accept chime, single one-shot', seconds: 1, trimTo: 0.8, takes: 3, keep: 1 },
  { id: 'ams/bell', group: 'mission:ams', prompt: 'bicycle bell, two rings', seconds: 1.5, takes: 2, keep: 2, influence: 0.6, isNew: true },
  { id: 'env/canal', group: 'mission:ams', prompt: 'canal water lapping', seconds: 10, trimTo: 8, loop: true, takes: 1, keep: 1 },
];
const MUSIC: MusicSpec[] = [{ id: 'ams', group: 'mission:ams', prompt: 'driving synth rock, 150 BPM', seconds: 90, bpm: 150, beatsPerBar: 4, introBars: 2, loop: true, takes: 2 }];
const PREVIEW = 'Goedemorgen! This is the canal radio, and the fries are hot today. Keep your feathers dry and your eyes open.';
const VOICES: VoiceSpec[] = [
  { speaker: 'GRAMPS', name: 'MS3 Gramps', description: 'English with a thick Dutch accent. Male, 70s. Gravelly, warm radio veteran.', previewText: PREVIEW, radio: true },
  { speaker: 'VENDOR', name: 'MS3 Vendor', description: 'Native Dutch, Amsterdam. Male, 40s. Loud, cheerful street vendor.', previewText: PREVIEW },
];
const LINES: LineSpec[] = [
  { speaker: 'VENDOR', text: 'HOI! WELKOM BIJ\nFABEL FRIET!', say: '[excited] Hoi! Welkom bij Fabel Friet!', lang: 'nl', group: 'mission:ams', takes: 3 },
  { speaker: 'GRAMPS', text: 'GRAMPS: KEEP LOW,\nCYGNETS!', say: 'Keep low, cygnets!', lang: 'en', group: 'mission:ams', maxSeconds: 3, takes: 2 },
];
const SPEC: Spec = { SFX, MUSIC, VOICES, LINES };

let root = '';
let p: Paths;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ms3-audio-'));
  p = paths(root);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const touch = (file: string, data: string | Uint8Array = 'x'): void => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, data);
};

// ------------------------------------------------------------------------------------------ spec

describe('spec checks', () => {
  it('accepts a sound spec', () => {
    expect(validateSpec(SPEC)).toEqual([]);
  });

  it('the real tools/audio/spec.ts passes the same checks', () => {
    const s = realSpec as unknown as Spec;
    expect(validateSpec({ SFX: s.SFX, MUSIC: s.MUSIC, VOICES: s.VOICES, LINES: s.LINES })).toEqual([]);
  });

  it('flags ranges, duplicates and missing voices', () => {
    const bad: Spec = {
      SFX: [
        { ...SFX[0], seconds: 0.2, keep: 4 },
        { ...SFX[1], id: 'ui-confirm', influence: 2 },
      ],
      MUSIC: [{ ...MUSIC[0], seconds: 2, beatsPerBar: 0 }],
      VOICES: [{ ...VOICES[0], previewText: 'too short' }],
      LINES: [{ ...LINES[0], speaker: 'NOBODY' }, { ...LINES[0], text: 'Hoi! Welkom bij fabel friet' }],
    };
    const errs = validateSpec(bad).join('\n');
    expect(errs).toMatch(/seconds 0.2 not in 0.5..30/);
    expect(errs).toMatch(/keep 4/);
    expect(errs).toMatch(/same sfx name as sfx ui\/confirm/);
    expect(errs).toMatch(/influence not in 0..1/);
    expect(errs).toMatch(/music ams: seconds 2/);
    expect(errs).toMatch(/beatsPerBar/);
    expect(errs).toMatch(/previewText must be 100..1000/);
    expect(errs).toMatch(/no VoiceSpec for speaker NOBODY/);
    expect(errs).toMatch(/same line name/);
  });

  it('never gives the mayor a voice', () => {
    const errs = validateSpec({
      ...SPEC,
      VOICES: [...VOICES, { speaker: 'ROBO-HALSEMA', name: 'Mayor', description: 'A robot mayor with a cold voice.', previewText: PREVIEW }],
      LINES: [...LINES, { speaker: 'ROBO-HALSEMA', text: 'ORDE!', say: 'Orde!', lang: 'nl', group: 'mission:ams', takes: 1 }],
    });
    expect(errs.filter((e) => /mayor/.test(e))).toHaveLength(2);
    const all = items({ ...SPEC, LINES: [...LINES, { speaker: 'ROBO-HALSEMA', text: 'ORDE!', say: 'Orde!', lang: 'nl', group: 'mission:ams', takes: 1 }] });
    expect(all.some((i) => i.id === 'orde')).toBe(false);
  });

  it('names items by id slug, voice key and speaker', () => {
    expect(slug('ams/bell')).toBe('ams-bell');
    expect(items(SPEC).map((i) => pickKey(i.kind, i.id))).toEqual([
      'sfx:ui/confirm',
      'sfx:ams/bell',
      'sfx:env/canal',
      'music:ams',
      'voice:GRAMPS',
      'voice:VENDOR',
      'line:hoi-welkom-bij-fabel-friet',
      'line:keep-low-cygnets',
    ]);
    expect(voiceKey(LINES[1].text)).toBe('keep-low-cygnets');
    expect(selectItems(items(SPEC), ['sfx'], ['ams-bell']).map((i) => i.id)).toEqual(['ams/bell']);
  });
});

// ------------------------------------------------------------------------------------------ requests

describe('request building', () => {
  it('sound effects', () => {
    expect(sfxRequest(SFX[1])).toEqual({
      method: 'POST',
      path: '/v1/sound-generation?output_format=mp3_44100_128',
      body: { text: SFX[1].prompt, model_id: 'eleven_text_to_sound_v2', duration_seconds: 1.5, loop: false, prompt_influence: 0.6 },
      expect: 'audio',
    });
    expect(sfxRequest(SFX[2]).body).toMatchObject({ loop: true, duration_seconds: 10 });
    expect(sfxRequest(SFX[0]).body).not.toHaveProperty('prompt_influence');
  });

  it('music, with and without the model id', () => {
    expect(musicRequest(MUSIC[0]).body).toEqual({ prompt: MUSIC[0].prompt, music_length_ms: 90000, force_instrumental: true, model_id: 'music_v2_5' });
    expect(musicRequest(MUSIC[0], false).body).not.toHaveProperty('model_id');
  });

  it('voice design and lines', () => {
    expect(designRequest(VOICES[0]).body).toEqual({ voice_description: VOICES[0].description, model_id: 'eleven_ttv_v3', text: PREVIEW });
    const r = lineRequest(LINES[0], 'abc/123');
    expect(r.path).toBe('/v1/text-to-speech/abc%2F123?output_format=mp3_44100_128');
    expect(r.body).toEqual({ text: LINES[0].say, model_id: 'eleven_v3', language_code: 'nl' });
    expect(lineRequest(LINES[1], 'v').body).toMatchObject({ language_code: 'en' });
  });

  it('credit estimates', () => {
    expect(creditsPerTake('sfx', SFX[1])).toBe(60);
    expect(creditsPerTake('music', MUSIC[0])).toBe(1350);
    expect(creditsPerTake('line', LINES[0])).toBe(LINES[0].say.length);
    expect(creditsPerTake('voice', VOICES[0])).toBe(PREVIEW.length);
  });

  it('reads the key from .env.local by a manual parse', () => {
    expect(parseEnv('# c\nexport A=1\nB = "two words"\nC=x # note\n\nD=\'q\'')).toEqual({ A: '1', B: 'two words', C: 'x', D: 'q' });
    writeFileSync(join(root, '.env.local'), 'OTHER=1\nELEVENLABS_API_KEY=sk_test_123\n');
    expect(readApiKey(root)).toBe('sk_test_123');
    expect(() => readApiKey(join(root, 'nowhere'))).toThrow(/\.env\.local not found/);
  });
});

// ------------------------------------------------------------------------------------------ planning

describe('idempotent planning', () => {
  it('skips takes that already exist; --takes and --force override', () => {
    touch(join(p.raw, 'sfx/ui-confirm/take-1.mp3'));
    const sel = selectItems(items(SPEC), ['sfx'], ['ui/confirm']);
    expect(planJobs(sel, p).jobs.map((j) => j.takes[0])).toEqual([2, 3]);
    expect(planJobs(sel, p).existing).toBe(1);
    expect(planJobs(sel, p, { takes: 1 }).jobs).toEqual([]);
    expect(planJobs(sel, p, { force: true }).jobs.map((j) => j.takes[0])).toEqual([1, 2, 3]);
    for (const n of [2, 3]) touch(join(p.raw, `sfx/ui-confirm/take-${n}.mp3`));
    const done = planJobs(sel, p);
    expect(done.jobs).toEqual([]);
    expect(done.skipped).toEqual([{ kind: 'sfx', id: 'ui/confirm', reason: '3 takes exist' }]);
  });

  it('--regen adds fresh takes to flagged items only', () => {
    for (const n of [1, 2, 3]) touch(join(p.raw, `sfx/ui-confirm/take-${n}.mp3`));
    for (const n of [1, 2]) touch(join(p.raw, `sfx/ams-bell/take-${n}.mp3`));
    touch(p.notes, JSON.stringify({ notes: {}, regen: { 'sfx:ui/confirm': true } }));
    const plan = planJobs(selectItems(items(SPEC), ['sfx'], null), p, { regen: true });
    expect(plan.jobs.map((j) => `${j.id}#${j.takes[0]}`)).toEqual(['ui/confirm#4', 'ui/confirm#5', 'ui/confirm#6', 'env/canal#1']);
    clearRegen(p, ['sfx:ui/confirm']);
    expect(JSON.parse(readFileSync(p.notes, 'utf8')).regen).toEqual({});
  });

  it('lines wait for a saved voice; designs run once per speaker', () => {
    const plan = planJobs(selectItems(items(SPEC), ['line', 'voice'], null), p);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      'no saved voice for VENDOR (run design, then design-save)',
      'no saved voice for GRAMPS (run design, then design-save)',
    ]);
    expect(plan.jobs.map((j) => `${j.kind}:${j.id}:${j.takes.join(',')}`)).toEqual(['voice:GRAMPS:1,2,3', 'voice:VENDOR:1,2,3']);

    touch(p.voices, JSON.stringify({ VENDOR: { voice_id: 'vv1', name: 'x', generated_voice_id: 'g', preview: 1, savedAt: '' } }));
    touch(join(rawDir(p, 'voice', 'GRAMPS'), 'preview-1.mp3'));
    const plan2 = planJobs(selectItems(items(SPEC), ['line', 'voice'], null), p);
    expect(plan2.jobs.map((j) => `${j.kind}:${j.id}:${j.takes.join(',')}`)).toEqual([
      'voice:VENDOR:1,2,3',
      'line:hoi-welkom-bij-fabel-friet:1',
      'line:hoi-welkom-bij-fabel-friet:2',
      'line:hoi-welkom-bij-fabel-friet:3',
    ]);
    expect(plan2.jobs[1].request.path).toBe('/v1/text-to-speech/vv1?output_format=mp3_44100_128');
  });
});

// ------------------------------------------------------------------------------------------ mocked run

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

function mockFetch(handler: (c: Call, n: number) => { status: number; body?: string | Uint8Array; headers?: Record<string, string> }): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const c: Call = { url, method: init.method, headers: init.headers, body: init.body ? (JSON.parse(init.body) as Record<string, unknown>) : null };
    calls.push(c);
    const r = handler(c, calls.length);
    const bytes = typeof r.body === 'string' ? new TextEncoder().encode(r.body) : (r.body ?? new Uint8Array());
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (h: string) => r.headers?.[h] ?? null },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      text: async () => new TextDecoder().decode(bytes),
    };
  };
  return { fetch, calls };
}

describe('generation run (mocked fetch)', () => {
  const KEY = 'sk_secret_never_logged';

  it('writes takes and metas, retries a 429, logs credits to the ledger, never writes the key', async () => {
    let used = 1000;
    let sfxCalls = 0;
    const { fetch, calls } = mockFetch((c) => {
      if (c.url.endsWith('/v1/user/subscription')) return { status: 200, body: JSON.stringify({ character_count: used, character_limit: 100000, tier: 'creator' }) };
      if (c.url.includes('/v1/sound-generation')) {
        sfxCalls++;
        if (sfxCalls === 1) return { status: 429, body: '{"detail":"too_many_concurrent_requests"}' };
        used += 40;
        return { status: 200, body: new Uint8Array([0xff, 0xfb, 1, 2]), headers: { 'request-id': `r${sfxCalls}` } };
      }
      return { status: 404, body: 'no' };
    });
    const sleeps: number[] = [];
    const client = createClient({ key: KEY, fetch, sleep: async (ms) => void sleeps.push(ms), backoffMs: 10 });
    const plan = planJobs(selectItems(items(SPEC), ['sfx'], ['ams/bell']), p);
    const log: string[] = [];
    const res = await runJobs(plan.jobs, client, p, { log: (s) => log.push(s) });

    expect(res).toEqual({ done: 2, failed: [] });
    expect(sleeps).toHaveLength(1);
    expect(calls.filter((c) => c.url.includes('sound-generation'))).toHaveLength(3);
    expect(calls.every((c) => c.headers['xi-api-key'] === KEY)).toBe(true);
    expect(calls[1].url).toBe('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128');
    const dir = join(p.raw, 'sfx/ams-bell');
    expect(readdirSync(dir).sort()).toEqual(['take-1.json', 'take-1.mp3', 'take-2.json', 'take-2.mp3']);
    expect([...readFileSync(join(dir, 'take-1.mp3'))]).toEqual([0xff, 0xfb, 1, 2]);
    const meta = JSON.parse(readFileSync(join(dir, 'take-2.json'), 'utf8'));
    expect(meta).toMatchObject({ kind: 'sfx', id: 'ams/bell', take: 2, bytes: 4, body: { duration_seconds: 1.5 } });

    const ledger = readFileSync(p.ledger, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(ledger[0]).toMatchObject({ event: 'batch-start', requests: 2, estimate: 120, credits: { used: 1000, limit: 100000 } });
    expect(ledger.at(-1)).toMatchObject({ event: 'batch-end', done: 2, failed: 0, spent: 80 });
    for (const f of [p.ledger, join(dir, 'take-1.json'), join(dir, 'take-2.json')]) expect(readFileSync(f, 'utf8')).not.toContain(KEY);
    expect(log.join('\n')).not.toContain(KEY);

    // A second run finds nothing to do.
    expect(planJobs(selectItems(items(SPEC), ['sfx'], ['ams/bell']), p).jobs).toEqual([]);
  });

  it('falls back to the default music model, saves design previews, reports failures', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const b64 = Buffer.from(audio).toString('base64');
    const { fetch, calls } = mockFetch((c) => {
      if (c.url.endsWith('/v1/user/subscription')) return { status: 401, body: '{"detail":{"status":"missing_permissions"}}' };
      if (c.url.includes('/v1/music')) {
        if (c.body?.model_id) return { status: 422, body: '{"detail":"invalid model_id music_v2_5"}' };
        return { status: 200, body: audio };
      }
      if (c.url.includes('/v1/text-to-voice/design'))
        return { status: 200, body: JSON.stringify({ previews: [1, 2, 3].map((n) => ({ audio_base_64: b64, generated_voice_id: `gen${n}`, duration_secs: 4 })) }) };
      if (c.url.includes('/v1/sound-generation')) return { status: 400, body: `{"detail":"bad prompt for key ${KEY}"}` };
      return { status: 404 };
    });
    const client = createClient({ key: KEY, fetch, sleep: async () => {}, backoffMs: 1 });
    const sel = selectItems(items(SPEC), null, ['music:ams', 'voice:GRAMPS', 'sfx:env/canal']);
    const res = await runJobs(planJobs(sel, p).jobs, client, p, { log: () => {} });
    expect(res.done).toBe(2 + 3);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].error).toMatch(/HTTP 400/);
    expect(res.failed[0].error).not.toContain(KEY);
    expect(readdirSync(join(p.raw, 'music/ams')).filter((f) => f.endsWith('.mp3')).sort()).toEqual(['take-1.mp3', 'take-2.mp3']);
    expect(calls.filter((c) => c.url.includes('/v1/music') && !c.body?.model_id).length).toBe(2);
    expect(JSON.parse(readFileSync(join(rawDir(p, 'voice', 'GRAMPS'), 'preview-3.json'), 'utf8')).generated_voice_id).toBe('gen3');
    const ledger = readFileSync(p.ledger, 'utf8');
    expect(ledger).toContain('"error":"HTTP 401"');
    expect(ledger).not.toContain(KEY);
  });

  it('the pool keeps at most n requests in flight', async () => {
    let live = 0;
    let most = 0;
    const out = await pool([1, 2, 3, 4, 5], 2, async (n) => {
      live++;
      most = Math.max(most, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(most).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------ DSP

describe('loudness and loop maths', () => {
  const sine = (hz: number, amp: number, seconds: number, fs: number): Float32Array => {
    const s = new Float32Array(Math.round(seconds * fs));
    for (let i = 0; i < s.length; i++) s[i] = amp * Math.sin((2 * Math.PI * hz * i) / fs);
    return s;
  };

  it('a full-scale 997 Hz sine reads −3.01 LUFS (BS.1770)', () => {
    expect(momentaryMax([sine(997, 1, 2, 48000)], 48000)).toBeCloseTo(-3.01, 1);
    expect(integrated([sine(997, 1, 2, 48000)], 48000)).toBeCloseTo(-3.01, 1);
    expect(integrated([sine(997, 0.5, 2, 48000), sine(997, 0.5, 2, 48000)], 48000)).toBeCloseTo(-6.02, 1);
  });

  it('loops cut to whole bars, rounded to 4-bar phrases', () => {
    expect(musicLoop(90, 150, 4, 2, 0.2)).toEqual({ loopStart: 3.2, loopEnd: 3.2 + 52 * 1.6, bars: 52 });
    expect(musicLoop(10, 120, 4, 1, 0.2)).toEqual({ loopStart: 2, loopEnd: 8, bars: 3 });
    expect(musicLoop(3, 120, 4, 1, 0.2)).toBeNull();
  });

  it('the seam blends the continuation into the head', () => {
    const ramp = new Float32Array(100).map((_, i) => i);
    const [o] = loopSeam([ramp], 10, 60, 8);
    expect(o.length).toBe(60);
    expect(o[9]).toBe(9); // the intro stays as it was
    expect(o[10]).toBeGreaterThan(55); // the seam starts as the audio after loopEnd (60)...
    expect(o[17]).toBeLessThan(25); // ...and ends as the head itself (17)
    expect(o[18]).toBe(18);
    expect(o[59]).toBe(59);
  });

  it('finds the sound inside silence', () => {
    const s = new Float32Array(1000);
    s.fill(0.5, 300, 600);
    expect(soundRange([s], 1000, -40, 10, 20)).toEqual([290, 620]);
  });
});

const FF = hasFfmpeg();

describe.skipIf(!FF)('process (ffmpeg)', () => {
  const make = (file: string, args: string[]): void => {
    mkdirSync(join(file, '..'), { recursive: true });
    const r = spawnSync(FFMPEG, ['-v', 'error', '-y', ...args, '-c:a', 'libmp3lame', '-b:a', '128k', file]);
    expect(r.status, r.stderr?.toString()).toBe(0);
  };

  it('trims, fades, levels and caps an sfx take', () => {
    const raw = join(p.raw, 'sfx/ui-confirm/take-1.mp3');
    make(raw, ['-f', 'lavfi', '-i', 'sine=frequency=660:duration=1.2', '-af', 'adelay=300,volume=0.3', '-ac', '1']);
    const out = join(p.cand, 'sfx/ui-confirm/take-1.mp3');
    const m = processTake('sfx', 'ui/confirm', SFX[0], 1, raw, out, { target: -18 });
    expect(m.channels).toBe(1);
    expect(m.duration).toBeLessThanOrEqual(0.8 + 1e-6); // trimTo
    expect(m.duration).toBeGreaterThan(0.75);
    expect(m.lufs).toBeCloseTo(-18, 0);
    expect(m.peak).toBeLessThanOrEqual(0.9);
    expect(m.loopEnd).toBeNull();
    expect(JSON.parse(readFileSync(out.replace('.mp3', '.json'), 'utf8')).take).toBe(1);
    const back = decode(out, 1)[0];
    expect(Math.abs(back[0])).toBeLessThan(0.05); // fade-in, no click
  });

  it('cuts a music loop to whole bars with loop points', () => {
    const raw = join(p.raw, 'music/ams/take-1.mp3');
    make(raw, ['-f', 'lavfi', '-i', 'sine=frequency=220:duration=10', '-ac', '2']);
    const spec: MusicSpec = { ...MUSIC[0], seconds: 10, bpm: 120, introBars: 1 };
    const m = processTake('music', 'ams', spec, 1, raw, join(p.cand, 'music/ams/take-1.mp3'));
    expect(m.channels).toBe(2);
    expect(m.loopStart).toBeCloseTo(2, 2);
    expect(m.loopEnd).toBeCloseTo(8, 2);
    expect(m.duration).toBeCloseTo(8, 2);
    expect(m.lufs).toBeCloseTo(-16, 0);
  });

  it('band-passes a radio line and warns when it runs long', () => {
    const raw = join(p.raw, 'line/keep-low-cygnets/take-1.mp3');
    make(raw, ['-f', 'lavfi', '-i', 'anoisesrc=d=4:c=pink:a=0.3', '-ac', '1']);
    const m = processTake('line', 'keep-low-cygnets', LINES[1], 1, raw, join(p.cand, 'line/keep-low-cygnets/take-1.mp3'), { radio: true });
    expect(m.warnings).toContain('longer than maxSeconds 3 s');
    expect(m.lufs).toBeLessThan(-14.5); // −15 LUFS, or lower when the peak ceiling holds it back
    expect(m.lufs).toBeGreaterThan(-20);
  });
});

// ------------------------------------------------------------------------------------------ review

describe('review page', () => {
  it('lists every item, with "not generated" when there are no takes', () => {
    const list = reviewItems(items(SPEC), p, { hasSfx: (id) => id === 'ui/confirm' });
    expect(list).toHaveLength(8);
    expect(list.every((i) => i.candidates.length === 0)).toBe(true);
    expect(list[0].synth).toBe('/synth/ui-confirm.wav');
    expect(list[1].synth).toBeNull();
    expect(list.find((i) => i.kind === 'line')?.text).toBe('HOI! WELKOM BIJ\nFABEL FRIET!');
  });

  it('serves the page and items, saves picks clipped to keep', async () => {
    touch(join(p.raw, 'sfx/ams-bell/take-1.mp3'));
    touch(join(p.cand, 'sfx/ams-bell/take-2.mp3'));
    touch(join(p.cand, 'sfx/ams-bell/take-2.json'), JSON.stringify({ duration: 1.1, lufs: -20, target: -20, peak: 0.5, loopStart: null, loopEnd: null, warnings: [] }));
    const server = createReviewServer({ spec: SPEC, p, synth: null });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const page = await (await fetch(`${base}/`)).text();
      expect(page).toContain('<title>Audio Review</title>');
      const data = (await (await fetch(`${base}/api/items`)).json()) as { items: { key: string; candidates: { take: number; processed: boolean; url: string }[] }[] };
      const bell = data.items.find((i) => i.key === 'sfx:ams/bell');
      expect(bell?.candidates.map((c) => [c.take, c.processed])).toEqual([[1, false], [2, true]]);
      expect((await fetch(`${base}${bell?.candidates[1].url}`)).status).toBe(200);
      expect((await fetch(`${base}/a/..%2F..%2Fetc%2Fpasswd`)).status).toBe(404);

      const post = await fetch(`${base}/api/state`, {
        method: 'POST',
        body: JSON.stringify({ picks: { 'sfx:ui/confirm': [3, 1], 'music:ams': [1], 'sfx:nope': [1] }, notes: { 'music:ams': 'too slow', 'sfx:ams/bell': ' ' }, regen: { 'music:ams': true } }),
      });
      expect(post.status).toBe(200);
      expect(JSON.parse(readFileSync(p.picks, 'utf8'))).toEqual({ 'music:ams': [1], 'sfx:ui/confirm': [1] });
      // Another web page may not overwrite the picks while the server runs.
      const evil = await fetch(`${base}/api/state`, { method: 'POST', headers: { origin: 'http://evil.example' }, body: JSON.stringify({ picks: {} }) });
      expect(evil.status).toBe(403);
      expect(JSON.parse(readFileSync(p.picks, 'utf8'))).toEqual({ 'music:ams': [1], 'sfx:ui/confirm': [1] });
      expect(JSON.parse(readFileSync(p.notes, 'utf8'))).toEqual({ notes: { 'music:ams': 'too slow' }, regen: { 'music:ams': true } });
    } finally {
      await new Promise<void>((ok) => server.close(() => ok()));
    }
  });
});

// ------------------------------------------------------------------------------------------ ship

describe('ship', () => {
  const cand = (kind: string, dir: string, take: number, meta: Record<string, unknown>): void => {
    touch(join(p.cand, kind, dir, `take-${take}.mp3`), `${kind}/${dir}/${take}`);
    touch(join(p.cand, kind, dir, `take-${take}.json`), JSON.stringify({ loopStart: null, loopEnd: null, warnings: [], ...meta }));
  };

  it('copies picks to public/audio and writes a deterministic manifest', () => {
    cand('sfx', 'ui-confirm', 2, { duration: 0.6 });
    cand('sfx', 'ams-bell', 1, { duration: 1.2 });
    cand('sfx', 'ams-bell', 2, { duration: 1.1 });
    cand('sfx', 'env-canal', 1, { duration: 8, loopStart: 0, loopEnd: 8 });
    cand('music', 'ams', 2, { duration: 86.4, loopStart: 3.2, loopEnd: 86.4 });
    cand('line', 'hoi-welkom-bij-fabel-friet', 1, { duration: 1.9 });
    touch(join(p.publicAudio, 'ams/sfx/old-sound-1.mp3'));
    touch(join(p.publicAudio, 'm1/keep-me.mp3'));
    const picks = {
      'sfx:ui/confirm': [2],
      'sfx:ams/bell': [2, 1],
      'sfx:env/canal': [1],
      'music:ams': [2],
      'line:hoi-welkom-bij-fabel-friet': [1],
      'voice:GRAMPS': [2],
    };
    const plan = planShip(items(SPEC), picks, p);
    expect(plan.errors).toEqual([]);
    const r = applyShip(plan, p);
    expect(r.copied).toBe(6);
    expect(r.removed).toEqual(['public/audio/ams/sfx/old-sound-1.mp3']);
    expect(existsSync(join(p.publicAudio, 'm1/keep-me.mp3'))).toBe(true);
    expect(readFileSync(join(p.publicAudio, 'ams/sfx/ams-bell-1.mp3'), 'utf8')).toBe('sfx/ams-bell/1');
    expect(readFileSync(join(p.publicAudio, 'ams/voice/hoi-welkom-bij-fabel-friet-1.mp3'), 'utf8')).toBe('line/hoi-welkom-bij-fabel-friet/1');

    const text = readFileSync(p.manifest, 'utf8');
    expect(text).toBe(
      [
        '// AUTO-GENERATED by tools/audio/ship.ts (npm run audio:ship). Do not edit by hand:',
        '// pick takes on the review page (npm run audio:review), then ship again.',
        "import type { SampleGroup } from '../../../engine/samples';",
        '',
        '/** Sampled audio by group (see src/engine/samples.ts). Paths are relative to public/audio/. */',
        'export const SAMPLE_MANIFEST: Readonly<Record<string, SampleGroup>> = {',
        "  'boot': {",
        '    sfx: {',
        "      'ui/confirm': { files: ['boot/sfx/ui-confirm-1.mp3'] },",
        '    },',
        '    music: {',
        '    },',
        '    voice: {',
        '    },',
        '  },',
        "  'mission:ams': {",
        '    sfx: {',
        "      'ams/bell': { files: ['ams/sfx/ams-bell-1.mp3', 'ams/sfx/ams-bell-2.mp3'] },",
        "      'env/canal': { files: ['ams/sfx/env-canal-1.mp3'], loopStart: 0, loopEnd: 8 },",
        '    },',
        '    music: {',
        "      'ams': { file: 'ams/music/ams-1.mp3', loopStart: 3.2, loopEnd: 86.4, duration: 86.4 },",
        '    },',
        '    voice: {',
        "      'hoi-welkom-bij-fabel-friet': { files: ['ams/voice/hoi-welkom-bij-fabel-friet-1.mp3'], duration: 1.9 },",
        '    },',
        '  },',
        '};',
        '',
      ].join('\n'),
    );
    const again = applyShip(planShip(items(SPEC), picks, p), p);
    expect(again).toMatchObject({ copied: 0, unchanged: 6, removed: [] });
    expect(readFileSync(p.manifest, 'utf8')).toBe(text);
  });

  it('refuses picks over keep, missing candidates and mismatched loop takes', () => {
    cand('sfx', 'ui-confirm', 1, { duration: 0.6 });
    cand('sfx', 'ui-confirm', 2, { duration: 0.6 });
    const plan = planShip(items(SPEC), { 'sfx:ui/confirm': [1, 2], 'music:ams': [1] }, p);
    expect(plan.errors).toEqual(['sfx:ui/confirm: 2 takes picked, keep is 1', 'music:ams: candidate take 1 is missing (run tools/audio/process.ts)']);
    expect(() => applyShip(plan, p)).toThrow(/ship refused/);
    const spec2: Spec = { ...SPEC, SFX: [{ ...SFX[2], keep: 2, takes: 2 }] };
    cand('sfx', 'env-canal', 1, { duration: 8, loopStart: 0, loopEnd: 8 });
    cand('sfx', 'env-canal', 2, { duration: 7, loopStart: 0, loopEnd: 7 });
    expect(planShip(items(spec2), { 'sfx:env/canal': [1, 2] }, p).errors[0]).toMatch(/share their loop points/);
  });

  it('warns about picks that match no spec item (a changed line text) and skips them', () => {
    const plan = planShip(items(SPEC), { 'line:reload': [1], 'sfx:nope': [], 'music:ams': [] }, p);
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual(['line:reload: picked, but no such item in tools/audio/spec.ts (a changed line text?); skipped']);
  });

  it('the review server only takes state from its own page', () => {
    expect(sameOrigin('127.0.0.1:4300', undefined)).toBe(true);
    expect(sameOrigin('localhost:4300', 'http://localhost:4300')).toBe(true);
    expect(sameOrigin('127.0.0.1:4300', 'http://evil.example')).toBe(false);
    expect(sameOrigin('evil.example:4300', undefined)).toBe(false);
    expect(sameOrigin(undefined, undefined)).toBe(false);
  });

  it('an empty pick list gives empty groups', () => {
    expect(renderManifest(planShip(items(SPEC), {}, p).groups)).toContain("  'mission:ams': {\n    sfx: {\n    },");
  });
});
