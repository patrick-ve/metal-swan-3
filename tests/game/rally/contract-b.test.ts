/**
 * The wave-B contracts of mission `rally` (docs/api/rally.md "B. Wave B contracts", PREP): the time
 * of day, the matrix signs, the bodies' kinds and lamps, the wave-B events, the score and its tally
 * lines, the plug-in registries of the lazy content (systems, teams, scenery, HUD parts) and PREP's
 * working stubs (the start gantry's countdown, one traffic car, a speed camera's fine with its HUD
 * warning, the score in the tally).
 */
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/engine/events';
import { InputManager } from '../../../src/engine/input';
import type { TextOpts } from '../../../src/engine/render';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { loadContent } from '../../../src/game/content/index';
import { LED, signTex } from '../../../src/game/content/rally/signs/page';
import type { CarState, RallyEventsB } from '../../../src/game/rally/api';
import { CLOCK_START, clockText, DAY_KEYS, daylight, newDaylight, raceProgress } from '../../../src/game/rally/daylight';
import { BODY_KINDS, BODY_LIGHT, PAGE_IDS, RALLY_EVENTS } from '../../../src/game/rally/ids';
import { defineRallyHud, defineRallyScenery, defineRallySystem, defineRallyTeams, rallyHud, rallyScenery, rallySystems, rallyTeams, rallyTrack, undefineRally } from '../../../src/game/rally/registry';
import { RallyRunner, RIVAL_SPECS } from '../../../src/game/rally/runner';
import { BEST_LAP_POINTS, FINE_POINTS, NEAR_MISS_POINTS, OVERTAKE_POINTS, PLACE_POINTS, raceLines, ScoreBook, TEAM_POINTS } from '../../../src/game/rally/score';
import { countdownSign, GO_SIGN_TICKS, SIGN_LANES, SIGN_STATES, signLimit, SignTable, startGantry } from '../../../src/game/rally/signs';
import { loadRallyContent } from '../../../src/game/scenes/rally-route';
import { GameSession } from '../../../src/game/session';
import { createHeadlessRally } from '../../../src/sim/headless-rally';
import { race, ringTrack } from './helpers';

await loadContent();
await loadRallyContent();

class Recorder extends SoftRenderer {
  texts: string[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    this.texts.push(s);
    super.text(s, x, y, o);
  }
}

function runner(players: 1 | 2 = 1, seed = 1): RallyRunner {
  const input = new InputManager();
  const s = new GameSession({ characters: players === 2 ? ['recruit', 'vincent'] : ['recruit'], seed });
  const r = new RallyRunner({ seed, difficulty: 'normal', players, session: s, pads: [input.pad(0), input.pad(1)] });
  r.start();
  return r;
}

const lum = (c: readonly number[]): number => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;

describe('B.1 the time of day (daylight.ts)', () => {
  it('the clock runs 16:15 → 17:00 → 17:45 → 18:30 over the three laps', () => {
    expect(daylight(0).clock).toBe(CLOCK_START);
    expect(clockText(daylight(0).clock)).toBe('16:15');
    expect(clockText(daylight(1).clock)).toBe('17:00');
    expect(clockText(daylight(2).clock)).toBe('17:45');
    expect(clockText(daylight(3).clock)).toBe('18:30');
    expect(clockText(daylight(9).clock)).toBe('18:30');
  });

  it('the sky darkens smoothly, the night and the lamps rise, the car lights come on in lap 2', () => {
    let prevNight = -1;
    let prevSky = Infinity;
    for (let p = 0; p <= 3.0001; p += 0.05) {
      const d = daylight(p);
      expect(d.night).toBeGreaterThanOrEqual(prevNight);
      expect(lum(d.light.skyTop)).toBeLessThanOrEqual(prevSky + 1e-9);
      prevNight = d.night;
      prevSky = lum(d.light.skyTop);
      const n = d.light.sunDir;
      expect(Math.abs(n[0] * n[0] + n[1] * n[1] + n[2] * n[2] - 1)).toBeLessThan(1e-9);
    }
    expect(daylight(0).carLights).toBe(false);
    expect(daylight(0).lampGlow).toBe(0);
    expect(daylight(2).carLights).toBe(true);
    expect(daylight(3).night).toBe(1);
    // A small step makes a small change (no jumps).
    const a = daylight(1.49).light.fog;
    const b = daylight(1.5).light.fog;
    expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])).toBeLessThan(0.02);
  });

  it('writes `out` in place (no allocation per frame) and keeps the keys ascending', () => {
    const out = newDaylight();
    const light = out.light;
    const sky = light.skyTop;
    expect(daylight(1.2, out)).toBe(out);
    expect(out.light).toBe(light);
    expect(out.light.skyTop).toBe(sky);
    for (let i = 1; i < DAY_KEYS.length; i++) expect(DAY_KEYS[i].at).toBeGreaterThan(DAY_KEYS[i - 1].at);
  });

  it('raceProgress: the leading PLAYER in laps (0 on the grid; a ?lap=2 race starts at about 1)', () => {
    const h = race({ track: ringTrack() });
    expect(raceProgress(h.runner.race, h.runner.track.length)).toBe(0);
    h.car().dist = h.runner.track.length * 1.5;
    expect(raceProgress(h.runner.race, h.runner.track.length)).toBeCloseTo(1.5, 9);
    h.car().dist = h.runner.track.length * 5;
    expect(raceProgress(h.runner.race, h.runner.track.length)).toBe(3);
    const two = race({ track: ringTrack(), lap: 2 });
    expect(raceProgress(two.runner.race, two.runner.track.length)).toBeGreaterThan(0.99);
  });
});

