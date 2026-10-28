/**
 * The fork at the end of `ams` c (docs/design/floor.md §12.2 c "the fork 2400–2608"; §1.2, §3.5, §11 R1):
 * where the shop quay ends, the white bridge's ramp goes UP and the jetty steps go DOWN to the
 * tour-boat pontoon. In depth:
 *
 * - **the jetty steps** (the walk profile's two steps, 2448–2480): a stair cut into the quay from
 *   behind the bridge's far side to the near kerb line, granite treads and risers (`ams/step-tread`,
 *   `ams/step-face`); the quay beside it stays at pavement height, its walls flank the stair, the
 *   quay wall runs under its foot;
 * - **the basin** (2480 →): water over the whole band at its own level (16 px under the walk line);
 * - **the pontoon**: a box on the water — its plank deck back `PONTOON_DEEP` world px from the sprite's
 *   top edge, its two ends down to the waterline (the old front sprite is its front face);
 * - **the tour boat** waiting at the pontoon: moored along its far side (decor at `C_TOUR_DEPTH`),
 *   a box — the deck, the glass roof, the cabin's end and the stern's transom;
 * - **the white bridge** over the basin, continued in c1: its deck a plank strip from the walk plane
 *   back to `C_DECK_DEPTH`, the old sprite (railing, bulbs, arched girders, piers) its far side and
 *   the balance beams over it at the same depth (the near gallows is not drawn: it would cover the
 *   heroes, as in section a); the terrain's whitewood platform line is the deck's near edge;
 * - **the ramp** up to the deck (a walk-plane prop over walkable ground, spec §1.2): its sloped plank
 *   top back to the deck's depth and its foot's end.
 *
 * The bridge's deck and ramp are one face group anchored on the bridge sprite: their far edge lies
 * exactly on the sprite's kick rail (in its px), their near edge on the platform line (in world px).
 * Art only: the ramp, the deck, the steps and the pontoon keep their physics (terrain.ts).
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import { hash2 } from '../../../../../art/paint';
import { quadFace, topFace, wallFace } from '../../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { FaceGroupDef, FloorFeature } from '../../../../../mission/floor/types';
import { G } from '../../art';
import { C_BASIN, C_BASIN_Y, C_DECK_Y, C_PONTOON_Y, C_RAMP, C_RAMP_FOOT_Y, C_STEP, C_STEPS_X, C_W } from '../../terrain';
import { AMS_CAMERA, KERB_H, WATER } from '../layout';
import { dt, mod } from '../mat';
import { depthBehind, depthPx, ensureBandTile } from '../sides';
import { sAtDepth } from '../../../../../../engine/floor/cam';

/**
 * The white bridge's deck: from the walk plane back to its far railing (DEPTH). c1's own deck reaches 21
 * (c1/bridge.ts `C1_DECK_FAR`); here the ramp (2400–2460) runs past the corner house (facade at 14, to
 * 2411) and in front of the RONDVAART sign (2436 at 10), so the deck stops at 9. The section change to c1
 * is a cut: no seam shows (INTEGRATE-B checked both: tmp/floor-lead/integrate-b/deck/).
 */
export const C_DECK_DEPTH = 9;
/**
 * The jetty stair's far side (DEPTH): as deep as the pontoon at its foot, and behind the bridge's far
 * side (its sprite and gallows stand over the stair: no lift).
 */
export const C_STAIR_FAR = 12;
/** The pontoon's deck reaches this far back from its sprite (world px). */
export const PONTOON_DEEP = 24;
/** The tour boat lies along the pontoon's far side (2 world px of water between them), its beam (world px). */
export const C_TOUR_DEPTH = depthBehind(0, PONTOON_DEEP + 2);
export const TOUR_BEAM = 30;
/** The tour boat decor's x (section-c.ts: its stern at the pontoon's start). */
export const C_TOUR_X = C_BASIN[0] + 6;

/** The pontoon sprite's top edge (placed 1 px under the walking line, art-route.ts). */
const PONTOON_TOP_Y = C_PONTOON_Y + 1;

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

/** The depth unit's camera (the walk line at G). */
const CAM = { yh: AMS_CAMERA.yh, yw: G };

// ------------------------------------------------------------------------------- tiles

/**
 * The white bridge's deck and ramp seen from above (a = u, b = depth): weathered planks ACROSS the
 * walkway (a joint every 3.4 px of u), each plank its own shade, the nail rows over the girders.
 */
