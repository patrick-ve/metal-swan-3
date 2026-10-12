/**
 * THE WINDBAG (m3 boss, GDD §10.3): spawn, every attack after its telegraph, parts breaking in
 * order (drones → bag), a won fight with the pistol and grenades from a safe spot (time to kill
 * measured), the death sequence and the 'bossDefeated' event, no errors; palette-only art.
 */
import { describe, expect, it } from 'vitest';
import { buttonMask, type Button } from '../../src/engine/input';
import { inPalette } from '../../src/engine/palette';
import type { ScriptGen } from '../../src/engine/script';
import { getFrames, listSprites } from '../../src/engine/sprites';
import { DRONE_NAMES, HOME, WINDBAG, Windbag } from '../../src/game/content/bosses/m3/index';
import '../../src/game/content/vehicles/swan/index';
import { FLOOR, TestWorld } from './helpers';

/** The m3-c arena: LOCK 896–1280, deck at y 176, the hut and two snow piles. */
const LEFT = 896;

function arena(o: { god?: boolean; difficulty?: 'easy' | 'normal' | 'hard'; playerX?: number; hpScale?: number; players?: number } = {}): { tw: TestWorld; boss: Windbag } {
  const tw = new TestWorld({
    width: 1400,
    god: o.god ?? true,
    difficulty: o.difficulty,
    playerX: o.playerX ?? LEFT + 100,
    build: (t) => {
      t.solid(912, 136, 40, 40);
      t.solid(1034, 160, 24, 16);
      t.solid(1134, 160, 24, 16);
    },
  });
  tw.world.camera.lock(LEFT, LEFT + 384);
  tw.world.camera.snap();
  const boss = tw.spawn('windbag', 1088, o.hpScale ? { hpScale: o.hpScale } : {}, FLOOR) as Windbag;
  return { tw, boss };
}

/** A fight without the intro or the phase patterns: attacks are run one by one. */
function bare(o: { difficulty?: 'easy' | 'normal' | 'hard'; phase?: number } = {}): { tw: TestWorld; boss: Windbag } {
  const a = arena({ difficulty: o.difficulty });
  a.boss.autoStart = false;
  a.boss.state = 'fight';
  a.boss.mode = 'hold';
  a.boss.homeX = o.phase === 2 ? HOME.p3.x : o.phase === 1 ? HOME.p2.x : HOME.p1.x0;
  a.boss.homeY = o.phase === 2 ? HOME.p3.y : o.phase === 1 ? HOME.p2.y : HOME.p1.y;
  a.boss.ax = a.boss.homeX;
  a.boss.ay = a.boss.homeY;
  a.boss.place();
  return a;
}

/** Run an attack; returns the ticks until `pred` first holds. */
function firstAt(tw: TestWorld, boss: Windbag, gen: ScriptGen, pred: () => boolean, max = 400): number {
  tw.world.scripts.run(gen, { owner: boss });
  return tw.until(pred, max);
}

