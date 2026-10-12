/**
 * Mission runtime (docs/ARCHITECTURE.md §6, §6.2): loads sections into fresh Worlds, places the
 * players, runs the section script with a `SectionContext`, handles exits (route choices) with
 * fades, checkpoints (x, or y in vertical sections), the section timer, auto-scroll, vehicles
 * carried between sections (only into sections that allow them), section respawn rules and start
 * vehicles, the default vertical respawn rule, invisible body walls, campaign records (via the
 * session), mission stats for the tally, mission complete and game-over hooks. Pure (no DOM): the
 * Gameplay scene, tests and headless tools drive it.
 *
 * ```ts
 * const runner = new MissionRunner({ session, mission: 'm1', pads: [input.pad(0), input.pad(1)], audio });
 * runner.events.on('complete', () => …);   // after the victory poses → tally
 * runner.events.on('gameOver', () => …);   // every player is out → continue screen
 * runner.start();
 * // every tick:  runner.update();     every frame:  r.begin(runner.sky); runner.draw(r);
 * ```
 */
import { NullAudio, type AudioOut } from '../../engine/audio';
import { EventBus } from '../../engine/events';
import type { Entity } from '../../engine/entity';
import type { VirtualPad } from '../../engine/input';
import { contains, overlaps } from '../../engine/math';
import { pushX } from '../../engine/physics';
import type { Renderer } from '../../engine/render';
import { hashString } from '../../engine/rng';
import type { ScriptGen, Wait } from '../../engine/script';
import { Terrain, terrain as terrainBuilder } from '../../engine/terrain';
import { World } from '../../engine/world';
import { Boss } from '../boss';
import { attachGame, HudState, type BannerOpts, type CalloutOpts, type GameContext, type GoDir } from '../context';
import { floorY, offscreenX, findFloor } from '../enemy';
import { Player } from '../player/player';
import { gameEntityFactory, getMission, listMissions, type SpawnParams } from '../registry';
import type { CampaignRecords, GameSession, PlayerSlot, SlotIndex } from '../session';
import { DEFAULT_SETTINGS, shakeScaleOf, type GameSettings } from '../settings';
import { TUNING } from '../tuning';
import { Vehicle } from '../vehicle';
import type {
  BodyWall,
  BodyWallOpts,
  BossIntroOpts,
  EnterOpts,
  EntrySide,
  ExitDef,
  MissionDef,
  MusicCallOpts,
  RespawnSpot,
  SectionContext,
  SectionDef,
  SpawnGroupOpts,
  TimerControl,
  TransitionKind,
} from './types';
import { SectionView } from './view';

export type RunnerState = 'playing' | 'exiting' | 'entering' | 'victory' | 'complete' | 'gameover';

export interface RunnerEvents {
  /** A section finished loading (players placed, script started). */
  sectionLoaded: { id: string };
  /** Victory poses are over: show the tally. */
  complete: { mission: string };
  /** Every joined player is out of lives. */
  gameOver: { mission: string };
  /** One player is out while another still plays (inline continue countdown starts). */
  playerOut: { slot: SlotIndex };
}

export interface RunnerOptions {
  session: GameSession;
  /** Mission id or definition. Unknown ids give a placeholder mission. */
  mission: string | MissionDef;
  /** Start section (default: the mission's start, or its boss section with `bossRush`). */
  section?: string;
  pads: readonly [VirtualPad, VirtualPad];
  audio?: AudioOut;
  /** World seed (default: the session seed). */
  seed?: number;
  /** ?boss=1: start at the boss. */
  bossRush?: boolean;
  /** Player options (speech bubbles, shake …); default DEFAULT_SETTINGS. */
  settings?: GameSettings;
}

interface PendingExit {
  to: string;
  entry?: { x: number; y: number };
  transition: TransitionKind;
}

/** A wait that never ends (the script stops when its section unloads). */
const NEVER: Wait = () => false;

export class MissionRunner {
  readonly session: GameSession;
  readonly mission: MissionDef;
  readonly audio: AudioOut;
  readonly pads: readonly [VirtualPad, VirtualPad];
  readonly hud = new HudState();
  readonly events = new EventBus<RunnerEvents>();
  readonly seed: number;
  readonly bossRush: boolean;
  readonly settings: GameSettings;
  world!: World;
  section!: SectionDef;
  view!: SectionView;
  /** The game context of the current section's world. */
  game!: GameContext;
  players: Player[] = [];
  state: RunnerState = 'playing';
  /** Last checkpoint (respawn reference). */
  checkpoint = { x: 0, y: 0 };
  /** Ticks since start (for HUD blinking, tally timings: 60 per second). */
  ticks = 0;
  /** Inline continue countdowns (ticks) per slot while another player keeps playing; -1 = none. */
  readonly continueTicks: [number, number] = [-1, -1];
  /** Invisible body walls of the current section (`ctx.bodyWall`); cleared on every section load. */
  readonly bodyWalls: BodyWall[] = [];

  private readonly startSection: string | undefined;
  private fadeT = 0;
  private fadeLen = TUNING.transition.fadeTicks;
  private pending: PendingExit | null = null;
  private victoryT = 0;
  private timerLimit = 0;
  private timerCounts = 0;
  private timerTicks = 0;
  private timerPaused = false;
  private nextCheckpoint = 0;
  private readonly exitOn = new Map<ExitDef, boolean>();
  private music: string | null = null;
  private musicFrom: number | undefined = undefined;
  /** Boss-fight timing over the boss sections: start tick of the running fight, ticks so far. */
  private fightStart = -1;
  private fightTicks = 0;
  private ctx!: SectionCtx;
  /** Auto-scroll speed (px/tick; 0 = off) and the scrolled window position. */
  private autoSpeed = 0;
  private autoPos = 0;

