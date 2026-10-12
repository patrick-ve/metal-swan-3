import { describe, expect, it } from 'vitest';
import { Debug, TEAM_COLORS } from '../../src/engine/debug';
import { Entity } from '../../src/engine/entity';
import { InputManager, type InputSource } from '../../src/engine/input';
import { Body } from '../../src/engine/physics';
import { terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { RecordingRenderer } from './helpers';

class Keys implements InputSource {
  queue: string[] = [];
  read(): number {
    return 0;
  }
  drainPressed(out: string[]): void {
    out.push(...this.queue);
    this.queue.length = 0;
  }
}

class Guy extends Entity {
  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'enemy';
    this.body = new Body({ w: 10, h: 20 });
  }
}

describe('debug', () => {
  it('F-keys toggle flags only when enabled, and call action handlers', () => {
    const input = new InputManager();
    const keys = new Keys();
    input.addSource(keys);
    const d = new Debug(false);
    d.reserveKeys(input);
    expect(input.isBound('F5')).toBe(true);
    keys.queue.push('F1');
    input.update();
    expect(d.handleInput(input)).toBe(false);
    expect(d.hitboxes).toBe(false);
    d.enabled = true;
    let skipped = 0;
    d.on('skip', () => skipped++);
    keys.queue.push('F1', 'F2', 'F3', 'F4');
    input.update();
    expect(d.handleInput(input)).toBe(true);
    expect([d.hitboxes, d.stats, d.god, skipped]).toEqual([true, true, true, 1]);
    const w = new World();
    d.apply(w);
    expect(w.god).toBe(true);
  });

  it('draws hitboxes in team colours and a stats line', () => {
    const t = terrain(400, 216);
    t.ground().at(0, 170).flat(400);
    t.solid(100, 100, 20, 20);
    const w = new World({ terrain: t.build() });
    w.add(new Guy(w, 50, 170));
    w.update();
    const d = new Debug(true);
    d.hitboxes = true;
    d.stats = true;
    const r = new RecordingRenderer();
    d.draw(r, w);
    expect(r.calls.some((c) => c.op === 'rect' && c.args[4] === TEAM_COLORS.enemy)).toBe(true);
    expect(r.calls.some((c) => c.op === 'line')).toBe(true);
    const text = r.calls.find((c) => c.op === 'text');
    expect(String(text?.args[0])).toMatch(/ENT 1/);
    // Nothing is drawn when the flags are off.
    const r2 = new RecordingRenderer();
    new Debug(true).draw(r2, w);
    expect(r2.calls).toHaveLength(0);
  });
});
