/**
 * Gameplay scene: a MissionRunner (world + section + players) with the HUD, the pause overlay,
 * 2-player join / continue (a credit each when credits are limited), debug hooks (F4 skip, F5
 * weapons) and the hand-offs to GAME OVER (after the in-world continue countdown, GDD §4.6: no
 * continue menu) and the mission-complete tally. It also
 * plays the attract-mode demo (GDD §13.3): a bot on ams-a (m1-a without it) with `DEMO PLAY`, ended by any key.
 *
 * Missions that have a mission card (flow-data.ts) start with the card's banner (`MISSION 1` /
 * `START!`, 120 ticks, GDD §13.6) and announcer line, and end with `MISSION COMPLETE! BRAVO!`,
 * unless the MissionDef sets its own `startBanner`, `announce` or `clearLine`.
 *
 * Gamepads (docs/design/ams-extras.md §10, GDD §4.9): player 2 joins a 1-player game at any time
 * with START on a free pad or the keyboard key 2 (a credit; the next squad hero; the input, HUD,
 * session and tier-4 working set switch to 2 players); in a 2-player game START on a free pad
 * takes a slot without a pad. The pad of a player in play dropping out pushes the lost-pad pause
 * (`LostPadScene`). RUMBLE (rumble.ts) on deaths, big blasts, boss part breaks and vehicle hits.
 */
import { NullAudio } from '../../engine/audio';
import { ACTION_BUTTONS, type InputSource } from '../../engine/input';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { browserArtPool, type ArtPool } from '../../engine/art-pool';
import {
  artTier,
  denseBytes,
  denseTarget,
  generatedSprites,
  hasFramesAt,
  hasHiSprite,
  HI_ART_FRAME_BUDGET_MS,
  isDeferredSprite,
  listHiSprites,
  preloadOrder,
  readyFrames,
  releaseDense,
  setDeferDense,
  setDeferHiArt,
  takeDenseQueue,
  toArtDensity,
  withArtDensity,
} from '../../engine/sprites';
import { blinkOn, centerText, newCampaign, UI_WHITE, type GameApp } from '../app';
import { drawHud } from '../hud';
import type { MissionDef } from '../mission/index';
import { MissionRunner } from '../mission/runner';
import { getMission, getWeapon, hasMission, listMissions, listWeapons } from '../registry';
import { GameSession, type Difficulty } from '../session';
import { creditsOf, type GameSettings } from '../settings';
import { TUNING } from '../tuning';
import { GameOverScene } from './game-over';
import { hasMissionCard, missionCard, VOICE } from './flow-data';
import { GlitchBridgeScene } from './glitch-bridge';
import { MissionCompleteScene } from './mission-complete';
import type { PauseHost } from './pause';
import { PlayControls, type PlayHost } from './play-host';
import { RumbleWatch } from './rumble';

// The join helpers live in play-host.ts (shared with the ring's RingScene).
export { JOIN_KEY, joinCharacter, keySetLine } from './play-host';

export interface NewGameOpts {
  players?: 1 | 2;
  difficulty?: Difficulty;
  /** Mission id (default: m1, else the first registered mission). */
  mission?: string;
  section?: string;
  bossRush?: boolean;
  /** Characters per player (default: ?char= or 'recruit'). */
  characters?: readonly string[];
}

/** The background 2× preload, once started (sprites.ts caches what it generated). */
let hiPreload: Promise<unknown> | null = null;

/**
 * Time budget (ms) of the 2× preload per browser frame: about half a 60 fps frame. The same
 * budget runs the queued 2× scenery jobs (background layers, terrain chunks; SectionView), and
 * the art pool's main-thread fallback (no Worker, or a broken worker).
 */
export const MISSION_ART_BUDGET_MS = HI_ART_FRAME_BUDGET_MS;

/**
 * The order of a mission's 2× preload: the sprites of the joined players' characters first (the
 * first thing drawn), then the mission's `preloadFirst` prefixes and the `art` of the section the
 * play starts in (`section`, default the mission's `start`: its decor is on the first screen);
 * its `preloadLast` prefixes last.
 */
export function missionArtOrder(
  mission: (Pick<MissionDef, 'preloadFirst' | 'preloadLast'> & Partial<Pick<MissionDef, 'start' | 'sections'>>) | undefined,
  session: Pick<GameSession, 'slots'> | null | undefined,
  section: string | undefined = mission?.start,
): { first: string[]; last: string[] } {
  const chars = (session?.slots ?? []).filter((s) => s.joined).map((s) => `char/${s.character}/`);
  const own = section ? (mission?.sections?.[section]?.art ?? []) : [];
  return { first: [...new Set([...chars, ...(mission?.preloadFirst ?? []), ...own])], last: [...(mission?.preloadLast ?? [])] };
}

/**
 * The mission art the preload needs: its order prefixes, sections and boss section. `extraChar`
 * (mission `ring`, docs/design/ring.md §13): `char/…` prefixes of heroes nobody plays that join
 * the tier-4 working set anyway (the drivers' `ride-*` and `mount` strips); missions without it
 * (ams) keep only the chosen heroes' art. `denseReserve` (mission `ring`): bytes the mission's own
 * 4× buffers take besides the sprites (the ring's streamed scenery, ring/view.ts); the tier-4 run
 * keeps its sprites inside `DENSE_BUDGET_BYTES` minus that (missions without it: the full budget).
 */
