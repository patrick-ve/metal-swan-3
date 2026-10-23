/**
 * The ten sections of the A10 dressed (WORLD, wave B; docs/design/rally.md §3): each section's filler
 * (zones of buildings, trees, billboards along both sides) and its LANDMARKS at TRACK's anchors
 * (`A10Track.landmarks`): likenesses from general knowledge, our own design, no company name or logo.
 *
 * | Section | Landmarks |
 * |---|---|
 * | ZUIDAS | the towers, the station with its canopy, the cranes of the endless works |
 * | NIEUWE MEER | the A4 junction's flyover, the Schinkel under its bridge, the dark woods |
 * | RING WEST | rows of 1960s flats, the metro on its viaduct (a train runs on it) |
 * | SLOTERDIJK | the railway crossing over the road and the station hall, office towers |
 * | COENTUNNEL | the portals with their names, the ventilation buildings, the harbour cranes and water |
 * | NOORD | the polder (parcels, ditches, poplars, farms), sheds, wind turbines, the canal |
 * | ZEEBURGERTUNNEL | the portal, the wide IJ, the towers of the new islands |
 * | OOST | sports fields with floodlights, the science park, a tall office tower by a station |
 * | AMSTEL | the A2 junction, the river with houseboats and boats |
 * | RAI | the long exhibition halls |
 *
 * Setup code; pure and deterministic (a fixed rng per section).
 */
import { Rng } from '../../../../engine/rng';
import { cosT, sinT } from '../../../../engine/r3/trig';
import type { A10Track, TrackLandmark } from '../track/types';
import { TF } from '../track/types';
import { Frame, WorldBatch, type Rgb, type V3 } from './batch';
import { glowTex } from '../lights/page';
import { propsTex } from './pages';
import { billboard, block, boat, building, centralLamp, container, crane, deck, face, floodlight, groundPoly, parcel, tree, turbineTower, water, TINT, flat } from './pieces';
import { billboardAt, farm, fits, flats, gableRoof, houses, initPlace, office, Placer, shed, tower, treeRow, trees, zone, type DressCtx } from './place';

/** An animated part (a turbine rotor, the metro train): its mesh, posed every frame. */
export interface AnimSpec {
  readonly kind: 'rotor' | 'train';
  /** World position of the hub / the path. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rotor: the direction it faces (yaw); train: unused. */
  readonly yaw: number;
  /** Rotor: the phase; train: the path (x, y, z per point) and its length. */
  readonly phase: number;
  readonly path?: readonly V3[];
  readonly length?: number;
}

/** What the dressing made (tests, the report). */
export interface DressReport {
  /** Per section id: the landmark ids it built. */
  readonly landmarks: Record<string, string[]>;
  readonly anims: AnimSpec[];
}

type LandmarkFn = (c: DressCtx, lm: TrackLandmark, out: DressReport) => void;

const deg = (d: number): number => (d * Math.PI) / 180;

/** Container colours (vertex tints of the grey corrugated side). */
const BOX_TINTS: readonly Rgb[] = [
  [150, 96, 80],
  [80, 110, 150],
  [120, 140, 100],
  [160, 140, 90],
  [128, 128, 128],
];

/** A flyover: a deck that crosses over both carriageways at `s`, skewed by `skew` m, from `a` to `b` m side. */
function flyover(c: DressCtx, s: number, a: number, bSide: number, top: number, skew: number): void {
  const pts: V3[] = [];
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const side = a + (bSide - a) * t;
    const fr = c.place.frame(s + skew * (t - 0.5), side);
    // Up from the ground at the ends to `top` over the road (a smooth hump).
    const e = Math.min(1, Math.min(t, 1 - t) / 0.3);
    const y = 0.4 + (top - 0.4) * e * e * (3 - 2 * e);
    pts.push([fr.ox, y, fr.oz]);
  }
  const mid = pts[n >> 1];
  c.b.at(mid[0], mid[2]);
  // Piers clear of the road (the deck's own path keeps its piers off the carriageways).
  deckNoPiersOnRoad(c, pts, 11, 1.4, 22);
}

/** A deck whose piers keep off the road corridor. */
function deckNoPiersOnRoad(c: DressCtx, path: readonly V3[], w: number, thick: number, every: number): void {
  // Draw the deck without piers, then place piers where the ground is clear.
  deck(c.b, path, w, thick, 1e9, 'light', 1.0);
  let acc = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    while (acc <= len) {
      const t = acc / len;
      const x = a[0] + dx * t, z = a[2] + dz * t, y = a[1] + (b[1] - a[1]) * t - thick;
      if (y > 1 && c.place.roadDist(x, z) > 18) {
        const fr = new Frame(x, 0, z, dx, dz);
        block(c.b, 'props', 'both', fr, -0.9, 0, -0.9, 0.9, y, 0.9, 'light', TINT.shade, ['right', 'left', 'front', 'back']);
      }
      acc += every;
    }
    acc -= len;
  }
}

