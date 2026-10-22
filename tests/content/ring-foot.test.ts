/**
 * Revision R, JAM+FOOT (docs/design/ring.md §R.4, §R.5; docs/api/ring.md "Final jam, alight,
 * rf-a"): the final jam never clears and shows FILE / BLOKKADE; the alight scene hands over with
 * every hero who was in a wagon (on foot, landed); rf-a loads and the bot crosses it (god, 1P and
 * 2P) with the hostage; the gangs on foot tell every attack ≥ 18 ticks on screen and end bloodless
 * (roll, dazed, run off); the pacing (GDD 1.5); the art at 1× / 2× / 4× with the 1× geometry.
 */
import { describe, expect, it } from 'vitest';
import { getFrames, hasHiSprite, listSprites } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { FootGang, RF_BACKGROUND, RF_SCENERY_RESERVE, RF_A_PLATFORMS, RF_A_VEHICLES, RF_SCENE, RING_FOOT_HOSTAGES, ringFootDef, sectionRfA } from '../../src/game/content/ring/foot/index';
import { RingGantry, RingJam } from '../../src/game/content/ring/hazards/index';
import { dripFrame } from '../../src/game/content/ring/hazards/art-drip';
import { ALIGHT, alightSeen, AlightDirector, setAlightSeen } from '../../src/game/ring/alight';
import { planRing } from '../../src/game/ring/plan';
import { createHeadlessRing, type HeadlessRing } from '../../src/sim/headless-ring';

await loadContent();

/** Run a foot start until rf-a ends (the section turns rf-b) or `max` ticks. */
async function crossRfA(players: 1 | 2, seed = 1, watch?: (h: HeadlessRing) => void): Promise<{ h: HeadlessRing; ticks: number; done: boolean }> {
  const h = await createHeadlessRing({ seed, god: true, bot: true, section: 'rf-a', players, loadContent: false } as never);
  let t = 0;
  for (; t < 9000; t++) {
    h.step(1);
    const r = h.footRunner;
    if (r && r.section?.id === 'rf-b') return { h, ticks: t, done: true };
    if (watch) watch(h);
  }
  return { h, ticks: t, done: false };
}

describe('the final jam and the alight (section zwaan, god, the bots)', () => {
  it('the final jam never clears, shows the X / FILE BLOKKADE gantry; the alight hands over with every hero on the road', async () => {
    setAlightSeen(false);
    const h = await createHeadlessRing({ seed: 2, god: true, bot: true, section: 'zwaan', loadContent: false } as never);
    try {
      let jam: RingJam | null = null;
      let gantry: RingGantry | null = null;
      let director: AlightDirector | null = null;
      let clears = 0;
      let landed = 0;
      let mountedAtStart = 0;
      let trainDone = false;
      h.runner!.world.events.on('ringTrainDone', () => (trainDone = true));
      for (let t = 0; t < 24_000 && !h.footScene; t++) {
        h.step(1);
        const r = h.runner;
        if (!r) continue;
        const w = r.world;
        for (const e of w.byTag('ring-jam')) if (e instanceof RingJam && e.final) jam = e;
        for (const e of w.byTag('ring-gantry')) if (e instanceof RingGantry && e.drip >= 0) gantry = e;
        if (jam && (jam.phase === 'clear' || jam.phase === 'done')) clears++;
        const d = w.entities.find((e) => e instanceof AlightDirector) as AlightDirector | undefined;
        if (d && !director) {
          director = d;
          mountedAtStart = d.seats.length;
        }
        if (director) for (const s of director.seats) if (s.phase === 'land' || s.phase === 'done') landed = Math.max(landed, director.seats.filter((x) => x.phase === 'land' || x.phase === 'done').length);
      }
      expect(trainDone).toBe(true);
      expect(jam, 'the final jam spawned').not.toBeNull();
      expect(clears).toBe(0);
      expect(jam!.waves.length).toBe(0);
      expect(gantry, 'the FILE / BLOKKADE gantry').not.toBeNull();
      expect(gantry!.faces).toEqual(['x', 'x', 'x', 'x']);
      expect(gantry!.drip).toBe(dripFrame('file'));
      expect(director, 'the alight ran').not.toBeNull();
      expect(mountedAtStart).toBe(1);
      expect(landed).toBe(1);
      expect(h.footScene).not.toBeNull();
      expect(alightSeen()).toBe(true);
    } finally {
      h.dispose();
      setAlightSeen(false);
    }
  }, 120_000);

  it('2P: both heroes get out (P2 a little later), then the hand-over', async () => {
    const h = await createHeadlessRing({ seed: 1, god: true, bot: true, section: 'zwaan', players: 2, loadContent: false } as never);
    try {
      let seats = 0;
      const landAt: number[] = [];
      for (let t = 0; t < 24_000 && !h.footScene; t++) {
        h.step(1);
        const w = h.runner?.world;
        const d = w?.entities.find((e) => e instanceof AlightDirector) as AlightDirector | undefined;
        if (!d) continue;
        seats = d.seats.length;
        d.seats.forEach((s, i) => {
          if (s.phase === 'land' && landAt[i] === undefined) landAt[i] = t;
        });
      }
      expect(seats).toBe(2);
      expect(landAt.length).toBe(2);
      expect(landAt[1] - landAt[0]).toBeGreaterThanOrEqual(ALIGHT.delay[1] - ALIGHT.delay[0] - 1);
      expect(h.footScene).not.toBeNull();
    } finally {
      h.dispose();
    }
  }, 120_000);
});

