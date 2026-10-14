/**
 * Hostages (docs/ARCHITECTURE.md §6, GDD §7.2).
 *
 * Flow: 'tied' (a wriggle and an MMF! bubble every 120 ticks) → freed by what its bind allows (a
 * touch, a shot, a blast, the knife, or a shot rope): +500 and +1 to the freeing player's hostage
 * tally at once → optional 'release' (a bind's own sequence: the cage falls and breaks, the
 * balloon hostage parachutes) → 'freed' (20 ticks: ropes drop, a stretch) → 'walk' to the
 * freeing player (0.8 px/tick, until within 16 px or 180 ticks; a wall or a gap ahead stops it:
 * it gives where it stands; a dead / gone rescuer → the nearest living player) → 'gag' (the
 * kind's comedy beat, if any) → 'give' (24 ticks; the gift pops from the 'hand' point, vy −2.0)
 * → 'bow' (12 ticks, a curtain-call bow — hostages never salute) → 'run' off to the left
 * (2 px/tick; turns back at a wall or gap) → gone. A touch while walking ends the walk.
 * Hostages are neutral: never hurt, never a target, never walk into pits.
 *
 * Content plugs in a **bind** (how it is held: chair, cage, sack, float, balloon) and a
 * **kind** (who it is: its gag, its strips, where the gift appears) — see `HostageBind` and
 * `HostageKind`. Without them it behaves like a hostage tied to a chair.
 *
 * Spawn params read here: `item` (entity id, `{ id, params }` or a list to pick from), `art`
 * (sprite prefix, default 'item/hostage'), `facing` (default −1: facing the player who comes
 * from the left). Sprites (§6.1): `<art>/tied`, `freed`, `walk`, `give` ('hand' point), `run`,
 * `bow`, `gag`, plus the bind strips the content names (`caged`, `sack`, `mast`, `dangle`,
 * `chute` …). A missing strip falls back (`HOSTAGE_FALLBACKS`), so a bare prefix still works.
 * ```ts
 * defineEntity('hostage', (w, x, y, p) => new Hostage(w, x, y, p), { category: 'hostage' });
 * ctx.spawn('hostage', 640, 'ground', { item: { id: 'pickup-weapon', params: { weapon: 'machine-gun' } } });
 * ```
 */
import { Entity, type Damage } from '../engine/entity';
import { overlaps, type Rect } from '../engine/math';
import { Body, moveBody, type SolidBox } from '../engine/physics';
import type { DrawOpts, Renderer } from '../engine/render';
import { Animator, frameCount, framePoint, getFrame, hasSprite } from '../engine/sprites';
import type { World } from '../engine/world';
import { hudOf, sessionOf } from './context';
import { awardScore } from './events';
import { Pickup, ITEM_RULES, safeStep } from './pickup';
import { isPlayer, type Player } from './player/player';
import { getEntityMeta, NO_PARAMS, paramSpawn, paramStr, type SpawnParams, type SpawnSpec } from './registry';
import { TUNING } from './tuning';

export type HostageState = 'tied' | 'release' | 'freed' | 'walk' | 'gag' | 'give' | 'bow' | 'run';

/** Points for freeing a hostage (GDD §7.4, §14.3; the mission tally pays 10,000 more per rescue). */
export const HOSTAGE_FREE_SCORE = 500;

declare module '../engine/world' {
  interface WorldEvents {
    /** A hostage handed over its gift (`item` = the spawned entity; null = nothing to give). */
    hostageGift: { hostage: Entity; slot: number; item: Entity | null };
  }
}

/**
 * How a hostage is held (GDD §7.2 `params.bind`). One object per hostage (it may keep state).
 * The base class handles the generic parts: the MMF! wriggle, touch / shot / blast / knife
 * freeing (as `frees` allows), the rescue count and the walk-gag-give-bow-run flow.
 */
