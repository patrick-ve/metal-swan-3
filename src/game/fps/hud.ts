/**
 * The status bar, the weapon view and the screen feedback of the first-person mode
 * (docs/design/fps.md §4.9, §4.10, §8.3–8.6, §7.4–7.5). `HudState` holds the cosmetic state the
 * game steps (the face, the damage / pickup flashes, the edge markers); the draw functions read
 * the game. Sprite ids come from the art group (§8); an id that is not registered yet draws a
 * plain stand-in shape (never magenta in the shipped HUD). Nothing here changes the simulation.
 *
 * UHD: the bar, its icons, the face and the weapon view draw their dense frames (2× / 4×) at the
 * art tier (`hudDensity`) when those frames are READY (the fps loader builds them in the art pool);
 * a frame never generates here, so a missing dense frame draws the next lower one.
 */
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer, TextOpts } from '../../engine/render';
import type { Rng } from '../../engine/rng';
import { artTier, getFrame, hasFramesAt, hasSprite, hiArtOn } from '../../engine/sprites';
import { PLAYER_COLORS, scoreText, textWidth, uiText } from '../app';
import { KEY_GOLD, KEY_SILVER } from './doors';
import { MAX_HP } from './player';
import { WEAPONS } from './weapons';

/** The view is 176 px tall; the bar fills y 176–215 (§8.6). */
export const BAR_Y = 176;
export const BAR_H = 40;
/** Messages: small text, at most 128 px wide (§8.6). */
export const MESSAGE_MAX_W = 128;

export const OUCH_TICKS = 30;
export const GRIN_TICKS = 60;
export const DAMAGE_FLASH_TICKS = 6;
export const PICKUP_FLASH_TICKS = 4;
export const EDGE_TICKS = 12;
/** One tick of this much damage makes the face flinch (§4.9). */
export const OUCH_DAMAGE = 20;

export const EDGE_LEFT = 0;
export const EDGE_RIGHT = 1;
export const EDGE_BOTTOM = 2;

/** Face frames (§8.4): band × 3 + glance (0–20), 21 grin, 22 ouch, 23 dead. */
export const FACE_GRIN = 21;
export const FACE_OUCH = 22;
export const FACE_DEAD = 23;

/** The 7 health bands (§4.10): 100–86, 85–72, 71–58, 57–43, 42–29, 28–15, 14–1. */
export function healthBand(hp: number): number {
  if (hp >= 86) return 0;
  if (hp >= 72) return 1;
  if (hp >= 58) return 2;
  if (hp >= 43) return 3;
  if (hp >= 29) return 4;
  if (hp >= 15) return 5;
  return 6;
}

/** The edge marker side of an attacker at relative angle `rel` (−2047..2048; + = right), or −1 (in front). */
export function edgeSide(rel: number): number {
  if (rel < -1536 || rel > 1536) return EDGE_BOTTOM;
  if (rel <= -512) return EDGE_LEFT;
  if (rel >= 512) return EDGE_RIGHT;
  return -1;
}

/** Cosmetic HUD state, stepped once per tick by the game (uses `fxRng`, never the game rng). */
export class HudState {
  glance = 1;
  glanceTimer = 60;
  ouch = 0;
  grin = 0;
  damageFlash = 0;
  pickupFlash = 0;
  readonly edge = new Int16Array(3);
  /** Damage taken this tick (the ouch rule). */
  hurtThisTick = 0;

  reset(): void {
    this.glance = 1;
    this.glanceTimer = 60;
    this.ouch = 0;
    this.grin = 0;
    this.damageFlash = 0;
    this.pickupFlash = 0;
    this.edge.fill(0);
    this.hurtThisTick = 0;
  }

  /** Damage arrived (from relative angle `rel`; NaN = no direction). */
  hurt(amount: number, rel: number): void {
    this.hurtThisTick += amount;
    this.damageFlash = DAMAGE_FLASH_TICKS;
    if (this.hurtThisTick >= OUCH_DAMAGE) this.ouch = OUCH_TICKS;
    if (!Number.isNaN(rel)) {
      const side = edgeSide(rel);
      if (side >= 0) this.edge[side] = EDGE_TICKS;
    }
  }

  step(fx: Rng): void {
    this.hurtThisTick = 0;
    if (this.ouch > 0) this.ouch--;
    if (this.grin > 0) this.grin--;
    if (this.damageFlash > 0) this.damageFlash--;
    if (this.pickupFlash > 0) this.pickupFlash--;
    for (let k = 0; k < 3; k++) if (this.edge[k] > 0) this.edge[k]--;
    if (--this.glanceTimer <= 0) {
      this.glance = fx.weighted(GLANCE_WEIGHTS);
      this.glanceTimer = fx.int(30, 90);
    }
  }