/** A train of `cars` coaches along a frame's z (static, on a viaduct or at a platform). */
function trainCars(c: DressCtx, fr: Frame, y: number, cars: number, len = 20): void {
  for (let k = 0; k < cars; k++) {
    const z0 = k * (len + 1);
    block(c.b, 'props', 'both', fr, -1.45, y, z0, 1.45, y + 3.6, z0 + len, 'light', [124, 126, 132]);
    block(c.b, 'props', 'near', fr, -1.47, y + 1.6, z0 + 1, 1.47, y + 2.6, z0 + len - 1, 'glass', TINT.white, ['right', 'left']);
    block(c.b, 'props', 'near', fr, -1.47, y + 0.6, z0 + 0.5, 1.47, y + 1, z0 + len - 0.5, 'red', TINT.white, ['right', 'left']);
  }
}

/** A platform canopy: a long flat roof on two rows of columns. */
function canopy(c: DressCtx, fr: Frame, w: number, len: number, h: number): void {
  block(c.b, 'props', 'both', fr, -w / 2, h, -len / 2, w / 2, h + 0.8, len / 2, 'light', [124, 124, 128], ['top', 'bottom', 'right', 'left', 'front', 'back']);
  for (let z = -len / 2 + 4; z < len / 2; z += 12) for (const x of [-w / 2 + 1.5, w / 2 - 1.5]) block(c.b, 'props', 'near', fr, x - 0.2, 0, z - 0.2, x + 0.2, h, z + 0.2, 'grey', TINT.white, ['right', 'left', 'front', 'back']);
  block(c.b, 'props', 'both', fr, -w / 2 + 1, 0, -len / 2, w / 2 - 1, 1.1, len / 2, 'grey', TINT.shade, ['top', 'right', 'left', 'front', 'back']);
}

/** A name plate (props page) facing the traffic that comes along the frame's +z. */
function plate(c: DressCtx, fr: Frame, text: keyof ReturnType<typeof propsTex>['plates'], y0: number, scale: number, z = 0): void {
  const r = propsTex().plates[text];
  const w = r.w * scale, h = r.h * scale;
  face(c.b, 'props', fr, -w / 2, y0, w / 2, y0 + h, z, [r.x, r.y, r.x + r.w, r.y + r.h], TINT.white);
}

/** A tunnel portal's dressing: the name over the mouth, a ventilation building beside it. */
function portal(c: DressCtx, s: number, name: 'COENTUNNEL' | 'ZEEBURGERTUNNEL', facing: 1 | -1, out: DressReport, id: string, sec: string): void {
  // TRACK's portal: the concrete face above the tube's mouth from about −3 m to 0.8 m, 0.7 m outside.
  const fr0 = c.place.frame(s, -7.8);
  const fr = facing === 1 ? fr0 : new Frame(fr0.ox, 0, fr0.oz, -fr0.fx, -fr0.fz);
  c.b.at(fr.ox, fr.oz);
  const zFace = -1.45;
  plate(c, fr, name, -2.1, 0.32, zFace);
  // The ventilation building: a tall block with louvres, on the right of the mouth (our side).
  const vb = c.place.frame(s - 25 * facing, 26);
  if (c.place.clear(vb.ox, vb.oz, 9, -20)) {
    c.b.at(vb.ox, vb.oz);
    building(c.b, vb, 14, 16, 16, 'stone', [118, 118, 122], { lit: false, vOff: 3 });
    block(c.b, 'props', 'both', vb, -3, 16, -3, 3, 20, 3, 'grey', TINT.white);
  }
  out.landmarks[sec].push(id);
}

