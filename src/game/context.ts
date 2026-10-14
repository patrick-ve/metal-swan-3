/**
 * Per-world game context: the session, the difficulty and the HUD state that entities and
 * scripts can reach from any `World` (the engine World knows nothing about the game).
 *
 * The mission runner attaches one with `attachGame(world, session)`. Worlds without one (unit
 * tests, tools) get a default 1-player 'normal' session on first use, so content code can
 * always call `difficultyOf(world)` / `hudOf(world)` without checks.
 */
import type { Color } from '../engine/color';
import type { World } from '../engine/world';
import { GameSession, type DifficultyMods } from './session';
import { DEFAULT_SETTINGS, type GameSettings } from './settings';

// ---------------------------------------------------------------------------------------------
// HUD state (what scripts and entities ask the HUD to show)
// ---------------------------------------------------------------------------------------------

export type BannerStyle = 'warning' | 'mission' | 'info';

export interface Banner {
  text: string;
  sub: string;
  /** Third line (small font): a boss subtitle. */
  detail: string;
  style: BannerStyle;
  /** Ticks left / total. */
  ticks: number;
  total: number;
}

export type GoDir = 'right' | 'left' | 'up' | 'down';

export interface HudMessage {
  text: string;
  ticks: number;
  color: Color;
}

export interface BannerOpts {
  sub?: string;
  /** Third line under `sub` (small font), e.g. a boss subtitle. */
  detail?: string;
  style?: BannerStyle;
  /** How long it stays (default 150 ticks). */
  ticks?: number;
}

/**
 * Speech bubble kinds (GDD §13.7): 'gag' bubbles ('!', 'MMF!', jokes) hide with the SPEECH
 * BUBBLES OFF option; 'hint' bubbles (RIDE?, tutorial hints) and 'radio' lines always show.
 */
export type BubbleKind = 'gag' | 'hint' | 'radio';

export interface BubbleOpts {
  /** Ticks on screen (default 120). */
  ticks?: number;
  kind?: BubbleKind;
  /** Extra px above the speaker's head (default 4). */
  dy?: number;
  /**
   * Tail tip relative to the target's anchor (world px, already mirrored by the caller), e.g.
   * the hatch of an empty vehicle for RIDE? (GDD §8.1: the tail points at the hatch, 8 px above
   * it). Without it the tail points at the top of the target's hitbox, `dy` px above it.
   */
  tip?: readonly [number, number];
  /** false: never voiced (ROBO-HALSEMA speaks in text only). Default true (see `HudState.onBubble`). */
  voice?: boolean;
  /** Who speaks the line (e.g. 'baker', 'gramps'): passed on to `AudioOut.say` with the text. */
  speaker?: string;
}

/** Something that talks: an entity (followed while it lives) or a fixed world point. */
export interface BubbleTarget {
  readonly x: number;
  readonly y: number;
  readonly hitbox?: { readonly y: number };
  readonly removed?: boolean;
  /** A dead target loses its pointer hints (bubbles stay until they expire). */
  readonly dead?: boolean;
}

export interface Bubble {
  /** The text, word-wrapped to at most 24 characters per line and 2 lines ('\n'). */
  text: string;
  target: BubbleTarget;
  kind: BubbleKind;
  ticks: number;
  total: number;
  dy: number;
  tip: readonly [number, number] | null;
}

export interface PointerOpts {
  /** Ticks on screen (default: until cleared, or until the target dies or is removed). */
  ticks?: number;
  /** Extra px between the target's hitbox top and the lowest chevron (default 4). */
  dy?: number;
}

/**
 * A blinking hint over a target: the word and three gold chevrons pointing down at it (GDD
 * §11.1: `STOMP!` over the front drummer, `SHOOT!` over the willow). A hint: SPEECH BUBBLES OFF
 * never hides it.
 */
export interface Pointer {
  text: string;
  target: BubbleTarget;
  ticks: number;
  total: number;
  dy: number;
}

export interface CalloutOpts {
  /** Ticks on screen (default 90). */
  ticks?: number;
  color?: Color;
}

export interface Callout {
  text: string;
  ticks: number;
  total: number;
  color: Color;
}

/** A score number rising from a kill (world space). */
export interface ScorePopup {
  text: string;
  x: number;
  y: number;
  ticks: number;
}

