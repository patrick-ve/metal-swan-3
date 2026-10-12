/**
 * m2-a — Rattlebone Flats (GDD §11.2): 2400×216, scroll right, checkpoint 1200.
 *
 * Rolling dunes, a dry riverbed with hidden rattlers, a band-truck and a desert parade column,
 * then Dollop's Oasis: a camera lock around Mrs. Dollop's ice-cream shed. Freeing her gives the
 * SUNDAE DRIVER, which rolls out of the shed; the exit at the right edge leads to `b`.
 *
 * Layout changes from the GDD (reported): the shed is decor with a one-way roof (a solid 48 px
 * shed would trap the van, whose hop reaches 35 px, and Mrs. Dollop stands "in front" of it); the
 * oasis soldiers are placed at @1800 (off-screen) so they do not pop in when the view locks.
 */
import type { Entity } from '../../../../engine/entity';
import type { DecorDef, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { SIGN } from './art';
import { BG_FLATS } from './backgrounds';
import { at, fromRight, G, normalUp, rollTo, stage, twoPlayers, VAN } from './helpers';

export const A_W = 2400;
/** Mrs. Dollop's shed (decor) and its one-way roof. */
export const SHED = { x0: 2290, x1: 2354, roof: 128 } as const;

const t = terrain(A_W, 216);
// Dunes 0–1000 (16 px bumps, 200 long; flat at the outcrop), the dry riverbed 1000–1150 (1:2
// banks down to y 196), dunes 1150–1956, the mortar's dune crest around 2000, the flat oasis.
t.ground()
  .at(0, G)
  .flat(120)
  .hill(200, 16)
  .hill(200, 16)
  .flat(240)
  .hill(200, 16)
  .flat(40)
  .slope(40, 20)
  .flat(70)
  .slope(40, -20)
  .flat(190)
  .hill(200, 16)
  .hill(200, 16)
  .flat(216)
  .hill(88, 18)
  .flat(A_W - 2044);
// Rock outcrops (cover; the S crate sits on the first) and the sandbags.
t.solid(680, 152, 40, 24, 'rock');
t.solid(1280, 152, 40, 24, 'rock');
t.solid(1928, 164, 24, 12, 'rock');
// Dollop's shed roof (players can stand on it).
t.platform(SHED.x0, SHED.roof, SHED.x1 - SHED.x0);

/** The shed decor (its frame opens when the van rolls out; reset at the section start). */
const shedDecor: DecorDef = { sprite: 'decor/m2/shed', x: (SHED.x0 + SHED.x1) / 2, y: G, frame: 0 };

const decor: DecorDef[] = [
  { sprite: 'decor/m2/sign', frame: SIGN.flats, x: 96, y: G },
  { sprite: 'decor/m2/parasol', x: 320, y: G - 2 },
  { sprite: 'decor/m2/skull', x: 560, y: G - 8 },
  { sprite: 'decor/m2/cactus', x: 610, y: G },
  { sprite: 'decor/m2/skull', x: 1070, y: 196 },
  { sprite: 'decor/m2/cactus', x: 1220, y: G },
  { sprite: 'decor/m2/skull', x: 1760, y: G },
  { sprite: 'decor/m2/sandbags', x: 1940, y: G },
  { sprite: 'decor/m2/palm', x: 2232, y: G },
  { sprite: 'decor/m2/palm', x: 2276, y: G, flipX: true },
  shedDecor,
  { sprite: 'decor/m2/palm', x: 2380, y: G },
];

export const sectionA: SectionDef = {
  id: 'a',
  name: 'Rattlebone Flats',
  width: A_W,
  height: 216,
  scroll: 'right',
  background: BG_FLATS,
  terrain: t.build(),
  terrainStyle: { ground: 'sand', edge: 'sand', platform: 'rock', solid: 'rock' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1200],
  timeLimit: 60,
  exits: [{ id: 'east', rect: { x: 2380, y: 0, w: 20, h: 216 }, to: 'b', disabled: true }],
  *script(ctx) {
    shedDecor.frame = 0;
    // @0: a napping guard under the parasol, two card players, the first weapon crate.
    at(ctx, 'crate', 260, { contains: 'M' });
    at(ctx, 'rifleman', 320, { gag: 'nap', facing: -1 });
    at(ctx, 'card-table', 432);
    at(ctx, 'rifleman', 420, { gag: 'cards', facing: 1 });
    at(ctx, 'rifleman', 444, { gag: 'cards', facing: -1 });

    // Standing placements of the @200–@1800 rows, staged just before they scroll into view.
    stage(ctx, 520, () => {
      at(ctx, 'rattler', 520);
      at(ctx, 'rattler', 620);
    });
    stage(ctx, 700, () => at(ctx, 'crate', 700, { contains: 'S' }, 152));
    stage(ctx, 760, () => {
      at(ctx, 'anthem-speaker', 760);
      at(ctx, 'rifleman', 800, { facing: -1 });
      at(ctx, 'rifleman', 850, { facing: -1 });
      at(ctx, 'rifleman', 900, { facing: -1 });
      at(ctx, 'triangle', 820, { gag: 'counting', facing: -1 });
    });
    stage(ctx, 880, () => at(ctx, 'hostage', 880, { kind: 'critic', bind: 'chair', drop: 'H' }));
    stage(ctx, 1040, () => {
      for (const x of [1040, 1090, 1130]) at(ctx, 'rattler', x);
      at(ctx, 'crate', 1150, { contains: 'bombs' });
    });
    stage(ctx, 1600, () => at(ctx, 'hostage', 1600, { kind: 'tourist', bind: 'sack', drop: 'auto' }));
    stage(ctx, 1964, () => {
      at(ctx, 'gramophone-mortar', 2000);
      at(ctx, 'rifleman', 1964, { crouch: true, gag: false, facing: -1 });
      at(ctx, 'rifleman', 1984, { crouch: true, gag: false, facing: -1 });
    });

    yield ctx.waitCamera(800);
    fromRight(ctx, 'cymbalist');
    yield 40;
    fromRight(ctx, 'cymbalist');
    if (normalUp(ctx)) {
      yield 40;
      fromRight(ctx, 'oompah-trooper');
    }

    yield ctx.waitCamera(1200);
    fromRight(ctx, 'band-truck', { stopX: 1500, cargo: ['rifleman', 'rifleman', 'rifleman', 'drummer'], outfit: 'desert' }, 48);

    yield ctx.waitCamera(1500);
    // PARADE COLUMN (desert): the drummer leads, four riflemen, the drum major at the back.
    const col = ['drummer', 'rifleman', 'rifleman', 'rifleman', 'rifleman', 'baton-major'];
    const x0 = ctx.camera.right + 16;
    for (let i = 0; i < col.length; i++) at(ctx, col[i], x0 + i * 30, { column: 'parade', facing: -1 });

    yield ctx.waitCamera(1800);
    // Dollop's Oasis (still off-screen): Mrs. Dollop in front of her shed, five soldiers eating
    // her ice cream, the drum major by the door.
    const dollop = at(ctx, 'hostage', 2300, { kind: 'dollop', bind: 'chair', shedX: 2322, facing: -1 }, G);
    for (const x of [2230, 2250, 2270, 2330, 2350]) at(ctx, 'rifleman', x, { gag: 'ice-cream', facing: -1, tag: 'oasis' }, G);
    at(ctx, 'baton-major', 2370, { gag: false, facing: -1, tag: 'oasis' }, G);
    const got: { van: Entity | null } = { van: null };
    const off = ctx.world.events.on('hostageGift', (e) => {
      if (e.hostage === dollop && e.item) got.van = e.item;
    });

    yield ctx.waitCamera(2016);
    ctx.lockCamera(2016, A_W);
    yield ctx.waitClear('oasis');
    yield () => got.van !== null || !dollop.alive;
    off();
    const van = got.van;
    if (van) {
      // The shed doors open and the van rolls out to x 2260 ([2P] a second van to 2320).
      shedDecor.frame = 1;
      ctx.world.audio.sfx('vehicle/jingle');
      const second = twoPlayers(ctx) ? ctx.spawn(VAN, 2330, G) : null;
      yield* rollTo(van, 2260);
      if (second) yield* rollTo(second, 2320);
    } else if (!ctx.world.byTag('vehicle').length) {
      // Fail soft (the fleet module is missing): a van at the shed anyway.
      ctx.spawn(VAN, 2260, G);
    }
    ctx.unlockCamera();
    ctx.enableExit('east');
  },
};
