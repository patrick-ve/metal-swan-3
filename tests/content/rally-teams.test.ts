/**
 * FIELD's models (docs/design/rally.md §6, §7.3, §7.4; docs/api/rally.md "B.F"): the six new rally
 * team cars and the seven new traffic types — triangle budgets (teams 300–500, traffic 120–250),
 * valid meshes (indices, uvs inside their pages, fronts outward), 4-bit pages with ≤ 16 PAL_HD
 * colours per CLUT row (the traffic's palette swaps), deterministic builds, plausible sizes, anchors
 * inside the box, made-up yellow plates and the team names on both sides and the roof (never
 * mirrored). Also the teams' handling and the traffic types' table.
 */
import { describe, expect, it } from 'vitest';
import { PAL_HD } from '../../src/engine/palette-hd';
import type { Mesh3, TexturePage } from '../../src/engine/view3d';
import '../../src/game/content/rally/models/index';
import { TEAM_MODEL_IDS, TEAM_MODELS } from '../../src/game/content/rally/models/team-index';
import { TRAFFIC_MODEL_IDS, TRAFFIC_MODELS, TRAFFIC_ROWS } from '../../src/game/content/rally/models/traffic-index';
import { carModelInfo, type RallyCarModel } from '../../src/game/content/rally/models/types';
import { paintCamper } from '../../src/game/content/rally/models/camper';
import { paintFrietbak } from '../../src/game/content/rally/models/frietbak';
import { paintIjsco } from '../../src/game/content/rally/models/ijsco';
import { paintLimo } from '../../src/game/content/rally/models/limo';
import { paintAchteruit, paintOma } from '../../src/game/content/rally/models/small';
import { S } from '../../src/game/content/rally/tex/car-palette';
import type { CarSheet } from '../../src/game/content/rally/tex/car-sheet';
import type { TexRect } from '../../src/game/content/rally/tex/kit';
import { glyphRows, letterWidth } from '../../src/game/content/rally/tex/letters';
import { TEAMS, TEAM_NAMES } from '../../src/game/content/rally/teams/index';
import { TRAFFIC_TYPES } from '../../src/game/content/rally/traffic/index';
import { handlingOf } from '../../src/game/rally/physics';
import { RALLY_MODEL } from '../../src/game/rally/ids';
import { rallyModel } from '../../src/game/rally/registry';

const model = (id: string): RallyCarModel => {
  const m = carModelInfo(rallyModel(id));
  if (!m) throw new Error(`no car model ${id}`);
  return m;
};

const TEAM_IDS = Object.values(TEAM_MODEL_IDS);
const TRAFFIC_IDS = Object.values(TRAFFIC_MODEL_IDS);
const ALL = [...TEAM_IDS, ...TRAFFIC_IDS];

