/**
 * The floor of `ams` d STOPERA (src/game/content/missions/ams/floor/d/, docs/design/floor.md §4.4 d,
 * §12.2 d). The shared floor tests (floor-sections, floor-street, floor-faces, floor-wave-b) enrol the
 * section by themselves; these check what is special in it:
 * - the street logic of the flea market (§11 R2): the market's square (the far pavement widened past
 *   the walk line, flush) holds everything the script keeps in the walk plane, the cobbled street in
 *   front of it is the roadway, the forecourt is free; the kerbs bend over ≥ 32 px;
 * - the front row of poles at the market's edge keeps clear of the stalls and the rack the heroes
 *   fight at, and stops before the arena (§12.2 d: no front row there);
 * - the decor's depths: the bollards replaced, the lamp the gull sleeps on in the walk plane, the back
 *   stalls on the square as boxes, the Stopera at its depth with its doors where the boss spawns (for
 *   every camera) and its 2D copy hidden;
 * - ROBO-HALSEMA steps out of the Stopera's doors in the WALK PLANE (§3.7 has no exceptions, §12.1 item 3):
 *   her hurtboxes stop shots from her first tick (sparks, no damage in the intro), so her art stays with
 *   them at depth 0 in every tick; the floor changes nothing in her run.
 */
import { describe, expect, it } from 'vitest';
import { makeFloorCam, sAtDepth, vAtDepth } from '../../src/engine/floor/cam';
import { loadContent } from '../../src/game/content/index';
import { DOORS_X } from '../../src/game/content/missions/ams/section-d';
import { AMS_CAMERA, depthAt, roadwayAt } from '../../src/game/content/missions/ams/floor/index';
import {
  D_FLOOR_ON,
  D_FRONT_ROW,
  D_LAYOUT,
  D_SQUARE_EDGE,
  DOORS_U,
  FORECOURT_U,
  STALL_DEPTH,
  STOPERA_DEPTH,
  STOPERA_X,
} from '../../src/game/content/missions/ams/floor/d/index';
import { bindWorldFloor, checkFloor, floorOf, setFloorOverride } from '../../src/game/mission/floor/index';
import { decorDepthOf, floorShift, type FloorPoint } from '../../src/game/mission/floor/hooks';
import type { SectionDef } from '../../src/game/mission/types';
import { gameEntityFactory, getMission } from '../../src/game/registry';
import { SoftRenderer } from '../../src/engine/render-soft';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import type { Entity } from '../../src/engine/entity';
import { AmsSecret } from '../../src/game/content/missions/ams/secrets';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import type { FloorDef } from '../../src/game/mission/floor/types';

import { createHeadlessGame } from '../../src/sim/index';
import { buttonMask } from '../../src/engine/input';

await loadContent();
const sectionD = getMission('ams')?.sections.d as SectionDef;
const cam = makeFloorCam({ ...AMS_CAMERA });
const vAt = (depth: number): number => vAtDepth(cam, depth);

/** The Stopera sprite's doors' centre, px right of its anchor (art.ts `stopera`: dx 294, ox 1). */
const DOOR_PX = 293;

describe('ams d: the street layout (spec §4.4 d, §11 R2)', () => {
  it('has its floor on', () => {
    expect(D_FLOOR_ON).toBe(true);
    expect(floorOf(sectionD)).toBeDefined();
  });

  it('the market is a square in the walk plane with a cobbled street in front of it; the forecourt is free', () => {
    for (let u = 0; u < FORECOURT_U - 40; u += 8) {
      const r = roadwayAt(D_LAYOUT, u, vAt);
      expect(r, `u ${u}`).not.toBeNull();
      // The street starts in front of the walk plane's things (their feet ± 3 world px) and ends at the near kerb.
      expect((r as readonly [number, number])[0], `u ${u}`).toBeGreaterThan(3 + 1);
      expect((r as readonly [number, number])[1]).toBeCloseTo(vAt(-16.3), 6);
    }
    for (let u = FORECOURT_U; u < sectionD.width + 32; u += 8) expect(roadwayAt(D_LAYOUT, u, vAt), `u ${u}`).toBeNull();
  });

  it('the square lies flush with the walk plane over the whole market (the walk line stays on the physics surface)', () => {
    const floor = checkFloor(sectionD);
    expect(floor).not.toBeNull();
    for (let u = 0; u < FORECOURT_U; u += 4) for (const d of [-2, 0, 4, 9]) expect(floor?.heightAt(u, vAt(d)), `u ${u} depth ${d}`).toBeCloseTo(0, 6);
    // The house fronts' pavement is raised behind its kerb.
    expect(floor?.heightAt(400, vAt(12.5))).toBeGreaterThan(1);
  });

  it('bends its kerbs over ≥ 32 px (never a hard jump)', () => {
    const far = D_LAYOUT.far;
    expect(typeof far).not.toBe('number');
    for (let u = 700; u < 1000; u += 1) expect(Math.abs(depthAt(far, u + 1) - depthAt(far, u))).toBeLessThan((18 - D_SQUARE_EDGE) / 32 + 1e-9);
  });
});