const LANDMARKS: Readonly<Record<string, LandmarkFn>> = {
  // ZUIDAS: glass and stone towers of different heights on both sides of the start.
  'zuidas-towers': (c, lm) => {
    const r = c.rng;
    const spots: [number, number, number][] = [
      [-60, 75, 84],
      [0, 120, 66],
      [70, 70, 72],
      [140, 110, 58],
      [-20, -95, 76],
      [90, -110, 62],
      [200, -75, 54],
    ];
    for (const [ds, side, h] of spots) {
      const fr = c.place.frame(lm.s + ds, side);
      tower(['glass', 'stone', 'glass'], h - 4, h + 4)(c, fr, r);
    }
  },
  'zuidas-station': (c, lm) => {
    const fr = c.place.frame(lm.s, lm.side);
    c.b.at(fr.ox, fr.oz);
    canopy(c, fr, 16, 120, 7.5);
    trainCars(c, fr.moved(-4, 0, -40), 1.1, 4);
    const hall = c.place.frame(lm.s + 10, lm.side - 22);
    c.b.at(hall.ox, hall.oz);
    building(c.b, hall, 24, 40, 14, 'hall', [124, 126, 132], { vOff: 1 });
    plate(c, c.place.frame(lm.s - 22, lm.side + 7.6), 'STATION ZUID', 8.6, 0.42);
    c.place.keepOut(fr.ox, fr.oz, 70);
  },
  'zuidas-cranes': (c, lm) => {
    const fr = c.place.frame(lm.s, lm.side);
    c.b.at(fr.ox, fr.oz);
    // The half-built tower: a concrete core and bare floor slabs on columns.
    block(c.b, 'props', 'both', fr, -5, 0, -5, 5, 46, 5, 'light', [118, 118, 118]);
    for (let y = 4; y < 34; y += 3.8) block(c.b, 'props', 'both', fr, -13, y, -11, 13, y + 0.35, 11, 'grey', [120, 120, 120], ['top', 'bottom', 'right', 'left', 'front', 'back']);
    for (const [x, z] of [[-12, -10], [12, -10], [-12, 10], [12, 10]]) block(c.b, 'props', 'near', fr, x - 0.3, 0, z - 0.3, x + 0.3, 34, z + 0.3, 'grey', TINT.white, ['right', 'left', 'front', 'back']);
    crane(c.b, fr.moved(18, 0, -14).turned(sinT(deg(200)), cosT(deg(200))), 62, 44);
    crane(c.b, fr.moved(-30, 0, 30).turned(sinT(deg(70)), cosT(deg(70))), 54, 38);
    for (let k = 0; k < 3; k++) container(c.b, fr.moved(20 + k * 3, 0, 24), BOX_TINTS[k]);
    c.place.keepOut(fr.ox, fr.oz, 40);
  },
  // NIEUWE MEER: the A4 junction (a flyover over the road), the Schinkel, the woods.
  'a4-junction': (c, lm) => {
    flyover(c, lm.s, -190, 160, 9.6, 50);
    // A curved ramp sweeping away on the left.
    const pts: V3[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const fr = c.place.frame(lm.s - 120 + 220 * t, -55 - 70 * t * t);
      pts.push([fr.ox, 0.4 + 6 * (t < 0.5 ? t * 2 : 1), fr.oz]);
    }
    c.b.at(pts[5][0], pts[5][2]);
    deck(c.b, pts, 9, 1.2, 24, 'light', 0.9);
  },
  'schinkel-water': (c, lm) => river(c, lm.s, 40, 520, 'barge', 2),
  'nieuwe-meer-woods': (c, lm) => {
    const r = c.rng;
    for (let s = lm.s - 160; s < lm.s + 160; s += 7) {
      for (let k = 0; k < 4; k++) {
        const fr = c.place.frame(s + r.range(-3, 3), -38 - r.range(0, 170) * r.next());
        if (!c.place.clear(fr.ox, fr.oz, 2, -6)) continue;
        c.b.at(fr.ox, fr.oz);
        tree(c.b, fr.ox, fr.oz, 0, r.range(11, 19), r.chance(0.45) ? 'conifer' : 'B', r.next(), r.range(0.7, 0.9));
      }
    }
  },
  // RING WEST: the 1960s flats in rows; the metro beside the road.
  'west-flats': (c, lm) => {
    const r = c.rng;
    for (let k = 0; k < 4; k++) flats(4, 9, k % 2 === 0)(c, c.place.frame(lm.s - 90 + k * 60, 60 + (k % 2) * 40 + r.range(0, 20)), r);
  },
  'west-metro': (c, lm, out) => {
    // The viaduct right behind the noise barrier (so it shows above it), 9.5 m up, from the start of
    // Ring West into Sloterdijk.
    const side = 14.5, top = 9.5;
    const sec = c.track.sections[lm.section];
    const pts: V3[] = [];
    for (let s = sec.s0 - 40; s <= sec.s1 + 160; s += 20) {
      const fr = c.place.frame(s, side);
      pts.push([fr.ox, top, fr.oz]);
    }
    for (let i = 0; i + 1 < pts.length; i += 6) {
      const part = pts.slice(i, Math.min(pts.length, i + 7));
      c.b.at(part[0][0], part[0][2]);
      deck(c.b, part, 9, 1.3, 30, 'grey', 0.9);
    }
    // The station on the viaduct: a canopy on columns and its name.
    const st = c.place.frame(lm.s - 40, side);
    c.b.at(st.ox, st.oz);
    block(c.b, 'props', 'both', st, -5, top + 4, -40, 5, top + 4.6, 40, 'light', [122, 122, 126], ['top', 'bottom', 'right', 'left', 'front', 'back']);
    for (let z = -36; z <= 36; z += 12) block(c.b, 'props', 'near', st, 3.8, top, z - 0.2, 4.2, top + 4, z + 0.2, 'grey', TINT.white, ['right', 'left', 'front', 'back']);
    plate(c, c.place.frame(lm.s - 81, side), 'LELYLAAN', top + 3.1, 0.3);
    let len = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][2] - pts[i][2];
      len += Math.sqrt(dx * dx + dz * dz);
    }
    out.anims.push({ kind: 'train', x: pts[0][0], y: top, z: pts[0][2], yaw: 0, phase: 0, path: pts, length: len });
    for (const p of pts) c.place.keepOut(p[0], p[2], 8);
  },
  'west-flats-2': (c, lm) => {
    const r = c.rng;
    for (let k = 0; k < 4; k++) flats(5, 10, k % 2 === 1)(c, c.place.frame(lm.s - 100 + k * 55, -(60 + (k % 2) * 45 + r.range(0, 20))), r);
  },
  // SLOTERDIJK: the station (a railway crossing over the road, a glass hall), office towers.
  'sloterdijk-station': (c, lm) => {
    const s = lm.s + 45;
    const pts: V3[] = [];
    for (let k = 0; k <= 8; k++) {
      const fr = c.place.frame(s - 10 + k * 2.5, -200 + k * 50);
      pts.push([fr.ox, 10.5, fr.oz]);
    }
    c.b.at(pts[4][0], pts[4][2]);
    deckNoPiersOnRoad(c, pts, 12, 1.6, 26);
    // A train on the crossing.
    const a = pts[2], b = pts[6];
    const tr = new Frame(a[0], 0, a[2], b[0] - a[0], b[2] - a[2]);
    trainCars(c, tr.moved(-2.5, 0, 0), 10.6, 4, 22);
    // The station hall beside it, with platform canopies.
    const hall = c.place.frame(lm.s, lm.side + 10);
    c.b.at(hall.ox, hall.oz);
    building(c.b, hall, 40, 50, 20, 'hall', [126, 128, 134], { vOff: 2 });
    gableRoof(c.b, hall, 40, 50, 20, 6, [112, 116, 124], 'dark');
    plate(c, c.place.frame(lm.s - 26, lm.side + 10), 'SLOTERDIJK', 15, 0.5);
    c.place.keepOut(hall.ox, hall.oz, 40);
    for (const p of pts) c.place.keepOut(p[0], p[2], 9);
  },
  'sloterdijk-offices': (c, lm) => {
    const r = c.rng;
    for (const [ds, side, h] of [
      [-30, -60, 64],
      [30, -95, 52],
      [90, -70, 46],
    ] as const) tower(['glass', 'stone', 'modern'], h - 4, h + 4)(c, c.place.frame(lm.s + ds, side), r);
  },
  // COENTUNNEL: the portals and the harbour.
  'coentunnel-portal-south': (c, lm, out) => portal(c, tunnelEdge(c, 'COENTUNNEL', 0), 'COENTUNNEL', 1, out, lm.id, 'coentunnel'),
  'harbour-cranes': (c, lm) => {
    // The harbour basin over the tube (both sides) and the container cranes on its west quay.
    harbourWater(c, lm.s - 60, lm.s + 70, 340);
    const r = c.rng;
    for (let k = 0; k < 3; k++) {
      const fr = c.place.frame(lm.s - 120 + k * 45, lm.side - 40);
      c.b.at(fr.ox, fr.oz);
      stsCrane(c, fr.turned(sinT(deg(90)), cosT(deg(90))));
    }
    for (let k = 0; k < 14; k++) {
      const fr = c.place.frame(lm.s - 160 + r.range(0, 120), lm.side - 70 - r.range(0, 60));
      c.b.at(fr.ox, fr.oz);
      const hgt = r.int(1, 3);
      for (let y = 0; y < hgt; y++) container(c.b, fr, BOX_TINTS[r.int(0, 4)], y * 2.6);
    }
  },
  'coentunnel-portal-north': (c, lm, out) => portal(c, tunnelEdge(c, 'COENTUNNEL', 1), 'COENTUNNEL', -1, out, lm.id, 'coentunnel'),
  // NOORD: sheds, wind turbines, the canal.
  'noord-sheds': (c, lm) => {
    const r = c.rng;
    for (let k = 0; k < 5; k++) shed()(c, c.place.frame(lm.s - 120 + k * 55, lm.side + r.range(-10, 40)), r);
    for (let k = 0; k < 10; k++) {
      const fr = c.place.frame(lm.s - 60 + r.range(0, 120), lm.side + 70 + r.range(0, 30));
      if (!c.place.clear(fr.ox, fr.oz, 7)) continue;
      c.b.at(fr.ox, fr.oz);
      container(c.b, fr, BOX_TINTS[r.int(0, 2)]);
    }
  },
  'wind-turbines': (c, lm, out) => {
    for (let k = 0; k < 5; k++) {
      const fr = c.place.frame(lm.s - 260 + k * 130, lm.side - (k % 2) * 40);
      c.b.at(fr.ox, fr.oz);
      turbineTower(c.b, fr, 66);
      c.place.keepOut(fr.ox, fr.oz, 26);
      // The rotor faces the south-west wind (yaw toward 225°).
      out.anims.push({ kind: 'rotor', x: fr.ox, y: 67.2, z: fr.oz, yaw: deg(225), phase: k * 0.9 });
    }
  },
  'canal-water': (c, lm) => river(c, lm.s, 36, 520, 'barge', 3),
  // ZEEBURGERTUNNEL: the portal, the IJ, the new islands' towers.
  'zeeburg-portal-north': (c, lm, out) => portal(c, tunnelEdge(c, 'ZEEBURGERTUNNEL', 0), 'ZEEBURGERTUNNEL', 1, out, lm.id, 'zeeburgertunnel'),
  'ij-water': (c, lm) => {
    harbourWater(c, lm.s - 90, lm.s + 90, 420);
    for (let k = 0; k < 4; k++) {
      const fr = c.place.frame(lm.s - 70 + k * 45, (k % 2 ? 1 : -1) * (120 + k * 40));
      c.b.at(fr.ox, fr.oz);
      boat(c.b, fr.turned(sinT(deg(90)), cosT(deg(90))), 50 + k * 8, 'barge', 0);
    }
  },
  'islands-towers': (c, lm) => {
    const r = c.rng;
    for (const [ds, side, h] of [
      [-80, 80, 46],
      [-20, 130, 58],
      [50, 90, 38],
      [110, 140, 52],
      [-50, -90, 44],
      [60, -120, 34],
    ] as const) tower(['modern', 'modern', 'glass'], h - 3, h + 3)(c, c.place.frame(lm.s + ds, side), r);
  },
  // OOST: sports fields, the science park, the office tower by a station.
  'sports-fields': (c, lm) => {
    const t = propsTex();
    // Past the end of the noise barrier (TRACK's, to about 80 m after the anchor), so they show.
    for (let k = 0; k < 2; k++) {
      const fr = c.place.frame(lm.s + 150 + k * 110, lm.side + 34).turned(sinT(deg(90)), cosT(deg(90)));
      c.b.at(fr.ox, fr.oz);
      const P = (x: number, z: number): V3 => fr.p(x, 0.03, z);
      const r = t.pitch;
      groundPoly(c.b, [P(-34, -52), P(34, -52), P(34, 52), P(-34, 52)], [r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h], TINT.white);
      for (const [x, z] of [[-38, -40], [38, -40], [-38, 40], [38, 40]]) floodlight(c.b, fr.moved(x, 0, z), 18);
      // A pool of floodlight over the pitch at night.
      const pl = glowTex().pool;
      c.b.quad('pool', 'near', fr.p(-36, 0.06, -54), fr.p(36, 0.06, -54), fr.p(36, 0.06, 54), fr.p(-36, 0.06, 54), [pl.x, pl.y, pl.x + pl.w, pl.y + pl.h], [150, 150, 140], [0, 1, 0]);
      c.place.keepOut(fr.ox, fr.oz, 62);
    }
    const club = c.place.frame(lm.s + 205, lm.side - 22);
    c.b.at(club.ox, club.oz);
    building(c.b, club, 10, 22, 4, 'brick', [126, 120, 116], { roof: false });
    gableRoof(c.b, club, 10, 22, 4, 2.4, [110, 110, 116], 'dark');
    plate(c, club.moved(0, 0, -11.2), 'SPORTPARK', 2.8, 0.22);
  },
  'science-park': (c, lm) => {
    const r = c.rng;
    for (let k = 0; k < 5; k++) office(['modern', 'glass', 'modern'], 12, 26)(c, c.place.frame(lm.s - 110 + k * 50, lm.side - r.range(0, 60)), r);
    const pf = c.place.frame(lm.s + 120, lm.side + 10);
    if (c.place.clear(pf.ox, pf.oz, 5, -10)) {
      c.b.at(pf.ox, pf.oz);
      plate(c, pf, 'SCIENCE PARK', 1.2, 0.26);
      block(c.b, 'props', 'both', pf, -2, 0, 0.05, 2, 1.2, 0.4, 'dark', TINT.white);
    }
  },
  'office-tower': (c, lm) => {
    const fr = c.place.frame(lm.s, lm.side);
    if (c.place.clear(fr.ox, fr.oz, 22)) {
      c.b.at(fr.ox, fr.oz);
      c.place.keepOut(fr.ox, fr.oz, 22);
      const f = fr.turned(sinT(0.35), cosT(0.35));
      building(c.b, f, 30, 26, 88, 'glass', [118, 128, 136], { vOff: 11 });
      building(c.b, f, 20, 18, 96, 'stone', [128, 126, 122], { vOff: 5, lit: false }, 88);
    }
    // The station beside it: a canopy, a train, its name.
    const st = c.place.frame(lm.s - 110, lm.side - 10);
    c.b.at(st.ox, st.oz);
    canopy(c, st, 14, 90, 7);
    trainCars(c, st.moved(4.5, 0, -35), 1.1, 3);
    plate(c, c.place.frame(lm.s - 156, lm.side - 10), 'AMSTEL', 8.2, 0.4);
    c.place.keepOut(st.ox, st.oz, 50);
  },
  // AMSTEL: the A2 junction, the river.
  'a2-junction': (c, lm) => {
    flyover(c, lm.s + 30, 170, -190, 9.6, -40);
  },
  'amstel-river': (c, lm) => river(c, lm.s, 52, 560, 'houseboat', 7),
  // RAI: the long exhibition halls.
  'rai-halls': (c, lm) => {
    for (let k = 0; k < 3; k++) {
      const fr = c.place.frame(lm.s - 120 + k * 95, lm.side + 20 + (k % 2) * 30);
      if (!c.place.clear(fr.ox, fr.oz, 35, -15)) continue;
      c.b.at(fr.ox, fr.oz);
      c.place.keepOut(fr.ox, fr.oz, 45);
      building(c.b, fr, 70, 85, 18, k === 1 ? 'hall' : 'shed', k === 1 ? [126, 128, 134] : [132, 132, 136], { vOff: k });
      // A saw-tooth of roof lights along the hall.
      for (let z = -36; z < 40; z += 16) gableRoof(c.b, fr.moved(0, 0, z), 70, 8, 18, 3, [118, 120, 128], 'dark');
    }
    const ent = c.place.frame(lm.s - 40, lm.side - 18);
    if (c.place.clear(ent.ox, ent.oz, 10, -12)) {
      c.b.at(ent.ox, ent.oz);
      building(c.b, ent, 16, 24, 24, 'glass', [120, 128, 136], { vOff: 2 });
      plate(c, ent.moved(0, 0, -12.2), 'EXPO', 18, 0.9);
      for (let k = 0; k < 5; k++) {
        const pole = ent.moved(-14 + k * 3, 0, -16);
        block(c.b, 'props', 'near', pole, -0.08, 0, -0.08, 0.08, 10, 0.08, 'white', TINT.white, ['right', 'left', 'front', 'back']);
        block(c.b, 'props', 'near', pole, 0.08, 8, -0.04, 2.2, 9.6, 0.04, (['red', 'blue', 'yellow', 'green', 'orange'] as const)[k], TINT.white, ['front', 'back']);
      }
    }
  },
};

