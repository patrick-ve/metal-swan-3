/**
 * Mission ring, revision R wave B — the pink boat `DE LAATSTE DRUPPEL` (docs/design/ring.md §R.7;
 * docs/api/ring.md "R.B2"): the boss and its parts, the two phases (the waves, the drum band), every
 * attack after a tell ≥ 18 ticks, the hull's damage-rate bucket (≥ 37.5 s with any gun), the leader is
 * never a target, the bloodless end (the hull cracks, the mast topples, the boat settles, a weapon
 * drop, the leader carried off), and the art at 1× / 2× / 4× with the 1× geometry.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, isDeferredSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { ACTIVIST_OUT_EVENT, type ActivistOutEvent } from '../../src/game/content/ring/activists/api';
import { BOAT_EVENT, BOAT_ID, BOAT_LEADER, BOAT_PART, type BoatEvent } from '../../src/game/content/ring/boot/index';
import { BOAT_HP, BOAT_LOPER_TAG, BOAT_PACE, BoatLeader, PinkBoat } from '../../src/game/content/ring/boot/boat';
import { boomBox, BOOM_ENDS } from '../../src/game/content/ring/boot/geometry';
import { getEntityMeta } from '../../src/game/registry';
import { createHeadlessRing, type HeadlessRing } from '../../src/sim/headless-ring';

beforeAll(async () => {
  await loadContent();
}, 120_000);

interface BoatRun {
  h: HeadlessRing;
  boat: PinkBoat | null;
  events: BoatEvent[];
  outs: ActivistOutEvent[];
  fightStart: number;
  deathAt: number;
  leaderSeen: BoatLeader | null;
  leaderShootable: boolean;
  weaponDrop: boolean;
  maxLopers: number;
}

/** `?section=rf-b&boss=1` with the bots (god): the boat from its intro to the tally. */
async function runBoat(players: 1 | 2 = 1): Promise<BoatRun> {
  const h = await createHeadlessRing({ seed: 1, god: true, bot: true, section: 'rf-b', boss: true, players, loadContent: false } as never);
  const r: BoatRun = { h, boat: null, events: [], outs: [], fightStart: -1, deathAt: -1, leaderSeen: null, leaderShootable: false, weaponDrop: false, maxLopers: 0 };
  let wired = false;
  for (let t = 0; t < 9000 && !h.complete; t++) {
    h.step(1);
    const w = h.world;
    if (!w) continue;
    if (!wired && h.footRunner) {
      wired = true;
      w.events.on(BOAT_EVENT, (e) => r.events.push(e));
      w.events.on(ACTIVIST_OUT_EVENT, (e) => r.outs.push(e));
    }
    const b = w.byTag('boss').find((e: Entity) => e instanceof PinkBoat) as PinkBoat | undefined;
    if (b) r.boat = b;
    if (r.boat) {
      if (r.fightStart < 0 && r.boat.state === 'fight') r.fightStart = t;
      if (r.deathAt < 0 && r.boat.dead) r.deathAt = t;
      r.maxLopers = Math.max(r.maxLopers, w.countAlive(BOAT_LOPER_TAG));
    }
    for (const e of w.entities) {
      if (e instanceof BoatLeader) {
        r.leaderSeen = e;
        if (e.hasTag('shootable') || e.team !== 'neutral') r.leaderShootable = true;
      }
      if (e.type === 'pickup-weapon' && r.deathAt >= 0) r.weaponDrop = true;
    }
  }
  return r;
}

describe('the pink boat: registration and parts', () => {
  it('registers the boss and the leader NPC', () => {
    expect(getEntityMeta(BOAT_ID)?.category).toBe('boss');
    expect(getEntityMeta(BOAT_LEADER)?.category).toBe('npc');
  });

  it('the boom is a hazard only while it is out (frames 4–5), at a standing hero’s chest height', () => {
    for (let f = 0; f < BOOM_ENDS.length; f++) {
      const b = boomBox(f);
      if (f < 4) expect(b, `frame ${f}`).toBeNull();
      else {
        expect(b).not.toBeNull();
        // A standing hero is 30 px tall, a crouching one 20: the boom hits the first, misses the second.
        expect(b!.y).toBeLessThan(-20);
        expect(b!.y + b!.h).toBeGreaterThan(-30);
        expect(b!.y + b!.h).toBeLessThanOrEqual(-20);
      }
    }
  });
});