describe('B.2 the matrix signs (signs.ts)', () => {
  it('SignTable: one sign per lane and the shoulder, set / get / version / clear', () => {
    const t = new SignTable(3);
    expect(SIGN_LANES).toBe(4);
    expect(t.sign(0, 0)).toBe('blank');
    expect(t.setSign(1, 2, 'x')).toBe(true);
    expect(t.setSign(1, 2, 'x')).toBe(false);
    expect(t.version).toBe(1);
    expect(t.sign(1, 2)).toBe('x');
    expect(t.setSign(5, 0, 'x')).toBe(false);
    expect(t.setSign(0, 4, 'x')).toBe(false);
    t.setGantry(2, 'limit-70');
    expect([0, 1, 2, 3].map((l) => t.sign(2, l))).toEqual(['limit-70', 'limit-70', 'limit-70', 'limit-70']);
    t.clear();
    expect(t.sign(1, 2)).toBe('blank');
    for (const s of SIGN_STATES) {
      t.setSign(0, 0, s);
      expect(t.sign(0, 0)).toBe(s);
    }
    expect(signLimit('limit-100')).toBe(100);
    expect(signLimit('x')).toBe(0);
  });

  it('the countdown: count-3, count-2, count-1, then go for a while, then blank', () => {
    expect(countdownSign(180, -1)).toBe('count-3');
    expect(countdownSign(120, -1)).toBe('count-2');
    expect(countdownSign(60, -1)).toBe('count-1');
    expect(countdownSign(1, -1)).toBe('count-1');
    expect(countdownSign(0, 0)).toBe('go');
    expect(countdownSign(0, GO_SIGN_TICKS)).toBe('blank');
  });

  it('the runner owns the table (race.signs, one row per gantry of the A10)', () => {
    const r = runner();
    const track = rallyTrack() as unknown as { gantries: unknown[] };
    expect(r.race.signs).toBe(r.signs);
    expect(r.signs.count).toBe(track.gantries.length);
    expect(startGantry(rallyTrack())).toBeGreaterThanOrEqual(0);
  });

  it('every sign state has a face on the signs page (WORLD\'s page; the stub faces are gone)', () => {
    const tex = signTex();
    expect(tex.page.id).toBe(PAGE_IDS.signs);
    for (const st of SIGN_STATES) {
      const r = tex.faces[st];
      expect(r.w).toBe(LED);
      expect(r.h).toBe(LED);
    }
  });
});

describe('B.3 bodies and B.4 events (ids.ts, api.ts)', () => {
  it('every wave-B event name is on the list', () => {
    const names = ['flash', 'fine', 'redx', 'pulledOver', 'released', 'policeActive', 'roadworksAhead', 'spitsstrookOpen', 'jam', 'overtake', 'nearMiss', 'lap', 'bestLap', 'place', 'tunnelIn', 'tunnelOut', 'finish', 'honk', 'crash'];
    for (const n of names) expect(RALLY_EVENTS).toContain(n);
  });

  it('the body kinds and the lamp bits', () => {
    expect([...BODY_KINDS]).toEqual(['player', 'rival', 'traffic', 'police', 'prop']);
    const bits = Object.values(BODY_LIGHT);
    expect(new Set(bits).size).toBe(bits.length);
    for (const b of bits) expect(b & (b - 1)).toBe(0);
  });
});

