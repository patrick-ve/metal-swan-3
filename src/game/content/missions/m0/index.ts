/**
 * Mission m0 — the TEST RANGE (docs/ARCHITECTURE.md §6.2). A compact mission that exercises
 * every system the real missions use, for tools, tests and the bot:
 *
 * - `a` (2400 px): flat → 1:1 slope up → plateau with platforms → slope down → pit gap →
 *   solid stairs → arena (camera lock, 2 rifleman waves) → machine-gun crate → hostage (bombs)
 *   → route choice: UPPER (climb the platforms) → `b1`, LOWER (walk on) → `b2`.
 * - `b1` (960 px, rooftops) and `b2` (960 px, a drain with a low ceiling) both exit into `c`.
 * - `c` (1152 px): a boss arena: CRATE COLOSSUS (boss.ts) → mission complete.
 *
 * Backgrounds and terrain use the standard generator / material ids (the art agent's
 * fallbacks are fine while they are missing).
 */
import { PAL } from '../../../../engine/palette';
import type { Entity } from '../../../../engine/entity';
import { Boss } from '../../../boss';
import { terrain, type BackgroundDef, type MissionDef, type SectionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './boss';
import './sprites';

/** The standard ground line (GDD conventions). */
const G = 176;

// ---------------------------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------------------------

const BG_RANGE: BackgroundDef = {
  sky: PAL.sky[3],
  layers: [
    { gen: 'sky-gradient', params: { ramp: 'sky' }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.14, count: 4 }, factorX: 0.05 },
    { gen: 'mountains', params: { ramp: [PAL.steel[2], PAL.steel[3], PAL.sky[2], PAL.snow[0]], y: 0.28, height: 0.42, snow: 0.7, layers: 2 }, factorX: 0.1 },
    { gen: 'hills', params: { y: 0.58, height: 0.2 }, factorX: 0.25 },
    { gen: 'treeline', params: { y: 0.66, size: 8 }, factorX: 0.45 },
  ],
};

const BG_ROOFTOPS: BackgroundDef = {
  sky: PAL.purple[1],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.navy[1], PAL.purple[1], PAL.pink[1], PAL.orange[2]], sun: { x: 0.7, y: 0.7, r: 12 } }, factorX: 0 },
    { gen: 'city', params: { y: 0.28, height: 0.55, ramp: [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.steel[0], PAL.steel[1]], lit: 0.25 }, factorX: 0.15 },
    { gen: 'city', params: { y: 0.42, height: 0.5, lit: 0.4 }, factorX: 0.35 },
  ],
};

const BG_DRAIN: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.steel[0]] }, factorX: 0 },
    { gen: 'ruins', params: { ramp: [PAL.ink[1], PAL.navy[0], PAL.steel[0], PAL.steel[1]], y: 0.25, height: 0.6 }, factorX: 0.2 },
  ],
};

const BG_ARENA: BackgroundDef = {
  sky: PAL.orange[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.purple[1], PAL.pink[1], PAL.red[3], PAL.orange[2], PAL.gold[2]], sun: { x: 0.6, y: 0.62, r: 14 } }, factorX: 0 },
    { gen: 'mountains', params: { ramp: [PAL.rust[1], PAL.sand[0], PAL.sand[1], PAL.sand[2]], y: 0.4, height: 0.3, scale: 100 }, factorX: 0.1 },
    { gen: 'dunes', params: { y: 0.62, height: 0.3 }, factorX: 0.3 },
  ],
};

// ---------------------------------------------------------------------------------------------
// Section a — the range (2400 px)
// ---------------------------------------------------------------------------------------------

const A_W = 2400;
const ta = terrain(A_W, 216);
// Flat 0–420, 1:1 slope up to the plateau (y 128), plateau 468–1000, slope down, flat, pit
// 1240–1296, flat to the end.
ta.ground().at(0, G).flat(420).slope(48, -48).flat(532).slope(48, 48).flat(192).gap(56).flat(1104);
ta.hazard('pit', 1240, G + 20, 56, 60);
// Platforms over the plateau (32 and 42 px up).
ta.platform(548, 96, 72);
ta.platform(668, 86, 88);
// Stairs of solid blocks, up three steps and down one.
ta.solid(1440, G - 16, 32, 16).solid(1472, G - 32, 32, 32).solid(1504, G - 48, 32, 48).solid(1536, G - 24, 24, 24);
// The route choice: a platform staircase to the UPPER exit; the LOWER exit at ground level.
ta.platform(2140, 142, 56);
ta.platform(2206, 110, 56);
ta.platform(2272, 78, 128);

