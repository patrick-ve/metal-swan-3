/**
 * The ring wagons — the UHD art (docs/ART_GUIDE.md "UHD art"): ONE density-generic drawer per
 * strip makes its 2× and 4× frames natively with the HD kit (lit height fields, PAL_HD ramps, the
 * key light from the upper left, a cool bounce, ambient occlusion where parts meet, interior
 * separations, outline A). Never the 1× art scaled.
 *
 * Every frame samples the same car as the 1× art (shape.ts `sampleGrid` at density d: one sample
 * per art px) on an `HdPiece` sized from the 1× frame of the same strip and index, so each HD frame
 * has exactly its 1× frame's logical size and anchor. Each part (the painted body, the black
 * pillars, the trim, the lamps, the rails and the rack, the spare tyre, the push bar …) is one lit
 * height field over its samples: the bevels come from the samples' heights, the face's turn from
 * their normals, the livery (camouflage, the waist band, the vinyl lettering) switches the
 * material per art px. Glass is a hole in the body frames (glints and cracks are fixed px over it).
 *
 * Look: glossy bottle-green paint with dark-green and black camouflage and lit yellow / pink vinyl
 * capitals; glossy white paint with the fluorescent orange / yellow band, the navy box and white
 * capitals; dark grey textured bumpers and rubbing strip, black pillars and seals, chrome-rimmed
 * spot lamps with grilles, a silver rack, a lying spare tyre with a red strap, a red jerrycan, a
 * black tubular push bar, the tall red tail lights with their inner bars, silver five-spoke alloys
 * and silver wheel covers in black tyres.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import type { RenderOpts, TexSample } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';
import { HdPiece, geomOf } from '../../bosses/ams/canvas';
import { bodyLook, cabinLook, flameAt, spinLook, wheelAt } from './art';
import { BODY_CANVAS, CABIN_CANVAS, ID, POSES, SPIN_CANVAS, WHEEL_HALF, type BodyState, type Livery } from './geometry';
import { LEFT_VIEW, M, PART, POSE_VIEW, sampleGrid, type Look, type SampleGrid } from './shape';

const R = PAL_HD;

/** Sprites: outline A, AO where parts meet, the thin cool rim. */
const RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };
/** The cabin (behind the glass): no outline. */
const INNER: RenderOpts = { outline: 'none', ao: 0.2, rimLight: 0 };
/** One 1× tone step in HD tone units. */
const STEP = 0.22;

/** The 1× frame i of a strip (the HD frame's geometry). */
function lo(id: string, i = 0): Frame {
  return getFrames(id, 1)[i];
}

/** Base depth of every part (separations and AO: the part behind gets the line). */
const PART_Z: Readonly<Record<number, number>> = {
  [PART.BODY]: 0,
  [PART.TRIM]: 0.6,
  [PART.PILLAR]: -0.3,
  [PART.LIGHT]: 0.4,
  [PART.MIRROR]: 2,
  [PART.RAIL]: -0.6,
  [PART.RACK]: -0.3,
  [PART.LAMP_N]: 1,
  [PART.LAMP_F]: -0.8,
  [PART.TYRE]: -0.2,
  [PART.CAN]: -0.1,
  [PART.BAR]: 3,
  [PART.BARLAMP]: 2,
  [PART.WHEEL]: -1,
  [PART.GLASS]: -0.5,
  [PART.WELL]: -3,
  [PART.CABIN]: 0,
};

