/**
 * The road-works crew and the jam boarders (`ring-roadworks`, `ring-roadworker`, `ring-boarder`;
 * docs/design/ring.md §5.5, §7.2; GDD §4.11 fairness): registration, a plain spawn that runs, the
 * telegraphs (≥ 18 ticks on screen, every attack right after its own tell, no shot from off screen,
 * at most the token count at once), an open lane always, the cone lob (1 cell in its lane), the
 * truck's death (the crew bails, a crate, the wreck), the boarders only in a standing jam, the hop
 * onto the bonnet, the ½-cell swing, the knife, the swerve, the gloat and the cower.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { hasSprite } from '../../src/engine/sprites';
import { attackTokenLimit } from '../../src/game/enemy';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/ring/crew/art';
import { BOARDER, RingBoarder, RingConeLine, RingConeLob, RingRoadworker, RingRoadworks, ROADWORKS } from '../../src/game/content/ring/crew/index';
import { BOARDER_SETS, BOARDER_STRIPS, boarderArt, BONNET, WORKER_LOOKS, WORKER_STRIPS, workerArt } from '../../src/game/content/ring/crew/geometry';
import '../../src/game/content/ring/hazards/index';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/traffic/index';
import { jamOf, PlaneTumbler } from '../../src/game/content/ring/traffic/road-kit';
import { RING_CREW } from '../../src/game/content/sfx/ring-crew';
import { SFX } from '../../src/game/content/sfx/index';
import { ringArtDef } from '../../src/game/ring/art-def';
import { LANE_COUNT, laneY, nearestLane, SHOULDER_TOP } from '../../src/game/ring/lanes';
import { RingRig, tinyPlan } from '../game/ring/ring-helpers';
import { TestWorld, watchFairness, type TestWorld as TW } from './helpers';

function rig(o: { god?: boolean } = {}): RingRig {
  const r = new RingRig({ god: o.god });
  r.run(2);
  return r;
}

function asTestWorld(r: RingRig): TW {
  return { world: r.world, run: (n = 1) => r.run(n) } as unknown as TW;
}

/** A standing jam without the controller: the jam level at 1, the road stopped. */
function stand(r: RingRig): void {
  jamOf(r.world).level = 1;
  r.runner.limitSpeed('test-jam', 0);
  r.run(40);
}

const of = <T>(r: RingRig, k: new (...a: never[]) => T): T[] => r.world.entities.filter((e) => e instanceof (k as unknown as typeof Object)) as unknown as T[];

describe('ring crew: registration', () => {
  it('registers the ids, every strip at 1×, the sounds; the art families', () => {
    for (const id of ['ring-roadworks', 'ring-roadworker', 'ring-boarder']) expect(hasEntity(id)).toBe(true);
    expect(hasSprite('ring/roadworks/truck')).toBe(true);
    expect(hasSprite('ring/roadworks/side')).toBe(true);
    WORKER_LOOKS.forEach((_, k) => {
      for (const s of WORKER_STRIPS) expect(hasSprite(`${workerArt(k)}/${s}`)).toBe(true);
    });
    BOARDER_SETS.forEach((b, i) => {
      for (const s of BOARDER_STRIPS) expect(hasSprite(`${boarderArt(i)}/${s}`)).toBe(true);
      // The gloat and the cower are the ams sets' strips.
      expect(hasSprite(`enemy/${b.set}/gloat`)).toBe(true);
      expect(hasSprite(`enemy/${b.set}/cower`)).toBe(true);
    });
    for (const id of Object.keys(RING_CREW)) expect(SFX[id]).toBeDefined();
    for (const id of ['ring/crew-beeper', 'ring/crew-cone-lift', 'ring/crew-cone-throw', 'ring/crew-cone-hit', 'ring/crew-hop-tell', 'ring/crew-hop', 'ring/crew-swing-tell', 'ring/crew-boot', 'ring/crew-knocked', 'ring/crew-wreck']) {
      expect(RING_CREW[id]).toBeDefined();
    }
    // A plan with a jam carries the boarders' art; the road works carry the truck's.
    const plan = tinyPlan({
      spawns: [
        { at: 600, id: 'ring-jam', y: 204, params: { length: 600 } },
        { at: 2000, id: 'ring-roadworks', lane: 4, params: {} },
      ],
    });
    const def = ringArtDef(plan);
    const all = Object.values(def.sections ?? {}).flatMap((s) => s.art ?? []);
    expect(all).toContain('ring/boarder/');
    expect(all).toContain('ring/roadworks/');
  });

  it('runs 600 ticks from {} in the ring and in a plain world', () => {
    const errors: unknown[] = [];
    const r = rig({ god: true });
    r.world.events.on('error', (e) => errors.push(e));
    r.spawnAt('ring-roadworks', 200, laneY(4));
    r.spawnAt('ring-roadworks', 460, laneY(2), {});
    r.spawnAt('ring-roadworker', 200, laneY(2));
    r.spawnAt('ring-boarder', 300, laneY(2));
    r.spawnAt('ring-boarder', 300, laneY(3), { wait: 300, look: 'stag' });
    r.run(300);
    stand(r);
    r.run(260);
    const tw = new TestWorld();
    tw.world.events.on('error', (e) => errors.push(e));
    for (const id of ['ring-roadworks', 'ring-roadworker', 'ring-boarder']) tw.spawn(id, 300);
    tw.run(600);
    expect(errors).toEqual([]);
  });
});

