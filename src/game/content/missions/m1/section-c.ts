/**
 * m1-c — River Run (GDD §11.1, docs/design/swan-mount/levels.md §3): 3000×216, scroll right,
 * checkpoints 900, 1900, 2616, vehicles allowed: `swan`. The showcase of the ridden SWAN-3: the
 * DRUM LINE stomp lesson, the tank hurdle, the SLIPWAY LEAP, the judges' box glide, the BOAT HOP,
 * the Mk1 gag, the willow bridge, the TIMPANI MINEFIELD and THE ENCORE on the river Wend.
 * On foot the river is crossed by lily pads, jetties, islands and a rubber duck (no gap > 48 px).
 */
import type { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import { hudOf } from '../../../context';
import { awardScore } from '../../../events';
import { terrain, type BackgroundDef, type DecorDef, type SectionContext, type SectionDef } from '../../../mission/index';
import type { Player } from '../../../player/player';
import { CALLOUTS, HINTS } from '../../../scenes/flow-data';
import { isSwan } from '../../vehicles/swan/swan';
import { DrumMine } from './entities';
import { at, crate, fromRight, G, hostage, normalUp, twoPlayers, waitBoss, waterDecor, WATER_Y } from './helpers';

export const C_W = 3000;
/** Boss arena: the view lock and the invisible body wall (GDD §10.1). */
export const ARENA_X = 2616;
export const BOSS_WALL_X = 2844;
/** THE ENCORE's anchor in phase 1: the bow tip at view x 232, on the water line. */
export const BOSS_X = 2848;

/** Lily pads (left edges; 24 wide, top y 178). */
export const PADS: readonly number[] = [924, 1328, 1530, 1580, 1630, 1680, 1730, 1990, 2040, 2330, 2380, 2560];
/** Jetties (x0, x1) at y 168. */
export const JETTIES: readonly (readonly [number, number])[] = [
  [980, 1120],
  [1380, 1500],
  [1790, 1960],
];
/** Islands (x0, x1) at y 172. */
export const ISLANDS: readonly (readonly [number, number])[] = [
  [1160, 1300],
  [2100, 2300],
];
/** The TIMPANI MINEFIELD: mine centres. */
export const MINES: readonly number[] = [2430, 2454, 2478, 2502, 2526];

const BG_RIVER: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[2], PAL.sky[3], PAL.snow[2], PAL.gold[3]] }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.1, count: 4, ramp: [PAL.snow[1], PAL.snow[2], PAL.snow[3]] }, factorX: 0.1, driftX: 0.05 },
    { gen: 'hills', params: { y: 0.36, height: 0.3, ramp: [PAL.green[1], PAL.green[2], PAL.green[3]] }, factorX: 0.2 },
    { gen: 'treeline', params: { y: 0.42, height: 0.3, size: 11, ramp: [PAL.green[0], PAL.green[1], PAL.green[2]] }, factorX: 0.35 },
    { gen: 'far-bank', params: { y: 0.5 }, factorX: 0.5 },
    { gen: 'reeds', params: { density: 0.35 }, factorX: 1.2, height: 36, offsetY: 180, front: true },
  ],
};

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

const t = terrain(C_W, 216);
// The bank, then the regatta slipway into the water (y 200 at x 900).
t.ground().at(0, G).flat(780).slope(120, 24);
for (const [x0, x1] of ISLANDS) t.ground().at(x0, 172).flat(x1 - x0);
t.hazard('water', 800, WATER_Y, C_W - 800, 216 - WATER_Y);
for (const [x0, x1] of JETTIES) t.platform(x0, 168, x1 - x0);
t.platform(1196, 144, 36); // judges' box ladder step
t.platform(1240, 116, 56); // the judges' box
t.platform(ARENA_X, 176, 224); // the boss pontoon

