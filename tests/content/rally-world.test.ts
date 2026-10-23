/**
 * WORLD (rally wave B; docs/design/rally.md §3, §4, §7; docs/api/rally.md "B.W"): the ten sections
 * have their landmarks, no texture carries a real company name, every matrix-sign state renders
 * and follows the sign table, the time of day is continuous and its clock monotonic, the pages keep
 * the palette rules, the build is deterministic, and the culled triangles per view stay within the
 * budget along the whole lap (1P and 2P).
 */
import { describe, expect, it } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { atan2T } from '../../src/engine/r3/trig';
import { NullView3d, type Cam3, type DrawItem, type Mesh3, type TexturePage } from '../../src/engine/view3d';
import { buildSections } from '../../src/game/content/rally/sections/index';
import { POOL_CELLS } from '../../src/game/content/rally/sections/pieces';
import { BILLBOARD_ADS, PLATES, worldTexts } from '../../src/game/content/rally/sections/pages';
import { buildSigns } from '../../src/game/content/rally/signs/index';
import { LED } from '../../src/game/content/rally/signs/page';
import { buildSky, CLOUD_Y } from '../../src/game/content/rally/sky/index';
import { buildCarLights, carGlowMesh, carPoolMesh, POOL_LEN, POOL_X, POOL_Z } from '../../src/game/content/rally/lights/cars';
import { glowLevel } from '../../src/game/content/rally/lights/page';
import { buildA10, A10_TABLE, type A10Track } from '../../src/game/content/rally/track/index';
import { trackTex } from '../../src/game/content/rally/track/tex-road';
import { CLOCK_START, DAY_KEYS, daylight, newDaylight, sunAt, type Daylight } from '../../src/game/rally/daylight';
import { rallyModel, type RallyDrawCtx, type RallyScenery } from '../../src/game/rally/registry';
import { SIGN_STATES, SignTable } from '../../src/game/rally/signs';
import { carModelInfo } from '../../src/game/content/rally/models/types';
import '../../src/game/content/rally/models/index';

const track = buildA10(A10_TABLE) as A10Track;
const world = buildSections(track);
const signs = buildSigns(track);
const sky = buildSky(track);

/** A chase camera behind the racing line at s (as the track's own budget test). */
function chaseCam(s: number, fovDeg: number): Cam3 {
  const q = track.sample(s);
  const side = track.racingAt(s);
  return {
    pos: [q.pos[0] + q.right[0] * side - q.fwd[0] * 6.3, q.pos[1] + 2.3, q.pos[2] + q.right[2] * side - q.fwd[2] * 6.3],
    yaw: atan2T(q.fwd[0], q.fwd[2]),
    pitch: -0.12,
    roll: 0,
    fovY: (fovDeg * Math.PI) / 180,
    near: 0.5,
    far: 600,
  };
}

function ctxOf(cam: Cam3, aspect: number, day: Daylight, table: SignTable | null = null, t = 0): RallyDrawCtx {
  const runner = { race: { signs: table }, cars: [], bodies: [], roster: 0 } as unknown as RallyDrawCtx['runner'];
  return { runner, view: 0, cam, aspect, far: day.light.fogFar, day, t, v3: new NullView3d() };
}

const trisOf = (meshes: readonly Mesh3[]): Map<string, number> => new Map(meshes.map((m) => [m.id, m.idx.length / 3]));

