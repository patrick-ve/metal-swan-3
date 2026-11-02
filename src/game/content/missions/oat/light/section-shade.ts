/**
 * The shade model of each oat section (docs/design/oat.md §8.3, §8.4; docs/api/oat.md "Light: the
 * shade function"). Owner: LIGHT-WATER. `sectionShade('oat-a')` builds the section's `StreetShade`
 * ONCE (on the first call) from one source of truth: the section's sun (`sectionSun`, the §8.3
 * table in ./index.ts), the street widths of spec §2 (`OAT_STREETS`), the opposite row (GRAMMAR's
 * `facadeLots(id, true)`; until it plans one, a seeded skyline from the street sheet) and the
 * casters the builders add (`defineSectionShade`, `castersFromDecor`). Every painter calls the
 * same model: GRAMMAR's façade strips (`.facade`), STREET-A's floor and wetness (`.floor`), the
 * strips store and the stretched contact shadows.
 *
 *   const shade = sectionShade('oat-a');
 *   const k = shade.floor(u, v, d);                            // 0 sun … 1 shade (floor texel)
 *   const w = shade.facade(u, facadeMetres(hPx, lot.bandTop), d); // a façade art px
 *
 * Builders register BEFORE the first query (a section file at import time; painters query at paint
 * time). `defineSectionShade` drops the cached model, so the next query rebuilds it.
 */
import { vOfY } from '../../../../../engine/floor/cam';
import { sectionSun } from '../../../../mission/light/api';
import { facadeLots } from '../facade/index';
import { OAT_SECTION, OAT_WIDTH } from '../ids';
import {
  facadeMetres,
  PX_PER_M,
  proceduralLots,
  SHEET_9_STRAATJES,
  SHEET_GRIMBURGWAL,
  SHEET_OUDEZIJDS,
  skylineFromLots,
  StreetShade,
  type ShadeCaster,
  type SkylineLot,
  type SkylineSheet,
  type StreetStretch,
} from './shadow';

/** A floor camera's numbers (spec §2: yh, f and the back edge's screen y). */
export interface ShadeCamera {
  readonly yh: number;
  readonly f: number;
  /** Screen y of the floor's back edge (our façade's base). */
  readonly back: number;
}

/**
 * The street widths per section (spec §2, scenery research §1, §2.6): the narrow streets have an
 * opposite row; the bridges, the canal vistas and the open quays (canal behind the camera) are open.
 * Start values: INTEGRATE / the street owners tune them with the layout.
 */
export const OAT_STREETS: Readonly<Record<string, readonly StreetStretch[]>> = {
  [OAT_SECTION.a]: [
    { u0: 544, u1: 1568, w: 8.3 }, // Berenstraat
    { u0: 1792, u1: 2816, w: 8.2 }, // Wolvenstraat
    { u0: 3040, u1: 4096, w: 6.6 }, // Oude Spiegelstraat: narrower, deeper shade
  ],
  [OAT_SECTION.b]: [{ u0: 640, u1: 2816, w: 8 }], // Huidenstraat (the quay 0–640 open)
  [OAT_SECTION.c]: [{ u0: 0, u1: 2048, w: 23 }], // our south row behind the camera, 23 m to the north row
  [OAT_SECTION.c1]: [{ u0: 0, u1: 4096, w: 23 }],
};

/** The opposite row's street sheet per section (spec §8.6). */
const SHEETS: Readonly<Record<string, SkylineSheet>> = {
  [OAT_SECTION.a]: SHEET_9_STRAATJES,
  [OAT_SECTION.b]: SHEET_9_STRAATJES,
  [OAT_SECTION.c]: SHEET_GRIMBURGWAL,
  [OAT_SECTION.c1]: SHEET_GRIMBURGWAL,
  [OAT_SECTION.d]: SHEET_OUDEZIJDS,
};

/** The floor cameras of spec §2 (the section's floor def wins once it exists: `defineSectionShade`). */
const CAMERAS: Readonly<Record<string, ShadeCamera>> = {
  [OAT_SECTION.a]: { yh: 60, f: 210, back: 160 },
  [OAT_SECTION.b]: { yh: 60, f: 210, back: 160 },
  [OAT_SECTION.c]: { yh: 60, f: 210, back: 146 },
  [OAT_SECTION.c1]: { yh: 60, f: 210, back: 146 },
  [OAT_SECTION.d]: { yh: 60, f: 210, back: 160 },
  [OAT_SECTION.e]: { yh: 64, f: 200, back: 156 },
};

