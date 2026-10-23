/**
 * The rally car models (docs/design/rally.md §6, §7.3, §7.4; docs/api/rally.md "A.C The cars"):
 * the two estates, the rival DE LAATSTE RIT, the traffic hatchback and the police estate — triangle
 * budgets, valid meshes (indices, uvs inside their pages, front faces outward), 4-bit pages with
 * ≤ 16 PAL_HD colours per CLUT row, deterministic builds, plausible sizes, anchors inside the body,
 * and the liveries' lettering present (and readable: never mirrored).
 */
import { describe, expect, it } from 'vitest';
import { PAL_HD } from '../../src/engine/palette-hd';
import { mat4Pose } from '../../src/engine/r3/mat';
import type { Mesh3, TexturePage } from '../../src/engine/view3d';
import { buildEstate } from '../../src/game/content/rally/models/estate';
import { buildHatch } from '../../src/game/content/rally/models/hatch';
import { buildHearse } from '../../src/game/content/rally/models/hearse';
import { RALLY_MODELS } from '../../src/game/content/rally/models/index';
import { carModelInfo, poseWheel, type RallyCarModel } from '../../src/game/content/rally/models/types';
import { S } from '../../src/game/content/rally/tex/car-palette';
import { CAR_TEXEL } from '../../src/game/content/rally/tex/car-sheet';
import { paintEstate } from '../../src/game/content/rally/tex/estate';
import { paintHearse } from '../../src/game/content/rally/tex/hearse';
import { HATCH_COLOURS } from '../../src/game/content/rally/tex/hatch';
import type { TexRect } from '../../src/game/content/rally/tex/kit';
import { glyphRows, letterWidth, type LetterSize } from '../../src/game/content/rally/tex/letters';
import { RALLY_MODEL } from '../../src/game/rally/ids';
import { listRallyModels, rallyModel } from '../../src/game/rally/registry';

const model = (id: string): RallyCarModel => {
  const m = carModelInfo(rallyModel(id));
  if (!m) throw new Error(`no car model ${id}`);
  return m;
};

const ALL = Object.values(RALLY_MODEL);

/** FNV-1a over the bytes of every array of the model (meshes and pages). */
function hashModel(m: RallyCarModel): string {
  let h = 0x811c9dc5;
  const feed = (a: ArrayBufferView): void => {
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 0x01000193) >>> 0;
  };
  for (const me of m.meshes) {
    for (const ch of me.id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    feed(me.pos);
    feed(me.uv);
    feed(me.rgb);
    if (me.nrm) feed(me.nrm);
    feed(me.idx);
  }
  for (const p of m.pages) {
    feed(p.index);
    feed(p.clut);
  }
  return h.toString(16);
}

/** Where `text` is painted in slot `slot` in `r` of the page (glyph cells exact, left to right), or null. */
function findText(page: TexturePage, r: TexRect, text: string, slot: number, size: LetterSize = 'small', gap = 1): { x: number; y: number } | null {
  // Ink cells must hold the slot, the glyphs' blank cells must not (a solid patch is no text).
  const cells: [number, number, boolean][] = [];
  let x = 0;
  for (const ch of text) {
    const rows = glyphRows(ch, size);
    rows.forEach((row, j) => [...row].forEach((c, i) => cells.push([x + i, j, c === '#'])));
    x += rows[0].length + gap;
  }
  const w = letterWidth(text, size, gap);
  for (let y0 = 0; y0 + (size === 'big' ? 6 : 5) <= r.h; y0++) {
    for (let x0 = 0; x0 + w <= r.w; x0++) {
      let ok = true;
      for (const [cx, cy, ink] of cells) {
        if ((page.index[(r.y + y0 + cy) * page.w + r.x + x0 + cx] === slot) !== ink) {
          ok = false;
          break;
        }
      }
      if (ok) return { x: x0, y: y0 };
    }
  }
  return null;
}

function hasText(page: TexturePage, r: TexRect, text: string, slot: number, size: LetterSize = 'small', gap = 1): boolean {
  return findText(page, r, text, slot, size, gap) !== null;
}