export type MissionArtDef = Pick<MissionDef, 'artDensity' | 'preloadFirst' | 'preloadLast'> &
  Partial<Pick<MissionDef, 'id' | 'start' | 'sections' | 'bossSection'>> & {
    readonly extraChar?: readonly string[];
    readonly denseReserve?: number;
    /**
     * OPT-IN (revision R, mission `ring`): `denseReserve` per section id (the drive's stretches have
     * the ring's streamed scenery, the foot sections their SectionView's); a section without an
     * entry uses `denseReserve`. Missions without it: unchanged.
     */
    readonly sectionReserve?: Readonly<Record<string, number>>;
  };

type ArtApp = Pick<GameApp, 'preloadArt' | 'session'> & { readonly artCache?: GameApp['artCache'] };

/**
 * Bytes of 4× frames the tier-4 working set keeps resident (plan: 256 MB). Over it, the 4× ids
 * outside the current set are released, least recently used first (the chosen heroes never are).
 */
export const DENSE_BUDGET_BYTES = 256 * 1024 * 1024;
/** How often (ms) the tier-4 pump hands the 4× ids drawn without frames to the pool. */
export const DENSE_PUMP_MS = 250;

let denseBudget = DENSE_BUDGET_BYTES;
let poolFactory: () => ArtPool = () => browserArtPool(undefined, { fallbackBudgetMs: MISSION_ART_BUDGET_MS });
let pool: ArtPool | null = null;

/** The art pool of the mission preloads (created on first use: browser workers, or main thread). */
function missionPool(): ArtPool {
  return (pool ??= poolFactory());
}

/** The tier-4 working set of the running mission (one per play: a new play starts a new run). */
interface DenseRun {
  key: string;
  app: ArtApp;
  mission: MissionArtDef;
  /** Section ids in play order. */
  order: string[];
  /** `char/<id>/` of the chosen heroes (pinned: never released, never another hero at 4×). */
  heroes: string[];
  /** Joined players (the P2-only art joins the working set with two; `twoPlayer2x` with two). */
  players: number;
  /** Index (in `order`) of the section entered last. */
  index: number;
  /** The working set of that section (its ids are never released). */
  current: Set<string>;
  /** Section index of each 4× id's last use (built for, or drawn in, that section). */
  lastUse: Map<string, number>;
  inFlight: Set<string>;
  /**
   * Ids a pool build did not deliver at 4× (a broken 4× generator, or the main-thread fallback
   * without workers, which never generates 4× art): they keep their 2× frames and are not
   * queued again this run (no rebuild loop every DENSE_PUMP_MS).
   */
  unbuilt: Set<string>;
  /** Ids already in a section pack this run. */
  packed: Set<string>;
  timer: ReturnType<typeof setInterval> | null;
}

let dense: DenseRun | null = null;

/** Sprite id prefixes a section declares (`art` on its SectionDef, when present). */
function sectionArt(mission: MissionArtDef, section: string | undefined): readonly string[] {
  if (!section) return [];
  return mission.sections?.[section]?.art ?? [];
}

/**
 * The sections that can come after `section` (`at` in `order`): its exits' targets (a route
 * split such as ams c → c1 | c2 has two), else the next one in play order.
 */
export function nextSections(mission: MissionArtDef, order: readonly string[], section: string, at: number): string[] {
  const exits = mission.sections?.[section]?.exits ?? [];
  const to = [...new Set(exits.map((e) => e.to).filter((t) => !!mission.sections?.[t]))];
  if (to.length) return to;
  const next = order[at + 1];
  return next ? [next] : [];
}

