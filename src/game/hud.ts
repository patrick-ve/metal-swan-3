/**
 * In-game HUD (GDD §13.7). Screen space: per-player blocks (P1 left at x 4, P2 mirrored at
 * x 380): score, weapon icon + ammo digits (none for unlimited weapons: the icon alone means it
 * never runs out — no ∞ sign), grenades or shells, swan-head lives, bow-tie hostages, continues,
 * the vehicle's HP cells (+ the special-ready dot), a status icon with its timer bar and the
 * pop-up line; the section timer, the boss bar, the ONWARD prompt, callouts, banners, screen
 * flashes, and the Swan marker at the top edge. World space: score pop-ups, speech bubbles
 * (RIDE? included) and pointer hints (STOMP!, SHOOT!).
 *
 * Every element is optional art: `ui/icon-<weapon>` (or `WeaponDef.icon`), `ui/icon-bomb`,
 * `ui/icon-shell`, `ui/icon-life`, `ui/icon-hostage`, `ui/icon-cell`, `ui/onward`,
 * `ui/swan-marker`; missing ones fall back to small shapes or text.
 */
import type { Color } from '../engine/color';
import { measure } from '../engine/font';
import type { Rect } from '../engine/math';
import { INK, PAL } from '../engine/palette';
import type { DrawOpts, Renderer, TextOpts } from '../engine/render';
import { getFrame, hasSprite } from '../engine/sprites';
import { Boss } from './boss';
import type { Bubble, HudState, Pointer } from './context';
import type { MissionRunner } from './mission/runner';
import type { Player } from './player/player';
import { getWeapon } from './registry';
import type { GameSession, PlayerSlot } from './session';
import { DEFAULT_SETTINGS, type GameSettings } from './settings';
import { TUNING } from './tuning';
import { Vehicle } from './vehicle';

export interface HudInput {
  session: GameSession;
  hud: HudState;
  runner: MissionRunner | null;
  /** 2 = two-player controls (an empty slot shows PRESS START). */
  inputPlayers: 1 | 2;
  /** Frame counter for blinking. */
  ticks: number;
  /** Options (speech bubbles, boss bar); default DEFAULT_SETTINGS. */
  settings?: GameSettings;
}

/** P1 sky, P2 gold (GDD §13). */
const P_COLORS: readonly Color[] = [PAL.sky[3], PAL.gold[3]];
const WHITE: Color = PAL.snow[3];
const GOLD: Color = PAL.gold[3];
const RED: Color = PAL.red[3];
const VIEW_W = 384;

const iconOpts: DrawOpts = { screen: true };
const worldOpts: DrawOpts = {};
const text: TextOpts = { font: 'small', color: WHITE, outline: INK, screen: true };
const worldText: TextOpts = { font: 'small', color: INK, screen: false, align: 'center' };

function txt(r: Renderer, s: string, x: number, y: number, color: Color = WHITE, align: 'left' | 'center' | 'right' = 'left', font: 'small' | 'big' = 'small'): void {
  text.color = color;
  text.align = align;
  text.font = font;
  r.text(s, x, y, text);
}

/** Draw frame `i` of an icon sprite with its top-left at (x, y) whatever its anchor. Returns its width (0 = missing). */
function icon(r: Renderer, id: string, x: number, y: number, i = 0): number {
  if (!hasSprite(id)) return 0;
  const f = getFrame(id, i);
  r.sprite(id, i, x + f.ox, y + f.oy, iconOpts);
  return f.buf.w;
}

/** Width of an icon sprite (0 when missing). */
function iconW(id: string): number {
  return hasSprite(id) ? getFrame(id, 0).buf.w : 0;
}

/** GDD §13: blink 30 ticks on / 30 off unless noted. */
function blink(t: number, on = 30): boolean {
  return t % (on * 2) < on;
}

export function drawHud(r: Renderer, h: HudInput): void {
  const settings = h.settings ?? DEFAULT_SETTINGS;
  if (h.runner && !h.hud.hidden) {
    drawPopups(r, h.hud);
    drawBubbles(r, h.hud, settings);
    drawPointers(r, h.hud, h.ticks);
  }
  drawFlash(r, h.hud);
  if (h.hud.hidden) return;
  for (let i = 0; i < 2; i++) drawPanel(r, h, h.session.slots[i]);
  if (h.runner) {
    drawTimer(r, h.runner, h.ticks);
    if (settings.bossBar) drawBossBar(r, h.runner, h.ticks);
    drawSwanMarkers(r, h.runner);
  }
  drawOnward(r, h.hud, h.ticks);
  drawCallouts(r, h.hud);
  drawBanner(r, h.hud, h.ticks);
}