describe('ams d: rows and decor (spec §12.2 d)', () => {
  const floor = checkFloor(sectionD);
  if (!floor) throw new Error('ams d: no floor');

  it('the front row stands at the market edge, clear of the stalls and the rack the heroes fight at, and not in the arena', () => {
    const front = floor.rows.filter((r) => r.depth < 0);
    expect(front.length).toBe(1);
    expect(front[0].depth).toBe(D_FRONT_ROW);
    const us = front[0].u;
    expect(us.length).toBeGreaterThanOrEqual(5);
    for (const u of us) {
      expect(u, 'not in the arena').toBeLessThan(FORECOURT_U - 32);
      for (const stall of [200, 560]) expect(Math.abs(u - stall), `pole @${u} by the stall @${stall}`).toBeGreaterThan(45);
      expect(u < 330 - 43 || u > 336 + 43, `pole @${u} by the bike rack`).toBe(true);
    }
  });

  it('the decor stands where it should: bollards replaced, the gull lamp in the walk plane, the back stalls on the square', () => {
    (sectionD.decor ?? []).forEach((d, i) => {
      const depth = decorDepthOf(floor, d, i);
      if (d.sprite === 'decor/ams/bollard') expect(depth).toBeNull();
      if (d.sprite === 'decor/ams/lamp' && d.x === 820) expect(depth).toBe(0);
      if (d.sprite === 'decor/ams/market-stall') expect(depth).toBe(STALL_DEPTH);
      if (d.sprite === 'decor/ams/stopera') expect(depth === null || d.x === STOPERA_X).toBe(true);
    });
    const shown = (sectionD.decor ?? []).filter((d, i) => d.sprite === 'decor/ams/stopera' && decorDepthOf(floor, d, i) !== null);
    expect(shown.length).toBe(1);
    expect(shown[0].depth).toBe(STOPERA_DEPTH);
  });

  it('every back stall, the planter and the Stopera show their sides; the house row ends with its side', () => {
    const names = (floor.def.faces ?? []).map((g) => g.name ?? '');
    for (const x of [150, 240, 390, 480, 640, 730]) expect(names.some((n) => n.startsWith('market stall') && n.endsWith(`@${x}`)), `stall @${x}`).toBe(true);
    expect(names.some((n) => n.startsWith('planter'))).toBe(true);
    for (const n of ['stopera theatre end L', 'stopera stadhuis wing L', 'stopera doors']) expect(names).toContain(n);
    expect(names.some((n) => n.startsWith('house side') && n.includes('@785 R'))).toBe(true);
  });

  it('the doors of the Stopera stand where ROBO-HALSEMA spawns, at its depth, for every camera', () => {
    expect(DOORS_U).toBe(DOORS_X);
    const a: FloorPoint = { x: 0, y: 0 };
    const b: FloorPoint = { x: 0, y: 0 };
    for (const camX of [0, 300, 512, 700, 860, 896]) {
      floorShift(floor, STOPERA_X, 176, STOPERA_DEPTH, camX, a);
      floorShift(floor, DOORS_X, 176, STOPERA_DEPTH, camX, b);
      expect(a.x + DOOR_PX, `camX ${camX}`).toBeCloseTo(b.x, 6);
      expect(a.y).toBeCloseTo(b.y, 6);
    }
  });
});

interface BossLook {
  x: number;
  drawDepth: number;
  state: string;
  hp: number;
}

/** A boss-rush run of d, drawn every tick, the hero walking right and firing. */
async function bossRun(ticks: number): Promise<{ log: BossLook[] }> {
  const game = await createHeadlessGame({
    missionId: 'ams',
    sectionId: 'd',
    seed: 1,
    god: true,
    bot: false,
    res: 1,
    bossRush: true,
    loadContent: false,
    input: (t) => (t % 2 === 0 ? buttonMask('right', 'fire') : buttonMask('right')),
  });
  const log: BossLook[] = [];
  try {
    for (let t = 0; t < ticks; t++) {
      game.step(1);
      game.renderFrame();
      const w = game.runner?.world;
      const boss = w?.entities.find((e) => e.type === 'ams-mayor' && !e.removed);
      if (!w || !boss) continue;
      const b = boss as unknown as BossLook;
      log.push({ x: boss.x, drawDepth: boss.drawDepth, state: b.state, hp: b.hp });
    }
  } finally {
    game.dispose();
  }
  return { log };
}

