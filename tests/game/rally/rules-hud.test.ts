/**
 * The race's full HUD part (RULES, wave B; docs/design/rally.md §7.6; docs/api/rally.md "B.R"): the
 * clock, the warnings (FLITSER, a red X ahead, road works, the average-speed zone, POLITIE), the
 * BOETE line, AAN DE KANT!, the mini-map, the speed dial and the ticker — in 1P (384 × 216) and per
 * view in 2P (384 × 108), at 1×, with no text over another text (the scene's base HUD included).
 */
import { describe, expect, it } from 'vitest';
import { InputManager } from '../../../src/engine/input';
import { measure } from '../../../src/engine/font';
import type { TextOpts } from '../../../src/engine/render';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { MemoryStore } from '../../../src/engine/storage';
import { NullView3d } from '../../../src/engine/view3d';
import { createApp, type GameApp } from '../../../src/game/app';
import { loadContent } from '../../../src/game/content/index';
import { HUD_LAYOUT } from '../../../src/game/content/rally/rules/hud';
import { DEFAULT_PARAMS } from '../../../src/game/params';
import type { CarState } from '../../../src/game/rally/api';
import { laneSide, yawOf } from '../../../src/game/rally/physics';
import { rulesOf } from '../../../src/game/rally/rules/rules';
import type { RallyRunner } from '../../../src/game/rally/runner';
import { RallyScene } from '../../../src/game/scenes/rally';
import { loadRallyContent, prepareRally } from '../../../src/game/scenes/rally-route';
import { GameSession } from '../../../src/game/session';
import { SimAudio } from '../../../src/sim/stats';

await loadContent();
await loadRallyContent();

interface Box {
  s: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A renderer that records every text's box (logical px). */
class BoxRecorder extends SoftRenderer {
  boxes: Box[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    const font = o?.font ?? 'small';
    const scale = o?.scale ?? 1;
    const w = measure(s, font, scale);
    const h = (font === 'big' ? 8 : 7) * scale;
    const align = o?.align ?? 'left';
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (s.length > 0) this.boxes.push({ s, x0, y0: y, x1: x0 + w, y1: y + h });
    super.text(s, x, y, o);
  }
}

function harness(players: 1 | 2): { app: GameApp; scene: RallyScene; input: InputManager; r: BoxRecorder; step(n?: number): void; frame(): Box[] } {
  const input = new InputManager();
  input.players = players;
  const app = createApp({ input, audio: new SimAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS, mission: 'rally', seed: 5, players, lap: 2 }, view3d: new NullView3d() });
  app.session = new GameSession({ characters: players === 2 ? ['recruit', 'vincent'] : ['recruit'], seed: 5 });
  const scene = new RallyScene(app, { start: prepareRally(app, { seed: 5 }) });
  app.scenes.reset(scene);
  const r = new BoxRecorder();
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
    }
  };
  const frame = (): Box[] => {
    r.boxes = [];
    r.begin();
    app.scenes.draw(r);
    r.end();
    return r.boxes;
  };
  return { app, scene, input, r, step, frame };
}

function put(rn: RallyRunner, car: CarState, dist: number, v: number, lane: number): void {
  const t = rn.track;
  const s = t.spline.wrap(t.startS + dist);
  const sp = t.spline.sample(s, { p: [0, 0, 0], t: [0, 0, 1], r: [-1, 0, 0] });
  const side = laneSide(t, lane, s);
  car.pos[0] = sp.p[0] + sp.r[0] * side;
  car.pos[1] = sp.p[1];
  car.pos[2] = sp.p[2] + sp.r[2] * side;
  car.yaw = yawOf(sp.t[0], sp.t[2]);
  car.s = s;
  car.side = side;
  car.dist = dist;
  car.speed = v;
}

/** Every pair of text boxes that overlap (touching edges are fine). */
function overlaps(boxes: Box[]): string[] {
  const bad: string[] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5) bad.push(`"${a.s}" × "${b.s}"`);
    }
  return bad;
}

