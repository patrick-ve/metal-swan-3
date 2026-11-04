/**
 * The scan car fight's tow truck, hook and wheel clamp at 40 px (docs/design/ams40.md wave 6, D5,
 * D7): the baked sets of the shared prefix boss/ams-scan (tools/art40/chars/ams-tow-truck,
 * ams-wheel-clamp) replace the old strips; the code picks every frame through the bake's named
 * constants; the art points ride on the frames (the boom tip, the wheels, the beacon lamps); the
 * gameplay numbers stay (the hook's height and swing, the hitboxes, the clamp's timing).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bakedSetIds } from '../../src/engine/baked';
import { getFrames, hasHiSprite } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { SET as TOW_SET, HOOK_TILTS, TOW_DAMAGED, TOW_LOAD_STEP, TOW_LOADS } from '../../src/game/content/art40/ams-tow-truck.gen';
import {
  SET as CLAMP_SET,
  CLAMP_DIP,
  CLAMP_FOOT_BITE,
  CLAMP_FOOT_POP,
  CLAMP_FOOT_SNAP,
  CLAMP_FOOT_STILL,
  CLAMP_HALF,
  CLAMP_LAND,
  CLAMP_LAUNCH,
  CLAMP_OPEN,
  CLAMP_SHUT,
  CLAMP_SNAP,
  CLAMP_SQUAT,
  CLAMP_SQUAT_B,
  CLAMP_WIDE,
} from '../../src/game/content/art40/ams-wheel-clamp.gen';
import { AmsTowTruck, AmsWheelClamp, CLAMPED } from '../../src/game/content/bosses/ams-scan/adds';
import { CLAMP, HOOK, ID, TRUCK, TRUCK_ART_DX, TRUCK_LO } from '../../src/game/content/bosses/ams-scan/geometry';
import type { Renderer } from '../../src/engine/render';
import { TestWorld } from './helpers';

beforeAll(async () => {
  await loadContent();
});

/** The sprite calls of one draw: id, frame, x, y, flipped. */
function calls(draw: (r: Renderer) => void): Array<[string, number, number, number, boolean]> {
  const out: Array<[string, number, number, number, boolean]> = [];
  const r = {
    sprite: (id: string, f: number, x: number, y: number, o?: { flipX?: boolean }) => out.push([id, f, x, y, o?.flipX === true]),
    line: () => undefined,
  } as unknown as Renderer;
  draw(r);
  return out;
}

describe('tow truck and wheel clamp at 40 px: the art', () => {
  it('the baked ids replace the old strips: 1× frames at every tier, the counts of the bake', () => {
    const ids = [...bakedSetIds(TOW_SET), ...bakedSetIds(CLAMP_SET)].sort();
    expect(ids).toEqual(['boss/ams-scan/clamp', 'boss/ams-scan/clamp-foot', 'boss/ams-scan/hook', 'boss/ams-scan/tow']);
    expect(getFrames(ID.truck, 1)).toHaveLength(2 * (TOW_LOADS + 1));
    expect(getFrames(ID.hook, 1)).toHaveLength(1 + 2 * HOOK_TILTS);
    expect(getFrames(ID.clamp, 1)).toHaveLength(10);
    expect(getFrames(ID.clampFoot, 1)).toHaveLength(5);
    for (const id of ids) {
      for (const d of [2, 4] as const) expect(hasHiSprite(id, d), `${id} has no dense art at ${d}×`).toBe(false);
      expect(getFrames(id, 4).map((f) => [f.buf.w, f.buf.h])).toEqual(getFrames(id, 1).map((f) => [f.buf.w, f.buf.h]));
    }
  });

  it('the truck is 1.2× longer (D5) and its art points sit on every frame', () => {
    // The old body ran from the tail at -48 to the bumper at 47 (95 px; TRUCK_LO); 1.2× is 114.
    expect(TRUCK_LO.deck.x).toBe(-48);
    for (const f of getFrames(ID.truck, 1)) {
      expect(f.buf.w).toBeGreaterThanOrEqual(114);
      // Drawn TRUCK_ART_DX forward: the art tip lands on the logic tip (the old [-52, -50], D7).
      expect(f.pts?.tip).toEqual([TRUCK.tip[0] - TRUCK_ART_DX, TRUCK.tip[1]]);
      expect(f.pts?.wheel0).toEqual([TRUCK.wheelX[0] - TRUCK_ART_DX, TRUCK.wheelY]);
      expect(f.pts?.lamp1).toEqual([TRUCK.lamps[1][0] - TRUCK_ART_DX, TRUCK.lamps[1][1]]);
      // Standing on the floor: no pixel below the anchor.
      expect(f.buf.h - f.oy).toBeLessThanOrEqual(0);
    }
  });

  it('gameplay numbers stay (D7): the hook swings 50 px up, the hitboxes are the old ones', () => {
    expect(TRUCK.tip).toEqual([-52, -50]);
    expect(TRUCK.hook).toEqual({ len: 18, lower: 30, amp: 0.6, grow: 40, period: 72 });
    expect(TRUCK.box).toEqual({ x: -48, y: -34, w: 95, h: 33 });
    expect(HOOK.box).toEqual({ x: -4, y: 2, w: 8, h: 8 });
    expect(CLAMP.box).toEqual({ x: -8, y: -18, w: 16, h: 18 });
    expect(CLAMP.jaws).toEqual({ x: -6, y: -6, w: 12, h: 6 });
    expect([CLAMP.wait, CLAMP.tell, CLAMP.ticks, CLAMP.grace, CLAMP.hits]).toEqual([40, 22, 45, 40, 2]);
  });
});

