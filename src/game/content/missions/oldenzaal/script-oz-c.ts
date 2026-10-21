/**
 * oz-c's script — Plechelmusplein at night (STATUE, wave B; spec §2, §5.2, §6; revision 2).
 *
 * 1. The approach (skipped with `?boss=1`): the dead rise from the cracked pavers and shamble
 *    in; a rifleman and a grunt march out of the dark at the square's far end. Tank zombies:
 *    few of them, the arena waits until they are down (`waitArena`).
 * 2. The lock: the camera locks on the arena in front of the basilica; the statue on its plinth
 *    is still decor (shots chip dust).
 * 3. THE WAKE (Mevrouw Winkel's ONLY scene, R2-6): she fades in beside the plinth with her green
 *    lantern, says her three lines (`WINKEL_WAKE_LINES`, voiced as 'winkel'), laughs, and flies
 *    INTO the statue (`possessInto`); a lightning flash; the stone cracks, the eyes glow, the
 *    boss bar fills (`WARNING!` — ST. PLECHELMUS — MINI-BOSS, the boss song).
 * 4. The mini-boss (bosses/oldenzaal/statue.ts). At the end the saint is freed and sits back on
 *    his plinth, whole; a weapon drops; the basilica's red doors creak open; the exit → oz-d.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { Plechelmus } from '../../bosses/oldenzaal/statue';
import { OzInputLock, type OzWinkel } from '../../oldenzaal/npcs/index';
import { lightning } from '../../oldenzaal/kit/light-api';
import { spawnZombie } from '../../oldenzaal/zombies/api';
import { ARENA_L, ARENA_R, squareDoors, STATUE_X } from './art-square';
import { OZ_SONG, OZ_STATUE, OZ_WUGHOST } from './ids';
import { STATUE_BOSS_NAME, WINKEL_WAKE_LINES } from './lines';
import { waitArena } from './script-kit';
import { G } from './terrain';

/** The exit's id (enabled when the doors are open). */
export const OZ_C_EXIT_ID = 'oz-c-doors';

/** The wake's timings (ticks). */
export const WAKE = { appear: 45, line: 112, laugh: 40, dive: 3.2, banner: 120 } as const;

/** Where Mevrouw Winkel appears: beside the plinth, on the heroes' side, floating a little. */
export const WINKEL_AT = { x: STATUE_X - 46, y: G - 6 } as const;

/** The approach: the dead of the square (a few, they are tanks). */
function* approach(ctx: SectionContext): ScriptGen {
  yield ctx.waitPlayerX(150);
  spawnZombie(ctx, 'grunt', ctx.camera.right - 70, 'ground', { kind: 'rise', surface: 'pavers' }, { tag: 'oz-c1' });
  spawnZombie(ctx, 'grunt', ctx.camera.right + 30, 'ground', 'walk', { tag: 'oz-c1', facing: -1 });
  yield ctx.waitPlayerX(340);
  spawnZombie(ctx, 'crawler', ctx.camera.right - 50, 'ground', { kind: 'rise', surface: 'pavers' }, { tag: 'oz-c1' });
  yield ctx.waitPlayerX(470);
  spawnZombie(ctx, 'rifleman', ctx.camera.right + 20, 'ground', 'march', { tag: 'oz-c1', facing: -1 });
  spawnZombie(ctx, 'grunt', ctx.camera.right + 50, 'ground', 'march', { tag: 'oz-c1', facing: -1 });
  yield* waitArena(ctx, 'oz-c1');
}

/** Mevrouw Winkel's wake scene; resolves when she is inside the stone. */
function* wake(ctx: SectionContext, statue: Plechelmus): ScriptGen {
  const w = ctx.spawn(OZ_WUGHOST.winkel, WINKEL_AT.x, WINKEL_AT.y, { facing: -1 }) as OzWinkel;
  if (typeof w.appear !== 'function') {
    statue.awaken();
    return;
  }
  lightning(ctx.world, 0.5);
  w.appear(WAKE.appear);
  yield WAKE.appear + 5;
  w.raiseLantern();
  w.whisper();
  w.say(WINKEL_WAKE_LINES[0], WAKE.line - 8);
  yield WAKE.line;
  // She turns to the statue.
  w.facing = 1;
  w.glideTo(WINKEL_AT.x + 8, WINKEL_AT.y - 6, 0.6, 'raise');
  w.say(WINKEL_WAKE_LINES[1], WAKE.line - 8);
  yield WAKE.line;
  w.say(WINKEL_WAKE_LINES[2], WAKE.line - 20);
  yield WAKE.line - 30;
  w.laugh();
  yield WAKE.laugh;
  lightning(ctx.world, 1);
  w.possessInto(statue.eyeX(), statue.eyeY() - 4, WAKE.dive);
  let t = 0;
  yield () => w.possessed || w.removed || ++t > 240;
  statue.awaken();
}

/**
 * Run `gen` with the heroes' input locked (they stand still, no fire, no grenade) on every tick
 * it waits: a number waits as many ticks, a predicate until true (the same timing as unlocked).
 */
function* locked(lock: OzInputLock, gen: ScriptGen): ScriptGen {
  for (let r = gen.next(); !r.done; r = gen.next()) {
    const w = r.value;
    lock.apply();
    if (typeof w === 'function') {
      yield () => (lock.apply(), w());
    } else {
      let n = typeof w === 'number' && w >= 1 ? Math.floor(w) : 1;
      yield () => (lock.apply(), --n <= 0);
    }
  }
}

export function* scriptOzC(ctx: SectionContext): ScriptGen {
  const statue = ctx.spawn(OZ_STATUE.boss, STATUE_X, G) as Plechelmus;
  const doors = squareDoors((id, x, y) => ctx.spawn(id, x, y));
  if (!ctx.bossRush) yield* approach(ctx);
  // The lock in front of the basilica.
  yield ctx.waitPlayerX(ARENA_L + 60);
  ctx.lockCamera(ARENA_L, ARENA_R);
  ctx.setCheckpoint(ARENA_L + 40);
  if (statue instanceof Plechelmus) statue.armDecor();
  yield 30;
  if (!(statue instanceof Plechelmus)) {
    yield 120;
  } else {
    // The input is locked from Mevrouw Winkel's appearance until the bar is full (FIX: in the
    // scene the dormant statue looked like a target, the bot threw all its grenades at it).
    const lock = new OzInputLock(ctx);
    try {
      yield* locked(lock, wake(ctx, statue));
      const intro = ctx.bossIntro(STATUE_BOSS_NAME, { subtitle: 'MINI-BOSS', music: OZ_SONG.boss });
      let t = typeof intro === 'number' ? intro : 120;
      let cap = 300;
      yield () => (lock.apply(), --t <= 0 && (statue.state !== 'intro' || --cap <= 0));
    } finally {
      lock.restore();
    }
    yield () => statue.defeated;
  }
  // Freed. A weapon drop by the plinth, the music calms, the doors creak open.
  ctx.spawn('pickup-weapon', STATUE_X - 40, G - 24, { weapon: 'S' });
  ctx.music(OZ_SONG.theme, 90);
  yield 30;
  doors.open();
  yield 50;
  ctx.enableExit(OZ_C_EXIT_ID);
  ctx.unlockCamera();
  // The exit rect takes them through the doors; a stray hero past the doors still goes.
  yield ctx.waitPlayerX(ARENA_R - 12);
  yield ctx.exitTo('oz-d');
}
