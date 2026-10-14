/**
 * Sub-pixel policy measurement (docs/ARCHITECTURE.md §3): which policy shows less jitter on a
 * res-5 backbuffer (1080p)? A probe renderer records where every sprite anchor lands, using the
 * same placement functions as the real renderers, for:
 * - the player's on-screen x over 300 ticks of walking right in ams section a;
 * - the background layers' on-screen origins during that walk (judder of slow layers);
 * - the offsets between the parts of one entity (parts drawn from a mix of pre-rounded and
 *   fractional positions): the ams mayor and the Swan with her rider. Fatbike youths (pairs
 *   included) and delivery riders are one composite sprite each: no parts to drift.
 * - whether the parts of one entity stay on one grid: the share of draws where some part's
 *   anchor is not a whole number of logical px away from the first part's (`offGrid`): parts
 *   drawn from a mix of rounded and unrounded positions show up here at res > 1.
 * The numbers are printed; the test checks that DEFAULT_SUBPIXEL has the least player jitter
 * and part wobble, and among those policies the least background judder, and that the player,
 * the Swan with her rider and the ams mayor keep their parts on one grid.
 */
import { describe, expect, it } from 'vitest';
import type { Color } from '../../src/engine/color';
import type { Entity } from '../../src/engine/entity';
import { buttonMask } from '../../src/engine/input';
import type { PixelBuffer } from '../../src/engine/pixel';
import { frameH, frameW, type DrawOpts, type Frame, type Renderer } from '../../src/engine/render';
import {
  anchorTopLeft,
  cameraPx,
  DEFAULT_SUBPIXEL,
  layerCam,
  parallaxOrigin,
  SUBPIXEL_MODES,
  toPx,
  type Placement,
  type SubpixelMode,
} from '../../src/engine/render-common';
import { getFrame } from '../../src/engine/sprites';
import type { UpscaleMode } from '../../src/engine/upscale';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';

const K = 5;

interface Call {
  buf: PixelBuffer;
  /** Anchor in backbuffer px (screen). */
  ax: number;
  ay: number;
}

/** Renderer that only records where sprite anchors land (placement maths of render-common.ts). */
class Probe implements Renderer {
  readonly w = 384;
  readonly h = 216;
  readonly res = K;
  readonly mode: UpscaleMode = 'pixel';
  subpixel: SubpixelMode;
  camX = 0;
  camY = 0;
  private cx = 0;
  private cy = 0;
  private exactX = 0;
  calls: Call[] = [];
  /** Screen origin x (logical px) of every background layer drawn (0 < factor < 1), by buffer. */
  layers = new Map<PixelBuffer, number[]>();
  private readonly place: Placement = { x: 0, y: 0 };

  constructor(subpixel: SubpixelMode) {
    this.subpixel = subpixel;
  }
  setMode(): void {}
  setSubpixel(s: SubpixelMode): void {
    this.subpixel = s;
  }
  begin(): void {}
  end(): void {}
  setCamera(x: number, y: number): void {
    this.exactX = x;
    this.cx = cameraPx(x, K, this.subpixel);
    this.cy = cameraPx(y, K, this.subpixel);
    this.camX = this.cx / K;
    this.camY = this.cy / K;
  }
  sprite(id: string, i: number, x: number, y: number, o?: DrawOpts): void {
    this.frame(getFrame(id, i), x, y, o);
  }
  frame(f: Frame, x: number, y: number, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const fine = !screen && this.subpixel === 'all';
    const ax = toPx(x, K, fine) - (screen ? 0 : this.cx);
    const ay = toPx(y, K, fine) - (screen ? 0 : this.cy);
    anchorTopLeft(this.place, frameW(f), frameH(f), f.ox, f.oy, ax, ay, o?.flipX === true, o?.flipY === true, K);
    this.calls.push({ buf: f.buf, ax, ay });
  }
  image(): void {}
  rect(_x: number, _y: number, _w: number, _h: number, _c: Color): void {}
  line(): void {}
  text(): void {}
  parallax(buf: PixelBuffer, factorX: number, _fy: number, offsetX: number): void {
    if (!(factorX > 0 && factorX < 1)) return;
    const x = parallaxOrigin(offsetX, layerCam(this.camX, this.exactX, factorX, K, this.subpixel), factorX, K, this.subpixel !== 'off') / K;
    let list = this.layers.get(buf);
    if (!list) {
      list = [];
      this.layers.set(buf, list);
    }
    list.push(x);
  }
  fade(): void {}
}