const decor: DecorDef[] = [
  { sprite: 'decor/m1/note', x: 196, y: G },
  { sprite: 'decor/m1/lamp', x: 300, y: G },
  { sprite: 'decor/m1/ducks', x: 470, y: G },
  { sprite: 'decor/m1/flowers', x: 600, y: G },
  { sprite: 'decor/m1/sign-no-diving', x: 772, y: G },
  { sprite: 'decor/m1/judges-box', x: 1236, y: 172 },
  { sprite: 'decor/m1/fishing-post', x: 2184, y: 172 },
  { sprite: 'decor/m1/sign-timpani', x: 2288, y: 172 },
  ...JETTIES.flatMap(([x0, x1]) => {
    const out: DecorDef[] = [];
    for (let x = x0 + 4; x < x1; x += 34) out.push({ sprite: 'decor/m1/post', x, y: 171 });
    out.push({ sprite: 'decor/m1/post', x: x1 - 4, y: 171 });
    return out;
  }),
  ...Array.from({ length: 7 }, (_, i): DecorDef => ({ sprite: 'decor/m1/pontoon-drum', x: ARENA_X + 16 + i * 32, y: 178 })),
  ...waterDecor(800, 900, WATER_Y, 216 - WATER_Y, false),
  ...waterDecor(900, C_W),
];

// ---------------------------------------------------------------------------------------------
// Script pieces
// ---------------------------------------------------------------------------------------------

/** A live player within 64 px of a live Swan (no allocation: this runs every tick). */
function playerAtSwan(ctx: SectionContext): Player | null {
  const vs = ctx.world.byTag('vehicle');
  for (let i = 0; i < vs.length; i++) {
    const s = vs[i];
    if (!isSwan(s) || !s.alive) continue;
    for (const p of ctx.players) {
      if (p.alive && p.state === 'play' && Math.abs(p.x - s.x) < 64) return p;
    }
  }
  return null;
}

/** Gramps on the radio: a navy bubble over a player. */
function radio(ctx: SectionContext, p: Entity, text: string, ticks = 150): void {
  hudOf(ctx.world).bubble(p, text, { kind: 'radio', ticks });
}

function hasGramps(ctx: SectionContext): boolean {
  return ctx.players.some((p) => p.character.id === 'gramps');
}

/** The parked Swan's note and Gramps' radio line when a player walks up to her. */
function* swanGreeting(ctx: SectionContext): ScriptGen {
  let near: Player | null = null;
  yield 150; // after the start banner
  yield () => (near = playerAtSwan(ctx)) !== null;
  if (!near) return;
  // Met her already in Amsterdam (ams-b): a "welcome back" variant.
  const met = ctx.records.get<boolean>('ams/swan-met', false);
  hudOf(ctx.world).bubble({ x: 196, y: 140 }, met ? 'SWAN-3. BACK FROM SHORE LEAVE. -G.' : 'SWAN-3. PLEASE RETURN BY 6 PM. -G.', { kind: 'hint', ticks: 150 });
  yield 30;
  if (met) radio(ctx, near, 'GRAMPS: SHE MISSED YOU ALREADY!');
  else radio(ctx, near, hasGramps(ctx) ? 'GRAMPS: THERE SHE IS!' : 'GRAMPS: BE GENTLE WITH HER!');
}

/** The first mount of a Swan in this mission: the glide lesson on the radio. */
function* swanLesson(ctx: SectionContext): ScriptGen {
  let rider: Entity | null = null;
  const off = ctx.world.events.on('vehicleMounted', (e) => {
    if (!rider && isSwan(e.vehicle)) rider = e.player;
  });
  try {
    yield () => rider !== null;
  } finally {
    off();
  }
  if (ctx.records.get('m1/swan-lesson', false)) return;
  ctx.records.set('m1/swan-lesson', true);
  const p = rider as Entity | null;
  if (!p) return;
  yield 30;
  radio(ctx, p, 'GRAMPS: SHE GLIDES NOW.', 110);
  yield 120;
  radio(ctx, p, 'HOLD JUMP IN THE AIR.', 110);
}

/** DRUM LINE: a STOMP! hint over the front drummer if nobody stomps one within 240 ticks. */
function* stompHint(ctx: SectionContext, drummers: readonly Entity[]): ScriptGen {
  let stomped = false;
  const off = ctx.world.events.on('enemyKilled', (e) => {
    if (e.enemy.type === 'drummer' && e.damage.kind === 'crush') stomped = true;
  });
  try {
    yield () => drummers.some((d) => d.alive && d.onScreen(0));
    yield 240;
    if (stomped) return;
    let front: Entity | null = null;
    for (const d of drummers) if (d.alive && (!front || d.x < front.x)) front = d;
    if (front) hudOf(ctx.world).pointer(front, HINTS.stomp, { ticks: 360 });
  } finally {
    off();
  }
}

