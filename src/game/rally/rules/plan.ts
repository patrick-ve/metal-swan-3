/**
 * The rules' plan of a track (RULES, wave B; docs/design/rally.md §4, §5; docs/api/rally.md "B.R"):
 * the anchors of TRACK's A10 (`A10Track`: gantries, speed cameras, the average-speed zone, the road
 * works, the spitsstrook, the tunnels, the S-exits, the sections) as arc OFFSETS from the start line
 * (`off` in [0, L): a car is at `dist mod L`), plus the roles the signs director gives the gantries
 * around each road-works zone (the arrow gantry, the red-X gantry, the gantries inside, the end
 * gantry) and the base speed limit of every gantry (100 on the ring, 80 in the tunnel sections).
 *
 * Built once per track (cached), pure and deterministic. A test track without anchors gives an empty
 * plan: the rules then only run the start (nothing to enforce).
 */
import type { RallyTrack } from '../api';
import { laneSide } from '../physics';

/** The anchors the rules read (TRACK's `A10Track` has them all; a test track none). Structural, so the sim never imports the lazy content. */
export interface RulesTrack {
  readonly gantries?: readonly { readonly s: number; readonly kind: string; readonly section: number }[];
  readonly cameras?: readonly { readonly s: number; readonly side: number; readonly limit: number; readonly section: number }[];
  readonly avgZone?: { readonly s0: number; readonly s1: number; readonly limit: number };
  readonly roadworks?: readonly { readonly s0: number; readonly s1: number; readonly closed: readonly number[]; readonly limit: number; readonly section: number }[];
  readonly spits?: readonly { readonly s0: number; readonly s1: number }[];
  readonly tunnels?: readonly { readonly name: string; readonly s0: number; readonly s1: number }[];
  readonly exits?: readonly { readonly code: string; readonly name: string; readonly s: number; readonly section: number }[];
  readonly sections?: readonly { readonly id: string; readonly name: string; readonly s0: number; readonly s1: number }[];
  /** TF bits at s (A10Track: tunnel 1, cutting 2, …). */
  flagsAt?(s: number): number;
}

/** The base speed limit of the ring (km/h), and of a section with a tunnel. */
export const BASE_LIMIT = 100;
export const TUNNEL_LIMIT = 80;
/** The step-down limit over the open lanes at a road works' arrow gantry (100 → 80 → 70). */
export const ARROW_LIMIT = 80;
/** A road works' red-X gantry is the last gantry within this distance before the zone (m). */
export const X_GANTRY_RANGE = 700;
/** Its arrow gantry is the gantry before the red-X gantry within this distance (m). */
export const ARROW_GANTRY_RANGE = 950;
/** The first gantry this far after a zone's end shows 'end' (m). */
export const END_GANTRY_RANGE = 400;
/** A gantry carries the spitsstrook's sign (X / green arrow) when a spitsstrook stretch starts within this distance (m) or it stands over one. */
export const SPITS_SIGN_RANGE = 250;
/** A mobile speed camera (a tripod in the works) stands this far into a zone that has no fixed camera in it (share of the zone). */
export const MOBILE_CAMERA_AT = 0.6;
/** The cones (and the taper's bodies) keep this far from the open lane's centre (m): outside a driver's corridor. */
export const CONE_CLEAR = 2.45;

/** A gantry of the plan (index = the gantry id of `A10Track.gantries` and `SignTable`). */
export interface GantryPlan {
  readonly off: number;
  readonly kind: string;
  /** The section id ('zuidas', …; '' on a track without sections). */
  readonly section: string;
  /** It carries matrix signs (every kind but 'exit': a blue direction sign). */
  readonly signs: boolean;
  /** Its base limit (km/h). */
  readonly base: number;
  /** Its shoulder sign shows the spitsstrook (X while shut, the green arrow on lap 3). */
  readonly spits: boolean;
}

export interface CameraPlan {
  readonly off: number;
  /** The table's limit (used when the car passed no sign yet). */
  readonly limit: number;
  readonly where: string;
  /** −1: a fixed camera; else the road works it belongs to (active on lap 2 only). */
  readonly works: number;
  /** Lateral position of the pole (m, + = right; the drawers'). */
  readonly side: number;
}

export interface WorksPlan {
  readonly index: number;
  readonly off0: number;
  readonly len: number;
  /** Closed lanes (0 = the left lane, 3 = the hard shoulder). */
  readonly closed: readonly number[];
  readonly limit: number;
  readonly section: string;
  /** The gantry roles (−1 = none). */
  readonly arrow: number;
  readonly x: number;
  readonly inside: readonly number[];
  readonly end: number;
  /** The lane the closed lanes merge into (the nearest open one). */
  readonly open: number;
  /** The side of the open lanes (−1 left, +1 right), the line between the closed and the open lanes, the far edge of the closed lanes, and the cones' line (`CONE_CLEAR` m from the open lane's centre). */
  readonly openDir: number;
  readonly line: number;
  readonly edge: number;
  readonly cones: number;
}

