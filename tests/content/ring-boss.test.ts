/**
 * The ZWAAN train's parts by TRAIN-1 (docs/design/ring.md §R.3): the CONTAINER TRAILER
 * `ring-zwaan-container` (the retired test lorry `ring-lorry` without its cab) with its adds
 * (`ring-forklift`, `ring-barrel`) and the CAB `ring-zwaan-cab` (ZWARE JONGEN). Registration and
 * the art at 1× / 2× / 4× (one drawer, the 1× geometry, PAL_HD) of the container, the cab and the
 * shared kit; inert-safe spawns; every attack after its tell (≥ 18 ticks, on screen); a free lane
 * in every cargo dump; the parts (doors, bogie; cab, sleeper, chassis) and their multipliers; the
 * damage rate and the phase-1 floor; the continue's stagger; the cargo and the forklift's charge;
 * the cab's weave (never into a car), brake check (a ram) and gunner; the jackknife (the driver
 * climbs out, the drop); the time to kill with the bot (the momentum: 25–45 s a part).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, setHiArt, spriteErrors } from '../../src/engine/sprites';
import { attackTokenLimit } from '../../src/game/enemy';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/ring/boss/art';
import { CARGO_AI, FORKLIFT_AI, LORRY, RingCargo, RingForklift } from '../../src/game/content/ring/boss/index';
import { CONTAINER_AI, CONTAINER_X, ZwaanContainer } from '../../src/game/content/ring/zwaan/container';
import { CAB_AI, CAB_LINES, ZwaanCab } from '../../src/game/content/ring/zwaan/cab';
import { CAB } from '../../src/game/content/ring/zwaan/cab-geo';
import { zwaanRate } from '../../src/game/content/ring/zwaan/kit';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/traffic/index';
import { laneY, nearestLane } from '../../src/game/ring/lanes';
import { WAGON_W } from '../../src/game/ring/wagon';
import { createHeadlessRing } from '../../src/sim/headless-ring';
import { RingRig, tinyPlan } from '../game/ring/ring-helpers';
import { TestWorld, watchFairness, type TestWorld as TW } from './helpers';

const PREFIXES = ['boss/ring-zwaan/container/', 'boss/ring-zwaan/cab/', 'boss/ring-zwaan/kit/'];

/** A ring rig on a long plan (a part alone does not lock the plan; the train's controller does). */
function rig(o: { god?: boolean } = {}): RingRig {
  const r = new RingRig({ god: o.god, plan: tinyPlan({ length: 120_000 }) });
  r.run(2);
  return r;
}

function asTestWorld(r: RingRig): TW {
  return { world: r.world, run: (n = 1) => r.run(n) } as unknown as TW;
}

/** A part spawned alone (no controller) just off the right edge in lane 1, run until its fight starts. */
function partIn<T>(r: RingRig, id: string, params: Record<string, unknown> = {}): T {
  const p = r.spawnAt<ZwaanContainer | ZwaanCab>(id, 400, laneY(1), params);
  r.until(() => p.state === 'fight', 600);
  return p as unknown as T;
}

describe('ZWAAN parts (TRAIN-1): registration and art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    setHiArt(true);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('registers the container, the cab and the adds; the test lorry is retired', () => {
    for (const id of ['ring-zwaan', 'ring-zwaan-container', 'ring-zwaan-cab', 'ring-forklift', 'ring-barrel']) expect(hasEntity(id), id).toBe(true);
    expect(hasEntity('ring-lorry')).toBe(false);
    expect(listSprites('boss/ring-lorry/')).toEqual([]);
  });

  it('every strip has 1× art and one HD drawer at 2× and 4× with the 1× geometry and PAL_HD colours', () => {
    let n = 0;
    for (const prefix of PREFIXES) {
      const ids = listSprites(prefix);
      expect(ids.length, prefix).toBeGreaterThan(0);
      for (const id of ids) {
        n++;
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
      expect(spriteErrors().filter((e) => e.id.startsWith(prefix))).toEqual([]);
    }
    expect(n).toBeGreaterThanOrEqual(40);
  }, 180_000);
});

