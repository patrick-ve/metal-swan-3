/**
 * The decor of oat-a DE 9 STRAATJES (STREET-A, wave A; docs/design/oat.md §2.1, §8.7 a 3–7, §8.2):
 * where every street prop, shop front, canal vista and background figure stands, in world x and
 * floor depth (px behind the walk line; the floor camera of floor/layout.ts). The section file sets
 * `decor: OAT_A_DECOR`; floor/a.ts reads the same list for the rows' gaps and the cast shadows (one
 * source of truth: LIGHT-WATER's `castersFromDecor`), so art, rows and shadows agree.
 *
 * Depths (floor/layout.ts): the façade plane 16 (shop fronts, vistas, the far banks, the TE KOOP
 * house, plates, hanging signs and flags drawn 1:1 at s 0.862, so a world span of w px is w · 0.862
 * art px wide), bikes against the fronts 14.6, door plants 15.2, the far pavement's furniture
 * 12.8–13.6, span-wire lamps over the middle of the street 4, the front decor in front of the walk
 * line (−13.6 the bridges' near railings, −15.5 a staple with a bike, a café chair).
 *
 * Street logic (spec §8.7 a): no masts in the narrow streets (span-wire lamps), lantern posts on the
 * quays and the bridges, Amsterdammertjes along both kerbs (floor/a.ts rows), bikes everywhere, ≤ 4
 * background figures per screen, nothing in the walk plane but what the script spawns.
 */
import type { DecorDef } from '../../../../mission/types';
import { G, OAT_A } from '../terrain';

/** Depths of oat-a's decor (floor depth px). */
export const A_DEPTH = {
  facade: 16,
  railBack: 15.5,
  bridgeLamp: 15,
  plant: 15.2,
  bike: 14.6,
  elm: 14.2,
  person: 14.2,
  chalkboard: 13.6,
  quayLamp: 13.4,
  column: 12.8,
  span: 4,
  railFront: -13.6,
  front: -15.5,
} as const;

/** Heights over the façade base (world px) of the things on the walls (spec §8.2: 20 px/m in the band). */
const PLATE_Y = G - 48;
const SIGN_Y = G - 78;
const FLAG_Y = G - 86;
/** The span-wire lamps hang about 6 m over the street (true scale). */
const SPAN_Y = G - 116;

/** GRAMMAR's blank shop-front slots that these shop sprites fill (world x [u0, u1); spec §2.1). */
export const A_SHOP_SLOTS: readonly { readonly id: string; readonly u0: number; readonly u1: number; readonly sprite: string }[] = [
  { id: 'haverbar', u0: OAT_A.haverbar[0], u1: OAT_A.haverbar[1], sprite: 'decor/oat/a/haverbar' },
  { id: 'boutique-kaars', u0: 1180, u1: 1244, sprite: 'decor/oat/a/boutique-kaars' },
  { id: 'conceptstore', u0: OAT_A.conceptstore[0], u1: OAT_A.conceptstore[1], sprite: 'decor/oat/a/conceptstore' },
  { id: 'boutique-zeep', u0: 3420, u1: 3484, sprite: 'decor/oat/a/boutique-zeep' },
];

/** The hijsbalk's warehouse lot (GRAMMAR's `hoist` slot; the set piece hangs from its beam at 2,240). */
export const A_HOIST_SLOT = { id: 'hijsbalk', u0: 2196, u1: 2284, x: OAT_A.hoistX } as const;

/** The quay elms (painter.ts `A_ELMS` lays their leaves on the floor under them). */
export const A_ELM_X: readonly number[] = [60, 236, 4140, 4300];

function d(sprite: string, x: number, depth: number, o: Partial<DecorDef> = {}): DecorDef {
  return { sprite, x, y: G, depth, ...o };
}

const BIKES: readonly (readonly [number, number, boolean])[] = [
  // [x, variant 1–4, flipped]
  [112, 2, false],
  [176, 4, true],
  [596, 1, false],
  [642, 3, true],
  [858, 4, false],
  [1118, 2, true],
  [1398, 1, true],
  [1494, 3, false],
  [1846, 2, false],
  [2006, 4, true],
  [2378, 1, false],
  [2462, 3, true],
  [2652, 2, false],
  [3096, 3, true],
  [3252, 1, false],
  [3702, 4, false],
  [3958, 2, true],
  [4182, 3, false],
];