/** Register the materials of a frame: M → material id. */
function materials(p: HdPiece, livery: Livery): Map<number, number> {
  const green = livery === 'green';
  const m = new Map<number, number>();
  const add = (k: number, id: number): void => {
    m.set(k, id);
  };
  add(M.PAINT, green ? p.material({ ramp: R.green, lo: 1, hi: 3, spec: 0.75, shine: 44, wrap: 0.06, bounce: 0.3 }) : p.material({ ramp: R.gable, lo: 3, hi: 6, spec: 0.85, shine: 46, wrap: 0.06, rim: 0.3, bounce: 0.3 }));
  add(M.CAMO_D, p.material({ ramp: R.moss, lo: 1, hi: 3, spec: 0.6, shine: 40, wrap: 0.06 }));
  add(M.CAMO_B, p.material({ ramp: R.black, lo: 0, hi: 3, spec: 0.6, shine: 40, wrap: 0.06 }));
  add(M.LET_Y, p.material({ ramp: R.gold, lo: 3, hi: 6, spec: 0.5, shine: 30, wrap: 0.08 }));
  add(M.LET_P, p.material({ ramp: R.pink, lo: 3, hi: 6, spec: 0.5, shine: 30, wrap: 0.08 }));
  add(M.BAND_O, p.material({ ramp: R.orange, lo: 2, hi: 5, spec: 0.4, shine: 30, wrap: 0.08 }));
  add(M.BAND_Y, p.material({ ramp: R.gold, lo: 4, hi: 6, spec: 0.4, shine: 30, wrap: 0.08 }));
  add(M.NAVY, p.material({ ramp: R.navy, lo: 1, hi: 4, spec: 0.4, shine: 30 }));
  add(M.LET_W, p.material({ ramp: R.snow, lo: 4, hi: 6, spec: 0.4, shine: 30 }));
  add(M.PLASTIC, p.material({ ramp: R.slate, lo: 1, hi: 4, spec: 0.15, shine: 12, wrap: 0.05 }));
  add(M.BLACK, p.material({ ramp: R.black, lo: 1, hi: 5, spec: 0.6, shine: 34, wrap: 0.05 }));
  add(M.GLASS, p.material({ ramp: R.glass, lo: 0, hi: 3, spec: 1, shine: 60 }));
  add(M.CHROME, p.material({ ramp: R.steel, lo: 3, hi: 6, spec: 1, shine: 44, rim: 0.4, gain: 1.1 }));
  add(M.STEEL, p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 0.8, shine: 36, rim: 0.3 }));
  add(M.RED, p.material({ ramp: R.red, lo: 3, hi: 6, spec: 1, shine: 60 }));
  add(M.AMBER, p.material({ ramp: R.orange, lo: 3, hi: 5, spec: 1, shine: 60 }));
  add(M.CLEAR, p.material({ ramp: R.glass, lo: 3, hi: 5, spec: 1, shine: 70 }));
  add(M.PLATE, p.material({ ramp: R.gold, lo: 4, hi: 6, spec: 0.5, shine: 30 }));
  add(M.WELL, p.material({ ramp: R.black, lo: 0, hi: 1, spec: 0.05, amb: 0 }));
  add(M.TYRE, p.material({ ramp: R.black, lo: 0, hi: 3, spec: 0.2, shine: 10 }));
  add(M.RIM, p.material({ ramp: R.steel, lo: 3, hi: 6, spec: 1, shine: 44, rim: 0.4, gain: 1.1 }));
  add(M.CAN, p.material({ ramp: R.red, lo: 2, hi: 5, spec: 0.5, shine: 30 }));
  add(M.PINK, p.material({ ramp: R.pink, lo: 3, hi: 6, spec: 0.4, shine: 30 }));
  add(M.LEAF, p.material({ ramp: R.green, lo: 4, hi: 6, spec: 0.3 }));
  add(M.DRINK, p.material({ ramp: R.orange, lo: 2, hi: 5, spec: 0.5 }));
  add(M.LIME, p.material({ ramp: R.green, lo: 5, hi: 7, spec: 0.3 }));
  add(M.ICE, p.material({ ramp: R.sky, lo: 4, hi: 6, spec: 0.8, shine: 50 }));
  add(M.GRILLE, p.material({ ramp: R.black, lo: 0, hi: 2, spec: 0.3 }));
  add(M.STRAP, p.material({ ramp: R.red, lo: 3, hi: 5, spec: 0.2 }));
  add(M.CABIN, p.material({ ramp: R.black, lo: 0, hi: 2, spec: 0.1, flat: true }));
  add(M.SEAT, p.material({ ramp: R.black, lo: 1, hi: 3, spec: 0.1 }));
  add(M.FAR, p.material({ ramp: R.slate, lo: 2, hi: 4, flat: true }));
  add(M.GLOVE, p.material({ ramp: R.black, lo: 1, hi: 3, spec: 0.3 }));
  return m;
}

/** Fixed colours of the fixed-px materials. */
function fixedOf(mat: number, tone: number): Color {
  switch (mat) {
    case M.GLINT:
      return tone < 0 ? R.steel[4] : R.steel[5];
    case M.CRACK:
      return R.snow[5];
    case M.PLATE_TEXT:
      return R.ink[1];
    default:
      return 0;
  }
}

