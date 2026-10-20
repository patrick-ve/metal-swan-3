/**
 * The ring's runtime (docs/design/ring.md §2, §9, §13; docs/api/ring.md §1–§7): a `RingRunner` on
 * the UNCHANGED engine `World` (nothing in src/engine, MissionRunner, Player, Vehicle, Enemy or
 * Boss changes at run time, so ams and m0–m5 stay byte-identical by construction).
 *
 * - The plane: world x = road distance, world y = plane y (lanes.ts). A flat ground at the bottom
 *   of the road band (particles bounce there; shots that leave the band are removed).
 * - The camera moves right at `roadSpeed` all the time (cruise `RING.cruiseSpeed`; `limitSpeed`
 *   caps it, e.g. the jam; it eases to 0 while every player is out).
 * - The PLAN CURSOR `planDist` advances with the camera unless the plan is LOCKED (a boss: the road
 *   keeps scrolling) or HELD (the continue). Plan entries spawn ahead of the view (types.ts
 *   `RingSpawn`); unknown ids are skipped and counted, never an error. Boss slots spawn their boss
 *   and lock the plan until it is gone (an unknown id, e.g. the end marker, is skipped).
 * - Stretch boundaries emit 'stretch' (and 'sectionLoaded', the same id, for code written against
 *   MissionRunner): the tier-4 art section moves on (art-def.ts).
 * - The plan's end: the exit hook (`RING_HOOKS.planEnd`, default: `completeMission()`); the victory
 *   drive; 'complete'.
 * - Drawing (spec §13): road (view) → shadow pass → entities sorted by `y · 100 + z` (shots raised
 *   by their shooter's `shotLift`) → particles → front layer → light; the scene draws the HUD.
 * - It offers the members the HUD, the tally and the scenes read from a MissionRunner (`hud`,
 *   `players`, `player()`, `continueTicks`, `countdownNumber`, `timeLeft`, `mission`, `session`,
 *   `nextMission()`, `stopLoops()`, `artDensity`, `section` …) and `report()` for the sim.
 *
 * ```ts
 * const runner = new RingRunner({ session, pads: [input.pad(0), input.pad(1)], audio, seed });
 * runner.events.on('complete', () => …);   // after the victory drive → tally / glitch bridge
 * runner.events.on('stretch', ({ id }) => missionArtSection(id));
 * runner.start();
 * // every tick: runner.update();   every frame: r.begin(runner.sky); runner.draw(r);
 * ```
 */
import { NullAudio, type AudioOut } from '../../engine/audio';
import type { Entity } from '../../engine/entity';
import { EventBus } from '../../engine/events';
import type { VirtualPad } from '../../engine/input';
import { approach } from '../../engine/math';
import type { Renderer } from '../../engine/render';
import { hashString } from '../../engine/rng';
import { artTier, toArtDensity, withArtDensity, type ArtDensity } from '../../engine/sprites';
import { Terrain } from '../../engine/terrain';
import { World, type WorldError } from '../../engine/world';
import { Boss } from '../boss';
import { attachGame, HudState, type GameContext } from '../context';
import { gameEntityFactory, hasCharacter, hasEntity, type SpawnParams } from '../registry';
import type { Difficulty, GameSession, PlayerSlot, SlotIndex } from '../session';
import { DEFAULT_SETTINGS, shakeScaleOf, type GameSettings } from '../settings';
import { TUNING } from '../tuning';
import { RingContinue } from './continue';
import { drawRingShadow, setShotLift, shotLiftOf, type RingDrawable, type RingHost } from './entity';
import { RingHero } from './hero';
import { RING_HOOKS } from './hooks';
import { RING_ENTITY, type RingLandmarkId } from './ids';
import { GROUND_Y, inRoadBand, laneY } from './lanes';
import { ringMission, ringSong, type RingMission } from './mission';
import { planRing } from './plan';
import { chunkIndexAt } from './director';
import { RING, type RingBossSlot, type RingChunk, type RingPlan, type RingSpawn, type RingStretch, type RingViewHost } from './types';
import { RingView } from './view';
import { spawnWagon } from './wagon';

export type RingState = 'playing' | 'victory' | 'complete' | 'gameover';

