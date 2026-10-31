/**
 * Art-direction trial style `arcade` (kit.ts): ARCADE 90S — the confident hand-pixeled look of a
 * cabinet sprite, rebuilt for 4K. Chunky heroic proportions (a 15 % bigger head, big hands and
 * boots, a big heavy gun), a thick outline coloured by the part it wraps, three hard hue-shifted
 * cel bands per material (cool purple / teal shadows, warm yellow lights), crisp glints, a bold
 * face (strong raised brow, heavy-lidded eyes, the smirk, the stubble as one clean band).
 *
 * How (the frame contract of `renderHuman`): every pose is painted ONCE at 4× (arcade-body.ts on
 * an HdCanvas, from the arcade skeleton, arcade-rig.ts). That drawing decides the frame: its
 * opaque box in whole logical px is the frame rectangle at every density. The 4× frame is the
 * drawing cropped to it; the 2× and the 1× frames are painted natively at their density on the
 * same canvas region, trimmed to the room inside the outline of the same box (the 1× colours
 * snapped to the nearest PAL colour). Anchor: the feet (full / lower) or the pelvis (upper);
 * points `hip`, `muzzle`, `hand`, `head` are the pixels holding the painter's continuous points.
 */
import type { Color } from '../../../../engine/color';
import { nearest } from '../../../../engine/palette';
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Density, HumanFrame, Pose, RenderPart } from '../../../art/humanoid';
import { paintPose, regionOf } from './arcade-body';
import type { ArtStyle } from './kit';

interface Geo {
  /** Canvas region (continuous anchor coords). */
  reg: { x: number; y: number; w: number; h: number };
  /** The pose as painted (a turned grounded figure gets its `dy` re-grounded). */
  pose: Pose;
  /** Frame box on the canvas, whole logical px. */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  ox: number;
  oy: number;
  pts: Record<string, readonly [number, number]>;
  buf4: PixelBuffer;
}

const memo = new Map<string, Geo>();
const MEMO_MAX = 48;

/** Counters (tools): 4× paints (the geometry), 1× / 2× paints and memo hits. */
export const ARCADE_STATS = { paints4: 0, paintsLow: 0, hits: 0 };

function geometry(pose: Pose, part: RenderPart): Geo {
  const key = `${part}|${JSON.stringify(pose)}`;
  const hit = memo.get(key);
  if (hit) {
    ARCADE_STATS.hits++;
    return hit;
  }
  let p = pose;
  let reg = regionOf(p, part);
  let painted = paintPose(p, part, 4, reg);
  ARCADE_STATS.paints4++;
  let b = painted.buf.trimBounds();
  // A turned grounded figure (falls, deaths) was solved upright: rest its lowest px on the ground
  // line again (then `dy` as asked), as the rig does.
  if (b && part !== 'upper' && pose.grounded !== false && (pose.rot ?? 0) !== 0) {
    const bottom = reg.y + (b.y + b.h) / 4;
    const want = pose.dy ?? 0;
    const sh = Math.round((want - bottom) * 4) / 4;
    if (sh !== 0) {
      p = { ...pose, dy: (pose.dy ?? 0) + sh };
      reg = regionOf(p, part);
      painted = paintPose(p, part, 4, reg);
      ARCADE_STATS.paints4++;
      b = painted.buf.trimBounds();
    }
  }
  const buf = painted.buf;
  let bx: number;
  let by: number;
  let bw: number;
  let bh: number;
  if (b) {
    bx = Math.floor(b.x / 4);
    by = Math.floor(b.y / 4);
    bw = Math.ceil((b.x + b.w) / 4) - bx;
    bh = Math.ceil((b.y + b.h) / 4) - by;
  } else {
    bx = -reg.x;
    by = -reg.y;
    bw = 1;
    bh = 1;
  }
  const ox = -reg.x - bx;
  const oy = -reg.y - by;
  const pts: Record<string, readonly [number, number]> = {};
  for (const [k, v] of Object.entries(painted.pts)) pts[k] = [Math.floor(v[0]), Math.floor(v[1])];
  const geo: Geo = { reg, pose: p, bx, by, bw, bh, ox, oy, pts, buf4: buf.crop(bx * 4, by * 4, bw * 4, bh * 4) };
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value as string);
  memo.set(key, geo);
  return geo;
}

/** Nearest PAL colour of an HD colour (cached). */
const palOf = new Map<Color, Color>();
function toPal(c: Color): Color {
  let r = palOf.get(c);
  if (r === undefined) {
    r = nearest(c) >>> 0;
    palOf.set(c, r);
  }
  return r;
}

function frameOf(pose: Pose, part: RenderPart, d: Density): HumanFrame {
  const g = geometry(pose, part);
  if (d === 4) return { buf: g.buf4.clone(), ox: g.ox, oy: g.oy, pts: g.pts, density: 4 };
  const fit = { x: g.bx * d, y: g.by * d, w: g.bw * d, h: g.bh * d };
  const painted = paintPose(g.pose, part, d, g.reg, fit);
  ARCADE_STATS.paintsLow++;
  const buf = painted.buf.crop(fit.x, fit.y, fit.w, fit.h);
  if (d === 1) {
    for (let i = 0; i < buf.data.length; i++) if ((buf.data[i] & 255) !== 0) buf.data[i] = toPal(buf.data[i]);
    buf.touch();
    return { buf, ox: g.ox, oy: g.oy, pts: g.pts };
  }
  return { buf, ox: g.ox, oy: g.oy, pts: g.pts, density: 2 };
}

export const STYLE: ArtStyle = {
  id: 'arcade',
  name: 'ARCADE 90S',
  blurb: 'Hand-pixeled arcade sprite: chunky proportions, a thick dark outline, hue-shifted cel shading and crisp highlights.',
  renderPose: (_style, pose, part, d) => frameOf(pose, part, d),
};

