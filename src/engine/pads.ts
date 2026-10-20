/**
 * Gamepads for two players (docs/api/input.md; docs/design/ams-extras.md §10). Pure TS, no DOM:
 * the browser source (input.browser.ts `GamepadSource`) hands `navigator.getGamepads()` to a
 * `PadSource`; tests hand it plain objects (`GamepadLike`).
 *
 * - **Identity and profiles.** `parsePadId` reads the vendor and product ids from `Gamepad.id`
 *   in the Chrome (`… (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)`), Firefox / Safari
 *   (`54c-ce6-DualSense Wireless Controller`) and plain-name formats; `padInfo` picks the family
 *   (PlayStation, Xbox, Nintendo, generic) and, for a pad WITHOUT the standard mapping, a profile
 *   that moves its raw buttons to the standard indices. A hat-switch D-pad (an axis that rests
 *   at 9/7) is found by itself and read as the D-pad buttons 12-15.
 * - **Standard indices everywhere.** Everything after the profile (bindings, menus, raw codes
 *   `GamepadB<n>`, the first-person map) uses the standard indices (`PAD`): south 0, east 1,
 *   west 2, north 3, … start 9, D-pad 12-15, home 16. The positional default: the same physical
 *   button does the same thing on every pad; only the labels differ (`padLabel`).
 * - **Slots.** A player slot claims a pad (`claim`): it remembers the pad's `id` and index. A
 *   pad that drops out (Bluetooth sleep) leaves its claim `lost`; the same pad coming back (same
 *   id; the same index first) takes it again by itself, so a reconnect never swaps the players.
 *   1-player mode: every pad drives player 1 (with `joinWatch` the START of a pad that is not
 *   player 1's asks to join instead); the first pad that presses a button other than START while
 *   player 1 has no pad becomes player 1's. 2-player mode: each slot is driven by its own pad
 *   only (a third pad drives nobody in play; its presses reach the menus as raw codes, and with
 *   `menuPads` (a menu open over the game) it drives slot 0 so it can navigate the menu).
 * - **Rumble** (`rumble`): `vibrationActuator.playEffect('dual-rumble')` where the browser has
 *   it, else `hapticActuators[0].pulse`; feature-detected, never throws.
 *
 * Determinism: nothing here feeds the headless sims (they have no pads); no per-tick allocation.
 */
import {
  actionsFromPadButtons,
  type AnalogState,
  defaultFpsPadMap,
  stickMove as stickMoveInto,
  stickTurn,
} from './input-actions';
import { BUTTON_BIT, type InputContext, type InputSource, maskFromPad, padButtonCode, type PadMap, type PlayerSlot } from './input';

// ---------------------------------------------------------------------------------------------
// Standard indices
// ---------------------------------------------------------------------------------------------

/** Standard-mapping button indices (W3C Gamepad "standard" layout, by position). */
export const PAD = Object.freeze({
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  home: 16,
  extra: 17,
});

/** Standard buttons tracked per pad (0..17). */
export const STD_BUTTONS = 18;

/** sin(22.5°): splits the stick circle into 8 equal direction sectors. */
const SECTOR = 0.3827;

// ---------------------------------------------------------------------------------------------
// What a Gamepad looks like to this module
// ---------------------------------------------------------------------------------------------

export interface GamepadButtonLike {
  readonly pressed: boolean;
  readonly value: number;
}

/** The parts of a DOM `Gamepad` this module reads (a DOM Gamepad fits; tests pass plain objects). */
export interface GamepadLike {
  readonly id: string;
  readonly index: number;
  readonly connected: boolean;
  readonly mapping: string;
  readonly buttons: ArrayLike<GamepadButtonLike>;
  readonly axes: ArrayLike<number>;
  readonly vibrationActuator?: { playEffect?(type: string, params?: object): Promise<unknown> | unknown } | null;
  readonly hapticActuators?: ArrayLike<{ pulse?(value: number, duration: number): Promise<unknown> | unknown }>;
}

// ---------------------------------------------------------------------------------------------
// Identity, families, profiles
// ---------------------------------------------------------------------------------------------

