/**
 * The race's full HUD part (RULES, wave B; docs/design/rally.md §7.6, §5, §10; docs/api/rally.md
 * "B.6", "B.R"): drawn by the scene per player view after its base HUD (POSITIE n/8, RONDE n/3, the
 * lap time and BESTE RONDE, the speed digits and KM/H). 2D, the game's font, Dutch labels, readable
 * at 1×; a compact version per view in split screen.
 *
 * Full view (384 × 216):
 * - top centre: the clock (`17:03`, the time of day); under it up to two warning rows, by priority:
 *   `POLITIE!` (a police car is after you), a red X ahead (`RIJSTROOK DICHT` with the cross),
 *   `FLITSER` (a speed camera ahead), `TRAJECT 104/100` (the average-speed zone: your average and the
 *   limit), `WERK IN UITVOERING 70` (road works ahead), `SPITSSTROOK OPEN` (lap 3);
 *   then `BOETE EUR 1.050` after a fine;
 * - the white flash of a camera over this view only; `AAN DE KANT!` while pulled over (the seconds
 *   left under it);
 * - bottom left: the ring mini-map (the loop, the rivals as dots, the players in their colours, the
 *   police blinking blue and red, the standing road works in amber);
 * - bottom right, above the speed digits: a small speed dial (0–260 km/h);
 * - bottom centre: the radio ticker (`RallyScene.ticker`, wave C's FILE FM).
 * Split view (384 × 108): the clock, one warning row, the BOETE line, `AAN DE KANT!`, a small map; the
 * ticker once, in the lower view.
 *
 * Cosmetic: it reads the race and the rules (`rulesOf`), listens to the runner's events, and never
 * changes the race. Nothing allocates per frame but the few texts that change (cached per view).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { splineSample } from '../../../../engine/r3/spline';
import { cosT, sinT } from '../../../../engine/r3/trig';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { PLAYER_COLORS, textWidth, UI_GOLD, UI_GREY, UI_RED, UI_WHITE, uiText } from '../../../app';
import type { CarState } from '../../../rally/api';
import { clockText } from '../../../rally/daylight';
import type { RallyHudPart, RallyHudView } from '../../../rally/registry';
import type { RallyRunner } from '../../../rally/runner';
import { ahead, inRange, wrapOff } from '../../../rally/rules/plan';
import { HOLD_TICKS } from '../../../rally/rules/police';
import { FLITSER_AHEAD, rulesOf, type RallyRules } from '../../../rally/rules/rules';
import { eurosText } from '../../../rally/score';
import { createRadioTicker } from '../radio/ticker';

/** The ink of the HUD panels (the scene's). */
const INK_PANEL: Color = 0x05060aff;
const BLUE: Color = PAL.sky[3];
const GREEN: Color = PAL.green[4];
const AMBER: Color = PAL.orange[2];
const MAP_LINE: Color = PAL.stone[3];
const MAP_EDGE: Color = 0x05060aff;
const RIVAL_DOT: Color = PAL.snow[2];

/** Warnings: road works this far ahead (m), the spitsstrook this far ahead (m), a red X this far ahead (m), the police this near (m). */
export const WORKS_AHEAD = 600;
export const SPITS_AHEAD = 350;
export const REDX_AHEAD = 300;
export const POLICE_NEAR = 300;
/** How long the BOETE line and the flash show (ticks). */
export const BOETE_TICKS = 150;
export const FLASH_TICKS = 10;

/** The HUD's boxes (logical px, relative to the view's top-left): the layout the tests check. */
export const HUD_LAYOUT = {
  full: { clock: 4, rows: [16, 27], boete: 39, pulled: 52, pulledSub: 70, map: { x: 6, y: 152, w: 56, h: 56 }, dial: { cx: 354, cy: 186, r: 15 }, ticker: 205 },
  split: { clock: 4, rows: [15], boete: 26, pulled: 40, pulledSub: 52, map: { x: 6, y: 70, w: 34, h: 34 }, dial: null, ticker: 97 },
} as const;

/** The speed dial: km/h at the end of the arc, the arc (from 210° to −30°). */
const DIAL_MAX = 260;
const DIAL_FROM = (210 * Math.PI) / 180;
const DIAL_SPAN = (240 * Math.PI) / 180;

const SCREEN: DrawOpts = { screen: true };
const PANEL: DrawOpts = { screen: true, alpha: 0.7 };
const FLASH: DrawOpts = { screen: true, alpha: 0 };

