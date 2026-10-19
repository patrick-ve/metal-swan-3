/**
 * Art sprite sets: every registered sprite generates without errors, with the frame counts and
 * points of the sprite contract (docs/ARCHITECTURE.md §6.1), sane sizes, palette-only colours.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import type { Frame } from '../../src/engine/render';
import { getFrames, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import { stackFrames } from '../../src/game/art/humanoid';

const ART_PREFIXES = ['char/recruit/', 'enemy/rifleman/', 'item/', 'weapon/', 'ui/', 'fx/', 'machine/', 'demo/terrain', 'demo/bg'];

beforeAll(async () => {
  // The rigs' sample sheets are registered by tools/sprites.ts only (the game skips them).
  (await import('../../src/game/art/machines')).defineMachineDemos();
  (await import('../../src/game/art/demo-art')).defineArtDemos();
  await import('../../src/game/content/characters/art');
  await import('../../src/game/content/infantry/art');
  await import('../../src/game/content/items/art');
  await import('../../src/game/content/weapons/art');
  await import('../../src/game/content/fx/art');
  await import('../../src/game/content/ui/art');
});

function frames(id: string): readonly Frame[] {
  expect(listSprites(id), `${id} is registered`).toContain(id);
  return getFrames(id);
}

/** Opaque bounds of a frame relative to its anchor. */
function bounds(f: Frame): { top: number; bottom: number; left: number; right: number } {
  const b = f.buf.trimBounds();
  if (!b) return { top: 0, bottom: 0, left: 0, right: 0 };
  return { top: b.y - f.oy, bottom: b.y + b.h - f.oy, left: b.x - f.ox, right: b.x + b.w - f.ox };
}

function expectPoint(f: Frame, name: string, id: string, i: number): void {
  const p = f.pts?.[name];
  expect(p, `${id}[${i}] has point '${name}'`).toBeDefined();
  if (p) {
    expect(Number.isInteger(p[0]) && Number.isInteger(p[1]), `${id}[${i}].${name} is integer`).toBe(true);
    expect(Math.abs(p[0]) <= 64 && Math.abs(p[1]) <= 64, `${id}[${i}].${name} near the anchor`).toBe(true);
  }
}

function contract(id: string, min: number, exact = false, pts: readonly string[] = []): void {
  const fs = frames(id);
  if (exact) expect(fs.length, id).toBe(min);
  else expect(fs.length, id).toBeGreaterThanOrEqual(min);
  fs.forEach((f, i) => {
    expect(f.buf.countOpaque(), `${id}[${i}] has pixels`).toBeGreaterThan(0);
    for (const p of pts) expectPoint(f, p, id, i);
  });
}

