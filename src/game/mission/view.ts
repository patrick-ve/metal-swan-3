/**
 * Draws a section's scenery: parallax background layers (from named generators, built lazily),
 * terrain painted in 256×256 chunks (by the registered terrain painter sampling
 * `terrain.cellAt`, built lazily and prefetched ahead of the camera) and decor sprites.
 *
 * Call order per frame (camera already set on the renderer):
 *   view.drawBack(r, tick) → world.draw(r) → view.drawFront(r, tick)
 */
import { PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, ParallaxOpts, Renderer } from '../../engine/render';
import { VIEW_H, VIEW_W } from '../../engine/render';
import { spriteAnim } from '../../engine/sprites';
import type { Terrain } from '../../engine/terrain';
import { getBgGenerator, getTerrainPainter, type BgLayerDef, type TerrainSampler } from '../art/art-registry';
import type { DecorDef, SectionDef } from './types';

/** Terrain chunk size (px). */
export const CHUNK = 256;
/** Extra chunks generated per frame ahead of the view (keeps scrolling smooth). */
const PREFETCH_PER_FRAME = 1;

interface Layer {
  readonly def: BgLayerDef;
  buf: PixelBuffer | null;
}

const decorOpts: DrawOpts = {};
const pitOpts: DrawOpts = {};
const layerOpts: ParallaxOpts = {};
/** The pit shaft: dark navy fading to ink (palette colours), band heights from the rim down. */
const PIT_BANDS: readonly number[] = [PAL.navy[1], PAL.navy[0], PAL.ink[1], PAL.ink[0]];
const PIT_BAND_H: readonly number[] = [4, 8, 14, 0];

interface PitSpan {
  x0: number;
  x1: number;
  /** Top of the shaft: the lower of the two rims (the ground on each side covers the rest). */
  y: number;
}

/** Gaps between consecutive ground polylines (sorted by x). */
function pitSpans(t: Terrain): PitSpan[] {
  const lines = [...t.def.ground].filter((l) => l.length >= 2).sort((a, b) => a[0][0] - b[0][0]);
  const out: PitSpan[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const end = lines[i][lines[i].length - 1];
    const start = lines[i + 1][0];
    if (start[0] - end[0] < 2) continue;
    out.push({ x0: end[0], x1: start[0], y: Math.max(end[1], start[1]) });
  }
  return out;
}

export class SectionView {
  readonly section: SectionDef;
  private readonly seed: number;
  private readonly layers: Layer[];
  /** Chunk buffers by key (null = generated but empty). */
  private readonly chunks = new Map<number, PixelBuffer | null>();
  private readonly back: DecorDef[];
  private readonly front: DecorDef[];
  private readonly sample: TerrainSampler;
  /** Gaps between ground polylines (pits), with the lower rim height. */
  private readonly pits: readonly PitSpan[];
  /** Chunks generated so far (debug / tests). */
  generated = 0;

  constructor(section: SectionDef, terrain: Terrain, seed: number) {
    this.section = section;
    this.seed = seed;
    this.layers = (section.background?.layers ?? []).map((def) => ({ def, buf: null }));
    const decor = section.decor ?? [];
    this.back = decor.filter((d) => !d.front);
    this.front = decor.filter((d) => d.front);
    this.sample = (x, y) => terrain.cellAt(x, y);
    this.pits = pitSpans(terrain);
  }

  /** Background colour behind every layer. */
  get sky(): number {
    return this.section.background?.sky ?? 0x000000ff;
  }

  /** Build everything a view at (camX, camY) needs right now (section start, respawn jumps). */
  prepare(camX: number, camY: number): void {
    for (let i = 0; i < this.layers.length; i++) this.layerBuf(i);
    const x0 = Math.floor(camX / CHUNK);
    const x1 = Math.floor((camX + VIEW_W - 1) / CHUNK);
    const y0 = Math.floor(camY / CHUNK);
    const y1 = Math.floor((camY + VIEW_H - 1) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) this.chunk(cx, cy);
  }

