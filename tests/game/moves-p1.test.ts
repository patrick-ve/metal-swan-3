/**
 * Player group 1 wiring (animation wave, plan Phase 1): the running-jump flip, the Swan
 * mount-hop, the intro parachute drop, the pick-up flash, die-drown on the water surface and
 * die-flat for a crush. Stub sprites define every new id, so no test passes behind a hasSprite guard.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { VirtualPad, buttonMask } from '../../src/engine/input';
import { PixelBuffer } from '../../src/engine/pixel';
import type { DrawOpts, Renderer } from '../../src/engine/render';
import { defineSprite, type Frame } from '../../src/engine/sprites';
import { terrain } from '../../src/engine/terrain';
import { MissionRunner, type MissionDef, type SectionDef } from '../../src/game/mission/index';
import { onceFrame, stripTicks, type Player } from '../../src/game/player/player';
import { INTRO_DROP_ID } from '../../src/game/player/intro-drop';
import { GameSession } from '../../src/game/session';
import { TUNING } from '../../src/game/tuning';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, Rig } from './helpers';

const ART = 'char/recruit';
const buf = (): PixelBuffer => new PixelBuffer(4, 4);
const strip = (n: number) => () => Array.from({ length: n }, buf);

beforeAll(() => {
  defineSprite(`${ART}/flip`, strip(14), { ticksPerFrame: 2, loop: false });
  defineSprite(
    `${ART}/mount-hop`,
    () =>
      Array.from({ length: 5 }, (_, i): Frame => {
        const f = buf() as unknown as Frame;
        return i === 4 ? ({ buf: buf(), ox: 2, oy: 4, pts: { hip: [1, -17] } } as unknown as Frame) : f;
      }),
    { durations: [3, 3, 3, 3, 4], loop: false },
  );
  defineSprite(`${ART}/ride-sit`, strip(2), { ticksPerFrame: 20 });
  defineSprite(`${ART}/legs-dangle`, strip(6), { ticksPerFrame: 6 });
  defineSprite('fx/chute', strip(6), { ticksPerFrame: 6 });
  defineSprite('fx/chute-collapse', strip(8), { ticksPerFrame: 3, loop: false });
  defineSprite(`${ART}/die-drown`, strip(12), { ticksPerFrame: 5, loop: false });
  defineSprite(`${ART}/die-flat`, strip(7), { ticksPerFrame: 4, loop: false });
});

interface Call {
  id: string;
  frame: number;
  x: number;
  y: number;
  flash: boolean;
  tint: boolean;
}
function spriteLog(): { r: Renderer; calls: Call[] } {
  const calls: Call[] = [];
  const r = {
    sprite: (id: string, frame: number, x: number, y: number, o?: DrawOpts) =>
      calls.push({ id, frame, x, y, flash: o?.flash === true, tint: o?.tint !== undefined && (o.alpha ?? 0) > 0 }),
    line: () => {},
  } as unknown as Renderer;
  return { r, calls };
}
const drawIds = (p: Player): string[] => {
  const { r, calls } = spriteLog();
  p.draw(r);
  return calls.map((c) => c.id);
};

describe('flip (running jump somersault)', () => {
  it('a running jump draws the full-body flip; a standing jump does not', () => {
    const rig = new Rig();
    rig.p.invulnTicks = 0;
    rig.hold(['right']).run(20).hold(['right', 'jump']).run(1).hold(['right']).run(2);
    expect(drawIds(rig.p)).toEqual([`${ART}/flip`]);
    const still = new Rig();
    still.p.invulnTicks = 0;
    still.hold(['jump']).run(1).release().run(2);
    expect(drawIds(still.p)).not.toContain(`${ART}/flip`);
  });

  it('shooting mid-flip draws the split body on the same tick; the muzzle does not change', () => {
    const rig = new Rig();
    rig.p.invulnTicks = 0;
    rig.hold(['right']).run(20).hold(['right', 'jump']).run(1).hold(['right']).run(4);
    expect(drawIds(rig.p)).toEqual([`${ART}/flip`]);
    const m1 = rig.p.muzzleWorld([0, 0]);
    (rig.p as unknown as { flipT: number }).flipT = 0;
    const m2 = rig.p.muzzleWorld([0, 0]);
    expect(m1).toEqual(m2);
    (rig.p as unknown as { flipT: number }).flipT = 10;
    rig.hold(['right', 'fire']).run(1);
    const ids = drawIds(rig.p);
    expect(ids).not.toContain(`${ART}/flip`);
    expect(ids.some((id) => id.includes('/legs-'))).toBe(true);
    expect(ids.some((id) => id.includes('/torso-'))).toBe(true);
  });

  it('landing ends the flip', () => {
    const rig = new Rig();
    rig.p.invulnTicks = 0;
    rig.hold(['right']).run(20).hold(['right', 'jump']).run(1).hold(['right']);
    rig.until(() => rig.p.body.onGround, 120);
    expect(drawIds(rig.p)).not.toContain(`${ART}/flip`);
  });
});

class SwanStub extends Vehicle {
  ready = false;
  override canMount(): boolean {
    return this.ready && !this.driver;
  }
}
function swanRig(): { rig: Rig; v: SwanStub } {
  const rig = new Rig();
  const v = new SwanStub(rig.world, 200, FLOOR, {}, { art: 'vehicle/test-seat', seat: { x: -10, y: -34, w: 20, h: 14 } });
  v.addTag('swan');
  rig.world.add(v);
  rig.world.flush();
  rig.p.invulnTicks = 0;
  return { rig, v };
}

describe('mount-hop (Swan only, only through checkMount)', () => {
  it('boarding through checkMount hops from the boarding spot toward the CURRENT seat, then rides', () => {
    const { rig, v } = swanRig();
    const x0 = rig.p.x;
    const y0 = rig.p.y;
    v.ready = true;
    rig.run(1);
    expect(rig.p.state).toBe('mounted');
    rig.p.invulnTicks = 0;
    const { r, calls } = spriteLog();
    rig.p.drawRide(r, 300, 120, false, 'sit');
    expect(calls.at(-1)!.id).toBe(`${ART}/mount-hop`);
    const total = stripTicks(`${ART}/mount-hop`);
    expect(total).toBe(16);
    const xs: number[] = [];
    for (let t = 0; t < 40; t++) {
      calls.length = 0;
      rig.p.drawRide(r, 300, 120, false, 'sit');
      if (calls[0].id !== `${ART}/mount-hop`) break;
      xs.push(calls[0].x);
      rig.world.tick++;
    }
    // One pass of the strip (the mount tick itself already counts), eased toward the seat.
    expect(xs.length).toBeGreaterThanOrEqual(total - 1);
    expect(xs.length).toBeLessThanOrEqual(total);
    expect(Math.abs(xs[0] - x0)).toBeLessThan(5);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    expect(xs.at(-1)!).toBeGreaterThan(290);
    expect(y0).toBe(FLOOR);
    expect(calls.at(-1)!.id).toBe(`${ART}/ride-sit`);
  });

  it('a start / carried vehicle (vehicle.mount called directly) never hops', () => {
    const { rig, v } = swanRig();
    v.mount(rig.p);
    const { r, calls } = spriteLog();
    rig.p.drawRide(r, 300, 120, false, 'sit');
    expect(calls.at(-1)!.id).toBe(`${ART}/ride-sit`);
  });

  it('a vehicle without the swan tag never hops', () => {
    const { rig, v } = swanRig();
    v.removeTag('swan');
    v.ready = true;
    rig.run(1);
    expect(rig.p.state).toBe('mounted');
    rig.p.invulnTicks = 0;
    const { r, calls } = spriteLog();
    rig.p.drawRide(r, 300, 120, false, 'sit');
    expect(calls.at(-1)!.id).toBe(`${ART}/ride-sit`);
  });
});

function section(id: string, extra: Partial<SectionDef> = {}): SectionDef {
  const t = terrain(900, 216);
  t.ground().at(0, FLOOR).flat(900);
  return {
    id,
    width: 900,
    height: 216,
    scroll: 'right',
    background: { sky: 0x203040ff, layers: [] },
    terrain: t.build(),
    terrainStyle: { ground: 'dirt', edge: 'grass' },
    playerStart: { x: 60, y: FLOOR },
    script: function* () {
      yield 100000;
    },
    ...extra,
  };
}
function mission(introDrop: boolean): MissionDef {
  return { id: `drop-${introDrop}`, name: 'DROP', music: 'test-song', start: 'a', introDrop, sections: { a: section('a'), b: section('b') } };
}
function runner(m: MissionDef, opts: { section?: string; bossRush?: boolean } = {}): { run: (n: number, mask?: number) => void; mr: MissionRunner } {
  const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  const mr = new MissionRunner({ session: new GameSession(), mission: m, pads, audio: new NullAudio(), seed: 3, ...opts });
  const run = (n: number, mask = 0): void => {
    for (let i = 0; i < n; i++) {
      pads[0].update(mask);
      pads[1].update(0);
      mr.update();
    }
  };
  return { run, mr };
}

describe('intro drop (MissionDef.introDrop)', () => {
  it('drops the player in from above the view onto playerStart within 90 ticks; horizontal input ignored', () => {
    const { run, mr } = runner(mission(true));
    mr.start();
    const p = mr.players[0];
    expect(p.dropping).toBe(true);
    expect(p.status.has(INTRO_DROP_ID)).toBe(true);
    expect(p.y).toBeLessThan(mr.world.camera.top);
    const x0 = p.x;
    let ticks = 0;
    while (p.dropping && ticks < 200) {
      run(1, buttonMask('right', 'jump', 'bomb', 'down'));
      ticks++;
      if (p.dropping) expect(p.legs.id).toBe(`${ART}/legs-dangle`);
    }
    expect(ticks).toBeLessThanOrEqual(90);
    expect(p.x).toBe(x0);
    expect(p.y).toBe(FLOOR);
    expect(p.body.onGround).toBe(true);
    expect(p.status.has(INTRO_DROP_ID)).toBe(false);
    expect(mr.session.slots[0].bombs).toBe(p.startBombs);
    // The chute collapses where he landed.
    const { r, calls } = spriteLog();
    p.draw(r);
    expect(calls.map((c) => c.id)).toContain('fx/chute-collapse');
  });

  it('draws the chute above the dangling player; the pistol fires during the drop', () => {
    const { run, mr } = runner(mission(true));
    mr.start();
    const p = mr.players[0];
    run(30);
    const { r, calls } = spriteLog();
    p.draw(r);
    expect(calls.map((c) => c.id)).toEqual(expect.arrayContaining([`${ART}/legs-dangle`, 'fx/chute']));
    const shots = p.slot.stats.shots;
    run(1, buttonMask('fire'));
    expect(p.slot.stats.shots).toBe(shots + 1);
  });

  it('no drop: a start section, a boss rush, a mission without introDrop, a later section', () => {
    for (const [m, o] of [
      [mission(true), { section: 'b' }],
      [mission(true), { bossRush: true }],
      [mission(false), {}],
    ] as const) {
      const { mr } = runner(m, o);
      mr.start();
      expect(mr.players[0].dropping).toBe(false);
      expect(mr.players[0].y).toBe(FLOOR);
    }
    const { mr } = runner(mission(true));
    mr.start();
    mr.loadSection('b');
    expect(mr.players[0].dropping).toBe(false);
  });

  it('killed mid-drop (time-out): the body still lands on the drop floor', () => {
    const { run, mr } = runner(mission(true));
    mr.start();
    const p = mr.players[0];
    run(5);
    p.kill('timeout' as never);
    run(TUNING.life.deathAnimTicks - 2);
    expect(p.y).toBe(FLOOR);
  });
});

describe('pick-up flash (draw-only)', () => {
  it('white on ages 0-1 and 4-5, then a fading white tint; 10 ticks in all', () => {
    const rig = new Rig();
    rig.p.invulnTicks = 0;
    rig.p.giveWeapon('pistol', undefined, false);
    const flash: boolean[] = [];
    const tint: boolean[] = [];
    for (let i = 0; i < TUNING.life.pickupFlashTicks + 2; i++) {
      const { r, calls } = spriteLog();
      rig.p.draw(r);
      flash.push(calls[0].flash);
      tint.push(calls.some((c) => c.tint));
      rig.run(1);
    }
    expect(flash).toEqual([true, true, false, false, true, true, false, false, false, false, false, false]);
    expect(tint.slice(6, 10)).toEqual([true, true, true, true]);
    expect(tint.slice(10)).toEqual([false, false]);
  });
});

describe('deaths', () => {
  it('drowning draws die-drown on the water surface (drownY) and waits deathAnimTicks', () => {
    const rig = new Rig({ build: (t) => t.hazard('water', 0, 100, 400, 100) });
    rig.p.invulnTicks = 0;
    rig.run(2);
    expect(rig.p.cause).toBe('drown');
    const { r, calls } = spriteLog();
    rig.p.draw(r);
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe(`${ART}/die-drown`);
    expect(calls[0].y).toBe(100);
    expect((rig.p as unknown as { deathTimer: number }).deathTimer).toBeGreaterThan(TUNING.life.deathAnimTicks - 3);
  });

  it('a crush plays die-flat; other causes keep die', () => {
    const rig = new Rig();
    rig.p.invulnTicks = 0;
    rig.p.kill('crush');
    expect(rig.p.full.id).toBe(`${ART}/die-flat`);
    const rig2 = new Rig();
    rig2.p.kill('impact');
    expect(rig2.p.full.id).toBe(`${ART}/die`);
  });

  it('onceFrame holds the last frame of a one-shot strip', () => {
    expect(onceFrame(`${ART}/mount-hop`, 0)).toBe(0);
    expect(onceFrame(`${ART}/mount-hop`, 12)).toBe(4);
    expect(onceFrame(`${ART}/mount-hop`, 99)).toBe(4);
  });
});
