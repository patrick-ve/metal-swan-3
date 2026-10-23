/**
 * npm run rally-map -- [--out tmp/rally-map.png] [--scale 0.5] [--page tmp/rally-page.png]
 *
 * A top-down map of the compressed A10 (docs/design/rally.md §3; docs/api/rally.md "A.T The track"),
 * built from THE TABLE by the same code the race uses (content/rally/track): north up (x = east,
 * z = south), the race clockwise. It shows the sections (alternating colours, their names), the
 * tunnels (the tube dark, the ramps brown), the bridges (blue) and viaducts (cyan), the embankments,
 * the racing line, the gantries (white bars; the start in gold), the speed cameras (red), the
 * average-speed zone (purple), the road works of lap 2 (orange), the spitsstrook of lap 3 (green),
 * the S-exits, the landmark anchors, the grid, and below it the elevation profile of the lap.
 * `--page` also writes the track's texture page (CLUT row 0) as a PNG. Prints a JSON summary.
 */
import { drawText } from '../src/engine/font';
import { PixelBuffer } from '../src/engine/pixel';
import type { Color } from '../src/engine/color';
import { buildA10, A10_TABLE, TF, trackSample, type A10Track } from '../src/game/content/rally/track/index';
import { trackTex } from '../src/game/content/rally/track/tex-road';
import { pageToPixels } from '../src/game/content/rally/tex/kit';
import { savePNG } from './lib/image';

interface Args {
  out: string;
  scale: number;
  page: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { out: 'tmp/rally-map.png', scale: 0.5, page: null };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const v = argv[i + 1];
    if (s === '--out' && v) (a.out = v), i++;
    else if (s === '--scale' && v) (a.scale = Math.max(0.1, Math.min(4, Number(v) || 0.5))), i++;
    else if (s === '--page' && v) (a.page = v), i++;
    else throw new Error(`unknown argument ${s}\nusage: npm run rally-map -- [--out tmp/rally-map.png] [--scale 0.5] [--page tmp/rally-page.png]`);
  }
  return a;
}

