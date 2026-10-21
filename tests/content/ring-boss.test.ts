/**
 * The ring's test mid-boss (`ring-lorry`, docs/design/ring.md §6) and its adds (`ring-forklift`,
 * `ring-barrel`): registration and the art at 1× / 2× / 4× (one drawer, the 1× geometry, PAL_HD);
 * inert-safe spawns from {} in a plain world and on the ring; the plan lock (on arrival) and its
 * release (after the jackknife), also through the westpoort-style boss slot; every attack after its
 * tell (≥ 18 ticks, on screen); a free lane in every cargo dump; the parts (doors, wheels, cab);
 * the continue's stagger holding the pattern; the cargo and the forklift's charge on a wagon; the
 * forklift's gloat and cower; the time to kill with the bot on normal (25–90 s by gun); its death never
 * ends the mission.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, setHiArt, spriteErrors } from '../../src/engine/sprites';
import { attackTokenLimit } from '../../src/game/enemy';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/ring/boss/art';
import { CARGO_AI, FORKLIFT_AI, LORRY, LORRY_AI, RingCargo, RingForklift, RingLorry } from '../../src/game/content/ring/boss/index';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/traffic/index';
import { laneY, nearestLane } from '../../src/game/ring/lanes';
import { createHeadlessRing } from '../../src/sim/headless-ring';
import { RingRig, tinyPlan } from '../game/ring/ring-helpers';
import { TestWorld, watchFairness, type TestWorld as TW } from './helpers';

const PREFIX = 'boss/ring-lorry/';

function rig(o: { god?: boolean } = {}): RingRig {
  const r = new RingRig({ god: o.god });
  r.run(2);
  return r;
}

/** The fairness watcher on a ring rig. */
function asTestWorld(r: RingRig): TW {
  return { world: r.world, run: (n = 1) => r.run(n) } as unknown as TW;
}

/** A lorry spawned just off the right edge in lane 1, run until its fight starts. */
function lorryIn(r: RingRig, params: Record<string, unknown> = {}): RingLorry {
  const l = r.spawnAt<RingLorry>('ring-lorry', 448, laneY(1), params);
  r.until(() => l.state === 'fight', 600);
  return l;
}

describe('ring-lorry: registration and art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    setHiArt(true);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('registers the boss and its adds', () => {
    for (const id of ['ring-lorry', 'ring-forklift', 'ring-barrel']) expect(hasEntity(id), id).toBe(true);
  });

  it('every strip has 1× art and one HD drawer at 2× and 4× with the 1× geometry and PAL_HD colours', () => {
    const ids = listSprites(PREFIX);
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
          expect(f.buf.countOpaque(), `${id}@${d}x[${i}] drawn`).toBeGreaterThan(0);
        }
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith(PREFIX))).toEqual([]);
  }, 120_000);
});