export type PadFamily = 'playstation' | 'xbox' | 'nintendo' | 'generic';

export interface PadIdParts {
  vendor: number | null;
  product: number | null;
  /** The product name without the ids. */
  name: string;
}

const CHROME_ID = /\(\s*(?:[^()]*?\s)?Vendor:\s*([0-9a-f]{1,4})\s+Product:\s*([0-9a-f]{1,4})\s*\)/i;
const DASH_ID = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-(.*)$/i;

/**
 * Vendor and product ids from a `Gamepad.id`: Chrome `Name (STANDARD GAMEPAD Vendor: 054c
 * Product: 0ce6)`, Firefox / Safari `054c-0ce6-Name` or `54c-ce6-Name`; else the plain name
 * (Safari's GameController pads, XInput pads in Chrome on Windows) with null ids.
 */
export function parsePadId(id: string): PadIdParts {
  const c = CHROME_ID.exec(id);
  if (c) return { vendor: parseInt(c[1], 16), product: parseInt(c[2], 16), name: id.slice(0, c.index).trim() };
  const d = DASH_ID.exec(id);
  if (d) return { vendor: parseInt(d[1], 16), product: parseInt(d[2], 16), name: d[3].trim() };
  return { vendor: null, product: null, name: id.trim() };
}

/** Known vendors (USB ids). */
export const VENDORS = Object.freeze({ sony: 0x054c, microsoft: 0x045e, nintendo: 0x057e, eightBitDo: 0x2dc8 });

const VENDOR_FAMILY: ReadonlyMap<number, PadFamily> = new Map<number, PadFamily>([
  [VENDORS.sony, 'playstation'],
  [VENDORS.microsoft, 'xbox'],
  [VENDORS.nintendo, 'nintendo'],
  // 8BitDo pads carry the Nintendo layout (B south, A east, Y west, X north).
  [VENDORS.eightBitDo, 'nintendo'],
  // Logitech F310 / F710, PDP and PowerA Xbox pads: A B X Y.
  [0x046d, 'xbox'],
  [0x0e6f, 'xbox'],
  [0x24c6, 'xbox'],
]);

/** The family from the name (checked first: it is more specific than the vendor). */
function familyByName(name: string): PadFamily | null {
  if (/dualsense|dualshock|playstation|\bps[345]\b|sony|^wireless controller$/i.test(name)) return 'playstation';
  if (/xbox|xinput|x-box|microsoft/i.test(name)) return 'xbox';
  if (/8bitdo|nintendo|switch|joy-?con|pro controller|\bsnes\b|\bn64\b/i.test(name)) return 'nintendo';
  return null;
}

/** DualSense (Edge) product ids: their select button says CREATE. */
const DUALSENSE_PRODUCTS: ReadonlySet<number> = new Set([0x0ce6, 0x0df2]);

/** A non-standard pad's button profile: the raw button index of each standard index (−1: none). */
export interface PadProfile {
  readonly name: string;
  readonly buttons: readonly number[] | null;
}

/**
 * Raw layouts of common pads without the standard mapping (DirectInput / HID order, the usual
 * layouts of the SDL controller database; Chrome and Safari give the standard mapping for these
 * pads on macOS, Firefox remaps most of them itself). Unverified ones are said so in
 * docs/api/input.md; CONTROLS rebinds anything a profile gets wrong.
 */
