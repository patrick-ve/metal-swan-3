/**
 * Sprites of content area `ring/gangs` (docs/design/ring.md §5.2, §5.4, §8, §9, §11;
 * docs/ART_GUIDE.md "UHD art"; docs/api/ring.md "Wave B: gangs"). Every id has 1× art (the 64-colour
 * palette) and 2× / 4× art from ONE density-generic drawer: art-van.ts (the parcel van),
 * art-caravan.ts (the caravan), art-people.ts (the crews, the courier, the gunner), and here the
 * parcel and the NIET THUIS card. Outline A for everything that moves or can be hit. Rare strips
 * (the gloat, the cower, tumbles, the card, the tip-over) are deferred.
 *
 * Prefixes (the tier-4 families of ring/art-def.ts): `ring/parcel-van/` (the van, its rear, brake
 * lights, grille, crew, courier, driver, the parcel, the card) and `ring/caravan/` (the caravan,
 * its door, grille, drawbar, tip-over and gunner). The caravan's tow car is a civilian
 * `ring/car/<model>-<colour>` body with `ring/car/wheel-s` (unchanged, always resident).
 */
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas } from '../../../art/hd';
import { mat, top, type Dn } from '../../stag/kit.art';
import { frameOf, letterAt } from './art-kit';
import { caravanBodyFrame, caravanGrilleFrame, caravanOpenFrame, caravanTipFrame, drawbarFrame } from './art-caravan';
import {
  COURIER,
  courierCowerFrames,
  courierStickFrames,
  courierWalkFrames,
  CREW,
  crewCowerFrames,
  crewGloatFrames,
  crewIdleFrames,
  crewShootFrames,
  crewTellShootFrames,
  crewTellThrowFrames,
  crewThrowFrames,
  GUNNER,
  gunnerCowerFrames,
  gunnerGloatFrames,
  gunnerRideFrames,
  gunnerShootFrames,
  gunnerTellFrames,
  parcelBuf,
  sitFrames,
  tumbleFrames,
} from './art-people';
import { brakeFrame, vanBodyFrame, vanGrilleFrame, vanRearFrame } from './art-van';
import { CARAVAN_ART, CARD, PARCEL, VAN_ART } from './geometry';

// ---------------------------------------------------------------------------------------------
// The parcel and the card
// ---------------------------------------------------------------------------------------------

/** Parcel tumble angles (deg); the last frame lies flat, a little crushed. */
export const PARCEL_TUMBLE = [0, 24, 48, 72] as const;

/** A parcel frame: 0–3 tumbling (centre anchor), 4 lying on the road. */
export function parcelFrame(f: number, d: Dn): Frame {
  const n = PARCEL.frame;
  const k = (n - 1) / 2;
  const buf = f < 4 ? parcelBuf(n, PARCEL.w, PARCEL.h, PARCEL_TUMBLE[f], d) : parcelBuf(n, PARCEL.w, PARCEL.h, 0, d, true);
  return frameOf(buf, k, k, d);
}

/** The NIET THUIS card (centre anchor): white card, a pink band, our own lettering in navy. */
export function cardFrame(d: Dn): Frame {
  const W = CARD.w;
  const H = CARD.h;
  const c = new HdCanvas(W + 2, H + 2, d);
  const white = mat(c, 'snow', { spec: 0.3, shine: 20, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const pink = mat(c, 'pink', { spec: 0.3, shine: 20, lo1: 1, hi1: 3, lo: 3, hi: 5 });
  c.box(1, 1, W, H, { mat: white, z: 1, r: 0.6, bevel: 0.5, tex: (t) => (t.y < 3.4 ? void (t.mat = pink) : undefined) });
  const ink = top('navy', d, d === 1 ? 3 : 4);
  const cx = W / 2 + 1;
  c.paint(1, 1, W, H, (x, y) => (letterAt(d, 'NIET', cx, 7.2, 1, x, y) || letterAt(d, 'THUIS', cx, 13.2, 1, x, y) ? ink : 0));
  const buf = c.render({ outline: 'A', ao: 0.1, rimLight: d === 1 ? 0 : 2 });
  return frameOf(buf, Math.floor((W + 2) / 2), Math.floor((H + 2) / 2), d);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

type Gen = (d: Dn) => Frame[];
const def = (id: string, gen: Gen, o: { ticksPerFrame?: number; loop?: boolean; defer?: boolean } = {}): void => defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d as Dn) });