  /** Background layers, the dark behind pits, terrain and back decor. */
  drawBack(r: Renderer, tick: number): void {
    for (let i = 0; i < this.layers.length; i++) {
      if (!this.layers[i].def.front) this.drawLayer(r, i, tick);
    }
    this.drawPits(r);
    this.drawDecor(r, this.back, tick);
    const camX = r.camX;
    const camY = r.camY;
    const x0 = Math.floor(camX / CHUNK);
    const x1 = Math.floor((camX + VIEW_W - 1) / CHUNK);
    const y0 = Math.floor(camY / CHUNK);
    const y1 = Math.floor((camY + VIEW_H - 1) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const buf = this.chunk(cx, cy);
        if (buf) r.image(buf, cx * CHUNK, cy * CHUNK);
      }
    }
    this.prefetch(camX, camY);
  }

  /** Front decor and foreground layers. */
  drawFront(r: Renderer, tick: number): void {
    this.drawDecor(r, this.front, tick);
    for (let i = 0; i < this.layers.length; i++) {
      if (this.layers[i].def.front) this.drawLayer(r, i, tick);
    }
  }

  // ------------------------------------------------------------------------------- pits

  /**
   * Pits read as deadly drops, not as windows into the background: a dark shaft fades in under
   * every gap in the ground (from the lower rim down to the bottom of the section).
   */
  private drawPits(r: Renderer): void {
    const pits = this.pits;
    if (pits.length === 0) return;
    const camX = r.camX;
    const camY = r.camY;
    const bottom = Math.max(this.section.height, camY + VIEW_H);
    for (let i = 0; i < pits.length; i++) {
      const p = pits[i];
      if (p.x1 < camX || p.x0 > camX + VIEW_W) continue;
      const w = p.x1 - p.x0;
      // Three bands getting darker toward the bottom, dithered at the top edge by a 2 px step.
      let y = p.y;
      for (let k = 0; k < PIT_BANDS.length; k++) {
        const h = k === PIT_BANDS.length - 1 ? bottom - y : PIT_BAND_H[k];
        if (h <= 0) break;
        r.rect(p.x0, y, w, h, PIT_BANDS[k], pitOpts);
        y += h;
      }
    }
  }

  // ------------------------------------------------------------------------------- layers

  private layerBuf(i: number): PixelBuffer | null {
    const l = this.layers[i];
    if (l.buf) return l.buf;
    const d = l.def;
    const w = Math.max(1, Math.floor(d.width ?? 512));
    const h = Math.max(1, Math.floor(d.height ?? VIEW_H));
    try {
      l.buf = getBgGenerator(d.gen)(w, h, d.params ?? {}, (this.seed + i * 7919) >>> 0);
    } catch (err) {
      console.warn(`[mission] background generator "${d.gen}" failed:`, err);
      l.buf = new PixelBuffer(w, h);
    }
    return l.buf;
  }

  private drawLayer(r: Renderer, i: number, tick: number): void {
    const buf = this.layerBuf(i);
    if (!buf) return;
    const d = this.layers[i].def;
    layerOpts.repeatX = d.repeatX ?? true;
    layerOpts.repeatY = d.repeatY ?? false;
    layerOpts.alpha = d.alpha ?? 1;
    // Drift keeps clouds moving even while the camera is locked (wrapped into the tile).
    const ox = (d.offsetX ?? 0) + (d.driftX ? (tick * d.driftX) % buf.w : 0);
    const oy = (d.offsetY ?? 0) + (d.driftY ? (tick * d.driftY) % buf.h : 0);
    r.parallax(buf, d.factorX, d.factorY ?? 0, ox, oy, layerOpts);
  }

  // ------------------------------------------------------------------------------- terrain chunks

  private key(cx: number, cy: number): number {
    return (cy + 64) * 65536 + (cx + 64);
  }

  /** The chunk buffer (generated on first use; null when empty or outside the section). */
  chunk(cx: number, cy: number): PixelBuffer | null {
    const k = this.key(cx, cy);
    const cached = this.chunks.get(k);
    if (cached !== undefined) return cached;
    const s = this.section;
    let buf: PixelBuffer | null = null;
    if (cx >= 0 && cy >= 0 && cx * CHUNK < s.width + CHUNK && cy * CHUNK < s.height + CHUNK) {
      try {
        buf = getTerrainPainter()(this.sample, s.terrainStyle ?? { ground: 'dirt' }, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
      } catch (err) {
        console.warn('[mission] terrain painter failed:', err);
        buf = null;
      }
      if (buf && buf.countOpaque() === 0) buf = null;
      this.generated++;
    }
    this.chunks.set(k, buf);
    return buf;
  }

  /** Generate a chunk or two just outside the view so scrolling never waits for one. */
  private prefetch(camX: number, camY: number): void {
    let budget = PREFETCH_PER_FRAME;
    const y0 = Math.floor(camY / CHUNK);
    const y1 = Math.floor((camY + VIEW_H - 1) / CHUNK);
    const right = Math.floor((camX + VIEW_W + CHUNK / 2) / CHUNK);
    const left = Math.floor((camX - CHUNK / 2) / CHUNK);
    for (let cy = y0 - 1; cy <= y1 + 1 && budget > 0; cy++) {
      for (let side = 0; side < 2 && budget > 0; side++) {
        const cx = side === 0 ? right : left;
        if (this.chunks.has(this.key(cx, cy))) continue;
        this.chunk(cx, cy);
        budget--;
      }
    }
  }

  // ------------------------------------------------------------------------------- decor

  private drawDecor(r: Renderer, list: readonly DecorDef[], tick: number): void {
    const camX = r.camX;
    const camY = r.camY;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const p = d.parallax ?? 1;
      // Parallax decor: screen x = d.x − camX·p, i.e. world x = d.x + camX·(1 − p).
      const x = d.x + camX * (1 - p);
      const y = d.y + camY * (1 - p);
      if (x < camX - 256 || x > camX + VIEW_W + 256 || y < camY - 256 || y > camY + VIEW_H + 256) continue;
      let frame = d.frame ?? 0;
      if (d.animate) {
        const tpf = typeof d.animate === 'number' ? d.animate : spriteAnim(d.sprite).ticksPerFrame;
        frame += Math.floor(tick / Math.max(1, tpf));
      }
      decorOpts.flipX = d.flipX ?? false;
      decorOpts.alpha = d.alpha ?? 1;
      r.sprite(d.sprite, frame, Math.round(x), Math.round(y), decorOpts);
    }
  }
}