export interface RangePlan {
  readonly off0: number;
  readonly len: number;
}

export interface TunnelPlan extends RangePlan {
  readonly name: string;
}

export interface ZonePlan extends RangePlan {
  readonly limit: number;
  /** The gantries at its start and end (−1 = none). */
  readonly startGantry: number;
  readonly endGantry: number;
}

export interface ExitPlan {
  readonly off: number;
  readonly code: string;
  readonly name: string;
}

export interface RulesPlan {
  readonly L: number;
  readonly gantries: readonly GantryPlan[];
  readonly start: number;
  readonly cameras: readonly CameraPlan[];
  readonly zone: ZonePlan | null;
  readonly works: readonly WorksPlan[];
  readonly spits: readonly RangePlan[];
  readonly tunnels: readonly TunnelPlan[];
  readonly exits: readonly ExitPlan[];
  readonly sections: readonly { readonly id: string; readonly name: string; readonly off0: number; readonly len: number }[];
  /** The lane centres (0..2) and the shoulder (3), and the borders between them (m, + = right). */
  readonly laneX: readonly number[];
  readonly borders: readonly number[];
}

/** x wrapped into [0, L). */
export function wrapOff(x: number, L: number): number {
  return x - Math.floor(x / L) * L;
}

/** Is offset `off` inside the range (off0, off0 + len) on a loop of L? */
export function inRange(off: number, off0: number, len: number, L: number): boolean {
  return wrapOff(off - off0, L) < len;
}

/** The arc distance from `a` forward to `b` on a loop of L, in [0, L). */
export function ahead(a: number, b: number, L: number): number {
  return wrapOff(b - a, L);
}

const PLANS = new WeakMap<RallyTrack, RulesPlan>();

/** The plan of a track (built once per track). */
export function rulesPlan(track: RallyTrack): RulesPlan {
  let p = PLANS.get(track);
  if (!p) {
    p = buildPlan(track);
    PLANS.set(track, p);
  }
  return p;
}

