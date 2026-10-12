/**
 * Small synthetic test missions for the bot modes (tests/sim/bot-modes.test.ts, tools): the real
 * missions m1–m5 are built in parallel, so each mode gets a short section of its own here.
 * Registered on import (`defineMission`); ids start with `bot-`.
 */
import { terrain, type MissionDef, type SectionDef } from '../../src/game/mission/index';
import type { Entity } from '../../src/engine/entity';
import { defineMission } from '../../src/game/registry';

const SKY = { sky: 0x203048ff, layers: [] };
const STYLE = { ground: 'dirt', edge: 'grass', platform: 'wood', solid: 'crate' } as const;

function mission(id: string, a: SectionDef): MissionDef {
  const m: MissionDef = { id, name: id.toUpperCase(), music: '', start: 'a', sections: { a } };
  defineMission(m);
  return m;
}

// ---------------------------------------------------------------------------------------------
// FLIGHT: a Trumpeter shoot-em-up in an auto-scrolling sky (like m5-a, 1.0 px/tick).
// ---------------------------------------------------------------------------------------------
const FLIGHT_W = 2000;
export const BOT_FLIGHT = mission('bot-flight', {
  id: 'a',
  width: FLIGHT_W,
  height: 216,
  scroll: 'right',
  background: SKY,
  terrain: terrain(FLIGHT_W, 216).build(),
  terrainStyle: STYLE,
  playerStart: { x: 64, y: 80 },
  startVehicle: 'trumpeter',
  vehicles: ['trumpeter'],
  timeLimit: 0,
  *script(ctx) {
    ctx.autoScroll(1);
    yield 30;
    ctx.spawn('kazoo-drone', ctx.camera.right + 16, 60, { formation: 'v', shooter: 2, tag: 'w' });
    yield 200;
    ctx.spawn('kazoo-drone', ctx.camera.right + 16, 40, { formation: 'sine', shooter: 2, tag: 'w' });
    ctx.spawn('kazoo-drone', ctx.camera.right + 16, 150, { formation: 'sine', shooter: 2, tag: 'w' });
    yield 200;
    ctx.spawn('crate', ctx.camera.left + 300, 20, { chute: true, contains: 'bombs' });
    for (let i = 0; i < 4; i++) ctx.spawn('pickup-gem', ctx.camera.right + 40 + i * 24, 170 - i * 10, { kind: 'golden-note', float: true });
    ctx.spawn('baton-copter', ctx.camera.right + 24, 60, { mode: 'air' });
    ctx.spawn('baton-copter', ctx.camera.right + 24, 150, { mode: 'air' });
    yield 300;
    ctx.spawn('kazoo-drone', ctx.camera.right + 16, 50, { formation: 'dive', shooter: 2, tag: 'w' });
    yield ctx.waitCamera(FLIGHT_W - 384);
    ctx.autoScroll(0);
    yield 60;
    yield ctx.missionComplete();
  },
});

// ---------------------------------------------------------------------------------------------
// SWAN: a parked Swan, then a pit, a wall, a deep river with a high bank, a long pit (glide only)
// and soldiers on the way (like m1-c / m3-a).
// ---------------------------------------------------------------------------------------------
const SWAN_W = 2800;
const SG = 160;
const ts = terrain(SWAN_W, 216);
ts.ground().at(0, SG).flat(500).gap(110).flat(300).step(48).flat(720).step(-48).flat(270).gap(220).flat(680);
ts.hazard('pit', 500, SG + 24, 110, 40).hazard('pit', 1900, SG + 24, 220, 40);
ts.hazard('water', 910, SG, 720, 216 - SG);
// A jetty over the river (a one-way platform 24 px over the water).
ts.platform(1260, SG - 24, 120);
ts.solid(760, SG - 56, 24, 56);
export const BOT_SWAN = mission('bot-swan', {
  id: 'a',
  width: SWAN_W,
  height: 216,
  scroll: 'right',
  background: SKY,
  terrain: ts.build(),
  terrainStyle: STYLE,
  playerStart: { x: 40, y: SG },
  vehicles: ['swan'],
  timeLimit: 0,
  *script(ctx) {
    ctx.spawn('swan', 160, 'ground');
    ctx.spawn('rifleman', 420, 'ground', { gag: false, facing: -1 });
    yield ctx.waitCamera(400);
    ctx.spawn('rifleman', 860, 'ground', { gag: false, facing: -1 });
    ctx.spawn('rifleman', 1800, 'ground', { gag: false, facing: -1 });
    yield ctx.waitPlayerX(2700);
    yield ctx.missionComplete();
  },
});

