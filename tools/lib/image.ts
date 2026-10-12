/**
 * Image helpers for node tools: save a PixelBuffer as PNG, and compose labelled contact sheets
 * (checkerboard behind transparent pixels, frames aligned by anchor, optional anchor/point marks).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Color } from '../../src/engine/color';
import { drawText, measure } from '../../src/engine/font';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { encodePNG } from './png';

/** Contact-sheet colours (tool chrome, deliberately outside the art palette). */
export const SHEET = {
  bg: 0x15121bff,
  checkA: 0x2b2833ff,
  checkB: 0x35323eff,
  title: 0xf6c537ff,
  label: 0xc1ccd8ff,
  dim: 0x6b6878ff,
  error: 0xf06045ff,
  anchor: 0x00ffffff,
  point: 0xff00ffff,
} as const;

/** Encode a buffer (optionally upscaled) and write it, creating folders as needed. */
export function savePNG(buf: PixelBuffer, file: string, scale = 1): void {
  const img = scale > 1 ? buf.scaled(scale) : buf;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePNG(img.w, img.h, img.toRGBA()));
}

/** Checkerboard tile pattern drawn into `buf` over a rectangle (anchored to buffer coords). */
export function drawChecker(buf: PixelBuffer, x: number, y: number, w: number, h: number, size = 4, a: Color = SHEET.checkA, b: Color = SHEET.checkB): void {
  for (let yy = Math.max(0, y); yy < Math.min(buf.h, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(buf.w, x + w); xx++) {
      buf.data[yy * buf.w + xx] = ((Math.floor(xx / size) + Math.floor(yy / size)) & 1) === 0 ? a : b;
    }
  }
  buf.touch();
}

export interface SheetItem {
  id: string;
  frames: readonly Frame[];
  error?: string | null;
}

export interface SheetOpts {
  title: string;
  /** Mark anchors (cyan) and named points (magenta). */
  marks?: boolean;
  /** Page width / max height in unscaled pixels. */
  width?: number;
  maxHeight?: number;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Union (relative to the anchor) of every frame's pixels, anchor and points. */
function unionBox(frames: readonly Frame[]): Box {
  const b: Box = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  for (const f of frames) {
    b.minX = Math.min(b.minX, -f.ox);
    b.minY = Math.min(b.minY, -f.oy);
    b.maxX = Math.max(b.maxX, f.buf.w - 1 - f.ox);
    b.maxY = Math.max(b.maxY, f.buf.h - 1 - f.oy);
    for (const p of Object.values(f.pts ?? {})) {
      b.minX = Math.min(b.minX, p[0]);
      b.minY = Math.min(b.minY, p[1]);
      b.maxX = Math.max(b.maxX, p[0]);
      b.maxY = Math.max(b.maxY, p[1]);
    }
  }
  return b;
}

const PAD = 8;
const GAP = 6;
const LABEL_H = 11;
const INDEX_H = 9;

/**
 * Lay out sprites as labelled rows of frames. Frames of one sprite share a cell size and are
 * aligned by their anchors, so animation motion is visible. Splits into pages by height.
 */
export function composeSheets(items: readonly SheetItem[], o: SheetOpts): PixelBuffer[] {
  const width = o.width ?? 640;
  const maxHeight = o.maxHeight ?? 720;
  type Placed = { item: SheetItem; box: Box; cw: number; ch: number; rows: number[][]; height: number };
  const placed: Placed[] = items.map((item) => {
    const box = unionBox(item.frames);
    const cw = box.maxX - box.minX + 3;
    const ch = box.maxY - box.minY + 3;
    const perRow = Math.max(1, Math.floor((width - PAD * 2 + GAP) / (cw + GAP)));
    const rows: number[][] = [];
    item.frames.forEach((_, i) => {
      if (i % perRow === 0) rows.push([]);
      rows[rows.length - 1].push(i);
    });
    const height = LABEL_H + rows.length * (ch + INDEX_H + 2) + GAP;
    return { item, box, cw, ch, rows, height };
  });

  // Paginate.
  const header = 26;
  const pages: Placed[][] = [[]];
  let y = header;
  for (const p of placed) {
    if (y + p.height > maxHeight && pages[pages.length - 1].length > 0) {
      pages.push([]);
      y = header;
    }
    pages[pages.length - 1].push(p);
    y += p.height;
  }

  return pages.map((page, pi) => {
    const h = header + page.reduce((n, p) => n + p.height, 0) + PAD;
    // Fit the page to its content (labels and frame rows), up to `width`.
    let used = 220;
    for (const p of page) {
      used = Math.max(used, PAD * 2 + measure(p.item.id) + 120);
      for (const row of p.rows) used = Math.max(used, PAD * 2 + row.length * (p.cw + GAP) - GAP);
    }
    const pageW = Math.min(width, used);
    const buf = new PixelBuffer(pageW, Math.max(h, 40)).fill(SHEET.bg);
    const frames = page.reduce((n, p) => n + p.item.frames.length, 0);
    const pageNote = pages.length > 1 ? `  page ${pi + 1}/${pages.length}` : '';
    drawText(buf, o.title.toUpperCase(), PAD, 6, { font: 'big', color: SHEET.title, shadow: 0x000000ff });
    drawText(buf, `${page.length} sprites, ${frames} frames${pageNote}`, pageW - PAD, 7, {
      color: SHEET.dim,
      align: 'right',
    });
    let cy = header;
    for (const p of page) {
      const { item, box, cw, ch } = p;
      const ptsNames = new Set<string>();
      for (const f of item.frames) for (const k of Object.keys(f.pts ?? {})) ptsNames.add(k);
      const f0 = item.frames[0];
      let label = `${item.id}  ${item.frames.length}f  ${f0.buf.w}x${f0.buf.h}`;
      if (ptsNames.size > 0) label += `  pts: ${[...ptsNames].join(', ')}`;
      drawText(buf, label, PAD, cy, { color: item.error ? SHEET.error : SHEET.label });
      if (item.error) {
        const errX = PAD + 8 + measure(label);
        drawText(buf, `ERROR: ${item.error}`.slice(0, 90), errX, cy, { color: SHEET.error });
      }
      cy += LABEL_H;
      for (const row of p.rows) {
        let cx = PAD;
        for (const i of row) {
          const f = item.frames[i];
          drawChecker(buf, cx, cy, cw, ch);
          const ax = cx + 1 - box.minX;
          const ay = cy + 1 - box.minY;
          buf.blit(f.buf, ax - f.ox, ay - f.oy);
          if (o.marks) {
            buf.set(ax, ay, SHEET.anchor);
            for (const pt of Object.values(f.pts ?? {})) buf.set(ax + pt[0], ay + pt[1], SHEET.point);
          }
          drawText(buf, String(i), cx, cy + ch + 1, { color: SHEET.dim });
          cx += cw + GAP;
        }
        cy += ch + INDEX_H + 2;
      }
      cy += GAP;
    }
    return buf;
  });
}
