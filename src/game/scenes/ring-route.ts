/**
 * The ring's place in the flow (docs/design/ring.md §1, §13.1; docs/api/ring.md "Flow"):
 *
 * `ams` → its tally (MissionCompleteScene) → `missionDone` → MissionIntroScene('ring') (the card:
 * `prepareRing` makes the seed and the plan, `preloadRing` starts the art and the audio) →
 * `RingScene` → 'complete' → `ringDone` → the ring's MISSION COMPLETE page (`ringTally`: hostages,
 * fines, the seed in the footer) → GlitchBridgeScene (it freezes the page) → the fps floors → the
 * ending. `?mission=ring` (boot, tools) → `startRing` (no card).
 *
 * `ring` is NOT a registered mission (spec §13): the flow knows its id (`RING_ID`).
 *
 * REVISION R (docs/design/ring.md §R.1, §R.10): the short route's drive ends in the final jam and
 * the alight scene; the RingRunner's 'handover' → `ringHandover`: a `GameplayScene` with the
 * UNREGISTERED foot MissionDef (content/ring/foot/, id `ring`; `GameplayOpts.handover`), the same
 * session (lives, score, bombs, weapon, the per-mission stats: `RunnerOptions.continueMission`), one
 * tier-4 run (`ringArtDef` holds the foot sections too; the RingScene skips `stopDense`); its
 * `missionComplete` → ONE tally (`ringFinalTally`: the hostages of both parts, FINES, the seed) →
 * the glitch bridge. URLs: `?mission=ring` (the whole level), `&section=amstel|zuid` (the drive from
 * there), `&section=zwaan` or `&boss=1` (a run-in to the truck), `&section=rf-a|rf-b` (on foot;
 * `rf-b&boss=1` reserved for the boat), `&route=full` (the old loop; an unused landmark in
 * `section` implies it).
 *
 * Seeds (spec §4, §13): every play gets a fresh seed (`freshSeed`, ring/mission.ts); `?seed=` /
 * a tool's `--seed` wins (`app.params.seed`). The seed shows in the debug overlay (RingScene) and
 * the footer of the ring's tally page.
 */
import { defineSampleGroup } from '../../engine/audio';
import { preloadSprites } from '../../engine/sprites';
import { SAMPLE_MANIFEST } from '../content/samples/manifest';
import { newCampaign, type GameApp } from '../app';
import { hasCharacter } from '../registry';
import type { MissionRunner } from '../mission/runner';
import { ringArtDef, type RingArtDef } from '../ring/art-def';
import { RING_DEFAULT_ROUTE, RING_FOOT_SECTIONS, RING_ID, RING_ROUTES, RING_SECTION_ZWAAN, type RingRoute } from '../ring/ids';
import { ringSeed } from '../ring/mission';
import { planRing } from '../ring/plan';
import { ringFootDefOf } from '../ring/hooks';
import { ringStartDist, type RingRunner } from '../ring/runner';
import { RING, type RingPlan } from '../ring/types';
import type { Difficulty, GameSession } from '../session';
import { GameplayScene, newSession, preloadMissionArt, preloadMissionAudio } from './gameplay';
import { GlitchBridgeScene, type BridgeRunner } from './glitch-bridge';
import { MissionCompleteScene, type NextRunner } from './mission-complete';
import { RingScene } from './ring';
import type { Scene } from '../../engine/scene';

export { RING_ID };

/**
 * The ring's sampled audio group: the ams group's sound effects and voices WITHOUT its two songs
 * (the ring plays its own synth songs, content/music/ring.ts; the ams songs decode to about 60 MB).
 * The entries are the ams group's own definitions, so the sample bank decodes each file once for
 * both groups (samples.browser.ts shares an entry whose `def` is the same object).
 */
