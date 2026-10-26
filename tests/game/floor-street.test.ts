/**
 * The street logic of every section with a perspective floor (docs/design/floor.md §11 R2, and the
 * lead's rule after the wave-A review): nothing stands in the bike lane or on the cobbled roadway but
 * traffic. No decor item, no prop of a row, no face group that stands on the floor, and no pickup or
 * prop the script puts in the walk plane may have its footprint there.
 *
 * GENERIC, nothing by hand: the keep-free ranges come from each kit's layout data (the `ams` street
 * layout, `roadwayAt`: the lane or the roadway between the kerb lines — in front of a pavement bulb too —,
 * a bridge deck between its granite edges, a raised leaf's hinge pit; the town painter's layout,
 * `townGutter`: the gutter — oz-a's herringbone is a pedestrian street), the footprints from each
 * section's own data (its decor list, the rows and face groups of its FloorDef, the static props and
 * pickups a bot run through the section meets). Every registered section with a floor joins by itself
 * (wave B); a section on a new painter fails until its kit gives a keep-free map here.
 *
 * Footprints: a sprite stands on the opaque columns of its bottom rows (a tree on its trunk, a lamp on
 * its foot, a rack on its wheels), at its depth ± `FOOT` world px; a row's prop on its base ± `ROW_FOOT`
 * (thin posts and railings); a face group on the corners that touch the floor; a walk-plane entity on
 * its hitbox's width at v = 0 ± `ENTITY_FOOT`. Traffic aside: the parked cars (the kits name their face
 * groups `car …`).
 */
import { describe, expect, it } from 'vitest';
import { sAtDepth } from '../../src/engine/floor/cam';
import type { Frame } from '../../src/engine/render';
import { getFrame } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { roadwayAt, type StreetLayout } from '../../src/game/content/missions/ams/floor/index';
import { OZ_FLOOR_IDS, townGutter } from '../../src/game/content/missions/oldenzaal/floor/index';
import { checkFloor } from '../../src/game/mission/floor/index';
import type { SectionFloor } from '../../src/game/mission/floor/section-floor';
import type { FloorDef } from '../../src/game/mission/floor/types';
import type { SectionDef } from '../../src/game/mission/types';
import { getEntityMeta, getMission, listMissions } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

await loadContent();

/** Depth half-extents (world px) of a decor item, a row's prop and a walk-plane entity. */
const FOOT = 3;
const ROW_FOOT = 1;
const ENTITY_FOOT = 3;

interface FloorSection {
  key: string;
  mission: string;
  section: SectionDef;
  def: FloorDef;
}

const SECTIONS: FloorSection[] = [];
for (const m of listMissions()) {
  const md = getMission(m);
  if (!md) continue;
  for (const [id, s] of Object.entries(md.sections)) if (s.floor) SECTIONS.push({ key: `${m}/${id}`, mission: m, section: s, def: s.floor });
}

/** A world-v range [far, near] where nothing may stand at u (null: anything may). */
type KeepFree = (u: number) => readonly [number, number] | null;

/** The kit's keep-free map of a section's floor (by its painter). */
function keepFree(fs: FloorSection, floor: SectionFloor): KeepFree {
  const p = fs.def.painter;
  const vAt = (depth: number): number => floor.vAt(depth);
  if (p.id === 'ams/floor') {
    const layout = p.params?.layout as StreetLayout;
    return (u) => roadwayAt(layout, u, vAt);
  }
  if (p.id === OZ_FLOOR_IDS.painter) {
    const gutter = townGutter(p.params ?? {}, vAt);
    return () => gutter;
  }
  throw new Error(`${fs.key}: no street map for the floor painter '${p.id}' (give its kit a keep-free map in this test)`);
}

interface Foot {
  what: string;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** How far inside its ends it is sampled (default ½ px; a sprite: its outline px at its scale). */
  inset?: number;
}

/**
 * The footprints that reach into a keep-free range, sampled along u every ½ px a little inside their
 * ends (a sprite's outline px, a box face exactly on a stretch's end): the middle of a narrower one.
 */