/** A full-screen flash (boss deaths, lightning); the HUD obeys REDUCE FLASHES. */
export interface ScreenFlash {
  color: Color;
  alpha: number;
  ticks: number;
  total: number;
}

const MAX_BUBBLES = 16;
const MAX_POINTERS = 4;
const MAX_CALLOUTS = 3;
const MAX_POPUPS = 24;
/** Speech bubbles hold at most 24 characters × 2 lines (GDD §13.7). */
export const BUBBLE_LINE_CHARS = 24;
/** GDD §13.7 / §4.12: the ONWARD prompt shows after 90 ticks without scrolling. */
export const GO_STILL_TICKS = 90;
/** An unlock prompt is dropped once the view has scrolled this far onward (the player went on). */
const GO_DROP_PX = 96;
const GO_TICKS = 240;
const GOLD_TEXT: Color = 0xffe070ff;

/**
 * Word-wrap `text` to lines of at most `max` characters (explicit '\n' kept), at most `lines`
 * lines; a word longer than a line is cut.
 */
export function wrapText(text: string, max: number, lines = Infinity): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (!word) continue;
      const next = line ? `${line} ${word}` : word;
      if (next.length <= max) line = next;
      else {
        if (line) out.push(line);
        line = word.length > max ? word.slice(0, max) : word;
      }
    }
    out.push(line);
  }
  return out.slice(0, Math.max(1, lines));
}

/**
 * Transient HUD requests: banners, the ONWARD prompt, per-player pop-up lines, speech bubbles,
 * pointer hints, centred callouts, score pop-ups and screen flashes. Every content module talks
 * to the HUD through this one object (`hudOf(world)` / `ctx.hud`), so options such as SPEECH
 * BUBBLES OFF apply everywhere.
 */
export class HudState {
  banner: Banner | null = null;
  /** ONWARD prompt: shown while goTicks > 0 (after goDelay). */
  goTicks = 0;
  goDelay = 0;
  goDir: GoDir = 'right';
  /** One pop-up line per player slot (weapon names, "BOMBS +10" …). */
  readonly messages: [HudMessage | null, HudMessage | null] = [null, null];
  readonly bubbles: Bubble[] = [];
  readonly pointers: Pointer[] = [];
  readonly callouts: Callout[] = [];
  readonly popups: ScorePopup[] = [];
  flash: ScreenFlash | null = null;
  /** Hide the whole HUD (cut-scenes, attract mode). */
  hidden = false;
  /** ONWARD bookkeeping: the still time a delayed prompt waits for, the scroll since the request. */
  private goStill = 0;
  private goScrolled = 0;
  private camX = NaN;
  private camY = NaN;

  /** Show a centred banner ("WARNING!", "MISSION 1", …). */
  showBanner(text: string, o: BannerOpts = {}): void {
    const ticks = Math.max(1, Math.floor(o.ticks ?? 150));
    this.banner = { text, sub: o.sub ?? '', detail: o.detail ?? '', style: o.style ?? 'info', ticks, total: ticks };
  }

  clearBanner(): void {
    this.banner = null;
  }

  /**
   * The blinking ONWARD prompt for `ticks` ticks (or until hideGo). With a `delay` (an arena
   * UNLOCK: GDD §4.12, 90 ticks) it waits until the view has not scrolled for that long, and it
   * is dropped once the view has scrolled 96 px onward (the scene reports the camera through
   * `trackCamera`). `delay` 0 shows it at once.
   */
  showGo(dir: GoDir = 'right', delay: number = GO_STILL_TICKS, ticks: number = GO_TICKS): void {
    this.goDir = dir;
    this.goStill = Math.max(0, Math.floor(delay));
    this.goDelay = this.goStill;
    this.goTicks = Math.max(1, Math.floor(ticks));
    this.goScrolled = 0;
  }

  hideGo(): void {
    this.goTicks = 0;
    this.goDelay = 0;
    this.goStill = 0;
  }

  /** True while the prompt should be drawn (blinking is up to the HUD). */
  get goVisible(): boolean {
    return this.goDelay === 0 && this.goTicks > 0;
  }