  constructor(o: RunnerOptions) {
    this.session = o.session;
    this.mission = typeof o.mission === 'string' ? (getMission(o.mission) ?? placeholderMission(o.mission)) : o.mission;
    this.audio = o.audio ?? new NullAudio();
    this.pads = o.pads;
    this.seed = (o.seed ?? o.session.seed) >>> 0;
    this.bossRush = o.bossRush ?? false;
    this.settings = o.settings ?? { ...DEFAULT_SETTINGS };
    this.startSection = o.section;
  }

  /** Load the first section and show the mission banner. */
  start(): void {
    const m = this.mission;
    this.session.startMission(m.id);
    this.fightStart = -1;
    this.fightTicks = 0;
    let id = this.startSection ?? (this.bossRush ? (m.bossSection ?? m.start) : m.start);
    if (!m.sections[id]) id = m.start;
    // Banner first, so a section script may replace it on its first tick.
    const b = m.startBanner;
    this.hud.showBanner(b?.text ?? m.name, { sub: b?.sub ?? m.subtitle ?? '', style: 'mission', ticks: 170 });
    this.audio.voice(m.announce ?? 'Move out!');
    this.loadSection(id);
  }

  // ------------------------------------------------------------------------------- sections

  /** Build a section's world and start its script. `entry` overrides the player start. */
  loadSection(id: string, entry?: { x: number; y: number }): void {
    const def = this.mission.sections[id] ?? placeholderSection(id, `section ${id} not found`);
    if (this.world) {
      this.carryVehicles(def);
      this.world.scripts.cancelAll();
      this.world.events.clear();
    }
    const seed = (this.seed ^ hashString(`${this.mission.id}/${def.id}`)) >>> 0;
    const terrain = new Terrain(def.terrain);
    const world = new World({ terrain, seed, factory: gameEntityFactory, audio: this.audio });
    this.game = attachGame(world, this.session, this.hud, this.settings);
    this.game.runner = this;
    this.game.ice = def.iceRanges ?? [];
    const cam = world.camera;
    const C = TUNING.camera;
    cam.scroll = def.scroll;
    cam.setBounds({ x: 0, y: 0, w: def.width, h: def.height });
    cam.lead = C.lead;
    cam.offsetY = def.scroll === 'down' ? C.offsetYDown : C.offsetY;
    cam.deadZoneY = C.deadZoneY;
    cam.margin = C.margin;
    cam.smoothing = C.smoothing;
    cam.maxSpeed = C.maxSpeed;
    cam.shakeScale = shakeScaleOf(this.settings.screenShake);
    this.world = world;
    this.section = def;
    this.view = new SectionView(def, terrain, seed);
    this.exitOn.clear();
    for (const ex of def.exits ?? []) this.exitOn.set(ex, !ex.disabled);
    this.nextCheckpoint = 0;
    this.autoSpeed = 0;
    this.bodyWalls.length = 0;
    this.fightStart = -1;
    // A slot that is out keeps its inline continue countdown into the next section (2P).
    for (const slot of this.session.slots) if (slot.active) this.continueTicks[slot.index] = -1;
    for (const slot of this.session.slots) if (slot.joined) slot.mission.route.push(def.id);
    this.players = [];
    this.ctx = new SectionCtx(this, def);
    const start = entry ?? (this.bossRush && def.bossStart ? def.bossStart : def.playerStart);
    this.checkpoint = { x: start.x, y: start.y };
    for (const slot of this.session.slots) if (slot.active) this.spawnPlayer(slot, start.x, start.y);
    world.flush();
    cam.follow(world.players);
    cam.snap();
    this.view.prepare(cam.x, cam.y);
    this.wire(world);
    this.resetTimer();
    this.timerPaused = false;
    this.playMusic(def.music ?? this.mission.music);
    this.session.sectionId = def.id;
    const ctx = this.ctx;
    world.scripts.run(() => def.script(ctx), { name: `section ${this.mission.id}/${def.id}` });
    this.events.emit('sectionLoaded', { id: def.id });
  }

  private spawnPlayer(slot: PlayerSlot, x: number, y: number): Player {
    const px = slot.index === 1 ? x - 20 : x;
    const p = new Player(this.world, px, y, { pad: this.pads[slot.index], index: slot.index, slot });
    this.wirePlayer(p);
    this.world.add(p);
    p.placeAt(px, y);
    this.players.push(p);
    // A vehicle carried over from the last section, else the section's start vehicle.
    const carry = slot.vehicle;
    slot.vehicle = null;
    const v = carry ? this.world.spawn(carry.id, px, y) : this.section.startVehicle ? this.world.spawn(this.section.startVehicle, px, y) : null;
    if (v instanceof Vehicle) {
      if (carry) v.applyCarry(carry);
      v.mount(p);
    }
    return p;
  }

  /**
   * Respawn references and the section's respawn rule for a new Player of this section. Vertical
   * sections without their own rule use `verticalRespawn` (GDD §11.0).
   */
  private wirePlayer(p: Player): void {
    p.respawnAt = () => this.checkpoint;
    const rule = this.section.respawn;
    const ctx = this.ctx;
    if (rule) p.respawnRule = (pl) => rule(pl, ctx) ?? (this.vertical ? this.verticalRespawn(pl) : null);
    else p.respawnRule = this.vertical ? (pl) => this.verticalRespawn(pl) : null;
  }

