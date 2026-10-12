/**
 * The rifleman (GDD §9.1, §4.11): noticing, telegraphed chest-high shots, attack tokens, gags,
 * deaths by damage kind, entry modes, the enemy grenade, determinism.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/infantry/art';
import { attackTokenLimit, LobGrenade, RIFLEMAN, Rifleman, SNOWMAN_X } from '../../src/game/content/infantry/index';
import { FLOOR, TestWorld } from './helpers';

const isShot = (e: Entity): boolean => e.type === 'rifleman-shot' && !e.removed;

/** A rifleman in the default skin tone (skin 'a': the plain `enemy/rifleman…` sets). */
function rifleman(tw: TestWorld, x: number, params: Record<string, unknown> = {}): Rifleman {
  return tw.spawn('rifleman', x, { gag: false, facing: -1, skin: 'a', ...params }) as Rifleman;
}

describe('rifleman', () => {
  it('notices a player in front, telegraphs at least 18 ticks, then fires a chest-high bullet', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 3 });
    const r = rifleman(tw, 260, { grenades: false });
    let aimStart = -1;
    let shotAt = -1;
    let shot: Entity | undefined;
    for (let t = 0; t < 400 && !shot; t++) {
      tw.run(1);
      if (r.mode === 'aim' && aimStart < 0) aimStart = t;
      shot = tw.world.entities.find(isShot);
      if (shot) shotAt = t;
    }
    expect(r.alerted).toBe(true);
    expect(shot).toBeDefined();
    expect(shotAt - aimStart).toBeGreaterThanOrEqual(18);
    const s = shot as Entity;
    expect(s.vx).toBeLessThan(0);
    // Chest height (dodge it by crouching) or the low crouch shot (jump it).
    const above = FLOOR - s.y;
    expect([RIFLEMAN.chestY, RIFLEMAN.lowY]).toContain(Math.round(above));
    if (Math.round(above) === RIFLEMAN.chestY) expect(s.y + s.hitbox.h / 2).toBeLessThan(FLOOR - 20);
    // Slow and readable: about 2.5 px/tick.
    expect(Math.abs(s.vx)).toBeCloseTo(RIFLEMAN.bulletSpeed, 1);
  });

  it('keeps the attack-token cap: never more than 4 soldiers attack at once (NORMAL)', () => {
    const tw = new TestWorld({ playerX: 300, god: true, seed: 8, width: 900 });
    const squad: Rifleman[] = [];
    for (let i = 0; i < 8; i++) squad.push(rifleman(tw, 420 + i * 22, { range: 120 + i * 4 }));
    expect(attackTokenLimit(tw.world)).toBe(4);
    let most = 0;
    let attacks = 0;
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      let n = 0;
      for (const r of squad) if (r.alive && (r.mode === 'aim' || r.mode === 'recover' || r.mode === 'windup' || r.mode === 'swing')) n++;
      if (n > most) most = n;
      attacks += n > 0 ? 1 : 0;
    }
    expect(most).toBeLessThanOrEqual(4);
    expect(attacks).toBeGreaterThan(0);
  });

  it('a soldier in a gag does not attack, and killing him then pays CAUGHT NAPPING', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4 });
    // Facing away from the player, 220 px off: outside the 48 px "behind" notice range.
    const r = rifleman(tw, 320, { gag: true, facing: 1 });
    tw.run(240);
    expect(r.mode).toBe('gag');
    expect(tw.world.entities.some(isShot)).toBe(false);
    tw.world.damage(r, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(r.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(200);
    expect(tw.hud.callouts.some((c) => c.text === 'CAUGHT NAPPING +100')).toBe(true);
  });

  it('wakes from a gag when a player shot lands next to him', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4 });
    const r = rifleman(tw, 320, { gag: true, facing: 1 });
    tw.run(10);
    tw.player!.facing = 1;
    tw.hold('fire').run(1).hold().run(40);
    expect(['notice', 'move', 'aim', 'crouch', 'recover', 'windup']).toContain(r.mode);
  });

  it.each([
    ['knife', 'die-knife'],
    ['explosion', 'die-blast'],
    ['fire', 'die-burn'],
    ['bullet', 'die'],
  ] as const)('a %s kill plays %s', (kind, anim) => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const r = rifleman(tw, 300);
    tw.world.damage(r, { amount: 30, kind, dirX: 1, owner: 0 });
    expect(r.dead).toBe(true);
    expect(r.anim.id).toBe(`enemy/rifleman/${anim}`);
    expect(tw.session.slots[0].stats.kills).toBe(1);
    // Knife kills score five times as much.
    expect(tw.session.slots[0].score).toBe(kind === 'knife' ? 500 : 100);
  });

  it('runs in from off-screen when entered from a side, already alerted', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const cam = tw.world.camera;
    const r = tw.spawn('rifleman', cam.right + 24, { facing: -1, enter: 'right' }) as Rifleman;
    expect(r.mode).toBe('enter');
    expect(r.alerted).toBe(true);
    tw.run(120);
    expect(r.x).toBeLessThan(cam.right - 20);
    expect(r.mode).not.toBe('enter');
  });

  it('drops in from above and lands on the floor', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const r = tw.spawn('rifleman', 260, { enter: 'top' }, tw.world.camera.top - 30) as Rifleman;
    expect(r.mode).toBe('drop');
    tw.run(90);
    expect(r.y).toBe(FLOOR);
    expect(r.mode).not.toBe('drop');
  });

  it('pops up from cover only when a player comes near', () => {
    const tw = new TestWorld({ playerX: 100, god: true, width: 1200 });
    const r = tw.spawn('rifleman', 260, { entry: 'popup', facing: -1 }) as Rifleman;
    tw.run(5);
    expect(r.mode).toBe('notice');
    const far = tw.spawn('rifleman', 700, { entry: 'popup', facing: -1 }) as Rifleman;
    tw.run(5);
    expect(far.mode).toBe('hide');
  });

  it('is deterministic for a seed', () => {
    const positions = (seed: number): string => {
      const tw = new TestWorld({ playerX: 100, god: true, seed });
      const squad = [rifleman(tw, 300), rifleman(tw, 340, { gag: true }), rifleman(tw, 380), rifleman(tw, 420)];
      tw.run(500);
      return squad.map((r) => `${r.x.toFixed(2)},${r.mode}`).join(' ') + ` shots=${tw.world.entities.filter(isShot).length}`;
    };
    expect(positions(21)).toBe(positions(21));
  });

  it('stops at a pit edge instead of walking in', () => {
    const tw = new TestWorld({
      playerX: 60,
      god: true,
      width: 1200,
      noFloor: true,
      build: (t) => {
        t.ground().at(0, FLOOR).flat(250).gap(60).flat(890);
      },
    });
    // His patrol (250–430) crosses the pit at 250–310; he must turn at its edge.
    const r = rifleman(tw, 340, { patrol: 90 });
    let minX = Infinity;
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      minX = Math.min(minX, r.x);
    }
    expect(r.alive).toBe(true);
    expect(r.y).toBe(FLOOR);
    expect(minX).toBeGreaterThan(310);
  });
});