describe('the sections (spec §3)', () => {
  it('every section has its landmarks (TRACK’s anchors), 26 in all', () => {
    const lm = world.report.landmarks;
    for (const sec of track.sections) {
      const want = track.landmarks.filter((l) => track.sections[l.section].id === sec.id).map((l) => l.id);
      expect(want.length).toBeGreaterThan(0);
      for (const id of want) expect(lm[sec.id]).toContain(id);
    }
    expect(Object.values(lm).flat().length).toBe(track.landmarks.length);
  });

  it('dresses the whole ring: geometry in every section, animated rotors and the metro', () => {
    for (const sec of track.sections) {
      const mid = track.sample((sec.s0 + sec.s1) / 2);
      const near = world.cells.filter((c) => Math.abs((c.x0 + c.x1) / 2 - mid.pos[0]) < 450 && Math.abs((c.z0 + c.z1) / 2 - mid.pos[2]) < 450);
      expect(near.length, sec.id).toBeGreaterThan(0);
    }
    expect(world.report.anims.filter((a) => a.kind === 'rotor').length).toBe(5);
    expect(world.report.anims.filter((a) => a.kind === 'train').length).toBe(1);
    expect(world.layerTris.facade).toBeGreaterThan(1500);
    expect(world.layerTris.cut).toBeGreaterThan(2000);
  });

  it('a test track gets empty parts', () => {
    const fake = { id: 'oval', length: 100 } as unknown as A10Track;
    expect(buildSections(fake).meshes).toHaveLength(0);
    expect(buildSigns(fake).meshes).toHaveLength(0);
  });

  it('is deterministic: two builds give the same bytes', () => {
    const again = buildSections(track);
    const hash = (ms: readonly Mesh3[]): number => {
      let h = 2166136261;
      for (const m of ms) for (const a of [m.pos, m.uv, m.idx]) for (let i = 0; i < a.length; i += 7) h = Math.imul(h ^ Math.round(a[i] * 64), 16777619);
      return h >>> 0;
    };
    expect(hash(again.meshes)).toBe(hash(world.meshes));
  });

  it("the lamps' road pools are small cells (the affine warp smeared one big quad across the lanes)", () => {
    // Fixer (wave C review): pieces.ts pool() cuts each 8 × 12 m pool into POOL_CELLS (4 × 6).
    expect(POOL_CELLS[0] * POOL_CELLS[1]).toBeGreaterThanOrEqual(24);
    let n = 0, worst = 0;
    for (const m of world.meshes) {
      if (!m.id.includes('/pool')) continue;
      for (let t = 0; t < m.idx.length; t += 3 * 4) {
        const v = [m.idx[t] * 3, m.idx[t + 1] * 3, m.idx[t + 2] * 3];
        const cx = (m.pos[v[0]] + m.pos[v[1]] + m.pos[v[2]]) / 3, cz = (m.pos[v[0] + 2] + m.pos[v[1] + 2] + m.pos[v[2] + 2]) / 3;
        const q = track.sample(track.spline.nearest(cx, cz));
        const lat = (cx - q.pos[0]) * q.right[0] + (cz - q.pos[2]) * q.right[2];
        if (lat < -23 || lat > 7.4) continue; // off the road (the pitches' floodlight pools)
        n++;
        for (let k = 0; k < 3; k++) {
          const a = v[k], b = v[(k + 1) % 3];
          worst = Math.max(worst, Math.hypot(m.pos[a] - m.pos[b], m.pos[a + 2] - m.pos[b + 2]));
        }
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(worst).toBeLessThan(3.2);
  });

  it('nothing stands on the road: no scenery vertex within the carriageways', () => {
    // Sample the world-space meshes (not the animated parts in their own space, not the glows; the
    // decks that cross over stand 9 m or more above the road).
    let bad = 0;
    for (const m of world.meshes) {
      if (m.id.endsWith('/far') || m.id.includes('/pool') || m.id.includes('/glow') || m.id === 'scenery/w/rotor' || m.id === 'scenery/w/train') continue;
      for (let i = 0; i < m.pos.length; i += 3 * 5) {
        const x = m.pos[i], y = m.pos[i + 1], z = m.pos[i + 2];
        const s = track.spline.nearest(x, z);
        const q = track.sample(s);
        const lat = (x - q.pos[0]) * q.right[0] + (z - q.pos[2]) * q.right[2];
        const dx = x - q.pos[0], dz = z - q.pos[2];
        const along = Math.abs(dx * q.fwd[0] + dz * q.fwd[2]);
        if (along < 2 && lat > -23 && lat < 7.4 && y < q.pos[1] + 7 && y > q.pos[1] + 0.2 && Math.abs(lat + 7.8) > 0.6) bad++;
      }
    }
    expect(bad).toBe(0);
  });
});

describe('the textures (spec §7.4, §11)', () => {
  /** Real company names that must never appear on a building, a billboard or a plate. */
  const BRANDS = ['SHELL', 'ESSO', 'TEXACO', 'ING', 'ABN', 'AMRO', 'RABO', 'PHILIPS', 'HEINEKEN', 'KLM', 'HEIJN', 'HEMA', 'GVB', 'NS', 'RAI', 'IKEA', 'MCDONALD', 'COCA', 'COLA', 'BOOKING', 'ADYEN', 'ASML', 'AKZO', 'TOMTOM', 'ZIGGO', 'KPN', 'VODAFONE', 'UNILEVER', 'AEGON', 'DELOITTE', 'KPMG', 'NIKE', 'SONY', 'SAMSUNG', 'VOLVO', 'FORD', 'TOYOTA'];
  const words = (s: string): string[] => s.split(/[^A-Z0-9]+/).filter(Boolean);

  it('no building, billboard or plate text contains a real company name', () => {
    const texts = worldTexts();
    expect(texts.length).toBe(BILLBOARD_ADS.length * 2 + PLATES.length);
    for (const t of texts) for (const w of words(t)) expect(BRANDS, t).not.toContain(w);
  });

  it('the road signs carry real place names and our own boards only', () => {
    const tex = signs.tex!;
    // 'RAI' is the real S-exit's place name on a road sign (allowed: the A10 exception); no other brand.
    for (const t of tex.texts) for (const w of words(t)) if (w !== 'RAI') expect(BRANDS, t).not.toContain(w);
    for (const e of track.exits) expect(tex.exits.has(e.code), e.code).toBe(true);
  });

  it('every page: ≤ 256², 16-colour banks of PAL_HD tones (the glows add from black)', () => {
    const pages: TexturePage[] = [...world.pages, ...signs.pages, ...sky.pages, trackTex().page];
    for (const p of pages) {
      expect(p.w).toBeLessThanOrEqual(256);
      expect(p.h).toBeLessThanOrEqual(256);
      for (let i = 0; i < p.clut.length; i++) {
        const c = p.clut[i];
        if (c === 0) continue;
        if (p.id === 302 && i % 256 === 0) expect(c >>> 0).toBe(0x000000ff);
        else expect(inHdPalette(c), `page ${p.id} entry ${i}`).toBe(true);
      }
      // A 4-bit texture never mixes banks: every texel row of the page stays inside 16 entries per strip.
      expect(p.index.length).toBe(p.w * p.h);
    }
  });

  it('the road page keeps its layout (lead note 2a–2c: repainted in place)', () => {
    const t = trackTex();
    expect([t.road.x, t.roadBlock.x, t.concrete.x, t.grass.x, t.tiles.x, t.rail.x, t.lamp.x]).toEqual([0, 48, 96, 128, 160, 192, 208]);
    // The asphalt: three close greys (no texel of the road strip is darker than the tar seam or lighter than the worn line, but the lines).
    const lum = (c: number): number => ((c >>> 24) & 255) * 0.3 + ((c >>> 16) & 255) * 0.59 + ((c >>> 8) & 255) * 0.11;
    const base = lum(t.page.clut[1]);
    for (const i of [2, 3]) expect(Math.abs(lum(t.page.clut[i]) - base)).toBeLessThan(20);
  });
});

describe('the matrix signs (spec §5; B.2)', () => {
  it('every state has its face on the sign page, each lit but the blank', () => {
    const tex = signs.tex!;
    for (const st of SIGN_STATES) {
      const r = tex.faces[st];
      expect(r.w).toBe(LED);
      let lit = 0;
      for (let y = 2; y < LED - 2; y++) for (let x = 2; x < LED - 2; x++) if (tex.page.index[(r.y + y) * tex.page.w + r.x + x] > 2) lit++;
      if (st === 'blank') expect(lit).toBe(0);
      else expect(lit, st).toBeGreaterThan(20);
    }
  });

  it('the gantries carry one dynamic face mesh each; the faces follow the table', () => {
    const matrix = track.gantries.filter((g) => g.kind !== 'exit').length;
    expect(signs.leds.length).toBe(matrix);
    const table = new SignTable(track.gantries.length);
    const g = signs.leds[1];
    const before = Array.from(g.mesh.uv);
    table.setSign(g.g, 0, 'x');
    const day = daylight(0);
    const out: DrawItem[] = [];
    const s = track.gantries[g.g].s;
    signs.fill(ctxOf(chaseCam(s - 60, 65), 384 / 216, day, table), out, 0);
    const after = Array.from(g.mesh.uv);
    expect(after).not.toEqual(before);
    const r = signs.tex!.faces.x;
    expect(after[0]).toBeCloseTo(r.x + 0.02, 5);
    expect(out.some((it) => it.mesh === g.mesh.id)).toBe(true);
  });

  it('the exit gantries carry the blue panel of their S-exit', () => {
    expect(track.gantries.filter((g) => g.kind === 'exit').length).toBe(3);
    expect(signs.tex!.exits.get('S104')).toBeTruthy();
  });
});

describe('the time of day (spec §4; B.1)', () => {
  it('continuous, the clock monotonic, the fog the sky’s bottom, the sun sets in lap 2', () => {
    let prev = daylight(0);
    let prevClock = prev.clock;
    const d = newDaylight();
    const keys = (L: Daylight['light']): number[] => [...L.sun, ...L.ambient, ...L.fog, ...L.skyTop, ...L.skyBottom, L.fogNear / 100, L.fogFar / 100];
    let last = keys(prev.light);
    for (let p = 0.01; p <= 3.0001; p += 0.01) {
      daylight(p, d);
      expect(d.clock).toBeGreaterThan(prevClock);
      prevClock = d.clock;
      const k = keys(d.light);
      for (let i = 0; i < k.length; i++) expect(Math.abs(k[i] - last[i]), `p ${p.toFixed(2)} key ${i}`).toBeLessThan(0.03);
      last = k;
      expect(d.light.fog).toEqual(d.light.skyBottom);
    }
    expect(daylight(0).clock).toBe(CLOCK_START);
    expect(sunAt(0)[1]).toBeGreaterThan(0.15);
    expect(sunAt(1)[1]).toBeGreaterThan(-0.02);
    expect(sunAt(1.4)[1]).toBeLessThan(0);
    // The sight shortens a little in the dark (the fog's far end).
    expect(daylight(3).light.fogFar).toBeLessThan(daylight(0).light.fogFar);
    for (const k of DAY_KEYS) expect(k.fogFar).toBeGreaterThanOrEqual(300);
  });

  it('the lamps come on in lap 2 (glow levels), the sun sprite only in daylight', () => {
    expect(glowLevel(daylight(0).lampGlow)).toBe(-1);
    expect(glowLevel(daylight(1.2).lampGlow)).toBeGreaterThanOrEqual(0);
    expect(glowLevel(daylight(2).lampGlow)).toBe(3);
    const out: DrawItem[] = [];
    const n0 = sky.fill(ctxOf(chaseCam(500, 65), 384 / 216, daylight(0.2)), out, 0);
    expect(out.slice(0, n0).some((it) => it.mesh.startsWith('sky/sun'))).toBe(true);
    const n3 = sky.fill(ctxOf(chaseCam(500, 65), 384 / 216, daylight(2.5)), out, 0);
    expect(out.slice(0, n3).some((it) => it.mesh.startsWith('sky/sun'))).toBe(false);
    expect(CLOUD_Y).toBeGreaterThan(96);
  });

  it('the car lights: a glow mesh (head and tail halos) and a pool mesh per model', () => {
    const info = carModelInfo(rallyModel('estate-white'));
    expect(info).toBeTruthy();
    const m = carGlowMesh('fx/carglow/test', info!);
    expect(m.blend).toBe('add');
    expect(m.idx.length / 3).toBe((info!.anchors.lamps.head.length + info!.anchors.lamps.tail.length) * 2);
    // Wave C (lead polish 3a): the pool is its own mesh, small cells (the affine warp of big near
    // cells smeared it sideways), inside the lane ahead of the nose, facing up.
    const p = carPoolMesh('fx/carpool/test', info!);
    expect(p.blend).toBe('add');
    expect(p.idx.length / 3).toBe(POOL_X * POOL_Z * 2);
    let minZ = Infinity, maxX = 0;
    for (let i = 0; i < p.pos.length; i += 3) {
      minZ = Math.min(minZ, p.pos[i + 2]);
      maxX = Math.max(maxX, Math.abs(p.pos[i]));
    }
    expect(minZ).toBeGreaterThan(info!.anchors.box.z1);
    expect(maxX).toBeLessThanOrEqual(1.75);
    // Facing up: every triangle's normal has +y.
    for (let t = 0; t < p.idx.length; t += 3) {
      const [a, b, c] = [p.idx[t] * 3, p.idx[t + 1] * 3, p.idx[t + 2] * 3];
      const ux = p.pos[b] - p.pos[a], uz = p.pos[b + 2] - p.pos[a + 2];
      const vx = p.pos[c] - p.pos[a], vz = p.pos[c + 2] - p.pos[a + 2];
      expect(uz * vx - ux * vz).toBeGreaterThan(0);
    }
    expect(POOL_LEN).toBeGreaterThan(15);
    expect(buildCarLights(track).meshes).toHaveLength(0);
  });
});

describe('the budget per view along the lap (spec §7.3; lead: up to 10,000 where the look needs it)', () => {
  const parts: RallyScenery[] = [sky, world, signs];
  const tris = new Map<string, number>([...trisOf(track.meshes), ...trisOf(world.meshes), ...trisOf(signs.meshes), ...trisOf(sky.meshes)]);
  const measure = (fov: number, aspect: number, p: number): { max: number; avg: number; maxDraws: number } => {
    const view = track.createView();
    const out: DrawItem[] = [];
    let max = 0, sum = 0, maxDraws = 0;
    const day = daylight(p);
    const N = 40;
    for (let i = 0; i < N; i++) {
      const s = (i + 0.5) * (track.length / N);
      const cam = chaseCam(s, fov);
      let k = view.fill(cam, aspect, day.light.fogFar, out, 0);
      const ctx = ctxOf(cam, aspect, day, null, i);
      for (const part of parts) k = part.fill(ctx, out, k);
      let t = 0;
      for (let j = 0; j < k; j++) t += tris.get(out[j].mesh) ?? 0;
      max = Math.max(max, t);
      sum += t;
      maxDraws = Math.max(maxDraws, k);
    }
    return { max, avg: sum / N, maxDraws };
  };

  it('1P by day and by night: ≤ 10,000 triangles and ≤ 150 draws per view', () => {
    const d = measure(65, 384 / 216, 0.2);
    const n = measure(65, 384 / 216, 2.5);
    expect(d.max).toBeLessThanOrEqual(10000);
    expect(n.max).toBeLessThanOrEqual(10000);
    expect(Math.max(d.maxDraws, n.maxDraws)).toBeLessThanOrEqual(150);
  });

  it('2P (a 384 × 108 view): ≤ 10,000 triangles and ≤ 150 draws per view', () => {
    const n = measure(38, 384 / 108, 2.5);
    expect(n.max).toBeLessThanOrEqual(10000);
    expect(n.maxDraws).toBeLessThanOrEqual(150);
  });
});
