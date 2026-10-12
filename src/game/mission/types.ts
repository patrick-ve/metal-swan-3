/**
 * Mission data format (docs/ARCHITECTURE.md §6.2) — the contract for mission agents.
 *
 * A mission is a set of sections; each section has its own terrain, background, decor, timer
 * and a script (a generator coroutine) that runs its waves, camera locks, set pieces, exits and
 * the boss. Sections connect through `exits` (route choices) or `ctx.exitTo()` from the script.
 */
import type { Camera } from '../../engine/camera';
import type { Entity } from '../../engine/entity';
import type { Rect } from '../../engine/math';
import type { Rng } from '../../engine/rng';
import type { ScriptGen, Wait } from '../../engine/script';
import type { TerrainDef } from '../../engine/terrain';
import type { World } from '../../engine/world';
import type { BackgroundDef, BgLayerDef, TerrainStyleDef } from '../art/art-registry';
import type { BannerOpts, CalloutOpts, GoDir, HudState } from '../context';
import type { Player } from '../player/player';
import type { SpawnParams } from '../registry';
import type { CampaignRecords, GameSession } from '../session';

export type { BackgroundDef, BgLayerDef, TerrainDef, TerrainStyleDef };

export type ScrollDir = 'right' | 'up' | 'down' | 'free';

/** A static (or looping) prop drawn behind or in front of the entities. */
export interface DecorDef {
  sprite: string;
  /** Anchor position in world px. */
  x: number;
  y: number;
  /** Static frame (default 0). */
  frame?: number;
  /** Loop the sprite's frames (true = the sprite's own speed, a number = ticks per frame). */
  animate?: boolean | number;
  flipX?: boolean;
  /** Draw in front of the entities (default behind). */
  front?: boolean;
  /** 1 = moves with the world (default); smaller = farther away (0 = fixed to the screen). */
  parallax?: number;
  alpha?: number;
}

export type TransitionKind = 'fade' | 'cut';

/** A route choice: a player's feet entering `rect` takes the exit. */
export interface ExitDef {
  /** Needed to enable / disable it from the script. */
  id?: string;
  rect: Rect;
  /** Target section id, or 'complete' to finish the mission. */
  to: string;
  transition?: TransitionKind;
  /** Where players appear in the target section (default: its playerStart). */
  entry?: { x: number; y: number };
  /** Starts disabled (`ctx.enableExit(id)` turns it on). */
  disabled?: boolean;
}

/** A spot for the respawn drop-in: the feet position of the floor to land on (`y` Infinity = no floor). */
export interface RespawnSpot {
  x: number;
  y: number;
}

export interface SectionDef {
  id: string;
  /** Shown in debug output. */
  name?: string;
  /** Size in px (height ≥ 216; taller sections scroll vertically). */
  width: number;
  height: number;
  scroll: ScrollDir;
  background: BackgroundDef;
  terrain: TerrainDef;
  terrainStyle: TerrainStyleDef;
  decor?: DecorDef[];
  playerStart: { x: number; y: number };
  /**
   * Checkpoints (timer refill + respawn fallback point): camera-centre **x** positions in
   * 'right' / 'free' sections, camera-centre **y** positions in 'up' / 'down' sections.
   */
  checkpoints?: number[];
  /**
   * Section timer in HUD counts (default TUNING.timer.counts = 60). One count lasts
   * TUNING.timer.ticksPerCount ticks (≈ 4.3 s, like the reference), so 60 ≈ 4.3 minutes per
   * checkpoint segment. 0 = no timer.
   */
  timeLimit?: number;
  /** Song for this section (default: the mission's). */
  music?: string;
  script: SectionScript;
  exits?: ExitDef[];
  /** With ?boss=1 the players start here (and `ctx.bossRush` is true). */
  bossStart?: { x: number; y: number };
  /**
   * Respawn rule of this section, asked before the default (the nearest safe floor in view near
   * the death point, else the last checkpoint). Return a spot, or nothing for the default.
   * E.g. m3-a: 64 px ahead of the avalanche front; vertical sections: the moving platform.
   */
  respawn?: (p: Player, ctx: SectionContext) => RespawnSpot | null | void;
  /**
   * Vehicle entity id every player starts in (and gets again after each respawn), e.g. m5-a
   * `'trumpeter'`. The runner spawns it at the player and mounts the player at once.
   */
  startVehicle?: string;
  /**
   * Vehicle ids that may be carried INTO this section by a player who leaves the last one
   * riding (GDD §4.8 "vehicles allowed"). Default: none — the pilot arrives on foot.
   */
  vehicles?: readonly string[];
  /** Ground x ranges covered in ice: players and vehicles slide (`iceAt(world, x)`, GDD §11.3). */
  iceRanges?: readonly (readonly [number, number])[];
}

