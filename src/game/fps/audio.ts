/**
 * Positional sound of the first-person mode (docs/design/fps.md §9.1): an sfx at a world point
 * is panned by its angle relative to the player's facing and made quieter by distance and by
 * closed doors between it and the player.
 *
 *   pan = clamp(sin(relative angle), −0.8, 0.8)
 *   vol = max(0.15, 1 − d / 20) × (area reached ? 1 : 0.35)
 *
 * The tell sounds (`fps/enemy/aim`, `fps/dog/growl`, `fps/boss/spin-up`) use `max(0.5, vol)`, so
 * an attack from outside the view is always heard (§4.3). Cosmetic only: nothing here changes the
 * simulation. No allocations per call (one reused options object).
 */
import type { AudioOut, SfxOpts } from '../../engine/audio';
import { angDelta, angleTo, angNorm, SIN, type AreaMap, type RayGrid } from '../../engine/ray';

/** Sounds that announce an attack: never quieter than TELL_MIN_VOL. */
export const TELL_SFX: ReadonlySet<string> = new Set(['fps/enemy/aim', 'fps/dog/growl', 'fps/boss/spin-up']);
export const TELL_MIN_VOL = 0.5;
export const PAN_MAX = 0.8;
/** Distance (tiles) at which the volume reaches its floor. */
export const SOUND_REACH = 20;
export const MIN_VOL = 0.15;
/** Volume factor when the sound's area is not linked to the player's by open doors. */
export const BLOCKED_VOL = 0.35;

export interface PanVol {
  pan: number;
  vol: number;
}

/**
 * Pan and volume of a sound at (x, y) heard by a listener at (lx, ly) facing `angle`.
 * `reached` = the sound's area is linked to the listener's (open doors). Writes `out`.
 */
export function panVol(out: PanVol, lx: number, ly: number, angle: number, x: number, y: number, reached: boolean, tell = false): PanVol {
  const dx = x - lx;
  const dy = y - ly;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) out.pan = 0;
  else {
    const rel = angDelta(angle, angleTo(dx, dy));
    const s = SIN[angNorm(rel)];
    out.pan = s > PAN_MAX ? PAN_MAX : s < -PAN_MAX ? -PAN_MAX : s;
  }
  let vol = Math.max(MIN_VOL, 1 - d / SOUND_REACH) * (reached ? 1 : BLOCKED_VOL);
  if (tell && vol < TELL_MIN_VOL) vol = TELL_MIN_VOL;
  out.vol = vol;
  return out;
}

/** The listener and the sound map one floor needs (FpsGame implements it). */
export interface SoundListener {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/**
 * Plays sfx for one floor. `setListener` once per tick (after the doors moved): it computes the
 * area reach from the player's area, which the noise rule (§4.4) also reads (`reached`).
 */
export class FpsSound {
  readonly audio: AudioOut;
  private lx = 0;
  private ly = 0;
  private angle = 0;
  private areas: AreaMap | null = null;
  private grid: RayGrid | null = null;
  private doorAreaOf: ((x: number, y: number) => number) | null = null;
  /** The listener's area (0 = none, e.g. a wall cell). */
  area = 0;
  private readonly pv: PanVol = { pan: 0, vol: 1 };
  private readonly opts: SfxOpts = { vol: 1, pan: 0 };

  constructor(audio: AudioOut) {
    this.audio = audio;
  }

  /** Place the listener and flood the area reach from its cell. */
  setListener(l: SoundListener, grid: RayGrid, areas: AreaMap, doorAreaOf: (x: number, y: number) => number): void {
    this.lx = l.x;
    this.ly = l.y;
    this.angle = l.angle;
    this.grid = grid;
    this.areas = areas;
    this.doorAreaOf = doorAreaOf;
    const cx = Math.floor(l.x);
    const cy = Math.floor(l.y);
    let a = grid.inside(cx, cy) ? grid.area[grid.idx(cx, cy)] : 0;
    if (a === 0) a = doorAreaOf(cx, cy);
    this.area = a;
    areas.computeReach(a);
  }

  /** Is the area of cell (x, y) linked to the listener's area by open doors? */
  reachedCell(x: number, y: number): boolean {
    const g = this.grid;
    const areas = this.areas;
    if (!g || !areas || !g.inside(x, y)) return false;
    let a = g.area[g.idx(x, y)];
    if (a === 0 && this.doorAreaOf) a = this.doorAreaOf(x, y);
    return areas.reached(a);
  }

  /** A sound at the listener (UI-like: centred, full volume). */
  play(id: string, vol = 1): void {
    this.opts.vol = vol;
    this.opts.pan = 0;
    this.audio.sfx(id, this.opts);
  }

  /** A sound at world point (x, y). */
  at(id: string, x: number, y: number, volScale = 1): void {
    const reached = this.reachedCell(Math.floor(x), Math.floor(y));
    panVol(this.pv, this.lx, this.ly, this.angle, x, y, reached, TELL_SFX.has(id));
    this.opts.vol = this.pv.vol * volScale;
    this.opts.pan = this.pv.pan;
    this.audio.sfx(id, this.opts);
  }
}