describe('ams d: ROBO-HALSEMA steps out of the Stopera doors in the walk plane (spec §3.7, §12.1 item 3)', () => {
  it('is drawn in the walk plane in every tick, her intro included (art and hitbox together)', async () => {
    const { log } = await bossRun(320);
    expect(log.length).toBeGreaterThan(250);
    expect(log.filter((l) => l.drawDepth !== 0)).toEqual([]);
    // She starts in the doors and walks out of them in her intro; the fight's shots hurt her.
    expect(log[0].x).toBe(DOORS_U);
    expect(['waiting', 'intro']).toContain(log[0].state);
    const firstFight = log.findIndex((l) => l.state === 'fight');
    expect(firstFight).toBeGreaterThan(0);
    expect(log[firstFight].x).toBeLessThan(DOORS_U - 30);
    // The shots of the intro hit her box (sparks) but do no damage; the fight does.
    for (const l of log.slice(0, firstFight)) expect(l.hp).toBe(log[0].hp);
    expect(log[log.length - 1].hp).toBeLessThan(log[0].hp);
  }, 240_000);

  it('without a floor she never leaves the walk plane, and her run is the same', async () => {
    const withFloor = await bossRun(220);
    setFloorOverride(() => null);
    try {
      const flat = await bossRun(220);
      expect(flat.log.every((l) => l.drawDepth === 0)).toBe(true);
      expect(flat.log.map((l) => [l.x, l.state, l.hp])).toEqual(withFloor.log.map((l) => [l.x, l.state, l.hp]));
    } finally {
      setFloorOverride(null);
    }
  }, 240_000);
});

/** The px the floor's entity pass draws for the entities `spawn` puts in a world on the section's floor (no contact shadows). */
function entityFacePx(section: SectionDef, spawn: (w: World) => Entity[], camX: number, before?: (es: Entity[]) => void): number {
  const fl = new SectionFloor(section, { ...(floorOf(section) as FloorDef), shadow: 0 }, new Terrain(section.terrain), 1, `${section.id}-test/faces/${camX}/`);
  const w = new World({ terrain: new Terrain(section.terrain), seed: 1, factory: gameEntityFactory });
  bindWorldFloor(w, fl);
  const es = spawn(w);
  w.flush();
  before?.(es);
  const r = new SoftRenderer();
  r.begin(0);
  r.setCamera(camX, 0);
  fl.drawShadows(r, w, 1);
  r.end();
  const b = r.target;
  let n = 0;
  for (let i = 0; i < b.data.length; i++) if ((b.data[i] & 255) > 0) n++;
  return n;
}

describe('ams d: the secret chest and the Stopera\'s open doors (spec §11 R1, §12.1 item 4, §12.2 d)', () => {
  it('draws the flea-market chest as a box (lid and banded sides), open its body\'s sides only', () => {
    const spawn = (w: World): Entity[] => [w.spawn('ams-secret', 446, 176, { look: 'chest', hides: 'gem' })];
    const closed = entityFacePx(sectionD, spawn, 300);
    const open = entityFacePx(sectionD, spawn, 300, (es) => {
      (es[0] as AmsSecret).revealT = 99;
    });
    expect(closed).toBeGreaterThan(40);
    expect(open).toBeGreaterThan(0);
    expect(open).toBeLessThan(closed);
  });

  it('stands its glass doors open: the lobby from the left jamb on the facade to the right reveal\'s back edge, the eye left of the doors for every camera', () => {
    const doors = floorOf(sectionD)?.faces?.find((g) => g.name === 'stopera doors');
    expect(doors?.faces.length).toBe(3);
    const lobby = doors?.faces[0];
    expect(lobby?.pts.map((q) => q[2])).toEqual([STOPERA_DEPTH, STOPERA_DEPTH + 3, STOPERA_DEPTH + 3, STOPERA_DEPTH]);
    // The eye (the screen's centre column) never reaches the doors' left jamb.
    expect(1280 - 384 + 192).toBeLessThan(DOORS_U - 40 / sAtDepth(cam, STOPERA_DEPTH));
  });
});