describe('rifleman upgrades (GDD §9.0 / §15.6)', () => {
  it('plays the strip of his own gag (gag-<name>)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const r = rifleman(tw, 400, { gag: 'newspaper', facing: 1 });
    tw.run(3);
    expect(r.mode).toBe('gag');
    expect(r.anim.id).toBe('enemy/rifleman/gag-newspaper');
  });

  it('outfits pick their own art (enemy/rifleman-<outfit>/…)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    for (const o of ['deck', 'desert', 'snow', 'night']) {
      const r = rifleman(tw, 400, { gag: 'nap', facing: 1, outfit: o });
      tw.run(2);
      expect(r.anim.id).toBe(`enemy/rifleman-${o}/gag-nap`);
    }
  });

  it('the snowman he built stays; killed, it loses its head (the head rolls away)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const r = rifleman(tw, 400, { gag: 'snowman', facing: 1, outfit: 'snow' });
    tw.run(5);
    tw.world.damage(r, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(1);
    const props = tw.world.entities.filter((e) => e.type === 'soldier-prop') as unknown as Array<{ sprite: string; frame: number; x: number }>;
    const snowman = props.find((p) => p.sprite === 'enemy/rifleman-snow/snowman');
    expect(snowman).toBeDefined();
    expect(snowman!.frame).toBe(1);
    expect(snowman!.x).toBe(400 + SNOWMAN_X);
    expect(props.some((p) => p.sprite === 'enemy/rifleman-snow/snowman-head')).toBe(true);
  });

  it('drops his stolen cone when the ice-cream gag ends', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    rifleman(tw, 300, { gag: 'ice-cream', facing: 1 });
    tw.run(5);
    tw.hold('fire').run(1).hold().run(30);
    const props = tw.world.entities.filter((e) => e.type === 'soldier-prop') as unknown as Array<{ sprite: string }>;
    expect(props.some((p) => p.sprite === 'enemy/rifleman/cone')).toBe(true);
  });

  it('IN STEP!: his cooldowns run 1/0.7 as fast for 240 ticks', () => {
    const tw = new TestWorld({ playerX: null, god: true });
    const a = rifleman(tw, 300);
    const b = rifleman(tw, 500);
    tw.run(2);
    expect(a.react('buff', 240)).toBe(true);
    expect(a.inStep).toBe(true);
    a.cool = b.cool = 1000;
    tw.run(70);
    // 70 ticks: 70 ordinary + 30 extra (cooldown × 0.7).
    expect(b.cool - a.cool).toBe(30);
  });
});

