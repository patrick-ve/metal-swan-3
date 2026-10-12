/**
 * `piano-bomber` — Piano Bomber (GDD §9.2).
 *
 * A fat, slow twin-prop plane with high wings, crimson and gold; its engines are brass horn
 * bells and its belly a bomb bay full of grand pianos. It crosses the screen at 1 px/tick
 * (anchor = the hull centre; ground mode flies at y 20–64, default 36) and drops up to 3 pianos
 * per pass, each near the nearest player:
 * - Telegraph 50 (× difficulty, ≥ 18): the bay opens, the falling whistle starts
 *   (`machine/piano-whistle`) and a shadow grows on the floor under the drop point. Then the
 *   piano falls (acceleration 0.25; see `piano.ts` for the crush, the cover and the floating).
 * - A drop starts when the point where the bay will be at the release is within 64 px of the
 *   nearest player (± a random 16 px), so a pass lays pianos ahead of, on and behind a player.
 *   Attack tokens apply; the bay must be inside the view (8 px margin) at the start and again
 *   at the release, or the drop is cancelled (GDD §4.11).
 * - Flight mode (`mode: 'air'`, m5-a): it moves 1 px/tick relative to the scrolling view, the
 *   pianos fall through the whole screen, and a `!` blinks at the top edge over the drop point
 *   for the last 40 ticks of the telegraph.
 * - Contact kills (a moving enemy vehicle; a big hit for vehicles).
 * - Death: it wobbles and rolls upside down, its last piano pops out of the upturned bay and
 *   comes down on its own belly — PLONK — and the wreck falls and explodes (cosmetic).
 * Params: `dir` ('left' | 'right'; or `from` / `enter` = the side it comes from; default
 * right to left), `mode` ('ground' | 'air'), `pianos` (3), plus `hp`, `drop`. With `enter`
 * (ctx.enter) it starts just outside the view.
 */