// ---------------------------------------------------------------------------------------------
// Player blocks (P1 left-aligned at x 4, P2 mirrored: right-aligned at x 380)
// ---------------------------------------------------------------------------------------------

/** Left edge of an element of width `w` placed at P1 offset `x1` (mirrored for P2). */
function at(left: boolean, x1: number, w: number): number {
  return left ? x1 : VIEW_W - x1 - w;
}

function drawPanel(r: Renderer, h: HudInput, s: PlayerSlot): void {
  const left = s.index === 0;
  const align = left ? 'left' : 'right';
  const edge = left ? 4 : VIEW_W - 4;
  const col = P_COLORS[s.index];
  const tag = left ? '1P' : '2P';
  const t = h.ticks;

  if (!s.joined) {
    if (h.inputPlayers === 2 && blink(t)) txt(r, h.session.credits <= 0 ? `${tag} NO CREDITS` : `${tag} PRESS START`, edge, 3, col, align);
    return;
  }
  // Score (always shown, also on the CONTINUE? and GAME OVER screens): the tag, then 7 digits at x 16.
  const score = String(Math.min(Math.max(0, s.score), 9999999)).padStart(7, '0');
  txt(r, tag, edge, 3, col, align);
  txt(r, score, left ? 16 : VIEW_W - 16, 3, GOLD, align);

  if (s.gameOver) {
    // 2 players: the continue countdown runs in the dead player's corner (GDD §13.9).
    const cont = h.runner?.continueTicks[s.index] ?? -1;
    if (cont >= 0) {
      const n = Math.max(0, Math.ceil(cont / TUNING.continues.ticksPerCount) - 1);
      txt(r, 'CONTINUE?', edge, 13, GOLD, align);
      txt(r, String(n), edge, 23, n <= 3 ? RED : WHITE, align, 'big');
      if (blink(t)) txt(r, 'PRESS START', edge, 34, col, align);
    } else if (h.inputPlayers === 2 && blink(t)) txt(r, h.session.credits <= 0 ? 'NO CREDITS' : 'PRESS START', edge, 13, col, align);
    return;
  }

  const p = h.runner?.player(s.index) ?? null;
  const vehicle = p?.state === 'mounted' && p.vehicle instanceof Vehicle ? p.vehicle : null;

  // Weapon icon (4, 12) + ammo digits (22, 12); no digits for unlimited weapons.
  const w = getWeapon(s.weapon);
  const iconId = w.icon ?? `ui/icon-${w.id}`;
  const iw = iconW(iconId) || 16;
  if (!icon(r, iconId, at(left, 4, iw), 12)) txt(r, w.name.slice(0, 3), at(left, 4, iw), 12, WHITE);
  if (s.ammo !== Infinity) txt(r, String(Math.max(0, Math.floor(s.ammo))), left ? 4 + Math.max(16, iw) + 2 : VIEW_W - 4 - Math.max(16, iw) - 2, 12, WHITE, align);

  // Grenades (52, 12): icon + 'x10'; in a vehicle: the shell icon and the vehicle's shells.
  const bombIcon = vehicle ? 'ui/icon-shell' : 'ui/icon-bomb';
  // GDD 13.7: grenades read 'x10'; in a vehicle the shell icon is followed by the bare count.
  const bombs = vehicle ? String(Math.max(0, vehicle.shells)) : `x${s.bombs}`;
  const bw = iconW(bombIcon);
  const bh = bw ? getFrame(bombIcon, 0).buf.h : 0;
  const by = 15 - (bh >> 1);
  // 1 px after the icon; the bare shell count keeps a gap before the vehicle name at x 80.
  const gap = bw ? 1 : 0;
  if (left) {
    icon(r, bombIcon, 52, by);
    txt(r, bombs, 52 + bw + gap, 12);
  } else {
    icon(r, bombIcon, VIEW_W - 52 - bw, by);
    txt(r, bombs, VIEW_W - 52 - bw - gap, 12, WHITE, 'right');
  }

  // Lives in reserve (4, 22): swan heads, max 5, then 'xN'; hostages (4, 30): bow ties, max 10.
  drawIconRow(r, 'ui/icon-life', Math.max(0, s.lives - 1), 5, edge, 21, left, PAL.snow[3]);
  drawIconRow(r, 'ui/icon-hostage', s.rescued, 10, edge, 30, left, PAL.red[3]);
  if (s.continues > 0) txt(r, `CONT ${s.continues}`, edge, 38, PAL.stone[3], align);

  // Vehicle (80, 12) / (80, 21): name + HP cells; a status (80, 30): icon + 24×2 timer bar.
  if (vehicle) drawVehicle(r, vehicle, left, t);
  if (p) drawStatus(r, p, left);

  // Pop-up line (4, 46): weapon names, bonuses.
  const m = h.hud.messages[s.index];
  if (m && (m.ticks > 20 || m.ticks % 4 < 2)) txt(r, m.text, edge, 46, m.color, align);
}

