/**
 * RingScene: mission `ring`, level 2 — the A10 ring road (docs/design/ring.md §1, §9, §13). The
 * host of a `RingRunner` (src/game/ring/runner.ts), as GameplayScene hosts a MissionRunner:
 *
 * - the HUD (`drawHud`: the wagon's armour in the vehicle panel, the in-world continue countdown);
 * - the play controls (play-host.ts): the pause, player 2's join at any time with START on a free
 *   pad or the key 2 (a credit; P2's own wagon with a driver of its own drives in from the left:
 *   `RingRunner.joinPlayer`), the lost-pad pause, the key-split notice;
 * - the in-world continue (the runner's; every player out: the announcer asks, stale banners go);
 *   every countdown out → GAME OVER (`GameOverScene`);
 * - tier-4 art: `preloadMissionArt` with `ringArtDef` (sections = stretches, the drivers' strips)
 *   at the start, after a join and on a rise to tier 4; `missionArtSection` at each stretch
 *   boundary (the runner's 'stretch'); `stopDense` when the play ends;
 * - the music: the ring's synth songs (content/music/ring.ts: `ring`, `ring-boss`) and the cues
 *   (ring/cues.ts: the boss song at the boss slot, the tunnel lift);
 * - rumble (rumble.ts), debug F4 (`runner.skip`: the next stretch / the boss) and F5 (weapons),
 *   the seed in the debug overlay;
 * - 'complete' → `ringDone`: the ring's MISSION COMPLETE page (hostages, fines, the seed) → the
 *   glitch bridge → the fps floors.
 *
 * ```ts
 * app.scenes.reset(new RingScene(app, { seed: 42, section: 'west' }));   // ?mission=ring&seed=42&section=west
 * ```
 */
import { ACTION_BUTTONS } from '../../engine/input';
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { artTier, withArtDensity } from '../../engine/sprites';
import { centerText, type GameApp } from '../app';
import { drawHud } from '../hud';
import { getWeapon, listWeapons } from '../registry';
import { ringArtDef } from '../ring/art-def';
import { ringBoarding } from '../ring/boarding';
import { attachRingCues, type RingCues } from '../ring/cues';
import { RING_ID } from '../ring/ids';
import { RingRunner } from '../ring/runner';
import { GameSession } from '../session';
import { type GameSettings } from '../settings';
import { TUNING } from '../tuning';
import { VOICE } from './flow-data';
import { GameOverScene } from './game-over';
import { missionArtSection, preloadMissionArt, preloadMissionAudio, stopDense } from './gameplay';
import { PlayControls, type PlayHost } from './play-host';
import { AMS_AUDIO_GROUP, prepareRing, RING_AUDIO_GROUP, ringDone, type RingStart } from './ring-route';
import { RumbleWatch } from './rumble';

export interface RingSceneOpts {
  /** A prepared start (the intro card's: seed and plan); default `prepareRing(app, { seed, section })`. */
  start?: RingStart;
  /** Start at this landmark (`?section=`). */
  section?: string;
  /** The ring's seed (default `?seed=`, else a fresh one). */
  seed?: number;
  /** Use this session instead of `app.session` (tests). */
  session?: GameSession;
}

/** The start banner of a mission with a card lasts 120 ticks (GDD §13.6). */
const START_BANNER_TICKS = 120;

export class RingScene implements Scene, PlayHost {
  readonly app: GameApp;
  readonly opts: RingSceneOpts;
  runner!: RingRunner;
  /** The ring has no attract demo. */
  readonly demo = false;
  private t = 0;
  private weaponCycle = 0;
  /** A scene on top silenced the loops (pause / resume). */
  private loopsPaused = false;
  /** The art tier the preload last saw (a change to or from 4 starts or stops the working set). */
  private tierSeen = 0;
  /** Pad rumble on wrecks, big blasts, boss part breaks and wagon hits. */
  private rumble: RumbleWatch | null = null;
  /** Joins, pad claims, the pause, the lost-pad pause and the key-split notice (play-host.ts). */
  private readonly controls = new PlayControls(this);
  /** The music cues (ring/cues.ts: the boss song, the tunnel lift). */
  private cues: RingCues | null = null;

  constructor(app: GameApp, opts: RingSceneOpts = {}) {
    this.app = app;
    this.opts = opts;
  }

