/**
 * DE HAVERBAR, the havermelk-bar shop of mission oat, `oat-haverbar` (docs/design/oat.md §6.2,
 * §7.3, §7.4; the goods and their rules: goods.ts). A coffee window with a friendly barista; three
 * goods stand on the counter with each player's price tag over them. Stand in front of one for 20
 * ticks (`PINNEN...`) to buy it for that player; step off and on again to buy another.
 *
 * - Anchor at the foot centre (104 × 56; the counter top 20 px over the floor). The buy zones are
 *   the pavement in front of each good (±10 px of it, feet within 10 px of the shop's floor).
 * - GEWEIGERD: the red beep, the red `GEWEIGERD` over the zone and the barista's line; it serves
 *   again once the budget covers the price (the next try).
 * - Point play: the shop is CLOSED (no goods, `GESLOTEN` on the counter; nothing sold).
 * - Params: `greet` (default true: the barista's welcome when a player first comes near; false for
 *   a second visit, e.g. the c kiosk in the afternoon).
 * - Team 'neutral', z 12 (behind items and players); nothing hits it. Fixed per-player state (no
 *   per-tick allocation); a price tag's text is rebuilt only when its price changes.
 *
 * ```ts
 * world.spawn('oat-haverbar', 1200, floorY);              // oat-a
 * world.spawn('oat-haverbar', 640, floorY, { greet: false }); // the c kiosk
 * ```
 */
import { euroOn, euroText } from '../../../budget/index';
import { gameOf, hudOf, type BubbleTarget } from '../../../context';
import { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer, TextOpts } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { isPlayer, type Player } from '../../../player/player';
import { defineEntity, paramBool, type SpawnParams } from '../../../registry';
import { OAT_PIECE, OAT_SPEAKER } from '../../missions/oat/ids';
import { OAT_VOICE } from '../../samples/oat';
import { BARISTA_SPRITE, COUNTER_TOP, HAVERBAR_H, HAVERBAR_SPRITE, HAVERBAR_W } from './art';
import { buyGood, haverbarPrice, HAVERBAR_GOODS, type BuyResult } from './goods';

/** The start values of spec §6.2 and the layout of the window (px from the anchor). */
export const SHOP = {
  /** Ticks on a good to pay (`PINNEN...`). */
  pinTicks: 20,
  /** A buy zone: ±this many px of its good, the feet within `zoneDy` of the shop's floor. */
  zoneHalf: 10,
  zoneDy: 10,
  /** The goods' x on the counter (left to right: flat white, matcha, zuurdesem). */
  goodDx: [-32, 0, 32] as readonly number[],
  /** The barista's place behind the counter (her sprite's bottom centre). */
  baristaDx: 16,
  baristaDy: -16,
  /** The welcome: a player this close (px) for the first time. */
  greetRange: 120,
  /** Ticks of the `GEWEIGERD` note and of the barista's serve / refuse pose. */
  noteTicks: 60,
  poseTicks: 40,
} as const;

const GOODS = HAVERBAR_GOODS.length;
const NOTE_REFUSED = 1;

const drawOpts: DrawOpts = {};
const tagOpts: TextOpts = { align: 'center', screen: false, outline: PAL.ink[0] };
const noteOpts: TextOpts = { align: 'center', screen: false, outline: PAL.ink[0] };
/** The players' tag colours (P1, P2). */
const TAG_COLOR = [PAL.gold[3], PAL.teal[3]] as const;

/** The barista: a fixed point over her head (the bubble's tail points at it). */
class BaristaSpot implements BubbleTarget {
  x = 0;
  y = 0;
  readonly hitbox = { y: -22 };
}