  /**
   * Report the camera's top-left once per tick (the gameplay scene does). Scrolling onward
   * restarts the still time of a delayed ONWARD prompt and drops it after 96 px.
   */
  trackCamera(x: number, y: number): void {
    const lastX = this.camX;
    const lastY = this.camY;
    this.camX = x;
    this.camY = y;
    if (this.goTicks <= 0 || this.goStill <= 0 || Number.isNaN(lastX)) return;
    const d = this.goDir;
    const onward = d === 'right' ? x - lastX : d === 'left' ? lastX - x : d === 'up' ? lastY - y : y - lastY;
    if (onward <= 0.25) return;
    this.goScrolled += onward;
    if (this.goScrolled >= GO_DROP_PX) this.hideGo();
    else if (this.goDelay > 0) this.goDelay = this.goStill;
  }

  /** Short pop-up line in a player's HUD panel. */
  message(slot: number, text: string, ticks = 90, color: Color = GOLD_TEXT): void {
    if (slot !== 0 && slot !== 1) return;
    this.messages[slot] = { text, ticks, color };
  }

  /**
   * Called with the text of every new bubble (unless `voice: false`); the mission runner voices
   * it (`AudioOut.say`, a voice sample when one is loaded). Audio only: no game state.
   */
  onBubble: ((text: string, kind: BubbleKind, speaker?: string) => void) | null = null;

  /**
   * A speech bubble over a speaker (word-wrapped to 24 characters × 2 lines; '\n' breaks the
   * line). One bubble per speaker: a new one replaces the old one. Returns the bubble (its
   * `ticks` can be changed).
   */
  bubble(target: BubbleTarget, text: string, o: BubbleOpts = {}): Bubble {
    if (o.voice !== false) this.onBubble?.(text, o.kind ?? 'gag', o.speaker);
    const ticks = Math.max(1, Math.floor(o.ticks ?? 120));
    const lines = text.length <= BUBBLE_LINE_CHARS && text.indexOf('\n') < 0 ? text : wrapText(text, BUBBLE_LINE_CHARS, 2).join('\n');
    const i = this.bubbles.findIndex((b) => b.target === target);
    const b: Bubble = { text: lines, target, kind: o.kind ?? 'gag', ticks, total: ticks, dy: o.dy ?? 4, tip: o.tip ?? null };
    if (i >= 0) this.bubbles[i] = b;
    else {
      if (this.bubbles.length >= MAX_BUBBLES) this.bubbles.shift();
      this.bubbles.push(b);
    }
    return b;
  }

  /** Remove the bubble of a speaker (e.g. when it is shot mid-sentence). */
  clearBubble(target: BubbleTarget): void {
    const i = this.bubbles.findIndex((b) => b.target === target);
    if (i >= 0) this.bubbles.splice(i, 1);
  }

  /**
   * A pointer hint over a target: `text` (e.g. 'STOMP!', 'SHOOT!') and three gold chevrons
   * pointing down at it, blinking. One per target; it goes when cleared, when its ticks run out
   * or when the target dies or is removed.
   */
  pointer(target: BubbleTarget, text: string, o: PointerOpts = {}): Pointer {
    const ticks = o.ticks === undefined ? Infinity : Math.max(1, Math.floor(o.ticks));
    const p: Pointer = { text, target, ticks, total: ticks, dy: o.dy ?? 4 };
    const i = this.pointers.findIndex((q) => q.target === target);
    if (i >= 0) this.pointers[i] = p;
    else {
      if (this.pointers.length >= MAX_POINTERS) this.pointers.shift();
      this.pointers.push(p);
    }
    return p;
  }

  /** Remove the pointer hint of a target. */
  clearPointer(target: BubbleTarget): void {
    const i = this.pointers.findIndex((p) => p.target === target);
    if (i >= 0) this.pointers.splice(i, 1);
  }

  /** A centred callout ('CHECKPOINT', 'CAUGHT NAPPING +100' …); up to 3 stack. */
  callout(text: string, o: CalloutOpts = {}): void {
    const ticks = Math.max(1, Math.floor(o.ticks ?? 90));
    if (this.callouts.length >= MAX_CALLOUTS) this.callouts.shift();
    this.callouts.push({ text, ticks, total: ticks, color: o.color ?? GOLD_TEXT });
  }

