/**
 * Player vehicles `sundae-driver`, `bandwagon`, `trumpeter` and their weapons and projectiles
 * (GDD §8.3–§8.6, §6.3, §15.2). Gameplay definitions; art in ./art.ts under `vehicle/<id>/…`
 * and `weapon/<projectile>`. Numbers: ./numbers.ts.
 *
 * | id | what |
 * |---|---|
 * | `sundae-driver` | armed ice-cream van: `sundae-sprinkle-gun` (`sprinkle`), `sundae-mortar` (`sundae-shell`), `sundae-jingle` |
 * | `bandwagon` | captured parade truck: `bandwagon-brass-cannon` (`brass-ring`), `bandwagon-drum-boom` (`drum-wave`), `bandwagon-cymbal-wall` |
 * | `trumpeter` | SWAN-3 flight mode (m5-a): `trumpeter-twin-gun` (`twin-bullet`), `trumpeter-dive-bomb` (`dive-bomb`), `trumpeter-honk`; status `swan-parachute` |
 *
 * For mission authors:
 * - Ground vehicles: spawn `sundae-driver` / `bandwagon` parked (anchor = the ground under the
 *   middle of the vehicle; spawn param `facing: -1` to park it facing left). Allow them per
 *   section with `SectionDef.vehicles`; they carry over with their cells and shells.
 * - The Bandwagon's stage (`Bandwagon.stage`) is a one-way platform the partner can ride.
 * - `trumpeter`: set `SectionDef.startVehicle: 'trumpeter'` (players start mounted at view y 80 /
 *   130 and get a new ship flying in from the left edge on every respawn). Lock the camera and
 *   move the lock window for the auto-scroll: the ship adds the view's movement to its own, so a
 *   released stick keeps its place on screen. Scripts: `trumpeterOf(player)?.flyTo(x, y, speed)`,
 *   `.arrived`, `.releaseAutopilot()` (the landing hatch at the end of m5-a), `.cheer(ticks)`.
 *   Spawn param `variant: 'mute' | 'ivory'` (default: P2 flies the Mute).
 */
export { SundaeDriver, sundaeSplat } from './sundae';
export { Bandwagon, BrassRing, DrumWave } from './bandwagon';
export { HonkRing, PARACHUTE, Trumpeter, trumpeterOf, type TrumpeterMode, type TrumpeterVariant } from './trumpeter';
export { GroundVehicle } from './common';
export * from './numbers';
