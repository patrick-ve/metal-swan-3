/**
 * The strip source registry (docs/design/oat.md (deleted; git show eb3316a) §8.6; the contract: ./types.ts). A source registers
 * at import time (`defineStripSource('xyz-facade', grammarSource)`); the store looks it up
 * by `SectionStripsDef.source` when a section loads. Unknown ids fail soft: no strips (warned once).
 */
import type { StripSource } from './types';

const sources = new Map<string, StripSource>();
const warned = new Set<string>();

/** Register (or replace) a strip source. Returns it. */
export function defineStripSource(id: string, src: StripSource): StripSource {
  sources.set(id, src);
  return src;
}

/** The registered source, or undefined (warned once per id). */
export function getStripSource(id: string): StripSource | undefined {
  const s = sources.get(id);
  if (!s && !warned.has(id)) {
    warned.add(id);
    console.warn(`[strips] unknown strip source "${id}": the section draws no façade strips`);
  }
  return s;
}

export function hasStripSource(id: string): boolean {
  return sources.has(id);
}
