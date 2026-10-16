/**
 * A small test level for the ray engine tests and the look script (tmp/fps-ray/look.ts):
 * code-generated textures and billboards under `test/ray/`, and a 16 × 12 grid with two rooms,
 * a door between them, a pillar prop and a push-wall cell.
 *
 *   x: 0123456789012345
 *   0  ################
 *   1  #......#.......#
 *   2  #......#.......#
 *   3  #..o...#.......#
 *   4  #......D.......#
 *   5  #......#.......#
 *   6  #......#....P..#
 *   7  #......#.......#
 *   8  ###.####.......#
 *   9  #......#.......#
 *  10  #......#.......#
 *  11  ################
 */
import { PAL } from '../../../src/engine/palette';
import { PixelBuffer } from '../../../src/engine/pixel';
import { CELL_PROP, CELL_PUSH, DoorTable, RayGrid } from '../../../src/engine/ray/grid';
import {
  defineRayBillboard,
  defineRayTexture,
  getRayBillboard,
  rayTextureIndex,
} from '../../../src/engine/ray/textures';
import type { RayScene, RaySprite } from '../../../src/engine/ray/view';

const T = 64;

function brick(): PixelBuffer {
  const b = new PixelBuffer(T, T).fill(PAL.stone[1]);
  for (let row = 0; row < 8; row++) {
    const y0 = row * 8;
    b.rect(0, y0 + 7, T, 1, PAL.stone[0]);
    const off = row & 1 ? 8 : 0;
    for (let x = off; x < T + 16; x += 16) b.rect((x + 15) % T, y0, 1, 7, PAL.stone[0]);
    b.rect(0, y0, T, 1, PAL.stone[2]);
  }
  return b;
}

function wood(): PixelBuffer {
  const b = new PixelBuffer(T, T).fill(PAL.brown[1]);
  for (let x = 0; x < T; x += 8) {
    b.rect(x, 0, 1, T, PAL.brown[0]);
    b.rect(x + 3, 0, 1, T, PAL.brown[2]);
  }
  // An asymmetric mark (an arrow pointing right) to see the u direction.
  b.rect(16, 28, 28, 8, PAL.gold[2]);
  b.tri(44, 20, 56, 32, 44, 44, PAL.gold[2]);
  return b;
}

function door(): PixelBuffer {
  const b = new PixelBuffer(T, T).fill(PAL.steel[2]);
  b.strokeRect(0, 0, T, T, PAL.steel[0]);
  b.rect(6, 6, 52, 52, PAL.steel[3]);
  b.rect(48, 28, 6, 8, PAL.gold[2]);
  return b;
}

function edge(): PixelBuffer {
  const b = new PixelBuffer(T, T).fill(PAL.steel[1]);
  for (let y = 0; y < T; y += 8) b.rect(0, y, T, 2, PAL.steel[0]);
  return b;
}

function pushTex(): PixelBuffer {
  const b = brick();
  b.rect(20, 20, 24, 24, PAL.red[1]);
  return b;
}

let defined = false;

/** Register the test textures and billboards (idempotent). */
export function defineTestAssets(): void {
  if (defined) return;
  defined = true;
  defineRayTexture('test/ray/brick', brick);
  defineRayTexture('test/ray/wood', wood);
  defineRayTexture('test/ray/door', door);
  defineRayTexture('test/ray/edge', edge);
  defineRayTexture('test/ray/push', pushTex);
  // A pillar: one yaw, centred column 20 px wide, full height.
  defineRayBillboard('test/ray/pillar', {
    yaws: 1,
    frames: 1,
    gen: () => {
      const b = new PixelBuffer(T, T);
      b.rect(22, 0, 20, T, PAL.sand[2]);
      b.rect(22, 0, 3, T, PAL.sand[3]);
      b.rect(39, 0, 3, T, PAL.sand[1]);
      return b;
    },
  });
  // A figure with 8 yaws: the body colour depends on the yaw (rendered 0..4), a nose marks the side.
  defineRayBillboard('test/ray/man', {
    yaws: 8,
    frames: 2,
    gen: (frame, yaw) => {
      const b = new PixelBuffer(T, T);
      const body = [PAL.green[2], PAL.olive[2], PAL.red[2], PAL.sky[2], PAL.purple[2]][yaw];
      b.rect(24, 16 + frame * 2, 16, 40, body);
      b.circle(32, 10, 7, PAL.skinA[2]);
      if (yaw >= 1 && yaw <= 3) b.rect(20, 9, 5, 3, PAL.skinA[1]); // nose to the left
      b.rect(24, 56, 6, 8, PAL.ink[0]);
      b.rect(34, 56, 6, 8, PAL.ink[0]);
      return b;
    },
  });
}

export const MAP = [
  '################',
  '#......#.......#',
  '#......#.......#',
  '#..o...#.......#',
  '#......D.......#',
  '#......#.......#',
  '#......#....P..#',
  '#......#.......#',
  '###.####.......#',
  '#......#.......#',
  '#......#.......#',
  '################',
];

export interface TestLevel {
  grid: RayGrid;
  doors: DoorTable;
  scene: RayScene;
  sprites: RaySprite[];
}

/** Build the test level (# brick wall, D vertical door, P push wall, o pillar prop + sprite). */
export function buildTestLevel(): TestLevel {
  defineTestAssets();
  const brickI = rayTextureIndex('test/ray/brick');
  const pushI = rayTextureIndex('test/ray/push');
  const g = new RayGrid(MAP[0].length, MAP.length);
  const d = new DoorTable(8);
  d.edgeTex = rayTextureIndex('test/ray/edge');
  const sprites: RaySprite[] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const ch = MAP[y][x];
      if (ch === '#') g.setWall(x, y, brickI);
      else if (ch === 'P') {
        g.setWall(x, y, pushI);
        g.flags[g.idx(x, y)] |= CELL_PUSH;
      } else if (ch === 'D') d.place(g, x, y, true, rayTextureIndex('test/ray/door'));
      else if (ch === 'o') {
        g.flags[g.idx(x, y)] |= CELL_PROP;
        sprites.push({ x: x + 0.5, y: y + 0.5, bb: getRayBillboard('test/ray/pillar'), frame: 0, yaw: 0 });
      }
    }
  }
  const scene: RayScene = {
    grid: g,
    doors: d,
    push: null,
    ceil: PAL.stone[0],
    floor: PAL.stone[2],
    sprites,
    spriteCount: sprites.length,
  };
  return { grid: g, doors: d, scene, sprites };
}

/** FNV-1a over a Uint32Array. */
export function hash32(a: Uint32Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    h = Math.imul(h ^ (v & 255), 0x01000193);
    h = Math.imul(h ^ ((v >>> 8) & 255), 0x01000193);
    h = Math.imul(h ^ ((v >>> 16) & 255), 0x01000193);
    h = Math.imul(h ^ (v >>> 24), 0x01000193);
  }
  return h >>> 0;
}