export interface RingRunnerEvents {
  /** The victory drive is over: show the tally. */
  complete: { mission: string };
  /** Every countdown ran out with every joined player out: GAME OVER. */
  gameOver: { mission: string };
  /** A player is out of lives: their continue countdown starts (`continueTicks`). */
  playerOut: { slot: SlotIndex };
  /** Every joined player is out: the countdown runs over the live (held) world. */
  allOut: { slot: SlotIndex };
  /** A stretch begins (also at the start): the tier-4 art section moves on (`missionArtSection`). */
  stretch: { id: RingLandmarkId; index: number };
  /** The same as 'stretch' (for code written against MissionRunner's 'sectionLoaded'). */
  sectionLoaded: { id: string };
  /** The plan cursor reached the plan's end (the exit hook runs). */
  planEnd: { length: number };
  /** A speed fine (spec §7.4). */
  fine: { slot: SlotIndex; points: number; reason: string };
  /** A boss slot was reached: `spawned` = a registered boss came in and locked the plan. */
  bossSlot: { id: string; at: number; spawned: boolean };
}

export interface RingRunnerOptions {
  session: GameSession;
  pads: readonly [VirtualPad, VirtualPad];
  audio?: AudioOut;
  /** Ring seed (default the session seed; scenes pass `ringSeed(params.seed)`). */
  seed?: number;
  /** Plan difficulty (default the session's). */
  difficulty?: Difficulty;
  /** A ready plan (tests, tools); default `planRing(seed, difficulty)`. */
  plan?: RingPlan;
  /** Start at this landmark (`?section=`) with a short run-in. */
  section?: string;
  settings?: GameSettings;
  /** Art density override (default the mission's 4). */
  artDensity?: number;
}

/** What the sim reports for a ring run (`report()`). */
export interface RingReport {
  mission: string;
  seed: number;
  difficulty: string;
  players: number;
  ticks: number;
  /** Plan distance driven (px) and camera distance (px; more when a boss locked the plan). */
  distance: number;
  roadDistance: number;
  planLength: number;
  /** Stretch ids entered, in order. */
  landmarks: string[];
  kills: number;
  deaths: number;
  wrecks: number;
  fines: number;
  hostages: number;
  continues: number;
  score: number;
  complete: boolean;
  gameOver: boolean;
  /** Plan entries spawned, and the skipped ones per unknown id. */
  spawned: number;
  skipped: Record<string, number>;
  bosses: { id: string; spawned: boolean }[];
  errors: WorldError[];
  maxEntities: number;
}

interface BossRun {
  slot: RingBossSlot;
  entity: Entity | null;
  key: string;
}

const warnedIds = new Set<string>();

/** Trigger plan distance of an entry (see `RingSpawn`). */
function triggerOf(s: RingSpawn, viewW: number): number {
  return s.from === 'behind' ? s.at : s.at - viewW - RING.spawnAhead;
}

export class RingRunner implements RingHost, RingViewHost {
  readonly isRing = true as const;
  readonly session: GameSession;
  readonly pads: readonly [VirtualPad, VirtualPad];
  readonly audio: AudioOut;
  readonly settings: GameSettings;
  readonly hud = new HudState();
  readonly events = new EventBus<RingRunnerEvents>();
  readonly seed: number;
  readonly plan: RingPlan;
  readonly mission: RingMission;
  readonly world: World;
  readonly game: GameContext;
  readonly view: RingView;
  readonly players: RingHero[] = [];
  /** Each slot's driver hero id for the whole level (spec §0 row 23). */
  readonly drivers: [string | null, string | null] = [null, null];
  /** Continue countdowns (ticks) per slot that is out of lives; −1 = none. */
  readonly continueTicks: [number, number] = [-1, -1];
  readonly cont: RingContinue;
  state: RingState = 'playing';
  /** Ticks since the start (60 per second). */
  ticks = 0;
  /** Camera speed (px/tick). */
  roadSpeed = 0;
  /** Plan distance of the view's left edge. */
  planDist = 0;
  /** Index of the current stretch (−1 before the start). */
  stretchIndex = -1;