  /**
   * GDD §11.0, vertical sections: the drop-in lands on a moving platform in view if there is one
   * (the moving dynamic solid nearest the death x; its position is predicted for the end of the
   * drop), else on the lowest free floor in view (nearest the death x on equal height). Null =
   * the normal rule (nearest safe floor, then the checkpoint).
   */
  verticalRespawn(p: Player): RespawnSpot | null {
    const cam = this.world.camera;
    const L = TUNING.life;
    const lo = cam.left + 16;
    const hi = cam.right - 16;
    const top = cam.top + 40;
    const bottom = cam.bottom - 4;
    // 1. A moving platform (a dynamic solid that moved on its last step).
    let best: RespawnSpot | null = null;
    let bestD = Infinity;
    for (const s of this.world.solids) {
      if (!s.enabled || s.w < 16 || (s.dx === 0 && s.dy === 0) || s.owner === p) continue;
      // Ticks of the drop from above the view to this floor, then where the box will be.
      let y = s.y;
      let t = dropTicks(cam.top - L.respawnHeight, y, L.respawnFallSpeed);
      y = s.y + s.dy * t;
      t = dropTicks(cam.top - L.respawnHeight, y, L.respawnFallSpeed);
      y = s.y + s.dy * t;
      const x0 = s.x + s.dx * t;
      if (y < top || y > bottom || x0 + s.w < lo || x0 > hi) continue;
      const x = Math.max(Math.max(lo, x0 + 8), Math.min(Math.min(hi, x0 + s.w - 8), p.x));
      const d = Math.abs(x - p.x);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    if (best) return best;
    // 2. The lowest free floor in view.
    const t = this.world.terrain;
    const T = TUNING.player;
    const probe = { x: 0, y: 0, w: 16, h: 32 };
    let bx = 0;
    let by = -Infinity;
    for (let x = lo; x <= hi; x += 8) {
      let y = t.surfaceY(x, top, bottom);
      let low = -Infinity;
      while (Number.isFinite(y)) {
        probe.x = x - 8;
        probe.y = y - 30;
        const free = !t.solidOverlaps(x - T.bodyW / 2 + 0.01, y - T.bodyH + 0.01, x + T.bodyW / 2 - 0.01, y - 0.01) && !t.hazardAt(probe);
        if (free) low = y;
        y = t.surfaceY(x, y + 1, bottom);
      }
      if (low > by || (low === by && Math.abs(x - p.x) < Math.abs(bx - p.x))) {
        by = low;
        bx = x;
      }
    }
    return Number.isFinite(by) ? { x: bx, y: by } : null;
  }

  /**
   * Remember mounted vehicles in the session so the next section rebuilds them — only when the
   * next section lists them (GDD §4.8); otherwise the pilot arrives on foot. A vehicle section
   * left at full cells earns NO SCRATCHES.
   */
  private carryVehicles(next: SectionDef): void {
    for (const p of this.players) {
      if (p.state !== 'mounted' || !(p.vehicle instanceof Vehicle)) continue;
      const v = p.vehicle;
      if (v.cells >= v.maxCells) p.slot.mission.noScratches = true;
      if (next.vehicles?.includes(v.type) && next.startVehicle !== v.type) p.slot.vehicle = v.toCarry();
    }
  }

  private wire(world: World): void {
    world.events.on('playerDied', () => this.resetTimer());
    world.events.on('playerOut', (e) => this.onPlayerOut(e.slot as SlotIndex));
    world.events.on('playerSpawned', (e) => {
      if (e.respawn) this.giveStartVehicle(e.player);
    });
    world.events.on('score', (e) => {
      if (e.x !== undefined && e.y !== undefined) this.hud.popup(e.x, e.y, String(e.points));
    });
    world.events.on('enemyKilled', (e) => {
      const slot = this.session.slot(e.player);
      if (slot) slot.mission.kills[e.enemy.type] = (slot.mission.kills[e.enemy.type] ?? 0) + 1;
    });
    world.events.on('pickup', (e) => {
      const kind = (e.item as Entity & { params?: SpawnParams }).params?.kind;
      if (kind === 'golden-record') e.player.slot.mission.goldenRecord = true;
    });
    world.events.on('bossPhase', (e) => {
      if (e.phase !== 0 || !this.isBossSection) return;
      if (this.fightStart < 0) this.fightStart = this.ticks;
      for (const s of this.session.slots) if (s.mission.bossStartTick < 0) s.mission.bossStartTick = this.ticks;
    });
    world.events.on('bossDefeated', () => {
      const bossFight = this.isBossSection;
      if (bossFight && this.fightStart >= 0) {
        // Several boss fights (bossSections): the speed bonus counts the fights, not the walk.
        this.fightTicks += this.ticks - this.fightStart;
        this.fightStart = -1;
      }
      for (const s of this.session.slots) {
        if (!bossFight) continue;
        const st = s.mission;
        st.bossEndTick = st.bossStartTick >= 0 && this.fightTicks > 0 ? st.bossStartTick + this.fightTicks : this.ticks;
      }
      for (const p of this.players) {
        if (p.state === 'mounted' && p.vehicle instanceof Vehicle) {
          p.slot.bonus.vehicle += p.vehicle.bonus;
          if (bossFight) p.slot.mission.vehicleAtFinish = true;
        }
      }
    });
  }

  /** Is this one of the mission's boss sections (BOSS SPEED BONUS timing)? */
  private get isBossSection(): boolean {
    const list = this.mission.bossSections;
    if (list && list.length) return list.includes(this.section.id);
    return !this.mission.bossSection || this.mission.bossSection === this.section.id;
  }

  /** Cross-section / cross-mission records of this game (= `session.records`). */
  get records(): CampaignRecords {
    return this.session.records;
  }

  /** SectionDef.startVehicle: a respawned player gets a new one at once (m5-a flyers). */
  private giveStartVehicle(p: Player): void {
    const id = this.section.startVehicle;
    if (!id || p.state === 'mounted') return;
    const cam = this.world.camera;
    const v = this.world.spawn(id, p.x, cam.top + 48);
    if (!(v instanceof Vehicle)) return;
    v.mount(p);
    v.invulnTicks = Math.max(v.invulnTicks, TUNING.life.respawnInvulnTicks);
  }

  // ------------------------------------------------------------------------------- tick

  update(): void {
    this.ticks++;
    this.hud.update();
    switch (this.state) {
      case 'playing':
        if (this.autoSpeed !== 0) this.advanceAutoScroll();
        this.world.update();
        this.applyBodyWalls();
        this.updateTimer();
        this.updateCheckpoints();
        this.checkExits();
        this.updateContinues();
        break;
      case 'entering':
        this.world.update();
        this.applyBodyWalls();
        if (++this.fadeT >= this.fadeLen) this.state = 'playing';
        break;
      case 'exiting':
        if (++this.fadeT >= this.fadeLen) this.switchSection();
        break;
      case 'victory':
        this.world.update();
        this.applyBodyWalls();
        if (++this.victoryT >= TUNING.transition.victoryTicks) {
          this.state = 'complete';
          this.events.emit('complete', { mission: this.mission.id });
        }
        break;
      case 'gameover':
      case 'complete':
        break;
    }
  }

  /** Draw scenery, entities and the transition fade (the HUD is drawn by the scene). */
  draw(r: Renderer): void {
    const cam = this.world.camera;
    r.setCamera(cam.renderX, cam.renderY);
    this.view.drawBack(r, this.ticks);
    this.world.draw(r);
    this.view.drawFront(r, this.ticks);
    const a = this.fadeAlpha;
    if (a > 0) r.fade(0x000000ff, a);
  }

  /** Background clear colour of the current section. */
  get sky(): number {
    return this.view?.sky ?? 0x000000ff;
  }

  /** 0..1 cover of the section-transition fade. */
  get fadeAlpha(): number {
    if (this.state === 'exiting') return Math.min(1, this.fadeT / this.fadeLen);
    if (this.state === 'entering') return Math.max(0, 1 - this.fadeT / this.fadeLen);
    return 0;
  }

  player(slot: number): Player | undefined {
    return this.players.find((p) => p.index === slot);
  }

  // ------------------------------------------------------------------------------- camera

  /**
   * Auto-scroll (GDD §4.12): move the camera's lock window `speed` px/tick in the section's
   * scroll direction ('right' / 'free': right; 'up' / 'down': vertically). 0 stops it and the
   * view holds where it is; lockCamera / unlockCamera cancel it.
   */
  autoScroll(speed: number): void {
    const cam = this.world.camera;
    this.autoSpeed = Math.max(0, speed);
    if (this.autoSpeed === 0) return;
    this.autoPos = this.vertical ? cam.y : cam.x;
    cam.smoothing = 1; // the view follows the window exactly (no lag behind the scroll)
    this.applyAutoLock();
  }

  /** Stop auto-scrolling (camera locks and unlocks do this) and restore the normal smoothing. */
  stopAutoScroll(): void {
    if (this.autoSpeed === 0 && this.world.camera.smoothing === TUNING.camera.smoothing) return;
    this.autoSpeed = 0;
    this.world.camera.smoothing = TUNING.camera.smoothing;
  }

  /** Is auto-scroll running? */
  get autoScrolling(): boolean {
    return this.autoSpeed !== 0;
  }

  // ------------------------------------------------------------------------------- body walls

  /** Add an invisible body wall (see BodyWallOpts); it lasts until removed or the section ends. */
  addBodyWall(x: number, o: BodyWallOpts = {}): BodyWall {
    const list = this.bodyWalls;
    const wall: BodyWall = {
      x,
      enabled: true,
      opts: o,
      remove(): void {
        const i = list.indexOf(wall);
        if (i >= 0) list.splice(i, 1);
      },
    };
    list.push(wall);
    return wall;
  }

  /** Does a body wall stand between x0 and x1 for this entity (a ram, a dive asks)? */
  bodyWallBetween(e: Entity, x0: number, x1: number): BodyWall | null {
    for (const w of this.bodyWalls) {
      if (!w.enabled || !wallApplies(w, e)) continue;
      if ((x0 < w.x && x1 >= w.x) || (x0 > w.x && x1 <= w.x)) return w;
    }
    return null;
  }

  private applyBodyWalls(): void {
    const walls = this.bodyWalls;
    if (walls.length === 0) return;
    const w = this.world;
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i];
      if (!wall.enabled) continue;
      const o = wall.opts;
      if (o.players !== false) {
        for (const p of this.players) {
          if (!p.alive || p.state === 'mounted' || p.state === 'out' || p.state === 'dead') continue;
          clampToWall(w, wall, p, p.body.w / 2);
        }
      }
      if (o.vehicles !== false) {
        const list = w.byTag('vehicle');
        for (let k = 0; k < list.length; k++) {
          const v = list[k];
          if (!(v instanceof Vehicle) || !v.alive) continue;
          const dx = clampToWall(w, wall, v, (v.body?.w ?? v.hitbox.w) / 2);
          if (dx !== 0 && v.driver) v.driver.x += dx;
        }
      }
    }
  }

  private get vertical(): boolean {
    return this.section.scroll === 'up' || this.section.scroll === 'down';
  }

  private advanceAutoScroll(): void {
    const cam = this.world.camera;
    const b = cam.bounds;
    if (this.vertical) {
      const dir = this.section.scroll === 'up' ? -1 : 1;
      this.autoPos = Math.max(b.y, Math.min(b.y + b.h - cam.h, this.autoPos + dir * this.autoSpeed));
    } else {
      this.autoPos = Math.max(b.x, Math.min(b.x + b.w - cam.w, this.autoPos + this.autoSpeed));
    }
    this.applyAutoLock();
  }

  private applyAutoLock(): void {
    const cam = this.world.camera;
    if (this.vertical) cam.lock(-Infinity, Infinity, this.autoPos, this.autoPos + cam.h);
    else cam.lock(this.autoPos, this.autoPos + cam.w);
  }

  // ------------------------------------------------------------------------------- exits & completion

  /**
   * Exits: a player's feet (on foot) or the vehicle's hitbox (riding) inside an open exit rect
   * takes the whole team there (GDD §4.8).
   */
  private checkExits(): void {
    const exits = this.section.exits;
    if (!exits) return;
    for (const ex of exits) {
      if (!this.exitOn.get(ex)) continue;
      for (const p of this.players) {
        const inside =
          (p.state === 'play' && contains(ex.rect, p.x, p.y - 1)) ||
          (p.state === 'mounted' && p.vehicle !== null && overlaps(ex.rect, p.vehicle.hitRect()));
        if (inside) {
          this.exitTo(ex.to, ex);
          return;
        }
      }
    }
  }

  enableExit(id: string, on: boolean): void {
    for (const ex of this.section.exits ?? []) if (ex.id === id) this.exitOn.set(ex, on);
  }

  /** Is an exit (by id or definition) open right now? (Bots and HUD cues read this.) */
  isExitOpen(ex: ExitDef | string): boolean {
    if (typeof ex === 'string') {
      for (const e of this.section.exits ?? []) if (e.id === ex) return this.exitOn.get(e) === true;
      return false;
    }
    return this.exitOn.get(ex) === true;
  }

  /** Leave for another section ('complete' = finish the mission) with a fade or a cut. */
  exitTo(to: string, o: { transition?: TransitionKind; entry?: { x: number; y: number } } = {}): void {
    if (this.state !== 'playing' && this.state !== 'entering') return;
    const transition = o.transition ?? 'fade';
    this.pending = { to, entry: o.entry, transition };
    this.state = 'exiting';
    this.fadeT = 0;
    this.fadeLen = transition === 'cut' ? 1 : Math.max(2, Math.floor(TUNING.transition.fadeTicks / 2));
    this.world.events.emit('sectionExit', { from: this.section.id, to });
  }

  private switchSection(): void {
    const p = this.pending;
    this.pending = null;
    if (!p) {
      this.state = 'playing';
      return;
    }
    if (p.to === 'complete') {
      this.state = 'complete';
      this.session.completed.push(this.mission.id);
      this.events.emit('complete', { mission: this.mission.id });
      return;
    }
    this.loadSection(p.to, p.entry);
    this.state = 'entering';
    this.fadeT = 0;
  }

  /** Mission accomplished: victory poses, banner, jingle; then 'complete'. */
  completeMission(): void {
    if (this.state !== 'playing' && this.state !== 'entering') return;
    this.state = 'victory';
    this.victoryT = 0;
    this.timerPaused = true;
    this.stopAutoScroll();
    for (const p of this.players) {
      if (p.state === 'mounted' && p.vehicle instanceof Vehicle && p.vehicle.cells >= p.vehicle.maxCells) p.slot.mission.noScratches = true;
      p.victory();
    }
    this.hud.hideGo();
    this.hud.showBanner('MISSION COMPLETE!', { style: 'mission', ticks: TUNING.transition.victoryTicks });
    this.playMusic('mission-complete');
    this.audio.voice(this.mission.clearLine ?? 'Objective secured!');
    this.session.completed.push(this.mission.id);
  }

  /** The mission that follows this one (null = the game is finished). */
  nextMission(): string | null {
    if (this.mission.next) return this.mission.next;
    const ids = listMissions().filter((id) => id !== 'm0');
    const i = ids.indexOf(this.mission.id);
    return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;
  }

  /** Debug F4: next section / kill the boss / finish. */
  skip(): void {
    if (this.state !== 'playing') return;
    const ex = (this.section.exits ?? []).find((e) => this.exitOn.get(e));
    if (ex) {
      this.exitTo(ex.to, ex);
      return;
    }
    const bosses = this.world.byTag('boss').filter((b) => b.alive);
    if (bosses.length) {
      for (const b of bosses) {
        if (b instanceof Boss) b.kill(0);
        else this.world.damage(b, { amount: 1e9, kind: 'explosion', dirX: 0, owner: 0 });
      }
      return;
    }
    this.completeMission();
  }

  // ------------------------------------------------------------------------------- timer & checkpoints

  /** Refill the section timer (default: its full time limit). */
  resetTimer(counts?: number): void {
    const limit = this.section.timeLimit ?? TUNING.timer.counts;
    this.timerLimit = limit > 0 ? limit + this.session.mods.timerBonus : 0;
    this.timerCounts = counts ?? this.timerLimit;
    this.timerTicks = TUNING.timer.ticksPerCount;
  }

  /** Timer counts left (Infinity when the section has none). */
  get timeLeft(): number {
    return this.timerLimit > 0 ? this.timerCounts : Infinity;
  }

  /** Stop / restart the section timer (cut-scenes, boss entrances). */
  pauseTimer(paused = true): void {
    this.timerPaused = paused;
  }

  get timerRunning(): boolean {
    return this.timerLimit > 0 && !this.timerPaused;
  }

  /**
   * GDD §10.0: a boss entrance refills the timer and pauses it until the WARNING banner is gone
   * and no boss is still entering.
   */
  holdTimerForBoss(ticks: number): void {
    this.resetTimer();
    this.pauseTimer(true);
    const w = this.world;
    const self = this;
    let t = 0;
    w.scripts.run(
      function* bossEntranceTimer(): ScriptGen {
        yield () => ++t >= ticks && (!bossEntering(w) || t >= ticks * 4);
        self.pauseTimer(false);
      },
      { name: 'boss entrance timer' },
    );
  }

  private updateTimer(): void {
    if (this.timerLimit <= 0 || this.timerPaused) return;
    if (--this.timerTicks > 0) return;
    this.timerTicks = TUNING.timer.ticksPerCount;
    this.timerCounts--;
    // GDD §4.7: from 10 down, a warning tick on every count.
    if (this.timerCounts <= TUNING.timer.alarmAt && this.timerCounts > 0) this.audio.sfx('ui/timer-warn');
    if (this.timerCounts <= 0) this.timeOut();
  }

  /** Time is up (GDD §4.7): TIME UP!, every player on the field loses a life, the timer refills. */
  private timeOut(): void {
    this.world.events.emit('timeOut', { section: this.section.id });
    this.hud.showBanner('TIME UP!', { style: 'warning', ticks: 120 });
    this.audio.sfx('mission/time-up');
    for (const p of this.players) {
      if (p.state === 'mounted' && p.vehicle instanceof Vehicle) p.vehicle.eject('forced');
      p.kill('timeout');
    }
    this.resetTimer();
  }

  /**
   * Checkpoints: camera-centre x in horizontal sections, camera-centre y in vertical ones
   * ('up': passed when the centre is at or above y; 'down': at or below).
   */
  private updateCheckpoints(): void {
    const cps = this.section.checkpoints;
    if (!cps || this.nextCheckpoint >= cps.length) return;
    const cam = this.world.camera;
    const v = cps[this.nextCheckpoint];
    const scroll = this.section.scroll;
    const passed = scroll === 'up' ? cam.centerY <= v : scroll === 'down' ? cam.centerY >= v : cam.centerX >= v;
    if (!passed) return;
    this.nextCheckpoint++;
    if (this.vertical) this.setCheckpoint(cam.centerX, floorY(this.world, cam.centerX, v - 48));
    else this.setCheckpoint(v, floorY(this.world, v));
    this.hud.callout('CHECKPOINT');
    this.audio.sfx('mission/checkpoint');
  }

  /** A new respawn reference: the timer refills and (EASY) the hostage tallies are stored. */
  setCheckpoint(x: number, y: number): void {
    this.checkpoint = { x, y };
    this.resetTimer();
    for (const s of this.session.slots) s.checkpointRescued = s.rescued;
    this.world.events.emit('checkpoint', { x, y });
  }

  // ------------------------------------------------------------------------------- players

  private onPlayerOut(slot: SlotIndex): void {
    if (this.session.allOut) {
      this.state = 'gameover';
      this.events.emit('gameOver', { mission: this.mission.id });
    } else {
      this.continueTicks[slot] = TUNING.continues.seconds * TUNING.continues.ticksPerCount;
      this.events.emit('playerOut', { slot });
    }
  }

  /** Inline (2-player) continue countdowns: start continues, fire / jump speed it up. */
  private updateContinues(): void {
    for (let i = 0; i < 2; i++) {
      const t = this.continueTicks[i];
      if (t < 0) continue;
      const pad = this.pads[i];
      if (pad.pressed('start')) {
        this.continuePlayer(i as SlotIndex);
        continue;
      }
      const skip = pad.pressed('fire') || pad.pressed('jump') ? TUNING.continues.skipTicks : 0;
      this.continueTicks[i] = t - 1 - skip;
      if (this.continueTicks[i] < 0) this.continueTicks[i] = -1;
    }
  }

  /**
   * Use a continue for a slot that is out: lives refilled, the player drops back in. Works in a
   * later section too (an out slot has no Player there yet: one is created).
   */
  continuePlayer(slot: SlotIndex): boolean {
    let p = this.player(slot);
    const s = this.session.slots[slot];
    if (p ? p.state !== 'out' : !(s.joined && s.gameOver)) return false;
    if (!this.session.continueSlot(slot)) return false;
    this.continueTicks[slot] = -1;
    if (!p) p = this.addPlayer(slot, s);
    p.continueGame();
    if (this.state === 'gameover') this.state = 'playing';
    return true;
  }

  /** A Player for a slot that has none in this section, dropping in near the camera. */
  private addPlayer(slot: SlotIndex, s: PlayerSlot): Player {
    const cam = this.world.camera;
    const p = new Player(this.world, cam.centerX, cam.top, { pad: this.pads[slot], index: slot, slot: s });
    this.wirePlayer(p);
    this.world.add(p);
    this.players.push(p);
    return p;
  }

  /** A new player joins mid-mission (2-player mode): drops in near the camera. */
  joinPlayer(slot: SlotIndex, character: string): Player {
    const existing = this.player(slot);
    if (existing && existing.state !== 'out') return existing;
    const s = this.session.join(slot, character);
    if (existing) {
      this.continueTicks[slot] = -1;
      existing.continueGame(null);
      return existing;
    }
    this.continueTicks[slot] = -1;
    const p = this.addPlayer(slot, s);
    p.respawn();
    return p;
  }

  // ------------------------------------------------------------------------------- music

  /**
   * Change the song (null = stop). The same song again keeps playing unless `o.restart`;
   * `o.from` starts at that index of the song's order list (also used by `resumeMusic`).
   */
  playMusic(id: string | null, fadeTicks = 30, o: MusicCallOpts = {}): void {
    if (id === this.music && !o.restart) return;
    this.music = id;
    this.musicFrom = id ? o.from : undefined;
    const opts: { fadeTicks: number; from?: number; restart?: boolean } = { fadeTicks };
    if (o.from !== undefined) opts.from = o.from;
    if (o.restart) opts.restart = true;
    this.audio.music(id || null, opts);
  }

  /** The song the runner wants right now (stage, boss, clear …), or null. */
  get currentMusic(): string | null {
    return this.music;
  }

  /** Play the runner's current song again (after the continue screen played its own). */
  resumeMusic(fadeTicks = 20): void {
    const o: { fadeTicks: number; restart: boolean; from?: number } = { fadeTicks, restart: false };
    if (this.musicFrom !== undefined) o.from = this.musicFrom;
    this.audio.music(this.music || null, o);
  }
}

