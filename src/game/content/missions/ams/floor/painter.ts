/**
 * The Amsterdam floor painter `ams/floor` (docs/design/floor.md §4, docs/api/floor.md §4): the top
 * surface of every `ams` floor as a pure function of world (u, v), the density and the layout
 * (layout.ts) — never of the screen or the time (spec §2.2).
 *
 * Back to front at a u: the far pavement (the quay coping at the back edge of an open quay, grey
 * tiles, the far kerb's granite top) · the street between the kerbs (the red bike lane with its
 * edge lines, dashed centre line, polished tyre lanes and bike symbols; or the cobbles; or the fan
 * of a square) · the near kerb's granite top and the near pavement. Where the lane meets the
 * cobbles a KERB CROSSING (§4.2): white shark teeth across the lane pointing at the riders who give
 * way, then a sloped granite band at 30° from the depth axis (a slanted line on screen that turns
 * with the perspective), then the cobbles cut along the band. The BIKE SYMBOL (§4.3) is painted for
 * the rider: its top points in the riding direction (near half → +u, far half → −u), its wheels lie
 * one behind the other across the lane, stretched 1.5× along it. Bridges: klinkers between granite
 * edges, the abutment quays with their coping at the canal; side canals: a granite coping at the
 * cut's edges (the water itself is the cut's tile, tiles.ts). Street logic (spec §11 R2): the kerbs
 * swerve round the pavement bulbs (layout.ts `Bulb`; no bike symbol on a bend), a STOP LINE crosses
 * the lane before a raised bridge, a steel LANDING strip crosses the street where the leaf rests, and
 * in front of a raised leaf (over the lane's far half) the bank's HINGE PIT lies under a steel plate.
 *
 * Cost (docs/api/floor.md §4: ≤ ~60 ns a texel): the layout per texture column is cached (every
 * row of a chunk visits the same columns), then a few compares and hashes per texel; no allocation.
 */
import type { Color } from '../../../../../engine/color';
import { defineFloorPainter, type FloorPaintCtx } from '../../../../mission/floor/registry';
import { hash2 } from '../../../../art/paint';
import { asphalt, clamp01, cobbles, depthLight, dt, fan, floorLight, granite, jointSand, klinkers, mix, mod, paint, STEEL, STONE, tiles } from './mat';
import {
  COPING,
  CROSS_BAND,
  CROSS_TAN,
  DECK_EDGE_FAR,
  DECK_EDGE_NEAR,
  depthAt,
  FAR_KERB_TOP,
  KERB_H,
  laneMidV,
  NEAR_KERB_TOP,
  type Bridge,
  type StreetKind,
  type StreetLayout,
} from './layout';

/** Shark teeth (world px): the gap to the band, the tooth length (along u), base width and pitch (along the band). */
export const TEETH_GAP = 1.6;
export const TOOTH_LEN = 5;
const TOOTH_BASE = 5.4;
const TOOTH_PITCH = 8.4;
/** The lane's markings stop this far (world px along u) before the teeth. */
const MARK_STOP = 3;
/** Dashed centre line: dash and period (world px along u). */
const DASH = 14;
const DASH_PERIOD = 26;
/** The bike symbol's half extent along u (world px) and the room it needs on one lane piece. */
const SYMBOL_HALF = 8;
const SYMBOL_ROOM = 34;

const KIND_LANE = 0;
const KIND_COBBLES = 1;
const KIND_FAN = 2;
const KIND_DECK = 3;
const KINDS: Readonly<Record<StreetKind, number>> = { lane: KIND_LANE, cobbles: KIND_COBBLES, fan: KIND_FAN, deck: KIND_DECK };

/** The stop line's width and the landing strip's width (world px along u). */
const STOP_W = 5;
const LANDING_W = 8;

/** Columns the per-u cache holds (a whole 4× chunk with its aprons fits). */
const CACHE = 2048;

