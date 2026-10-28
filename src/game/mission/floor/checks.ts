/**
 * The floor's checks (docs/design/floor.md §7, §8 gates 4 and 5): the walk line, the platforms'
 * drawn edges, the background factor rule and the front-row rules. Pure; the tests run them on
 * every section with a floor (a new floor joins them automatically), the review runs them too.
 */
import { meshHeightAt } from '../../../engine/floor/mesh';
import { frameW } from '../../../engine/render';
import { Terrain } from '../../../engine/terrain';
import type { World } from '../../../engine/world';
import type { Player } from '../../player/player';
import type { SectionDef } from '../types';
import { floorOf } from './registry';
import { SectionFloor, type FrontBox } from './section-floor';
import type { FloorDef } from './types';

/** Front rows: props at least this far apart (world px). */
export const FRONT_MIN_GAP = 34;
/** Front rows: thin props only (logical px at the row's scale). */
export const FRONT_MAX_W = 8;
/** Front rows: a prop's top stays below G − FRONT_TOP_ABOVE on screen (legs only). */
export const FRONT_TOP_ABOVE = 14;
/** Front rows: never within this of a spawn point, a pickup, a hostage or a script door. */
export const FRONT_CLEAR = 24;

/** A section's floor built for a check (no GPU, nothing drawn). */
export function checkFloor(section: SectionDef, def?: FloorDef): SectionFloor | null {
  const d = def ?? floorOf(section);
  if (!d) return null;
  return new SectionFloor(section, d, new Terrain(section.terrain), 1, `check/${section.id}/`);
}

export interface WalkLineError {
  u: number;
  /** The drawn floor's height at v = 0 and the physics surface's (h = yw − groundY). */
  drawn: number;
  physics: number;
}

/**
 * Gate 4: every u (every `step` px) where the DRAWN floor at v = 0 (the mesh) is more than `tol` off
 * the physics walk surface (pits are skipped: no surface there).
 */
export function walkLineErrors(section: SectionDef, def?: FloorDef, tol = 0.5, step = 1): WalkLineError[] {
  const floor = checkFloor(section, def);
  if (!floor) return [];
  const t = new Terrain(section.terrain);
  const out: WalkLineError[] = [];
  for (let u = 0.5; u < section.width; u += step) {
    const g = t.groundY(u);
    if (!Number.isFinite(g)) continue;
    const physics = floor.cam.yw - g;
    const drawn = meshHeightAt(floor.mesh, u, 0);
    if (!(Math.abs(drawn - physics) <= tol)) out.push({ u, drawn, physics });
  }
  return out;
}

/** Gate 4: canopies and slabs whose front edge is not on a platform line (x0…x1 at y). */
export function overhangErrors(section: SectionDef, def?: FloorDef): string[] {
  const d = def ?? floorOf(section);
  if (!d) return [];
  const t = new Terrain(section.terrain);
  const out: string[] = [];
  for (const o of d.overhangs ?? []) {
    for (let x = o.x0 + 1; x < o.x1 - 1; x += 4) {
      const py = t.platformY(x, o.y - 1, o.y + 1);
      if (!(Math.abs(py - o.y) <= 0.5)) {
        out.push(`${o.kind} ${o.x0}-${o.x1} @y${o.y}: no platform at x ${x}`);
        break;
      }
    }
  }
  return out;
}

/** Gate 5 (§1.3): lifted background layers must scroll slower than the floor's back edge. */
export function factorViolations(section: SectionDef, def?: FloorDef): string[] {
  const floor = checkFloor(section, def);
  if (!floor) return [];
  const out: string[] = [];
  for (const l of section.background?.layers ?? []) {
    if (l.front || !floor.isLifted(l)) continue;
    if (!(l.factorX < floor.sBack)) out.push(`${l.gen}: factorX ${l.factorX} ≥ s(back edge) ${floor.sBack.toFixed(3)}`);
  }
  return out;
}

/** One front-row prop as the rules see it (flat-ground screen numbers at the row's scale). */
export interface FrontProp {
  row: string;
  u: number;
  depth: number;
  /** Logical width and the screen y of its top on flat ground. */
  w: number;
  top: number;
}

/** Every front-row prop of a section's floor (the static front-row rules; gate 5's bot test: `frontCoverHits`). */
export function frontRowProps(section: SectionDef, def?: FloorDef): FrontProp[] {
  const floor = checkFloor(section, def);
  if (!floor) return [];
  const out: FrontProp[] = [];
  floor.rows.forEach((row, i) => {
    if (row.depth >= 0) return;
    const f = floor.rowFrame(row, 1);
    if (!f) return;
    const w = frameW(f);
    const top = floor.cam.yw - row.depth - f.oy;
    for (const u of row.u) out.push({ row: row.def.name ?? `row ${i}`, u, depth: row.depth, w, top });
  });
  return out;
}