type WarnId = 'police' | 'redx' | 'flitser' | 'zone' | 'works' | 'spits';

/** Per view (slot 0 / 1): the timers and the cached texts. */
interface ViewState {
  flashT: number;
  fineT: number;
  euros: number;
  boete: string;
  clockMin: number;
  clock: string;
  zoneKey: number;
  zone: string;
  worksKey: number;
  works: string;
  flitKey: number;
  flit: string;
  holdKey: number;
  hold: string;
}

/** The mini-map: the loop (pre-drawn), its transform, the road-works dots. */
interface MiniMap {
  readonly buf: PixelBuffer;
  readonly w: number;
  readonly h: number;
  readonly minX: number;
  readonly minZ: number;
  readonly scale: number;
  readonly ox: number;
  readonly oz: number;
  /** Per road-works zone: its dots (map px, pairs). */
  readonly works: readonly Float32Array[];
}

/** Draw the loop of the track into a small buffer (once per race and size). */
function buildMap(runner: RallyRunner, rules: RallyRules | null, w: number, h: number): MiniMap {
  const track = runner.track;
  const n = Math.max(24, Math.ceil(track.length / 25));
  const xs = new Float64Array(n);
  const zs = new Float64Array(n);
  const sp = splineSample();
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    track.spline.sample((i / n) * track.spline.length, sp);
    xs[i] = sp.p[0];
    zs[i] = sp.p[2];
    minX = Math.min(minX, xs[i]);
    maxX = Math.max(maxX, xs[i]);
    minZ = Math.min(minZ, zs[i]);
    maxZ = Math.max(maxZ, zs[i]);
  }
  const scale = Math.min((w - 4) / Math.max(1, maxX - minX), (h - 4) / Math.max(1, maxZ - minZ));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oz = (h - (maxZ - minZ) * scale) / 2;
  const buf = new PixelBuffer(w, h);
  const px = (i: number): number => Math.round(ox + (xs[i] - minX) * scale);
  const pz = (i: number): number => Math.round(oz + (zs[i] - minZ) * scale);
  // A dark edge (the outline), then the light loop over it.
  for (const [dx, dz] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const)
    for (let i = 0; i < n; i++) buf.line(px(i) + dx, pz(i) + dz, px((i + 1) % n) + dx, pz((i + 1) % n) + dz, MAP_EDGE);
  for (let i = 0; i < n; i++) buf.line(px(i), pz(i), px((i + 1) % n), pz((i + 1) % n), MAP_LINE);
  // The start line: a white tick.
  track.spline.sample(track.startS, sp);
  const sx = Math.round(ox + (sp.p[0] - minX) * scale);
  const sz = Math.round(oz + (sp.p[2] - minZ) * scale);
  for (let d = -1; d <= 1; d++) buf.set(sx + Math.round(sp.r[0] * d * 2), sz + Math.round(sp.r[2] * d * 2), UI_WHITE);
  const works: Float32Array[] = [];
  for (const wp of rules?.plan.works ?? []) {
    const k = Math.max(2, Math.ceil(wp.len / 20));
    const a = new Float32Array(k * 2);
    for (let j = 0; j < k; j++) {
      track.spline.sample(track.spline.wrap(track.startS + wp.off0 + (wp.len * j) / (k - 1)), sp);
      a[j * 2] = Math.round(ox + (sp.p[0] - minX) * scale);
      a[j * 2 + 1] = Math.round(oz + (sp.p[2] - minZ) * scale);
    }
    works.push(a);
  }
  return { buf, w, h, minX, minZ, scale, ox, oz, works };
}

