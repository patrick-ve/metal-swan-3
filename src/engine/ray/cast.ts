/**
 * Grid ray casting (DDA) with sliding doors at the tile centre and the moving push wall.
 * No allocations: the result goes into a caller-owned `RayHit`.
 */
import { CELL_DOOR, CELL_OPAQUE, type DoorTable, type PushWall, type RayGrid } from './grid';

export interface RayHit {
  /**
   * Ray parameter t of the hit: the point is (px + t·dirX, py + t·dirY). With a unit `dir` it is
   * the distance; with `dir = camDir + plane·k` (plane ⟂ camDir, both unit) it is the
   * perpendicular distance to the camera plane (no fisheye).
   */
  dist: number;
  cellX: number;
  cellY: number;
  /** 0 = an x-side (east / west face, or a vertical door), 1 = a y-side (north / south face). */
  side: 0 | 1;
  /**
   * Texture u 0..1 (left → right as seen by the viewer). Walls: flipped per face so a texture
   * never reads mirrored. Doors: the world coordinate along the plane minus the open fraction.
   */
  u: number;
  /** Texture index of the face (0 = the magenta fallback). */
  tex: number;
  /** Door index, or −1. */
  door: number;
}

/** A fresh RayHit (allocate once, reuse). */
export function newRayHit(): RayHit {
  return { dist: 0, cellX: 0, cellY: 0, side: 0, u: 0, tex: 0, door: -1 };
}

const EPS = 1e-9;
const FAR = 1e30;

function frac(v: number): number {
  return v - Math.floor(v);
}

/**
 * Cast a ray from (px, py) along (dirX, dirY). Returns true and fills `out` when it hits a wall,
 * a closed part of a door or the push wall at t ≤ `maxDist` (default 64). Cells outside the grid
 * are hit as walls with the fallback texture. A wall in the start cell is ignored.
 */
