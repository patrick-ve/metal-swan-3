/**
 * Infantry sub-area "rhythm": `drummer`, `cymbalist`, `triangle`, `baton-major` (GDD §9.1) and
 * their projectiles `shockwave`, `cymbal-disc`, `baton` (GDD §15.4; sprites `proj/<id>`).
 * Gameplay only; the art is in ./art.ts. All four are `Soldier`s (../index.ts): entries, gags,
 * the double-take, parade columns, panics, reactions, deaths by damage kind and outfits come from there.
 *
 * - `drummer` (Drum Guard): body 30 HP behind a 120 HP bass drum (a separate front hurtbox).
 *   Bullets, lasers and homing missiles from the front hit the drum (`hit/drum`); spread shots,
 *   flames, explosions, sonic rings, mines, the knife, stomps and anything from behind hit the
 *   body. Advances 0.5 px/tick, one step per 30-tick beat; sets a parade column's tempo (his death
 *   makes the column stumble). Drum charge (player within 72 px): T 30 drumroll → charges 2.5
 *   px/tick for 64 px (contact kills; only the 26 px drum: jump it) → R 40 dizzy. Drum broken
 *   (+100): his head pokes through the skin and he runs away at 1.4 px/tick, no attacks. Death:
 *   the drum rolls away like a wheel (1.5 px/tick, 64 px) while he sits down dazed.
 * - `cymbalist` (Cymbal Crasher): keeps 48–140 px; CRASH: T 32 cymbals overhead → a 10 px ground
 *   shockwave 2.5 px/tick, 160 px, stopped by walls (HARD: both ways) → R 50 ears ringing (a free
 *   window). HARD only: cymbal frisbee T 24 → a disc 28 px up, 3 px/tick, 200 px (crouch).
 * - `triangle` (Triangle Ringer): the alarm. On noticing: DING ×3, 30 ticks apart, then ALARM —
 *   `params.alarm` enters from the nearest view edge — and he runs off. QUIET PLEASE +800 when he
 *   dies before the third ding. `params.alarm`: a number (that many riflemen), an id, or a list of
 *   ids / `{ id, params?, x?, y? }` (with x: spawned there, e.g. riflemen popping out of chimneys);
 *   default 3 riflemen. `params.duet`: triangles with the same duet id ring in harmony and share
 *   one alarm (the first to finish rings it, the other runs).
 * - `baton-major` (Drum Major, officer): 100 HP, keeps 60–120 px behind his troops, marches in
 *   place when idle. IN STEP! every 240 ticks: T 20 whistle → riflemen within 120 px fire 30 %
 *   faster for 240 ticks. Baton boomerang: T 30 twirl → 140 px out and back at 3 px/tick (hits both
 *   ways, 10×10, cannot be shot, a tuba ring erases it) → R 30 catch; 20 % fumble: stunned 60
 *   ("CLONK"). Death: the hat hangs 20 ticks, the baton lands on his chest like a lily, infantry
 *   within 160 px are confused 60 ticks; drops a `medal` (`params.drop` overrides).
 *
 * Column use (GDD §11): give the members one `column` id (`march` px/tick optional); a baton-major
 * with the same id marches behind the line at its speed and leads it once alerted.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import { damageHas } from '../../../../engine/entity';
import { rectAt, type Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { frameCount, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { reactInArea, spawnOffscreen, floorY, type Side } from '../../../enemy';
import { awardScore } from '../../../events';
import { debris, dust } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramNum, paramStr, toSpawnSpec, type SpawnParams } from '../../../registry';
import { playOnce, Soldier, SoldierProp, SOLDIER } from '../index';

const starOpts: DrawOpts = {};
const STARS = 'fx/stars-dizzy';
const pt: [number, number] = [0, 0];

/** Projectile sprites (GDD §15.6 `proj/<id>`; drawn in ./cymbalist.art.ts, ./baton-major.art.ts). */
const SHOCKWAVE_SPRITE = 'proj/shockwave';
const DISC_SPRITE = 'proj/cymbal-disc';
const BATON_SPRITE = 'proj/baton';

/** Dizzy stars circling a head (the `fx/stars-dizzy` sprite when drawn, else two gold pixels). */
function drawStars(r: Renderer, e: Soldier, tick: number): void {
  e.point('head', 2, -32, pt);
  const x = Math.round(pt[0]);
  const y = Math.round(pt[1]) - 9;
  if (hasSprite(STARS)) {
    r.sprite(STARS, Math.floor(tick / 4) % frameCount(STARS), x, y, starOpts);
    return;
  }
  const a = (tick / 10) * Math.PI;
  r.rect(x + Math.round(Math.cos(a) * 6), y + Math.round(Math.sin(a) * 2), 2, 2, PAL.gold[3], starOpts);
  r.rect(x - Math.round(Math.cos(a) * 6), y - Math.round(Math.sin(a) * 2), 2, 2, PAL.gold[2], starOpts);
}

/** Play a sound only for soldiers near the view (a column off-screen stays quiet). */
function nearSfx(e: Entity, id: string, vol = 1, pitch = 1): void {
  if (e.onScreen(32)) e.world.audio.sfx(id, { vol, pitch });
}

// =============================================================================================
// Drummer — Drum Guard
// =============================================================================================

/** Drummer numbers (GDD §9.1; NORMAL). */
export const DRUMMER = {
  hp: 30,
  drumHp: 120,
  drumScore: 100,
  /** Advance: one step per drum beat. */
  walk: 0.5,
  /** Drum charge: range, telegraph, speed, distance, dizzy recovery, gap between charges. */
  chargeRange: 72,
  rollTicks: 30,
  chargeSpeed: 2.5,
  chargeDist: 64,
  dizzyTicks: 40,
  cooldown: 120,
  chargeDamage: 10,
  /** Drum broken: runs away. */
  brokenRun: 1.4,
  /** Death: the drum rolls away like a wheel. */
  rollSpeed: 1.5,
  rollDist: 64,
} as const;

/** The drum hurtbox (26×26, strapped in front: −6 … +20 px, 3 … 29 px above the feet). */
export const DRUM_BOX: Rect = { x: -6, y: -29, w: 26, h: 26 };

export const DRUMMER_GAGS: readonly string[] = ['nap', 'air-solo'];