/** Ticks the respawn drop takes from y0 to y1 (Player.continueDrop: +0.4 per tick, max 10). */
function dropTicks(y0: number, y1: number, v0: number): number {
  let y = y0;
  let v = v0;
  let t = 0;
  while (y < y1 && t < 120) {
    y += v;
    v = Math.min(v + 0.4, 10);
    t++;
  }
  return t;
}

/** Does a body wall act on this entity (vertical span and filter)? */
function wallApplies(wall: BodyWall, e: Entity): boolean {
  const o = wall.opts;
  if (o.filter && !o.filter(e)) return false;
  const top = e.y + e.hitbox.y;
  const bottom = top + e.hitbox.h;
  return bottom > (o.y0 ?? -Infinity) && top < (o.y1 ?? Infinity);
}

/** Push a body back to its side of a wall. Returns the x change (0 when it was not past it). */
function clampToWall(world: World, wall: BodyWall, e: Entity, half: number): number {
  if (!wallApplies(wall, e)) return 0;
  const keepLeft = wall.opts.keep !== 'right';
  const limit = keepLeft ? wall.x - half : wall.x + half;
  const dx = keepLeft ? Math.min(0, limit - e.x) : Math.max(0, limit - e.x);
  if (dx === 0) return 0;
  const x0 = e.x;
  if (e.body) pushX(e, dx, world.terrain, world);
  else e.x += dx;
  // pushX stops at terrain walls; a wall clamp is absolute (like the view edge).
  if (keepLeft ? e.x > limit : e.x < limit) e.x = limit;
  if (dx * e.vx < 0) e.vx = 0;
  wall.opts.onTouch?.(e);
  return e.x - x0;
}