describe('the rally car models: registry and budgets', () => {
  it('registers one car model per RALLY_MODEL id', () => {
    expect(RALLY_MODELS.map((d) => d.id).sort()).toEqual([...ALL].sort());
    expect(listRallyModels()).toEqual([...ALL].sort());
    for (const id of ALL) expect(model(id).id).toBe(id);
  });

  it('keeps the triangle budgets (spec §7.3)', () => {
    const tris = (id: string): number => model(id).tris;
    for (const id of [RALLY_MODEL.white, RALLY_MODEL.green]) {
      expect(tris(id), id).toBeGreaterThanOrEqual(400);
      expect(tris(id), id).toBeLessThanOrEqual(600);
    }
    expect(tris(RALLY_MODEL.rival)).toBeGreaterThanOrEqual(300);
    expect(tris(RALLY_MODEL.rival)).toBeLessThanOrEqual(500);
    expect(tris(RALLY_MODEL.traffic)).toBeGreaterThanOrEqual(120);
    expect(tris(RALLY_MODEL.traffic)).toBeLessThanOrEqual(250);
    expect(tris(RALLY_MODEL.police)).toBeGreaterThanOrEqual(300);
    expect(tris(RALLY_MODEL.police)).toBeLessThanOrEqual(600);
    for (const id of ALL) {
      const m = model(id);
      // `tris` is what `parts` draws.
      const drawn = m.parts.reduce((n, p) => n + m.meshes.find((x) => x.id === p)!.idx.length / 3, 0);
      expect(drawn, id).toBe(m.tris);
      // The far version is far cheaper.
      expect(m.lod.tris, id).toBeLessThan(m.tris * 0.6);
      expect(m.lod.tris, id).toBeLessThanOrEqual(160);
    }
  });
});

describe('the rally car models: meshes', () => {
  const each = (f: (m: RallyCarModel, me: Mesh3) => void): void => {
    for (const id of ALL) {
      const m = model(id);
      for (const me of m.meshes) f(m, me);
    }
  };

  it('has valid arrays and indices, every mesh on its model page', () => {
    each((m, me) => {
      const n = me.pos.length / 3;
      expect(Number.isInteger(n), me.id).toBe(true);
      expect(me.uv.length, me.id).toBe(2 * n);
      expect(me.rgb.length, me.id).toBe(3 * n);
      expect(me.nrm!.length, me.id).toBe(3 * n);
      expect(me.idx.length % 3, me.id).toBe(0);
      expect(me.idx.length, me.id).toBeGreaterThan(0);
      for (const i of me.idx) expect(i < n, me.id).toBe(true);
      for (const v of me.pos) expect(Number.isFinite(v), me.id).toBe(true);
      expect(me.id.startsWith(`car/${m.id}/`), me.id).toBe(true);
      expect(m.pages.some((p) => p.id === me.page), me.id).toBe(true);
    });
  });

  it('keeps every uv inside its page (no wrap) and on CLUT row 0', () => {
    each((m, me) => {
      const p = m.pages.find((x) => x.id === me.page)!;
      for (let i = 0; i < me.uv.length; i += 2) {
        expect(me.uv[i] >= 0 && me.uv[i] <= p.w, `${me.id} u ${me.uv[i]}`).toBe(true);
        expect(me.uv[i + 1] >= 0 && me.uv[i + 1] <= p.h, `${me.id} v ${me.uv[i + 1]}`).toBe(true);
      }
      expect(me.clutRow, me.id).toBe(0);
    });
  });

  it('winds every triangle with its front along its normal (no culling holes)', () => {
    each((_m, me) => {
      const P = me.pos;
      const N = me.nrm!;
      for (let t = 0; t < me.idx.length; t += 3) {
        const [a, b, c] = [me.idx[t], me.idx[t + 1], me.idx[t + 2]];
        const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
        const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
        const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
        const area = Math.sqrt(cx * cx + cy * cy + cz * cz);
        expect(area, `${me.id} tri ${t / 3} is degenerate`).toBeGreaterThan(1e-9);
        expect(cx * N[a * 3] + cy * N[a * 3 + 1] + cz * N[a * 3 + 2], `${me.id} tri ${t / 3}`).toBeGreaterThan(0);
      }
    });
  });

  it('flags the parts: an opaque body, a subtractive shadow, additive emissive lamps', () => {
    for (const id of ALL) {
      const m = model(id);
      const mesh = (mid: string): Mesh3 => {
        const x = m.meshes.find((me) => me.id === mid);
        expect(x, mid).toBeDefined();
        return x!;
      };
      for (const p of [...m.parts, ...m.body, ...m.lod.parts, m.wheelsStatic]) mesh(p);
      expect(m.parts).toContain(m.wheelsStatic);
      expect(m.body).not.toContain(m.wheelsStatic);
      expect(mesh(`car/${id}/body`).blend).toBe('opaque');
      expect(mesh(`car/${id}/shadow`).blend).toBe('sub');
      const L = m.lights;
      const lamps = [L.head, L.tail, L.brake, L.indL, L.indR, ...(L.spots ? [L.spots] : []), ...(L.beacons ?? [])];
      for (const l of lamps) {
        expect(mesh(l).blend, l).toBe('add');
        expect(mesh(l).emissive, l).toBe(true);
        expect(m.parts).not.toContain(l);
      }
      for (const w of m.anchors.wheels) mesh(w.mesh);
    }
    expect(model(RALLY_MODEL.police).lights.beacons).toHaveLength(2);
    expect(model(RALLY_MODEL.white).lights.spots).toBeDefined();
    expect(model(RALLY_MODEL.green).lights.spots).toBeDefined();
  });
});

