/**
 * Mission oldenzaal — Meneer Wu and Mevrouw Winkel (docs/design/oldenzaal.md §4.2, §6;
 * docs/api/oldenzaal.md "WUGHOST"). Owner: WUGHOST. Art in ./art.ts; lines in
 * missions/oldenzaal/lines.ts; sfx 'oz/wu/…', 'oz/ghost/…' in sfx/oldenzaal-wu.ts.
 *
 * ## `oz-wu` — Meneer Wu (category 'npc'; team neutral, never a target)
 * Params: `facing` (−1), `mode` ('idle'), `speed` (0.8). y = the floor under his feet.
 * API: `setMode(mode, ticks = Infinity, then = 'idle')`, `idle()`, `wave(t)`, `talk(t)`,
 * `wipe(t)`, `scoop(t)`, `nod()`, `walkTo(x, then)` (`arrived`), `face(x)`, `say(text, ticks, kind)`
 * (a bubble voiced by speaker 'wu'), `toss(spec, target)` (the item leaves his hand on the
 * strip's release frame and flies to `target`; `tossed` counts, `thrown` lists the items).
 * Modes: idle (at the door, the scoop at his belt), wave, talk, wipe, scoop, toss, nod, walk.
 *
 * ## The scene: `wuScene(ctx, { doorX, wu?, y? })` (INTEGRATE calls it in oz-b's script)
 * The timer pauses, enemy shots are erased, the input locks; Meneer Wu (the given one, else a
 * new `oz-wu` at doorX) waves the heroes in (`WU_CALL`), they walk to him; he says `WU_LINES`
 * (hint bubbles, speaker 'wu', 150 ticks each, auto-advance; FIRE skips a line after 20 ticks)
 * while he talks, wipes and scoops; then he tosses each living hero a `pickup-oz-meal`. Every
 * living hero who has no snack power after the toss gets the meal anyway (`eatMeal`: also when
 * the lines were skipped or a tray was missed); a tray left lying is removed. A firm nod, the pads
 * and the timer come back. Returns when done (about 16 s, or about 4 s when every line is
 * skipped). Wu stays at his door (wiping).
 *
 * ## `oz-winkel` — Mevrouw Winkel, the ghost (category 'npc'; NEVER a target)
 * No 'shootable' / 'enemy' tag and team neutral: shots pass through her, waits never wait for
 * her, the bot never aims at her. Drawn with `drawGhost` (see-through, the cold green pass, her
 * glow), a pale mist trail, the green lantern flame; a light (`LIGHT_TAG`, `lightOf`: the
 * lantern). Spawn params: `facing` (1), `visible` (false: spawns faded out; call `appear`).
 * API (every call returns `this`; scripts wait on the flags):
 * - `appear(ticks = 45)` fade in (sfx `oz/ghost/appear`); `vanish(ticks = 30, remove = true)` fade
 *   out (`oz/ghost/vanish`), then removed; `visible`, `fading`.
 * - `stand()`; `raiseLantern()` (the lantern up; held).
 * - `glideTo(x, y, speed = 1.2, then = 'stand')`, `glidePath(points, speed, then)`: floats along
 *   (the glide pose, facing the way she goes); `arrived`.
 * - `shriek(ticks = 50)`: the shriek pose, `oz/ghost/shriek`, a screen-wide cold shudder (a pale
 *   green flash and a short shake); `shrieking`.
 * - `possessInto(x, y, speed = 3.2)`: a fast dive at a point (wave B: the statue), fading out as
 *   she arrives; `possessed` turns true on arrival (she is removed).
 * - `flee(dx = 200, speed = 2.6)`: turns away and glides off, fading out (removed).
 * - `laugh()` (`oz/ghost/laugh`; never at a player's death), `whisper()`,
 *   `say(text, ticks = 150)` (a bubble voiced by speaker 'winkel').
 *
 * `winkelAppear(ctx, x, y, o?)`: oz-a's roof moment — she fades in on the roof at (x, y),
 * raises the lantern, says `WINKEL_LINES.roof`, holds `o.hold` (150) ticks and vanishes. A
 * background script (the section's script does not wait); returns the entity.
 */