/** The hill of the walk profile (terrain.ts `hill(len, h, 8)`): its height at u (0 outside). */
export function hillAt(b: Bridge, u: number): number {
  const t = (u - b.x0) / b.len;
  if (!(t > 0 && t < 1)) return 0;
  // The terrain's 8 straight segments (heights rounded to 0.01 like the builder).
  const n = 8;
  const i = Math.min(n - 1, Math.floor(t * n));
  const h = (k: number): number => (k <= 0 || k >= n ? 0 : Math.round(((b.h * (1 - Math.cos((k / n) * Math.PI * 2))) / 2) * 100) / 100);
  return h(i) + (h(i + 1) - h(i)) * (t * n - i);
}

/** Chain stay, seat stay, top tube, fork, seat tube, down tube, seat post, saddle, stem, grip: [C0, A0, C1, A1] each. */
const FRAME = [
  -4.5, -2.6, 0.3, -2.6,
  -4.5, -2.6, -0.8, 3.4,
  -0.8, 3.4, 3.1, 3.4,
  3.1, 3.4, 4.5, -2.6,
  -0.8, 3.4, 0.3, -2.6,
  0.3, -2.6, 3.1, 3.4,
  -0.8, 3.4, -0.6, 5.0,
  -1.9, 5.3, 0.5, 5.3,
  3.1, 3.4, 3.5, 6.3,
  3.5, 6.3, 2.4, 6.9,
];

/**
 * Is (C, A) on the bike symbol? C across the lane toward the rider's right, A along it in the
 * riding direction (world px from the symbol's centre); `wc` / `wa` the stroke half-widths across /
 * along; `k` the symbol's scale. A side-view bicycle turned for the rider: the two wheels side by
 * side across the lane (the rear one at the rider's left), the frame, the saddle and the bars toward
 * +A (the pictogram's top), stretched along the lane: 14 px across and 14.5 px along at k 1.
 */
export function onBikeSymbol(C: number, A: number, k: number, wc: number, wa: number): boolean {
  const rC = 2.5 * k;
  const rA = 4.3 * k;
  const da = A + 2.6 * k;
  for (let s = -1; s <= 1; s += 2) {
    const dc = C - s * 4.5 * k;
    const outer = (dc / (rC + wc)) ** 2 + (da / (rA + wa)) ** 2;
    if (outer > 1) continue;
    const ic = rC - wc;
    const ia = rA - wa;
    if (ic <= 0 || ia <= 0 || (dc / ic) ** 2 + (da / ia) ** 2 >= 1) return true;
  }
  for (let i = 0; i < FRAME.length; i += 4) {
    const c0 = FRAME[i] * k;
    const a0 = FRAME[i + 1] * k;
    // The closest point of the stroke in the stroke metric (C / wc, A / wa).
    const ec = (FRAME[i + 2] * k - c0) / wc;
    const ea = (FRAME[i + 3] * k - a0) / wa;
    const pc = (C - c0) / wc;
    const pa = (A - a0) / wa;
    const len2 = ec * ec + ea * ea;
    const t = clamp01(len2 > 0 ? (pc * ec + pa * ea) / len2 : 0);
    const qc = pc - ec * t;
    const qa = pa - ea * t;
    if (qc * qc + qa * qa <= 1) return true;
  }
  return false;
}

/** Signed u-offset of (u, v) from a crossing's band centre line (< 0 on the lane side). */
export function crossingOffset(u: number, v: number, cu: number, dir: number, vMid: number): number {
  return (u - (cu - dir * (v - vMid) * CROSS_TAN)) * dir;
}