const V = `${VAN_ART}/`;
const C = `${CARAVAN_ART}/`;

// The parcel van.
def(V + 'body', (d) => [0, 1].map((s) => vanBodyFrame(s, d)));
def(V + 'rear', (d) => [0, 1, 2].map((f) => vanRearFrame(f, d)), { ticksPerFrame: 7, loop: false });
def(V + 'brake', (d) => [0, 1].map((f) => brakeFrame(f, d)));
def(V + 'grille', (d) => [0, 1].map((s) => vanGrilleFrame(s, d)));
def(V + 'crew/idle', crewIdleFrames, { ticksPerFrame: 18 });
def(V + 'crew/tell-throw', crewTellThrowFrames, { ticksPerFrame: 7, loop: false });
def(V + 'crew/throw', crewThrowFrames, { ticksPerFrame: 5, loop: false });
def(V + 'crew/tell-shoot', crewTellShootFrames, { ticksPerFrame: 7, loop: false });
def(V + 'crew/shoot', crewShootFrames, { ticksPerFrame: 4 });
def(V + 'crew/gloat', crewGloatFrames, { ticksPerFrame: 10, defer: true });
def(V + 'crew/cower', crewCowerFrames, { ticksPerFrame: 4, defer: true });
def(V + 'crew/tumble', (d) => tumbleFrames(CREW, d), { ticksPerFrame: 4, defer: true });
def(V + 'crew/sit', (d) => sitFrames(CREW, d), { ticksPerFrame: 30, defer: true });
def(V + 'driver/tumble', (d) => tumbleFrames(COURIER, d), { ticksPerFrame: 4, defer: true });
def(V + 'driver/sit', (d) => sitFrames(COURIER, d), { ticksPerFrame: 30, defer: true });
def(V + 'courier/walk', courierWalkFrames, { ticksPerFrame: 6, defer: true });
def(V + 'courier/stick', courierStickFrames, { ticksPerFrame: 14, loop: false, defer: true });
def(V + 'courier/cower', courierCowerFrames, { ticksPerFrame: 4, defer: true });
def(V + 'parcel', (d) => [0, 1, 2, 3, 4].map((f) => parcelFrame(f, d)), { ticksPerFrame: 4 });
def(V + 'card', (d) => [cardFrame(d)], { defer: true });

// The caravan.
def(C + 'body', (d) => [caravanBodyFrame(false, false, d), caravanBodyFrame(true, false, d), caravanBodyFrame(false, true, d), caravanBodyFrame(true, true, d)]);
def(C + 'open', (d) => [caravanOpenFrame(d)]);
def(C + 'grille', (d) => [0, 1].map((s) => caravanGrilleFrame(s, d)));
def(C + 'drawbar', (d) => [0, 1, 2].map((f) => drawbarFrame(f, d)));
def(C + 'tip', (d) => [0, 1, 2, 3].map((f) => caravanTipFrame(f, d)), { ticksPerFrame: 6, loop: false, defer: true });
def(C + 'gunner/ride', gunnerRideFrames, { ticksPerFrame: 20 });
def(C + 'gunner/tell', gunnerTellFrames, { ticksPerFrame: 7, loop: false });
def(C + 'gunner/shoot', gunnerShootFrames, { ticksPerFrame: 4 });
def(C + 'gunner/gloat', gunnerGloatFrames, { ticksPerFrame: 16, defer: true });
def(C + 'gunner/cower', gunnerCowerFrames, { ticksPerFrame: 4, defer: true });
def(C + 'gunner/tumble', (d) => tumbleFrames(GUNNER, d), { ticksPerFrame: 4, defer: true });
def(C + 'gunner/sit', (d) => sitFrames(GUNNER, d), { ticksPerFrame: 30, defer: true });
