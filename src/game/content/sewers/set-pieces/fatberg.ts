/**
 * `sewers-fatberg` (docs/design/sewers.md §5.4, L7, L8; wave P1b D): a wall of fat, grease and wet
 * wipes that blocks the sewer. It EXTENDS `breakable-wall` (content/props/breakables.ts): a dynamic
 * solid until it breaks, team 'enemy', tags `shootable` / `prop` / `wall` (never 'enemy': it holds
 * no wave and counts as no kill), `wall.broken` for the scripts.
 *
 * - **The big one** (the lock at the end of sewers-d): 80 × 104, hp 1,200 *start*. Fire
 *   (`DamageKind 'fire'`, the flamethrower of the second sewer worker) does double damage (the
 *   user's "fire weapons burn it faster"). 4 crack stages at 75 / 50 / 25 / 0 %: at each of the
 *   first three, 4 runners and 1 spitter burst out of its three rat holes on the left face (the
 *   rats' own `hole` entry: they rise out, hop off and drop; the rise is their tell). At 0 it
 *   slumps (`sewers/fatberg-slump`, slime) into a cosmetic slick and the way opens (`broken`).
 * - **The small secret one** (param `small: true`; the side-tunnel mouth at 1,200): 40 × 36, hp 150
 *   *start*, not solid (drawn behind the actors, off the walk band), tagged `secret` (the bot leaves
 *   it); a gold glint now and then; it `reveal`s what it hides (the golden record).
 *
 * Params: `small`, `hp`, `reveal` (as `breakable-wall`: a spawn spec or a list; `dx` / `dy` / `x` /
 * `y`), `rats` (false: no rats out of the holes; tests), `ratTag` (the rats' tag, default
 * `sewers-fatberg-rats`, for `ctx.waitClear`). Score 100 as every breakable wall.
 *
 * ```ts
 * const berg = ctx.spawn('sewers-fatberg', 2700, 'ground', {}) as Fatberg;
 * yield () => berg.broken;
 * ctx.spawn('sewers-fatberg', 1200, 160, { small: true, reveal: { id: 'pickup-gem', params: { kind: 'golden-record' } } });
 * ```
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { awardScore } from '../../../events';
import { dust } from '../../../fx';
import { defineEntity, NO_PARAMS, paramBool, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { BREAKABLE_WALL, BreakableWall, spawnReveal } from '../../props/breakables';
import { SLIME_COLORS } from '../rats/art';
import { FATBERG_ART, FATBERG_HOLES, FATBERG_SIZE } from './fatberg.art';

export { FATBERG_ART, FATBERG_HOLES, FATBERG_SIZE } from './fatberg.art';

/** The numbers of the fatberg (spec §5.4; *start*). */
export const FATBERG = {
  hp: 1200,
  smallHp: 150,
  /** Fire does this many times the damage. */
  fire: 2,
  /** The crack stages: hp fractions (the first three let the rats out). */
  stages: [0.75, 0.5, 0.25] as readonly number[],
  /** Rats per stage out of the holes. */
  runners: 4,
  spitters: 1,
  /** Ticks between two rats out of the holes. */
  every: 12,
  /** A rat leaves its hole this far left of the fatberg's left face (outside the solid). */
  holeOut: 12,
  /** The slump: ticks of the sag strip (6 frames × 6), then the slick stays. */
  slump: 36,
  /** The small one's gold glint: every `glintEvery` ticks for `glintTicks`. */
  glintEvery: 150,
  glintTicks: 10,
  /** The default tag of the rats it lets out. */
  ratTag: 'sewers-fatberg-rats',
} as const;

const drawOpts: DrawOpts = {};

