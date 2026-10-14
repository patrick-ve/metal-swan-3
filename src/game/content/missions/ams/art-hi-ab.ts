/**
 * Mission `ams` 2× decor of sections a (GRACHTENGORDEL) and b (MUSEUMPLEIN) and the decor they
 * share with c and d (docs/ART_GUIDE.md "2x art (mission ams)"): registers the 2× twins of the
 * art.ts / npc.art.ts decor ids. The mission module imports it after the section files, so the
 * sized ids the sections registered (bridges, awnings, houseboats, water, lawn, pool) exist and get
 * their twins too (`SIZED`). Ids only sections c and d use (art-hi-cd.ts) are filled in here only
 * when that file did not register them.
 */
import { applyLight, HOUSE_VARIANTS, LIGHTS, type Light } from './art';
import { defineHiSprite, hasHiSprite, listSprites } from '../../../../engine/sprites';
import { PAL } from '../../../../engine/palette';
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { bridgeFaceHi, bridgeRailHi, drawbridgeHi, houseboatHi, lawnHi, poolHi, rijksmuseumHi, waterBackHi, waterSurfaceHi, waterTintHi } from './art-hi-ab-canal';
import { fabelCounterHi, fabelFrietHi, fabelSignHi, neighbourHi } from './art-hi-ab-fabel';
import { paintHouseHi } from './art-hi-ab-houses';
import {
  awningHi,
  balustradeHi,
  benchHi,
  bikeFramesHi,
  bikeRackBreakHi,
  bikeRackHi,
  bollardHi,
  cabinetHi,
  elmHi,
  flagHi,
  flagRedHi,
  herringCartHi,
  hotdogFrontHi,
  hotdogStandHi,
  lampGreyHi,
  lampHi,
  smokeHi,
  tulipStallHi,
  tulipsHi,
} from './art-hi-ab-street';

const D = 'decor/ams/';

/** The 2× houses before the light (painted once, recoloured per light). */
let houses: readonly Frame[] | null = null;
function housesHi(): readonly Frame[] {
  houses ??= HOUSE_VARIANTS.map((s) => paintHouseHi(s));
  return houses;
}

/** Lights of the house rows in sections a and b; golden (c) and sunset (d) only as a fallback. */
const OWN_LIGHTS: readonly Light[] = ['morning', 'noon'];
for (const light of LIGHTS) {
  const id = `${D}house-${light}`;
  if (OWN_LIGHTS.includes(light) || !hasHiSprite(id)) {
    defineHiSprite(id, () => housesHi().map((f) => ({ ...f, buf: applyLight(f.buf.clone(), light) })));
  }
}

for (const light of LIGHTS) {
  defineHiSprite(`${D}fabel-friet-${light}`, () => fabelFrietHi(light));
  defineHiSprite(`${D}neighbour-${light}`, () => neighbourHi(light));
}
defineHiSprite(`${D}fabel-sign`, fabelSignHi);
defineHiSprite(`${D}fabel-counter`, fabelCounterHi);
defineHiSprite(`${D}drawbridge`, drawbridgeHi);
defineHiSprite(`${D}rijksmuseum`, rijksmuseumHi);
defineHiSprite(`${D}lamp`, lampHi);
defineHiSprite(`${D}bollard`, bollardHi);
defineHiSprite(`${D}bike`, bikeFramesHi);
defineHiSprite(`${D}bike-rack`, bikeRackHi);
defineHiSprite(`${D}bench`, benchHi);
defineHiSprite(`${D}elm`, elmHi);
defineHiSprite(`${D}tulips`, tulipsHi);
defineHiSprite(`${D}flag-ams`, () => flagHi([PAL.red[2], PAL.ink[1], PAL.red[2]], true));
defineHiSprite(`${D}flag-nl`, () => flagHi([PAL.red[2], PAL.snow[3], PAL.sky[0]], false));
defineHiSprite(`${D}smoke`, smokeHi);
defineHiSprite(`${D}hotdog-stand`, hotdogStandHi);
defineHiSprite(`${D}hotdog-front`, hotdogFrontHi);
defineHiSprite(`${D}flag-red`, flagRedHi);
defineHiSprite(`${D}cabinet`, cabinetHi);
defineHiSprite(`${D}lamp-grey`, lampGreyHi);
defineHiSprite(`${D}ams-herring-cart`, herringCartHi);
defineHiSprite(`${D}ams-tulip-stall`, tulipStallHi);
defineHiSprite(`${D}ams-bike-rack`, bikeRackBreakHi);

/** Sized decor ids (registered by the art.ts helpers) → their 2× generator. */
const SIZED: readonly (readonly [RegExp, (m: RegExpMatchArray) => () => Frame | Frame[] | PixelBuffer | PixelBuffer[]])[] = [
  [/^bridge-rail-(\d+)x(\d+)$/, (m) => () => bridgeRailHi(Number(m[1]), Number(m[2]))],
  [/^bridge-face-(\d+)x(\d+)$/, (m) => () => bridgeFaceHi(Number(m[1]), Number(m[2]))],
  [/^houseboat-(\d+)x(\d+)-(\d+)-(\d+)-(\d+)$/, (m) => () => houseboatHi(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]))],
  [/^water-(\d+)x(\d+)$/, (m) => () => waterSurfaceHi(Number(m[1]))],
  [/^water-(\d+)x(\d+)-back$/, (m) => () => waterBackHi(Number(m[1]), Number(m[2]))],
  [/^water-(\d+)x(\d+)-tint$/, (m) => () => waterTintHi(Number(m[1]), Number(m[2]))],
  [/^lawn-(\d+)$/, (m) => () => lawnHi(Number(m[1]))],
  [/^pool-(\d+)$/, (m) => () => poolHi(Number(m[1]))],
  [/^awning-(\d+)$/, (m) => () => awningHi(Number(m[1]))],
  [/^balustrade-(\d+)$/, (m) => () => balustradeHi(Number(m[1]))],
];

for (const id of listSprites(D)) {
  if (hasHiSprite(id)) continue;
  for (const [re, gen] of SIZED) {
    const m = id.slice(D.length).match(re);
    if (m) defineHiSprite(id, gen(m));
  }
}
