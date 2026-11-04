/**
 * The Swan at 40 px, wired into the game (docs/design/ams40.md wave 7, "The Swan"; the verifier's
 * integration): src/game/content/vehicles/swan/art.ts registers the three baked sets (`swan`,
 * `swan-neck`, `swan-water`) and nothing else under `vehicle/swan/` and `vehicle/swan-mute/` (no old
 * robot drawer is left, plan rule 8; the m3 socks prefixes keep the old rig); the perch deck table
 * follows every baked body strip; the swim clock and the water picks read the set's events; the
 * strapped-on gun's level shot leaves low enough to hit the people on the street (plan D7: their
 * 30 px hurtboxes stay).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import { buttonMask, VirtualPad, type Button } from '../../src/engine/input';
import { frameCount, getFrame, getFrames, hasSprite, listSprites, spriteAnim } from '../../src/engine/sprites';
import { Terrain, terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { SET as CORE } from '../../src/game/content/art40/swan.gen';
import { SET as NECK } from '../../src/game/content/art40/swan-neck.gen';
import * as WATER from '../../src/game/content/art40/swan-water.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/locals/index';
import type * as SwanArt from '../../src/game/content/vehicles/swan/art';
import { HULL_DY, MUZZLE_REL, PERCH_TOP, REST } from '../../src/game/content/vehicles/swan/constants';
import '../../src/game/content/vehicles/swan/index';
import { stripDurations, SWIM_UNITS, swimFrameAt, swimStep, swimStrokeB } from '../../src/game/content/vehicles/swan/swan';
import '../../src/game/content/weapons/index';
import { attachGame, HudState } from '../../src/game/context';
import { Player } from '../../src/game/player/player';
import { gameEntityFactory } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { applyTuning } from '../../src/game/tuning';

applyTuning();
const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[art]')) return;
  warn(...args);
});

const P1 = 'vehicle/swan';
const P2 = 'vehicle/swan-mute';
const P1_ONLY = new Set(['egg', 'scuffs', 'beak-flash']);
const SETS: readonly BakedSet[] = [CORE, NECK, WATER.SET];
const CONTRACT: Record<string, unknown> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;

let art: typeof SwanArt;
beforeAll(async () => {
  art = await import('../../src/game/content/vehicles/swan/art');
});

/** The baked strip of an id (P1 or P2), or undefined. */
function bakedStrip(id: string): BakedSet['strips'][string] | undefined {
  const name = id.slice(id.lastIndexOf('/') + 1);
  for (const s of SETS) if (s.strips[name]) return s.strips[name];
  return undefined;
}

