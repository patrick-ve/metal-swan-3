/**
 * m3-a — Yodel Valley (GDD §11.3, docs/design/swan-mount/levels.md §4): 3000×216, scroll right,
 * checkpoints 1300, 2300, vehicles allowed: `swan`. The second Swan showcase: the cargo drop in
 * Mittens' knitted socks, the village and its chalet "stomp staircase", the frozen pond (ice
 * range) and the skating parade, the AVALANCHE pursuit down the piste (moguls, the boulder, three
 * goats, a baton-copter), the SKI JUMP over the K-lines with its glide trail, and the base camp:
 * the branch point NORTH FACE ↑ (`b1`) / CAVES → (`b2`), the Swan-only wall and her goodbye.
 * When the section ends every swan still in one piece is recorded for m3-c (SHE TOOK THE LIFT).
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Terrain } from '../../../../engine/terrain';
import { hudOf } from '../../../context';
import { awardScore } from '../../../events';
import { terrain, type DecorDef, type SectionContext, type SectionDef } from '../../../mission/index';
import type { Player } from '../../../player/player';
import { CALLOUTS } from '../../../scenes/flow-data';
import { isSwan, type Swan } from '../../vehicles/swan/swan';
import { ICE_PIECE, SIGN } from './art';
import { BG_VALLEY } from './backgrounds';
import { M3CargoChute } from './entities';
import { at, crate, fromRight, G, hasGramps, hostage, LIFT_KEY, radio, recordLift, stage, twoPlayers } from './helpers';

export const A_W = 3000;
/** The frozen pond (GDD: ice range 1340–1700). */
export const POND: readonly [number, number] = [1340, 1700];
/** The kicker lip and the landing valley floor. */
export const LIP = { x: 2330, y: 190 } as const;
export const VALLEY_Y = 204;
/** K-lines: on foot past the blue one, a gliding Swan past the red one (GDD @2000). */
export const K_BLUE = 2420;
export const K_RED = 2540;
/** Avalanche stop (the rock face at the foot of the base-camp climb). */
export const AVALANCHE_STOP = 2540;
/** Base camp lock and the Swan-only wall (after the UNLOCK). */
export const CAMP_X = 2616;
export const SWAN_WALL_X = 2860;
/** The glide trail (GDD @1880): 7 floating golden notes along the nominal glide arc. */
export const GLIDE_TRAIL: readonly (readonly [number, number])[] = [
  [2378, 110],
  [2404, 97],
  [2429, 95],
  [2451, 99],
  [2473, 108],
  [2495, 118],
  [2517, 128],
];

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

const t = terrain(A_W, 216);
// The village: two 12 px snow bumps, flat to the top of the piste (the chalets and the pond).
t.ground()
  .at(0, G)
  .flat(200)
  .hill(200, 12)
  .flat(100)
  .hill(200, 12)
  .flat(1000)
  // The piste: a long gentle downhill with three moguls (8–10 px).
  .to(1820, 181)
  .to(1850, 173)
  .to(1880, 182)
  .to(1980, 186)
  .to(2010, 178)
  .to(2040, 188)
  .to(2140, 193)
  .to(2170, 185)
  .to(2200, 195)
  .to(2290, 204)
  // The kicker up to the lip, a 14 px step down into the landing valley.
  .to(LIP.x, LIP.y)
  .step(VALLEY_Y - LIP.y)
  .to(2540, VALLEY_Y)
  // The climb to base camp, then flat to the cliff (the section's right wall).
  .to(2620, G)
  .to(A_W, G);
// Two solid chalets with standable roofs (the Swan "stomp staircase").
t.solid(880, 136, 64, 40, 'rock').platform(880, 120, 64);
t.solid(1030, 136, 64, 40, 'rock').platform(1030, 110, 64);
// The boulder on the piste (21–23 px above it).
t.solid(1910, 162, 48, 24, 'rock');
// Cliff ladder steps.
t.platform(2880, 140, 50).platform(2900, 104, 60);