function violations(free: KeepFree, feet: readonly Foot[]): string[] {
  const out: string[] = [];
  for (const f of feet) {
    const e = f.inset ?? 0.5;
    const a = f.u1 - f.u0 > 2 * e ? f.u0 + e : (f.u0 + f.u1) / 2;
    const b = f.u1 - f.u0 > 2 * e ? f.u1 - e : a;
    for (let u = a; u <= b + 1e-9; u += 0.5) {
      const r = free(u);
      if (!r || !(f.v1 > r[0] + 1e-6 && f.v0 < r[1] - 1e-6)) continue;
      out.push(`${f.what}: u ${u.toFixed(1)}, v ${f.v0.toFixed(1)} … ${f.v1.toFixed(1)} reaches into ${r[0].toFixed(1)} … ${r[1].toFixed(1)}`);
      break;
    }
  }
  return out;
}

/**
 * The columns a frame stands on (px from its anchor, [left, right)): the opaque columns of its two
 * lowest opaque rows (mirrored for a flipped draw); null for an empty frame.
 */
function standsOn(f: Frame, flipX = false): readonly [number, number] | null {
  const k = f.density ?? 1;
  const { w, h, data } = f.buf;
  let bottom = -1;
  for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if ((data[y * w + x] & 255) > 0) bottom = y;
  if (bottom < 0) return null;
  let c0 = Infinity;
  let c1 = -Infinity;
  for (let y = Math.max(0, bottom - 2 * k + 1); y <= bottom; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[y * w + x] & 255) === 0) continue;
      c0 = Math.min(c0, x);
      c1 = Math.max(c1, x + 1);
    }
  }
  const l = c0 / k - f.ox;
  const r = c1 / k - f.ox;
  return flipX ? [-r, -l] : [l, r];
}

/** The decor that stands on the floor (base on the walk line, not parallax, not hidden). */
function decorFeet(fs: FloorSection, floor: SectionFloor): Foot[] {
  const def = fs.def;
  const yw = floor.cam.yw;
  const out: Foot[] = [];
  (fs.section.decor ?? []).forEach((d, i) => {
    if (d.parallax !== undefined && d.parallax !== 1) return;
    if (def.hideDecor?.some((p) => d.sprite.startsWith(p))) return;
    const rule = d.depth !== undefined ? d.depth : def.decorDepth?.(d, i);
    const depth = rule === undefined ? (d.front ? 0 : (def.defaultDepth ?? 0)) : rule;
    if (depth === null || Math.abs(d.y - yw) > 0.5) return;
    const base = standsOn(getFrame(d.sprite, d.frame ?? 0, 1), d.flipX);
    if (!base) return;
    const s = sAtDepth(floor.cam, depth);
    const v = floor.vAt(depth);
    out.push({ what: `decor ${d.sprite}#${d.frame ?? 0} @${d.x} (depth ${depth.toFixed(1)})`, u0: d.x + base[0] / s, u1: d.x + base[1] / s, v0: v - FOOT, v1: v + FOOT, inset: 1 / s });
  });
  return out;
}

/** Every placed prop of every row (its frame at the row's scale stands on its base). */
function rowFeet(floor: SectionFloor): Foot[] {
  const out: Foot[] = [];
  floor.rows.forEach((row, i) => {
    const f = floor.rowFrame(row, 1);
    const base = f ? standsOn(f, row.def.flipX) : null;
    if (!base) return;
    const s = sAtDepth(floor.cam, row.depth);
    const v = floor.vAt(row.depth);
    for (const u of row.u) out.push({ what: `row '${row.def.name ?? i}' @${u.toFixed(1)}`, u0: u + base[0] / s, u1: u + base[1] / s, v0: v - ROW_FOOT, v1: v + ROW_FOOT, inset: 1 / s });
  });
  return out;
}

/** The face groups that touch the floor (traffic aside), each as the box of its faces' touching corners (one prop). */
function faceFeet(fs: FloorSection, floor: SectionFloor): Foot[] {
  const out: Foot[] = [];
  const yw = floor.cam.yw;
  for (const g of fs.def.faces ?? []) {
    if (g.name?.startsWith('car ')) continue;
    const sa = sAtDepth(floor.cam, g.depth);
    const lift = floor.liftAt(g.x, g.depth);
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const face of g.faces) {
      for (const p of face.pts) {
        const world = p.length === 4;
        const u = world ? g.x + p[0] : g.x + p[0] / sa;
        const h = world ? p[1] : (yw - g.y + lift + p[1]) / sa;
        const v = floor.vAt(p[2]);
        const ground = floor.heightAt(u, v);
        if (Number.isFinite(ground) && h > ground + 0.6) continue;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
        v0 = Math.min(v0, v);
        v1 = Math.max(v1, v);
      }
    }
    if (u0 <= u1) out.push({ what: `face group '${g.name ?? '?'}'`, u0, u1, v0, v1 });
  }
  return out;
}