describe('ring-roadworks', () => {
  it('drives in lane 4 (or the lane a plan closure closes; 3 in a tunnel) and lays cones behind it', () => {
    const r = rig({ god: true });
    const t = r.spawnAt<RingRoadworks>('ring-roadworks', 420, laneY(1));
    expect(t.lane).toBe(4);
    r.run(200);
    expect(t.mode).toBe('work');
    const line = t.line as RingConeLine;
    expect(line).toBeInstanceOf(RingConeLine);
    expect(line.count).toBeGreaterThan(5);
    expect(line.hasTag('ring-closure')).toBe(true);
    // The cones stand at the lane's edge toward the open lane, behind the trailer.
    expect(line.coneY).toBe(laneY(4) - ROADWORKS.coneEdge);
    for (let k = 0; k < line.count; k++) expect(line.xs[k]).toBeLessThan(t.x - 60);
    // With a plan closure in lane 3 near it, the truck works inside it.
    const r2 = rig({ god: true });
    r2.spawnAt('ring-closure', 100, laneY(3), { length: 800 });
    const t2 = r2.spawnAt<RingRoadworks>('ring-roadworks', 420, laneY(2));
    expect(t2.lane).toBe(3);
  });

  it('never closes the last open lane', () => {
    const r = rig({ god: true });
    for (const l of [1, 2, 3]) r.spawnAt('ring-closure', 0, laneY(l), { length: 3000, truck: false });
    const t = r.spawnAt<RingRoadworks>('ring-roadworks', 420, laneY(4), { lane: 4 });
    let worst = LANE_COUNT;
    for (let i = 0; i < 400; i++) {
      r.run(1);
      const cam = r.world.camera;
      for (let x = cam.x; x < cam.right; x += 16) {
        const closed = new Set<number>();
        for (const c of r.world.byTag('ring-closure')) {
          const x0 = c.x + c.hitbox.x;
          if (x >= x0 && x <= x0 + c.hitbox.w && (!(c instanceof RingConeLine) || c.count > 0)) closed.add(nearestLane(c.y));
        }
        worst = Math.min(worst, LANE_COUNT - closed.size);
      }
    }
    expect(worst).toBeGreaterThanOrEqual(1);
    expect(t.line).toBeNull();
  });

  it('the crew telegraphs every cone ≥ 18 ticks on screen; no lob from off screen; tokens hold', () => {
    const r = rig({ god: true });
    r.spawnAt('ring-roadworks', 460, laneY(4));
    const w = watchFairness(asTestWorld(r), 900, {
      attacks: { throw: 'tell-throw' },
      tells: new Set(['tell-throw']),
      watched: (e) => e instanceof RingRoadworker,
    });
    expect(w.attacks.length).toBeGreaterThan(2);
    for (const a of w.attacks) {
      expect(a.prev).toBe('tell-throw');
      expect(a.tell).toBeGreaterThanOrEqual(18);
      expect(a.tellInView).toBeGreaterThanOrEqual(18);
      expect(a.inView).toBe(true);
    }
    expect(w.outsideShots).toBe(0);
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(r.world));
  });

  it('a lobbed cone costs 1 cell in its lane only', () => {
    const r = rig();
    const wg = r.wagon;
    r.until(() => wg.invulnTicks <= 0, 300);
    const lane = wg.laneTarget;
    r.world.add(new RingConeLob(r.world, wg.x + 60, laneY(lane), { lift: 30, ty: laneY(lane - 1), vx: r.runner.roadSpeed - 1.5, ticks: 30, arc: 24 }));
    r.run(40);
    expect(wg.cells).toBe(wg.maxCells);
    r.world.add(new RingConeLob(r.world, wg.x + 60, laneY(lane - 1), { lift: 30, ty: laneY(lane), vx: r.runner.roadSpeed - 2, ticks: 30, arc: 24 }));
    r.run(40);
    expect(wg.cells).toBe(wg.maxCells - 1);
  });

  it('500 HP: the wreck stays, the crew bails onto the hard shoulder (no score for them), a crate drops', () => {
    const r = rig({ god: true });
    const t = r.spawnAt<RingRoadworks>('ring-roadworks', 300, laneY(4));
    r.run(3);
    expect(t.maxHp).toBe(ROADWORKS.hp);
    const crew = of(r, RingRoadworker);
    expect(crew.length).toBe(3);
    // A worker shot off: 200 points, he tumbles (bloodless).
    const s0 = r.session.slots[0].score;
    r.world.damage(crew[0], { amount: 20, kind: 'bullet', dirX: 1, owner: 0 });
    expect(crew[0].dead).toBe(true);
    expect(r.session.slots[0].score).toBe(s0 + ROADWORKS.workerScore);
    const s1 = r.session.slots[0].score;
    r.world.damage(t, { amount: 499, kind: 'bullet', dirX: 1, owner: 0 });
    expect(t.dead).toBe(false);
    r.world.damage(t, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(t.dead).toBe(true);
    expect(r.session.slots[0].score).toBe(s1 + ROADWORKS.score);
    r.world.flush();
    expect(crew[1].removed && crew[2].removed).toBe(true);
    expect(r.world.byTag('ring-crate').length).toBe(1);
    expect(t.hurtboxes().length).toBe(0);
    r.run(60);
    expect(t.removed).toBe(false);
    const sitting = r.world.entities.filter((e) => e instanceof PlaneTumbler && e.y > SHOULDER_TOP);
    expect(sitting.length).toBeGreaterThanOrEqual(2);
    // It drifts back out of view and goes.
    r.until(() => t.removed, 600);
  });

  it('leaves off the left edge without a score; a wagon that drives into it is held back and pays ½ or 1 cell', () => {
    const r = rig();
    const wg = r.wagon;
    const t = r.spawnAt<RingRoadworks>('ring-roadworks', 260, wg.y, { lane: nearestLane(wg.y), crew: 0 });
    r.until(() => wg.invulnTicks <= 0, 300);
    const before = wg.cells;
    r.until(() => wg.cells < before, 400);
    expect([0.5, 1]).toContain(before - wg.cells);
    expect(wg.x + 46).toBeLessThanOrEqual(t.x - 69);
    const r2 = rig({ god: true });
    const t2 = r2.spawnAt<RingRoadworks>('ring-roadworks', 200, laneY(4), { crew: 0 });
    const s = r2.session.slots[0].score;
    r2.until(() => t2.removed, 1500);
    expect(r2.session.slots[0].score).toBe(s);
  });

  it('the crew takes a coffee break while held (no attack) and cowers when a hero lands', () => {
    const r = rig({ god: true });
    r.spawnAt('ring-roadworks', 300, laneY(4));
    r.run(3);
    const crew = of(r, RingRoadworker);
    for (const c of crew) expect(c.react('gloat', 400, null)).toBe(true);
    const modes: string[] = [];
    for (let i = 0; i < 300; i++) {
      r.run(1);
      for (const c of crew) if (c.mode !== 'idle') modes.push(c.mode);
    }
    expect(modes).toEqual([]);
    expect(crew[0].anim.id).toBe(`${workerArt(crew[0].look)}/gloat`);
    expect(crew[0].react('cower', 60, null)).toBe(true);
    r.run(2);
    expect(crew[0].anim.id).toBe(`${workerArt(crew[0].look)}/cower`);
  });
});

