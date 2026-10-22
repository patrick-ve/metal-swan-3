/**
 * The ring's light pass (docs/design/ring.md §7.3, §13 "Drawing order"; docs/api/ring.md
 * "Scenery"). Owner: the SCENERY builder. Drawn by RingView.drawLight after the front layer and
 * before the HUD:
 *
 * 1. DARKNESS: over every tunnel (and, lighter, every covered stretch such as the buildings over
 *    the road at Bos en Lommer) a deep navy rect over the whole frame between its portals, with
 *    alpha ramps at the portals (RAMP px). Sprites inside get the darker light this way.
 * 2. ADDITIVE LIGHT (sprites `fx/ring/light/*`, blend 'add'), only where it is dark:
 *    - lamp bands: a glow under the ceiling's LED strip every LAMP_STEP world px (the bands pass
 *      overhead at the road speed) and its soft reflection on the road;
 *    - headlights: a beam ahead of every wagon and car (the visual box's front, its facing);
 *    - muzzle flashes and blasts: a glow round every `fx/muzzle…` and `fx/explosion…` effect.
 *
 * Portal positions: the world x the scenery chunks recorded when they were made (`view.portals`),
 * so the dark starts exactly at the painted portal; a portal not made yet uses the live mapping.
 * No state of its own and nothing random: the same frame draws the same light.
 */
import type { Entity } from '../../engine/entity';
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import { hasSprite } from '../../engine/sprites';
import type { World } from '../../engine/world';
import { FxEntity } from '../fx';
import type { RingViewHost } from './types';
import type { RingPortal } from './view';

/** What the light reads from its view (RingView; an interface so light.ts does not import it). */
export interface RingLightView {
  readonly spans: ReadonlyArray<{ readonly kind: string; readonly p0: number; readonly p1: number }>;
  readonly portals: RingPortal[];
}

/** A dark interval on screen (world x) and its depth. */
interface Dark {
  x0: number;
  x1: number;
  alpha: number;
  ramp: number;
  tunnel: boolean;
  /** Screen y where the dark begins (0 in a tube; under the building at a covered stretch). */
  top: number;
}

/** Darkness of a tunnel and of a covered stretch (alpha of the deep navy). */
export const TUNNEL_DARK = 0.5;
export const COVER_DARK = 0.32;
/** Width of the alpha ramp at a portal (px) and its steps. */
const RAMP = 64;
const RAMP_COVER = 28;
/** Under a covered stretch only the space below the building is dark (its soffit at y 56). */
export const COVER_TOP = 56;
const STEP = 1;
/** Lamp fixtures along the ceiling: one every LAMP_STEP world px. */
export const LAMP_STEP = 64;
const LAMP_Y = 36;

const DARK = PAL.navy[0];
const darkOpts: DrawOpts = { screen: true, alpha: 0 };
const addScreen: DrawOpts = { screen: true, blend: 'add', alpha: 1 };
const addWorld: DrawOpts = { blend: 'add', alpha: 1 };
const addWorldFlip: DrawOpts = { blend: 'add', alpha: 1, flipX: true };

/** Light sprite ids. */
export const LIGHT = {
  band: 'fx/ring/light/band',
  pool: 'fx/ring/light/pool',
  beam: 'fx/ring/light/beam',
  glowS: 'fx/ring/light/glow-s',
  glowL: 'fx/ring/light/glow-l',
} as const;

/** Entities whose headlights shine in the dark (by type or tag). */
const LIT_TYPES = new Set(['ring-wagon', 'ring-car', 'ring-scooter', 'ring-parcel-van', 'ring-caravan', 'ring-scan-car', 'ring-tow-truck', 'ring-handhaver-moto', 'ring-roadworks', 'ring-zwaan-cab']);

export class RingLight {
  private readonly view: RingLightView;
  private readonly darks: Dark[] = [];
  /** Pooled interval records (no allocation per frame). */
  private readonly pool: Dark[] = [];
  private readonly rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(view: RingLightView) {
    this.view = view;
  }

  /** The dark intervals on screen now (world x), merged from the portals and the live mapping. */
  intervals(host: RingViewHost, viewW = 384): readonly Dark[] {
    const out = this.darks;
    out.length = 0;
    const o = host.camX - host.planDist;
    const left = host.camX - RAMP;
    const right = host.camX + viewW + RAMP;
    const portals = this.view.portals;
    // Drop portals far behind (the list only grows with the chunks).
    if (portals.length > 8) {
      let n = 0;
      for (const p of portals) if (p.x > left - 2048) portals[n++] = p;
      portals.length = n;
    }
    for (const s of this.view.spans) {
      if (s.kind !== 'tunnel' && s.kind !== 'covered') continue;
      const tunnel = s.kind === 'tunnel';
      let x0 = s.p0 + o;
      let x1 = s.p1 + o;
      if (x1 < left || x0 > right) continue;
      // Snap to the portals the chunks recorded (the painted ones).
      const kind = tunnel ? 'tunnel' : 'covered';
      for (const p of portals) {
        if (p.kind !== kind) continue;
        if (p.side === 'in' && Math.abs(p.x - x0) < 96) x0 = p.x;
        else if (p.side === 'out' && Math.abs(p.x - x1) < 96) x1 = p.x;
      }
      const k = out.length;
      const rec = this.pool[k] ?? (this.pool[k] = { x0: 0, x1: 0, alpha: 0, ramp: 0, tunnel: false, top: 0 });
      rec.top = tunnel ? 0 : COVER_TOP;
      rec.x0 = x0;
      rec.x1 = x1;
      rec.alpha = tunnel ? TUNNEL_DARK : COVER_DARK;
      rec.ramp = tunnel ? RAMP : RAMP_COVER;
      rec.tunnel = tunnel;
      out.push(rec);
    }
    return out;
  }