/** oat-a's decor, far to near (the view sorts by depth). */
export function oatADecor(): DecorDef[] {
  const out: DecorDef[] = [];
  const F = A_DEPTH.facade;
  // The far banks across the canal on the open quays, the canal vistas at the three bridges.
  out.push(d('decor/oat/a/farbank-prinsengracht', -32, F));
  out.push(d('decor/oat/a/farbank-singel', OAT_A.streets.singel[0], F));
  const vistas = ['prinsengracht', 'keizersgracht', 'herengracht'];
  OAT_A.bridges.forEach(([x0, x1], i) => {
    out.push(d(`decor/oat/a/vista-${vistas[i]}`, x0, F));
    out.push(d('decor/oat/a/bridge-rail-back', x0, A_DEPTH.railBack));
    out.push(d('decor/oat/a/lantern', x0 + 10, A_DEPTH.bridgeLamp));
    out.push(d('decor/oat/a/lantern', x1 - 10, A_DEPTH.bridgeLamp));
    // The near railing: front decor at the deck's near edge, only with the floor (the flat view has no deck).
    out.push(d('decor/oat/a/bridge-rail-front', x0, A_DEPTH.railFront, { front: true, floorOnly: true }));
  });
  // The shop fronts in GRAMMAR's slots, the TE KOOP house on the Singel.
  for (const s of A_SHOP_SLOTS) out.push(d(s.sprite, s.u0, F));
  out.push(d('decor/oat/a/te-koop', OAT_A.teKoop[0], F));
  // Street-name plates on the corner houses (spec §8.7 a 5).
  const plates: readonly (readonly [string, number])[] = [
    ['berenstraat', 552],
    ['keizersgracht', 1520],
    ['wolvenstraat', 1800],
    ['herengracht', 2764],
    ['oude-spiegelstraat', 3048],
    ['singel', 4040],
  ];
  for (const [slug, x] of plates) out.push({ sprite: `decor/oat/a/plate-${slug}`, x, y: PLATE_Y, depth: F });
  // Hanging signs on wrought-iron brackets and short flags (anchored at the wall): seven kinds over
  // the ten places, none more than twice and never twice in one screen (spec §8.13 Variety).
  const signs: readonly (readonly [number, number])[] = [
    [620, 1],
    [930, 2],
    [1330, 3],
    [1470, 4],
    [2030, 5],
    [2510, 6],
    [2706, 7],
    [3156, 1],
    [3610, 6],
    [3896, 2],
  ];
  for (const [x, k] of signs) out.push({ sprite: `decor/oat/a/hanging-sign-${k}`, x, y: SIGN_Y, depth: F });
  for (const [x, k] of [
    [1056, 1],
    [2330, 2],
    [3760, 1],
  ] as const)
    out.push({ sprite: `decor/oat/a/flag-${k}`, x, y: FLAG_Y, depth: F });
  // Span-wire lamps over the narrow streets (no masts there), lantern posts on the open quays.
  for (const x of [804, 1296, 2110, 2604, 3300, 3812]) out.push({ sprite: 'decor/oat/a/span-lamp', x, y: SPAN_Y, depth: A_DEPTH.span });
  for (const x of [150, 4224]) out.push(d('decor/oat/a/lantern', x, A_DEPTH.quayLamp));
  // The quay elms (late September: green, the first yellow leaves).
  A_ELM_X.forEach((x, i) => out.push(d(`decor/oat/a/elm-${(i % 2) + 1}`, x, A_DEPTH.elm, { flipX: i === 2 })));
  // Bikes against the fronts and on the quays.
  for (const [x, k, flip] of BIKES) out.push(d(`decor/oat/a/bike-${k}`, x, A_DEPTH.bike, { flipX: flip }));
  // Door plants, chalkboards, the waste columns, a power cabinet on the Singel quay.
  for (const [x, k] of [
    [782, 1],
    [1262, 2],
    [1990, 1],
    [2566, 2],
    [3526, 1],
  ] as const)
    out.push(d(`decor/oat/a/plant-${k}`, x, A_DEPTH.plant));
  for (const x of [690, 2522, 3392]) out.push(d('decor/oat/a/chalkboard', x, A_DEPTH.chalkboard));
  for (const x of [1060, 3160, 4262]) out.push(d('decor/oat/a/waste-column', x, A_DEPTH.column));
  out.push(d('decor/oat/a/power-box', 4116, A_DEPTH.column));
  // Life (spec §8.7 a 7, modest: ≤ 4 figures per screen): a shopkeeper putting out a sign, a cyclist on
  // bridge 48 in depth, a street sweeper in the Oude Spiegelstraat. No outline, at their depth.
  out.push(d('decor/oat/a/person-shopkeeper', 1250, A_DEPTH.person));
  out.push(d('decor/oat/a/person-cyclist', 1690, A_DEPTH.railBack - 0.3));
  out.push(d('decor/oat/a/person-sweeper', 3980, A_DEPTH.person, { flipX: true }));
  // The front: a staple with a bike, a café chair (≥ 34 px apart; floor/a.ts keeps the rows clear of them).
  out.push(d('decor/oat/a/staple', 1044, A_DEPTH.front, { front: true }));
  out.push(d('decor/oat/a/bike-3', 1044, A_DEPTH.front - 0.4, { front: true }));
  out.push(d('decor/oat/a/cafe-chair', 826, A_DEPTH.front, { front: true }));
  out.push(d('decor/oat/a/staple', 2690, A_DEPTH.front, { front: true }));
  out.push(d('decor/oat/a/bike-1', 2690, A_DEPTH.front - 0.4, { front: true, flipX: true }));
  out.push(d('decor/oat/a/cafe-chair', 3500, A_DEPTH.front, { front: true, flipX: true }));
  return out;
}

