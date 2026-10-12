/**
 * Legion cross-area review (integrate-legion): GDD §4.11 rules that every Legion attacker must
 * keep, swept over all of them at once — no shot leaves from outside the view while the player
 * runs past (rule 3), the attack-token limit holds in a crowd (rule 4), and the reactions every
 * Legion soldier accepts (rules 6–7).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/items/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/infantry/art';
import '../../src/game/content/infantry/rhythm/index';
import '../../src/game/content/infantry/rhythm/art';
import '../../src/game/content/infantry/winds/index';
import '../../src/game/content/infantry/winds/art';
import '../../src/game/content/machines/armor/index';
import '../../src/game/content/machines/armor/art';
import '../../src/game/content/machines/transport/index';
import '../../src/game/content/machines/transport/art';
import { attackTokenLimit, Enemy } from '../../src/game/enemy';
import { Projectile } from '../../src/game/projectile';
import { getEntityMeta } from '../../src/game/registry';
import type { Difficulty } from '../../src/game/session';
import { FLOOR, TestWorld } from './helpers';

/** Every Legion attacker that fires something, with the params that let it fight on a flat floor. */
const SHOOTERS: readonly [string, Record<string, unknown>][] = [
  ['rifleman', {}],
  ['cymbalist', {}],
  ['baton-major', {}],
  ['oompah-trooper', {}],
  ['bassoonist', {}],
  ['oompah-tank', {}],
  ['metronome-turret', { floor: true }],
  ['gramophone-mortar', {}],
  ['pipe-battery', {}],
  ['baton-copter', {}],
];

/** GDD §15.4: every Legion id (infantry, machines, support entities, projectiles). */
const LEGION_IDS = [
  'rifleman', 'drummer', 'oompah-trooper', 'cymbalist', 'baton-major', 'piccolo', 'triangle', 'bassoonist',
  'oompah-tank', 'tank-crewman', 'band-truck', 'metronome-turret', 'gramophone-mortar', 'piano-bomber',
  'baton-copter', 'pipe-battery', 'anthem-speaker',
  'rowboat', 'tank-barge', 'subway-train', 'drum-barricade', 'parade-float',
  'sonic-ring', 'low-ring', 'shockwave', 'cymbal-disc', 'baton', 'piccolo-bullet', 'bassoon-rocket',
  'bell-shell', 'metronome-bullet', 'record', 'piano', 'note-bullet', 'note-rocket', 'enemy-bullet', 'enemy-grenade',
];

const isEnemyShot = (e: Entity): boolean => e instanceof Projectile && e.team === 'enemy';

