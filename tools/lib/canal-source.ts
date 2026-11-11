/**
 * The canal scenes' files in node (docs/api/canal.md §4): read from `public/` and inflated with
 * node's zlib, synchronously, so a canal section loads before the frame that draws it (tools, tests).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import type { CanalSource } from '../../src/game/mission/canal/registry';

export function nodeCanalSource(publicDir = resolve('public')): CanalSource {
  const read = (p: string): Uint8Array => new Uint8Array(readFileSync(join(publicDir, p)));
  return {
    read: async (p) => read(p),
    readSync: read,
    inflateSync: (d) => new Uint8Array(inflateSync(d)),
  };
}