  /** The face frame (§4.10 priority: dead > ouch > grin > band glance). */
  faceFrame(hp: number): number {
    if (hp <= 0) return FACE_DEAD;
    if (this.ouch > 0) return FACE_OUCH;
    if (this.grin > 0) return FACE_GRIN;
    return healthBand(hp) * 3 + this.glance;
  }
}
const GLANCE_WEIGHTS: readonly number[] = [1, 2, 1];

/** What the HUD reads from the floor (FpsGame implements it). */
export interface HudSource {
  readonly player: { hp: number; ammo: number; weapon: number; weapons: number; keys: number; speed: number };
  readonly hud: HudState;
  readonly messages: ReadonlyArray<{ text: string; tick: number }>;
  readonly weaponSys: { viewFrame(p: HudSource['player']): number; viewDrop(): number };
  readonly tick: number;
  readonly bossBar: BossBarState;
  readonly subtitle: SubtitleState;
  /** Distance walked (tiles), for the weapon bob. */
  readonly walked: number;
  /** Px the weapon view is down because fire is off (the suit breaks; FpsGame.weaponLower). */
  readonly weaponLower?: number;
}

/** The boss bar (§7.5; group floors fills it). */
export interface BossBarState {
  visible: boolean;
  name: string;
  /** 0..1 of the current phase's HP. */
  frac: number;
  /** 1 = the suit, 2 = on foot. */
  phase: number;
}

/** A taunt subtitle (§7.4): `\n` splits it into two rows; shown while `ticks` > 0. */
export interface SubtitleState {
  text: string;
  ticks: number;
}

/** The status-bar info that comes from the session, not the floor. */
export interface HudInfo {
  floor: number;
  score: number;
  /** The reserve lives (`slot.lives − 1`, as the 2D HUD shows them; spec §4.13). */
  lives: number;
  /** The fps slot index (its tag `1P` / `2P` and colour). */
  slot: number;
  /** The face's character id (`fps/face/<character>`). */
  character: string;
}

const plain: DrawOpts = { screen: true };
const faded: DrawOpts = { screen: true, alpha: 1 };
const frameOpts: DrawOpts = { screen: true };

/** Density for dense art `want` on a backbuffer of res k (the mission view's rule: 4 only when 4 divides k). */
export function densityAtRes(want: number, k: number): 1 | 2 | 4 {
  if (want >= 4 && k >= 4 && k % 4 === 0) return 4;
  return want >= 2 && k >= 2 ? 2 : 1;
}

/** The density the HUD art draws at on renderer `r`: the art tier at the backbuffer's res; 1 when dense art is off. */
export function hudDensity(r: Pick<Renderer, 'res'>): 1 | 2 | 4 {
  return hiArtOn() ? densityAtRes(artTier(), r.res) : 1;
}

/** The highest density ≤ `want` at which `id`'s frames are built (1 at least); never generates a dense frame. */
export function readyDensity(id: string, want: number): number {
  if (want >= 4 && hasFramesAt(id, 4)) return 4;
  if (want >= 2 && hasFramesAt(id, 2)) return 2;
  return 1;
}

/** Draw frame `index` of sprite `id` with its top-left at (x, y); false when it is not registered. */
function spriteTL(r: Renderer, id: string, index: number, x: number, y: number): boolean {
  if (!hasSprite(id)) return false;
  const f = getFrame(id, index, readyDensity(id, hudDensity(r)));
  r.frame(f, x + f.ox, y + f.oy, frameOpts);
  return true;
}