const TERRAIN = t.build();
const T = new Terrain(TERRAIN);
const gy = (x: number): number => T.groundY(x);

/** The judges' stand (frame 1 = cards up after a STYLE landing; reset at the section start). */
const judges: DecorDef = { sprite: 'decor/m3/judges-stand', x: 2566, y: Math.round(gy(2566)), frame: 0 };

const decor: DecorDef[] = [
  { sprite: 'decor/m3/pine', frame: 1, x: 24, y: G },
  { sprite: 'decor/m3/sign', frame: SIGN.valley, x: 112, y: G },
  { sprite: 'decor/m3/pine', frame: 0, x: 300, y: Math.round(gy(300)) },
  { sprite: 'decor/m3/pine', frame: 1, x: 470, y: G },
  { sprite: 'decor/m3/pine', frame: 0, x: 760, y: G },
  { sprite: 'decor/m3/chalet-roof', frame: 0, x: 880, y: 120 },
  { sprite: 'decor/m3/chalet-roof', frame: 1, x: 1030, y: 110 },
  { sprite: 'decor/m3/pine', frame: 1, x: 990, y: G },
  { sprite: 'decor/m3/chalet', x: 1200, y: G },
  { sprite: 'decor/m3/pine', frame: 0, x: 1290, y: G },
  ...Array.from({ length: (POND[1] - POND[0]) / ICE_PIECE }, (_, i): DecorDef => ({ sprite: 'decor/m3/ice', x: POND[0] + i * ICE_PIECE, y: G, front: true })),
  { sprite: 'decor/m3/sign-piste-closed', x: 1712, y: G },
  { sprite: 'decor/m3/pine', frame: 1, x: 1760, y: Math.round(gy(1760)) },
  { sprite: 'decor/m3/pine', frame: 0, x: 2090, y: Math.round(gy(2090)) },
  { sprite: 'decor/m3/k-line-blue', frame: 0, x: K_BLUE + 8, y: VALLEY_Y },
  { sprite: 'decor/m3/k-line-red', frame: 0, x: K_RED - 8, y: VALLEY_Y },
  { sprite: 'decor/m3/k-line-blue', frame: 1, x: K_BLUE, y: VALLEY_Y, front: true },
  { sprite: 'decor/m3/k-line-red', frame: 1, x: K_RED, y: VALLEY_Y, front: true },
  { sprite: 'decor/m3/rock-face', x: 2604, y: Math.round(gy(2604)) + 6 },
  judges,
  { sprite: 'decor/m3/lift-pylon', x: 2700, y: G },
  { sprite: 'decor/m3/tent', x: 2800, y: G },
  { sprite: 'decor/m3/snow-mound', x: 2850, y: G + 2 },
  { sprite: 'decor/m3/tent', x: 2900, y: G },
  { sprite: 'decor/m3/cliff', x: 2936, y: 0 },
  { sprite: 'decor/m3/rope-ladder', x: 2950, y: 40 },
  // Front decor over the solid chalets (nothing stands inside a solid).
  { sprite: 'decor/m3/chalet-wall', frame: 0, x: 880, y: 136, front: true },
  { sprite: 'decor/m3/chalet-wall', frame: 1, x: 1030, y: 136, front: true },
];

// ---------------------------------------------------------------------------------------------
// Script pieces
// ---------------------------------------------------------------------------------------------

/** The cargo drop: a swan in Mittens' socks under a parachute (P2: the Mute). */
function cargoDrop(ctx: SectionContext, x: number, variant?: 'mute'): Swan | null {
  const s = ctx.spawn('swan', x, -20, { socks: true, facing: 1, ...(variant ? { variant } : {}) });
  const chute = ctx.spawn('m3-cargo-chute', x, -60, { fall: 1.5 });
  if (chute instanceof M3CargoChute) chute.attach(s);
  return isSwan(s) ? s : null;
}

