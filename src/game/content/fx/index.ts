/**
 * Content category "fx": spawnable effect entities for mission scripts and decor
 * (docs/ARCHITECTURE.md §5.12). The effects themselves live in the game layer (src/game/fx.ts);
 * these ids make them usable from data: `ctx.spawn('fx-explosion', x, y, { size: 'l' })`.
 *
 * | id | params | what it does |
 * |---|---|---|
 * | `fx-explosion` | `size` s/m/l/xl (m), `damage` (0 = harmless), `team` (enemy), `radius`, `debris`, `silent` | one explosion |
 * | `fx-explosion-chain` | `count` (5), `interval` (8 ticks), `spread` (24 px), `size` (m), `damage`, `team` | explosions in a row (set pieces, wrecks) |
 * | `fx-smoke` | `rate` (6 ticks), `life` (0 = forever), `dark` (true), `spread` (6 px) | a smoke column (burning wrecks, chimneys) |
 * | `fx-sparks` | `count` (8), `dirX` (0) | a spark burst |
 * | `fx-debris` | `kind` (dirt), `count` (8) | flying chunks |
 * | `fx-dust` / `fx-splash` | `count` | dust at the feet / a water splash |
 * | `fx-poof` | — | the cartoon POOF |
 * | `fx-confetti` | `count` (16), `power` (2.4) | a confetti pop |
 * | `fx-music-notes` | `count` (3), `spread` (8 px), `life` (50) | notes that float up and sway |
 * | `fx-steam` | `rate` (20 ticks), `life` (0 = forever), `vx` (0), `vy` (−0.35) | a steam vent: a puff every `rate` ticks |
 * | `fx-snow-puff` / `fx-ice-shatter` | `count` | snow thrown up / ice cubes of a shattered enemy |
 * | `fx-tin-feathers` | `count` (3), `dirX` (0) | the Swan's stamped tin feather plates |
 * | `fx-stars-dizzy` | `life` (60) | dizzy stars circling at (x, y) |
 * | `fx-helium-cloud` | `life` (120) | the pink helium cloud (cosmetic only; the `helium-tank` prop gives the status) |
 *
 * Particles use `world.fxRng` (inside the particle system), so effects never change gameplay.
 */
import { Entity, type Team } from '../../../engine/entity';
import { hasSprite } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import {
  confetti,
  debris,
  dust,
  explosion,
  FxEntity,
  heliumCloud,
  iceShatter,
  musicNotes,
  poof,
  smokeTrail,
  snowPuff,
  splash,
  steamPuff,
  tinFeathers,
  type DebrisKind,
  type ExplosionSize,
} from '../../fx';
import { defineEntity, paramBool, paramNum, paramStr, type SpawnParams } from '../../registry';

const SIZES: readonly ExplosionSize[] = ['s', 'm', 'l', 'xl'];
const TEAMS: readonly Team[] = ['player', 'enemy', 'neutral'];
const DEBRIS_KINDS: readonly DebrisKind[] = ['metal', 'wood', 'rock', 'dirt', 'glass', 'plant', 'snow', 'cloth'];

function sizeParam(p: SpawnParams, fallback: ExplosionSize = 'm'): ExplosionSize {
  const s = paramStr(p, 'size', fallback);
  return (SIZES as readonly string[]).includes(s) ? (s as ExplosionSize) : fallback;
}

function teamParam(p: SpawnParams, fallback: Team = 'enemy'): Team {
  const t = paramStr(p, 'team', fallback);
  return (TEAMS as readonly string[]).includes(t) ? (t as Team) : fallback;
}

function debrisParam(p: SpawnParams, fallback: DebrisKind | null): DebrisKind | null {
  const v = p.debris ?? p.kind;
  if (v === null || v === false || v === 'none') return null;
  return typeof v === 'string' && (DEBRIS_KINDS as readonly string[]).includes(v) ? (v as DebrisKind) : fallback;
}

/**
 * An invisible helper entity that runs a callback every tick until it returns false (or for
 * `life` ticks). Used for effects that last a while (smoke columns, explosion chains).
 */
class FxDriver extends Entity {
  private readonly step: (t: number) => boolean;
  private readonly life: number;
  private t = 0;

  constructor(world: World, x: number, y: number, life: number, step: (t: number) => boolean) {
    super(world, x, y);
    this.type = 'fx-driver';
    this.team = 'neutral';
    this.z = 60;
    this.life = life > 0 ? life : Infinity;
    this.step = step;
    this.despawnMargin = 320;
    this.hitbox = { x: -4, y: -4, w: 8, h: 8 };
  }

  override update(): void {
    if (!this.step(this.t++) || this.t >= this.life) this.remove();
  }
}

/** A driver that does its effect at once (in the factory) and leaves the world next tick. */
function oneShot(world: World, x: number, y: number, effect: () => void): Entity {
  effect();
  return new FxDriver(world, x, y, 1, () => false);
}

defineEntity(
  'fx-explosion',
  (w, x, y, p) =>
    explosion(w, x, y, sizeParam(p), {
      damage: paramNum(p, 'damage', 0),
      team: teamParam(p),
      radius: typeof p.radius === 'number' ? p.radius : undefined,
      debris: debrisParam(p, sizeParam(p) === 's' ? null : 'dirt'),
      silent: paramBool(p, 'silent', false),
    }),
  { category: 'fx', description: 'One explosion (params size, damage, team, radius, debris, silent).' },
);

