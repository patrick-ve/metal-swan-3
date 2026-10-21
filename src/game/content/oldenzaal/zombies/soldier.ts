/**
 * Mission oldenzaal — the dead soldiers (revision 2, docs/design/oldenzaal.md §3; docs/api/oldenzaal.md
 * "ZOMBIES"). Owner: ZOMBIES. The contract is api.ts (`Zombie`, the tell rules); this is what is
 * behind it.
 *
 * Tanks (R2-1): slow, many hits, a heavy stagger only on big hits (a grenade, the frikandel
 * explosion, the knife, a shotgun blast; never twice in a row: `STAGGER.immune`). They never run.
 * - grunt: shambles in, winds the trench shovel (or the rifle swung by its barrel) back over the
 *   shoulder (the tell, ≥ 18 ticks on screen), swings (the box is live only in the swing).
 * - rifleman: stops at range on screen, raises the rifle (a long tell), fires ONE slow, glowing
 *   shot at chest height (a crouch ducks it, a jump clears it; aimed only at a hero on another
 *   level), works the bolt (a slow reload).
 * - gunner (the MG): walks to a spot on screen, kneels and plants the bipod, lowers the barrel on
 *   the target (the tell), fires a short sweep from the chest down to the knees (a timely jump
 *   clears it), cools down; gets up and moves when the target leaves his arc. His helmet flies
 *   off at 60 % HP and his barrel jacket is shot off at 30 % (cosmetic).
 * - crawler: legless, drags itself along; rears up (the tell), grabs a hero's feet: the hero is
 *   held (`oz-grabbed`: no running, no jumping; shooting works); tapping JUMP / a direction 4
 *   times or any hit on the crawler breaks the hold; at its end (a visible bite tell) it bites.
 * Entrances (api.ts): walk, rise (cracks spread, it climbs out), burst (a boarded door / window
 * bursts), manhole (the cover slides away), march (a column in step in the fog).
 * The continue: gloat — they stop, sway and groan, the gunner pats his gun, the crawler lies still
 * (no pointing, no laughing); cower — they flinch and step back.
 * Death: bloodless; the zombie is gone at once and an `oz-bones` fx shows it sag and collapse into
 * bones and dust (the helmet rolls away).
 */
import { HIT_FLASH_TICKS, type Damage, type Entity } from '../../../../engine/entity';
import { rectAt, strideRate, type Rect } from '../../../../engine/math';
import type { ParticlePreset } from '../../../../engine/particles';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { getFrame } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { debris, dust } from '../../../fx';
import { isPlayer, type Player } from '../../../player/player';
import { paramNum, paramStr, type SpawnParams } from '../../../registry';
import type { ReactionKind } from '../../../enemy';
import { Creature, contactHit, held } from '../../creatures/common';
import { OZ_ZOMBIES, OZ_ZOMBIE_TAG } from '../../missions/oldenzaal/ids';
import {
  ENTRANCE,
  ENTRANCE_KINDS,
  MARCH,
  ZOMBIE_STAGGER,
  heroNear,
  isOpening,
  type EntranceKind,
  type RiseSurface,
  type Zombie,
  type ZombieBlastCause,
  type ZombieKind,
  type ZombieOpeningEntity,
} from './api';
import { KIT_PREFIX, ZTABLE, ZTIMING, type ZFrameInfo } from './art';
import { HEAD_BARE, HEAD_TILTS, HEADS, eyeAt, headId, type HeadName } from './art-head';
import { CHUNK_FRAMES, CHUNK_ID, EYE_ID, GUN_ANGLES, MG_GUN, MG_MUZZLE, SHOT_ID, gunAngleIndex, mgGunFrame, type RiseLook } from './art-gear';
import { grab as grabHero, release as releaseHero } from './grab';
import { CLAMBER, COLLAPSE, CRAWLER, ENTRY, GRUNT, GUNNER, HIT_FX, RIFLEMAN, STAGGER } from './numbers';

const NO_BOXES: readonly Rect[] = [];

/** The sfx of the dead (sfx/oldenzaal-zombies.ts). */
export const ZSFX = {
  groan: 'oz/zombie/groan',
  growl: 'oz/zombie/growl',
  drag: 'oz/zombie/drag',
  swingTell: 'oz/zombie/swing-tell',
  swing: 'oz/zombie/swing',
  rifleTell: 'oz/zombie/rifle-tell',
  rifle: 'oz/zombie/rifle',
  bolt: 'oz/zombie/bolt',
  mgPlant: 'oz/zombie/mg-plant',
  mgTell: 'oz/zombie/mg-tell',
  mg: 'oz/zombie/mg',
  grabTell: 'oz/zombie/grab-tell',
  grab: 'oz/zombie/grab',
  bite: 'oz/zombie/bite',
  letGo: 'oz/zombie/let-go',
  hit: 'oz/zombie/hit',
  helmet: 'oz/zombie/helmet',
  barrel: 'oz/zombie/barrel',
  collapse: 'oz/zombie/collapse',
  ground: 'oz/zombie/ground',
  burst: 'oz/zombie/burst',
  manhole: 'oz/zombie/manhole',
  flinch: 'oz/zombie/flinch',
} as const;

/** The look of one zombie: its body set and its head. */
interface Look {
  art: string;
  head: HeadName;
}

const GRUNT_HEADS: readonly HeadName[] = ['helm-a', 'helm-b', 'cap-a', 'helm-a', 'bare-a', 'helm-b'];
const RIFLE_HEADS: readonly HeadName[] = ['helm-a', 'cap-a', 'helm-b', 'helm-a'];
const MG_HEADS: readonly HeadName[] = ['helm-a', 'helm-b'];
const CRAWL_HEADS: readonly HeadName[] = ['bare-b', 'bare-a', 'helm-a', 'bare-b'];

