/**
 * The shared base of mission sewers' street people (docs/design/sewers.md §3; owner P1a STREET):
 * `sewers-dealer`, `sewers-pimp`, `sewers-bodyguard`. A soft `Creature` (the knife works, the gloat
 * and the cower as every enemy, attack tokens and telegraphs ≥ 18 ticks) with:
 *
 * - a look from the pool (spawn param `look`, else one by `world.fxRng`: looks never touch play);
 * - an entry: `enter` / `entry` `left` | `right` walks in facing inward, else it faces the hero;
 * - the comedy defeat: the swoon onto the back (`die`), the hat or the sunglasses fly off
 *   (`deathEffects` of the subclass), then he crawls off away from the heroes (`crawl`) and blinks out;
 *   bloodless;
 * - **the flee** (spec §2.2, the rat eruption of sewers-b): `streetFlee(world)` makes every living
 *   street person scream (a bubble), turn away and run off the nearer screen edge. From that tick he is
 *   untargetable (no `shootable`, `soft` or `enemy` tag, team neutral), harmless (no contact, no
 *   attack, no reaction), gives no score and no euro (he never dies), and is removed outside the view.
 *
 * Tag `sewers-street` marks them all (the flee finds them by it).
 */
import type { Damage } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import type { ReactionKind } from '../../../enemy';
import { paramStr, type SpawnParams } from '../../../registry';
import { Creature, entryParam } from '../../creatures/common';
import { CRAWL, FLEE } from './numbers';

/** The tag of every street person (dealer, pimp, bodyguard). */
export const STREET_TAG = 'sewers-street';

/** The scream when the rats burst out, by kind (plain Dutch, ≤ 24 characters). */
export const FLEE_LINES = {
  'sewers-dealer': 'RATTEN!!',
  'sewers-pimp': 'WEG HIER!',
  'sewers-bodyguard': 'BAAS, RENNEN!',
} as const;

export interface StreetOpts {
  id: keyof typeof FLEE_LINES;
  looks: readonly string[];
  hp: number;
  w: number;
  h: number;
  score: number;
}

/** The look from the `look` param, else one by `world.fxRng` (looks are cosmetic). */
function pickLook(p: SpawnParams, world: World, looks: readonly string[]): string {
  const want = paramStr(p, 'look', '');
  if (looks.includes(want)) return want;
  return looks[world.fxRng.int(0, looks.length - 1)];
}

export abstract class StreetPerson extends Creature {
  /** One sprite per draw: drawn at the sub-pixel position (Enemy.fineDraw). */
  protected override fineDraw = true;

  /** The look letter (`a` …). */
  readonly look: string;
  /** Running from the rats (`flee`): untargetable, harmless, gone outside the view. */
  fleeing = false;
  private fleeDir: 1 | -1 = 1;
  private fleeT = 0;
  private fleeStuck = 0;
  /** After the swoon: crawling off. */
  private crawling = false;
  private readonly kindId: StreetOpts['id'];

  constructor(world: World, x: number, y: number, p: SpawnParams, o: StreetOpts) {
    const look = pickLook(p, world, o.looks);
    super(world, x, y, p, { art: `enemy/${o.id}-${look}`, hp: o.hp, w: o.w, h: o.h, score: o.score });
    this.look = look;
    this.kindId = o.id;
    this.addTag(STREET_TAG);
    this.alerted = true;
    const entry = entryParam(p);
    if (entry === 'left') this.facing = 1;
    else if (entry === 'right') this.facing = -1;
    else if (p.facing === 1 || p.facing === 'right') this.facing = 1;
    else if (p.facing === -1 || p.facing === 'left') this.facing = -1;
    else this.facePlayer();
  }

  // ------------------------------------------------------------------------------- the flee

