/**
 * oz-f — the script of the tower climb and the Swan finale (docs/design/oldenzaal.md §8, §9).
 * Owner: TOWER.
 *
 * 1. The climb: the bells hang in the chamber (two swing on their own, the big one waits in the
 *    spire's lantern); dead riflemen (and a few grunts) stand on landings, staged just above the
 *    view's top edge (`stageY`).
 * 2. About a third of the way up (`TIDE.startCamY`) the horde tide comes up the tower behind the
 *    heroes (`oz-tide`); it waits `TIDE.grace` ticks when the view passes the checkpoint at y 600.
 * 3. The roof: when a hero stands on it, the dead still in the tower drop (the room is cleared, as
 *    in the m5 finale), the big bell tolls three times (its first toll is the last toll: the tide
 *    recoils and stops one landing below) and the heroes are trapped. Lightning, then the jet Swan
 *    comes in from the storm, hovers beside the roof, the heroes jump on (`boardSwan`: a cutscene,
 *    the pads are taken over), she turns and flies off into the clouds; `ctx.missionComplete()`.
 */
import type { ScriptGen } from '../../../../engine/script';
import { eraseEnemyShots } from '../../../projectile';
import type { SectionContext } from '../../../mission/index';
import type { Player } from '../../../player/player';
import { lightning, sectionLight } from '../../oldenzaal/kit/light-api';
import { Bell } from '../../oldenzaal/tower/bell';
import { BELLS, ledgeY, SWAN_JET, TIDE, TOWER } from '../../oldenzaal/tower/layout';
import { boardSwan, SwanJet } from '../../oldenzaal/tower/swan-jet';
import { Tide } from '../../oldenzaal/tower/tide';
import { isZombie, spawnZombie, type ZombieKind } from '../../oldenzaal/zombies/api';
import { OZ_SECTION, OZ_TOWER } from './ids';

/** The HUD text of the tower (not voiced). */
export const OZ_F_TEXT = {
  tide: 'THE DEAD ARE CLIMBING! UP!',
  trapped: 'NO WAY DOWN!',
} as const;

/** The rain inside (blown in through the openings) and on the open roof (the light pass reads it). */
export const OZ_F_RAIN = { inside: 0.35, roof: 0.9 } as const;

/** One standing dead soldier on a landing: landing k, x, kind; `n` NORMAL and HARD only, `p2` 2P only. */
interface Post {
  k: number;
  x: number;
  kind: ZombieKind;
  n?: boolean;
  p2?: boolean;
}

/** The dead on the landings (riflemen on the outer ends, off the climb column; a few grunts). */
export const OZ_F_POSTS: readonly Post[] = [
  { k: 6, x: 318, kind: 'rifleman' },
  { k: 11, x: 64, kind: 'rifleman' },
  { k: 15, x: 72, kind: 'grunt', n: true },
  { k: 18, x: 318, kind: 'rifleman' },
  { k: 23, x: 60, kind: 'rifleman' },
  { k: 26, x: 322, kind: 'rifleman', p2: true },
  { k: 29, x: 66, kind: 'grunt' },
  { k: 32, x: 326, kind: 'rifleman' },
  { k: 35, x: 60, kind: 'rifleman', n: true },
  { k: 38, x: 320, kind: 'rifleman' },
  { k: 41, x: 104, kind: 'rifleman' },
  { k: 43, x: 70, kind: 'grunt', p2: true },
];

/** The wave tag of the tower's dead. */
export const OZ_F_TAG = 'oz-f';

/** Stage a placement when the view's top edge comes within `lead` px of y. */
function stageY(ctx: SectionContext, y: number, spawn: () => void, lead = 28): void {
  ctx.world.scripts.run(
    (function* stagedY(): ScriptGen {
      yield () => ctx.camera.top - lead <= y;
      spawn();
    })(),
  );
}

/** A living hero stands on the roof. */
function onRoof(ctx: SectionContext): boolean {
  for (const p of ctx.players) if (p.alive && p.state === 'play' && p.onGround && p.y <= TOWER.roofY + 1) return true;
  return false;
}

/** Every hero who can play is on the roof (or out of the game). */
function allOnRoof(ctx: SectionContext): boolean {
  for (const p of ctx.players) {
    if (p.state === 'out' || p.state === 'victory') continue;
    if (!(p.alive && p.state === 'play' && p.y <= TOWER.roofY + 1)) return false;
  }
  return true;
}

const ROOM = { x: 0, y: 0, w: 0, h: 0 };

/** The dead in the tower drop and their shots vanish (nothing can hit the heroes in the cutscene). */
export function clearTower(ctx: SectionContext): void {
  const cam = ctx.camera;
  ROOM.x = cam.left - 32;
  ROOM.y = cam.top - 64;
  ROOM.w = cam.w + 64;
  ROOM.h = cam.h + 400;
  eraseEnemyShots(ctx.world, ROOM);
  for (const e of ctx.world.byTag('enemy').slice()) {
    if (!e.alive || !isZombie(e)) continue;
    e.onHit({ amount: 99999, kind: 'explosion', dirX: 0, tags: ['heavy'] });
  }
}

