/**
 * The ring's place in the flow (docs/design/ring.md §1, §13.1; docs/api/ring.md "Flow"):
 *
 * `ams` → its tally (MissionCompleteScene) → `missionDone` → MissionIntroScene('ring') (the card:
 * `prepareRing` makes the seed and the plan, `preloadRing` starts the art and the audio) →
 * `RingScene` → 'complete' → `ringDone` → GlitchBridgeScene (the ring's silent tally, its seed) →
 * the fps floors → the ending. `?mission=ring` (boot, tools) → `startRing` (no card).
 *
 * `ring` is NOT a registered mission (spec §13): the flow knows its id (`RING_ID`).
 *
 * Seeds (spec §4, §13): every play gets a fresh seed (`freshSeed`, ring/mission.ts); `?seed=` /
 * a tool's `--seed` wins (`app.params.seed`). The seed shows in the debug overlay (RingScene) and
 * the floor-1 tally's footer (fps-tally.ts).
 */
import { preloadSprites } from '../../engine/sprites';
import { newCampaign, type GameApp } from '../app';
import { hasCharacter } from '../registry';
import { ringArtDef, type RingArtDef } from '../ring/art-def';
import { RING_ID } from '../ring/ids';
import { ringSeed } from '../ring/mission';
import { planRing } from '../ring/plan';
import { RING, type RingPlan } from '../ring/types';
import type { Difficulty, GameSession } from '../session';
import { newSession, preloadMissionArt, preloadMissionAudio } from './gameplay';
import { GlitchBridgeScene, type BridgeRunner } from './glitch-bridge';
import { RingScene } from './ring';
import type { Scene } from '../../engine/scene';

export { RING_ID };

/**
 * The ring's sampled audio group: it reuses the ams group (its songs fall back to the ams songs
 * until the ring theme exists, ring/mission.ts `ringSong`; wave B writes synth recipes only).
 */
export const RING_AUDIO_GROUP = 'mission:ams';

/**
 * What the ring draws at 1× (the boot preloads it for `?mission=ring`; on the normal route the
 * intro card builds it in the background): the ring's own art, the landmark decor, items, weapons,
 * effects and the ring bosses. The drivers' strips are the select roster's (bootArt adds it).
 */
export const RING_ART: readonly string[] = ['ring/', 'decor/ring/', 'item/', 'weapon/', 'fx/', 'boss/ring-'];

/** A ring play about to start: its seed, its plan and the landmark it starts at. */
export interface RingStart {
  readonly seed: number;
  readonly plan: RingPlan;
  /** `?section=<landmark>` (a short run-in before it); undefined = the on-ramp. */
  readonly section?: string;
}

/** Is `id` the ring (the flow's dispatch)? */
export function isRing(id: string | null | undefined): boolean {
  return id === RING_ID;
}

/**
 * A new ring play: the seed (`o.seed`, else `?seed=`, else a fresh one) and its plan for the
 * session's difficulty. Pure apart from the fresh seed.
 */
export function prepareRing(app: Pick<GameApp, 'params' | 'session' | 'settings'>, o: { seed?: number | null; section?: string | null } = {}): RingStart {
  const seed = o.seed !== undefined && o.seed !== null ? o.seed >>> 0 : ringSeed(app.params.seed);
  const difficulty: Difficulty = app.session?.difficulty ?? app.params.difficulty ?? app.settings.difficulty;
  const section = o.section ?? undefined;
  return { seed, plan: planRing(seed, difficulty), section: section || undefined };
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
  const lm = start.section ? plan.landmarks.find((l) => l.id === start.section) : undefined;
  const d = lm ? Math.max(0, lm.start - RING.runIn) : 0;
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
 * small slices (it is not in the boot's list on the normal route), the reused ams sample group.
 */
export function preloadRing(app: GameApp, start: RingStart): void {
  const def = ringArtFor(start, app.session);
  preloadMissionArt(app, def, def.artDensity, app.session, startStretch(start));
  preloadMissionAudio(app, { audioGroup: RING_AUDIO_GROUP });
  if (app.preloadArt) void preloadSprites(RING_ART, undefined, { skipDeferred: true, timeBudgetMs: 4 });
}

export interface StartRingOpts {
  /** Start at this landmark (`?section=`). */
  section?: string;
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
export function startRing(app: GameApp, o: StartRingOpts = {}): RingScene {
  const players = o.players ?? app.params.players;
  const char = app.params.char ?? 'recruit';
  const characters = o.characters ?? (players === 2 ? [char, char] : [char]);
  app.input.players = players;
  app.session = newSession(app, characters, o.difficulty);
  app.campaign = newCampaign();
  const scene = new RingScene(app, { section: o.section, seed: o.seed });
  app.scenes.reset(scene, { fade: 30 });
  return scene;
}

/**
 * The ring is over (its 'complete' after the victory drive): the glitch bridge freezes its last
 * frame, records the clear, pays the tally silently (the floor-1 tally's `MISSION 2 BONUS`) and
 * goes on into the first-person floors.
 */
export function ringDone(app: GameApp, from: Scene, runner: BridgeRunner): void {
  app.scenes.replace(new GlitchBridgeScene(app, { from, runner }), { fade: 0 });
}
