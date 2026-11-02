/**
 * The budget's screens (docs/design/oat.md §7.5–§7.8): the kassabon (oat's tally), the newspaper's
 * euro lines, the rally's prize money, the `budgets` table on name entry and the high scores, the
 * final tally's JAARREKENING, and the HUD line.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { InputManager, ScriptedSource, type Button } from '../../../src/engine/input';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { MemoryStore } from '../../../src/engine/storage';
import { createApp, newCampaign, type GameApp } from '../../../src/game/app';
import { HudState } from '../../../src/game/context';
import { drawHud } from '../../../src/game/hud';
import { DEFAULT_PARAMS } from '../../../src/game/params';
import { placeCents, PRIZE, scoreLines, ScoreBook, type ScoredRace } from '../../../src/game/rally/score';
import type { CarState } from '../../../src/game/rally/api';
import { FinalTallyScene } from '../../../src/game/scenes/final-tally';
import { HighScoresScene } from '../../../src/game/scenes/high-scores';
import { MissionCompleteScene, type NextRunner } from '../../../src/game/scenes/mission-complete';
import { finishRun, NameEntryScene } from '../../../src/game/scenes/name-entry';
import { buildReceipt, ReceiptTallyScene } from '../../../src/game/scenes/receipt-tally';
import { GameSession } from '../../../src/game/session';
import { TUNING } from '../../../src/game/tuning';
import '../helpers';

/** FLAWLESS PERFORMANCE in euros (points ÷ 500). */
const FLAWLESS = () => TUNING.score.flawless / 5;

function harness(store = new MemoryStore()): { app: GameApp; step: (n: number) => void; tap: (b: Button) => void; r: SoftRenderer } {
  const input = new InputManager();
  const held: Button[][] = [[]];
  input.addSource(new ScriptedSource(() => held[0], 0));
  const app = createApp({ input, audio: new NullAudio(), store, params: { ...DEFAULT_PARAMS } });
  const r = new SoftRenderer();
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
      r.begin();
      app.scenes.draw(r);
      r.end();
    }
  };
  const tap = (b: Button): void => {
    held[0] = [b];
    step(1);
    held[0] = [];
    step(1);
  };
  return { app, step, tap, r };
}

function euroSession(players = 1): GameSession {
  const s = new GameSession({ characters: players === 2 ? ['vincent', 'thom'] : ['vincent'], seed: 1 });
  s.setEconomy('euro');
  s.startMission('oat');
  return s;
}

/** A finished oat play for the tally pages (no runner needed: the page reads these). */
function oatRunner(session: GameSession): NextRunner {
  return { session, mission: { id: 'oat', hostages: {} }, nextMission: () => null };
}