/** The s of a tunnel's mouth (0: where we enter, 1: where we leave). */
function tunnelEdge(c: DressCtx, name: string, end: 0 | 1): number {
  const t = c.track.tunnels.find((x) => x.name === name);
  if (!t) return 0;
  return end === 0 ? t.s0 : t.s1;
}

/** A ship-to-shore container crane: legs, a high boom out over the water. */
function stsCrane(c: DressCtx, fr: Frame): void {
  const col: Rgb = [150, 92, 80];
  for (const [x, z] of [[-8, -9], [8, -9], [-8, 9], [8, 9]]) block(c.b, 'props', 'both', fr, x - 0.7, 0, z - 0.7, x + 0.7, 34, z + 0.7, 'red', col, ['right', 'left', 'front', 'back']);
  block(c.b, 'props', 'both', fr, -9, 30, -10, 9, 34, 10, 'red', col);
  block(c.b, 'props', 'both', fr, -1.2, 35, -40, 1.2, 37.4, 50, 'red', col, ['top', 'bottom', 'right', 'left', 'front', 'back']);
  block(c.b, 'props', 'both', fr, -3, 34, -2, 3, 40, 4, 'white', TINT.white);
}

/** Water over a tunnel's lid, both sides, from s0 to s1, out to `out` m. */
function harbourWater(c: DressCtx, s0: number, s1: number, out: number): void {
  for (let s = s0; s < s1; s += 30) {
    for (const side of [-1, 1]) {
      const a = c.place.frame(s, 0), b = c.place.frame(Math.min(s1, s + 30), 0);
      const xi = side > 0 ? 50 : -68, xo = side * out;
      const P = (f: Frame, x: number): V3 => f.p(x, 0.03, 0);
      c.b.at(a.p(xi + (xo - xi) / 2, 0, 0)[0], a.p(xi + (xo - xi) / 2, 0, 0)[2]);
      const u = flat('water');
      groundPoly(c.b, [P(a, xi), P(a, xo), P(b, xo), P(b, xi)], [u[0], u[1], u[2], u[1], u[2], u[3], u[0], u[3]], [118, 124, 128]);
      for (let x = xi; Math.abs(x) < out; x += side * 60) {
        const m = c.place.frame(s + 15, x + side * 30);
        c.place.keepOut(m.ox, m.oz, 32);
      }
    }
  }
}