describe('the rally car models: pages', () => {
  const palette = new Set<number>(Object.values(PAL_HD).flatMap((r) => [...(r as readonly number[])].map((c) => c >>> 0)));

  it('paints 4-bit pages: indices < 16, ≤ 16 PAL_HD colours per CLUT row', () => {
    const ids = new Set<number>();
    for (const id of ALL) {
      const m = model(id);
      expect(m.pages).toHaveLength(1);
      const p = m.pages[0];
      expect(ids.has(p.id), `page ${p.id} shared`).toBe(false);
      ids.add(p.id);
      expect(p.id).toBeGreaterThanOrEqual(100);
      expect(p.id).toBeLessThan(200);
      expect(p.w).toBeLessThanOrEqual(256);
      expect(p.h).toBeLessThanOrEqual(256);
      for (const k of p.index) expect(k < 16).toBe(true);
      const rows = p.clut.length / 256;
      expect(rows, id).toBe(m.rows.length);
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < 16; k++) expect(palette.has(p.clut[r * 256 + k]), `${id} row ${r} slot ${k}`).toBe(true);
        for (let k = 16; k < 256; k++) expect(p.clut[r * 256 + k]).toBe(0);
      }
    }
  });

  it('gives the traffic car its colour rows, alike but for the paint', () => {
    const t = model(RALLY_MODEL.traffic);
    expect(t.rows).toEqual(HATCH_COLOURS.map((c) => c.name));
    expect(t.rows.length).toBeGreaterThanOrEqual(6);
    const p = t.pages[0];
    for (let r = 1; r < t.rows.length; r++) {
      for (let k = 3; k < 16; k++) expect(p.clut[r * 256 + k]).toBe(p.clut[k]);
      expect(p.clut[r * 256 + S.PAINT]).not.toBe(p.clut[S.PAINT]);
    }
  });

  it('builds the same models every time (a hash of meshes and pages)', () => {
    const a = [buildEstate('estate-white', 'white'), buildEstate('estate-green', 'green'), buildEstate('police', 'police'), buildHearse('rival'), buildHatch('traffic')];
    const b = [buildEstate('estate-white', 'white'), buildEstate('estate-green', 'green'), buildEstate('police', 'police'), buildHearse('rival'), buildHatch('traffic')];
    const ha = a.map(hashModel);
    expect(b.map(hashModel)).toEqual(ha);
    expect(new Set(ha).size).toBe(5);
    expect(hashModel(model(RALLY_MODEL.white))).toBe(ha[0]);
  });
});

