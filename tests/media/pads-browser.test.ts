/**
 * Gamepads in a real browser (docs/design/ams-extras.md §10): the browser input sources
 * (input.browser.ts GamepadSource + KeyboardSource) in headless Chromium, with fake pads injected
 * through `navigator.getGamepads` (tests/media/browser/pads-entry.ts): claiming P1 / P2, the
 * free pad's START that asks to join, a pad that drops out (lost) and comes back at another
 * index (its slot again, never a swap), a non-standard pad with a hat D-pad, the keyboard next to
 * the pads, rumble. The scenes on top (title, select, join, lost-pad pause) run headless in
 * tests/game/pads-scenes.test.ts with the same PadSource. Skips (with a warning) when Chromium
 * cannot start.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let browser: Browser | null = null;
let page: Page | null = null;
const pageErrors: string[] = [];

async function bundle(): Promise<string> {
  const entry = fileURLToPath(new URL('./browser/pads-entry.ts', import.meta.url));
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, name: 'PadTestBundle', formats: ['iife'], fileName: 'pad-test' } },
  });
  const outputs = Array.isArray(out) ? out : [out];
  for (const o of outputs) {
    if ('output' in o) {
      const chunk = o.output.find((c) => c.type === 'chunk');
      if (chunk && chunk.type === 'chunk') return chunk.code;
    }
  }
  throw new Error('vite produced no chunk');
}

beforeAll(async () => {
  try {
    const code = await bundle();
    browser = await chromium.launch();
    page = await browser.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: code });
  } catch (err) {
    console.warn('[pads-browser.test] skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
/** Button bits (input.ts BUTTON_BIT). */
const B = { left: 1, right: 2, up: 4, down: 8, fire: 16, jump: 32, bomb: 64, start: 128 };

describe('gamepads in the browser (fake navigator.getGamepads)', () => {
  it('claims, joins, lost and reconnected pads, a hat D-pad, the keyboard and rumble', async () => {
    if (!page) return;
    const p = page;
    type S = Awaited<ReturnType<Window['PadTest']['state']>>;
    const state = (): Promise<S> => p.evaluate(() => window.PadTest.state());
    const run = <T>(fn: string): Promise<T> => p.evaluate(fn) as Promise<T>;

    // Two pads; 1 player: every pad drives P1; the first non-START press claims P1.
    await p.evaluate(([a, b]) => {
      const T = window.PadTest;
      T.connect(0, a);
      T.connect(1, b);
      T.step();
      T.press(1, T.PAD.south);
      T.step();
    }, [DUALSENSE, XBOX]);
    let s = await state();
    expect(s.held[0] & B.jump).toBe(B.jump);
    expect(s.live).toEqual([1, -1]);
    expect(s.family).toEqual(['xbox', null]);
    expect(s.free).toBe(1);

    // A 1-player game watches for a join: START on the free pad asks to join, P1 does not see it.
    const free = await p.evaluate(() => {
      const T = window.PadTest;
      T.press(1, T.PAD.south, false);
      T.setJoinWatch(true);
      T.press(0, T.PAD.start);
      T.step();
      return T.freePressed(T.PAD.start);
    });
    expect(free).toBe(0);
    s = await state();
    expect(s.pressed[0] & B.start).toBe(0);
    expect(s.raw).toContain('GamepadB9');

    // The join: 2 players, pad 0 claims P2 (its START stays hidden); each pad drives its own player.
    await p.evaluate(() => {
      const T = window.PadTest;
      T.setPlayers(2);
      T.claim(1, 0);
      T.step();
      T.press(0, T.PAD.start, false);
      T.press(0, T.PAD.west);
      T.step();
    });
    s = await state();
    expect(s.held[1] & B.fire).toBe(B.fire);
    expect(s.held[0] & B.fire).toBe(0);
    expect(s.live).toEqual([1, 0]);

    // P1's Xbox pad sleeps: lost; it wakes up at index 2: P1 again (no swap).
    await p.evaluate(([b]) => {
      const T = window.PadTest;
      T.press(0, T.PAD.west, false);
      T.disconnect(1);
      T.step();
      T.connect(2, b);
      T.step();
    }, [XBOX]);
    s = await state();
    expect(s.lost).toEqual([false, false]);
    expect(s.live).toEqual([2, 0]);
    await p.evaluate(() => {
      const T = window.PadTest;
      T.disconnect(2);
      T.step();
    });
    s = await state();
    expect(s.lost).toEqual([true, false]);

    // The keyboard keeps working next to the pads (2-player sets: P1 fire is F).
    await p.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
      window.PadTest.step();
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }));
    });
    s = await state();
    expect(s.held[0] & B.fire).toBe(B.fire);

    // A non-standard 8BitDo (D-input) with a hat D-pad on axis 9 claims P1 back.
    await p.evaluate(() => {
      const T = window.PadTest;
      T.step();
      T.connect(3, '2dc8-6101-8BitDo SN30 Pro', '', 16, 10);
      T.axis(3, 9, 9 / 7);
      T.step();
      T.claim(0, 3);
      T.step();
      T.axis(3, 9, 5 / 7); // hat left
      T.press(3, 1); // raw 1 = B (south)
      T.step();
    });
    s = await state();
    expect(s.lost[0]).toBe(false);
    expect(s.family[0]).toBe('nintendo');
    expect(s.held[0] & (B.left | B.jump)).toBe(B.left | B.jump);

    // Rumble on the slot's own pad.
    expect(await run<boolean>('window.PadTest.rumble(1)')).toBe(true);
    s = await state();
    expect(s.effects).toBe(1);
    expect(pageErrors).toEqual([]);
  }, 60_000);
});
