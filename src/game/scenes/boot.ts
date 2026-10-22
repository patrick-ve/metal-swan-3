/**
 * Boot scene (GDD §13.2): loads the content manifest, installs the cached sprite packs (art-cache.ts)
 * and generates the rest of `bootArt` (the start screens and the first mission), pre-renders the
 * sound effects and fetches and decodes the 'boot' sample group (the start screens; a direct
 * `?mission=` start also loads that mission's group) while an ammunition belt fills in, waits
 * for a click or key (the gesture unlocks audio; one made while loading counts), then goes to
 * the title — or straight into a mission with `?mission=`, or into the first-person mode with
 * `?mode=fps&floor=n` (docs/design/fps.md §1.11; its lazy content loads in FpsIntroScene), or
 * into the glitch bridge with `?mode=bridge`. `?mission=ring` (docs/design/ring.md §1; not a registered
 * mission) starts the RingScene (`startRing`; `section` = a landmark id, `seed` its ring), with
 * the ring's 1× art and the reused ams sample group.
 */
import { listSfx } from '../../engine/audio';
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { preloadSprites } from '../../engine/sprites';
import { blinkOn, centerText, newCampaign, type GameApp } from '../app';
import { isLazyContent, loadContent } from '../content/index';
import type { LaunchParams } from '../params';
import type { RingRoute } from '../ring/ids';
import { getCharacter, getMission, hasCharacter } from '../registry';
import { selectRoster } from './character-select';
import { firstMission, newSession, startNewGame } from './gameplay';
import { startFpsRun } from './fps-route';
import { GlitchBridgeScene } from './glitch-bridge';
import { isRing, RING_ART, RING_AUDIO_GROUP, startRing } from './ring-route';
import { TitleScene } from './title';

type Phase = 'content' | 'sprites' | 'sounds' | 'samples' | 'done';

const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The boot never waits longer than this for the samples (a slow network): the synth fills in. */
export const BOOT_SAMPLES_MAX_MS = 20000;

/** Sprite id prefixes of the start screens (title, menus, mode select, character select, cards). */
export const START_ART: readonly string[] = ['ui/'];

/**
 * The sprite id prefixes the boot preloads (docs/ARCHITECTURE.md §5.4): the start screens, the
 * characters a player can pick (the select roster; for a direct start only `?char=`, default
 * recruit) and the `art` of the mission played first (the first mission, or `?mission=`).
 * Undefined (every sprite) when that mission has no `art` list. Everything else is generated
 * on first use. `?mission=ring`: the ring's art (`RING_ART`) and, besides `?char=`, the select
 * roster (the drivers are heroes nobody plays).
 */
export function bootArt(params: Pick<LaunchParams, 'mission' | 'char' | 'mode'>): readonly string[] | undefined {
  if (isRing(params.mission)) {
    const chars = [params.char ?? 'recruit', ...selectRoster()].filter((c, i, a) => a.indexOf(c) === i && hasCharacter(c));
    return [...START_ART, ...chars.map((c) => `${getCharacter(c).art}/`), ...RING_ART];
  }
  const mission = getMission(params.mission ?? firstMission());
  if (!mission?.art) return undefined;
  const direct = params.mission !== null || params.mode !== undefined;
  const chars = direct ? [params.char ?? 'recruit'] : selectRoster();
  const charArt = chars.filter((c) => hasCharacter(c)).map((c) => `${getCharacter(c).art}/`);
  return [...START_ART, ...charArt, ...mission.art];
}

/**
 * `&route=full|short` of `?mission=ring` (revision R, docs/design/ring.md §R.1; params.ts
 * `LaunchParams.route`); null = by the section (ring-route.ts `ringRouteFor`).
 */
export function ringRouteParam(p: Pick<LaunchParams, 'route'>): RingRoute | null {
  return p.route ?? null;
}

export class BootScene implements Scene {
  private readonly app: GameApp;
  private phase: Phase = 'content';
  private done = 0;
  private total = 0;
  private finished = false;
  private leaving = false;
  private t = 0;

  constructor(app: GameApp) {
    this.app = app;
  }