describe('B.5 the score (score.ts)', () => {
  it('the ScoreBook counts the overtake, nearMiss (≥ 150 km/h) and fine events', () => {
    const ev = new EventBus<RallyEventsB>();
    const book = new ScoreBook();
    const off = book.listen(ev);
    ev.emit('overtake', { car: 'white', slot: 0, other: 'rival-1' });
    ev.emit('nearMiss', { car: 'white', slot: 0, other: 'traffic-1', speed: 160 });
    ev.emit('nearMiss', { car: 'white', slot: 0, other: 'traffic-1', speed: 120 });
    ev.emit('fine', { car: 'white', slot: 0, kind: 'camera', euros: 90 });
    off();
    ev.emit('overtake', { car: 'white', slot: 0, other: 'rival-2' });
    expect(book.peek('white')).toEqual({ overtakes: 1, nearMisses: 1, finesEuros: 90 });
    expect(book.peek('green')).toBeNull();
  });

  it('every line of §9 with a book; wave A lines without one; TEAM in 2P; the fines never sink the total', () => {
    const car = { id: 'white', slot: 0, place: 2, finished: true, finishTicks: 20000, lapTicks: [7000, 6500, 6500], partLaps: 0, fines: 3 } as unknown as CarState;
    const mate = { ...car, id: 'green', slot: 1, place: 3 } as unknown as CarState;
    const book = new ScoreBook();
    for (let i = 0; i < 4; i++) book.overtake('white');
    book.nearMiss('white', 180);
    book.fine('white', 300);
    expect(raceLines({ parTicks: 24000, carCount: 8 }, car).map((l) => l.label.split(' ')[0])).toEqual(['PLACE', 'TIME']);
    const lines = raceLines({ parTicks: 24000, carCount: 8, parLapTicks: 7000, book, cars: [car] }, car);
    expect(lines.map((l) => l.points)).toEqual([PLACE_POINTS[1], 66 * 50, BEST_LAP_POINTS, 4 * OVERTAKE_POINTS, NEAR_MISS_POINTS, 3 * FINE_POINTS]);
    // The prize money (docs/design/oat.md §7.8): the joke euro column goes; FINES costs − € 120 each.
    expect(lines[5].label).toBe('FINES 3');
    expect(lines[5].cents).toBe(-36000);
    const two = raceLines({ parTicks: 24000, carCount: 8, parLapTicks: 7000, book, cars: [car, mate] }, car);
    expect(two[6]).toEqual({ label: 'TEAM', points: TEAM_POINTS, cents: 10000 });
    const poor = { ...car, place: 8, finishTicks: -1, lapTicks: [], fines: 40 } as unknown as CarState;
    const pl = raceLines({ parTicks: 24000, carCount: 8, parLapTicks: 7000, book: new ScoreBook(), cars: [poor] }, poor);
    expect(pl.reduce((a, l) => a + (l.points ?? 0), 0)).toBe(0);
  });
});

describe('B.6 the plug-ins (registry.ts) and the scene hooks', () => {
  it('systems install into every new runner in order; teams pick the rivals; undefine removes them', () => {
    const seen: string[] = [];
    defineRallySystem({ id: 'test/b', order: 999, install: () => seen.push('b') });
    defineRallySystem({ id: 'test/a', order: 998, install: () => seen.push('a') });
    const ids = rallySystems().map((d) => d.id);
    expect(ids.indexOf('traffic')).toBeLessThan(ids.indexOf('rules'));
    expect(ids.indexOf('rules')).toBeLessThan(ids.indexOf('test/a'));
    runner();
    expect(seen).toEqual(['a', 'b']);
    undefineRally('test/a');
    undefineRally('test/b');
    const was = rallyTeams();
    defineRallyTeams({ id: 'test/teams', rivals: () => [{ spec: { ...RIVAL_SPECS[0], id: 'oma', team: 'OMA TRUUS' }, pace: 0.9 }] });
    const r = runner();
    expect(r.cars.filter((c) => c.slot < 0).every((c) => c.team === 'OMA TRUUS')).toBe(true);
    expect(r.cars.length).toBe(8);
    undefineRally('test/teams');
    expect(rallyTeams()).toBeNull();
    if (was) defineRallyTeams(was);
  });

  it('scenery parts are built once per track; HUD parts are listed in order', () => {
    let builds = 0;
    defineRallyScenery({ id: 'test/scenery', order: 999, build: () => (builds++, { meshes: [], pages: [], fill: (_c, _o, k) => k }) });
    const track = rallyTrack();
    const a = rallyScenery(track);
    const b = rallyScenery(track);
    expect(builds).toBe(1);
    expect(a[a.length - 1]).toBe(b[b.length - 1]);
    undefineRally('test/scenery');
    defineRallyHud({ id: 'test/hud', order: 999, create: () => ({ draw: () => {} }) });
    expect(rallyHud().map((d) => d.id)).toContain('rules/hud');
    undefineRally('test/hud');
  });
});