// ---------------------------------------------------------------------------------------------
// UP: a vertical climb (like m3-b1): two stacks of alternating ledges 36 px apart joined by a
// cable car that rises 400 px while ridden; the exit at the top.
// ---------------------------------------------------------------------------------------------
const UP_H = 1200;
const tu = terrain(384, UP_H);
tu.ground().at(0, UP_H - 24).flat(384);
tu.solid(0, 0, 24, UP_H).solid(360, 0, 24, UP_H);
const UG = UP_H - 24;
for (let k = 1; k <= 8; k++) tu.platform(k % 2 ? 24 : 184, UG - 36 * k, 176);
// Lower stack top: UG − 288 (x 184–360). The car waits 16 px above it and rises to CAR_TOP.
const CAR_Y = UG - 36 * 8 - 16;
const CAR_TOP = CAR_Y - 400;
for (let k = 1; CAR_TOP - 36 * k > 30; k++) tu.platform(k % 2 ? 184 : 24, CAR_TOP - 36 * k, 176);
export const BOT_UP = mission('bot-up', {
  id: 'a',
  width: 384,
  height: UP_H,
  scroll: 'up',
  background: SKY,
  terrain: tu.build(),
  terrainStyle: STYLE,
  playerStart: { x: 192, y: UG },
  checkpoints: [800],
  timeLimit: 0,
  exits: [{ id: 'top', rect: { x: 140, y: 0, w: 104, h: 24 }, to: 'complete' }],
  *script(ctx) {
    ctx.spawn('cable-car', 282, CAR_Y, { toY: CAR_TOP });
    ctx.spawn('rifleman', 100, UG - 36 * 3, { gag: false, facing: 1 });
    ctx.spawn('pickup-bombs', 300, UG - 36 * 4, {});
  },
});

// ---------------------------------------------------------------------------------------------
// DOWN: a vertical descent (like m5-b): alternating one-way ledges 48 px apart (drop through
// them), a bellows platform, a solid block to walk off, the exit door at the bottom.
// ---------------------------------------------------------------------------------------------
const DN_H = 1200;
const td = terrain(384, DN_H);
td.ground().at(0, DN_H - 16).flat(384);
td.solid(0, 0, 24, DN_H).solid(360, 0, 24, DN_H);
td.platform(144, 72, 96);
for (let k = 0; 120 + 48 * k < DN_H - 120; k++) if (k !== 8) td.platform(k % 2 ? 144 : 24, 120 + 48 * k, 216);
// A solid shelf (no drop-through: walk off its edge).
td.solid(24, 120 + 48 * 8, 200, 12);
export const BOT_DOWN = mission('bot-down', {
  id: 'a',
  width: 384,
  height: DN_H,
  scroll: 'down',
  background: SKY,
  terrain: td.build(),
  terrainStyle: STYLE,
  playerStart: { x: 192, y: 72 },
  timeLimit: 0,
  exits: [{ id: 'door', rect: { x: 150, y: DN_H - 40, w: 84, h: 24 }, to: 'complete' }],
  *script(ctx) {
    ctx.spawn('bellows-platform', 192, 120 + 48 * 13, {});
    ctx.spawn('rifleman', 300, 120 + 48 * 5, { gag: false, facing: -1 });
  },
});

// ---------------------------------------------------------------------------------------------
// RIDES: a wide pit crossed by a cable car (it waits for a rider), then deep water with a
// drifting duck float in the middle (wait for it, hop on, hop off).
// ---------------------------------------------------------------------------------------------
const RD_W = 1600;
const RG = 160;
const tr = terrain(RD_W, 216);
tr.ground().at(0, RG).flat(400).gap(320).flat(260).step(56).flat(170).step(-56).flat(450);
tr.hazard('pit', 400, RG + 24, 320, 40);
tr.hazard('water', 980, RG + 10, 170, 216 - RG - 10);
export const BOT_RIDES = mission('bot-rides', {
  id: 'a',
  width: RD_W,
  height: 216,
  scroll: 'right',
  background: SKY,
  terrain: tr.build(),
  terrainStyle: STYLE,
  playerStart: { x: 40, y: RG },
  timeLimit: 0,
  *script(ctx) {
    ctx.spawn('cable-car', 432, RG, { toX: 688, toY: RG });
    ctx.spawn('duck-float', 1065, RG + 10, { drift: 40 });
    yield ctx.waitPlayerX(1500);
    yield ctx.missionComplete();
  },
});

// ---------------------------------------------------------------------------------------------
// SWAN WALL: a swan-only body wall throws the pilot out (like m3-a's cliff); he goes on on foot
// and does not climb back into her.
// ---------------------------------------------------------------------------------------------
const tw = terrain(1400, 216);
tw.ground().at(0, SG).flat(1400);
export const BOT_SWAN_WALL = mission('bot-swan-wall', {
  id: 'a',
  width: 1400,
  height: 216,
  scroll: 'right',
  background: SKY,
  terrain: tw.build(),
  terrainStyle: STYLE,
  playerStart: { x: 40, y: SG },
  vehicles: ['swan'],
  timeLimit: 0,
  *script(ctx) {
    ctx.spawn('swan', 160, 'ground');
    ctx.bodyWall(700, {
      filter: (e) => e.type === 'swan',
      onTouch: (e) => {
        const v = e as Entity & { state?: string; eject?: (mode: 'forced') => void; body: { onGround: boolean } | null };
        if (v.state === 'driven' && v.body?.onGround) v.eject?.('forced');
      },
    });
    yield ctx.waitPlayerX(1300);
    yield ctx.missionComplete();
  },
});