/**
 * A row of icons (or a coloured dot when the icon is missing): `n` icons up to `max`, else one
 * icon and 'xN'. Neighbouring icons share their outline column.
 */
function drawIconRow(r: Renderer, id: string, n: number, max: number, edge: number, y: number, left: boolean, fallback: Color): void {
  if (n <= 0) return;
  const w = iconW(id) || 5;
  const step = w - 1;
  const shown = n > max ? 1 : n;
  for (let i = 0; i < shown; i++) {
    const ix = left ? edge + i * step : edge - w - i * step;
    if (!icon(r, id, ix, y)) r.rect(ix, y + 1, 3, 3, fallback, iconOpts);
  }
  if (n > max) {
    const label = `x${n}`;
    if (left) txt(r, label, edge + w + 1, y + 1);
    else txt(r, label, edge - w - 1, y + 1, WHITE, 'right');
  }
}

/** HP cells 8×5 with 2 px gaps (snow; red and blinking at ≤ 1 cell); a 3×3 dot when the special is ready. */
function drawVehicle(r: Renderer, v: Vehicle, left: boolean, t: number): void {
  const name = (v.hudName || v.type || 'VEHICLE').toUpperCase();
  txt(r, name, left ? 80 : VIEW_W - 80, 12, WHITE, left ? 'left' : 'right');
  const n = Math.ceil(v.maxCells);
  const danger = v.cells <= 1;
  const show = !danger || blink(t, 8);
  const cellArt = hasSprite('ui/icon-cell');
  const total = n * 10 - 2 + (specialReady(v) ? 5 : 0);
  const x0 = at(left, 80, total);
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * 10;
    const amount = Math.max(0, Math.min(1, v.cells - i));
    // Frames of ui/icon-cell: 0 empty, 1 half, 2 full, 3 half red, 4 full red (each 8×5 + outline).
    const frame = amount <= 0 || !show ? 0 : (amount < 1 ? 1 : 2) + (danger ? 2 : 0);
    if (cellArt) {
      icon(r, 'ui/icon-cell', cx - 1, 20, frame);
      continue;
    }
    r.rect(cx - 1, 20, 10, 7, INK, iconOpts);
    if (frame === 0) continue;
    r.rect(cx, 21, amount < 1 ? 4 : 8, 5, danger ? RED : PAL.snow[3], iconOpts);
  }
  if (specialReady(v)) {
    const dx = x0 + n * 10 + 1;
    r.rect(dx - 1, 21, 5, 5, INK, iconOpts);
    r.rect(dx, 22, 3, 3, blink(t, 15) ? GOLD : PAL.gold[2], iconOpts);
  }
}

/** Is the vehicle's special ready? A vehicle may say so itself (`specialReady`), else the special weapon's cooldown and the shells decide. */
function specialReady(v: Vehicle): boolean {
  const own = (v as Vehicle & { specialReady?: unknown }).specialReady;
  if (typeof own === 'boolean') return own;
  if (v.state !== 'driven') return false;
  if (v.specialGun) return v.specialGun.ready && v.shells >= v.specialCost;
  return false;
}

