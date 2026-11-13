/**
 * sewers-d — HET RIOOL, 02:30 (docs/design/sewers.md §2.4, §5.4, L7, L8; wave P1b D): the sewer
 * tunnels, the brute lesson, the secret fatberg with the golden record, the second sewer worker
 * (the flamethrower), the leapers' pipe stubs, THE FATBERG lock; then → sewers-e. 2,816 px,
 * scroll right, the walkway at y 176. Light: wave C's entry d (light.ts).
 *
 * | camera centre | content |
 * |---|---|
 * | 0–896 | runner packs of 4 at 200, 450, 700; 2 spitters on plinths 500/596 and 800/896 |
 * | 896–1,280 | the brute lesson at 1,100 (one brute alone, flat floor: room to jump); the secret: a small fatberg in the 1,200 tunnel mouth (hp 150, golden record); checkpoint 1,300 |
 * | 1,280–1,920 | the sewer worker 2 at 1,700 (bind `float`, drop `F`, `PAK DIE PROPPEN AAN!` / `MET VUUR!`); mixed packs (runners, a spitter on plinths 1,560/1,656) |
 * | 1,920–2,432 | 3 leapers in pipe stubs (2,000, 2,150, 2,300); 2 runner packs; a brute from the right at 2,250; checkpoint 2,300 |
 * | 2,432–2,816 | LOCK: THE FATBERG at 2,700 (content/sewers/set-pieces/fatberg.ts); crate `S` at 2,460; it slumps → the exit at 2,800 |
 *
 * Grey (Phase 4): the scenery is P0's placeholder vault; the plinths, the pipe stubs and the tunnel
 * mouths are d-kit.ts stand-ins; the fatbergs draw their own stand-in frames. Phase 6 (P6a): the
 * canal scene draws the kit's painting (`canal`), the fatbergs show the lit stack's canal sprites;
 * the stand-ins draw only with `?canal=0`.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen, Wait } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { SEWERS_VOICE } from '../../samples/sewers';
import { sewersCanal } from './canal/index';
import { LEAPER, ratPack } from '../../sewers/rats/index';
import type { Fatberg } from '../../sewers/set-pieces/fatberg';
import { D_ART, dDecor } from './d-kit';
import { crate, hostage, placeBanner, prewarm, VIEW_W } from './helpers';
import { SEWERS_HOSTAGE_WORKER, SEWERS_PIECE, SEWERS_RAT, SEWERS_SECTION, SEWERS_SONG } from './ids';
import { GREY_SEWER, GREY_VAULT } from './placeholder';
import { G, SEWERS_D, terrainD } from './terrain';

/** The way on (enabled after the fatberg lock). */
export const SEWERS_D_EXIT = 'sewers-d-end';

/** The script's tags (for `waitClear`). */
export const D_TAG = {
  /** The walkway packs before the brute lesson. */
  walk: 'sewers-d-walk',
  /** The rats out of the big fatberg's holes. */
  berg: 'sewers-d-berg-rats',
} as const;

/** The script's numbers (spec §2.4; *start*). */
export const D_SCRIPT = {
  /** Camera-centre x of the three runner packs of 4. */
  packs: [200, 450, 700] as readonly number[],
  packSize: 4,
  brute1: 1100,
  /** The brute lesson waits this long at most for the packs to be gone (then it comes anyway). */
  bruteWait: 600,
  workerX: 1700,
  /** Mixed packs: camera centre, runners from the right, runners from the left. */
  mixed: [
    [1400, 4, 0],
    [1660, 3, 0],
    [1860, 2, 2],
  ] as readonly (readonly [number, number, number])[],
  /** Runner packs among the leapers (camera centre, size). */
  leaperPacks: [
    [2050, 3],
    [2200, 3],
  ] as readonly (readonly [number, number])[],
  /** The brute from the right when the camera centre reaches this. */
  brute2At: 2150,
  crateX: 2460,
  /** Things placed ahead appear when the camera's right edge is this close. */
  ahead: 64,
} as const;

/** Camera centre ≥ x. */
function centre(ctx: SectionContext, x: number): Wait {
  return ctx.waitCamera(Math.max(0, x - VIEW_W / 2));
}

/** Run `fn` once the camera's right edge comes within `D_SCRIPT.ahead` of x (spawn things there, off screen). */
function ahead(ctx: SectionContext, x: number, fn: () => void): void {
  ctx.world.scripts.run(
    (function* placeAhead(): ScriptGen {
      yield ctx.waitCamera(Math.max(0, x - VIEW_W - D_SCRIPT.ahead));
      fn();
    })(),
  );
}