  /** A score number rising from (x, y) in world space (fed by the runner from 'score' events). */
  popup(x: number, y: number, text: string): void {
    if (this.popups.length >= MAX_POPUPS) this.popups.shift();
    this.popups.push({ text, x, y, ticks: 40 });
  }

  /** A full-screen flash of `color` at `alpha`, fading over `ticks` (REDUCE FLASHES caps it at 30 %). */
  screenFlash(color: Color, alpha = 0.8, ticks = 8): void {
    this.flash = { color, alpha, ticks: Math.max(1, ticks), total: Math.max(1, ticks) };
  }

  /** Count down timers; called once per tick by the mission runner. */
  update(): void {
    if (this.banner && --this.banner.ticks <= 0) this.banner = null;
    if (this.goDelay > 0) this.goDelay--;
    else if (this.goTicks > 0) this.goTicks--;
    for (let i = 0; i < 2; i++) {
      const m = this.messages[i];
      if (m && --m.ticks <= 0) this.messages[i] = null;
    }
    expire(this.bubbles, (b) => --b.ticks <= 0 || b.target.removed === true);
    expire(this.pointers, (p) => --p.ticks <= 0 || p.target.removed === true || p.target.dead === true);
    expire(this.callouts, (c) => --c.ticks <= 0);
    expire(this.popups, (p) => --p.ticks <= 0);
    if (this.flash && --this.flash.ticks <= 0) this.flash = null;
  }
}

/** Remove the items for which `done` is true (in place, no allocation). */
function expire<T>(list: T[], done: (t: T) => boolean): void {
  let w = 0;
  for (let i = 0; i < list.length; i++) if (!done(list[i])) list[w++] = list[i];
  list.length = w;
}

// ---------------------------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------------------------

export interface GameContext {
  readonly session: GameSession;
  readonly hud: HudState;
  /** Player options (speech bubbles, shake, reduced flashes …). */
  readonly settings: GameSettings;
  /** Ground x ranges covered in ice (SectionDef.iceRanges); see `iceAt`. */
  ice: readonly (readonly [number, number])[];
  /** Extra data a mission runner shares with entities (null outside a mission). */
  runner: unknown;
  /** The players' footsteps are audible (`MissionDef.footsteps`; set by the mission runner). */
  footsteps?: boolean;
}

const contexts = new WeakMap<World, GameContext>();

/** Attach the game state to a world (done by the mission runner; tests may call it too). */
export function attachGame(
  world: World,
  session: GameSession,
  hud: HudState = new HudState(),
  settings: GameSettings = { ...DEFAULT_SETTINGS },
): GameContext {
  const ctx: GameContext = { session, hud, settings, ice: [], runner: null };
  contexts.set(world, ctx);
  return ctx;
}

/** The world's game context; creates a default 1-player 'normal' one when there is none. */
export function gameOf(world: World): GameContext {
  let ctx = contexts.get(world);
  if (!ctx) ctx = attachGame(world, new GameSession({ seed: world.rng.seed }));
  return ctx;
}

export function sessionOf(world: World): GameSession {
  return gameOf(world).session;
}

export function difficultyOf(world: World): DifficultyMods {
  return gameOf(world).session.mods;
}

export function hudOf(world: World): HudState {
  return gameOf(world).hud;
}

/** Is the ground at x icy (players and vehicles slide; GDD §11.3)? */
export function iceAt(world: World, x: number): boolean {
  const ice = gameOf(world).ice;
  for (let i = 0; i < ice.length; i++) if (x >= ice[i][0] && x < ice[i][1]) return true;
  return false;
}

export function settingsOf(world: World): GameSettings {
  return gameOf(world).settings;
}

/**
 * A full-screen flash that obeys REDUCE FLASHES (max 30 % then): boss deaths, lightning,
 * the avalanche. `alpha` 0..1, fading over `ticks`.
 */
export function flash(world: World, color: Color, alpha = 0.8, ticks = 8): void {
  const g = gameOf(world);
  g.hud.screenFlash(color, g.settings.reduceFlashes ? Math.min(alpha, 0.3) : alpha, ticks);
}

/** Number of active players in the session (co-op balance). */
export function playerCountOf(world: World): number {
  return Math.max(1, gameOf(world).session.activeCount);
}