/** A boss in the world that has not finished its entrance yet. */
function bossEntering(w: World): boolean {
  const list = w.byTag('boss');
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b instanceof Boss && b.alive && (b.state === 'waiting' || b.state === 'intro')) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Section script context
// ---------------------------------------------------------------------------------------------

class SectionCtx implements SectionContext {
  readonly section: SectionDef;
  private readonly runner: MissionRunner;
  readonly timer: TimerControl;

  constructor(runner: MissionRunner, section: SectionDef) {
    this.runner = runner;
    this.section = section;
    const r = runner;
    this.timer = {
      get counts(): number {
        return r.timeLeft;
      },
      pause: () => r.pauseTimer(true),
      resume: () => r.pauseTimer(false),
      reset: (counts?: number) => r.resetTimer(counts),
    };
  }

  get world(): World {
    return this.runner.world;
  }

  get mission(): MissionDef {
    return this.runner.mission;
  }

  get session(): GameSession {
    return this.runner.session;
  }

  get camera(): World['camera'] {
    return this.runner.world.camera;
  }

  get rng(): World['rng'] {
    return this.runner.world.rng;
  }

  get hud(): HudState {
    return this.runner.hud;
  }

  get bossRush(): boolean {
    return this.runner.bossRush;
  }

  get players(): readonly Player[] {
    return this.runner.players;
  }

