/**
 * sewers-c — DE PUT, 01:30 (docs/design/sewers.md §2.3, §5.1, §5.2): the fall down the burst drain
 * shaft, FLASHLIGHTS ON, the first brick tunnel; then → sewers-d. 1,920 px, scroll right. Wave P1b C.
 *
 * | x | content |
 * |---|---|
 * | start | THE FALL (`introDrop`: every hero drops from y −40 onto x 64, no chute, the weapon kept); the banner `DE PUT - 01:30`; when the last hero is down: `FLASHLIGHTS ON` (90 ticks), the click, the cones on |
 * | 0–640 | the flashlight lesson: eyes in the far wall's mouths (scenery); 3 runners out of the dark one at a time (300, 420, 560); crate `H` at 300 |
 * | 640–1,000 | the leaper lesson: a pipe stub at 760; 2 runner packs of 3 |
 * | 1,000 | sewer worker 1 (bind `sack`, drops `pickup-battery`, the c lines) |
 * | 1,000–1,600 | runner packs of 4 (triggers 1,100, 1,300, 1,500); leapers in the pipe stubs at 1,200 and 1,450; the spitter lesson on the plinths 1,400 / 1,496 |
 * | 1,600–1,920 | a last pack of 3 at 1,750; exit → sewers-d at 1,880 |
 *
 * Triggers are camera-centre x (as the checkpoints: 0, 900, 1,700). Every rat is P1a's; in the dark
 * a rat is its eyes (light-test.ts `isLit`), in a cone the whole rat. No lock: the section scrolls on.
 */
import type { ScriptGen } from '../../../../engine/script';
import { setFlashlights } from '../../../mission/light/api';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { LEAPER, PLINTH } from '../../sewers/rats/numbers';
import { ratPack } from '../../sewers/rats/helpers';
import { cScenePainted, decorC, C_ART } from './c-kit';
import { sewersCanal } from './canal/index';
import { crate, hostage, placeBanner, prewarm, VIEW_W } from './helpers';
import { SEWERS_HOSTAGE_WORKER, SEWERS_PIECE, SEWERS_RAT, SEWERS_SECTION, SEWERS_SONG } from './ids';
import { GREY_SEWER, GREY_VAULT } from './placeholder';
import { G, SEWERS_C, terrainC } from './terrain';

/** The banner after the fall and its sound (spec §5.2). */
export const FLASHLIGHTS_ON = 'FLASHLIGHTS ON';
export const FLASHLIGHTS_TICKS = 90;
export const FLASH_CLICK = 'sewers/flash-click';

/** Tags of the waves (tests and `waitClear`). */
export const C_TAG = { lesson: 'sewers-c-lesson', leaper: 'sewers-c-leaper', pack: 'sewers-c-pack', spitter: 'sewers-c-spitter' } as const;

/** Wait until the camera centre reaches x (at most the section's last view, 16 px before it). */
function centre(ctx: SectionContext, x: number) {
  return ctx.waitCamera(Math.max(0, Math.min(x - VIEW_W / 2, SEWERS_C.w - VIEW_W - 16)));
}

/**
 * c's stand-in sprites, by full id (no prefix: with the canal scene on, `drawnArt` drops the decor
 * ids from the tier-4 working set, and a prefix would keep them; docs/api/canal.md §8).
 */
const C_STAND_INS: readonly string[] = Object.values(C_ART);

/** Is any hero still in the intro fall? */
function falling(ctx: SectionContext): boolean {
  for (const p of ctx.players) if (p.dropping) return true;
  return false;
}

/** The flashlight lesson: three runners out of the dark, one at a time (spec §2.3, 0–640). */
function* lesson(ctx: SectionContext): ScriptGen {
  for (let i = 0; i < SEWERS_C.lesson.length; i++) {
    const x = SEWERS_C.lesson[i];
    // The next one when the last one is down, or when the view has come this far anyway.
    if (i > 0) yield () => ctx.world.countAlive(C_TAG.lesson) === 0 || ctx.camera.right >= x + 40;
    yield ctx.waitCamera(Math.max(0, x - VIEW_W + 60));
    if (i > 0) yield 40;
    ratPack(ctx, 1, { from: 'right', tag: C_TAG.lesson });
  }
}

/** A leaper in a pipe stub, placed while the stub is still off screen (it wakes as it should). */
function* leaperAt(ctx: SectionContext, x: number): ScriptGen {
  yield ctx.waitCamera(Math.max(0, x - VIEW_W - 24));
  ctx.spawn(SEWERS_RAT.leaper, x, LEAPER.pipeY, { entry: 'pipe', tag: C_TAG.leaper });
}

