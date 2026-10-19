/**
 * Player group 2 wiring (animation wave, plan Phase 2): stride-rate run with the run torso,
 * landing length, the draw-only crouch transition and crouch torso twins, the draw-only aim
 * steps, alternating knives, idle fidgets, the time-out yawn / sleep and the Helium fallback.
 * Stub sprites define every new id, so no test passes behind a hasSprite guard.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import type { DrawOpts, Renderer } from '../../src/engine/render';
import { defineSprite, type Frame } from '../../src/engine/sprites';
import { stripTicks, type Player } from '../../src/game/player/player';
import { TUNING } from '../../src/game/tuning';
import { Rig } from './helpers';

const ART = 'char/recruit';
const buf = (): PixelBuffer => new PixelBuffer(4, 4);
const strip = (n: number) => () => Array.from({ length: n }, buf);
/** A strip whose frames carry points (hip / muzzle / hand). */
const ptStrip = (pts: Record<string, [number, number]>[]) => () =>
  pts.map((p) => ({ buf: buf(), ox: 2, oy: 4, pts: p }) as unknown as Frame);

const HELIUM = { id: 'test-helium', ticks: 100000, art: 'helium' };

beforeAll(() => {
  defineSprite(`${ART}/legs-run`, ptStrip(Array.from({ length: 12 }, () => ({ hip: [0, -16] }))), { ticksPerFrame: 3 });
  defineSprite(`${ART}/legs-idle`, ptStrip(Array.from({ length: 4 }, () => ({ hip: [0, -16] }))), { ticksPerFrame: 16 });
  defineSprite(`${ART}/legs-land`, strip(3), { durations: [2, 3, 4], loop: false });
  defineSprite(`${ART}/legs-crouch`, ptStrip([{ hip: [0, -10] }]), { ticksPerFrame: 30 });
  defineSprite(`${ART}/legs-crouch-in`, ptStrip([{ hip: [0, -14] }, { hip: [0, -12] }, { hip: [0, -11] }]), { durations: [2, 2, 2], loop: false });
  defineSprite(`${ART}/legs-crouch-out`, ptStrip([{ hip: [0, -12] }, { hip: [0, -15] }]), { durations: [2, 2], loop: false });
  for (const w of ['pistol', 'heavy']) {
    defineSprite(`${ART}/torso-${w}-idle`, strip(4), { ticksPerFrame: 12 });
    defineSprite(`${ART}/torso-${w}-shoot`, ptStrip([{ muzzle: [15, -5] }, { muzzle: [14, -5] }]), { ticksPerFrame: 3, loop: false });
    defineSprite(`${ART}/torso-${w}-run`, strip(12), { ticksPerFrame: 3 });
    defineSprite(`${ART}/torso-${w}-crouch`, strip(4), { ticksPerFrame: 12 });
    defineSprite(`${ART}/torso-${w}-crouch-shoot`, ptStrip([{ muzzle: [30, 9] }, { muzzle: [30, 9] }]), { durations: [4, 8], loop: false });
    defineSprite(`${ART}/torso-${w}-crouch-knife`, strip(6), { durations: [2, 2, 2, 2, 3, 3], loop: false });
    defineSprite(`${ART}/torso-${w}-knife`, strip(6), { durations: [2, 2, 2, 2, 3, 3], loop: false });
    defineSprite(`${ART}/torso-${w}-knife-b`, strip(6), { durations: [2, 2, 2, 2, 3, 3], loop: false });
    defineSprite(`${ART}/torso-${w}-up`, strip(1), { ticksPerFrame: 30 });
    defineSprite(`${ART}/torso-${w}-diag-up`, strip(1), { ticksPerFrame: 30 });
    defineSprite(`${ART}/helium-torso-${w}-idle`, strip(2), { ticksPerFrame: 12 });
    defineSprite(`${ART}/helium-torso-${w}-knife`, strip(5), { ticksPerFrame: 3, loop: false });
  }
  defineSprite(`${ART}/fidget-a`, strip(10), { ticksPerFrame: 6, loop: false });
  defineSprite(`${ART}/fidget-b`, strip(10), { ticksPerFrame: 6, loop: false });
  defineSprite(`${ART}/bored`, strip(4), { ticksPerFrame: 10 });
  defineSprite(`${ART}/timeout-yawn`, strip(8), { ticksPerFrame: 6, loop: false });
  defineSprite(`${ART}/timeout-sleep`, ptStrip(Array.from({ length: 4 }, () => ({ head: [4, -12] }))), { ticksPerFrame: 10 });
  defineSprite('fx/snore', strip(6), { ticksPerFrame: 8 });
});