export const PAD_PROFILES: Readonly<Record<string, PadProfile>> = Object.freeze({
  // Square 0, Cross 1, Circle 2, Triangle 3, L1 4, R1 5, L2 6, R2 7, Share 8, Options 9, L3 10, R3 11, PS 12, touchpad 13.
  'ps-hid': { name: 'ps-hid', buttons: [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, -1, -1, -1, -1, 12, 13] },
  // A 0, B 1, X 3, Y 4, LB 6, RB 7 (triggers on axes), View 10, Menu 11, Guide 12, LS 13, RS 14.
  'xbox-hid': { name: 'xbox-hid', buttons: [0, 1, 3, 4, 6, 7, -1, -1, 10, 11, 13, 14, -1, -1, -1, -1, 12, -1] },
  // B 0, A 1, Y 2, X 3 (by position), L 4, R 5, ZL 6, ZR 7, − 8, + 9, LS 10, RS 11, Home 12, Capture 13.
  'switch-hid': { name: 'switch-hid', buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, -1, -1, -1, -1, 12, 13] },
  // 8BitDo in D-input mode: A 0, B 1, X 3, Y 4, L 6, R 7, L2 8, R2 9, Select 10, Start 11, Home 12, LS 13, RS 14.
  '8bitdo-dinput': { name: '8bitdo-dinput', buttons: [1, 0, 4, 3, 6, 7, 8, 9, 10, 11, 13, 14, -1, -1, -1, -1, 12, -1] },
  // Unknown pads: the standard indices as they come (CONTROLS can rebind them).
  generic: { name: 'generic', buttons: null },
  standard: { name: 'standard', buttons: null },
});

const VENDOR_PROFILE: ReadonlyMap<number, string> = new Map([
  [VENDORS.sony, 'ps-hid'],
  [VENDORS.microsoft, 'xbox-hid'],
  [VENDORS.nintendo, 'switch-hid'],
  [VENDORS.eightBitDo, '8bitdo-dinput'],
]);

/** What the game knows about one pad model (cached per id and mapping). */
export interface PadInfo {
  readonly id: string;
  readonly vendor: number | null;
  readonly product: number | null;
  readonly name: string;
  readonly family: PadFamily;
  /** A short upper-case model name for the menus ('DUALSENSE', 'XBOX', 'SWITCH PRO', 'GAMEPAD' …). */
  readonly model: string;
  /** `Gamepad.mapping === 'standard'`. */
  readonly standard: boolean;
  readonly profile: PadProfile;
  /** The PlayStation select button says CREATE (DualSense) instead of SHARE. */
  readonly create: boolean;
}

function modelName(family: PadFamily, name: string, product: number | null): string {
  if (family === 'playstation') return /dualsense/i.test(name) || (product !== null && DUALSENSE_PRODUCTS.has(product)) ? 'DUALSENSE' : 'DUALSHOCK 4';
  if (family === 'xbox') return 'XBOX';
  if (family === 'nintendo') {
    if (/8bitdo/i.test(name)) return '8BITDO';
    if (/joy-?con/i.test(name)) return 'JOY-CON';
    return 'SWITCH PRO';
  }
  return 'GAMEPAD';
}

const infoCache = new Map<string, PadInfo>();

/** The family, model and profile of a pad (cached). */
export function padInfo(id: string, mapping: string): PadInfo {
  const key = `${mapping}|${id}`;
  let info = infoCache.get(key);
  if (info) return info;
  const parts = parsePadId(id);
  const family = familyByName(parts.name) ?? (parts.vendor !== null ? VENDOR_FAMILY.get(parts.vendor) : undefined) ?? familyByName(id) ?? 'generic';
  const standard = mapping === 'standard';
  const profileName = standard ? 'standard' : (parts.vendor !== null ? VENDOR_PROFILE.get(parts.vendor) : undefined) ?? 'generic';
  const create = family === 'playstation' && (/dualsense/i.test(parts.name) || (parts.product !== null && DUALSENSE_PRODUCTS.has(parts.product)));
  info = Object.freeze({
    id,
    vendor: parts.vendor,
    product: parts.product,
    name: parts.name,
    family,
    model: modelName(family, parts.name, parts.product),
    standard,
    profile: PAD_PROFILES[profileName] ?? PAD_PROFILES.generic,
    create,
  });
  if (infoCache.size > 64) infoCache.clear();
  infoCache.set(key, info);
  return info;
}

// ---------------------------------------------------------------------------------------------
// Hat switch
// ---------------------------------------------------------------------------------------------

const HAT_DIRS: readonly number[] = [
  1 << PAD.up,
  (1 << PAD.up) | (1 << PAD.right),
  1 << PAD.right,
  (1 << PAD.down) | (1 << PAD.right),
  1 << PAD.down,
  (1 << PAD.down) | (1 << PAD.left),
  1 << PAD.left,
  (1 << PAD.up) | (1 << PAD.left),
];

