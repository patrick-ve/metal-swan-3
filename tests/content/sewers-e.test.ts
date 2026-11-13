/**
 * Mission sewers, wave P1b E (docs/design/sewers.md §2.5, §2.6, §4.2): sewers-e DE AFVALHAL (the
 * approach, the trash ledges, DE RATTENJONG on his throne, the flood) and sewers-end DAGERAAD (the
 * manhole, the squad's white wagon). The section builds, the script runs in god mode to its exit, the lock opens,
 * the boss's three phases with their tells, the throws, the waves, the end, the dawn in 1P and 2P.
 */
import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/engine/terrain';
import { Boss } from '../../src/game/boss';
import { isSewersContent, loadContent } from '../../src/game/content/index';
import { KING, KING_RAT_TAG, Rattenjong, SEWERS_HANG } from '../../src/game/content/bosses/sewers-rattenjong/index';
import { KingBike, KingCart } from '../../src/game/content/bosses/sewers-rattenjong/shots';
import { SEWERS_E_IDS, SEWERS_ID } from '../../src/game/content/missions/sewers/ids';
import { SewersWagon } from '../../src/game/content/missions/sewers/e-kit';
import { G, SEWERS_E, SEWERS_END } from '../../src/game/content/missions/sewers/terrain';
import { getMission } from '../../src/game/registry';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';

await loadContent();
await loadContent(isSewersContent);
const SEWERS = getMission(SEWERS_ID)!;

type Opts = { section?: string; players?: 1 | 2; god?: boolean; bossRush?: boolean; bot?: boolean };
async function game(o: Opts = {}): Promise<HeadlessGame> {
  const g = await createHeadlessGame({ missionId: SEWERS_ID, sectionId: 'section' in o ? o.section : 'sewers-e', seed: 7, players: o.players ?? 1, god: o.god ?? true, bot: o.bot ?? true, captureConsole: true, loadContent: false, bossRush: o.bossRush ?? false });
  // The section script spawns the king on its first step.
  g.step(1);
  return g;
}

function king(g: HeadlessGame): Rattenjong | null {
  const b = g.runner?.world.byTag('boss')[0];
  return b instanceof Rattenjong ? b : null;
}

/** Step until `pred` or `max` ticks; returns the ticks taken (or -1). */
function until(g: HeadlessGame, pred: () => boolean, max: number): number {
  for (let t = 0; t < max; t++) {
    if (pred()) return t;
    g.step(1);
  }
  return pred() ? max : -1;
}

/** The live entities of a type. */
function byType(w: { entities: readonly { type: string; removed: boolean }[] }, type: string): unknown[] {
  return w.entities.filter((e) => e.type === type && !e.removed);
}

/** Set the king's HP to a fraction (the phase checks run as after a hit). */
function setFrac(k: Rattenjong, f: number): void {
  k.hp = Math.max(1, Math.round(k.maxHp * f));
  k.checkPhases();
}

