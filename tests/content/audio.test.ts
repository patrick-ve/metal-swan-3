/**
 * Sound effects and songs of the content slice: every recipe renders, loudness stays in one
 * family (peak / RMS), every sound the game layer plays exists, songs parse and loop at the
 * intended lengths.
 */
import { describe, expect, it } from 'vitest';
import { hasSong, songError } from '../../src/engine/music';
import { parseSong, songLength } from '../../src/engine/music';
import { getSfxRecipe, hasSfx, renderSfx, SAMPLE_RATE } from '../../src/engine/synth';
import { bars, CUES, JINGLES, SONGS } from '../../src/game/content/music/index';
import { ENEMY_DIE_SFX, SFX, SFX_ALIASES } from '../../src/game/content/sfx/index';

/** Peak, and RMS in dB over the audible part (until the level stays below −40 dB). */
function levels(s: Float32Array): { peak: number; rmsDb: number; seconds: number; finite: boolean } {
  let peak = 0;
  let last = 0;
  let finite = true;
  const quiet = Math.pow(10, -40 / 20);
  for (let i = 0; i < s.length; i++) {
    const a = Math.abs(s[i]);
    if (!Number.isFinite(a)) finite = false;
    if (a > peak) peak = a;
    if (a > quiet) last = i;
  }
  let sq = 0;
  const n = Math.max(1, last + 1);
  for (let i = 0; i < n; i++) sq += s[i] * s[i];
  return { peak, rmsDb: 20 * Math.log10(Math.sqrt(sq / n) || 1e-9), seconds: s.length / SAMPLE_RATE, finite };
}

describe('sound effects', () => {
  const ids = Object.keys(SFX);

  it('defines the full set (task list + GDD ids of the same categories)', () => {
    expect(ids.length).toBeGreaterThanOrEqual(90);
  });

  it.each(ids)('%s renders with sane levels', (id) => {
    const s = renderSfx(id);
    expect(s).not.toBeNull();
    const l = levels(s as Float32Array);
    expect(l.finite).toBe(true);
    expect(l.seconds).toBeLessThan(3);
    expect(l.peak, `${id} peak`).toBeGreaterThan(0.18);
    expect(l.peak, `${id} peak`).toBeLessThanOrEqual(0.985);
    expect(l.rmsDb, `${id} rms`).toBeGreaterThan(-26);
    expect(l.rmsDb, `${id} rms`).toBeLessThan(-9.5);
  });

  it('aliases share the recipe of their target', () => {
    for (const [alias, id] of Object.entries(SFX_ALIASES)) {
      expect(hasSfx(alias), alias).toBe(true);
      expect(getSfxRecipe(alias)).toBe(SFX[id]);
    }
  });

  it('every sound the game layer and the slice play is defined', () => {
    const used = [
      'player/jump', 'player/land', 'player/die', 'player/respawn', 'player/spawn',
      'weapon/pistol', 'weapon/mg', 'weapon/machine-gun', 'weapon/vulcan', 'weapon/cannon', 'weapon/knife', 'weapon/empty',
      'weapon/rocket', 'weapon/shotgun', 'weapon/flame', 'weapon/laser', 'weapon/grenade-throw',
      'bomb/throw', 'bomb/bounce', 'explosion/s', 'explosion/m', 'explosion/l', 'explosion/xl',
      'hit/enemy', 'hit/metal', 'hit/ground', 'hit/armor',
      'vehicle/enter', 'vehicle/exit', 'vehicle/hit', 'vehicle/cannon', 'vehicle/mount', 'vehicle/eject',
      'item/pickup', 'item/weapon', 'item/bomb', 'item/bombs', 'item/score', 'item/food', 'item/gem', 'crate/break', 'item/crate-break',
      'hostage/free', 'hostage/give', 'enemy/alert', 'enemy/shot', 'enemy/aim', 'enemy/aria', 'enemy/panic', 'enemy/windup', 'enemy/grenade',
      ...ENEMY_DIE_SFX, 'enemy/die',
      'ui/move', 'ui/confirm', 'ui/cancel', 'ui/pause', 'ui/coin', 'ui/tally', 'ui/warning', 'ui/go', 'ui/alarm',
      'boss/warning', 'boss/part-break',
    ];
    expect(used.filter((id) => !hasSfx(id))).toEqual([]);
  });

  it('renders deterministically (same id → same samples)', () => {
    const a = renderSfx('explosion/m') as Float32Array;
    const b = renderSfx('explosion/m') as Float32Array;
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(1000);
  });
});