/** Hits the drum soaks up from the front: bullets (not the shotgun cone), lasers, homing missiles. */
export function drumStops(d: Damage): boolean {
  if (d.kind === 'bullet') return !damageHas(d, 'spread');
  if (d.kind === 'laser') return true;
  return d.weapon === 'homing' || d.weapon === 'homing-missile';
}

export class Drummer extends Soldier {
  drumHp: number;
  readonly drumMaxHp: number;
  drumBroken = false;
  /** Ticks of drum wobble (beats, hits, the drumroll). */
  drumShake = 0;
  private telegraph: number = DRUMMER.rollTicks;
  private chargeLeft = 0;
  private readonly chargeHit: Damage = { amount: DRUMMER.chargeDamage, kind: 'impact', dirX: 1 };
  private readonly hurt: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private readonly bodyOnly: Rect[] = [this.hurt[0]];
  private readonly touch: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/drummer', hp: DRUMMER.hp, w: 14, h: 30, gags: DRUMMER_GAGS, sideEntry: 'walk', walk: DRUMMER.walk, run: 1.0, hatY: 42 });
    this.setsTempo = true;
    this.drumHp = this.drumMaxHp = Math.max(1, paramNum(p, 'drumHp', DRUMMER.drumHp));
    this.chargeHit.source = this;
  }

  /** Is `d` coming from in front of him (where the drum is)? */
  private fromFront(d: Damage): boolean {
    if (d.dirX !== 0) return d.dirX === -this.facing;
    const s = d.source;
    return !!s && Math.abs(s.x - this.x) > 6 && Math.sign(s.x - this.x) === this.facing;
  }

  override hurtboxes(): readonly Rect[] {
    rectAt(this.x, this.y, this.hitbox, this.facing < 0, this.hurt[0]);
    if (this.drumBroken || this.dead) return this.bodyOnly;
    rectAt(this.x, this.y, DRUM_BOX, this.facing < 0, this.hurt[1]);
    return this.hurt;
  }

  /** Only the drum hurts on touch (and only while he charges: `contactDamage`). */
  override contactBoxes(): readonly Rect[] {
    rectAt(this.x, this.y, DRUM_BOX, this.facing < 0, this.touch[0]);
    return this.touch;
  }

  /** The drum soaks up frontal bullets, lasers and homing missiles; everything else hits him. */
  override onHit(d: Damage, part = 0): boolean {
    if (this.dead || this.removed) return false;
    // Frozen in ice, the drum shatters with him (Soldier.onHit).
    if (!this.drumBroken && this.reaction !== 'freeze' && part === 1 && this.fromFront(d) && drumStops(d)) {
      this.drumHp -= d.amount;
      this.drumShake = 6;
      nearSfx(this, 'hit/drum', 0.9);
      if (this.drumHp <= 0) this.breakDrum(d);
      return true;
    }
    return super.onHit(d, 0);
  }

  /** The drum gives out: +100, his head through the skin, he runs (GDD §9.1). */
  private breakDrum(d: Damage): void {
    this.drumBroken = true;
    this.drumHp = 0;
    if (d.owner === 0 || d.owner === 1) awardScore(this.world, d.owner, DRUMMER.drumScore, this.x, this.y - 34);
    this.contactDamage = null;
    this.releaseToken();
    this.alerted = true;
    this.setCrouched(false);
    this.setMode('broken');
    debris(this.world, this.x + this.facing * 6, this.y - 16, 'cloth', 6);
    nearSfx(this, 'hit/drum', 1, 0.6);
    hudOf(this.world).bubble(this, '!!', { ticks: 40, kind: 'gag' });
  }

  // ------------------------------------------------------------------------------- AI

  protected override tick(): void {
    if (this.drumShake > 0) this.drumShake--;
  }

  /** The beat: a boom every 30 ticks (on the world clock, so a column is in step). */
  private beat(): void {
    if (this.world.tick % SOLDIER.beat !== 0) return;
    this.drumShake = 3;
    nearSfx(this, 'enemy/drum-hit', 0.7);
  }

  protected override marchThink(): void {
    this.beat();
  }

  protected override idleThink(): void {
    super.idleThink();
  }

  protected fight(): void {
    switch (this.mode) {
      case 'drumroll':
        return this.thinkDrumroll();
      case 'charge':
        return this.thinkCharge();
      case 'dizzy':
        return this.thinkDizzy();
      case 'broken':
        return this.thinkBroken();
      default:
        return this.thinkAdvance();
    }
  }

  /** March at the player on the beat; charge when he is close and level. */
  private thinkAdvance(): void {
    if (this.drumBroken) return this.setMode('broken');
    const t = this.turnToPlayer();
    this.beat();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    const dx = t.x - this.x;
    const dist = Math.abs(dx);
    const level = Math.abs(t.y - this.y) < 30;
    if (level && dist <= DRUMMER.chargeRange && this.cool <= 0 && this.isFacing(t) && this.onScreen(-8) && this.takeToken()) {
      return this.startDrumroll();
    }
    if (dist > 36 && this.walk(Math.sign(dx), this.walkSpeed)) this.playStep('walk');
    else {
      this.vx = 0;
      if (dist <= 36) this.facePlayer();
      this.play('idle');
    }
  }

  private startDrumroll(): void {
    this.vx = 0;
    this.facePlayer();
    this.telegraph = this.tele(DRUMMER.rollTicks);
    this.setMode('drumroll');
    this.play('drumroll');
    nearSfx(this, 'enemy/drumroll');
  }

  private thinkDrumroll(): void {
    this.vx = 0;
    this.drumShake = 2;
    this.play('drumroll');
    if (this.modeT < this.telegraph) return;
    // Rule 3: the charge only starts with the drum inside the view.
    if (!this.onScreen(-8)) return this.cancelAttack();
    this.chargeLeft = DRUMMER.chargeDist;
    this.chargeHit.dirX = this.facing;
    this.contactDamage = this.chargeHit;
    this.setMode('charge');
    this.play('charge');
    nearSfx(this, 'enemy/drum-hit', 1, 1.3);
  }

  private thinkCharge(): void {
    const sp = DRUMMER.chargeSpeed;
    if (this.chargeLeft <= 0 || this.body?.contact.hitWall || !this.walk(this.facing, sp)) return this.endCharge();
    this.chargeLeft -= sp;
    this.play('charge');
    if (this.modeT % 6 === 0) dust(this.world, this.x - this.facing * 6, this.y, 1);
  }

  private endCharge(): void {
    this.vx = 0;
    this.contactDamage = null;
    this.setMode('dizzy');
    this.play('dizzy');
  }

  private thinkDizzy(): void {
    this.vx = 0;
    this.play('dizzy');
    if (this.modeT < this.recovery(DRUMMER.dizzyTicks)) return;
    this.releaseToken();
    this.cool = this.fireInterval(DRUMMER.cooldown, 20);
    this.setMode('fight');
  }

  /** Drum broken: run away from the nearest player (no attacks; killable). */
  private thinkBroken(): void {
    const t = this.target();
    const dir = t ? (t.x > this.x ? -1 : 1) : this.facing;
    if (this.walk(dir, DRUMMER.brokenRun)) this.play('run-broken');
    else {
      this.vx = 0;
      this.play('broken');
    }
  }

  protected override cancelAttack(): void {
    this.contactDamage = null;
    if (this.drumBroken) {
      this.releaseToken();
      if (this.mode !== 'broken' && !this.isBaseMode()) this.setMode('broken');
      return;
    }
    super.cancelAttack();
  }

  private isBaseMode(): boolean {
    return this.mode === 'panic' || this.mode === 'notice' || this.mode === 'gag' || this.mode === 'idle' || this.mode === 'march';
  }

  /** While the drum is broken every reaction looks out through the hole. */
  protected override thinkReaction(kind: Parameters<Soldier['react']>[0]): void {
    if (this.drumBroken && kind !== 'panic' && kind !== 'queue') {
      this.vx = 0;
      this.play('broken');
      return;
    }
    super.thinkReaction(kind);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    this.contactDamage = null;
    super.onDeath(d);
    if (this.reaction === 'freeze') return; // the drum shatters with him
    const blast = d.kind === 'explosion';
    const dir = blast ? d.dirX || -this.facing : this.facing;
    // The drum rolls away like a wheel while he sits down dazed (GDD §9.1).
    SoldierProp.spawn(this.world, {
      sprite: this.spriteId(this.drumBroken ? 'drum-torn' : 'drum'),
      x: this.x + this.facing * 7,
      y: this.y - 3,
      vx: blast ? dir * 1.2 : 0,
      vy: blast ? -2.8 : 0,
      bounce: blast ? 0.35 : 0,
      roll: this.drumBroken ? 0 : dir * DRUMMER.rollSpeed,
      rollDist: DRUMMER.rollDist,
      spin: this.drumBroken ? 0 : 5,
      rest: 70,
      restFrame: 0,
      flipX: this.facing < 0,
    });
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    // The drum wobbles on the beat and under fire: the whole figure jitters a pixel.
    const shake = !this.dead && this.drumShake > 0 ? (this.drumShake % 2 === 0 ? 1 : -1) : 0;
    this.x += shake;
    super.draw(r);
    this.x -= shake;
    if (this.dead) return;
    if (this.mode === 'dizzy') drawStars(r, this, this.world.tick);
    if (!this.drumBroken && this.drumHp < this.drumMaxHp * 0.67) this.drawCracks(r);
  }

  /** Cracks on the drum skin as its HP drops (two stages). */
  private drawCracks(r: Renderer): void {
    if (!this.anim.id) return;
    this.point('drum', 7, -16, pt);
    const x = Math.round(pt[0]);
    const y = Math.round(pt[1]);
    const f = this.facing;
    const c = PAL.stone[1];
    r.rect(x - 3 * f - (f < 0 ? 0 : 0), y - 5, 1, 3, c, starOpts);
    r.rect(x - 2 * f, y - 2, 1, 3, c, starOpts);
    r.rect(x - f, y + 1, 1, 2, c, starOpts);
    if (this.drumHp < this.drumMaxHp * 0.34) {
      r.rect(x + 3 * f, y - 3, 1, 3, c, starOpts);
      r.rect(x + 4 * f, y, 1, 4, c, starOpts);
      r.rect(x + 2 * f, y + 3, 2, 1, c, starOpts);
    }
  }
}

