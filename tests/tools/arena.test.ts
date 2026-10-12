/**
 * `npm run arena` (tools/arena.ts): option and spawn-spec parsing, the arena terrain builder,
 * and quick headless runs (spawns, a vehicle mount, no errors).
 */
import { describe, expect, it } from 'vitest';
import { buttonMask } from '../../src/engine/input';
import type { World } from '../../src/engine/world';
import { defineEntity, type SpawnParams } from '../../src/game/registry';
import { Vehicle } from '../../src/game/vehicle';
import {
  ArenaTerrain,
  FLOOR,
  buildArena,
  parseArenaArgs,
  parseParams,
  parseSpawnList,
  pressMaskAt,
  runArena,
  type ArenaIO,
} from '../../tools/arena';

const quiet = (): ArenaIO & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, out: (l) => void lines.push(l), err: (l) => void lines.push(l) };
};

describe('arena spawn specs and params', () => {
  it('parses ids, absolute and relative x, y and params', () => {
    const s = parseSpawnList('rifleman@+80; crate@300,140{contains:bombs,hp:30};drummer@-40');
    expect(s).toEqual([
      { id: 'rifleman', x: 80, rel: true, params: {} },
      { id: 'crate', x: 300, rel: false, y: 140, params: { contains: 'bombs', hp: 30 } },
      { id: 'drummer', x: -40, rel: true, params: {} },
    ]);
  });

  it('reads JSON-ish params: bare words, quotes, lists, nested objects', () => {
    expect(parseParams("{kind:'tea-lady',bind:'cage'}")).toEqual({ kind: 'tea-lady', bind: 'cage' });
    expect(parseParams('{ a: 1, b: -2.5, c: true, d: null, e: "x y", f: [bombs, 2], g: {id: pickup-bombs}, }')).toEqual({
      a: 1,
      b: -2.5,
      c: true,
      d: null,
      e: 'x y',
      f: ['bombs', 2],
      g: { id: 'pickup-bombs' },
    });
    // ';' inside quotes or braces does not split the spawn list.
    expect(parseSpawnList("sign@100{text:'a;b'};crate@200")[0].params).toEqual({ text: 'a;b' });
    expect(() => parseParams('{a:1 b:2}')).toThrow(/expected "," or "}"/);
    expect(() => parseSpawnList('rifleman')).toThrow(/expected id@x/);
  });

  it('glues spawn specs that npm run split at a comma in braces', () => {
    // sh brace expansion: rifleman@420{patrol:64,gag:false} → two words.
    const a = parseArenaArgs(['--spawn', 'rifleman@420patrol:64', 'rifleman@420gag:false', '--god']);
    expect(a.spawns).toEqual([{ id: 'rifleman', x: 420, rel: false, params: { patrol: 64, gag: false } }]);
    expect(a.god).toBe(true);
    expect(() => parseArenaArgs(['--vehicle', 'swancells:5', 'swanshells:2'])).toThrow(/space after each comma/);
  });
});

