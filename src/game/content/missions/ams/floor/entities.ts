/**
 * The faces of the `ams` entities in perspective (docs/design/floor.md §12.1 item 4, §11 R1;
 * docs/api/floor.md §8.2): what moves or breaks cannot be a static face group, so each kind below is
 * an `EntityFacesDef` — the entity draws its faces itself (`drawFloorFaces` → `drawEntityFaces`),
 * render only, on a floor that lists its kind in `FloorDef.entityFaces`, before and after it breaks
 * (a wreck draws none). `amsEntityFaces([...kinds], opts)` builds the map for a FloorDef:
 *
 * | kind | faces |
 * |---|---|
 * | `crate` | the lid (planks, the rope straps over it) and the two sides; the Legion crate in crimson (state 2) |
 * | `ams-bike-rack` | the rack's two ends (the steel hoops seen end-on) |
 * | `ams-tulip-stall` | the striped awning's top and cheeks, the wooden stand's ends |
 * | `ams-herring-cart` | the roof's top and edges, the kiosk's ends (white, the blue HARING band) |
 * | `ams-market-stall` | the awning's top and cheeks, the table top and the skirt's ends |
 * | `ams-boat-platform`, `ams-party-boat` | the small boat's open hull and its ends (boat.ts) |
 * | `ams-tour-boat` | the deck, the glass cabin's roof and ends, the hull's ends (mirrored with the boat) |
 * | `ams-cruise-boat` | the deck, the glass roof, the cabin's ends, the stern and the raked bow |
 * | `ams-magere-brug` | the bascule: closed, its walkway top and slab ends; lifting (frames 1–3), the leaves' walkways (a leaf seen edge-on left out) |
 * | `ams-low-bridge` | the walkway's top, the slab's ends and the piers' sides down to the water |
 * | `ams-scan-car` | the parking scan car (c's mid-boss) as a box: the roof, the windscreen and the bonnet seen from above, the front and the tailgate (the end toward the screen's centre shows); the wreck draws none |
 * | `ams-secret` | by look: the museum crate `NIET OPENEN` (b) a pine box, its lid and sides (open too: the front falls, the box stays); the flea-market chest (d) its domed lid and banded sides, open its body's sides; every other look none |
 *
 * Every face lies behind its sprite (depths ≥ 0, receding from the sprite's plane); the bridges take
 * an optional `front` depth (< 0) to span the band to the front too (drawn over the world). Sizes from
 * the 1× art (npc.art.ts, art-route.ts, crate.art.ts: the dense art keeps their logical boxes), the
 * faces' edges half a px inside the outline. Lit from the left (the sides.ts rule: a left side in the
 * sun, a right one in shade).
 */
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../engine/pixel';
import { hash2 } from '../../../../art/paint';
import { quadFace, slopeFace, topFace, wallFace, type FaceSide } from '../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import type { EntityFacesDef, FaceDef } from '../../../../mission/floor/types';
import { MAGERE_ANGLES } from '../art-route';
import { CRUISE, LOW_BRIDGE, MAGERE_BRUG } from '../cruise';
import { G } from '../art';
import { AMS_BACK, WATER_LEVEL } from './layout';
import { dt, klinkers, mod } from './mat';
import { rowboatFaces } from './boat';
import { depthBehind, depthPx, ensureBandTile } from './sides';

/** The kinds this kit gives faces. */
export type AmsFacedKind =
  | 'crate'
  | 'ams-bike-rack'
  | 'ams-tulip-stall'
  | 'ams-herring-cart'
  | 'ams-market-stall'
  | 'ams-boat-platform'
  | 'ams-party-boat'
  | 'ams-tour-boat'
  | 'ams-cruise-boat'
  | 'ams-magere-brug'
  | 'ams-low-bridge'
  | 'ams-scan-car'
  | 'ams-secret';

/** The breakables and the crate: what a street section usually lists. */
export const AMS_STREET_FACED: readonly AmsFacedKind[] = ['crate', 'ams-bike-rack', 'ams-tulip-stall', 'ams-herring-cart', 'ams-market-stall'];

/** Depths of the boxes (world px behind the sprite's plane). */
const CRATE_DEEP = 18;
const STALL_DEEP = 22;
const CART_DEEP = 18;
const RACK_DEEP = 7;
/** The scan car's width (world px behind its sprite's plane): its far side a little past the far kerb (c's house stretch, 5). */
const CAR_DEEP = 16;

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);
/** Tone shift of a side: −1 left (toward the sun), +1 right (in shade) — sides.ts. */
const SHADE = (side: FaceSide): number => (side < 0 ? -0.15 : -1.25);

// ------------------------------------------------------------------------------- tiles

/** A wooden crate's side (a = down from the lid, b = back from the front edge): planks, the back corner post. */
function crateSideTile(look: 'supply' | 'legion', side: FaceSide, l: number): string {
  const id = `ams/ent/crate-side/${look}/${side < 0 ? 'l' : 'r'}/${l}`;
  if (hasFloorTile(id)) return id;
  const ramp = look === 'legion' ? PAL_HD.red : PAL_HD.wood;
  const base = look === 'legion' ? 3.6 : 4.1;
  const sh = SHADE(side);
  defineFloorTile(id, {
    w: 20,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      // The back corner post (a darker joint in front of it), the lid's edge along the top.
      if (b > l - 2.4) return dt(ramp, (b > l - 0.7 ? base - 1.6 : base - 0.4) + sh, X, Y);
      if (b > l - 2.9) return dt(ramp, base - 2.2 + sh, X, Y);
      if (a < 1.2) return dt(ramp, base + 0.7 + sh, X, Y);
      if (mod(a - 1.2, 4.6) < Math.max(0.5, 1 / d)) return dt(ramp, base - 2 + sh, X, Y);
      const plank = Math.floor((a - 1.2) / 4.6);
      return dt(ramp, base + sh + (hash2(plank, Math.floor(b / 7), 81) - 0.5) * 0.7 + (hash2(X, Y >> 1, 82) - 0.5) * 0.4, X, Y);
    },
  });
  return id;
}

