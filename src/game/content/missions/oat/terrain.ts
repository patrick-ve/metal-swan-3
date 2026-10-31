/**
 * Mission `oat` terrain and the layout numbers of the six sections (docs/design/oat.md §2; docs/api
 * /oat.md "Sections"). Owner: CORE (wave A: plain PLACEHOLDER terrain at the spec's widths, with the
 * bridges' humps, the locks, the chase's water and the set-piece spots); the section builders of
 * waves A–C refine their own section's numbers here (STREET-A / INTEGRATE-A oat-a, QUEUE-B oat-b,
 * KADE oat-c / oat-c1, NIGHT oat-d, TAXIRIT oat-e). Art, decor, the floor and the scripts read the
 * same numbers, so art and collision agree.
 *
 * Ground: the walk line `G` = 176 (the heroes 36 px = 1.8 m: 20 px/m, spec §2), scroll right
 * everywhere, checkpoints at most 1,400 px apart.
 */
import { terrain, type TerrainDef } from '../../../mission/index';
import { OAT_WIDTH } from './ids';

/** The standard ground line (feet y), as in ams. */
export const G = 176;
/** The canal's water line (the Swan swims here; as ams WATER_Y). */
export const WATER_Y = 180;
/** A bridge's hump on the walk line (spec §8.2: +12). */
export const BRIDGE_HUMP = 12;

/** An x range [x0, x1] (world px). */
export type Span = readonly [number, number];

// ------------------------------------------------------------------------------------ oat-a

/** oat-a DE 9 STRAATJES (spec §2.1). */
export const OAT_A = {
  w: OAT_WIDTH['oat-a'],
  /** The three bridges [x0, x1]: Berensluis over the Prinsengracht, bridge 48 (Keizersgracht), bridge 25 (Herengracht). */
  bridges: [
    [320, 544],
    [1568, 1792],
    [2816, 3040],
  ] as readonly Span[],
  /** The streets between them [x0, x1]: Berenstraat, Wolvenstraat, Oude Spiegelstraat; the Singel quay. */
  streets: {
    prinsengracht: [0, 320] as Span,
    berenstraat: [544, 1568] as Span,
    wolvenstraat: [1792, 2816] as Span,
    oudeSpiegelstraat: [3040, 4096] as Span,
    singel: [4096, 4608] as Span,
  },
  /** Camera locks: LOCK 1 (the hijsbalk), LOCK 2 (het draaiorgel), the Makelaar arena. */
  lock1: [2048, 2432] as Span,
  lock2: [3200, 3584] as Span,
  arena: [4224, 4608] as Span,
  /** De Makelaar's start (`bossStart` x; spec §4). */
  bossX: 4250,
  /** Set-piece and shop spots (x). */
  haverbar: [704, 768] as Span,
  conceptstore: [1900, 1964] as Span,
  teKoop: [4352, 4480] as Span,
  hoistX: 2240,
  organX: 3330,
  bins: [240, 900, 1400] as readonly number[],
  /** The golden record (spec §2.1: on the hanging piano at 2,240; wave A: on the ground there). */
  recordX: 2240,
  /** Spec §2.1: 0, 1,200, 2,560, 3,700, 4,250 (0 is the start). */
  checkpoints: [1200, 2560, 3700, 4250] as readonly number[],
} as const;

/** Flat street with a hump at every bridge (no water: the canals lie under the bridge decks, art only). */
function bridgeStreet(w: number, bridges: readonly Span[]): TerrainDef {
  const t = terrain(w, 216);
  const g = t.ground().at(0, G);
  let x = 0;
  for (const [x0, x1] of bridges) {
    g.flat(x0 - x).hill(x1 - x0, BRIDGE_HUMP);
    x = x1;
  }
  g.flat(w - x);
  return t.build();
}

export function terrainA(): TerrainDef {
  return bridgeStreet(OAT_A.w, OAT_A.bridges);
}

// ------------------------------------------------------------------------------------ oat-b

/** oat-b FORT NEGEN & ZESTIG (spec §2.2). */
export const OAT_B = {
  w: OAT_WIDTH['oat-b'],
  /** The Keizersgracht quay at the Huidenstraat corner, the queue's tail, DE RIJ, the way to the Herengracht. */
  quay: [0, 640] as Span,
  tail: [640, 1344] as Span,
  /** DE RIJ: the camera lock (the bakery 1,600–1,728, its door at 1,680). */
  rij: [1344, 1728] as Span,
  bakery: [1600, 1728] as Span,
  doorX: 1680,
  envelopeX: 500,
  exitX: 2780,
  checkpoints: [900, 1344, 2200] as readonly number[],
} as const;