describe('ring-lorry: spawns and the plan', () => {
  it('runs 4000 ticks from {} in a plain world and on the ring without errors', () => {
    const errors: unknown[] = [];
    const tw = new TestWorld({ width: 4000 });
    tw.world.events.on('error', (e) => errors.push(e));
    tw.world.spawn('ring-lorry', 500, 180, {});
    tw.world.spawn('ring-forklift', 300, 180, {});
    tw.world.spawn('ring-barrel', 320, 180, {});
    tw.run(4000);
    const r = rig({ god: true });
    r.world.events.on('error', (e) => errors.push(e));
    r.spawnAt('ring-lorry', 448, laneY(1), {});
    r.spawnAt('ring-forklift', 300, laneY(3), {});
    r.spawnAt('ring-barrel', 280, laneY(2), {});
    r.run(4000);
    expect(errors).toEqual([]);
  });

  it('locks the plan on arrival, unlocks it when it dies; the mission goes on', () => {
    const r = rig({ god: true });
    const l = r.spawnAt<RingLorry>('ring-lorry', 448, laneY(1));
    expect(r.runner.planLocked).toBe(false);
    r.until(() => l.arrived, 400);
    expect(r.runner.planLocked).toBe(true);
    // It keeps pace with the camera: on screen at its home while the road scrolls.
    const d0 = r.runner.planDist;
    r.run(300);
    expect(r.runner.planDist).toBe(d0);
    expect(Math.abs(l.screenX - LORRY_AI.homeX)).toBeLessThanOrEqual(LORRY_AI.drift + 4);
    const score = r.session.slots[0].score;
    l.kill(0);
    expect(r.session.slots[0].score).toBeGreaterThanOrEqual(score + LORRY_AI.score);
    expect(r.runner.planLocked).toBe(false);
    r.until(() => l.defeated, 400);
    expect(l.dropped).not.toBeNull();
    expect(r.world.byTag('ring-crate').length).toBeGreaterThanOrEqual(1);
    r.run(400);
    expect(r.runner.state).toBe('playing');
    expect(l.removed).toBe(true);
  });

  it('the boss slot spawns it off the right edge; the plan holds until it is gone', () => {
    const plan = { ...tinyPlan({ length: 9000 }), bosses: [{ at: 300, id: 'ring-lorry', landmark: 'oost' as const, lane: 1 }] };
    const r = new RingRig({ plan, god: true });
    r.until(() => r.world.byTag('ring-lorry').length > 0, 400);
    const l = r.world.byTag('ring-lorry')[0] as RingLorry;
    expect(l.screenX).toBeGreaterThan(r.world.camera.w);
    expect(l.lane).toBe(1);
    r.until(() => l.state === 'fight', 400);
    expect(r.runner.planLocked).toBe(true);
    l.kill(0);
    r.until(() => l.defeated, 400);
    r.run(2);
    expect(r.runner.planLocked).toBe(false);
    expect(r.runner.state).toBe('playing');
  });
});