import type { Damage } from '../../../../engine/entity';
import { INK, PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer, TextOpts } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { explosion, smokeTrail } from '../../../fx';
import { defineEntity, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { waterSurfaceAt } from '../../../water';
import { TransportMachine, travelDir } from './machine';
import { drawShadow, Piano, PIANO, PIANO_ART } from './piano';

/** Piano bomber numbers (GDD §9.2; NORMAL). */
export const BOMBER = {
  hp: 400,
  score: 4000,
  w: 96,
  h: 36,
  speed: 1,
  /** Ground mode flight line (hull centre): GDD "y 24–48", clamped to 20–64. */
  minY: 20,
  maxY: 64,
  defaultY: 36,
  pianos: 3,
  telegraph: 50,
  /** Flight mode: the `!` marker blinks for the last 40 ticks of the telegraph. */
  marker: 40,
  /** A drop starts when the release point is this close to its target (player x ± jitter). */
  near: 64,
  aimJitter: 16,
  /** Ticks after a release before the next telegraph. */
  gap: 8,
  /** The bay (release point) relative to the anchor, unflipped. */
  bayDx: 4,
  bayY: 14,
  contact: 100,
  /** Death: wobble and roll over, then the piano pops up and lands on the plane. */
  rollTicks: 40,
  popVy: -3.4,
} as const;

export const BOMBER_ART = 'machine/piano-bomber';
const ROLL_SPRITE = `${BOMBER_ART}/roll`;
const WRECK_SPRITE = `${BOMBER_ART}/wreck`;
const GAG_PIANO = `${PIANO_ART}/piano`;

const gagOpts: DrawOpts = {};
const markOpts: TextOpts = { font: 'big', color: PAL.gold[2], outline: INK, align: 'center', screen: true };

export type BomberState = 'fly' | 'tell';
export type BomberDeath = 'roll' | 'pop' | 'crash';

export class PianoBomber extends TransportMachine {
  state: BomberState = 'fly';
  readonly dir: 1 | -1;
  readonly air: boolean;
  pianosLeft: number;
  /** Ticks into the bay telegraph, and its length. */
  tellT = 0;
  tellLen: number = BOMBER.telegraph;
  /** Drop point: world x (ground mode) or screen x (flight mode), and the floor under it. */
  dropX = 0;
  dropFloor = Infinity;
  /** Pianos released so far (scripts and tests). */
  dropped = 0;
  deathPhase: BomberDeath = 'roll';
  private cool = 30;
  private jitter = 0;
  private lastCamX: number;
  private camDx = 0;
  private gagY = 0;
  private gagVy = 0;
  private readonly loopKey: string;
  private looping = false;
  private readonly contact: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: BOMBER_ART, hp: BOMBER.hp, w: BOMBER.w, h: BOMBER.h, centred: true });
    this.dir = travelDir(p, -1);
    this.facing = this.dir;
    this.air = paramStr(p, 'mode', 'ground') === 'air';
    this.pianosLeft = Math.max(0, Math.round(paramNum(p, 'pianos', BOMBER.pianos)));
    if (!this.air) this.y = this.y > BOMBER.maxY + 40 ? BOMBER.defaultY : Math.max(BOMBER.minY, Math.min(BOMBER.maxY, this.y));
    const cam = world.camera;
    // Entering from a view edge (ctx.enter): start fully outside it.
    if (p.enter === 'right') this.x = Math.max(this.x, cam.right + BOMBER.w / 2 + 4);
    else if (p.enter === 'left') this.x = Math.min(this.x, cam.left - BOMBER.w / 2 - 4);
    this.prevX = this.x;
    this.prevY = this.y;
    this.lastCamX = cam.x;
    this.jitter = world.rng.range(-BOMBER.aimJitter, BOMBER.aimJitter);
    this.loopKey = `bomber-${this.id}`;
    this.smokeX = -10;
    this.smokeY = -6;
    this.contact = { amount: BOMBER.contact, kind: 'impact', dirX: this.dir, source: this };
    this.contactDamage = this.contact;
    this.play('body');
  }

  /** Ticks left before the open bay releases (0 when not telegraphing). */
  get bayOpenFor(): number {
    return this.state === 'tell' ? this.tellT : 0;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.fly();
    if (this.state === 'tell') {
      if (++this.tellT >= this.tellLen) this.release();
    } else if (this.cool > 0) this.cool--;
    else if (this.pianosLeft > 0) this.tryDrop();
    this.contactDamage = this.contact;
    this.play(this.state === 'tell' ? 'tell' : 'body');
    this.engineSound();
  }

  /** 1 px/tick across the view; in flight mode relative to the scrolling view. */
  private fly(): void {
    const cam = this.world.camera;
    this.camDx = cam.x - this.lastCamX;
    this.lastCamX = cam.x;
    this.vx = this.dir * BOMBER.speed + (this.air ? this.camDx : 0);
    this.x += this.vx;
    this.drawDy = Math.round(Math.sin(this.age / 22));
  }

  private bayX(): number {
    return this.x + BOMBER.bayDx * this.facing;
  }

  private tryDrop(): void {
    const w = this.world;
    const cam = w.camera;
    const T = this.tele(BOMBER.telegraph);
    const off = this.air ? cam.x : 0;
    const bx = this.bayX();
    const by = this.y + BOMBER.bayY;
    // Where the bay will be at the release (screen x in flight mode, world x otherwise).
    const rel = bx - off + this.dir * BOMBER.speed * T;
    const p = w.nearestPlayer(rel + off, by + 120);
    if (!p) return;
    if (Math.abs(rel - (p.x - off + this.jitter)) > BOMBER.near) return;
    // No attack from outside the view: the bay is in view now and will be at the release.
    if (!this.inView(bx, by) || !this.inView(rel + off, by)) return;
    if (!this.takeToken()) {
      this.cool = 10;
      return;
    }
    this.state = 'tell';
    this.tellT = 0;
    this.tellLen = T;
    this.dropX = rel;
    const wx = rel + off;
    this.dropFloor = Math.min(w.terrain.surfaceY(wx, by, Infinity), waterSurfaceAt(this, wx, by));
    w.audio.sfx('machine/piano-whistle');
  }

  private release(): void {
    const w = this.world;
    const bx = this.bayX();
    const by = this.y + BOMBER.bayY;
    if (!this.inView(bx, by)) {
      this.cancelAttack(); // the view moved on: the bay closes again
      return;
    }
    const piano = new Piano(w, bx, by + PIANO.h, { mode: this.air ? 'air' : 'ground', vx: this.air ? this.camDx : 0, vy: 0.5 });
    piano.shooter = this;
    w.add(piano);
    this.pianosLeft--;
    this.dropped++;
    this.state = 'fly';
    this.tellT = 0;
    this.cool = BOMBER.gap;
    this.jitter = w.rng.range(-BOMBER.aimJitter, BOMBER.aimJitter);
    this.releaseToken();
  }

  protected override cancelAttack(): void {
    if (this.state === 'tell') {
      this.state = 'fly';
      this.tellT = 0;
      this.cool = 20;
    }
    this.releaseToken();
  }

  /** The prop drone while (nearly) on screen. */
  private engineSound(): void {
    const a = this.world.audio;
    const on = this.onScreen(32) && !this.dead;
    if (on && !this.looping) {
      a.sfxLoop?.(this.loopKey, 'machine/copter', { pitch: 0.55, vol: 0.45 });
      this.looping = true;
    } else if (!on && this.looping) {
      a.stopSfx?.(this.loopKey);
      this.looping = false;
    }
  }

  private stopEngine(): void {
    if (!this.looping) return;
    this.world.audio.stopSfx?.(this.loopKey, 12);
    this.looping = false;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(_d: Damage): void {
    this.state = 'fly';
    this.deathPhase = 'roll';
    this.stopEngine();
    explosion(this.world, this.x, this.y, 'm', { team: 'enemy', debris: 'metal', lift: 0 });
  }

  protected override updateDeath(): void {
    const w = this.world;
    this.deadT++;
    this.fly();
    if (this.deathPhase === 'roll') {
      // Wobble and roll over, small blasts along the hull.
      this.drawDy = Math.round(Math.sin(this.deadT / 2.5) * 2);
      if (this.deadT % 9 === 0) explosion(w, this.x + w.fxRng.range(-36, 36), this.y + w.fxRng.range(-10, 10), 's', { team: 'enemy', lift: 0 });
      if (this.deadT >= BOMBER.rollTicks) {
        // The last piano pops out of the upturned bay...
        this.deathPhase = 'pop';
        this.gagY = this.y - 8;
        this.gagVy = BOMBER.popVy;
        w.audio.sfx('machine/piano-whistle', { pitch: 1.6, vol: 0.7 });
      }
      return;
    }
    if (this.deathPhase === 'pop') {
      this.gagVy += PIANO.gravity;
      this.gagY += this.gagVy;
      if (this.gagVy > 0 && this.gagY >= this.y - 8) {
        // ...and lands on its own belly.
        this.gagY = this.y - 8;
        this.deathPhase = 'crash';
        this.vy = 0.4;
        w.audio.sfx('machine/piano-crash');
        explosion(w, this.x, this.y, 'l', { team: 'enemy', debris: 'metal', lift: 0 });
      }
      return;
    }
    // Crash: the wreck (with the piano on it) falls and blows up on the floor.
    this.vy = Math.min(this.vy + 0.2, 6);
    this.y += this.vy;
    this.gagY = this.y - 8;
    if (this.deadT % 2 === 0) smokeTrail(w, this.x - 30 * this.facing, this.y, true);
    const floor = w.terrain.surfaceY(this.x, this.y - 20, Infinity);
    if (this.y + 12 >= floor) {
      explosion(w, this.x, Math.min(floor, this.y + 12), 'l', { team: 'enemy', debris: 'metal' });
      this.remove();
    } else if (this.y - 30 > w.camera.bottom + 16) this.remove();
  }

  override onRemove(): void {
    this.stopEngine();
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.dead) {
      if (this.deathPhase === 'roll') {
        const f = Math.min(4, Math.floor((this.deadT * 5) / BOMBER.rollTicks));
        this.drawStrip(r, ROLL_SPRITE, f, 0, 0, false);
        return;
      }
      this.drawStrip(r, WRECK_SPRITE, Math.floor(this.deadT / 4), 0, 0, false);
      gagOpts.flipX = this.facing < 0;
      r.sprite(GAG_PIANO, 0, Math.round(this.x + 2 * this.facing), Math.round(this.gagY), gagOpts);
      return;
    }
    if (this.state === 'tell') this.drawTell(r);
    super.draw(r);
  }

  /** Telegraph: the growing shadow (ground) or the blinking `!` at the top edge (flight). */
  private drawTell(r: Renderer): void {
    const k = Math.min(1, this.tellT / this.tellLen);
    if (!this.air) {
      if (Number.isFinite(this.dropFloor)) drawShadow(r, this.dropX, this.dropFloor, 8 + 18 * k, 0.2 + 0.2 * k);
      return;
    }
    const left = this.tellLen - this.tellT;
    if (left > BOMBER.marker || left % 8 >= 5) return;
    const sx = Math.round(this.dropX);
    r.text('!', sx, 4, markOpts);
  }
}

defineEntity('piano-bomber', (w, x, y, p) => new PianoBomber(w, x, y, p), {
  category: 'enemy',
  score: BOMBER.score,
  description: 'Piano Bomber: crosses at 1 px/tick, drops up to 3 telegraphed pianos near the player. Params dir, mode (ground | air), pianos.',
});
