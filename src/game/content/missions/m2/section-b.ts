/**
 * m2-b — Rocky Road (GDD §11.2): 3600×216, scroll right, checkpoints 1200, 2400, 3216, vehicles
 * allowed: `sundae-driver`. The SUNDAE DRIVER section: long dunes with kicker ramps for van jumps
 * (no pits), rocks to hop, an overtaking band-truck, a line of wind-up bots to crush (STRIKE!),
 * the anthem stop, the roadie under the oil derrick, then the mini-boss THE GOLDEN GOOSE and the
 * route choice: CANYON ↓ (`c1`, the dip) or MESA ↑ (`c2`, the rock ramp).
 *
 * Layout notes (reported): the rock ramp starts 8 px above the sand (3420, 168) so walkers and
 * the van pass under it into the dip (vehicles never drop through one-way platforms); the ramp
 * exit rect reaches y 106 so feet standing on the ramp top (y 104) are inside it.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { DERRICK_BEAM, SIGN } from './art';
import { BG_ROAD } from './backgrounds';
import { anyoneRiding, at, fromLeft, fromRight, G, normalUp, stage, topUpVans, VAN, vehiclesOf, waitBoss } from './helpers';

export const B_W = 3600;
/** The mini-boss arena (camera lock) and the fork inside it. */
export const B_ARENA = { x0: 3216, x1: 3600 } as const;
/** The rock ramp to the MESA exit: one-way, (3420, 168) → (3560, 104) → (3600, 104). */
export const B_RAMP = { x0: 3420, y0: 168, x1: 3560, y1: 104 } as const;
/** The oil derrick that holds the roadie's cage (beam tip x, feet y). */
const DERRICK = { x: 2900, y: 160 } as const;

const t = terrain(B_W, 216);
/** A van kicker: up 24 px over 64 px, then a 24 px drop back to the road. */
const kick = (b: ReturnType<typeof t.ground>): typeof b => b.slope(64, -24).step(24);
let g = t.ground().at(0, G).flat(300).hill(200, 16).flat(60);
g = kick(g) // 560–624
  .flat(16)
  .hill(200, 20) // 640–840: the bassoonists' dune crest
  .flat(200);
g = kick(g) // 1040–1104
  .flat(136)
  .hill(200, 16) // 1240–1440: rattlers and mortars
  .flat(360);
g = kick(g) // 1800–1864
  .flat(36)
  .hill(160, 20) // 1900–2060
  .flat(300);
g = kick(g) // 2360–2424
  .flat(376)
  .hill(200, 20) // 2800–3000: the derrick crest
  .flat(60);
g = kick(g) // 3060–3124
  .flat(136) // → 3260: the arena (flat sand from 3216)
  .hill(60, 16)
  .flat(40)
  .hill(60, 16) // 3360–3420
  .flat(60) // → 3480
  .slope(120, 20); // the dip to the CANYON exit, (3600, 196)
// Rocks to hop (24×16).
for (const x of [888, 1688, 2488]) t.solid(x, G - 16, 24, 16, 'rock');
// The rock ramp up to the MESA exit.
t.platforms().at(B_RAMP.x0, B_RAMP.y0).to(B_RAMP.x1, B_RAMP.y1).to(B_W, B_RAMP.y1);

/** Route signs: shown after the mini-boss (alpha 0 until then; reset at the section start). */
const canyonSign: DecorDef = { sprite: 'decor/m2/sign', frame: SIGN.canyon, x: 3520, y: 182, alpha: 0 };
const mesaSign: DecorDef = { sprite: 'decor/m2/sign', frame: SIGN.mesa, x: 3576, y: 104, alpha: 0 };

const decor: DecorDef[] = [
  { sprite: 'decor/m2/cactus', x: 240, y: G },
  { sprite: 'decor/m2/skull', x: 600, y: G },
  { sprite: 'decor/m2/cactus', x: 1150, y: G },
  { sprite: 'decor/m2/skull', x: 1560, y: G },
  { sprite: 'decor/m2/cactus', x: 2140, y: G },
  { sprite: 'decor/m2/derrick', x: DERRICK.x, y: DERRICK.y },
  { sprite: 'decor/m2/skull', x: 3180, y: G },
  canyonSign,
  mesaSign,
];