/** A crate's lid (a = along x from its left edge, b = from its far edge): boards along u, the straps across. */
function crateTopTile(look: 'supply' | 'legion', l: number): string {
  const id = `ams/ent/crate-top/${look}/${l}`;
  if (hasFloorTile(id)) return id;
  const ramp = look === 'legion' ? PAL_HD.red : PAL_HD.wood;
  const strap: Ramp = look === 'legion' ? PAL_HD.gold : PAL_HD.sand;
  const base = look === 'legion' ? 4 : 4.6;
  defineFloorTile(id, {
    w: 24,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      // The straps over the lid in line with the sprite's bands (x 2.5–4.5 and 18.5–20.5 of 23).
      if ((a > 2.5 && a < 4.6) || (a > 18.4 && a < 20.5)) return dt(strap, (look === 'legion' ? 4.2 : 4.4) + (hash2(X >> 1, Y, 83) - 0.5) * 0.6, X, Y);
      // The rim boards round the lid.
      if (a < 1.1 || a > 21.9 || b < 1.1 || b > l - 1.1) return dt(ramp, base - 0.9, X, Y);
      if (mod(b - 1.1, 4.5) < Math.max(0.5, 1 / d)) return dt(ramp, base - 2.1, X, Y);
      const board = Math.floor((b - 1.1) / 4.5);
      return dt(ramp, base + (hash2(board, Math.floor(a / 9), 84) - 0.5) * 0.7 + (hash2(X, Y, 85) - 0.5) * 0.35, X, Y);
    },
  });
  return id;
}

/** A striped canvas top (a = along x from the awning's left edge, b = depth): stripes `w` wide every `p`, the first `on` from a = 0. */
function stripeTile(key: string, p: number, w: number, on: Ramp, onT: number, off: Ramp, offT: number, l: number): string {
  const id = `ams/ent/stripes/${key}/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: p * 4,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      const la = mod(a, p);
      const white = la < w;
      const f = white ? la / w : (la - w) / (p - w);
      // Sagging canvas between the ribs (one every 6 px of depth): lighter on the crown.
      const sag = Math.sin(mod(b, 6) / 6 * Math.PI) * 0.4;
      const t = (white ? onT : offT) + Math.sin(f * Math.PI) * 0.3 - 0.2 + sag + (hash2(X, Y >> 1, 86) - 0.5) * 0.35;
      return dt(white ? on : off, t, X, Y);
    },
  });
  return id;
}

/** A steel frame seen end-on (the bike rack's hoops: a = down, b = depth): the tube round the edge, the dark gap inside. */
function hoopTile(side: FaceSide, h: number, l: number): string {
  const id = `ams/ent/hoop/${side < 0 ? 'l' : 'r'}/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  const sh = SHADE(side);
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      const tube = a < 1.2 || b < 1.3 || b > l - 1.3 || a > h - 1;
      if (tube) return dt(PAL_HD.steel, (a < 0.6 ? 5.4 : 4.2) + sh, X, Y);
      // Between the tubes: the far tyres and spokes in shadow (dark, a few glints).
      return dt(PAL_HD.black, 1.4 + (hash2(X, Y, 87) > 0.88 ? 2 : 0), X, Y);
    },
  });
  return id;
}

/** A wooden stand's end (the tulip stall's tiers): planks down the face, three shelf ledges. */
function standTile(side: FaceSide, h: number, l: number): string {
  const id = `ams/ent/stand/${side < 0 ? 'l' : 'r'}/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  const sh = SHADE(side);
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      // The shelves' ends every 7 px, a bucket's rim and flower heads peeping over each one.
      const sa = mod(a - 3, 7);
      if (sa < 1.4) return dt(PAL_HD.brown, 4.6 + sh, X, Y);
      if (sa > 5.2 && b > 2 && b < l - 2) {
        const h2 = hash2(Math.floor(b / 2.5), Math.floor((a - 3) / 7), 88);
        if (sa > 6.2) return dt(h2 < 0.35 ? PAL_HD.red : h2 < 0.6 ? PAL_HD.gold : h2 < 0.8 ? PAL_HD.pink : PAL_HD.purple, 4 + sh * 0.5, X, Y);
        return dt(PAL_HD.green, 3 + sh * 0.5, X, Y);
      }
      if (mod(b, 5) < Math.max(0.5, 1 / d)) return dt(PAL_HD.brown, 1.8 + sh, X, Y);
      return dt(PAL_HD.brown, 3.2 + sh + (hash2(Math.floor(b / 5), Y >> 2, 89) - 0.5) * 0.5, X, Y);
    },
  });
  return id;
}

/** A plain top in one material (a = along x, b = depth): `kind` plank joints along a, or none. */
function plainTop(key: string, ramp: Ramp, tone: number, l: number, plank = 0, lip = 0): string {
  const id = `ams/ent/top/${key}/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: plank > 0 ? plank * 8 : 16,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (lip > 0 && b > l - lip) return dt(ramp, tone + 0.8, X, Y);
      if (plank > 0 && mod(a, plank) < Math.max(0.45, 1 / d)) return dt(ramp, tone - 1.6, X, Y);
      return dt(ramp, tone + (hash2(plank > 0 ? Math.floor(a / plank) : X >> 1, Y >> 1, 90) - 0.5) * 0.5, X, Y);
    },
  });
  return id;
}

