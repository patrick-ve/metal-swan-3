/**
 * One floor of the first-person mode (docs/design/fps.md §3.7, §4): the parsed map, doors, push
 * walls, the player and the floor's state machine (unfold → play → elevator / dying). Pure and
 * deterministic: `step(input)` once per tick, `stateHash()` for replays and tests, `render(view)`
 * draws the RayView. Actors, combat and pickups (group actors) plug in here; the shell takes the
 * keys only, so locked doors work. No allocations per tick (events reuse their payloads).
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
import type { Difficulty, PlayerSlot } from '../session';
import { DoorSystem, DOOR_CLOSED, KEY_GOLD, KEY_SILVER } from './doors';
import { parseFloor, type ParsedFloor } from './map';
import { FpsPlayer } from './player';
import { PushSystem } from './pushwall';
import type { FloorResult, FpsCarry, FpsEvents, FpsFloorDef, FpsInput, FpsRun } from './types';

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

/** 'play' → 'elevator' (switch used, input frozen) → 'done'; 'play' → 'dying' → 'dead'. */
export type FpsState = 'play' | 'elevator' | 'dying' | 'dead' | 'done';

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

const TREASURE_IDS: ReadonlySet<string> = new Set(['pocket-watch', 'tuning-fork', 'gold-bars', 'music-box', 'golden-record']);

// Scratch for hashing float64 bits.
const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);

/** Things in the world the renderer draws (items and props), with their billboard (or null). */
interface Placed {
  x: number;
  y: number;
  bb: RayBillboard | null;
}