const sectionA: SectionDef = {
  id: 'a',
  name: 'The Range',
  width: A_W,
  height: 216,
  scroll: 'right',
  background: BG_RANGE,
  terrain: ta.build(),
  terrainStyle: { ground: 'dirt', edge: 'grass', platform: 'wood', solid: 'crate' },
  decor: [
    { sprite: 'decor/m0/sign', frame: 2, x: 96, y: G },
    { sprite: 'decor/m0/target', x: 160, y: G },
    { sprite: 'decor/m0/target', x: 980, y: 128 + 0 },
    { sprite: 'decor/m0/target', x: 1380, y: G },
    { sprite: 'decor/m0/sign', frame: 0, x: 2112, y: G },
    { sprite: 'decor/m0/sign', frame: 1, x: 2236, y: G },
  ],
  playerStart: { x: 48, y: G },
  checkpoints: [1200, 2000],
  exits: [
    { id: 'upper', rect: { x: 2330, y: 30, w: 70, h: 49 }, to: 'b1', disabled: true },
    { id: 'lower', rect: { x: 2366, y: 140, w: 34, h: 76 }, to: 'b2', disabled: true },
  ],
  *script(ctx) {
    // Opening: one soldier in a gag, one on guard, a bomb crate to try the knife on.
    ctx.spawn('crate', 250, 'ground', { contains: 'bombs' });
    ctx.spawn('rifleman', 330, 'ground', { gag: true, facing: -1 });
    ctx.spawn('rifleman', 372, 'ground', { gag: false, facing: -1 });
    yield ctx.waitCamera(260);
    // The plateau: a sentry on the high ledge, a patrol, a food crate.
    ctx.spawn('crate', 620, 128, { contains: 'food' });
    ctx.spawn('rifleman', 712, 86, { gag: false, facing: -1 });
    ctx.spawn('rifleman', 860, 128, { patrol: 48, gag: false, facing: -1 });
    yield ctx.waitCamera(760);
    // Runners from the right.
    ctx.enter('rifleman', 'right', { tag: 'runners' });
    yield 50;
    ctx.enter('rifleman', 'right', { tag: 'runners' });
    yield ctx.waitCamera(1180);
    // Past the pit: one drops in, one waits behind the stairs; the arena cover crate appears.
    ctx.enter('rifleman', 'top', { x: 1440, tag: 'stairs' });
    ctx.spawn('rifleman', 1580, 'ground', { entry: 'popup', facing: -1, tag: 'stairs' });
    ctx.spawn('crate', 1700, 'ground', { contains: 'gem' });
    yield ctx.waitCamera(1600);
    // Arena: the camera locks for two waves.
    ctx.lockCamera(1600, 1984);
    ctx.spawn('hostage', 2070, 'ground', { gives: 'bombs' });
    for (let i = 0; i < 3; i++) {
      ctx.enter('rifleman', 'right', { tag: 'w1' });
      yield ctx.rng.int(30, 60);
    }
    yield ctx.waitClear('w1');
    yield 45;
    ctx.enter('rifleman', 'top', { x: 1720, tag: 'w2' });
    yield 20;
    ctx.enter('rifleman', 'top', { x: 1880, tag: 'w2' });
    yield 40;
    ctx.enter('rifleman', 'left', { tag: 'w2' });
    ctx.enter('rifleman', 'right', { tag: 'w2' });
    yield ctx.waitClear('w2');
    // Reward: a machine-gun crate drops into the arena.
    ctx.spawn('crate', 1860, ctx.camera.top - 24, { contains: 'machine-gun' });
    yield 60;
    ctx.unlockCamera();
    ctx.setCheckpoint();
    yield ctx.waitCamera(1990);
    ctx.enableExit('upper');
    ctx.enableExit('lower');
    ctx.banner('PICK A ROUTE', { style: 'info', ticks: 150 });
  },
};

// ---------------------------------------------------------------------------------------------
// Section b1 — the upper route: rooftops (960 px)
// ---------------------------------------------------------------------------------------------

const B_W = 960;
const R = 120; // roof line
const tb1 = terrain(B_W, 216);
tb1.ground().at(0, R).flat(250).gap(56).flat(210).step(-16).flat(150).gap(48).flat(246);
tb1.hazard('pit', 250, R + 24, 56, 120).hazard('pit', 666, R + 8, 48, 140);
tb1.platform(380, 84, 48);
tb1.solid(560, R - 48, 20, 32);