/** A deterministic pick (no gameplay rng): the entity id and the spawn x. */
function pick<T>(list: readonly T[], id: number, x: number, salt: number): T {
  const h = Math.imul((id + 1) * 2654435761 + Math.round(x) * 40503 + salt * 977, 2246822519) >>> 0;
  return list[(h >>> 7) % list.length];
}

function lookOf(kind: ZombieKind, id: number, x: number, p: SpawnParams): Look {
  const head = paramStr(p, 'head', '') as HeadName;
  const set = paramStr(p, 'set', '');
  const okHead = (n: string): n is HeadName => n in HEADS;
  switch (kind) {
    case 'grunt': {
      const coat = set ? set === 'coat' : pick([false, true, false], id, x, 1);
      return { art: (coat ? KIT_PREFIX.gruntCoat : KIT_PREFIX.gruntTunic).slice(0, -1), head: okHead(head) ? head : pick(GRUNT_HEADS, id, x, 2) };
    }
    case 'rifleman':
      return { art: KIT_PREFIX.rifleman.slice(0, -1), head: okHead(head) ? head : pick(RIFLE_HEADS, id, x, 3) };
    case 'gunner':
      return { art: KIT_PREFIX.gunner.slice(0, -1), head: okHead(head) ? head : pick(MG_HEADS, id, x, 4) };
    case 'crawler':
      return { art: KIT_PREFIX.crawler.slice(0, -1), head: okHead(head) ? head : pick(CRAWL_HEADS, id, x, 5) };
  }
}

type Phase = 'wait' | 'tell' | 'climb' | 'out' | 'march' | 'done';

/** Chunks of rot and cloth knocked off by a hit (cosmetic). */
const CHUNKS: ParticlePreset = {
  kind: 'sprite',
  sprite: CHUNK_ID,
  randomFrames: CHUNK_FRAMES,
  life: [24, 44],
  gravity: 0.18,
  drag: 0.97,
  ground: 'bounce',
  bounce: 0.25,
  friction: 0.6,
  fadeFrom: 0.7,
  randomFlip: true,
};

const blastHit: Damage = { amount: 0, kind: 'explosion', dirX: 1 };
const headOpts: DrawOpts = {};
const gunOpts: DrawOpts = {};
const eyeOpts: DrawOpts = { blend: 'add', alpha: 0.5 };
const clipRect = { x: 0, y: 0, w: 0, h: 0 };
const muzzle: [number, number] = [0, 0];

export class DeadSoldier extends Creature implements Zombie {
  readonly zombieKind: ZombieKind;
  /** The head on the body (`enemy/oz-grunt/head/<name>`); it goes bare when the helmet flies. */
  head: HeadName;
  /** The MG's barrel jacket was shot off (cosmetic). */
  gunBroken = false;
  // the entrance
  private readonly entrance: EntranceKind;
  private readonly opening: ZombieOpeningEntity | null;
  /** The hero stood on the opening's spot too long: he comes out beside it (`ENTRY.maxWait`). */
  private beside = false;
  /** In the air of a clamber over a low wall (`walkOn`). */
  private clambering = false;
  private readonly surface: RiseSurface;
  private readonly slot: number;
  private readonly breakAt: number;
  private phase: Phase;
  private phaseT = 0;
  private waitLeft: number;
  private riseFx: (Entity & { open(): void }) | null = null;
  // the fight
  private graceLeft = 0;
  private staggerLeft = 0;
  private immune = 0;
  private cool: number;
  private telegraph = 18;
  private shots = 0;
  private aim0 = 0;
  private aim1 = 0;
  /** The MG's drawn angle while it aims and fires (deg; NaN = the strip's own). */
  private gunDeg = NaN;
  private planted = false;
  private outOfArc = 0;
  private readonly hold: number;
  private readonly hit: Damage;
  private readonly boxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  // the crawler's hold
  private victim: Player | null = null;
  private taps = 0;
  private groanIn: number;

  constructor(world: World, x: number, y: number, p: SpawnParams, kind: ZombieKind) {
    const n = kind === 'grunt' ? GRUNT : kind === 'rifleman' ? RIFLEMAN : kind === 'gunner' ? GUNNER : CRAWLER;
    super(world, x, y, p, { art: KIT_PREFIX.gruntTunic.slice(0, -1), hp: n.hp, score: n.score, w: n.w, h: n.h, big: kind === 'gunner' });
    const look = lookOf(kind, this.id, x, p);
    this.art = look.art;
    this.zombieKind = kind;
    this.head = look.head;
    this.addTag(OZ_ZOMBIE_TAG);
    this.alerted = true;
    this.hit = contactHit(this, 'bullet');
    this.hold = paramNum(p, 'hold', kind === 'rifleman' ? RIFLEMAN.hold : GUNNER.hold);
    this.cool = 20 + ((x | 0) % 30);
    this.groanIn = 90 + ((x * 7) | 0) % 240;
    const ent = paramStr(p, 'entrance', 'walk') as EntranceKind;
    this.entrance = ENTRANCE_KINDS.includes(ent) ? ent : 'walk';
    const target = p.target as ZombieOpeningEntity | undefined;
    this.opening = isOpening(target) ? target : null;
    this.surface = paramStr(p, 'surface', 'pavers') as RiseSurface;
    this.slot = paramNum(p, 'slot', 0);
    this.breakAt = paramNum(p, 'breakAt', MARCH.breakAt);
    this.waitLeft = paramNum(p, 'delay', 0);
    if (typeof p.facing === 'number') this.facing = p.facing < 0 ? -1 : 1;
    else if (this.opening && this.opening.outDir !== 0) this.facing = this.opening.outDir;
    else this.facePlayer();
    if (this.entrance === 'walk') this.phase = 'done';
    else if (this.entrance === 'march') this.phase = 'march';
    else {
      this.phase = 'wait';
      if (this.opening) this.opening.busy = true;
    }
    // The crawler has no idle strip (INTEGRATE: a hidden crawler in its entrance looked one up).
    this.play(this.phase === 'done' || this.phase === 'march' || this.zombieKind === 'crawler' ? this.walkAnim : 'idle');
  }