/** Ids (4× generators only) under `prefixes`, ranked by the first prefix each matches. */
function idsUnder(prefixes: readonly string[], all: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of prefixes) {
    for (const id of all) {
      if (!seen.has(id) && id.startsWith(p)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

/** Sprite id prefixes only a second player uses (P2 rides the Mute Swan). */
const TWO_PLAYER_ART = ['vehicle/swan-mute'];

/**
 * The budget's cut for two players (tmp/uhd-budget.md, measured 2026-10-20): two different heroes
 * and the Mute Swan put every ams section over DENSE_BUDGET_BYTES (262-282 MB with every identical
 * strip shared), so with two players the fatbike youths (solo and pair sets, about 97 MB at 4×)
 * keep their 2× art at tier 4: left out of the set and never built when drawn. One player builds
 * them at 4×. (This replaces the earlier rare-strip cut, which kept no section under the budget.)
 */
const TWO_PLAYER_2X = ['enemy/fatbike-youth'];

/**
 * A hero's strips only the menus draw (the select portraits; the screens build them through the
 * screen art pool): never in the tier-4 working set (about 1 MB of 4× frames per hero).
 */
const SCREEN_ONLY = /^char\/[^/]+\/(select|portrait)/;

/**
 * The in-world continue's reaction strips (GDD §4.6: `gloat` while every player is out, `cower`
 * when the hero is back; a seated stag rider's `sit-gloat` / `sit-cower`): they show only around a continue, so they never join the tier-4 working set (the budget has no room for every
 * set's pair). Drawn at tier 4 they show their 2× art for a moment and are queued
 * (`pumpDenseQueue`): the pool builds the ones on screen.
 */
const ON_DEMAND_4X = /\/(sit-)?(gloat|cower)$/;

/** Does `id` keep its 2× art at tier 4 with `players` players (never a hero's)? */
export function twoPlayer2x(id: string, players: number): boolean {
  return players > 1 && TWO_PLAYER_2X.some((p) => id.startsWith(p));
}

/**
 * The tier-4 working set of section `index` in build order: the chosen heroes, the mission's
 * `preloadFirst`, the current and the next section's `art` (`next` may list every route of a
 * split; ahead only what its first screens show: not its `fx/`, its `boss/` (a mid-boss such as
 * the ams scan car fights well inside its section), its `artLate` nor its deferred rare strips), the boss
 * (`preloadLast`) at the end.
 * Only ids with a 4× generator; the other heroes never, nor the heroes' menu-only strips
 * (`SCREEN_ONLY`), nor the continue's reaction strips (`ON_DEMAND_4X`: built when drawn). To stay
 * inside DENSE_BUDGET_BYTES the
 * P2-only art joins only with two players, `twoPlayer2x` ids only with one, and the `boss/`
 * prefixes only in the boss section (built on entry, long before the fight; a 4× id drawn outside
 * its set shows its 2× art and is queued). On entry the ids outside the new set are released
 * first (oldest first) as far as the budget needs room for the ids still to build.
 * A 4× alias (sprites.ts `defineDenseAlias`) stands for its target: the set holds the target,
 * once, at the alias's place when that comes first.
 */
export function denseWorkingSet(
  mission: MissionArtDef,
  heroes: readonly string[],
  section: string | undefined,
  next: string | readonly string[] | undefined,
  players: number,
): string[] {
  const extra = mission.extraChar ?? [];
  const all = listHiSprites(4).filter(
    (id) =>
      (!id.startsWith('char/') || (heroes.some((h) => id.startsWith(h)) && !SCREEN_ONLY.test(id)) || extra.some((p) => id.startsWith(p))) &&
      (players > 1 || !TWO_PLAYER_ART.some((p) => id.startsWith(p))) &&
      !twoPlayer2x(id, players) &&
      !ON_DEMAND_4X.test(id),
  );
  const boss = mission.bossSection;
  const last = (mission.preloadLast ?? []).filter((p) => !boss || section === boss || !p.startsWith('boss/'));
  // The next section's effects, mid-boss and rare strips are not built ahead (they show in play,
  // not on its first screen; they join when that section is entered).
  // Nor what the next section shows only well into it (`SectionDef.artLate`).
  const nexts = typeof next === 'string' ? [next] : (next ?? []);
  const here = idsUnder([...heroes, ...extra, ...(mission.preloadFirst ?? []), ...sectionArt(mission, section)], all);
  const inHere = new Set(here);
  const aheadIds: string[] = [];
  for (const n of nexts) {
    const late = mission.sections?.[n]?.artLate ?? [];
    const ahead = sectionArt(mission, n).filter((p) => !p.startsWith('fx/') && !p.startsWith('boss/'));
    for (const id of idsUnder(ahead, all)) if (inHere.has(id) || (!isDeferredSprite(id) && !late.some((p) => id.startsWith(p)))) aheadIds.push(id);
  }
  const ids = [...here, ...aheadIds, ...idsUnder(last, all)];
  return [...new Set(ids.map((id) => denseTarget(id, 4)))];
}

/**
 * Bytes the 4× frames of `ids` will take, from their 1× frames (a dense frame has its 1× frame's
 * logical size: 16 × the 1× pixels at 4×), else from their 2× frames (4 × their pixels); ids with
 * 4× frames, or with neither yet, count 0. Never generates.
 */
export function denseEstimate(ids: Iterable<string>): number {
  let px = 0;
  const seen = new Set<object>();
  for (const id of ids) {
    if (hasFramesAt(id, 4)) continue;
    const one = readyFrames(id, 1);
    const frames = one ?? readyFrames(id, 2) ?? [];
    const k = one ? 16 : 4;
    for (const f of frames) {
      if (seen.has(f.buf)) continue;
      seen.add(f.buf);
      px += f.buf.w * f.buf.h * k;
    }
  }
  return px * 4;
}

const isHero = (run: DenseRun, id: string): boolean => run.heroes.some((h) => id.startsWith(h));

/** The run's sprite budget: the dense budget minus the mission's own reserve (`denseReserve`). */
function runBudget(run: DenseRun): number {
  const per = run.mission.sectionReserve;
  const own = per ? per[run.order[run.index] ?? ''] : undefined;
  return denseBudget - (own ?? run.mission.denseReserve ?? 0);
}

/**
 * Release 4× ids outside the current set (least recently used first, never the heroes) until the
 * resident 4× frames fit `budget`. Returns the bytes freed.
 */
function trimDense(run: DenseRun, budget = runBudget(run)): number {
  let over = denseBytes(4) - budget;
  if (over <= 0) return 0;
  const out = [...run.lastUse].filter(([id]) => !run.current.has(id) && !isHero(run, id));
  out.sort((a, b) => a[1] - b[1]);
  let freed = 0;
  for (const [id] of out) {
    if (over <= 0) break;
    const n = releaseDense([id], 4);
    run.lastUse.delete(id);
    freed += n;
    over -= n;
  }
  return freed;
}

/**
 * Build `ids` at 4× through the pool (those not built or in flight; `at` is their section
 * index), then trim to the budget (also when everything was built or restored already).
 */
async function buildDense(run: DenseRun, ids: readonly string[], at: number): Promise<void> {
  const todo = ids.filter((id) => !hasFramesAt(id, 4) && !run.inFlight.has(id) && !run.unbuilt.has(id));
  for (const id of ids) run.lastUse.set(id, Math.max(run.lastUse.get(id) ?? at, at));
  if (todo.length > 0) {
    for (const id of todo) run.inFlight.add(id);
    try {
      await missionPool().build(todo, 4);
    } catch (err) {
      // A failed build leaves the 2× stand-ins; the ids may be queued and tried again.
      console.warn('[art-pool] 4× build failed', err);
    } finally {
      for (const id of todo) {
        run.inFlight.delete(id);
        if (!hasFramesAt(id, 4)) run.unbuilt.add(id);
      }
    }
  }
  if (dense === run) {
    trimDense(run);
    return;
  }
  // A build that came back after the run stopped (the tier fell, the play ended): drop what the
  // running set (if any) does not hold or build.
  const cur = dense;
  releaseDense(todo.filter((id) => !id.startsWith('fps/') && !(cur && (cur.current.has(id) || cur.inFlight.has(id) || isHero(cur, id)))), 4);
}

/**
 * Hand the 4× ids drawn without frames (sprites.ts `takeDenseQueue`) to the pool (not the
 * `twoPlayer2x` ids of two players). Below tier 4 (the governor, ART DETAIL) the run stops.
 */
export function pumpDenseQueue(): number {
  const run = dense;
  if (run && artTier() < 4) {
    stopDense();
    return 0;
  }
  const ids = takeDenseQueue();
  if (!run) return 0;
  const todo = ids.filter((id) => hasHiSprite(id, 4) && !twoPlayer2x(id, run.players));
  // Drawn now: they belong to the current set until the next section.
  for (const id of todo) run.current.add(id);
  if (todo.length) void buildDense(run, todo, run.index);
  return todo.length;
}

/**
 * Enter section `section` of the tier-4 run: release the ids outside its working set as far as
 * the budget needs room for the ids still to build, restore its 4× packs, build the rest, trim,
 * save the packs.
 */
async function enterDenseSection(run: DenseRun, section: string): Promise<void> {
  const i = run.order.indexOf(section);
  const at = i < 0 ? 0 : i;
  run.index = at;
  const next = nextSections(run.mission, run.order, section, at);
  const set = denseWorkingSet(run.mission, run.heroes, section, next, run.players);
  run.current = new Set(set);
  for (const id of set) run.lastUse.set(id, at);
  // Room first: the section behind goes before the new one is built (no peak over the budget).
  trimDense(run, runBudget(run) - denseEstimate(set));
  const inSet = run.current;
  const cache = run.app.artCache;
  if (cache) {
    for (const h of run.heroes) await cache.restore(`hd4-char-${h.split('/')[1]}`, (id) => id.startsWith(h));
    for (const s of [section, next]) if (s) await cache.restore(`hd4-${s}`, (id) => inSet.has(id));
  }
  // A newer section (or run) took over while the packs loaded.
  if (dense !== run || run.index !== at) return;
  await buildDense(run, set, at);
  if (!cache || dense !== run) return;
  for (const h of run.heroes) void cache.save(`hd4-char-${h.split('/')[1]}`, (id) => id.startsWith(h));
  const own = set.filter((id) => !run.packed.has(id) && !isHero(run, id));
  for (const id of own) run.packed.add(id);
  const ownSet = new Set(own);
  void cache.save(`hd4-${section}`, (id) => ownSet.has(id));
}

/**
 * Tier 4: start (or keep) the working set of this mission and these heroes, from `section`.
 * The same play keeps its run (the intro card, then the gameplay start; a player who joins: the
 * set follows the new heroes and players). A new play (another mission, or a section before the
 * run's) stops the old run first, which releases its 4× frames. Turns on `setDeferDense`: the
 * main thread never generates 4× art during play.
 */
function startDense(app: ArtApp, mission: MissionArtDef, session: Pick<GameSession, 'slots'> | null, section: string | undefined): void {
  const joined = (session?.slots ?? []).filter((s) => s.joined);
  const heroes = [...new Set(joined.map((s) => `char/${s.character}/`))];
  const players = joined.length;
  const key = `${mission.id ?? '?'}|${heroes.join(',')}|${players}`;
  setDeferDense(true);
  const order = Object.keys(mission.sections ?? {});
  const sec = section ?? mission.start ?? order[0] ?? '';
  const at = Math.max(0, order.indexOf(sec));
  let run = dense;
  if (run && (run.mission.id !== mission.id || at < run.index)) {
    stopDense();
    run = null;
  }
  if (run) {
    run.key = key;
    run.app = app;
    run.heroes = heroes;
    run.players = players;
  } else {
    run = { key, app, mission, order, heroes, players, index: at, current: new Set(), lastUse: new Map(), inFlight: new Set(), unbuilt: new Set(), packed: new Set(), timer: null };
    if (app.preloadArt && typeof setInterval === 'function') run.timer = setInterval(pumpDenseQueue, DENSE_PUMP_MS);
    dense = run;
  }
  void enterDenseSection(run, sec);
}

/**
 * Stop the tier-4 working set: the play ended (gameplay exits) or the art tier fell below 4 (the
 * governor, ART DETAIL). No more 4× builds; the queue is dropped and every 4× frame but the fps
 * art's is released (the bytes freed are returned; nothing draws them any more). `missionId`
 * (optional): only when the run is that mission's.
 */
export function stopDense(missionId?: string): number {
  const run = dense;
  if (!run || (missionId !== undefined && run.mission.id !== missionId)) return 0;
  if (run.timer) clearInterval(run.timer);
  dense = null;
  takeDenseQueue();
  return releaseDense(generatedSprites(4).filter((id) => !id.startsWith('fps/')), 4);
}

/** Is a tier-4 working set running (tests, tools)? */
export function denseRunning(): boolean {
  return dense !== null;
}

/**
 * A section of the running mission loaded (gameplay's `sectionLoaded`): at tier 4 the working
 * set moves on (restore / build the new section's 4× ids; release the ones outside it within
 * DENSE_BUDGET_BYTES). Nothing below tier 4.
 */
export function missionArtSection(section: string): void {
  if (dense && artTier() >= 4) void enterDenseSection(dense, section);
}

/**
 * Start generating the dense sprites (docs/ARCHITECTURE.md §3) in the background when a mission
 * draws dense art (`density` ≥ 2, default the mission's `artDensity`): boot only makes the 1×
 * frames, so without this the first seconds of the mission would generate frames lazily while
 * drawing. The ART POOL (src/engine/art-pool.ts) builds them in workers, in `missionArtOrder`
 * (the players' characters, then what the first section shows; the boss last), and this thread
 * only installs them; without workers the pool falls back to today's budgeted main-thread
 * preload (MISSION_ART_BUDGET_MS per frame). The mission intro card starts it; gameplay calls it
 * again for a direct start (`?mission=`), when a player joins and when the art tier rises to 4.
 * Only the browser app asks for it (`app.preloadArt`): headless runs (sims, tests, shots)
 * generate dense frames lazily, if they draw at all.
 *
 * - Tier 2 (`artTier()` < 4): the whole 2× set, once; then the sprite cache saves pack 'hi'.
 *   The first bucket of `missionArtOrder` goes to the pool first, the rest at low priority.
 * - Tier 4: the 2× set as above (the stand-in of every 4× frame not built yet), and the tier-4
 *   WORKING SET (`denseWorkingSet`) at 4× with `setDeferDense(true)`, so the main thread never
 *   generates 4× art; the working set goes ahead of the low-priority rest of the 2× set; 4× ids
 *   drawn without frames are queued and pumped to the pool; a section change
 *   (`missionArtSection`) moves the set on and releases the ids outside it within
 *   DENSE_BUDGET_BYTES; the play's end (`stopDense`) releases the run. 4× packs ('hd4-<section>',
 *   'hd4-char-<hero>') are restored and saved here.
 *
 * It also switches on `setDeferHiArt`: the 2× scenery (background layers, terrain chunks) of each
 * section becomes art jobs the section view runs within the same budget per frame (the pool's
 * main-thread fallback runs them first in its slices), so a section start never stalls.
 * Returns true when the preload runs (started now or before).
 */
export function preloadMissionArt(
  app: ArtApp,
  mission: MissionArtDef | undefined,
  density = mission?.artDensity ?? 1,
  session: Pick<GameSession, 'slots'> | null = app.session,
  section?: string,
): boolean {
  // The density checks: the mission's highest density, capped by the art tier (tier 1: nothing).
  const tier = Math.min(toArtDensity(density), artTier());
  if (tier < 2 || !app.preloadArt) return hiPreload !== null;
  // The 2× scenery of the sections becomes art jobs in the same budget (never a stalled frame).
  setDeferHiArt(true);
  if (!hiPreload) {
    const { first, last } = missionArtOrder(mission, session, section ?? mission?.start);
    // Ids the boot installed from pack 'hi' are not built again.
    const ids = preloadOrder(listHiSprites(2).filter((id) => !hasFramesAt(id, 2)), first, last);
    const head = ids.filter((id) => first.some((p) => id.startsWith(p)));
    const headSet = new Set(head);
    const p = missionPool();
    hiPreload = Promise.all([p.build(head, 2), p.build(ids.filter((id) => !headSet.has(id)), 2, undefined, { low: true })]).then(() =>
      app.artCache?.save('hi', ['']),
    );
  }
  if (tier >= 4 && mission) startDense(app, mission, session, section);
  return true;
}

/** Tests: forget the preloads and the working set; `factory` makes the next pool (null: browser). */
export function resetMissionArt(factory: (() => ArtPool) | null = null, budget = DENSE_BUDGET_BYTES): void {
  if (dense?.timer) clearInterval(dense.timer);
  dense = null;
  hiPreload = null;
  pool?.close();
  pool = null;
  poolFactory = factory ?? (() => browserArtPool(undefined, { fallbackBudgetMs: MISSION_ART_BUDGET_MS }));
  denseBudget = budget;
}

/**
 * Start fetching and decoding a mission's sample group (`MissionDef.audioGroup`) in the
 * background, fire-and-forget. Returns the group name, or null when there is nothing to load.
 * Until it is ready the synth plays.
 */
export function preloadMissionAudio(app: Pick<GameApp, 'audio'>, mission: Pick<MissionDef, 'audioGroup'> | undefined): string | null {
  const group = mission?.audioGroup;
  if (!group || !app.audio.loadSamples) return null;
  void app.audio.loadSamples(group);
  return group;
}

/** Has the background 2× preload started (tests)? */
export function missionArtPreloadStarted(): boolean {
  return hiPreload !== null;
}

/** The mission a new game starts with: the Amsterdam prologue `ams`, else m1. */
export function firstMission(): string {
  if (hasMission('ams')) return 'ams';
  if (hasMission('m1')) return 'm1';
  const ids = listMissions();
  return ids.find((id) => id !== 'm0') ?? ids[0] ?? 'm0';
}

/** A new session for the options: difficulty, credits (CREDITS option), characters. */
export function newSession(app: GameApp, characters: readonly string[], difficulty?: Difficulty): GameSession {
  return new GameSession({
    difficulty: difficulty ?? app.params.difficulty ?? app.settings.difficulty,
    characters,
    credits: creditsOf(app.settings.credits),
    seed: app.params.seed ?? 1,
  });
}

/**
 * Start a fresh game (new session) straight into a mission, skipping the menus and the intro
 * card (URL `?mission=`, tools, tests). The menus use `startCampaign` (flow.ts).
 */
export function startNewGame(app: GameApp, o: NewGameOpts = {}): void {
  const players = o.players ?? app.params.players;
  const char = app.params.char ?? 'recruit';
  const characters = o.characters ?? (players === 2 ? [char, char] : [char]);
  app.input.players = players;
  app.session = newSession(app, characters, o.difficulty);
  app.campaign = newCampaign();
  const scene = new GameplayScene(app, { mission: o.mission ?? firstMission(), section: o.section, bossRush: o.bossRush });
  app.scenes.reset(scene, { fade: 30 });
}

/** The attract-mode demo (GDD §13.3). */
export interface DemoOpts {
  /** The autopilot driving player 1 (the sim bot), added to the input while the demo runs. */
  bot: InputSource | null;
  /** Demo length in ticks (1200). */
  ticks: number;
  /** Called once when the demo ends: time up, the player is out, or any real key / click. */
  onEnd: (byKey: boolean) => void;
}

/**
 * OPT-IN (revision R, docs/design/ring.md §R.10): a level that another scene hands over to this one
 * without a tally (the ring's drive → its on-foot part). `def` is the (unregistered) MissionDef to
 * run (`mission` is then only its id); the runner continues the session's mission
 * (`RunnerOptions.continueMission`: the per-mission stats, lives, score and weapons stay); `artDef`
 * is the tier-4 art definition of the whole level (one run across the hand-over); `onComplete`
 * replaces the tally hand-off at the end.
 */
export interface GameplayHandover {
  readonly def: MissionDef;
  readonly artDef: MissionArtDef;
  onComplete(runner: MissionRunner, scene: GameplayScene): void;
}

export interface GameplayOpts {
  mission: string;
  section?: string;
  bossRush?: boolean;
  /** Use this session instead of `app.session` (the attract demo). */
  session?: GameSession;
  demo?: DemoOpts;
  /** OPT-IN (revision R): see `GameplayHandover`; absent = nothing changes. */
  handover?: GameplayHandover;
}

/** The start banner of a mission with a card lasts 120 ticks (GDD §13.6). */
const START_BANNER_TICKS = 120;

/** A shallow copy of the MissionDef with the card's banner, announcer line and clear line as defaults. */
function withCard(id: string): MissionDef | string {
  const def = getMission(id);
  if (!def || !hasMissionCard(id)) return id;
  const card = missionCard(id);
  return {
    ...def,
    startBanner: def.startBanner ?? { text: card.label, sub: card.startSub ?? 'START!' },
    announce: def.announce ?? card.announce,
    clearLine: def.clearLine ?? VOICE.missionComplete,
  };
}

export class GameplayScene implements Scene, PauseHost, PlayHost {
  readonly app: GameApp;
  readonly opts: GameplayOpts;
  runner!: MissionRunner;
  private t = 0;
  private weaponCycle = 0;
  private demoEnded = false;
  /** A scene on top silenced the loops (pause / resume). */
  private loopsPaused = false;
  /** The art tier this scene's preload last saw (a change to or from 4 starts or stops the tier-4 working set). */
  private tierSeen = 0;
  private removeBot: (() => void) | null = null;
  /** Pad rumble on deaths, big blasts, boss part breaks and vehicle hits (not in the demo). */
  private rumble: RumbleWatch | null = null;
  /** Joins, pad claims, the pause, the lost-pad pause and the key-split notice (play-host.ts). */
  private readonly controls = new PlayControls(this);

  constructor(app: GameApp, opts: GameplayOpts) {
    this.app = app;
    this.opts = opts;
  }

  get session(): GameSession {
    if (this.opts.session) return this.opts.session;
    if (!this.app.session) this.app.session = new GameSession({ seed: this.app.params.seed ?? 1 });
    return this.app.session;
  }

  /** True while this scene plays the attract demo. */
  get demo(): boolean {
    return this.opts.demo !== undefined;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    // A free pad's START asks to join (GDD §4.9) instead of pausing player 1.
    app.input.joinWatch = !this.demo;
    if (!this.demo) this.rumble = new RumbleWatch(app.input, () => app.settings);
    app.audio.duckMusic?.(1);
    app.focusLost = false;
    app.pointerPressed = false;
    const demo = this.opts.demo;
    const handover = this.opts.handover;
    const runner = new MissionRunner({
      session: this.session,
      mission: handover ? handover.def : withCard(this.opts.mission),
      // Revision R (opt-in): the hand-over continues the level's mission (no reset, no banner).
      ...(handover ? { continueMission: true } : {}),
      section: this.opts.section,
      pads: [app.input.pad(0), app.input.pad(1)],
      // The demo plays silently under the title song.
      audio: demo ? new NullAudio() : app.audio,
      seed: app.params.seed ?? this.session.seed,
      bossRush: this.opts.bossRush,
      settings: app.settings,
      // The attract demo keeps the 1× art: no 2× generation behind the title screen.
      artDensity: demo ? 1 : undefined,
    });
    this.runner = runner;
    this.tierSeen = artTier();
    if (!demo) {
      preloadMissionArt(app, this.artDef, runner.artDensity, this.session, handover ? (this.opts.section ?? handover.def.start) : this.session.sectionId || undefined);
      // A direct start (?mission=, a continue, the next mission): the intro card did not run.
      preloadMissionAudio(app, runner.mission);
    }
    runner.events.on('complete', () => {
      if (this.demo) this.endDemo(false);
      else if (handover) handover.onComplete(runner, this);
      // ams → the glitch bridge into the first-person mode (docs/design/fps.md §1.1): no tally page.
      else if (runner.mission.after === 'fps') app.scenes.replace(new GlitchBridgeScene(app, { from: this, runner }), { fade: 0 });
      else app.scenes.replace(new MissionCompleteScene(app, runner), { fade: 40 });
    });
    // The in-world continue (GDD §4.6): the countdown runs over the live world (runner + HUD);
    // no menu opens. Every player out: the announcer asks, stale banners and the GO arrow go.
    runner.events.on('allOut', () => {
      if (this.demo) return;
      app.audio.voice(VOICE.continue);
      runner.hud.clearBanner();
      runner.hud.hideGo();
    });
    runner.events.on('gameOver', () => {
      if (this.demo) this.endDemo(false);
      else app.scenes.push(new GameOverScene(app));
    });
    // TIME UP! is an announcer line too (GDD §12.3).
    runner.events.on('sectionLoaded', ({ id }) => {
      // Tier 4: the 4× working set moves on with the sections (preloadMissionArt).
      if (!this.demo) missionArtSection(id);
      this.rumble?.attach(runner.world, runner);
      runner.world.events.on('timeOut', () => {
        if (!this.demo) app.audio.voice('TIME UP!');
      });
    });
    runner.start();
    // A mission card's start banner shows for 120 ticks (the runner's default is longer).
    const b = runner.hud.banner;
    if (b && b.style === 'mission' && hasMissionCard(this.opts.mission) && !getMission(this.opts.mission)?.startBanner) b.ticks = b.total = START_BANNER_TICKS;
    if (demo) {
      runner.hud.clearBanner();
      if (demo.bot) this.removeBot = app.input.addSource(demo.bot);
    }
    const weapon = app.params.weapon;
    if (weapon && !demo) for (const p of runner.players) p.giveWeapon(weapon, undefined, false);
    app.debug.on('skip', () => runner.skip());
    app.debug.on('weapons', () => this.cycleWeapons());
  }

  exit(): void {
    this.app.input.joinWatch = false;
    // The play is over (QUIT, game over, the mission's end): its tier-4 working set and 4× frames go.
    if (!this.demo) stopDense(this.runner?.mission.id);
    this.app.debug.on('skip', () => {});
    this.app.debug.on('weapons', () => {});
    this.removeBot?.();
    this.removeBot = null;
    // Leaving gameplay (pause QUIT, game over, mission end): the ambience, the Swan's engine and
    // the other loops stop (at once when they were paused under a menu), and the loop bus
    // comes back up for the next screens.
    if (this.runner) this.runner.stopLoops(this.loopsPaused ? 0 : 30);
    if (this.loopsPaused) this.app.audio.resumeLoops?.();
    this.loopsPaused = false;
  }

  /**
   * A scene opened on top (pause menu, GAME OVER): the music plays on at half level
   * (GDD §13.8) and the looping sounds (ambience, engines) fall silent until the game resumes.
   */
  pause(): void {
    this.app.input.joinWatch = false;
    this.app.audio.duckMusic?.(0.5);
    this.app.audio.pauseLoops?.();
    this.loopsPaused = true;
  }

  resume(): void {
    this.app.input.joinWatch = !this.demo;
    this.app.audio.duckMusic?.(1);
    this.app.audio.resumeLoops?.();
    this.loopsPaused = false;
    // Only the action buttons: a direction held through the pause keeps moving the player.
    this.app.input.suppress(ACTION_BUTTONS);
  }

  /** OPTIONS changed a setting while paused (PauseHost): the camera shake. */
  applySettings(s: GameSettings): void {
    const cam = this.runner.world.camera;
    cam.shakeScale = s.screenShake === 'off' ? 0 : s.screenShake === 'low' ? 0.5 : 1;
  }

  update(): void {
    this.t++;
    const app = this.app;
    const runner = this.runner;
    // The device of the last press in play, before this tick's presses (the join rule asks it).
    this.controls.trackDevice();
    if (this.demo) {
      this.updateDemo();
      if (this.demoEnded) return;
    } else if (runner.state === 'playing' && !app.scenes.busy) {
      // The lost-pad pause, joins and pad claims, the pause (play-host.ts).
      if (this.controls.interrupt()) return;
    }
    this.controls.watchKeySplit();
    app.debug.apply(runner.world);
    if (this.demo) runner.world.god = true;
    runner.update();
    this.rumble?.tick(runner.world);
    const cam = runner.world.camera;
    runner.hud.trackCamera(cam.x, cam.y);
  }

  /** The demo ends after its ticks, or at once on any real key, pad button or click. */
  private updateDemo(): void {
    const demo = this.opts.demo;
    if (!demo || this.demoEnded) return;
    const app = this.app;
    const byKey = app.input.rawPressed.length > 0 || app.pointerPressed;
    app.pointerPressed = false;
    if (byKey || this.t >= demo.ticks) this.endDemo(byKey);
  }

  private endDemo(byKey: boolean): void {
    if (this.demoEnded) return;
    this.demoEnded = true;
    this.removeBot?.();
    this.removeBot = null;
    this.opts.demo?.onEnd(byKey);
  }

  /** Debug F5: give the next registered player weapon with full ammo, and 99 bombs. */
  private cycleWeapons(): void {
    const ids = listWeapons((w) => (w.kind ?? 'gun') === 'gun');
    if (ids.length === 0) return;
    const id = ids[this.weaponCycle++ % ids.length];
    for (const p of this.runner.players) {
      p.giveWeapon(id, getWeapon(id).maxAmmo ?? TUNING.weapons.maxAmmo);
      p.addBombs(TUNING.grenade.cap);
    }
  }

  /** The mission preload for the section being played (after a join, or a rise to tier 4). */
  preloadArtNow(): void {
    const runner = this.runner;
    if (this.demo || !runner) return;
    preloadMissionArt(this.app, this.artDef, runner.artDensity, this.session, runner.section?.id);
  }

  /** The tier-4 art definition: the hand-over's (revision R), else the mission's. */
  private get artDef(): MissionArtDef {
    return this.opts.handover?.artDef ?? this.runner.mission;
  }

  /**
   * The art tier changed during the play (main.ts: the governor, ART DETAIL, a resize): a rise to
   * 4 starts the tier-4 working set now (not at the next mission start), a fall below 4 stops it
   * and releases its 4× frames (nothing draws them any more).
   */
  private syncArtTier(): void {
    const t = artTier();
    if (t === this.tierSeen || this.demo) return;
    const was = this.tierSeen;
    this.tierSeen = t;
    if (t >= 4) this.preloadArtNow();
    else if (was >= 4) stopDense(this.runner.mission.id);
  }

  draw(r: Renderer): void {
    const runner = this.runner;
    this.syncArtTier();
    r.begin(runner.sky);
    runner.draw(r);
    // The HUD draws with the mission's art density too (2× icons where they exist).
    withArtDensity(runner.artDensity, () =>
      drawHud(r, {
        session: this.session,
        hud: runner.hud,
        runner,
        inputPlayers: this.app.input.players,
        joinOpen: this.controls.joinOpen(),
        ticks: this.t,
        settings: this.app.settings,
      }),
    );
    if (this.demo && blinkOn(this.t)) centerText(r, 'DEMO PLAY', 40, UI_WHITE, 'big');
    if (!this.demo) this.app.debug.draw(r, runner.world);
  }
}