/** The walk line (spec §2: G = 176). */
const YW = 176;
/** The opposite façade's line lies this share of the band below the view's bottom (the near pavement shows). */
const OPPOSITE_BEYOND = 0.14;

/** What a builder may set for a section's shade (each field overrides the default). */
export interface SectionShadeOpts {
  readonly camera?: ShadeCamera;
  readonly streets?: readonly StreetStretch[];
  /** The opposite row (default: GRAMMAR's planned opposite lots, else the seeded skyline). */
  readonly opposite?: (u: number) => number;
  readonly sheet?: SkylineSheet;
  /** The floor v of the opposite façade (default: just below the view's bottom). */
  readonly vOpposite?: number;
  readonly openDepth?: number;
  readonly seed?: number;
}

const opts = new Map<string, SectionShadeOpts>();
const casters = new Map<string, ShadeCaster[]>();
const models = new Map<string, StreetShade>();

/** Set (merge) a section's shade options; the next `sectionShade(id)` rebuilds the model. */
export function defineSectionShade(sectionId: string, o: SectionShadeOpts): void {
  opts.set(sectionId, { ...(opts.get(sectionId) ?? {}), ...o });
  models.delete(sectionId);
}

/**
 * Add casters to a section (posts, trees, bikes, awnings …; u world px, z / h / r metres). The
 * section's decor is the source (`castersFromDecor`); never place a shadow by hand.
 */
export function addShadeCasters(sectionId: string, list: readonly ShadeCaster[]): void {
  const have = casters.get(sectionId) ?? [];
  for (const c of list) have.push(c);
  casters.set(sectionId, have);
  models.delete(sectionId);
}

/** Drop every registration and model of a section (tests; all sections without an id). */
export function resetSectionShade(sectionId?: string): void {
  if (sectionId === undefined) {
    opts.clear();
    casters.clear();
    models.clear();
    return;
  }
  opts.delete(sectionId);
  casters.delete(sectionId);
  models.delete(sectionId);
}

/** The camera of a section's shade (the builder's, else spec §2's, else a's). */
export function shadeCamera(sectionId: string): ShadeCamera {
  return opts.get(sectionId)?.camera ?? CAMERAS[sectionId] ?? CAMERAS[OAT_SECTION.a];
}

/** The floor v of our façade's base and of the opposite façade's line for a camera. */
export function shadeSpan(cam: ShadeCamera): { vFacade: number; vOpposite: number } {
  const c = { yh: cam.yh, yw: YW, f: cam.f };
  const vFacade = vOfY(c, cam.back);
  const vBottom = vOfY(c, 216);
  return { vFacade, vOpposite: vBottom + (vBottom - vFacade) * OPPOSITE_BEYOND };
}

/** GRAMMAR's opposite lots as skyline lots (ridge px on the mixed scale → metres; gables rise 3.5 m). */
function lotsOf(sectionId: string): SkylineLot[] {
  return facadeLots(sectionId, true).map((l) => {
    const top = facadeMetres(l.ridge, l.bandTop);
    const flat = l.gable === 'lijst' || l.gable === 'plastered' || l.gable === 'infill' || l.gable === 'none';
    return { u0: l.u0, w: l.w, top, eaves: flat ? top : Math.max(facadeMetres(l.bandTop, l.bandTop), top - 3.5), gable: l.gable };
  });
}

