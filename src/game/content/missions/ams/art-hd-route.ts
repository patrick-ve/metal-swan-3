/**
 * UHD art (2× and 4×, docs/ART_GUIDE.md "UHD art") of the route choice and the canal cruise of
 * mission ams (docs/design/ams-extras.md §4; 1× art in art-route.ts): ONE density-generic drawer
 * per id (d 2 and 4), PAL_HD, the 1× frame's logical size and anchor. Registered here with
 * `defineHdSprite`; `ROUTE_HD` lists every id with its generator (tests, tools).
 *
 * Files:
 * - `art-hd-route-boat.ts`: the cruise boat (outline A, the wake after the outline), the route
 *   signs and the pontoon (outline C).
 * - `art-hd-route-bridges.ts`: the low bridges (face and back), the Magere Brug (the bascule's 4
 *   frames and the portals; outline C) and Carré (painted, no outline).
 * - here: the water pieces of section c's jetty basin (a lower water line than the canal).
 * - `art-hd-bg-amstel.ts`: the `ams-amstel` background layer (imported by index.ts).
 */
import type { Frame } from '../../../../engine/render';
import { defineHdSprite, type DenseDensity } from '../../../../engine/sprites';
import { waterSprite } from './art';
import { waterBackHd, waterSurfaceHd, waterTintHd } from './art-hd-terrain-water';
import { ROUTE_BOAT_HD } from './art-hd-route-boat';
import { ROUTE_BRIDGES_HD } from './art-hd-route-bridges';
import { C_BASIN, C_BASIN_Y } from './terrain';

/** Every route / cruise decor id with UHD art → its generator (d 2 or 4). */
export const ROUTE_HD: ReadonlyMap<string, (d: DenseDensity) => Frame[]> = new Map([...ROUTE_BOAT_HD, ...ROUTE_BRIDGES_HD]);

for (const [id, gen] of ROUTE_HD) defineHdSprite(id, gen);

// The jetty basin of section c (a lower water line): its water pieces at d 2 and 4.
const BASIN_H = 216 - C_BASIN_Y;
for (let x = C_BASIN[0]; x < C_BASIN[1]; x += 128) {
  const w = Math.min(128, C_BASIN[1] - x);
  // The 1× piece first (section c registers it with its decor; this module may load before it).
  const id = waterSprite(w, BASIN_H);
  defineHdSprite(`${id}-back`, (d) => waterBackHd(w, BASIN_H, d));
  defineHdSprite(`${id}-tint`, (d) => waterTintHd(w, BASIN_H, d));
  defineHdSprite(id, (d) => waterSurfaceHd(w, d));
}