export function castRay(
  g: RayGrid,
  d: DoorTable,
  push: PushWall | null,
  px: number,
  py: number,
  dirX: number,
  dirY: number,
  out: RayHit,
  maxDist = 64,
): boolean {
  let mx = Math.floor(px);
  let my = Math.floor(py);
  const ddx = dirX === 0 ? FAR : Math.abs(1 / dirX);
  const ddy = dirY === 0 ? FAR : Math.abs(1 / dirY);
  let stepX: number;
  let stepY: number;
  let sdx: number;
  let sdy: number;
  if (dirX < 0) {
    stepX = -1;
    sdx = (px - mx) * ddx;
  } else {
    stepX = 1;
    sdx = (mx + 1 - px) * ddx;
  }
  if (dirY < 0) {
    stepY = -1;
    sdy = (py - my) * ddy;
  } else {
    stepY = 1;
    sdy = (my + 1 - py) * ddy;
  }

  const pushOn = push !== null && push.active;
  const pax = pushOn ? push.x : -9999;
  const pay = pushOn ? push.y : -9999;
  const pbx = pushOn ? push.x + push.dx : -9999;
  const pby = pushOn ? push.y + push.dy : -9999;

  let tEnter = 0;
  let enterSide: 0 | 1 = 0;
  let prevDoor = -1;
  const limit = g.w + g.h + 4;

  for (let iter = 0; iter < limit; iter++) {
    if (tEnter > maxDist) return false;
    const tExit = sdx < sdy ? sdx : sdy;

    if (mx < 0 || my < 0 || mx >= g.w || my >= g.h) {
      return wallHit(out, px, py, dirX, dirY, tEnter, mx, my, enterSide, 0);
    }
    const i = my * g.w + mx;
    let thisDoor = -1;

    if (pushOn && ((mx === pax && my === pay) || (mx === pbx && my === pby))) {
      // The moving block: an axis-aligned unit box, tested inside this cell's t range.
      const bx = push.x + push.dx * push.offset;
      const by = push.y + push.dy * push.offset;
      let txN: number;
      let txF: number;
      let tyN: number;
      let tyF: number;
      if (dirX === 0) {
        if (px <= bx || px >= bx + 1) txN = FAR;
        else txN = -FAR;
        txF = FAR;
      } else {
        const a = (bx - px) / dirX;
        const b = (bx + 1 - px) / dirX;
        txN = a < b ? a : b;
        txF = a < b ? b : a;
      }
      if (dirY === 0) {
        if (py <= by || py >= by + 1) tyN = FAR;
        else tyN = -FAR;
        tyF = FAR;
      } else {
        const a = (by - py) / dirY;
        const b = (by + 1 - py) / dirY;
        tyN = a < b ? a : b;
        tyF = a < b ? b : a;
      }
      const tN = txN > tyN ? txN : tyN;
      const tF = txF < tyF ? txF : tyF;
      if (tN <= tF && tN >= 0 && tN >= tEnter - 1e-7 && tN < tExit + 1e-7 && tN < FAR) {
        if (tN > maxDist) return false;
        const side: 0 | 1 = txN > tyN ? 0 : 1;
        let u: number;
        if (side === 0) {
          u = py + tN * dirY - by;
          if (dirX < 0) u = 1 - u;
        } else {
          u = px + tN * dirX - bx;
          if (dirY > 0) u = 1 - u;
        }
        out.dist = tN;
        out.cellX = push.x;
        out.cellY = push.y;
        out.side = side;
        out.u = u < 0 ? 0 : u > 1 ? 1 : u;
        out.tex = push.tex;
        out.door = -1;
        return true;
      }
      // No hit: the rest of the two push cells is empty.
    } else {
      const f = g.flags[i];
      const di = g.door[i];
      if ((f & CELL_DOOR) !== 0 && di >= 0 && di < d.count) {
        thisDoor = di;
        const vert = d.vertical[di] === 1;
        const dir = vert ? dirX : dirY;
        if (dir !== 0) {
          const t = vert ? (mx + 0.5 - px) / dirX : (my + 0.5 - py) / dirY;
          if (t >= tEnter - EPS && t < tExit && t >= 0) {
            let w = vert ? py + t * dirY - my : px + t * dirX - mx;
            w = w < 0 ? 0 : w >= 1 ? 1 - EPS : w;
            const open = d.open[di];
            if (w >= open) {
              if (t > maxDist) return false;
              out.dist = t;
              out.cellX = mx;
              out.cellY = my;
              out.side = vert ? 0 : 1;
              out.u = w - open;
              out.tex = d.tex[di];
              out.door = di;
              return true;
            }
          }
        }
      } else if ((f & CELL_OPAQUE) !== 0 && iter > 0) {
        let tex = g.wall[i] - 1;
        if (tex < 0) tex = 0;
        if (prevDoor >= 0 && d.edgeTex >= 0) {
          // Jamb: a wall face seen from inside a door cell, parallel to the passage.
          const vert = d.vertical[prevDoor] === 1;
          if ((vert && enterSide === 1) || (!vert && enterSide === 0)) tex = d.edgeTex;
        }
        return wallHit(out, px, py, dirX, dirY, tEnter, mx, my, enterSide, tex);
      }
    }

    prevDoor = thisDoor;
    if (sdx < sdy) {
      tEnter = sdx;
      sdx += ddx;
      mx += stepX;
      enterSide = 0;
    } else {
      tEnter = sdy;
      sdy += ddy;
      my += stepY;
      enterSide = 1;
    }
  }
  return false;
}

function wallHit(
  out: RayHit,
  px: number,
  py: number,
  dirX: number,
  dirY: number,
  t: number,
  mx: number,
  my: number,
  side: 0 | 1,
  tex: number,
): true {
  let u: number;
  if (side === 0) {
    u = frac(py + t * dirY);
    if (dirX < 0) u = 1 - u;
  } else {
    u = frac(px + t * dirX);
    if (dirY > 0) u = 1 - u;
  }
  out.dist = t;
  out.cellX = mx;
  out.cellY = my;
  out.side = side;
  out.u = u;
  out.tex = tex;
  out.door = -1;
  return true;
}

const losHit = newRayHit();

/**
 * True when nothing opaque (wall, the closed part of a door, the push wall) lies on the segment
 * from (x0, y0) to (x1, y1). A gap in a half-open door lets sight through.
 */
export function lineOfSight(
  g: RayGrid,
  d: DoorTable,
  push: PushWall | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) return true;
  // t runs 0..1 along the segment.
  return !castRay(g, d, push, x0, y0, dx, dy, losHit, 1);
}