describe('the rally car models: sizes and anchors', () => {
  it('has plausible sizes (the estate about 4.8 × 1.8 × 1.5 m)', () => {
    const size = (id: string): [number, number, number] => {
      const a = model(id).anchors;
      return [a.length, a.width, a.height];
    };
    for (const id of [RALLY_MODEL.white, RALLY_MODEL.green, RALLY_MODEL.police]) {
      const [l, w, h] = size(id);
      expect(l, id).toBeGreaterThan(4.6);
      expect(l, id).toBeLessThan(5.2);
      expect(w, id).toBeGreaterThan(1.7);
      expect(w, id).toBeLessThan(1.85);
      expect(h, id).toBeGreaterThan(1.4);
      expect(h, id).toBeLessThan(1.95);
    }
    const [hl, , hh] = size(RALLY_MODEL.rival);
    expect(hl).toBeGreaterThan(5.2);
    expect(hh).toBeLessThan(1.9);
    const [tl, tw] = size(RALLY_MODEL.traffic);
    expect(tl).toBeGreaterThan(3.5);
    expect(tl).toBeLessThan(4.2);
    expect(tw).toBeLessThan(1.75);
    // The bodies stay inside their boxes; the boxes stand on the road.
    for (const id of ALL) {
      const m = model(id);
      const b = m.anchors.box;
      expect(b.y0).toBe(0);
      const body = m.meshes.find((x) => x.id === `car/${id}/body`)!;
      for (let i = 0; i < body.pos.length; i += 3) {
        // Mirrors stick out sideways (outside the collision box, by design).
        expect(body.pos[i + 1] >= -1e-6 && body.pos[i + 1] <= b.y1 + 1e-6, `${id} y`).toBe(true);
        expect(body.pos[i + 2] >= b.z0 - 0.02 && body.pos[i + 2] <= b.z1 + 0.02, `${id} z ${body.pos[i + 2]}`).toBe(true);
        expect(Math.abs(body.pos[i]) <= 1.06, `${id} x`).toBe(true);
      }
    }
  });

  it('puts the anchors inside the body: wheels on the road, lamps at the ends, the bumper camera up front', () => {
    for (const id of ALL) {
      const a = model(id).anchors;
      const b = a.box;
      expect(a.wheels).toHaveLength(4);
      const [fl, fr, rl, rr] = a.wheels;
      expect([fl.front, fr.front, rl.front, rr.front]).toEqual([true, true, false, false]);
      expect([fl.left, fr.left, rl.left, rr.left]).toEqual([true, false, true, false]);
      for (const w of a.wheels) {
        expect(w.y - w.r, id).toBeCloseTo(0, 6);
        expect(Math.abs(w.x) + w.width / 2, id).toBeLessThanOrEqual(b.x1 + 1e-6);
        expect(w.z - w.r, id).toBeGreaterThan(b.z0);
        expect(w.z + w.r, id).toBeLessThan(b.z1);
        expect(w.left ? w.x : -w.x, id).toBeGreaterThan(0);
      }
      expect(a.wheelbase, id).toBeCloseTo(fl.z - rl.z, 6);
      expect(a.track, id).toBeCloseTo(fl.x - fr.x, 6);
      const inside = (p: readonly number[], tol = 0.05): boolean => p[0] >= b.x0 - tol && p[0] <= b.x1 + tol && p[1] >= b.y0 && p[1] <= b.y1 + tol && p[2] >= b.z0 - tol && p[2] <= b.z1 + tol;
      for (const k of ['head', 'tail', 'brake', 'indL', 'indR', 'spots', 'beacons'] as const) for (const p of a.lamps[k]) expect(inside(p), `${id} ${k}`).toBe(true);
      for (const p of a.lamps.head) expect(p[2], id).toBeGreaterThan(0);
      for (const p of [...a.lamps.tail, ...a.lamps.brake]) expect(p[2], id).toBeLessThan(0);
      for (const p of a.lamps.indL) expect(p[0], id).toBeGreaterThan(0);
      for (const p of a.lamps.indR) expect(p[0], id).toBeLessThan(0);
      expect(inside(a.bumperCam, 0), id).toBe(true);
      expect(a.bumperCam[2], id).toBeGreaterThan(fl.z);
      expect(a.bumperCam[1], id).toBeGreaterThan(0.8);
    }
  });

  it('poses a wheel: the car matrix · the anchor · steer · spin (+ spin rolls the top forward)', () => {
    const w = model(RALLY_MODEL.white).anchors.wheels[0];
    const car = mat4Pose(new Float32Array(16), 10, 0, 20, 0);
    const m = poseWheel(new Float32Array(16), car, w, 0, 0);
    expect(m[12]).toBeCloseTo(10 + w.x, 5);
    expect(m[13]).toBeCloseTo(w.y, 5);
    expect(m[14]).toBeCloseTo(20 + w.z, 5);
    // A quarter turn of spin: the wheel's local up (0, 1, 0) points forward (+z).
    const s = poseWheel(new Float32Array(16), car, w, 0, Math.PI / 2);
    expect(s[4]).toBeCloseTo(0, 4);
    expect(s[5]).toBeCloseTo(0, 4);
    expect(s[6]).toBeCloseTo(1, 4);
    // Steer + = left: the wheel's forward (0, 0, 1) turns toward +x.
    const t = poseWheel(new Float32Array(16), car, w, 0.3, 0);
    expect(t[8]).toBeGreaterThan(0.25);
  });
});