/** The section's shade model (built once; the night sections get a model that never shades). */
export function sectionShade(sectionId: string): StreetShade {
  let m = models.get(sectionId);
  if (m) return m;
  const o = opts.get(sectionId) ?? {};
  const cam = o.camera ?? CAMERAS[sectionId] ?? CAMERAS[OAT_SECTION.a];
  const span = shadeSpan(cam);
  const width = OAT_WIDTH[sectionId as keyof typeof OAT_WIDTH] ?? 4096;
  const seed = (o.seed ?? hashId(sectionId)) >>> 0;
  let opposite = o.opposite;
  if (!opposite) {
    const planned = lotsOf(sectionId);
    const lots = planned.length > 0 ? planned : proceduralLots(o.sheet ?? SHEETS[sectionId] ?? SHEET_9_STRAATJES, -600, width + 200, seed ^ 0x0990);
    opposite = skylineFromLots(lots);
  }
  m = new StreetShade({
    sun: sectionSun(sectionId),
    width,
    streets: o.streets ?? OAT_STREETS[sectionId] ?? [],
    opposite,
    vFacade: span.vFacade,
    vOpposite: o.vOpposite ?? span.vOpposite,
    openDepth: o.openDepth,
    casters: casters.get(sectionId),
    seed,
  });
  models.set(sectionId, m);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Casters from decor (one source of truth: the decor list)
// ---------------------------------------------------------------------------------------------

/** A decor item as placed (sprite id, world x, floor depth px; `DecorDef` fits). */
export interface DecorPlace {
  readonly sprite: string;
  readonly x: number;
  readonly depth?: number;
}

/** The shadow shape of a decor sprite, given its foot's world x and its depth z in metres. */
export type CasterShape = (x: number, z: number) => ShadeCaster | readonly ShadeCaster[] | null;

const shapes: { prefix: string; shape: CasterShape }[] = [];

/** Register the shadow shape of decor sprites by id prefix (the longest matching prefix wins). */
export function defineCasterShape(spritePrefix: string, shape: CasterShape): void {
  const i = shapes.findIndex((s) => s.prefix === spritePrefix);
  if (i >= 0) shapes[i].shape = shape;
  else shapes.push({ prefix: spritePrefix, shape });
  shapes.sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * The casters of a decor list (items whose sprite has a registered shape): each item's floor depth
 * (px behind the walk line; default 0) becomes z metres through the section's camera and street.
 */
export function castersFromDecor(sectionId: string, decor: readonly DecorPlace[]): ShadeCaster[] {
  const out: ShadeCaster[] = [];
  const cam = shadeCamera(sectionId);
  const model = sectionShade(sectionId);
  for (const d of decor) {
    const s = shapes.find((p) => d.sprite.startsWith(p.prefix));
    if (!s) continue;
    const y = YW - (d.depth ?? 0);
    const v = vOfY({ yh: cam.yh, yw: YW, f: cam.f }, Math.max(cam.yh + 1, y));
    const z = Math.max(0, model.zOfV(d.x, v));
    const got = s.shape(d.x, z);
    if (!got) continue;
    if (Array.isArray(got)) for (const c of got as readonly ShadeCaster[]) out.push(c);
    else out.push(got as ShadeCaster);
  }
  return out;
}

/** Common shapes (true scale, spec §8.2): a post of height h metres and radius r. */
export function postShape(h: number, r = 0.06): CasterShape {
  return (x, z) => ({ kind: 'post', u: x, z, h, r });
}

/** A lantern post: the post plus a small head (spec §8.2: lantern posts 4.0–4.5 m). */
export function lanternShape(h = 4.3): CasterShape {
  return (x, z) => [
    { kind: 'post', u: x, z, h, r: 0.07 },
    { kind: 'crown', u: x, z, h: h - 0.25, r: 0.28 },
  ];
}

/** An elm (spec §8.2: trunk true scale, the crown at the ridges): trunk + a dappled crown. */
export function elmShape(crownH = 11, crownR = 4.2, holes = 0.32): CasterShape {
  return (x, z) => [
    { kind: 'post', u: x, z, h: crownH - crownR * 0.6, r: 0.25 },
    { kind: 'crown', u: x, z, h: crownH, r: crownR, holes },
  ];
}

/** A box `wM` wide (centred on x), `dM` deep, `h` metres tall (a bike, a bin, a parked car). */
export function boxShape(wM: number, dM: number, h: number): CasterShape {
  return (x, z) => ({ kind: 'box', u0: x - (wM * PX_PER_M) / 2, u1: x + (wM * PX_PER_M) / 2, z0: z - dM / 2, z1: z + dM / 2, h });
}

function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
