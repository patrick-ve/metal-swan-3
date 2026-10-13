/**
 * The people and the life of Amsterdam: mission-local entities of `ams` (docs/design/amsterdam.md
 * §1, §5). Every id spawns and runs with `{}` params. Art: `npc.art.ts`. NPCs and ambient life
 * have category `npc`, team 'neutral' and NO 'enemy' / 'shootable' tag: shots pass through them
 * and `waitClear` never waits for them. Ambient entities sleep while they are far off-screen.
 *
 * ## NPCs (y = the floor under the feet; `facing` default −1 = looking left, toward the player)
 *
 * | id | params | script API |
 * |---|---|---|
 * | `ams-baker` | `facing`, `mode` (idle), `counter` (false: draw a small Fabel Friet counter in front of him), `to` (walk target x), `speed` (0.8), `toss` (what `toss()` throws, default `'crate'`) | see `AmsPerson`; plus `toss(contents?)`: wind-up, throw (the item leaves his hand on the 3rd frame; `tossed` counts throws), back to idle. `talk(ticks)`: talks with the scoop (mouth + gestures) |
 * | `ams-hotdog-vendor` | `facing`, `mode`, `counter`, `range` (40) | salutes (P.SALUTE, calm face, 70 ticks) once per player who passes within `range` px on foot or riding a vehicle, with a `gag` bubble `HOWDY, SOLDIER!` (on a Swan: `NICE BIRD, SOLDIER!`). `saluted` = bit mask of player slots |
 * | `ams-staff` | `look` 0–2, `facing`, `mode`, `to`, `speed` | modes idle / walk / clap / cheer / wave |
 *
 * `AmsPerson` (all three): `setMode(mode, ticks = Infinity, then = 'idle')`, `walkTo(x, then = 'idle')`
 * (walks at `speed`, turns to face the way it goes, `arrived` turns true), `clap()`, `cheer()`,
 * `wave()`, `idle()`, `talk(ticks = 150)`, `say(text, ticks = 150, kind = 'gag')` (a HUD bubble over
 * the head; returns the Bubble), `face(x)` (turn toward an x). Spawn param `mode`: any mode name;
 * `mode: 'walk'` with `to` walks there on its own.
 *
 * ## Ambient life (cosmetic, cheap)
 *
 * | id | params |
 * |---|---|
 * | `ams-tour-boat` | y = the water line. Glides between x and x + `range` (480) at `speed` (0.35), turning at the ends; `dir` (1). z 4 |
 * | `ams-cyclist-bg` | y = the road line. `look` 0–3 (default from x), `dir` (1), `speed` (1.2). Rides on; when it leaves the view on its heading side it comes back in on the other side (endless traffic). `minX` / `maxX` (optional) bound the loop to a stretch; `haze` (0.28) = alpha of a sky-haze overlay (a depth cue, so it never reads as an enemy rider). z 6 |
 * | `ams-pigeons` | y = the floor. `count` (4, max 8) birds within `spread` (36) px of x: they peck and step; a player on foot or riding within 56 px makes all of them fly up and away (`fled`); the flock is removed when the birds are out of view. z 26 |
 * | `ams-window-waver` | y = the window sill (feet anchor of the 20×26 window). `look` 'person' (default) or 'cat'; a person appears, waves (also when a player comes within 96 px), leaves again; `period` (360). z 3 |
 *
 * ## Platform and breakables
 *
 * | id | params |
 * |---|---|
 * | `ams-boat-platform` | a small open canal boat: a one-way platform `w` (52) wide with its top at y (water line ≈ y + 6). Sails between x and x + `range` (160) at `speed` (0.5), pausing `pause` (40) ticks at each end, bobbing `bob` (1) px over `period` (120) ticks; `dir` (1). `range: 0` = it only bobs. Carries whoever stands on it |
 * | `ams-herring-cart` · `ams-tulip-stall` · `ams-market-stall` · `ams-bike-rack` | team 'enemy', tags shootable / soft / prop (never 'enemy': no wave, no kill). `hp` (20 / 20 / 30 / 30), `contains` (any drop value; defaults cheese / gem / auto / bombs; `'none'` = nothing) and `reveal` (spawn specs, all spawned, like `breakable-wall`). 100 points; the wreck stays as decor. `broken` turns true |
 */
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { Animator, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import type { Bubble, BubbleKind } from '../../../context';
import { hudOf } from '../../../context';
import { isPlayer, type Player } from '../../../player/player';
import { defineEntity, paramBool, paramNum, paramStr, toSpawnSpec, type SpawnParams } from '../../../registry';
import { Entity } from '../../../../engine/entity';
import { farOff, playerPos } from './ambient';
import './breakables';
import { STAFF_LOOKS, TOSS_RELEASE } from './npc.art';

export { AmsBoatPlatform, AmsCyclistBg, AmsPigeons, AmsTourBoat, AmsWindowWaver, PIGEONS } from './ambient';
export { AMS_BREAKABLES, AMS_BREAKABLE_SCORE, AmsBreakable } from './breakables';

const drawOpts: DrawOpts = {};

// ============================================================================== people

export type PersonMode = 'idle' | 'walk' | 'clap' | 'cheer' | 'wave' | 'talk' | 'toss' | 'salute';
const MODES: readonly PersonMode[] = ['idle', 'walk', 'clap', 'cheer', 'wave', 'talk', 'toss', 'salute'];

/** A friendly townsperson: an Animator over `npc/ams/<…>/<mode>` strips, driven by a script. */
export class AmsPerson extends Entity {
  readonly anim = new Animator();
  readonly prefix: string;
  mode: PersonMode = 'idle';
  /** Walk target. */
  targetX: number;
  speed: number;
  /** The last walkTo() reached its target. */
  arrived = true;
  readonly counter: boolean;
  /** Ticks left in a timed mode (Infinity = until changed). */
  protected modeLeft = Infinity;
  protected after: PersonMode = 'idle';

  constructor(world: World, x: number, y: number, p: SpawnParams, prefix: string) {
    super(world, x, y);
    this.prefix = prefix;
    this.facing = paramNum(p, 'facing', -1) < 0 ? -1 : 1;
    this.targetX = paramNum(p, 'to', x);
    this.speed = Math.max(0.1, paramNum(p, 'speed', 0.8));
    this.counter = paramBool(p, 'counter', false);
    this.z = 27;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -7, y: -36, w: 14, h: 36 };
    this.addTag('npc');
    const m = paramStr(p, 'mode', 'idle') as PersonMode;
    if (m === 'walk') this.walkTo(this.targetX);
    else this.setMode(MODES.includes(m) ? m : 'idle');
  }

  /** Sprite id of a mode (falls back to idle when the strip does not exist). */
  protected strip(mode: PersonMode): string {
    const id = `${this.prefix}/${mode}`;
    return hasSprite(id) ? id : `${this.prefix}/idle`;
  }

  setMode(mode: PersonMode, ticks = Infinity, then: PersonMode = 'idle'): void {
    this.mode = mode;
    this.modeLeft = ticks;
    this.after = then;
    this.anim.play(this.strip(mode), { restart: true, loop: mode !== 'toss' });
  }

  idle(): void {
    this.setMode('idle');
  }
  clap(ticks = Infinity): void {
    this.setMode('clap', ticks);
  }
  cheer(ticks = Infinity): void {
    this.setMode('cheer', ticks);
  }
  wave(ticks = Infinity): void {
    this.setMode('wave', ticks);
  }
  talk(ticks = 150): void {
    this.setMode('talk', ticks);
  }

  walkTo(x: number, then: PersonMode = 'idle'): void {
    this.targetX = x;
    this.arrived = Math.abs(x - this.x) < 0.5;
    if (this.arrived) {
      this.setMode(then);
      return;
    }
    this.facing = x > this.x ? 1 : -1;
    this.setMode('walk', Infinity, then);
  }

  face(x: number): void {
    if (x !== this.x) this.facing = x > this.x ? 1 : -1;
  }

  say(text: string, ticks = 150, kind: BubbleKind = 'gag'): Bubble {
    return hudOf(this.world).bubble(this, text, { kind, ticks, dy: -2 });
  }

  override update(): void {
    if (this.mode === 'walk') {
      const d = this.targetX - this.x;
      if (Math.abs(d) <= this.speed) {
        this.x = this.targetX;
        this.arrived = true;
        this.setMode(this.after);
      } else this.x += Math.sign(d) * this.speed;
    } else if (this.modeLeft !== Infinity && --this.modeLeft <= 0) this.setMode(this.after);
    if (this.mode !== 'walk' && farOff(this, 160)) return;
    this.anim.update();
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    r.sprite(this.anim.id, this.anim.index, x, y, drawOpts);
    if (this.counter) {
      drawOpts.flipX = false;
      r.sprite('npc/ams/counter', 0, x + this.facing * 5, y, drawOpts);
    }
  }
}