  /** The darkness (0 … the span's alpha) at a world x. */
  darkAt(host: RingViewHost, x: number): number {
    return darkIn(this.intervals(host), x);
  }

  draw(r: Renderer, host: RingViewHost): void {
    const list = this.intervals(host, r.w);
    if (list.length === 0) return;
    const camX = r.camX;
    // 1. Darkness: the flat middle as one rect, the ramps in STEP px columns.
    for (const d of list) {
      const a0 = Math.max(d.x0 - camX, 0);
      const a1 = Math.min(d.x1 - camX, r.w);
      if (a1 <= a0) continue;
      const flat0 = Math.max(a0, d.x0 + d.ramp - camX);
      const flat1 = Math.min(a1, d.x1 - d.ramp - camX);
      if (flat1 > flat0) {
        darkOpts.alpha = d.alpha;
        r.rect(Math.floor(flat0), d.top, Math.ceil(flat1 - Math.floor(flat0)), r.h - d.top, DARK, darkOpts);
      }
      for (let x = Math.floor(a0 / STEP) * STEP; x < a1; x += STEP) {
        const cx = x + STEP / 2;
        if (cx >= flat0 && cx < flat1) continue;
        const a = alphaIn(d, camX + cx);
        if (a <= 0.01) continue;
        darkOpts.alpha = a;
        r.rect(x, d.top, STEP, r.h - d.top, DARK, darkOpts);
      }
    }
    // 2. Lamp bands under the ceiling (tunnels only): fixtures every LAMP_STEP world px.
    if (hasSprite(LIGHT.band)) {
      for (const d of list) {
        if (!d.tunnel) continue;
        const k0 = Math.ceil(Math.max(d.x0 + 8, camX - 48) / LAMP_STEP);
        const k1 = Math.floor(Math.min(d.x1 - 8, camX + r.w + 48) / LAMP_STEP);
        for (let k = k0; k <= k1; k++) {
          const x = k * LAMP_STEP - camX;
          addScreen.alpha = Math.min(1, alphaIn(d, k * LAMP_STEP) / d.alpha);
          r.sprite(LIGHT.band, 0, x, LAMP_Y, addScreen);
          if (hasSprite(LIGHT.pool)) {
            addScreen.alpha *= 0.55;
            r.sprite(LIGHT.pool, 0, x, 160, addScreen);
          }
        }
      }
    }
    // 3. Headlights, muzzle flashes and blasts where it is dark.
    const world = (host as Partial<{ world: World }>).world;
    if (!world) return;
    const ents = world.entities;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.removed) continue;
      if (e instanceof FxEntity) this.fxGlow(r, list, e);
      else if (LIT_TYPES.has(e.type) || e.hasTag('ring-wagon')) this.headlight(r, list, e);
    }
  }

  private headlight(r: Renderer, list: readonly Dark[], e: Entity): void {
    if (!hasSprite(LIGHT.beam)) return;
    const b = e.hitRect(this.rect);
    const fx = e.facing >= 0 ? b.x + b.w - 2 : b.x + 2;
    const a = darkIn(list, fx);
    if (a <= 0.02) return;
    const o = e.facing >= 0 ? addWorld : addWorldFlip;
    o.alpha = Math.min(1, (a / TUNNEL_DARK) * 0.9);
    r.sprite(LIGHT.beam, 0, fx, b.y + b.h * 0.62, o);
  }

  private fxGlow(r: Renderer, list: readonly Dark[], e: FxEntity): void {
    const s = e.sprite;
    const big = s.startsWith('fx/explosion');
    if (!big && !s.startsWith('fx/muzzle')) return;
    const id = big ? LIGHT.glowL : LIGHT.glowS;
    if (!hasSprite(id)) return;
    const a = darkIn(list, e.x);
    if (a <= 0.02) return;
    // Blasts fade over their first 24 ticks.
    const fade = big ? Math.max(0, 1 - e.t / 24) : 1;
    if (fade <= 0) return;
    addWorld.alpha = Math.min(1, (a / TUNNEL_DARK) * fade);
    r.sprite(id, 0, e.x, e.y, addWorld);
  }
}

/** The darkness of a list of intervals at world x. */
function darkIn(list: readonly Dark[], x: number): number {
  let a = 0;
  for (let i = 0; i < list.length; i++) {
    const v = alphaIn(list[i], x);
    if (v > a) a = v;
  }
  return a;
}

/** Alpha of a dark interval at world x (ramps at both portals). */
function alphaIn(d: Dark, x: number): number {
  if (x < d.x0 || x >= d.x1) return 0;
  const t = Math.min(1, (x - d.x0) / d.ramp, (d.x1 - x) / d.ramp);
  // Smooth ramp: eyes adapt (ease in and out).
  return d.alpha * t * t * (3 - 2 * t);
}