  get playerCount(): number {
    return Math.max(1, this.runner.session.activeCount);
  }

  get records(): CampaignRecords {
    return this.runner.session.records;
  }

  bodyWall(x: number, o?: BodyWallOpts): BodyWall {
    return this.runner.addBodyWall(x, o);
  }

  // ---- spawning

  private groundAt(x: number): number {
    const g = this.world.terrain.groundY(x);
    return Number.isFinite(g) ? g : floorY(this.world, x);
  }

  spawn(id: string, x: number, y: number | 'ground', params?: SpawnParams): Entity {
    return this.world.spawn(id, x, y === 'ground' ? this.groundAt(x) : y, params);
  }

  spawnGroup(id: string, count: number, o: SpawnGroupOpts): Entity[] {
    const out: Entity[] = [];
    const params = o.tag ? { ...o.params, tag: o.tag } : o.params;
    for (let i = 0; i < count; i++) {
      const x = o.x + i * (o.spacing ?? 32);
      out.push(this.spawn(id, x, o.y ?? 'ground', params));
    }
    return out;
  }

  /**
   * Spawn just outside the view. Side entries stand on a floor: over a pit the spot moves to the
   * nearest floor (outward first, so the entity still enters from off-screen); 'top' entries
   * drop onto a floor below the chosen x the same way.
   */
  enter(id: string, side: EntrySide, o: EnterOpts = {}): Entity {
    const params: SpawnParams = o.tag ? { ...o.params, tag: o.tag } : (o.params ?? {});
    const cam = this.camera;
    if (side === 'top') {
      const want = o.x ?? cam.centerX;
      const spot = o.y === undefined ? findFloor(this.world, want, { fromY: cam.top, minX: cam.left + 16, maxX: cam.right - 16 }) : null;
      const x = spot ? spot.x : want;
      return this.world.spawn(id, x, o.y ?? cam.top - (o.margin ?? 24), { enter: 'top', ...params });
    }
    let x = offscreenX(this.world, side, o.margin ?? 24);
    let y = o.y;
    if (y === undefined) {
      const dir = side === 'left' ? -1 : 1;
      const spot = findFloor(this.world, x, { fromY: cam.top, prefer: dir });
      if (spot) {
        x = spot.x;
        y = spot.y;
      } else y = floorY(this.world, x);
    }
    return this.world.spawn(id, x, y, { facing: side === 'left' ? 1 : -1, enter: side, ...params });
  }