/** The tower: the climb, the tide, the roof, the Swan. */
export function* scriptOzF(ctx: SectionContext): ScriptGen {
  const light = sectionLight(OZ_SECTION.f);
  if (light?.rain) light.rain.density = OZ_F_RAIN.inside;
  ctx.showGo('up');
  // The bells.
  let big: Bell | null = null;
  for (const b of BELLS) {
    const e = ctx.spawn(OZ_TOWER.bell, b.x, b.y, { size: b.size, rest: b.rest, phase: b.phase, mode: b.mode });
    if (b.size === 'big' && e instanceof Bell) big = e;
  }
  // The dead on the landings.
  const normal = ctx.session.difficulty !== 'easy';
  for (const post of OZ_F_POSTS) {
    if (post.n && !normal) continue;
    if (post.p2 && ctx.playerCount < 2) continue;
    const y = ledgeY(post.k);
    stageY(ctx, y - 40, () => {
      spawnZombie(ctx, post.kind, post.x, y, 'walk', { tag: OZ_F_TAG, facing: post.x < TOWER.w / 2 ? 1 : -1 });
    });
  }
  // The old landings creak now and then as the heroes climb (every ~260 px of the climb).
  ctx.world.scripts.run(
    (function* creaks(): ScriptGen {
      for (let y = TOWER.floor - 300; y > TOWER.roofY + 100; y -= 260) {
        yield () => ctx.camera.top <= y;
        ctx.world.audio.sfx('oz/tower/creak', { vol: 0.55, pitch: 0.9 + ((y >> 4) % 5) * 0.05 });
      }
    })(),
  );
  // The open roof: the full storm.
  ctx.world.scripts.run(
    (function* roofRain(): ScriptGen {
      yield () => ctx.camera.top <= TOWER.roofY;
      if (light?.rain) light.rain.density = OZ_F_RAIN.roof;
    })(),
  );

  // About a third of the way up: the tide.
  yield ctx.waitCameraY(TIDE.startCamY);
  const cam = ctx.camera;
  const tide = ctx.spawn(OZ_TOWER.tide, cam.centerX, cam.bottom + TIDE.lag, { startY: cam.bottom + TIDE.lag }) as Tide;
  ctx.banner(OZ_F_TEXT.tide, { style: 'warning', ticks: 150 });
  ctx.world.audio.sfx('oz/tower/tide-surge', { vol: 0.9 });
  // The checkpoint at y 600: a short grace.
  ctx.world.scripts.run(
    (function* checkpointGrace(): ScriptGen {
      yield ctx.waitCameraY(600 - 108);
      if (tide instanceof Tide) tide.hold(TIDE.grace);
    })(),
  );

  // The roof.
  yield () => onRoof(ctx);
  yield* finale(ctx, tide instanceof Tide ? tide : null, big);
}

/** Finale timings (ticks). */
export const OZ_F_FINALE = { allRoof: 300, trapped: 70, flash: 30, aboardWait: 200, afterAboard: 24, flyOff: 150, end: 20 } as const;

/** The roof: the last toll, trapped, the jet Swan, away (spec §8 the top, §9). */
function* finale(ctx: SectionContext, tide: Tide | null, big: Bell | null): ScriptGen {
  clearTower(ctx);
  big?.toll(3);
  if (big) {
    let t = 0;
    yield () => big.tolls > 0 || ++t > 160;
  }
  tide?.lastToll();
  ctx.callout(OZ_F_TEXT.trapped, { ticks: 120 });
  // Wait for the other hero (2P) to make it up, a little.
  {
    let t = 0;
    yield () => allOnRoof(ctx) || ++t > OZ_F_FINALE.allRoof;
  }
  clearTower(ctx);
  yield OZ_F_FINALE.trapped;
  lightning(ctx.world, 1);
  yield OZ_F_FINALE.flash;
  const cam = ctx.camera;
  const swan = ctx.spawn(OZ_TOWER.swanJet, cam.left + SWAN_JET.fromX, cam.top + SWAN_JET.fromY) as SwanJet;
  if (!(swan instanceof SwanJet)) {
    // Fail soft (no Swan registered): the mission still ends.
    yield 120;
    yield ctx.missionComplete();
    return;
  }
  ctx.world.scripts.run(boardSwan(ctx, swan));
  yield () => swan.arrived;
  {
    let t = 0;
    yield () => swan.allAboard(ctx.players as readonly Player[]) || ++t > 240 + OZ_F_FINALE.aboardWait;
  }
  yield OZ_F_FINALE.afterAboard;
  swan.leave();
  {
    let t = 0;
    yield () => swan.gone || ++t > OZ_F_FINALE.flyOff;
  }
  yield OZ_F_FINALE.end;
  yield ctx.missionComplete();
}