/** MITTENS KNITTED HER SOCKS: a bubble over the swan once she has landed. */
function* socksBubble(ctx: SectionContext, s: Swan): ScriptGen {
  yield () => !s.alive || s.body?.onGround === true;
  if (!s.alive) return;
  yield 40;
  hudOf(ctx.world).bubble(s, 'MITTENS KNITTED HER SOCKS.', { kind: 'hint', ticks: 160 });
}

/** Per-player state of the SKI JUMP judge. */
interface JumpState {
  wasGround: boolean;
  groundX: number;
  groundY: number;
  armed: boolean;
  onSwan: boolean;
  cells: number;
  glided: boolean;
  done: boolean;
}

/**
 * SKI JUMP (GDD @2000): take off from the kicker (x 2290–2330); on foot land beyond the blue
 * K-line, riding a Swan open the wings in the air and land beyond the red one; no hit while
 * airborne. STYLE POINTS 9.5! +2,000 once per player; the cardboard judges raise their cards.
 */
function* skiJump(ctx: SectionContext): ScriptGen {
  const st: JumpState[] = [0, 1].map(() => ({ wasGround: true, groundX: 0, groundY: 0, armed: false, onSwan: false, cells: 0, glided: false, done: false }));
  let cardsT = 0;
  for (;;) {
    for (const p of ctx.players) {
      const s = st[p.index];
      if (!s || s.done) continue;
      judgeJump(ctx, p, s);
      if (s.done) {
        cardsT = 150;
        judges.frame = 1;
      }
    }
    if (cardsT > 0 && --cardsT === 0) judges.frame = 0;
    yield 1;
  }
}

function judgeJump(ctx: SectionContext, p: Player, s: JumpState): void {
  const sw = p.state === 'mounted' && isSwan(p.vehicle as Entity | null) ? (p.vehicle as unknown as Swan) : null;
  if (p.state !== 'play' && !sw) {
    s.armed = false;
    s.wasGround = true;
    return;
  }
  const subj: Entity = sw ?? p;
  const ground = sw ? sw.medium !== 'air' : p.body?.onGround === true;
  if (ground) {
    if (s.armed) {
      s.armed = false;
      const need = s.onSwan ? K_RED : K_BLUE;
      if (subj.x > need && (!s.onSwan || s.glided)) {
        s.done = true;
        awardScore(ctx.world, p.index, 2000, subj.x, subj.y - 48);
        ctx.callout(CALLOUTS.stylePoints, { ticks: 120 });
        ctx.world.audio.sfx('ui/star');
      }
    }
    s.groundX = subj.x;
    s.groundY = subj.y;
  } else {
    if (s.wasGround && s.groundX >= 2280 && s.groundX <= LIP.x + 4 && s.groundY < VALLEY_Y - 2) {
      s.armed = true;
      s.onSwan = sw !== null;
      s.cells = sw ? sw.cells : 0;
      s.glided = false;
    }
    if (s.armed) {
      if ((sw !== null) !== s.onSwan) s.armed = false;
      else if (sw) {
        if (sw.glide === 'open') s.glided = true;
        if (sw.cells < s.cells) s.armed = false;
      }
    }
  }
  s.wasGround = ground;
}