const sectionB1: SectionDef = {
  id: 'b1',
  name: 'Rooftops',
  width: B_W,
  height: 216,
  scroll: 'right',
  background: BG_ROOFTOPS,
  terrain: tb1.build(),
  terrainStyle: { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick' },
  playerStart: { x: 32, y: R },
  checkpoints: [480],
  exits: [{ id: 'end', rect: { x: B_W - 30, y: 0, w: 30, h: 216 }, to: 'c' }],
  *script(ctx) {
    ctx.spawn('rifleman', 190, 'ground', { patrol: 40, gag: false, facing: -1 });
    ctx.spawn('crate', 440, 'ground', { contains: 'gem' });
    yield ctx.waitCamera(100);
    ctx.spawn('rifleman', 600, 'ground', { gag: 'nap', facing: 1 });
    ctx.spawn('rifleman', 636, 'ground', { gag: true, facing: -1 });
    yield ctx.waitCamera(300);
    ctx.enter('rifleman', 'top', { x: ctx.camera.centerX + 90, params: { entry: 'parachute' } });
    yield 40;
    ctx.enter('rifleman', 'top', { x: ctx.camera.centerX + 150 });
    yield ctx.waitCamera(470);
    ctx.spawn('rifleman', 870, 'ground', { entry: 'popup', facing: -1 });
    ctx.enter('rifleman', 'right', {});
  },
};

// ---------------------------------------------------------------------------------------------
// Section b2 — the lower route: a drain with a low ceiling (960 px)
// ---------------------------------------------------------------------------------------------

const tb2 = terrain(B_W, 216);
tb2.ground().at(0, G).flat(B_W);
tb2.solid(260, 0, 420, 92);
tb2.solid(420, G - 16, 24, 16).solid(610, G - 16, 24, 16);

const sectionB2: SectionDef = {
  id: 'b2',
  name: 'Drain',
  width: B_W,
  height: 216,
  scroll: 'right',
  background: BG_DRAIN,
  terrain: tb2.build(),
  terrainStyle: { ground: 'rock', edge: 'moss', platform: 'wood', solid: 'rock' },
  playerStart: { x: 32, y: G },
  checkpoints: [480],
  exits: [{ id: 'end', rect: { x: B_W - 30, y: 0, w: 30, h: 216 }, to: 'c' }],
  *script(ctx) {
    ctx.spawn('hostage', 330, 'ground', { gives: 'machine-gun' });
    ctx.spawn('rifleman', 452, 'ground', { entry: 'popup', facing: -1 });
    yield ctx.waitCamera(200);
    ctx.spawn('rifleman', 642, 'ground', { entry: 'popup', facing: -1 });
    ctx.enter('rifleman', 'right', {});
    yield ctx.waitCamera(450);
    ctx.spawn('crate', 760, 'ground', { contains: 'bombs' });
    ctx.enter('rifleman', 'right', {});
    yield 60;
    ctx.enter('rifleman', 'left', {});
  },
};

// ---------------------------------------------------------------------------------------------
// Section c — the boss arena (1152 px)
// ---------------------------------------------------------------------------------------------

const C_W = 1152;
const tc = terrain(C_W, 216);
tc.ground().at(0, G).flat(C_W);
tc.solid(470, G - 16, 28, 16);

const sectionC: SectionDef = {
  id: 'c',
  name: 'Boss Arena',
  width: C_W,
  height: 216,
  scroll: 'right',
  background: BG_ARENA,
  terrain: tc.build(),
  terrainStyle: { ground: 'sand', edge: 'sand', platform: 'metal', solid: 'metal' },
  decor: [{ sprite: 'decor/m0/sign', frame: 3, x: 640, y: G }],
  playerStart: { x: 32, y: G },
  bossStart: { x: 820, y: G },
  checkpoints: [600],
  *script(ctx) {
    if (!ctx.bossRush) {
      ctx.spawn('crate', 360, 'ground', { contains: 'bombs' });
      ctx.spawn('rifleman', 430, 'ground', { gag: true, facing: -1 });
      yield ctx.waitCamera(260);
      ctx.enter('rifleman', 'right', {});
      yield 70;
      ctx.enter('rifleman', 'right', {});
      yield ctx.waitCamera(700);
    }
    ctx.lockCamera(768, C_W);
    ctx.spawn('crate', 860, 'ground', { contains: 'machine-gun' });
    yield 30;
    const boss: Entity = ctx.spawn('m0-crate-colossus', 1066, ctx.camera.top - 90, { facing: -1 });
    yield ctx.bossIntro('CRATE COLOSSUS');
    // Fail soft: without the boss module the fight is skipped after a short pause.
    if (boss instanceof Boss) yield () => boss.defeated;
    else yield 120;
    yield 90;
    yield ctx.missionComplete();
  },
};

export const M0: MissionDef = {
  id: 'm0',
  name: 'TEST RANGE',
  subtitle: 'MISSION 0',
  music: 'm0',
  bossMusic: 'boss',
  start: 'a',
  bossSection: 'c',
  sections: { a: sectionA, b1: sectionB1, b2: sectionB2, c: sectionC },
  // Hostages per section (STANDING OVATION): a 1, b2 (the drain) 1.
  hostages: { a: 1, b2: 1 },
};

defineMission(M0);
