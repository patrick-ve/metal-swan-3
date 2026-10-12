/**
 * The shared fx set (GDD §15.6, ARCHITECTURE §7.1, docs/api/game.md §5): every fx id and its old
 * alias is registered with sane, centre-anchored, palette-only frames; the helpers in
 * src/game/fx.ts spawn pooled effects that end on their own, never touch the gameplay rng, and
 * pick the right muzzle flash; explosions hurt each hostile once; the fx-* entity ids work.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Damage } from '../../src/engine/entity';
import { inPalette } from '../../src/engine/palette';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrames, hasSprite, listSprites } from '../../src/engine/sprites';
import type { World } from '../../src/engine/world';
import { Enemy } from '../../src/game/enemy';
import {
  confetti,
  dizzyStars,
  drawAimLine,
  drawShadow,
  explosion,
  FxEntity,
  heliumCloud,
  iceShatter,
  muzzleFlash,
  musicNotes,
  poof,
  snowPuff,
  steamPuff,
  tinFeathers,
  tumble,
} from '../../src/game/fx';
import { defineEntity, hasEntity, type SpawnParams } from '../../src/game/registry';
import { FLOOR, Rig } from '../game/helpers';

beforeAll(async () => {
  await import('../../src/game/content/weapons/art');
  await import('../../src/game/content/fx/art');
  await import('../../src/game/content/fx/index');
  // `fx/tin-feather` (GDD §15.6) is drawn by the Swan art.
  await import('../../src/game/content/vehicles/swan/art');
});

/** GDD §15.6 fx ids (without `muzzle-<weapon>`, tested in weapons.test.ts) and their minimum frames. */
const GDD_FX: Readonly<Record<string, number>> = {
  'explosion-s': 6,
  'explosion-m': 6,
  'explosion-l': 6,
  smoke: 4,
  soot: 4,
  poof: 4,
  dust: 4,
  confetti: 4,
  'music-note': 2,
  'steam-puff': 4,
  'helium-cloud': 2,
  splash: 4,
  spark: 3,
  shadow: 8,
  'aim-line': 1,
  'stars-dizzy': 4,
  'flying-shako': 4,
  'stick-on-moustache': 4,
  'snow-puff': 4,
  'ice-cubes': 3,
  'tin-feather': 4,
};

/** Older names other code draws (kept as aliases). */
const OLD_FX = ['explosion-xl', 'smoke-puff', 'soot-cloud', 'hit', 'hit-spark', 'impact', 'stun-stars', 'confetti-bit', 'parachute'];

class Victim extends Enemy {
  readonly hits: Damage[] = [];
  constructor(world: World, x: number, y: number, params: SpawnParams = {}) {
    super(world, x, y, params, { art: 'enemy/dummy', hp: 10, soft: true });
  }
  override onHit(d: Damage, part = 0): boolean {
    this.hits.push({ ...d });
    return super.onHit(d, part);
  }
}
defineEntity('test-victim', (w, x, y, p) => new Victim(w, x, y, p), { category: 'enemy', score: 100 });

function fxOf(rig: Rig): FxEntity[] {
  return rig.world.entities.filter((e): e is FxEntity => e instanceof FxEntity && !e.removed);
}

