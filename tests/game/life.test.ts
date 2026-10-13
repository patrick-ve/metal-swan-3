import { describe, expect, it } from 'vitest';
import { SolidBox } from '../../src/engine/physics';
import { Projectile } from '../../src/game/projectile';
import { TUNING } from '../../src/game/tuning';
import { FLOOR, Rig } from './helpers';

/** An enemy bullet flying left at the player's chest. */
function enemyShot(rig: Rig, dx = 60): Projectile {
  const p = rig.p;
  return Projectile.spawn(rig.world, { team: 'enemy', x: p.x + dx, y: p.y - 20, vx: -3, vy: 0, damage: 10, sprite: '' });
}

describe('death and respawn', () => {
  it('one hit kills; the player drops back in with blinking invulnerability', () => {
    const rig = new Rig();
    const events: string[] = [];
    rig.world.events.on('playerDied', (e) => events.push(`died:${e.cause}`));
    rig.world.events.on('playerSpawned', () => events.push('spawned'));
    rig.p.giveWeapon('machine-gun', undefined, false);
    rig.session.slots[0].bombs = 3;
    rig.session.slots[0].rescued = 4;
    enemyShot(rig);
    rig.until(() => rig.p.state === 'dead', 60);
    expect(events).toEqual(['died:bullet']);
    expect(rig.p.dead).toBe(true);
    expect(rig.session.slots[0].lives).toBe(TUNING.life.livesPerCredit - 1);
    expect(rig.session.slots[0].rescued).toBe(0);
    rig.run(TUNING.life.deathAnimTicks);
    expect(rig.p.state).toBe('spawn');
    expect(events).toEqual(['died:bullet', 'spawned']);
    rig.until(() => rig.p.state === 'play', 60);
    expect(rig.p.y).toBe(FLOOR);
    expect(rig.p.invulnTicks).toBeGreaterThan(60);
    // A new life: start weapon and bombs again.
    expect(rig.p.weapon.id).toBe('pistol');
    expect(rig.session.slots[0].bombs).toBe(TUNING.grenade.perLife);
  });

  it('shots pass through while invulnerable', () => {
    const rig = new Rig();
    rig.p.invulnTicks = 100;
    enemyShot(rig, 30);
    rig.run(30);
    expect(rig.p.state).toBe('play');
  });

  it('god mode ignores hits', () => {
    const rig = new Rig();
    rig.world.god = true;
    enemyShot(rig, 30);
    rig.run(30);
    expect(rig.p.state).toBe('play');
  });

  it('the last life ends in "out" and a playerOut event', () => {
    const rig = new Rig();
    let out = -1;
    rig.world.events.on('playerOut', (e) => (out = e.slot));
    rig.session.slots[0].lives = 1;
    enemyShot(rig);
    rig.until(() => rig.p.state === 'dead', 60);
    rig.run(TUNING.life.deathAnimTicks + 1);
    expect(rig.p.state).toBe('out');
    expect(out).toBe(0);
    expect(rig.session.slots[0].gameOver).toBe(true);
    expect(rig.session.allOut).toBe(true);
    // Continue: lives back, the player drops in with the gift weapon.
    expect(rig.session.continueSlot(0)).toBe(true);
    rig.p.continueGame();
    rig.until(() => rig.p.state === 'play', 80);
    expect(rig.session.slots[0].lives).toBe(TUNING.life.livesPerCredit);
    expect(rig.p.weapon.id).toBe(TUNING.continues.giftWeapon);
    expect(rig.session.slots[0].score).toBe(1); // the continue marker digit
  });

  it('falling into a pit kills even while invulnerable, then respawns on safe ground', () => {
    const rig = new Rig({ noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(200).gap(80).flat(2000) });
    rig.p.placeAt(150, FLOOR, 0);
    rig.p.invulnTicks = 1000;
    rig.hold(['right']);
    rig.until(() => rig.p.state === 'dead', 200);
    expect(rig.p.cause).toBe('pit');
    rig.release().until(() => rig.p.state === 'play', 200);
    const g = rig.world.terrain.groundY(rig.p.x);
    expect(Number.isFinite(g)).toBe(true);
    expect(rig.p.y).toBe(g);
  });

  it('never respawns into a hole under a closed hatch (a dynamic solid) or below the view', () => {
    // A 40-px hole whose floor (FLOOR + 60) is below the view, closed by a hatch at floor level
    // (the m4-b subway hatch soft-lock): the drop-in would fall through the hatch and be sealed in.
    const rig = new Rig({ noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(200).step(60).flat(40).step(-60).flat(2000) });
    rig.world.addSolid(new SolidBox(200, FLOOR, 40, 8));
    rig.p.placeAt(220, FLOOR, 0);
    rig.run(2);
    rig.p.kill('impact');
    rig.until(() => rig.p.state === 'play', 300);
    expect(rig.p.y).toBe(FLOOR);
    rig.run(30);
    expect(rig.p.y).toBe(FLOOR);
  });

  it('spikes kill through the damage pipeline; deep water drowns', () => {
    const rig = new Rig({ build: (t) => t.hazard('spikes', 140, FLOOR - 6, 30, 6) });
    rig.hold(['right']);
    rig.until(() => rig.p.state === 'dead', 120);
    expect(rig.p.cause).toBe('impact');
    const rig2 = new Rig({ build: (t) => t.hazard('water', 0, 100, 400, 100) });
    rig2.run(2);
    expect(rig2.p.cause).toBe('drown');
    expect(rig2.p.state).toBe('dead');
  });

  it('shallow water only slows the player down', () => {
    const rig = new Rig({ build: (t) => t.hazard('water', 0, FLOOR - 10, 2000, 20) });
    rig.hold(['right']).run(10);
    expect(rig.p.state).toBe('play');
    expect(rig.p.wading).toBe(true);
    expect(rig.p.vx).toBeLessThan(TUNING.player.runSpeed);
  });

  it('victory pose: no control, invulnerable', () => {
    const rig = new Rig();
    rig.p.victory();
    const x = rig.p.x;
    rig.hold(['right']).run(10);
    expect(rig.p.x).toBe(x);
    enemyShot(rig, 30);
    rig.run(20);
    expect(rig.p.state).toBe('victory');
  });
});