describe('ZWAAN parts: spawns', () => {
  it('run 4000 ticks from {} in a plain world and on the ring without errors', () => {
    const errors: unknown[] = [];
    const tw = new TestWorld({ width: 4000 });
    tw.world.events.on('error', (e) => errors.push(e));
    for (const id of ['ring-zwaan', 'ring-zwaan-container', 'ring-zwaan-cab', 'ring-forklift', 'ring-barrel']) tw.world.spawn(id, 500, 180, {});
    tw.run(4000);
    const r = rig({ god: true });
    r.world.events.on('error', (e) => errors.push(e));
    r.spawnAt('ring-zwaan-container', 448, laneY(1), {});
    r.spawnAt('ring-zwaan-cab', 448, laneY(2), {});
    r.spawnAt('ring-forklift', 300, laneY(3), {});
    r.spawnAt('ring-barrel', 280, laneY(2), {});
    r.run(4000);
    expect(errors).toEqual([]);
  });

  it('a part alone keeps pace at the anchor (screen x 150) while the road scrolls', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container');
    r.run(300);
    expect(Math.abs(c.screenX - 150)).toBeLessThanOrEqual(6);
  });
});

describe('ZWAAN CONTAINER: the fight', () => {
  it('every attack comes after its tell (≥ 18 ticks on screen); every dump leaves a free lane; the forklift charges after its tell', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container', { rate: 0 });
    let maxBusy = 0;
    const busy = (): void => {
      maxBusy = Math.max(maxBusy, c.cargoLanes().size);
    };
    for (let t = 0; t < 1800; t++) {
      r.run(1);
      busy();
    }
    // Into phase 2 (the doors stay: cargo and the forklift both).
    r.world.damage(c, { amount: c.maxHp, kind: 'explosion', dirX: -1, owner: 0 }, 0);
    expect(c.phase).toBe(1);
    const w = watchFairness(asTestWorld(r), 3000, { attacks: { charge: 'tell-charge' }, tells: new Set(['tell-charge']), watched: (e) => e instanceof RingForklift }, busy);
    expect(maxBusy).toBeLessThan(4);
    const fired = c.trace.filter((tr) => tr.fire >= 0);
    expect(fired.length).toBeGreaterThanOrEqual(3);
    for (const tr of fired) {
      expect(tr.fire - tr.tell).toBeGreaterThanOrEqual(18);
      expect(tr.seen).toBeGreaterThanOrEqual(18);
      expect(tr.lanes?.length ?? 0).toBeLessThan(4);
    }
    expect(c.panelDown).toBe(true);
    expect(w.attacks.length).toBeGreaterThan(0);
    for (const a of w.attacks) {
      expect(a.prev).toBe('tell-charge');
      expect(a.tell).toBeGreaterThanOrEqual(18);
      expect(a.tellInView).toBeGreaterThanOrEqual(18);
    }
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(r.world));
  }, 30_000);

  it('parts break: the doors (the loader jumps, phase 2), the bogie (the rims drag); the box takes the rest', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container', { rate: 0 });
    const score = r.session.slots[0].score;
    r.world.damage(c, { amount: 5000, kind: 'bullet', dirX: 1, owner: 0 }, 1);
    expect(c.parts[1].destroyed).toBe(true);
    expect(c.doorsGone).toBe(true);
    expect(c.loader).toBe('gone');
    expect(c.phase).toBe(1);
    expect(r.session.slots[0].score).toBeGreaterThanOrEqual(score + 1000);
    r.world.damage(c, { amount: 5000, kind: 'bullet', dirX: 1, owner: 0 }, 2);
    expect(c.bogieBroken).toBe(true);
    expect(c.dead).toBe(false);
    // The pool holds at the phase-2 line until the side panel lies on the road.
    r.world.damage(c, { amount: 1e6, kind: 'bullet', dirX: 1, owner: 0 }, 0);
    expect(c.dead).toBe(false);
    r.until(() => c.panelDown, 200);
    r.world.damage(c, { amount: 1e6, kind: 'bullet', dirX: 1, owner: 0 }, 0);
    expect(c.dead).toBe(true);
  });

  it('the multipliers: the doors × 1.5, the bogie × 1.25, the box × 1', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container', { rate: 0 });
    for (const [i, mul] of [[0, 1], [1, CONTAINER_AI.doorsMul], [2, CONTAINER_AI.bogieMul]] as const) {
      const hp0 = c.hp;
      r.world.damage(c, { amount: 20, kind: 'bullet', dirX: 1, owner: 0 }, i);
      expect(hp0 - c.hp, `part ${i}`).toBeCloseTo(20 * mul);
    }
  });

  it('the damage rate: a burst at most, then the refill per tick; the pool holds at the phase-2 line until the panel is down', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container');
    const blast = { amount: 150, kind: 'bullet' as const, dirX: 1, owner: 0 };
    const k = c.maxHp / CONTAINER_AI.hp.pool;
    const hp0 = c.hp;
    r.world.damage(c, blast, 0);
    expect(hp0 - c.hp).toBeCloseTo(150 * k);
    const hp1 = c.hp;
    r.world.damage(c, blast, 0);
    expect(hp1 - c.hp).toBeCloseTo(0);
    r.run(28);
    const hp2 = c.hp;
    r.world.damage(c, blast, 0);
    expect(hp2 - c.hp).toBeCloseTo(28 * zwaanRate(CONTAINER_AI.hp.pool) * k, 0);
    const line = Math.floor(c.maxHp * CONTAINER_AI.phase2);
    for (let i = 0; i < 120 && !c.panelDown; i++) {
      r.run(28);
      r.world.damage(c, blast, 0);
      if (!c.panelDown) expect(c.hp).toBeGreaterThanOrEqual(line);
    }
    expect(c.phase).toBe(1);
    expect(c.panelDown).toBe(true);
    let n = 0;
    while (!c.dead && n < 400) {
      r.run(28);
      r.world.damage(c, blast, 0);
      n++;
    }
    expect(c.dead).toBe(true);
  });

  it('the continue staggers it: the running dump ends cleanly and holds; the phase runs on after it', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container');
    r.until(() => c.doorTarget === 1 && c.brakeT > 0, 900);
    const n = c.trace.length;
    r.world.events.emit('continueLanded', { player: r.hero, slot: 0 } as never);
    expect(c.staggerTicks).toBeGreaterThan(0);
    r.run(1);
    expect(c.doorTarget).toBe(0);
    expect(c.brakeT).toBe(0);
    expect(c.loader).toBe('stand');
    const thrown = c.thrown;
    while (c.staggerTicks > 0) r.run(1);
    expect(c.thrown).toBe(thrown);
    expect(c.trace.length).toBe(n);
    r.run(CONTAINER_AI.cargo.every + 400);
    expect(c.trace.length).toBeGreaterThan(n);
  });

  it('dumps launch from the door and land behind the trailer, in the chosen lanes', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container');
    r.until(() => c.thrown > 0, 900);
    const g = r.world.entities.find((e) => e instanceof RingCargo) as RingCargo;
    expect(g).toBeDefined();
    expect(g.x).toBeLessThan(c.x + CONTAINER_X.doors[1]);
    expect(c.trace.find((t) => t.fire >= 0)?.lanes).toContain(nearestLane(g.landY));
  });

  it('a drum costs a wagon in its lane 1 cell; a shot crate drops its item; the forklift rams for 2 cells', () => {
    const r = rig();
    const wg = r.wagon;
    r.until(() => wg.invulnTicks <= 0, 300);
    const lane = wg.laneTarget;
    const g = r.spawnAt<RingCargo>('ring-barrel', wg.screenX + 60, laneY(lane), { kind: 'barrel' });
    r.until(() => g.removed, 200);
    expect(wg.cells).toBe(wg.maxCells - CARGO_AI.cost);
    const k = r.spawnAt<RingCargo>('ring-barrel', 300, laneY(1), { kind: 'crate', drop: 'repair' });
    r.run(2);
    r.world.damage(k, { amount: 50, kind: 'bullet', dirX: 1, owner: 0 });
    r.world.flush();
    expect(r.world.byTag('ring-crate').length).toBe(1);
    r.until(() => wg.invulnTicks <= 0, 300);
    const f = r.spawnAt<RingForklift>('ring-forklift', wg.screenX + 160, laneY(wg.laneTarget), {});
    const before = wg.cells;
    r.until(() => f.mode === 'charge', 600);
    r.until(() => f.mode !== 'charge', 200);
    expect(before - wg.cells).toBe(FORKLIFT_AI.ramCost);
  });

  it('beaten: the forklift drives off, the trailer tips onto its side and drops an item', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanContainer>(r, 'ring-zwaan-container', { rate: 0 });
    r.world.damage(c, { amount: c.maxHp, kind: 'explosion', dirX: -1, owner: 0 }, 0);
    r.until(() => c.forklift !== null, 900);
    const f = c.forklift!;
    c.kill(0);
    r.run(1);
    expect(f.mode).toBe('leave');
    r.until(() => c.beaten === 'tip', 300);
    r.until(() => c.removed, 900);
    expect(c.dropped).not.toBeNull();
    void LORRY;
  });
});

