import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { VirtualPad, buttonMask, type Button } from '../../src/engine/input';
import { SoftRenderer } from '../../src/engine/render-soft';
import { terrain } from '../../src/engine/terrain';
import { drawHud } from '../../src/game/hud';
import { MissionRunner, type MissionDef, type SectionDef } from '../../src/game/mission/index';
import { defineMission } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { TUNING } from '../../src/game/tuning';
import { FLOOR } from './helpers';

function flatSection(id: string, width: number, script: SectionDef['script'], extra: Partial<SectionDef> = {}): SectionDef {
  const t = terrain(width, 216);
  t.ground().at(0, FLOOR).flat(width);
  return {
    id,
    width,
    height: 216,
    scroll: 'right',
    background: { sky: 0x203040ff, layers: [{ gen: 'missing-generator', factorX: 0.3 }] },
    terrain: t.build(),
    terrainStyle: { ground: 'dirt', edge: 'grass' },
    playerStart: { x: 40, y: FLOOR },
    decor: [{ sprite: 'decor/test-sign', x: 120, y: FLOOR }],
    script,
    ...extra,
  };
}

function makeMission(log: string[]): MissionDef {
  return {
    id: 'test-mission',
    name: 'TEST MISSION',
    music: 'test-song',
    start: 'a',
    sections: {
      a: flatSection(
        'a',
        900,
        function* scriptA(ctx) {
          log.push('a:start');
          ctx.spawnGroup('test-dummy', 2, { x: 300, spacing: 40, tag: 'wave1' });
          yield ctx.waitClear('wave1');
          log.push('a:clear');
          ctx.enableExit('east');
          ctx.unlockCamera();
        },
        { exits: [{ id: 'east', rect: { x: 760, y: 0, w: 140, h: 216 }, to: 'b', disabled: true }] },
      ),
      b: flatSection('b', 600, function* scriptB(ctx) {
        log.push(`b:start:${Math.round(ctx.players[0].x)}`);
        yield 30;
        log.push('b:done');
        yield ctx.missionComplete();
        log.push('never');
      }),
    },
  };
}

class Driver {
  readonly runner: MissionRunner;
  readonly pads: readonly [VirtualPad, VirtualPad];
  mask = 0;

  constructor(runner: MissionRunner, pads: readonly [VirtualPad, VirtualPad]) {
    this.runner = runner;
    this.pads = pads;
  }

  hold(...b: Button[]): this {
    this.mask = buttonMask(...b);
    return this;
  }
  run(n: number): this {
    for (let i = 0; i < n; i++) {
      this.pads[0].update(this.mask);
      this.pads[1].update(0);
      this.runner.update();
    }
    return this;
  }
  until(pred: () => boolean, max = 2000): number {
    for (let i = 0; i < max; i++) {
      if (pred()) return i;
      this.run(1);
    }
    throw new Error('condition not met');
  }
}

function setup(mission: MissionDef | string, session = new GameSession()): { runner: MissionRunner; drv: Driver; audio: NullAudio } {
  const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  const audio = new NullAudio();
  const runner = new MissionRunner({ session, mission, pads, audio, seed: 3 });
  // The driver feeds the same pads the runner reads.
  const drv = new Driver(runner, pads);
  return { runner, drv, audio };
}