describe('ring-boarder', () => {
  it('appears only in a standing jam (else it leaves at once, or waits hidden for one)', () => {
    const r = rig({ god: true });
    const b = r.spawnAt<RingBoarder>('ring-boarder', 300, laneY(2));
    r.run(2);
    expect(b.removed).toBe(true);
    const w = r.spawnAt<RingBoarder>('ring-boarder', 300, laneY(2), { wait: 100 });
    r.run(20);
    expect(w.mode).toBe('wait');
    expect(w.hurtboxes().length).toBe(0);
    stand(r);
    expect(w.mode).not.toBe('wait');
    expect(w.hurtboxes().length).toBe(1);
    const late = r.spawnAt<RingBoarder>('ring-boarder', 360, laneY(3));
    r.run(2);
    expect(late.removed).toBe(false);
  });

  it('runs on the lane split, telegraphs the hop ≥ 18 ticks, lands on the bonnet, swings for ½ cell', () => {
    const r = rig();
    const wg = r.wagon;
    stand(r);
    const b = r.spawnAt<RingBoarder>('ring-boarder', 360, laneY(1), { look: 'handhaver' });
    let tell = 0;
    r.until(() => {
      if (b.mode === 'tell-hop') tell++;
      return b.mode === 'hop';
    }, 600);
    expect(tell).toBeGreaterThanOrEqual(18);
    r.until(() => b.mode === 'perch', 60);
    expect(b.wagon).toBe(wg);
    expect(b.x).toBe(wg.x + BONNET.x);
    expect(b.y).toBe(wg.y);
    expect(b.lift).toBe(BONNET.lift);
    r.until(() => wg.invulnTicks <= 0, 120);
    const before = wg.cells;
    let tellHit = 0;
    r.until(() => {
      if (b.mode === 'tell-hit') tellHit++;
      return b.mode === 'hit';
    }, 400);
    expect(tellHit).toBeGreaterThanOrEqual(18);
    r.run(2);
    expect(before - wg.cells).toBe(0.5);
  });

  it('a lane change during the hop makes him miss: he lands on the road and runs again', () => {
    const r = rig({ god: true });
    const wg = r.wagon;
    stand(r);
    const b = r.spawnAt<RingBoarder>('ring-boarder', 360, laneY(2), { look: 'handhaver' });
    r.until(() => b.mode === 'hop', 600);
    wg.laneTarget = wg.laneTarget > 1 ? wg.laneTarget - 1 : wg.laneTarget + 1;
    r.until(() => b.mode !== 'hop', 60);
    expect(b.mode).toBe('run');
    expect(b.aboard).toBe(false);
    expect(b.lift).toBe(0);
  });

  it('is knifed off the bonnet with FIRE (bloodless: he tumbles onto the hard shoulder)', () => {
    const r = rig({ god: true });
    stand(r);
    const b = r.spawnAt<RingBoarder>('ring-boarder', 360, laneY(2), { look: 'stag' });
    r.until(() => b.aboard, 600);
    const s = r.session.slots[0].score;
    r.tap(['fire']);
    r.run(2);
    expect(b.dead).toBe(true);
    expect(b.killedBy?.kind).toBe('knife');
    expect(r.session.slots[0].score).toBeGreaterThan(s);
    r.run(70);
    expect(r.world.entities.some((e) => e instanceof PlaneTumbler && e.y > SHOULDER_TOP)).toBe(true);
  });

  it('a swerve shakes him off; a second boarder waits his turn; the jam clears: they leave', () => {
    const r = rig({ god: true });
    const wg = r.wagon;
    stand(r);
    const a = r.spawnAt<RingBoarder>('ring-boarder', 360, laneY(2), { look: 'handhaver' });
    const c = r.spawnAt<RingBoarder>('ring-boarder', 380, laneY(3), { look: 'stag', index: 2 });
    r.until(() => a.aboard || c.aboard, 600);
    const on = a.aboard ? a : c;
    const off = on === a ? c : a;
    r.run(60);
    expect(off.aboard).toBe(false);
    expect(off.mode === 'run' || off.mode === 'tell-hop').toBe(true);
    expect(off.mode).not.toBe('hop');
    wg.swerve(wg.laneTarget > 1 ? -1 : 1);
    r.run(2);
    expect(on.dead).toBe(true);
    // The jam clears: the one on foot runs for the hard shoulder.
    jamOf(r.world).level = 0;
    r.runner.limitSpeed('test-jam', null);
    r.run(40);
    if (!off.removed && !off.dead) {
      expect(off.mode).toBe('flee');
      r.until(() => off.removed, 600);
    }
  });

  it('telegraphs every hop and swing ≥ 18 ticks on screen; tokens hold (a wave of four)', () => {
    const r = rig({ god: true });
    stand(r);
    for (let i = 0; i < 4; i++) r.spawnAt('ring-boarder', 420 + i * 20, laneY(1 + (i % 4)), { look: i % 2 ? 'stag' : 'handhaver', index: i });
    const w = watchFairness(asTestWorld(r), 900, {
      attacks: { hop: 'tell-hop', hit: 'tell-hit' },
      tells: new Set(['tell-hop', 'tell-hit']),
      watched: (e) => e instanceof RingBoarder,
    });
    expect(w.attacks.some((a) => a.mode === 'hop')).toBe(true);
    expect(w.attacks.some((a) => a.mode === 'hit')).toBe(true);
    for (const a of w.attacks) {
      expect(a.prev).toBe(a.mode === 'hop' ? 'tell-hop' : 'tell-hit');
      expect(a.tell).toBeGreaterThanOrEqual(18);
      expect(a.tellInView).toBeGreaterThanOrEqual(18);
    }
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(r.world));
  });

  it('comes from the jam controller’s waves; gloats like its ams self (a fine, a selfie) and cowers', () => {
    const r = rig({ god: true });
    const jam = r.spawnAt<Entity & { phase: string }>('ring-jam', 420, laneY(2), {
      ticks: 900,
      waves: [[
        { id: 'ring-boarder', from: 'ahead', dx: 0, lane: 2, params: { look: 'handhaver', index: 0 } },
        { id: 'ring-boarder', from: 'ahead', dx: 30, lane: 3, params: { look: 'stag', index: 1 } },
      ]],
    });
    r.until(() => jam.phase === 'hold', 900);
    r.run(3);
    const bs = of(r, RingBoarder);
    expect(bs.length).toBe(2);
    r.run(60);
    const hh = bs.find((b) => b.kind === 'handhaver') as RingBoarder;
    const st = bs.find((b) => b.kind === 'stag') as RingBoarder;
    for (const b of bs) expect(b.react('gloat', 300, r.hero)).toBe(true);
    let attacked = false;
    const frames = new Set<number>();
    for (let i = 0; i < 200; i++) {
      r.run(1);
      if (bs.some((b) => b.mode.startsWith('tell') || b.mode === 'hit' || b.mode === 'hop')) attacked = true;
      if (hh.anim.id === `enemy/${BOARDER_SETS[hh.set].set}/gloat`) frames.add(hh.anim.index);
    }
    expect(attacked).toBe(false);
    expect(frames.has(0) && frames.has(4)).toBe(true);
    expect(st.anim.id).toBe(`enemy/${BOARDER_SETS[st.set].set}/gloat`);
    expect(r.world.entities.some((e) => e instanceof PlaneTumbler)).toBe(true);
    expect(st.react('cower', 60, null)).toBe(true);
    r.run(2);
    expect(st.anim.id).toBe(`enemy/${BOARDER_SETS[st.set].set}/cower`);
    expect(BOARDER.hp).toBeLessThanOrEqual(30);
  });
});