// =============================================================================================
// Cymbalist — Cymbal Crasher
// =============================================================================================

/** Cymbalist numbers (GDD §9.1; NORMAL). */
export const CYMBALIST = {
  hp: 30,
  rangeMin: 48,
  rangeMax: 140,
  /** CRASH: telegraph, shockwave, recovery (ears ringing). */
  raiseTicks: 32,
  waveSpeed: 2.5,
  waveRange: 160,
  waveH: 10,
  waveDamage: 10,
  ringTicks: 50,
  cooldown: 110,
  /** HARD: the cymbal frisbee. */
  frisbeeTicks: 24,
  frisbeeY: 28,
  frisbeeSpeed: 3,
  frisbeeRange: 200,
  frisbeeChance: 0.35,
  frisbeeRecover: 30,
} as const;

export const CYMBALIST_GAGS: readonly string[] = ['tune', 'yawn'];

const handPt: [number, number] = [0, 0];

export class Cymbalist extends Soldier {
  private telegraph: number = CYMBALIST.raiseTicks;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/cymbalist', hp: CYMBALIST.hp, w: 14, h: 28, gags: CYMBALIST_GAGS, hatY: 34 });
  }

  protected fight(): void {
    switch (this.mode) {
      case 'raise':
        return this.thinkRaise();
      case 'ringing':
        return this.thinkRinging();
      case 'windup':
        return this.thinkWindup();
      case 'recover':
        return this.thinkRecover();
      default:
        return this.thinkApproach();
    }
  }

  /** Close in to 48–140 px, then crash when level with the player (a little slack each side). */
  private thinkApproach(): void {
    const t = this.turnToPlayer();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    const dist = Math.abs(t.x - this.x);
    const level = Math.abs(t.y - this.y) < 24;
    if (this.cool <= 0 && level && dist >= CYMBALIST.rangeMin - 16 && dist <= CYMBALIST.rangeMax + 10 && this.onScreenAt(this.x, this.y - 4) && this.body?.onGround) {
      if (this.takeToken()) {
        this.facePlayer();
        const frisbee = this.mods.id === 'hard' && this.world.rng.chance(CYMBALIST.frisbeeChance);
        return frisbee ? this.startWindup() : this.startRaise();
      }
      this.cool = this.world.rng.int(10, 30);
    }
    if (this.keepRange(t, CYMBALIST.rangeMin, CYMBALIST.rangeMax)) this.play('walk');
    else {
      this.vx = 0;
      this.facePlayer();
      this.play('idle');
    }
  }

  private startRaise(): void {
    this.vx = 0;
    this.telegraph = this.tele(CYMBALIST.raiseTicks);
    this.setMode('raise');
    this.play('raise');
    nearSfx(this, 'enemy/cymbal-raise');
  }

  private thinkRaise(): void {
    this.vx = 0;
    this.play('raise');
    if (this.modeT < this.telegraph) return;
    // Rule 3: the wave starts at his feet; they must be inside the view.
    if (!this.onScreenAt(this.x, this.y - 4)) return this.cancelAttack();
    this.crash();
  }

  /** CRASH: a ground shockwave toward the player (HARD: both ways). */
  private crash(): void {
    const w = this.world;
    Shockwave.launch(w, this, this.facing);
    if (this.mods.id === 'hard') Shockwave.launch(w, this, -this.facing as 1 | -1);
    nearSfx(this, 'enemy/cymbal-crash');
    w.camera.shake(1, 6);
    dust(w, this.x + this.facing * 8, this.y, 4);
    this.setMode('ringing');
    this.play('crash', playOnce());
  }

  /** His ears ring: he wobbles with stars — a free window (R 50). */
  private thinkRinging(): void {
    this.vx = 0;
    if (this.playing('crash') && !this.anim.done) return;
    this.play('ringing');
    if (this.modeT < this.recovery(CYMBALIST.ringTicks)) return;
    this.releaseToken();
    this.cool = this.fireInterval(CYMBALIST.cooldown, 25);
    this.setMode('fight');
  }

  /** HARD: the cymbal frisbee wind-up (T 24). */
  private startWindup(): void {
    this.vx = 0;
    this.telegraph = this.tele(CYMBALIST.frisbeeTicks);
    this.setMode('windup');
    this.play('throw', playOnce(0, Math.max(2, Math.ceil(this.telegraph / 3))));
    nearSfx(this, 'enemy/windup', 0.8);
  }

  private thinkWindup(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    this.point('hand', 8, -CYMBALIST.frisbeeY, handPt);
    const y = this.y - CYMBALIST.frisbeeY;
    if (!this.onScreenAt(handPt[0], y)) return this.cancelAttack();
    this.shoot({
      speed: CYMBALIST.frisbeeSpeed,
      damage: 10,
      sprite: DISC_SPRITE,
      x: handPt[0],
      y,
      w: 12,
      h: 4,
      look: 'anim',
      life: Math.round(CYMBALIST.frisbeeRange / CYMBALIST.frisbeeSpeed),
      offscreen: 32,
    }).type = 'cymbal-disc';
    nearSfx(this, 'enemy/cymbal-raise', 0.6, 1.5);
    this.setMode('recover');
  }

  private thinkRecover(): void {
    this.vx = 0;
    if (!this.playing('throw') || this.anim.done) this.play('idle');
    if (this.modeT < this.recovery(CYMBALIST.frisbeeRecover)) return;
    this.releaseToken();
    this.cool = this.fireInterval(CYMBALIST.cooldown, 25);
    this.setMode('fight');
  }

  protected override onDeath(d: Damage): void {
    super.onDeath(d);
    // A blast: the cymbals roll away like coins (the plain death claps them on his head).
    if (this.reaction === 'freeze') return;
    if (d.kind === 'explosion' || d.kind === 'fire' || d.kind === 'knife' || d.kind === 'crush') {
      for (const dir of [-1, 1] as const) {
        SoldierProp.spawn(this.world, {
          sprite: this.spriteId('cymbal'),
          x: this.x + dir * 5,
          y: this.y - 18,
          vx: dir * 1.1,
          vy: d.kind === 'explosion' ? -3 : -1.5,
          bounce: 0.3,
          roll: dir * 1.2,
          rollDist: 40,
          spin: 4,
          rest: 60,
          restFrame: 0,
        });
      }
    }
  }

  override draw(r: Renderer): void {
    super.draw(r);
    if (!this.dead && this.mode === 'ringing' && !this.playing('crash')) drawStars(r, this, this.world.tick);
  }
}