/** A glass roof seen from above (a = along x, b = depth): pale panes reflecting the sky, white ribs every `rib` px (the first at `phase`). */
function glassRoofTile(rib: number, phase: number, l: number): string {
  const id = `ams/ent/glass-roof/${rib}/${phase}/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: rib * 4,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (mod(a - phase, rib) < Math.max(0.7, 1 / d) || b < 0.8 || b > l - 0.9) return dt(PAL_HD.snow, 5.2, X, Y);
      // The sky in the glass: brighter toward the far edge, a diagonal sheen.
      const sheen = mod(a + b * 1.4, 37) < 3 ? 1 : 0;
      return dt(PAL_HD.sky, 4.3 - (b / l) * 0.9 + sheen + (hash2(X >> 2, Y >> 1, 91) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/** A brick wall seen on its side (a = down, b = depth): courses level in the world, the bond along the depth. */
function brickSideTile(side: FaceSide, h: number, l: number): string {
  const id = `ams/ent/brick-side/${side < 0 ? 'l' : 'r'}/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  const sh = SHADE(side);
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (a < 1.4) return dt(PAL_HD.stone, (a < 0.6 ? 5.6 : 4.4) + sh, X, Y);
      const course = Math.floor((a - 1.4) / 2.4);
      const la = a - 1.4 - course * 2.4;
      const bb = b + (course & 1) * 3;
      const lb = mod(bb, 6);
      if (la < Math.max(0.45, 1 / d) * 0.8 || lb < Math.max(0.45, 1 / d)) return dt(PAL_HD.sand, 1.4 + sh * 0.5, X, Y);
      const k = hash2(Math.floor(bb / 6), course, 92);
      return dt(k < 0.55 ? PAL_HD.brickDark : PAL_HD.brick, (k < 0.55 ? 3.6 : 2.4) + sh + (hash2(X, Y, 93) - 0.5) * 0.5, X, Y);
    },
  });
  return id;
}