describe('tow truck and wheel clamp at 40 px: the frame picks', () => {
  it('the truck: damaged at half HP, one clamp fewer on the bed per toss; the wheels and lamps at the art points', () => {
    const tw = new TestWorld({ width: 600, playerX: 60, god: true, seed: 3 });
    const t = tw.spawn('ams-tow-truck', 640, { from: 'right', arenaLeft: 0, arenaW: 384 }) as AmsTowTruck;
    expect(t.truckFrame()).toBe(0);
    tw.until(() => t.state === 'work', 900);
    // The stop: the tip TRUCK.stopIn inside the view whatever the truck's length.
    expect(Math.round(t.tipX())).toBe(384 - TRUCK.stopIn);
    tw.until(() => t.workT >= TRUCK.drops[1] + 1, 200);
    expect(t.truckFrame()).toBe(TOW_LOAD_STEP * TOW_LOADS);
    t.hp = Math.floor(t.maxHp / 2);
    expect(t.truckFrame()).toBe(TOW_DAMAGED + TOW_LOAD_STEP * TOW_LOADS);
    const drawn = calls((r) => t.draw(r));
    const wheels = drawn.filter(([id]) => id === ID.wheel).map(([, , x, y]) => [x - Math.round(t.x), y - Math.round(t.y)]);
    expect(wheels).toEqual(TRUCK.wheelX.map((wx) => [t.facing < 0 ? -wx : wx, TRUCK.wheelY]));
    // The body is drawn TRUCK_ART_DX forward, so its art tip sits on the logic tip.
    const body = drawn.filter(([id]) => id === ID.truck).map(([, , x]) => x - Math.round(t.x));
    expect(body).toEqual([t.facing < 0 ? -TRUCK_ART_DX : TRUCK_ART_DX]);
  });

  it('the hook leans with its cable (mirrored with the truck)', () => {
    const tw = new TestWorld({ width: 600, playerX: 60, god: true, seed: 3 });
    const t = tw.spawn('ams-tow-truck', 640, { from: 'right', arenaLeft: 0, arenaW: 384 }) as AmsTowTruck;
    const at = (a: number, flip: boolean): number => {
      t.hookAng = a;
      return t.hookFrame(flip);
    };
    expect(at(0, false)).toBe(0);
    expect(at(0.3, false)).toBe(1);
    expect(at(0.6, false)).toBe(2);
    expect(at(-0.3, false)).toBe(HOOK_TILTS + 1);
    expect(at(-0.6, false)).toBe(HOOK_TILTS + 2);
    expect(at(0.6, true)).toBe(HOOK_TILTS + 2);
  });

  it('the clamp: toss shut, land squash, open with a snap, the tell dips and trembles, the hop stretches and flings wide', () => {
    const tw = new TestWorld({ width: 600, playerX: 60, god: true, seed: 3 });
    const c = tw.spawn('ams-wheel-clamp', 300, { vx: 1, vy: -2 }) as AmsWheelClamp;
    const seen = new Set<number>();
    const seq: number[] = [];
    for (let i = 0; i < 400 && !c.removed; i++) {
      const f = c.frame();
      seen.add(f);
      seq.push(f);
      tw.run(1);
    }
    expect(seq[0]).toBe(CLAMP_SHUT);
    for (const f of [CLAMP_SHUT, CLAMP_LAND, CLAMP_OPEN, CLAMP_DIP, CLAMP_SQUAT, CLAMP_SQUAT_B, CLAMP_LAUNCH, CLAMP_WIDE]) expect(seen.has(f), `frame ${f}`).toBe(true);
    // The snap of an armed clamp that waits (no player in reach).
    const lone = new TestWorld({ width: 900, playerX: 860, god: true, seed: 3 });
    const k = lone.spawn('ams-wheel-clamp', 100, {}) as AmsWheelClamp;
    const armed = new Set<number>();
    for (let i = 0; i < 80; i++) {
      if (k.state === 'armed') armed.add(k.frame());
      lone.run(1);
    }
    expect([...armed].sort()).toEqual([CLAMP_LAND, CLAMP_OPEN, CLAMP_HALF, CLAMP_SNAP].sort());
  });

  it('the clamp on the boot: bite, snap, still, rattle, pop', () => {
    const tw = new TestWorld({ width: 600, playerX: 100, god: true, seed: 2 });
    const p = tw.player!;
    const pick = (left: number): number => calls((r) => CLAMPED.onDraw?.(p, r, left))[0][1];
    expect(pick(CLAMP.ticks)).toBe(CLAMP_FOOT_BITE);
    expect(pick(CLAMP.ticks - 4)).toBe(CLAMP_FOOT_SNAP);
    expect(pick(30)).toBe(CLAMP_FOOT_STILL);
    expect(pick(2)).toBe(CLAMP_FOOT_POP);
  });
});
