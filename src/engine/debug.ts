/**
 * Debug flags and overlay (docs/ARCHITECTURE.md §5.13).
 *
 * Keys (only when `enabled`, e.g. with ?debug=1): F1 hitboxes, F2 stats, F3 god mode,
 * F4 'skip' action, F5 'weapons' action (the game registers handlers with `on`).
 * The overlay draws through the Renderer: terrain lines, dynamic solids, hurtboxes colour-coded
 * by team, body boxes and anchors; and a stats line (fps, tick time, entity/particle counts).
 * Timing numbers are measured by the browser loop and written into `perf`.
 */
import type { Color } from './color';
import type { Entity, Team } from './entity';
import type { InputManager } from './input';
import type { Renderer } from './render';
import type { World } from './world';

export interface DebugPerf {
  /** Frames per second (browser loop). */
  fps: number;
  /** Average simulation time per tick (ms). */
  tickMs: number;
  /** Average draw time per frame (ms). */
  drawMs: number;
}

export type DebugAction = 'skip' | 'weapons';

export const DEBUG_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5'] as const;

export const TEAM_COLORS: Readonly<Record<Team, Color>> = {
  player: 0x40ff60ff,
  enemy: 0xff4040ff,
  neutral: 0xffe040ff,
};

const COL_GROUND: Color = 0xffffffff;
const COL_PLATFORM: Color = 0xffa030ff;
const COL_SOLID: Color = 0x4080ffff;
const COL_DYNAMIC: Color = 0x40e0ffff;
const COL_HAZARD: Color = 0xc040ffff;
const COL_BODY: Color = 0xffff80ff;
const COL_KILL: Color = 0xff2020ff;

export class Debug {
  /** F-keys work only when enabled. Flags can always be set from code / URL params. */
  enabled: boolean;
  hitboxes = false;
  stats = false;
  god = false;
  /** Live timing numbers; assign the browser loop stats object here. */
  perf: DebugPerf = { fps: 0, tickMs: 0, drawMs: 0 };
  private readonly handlers: Partial<Record<DebugAction, () => void>> = {};

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  /** Register what F4 ('skip') and F5 ('weapons') do. */
  on(action: DebugAction, fn: () => void): void {
    this.handlers[action] = fn;
  }

  /** Make the keyboard swallow the F-keys (so F1 help / F5 reload do not fire). */
  reserveKeys(input: InputManager): void {
    for (const k of DEBUG_KEYS) input.reserved.add(k);
  }

  /** Call once per tick. Returns true when a debug key was handled. */
  handleInput(input: InputManager): boolean {
    if (!this.enabled) return false;
    let used = false;
    if (input.keyPressed('F1')) {
      this.hitboxes = !this.hitboxes;
      used = true;
    }
    if (input.keyPressed('F2')) {
      this.stats = !this.stats;
      used = true;
    }
    if (input.keyPressed('F3')) {
      this.god = !this.god;
      used = true;
    }
    if (input.keyPressed('F4')) {
      this.handlers.skip?.();
      used = true;
    }
    if (input.keyPressed('F5')) {
      this.handlers.weapons?.();
      used = true;
    }
    return used;
  }

  /** Copy flags that the world needs (god mode). */
  apply(world: World): void {
    world.god = this.god;
  }

  /** Draw the overlay. Call after the world was drawn, with the camera still set. */
  draw(r: Renderer, world: World | null): void {
    if (world && this.hitboxes) {
      drawTerrain(r, world);
      drawEntities(r, world);
    }
    if (this.stats) this.drawStats(r, world);
  }

  private drawStats(r: Renderer, world: World | null): void {
    const p = this.perf;
    let line = `FPS ${Math.round(p.fps)}  TICK ${p.tickMs.toFixed(2)}MS  DRAW ${p.drawMs.toFixed(2)}MS`;
    if (world) {
      line += `  ENT ${world.entities.length}  PRT ${world.particles.count}  SCR ${world.scripts.count}`;
      if (world.errors.length) line += `  ERR ${world.errors.length}`;
    }
    r.rect(0, 0, r.w, 9, 0x00000099, { screen: true });
    r.text(line, 2, 1, { font: 'small', color: 0xffffffff, screen: true });
    if (this.god) r.text('GOD', r.w - 2, 1, { font: 'small', color: 0xffe040ff, align: 'right', screen: true });
  }
}