describe('ring-lorry: the fight', () => {
  it('every attack comes after its tell (≥ 18 ticks on screen); every dump leaves a free lane', () => {
    const r = rig({ god: true });
    const l = lorryIn(r, { rate: 0 });
    let maxBusy = 0;
    const busy = (): void => {
      maxBusy = Math.max(maxBusy, l.cargoLanes().size);
    };
    for (let t = 0; t < 2400; t++) {
      r.run(1);
      busy();
    }
    // Into phase 2 (the doors stay: cargo and weaves both).
    r.world.damage(l, { amount: l.maxHp, kind: 'explosion', dirX: -1, owner: 0 }, 3);
    expect(l.phase).toBe(1);
    const w = watchFairness(asTestWorld(r), 3600, { attacks: { charge: 'tell-charge' }, tells: new Set(['tell-charge']), watched: (e) => e instanceof RingForklift }, busy);
    expect(maxBusy).toBeLessThan(4);
    const fired = l.trace.filter((tr) => tr.fire >= 0);
    expect(fired.some((tr) => tr.attack === 'cargo')).toBe(true);
    expect(fired.some((tr) => tr.attack === 'weave')).toBe(true);
    for (const tr of fired) {
      expect(tr.fire - tr.tell, `${tr.attack} tell`).toBeGreaterThanOrEqual(18);
      expect(tr.seen, `${tr.attack} on screen`).toBeGreaterThanOrEqual(18);
      if (tr.attack === 'cargo') expect(tr.lanes?.length ?? 0).toBeLessThan(4);
    }
    expect(l.panelDown).toBe(true);
    expect(w.attacks.length).toBeGreaterThan(0);
    for (const a of w.attacks) {
      expect(a.prev).toBe('tell-charge');
      expect(a.tell).toBeGreaterThanOrEqual(18);
      expect(a.tellInView).toBeGreaterThanOrEqual(18);
    }
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(r.world));
  }, 30_000);

  it('parts break: the doors (the loader jumps, phase 2), the wheels (no more weaving), the cab ends it', () => {
    const r = rig({ god: true });
    const l = lorryIn(r, { rate: 0 });
    const score = r.session.slots[0].score;
    r.world.damage(l, { amount: 5000, kind: 'bullet', dirX: 1, owner: 0 }, 1);
    expect(l.parts[1].destroyed).toBe(true);
    expect(l.doorsGone).toBe(true);
    expect(l.loader).toBe('gone');
    expect(l.phase).toBe(1);
    expect(r.session.slots[0].score).toBeGreaterThanOrEqual(score + 1000);
    r.world.damage(l, { amount: 5000, kind: 'bullet', dirX: 1, owner: 0 }, 2);
    expect(l.wheelsBroken).toBe(true);
    expect(l.dead).toBe(false);
    const weaves = l.trace.filter((t) => t.attack === 'weave').length;
    r.run(1500);
    expect(l.trace.filter((t) => t.attack === 'weave').length).toBe(weaves);
    r.world.damage(l, { amount: 1e6, kind: 'bullet', dirX: 1, owner: 0 }, 0);
    expect(l.dead).toBe(true);
  });

  it('the container takes half, the cab one and a half', () => {
    const r = rig({ god: true });
    const l = lorryIn(r, { rate: 0 });
    const hp0 = l.hp;
    r.world.damage(l, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 }, 3);
    expect(hp0 - l.hp).toBeCloseTo(100 * LORRY_AI.boxMul);
    const hp1 = l.hp;
    r.world.damage(l, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 }, 0);
    expect(hp1 - l.hp).toBeCloseTo(100 * LORRY_AI.cabMul);
  });

  it('the damage rate: a burst at most, then the refill per tick; the pool holds at the phase-2 line until the panel is down', () => {
    const r = rig({ god: true });
    const l = lorryIn(r);
    const blast = { amount: 150, kind: 'bullet' as const, dirX: 1, owner: 0 };
    // A full bucket takes one shotgun blast at the cab (225) only up to the burst.
    const hp0 = l.hp;
    r.world.damage(l, blast, 0);
    expect(hp0 - l.hp).toBeCloseTo(LORRY_AI.rate.burst);
    // An empty bucket: nothing; 28 ticks later (the shotgun's interval): 28 × the rate.
    const hp1 = l.hp;
    r.world.damage(l, blast, 0);
    expect(hp1 - l.hp).toBeCloseTo(0);
    r.run(28);
    const hp2 = l.hp;
    r.world.damage(l, blast, 0);
    expect(hp2 - l.hp).toBeCloseTo(28 * LORRY_AI.rate.perTick, 0);
    // A shotgun every 28 ticks: the pool stops at the phase-2 line until the side panel is down.
    const line = Math.floor(l.maxHp * LORRY_AI.phase2);
    for (let i = 0; i < 80 && !l.panelDown; i++) {
      r.run(28);
      r.world.damage(l, blast, 0);
      if (!l.panelDown) expect(l.hp).toBeGreaterThanOrEqual(line);
    }
    expect(l.phase).toBe(1);
    expect(l.panelDown).toBe(true);
    // The fight then goes on to the end at the same rate (at least 2,000 / 2 ticks in all).
    let n = 0;
    while (!l.dead && n < 200) {
      r.run(28);
      r.world.damage(l, blast, 0);
      n++;
    }
    expect(l.dead).toBe(true);
  });

  it('the continue staggers it: the running attack ends cleanly and holds; the phase runs on after it', () => {
    const r = rig({ god: true });
    const l = lorryIn(r);
    r.until(() => l.doorTarget === 1 && l.brakeT > 0, 900);
    const n = l.trace.length;
    r.world.events.emit('continueLanded', { player: r.hero, slot: 0 } as never);
    expect(l.staggerTicks).toBeGreaterThan(0);
    r.run(1);
    expect(l.doorTarget).toBe(0);
    expect(l.brakeT).toBe(0);
    expect(l.loader).toBe('stand');
    const thrown = l.thrown;
    while (l.staggerTicks > 0) r.run(1);
    expect(l.thrown).toBe(thrown);
    expect(l.trace.length).toBe(n);
    r.run(LORRY_AI.cargo.every + 400);
    expect(l.trace.length).toBeGreaterThan(n);
  });

  it('a drum costs a wagon in its lane 1 cell and bursts; a swerving wagon passes; a shot crate drops its item', () => {
    const r = rig();
    const wg = r.wagon;
    r.until(() => wg.invulnTicks <= 0, 300);
    const lane = wg.laneTarget;
    const c = r.spawnAt<RingCargo>('ring-barrel', wg.screenX + 60, laneY(lane), { kind: 'barrel' });
    r.until(() => c.removed, 200);
    expect(wg.cells).toBe(wg.maxCells - CARGO_AI.cost);
    // A crate shot on the road breaks and drops its item.
    const k = r.spawnAt<RingCargo>('ring-barrel', 300, laneY(1), { kind: 'crate', drop: 'repair' });
    r.run(2);
    r.world.damage(k, { amount: 50, kind: 'bullet', dirX: 1, owner: 0 });
    expect(k.removed || k.dead).toBe(true);
    r.world.flush();
    expect(r.world.byTag('ring-crate').length).toBe(1);
    // In the air it is not hit.
    const f = r.spawnAt<RingCargo>('ring-barrel', 300, laneY(1), { kind: 'barrel', ticks: 20, ty: laneY(3), lift: 20 });
    expect(f.hurtboxes().length).toBe(0);
  });

  it('the forklift charges after its tell; reaching a wagon costs 2 cells (a ram)', () => {
    const r = rig();
    const wg = r.wagon;
    r.until(() => wg.invulnTicks <= 0, 300);
    const f = r.spawnAt<RingForklift>('ring-forklift', wg.screenX + 160, laneY(wg.laneTarget), {});
    const before = wg.cells;
    let tell = 0;
    r.until(() => {
      if (f.mode === 'tell-charge') tell++;
      return f.mode === 'charge';
    }, 600);
    expect(tell).toBeGreaterThanOrEqual(18);
    r.until(() => f.mode !== 'charge', 200);
    expect(before - wg.cells).toBe(FORKLIFT_AI.ramCost);
  });

  it('the forklift gloats (forks down, a snack; no attack) and cowers', () => {
    const r = rig();
    const f = r.spawnAt<RingForklift>('ring-forklift', 300, laneY(2), {});
    r.run(5);
    expect(f.react('gloat', 300, null)).toBe(true);
    const modes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      r.run(1);
      modes.add(f.mode);
    }
    expect(modes.has('tell-charge')).toBe(false);
    expect(modes.has('charge')).toBe(false);
    expect(f.anim.id).toBe(`${PREFIX}forklift/gloat`);
    expect(f.react('cower', 60, null)).toBe(true);
    r.run(2);
    expect(f.anim.id).toBe(`${PREFIX}forklift/cower`);
  });

  it('dumps launch from the door and land behind the lorry, in the chosen lanes', () => {
    const r = rig({ god: true });
    const l = lorryIn(r);
    r.until(() => l.thrown > 0, 900);
    const c = r.world.entities.find((e) => e instanceof RingCargo) as RingCargo;
    expect(c).toBeDefined();
    expect(c.x).toBeLessThan(l.x + LORRY.rear);
    expect(l.trace.find((t) => t.fire >= 0)?.lanes).toContain(nearestLane(c.landY));
  });
});