function deckTile(l: number): string {
  const id = `ams/c/deck-planks/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 34,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      const P = 3.4;
      const k = Math.floor(mod(a, 34) / P);
      const la = mod(a, 34) - k * P;
      if (la < Math.max(0.45, 1 / d)) return dt(PAL_HD.wood, 1.4, X, Y);
      // A lit edge at the far railing, the nail rows over the two girders.
      if (b < 0.8) return dt(PAL_HD.snow, 4.6, X, Y);
      let t = 4 + (hash2(k, 3, 131) - 0.5) * 0.9 + (hash2(X >> 1, Y >> 2, 132) - 0.5) * 0.3;
      if ((Math.abs(b - l * 0.25) < 0.5 || Math.abs(b - l * 0.75) < 0.5) && Math.abs(la - P / 2) < 0.6) t -= 1.2;
      return dt(PAL_HD.wood, t, X, Y);
    },
  });
  return id;
}

/** The pontoon's deck seen from above (a = along x, b = depth): brown planks along it (the sprite's top), a lit rim at the far edge. */
function pontoonTopTile(l: number): string {
  const id = `ams/c/pontoon-top/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 36,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (b < 0.9) return dt(PAL_HD.brown, 5, X, Y);
      // Planks along x, 3 px wide, the butt joints every 9 px as on the sprite's edge.
      const r = Math.floor(b / 3);
      if (b - r * 3 < Math.max(0.4, 1 / d)) return dt(PAL_HD.brown, 1.8, X, Y);
      if (mod(a + r * 4.5, 9) < Math.max(0.45, 1 / d)) return dt(PAL_HD.brown, 2.2, X, Y);
      return dt(PAL_HD.brown, 3.7 + (hash2(Math.floor((a + r * 4.5) / 9), r, 133) - 0.5) * 0.7 + (hash2(X, Y >> 1, 134) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/** The tour boat's deck (a = along x, b = depth): grey steel, a lit gunwale at the far side. */
function tourDeckTile(l: number): string {
  const id = `ams/c/tour-deck/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 16,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (b < 1.2) return dt(PAL_HD.snow, 4.6, X, Y);
      return dt(PAL_HD.steel, 3.8 + (hash2(X >> 1, Y >> 1, 135) - 0.5) * 0.4, X, Y);
    },
  });
  return id;
}

/** The tour boat's glass roof from above (a = along x, b = depth): pale panes with the sky in them, white ribs every 16 px. */
function tourRoofTile(l: number): string {
  const id = `ams/c/tour-roof/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 64,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (mod(a - 15.5, 16) < Math.max(0.7, 1 / d) || b < 0.8 || b > l - 0.9) return dt(PAL_HD.snow, 5.2, X, Y);
      const sheen = mod(a + b * 1.4, 37) < 3 ? 1 : 0;
      return dt(PAL_HD.sky, 4.3 - (b / l) * 0.9 + sheen + (hash2(X >> 2, Y >> 1, 136) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

// ------------------------------------------------------------------------------- height field

/**
 * The fork's height field: the jetty stair cut into the quay (the walk profile's two treads from
 * `C_STAIR_FAR` to the near kerb line; the quay beside it at pavement height, its walls flanking the
 * stair) and the basin's water (a cut at its own level, its quay wall under the last tread). Put them
 * after the street's features.
 */
export function forkFeatures(near: number): FloorFeature[] {
  const out: FloorFeature[] = [];
  for (let i = 0; i < 2; i++) {
    out.push({ kind: 'step', u0: C_STEPS_X + i * C_STEP, u1: C_STEPS_X + (i + 1) * C_STEP, from: C_STAIR_FAR, to: near, dh: 0, surface: 'ams/step-tread', face: 'ams/step-face' });
  }
  out.push({ kind: 'cut', u0: C_STEPS_X, u1: C_BASIN[0], to: C_STAIR_FAR, level: KERB_H, face: 'ams/quay-wall' });
  out.push({ kind: 'cut', u0: C_STEPS_X, u1: C_BASIN[0], from: near, level: KERB_H, face: 'ams/quay-wall' });
  out.push({ kind: 'cut', u0: C_BASIN[0], u1: C_BASIN[1] + 200, level: G - C_BASIN_Y, surface: WATER, face: 'ams/quay-wall' });
  return out;
}

// ------------------------------------------------------------------------------- faces

/**
 * The white bridge's deck and its ramp as one face group on the bridge sprite (decor at
 * `C_DECK_DEPTH`, its top-left on the deck line): the far edge in the sprite's px (on its kick rail),
 * the near edge in world px (on the platform line, v = 0). Drawn with the walk plane's deep list
 * (order 0): over the far side's girders, under the platform's own line.
 */
function bridgeDeck(): FaceGroupDef {
  const s = sAtDepth(CAM, C_DECK_DEPTH);
  const l = r4(depthPx(0, C_DECK_DEPTH));
  const tile = deckTile(l);
  const h = G - C_DECK_Y;
  const foot = G - C_RAMP_FOOT_Y;
  const run = C_RAMP[1] - C_RAMP[0];
  const span = C_W + 8 - C_RAMP[1];
  return {
    name: 'white bridge deck',
    x: C_RAMP[1],
    y: C_DECK_Y,
    depth: C_DECK_DEPTH,
    order: 0,
    faces: [
      // The deck: far edge on the sprite's deck line, near edge on the platform line.
      quadFace(
        [
          [0, 0, C_DECK_DEPTH],
          [span * s, 0, C_DECK_DEPTH],
          [span, h, 0, 1],
          [0, h, 0, 1],
        ],
        [
          [0, 0],
          [span, 0],
          [span, l],
          [0, l],
        ],
        tile,
      ),
      // The ramp: from its foot (8 px over the quay) up to the deck, the same planks.
      quadFace(
        [
          [-run * s, (foot - h) * s, C_DECK_DEPTH],
          [0, 0, C_DECK_DEPTH],
          [0, h, 0, 1],
          [-run, foot, 0, 1],
        ],
        [
          [-run, 0],
          [0, 0],
          [0, l],
          [-run, l],
        ],
        tile,
      ),
    ],
  };
}

/** The ramp's foot: its plank slab's end (3 px thick) facing the quay, from the walk plane back to the deck's depth. */
function rampFoot(): FaceGroupDef {
  const l = r4(depthPx(0, C_DECK_DEPTH));
  const foot = G - C_RAMP_FOOT_Y;
  const tile = ensureBandTile({ key: 'c-ramp-foot', h: 3, l, side: -1, joint: 0, bands: [[0, PAL_HD.snow, 5], [1, PAL_HD.snow, 3.6]] });
  return { name: 'ramp foot', x: C_RAMP[0], y: G, depth: 0, faces: [wallFace(0, foot - 3, foot, 0, C_DECK_DEPTH, -1, tile, l)] };
}

/**
 * The pontoon as a box on the basin (spec §12.2 c): the plank deck from the sprite's top edge back
 * `PONTOON_DEEP` world px, the ends from the deck to the waterline (the sprite's slate body, its
 * brown planks on top).
 */
function pontoon(): FaceGroupDef {
  const D = depthBehind(0, PONTOON_DEEP);
  const l = r4(depthPx(0, D));
  const top = G - PONTOON_TOP_Y;
  const h = C_BASIN_Y - PONTOON_TOP_Y;
  const w = C_BASIN[1] - C_BASIN[0];
  const end = (side: -1 | 1): string => ensureBandTile({ key: 'c-pontoon-end', h: Math.ceil(h), l, side, joint: 0, bands: [[0, PAL_HD.brown, 4.6], [2, PAL_HD.slate, 3.6]] });
  return {
    name: 'pontoon',
    x: C_BASIN[0],
    y: G,
    depth: 0,
    order: 0,
    faces: [wallFace(0.5, top - h, top, 0, D, -1, end(-1), l), wallFace(w - 0.5, top - h, top, 0, D, 1, end(1), l), topFace(0.5, w - 0.5, top, D, 0, pontoonTopTile(l), l)],
  };
}

/**
 * The tour boat at the pontoon (decor `decor/ams/ams-cruise-boat` at `C_TOUR_DEPTH`; art-route.ts:
 * the stern at x 0, the deck line at its y, the glass cabin x 40–168 up to 24 px, the waterline 4 px
 * under the deck): a box — the deck top back over its beam, the glass roof, the cabin's stern-side
 * end and the transom. Its bow lies past the section's end (c2 shows it).
 */
function tourBoat(): FaceGroupDef {
  const D0 = C_TOUR_DEPTH;
  const Dh = depthBehind(D0, TOUR_BEAM);
  const Dc = depthBehind(D0, TOUR_BEAM - 6);
  const lh = r4(depthPx(D0, Dh));
  const lc = r4(depthPx(D0, Dc));
  const len = C_W + 8 - C_TOUR_X;
  const hull = (side: -1 | 1): string => ensureBandTile({ key: 'c-tour-hull', h: 4, l: lh, side, joint: 0, bands: [[0, PAL_HD.snow, 4.8], [1.2, PAL_HD.navy, 3], [3, PAL_HD.red, 2.4]] });
  const cabin = (side: -1 | 1): string => ensureBandTile({ key: 'c-tour-cabin', h: 24, l: lc, side, joint: 16, bands: [[0, PAL_HD.snow, 4.8], [1.4, PAL_HD.sky, 4], [6, PAL_HD.sky, 3.2], [14, PAL_HD.navy, 2.4], [18, PAL_HD.snow, 4.2]] });
  return {
    name: 'tour boat at the pontoon',
    x: C_TOUR_X,
    y: C_PONTOON_Y,
    depth: D0,
    faces: [
      topFace(0.5, len, 0, Dh, D0, tourDeckTile(lh), lh),
      // The transom (the stern faces −u) from the deck to the waterline; the cabin's aft end; the glass roof.
      wallFace(0.5, -3.5, 0, D0, Dh, -1, hull(-1), lh),
      wallFace(40.5, 0, 24, D0, Dc, -1, cabin(-1), lc),
      topFace(40.5, Math.min(167.5, len), 24, Dc, D0, tourRoofTile(lc), lc),
    ],
  };
}

/** The fork's face groups: the bridge's deck and ramp, the ramp's foot, the pontoon, the tour boat. */
export function forkFaces(): FaceGroupDef[] {
  return [tourBoat(), pontoon(), bridgeDeck(), rampFoot()];
}