/** A walkway of klinkers seen from above (a = along x, b = depth), a granite edge at the far side. */
function walkTile(l: number): string {
  const id = `ams/ent/walk/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 46,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (b < 1.6) return dt(PAL_HD.stone, 4.8, X, Y);
      return klinkers(a, b, X, Y, 0.2, d);
    },
  });
  return id;
}

// ------------------------------------------------------------------------------- the kinds

/** The supply crate (crate.art.ts: 24 × 20, feet anchor): its lid and sides; state 1 broken (none), 2 the Legion crate. */
export function crateFaces(max = 2): EntityFacesDef {
  const D = depthBehind(0, CRATE_DEEP);
  const l = r4(depthPx(0, D));
  const box = (look: 'supply' | 'legion'): FaceDef[] => [
    wallFace(-11.5, 0, 19.5, 0, D, -1, crateSideTile(look, -1, l), l),
    wallFace(11.5, 0, 19.5, 0, D, 1, crateSideTile(look, 1, l), l),
    topFace(-11.5, 11.5, 19.5, D, 0, crateTopTile(look, l), l),
  ];
  return { max, states: [box('supply'), [], box('legion')] };
}

/** The state a crate draws (its look, or none once broken). */
export function crateFaceState(broken: boolean, legion: boolean): number {
  return broken ? 1 : legion ? 2 : 0;
}

/** The breakables (npc.art.ts `breakable`: (w + 2) × (h + 2), anchor (⌊(w + 2) / 2⌋, h + 1)); state 1 the wreck: none. */
export function breakableFaces(kind: 'ams-bike-rack' | 'ams-tulip-stall' | 'ams-herring-cart' | 'ams-market-stall', max = 2): EntityFacesDef {
  const faces: FaceDef[] = [];
  if (kind === 'ams-bike-rack') {
    // The hoops x 4–48 of the frame (sprite −23 … 21), 3 … 13 px up; the bikes' far side behind them.
    const D = depthBehind(0, RACK_DEEP);
    const l = r4(depthPx(0, D));
    faces.push(wallFace(-22.5, 3, 13, 0, D, -1, hoopTile(-1, 10, l), l), wallFace(21.5, 3, 13, 0, D, 1, hoopTile(1, 10, l), l));
  } else if (kind === 'ams-tulip-stall') {
    // The awning (frame x 1–46: −24 … 22, rows 0–6: 37 … 30 up) over the tiered stand (x 5–42: −20 … 17, 1 … 26 up).
    const D = depthBehind(0, STALL_DEEP);
    const l = r4(depthPx(0, D));
    const top = stripeTile('tulip', 6, 3, PAL_HD.snow, 4.8, PAL_HD.green, 3.8, l);
    const cheek = (side: FaceSide): string => ensureBandTile({ key: 'tulip-cheek', h: 7, l, side, bands: [[0, PAL_HD.green, 4.4], [5, PAL_HD.snow, 4.6]] });
    faces.push(
      wallFace(-19.5, 1, 26, 0, D, -1, standTile(-1, 25, l), l),
      wallFace(16.5, 1, 26, 0, D, 1, standTile(1, 25, l), l),
      wallFace(-23.5, 30, 36.5, 0, D, -1, cheek(-1), l),
      wallFace(21.5, 30, 36.5, 0, D, 1, cheek(1), l),
      topFace(-23.5, 21.5, 36.5, D, 0, top, l),
    );
  } else if (kind === 'ams-herring-cart') {
    // The kiosk (frame x 4–43: −21 … 18, 7 … 29 up) under its roof (x 2–45: −23 … 20, 29 … 35 up).
    const D = depthBehind(0, CART_DEEP);
    const l = r4(depthPx(0, D));
    const body = (side: FaceSide): string =>
      ensureBandTile({ key: 'herring-body', h: 22, l, side, joint: 0, bands: [[0, PAL_HD.cloth, 4.6], [1, PAL_HD.cloth, 5.2], [10, PAL_HD.sky, 3], [18, PAL_HD.cloth, 4.4], [21, PAL_HD.stone, 3]] });
    const edge = (side: FaceSide): string => ensureBandTile({ key: 'herring-roof', h: 6, l, side, joint: 3, bands: [[0, PAL_HD.sky, 4.2], [3, PAL_HD.snow, 4.8]] });
    faces.push(
      wallFace(-20.5, 7, 29, 0, D, -1, body(-1), l),
      wallFace(18.5, 7, 29, 0, D, 1, body(1), l),
      wallFace(-22.5, 29, 35, 0, D, -1, edge(-1), l),
      wallFace(20.5, 29, 35, 0, D, 1, edge(1), l),
      topFace(-22.5, 20.5, 35, D, 0, plainTop('herring-roof', PAL_HD.sky, 4.4, l, 0, 0), l),
    );
  } else {
    // The market stall: the awning (frame x 1–54: −28 … 26, 39 … 31 up), the table (x 4–51: −25 … 23, 15 up)
    // and its skirt (x 6–49: −23 … 21, 5 … 12 up).
    const D = depthBehind(0, STALL_DEEP);
    const Dt = depthBehind(0, STALL_DEEP - 6);
    const l = r4(depthPx(0, D));
    const lt = r4(depthPx(0, Dt));
    const top = stripeTile('market', 8, 4, PAL_HD.snow, 4.8, PAL_HD.red, 4.2, l);
    const cheek = (side: FaceSide): string => ensureBandTile({ key: 'market-cheek', h: 8, l, side, bands: [[0, PAL_HD.red, 4.4], [6, PAL_HD.snow, 4.6]] });
    const skirt = (side: FaceSide): string => ensureBandTile({ key: 'market-skirt', h: 10, l: lt, side, joint: 0, bands: [[0, PAL_HD.brown, 4.4], [2, PAL_HD.sky, 2.6]] });
    faces.push(
      wallFace(-22.5, 5, 15, 0, Dt, -1, skirt(-1), lt),
      wallFace(20.5, 5, 15, 0, Dt, 1, skirt(1), lt),
      topFace(-24.5, 22.5, 15, Dt, 0, plainTop('market-table', PAL_HD.brown, 4.2, lt, 6, 0), lt),
      wallFace(-27.5, 31, 38.5, 0, D, -1, cheek(-1), l),
      wallFace(25.5, 31, 38.5, 0, D, 1, cheek(1), l),
      topFace(-27.5, 25.5, 38.5, D, 0, top, l),
    );
  }
  return { max, states: [faces, []] };
}

/** Options of the boats' faces: their beam and the cabin's depth (world px behind the sprite). */
export interface BoatFacesOpts {
  beam?: number;
  cabin?: number;
  max?: number;
}

/**
 * The canal tour boat (`ams-tour-boat`, npc.art.ts `tourBoat`: 116 × 32, anchor (58, 28) on the
 * waterline): the deck behind the hull's edge, the glass cabin's ends and its roof, the hull's raked
 * ends down to the waterline; mirrored when it sails left. The entity passes its bob as dy.
 */
export function tourBoatFaces(o: BoatFacesOpts = {}): EntityFacesDef {
  const Dh = depthBehind(0, o.beam ?? 30);
  const Dc = depthBehind(0, o.cabin ?? 26);
  const lh = r4(depthPx(0, Dh));
  const lc = r4(depthPx(0, Dc));
  const hull = (side: FaceSide): string => ensureBandTile({ key: 'tour-hull', h: 8, l: lh, side, joint: 0, bands: [[0, PAL_HD.sky, 3.4], [1, PAL_HD.navy, 3], [2, PAL_HD.snow, 4.6], [3, PAL_HD.navy, 2.6], [6, PAL_HD.navy, 1.4]] });
  const cabin = (side: FaceSide): string => ensureBandTile({ key: 'tour-cabin', h: 14, l: lc, side, joint: 8, bands: [[0, PAL_HD.snow, 4.6], [1, PAL_HD.sky, 3.6], [4, PAL_HD.sky, 2.6], [10, PAL_HD.navy, 2]] });
  const deck = plainTop('tour-deck', PAL_HD.steel, 3.6, lh, 0, 1.2);
  const roof = glassRoofTile(10, 3.5, lc);
  return {
    max: o.max ?? 2,
    y: 182,
    mirror: { [hull(-1)]: hull(1), [hull(1)]: hull(-1), [cabin(-1)]: cabin(1), [cabin(1)]: cabin(-1) },
    states: [
      [
        quadFace([[-53.5, 8, Dh], [52.5, 8, Dh], [53.5, 8, 0], [-53.5, 8, 0]], [[0, 0], [106, 0], [107, lh], [0, lh]], deck),
        // The hull's ends (the stern rakes from x −54 at the deck to −51 at the waterline, the bow from 54 to 51).
        quadFace([[-53.5, 8, 0], [-50.5, 0.5, 0], [-50.5, 0.5, Dh], [-53.5, 8, Dh]], [[0, 0], [7.5, 0], [7.5, lh], [0, lh]], hull(-1)),
        quadFace([[53.5, 7, 0], [52.5, 7, Dh], [50.5, 0.5, Dh], [50.5, 0.5, 0]], [[0, 0], [0, lh], [6.5, lh], [6.5, 0]], hull(1)),
        // The glass cabin (frame x 14–104: −44 … 46) from the deck to the roof's crown (22 up).
        wallFace(-43.5, 8, 21.5, 0, Dc, -1, cabin(-1), lc),
        wallFace(45.5, 8, 21.5, 0, Dc, 1, cabin(1), lc),
        topFace(-45.5, 45.5, 21.5, Dc, 0, roof, lc),
      ],
    ],
  };
}

/**
 * The cruise boat of c2 (`ams-cruise-boat`, art-route.ts `cruiseBoat`: the stern at x 0, the deck at
 * the entity's y, the glass cabin x 40–168 up to 24): the deck (its far bow corner pulled back: the
 * raked bow), the glass roof, the cabin's ends, the stern's transom and the bow's far plank, down to
 * the waterline. The camera rides it, so its ends rarely show (the centre column is inside the boat).
 */
export function cruiseBoatFaces(o: BoatFacesOpts = {}): EntityFacesDef {
  const Dh = depthBehind(0, o.beam ?? 30);
  const Dc = depthBehind(0, o.cabin ?? 24);
  const lh = r4(depthPx(0, Dh));
  const lc = r4(depthPx(0, Dc));
  const L = CRUISE.len;
  const hull = (side: FaceSide): string => ensureBandTile({ key: 'cruise-hull', h: 4, l: lh, side, joint: 0, bands: [[0, PAL_HD.snow, 4.8], [1.2, PAL_HD.navy, 3], [3.4, PAL_HD.red, 2.4]] });
  const cabin = (side: FaceSide): string => ensureBandTile({ key: 'cruise-cabin', h: 24, l: lc, side, joint: 16, bands: [[0, PAL_HD.snow, 4.8], [1.4, PAL_HD.sky, 4], [6, PAL_HD.sky, 3.2], [14, PAL_HD.navy, 2.4], [18, PAL_HD.snow, 4.2]] });
  const deck = plainTop('cruise-deck', PAL_HD.steel, 4, lh, 0, 1.4);
  const wl = WATER_LEVEL;
  return {
    max: o.max ?? 1,
    mirror: {},
    states: [
      [
        quadFace([[0.5, 0, Dh], [L - 16, 0, Dh], [L - 0.5, 0, 0], [0.5, 0, 0]], [[0, 0], [L - 16.5, 0], [L - 1, lh], [0, lh]], deck),
        // The stern's transom (faces −u) and the bow's far plank (faces +u, raked back to the far side).
        quadFace([[0.5, 0, 0], [0.5, wl, 0, 1], [0.5, wl, Dh, 1], [0.5, 0, Dh]], [[0, 0], [4, 0], [4, lh], [0, lh]], hull(-1)),
        quadFace([[L - 0.5, 0, 0], [L - 16, 0, Dh], [L - 16, wl, Dh, 1], [L - 3, wl, 0, 1]], [[0, 0], [0, lh], [4, lh], [4, 0]], hull(1)),
        wallFace(40.5, 0, 24, 0, Dc, -1, cabin(-1), lc),
        wallFace(167.5, 0, 24, 0, Dc, 1, cabin(1), lc),
        topFace(40.5, 167.5, 24, Dc, 0, glassRoofTile(16, 15.5, lc), lc),
      ],
    ],
  };
}

/** Options of the bridges' faces: how far they reach back (and to the front, < 0) in depth. */
export interface BridgeFacesOpts {
  /** The far end (DEPTH; default the floor's back edge) and the near end (default 0: the sprite's plane; < 0 spans to the front). */
  back?: number;
  front?: number;
}

/**
 * The Magere Brug's bascule (`ams-magere-brug`, art-route.ts `magereLeaves`: the walkway at the
 * entity's y, the leaves 100 px between the portals, 15 px thick; frames 0 closed … 3 open at 0°,
 * 26°, 54°, 80°): closed, the walkway's planks and the slab's two ends; lifting, each leaf's walkway
 * turned up about its hinge at the portal. State = its sprite frame f; 3f + thin (4–12) the lifting
 * frame f with the walkways in `thin` left out (bit 0 the left leaf, bit 1 the right): a leaf seen
 * almost edge-on would draw as a dashed line that changes every frame (its rows' coverage), so the
 * entity leaves it out (cruise.ts `AmsMagereBrug.drawFloorFaces` decides).
 */
export function magereBrugFaces(o: BridgeFacesOpts = {}): EntityFacesDef {
  const back = o.back ?? AMS_BACK;
  const front = o.front ?? 0;
  const half = MAGERE_BRUG.gap / 2;
  const thick = MAGERE_BRUG.under - MAGERE_BRUG.top;
  const l = r4(depthPx(0, back));
  const lf = front < 0 ? r4(depthPx(front, 0)) : 4;
  const deck = plainTop('bascule-deck', PAL_HD.brown, 4.4, l, 3, 0);
  const deckF = plainTop('bascule-deck', PAL_HD.brown, 4.4, lf, 3, 0);
  const end = (side: FaceSide, ll: number): string => ensureBandTile({ key: 'bascule-end', h: 16, l: ll, side, joint: 0, bands: [[0, PAL_HD.brown, 4.4], [2, PAL_HD.snow, 5], [12, PAL_HD.snow, 3.6]] });
  /** Frame i's leaf on side s (−1 the left, its walkway turned up about its hinge at the portal: the slab's middle line). */
  const leaf = (i: number, s: FaceSide): FaceDef[] => {
    const a = (MAGERE_ANGLES[i] * Math.PI) / 180;
    const ex = half + (thick / 2) * Math.sin(a);
    const ey = -thick / 2 + (thick / 2) * Math.cos(a);
    const rx = ex - half * Math.cos(a);
    const ry = ey + half * Math.sin(a);
    const out = [slopeFace(s * ex, ey, s * rx, ry, 0, back, s, deck, l)];
    if (front < 0) out.push(slopeFace(s * ex, ey, s * rx, ry, front, 0, s, deckF, lf));
    return out;
  };
  const closed: FaceDef[] = [wallFace(-half + 0.5, -thick, 0, 0, back, -1, end(-1, l), l), wallFace(half - 0.5, -thick, 0, 0, back, 1, end(1, l), l), topFace(-half + 0.5, half - 0.5, 0, back, 0, deck, l)];
  if (front < 0) closed.push(wallFace(-half + 0.5, -thick, 0, front, 0, -1, end(-1, lf), lf), wallFace(half - 0.5, -thick, 0, front, 0, 1, end(1, lf), lf), topFace(-half + 0.5, half - 0.5, 0, 0, front, deckF, lf));
  const states: FaceDef[][] = [closed];
  for (let i = 1; i < 4; i++) states.push([...leaf(i, -1), ...leaf(i, 1)]);
  // The thin variants (state 3f + thin): the left leaf left out, the right one, both.
  for (let i = 1; i < 4; i++) states.push(leaf(i, 1), leaf(i, -1), []);
  return { max: 1, y: MAGERE_BRUG.top, states };
}

/**
 * A low brick bridge over the river (`ams-low-bridge`, art-route.ts: the slab 64 px wide from the
 * walkway (the entity's y) to its underside 15 px lower; the piers at x ±28 … ±33 into the water):
 * the walkway's klinkers, the slab's outer ends and the piers' sides down to the waterline.
 */
export function lowBridgeFaces(o: BridgeFacesOpts = {}): EntityFacesDef {
  const back = o.back ?? AMS_BACK;
  const front = o.front ?? 0;
  const under = LOW_BRIDGE.under - LOW_BRIDGE.top;
  const wl = WATER_LEVEL;
  // Height of the walkway over the walk plane (the slab's ends reach from it to the water).
  const h0 = G - LOW_BRIDGE.top;
  const faces = (d0: number, d1: number): FaceDef[] => {
    const l = r4(depthPx(d0, d1));
    const outer = (side: FaceSide): string => brickSideTile(side, Math.ceil(h0 - wl), l);
    const inner = (side: FaceSide): string => brickSideTile(side, Math.ceil(h0 - under - wl), l);
    return [
      // The outer ends (slab and pier in one wall) and the piers' inner sides under the arch.
      wallFace(-32.5, wl - h0, 0, d0, d1, -1, outer(-1), l),
      wallFace(32.5, wl - h0, 0, d0, d1, 1, outer(1), l),
      wallFace(-27.5, wl - h0, -under, d0, d1, 1, inner(1), l),
      wallFace(27.5, wl - h0, -under, d0, d1, -1, inner(-1), l),
      topFace(-32.5, 32.5, 0, d1, d0, walkTile(l), l),
    ];
  };
  return { max: 2, y: LOW_BRIDGE.top, states: [[...faces(0, back), ...(front < 0 ? faces(front, 0) : [])]] };
}

/** Options of `amsEntityFaces`. */
export interface AmsEntityFacesOpts {
  tour?: BoatFacesOpts;
  cruise?: BoatFacesOpts;
  magere?: BridgeFacesOpts;
  lowBridge?: BridgeFacesOpts;
  /**
   * How many of a kind show at once (each holds a canvas while it shows: the section start makes them,
   * the ONE memory number counts them). Defaults: `AMS_FACES_MAX`.
   */
  max?: Partial<Record<AmsFacedKind, number>>;
}

// ------------------------------------------------------------------------------- the scan car

/**
 * An end of the scan car (a = down from its top edge, b = across the car from its near side): white
 * paint in bands, the lamps at both corners (`lamp`: the band [a0, a1) where they sit, their colour),
 * lit on the left (sides.ts). `kind` 'front': the bonnet's lip, the black grille, the bumper with the
 * livery's red band; 'rear': the tinted rear window, the tailgate, the bumper.
 */
function carEndTile(kind: 'front' | 'rear', side: FaceSide, h: number, l: number): string {
  const id = `ams/ent/scan-car/${kind}/${side < 0 ? 'l' : 'r'}/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  const sh = SHADE(side) * 0.8;
  const bands: readonly (readonly [number, Ramp, number])[] =
    kind === 'front'
      ? [[0, PAL_HD.snow, 5], [1, PAL_HD.steel, 1.8], [3.6, PAL_HD.snow, 4.6], [7, PAL_HD.red, 3.2], [8.6, PAL_HD.steel, 1.6]]
      : [[0, PAL_HD.snow, 5], [1.4, PAL_HD.navy, 1.4], [9, PAL_HD.snow, 4.6], [17.4, PAL_HD.steel, 2], [19.4, PAL_HD.red, 3.2], [21, PAL_HD.steel, 1.4]];
  const lamp: readonly [number, number, Ramp, number] = kind === 'front' ? [1.2, 3.4, PAL_HD.gold, 6] : [9.6, 13, PAL_HD.red, 3.8];
  defineFloorTile(id, {
    w: r4(h),
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (a >= lamp[0] && a < lamp[1] && (b < 3.2 || b > l - 3.2)) return dt(lamp[2], lamp[3] + (b < 1 || b > l - 1 ? -0.8 : 0), X, Y);
      let k = 0;
      for (let i = 0; i < bands.length; i++) if (a >= bands[i][0]) k = i;
      const t = bands[k][2] + sh + (hash2(X >> 1, Y >> 1, 95) - 0.5) * 0.3 + (a - bands[k][0] < 0.5 && k > 0 ? 0.5 : 0);
      return dt(bands[k][1], t, X, Y);
    },
  });
  return id;
}