describe('rf-a DE FILE', () => {
  it('the layout: roofs are platforms over the near lane; the foot def counts its hostage; the plan drivers reach the scene', () => {
    expect(sectionRfA.id).toBe('rf-a');
    expect(RING_FOOT_HOSTAGES['rf-a']).toBe(1);
    expect(RF_A_PLATFORMS.length).toBeGreaterThan(RF_A_VEHICLES.length - 3);
    for (const [, y, w] of RF_A_PLATFORMS) {
      expect(w).toBeGreaterThan(10);
      expect(y).toBeLessThan(176 - 18);
    }
    const cps = [0, ...(sectionRfA.checkpoints ?? []), sectionRfA.width];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1]).toBeLessThanOrEqual(1400);
    const def = ringFootDef(planRing(1));
    expect(def.sections['rf-a']).toBe(sectionRfA);
  });

  it('the background layers at 4× and 2× fit the foot reserve (RF_SCENERY_RESERVE) with room for the 1× terrain', () => {
    let px = 0;
    for (const l of RF_BACKGROUND?.layers ?? []) px += (l.width ?? 512) * (l.height ?? 216);
    const bytes = px * 4 * (16 + 4);
    expect(bytes + 4 * 1024 * 1024).toBeLessThanOrEqual(RF_SCENERY_RESERVE);
  });

  for (const players of [1, 2] as const) {
    it(`the bot crosses rf-a (god, ${players}P): the hostage, the jam scene, no gap > 4 s without a gang member in view`, async () => {
      let quiet = 0;
      let worst = 0;
      let scene = false;
      const { h, done, ticks } = await crossRfA(players, 1, (hh) => {
        const w = hh.footRunner?.world;
        if (!w) return;
        if (w.entities.some((e) => e.type === RF_SCENE)) scene = true;
        const on = w.byTag('enemy').some((e) => e.alive && w.onScreen(e, 0));
        quiet = on ? 0 : quiet + 1;
        // The first second is the scene (the parked wagons, the squad's first steps).
        if (hh.ticks > 60) worst = Math.max(worst, quiet);
      });
      try {
        expect(done).toBe(true);
        expect(scene).toBe(true);
        expect(ticks).toBeGreaterThan(2400);
        expect(ticks).toBeLessThan(6000);
        expect(worst).toBeLessThanOrEqual(240);
        expect(h.report().foot?.hostages ?? 0, 'the hostage in the parcel van').toBeGreaterThanOrEqual(1);
      } finally {
        h.dispose();
      }
    }, 120_000);
  }

  it('the gangs on foot: every attack after a tell ≥ 18 ticks on screen; beaten ones roll, sit dazed and run off (never removed at once)', async () => {
    const tells: Array<{ kind: string; len: number; on: boolean }> = [];
    const prev = new Map<FootGang, { mode: string; t: number }>();
    const ends = new Map<FootGang, Set<string>>();
    const { h, done } = await crossRfA(1, 3, (hh) => {
      const w = hh.footRunner?.world;
      if (!w) return;
      for (const e of w.byTag('enemy')) {
        if (!(e instanceof FootGang)) continue;
        const p = prev.get(e);
        if (p && p.mode === 'tell' && e.mode === 'attack') tells.push({ kind: `${e.type}:${e.attack}`, len: p.t, on: w.onScreen(e, 0) });
        prev.set(e, { mode: e.mode, t: e.modeT });
        if (e.dead) {
          const s = ends.get(e) ?? new Set<string>();
          s.add(e.endPhase);
          ends.set(e, s);
        }
      }
    });
    try {
      expect(done).toBe(true);
      expect(tells.length).toBeGreaterThanOrEqual(5);
      for (const t of tells) {
        expect(t.len, t.kind).toBeGreaterThanOrEqual(18);
        expect(t.on, t.kind).toBe(true);
      }
      const kinds = new Set(tells.map((t) => t.kind.split(':')[0]));
      expect([...kinds].sort()).toEqual(['ring-foot-courier', 'ring-foot-crew', 'ring-foot-rider']);
      // Some beaten members were seen through the whole bloodless end.
      const full = [...ends.values()].filter((s) => s.has('roll') && s.has('dazed') && s.has('flee'));
      expect(full.length).toBeGreaterThan(3);
    } finally {
      h.dispose();
    }
  }, 120_000);
});

describe('the art of the jam and the gangs on foot (1×, 2×, 4×; geometry is law)', () => {
  const ids = [...listSprites('ring/foot/'), 'ring/hazard/drip'];

  it('every new id has 2× and 4× art', () => {
    expect(ids.length).toBeGreaterThan(40);
    for (const id of ids) {
      expect(hasHiSprite(id, 2) || hasHiSprite(id, 4), id).toBe(true);
    }
  });

  it('a 2× / 4× frame keeps its 1× frame’s logical size, anchor and points', () => {
    for (const id of ids) {
      const one = getFrames(id, 1);
      for (const d of [2, 4]) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id} @${d}`).toBe(one.length);
        hd.forEach((f, i) => {
          const b = one[i];
          const k = f.density ?? 1;
          expect(f.buf.w / k, `${id}#${i} @${d} w`).toBe(b.buf.w);
          expect(f.buf.h / k, `${id}#${i} @${d} h`).toBe(b.buf.h);
          expect([f.ox, f.oy], `${id}#${i} @${d} anchor`).toEqual([b.ox, b.oy]);
          expect(f.pts ?? {}, `${id}#${i} @${d} points`).toEqual(b.pts ?? {});
        });
      }
    }
  }, 120_000);


});