export type SectionScript = (ctx: SectionContext) => ScriptGen;

export interface MissionDef {
  /** 'm0'..'m5'. */
  id: string;
  name: string;
  subtitle?: string;
  music: string;
  bossMusic?: string;
  /** First section id. */
  start: string;
  sections: Record<string, SectionDef>;
  /** Section of the boss fight (?boss=1 starts there; default: the start section). */
  bossSection?: string;
  /**
   * Sections whose boss fights count for the BOSS SPEED BONUS (default: `[bossSection]`). With
   * several (m5: the GRAND ORGAN in `a`, stages 2 and 3 in `c`) the time of every fight is
   * added up (from each boss's first phase to its 'bossDefeated'); the walk between them is not.
   */
  bossSections?: readonly string[];
  /** Next mission id after the tally (default: the next registered id, e.g. m1 → m2). */
  next?: string;
  /** Start banner (default: `name` with `subtitle` under it) and announcer line at the start. */
  startBanner?: { text?: string; sub?: string };
  announce?: string;
  /** Announcer line at MISSION COMPLETE! (default 'Objective secured!'). */
  clearLine?: string;
  /**
   * Hostages placed per section id, e.g. `{ a: 4, b1: 3, b2: 3, c: 3 }`: STANDING OVATION (GDD
   * §7.4, §14.4) compares a player's tally with the sum over the sections of the route taken.
   */
  hostages?: Readonly<Record<string, number>>;
}

export interface SpawnGroupOpts {
  /** First x. */
  x: number;
  /** Feet y, or 'ground' (default) for the ground line at each x. */
  y?: number | 'ground';
  /** Gap between members (px, default 32; negative = leftwards). */
  spacing?: number;
  params?: SpawnParams;
  /** Tag every member (for `waitClear(tag)`). */
  tag?: string;
}

export type EntrySide = 'left' | 'right' | 'top';

export interface EnterOpts {
  /** Feet y (default: the floor at the entry x; for 'top': above the view). */
  y?: number;
  /** For 'top': x (default: view centre). */
  x?: number;
  /** Distance outside the view edge (default 24). */
  margin?: number;
  params?: SpawnParams;
  tag?: string;
}

export interface BossIntroOpts {
  /** Small line under the boss name (GDD §13.7: `COMMODORE BLARE WILL NOT LEAVE THE STAGE`). */
  subtitle?: string;
  /** Klaxon sound (default 'boss/warning'). */
  sfx?: string;
  /** Song (default: the mission's bossMusic, else 'boss'). */
  music?: string;
  /** Banner ticks (default 120, GDD §10.0). */
  ticks?: number;
  /** Start the boss song at this index of its order list (MusicOpts.from). */
  musicFrom?: number;
}

/**
 * An invisible body wall (GDD §10.1 THE ENCORE x 2844, §11.3 the Swan-only wall in m3-a): a clamp
 * like the view edges, not a solid, so it never stops shots. Bodies on the far side are pushed
 * back each tick (players on foot, vehicles with their riders).
 */
export interface BodyWallOpts {
  /** The side bodies stay on (default 'left': nothing passes right of x). */
  keep?: 'left' | 'right';
  /** Vertical span the wall covers (default: the whole section). */
  y0?: number;
  y1?: number;
  /** Clamp players on foot (default true). A mounted player moves with the vehicle. */
  players?: boolean;
  /** Clamp vehicles, driven or empty (default true). */
  vehicles?: boolean;
  /** Extra filter: only bodies it accepts are clamped (e.g. `isSwan` for a Swan-only wall). */
  filter?: (e: Entity) => boolean;
  /** Called on each tick a body is pushed back (e.g. a grounded ridden Swan ejects her pilot). */
  onTouch?: (e: Entity) => void;
}

export interface BodyWall {
  x: number;
  enabled: boolean;
  readonly opts: BodyWallOpts;
  /** Take the wall away (the section unload does this too). */
  remove(): void;
}