export const RING_AUDIO_GROUP = 'mission:ring';
/** The ams group: RingScene releases it (its songs) once the ring's group is on its way. */
export const AMS_AUDIO_GROUP = 'mission:ams';
const AMS_SAMPLES = SAMPLE_MANIFEST[AMS_AUDIO_GROUP];
if (AMS_SAMPLES) defineSampleGroup(RING_AUDIO_GROUP, { sfx: AMS_SAMPLES.sfx, voice: AMS_SAMPLES.voice });

/**
 * What the ring draws at 1× (the boot preloads it for `?mission=ring`; on the normal route the
 * intro card builds it in the background): the ring's own art, the landmark decor, items, weapons,
 * effects and the ring bosses. The drivers' strips are the select roster's (bootArt adds it).
 * Revision R: the on-foot part's art (`ring/foot/` is under `ring/`) and the placeholder foot
 * enemies (the jam boarders' handhaver). Wave B adds `npc/ring/` (the activists, the police) here
 * with its first sprites (fixer, 2026-10-22: the prefix had no sprites yet).
 */
export const RING_ART: readonly string[] = ['ring/', 'decor/ring/', 'item/', 'weapon/', 'fx/', 'boss/ring-', 'enemy/handhaver', 'enemy/boete-ticket'];

/** A ring play about to start: its seed, its plan and the landmark it starts at. */
export interface RingStart {
  readonly seed: number;
  readonly plan: RingPlan;
  /** `?section=<landmark>` or `zwaan` (a short run-in before it); undefined = the on-ramp. */
  readonly section?: string;
}

/** Is `section` one of the on-foot sections (`rf-a`, `rf-b`)? */
export function isFootSection(section: string | null | undefined): boolean {
  return !!section && (RING_FOOT_SECTIONS as readonly string[]).includes(section);
}

/**
 * The route of a start (revision R): `route` when given; else `full` for a landmark the short
 * route does not drive (`?section=west` …), else the default (`short`).
 */
export function ringRouteFor(section: string | null | undefined, route?: RingRoute | null): RingRoute {
  if (route === 'short' || route === 'full') return route;
  if (section && section !== RING_SECTION_ZWAAN && !isFootSection(section) && (RING_ROUTES.full as readonly string[]).includes(section) && !(RING_ROUTES.short as readonly string[]).includes(section)) return 'full';
  return RING_DEFAULT_ROUTE;
}

/** Is `id` the ring (the flow's dispatch)? */
export function isRing(id: string | null | undefined): boolean {
  return id === RING_ID;
}

/**
 * A new ring play: the seed (`o.seed`, else `?seed=`, else a fresh one) and its plan for the
 * session's difficulty. Pure apart from the fresh seed.
 */
export function prepareRing(
  app: Pick<GameApp, 'params' | 'session' | 'settings'>,
  o: { seed?: number | null; section?: string | null; route?: RingRoute | null } = {},
): RingStart {
  const seed = o.seed !== undefined && o.seed !== null ? o.seed >>> 0 : ringSeed(app.params.seed);
  const difficulty: Difficulty = app.session?.difficulty ?? app.params.difficulty ?? app.settings.difficulty;
  const section = o.section ?? undefined;
  const route = ringRouteFor(section, o.route);
  return { seed, plan: planRing(seed, difficulty, { route }), section: section || undefined };
}

/**
 * The drivers the runner gives the active slots at the start (RingRunner.driverFor: the first
 * plan driver nobody plays and the other slot does not drive): the intro card preloads their
 * strips before the runner exists.
 */
export function expectedDrivers(plan: RingPlan, session: Pick<GameSession, 'slots'> | null): [string | null, string | null] {
  const out: [string | null, string | null] = [null, null];
  if (!session) return out;
  const playing = session.slots.filter((s) => s.joined).map((s) => s.character);
  for (const slot of [0, 1] as const) {
    if (!session.slots[slot].active) continue;
    for (const id of plan.drivers) {
      if (playing.includes(id) || id === out[1 - slot] || !hasCharacter(id)) continue;
      out[slot] = id;
      break;
    }
  }
  return out;
}