describe('mission runner', () => {
  it('loads a section, runs its script, takes a branch exit and completes the mission', async () => {
    await import('./helpers'); // registers 'test-dummy'
    const log: string[] = [];
    const { runner, drv, audio } = setup(makeMission(log));
    let completed = false;
    runner.events.on('complete', () => (completed = true));
    runner.start();
    expect(runner.section.id).toBe('a');
    expect(runner.players.length).toBe(1);
    expect(runner.players[0].y).toBe(FLOOR);
    expect(log).toEqual(['a:start']);
    expect(audio.log).toContain('music:test-song');
    drv.run(1); // entities spawned by the script join the world at the next flush
    expect(runner.world.countAlive('wave1')).toBe(2);

    // The exit is disabled until the wave is cleared.
    drv.hold('right').run(200);
    expect(runner.section.id).toBe('a');
    for (const e of runner.world.byTag('wave1')) runner.world.damage(e, { amount: 99, kind: 'bullet', dirX: 1, owner: 0 });
    drv.run(2);
    expect(log).toEqual(['a:start', 'a:clear']);
    expect(runner.session.slots[0].score).toBe(200);

    // Walk into the exit: fade out, section b, fade in.
    drv.until(() => runner.state === 'exiting');
    drv.until(() => runner.section.id === 'b');
    expect(runner.state).toBe('entering');
    drv.until(() => runner.state === 'playing');
    expect(log[2]).toBe('b:start:40');
    // b's script finishes the mission: victory poses, then 'complete'.
    drv.hold().until(() => runner.state === 'victory');
    expect(log).toContain('b:done');
    expect(runner.players[0].state).toBe('victory');
    drv.until(() => completed, TUNING.transition.victoryTicks + 5);
    expect(runner.state).toBe('complete');
    expect(log).not.toContain('never');
    expect(runner.session.completed).toContain('test-mission');
  });

  it('draws scenery, entities and the HUD with the software renderer', () => {
    const log: string[] = [];
    const { runner } = setup(makeMission(log));
    runner.start();
    const r = new SoftRenderer();
    r.begin(runner.sky);
    runner.draw(r);
    drawHud(r, { session: runner.session, hud: runner.hud, runner, inputPlayers: 1, ticks: 0 });
    r.end();
    // The sky colour fills the top-left corner; the ground is painted (fallback painter).
    expect(r.target.get(200, 2) >>> 0).not.toBe(0);
    expect(r.target.get(200, 200) >>> 0).not.toBe(runner.sky >>> 0);
  });

  it('time-out kills every player and refills the timer', () => {
    const saved = TUNING.timer.ticksPerCount;
    TUNING.timer.ticksPerCount = 2;
    try {
      const mission: MissionDef = {
        id: 'timer-test',
        name: 'T',
        music: '',
        start: 'a',
        sections: {
          a: flatSection(
            'a',
            800,
            function* idle() {
              yield () => false;
            },
            { timeLimit: 3 },
          ),
        },
      };
      const { runner, drv } = setup(mission);
      runner.start();
      expect(runner.timeLeft).toBe(3);
      let timeouts = 0;
      runner.world.events.on('timeOut', () => timeouts++);
      drv.run(7);
      expect(timeouts).toBe(1);
      expect(runner.players[0].state).toBe('dead');
      expect(runner.players[0].cause).toBe('timeout');
      expect(runner.timeLeft).toBe(3);
    } finally {
      TUNING.timer.ticksPerCount = saved;
    }
  });

  it('checkpoints refill the timer', () => {
    const mission: MissionDef = {
      id: 'cp-test',
      name: 'CP',
      music: '',
      start: 'a',
      sections: {
        a: flatSection(
          'a',
          2000,
          function* idle() {
            yield () => false;
          },
          { checkpoints: [600] },
        ),
      },
    };
    const { runner, drv } = setup(mission);
    runner.start();
    const cps: number[] = [];
    runner.world.events.on('checkpoint', (e) => cps.push(e.x));
    drv.hold('right').until(() => cps.length > 0, 600);
    expect(cps).toEqual([600]);
    expect(runner.checkpoint.x).toBe(600);
  });

  it('game over when every player is out; a continue brings the player back', () => {
    const mission: MissionDef = {
      id: 'go-test',
      name: 'GO',
      music: '',
      start: 'a',
      sections: {
        a: flatSection('a', 800, function* idle() {
          yield () => false;
        }),
      },
    };
    const session = new GameSession();
    const { runner, drv } = setup(mission, session);
    let over = false;
    runner.events.on('gameOver', () => (over = true));
    runner.start();
    session.slots[0].lives = 1;
    runner.players[0].kill('impact');
    drv.until(() => over, 200);
    expect(runner.state).toBe('gameover');
    expect(runner.continuePlayer(0)).toBe(true);
    expect(runner.state).toBe('playing');
    drv.until(() => runner.players[0].state === 'play', 100);
  });

  it('carries a mounted vehicle into the next section', async () => {
    const { Vehicle } = await import('../../src/game/vehicle');
    const { defineEntity } = await import('../../src/game/registry');
    class Cart extends Vehicle {
      constructor(w: ConstructorParameters<typeof Vehicle>[0], x: number, y: number) {
        super(w, x, y, {}, { art: 'vehicle/cart', seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20] });
      }
    }
    defineEntity('test-cart', (w, x, y) => new Cart(w, x, y), { category: 'vehicle' });
    const log: string[] = [];
    const mission = makeMission(log);
    // GDD §4.8: only into sections that list the vehicle ("vehicles allowed").
    mission.sections.b = { ...mission.sections.b, vehicles: ['test-cart'] };
    const { runner, drv } = setup(mission);
    runner.start();
    const cart = runner.world.spawn('test-cart', 60, FLOOR) as InstanceType<typeof Vehicle>;
    runner.world.flush();
    cart.mount(runner.players[0]);
    cart.cells = 2;
    runner.exitTo('b');
    drv.until(() => runner.section.id === 'b');
    drv.run(2);
    const p = runner.players[0];
    expect(p.state).toBe('mounted');
    expect(p.vehicle).toBeInstanceOf(Vehicle);
    expect((p.vehicle as InstanceType<typeof Vehicle>).cells).toBe(2);
  });

  it('leaves a vehicle behind when the next section does not allow it (the pilot walks on)', async () => {
    const { Vehicle } = await import('../../src/game/vehicle');
    const { defineEntity } = await import('../../src/game/registry');
    class Cart2 extends Vehicle {
      constructor(w: ConstructorParameters<typeof Vehicle>[0], x: number, y: number) {
        super(w, x, y, {}, { art: 'vehicle/cart', seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20] });
      }
    }
    defineEntity('test-cart-2', (w, x, y) => new Cart2(w, x, y), { category: 'vehicle' });
    const { runner, drv } = setup(makeMission([]));
    runner.start();
    const cart = runner.world.spawn('test-cart-2', 60, FLOOR) as InstanceType<typeof Vehicle>;
    runner.world.flush();
    cart.mount(runner.players[0]);
    runner.exitTo('b');
    drv.until(() => runner.section.id === 'b');
    drv.run(2);
    expect(runner.players[0].state).toBe('play');
    expect(runner.world.byTag('vehicle').length).toBe(0);
    expect(runner.session.slots[0].mission.noScratches).toBe(true); // left at full cells
  });

  it('vertical sections: the camera starts at the bottom, only scrolls up, and falling out below kills', () => {
    const t = terrain(384, 640);
    t.ground().at(0, 620).flat(384);
    t.platform(100, 400, 200);
    const seen: number[] = [];
    const mission: MissionDef = {
      id: 'tower',
      name: 'TOWER',
      music: '',
      start: 'a',
      sections: {
        a: {
          ...flatSection('a', 384, function* climb(ctx) {
            yield ctx.waitCameraY(300);
            seen.push(Math.round(ctx.camera.y));
          }),
          height: 640,
          scroll: 'up',
          terrain: t.build(),
          playerStart: { x: 192, y: 620 },
        },
      },
    };
    const { runner, drv } = setup(mission);
    runner.start();
    const cam = runner.world.camera;
    expect(cam.y).toBe(640 - 216);
    const p = runner.players[0];
    p.placeAt(192, 400, 0); // up on the platform
    drv.until(() => seen.length > 0, 300);
    expect(cam.y).toBeLessThanOrEqual(300);
    const top = cam.y;
    // Drop through the platform: the camera must not follow back down; the player falls out.
    p.invulnTicks = 1000;
    drv.hold('down', 'jump').run(1).hold();
    drv.until(() => p.state === 'dead', 300);
    expect(p.cause).toBe('pit');
    expect(cam.y).toBeLessThanOrEqual(top + 0.001);
  });

  it('unknown missions and sections fall back to a placeholder (no crash)', () => {
    const { runner, drv } = setup('no-such-mission');
    runner.start();
    expect(runner.mission.name).toContain('NO-SUCH-MISSION');
    drv.hold('right').until(() => runner.state === 'victory', 3000);
  });

  it('missions registered with defineMission are found by id', () => {
    const log: string[] = [];
    defineMission({ ...makeMission(log), id: 'registered-test' });
    const { runner } = setup('registered-test');
    runner.start();
    expect(runner.mission.id).toBe('registered-test');
    expect(log).toEqual(['a:start']);
  });
});
