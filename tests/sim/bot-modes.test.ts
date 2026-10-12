/**
 * Bot modes on small synthetic sections (tests/sim/bot-missions.ts): FLIGHT (a Trumpeter in an
 * auto-scrolling sky), SWAN (mount a parked swan, run, jump, swim, glide; a body wall throws the
 * pilot out), vertical climbs ('up', with a cable car) and descents ('down', drop-through and a
 * solid shelf), and rides (a cable car across a pit, a drifting float over deep water).
 * All but the climb run mortal (no god mode).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { createHeadlessGame, type HeadlessGame, type SimReport } from '../../src/sim/index';
import './bot-missions';

interface Seen {
  modes: Set<string>;
  media: Set<string>;
  glides: number;
  rides: Set<string>;
  mounts: number;
  minCells: number;
}

async function play(missionId: string, o: { god?: boolean; seed?: number; players?: 1 | 2; maxTicks?: number; dodge?: boolean } = {}): Promise<{ r: SimReport; seen: Seen }> {
  const game: HeadlessGame = await createHeadlessGame({ missionId, seed: o.seed ?? 1, god: o.god ?? false, players: o.players ?? 1, bot: { dodge: o.dodge ?? true } });
  const seen: Seen = { modes: new Set(), media: new Set(), glides: 0, rides: new Set(), mounts: 0, minCells: Infinity };
  try {
    let lastState = '';
    game.runUntil((g) => {
      const b = g.bots[0];
      const p = g.player(0);
      if (b && p) {
        seen.modes.add(b.mode);
        const v = p.vehicle as (Entity & { medium?: string; glide?: string; cells?: number }) | null;
        if (v) {
          if (v.medium) seen.media.add(v.medium);
          if (v.glide === 'open') seen.glides++;
          if (typeof v.cells === 'number') seen.minCells = Math.min(seen.minCells, v.cells);
        }
        if (p.state === 'mounted' && lastState !== 'mounted') seen.mounts++;
        lastState = p.state;
        const sup = p.onGround ? p.body.supportSolid : null;
        const owner = sup?.owner as Entity | null | undefined;
        if (owner && typeof owner.type === 'string') seen.rides.add(owner.type);
      }
      return g.done;
    }, o.maxTicks ?? 6000);
    return { r: game.report(), seen };
  } finally {
    game.dispose();
  }
}

describe('bot modes', () => {
  it('FLIGHT: flies the Trumpeter through an auto-scrolling sky, shoots, dodges and collects', async () => {
    const { r, seen } = await play('bot-flight');
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(seen.modes.has('flight')).toBe(true);
    expect(seen.modes.has('foot')).toBe(false); // never bails out
    expect(r.deaths).toBe(0);
    expect(seen.minCells).toBeGreaterThanOrEqual(2);
    expect(r.kills).toBeGreaterThanOrEqual(12);
    expect(r.pickups).toBeGreaterThanOrEqual(3);
  });

  it('FLIGHT: dodging is what keeps the cells (the same run without it loses some)', async () => {
    const withDodge = await play('bot-flight', { seed: 4 });
    const without = await play('bot-flight', { seed: 4, dodge: false });
    expect(withDodge.seen.minCells).toBe(3);
    expect(without.seen.minCells).toBeLessThan(3);
  });

  it('FLIGHT: two Trumpeters (two bots) finish together', async () => {
    const { r } = await play('bot-flight', { players: 2, seed: 2 });
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(r.deaths).toBe(0);
  });

  it('SWAN: mounts the parked swan, jumps a pit and a wall, swims, glides a long pit', async () => {
    const { r, seen } = await play('bot-swan');
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(seen.modes.has('swan')).toBe(true);
    expect(seen.mounts).toBe(1); // never ejects, no SWAN DIVE
    expect([...seen.media].sort()).toEqual(['air', 'ground', 'water']);
    expect(seen.glides).toBeGreaterThan(20);
    expect(r.deaths).toBe(0);
    expect(r.kills).toBeGreaterThanOrEqual(2);
  });

  it('SWAN: thrown out by a swan-only wall, goes on on foot and does not climb back in', async () => {
    const { r, seen } = await play('bot-swan-wall');
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(seen.mounts).toBe(1);
    expect(seen.modes.has('swan')).toBe(true);
    expect(seen.modes.has('foot')).toBe(true);
  });

  it("UP: climbs a vertical stack of ledges, rides the cable car up, jumps into the top exit", async () => {
    const { r, seen } = await play('bot-up', { god: true });
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(seen.rides.has('cable-car')).toBe(true);
    expect(r.ticks).toBeLessThan(3000);
  });

  it('DOWN: drops through the ledges, walks off a solid shelf, reaches the bottom door', async () => {
    const { r } = await play('bot-down');
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(r.deaths).toBe(0);
    expect(r.ticks).toBeLessThan(1500);
  });

  it('RIDES: boards a cable car across a pit, waits for a drifting float, hops over deep water', async () => {
    const { r, seen } = await play('bot-rides');
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(r.deaths).toBe(0);
    expect(seen.rides.has('cable-car')).toBe(true);
    expect(seen.rides.has('duck-float')).toBe(true);
  });

  it('is deterministic per seed in every mode', async () => {
    for (const id of ['bot-flight', 'bot-swan']) {
      const a = await play(id, { seed: 3 });
      const b = await play(id, { seed: 3 });
      expect(b.r.ticks).toBe(a.r.ticks);
      expect(b.r.kills).toBe(a.r.kills);
      expect(b.r.score).toEqual(a.r.score);
    }
  });
});