defineEntity(
  'fx-explosion-chain',
  (w, x, y, p) => {
    const count = Math.max(1, Math.round(paramNum(p, 'count', 5)));
    const interval = Math.max(1, Math.round(paramNum(p, 'interval', 8)));
    const spread = paramNum(p, 'spread', 24);
    const size = sizeParam(p);
    const damage = paramNum(p, 'damage', 0);
    const team = teamParam(p);
    let fired = 0;
    return new FxDriver(w, x, y, count * interval + 1, (t) => {
      if (t % interval !== 0) return true;
      // Positions from the cosmetic rng: they only decide where the fireballs appear.
      const ox = w.fxRng.range(-spread, spread);
      const oy = w.fxRng.range(-spread * 0.6, spread * 0.4);
      explosion(w, x + ox, y + oy, fired === count - 1 ? size : fired % 2 === 0 ? size : 's', { damage, team, silent: fired % 2 === 1 });
      return ++fired < count;
    });
  },
  { category: 'fx', description: 'Explosions one after another (params count, interval, spread, size, damage, team).' },
);

defineEntity(
  'fx-smoke',
  (w, x, y, p) => {
    const rate = Math.max(1, Math.round(paramNum(p, 'rate', 6)));
    const dark = paramBool(p, 'dark', true);
    const spread = paramNum(p, 'spread', 6);
    return new FxDriver(w, x, y, paramNum(p, 'life', 0), (t) => {
      if (t % rate === 0) smokeTrail(w, x + w.fxRng.range(-spread, spread), y, dark);
      return true;
    });
  },
  { category: 'fx', description: 'A smoke column (params rate, life, dark, spread).' },
);

defineEntity(
  'fx-sparks',
  (w, x, y, p) => oneShot(w, x, y, () => w.particles.sparks(x, y, Math.round(paramNum(p, 'count', 8)), paramNum(p, 'dirX', 0))),
  { category: 'fx', description: 'A spark burst (params count, dirX).' },
);

defineEntity(
  'fx-debris',
  (w, x, y, p) => oneShot(w, x, y, () => debris(w, x, y, debrisParam(p, 'dirt') ?? 'dirt', Math.round(paramNum(p, 'count', 8)))),
  { category: 'fx', description: 'Flying chunks (params kind, count).' },
);

defineEntity(
  'fx-dust',
  (w, x, y, p) => oneShot(w, x, y, () => dust(w, x, y, Math.round(paramNum(p, 'count', 6)))),
  { category: 'fx', description: 'Dust puffs at the feet (param count).' },
);

defineEntity(
  'fx-splash',
  (w, x, y, p) => oneShot(w, x, y, () => splash(w, x, y, Math.round(paramNum(p, 'count', 10)))),
  { category: 'fx', description: 'A water splash (param count).' },
);

defineEntity('fx-poof', (w, x, y) => oneShot(w, x, y, () => poof(w, x, y)), { category: 'fx', description: 'The cartoon POOF.' });

defineEntity(
  'fx-confetti',
  (w, x, y, p) => oneShot(w, x, y, () => confetti(w, x, y, Math.round(paramNum(p, 'count', 16)), paramNum(p, 'power', 2.4))),
  { category: 'fx', description: 'A confetti pop (params count, power).' },
);

defineEntity(
  'fx-music-notes',
  (w, x, y, p) =>
    oneShot(w, x, y, () => musicNotes(w, x, y, Math.max(1, Math.round(paramNum(p, 'count', 3))), paramNum(p, 'spread', 8), Math.round(paramNum(p, 'life', 50)))),
  { category: 'fx', description: 'Music notes that float up and sway (params count, spread, life).' },
);

defineEntity(
  'fx-steam',
  (w, x, y, p) => {
    const rate = Math.max(1, Math.round(paramNum(p, 'rate', 20)));
    const vx = paramNum(p, 'vx', 0);
    const vy = paramNum(p, 'vy', -0.35);
    return new FxDriver(w, x, y, paramNum(p, 'life', 0), (t) => {
      if (t % rate === 0) steamPuff(w, x, y, vx, vy);
      return true;
    });
  },
  { category: 'fx', description: 'A steam vent: one puff every `rate` ticks (params rate, life, vx, vy).' },
);

defineEntity(
  'fx-snow-puff',
  (w, x, y, p) => oneShot(w, x, y, () => snowPuff(w, x, y, Math.round(paramNum(p, 'count', 6)))),
  { category: 'fx', description: 'Snow thrown up (param count).' },
);

defineEntity(
  'fx-ice-shatter',
  (w, x, y, p) => oneShot(w, x, y, () => iceShatter(w, x, y, Math.round(paramNum(p, 'count', 8)))),
  { category: 'fx', description: 'Ice cubes of a shattered frozen enemy (param count).' },
);

defineEntity(
  'fx-tin-feathers',
  (w, x, y, p) => oneShot(w, x, y, () => tinFeathers(w, x, y, Math.round(paramNum(p, 'count', 3)), paramNum(p, 'dirX', 0))),
  { category: 'fx', description: "The Swan's stamped tin feather plates (params count, dirX)." },
);

defineEntity(
  'fx-stars-dizzy',
  (w, x, y, p) =>
    FxEntity.spawn(w, { sprite: hasSprite('fx/stars-dizzy') ? 'fx/stars-dizzy' : 'fx/stun-stars', x, y, loop: true, life: Math.round(paramNum(p, 'life', 60)), z: 61 }),
  { category: 'fx', description: 'Dizzy stars circling at the spawn point (param life).' },
);

defineEntity('fx-helium-cloud', (w, x, y, p) => heliumCloud(w, x, y, Math.round(paramNum(p, 'life', 120))), {
  category: 'fx',
  description: 'The pink helium cloud, cosmetic only (param life).',
});