  enter(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      // The lazy fps content stays out of the boot (FpsIntroScene loads it).
      this.app.content = await loadContent((id) => !isLazyContent(id));
      this.phase = 'sprites';
      // The sprite cache (art-cache.ts) of an earlier visit first: the preload then skips every
      // id it installed. The 2× pack too, so the ams intro card finds its 2× art made already.
      const cache = this.app.artCache;
      if (cache) {
        await cache.restore('boot');
        await cache.restore('hi');
      }
      const art = bootArt(this.app.params);
      // Deferred sprites (SpriteOpts.defer: rare cosmetic strips) are made on first use.
      await preloadSprites(
        art,
        (d, t) => {
          this.done = d;
          this.total = t;
        },
        { skipDeferred: true },
      );
      void cache?.save('boot', art ?? ['']);
      this.phase = 'sounds';
      const audio = this.app.audio as { preload?: (ids: readonly string[]) => void };
      if (typeof audio.preload === 'function') {
        const ids = listSfx();
        this.done = 0;
        this.total = ids.length;
        for (let i = 0; i < ids.length; i += 8) {
          audio.preload.call(this.app.audio, ids.slice(i, i + 8));
          this.done = Math.min(ids.length, i + 8);
          await nextTick();
        }
      }
      await this.loadSamples();
    } catch (err) {
      console.error('[boot] loading failed:', err);
    }
    this.phase = 'done';
    this.finished = true;
  }

  /**
   * The 'boot' sample group, plus the mission's group for a direct `?mission=` start. A file
   * that fails or a slow network never blocks the boot: after BOOT_SAMPLES_MAX_MS it goes on
   * and the rest keeps loading in the background.
   */
  private async loadSamples(): Promise<void> {
    const audio = this.app.audio;
    if (!audio.loadSamples) return;
    const groups = ['boot'];
    const id = this.app.params.mission;
    // The ring loads its own group (RING_AUDIO_GROUP 'mission:ring': the ams effects and voices
    // without the ams songs; its music is the synth ring theme).
    const direct = id ? (isRing(id) ? RING_AUDIO_GROUP : getMission(id)?.audioGroup) : undefined;
    if (direct) groups.push(direct);
    this.phase = 'samples';
    this.done = 0;
    this.total = 0;
    const counts = groups.map(() => ({ done: 0, total: 0 }));
    const all = Promise.all(
      groups.map((g, i) =>
        audio.loadSamples?.(g, (d, t) => {
          counts[i] = { done: d, total: t };
          this.done = counts.reduce((n, c) => n + c.done, 0);
          this.total = counts.reduce((n, c) => n + c.total, 0);
        }),
      ),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, BOOT_SAMPLES_MAX_MS);
    });
    await Promise.race([all, timeout]);
    clearTimeout(timer);
  }

  /** True once everything is loaded (it then waits for a gesture). */
  get ready(): boolean {
    return this.finished;
  }

  /** Loading progress 0..1 over the steps (content 10 %, sprites 70 %, sounds 10 %, samples 10 %). */
  get progress(): number {
    const f = this.total > 0 ? Math.min(1, this.done / this.total) : 0;
    switch (this.phase) {
      case 'content':
        return 0;
      case 'sprites':
        return 0.1 + 0.7 * f;
      case 'sounds':
        return 0.8 + 0.1 * f;
      case 'samples':
        return 0.9 + 0.1 * f;
      case 'done':
        return 1;
    }
  }

  update(): void {
    this.t++;
    if (!this.finished || this.leaving) return;
    const app = this.app;
    // GDD §13.2: a click or key unlocks audio. A gesture made while loading counts too.
    if (app.input.anyPressed() || app.pointerPressed) app.gesture = true;
    app.pointerPressed = false;
    if (!app.gesture) return;
    this.leaving = true;
    const p = app.params;
    if (p.mode === 'fps' || p.mode === 'bridge') {
      const char = p.char ?? 'recruit';
      app.input.players = p.players;
      app.session = newSession(app, p.players === 2 ? [char, char] : [char]);
      app.campaign = newCampaign();
      // ?mode=bridge: the glitch bridge with its placeholder snapshot and no runner (fps.md §1.11).
      if (p.mode === 'bridge') app.scenes.replace(new GlitchBridgeScene(app), { fade: 0 });
      else startFpsRun(app, { floor: p.floor ?? 1 });
    } else if (isRing(p.mission)) startRing(app, { section: p.section ?? undefined, players: p.players, boss: p.boss, route: ringRouteParam(p) ?? undefined });
    else if (p.mission) startNewGame(app, { mission: p.mission, section: p.section ?? undefined, players: p.players, bossRush: p.boss });
    else app.scenes.replace(new TitleScene(app), { fade: 30 });
  }

  /**
   * GDD §13.2 (military, docs/design/squad.md §3.1): a black screen; an ammunition belt of
   * BELT_ROUNDS brass rounds (C, y 96–112) fills in as sprites and sounds pre-render; `LOADING
   * AMMUNITION... 64%` (small, C, y 120); when ready `CLICK OR PRESS ANY KEY` (small, C, y 140,
   * blinking). Drawn with rects only: the sprites do not exist yet while it loads.
   */
  draw(r: Renderer): void {
    r.begin(0x000000ff);
    const frac = this.progress;
    drawBelt(r, frac, this.t);
    centerText(r, `LOADING AMMUNITION... ${Math.floor(frac * 100)}%`, 120, PAL.stone[3]);
    if (this.finished && !this.app.gesture && blinkOn(this.t)) centerText(r, 'CLICK OR PRESS ANY KEY', 140, PAL.snow[3]);
    const failed = this.app.content?.failed.length ?? 0;
    if (failed > 0) centerText(r, `${failed} CONTENT MODULE(S) FAILED - SEE CONSOLE`, 160, PAL.red[3]);
  }
}