/** The box of a hero's head: the top of its hitbox, HEAD_H logical px (at most 40 % of it: a crouch). */
export const HEAD_H = 10;
/** Half the size of the box around a hero's gun muzzle. */
export const GUN_R = 3;

/**
 * Gate 5 (spec §3.6, §8): everything the floor draws OVER the world (front decor, the props of front
 * rows, front face groups, the entities' faces in front of the walk plane: `SectionFloor.frontBoxes`)
 * that covers a hero's head (the top HEAD_H px of
 * its hitbox) or its gun (the muzzle ± GUN_R) for the world's camera now; one line per hit. The test
 * runs the bot through every floor section and checks every few frames.
 */
export function frontCoverHits(floor: SectionFloor, world: World): string[] {
  const camX = world.camera.viewX;
  const camY = world.camera.viewY;
  const boxes = floor.frontBoxes(camX, camY, world);
  const out: string[] = [];
  const muzzle: [number, number] = [0, 0];
  for (const e of world.players) {
    const p = e as Player;
    if (!p.alive || p.state !== 'play') continue;
    const hit = p.hitRect();
    const hx0 = hit.x - camX;
    const hy0 = hit.y - camY;
    const hh = Math.min(HEAD_H, hit.h * 0.4);
    p.muzzleWorld(muzzle);
    const gx = muzzle[0] - camX;
    const gy = muzzle[1] - camY;
    for (const b of boxes) {
      if (covers(b, hx0, hy0, hx0 + hit.w, hy0 + hh)) out.push(`${b.what} covers a head`);
      if (covers(b, gx - GUN_R, gy - GUN_R, gx + GUN_R, gy + GUN_R)) out.push(`${b.what} covers a gun`);
    }
  }
  return out;
}

/** Does front box b cover any of [x0, x1) × [y0, y1) (its frame: with an opaque pixel there)? */
function covers(b: FrontBox, x0: number, y0: number, x1: number, y1: number): boolean {
  const ix0 = Math.max(b.x0, x0);
  const iy0 = Math.max(b.y0, y0);
  const ix1 = Math.min(b.x1, x1);
  const iy1 = Math.min(b.y1, y1);
  if (!(ix0 < ix1 && iy0 < iy1)) return false;
  const f = b.f;
  if (!f) return true;
  const d = f.density ?? 1;
  const buf = f.buf;
  for (let y = Math.floor((iy0 - b.y0) * d); y < Math.ceil((iy1 - b.y0) * d) && y < buf.h; y++) {
    for (let x = Math.floor((ix0 - b.x0) * d); x < Math.ceil((ix1 - b.x0) * d) && x < buf.w; x++) {
      const bx = b.flip ? buf.w - 1 - x : x;
      if (y >= 0 && bx >= 0 && bx < buf.w && (buf.data[y * buf.w + bx] & 255) > 64) return true;
    }
  }
  return false;
}

/**
 * The front-row rules (§3.6): props ≥ FRONT_MIN_GAP apart, ≤ FRONT_MAX_W wide, their top below
 * G − FRONT_TOP_ABOVE, and ≥ FRONT_CLEAR from the spots the section names: its player start, its
 * exits' doors and `FloorDef.keepClear` (the kit lists the script's spawn points, pickups,
 * hostages and doors there; the script itself cannot be read).
 */
export function frontRowViolations(section: SectionDef, def?: FloorDef): string[] {
  const d = def ?? floorOf(section);
  if (!d) return [];
  const props = frontRowProps(section, d);
  const out: string[] = [];
  const yw = d.camera.yw ?? 176;
  const spots: number[] = [section.playerStart.x, ...(d.keepClear ?? [])];
  for (const ex of section.exits ?? []) spots.push(ex.rect.x + ex.rect.w / 2);
  const byRow = new Map<string, FrontProp[]>();
  for (const p of props) {
    const l = byRow.get(p.row) ?? [];
    l.push(p);
    byRow.set(p.row, l);
  }
  for (const [name, list] of byRow) {
    list.sort((a, b) => a.u - b.u);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (i > 0 && p.u - list[i - 1].u < FRONT_MIN_GAP) out.push(`${name}: props at u ${list[i - 1].u} and ${p.u} are closer than ${FRONT_MIN_GAP}`);
      if (p.w > FRONT_MAX_W) out.push(`${name}: prop at u ${p.u} is ${p.w} px wide (max ${FRONT_MAX_W})`);
      if (p.top < yw - FRONT_TOP_ABOVE) out.push(`${name}: prop at u ${p.u} reaches y ${p.top.toFixed(1)} (above G − ${FRONT_TOP_ABOVE})`);
      for (const s of spots) if (Math.abs(p.u - s) < FRONT_CLEAR) out.push(`${name}: prop at u ${p.u} is within ${FRONT_CLEAR} px of a kept spot at ${s}`);
    }
  }
  return out;
}