function buildPlan(track: RallyTrack): RulesPlan {
  const t = track as RallyTrack & RulesTrack;
  const L = track.length;
  const off = (s: number): number => wrapOff(s - track.startS, L);
  const len = (s0: number, s1: number): number => wrapOff(s1 - s0, L);
  const sections = (t.sections ?? []).map((s) => ({ id: s.id, name: s.name, off0: off(s.s0), len: len(s.s0, s.s1) || L }));
  const secId = (i: number): string => t.sections?.[i]?.id ?? '';
  const tunnels: TunnelPlan[] = (t.tunnels ?? []).map((u) => ({ name: u.name, off0: off(u.s0), len: len(u.s0, u.s1) }));
  const spits: RangePlan[] = (t.spits ?? []).map((r) => ({ off0: off(r.s0), len: len(r.s0, r.s1) }));
  // A section with a tunnel tube in it: its gantries show 80.
  const tunnelSection = new Set<string>();
  for (let i = 0; i < sections.length; i++) {
    const sc = sections[i];
    for (const u of tunnels) if (inRange(u.off0, sc.off0, sc.len, L)) tunnelSection.add(sc.id);
  }
  const raw = t.gantries ?? [];
  const gantries: GantryPlan[] = raw.map((g) => {
    const o = off(g.s);
    const section = secId(g.section);
    let sp = false;
    for (const r of spits) if (inRange(o, r.off0, r.len, L) || ahead(o, r.off0, L) < SPITS_SIGN_RANGE) sp = true;
    return { off: o, kind: g.kind, section, signs: g.kind !== 'exit', base: tunnelSection.has(section) ? TUNNEL_LIMIT : BASE_LIMIT, spits: sp };
  });
  let start = -1;
  for (let i = 0; i < gantries.length; i++) if (gantries[i].kind === 'start') start = i;
  const signGantries = gantries.map((g, i) => (g.signs ? i : -1)).filter((i) => i >= 0);
  /** The last sign gantry at an offset in [o − range, o] (the nearest before), or −1. */
  const lastBefore = (o: number, range: number, skip = -1): number => {
    let best = -1;
    let bd = Infinity;
    for (const i of signGantries) {
      if (i === skip) continue;
      const d = ahead(gantries[i].off, o, L);
      if (d <= range && d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const laneX = [0, 1, 2, 3].map((i) => laneSide(track, Math.min(i, track.lanes), 0));
  // A test track has no shoulder offset: put it one lane beyond the last lane.
  if (!(laneX[3] > laneX[2])) laneX[3] = laneX[2] + track.laneWidth;
  const borders = [(laneX[0] + laneX[1]) / 2, (laneX[1] + laneX[2]) / 2, laneX[2] + track.laneWidth / 2];
  const works: WorksPlan[] = (t.roadworks ?? []).map((w, index) => {
    const o0 = off(w.s0);
    const ln = len(w.s0, w.s1);
    // The red-X gantry: the last one at most X_GANTRY_RANGE before the zone (or just inside its start).
    const x = lastBefore(o0 + 30, X_GANTRY_RANGE + 30);
    const arrow = x >= 0 ? lastBefore(wrapOff(gantries[x].off - 1, L), ARROW_GANTRY_RANGE - 1, x) : -1;
    const inside: number[] = [];
    for (const i of signGantries) if (i !== x && inRange(gantries[i].off, o0 + 30, Math.max(0, ln - 30), L)) inside.push(i);
    let end = -1;
    let ed = Infinity;
    for (const i of signGantries) {
      const d = ahead(o0 + ln, gantries[i].off, L);
      if (d > 0 && d <= END_GANTRY_RANGE && d < ed) {
        ed = d;
        end = i;
      }
    }
    const closed = [...w.closed].sort((a, b) => a - b);
    let open = -1;
    let od = Infinity;
    for (let lane = 0; lane < track.lanes; lane++) {
      if (closed.includes(lane)) continue;
      let d = Infinity;
      for (const c of closed) d = Math.min(d, Math.abs(c - lane));
      if (d < od) {
        od = d;
        open = lane;
      }
    }
    const openLane = Math.max(0, open);
    const openDir = closed[0] === 0 ? 1 : -1;
    let line: number;
    let edge: number;
    if (openDir > 0) {
      let hi = 0;
      for (const c of closed) if (c < 3) hi = Math.max(hi, c);
      line = borders[hi];
      edge = laneX[0] - 1.3;
    } else {
      let lo = 3;
      for (const c of closed) lo = Math.min(lo, c);
      line = borders[Math.max(0, lo - 1)];
      edge = laneX[3] + 1.2;
    }
    const cones = laneX[openLane] - openDir * CONE_CLEAR;
    return { index, off0: o0, len: ln, closed, limit: w.limit, section: secId(w.section), arrow, x, inside, end, open: openLane, openDir, line, edge, cones };
  });
  const cameras: CameraPlan[] = (t.cameras ?? []).map((c) => ({ off: off(c.s), limit: c.limit, where: secId(c.section), works: -1, side: c.side }));
  // A mobile camera in every road works that has no fixed camera inside it (or just after it).
  for (const w of works) {
    let covered = false;
    for (const c of cameras) if (c.works < 0 && inRange(c.off, w.off0, w.len + 60, L)) covered = true;
    const z = t.avgZone;
    if (z && inRange(w.off0, off(z.s0), len(z.s0, z.s1), L)) covered = true;
    if (!covered) cameras.push({ off: wrapOff(w.off0 + w.len * MOBILE_CAMERA_AT, L), limit: w.limit, where: w.section, works: w.index, side: laneX[3] + 1.6 });
  }
  let zone: ZonePlan | null = null;
  if (t.avgZone) {
    const z = t.avgZone;
    const o0 = off(z.s0);
    const ln = len(z.s0, z.s1);
    let sg = -1;
    let eg = -1;
    for (let i = 0; i < gantries.length; i++) {
      if (gantries[i].kind === 'avg-start') sg = i;
      if (gantries[i].kind === 'avg-end') eg = i;
    }
    zone = { off0: o0, len: ln, limit: z.limit, startGantry: sg, endGantry: eg };
  }
  const exits: ExitPlan[] = (t.exits ?? []).map((e) => ({ off: off(e.s), code: e.code, name: e.name }));
  return { L, gantries, start, cameras, zone, works, spits, tunnels, exits, sections, laneX, borders };
}

/** The sign lane over a side offset: 0..2 the lanes, 3 the hard shoulder (the plan's borders). */
export function signLaneAt(plan: RulesPlan, side: number): number {
  const b = plan.borders;
  return side < b[0] ? 0 : side < b[1] ? 1 : side < b[2] ? 2 : 3;
}

/** The section id at an offset ('' when the track has none). */
export function sectionAt(plan: RulesPlan, off: number): string {
  for (const s of plan.sections) if (inRange(off, s.off0, s.len, plan.L)) return s.id;
  return '';
}
