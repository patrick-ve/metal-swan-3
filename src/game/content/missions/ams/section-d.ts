/**
 * ams-d — STOPERA (docs/design/amsterdam.md §6): 1280×216, scroll right, orange-pink sunset,
 * vehicles: `swan`. The Waterlooplein flea market (0–896) and the boss arena (896–1280) in front of
 * the Stopera: the curved white music theatre and the red-brick city hall, whose big glass doors
 * (centre x 1190) ROBO-HALSEMA steps out of. bossStart x 900.
 *
 * Script: the flea market, the arena lock with a body wall in front of her, ROBO-HALSEMA (boss
 * `ams-mayor`), then the baker and the staff cheer and MISSION COMPLETE.
 */
import { isPlayer } from '../../../player/player';
import { PAL } from '../../../../engine/palette';
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import type { BackgroundDef, DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { HOUSE, houseRow } from './art';
import { AmsPerson } from './entities';
import { at, crate, fromRight, normalUp, prewarm, waitBoss } from './helpers';
import { placeSecrets, secretArt } from './secrets';
import { D_ARENA, D_W, G, terrainD } from './terrain';

export const BG_SUNSET: BackgroundDef = {
  sky: PAL.pink[1],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.pink[2], PAL.orange[2], PAL.gold[2]], sun: { x: 0.8, y: 0.5, r: 11 } }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.1, count: 4, ramp: [PAL.pink[1], PAL.pink[2], PAL.skinA[2]] }, factorX: 0.05, driftX: 0.03 },
    { gen: 'ams-skyline', params: { y: 0.56, light: 'sunset' }, width: 768, factorX: 0.1 },
    { gen: 'ams-canal-houses', params: { y: 0.62, s: 9, haze: 1, water: false, light: 'sunset' }, width: 640, factorX: 0.2 },
    { gen: 'ams-canal-houses', params: { y: 0.74, s: 13, light: 'sunset' }, width: 768, factorX: 0.4 },
    { gen: 'ams-elms', params: { y: 0.26, spacing: 176, light: 'sunset' }, width: 528, factorX: 0.66 },
  ],
};

/** Centre of the Stopera's glass doors (where the mayor steps out). */
export const DOORS_X = D_ARENA[0] + 294;

const decor: DecorDef[] = [
  ...houseRow('sunset', 0, [HOUSE.flat, HOUSE.step, HOUSE.bellCream, HOUSE.neck, HOUSE.koffie, HOUSE.spout, HOUSE.bell, HOUSE.boeken, HOUSE.stepBrown, HOUSE.neckRed, HOUSE.flat, HOUSE.bloemen, HOUSE.spout, HOUSE.bell, HOUSE.step, HOUSE.kaas]),
  { sprite: 'decor/ams/stopera', x: D_ARENA[0], y: G },
  // Waterlooplein flea market.
  { sprite: 'decor/ams/market-stall', frame: 0, x: 150, y: G },
  { sprite: 'decor/ams/market-stall', frame: 1, x: 240, y: G },
  { sprite: 'decor/ams/lamp', x: 310, y: G },
  { sprite: 'decor/ams/market-stall', frame: 2, x: 390, y: G },
  { sprite: 'decor/ams/market-stall', frame: 0, x: 480, y: G },
  { sprite: 'decor/ams/flag-ams', x: 548, y: G, animate: true },
  { sprite: 'decor/ams/market-stall', frame: 1, x: 640, y: G },
  { sprite: 'decor/ams/market-stall', frame: 2, x: 730, y: G },
  { sprite: 'decor/ams/lamp', x: 820, y: G },
  { sprite: 'decor/ams/flag-nl', x: 870, y: G, animate: true },
  { sprite: 'decor/ams/tulips', x: 940, y: G, animate: true },
  { sprite: 'decor/ams/flag-ams', x: 1250, y: G, animate: 10 },
  // Front.
  { sprite: 'decor/ams/bollard', x: 60, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 330, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 600, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 616, y: G, front: true },
];

/** The flea market's repair crate (a fixed `pickup-repair` source for a ridden Swan). */
export const D_REPAIR_X = 700;

/** The city life of section d (cosmetic): pigeons at the flea market. */
export function life(ctx: SectionContext): void {
  ctx.spawn('ams-pigeons', 420, G, { count: 5 });
  ctx.spawn('ams-pigeons', 760, G, { count: 3 });
}

/** Where she fights (she steps 40 px out of the doors). */
export const BOSS_HOME_X = DOORS_X - 40;
/**
 * The body wall keeps the players in front of her: while the stamp arm or the chain stands, 100 px
 * out (a 45° shot from the wall hits the chain, reach 84–132 px); once both are broken, 60 px out
 * (the medallion, reach 30–84 px).
 */
export const BOSS_WALL_FAR = BOSS_HOME_X - 100;
export const BOSS_WALL_NEAR = BOSS_HOME_X - 60;
/** The finale: where the baker and the staff stop to cheer. */
export const CHEER_X: readonly number[] = [960, 1010, 1080, 1140];