  private get walkAnim(): string {
    return this.zombieKind === 'crawler' ? 'drag' : 'walk';
  }

  // ------------------------------------------------------------------------------- the contract

  get entering(): boolean {
    return this.phase !== 'done';
  }

  /** Under the ground / cover or behind the boards: no hurt boxes, not drawn. */
  get hidden(): boolean {
    return this.phase === 'wait' || this.phase === 'tell';
  }

  stagger(ticks: number, dirX: number): void {
    if (!this.alive || this.hidden) return;
    if (this.staggerLeft <= 0 && this.immune > 0) return;
    this.cancelAttack();
    this.letGo();
    if (this.phase === 'march') this.setPhase('done');
    this.staggerLeft = Math.max(this.staggerLeft, ticks);
    this.immune = 0;
    this.vx = (dirX < 0 ? -1 : 1) * 0.6;
    if (this.planted && this.zombieKind === 'gunner') this.vx = 0;
    this.play('stagger', { restart: true, loop: false });
  }

  blast(cause: ZombieBlastCause): boolean {
    if (!this.alive || this.removed || this.hidden) return false;
    const dirX = this.x < cause.x ? -1 : 1;
    blastHit.amount = cause.damage;
    blastHit.dirX = dirX;
    blastHit.owner = cause.owner;
    blastHit.weapon = cause.weapon;
    this.world.damage(this, blastHit);
    blastHit.weapon = undefined;
    if (this.alive) {
      this.immune = 0;
      this.stagger(cause.stagger ?? ZOMBIE_STAGGER, dirX);
    }
    return true;
  }

  // ------------------------------------------------------------------------------- hits, death