/** A hat axis rests here (and anything over 1.1 is no stick or trigger). */
export const HAT_NEUTRAL = 9 / 7;

/**
 * D-pad bits (standard 12-15) from a hat-switch axis: 8 directions from −1 (up) in steps of 2/7
 * clockwise to 1 (up-left); centred (9/7, anything outside −1.05..1.05, NaN) = 0.
 */
export function hatBits(v: number): number {
  if (!(v >= -1.05 && v <= 1.05)) return 0;
  return HAT_DIRS[Math.round((v + 1) * 3.5) & 7];
}

// ---------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------

/** A button label: text, or a drawn glyph (`ui/pad-ps` / `ui/pad-pos`, frame = face position 0..3). */
export interface PadLabel {
  readonly text: string;
  /** 'ps': the PlayStation shapes ✕ ○ □ △; 'pos': a generic position diamond. */
  readonly glyph?: 'ps' | 'pos';
  readonly frame?: number;
}

const L = (text: string, glyph?: 'ps' | 'pos', frame?: number): PadLabel => Object.freeze(glyph ? { text, glyph, frame } : { text });
const FACE_TEXT: readonly string[] = ['✕', '○', '□', '△'];
const LABELS: Readonly<Record<PadFamily, readonly PadLabel[]>> = {
  playstation: [
    ...FACE_TEXT.map((t, i) => L(t, 'ps', i)),
    L('L1'), L('R1'), L('L2'), L('R2'), L('SHARE'), L('OPTIONS'), L('L3'), L('R3'), L('↑'), L('↓'), L('←'), L('→'), L('PS'), L('PAD'),
  ],
  xbox: [L('A'), L('B'), L('X'), L('Y'), L('LB'), L('RB'), L('LT'), L('RT'), L('VIEW'), L('MENU'), L('LS'), L('RS'), L('↑'), L('↓'), L('←'), L('→'), L('XBOX'), L('SHARE')],
  // Nintendo positions: B south, A east, Y west, X north.
  nintendo: [L('B'), L('A'), L('Y'), L('X'), L('L'), L('R'), L('ZL'), L('ZR'), L('-'), L('+'), L('LS'), L('RS'), L('↑'), L('↓'), L('←'), L('→'), L('HOME'), L('CAPTURE')],
  generic: [
    ...['SOUTH', 'EAST', 'WEST', 'NORTH'].map((t, i) => L(t, 'pos', i)),
    L('L1'), L('R1'), L('L2'), L('R2'), L('SELECT'), L('START'), L('L3'), L('R3'), L('↑'), L('↓'), L('←'), L('→'), L('HOME'), L('B17'),
  ],
};
const CREATE = L('CREATE');
const numbered = new Map<number, PadLabel>();

/**
 * The label of standard button `index` on a pad of `family` (`create`: a DualSense, whose select
 * button says CREATE). Face buttons: PlayStation ✕ ○ □ △ (drawn glyphs), Xbox A B X Y, Nintendo
 * B A Y X (by position), generic pads a position diamond; others text ('L1', 'MENU', '+', '↑').
 */
export function padLabel(family: PadFamily, index: number, create = false): PadLabel {
  if (family === 'playstation' && create && index === PAD.select) return CREATE;
  const l = LABELS[family][index];
  if (l) return l;
  let n = numbered.get(index);
  if (!n) numbered.set(index, (n = L(`B${index}`)));
  return n;
}

// ---------------------------------------------------------------------------------------------
// Rumble
// ---------------------------------------------------------------------------------------------

const clamp01 = (v: number): number => (v > 1 ? 1 : v > 0 ? v : 0);
const ignore = (): void => {};

