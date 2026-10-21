/**
 * The test mid-boss of the ring (docs/design/ring.md §6): the container lorry `ring-lorry`, its
 * adds `ring-forklift` and `ring-barrel` (a barrel or a crate of its cargo). Shared numbers of the
 * art (art.ts: one density-generic drawer per strip, 1× / 2× / 4×) and the logic (lorry.ts,
 * adds.ts). Nothing here reads art pixels.
 *
 * Local coordinates: the anchor (0, 0) is the road under the middle of the lorry, x forward (the
 * lorry always faces right: traffic drives right, so its lettering never mirrors), y up negative.
 * A logical pixel (x, y) covers [x, x + 1) × [y, y + 1).
 *
 * Every sprite of the boss lives under `boss/ring-lorry/` (art-def.ts maps the id `ring-lorry` to
 * that prefix: the tier-4 working set keeps it only in the boss stretch), the adds too.
 */

export type Pt = readonly [number, number];

/** Entity ids (RING_ENTITY_B.lorry and the wave-B contract's own ids). */
export const LORRY_ID = 'ring-lorry';
export const FORKLIFT_ID = 'ring-forklift';
export const CARGO_ID = 'ring-barrel';

/** Health-bar name (the HUD shows it under the bar). */
export const LORRY_NAME = 'ZWARE JONGEN';

/** Sprite prefix of the boss (and its adds). */
export const LORRY_ART = 'boss/ring-lorry';

/** Sprite ids. */
export const SPR = {
  /** The tractor cab by damage state (the part's state: `<art>/cab-<0|1|2>`). */
  cab: (s: number): string => `${LORRY_ART}/cab-${s}`,
  /** The wrecked cab turning toward the camera (the jackknife): 4 yaw steps. Deferred. */
  cabYaw: `${LORRY_ART}/cab-yaw`,
  /** The trailer chassis (no wheels, no container). */
  trailer: `${LORRY_ART}/trailer`,
  /** The container, side panel closed, by the boss's damage state. */
  container: (s: number): string => `${LORRY_ART}/container-${s}`,
  /** The container with the bay of its near side open: the hold (phase 2), by the boss's damage state (3 frames). */
  hold: `${LORRY_ART}/hold`,
  /** The bay's side panel dropping: 0 upright, 1 tilted, 2 nearly flat, 3 the ramp on the road. */
  panel: `${LORRY_ART}/panel`,
  /** The near rear door: 0 shut (edge on), 1 ajar, 2 open (face on, behind), 3 hanging (damaged). */
  doors: `${LORRY_ART}/doors`,
  /** A torn-off door tumbling (centre anchor). Deferred. */
  doorFall: `${LORRY_ART}/door-fall`,
  /** A blown trailer tyre on its rim (centre anchor, 4 turn frames). */
  rim: `${LORRY_ART}/rim`,
  /** The amber indicator on the cab corner: 0 off, 1 lit (the weave tell). */
  blink: `${LORRY_ART}/blink`,
  /** The rear light bar lit red (the brake / cargo tell). */
  brake: `${LORRY_ART}/brake`,
  /** The container falling off onto its side (the death): 3 frames. Deferred. */
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

/**
 * Part boxes (plane slabs: x range along the lorry, depth ±`DEPTH_HALF` around the plane y; the
 * Boss base mirrors nothing since the lorry never faces left). Order = part index:
 * 0 `cab` (the bot aims at `hurtboxes()[0]`), 1 `doors` (with the loader), 2 `wheels` (the
 * trailer bogie), 3 `box` (the container: no HP, it pings: cover).
 */
export const PART_X = {
  cab: [44, 92] as Pt,
  doors: [-92, -74] as Pt,
  /** The doors' slab while they stand open (the door face behind the container). */
  doorsOpen: [-118, -74] as Pt,
  wheels: [-74, -36] as Pt,
  /** The container over its whole length: behind the doors and over the bogie it takes what they let through. */
  box: [-92, 44] as Pt,
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