export interface HostageBind {
  /** 'chair' | 'cage' | 'sack' | 'float' | 'balloon' … */
  readonly id: string;
  /** Strip played while tied (default 'tied'). */
  readonly anim?: string;
  /**
   * The tied strip is [rest, blink, struggle]: the hostage blinks now and then and shows the
   * struggle frame during the wriggle (else the strip just loops).
   */
  readonly struggle?: boolean;
  /** What frees it at once. */
  readonly frees: { readonly touch: boolean; readonly shot: boolean; readonly blast: boolean; readonly knife: boolean };
  /** Set up once, on the first update (rope targets, props). */
  attach?(h: Hostage): void;
  /** Every tick while tied (hops, drifting). */
  tick?(h: Hostage): void;
  /** A rope (`BindTarget`) of this bind was cut by player `slot`. */
  partBroken?(h: Hostage, part: string, slot: number): void;
  /** A player blast reached the hostage while it was not freed by it (`frees.blast` false). */
  blasted?(h: Hostage, owner: number): void;
  /**
   * Freed by `slot`: return 'release' to run a release sequence first (`releasing` every tick
   * until it calls `h.released()`), else the hostage goes straight to the 'freed' stretch.
   */
  release?(h: Hostage, slot: number): 'release' | void;
  releasing?(h: Hostage): void;
  /** Strip played during 'release' (default: the tied strip). */
  readonly releaseAnim?: string;
  /** Change the gift before it is handed over (`to` = the player it goes to). */
  gift?(h: Hostage, spec: SpawnSpec, to: Player | null): SpawnSpec | null;
  /** Extra drawing behind / in front of the figure (ropes, the mast, the balloon …). */
  drawBack?(h: Hostage, r: Renderer): void;
  drawFront?(h: Hostage, r: Renderer): void;
  /** The hostage leaves the world: remove helpers (rope targets). */
  detach?(h: Hostage): void;
}

/** Who a hostage is (GDD §7.2 `params.kind`): shared by every hostage of that kind. */
export interface HostageKind {
  readonly id: string;
  /** Ticks of the comedy beat between the walk and the gift (0 / missing = none). */
  readonly gagTicks?: number;
  /** Every tick of the gag (t = 0 … gagTicks − 1): bubbles, sounds, flashes. */
  gag?(h: Hostage, t: number): void;
  /** Frame of the 'gag' strip to show at gag tick t (default: the strip just loops). */
  gagFrame?(h: Hostage, t: number): number;
  /** Strip names per state (default: the state name), e.g. the roadie walks with 'carry'. */
  readonly anims?: Partial<Record<HostageState, string>>;
  /** Where the gift appears instead of the hand (Mrs. Dollop's shed); null = the hand. */
  giftAt?(h: Hostage): { x: number; y: number } | null;
  /** The gift was handed over (the roadie leaves his empty case behind). */
  gave?(h: Hostage, item: Entity | null): void;
  /** Drawn over the figure (the critic's stars on his card). */
  drawFront?(h: Hostage, r: Renderer): void;
}

/** The plain bind: tied to a chair; a touch, any player shot, blast or knife frees it. */
export const PLAIN_BIND: HostageBind = Object.freeze({
  id: 'chair',
  struggle: true,
  frees: Object.freeze({ touch: true, shot: true, blast: true, knife: true }),
});

/**
 * Strip fallbacks when a kind has no strip of that name: bind strips fall back to the tied
 * pose, the roadie's carry walk to the walk, a missing bow or gag to the give.
 */
export const HOSTAGE_FALLBACKS: Readonly<Record<string, string>> = {
  caged: 'tied',
  sack: 'tied',
  mast: 'tied',
  dangle: 'tied',
  chute: 'dangle',
  carry: 'walk',
  gag: 'give',
  bow: 'give',
  freed: 'walk',
};

export interface HostageOpts {
  kind?: HostageKind | null;
  bind?: HostageBind | null;
}

const drawOpts: DrawOpts = {};
const hand: [number, number] = [0, 0];
/** Wriggle period and shake length (GDD §7.2 step 1). */
const WRIGGLE_EVERY = 120;
const WRIGGLE_TICKS = 4;
/** Running off: blocked closer than this to the view edge it runs to, it fades out there. */
const RUN_EDGE_EXIT = 24;
/** Running off but stuck: blink this long, then gone. */
const RUN_FADE_TICKS = 40;