describe('enemy grenade', () => {
  it('lands, blinks for 30 ticks, then explodes', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const g = LobGrenade.spawn(tw.world, { team: 'enemy', x: 300, y: FLOOR - 30, vx: 0, vy: 0, gravity: 0.15, damage: 10, sprite: 'enemy/grenade', w: 6, h: 6, blastSize: 's', blastDamage: 30, blastRadius: 14 } as never);
    tw.world.flush();
    tw.until(() => g.landed, 60);
    expect(g.hasTag('shootable')).toBe(true);
    expect(g.hasTag('soft')).toBe(true);
    tw.run(29);
    expect(g.removed).toBe(false);
    tw.run(3);
    expect(g.landed === false || g.removed).toBe(true);
  });

  it('is defused (50 points, no blast) when shot while lying on the ground', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const g = LobGrenade.spawn(tw.world, { team: 'enemy', x: 300, y: FLOOR - 4, vx: 0, vy: 0, gravity: 0.15, damage: 10, sprite: 'enemy/grenade', w: 6, h: 6 } as never);
    tw.world.flush();
    tw.until(() => g.landed, 60);
    tw.world.damage(g, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(g.removed).toBe(true);
    expect(tw.session.slots[0].score).toBe(50);
  });

  // infantry/art.ts and rifleman-gags.art.ts import each other, and art.ts registers the gag
  // strips at load time. Importing the gag module first (a test, a hot reload) must not hit a
  // "Cannot access ... before initialization" error.
  it('rifleman-gags.art can be imported before infantry/art (import cycle)', async () => {
    vi.resetModules();
    const gags = await import('../../src/game/content/infantry/rifleman-gags.art');
    const sprites = await import('../../src/engine/sprites');
    expect(Object.keys(gags.RIFLEMAN_GAG_STRIPS)).toHaveLength(9);
    expect(sprites.hasSprite('enemy/rifleman-snow/gag-snowman')).toBe(true);
    expect(sprites.getFrame('enemy/rifleman/gag-nap', 0).buf.w).toBeGreaterThan(0);
  });

  // GDD §9.0: the skin tone is picked per spawn (a cosmetic draw: the gameplay rng is untouched).
  it('picks a skin tone per spawn (params.skin or random), in every outfit, without touching world.rng', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4 });
    const arts = new Set<string>();
    for (let i = 0; i < 24; i++) arts.add((tw.spawn('rifleman', 300 + i * 4, { gag: false }) as Rifleman).art);
    expect([...arts].sort()).toEqual(['enemy/rifleman', 'enemy/rifleman-skinb', 'enemy/rifleman-skinc']);
    expect((tw.spawn('rifleman', 300, { skin: 'skinC', outfit: 'snow' }) as Rifleman).art).toBe('enemy/rifleman-snow-skinc');
    expect((tw.spawn('rifleman', 300, { skin: 'a', outfit: 'night' }) as Rifleman).art).toBe('enemy/rifleman-night');
    // Same gameplay rng with or without the skin draw.
    const a = new TestWorld({ seed: 9 });
    const b = new TestWorld({ seed: 9 });
    a.spawn('rifleman', 300, { skin: 'b' });
    b.spawn('rifleman', 300);
    expect(a.world.rng.next()).toBe(b.world.rng.next());
  });
});
