/**
 * Game session: everything that survives section and mission changes (docs/ARCHITECTURE.md §6).
 *
 * - `PlayerSlot`: one player's persistent state — character, lives, score, bombs, weapon +
 *   ammo, hostages rescued in the current life, continues, stats. The Player entity of a section
 *   reads and writes its slot, so a new section starts where the last one ended.
 * - `GameSession`: both slots, difficulty, credits, the current mission / section.
 * - `HighScoreTable`: top scores saved through the engine `Store`.
 *
 * Pure data, no DOM; safe in tests and headless tools.
 */
import { loadJson, saveJson, type Store } from '../engine/storage';
import { TUNING } from './tuning';

// ---------------------------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------------------------

export type Difficulty = 'easy' | 'normal' | 'hard';

/**
 * Difficulty rules (GDD §4.10 — "these values, and only these, change"). Read them through
 * `difficultyOf(world)` / `session.mods`.
 */
export interface DifficultyMods {
  readonly id: Difficulty;
  /** Lives per credit (EASY 5). */
  readonly lives: number;
  /** Grenades at each life start (EASY 15). */
  readonly grenades: number;
  /** HP of bosses, mini-bosses and machines (basic soldiers always die to one hit). */
  readonly bossHp: number;
  readonly bigEnemyHp: number;
  /** Time between enemy attacks: recoveries and cooldowns (bigger = slower attacks). */
  readonly enemyFireInterval: number;
  /** Speed of enemy projectiles. */
  readonly enemyBulletSpeed: number;
  /** Telegraph durations of enemies and bosses (never below 18 ticks: `telegraphTicks`). */
  readonly telegraph: number;
  /** @deprecated same as `telegraph` (kept for older content). */
  readonly enemyReaction: number;
  /** Attack tokens (GDD §4.11 rule 4). */
  readonly tokens: number;
  /** Gag double-take window (ticks). */
  readonly doubleTake: number;
  /** Hostages lost on death: 'checkpoint' = those freed since the last checkpoint, 'all' = the whole tally. */
  readonly hostageLoss: 'checkpoint' | 'all';
  /** A vehicle at 0 cells throws its pilot out by itself (else: eject within 60 ticks or die). */
  readonly vehicleAutoEject: boolean;
  /** Bosses and mini-bosses add this many projectiles to every volley (HARD 1). */
  readonly extraVolley: number;
  /** Wave rows marked [N] / [H] spawn (GDD §11.0 notation). */
  readonly normalRows: boolean;
  readonly hardRows: boolean;
  /** Extra section timer counts (0 everywhere: the GDD timer is the same on every level). */
  readonly timerBonus: number;
  /** Score multiplier applied to the mission-end tally. */
  readonly tallyScore: number;
}

export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyMods>> = {
  easy: {
    id: 'easy',
    lives: 5,
    grenades: 15,
    bossHp: 0.8,
    bigEnemyHp: 0.8,
    enemyFireInterval: 1.3,
    enemyBulletSpeed: 0.9,
    telegraph: 1.25,
    enemyReaction: 1.25,
    tokens: 3,
    doubleTake: 36,
    hostageLoss: 'checkpoint',
    vehicleAutoEject: true,
    extraVolley: 0,
    normalRows: false,
    hardRows: false,
    timerBonus: 0,
    tallyScore: 0.5,
  },
  normal: {
    id: 'normal',
    lives: 3,
    grenades: 10,
    bossHp: 1,
    bigEnemyHp: 1,
    enemyFireInterval: 1,
    enemyBulletSpeed: 1,
    telegraph: 1,
    enemyReaction: 1,
    tokens: 4,
    doubleTake: 24,
    hostageLoss: 'all',
    vehicleAutoEject: false,
    extraVolley: 0,
    normalRows: true,
    hardRows: false,
    timerBonus: 0,
    tallyScore: 1,
  },
  hard: {
    id: 'hard',
    lives: 3,
    grenades: 10,
    bossHp: 1.25,
    bigEnemyHp: 1.25,
    enemyFireInterval: 0.8,
    enemyBulletSpeed: 1.15,
    telegraph: 0.9,
    enemyReaction: 0.9,
    tokens: 6,
    doubleTake: 12,
    hostageLoss: 'all',
    vehicleAutoEject: false,
    extraVolley: 1,
    normalRows: true,
    hardRows: true,
    timerBonus: 0,
    tallyScore: 1.5,
  },
};

export function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'normal' || v === 'hard';
}

// ---------------------------------------------------------------------------------------------
// Player slot
// ---------------------------------------------------------------------------------------------