/** The boss fight: lock, a crate, ROBO-HALSEMA steps out of the doors, the body wall until she dies. */
function* bossFight(ctx: SectionContext): ScriptGen {
  ctx.lockCamera(D_ARENA[0], D_ARENA[1]);
  crate(ctx, 960, normalUp(ctx) ? 'M' : 'H');
  const wall = ctx.bodyWall(BOSS_WALL_FAR, { keep: 'left' });
  const boss: Entity = ctx.spawn('ams-mayor', DOORS_X, G, { facing: -1 });
  ctx.world.scripts.run(function* wallWatch() {
    yield () => {
      if (boss instanceof Boss && (boss.partAlive('stamp-arm') || boss.partAlive('chain'))) return !boss.alive;
      wall.x = BOSS_WALL_NEAR;
      return !boss.alive || (boss instanceof Boss && (boss.state === 'dying' || boss.state === 'done'));
    };
    wall.remove();
  });
  yield ctx.bossIntro('ROBO-HALSEMA', { subtitle: 'THE IRON MAYOR', music: 'ams-boss' });
  yield* waitBoss(boss);
  wall.remove();
}

/** The cheering finale: the baker and three staff walk in from the left, clap and cheer. */
function* finale(ctx: SectionContext): ScriptGen {
  // The fight is won: the clock stops for the celebration (it cannot run out under the cheering).
  ctx.timer.pause();
  yield 60;
  // The squad strikes the victory pose: no more shots streaming through the cheering crowd.
  for (const p of ctx.players) if (isPlayer(p)) p.victory();
  const left = ctx.camera.x - 12;
  const crowd: AmsPerson[] = [];
  const ids = ['ams-baker', 'ams-staff', 'ams-staff', 'ams-staff'];
  for (let i = 0; i < ids.length; i++) {
    const e = ctx.spawn(ids[i], left - i * 22, G, { facing: 1, look: i - 1, speed: 1.1 });
    if (e instanceof AmsPerson) crowd.push(e);
  }
  for (let i = 0; i < crowd.length; i++) crowd[i].walkTo(CHEER_X[crowd.length - 1 - i], i % 2 === 0 ? 'clap' : 'cheer');
  yield () => crowd.every((c) => c.arrived) || crowd.length === 0;
  ctx.world.audio.sfx('env/applause');
  const [baker, ...staff] = crowd;
  baker?.cheer();
  baker?.say('FABEL FRIET\nBLIJFT OPEN!', 170);
  yield 60;
  staff[2]?.say('LEKKER!', 70);
  // Neighbours: the second bubble waits until the first is gone.
  yield 76;
  staff[1]?.say('DANKJEWEL!', 110);
  yield 30;
  for (const s of staff) s.cheer();
}

/**
 * ams-d: the flea market (a few handhavers, breakable stalls), the arena, ROBO-HALSEMA, the
 * cheering finale and MISSION COMPLETE.
 */
export function* script(ctx: SectionContext): ScriptGen {
  prewarm('boss/ams-mayor/', 'enemy/handhaver/', 'enemy/boete-ticket/');
  life(ctx);
  if (!ctx.bossRush) {
    ctx.spawn('ams-market-stall', 200, 'ground', {});
    ctx.spawn('ams-market-stall', 560, 'ground', { contains: 'bombs' });
    ctx.spawn('ams-bike-rack', 336, 'ground', {});
    // The flea market's repair crate (docs/design/ams-extras.md §6) and its secret chest (§5).
    crate(ctx, D_REPAIR_X, 'repair');
    placeSecrets(ctx, 'd');
    at(ctx, 'handhaver', 420, { facing: -1 });
    yield ctx.waitCamera(80);
    fromRight(ctx, 'delivery-rider');
    yield ctx.waitCamera(220);
    fromRight(ctx, 'handhaver');
    at(ctx, 'seagull', 820, { perch: true }, G - 70);
    yield ctx.waitCamera(360);
    fromRight(ctx, 'fatbike-youth');
    if (normalUp(ctx)) fromRight(ctx, 'handhaver', {}, 16, undefined, 40);
    yield ctx.waitCamera(D_ARENA[0] - 40);
    yield ctx.waitClear();
    yield ctx.waitCamera(D_ARENA[0]);
  }
  yield* bossFight(ctx);
  yield* finale(ctx);
  yield 40;
  yield ctx.missionComplete();
}

export const sectionD: SectionDef = {
  id: 'd',
  name: 'Stopera',
  width: D_W,
  height: 216,
  scroll: 'right',
  background: BG_SUNSET,
  terrain: terrainD(),
  terrainStyle: { ground: 'klinker', edge: 'kerb', platform: 'wood', solid: 'brick' },
  decor,
  // Tier 4 (UHD verifier): the decor this section draws — its decor list and the breakables / boats
  // its script spawns — joins the 4× working set only here and in the section before it.
  art: [...new Set(decor.map((d) => d.sprite)), 'decor/ams/ams-bike-rack', 'decor/ams/ams-market-stall', ...secretArt('d')],
  playerStart: { x: 48, y: G },
  bossStart: { x: 900, y: G },
  checkpoints: [D_ARENA[0]],
  timeLimit: 60,
  music: 'ams',
  ambience: 'env/ams-street',
  vehicles: ['swan'],
  script,
};