/** The Fabel Friet baker: idle with his fry scoop, talks, tosses the player a crate. */
export class AmsBaker extends AmsPerson {
  /** Number of items thrown so far. */
  tossed = 0;
  private tossSpec: unknown;
  private released = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, 'npc/ams/ams-baker');
    this.tossSpec = p.toss ?? 'crate';
  }

  /** Who the next `toss()` aims at (null: the nearest player). */
  private tossAt: Entity | null = null;

  /** Throw `contents` (a spawn spec; default the `toss` param) toward `target` (default: the nearest player). */
  toss(contents?: unknown, target: Entity | null = null): void {
    if (contents !== undefined) this.tossSpec = contents;
    this.tossAt = target;
    this.released = false;
    this.setMode('toss');
  }

  override update(): void {
    super.update();
    if (this.mode !== 'toss') return;
    if (!this.released && this.anim.index >= TOSS_RELEASE) {
      this.released = true;
      this.release();
    }
    if (this.anim.done) this.setMode('idle');
  }

  private release(): void {
    const spec = toSpawnSpec(this.tossSpec);
    if (!spec) return;
    const pt = this.anim.point('hand', this.facing < 0, handPt) ?? null;
    const hx = this.x + (pt ? pt[0] : this.facing * 6);
    const hy = this.y + (pt ? pt[1] : -30);
    const e = this.world.spawn(spec.id, hx, hy, spec.params);
    this.tossed++;
    this.world.audio.sfx('weapon/grenade-throw', { vol: 0.6 });
    if (!e) return;
    const aim = this.tossAt && this.tossAt.alive ? this.tossAt : null;
    const target = (aim ?? this.world.nearestPlayer(this.x, this.y)) as Player | null;
    const tossTo = (e as unknown as { tossTo?: (p: Player | null) => void }).tossTo;
    if (typeof tossTo === 'function' && target) {
      tossTo.call(e, target);
      return;
    }
    const dx = target ? target.x - hx : this.facing * 40;
    e.vx = Math.max(-2.2, Math.min(2.2, dx / 40));
    e.vy = -3.2;
    if (e.body) e.body.groundFriction = 0.7;
  }
}
const handPt: [number, number] = [0, 0];

