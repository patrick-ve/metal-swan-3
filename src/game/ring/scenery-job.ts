/**
 * Dense ring scenery built off the main thread (review fix 2026-10-21; docs/api/ring.md
 * "Scenery"). A 4× road chunk (1024 × 492 px) takes about 5 ms to draw, up to 14 ms, so a chunk
 * job run inside a frame dropped frames at 4K. In the browser the view sends each dense chunk (and
 * the dense sky) to one module worker (scenery-worker.ts) and installs the frame when it arrives;
 * meanwhile it draws the chunk's lower density, as it did while a job waited in the queue.
 * Without Worker, or after the worker failed (one console.warn), the jobs go back to the
 * main-thread art job queue (sprites.ts `queueArtJob`) as before. Tools and tests build at once.
 *
 * `buildRingScenery` is the pure part (the worker runs it; tests compare it with the main-thread
 * build): the same generator on the same input gives byte-identical pixels.
 */
import { PixelBuffer } from '../../engine/pixel';
import type { Frame } from '../../engine/render';
import { withArtDensity } from '../../engine/sprites';
import { makeHiBgLayer, type SceneryDensity } from '../art/art-registry';

/** One dense layer buffer to build: generator id, logical size, params, seed, density. */
export interface RingSceneryRequest {
  id: number;
  gen: string;
  w: number;
  h: number;
  params: Readonly<Record<string, unknown>>;
  seed: number;
  d: SceneryDensity;
  /** Crop to the opaque box in whole logical px (chunks); false keeps the full buffer (the sky). */
  trim: boolean;
}

/** The built buffer (`px` null: no generator, an empty chunk or an error). */
export interface RingSceneryReply {
  id: number;
  px: ArrayBuffer | null;
  w: number;
  h: number;
  /** Crop origin in dense px (multiples of d). */
  x0: number;
  y0: number;
  d: SceneryDensity;
  error?: string;
}