  // ---- camera

  lockCamera(minX?: number, maxX?: number): void {
    const cam = this.camera;
    this.runner.stopAutoScroll();
    const lo = minX ?? cam.x;
    cam.lock(lo, maxX ?? lo + cam.w);
    this.hud.hideGo();
  }

  unlockCamera(go = true): void {
    this.runner.stopAutoScroll();
    this.camera.unlock();
    if (go) this.hud.showGo(this.goDir());
  }

  autoScroll(speed: number): void {
    this.runner.autoScroll(speed);
  }

  private goDir(): GoDir {
    const s = this.section.scroll;
    return s === 'up' ? 'up' : s === 'down' ? 'down' : 'right';
  }

  waitCamera(x: number): Wait {
    const cam = this.camera;
    return () => cam.x >= x;
  }

  waitCameraY(y: number): Wait {
    const cam = this.camera;
    return this.section.scroll === 'down' ? () => cam.y >= y : () => cam.y <= y;
  }

  waitPlayerX(x: number): Wait {
    const players = this.runner.players;
    return () => {
      for (const p of players) if (p.alive && p.x >= x) return true;
      return false;
    };
  }

  waitClear(tag = 'enemy'): Wait {
    const w = this.world;
    return () => w.countAlive(tag) === 0;
  }

