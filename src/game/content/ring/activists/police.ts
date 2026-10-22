/**
 * The police of the blockade (wave B; docs/design/ring.md §R.6; docs/api/ring.md "R.B1"): `ring-agent`,
 * an NPC (category 'npc', team neutral, tag `POLICE_TAG`). NEVER a target and never hurt: no
 * 'shootable' tag, so every shot passes through; no body (they walk the road's line).
 *
 * - Without a job (a section's police line): the officer stands (`stand`, a slow breath), facing the
 *   `facing` param; `look` 'a' | 'b' (default by x).
 * - `callPolice(world, target, opts)`: a PAIR walks in from a screen edge (`walk`, the whistle), takes
 *   the target between them (one at the head, one at the feet), lifts it stiff as a plank (`lift`,
 *   `ACTIVIST_TUNE.policeLift` ticks, 10 px; the target's `carried` turns true and it draws its own
 *   plank strip), carries it off screen (`carry-front` / `carry-back`), then removes it and itself.
 *   `ACTIVIST_OUT_EVENT` (`how: 'carried'`) fires at the lift. A second call on the same target
 *   returns the running one. Also used by the boat's end (the leader).
 *
 * Deterministic (no rng); no per-tick allocations.
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { Animator, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { defineEntity, paramStr, type SpawnParams } from '../../../registry';
import { ACTIVIST_OUT_EVENT, ACTIVIST_TUNE, POLICE, POLICE_TAG, type ActivistKind, type Carryable, type PoliceCall, type PoliceOpts } from './api';
import { ACT_ART, lookOf, type Look } from './looks';

/** Where the officers hold the target: this far from its middle (px). */
export const CARRY_HALF = 13;
/** The lift: the target rises this many px. */
export const LIFT_PX = 10;

/** One running police call: two officers, one target. */
export class PoliceJob implements PoliceCall {
  readonly target: Carryable;
  phase: PoliceCall['phase'] = 'walk-in';
  readonly agents: Agent[] = [];
  /** The side they came from: they carry the target off to it (+1 right, −1 left). */
  readonly exitDir: 1 | -1;
  readonly opts: PoliceOpts;
  t = 0;
  private readonly world: World;
  private readonly liftY: number;

