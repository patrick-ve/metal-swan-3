/**
 * Mission oldenzaal, revision 2 — THE DEAD SOLDIERS (src/game/content/oldenzaal/zombies/; spec §3,
 * docs/api/oldenzaal.md "ZOMBIES"): registration and art, every kind spawned with no params and
 * run for 600 ticks (a plain world and the oz-a street), the fairness rules (tells ≥ 18 ticks on
 * screen, attacks only in view, no shot from outside the view, one attack token at a time), every
 * entrance and its effect, the crawler's hold (taps, a hit, the bite), the collapse into bones
 * (bloodless; the helmet rolls), the cosmetic damage states, the gloat / cower, and the frikandel
 * explosion (R2-11).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { PAL } from '../../src/engine/palette';
import { PAL_HD } from '../../src/engine/palette-hd';
import { frameH, frameW } from '../../src/engine/render';
import { getFrames, hasSprite } from '../../src/engine/sprites';
import { hasSfx } from '../../src/engine/synth';
import { loadContent } from '../../src/game/content/index';
import { OLDENZAAL_ID, OZ_SFX, OZ_ZOMBIES, OZ_ZOMBIE_TAG } from '../../src/game/content/missions/oldenzaal/ids';
import { FRIKANDEL, frikandelExplosion, holyMayoBlast } from '../../src/game/content/oldenzaal/items/index';
import { KIT_PREFIX, ZTABLE } from '../../src/game/content/oldenzaal/zombies/art';
import { HEAD_NAMES, HEAD_TILTS, headId } from '../../src/game/content/oldenzaal/zombies/art-head';
import { CHUNK_ID, DUST_ID, EYE_ID, GUN_ANGLES, MG_GUN, RISE_LOOKS, SHOT_ID, riseId } from '../../src/game/content/oldenzaal/zombies/art-gear';
import { ZOMBIE_ID, ZOMBIE_KINDS, isZombie, marchColumn, spawnZombie, zombiesAlive, type ZombieEntity, type ZombieKind } from '../../src/game/content/oldenzaal/zombies/api';
import { OZ_STATUS_GRABBED, isGrabbed } from '../../src/game/content/oldenzaal/zombies/grab';
import { COLLAPSE, CRAWLER, FRIKANDEL_BLAST, GRUNT, GUNNER } from '../../src/game/content/oldenzaal/zombies/numbers';
import { DeadSoldier, ZSFX } from '../../src/game/content/oldenzaal/zombies/soldier';
import type { SectionContext } from '../../src/game/mission/index';
import { attackTokenLimit } from '../../src/game/enemy';
import { getEntityMeta } from '../../src/game/registry';
import type { Difficulty } from '../../src/game/session';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld, watchFairness, type FairnessOpts } from './helpers';

await loadContent();

const FAIR: FairnessOpts = {
  attacks: { strike: 'tell', shoot: 'tell', grab: 'tell' },
  tells: new Set(['tell']),
  watched: (e) => e.hasTag(OZ_ZOMBIE_TAG),
};

function world(o: { playerX?: number; god?: boolean; difficulty?: Difficulty; seed?: number } = {}): TestWorld {
  return new TestWorld({ playerX: o.playerX ?? 100, god: o.god ?? true, difficulty: o.difficulty ?? 'normal', seed: o.seed ?? 7, width: 1200 });
}

describe('dead soldiers: registration and art', () => {
  it('four enemies and three effects are registered; every sfx id has a recipe', () => {
    for (const k of ZOMBIE_KINDS) expect(getEntityMeta(ZOMBIE_ID[k])?.category, k).toBe('enemy');
    for (const id of [OZ_ZOMBIES.bones, OZ_ZOMBIES.helmet, OZ_ZOMBIES.rise]) expect(getEntityMeta(id)?.category, id).toBe('fx');
    for (const id of Object.values(ZSFX)) {
      expect(id.startsWith(OZ_SFX.zombie), id).toBe(true);
      expect(hasSfx(id), id).toBe(true);
    }
  });

  it('every body set has its strips (and a ZTABLE row per frame); the heads have a frame per tilt', () => {
    const need: Record<string, readonly string[]> = {
      [KIT_PREFIX.gruntTunic]: ['idle', 'walk', 'tell', 'strike', 'recover', 'stagger', 'rise', 'gloat', 'cower', 'die'],
      [KIT_PREFIX.gruntCoat]: ['idle', 'walk', 'tell', 'strike', 'recover', 'stagger', 'rise', 'gloat', 'cower', 'die'],
      [KIT_PREFIX.rifleman]: ['idle', 'walk', 'aim', 'fire', 'reload', 'stagger', 'rise', 'gloat', 'cower', 'die'],
      [KIT_PREFIX.gunner]: ['idle', 'walk', 'plant', 'aim', 'fire', 'cool', 'getup', 'stagger', 'rise', 'gloat', 'cower', 'die'],
      [KIT_PREFIX.crawler]: ['drag', 'tell', 'grab', 'hold', 'bite', 'recover', 'stagger', 'rise', 'gloat', 'cower', 'die'],
    };
    for (const [pre, strips] of Object.entries(need)) {
      for (const s of strips) {
        const id = pre + s;
        expect(hasSprite(id), id).toBe(true);
        expect(ZTABLE.get(id)?.length, id).toBe(getFrames(id, 1).length);
      }
    }
    for (const n of HEAD_NAMES) expect(getFrames(headId(n), 1).length, n).toBe(HEAD_TILTS.length);
    expect(getFrames(MG_GUN.carry, 1).length).toBe(GUN_ANGLES.length * 2);
    expect(getFrames(MG_GUN.plant, 1).length).toBe(GUN_ANGLES.length * 2);
    for (const l of RISE_LOOKS) expect(hasSprite(riseId(l)), l).toBe(true);
    for (const id of [CHUNK_ID, DUST_ID, EYE_ID, SHOT_ID.rifle, SHOT_ID.mg, 'fx/oz/zombie/helmet', 'fx/oz/zombie/cap']) expect(hasSprite(id), id).toBe(true);
  });

  it('geometry is law: the 2× and 4× frames have their 1× frame’s logical size and anchor', () => {
    const ids = [
      KIT_PREFIX.gruntTunic + 'strike',
      KIT_PREFIX.gruntCoat + 'walk',
      KIT_PREFIX.rifleman + 'aim',
      KIT_PREFIX.gunner + 'plant',
      KIT_PREFIX.crawler + 'drag',
      KIT_PREFIX.gruntTunic + 'die',
      KIT_PREFIX.crawler + 'rise',
      headId('helm-a'),
      MG_GUN.plant,
      riseId('pavers'),
    ];
    for (const id of ids) {
      const one = getFrames(id, 1);
      for (const d of [2, 4]) {
        const hd = getFrames(id, d);
        expect(hd.length, id).toBe(one.length);
        hd.forEach((f, i) => {
          expect(f.density, `${id} ${d}`).toBe(d);
          expect(frameW(f), `${id}#${i} @${d} w`).toBe(frameW(one[i]));
          expect(frameH(f), `${id}#${i} @${d} h`).toBe(frameH(one[i]));
          expect(f.ox, `${id}#${i} @${d} ox`).toBe(one[i].ox);
          expect(f.oy, `${id}#${i} @${d} oy`).toBe(one[i].oy);
        });
      }
    }
  });

  it('bloodless: no red in the heads, the effects, the shots or the MG (the band is the only red)', () => {
    const red = new Set<number>([...PAL.red, ...PAL_HD.red].map((c) => c >>> 0));
    const ids = [...HEAD_NAMES.map(headId), CHUNK_ID, DUST_ID, MG_GUN.carry, MG_GUN.plant, SHOT_ID.rifle, SHOT_ID.mg, ...RISE_LOOKS.map(riseId), 'fx/oz/zombie/helmet'];
    for (const id of ids) {
      for (const d of [1, 4]) {
        for (const f of getFrames(id, d)) {
          let n = 0;
          for (let i = 0; i < f.buf.data.length; i++) if ((f.buf.data[i] & 255) && red.has(f.buf.data[i] >>> 0)) n++;
          expect(n, `${id} @${d}`).toBe(0);
        }
      }
    }
  });
});

describe('dead soldiers: spawn and run', () => {
  it.each(ZOMBIE_KINDS)('%s: spawned with no params, 600 ticks in a plain world without errors', (kind) => {
    const tw = world();
    const z = tw.spawn(ZOMBIE_ID[kind], 320, {}) as ZombieEntity;
    expect(isZombie(z)).toBe(true);
    tw.run(600);
    expect(tw.world.errors).toEqual([]);
  });

  it('every kind in the oz-a street (the mission world) for 600 ticks without errors', async () => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: 'oz-a', seed: 2, players: 1, god: true, bot: false, captureConsole: true });
    try {
      g.step(5);
      const ctx = (g.runner as unknown as { ctx: SectionContext }).ctx;
      const hero = g.player(0)!;
      ZOMBIE_KINDS.forEach((k: ZombieKind, i) => spawnZombie(ctx, k, hero.x + 120 + i * 40, 'ground', i % 2 ? 'rise' : 'walk'));
      g.step(600);
      expect(g.report().errors).toEqual([]);
    } finally {
      g.dispose();
    }
  });
});

describe('dead soldiers: fairness (GDD §4.11)', () => {
  for (const difficulty of ['normal', 'hard'] as const) {
    it.each(ZOMBIE_KINDS)(`${difficulty}: %s tells ≥ 18 ticks on screen before every attack, attacks only in view`, (kind) => {
      const tw = world({ difficulty });
      tw.spawn(ZOMBIE_ID[kind], kind === 'crawler' || kind === 'grunt' ? 200 : 300, {});
      const w = watchFairness(tw, 1400, FAIR);
      expect(w.attacks.length, 'it attacked').toBeGreaterThan(0);
      for (const a of w.attacks) {
        expect(a.prev, `${a.id} ${a.mode} after ${a.prev}`).toBe('tell');
        expect(a.tell, `${a.id} ${a.mode}`).toBeGreaterThanOrEqual(18);
        expect(a.tellInView, `${a.id} ${a.mode} on screen`).toBeGreaterThanOrEqual(18);
        expect(a.inView, `${a.id} ${a.mode} in view`).toBe(true);
      }
      expect(w.outsideShots).toBe(0);
      expect(tw.world.errors).toEqual([]);
    });
  }

  it('a group takes turns (attack tokens) and nothing shoots from outside the view', () => {
    const tw = world({ playerX: 100 });
    // Two of each far right, outside the view: they must walk in before they attack.
    for (const [i, k] of (['rifleman', 'gunner', 'rifleman', 'grunt', 'grunt', 'crawler'] as const).entries()) tw.spawn(ZOMBIE_ID[k], 520 + i * 30, {});
    const w = watchFairness(tw, 1800, FAIR);
    expect(w.attacks.length).toBeGreaterThan(0);
    for (const a of w.attacks) expect(a.inView, `${a.id} ${a.mode}`).toBe(true);
    expect(w.outsideShots).toBe(0);
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(tw.world));
  });

  it('the rifleman’s shot is slow and at chest height on the level: a crouching hero ducks it', () => {
    const tw = world({ playerX: 100 });
    tw.spawn(ZOMBIE_ID.rifleman, 240, {});
    const shots: Entity[] = [];
    tw.until(() => {
      for (const e of tw.world.entities) if (e.team === 'enemy' && e.hasTag('shot') && !shots.includes(e)) shots.push(e);
      return shots.length > 0;
    }, 1200);
    const s = shots[0];
    expect(Math.abs(s.vx)).toBeLessThanOrEqual(2);
    expect(Math.abs(s.vy)).toBeLessThan(1e-9);
    // Over a crouching hero's 20-px box, into a standing hero's 30-px box.
    expect(FLOOR - s.y).toBeGreaterThan(20);
    expect(FLOOR - s.y).toBeLessThan(30);
  });

  it('the MG plants before it fires and sweeps from the chest down; it is the heaviest', () => {
    const tw = world({ playerX: 100 });
    const z = tw.spawn(ZOMBIE_ID.gunner, 300, {}) as DeadSoldier;
    expect(z.hp).toBeGreaterThan(GRUNT.hp * 2);
    const ys: number[] = [];
    let planted = false;
    tw.until(() => {
      if (z.mode === 'planted') planted = true;
      for (const e of tw.world.entities) if (e.team === 'enemy' && e.hasTag('shot') && e.age === 0) ys.push(e.vy);
      return ys.length >= GUNNER.burst;
    }, 1500);
    expect(planted).toBe(true);
    // The sweep goes down (vy grows) over the burst.
    expect(ys[ys.length - 1]).toBeGreaterThan(ys[0]);
  });
});

describe('dead soldiers: entrances', () => {
  it("'rise' cracks the floor (an oz-rise fx) during the tell, breaks it open, and the zombie climbs out", () => {
    const tw = world({ playerX: 60 });
    const z = spawnZombie(tw.world, 'grunt', 260, FLOOR, 'rise', { params: { surface: 'earth' } });
    tw.run(2);
    expect(z.hidden).toBe(true);
    const fx = tw.ofType(OZ_ZOMBIES.rise);
    expect(fx.length).toBe(1);
    tw.until(() => !z.hidden, 200);
    expect(z.entering).toBe(true);
    tw.until(() => !z.entering, 200);
    expect(z.hp).toBe(GRUNT.hp);
  });

  it("'manhole' without a cover entity: its own drain cover rattles and slides", () => {
    const tw = world({ playerX: 60 });
    const z = spawnZombie(tw.world, 'crawler', 250, FLOOR, 'manhole');
    tw.run(2);
    expect(tw.ofType(OZ_ZOMBIES.rise).length).toBe(1);
    tw.until(() => !z.entering, 300);
  });

  it("'burst' without a boarded door staggers out of a dust cloud (the fallback)", () => {
    const tw = world({ playerX: 60 });
    const z = spawnZombie(tw.world, 'grunt', 250, FLOOR, 'burst', { facing: -1 });
    tw.until(() => !z.hidden, 200);
    tw.until(() => !z.entering, 200);
    expect(z.facing).toBe(-1);
  });

  it("'march': the column shambles in step (one frame for all) until it breaks ranks", async () => {
    const g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: 'oz-c', seed: 3, players: 1, god: true, bot: false, captureConsole: true });
    try {
      g.step(2);
      const ctx = (g.runner as unknown as { ctx: SectionContext }).ctx;
      const col = marchColumn(ctx, ['grunt', 'grunt', 'rifleman', 'gunner', 'grunt']) as unknown as DeadSoldier[];
      g.step(30);
      const idx = col.map((z) => z.anim.index);
      expect(new Set(idx).size).toBe(1);
      g.step(1500);
      expect(col.some((z) => !z.entering)).toBe(true);
      expect(g.report().errors).toEqual([]);
    } finally {
      g.dispose();
    }
  });
});

describe('dead soldiers: the crawler’s hold', () => {
  function grabbed(god: boolean): { tw: TestWorld; z: DeadSoldier } {
    const tw = world({ playerX: 100, god });
    const z = tw.spawn(ZOMBIE_ID.crawler, 128, { facing: -1 }) as DeadSoldier;
    tw.until(() => z.holding !== null, 600);
    return { tw, z };
  }

  it('grabs a hero’s feet: no running, no jumping while held', () => {
    const { tw, z } = grabbed(true);
    const p = tw.player!;
    expect(isGrabbed(p)).toBe(true);
    expect(p.status.has(OZ_STATUS_GRABBED)).toBe(true);
    const x0 = p.x;
    tw.hold('left').run(20);
    expect(Math.abs(p.x - x0)).toBeLessThan(1);
    expect(z.holding).toBe(p);
  });

  it('tapping JUMP breaks it', () => {
    const { tw, z } = grabbed(true);
    const p = tw.player!;
    for (let i = 0; i < CRAWLER.taps; i++) {
      tw.hold('jump').run(1);
      tw.hold().run(2);
    }
    expect(z.holding).toBeNull();
    expect(isGrabbed(p)).toBe(false);
  });

  it('a hit on the crawler breaks it', () => {
    const { tw, z } = grabbed(true);
    tw.world.damage(z, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(1);
    expect(z.holding).toBeNull();
    expect(isGrabbed(tw.player!)).toBe(false);
  });

  it('held to the end, it bites (a visible tell first)', () => {
    const { tw, z } = grabbed(false);
    const p = tw.player!;
    let bite = false;
    tw.until(() => {
      if (z.playing('bite')) bite = true;
      return p.dead || z.holding === null;
    }, CRAWLER.hold + 40);
    expect(bite).toBe(true);
    expect(p.dead).toBe(true);
    expect(isGrabbed(p)).toBe(false);
  });

  it('the hold ends when the crawler dies', () => {
    const { tw, z } = grabbed(true);
    tw.world.damage(z, { amount: 1e6, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(2);
    expect(isGrabbed(tw.player!)).toBe(false);
  });
});

describe('dead soldiers: hits, the collapse, gloat and cower', () => {
  it('collapses into bones and dust: an oz-bones fx (the helmet rolls away), gone after the pile lies', () => {
    const tw = world({ playerX: 60 });
    const z = tw.spawn(ZOMBIE_ID.grunt, 260, { head: 'helm-a' }) as DeadSoldier;
    tw.run(2);
    tw.world.damage(z, { amount: 1e6, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(1);
    expect(z.removed).toBe(true);
    expect(zombiesAlive(tw.world)).toBe(0);
    const bones = tw.ofType(OZ_ZOMBIES.bones);
    expect(bones.length).toBe(1);
    tw.until(() => tw.ofType(OZ_ZOMBIES.helmet).length > 0, 120);
    tw.until(() => tw.ofType(OZ_ZOMBIES.bones).length === 0, 120 + COLLAPSE.lie + COLLAPSE.blink);
    expect(tw.world.errors).toEqual([]);
  });

  it('the gunner loses his helmet at 60 % and his barrel jacket at 30 % (cosmetic)', () => {
    const tw = world({ playerX: 60 });
    const z = tw.spawn(ZOMBIE_ID.gunner, 300, { head: 'helm-a' }) as DeadSoldier;
    tw.run(2);
    while (z.alive && z.hp / z.maxHp > 0.25) tw.world.damage(z, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(z.head).toBe('bare-a');
    expect(z.gunBroken).toBe(true);
    tw.run(5);
    expect(tw.ofType(OZ_ZOMBIES.helmet).length).toBe(1);
  });

  it('tanks: pistol hits do not stagger; a grenade-sized blast does, and not twice in a row', () => {
    const tw = world({ playerX: 60 });
    const z = tw.spawn(ZOMBIE_ID.grunt, 300, {}) as DeadSoldier;
    tw.run(2);
    tw.world.damage(z, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(1);
    expect(z.playing('stagger')).toBe(false);
    tw.world.damage(z, { amount: 30, kind: 'knife', dirX: 1, owner: 0 });
    tw.run(1);
    expect(z.playing('stagger')).toBe(true);
  });

  it('gloat: no attack, the gloat strip (no pointing, no laughing); cower: a flinch back', () => {
    const tw = world({ playerX: 150 });
    const z = tw.spawn(ZOMBIE_ID.grunt, 180, {}) as DeadSoldier;
    tw.run(2);
    z.react('gloat', 200, tw.player);
    const w = watchFairness(tw, 200, FAIR);
    expect(w.attacks).toEqual([]);
    expect(z.playing('gloat')).toBe(true);
    z.react('cower', 60, tw.player);
    tw.run(5);
    expect(z.playing('cower')).toBe(true);
  });
});

describe('the frikandel explosion (R2-11)', () => {
  it('heavy damage and a stagger to every dead soldier in a wide radius; nobody else outside it', () => {
    const tw = world({ playerX: 60 });
    const near = tw.spawn(ZOMBIE_ID.grunt, 300, {}) as DeadSoldier;
    const edge = tw.spawn(ZOMBIE_ID.gunner, 300 + FRIKANDEL_BLAST.radius - 4, {}) as DeadSoldier;
    const far = tw.spawn(ZOMBIE_ID.rifleman, 300 + FRIKANDEL_BLAST.radius + 40, {}) as DeadSoldier;
    tw.run(2);
    const hp = { edge: edge.hp, far: far.hp };
    const n = frikandelExplosion(tw.world, 300, FLOOR - 8, 0);
    expect(n).toBe(2);
    expect(near.alive).toBe(false); // 150 > GRUNT.hp
    expect(hp.edge - edge.hp).toBeGreaterThanOrEqual(FRIKANDEL_BLAST.edge - 1);
    expect(hp.edge - edge.hp).toBeLessThan(FRIKANDEL_BLAST.damage);
    expect(edge.playing('stagger')).toBe(true);
    expect(far.hp).toBe(hp.far);
    expect(tw.player!.alive).toBe(true);
    expect(holyMayoBlast).toBe(frikandelExplosion);
    expect(FRIKANDEL.radius).toBe(FRIKANDEL_BLAST.radius);
  });

  it('the thrown frikandel pops on a dead soldier and blows up (the fx and its hits)', () => {
    const tw = world({ playerX: 100 });
    const z = tw.spawn(ZOMBIE_ID.grunt, 150, {}) as DeadSoldier;
    tw.run(2);
    const hp = z.hp;
    tw.world.spawn('oz-frikandel', 120, FLOOR - 20, { vx: 1.5, vy: -0.5, owner: 0 });
    tw.until(() => tw.ofType('oz-frikandel-blast').length > 0, 120);
    tw.run(2);
    expect(z.alive ? z.hp < hp : true).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });
});