describe('sewers-e: the section', () => {
  const s = SEWERS.sections['sewers-e'];

  it('the layout of spec §2.5: the walk line, the trash ledges at y 150 (one-way), the approach plinths, the checkpoints, the boss start, the fade exit', () => {
    const t = new Terrain(s.terrain);
    for (let x = 4; x < s.width; x += 32) expect(t.surfaceY(x, 170, 182), `ground ${x}`).toBe(G);
    for (const [x0, x1] of SEWERS_E.ledges) {
      expect(t.surfaceY((x0 + x1) / 2, 140, 160)).toBe(SEWERS_E.ledgeY);
      expect(t.surfaceY(x0 - 6, 140, 160)).toBe(Infinity);
    }
    expect(SEWERS_E.ledges).toEqual([[920, 990], [1110, 1180]]);
    expect(t.surfaceY(SEWERS_E.spitterX, 140, 160)).toBe(148);
    expect(s.checkpoints).toEqual([600, 880]);
    expect(s.bossStart).toEqual({ x: 880, y: G });
    expect(s.exits!.map((e) => [e.to, e.transition])).toEqual([['sewers-end', 'fade']]);
    expect(SEWERS.sections['sewers-end'].timeLimit).toBe(0);
  });

  it('1P god: the script runs from the approach through the boss to sewers-end and MISSION COMPLETE, no errors; the lock opens', async () => {
    const g = await game();
    const seen: string[] = [];
    let locked = false;
    let fought = false;
    g.runUntil((gg) => {
      const r = gg.runner;
      const id = r?.section.id;
      if (id && seen[seen.length - 1] !== id) seen.push(id);
      if (r && id === 'sewers-e') {
        if (r.world.camera.locked) locked = true;
        if (king(gg)?.state === 'fight') fought = true;
      }
      return gg.missionComplete;
    }, 14000);
    expect(seen).toEqual(['sewers-e', 'sewers-end']);
    expect(locked && fought).toBe(true);
    expect(g.missionComplete).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 60_000);

  it('2P god and 1P mortal: no softlock, the run completes', async () => {
    for (const o of [{ players: 2 as const }, { god: false }]) {
      const g = await game(o);
      g.runUntil((gg) => gg.missionComplete, 20000);
      expect(g.missionComplete, JSON.stringify(o)).toBe(true);
      expect(g.report().errors).toEqual([]);
      g.dispose();
    }
  }, 60_000);
});

describe('DE RATTENJONG (spec §4.2)', () => {
  it('dormant before the lock (no team, shots pass), then the intro and phase 1: bike (tell 30), cart (24), scooter (24) in order, every tell ≥ 18', async () => {
    // Before the lock (the approach): decor.
    const g0 = await game({ bot: false });
    const k0 = king(g0)!;
    expect(k0).not.toBeNull();
    expect(k0.team).toBe('neutral');
    expect(k0.hasTag('shootable')).toBe(false);
    expect(k0.onHit({ amount: 10, kind: 'bullet', dirX: 1 }, 0)).toBe(false);
    g0.dispose();
    const g = await game({ bossRush: true, bot: false });
    const k = king(g)!;
    expect(until(g, () => k.state === 'fight', 600)).toBeGreaterThanOrEqual(0);
    expect(k.hasTag('shootable')).toBe(true);
    // The throne: his seat at the pile's top (phase 1), his body above a standing hero's gun.
    expect(k.y).toBe(KING.tops[0]);
    const body = k.hurtboxes()[0];
    expect(body.y + body.h).toBeLessThanOrEqual(KING.tops[0]);
    expect(176 - 22 - (body.y + body.h / 2)).toBeGreaterThan(40);
    expect(until(g, () => k.attacks.length >= 3, 900)).toBeGreaterThanOrEqual(0);
    expect(k.attacks.slice(0, 3).map((a) => [a.kind, a.tell])).toEqual([
      ['bike', 30],
      ['cart', 24],
      ['scooter', 24],
    ]);
    for (const a of k.attacks) expect(a.onScreen).toBe(true);
    g.dispose();
  }, 30_000);

  it('the throws: the bike is shootable (24 HP) and shot down leaves no harmful parts; landed it breaks into 2 bouncing parts; the cart rolls at 2.5 px/tick under the ledges', async () => {
    const g = await game({ bossRush: true, bot: false });
    const w = g.runner!.world;
    // A bike shot down in the air.
    const b1 = KingBike.lob(w, 1000, 90, 940, G, null);
    expect(b1.hasTag('shootable')).toBe(true);
    expect(b1.hp).toBe(24);
    b1.die({ amount: 24, kind: 'bullet', dirX: 1, owner: 0 });
    expect(byType(w, SEWERS_E_IDS.bikePart).length).toBe(0);
    // A bike that lands.
    const b2 = KingBike.lob(w, 1000, 90, 960, G, null);
    until(g, () => b2.removed, 300);
    g.step(1);
    expect(byType(w, SEWERS_E_IDS.bikePart).length).toBe(2);
    // The cart: it drops to the walk line and rolls at 2.5 px/tick; its top stays below a ledge's top.
    const c = KingCart.shove(w, 1014, 120, -1, null);
    until(g, () => c.rolling, 120);
    const x0 = c.x;
    g.step(10);
    expect(Math.abs(c.x - x0)).toBeCloseTo(25, 5);
    expect(c.y - KING.cart.h / 2).toBeGreaterThan(SEWERS_E.ledgeY);
    g.dispose();
  }, 30_000);

  it('phase 2: the squeak (tell 40) and a wave of 6 runners + 1 spitter down the pile; no wave while adds are held; the pile lowers in three steps', async () => {
    const g = await game({ bossRush: true, bot: false });
    const k = king(g)!;
    until(g, () => k.state === 'fight', 600);
    setFrac(k, 0.65);
    expect(k.phase).toBe(1);
    expect(until(g, () => k.attacks.some((a) => a.kind === 'wave'), 400)).toBeGreaterThanOrEqual(0);
    const wave = k.attacks.find((a) => a.kind === 'wave')!;
    expect(wave.tell).toBe(40);
    const rats = g.runner!.world.byTag(KING_RAT_TAG);
    expect(rats.filter((r) => r.type === 'sewers-rat-runner').length).toBe(6);
    expect(rats.filter((r) => r.type === 'sewers-rat-spitter').length).toBe(1);
    // Held adds (every hero out): the next squeak brings no rats.
    for (const r of [...rats]) r.remove();
    k.addsHeld = true;
    const n = k.attacks.filter((a) => a.kind === 'wave').length;
    expect(until(g, () => k.attacks.filter((a) => a.kind === 'wave').length > n, 900)).toBeGreaterThanOrEqual(0);
    g.step(2);
    expect(g.runner!.world.countAlive(KING_RAT_TAG)).toBe(0);
    k.addsHeld = false;
    // The three steps: his seat (and his body) come down with the pile.
    const ys: number[] = [k.y];
    for (const f of [0.59, 0.49, 0.39]) {
      setFrac(k, f);
      g.step(2);
      ys.push(k.y);
    }
    expect(ys).toEqual([...KING.tops]);
    g.dispose();
  }, 30_000);

  it('phase 3: the jump down (tell 40), the charge (tell 30, 3.2 px/tick, a 24 px contact box), the tail (24), the bite (20); dazed 60 after each charge; a stagger ends the attack cleanly', async () => {
    const g = await game({ bossRush: true, bot: false });
    const k = king(g)!;
    until(g, () => k.state === 'fight', 600);
    setFrac(k, 0.3);
    expect(k.phase).toBe(2);
    expect(until(g, () => k.onFoot, 400)).toBeGreaterThanOrEqual(0);
    expect(k.y).toBe(G);
    expect(k.attacks.find((a) => a.kind === 'jump')!.tell).toBe(40);
    // A charge: the contact box is low (jumpable) and moves at 3.2 px/tick.
    expect(until(g, () => k.ramming === true, 600)).toBeGreaterThanOrEqual(0);
    const boxes = k.contactBoxes();
    expect(boxes.length).toBe(1);
    expect(boxes[0].h).toBe(24);
    expect(boxes[0].y + boxes[0].h).toBe(G);
    const x0 = k.x;
    g.step(5);
    if (k.ramming) expect(Math.abs(k.x - x0)).toBeCloseTo(16, 5);
    expect(until(g, () => k.pose === 'daze', 200)).toBeGreaterThanOrEqual(0);
    expect(k.contactDamage).toBeNull();
    // Let the hero stand close: the bite and the tail come too.
    const p = g.runner!.world.players[0];
    for (let i = 0; i < 1500 && !(k.attacks.some((a) => a.kind === 'bite') && k.attacks.some((a) => a.kind === 'tail')); i++) {
      p.x = Math.max(g.runner!.world.camera.left + 20, Math.min(g.runner!.world.camera.right - 20, k.x - k.facing * -40));
      g.step(1);
    }
    const tells = Object.fromEntries(k.attacks.map((a) => [a.kind, a.tell]));
    expect(tells).toMatchObject({ jump: 40, charge: 30, tail: 24, bite: 20 });
    for (const a of k.attacks) expect(a.tell).toBeGreaterThanOrEqual(18);
    // A stagger (a continued hero landed) during a charge: no live box, no contact damage.
    const r = until(g, () => k.ramming === true, 900);
    expect(r, JSON.stringify({ st: k.state, pose: k.pose, x: k.x, stag: k.staggerTicks, att: k.attacks.slice(-6).map((a) => a.kind + a.tick), tick: g.runner!.world.tick })).toBeGreaterThanOrEqual(0);
    k.stagger(60);
    g.step(2);
    expect(k.ramming).toBe(false);
    expect(k.contactDamage).toBeNull();
    expect(k.contactBoxes().length).toBe(0);
    g.dispose();
  }, 30_000);

  it('the end: the crack, the flood (cosmetic: no hazard) to y 190, the heroes hang on ≤ 120 ticks unhurt, his rats washed away, the fade to sewers-end', async () => {
    const g = await game({ bossRush: true, bot: false, players: 2 });
    const w = () => g.runner!.world;
    const k = king(g)!;
    until(g, () => k.state === 'fight', 600);
    setFrac(k, 0.65);
    until(g, () => w().countAlive(KING_RAT_TAG) > 0, 400);
    const hazards = w().terrain.hazards.length;
    k.kill(0);
    expect(until(g, () => byType(w(), SEWERS_E_IDS.flood).length > 0, 200)).toBeGreaterThanOrEqual(0);
    expect(w().terrain.hazards.length).toBe(hazards);
    expect(w().countAlive(KING_RAT_TAG)).toBe(0);
    let hang = 0;
    let deaths = 0;
    const flood = byType(w(), SEWERS_E_IDS.flood)[0] as unknown as { top: number };
    let top = Infinity;
    const t = until(
      g,
      () => {
        if (g.runner?.section.id !== 'sewers-e') return true;
        if (w().players.some((p) => (p as unknown as { status: { has(id: string): boolean } }).status.has(SEWERS_HANG.id))) hang++;
        for (const p of w().players) if ((p as unknown as { state: string }).state === 'dead') deaths++;
        top = Math.min(top, flood.top);
        return false;
      },
      400,
    );
    expect(t).toBeGreaterThan(0);
    expect(hang).toBeLessThanOrEqual(120);
    expect(hang).toBeGreaterThan(60);
    expect(deaths).toBe(0);
    expect(top).toBe(KING.end.floodY);
    expect(k.defeated).toBe(true);
    expect(g.runner?.section.id).toBe('sewers-end');
    g.dispose();
  }, 30_000);
});

describe('sewers-end: the dawn (spec §2.6, §0 row 56)', () => {
  it.each([1, 2] as const)('%iP: the heroes climb out, slimed; the white wagon comes from the right, turns, a hero nobody plays at the wheel says STAP IN, ZWAAN!; all aboard in ≤ 7 s; it leaves to the right; MISSION COMPLETE in about 460 ticks', async (players) => {
    const g = await createHeadlessGame({ missionId: SEWERS_ID, sectionId: 'sewers-end', seed: 7, players, god: true, bot: true, captureConsole: true, loadContent: false, characterId: 'vincent' });
    g.step(1);
    const w = g.runner!.world;
    // At the start every hero is hidden in the manhole.
    g.step(1);
    for (const p of w.players) expect((p as unknown as { state: string }).state).toBe('mounted');
    let wagon: SewersWagon | null = null;
    let open = -1;
    let boarded = -1;
    let slimed = 0;
    let firstX = Number.NaN;
    let lastX = Number.NaN;
    const views = new Set<string>();
    const said: string[] = [];
    const t = until(
      g,
      () => {
        if (g.missionComplete) return true;
        const rw = g.runner?.world;
        if (!rw) return false;
        for (const p of rw.players) if ((p as unknown as { status: { has(id: string): boolean } }).status.has('sewers-slimed')) slimed = Math.max(slimed, 1);
        wagon ??= (byType(rw, SEWERS_E_IDS.wagon)[0] as SewersWagon | undefined) ?? null;
        if (wagon) {
          if (Number.isNaN(firstX)) firstX = wagon.x;
          if (!wagon.gone) lastX = wagon.x;
          views.add(wagon.view);
          if (wagon.open && open < 0) open = rw.tick;
          if (boarded < 0 && wagon.riders.length === players) boarded = rw.tick;
        }
        for (const b of g.runner!.hud.bubbles) if (!said.includes(b.text)) said.push(b.text);
        return false;
      },
      1200,
    );
    expect(g.missionComplete).toBe(true);
    expect(slimed).toBe(1);
    expect(wagon).not.toBeNull();
    const wg = wagon!;
    expect(wg.stopX).toBe(SEWERS_END.wagonX);
    // In from the right (its left side), the handbrake turn, then off to the right.
    expect(firstX).toBeGreaterThan(384);
    expect([...views]).toEqual(['left', 'spin', 'right']);
    expect(lastX).toBeGreaterThan(384);
    // The driver: a squad hero nobody plays.
    expect(['thom', 'dirk', 'bob', 'patrick']).toContain(wg.driver);
    expect(said).toEqual(['STAP IN, ZWAAN!', 'IK RUIK NAAR RIOOL.']);
    // One wagon takes every hero.
    expect(wg.riders.length).toBe(players);
    expect(byType(w, SEWERS_E_IDS.wagon).length).toBeLessThanOrEqual(1);
    expect(boarded - open).toBeLessThanOrEqual(420);
    expect(t).toBeGreaterThan(380);
    expect(t).toBeLessThan(800);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 30_000);

  it('the driver is a hero nobody plays: never a playing hero, 2P neither one, null when all five play', async () => {
    const { wagonDriver } = await import('../../src/game/content/missions/sewers/section-end');
    const { Rng } = await import('../../src/engine/rng');
    const slots = (chars: string[]) => ({ slots: chars.map((character) => ({ joined: true, character })) }) as never;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new Rng(seed);
      const d1 = wagonDriver({ session: slots(['vincent']), rng });
      expect(['thom', 'dirk', 'bob', 'patrick']).toContain(d1);
      const d2 = wagonDriver({ session: slots(['thom', 'bob']), rng });
      expect(['vincent', 'dirk', 'patrick']).toContain(d2);
      // The pick forks the rng: it never advances it.
      expect(rng.next()).toBe(new Rng(seed).next());
    }
    expect(wagonDriver({ session: slots(['vincent', 'thom', 'dirk', 'bob', 'patrick']), rng: new Rng(1) })).toBeNull();
  });

  it('the boss rush starts in the Rattenjong arena; the boss is a Boss worth 20,000 points', async () => {
    const g = await game({ section: undefined, bossRush: true, bot: false });
    expect(g.runner?.section.id).toBe('sewers-e');
    const k = king(g)!;
    expect(k instanceof Boss).toBe(true);
    expect(k.scoreValue()).toBe(KING.score);
    g.dispose();
  });
});