describe('ZWARE JONGEN (the cab): the fight', () => {
  it('weaves after its tell (≥ 18 ticks, the cab on screen), the horn on every lane change; never into a car', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanCab>(r, 'ring-zwaan-cab', { rate: 0 });
    const horns: number[] = [];
    const sfx = r.world.audio.sfx.bind(r.world.audio);
    r.world.audio.sfx = ((id: string, o?: unknown) => {
      if (id === 'ring/zwaan-horn') horns.push(r.world.tick);
      return sfx(id, o as never);
    }) as typeof r.world.audio.sfx;
    r.until(() => c.laneChanges >= 2, 3000);
    const weaves = c.trace.filter((t) => t.attack === 'weave' && t.fire >= 0);
    expect(weaves.length).toBeGreaterThanOrEqual(2);
    for (const t of weaves) {
      expect(t.fire - t.tell).toBeGreaterThanOrEqual(18);
      expect(t.seen).toBeGreaterThanOrEqual(18);
    }
    expect(horns.length).toBeGreaterThanOrEqual(c.laneChanges);
    // A car beside it in the other lane: no lane change while it is there.
    r.until(() => !c.weaving, 200);
    const other = c.lane === 1 ? 2 : 1;
    const car = r.spawnAt('ring-car', c.screenX + 40, laneY(other), { model: 'hatch', rel: 0 });
    const n = c.laneChanges;
    for (let t = 0; t < 600; t++) {
      r.run(1);
      car.x = c.x + 40;
      car.y = laneY(other);
    }
    expect(c.laneChanges).toBe(n);
  }, 30_000);

  it('the brake check: the brake lights glow (≥ 18 ticks), then a hard brake rams a wagon behind it (1 cell)', () => {
    const r = rig();
    const c = partIn<ZwaanCab>(r, 'ring-zwaan-cab', { rate: 0 });
    const wg = r.wagon;
    let hit = false;
    for (let t = 0; t < 4000 && !hit; t++) {
      // Keep the wagon right behind the cab in its lane.
      if (!c.weaving && c.mode !== 'brake') {
        wg.y = c.y;
        wg.laneTarget = c.lane;
        wg.x = c.x - WAGON_W / 2 - 20;
      }
      const before = wg.cells;
      r.run(1);
      if (c.mode === 'brake' && wg.cells < before) hit = true;
    }
    const brakes = c.trace.filter((t) => t.attack === 'brake' && t.fire >= 0);
    expect(brakes.length).toBeGreaterThan(0);
    for (const t of brakes) {
      expect(t.fire - t.tell).toBeGreaterThanOrEqual(18);
      expect(t.seen).toBeGreaterThanOrEqual(18);
    }
    expect(hit).toBe(true);
  }, 30_000);

  it('the gunner: the window opens and he aims (≥ 18 ticks), then shots from the window; a broken sleeper stops him (he tumbles out)', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanCab>(r, 'ring-zwaan-cab', { rate: 0 });
    const w = watchFairness(asTestWorld(r), 2400, { attacks: { gun: 'tell-gun' }, tells: new Set(['tell-gun']), watched: (e) => e === c });
    const guns = c.trace.filter((t) => t.attack === 'gun' && t.fire >= 0);
    expect(guns.length).toBeGreaterThan(0);
    for (const t of guns) {
      expect(t.fire - t.tell).toBeGreaterThanOrEqual(18);
      expect(t.seen).toBeGreaterThanOrEqual(18);
    }
    expect(c.shots).toBeGreaterThanOrEqual(3);
    expect(w.outsideShots).toBe(0);
    // Break the sleeper: the gunner tumbles out; no more shots.
    const tumblers = r.world.entities.length;
    r.world.damage(c, { amount: 1e4, kind: 'bullet', dirX: 1, owner: 0 }, 1);
    expect(c.sleeperBroken).toBe(true);
    r.world.flush();
    expect(r.world.entities.length).toBeGreaterThan(tumblers - 1);
    const shots = c.shots;
    r.run(2400);
    expect(c.shots).toBe(shots);
  }, 30_000);

  it('the multipliers: the cab × 1.5, the sleeper × 1.25, the chassis × 1; phase 2 says its line', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanCab>(r, 'ring-zwaan-cab', { rate: 0 });
    for (const [i, mul] of [[0, CAB_AI.cabMul], [1, CAB_AI.sleeperMul], [2, CAB_AI.chassisMul]] as const) {
      const hp0 = c.hp;
      r.world.damage(c, { amount: 20, kind: 'bullet', dirX: 1, owner: 0 }, i);
      expect(hp0 - c.hp, `part ${i}`).toBeCloseTo(20 * mul);
    }
    const said: string[] = [];
    const say = c.say.bind(c);
    c.say = (text, o) => {
      said.push(text);
      say(text, o);
    };
    r.world.damage(c, { amount: c.hp - c.maxHp * 0.45, kind: 'explosion', dirX: 1, owner: 0 }, 2);
    expect(c.phase).toBe(1);
    expect(said).toContain(CAB_LINES.rage);
    for (const line of Object.values(CAB_LINES)) expect(line.length).toBeLessThanOrEqual(24);
  });

  it('the continue staggers it; a lane change finishes first', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanCab>(r, 'ring-zwaan-cab', { rate: 0 });
    r.until(() => c.mode === 'tell-gun' || c.mode === 'tell-weave' || c.mode === 'tell-brake', 1200);
    r.world.events.emit('continueLanded', { player: r.hero, slot: 0 } as never);
    expect(c.staggerTicks).toBeGreaterThan(0);
    r.run(1);
    expect(c.mode).toBe('cruise');
    expect(c.blinkT).toBe(0);
    expect(c.gunner).toBe('none');
  });

  it('the jackknife: the bubble, the yaw, onto the shoulder, the drop, the driver climbs out dazed; then removed', () => {
    const r = rig({ god: true });
    const c = partIn<ZwaanCab>(r, 'ring-zwaan-cab', { rate: 0 });
    const said: string[] = [];
    const say = c.say.bind(c);
    c.say = (text, o) => {
      said.push(text);
      say(text, o);
    };
    const score = r.session.slots[0].score;
    c.kill(0);
    expect(r.session.slots[0].score).toBeGreaterThanOrEqual(score + 10_000);
    r.until(() => c.yawF >= 0, 120);
    expect(said).toContain(CAB_LINES.beaten);
    r.until(() => c.beaten === 'tip', 200);
    expect(c.y).toBeGreaterThan(laneY(4));
    r.until(() => c.driverOut, 120);
    expect(c.dropped).not.toBeNull();
    r.until(() => c.removed, 900);
    void CAB;
  });
});