export class OatHaverbar extends Entity {
  /** Ticks on each good per player ([player · 3 + good]). */
  readonly stand = new Int16Array(2 * GOODS);
  /** 1 = a PIN may start (the player stepped on fresh). */
  private readonly armed = new Uint8Array(2 * GOODS).fill(1);
  /** The per-player note over the zone (`GEWEIGERD`): ticks left, which good, which note. */
  private readonly noteLeft = new Int16Array(2);
  private readonly noteGood = new Int8Array(2);
  private readonly noteKind = new Uint8Array(2);
  /** Cached price tags ([player · 3 + good]): the price drawn and its text. */
  private readonly tagPrice = new Int32Array(2 * GOODS).fill(-1);
  private readonly tagText: string[] = new Array<string>(2 * GOODS).fill('');
  private readonly spot = new BaristaSpot();
  private pose = 0;
  private poseLeft = 0;
  private greeted: boolean;
  /** The result of the last buy try (tests, scripts). */
  lastResult: BuyResult | null = null;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 12;
    this.despawnMargin = 240;
    this.hitbox = { x: -HAVERBAR_W / 2, y: -HAVERBAR_H, w: HAVERBAR_W, h: HAVERBAR_H };
    this.greeted = !paramBool(p, 'greet', true);
    this.addTag('oat-haverbar');
  }

  /** The good a player stands on (−1 = none). */
  zoneOf(p: Player): number {
    if (!p.alive || p.state !== 'play') return -1;
    if (Math.abs(p.y - this.y) > SHOP.zoneDy) return -1;
    const dx = p.x - this.x;
    for (let g = 0; g < GOODS; g++) if (Math.abs(dx - SHOP.goodDx[g]) <= SHOP.zoneHalf) return g;
    return -1;
  }

  override update(): void {
    this.spot.x = this.x + SHOP.baristaDx;
    this.spot.y = this.y + SHOP.baristaDy;
    if (this.poseLeft > 0 && --this.poseLeft === 0) this.pose = 0;
    for (let i = 0; i < 2; i++) if (this.noteLeft[i] > 0) this.noteLeft[i]--;
    const euro = euroOn(this.world);
    const list = this.world.byTag('player');
    for (let n = 0; n < list.length; n++) {
      const p = list[n];
      if (!isPlayer(p)) continue;
      const i = p.index;
      if (euro && !this.greeted && p.alive && Math.abs(p.x - this.x) <= SHOP.greetRange) {
        this.greeted = true;
        this.say(OAT_VOICE.barista.welcome);
      }
      const zone = this.zoneOf(p);
      for (let g = 0; g < GOODS; g++) {
        const k = i * GOODS + g;
        if (g !== zone) {
          this.stand[k] = 0;
          this.armed[k] = 1;
          continue;
        }
        if (!euro || this.armed[k] === 0) continue;
        if (++this.stand[k] >= SHOP.pinTicks) {
          this.stand[k] = 0;
          this.armed[k] = 0;
          this.attempt(p, g);
        }
      }
    }
  }

  /** The PIN went through: buy (or GEWEIGERD), the barista answers. */
  private attempt(p: Player, g: number): void {
    const good = HAVERBAR_GOODS[g];
    const res = buyGood(this.world, p, good.key, this.x + SHOP.goodDx[g], this.y - COUNTER_TOP - 14);
    this.lastResult = res;
    if (res === 'bought') {
      this.setPose(1);
      // The first of an item is plain; a dearer one gets the apology.
      const buys = p.slot.ledger.tally(good.category).count;
      this.say(buys > 1 ? OAT_VOICE.barista.inflation : OAT_VOICE.barista.paid);
    } else if (res === 'refused') {
      this.setPose(2);
      this.noteLeft[p.index] = SHOP.noteTicks;
      this.noteGood[p.index] = g;
      this.noteKind[p.index] = NOTE_REFUSED;
      this.say(OAT_VOICE.barista.refused);
    }
  }

  private setPose(f: number): void {
    this.pose = f;
    this.poseLeft = SHOP.poseTicks;
  }

  private say(text: string): void {
    hudOf(this.world).bubble(this.spot, text, { kind: 'gag', ticks: 120, speaker: OAT_SPEAKER.barista });
  }

  override draw(r: Renderer): void {
    const x = this.x;
    const y = this.y;
    drawOpts.flipX = false;
    r.sprite(HAVERBAR_SPRITE, 0, x, y, drawOpts);
    r.sprite(BARISTA_SPRITE, this.pose, x + SHOP.baristaDx, y + SHOP.baristaDy, drawOpts);
    r.sprite(HAVERBAR_SPRITE, 1, x, y, drawOpts);
    const counter = y - COUNTER_TOP;
    if (!euroOn(this.world)) {
      noteOpts.color = PAL.snow[3];
      r.text('GESLOTEN', x, counter - 10, noteOpts);
      return;
    }
    for (let g = 0; g < GOODS; g++) r.sprite(HAVERBAR_GOODS[g].sprite, 0, x + SHOP.goodDx[g], counter, drawOpts);
    // Each joined player's price tags (two lines in 2P: P1 above P2).
    const slots = gameOf(this.world).session.slots;
    const two = slots[0].active && slots[1].active;
    for (let i = 0; i < 2; i++) {
      const s = slots[i];
      if (!s.active) continue;
      const ty = counter - 18 - (two && i === 0 ? 7 : 0);
      tagOpts.color = TAG_COLOR[i];
      for (let g = 0; g < GOODS; g++) {
        const k = i * GOODS + g;
        const price = haverbarPrice(s, HAVERBAR_GOODS[g].key);
        if (this.tagPrice[k] !== price) {
          this.tagPrice[k] = price;
          this.tagText[k] = euroText(price);
        }
        r.text(this.tagText[k], x + SHOP.goodDx[g], ty, tagOpts);
      }
    }
    // PINNEN... with its bar, and GEWEIGERD, over each player's zone.
    for (let i = 0; i < 2; i++) {
      for (let g = 0; g < GOODS; g++) {
        const t = this.stand[i * GOODS + g];
        if (t <= 0) continue;
        const zx = x + SHOP.goodDx[g];
        noteOpts.color = PAL.snow[3];
        r.text('PINNEN...', zx, y - 56, noteOpts);
        r.rect(zx - 11, y - 49, 22, 3, PAL.ink[0]);
        r.rect(zx - 10, y - 48, Math.round((20 * t) / SHOP.pinTicks), 1, PAL.green[3]);
      }
      if (this.noteLeft[i] > 0 && this.noteKind[i] === NOTE_REFUSED && (this.noteLeft[i] > 20 || this.noteLeft[i] % 6 < 3)) {
        noteOpts.color = PAL.red[3];
        r.text('GEWEIGERD', x + SHOP.goodDx[this.noteGood[i]], y - 56, noteOpts);
      }
    }
  }
}

defineEntity(OAT_PIECE.haverbar, (w, x, y, p) => new OatHaverbar(w, x, y, p), {
  category: 'prop',
  description: 'DE HAVERBAR: stand on a good for 20 ticks to buy it (flat white, matcha, zuurdesem; euro play only).',
});
