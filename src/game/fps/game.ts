/**
 * One floor of the first-person mode (docs/design/fps.md §3.7, §4): the parsed map, doors, push
 * walls, the player and the floor's state machine (unfold → play → elevator / dying). Pure and
 * deterministic: `step(input)` once per tick, `stateHash()` for replays and tests, `render(view)`
 * draws the RayView. Actors (actors.ts / ai.ts), weapons, hitscan, pickups, positional sound and
 * the HUD state (group actors) plug in here. No allocations per tick (events reuse their payloads).
 */
import type { AudioOut } from '../../engine/audio';
import { EventBus } from '../../engine/events';
import { ACTION_BIT } from '../../engine/input-actions';
import {
  AreaMap,
  angDelta,
  angleTo,
  angNorm,
  CELL_DOOR,
  CELL_PROP,
  getRayBillboard,
  hasRayBillboard,
  renderView,
  type RayBillboard,
  type RayCamera,
  type RayGrid,
  type RayScene,
  type RaySprite,
  type RayView,
} from '../../engine/ray';
import { Rng } from '../../engine/rng';
import type { FpsLine } from '../content/fps/lines';
import type { Difficulty, PlayerSlot } from '../session';
import { ActorPool, billboardOf, MAX_ACTORS, ST_DIE, type Actor, type ActorFrame } from './actors';
import { damageActor, makeNoise, stepActors } from './ai';
import { DEATHCAM_FADE, DEATHCAM_HOLD, DEATHCAM_SLOW, DEATHCAM_STEP, installBoss, type FpsBoss } from './boss';
import { FpsSound } from './audio';
import { DoorSystem, DOOR_CLOSED, KEY_GOLD, KEY_SILVER } from './doors';
import { bandDist, findTarget, playerDamage } from './hitscan';
import { GRIN_TICKS, HudState, PICKUP_FLASH_TICKS, type BossBarState, type SubtitleState } from './hud';
import { cardinalAngle, parseFloor, type ParsedFloor } from './map';
import { applyPickup, ItemList, type PickupHost } from './pickups';
import { FpsPlayer } from './player';
import { PushSystem } from './pushwall';
import type { FloorResult, FpsCarry, FpsEvents, FpsFloorDef, FpsInput, FpsRun } from './types';
import { WeaponSystem, WEAPONS } from './weapons';

export interface FpsGameOpts {
  floor: FpsFloorDef;
  difficulty: Difficulty;
  seed: number;
  /** The fps slot (lives and score; spec §4.13). */
  slot: PlayerSlot;
  /** The loadout from the previous floor (null = the fresh loadout). */
  carry: FpsCarry | null;
  audio: AudioOut;
  /** The player takes no damage. */
  god?: boolean;
  /** The run: `restart()` resets the score to `run.floorStartScore` (spec §4.11). */
  run?: FpsRun;
}

/**
 * 'play' → 'elevator' (switch used, input frozen) → 'done'; 'play' → 'dying' → 'dead';
 * 'play' → 'deathcam' (the boss died, §7.3: slow motion, hold, fade) → 'done'.
 */
export type FpsState = 'play' | 'elevator' | 'dying' | 'dead' | 'done' | 'deathcam';

/** The view unfolds from a 1-px line over these ticks; input is ignored meanwhile (spec §1.6). */
export const UNFOLD_TICKS = 30;
/** Switch used → floor complete (spec §4.8). */
export const ELEVATOR_TICKS = 60;
/** HP 0 → `playerDead` (spec §4.9). */
export const DYING_TICKS = 90;
/** The camera turns toward the killer at this speed while dying. */
const DYING_TURN = 32;
/** Messages stay this long (spec §8.6). */
export const MESSAGE_TICKS = 90;
export const MAX_SPRITES = 256;

/** Room for drops: one per actor (the pool size). */
const MAX_DROPS = MAX_ACTORS;
/** Cardinal index (map.ts DIR order) of a `Cardinal`. */
const CARD_INDEX: Readonly<Record<string, number>> = { E: 0, S: 1, W: 2, N: 3 };

