/**
 * Mission oldenzaal — `oz-townsperson`: a frightened townsperson (neutral NPC; docs/design/
 * oldenzaal.md §3.2–3.4). Owner: POSSESSED.
 *
 * Team 'neutral', no 'enemy' / 'shootable' tag: shots pass through, `waitClear` never waits.
 * Modes: idle (frightened, glancing about) → run (away from the nearest possessed; a fright line
 * now and then) → hide (crouched, trembling; runs again when one comes close); a runner who leaves
 * the view is gone. A freed host (`mode: 'freed'`) drops (fall), sits up dazed (sit, ~60 ticks),
 * gets up (a thank-you line now and then) and leaves the view (leave).
 *
 * Possession (spec §3.4): a free soul that reaches a possessable person (any mode but fall and
 * seized) calls `startPossession()`: the spasm (seized, `TOWN.seized` ticks), then he rises as a
 * host (`oz-shambler`, or `oz-brute` for the brute looks) with `entry: 'rise'`. Scripts:
 * `possessTownsperson(e)`.
 *
 * Params: `look` (looks.ts; default: one of the street looks), `mode` ('idle' | 'run' | 'hide' |
 * 'freed'), `flee` (default true; false = he stays put, frightened), `facing`, `dirX` (freed: the
 * side the hit came from, he drops away from it).
 */
