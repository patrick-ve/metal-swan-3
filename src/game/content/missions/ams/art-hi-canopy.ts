/**
 * Canopy helpers for the 2× ams trees (decor/ams/elm, the ams-elms background layer): close the
 * small holes the ragged leaf edge leaves inside a canopy and open away thin strands and loose
 * clumps, so its outline (or dark rim) is one closed ring instead of loose dark flecks.
 */
import type { Color } from '../../../../engine/color';
import type { PixelBuffer } from '../../../../engine/pixel';

/**
 * Label the regions of pixels with `opaque` opacity (4-connected for transparent regions,
 * 8-connected for opaque ones) and call `done(cells, count, open)` per region; `open` = it
 * touches the buffer edge. `cells` is shared and only valid during the call.
 */
function regions(b: PixelBuffer, opaque: boolean, done: (cells: Int32Array, count: number, open: boolean) => void): void {
  const { w, h, data } = b;
  const n = w * h;
  // seen: 1 = done or not wanted, so the flood tests one array.
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (((data[i] & 255) !== 0) !== opaque) seen[i] = 1;
  const stack = new Int32Array(n);
  const cells = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    let sp = 0;
    let count = 0;
    let open = false;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const i = stack[--sp];
      cells[count++] = i;
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) open = true;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!opaque && dx !== 0 && dy !== 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (seen[j]) continue;
          seen[j] = 1;
          stack[sp++] = j;
        }
      }
    }
    done(cells, count, open);
  }
}

/**
 * Fill every enclosed transparent region (not reaching the buffer edge) of at most `maxArea`
 * pixels with `c`. Bigger enclosed regions (gaps between a trunk and the leaves) stay.
 */
export function fillHoles(b: PixelBuffer, c: Color, maxArea: number): void {
  const data = b.data;
  const v = c >>> 0;
  regions(b, false, (cells, count, open) => {
    if (!open && count <= maxArea) for (let k = 0; k < count; k++) data[cells[k]] = v;
  });
  b.touch();
}

/**
 * Paint an `n`-px rim in colour `c` on the inside of the silhouette: every opaque pixel with a
 * transparent pixel within `n` px (a square neighbourhood).
 */
export function rimInside(b: PixelBuffer, c: Color, n: number): void {
  const { w, h, data } = b;
  // A box erosion in two passes: `row` = all opaque within n px along the row, then down the column.
  const row = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let all = 1;
      for (let dx = -n; dx <= n && all; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < w && (data[y * w + xx] & 255) === 0) all = 0;
      }
      row[y * w + x] = all;
    }
  }
  const v = c >>> 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((data[i] & 255) === 0) continue;
      let all = 1;
      for (let dy = -n; dy <= n && all; dy++) {
        const yy = y + dy;
        if (yy >= 0 && yy < h && !row[yy * w + x]) all = 0;
      }
      if (!all) data[i] = v;
    }
  }
  b.touch();
}

/** Box filter of a 0/1 mask over (2n + 1) px along rows then columns: `all` = erosion, else dilation. */
function boxMask(m: Uint8Array, w: number, h: number, n: number, all: boolean): Uint8Array {
  const t = new Uint8Array(w * h);
  const o = new Uint8Array(w * h);
  const want = all ? 0 : 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = all ? 1 : 0;
      for (let d = -n; d <= n; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < w && m[y * w + xx] === want) {
          r = want;
          break;
        }
      }
      t[y * w + x] = r;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = all ? 1 : 0;
      for (let d = -n; d <= n; d++) {
        const yy = y + d;
        if (yy >= 0 && yy < h && t[yy * w + x] === want) {
          r = want;
          break;
        }
      }
      o[y * w + x] = r;
    }
  }
  return o;
}

/**
 * Open the silhouette (erode, then dilate, by `n` px): leaf strands and spurs narrower than
 * 2n + 1 px go, the rest of the silhouette keeps its exact edge and colours.
 */
export function openSilhouette(b: PixelBuffer, n: number): void {
  const { w, h, data } = b;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = (data[i] & 255) !== 0 ? 1 : 0;
  const keep = boxMask(boxMask(m, w, h, n, true), w, h, n, false);
  for (let i = 0; i < w * h; i++) if (!keep[i]) data[i] = 0;
  b.touch();
}