/** The status bar (§8.6). */
export function drawStatusBar(r: Renderer, s: HudSource, info: HudInfo): void {
  const p = s.player;
  const y0 = BAR_Y;
  if (!spriteTL(r, 'fps/hud/bar', 0, 0, y0)) {
    r.rect(0, y0, r.w, BAR_H, PAL.navy[1], plain);
    r.rect(0, y0, r.w, 1, PAL.steel[2], plain);
    r.rect(118, y0 + 3, 120, 34, PAL.navy[0], plain);
    r.rect(254, y0 + 3, 128, 34, PAL.navy[0], plain);
    r.rect(243, y0 + 4, 11, 32, PAL.navy[0], plain);
    r.rect(6, y0 + 3, 40, 34, PAL.navy[0], plain);
  }
  // Face in the porthole.
  const face = s.hud.faceFrame(p.hp);
  if (!spriteTL(r, `fps/face/${info.character}`, face, 10, 180) && !spriteTL(r, 'fps/face/recruit', face, 10, 180)) {
    drawFaceStandIn(r, face, 10, 180);
  }
  // Health.
  uiText(r, 'HEALTH', 52, 181, PAL.stone[3]);
  bigText(r, `${p.hp}`, 110, 192, p.hp > 25 ? PAL.snow[3] : PAL.red[3], 2);
  const hpC = p.hp > 50 ? PAL.green[2] : p.hp > 25 ? PAL.gold[2] : PAL.red[2];
  r.rect(52, 210, 56, 3, PAL.ink[1], plain);
  r.rect(52, 210, Math.round((56 * Math.max(0, p.hp)) / MAX_HP), 3, hpC, plain);
  // Score, lives, floor + tag.
  uiText(r, 'SCORE', 122, 181, PAL.stone[3]);
  bigText(r, scoreText(info.score), 234, 181, PAL.snow[3], 1);
  if (!spriteTL(r, 'ui/icon-life', 0, 122, 194)) r.rect(123, 195, 8, 8, PLAYER_COLORS[info.slot] ?? PAL.sky[3], plain);
  uiText(r, `X${info.lives}`, 134, 194, PAL.snow[2]);
  uiText(r, `FLOOR ${info.floor}`, 122, 205, PAL.stone[3]);
  uiText(r, `${info.slot + 1}P`, 234, 205, PLAYER_COLORS[info.slot] ?? PAL.sky[3], 'right');
  // Keys.
  if (p.keys & KEY_GOLD && !spriteTL(r, 'fps/hud/key', 0, 244, 182)) drawKeyStandIn(r, 244, 182, PAL.gold[3]);
  if (p.keys & KEY_SILVER && !spriteTL(r, 'fps/hud/key', 1, 244, 199)) drawKeyStandIn(r, 244, 199, PAL.snow[2]);
  // Weapon + ammo.
  if (!spriteTL(r, 'fps/hud/weapon', p.weapon, 258, 186)) uiText(r, WEAPON_SHORT[p.weapon] ?? '?', 258, 194, PAL.snow[2]);
  uiText(r, 'AMMO', 314, 181, PAL.stone[3]);
  bigText(r, `${p.ammo}`, 378, 192, p.ammo > 0 ? PAL.snow[3] : PAL.red[3], 2);
}

const bigOpts: TextOpts = { font: 'big', align: 'right', screen: true, outline: PAL.ink[0], scale: 1, color: PAL.snow[3] };
/** Big-font digits, right-aligned at `right`, at an integer scale (§8.6). */
function bigText(r: Renderer, s: string, right: number, y: number, color: number, scale: number): void {
  bigOpts.color = color;
  bigOpts.scale = scale;
  r.text(s, right, y, bigOpts);
}

const WEAPON_SHORT: readonly string[] = ['KNIFE', 'PISTOL', 'MG', 'CHAINGUN'];

function drawKeyStandIn(r: Renderer, x: number, y: number, c: number): void {
  r.rect(x + 2, y, 4, 4, c, plain);
  r.rect(x + 3, y + 4, 2, 9, c, plain);
  r.rect(x + 5, y + 10, 2, 2, c, plain);
}

/** A simple face stand-in until the art lands: a round head, eyes by glance, a mouth by mood. */
function drawFaceStandIn(r: Renderer, frame: number, x: number, y: number): void {
  r.rect(x + 6, y + 4, 20, 24, PAL.skinA[2], plain);
  r.rect(x + 6, y + 2, 20, 5, PAL.brown[1], plain);
  if (frame === FACE_DEAD) {
    r.rect(x + 9, y + 12, 5, 1, PAL.ink[0], plain);
    r.rect(x + 18, y + 12, 5, 1, PAL.ink[0], plain);
    return;
  }
  const glance = frame < 21 ? (frame % 3) - 1 : 0;
  r.rect(x + 10 + glance, y + 11, 3, 3, PAL.ink[0], plain);
  r.rect(x + 19 + glance, y + 11, 3, 3, PAL.ink[0], plain);
  const band = frame < 21 ? Math.floor(frame / 3) : 0;
  if (band >= 5) r.rect(x + 22, y + 16, 2, 3, PAL.red[2], plain);
  if (frame === FACE_GRIN) r.rect(x + 11, y + 21, 10, 2, PAL.snow[3], plain);
  else if (frame === FACE_OUCH) r.rect(x + 14, y + 20, 4, 4, PAL.ink[0], plain);
  else r.rect(x + 12, y + 22, 8, 1, PAL.ink[1], plain);
}