import { Entity } from '../../../../engine/entity';
import { Body, moveBody } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { Animator } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { gagBubble } from '../../../enemy';
import { paramBool, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { FREED_LINES, FRIGHT_LINES } from '../../missions/oldenzaal/lines';
import { OZ_TOWN_TAG, clearRepossession, markRepossession } from './api';
import { lookParam } from './host';
import { OZ_BRUTE_LOOKS, OZ_STREET_LOOKS, townArt, type OzLook } from './looks';
import { mistAt } from './mist';
import { FREED, TOWN } from './numbers';

export type TownMode = 'idle' | 'run' | 'hide' | 'fall' | 'sit' | 'getup' | 'leave' | 'seized';

const drawOpts: DrawOpts = {};
const hostParams: Record<string, unknown> = { look: 'shopper', entry: 'rise', repossessed: true, facing: 1 };

export class Townsperson extends Entity {
  readonly look: OzLook;
  readonly anim = new Animator();
  readonly art: string;
  mode: TownMode = 'idle';
  modeT = 0;
  /** Freed from a host (the fall → sit → getup → leave flow). */
  readonly freed: boolean;
  readonly flee: boolean;
  /** Possessed again by a free soul (the host it becomes counts toward the cap). */
  private repossess = true;
  private runDir: 1 | -1 = 1;
  /** Freed: ticks since he got up (leave / hide), and the fade-out tick (-1 = not fading). */
  private leaveT = 0;
  private fadeT = -1;
  private readonly ids = new Map<string, string>();

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.look = lookParam(world, p, OZ_STREET_LOOKS);
    this.art = townArt(this.look);
    this.team = 'neutral';
    this.z = 28;
    this.hitbox = { x: -6, y: -28, w: 12, h: 28 };
    this.body = new Body({ w: 12, h: 28 });
    this.despawnMargin = 120;
    this.addTag(OZ_TOWN_TAG, 'npc');
    this.flee = paramBool(p, 'flee', true);
    const mode = paramStr(p, 'mode', 'idle');
    this.freed = mode === 'freed';
    if (this.freed) {
      const dir = paramNum(p, 'dirX', 0);
      this.vx = (dir > 0 ? 1 : dir < 0 ? -1 : 0) * 0.6;
      this.setMode('fall');
      this.play('fall', true);
    } else if (mode === 'run' || mode === 'hide') this.setMode(mode);
    else this.setMode('idle');
  }

  private spriteId(name: string): string {
    let id = this.ids.get(name);
    if (id === undefined) this.ids.set(name, (id = `${this.art}/${name}`));
    return id;
  }

  private play(name: string, restart = false): void {
    this.anim.play(this.spriteId(name), restart ? { restart: true, loop: name !== 'fall' && name !== 'getup' ? undefined : false } : undefined);
  }

  setMode(m: TownMode): void {
    this.mode = m;
    this.modeT = 0;
  }

  /** May a free soul possess him now (spec §3.4: fleeing or dazed; never while he falls or is seized)? */
  possessable(): boolean {
    return this.alive && this.fadeT < 0 && this.mode !== 'fall' && this.mode !== 'seized';
  }

  /** A soul dives into him: the spasm, then he rises as a host. `repossess` false: a scripted possession (not counted). */
  startPossession(repossess = true): boolean {
    if (!this.possessable()) return false;
    this.repossess = repossess;
    if (repossess) markRepossession(this.world, this);
    this.vx = 0;
    this.setMode('seized');
    this.play('seized', true);
    mistAt(this.world, this.x, this.y - 22, 0.6);
    this.world.audio.sfx('oz/possessed/possess');
    return true;
  }

  /** He rises as a host (the end of the spasm). */
  private becomeHost(): void {
    const id = OZ_BRUTE_LOOKS.includes(this.look) ? 'oz-brute' : 'oz-shambler';
    hostParams.look = this.look;
    hostParams.facing = this.facing;
    hostParams.repossessed = this.repossess;
    clearRepossession(this.world, this);
    this.world.spawn(id, this.x, this.y, hostParams);
    this.remove();
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    this.modeT++;
    if (this.freed && this.thinkFade()) return;
    switch (this.mode) {
      case 'idle':
        this.vx = 0;
        this.play('idle');
        if (this.flee) {
          const t = this.threat(TOWN.fear);
          if (t) this.startRun(t);
        }
        break;
      case 'run':
        this.thinkRun();
        break;
      case 'hide': {
        this.vx = 0;
        this.play('hide');
        const t = this.threat(60);
        if (t && this.flee && this.modeT > 30 && this.canGo(t.x > this.x ? -1 : 1)) this.startRun(t);
        break;
      }
      case 'fall':
        this.vx *= 0.85;
        if (this.anim.done || this.modeT > FREED.fall + 30) {
          this.setMode('sit');
          this.play('sit', true);
        }
        break;
      case 'sit':
        this.vx = 0;
        this.play('sit');
        if (this.modeT >= FREED.dazed) {
          this.setMode('getup');
          this.play('getup', true);
        }
        break;
      case 'getup':
        this.vx = 0;
        if (this.anim.done || this.modeT > FREED.getup + 10) {
          if (this.world.fxRng.chance(FREED.thanks)) {
            gagBubble(this.world, this, FREED_LINES[this.world.fxRng.int(0, FREED_LINES.length - 1)], 90);
          }
          this.runDir = this.leaveDir();
          this.setMode('leave');
        }
        break;
      case 'leave':
        this.thinkLeave();
        break;
      case 'seized':
        this.vx = 0;
        this.play('seized');
        if (this.modeT >= TOWN.seized) this.becomeHost();
        break;
    }
    if (this.removed) return;
    if (this.body) moveBody(this, this.world.terrain, this.world);
    this.anim.update();
  }

  /** The nearest live possessed (a host or a free soul) within `r` px (and 80 px of height), or null. */
  private threat(r: number): Entity | null {
    const list = this.world.byTag('enemy');
    let best: Entity | null = null;
    let bd = r;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || Math.abs(e.y - this.y) > 80) continue;
      const d = Math.abs(e.x - this.x);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Can he run `dir` (floor at his height, no wall, inside the section)? */
  private canGo(dir: number): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * 10;
    const b = t.bounds;
    if (ax < b.x + 4 || ax > b.x + b.w - 4) return false;
    if (t.isSolid(ax, this.y - 12)) return false;
    const fy = t.surfaceY(ax, this.y - 8, this.y + 10);
    return Number.isFinite(fy);
  }

  private startRun(t: Entity): void {
    this.runDir = t.x > this.x ? -1 : 1;
    if (!this.canGo(this.runDir)) {
      this.setMode('hide');
      return;
    }
    this.setMode('run');
    if (this.world.fxRng.chance(TOWN.shout)) gagBubble(this.world, this, FRIGHT_LINES[this.world.fxRng.int(0, FRIGHT_LINES.length - 1)], 60);
  }

  private thinkRun(): void {
    const t = this.threat(TOWN.fear);
    if (t && Math.abs(t.x - this.x) < 50) this.runDir = t.x > this.x ? -1 : 1;
    if (!this.canGo(this.runDir)) {
      this.vx = 0;
      this.setMode('hide');
      return;
    }
    this.facing = this.runDir;
    this.vx = this.runDir * TOWN.run;
    this.play('run');
    if (this.goneFromView()) return;
    if (this.modeT >= TOWN.runMin && !this.threat(TOWN.calm)) this.setMode('hide');
  }

  /**
   * The way off the screen: against the scroll (left; the town scrolls right), so he never walks
   * along with the heroes. The other way only when a wall or a drop blocks the left.
   */
  private leaveDir(): 1 | -1 {
    return this.canGo(-1) ? -1 : 1;
  }

  /**
   * Freed people never crowd the street (spec §3.3: the heroes stay readable): a new freed person
   * makes the oldest of more than `FREED.maxShown` fade out; one who got up fades out after
   * `FREED.leaveTicks`. Returns true when he is gone.
   */
  private thinkFade(): boolean {
    if (this.mode === 'fall' && this.modeT === 1) this.capFreed();
    if (this.fadeT < 0) {
      if (this.mode === 'leave' || this.mode === 'hide') {
        if (++this.leaveT >= FREED.leaveTicks) this.fadeT = 0;
      }
      return false;
    }
    if (++this.fadeT < FREED.fade) return false;
    this.remove();
    return true;
  }

  /** Too many freed people: the oldest one (lowest id) that is not fading yet starts to fade. */
  private capFreed(): void {
    const list = this.world.byTag(OZ_TOWN_TAG);
    let n = 0;
    let oldest: Townsperson | null = null;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!(e instanceof Townsperson) || !e.freed || e.removed || e.fadeT >= 0) continue;
      n++;
      if (e !== this && (oldest === null || e.id < oldest.id)) oldest = e;
    }
    if (n > FREED.maxShown && oldest) oldest.fadeT = 0;
  }

  private thinkLeave(): void {
    if (!this.canGo(this.runDir)) {
      const back = this.runDir > 0 ? -1 : 1;
      if (this.canGo(back)) this.runDir = back;
      else {
        this.vx = 0;
        this.setMode('hide');
        return;
      }
    }
    this.facing = this.runDir;
    this.vx = this.runDir * FREED.run;
    this.play('run');
    this.goneFromView();
  }

  /** A runner outside the view (24 px past the edge) is gone. */
  private goneFromView(): boolean {
    if (this.world.camera.containsPoint(this.x, this.y - 14, 24)) return false;
    this.remove();
    return true;
  }

  override onRemove(): void {
    clearRepossession(this.world, this);
  }

  override draw(r: Renderer): void {
    if (!this.anim.id) return;
    drawOpts.flipX = this.facing < 0;
    drawOpts.alpha = this.fadeT < 0 ? 1 : 1 - this.fadeT / FREED.fade;
    r.sprite(this.anim.id, this.anim.index, this.x, this.y, drawOpts);
  }
}

/** Is `e` a townsperson? */
export function isTownsperson(e: Entity): e is Townsperson {
  return e instanceof Townsperson;
}

/**
 * Scripts: possess townsperson `e` now (the spasm, then he rises as a host). `count` true counts
 * it toward the re-possession cap (default false: a scripted moment). Returns false when he cannot
 * be possessed now.
 */
export function possessTownsperson(e: Entity, count = false): boolean {
  return isTownsperson(e) && e.startPossession(count);
}