/** TIMPANI MINEFIELD: DRUM ROLL! when one player-started chain sets off all five mines. */
function* drumRoll(ctx: SectionContext, mines: readonly Entity[]): ScriptGen {
  yield () => mines.every((m) => !m.alive);
  const first = mines[0];
  if (!(first instanceof DrumMine)) return;
  const chain = first.chain;
  if (!chain || !chain.byShot || chain.owner < 0) return;
  if (!mines.every((m) => m instanceof DrumMine && m.chain === chain)) return;
  ctx.callout(CALLOUTS.drumRoll);
  awardScore(ctx.world, chain.owner, 1000);
}

/** The boss fight: lock, crate, THE ENCORE, the body wall until its death sequence. */
function* bossFight(ctx: SectionContext): ScriptGen {
  ctx.lockCamera(ARENA_X, C_W);
  crate(ctx, 2640, 'S', 176);
  const wall = ctx.bodyWall(BOSS_WALL_X, { keep: 'left' });
  const boss = ctx.spawn('encore', BOSS_X, WATER_Y, { facing: -1 });
  ctx.world.scripts.run(function* wallWatch() {
    yield () => !boss.alive || (boss instanceof Boss && (boss.state === 'dying' || boss.state === 'done'));
    wall.remove();
  });
  yield ctx.bossIntro('THE ENCORE', { subtitle: 'COMMODORE BLARE WILL NOT LEAVE THE STAGE' });
  yield* waitBoss(boss);
  wall.remove();
  yield 90;
  yield ctx.missionComplete();
}