export interface PlayerStats {
  kills: number;
  knifeKills: number;
  shots: number;
  bombsThrown: number;
  deaths: number;
  /** Hostages rescued this game (all lives). */
  hostages: number;
  pickups: number;
  bossKills: number;
}

/** A vehicle carried into the next section by its driver. */
export interface VehicleCarry {
  id: string;
  cells: number;
  shells: number;
}

/** Points earned this mission, paid out by the mission-complete tally. */
export interface MissionBonus {
  /** Riding a vehicle when the boss died. */
  vehicle: number;
}

/**
 * What one player did in the current mission, for the tally (GDD §14.4, §13.11). Reset when a
 * mission starts; filled by the MissionRunner (ticks are runner ticks: 60 per second).
 */
export interface MissionStats {
  /** Lives lost (FLAWLESS PERFORMANCE = 0). */
  deaths: number;
  hostagesFreed: number;
  /** Hostages lost from the tally by deaths. */
  hostagesLost: number;
  /** Runner tick when the boss fight began (its intro ended) and when the boss died; -1 = not yet. */
  bossStartTick: number;
  bossEndTick: number;
  /** Riding a vehicle when the boss died (VEHICLE AT THE FINISH). */
  vehicleAtFinish: boolean;
  /** A vehicle section ended with this player's vehicle at full cells (NO SCRATCHES). */
  noScratches: boolean;
  /** The mission's golden record was picked up. */
  goldenRecord: boolean;
  /** Kills by entity type ('rifleman' → 12); hats = infantry kills. */
  kills: Record<string, number>;
  /** Section ids visited, in order (the route taken). */
  route: string[];
}

function newMissionStats(): MissionStats {
  return {
    deaths: 0,
    hostagesFreed: 0,
    hostagesLost: 0,
    bossStartTick: -1,
    bossEndTick: -1,
    vehicleAtFinish: false,
    noScratches: false,
    goldenRecord: false,
    kills: {},
    route: [],
  };
}

/** Score thresholds that give an extra life (GDD §4.6, §14.5). */
export const EXTEND_SCORES: readonly number[] = [500000, 1500000];
/** Most lives a slot can hold, the one in play included (9 in reserve). */
export const MAX_LIVES = 10;

export type SlotIndex = 0 | 1;

export class PlayerSlot {
  readonly index: SlotIndex;
  /** Took part in this game (pressed start). */
  joined = false;
  /** Out of lives and did not continue. */
  gameOver = false;
  character = 'recruit';
  /** Lives left INCLUDING the one in play (3 at the start; 0 = game over). */
  lives: number = TUNING.life.livesPerCredit;
  score = 0;
  bombs: number = TUNING.grenade.perLife;
  /** Weapon id of the bomb button (characters / status effects may change it). */
  bombType = 'grenade';
  weapon = 'pistol';
  ammo = Infinity;
  /**
   * The hostage tally (freed this mission, still held): paid by the mission tally. A death
   * drops it by the difficulty rule (all, or back to `checkpointRescued` on EASY).
   */
  rescued = 0;
  /** The tally stored at the last checkpoint (EASY death rule). */
  checkpointRescued = 0;
  continues = 0;
  /** Extra lives already given for score (index into EXTEND_SCORES). */
  extendsGiven = 0;
  /** Set when the driver leaves a section mounted; the next section re-creates the vehicle. */
  vehicle: VehicleCarry | null = null;
  readonly bonus: MissionBonus = { vehicle: 0 };
  /** This mission's numbers for the tally. */
  mission: MissionStats = newMissionStats();
  readonly stats: PlayerStats = {
    kills: 0,
    knifeKills: 0,
    shots: 0,
    bombsThrown: 0,
    deaths: 0,
    hostages: 0,
    pickups: 0,
    bossKills: 0,
  };

  constructor(index: SlotIndex) {
    this.index = index;
  }

  /** Joined and not game over: this slot has a Player in the world. */
  get active(): boolean {
    return this.joined && !this.gameOver;
  }

  /**
   * Add points. Returns the number of extra lives earned by crossing EXTEND_SCORES (the caller
   * shows ONE MORE TRY!; `awardScore` does).
   */
  addScore(points: number): number {
    if (!Number.isFinite(points) || points === 0) return 0;
    this.score = Math.max(0, Math.round(this.score + points));
    let extra = 0;
    while (this.extendsGiven < EXTEND_SCORES.length && this.score >= EXTEND_SCORES[this.extendsGiven]) {
      this.extendsGiven++;
      if (this.addLife(1) > 0) extra++;
    }
    return extra;
  }