describe('art.ts registers the three baked Swan sets and no old drawer', () => {
  it('SWAN_SETS = swan, swan-neck, swan-water: disjoint strips, one prefix', () => {
    expect(art.SWAN_SETS).toEqual([CORE, NECK, WATER.SET]);
    const seen = new Set<string>();
    for (const s of art.SWAN_SETS) {
      expect(s.prefix).toBe(P1);
      for (const n of Object.keys(s.strips)) {
        expect(seen.has(n), `${n} in two sets`).toBe(false);
        seen.add(n);
      }
    }
  });

  it('every vehicle/swan and vehicle/swan-mute id the game lists is a baked strip, drawn with its own frames and timing', () => {
    const ids = [...listSprites(`${P1}/`), ...listSprites(`${P2}/`)];
    const baked = new Set(art.SWAN_BAKED_IDS);
    expect(ids.length).toBe(baked.size);
    for (const id of ids) {
      expect(baked.has(id), `${id}: an old drawer registers it`).toBe(true);
      const st = bakedStrip(id);
      expect(st, id).toBeDefined();
      if (!st) continue;
      expect(frameCount(id), id).toBe(st.frames.length);
      expect(spriteAnim(id).durations, id).toEqual(st.durations);
      st.frames.forEach((bf, i) => {
        const f = getFrame(id, i);
        expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id} #${i}`).toEqual([bf.w, bf.h, bf.ox, bf.oy]);
        expect(decodeBakedIndices(bf).length, `${id} #${i}`).toBe(bf.w * bf.h);
      });
      // 1× pixels at every tier (rule 7): the frames at 2 and 4 are the same objects
      expect(getFrames(id, 4)[0], id).toBe(getFrames(id, 1)[0]);
    }
  });

  it('registers every contract id of the Swan (P1 and P2) and the P2 set lacks only the P1 props', () => {
    const contract = Object.keys(CONTRACT).filter((id) => id.startsWith(`${P1}/`) || id.startsWith(`${P2}/`));
    expect(contract.length).toBe(177); // 89 + 86 old ids + swim-neck-honk (P1, P2: the honk on the water)
    for (const id of contract) expect(hasSprite(id), id).toBe(true);
    const all = SETS.flatMap((s) => bakedSetIds(s));
    const p2Missing = all.filter((id) => id.startsWith(`${P1}/`) && !hasSprite(`${P2}/${id.slice(P1.length + 1)}`));
    expect(p2Missing.map((id) => id.slice(P1.length + 1)).sort()).toEqual([...P1_ONLY].sort());
  });

  it('the m3 Swan in socks keeps its old body strips (out of scope, still working)', () => {
    for (const pre of Object.keys(art.SWAN_SOCKS_PREFIXES)) {
      for (const n of ['idle', 'run', 'move', 'swim', 'glide', 'rise', 'dive', 'migrate-soot']) {
        expect(hasSprite(`${pre}/${n}`), `${pre}/${n}`).toBe(true);
        expect(getFrames(`${pre}/${n}`).length, `${pre}/${n}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the logic tables follow the baked art', () => {
  it('HULL_DY has one entry per frame of every baked body strip with a perch point: the drawn deck', () => {
    let n = 0;
    for (const set of [CORE, WATER.SET]) {
      for (const [name, st] of Object.entries(set.strips)) {
        if (name.endsWith('-front') || !st.frames.every((f) => f.pts?.perch)) continue;
        n++;
        expect(HULL_DY[name], name).toBeDefined();
        expect(HULL_DY[name].length, name).toBe(st.frames.length);
        st.frames.forEach((f, i) => expect(HULL_DY[name][i], `${name} ${i}`).toBe((f.pts?.perch?.[1] ?? 0) - PERCH_TOP.stand));
      }
    }
    expect(n).toBeGreaterThan(30);
    // no stale row of the old rig is left
    for (const name of Object.keys(HULL_DY)) expect(CORE.strips[name] ?? WATER.SET.strips[name], name).toBeDefined();
  });

  it('stripDurations reads the baked water strips without the art too (the headless sims)', () => {
    for (const name of ['swim', 'flap', 'rise', 'sit-down', 'dive', 'glide']) {
      expect(stripDurations(`vehicle/swan-nope/${name}`), name).toEqual(WATER.SET.strips[name].durations);
    }
  });

  it('the swim clock: one cycle per SWIM_CYCLE ticks moving, SWIM_CYCLE_STILL still; every frame; two strokes', () => {
    const n = WATER.SET.strips.swim.frames.length;
    expect(n).toBe(12);
    for (const [step, cycle] of [[swimStep(true), WATER.SWIM_CYCLE], [swimStep(false), WATER.SWIM_CYCLE_STILL]] as const) {
      let u = 0;
      const frames: number[] = [];
      for (let t = 0; t < cycle; t++) {
        frames.push(swimFrameAt(u, n));
        u = (u + step) % SWIM_UNITS;
      }
      expect(u, `${cycle}: back at the start after one cycle`).toBe(0);
      expect(new Set(frames).size).toBe(n);
      // each frame shows for about cycle / n ticks (24 → 2 ticks: the strip's own durations)
      for (let f = 0; f < n; f++) {
        const k = frames.filter((x) => x === f).length;
        expect(k).toBeGreaterThanOrEqual(Math.floor(cycle / n));
        expect(k).toBeLessThanOrEqual(Math.ceil(cycle / n));
      }
    }
    expect(WATER.SWIM_CYCLE / n).toBe(WATER.SET.strips.swim.durations[0]);
    expect([WATER.SWIM_STROKE_A, swimStrokeB(n)]).toEqual([0, 6]);
    expect(swimStrokeB(4)).toBe(2); // the m3 socks swim (4 frames)
  });
});

// ------------------------------------------------------------------------------- the gun (D7)

const FLOOR = 176;

/** A mounted Swan firing level at a standing target 130 px ahead: the target's hp after. */
function levelBurst(type: string, crouch = false): { hp0: number; hp: number; ys: number[] } {
  const t = terrain(3000, 216);
  t.ground().at(0, FLOOR).flat(3000);
  const world = new World({ terrain: new Terrain(t.build()), seed: 7, factory: gameEntityFactory });
  attachGame(world, new GameSession({ characters: ['vincent', 'vincent'], seed: 7 }), new HudState());
  const pad = new VirtualPad();
  const p = new Player(world, 140, FLOOR, { pad, index: 0 });
  world.add(p);
  p.placeAt(140, FLOOR, 0);
  const swan = world.spawn('swan', 200, FLOOR, {}) as unknown as { mount(p: Player): void };
  world.flush();
  world.camera.follow(world.players);
  let mask = 0;
  const run = (n: number): void => {
    for (let i = 0; i < n; i++) {
      pad.update(mask);
      world.update();
    }
  };
  run(30);
  swan.mount(p);
  run(40);
  if (crouch) {
    mask = buttonMask('down' as Button);
    run(20);
  }
  const target = world.spawn(type, 330, FLOOR, { facing: -1 }) as unknown as { hp: number };
  world.flush();
  const hp0 = target.hp;
  mask |= buttonMask('fire' as Button);
  const ys = new Set<number>();
  for (let i = 0; i < 40; i++) {
    pad.update(mask);
    world.update();
    for (const e of world.entities as unknown as Array<{ type: string; y: number }>) if (e.type === 'beak-bullet') ys.add(Math.round(e.y - FLOOR));
  }
  return { hp0, hp: target.hp, ys: [...ys] };
}

describe('the strapped-on gun keeps the gameplay (plan D7)', () => {
  it('the level barrel tip of every standing body frame sits inside the 30 px hurtbox of the street', () => {
    const top = -30; // the handhaver's body box (handhaver.ts: w 14, h 30), the lowest on the street
    // the ground strips she fires from (the honk rears up for its 20 ticks; jumps fly over the boxes)
    for (const name of ['idle', 'run', 'move', 'land', 'skid', 'stomp', 'squat']) {
      getFrames(`${P1}/${name}`).forEach((f, i) => {
        const socket = f.pts?.neck ?? REST.neck;
        const y = socket[1] + MUZZLE_REL.land[2][1];
        expect(y, `${name} ${i}`).toBeGreaterThanOrEqual(top + 1);
        expect(y, `${name} ${i}`).toBeLessThan(-10);
      });
    }
  });

  it('afloat the level shot leaves over the water line (the drum rides high on the water)', () => {
    const surface = -16; // SWAN.swimDepth under the surface: the float line is her anchor
    for (const name of ['swim', 'honk-swim']) {
      getFrames(`${P1}/${name}`).forEach((f, i) => {
        const y = (f.pts?.neck ?? REST.neck)[1] + MUZZLE_REL.water[2][1];
        expect(y, `${name} ${i}`).toBeLessThan(surface);
        expect(y, `${name} ${i}`).toBeGreaterThanOrEqual(surface - 8);
      });
    }
    // ducked, the gun is under the surface (its spout breaks it): at most 4 px under
    for (const f of getFrames(`${P1}/water-duck`)) expect((f.pts?.neck ?? REST.neck)[1] + MUZZLE_REL.duck[0][1]).toBeLessThanOrEqual(surface + 4);
  });

  it('a level burst from the mounted Swan kills a standing handhaver; crouched too', () => {
    const r = levelBurst('handhaver');
    expect(r.ys.length).toBeGreaterThan(0);
    for (const y of r.ys) expect(y).toBeGreaterThanOrEqual(-29);
    expect(r.hp0).toBeGreaterThan(0);
    expect(r.hp).toBeLessThan(r.hp0);
    const c = levelBurst('handhaver', true);
    expect(c.hp).toBeLessThan(c.hp0);
  });
});