/** Put a player where most warnings apply: lap 2, in the closed lane, through the zone's start gantry (the red X ahead, the works ahead, the zone's average). */
function worstCase(scene: RallyScene, slot: number): void {
  const rn = scene.runner;
  const z = rulesOf(rn)!.plan.zone!;
  put(rn, rn.carOf(slot)!, rn.track.length + z.off0 - 2, 25, 0);
}

describe('the full HUD part (rules/hud)', () => {
  it('1P: the clock, the warnings, BOETE, the map and the dial; no text over another', () => {
    const h = harness(1);
    h.step(250);
    worstCase(h.scene, 0);
    h.step(12);
    const rn = h.scene.runner;
    rn.events.emit('fine', { car: 'white', slot: 0, kind: 'camera', euros: 1050 });
    rn.events.emit('flash', { car: 'white', slot: 0, speed: 205, limit: 100, where: 'ring-west', kind: 'camera' });
    const texts = h.frame().map((b) => b.s);
    expect(texts.some((s) => /^1[678]:\d\d$/.test(s))).toBe(true);
    expect(texts).toContain('BOETE EUR 1.050');
    expect(texts.some((s) => s.startsWith('TRAJECT '))).toBe(true);
    expect(texts).toContain('RIJSTROOK DICHT');
    // The base HUD is still there.
    expect(texts).toContain('POSITIE');
    expect(texts).toContain('KM/H');
    expect(overlaps(h.r.boxes)).toEqual([]);
    // AAN DE KANT!: the player stands on the shoulder (the police's hold).
    const rules = rulesOf(rn)!;
    const cr = rules.of(rn.carOf(0)!)!;
    cr.pulled = 0;
    rules.police.cars[0].phase = 'hold';
    rules.police.cars[0].holdT = 60;
    const t2 = h.frame();
    expect(t2.map((b) => b.s)).toContain('AAN DE KANT!');
    expect(t2.map((b) => b.s)).toContain('POLITIE  2');
    expect(overlaps(t2)).toEqual([]);
  });

  it('2P: a compact set per view; the clock in each; the ticker once at the bottom; no text over another', () => {
    const h = harness(2);
    h.step(250);
    worstCase(h.scene, 0);
    worstCase(h.scene, 1);
    h.step(12);
    h.scene.ticker = 'FILE FM  WIJ STAAN ER ALTIJD';
    const rn = h.scene.runner;
    rn.events.emit('fine', { car: 'green', slot: 1, kind: 'camera', euros: 777 });
    const boxes = h.frame();
    const texts = boxes.map((b) => b.s);
    expect(texts.filter((s) => /^1[678]:\d\d$/.test(s)).length).toBe(2);
    expect(texts.filter((s) => s === 'FILE FM  WIJ STAAN ER ALTIJD').length).toBe(1);
    const boete = boxes.find((b) => b.s === 'BOETE EUR 777')!;
    expect(boete.y0).toBeGreaterThanOrEqual(108);
    // Every text of a view stays in its view.
    for (const b of boxes) expect(b.y0 < 108 && b.y1 > 108).toBe(false);
    expect(overlaps(boxes)).toEqual([]);
  });

  it('the layout keeps clear of the base HUD (the rows, the map and the dial at 1×)', () => {
    const f = HUD_LAYOUT.full;
    // The dial above the speed digits (y 202), right of the ticker.
    expect(f.dial.cy + f.dial.r).toBeLessThan(202);
    expect(f.map.y + f.map.h).toBeLessThanOrEqual(216 - 6);
    expect(f.rows[0]).toBeGreaterThan(f.clock + 10);
    expect(f.rows[1]).toBeGreaterThanOrEqual(f.rows[0] + 11);
    const s = HUD_LAYOUT.split;
    expect(s.map.y + s.map.h).toBeLessThanOrEqual(108 - 4);
    expect(s.pulledSub + 8).toBeLessThan(s.map.y);
  });

  it('drawing the HUD never changes the race', () => {
    const run = (draw: boolean): number => {
      const h = harness(1);
      for (let i = 0; i < 400; i++) {
        h.step(1);
        if (draw && i % 7 === 0) h.frame();
      }
      return h.scene.runner.stateHash();
    };
    expect(run(true)).toBe(run(false));
  });
});