/** The things that stand in the tunnel: plinth spitters, the secret, the worker, the pipe leapers, the crate, the fatberg. */
function placeStanding(ctx: SectionContext, berg: { e: Fatberg | null }): void {
  const d = SEWERS_D;
  const sp = d.plinths;
  // The spitters sit on their first plinth and hop to the second (rats/spitter.ts).
  for (const x of sp) ahead(ctx, x, () => ctx.spawn(SEWERS_RAT.spitter, x, d.plinthY, { other: x + d.plinthGap, facing: -1 }));
  // The secret (L8): a small fatberg in the side-tunnel mouth at 1,200, off the walk band (feet on
  // the mouth's sill, above the standing shot line), shootable; it hides the golden record (it drops
  // onto the walkway).
  ahead(ctx, d.secretX, () =>
    ctx.spawn(SEWERS_PIECE.fatberg, d.secretX, d.secretY, { small: true, reveal: { id: 'pickup-gem', params: { kind: 'golden-record' }, y: d.secretY - 8 } }),
  );
  // The sewer worker 2 (L7): tied to a mast pole in the stream of wipes; freed he gives the flamethrower.
  ahead(ctx, D_SCRIPT.workerX, () =>
    hostage(ctx, SEWERS_HOSTAGE_WORKER, 'float', D_SCRIPT.workerX, 'F', 'ground', { lines: [SEWERS_VOICE.worker.plugs, SEWERS_VOICE.worker.fire], facing: -1 }),
  );
  // The leapers wait in the pipe stubs' mouths (eyes), wake at 150 px.
  for (const x of d.pipes) ahead(ctx, x, () => ctx.spawn(SEWERS_RAT.leaper, x, LEAPER.pipeY, { entry: 'pipe', facing: -1 }));
  // THE FATBERG and the spread crate before it.
  ahead(ctx, D_SCRIPT.crateX, () => crate(ctx, D_SCRIPT.crateX, 'S'));
  ahead(ctx, d.fatbergX - 40, () => {
    berg.e = ctx.spawn(SEWERS_PIECE.fatberg, d.fatbergX, G, { ratTag: D_TAG.berg }) as Fatberg;
  });
}

export function* scriptD(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, SEWERS_SECTION.d);
  prewarm('prop/sewers-fatberg/', 'decor/sewers-d/');
  const berg: { e: Fatberg | null } = { e: null };
  placeStanding(ctx, berg);
  const S = D_SCRIPT;

  // 0–896: runner packs along the walkway (the spitters on their plinths sit above them).
  for (const x of S.packs) {
    yield centre(ctx, x);
    ratPack(ctx, S.packSize, { from: 'right', tag: D_TAG.walk });
  }

  // 896–1,280: THE BRUTE LESSON: one brute alone on the flat walkway (room to jump its charge).
  const t0 = ctx.world.tick;
  yield () => ctx.world.countAlive(D_TAG.walk) === 0 || ctx.world.tick - t0 >= S.bruteWait;
  yield ctx.waitCamera(Math.max(0, S.brute1 - VIEW_W - S.ahead));
  ctx.spawn(SEWERS_RAT.brute, Math.max(S.brute1, ctx.camera.right + 24), 'ground', { facing: -1 });

  // 1,280–1,920: mixed packs (the spitter on its plinths at 1,560 is placed ahead).
  for (const [x, right, left] of S.mixed) {
    yield centre(ctx, x);
    if (right > 0) ratPack(ctx, right, { from: 'right' });
    if (left > 0) ratPack(ctx, left, { from: 'left' });
  }

  // 1,920–2,432: the leapers (placed ahead), runner packs, the second brute.
  for (const [x, n] of S.leaperPacks) {
    yield centre(ctx, x);
    ratPack(ctx, n, { from: 'right' });
  }
  yield centre(ctx, S.brute2At);
  ctx.enter(SEWERS_RAT.brute, 'right', { margin: 32 });

  // 2,432–2,816: LOCK: THE FATBERG (spec §5.4).
  const [l0, l1] = SEWERS_D.lock;
  yield ctx.waitCamera(l0 - 8);
  ctx.lockCamera(l0, l1);
  yield () => berg.e !== null && berg.e.broken;
  yield ctx.waitClear(D_TAG.berg);
  yield 30;
  ctx.unlockCamera(false);
  ctx.enableExit(SEWERS_D_EXIT);
  ctx.showGo();
}

/** The fatberg of this section (tests). */
export function dFatberg(ctx: { world: { byTag(t: string): readonly Entity[] } }): Fatberg | null {
  const list = ctx.world.byTag('wall');
  for (let i = 0; i < list.length; i++) {
    const e = list[i] as Fatberg;
    if (e.type === SEWERS_PIECE.fatberg && !e.small) return e;
  }
  return null;
}

export const sectionD: SectionDef = {
  id: SEWERS_SECTION.d,
  name: 'Het Riool',
  width: SEWERS_D.w,
  height: 216,
  scroll: 'right',
  background: GREY_VAULT,
  // Phase 6 (wave P6a): the kit's baked scene (sw_d.py, the ambient stack; its lit stack 'sewers-d-lit'
  // shows in the cones, docs/api/canal.md "A lit section"). The grey vault, terrain style and the
  // d-kit stand-ins below stay for `?canal=0`; with the scene on none of them is built or drawn.
  canal: sewersCanal(SEWERS_SECTION.d),
  terrain: terrainD(),
  terrainStyle: GREY_SEWER,
  decor: dDecor(),
  playerStart: { x: 48, y: G },
  checkpoints: [...SEWERS_D.checkpoints],
  music: SEWERS_SONG.sewer,
  ambience: 'sewers/drip-bed',
  art: [...D_ART, 'enemy/sewers-rat-', 'fx/sewers-rat-slime', 'item/hostage/sewers-worker', 'item/pickup-gem/golden-record'],
  exits: [{ id: SEWERS_D_EXIT, rect: { x: SEWERS_D.exitX, y: 0, w: SEWERS_D.w - SEWERS_D.exitX, h: 216 }, to: SEWERS_SECTION.e, disabled: true }],
  script: scriptD,
};
