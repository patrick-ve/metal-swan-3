/**
 * The matrix signs (docs/design/rally.md §2 "The start", §4, §5; docs/api/rally.md "B.2"). Wave B
 * contract by PREP: RULES drives the states, WORLD draws them (emissive faces on the gantries, our
 * own pixel symbols in the Dutch matrix style).
 *
 * Every gantry of the track (`A10Track.gantries`, by index = the gantry id) has one sign per lane
 * plus the hard shoulder: `SIGN_LANES` = 4 (lane 0 = the left lane … 2 = the right lane, 3 = the
 * shoulder / spitsstrook). The table lives in the race state (`RaceState.signs`, made by the
 * runner); `version` counts every change, so a drawer rebuilds its items only when it moved.
 *
 * Pure and deterministic (spec §12.4): no allocation after the constructor.
 */

/** The states of one sign (spec §5). 'blank' = dark (the placeholder face shows). */
export const SIGN_STATES = [
  'blank',
  'limit-50',
  'limit-70',
  'limit-80',
  'limit-100',
  /** The red cross: the lane is closed ahead (driving under it is a fine). */
  'x',
  /** The green arrow down: the lane (the spitsstrook) is open; the start's GO. */
  'arrow-down',
  /** The merge arrows (a lane ends: move left / right). */
  'merge-left',
  'merge-right',
  /** The end of all limits (a white disc with a slash). */
  'end',
  /** The start gantry's countdown (spec §2). */
  'count-3',
  'count-2',
  'count-1',
  'go',
] as const;
export type SignState = (typeof SIGN_STATES)[number];

/** Signs per gantry: the three lanes and the hard shoulder (index 3). */
export const SIGN_LANES = 4;
/** The hard shoulder's sign (the spitsstrook on lap 3). */
export const SIGN_SHOULDER = 3;

const CODE = new Map<SignState, number>(SIGN_STATES.map((s, i) => [s, i]));

/** The code of a state (its index in `SIGN_STATES`). */
export function signCode(state: SignState): number {
  return CODE.get(state) ?? 0;
}

/** The state of a code ('blank' for an unknown one). */
export function signOf(code: number): SignState {
  return SIGN_STATES[code] ?? 'blank';
}

/** The speed limit of a state (km/h), or 0 when it shows none. */
export function signLimit(state: SignState): number {
  switch (state) {
    case 'limit-50':
      return 50;
    case 'limit-70':
      return 70;
    case 'limit-80':
      return 80;
    case 'limit-100':
      return 100;
    default:
      return 0;
  }
}

/** The signs of every gantry (gantry id = its index in the track's `gantries`). */
export class SignTable {
  /** Gantries. */
  readonly count: number;
  /** The codes, `SIGN_LANES` per gantry (gantry g, lane l at g · SIGN_LANES + l). */
  readonly codes: Uint8Array;
  /** +1 on every change (a drawer compares it with the version it drew). */
  version = 0;

  constructor(gantries: number) {
    this.count = Math.max(0, Math.floor(gantries));
    this.codes = new Uint8Array(this.count * SIGN_LANES);
  }

  /** The state of gantry g's sign over lane l ('blank' out of range). */
  sign(g: number, lane: number): SignState {
    if (g < 0 || g >= this.count || lane < 0 || lane >= SIGN_LANES) return 'blank';
    return signOf(this.codes[g * SIGN_LANES + lane]);
  }

  /** Set gantry g's sign over lane l. Returns true when it changed. */
  setSign(g: number, lane: number, state: SignState): boolean {
    if (g < 0 || g >= this.count || lane < 0 || lane >= SIGN_LANES) return false;
    const i = g * SIGN_LANES + lane;
    const c = signCode(state);
    if (this.codes[i] === c) return false;
    this.codes[i] = c;
    this.version++;
    return true;
  }

  /** Every sign of gantry g (`lanes`: how many from the left; default all, the shoulder included). */
  setGantry(g: number, state: SignState, lanes = SIGN_LANES): boolean {
    let changed = false;
    for (let l = 0; l < lanes && l < SIGN_LANES; l++) if (this.setSign(g, l, state)) changed = true;
    return changed;
  }

  /** Every sign dark. */
  clear(): void {
    let any = false;
    for (let i = 0; i < this.codes.length; i++) if (this.codes[i] !== 0) any = true;
    if (!any) return;
    this.codes.fill(0);
    this.version++;
  }
}

/** The fields of a track the signs read (`A10Track` has them; a test track has none). */
export interface SignTrack {
  readonly gantries?: readonly { readonly s: number; readonly kind: string }[];
}

/** The gantries of a track (none on a test track). */
export function gantriesOf(track: object): readonly { readonly s: number; readonly kind: string }[] {
  return (track as SignTrack).gantries ?? [];
}

/** The start gantry's id (its index), or −1. */
export function startGantry(track: object): number {
  const g = gantriesOf(track);
  for (let i = 0; i < g.length; i++) if (g[i].kind === 'start') return i;
  return -1;
}

/**
 * The start gantry's countdown (spec §2; PREP's stub, RULES owns it in wave B): `count-3`, `count-2`,
 * `count-1` over the three lanes while the countdown runs (`left` ticks to GO), then `go` for
 * `GO_SIGN_TICKS`, then blank. `raceTick` −1 in the countdown.
 */
export const GO_SIGN_TICKS = 180;
export function countdownSign(left: number, raceTick: number): SignState {
  if (raceTick < 0) {
    const n = Math.ceil(left / 60);
    return n >= 3 ? 'count-3' : n === 2 ? 'count-2' : n === 1 ? 'count-1' : 'go';
  }
  return raceTick < GO_SIGN_TICKS ? 'go' : 'blank';
}