export function createRulesHud(runner: RallyRunner): RallyHudPart {
  const views: ViewState[] = [0, 1].map(() => ({ flashT: 0, fineT: 0, euros: 0, boete: '', clockMin: -1, clock: '', zoneKey: -1, zone: '', worksKey: -1, works: '', flitKey: -1, flit: 'FLITSER', holdKey: -1, hold: '' }));
  const maps: { full: MiniMap | null; split: MiniMap | null } = { full: null, split: null };
  const ticker = createRadioTicker();
  let t = 0;
  const offs = [
    runner.events.on('flash', (e) => {
      if (e.slot >= 0) views[e.slot === 1 ? 1 : 0].flashT = FLASH_TICKS;
    }),
    runner.events.on('fine', (e) => {
      if (e.slot < 0) return;
      const vs = views[e.slot === 1 ? 1 : 0];
      vs.fineT = BOETE_TICKS;
      vs.euros = e.euros;
      vs.boete = `BOETE EUR ${eurosText(e.euros)}`;
    }),
  ];
  const mapOf = (split: boolean): MiniMap => {
    const key = split ? 'split' : 'full';
    let m = maps[key];
    if (!m) {
      const L = split ? HUD_LAYOUT.split.map : HUD_LAYOUT.full.map;
      m = maps[key] = buildMap(runner, rulesOf(runner), L.w, L.h);
    }
    return m;
  };

  /** The warnings of a car, by priority, into `out` (ids); returns the count. */
  const warnings = (rules: RallyRules | null, car: CarState, out: WarnId[]): number => {
    let n = 0;
    if (!rules || car.finished || runner.phase !== 'race') return 0;
    const cr = rules.of(car);
    if (cr && cr.pulled >= 0) return 0;
    const hunter = rules.police.hunting(car);
    if (hunter && Math.abs(hunter.body.dist - car.dist) < POLICE_NEAR) out[n++] = 'police';
    if (rules.redXAhead(car, REDX_AHEAD) >= 0) out[n++] = 'redx';
    if (rules.cameraAhead(car, FLITSER_AHEAD) >= 0) out[n++] = 'flitser';
    if (rules.zoneAverage(car)) out[n++] = 'zone';
    if (worksAhead(rules, car) >= 0) out[n++] = 'works';
    if (rules.spitsOpen && spitsNear(rules, car)) out[n++] = 'spits';
    return n;
  };
  const warnList: WarnId[] = ['police', 'police', 'police', 'police', 'police', 'police'];

  return {
    tick() {
      t++;
      for (const vs of views) {
        if (vs.flashT > 0) vs.flashT--;
        if (vs.fineT > 0) vs.fineT--;
      }
    },
    draw(r: Renderer, v: RallyHudView) {
      const rules = rulesOf(runner);
      const vs = views[v.slot === 1 ? 1 : 0];
      const L = v.split ? HUD_LAYOUT.split : HUD_LAYOUT.full;
      const cx = v.x + (v.w >> 1);
      const car = v.car;
      // The white flash of a camera (this player's view only).
      if (vs.flashT > 0) {
        FLASH.alpha = Math.min(0.85, vs.flashT / FLASH_TICKS);
        r.rect(v.x, v.y, v.w, v.h, 0xffffffff, FLASH);
      }
      // The clock (the time of day, spec §4).
      const min = Math.floor(v.day.clock);
      if (min !== vs.clockMin) {
        vs.clockMin = min;
        vs.clock = clockText(min);
      }
      const cw = textWidth(vs.clock) + 6;
      r.rect(cx - (cw >> 1), v.y + L.clock - 2, cw, 11, INK_PANEL, PANEL);
      uiText(r, vs.clock, cx, v.y + L.clock, UI_WHITE, 'center');
      // The warnings (one or two rows).
      const n = warnings(rules, car, warnList);
      for (let i = 0; i < L.rows.length && i < n; i++) drawWarning(r, rules!, car, warnList[i], cx, v.y + L.rows[i], vs, t);
      if (vs.fineT > 0 && !car.finished) uiText(r, vs.boete, cx, v.y + L.boete, UI_WHITE, 'center');
      // Pulled over: AAN DE KANT! and the seconds left.
      const cr = rules?.of(car) ?? null;
      if (rules && cr && cr.pulled >= 0) {
        const p = rules.police.cars[cr.pulled];
        if (p) {
          uiText(r, 'AAN DE KANT!', cx, v.y + L.pulled, UI_GOLD, 'center', 'big');
          const left = p.phase === 'hold' ? Math.max(1, Math.ceil((HOLD_TICKS - p.holdT) / 60)) : 3;
          if (left !== vs.holdKey) {
            vs.holdKey = left;
            vs.hold = `POLITIE  ${left}`;
          }
          uiText(r, vs.hold, cx, v.y + L.pulledSub, blink(t, 16) ? BLUE : UI_RED, 'center');
        }
      }
      // The mini-map.
      drawMap(r, mapOf(v.split), v.x + L.map.x, v.y + L.map.y, runner, rules, car, t);
      // The speed dial (full view only).
      if (L.dial) drawDial(r, v.x + L.dial.cx, v.y + L.dial.cy, L.dial.r, Math.abs(car.speed) * 3.6);
      // The radio ticker (RADIO's slot, wave C: content/rally/radio/ticker.ts): once, at the bottom of the frame.
      if (v.ticker && v.y + v.h >= 216) ticker.draw(r, v.ticker, runner.race.tick, cx, v.y + v.h - 11, v.split);
    },
    dispose() {
      for (const off of offs) off();
    },
  };
}