/** A river crossing under a bridge at s: water along the perpendicular, reeds, trees and boats on it. */
function river(c: DressCtx, s: number, w: number, len: number, boats: 'barge' | 'houseboat', n: number): void {
  const fr0 = c.place.frame(s, -7.8);
  // The river's frame: its z runs across the road (to the right of the road at +z).
  const fr = new Frame(fr0.ox, 0, fr0.oz, fr0.rx, fr0.rz);
  for (let z = -len / 2; z < len / 2; z += 60) {
    const p = fr.p(0, 0, z + 30);
    c.b.at(p[0], p[2]);
    water(c.b, fr, z, Math.min(len / 2, z + 60), w, 0.03, 140);
  }
  c.place.keepStrip(fr, -len / 2, len / 2, w / 2 + 2);
  const r = c.rng;
  // Trees along both banks (not near the road).
  for (let z = -len / 2; z < len / 2; z += r.range(9, 16)) {
    if (Math.abs(z) < 45) continue;
    for (const bank of [-1, 1]) {
      const p = fr.p(bank * (w / 2 + r.range(4, 14)), 0, z);
      if (!c.place.clear(p[0], p[2], 2, -6)) continue;
      c.b.at(p[0], p[2]);
      tree(c.b, p[0], p[2], 0, r.range(9, 15), r.chance(0.3) ? 'poplar' : 'A', r.next(), 0.95);
    }
  }
  // Boats: houseboats moored along the banks, barges in the stream.
  for (let k = 0; k < n; k++) {
    const z = (k % 2 ? 1 : -1) * r.range(70, len / 2 - 30);
    const x = boats === 'houseboat' ? (k % 2 ? 1 : -1) * (w / 2 - 4) : r.range(-w / 4, w / 4);
    const bf = fr.moved(x, 0, z);
    c.b.at(bf.ox, bf.oz);
    boat(c.b, bf, boats === 'houseboat' ? r.range(14, 20) : r.range(40, 60), boats, 0.05);
  }
}