/**
 * The cymbal crash: a 10 px tall wave rolling along the ground from his feet (2.5 px/tick,
 * 160 px), following slopes and steps up to 8 px; walls and pit edges stop it.
 */
export class Shockwave extends Projectile {
  dist = 0;
  range: number = CYMBALIST.waveRange;
  groundY = 0;

  constructor(world: World) {
    super(world);
  }

  /** Launch one from a soldier's feet toward `dir`. */
  static launch(world: World, from: Soldier, dir: 1 | -1): Shockwave {
    const s = Shockwave.spawn(world, {
      team: 'enemy',
      x: from.x + dir * 8,
      y: from.y - CYMBALIST.waveH / 2,
      vx: dir * CYMBALIST.waveSpeed * from.mods.enemyBulletSpeed,
      vy: 0,
      damage: CYMBALIST.waveDamage,
      kind: 'bullet',
      tags: WAVE_TAGS,
      w: 12,
      h: CYMBALIST.waveH,
      sprite: SHOCKWAVE_SPRITE,
      look: 'anim',
      ticksPerFrame: 3,
      hitsTerrain: false,
      pierce: Infinity,
      life: 400,
      offscreen: 48,
      shooter: from,
      type: 'shockwave',
    });
    return s as Shockwave;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.dist = 0;
    this.range = CYMBALIST.waveRange;
    this.groundY = o.y + (o.h ?? CYMBALIST.waveH) / 2;
  }