import { Entity } from '../../../../engine/entity';
import { buttonMask, VirtualPad } from '../../../../engine/input';
import type { Rect } from '../../../../engine/math';
import { strideRate } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { ParticlePreset } from '../../../../engine/particles';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import { Animator, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import type { Bubble, BubbleKind } from '../../../context';
import { hudOf } from '../../../context';
import type { SectionContext } from '../../../mission/index';
import { Pickup } from '../../../pickup';
import type { Player } from '../../../player/player';
import { eraseEnemyShots } from '../../../projectile';
import { defineEntity, paramBool, paramNum, paramStr, toSpawnSpec, type SpawnParams } from '../../../registry';
import { eatMeal } from '../../characters/snack-power';
import { OZ_SPEAKER, OZ_STATUS_SNACK, OZ_WUGHOST } from '../../missions/oldenzaal/ids';
import { WINKEL_LINES, WU_CALL, WU_LINES } from '../../missions/oldenzaal/lines';
import { drawGhost } from '../kit/ghost-draw';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';
import { WINKEL_FLAME_DX, WINKEL_FLAME_DY, WU_TOSS_RELEASE, WU_TR_TICKS, WU_TRANSITIONS, WU_TURN_TICKS, WU_WALK_SPEED } from './art';

// =============================================================================== MENEER WU

export type WuMode = 'idle' | 'wave' | 'talk' | 'wipe' | 'scoop' | 'toss' | 'nod' | 'walk';
const WU_MODES: readonly WuMode[] = ['idle', 'wave', 'talk', 'wipe', 'scoop', 'toss', 'nod', 'walk'];
const WU_PREFIX = 'npc/oz-wu';
const wuDraw: DrawOpts = {};
const handPt: [number, number] = [0, 0];

export class OzWu extends Entity {
  readonly anim = new Animator();
  mode: WuMode = 'idle';
  targetX: number;
  speed: number;
  arrived = true;
  /** Items thrown so far, and the items themselves (the scene removes trays left lying). */
  tossed = 0;
  readonly thrown: Entity[] = [];
  protected modeLeft = Infinity;
  protected after: WuMode = 'idle';
  private tossSpec: unknown = OZ_WUGHOST.meal;
  private tossAt: Entity | null = null;
  private released = false;
  /** Draw-only turn and mode transition (as the ams people). */
  private turnT = 0;
  private turnFrom: 1 | -1 = -1;
  private lastFacing: 1 | -1 = -1;
  private trT = 0;
  private trId = '';
  private trBack = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.facing = paramNum(p, 'facing', -1) < 0 ? -1 : 1;
    this.lastFacing = this.facing;
    this.targetX = x;
    this.speed = Math.max(0.1, paramNum(p, 'speed', WU_WALK_SPEED));
    this.z = 27;
    this.team = 'neutral';
    this.despawnMargin = Infinity;
    this.hitbox = { x: -7, y: -37, w: 14, h: 37 };
    this.addTag('npc');
    const m = paramStr(p, 'mode', 'idle') as WuMode;
    this.setMode(WU_MODES.includes(m) && m !== 'walk' && m !== 'toss' ? m : 'idle');
    this.trT = 0;
  }

  private strip(mode: WuMode): string {
    const id = `${WU_PREFIX}/${mode}`;
    return hasSprite(id) ? id : `${WU_PREFIX}/idle`;
  }

  setMode(mode: WuMode, ticks = Infinity, then: WuMode = 'idle'): this {
    const prev = this.mode;
    this.trT = 0;
    if (prev !== mode) {
      const into = prev === 'idle' && WU_TRANSITIONS.includes(mode);
      const out = mode === 'idle' && WU_TRANSITIONS.includes(prev);
      const id = `${WU_PREFIX}/in-${into ? mode : prev}`;
      if ((into || out) && hasSprite(id)) {
        this.trId = id;
        this.trBack = out;
        this.trT = 2 * WU_TR_TICKS;
      }
    }
    this.mode = mode;
    this.modeLeft = ticks;
    this.after = then;
    this.anim.play(this.strip(mode), { restart: true, loop: mode !== 'toss' && mode !== 'nod' });
    return this;
  }

  idle(): this {
    return this.setMode('idle');
  }
  wave(ticks = Infinity): this {
    return this.setMode('wave', ticks);
  }
  talk(ticks = 150): this {
    return this.setMode('talk', ticks);
  }
  wipe(ticks = Infinity): this {
    return this.setMode('wipe', ticks);
  }
  scoop(ticks = 120): this {
    this.world.audio.sfx('oz/wu/fryer', { vol: 0.5 });
    return this.setMode('scoop', ticks);
  }
  /** A firm nod (24 ticks), then idle. */
  nod(): this {
    return this.setMode('nod', 24);
  }

  walkTo(x: number, then: WuMode = 'idle'): this {
    this.targetX = x;
    this.arrived = Math.abs(x - this.x) < 0.5;
    if (this.arrived) return this.setMode(then);
    this.facing = x > this.x ? 1 : -1;
    return this.setMode('walk', Infinity, then);
  }

  face(x: number): this {
    if (x !== this.x) this.facing = x > this.x ? 1 : -1;
    return this;
  }

  /** A speech bubble voiced by speaker 'wu' (a new line replaces the clip still playing). */
  say(text: string, ticks = 150, kind: BubbleKind = 'hint'): Bubble {
    return hudOf(this.world).bubble(this, text, { kind, ticks, dy: -2, speaker: OZ_SPEAKER.wu });
  }

  /** Toss `contents` (a spawn spec; default the meal) to `target` (default: the nearest player). */
  toss(contents?: unknown, target: Entity | null = null): this {
    if (contents !== undefined) this.tossSpec = contents;
    this.tossAt = target;
    this.released = false;
    if (target) this.face(target.x);
    this.world.audio.sfx('oz/wu/paper', { vol: 0.6 });
    return this.setMode('toss');
  }

  override update(): void {
    if (this.mode === 'walk') {
      const d = this.targetX - this.x;
      if (Math.abs(d) <= this.speed) {
        this.x = this.targetX;
        this.arrived = true;
        this.setMode(this.after);
      } else this.x += Math.sign(d) * this.speed;
    } else if (this.mode === 'toss') {
      if (!this.released && this.anim.index >= WU_TOSS_RELEASE) {
        this.released = true;
        this.release();
      }
      if (this.anim.done) this.setMode('idle');
    } else if (this.modeLeft !== Infinity && --this.modeLeft <= 0) this.setMode(this.after);
    const f: 1 | -1 = this.facing < 0 ? -1 : 1;
    if (f !== this.lastFacing) {
      this.turnFrom = this.lastFacing;
      this.lastFacing = f;
      this.turnT = this.turnT > 0 ? 0 : 4 * WU_TURN_TICKS;
    } else if (this.turnT > 0) this.turnT--;
    if (this.trT > 0) this.trT--;
    this.anim.update(this.mode === 'walk' ? strideRate(this.speed, WU_WALK_SPEED) : 1);
  }

  private release(): void {
    const spec = toSpawnSpec(this.tossSpec);
    if (!spec) return;
    const pt = this.anim.point('hand', this.facing < 0, handPt) ?? null;
    const hx = this.x + (pt ? pt[0] : this.facing * 6);
    const hy = this.y + (pt ? pt[1] : -30);
    const e = this.world.spawn(spec.id, hx, hy, spec.params);
    this.tossed++;
    this.thrown.push(e);
    this.world.audio.sfx('oz/wu/toss', { vol: 0.7 });
    const aim = this.tossAt && this.tossAt.alive ? this.tossAt : null;
    const target = (aim ?? this.world.nearestPlayer(this.x, this.y)) as Player | null;
    if (e instanceof Pickup && target) {
      e.tossTo(target);
      return;
    }
    const dx = target ? target.x - hx : this.facing * 40;
    e.vx = Math.max(-2.2, Math.min(2.2, dx / 40));
    e.vy = -3.2;
  }

  override draw(r: Renderer): void {
    const x = this.x;
    const y = this.y;
    wuDraw.flipX = this.facing < 0;
    const turnId = `${WU_PREFIX}/turn`;
    if (this.turnT > 0 && hasSprite(turnId)) {
      const i = Math.floor((4 * WU_TURN_TICKS - this.turnT) / WU_TURN_TICKS);
      wuDraw.flipX = (i < 2 ? this.turnFrom : this.facing) < 0;
      r.sprite(turnId, i < 2 ? i : 3 - i, x, y, wuDraw);
    } else if (this.trT > 0) {
      const k = Math.min(1, Math.floor((2 * WU_TR_TICKS - this.trT) / WU_TR_TICKS));
      r.sprite(this.trId, this.trBack ? 1 - k : k, x, y, wuDraw);
    } else r.sprite(this.anim.id, this.anim.index, x, y, wuDraw);
  }
}