function drawStatus(r: Renderer, p: Player, left: boolean): void {
  const list = p.status.list;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s.def.icon) continue;
    const iw = iconW(s.def.icon) || 6;
    const ix = at(left, 80, iw);
    if (!icon(r, s.def.icon, ix, 30)) r.rect(ix, 31, 5, 5, PAL.pink[2], iconOpts);
    const total = s.def.ticks === Infinity ? 1 : s.def.ticks;
    const frac = s.ticks === Infinity ? 1 : Math.max(0, Math.min(1, s.ticks / total));
    const bx = left ? ix + iw + 2 : ix - 26;
    r.rect(bx - 1, 33, 26, 4, INK, iconOpts);
    r.rect(bx, 34, Math.round(24 * frac), 2, frac < 0.2 && blink(p.world.tick, 8) ? RED : PAL.pink[2], iconOpts);
    return;
  }
}

// ---------------------------------------------------------------------------------------------
// Timer, boss bar, Swan marker, ONWARD, callouts, banners, flashes
// ---------------------------------------------------------------------------------------------

const frameOpts: DrawOpts = { screen: true, alpha: 0.8 };

/** Frame 28×18 at (178, 2); big 2-digit counts centred at (192, 6); red blink under 10. */
function drawTimer(r: Renderer, runner: MissionRunner, ticks: number): void {
  const t = runner.timeLeft;
  if (t === Infinity) return;
  const low = t <= TUNING.timer.alarmAt;
  r.rect(178, 2, 28, 18, INK, iconOpts);
  r.rect(179, 3, 26, 16, PAL.ui[0], frameOpts);
  r.rect(179, 3, 26, 1, PAL.ui[1], iconOpts);
  const col = low && !blink(ticks) ? RED : WHITE;
  txt(r, String(Math.max(0, t)).padStart(2, '0'), 192, 6, col, 'center', 'big');
}

/** Destroyed-part counts seen per boss (a new break flashes the bar white). */
const brokenSeen = new WeakMap<Boss, { parts: number; flash: number }>();

/** Name (small, C, y 198); bar 192×4 at (96, 207): crimson = remaining HP; white flash on a part break. */
function drawBossBar(r: Renderer, runner: MissionRunner, ticks: number): void {
  const list = runner.world.byTag('boss');
  let boss: Boss | null = null;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b instanceof Boss && b.showBar && (b.state === 'fight' || b.state === 'intro')) {
      boss = b;
      break;
    }
  }
  if (!boss) return;
  let broken = 0;
  for (const p of boss.parts) if (p.destroyed) broken++;
  let seen = brokenSeen.get(boss);
  if (!seen) brokenSeen.set(boss, (seen = { parts: broken, flash: 0 }));
  if (broken > seen.parts) seen.flash = 16;
  seen.parts = broken;
  const flash = seen.flash > 0 && ticks % 4 < 2;
  if (seen.flash > 0) seen.flash--;
  const w = 192;
  const x = 96;
  const y = 207;
  txt(r, boss.name, VIEW_W >> 1, 198, GOLD, 'center');
  r.rect(x - 1, y - 1, w + 2, 6, INK, iconOpts);
  r.rect(x, y, w, 4, PAL.red[0], iconOpts);
  const fill = Math.round(w * Math.max(0, Math.min(1, boss.healthFrac)));
  if (fill > 0) {
    r.rect(x, y, fill, 4, flash ? WHITE : PAL.red[2], iconOpts);
    r.rect(x, y, fill, 1, flash ? WHITE : PAL.red[3], iconOpts);
  }
}

/**
 * GDD §13.7: while a ridden Swan's hull or rider is above the view, a 6×6 swan head with a 1 px
 * outline in the rider's colour at the top edge (y 1), at her x, kept 4 px inside the sides.
 */
function drawSwanMarkers(r: Renderer, runner: MissionRunner): void {
  const cam = runner.world.camera;
  const players = runner.players;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.state !== 'mounted' || !(p.vehicle instanceof Vehicle)) continue;
    const top = vehicleTop(p.vehicle);
    if (top >= cam.top) continue;
    drawMarker(r, Math.round(p.vehicle.x - cam.renderX), p.index);
  }
}

/** The highest point of a driven vehicle: its rider box (an open seat) or its body. */
function vehicleTop(v: Vehicle): number {
  let top = v.y + v.hitbox.y;
  const boxes: readonly Rect[] = v.hurtboxes();
  for (let i = 0; i < boxes.length; i++) if (boxes[i].y < top) top = boxes[i].y;
  // The rider's head reaches about 4 px above his hurtbox (look.md §13.5).
  return top - 4;
}