/** The spitter lesson: on its two plinths (it hops between them every 3rd spit). */
function* spitterAt(ctx: SectionContext): ScriptGen {
  yield ctx.waitCamera(SEWERS_C.spitterX - VIEW_W - 24);
  ctx.spawn(SEWERS_RAT.spitter, SEWERS_C.spitterX, PLINTH.y, { other: SEWERS_C.spitterX + PLINTH.gap, tag: C_TAG.spitter });
}

export function* scriptC(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, SEWERS_SECTION.c);
  // The stand-ins only when the canal scene does not paint them (docs/api/canal.md §8).
  prewarm('enemy/sewers-rat-', 'item/sewers-battery', 'ui/sewers-battery', ...(cScenePainted() ? [] : C_STAND_INS));
  crate(ctx, SEWERS_C.crateX, 'H');
  // THE FALL (the runner's `introDrop`): when the last hero is down, the flashlights click on.
  yield 1;
  yield () => !falling(ctx);
  setFlashlights(ctx.world, true);
  ctx.banner(FLASHLIGHTS_ON, { style: 'info', ticks: FLASHLIGHTS_TICKS });
  ctx.world.audio.sfx(FLASH_CLICK);
  // The rest of the section runs in parallel threads keyed to the camera.
  const s = ctx.world.scripts;
  s.run(() => lesson(ctx), { name: 'sewers-c lesson' });
  s.run(() => leaperAt(ctx, SEWERS_C.pipes[0]), { name: 'sewers-c leaper 1' });
  s.run(() => leaperAt(ctx, SEWERS_C.pipes[1]), { name: 'sewers-c leaper 2' });
  s.run(() => leaperAt(ctx, SEWERS_C.pipes[2]), { name: 'sewers-c leaper 3' });
  // 640–1,000: the leaper lesson's two packs of 3.
  for (const x of SEWERS_C.leaperPacks) {
    yield centre(ctx, x);
    ratPack(ctx, 3, { from: 'right', tag: C_TAG.pack });
  }
  // 1,000: sewer worker 1 (spawned before he scrolls in).
  yield ctx.waitCamera(SEWERS_C.workerX - VIEW_W - 24);
  hostage(ctx, SEWERS_HOSTAGE_WORKER, 'sack', SEWERS_C.workerX, SEWERS_PIECE.battery);
  // 1,000–1,600: three packs of 4; the spitter lesson on its plinths (placed before it scrolls in).
  s.run(() => spitterAt(ctx), { name: 'sewers-c spitter' });
  for (const x of SEWERS_C.packs) {
    yield centre(ctx, x);
    ratPack(ctx, 4, { from: 'right', tag: C_TAG.pack });
  }
  // 1,600–1,920: the last pack of 3, then the exit (the default exit, as ams's).
  yield centre(ctx, SEWERS_C.lastPack);
  ratPack(ctx, 3, { from: 'right', tag: C_TAG.pack });
  yield ctx.waitCamera(SEWERS_C.w - VIEW_W - 1);
}

export const sectionC: SectionDef = {
  id: SEWERS_SECTION.c,
  name: 'De Put',
  width: SEWERS_C.w,
  height: 216,
  scroll: 'right',
  background: GREY_VAULT,
  // Phase 6 (wave P6b C): the kit's baked scene (sw_c.py, the ambient stack; its lit stack
  // 'sewers-c-lit' shows in the cones, docs/api/canal.md "A lit section"). It paints the shaft and the
  // hole of the fall, the mouths with their blinking eyes, the side tunnel, the pipe stubs and the
  // plinths; the grey vault, terrain style and c-kit stand-ins stay for `?canal=0`.
  canal: sewersCanal(SEWERS_SECTION.c),
  terrain: terrainC(),
  terrainStyle: GREY_SEWER,
  decor: decorC(),
  playerStart: { x: SEWERS_C.dropX, y: G },
  // THE FALL (spec §5.2): on entry from b and on a direct start; never on a respawn, a continue or a boss rush.
  introDrop: { x: SEWERS_C.dropX, fromY: SEWERS_C.dropFromY, chute: false },
  checkpoints: [...SEWERS_C.checkpoints],
  music: SEWERS_SONG.sewer,
  ambience: 'sewers/drip-bed',
  art: ['enemy/sewers-rat-runner', 'enemy/sewers-rat-leaper', 'enemy/sewers-rat-spitter', 'item/hostage/sewers-worker', 'item/sewers-battery', 'ui/sewers-battery', ...C_STAND_INS],
  exits: [{ rect: { x: SEWERS_C.exitX, y: 0, w: SEWERS_C.w - SEWERS_C.exitX, h: 216 }, to: SEWERS_SECTION.d }],
  script: scriptC,
};