/**
 * Light a sample grid onto an HdPiece: one height field per part (its samples' heights), the
 * material per art px from the sample, the face's turn on the normal, the tone, fixed px.
 */
function drawGrid(p: HdPiece, g: SampleGrid, livery: Livery, box: { x0: number; y0: number; x1: number; y1: number }): void {
  const mats = materials(p, livery);
  // Each part's bounds (art px) and its first material: one field per part over its own box.
  const bounds = new Map<number, { i0: number; j0: number; i1: number; j1: number; mat: number }>();
  for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) {
    const s = g.cells[j * g.W + i];
    if (!s || s.mat === M.HOLE || s.fixed) continue;
    const b = bounds.get(s.part);
    if (!b) bounds.set(s.part, { i0: i, j0: j, i1: i, j1: j, mat: s.mat });
    else {
      if (i < b.i0) b.i0 = i;
      if (i > b.i1) b.i1 = i;
      if (j < b.j0) b.j0 = j;
      if (j > b.j1) b.j1 = j;
    }
  }
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const d = g.d;
  for (const part of [...bounds.keys()].sort((a, b) => a - b)) {
    const b = bounds.get(part)!;
    const mat = mats.get(b.mat) ?? mats.get(M.PAINT)!;
    const fx = box.x0 + Math.floor(b.i0 / d) - 1;
    const fy = box.y0 + Math.floor(b.j0 / d) - 1;
    p.field(fx, fy, Math.ceil((b.i1 + 1) / d) - Math.floor(b.i0 / d) + 2, Math.ceil((b.j1 + 1) / d) - Math.floor(b.j0 / d) + 2, (x, y) => {
      const s = g.at(x, y);
      return s && s.part === part && !s.fixed && s.mat !== M.HOLE ? s.h : NaN;
    }, {
      mat,
      z: PART_Z[part] ?? 0,
      tex: p.tex((t: TexSample) => {
        const s = g.at(t.x, t.y);
        if (!s) return;
        const id = mats.get(s.mat);
        if (id !== undefined) t.mat = id;
        t.tone += s.tone * STEP;
        // The face's turn: the bevel normal leans with the face (a turned face takes less key light).
        if (s.nz < 0.999) {
          // Half the turn: a face turned away still reads as its own colour, only darker.
          const nx = t.nx + t.nz * s.nx * 0.5;
          const nz = t.nz * (0.5 + 0.5 * Math.max(0.05, s.nz));
          t.nx = nx;
          t.nz = nz;
        }
        // Road dust along the lower body, fine grain on the plastic at 4×.
        if (part === PART.BODY && t.y > -6.5) t.tone -= (t.y + 6.5) * 0.05;
        if (t.d >= 4 && (part === PART.TRIM || part === PART.TYRE) && hash2(t.X, t.Y, 11) > 0.82) t.tone -= 0.12;
      }),
    });
  }
  // Fixed px: glints and cracks over the glass, the plates' print.
  p.paint(box.x0, box.y0, w, h, (x, y) => {
    const s = g.at(x, y);
    return s && s.fixed ? fixedOf(s.mat, s.tone) : 0;
  }, 5);
}

/** Clear the glass holes (and the ink the outline put into them) of a rendered frame. */
function clearHoles(f: Frame, g: SampleGrid): Frame {
  const b = f.buf;
  for (let j = 0; j < g.H && j < b.h; j++) for (let i = 0; i < g.W && i < b.w; i++) {
    const s = g.cells[j * g.W + i];
    if (s && s.mat === M.HOLE) b.data[j * b.w + i] = 0;
  }
  b.touch();
  return f;
}

function renderHd(id: string, frame: number, look: Look, box: { x0: number; y0: number; x1: number; y1: number }, d: number, inner = false): Frame {
  const p = new HdPiece(geomOf(lo(id, frame)), d);
  const g = sampleGrid(look, box, d);
  drawGrid(p, g, look.livery, box);
  const f = p.frame(inner ? INNER : RENDER);
  return inner ? f : clearHoles(f, g);
}

export function bodyHd(livery: Livery, state: BodyState, pose: number, d: number): Frame {
  return renderHd(ID[livery].body[state], pose, bodyLook(livery, state, POSE_VIEW[POSES[pose]]), BODY_CANVAS, d);
}