// ------------------------------------------------------------------------------- the scene

const LOCKED = 0;
const LEFT = buttonMask('left');
const RIGHT = buttonMask('right');

/**
 * The cut-scene input lock (as the ams briefing's): every player gets a private empty pad
 * (re-applied every tick); `fire()` = fire went down on a real pad this tick.
 */
export class OzInputLock {
  private readonly real = new Map<Player, VirtualPad>();
  private readonly fake = new Map<Player, VirtualPad>();
  private readonly ctx: SectionContext;
  constructor(ctx: SectionContext) {
    this.ctx = ctx;
  }

  apply(steer?: (p: Player) => number): void {
    for (const p of this.ctx.players as readonly Player[]) {
      let v = this.fake.get(p);
      if (!v) {
        v = new VirtualPad();
        this.fake.set(p, v);
      }
      if (p.pad !== v) {
        this.real.set(p, p.pad);
        p.pad = v;
      }
      v.update(steer ? steer(p) : LOCKED);
    }
  }

  fire(): boolean {
    for (const pad of this.real.values()) if (pad.pressed('fire')) return true;
    return false;
  }

  restore(): void {
    for (const [p, pad] of this.real) if (p.pad === this.fake.get(p)) p.pad = pad;
    this.real.clear();
    this.fake.clear();
  }
}