/** The scan car's tinted windscreen seen from above (a = up the slope, b = depth): dark glass, the sky's sheen, the black frame. */
function carGlassTile(ls: number, l: number): string {
  const id = `ams/ent/scan-car/glass/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: r4(ls),
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (a < 0.8 || a > ls - 0.8 || b < 0.8 || b > l - 0.8) return dt(PAL_HD.steel, 0.8, X, Y);
      const sheen = mod(a * 1.6 + b, 19) < 2.4 ? 1.4 : 0;
      return dt(PAL_HD.steel, 1.6 + (a / ls) * 0.8 + sheen + (hash2(X >> 2, Y >> 1, 96) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/**
 * The parking scan car (`ams-scan-car`, bosses/ams-scan: geometry.ts `SCAN.profile`, a compact
 * hatchback 84 px long, its front at +x facing right; the roof 29 px up, the windscreen from (3, 28) to
 * (22.4, 18.8), the bonnet to (41, 13.3), the tailgate at −42): a box `CAR_DEEP` world px deep — the
 * roof, the windscreen and the bonnet seen from above, the front and the tailgate (only the end that
 * looks at the eye shows: the one toward the screen's centre). The roof rack is the sprite's (it
 * stands over the roof). Mirrored with the car (`flip`); state 1 (the wreck on its roof) draws none.
 */
export function scanCarFaces(max = 1): EntityFacesDef {
  const D = depthBehind(0, CAR_DEEP);
  const l = r4(depthPx(0, D));
  const wsL = Math.hypot(22.4 - 3, 28.2 - 18.8);
  const front = (side: FaceSide): string => carEndTile('front', side, 11, l);
  const rear = (side: FaceSide): string => carEndTile('rear', side, 24, l);
  return {
    max,
    // Facing left the front looks at −u (the sunny side), the tailgate at +u (the shade).
    mirror: { [front(1)]: front(-1), [rear(-1)]: rear(1) },
    states: [
      [
        wallFace(-41.5, 2.5, 26, 0, D, -1, rear(-1), l),
        slopeFace(-40.9, 25.6, -37.4, 28.2, 0, D, -1, plainTop('scan-car-roof-end', PAL_HD.snow, 4.6, l), l),
        topFace(-37.4, 3, 28.8, D, 0, plainTop('scan-car-roof', PAL_HD.snow, 4.8, l, 0, 0.8), l),
        slopeFace(22.4, 18.8, 3, 28.2, 0, D, 1, carGlassTile(wsL, l), l),
        slopeFace(41, 13.3, 22.4, 18.8, 0, D, 1, plainTop('scan-car-bonnet', PAL_HD.snow, 4.5, l), l),
        wallFace(41.5, 2.5, 13.3, 0, D, 1, front(1), l),
      ],
      [],
    ],
  };
}

// ------------------------------------------------------------------------------- the secrets

/** A secret prop's wooden side (a = down from its top, b = back from the front edge): boards every `board` px, the back corner batten. */
function secretSideTile(key: string, ramp: Ramp, base: number, h: number, board: number, side: FaceSide, l: number): string {
  const id = `ams/ent/secret-side/${key}/${side < 0 ? 'l' : 'r'}/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  const sh = SHADE(side);
  defineFloorTile(id, {
    w: r4(h),
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (b > l - 2) return dt(ramp, base - 0.9 + sh, X, Y);
      if (a < 1) return dt(ramp, base + 0.6 + sh, X, Y);
      if (mod(a, board) < Math.max(0.5, 1 / d)) return dt(ramp, base - 1.7 + sh, X, Y);
      return dt(ramp, base + sh + (hash2(Math.floor(a / board), Math.floor(b / 9), 97) - 0.5) * 0.6 + (hash2(X, Y >> 1, 98) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/** The chest's domed lid seen from above (a = along x from its left edge, b = depth): brown boards along the depth, two iron bands over it. */
function chestLidTile(l: number): string {
  const id = `ams/ent/chest-lid/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 20,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      // The bands over the lid at the sprite's x 4 and 15 (a 2.5 … 3.5 and 13.5 … 14.5 from its left edge).
      if ((a > 2.4 && a < 3.6) || (a > 13.4 && a < 14.6)) return dt(PAL_HD.steel, 3.8 + (b < 1 ? 1 : 0), X, Y);
      const crown = Math.sin((a / 17) * Math.PI) * 0.6;
      if (mod(a, 4.25) < Math.max(0.45, 1 / d)) return dt(PAL_HD.wood, 1.6 + crown, X, Y);
      return dt(PAL_HD.wood, 3.4 + crown + (hash2(Math.floor(a / 4.25), Y >> 1, 99) - 0.5) * 0.5, X, Y);
    },
  });
  return id;
}

/**
 * The secrets (`ams-secret`, secrets.ts; one kind for every look, the entity picks the state): 1 the
 * museum crate (secrets.art.ts: 32 × 24, the box x −15 … 15, 2 … 22 up), a pine box 20 world px deep —
 * its lid and sides, open too (the front falls, the box stands); 2 the chest closed (20 × 17: the body
 * x −9 … 9, 2 … 9 up, the domed lid to 14 up), 12 deep — its lid and banded sides; 3 the chest open (the
 * lid raised behind it): the body's sides. State 0 (every other look) draws none.
 */
export function secretFaces(max = 1): EntityFacesDef {
  const Dc = depthBehind(0, 20);
  const lc = r4(depthPx(0, Dc));
  const pine = (side: FaceSide): string => secretSideTile('pine', PAL_HD.sand, 3.9, 20, 5, side, lc);
  const crate: FaceDef[] = [
    wallFace(-14.5, 2, 21.5, 0, Dc, -1, pine(-1), lc),
    wallFace(14.5, 2, 21.5, 0, Dc, 1, pine(1), lc),
    topFace(-14.5, 14.5, 21.5, Dc, 0, plainTop('museum-crate', PAL_HD.sand, 4.2, lc, 5, 1), lc),
  ];
  const Dh = depthBehind(0, 12);
  const lh = r4(depthPx(0, Dh));
  const oak = (side: FaceSide, h: number): string => secretSideTile('chest', PAL_HD.wood, 3.4, h, 3, side, lh);
  const body: FaceDef[] = [wallFace(-8.5, 2, 9, 0, Dh, -1, oak(-1, 8), lh), wallFace(8.5, 2, 9, 0, Dh, 1, oak(1, 8), lh)];
  const chest: FaceDef[] = [
    wallFace(-8.5, 2, 13.5, 0, Dh, -1, oak(-1, 12), lh),
    wallFace(8.5, 2, 13.5, 0, Dh, 1, oak(1, 12), lh),
    topFace(-8.5, 8.5, 13.5, Dh, 0, chestLidTile(lh), lh),
  ];
  return { max, states: [[], crate, chest, body] };
}

/** How many of each kind usually show at once (a section with more lists its own `max`). */
export const AMS_FACES_MAX: Readonly<Record<AmsFacedKind, number>> = {
  crate: 2,
  'ams-bike-rack': 1,
  'ams-tulip-stall': 1,
  'ams-herring-cart': 1,
  'ams-market-stall': 2,
  'ams-boat-platform': 2,
  'ams-party-boat': 1,
  'ams-tour-boat': 2,
  'ams-cruise-boat': 1,
  'ams-magere-brug': 1,
  'ams-low-bridge': 1,
  'ams-scan-car': 1,
  'ams-secret': 1,
};

/**
 * The `FloorDef.entityFaces` map of the listed kinds (spec §12.1 item 4: a floor opts in per entity
 * kind). E.g. a street section: `entityFaces: amsEntityFaces(AMS_STREET_FACED)`; c2:
 * `amsEntityFaces(['ams-cruise-boat', 'ams-party-boat', 'ams-magere-brug', 'ams-low-bridge'], { lowBridge: { back: 30, front: -40 } })`.
 */
export function amsEntityFaces(kinds: readonly AmsFacedKind[], o: AmsEntityFacesOpts = {}): Record<string, EntityFacesDef> {
  const out: Record<string, EntityFacesDef> = {};
  for (const k of kinds) {
    const max = o.max?.[k] ?? AMS_FACES_MAX[k];
    let def: EntityFacesDef;
    switch (k) {
      case 'crate':
        def = crateFaces(max);
        break;
      case 'ams-bike-rack':
      case 'ams-tulip-stall':
      case 'ams-herring-cart':
      case 'ams-market-stall':
        def = breakableFaces(k, max);
        break;
      case 'ams-boat-platform':
      case 'ams-party-boat':
        def = rowboatFaces(max);
        break;
      case 'ams-tour-boat':
        def = tourBoatFaces({ ...o.tour, max });
        break;
      case 'ams-cruise-boat':
        def = cruiseBoatFaces({ ...o.cruise, max });
        break;
      case 'ams-magere-brug':
        def = { ...magereBrugFaces(o.magere), max };
        break;
      case 'ams-low-bridge':
        def = { ...lowBridgeFaces(o.lowBridge), max };
        break;
      case 'ams-scan-car':
        def = scanCarFaces(max);
        break;
      case 'ams-secret':
        def = secretFaces(max);
        break;
    }
    out[k] = def;
  }
  return out;
}