interface Jitter {
  /** Tick pairs compared (the same number of parts drawn in both ticks). */
  pairs: number;
  /** Tick pairs where some part moved against the first part. */
  changed: number;
  /** Sum of |change| of part offsets (logical px). */
  total: number;
  /** Largest single change (logical px). */
  max: number;
  /** Draws (of 2+ parts) seen, and those with a part off the first part's logical-px grid. */
  draws: number;
  offGrid: number;
}

function emptyJitter(): Jitter {
  return { pairs: 0, changed: 0, total: 0, max: 0, draws: 0, offGrid: 0 };
}

/** Count a draw whose parts are not all whole logical px apart. */
function addGrid(j: Jitter, cur: Call[]): void {
  if (cur.length < 2) return;
  j.draws++;
  for (let i = 1; i < cur.length; i++) {
    if ((cur[i].ax - cur[0].ax) % K !== 0 || (cur[i].ay - cur[0].ay) % K !== 0) {
      j.offGrid++;
      return;
    }
  }
}

/**
 * Compare part offsets (anchor of part i − anchor of part 0) between two ticks that draw the same
 * number of parts. Animation moves some parts the same way in every policy; the differences
 * between policies are rounding.
 */
function addPartJitter(j: Jitter, prev: Call[] | undefined, cur: Call[]): void {
  if (!prev || prev.length !== cur.length || cur.length < 2) return;
  j.pairs++;
  let moved = false;
  for (let i = 1; i < cur.length; i++) {
    const dx = Math.abs(cur[i].ax - cur[0].ax - (prev[i].ax - prev[0].ax)) / K;
    const dy = Math.abs(cur[i].ay - cur[0].ay - (prev[i].ay - prev[0].ay)) / K;
    const d = dx + dy;
    if (d > 0) moved = true;
    j.total += d;
    j.max = Math.max(j.max, d);
  }
  if (moved) j.changed++;
}

interface PlayerJitter {
  ticks: number;
  /** Mean |second difference| of the on-screen x (logical px): 0 for a steady motion. */
  secondDiff: number;
  /** Ticks where the on-screen motion turned around. */
  reversals: number;
}

interface Measure {
  player: PlayerJitter;
  /** Background layers (0 < factor < 1): mean |second difference| of the origin (logical px). */
  layers: number;
  /** The camera's on-screen scroll (terrain): mean |second difference| (logical px). */
  scroll: number;
  /** The same walk if the player were drawn at its unrounded x (snapped to 1/k like 'all'). */
  unrounded: PlayerJitter;
  parts: Record<string, Jitter>;
}

function playerJitter(xs: readonly number[]): PlayerJitter {
  let second = 0;
  let reversals = 0;
  let lastD = 0;
  for (let i = 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    if (i > 1) second += Math.abs(d - (xs[i - 1] - xs[i - 2]));
    if (d !== 0) {
      if (lastD !== 0 && Math.sign(d) !== Math.sign(lastD)) reversals++;
      lastD = d;
    }
  }
  return { ticks: xs.length, secondDiff: second / Math.max(1, xs.length - 2), reversals };
}

const GROUPS: Record<string, readonly string[]> = {
  mayor: ['ams-mayor'],
  swan: ['swan'],
  player: ['player'],
};

/** Draw the target entities of one tick into the probe, per entity (rider included for the Swan). */
function recordParts(game: HeadlessGame, probe: Probe, last: Map<number, Call[]>, out: Record<string, Jitter>): void {
  const world = game.world;
  if (!world) return;
  probe.setCamera(world.camera.viewX, world.camera.viewY);
  const players = game.runner?.players ?? [];
  for (const e of world.entities as readonly Entity[]) {
    if (e.removed) continue;
    for (const [name, types] of Object.entries(GROUPS)) {
      if (!types.includes(e.type)) continue;
      probe.calls = [];
      e.draw(probe);
      for (const p of players) if ((p as { vehicle: unknown }).vehicle === e) p.draw(probe);
      const calls = probe.calls;
      out[name] ??= emptyJitter();
      addPartJitter(out[name], last.get(e.id), calls);
      addGrid(out[name], calls);
      last.set(e.id, calls);
    }
  }
}