/**
 * The props, pickups and hostages a bot run through the section meets standing still in the walk plane
 * (on the floor at its x: the crates the script drops at a fixed x, the breakables, a tourist's chair).
 */
async function walkPlaneFeet(fs: FloorSection, floor: SectionFloor): Promise<Foot[]> {
  const g = await createHeadlessGame({ missionId: fs.mission, sectionId: fs.section.id, seed: 1, god: true, bot: true, loadContent: false });
  const seen = new Map<number, { type: string; x0: number; y0: number; moved: number; ticks: number; hw: number; depth: number }>();
  try {
    for (let t = 0; t < 9000 && !g.done; t++) {
      g.step(1);
      const w = g.world;
      if (!w || g.runner?.section.id !== fs.section.id) break;
      for (const e of w.entities) {
        if (e.removed) continue;
        const cat = getEntityMeta(e.type)?.category;
        if (cat !== 'prop' && cat !== 'item' && cat !== 'hostage') continue;
        let s = seen.get(e.id);
        if (!s) {
          s = { type: e.type, x0: e.x, y0: e.y, moved: 0, ticks: 0, hw: e.hitbox.w / 2, depth: e.drawDepth };
          seen.set(e.id, s);
        }
        s.moved = Math.max(s.moved, Math.abs(e.x - s.x0), Math.abs(e.y - s.y0));
        s.ticks++;
      }
    }
  } finally {
    g.dispose();
  }
  const out: Foot[] = [];
  for (const s of seen.values()) {
    // Standing still on the street (the floor's height there), not riding, not flying.
    if (s.moved > 2 || s.ticks < 30) continue;
    const ground = floor.cam.yw - floor.heightAt(s.x0, 0);
    if (!(Math.abs(s.y0 - ground) <= 3)) continue;
    const v = floor.vAt(s.depth);
    out.push({ what: `${s.type} @${s.x0.toFixed(0)}`, u0: s.x0 - s.hw, u1: s.x0 + s.hw, v0: v - ENTITY_FOOT, v1: v + ENTITY_FOOT });
  }
  return out;
}

describe('street logic on every floor (spec §11 R2: nothing in the lane or on the roadway but traffic)', () => {
  it('finds the floor sections (wave A: ams a and oz-a; wave B adds the rest)', () => {
    const keys = SECTIONS.map((s) => s.key);
    expect(keys).toContain('ams/a');
    expect(keys).toContain('oldenzaal/oz-a');
  });

  for (const fs of SECTIONS) {
    describe(fs.key, () => {
      const floor = checkFloor(fs.section, fs.def);
      if (!floor) throw new Error(`${fs.key}: no floor`);
      const free = keepFree(fs, floor);

      it('has a keep-free street to guard (the map is not empty)', () => {
        let n = 0;
        for (let u = 0; u < fs.section.width; u += 8) if (free(u)) n++;
        expect(n).toBeGreaterThan(fs.section.width / 32);
      });

      it('no decor item stands in it', () => {
        const feet = decorFeet(fs, floor);
        expect(feet.length).toBeGreaterThan(10);
        expect(violations(free, feet)).toEqual([]);
      });

      it('no prop of a row stands in it', () => {
        const feet = rowFeet(floor);
        expect(feet.length).toBeGreaterThan(20);
        expect(violations(free, feet)).toEqual([]);
      });

      it('no face group stands in it (traffic aside)', () => {
        expect(violations(free, faceFeet(fs, floor))).toEqual([]);
      });

      it('no prop, pickup or hostage the script puts in the walk plane stands in it', async () => {
        const feet = await walkPlaneFeet(fs, floor);
        expect(feet.length).toBeGreaterThan(2);
        expect(violations(free, feet)).toEqual([]);
      }, 240_000);
    });
  }
});