/** The base camp fight and the route choice (GDD @2616). */
function* baseCamp(ctx: SectionContext): ScriptGen {
  ctx.lockCamera(CAMP_X, A_W);
  const tag = 'camp';
  // Out of the tents (entry window) and in from the cliff end (x 2992).
  at(ctx, 'rifleman', 2800, { entry: 'window', facing: -1 }, G, tag);
  at(ctx, 'rifleman', 2900, { entry: 'window', facing: -1 }, G, tag);
  yield 30;
  fromRight(ctx, 'baton-major', {}, 16, tag);
  fromRight(ctx, 'cymbalist', {}, 16, tag);
  yield 50;
  at(ctx, 'rifleman', 2800, { entry: 'window', facing: -1 }, G, tag);
  at(ctx, 'rifleman', 2900, { entry: 'window', facing: -1 }, G, tag);
  yield 60;
  fromRight(ctx, 'rifleman', {}, 16, tag);
  fromRight(ctx, 'cymbalist', {}, 16, tag);
  yield ctx.waitClear(tag);
  // The route signs drop in; both exits open at once.
  ctx.spawn('m3-sign', 2868, G, { frame: SIGN.northFace });
  ctx.spawn('m3-sign', 2952, G, { frame: SIGN.caves });
  ctx.unlockCamera(false);
  ctx.enableExit('north-face');
  ctx.enableExit('caves');
  ctx.banner('PICK A ROUTE', { style: 'info', ticks: 150 });
  // The Swan can't climb: a Swan-only body wall at x 2860 (a ridden Swan on the ground loses
  // her pilot there; in the air it only stops her).
  let said = false;
  ctx.bodyWall(SWAN_WALL_X, {
    keep: 'left',
    filter: (e) => isSwan(e),
    onTouch: (e) => {
      if (!isSwan(e)) return;
      const pilot = e.driver;
      if (e.state === 'driven' && e.medium === 'ground') e.eject('forced');
      if (!said && pilot) {
        said = true;
        radio(ctx, pilot, hasGramps(ctx) ? "GRAMPS: SHE DOESN'T DO CLIFFS." : "GRAMPS: SHE DOESN'T DO CLIFFS. PARK HER.", 180);
      }
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

export const sectionA: SectionDef = {
  id: 'a',
  name: 'Yodel Valley',
  width: A_W,
  height: 216,
  scroll: 'right',
  background: BG_VALLEY,
  terrain: TERRAIN,
  terrainStyle: { ground: 'snow', edge: 'snow', platform: 'wood', solid: 'rock' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1300, 2300],
  timeLimit: 60,
  vehicles: ['swan'],
  iceRanges: [POND],
  exits: [
    // The top of the rope ladder (the steps at y 140 and 104 lead up to it).
    { id: 'north-face', rect: { x: 2930, y: 40, w: 40, h: 60 }, to: 'b1', disabled: true },
    // The cave mouth at the foot of the cliff.
    { id: 'caves', rect: { x: 2976, y: 136, w: 24, h: 40 }, to: 'b2', disabled: true },
  ],
  *script(ctx) {
    judges.frame = 0;
    // SHE TOOK THE LIFT: a fresh record for this run; written when the section ends.
    ctx.records.delete(LIFT_KEY);
    // (The listener lives with this section's world.)
    ctx.world.events.on('sectionExit', (e) => {
      if (e.from === 'a') recordLift(ctx);
    });
    ctx.world.scripts.run(skiJump(ctx));

    // Start: the Swan by cargo parachute in Mittens' socks ([2P] the Mute too).
    const swan = cargoDrop(ctx, 200);
    if (twoPlayers(ctx)) cargoDrop(ctx, 152, 'mute');
    if (swan) ctx.world.scripts.run(socksBubble(ctx, swan));
    crate(ctx, 300, 'M');
    // The secret: the big chalet's back door hides the composer.
    ctx.spawn('breakable-wall', 1192, G, {
      solid: false,
      look: 'door',
      reveal: { id: 'hostage', params: { kind: 'composer', bind: 'chair', drop: '1up' }, x: 1200, y: G },
    });

    // Standing placements of the rows, staged just before they scroll into view.
    stage(ctx, 620, () => crate(ctx, 620, 'S'));
    stage(ctx, 700, () => at(ctx, 'triangle', 700, { gag: 'counting', facing: -1 }));
    stage(ctx, 886, () => at(ctx, 'ram-goat', 906, { facing: -1 }, 120));
    stage(ctx, 1036, () => at(ctx, 'ram-goat', 1062, { facing: -1 }, 110));
    stage(ctx, 1100, () => hostage(ctx, 'critic', 'chair', 1100, 'H'));
    stage(ctx, 1280, () => {
      at(ctx, 'bassoonist', 1280, { facing: -1 });
      at(ctx, 'bassoonist', 1320, { facing: -1 });
    });
    // @1300: the skating parade on the frozen pond (a drum major leads four skaters).
    stage(ctx, 1560, () => {
      at(ctx, 'baton-major', 1560, { entry: 'skate', gag: false, facing: -1 }, G, 'parade');
      for (let i = 0; i < 4; i++) at(ctx, 'rifleman', 1590 + i * 26, { entry: 'skate', gag: false, facing: -1 }, G, 'parade');
    });
    stage(ctx, 1600, () => hostage(ctx, 'tourist', 'sack', 1600, 'auto'));
    stage(ctx, 1934, () => crate(ctx, 1934, 'bombs', 162));

    // @0: three skiers crash into the snowbanks.
    for (let i = 0; i < 3; i++) {
      fromRight(ctx, 'rifleman', { entry: 'ski' }, 16, 'w0', i * 24);
      yield 20;
    }

    // @250: wind-up bots on tiny skis.
    yield ctx.waitCamera(250);
    for (let i = 0; i < 4; i++) fromRight(ctx, 'windup-bot', { variant: 'ski' }, 16, undefined, i * 20);

    // @450: two cymbal crashers.
    yield ctx.waitCamera(450);
    fromRight(ctx, 'cymbalist');
    yield 50;
    fromRight(ctx, 'cymbalist');

    // @1600: AVALANCHE!
    yield ctx.waitCamera(1600);
    ctx.world.camera.shake(2, 60);
    ctx.banner('AVALANCHE!', { style: 'warning', ticks: 120 });
    ctx.world.audio.sfx('env/avalanche', { vol: 0.4 });
    yield 60;
    ctx.spawn('avalanche', ctx.camera.left + 8, 216, { speed: 1.0, maxSpeed: 3.0, holdX: 40, gap: 104, stopX: AVALANCHE_STOP });

    // @1660: three goats charge up the piste (camera left + 400, never past the lip).
    yield ctx.waitCamera(1660);
    for (let i = 0; i < 3; i++) {
      if (i > 0) yield 45;
      const x = Math.min(LIP.x - 30, ctx.camera.left + 400);
      ctx.spawn('ram-goat', x, 'ground', { facing: -1, enter: 'right' });
    }

    // @1700: a baton-copter crosses over the piste in level flight.
    yield ctx.waitCamera(1700);
    ctx.enter('baton-copter', 'right', { y: 40, margin: 16, params: { mode: 'air', dir: -1 } });

    // @1880: the landing valley: two bassoonists, bombs, the glide trail.
    yield ctx.waitCamera(1880);
    at(ctx, 'bassoonist', 2450, { facing: -1 }, VALLEY_Y);
    at(ctx, 'bassoonist', 2510, { facing: -1 }, VALLEY_Y);
    crate(ctx, 2500, 'bombs', VALLEY_Y);
    for (const [x, y] of GLIDE_TRAIL) ctx.spawn('pickup-gem', x, y, { kind: 'golden-note', float: true });

    // @2300 (checkpoint): the roadie's cage hangs from the ski-lift pylon.
    yield ctx.waitCamera(2300);
    hostage(ctx, 'roadie', 'cage', 2700, 'F', 120, { ropeTop: 60 });

    // @2616: base camp.
    yield ctx.waitCamera(CAMP_X);
    yield* baseCamp(ctx);
  },
};

/** Every entity id this section spawns (tests check they are registered). */
export const A_IDS: readonly string[] = [
  'swan', 'm3-cargo-chute', 'crate', 'breakable-wall', 'hostage', 'rifleman', 'windup-bot', 'cymbalist', 'triangle', 'ram-goat',
  'bassoonist', 'baton-major', 'avalanche', 'baton-copter', 'pickup-gem', 'm3-sign',
];