  override update(): void {
    const nx = this.x + this.vx;
    const ter = this.world.terrain;
    // A wall taller than 8 px or a pit edge stops the wave.
    if (ter.isSolid(nx + Math.sign(this.vx) * 6, this.groundY - 9)) return this.fizzle();
    const floor = ter.surfaceY(nx, this.groundY - 9, this.groundY + 9);
    if (!Number.isFinite(floor)) return this.fizzle();
    this.x = nx;
    this.groundY = floor;
    this.y = floor - CYMBALIST.waveH / 2;
    this.dist += Math.abs(this.vx);
    this.t++;
    if (this.dist >= this.range || this.t >= this.life) return this.fizzle();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  private fizzle(): void {
    dust(this.world, this.x, this.groundY, 3);
    this.remove();
  }
}

const WAVE_TAGS: readonly string[] = ['shockwave'];

// =============================================================================================
// Triangle — the alarm
// =============================================================================================

/** Triangle numbers (GDD §9.1). */
export const TRIANGLE = {
  hp: 10,
  dings: 3,
  dingGap: 30,
  /** The alarm sounds this long after the first ding (3 dings, 90 ticks in all). */
  alarmAt: 90,
  alarmCount: 3,
  quietBonus: 800,
  fleeSpeed: 1.6,
  /** Counting gag: one proud ding per loop of the strip (frame 4). */
  countDingFrame: 4,
} as const;

/** A duet's state: rung once its alarm went off. */
const duets = new WeakMap<World, Set<string>>();

interface AlarmSpec {
  id: string;
  params?: SpawnParams;
  x?: number;
  y?: number;
}

/** Read `params.alarm`: a count of riflemen, an id, or a list of ids / { id, params, x, y }. */
export function alarmList(v: unknown): AlarmSpec[] {
  if (v === undefined || v === null || v === true) return new Array(TRIANGLE.alarmCount).fill(null).map(() => ({ id: 'rifleman' }));
  if (typeof v === 'number') return new Array(Math.max(0, Math.round(v))).fill(null).map(() => ({ id: 'rifleman' }));
  if (typeof v === 'string') return [{ id: v }];
  if (Array.isArray(v)) {
    const out: AlarmSpec[] = [];
    for (const item of v) {
      if (typeof item === 'string') out.push({ id: item });
      else if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const spec = toSpawnSpec(o);
        if (!spec) continue;
        out.push({ id: spec.id, params: spec.params, x: typeof o.x === 'number' ? o.x : undefined, y: typeof o.y === 'number' ? o.y : undefined });
      }
    }
    return out;
  }
  if (typeof v === 'object') return alarmList([v]);
  return [];
}

export class TriangleRinger extends Soldier {
  /** DINGs rung so far (3 = the alarm went off). */
  dings = 0;
  readonly duet: string;
  private readonly pitch: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/triangle', hp: TRIANGLE.hp, w: 14, h: 26, gags: ['counting'], hatY: 36 });
    this.duet = paramStr(p, 'duet', '');
    // A duet rings in harmony: the second voice a fifth up.
    let n = 0;
    if (this.duet) for (const e of world.byTag('legion')) if (e instanceof TriangleRinger && e.duet === this.duet && e !== this) n++;
    this.pitch = n % 2 === 1 ? 1.5 : 1;
  }

  /** Has his duet partner already sounded the alarm? */
  private duetDone(): boolean {
    return !!this.duet && (duets.get(this.world)?.has(this.duet) ?? false);
  }

  protected override gagThink(): void {
    // Counting rests … then one proud ding (no alarm), and again.
    if (this.anim.changed && this.anim.index === TRIANGLE.countDingFrame) {
      nearSfx(this, 'enemy/triangle', 0.45, this.pitch);
      hudOf(this.world).bubble(this, 'ding', { ticks: 20, kind: 'gag' });
    }
  }

  protected fight(): void {
    switch (this.mode) {
      case 'ding':
        return this.thinkDing();
      case 'flee':
        return this.thinkFlee();
      default:
        if (this.dings >= TRIANGLE.dings || this.duetDone()) return this.setMode('flee');
        this.facePlayer();
        this.setMode('ding');
    }
  }

  /** DING, DING, DING (30 ticks apart), then the ALARM. */
  private thinkDing(): void {
    this.vx = 0;
    if (this.duetDone()) return this.setMode('flee');
    const t = this.modeT - 1;
    if (this.dings < TRIANGLE.dings && t >= 0 && t % TRIANGLE.dingGap === 0) {
      this.dings++;
      this.play('ding', playOnce());
      nearSfx(this, 'enemy/triangle', 1, this.pitch);
      hudOf(this.world).bubble(this, 'DING!', { ticks: 26, kind: 'gag' });
      return;
    }
    if (!this.playing('ding') || this.anim.done) this.play('ring-ready');
    // ALARM 90 ticks after the first ding (the third ding rings out for 30 ticks first).
    if (this.dings >= TRIANGLE.dings && t >= TRIANGLE.alarmAt) {
      this.soundAlarm();
      this.setMode('flee');
    }
  }

  /** ALARM: his row's `alarm` list enters from the nearest view edge; ALARM! flashes once. */
  private soundAlarm(): void {
    const w = this.world;
    if (this.duet) {
      let set = duets.get(w);
      if (!set) {
        set = new Set();
        duets.set(w, set);
      }
      if (set.has(this.duet)) return;
      set.add(this.duet);
    }
    const side: Side = this.x < w.camera.centerX ? 'left' : 'right';
    const tags = waveTags(this.params);
    let i = 0;
    for (const s of alarmList(this.params.alarm)) {
      const params: SpawnParams = { ...(tags ? { tags } : {}), ...s.params };
      if (s.x !== undefined) {
        const y = s.y ?? floorY(w, s.x);
        w.spawn(s.id, s.x, y, params);
      } else {
        spawnOffscreen(w, s.id, side, { margin: 20 + i * 26, params: { entry: 'run', ...params } });
      }
      i++;
    }
    hudOf(w).callout('ALARM!', { ticks: 50, color: 0xf06045ff });
    nearSfx(this, 'enemy/triangle', 1, this.pitch * 1.26);
  }

  /** His one job is done: he runs off and despawns. */
  private thinkFlee(): void {
    const w = this.world;
    const t = this.target();
    const dir = t ? (t.x > this.x ? -1 : 1) : this.facing;
    if (this.walk(dir, TRIANGLE.fleeSpeed)) this.play('run');
    else {
      this.vx = 0;
      this.play('panic');
    }
    // Gone once well outside the view (no score).
    if (!w.camera.containsPoint(this.x, this.y - 10, 40)) this.remove();
  }

  protected override onDeath(d: Damage): void {
    const quiet = this.dings < TRIANGLE.dings;
    super.onDeath(d);
    const w = this.world;
    if (quiet && (d.owner === 0 || d.owner === 1)) {
      awardScore(w, d.owner, TRIANGLE.quietBonus, this.x, this.y - 44);
      hudOf(w).callout('QUIET PLEASE +800');
    }
    // The triangle bounces off his head with a pure "ting!".
    if (this.reaction !== 'freeze') {
      SoldierProp.spawn(w, { sprite: this.spriteId('triangle'), x: this.x, y: this.y - 34, vx: -this.facing * 0.6, vy: -3.2, bounce: 0.45, spin: 5, rest: 50, restFrame: 0 });
      nearSfx(this, 'enemy/triangle', 0.8, 2);
    }
  }
}