/** 1-px rectangle outline in world space. */
export function strokeRect(r: Renderer, x: number, y: number, w: number, h: number, c: Color, alpha = 1): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const ww = Math.max(1, Math.round(w));
  const hh = Math.max(1, Math.round(h));
  const o = { alpha };
  r.rect(x0, y0, ww, 1, c, o);
  r.rect(x0, y0 + hh - 1, ww, 1, c, o);
  r.rect(x0, y0, 1, hh, c, o);
  r.rect(x0 + ww - 1, y0, 1, hh, c, o);
}

function drawTerrain(r: Renderer, world: World): void {
  const t = world.terrain;
  const x0 = r.camX - 8;
  const x1 = r.camX + r.w + 8;
  for (let i = 0; i < t.groundCount; i++) {
    if (t.gx1[i] < x0 || t.gx0[i] > x1) continue;
    r.line(t.gx0[i], t.gy0[i], t.gx1[i], t.gy1[i], COL_GROUND, { alpha: 0.8 });
  }
  for (let i = 0; i < t.capCount; i++) {
    if (t.capSX[i] >= x0 && t.capSX[i] <= x1) r.line(t.capSX[i], t.capSY[i], t.capSX[i], t.capSY[i] + 400, COL_GROUND, { alpha: 0.4 });
    if (t.capEX[i] >= x0 && t.capEX[i] <= x1) r.line(t.capEX[i], t.capEY[i], t.capEX[i], t.capEY[i] + 400, COL_GROUND, { alpha: 0.4 });
  }
  for (let i = 0; i < t.platformCount; i++) {
    if (t.px1[i] < x0 || t.px0[i] > x1) continue;
    r.line(t.px0[i], t.py0[i], t.px1[i], t.py1[i], COL_PLATFORM);
  }
  for (const s of t.solids) {
    if (s.x + s.w < x0 || s.x > x1) continue;
    strokeRect(r, s.x, s.y, s.w, s.h, COL_SOLID);
  }
  for (const h of t.hazards) {
    if (h.x + h.w < x0 || h.x > x1) continue;
    r.rect(h.x, h.y, h.w, h.h, COL_HAZARD, { alpha: 0.25 });
    strokeRect(r, h.x, h.y, h.w, h.h, COL_HAZARD);
  }
  for (const b of world.solids) strokeRect(r, b.x, b.y, b.w, b.h, COL_DYNAMIC, b.enabled ? 1 : 0.4);
  r.line(x0, t.killY, x1, t.killY, COL_KILL, { alpha: 0.6 });
}

function drawEntities(r: Renderer, world: World): void {
  const list = world.entities;
  for (let i = 0; i < list.length; i++) {
    const e: Entity = list[i];
    if (e.removed) continue;
    const col = TEAM_COLORS[e.team] ?? 0xffffffff;
    const alpha = e.dead ? 0.35 : 1;
    // Body box first, so the team colour of a coinciding hurtbox stays visible on top.
    const body = e.body;
    if (body) strokeRect(r, e.x - body.w / 2, e.y - body.h, body.w, body.h, COL_BODY, 0.6 * alpha);
    const boxes = e.hurtboxes();
    for (let k = 0; k < boxes.length; k++) {
      const b = boxes[k];
      r.rect(Math.round(b.x), Math.round(b.y), Math.max(1, Math.round(b.w)), Math.max(1, Math.round(b.h)), col, {
        alpha: 0.2 * alpha,
      });
      strokeRect(r, b.x, b.y, b.w, b.h, col, alpha);
    }
    r.rect(Math.round(e.x), Math.round(e.y), 1, 1, 0xffffffff);
  }
}