  private readonly startSection: string | undefined;
  private readonly startDist: number;
  private readonly density: ArtDensity;
  /** Plan entries sorted by their trigger distance, and those triggers. */
  private readonly queue: RingSpawn[];
  private readonly triggers: Float64Array;
  private cursor = 0;
  private readonly bossRuns: BossRun[];
  private bossCursor = 0;
  private readonly locks = new Set<string>();
  private readonly caps = new Map<string, number>();
  private planEnded = false;
  private victoryT = 0;
  private music: string | null = null;
  private musicFrom: number | undefined = undefined;
  private ambience: string | null = null;
  private readonly sectionRef = { id: '' };
  private readonly skipped = new Map<string, number>();
  private spawned = 0;
  private wrecks = 0;
  private fines = 0;
  private hostages = 0;
  private maxEntities = 0;
  private readonly visited: string[] = [];
  private fightStart = -1;
  private readonly drawList: Entity[] = [];
  private readonly drawKeys: number[] = [];

  constructor(o: RingRunnerOptions) {
    this.session = o.session;
    this.pads = o.pads;
    this.audio = o.audio ?? new NullAudio();
    this.settings = o.settings ?? { ...DEFAULT_SETTINGS };
    this.seed = (o.seed ?? o.session.seed) >>> 0;
    this.plan = o.plan ?? planRing(this.seed, o.difficulty ?? o.session.difficulty);
    this.mission = ringMission(this.plan);
    this.startSection = o.section;
    this.density = toArtDensity(o.artDensity ?? this.mission.artDensity);
    // The road: a flat ground at the bottom of the band over the whole run (boss locks included).
    const end = this.plan.length + RING.roadTail;
    const terrain = new Terrain({
      bounds: { x: -1024, y: 0, w: end + 2048, h: 216 },
      ground: [
        [
          [-1024, GROUND_Y],
          [end + 1024, GROUND_Y],
        ],
      ],
      platforms: [],
      solids: [],
      hazards: [],
    });
    this.world = new World({ terrain, seed: (this.seed ^ hashString('ring/world')) >>> 0, factory: gameEntityFactory, audio: this.audio });
    this.game = attachGame(this.world, this.session, this.hud, this.settings);
    this.game.runner = this;
    this.game.footsteps = false;
    const cam = this.world.camera;
    cam.scroll = 'right';
    cam.smoothing = 1;
    cam.maxSpeed = Infinity;
    cam.shakeScale = shakeScaleOf(this.settings.screenShake);
    this.view = new RingView(this.plan, this.seed, this.density);
    // The closures draw their own yellow lines (content/ring/hazards/closure.ts): one set only.
    this.view.planMarks = !hasEntity(RING_ENTITY.closure);
    this.cont = new RingContinue(this);
    // The plan cursor's queue.
    const vw = cam.w;
    this.queue = [...this.plan.spawns].sort((a, b) => triggerOf(a, vw) - triggerOf(b, vw));
    this.triggers = Float64Array.from(this.queue, (s) => triggerOf(s, vw));
    this.bossRuns = [...this.plan.bosses].sort((a, b) => a.at - b.at).map((slot, i) => ({ slot, entity: null, key: `boss:${i}:${slot.id}` }));
    const lm = this.startSection ? this.plan.landmarks.find((l) => l.id === this.startSection) : undefined;
    this.startDist = lm ? Math.max(0, lm.start - RING.runIn) : 0;
    this.hud.onBubble = (text, kind, speaker) => {
      if (kind === 'gag' && !this.settings.speechBubbles) return;
      if (kind === 'gag') this.audio.say?.(text, speaker);
      else this.audio.say?.(text, speaker, { important: true });
    };
  }

  // ------------------------------------------------------------------------------- start

  /** Place the heroes and their wagons, show the banner, start the music and the plan. */
  start(): void {
    const m = this.mission;
    this.session.startMission(m.id);
    this.hud.showBanner(m.label, { sub: m.name, style: 'mission', ticks: 170 });
    this.audio.voice(m.announce);
    this.world.camera.x = 0;
    this.planDist = this.startDist;
    this.roadSpeed = RING.cruiseSpeed;
    this.wire();
    // Entries before the start are skipped; road entries already in (or ahead of) the view come.
    while (this.cursor < this.queue.length && this.triggers[this.cursor] <= this.planDist) {
      const s = this.queue[this.cursor++];
      if (s.from !== 'behind' && s.at >= this.planDist) this.spawnEntry(s);
    }
    while (this.bossCursor < this.bossRuns.length && this.bossRuns[this.bossCursor].slot.at < this.planDist) this.bossCursor++;
    this.checkStretch();
    for (const slot of this.session.slots) if (slot.active) this.addHero(slot.index, 'start');
    this.world.flush();
    this.playMusic(m.music);
    RING_HOOKS.boarding?.(this);
  }