/** The wave tags of a spawn (`tag` / `tags` params), passed on to the alarm's soldiers. */
function waveTags(p: SpawnParams): string[] | null {
  const out: string[] = [];
  if (typeof p.tag === 'string') out.push(p.tag);
  if (Array.isArray(p.tags)) for (const t of p.tags) if (typeof t === 'string') out.push(t);
  else if (typeof p.tags === 'string') out.push(p.tags);
  return out.length ? out : null;
}

// =============================================================================================
// Baton-major — Drum Major (officer)
// =============================================================================================

/** Baton-major numbers (GDD §9.1). */
export const BATON_MAJOR = {
  hp: 100,
  behindMin: 60,
  behindMax: 120,
  /** IN STEP!: every, telegraph, buff length, range. */
  buffEvery: 240,
  whistleTicks: 20,
  buffTicks: 240,
  buffRange: 120,
  /** Baton boomerang. */
  twirlTicks: 30,
  throwRange: 140,
  batonSpeed: 3,
  batonSize: 10,
  batonDamage: 10,
  /** Height of the baton's flight above his feet (a crouched player stays under it). */
  batonY: 27,
  catchTicks: 30,
  fumbleChance: 0.2,
  fumbleTicks: 60,
  cooldown: 120,
  /** Death: infantry around him get confused. */
  confusedRange: 160,
  confusedTicks: 60,
} as const;