describe('ring-lorry: time to kill with the bot (normal)', () => {
  // The time depends on the gun the bot brings (the damage-rate cap, fixer B: about 28–30 s with
  // the spread gun, 38–46 s with the machine gun, 45–60 s with the pistol). Since the 2026-10-21
  // tuning (fewer enemies) the bot wrecks less on the way and keeps its pickups more often: every
  // seed 25–90 s, and the three never all short.
  it('the bot kills it in 25–90 s from the start of the fight (seeds 1–3; the median ≥ 35 s)', async () => {
    const times: number[] = [];
    for (const seed of [1, 2, 3]) {
      const h = await createHeadlessRing({ seed, section: 'westpoort', difficulty: 'normal', bot: true });
      let lorry: RingLorry | null = null;
      let fight = -1;
      let death = -1;
      for (let t = 0; t < 12000 && !h.done && death < 0; t++) {
        h.step(1);
        if (!lorry) lorry = (h.world?.entities.find((e) => e instanceof RingLorry) as RingLorry | undefined) ?? null;
        else {
          if (fight < 0 && lorry.state === 'fight') fight = h.ticks;
          if (lorry.dead) death = h.ticks;
        }
      }
      h.dispose();
      expect(fight).toBeGreaterThan(0);
      expect(death).toBeGreaterThan(fight);
      times.push((death - fight) / 60);
    }
    for (const secs of times) {
      expect(secs, JSON.stringify(times)).toBeGreaterThanOrEqual(25);
      expect(secs, JSON.stringify(times)).toBeLessThanOrEqual(90);
    }
    expect([...times].sort((a, b) => a - b)[1], JSON.stringify(times)).toBeGreaterThanOrEqual(35);
  }, 120_000);
});