/** A swan-head marker (frame 0 = P1 sky outline, 1 = P2 gold) centred on x, top at y 1. */
export function drawMarker(r: Renderer, x: number, slot: number): void {
  const id = hasSprite('ui/swan-marker') ? 'ui/swan-marker' : 'ui/icon-life';
  const w = iconW(id) || 8;
  const left = Math.max(4, Math.min(VIEW_W - 4 - w, x - (w >> 1)));
  if (icon(r, id, left, 1, id === 'ui/swan-marker' ? slot : 0)) return;
  r.rect(left, 1, 8, 8, P_COLORS[slot] ?? WHITE, iconOpts);
  r.rect(left + 1, 2, 6, 6, PAL.snow[3], iconOpts);
}

/** The ONWARD prompt after an unlock: small `ONWARD` + three gold chevrons, blinking 20/20. */
function drawOnward(r: Renderer, hud: HudState, ticks: number): void {
  if (!hud.goVisible || !blink(ticks, 20)) return;
  const d = hud.goDir;
  const vertical = d === 'up' || d === 'down';
  const x = vertical ? VIEW_W >> 1 : d === 'left' ? 30 : 354;
  const y = d === 'up' ? 40 : d === 'down' ? 176 : 100;
  txt(r, 'ONWARD', x, y, WHITE, 'center');
  // ui/onward frames: 0 right, 1 left, 2 up, 3 down.
  const frame = d === 'right' ? 0 : d === 'left' ? 1 : d === 'up' ? 2 : 3;
  if (hasSprite('ui/onward')) {
    const f = getFrame('ui/onward', frame);
    const cy = d === 'up' ? y - f.buf.h - 3 : y + 10;
    r.sprite('ui/onward', frame, x - (f.buf.w >> 1) + f.ox, cy + f.oy, iconOpts);
  } else {
    const ch = d === 'right' ? '>' : d === 'left' ? '<' : d === 'up' ? '↑' : '↓';
    txt(r, `${ch}${ch}${ch}`, x, d === 'up' ? y - 11 : y + 10, GOLD, 'center', 'big');
  }
}

/** Centred callouts (C, y 60, 90 ticks; stacked 10 px apart when several are up). */
function drawCallouts(r: Renderer, hud: HudState): void {
  const list = hud.callouts;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.ticks < 16 && c.ticks % 4 < 2) continue; // blink out
    txt(r, c.text, VIEW_W >> 1, 60 + i * 10, c.color, 'center');
  }
}

const bandOpts: DrawOpts = { screen: true, alpha: 0.55 };

/**
 * Banners (C, big, y 90): mission banners slide in ('MISSION 1' / 'START!', 'MISSION
 * COMPLETE!'); WARNING! (red, blinking) at y 84 with the boss name (big, gold) at y 98 and the
 * subtitle (small) at y 110; other banners (TIME UP!, ALARM!, AVALANCHE! …) big and white.
 */
function drawBanner(r: Renderer, hud: HudState, ticks: number): void {
  const b = hud.banner;
  if (!b) return;
  const cx = VIEW_W >> 1;
  const age = b.total - b.ticks;
  if (b.style === 'warning') {
    if (blink(ticks)) {
      r.rect(0, 81, VIEW_W, 14, 0x40000aff, bandOpts);
      txt(r, b.text, cx, 84, RED, 'center', 'big');
    }
    if (b.sub) txt(r, b.sub, cx, 98, GOLD, 'center', 'big');
    if (b.detail) txt(r, b.detail, cx, 110, WHITE, 'center');
    return;
  }
  if (b.style === 'mission') {
    // Line 1 slides in from the left, line 2 from the right (12 ticks); the block is centred on y 90.
    const slide = age < 12 ? (12 - age) * 24 : 0;
    const y = b.sub ? 84 : 90;
    txt(r, b.text, cx - slide, y, GOLD, 'center', 'big');
    if (b.sub) txt(r, b.sub, cx + slide, 96, WHITE, 'center', b.sub.length <= 12 ? 'big' : 'small');
    if (b.detail) txt(r, b.detail, cx + slide, 108, PAL.stone[3], 'center');
    return;
  }
  txt(r, b.text, cx, b.sub ? 86 : 90, WHITE, 'center', 'big');
  if (b.sub) txt(r, b.sub, cx, 98, PAL.snow[1], 'center');
}

function drawFlash(r: Renderer, hud: HudState): void {
  const f = hud.flash;
  if (!f) return;
  r.fade(f.color, f.alpha * (f.ticks / f.total));
}

