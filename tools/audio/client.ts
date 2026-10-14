/**
 * A small ElevenLabs HTTP client for the audio tools: retries with backoff on 429/5xx and network
 * errors, and a fixed-size worker pool. `fetch` and `sleep` are injected so the tests never touch
 * the network. The API key lives only in this closure; it is never logged or written anywhere.
 */
import type { ApiRequest } from './lib';

export const API_BASE = 'https://api.elevenlabs.io';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}>;

export interface ClientOptions {
  key: string;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  /** Attempts per request, including the first one. */
  tries?: number;
  /** First backoff in ms (doubles each retry, plus jitter). */
  backoffMs?: number;
  log?: (line: string) => void;
}

export interface ApiResult {
  status: number;
  /** Audio bytes when the request expects audio. */
  audio?: Uint8Array;
  json?: unknown;
  /** A few response headers worth keeping (request id, character cost). */
  headers: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(`ElevenLabs HTTP ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

const KEEP_HEADERS = ['request-id', 'x-request-id', 'character-cost', 'x-character-count', 'song-id'];

export function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export interface Client {
  send(req: ApiRequest): Promise<ApiResult>;
}

export function createClient(opts: ClientOptions): Client {
  const doFetch = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const tries = opts.tries ?? 5;
  const backoff = opts.backoffMs ?? 2000;
  const log = opts.log ?? (() => {});
  const key = opts.key;

  async function once(req: ApiRequest): Promise<ApiResult> {
    const headers: Record<string, string> = { 'xi-api-key': key, accept: req.expect === 'audio' ? 'audio/mpeg' : 'application/json' };
    if (req.body) headers['content-type'] = 'application/json';
    const res = await doFetch(`${API_BASE}${req.path}`, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    const kept: Record<string, string> = {};
    for (const h of KEEP_HEADERS) {
      const v = res.headers.get(h);
      if (v) kept[h] = v;
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 600);
      } catch {
        detail = '(no body)';
      }
      throw new ApiError(res.status, scrub(detail, key));
    }
    if (req.expect === 'audio') return { status: res.status, audio: new Uint8Array(await res.arrayBuffer()), headers: kept };
    return { status: res.status, json: JSON.parse(await res.text()), headers: kept };
  }

  return {
    async send(req) {
      let last: unknown = null;
      for (let attempt = 1; attempt <= tries; attempt++) {
        try {
          return await once(req);
        } catch (err) {
          last = err;
          const status = err instanceof ApiError ? err.status : 0;
          if (err instanceof ApiError && !retryable(status)) throw err;
          if (attempt === tries) break;
          const wait = backoff * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
          log(`  retry ${attempt}/${tries - 1} after ${status || 'network error'} in ${(wait / 1000).toFixed(1)} s`);
          await sleep(wait);
        }
      }
      throw last instanceof Error ? last : new Error(String(last));
    },
  };
}

/** Never echo the key, even if an error body would contain it. */
export function scrub(text: string, key: string): string {
  return key ? text.split(key).join('<key>') : text;
}

/** Runs `work` over `list` with at most `n` in flight; results keep the input order. */
export async function pool<T, R>(list: readonly T[], n: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, list.length)) }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await work(list[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