/** Scene timing (ticks). */
export const WU_SCENE = {
  /** A line stays up this long (auto-advance) and cannot be skipped in its first ticks. */
  lineTicks: 150,
  skipAfter: 20,
  /** The heroes stand this far left of Meneer Wu (P2 another 22 px further). */
  standOff: 34,
  standGap: 22,
  /** Most ticks the heroes walk to him. */
  walkTicks: 150,
  /** The call from the door (with the wave) before the lines. */
  callTicks: 70,
  /** After the toss: the trays fly to their catchers. */
  catchTicks: 90,
} as const;

/** What Meneer Wu does while he says line i (his work never stops). */
const LINE_MODES: readonly WuMode[] = ['talk', 'wipe', 'talk', 'scoop', 'wipe', 'talk'];

const viewRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

export interface WuSceneOpts {
  /** De Smulhoek's door: Meneer Wu's spot (world x). */
  doorX: number;
  /** Meneer Wu, if the section spawned him already (else a new `oz-wu` at doorX). */
  wu?: Entity | null;
  /** His feet (default: the ground under doorX). */
  y?: number;
}

/** Meneer Wu's scene (see the module comment). */
export function* wuScene(ctx: SectionContext, o: WuSceneOpts): ScriptGen {
  eraseEnemyShots(ctx.world, ctx.camera.view(32, viewRect));
  ctx.timer.pause();
  const lock = new OzInputLock(ctx);
  const ground = ctx.world.terrain.groundY(o.doorX);
  const y = o.y ?? (Number.isFinite(ground) ? ground : 176);
  const wu = o.wu instanceof OzWu ? o.wu : (ctx.spawn(OZ_WUGHOST.wu, o.doorX, y, { facing: -1 }) as OzWu);
  try {
    lock.apply();
    // The call from the door: he waves them in.
    wu.face(wu.x - 1).wave(WU_SCENE.callTicks);
    const call = wu.say(WU_CALL, WU_SCENE.callTicks, 'gag');
    // The heroes walk to their spots left of him (P2 a little further back).
    const spot = (p: Player): number => wu.x - WU_SCENE.standOff - (p.index === 1 ? WU_SCENE.standGap : 0);
    let steps = 0;
    yield () => {
      steps++;
      let busy = false;
      lock.apply((p) => {
        if (!p.alive || p.state !== 'play' || steps > WU_SCENE.walkTicks) return LOCKED;
        const dx = spot(p) - p.x;
        if (Math.abs(dx) <= 3) return LOCKED;
        busy = true;
        return dx > 0 ? RIGHT : LEFT;
      });
      return (!busy && steps >= 24) || steps > WU_SCENE.walkTicks + 4;
    };
    call.ticks = 0;
    // Everyone turns to him (one tick toward him).
    lock.apply((p) => (p.alive ? (p.x < wu.x ? RIGHT : LEFT) : LOCKED));
    yield 1;
    lock.apply();
    const near = ctx.world.nearestPlayer(wu.x, wu.y);
    if (near) wu.face(near.x);
    // The lines: he works while he talks.
    for (let i = 0; i < WU_LINES.length; i++) {
      const mode = LINE_MODES[i % LINE_MODES.length];
      if (mode === 'talk') wu.talk(WU_SCENE.lineTicks - 10);
      else if (mode === 'wipe') wu.wipe(WU_SCENE.lineTicks - 10);
      else wu.scoop(WU_SCENE.lineTicks - 10);
      const bubble = wu.say(WU_LINES[i], WU_SCENE.lineTicks, 'hint');
      let t = 0;
      yield () => {
        lock.apply();
        t++;
        return t >= WU_SCENE.lineTicks || (t > WU_SCENE.skipAfter && lock.fire());
      };
      bubble.ticks = 0;
    }
    // One meal per living hero, each tossed to its own catcher.
    const living = ctx.players.filter((p) => p.alive && p.state !== 'dead' && p.state !== 'out');
    for (const catcher of living) {
      const before = wu.tossed;
      wu.toss({ id: OZ_WUGHOST.meal, params: { dropped: false } }, catcher);
      let t = 0;
      yield () => {
        lock.apply();
        return wu.tossed > before || ++t > 90;
      };
      yield () => {
        lock.apply();
        return wu.mode !== 'toss' || ++t > 120;
      };
    }
    // The trays reach their catchers.
    let t = 0;
    yield () => {
      lock.apply();
      return ++t >= WU_SCENE.catchTicks || wu.thrown.every((e) => e.removed);
    };
    // The meal is given even when skipped or missed (spec §4.2): one per living hero.
    for (const p of ctx.players) if (p.alive && !p.status.has(OZ_STATUS_SNACK)) eatMeal(p);
    for (const e of wu.thrown) if (!e.removed) e.remove();
    wu.thrown.length = 0;
    if (near) wu.face(near.x);
    wu.nod();
    t = 0;
    yield () => {
      lock.apply();
      return ++t >= 26;
    };
    wu.wipe();
  } finally {
    lock.restore();
    ctx.timer.resume();
  }
}

