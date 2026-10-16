import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { InputManager } from '../../../src/engine/input';
import { ACTION_BIT as B } from '../../../src/engine/input-actions';
import { MemoryStore } from '../../../src/engine/storage';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { createApp, newCampaign } from '../../../src/game/app';
import { ELEVATOR_TICKS, FpsGame } from '../../../src/game/fps/game';
import { getFpsFloor } from '../../../src/game/fps/registry';
import { newFpsRun } from '../../../src/game/fps/run';
import type { FloorResult, FpsInput } from '../../../src/game/fps/types';
import { AMS_BONUS_RECORD, clockText, FPS_TALLY_AUTO_TICKS, fpsTally, FpsTallyScene, ratioPct, tallySeconds } from '../../../src/game/scenes/fps-tally';
import { GameSession, PlayerSlot, type Difficulty } from '../../../src/game/session';
import { SimAudio } from '../../../src/sim/stats';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
  await import('../../../src/game/content/fps/floors');
});

function result(o: Partial<FloorResult> = {}): FloorResult {
  return { floor: 1, ticks: 3951, kills: 33, killsTotal: 34, secrets: 5, secretsTotal: 5, treasure: 12, treasureTotal: 12, goldenRecord: true, ...o };
}

describe('tally math (§4.12)', () => {
  it('ratios round down and stop at 100; no items counts as 100', () => {
    expect(ratioPct(33, 34)).toBe(97);
    expect(ratioPct(34, 34)).toBe(100);
    expect(ratioPct(40, 34)).toBe(100);
    expect(ratioPct(0, 0)).toBe(100);
    expect(ratioPct(1, 3)).toBe(33);
  });

  it('time: whole seconds rounded up; m:ss', () => {
    expect(tallySeconds(60)).toBe(1);
    expect(tallySeconds(61)).toBe(2);
    expect(tallySeconds(3951)).toBe(66);
    expect(clockText(66)).toBe('1:06');
    expect(clockText(210)).toBe('3:30');
  });

  it('kills / secrets / treasure / par bonus, the difficulty, the total', () => {
    const t = fpsTally(result(), { par: 210, mul: 1, slot: 0 });
    const pts = Object.fromEntries(t.lines.map((l) => [l.label, l.points]));
    expect(pts.KILLS).toBe(0);
    expect(pts.SECRETS).toBe(10000);
    expect(pts.TREASURE).toBe(10000);
    expect(pts.TIME).toBe((210 - 66) * 500);
    expect(t.raw).toBe(20000 + 72000);
    expect(t.total).toBe(92000);
    expect(t.lines.map((l) => l.label)).toEqual(['KILLS', 'SECRETS', 'TREASURE', 'TIME', 'DIFFICULTY', 'TOTAL']);
    expect(t.lines[0].value).toBe('97%');
    expect(t.lines[3].value).toBe('1:06  PAR 3:30');
    const hard = fpsTally(result({ kills: 34 }), { par: 210, mul: 1.5, slot: 0 });
    expect(hard.raw).toBe(30000 + 72000);
    expect(hard.total).toBe(Math.round(102000 * 1.5));
    expect(hard.lines[0].perfect).toBe(true);
  });

  it('over par and missing secrets give nothing', () => {
    const t = fpsTally(result({ ticks: 60 * 300, secrets: 4, treasure: 11 }), { par: 210, mul: 0.5, slot: 0 });
    expect(t.raw).toBe(0);
    expect(t.total).toBe(0);
  });

  it('MISSION 1 BONUS lines are info only (not in TOTAL); the waiting slot gets its own line', () => {
    const t = fpsTally(result(), { par: 210, mul: 1, slot: 0, amsBonus: [41000, 23000], otherJoined: true });
    const own = t.lines.find((l) => l.label === 'MISSION 1 BONUS')!;
    const other = t.lines.find((l) => l.label === '2P MISSION 1 BONUS')!;
    expect(own.points).toBe(41000);
    expect(other.points).toBe(23000);
    expect(own.counts).toBe(false);
    expect(t.total).toBe(92000);
    // P2 plays (P1 was out): its own line first, then 1P's.
    const t2 = fpsTally(result(), { par: 210, mul: 1, slot: 1, amsBonus: [41000, 23000], otherJoined: true });
    expect(t2.lines.find((l) => l.label === 'MISSION 1 BONUS')!.points).toBe(23000);
    expect(t2.lines.find((l) => l.label === '1P MISSION 1 BONUS')!.points).toBe(41000);
  });
});