export const sectionC: SectionDef = {
  id: 'c',
  name: 'River Run',
  width: C_W,
  height: 216,
  scroll: 'right',
  background: BG_RIVER,
  terrain: t.build(),
  terrainStyle: { ground: 'mud', edge: 'grass', platform: 'wood', solid: 'crate' },
  decor,
  playerStart: { x: 48, y: G },
  bossStart: { x: 2660, y: 176 },
  checkpoints: [900, 1900, ARENA_X],
  vehicles: ['swan'],
  *script(ctx) {
    // Lily pads, the duck, the Mk1 head and the arena crates are there from the start.
    for (const x of PADS) ctx.spawn('lily-pad', x + 12, 178);
    ctx.spawn('duck-float', 2480, WATER_Y, { drift: 40 });
    ctx.spawn('mk1-head', 1520, WATER_Y);
    ctx.spawn('m1-float-crate', 2700, 150);
    ctx.spawn('m1-float-crate', 2760, 136);
    ctx.world.scripts.run(swanLesson(ctx));

    if (ctx.bossRush) {
      ctx.spawn('swan', 2700, 176, { facing: 1 });
      if (twoPlayers(ctx)) ctx.spawn('swan', 2760, 176, { variant: 'mute', facing: 1 });
      yield* bossFight(ctx);
      return;
    }

    // The parked SWAN-3 (and the Mute for player 2) with Grace's note.
    ctx.spawn('swan', 160, 'ground', { facing: 1 });
    if (twoPlayers(ctx)) ctx.spawn('swan', 112, 'ground', { variant: 'mute', facing: 1 });
    ctx.world.scripts.run(swanGreeting(ctx));

    // @0: first targets for the Swan.
    for (let i = 0; i < 3; i++) fromRight(ctx, 'rifleman', { entry: 'walk', outfit: 'deck' }, 16, undefined, i * 30);

    // @100: the DRUM LINE.
    yield ctx.waitCamera(100);
    const drummers: Entity[] = [];
    for (let i = 0; i < 3; i++) drummers.push(fromRight(ctx, 'drummer', { column: 'c1', march: 0.5 }, 16, 'drums', i * 36));
    fromRight(ctx, 'baton-major', { column: 'c1' }, 16, 'drums', 72 + 80);
    hostage(ctx, 'critic', 'chair', 640, 'M');
    ctx.world.scripts.run(stompHint(ctx, drummers));

    // @360: the tank parks in front of the slipway (leashed to x 744).
    yield ctx.waitCamera(360);
    ctx.enter('oompah-tank', 'right', { margin: 48, params: { stopX: 720, maxX: 744 } });
    if (normalUp(ctx)) {
      yield 60;
      fromRight(ctx, 'rifleman', { outfit: 'deck' });
      yield 30;
      fromRight(ctx, 'rifleman', { outfit: 'deck' });
    }

    // @560: SLIPWAY LEAP.
    yield ctx.waitCamera(560);
    ctx.enter('rowboat', 'right', { margin: 48, y: WATER_Y, params: { stopX: 960, outfit: 'deck' } });
    ctx.spawn('bullfrog', 800, 'ground', { entry: 'hop', facing: -1 });
    ctx.spawn('bullfrog', 850, 'ground', { entry: 'hop', facing: -1 });
    at(ctx, 'bullfrog', 1090, { facing: -1 }, 168);

    // @700: the judges' box and the glide trail to jetty 2.
    yield ctx.waitCamera(700);
    hostage(ctx, 'tourist', 'sack', 1200, 'auto', 172);
    crate(ctx, 1268, 'H', 116);
    for (const [x, y] of [[1333, 117], [1351, 124], [1368, 132], [1386, 140], [1403, 148]] as const) {
      ctx.spawn('pickup-gem', x, y, { kind: 'golden-note', float: true });
    }

    // @900 (checkpoint): the piano bomber.
    yield ctx.waitCamera(900);
    ctx.enter('piano-bomber', 'right', { y: 32 });

    // @1200: BOAT HOP.
    yield ctx.waitCamera(1200);
    ctx.enter('rowboat', 'right', { margin: 48, y: WATER_Y, params: { stopX: 1596, outfit: 'deck' } });
    ctx.enter('rowboat', 'right', { margin: 120, y: WATER_Y, params: { stopX: 1668, outfit: 'deck' } });

    // @1500: the tank barge, the willow and its boats.
    yield ctx.waitCamera(1500);
    ctx.enter('tank-barge', 'right', { margin: 48, y: WATER_Y, params: { outfit: 'deck' } });
    ctx.spawn('willow-tree', 1940, 168, { dir: 1 });
    ctx.spawn('rowboat', 2000, WATER_Y, { outfit: 'deck', facing: -1 });
    ctx.spawn('rowboat', 2060, WATER_Y, { outfit: 'deck', facing: -1 });
    at(ctx, 'oompah-trooper', 1900, { facing: -1 }, 168);

    // @1700: island 2: the tuba cage on the fishing post, bombs.
    yield ctx.waitCamera(1700);
    hostage(ctx, 'roadie', 'cage', 2200, 'T', 150, { ropeTop: 100 });
    crate(ctx, 2280, 'bombs', 172);

    // @1900 (checkpoint): bullfrogs, a waiting boat and the TIMPANI MINEFIELD (out of view).
    yield ctx.waitCamera(1900);
    at(ctx, 'bullfrog', 2002, { entry: 'hop', facing: -1 }, 178);
    at(ctx, 'bullfrog', 2150, { entry: 'hop', facing: -1 }, 172);
    at(ctx, 'bullfrog', 2200, { entry: 'hop', facing: -1 }, 172);
    ctx.spawn('rowboat', 2350, WATER_Y, { outfit: 'deck', facing: -1 });
    const mines = MINES.map((x) => ctx.spawn('drum-mine', x, WATER_Y));
    ctx.world.scripts.run(drumRoll(ctx, mines));

    yield ctx.waitCamera(2300);
    if (normalUp(ctx)) ctx.enter('piano-bomber', 'left', { y: 32, params: { dir: 1, from: 'left' } });

    // @2616 (checkpoint): THE ENCORE.
    yield ctx.waitCamera(ARENA_X);
    yield* bossFight(ctx);
  },
};

export const C_IDS: readonly string[] = [
  'lily-pad', 'duck-float', 'mk1-head', 'm1-float-crate', 'swan', 'rifleman', 'drummer', 'baton-major', 'hostage', 'oompah-tank',
  'rowboat', 'bullfrog', 'crate', 'pickup-gem', 'piano-bomber', 'tank-barge', 'willow-tree', 'oompah-trooper', 'drum-mine',
];
