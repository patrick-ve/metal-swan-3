/**
 * The coverage gate for REPLACED ids (plan "Gates" 1). A replaced id is an id a baked set
 * registers in the game: '<prefix>/<strip>' (or the same strip under a variant prefix) whose
 * registered 1× frames are the set's frames decoded by the engine loader (src/engine/baked.ts).
 * For every replaced id: no sprite error (read AFTER the frames are built, so errors of this run
 * count), no placeholder, the 1× frames at every art density (no 2× / 4× generator, no dense
 * alias), the baked durations and loop flag. Problems (gate 1, "every contract id of the wave has
 * new frames"):
 * - an id the set holds that the game draws with OTHER frames ("not replaced": an old drawer
 *   registered it again after defineBakedSet, which overwrites silently);
 * - an id the set holds that the game does not register, when the contract needs it
 *   (`defineBakedSet(set, { only })` may leave out ids the contract does not list);
 * - a contract id under a replaced prefix (not marked skip) that is missing or not replaced;
 * - a set with no replaced id at all (baked but never registered).
 * Needs the content loaded first.
 */
import { bakedPalette, decodeBakedFrame, type BakedFrame } from '../../../src/engine/baked';
import { denseTarget, getFrames, hasHiSprite, hasSprite, placeholderFrames, spriteAnim, spriteErrors, type Frame } from '../../../src/engine/sprites';
import { setPrefixes, type ContractEntry } from './contract';
import type { CheckSet } from './types';

/** Ids a set holds (every prefix × every strip) with their prefix and strip name. */
export function setIds(set: CheckSet): Array<{ id: string; prefix: string; strip: string }> {
  const out: Array<{ id: string; prefix: string; strip: string }> = [];
  for (const prefix of setPrefixes(set)) for (const strip of Object.keys(set.strips)) out.push({ id: `${prefix}/${strip}`, prefix, strip });
  return out;
}

function samePixels(a: readonly Frame[], b: readonly Frame[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.ox !== y.ox || x.oy !== y.oy || x.buf.w !== y.buf.w || x.buf.h !== y.buf.h || (x.density ?? 1) !== (y.density ?? 1)) return false;
    const p = x.buf.data;
    const q = y.buf.data;
    for (let k = 0; k < p.length; k++) if (p[k] !== q[k]) return false;
  }
  return true;
}

export interface Coverage {
  /** Ids the game draws with the set's frames. */
  replaced: string[];
  /** Ids the set holds that the game does not register (fine unless the contract needs them). */
  unregistered: string[];
  /** Ids the set holds that the game still draws with other frames (old art). */
  notReplaced: string[];
  problems: string[];
}

export function coverage(sets: readonly CheckSet[], contract?: ReadonlyMap<string, ContractEntry>): Coverage {
  const cov: Coverage = { replaced: [], unregistered: [], notReplaced: [], problems: [] };
  const bad = cov.problems;
  const replacedPrefixes = new Set<string>();
  for (const set of sets) {
    const pals = new Map<string, Uint32Array>([[set.prefix, bakedPalette([...set.pal])], ...Object.entries(set.variants ?? {}).map(([p, v]) => [p, bakedPalette([...v])] as [string, Uint32Array])]);
    let n = 0;
    for (const { id, prefix, strip } of setIds(set)) {
      const st = set.strips[strip];
      if (!hasSprite(id)) {
        cov.unregistered.push(id);
        const c = contract?.get(id);
        if (c && !c.skip) bad.push(`${id}: in the contract, baked, but not registered (defineBakedSet only?)`);
        continue;
      }
      const f1 = getFrames(id, 1);
      if (f1 === placeholderFrames()) {
        bad.push(`${id}: placeholder`);
        continue;
      }
      const want = st.frames.map((f) => decodeBakedFrame(f as BakedFrame, pals.get(prefix) as Uint32Array));
      if (!samePixels(f1, want)) {
        cov.notReplaced.push(id);
        bad.push(`${id}: the game draws other frames than the baked set (an old drawer registers it again?)`);
        continue;
      }
      n++;
      cov.replaced.push(id);
      replacedPrefixes.add(prefix);
      for (const d of [2, 4] as const) {
        if (getFrames(id, d) !== f1) bad.push(`${id}: getFrames(${d}) is not the 1x strip`);
        if (hasHiSprite(id, d)) bad.push(`${id}: has a ${d}x generator`);
        if (denseTarget(id, d) !== id) bad.push(`${id}: dense alias to ${denseTarget(id, d)} at ${d}x`);
      }
      const a = spriteAnim(id);
      if (a.loop !== st.loop) bad.push(`${id}: loop ${a.loop}, baked ${st.loop}`);
      if (JSON.stringify(a.durations ?? []) !== JSON.stringify(st.durations)) bad.push(`${id}: durations ${JSON.stringify(a.durations)}, baked ${JSON.stringify(st.durations)}`);
    }
    if (n === 0) bad.push(`set ${set.slug}: no id is registered with its frames (baked but never registered: defineBakedSet missing?)`);
  }
  // Sprite errors after every getFrames above (the frames and the alias checks are built lazily).
  const errs = new Map(spriteErrors().map((e) => [e.id.replace(/@\dx$/, ''), e.error]));
  for (const id of cov.replaced) {
    const e = errs.get(id);
    if (e) bad.push(`${id}: sprite error ${e}`);
  }
  if (contract) {
    const replaced = new Set(cov.replaced);
    for (const [id, c] of contract) {
      const p = id.slice(0, id.lastIndexOf('/'));
      if (!replacedPrefixes.has(p) || c.skip || replaced.has(id)) continue;
      if (!hasSprite(id)) bad.push(`${id}: contract id missing (rule 1)`);
      else if (!cov.notReplaced.includes(id)) bad.push(`${id}: contract id under a replaced prefix still drawn with old art (no baked strip)`);
    }
  }
  return cov;
}

/** Problems of the replaced ids of `sets` (empty when covered). */
export function coverageProblems(sets: readonly CheckSet[], contract?: ReadonlyMap<string, ContractEntry>): string[] {
  return coverage(sets, contract).problems;
}