/** Is `text` painted (glyph cells exact, `scale` texels per cell, left to right) in `r`? */
function hasText(page: TexturePage, r: TexRect, text: string, slot: number, scale = 1, gap = 1): boolean {
  const cells: [number, number, boolean][] = [];
  let x = 0;
  for (const ch of text) {
    const rows = glyphRows(ch);
    rows.forEach((row, j) => [...row].forEach((c, i) => cells.push([x + i, j, c === '#'])));
    x += rows[0].length + gap;
  }
  const w = letterWidth(text, 'small', gap) * scale;
  for (let y0 = 0; y0 + 5 * scale <= r.h; y0++) {
    for (let x0 = 0; x0 + w <= r.w; x0++) {
      let ok = true;
      for (const [cx, cy, ink] of cells) {
        const px = r.x + x0 + cx * scale;
        const py = r.y + y0 + cy * scale;
        if ((page.index[py * page.w + px] === slot) !== ink) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
  }
  return false;
}

const reverse = (s: string): string => [...s].reverse().join('');

function hashModel(m: RallyCarModel): string {
  let h = 0x811c9dc5;
  const feed = (a: ArrayBufferView): void => {
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 0x01000193) >>> 0;
  };
  for (const me of m.meshes) {
    feed(me.pos);
    feed(me.uv);
    feed(me.idx);
  }
  for (const p of m.pages) feed(p.index);
  return h.toString(16);
}

describe("FIELD's models: registry and budgets", () => {
  it('registers the six team models and the seven traffic models (with CARS’ hearse and hatchback)', () => {
    expect(TEAM_MODELS.map((d) => d.id).sort()).toEqual([...TEAM_IDS].sort());
    expect(TRAFFIC_MODELS.map((d) => d.id).sort()).toEqual([...TRAFFIC_IDS].sort());
    for (const id of [...ALL, RALLY_MODEL.rival, RALLY_MODEL.traffic]) expect(model(id).id).toBe(id);
  });

  it('keeps the budgets: rally teams 300–500 triangles, traffic 120–250; far versions far cheaper', () => {
    for (const id of TEAM_IDS) {
      expect(model(id).tris, id).toBeGreaterThanOrEqual(300);
      expect(model(id).tris, id).toBeLessThanOrEqual(500);
    }
    for (const id of TRAFFIC_IDS) {
      expect(model(id).tris, id).toBeGreaterThanOrEqual(120);
      expect(model(id).tris, id).toBeLessThanOrEqual(250);
    }
    for (const id of ALL) {
      const m = model(id);
      const drawn = m.parts.reduce((n, p) => n + m.meshes.find((x) => x.id === p)!.idx.length / 3, 0);
      expect(drawn, id).toBe(m.tris);
      expect(m.lod.tris, id).toBeLessThan(m.tris * 0.65);
    }
  });
});

describe("FIELD's models: meshes and pages", () => {
  const each = (f: (m: RallyCarModel, me: Mesh3) => void): void => {
    for (const id of ALL) for (const me of model(id).meshes) f(model(id), me);
  };

  it('valid arrays, uvs inside the page, fronts along their normals, the part flags', () => {
    each((m, me) => {
      const n = me.pos.length / 3;
      expect(me.uv.length, me.id).toBe(2 * n);
      for (const i of me.idx) expect(i < n, me.id).toBe(true);
      for (const v of me.pos) expect(Number.isFinite(v), me.id).toBe(true);
      expect(me.id.startsWith(`car/${m.id}/`), me.id).toBe(true);
      const p = m.pages.find((x) => x.id === me.page)!;
      expect(p, me.id).toBeDefined();
      for (let i = 0; i < me.uv.length; i += 2) {
        expect(me.uv[i] >= 0 && me.uv[i] <= p.w, `${me.id} u`).toBe(true);
        expect(me.uv[i + 1] >= 0 && me.uv[i + 1] <= p.h, `${me.id} v`).toBe(true);
      }
      const P = me.pos;
      const N = me.nrm!;
      for (let t = 0; t < me.idx.length; t += 3) {
        const [a, b, c] = [me.idx[t], me.idx[t + 1], me.idx[t + 2]];
        const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
        const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
        const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
        expect(Math.sqrt(cx * cx + cy * cy + cz * cz), `${me.id} tri ${t / 3}`).toBeGreaterThan(1e-9);
        expect(cx * N[a * 3] + cy * N[a * 3 + 1] + cz * N[a * 3 + 2], `${me.id} tri ${t / 3}`).toBeGreaterThan(0);
      }
    });
    for (const id of ALL) {
      const m = model(id);
      const mesh = (mid: string): Mesh3 => m.meshes.find((x) => x.id === mid)!;
      expect(mesh(`car/${id}/body`).blend).toBe('opaque');
      expect(mesh(`car/${id}/shadow`).blend).toBe('sub');
      for (const l of [m.lights.head, m.lights.tail, m.lights.brake, m.lights.indL, m.lights.indR]) {
        expect(mesh(l).blend, l).toBe('add');
        expect(mesh(l).emissive, l).toBe(true);
      }
    }
  });

  it('4-bit pages of their own, ≤ 16 PAL_HD colours per CLUT row; the traffic has palette-swap rows', () => {
    const palette = new Set<number>(Object.values(PAL_HD).flatMap((r) => [...(r as readonly number[])].map((c) => c >>> 0)));
    const pages = new Set<number>();
    for (const id of [...ALL, RALLY_MODEL.white, RALLY_MODEL.green, RALLY_MODEL.rival, RALLY_MODEL.traffic, RALLY_MODEL.police]) {
      const p = model(id).pages[0];
      expect(pages.has(p.id), `${id} page ${p.id} shared`).toBe(false);
      pages.add(p.id);
      expect(p.id).toBeGreaterThanOrEqual(100);
      expect(p.id).toBeLessThan(200);
    }
    for (const id of ALL) {
      const m = model(id);
      const p = m.pages[0];
      for (const k of p.index) expect(k < 16).toBe(true);
      const rows = p.clut.length / 256;
      expect(rows, id).toBe(m.rows.length);
      for (let r = 0; r < rows; r++) for (let k = 0; k < 16; k++) expect(palette.has(p.clut[r * 256 + k]), `${id} row ${r} slot ${k}`).toBe(true);
    }
    for (const id of TRAFFIC_IDS) {
      expect(model(id).rows.length, id).toBe(TRAFFIC_ROWS[id]);
      expect(model(id).rows.length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('builds the same models every time', () => {
    for (const def of [...TEAM_MODELS, ...TRAFFIC_MODELS]) {
      const a = carModelInfo(def.build())!;
      const b = carModelInfo(def.build())!;
      expect(hashModel(a), def.id).toBe(hashModel(b));
    }
  });
});

describe("FIELD's models: sizes, anchors, plates and lettering", () => {
  it('plausible sizes: the camper tall, the limousine long, the small cars small, the lorry and the coach big', () => {
    const size = (id: string): [number, number, number] => {
      const a = model(id).anchors;
      return [a.length, a.width, a.height];
    };
    expect(size(TEAM_MODEL_IDS.camper)[2]).toBeGreaterThan(2.6);
    expect(size(TEAM_MODEL_IDS.limo)[0]).toBeGreaterThan(7);
    expect(size(TEAM_MODEL_IDS.achteruit)[0]).toBeLessThan(4.1);
    expect(size(TEAM_MODEL_IDS.oma)[0]).toBeLessThan(3.6);
    expect(size(TEAM_MODEL_IDS.frietbak)[2]).toBeGreaterThan(3.3); // the fries
    expect(size(TRAFFIC_MODEL_IDS.lorry)[0]).toBeGreaterThan(15);
    expect(size(TRAFFIC_MODEL_IDS.coach)[0]).toBeGreaterThan(11);
    for (const id of ALL) {
      const [l, w] = size(id);
      expect(w, id).toBeLessThanOrEqual(2.56);
      expect(l / w, id).toBeGreaterThan(1.8);
    }
  });

  it('puts the anchors inside the box: wheels on the road, lamps at the ends, the bumper camera up front', () => {
    for (const id of ALL) {
      const a = model(id).anchors;
      const b = a.box;
      expect(b.y0).toBe(0);
      expect(a.wheels).toHaveLength(4);
      for (const w of a.wheels) {
        expect(w.y - w.r, id).toBeCloseTo(0, 6);
        expect(w.z - w.r, id).toBeGreaterThan(b.z0);
        expect(w.z + w.r, id).toBeLessThan(b.z1);
      }
      expect(a.wheelbase, id).toBeCloseTo(a.wheels[0].z - a.wheels[2].z, 6);
      for (const p of a.lamps.head) expect(p[2], id).toBeGreaterThan(0);
      for (const p of [...a.lamps.tail, ...a.lamps.brake]) expect(p[2], id).toBeLessThan(0);
      for (const p of a.lamps.indL) expect(p[0], id).toBeGreaterThan(0);
      for (const p of a.lamps.indR) expect(p[0], id).toBeLessThan(0);
      const c = a.bumperCam;
      expect(c[2], id).toBeGreaterThan(a.wheels[0].z);
      expect(c[2] <= b.z1 && c[1] > 0.8 && c[1] < b.y1, id).toBe(true);
    }
  });

  it('letters each team on both sides (never mirrored) and on the roof; made-up yellow plates', () => {
    const cases: [() => { sheet: CarSheet; page: TexturePage }, string, number, number, string, number, number][] = [
      // painter, side text, its slot, its scale, roof text, its slot, its scale
      [paintCamper, 'HUISJE OP WIELEN', S.ACC_C, 2, 'HUISJE', S.ACC_A, 2],
      [paintFrietbak, 'DE FRIETBAK', S.ACC_A, 2, 'FRIETBAK', S.ACC_A, 2],
      [paintLimo, 'VRIJGEZELLEN', S.ACC_A, 2, 'VRIJGEZELLEN', S.ACC_A, 1],
      [paintAchteruit, 'ACHTERUIT', S.ACC_B, 1, 'ACHTERUIT', S.ACC_A, 1],
      [paintOma, 'OMA TRUUS', S.ACC_A, 1, 'OMA TRUUS', S.ACC_A, 1],
    ];
    for (const [paint, side, slot, scale, roof, rslot, rscale] of cases) {
      const { sheet: sh, page } = paint();
      for (const r of [sh.sideL, sh.sideR]) {
        expect(hasText(page, r, side, slot, scale), side).toBe(true);
        expect(hasText(page, r, reverse(side), slot, scale), `${side} mirrored`).toBe(false);
      }
      expect(hasText(page, sh.top, roof, rslot, rscale), `${roof} on the roof`).toBe(true);
      for (const r of [sh.plateF, sh.plateB]) {
        let yellow = 0;
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (page.index[(r.y + y) * page.w + r.x + x] === S.PLATE) yellow++;
        expect(yellow).toBeGreaterThan(r.w * r.h * 0.4);
      }
    }
    // DE IJSCOMAN: the right side above its window (red), the left side low on the pink (white).
    const ij = paintIjsco();
    expect(hasText(ij.page, ij.sheet.sideR, 'DE IJSCOMAN', S.ACC_A, 2)).toBe(true);
    expect(hasText(ij.page, ij.sheet.sideL, 'DE IJSCOMAN', S.PAINT_L, 2)).toBe(true);
    expect(hasText(ij.page, ij.sheet.top, 'DE IJSCOMAN', S.ACC_A, 1)).toBe(true);
  });
});

describe('the rally teams and the traffic types', () => {
  it('seven teams in grid order with their own handling, horns and DJ mentions; no badges, only our names', () => {
    expect(TEAM_NAMES).toEqual(['DE LAATSTE RIT', 'OMA TRUUS', 'VRIJGEZELLEN', 'DE FRIETBAK', 'HUISJE OP WIELEN', 'ACHTERUIT', 'DE IJSCOMAN']);
    expect(new Set(TEAMS.map((t) => t.spec.id)).size).toBe(7);
    for (const t of TEAMS) {
      expect(t.spec.horn).toMatch(/^rally\/horn\//);
      expect(t.spec.dj).toMatch(/^rally\/dj\/team\//);
      expect(t.pace).toBeGreaterThan(0.9);
      expect(t.pace).toBeLessThan(1);
      expect(rallyModel(t.spec.model)).not.toBeNull();
    }
    const by = (name: string) => TEAMS.find((t) => t.spec.team === name)!.spec;
    // The characters: the camper slow on the straights and leaning, ACHTERUIT as fast backwards, OMA TRUUS light and quick.
    expect(by('HUISJE OP WIELEN').topSpeed).toBeLessThan(by('DE LAATSTE RIT').topSpeed - 5);
    expect(by('HUISJE OP WIELEN').lean).toBeGreaterThan(2);
    expect(by('ACHTERUIT').reverseTop).toBe(by('ACHTERUIT').topSpeed);
    expect(by('ACHTERUIT').gag).toBe('reverse');
    expect(by('OMA TRUUS').mass).toBeLessThan(900);
    expect(by('OMA TRUUS').accel).toBeGreaterThan(by('DE FRIETBAK').accel);
  });

  it("the physics takes each model's body from CARS' anchors (lead note 3)", () => {
    const limo = handlingOf(TEAMS.find((t) => t.spec.team === 'VRIJGEZELLEN')!.spec) as ReturnType<typeof handlingOf> & { circles: number; shape: { cam: number[] } };
    const a = model(TEAM_MODEL_IDS.limo).anchors;
    expect(limo.halfLen * 2).toBeCloseTo(a.box.z1 - a.box.z0, 6);
    expect(limo.wheelbase).toBeCloseTo(a.wheelbase, 6);
    expect(limo.circles).toBeGreaterThanOrEqual(5);
    expect(limo.shape.cam).toEqual([...a.bumperCam]);
    const lorry = TRAFFIC_TYPES.find((t) => t.spec.model === TRAFFIC_MODEL_IDS.lorry)!;
    const lh = handlingOf(lorry.spec) as ReturnType<typeof handlingOf> & { circles: number };
    expect(lh.halfLen * 2).toBeGreaterThan(15);
    expect(lh.circles).toBeGreaterThanOrEqual(7);
    expect(lh.wake).toBe(2);
  });

  it('eight traffic types (the hatchback, saloon, estate, van, parcel van, lorry, coach, taxi); heavy ones stay right', () => {
    expect(TRAFFIC_TYPES.map((t) => t.spec.id)).toEqual(['hatch', 'saloon', 'estate', 'van', 'parcel', 'lorry', 'coach', 'taxi']);
    for (const t of TRAFFIC_TYPES) {
      expect(rallyModel(t.spec.model), t.spec.id).not.toBeNull();
      expect(t.rows).toBe(model(t.spec.model).rows.length);
      expect(t.maxKmh).toBeLessThanOrEqual(130);
    }
    for (const id of ['lorry', 'coach', 'parcel']) expect(TRAFFIC_TYPES.find((t) => t.spec.id === id)!.lanes).not.toContain(0);
  });
});
