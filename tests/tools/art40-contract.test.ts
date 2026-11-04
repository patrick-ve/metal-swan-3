/**
 * The ams 40 px strip contract (docs/design/ams40/contract.json, tools/art40/contract/extract.ts):
 * it lists every id the game registers under the in-scope prefixes (no id missing, none extra),
 * each id belongs to one character, its frame counts match getFrames today, and every code
 * reference of the hand-read contract still resolves. Characters in BAKED (replaced by baked art)
 * only keep their ids (rule 1). A failure here: run `npm run art40-contract` (or
 * `npx tsx tools/art40/contract/extract.ts`) after a deliberate change and review the diff.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getFrames, listSprites } from '../../src/engine/sprites';
import { ART_MODULE_IDS, loadContent } from '../../src/game/content/index';
import { idsOf, resolveRef } from '../../tools/art40/contract/extract';
import { BAKED, SCOPE } from '../../tools/art40/contract/scope';

interface Entry {
  character: string;
  frames: number;
}
interface Contract {
  totals: { ids: number };
  ids: Record<string, Entry>;
}

const contract = JSON.parse(readFileSync(new URL('../../docs/design/ams40/contract.json', import.meta.url), 'utf8')) as Contract;
let all: string[] = [];

beforeAll(async () => {
  const r = await loadContent((id) => ART_MODULE_IDS.includes(id));
  expect(r.failed).toEqual([]);
  all = listSprites('');
});

describe('ams 40 px strip contract', () => {
  it('lists every registered in-scope id, each under one character', () => {
    expect(Object.keys(contract.ids).length).toBe(contract.totals.ids);
    for (const c of SCOPE) {
      const listed = Object.keys(contract.ids).filter((id) => contract.ids[id].character === c.key).sort();
      const registered = idsOf(c, all);
      if (BAKED.includes(c.key)) {
        // Rule 1: no id disappears (new ids may be added by the bake).
        expect(listed.filter((id) => !registered.includes(id)), `${c.key}: ids gone`).toEqual([]);
      } else {
        expect(registered.filter((id) => !listed.includes(id)), `${c.key}: ids missing from the contract`).toEqual([]);
        expect(listed.filter((id) => !registered.includes(id)), `${c.key}: ids no longer registered`).toEqual([]);
      }
    }
    const owners = new Map<string, string>();
    for (const c of SCOPE) for (const id of idsOf(c, all)) {
      expect(owners.get(id), `${id} in two scopes`).toBeUndefined();
      owners.set(id, c.key);
    }
  });

  it('frame counts match getFrames today', () => {
    const wrong: string[] = [];
    for (const [id, e] of Object.entries(contract.ids)) {
      if (BAKED.includes(e.character)) continue;
      const n = getFrames(id, 1).length;
      if (n !== e.frames) wrong.push(`${id}: contract ${e.frames}, game ${n}`);
    }
    expect(wrong).toEqual([]);
  });

  // A replaced character's old code may go (rule 8): its references may go stale.
  it('every code reference of the hand-read contract resolves (not yet replaced characters)', () => {
    const stale: string[] = [];
    for (const c of SCOPE) for (const r of c.rules) if (!BAKED.includes(c.key) && r.at && resolveRef(r.at).stale) stale.push(`${c.key}: ${r.at.file} "${r.at.find}"`);
    expect(stale).toEqual([]);
  });
});
