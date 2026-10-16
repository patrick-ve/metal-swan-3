import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { ACTION_BIT } from '../../../src/engine/input-actions';
import { AreaMap } from '../../../src/engine/ray';
import { PAL } from '../../../src/engine/palette';
import { DOOR_CLOSED, DOOR_CLOSING, DOOR_MOVE_TICKS, DOOR_OPEN, DOOR_OPEN_TICKS, DOOR_OPENING, DoorSystem, KEY_GOLD, KEY_SILVER } from '../../../src/game/fps/doors';
import { FpsGame } from '../../../src/game/fps/game';
import { parseFloor } from '../../../src/game/fps/map';
import { emptyFpsInput } from '../../../src/game/fps/run';
import type { FpsFloorDef } from '../../../src/game/fps/types';
import { PlayerSlot } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

const HALL: FpsFloorDef = {
  id: 'test-doors',
  number: 9,
  name: 'DOORS',
  par: 60,
  secrets: 0,
  ceil: PAL.steel[0],
  floor: PAL.stone[1],
  music: 'fps-floor',
  //       0123456789
  rows: [
    'AAAAAAAAAA',
    'A>.|..!..A',
    'AAAAAAA:AA',
    'AAAAAAA.AA',
    'AAAAAAAAAA',
  ],
};

function system(): { doors: DoorSystem; areas: AreaMap; area: (x: number, y: number) => number } {
  const m = parseFloor(HALL);
  const areas = new AreaMap(m.grid, m.doors);
  return { doors: new DoorSystem(m.doors, m.doorLock, areas), areas, area: (x, y) => m.grid.area[m.grid.idx(x, y)] };
}

const never = (): boolean => false;

describe('DoorSystem (spec §4.6)', () => {
  it('opens in 54 ticks, stays open 258 ticks, closes in 54 ticks', () => {
    const { doors } = system();
    expect(doors.use(0, 0)).toBe('opened');
    for (let t = 1; t < DOOR_MOVE_TICKS; t++) {
      doors.step(never);
      expect(doors.state[0]).toBe(DOOR_OPENING);
    }
    expect(doors.doors.open[0]).toBeCloseTo((DOOR_MOVE_TICKS - 1) / DOOR_MOVE_TICKS, 9);
    doors.step(never);
    expect(doors.state[0]).toBe(DOOR_OPEN);
    expect(doors.doors.open[0]).toBe(1);
    for (let t = 1; t < DOOR_OPEN_TICKS; t++) doors.step(never);
    expect(doors.state[0]).toBe(DOOR_OPEN);
    doors.step(never);
    expect(doors.state[0]).toBe(DOOR_CLOSING);
    for (let t = 0; t < DOOR_MOVE_TICKS; t++) doors.step(never);
    expect(doors.state[0]).toBe(DOOR_CLOSED);
    expect(doors.doors.open[0]).toBe(0);
  });

  it('waits while blocked when open and opens again when blocked while closing', () => {
    const { doors } = system();
    doors.use(0, 0);
    for (let t = 0; t < DOOR_MOVE_TICKS + DOOR_OPEN_TICKS + 40; t++) doors.step(() => true);
    expect(doors.state[0]).toBe(DOOR_OPEN);
    doors.step(never);
    expect(doors.state[0]).toBe(DOOR_CLOSING);
    for (let t = 0; t < 10; t++) doors.step(never);
    const p = doors.prog[0];
    doors.step(() => true);
    expect(doors.state[0]).toBe(DOOR_OPENING);
    expect(doors.prog[0]).toBe(p); // it turns around here and opens from the next tick
  });

  it('closes on use when open (not when blocked) and reopens on use while closing', () => {
    const { doors } = system();
    doors.use(0, 0);
    for (let t = 0; t < DOOR_MOVE_TICKS; t++) doors.step(never);
    expect(doors.use(0, 0, true)).toBe('blocked');
    expect(doors.use(0, 0)).toBe('closed');
    expect(doors.state[0]).toBe(DOOR_CLOSING);
    expect(doors.use(0, 0)).toBe('reopened');
    expect(doors.state[0]).toBe(DOOR_OPENING);
    expect(doors.use(0, 0)).toBe('busy');
  });

  it('keeps locked doors shut without their key', () => {
    const { doors } = system();
    const sounds: string[] = [];
    doors.sfx = (id) => sounds.push(id);
    expect(doors.use(1, 0)).toBe('locked-gold');
    expect(doors.use(1, KEY_SILVER)).toBe('locked-gold');
    expect(doors.use(2, KEY_GOLD)).toBe('locked-silver');
    expect(doors.state[1]).toBe(DOOR_CLOSED);
    expect(sounds).toEqual(['fps/door-locked', 'fps/door-locked', 'fps/door-locked']);
    expect(doors.use(1, KEY_GOLD)).toBe('opened');
    expect(doors.use(2, KEY_SILVER | KEY_GOLD)).toBe('opened');
    expect(sounds.slice(3)).toEqual(['fps/door-open', 'fps/door-open']);
  });

  it('links the areas while the door is not closed', () => {
    const { doors, areas, area } = system();
    const west = area(1, 1);
    const east = area(4, 1);
    expect(east).not.toBe(west);
    areas.computeReach(west);
    expect(areas.reached(east)).toBe(false);
    doors.use(0, 0);
    areas.computeReach(west);
    expect(areas.reached(east)).toBe(true);
    for (let t = 0; t < DOOR_MOVE_TICKS * 2 + DOOR_OPEN_TICKS; t++) doors.step(never);
    expect(doors.state[0]).toBe(DOOR_CLOSED);
    areas.computeReach(west);
    expect(areas.reached(east)).toBe(false);
  });
});

describe('doors in the game', () => {
  function game(): FpsGame {
    return new FpsGame({ floor: HALL, difficulty: 'normal', seed: 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio() });
  }
  const use = { ...emptyFpsInput(), held: ACTION_BIT.use, pressed: ACTION_BIT.use };
  const idle = emptyFpsInput();

  it('opens the door in front on use; the player walks through once it is open', () => {
    const g = game();
    g.skipUnfold();
    g.setPose(2.5, 1.5, 0);
    g.step(use);
    expect(g.doors.state[0]).toBe(DOOR_OPENING);
    const fwd = { ...emptyFpsInput(), held: ACTION_BIT.forward };
    for (let t = 0; t < 20; t++) g.step(fwd);
    expect(g.player.x).toBeLessThan(3 - 0.34 + 1e-6); // the half-open door blocks
    for (let t = 0; t < 60; t++) g.step(fwd);
    expect(g.player.x).toBeGreaterThan(4);
  });

  it('says which key a locked door needs and stays open while the player stands in it', () => {
    const g = game();
    g.skipUnfold();
    g.setPose(5.5, 1.5, 0);
    const msgs: string[] = [];
    g.events.on('message', (m) => msgs.push(m.text));
    g.step(use);
    expect(msgs).toEqual(['YOU NEED THE GOLD KEY']);
    expect(g.doors.state[1]).toBe(DOOR_CLOSED);
    g.player.keys = KEY_GOLD;
    g.step(idle);
    g.step(use);
    expect(g.doors.state[1]).toBe(DOOR_OPENING);
    for (let t = 0; t < DOOR_MOVE_TICKS; t++) g.step(idle);
    g.setPose(6.5, 1.5, 0); // in the door cell
    for (let t = 0; t < DOOR_OPEN_TICKS + 100; t++) g.step(idle);
    expect(g.doors.state[1]).toBe(DOOR_OPEN);
  });
});