  private wire(): void {
    const w = this.world;
    w.events.on('playerOut', (e) => this.cont.onPlayerOut(e.slot as SlotIndex, e.player));
    w.events.on('continueLanded', (e) => {
      if (e.player instanceof RingHero) this.cont.onContinueLanded(e.player);
    });
    w.events.on('score', (e) => {
      if (e.x !== undefined && e.y !== undefined) this.hud.popup(e.x, e.y, String(e.points));
    });
    w.events.on('enemyKilled', (e) => {
      const slot = this.session.slot(e.player);
      if (slot) slot.mission.kills[e.enemy.type] = (slot.mission.kills[e.enemy.type] ?? 0) + 1;
    });
    w.events.on('pickup', (e) => {
      const kind = (e.item as Entity & { params?: SpawnParams }).params?.kind;
      if (kind === 'golden-record') e.player.slot.mission.goldenRecord = true;
    });
    w.events.on('hostageRescued', () => this.hostages++);
    w.events.on('vehicleDestroyed', (e) => {
      if (e.vehicle.hasTag('ring-wagon')) this.wrecks++;
    });
    w.events.on('bossPhase', (e) => {
      if (e.phase !== 0) return;
      if (this.fightStart < 0) this.fightStart = this.ticks;
      for (const s of this.session.slots) if (s.mission.bossStartTick < 0) s.mission.bossStartTick = this.ticks;
    });
    w.events.on('bossDefeated', () => {
      this.fightStart = -1;
      for (const s of this.session.slots) if (s.mission.bossStartTick >= 0 && s.mission.bossEndTick < 0) s.mission.bossEndTick = this.ticks;
      for (const p of this.players) {
        const v = p.wagon;
        if (p.state === 'mounted' && v) {
          p.slot.bonus.vehicle += v.bonus;
          p.slot.mission.vehicleAtFinish = true;
        }
      }
    });
    // Shots are drawn raised by their shooter's gun height (spec §13).
    w.events.on('spawn', (e) => {
      if (!e.hasTag('shot')) return;
      const shooter = (e as Entity & { shooter?: Entity | null }).shooter;
      const lift = shooter ? (shooter as Entity & RingDrawable).shotLift : undefined;
      // Pooled projectiles are reused: a shot without a lifted shooter clears the old lift.
      setShotLift(e, typeof lift === 'number' ? lift : 0);
    });
  }

  // ------------------------------------------------------------------------------- players

  /** The driver of a slot: the first plan driver nobody plays and the other slot does not drive. */
  driverFor(slot: SlotIndex): string | null {
    const have = this.drivers[slot];
    if (have) return have;
    const playing = this.session.slots.filter((s) => s.joined).map((s) => s.character);
    const other = this.drivers[(1 - slot) as SlotIndex];
    for (const id of this.plan.drivers) {
      if (playing.includes(id) || id === other || !hasCharacter(id)) continue;
      this.drivers[slot] = id;
      return id;
    }
    return null;
  }

  /**
   * A hero for a slot with its wagon: 'start' stands in its start lane; the other modes drive in
   * from the left ('join'; 'continue' through `continuePlayer`). @internal (continue.ts, joins).
   */
  addHero(slot: SlotIndex, mode: 'start' | 'join' | 'none' = 'none'): RingHero {
    const s = this.session.slots[slot];
    const cam = this.world.camera;
    const p = new RingHero(this.world, cam.x + RING.startX[slot], laneY(RING.startLane[slot]), { pad: this.pads[slot], index: slot, slot: s });
    p.driverId = this.driverFor(slot);
    p.lane = RING.startLane[slot];
    this.world.add(p);
    this.players.push(p);
    if (mode === 'start') spawnWagon(p, 'start');
    else if (mode === 'join') p.respawn('join');
    const st = this.stretch;
    if (st && !s.mission.route.includes(st.id)) s.mission.route.push(st.id);
    return p;
  }

  player(slot: number): RingHero | undefined {
    return this.players.find((p) => p.index === slot);
  }

