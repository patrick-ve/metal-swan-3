/**
 * Mission `sewers` terrain and the layout numbers of the six sections (docs/design/sewers.md §2).
 * Owner: P0 (flat ground at y 176 at the spec's widths, the locks, the checkpoints, the exits); the
 * section builders of wave P1b refine their own section's numbers here (platforms, the limo's roof,
 * the plinths, the ledges). Art, decor, the floor and the scripts read the same numbers, so art and
 * collision agree.
 *
 * Checkpoints are camera-centre x values in ascending order, at most 1,400 px apart (spec §1); the
 * section start (0) is not listed.
 */
import { terrain, type TerrainDef } from '../../../mission/index';
import { spitterPlinths } from '../../sewers/rats/helpers';
import { SEWERS_WIDTH, type SewersSectionId } from './ids';

/** The walk line (feet y; spec §2). */
export const G = 176;

/** An x range [x0, x1] (world px). */
export type Span = readonly [number, number];

/** sewers-a DE WALLEN (spec §2.1). */
export const SEWERS_A = {
  w: SEWERS_WIDTH['sewers-a'],
  /** LOCK 1: two pimps, two bodyguards, three dealers in two waves. */
  lock1: [1664, 2048] as Span,
  /** LOCK 2: GOUDEN GERRIT (the mini-boss). */
  arena: [2688, 3072] as Span,
  bossX: 2700,
  /** The limo across the quay (spec §4.1): a dynamic solid owned by `sewers-gerrit` (not terrain), its roof a platform at y 148. */
  limo: [2860, 2980] as Span,
  limoX: 2920,
  roofY: 148,
  exitX: 3040,
  checkpoints: [1200, 2300, 2700] as readonly number[],
  /** Wave A: the krul urinals (beside the band; a dealer lurks behind the first) and the tree (the second dealer). */
  krul: [300, 2450] as readonly number[],
  tree: 520,
  /** The weapon crates `H`, `S`, `R` (spec §2.1). */
  crates: { H: 420, S: 1800, R: 2720 },
  /** The tourists: 1 the banana tourist (chair), 2 the plain one (cage, after lock 1). */
  hostages: [1150, 2200] as readonly number[],
  /** The vista bridges in depth (decor only): bridge 1, the limo's bridge. */
  bridges: [[1280, 1536], [2880, 3008]] as readonly Span[],
} as const;

/** sewers-b DE STEEGJES (spec §2.2). */
export const SEWERS_B = {
  w: SEWERS_WIDTH['sewers-b'],
  /** The alleys, the alley mouth, the square. */
  alleys: [0, 1280] as Span,
  mouth: [1280, 1536] as Span,
  square: [1536, 2560] as Span,
  /** LOCK: THE RAT ERUPTION (spec §5.3) and its three grates. */
  lock: [1920, 2304] as Span,
  grates: [1980, 2100, 2220] as readonly number[],
  /** The big burst grate: the way down (exit → sewers-c, transition `cut`). */
  burst: [2384, 2448] as Span,
  /** The drain grates in the alley gutter (decor that rattles once each; wave P1b B). */
  gutters: [400, 760, 1120] as readonly number[],
  /** Art / floor numbers for later (Phase 5/6): the far wall of the alleys, the square's back edge. The walk line stays 176. */
  alleyBack: 170,
  squareBack: 150,
  checkpoints: [1200, 2000] as readonly number[],
} as const;

/** sewers-c DE PUT (spec §2.3). */
export const SEWERS_C = {
  w: SEWERS_WIDTH['sewers-c'],
  /** The fall lands here (spec §5.2: `introDrop.x` = `playerStart.x` = 64). */
  dropX: 64,
  exitX: 1880,
  checkpoints: [900, 1700] as readonly number[],
  // --- wave P1b C (section-c.ts, c-kit.ts) ---
  /** The fall starts with the feet here (spec §5.2: from y −40). */
  dropFromY: -40,
  /** The weapon crate `H` (spec §2.3: the first weapon within 20 s). */
  crateX: 300,
  /** The flashlight lesson: three runners, one at a time, out of the dark at these x. */
  lesson: [300, 420, 560] as readonly number[],
  /** The leapers' pipe stubs (mouth at y 150 = LEAPER.pipeY): the lesson at 760, then 1,200 and 1,450. */
  pipes: [760, 1200, 1450] as readonly number[],
  /** The leaper lesson's two runner packs of 3 (camera-centre triggers). */
  leaperPacks: [820, 960] as readonly number[],
  /** Sewer worker 1 (bind `sack`, drops `pickup-battery`). */
  workerX: 1000,
  /** The three runner packs of 4 (camera-centre triggers). */
  packs: [1100, 1300, 1500] as readonly number[],
  /** The spitter lesson: its first plinth (the second one 96 px right; PLINTH of the rats). */
  spitterX: 1400,
  /** The last pack of 3 (camera-centre trigger). */
  lastPack: 1750,
  /** The far wall's pipe mouths and side tunnel with blinking eyes (decor, 0–640). */
  eyes: [120, 205, 330, 470, 590] as readonly number[],
} as const;