  /** Add lives up to MAX_LIVES (9 in reserve). Returns how many were added. */
  addLife(n = 1): number {
    const before = this.lives;
    this.lives = Math.min(MAX_LIVES, this.lives + n);
    return this.lives - before;
  }

  /** Lives are at the cap (a 1UP pays points instead). */
  get livesFull(): boolean {
    return this.lives >= MAX_LIVES;
  }

  /** Start a fresh game for this slot. */
  join(character: string, lives: number = TUNING.life.livesPerCredit, startBombs: number = TUNING.grenade.perLife): void {
    this.joined = true;
    this.gameOver = false;
    this.character = character;
    this.lives = lives;
    this.score = 0;
    this.continues = 0;
    this.extendsGiven = 0;
    this.vehicle = null;
    this.resetLife(startBombs);
    this.rescued = 0;
    this.checkpointRescued = 0;
    for (const k of Object.keys(this.stats) as (keyof PlayerStats)[]) this.stats[k] = 0;
    this.bonus.vehicle = 0;
    this.mission = newMissionStats();
  }

  /**
   * What a new life starts with (GDD §4.5: weapon → pistol, bombs → 10 / EASY 15). The hostage
   * tally is NOT reset here: `loseLife` applies the difficulty rule.
   */
  resetLife(startBombs: number = TUNING.grenade.perLife, startWeapon = 'pistol'): void {
    this.weapon = startWeapon;
    this.ammo = Infinity;
    this.bombs = startBombs;
  }

  /**
   * A life was lost. The hostage tally drops to `keepRescued` (0 = all lost; EASY keeps the
   * checkpoint count). Returns true when that was the last life.
   */
  loseLife(keepRescued = 0): boolean {
    this.stats.deaths++;
    this.mission.deaths++;
    this.lives = Math.max(0, this.lives - 1);
    const keep = Math.max(0, Math.min(this.rescued, keepRescued));
    this.mission.hostagesLost += this.rescued - keep;
    this.rescued = keep;
    return this.lives === 0;
  }

