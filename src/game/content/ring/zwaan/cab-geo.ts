/**
 * The geometry of the ZWAAN train's cab `ring-zwaan-cab` (ZWARE JONGEN; docs/design/ring.md §R.3),
 * shared by its art (cab-art.ts) and its logic (cab.ts). Part-local coordinates (zwaan/kit.ts):
 * x = 0 the REAR (the towing jaw, the rear lamps), 100 the FRONT (the bumper); y = 0 the road, up
 * negative. A heavy cab-over tractor with a high-roof SLEEPER: the chassis with the tandem drive
 * axles and the fifth wheel behind the cab (0 … 38), the sleeper (38 … 66) with the GUNNER's window,
 * the cab with the door (66 … 100). It always faces right (its lettering never mirrors).
 */
export type Pt = readonly [number, number];

/** Sprite prefix (`zwaanArt('ring-zwaan-cab')`). */
export const CAB_ART = 'boss/ring-zwaan/cab';

export const CAB = {
  length: 100,
  height: 80,
  /** The cab body's back wall (the sleeper's rear) and the nose. */
  back: 38,
  nose: 100,
  /** Wheel centres (x): the tandem drive axles, the front axle. */
  rearWheels: [15, 31] as readonly number[],
  frontWheel: 88.5,
  /** The gunner's sleeper window (x0, y0, x1, y1) and the gunner's hip, 4 px under its sill (his strip is cut at the sill; facing left). */
  window: [44, -56, 56, -46] as const,
  gunnerAt: [50, -42] as Pt,
  /** The indicator on the front corner (the weave tell), the rear lamp bar (the brake-check tell). */
  blinkAt: [94, -21] as Pt,
  brakeAt: [1, -16] as Pt,
  /** Speaker point of the bubble (`say`): over the cab. */
  sayAt: [80, -80] as Pt,
  /** Smoke points: the bonnet grille, the stack, the fifth wheel. */
  smoke: [
    [93, -40],
    [36, -78],
    [24, -22],
  ] as readonly Pt[],
} as const;

/**
 * The parts' x ranges (plane slabs) in index order: 0 `cab` (the heart and the weak point × 1.5:
 * THE BOT AIMS AT PART 0), 1 `sleeper` (the gunner's window: own HP), 2 `chassis` (× 1).
 */
export const CAB_X = {
  cab: [64, 100] as Pt,
  sleeper: [38, 64] as Pt,
  chassis: [0, 38] as Pt,
} as const;

/** Sprite ids. */
export const CAB_SPR = {
  /** The tractor (body, sleeper, chassis, tank, stack; no wheels) by damage state. */
  body: (s: number): string => `${CAB_ART}/body-${s}`,
  /** The jackknife: the wrecked tractor turning toward the camera (4 yaw steps, deferred). */
  yaw: `${CAB_ART}/yaw`,
  /** The sleeper window: 0 half open, 1 open (the dark bunk), 2 smashed (the gunner gone). */
  window: `${CAB_ART}/window`,
  /** The gunner leaning out of the window (feet anchor = his hip on the sill, facing right: drawn flipped). */
  gunner: (strip: string): string => `${CAB_ART}/gunner/${strip}`,
  /** The driver climbing out after the jackknife (bloodless): tumble (4), sit (2) — and the gunner's own. */
  driver: (strip: string): string => `${CAB_ART}/driver/${strip}`,
  /** The amber indicator on the front corner: 0 off, 1 lit (the weave tell). */
  blink: `${CAB_ART}/blink`,
  /** The rear lamp bar lit red (the brake check's tell). */
  brake: `${CAB_ART}/brake`,
} as const;