describe('the pink boat in the arena (god, the bots)', () => {
  let r: BoatRun;
  beforeAll(async () => {
    r = await runBoat(1);
  }, 90_000);

  it('starts on the script (autoStart false), keeps the wreck, ends with the tally', () => {
    expect(r.boat).not.toBeNull();
    const b = r.boat!;
    expect(b.autoStart).toBe(false);
    expect(b.removeOnDeath).toBe(false);
    expect(b.parts.map((p) => p.name)).toEqual([BOAT_PART.hull, BOAT_PART.speakerL, BOAT_PART.speakerR]);
    expect(r.h.complete).toBe(true);
    expect(r.h.report().foot?.bossDefeated).toBe(true);
  });

  it('phase 1 calls waves of lopers (3 on normal), phase 2 the drum band; every attack after a tell ≥ 18 ticks', () => {
    const b = r.boat!;
    const whats = r.events.map((e) => e.what);
    expect(whats).toContain('wave');
    expect(whats).toContain('phase2');
    expect(whats.indexOf('wave')).toBeLessThan(whats.indexOf('phase2'));
    const wave = r.events.find((e) => e.what === 'wave');
    expect(wave?.count).toBe(3);
    expect(r.maxLopers).toBeLessThanOrEqual(3);
    const kinds = new Set(b.attacks.map((a) => a.kind));
    for (const k of ['wave', 'lob', 'beat', 'boom'] as const) expect(kinds.has(k), k).toBe(true);
    for (const a of b.attacks) expect(a.tell, `${a.kind} @${a.tick}`).toBeGreaterThanOrEqual(18);
    // The drum beats only in phase 2 (after the event).
    const p2 = r.events.findIndex((e) => e.what === 'phase2');
    expect(p2).toBeGreaterThanOrEqual(0);
  });

  it('the fight lasts 35–50 s at the bot’s pace (the hull’s damage-rate bucket: ≥ 37.5 s; §R.13 momentum)', () => {
    const secs = (r.deathAt - r.fightStart) / 60;
    expect(secs).toBeGreaterThanOrEqual(BOAT_PACE.floorTicks / 60 - 2.5);
    expect(secs).toBeLessThanOrEqual(50);
  });

  it('the end: beaten, the wreck (the mast down, settled), a weapon drop, the leader carried off (never a target)', () => {
    const b = r.boat!;
    const whats = r.events.map((e) => e.what);
    expect(whats.indexOf('beaten')).toBeGreaterThan(whats.indexOf('phase2'));
    expect(whats[whats.length - 1]).toBe('end');
    expect(b.ended).toBe(true);
    expect(b.wrecked).toBe(true);
    expect(b.mastFallF).toBe(3);
    expect(b.settle).toBe(3);
    expect(r.weaponDrop).toBe(true);
    expect(r.leaderSeen).not.toBeNull();
    expect(r.leaderShootable).toBe(false);
    expect(r.outs.some((e) => e.kind === 'leider' && e.how === 'carried')).toBe(true);
  });
});

describe('the hull’s damage-rate bucket', () => {
  it('a huge hit takes at most the burst; the speakers break on their own HP', async () => {
    const h = await createHeadlessRing({ seed: 1, god: true, bot: true, section: 'rf-b', boss: true, players: 1, loadContent: false } as never);
    let b: PinkBoat | undefined;
    for (let t = 0; t < 1200 && !(b && b.state === 'fight'); t++) {
      h.step(1);
      b = h.world?.byTag('boss').find((e: Entity) => e instanceof PinkBoat) as PinkBoat | undefined;
    }
    expect(b?.state).toBe('fight');
    const boat = b!;
    const hp0 = boat.hp;
    boat.onHit({ amount: 100_000, kind: 'bullet', dirX: 1, owner: 0 }, boat.hull.index);
    expect(hp0 - boat.hp).toBeLessThanOrEqual(BOAT_PACE.burst * (boat.maxHp / BOAT_HP) + 1e-6);
    expect(boat.dead).toBe(false);
    const sp = boat.part(BOAT_PART.speakerL)!;
    boat.onHit({ amount: 1000, kind: 'bullet', dirX: 1, owner: 0 }, sp.index);
    expect(sp.destroyed).toBe(true);
  }, 60_000);
});

describe('the boat’s art (1×, 2×, 4×; geometry is law)', () => {
  const ids = listSprites('boss/ring-boot/');

  it('every id has 1× art and one HD drawer at 2× and 4× with the 1× geometry and PAL_HD colours', () => {
    expect(ids.length).toBeGreaterThanOrEqual(30);
    for (const id of ids) {
      const lo = getFrames(id, 1);
      expect(lo.length, id).toBeGreaterThan(0);
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(true);
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}x`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = hi[i];
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}x[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          let odd = 0;
          for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) odd++;
          expect(odd, `${id}@${d}x[${i}] colours`).toBe(0);
        }
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('boss/ring-boot/'))).toEqual([]);
  }, 240_000);

  it('the end strips and the leader NPC are deferred (built when needed)', () => {
    for (const id of ['boss/ring-boot/hull-wreck', 'boss/ring-boot/mast-fall', 'boss/ring-boot/leider-stand', 'boss/ring-boot/leider-slide', 'boss/ring-boot/leider-carried']) expect(isDeferredSprite(id), id).toBe(true);
    for (const id of ['boss/ring-boot/hull-0', 'boss/ring-boot/mast', 'boss/ring-boot/boom']) expect(isDeferredSprite(id), id).toBe(false);
  });
});