  /** Continue after the last life: full lives again, the last score digit counts continues. */
  continueGame(lives: number = TUNING.life.livesPerCredit): void {
    this.continues++;
    this.gameOver = false;
    this.lives = lives;
    // Each continue adds 1 point, so the last score digit counts continues (up to 9).
    if (this.continues <= 9) this.score += 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------------------------

export interface SessionOptions {
  difficulty?: Difficulty;
  /** Characters of the joined players (one entry = 1 player). Default ['recruit']. */
  characters?: readonly string[];
  /** Continues allowed per player (Infinity = free play). */
  credits?: number;
  seed?: number;
}

/**
 * Campaign records: small cross-section state kept by key for one game (across the sections of a
 * mission and across missions; a new game makes a new session, so they start empty). Mission
 * scripts use it for state that outlives a section's World, e.g. the m3 SHE TOOK THE LIFT record
 * (`m3/lift`: `{ variant, cells, shells }[]`, written at the end of m3-a, read at the start of
 * m3-c). Values should be plain data (numbers, strings, arrays, objects); never entities.
 * Missing keys return the fallback, so a section started directly (?section=c) still works.
 */
export class CampaignRecords {
  private readonly map = new Map<string, unknown>();

  /** The value under `key`, or `fallback` (default undefined) when it was never set. */
  get<T>(key: string): T | undefined;
  get<T>(key: string, fallback: T): T;
  get<T>(key: string, fallback?: T): T | undefined {
    return this.map.has(key) ? (this.map.get(key) as T) : fallback;
  }

  set<T>(key: string, value: T): void {
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Remove one record; returns true when it was there. */
  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  get size(): number {
    return this.map.size;
  }
}

export class GameSession {
  readonly slots: readonly [PlayerSlot, PlayerSlot] = [new PlayerSlot(0), new PlayerSlot(1)];
  difficulty: Difficulty;
  /** Continues each player may still use (Infinity = free play). */
  credits: number;
  seed: number;
  missionId = '';
  sectionId = '';
  /** Missions finished this game, in order. */
  readonly completed: string[] = [];
  /** Cross-section / cross-mission state for this game (see CampaignRecords). */
  readonly records = new CampaignRecords();

  constructor(opts: SessionOptions = {}) {
    this.difficulty = opts.difficulty ?? 'normal';
    this.credits = opts.credits ?? Infinity;
    this.seed = opts.seed ?? 1;
    const chars = opts.characters ?? ['recruit'];
    chars.slice(0, 2).forEach((c, i) => this.slots[i].join(c, this.mods.lives, this.mods.grenades));
  }

  get mods(): DifficultyMods {
    return DIFFICULTY[this.difficulty] ?? DIFFICULTY.normal;
  }

  slot(index: number): PlayerSlot | null {
    return index === 0 || index === 1 ? this.slots[index] : null;
  }

  /** Slots that have a player in the game right now. */
  get activeSlots(): PlayerSlot[] {
    return this.slots.filter((s) => s.active);
  }

  get activeCount(): number {
    return (this.slots[0].active ? 1 : 0) + (this.slots[1].active ? 1 : 0);
  }

  /** Every joined player is out of lives (and has not continued). */
  get allOut(): boolean {
    return this.slots.every((s) => !s.joined || s.gameOver);
  }

  /** Join (or re-join after a game over) a slot. */
  join(index: SlotIndex, character: string): PlayerSlot {
    const s = this.slots[index];
    s.join(character, this.mods.lives, this.mods.grenades);
    return s;
  }

  /** Credit points to a slot (out-of-range owners are ignored). Returns extra lives earned. */
  addScore(index: number, points: number): number {
    return this.slot(index)?.addScore(points) ?? 0;
  }

  /** Use a continue for a slot. Returns false when no credits are left. */
  continueSlot(index: SlotIndex): boolean {
    if (this.credits !== Infinity) {
      if (this.credits <= 0) return false;
      this.credits--;
    }
    this.slots[index].continueGame(this.mods.lives);
    return true;
  }

  /** Clear the per-mission counters (called when a mission starts). */
  startMission(id: string): void {
    this.missionId = id;
    for (const s of this.slots) {
      s.bonus.vehicle = 0;
      s.mission = newMissionStats();
      s.rescued = 0;
      s.checkpointRescued = 0;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// High scores
// ---------------------------------------------------------------------------------------------

export interface HighScoreEntry {
  name: string;
  score: number;
  /** Furthest mission id reached. */
  mission: string;
  character: string;
  continues: number;
  /** Difficulty played (shown as E / N / H). */
  difficulty?: Difficulty;
}

const HIGH_SCORE_KEY = 'highscores';
const HIGH_SCORE_COUNT = 10;

function cleanEntry(v: unknown): HighScoreEntry | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const score = Number(o.score);
  if (!Number.isFinite(score) || score < 0) return null;
  const str = (x: unknown, max: number): string => (typeof x === 'string' ? x.slice(0, max) : '');
  return {
    name: str(o.name, 8) || '???',
    score: Math.floor(score),
    mission: str(o.mission, 16),
    character: str(o.character, 24),
    continues: Math.max(0, Math.floor(Number(o.continues) || 0)),
    difficulty: isDifficulty(o.difficulty) ? o.difficulty : undefined,
  };
}

/** Default table so the title screen has something to show. */
function defaultEntries(): HighScoreEntry[] {
  const names = ['ACE', 'BOB', 'CAT', 'DOT', 'EVE', 'FOX', 'GUS', 'HAL', 'IVY', 'JAY'];
  return names.map((name, i) => ({
    name,
    score: (10 - i) * 10000,
    mission: 'm1',
    character: 'recruit',
    continues: 0,
  }));
}

export class HighScoreTable {
  entries: HighScoreEntry[];

  constructor(entries: HighScoreEntry[] = defaultEntries()) {
    this.entries = entries.slice(0, HIGH_SCORE_COUNT);
    this.sort();
  }

  static load(store: Store): HighScoreTable {
    const list = loadJson<HighScoreEntry[] | null>(store, HIGH_SCORE_KEY, null, (v) => {
      if (!Array.isArray(v)) return null;
      return v.map(cleanEntry).filter((e): e is HighScoreEntry => e !== null);
    });
    return new HighScoreTable(list && list.length ? list : defaultEntries());
  }

  save(store: Store): boolean {
    return saveJson(store, HIGH_SCORE_KEY, this.entries);
  }

  /** Would this score enter the table? */
  qualifies(score: number): boolean {
    if (score <= 0) return false;
    return this.entries.length < HIGH_SCORE_COUNT || score > this.entries[this.entries.length - 1].score;
  }

  /** Insert an entry; returns its rank (0-based) or -1 when it did not make the table. */
  submit(entry: HighScoreEntry): number {
    if (!this.qualifies(entry.score)) return -1;
    this.entries.push({ ...entry });
    this.sort();
    this.entries.length = Math.min(this.entries.length, HIGH_SCORE_COUNT);
    return this.entries.findIndex((e) => e.score === entry.score && e.name === entry.name);
  }

  get top(): number {
    return this.entries[0]?.score ?? 0;
  }

  private sort(): void {
    this.entries.sort((a, b) => b.score - a.score);
  }
}