  /** A new player joins mid-ring (2P): a wagon with a driver of its own drives in from the left. */
  joinPlayer(slot: SlotIndex, character: string): RingHero {
    const existing = this.player(slot);
    if (existing && existing.state !== 'out') return existing;
    // Never one of the drivers' faces twice: another roster hero then.
    let char = character;
    if (this.drivers.includes(char)) {
      const other = this.session.slots[(1 - slot) as SlotIndex];
      const alt = this.plan.drivers.find((id) => !this.drivers.includes(id) && id !== other.character && hasCharacter(id));
      if (alt) char = alt;
    }
    this.session.join(slot, char);
    this.continueTicks[slot] = -1;
    if (existing) {
      existing.continueGame(null);
      return existing;
    }
    return this.addHero(slot, 'join');
  }

  /** Use a continue for an out slot (START): see continue.ts. */
  continuePlayer(slot: SlotIndex): boolean {
    return this.cont.continuePlayer(slot);
  }

  /** @internal Every countdown ran out: GAME OVER. */
  endGame(): void {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.events.emit('gameOver', { mission: this.mission.id });
  }

  /** @internal A continue during GAME OVER brings the play back. */
  resumeAfterGameOver(): void {
    if (this.state === 'gameover') this.state = 'playing';
  }

  /** Is the world held for the continue countdown (every player out)? */
  get countdownHeld(): boolean {
    return this.cont.held;
  }

  /** RingHost: the continue holds the scroll and the plan. */
  get held(): boolean {
    return this.cont.held;
  }

  /** The countdown number on show (9 … 0) while held; −1 when none runs. */
  get countdownNumber(): number {
    return this.cont.countdownNumber;
  }

  // ------------------------------------------------------------------------------- tick

  update(): void {
    this.ticks++;
    this.hud.update();
    switch (this.state) {
      case 'playing':
        this.advance();
        this.world.update();
        this.afterWorld();
        this.cont.update();
        break;
      case 'victory':
        this.advance();
        this.world.update();
        this.afterWorld();
        if (++this.victoryT >= TUNING.transition.victoryTicks) {
          this.state = 'complete';
          this.events.emit('complete', { mission: this.mission.id });
        }
        break;
      case 'gameover':
      case 'complete':
        break;
    }
    const n = this.world.entities.length;
    if (n > this.maxEntities) this.maxEntities = n;
  }

  /** The road speed, the camera, the plan cursor (spawns, stretches, boss slots, the end). */
  private advance(): void {
    const held = this.cont.held;
    let target = this.state === 'victory' ? RING.cruiseSpeed : held ? 0 : RING.cruiseSpeed;
    if (!held) for (const v of this.caps.values()) if (v < target) target = v;
    this.roadSpeed = approach(this.roadSpeed, Math.max(0, target), held ? RING.holdDecel : RING.speedAccel);
    this.world.camera.x += this.roadSpeed;
    this.view.update(this);
    this.updateBosses();
    if (held || this.state !== 'playing') return;
    if (this.locks.size === 0 && !this.planEnded) this.planDist = Math.min(this.plan.length, this.planDist + this.roadSpeed);
    while (this.cursor < this.queue.length && this.triggers[this.cursor] <= this.planDist) this.spawnEntry(this.queue[this.cursor++]);
    this.checkStretch();
    this.checkBossSlots();
    if (!this.planEnded && this.planDist >= this.plan.length) {
      this.planEnded = true;
      this.events.emit('planEnd', { length: this.plan.length });
      if (RING_HOOKS.planEnd) RING_HOOKS.planEnd(this);
      else this.completeMission();
    }
  }

