import { beforeAll, describe, expect, it } from 'vitest';
import { PAL } from '../../../src/engine/palette';
import { getFpsFloor } from '../../../src/game/fps/registry';
import type { FpsFloorDef } from '../../../src/game/fps/types';
import { validateFloor } from '../../../src/game/fps/validate';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
  await import('../../../src/game/content/fps/floors');
});

function def(rows: string[], extra: Partial<FpsFloorDef> = {}): FpsFloorDef {
  return { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 1, rows, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor', ...extra };
}

/** A small valid floor: start room, gold key, gold door, the elevator, one secret with the golden record. */
const GOOD = [
  'AAAAAAAAAA',
  'A^..A...XA',
  'A.k.!....A',
  'A...A...cA',
  'AA*AAAAAAA',
  'A...A....A',
  'A9..A....A',
  'AAAAAAAAAA',
];

describe('floor validators (§5.3)', () => {
  it('floors 0, 1 and 2 pass every rule on every difficulty', () => {
    for (const id of ['fps-0', 'fps-1', 'fps-2']) {
      const r = validateFloor(getFpsFloor(id)!);
      expect(r.errors, id).toEqual([]);
      expect(r.warnings, id).toEqual([]);
    }
  });

  it('the ammo budgets match the spec numbers (rules 8 and 11)', () => {
    const f1 = validateFloor(getFpsFloor('fps-1')!).budget;
    expect(f1.normal).toMatchObject({ enemies: 34, hp: 1206, rounds: 150 });
    expect(f1.easy?.enemies).toBe(22);
    expect(f1.hard?.enemies).toBe(46);
    const f2 = validateFloor(getFpsFloor('fps-2')!).budget;
    // + the lift clip (all) and the arena cover clips (2 on EASY / NORMAL, 1 on HARD; lead 2026-10-16).
    expect(f2.normal).toMatchObject({ enemies: 5, hp: 2001, rounds: 190, arenaRounds: 191, arenaNeed: 144 });
    expect(f2.easy).toMatchObject({ arenaRounds: 187, arenaNeed: 110 });
    expect(f2.hard).toMatchObject({ arenaRounds: 187, arenaNeed: 178 });
  });

  it('a small valid floor passes', () => {
    expect(validateFloor(def(GOOD)).errors).toEqual([]);
  });

  it('rule 2: an open border fails', () => {
    const rows = [...GOOD];
    rows[3] = '....A...cA';
    expect(validateFloor(def(rows)).errors.some((e) => e.startsWith('rule 2'))).toBe(true);
  });

  it('rule 3: two starts fail', () => {
    const rows = [...GOOD];
    rows[3] = 'A..>A...cA';
    expect(validateFloor(def(rows)).errors.some((e) => e.startsWith('rule 3'))).toBe(true);
  });

  it('rule 4: a door without walls on its sides fails', () => {
    const rows = [...GOOD];
    rows[1] = 'A^..|...XA';
    rows[2] = 'A.k......A';
    expect(validateFloor(def(rows)).errors.some((e) => e.startsWith('rule 4'))).toBe(true);
  });

  it('rule 5: a key behind its own door fails', () => {
    const rows = [...GOOD];
    rows[2] = 'A...!.k..A';
    expect(validateFloor(def(rows)).errors.some((e) => e.startsWith('rule 5'))).toBe(true);
  });

  it('rule 6: a push wall that cannot move fails', () => {
    const rows = [...GOOD];
    rows[5] = 'AAAAA....A';
    const r = validateFloor(def(rows));
    expect(r.errors.some((e) => e.startsWith('rule 6'))).toBe(true);
  });

  it('rule 7: the golden record outside a secret and a wrong secret count fail', () => {
    const rows = [...GOOD];
    rows[3] = 'A..9A...cA';
    rows[6] = 'A...A....A';
    const r = validateFloor(def(rows, { secrets: 2 }));
    expect(r.errors.some((e) => e.includes('not inside a secret'))).toBe(true);
    expect(r.errors.some((e) => e.includes('push walls, the def says 2'))).toBe(true);
  });

  it('rule 8: too little ammo fails on NORMAL', () => {
    const rows = [...GOOD];
    rows[3] = 'A...A..ssA';
    rows[1] = 'A^..A.ssXA';
    const r = validateFloor(def(rows));
    expect(r.errors.some((e) => e.startsWith('rule 8'))).toBe(true);
  });

  it('rule 9: an enemy that sees the start fails', () => {
    const rows = [...GOOD];
    rows[3] = 'A..gA...cA';
    expect(validateFloor(def(rows)).errors.some((e) => e.startsWith('rule 9'))).toBe(true);
  });

  it('rules 10 and 11: a boss floor needs its spawns behind doors and enough arena ammo', () => {
    const rows = [
      'AAAAAAAAAAAA',
      'A..........A',
      'A....@.....A',
      'A..........A',
      'AAAAA-AAAAAA',
      'A9*.....^..A',
      'AAAAAAAAAAAA',
    ];
    const r = validateFloor(def(rows, { boss: true, things: [{ at: [3, 1], spawn: 'ss' }] }));
    expect(r.errors.some((e) => e.startsWith('rule 10'))).toBe(true);
    // No clips in this arena: 99 + 2 wreck clips + 1 drop is short of the need.
    expect(r.errors.some((e) => e.startsWith('rule 11'))).toBe(true);
  });
});