/** One warning row at (cx, y): a dark panel and the text (the red X with its cross). */
function drawWarning(r: Renderer, rules: RallyRules, car: CarState, id: WarnId, cx: number, y: number, vs: ViewState, t: number): void {
  let text = '';
  let col: Color = UI_WHITE;
  let icon = false;
  switch (id) {
    case 'police':
      text = 'POLITIE!';
      col = blink(t, 8) ? BLUE : UI_RED;
      break;
    case 'redx':
      text = 'RIJSTROOK DICHT';
      col = UI_RED;
      icon = true;
      break;
    case 'flitser': {
      // Fixer (wave B): the limit that camera enforces on this car.
      const lim = rules.cameraLimit(car, FLITSER_AHEAD);
      if (lim !== vs.flitKey) {
        vs.flitKey = lim;
        vs.flit = lim > 0 ? `FLITSER ${lim}` : 'FLITSER';
      }
      text = vs.flit;
      col = UI_GOLD;
      break;
    }
    case 'zone': {
      const z = rules.zoneAverage(car)!;
      const key = z.avg * 1000 + z.limit;
      if (key !== vs.zoneKey) {
        vs.zoneKey = key;
        vs.zone = `TRAJECT ${z.avg}/${z.limit}`;
      }
      text = vs.zone;
      col = z.avg > z.limit ? UI_RED : UI_WHITE;
      break;
    }
    case 'works': {
      const lim = worksLimit(rules, car);
      if (lim !== vs.worksKey) {
        vs.worksKey = lim;
        vs.works = `WERK IN UITVOERING ${lim}`;
      }
      text = vs.works;
      col = AMBER;
      break;
    }
    case 'spits':
      text = 'SPITSSTROOK OPEN';
      col = GREEN;
      break;
  }
  const w = textWidth(text) + (icon ? 17 : 6);
  const x0 = cx - (w >> 1);
  r.rect(x0, y - 2, w, 11, INK_PANEL, PANEL);
  if (icon) {
    // A small red cross (the matrix sign's X) before the text.
    const ix = x0 + 3;
    r.line(ix, y, ix + 6, y + 6, UI_RED, SCREEN);
    r.line(ix + 6, y, ix, y + 6, UI_RED, SCREEN);
    r.line(ix + 1, y, ix + 7, y + 6, UI_RED, SCREEN);
    r.line(ix + 7, y, ix + 1, y + 6, UI_RED, SCREEN);
    uiText(r, text, x0 + 14, y, col);
  } else uiText(r, text, cx, y, col, 'center');
}

/** The distance to the next standing road works ahead of a car (or inside one: 0); −1 = none within `WORKS_AHEAD`. */
function worksAhead(rules: RallyRules, car: CarState): number {
  const L = rules.plan.L;
  const o = wrapOff(car.dist, L);
  let best = -1;
  for (const z of rules.works.zones) {
    if (!z.active) continue;
    const d = inRange(o, z.plan.off0, z.plan.len, L) ? 0 : ahead(o, z.plan.off0, L);
    // Fixer (wave B): from the arrow gantry on (its merge arrows and step-down limit are the first signs).
    const from = z.plan.arrow >= 0 ? Math.max(WORKS_AHEAD, ahead(rules.plan.gantries[z.plan.arrow].off, z.plan.off0, L) + 5) : WORKS_AHEAD;
    if (d < from && (best < 0 || d < best)) best = d;
  }
  return best;
}

/** The limit of the road works ahead (70). */
function worksLimit(rules: RallyRules, car: CarState): number {
  const L = rules.plan.L;
  const o = wrapOff(car.dist, L);
  let best = -1;
  let lim = 70;
  for (const z of rules.works.zones) {
    if (!z.active) continue;
    const d = inRange(o, z.plan.off0, z.plan.len, L) ? 0 : ahead(o, z.plan.off0, L);
    if (best < 0 || d < best) {
      best = d;
      lim = z.plan.limit;
    }
  }
  return lim;
}