  constructor(world: World, target: Carryable, exitDir: 1 | -1, opts: PoliceOpts) {
    this.world = world;
    this.target = target;
    this.exitDir = exitDir;
    this.opts = opts;
    this.liftY = target.y;
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  /** The lift's progress 0 … 1 (0 while walking in). */
  get lift(): number {
    if (this.phase === 'walk-in') return 0;
    if (this.phase === 'lift') return Math.min(1, this.t / ACTIVIST_TUNE.policeLift);
    return 1;
  }

  /** The lead officer runs the job once per tick. */
  step(): void {
    if (this.phase === 'done') return;
    this.t++;
    const tg = this.target;
    if (tg.removed) return this.finish(false);
    const a = this.agents[0];
    const b = this.agents[1];
    switch (this.phase) {
      case 'walk-in': {
        // The front officer (a) at the side they leave to, the back officer (b) at the other.
        const ia = walkTo(a, tg.x + this.exitDir * CARRY_HALF, ACTIVIST_TUNE.policeWalk);
        const ib = walkTo(b, tg.x - this.exitDir * CARRY_HALF, ACTIVIST_TUNE.policeWalk);
        if ((ia && ib) || this.t > 600) {
          this.phase = 'lift';
          this.t = 0;
          tg.carried = true;
          // Carried between them: drawn over the officers.
          tg.z = 32;
          tg.vx = 0;
          tg.vy = 0;
          tg.facing = this.exitDir;
          a.facing = b.facing = this.exitDir;
          a.pose = b.pose = 'lift';
          const kind = this.opts.kind ?? ((tg as unknown as { kind?: ActivistKind }).kind ?? 'leider');
          this.world.events.emit(ACTIVIST_OUT_EVENT, { kind, how: 'carried', entity: tg });
          this.world.audio.sfx('ring/act/lift');
        }
        break;
      }
      case 'lift':
        tg.y = this.liftY - Math.min(LIFT_PX, (this.t * LIFT_PX) / ACTIVIST_TUNE.policeLift);
        if (this.t >= ACTIVIST_TUNE.policeLift) {
          this.phase = 'carry';
          this.t = 0;
          a.pose = 'carry-front';
          b.pose = 'carry-back';
        }
        break;
      case 'carry':
        a.x += this.exitDir * ACTIVIST_TUNE.policeCarry;
        b.x += this.exitDir * ACTIVIST_TUNE.policeCarry;
        tg.x = (a.x + b.x) / 2;
        if ((!this.world.onScreen(a, 24) && !this.world.onScreen(b, 24) && !this.world.onScreen(tg, 24)) || this.t > 900) this.finish(true);
        break;
    }
  }

  private finish(removeTarget: boolean): void {
    this.phase = 'done';
    if (removeTarget) this.target.remove();
    for (const ag of this.agents) ag.remove();
    this.opts.onDone?.();
  }
}

function walkTo(e: Agent, gx: number, speed: number): boolean {
  const d = gx - e.x;
  if (Math.abs(d) <= speed) {
    e.x = gx;
    e.moving = false;
    return true;
  }
  e.facing = d > 0 ? 1 : -1;
  e.x += e.facing * speed;
  e.moving = true;
  return false;
}

export type AgentPose = 'stand' | 'walk' | 'lift' | 'carry-front' | 'carry-back';

const drawOpts: DrawOpts = {};

/** A police officer (never a target, never hurt). */
export class Agent extends Entity {
  readonly job: PoliceJob | null;
  readonly lead: boolean;
  readonly look: Look;
  readonly art: string;
  readonly anim = new Animator();
  /** What the body does now (the job sets it). */
  pose: AgentPose = 'stand';
  moving = false;
  private readonly ids: Record<AgentPose, string>;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 31;
    this.hitbox = { x: -6, y: -30, w: 12, h: 30 };
    this.despawnMargin = Infinity;
    this.addTag(POLICE_TAG);
    const job = (p as { job?: unknown }).job;
    this.job = job instanceof PoliceJob ? job : null;
    this.lead = (p as { lead?: unknown }).lead === true;
    this.look = lookOf(x + (this.lead ? 0 : 16), paramStr(p, 'look', ''));
    this.art = ACT_ART.agent(this.look);
    this.ids = { stand: `${this.art}/stand`, walk: `${this.art}/walk`, lift: `${this.art}/lift`, 'carry-front': `${this.art}/carry-front`, 'carry-back': `${this.art}/carry-back` };
    if (p.facing === 1 || p.facing === -1) this.facing = p.facing;
    this.pose = this.job ? 'walk' : 'stand';
  }

  override update(): void {
    // Without a job (a section's police line) the officer stands.
    if (this.lead) this.job?.step();
    let pose = this.pose;
    if (pose === 'walk' && !this.moving && this.job?.phase === 'walk-in') pose = 'stand';
    const id = this.ids[pose];
    if (hasSprite(id)) this.anim.play(id, pose === 'lift' ? { loop: false } : undefined);
    this.anim.update();
  }

  override draw(r: Renderer): void {
    if (!this.anim.id) return;
    drawOpts.flipX = this.facing < 0;
    r.sprite(this.anim.id, this.anim.index, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

defineEntity(POLICE, (w, x, y, p) => new Agent(w, x, y, p), {
  category: 'npc',
  description: 'Ring police officer (rf-b): stands at the police line (params facing, look a|b); callPolice sends a pair that lifts a beaten activist stiff as a plank and carries it off; never a target, never hurt.',
});

const jobs = new WeakMap<Entity, PoliceJob>();

/** `callPolice` (api.ts): a pair walks in, lifts the target and carries it off screen. */
export function callPoliceImpl(world: World, target: Carryable, opts: PoliceOpts = {}): PoliceCall {
  const running = jobs.get(target);
  if (running && !running.done) return running;
  const cam = world.camera;
  const from = opts.from ?? (target.x < cam.x + cam.w / 2 ? 'left' : 'right');
  const exitDir: 1 | -1 = from === 'left' ? -1 : 1;
  const job = new PoliceJob(world, target, exitDir, opts);
  const x0 = from === 'left' ? cam.x - 24 : cam.x + cam.w + 24;
  // The front officer (who walks ahead on the way out) comes in last.
  for (let i = 0; i < 2; i++) {
    const ag = world.spawn(POLICE, x0 + exitDir * (1 - i) * 18, target.y, { job, lead: i === 0, look: i === 0 ? 'a' : 'b' }) as Agent;
    ag.facing = (-exitDir) as 1 | -1;
    job.agents.push(ag);
  }
  world.audio.sfx('ring/act/whistle');
  jobs.set(target, job);
  return job;
}