/** sewers-c: the walk line and the spitter's two plinths (one-way, spec §3; the rats' helper). */
export function terrainC(): TerrainDef {
  const t = terrain(SEWERS_C.w, 216);
  t.ground().at(0, G).flat(SEWERS_C.w);
  spitterPlinths(t, SEWERS_C.spitterX);
  return t.build();
}

/** sewers-d HET RIOOL (spec §2.4). */
export const SEWERS_D = {
  w: SEWERS_WIDTH['sewers-d'],
  /** LOCK: THE FATBERG (spec §5.4) at 2,700. */
  lock: [2432, 2816] as Span,
  fatbergX: 2700,
  exitX: 2800,
  checkpoints: [1300, 2300] as readonly number[],
  // --- wave P1b D (section-d.ts, d-kit.ts) ---
  /** The spitters' first plinths (the second one `plinthGap` right); 1,560 is D's addition for the mixed pack. */
  plinths: [500, 800, 1560] as readonly number[],
  plinthGap: 96,
  /** The plinth: a one-way platform, top y, width (= PLINTH of content/sewers/rats/numbers.ts). */
  plinthY: 148,
  plinthW: 48,
  /** The leapers' pipe stubs (mouth at y 150 = LEAPER.pipeY). */
  pipes: [2000, 2150, 2300] as readonly number[],
  /** The side-tunnel mouths in the far wall (decor; the 1,200 one holds the secret fatberg). */
  tunnels: [640, 1200, 1980] as readonly number[],
  /** The walkway's back edge (feet y of what stands in the far wall's mouths). */
  backY: 160,
  /**
   * The secret fatberg (small, off the walk band) in the 1,200 tunnel mouth, its feet on the mouth's
   * sill at y 148: above a standing hero's shot line (y ~152–156), so stray fire passes under it;
   * up / diagonal aim or a jump-shot opens it (as the spitters on their plinths).
   */
  secretX: 1200,
  secretY: 148,
} as const;

/** sewers-d: the walk line and the spitters' plinths (one-way, spec §3). */
export function terrainD(): TerrainDef {
  const d = SEWERS_D;
  const t = terrain(d.w, 216);
  t.ground().at(0, G).flat(d.w);
  for (const x of d.plinths) for (const px of [x, x + d.plinthGap]) t.platform(px - d.plinthW / 2, d.plinthY, d.plinthW);
  return t.build();
}

/** sewers-e DE AFVALHAL (spec §2.5). */
export const SEWERS_E = {
  w: SEWERS_WIDTH['sewers-e'],
  /** The hall opens here. */
  hall: 832,
  /** LOCK: DE RATTENJONG (the boss arena). */
  arena: [864, 1248] as Span,
  bossX: 880,
  checkpoints: [600, 880] as readonly number[],
  // --- wave P1b E (section-e.ts, e-kit.ts, content/bosses/sewers-rattenjong/) ---
  /** The two low trash ledges of the arena (one-way platforms; spec §2.5 *start*): cover from the carts, jump-shot height. */
  ledges: [[920, 990], [1110, 1180]] as readonly Span[],
  ledgeY: 150,
  /** DE RATTENJONG's throne: its centre (his seat; KING.homeX) on the trash mountain at the arena's back. */
  throneX: 1100,
  /** The approach's spitter: its first plinth (the second one 96 px right; PLINTH of the rats). */
  spitterX: 640,
  /** The weapon crates: `H` in the approach (spec §2.5), the arena's crate at 900. */
  crateH: 500,
  crateArena: 900,
  /** The approach's runner packs (camera-right triggers). */
  packs: [300, 470, 720] as readonly number[],
} as const;

/** sewers-e: the walk line, the approach's spitter plinths and the arena's two trash ledges. */
export function terrainE(): TerrainDef {
  const e = SEWERS_E;
  const t = terrain(e.w, 216);
  t.ground().at(0, G).flat(e.w);
  spitterPlinths(t, e.spitterX);
  for (const [x0, x1] of e.ledges) t.platform(x0, e.ledgeY, x1 - x0);
  return t.build();
}

/** sewers-end DAGERAAD (spec §2.6): one screen, no checkpoints. */
export const SEWERS_END = {
  w: SEWERS_WIDTH['sewers-end'],
  // --- wave P1b E (section-end.ts, e-kit.ts) ---
  /** The manhole the heroes climb out of (its centre). */
  manholeX: 96,
  /** The white wagon stops with its centre here (heroes board anywhere along its side, up to the view's edge). */
  wagonX: 320,
} as const;

/** Flat ground at the walk line over the whole section (spec §2: P0's grey layout). */
export function flatTerrain(id: SewersSectionId): TerrainDef {
  const w = SEWERS_WIDTH[id];
  const t = terrain(w, 216);
  t.ground().at(0, G).flat(w);
  return t.build();
}