export const sectionB: SectionDef = {
  id: 'b',
  name: 'Rocky Road',
  width: B_W,
  height: 216,
  scroll: 'right',
  background: BG_ROAD,
  terrain: t.build(),
  terrainStyle: { ground: 'sand', edge: 'sand', platform: 'rock', solid: 'rock' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1200, 2400, 3216],
  timeLimit: 60,
  vehicles: [VAN],
  bossStart: { x: 3260, y: G },
  exits: [
    // GDD: y 150–216. The top is lowered to 176: feet in the dip (y 189–196) are still inside, and a
    // player on the ramp above (y ≤ 159 here) is well clear of it.
    { id: 'canyon', rect: { x: 3560, y: 176, w: 40, h: 40 }, to: 'c1', disabled: true },
    { id: 'mesa', rect: { x: 3560, y: 40, w: 40, h: 66 }, to: 'c2', disabled: true },
  ],
  *script(ctx) {
    canyonSign.alpha = 0;
    mesaSign.alpha = 0;
    // Players who arrive on foot find a van with its engine running ([2P] a second one).
    yield 1;
    if (ctx.bossRush) topUpVans(ctx, [3300, 3270]);
    else {
      topUpVans(ctx, [120, 60]);
      yield* road(ctx);
    }

    // @3216 THE GOLDEN GOOSE (GDD §9.4): lock, it walks in from the right edge and honks.
    yield ctx.waitCamera(B_ARENA.x0);
    ctx.lockCamera(B_ARENA.x0, B_ARENA.x1);
    // dropMaxX: its last egg (repair + bombs) lands on the flat sand between the two cover dunes,
    // clear of the ramp and of both route exits (a pickup there would pick the route for you).
    const goose = ctx.spawn('golden-goose', B_W - 8, G, { facing: -1, dropMaxX: 3340 });
    yield ctx.bossIntro('THE GOLDEN GOOSE', { music: 'mini-boss' });
    yield* waitBoss(goose);
    yield 60;
    ctx.music('m2', 60);
    canyonSign.alpha = 1;
    mesaSign.alpha = 1;
    ctx.unlockCamera();
    ctx.enableExit('canyon');
    ctx.enableExit('mesa');
    ctx.banner('PICK A ROUTE', { style: 'info', ticks: 150 });
  },
};

/** The road before the arena (skipped with ?boss=1). */
function* road(ctx: SectionContext): ScriptGen {
  // Standing placements of the rows, staged just before they scroll into view.
  stage(ctx, 400, () => {
    at(ctx, 'rattler', 400);
    at(ctx, 'rattler', 500);
  });
  stage(ctx, 700, () => {
    at(ctx, 'bassoonist', 700, { facing: -1 });
    at(ctx, 'bassoonist', 760, { facing: -1 });
  });
  stage(ctx, 1250, () => {
    at(ctx, 'rattler', 1250);
    at(ctx, 'gramophone-mortar', 1300);
    at(ctx, 'rattler', 1350);
    at(ctx, 'gramophone-mortar', 1420);
  });
  stage(ctx, 2200, () => {
    at(ctx, 'anthem-speaker', 2200);
    for (const x of [2240, 2266, 2293, 2320]) at(ctx, 'rifleman', x, { facing: -1 });
    at(ctx, 'oompah-trooper', 2350, { facing: -1 });
  });
  stage(ctx, 2600, () => {
    at(ctx, 'crate', 2600, { contains: 'bombs' });
    for (const x of [2650, 2700, 2750]) at(ctx, 'bassoonist', x, { facing: -1 });
  });
  // The roadie in a cage under the oil derrick (shoot the rope), staged before the derrick shows.
  stage(ctx, DERRICK.x - 40, () => {
    at(ctx, 'hostage', DERRICK.x, { kind: 'roadie', bind: 'cage', ropeTop: DERRICK.y - DERRICK_BEAM + 2, drop: 'repair' }, DERRICK.y - 58);
  });
  // @0: three riflemen chase the van from behind.
  for (let i = 0; i < 3; i++) {
    fromLeft(ctx, 'rifleman', { entry: 'run' });
    yield 24;
  }
  // The JINGLE hint once somebody drives.
  yield () => anyoneRiding(ctx, VAN) || ctx.camera.left >= 300;
  const van = vehiclesOf(ctx, VAN).find((v) => v.state === 'driven');
  if (van) ctx.hud.bubble(van, 'FIRE + BOMB: JINGLE!', { kind: 'hint', ticks: 150 });

  yield ctx.waitCamera(300);
  fromRight(ctx, 'oompah-tank', { stopX: 900 }, 48);

  yield ctx.waitCamera(700);
  // Overtake: a band-truck roars past from behind at 3 px/tick and unloads ahead at 1200.
  fromLeft(ctx, 'band-truck', { from: 'left', speed: 3, stopX: 1200, cargo: ['rifleman', 'rifleman', 'rifleman', 'cymbalist'], outfit: 'desert' }, 48);

  yield ctx.waitCamera(1300);
  // Six wind-up bots march in a line toward the van (crush all six in one run: STRIKE!).
  const x0 = ctx.camera.right + 16;
  for (let i = 0; i < 6; i++) at(ctx, 'windup-bot', x0 + i * 20, { facing: -1, tag: 'strike' });

  yield ctx.waitCamera(1600);
  fromRight(ctx, 'oompah-tank', { stopX: 2100 }, 48);
  if (normalUp(ctx)) {
    yield 120;
    fromLeft(ctx, 'oompah-tank', { stopX: Math.round(ctx.camera.left + 64) }, 48);
  }
}
