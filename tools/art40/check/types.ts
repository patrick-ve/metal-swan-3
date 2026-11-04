/**
 * The baked set format as the check reads it (structurally the same as `BakedSet` in
 * src/engine/baked.ts; tools/art40/README.md "The baked format"). Kept local so the check
 * and its tests do not depend on the engine loader's build order.
 */

export interface CheckFrame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** The pixel stream (format v2): character pairs (run length - 1, palette index), row-major (decode.ts). */
  px: string;
  pts?: Readonly<Record<string, readonly [number, number]>>;
  smear?: true;
}

export interface CheckStrip {
  frames: readonly CheckFrame[];
  durations: readonly number[];
  loop: boolean;
  defer?: true;
  cls?: string;
  why?: string;
  /** The way this strip's unflipped frames face when it differs from the set's `face`. */
  face?: 1 | -1;
}

/** One frame's full joint track (rig joints and points, relative to the anchor): the bake's sidecar. */
export type JointFrame = Readonly<Record<string, readonly [number, number]>>;

export interface CheckSet {
  v: number;
  slug: string;
  prefix: string;
  budget: number;
  /** The way the unflipped frames face (+1 right, -1 left): the direction a walk cycle moves. */
  face?: 1 | -1;
  pal: readonly string[];
  outline: number;
  hl?: readonly number[];
  /** Indices of the shared FX ramp (flashes, flames): in the palette, outside the budget. */
  fx?: readonly number[];
  variants?: Readonly<Record<string, readonly string[]>>;
  strips: Readonly<Record<string, CheckStrip>>;
  events?: Readonly<Record<string, number>>;
  /**
   * Not shipped: the joint track per strip and frame from the bake's sidecar
   * (tools/art40/joints/<slug>.json, loaded by load.ts). The smoothness gate measures every joint.
   */
  joints?: Readonly<Record<string, readonly JointFrame[]>>;
}

export type Gate = 'format' | 'colour' | 'outline' | 'orphan' | 'aa' | 'class' | 'contract' | 'foot' | 'smooth';

export const GATES: readonly Gate[] = ['format', 'colour', 'outline', 'orphan', 'aa', 'class', 'contract', 'foot', 'smooth'];

export type Level = 'fail' | 'warn' | 'info';

export interface Finding {
  gate: Gate;
  level: Level;
  /** Strip name (not the full id). */
  strip?: string;
  frame?: number;
  msg: string;
}

export type GateState = 'pass' | 'warn' | 'fail' | 'skip';

export interface SetReport {
  slug: string;
  prefix: string;
  budget: number;
  /** Distinct colours in the palette (index 0 excluded). */
  colours: number;
  /** Most colours used by one frame. */
  maxFrameColours: number;
  strips: number;
  frames: number;
  /** Share of outer edge pixels that use the outline index (0..1). */
  outlineShare: number;
  /** Lowest per-strip outline share and its strip. */
  minStripOutline: { strip: string; share: number } | null;
  orphans: number;
  halos: number;
  /** Largest point travel per displayed tick (px) outside smear frames, and where. */
  worstTravel: { strip: string; step: number; point: string; perTick: number } | null;
  /** Largest planted-foot drift (px) over a plant, and where. */
  worstDrift: { strip: string; drift: number } | null;
  gates: Record<Gate, GateState>;
  findings: Finding[];
}
