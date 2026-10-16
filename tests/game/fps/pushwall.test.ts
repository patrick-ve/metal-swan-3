import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { ACTION_BIT } from '../../../src/engine/input-actions';
import { CELL_OPAQUE, CELL_PUSH, CELL_SOLID, castRay, newRayHit, tryMove } from '../../../src/engine/ray';
import { PAL } from '../../../src/engine/palette';
import { FpsGame } from '../../../src/game/fps/game';
import { parseFloor } from '../../../src/game/fps/map';
import { PUSH_MAX_TILES, PUSH_TICKS_PER_TILE, PushSystem } from '../../../src/game/fps/pushwall';
import { getFpsFloor } from '../../../src/game/fps/registry';
import { emptyFpsInput } from '../../../src/game/fps/run';
import type { FpsFloorDef } from '../../../src/game/fps/types';
import { PlayerSlot } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function floor(rows: string[]): FpsFloorDef {
  return { id: `push-${rows.join('/')}`, number: 9, name: 'PUSH', par: 60, secrets: 1, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor', rows };
}

const free = (g: ReturnType<typeof parseFloor>['grid']) => (x: number, y: number) => g.inside(x, y) && g.flags[g.idx(x, y)] === 0;

describe('PushSystem (spec §4.7)', () => {
  it('slides 2 tiles at 110 ticks per tile, then is a normal wall', () => {
    const m = parseFloor(floor(['AAAAAAA', 'A>.*..A', 'AAAAAAA']));
    const g = m.grid;
    const ps = new PushSystem(g);
    expect(ps.use(3, 1, 0, free(g))).toBe('moved');
    expect(ps.found).toBe(1);
    expect(ps.push).toMatchObject({ active: true, x: 3, y: 1, dx: 1, dy: 0 });
    expect(g.flags[g.idx(3, 1)] & CELL_PUSH).toBe(0);
    let stopped = -1;
    for (let t = 1; t <= PUSH_TICKS_PER_TILE * PUSH_MAX_TILES + 5; t++) {
      if (ps.step(free(g)) && stopped < 0) stopped = t;
      if (t === 55) expect(ps.push.offset).toBeCloseTo(0.5, 9);
      if (t === PUSH_TICKS_PER_TILE) expect(ps.push).toMatchObject({ active: true, x: 4, offset: 0 });
    }
    expect(stopped).toBe(PUSH_TICKS_PER_TILE * PUSH_MAX_TILES);
    expect(ps.push.active).toBe(false);
    expect(g.flags[g.idx(3, 1)]).toBe(0);
    expect(g.flags[g.idx(4, 1)]).toBe(0);
    expect(g.flags[g.idx(5, 1)] & (CELL_SOLID | CELL_OPAQUE)).toBe(CELL_SOLID | CELL_OPAQUE);
    expect(g.wall[g.idx(5, 1)] - 1).toBe(m.pushes[0].tex);
  });

  it('does not move when the first cell behind it is not free; stops early at a blocked cell', () => {
    const m = parseFloor(floor(['AAAAAAA', 'A>.*AAA', 'AAAAAAA']));
    const ps = new PushSystem(m.grid);
    expect(ps.use(3, 1, 0, free(m.grid))).toBe('blocked');
    expect(ps.found).toBe(0);
    expect(ps.use(2, 1, 0, free(m.grid))).toBe('none');

    const m2 = parseFloor(floor(['AAAAAAA', 'A>.*.QA', 'AAAAAAA']));
    const ps2 = new PushSystem(m2.grid);
    expect(ps2.use(3, 1, 0, free(m2.grid))).toBe('moved');
    let t = 0;
    while (!ps2.step(free(m2.grid)) && t < 1000) t++;
    expect(t + 1).toBe(PUSH_TICKS_PER_TILE);
    expect(ps2.push).toMatchObject({ active: false, x: 4 });
  });

  it('moves one wall at a time', () => {
    const m = parseFloor(floor(['AAAAAAA', 'A*.*..A', 'A>....A', 'AAAAAAA']));
    const ps = new PushSystem(m.grid);
    expect(ps.use(3, 1, 1, free(m.grid))).toBe('moved');
    expect(ps.use(1, 1, 1, free(m.grid))).toBe('busy');
  });

  it('blocks rays and movement where the moving block is', () => {
    const m = parseFloor(floor(['AAAAAAA', 'A>.*..A', 'AAAAAAA']));
    const ps = new PushSystem(m.grid);
    ps.use(3, 1, 0, free(m.grid));
    for (let t = 0; t < 55; t++) ps.step(free(m.grid));
    const hit = newRayHit();
    expect(castRay(m.grid, m.doors, ps.push, 1.5, 1.5, 1, 0, hit)).toBe(true);
    expect(hit.dist).toBeCloseTo(3.5 - 1.5, 6);
    const box = { x: 2.5, y: 1.5, r: 0.34 };
    tryMove(m.grid, m.doors, ps.push, box, 1, 0);
    expect(box.x).toBeLessThan(3);
  });
});

describe('push walls in the game (floor 0 secret)', () => {
  it('opens the closet with the golden record and counts the secret', () => {
    const g = new FpsGame({ floor: getFpsFloor('fps-0')!, difficulty: 'normal', seed: 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio() });
    g.skipUnfold();
    g.setPose(4.5, 9.5, 2048); // facing west at the push wall (3, 9)
    const secrets: Array<[number, number]> = [];
    g.events.on('secret', (e) => secrets.push([e.x, e.y]));
    g.step({ ...emptyFpsInput(), held: ACTION_BIT.use, pressed: ACTION_BIT.use });
    expect(secrets).toEqual([[3, 9]]);
    for (let t = 0; t < PUSH_TICKS_PER_TILE * 2 + 2; t++) g.step(emptyFpsInput());
    expect(g.pushes.push.active).toBe(false);
    expect(g.grid.opaqueAt(1, 9)).toBe(true);
    expect(g.grid.opaqueAt(2, 9)).toBe(false);
    expect(g.grid.opaqueAt(3, 9)).toBe(false);
    // The closet is now one area with room A.
    expect(g.grid.area[g.grid.idx(2, 10)]).toBe(g.grid.area[g.grid.idx(4, 9)]);
    // Walk in and stand on the record cell.
    const walk = { ...emptyFpsInput(), held: ACTION_BIT.forward };
    for (let t = 0; t < 30; t++) g.step(walk);
    expect(Math.floor(g.player.x)).toBe(2);
  });
});