/** Options of `ctx.music` beyond the fade. */
export interface MusicCallOpts {
  /** Start at this index of the song's order list (MusicOpts.from). */
  from?: number;
  /** Start again even when the song is already playing. */
  restart?: boolean;
}

export interface TimerControl {
  /** Counts left. */
  readonly counts: number;
  pause(): void;
  resume(): void;
  /** Refill (default: the section's time limit). */
  reset(counts?: number): void;
}

/**
 * What a section script gets. Every helper acts immediately; helpers that return a `Wait` can
 * be yielded to wait for them (`yield ctx.waitClear('wave1')`).
 */
export interface SectionContext {
  readonly world: World;
  readonly mission: MissionDef;
  readonly section: SectionDef;
  readonly session: GameSession;
  readonly camera: Camera;
  /** Gameplay rng (same as world.rng). */
  readonly rng: Rng;
  readonly hud: HudState;
  /** ?boss=1: the script should skip straight to its boss fight. */
  readonly bossRush: boolean;
  /** The Player entities of this section (dead ones included). */
  readonly players: readonly Player[];
  /** Active players right now (co-op balance). */
  readonly playerCount: number;

  /** Spawn an entity; y 'ground' = the ground line at x. */
  spawn(id: string, x: number, y: number | 'ground', params?: SpawnParams): Entity;
  /** Spawn `count` entities in a row (see SpawnGroupOpts). */
  spawnGroup(id: string, count: number, o: SpawnGroupOpts): Entity[];
  /** Spawn just outside the view, facing in ('left' / 'right' at the floor, 'top' above the view). */
  enter(id: string, side: EntrySide, o?: EnterOpts): Entity;

  /** Confine the camera: x from minX (default: the current view) to maxX (default minX + view width). */
  lockCamera(minX?: number, maxX?: number): void;
  /** Release the lock (and show the GO arrow unless `go` is false). */
  unlockCamera(go?: boolean): void;
  /** Camera left edge ≥ x. */
  waitCamera(x: number): Wait;
  /** Camera top ≤ y ('up' sections) — or ≥ y for 'down' sections. */
  waitCameraY(y: number): Wait;
  /** Some alive player's x ≥ x. */
  waitPlayerX(x: number): Wait;
  /** No alive entity with the tag is left (default 'enemy'). */
  waitClear(tag?: string): Wait;

  /** Show the ONWARD prompt now (after an unlock it appears by itself). */
  showGo(dir?: GoDir): void;
  banner(text: string, o?: BannerOpts): void;
  /** A centred callout line ('CHECKPOINT', 'SET PIECE! +200' …; GDD §13.7), 90 ticks. */
  callout(text: string, o?: CalloutOpts): void;
  /**
   * WARNING! banner (boss name + subtitle) + klaxon + boss music; the section timer refills and
   * pauses until the banner is gone and the boss has entered (GDD §10.0). Yield it to wait for
   * the banner.
   */
  bossIntro(name?: string, o?: BossIntroOpts): Wait;
  /**
   * Auto-scroll (GDD §4.12, m5-a): the camera window moves `speed` px/tick in the section's
   * scroll direction and pushes the players; 0 stops it (the view holds). lockCamera /
   * unlockCamera cancel it.
   */
  autoScroll(speed: number): void;
  /** Timer refill + respawn reference point (default: the camera centre). */
  setCheckpoint(x?: number, y?: number): void;
  /**
   * Change the music (null = stop). The same song again keeps playing unless `restart`; `from`
   * starts a new song at that index of its order list.
   */
  music(id: string | null, fadeTicks?: number, o?: MusicCallOpts): void;
  /**
   * Cross-section / cross-mission records of this game (`session.records`): `get(key, fallback)`,
   * `set(key, value)`, `has`, `delete`. E.g. m3 SHE TOOK THE LIFT (`m3/lift`).
   */
  readonly records: CampaignRecords;
  /** Put up an invisible body wall at x (see BodyWallOpts); it lasts until removed or the section ends. */
  bodyWall(x: number, o?: BodyWallOpts): BodyWall;
  readonly timer: TimerControl;
  enableExit(id: string, on?: boolean): void;
  /** Leave for another section (fade). Yield it: the script ends with the section. */
  exitTo(section: string, o?: { transition?: TransitionKind; entry?: { x: number; y: number } }): Wait;
  /** Mission accomplished: victory poses, then the tally. Yield it. */
  missionComplete(): Wait;
}