describe('fx sprites', () => {
  it.each(Object.keys(GDD_FX))('fx/%s is registered with its frames', (id) => {
    const sid = `fx/${id}`;
    expect(hasSprite(sid), sid).toBe(true);
    expect(frameCount(sid), sid).toBeGreaterThanOrEqual(GDD_FX[id]);
  });

  it('keeps the old names (aliases) and the drop canopy', () => {
    for (const id of OLD_FX) expect(hasSprite(`fx/${id}`), id).toBe(true);
    expect(frameCount('fx/smoke')).toBe(frameCount('fx/smoke-puff'));
    expect(frameCount('fx/soot')).toBe(frameCount('fx/soot-cloud'));
    // The canopy is 34×16 (infantry draws its cords from x ±14 at the hem).
    const f = getFrames('fx/parachute')[0];
    expect([f.buf.w, f.buf.h]).toEqual([34, 16]);
  });

  it('every fx frame has pixels, palette colours only, and a centre anchor', () => {
    const ids = listSprites('fx/').filter((id) => !id.startsWith('fx/muzzle'));
    expect(ids.length).toBeGreaterThan(30);
    for (const id of ids) {
      getFrames(id).forEach((f, i) => {
        const label = `${id}[${i}]`;
        expect(Math.abs(f.ox - f.buf.w / 2), label).toBeLessThanOrEqual(1);
        // Dust and splashes sit on the ground line (anchored near their bottom).
        if (id !== 'fx/dust' && id !== 'fx/splash') expect(Math.abs(f.oy - f.buf.h / 2), label).toBeLessThanOrEqual(1);
        const d = f.buf.data;
        for (let k = 0; k < d.length; k++) {
          if ((d[k] & 255) === 0) continue;
          if (!inPalette(d[k])) throw new Error(`${label} has a colour outside the palette: #${d[k].toString(16)}`);
        }
      });
    }
  });

  it('the dying frames of an explosion are no bigger than the fireball; the shadow grows by 4 px a frame', () => {
    const shadow = getFrames('fx/shadow');
    expect(shadow.length).toBe(11);
    shadow.forEach((f, i) => expect(f.buf.w).toBe(8 + 4 * i));
    const ice = getFrames('fx/ice-cubes');
    for (const f of ice) expect(f.buf.w).toBeLessThanOrEqual(8);
    // The helium cloud is 48×48 (GDD §4.13).
    const h = getFrames('fx/helium-cloud')[0];
    expect(h.buf.w).toBeGreaterThanOrEqual(46);
    expect(h.buf.w).toBeLessThanOrEqual(50);
  });
});

describe('fx helpers', () => {
  it('every helper spawns pooled effects that end on their own', () => {
    const rig = new Rig();
    const w = rig.world;
    const d = rig.dummy(300);
    poof(w, 200, 120);
    confetti(w, 210, 120);
    musicNotes(w, 220, 120, 3);
    steamPuff(w, 230, 120);
    snowPuff(w, 240, FLOOR);
    iceShatter(w, 250, 150);
    tinFeathers(w, 260, 150, 3, 1);
    dizzyStars(w, d, -40, 60);
    tumble(w, 'fx/flying-shako', 270, 130, 1, -2);
    heliumCloud(w, 280, 120, 120);
    rig.run(1);
    const sprites = new Set(fxOf(rig).map((f) => f.sprite));
    for (const s of ['fx/poof', 'fx/confetti', 'fx/music-note', 'fx/steam-puff', 'fx/snow-puff', 'fx/stars-dizzy', 'fx/flying-shako', 'fx/helium-cloud']) {
      expect(sprites.has(s), s).toBe(true);
    }
    expect(w.particles.count).toBeGreaterThan(10);
    rig.run(125);
    expect(fxOf(rig).length).toBe(0);
    expect(w.errors).toEqual([]);
  });

  it('effects are pooled: a finished POOF is reused by the next one', () => {
    const rig = new Rig();
    poof(rig.world, 200, 120);
    rig.run(1);
    const first = fxOf(rig)[0];
    rig.run(40);
    expect(first.removed).toBe(true);
    poof(rig.world, 220, 120);
    rig.run(1);
    expect(fxOf(rig)[0]).toBe(first);
  });

  it('cosmetic only: the gameplay rng is never used', () => {
    const a = new Rig({ seed: 3 });
    const b = new Rig({ seed: 3 });
    confetti(a.world, 200, 100, 30);
    iceShatter(a.world, 200, 100, 12);
    musicNotes(a.world, 200, 100, 4);
    explosion(a.world, 200, 150, 'l');
    a.run(30);
    b.run(30);
    expect(a.world.rng.next()).toBe(b.world.rng.next());
  });

  it('explosion: each hostile in the radius is hit once; the size sets the radius; the event says so', () => {
    const rig = new Rig();
    const near = rig.world.spawn('test-victim', 300, FLOOR, { hp: 500 }) as Victim;
    const edge = rig.world.spawn('test-victim', 330, FLOOR, { hp: 500 }) as Victim;
    const far = rig.world.spawn('test-victim', 360, FLOOR, { hp: 500 }) as Victim;
    rig.world.flush();
    const events: { size: string; r: number }[] = [];
    rig.world.events.on('explosion', (e) => events.push({ size: e.size, r: e.r }));
    const fx = explosion(rig.world, 300, FLOOR - 10, 'm', { damage: 100, team: 'player', owner: 0, falloff: 0, weapon: 'grenade' });
    expect(fx.sprite).toBe('fx/explosion-m');
    rig.run(2);
    expect(near.hits.map((h) => [h.amount, h.kind, h.weapon])).toEqual([[100, 'explosion', 'grenade']]);
    expect(edge.hits.length).toBe(1); // its box starts 23 px away (r 24)
    expect(far.hits.length).toBe(0);
    expect(events).toEqual([{ size: 'm', r: 24 }]);
    // Same team: harmless.
    explosion(rig.world, 300, FLOOR - 10, 'm', { damage: 100, team: 'enemy' });
    expect(near.hits.length).toBe(1);
  });

  it('muzzleFlash: the weapon flash family, the up and diagonal variants, flipped to the aim', () => {
    const rig = new Rig();
    const w = rig.world;
    const ids = (): string[] => fxOf(rig).map((f) => f.sprite);
    expect(muzzleFlash(w, 100, 100, 0, { kind: 'heavy', weapon: 'shotgun' }).sprite).toBe('fx/muzzle-shotgun');
    expect(muzzleFlash(w, 100, 100, -Math.PI / 2, { kind: 'heavy', weapon: 'shotgun' }).sprite).toBe('fx/muzzle-shotgun-up');
    expect(muzzleFlash(w, 100, 100, -Math.PI / 4, { kind: 'heavy', weapon: 'shotgun' }).sprite).toBe('fx/muzzle-shotgun-diag');
    const left = muzzleFlash(w, 100, 100, Math.PI, { kind: 'pistol' });
    expect(left.sprite).toBe('fx/muzzle');
    expect(left.flipX).toBe(true);
    const down = muzzleFlash(w, 100, 100, Math.PI / 2, { kind: 'heavy' });
    expect(down.sprite).toBe('fx/muzzle-heavy-up');
    expect(down.flipY).toBe(true);
    // A weapon without its own family uses the generic heavy flash.
    expect(muzzleFlash(w, 100, 100, 0, { kind: 'heavy', weapon: 'no-such-gun' }).sprite).toBe('fx/muzzle-heavy');
    w.flush();
    expect(ids().length).toBe(6);
  });

  it('drawShadow and drawAimLine draw (world space) without errors', () => {
    const r = new SoftRenderer(64, 32);
    r.begin(0x000000ff);
    drawShadow(r, 32, 20, 24);
    drawAimLine(r, 2, 4, 60, 4, false, 0);
    drawAimLine(r, 2, 8, 60, 8, true);
    r.end();
    const px = (x: number, y: number): number => r.target.get(x, y);
    expect(px(32, 20)).not.toBe(0x000000ff); // the shadow (see-through ink)
    expect(px(2, 4)).not.toBe(0x000000ff);
    expect(px(3, 4)).toBe(0x000000ff); // dotted: every other pixel
    expect(px(3, 8)).not.toBe(0x000000ff); // locked: solid
  });
});