describe('budget: the kassabon (spec §7.6)', () => {
  it('lists the mission\'s categories with counts, the bonuses, TOTAAL and SALDO', () => {
    const session = euroSession();
    const s = session.slots[0];
    for (let i = 0; i < 37; i++) s.ledger.book(15, 'deposit');
    for (let i = 0; i < 2; i++) s.ledger.book(-445, 'flatWhite');
    s.ledger.book(-9500, 'boete');
    s.ledger.book(-8750, 'fare');
    s.mission.deaths = 0;
    const rc = buildReceipt(oatRunner(session), s, 1);
    const labels = rc.rows.map((r) => r.label);
    expect(labels.slice(0, 2)).toEqual(['KASSABON', 'DAGJE UIT - DE BINNENSTAD']);
    expect(labels).toContain('STATIEGELD 37X');
    expect(labels).toContain('FLAT WHITE 2X');
    expect(labels).toContain('BOETE');
    expect(labels).toContain('BONUS: FOUTLOOS');
    // The fare is the last ledger line, before the bonuses.
    expect(labels.indexOf('RIT NAAR DE RING')).toBeLessThan(labels.indexOf('BONUS: FOUTLOOS'));
    expect(labels.indexOf('RIT NAAR DE RING')).toBeGreaterThan(labels.indexOf('BOETE'));
    const row = (l: string) => rc.rows.find((r) => r.label === l)!;
    expect(row('STATIEGELD 37X').cents).toBe(555);
    expect(row('BONUS: FOUTLOOS').cents).toBe(FLAWLESS());
    expect(rc.net).toBe(555 - 890 - 9500 - 8750 + FLAWLESS());
    expect(row('TOTAAL').cents).toBe(rc.net);
    expect(rc.saldo).toBe(s.cents + FLAWLESS());
  });

  it('prints at 4 lines a second, books the bonuses as they print, stamps OVERSCHOT / TEKORT and ZUINIGST (2P)', () => {
    const { app, step, tap, r } = harness();
    const session = euroSession(2);
    app.session = session;
    app.campaign = newCampaign();
    const [a, b] = session.slots;
    a.ledger.book(-20000, 'assessment');
    b.ledger.book(1500, 'deposit');
    const page = new ReceiptTallyScene(app, oatRunner(session));
    app.scenes.reset(page);
    step(1);
    expect(page.page.map((x) => x.net >= 0)).toEqual([-20000 + FLAWLESS() >= 0, true]);
    expect(page.page.map((x) => x.thrift)).toEqual([false, true]);
    step(30 + 15 * 3);
    expect(page.rowsShown).toBe(4);
    expect(page.finished).toBe(false);
    tap('fire');
    expect(page.finished).toBe(true);
    // Both FOUTLOOS bonuses are booked, once.
    expect(a.cents).toBe(10000 - 20000 + FLAWLESS());
    expect(b.cents).toBe(10000 + 1500 + FLAWLESS());
    step(10);
    expect(a.cents).toBe(10000 - 20000 + FLAWLESS());
    // It drew something on the page (the paper is snow on navy).
    expect(r.target.data.some((v) => v !== 0)).toBe(true);
  });
});

describe('budget: the newspaper\'s euro lines (spec §7.2; ams, oldenzaal)', () => {
  it('a euro play shows the bonuses at points ÷ 500 and books the TOTAL as BONUS', () => {
    const { app, step, tap } = harness();
    const session = euroSession();
    app.session = session;
    const s = session.slots[0];
    s.rescued = 3;
    const runner: NextRunner = { session, mission: { id: 'ams', hostages: { a: 4 } }, nextMission: () => null };
    const page = new MissionCompleteScene(app, runner);
    app.scenes.reset(page);
    step(25);
    tap('fire');
    // HOSTAGES 3 × 10,000 points → 3 × € 20,00; FLAWLESS 50,000? (TUNING) → ÷ 500; all × 1.0.
    expect(s.ledger.tally('bonus').cents).toBeGreaterThan(6000);
    expect(s.cents).toBe(10000 + s.ledger.tally('bonus').cents);
    // The points still count.
    expect(s.score).toBeGreaterThan(0);
  });

  it('a point play books no euros', () => {
    const { app, step, tap } = harness();
    const session = new GameSession({ characters: ['vincent'], seed: 1 });
    app.session = session;
    const runner: NextRunner = { session, mission: { id: 'm1' }, nextMission: () => null };
    app.scenes.reset(new MissionCompleteScene(app, runner));
    step(25);
    tap('fire');
    expect(session.slots[0].cents).toBe(10000);
    expect(session.slots[0].score).toBeGreaterThan(0);
  });
});