defineFloorPainter('ams/floor', (c: FloorPaintCtx) => {
  const L = c.params.layout as StreetLayout;
  const d = c.d;
  const light = floorLight(L.light);
  const cam = c.cam;
  const f = cam.f;
  const k1 = cam.yw - cam.yh;
  const vBack = cam.vBack;
  const vCope = c.vAt(cam.yw - cam.back - COPING);
  const street = L.street.map((p) => ({ u0: p.u0, kind: KINDS[p.kind] }));
  const crossings = L.crossings;
  const bridges = L.bridges.map((b) => ({ u0: b.x0, u1: b.x0 + b.len, w0: b.water[0], w1: b.water[1], vF: c.vAt(b.far), vN: c.vAt(b.near) }));
  const canals = L.canals;
  const bikeEvery = L.bikes.every;
  const bikePhase = L.bikes.phase;
  /** World v per screen px on flat ground at depth v (line widths stay about one screen px). */
  const dvPerPx = (v: number): number => ((f - v) * (f - v)) / (f * k1);
  /** One texel (world px). */
  const tex = 1 / d;
  const kindAt = (u: number): number => {
    let k = street[0].kind;
    for (let i = 1; i < street.length && u >= street[i].u0; i++) k = street[i].kind;
    return k;
  };
  /** A symbol at su: its whole extent on one lane piece, away from the canals. */
  const symbolFits = (su: number): boolean => {
    for (let i = 1; i < street.length; i++) if (street[i].u0 > su - SYMBOL_ROOM && street[i].u0 <= su + SYMBOL_ROOM) return false;
    if (kindAt(su) !== KIND_LANE) return false;
    for (const [a, b] of canals) if (su + SYMBOL_ROOM > a && su - SYMBOL_ROOM < b) return false;
    for (const b of bridges) if (su + SYMBOL_ROOM > b.u0 && su - SYMBOL_ROOM < b.u1) return false;
    // Not on a bend of the kerbs (a bulb, a stretch's end): both lines straight over the symbol's room.
    const f0 = depthAt(L.far, su);
    const n0 = depthAt(L.near, su);
    for (const du of [-SYMBOL_ROOM, -SYMBOL_ROOM / 2, SYMBOL_ROOM / 2, SYMBOL_ROOM]) {
      if (depthAt(L.far, su + du) !== f0 || depthAt(L.near, su + du) !== n0) return false;
    }
    for (const st of L.stops ?? []) if (Math.abs(st.u - su) < SYMBOL_ROOM) return false;
    return true;
  };
  const stops = L.stops ?? [];
  const landings = L.landings ?? [];
  const pits = (L.hingePits ?? []).map((p) => ({ u0: p.u0, u1: p.u1, vFar: c.vAt(p.far) }));

  // ---- the per-column cache (keyed by the texture column ⌊u·d⌋)
  const tag = new Float64Array(CACHE).fill(NaN);
  const cF = new Float64Array(CACHE);
  const cN = new Float64Array(CACHE);
  const cVis = new Float64Array(CACHE);
  const cMid = new Float64Array(CACHE);
  const cFTop = new Float64Array(CACHE);
  const cNTop = new Float64Array(CACHE);
  const cSym = new Float64Array(CACHE);
  const cKind = new Int8Array(CACHE);
  const cQuay = new Int8Array(CACHE);
  const cCross = new Int8Array(CACHE);
  const cBridge = new Int8Array(CACHE);
  const cCanal = new Int8Array(CACHE);
  /** A stop line here (0 none, 1 the near half, 2 the far half, 3 both), a landing strip and a hinge pit (index + 1). */
  const cStop = new Int8Array(CACHE);
  const cLand = new Int8Array(CACHE);
  const cPit = new Int8Array(CACHE);
  /** Fill cache slot i for texture column `key` (from its centre: the layout is a function of the column alone). */
  const column = (key: number, i: number): void => {
    tag[i] = key;
    const u = (key + 0.5) / d;
    const fd = depthAt(L.far, u);
    const nd = depthAt(L.near, u);
    cF[i] = c.vAt(fd);
    cN[i] = c.vAt(nd);
    // The near kerb hides the lane's last px behind its edge: the visible lane ends here.
    cVis[i] = f - (k1 * (f - cN[i])) / (k1 - KERB_H);
    cMid[i] = laneMidV(cF[i], cN[i], f, k1);
    cFTop[i] = c.vAt(fd + FAR_KERB_TOP);
    cNTop[i] = c.vAt(nd - NEAR_KERB_TOP);
    cKind[i] = kindAt(u);
    cQuay[i] = 0;
    for (const [a, b] of L.quays) if (u >= a && u < b) cQuay[i] = 1;
    cCross[i] = -1;
    for (let k = 0; k < crossings.length; k++) if (Math.abs(u - crossings[k].u) < 40) cCross[i] = k;
    cBridge[i] = -1;
    for (let k = 0; k < bridges.length; k++) if (u >= bridges[k].u0 && u < bridges[k].u1) cBridge[i] = k;
    cCanal[i] = -1;
    for (let k = 0; k < canals.length; k++) if (u >= canals[k][0] - 4 && u < canals[k][1] + 4) cCanal[i] = k;
    cStop[i] = 0;
    for (const st of stops) if (u >= st.u && u < st.u + STOP_W) cStop[i] = st.half === 'near' ? 1 : st.half === 'far' ? 2 : 3;
    cLand[i] = 0;
    for (let k = 0; k < landings.length; k++) if (u >= landings[k] && u < landings[k] + LANDING_W) cLand[i] = k + 1;
    cPit[i] = 0;
    for (let k = 0; k < pits.length; k++) if (u >= pits[k].u0 && u < pits[k].u1) cPit[i] = k + 1;
    // The nearest bike symbol slot whose symbol is painted here (NaN: none).
    cSym[i] = NaN;
    if (bikeEvery > 0) {
      for (let side = 0; side < 2; side++) {
        const ph = bikePhase + side * bikeEvery * 0.5;
        const su = ph + Math.round((u - ph) / bikeEvery) * bikeEvery;
        if (Math.abs(u - su) <= SYMBOL_HALF && symbolFits(su)) cSym[i] = side === 0 ? su : -su - 1e6;
      }
    }
  };

  let vF = 0;
  let vN = 0;
  let vVis = 0;
  let vMid = 0;
  let vFTop = 0;
  let vNTop = 0;
  let sym = NaN;
  let stop = 0;

  /** The far pavement: the kerb's granite top, the coping at an open quay's back edge, tiles. */
  const farSide = (u: number, v: number, X: number, Y: number, lit: number, quay: boolean): Color => {
    if (v >= vFTop) return granite(u, X, Y, lit + 0.25, (vF - v) / (vF - vFTop), 18);
    if (quay && v < vCope) return granite(u, X, Y, lit - 0.1, (v - vBack) / (vCope - vBack), 17, 30);
    return tiles(u, v, X, Y, lit, d, 25);
  };

  /** The near pavement: the kerb's granite top, then tiles to the front. */
  const nearSide = (u: number, v: number, X: number, Y: number, lit: number): Color => {
    if (v < vNTop) return granite(u, X, Y, lit + 0.3, (v - vN) / (vNTop - vN), 19);
    return tiles(u, v, X, Y, lit + 0.05, d, 26);
  };

  /** The bike lane at (u, v); `s` the signed u-offset from a crossing's band (lane side < 0), or −∞. */
  const lane = (u: number, v: number, X: number, Y: number, lit: number, s: number): Color => {
    const px = dvPerPx(v);
    const lw = Math.max(1.5, 0.95 * px, tex);
    const inset = Math.max(1, 0.7 * px);
    const vc = vMid;
    // The shark teeth: a row along the band, the bases toward it, the points toward the riders.
    const t0 = CROSS_BAND / 2 + TEETH_GAP;
    if (s < -t0 && s >= -(t0 + TOOTH_LEN) && v > vF + inset && v < vVis - inset) {
      const q = (-s - t0) / TOOTH_LEN;
      const along = (v - (vF + vN) / 2) * 1.1547;
      const t = mod(along, TOOTH_PITCH) - TOOTH_PITCH / 2;
      if (Math.abs(t) < (TOOTH_BASE / 2) * (1 - q)) return paint(u, v, X, Y, lit);
    }
    // A stop line across the closed half (or both) of the lane: a wide white bar.
    if (stop !== 0 && v > vF + inset && v < vVis - inset && (stop === 3 || (stop === 1) === v >= vc)) return paint(u, v, X, Y, lit);
    if (s < -(t0 + TOOTH_LEN + MARK_STOP)) {
      // Edge lines, a px in from the kerbs; the dashed centre line.
      const e1 = v - vF;
      const e2 = vVis - v;
      if ((e1 >= inset && e1 < inset + lw) || (e2 >= inset && e2 < inset + lw)) return paint(u, v, X, Y, lit);
      if (Math.abs(v - vc) < lw * 0.45 && mod(u, DASH_PERIOD) < DASH) return paint(u, v, X, Y, lit);
      // A bike symbol (riders keep right: the near half rides toward +u, the far half toward −u).
      if (sym === sym) {
        const near = sym > -5e5;
        const su = near ? sym : -(sym + 1e6);
        const dir = near ? 1 : -1;
        const half = Math.min(vc - vF, vVis - vc);
        const k = Math.min(1, (half - inset - lw - 1.5) / 14);
        if (k > 0.55) {
          // Thin strokes (the wheels must stay open rings on screen): about 0.6 screen px, one texel at 1×.
          const wc = px * Math.max(0.3, 0.5 / d);
          const wa = Math.max(0.45, 0.5 / d);
          const sv = near ? (vc + vVis) / 2 : (vF + vc) / 2;
          if (onBikeSymbol(dir * (v - sv), dir * (u - su), k, wc, wa)) return paint(u, v, X, Y, lit);
        }
      }
    }
    // Two polished tyre lanes in the red asphalt, one in each half.
    const tq = Math.min(Math.abs(v - (vF + vc) / 2 + 1), Math.abs(v - (vc + vVis) / 2 - 1));
    return asphalt(u, v, X, Y, lit, tq < 2.4 ? 0.3 : 0);
  };

  /** Cobbles of a kind (the far side of a crossing, a square, a deck). */
  const cobbleKind = (u: number, v: number, X: number, Y: number, lit: number, k: number): Color => {
    if (k === KIND_FAN) return fan(u, v, X, Y, lit, d);
    if (k === KIND_DECK) return klinkers(u, v, X, Y, lit, d);
    return cobbles(u, v, X, Y, lit, d);
  };

  /** The street between the kerbs. */
  const streetAt = (u: number, v: number, X: number, Y: number, lit: number, kind: number, cross: number): Color => {
    if (cross >= 0) {
      const x = crossings[cross];
      const s = crossingOffset(u, v, x.u, x.dir, (vF + vN) / 2);
      if (s >= CROSS_BAND / 2) return cobbleKind(u, v, X, Y, lit, kindAt(x.u + x.dir * 20));
      if (s > -CROSS_BAND / 2) {
        // The sloped kerb: a short face toward the lane, the lit granite top, a dark joint at the cobbles.
        const q = (s + CROSS_BAND / 2) / CROSS_BAND;
        if (q < 0.24) return dt(STONE, (q < 0.09 ? 2.2 : 3.1) + lit, X, Y);
        if (q > 0.88) return jointSand(X, Y, lit);
        return granite(v * 1.1547, X, Y, lit + 0.55, (q - 0.24) / 0.64, 21, 18);
      }
      return lane(u, v, X, Y, lit, s);
    }
    if (kind === KIND_LANE) return lane(u, v, X, Y, lit, -Infinity);
    // A straight joint where two cobble surfaces meet (a square's edge): a granite band 2.4 px wide.
    for (let i = 1; i < street.length; i++) {
      const b = street[i].u0;
      if (u >= b - 1.2 && u < b + 1.2 && street[i - 1].kind !== KIND_LANE && street[i].kind !== KIND_LANE) {
        return granite(v * 2, X, Y, lit + 0.2, (u - b + 1.2) / 2.4, 23, 12);
      }
    }
    return cobbleKind(u, v, X, Y, lit, kind);
  };

  /** A bridge: the deck (klinkers, granite edges and thresholds) or its abutment quays (tiles, the coping at the canal). */
  const bridgeAt = (u: number, v: number, X: number, Y: number, lit: number, k: number, quay: boolean): Color => {
    const br = bridges[k];
    if (v >= br.vF && v < br.vN) {
      if (v < br.vF + DECK_EDGE_FAR) return granite(u, X, Y, lit + 0.2, (v - br.vF) / DECK_EDGE_FAR, 27, 22);
      if (v >= br.vN - DECK_EDGE_NEAR) return granite(u, X, Y, lit + 0.3, (br.vN - v) / DECK_EDGE_NEAR, 28, 22);
      if (u < br.u0 + 2.4 || u >= br.u1 - 2.4) return granite(v * 2, X, Y, lit + 0.25, 0.5, 29, 14);
      return klinkers(u, v, X, Y, lit, d);
    }
    // An abutment quay: the canal's coping along its edges, the quay's coping at the back, tiles.
    if (u >= br.w0 - 3.4 && u < br.w0) return granite(v, X, Y, lit + 0.1, (br.w0 - u) / 3.4, 30, 24);
    if (u >= br.w1 && u < br.w1 + 3.4) return granite(v, X, Y, lit + 0.1, (u - br.w1) / 3.4, 30, 24);
    if (quay && v < vCope) return granite(u, X, Y, lit - 0.1, (v - vBack) / (vCope - vBack), 17, 30);
    return tiles(u, v, X, Y, lit, d, v < br.vF ? 25 : 26);
  };

  /**
   * A hinge pit in front of a raised leaf (the near half of its footprint), walked over: a steel tread
   * plate over the pit the leaf's tail swings into — the lit nose at the water, a dark slot along the
   * leaf and at the asphalt, a row of bolts.
   */
  const hingePit = (u: number, v: number, X: number, Y: number, lit: number, p: { u0: number; u1: number; vFar: number }): Color => {
    const q = p.u1 - u;
    if (q < 1.2) return dt(STEEL, 5.2 + lit, X, Y);
    if (v - p.vFar < 1 || u - p.u0 < 0.8) return dt(STEEL, 0.8 + lit * 0.5, X, Y);
    if (q > 2.2 && q < 3.2 && mod(v, 5) < 1) return dt(STEEL, 5.6 + lit, X, Y);
    return dt(STEEL, 3 + lit + ((X + Y) & 2 ? 0.5 : 0) + (hash2(X, Y, 43) - 0.5) * 0.4, X, Y);
  };

  return (u: number, v: number): Color => {
    const key = Math.floor(u * d);
    const i = key & (CACHE - 1);
    if (tag[i] !== key) column(key, i);
    vF = cF[i];
    vN = cN[i];
    vVis = cVis[i];
    vMid = cMid[i];
    vFTop = cFTop[i];
    vNTop = cNTop[i];
    sym = cSym[i];
    stop = cStop[i];
    const X = key;
    const Y = Math.floor(v * d);
    // The kits' depth of v on flat ground → the light over the floor's depth.
    const lit = depthLight((-k1 * v) / (f - v)) + light.tone;
    const quay = cQuay[i] === 1;
    const br = cBridge[i];
    const cn = cCanal[i];
    let col: Color;
    if (br >= 0) col = bridgeAt(u, v, X, Y, lit, br, quay);
    else if (cPit[i] > 0 && v >= pits[cPit[i] - 1].vFar && v < vN + 1) col = hingePit(u, v, X, Y, lit, pits[cPit[i] - 1]);
    else if (cLand[i] > 0 && v >= vF - 1 && v < vN + 1) {
      // A raised leaf's landing across the street: a steel strip with a lit edge toward the water and bolts.
      const q = u - landings[cLand[i] - 1];
      // The lit nose at the water, the bearing plate with its bolts, the expansion joint, then the abutment.
      const bolt = q > 2 && q < 3.2 && mod(v, 6) < 1.2;
      if (q > LANDING_W - 1.4) col = jointSand(X, Y, lit - 0.6);
      else col = bolt ? dt(STEEL, 5.6 + lit, X, Y) : dt(STEEL, (q < 1.2 ? 5 : q < 4.6 ? 3.4 : 2.4) + lit + (hash2(X, Y, 41) - 0.5) * 0.5, X, Y);
    } else if (cn >= 0) {
      // The coping along a side canal's edge (across the whole band); the water is the cut's tile.
      const [a, b] = canals[cn];
      col = u < a ? granite(v, X, Y, lit + 0.1, (a - u) / 4, 31, 24) : u >= b ? granite(v, X, Y, lit + 0.1, (u - b) / 4, 31, 24) : dt(STONE, 1.5, X, Y);
    } else if (v < vF) col = farSide(u, v, X, Y, lit, quay);
    else if (v >= vN) col = nearSide(u, v, X, Y, lit);
    else col = streetAt(u, v, X, Y, lit, cKind[i], cCross[i]);
    return mix(col, light.tint, light.k);
  };
});
