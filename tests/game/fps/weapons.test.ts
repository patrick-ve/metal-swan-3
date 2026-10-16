import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { ACTION_BIT as B } from '../../../src/engine/input-actions';
import { PAL } from '../../../src/engine/palette';
import { ST_STAND } from '../../../src/game/fps/actors';
import { FpsGame } from '../../../src/game/fps/game';
import { FpsPlayer } from '../../../src/game/fps/player';
import type { FpsFloorDef, FpsInput, FpsThing } from '../../../src/game/fps/types';
import { WEAPON_CHAINGUN, WEAPON_KNIFE, WEAPON_MG, WEAPON_PISTOL } from '../../../src/game/fps/types';
import { SWITCH_DOWN, SWITCH_UP, WEAPONS, WeaponSystem, WP_IDLE } from '../../../src/game/fps/weapons';
import { PlayerSlot } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function makeGame(rows: string[], things?: FpsThing[]): FpsGame {
  const def: FpsFloorDef = { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 0, rows, things, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor' };
  const g = new FpsGame({ floor: def, difficulty: 'normal', seed: 3, slot: new PlayerSlot(0), carry: null, audio: new NullAudio() });
  g.skipUnfold();
  return g;
}

const input = (): FpsInput => ({ held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 });

/** Drive a weapon system for `ticks` with a held mask and a pressed mask per tick; count shots. */
function run(ws: WeaponSystem, p: FpsPlayer, ticks: number, held: (t: number) => number, pressed: (t: number) => number = () => 0): number[] {
  const i = input();
  const shots: number[] = [];
  for (let t = 0; t < ticks; t++) {
    i.held = held(t);
    i.pressed = pressed(t);
    if (ws.step(p, i)) shots.push(t);
  }
  return shots;
}

function armed(weapon: number, ammo = 99): { ws: WeaponSystem; p: FpsPlayer } {
  const p = new FpsPlayer();
  p.reset(1.5, 1.5, 0, { hp: 100, ammo, weapons: 0b1111, weapon });
  return { ws: new WeaponSystem(), p };
}

describe('fire rates (§4.2)', () => {
  it('held fire: MG 6/s, chaingun 12/s, knife every 24 ticks; the first shot on the shot tick', () => {
    for (const [w, n, first] of [[WEAPON_MG, 6, 2], [WEAPON_CHAINGUN, 12, 1], [WEAPON_KNIFE, 3, 8]] as const) {
      const { ws, p } = armed(w);
      const shots = run(ws, p, 60, () => B.fire, (t) => (t === 0 ? B.fire : 0));
      expect(shots.length, WEAPONS[w].id).toBe(n);
      expect(shots[0]).toBe(first);
      for (let k = 1; k < shots.length; k++) expect(shots[k] - shots[k - 1]).toBe(WEAPONS[w].cycle);
    }
  });

  it('the pistol fires once per press; a press from cycle tick 14 queues the next shot', () => {
    const { ws, p } = armed(WEAPON_PISTOL);
    expect(run(ws, p, 60, () => B.fire, (t) => (t === 0 ? B.fire : 0))).toEqual([4]);
    const q = armed(WEAPON_PISTOL);
    // Press at 0 and again at 14: the queued shot follows at 20 + 4.
    expect(run(q.ws, q.p, 60, () => 0, (t) => (t === 0 || t === 14 ? B.fire : 0))).toEqual([4, 24]);
    const early = armed(WEAPON_PISTOL);
    // A press at cycle tick 10 is ignored.
    expect(run(early.ws, early.p, 60, () => 0, (t) => (t === 0 || t === 10 ? B.fire : 0))).toEqual([4]);
  });

  it('every gun shot spends 1 ammo; the knife spends none', () => {
    const { ws, p } = armed(WEAPON_MG, 20);
    const shots = run(ws, p, 60, () => B.fire, (t) => (t === 0 ? B.fire : 0));
    expect(p.ammo).toBe(20 - shots.length);
    const k = armed(WEAPON_KNIFE, 5);
    run(k.ws, k.p, 60, () => B.fire, (t) => (t === 0 ? B.fire : 0));
    expect(k.p.ammo).toBe(5);
  });
});

describe('switching and the out-of-ammo knife (§4.2)', () => {
  it('8 ticks down + 8 up; number keys pick an owned weapon with ammo', () => {
    const { ws, p } = armed(WEAPON_PISTOL);
    const i = input();
    i.pressed = B.weapon4;
    ws.step(p, i);
    i.pressed = 0;
    let t = 1;
    while (p.weapon !== WEAPON_CHAINGUN && t < 50) {
      ws.step(p, i);
      t++;
    }
    expect(t).toBe(1 + SWITCH_DOWN);
    while (ws.phase !== WP_IDLE && t < 50) {
      ws.step(p, i);
      t++;
    }
    expect(t).toBe(1 + SWITCH_DOWN + SWITCH_UP);
  });

  it('next / previous skip weapons that are not owned or have no ammo (the knife always counts)', () => {
    const p = new FpsPlayer();
    p.reset(1.5, 1.5, 0, { hp: 100, ammo: 10, weapons: 0b1011, weapon: WEAPON_PISTOL });
    const ws = new WeaponSystem();
    ws.cycle(p, 1);
    expect(ws.want).toBe(WEAPON_CHAINGUN); // the MG is not owned
    ws.want = -1;
    ws.cycle(p, -1);
    expect(ws.want).toBe(WEAPON_KNIFE);
    p.ammo = 0;
    ws.want = -1;
    ws.cycle(p, 1);
    expect(ws.want).toBe(WEAPON_KNIFE); // no ammo: only the knife is usable
    expect(ws.request(p, WEAPON_MG)).toBe(false);
  });

  it('after the last shot the knife comes up', () => {
    const { ws, p } = armed(WEAPON_MG, 2);
    const shots = run(ws, p, 30, () => B.fire, (t) => (t === 0 ? B.fire : 0));
    expect(shots).toEqual([2, 12]);
    expect(p.ammo).toBe(0);
    expect(p.weapon).toBe(WEAPON_KNIFE);
    // Fire still held: the knife keeps stabbing once it is up.
    expect(run(ws, p, 30, () => B.fire).length).toBe(1);
  });
});

describe('noise (§4.4)', () => {
  // The guard stands with its back to the player in the same room: it cannot see him, and the
  // player faces the wall (the shot cannot hit it).
  const rows = ['AAAAAAAAAA', 'A^.....g.A', 'AAAAAAAAAA'];
  const things: FpsThing[] = [{ at: [7, 1], facing: 'E' }];

  it('the knife is silent: a swing does not wake an actor that cannot see the player', () => {
    const g = makeGame(rows, things);
    g.player.weapon = WEAPON_KNIFE;
    const i = input();
    for (let t = 0; t < 120; t++) {
      i.held = B.fire;
      i.pressed = t === 0 ? B.fire : 0;
      g.step(i);
    }
    expect(g.weaponSys.shots).toBeGreaterThan(3);
    expect(g.actors.actors[0].state).toBe(ST_STAND);
    expect(g.actors.actors[0].react).toBe(0);
  });

  it('a pistol shot wakes it', () => {
    const g = makeGame(rows, things);
    const i = input();
    i.pressed = B.fire;
    i.held = B.fire;
    g.step(i);
    i.pressed = 0;
    i.held = 0;
    for (let t = 0; t < 70; t++) g.step(i);
    expect(g.weaponSys.shots).toBe(1);
    expect(g.actors.actors[0].aware).toBe(true);
  });
});