// ============================================================================ MEVROUW WINKEL

export type WinkelMode = 'stand' | 'raise' | 'glide' | 'shriek' | 'dive' | 'flee';
const W_PREFIX = 'npc/oz-winkel';

/** Her pale mist trail (additive, cosmetic). */
const MIST: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [26, 44],
  gravity: -0.012,
  drag: 0.96,
  colors: [PAL.green[1], PAL.teal[1], PAL.green[0]],
  fadeFrom: 0.2,
  additive: true,
};

const flameOpts: DrawOpts = { blend: 'add' };
const flameBody: DrawOpts = {};
const shudderTicks = 26;

export class OzWinkel extends Entity implements LightSource {
  readonly anim = new Animator();
  mode: WinkelMode = 'stand';
  /** 0 = invisible … 1 = fully there (the ghost alpha scales with it). */
  fade = 0;
  private fadeStep = 0;
  private removeAtZero = false;
  /** The glide path (world px) and its speed. */
  private path: Array<readonly [number, number]> = [];
  private speed = 1.2;
  private then: WinkelMode = 'stand';
  /** The last glide reached its end. */
  arrived = true;
  /** The dive reached its point (`possessInto`). */
  possessed = false;
  private diving = false;
  private fleeing = false;
  private shriekLeft = 0;
  private shudder = 0;
  /** Ticks alive (bob, shimmer). */
  t = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.facing = paramNum(p, 'facing', 1) < 0 ? -1 : 1;
    this.z = 58;
    this.team = 'neutral';
    this.despawnMargin = Infinity;
    this.hitbox = { x: -7, y: -38, w: 14, h: 38 };
    this.addTag('npc');
    this.addTag(LIGHT_TAG);
    this.fade = paramBool(p, 'visible', false) ? 1 : 0;
    this.setMode('stand');
  }

  /** Never a target: no hurt boxes at all. */
  override hurtboxes(): readonly Rect[] {
    return NO_BOXES;
  }

  get visible(): boolean {
    return this.fade > 0;
  }

  get fading(): boolean {
    return this.fadeStep !== 0;
  }

  get shrieking(): boolean {
    return this.shriekLeft > 0;
  }

  private setMode(m: WinkelMode): void {
    this.mode = m;
    const id = `${W_PREFIX}/${m}`;
    this.anim.play(hasSprite(id) ? id : `${W_PREFIX}/stand`, { restart: true, loop: m !== 'raise' });
  }

  appear(ticks = 45): this {
    this.fadeStep = 1 / Math.max(1, ticks);
    this.removeAtZero = false;
    this.world.audio.sfx('oz/ghost/appear');
    return this;
  }

  vanish(ticks = 30, remove = true): this {
    this.fadeStep = -1 / Math.max(1, ticks);
    this.removeAtZero = remove;
    this.world.audio.sfx('oz/ghost/vanish');
    return this;
  }

  stand(): this {
    this.path.length = 0;
    this.arrived = true;
    this.setMode('stand');
    return this;
  }

  raiseLantern(): this {
    this.setMode('raise');
    return this;
  }

  glideTo(x: number, y: number, speed = 1.2, then: WinkelMode = 'stand'): this {
    return this.glidePath([[x, y]], speed, then);
  }

  glidePath(points: ReadonlyArray<readonly [number, number]>, speed = 1.2, then: WinkelMode = 'stand'): this {
    this.path = points.slice();
    this.speed = Math.max(0.1, speed);
    this.then = then;
    this.arrived = this.path.length === 0;
    if (!this.arrived) this.setMode('glide');
    return this;
  }

  shriek(ticks = 50): this {
    this.shriekLeft = ticks;
    this.shudder = shudderTicks;
    this.setMode('shriek');
    this.world.audio.sfx('oz/ghost/shriek');
    this.world.camera.shake(2, 20);
    return this;
  }

  possessInto(x: number, y: number, speed = 3.2): this {
    this.possessed = false;
    this.diving = true;
    this.glidePath([[x, y]], speed, 'dive');
    this.setMode('dive');
    return this;
  }

  flee(dx = 200, speed = 2.6): this {
    this.fleeing = true;
    this.facing = dx < 0 ? -1 : 1;
    this.glidePath([[this.x + dx, this.y - 24]], speed, 'flee');
    this.setMode('flee');
    this.world.audio.sfx('oz/ghost/shriek', { vol: 0.6 });
    return this;
  }

  laugh(): this {
    this.world.audio.sfx('oz/ghost/laugh');
    return this;
  }

  whisper(): this {
    this.world.audio.sfx('oz/ghost/whisper');
    return this;
  }

  say(text: string, ticks = 150): Bubble {
    return hudOf(this.world).bubble(this, text, { kind: 'gag', ticks, dy: 2, speaker: OZ_SPEAKER.winkel });
  }

  override update(): void {
    this.t++;
    // Fade.
    if (this.fadeStep !== 0) {
      this.fade = Math.max(0, Math.min(1, this.fade + this.fadeStep));
      if (this.fade >= 1 || this.fade <= 0) {
        this.fadeStep = 0;
        if (this.fade <= 0 && this.removeAtZero) {
          this.remove();
          return;
        }
      }
    }
    // Glide along the path.
    if (this.path.length > 0) {
      const [tx, ty] = this.path[0];
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.5) this.facing = dx < 0 ? -1 : 1;
      if (dist <= this.speed) {
        this.x = tx;
        this.y = ty;
        this.path.shift();
        if (this.path.length === 0) this.onArrive();
      } else {
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
      }
    }
    if (this.shriekLeft > 0 && --this.shriekLeft === 0 && this.mode === 'shriek') this.setMode('stand');
    if (this.shudder > 0) this.shudder--;
    // The mist trail at the hem.
    if (this.fade > 0.2 && this.t % 3 === 0) {
      const rng = this.world.fxRng;
      const back = this.path.length > 0 ? -this.facing * 0.5 : 0;
      this.world.particles.emit(MIST, this.x + (rng.next() - 0.5) * 10, this.y - 2 - rng.next() * 6, back + (rng.next() - 0.5) * 0.3, -0.15 - rng.next() * 0.2);
    }
    this.anim.update();
  }

  private onArrive(): void {
    this.arrived = true;
    if (this.diving) {
      this.diving = false;
      this.possessed = true;
      this.world.audio.sfx('oz/ghost/vanish');
      this.fade = 0;
      this.remove();
      return;
    }
    if (this.fleeing) {
      this.fleeing = false;
      this.vanish(20);
      return;
    }
    this.setMode(this.then);
  }

  /** The lantern's flame in world px (null while invisible). */
  private flamePos(out: [number, number]): boolean {
    const pt = this.anim.point('hand', this.facing < 0, handPt);
    if (!pt) return false;
    const fdx = this.facing < 0 ? -WINKEL_FLAME_DX : WINKEL_FLAME_DX;
    out[0] = this.x + pt[0] + fdx;
    out[1] = this.y + this.bob() + pt[1] + WINKEL_FLAME_DY;
    return true;
  }

  private bob(): number {
    return Math.round(Math.sin(this.t * 0.06) * 1.5) - 2;
  }

  lightOf(out: LightSpot, _tick: number): boolean {
    if (this.fade <= 0.05 || !this.flamePos(flameAt)) return false;
    out.x = flameAt[0];
    out.y = flameAt[1];
    out.r = 34;
    out.color = PAL_HD_OZ.ghost[4];
    out.intensity = 0.85 * this.fade;
    out.flicker = 0.35;
    return true;
  }

  override draw(r: Renderer): void {
    if (this.shudder > 0) r.fade(PAL_HD_OZ.ghost[5], (this.shudder / shudderTicks) * 0.22);
    if (this.fade <= 0) return;
    const y = this.y + this.bob();
    drawGhost(r, this.anim.id, this.anim.index, this.x, y, {
      alpha: 0.62 * this.fade,
      glow: `${W_PREFIX}/glow`,
      glowAlpha: 0.28,
      t: this.t,
      flipX: this.facing < 0,
    });
    if (this.flamePos(flameAt)) {
      const fi = (this.t >> 2) & 3;
      flameBody.alpha = 0.8 * this.fade;
      r.sprite(`${W_PREFIX}/flame`, fi, flameAt[0], flameAt[1], flameBody);
      flameOpts.alpha = 0.7 * this.fade;
      r.sprite(`${W_PREFIX}/flame`, fi, flameAt[0], flameAt[1], flameOpts);
    }
  }
}