const COL = {
  bg: 0x1b2230ff,
  grid: 0x232c3dff,
  secA: 0x9aa3adff,
  secB: 0x6f7883ff,
  tube: 0x2a1d10ff,
  lamp: 0xff9f31ff,
  cutting: 0x85583cff,
  bridge: 0x4a8fd4ff,
  viaduct: 0x5cecffff,
  raised: 0xd5c9b8ff,
  racing: 0xf6c537ff,
  gantry: 0xf1f3eeff,
  start: 0xf6c537ff,
  camera: 0xf06045ff,
  avg: 0x9467bdff,
  roadworks: 0xff9f31ff,
  spits: 0x73b143ff,
  exit: 0x66a6e1ff,
  landmark: 0xe66aa6ff,
  text: 0xf1f3eeff,
  dim: 0x8694a6ff,
  grid8: 0xffffffff,
} as const satisfies Record<string, Color>;

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const track: A10Track = buildA10(A10_TABLE);
  const ms = Date.now() - t0;
  const k = args.scale;
  const smp = trackSample();
  // Bounds of the centre line.
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let s = 0; s < track.length; s += 5) {
    track.sample(s, smp);
    x0 = Math.min(x0, smp.pos[0]);
    x1 = Math.max(x1, smp.pos[0]);
    z0 = Math.min(z0, smp.pos[2]);
    z1 = Math.max(z1, smp.pos[2]);
  }
  const pad = 140;
  const mapW = Math.ceil((x1 - x0) * k) + pad * 2;
  const mapH = Math.ceil((z1 - z0) * k) + pad * 2;
  const profH = 150;
  const W = Math.max(mapW, 900);
  const H = mapH + profH + 40;
  const buf = new PixelBuffer(W, H);
  buf.fill(COL.bg);
  const px = (x: number): number => Math.round((x - x0) * k + pad);
  const pz = (z: number): number => Math.round((z - z0) * k + pad);
  // A 500 m grid.
  for (let gx = Math.ceil(x0 / 500) * 500; gx <= x1; gx += 500) buf.vline(px(gx), 0, mapH - 1, COL.grid);
  for (let gz = Math.ceil(z0 / 500) * 500; gz <= z1; gz += 500) buf.hline(0, W - 1, pz(gz), COL.grid);
  drawText(buf, 'N', W - 24, 8, { color: COL.text });
  buf.vline(W - 22, 18, 40, COL.text);

  const at = (s: number, side: number): [number, number] => {
    track.sample(s, smp);
    return [px(smp.pos[0] + smp.right[0] * side), pz(smp.pos[2] + smp.right[2] * side)];
  };
  const band = (s0: number, s1: number, side0: number, side1: number, c: Color, step = 2): void => {
    const len = s1 >= s0 ? s1 - s0 : s1 + track.length - s0;
    for (let d = 0; d <= len; d += step) {
      const [ax, ay] = at(s0 + d, side0);
      const [bx, by] = at(s0 + d, side1);
      buf.line(ax, ay, bx, by, c);
    }
  };
  // The road by section, then the flags over it.
  track.sections.forEach((sec, i) => band(sec.s0, sec.s1, -23, 7.5, i % 2 ? COL.secB : COL.secA, 1));
  for (let s = 0; s < track.length; s += 2) {
    const f = track.flagsAt(s);
    if (f & TF.tunnel) band(s, s + 2, -23, 7.5, COL.tube, 1);
    else if (f & TF.cutting) band(s, s + 2, -23, 7.5, COL.cutting, 1);
    else if (f & TF.bridge) band(s, s + 2, -26, 10, COL.bridge, 1);
    else if (f & TF.viaduct) band(s, s + 2, -26, 10, COL.viaduct, 1);
    else if (f & TF.raised) band(s, s + 2, -26, -23, COL.raised, 1), band(s, s + 2, 7.5, 10, COL.raised, 1);
  }
  // The tunnels' lamp rows (a dotted centre).
  for (const tu of track.tunnels) for (let s = tu.s0; s < tu.s1; s += 12) band(s, s + 4, -8, -7, COL.lamp, 1);
  // Lap events beside the road: the spitsstrook (inside, green), road works (orange), the
  // average-speed zone (purple, outside).
  const sideBar = (r: { s0: number; s1: number }, a: number, b: number, c: Color): void => band(r.s0, r.s1, a, b, c, 1);
  for (const r of track.spits) sideBar(r, 14, 22, COL.spits);
  for (const r of track.roadworks) sideBar(r, 24, 34, COL.roadworks);
  sideBar(track.avgZone, -44, -34, COL.avg);
  // The racing line.
  for (let s = 0; s < track.length; s += 3) {
    const [ax, ay] = at(s, track.racingAt(s));
    buf.set(ax, ay, COL.racing);
  }
  // Gantries (bars across), cameras (dots), exits (labels), landmarks (squares), the grid.
  for (const g of track.gantries) {
    const [ax, ay] = at(g.s, -12);
    const [bx, by] = at(g.s, 12);
    buf.thickLine(ax, ay, bx, by, 2, g.kind === 'start' ? COL.start : g.kind.startsWith('avg') ? COL.avg : COL.gantry);
  }
  for (const c of track.cameras) {
    const [cx, cy] = at(c.s, c.side + 14);
    buf.circle(cx, cy, 4, COL.camera);
  }
  for (const e of track.exits) {
    const [ex, ey] = at(e.s, 60);
    buf.rect(ex - 1, ey - 1, 3, 3, COL.exit);
    drawText(buf, e.name ? `${e.code} ${e.name}` : e.code, ex + 4, ey - 3, { color: COL.exit });
  }
  for (const l of track.landmarks) {
    const [lx, ly] = at(l.s, l.side);
    buf.strokeRect(lx - 3, ly - 3, 7, 7, COL.landmark);
  }
  for (const g of track.grid) {
    const [gx, gy] = at(g.s, g.side);
    buf.set(gx, gy, COL.grid8);
  }
  // Section names (on the inside of the ring) and the tunnel / deck names (outside).
  track.sections.forEach((sec) => {
    const mid = (sec.s0 + sec.s1) / 2;
    const [sx, sy] = at(mid, 120);
    drawText(buf, sec.name, sx - 20, sy - 3, { color: COL.text });
  });
  for (const tu of track.tunnels) {
    const [tx, ty] = at((tu.s0 + tu.s1) / 2, -110);
    drawText(buf, tu.name, tx - 30, ty, { color: COL.lamp });
  }
  for (const b of track.bridges) {
    const [bx, by] = at((b.s0 + b.s1) / 2, -80);
    drawText(buf, b.name, bx - 20, by, { color: b.kind === 'bridge' ? COL.bridge : COL.viaduct });
  }
  const [fx, fy] = at(track.finish.s, -50);
  drawText(buf, 'START / FINISH', fx - 30, fy - 10, { color: COL.start });
  // The legend.
  const legend: [string, Color][] = [
    ['TUNNEL TUBE', COL.tube],
    ['TUNNEL RAMP', COL.cutting],
    ['BRIDGE', COL.bridge],
    ['VIADUCT', COL.viaduct],
    ['EMBANKMENT', COL.raised],
    ['RACING LINE', COL.racing],
    ['GANTRY', COL.gantry],
    ['FLITSPAAL', COL.camera],
    ['TRAJECTCONTROLE', COL.avg],
    ['WERK LAP 2', COL.roadworks],
    ['SPITSSTROOK LAP 3', COL.spits],
    ['S-EXIT', COL.exit],
    ['LANDMARK', COL.landmark],
  ];
  legend.forEach(([name, c], i) => {
    buf.rect(8, 8 + i * 11, 8, 8, c);
    drawText(buf, name, 20, 8 + i * 11, { color: COL.text });
  });
  drawText(buf, `A10 ${(track.length / 1000).toFixed(2)} KM  ${track.segments.length} SEGMENTS  ${track.trisTotal} TRIS`, 8, mapH - 14, { color: COL.dim });

  // The elevation profile (−10 … +8 m) over the lap, the sections marked.
  const py0 = mapH + 20;
  const yOf = (h: number): number => Math.round(py0 + profH / 2 - h * (profH / 2 / 10));
  buf.rect(0, py0 - 8, W, profH + 16, 0x151a24ff);
  buf.hline(0, W - 1, yOf(0), COL.grid);
  const sx = (s: number): number => Math.round(8 + (s / track.length) * (W - 16));
  for (const sec of track.sections) {
    buf.vline(sx(sec.s0), py0, py0 + profH, COL.grid);
    drawText(buf, sec.name, sx(sec.s0) + 2, py0, { color: COL.dim });
  }
  let prevY = yOf(0);
  for (let s = 0; s < track.length; s += track.length / (W - 16)) {
    track.sample(s, smp);
    const y = yOf(smp.pos[1]);
    const f = track.flagsAt(s);
    const c = f & TF.tunnel ? COL.lamp : f & (TF.bridge | TF.viaduct) ? COL.bridge : COL.text;
    buf.line(sx(s), prevY, sx(s), y, c);
    prevY = y;
  }
  savePNG(buf, args.out);
  if (args.page) savePNG(pageToPixels(trackTex().page, 0), args.page, 2);
  const summary = {
    out: args.out,
    buildMs: ms,
    length: Math.round(track.length),
    closureGap: Number(track.closure.toFixed(3)),
    extent: { eastWest: Math.round(x1 - x0), northSouth: Math.round(z1 - z0) },
    sections: track.sections.map((s) => ({ id: s.id, from: Math.round(s.s0), length: Math.round(s.s1 - s.s0) })),
    segments: track.segments.length,
    chunks: track.chunks.length,
    meshes: track.meshes.length,
    trisTotal: track.trisTotal,
    tunnels: track.tunnels.map((t) => ({ name: t.name, tube: [Math.round(t.s0), Math.round(t.s1)], ramps: [Math.round(t.ramp0), Math.round(t.ramp1)] })),
    decks: track.bridges.map((b) => ({ name: b.name, kind: b.kind, at: [Math.round(b.s0), Math.round(b.s1)] })),
    gantries: track.gantries.length,
    cameras: track.cameras.length,
    roadworks: track.roadworks.length,
    startS: Math.round(track.startS),
    parLapTicks: track.parLapTicks,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