  /**
   * Run from the rats (spec §2.2): a scream, a turn to the nearer screen edge and off. From now on
   * untargetable, harmless, no score, no euro; removed outside the view. Returns false when he is
   * dead, gone or already fleeing.
   */
  flee(bubbleDy = 4): boolean {
    if (!this.alive || this.fleeing) return false;
    this.fleeing = true;
    if (this.reaction) this.endReaction();
    this.releaseToken();
    this.contactDamage = null;
    this.onFlee();
    this.removeTag('shootable');
    this.removeTag('soft');
    this.removeTag('enemy');
    this.team = 'neutral';
    this.drop = null;
    const cam = this.world.camera;
    this.fleeDir = this.x - cam.left <= cam.right - this.x ? -1 : 1;
    this.facing = this.fleeDir;
    this.fleeT = 0;
    this.fleeStuck = 0;
    this.setMode('flee');
    this.play('run', { restart: true });
    const hud = hudOf(this.world);
    hud.clearBubble(this);
    if (bubbleDy >= 0) hud.bubble(this, FLEE_LINES[this.kindId], { ticks: FLEE.bubble, kind: 'gag', dy: bubbleDy });
    if (this.onScreen(0)) this.world.audio.sfx('enemy/scream', { vol: 0.6 });
    return true;
  }

  /** Hook: drop what the subclass holds (a shot volley, a called bodyguard …). */
  protected onFlee(): void {}

  /** Never hurt while fleeing. */
  override onHit(d: Damage, part = 0): boolean {
    if (this.fleeing) return false;
    return super.onHit(d, part);
  }

  /** No reaction while fleeing (the rats win over SAY CHEESE and the gloat). */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    return !this.fleeing && super.acceptsReaction(kind);
  }

  override update(): void {
    if (!this.fleeing || this.dead) return super.update();
    this.fleeT++;
    this.vx = this.fleeDir * FLEE.speed;
    this.play('run');
    this.physics();
    this.anim.update();
    if (this.body?.contact.hitWall) this.fleeStuck++;
    else this.fleeStuck = 0;
    if (!this.onScreen(FLEE.margin) || this.fleeStuck > FLEE.blocked || this.fleeT > FLEE.max) this.remove();
  }

  // ------------------------------------------------------------------------------- the defeat

  /** After the swoon he crawls off, away from the nearest hero, then blinks out. */
  protected override updateDeath(): void {
    if (!this.crawling && this.anim.done && this.hasAnim('crawl')) {
      this.crawling = true;
      const t = this.target();
      this.facing = t && t.x > this.x ? -1 : 1;
      this.corpseTicks = CRAWL.ticks;
      this.play('crawl', { restart: true });
    }
    if (this.crawling && this.body?.onGround) this.vx = this.facing * CRAWL.speed;
    super.updateDeath();
  }

  protected override deathEffects(_d: Damage): void {
    if (this.onScreen(16)) this.world.audio.sfx('enemy/die');
  }

  // ------------------------------------------------------------------------------- helpers

  /** Signed distance to the target along the facing (+ = ahead), or NaN without a target. */
  protected ahead(): number {
    const t = this.target();
    return t ? (t.x - this.x) * this.facing : NaN;
  }

  /** Is the upper body inside the view, 8 px in from the edges (rule 3)? */
  protected visible(): boolean {
    return this.inView(this.x, this.y - 20, -8);
  }

  /** Is there floor at his own height `dist` px ahead in `dir` (no wall, no drop)? */
  protected floorAhead(dir: number, dist = 10): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * dist;
    if (t.isSolid(ax, this.y - 12)) return false;
    const fy = t.surfaceY(ax, this.y - 6, this.y + 6);
    return Number.isFinite(fy) && Math.abs(fy - this.y) <= 3;
  }
}

/** The x of the street people who screamed in this flee (no allocation). */
const saidX = new Float64Array(16);

/**
 * The rat eruption (spec §2.2, wave B): every living street person in the world screams, turns and
 * runs off the nearer screen edge (`StreetPerson.flee`). Returns how many fled. No allocation beyond
 * the world's tag snapshot.
 */
export function streetFlee(world: World): number {
  const list = world.snapshotTag(STREET_TAG);
  let n = 0;
  let said = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!(e instanceof StreetPerson)) continue;
      // The screams never overlap (P2): a neighbour within FLEE.near px that already screamed lifts
      // this bubble one row; a third one close by runs off without a bubble.
      let row = 0;
      for (let k = 0; k < said; k++) if (Math.abs(saidX[k] - e.x) < FLEE.near) row++;
      const dy = row < FLEE.rows ? 4 + row * FLEE.rowDy : -1;
      if (!e.flee(dy)) continue;
      n++;
      if (dy >= 0 && said < saidX.length) saidX[said++] = e.x;
    }
  } finally {
    world.releaseSnapshot();
  }
  return n;
}