  // ---- presentation

  showGo(dir?: GoDir): void {
    this.hud.showGo(dir ?? this.goDir(), 0);
  }

  banner(text: string, o?: BannerOpts): void {
    this.hud.showBanner(text, o);
  }

  callout(text: string, o?: CalloutOpts): void {
    this.hud.callout(text, o);
  }

  bossIntro(name = '', o: BossIntroOpts = {}): Wait {
    const ticks = o.ticks ?? 120;
    this.hud.showBanner('WARNING!', { sub: name, detail: o.subtitle, style: 'warning', ticks });
    this.hud.hideGo();
    this.world.audio.sfx(o.sfx ?? 'boss/warning');
    this.runner.playMusic(o.music ?? this.mission.bossMusic ?? 'boss', 30, o.musicFrom !== undefined ? { from: o.musicFrom } : {});
    this.runner.holdTimerForBoss(ticks);
    return ticks;
  }

  setCheckpoint(x?: number, y?: number): void {
    const cx = x ?? this.camera.centerX;
    this.runner.setCheckpoint(cx, y ?? floorY(this.world, cx));
  }

  music(id: string | null, fadeTicks?: number, o?: MusicCallOpts): void {
    this.runner.playMusic(id, fadeTicks, o);
  }

  // ---- flow

  enableExit(id: string, on = true): void {
    this.runner.enableExit(id, on);
  }

  exitTo(section: string, o?: { transition?: TransitionKind; entry?: { x: number; y: number } }): Wait {
    this.runner.exitTo(section, o);
    return NEVER;
  }

  missionComplete(): Wait {
    this.runner.completeMission();
    return NEVER;
  }
}

// ---------------------------------------------------------------------------------------------
// Placeholders (fail soft when mission data is missing)
// ---------------------------------------------------------------------------------------------

/** A flat stretch with a banner and an exit to the mission end. */
export function placeholderSection(id: string, note: string): SectionDef {
  const t = terrainBuilder(1536, 216);
  t.ground().at(0, 176).flat(1536);
  return {
    id,
    width: 1536,
    height: 216,
    scroll: 'right',
    background: { sky: 0x203048ff, layers: [] },
    terrain: t.build(),
    terrainStyle: { ground: 'dirt', edge: 'grass' },
    playerStart: { x: 64, y: 176 },
    timeLimit: 0,
    script: function* placeholder(ctx) {
      ctx.banner(ctx.mission.name, { sub: note.toUpperCase(), style: 'mission', ticks: 240 });
      yield ctx.waitCamera(1536 - 384 - 1);
      yield ctx.missionComplete();
    },
  };
}

export function placeholderMission(id: string): MissionDef {
  return { id, name: `MISSION ${id.toUpperCase()}`, music: '', start: 'a', sections: { a: placeholderSection('a', `mission ${id} not found`) } };
}