describe('songs', () => {
  it.each(Object.keys(SONGS))('%s parses and is registered without errors', (id) => {
    expect(hasSong(id)).toBe(true);
    expect(songError(id)).toBeNull();
    const p = parseSong(SONGS[id], id);
    expect(p.notes.length).toBeGreaterThan(300);
    expect(p.loopRow).not.toBeNull();
    for (const n of p.notes) if (!n.drum) expect(n.midi >= 24 && n.midi <= 96, `note ${n.midi}`).toBe(true);
  });

  /** Loop length of a parsed song in seconds (from the loop row to the end). */
  const loopSecs = (p: ReturnType<typeof parseSong>): number => (p.totalRows - (p.loopRow ?? 0)) * p.rowDur;
  /** Seconds of `n` 4/4 bars at `bpm`. */
  const barSecs = (n: number, bpm: number): number => (n * 4 * 60) / bpm;

  it('title loops over the GDD form (A 16 + B 8 + A′ 8 at 112 bpm ≈ 68.6 s), m0 in 20–60 s', () => {
    const t = parseSong(SONGS.title, 'title');
    const m = parseSong(SONGS.m0, 'm0');
    expect(loopSecs(t)).toBeCloseTo(barSecs(32, 112), 3);
    expect(songLength(t)).toBeCloseTo(barSecs(40, 112), 3);
    expect(loopSecs(m)).toBeGreaterThanOrEqual(20);
    expect(loopSecs(m)).toBeLessThanOrEqual(60);
  });

  it('the boss song loops over the GDD form (A 16 + B 16 + C 8 at 156 bpm ≈ 61.5 s)', () => {
    const b = parseSong(SONGS.boss, 'boss');
    expect(loopSecs(b)).toBeCloseTo(barSecs(40, 156), 3);
    expect(songLength(b)).toBeCloseTo(barSecs(44, 156), 3);
  });

  it.each(Object.keys(CUES))('cue %s parses, loops and climbs (one bar per transposed slot)', (id) => {
    expect(hasSong(id)).toBe(true);
    expect(songError(id)).toBeNull();
    const p = parseSong(CUES[id], id);
    expect(p.loopRow).not.toBeNull();
    expect(songLength(p)).toBeGreaterThanOrEqual(8);
    expect(songLength(p)).toBeLessThanOrEqual(12);
  });

  it.each(Object.keys(JINGLES))('jingle %s parses and plays once in 4–8 s', (id) => {
    expect(hasSong(id)).toBe(true);
    expect(songError(id)).toBeNull();
    const p = parseSong(JINGLES[id], id);
    expect(p.loopRow).toBeNull();
    expect(songLength(p)).toBeGreaterThanOrEqual(4);
    expect(songLength(p)).toBeLessThanOrEqual(8);
  });

  it('every song the game layer asks for exists (boss, continue, game-over, mission-complete)', () => {
    for (const id of ['title', 'boss', 'continue', 'game-over', 'mission-complete']) expect(hasSong(id), id).toBe(true);
  });

  it('bars() rejects a bar that is not 16 rows long', () => {
    expect(() => bars('C4 - - -')).toThrow(/expected 16/);
    expect(bars('C4 - - - - - - - - - - - - - - -').split(/\s+/).length).toBe(16);
  });
});