/** Rounds in the boot screen's ammunition belt. */
export const BELT_ROUNDS = 16;
const ROUND_STEP = 6;
const BELT_Y = 96;

/**
 * The ammunition belt: an olive fabric band with steel links; a round stands in each loaded
 * link (copper tip, brass case lit on the left, a dark rim); the next round to load glints.
 */
function drawBelt(r: Renderer, frac: number, t: number): void {
  const w = BELT_ROUNDS * ROUND_STEP + 4;
  const x0 = (r.w - w) >> 1;
  const loaded = Math.floor(frac * BELT_ROUNDS + 1e-9);
  // The band behind the rounds.
  r.rect(x0 - 1, BELT_Y + 6, w + 2, 6, PAL.ink[1], plain);
  r.rect(x0, BELT_Y + 7, w, 4, PAL.olive[1], plain);
  r.rect(x0, BELT_Y + 7, w, 1, PAL.olive[3], plain);
  r.rect(x0, BELT_Y + 10, w, 1, PAL.olive[0], plain);
  for (let i = 0; i < BELT_ROUNDS; i++) {
    const x = x0 + 3 + i * ROUND_STEP;
    // The link: a steel clip round the band (the olive band shows between the links).
    r.rect(x, BELT_Y + 7, 4, 4, PAL.steel[0], plain);
    r.rect(x, BELT_Y + 7, 4, 1, PAL.steel[1], plain);
    if (i < loaded) {
      r.rect(x, BELT_Y, 4, 16, PAL.ink[0], plain);
      r.rect(x + 1, BELT_Y, 2, 1, PAL.orange[0], plain);
      r.rect(x, BELT_Y + 1, 4, 3, PAL.orange[0], plain);
      r.rect(x, BELT_Y + 1, 1, 3, PAL.orange[1], plain);
      r.rect(x, BELT_Y + 4, 4, 10, PAL.gold[1], plain);
      r.rect(x, BELT_Y + 4, 1, 10, PAL.gold[3], plain);
      r.rect(x + 3, BELT_Y + 4, 1, 10, PAL.gold[0], plain);
      r.rect(x, BELT_Y + 14, 4, 2, PAL.gold[0], plain);
      // The link holds the round at its waist.
      r.rect(x - 1, BELT_Y + 8, 6, 2, PAL.steel[1], plain);
      r.rect(x - 1, BELT_Y + 8, 6, 1, PAL.steel[3], plain);
      r.rect(x + 4, BELT_Y + 8, 1, 2, PAL.steel[0], plain);
    } else if (i === loaded && blinkOn(t, 8)) r.rect(x + 1, BELT_Y + 8, 2, 2, PAL.gold[2], plain);
  }
}

const plain: DrawOpts = { screen: true };