/** Is a spitsstrook stretch near ahead of a car (or is it on one)? */
function spitsNear(rules: RallyRules, car: CarState): boolean {
  const L = rules.plan.L;
  const o = wrapOff(car.dist, L);
  for (const s of rules.plan.spits) if (inRange(o, s.off0, s.len, L) || ahead(o, s.off0, L) < SPITS_AHEAD) return true;
  return false;
}

function blink(t: number, half: number): boolean {
  return Math.floor(t / half) % 2 === 0;
}

/** The mini-map at (x, y): the loop, the road works, the cars (players last, on top). */
function drawMap(r: Renderer, m: MiniMap, x: number, y: number, runner: RallyRunner, rules: RallyRules | null, me: CarState, t: number): void {
  r.rect(x - 1, y - 1, m.w + 2, m.h + 2, INK_PANEL, PANEL);
  r.image(m.buf, x, y, SCREEN);
  if (rules) {
    for (let i = 0; i < rules.works.zones.length; i++) {
      if (!rules.works.zones[i].active) continue;
      const a = m.works[i];
      if (!a) continue;
      for (let j = 0; j < a.length; j += 2) r.rect(x + a[j], y + a[j + 1], 1, 1, AMBER, SCREEN);
    }
    if (blink(t, 6)) {
      for (const p of rules.police.cars) {
        if (p.body.hidden) continue;
        r.rect(x + mapX(m, p.body.pos[0]) - 1, y + mapZ(m, p.body.pos[2]) - 1, 2, 2, blink(t, 12) ? BLUE : UI_RED, SCREEN);
      }
    }
  }
  for (const c of runner.cars) {
    if (c.slot >= 0) continue;
    r.rect(x + mapX(m, c.pos[0]) - 1, y + mapZ(m, c.pos[2]) - 1, 2, 2, RIVAL_DOT, SCREEN);
  }
  for (const c of runner.cars) {
    if (c.slot < 0) continue;
    const px = x + mapX(m, c.pos[0]);
    const pz = y + mapZ(m, c.pos[2]);
    r.rect(px - 2, pz - 2, 5, 5, INK_PANEL, SCREEN);
    r.rect(px - 1, pz - 1, 3, 3, PLAYER_COLORS[c.slot === 1 ? 1 : 0], SCREEN);
    // Your own dot blinks a white centre.
    if (c === me && blink(t, 20)) r.rect(px, pz, 1, 1, UI_WHITE, SCREEN);
  }
}

function mapX(m: MiniMap, x: number): number {
  return Math.round(m.ox + (x - m.minX) * m.scale);
}

function mapZ(m: MiniMap, z: number): number {
  return Math.round(m.oz + (z - m.minZ) * m.scale);
}

/** The speed dial at (cx, cy), radius `rad`: ticks every 20 km/h (gold every 100, red past 200) and the needle. */
function drawDial(r: Renderer, cx: number, cy: number, rad: number, kmh: number): void {
  for (let v = 0; v <= DIAL_MAX; v += 20) {
    const a = DIAL_FROM - (v / DIAL_MAX) * DIAL_SPAN;
    const c = cosT(a);
    const s = sinT(a);
    const inner = v % 100 === 0 ? rad - 5 : rad - 3;
    const x0 = Math.round(cx + c * inner);
    const y0 = Math.round(cy - s * inner);
    const x1 = Math.round(cx + c * rad);
    const y1 = Math.round(cy - s * rad);
    r.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, INK_PANEL, SCREEN);
    r.line(x0, y0, x1, y1, v > 200 ? UI_RED : v % 100 === 0 ? UI_GOLD : UI_WHITE, SCREEN);
  }
  const k = Math.max(0, Math.min(DIAL_MAX, kmh));
  const a = DIAL_FROM - (k / DIAL_MAX) * DIAL_SPAN;
  const nx = Math.round(cx + cosT(a) * (rad - 2));
  const ny = Math.round(cy - sinT(a) * (rad - 2));
  r.line(cx + 1, cy + 1, nx + 1, ny + 1, INK_PANEL, SCREEN);
  r.line(cx, cy, nx, ny, UI_RED, SCREEN);
  r.rect(cx - 1, cy - 1, 3, 3, UI_GREY, SCREEN);
}