// Scratch for hashing float64 bits.
const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);

/** Things in the world the renderer draws (items and props), with their billboard (or null). */
interface Placed {
  x: number;
  y: number;
  bb: RayBillboard | null;
}

export class FpsGame implements PickupHost {
  readonly events = new EventBus<FpsEvents>();
  readonly def: FpsFloorDef;
  readonly difficulty: Difficulty;
  readonly seed: number;
  readonly slot: PlayerSlot;
  readonly audio: AudioOut;
  readonly run: FpsRun | null;
  readonly player = new FpsPlayer();
  readonly camera: RayCamera = { x: 0, y: 0, angle: 0, eyeZ: 0.5, squash: 1 };
  god: boolean;
  /** Ticks since the last (re)start of the floor. */
  tick = 0;
  /** Restarts so far (the rng is re-seeded with seed + attempt). */
  attempt = 0;
  rng: Rng;
  /** Cosmetic randomness (never in `stateHash`). */
  fxRng: Rng;
  map!: ParsedFloor;
  grid!: RayGrid;
  doors!: DoorSystem;
  pushes!: PushSystem;
  areas!: AreaMap;
  state: FpsState = 'play';
  /** Ticks left in 'elevator' / ticks spent in 'dying'. */
  stateTimer = 0;
  /** Ticks of the floor clock (stops at the elevator; spec §4.12). */
  clock = 0;
  /** Per placed item (map.items): 1 = taken (a view of `items.taken`). */
  taken: Uint8Array = new Uint8Array(0);
  /** Every item of the floor: the placed ones, then the drops. */
  items!: ItemList;
  /** The enemies (pool of 128). */
  readonly actors = new ActorPool();
  readonly weaponSys = new WeaponSystem();
  readonly sound: FpsSound;
  /** The face, flashes and edge markers (cosmetic). */
  readonly hud = new HudState();
  /** How far the player moved this tick (tiles; the run rule of the enemy hit chance). */
  playerMove = 0;
  /** Distance the player walked (tiles; the weapon bob). */
  walked = 0;
  /** Tick of the last alert shout (one per 30 ticks, §4.4). */
  lastShout = -1000;
  /** The boss bar (§7.5; group floors fills it). */
  readonly bossBar: BossBarState = { visible: false, name: 'MECHAHITLER', frac: 1, phase: 1 };
  /** MechaHitler of a boss floor (boss.ts), else null. */
  boss: FpsBoss | null = null;
  /** The view's fade to black 0..1 (the end of the death-cam; render() dithers it in). */
  fade = 0;
  /** The death-cam: the camera's start angle and the boss it turns to. */
  private camFrom = 0;
  private camBoss: Actor | null = null;
  /** The taunt subtitle (§7.4). */
  readonly subtitle: SubtitleState = { text: '', ticks: 0 };
  /** Recent messages, newest last (at most 2; spec §8.6), with the tick they appeared. */
  readonly messages: Array<{ text: string; tick: number }> = [];
  /** Angle toward the killer while dying. */
  private killerAngle = 0;
  private readonly sprites: RaySprite[] = [];
  private spriteCount = 0;
  private props: Placed[] = [];
  private readonly af: ActorFrame = { bb: null, frame: 0, yaw: 0 };
  private readonly scene: RayScene;
  // Reused event payloads.
  private readonly msgEv = { text: '' };
  private readonly deadEv = { floor: 0 };
  private readonly secretEv = { x: 0, y: 0 };
  private readonly extendEv = { lives: 0 };
  private readonly result: FloorResult = {
    floor: 0,
    ticks: 0,
    kills: 0,
    killsTotal: 0,
    secrets: 0,
    secretsTotal: 0,
    treasure: 0,
    treasureTotal: 0,
    goldenRecord: false,
  };
  private readonly doorBlocked = (i: number): boolean => this.cellOccupied(this.doors.doors.x[i], this.doors.doors.y[i]);
  private readonly cellFree = (x: number, y: number): boolean => this.isCellFree(x, y);
  private readonly doorAreaOf = (x: number, y: number): number => this.doorArea(x, y);