  /** Shots that left the road band are gone (spec §3). */
  private afterWorld(): void {
    const shots = this.world.byTag('shot');
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (s.alive && !inRoadBand(s.y, 4)) s.remove();
    }
  }

  /** Spawn one plan entry (unknown ids are skipped and counted). Returns the entity or null. */
  spawnEntry(s: RingSpawn): Entity | null {
    if (!hasEntity(s.id)) {
      this.skipped.set(s.id, (this.skipped.get(s.id) ?? 0) + 1);
      if (!warnedIds.has(s.id)) {
        warnedIds.add(s.id);
        console.warn(`[ring] plan entry "${s.id}" is not registered — skipped`);
      }
      return null;
    }
    const cam = this.world.camera;
    const y = s.y ?? laneY(s.lane ?? 2);
    const x = s.from === 'behind' ? cam.x - RING.spawnBehind : this.worldX(s.at);
    this.spawned++;
    return this.world.spawn(s.id, x, y, s.params);
  }

  /** Enter every stretch whose start the plan cursor passed. */
  private checkStretch(): void {
    const list = this.plan.stretches;
    let i = this.stretchIndex;
    while (i + 1 < list.length && this.planDist >= list[i + 1].start) i++;
    if (i < 0 && list.length) i = 0;
    if (i === this.stretchIndex) return;
    this.stretchIndex = i;
    const st = list[i];
    this.sectionRef.id = st.id;
    this.session.sectionId = st.id;
    this.visited.push(st.id);
    for (const s of this.session.slots) if (s.joined && !s.mission.route.includes(st.id)) s.mission.route.push(st.id);
    this.events.emit('stretch', { id: st.id, index: i });
    this.events.emit('sectionLoaded', { id: st.id });
  }

  private checkBossSlots(): void {
    while (this.bossCursor < this.bossRuns.length && this.planDist >= this.bossRuns[this.bossCursor].slot.at) {
      const run = this.bossRuns[this.bossCursor++];
      const id = run.slot.id;
      if (!hasEntity(id)) {
        this.skipped.set(id, (this.skipped.get(id) ?? 0) + 1);
        this.events.emit('bossSlot', { id, at: run.slot.at, spawned: false });
        continue;
      }
      const cam = this.world.camera;
      run.entity = this.world.spawn(id, cam.right + RING.spawnAhead, laneY(run.slot.lane ?? 1), run.slot.params);
      this.lockPlan(run.key);
      this.events.emit('bossSlot', { id, at: run.slot.at, spawned: true });
    }
  }

  /** A boss slot's lock ends when its boss is gone (dead or removed). */
  private updateBosses(): void {
    for (let i = 0; i < this.bossCursor; i++) {
      const run = this.bossRuns[i];
      if (run.entity && !run.entity.alive) {
        run.entity = null;
        this.unlockPlan(run.key);
      }
    }
  }

  // ------------------------------------------------------------------------------- RingHost

  get camX(): number {
    return this.world.camera.x;
  }

  /** Plan distance of a world x near the view. */
  planX(worldX: number): number {
    return this.planDist + (worldX - this.world.camera.x);
  }

  /** World x of a plan distance near the view. */
  worldX(planX: number): number {
    return this.world.camera.x + (planX - this.planDist);
  }

  /** The plan is locked (a boss): the road scrolls, the plan does not. */
  get planLocked(): boolean {
    return this.locks.size > 0;
  }

  lockPlan(key: string): void {
    this.locks.add(key);
  }

  unlockPlan(key: string): void {
    this.locks.delete(key);
  }

  /** Cap the road speed under `key` (the jam controller); null removes the cap. */
  limitSpeed(key: string, max: number | null): void {
    if (max === null) this.caps.delete(key);
    else this.caps.set(key, Math.max(0, max));
  }

  /** Open lanes at a world x: 3 inside a 3-lane landmark (tunnels) or chunk, else 4. */
  lanesOpenAt(worldX: number): number {
    return this.lanesOpenAtPlan(this.planX(worldX));
  }

  /** Open lanes at a plan distance. */
  lanesOpenAtPlan(d: number): number {
    for (const l of this.plan.landmarks) if (l.lanes === 3 && d >= l.start && d < l.start + l.length) return 3;
    const c = this.chunkAtPlan(d);
    return c && c.lanes === 3 ? 3 : 4;
  }

  /** Lanes (1 … 4) closed at a plan distance (gantry closures, road works; from the plan). */
  closedLanesAtPlan(d: number): readonly number[] {
    const c = this.chunkAtPlan(d);
    return c && c.closed && c.closed.length ? c.closed : NO_LANES;
  }

  /** The plan chunk at a plan distance: a binary search (the chunks cover the plan in order). */
  private chunkAtPlan(d: number): RingChunk | null {
    const chunks = this.plan.chunks;
    const i = chunkIndexAt(chunks, d);
    if (i >= 0) return chunks[i];
    // Hand-made plans (tests) may leave gaps or overlap: a scan then.
    for (const c of chunks) if (d >= c.start && d < c.start + c.length) return c;
    return null;
  }

  /** A fine for a slot (spec §7.4): −points (never below 0), `BOETE!` and the 'fine' event. */
  fine(slot: number, reason = 'BOETE!', points: number = RING.finePoints): void {
    const s = this.session.slot(slot);
    if (!s || !s.joined || this.state !== 'playing') return;
    s.addScore(-points);
    this.fines++;
    this.hud.message(s.index, reason, 90, 0xff5040ff);
    const p = this.player(slot);
    if (p) this.hud.popup(p.x, p.y - 44, `-${points}`);
    this.events.emit('fine', { slot: s.index, points, reason });
  }

  /** The current stretch (null before the start). */
  get stretch(): RingStretch | null {
    return this.plan.stretches[this.stretchIndex] ?? null;
  }

  /** The current stretch as a section-like object (`{ id }`) for code written against MissionRunner. */
  get section(): { readonly id: string } {
    return this.sectionRef;
  }

  // ------------------------------------------------------------------------------- the end

  /** Mission accomplished: the victory drive, banner, jingle; then 'complete'. */
  completeMission(): void {
    if (this.state !== 'playing') return;
    this.state = 'victory';
    this.victoryT = 0;
    for (const p of this.players) {
      const v = p.wagon;
      if (p.state === 'mounted' && v && v.cells >= v.maxCells) p.slot.mission.noScratches = true;
      p.victory();
    }
    this.cont.hold(false);
    this.hud.hideGo();
    this.hud.showBanner('MISSION COMPLETE!', { style: 'mission', ticks: TUNING.transition.victoryTicks });
    this.stopLoops(40);
    this.playMusic('mission-complete');
    this.audio.voice(this.mission.clearLine);
    this.session.completed.push(this.mission.id);
  }

  /** The mission after the ring (null: the scene goes on to the glitch bridge). */
  nextMission(): string | null {
    return this.mission.next ?? null;
  }

  /** Debug F4: kill the bosses on screen, else jump to the next stretch, else finish. */
  skip(): void {
    if (this.state !== 'playing') return;
    const bosses = this.world.byTag('boss').filter((b) => b.alive);
    if (bosses.length) {
      for (const b of bosses) {
        if (b instanceof Boss) b.kill(0);
        else this.world.damage(b, { amount: 1e9, kind: 'explosion', dirX: 0, owner: 0 });
      }
      return;
    }
    const next = this.plan.stretches[this.stretchIndex + 1];
    if (next) this.jumpTo(next.start);
    else this.completeMission();
  }

  /**
   * Move the plan cursor to `d` (debug skip, tools): entries before it are skipped, road entries
   * already in or ahead of the view come in.
   */
  jumpTo(d: number): void {
    this.planDist = Math.max(this.planDist, Math.min(this.plan.length, d));
    while (this.cursor < this.queue.length && this.triggers[this.cursor] <= this.planDist) {
      const s = this.queue[this.cursor++];
      if (s.from !== 'behind' && s.at >= this.planDist) this.spawnEntry(s);
    }
    while (this.bossCursor < this.bossRuns.length && this.bossRuns[this.bossCursor].slot.at < this.planDist) this.bossCursor++;
    this.checkStretch();
  }

  /** Timer counts left: the ring has no timer. */
  get timeLeft(): number {
    return Infinity;
  }

  // ------------------------------------------------------------------------------- drawing

  /** Art density of the drawing now: min(the mission's 4, `artTier()`). */
  get artDensity(): ArtDensity {
    const t = artTier();
    return t < this.density ? t : this.density;
  }

  get maxArtDensity(): ArtDensity {
    return this.density;
  }

  /** Background clear colour. */
  get sky(): number {
    return this.view.sky;
  }

  /** The ring has no section fade. */
  get fadeAlpha(): number {
    return 0;
  }

  /**
   * Road → shadow pass → entities sorted by `y · 100 + z` (shots raised by their lift) →
   * particles → front layer → light (spec §13). The HUD is the scene's.
   */
  draw(r: Renderer): void {
    withArtDensity(this.artDensity, () => {
      const cam = this.world.camera;
      const vx = cam.viewX;
      const vy = cam.viewY;
      r.setCamera(vx, vy);
      this.view.drawBack(r, this);
      const list = this.world.entities;
      for (let i = 0; i < list.length; i++) if (!list[i].removed) drawRingShadow(r, list[i]);
      const dl = this.drawList;
      const keys = this.drawKeys;
      dl.length = 0;
      keys.length = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.removed) continue;
        // Insertion by key (ties keep the world order: oldest first).
        const k = e.y * 100 + e.z;
        let j = dl.length;
        dl.push(e);
        keys.push(k);
        while (j > 0 && keys[j - 1] > k) {
          dl[j] = dl[j - 1];
          keys[j] = keys[j - 1];
          j--;
        }
        dl[j] = e;
        keys[j] = k;
      }
      for (let i = 0; i < dl.length; i++) {
        const e = dl[i];
        const lift = e.hasTag('shot') ? shotLiftOf(e) : 0;
        if (lift !== 0) r.setCamera(vx, vy + lift);
        try {
          e.draw(r);
        } catch (err) {
          this.world.reportError(`${e.type || 'entity'}.draw`, err);
        }
        if (lift !== 0) r.setCamera(vx, vy);
      }
      this.world.particles.draw(r);
      this.view.drawFront(r, this);
      this.view.drawLight(r, this);
    });
  }

  // ------------------------------------------------------------------------------- sound

  /** Change the song (null = stop); ring song ids fall back while undefined (`ringSong`). */
  playMusic(id: string | null, fadeTicks = 30, o: { from?: number; restart?: boolean } = {}): void {
    const song = ringSong(id);
    if (song === this.music && !o.restart) return;
    this.music = song;
    this.musicFrom = song ? o.from : undefined;
    const opts: { fadeTicks: number; from?: number; restart?: boolean } = { fadeTicks };
    if (o.from !== undefined) opts.from = o.from;
    if (o.restart) opts.restart = true;
    this.audio.music(song || null, opts);
  }

  get currentMusic(): string | null {
    return this.music;
  }

  resumeMusic(fadeTicks = 20): void {
    const o: { fadeTicks: number; restart: boolean; from?: number } = { fadeTicks, restart: false };
    if (this.musicFrom !== undefined) o.from = this.musicFrom;
    this.audio.music(this.music || null, o);
  }

  /** An ambience loop under the audio key 'ambience' (null fades it out). */
  setAmbience(id: string | null, fadeTicks = 30): void {
    if (id === this.ambience) return;
    this.ambience = id;
    if (id) this.audio.sfxLoop?.('ambience', id, { vol: 0.8 });
    else this.audio.stopSfx?.('ambience', fadeTicks);
  }

  /** The play ends (complete, quit, game over): the loops stop. */
  stopLoops(fadeTicks = 30): void {
    this.setAmbience(null, fadeTicks);
    this.world.events.emit('stopLoops', { fadeTicks });
  }

  /** The view's queued art jobs are of no use any more (the scene's exit). */
  dispose(): void {
    this.view.dispose();
  }

  // ------------------------------------------------------------------------------- report

  /** The sim's numbers for this run (`tools/sim.ts --mission ring`). */
  report(): RingReport {
    const slots = this.session.slots.filter((s) => s.joined);
    const sum = (f: (s: PlayerSlot) => number): number => slots.reduce((a, s) => a + f(s), 0);
    const skipped: Record<string, number> = {};
    for (const [id, n] of [...this.skipped].sort((a, b) => (a[0] < b[0] ? -1 : 1))) skipped[id] = n;
    return {
      mission: this.mission.id,
      seed: this.seed,
      difficulty: this.plan.difficulty,
      players: slots.length,
      ticks: this.ticks,
      distance: Math.round(this.planDist - this.startDist),
      roadDistance: Math.round(this.world.camera.x),
      planLength: this.plan.length,
      landmarks: [...this.visited],
      kills: sum((s) => s.stats.kills),
      deaths: sum((s) => s.stats.deaths),
      wrecks: this.wrecks,
      fines: this.fines,
      hostages: this.hostages,
      continues: sum((s) => s.continues),
      score: sum((s) => s.score),
      complete: this.state === 'victory' || this.state === 'complete',
      gameOver: this.state === 'gameover',
      spawned: this.spawned,
      skipped,
      bosses: this.bossRuns.filter((_, i) => i < this.bossCursor).map((b) => ({ id: b.slot.id, spawned: hasEntity(b.slot.id) })),
      errors: [...this.world.errors],
      maxEntities: this.maxEntities,
    };
  }
}

const NO_LANES: readonly number[] = Object.freeze([]);