/** The crop box of a dense buffer: its opaque box widened to whole logical px; null = empty. */
function cropBox(buf: PixelBuffer, d: number): { x0: number; y0: number; w: number; h: number } | null {
  const b = buf.trimBounds();
  if (!b) return null;
  const x0 = Math.floor(b.x / d) * d;
  const y0 = Math.floor(b.y / d) * d;
  const x1 = Math.ceil((b.x + b.w) / d) * d;
  const y1 = Math.ceil((b.y + b.h) / d) * d;
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

/** A dense buffer as a frame without its transparent margins (whole logical px); null = empty. */
export function trimmedFrame(buf: PixelBuffer, d: number): Frame | null {
  const c = cropBox(buf, d);
  if (!c) return null;
  const crop = c.x0 === 0 && c.y0 === 0 && c.w === buf.w && c.h === buf.h ? buf : buf.crop(c.x0, c.y0, c.w, c.h);
  return { buf: crop, ox: -c.x0 / d, oy: -c.y0 / d, density: d };
}

/** Build one request (the worker's job): the pixels to transfer and the reply. */
export function buildRingScenery(req: RingSceneryRequest): { reply: RingSceneryReply; transfer: ArrayBuffer[] } {
  const none = (error?: string): { reply: RingSceneryReply; transfer: ArrayBuffer[] } => ({
    reply: { id: req.id, px: null, w: 0, h: 0, x0: 0, y0: 0, d: req.d, ...(error ? { error } : {}) },
    transfer: [],
  });
  try {
    const buf = withArtDensity(1, () => makeHiBgLayer(req.gen, req.w, req.h, req.params, req.seed, req.d));
    if (!buf) return none();
    let out = buf;
    let x0 = 0;
    let y0 = 0;
    if (req.trim) {
      const c = cropBox(buf, req.d);
      if (!c) return none();
      if (c.x0 !== 0 || c.y0 !== 0 || c.w !== buf.w || c.h !== buf.h) out = buf.crop(c.x0, c.y0, c.w, c.h);
      x0 = c.x0;
      y0 = c.y0;
    }
    // The pixels as one whole ArrayBuffer (transferred, not copied).
    const data = out.data.byteOffset === 0 && out.data.buffer.byteLength === out.data.byteLength ? out.data : out.data.slice();
    const px = data.buffer as ArrayBuffer;
    return { reply: { id: req.id, px, w: out.w, h: out.h, x0, y0, d: req.d }, transfer: [px] };
  } catch (err) {
    return none(err instanceof Error ? err.message : String(err));
  }
}

/** The frame of a reply (null: none). The pixels are a view of the transferred buffer (no copy). */
export function replyFrame(r: RingSceneryReply): Frame | null {
  if (!r.px || r.w <= 0 || r.h <= 0) return null;
  const buf = new PixelBuffer(r.w, r.h, new Uint32Array(r.px));
  return { buf, ox: -r.x0 / r.d, oy: -r.y0 / r.d, density: r.d };
}

// =============================================================================================
// The browser side: one module worker for every ring view of the page
// =============================================================================================

interface Pending {
  key: string;
  install: (f: Frame | null) => void;
  fallback: () => void;
}

/** undefined = not tried yet; null = none (no Worker, or it failed). */
let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, Pending>();
const pendingKeys = new Set<string>();

function fail(why: string): void {
  console.warn(`[ring] scenery worker failed (building dense scenery on the main thread): ${why}`);
  const w = worker;
  worker = null;
  try {
    w?.terminate();
  } catch {
    // gone already
  }
  const left = [...pending.values()];
  pending.clear();
  pendingKeys.clear();
  for (const p of left) p.fallback();
}

function sceneryWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === 'undefined') return null;
  try {
    const w = new Worker(new URL('./scenery-worker.ts', import.meta.url), { type: 'module', name: 'ring-scenery' });
    w.onmessage = (e: MessageEvent<RingSceneryReply>) => {
      const r = e.data;
      const p = pending.get(r.id);
      if (!p) return;
      pending.delete(r.id);
      pendingKeys.delete(p.key);
      if (r.error) {
        console.warn(`[ring] scenery job "${p.key}" failed in the worker: ${r.error}`);
        p.fallback();
        return;
      }
      p.install(replyFrame(r));
    };
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault?.();
      fail(e.message || 'error');
    };
    w.onmessageerror = () => fail('message error');
    worker = w;
  } catch (err) {
    worker = null;
    console.warn(`[ring] no scenery worker (building dense scenery on the main thread): ${err instanceof Error ? err.message : String(err)}`);
  }
  return worker;
}

/**
 * Build a dense layer buffer in the worker (the browser). `install` gets the frame when it
 * arrives (null = none); `fallback` runs instead when the worker fails. Returns false when there
 * is no worker (the caller queues its main-thread job). A key already in flight is not sent again.
 */
export function requestRingScenery(key: string, req: Omit<RingSceneryRequest, 'id'>, install: (f: Frame | null) => void, fallback: () => void): boolean {
  const w = sceneryWorker();
  if (!w) return false;
  if (pendingKeys.has(key)) return true;
  const id = nextId++;
  pending.set(id, { key, install, fallback });
  pendingKeys.add(key);
  try {
    w.postMessage({ ...req, id } satisfies RingSceneryRequest);
  } catch (err) {
    pending.delete(id);
    pendingKeys.delete(key);
    console.warn(`[ring] scenery job "${key}" not sent: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
  return true;
}

/** Forget the jobs in flight whose key starts with `prefix` (their replies are dropped). */
export function cancelRingScenery(prefix: string): void {
  for (const [id, p] of pending) {
    if (!p.key.startsWith(prefix)) continue;
    pending.delete(id);
    pendingKeys.delete(p.key);
  }
}

/** Jobs in flight (tests, debug). */
export function ringSceneryInFlight(): number {
  return pending.size;
}