/** Polder parcels on one side between two s: long strips out from the road with ditches between them. */
function polder(c: DressCtx, side: 1 | -1, from: number, to: number, d0: number, d1: number): void {
  const r = c.rng;
  const tones: readonly Rgb[] = [
    [118, 132, 112],
    [128, 140, 104],
    [138, 140, 100],
    [112, 124, 116],
    [132, 120, 96],
  ];
  let s = c.s0 + from;
  while (s < c.s0 + to) {
    const w = r.range(40, 70);
    const s1 = Math.min(c.s0 + to, s + w);
    if ((c.place.flags(s) & (TF.tunnel | TF.water | TF.bridge)) === 0 && (c.place.flags(s1) & (TF.tunnel | TF.water | TF.bridge)) === 0) {
      const a = c.place.frame(s + 2, 0), b = c.place.frame(s1 - 2, 0);
      const P = (f: Frame, x: number): V3 => f.p(x, 0.02, 0);
      const m = a.p(side * (d0 + d1) / 2, 0, 0);
      c.b.at(m[0], m[2]);
      parcel(c.b, side > 0 ? [P(a, d0), P(a, d1), P(b, d1), P(b, d0)] : [P(a, -d1), P(a, -d0), P(b, -d0), P(b, -d1)], r.chance(0.2) ? 'field' : 'grass', tones[r.int(0, tones.length - 1)]);
      // The ditch along the parcel's edge (water).
      const u = flat('water');
      const e0 = c.place.frame(s1 - 2, 0), e1 = c.place.frame(s1 + 1, 0);
      groundPoly(c.b, side > 0 ? [P(e0, d0), P(e0, d1), P(e1, d1), P(e1, d0)] : [P(e0, -d1), P(e0, -d0), P(e1, -d0), P(e1, -d1)], [u[0], u[1], u[2], u[1], u[2], u[3], u[0], u[3]], [110, 118, 124]);
    }
    s = s1 + 3;
  }
}