export function terrainB(): TerrainDef {
  const t = terrain(OAT_B.w, 216);
  t.ground().at(0, G).flat(OAT_B.w);
  return t.build();
}

// ------------------------------------------------------------------------------------ oat-c

/** oat-c DE KADEMUUR on foot (spec §2.3). */
export const OAT_C = {
  w: OAT_WIDTH['oat-c'],
  kioskX: 320,
  /** The works and the taxi lock. */
  works: [512, 1280] as Span,
  lock: [768, 1152] as Span,
  /** The jetty where the Swan lands (the boarding; exit → oat-c1). */
  jetty: [1664, 2048] as Span,
  swanX: 1900,
  checkpoints: [1300] as readonly number[],
} as const;

export function terrainC(): TerrainDef {
  const t = terrain(OAT_C.w, 216);
  t.ground().at(0, G).flat(OAT_C.w);
  return t.build();
}

// ------------------------------------------------------------------------------------ oat-c1

/** oat-c1 the chase on the water (spec §2.4): auto-scroll 1.0, 1.2 from x 2,048. */
export const OAT_C1 = {
  w: OAT_WIDTH['oat-c1'],
  /** The jetty the Swan sets off from (wave A placeholder: a short quay) and the one at the end. */
  startJetty: [0, 96] as Span,
  endJetty: [3904, 4096] as Span,
  /** The canal between them (a water hazard over the whole floor band). */
  water: [96, 3904] as Span,
  scroll: 1.0,
  fastX: 2048,
  scrollFast: 1.2,
  pontoon1: [1024, 1280] as Span,
  closedBridge: [2048, 2304] as Span,
  pontoon2: [2304, 2560] as Span,
  sinkhole: [2560, 3584] as Span,
  /** The collapse front stops here (a stone abutment holds; spec §6.10). */
  stopX: 3600,
  checkpoints: [1280, 2560, 3584] as readonly number[],
} as const;

export function terrainC1(): TerrainDef {
  const c = OAT_C1;
  const t = terrain(c.w, 216);
  t.ground().at(0, G).flat(c.startJetty[1]).gap(c.water[1] - c.water[0]).flat(c.w - c.endJetty[0]);
  t.hazard('water', c.water[0], WATER_Y, c.water[1] - c.water[0], 216 - WATER_Y);
  return t.build();
}

// ------------------------------------------------------------------------------------ oat-d

/** oat-d DE WALLEN BY NIGHT (spec §2.5). */
export const OAT_D = {
  w: OAT_WIDTH['oat-d'],
  achterburgwal: [0, 1280] as Span,
  /** Gids op de brug: the camera lock at the bridge. */
  bridgeLock: [1280, 1664] as Span,
  alley: [1664, 2432] as Span,
  hoistX: 2000,
  voorburgwal: [2432, 3584] as Span,
  square: [3584, 4352] as Span,
  /** 03:00: the carillon strikes three here (spec §6.9). */
  threeX: 3700,
  arena: [3968, 4352] as Span,
  /** De Huisjesmelker's start (`bossStart` x; spec §5). */
  bossX: 3990,
  checkpoints: [1200, 2400, 3500, 3990] as readonly number[],
} as const;

export function terrainD(): TerrainDef {
  const t = terrain(OAT_D.w, 216);
  t.ground().at(0, G).flat(OAT_D.w);
  return t.build();
}

// ------------------------------------------------------------------------------------ oat-e

/** oat-e DE TAXIRIT (spec §2.6): wave A has a plain auto-scroll stand-in for the taxi carrier. */
export const OAT_E = {
  w: OAT_WIDTH['oat-e'],
  boarding: [0, 256] as Span,
  hendrikkade: [256, 2048] as Span,
  redLight: [2048, 2560] as Span,
  tunnel: [2560, 4608] as Span,
  ramp: [4608, 6144] as Span,
  /** The stand-in's scroll speed (the carrier: 2.0, up to 3.0, down to 1.0 per wave; wave C). */
  scroll: 1.5,
  checkpoints: [1300, 2600, 3900, 5200] as readonly number[],
} as const;

export function terrainE(): TerrainDef {
  const t = terrain(OAT_E.w, 216);
  t.ground().at(0, G).flat(OAT_E.w);
  return t.build();
}