/** oat-a's decor (built once). */
export const OAT_A_DECOR: readonly DecorDef[] = oatADecor();

/**
 * oat-a's façade rows for GRAMMAR's strip source (spec §8.6; `SectionDef.strips.rows`): the three
 * 9 Straatjes streets and the Singel's row after the TE KOOP house, with the shop slots this file's
 * shop sprites fill and the hijsbalk's warehouse. Wet 0.6 (spec §8.10: after a night of rain).
 */
export const A_STRIP_ROWS = [
  { u0: OAT_A.streets.berenstraat[0], u1: OAT_A.streets.berenstraat[1], sheet: '9-straatjes', params: { streetM: 8.3, wet: 0.6, name: 'berenstraat', slots: slotsIn(OAT_A.streets.berenstraat) } },
  { u0: OAT_A.streets.wolvenstraat[0], u1: OAT_A.streets.wolvenstraat[1], sheet: '9-straatjes', params: { streetM: 8.2, wet: 0.6, name: 'wolvenstraat', slots: [...slotsIn(OAT_A.streets.wolvenstraat), { u0: A_HOIST_SLOT.u0, u1: A_HOIST_SLOT.u1, kind: 'hoist', x: A_HOIST_SLOT.x, id: A_HOIST_SLOT.id }] } },
  { u0: OAT_A.streets.oudeSpiegelstraat[0], u1: OAT_A.streets.oudeSpiegelstraat[1], sheet: '9-straatjes', params: { streetM: 6.6, wet: 0.6, name: 'oude-spiegelstraat', slots: slotsIn(OAT_A.streets.oudeSpiegelstraat) } },
  { u0: OAT_A.teKoop[1], u1: OAT_A.w, sheet: 'canal-front', params: { wet: 0.6, name: 'singel' } },
] as const;

function slotsIn([a, b]: readonly [number, number]): { u0: number; u1: number; kind: 'slot'; id: string }[] {
  return A_SHOP_SLOTS.filter((s) => s.u0 >= a && s.u1 <= b).map((s) => ({ u0: s.u0, u1: s.u1, kind: 'slot' as const, id: s.id }));
}