  constructor(o: FpsGameOpts) {
    this.def = o.floor;
    this.difficulty = o.difficulty;
    this.seed = o.seed >>> 0;
    this.slot = o.slot;
    this.audio = o.audio;
    this.god = o.god ?? false;
    this.run = o.run ?? null;
    this.rng = new Rng(this.seed);
    this.fxRng = new Rng(this.seed ^ 0x5eed);
    this.sound = new FpsSound(o.audio);
    this.weaponSys.sfx = (id) => this.sound.play(id);
    this.scene = { grid: null as unknown as RayGrid, doors: null as unknown as RayScene['doors'], push: null, ceil: o.floor.ceil, floor: o.floor.floor, sprites: this.sprites, spriteCount: 0 };
    this.load(o.carry);
  }

  /** Parse the floor and place everything (a first entry or a restart). */
  private load(carry: FpsCarry | null): void {
    const map = parseFloor(this.def, this.difficulty);
    this.map = map;
    this.grid = map.grid;
    this.areas = new AreaMap(map.grid, map.doors);
    this.doors = new DoorSystem(map.doors, map.doorLock, this.areas);
    this.doors.sfx = (id, i) => this.sound.at(id, map.doors.x[i] + 0.5, map.doors.y[i] + 0.5);
    this.pushes = new PushSystem(map.grid);
    this.player.reset(map.start.x, map.start.y, map.start.angle, carry);
    this.items = new ItemList(map.items, MAX_DROPS);
    this.taken = this.items.taken.subarray(0, this.items.placed);
    this.actors.reset(map.w, map.h);
    for (const t of map.turns) this.actors.setTurn(t.x, t.y, CARD_INDEX[t.dir]);
    this.actors.spawnParsed(map.actors, this.difficulty, cardinalAngle);
    this.boss = installBoss(this);
    this.fade = 0;
    this.camBoss = null;
    this.weaponSys.reset();
    this.hud.reset();
    this.playerMove = 0;
    this.walked = 0;
    this.lastShout = -1000;
    this.bossBar.visible = false;
    this.subtitle.ticks = 0;
    this.props = map.props.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5, bb: billboard(`fps/prop/${p.id}`) }));
    this.scene.grid = map.grid;
    this.scene.doors = map.doors;
    this.scene.push = this.pushes.push;
    this.state = 'play';
    this.stateTimer = 0;
    this.tick = 0;
    this.clock = 0;
    this.messages.length = 0;
    this.syncCamera();
  }

  /** Restart the floor after a death or a continue (spec §4.11): fresh loadout, score back. */
  restart(): void {
    this.attempt++;
    this.rng = new Rng((this.seed + this.attempt) >>> 0);
    this.fxRng = new Rng((this.seed + this.attempt) ^ 0x5eed);
    this.load(null);
    if (this.run) this.slot.score = this.run.floorStartScore;
    // A boss floor: the boss sleeps again, so its song ends (spec §6.2).
    if (this.boss) this.audio.music(this.def.music, { fadeTicks: 30 });
  }

  /** Skip the unfold (tools and tests that pose the camera). */
  skipUnfold(): void {
    if (this.tick < UNFOLD_TICKS) this.tick = UNFOLD_TICKS;
    this.syncCamera();
  }

  carry(): FpsCarry {
    return this.player.carry();
  }

  /** Put the player at (x, y) facing `angle` (tools, tests, debug). */
  setPose(x: number, y: number, angle: number): void {
    this.player.box.x = x;
    this.player.box.y = y;
    this.player.angle = angNorm(Math.round(angle));
    this.syncCamera();
  }

  /** The view is still unfolding (input ignored). */
  get unfolding(): boolean {
    return this.tick < UNFOLD_TICKS;
  }

  /** One tick. */
  step(i: FpsInput): void {
    this.tick++;
    if (this.state === 'deathcam') {
      this.deathCamTick();
      if (this.subtitle.ticks > 0) this.subtitle.ticks--;
      this.hud.step(this.fxRng);
      this.pruneMessages();
      this.syncCamera();
      return;
    }
    this.doors.step(this.doorBlocked);
    if (this.pushes.step(this.cellFree)) this.rebuildAreas();
    // The sound map follows the player (and gives the noise reach of this tick).
    this.sound.setListener(this.player, this.grid, this.areas, this.doorAreaOf);
    switch (this.state) {
      case 'play':
        this.clock++;
        if (this.tick > UNFOLD_TICKS) this.playTick(i);
        break;
      case 'elevator':
        if (--this.stateTimer <= 0) this.complete();
        break;
      case 'dying':
        this.dyingTick();
        break;
      default:
        break;
    }
    if (this.state === 'play' || this.state === 'dying' || this.state === 'elevator') {
      if (this.tick > UNFOLD_TICKS) stepActors(this);
    }
    if (this.subtitle.ticks > 0) this.subtitle.ticks--;
    this.hud.step(this.fxRng);
    this.pruneMessages();
    this.syncCamera();
  }

  private playTick(i: FpsInput): void {
    const p = this.player;
    const x0 = p.x;
    const y0 = p.y;
    p.move(i, this.grid, this.map.doors, this.pushes.push, this.actors.buildBlockers());
    this.playerMove = Math.hypot(p.x - x0, p.y - y0);
    this.walked += this.playerMove;
    if ((i.pressed & ACTION_BIT.use) !== 0) this.use();
    if (this.weaponSys.step(p, i)) this.playerShot();
    this.collect();
  }

  /** The player's weapon fired this tick (§4.2): the hit, the knife sound, the noise. */
  private playerShot(): void {
    const p = this.player;
    const w = p.weapon;
    const a = findTarget(this.actors, this.grid, this.map.doors, this.pushes.push, p.x, p.y, p.angle);
    if (a) {
      const dmg = playerDamage(this.rng, w, bandDist(a.x - p.x, a.y - p.y));
      if (dmg > 0) {
        damageActor(this, a, dmg);
        if (w === 0) this.sound.play('fps/knife-hit');
      }
    }
    if (WEAPONS[w].noise) makeNoise(this);
  }

  /** "Use" on the cell in front (spec §4.1): a door, a push wall or the elevator switch. */
  use(): void {
    const p = this.player;
    const fx = p.frontX;
    const fy = p.frontY;
    const g = this.grid;
    if (!g.inside(fx, fy)) return;
    const c = g.idx(fx, fy);
    if ((g.flags[c] & CELL_DOOR) !== 0) {
      const d = g.door[c];
      const r = this.doors.use(d, p.keys, this.doorBlocked(d));
      if (r === 'locked-gold') this.message('YOU NEED THE GOLD KEY');
      else if (r === 'locked-silver') this.message('YOU NEED THE SILVER KEY');
      return;
    }
    if (this.pushes.isPushCell(fx, fy)) {
      const r = this.pushes.use(fx, fy, p.facing, this.cellFree);
      if (r === 'moved') {
        this.sound.at('fps/pushwall', fx + 0.5, fy + 0.5);
        this.secretEv.x = fx;
        this.secretEv.y = fy;
        this.events.emit('secret', this.secretEv);
      } else if (r === 'blocked') this.sound.play('fps/use-wall');
      return;
    }
    for (const s of this.map.switches) {
      if (s.x === fx && s.y === fy) {
        this.useElevator();
        return;
      }
    }
  }

  /** Debug F4 (spec §1.11): floors 0/1 as the elevator; the boss floor: the suit breaks, then he dies. */
  debugSkip(): void {
    if (this.state !== 'play') return;
    if (this.boss) this.boss.debugSkip();
    else this.useElevator();
  }

  /** The elevator switch (or F4 on floors 0/1): the lamp turns on, input freezes, 60 ticks later the floor ends. */
  useElevator(): void {
    if (this.state !== 'play') return;
    const g = this.grid;
    for (const s of this.map.switches) g.wall[g.idx(s.x, s.y)] = this.map.switchOnTex + 1;
    this.sound.play('fps/elevator');
    this.state = 'elevator';
    this.stateTimer = ELEVATOR_TICKS;
  }

  private complete(): void {
    this.state = 'done';
    const r = this.result;
    r.floor = this.def.number;
    r.ticks = this.clock;
    r.kills = this.actors.kills;
    r.killsTotal = this.actors.placedTotal;
    r.secrets = this.pushes.found;
    r.secretsTotal = this.map.pushes.length;
    const t = this.items.treasure();
    r.treasure = t.taken;
    r.treasureTotal = t.total;
    r.goldenRecord = t.record;
    this.events.emit('floorComplete', { result: { ...r } });
  }

  /** Pickups under the player's centre (§4.5): the effect, or refused (the item stays). */
  private collect(): void {
    const p = this.player;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    const it = this.items;
    for (let k = 0; k < it.count; k++) {
      if (it.taken[k] || it.x[k] !== cx || it.y[k] !== cy) continue;
      if (applyPickup(this, it.id[k])) it.taken[k] = 1;
    }
  }

  // --- PickupHost ---------------------------------------------------------------------------
  /** Add a life (false when the lives are full). */
  addLife(): boolean {
    return this.slot.addLife(1) > 0;
  }
  sfx(id: string): void {
    this.sound.play(id);
  }
  grin(): void {
    this.hud.grin = GRIN_TICKS;
  }
  flash(): void {
    this.hud.pickupFlash = PICKUP_FLASH_TICKS;
  }
  raise(w: number): void {
    this.weaponSys.request(this.player, w);
  }

  /** A drop of a killed enemy on cell (x, y). */
  dropItem(id: string, x: number, y: number): void {
    this.items.add(id, x, y);
  }

  /** A prop placed during play (the boss's wreck): drawn with billboard `bbId`; solid blocks the cell. */
  addProp(bbId: string, x: number, y: number, solid: boolean): void {
    this.props.push({ x: x + 0.5, y: y + 0.5, bb: billboard(bbId) });
    this.map.props.push({ id: bbId, x, y, solid });
    if (solid) this.grid.flags[this.grid.idx(x, y)] |= CELL_PROP;
  }

  /**
   * The boss died (§7.3): input off, the other actors freeze, the floor clock stops; 150 ticks of
   * slow motion (one world step per 3 ticks) while the camera turns to him over 30 ticks, then
   * 60 ticks hold and a 30-tick fade, then `floorComplete`.
   */
  startDeathCam(a: Actor): void {
    if (this.state !== 'play') return;
    this.state = 'deathcam';
    this.stateTimer = 0;
    this.camFrom = this.player.angle;
    this.camBoss = a;
    this.fade = 0;
  }

  private deathCamTick(): void {
    const t = ++this.stateTimer;
    if (t <= DEATHCAM_SLOW && t % DEATHCAM_STEP === 0) {
      this.doors.step(this.doorBlocked);
      if (this.pushes.step(this.cellFree)) this.rebuildAreas();
      this.boss?.slowStep();
    }
    const b = this.camBoss;
    if (b) {
      const p = this.player;
      const k = Math.min(1, t / 30);
      p.angle = angNorm(Math.round(this.camFrom + angDelta(this.camFrom, angleTo(b.x - p.x, b.y - p.y)) * k));
    }
    const fadeFrom = DEATHCAM_SLOW + DEATHCAM_HOLD;
    this.fade = t <= fadeFrom ? 0 : Math.min(1, (t - fadeFrom) / DEATHCAM_FADE);
    if (t >= fadeFrom + DEATHCAM_FADE) this.complete();
  }

  /** Hooks for boss.ts / tools: an actor woke up / died (no-ops by default). */
  actorWoke(_a: Actor): void {}
  actorKilled(_a: Actor): void {}

  /** The patrol turn marker on cell (x, y): cardinal index 0 E, 1 S, 2 W, 3 N, or -1. */
  turnAt(x: number, y: number): number {
    const pool = this.actors;
    return pool.inside(x, y) ? pool.turns[y * pool.w + x] : -1;
  }

  /** The area id of a door cell's west / north side (sound in a doorway), 0 = none. */
  private doorArea(x: number, y: number): number {
    const g = this.grid;
    if (!g.inside(x, y)) return 0;
    const c = g.idx(x, y);
    if ((g.flags[c] & CELL_DOOR) === 0) return 0;
    const d = g.door[c];
    return this.areas.doorArea(d, 0) || this.areas.doorArea(d, 1);
  }

  /** A spoken line with its subtitle (the boss taunts, §7.4): 150 ticks or the clip + 30. */
  speak(line: FpsLine, subtitle: string = line.meaning, ticks = 150): void {
    this.audio.say?.(line.text, line.speaker, { important: true });
    this.subtitle.text = subtitle;
    this.subtitle.ticks = ticks;
  }

  /** Damage to the player (`fromX/fromY`: the attacker, for the death turn and the edge marker). */
  hurt(amount: number, fromX = this.player.x, fromY = this.player.y): void {
    if (this.state !== 'play' || this.god || amount <= 0) return;
    const p = this.player;
    const dmg = Math.round(amount);
    p.hp = Math.max(0, p.hp - dmg);
    const dx = fromX - p.x;
    const dy = fromY - p.y;
    this.hud.hurt(dmg, dx === 0 && dy === 0 ? Number.NaN : angDelta(p.angle, angleTo(dx, dy)));
    this.sound.play('fps/player-hurt');
    if (p.hp > 0) return;
    this.state = 'dying';
    this.stateTimer = 0;
    this.killerAngle = angleTo(fromX - p.x, fromY - p.y);
    this.sound.play('fps/player-die');
  }

  private dyingTick(): void {
    this.stateTimer++;
    const p = this.player;
    const d = angDelta(p.angle, this.killerAngle);
    if (d !== 0) p.angle = angNorm(p.angle + Math.max(-DYING_TURN, Math.min(DYING_TURN, d)));
    if (this.stateTimer >= DYING_TICKS) {
      this.state = 'dead';
      this.deadEv.floor = this.def.number;
      this.events.emit('playerDead', this.deadEv);
    }
  }

  /** Points through the slot (extends apply; spec §4.13). */
  addScore(points: number): void {
    const extra = this.slot.addScore(points);
    if (extra > 0) {
      this.sound.play('item/1up');
      this.extendEv.lives = this.slot.lives;
      this.events.emit('extend', this.extendEv);
      this.message('ONE MORE TRY!');
    }
  }

  /** Show a message (spec §8.6: 90 ticks, 2 lines max, newest at the bottom). */
  message(text: string): void {
    this.messages.push({ text, tick: this.tick });
    while (this.messages.length > 2) this.messages.shift();
    this.msgEv.text = text;
    this.events.emit('message', this.msgEv);
  }

  private pruneMessages(): void {
    while (this.messages.length && this.tick - this.messages[0].tick >= MESSAGE_TICKS) this.messages.shift();
  }

  /** Debug F5: every weapon, 99 ammo, both keys. */
  giveAll(): void {
    const p = this.player;
    p.weapons = 0b1111;
    p.ammo = 99;
    p.keys = KEY_GOLD | KEY_SILVER;
    p.weapon = 3;
  }

  /** The cell holds the player (box overlap) or a living actor (standing on or entering it). */
  cellOccupied(x: number, y: number): boolean {
    if (this.actors.cellTaken(x, y)) return true;
    const b = this.player.box;
    return b.x + b.r > x && b.x - b.r < x + 1 && b.y + b.r > y && b.y - b.r < y + 1;
  }

  /** A push wall may move into the cell: floor with no wall, door, prop, item, actor (or corpse) or player. */
  isCellFree(x: number, y: number): boolean {
    const g = this.grid;
    if (!g.inside(x, y) || g.flags[g.idx(x, y)] !== 0) return false;
    if (this.items.at(x, y)) return false;
    for (const pr of this.map.props) if (pr.x === x && pr.y === y) return false;
    const pool = this.actors;
    for (let i = 0; i < pool.count; i++) {
      const a = pool.actors[i];
      if (a.used && Math.floor(a.x) === x && Math.floor(a.y) === y) return false;
    }
    return !this.cellOccupied(x, y);
  }

  /** A push wall stopped: the open cells changed, so the areas are flooded again. */
  private rebuildAreas(): void {
    this.areas = new AreaMap(this.grid, this.map.doors);
    for (let i = 0; i < this.doors.count; i++) this.areas.setDoorOpen(i, this.doors.state[i] !== DOOR_CLOSED);
    this.doors.areas = this.areas;
  }

  private syncCamera(): void {
    const p = this.player;
    const c = this.camera;
    c.x = p.x;
    c.y = p.y;
    c.angle = p.angle;
    c.squash = Math.min(1, this.tick / UNFOLD_TICKS);
    // Death fall: eyeZ 0.5 → 0.2 over 30 ticks.
    c.eyeZ = this.state === 'dying' || this.state === 'dead' ? 0.5 - 0.3 * Math.min(1, this.stateTimer / 30) : 0.5;
  }

  /** Draw the view (walls, blood pools, items, props, actors, hit spurts) into `view.buf`. */
  render(view: RayView): void {
    this.spriteCount = 0;
    const pool = this.actors;
    // Blood pools first: at the same depth as a corpse they draw under it.
    const poolBb = billboardOf('fps/fx/blood-pool');
    if (poolBb) {
      for (let i = 0; i < pool.count; i++) {
        const a = pool.actors[i];
        if (a.used && a.pool > 0 && !a.alive) this.addSprite(a.x, a.y, poolBb, Math.min(a.pool, a.state === ST_DIE ? a.timer >> 4 : 2), 0);
      }
    }
    const it = this.items;
    for (let k = 0; k < it.count; k++) if (!it.taken[k]) this.addSprite(it.x[k] + 0.5, it.y[k] + 0.5, it.bb[k], 0, 0);
    // The death-cam shows his fall: a prop (the wreck) between the camera and him is not drawn.
    const cb = this.state === 'deathcam' ? this.camBoss : null;
    for (const pr of this.props) if (!cb || !this.hidesBoss(pr.x, pr.y, cb)) this.addSprite(pr.x, pr.y, pr.bb, 0, 0);
    const cam = this.camera;
    const af = this.af;
    const spurtBb = billboardOf('fps/fx/spurt');
    for (let i = 0; i < pool.count; i++) {
      const a = pool.actors[i];
      if (!a.used) continue;
      pool.frameOf(a, cam.x, cam.y, af);
      this.addSprite(a.x, a.y, af.bb, af.frame, af.yaw);
      if (spurtBb && a.spurt > 0) this.addSprite(a.x, a.y, spurtBb, Math.min(2, 2 - Math.floor((a.spurt - 1) / 3)), 0);
    }
    this.scene.spriteCount = this.spriteCount;
    renderView(view, this.scene, this.camera);
    if (this.fade > 0) ditherFade(view, this.fade);
  }

  /** A prop at (x, y) stands on the line from the player to the boss (within DEATHCAM_CLEAR tiles). */
  private hidesBoss(x: number, y: number, b: Actor): boolean {
    const p = this.player;
    const bx = b.x - p.x;
    const by = b.y - p.y;
    const len = Math.hypot(bx, by);
    if (len < 1e-6) return false;
    const dx = x - p.x;
    const dy = y - p.y;
    const along = (dx * bx + dy * by) / len;
    if (along <= 0 || along >= len) return false;
    return Math.abs(dx * by - dy * bx) / len < DEATHCAM_CLEAR;
  }

  private addSprite(x: number, y: number, bb: RayBillboard | null, frame: number, yaw: number): void {
    if (!bb || this.spriteCount >= MAX_SPRITES) return;
    let s = this.sprites[this.spriteCount];
    if (!s) {
      s = { x: 0, y: 0, bb, frame: 0, yaw: 0 };
      this.sprites.push(s);
    }
    s.x = x;
    s.y = y;
    s.bb = bb;
    s.frame = frame;
    s.yaw = yaw;
    this.spriteCount++;
  }

  /** FNV-1a over the floor's simulation state (player, doors, push wall, items, rng). */
  stateHash(): number {
    let h = 0x811c9dc5;
    const mix = (v: number): void => {
      h = Math.imul(h ^ (v & 0xff), 0x01000193);
      h = Math.imul(h ^ ((v >>> 8) & 0xff), 0x01000193);
      h = Math.imul(h ^ ((v >>> 16) & 0xff), 0x01000193);
      h = Math.imul(h ^ ((v >>> 24) & 0xff), 0x01000193);
    };
    const mixF = (v: number): void => {
      F64[0] = v;
      mix(U32[0]);
      mix(U32[1]);
    };
    const p = this.player;
    mix(this.tick);
    mix(this.clock);
    mix(STATE_CODE[this.state]);
    mix(this.stateTimer);
    mixF(p.x);
    mixF(p.y);
    mix(p.angle);
    mix(p.hp);
    mix(p.ammo);
    mix(p.weapons);
    mix(p.weapon);
    mix(p.keys);
    const d = this.doors;
    for (let i = 0; i < d.count; i++) {
      mix(d.state[i]);
      mix(d.prog[i]);
      mix(d.timer[i]);
    }
    const pw = this.pushes;
    mix(pw.push.active ? 1 : 0);
    mix(pw.push.x);
    mix(pw.push.y);
    mix(pw.ticks);
    mix(pw.tiles);
    mix(pw.found);
    const it = this.items;
    mix(it.count);
    for (let k = 0; k < it.count; k++) mix(it.taken[k]);
    const pool = this.actors;
    mix(pool.count);
    mix(pool.kills);
    mix(pool.tokensUsed);
    for (let i = 0; i < pool.count; i++) {
      const a = pool.actors[i];
      mixF(a.x);
      mixF(a.y);
      mix(a.hp);
      mix(a.state);
      mix(a.timer);
      mix(a.react);
      mix(a.dir);
      mix(a.angle);
    }
    const boss = this.boss;
    if (boss) {
      mix(boss.phase);
      mix(boss.breakT);
      mix(boss.taunts);
      mix(boss.awake ? 1 : 0);
    }
    const ws = this.weaponSys;
    mix(ws.phase);
    mix(ws.timer);
    mix(ws.want);
    mix(ws.queued ? 1 : 0);
    // Rng's state words are private in TypeScript only; read them to hash the exact stream position.
    const r = this.rng as unknown as { a: number; b: number; c: number; d: number };
    mix(r.a);
    mix(r.b);
    mix(r.c);
    mix(r.d);
    return h >>> 0;
  }
}

/** The death-cam hides a prop this close (tiles) to the line from the camera to the boss. */
const DEATHCAM_CLEAR = 0.9;

const STATE_CODE: Readonly<Record<FpsState, number>> = { play: 0, elevator: 1, dying: 2, dead: 3, done: 4, deathcam: 5 };

/** 4 × 4 ordered-dither thresholds (0..15). */
const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Fade the view to black by `k` 0..1 with an ordered dither (palette-safe: only black is added). */
function ditherFade(view: RayView, k: number): void {
  const buf = view.buf;
  const d = buf.data;
  const level = Math.round(k * 16);
  for (let y = 0; y < buf.h; y++) {
    const row = y * buf.w;
    const b = (y & 3) << 2;
    for (let x = 0; x < buf.w; x++) if (BAYER4[b + (x & 3)] < level) d[row + x] = 0x000000ff;
  }
  buf.touch();
}

/** The billboard of an id, or null when it is not registered (drawn as nothing, not magenta). */
function billboard(id: string): RayBillboard | null {
  return hasRayBillboard(id) ? getRayBillboard(id) : null;
}