const NO_BOXES: readonly Rect[] = [];
const flameAt: [number, number] = [0, 0];

export interface WinkelAppearOpts {
  /** Ticks she stays after the line (default 150). */
  hold?: number;
  /** Say `WINKEL_LINES.roof` (default true). */
  line?: boolean;
  facing?: 1 | -1;
}

/** oz-a's roof moment (see the module comment): returns Mevrouw Winkel; she removes herself. */
export function winkelAppear(ctx: SectionContext, x: number, y: number, o: WinkelAppearOpts = {}): Entity {
  const w = ctx.spawn(OZ_WUGHOST.winkel, x, y, { facing: o.facing ?? -1 }) as OzWinkel;
  if (!(w instanceof OzWinkel)) return w;
  const hold = o.hold ?? 150;
  const line = o.line !== false;
  ctx.world.scripts.run(
    function* ozWinkelRoof(): ScriptGen {
      w.appear(45);
      yield 50;
      if (w.removed) return;
      w.raiseLantern();
      w.whisper();
      if (line) w.say(WINKEL_LINES.roof, Math.min(150, hold));
      yield hold;
      if (w.removed) return;
      w.laugh();
      yield 30;
      if (!w.removed) w.vanish(30);
    },
    { name: 'oz winkel roof' },
  );
  return w;
}

// ============================================================================== registry

defineEntity(OZ_WUGHOST.wu, (w, x, y, p) => new OzWu(w, x, y, p), {
  category: 'npc',
  description: 'oldenzaal: Meneer Wu at De Smulhoek (talk / wave / wipe / scoop / toss / nod / walkTo).',
});
defineEntity(OZ_WUGHOST.winkel, (w, x, y, p) => new OzWinkel(w, x, y, p), {
  category: 'npc',
  description: 'oldenzaal: Mevrouw Winkel, the ghost (never a target; appear / glide / shriek / possessInto / flee / vanish).',
});