interface Call {
  id: string;
  frame: number;
  x: number;
  y: number;
}
function draw(p: Player): Call[] {
  const calls: Call[] = [];
  const r = {
    sprite: (id: string, frame: number, x: number, y: number, _o?: DrawOpts) => calls.push({ id, frame, x, y }),
    line: () => {},
  } as unknown as Renderer;
  p.draw(r);
  return calls;
}
const rig = (): Rig => {
  const r = new Rig();
  r.p.invulnTicks = 0;
  return r;
};
/** Private Player state for the white-box checks. */
const priv = (p: Player) => p as unknown as Record<string, unknown> & { knife(): void; throwBomb(): void };

describe('run (rule 7)', () => {
  it('runTicksPerFrame is 3; the legs follow the speed (stride rate); torso index = legs index', () => {
    expect(TUNING.player.runTicksPerFrame).toBe(3);
    const r = rig();
    r.hold(['right']).run(30);
    const calls = draw(r.p);
    expect(calls[0].id).toBe(`${ART}/legs-run`);
    expect(calls[1].id).toBe(`${ART}/torso-pistol-run`);
    expect(calls[1].frame).toBe(calls[0].frame);
    // Full speed: one frame per 3 ticks over 12 ticks = 4 frames.
    const i0 = r.p.legs.index;
    r.run(12);
    expect((r.p.legs.index - i0 + 12) % 12).toBe(4);
  });

  it('a slower body (speed status) advances the legs more slowly', () => {
    const r = rig();
    r.hold(['right']).run(30);
    r.p.status.add({ id: 'test-slow', ticks: 100000, speed: 0.5 });
    r.run(20);
    const i0 = r.p.legs.index;
    r.run(24);
    expect((r.p.legs.index - i0 + 12) % 12).toBeLessThan(8);
  });

  it('a shot while running pops to the shoot torso (control first)', () => {
    const r = rig();
    r.hold(['right']).run(30).hold(['right', 'fire']).run(1);
    expect(draw(r.p)[1].id).toBe(`${ART}/torso-pistol-shoot`);
  });
});

describe('land (rule 9)', () => {
  it('the landing legs last the legs-land strip length', () => {
    const r = rig();
    r.hold(['jump']).run(1).release();
    let n = 0;
    for (let i = 0; i < 120; i++) {
      r.run(1);
      if (r.p.legs.id === `${ART}/legs-land`) n++;
    }
    expect(n).toBe(stripTicks(`${ART}/legs-land`));
  });
});

describe('crouch (rule 10)', () => {
  it('crouching draws legs-crouch-in (torso on its hip) while this.legs stays legs-crouch', () => {
    const r = rig();
    r.run(5).hold(['down']).run(1);
    expect(r.p.legs.id).toBe(`${ART}/legs-crouch`);
    const c = draw(r.p);
    expect(c[0]).toMatchObject({ id: `${ART}/legs-crouch-in`, frame: 0 });
    expect(c[1].id).toBe(`${ART}/torso-pistol-crouch`);
    expect(c[1].y - c[0].y).toBe(-14);
    r.run(6);
    const d = draw(r.p);
    expect(d[0].id).toBe(`${ART}/legs-crouch`);
    expect(d[1].y - d[0].y).toBe(-10);
    r.release().run(1);
    expect(draw(r.p)[0].id).toBe(`${ART}/legs-crouch-out`);
  });

  it('shooting cancels the transition on the same tick; the muzzle keeps the standing strip', () => {
    const r = rig();
    r.run(5).hold(['down']).run(1).hold(['down', 'fire']).run(1);
    const c = draw(r.p);
    expect(c[0].id).toBe(`${ART}/legs-crouch`);
    expect(c[1].id).toBe(`${ART}/torso-pistol-crouch-shoot`);
    const m = r.p.muzzleWorld();
    expect(m[0] - r.p.x).toBe(15);
    expect(m[1] - r.p.y).toBe(-10 - 5);
  });

  it('a knife cancels the transition and plays the crouch knife', () => {
    const r = rig();
    r.run(5).hold(['down']).run(1);
    priv(r.p).knife();
    const c = draw(r.p);
    expect(c[0].id).toBe(`${ART}/legs-crouch`);
    expect(c[1].id).toBe(`${ART}/torso-pistol-crouch-knife`);
  });
});