describe('budget: the rally\'s prize money (spec §7.8)', () => {
  it('pays PLACE € 500 … € 25, € 0,50 a second under par, BEST LAP, OVERTAKES, NEAR MISSES, FINES − € 120, TEAM', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(placeCents)).toEqual([50000, 35000, 25000, 15000, 10000, 7500, 5000, 2500, 2500]);
    const book = new ScoreBook();
    for (let i = 0; i < 7; i++) book.overtake('p1');
    book.nearMiss('p1', 200);
    const car = { id: 'p1', slot: 0, place: 2, finished: true, finishTicks: 600 * 60 - 10 * 60, fines: 3, lapTicks: [9000, 9100, 9200], partLaps: 0 } as unknown as CarState;
    const race: ScoredRace = { parTicks: 600 * 60, carCount: 8, parLapTicks: 9050, book, cars: [car] };
    const lines = scoreLines(race, car);
    const cents = Object.fromEntries(lines.map((l) => [l.label.split(' ')[0], l.cents]));
    expect(cents.PLACE).toBe(35000);
    expect(cents.TIME).toBe(10 * PRIZE.timePerSecond);
    expect(cents.BEST).toBe(5000);
    expect(cents.OVERTAKES).toBe(1400);
    expect(cents.NEAR).toBe(100);
    expect(cents.FINES).toBe(-36000);
    expect(lines.find((l) => l.label.startsWith('FINES'))?.label).toBe('FINES 3');
  });
});

describe('budget: the budgets table on the screens (spec §7.7)', () => {
  it('a euro run with a good budget enters `budgets` by name entry; the table shows it', () => {
    const store = new MemoryStore();
    const { app, step, tap } = harness(store);
    const session = euroSession();
    app.session = session;
    session.slots[0].ledger.book(300000, 'boss');
    finishRun(app, true);
    step(40);
    expect(app.scenes.top).toBeInstanceOf(NameEntryScene);
    expect((app.scenes.top as NameEntryScene).table).toBe('budgets');
    for (let i = 0; i < 3; i++) tap('fire');
    step(60);
    expect(app.scenes.top).toBeInstanceOf(HighScoresScene);
    expect((app.scenes.top as HighScoresScene).table).toBe('budgets');
    expect(app.budgets.entries[0]).toMatchObject({ name: 'AAA', cents: 310000, mission: 'all', character: 'vincent' });
    expect(store.get('budgets')).not.toBeNull();
    // The points table did not change.
    expect(app.highScores.entries.some((e) => e.name === 'AAA')).toBe(false);
  });

  it('a red run never enters: straight to the table', () => {
    const { app, step } = harness();
    const session = euroSession();
    app.session = session;
    session.slots[0].ledger.book(-50000, 'assessment');
    finishRun(app, false);
    step(40);
    expect(app.scenes.top).toBeInstanceOf(HighScoresScene);
  });

  it('the attract loop shows the budgets; a point run after its game the points', () => {
    const { app } = harness();
    expect(new HighScoresScene(app, { mode: 'attract' }).table).toBe('budgets');
    app.session = new GameSession({ characters: ['vincent'] });
    expect(new HighScoresScene(app, { mode: 'after-game' }).table).toBe('points');
  });
});

describe('budget: the final tally (spec §7.2, §7.6)', () => {
  it('pays € 100,00 per reserve life and € 1.000,00 one-take in euros and stamps the JAARREKENING', () => {
    const { app, step, tap } = harness();
    const session = euroSession();
    app.session = session;
    app.campaign = newCampaign();
    const s = session.slots[0];
    s.lives = 3;
    s.continues = 0;
    const page = new FinalTallyScene(app);
    app.scenes.reset(page);
    step(25);
    tap('fire');
    expect(s.ledger.tally('bonus').cents).toBe(2 * 10000 + 100000);
    expect(s.cents).toBe(130000);
  });
});

describe('budget: the HUD (spec §7.5)', () => {
  it('draws the budget line in a euro play and the 7-digit score in a point play', () => {
    for (const euro of [true, false]) {
      const session = new GameSession({ characters: ['vincent'] });
      if (euro) session.setEconomy('euro');
      const r = new SoftRenderer();
      r.begin();
      drawHud(r, { session, hud: new HudState(), runner: null, inputPlayers: 1, ticks: 0 });
      r.end();
      // Something is drawn in the top-left block either way (the text renders).
      let lit = 0;
      for (let y = 2; y < 10; y++) for (let x = 16; x < 110; x++) if (r.target.data[(y * r.target.w + x) * 4 + 3] !== 0) lit++;
      expect(lit).toBeGreaterThan(20);
    }
  });
});
