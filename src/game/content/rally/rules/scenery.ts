/**
 * The rules' scenery part (`rules/works`, order 300; docs/api/rally.md "B.6", "B.R"): what the rules
 * put on the road, drawn per view from the race's `RallyRules` (rally/rules/rules.ts `rulesOf`):
 *
 * - the road works of every zone that stands (lap 2): the cones, barrier boards, the arrow-board
 *   truck, the mobile camera (pieces culled by the fog distance), the yellow lines, and — flashing —
 *   the truck's amber arrow and the amber lamps;
 * - the police: the blue beacons of CARS' police model (its two beacon meshes by turns) while its
 *   blue lights are on, and the raised `STOP` / `POLITIE` display while it chases or stops a racer.
 *
 * Built once per track (props/roadworks.ts); `fill` allocates nothing (the items and the police
 * matrices are made in `build`).
 */
import { mat4PoseYPR } from '../../../../engine/r3/mat';
import type { DrawItem } from '../../../../engine/view3d';
import type { RallyTrack } from '../../../rally/api';
import { BODY_LIGHT, RALLY_MODEL } from '../../../rally/ids';
import { rallyModel, type RallyDrawCtx, type RallyScenery } from '../../../rally/registry';
import { rulesPlan } from '../../../rally/rules/plan';
import { rulesOf } from '../../../rally/rules/rules';
import { carModelInfo } from '../models/types';
import { buildPoliceDisplay, buildWorksMeshes, buildWorksPage } from '../props/roadworks';

/** The police pool's size at most (hard: 4). */
const POLICE_MAX = 4;
/** Frames per flash: the arrow board and lamps (on, off), the beacons, the display's two texts. */
const ARROW_FRAMES = 24;
const BEACON_FRAMES = 6;
const DISPLAY_FRAMES = 40;

export function buildRulesScenery(track: RallyTrack): RallyScenery {
  const plan = rulesPlan(track);
  const { page, tex } = buildWorksPage();
  const { meshes, zones } = buildWorksMeshes(track, plan, tex);
  const police = carModelInfo(rallyModel(RALLY_MODEL.police));
  const top = police ? police.anchors.box.y1 : 1.6;
  meshes.push(...buildPoliceDisplay(top, tex));
  const beacons = police?.lights.beacons ?? null;
  const zoneItems = zones.map((z) => ({
    pieces: z.pieces.map((p) => ({ item: { mesh: p.mesh, m: null } as DrawItem, x: p.x, y: p.y, z: p.z, r: p.r })),
    decal: { item: { mesh: z.decal.mesh, m: null } as DrawItem, x: z.decal.x, y: z.decal.y, z: z.decal.z, r: z.decal.r },
    arrow: { mesh: z.arrow, m: null } as DrawItem,
    lamps: { mesh: z.lamps, m: null } as DrawItem,
    truck: z.truck,
  }));
  const pol = Array.from({ length: POLICE_MAX }, () => {
    const m = new Float32Array(16);
    return {
      m,
      beaconA: beacons ? ({ mesh: beacons[0], m } as DrawItem) : null,
      beaconB: beacons ? ({ mesh: beacons[1], m } as DrawItem) : null,
      frame: { mesh: 'rules/police/display', m } as DrawItem,
      stop: { mesh: 'rules/police/stop', m } as DrawItem,
      politie: { mesh: 'rules/police/politie', m } as DrawItem,
    };
  });
  return {
    meshes,
    pages: [page],
    fill(ctx: RallyDrawCtx, out: DrawItem[], k: number): number {
      const rules = rulesOf(ctx.runner);
      if (!rules) return k;
      const c = ctx.cam.pos;
      const far = ctx.far;
      const lit = Math.floor(ctx.t / ARROW_FRAMES) % 2 === 0;
      for (let i = 0; i < zoneItems.length; i++) {
        if (!rules.works.zones[i]?.active) continue;
        const zi = zoneItems[i];
        for (const p of zi.pieces) if (within(c, far, p.x, p.y, p.z, p.r)) out[k++] = p.item;
        const d = zi.decal;
        if (within(c, far, d.x, d.y, d.z, d.r)) out[k++] = d.item;
        if (within(c, far, zi.truck[0], zi.truck[1], zi.truck[2], 6)) {
          if (lit) out[k++] = zi.arrow;
          else out[k++] = zi.lamps;
        }
      }
      const cars = rules.police.cars;
      for (let i = 0; i < cars.length && i < POLICE_MAX; i++) {
        const p = cars[i];
        const b = p.body;
        if (b.hidden || ((b.lights ?? 0) & BODY_LIGHT.blue) === 0) continue;
        if (!within(c, far, b.pos[0], b.pos[1], b.pos[2], 4)) continue;
        const it = pol[i];
        mat4PoseYPR(it.m, b.pos[0], b.pos[1], b.pos[2], b.yaw, b.phys.pitch, b.phys.roll);
        const turn = Math.floor(ctx.t / BEACON_FRAMES) % 2 === 0;
        const bi = turn ? it.beaconA : it.beaconB;
        if (bi) out[k++] = bi;
        if (p.phase === 'chase' || p.phase === 'pull' || p.phase === 'hold') {
          out[k++] = it.frame;
          out[k++] = Math.floor(ctx.t / DISPLAY_FRAMES) % 2 === 0 ? it.stop : it.politie;
        }
      }
      return k;
    },
  };
}

/** Is a sphere (x, y, z, r) within `far` of the camera at `c`? */
function within(c: readonly number[], far: number, x: number, y: number, z: number, r: number): boolean {
  const dx = x - c[0];
  const dy = y - c[1];
  const dz = z - c[2];
  const f = far + r;
  return dx * dx + dy * dy + dz * dz <= f * f;
}