/** The filler of each section (zones along both sides; landmarks are added after). */
const FILLER: Readonly<Record<string, (c: DressCtx, len: number) => void>> = {
  zuidas: (c, len) => {
    zone(c, 1, 0, len, 32, 90, 24, 40, [
      [office(['glass', 'stone', 'modern'], 18, 44), 4],
      [trees(['A', 'B'], 2, 4), 2],
      [billboardAt(), 0.6],
    ]);
    zone(c, 1, 0, len, 140, 260, 50, 80, [[tower(['glass', 'stone'], 40, 70), 1]]);
    zone(c, -1, 0, len, 45, 120, 26, 44, [
      [office(['stone', 'glass', 'modern'], 16, 40), 4],
      [trees(['A', 'B']), 2],
    ]);
    zone(c, -1, 0, len, 150, 260, 60, 90, [[tower(['glass', 'stone'], 36, 60), 1]]);
  },
  'nieuwe-meer': (c, len) => {
    zone(c, 1, 0, len, 24, 80, 14, 26, [
      [trees(['A', 'B', 'poplar']), 4],
      [houses(), 2],
      [billboardAt(), 0.4],
    ]);
    zone(c, 1, 100, len, 90, 220, 40, 70, [
      [flats(4, 8), 2],
      [houses(), 2],
      [trees(['A', 'B'], 4, 8), 2],
    ]);
    zone(c, -1, 0, 420, 40, 110, 16, 28, [
      [trees(['B', 'A', 'conifer'], 3, 7), 4],
      [shed(), 1],
    ]);
    polder(c, -1, 40, 400, 120, 300);
  },
  'ring-west': (c, len) => {
    zone(c, 1, 0, len, 40, 110, 30, 50, [
      [flats(4, 10), 3],
      [trees(['A', 'B']), 2],
    ]);
    zone(c, 1, 0, len, 130, 240, 50, 80, [[flats(6, 12, false), 1]]);
    zone(c, -1, 0, len, 42, 120, 28, 46, [
      [flats(4, 10, false), 3],
      [trees(['A', 'B']), 2],
      [houses(), 1],
    ]);
    zone(c, -1, 0, len, 140, 240, 50, 80, [[flats(6, 12), 1]]);
  },
  sloterdijk: (c, len) => {
    zone(c, 1, 0, len, 34, 110, 24, 40, [
      [office(['glass', 'modern', 'stone'], 16, 40), 3],
      [shed(), 1],
      [billboardAt(), 0.5],
    ]);
    zone(c, -1, 0, len, 44, 130, 26, 44, [
      [office(['glass', 'modern', 'stone'], 16, 36), 3],
      [shed(), 1],
    ]);
  },
  coentunnel: (c, len) => {
    zone(c, 1, 0, 240, 34, 120, 26, 44, [
      [shed(), 3],
      [office(['stone', 'modern'], 10, 22), 1],
      [trees(['A', 'B']), 1],
    ]);
    zone(c, -1, 0, 240, 44, 140, 26, 44, [
      [shed(), 3],
      [trees(['A', 'B']), 1],
    ]);
    zone(c, 1, 470, len, 30, 110, 24, 40, [
      [shed(), 2],
      [trees(['A', 'B', 'poplar']), 2],
    ]);
    zone(c, -1, 470, len, 44, 130, 24, 40, [
      [shed(), 2],
      [trees(['B', 'A']), 2],
    ]);
  },
  noord: (c, len) => {
    polder(c, 1, 0, len, 32, 300);
    polder(c, -1, 0, len, 48, 300);
    treeRow(c, 30, 60, len, 11, 'poplar', 14, 20);
    treeRow(c, -48, 200, len - 100, 12, 'poplar', 13, 19);
    zone(c, 1, 0, len, 80, 260, 120, 200, [
      [farm(), 3],
      [shed(), 1],
    ]);
    zone(c, -1, 0, len, 90, 280, 140, 220, [[farm(), 2], [trees(['A', 'B'], 4, 8), 2]]);
    zone(c, 1, 100, len, 20, 30, 260, 360, [[billboardAt(), 1]]);
  },
  zeeburgertunnel: (c, len) => {
    zone(c, 1, 0, 480, 30, 120, 22, 40, [
      [shed(), 2],
      [trees(['A', 'B', 'poplar']), 3],
    ]);
    zone(c, -1, 0, 480, 44, 130, 22, 40, [
      [shed(), 1],
      [trees(['B', 'A']), 3],
    ]);
    zone(c, 1, 800, len, 32, 90, 22, 36, [
      [office(['modern', 'modern', 'glass'], 14, 30), 2],
      [trees(['A', 'B']), 2],
    ]);
    zone(c, -1, 800, len, 44, 120, 24, 40, [
      [office(['modern', 'brick'], 10, 24), 2],
      [trees(['A', 'B']), 2],
    ]);
  },
  oost: (c, len) => {
    zone(c, 1, 0, len, 30, 120, 18, 30, [
      [houses(), 3],
      [trees(['A', 'B'], 3, 7), 4],
      [billboardAt(), 0.4],
    ]);
    zone(c, -1, 0, len, 40, 130, 18, 30, [
      [houses(), 2],
      [trees(['A', 'B'], 3, 7), 4],
      [office(['modern', 'glass'], 10, 22), 1],
    ]);
  },
  amstel: (c, len) => {
    zone(c, 1, 0, len, 30, 110, 22, 38, [
      [office(['stone', 'glass', 'modern'], 14, 34), 3],
      [trees(['A', 'B']), 2],
      [billboardAt(), 0.5],
    ]);
    zone(c, -1, 0, len, 44, 130, 24, 40, [
      [shed(), 1],
      [office(['stone', 'modern'], 12, 30), 2],
      [trees(['A', 'B']), 2],
    ]);
  },
  rai: (c, len) => {
    zone(c, -1, 0, len, 44, 130, 24, 40, [
      [office(['glass', 'stone'], 16, 40), 3],
      [trees(['A', 'B']), 1],
    ]);
    zone(c, 1, 0, len, 160, 260, 50, 80, [[tower(['glass', 'stone'], 36, 60), 1]]);
  },
};