/** Rumble one pad (`dual-rumble`, else a haptic pulse). False when it has neither; never throws. */
export function playRumble(gp: GamepadLike, strong: number, weak: number, ms: number): boolean {
  try {
    const act = gp.vibrationActuator;
    if (act && typeof act.playEffect === 'function') {
      const p = act.playEffect('dual-rumble', { startDelay: 0, duration: Math.max(1, Math.round(ms)), strongMagnitude: clamp01(strong), weakMagnitude: clamp01(weak) });
      if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(ignore);
      return true;
    }
    const h = gp.hapticActuators && gp.hapticActuators.length > 0 ? gp.hapticActuators[0] : null;
    if (h && typeof h.pulse === 'function') {
      const p = h.pulse(clamp01(Math.max(strong, weak)), Math.max(1, Math.round(ms)));
      if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(ignore);
      return true;
    }
  } catch {
    // A browser that throws (a pad without motors, a closed device): no rumble.
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// PadSource
// ---------------------------------------------------------------------------------------------

/** One connected pad's state (one per Gamepad index, reused). */
class PadState {
  index = -1;
  id = '';
  info: PadInfo = padInfo('', 'standard');
  gp: GamepadLike | null = null;
  /** Standard buttons held now / last tick (bit i = standard index i). */
  bits = 0;
  prev = 0;
  /** Left-stick directions as Button bits (left / right / up / down). */
  stick = 0;
  /** Axis index of a detected hat switch (−1: none found yet). */
  hat = -1;
  /** Tick of the last button press (the pad used last). */
  pressT = -1;
  /** Rumble: until this tick, with this strength (a weaker one does not cut it short). */
  rumbleEnd = 0;
  rumbleAmp = 0;
  seen = false;
}

/** A slot's pad: its id and index, and whether it is connected now. */
export interface PadClaim {
  readonly id: string;
  index: number;
  live: boolean;
  readonly info: PadInfo;
}

export type PadsFn = () => ArrayLike<GamepadLike | null> | null | undefined;

const MAX_PADS = 16;

/**
 * Gamepads as an InputSource (see the module comment). `getPads` is polled once per tick
 * (`navigator.getGamepads` in the browser).
 */
export class PadSource implements InputSource {
  /** Radial dead zone of the left stick (0..1). */
  deadZone = 0.3;
  /** Dead zone of both sticks in the first-person mode. */
  fpsDeadZone = 0.2;
  /** The pads of the two player slots (null: none). */
  readonly claims: [PadClaim | null, PadClaim | null] = [null, null];
  /** Called when a pad connects (true) or disconnects (false) (logs, tests). */
  onChange: ((info: PadInfo, index: number, connected: boolean) => void) | null = null;
  private readonly getPads: PadsFn;
  private readonly states: (PadState | null)[] = [];
  /** This tick's presses: pad index and standard button (parallel lists, `pressN` long). */
  private readonly pressPad: number[] = [];
  private readonly pressBtn: number[] = [];
  private pressN = 0;
  private readonly queue: string[] = [];
  private tick = 0;
  private last = -1;
  private curBits = 0;
  private readonly isDown = (i: number): boolean => ((this.curBits >>> i) & 1) === 1;
  private readonly fpsPad = defaultFpsPadMap();
  private fpsActions = 0;
  private readonly fpsAnalog: AnalogState = { turn: 0, moveX: 0, moveY: 0 };
  private readonly stickTmp: AnalogState = { turn: 0, moveX: 0, moveY: 0 };

  constructor(getPads: PadsFn) {
    this.getPads = getPads;
  }

  // ------------------------------------------------------------------------------- polling

  update(ctx: InputContext): void {
    this.tick++;
    this.pressN = 0;
    let pads: ArrayLike<GamepadLike | null> | null | undefined = null;
    try {
      pads = this.getPads();
    } catch {
      pads = null;
    }
    const states = this.states;
    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      if (st) st.seen = false;
    }
    const n = pads ? Math.min(pads.length, MAX_PADS) : 0;
    for (let k = 0; k < n; k++) {
      const gp = pads![k];
      if (!gp || !gp.connected) continue;
      const idx = gp.index >= 0 && gp.index < MAX_PADS ? gp.index : k;
      let st = states[idx];
      const fresh = !st || st.id !== gp.id || st.index !== idx;
      if (fresh) {
        if (st && st.id) this.onChange?.(st.info, st.index, false);
        st ??= states[idx] = new PadState();
        st.index = idx;
        st.id = gp.id;
        st.info = padInfo(gp.id, gp.mapping);
        st.hat = -1;
        st.pressT = -1;
        st.rumbleEnd = 0;
        this.onChange?.(st.info, idx, true);
      }
      st!.seen = true;
      st!.gp = gp;
      this.readPad(st!, gp, fresh);
    }
    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      if (st && !st.seen && st.id) {
        this.onChange?.(st.info, st.index, false);
        st.id = '';
        st.gp = null;
        st.bits = st.prev = st.stick = 0;
      }
    }
    this.updateClaims();
    // 1-player mode: the first pad that presses anything but START while player 1 has no pad
    // becomes player 1's (a direct start; the menus claim with START or the south button).
    if (ctx.players === 1 && this.claims[0] === null) {
      for (let p = 0; p < this.pressN; p++) {
        if (this.pressBtn[p] !== PAD.start) {
          this.claim(0, this.pressPad[p]);
          break;
        }
      }
    }
    if (ctx.fpsMode === true) this.updateFps();
  }

  /** Standard buttons, stick and press edges of one pad. */
  private readPad(st: PadState, gp: GamepadLike, fresh: boolean): void {
    const prof = st.info.profile.buttons;
    const btn = gp.buttons;
    let bits = 0;
    for (let i = 0; i < STD_BUTTONS; i++) {
      const raw = prof ? prof[i] : i;
      if (raw === undefined || raw < 0 || raw >= btn.length) continue;
      const b = btn[raw];
      if (b && (b.pressed || b.value > 0.5)) bits |= 1 << i;
    }
    const axes = gp.axes;
    if (!st.info.standard) {
      if (st.hat < 0) {
        for (let a = 2; a < axes.length; a++) {
          if (axes[a] > 1.1) {
            st.hat = a;
            break;
          }
        }
      }
      if (st.hat >= 0 && st.hat < axes.length) bits |= hatBits(axes[st.hat]);
    }
    let stick = 0;
    const ax = axes.length > 0 ? axes[0] : 0;
    const ay = axes.length > 1 ? axes[1] : 0;
    const mag = Math.hypot(ax, ay);
    if (mag >= this.deadZone && mag <= 1.5) {
      const nx = ax / mag;
      const ny = ay / mag;
      if (nx < -SECTOR) stick |= BUTTON_BIT.left;
      if (nx > SECTOR) stick |= BUTTON_BIT.right;
      if (ny < -SECTOR) stick |= BUTTON_BIT.up;
      if (ny > SECTOR) stick |= BUTTON_BIT.down;
    }
    st.stick = stick;
    // A pad seen for the first time reports no edges (a button held while it connects).
    st.prev = fresh ? bits : st.bits;
    st.bits = bits;
    const edges = bits & ~st.prev;
    if (edges === 0) return;
    st.pressT = this.tick;
    this.last = st.index;
    for (let i = 0; i < STD_BUTTONS; i++) {
      if (!((edges >>> i) & 1)) continue;
      if (this.pressN < 64) {
        this.pressPad[this.pressN] = st.index;
        this.pressBtn[this.pressN] = i;
        this.pressN++;
      }
      if (this.queue.length < 32) this.queue.push(padButtonCode(i));
    }
  }

  /** Claims follow their pads: live while connected; a lost one takes its pad back when it returns. */
  private updateClaims(): void {
    for (let s = 0; s < 2; s++) {
      const c = this.claims[s];
      if (!c) continue;
      const at = this.states[c.index];
      if (at && at.id === c.id && !this.claimedByOther(s, c.index)) {
        c.live = true;
        continue;
      }
      c.live = false;
      // The same pad back at another index (same id; never a pad the other slot holds).
      for (let i = 0; i < this.states.length; i++) {
        const st = this.states[i];
        if (st && st.id === c.id && !this.claimedByOther(s, i)) {
          c.index = i;
          c.live = true;
          break;
        }
      }
    }
  }

  private claimedByOther(slot: number, index: number): boolean {
    const o = this.claims[1 - slot];
    return o !== null && o.live && o.index === index;
  }

  // ------------------------------------------------------------------------------- slots

  /** Give pad `index` (connected) to `slot`; a pad held by the other slot moves. False when no such pad. */
  claim(slot: PlayerSlot, index: number): boolean {
    const st = index >= 0 ? this.states[index] : null;
    if (!st || !st.id) return false;
    const o = this.claims[1 - slot];
    if (o && o.index === index && o.id === st.id) this.claims[1 - slot] = null;
    this.claims[slot] = { id: st.id, index, live: true, info: st.info };
    return true;
  }

  /** Forget the pad of `slot` (the player goes on with the keyboard). */
  release(slot: PlayerSlot): void {
    this.claims[slot] = null;
  }

  /** Pad index of the slot's connected pad (−1: none or lost). */
  liveIndex(slot: PlayerSlot): number {
    const c = this.claims[slot];
    return c && c.live ? c.index : -1;
  }

  /** The slot claimed a pad that is not connected now. */
  lost(slot: PlayerSlot): boolean {
    const c = this.claims[slot];
    return c !== null && !c.live;
  }

  /** Is pad `index` connected and free (1 player: not player 1's; 2 players: nobody's)? */
  isFree(index: number, players: 1 | 2): boolean {
    const st = index >= 0 ? this.states[index] : null;
    if (!st || !st.id) return false;
    if (this.liveIndex(0) === index) return false;
    return players === 1 || this.liveIndex(1) !== index;
  }

  /** Connected pads. */
  get connected(): number {
    let n = 0;
    for (let i = 0; i < this.states.length; i++) if (this.states[i]?.id) n++;
    return n;
  }

  /** Connected free pads (see `isFree`). */
  freeCount(players: 1 | 2): number {
    let n = 0;
    for (let i = 0; i < this.states.length; i++) if (this.isFree(i, players)) n++;
    return n;
  }

  /**
   * The first pad that pressed one of up to three standard buttons this tick (−1: none; unused
   * arguments −1). Fixed arity: it is asked every tick, so no argument array is allocated.
   */
  pressedBy(b0: number, b1 = -1, b2 = -1): number {
    for (let p = 0; p < this.pressN; p++) {
      const b = this.pressBtn[p];
      if (b === b0 || b === b1 || b === b2) return this.pressPad[p];
    }
    return -1;
  }

  /** The first FREE pad (`isFree`) that pressed one of up to three standard buttons this tick (−1: none). */
  freePressedBy(players: 1 | 2, b0: number, b1 = -1, b2 = -1): number {
    for (let p = 0; p < this.pressN; p++) {
      const b = this.pressBtn[p];
      const i = this.pressPad[p];
      if ((b === b0 || b === b1 || b === b2) && this.isFree(i, players)) return i;
    }
    return -1;
  }

  /** Did pad `index` press standard button `button` this tick? */
  padPressed(index: number, button: number): boolean {
    for (let p = 0; p < this.pressN; p++) if (this.pressPad[p] === index && this.pressBtn[p] === button) return true;
    return false;
  }

  /** The info of a connected pad (null: none at that index). */
  info(index: number): PadInfo | null {
    const st = index >= 0 ? this.states[index] : null;
    return st && st.id ? st.info : null;
  }

  /** The pad that pressed a button last (−1: none yet). */
  get lastIndex(): number {
    return this.last;
  }

  /** Is standard button `button` of pad `index` held? (tests, CONTROLS) */
  held(index: number, button: number): boolean {
    const st = index >= 0 ? this.states[index] : null;
    return !!st && !!st.id && ((st.bits >>> button) & 1) === 1;
  }

  // ------------------------------------------------------------------------------- InputSource

  /** The Button mask of one pad through a pad map (+ its stick). */
  private maskOf(st: PadState, map: PadMap): number {
    this.curBits = st.bits;
    return maskFromPad(map, this.isDown) | st.stick;
  }

  read(slot: PlayerSlot, ctx: InputContext): number {
    const b = ctx.bindings;
    if (ctx.players === 2) {
      const i = this.liveIndex(slot);
      const st = i >= 0 ? this.states[i] : null;
      let m = st && st.id ? this.maskOf(st, slot === 0 ? b.pad : (b.pad2 ?? b.pad)) : 0;
      // A menu over a 2-player game: the pads nobody holds navigate it too (through slot 0).
      if (slot === 0 && ctx.menuPads === true) {
        for (let k = 0; k < this.states.length; k++) {
          const o = this.states[k];
          if (o && o.id && this.isFree(k, 2)) m |= this.maskOf(o, b.pad);
        }
      }
      return m;
    }
    if (slot !== 0) return 0;
    // 1 player: every pad drives player 1. While a 1-player game watches for a join, the START
    // of a pad that is not player 1's is held back (it asks to join).
    const own = this.liveIndex(0);
    const watch = ctx.joinWatch === true;
    let m = 0;
    for (let i = 0; i < this.states.length; i++) {
      const st = this.states[i];
      if (!st || !st.id) continue;
      let pm = this.maskOf(st, b.pad);
      if (watch && i !== own) pm &= ~BUTTON_BIT.start;
      m |= pm;
    }
    return m;
  }

  drainPressed(out: string[]): void {
    for (let i = 0; i < this.queue.length; i++) out.push(this.queue[i]);
    this.queue.length = 0;
  }

  /** First person: every pad feeds slot 0 (buttons OR-ed; per stick axis the largest value wins). */
  private updateFps(): void {
    this.fpsActions = 0;
    const fa = this.fpsAnalog;
    fa.turn = fa.moveX = fa.moveY = 0;
    const st2 = this.stickTmp;
    for (let i = 0; i < this.states.length; i++) {
      const st = this.states[i];
      if (!st || !st.id || !st.gp) continue;
      this.curBits = st.bits;
      this.fpsActions |= actionsFromPadButtons(this.fpsPad, this.isDown);
      const axes = st.gp.axes;
      stickMoveInto(axes.length > 0 ? axes[0] : 0, axes.length > 1 ? axes[1] : 0, st2, this.fpsDeadZone);
      const turn = stickTurn(axes.length > 2 && axes[2] <= 1.05 ? axes[2] : 0, this.fpsDeadZone);
      if (Math.abs(st2.moveX) > Math.abs(fa.moveX)) fa.moveX = st2.moveX;
      if (Math.abs(st2.moveY) > Math.abs(fa.moveY)) fa.moveY = st2.moveY;
      if (Math.abs(turn) > Math.abs(fa.turn)) fa.turn = turn;
    }
  }

  readActions(slot: PlayerSlot): number {
    return slot === 0 ? this.fpsActions : 0;
  }

  readAnalog(slot: PlayerSlot, out: AnalogState): void {
    if (slot !== 0) return;
    out.turn += this.fpsAnalog.turn;
    out.moveX += this.fpsAnalog.moveX;
    out.moveY += this.fpsAnalog.moveY;
  }

  // ------------------------------------------------------------------------------- rumble

  /**
   * Rumble the pad of `slot` (`strong` / `weak` motor 0..1, `ms` long). 1 player without a
   * claimed pad: the pad used last. A weaker effect does not cut a stronger one short. Returns
   * true when a motor was asked.
   */
  rumble(slot: PlayerSlot, strong: number, weak: number, ms: number, players: 1 | 2 = 1): boolean {
    let i = this.liveIndex(slot);
    if (i < 0 && players === 1 && slot === 0) i = this.last;
    return this.rumblePad(i, strong, weak, ms);
  }

  /** Rumble pad `index` (−1: nothing); see `rumble`. */
  rumblePad(i: number, strong: number, weak: number, ms: number): boolean {
    const st = i >= 0 ? this.states[i] : null;
    if (!st || !st.id || !st.gp) return false;
    const amp = Math.max(strong, weak);
    if (this.tick < st.rumbleEnd && amp < st.rumbleAmp) return false;
    st.rumbleEnd = this.tick + Math.ceil(ms / (1000 / 60));
    st.rumbleAmp = amp;
    return playRumble(st.gp, strong, weak, ms);
  }
}
