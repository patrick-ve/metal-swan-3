/**
 * In-memory instrumentation for extract.ts: records where each sprite id is defined. It rewrites
 * the engine's sprites module as it loads (the file on disk is never touched): every define call
 * reports its id and a stack to `globalThis.__art40Trace` when that function exists.
 */
import { registerHooks } from 'node:module';

const FNS = ['defineSprite', 'defineHiSprite', 'defineHdSprite', 'defineDenseAlias'];

export function installTraceHook(): void {
  registerHooks({
    load(url, context, nextLoad) {
      const r = nextLoad(url, context);
      if (!url.includes('/src/engine/sprites.ts') || r.source == null) return r;
      let src = typeof r.source === 'string' ? r.source : Buffer.from(r.source as Uint8Array).toString('utf8');
      for (const fn of FNS) {
        // Lazy up to the first `){` (default values such as `opts={}` hold braces).
        const re = new RegExp(`(function ${fn}\\(([a-zA-Z_$][\\w$]*)[\\s\\S]*?\\)\\s*\\{)`);
        src = src.replace(re, (_m, head: string, id: string) => `${head}globalThis.__art40Trace?.(${JSON.stringify(fn)}, ${id}, new Error().stack);`);
      }
      return { ...r, source: src };
    },
  });
}