/** The stretch a start begins in (the landmark's run-in may start in the stretch before it). */
export function startStretch(start: RingStart): string | undefined {
  const plan = start.plan;
  if (isFootSection(start.section)) return start.section;
  const d = ringStartDist(plan, start.section);
  let id = plan.stretches[0]?.id as string | undefined;
  for (const st of plan.stretches) if (d >= st.start) id = st.id;
  return id;
}

/** The ring's tier-4 art definition for a start (sections = stretches; the expected drivers). */
export function ringArtFor(start: RingStart, session: Pick<GameSession, 'slots'> | null): RingArtDef {
  return ringArtDef(start.plan, expectedDrivers(start.plan, session));
}

/**
 * The intro card's preload (browser only: `app.preloadArt`): the 2× set and, at tier 4, the
 * working set from the start stretch (`preloadMissionArt` with `ringArtDef`), the 1× ring art in
 * small slices (it is not in the boot's list on the normal route), the ring's sample group.
 */
export function preloadRing(app: GameApp, start: RingStart): void {
  const def = ringArtFor(start, app.session);
  preloadMissionArt(app, def, def.artDensity, app.session, startStretch(start));
  preloadMissionAudio(app, { audioGroup: RING_AUDIO_GROUP });
  if (app.preloadArt) void preloadSprites(RING_ART, undefined, { skipDeferred: true, timeBudgetMs: 4 });
}

export interface StartRingOpts {
  /** Start at this landmark, `zwaan` (the truck) or a foot section `rf-a` / `rf-b` (`?section=`). */
  section?: string;
  /** `?boss=1`: the drive starts at the truck (a run-in); with `rf-b` the boat (wave B). */
  boss?: boolean;
  /** `?route=full` (revision R; default: by the section, else short). */
  route?: RingRoute;
  players?: 1 | 2;
  /** Characters per player (default: ?char= or 'recruit'). */
  characters?: readonly string[];
  difficulty?: Difficulty;
  /** The ring's seed (default `?seed=`, else a fresh one). */
  seed?: number;
}

/**
 * `?mission=ring` (boot, tools, tests): a fresh session straight into the RingScene, skipping the
 * menus and the intro card (as `startNewGame` does for a registered mission).
 */
export function startRing(app: GameApp, o: StartRingOpts = {}): RingScene | GameplayScene {
  const players = o.players ?? app.params.players;
  const char = app.params.char ?? 'recruit';
  const characters = o.characters ?? (players === 2 ? [char, char] : [char]);
  app.input.players = players;
  app.session = newSession(app, characters, o.difficulty);
  app.campaign = newCampaign();
  // Revision R: straight onto the foot part (a fresh plan for the seed and the drive's hostages).
  if (isFootSection(o.section)) {
    const start = prepareRing(app, { seed: o.seed, route: 'short' });
    const foot = ringFootScene(app, start, null, { section: o.section, bossRush: o.boss });
    app.scenes.reset(foot, { fade: 30 });
    return foot;
  }
  const section = o.boss && !o.section ? RING_SECTION_ZWAAN : o.section;
  const scene = new RingScene(app, { section, seed: o.seed, route: o.route });
  app.scenes.reset(scene, { fade: 30 });
  return scene;
}

/**
 * What the ring's MISSION COMPLETE page reads (docs/design/ring.md §1, §10): the newspaper of the
 * other missions with the ring's hostages per stretch, a FINES info line (paid already during the
 * play: −500 each), the seed in the footer, and the glitch bridge after it (`tallied`: the page
 * paid, so the bridge does not; the floor-1 tally then has no MISSION 2 BONUS line).
 */
export function ringTally(runner: RingTallyRunner): NextRunner {
  return {
    session: runner.session,
    mission: runner.mission,
    nextMission: () => null,
    tallyNotes: (slot) => {
      const n = runner.finesBySlot[slot.index] ?? 0;
      return [{ label: `FINES ${n} X ${RING.finePoints}`, points: null, note: n > 0 ? `-${n * RING.finePoints}` : '0' }];
    },
    tallyFooter: `RING SEED ${runner.seed}`,
    afterTally: (app, page) => app.scenes.replace(new GlitchBridgeScene(app, { from: page, runner, tallied: true }), { fade: 0 }),
  };
}