export class BatonMajor extends Soldier {
  private telegraph: number = BATON_MAJOR.twirlTicks;
  private buffT: number;
  /** The baton in flight (pooled: check `shooter === this` before trusting it). */
  private baton: BatonShot | null = null;
  /** He still has his baton (false while it flies). */
  holdsBaton = true;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/baton-major', hp: BATON_MAJOR.hp, w: 16, h: 30, gags: ['twirl'], sideEntry: 'walk', hatY: 44 });
    this.followsColumn = true;
    this.buffT = world.rng.int(60, 160);
    // Drops a medal (GDD §7.3 table `officer`) unless the mission says otherwise.
    if (!this.drop && p.drop === undefined) this.drop = { id: 'pickup-gem', params: { kind: 'medal' } };
  }

  /** Marches in place when idle (GDD §9.1). */
  protected override idleThink(): void {
    if (this.patrol > 0) return super.idleThink();
    this.vx = 0;
    this.playStep('march');
  }

  protected fight(): void {
    switch (this.mode) {
      case 'whistle':
        return this.thinkWhistle();
      case 'twirl':
        return this.thinkTwirl();
      case 'thrown':
        return this.thinkThrown();
      case 'catch':
        return this.thinkCatch();
      case 'fumble':
        return this.thinkFumble();
      default:
        return this.thinkCommand();
    }
  }

  /** The Legion soldier (not an officer) nearest to the player, within 260 px of him. */
  private frontTroop(t: Entity): Entity | null {
    const list = this.world.byTag('legion');
    let best: Entity | null = null;
    let bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || e instanceof BatonMajor || Math.abs(e.x - this.x) > 260 || Math.abs(e.y - this.y) > 40) continue;
      const d = Math.abs(e.x - t.x);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Riflemen near enough for IN STEP! */
  private troopsInRange(): boolean {
    const list = this.world.byTag('legion');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e !== this && e.alive && !(e instanceof BatonMajor) && Math.abs(e.x - this.x) < BATON_MAJOR.buffRange && Math.abs(e.y - this.y) < 60) return true;
    }
    return false;
  }

  /** Stay 60–120 px behind the troops; whistle IN STEP!; throw the baton at a close player. */
  private thinkCommand(): void {
    const t = this.turnToPlayer();
    if (this.buffT > 0) this.buffT--;
    if (this.buffT <= 0 && this.holdsBaton && this.onScreen(-8) && this.troopsInRange()) return this.startWhistle();
    if (!t) {
      this.vx = 0;
      this.playStep('march');
      return;
    }
    const dx = t.x - this.x;
    const dist = Math.abs(dx);
    const level = Math.abs(t.y - this.y) < 30;
    if (this.cool <= 0 && level && dist <= BATON_MAJOR.throwRange + 20 && this.holdsBaton && this.onScreen(-8)) {
      if (this.takeToken()) return this.startTwirl();
      this.cool = this.world.rng.int(10, 30);
    }
    const front = this.frontTroop(t);
    let moving = false;
    if (front) {
      const away = Math.sign(front.x - t.x) || -this.facing;
      const behind = (this.x - front.x) * away;
      if (behind < BATON_MAJOR.behindMin || behind > BATON_MAJOR.behindMax) {
        const goal = this.clampToView(front.x + away * ((BATON_MAJOR.behindMin + BATON_MAJOR.behindMax) / 2));
        if (Math.abs(goal - this.x) > 4) moving = this.walk(Math.sign(goal - this.x), this.walkSpeed);
      }
    } else moving = this.keepRange(t, 100, 160);
    if (moving) this.playStep('walk');
    else {
      this.vx = 0;
      this.facePlayer();
      this.playStep('march');
    }
  }

  private startWhistle(): void {
    this.vx = 0;
    this.telegraph = this.tele(BATON_MAJOR.whistleTicks);
    this.setMode('whistle');
    this.play('whistle');
    nearSfx(this, 'enemy/whistle');
    hudOf(this.world).bubble(this, 'IN STEP!', { ticks: 40, kind: 'gag' });
  }

  /** IN STEP!: riflemen within 120 px fire 30 % faster for 240 ticks. */
  private thinkWhistle(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    reactInArea(this.world, { x: this.x, y: this.y - 20, r: BATON_MAJOR.buffRange }, 'buff', BATON_MAJOR.buffTicks, { tags: ['legion'], exclude: this, source: this });
    this.buffT = BATON_MAJOR.buffEvery;
    this.setMode('fight');
  }

  private startTwirl(): void {
    this.vx = 0;
    this.facePlayer();
    this.telegraph = this.tele(BATON_MAJOR.twirlTicks);
    this.setMode('twirl');
    this.play('twirl');
    nearSfx(this, 'enemy/windup');
  }

  private thinkTwirl(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    this.point('hand', 9, -BATON_MAJOR.batonY, handPt);
    const y = this.y - BATON_MAJOR.batonY;
    if (!this.onScreenAt(handPt[0], y)) return this.cancelAttack();
    this.baton = BatonShot.throwFrom(this, handPt[0], y);
    this.holdsBaton = false;
    this.setMode('thrown');
    this.play('throw', playOnce(2));
  }

  /** The baton is out: wait for it (it comes back to the hand by itself). */
  private thinkThrown(): void {
    this.vx = 0;
    if (!this.playing('throw') || this.anim.done) this.play('wait');
    const b = this.baton;
    if (!b || b.removed || b.shooter !== this || this.modeT > 200) {
      // Lost (erased by a tuba ring …): he pulls out a spare after a moment.
      this.baton = null;
      this.holdsBaton = true;
      this.endAttack(BATON_MAJOR.catchTicks);
    }
  }

  /** Called by the baton when it reaches his hand. */
  catchBaton(): void {
    this.baton = null;
    this.holdsBaton = true;
    if (this.world.rng.chance(BATON_MAJOR.fumbleChance)) {
      // He fumbles the catch and bonks himself: stunned 60 ticks.
      this.setMode('fumble');
      this.play('fumble', playOnce());
      nearSfx(this, 'enemy/fumble');
      hudOf(this.world).bubble(this, 'CLONK!', { ticks: 40, kind: 'gag' });
      return;
    }
    this.setMode('catch');
    this.play('catch', playOnce());
  }

  /** Is he waiting for this baton (alive, mode 'thrown')? */
  waitsFor(b: BatonShot): boolean {
    return this.alive && this.mode === 'thrown' && this.baton === b;
  }

  private thinkCatch(): void {
    this.vx = 0;
    if (this.modeT >= this.recovery(BATON_MAJOR.catchTicks)) this.endAttack(0);
  }

  private thinkFumble(): void {
    this.vx = 0;
    if (this.anim.done) this.play('dizzy');
    if (this.modeT >= BATON_MAJOR.fumbleTicks) this.endAttack(0);
  }

  private endAttack(extra: number): void {
    this.releaseToken();
    this.cool = this.fireInterval(BATON_MAJOR.cooldown, 25) + extra;
    this.setMode('fight');
  }

  protected override cancelAttack(): void {
    // A reaction while the baton flies: it still comes back (he catches it later).
    if (this.mode === 'thrown') {
      this.releaseToken();
      return;
    }
    super.cancelAttack();
  }

  protected override hatSprite(): string {
    return ''; // his tall hat hangs in the air first (onDeath)
  }

  protected override onDeath(d: Damage): void {
    super.onDeath(d);
    const w = this.world;
    const blast = d.kind === 'explosion';
    if (d.kind !== 'fire' && d.kind !== 'laser' && d.kind !== 'crush' && this.reaction !== 'freeze') {
      // The tall hat hangs in the air for 20 ticks before it drops (GDD §9.1).
      SoldierProp.spawn(w, { sprite: this.spriteId('hat'), x: this.x, y: this.y - 40, vx: blast ? (d.dirX || -this.facing) * 0.6 : 0, vy: -1.8, hang: 20, spin: 0, rest: 70, restFrame: 0, flipX: this.facing < 0 });
    }
    if (this.holdsBaton && d.kind !== 'fire' && d.kind !== 'laser' && this.reaction !== 'freeze') {
      // The baton spins up and lands on his chest like a lily.
      const chest = blast ? this.x + (d.dirX || -this.facing) * 24 : this.x - this.facing * 5;
      SoldierProp.spawn(w, { sprite: this.spriteId('baton-prop'), x: chest, y: this.y - 26, vx: 0, vy: -3.4, spin: 3, landY: blast ? undefined : this.y - 4, rest: 90, restFrame: 0, z: 32 });
    }
    // Infantry within 160 px become confused for 60 ticks (GDD §4.11 rule 6).
    reactInArea(w, { x: this.x, y: this.y - 16, r: BATON_MAJOR.confusedRange }, 'confused', BATON_MAJOR.confusedTicks, { tags: ['legion'], exclude: this, source: this });
  }

  override draw(r: Renderer): void {
    super.draw(r);
    if (!this.dead && this.mode === 'fumble' && this.modeT > 8) drawStars(r, this, this.world.tick);
  }
}

/**
 * The baton boomerang: 140 px out in a flat arc at 3 px/tick, then back to the thrower's hand;
 * hits on the way out and on the way back (each pass once); cannot be shot; erasable.
 */
export class BatonShot extends Projectile {
  phase: 'out' | 'back' = 'out';
  travelled = 0;
  range: number = BATON_MAJOR.throwRange;
  baseY = 0;
  dir: 1 | -1 = 1;
  speed: number = BATON_MAJOR.batonSpeed;

  constructor(world: World) {
    super(world);
  }