export class FpsGame {
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
  /** Per item (map.items): 1 = taken. */
  taken: Uint8Array = new Uint8Array(0);
  /** Recent messages, newest last (at most 2; spec §8.6), with the tick they appeared. */
  readonly messages: Array<{ text: string; tick: number }> = [];
  /** Angle toward the killer while dying. */
  private killerAngle = 0;
  private readonly sprites: RaySprite[] = [];
  private spriteCount = 0;
  private items: Placed[] = [];
  private props: Placed[] = [];
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
    this.doors.sfx = (id) => this.audio.sfx(id);
    this.pushes = new PushSystem(map.grid);
    this.player.reset(map.start.x, map.start.y, map.start.angle, carry);
    this.taken = new Uint8Array(map.items.length);
    this.items = map.items.map((it) => ({ x: it.x + 0.5, y: it.y + 0.5, bb: billboard(`fps/item/${it.id}`) }));
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
    this.doors.step(this.doorBlocked);
    if (this.pushes.step(this.cellFree)) this.rebuildAreas();
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
    this.pruneMessages();
    this.syncCamera();
  }

  private playTick(i: FpsInput): void {
    const p = this.player;
    p.move(i, this.grid, this.map.doors, this.pushes.push);
    if ((i.pressed & ACTION_BIT.use) !== 0) this.use();
    this.collect();
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
        this.audio.sfx('fps/pushwall');
        this.secretEv.x = fx;
        this.secretEv.y = fy;
        this.events.emit('secret', this.secretEv);
      } else if (r === 'blocked') this.audio.sfx('fps/use-wall');
      return;
    }
    for (const s of this.map.switches) {
      if (s.x === fx && s.y === fy) {
        this.useElevator();
        return;
      }
    }
  }

  /** The elevator switch (or F4 on floors 0/1): the lamp turns on, input freezes, 60 ticks later the floor ends. */
  useElevator(): void {
    if (this.state !== 'play') return;
    const g = this.grid;
    for (const s of this.map.switches) g.wall[g.idx(s.x, s.y)] = this.map.switchOnTex + 1;
    this.audio.sfx('fps/elevator');
    this.state = 'elevator';
    this.stateTimer = ELEVATOR_TICKS;
  }

  private complete(): void {
    this.state = 'done';
    const r = this.result;
    r.floor = this.def.number;
    r.ticks = this.clock;
    r.kills = 0;
    r.killsTotal = this.map.actors.length;
    r.secrets = this.pushes.found;
    r.secretsTotal = this.map.pushes.length;
    let t = 0;
    let tt = 0;
    let record = false;
    this.map.items.forEach((it, k) => {
      if (!TREASURE_IDS.has(it.id)) return;
      tt++;
      if (this.taken[k]) {
        t++;
        if (it.id === 'golden-record') record = true;
      }
    });
    r.treasure = t;
    r.treasureTotal = tt;
    r.goldenRecord = record;
    this.events.emit('floorComplete', { result: { ...r } });
  }

  /** Pickups under the player (the shell takes keys; group actors adds the rest). */
  private collect(): void {
    const p = this.player;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    const items = this.map.items;
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (this.taken[k] || it.x !== cx || it.y !== cy) continue;
      if (it.id === 'key-gold' || it.id === 'key-silver') {
        this.taken[k] = 1;
        p.keys |= it.id === 'key-gold' ? KEY_GOLD : KEY_SILVER;
        this.audio.sfx('fps/pickup-key');
        this.message(it.id === 'key-gold' ? 'GOLD KEY' : 'SILVER KEY');
      }
    }
  }

  /** Damage to the player (`fromX/fromY`: the attacker, for the death turn). */
  hurt(amount: number, fromX = this.player.x, fromY = this.player.y): void {
    if (this.state !== 'play' || this.god || amount <= 0) return;
    const p = this.player;
    p.hp = Math.max(0, p.hp - Math.round(amount));
    this.audio.sfx('fps/player-hurt');
    if (p.hp > 0) return;
    this.state = 'dying';
    this.stateTimer = 0;
    this.killerAngle = angleTo(fromX - p.x, fromY - p.y);
    this.audio.sfx('fps/player-die');
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

  /** The cell holds the player (box overlap). Group actors adds living actors. */
  cellOccupied(x: number, y: number): boolean {
    const b = this.player.box;
    return b.x + b.r > x && b.x - b.r < x + 1 && b.y + b.r > y && b.y - b.r < y + 1;
  }

  /** A push wall may move into the cell: floor with no wall, door, prop, item or player. */
  isCellFree(x: number, y: number): boolean {
    const g = this.grid;
    if (!g.inside(x, y) || g.flags[g.idx(x, y)] !== 0) return false;
    const items = this.map.items;
    for (let k = 0; k < items.length; k++) if (!this.taken[k] && items[k].x === x && items[k].y === y) return false;
    for (const pr of this.map.props) if (pr.x === x && pr.y === y) return false;
    for (const a of this.map.actors) if (a.x === x && a.y === y) return false;
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

  /** Draw the view (walls, items, props) into `view.buf`. */
  render(view: RayView): void {
    this.spriteCount = 0;
    for (let k = 0; k < this.items.length; k++) if (!this.taken[k]) this.addSprite(this.items[k]);
    for (const pr of this.props) this.addSprite(pr);
    this.scene.spriteCount = this.spriteCount;
    renderView(view, this.scene, this.camera);
  }

  private addSprite(pl: Placed): void {
    if (!pl.bb || this.spriteCount >= MAX_SPRITES) return;
    let s = this.sprites[this.spriteCount];
    if (!s) {
      s = { x: 0, y: 0, bb: pl.bb, frame: 0, yaw: 0 };
      this.sprites.push(s);
    }
    s.x = pl.x;
    s.y = pl.y;
    s.bb = pl.bb;
    s.frame = 0;
    s.yaw = 0;
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
    for (let k = 0; k < this.taken.length; k++) mix(this.taken[k]);
    // Rng's state words are private in TypeScript only; read them to hash the exact stream position.
    const r = this.rng as unknown as { a: number; b: number; c: number; d: number };
    mix(r.a);
    mix(r.b);
    mix(r.c);
    mix(r.d);
    return h >>> 0;
  }
}

const STATE_CODE: Readonly<Record<FpsState, number>> = { play: 0, elevator: 1, dying: 2, dead: 3, done: 4 };

/** The billboard of an id, or null when it is not registered (drawn as nothing, not magenta). */
function billboard(id: string): RayBillboard | null {
  return hasRayBillboard(id) ? getRayBillboard(id) : null;
}
