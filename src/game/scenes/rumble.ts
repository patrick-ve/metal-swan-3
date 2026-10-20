/**
 * Gamepad rumble in the 2D missions (docs/design/ams-extras.md §10; OPTIONS RUMBLE, default on):
 * a short, light rumble on the pad of the player it concerns —
 *
 * - the player's death ('playerDied'),
 * - a big explosion (size l / xl) near the player ('explosion' within its radius + 40 px),
 * - a boss part break (every player in play; a boss's `brokenCount` went up),
 * - a hit on the player's vehicle (its HP cells went down).
 *
 * GameplayScene attaches it to each section's World and ticks it after the runner. It only reads
 * the game (events and state) and calls `input.rumble`, so the sims are unchanged; no per-tick
 * allocation. Pads without motors, browsers without `vibrationActuator`: nothing happens.
 */
import type { InputManager } from '../../engine/input';
import type { World } from '../../engine/world';
import { Boss } from '../boss';
import type { MissionRunner } from '../mission/runner';
import type { GameSettings } from '../settings';
import { Vehicle } from '../vehicle';

/** Strong motor, weak motor (0..1), length in ms of each rumble. */
export const RUMBLES = Object.freeze({
  death: [0.6, 0.45, 260],
  blast: [0.45, 0.55, 180],
  bossPart: [0.55, 0.35, 220],
  vehicleHit: [0.25, 0.45, 110],
} as const);

type Kind = keyof typeof RUMBLES;

/** How far (px, beyond the blast radius) a big explosion still rumbles a player. */
const BLAST_REACH = 40;

export class RumbleWatch {
  private readonly input: InputManager;
  private readonly settings: () => GameSettings;
  private readonly cells = [-1, -1];
  private readonly vehicles: (Vehicle | null)[] = [null, null];
  private broken = 0;
  private runner: MissionRunner | null = null;

  constructor(input: InputManager, settings: () => GameSettings) {
    this.input = input;
    this.settings = settings;
  }

  /** Listen to a section's world (call on every 'sectionLoaded'). */
  attach(world: World, runner: MissionRunner): void {
    this.runner = runner;
    this.broken = 0;
    world.events.on('playerDied', ({ slot }) => this.play(slot, 'death'));
    world.events.on('explosion', ({ x, y, r, size }) => {
      if (size !== 'l' && size !== 'xl') return;
      const players = this.runner?.players ?? [];
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.state === 'out' || p.dead) continue;
        const reach = r + BLAST_REACH;
        const dx = p.x - x;
        const dy = p.y - 12 - y;
        if (dx * dx + dy * dy <= reach * reach) this.play(p.index, 'blast');
      }
    });
  }

  /** After each runner update: boss parts broken, vehicle hits. */
  tick(world: World): void {
    const runner = this.runner;
    if (!runner) return;
    const bosses = world.byTag('boss');
    let broken = 0;
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      if (b instanceof Boss) broken += b.brokenCount();
    }
    if (broken > this.broken) {
      const players = runner.players;
      for (let i = 0; i < players.length; i++) if (players[i].state !== 'out') this.play(players[i].index, 'bossPart');
    }
    this.broken = broken;
    for (let s = 0; s < 2; s++) {
      const p = runner.player(s as 0 | 1);
      const v = p && p.state === 'mounted' && p.vehicle instanceof Vehicle ? p.vehicle : null;
      if (v !== this.vehicles[s]) {
        this.vehicles[s] = v;
        this.cells[s] = v ? v.cells : -1;
        continue;
      }
      if (v && v.cells < this.cells[s]) this.play(s, 'vehicleHit');
      this.cells[s] = v ? v.cells : -1;
    }
  }

  private play(slot: number, kind: Kind): void {
    if (!this.settings().rumble || (slot !== 0 && slot !== 1)) return;
    const [strong, weak, ms] = RUMBLES[kind];
    this.input.rumble(slot, strong, weak, ms);
  }
}