  override hurtboxes(): readonly Rect[] {
    return this.hidden ? NO_BOXES : super.hurtboxes();
  }

  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage || this.hidden) return NO_BOXES;
    rectAt(this.x, this.y, GRUNT.swingBox, this.facing < 0, this.boxes[0]);
    return this.boxes;
  }

  override onHit(d: Damage, part = 0): boolean {
    if (this.hidden) return false;
    const hit = super.onHit(d, part);
    if (!hit) return hit;
    const w = this.world;
    // A hit on the crawler breaks its hold (spec: "or a small hit").
    if (this.victim) {
      this.letGo();
      this.cancelAttack();
      this.staggerLeft = Math.max(this.staggerLeft, 12);
      this.vx = -this.facing * 0.5;
    }
    if (!this.alive) return hit;
    if (this.phase === 'march') this.setPhase('done');
    const cy = this.y + this.hitbox.y * 0.5;
    if (w.fxRng.chance(HIT_FX.dust)) dust(w, this.x - this.facing * 2, cy, 1);
    if (w.fxRng.chance(HIT_FX.chunk)) w.particles.burst(CHUNKS, this.x, cy, 1 + w.fxRng.int(0, 1), 0.6, 1.8, -Math.PI / 2 - (d.dirX || 0) * 0.6, 1.6);
    if (w.fxRng.chance(0.35)) w.audio.sfx(ZSFX.hit, { vol: 0.5 });
    const frac = this.hp / Math.max(1, this.maxHp);
    // Cosmetic damage: the helmet flies off; the MG's barrel jacket is shot off.
    if (this.head !== HEAD_BARE[this.head]) {
      const at = this.zombieKind === 'gunner' ? frac <= GUNNER.helmetAt : frac < HIT_FX.helmetBelow && w.fxRng.chance(HIT_FX.helmet);
      if (at) this.loseHelmet(d.dirX || -this.facing);
    }
    if (this.zombieKind === 'gunner' && !this.gunBroken && frac <= GUNNER.barrelAt) {
      this.gunBroken = true;
      debris(w, this.x + this.facing * 18, this.y - 16, 'metal', 5);
      w.audio.sfx(ZSFX.barrel);
    }
    // A heavy stagger only on big hits.
    const big = d.kind === 'explosion' || d.kind === 'knife' || d.amount >= STAGGER.bigHit;
    if (big) this.stagger(d.kind === 'explosion' ? STAGGER.explosion : d.kind === 'knife' ? STAGGER.knife : STAGGER.big, d.dirX || -this.facing);
    return hit;
  }

  /** The helmet (or the cap) flies off: the head goes bare. */
  loseHelmet(dirX: number): void {
    const bare = HEAD_BARE[this.head];
    if (bare === this.head) return;
    const gear = HEADS[this.head].gear;
    const hp = this.headPoint();
    this.world.spawn(OZ_ZOMBIES.helmet, hp[0], hp[1] - 4, { gear, vx: (dirX < 0 ? -1 : 1) * 1.2, vy: -2.4, flip: this.facing < 0 });
    this.world.audio.sfx(ZSFX.helmet, { vol: 0.7 });
    this.head = bare;
  }

  /** Bloodless (spec R2-3): gone at once; the `oz-bones` fx sags and collapses into bones and dust. */
  protected override onDeath(d: Damage): void {
    this.releaseToken();
    this.letGo();
    this.contactDamage = null;
    if (this.opening) this.opening.busy = false;
    const w = this.world;
    w.spawn(OZ_ZOMBIES.bones, this.x, this.y, {
      art: this.art,
      head: this.head,
      facing: this.facing,
      kind: this.zombieKind,
      broken: this.gunBroken,
      vx: d.kind === 'explosion' ? (d.dirX || -this.facing) * 1.2 : 0,
    });
    this.remove();
  }

  override onRemove(): void {
    this.letGo();
    this.riseFx = null;
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- the tick

  protected override think(): void {
    this.modeT++;
    this.phaseT++;
    if (this.immune > 0) this.immune--;
    if (this.staggerLeft > 0) {
      if (--this.staggerLeft === 0) this.immune = STAGGER.immune;
      this.vx *= 0.8;
      if (!this.playing('stagger')) this.play('stagger', { restart: true, loop: false });
      return;
    }
    if (this.phase !== 'done') {
      this.thinkEntrance();
      return;
    }
    if (this.graceLeft > 0) this.graceLeft--;
    if (--this.groanIn <= 0) {
      this.groanIn = 240 + this.world.fxRng.int(0, 240);
      if (this.onScreen(-8)) this.world.audio.sfx(this.zombieKind === 'crawler' ? ZSFX.growl : ZSFX.groan, { vol: 0.45 });
    }
    switch (this.zombieKind) {
      case 'grunt':
        return this.thinkGrunt();
      case 'rifleman':
        return this.thinkRifleman();
      case 'gunner':
        return this.thinkGunner();
      case 'crawler':
        return this.thinkCrawler();
    }
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
    if (p === 'done') {
      this.graceLeft = ENTRANCE.grace;
      if (this.opening) this.opening.busy = false;
      this.setMode('walk');
      this.play(this.walkAnim);
    }
  }

  private spotX(): number {
    return this.opening && !this.beside ? this.opening.spotX : this.x;
  }

  private riseLook(): RiseLook {
    if (this.entrance === 'manhole') return 'manhole';
    return this.surface === 'earth' ? 'earth' : this.surface === 'pavers' ? 'pavers' : 'stone';
  }

  private thinkEntrance(): void {
    this.vx = 0;
    const w = this.world;
    switch (this.phase) {
      case 'wait': {
        if (this.waitLeft > 0) {
          this.waitLeft--;
          return;
        }
        // Never on top of a hero: wait until the spot is clear. After `maxWait` a rise moves its
        // spot (and an opening lets him out beside it, away from the hero).
        if (heroNear(w, this.spotX(), this.y) < ENTRANCE.clear) {
          if (this.phaseT < ENTRY.maxWait) return;
          const hx = w.nearestPlayer(this.x, this.y)?.x ?? this.x;
          this.x = this.prevX = this.x + (hx < this.x ? 1 : -1) * (ENTRANCE.clear + 8);
          // Out of an opening: from now on he comes out at his own (moved) x, beside it
          // (INTEGRATE: the check kept testing the opening's spot, so he never came out).
          this.beside = true;
          this.phaseT = 0;
          return;
        }
        const tell = Math.max(ENTRANCE.minTell, this.entrance === 'burst' ? ENTRY.burstTell : this.entrance === 'manhole' ? ENTRY.manholeTell : ENTRY.riseTell);
        if (this.opening) this.opening.tell(tell);
        else if (this.entrance !== 'burst') this.riseFx = w.spawn(OZ_ZOMBIES.rise, this.x, this.y, { look: this.riseLook(), tell }) as Entity & { open(): void };
        this.telegraph = tell;
        this.setPhase('tell');
        w.audio.sfx(this.entrance === 'burst' ? ZSFX.burst : this.entrance === 'manhole' ? ZSFX.manhole : ZSFX.ground, { vol: 0.8 });
        return;
      }
      case 'tell': {
        // Dust and grit over the spot while it cracks / rattles / bangs (cosmetic: fxRng).
        if (this.phaseT % 9 === 1) dust(w, this.spotX() + w.fxRng.range(-6, 6), this.y - (this.entrance === 'burst' ? 14 : 1), 1);
        if (this.phaseT < this.telegraph) return;
        if (this.opening) this.opening.open(this.facing);
        else {
          this.riseFx?.open();
          if (this.entrance === 'burst') {
            dust(w, this.x, this.y - 12, 6);
            debris(w, this.x, this.y - 14, 'wood', 6);
          } else debris(w, this.x, this.y - 2, this.surface === 'earth' ? 'dirt' : 'rock', 6);
        }
        this.groan();
        if (this.entrance === 'burst') {
          this.setPhase('out');
          this.play('stagger', { restart: true, loop: false });
        } else {
          this.setPhase('climb');
          this.play('rise', { restart: true, loop: false });
        }
        return;
      }
      case 'climb':
        if (this.phaseT >= (this.zombieKind === 'crawler' ? 44 : ENTRY.riseClimb) || this.anim.done) this.setPhase('done');
        return;
      case 'out':
        // He staggers out of the doorway (a lurch forward).
        this.vx = (this.phaseT < 10 ? 0.7 : 0.35) * this.facing;
        if (this.phaseT >= 10 && !this.playing(this.walkAnim)) this.play(this.walkAnim);
        if (this.phaseT >= ENTRY.burstOut) this.setPhase('done');
        return;
      case 'march': {
        // In step, no attacks, until the lead nears a hero (each marcher allows for its place).
        if (heroNear(w, this.x, this.y) < this.breakAt + this.slot * MARCH.spacing) {
          this.setPhase('done');
          return;
        }
        this.facePlayer();
        this.vx = this.walkOn(MARCH.speed);
        // All marchers on the same frame of the shamble (one shared clock).
        this.play(this.walkAnim, held());
        this.anim.index = Math.floor(w.tick / 12) % 6;
        return;
      }
      default:
        return;
    }
  }

  private groan(): void {
    this.world.audio.sfx(this.zombieKind === 'crawler' ? ZSFX.growl : ZSFX.groan, { vol: 0.6 });
  }

  /** Walk toward the target (slowly; the animation follows the speed). */
  private shuffle(speed: number): void {
    const vx = this.walkOn(speed);
    if (vx !== 0) {
      this.vx = vx;
      if (!this.playing(this.walkAnim)) this.play(this.walkAnim);
      this.anim.tick += strideRate(this.vx, speed) - 1;
    } else this.stand();
  }

  private stand(): void {
    this.vx = 0;
    if (!this.playing('idle') || this.zombieKind === 'crawler') this.play(this.zombieKind === 'crawler' ? 'drag' : 'idle', this.zombieKind === 'crawler' ? held() : undefined);
  }

  // ------------------------------------------------------------------------------- the grunt

  private thinkGrunt(): void {
    const t = this.target();
    switch (this.mode) {
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!this.onScreen(-8) || !t) return this.cancelAttack();
        this.setMode('strike');
        this.play('strike', { restart: true, loop: false });
        this.world.audio.sfx(ZSFX.swing);
        return;
      case 'strike': {
        const live = this.modeT >= GRUNT.activeFrom && this.modeT < GRUNT.activeFrom + GRUNT.active;
        this.vx = live && this.floorAhead(this.facing) ? GRUNT.lunge * this.facing : 0;
        if (live) {
          this.hit.dirX = this.facing;
          this.contactDamage = this.hit;
        } else this.contactDamage = null;
        if (this.modeT >= GRUNT.strike) {
          this.contactDamage = null;
          this.setMode('recover');
          this.play('recover', { restart: true, loop: false });
        }
        return;
      }
      case 'recover':
        this.vx = 0;
        if (this.modeT >= GRUNT.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(GRUNT.cool, GRUNT.coolJitter);
          this.setMode('walk');
        }
        return;
      default:
        break;
    }
    if (!t) return this.stand();
    this.faceSlowly(t.x);
    const dx = (t.x - this.x) * this.facing;
    if (dx > GRUNT.reach - 6) this.shuffle(GRUNT.walk);
    else this.stand();
    if (this.graceLeft > 0 || --this.cool > 0) return;
    this.cool = 0;
    if (dx > -4 && dx <= GRUNT.reach && Math.abs(t.y - this.y) <= 24 && this.onScreen(-8) && this.takeToken()) {
      this.telegraph = this.tele(GRUNT.tell);
      this.vx = 0;
      this.setMode('tell');
      this.play('tell', { restart: true, loop: false });
      this.world.audio.sfx(ZSFX.swingTell);
    }
  }

  // ------------------------------------------------------------------------------- the rifleman

  private thinkRifleman(): void {
    const t = this.target();
    switch (this.mode) {
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!this.onScreen(-8) || !t) return this.cancelAttack();
        this.fireRifle(t);
        this.setMode('shoot');
        this.play('fire', { restart: true, loop: false });
        return;
      case 'shoot':
        this.vx = 0;
        if (this.modeT >= RIFLEMAN.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(RIFLEMAN.reload, RIFLEMAN.reloadJitter);
          this.setMode('reload');
          this.play('reload');
          this.world.audio.sfx(ZSFX.bolt, { vol: 0.7 });
        }
        return;
      case 'reload':
        this.vx = 0;
        if (--this.cool > 0) return;
        this.cool = 0;
        this.setMode('walk');
        return;
      default:
        break;
    }
    if (!t) return this.stand();
    this.faceSlowly(t.x);
    const dist = Math.abs(t.x - this.x);
    // He walks until he holds at his range, and never holds outside the view.
    const far = dist > this.hold || !this.onScreen(-12);
    if (far && Math.sign(t.x - this.x) === this.facing) return this.shuffle(RIFLEMAN.walk);
    this.stand();
    if (this.graceLeft > 0 || --this.cool > 0) return;
    this.cool = 0;
    if (dist <= RIFLEMAN.range && Math.sign(t.x - this.x) === this.facing && this.onScreen(-8) && this.takeToken()) {
      this.telegraph = this.tele(RIFLEMAN.tell);
      this.setMode('tell');
      this.play('aim', { restart: true, loop: false });
      this.world.audio.sfx(ZSFX.rifleTell);
    } else this.cool = 12;
  }

  private fireRifle(t: Entity): void {
    const m = this.point('muzzle', 14, -RIFLEMAN.shotY, muzzle);
    const level = Math.abs(t.y - this.y) <= RIFLEMAN.levelDy;
    const y = level ? this.y - RIFLEMAN.shotY : m[1];
    const angle = level ? (this.facing > 0 ? 0 : Math.PI) : this.aimAt(m[0], y, t);
    this.shoot({ speed: RIFLEMAN.shotSpeed, damage: RIFLEMAN.shotDamage, sprite: SHOT_ID.rifle, look: 'anim', angle, x: m[0], y, w: 8, h: 3, life: 320 });
    this.world.audio.sfx(ZSFX.rifle);
    this.world.particles.burst(SMOKE, m[0], y, 3, 0.1, 0.5);
  }

  // ------------------------------------------------------------------------------- the gunner

  private thinkGunner(): void {
    const t = this.target();
    switch (this.mode) {
      case 'plant':
        this.vx = 0;
        if (this.modeT >= GUNNER.plant) {
          this.planted = true;
          this.setHitbox(GUNNER.kneelH);
          this.setMode('planted');
          this.play('cool');
        }
        return;
      case 'getup':
        this.vx = 0;
        if (this.modeT >= GUNNER.getup) {
          this.planted = false;
          this.setHitbox(GUNNER.h);
          this.setMode('walk');
        }
        return;
      case 'tell':
        this.vx = 0;
        if (t) this.gunDeg = this.degTo(t, -14);
        if (this.modeT < this.telegraph) return;
        if (!this.onScreen(-8) || !t) return this.cancelAttack();
        // The sweep: from the chest down to the knees at the target (a timely jump clears it).
        this.aim0 = this.angleTo(t, -26);
        this.aim1 = this.angleTo(t, -4);
        this.shots = 0;
        this.setMode('shoot');
        this.play('fire');
        return;
      case 'shoot': {
        this.vx = 0;
        if (this.shots < GUNNER.burst && this.modeT % GUNNER.every === 1) {
          const k = this.shots / Math.max(1, GUNNER.burst - 1);
          const a = this.aim0 + (this.aim1 - this.aim0) * k;
          this.gunDeg = this.facing > 0 ? (a * 180) / Math.PI : 180 - (a * 180) / Math.PI;
          const m = this.muzzlePoint();
          this.shoot({ speed: GUNNER.shotSpeed, damage: GUNNER.shotDamage, sprite: SHOT_ID.mg, look: 'anim', angle: a, x: m[0], y: m[1], w: 6, h: 2, life: 260 });
          this.world.audio.sfx(ZSFX.mg, { vol: 0.8 });
          if (this.shots % 2 === 0) this.world.particles.burst(SMOKE, m[0], m[1], 2, 0.1, 0.4);
          this.shots++;
        }
        if (this.shots >= GUNNER.burst && this.modeT > GUNNER.burst * GUNNER.every + 4) {
          this.setMode('recover');
          this.play('cool');
        }
        return;
      }
      case 'recover':
        this.vx = 0;
        if (this.modeT >= 24) {
          this.gunDeg = NaN;
          this.releaseToken();
          this.cool = this.fireInterval(GUNNER.cool, GUNNER.coolJitter);
          this.setMode('planted');
        }
        return;
      case 'planted': {
        this.vx = 0;
        if (!this.playing('cool')) this.play('cool');
        const inArc = !!t && Math.sign(t.x - this.x) === this.facing && Math.abs(t.x - this.x) <= GUNNER.range;
        this.outOfArc = inArc ? 0 : this.outOfArc + 1;
        if (this.outOfArc >= GUNNER.relocateAfter) {
          this.outOfArc = 0;
          this.setMode('getup');
          this.play('getup', { restart: true, loop: false });
          return;
        }
        if (!t || --this.cool > 0) return;
        this.cool = 0;
        if (inArc && this.onScreen(-8) && this.takeToken()) {
          this.telegraph = this.tele(GUNNER.tell);
          this.setMode('tell');
          this.play('aim');
          this.world.audio.sfx(ZSFX.mgTell);
        } else this.cool = 12;
        return;
      }
      default:
        break;
    }
    if (!t) return this.stand();
    this.faceSlowly(t.x);
    const dist = Math.abs(t.x - this.x);
    const far = dist > this.hold || !this.onScreen(-24);
    if (far && Math.sign(t.x - this.x) === this.facing) return this.shuffle(GUNNER.walk);
    this.stand();
    if (this.graceLeft > 0) return;
    if (Math.sign(t.x - this.x) === this.facing && this.onScreen(-24)) {
      this.setMode('plant');
      this.play('plant', { restart: true, loop: false });
      this.world.audio.sfx(ZSFX.mgPlant);
    }
  }

  private setHitbox(h: number): void {
    const w = this.hitbox.w;
    this.hitbox = { x: -w / 2, y: -h, w, h };
  }

  /** The angle (rad) from the muzzle to the target's feet + dy. */
  private angleTo(t: Entity, dy: number): number {
    const m = this.muzzlePoint();
    return Math.atan2(t.y + dy - m[1], t.x - m[0]);
  }

  /** The MG's drawn angle (deg, facing-relative, clockwise = down) toward the target's feet + dy. */
  private degTo(t: Entity, dy: number): number {
    const a = this.angleTo(t, dy);
    const deg = (a * 180) / Math.PI;
    return Math.max(-16, Math.min(16, this.facing > 0 ? deg : 180 - (deg < 0 ? deg + 360 : deg)));
  }

  /** The gun's frame info now (the strip's), or null. */
  private gunInfo(): ZFrameInfo['gun'] {
    const id = this.anim.id;
    if (!id) return null;
    return ZTABLE.get(id)?.[this.anim.index]?.gun ?? null;
  }

  /** World position of the MG's muzzle (the strip's pivot + the drawn angle). */
  muzzlePoint(out: [number, number] = muzzle): [number, number] {
    const g = this.gunInfo();
    const gx = g ? g.x : 5;
    const gy = g ? g.y : -GUNNER.shotY;
    const deg = Number.isFinite(this.gunDeg) ? this.gunDeg : g ? GUN_ANGLES[g.a] : 0;
    const [mx, my] = MG_MUZZLE[this.gunBroken ? 'broken' : 'whole'];
    const r = (deg * Math.PI) / 180;
    const lx = gx + mx * Math.cos(r) - my * Math.sin(r);
    const ly = gy + mx * Math.sin(r) + my * Math.cos(r);
    out[0] = this.x + lx * this.facing;
    out[1] = this.y + ly;
    return out;
  }

  // ------------------------------------------------------------------------------- the crawler

  private thinkCrawler(): void {
    const t = this.target();
    switch (this.mode) {
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!this.onScreen(-8) || !t) return this.cancelAttack();
        this.setMode('grab');
        this.play('grab', { restart: true, loop: false });
        this.world.audio.sfx(ZSFX.grab);
        return;
      case 'grab': {
        const live = this.modeT <= CRAWLER.active;
        this.vx = live && this.floorAhead(this.facing) ? 0.9 * this.facing : 0;
        if (live) {
          const p = this.feetInReach();
          if (p && grabHero(p, this)) {
            this.victim = p;
            this.taps = 0;
            this.vx = 0;
            this.setMode('hold');
            this.play('hold');
            hudOf(this.world).pointer(p, 'TAP JUMP!', { ticks: CRAWLER.hold });
            return;
          }
        }
        if (this.modeT >= CRAWLER.grab) {
          this.setMode('recover');
          this.play('recover', { restart: true, loop: false });
        }
        return;
      }
      case 'hold': {
        this.vx = 0;
        const p = this.victim;
        if (!p || !p.alive || p.removed || p.state === 'dead' || p.state === 'out') {
          this.letGo();
          this.setMode('recover');
          return;
        }
        // Tapping breaks it (JUMP or a direction); the shots of either hero break it too (onHit).
        const pad = p.pad;
        if (pad.pressed('jump') || pad.pressed('left') || pad.pressed('right')) this.taps++;
        if (this.taps >= CRAWLER.taps) {
          this.letGo();
          this.world.audio.sfx(ZSFX.letGo);
          this.stagger(CRAWLER.letGo, -this.facing);
          return;
        }
        if (this.modeT === CRAWLER.hold - CRAWLER.biteTell) {
          this.play('bite', { restart: true, loop: false });
          this.world.audio.sfx(ZSFX.grabTell);
        }
        if (this.modeT >= CRAWLER.hold) {
          // The bite (the hero saw it coming the whole hold).
          if (this.onScreen(-8)) {
            this.hit.dirX = this.facing;
            this.world.damage(p, this.hit);
            this.world.audio.sfx(ZSFX.bite);
          }
          this.letGo();
          this.setMode('recover');
          this.play('recover', { restart: true, loop: false });
        }
        return;
      }
      case 'recover':
        this.vx = 0;
        if (this.modeT >= CRAWLER.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(CRAWLER.cool, CRAWLER.coolJitter);
          this.setMode('walk');
        }
        return;
      default:
        break;
    }
    if (!t) {
      this.vx = 0;
      this.play('drag', held());
      return;
    }
    this.faceSlowly(t.x);
    const dx = (t.x - this.x) * this.facing;
    if (dx > CRAWLER.reach - 6) {
      // The drag comes in pulls: each reach of an arm hauls the body on (no glide).
      const pull = (this.age % 60) / 60;
      const speed = CRAWLER.walk * (0.4 + 1.2 * Math.max(0, Math.sin(pull * Math.PI * 2)));
      const vx = this.walkOn(speed);
      if (vx !== 0) {
        this.vx = vx;
        if (!this.playing('drag')) this.play('drag');
        if (this.age % 30 === 0 && this.onScreen(0)) this.world.audio.sfx(ZSFX.drag, { vol: 0.4 });
      } else this.vx = 0;
    } else this.vx = 0;
    if (this.graceLeft > 0 || --this.cool > 0) return;
    this.cool = 0;
    if (dx > -4 && dx <= CRAWLER.reach + 4 && Math.abs(t.y - this.y) <= 12 && this.onScreen(-8) && this.takeToken()) {
      this.telegraph = this.tele(CRAWLER.tell);
      this.vx = 0;
      this.setMode('tell');
      this.play('tell', { restart: true, loop: false });
      this.world.audio.sfx(ZSFX.grabTell);
    }
  }

  /** A hero standing (on the floor) with the feet inside the grab box, or null. */
  private feetInReach(): Player | null {
    const box = rectAt(this.x, this.y, CRAWLER.grabBox, this.facing < 0, this.boxes[0]);
    const list = this.world.byTag('player');
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isPlayer(p) || !p.alive || p.state !== 'play') continue;
      const feetY = p.y;
      const r = p.hitRect();
      if (feetY < box.y || feetY - 10 > box.y + box.h) continue;
      if (r.x < box.x + box.w && r.x + r.w > box.x) return p;
    }
    return null;
  }

  /** Let go of the held hero (any reason). */
  private letGo(): void {
    const p = this.victim;
    if (!p) return;
    this.victim = null;
    releaseHero(p, this);
    hudOf(this.world).clearPointer(p);
  }

  /** The hero this crawler holds (null = none). */
  get holding(): Player | null {
    return this.victim;
  }

  // ------------------------------------------------------------------------------- reactions

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    this.letGo();
    this.gunDeg = NaN;
    if (this.mode === 'tell' || this.mode === 'strike' || this.mode === 'shoot' || this.mode === 'recover' || this.mode === 'grab' || this.mode === 'hold') {
      this.cool = 30;
      this.setMode(this.planted ? 'planted' : 'walk');
    }
  }

  protected override thinkGloat(spot: Entity | null, t: number): void {
    // They stop, sway and groan; the gunner pats his gun; the crawler lies still. No pointing, no laugh.
    this.vx = 0;
    this.faceSpot(spot);
    if (this.planted) this.play('cool');
    else this.play('gloat');
    if (t === 20 + (this.id % 5) * 9) this.groan();
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'cower') {
      // A flinch and a step back from the hero who came back.
      this.faceSpot(this.reactionSource);
      this.vx = !this.planted && this.zombieKind !== 'crawler' && this.floorAhead(-this.facing) ? -this.facing * 0.3 : 0;
      this.play(this.planted ? 'cool' : 'cower');
      return;
    }
    super.thinkReaction(kind);
  }

  protected override onReact(kind?: ReactionKind): void {
    super.onReact();
    if (kind === 'cower') this.world.audio.sfx(ZSFX.flinch, { vol: 0.5 });
  }

  // ------------------------------------------------------------------------------- helpers

  /** A heavy, slow turn (tanks never spin on the spot). */
  private faceSlowly(tx: number): void {
    const dx = tx - this.x;
    if (Math.abs(dx) >= 12 && Math.sign(dx) !== this.facing && this.modeT % 20 === 0) this.facing = this.facing > 0 ? -1 : 1;
  }

  /**
   * The walk's vx at `speed` this tick (INTEGRATE): on along the floor ahead, down a low step (a
   * wall top back to the street, ≤ `CLAMBER.drop` px), up and over a low wall (≤ `CLAMBER.wall`
   * px: a clamber, so a dead soldier never stands stuck behind the street's low walls), else 0.
   * Airborne in a clamber he keeps going; airborne otherwise (a blast) he keeps his drift.
   */
  private walkOn(speed: number): number {
    const dir = this.facing;
    const b = this.body;
    if (b && !b.onGround) return this.clambering ? speed * CLAMBER.push * dir : this.vx;
    this.clambering = false;
    if (this.floorAhead(dir) || this.stepDownAhead(dir)) return speed * dir;
    if (b && this.lowWallAhead(dir)) {
      this.clambering = true;
      this.vy = CLAMBER.vy;
      return speed * CLAMBER.push * dir;
    }
    return 0;
  }

  /** A low step down ahead (a wall top back to the street): floor 5 … `CLAMBER.drop` px lower, no wall. */
  private stepDownAhead(dir: number): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * 10;
    if (t.isSolid(ax, this.y - 12)) return false;
    const fy = t.surfaceY(ax, this.y - 6, this.y + CLAMBER.drop + 2);
    return Number.isFinite(fy) && fy - this.y > 4 && fy - this.y <= CLAMBER.drop;
  }

  /** A low wall ahead (solid at the knees, clear `CLAMBER.wall` + 4 px up, room over his head). */
  private lowWallAhead(dir: number): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * 10;
    if (!t.isSolid(ax, this.y - 4)) return false;
    return !t.isSolid(ax, this.y - CLAMBER.wall - 4) && !t.isSolid(this.x, this.y - this.hitbox.h - CLAMBER.wall);
  }

  /** Is there floor at his own height `dist` px ahead (no wall, no drop)? */
  private floorAhead(dir: number, dist = 10): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * dist;
    if (t.isSolid(ax, this.y - 12)) return false;
    const fy = t.surfaceY(ax, this.y - 6, this.y + 8);
    return Number.isFinite(fy) && Math.abs(fy - this.y) <= 4;
  }

  /** The head's world point on the current frame (the rig's `head`). */
  headPoint(out: [number, number] = [0, 0]): [number, number] {
    const id = this.anim.id;
    const hp = id ? getFrame(id, this.anim.index, 1).pts?.head : undefined;
    out[0] = Math.round(this.x) + (hp ? hp[0] : 1) * this.facing;
    out[1] = Math.round(this.y) + (hp ? hp[1] : -30);
    return out;
  }

  // ------------------------------------------------------------------------------- draw

  override draw(r: Renderer): void {
    if (this.hidden) return;
    const id = this.anim.id;
    if (!id) return;
    // The hit flash is a pale overlay, never the white cut-out (INTEGRATE: under steady fire a tank
    // zombie flashed white half the time and read as a ghost; revision 2 has no ghosts).
    const flash = this.flashTicks;
    this.flashTicks = 0;
    super.draw(r);
    this.flashTicks = flash;
    const info = ZTABLE.get(id)?.[this.anim.index];
    if (info) drawOverlays(r, this, id, this.anim.index, info, this.facing, this.head, false, this.gunBroken, this.gunDeg, this.mode === 'tell');
    if (flash >= HIT_FLASH_TICKS - 1) {
      // A short (the first 2 ticks of a hit) ADDITIVE bone-light over the body and the head together: the stone-dark outline stays
      // dark and nothing turns see-through (FIX: the 'over' tint washed the body pale under a
      // dark helmet, a half-transparent look).
      hitFlashOpts.flipX = this.facing < 0;
      r.sprite(id, this.anim.index, Math.round(this.x), Math.round(this.y), hitFlashOpts);
      if (info && info.head >= 0 && !info.clip) {
        const hp = getFrame(id, this.anim.index, 1).pts?.head;
        if (hp) r.sprite(headId(this.head), info.head, Math.round(this.x) + hp[0] * this.facing, Math.round(this.y) + hp[1], hitFlashOpts);
      }
    }
  }
}