/**
 * Dress the A10: the lamp posts on the central barrier, the landmarks (first: they reserve their
 * ground) and the filler of every section.
 */
export function dressA10(track: A10Track, b: WorldBatch): DressReport {
  initPlace((n) => flat(n));
  const place = new Placer(track);
  const out: DressReport = { landmarks: {}, anims: [] };
  const c: DressCtx = { track, b, place, rng: new Rng('rally/world/sections'), s0: 0 };
  for (const sec of track.sections) out.landmarks[sec.id] = [];
  // The central lamp posts: every 50 m outside the tubes (on the barrier's middle).
  const cb = -7.5 - 0.3;
  for (let s = 25; s < track.length; s += 50) {
    if ((track.flagsAt(s) & TF.tunnel) !== 0) continue;
    const h = place.height(s);
    const fr = place.frame(s, 0);
    b.at(fr.p(cb, 0, 0)[0], fr.p(cb, 0, 0)[2]);
    centralLamp(b, new Frame(fr.ox, 0, fr.oz, fr.fx, fr.fz), h, cb);
  }
  // Landmarks first (they keep their ground clear of the filler).
  for (const lm of track.landmarks) {
    const fn = LANDMARKS[lm.id];
    const sec = track.sections[lm.section];
    if (!fn || !sec) continue;
    c.rng = new Rng(`rally/world/landmark/${lm.id}`);
    c.s0 = sec.s0;
    const before = out.landmarks[sec.id].length;
    fn(c, lm, out);
    if (out.landmarks[sec.id].length === before) out.landmarks[sec.id].push(lm.id);
  }
  // The filler.
  for (const sec of track.sections) {
    const fn = FILLER[sec.id];
    if (!fn) continue;
    c.rng = new Rng(`rally/world/filler/${sec.id}`);
    c.s0 = sec.s0;
    fn(c, sec.s1 - sec.s0);
  }
  return out;
}

/** Billboards placed by hand near the start (the first thing the player reads). */
export function startBillboards(track: A10Track, b: WorldBatch): void {
  const place = new Placer(track);
  for (const [s, k] of [
    [track.startS + 260, 3],
    [track.startS + 900, 0],
  ] as const) {
    const fr = place.frame(s, 19);
    b.at(fr.ox, fr.oz);
    billboard(b, fr, k);
  }
}

export { building, fits, gableRoof };