  static throwFrom(m: BatonMajor, x: number, y: number): BatonShot {
    const b = BatonShot.spawn(m.world, {
      team: 'enemy',
      x,
      y,
      vx: m.facing * BATON_MAJOR.batonSpeed * m.mods.enemyBulletSpeed,
      vy: 0,
      damage: BATON_MAJOR.batonDamage,
      kind: 'bullet',
      w: BATON_MAJOR.batonSize,
      h: BATON_MAJOR.batonSize,
      sprite: BATON_SPRITE,
      look: 'anim',
      ticksPerFrame: 2,
      hitsTerrain: false,
      pierce: Infinity,
      life: 400,
      offscreen: 120,
      shooter: m,
      type: 'baton',
    });
    nearSfx(m, 'enemy/windup', 0.6, 1.4);
    return b as BatonShot;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.phase = 'out';
    this.travelled = 0;
    this.range = BATON_MAJOR.throwRange;
    this.baseY = o.y;
    this.dir = o.vx < 0 ? -1 : 1;
    this.speed = Math.abs(o.vx) || BATON_MAJOR.batonSpeed;
  }

  override update(): void {
    this.t++;
    if (this.phase === 'out') {
      const nx = this.x + this.dir * this.speed;
      // A wall sends it back early.
      if (this.world.terrain.isSolid(nx + this.dir * 4, this.y)) this.turnBack();
      else {
        this.x = nx;
        this.travelled += this.speed;
        // A flat arc: up to 6 px higher in the middle of the flight.
        this.y = this.baseY - Math.sin((Math.min(1, this.travelled / this.range) * Math.PI)) * 6;
        if (this.travelled >= this.range) this.turnBack();
      }
    } else {
      const m = this.shooter;
      if (m instanceof BatonMajor && m.waitsFor(this)) {
        // Home on the thrower's hand.
        m.point('hand', 8, -BATON_MAJOR.batonY, handPt);
        const dx = handPt[0] - this.x;
        const dy = handPt[1] - this.y;
        const d = Math.hypot(dx, dy);
        if (d <= this.speed + 2) {
          m.catchBaton();
          this.remove();
          return;
        }
        this.x += (dx / d) * this.speed;
        this.y += (dy / d) * this.speed;
        this.vx = (dx / d) * this.speed;
      } else {
        // Nobody to catch it: it flies back to where he stood, then drops.
        this.x -= this.dir * this.speed;
        this.travelled -= this.speed;
        if (this.travelled <= 0) {
          SoldierProp.spawn(this.world, { sprite: 'enemy/baton-major/baton-prop', x: this.x, y: this.y, vy: -1, spin: 3, rest: 60, restFrame: 0 });
          this.remove();
          return;
        }
      }
    }
    if (this.t >= this.life) this.remove();
    else if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  private turnBack(): void {
    this.phase = 'back';
    this.vx = -this.dir * this.speed;
    // A second pass: it can hit the same player again on the way back.
    this.hitList.length = 0;
  }
}

// =============================================================================================
// Registration
// =============================================================================================

defineEntity('drummer', (w, x, y, p) => new Drummer(w, x, y, p), {
  category: 'enemy',
  score: 300,
  description: 'Drum Guard: a 120 HP bass drum shields him from the front; charges up close.',
});
defineEntity('cymbalist', (w, x, y, p) => new Cymbalist(w, x, y, p), {
  category: 'enemy',
  score: 300,
  description: 'Cymbal Crasher: ground shockwaves; HARD adds a cymbal frisbee.',
});
defineEntity('triangle', (w, x, y, p) => new TriangleRinger(w, x, y, p), {
  category: 'enemy',
  score: 200,
  description: 'Triangle Ringer: three dings, then the alarm calls reinforcements.',
});
defineEntity('baton-major', (w, x, y, p) => new BatonMajor(w, x, y, p), {
  category: 'enemy',
  score: 1000,
  description: 'Drum Major: buffs riflemen (IN STEP!), throws a boomerang baton, drops a medal.',
});

// The projectiles as entities (bosses and scripts may spawn them; `facing` gives the direction).
defineEntity(
  'shockwave',
  (w, x, y, p) => {
    const dir: 1 | -1 = p.facing === 1 || p.facing === 'right' ? 1 : -1;
    const s = Shockwave.spawn(w, {
      team: 'enemy',
      x,
      y: y - CYMBALIST.waveH / 2,
      vx: dir * CYMBALIST.waveSpeed,
      vy: 0,
      damage: CYMBALIST.waveDamage,
      tags: WAVE_TAGS,
      w: 12,
      h: CYMBALIST.waveH,
      sprite: SHOCKWAVE_SPRITE,
      look: 'anim',
      ticksPerFrame: 3,
      hitsTerrain: false,
      pierce: Infinity,
      life: 400,
      offscreen: 48,
      type: 'shockwave',
    });
    return s;
  },
  { category: 'projectile', description: 'Cymbal crash ground wave (10 px tall, 2.5 px/tick, 160 px).' },
);
defineEntity(
  'cymbal-disc',
  (w, x, y, p) => {
    const dir = p.facing === 1 || p.facing === 'right' ? 1 : -1;
    return Projectile.spawn(w, {
      team: 'enemy',
      x,
      y: y - CYMBALIST.frisbeeY,
      vx: dir * CYMBALIST.frisbeeSpeed,
      vy: 0,
      damage: 10,
      w: 12,
      h: 4,
      sprite: DISC_SPRITE,
      look: 'anim',
      life: Math.round(CYMBALIST.frisbeeRange / CYMBALIST.frisbeeSpeed),
      offscreen: 32,
      type: 'cymbal-disc',
    });
  },
  { category: 'projectile', description: 'Spinning cymbal 28 px above the ground (crouch under it).' },
);
defineEntity(
  'baton',
  (w, x, y, p) => {
    const dir = p.facing === 1 || p.facing === 'right' ? 1 : -1;
    const b = BatonShot.spawn(w, {
      team: 'enemy',
      x,
      y: y - BATON_MAJOR.batonY,
      vx: dir * BATON_MAJOR.batonSpeed,
      vy: 0,
      damage: BATON_MAJOR.batonDamage,
      w: BATON_MAJOR.batonSize,
      h: BATON_MAJOR.batonSize,
      sprite: BATON_SPRITE,
      look: 'anim',
      ticksPerFrame: 2,
      hitsTerrain: false,
      pierce: Infinity,
      life: 400,
      offscreen: 120,
      type: 'baton',
    });
    return b;
  },
  { category: 'projectile', description: 'Boomerang baton: 140 px out and back (no thrower: it drops).' },
);