describe('legion (cross-area)', () => {
  it('registers every Legion id of GDD §15.4', () => {
    for (const id of LEGION_IDS) expect(getEntityMeta(id), id).toBeDefined();
  });

  // GDD §4.11 rule 3. The player runs right through the whole group, so the view scrolls during
  // every telegraph; each shot must still leave from inside the view (8 px margin).
  for (const difficulty of ['normal', 'hard'] as Difficulty[]) {
    it(`no Legion shot leaves from outside the view while the player runs past (${difficulty})`, () => {
      const bad: string[] = [];
      let shots = 0;
      for (const [id, params] of SHOOTERS) {
        for (let seed = 1; seed <= 3; seed++) {
          const tw = new TestWorld({ playerX: 150, god: true, seed, width: 3200, difficulty });
          const cam = tw.world.camera;
          tw.run(2);
          for (const dx of [150, 330, 520]) tw.spawn(id, 150 + dx, { gag: false, facing: -1, ...params });
          tw.world.events.on('spawn', (e: Entity) => {
            if (!isEnemyShot(e)) return;
            shots++;
            if (!cam.containsPoint(e.x, e.y, -8)) bad.push(`${id}/${e.type}@${Math.round(e.x - cam.left)},${Math.round(e.y - cam.top)}`);
          });
          // Walk in, stand a while (the slow machines fire), then run on past them.
          tw.hold('right').run(120);
          tw.hold().run(240);
          tw.hold('right').run(600);
        }
      }
      expect(shots).toBeGreaterThan(40);
      expect(bad).toEqual([]);
    });
  }

  // GDD §4.11 rule 4: in a mixed crowd, at most `attackTokenLimit` enemies telegraph or attack.
  it('a mixed Legion crowd never holds more attack tokens than the limit', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 5, width: 1600 });
    const ids = ['rifleman', 'rifleman', 'rifleman', 'cymbalist', 'oompah-trooper', 'bassoonist', 'baton-major', 'gramophone-mortar', 'drummer'];
    ids.forEach((id, i) => tw.spawn(id, 180 + i * 22, { gag: false, facing: -1 }));
    let max = 0;
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      let busy = 0;
      for (const e of tw.world.entities) {
        if (!(e instanceof Enemy) || !e.alive) continue;
        const mode = (e as Enemy & { mode?: string }).mode;
        // Every Legion type names its telegraph / attack modes after the attack itself.
        if (mode && /^(aim|windup|swing|raise|crash|twirl|thrown|attack|drumroll|charge|shell|pulse|scratch)$/.test(mode)) busy++;
      }
      max = Math.max(max, busy);
    }
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(attackTokenLimit(tw.world));
  });

  // GDD §4.11 rules 6–7: every Legion soldier salutes the anthem, panics, gets confused.
  it('every Legion soldier accepts salute, panic and confused (and stops attacking)', () => {
    for (const id of ['rifleman', 'drummer', 'oompah-trooper', 'cymbalist', 'baton-major', 'triangle', 'bassoonist']) {
      for (const kind of ['salute', 'panic', 'confused'] as const) {
        const tw = new TestWorld({ playerX: 100, god: true, seed: 2 });
        const e = tw.spawn(id, 220, { gag: false, facing: -1 }) as Enemy;
        tw.run(30);
        expect(e.hasTag('legion'), id).toBe(true);
        expect(e.react(kind, 60), `${id} ${kind}`).toBe(true);
        let fired = 0;
        tw.world.events.on('spawn', (s: Entity) => {
          if (isEnemyShot(s)) fired++;
        });
        tw.run(50);
        expect(e.alive, `${id} ${kind}`).toBe(true);
        expect(fired, `${id} ${kind} fired`).toBe(0);
        expect(e.y, `${id} stays on the floor`).toBeCloseTo(FLOOR, 0);
      }
    }
  });

  // GDD §6.3 (sundae-mortar): frozen infantry shatter on any hit, whatever their HP.
  it('every frozen Legion soldier shatters on one weak hit (die-shatter), the drummer through his drum too', () => {
    for (const id of ['rifleman', 'drummer', 'cymbalist', 'baton-major', 'triangle', 'oompah-trooper', 'bassoonist']) {
      const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
      const e = tw.spawn(id, 220, { gag: false, facing: -1 }) as Enemy;
      tw.run(5);
      expect(e.react('freeze', 90), id).toBe(true);
      tw.run(2);
      // A 1-damage pistol pellet from the front (the drummer's drum is part 1).
      tw.world.damage(e, { amount: 1, kind: 'bullet', dirX: -1, owner: 0 }, id === 'drummer' ? 1 : 0);
      expect(e.alive, id).toBe(false);
      tw.run(1);
      expect(e.anim.id, id).toMatch(/die-shatter$/);
    }
  });

  // GDD §15.4: the standard enemy projectiles are spawnable ids (bosses, scripts).
  it('enemy-bullet flies chest high along facing or a degree angle; enemy-grenade lobs and lands', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const b = tw.spawn('enemy-bullet', 300, { facing: 'right' });
    expect(b.vx).toBeGreaterThan(0);
    expect(b.y).toBeCloseTo(FLOOR - 24, 0);
    const up = tw.spawn('enemy-bullet', 300, { angle: -90 });
    expect(up.vy).toBeLessThan(0);
    expect(Math.abs(up.vx)).toBeLessThan(1e-6);
    const g = tw.spawn('enemy-grenade', 300, { facing: -1 }) as Entity & { landed: boolean };
    expect(g.vx).toBeLessThan(0);
    tw.until(() => g.landed, 120);
    expect(g.removed).toBe(false);
  });
});