describe('the rally car models: liveries and lettering', () => {
  it('letters the white estate: ROZZERS and 619 on both sides, readable from outside', () => {
    const { sheet: sh, page } = paintEstate('white');
    for (const r of [sh.sideL, sh.sideR]) {
      expect(hasText(page, r, 'ROZZERS', S.PAINT_L)).toBe(true);
      expect(hasText(page, r, '619', S.PAINT_L)).toBe(true);
      // Mirrored lettering would not match the glyphs.
      expect(hasText(page, r, 'SREZZOR', S.PAINT_L)).toBe(false);
    }
    // The left side has the nose at its texture's left (619 on the front wing comes before ROZZERS),
    // the right side at its right.
    const at = (r: TexRect, s: string): number => findText(page, r, s, S.PAINT_L)?.x ?? -1;
    expect(at(sh.sideL, '619')).toBeLessThan(at(sh.sideL, 'ROZZERS'));
    expect(at(sh.sideR, '619')).toBeGreaterThan(at(sh.sideR, 'ROZZERS'));
  });

  it('letters the green estate: ARTISANAL / GRAPE on the right, MAJOR / COCKTAILS on the left', () => {
    const { sheet: sh, page } = paintEstate('green');
    expect(hasText(page, sh.sideR, 'ARTISANAL', S.ACC_B, 'small', 2)).toBe(true);
    expect(hasText(page, sh.sideR, 'GRAPE', S.ACC_B, 'small', 2)).toBe(true);
    expect(hasText(page, sh.sideL, 'MAJOR', S.ACC_A, 'big')).toBe(true);
    expect(hasText(page, sh.sideL, 'COCKTAILS', S.ACC_A)).toBe(true);
    expect(hasText(page, sh.sideL, 'ARTISANAL', S.ACC_B, 'small', 2)).toBe(false);
  });

  it('letters the police estate (POLITIE, STOP POLITIE) and the hearse (DE LAATSTE RIT on the sides and the roof)', () => {
    const { sheet: sh, page } = paintEstate('police');
    expect(hasText(page, sh.sideL, 'POLITIE', S.PAINT_L, 'small', 2)).toBe(true);
    expect(hasText(page, sh.sideR, 'POLITIE', S.PAINT_L, 'small', 2)).toBe(true);
    expect(hasText(page, sh.extra.display, 'STOP POLITIE', S.RED)).toBe(true);
    expect(hasText(page, sh.back, 'POLITIE', S.ACC_A)).toBe(true);
    const h = paintHearse();
    for (const r of [h.sheet.sideL, h.sheet.sideR]) expect(hasText(h.page, r, 'DE LAATSTE RIT', S.PLATE)).toBe(true);
    expect(hasText(h.page, h.sheet.top, 'DE LAATSTE', S.PLATE)).toBe(true);
    expect(hasText(h.page, h.sheet.top, 'RIT', S.PLATE)).toBe(true);
  });

  it('puts made-up yellow plates front and back, and a consistent texel density', () => {
    for (const kind of ['white', 'green', 'police'] as const) {
      const { sheet: sh, page } = paintEstate(kind);
      for (const r of [sh.plateF, sh.plateB]) {
        let yellow = 0;
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (page.index[(r.y + y) * page.w + r.x + x] === S.PLATE) yellow++;
        expect(yellow).toBeGreaterThan(r.w * r.h * 0.4);
      }
      expect(sh.D).toBe(CAR_TEXEL);
    }
    expect(CAR_TEXEL).toBe(32);
  });
});