describe("PREP's working stubs on the A10", () => {
  it('the start gantry counts down 3-2-1, then GO, then goes dark', () => {
    const r = runner();
    const g = startGantry(r.track);
    r.step();
    expect([0, 1, 2].map((l) => r.signs.sign(g, l))).toEqual(['count-3', 'count-3', 'count-3']);
    expect(r.signs.sign(g, 3)).toBe('blank');
    while (r.countdown > 30) r.step();
    expect(r.signs.sign(g, 0)).toBe('count-1');
    while (r.phase === 'grid') r.step();
    r.step();
    expect(r.signs.sign(g, 0)).toBe('go');
    for (let i = 0; i < GO_SIGN_TICKS + 5; i++) r.step();
    expect(r.signs.sign(g, 0)).toBe('blank');
  });

  it('the traffic (FIELD): pooled bodies of the race that drive in lanes at motorway speeds (and in the state hash)', () => {
    const r = runner();
    const traffic = r.bodies.slice(r.cars.length).filter((b) => b.kind === 'traffic');
    expect(traffic.length).toBeGreaterThan(10);
    const active = traffic.filter((b) => !b.hidden);
    expect(active.length).toBeGreaterThan(0);
    for (const t of active) expect(t.clutRow).toBeGreaterThanOrEqual(0);
    while (r.phase === 'grid') r.step();
    const h0 = r.stateHash();
    for (let i = 0; i < 300; i++) r.step();
    // The cars on the road drive at motorway speeds (80–110 km/h by lane; the heavy ones slower).
    const now = traffic.filter((b) => !b.hidden);
    expect(now.length).toBeGreaterThan(0);
    const kmh = now.map((b) => b.speed * 3.6);
    expect(kmh.filter((v) => v > 45 && v < 125).length).toBeGreaterThanOrEqual(Math.ceil(now.length * 0.8));
    expect(r.stateHash()).not.toBe(h0);
  });

  it('a speed camera fines a car above its limit: flash + fine events, CarState.fines, the book, the HUD warning', async () => {
    const h = await createHeadlessRally({ seed: 1 });
    try {
      const r = h.runner!;
      const events: string[] = [];
      r.events.on('flash', (e) => events.push(`flash ${e.car} ${e.limit} ${e.where}`));
      r.events.on('fine', (e) => events.push(`fine ${e.car} ${e.euros}`));
      const rec = new Recorder();
      let flitser = false;
      let boete = false;
      h.runUntil(() => {
        if (h.ticks % 20 === 0 && r.phase === 'race') {
          rec.texts.length = 0;
          h.scene!.draw(rec);
          if (rec.texts.some((t) => /^FLITSER( \d+)?$/.test(t))) flitser = true;
          if (rec.texts.some((s) => s.startsWith('BOETE EUR '))) boete = true;
        }
        return r.carOf(0)!.fines > 0 && boete;
      }, 12000);
      const car = r.carOf(0)!;
      expect(car.fines).toBeGreaterThan(0);
      expect(events.some((e) => e.startsWith('flash white '))).toBe(true);
      expect(events.some((e) => e.startsWith('fine white '))).toBe(true);
      expect(r.book.peek('white')!.finesEuros).toBeGreaterThan(0);
      expect(flitser).toBe(true);
      expect(boete).toBe(true);
      // The clock is on the HUD.
      expect(rec.texts.some((s) => /^1[678]:\d\d$/.test(s))).toBe(true);
    } finally {
      h.dispose();
    }
  });

  it('the score feeds the tally lines (FINES among them); the same seed gives the same hash twice', async () => {
    const run = async (): Promise<{ hash: number; labels: string[] }> => {
      const h = await createHeadlessRally({ seed: 2 });
      try {
        h.runUntil((x) => x.done, 40000);
        return { hash: h.runner!.stateHash(), labels: h.runner!.raceLines(0).map((l) => l.label.split(' ')[0]) };
      } finally {
        h.dispose();
      }
    };
    const a = await run();
    const b = await run();
    expect(a.hash).toBe(b.hash);
    expect(a.labels).toEqual(['PLACE', 'TIME', 'BEST', 'OVERTAKES', 'NEAR', 'FINES']);
  });
});