/** The hit flash: a soft additive bone-light (the ink outline stays dark: a solid dead soldier). */
const hitFlashOpts: DrawOpts = { tint: 0xc8b48cff, alpha: 0.14, blend: 'add' };

const SMOKE: ParticlePreset = { kind: 'pixel', life: [16, 28], gravity: -0.02, drag: 0.94, colors: [0x8e827aff, 0x635857ff], fadeFrom: 0.4, alpha: 0.7 };

const hpScratch: [number, number] = [0, 0];

/**
 * The run-time overlays of a body frame (shared with the `oz-bones` fx): the MG, the head and its
 * eye glow. `at` = the entity whose (x, y) is the anchor.
 */
export function drawOverlays(
  r: Renderer,
  at: Entity,
  id: string,
  index: number,
  info: ZFrameInfo,
  facing: number,
  head: HeadName,
  flash: boolean,
  broken: boolean,
  gunDeg: number,
  tell: boolean,
): void {
  const flip = facing < 0;
  const bx = Math.round(at.x);
  const by = Math.round(at.y);
  const g = info.gun;
  if (g) {
    const gid = g.plant ? MG_GUN.plant : MG_GUN.carry;
    const a = Number.isFinite(gunDeg) ? gunAngleIndex(gunDeg) : g.a;
    gunOpts.flipX = flip;
    gunOpts.flash = flash;
    gunOpts.src = undefined;
    r.sprite(gid, mgGunFrame(a, broken), bx + Math.round(g.x) * facing, by + Math.round(g.y), gunOpts);
  }
  if (info.head < 0) return;
  const hp = getFrame(id, index, 1).pts?.head;
  if (!hp) return;
  const hx = bx + hp[0] * facing;
  const hy = by + hp[1];
  headOpts.flipX = flip;
  headOpts.flash = flash;
  headOpts.src = undefined;
  if (info.clip) {
    // Rising out of the floor: only the part of the head above the floor line.
    const hf = getFrame(headId(head), info.head, 1);
    const top = hy - hf.oy;
    const h = by - top;
    if (h <= 0) return;
    if (h < hf.buf.h) {
      clipRect.x = 0;
      clipRect.y = 0;
      clipRect.w = hf.buf.w;
      clipRect.h = h;
      headOpts.src = clipRect;
    }
  }
  r.sprite(headId(head), info.head, hx, hy, headOpts);
  if (headOpts.src) return;
  const [ex, ey] = eyeAt(HEADS[head].face, HEAD_TILTS[info.head]);
  eyeOpts.alpha = tell ? 0.75 : 0.45;
  eyeOpts.flipX = flip;
  r.sprite(EYE_ID, tell ? 1 : 0, hx + ex * facing, hy + ey, eyeOpts);
  void hpScratch;
}

/** The body strip info (tests). */
export function frameInfo(id: string, index: number): ZFrameInfo | undefined {
  return ZTABLE.get(id)?.[index];
}

export { ZTIMING, COLLAPSE };