describe('arena options and terrain', () => {
  it('parses terrain, input and output options', () => {
    const a = parseArenaArgs([
      '--water', '300-700', '--water', '900-1000:16', '--gap', '1200:48', '--platform', '400,120,64',
      '--solid', '500,138,32,32', '--slope', '1300:48:-48', '--step', '1500:-16', '--x', '120',
      '--vehicle', "swan{cells:5}", '--hold', 'right,fire', '--press', '30:jump;45-47:jump,fire',
      '--trace', 'swan,player', '--every', '15', '--count', '4', '--out', 'tmp/arena/x.png',
    ]);
    expect(a.water).toEqual([{ x0: 300, x1: 700, depth: 48 }, { x0: 900, x1: 1000, depth: 16 }]);
    expect(a.gaps).toEqual([{ x: 1200, w: 48 }]);
    expect(a.platforms).toEqual([{ x: 400, y: 120, len: 64 }]);
    expect(a.solids).toEqual([{ x: 500, y: 138, w: 32, h: 32 }]);
    expect(a.slopes).toEqual([{ x: 1300, len: 48, dy: -48 }]);
    expect(a.steps).toEqual([{ x: 1500, dy: -16 }]);
    expect(a.vehicle).toEqual({ id: 'swan', params: { cells: 5 } });
    expect(a.hold).toEqual(['right', 'fire']);
    expect(pressMaskAt(a.presses, 30)).toBe(buttonMask('jump'));
    expect(pressMaskAt(a.presses, 31)).toBe(0);
    expect(pressMaskAt(a.presses, 46)).toBe(buttonMask('jump', 'fire'));
    expect(a.trace).toEqual(['swan', 'player']);
    expect([a.every, a.count, a.out, a.x]).toEqual([15, 4, 'tmp/arena/x.png', 120]);
    expect(() => parseArenaArgs(['--water', '700-300x'])).toThrow(/x0-x1/);
    expect(() => parseArenaArgs(['--hold', 'right,dance'])).toThrow(/unknown button "dance"/);
    expect(() => parseArenaArgs(['--nope'])).toThrow(/unknown option/);
  });

  it('builds water, pits, platforms, solids, slopes and steps on the floor line', () => {
    const g = new ArenaTerrain(2400).water(300, 700).gap(1200, 48).slope(1300, 48, -48).step(1500, 16).platform(400, 120, 64).solid(800, 138, 32, 32).build();
    const t = g.terrain;
    expect(t.groundY(100)).toBe(FLOOR);
    expect(t.groundY(500)).toBe(FLOOR + 48); // the floor under the water
    expect(g.water).toEqual([{ x: 300, y: FLOOR, w: 400, h: 48 }]);
    expect(g.def.hazards).toContainEqual({ kind: 'water', x: 300, y: FLOOR, w: 400, h: 48 });
    expect(g.def.hazards).toContainEqual({ kind: 'pit', x: 1200, y: FLOOR + 20, w: 48, h: 60 });
    expect(t.groundY(1220)).toBe(Infinity);
    expect(t.groundY(1400)).toBe(FLOOR - 48);
    expect(t.groundY(1600)).toBe(FLOOR - 32);
    // Spawn feet: water surface, the platform over the water, a solid top, a pit's rim.
    expect(g.floorTop(500)).toBe(FLOOR);
    expect(g.floorTop(420)).toBe(120);
    expect(g.floorTop(810)).toBe(138);
    expect(g.floorTop(1220)).toBe(FLOOR);
    expect(() => new ArenaTerrain(2400).water(300, 700).gap(650, 48).build()).toThrow(/overlaps/);
    expect(() => new ArenaTerrain(800).gap(790, 48)).toThrow(/past the arena width/);
  });

  it('makes a free-scrolling mission without a timer, with water decor', () => {
    const { mission } = buildArena(parseArenaArgs(['--water', '200-500', '--x', '90']), null);
    const sec = mission.sections.a;
    expect(mission.id).toBe('arena');
    expect([sec.scroll, sec.timeLimit, sec.height, sec.width]).toEqual(['free', 0, 216, 2400]);
    expect(sec.playerStart).toEqual({ x: 90, y: FLOOR });
    expect(sec.decor?.filter((d) => d.front)).toHaveLength(3); // 300 px cut into 128-px pieces
  });
});

class ArenaTestCar extends Vehicle {
  constructor(w: World, x: number, y: number, p: SpawnParams) {
    super(w, x, y, p, { art: 'vehicle/arena-test-car', w: 40, h: 24, seat: { x: -10, y: -30, w: 20, h: 14 } });
  }
}
defineEntity('arena-test-car', (w, x, y, p) => new ArenaTestCar(w, x, y, p), { category: 'vehicle' });

describe('arena run', () => {
  it('spawns a rifleman and a crate and runs 30 ticks without errors', async () => {
    const io = quiet();
    const a = parseArenaArgs(['--spawn', 'rifleman@+120{gag:false};crate@+50{contains:bombs}', '--ticks', '30', '--trace', 'rifleman', '--trace-every', '10']);
    const r = await runArena(a, { io, save: false });
    expect(r.errors).toEqual([]);
    expect(r.ticks).toBe(30);
    expect(r.alive.rifleman).toBe(1);
    expect(r.alive.crate).toBe(1);
    expect(r.player?.state).toBe('play');
    expect(io.lines.filter((l) => l.startsWith('t=') && l.includes(' rifleman#'))).toHaveLength(4); // t = 0, 10, 20, 30
  });

  it('mounts player 1 in --vehicle over deep water and warns about unknown ids', async () => {
    const io = quiet();
    const a = parseArenaArgs(['--water', '100-900', '--x', '200', '--vehicle', 'arena-test-car', '--spawn', 'no-such-thing@+60', '--ticks', '5']);
    const r = await runArena(a, { io, save: false });
    expect(r.errors).toEqual([]);
    expect(r.player?.state).toBe('mounted');
    expect(r.player?.vehicle).toBe('arena-test-car');
    expect(r.unknownIds).toEqual(['no-such-thing']);
    expect(r.alive['no-such-thing']).toBe(1); // the placeholder
  });
});