/** The weapon view (§8.3): 112 × 80, anchor bottom-centre at (192, 176 + bob), bob ±2 while moving. */
export function drawWeaponView(r: Renderer, s: HudSource): void {
  const p = s.player;
  const def = WEAPONS[p.weapon];
  if (!def) return;
  const frame = s.weaponSys.viewFrame(p);
  const bob = p.speed > 0.01 ? Math.round(2 * Math.sin(s.walked * 3)) : 0;
  const drop = Math.max(s.weaponSys.viewDrop(), s.weaponLower ?? 0);
  const x = 192;
  const y = BAR_Y + bob + drop + 2;
  if (hasSprite(def.view)) {
    r.frame(getFrame(def.view, frame, readyDensity(def.view, hudDensity(r))), x, y, plain);
    return;
  }
  // Stand-in: a dark glove and a barrel; a flash on fire A.
  const top = y - 44;
  r.rect(x - 10, top + 18, 20, 30, PAL.ink[1], plain);
  r.rect(x - 14, top + 30, 28, 20, PAL.olive[1], plain);
  if (p.weapon === 0) r.rect(x - 2, top - (frame === 2 ? 14 : 4), 4, 22, PAL.steel[3], plain);
  else r.rect(x - 4, top, 8, 20, PAL.steel[1], plain);
  if (frame === 1 && p.weapon > 0) r.rect(x - 7, top - 12, 14, 12, PAL.gold[3], plain);
}

/** Damage flash, pickup flash and the edge markers (§4.5, §4.9), over the view only. */
export function drawFeedback(r: Renderer, s: HudSource, reduceFlashes: boolean): void {
  const h = s.hud;
  const k = reduceFlashes ? 0.3 : 1;
  if (h.damageFlash > 0) {
    faded.alpha = 0.3 * k;
    r.rect(0, 0, r.w, BAR_Y, PAL.red[1], faded);
  }
  if (h.pickupFlash > 0) {
    faded.alpha = 0.2 * k;
    r.rect(0, 0, r.w, BAR_Y, PAL.gold[3], faded);
  }
  // Information, not a flash: never reduced.
  faded.alpha = 0.8;
  if (h.edge[EDGE_LEFT] > 0) r.rect(0, 0, 4, BAR_Y, PAL.red[2], faded);
  if (h.edge[EDGE_RIGHT] > 0) r.rect(r.w - 4, 0, 4, BAR_Y, PAL.red[2], faded);
  if (h.edge[EDGE_BOTTOM] > 0) r.rect(0, BAR_Y - 4, r.w, 4, PAL.red[2], faded);
}

/** Messages (§8.6): bottom-left of the view, 2 lines max, newest at the bottom. */
export function drawMessages(r: Renderer, s: HudSource): void {
  const m = s.messages;
  for (let k = 0; k < m.length; k++) uiText(r, m[k].text, 4, m.length === 1 ? 164 : 154 + k * 10, PAL.snow[2]);
}

/** The boss bar and the taunt subtitle (§7.4, §7.5): top centre. */
export function drawBossBand(r: Renderer, s: HudSource, bossBarOn: boolean): void {
  const b = s.bossBar;
  if (b.visible && bossBarOn) {
    uiText(r, b.name, r.w >> 1, 1, PAL.snow[3], 'center');
    r.rect(96, 11, 192, 4, PAL.ink[1], plain);
    const c = b.phase >= 2 ? PAL.red[2] : PAL.steel[3];
    r.rect(96, 11, Math.round(192 * Math.max(0, Math.min(1, b.frac))), 4, c, plain);
  }
  const sub = s.subtitle;
  if (sub.ticks > 0 && sub.text) {
    const nl = sub.text.indexOf('\n');
    if (nl < 0) uiText(r, sub.text, r.w >> 1, 18, PAL.snow[3], 'center');
    else {
      uiText(r, sub.text.slice(0, nl), r.w >> 1, 18, PAL.snow[3], 'center');
      uiText(r, sub.text.slice(nl + 1), r.w >> 1, 27, PAL.snow[3], 'center');
    }
  }
}

/** Does a message fit the 128-px message area (hud test)? */
export function messageFits(text: string): boolean {
  return textWidth(text, 'small') <= MESSAGE_MAX_W;
}