describe('aim (rule 11)', () => {
  it('the drawn aim steps fwd -> diag -> up over 2 ticks per 45°; elev is immediate', () => {
    const r = rig();
    r.run(5).hold(['up']).run(1);
    expect(r.p.elev).toBeCloseTo(-Math.PI / 2);
    expect(draw(r.p)[1].id).toBe(`${ART}/torso-pistol-diag-up`);
    r.run(2);
    expect(draw(r.p)[1].id).toBe(`${ART}/torso-pistol-up`);
    r.release().run(1);
    expect(draw(r.p)[1].id).toBe(`${ART}/torso-pistol-diag-up`);
    r.run(2);
    expect(draw(r.p)[1].id).toBe(`${ART}/torso-pistol-idle`);
  });
});

describe('knife (rule 12)', () => {
  it('a per-player counter alternates knife / knife-b', () => {
    const r = rig();
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      priv(r.p).knife();
      ids.push(r.p.torso.id);
      r.run(20);
    }
    expect(ids).toEqual([`${ART}/torso-pistol-knife`, `${ART}/torso-pistol-knife-b`, `${ART}/torso-pistol-knife`, `${ART}/torso-pistol-knife-b`]);
  });
});

describe('fidgets (rule 14)', () => {
  it('fidget-a at 150 idle ticks, fidget-b the next time, bored still at 300', () => {
    const r = rig();
    r.run(TUNING.player.fidgetTicks + 1);
    expect(draw(r.p)[0].id).toBe(`${ART}/fidget-a`);
    r.hold(['right']).run(1);
    expect(draw(r.p)[0].id).toBe(`${ART}/legs-run`);
    r.release().run(10 + TUNING.player.fidgetTicks);
    expect(draw(r.p)[0].id).toBe(`${ART}/fidget-b`);
    r.run(TUNING.player.boredTicks - TUNING.player.fidgetTicks);
    expect(draw(r.p)[0].id).toBe(`${ART}/bored`);
  });

  it('no fidget under a status art (Helium)', () => {
    const r = rig();
    r.p.status.add(HELIUM);
    r.run(TUNING.player.fidgetTicks + 5);
    expect(draw(r.p).map((c) => c.id)).not.toContain(`${ART}/fidget-a`);
  });
});

describe('time-out (rule 15)', () => {
  it('yawn, then sleep; the death lasts yawn + 2 sleep loops; the yawn sfx plays', () => {
    const r = rig();
    const sfx = vi.spyOn(r.world.audio, 'sfx');
    r.run(5);
    r.p.kill('timeout');
    expect(r.p.full.id).toBe(`${ART}/timeout-yawn`);
    expect(sfx.mock.calls.map((c) => c[0])).toContain('player/yawn');
    const total = stripTicks(`${ART}/timeout-yawn`) + 2 * stripTicks(`${ART}/timeout-sleep`);
    r.run(stripTicks(`${ART}/timeout-yawn`) + 2);
    expect(r.p.full.id).toBe(`${ART}/timeout-sleep`);
    expect(r.p.state).toBe('dead');
    // The snore rises from the sleeper's head (draw-only).
    const calls = draw(r.p);
    const body = calls.find((c) => c.id === `${ART}/timeout-sleep`);
    const snore = calls.find((c) => c.id === 'fx/snore');
    expect(body && snore).toBeTruthy();
    expect(snore!.y).toBeLessThan(body!.y - 10);
    r.run(total - stripTicks(`${ART}/timeout-yawn`) - 4);
    expect(r.p.state).toBe('dead');
    r.run(4);
    expect(r.p.state).not.toBe('dead');
  });
});

describe('Helium fallback (F8)', () => {
  it('run, crouch twins and knife-b fall back to the base action under a status art', () => {
    const r = rig();
    r.p.status.add(HELIUM);
    r.hold(['right']).run(20);
    expect(r.p.torso.id).toBe(`${ART}/helium-torso-pistol-idle`);
    r.release().run(5);
    priv(r.p).knife();
    r.run(20);
    priv(r.p).knife();
    expect(r.p.torso.id).toBe(`${ART}/helium-torso-pistol-knife`);
  });
});