  get session(): GameSession {
    if (this.opts.session) return this.opts.session;
    if (!this.app.session) this.app.session = new GameSession({ seed: this.app.params.seed ?? 1 });
    return this.app.session;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    // A free pad's START asks to join (GDD §4.9) instead of pausing player 1.
    app.input.joinWatch = true;
    this.rumble = new RumbleWatch(app.input, () => app.settings);
    app.audio.duckMusic?.(1);
    app.focusLost = false;
    app.pointerPressed = false;
    const session = this.session;
    const start = this.opts.start ?? prepareRing({ params: app.params, session, settings: app.settings }, { seed: this.opts.seed, section: this.opts.section });
    const runner = new RingRunner({
      session,
      pads: [app.input.pad(0), app.input.pad(1)],
      audio: app.audio,
      seed: start.seed,
      plan: start.plan,
      section: start.section,
      settings: app.settings,
    });
    this.runner = runner;
    // The music follows the road (the boss song, the tunnel lift; cosmetic, no rng).
    this.cues = attachRingCues(runner);
    this.tierSeen = artTier();
    runner.events.on('complete', () => ringDone(app, this, runner));
    // The in-world continue (GDD §4.6): the countdown runs over the live (held) ring; no menu.
    runner.events.on('allOut', () => {
      app.audio.voice(VOICE.continue);
      runner.hud.clearBanner();
      runner.hud.hideGo();
    });
    runner.events.on('gameOver', () => app.scenes.push(new GameOverScene(app)));
    // Tier 4: the working set moves on with the stretches (art-def.ts: sections = stretches).
    runner.events.on('stretch', ({ id }) => missionArtSection(id));
    runner.start();
    this.rumble.attach(runner.world, runner);
    // The card's start banner shows for 120 ticks (GDD §13.6).
    const b = runner.hud.banner;
    if (b && b.style === 'mission') b.ticks = b.total = Math.min(b.total, START_BANNER_TICKS);
    // A direct start (?mission=ring): the intro card did not run. Its samples (the ring group).
    this.preloadArtNow();
    preloadMissionAudio(app, { audioGroup: RING_AUDIO_GROUP });
    // The ams group is done with: its two songs (about 60 MB decoded) go; its effects and voices
    // stay, the ring group above lists the same entries (the bank keeps a key another group owns).
    app.audio.releaseSamples?.(AMS_AUDIO_GROUP);
    const weapon = app.params.weapon;
    if (weapon) for (const p of runner.players) p.giveWeapon(weapon, undefined, false);
    app.debug.on('skip', () => runner.skip());
    app.debug.on('weapons', () => this.cycleWeapons());
  }

  exit(): void {
    const app = this.app;
    app.input.joinWatch = false;
    // The play is over (QUIT, game over, the ring's end): its tier-4 working set and 4× frames go.
    stopDense(RING_ID);
    app.debug.on('skip', () => {});
    app.debug.on('weapons', () => {});
    this.cues?.detach();
    this.cues = null;
    if (this.runner) {
      this.runner.stopLoops(this.loopsPaused ? 0 : 30);
      // The view's queued scenery jobs are of no use any more.
      this.runner.dispose();
    }
    if (this.loopsPaused) app.audio.resumeLoops?.();
    this.loopsPaused = false;
  }

  /** A scene opened on top (pause, GAME OVER): the music at half level, the loops silent. */
  pause(): void {
    this.app.input.joinWatch = false;
    this.app.audio.duckMusic?.(0.5);
    this.app.audio.pauseLoops?.();
    this.loopsPaused = true;
  }

  resume(): void {
    this.app.input.joinWatch = true;
    this.app.audio.duckMusic?.(1);
    this.app.audio.resumeLoops?.();
    this.loopsPaused = false;
    // Only the action buttons: a direction held through the pause keeps steering.
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
    this.controls.trackDevice();
    // The lost-pad pause, joins and pad claims, the pause (play-host.ts).
    if (runner.state === 'playing' && !app.scenes.busy && this.controls.interrupt()) return;
    this.controls.watchKeySplit();
    app.debug.apply(runner.world);
    runner.update();
    this.rumble?.tick(runner.world);
    const cam = runner.world.camera;
    runner.hud.trackCamera(cam.x, cam.y);
  }

  /** The boarding scene owns START (it skips the scene after the first play): no pause then. */
  startReserved(): boolean {
    return !!this.runner && ringBoarding(this.runner.world);
  }

  /** The ring's art preload for the stretch being driven (the start, a join, a rise to tier 4). */
  preloadArtNow(): void {
    const runner = this.runner;
    if (!runner) return;
    preloadMissionArt(this.app, ringArtDef(runner.plan, runner.drivers), runner.artDensity, this.session, runner.section.id || undefined);
  }

  /** The art tier changed during the play: a rise to 4 starts the working set, a fall below 4 stops it. */
  private syncArtTier(): void {
    const t = artTier();
    if (t === this.tierSeen) return;
    const was = this.tierSeen;
    this.tierSeen = t;
    if (t >= 4) this.preloadArtNow();
    else if (was >= 4) stopDense(RING_ID);
  }

  /** Debug F5: the next registered player weapon with full ammo, and a full stock of bombs. */
  private cycleWeapons(): void {
    const ids = listWeapons((w) => (w.kind ?? 'gun') === 'gun');
    if (ids.length === 0) return;
    const id = ids[this.weaponCycle++ % ids.length];
    for (const p of this.runner.players) {
      p.giveWeapon(id, getWeapon(id).maxAmmo ?? TUNING.weapons.maxAmmo);
      p.addBombs(TUNING.grenade.cap);
    }
  }

  draw(r: Renderer): void {
    const runner = this.runner;
    this.syncArtTier();
    r.begin(runner.sky);
    runner.draw(r);
    // The HUD draws with the ring's art density too (2× / 4× icons where they exist).
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
    const debug = this.app.debug;
    debug.draw(r, runner.world);
    // The seed (bug reports and replays; spec §13), under the stats line when it shows.
    if (debug.enabled) centerText(r, `SEED ${runner.seed}  ${runner.section.id.toUpperCase()}`, debug.stats ? 11 : 2, PAL.stone[3]);
  }
}