/** The fatberg (see the file comment). */
export class Fatberg extends BreakableWall {
  readonly small: boolean;
  /** The crack stage the rats came out for (0 = none yet … 3). */
  ratStage = 0;
  /** Ticks since the slump started (−1 = standing). */
  slumpT = -1;
  private readonly hidden: unknown;
  private readonly rats: boolean;
  private readonly ratTag: string;
  private squelch = 0;
  private wobble = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    const small = paramBool(params, 'small', false);
    const size = small ? FATBERG_SIZE.small : FATBERG_SIZE.big;
    const hp = paramNum(params, 'hp', small ? FATBERG.smallHp : FATBERG.hp);
    // The base builds the solid box (big) from w / h; it never sees `reveal` (this class spawns it).
    super(world, x, y, { look: 'rock', w: size.w, h: size.h, solid: !small, hp });
    this.small = small;
    this.hidden = params.reveal;
    this.rats = !small && paramBool(params, 'rats', true);
    this.ratTag = paramStr(params, 'ratTag', FATBERG.ratTag);
    if (small) this.addTag('secret');
  }

  /** 0 intact, 1 ≤ 75 %, 2 ≤ 50 %, 3 ≤ 25 % (the frame). */
  override get stage(): number {
    const f = this.hp / this.maxHp;
    const s = FATBERG.stages;
    if (f > s[0]) return 0;
    if (f > s[1]) return 1;
    if (f > s[2]) return 2;
    return 3;
  }

  override onHit(d: Damage): boolean {
    if (this.broken) return false;
    this.hp -= d.kind === 'fire' ? d.amount * FATBERG.fire : d.amount;
    // A big wall under a stream of fire: the hit flash and the squelch at most every 10 ticks
    // (no white strobe over a third of the screen).
    if (this.squelch <= 0) {
      this.squelch = 10;
      this.flashTicks = 2;
      this.world.audio.sfx('sewers/fatberg-squelch', { vol: 0.5 });
    }
    // Every stage crossed (a blast may cross two): the rats burst out.
    const stage = this.hp <= 0 ? FATBERG.stages.length : this.stage;
    while (this.ratStage < stage) {
      this.ratStage++;
      this.wobble = 16;
      this.world.audio.sfx('sewers/fatberg-squelch');
      this.world.particles.debris(this.x - this.w / 2, this.y - this.h / 2, 6, SLIME_COLORS);
      if (this.rats && this.hp > 0) this.letRatsOut();
    }
    if (this.hp <= 0) this.slump(d);
    return true;
  }

  override die(d?: Damage): void {
    this.slump(d);
  }

  /** 4 runners and 1 spitter out of the three rat holes, one after the other (each rises: its tell). */
  private letRatsOut(): void {
    const hx = this.x - this.w / 2 - FATBERG.holeOut;
    const holes = FATBERG_HOLES;
    const n = FATBERG.runners + FATBERG.spitters;
    for (let i = 0; i < n; i++) {
      // The spitter last, out of the top hole (it hops off and sits where it lands).
      const spitter = i >= FATBERG.runners;
      const dy = spitter ? holes[holes.length - 1] : holes[i % holes.length];
      this.world.spawn(spitter ? 'sewers-rat-spitter' : 'sewers-rat-runner', hx, this.y + dy, {
        entry: 'hole',
        delay: i * FATBERG.every,
        facing: -1,
        tag: this.ratTag,
      });
    }
  }

  /** It gives: the slump, slime, the slick; the way opens; what it hid comes out. */
  private slump(d?: Damage): void {
    if (this.broken) return;
    this.broken = true;
    this.dead = true;
    this.removeTag('shootable');
    if (this.box) {
      this.world.removeSolid(this.box);
      this.box = null;
    }
    this.slumpT = 0;
    this.world.audio.sfx('sewers/fatberg-slump');
    const n = this.small ? 8 : 18;
    this.world.particles.debris(this.x, this.y - this.h / 2, n, SLIME_COLORS);
    this.world.particles.debris(this.x, this.y - this.h / 4, n, SLIME_COLORS);
    dust(this.world, this.x, this.y, this.small ? 3 : 6);
    awardScore(this.world, d?.owner, BREAKABLE_WALL.score, this.x, this.y - this.h - 4);
    spawnReveal(this.world, this.hidden, this.x, this.y);
    if (this.rats) this.dropWaitingRats();
  }

  /** P2: rats still waiting in a hole (`delay`) when it slumps never come (they would rise out of empty air). */
  private dropWaitingRats(): void {
    const list = this.world.byTag(this.ratTag);
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i] as Entity & { mode?: string };
      if (!e.removed && e.mode === 'wait') e.remove();
    }
  }

  override update(): void {
    super.update();
    if (this.squelch > 0) this.squelch--;
    if (this.wobble > 0) this.wobble--;
    if (this.slumpT >= 0 && this.slumpT < FATBERG.slump) this.slumpT++;
  }

  override draw(r: Renderer): void {
    const base = this.small ? `${FATBERG_ART}/small` : `${FATBERG_ART}/big`;
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.broken) {
      drawOpts.flash = false;
      r.sprite(`${base}-slump`, Math.min(5, Math.floor(this.slumpT / 6)), x, y, drawOpts);
      return;
    }
    drawOpts.flash = this.flashTicks > 0;
    // A stage crossed: the mass quivers (1 px) for a moment.
    const jiggle = this.wobble > 0 ? ((this.wobble >> 1) % 2 === 0 ? 1 : -1) : 0;
    const frame = this.small ? ((this.world.tick + this.id * 29) % FATBERG.glintEvery < FATBERG.glintTicks ? 1 : 0) : this.stage;
    r.sprite(base, frame, x + jiggle, y, drawOpts);
    drawOpts.flash = false;
  }
}

/** Is `e` a fatberg? */
export function isFatberg(e: unknown): e is Fatberg {
  return e instanceof Fatberg;
}

defineEntity('sewers-fatberg', (w, x, y, p) => new Fatberg(w, x, y, p), {
  category: 'prop',
  score: BREAKABLE_WALL.score,
  description:
    'Fatberg (sewers-d): a breakable-wall of fat and wipes; hp 1,200, fire ×2, 4 crack stages (75/50/25/0 %), 4 runners + 1 spitter out of its rat holes at each of the first three; slumps open. Param small: the secret 40×36 one (hp 150, not solid, reveal).',
});