/** What `ringTally` reads from the finished ring (a RingRunner). */
export interface RingTallyRunner extends BridgeRunner {
  readonly seed: number;
  readonly finesBySlot: readonly number[];
}

/**
 * The ring is over (its 'complete' after the victory drive): its own MISSION COMPLETE page (the
 * tally: hostages, fines, the bonus lines; the seed in the footer), then the glitch bridge (it
 * freezes the page, records the clear) and the first-person floors.
 */
export function ringDone(app: GameApp, _from: Scene, runner: RingTallyRunner): void {
  app.scenes.replace(new MissionCompleteScene(app, ringTally(runner)), { fade: 30 });
}

// =============================================================================================
// Revision R: the hand-over to the on-foot part and the one tally at the end
// =============================================================================================

/** What the drive hands to the foot part (the seed and the fines for the final tally). */
export interface RingDriveResult {
  readonly seed: number;
  readonly finesBySlot: readonly number[];
}

/**
 * The on-foot GameplayScene of a play (revision R): the foot def for the plan (the drive's hostages
 * too), the ring's tier-4 art definition (the stretches and the foot sections: one run), the same
 * session (`continueMission`), and its end → `ringFinalDone` (the one tally).
 */
export function ringFootScene(
  app: GameApp,
  start: Pick<RingStart, 'seed' | 'plan'>,
  drive: (RingDriveResult & { readonly drivers?: readonly (string | null)[] }) | null,
  o: { section?: string; bossRush?: boolean } = {},
): GameplayScene {
  const def = ringFootDefOf(start.plan);
  const drivers = drive?.drivers ?? expectedDrivers(start.plan, app.session);
  const artDef = ringArtDef(start.plan, drivers);
  const result: RingDriveResult = { seed: drive?.seed ?? start.seed, finesBySlot: [...(drive?.finesBySlot ?? [0, 0])] };
  return new GameplayScene(app, {
    mission: RING_ID,
    section: o.section,
    bossRush: o.bossRush,
    handover: { def, artDef, onComplete: (runner) => ringFinalDone(app, runner, result) },
  });
}

/**
 * The drive is over (the RingRunner's 'handover', after the alight scene): the foot part takes the
 * play with a 40-tick fade. The RingScene skips `stopDense` (one tier-4 run across the hand-over).
 */
export function ringHandover(app: GameApp, from: RingScene, runner: RingRunner): GameplayScene {
  from.handingOver = true;
  const next = ringFootScene(app, { seed: runner.seed, plan: runner.plan }, { seed: runner.seed, finesBySlot: runner.finesBySlot, drivers: runner.drivers });
  app.scenes.replace(next, { fade: 40 });
  return next;
}

/**
 * The ONE tally of the whole level (revision R): the foot runner's session and mission (the
 * hostages of the drive and of the foot sections), the drive's FINES, the seed in the footer; then
 * the glitch bridge (as `ringTally`).
 */
export function ringFinalTally(foot: Pick<MissionRunner, 'session' | 'mission' | 'artDensity' | 'hud'>, drive: RingDriveResult): NextRunner {
  const tr: RingTallyRunner = {
    session: foot.session,
    mission: foot.mission,
    artDensity: foot.artDensity,
    hud: foot.hud,
    seed: drive.seed,
    finesBySlot: drive.finesBySlot,
  };
  return ringTally(tr);
}

/** The foot part is complete: the level's MISSION COMPLETE page, then the glitch bridge. */
export function ringFinalDone(app: GameApp, foot: Pick<MissionRunner, 'session' | 'mission' | 'artDensity' | 'hud'>, drive: RingDriveResult): void {
  app.scenes.replace(new MissionCompleteScene(app, ringFinalTally(foot, drive)), { fade: 40 });
}