describe('the floor clock stops (§4.12)', () => {
  it('at the elevator switch', () => {
    const g = new FpsGame({ floor: getFpsFloor('fps-1')!, difficulty: 'easy', seed: 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio(), god: true });
    g.skipUnfold();
    const idle: FpsInput = { held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 };
    for (let t = 0; t < 100; t++) g.step(idle);
    g.setPose(44.5, 6.5, 0);
    const use: FpsInput = { held: B.use, pressed: B.use, turn: 0, moveX: 0, moveY: 0 };
    g.step(use);
    expect(g.state).toBe('elevator');
    const clock = g.clock;
    let res: FloorResult | null = null;
    g.events.on('floorComplete', ({ result: r }) => (res = r));
    for (let t = 0; t < ELEVATOR_TICKS + 5; t++) g.step(idle);
    expect(res).not.toBeNull();
    expect(res!.ticks).toBe(clock);
    expect(res!.killsTotal).toBe(22);
    expect(res!.secretsTotal).toBe(5);
    expect(res!.treasureTotal).toBe(12);
  });
});

function tallyApp(difficulty: Difficulty = 'normal', players: 1 | 2 = 1) {
  const audio = new SimAudio();
  const app = createApp({ input: new InputManager(), audio, store: new MemoryStore() });
  app.session = new GameSession({ difficulty, characters: players === 2 ? ['recruit', 'recruit'] : ['recruit'], seed: 1 });
  for (let i = 0; i < players; i++) app.session.slots[i].joined = true;
  app.campaign = newCampaign();
  return { app, audio };
}

describe('FpsTallyScene (§1.8)', () => {
  it('records the floor, pays TOTAL into the score and moves on by itself after 600 ticks', () => {
    const { app, audio } = tallyApp('hard');
    const session = app.session!;
    session.records.set(AMS_BONUS_RECORD, [12000, 0]);
    const run = newFpsRun(session, 1);
    const scene = new FpsTallyScene(app, run, result());
    app.scenes.reset(scene);
    expect(app.campaign!.missions).toContain('fps-1');
    expect(app.campaign!.goldenRecords[0].has('fps-1')).toBe(true);
    expect(session.completed).toContain('fps-1');
    expect(scene.tally.lines.some((l) => l.label === 'MISSION 1 BONUS' && l.points === 12000)).toBe(true);
    const score0 = session.slots[0].score;
    const r = new SoftRenderer();
    for (let t = 0; t < FPS_TALLY_AUTO_TICKS - 1; t++) {
      scene.update();
      if (t % 100 === 0) {
        r.begin();
        scene.draw(r);
        r.end();
      }
    }
    expect(scene.finished).toBe(true);
    expect(session.slots[0].score - score0).toBe(scene.tally.total);
    expect(scene.tally.total).toBe(Math.round((20000 + 72000) * 1.5));
    expect(audio.sfxCounts.get('ui/tally-tick')).toBe(scene.tally.lines.length - 1);
    expect(audio.sfxCounts.get('ui/tally-end')).toBe(1);
    expect(audio.sfxCounts.get('fps/tally-100')).toBe(2);
    expect(audio.songs).toContain('fps-tally');
  });

  it('the first press shows the page and pays out at once', () => {
    const { app } = tallyApp();
    const session = app.session!;
    const run = newFpsRun(session, 2);
    const scene = new FpsTallyScene(app, run, result({ floor: 2, goldenRecord: false, secretsTotal: 2, secrets: 0 }));
    app.scenes.reset(scene);
    for (let t = 0; t < 30; t++) scene.update();
    app.pointerPressed = true;
    scene.update();
    expect(scene.finished).toBe(true);
    expect(scene.paidOut).toBe(scene.tally.total);
    expect(app.campaign!.goldenRecords[0].has('fps-2')).toBe(false);
  });
});