// ---------------------------------------------------------------------------------------------
// World space: score pop-ups, speech bubbles, pointer hints
// ---------------------------------------------------------------------------------------------

/** Score numbers rise 12 px over their 40 ticks at the kill point. */
function drawPopups(r: Renderer, hud: HudState): void {
  const list = hud.popups;
  worldText.color = GOLD;
  worldText.outline = INK;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const rise = Math.round(((40 - p.ticks) * 12) / 40);
    r.text(p.text, Math.round(p.x), Math.round(p.y) - rise, worldText);
  }
  worldText.outline = undefined;
}

/** Speech bubbles (gag bubbles obey SPEECH BUBBLES; hints and radio lines always show). */
function drawBubbles(r: Renderer, hud: HudState, settings: GameSettings): void {
  const list = hud.bubbles;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.kind === 'gag' && !settings.speechBubbles) continue;
    drawBubble(r, b);
  }
}

/** Small text in a white rounded box with a 3 px tail (radio lines: navy box, ivory text). */
export function drawBubble(r: Renderer, b: Bubble): void {
  const t = b.target;
  const tipX = Math.round(t.x + (b.tip ? b.tip[0] : 0));
  const tipY = Math.round(b.tip ? t.y + b.tip[1] : t.y + (t.hitbox?.y ?? -30) - b.dy);
  const lines = b.text.indexOf('\n') >= 0 ? 2 : 1;
  const w = Math.max(11, measure(b.text) + 7);
  const h = lines * 10 + 2;
  // The box sits over the tail, kept inside the view (the tail stays on the speaker).
  const camL = r.camX + 2;
  const camR = r.camX + r.w - 2;
  const x = Math.max(camL, Math.min(camR - w, tipX - (w >> 1)));
  const y = tipY - 3 - h;
  const fill = b.kind === 'radio' ? PAL.navy[1] : PAL.snow[3];
  const ink = b.kind === 'radio' ? PAL.snow[3] : INK;
  // Outline, box with rounded corners, tail.
  r.rect(x + 1, y - 1, w - 2, h + 2, INK, worldOpts);
  r.rect(x - 1, y + 1, w + 2, h - 2, INK, worldOpts);
  r.rect(x, y, w, h, INK, worldOpts);
  r.rect(x + 1, y, w - 2, h, fill, worldOpts);
  r.rect(x, y + 1, w, h - 2, fill, worldOpts);
  const tx = Math.max(x + 3, Math.min(x + w - 4, tipX));
  r.rect(tx - 1, y + h, 3, 1, fill, worldOpts);
  r.rect(tx, y + h + 1, 1, 1, fill, worldOpts);
  r.rect(tx - 2, y + h, 1, 2, INK, worldOpts);
  r.rect(tx + 2, y + h, 1, 2, INK, worldOpts);
  r.rect(tx - 1, y + h + 1, 1, 1, INK, worldOpts);
  r.rect(tx + 1, y + h + 1, 1, 1, INK, worldOpts);
  r.rect(tx, y + h + 2, 1, 1, INK, worldOpts);
  worldText.color = ink;
  r.text(b.text, x + (w >> 1), y + 2, worldText);
}

/** Pointer hints: the word over three gold chevrons pointing down at the target, blinking 30/30. */
function drawPointers(r: Renderer, hud: HudState, ticks: number): void {
  const list = hud.pointers;
  for (let i = 0; i < list.length; i++) drawPointer(r, list[i], ticks);
}

function drawPointer(r: Renderer, p: Pointer, ticks: number): void {
  if (!blink(ticks)) return;
  const t = p.target;
  const x = Math.round(t.x);
  const bottom = Math.round(t.y + (t.hitbox?.y ?? -30) - p.dy);
  // The chevrons bob 1 px toward the target.
  const bob = blink(ticks, 8) ? 0 : 1;
  let top = bottom;
  if (hasSprite('ui/onward')) {
    const f = getFrame('ui/onward', 3);
    top = bottom - f.buf.h;
    r.sprite('ui/onward', 3, x - (f.buf.w >> 1) + f.ox, top + bob + f.oy, worldOpts);
  } else {
    top = bottom - 10;
    worldText.color = GOLD;
    worldText.outline = INK;
    r.text('↓', x, top + bob, worldText);
  }
  worldText.color = WHITE;
  worldText.outline = INK;
  r.text(p.text, x, top - 9, worldText);
  worldText.outline = undefined;
}