describe('fx entity ids (mission scripts)', () => {
  const IDS = [
    'fx-explosion',
    'fx-explosion-chain',
    'fx-smoke',
    'fx-sparks',
    'fx-debris',
    'fx-dust',
    'fx-splash',
    'fx-poof',
    'fx-confetti',
    'fx-music-notes',
    'fx-steam',
    'fx-snow-puff',
    'fx-ice-shatter',
    'fx-tin-feathers',
    'fx-stars-dizzy',
    'fx-helium-cloud',
  ];

  it.each(IDS)('%s spawns and runs', (id) => {
    expect(hasEntity(id)).toBe(true);
    const rig = new Rig();
    const e = rig.world.spawn(id, 300, 120, { life: 60 });
    expect(e.hasTag('placeholder')).toBe(false);
    rig.run(90);
    expect(rig.world.errors).toEqual([]);
  });

  it('fx-explosion with damage hurts the other team only', () => {
    const rig = new Rig();
    const v = rig.world.spawn('test-victim', 300, FLOOR, { hp: 500 }) as Victim;
    rig.world.flush();
    rig.world.spawn('fx-explosion', 300, FLOOR - 8, { size: 'm', damage: 40, team: 'player' });
    rig.run(2);
    expect(v.hits.length).toBe(1);
    expect(rig.p.alive).toBe(true);
  });

  it('fx-steam keeps puffing at its rate', () => {
    const rig = new Rig();
    rig.world.spawn('fx-steam', 300, 120, { rate: 10, life: 100 });
    let most = 0;
    for (let i = 0; i < 60; i++) {
      rig.run(1);
      most = Math.max(most, fxOf(rig).filter((f) => f.sprite === 'fx/steam-puff').length);
    }
    expect(most).toBeGreaterThanOrEqual(2);
  });
});