/** The hot-dog vendor in his stand: salutes every passing player once. */
export class AmsHotdogVendor extends AmsPerson {
  /** Bit mask of the player slots he saluted. */
  saluted = 0;
  readonly range: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, 'npc/ams/ams-hotdog-vendor');
    this.range = Math.max(8, paramNum(p, 'range', 40));
  }

  override update(): void {
    super.update();
    if (this.mode === 'salute') {
      // Keep looking at the nearest passer-by while saluting.
      const n = this.world.nearestPlayer(this.x, this.y);
      if (n) this.face(n.x);
    }
    const list = this.world.players;
    for (let i = 0; i < list.length; i++) {
      const pl = list[i];
      if (!isPlayer(pl)) continue;
      const bit = 1 << pl.index;
      if (this.saluted & bit) continue;
      const w = playerPos(pl);
      if (!w || Math.abs(w.x - this.x) > this.range || Math.abs(w.y - this.y) > 72) continue;
      this.saluted |= bit;
      this.face(w.x);
      this.setMode('salute', 70);
      this.say(w.swan ? 'NICE BIRD, SOLDIER!' : 'HOWDY, SOLDIER!', 100, 'gag');
    }
  }
}

/** Fabel Friet staff (`look` 0–2). */
export class AmsStaff extends AmsPerson {
  readonly look: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const look = Math.max(0, Math.min(STAFF_LOOKS - 1, Math.round(paramNum(p, 'look', 0))));
    super(world, x, y, p, `npc/ams/ams-staff/${look}`);
    this.look = look;
  }
}

// ============================================================================== registry

defineEntity('ams-baker', (w, x, y, p) => new AmsBaker(w, x, y, p), { category: 'npc', description: 'ams Fabel Friet baker (talk / toss / walkTo / clap / cheer).' });
defineEntity('ams-hotdog-vendor', (w, x, y, p) => new AmsHotdogVendor(w, x, y, p), { category: 'npc', description: 'ams hot-dog vendor: salutes each passing player once.' });
defineEntity('ams-staff', (w, x, y, p) => new AmsStaff(w, x, y, p), { category: 'npc', description: 'ams Fabel Friet staff (look 0-2; idle / walk / clap / cheer / wave).' });