describe('player sprite contract (char/recruit)', () => {
  const C = 'char/recruit/';
  it('legs frames with hip points', () => {
    contract(C + 'legs-idle', 4, false, ['hip']);
    contract(C + 'legs-run', 12, true, ['hip']);
    contract(C + 'legs-jump', 4, false, ['hip']);
    contract(C + 'legs-fall', 2, false, ['hip']);
    contract(C + 'legs-land', 3, false, ['hip']);
    contract(C + 'legs-crouch', 1, false, ['hip']);
    contract(C + 'legs-crouch-walk', 6, true, ['hip']);
    // The hip bobs during the run.
    const hips = new Set(getFrames(C + 'legs-run').map((f) => f.pts?.hip?.[1]));
    expect(hips.size).toBeGreaterThan(1);
  });

  it('torsos for both weapon poses with muzzle and hand points', () => {
    for (const w of ['pistol', 'heavy']) {
      const t = `${C}torso-${w}-`;
      contract(t + 'idle', 2, false, ['muzzle']);
      contract(t + 'shoot', 2, false, ['muzzle']);
      contract(t + 'up', 1, false, ['muzzle']);
      contract(t + 'shoot-up', 2, false, ['muzzle']);
      contract(t + 'down', 1, false, ['muzzle']);
      contract(t + 'shoot-down', 2, false, ['muzzle']);
      contract(t + 'throw', 4, false, ['hand']);
      contract(t + 'knife', 4);
      // Torso frames are anchored at the hip: the anchor sits at the bottom of the torso.
      for (const f of getFrames(t + 'idle')) {
        const b = bounds(f);
        expect(b.bottom).toBeGreaterThanOrEqual(1);
        expect(b.bottom).toBeLessThanOrEqual(6);
        expect(b.top).toBeLessThan(-18);
      }
    }
    // Muzzles point the right way: forward, up, down.
    const fwd = getFrames(C + 'torso-pistol-idle')[0].pts?.muzzle ?? [0, 0];
    const up = getFrames(C + 'torso-pistol-up')[0].pts?.muzzle ?? [0, 0];
    const down = getFrames(C + 'torso-heavy-down')[0].pts?.muzzle ?? [0, 0];
    expect(fwd[0]).toBeGreaterThan(8);
    // The pistol is raised in both hands in front of the face: the muzzle is above the eyes.
    expect(up[1]).toBeLessThan(-18);
    expect(down[1]).toBeGreaterThan(4);
  });

  it('full-body animations and the portrait', () => {
    contract(C + 'die', 6);
    contract(C + 'die-burn', 4);
    contract(C + 'victory', 2);
    contract(C + 'spawn', 3);
    contract(C + 'bored', 4);
    contract(C + 'mount', 2);
    const p = frames(C + 'portrait');
    expect(p.length).toBe(1);
    expect(p[0].buf.w).toBeGreaterThanOrEqual(28);
    expect(p[0].buf.w).toBeLessThanOrEqual(36);
    expect(p[0].buf.h).toBeGreaterThanOrEqual(28);
    expect(p[0].buf.h).toBeLessThanOrEqual(36);
  });

  it('standing figure is 34–38 px tall and crouching 24–27 px (legs + torso stacked)', () => {
    const stand = stackFrames(getFrames(C + 'legs-idle')[0], getFrames(C + 'torso-pistol-idle')[0]);
    const sb = bounds(stand);
    expect(sb.bottom).toBe(0); // feet on the ground line
    expect(-sb.top).toBeGreaterThanOrEqual(34);
    expect(-sb.top).toBeLessThanOrEqual(38);
    const crouch = stackFrames(getFrames(C + 'legs-crouch')[0], getFrames(C + 'torso-pistol-idle')[0]);
    const cb = bounds(crouch);
    expect(-cb.top).toBeGreaterThanOrEqual(24);
    expect(-cb.top).toBeLessThanOrEqual(27);
  });

  it('run and crouch-walk keep the feet on the ground line', () => {
    for (const id of [C + 'legs-run', C + 'legs-crouch-walk', C + 'legs-idle', C + 'legs-crouch']) {
      for (const f of getFrames(id)) expect(bounds(f).bottom, id).toBe(0);
    }
  });

  it('the UHD frames (2× and 4×, the HD body) keep the contract: frame counts, logical size, anchor, points', () => {
    const logical = (f: Frame): string => {
      const d = f.density ?? 1;
      return `${f.buf.w / d}x${f.buf.h / d}@${f.ox},${f.oy}|${JSON.stringify(f.pts ?? {})}`;
    };
    for (const id of listSprites(C)) {
      const lo = getFrames(id, 1);
      for (const d of id.endsWith('/portrait') ? [2] : [2, 4]) {
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}x`).toBe(lo.length);
        hi.forEach((f, i) => {
          expect(f.density, `${id}@${d}x[${i}]`).toBe(d);
          expect(logical(f), `${id}@${d}x[${i}]`).toBe(logical(lo[i]));
        });
      }
    }
    // Stacked at 4×, the standing figure keeps the 1× height and its feet on the ground line.
    const stand = stackFrames(getFrames(C + 'legs-idle', 4)[0], getFrames(C + 'torso-pistol-idle', 4)[0]);
    const lo = stackFrames(getFrames(C + 'legs-idle')[0], getFrames(C + 'torso-pistol-idle')[0]);
    expect([stand.buf.w / 4, stand.buf.h / 4, stand.ox, stand.oy]).toEqual([lo.buf.w, lo.buf.h, lo.ox, lo.oy]);
    expect(spriteErrors().filter((e) => e.id.startsWith(C))).toEqual([]);
  }, 60_000);
});

describe('Swan rider strips (char/<id>/ride-*, look.md §6.4)', () => {
  const RIDERS = ['recruit', 'vincent', 'thom', 'dirk', 'bob', 'patrick', 'grace', 'mittens', 'pip', 'gramps'];
  const STRIPS: ReadonlyArray<[string, number, number]> = [
    // name, frames, ticks per frame
    ['sit', 2, 20],
    ['lean', 2, 6],
    ['up', 1, 30],
    ['hunch', 1, 30],
    ['hold', 2, 4],
    ['brace', 1, 30],
    ['duck', 1, 30],
    ['ears', 2, 6],
    ['cheer', 2, 8],
  ];

  it('nine strips, 14 frames per rider, points head + hand and no muzzle', () => {
    for (const c of RIDERS) {
      let total = 0;
      for (const [name, n, tpf] of STRIPS) {
        const id = `char/${c}/ride-${name}`;
        contract(id, n, true, ['head', 'hand']);
        for (const f of getFrames(id)) expect(f.pts?.muzzle, `${id} has no muzzle`).toBeUndefined();
        expect(spriteAnim(id).ticksPerFrame, id).toBe(tpf);
        expect(spriteAnim(id).loop, id).toBe(true);
        total += n;
      }
      expect(total).toBe(14);
      // No Helium Head rider variants and no mount-duck frame.
      expect(listSprites(`char/${c}/helium-ride`)).toEqual([]);
      expect(listSprites(`char/${c}/mount-duck`)).toEqual([]);
    }
  });

  it('hip anchor: nothing hangs far below the seat; the near hand lands on its grip', () => {
    for (const c of RIDERS) {
      for (const [name] of STRIPS) {
        const id = `char/${c}/ride-${name}`;
        for (const [i, f] of getFrames(id).entries()) {
          const b = bounds(f);
          // Upper body only: the waist (and a satchel) ends a few px under the hip, where the Swan's near
          // wing (hip + 0..10) hides it; the duck lies flat, belly down.
          expect(b.bottom, `${id}[${i}] bottom`).toBeLessThanOrEqual(name === 'duck' ? 10 : 8);
          const hand = f.pts?.hand ?? [0, 0];
          if (name === 'ears' || name === 'cheer') {
            // Hands off the grips: up at the ears / the near fist raised above the shoulder.
            expect(hand[1], `${id}[${i}] hand raised`).toBeLessThan(-10);
          } else {
            const g = name === 'duck' ? [12, -3] : [9, -5];
            expect(Math.abs(hand[0] - g[0]) <= 1 && Math.abs(hand[1] - g[1]) <= 1, `${id}[${i}] hand ${hand} on grip ${g}`).toBe(true);
          }
        }
      }
    }
  });

  it('head tops match the measured rider heights (look.md §6.2)', () => {
    const top = (id: string, i = 0): number => -bounds(getFrames(id)[i]).top;
    // [sit, hunch, duck] heights above the hip per hero. Mittens' bobble stands 2 px over the
    // measured 9 in the duck (the head tilts forward, the bobble stays on top): 9–11.
    const H: Record<string, [number, number, number]> = { gramps: [20, 11, 7], grace: [22, 13, 8], pip: [22, 13, 8], mittens: [24, 15, 9] };
    // The squad (docs/design/squad.md §1) stays inside the same 20–24 band (Bob's quiff = Mittens' bobble).
    Object.assign(H, { vincent: [21, 12, 7], thom: [22, 13, 8], dirk: [23, 15, 9], bob: [24, 15, 8], patrick: [22, 13, 8] });
    for (const [c, [sit, hunch, duck]] of Object.entries(H)) {
      expect(top(`char/${c}/ride-sit`), c).toBe(sit);
      expect(top(`char/${c}/ride-hunch`), c).toBe(hunch);
      expect(top(`char/${c}/ride-duck`), c).toBeGreaterThanOrEqual(duck);
      expect(top(`char/${c}/ride-duck`), c).toBeLessThanOrEqual(duck + 2);
      expect(top(`char/${c}/ride-hold`)).toBeGreaterThanOrEqual(sit - 5);
      expect(top(`char/${c}/ride-hold`)).toBeLessThan(sit);
    }
  });
});

describe('enemy soldier contract (enemy/rifleman)', () => {
  const E = 'enemy/rifleman/';
  it('has every animation with the right points', () => {
    contract(E + 'idle', 2);
    contract(E + 'gag', 4);
    contract(E + 'alert', 2);
    contract(E + 'walk', 6);
    contract(E + 'run', 8);
    contract(E + 'crouch', 1);
    contract(E + 'shoot', 2, false, ['muzzle']);
    contract(E + 'crouch-shoot', 2, false, ['muzzle']);
    contract(E + 'throw', 4, false, ['hand']);
    contract(E + 'panic', 4);
    contract(E + 'die', 5);
    contract(E + 'die-blast', 4);
    contract(E + 'die-burn', 4);
    contract(E + 'die-knife', 4);
  });

  it('stands about 34–44 px tall including the plumed hat', () => {
    const b = bounds(getFrames(E + 'idle')[0]);
    expect(b.bottom).toBe(0);
    expect(-b.top).toBeGreaterThanOrEqual(34);
    expect(-b.top).toBeLessThanOrEqual(44);
  });
});

describe('items', () => {
  it('hostage contract', () => {
    contract('item/hostage/tied', 2);
    contract('item/hostage/freed', 3);
    contract('item/hostage/walk', 6);
    contract('item/hostage/give', 4, false, ['hand']);
    contract('item/hostage/run', 6);
  });

  it('crates and pickups', () => {
    contract('item/crate', 1);
    contract('item/crate-hit', 1);
    contract('item/crate-break', 3);
    for (const l of ['m', 'r', 's', 'f', 'l', 'h', 'b']) contract(`item/pickup-${l}`, 2);
    for (const id of ['machine-gun', 'rocket', 'shotgun', 'flamethrower', 'laser', 'homing', 'bouncer']) contract(`item/pickup-${id}`, 2);
    contract('item/pickup-bombs', 2);
    contract('item/pickup-food', 2);
    contract('item/pickup-gem', 2);
    // Pickups rest on the ground (feet anchor) and are small.
    for (const f of getFrames('item/pickup-m')) {
      expect(f.buf.w).toBeLessThanOrEqual(20);
      expect(f.oy).toBeGreaterThanOrEqual(f.buf.h);
    }
  });
});

describe('weapons and HUD icons', () => {
  it('direction strips have 16 frames (frame 0 points right, clockwise)', () => {
    for (const id of ['weapon/bullet', 'weapon/bullet-pistol', 'weapon/mg-bullet', 'weapon/bullet-mg', 'weapon/vulcan-bullet', 'weapon/shell', 'weapon/rocket']) {
      const fs = frames(id);
      expect(fs.length, id).toBe(16);
      // Frame 0 is wider than tall (points right), frame 4 taller than wide (points down).
      const r = fs[0].buf.trimBounds();
      const d = fs[4].buf.trimBounds();
      expect(r && d && r.w > r.h && d.h > d.w, id).toBe(true);
    }
  });

  it('other projectiles, flashes and icons', () => {
    contract('weapon/enemy-bullet', 2, true);
    contract('weapon/pellet', 1);
    contract('weapon/grenade', 4);
    contract('weapon/enemy-grenade', 4);
    contract('weapon/casing', 1);
    contract('weapon/smoke-trail', 3);
    contract('weapon/muzzle-pistol', 2);
    contract('weapon/muzzle-heavy', 2);
    for (const id of ['fx/muzzle', 'fx/muzzle-up', 'fx/muzzle-heavy', 'fx/muzzle-heavy-up']) contract(id, 2);
    for (const id of ['pistol', 'machine-gun', 'rocket', 'shotgun', 'flamethrower', 'laser', 'homing', 'bouncer']) contract(`ui/icon-${id}`, 1);
    contract('ui/icon-bomb', 1);
    contract('ui/icon-life', 1);
    contract('ui/icon-hostage', 1);
    contract('ui/icon-shell', 1);
  });

  it('muzzle flashes start at their anchor and extend away from it', () => {
    const f = getFrames('fx/muzzle')[0];
    const b = bounds(f);
    expect(b.left).toBeGreaterThanOrEqual(-2);
    expect(b.right).toBeGreaterThan(5);
    const u = getFrames('fx/muzzle-up')[0];
    const ub = bounds(u);
    expect(ub.bottom).toBeLessThanOrEqual(3);
    expect(ub.top).toBeLessThan(-5);
  });
});

describe('fx', () => {
  it('explosions grow, then smoke away (6–12 frames)', () => {
    for (const s of ['s', 'm', 'l', 'xl']) {
      const fs = frames(`fx/explosion-${s}`);
      expect(fs.length).toBeGreaterThanOrEqual(6);
      expect(fs.length).toBeLessThanOrEqual(12);
      // Centre anchored.
      for (const f of fs) expect(Math.abs(f.ox - f.buf.w / 2)).toBeLessThanOrEqual(1);
    }
    const sizes = ['s', 'm', 'l', 'xl'].map((s) => Math.max(...getFrames(`fx/explosion-${s}`).map((f) => f.buf.countOpaque())));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
  });

  it('small effects and debris', () => {
    contract('fx/smoke-puff', 4);
    contract('fx/soot-cloud', 4);
    contract('fx/spark', 4, true);
    contract('fx/impact', 3);
    contract('fx/hit-spark', 3, true);
    contract('fx/hit', 3, true);
    contract('fx/dust', 4, true);
    contract('fx/splash', 5, true);
    contract('fx/stun-stars', 4);
    for (const k of ['metal', 'wood', 'rock', 'dirt', 'glass', 'plant', 'snow', 'cloth']) contract(`fx/debris-${k}`, 4, true);
  });
});

describe('machines and demos', () => {
  it('demo machines', () => {
    contract('machine/demo-tank', 3, true);
    contract('machine/demo-heli', 4, true);
    contract('demo/terrain', 1);
    contract('demo/bg', 1);
  });
});

describe('all art sprites', () => {
  it('generate without errors, fit in 128 px and use palette colours only', () => {
    const ids = ART_PREFIXES.flatMap((p) => listSprites(p));
    expect(ids.length).toBeGreaterThan(120);
    for (const id of ids) {
      for (const f of getFrames(id)) {
        if (!id.startsWith('demo/')) {
          // Game sprites fit in 128 px; menu art (the title logo, screen panels) fits in the 384×216 view.
          const [mw, mh] = id.startsWith('ui/') ? [384, 216] : [128, 128];
          expect(f.buf.w, id).toBeLessThanOrEqual(mw);
          expect(f.buf.h, id).toBeLessThanOrEqual(mh);
        }
        const d = f.buf.data;
        let bad = 0;
        for (let i = 0; i < d.length; i++) if ((d[i] & 255) !== 0 && ((d[i] & 255) !== 255 || !inPalette(d[i]))) bad++;
        expect(bad, `${id}: non-palette pixels`).toBe(0);
      }
    }
    const errs = spriteErrors().filter((e) => ART_PREFIXES.some((p) => e.id.startsWith(p)));
    expect(errs).toEqual([]);
  });
});