describe('ZWAAN parts: time to kill with the bot (normal; the momentum)', () => {
  it('the bot beats the container and the cab in 25–45 s each from the start of their fight (seeds 1–3)', async () => {
    const times: Record<string, number[]> = { 'ring-zwaan-container': [], 'ring-zwaan-cab': [] };
    for (const seed of [1, 2, 3]) {
      const h = await createHeadlessRing({ seed, section: 'zwaan', difficulty: 'normal', bot: true, god: true });
      const start: Record<string, number> = {};
      const ring = h.runner!;
      ring.world.events.on('ringTrainPart', (e) => {
        if (!(e.part in times)) return;
        if (e.phase === 'start') start[e.part] = h.ticks;
        else times[e.part].push((h.ticks - start[e.part]) / 60);
      });
      let done = false;
      ring.world.events.on('ringTrainDone', () => (done = true));
      for (let t = 0; t < 20_000 && !h.done && !done; t++) h.step(1);
      h.dispose();
    }
    for (const [id, list] of Object.entries(times)) {
      expect(list.length, id).toBe(3);
      for (const s of list) {
        expect(s, `${id} ${JSON.stringify(list)}`).toBeGreaterThanOrEqual(25);
        expect(s, `${id} ${JSON.stringify(list)}`).toBeLessThanOrEqual(45);
      }
    }
  }, 180_000);
});