async function measure(subpixel: SubpixelMode): Promise<Measure> {
  const probe = new Probe(subpixel);
  const parts: Record<string, Jitter> = {};
  // 1. The player walking right in ams-a (no bot: a steady walk), on-screen anchor x.
  const walk = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, god: true, input: () => buttonMask('right') });
  const xs: number[] = [];
  const ideal: number[] = [];
  const cams: number[] = [];
  probe.layers.clear();
  try {
    walk.step(60);
    for (let t = 0; t < 300; t++) {
      walk.step(1);
      const p = walk.player(0);
      const cam = walk.world?.camera;
      if (!p || !cam) continue;
      walk.runner?.draw(probe);
      cams.push(probe.camX);
      probe.calls = [];
      p.draw(probe);
      if (probe.calls.length) xs.push(probe.calls[0].ax / K);
      ideal.push(Math.round(p.x * K) / K - probe.camX);
    }
  } finally {
    walk.dispose();
  }
  // 2. The Swan with player 1 riding her: spawned and mounted at the start of ams-c, then right.
  const ride = await createHeadlessGame({ missionId: 'ams', sectionId: 'c', seed: 1, god: true, input: () => buttonMask('right') });
  try {
    ride.step(1);
    const p = ride.player(0);
    const world = ride.world;
    if (p && world) {
      const swan = world.spawn('swan', p.x, p.y) as unknown as Entity & { mount(p: unknown): void };
      world.flush();
      swan.mount(p);
      const last = new Map<number, Call[]>();
      for (let t = 0; t < 900 && !ride.done; t++) {
        ride.step(1);
        recordParts(ride, probe, last, parts);
      }
    }
  } finally {
    ride.dispose();
  }
  // 3. Entities made of parts: bot runs through ams a, c and the d boss.
  const runs: Array<{ section: string; boss?: boolean; ticks: number }> = [
    { section: 'a', ticks: 1500 },
    { section: 'c', ticks: 1500 },
    { section: 'd', boss: true, ticks: 900 },
  ];
  for (const r of runs) {
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: r.section, bossRush: r.boss, seed: 1, god: true, bot: true });
    const last = new Map<number, Call[]>();
    try {
      for (let t = 0; t < r.ticks && !game.done; t++) {
        game.step(1);
        recordParts(game, probe, last, parts);
      }
    } finally {
      game.dispose();
    }
  }
  const layerJudder = [...probe.layers.values()].filter((l) => l.length === xs.length).map((l) => playerJitter(l).secondDiff);
  return {
    player: playerJitter(xs),
    unrounded: playerJitter(ideal),
    layers: layerJudder.reduce((a, v) => a + v, 0) / Math.max(1, layerJudder.length),
    scroll: playerJitter(cams).secondDiff,
    parts,
  };
}

describe('sub-pixel policy (res 5)', () => {
  it('measures player and part jitter; the default policy has the least part wobble', async () => {
    const results = {} as Record<SubpixelMode, Measure>;
    for (const s of SUBPIXEL_MODES) results[s] = await measure(s);
    const lines: string[] = [];
    for (const s of SUBPIXEL_MODES) {
      const m = results[s];
      lines.push(`${s.padEnd(8)} player: mean |Δ²x| ${m.player.secondDiff.toFixed(3)} px, reversals ${m.player.reversals} / ${m.player.ticks} ticks`);
      lines.push(`${''.padEnd(8)} background layers: mean |Δ²x| ${m.layers.toFixed(3)} px; terrain scroll: mean |Δ²x| ${m.scroll.toFixed(3)} px`);
      if (s === 'all') lines.push(`${''.padEnd(8)} (player drawn at its unrounded x: mean |Δ²x| ${m.unrounded.secondDiff.toFixed(3)} px, reversals ${m.unrounded.reversals})`);
      for (const [name, j] of Object.entries(m.parts)) {
        lines.push(
          `${''.padEnd(8)} ${name.padEnd(8)}: ${j.changed}/${j.pairs} tick pairs moved, total ${j.total.toFixed(1)} px, max ${j.max.toFixed(2)} px; off-grid ${j.offGrid}/${j.draws} draws`,
        );
      }
    }
    console.log(`[sub-pixel]\n${lines.join('\n')}`);
    const wobble = (s: SubpixelMode): number => Object.values(results[s].parts).reduce((a, j) => a + j.changed, 0);
    for (const g of Object.keys(GROUPS)) expect(results[DEFAULT_SUBPIXEL].parts[g]?.pairs ?? 0, g).toBeGreaterThan(0);
    // Parts of one entity stay locked together (whole logical px apart) in the default policy.
    for (const g of Object.keys(GROUPS)) expect(results[DEFAULT_SUBPIXEL].parts[g].offGrid, `${g} parts off the grid`).toBe(0);
    // The eye follows the player first: least player jitter and part wobble, then the smoothest background.
    const minPlayer = Math.min(...SUBPIXEL_MODES.map((s) => results[s].player.secondDiff));
    const minWobble = Math.min(...SUBPIXEL_MODES.map(wobble));
    const steady = SUBPIXEL_MODES.filter((s) => results[s].player.secondDiff <= minPlayer + 1e-9 && wobble(s) === minWobble);
    const best = steady.reduce((a, b) => (results[b].layers < results[a].layers ? b : a));
    expect(DEFAULT_SUBPIXEL).toBe(best);
  }, 300_000);
});
