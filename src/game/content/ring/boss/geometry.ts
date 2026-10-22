/**
 * The ZWAAN CONTAINER trailer's shared numbers (docs/design/ring.md §R.3; it was the container half
 * of the retired test lorry `ring-lorry`, §6): its adds `ring-forklift` and `ring-barrel` (a drum
 * or a crate of its cargo), the art (art.ts: one density-generic drawer per strip, 1× / 2× / 4×)
 * and the logic (zwaan/container.ts, adds.ts). Nothing here reads art pixels.
 *
 * OLD-LOCAL coordinates (the retired lorry's): the anchor (0, 0) is the road under the middle of the
 * old lorry, x forward (the trailer always faces right: its lettering never mirrors), y up negative.
 * The container part (zwaan/container.ts) has its REAR at old-local x −92 (`CONTAINER_REAR`), so a
 * part-local x is an old-local x + 92. A logical pixel (x, y) covers [x, x + 1) × [y, y + 1).
 *
 * Every sprite of the container trailer lives under `boss/ring-zwaan/container/` (art-def maps the
 * part id `ring-zwaan-container` to it: the tier-4 working set keeps it only in its pseudo-sections),
 * the adds too. The cab of the old lorry is now the ZWAAN train's cab (zwaan/cab*.ts).
 */

export type Pt = readonly [number, number];

/** Entity ids of the container's adds (wave-B ids, kept). */
export const FORKLIFT_ID = 'ring-forklift';
export const CARGO_ID = 'ring-barrel';

/** Sprite prefix of the container trailer (and its adds; revision R: was `boss/ring-lorry`). */
export const LORRY_ART = 'boss/ring-zwaan/container';

/** The container part's rear in old-local x (part-local x = old-local x − CONTAINER_REAR). */
export const CONTAINER_REAR = -92;

/** Sprite ids. */
export const SPR = {
  /** The trailer chassis (no wheels, no container). */
  trailer: `${LORRY_ART}/trailer`,
  /** The container, side panel closed, by the part's damage state. */
  container: (s: number): string => `${LORRY_ART}/container-${s}`,
  /** The container with the bay of its near side open: the hold (phase 2), by the part's damage state (3 frames). */
  hold: `${LORRY_ART}/hold`,
  /** The bay's side panel dropping: 0 upright, 1 tilted, 2 nearly flat, 3 the ramp on the road. */
  panel: `${LORRY_ART}/panel`,
  /** The near rear door: 0 shut (edge on), 1 ajar, 2 open (face on, behind), 3 hanging (damaged). */
  doors: `${LORRY_ART}/doors`,
  /** A torn-off door tumbling (centre anchor). Deferred. */
  doorFall: `${LORRY_ART}/door-fall`,
  /** The rear light bar lit red (the brake / cargo tell). */
  brake: `${LORRY_ART}/brake`,
  /** The container trailer falling onto its side (beaten): 3 frames. Deferred. */
  boxTip: `${LORRY_ART}/box-tip`,
  /** Cargo (centre anchor): a steel drum rolling (8), a wooden crate tumbling (4). */
  barrel: `${LORRY_ART}/barrel`,
  crate: `${LORRY_ART}/crate`,
  /** The loader in the doorway (feet anchor): stand (2), lift (3: the tell), throw (2), tumble (4), sit (2). */
  loader: (strip: string): string => `${LORRY_ART}/loader/${strip}`,
  /** The forklift (Enemy art prefix `<LORRY_ART>/forklift`; anchor: the road under its middle, facing right; flipped when it faces left). */
  forklift: (strip: string): string => `${LORRY_ART}/forklift/${strip}`,
} as const;

/** Wheel radius (the reused `ring/car/wheel-l` strip) and the blown tyre's rim. */
export const WHEEL_R = 7.5;
export const RIM_R = 6;

/** The retired lorry's old-local geometry; the container trailer uses its rear half (x −92 … 58). */
export const LORRY = {
  /** Body length (x −92 … +92) and the visual box (doors shut). */
  rear: -92,
  front: 92,
  /** The visual box (hitbox: bubbles, popups, the view checks). */
  box: { x: -92, y: -68, w: 188, h: 68 },
  /** The container: side wall x0 … x1, roof and floor (the deck). */
  container: { x0: -90, x1: 42, top: -64, bottom: -20 },
  /** Deck height (the container floor / the loader's and the forklift's lift inside it). */
  deck: 20,
  /** The cab (tractor): back wall, nose, roof (with its fairing), floor line. */
  cab: { x0: 48, x1: 92, top: -64, bottom: -14 },
  /** Wheel centres (x): tractor front, tractor drive; the trailer's bogie. */
  tractorWheels: [80, 53] as readonly number[],
  trailerWheels: [-78, -62, -46] as readonly number[],
  /** The near rear door: hinge x (the container's rear edge), width face on, height. */
  door: { hinge: -90, w: 26, top: -63, bottom: -21 },
  /** Where the loader stands (feet), in the doorway on the deck. */
  loader: [-97, -20] as Pt,
  /** Where cargo leaves the door (x, lift). */
  cargoOut: [-94, 26] as Pt,
  /** The cab's indicator (side marker at the front corner) and the rear light bar. */
  blinkAt: [86, -21] as Pt,
  brakeAt: [-92, -16] as Pt,
  /** The bay: the section of the near wall that drops (x0, x1), and the forklift's spot in it. */
  bay: [-18, 38] as Pt,
  bayX: 10,
  /** Speaker point of the bubble (`say`): over the cab. */
  sayAt: [70, -70] as Pt,
  /** Smoke points: the cab's bonnet grille, the coupling, the bogie. */
  smoke: { cab: [84, -40] as Pt, coupling: [44, -22] as Pt, bogie: [-62, -10] as Pt },
} as const;

/** The forklift (local: the road under its middle, facing right = forks to the right). */
export const FORK = {
  len: 44,
  /** Hurt slab x range (facing right; mirrored when it faces left). */
  slab: [-18, 22] as Pt,
  /** Visual box. */
  box: { x: -20, y: -38, w: 44, h: 38 },
  /** Wheel centres and radii: front (under the mast), rear (under the counterweight). */
  front: [10, -4.5] as Pt,
  frontR: 4.5,
  rearW: [-11, -3.5] as Pt,
  rearR: 3.5,
  /** The beacon on the overhead guard (its own sprite `forklift-beacon`). */
  beacon: [-4, -36] as Pt,
  /** The driver's hip on the seat. */
  hip: [-6, -15] as Pt,
} as const;

/** Cargo pieces (centre anchor at the middle of the drum's end / the crate). */
export const CARGO = {
  barrelR: 6.5,
  crate: { w: 13, h: 11 },
  /** Hurt slab half width (x). */
  half: 7,
} as const;
