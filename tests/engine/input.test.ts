import { describe, expect, it } from 'vitest';
import {
  BUTTON_BIT,
  InputManager,
  type InputSource,
  ScriptedSource,
  VirtualPad,
  buttonMask,
  defaultBindings,
  keySetFor,
  maskFromKeys,
  parseBindings,
  serializeBindings,
  timeline,
} from '../../src/engine/input';

describe('VirtualPad', () => {
  it('detects edges once per tick and counts held ticks', () => {
    const p = new VirtualPad();
    const J = BUTTON_BIT.jump;
    p.update(0);
    p.update(J);
    expect(p.pressed('jump')).toBe(true);
    expect(p.held('jump')).toBe(true);
    expect(p.heldTicks('jump')).toBe(1);
    p.update(J);
    expect(p.pressed('jump')).toBe(false);
    expect(p.heldTicks('jump')).toBe(2);
    p.update(0);
    expect(p.released('jump')).toBe(true);
    expect(p.heldTicks('jump')).toBe(0);
    p.update(0);
    expect(p.released('jump')).toBe(false);
  });

  it('axes cancel opposite directions', () => {
    const p = new VirtualPad();
    p.update(buttonMask('left', 'right', 'down'));
    expect(p.axisX()).toBe(0);
    expect(p.axisY()).toBe(1);
    p.update(buttonMask('left', 'up'));
    expect(p.axisX()).toBe(-1);
    expect(p.axisY()).toBe(-1);
  });

  it('suppress hides held buttons until released', () => {
    const p = new VirtualPad();
    p.update(BUTTON_BIT.fire);
    p.suppress();
    p.update(BUTTON_BIT.fire);
    expect(p.held('fire')).toBe(false);
    expect(p.pressed('fire')).toBe(false);
    p.update(0);
    p.update(BUTTON_BIT.fire);
    expect(p.pressed('fire')).toBe(true);
  });
});

describe('bindings', () => {
  it('defaults follow the spec and round-trip through JSON', () => {
    const b = defaultBindings();
    expect(b.solo.fire).toEqual(['KeyZ', 'KeyJ']);
    expect(b.solo.left).toContain('KeyA');
    expect(b.p1.fire).toEqual(['KeyF']);
    expect(b.p2.jump).toContain('Period');
    expect(b.pause).toContain('Escape');
    expect(parseBindings(serializeBindings(b))).toEqual(b);
  });

  it('broken or partial data falls back per field', () => {
    expect(parseBindings('{nope')).toEqual(defaultBindings());
    const partial = parseBindings(JSON.stringify({ solo: { fire: ['Space'], jump: 'x' }, pause: [1, 'KeyQ'] }));
    expect(partial.solo.fire).toEqual(['Space']);
    expect(partial.solo.jump).toEqual(defaultBindings().solo.jump);
    expect(partial.pause).toEqual(['KeyQ']);
    expect(partial.p2).toEqual(defaultBindings().p2);
  });

  it('maps keys to masks per player mode', () => {
    const b = defaultBindings();
    const down = new Set(['KeyJ', 'ArrowRight']);
    expect(maskFromKeys(b.solo, (c) => down.has(c))).toBe(buttonMask('fire', 'right'));
    expect(keySetFor(0, 1)).toBe('solo');
    expect(keySetFor(1, 1)).toBeNull();
    expect(keySetFor(1, 2)).toBe('p2');
  });
});

/** Fake keyboard implementing the source protocol (held set + press queue). */
class FakeKeys implements InputSource {
  held = new Set<string>();
  queue: string[] = [];
  read(slot: 0 | 1, ctx: { players: 1 | 2; bindings: ReturnType<typeof defaultBindings> }): number {
    const set = keySetFor(slot, ctx.players);
    return set ? maskFromKeys(ctx.bindings[set], (c) => this.held.has(c)) : 0;
  }
  drainPressed(out: string[]): void {
    out.push(...this.queue);
    this.queue.length = 0;
  }
}

describe('InputManager', () => {
  it('1-player mode: solo keys drive pad 0, pad 1 stays idle', () => {
    const input = new InputManager();
    const keys = new FakeKeys();
    input.addSource(keys);
    keys.held.add('KeyD');
    keys.held.add('ArrowRight');
    input.update();
    expect(input.pad(0).held('right')).toBe(true);
    expect(input.pad(1).mask).toBe(0);
  });

  it('2-player mode: separate key sets per pad', () => {
    const input = new InputManager();
    input.players = 2;
    const keys = new FakeKeys();
    input.addSource(keys);
    keys.held.add('KeyF'); // P1 fire
    keys.held.add('Period'); // P2 jump
    input.update();
    expect(input.pad(0).pressed('fire')).toBe(true);
    expect(input.pad(0).held('jump')).toBe(false);
    expect(input.pad(1).pressed('jump')).toBe(true);
  });

  it('raw presses, pause and reserved keys', () => {
    const input = new InputManager();
    const keys = new FakeKeys();
    input.addSource(keys);
    input.reserved.add('F1');
    keys.queue.push('F1', 'Escape');
    input.update();
    expect(input.keyPressed('F1')).toBe(true);
    expect(input.pausePressed).toBe(true);
    expect(input.anyPressed()).toBe(true);
    input.update();
    expect(input.keyPressed('F1')).toBe(false);
    expect(input.pausePressed).toBe(false);
    expect(input.isBound('F1')).toBe(true);
    expect(input.isBound('KeyZ')).toBe(true);
    expect(input.isBound('KeyQ')).toBe(false);
    input.setKeys('solo', 'bomb', ['KeyQ']);
    expect(input.isBound('KeyQ')).toBe(true);
  });

  it('scripted sources and timelines drive pads deterministically', () => {
    const input = new InputManager();
    input.players = 2;
    const tl = timeline().hold('right', 3).tap('jump', 2).at(1).hold('fire', 2);
    input.addSource(new ScriptedSource(tl, 0));
    input.addSource(new ScriptedSource((t) => (t % 2 === 0 ? ['bomb'] : null), 1));
    const p0: number[] = [];
    const p1: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      input.update();
      p0.push(input.pad(0).mask);
      p1.push(input.pad(1).pressed('bomb'));
    }
    const R = BUTTON_BIT.right;
    const J = BUTTON_BIT.jump;
    const F = BUTTON_BIT.fire;
    expect(p0).toEqual([R, R | F, R | F, J, 0, J, 0, 0]);
    expect(p1).toEqual([true, false, true, false, true, false, true, false]);
    expect(tl.length).toBe(7);
  });
});
