/**
 * Mission `ams` UHD decor of sections a (GRACHTENGORDEL) and b (MUSEUMPLEIN) and the street decor
 * they share with c and d (docs/ART_GUIDE.md "UHD art"): registers ONE density-generic generator
 * per id for its 2× and 4× art (`defineHdSprite`; drawers in art-hd-ab-*.ts). The mission module
 * imports it after the section files, so the sized ids the sections registered (bridges, awnings,
 * lawn, pool, balustrade) exist and get their HD art too (`SIZED`). Ids another file
 * already draws (sections c / d, the breakables, the boats: art-hd-cd*.ts; the canal water pieces:
 * art-hd-terrain-water.ts) are left to it; the
 * canal houses of the golden and sunset lights (sections c, d) are filled in here when no other
 * file registered them. Morning and noon keep the HD light (`lightHd`), so the noon ids are dense
 * aliases of the morning ones (`defineDenseAlias`: built and held once; 1× stays its own).
 */
import { listSprites, defineDenseAlias, defineHdSprite, hasHiSprite, type DenseDensity } from '../../../../engine/sprites';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { HOUSE_VARIANTS, LIGHTS, type Light } from './art';
import { fr, lightHd } from './art-hd-ab-kit';
import { fabelCounterHd, fabelFrietHd, fabelSignHd, houseHd, neighbourHd } from './art-hd-ab-houses';
import { bridgeFaceHd, bridgeRailHd, drawbridgeHd, lawnHd, poolHd } from './art-hd-ab-canal';
import { rijksmuseumHd } from './art-hd-ab-museum';
import {
  awningHd,
  balustradeHd,
  benchHd,
  bikeFramesHd,
  bikeRackHd,
  bollardHd,
  cabinetHd,
  elmHd,
  flagHd,
  flagRedHd,
  hotdogStandHd,
  lampGreyHd,
  lampHd,
  smokeHd,
  tulipsHd,
} from './art-hd-ab-street';

const D = 'decor/ams/';

type Gen = (d: DenseDensity) => Frame | Frame[];

/** A light-independent render per density, recoloured per light (the 1× `applyLight` scheme). */
function perLight(paint: (d: DenseDensity) => readonly Frame[]): (light: Light, d: DenseDensity) => Frame[] {
  const cache = new Map<DenseDensity, readonly Frame[]>();
  return (light, d) => {
    let base = cache.get(d);
    if (!base) {
      base = paint(d);
      cache.set(d, base);
    }
    return base.map((f) => fr(lightHd(f.buf.clone(), light), f.ox, f.oy, d));
  };
}

const houses = perLight((d) => HOUSE_VARIANTS.map((s) => houseHd(s, d)));
const fabel = perLight((d) => [fabelFrietHd('morning', d)]);
const neighbours = perLight((d) => [neighbourHd('morning', d)]);

/** Lights of the house rows in sections a and b; golden (c) and sunset (d) only when no other file draws them. */
const OWN_LIGHTS: readonly Light[] = ['morning', 'noon'];
const free = (id: string): boolean => !hasHiSprite(id, 2) && !hasHiSprite(id, 4);

/** Every fixed a / b decor id with UHD art → its generator (tests, tools). */
export const AB_HD = new Map<string, Gen>();
for (const light of LIGHTS) {
  const id = `${D}house-${light}`;
  if (OWN_LIGHTS.includes(light) || free(id)) AB_HD.set(id, (d) => houses(light, d));
  AB_HD.set(`${D}fabel-friet-${light}`, (d) => fabel(light, d));
  AB_HD.set(`${D}neighbour-${light}`, (d) => neighbours(light, d));
}
const FIXED: readonly (readonly [string, Gen])[] = [
  ['fabel-sign', fabelSignHd],
  ['fabel-counter', fabelCounterHd],
  ['drawbridge', drawbridgeHd],
  ['rijksmuseum', rijksmuseumHd],
  ['lamp', lampHd],
  ['bollard', bollardHd],
  ['bike', bikeFramesHd],
  ['bike-rack', bikeRackHd],
  ['bench', benchHd],
  ['elm', elmHd],
  ['tulips', tulipsHd],
  ['flag-ams', (d) => flagHd(d, [PAL_HD.red, PAL_HD.black, PAL_HD.red], true)],
  ['flag-nl', (d) => flagHd(d, [PAL_HD.red, PAL_HD.snow, PAL_HD.sky], false)],
  ['smoke', smokeHd],
  ['hotdog-stand', (d) => hotdogStandHd(d)],
  ['hotdog-front', (d) => hotdogStandHd(d, true)],
  ['flag-red', flagRedHd],
  ['cabinet', cabinetHd],
  ['lamp-grey', lampGreyHd],
];
for (const [id, gen] of FIXED) AB_HD.set(`${D}${id}`, gen);

/** Sized decor ids (registered by the art.ts helpers) → their UHD generator. */
export const SIZED: readonly (readonly [RegExp, (m: RegExpMatchArray) => Gen])[] = [
  [/^bridge-rail-(\d+)x(\d+)$/, (m) => (d) => bridgeRailHd(Number(m[1]), Number(m[2]), d)],
  [/^bridge-face-(\d+)x(\d+)$/, (m) => (d) => bridgeFaceHd(Number(m[1]), Number(m[2]), d)],
  [/^lawn-(\d+)$/, (m) => (d) => lawnHd(Number(m[1]), d)],
  [/^pool-(\d+)$/, (m) => (d) => poolHd(Number(m[1]), d)],
  [/^awning-(\d+)$/, (m) => (d) => awningHd(Number(m[1]), d)],
  [/^balustrade-(\d+)$/, (m) => (d) => balustradeHd(Number(m[1]), d)],
];

/** The UHD generator of a sized decor id (`decor/ams/bridge-rail-160x14` …), or null. */
export function sizedHd(id: string): Gen | null {
  if (!id.startsWith(D)) return null;
  for (const [re, gen] of SIZED) {
    const m = id.slice(D.length).match(re);
    if (m) return gen(m);
  }
  return null;
}

for (const id of listSprites(D)) {
  if (AB_HD.has(id) || !free(id)) continue;
  const gen = sizedHd(id);
  if (gen) AB_HD.set(id, gen);
}

for (const [id, gen] of AB_HD) defineHdSprite(id, gen);
// The same picture (no remap for either light): section b's noon row draws the morning frames.
for (const name of ['house', 'fabel-friet', 'neighbour']) defineDenseAlias(`${D}${name}-noon`, `${D}${name}-morning`);