describe('THE WINDBAG (windbag)', () => {
  it('spawns with the GDD parts, HP and score, rises from below and floats in the arena view', () => {
    const { tw, boss } = arena();
    expect(boss).toBeInstanceOf(Windbag);
    expect(boss.parts.map((p) => p.name)).toEqual(['drone-1', 'drone-2', 'drone-3', 'chanter', 'bag']);
    expect(boss.parts.map((p) => p.maxHp)).toEqual([800, 800, 800, 1500, 2500]);
    expect(boss.parts.map((p) => p.required)).toEqual([true, true, true, false, true]);
    expect(boss.maxHp).toBe(4900);
    expect(boss.scoreValue()).toBe(50000);
    expect(boss.groundY).toBe(FLOOR);
    // The m3-c script spawns it with facing −1: the airship never flips its part boxes.
    const m = arena().tw.spawn('windbag', 1128, { facing: -1 }, FLOOR) as Windbag;
    m.place();
    expect(m.facing).toBe(1);
    tw.run(2);
    expect(boss.state).toBe('intro');
    expect(boss.y).toBeGreaterThan(FLOOR);
    tw.until(() => boss.state === 'fight', WINDBAG.intro + 10);
    expect(boss.phase).toBe(0);
    // GDD: the airship floats at view x 180–360, y 10–120 (the bag and its drones).
    for (let i = 0; i < 800; i += 20) {
      tw.run(20);
      const b = boss.hitbox;
      expect(boss.x + b.x).toBeGreaterThanOrEqual(LEFT);
      expect(boss.x + b.x + b.w).toBeLessThanOrEqual(LEFT + 384);
      expect(boss.y + b.y).toBeGreaterThanOrEqual(0);
    }
    expect(tw.world.errors).toEqual([]);
  });

  it('2 players: HP ×1.5; HARD: ×1.25 and +1 projectile per volley', () => {
    const hard = bare({ difficulty: 'hard' });
    expect(hard.boss.maxHp).toBe(Math.round(800 * 1.25) * 3 + Math.round(2500 * 1.25));
    expect(hard.boss.volleySize(3)).toBe(4);
  });

  it('A Gust: the bag swells for 60 ticks, then players are pushed left at 0.6 px/tick for 90', () => {
    const { tw, boss } = bare();
    const p = tw.player!;
    p.placeAt(LEFT + 120, FLOOR, 0);
    const x0 = p.x;
    const t = firstAt(tw, boss, boss.gust(), () => boss.gustT > 0);
    expect(t).toBeGreaterThanOrEqual(WINDBAG.gust.tele);
    expect(Math.abs(p.x - x0)).toBeLessThanOrEqual(0.61);
    tw.run(WINDBAG.gust.ticks);
    expect(Math.abs(x0 - p.x - 0.6 * WINDBAG.gust.ticks)).toBeLessThanOrEqual(0.7);
    // Walking right still makes headway.
    const b = bare();
    b.tw.player!.placeAt(LEFT + 168, FLOOR, 0);
    b.boss.startGust(90);
    const bx = b.tw.player!.x;
    b.tw.hold('right').run(60);
    expect(b.tw.player!.x).toBeGreaterThan(bx + 30);
  });

  it('A Gust pushes a ridden Swan like a player', () => {
    const { tw, boss } = bare();
    const swan = tw.spawn('swan', LEFT + 120, {}, FLOOR) as unknown as { x: number; mount(p: unknown): void };
    swan.mount(tw.player!);
    tw.run(2);
    const x0 = swan.x;
    boss.startGust(60);
    tw.run(60);
    expect(x0 - swan.x).toBeGreaterThan(30);
  });

  it('B Drone Bolts: a drone glows for 40 ticks, then 3 shootable homing notes that turn toward the player', () => {
    const { tw, boss } = bare();
    const t = firstAt(tw, boss, boss.droneBolts(), () => tw.ofType('homing-note').length > 0);
    expect(t).toBeGreaterThanOrEqual(WINDBAG.bolts.tele);
    tw.run(WINDBAG.bolts.gap * 2 + 2);
    const notes = tw.ofType('homing-note');
    expect(notes.length).toBe(3);
    expect(notes.every((n) => n.hasTag('shootable') && n.hp === 10)).toBe(true);
    // They turn toward the player (below-left of the drones).
    const n = notes[0];
    const p = tw.player!;
    const d0 = Math.hypot(n.x - p.x, n.y - p.y);
    tw.run(30);
    expect(Math.hypot(n.x - p.x, n.y - p.y)).toBeLessThan(d0);
    // HARD: 4 notes.
    const h = bare({ difficulty: 'hard' });
    firstAt(h.tw, h.boss, h.boss.droneBolts(), () => h.tw.ofType('homing-note').length > 0);
    h.tw.run(WINDBAG.bolts.gap * 3 + 2);
    expect(h.tw.ofType('homing-note').length).toBe(4);
  });

  it('C Sheet-Music Mines: the hatch flaps 20 ticks, 4 pages flutter down (≥ 40 ticks in view) and explode', () => {
    const { tw, boss } = bare();
    tw.player!.placeAt(LEFT + 10, FLOOR, 0);
    const t = firstAt(tw, boss, boss.mines(), () => tw.ofType('sheet-mine').length > 0);
    expect(t).toBeGreaterThanOrEqual(WINDBAG.mines.tele);
    tw.run(30);
    const mines = tw.ofType('sheet-mine');
    expect(mines.length).toBe(4);
    const born = tw.world.tick;
    tw.until(() => tw.ofType('sheet-mine').length < 4, 400);
    expect(tw.world.tick - born + 18).toBeGreaterThanOrEqual(40);
    tw.until(() => tw.ofType('sheet-mine').length === 0, 400);
    expect(tw.world.errors).toEqual([]);
  });

  it('D Reel: holes light for 30 ticks; harmless notes arc onto a line that sweeps from the far left toward the boss', () => {
    const { tw, boss } = bare({ phase: 1 });
    tw.player!.placeAt(LEFT + 380, FLOOR, 0);
    const t = firstAt(tw, boss, boss.reel(), () => tw.ofType('reel-note').length > 0);
    expect(t).toBeGreaterThanOrEqual(WINDBAG.reel.tele);
    const xs: number[] = [];
    for (let i = 0; i < 140; i++) {
      tw.run(1);
      for (const n of tw.ofType('reel-note')) {
        const r = n as unknown as { landed: boolean; x: number; t: number };
        if (r.landed && r.t === 1) xs.push(r.x);
      }
    }
    expect(xs.length).toBeGreaterThanOrEqual(12);
    expect(xs[0]).toBeLessThan(LEFT + 20);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('D Reel: a standing player is hit once the line arrives; a jump at the right moment clears it', () => {
    const run = (jumpAt: number | null): number => {
      const { tw, boss } = bare({ phase: 1 });
      const p = tw.player!;
      tw.world.god = false;
      p.placeAt(LEFT + 100, FLOOR, 0);
      p.invulnTicks = 0;
      let deaths = 0;
      tw.world.events.on('playerDied', () => deaths++);
      tw.world.scripts.run(boss.reel(), { owner: boss });
      for (let i = 0; i < 200; i++) {
        let jump = false;
        if (jumpAt !== null) {
          // Jump when a burst lands within 40 px to the left.
          for (const n of tw.ofType('reel-note')) {
            const r = n as unknown as { landed: boolean; x: number };
            if (r.landed && r.x > p.x - 40 && r.x < p.x) jump = true;
          }
        }
        tw.pad.update(jump ? buttonMask('jump') : 0);
        tw.world.update();
      }
      return deaths;
    };
    expect(run(null)).toBe(1);
    expect(run(1)).toBe(0);
  });

  it('E Pendulum Gondola: 40-tick pull-back, then the gondola swings across 24 px above the deck in mid-arena (crouch)', () => {
    const { tw, boss } = bare({ phase: 1 });
    const t = firstAt(tw, boss, boss.pendulum(), () => boss.contact === 'gondola');
    expect(t).toBeGreaterThanOrEqual(WINDBAG.pendulum.tele);
    let lowest = Infinity;
    let lowX = 0;
    while (boss.contact === 'gondola') {
      tw.run(1);
      const gap = FLOOR - (boss.y + boss.gdy + 24);
      if (gap < lowest) {
        lowest = gap;
        lowX = boss.x + boss.gdx;
      }
    }
    expect(Math.round(lowest)).toBe(24);
    expect(Math.abs(lowX - (LEFT + 192))).toBeLessThan(24);
    // A crouching player (20 px) is safe, a standing one (30 px) is hit.
    const hit = (crouch: boolean): number => {
      const b = bare({ phase: 1 });
      b.tw.world.god = false;
      b.tw.player!.placeAt(LEFT + 192, FLOOR, 0);
      let deaths = 0;
      b.tw.world.events.on('playerDied', () => deaths++);
      b.tw.world.scripts.run(b.boss.pendulum(), { owner: b.boss });
      b.tw.hold(...(crouch ? (['down'] as Button[]) : [])).run(220);
      return deaths;
    };
    expect(hit(false)).toBe(1);
    expect(hit(true)).toBe(0);
  });

  it('F Leak Dash: a dotted path for 30 ticks, a level dash that bounces off the left edge and stops; a dive at a shadow', () => {
    const { tw, boss } = bare({ phase: 2 });
    tw.player!.placeAt(LEFT + 150, FLOOR, 0);
    tw.world.scripts.run(boss.leakDash(), { owner: boss });
    tw.run(2);
    expect(boss.dash?.kind).toBe('flat');
    const t = tw.until(() => boss.contact === 'all', 200);
    expect(t).toBeGreaterThanOrEqual(WINDBAG.dash.tele);
    let minX = Infinity;
    tw.until(() => {
      minX = Math.min(minX, boss.ax);
      return boss.contact === 'none';
    }, 300);
    expect(minX - 86).toBeLessThanOrEqual(4);
    // The airship's bottom stays above a standing player's head during a level dash.
    expect(boss.bottomVY()).toBeLessThan(176 - 30);
    tw.run(WINDBAG.dash.rec + 150);
    tw.world.scripts.run(boss.leakDash(), { owner: boss });
    tw.until(() => boss.dash !== null, 200);
    expect(boss.dash?.kind).toBe('dive');
    tw.until(() => boss.contact === 'all', 200);
    tw.until(() => boss.contact === 'none', 300);
    expect(tw.world.errors).toEqual([]);
  });

  it('the bag says boing while a drone is left; parts break drones → bag; phases follow', () => {
    const { tw, boss } = arena();
    tw.until(() => boss.state === 'fight', 400);
    const bag = boss.part('bag')!;
    const d = { amount: 100, kind: 'bullet' as const, dirX: 1, owner: 0 };
    boss.onHit({ ...d }, 4);
    expect(bag.hp).toBe(2500);
    for (let i = 0; i < 3; i++) boss.onHit({ ...d, amount: 800 }, i);
    expect(boss.brokenCount(DRONE_NAMES)).toBe(3);
    expect(boss.phase).toBe(1);
    tw.run(WINDBAG.intermission + 2);
    boss.onHit({ ...d, amount: 1400 }, 4);
    expect(bag.hp).toBe(1100);
    expect(boss.phase).toBe(1);
    boss.onHit({ ...d, amount: 200 }, 4);
    expect(boss.phase).toBe(2);
    expect(boss.leak).toBe(true);
    tw.run(400);
    expect(tw.world.errors).toEqual([]);
  });

  it('is won with the pistol and grenades from a safe spot; the death sequence ends with bossDefeated', () => {
    const { tw, boss } = arena();
    const p = tw.player!;
    const order: string[] = [];
    let defeated = 0;
    let grenades = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    tw.until(() => boss.state === 'fight', 400);
    const start = tw.world.tick;
    for (let i = 0; i < 30000 && !boss.dead; i++) {
      // Stand under the lowest live required part and fire up; lob grenades up at the bag.
      let tx = boss.x;
      const drones = DRONE_NAMES.map((n) => boss.part(n)!).filter((q) => !q.destroyed);
      if (drones.length > 0) {
        const r = boss.partRect(drones[drones.length - 1]);
        tx = r.x + r.w / 2;
      } else {
        const r = boss.partRect(boss.part('bag')!);
        tx = r.x + r.w / 2;
      }
      tx = Math.max(LEFT + 64, Math.min(LEFT + 376, tx));
      const btn: Button[] = ['up'];
      if (i % 2 === 0) btn.push('fire');
      if (drones.length === 0 && i % 90 === 45 && p.slot.bombs > 0) {
        btn.push('bomb');
        grenades++;
      }
      tw.pad.update(buttonMask(...btn));
      tw.world.update();
      p.x = tx;
      for (const q of boss.parts) if (q.destroyed && !order.includes(q.name)) order.push(q.name);
    }
    const fightTicks = tw.world.tick - start;
    expect(boss.dead).toBe(true);
    expect(order.filter((n) => n.startsWith('drone')).length).toBe(3);
    expect(order[order.length - 1]).toBe('bag');
    expect(order.indexOf('bag')).toBeGreaterThan(order.lastIndexOf('drone-1'));
    console.info(`[boss-m3] time to kill: ${fightTicks} ticks (${(fightTicks / 60).toFixed(1)} s), grenades ${grenades}, order ${order.join(' > ')}`);
    expect(fightTicks).toBeLessThan(150 * 60);
    const dt = tw.until(() => boss.defeated, WINDBAG.death + 30);
    expect(dt).toBeGreaterThan(WINDBAG.death - 20);
    expect(defeated).toBe(1);
    tw.run(300);
    expect(tw.ofType('windbag-puffington').length).toBe(1);
    expect(tw.ofType('windbag-wreck').length).toBe(1);
    const puff = tw.ofType('windbag-puffington')[0];
    expect(Math.abs(puff.y - FLOOR)).toBeLessThan(1);
    expect(boss.removed).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks of a full fight against a mortal, idle player without errors', () => {
    const { tw, boss } = arena({ god: false, hpScale: 0.3 });
    let phases = 0;
    tw.world.events.on('bossPhase', () => phases++);
    tw.run(3000);
    expect(tw.world.errors).toEqual([]);
    expect(phases).toBeGreaterThanOrEqual(1);
    expect(boss.removed).toBe(false);
  });

  it('art: every part has its -0/-1/-2 strips; all sprites are palette-only', () => {
    const ids = listSprites('boss/windbag/');
    for (const part of ['drone-1', 'drone-2', 'drone-3', 'chanter', 'bag']) for (const s of [0, 1, 2]) expect(ids).toContain(`boss/windbag/${part}-${s}`);
    for (const id of ids) {
      for (const f of getFrames(id)) {
        const d = f.buf.data;
        let bad = 0;
        for (let i = 0; i < d.length; i++) if ((d[i] & 255) !== 0 && ((d[i] & 255) !== 255 || !inPalette(d[i]))) bad++;
        expect(bad, id).toBe(0);
      }
    }
  });
});