export function leftHd(livery: Livery, frame: number, d: number): Frame {
  return renderHd(ID[livery].left, frame, bodyLook(livery, frame === 0 ? 0 : 3, LEFT_VIEW), BODY_CANVAS, d);
}

export function spinHd(livery: Livery, state: 0 | 3, k: number, d: number): Frame {
  return renderHd(ID[livery].spin[state], k, spinLook(livery, state, k), SPIN_CANVAS, d);
}

export function cabinHd(frame: number, d: number): Frame {
  const index = frame > 4 ? 5 : frame;
  return renderHd(ID.cabin, index, cabinLook(frame), CABIN_CANVAS, d, true);
}

// ---------------------------------------------------------------------------------------------
// Wheels and the flame
// ---------------------------------------------------------------------------------------------

export function wheelHd(kind: 'alloy' | 'cover', f: number, d: number): Frame {
  const id = kind === 'alloy' ? ID.green.wheel : ID.white.wheel;
  const p = new HdPiece(geomOf(lo(id, f)), d);
  const tyre = p.material({ ramp: R.black, lo: 0, hi: 3, spec: 0.25, shine: 12 });
  const rim = p.material({ ramp: R.steel, lo: 3, hi: 6, spec: 1, shine: 44, rim: 0.4, gain: 1.1 });
  const dark = p.material({ ramp: R.black, lo: 0, hi: 1, spec: 0.05, amb: 0 });
  const slot = p.material({ ramp: R.slate, lo: 0, hi: 2, spec: 0.1 });
  const n = WHEEL_HALF;
  // The tyre: a rounded sidewall with the tread's shoulder, then the rim's dish over it.
  p.field(-n, -n, 2 * n + 1, 2 * n + 1, (x, y) => {
    const r = Math.hypot(x, y);
    if (r >= 6.6 || r < 4.2) return NaN;
    return 0.6 + Math.sin(((r - 4.2) / 2.4) * Math.PI) * 0.9;
  }, {
    mat: tyre,
    z: 0,
    tex: (s) => {
      // Sidewall lettering hints at 4× (never a real brand: short arcs).
      if (s.d >= 4) {
        const r = Math.hypot(s.x - n - 2, s.y - n - 2);
        const a = Math.atan2(s.y - n - 2, s.x - n - 2);
        if (Math.abs(r - 5.6) < 0.14 && Math.sin(a * 9 + f) > 0.6) s.tone += 0.25;
      }
    },
  });
  p.field(-n, -n, 2 * n + 1, 2 * n + 1, (x, y) => {
    const w = wheelAt(kind, f, x, y, d);
    if (!w || w.mat === M.TYRE) return NaN;
    const r = Math.hypot(x, y);
    // A dished rim: the spokes rise toward the hub, the brake disc sits deep.
    if (w.mat === M.WELL || w.mat === M.GRILLE) return -0.6;
    return 1.2 - r * 0.12 + (kind === 'cover' ? Math.max(0, 1 - Math.abs(r - 2.8)) * 0.3 : 0);
  }, {
    mat: rim,
    z: 0.5,
    tex: (s) => {
      const w = wheelAt(kind, f, s.x - n - 2, s.y - n - 2, d);
      if (!w) return;
      if (w.mat === M.WELL) s.mat = dark;
      else if (w.mat === M.GRILLE) s.mat = slot;
      s.tone += w.tone * 0.15;
    },
  });
  return p.frame(RENDER);
}

export function flameHd(f: number, d: number): Frame {
  const p = new HdPiece(geomOf(lo(ID.flame, f)), d);
  const fire = p.material({ ramp: R.fire, lo: 1, hi: 7, flat: true });
  p.field(-5, -13, 11, 14, (x, y) => (flameAt(f, x, y) > 0 ? 1 : NaN), {
    mat: fire,
    z: 0,
    tex: (s) => {
      const k = flameAt(f, s.x - 7, s.y - 15);
      s.tone = (k - 2.5) * 0.3 + (s.d >= 4 ? (hash2(s.X >> 1, s.Y >> 1, f) - 0.5) * 0.08 : 0);
    },
  });
  return p.frame({ outline: 'A', ao: 0, rimLight: 0 });
}