export class Hostage extends Entity {
  art: string;
  readonly anim = new Animator();
  state: HostageState = 'tied';
  /** The item handed over (spawn param `item`). */
  item: SpawnSpec | null;
  /** Slot of the player who freed it (-1 = nobody yet / unknown). */
  rescuer = -1;
  /** Counted in a player's hostage tally. */
  rescued = false;
  readonly homeX: number;
  readonly homeY: number;
  readonly params: SpawnParams;
  readonly kind: HostageKind | null;
  readonly bind: HostageBind;
  /** Ticks in the current state. */
  stateT = 0;
  /** No physics while true (a hanging cage, the balloon): the bind moves it. */
  floating = false;
  /** Drawing offset (hops, sways); does not move the hitbox. */
  offX = 0;
  offY = 0;
  /** Free value for the kind's gag (the critic's star count …). */
  gagValue = 0;
  /** The gift has been handed over. */
  given = false;
  private shakeT = 0;
  private attached = false;
  /** Running off: turned around once already (both ways blocked → just fades out). */
  private turned = false;
  /** Running off but unable to move: ticks of the blinking fade-out. */
  private fadeT = 0;
  private readonly ids = new Map<string, string>();

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS, o: HostageOpts = {}) {
    super(world, x, y);
    this.params = params;
    this.art = paramStr(params, 'art', 'item/hostage');
    this.item = paramSpawn(params, 'item', world);
    this.kind = o.kind ?? null;
    this.bind = o.bind ?? PLAIN_BIND;
    this.homeX = x;
    this.homeY = y;
    this.team = 'neutral';
    this.z = 25;
    this.facing = -1;
    this.despawnMargin = 200;
    this.body = new Body({ w: 14, h: 26 });
    this.hitbox = { x: -8, y: -26, w: 16, h: 26 };
    this.addTag('hostage');
    this.play(this.stripFor('tied'));
  }

  // ------------------------------------------------------------------------------- sprites

  /** Sprite id of a strip of this hostage (with the fallbacks of HOSTAGE_FALLBACKS). */
  spriteId(name: string): string {
    let id = this.ids.get(name);
    if (id === undefined) {
      id = `${this.art}/${name}`;
      let n = name;
      for (let k = 0; k < 4 && !hasSprite(id); k++) {
        const fb = HOSTAGE_FALLBACKS[n];
        if (!fb) break;
        n = fb;
        if (hasSprite(`${this.art}/${n}`)) id = `${this.art}/${n}`;
      }
      this.ids.set(name, id);
    }
    return id;
  }

  /** The strip name for a state (kind and bind overrides). */
  stripFor(state: HostageState): string {
    if (state === 'tied') return this.bind.anim ?? 'tied';
    if (state === 'release') return this.bind.releaseAnim ?? this.bind.anim ?? 'tied';
    return this.kind?.anims?.[state] ?? state;
  }

  play(name: string, loop = true): void {
    this.anim.play(this.spriteId(name), { loop });
  }

  private setState(s: HostageState): void {
    this.state = s;
    this.stateT = 0;
    const strip = this.stripFor(s);
    const once = s === 'freed' || s === 'give' || s === 'bow';
    this.anim.play(this.spriteId(strip), { restart: true, loop: !once });
  }

  // ------------------------------------------------------------------------------- freeing

  /**
   * Free it (`slot` = the freeing player, -1 = unknown): the rescue counts at once (+1 tally,
   * +500 points, GDD §7.2 step 2); then the bind's release sequence or the 'freed' stretch.
   * `_touched` is kept for subclasses that react differently to a touch.
   */
  free(slot: number, _touched = false): void {
    if (this.state !== 'tied') return;
    this.rescuer = slot;
    this.countRescue(slot);
    awardScore(this.world, slot, HOSTAGE_FREE_SCORE, this.x, this.y - 34);
    this.world.audio.sfx('hostage/free');
    hudOf(this.world).clearBubble(this);
    this.shakeT = 0;
    this.offX = 0;
    this.world.events.emit('hostageFreed', { hostage: this, slot });
    if (this.bind.release?.(this, slot) === 'release') this.setState('release');
    else this.setState('freed');
  }

  /** The bind's release sequence is over: the 'freed' stretch follows. */
  released(): void {
    if (this.state !== 'release') return;
    this.floating = false;
    this.setState('freed');
  }

  /** A player-team explosion reached it (fx.blast). */
  onBlast(_x: number, _y: number, _r: number, owner: number): void {
    if (this.state !== 'tied') return;
    if (this.bind.frees.blast) this.free(owner);
    else this.bind.blasted?.(this, owner);
  }

  /** A player's knife reached it (weapons.meleeStrike). */
  onMelee(owner: number): void {
    if (this.state === 'tied' && this.bind.frees.knife) this.free(owner);
  }

  /** A rope of the bind was cut (called by BindTarget). */
  partBroken(part: string, slot: number): void {
    if (this.state === 'tied') this.bind.partBroken?.(this, part, slot);
  }

  /** +1 in a player's hostage tally (once per hostage). */
  private countRescue(slotIndex: number): void {
    if (this.rescued) return;
    const slot = sessionOf(this.world).slot(slotIndex);
    if (!slot) return;
    this.rescued = true;
    slot.rescued++;
    slot.stats.hostages++;
    slot.mission.hostagesFreed++;
    this.world.events.emit('hostageRescued', { hostage: this, slot: slotIndex });
  }

  /** Hostages are never hurt. */
  override onHit(_d: Damage, _part = 0): boolean {
    return false;
  }

  /** Squeezed by a moving solid: it pops out on top of it (still tied, if it was). */
  override onCrushed(by: SolidBox): void {
    this.y = by.y;
    this.vy = 0;
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    if (!this.attached) {
      this.attached = true;
      this.bind.attach?.(this);
    }
    this.stateT++;
    const H = TUNING.hostage;
    switch (this.state) {
      case 'tied':
        this.vx = 0;
        this.updateTied();
        break;
      case 'release':
        this.bind.releasing?.(this);
        break;
      case 'freed':
        this.vx = 0;
        if (this.stateT >= H.freedTicks) {
          const touch = this.touchingPlayer();
          if (touch) this.arrive(touch);
          else this.setState('walk');
        }
        break;
      case 'walk':
        this.walkToRescuer();
        break;
      case 'gag':
        this.vx = 0;
        this.kind?.gag?.(this, this.stateT - 1);
        if (this.stateT >= (this.kind?.gagTicks ?? 0)) this.startGive();
        break;
      case 'give':
        this.vx = 0;
        if (this.stateT === Math.floor(H.giveTicks / 2)) this.handOver();
        if (this.stateT >= H.giveTicks) this.setState('bow');
        break;
      case 'bow':
        this.vx = 0;
        if (this.stateT >= H.bowTicks) this.startRun();
        break;
      case 'run':
        this.updateRun();
        break;
    }
    if (!this.floating && !this.removed) moveBody(this, this.world.terrain, this.world);
    this.anim.update();
  }

  /** Tied: the bind's tick, the wriggle, and whatever frees it at once. */
  private updateTied(): void {
    this.bind.tick?.(this);
    if (this.removed || this.state !== 'tied') return;
    // A wriggle and a muffled cry now and then (a gag bubble; GDD §7.2 step 1).
    if (this.stateT % WRIGGLE_EVERY === 60 && this.onScreen(0)) {
      // Voiced by the kind's sample when one is loaded (the ams tourist).
      hudOf(this.world).bubble(this, 'MMF!', { ticks: 40, kind: 'gag', speaker: this.kind?.id });
      this.shakeT = WRIGGLE_TICKS;
    }
    if (this.shakeT > 0) this.shakeT--;
    const f = this.bind.frees;
    if (f.touch) {
      const p = this.touchingPlayer();
      if (p) {
        this.facing = p.x < this.x ? -1 : 1;
        this.free(p.index, true);
        return;
      }
    }
    if (f.shot) {
      const box = this.hitRect();
      const shots = this.world.byTag('shot');
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i] as Entity & { damage?: Damage };
        if (!s.alive || s.team !== 'player') continue;
        if (overlaps(box, s.hitRect())) {
          this.free(s.damage?.owner ?? -1);
          return;
        }
      }
    }
  }

  /** A player on foot (in play) touching it. */
  touchingPlayer(): Player | null {
    const box = this.hitRect();
    const list = this.world.byTag('player');
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (isPlayer(p) && p.state === 'play' && overlaps(box, p.hitRect())) return p;
    }
    return null;
  }

  /** The player to walk to: the rescuer while alive, else the nearest living player. */
  walkTarget(): Player | null {
    const list = this.world.byTag('player');
    let best: Player | null = null;
    let bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isPlayer(p) || !p.alive || (p.state !== 'play' && p.state !== 'mounted')) continue;
      if (p.index === this.rescuer) return p;
      const d = Math.abs(p.x - this.x) + Math.abs(p.y - this.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** Walk to the player (GDD §7.2 step 3); arrives when in reach, after 180 ticks, or when blocked. */
  private walkToRescuer(): void {
    const H = TUNING.hostage;
    const touch = this.touchingPlayer();
    if (touch) return this.arrive(touch);
    const t = this.walkTarget();
    if (!t || this.stateT >= H.walkTicks) return this.arrive(t);
    const dx = t.x - this.x;
    if (Math.abs(dx) <= H.reach) return this.arrive(t);
    const dir: 1 | -1 = dx < 0 ? -1 : 1;
    this.facing = dir;
    if (!this.canStep(dir) || (this.body?.contact.hitWall && this.stateT > 1)) return this.arrive(t);
    this.vx = dir * H.walkSpeed;
  }

  /** Floor ahead (no gap, no drop deeper than a step, no hazard): safe to walk on. */
  canStep(dir: 1 | -1): boolean {
    return safeStep(this.world, this.x, this.y, dir, 8);
  }

  /** At the player (or as close as it gets): the kind's gag, then the gift. */
  private arrive(p: Player | null): void {
    if (p) {
      if (this.rescuer < 0) this.rescuer = p.index;
      this.facing = p.x < this.x ? -1 : 1;
    }
    this.vx = 0;
    if ((this.kind?.gagTicks ?? 0) > 0) {
      this.gagValue = 0;
      this.setState('gag');
    } else this.startGive();
  }

  private startGive(): void {
    const p = this.walkTarget();
    if (p) this.facing = p.x < this.x ? -1 : 1;
    this.vx = 0;
    this.setState('give');
  }

  /** Off to the left (GDD §7.2 step 5); right when the left is blocked. */
  private startRun(): void {
    this.facing = this.canStep(-1) ? -1 : 1;
    this.turned = false;
    this.fadeT = 0;
    this.setState('run');
  }

  private updateRun(): void {
    if (!this.canStep(this.facing)) {
      // Blocked right at the view edge it is leaving by (the level's left wall): it ducks out
      // there (fades) instead of turning back across the whole screen.
      const cam = this.world.camera;
      const edgeDist = this.facing < 0 ? this.x - cam.left : cam.right - this.x;
      if (edgeDist < RUN_EDGE_EXIT) this.turned = true;
      if (!this.turned) {
        this.turned = true;
        this.facing = this.facing > 0 ? -1 : 1;
      } else this.vx = 0;
    }
    if (this.canStep(this.facing)) this.vx = this.facing * TUNING.hostage.runSpeed;
    else this.vx = 0;
    // Gone once off-screen; a hostage that cannot leave fades out after a while.
    if (this.vx === 0) this.fadeT++;
    if ((!this.onScreen(32) && this.stateT > 30) || this.fadeT > RUN_FADE_TICKS) this.remove();
  }

  // ------------------------------------------------------------------------------- the gift

  /**
   * Hand the gift over (once): it appears at the hand point of the current frame (or the kind's
   * `giftAt`, or `at`) and pops up (vy −2.0), or is thrown at `toss` (a parachuting hostage).
   * Items pop; other entities (Mrs. Dollop's van) are just placed. Returns the entity.
   */
  handOver(at?: { x: number; y: number } | null, toss?: Player | null): Entity | null {
    if (this.given) return null;
    this.given = true;
    if (!this.rescued && this.rescuer >= 0) this.countRescue(this.rescuer);
    const to = toss ?? this.walkTarget();
    let spec = this.item;
    if (spec && this.bind.gift) spec = this.bind.gift(this, spec, to);
    let e: Entity | null = null;
    if (spec) {
      const pos = at ?? this.kind?.giftAt?.(this) ?? this.handPoint();
      const isItem = (getEntityMeta(spec.id)?.category ?? 'item') === 'item';
      e = this.world.spawn(spec.id, pos.x, pos.y, isItem ? { dropped: true, ...spec.params } : (spec.params ?? NO_PARAMS));
      if (isItem) {
        e.vx = this.facing * 0.6;
        e.vy = ITEM_RULES.popVy;
        if (toss && e instanceof Pickup) e.tossTo(toss);
      }
      this.world.audio.sfx('hostage/give');
    }
    this.kind?.gave?.(this, e);
    this.world.events.emit('hostageGift', { hostage: this, slot: to?.index ?? this.rescuer, item: e });
    return e;
  }

  /** World position of the 'hand' point of the current frame (a little in front when missing). */
  handPoint(): { x: number; y: number } {
    const f = this.anim.id ? getFrame(this.anim.id, this.anim.index) : null;
    const h = f ? framePoint(f, 'hand', this.facing < 0, false, hand) : undefined;
    return { x: this.x + (h ? h[0] : this.facing * 10), y: this.y + (h ? Math.min(-2, h[1]) : -12) };
  }

  // ------------------------------------------------------------------------------- drawing

  /**
   * Frame index to draw: the tied strip shows rest / blink / struggle (bind `struggle`); the
   * kind may pick the gag frames itself.
   */
  frameToDraw(): number {
    if (this.state === 'tied' && this.bind.struggle && frameCount(this.anim.id) >= 3) {
      if (this.shakeT > 0) return 2;
      return this.stateT % 150 < 7 ? 1 : 0;
    }
    if (this.state === 'gag' && this.kind?.gagFrame) {
      const n = frameCount(this.anim.id);
      return n > 0 ? Math.min(n - 1, Math.max(0, this.kind.gagFrame(this, this.stateT - 1))) : 0;
    }
    return this.anim.index;
  }

  /** A named point of the frame being drawn, in world space (null when the frame has none). */
  pointOf(name: string, out: { x: number; y: number }): { x: number; y: number } | null {
    const f = this.anim.id ? getFrame(this.anim.id, this.frameToDraw()) : null;
    const p = f ? framePoint(f, name, this.facing < 0, false, hand) : undefined;
    if (!p) return null;
    out.x = this.x + this.offX + p[0];
    out.y = this.y + this.offY + p[1];
    return out;
  }

  override draw(r: Renderer): void {
    if (this.state === 'run' && this.fadeT > 0 && this.fadeT % 4 < 2) return; // fading out
    this.bind.drawBack?.(this, r);
    drawOpts.flipX = this.facing < 0;
    const shake = this.shakeT > 0 ? (this.shakeT % 2 === 0 ? 1 : -1) : 0;
    r.sprite(this.anim.id, this.frameToDraw(), this.x + this.offX + shake, this.y + this.offY, drawOpts);
    this.bind.drawFront?.(this, r);
    this.kind?.drawFront?.(this, r);
  }

  override onRemove(): void {
    this.bind.detach?.(this);
    hudOf(this.world).clearBubble(this);
  }

  /** Fell out of the world (a cage over a pit): the rescuer still gets the gift. */
  override onOutOfWorld(): void {
    if (this.rescued && !this.given) {
      const p = this.walkTarget();
      if (p) this.handOver({ x: p.x, y: p.y - 24 });
    }
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Bind targets (ropes)
// ---------------------------------------------------------------------------------------------

/**
 * A shootable part of a bind — a rope with its own HP (GDD §7.2: cage rope 10, float ropes
 * 10 each, balloon rope 10). Team 'enemy' so player shots, blasts (and, when `soft`, the knife)
 * hit it, but it is not an enemy: no 'enemy' tag, so it never counts as a kill or holds a wave.
 * It follows its hostage (box relative to the hostage's anchor) and tells it when it breaks.
 * The bind draws the rope itself.
 */
export class BindTarget extends Entity {
  readonly host: Hostage;
  readonly part: string;

  constructor(host: Hostage, part: string, box: Rect, hp = 10, soft = false) {
    super(host.world, host.x, host.y);
    this.host = host;
    this.part = part;
    this.type = 'hostage-rope';
    this.team = 'enemy';
    this.hp = this.maxHp = hp;
    this.z = host.z + 1;
    this.despawnMargin = Infinity;
    this.hitbox = { x: box.x, y: box.y, w: box.w, h: box.h };
    this.addTag('shootable');
    if (soft) this.addTag('soft');
  }

  /** Move the box (relative to the hostage's anchor), e.g. when a rope gets shorter. */
  setBox(box: Rect): void {
    this.hitbox.x = box.x;
    this.hitbox.y = box.y;
    this.hitbox.w = box.w;
    this.hitbox.h = box.h;
  }

  override update(): void {
    if (this.host.removed) {
      this.remove();
      return;
    }
    this.x = this.host.x;
    this.y = this.host.y;
  }

  override onHit(d: Damage): boolean {
    if (this.dead || this.removed) return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    if (this.hp <= 0) {
      this.dead = true;
      this.remove();
      this.host.partBroken(this.part, d.owner ?? -1);
    }
    return true;
  }

  override onCrushed(): void {}

  override draw(): void {}
}
