/**
 * npm run art40-contract [-- --check] (or: npx tsx tools/art40/contract/extract.ts)
 *
 * The strip contract of mission ams at 40 px (docs/design/ams40.md "Rules: replaced correctly"):
 * loads every art module, reads the sprite registry for every in-scope id of scope.ts (frame
 * count, logical size, anchor and points per frame, timing, loop / defer, dense art and aliases,
 * where the id is defined) and merges the hand-read code contract of scope.ts (frame roles,
 * points, logic times, speeds, hitboxes, fit points; every code reference resolved to file:line).
 * Writes docs/design/ams40/contract.json (machine-readable) and contract.md (readable).
 * `--check` writes nothing and exits 1 when either file differs from a fresh extraction.
 *
 * Deterministic: no clock, no random; ids, keys and lists are sorted. The define sites come from
 * an in-memory instrumentation of src/engine/sprites.ts (trace-hook.ts); nothing on disk changes.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, CLASSES } from './classes';
import { machineFor, type ContractEventSpec } from './data';
import { NOTES, SCOPE, type CharacterScope, type Matcher, type Ref } from './scope';
import { installTraceHook } from './trace-hook';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = join(ROOT, 'docs', 'design', 'ams40');
export const CONTRACT_JSON = join(OUT_DIR, 'contract.json');
export const CONTRACT_MD = join(OUT_DIR, 'contract.md');
const GEOMETRY_FIXTURE = join(ROOT, 'tests', 'engine', 'fixtures', 'sprite-geometry.json');

// ------------------------------------------------------------------------------- id matching

export function matches(m: Matcher, id: string): boolean {
  return 'exact' in m ? id === m.exact : id.startsWith(m.prefix);
}

/** The in-scope ids of a character among `all` (sorted). */
export function idsOf(c: CharacterScope, all: readonly string[]): string[] {
  return all.filter((id) => c.ids.some((m) => matches(m, id)));
}

/** The set prefix of an id: everything up to its last '/' (looks, skins and P2 are sets of their own). */
function setOf(_c: CharacterScope, id: string): string {
  return id.slice(0, id.lastIndexOf('/') + 1);
}

/** The strip name of an id: the part after its set prefix. */
function stripOf(c: CharacterScope, id: string): string {
  return id.slice(setOf(c, id).length);
}

// ------------------------------------------------------------------------------- define sites

interface Sites {
  base: string[];
  dense: string[];
  alias: string[];
}

const SITE_RE = /\(?((?:file:\/\/)?\/[^():]+\.ts):(\d+):\d+\)?$/;

/** Up to 3 src/ call sites of a stack (outside the sprites module), "file:line", consecutive files merged. */
function sitesOf(stack: string): string[] {
  const out: string[] = [];
  let last = '';
  for (const line of stack.split('\n').slice(1)) {
    const m = SITE_RE.exec(line.trim());
    if (!m) continue;
    const file = relative(ROOT, m[1].replace(/^file:\/\//, '')).split('\\').join('/');
    if (!file.startsWith('src/') || file === 'src/engine/sprites.ts' || file === 'src/game/content/index.ts') continue;
    if (file === last) continue;
    last = file;
    out.push(`${file}:${m[2]}`);
    if (out.length >= 3) break;
  }
  return out;
}

// ------------------------------------------------------------------------------- code references

const fileCache = new Map<string, string[] | null>();

function linesOf(file: string): string[] | null {
  if (!fileCache.has(file)) {
    const p = join(ROOT, file);
    fileCache.set(file, existsSync(p) ? readFileSync(p, 'utf8').split('\n') : null);
  }
  return fileCache.get(file) ?? null;
}

/** "file:line" of a reference, or "file:? (stale: …)" when the text is not found. */
export function resolveRef(r: Ref): { at: string; stale: boolean } {
  const lines = linesOf(r.file);
  if (!lines) return { at: `${r.file}:? (stale: file missing)`, stale: true };
  const i = lines.findIndex((l) => l.includes(r.find));
  return i < 0 ? { at: `${r.file}:? (stale: text not found)`, stale: true } : { at: `${r.file}:${i + 1}`, stale: false };
}

/** Every .ts file under `dir` (relative to ROOT, sorted). */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

/** "file:line" of every line in `files` that contains one of `words` (sorted, deduplicated). */
function mentions(files: readonly string[], words: readonly string[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    const lines = linesOf(f) ?? [];
    lines.forEach((l, i) => {
      if (words.some((w) => l.includes(w))) out.push(`${f}:${i + 1}`);
    });
  }
  return out;
}

// ------------------------------------------------------------------------------- extraction

interface FrameInfo {
  w: number;
  h: number;
  ox: number;
  oy: number;
  pts: string[];
}

export interface IdEntry {
  character: string;
  set: string;
  strip: string;
  frames: number;
  /** [w, h] when every frame has it, else one per frame. */
  size: [number, number] | Array<[number, number]>;
  /** [ox, oy] when every frame has it, else one per frame. */
  anchor: [number, number] | Array<[number, number]>;
  /** 'feet' (every frame anchored on its bottom row), 'center' (on its middle) or 'custom'. */
  anchorKind: 'feet' | 'center' | 'custom';
  /** Point names on each frame (index = frame). */
  framePoints: string[][];
  /** The point names the code reads on this strip (data.ts); absent: unknown, keep every old point. */
  readPoints?: string[];
  /** Total ticks the code relies on (rule 4), when it does. */
  logicTicks?: number;
  /** The code shows the strip only this many ticks from its start (frames starting later are never seen). */
  shownTicks?: number;
  /** Named constants the bake exports for frames / ticks the code acts on (rule 4). */
  events?: ContractEventSpec[];
  /** Ground speed for the foot-slide gate (px per tick; px per frame when perFrame). */
  speed?: number;
  perFrame?: boolean;
  /** Why a locomotion strip has no floor contact. */
  noFoot?: string;
  ticksPerFrame: number;
  durations: number[] | null;
  loop: boolean;
  defer: boolean;
  /** One pass in ticks (durations cycled over the frames, else frames × ticksPerFrame). */
  totalTicks: number;
  dense: { x2: boolean; x4: boolean; alias2: string | null; alias4: string | null };
  /** Where the id is defined (src file:line, the 1× registration first, then the dense ones). */
  defs: string[];
  class: string;
  refFrames: string;
  targetFrames: number | null;
  /** Out of scope although under an in-scope prefix (UI pictures): why. */
  skip: string | null;
  geometryFixture: boolean;
  tests: string[];
}

function uniform<T>(xs: readonly T[], key: (x: T) => string): boolean {
  return xs.every((x) => key(x) === key(xs[0]));
}

export interface Contract {
  about: string;
  plan: string;
  classes: typeof CLASSES;
  notes: readonly string[];
  totals: { characters: number; ids: number; frames: number; staleRefs: number };
  /** Where today's art differs from what the code relies on (logic ticks, read points). */
  findings: string[];
  characters: unknown[];
  ids: Record<string, IdEntry>;
}

/** Build the contract (loads the content; call once per process). */
export async function extract(): Promise<Contract> {
  installTraceHook();
  const sites = new Map<string, Sites>();
  (globalThis as { __art40Trace?: (fn: string, id: string, stack: string) => void }).__art40Trace = (fn, id, stack) => {
    let s = sites.get(id);
    if (!s) sites.set(id, (s = { base: [], dense: [], alias: [] }));
    const at = sitesOf(stack);
    if (fn === 'defineSprite') s.base = at; // the last registration wins
    else if (at.length > 0) {
      const list = fn === 'defineDenseAlias' ? s.alias : s.dense;
      // Calls that come through defineSprite (`hd`, `hi`) name the same site as the base.
      for (const a of at.slice(0, 1)) if (!list.includes(a)) list.push(a);
    }
  };
  const S = await import('../../../src/engine/sprites');
  const C = await import('../../../src/game/content/index');
  const report = await C.loadContent((id) => C.ART_MODULE_IDS.includes(id));
  if (report.failed.length > 0) throw new Error(`content failed to load: ${report.failed.map((f) => f.id).join(', ')}`);

  const all = S.listSprites('');
  const fixture = new Set(Object.keys(JSON.parse(readFileSync(GEOMETRY_FIXTURE, 'utf8')) as Record<string, string>));
  const testFiles = tsFiles('tests');
  const srcFiles = tsFiles('src');
  const ids: Record<string, IdEntry> = {};
  const owner = new Map<string, string>();
  const characters: unknown[] = [];
  let frameTotal = 0;
  let stale = 0;
  /** Contract points that today's art does not meet (listed, not fixed: wave 0 changes no game file). */
  const findings: string[] = [];

  for (const c of SCOPE) {
    const mine = idsOf(c, all);
    if (mine.length === 0) throw new Error(`${c.key}: no registered id matches its scope`);
    // Tests that name an id (literal) or the character's words.
    const words = [...new Set([...c.testWords, ...c.ids.map((m) => ('exact' in m ? m.exact : m.prefix.replace(/\/$/, '')))])];
    const testHits = mentions(testFiles, words);
    const srcHits = mentions(srcFiles, c.ids.map((m) => ('exact' in m ? m.exact : m.prefix.replace(/\/$/, ''))));
    for (const id of mine) {
      const prev = owner.get(id);
      if (prev) throw new Error(`${id} is in the scope of both ${prev} and ${c.key}`);
      owner.set(id, c.key);
      const frames = S.getFrames(id, 1);
      const info: FrameInfo[] = frames.map((f) => ({ w: S.frameW(f), h: S.frameH(f), ox: f.ox, oy: f.oy, pts: Object.keys(f.pts ?? {}).sort() }));
      const anim = S.spriteAnim(id);
      const n = frames.length;
      const durations = anim.durations ? [...anim.durations] : null;
      let totalTicks = 0;
      for (let i = 0; i < n; i++) totalTicks += durations && durations.length > 0 ? Math.max(1, Math.round(durations[i % durations.length])) : anim.ticksPerFrame;
      const strip = stripOf(c, id);
      const cls = id.startsWith('item/bind/') ? CLASSES.prop : classify(strip, c.kind);
      const skip = c.skipStrips?.find((s) => s.strip === strip)?.why ?? null;
      const a2 = S.denseTarget(id, 2);
      const a4 = S.denseTarget(id, 4);
      const lit = `'${id}'`;
      const tests = testFiles.filter((f) => (linesOf(f) ?? []).some((l) => l.includes(lit) || l.includes(`"${id}"`) || l.includes(`\`${id}\``)));
      ids[id] = {
        character: c.key,
        set: setOf(c, id),
        strip,
        frames: n,
        size: uniform(info, (f) => `${f.w},${f.h}`) ? [info[0].w, info[0].h] : info.map((f) => [f.w, f.h] as [number, number]),
        anchor: uniform(info, (f) => `${f.ox},${f.oy}`) ? [info[0].ox, info[0].oy] : info.map((f) => [f.ox, f.oy] as [number, number]),
        anchorKind: info.every((f) => f.oy === f.h) ? 'feet' : info.every((f) => f.oy === f.h >> 1 && f.ox === f.w >> 1) ? 'center' : 'custom',
        framePoints: info.map((f) => f.pts),
        ...machineFor(c.key, strip),
        ticksPerFrame: anim.ticksPerFrame,
        durations,
        loop: anim.loop,
        defer: S.isDeferredSprite(id),
        totalTicks,
        dense: { x2: S.hasHiSprite(id, 2), x4: S.hasHiSprite(id, 4), alias2: a2 !== id ? a2 : null, alias4: a4 !== id ? a4 : null },
        // The define call site of each kind (the 1× registration, its dense generator, its alias).
        defs: ((d) => [...new Set([...d.base.slice(0, 2), ...d.dense.slice(0, 1), ...d.alias.slice(0, 1)])])(sites.get(id) ?? { base: [], dense: [], alias: [] }),
        class: cls.id,
        refFrames: cls.ref,
        targetFrames: skip ? null : cls.target,
        skip,
        geometryFixture: fixture.has(id),
        tests,
      };
      frameTotal += n;
      const e = ids[id];
      if (e.logicTicks !== undefined && e.logicTicks !== totalTicks) findings.push(`${id}: the code relies on ${e.logicTicks} ticks, the strip has ${totalTicks} today`);
      for (const p of e.readPoints ?? []) {
        const on = e.framePoints.filter((f) => f.includes(p)).length;
        if (on > 0 && on < n) findings.push(`${id}: the code reads \`${p}\`, only ${on} of ${n} frames have it today`);
      }
    }
    const related = (c.related ?? []).map((r) => ({
      why: r.why,
      ids: all.filter((id) => matches(r.match, id) && !mine.includes(id)),
    }));
    const rules = c.rules.map((r) => {
      const res = r.at ? resolveRef(r.at) : null;
      if (res?.stale) stale++;
      return { kind: r.kind, strips: r.strips, text: r.text, at: res?.at ?? null, stale: res?.stale ?? false };
    });
    // Sets in the order of the scope's matchers (the base set first), then by name.
    const rank = (set: string): number => c.ids.findIndex((m) => mine.some((id) => setOf(c, id) === set && matches(m, id)));
    const sets = [...new Set(mine.map((id) => setOf(c, id)))].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
    characters.push({
      key: c.key,
      name: c.name,
      wave: c.wave,
      kind: c.kind,
      ids: mine.length,
      frames: mine.reduce((t, id) => t + ids[id].frames, 0),
      matchers: c.ids,
      sets: sets.map((s) => ({ prefix: s, ids: mine.filter((id) => setOf(c, id) === s).length })),
      variants: c.sets,
      related,
      rules,
      keep: c.keep,
      readers: c.readers,
      srcMentions: srcHits,
      testMentions: testHits,
    });
  }
  const sortedIds: Record<string, IdEntry> = {};
  for (const k of Object.keys(ids).sort()) sortedIds[k] = ids[k];
  return {
    about: 'Strip contract of mission ams at 40 px (docs/design/ams40.md, rules "replaced correctly"). Generated by tools/art40/contract/extract.ts: do not edit by hand.',
    plan: 'docs/design/ams40.md',
    classes: CLASSES,
    notes: NOTES,
    totals: { characters: SCOPE.length, ids: Object.keys(ids).length, frames: frameTotal, staleRefs: stale },
    findings,
    characters,
    ids: sortedIds,
  };
}

// ------------------------------------------------------------------------------- markdown

type Char = {
  key: string;
  name: string;
  wave: number;
  kind: string;
  ids: number;
  frames: number;
  sets: Array<{ prefix: string; ids: number }>;
  variants: ReadonlyArray<{ prefix: string; variant: string }>;
  related: Array<{ why: string; ids: string[] }>;
  rules: Array<{ kind: string; strips: readonly string[]; text: string; at: string | null; stale: boolean }>;
  keep: readonly string[];
  srcMentions: string[];
  testMentions: string[];
};

const fmtTime = (e: IdEntry): string => (e.durations ? `[${e.durations.join(', ')}]` : `${e.ticksPerFrame}/f`) + ` = ${e.totalTicks}`;
const fmtSize = (e: IdEntry): string => (Array.isArray(e.size[0]) ? 'varies' : (e.size as number[]).join('×'));
const fmtAnchor = (e: IdEntry): string => (Array.isArray(e.anchor[0]) ? 'varies' : `(${(e.anchor as number[]).join(', ')})`);
const fmtPoints = (e: IdEntry): string => {
  const all = [...new Set(e.framePoints.flat())].sort();
  if (all.length === 0) return '-';
  const read = e.readPoints ? new Set(e.readPoints) : null;
  const names = all.map((n) => (read?.has(n) ? `**${n}**` : n)).join(', ');
  return e.framePoints.every((p) => p.join() === e.framePoints[0].join()) ? names : `per frame (${names})`;
};
const fmtDense = (e: IdEntry): string => {
  const p: string[] = [];
  if (e.dense.alias2 || e.dense.alias4) p.push(`alias → ${e.dense.alias4 ?? e.dense.alias2}`);
  else if (e.dense.x2 || e.dense.x4) p.push([e.dense.x2 ? '2×' : '', e.dense.x4 ? '4×' : ''].filter(Boolean).join(' '));
  return p.join(' ') || '-';
};
const fmtMachine = (e: IdEntry): string => {
  const p: string[] = [];
  if (e.logicTicks !== undefined) p.push(`${e.logicTicks} ticks`);
  if (e.shownTicks !== undefined) p.push(`shown ${e.shownTicks} ticks`);
  for (const v of e.events ?? []) p.push(`\`${v.name}\`${v.tick !== undefined ? ` @${v.tick}` : ''}`);
  if (e.speed !== undefined) p.push(`${e.speed} px/${e.perFrame ? 'frame' : 'tick'}`);
  if (e.noFoot) p.push('no floor contact');
  return p.join(', ') || '-';
};
const fmtTarget = (e: IdEntry): string => (e.skip ? 'skip (UI)' : `${e.class}${e.targetFrames !== null ? ` → ${e.targetFrames}` : ''}`);
const flags = (e: IdEntry): string => [e.loop ? 'loop' : 'once', e.defer ? 'defer' : ''].filter(Boolean).join(' ');

function stripTable(rows: IdEntry[], ids: string[]): string[] {
  const out = ['| strip | frames | size | anchor | ticks | play | points (**read**) | code relies on | dense art | class → target |', '|---|---|---|---|---|---|---|---|---|---|'];
  rows.forEach((e, i) => out.push(`| \`${ids[i].slice(e.set.length) || ids[i]}\` | ${e.frames} | ${fmtSize(e)} | ${fmtAnchor(e)} ${e.anchorKind} | ${fmtTime(e)} | ${flags(e)} | ${fmtPoints(e)} | ${fmtMachine(e)} | ${fmtDense(e)} | ${fmtTarget(e)} |`));
  return out;
}

/** One line per strip that differs from the reference set (frames, timing, points). */
function setDiff(ref: Map<string, IdEntry>, rows: Array<[string, IdEntry]>): string[] {
  const out: string[] = [];
  const key = (e: IdEntry): string => `${e.frames}|${fmtTime(e)}|${fmtPoints(e)}|${flags(e)}`;
  for (const [, e] of rows) {
    const r = ref.get(e.strip);
    if (!r) out.push(`\`${e.strip}\` (only here: ${e.frames} frames, ${fmtTime(e)})`);
    else if (key(r) !== key(e)) out.push(`\`${e.strip}\` (${e.frames} frames, ${fmtTime(e)}, ${fmtPoints(e)})`);
  }
  for (const s of ref.keys()) if (!rows.some(([, e]) => e.strip === s)) out.push(`\`${s}\` missing`);
  return out;
}

export function toMarkdown(c: Contract): string {
  const L: string[] = [];
  L.push('# ams at 40 px: the strip contract');
  L.push('');
  L.push('Generated by `tools/art40/contract/extract.ts` (`npm run art40-contract`; `--check` compares). Do not edit by hand:');
  L.push('change `tools/art40/contract/scope.ts` (the hand-read code contract) and run it again. Machine-readable twin:');
  L.push('`contract.json` (one entry per id, one per character). Plan: `docs/design/ams40.md` ("Rules: replaced correctly").');
  L.push('');
  L.push(`Totals: ${c.totals.characters} characters, ${c.totals.ids} ids, ${c.totals.frames} frames today; stale code references: ${c.totals.staleRefs}.`);
  L.push('');
  L.push('Columns: `ticks` = durations (cycled) or ticks per frame, `=` one pass; `play` = loop or once (+ deferred);');
  L.push('`dense art` = 2× / 4× generators today or the dense alias target (rule 7 drops both); `class → target` = the');
  L.push('plan\'s action class and the reference frame count (no target: the count is a code number or a logged decision).');
  L.push('Code references are `file:line` resolved on the extraction run.');
  L.push('');
  L.push('## Today\'s art against the code');
  L.push('');
  if (c.findings.length === 0) L.push('Every logic time and read point of `data.ts` holds on today\'s strips.');
  for (const f of c.findings) L.push(`- ${f}`);
  L.push('');
  L.push('## Notes for every wave');
  L.push('');
  for (const n of c.notes) L.push(`- ${n}`);
  L.push('');
  const chars = c.characters as Char[];
  const byKey = new Map(chars.map((ch) => [ch.key, ch]));
  const entries = Object.entries(c.ids);
  for (const wave of [...new Set(chars.map((ch) => ch.wave))].sort((a, b) => a - b)) {
    L.push(`## Wave ${wave}`);
    L.push('');
    for (const ch of chars.filter((x) => x.wave === wave)) {
      L.push(`### ${ch.name} (\`${ch.key}\`)`);
      L.push('');
      L.push(`${ch.ids} ids, ${ch.frames} frames; kind ${ch.kind}.`);
      L.push('');
      L.push('**What the replacement must keep**');
      L.push('');
      for (const k of ch.keep) L.push(`- ${k}`);
      L.push('');
      L.push('**Sets and variants**');
      L.push('');
      for (const v of ch.variants) L.push(`- \`${v.prefix}\`: ${v.variant}`);
      L.push(`- registered sets: ${ch.sets.map((s) => `\`${s.prefix}\` (${s.ids})`).join(', ')}`);
      for (const r of ch.related) if (r.ids.length > 0) L.push(`- not in scope: ${r.ids.length} ids — ${r.why}`);
      L.push('');
      L.push('**Code contract** (read from the code, wave 0)');
      L.push('');
      for (const r of ch.rules) L.push(`- *${r.kind}* [${r.strips.join(', ')}] ${r.text}${r.at ? ` — \`${r.at}\`` : ''}`);
      L.push('');
      // The strip table: the first set in full, the other sets as differences.
      const mine = entries.filter(([, e]) => e.character === ch.key);
      const baseKey = ch.key.startsWith('hero-') && ch.key !== 'hero-vincent' ? 'hero-vincent' : null;
      const refRows = baseKey ? entries.filter(([, e]) => e.character === baseKey && e.set === byKey.get(baseKey)?.sets[0]?.prefix) : null;
      const sets = ch.sets.map((s) => s.prefix);
      const first = sets.includes(`${ch.key.replace(/^hero-/, 'char/')}/`) ? `${ch.key.replace(/^hero-/, 'char/')}/` : sets[0];
      const order = [first, ...sets.filter((s) => s !== first)];
      if (refRows) {
        const ref = new Map(refRows.map(([, e]) => [e.strip, e]));
        const d = setDiff(ref, mine);
        L.push(`**Strips**: as \`hero-vincent\`${d.length ? `, except: ${d.join('; ')}` : ' (same counts, timing, points)'}.`);
        L.push('');
      } else {
        const head = mine.filter(([, e]) => e.set === order[0]);
        L.push(`**Strips of \`${order[0]}\`**`);
        L.push('');
        L.push(...stripTable(head.map(([, e]) => e), head.map(([id]) => id)));
        L.push('');
        const ref = new Map(head.map(([, e]) => [e.strip, e]));
        for (const s of order.slice(1)) {
          const rows = mine.filter(([, e]) => e.set === s);
          if (!rows.some(([, e]) => ref.has(e.strip))) {
            // A set with strips of its own (a prop, an exact id): its own table.
            L.push(`**Strips of \`${s}\`**`);
            L.push('');
            L.push(...stripTable(rows.map(([, e]) => e), rows.map(([id]) => id)));
            L.push('');
            continue;
          }
          const d = setDiff(ref, rows);
          L.push(`- \`${s}\`: ${d.length ? d.join('; ') : 'same strips, counts, timing and points'}`);
        }
        if (order.length > 1) L.push('');
      }
      const fx = mine.filter(([, e]) => e.geometryFixture).length;
      const pinned = [...new Set(mine.flatMap(([, e]) => e.tests))].sort();
      L.push(`- **Tests**: ${fx} of ${mine.length} ids in \`tests/engine/fixtures/sprite-geometry.json\`; tests naming an id literally: ${pinned.length ? pinned.map((t) => `\`${t}\``).join(', ') : 'none'}.`);
      const tf = [...new Set(ch.testMentions.map((m) => m.slice(0, m.lastIndexOf(':'))))].sort();
      L.push(`- Tests mentioning the character: ${tf.map((t) => `\`${t}\``).join(', ') || 'none'}.`);
      const sf = [...new Set(ch.srcMentions.map((m) => m.slice(0, m.lastIndexOf(':'))))].sort();
      L.push(`- Source files naming its ids: ${sf.map((t) => `\`${t}\``).join(', ') || 'none'}.`);
      const defs = [...new Set(mine.flatMap(([, e]) => e.defs).map((s) => s.slice(0, s.lastIndexOf(':'))))].sort();
      L.push(`- Defined in: ${defs.map((t) => `\`${t}\``).join(', ')}.`);
      L.push('');
    }
  }
  return L.join('\n') + '\n';
}

// ------------------------------------------------------------------------------- main

/** The JSON text: the header keys on their own lines, then one line per character and one per id (diff-friendly, compact). */
export function contractJson(c: Contract): string {
  const head = (['about', 'plan', 'classes', 'notes', 'totals', 'findings'] as const).map((k) => `${JSON.stringify(k)}:${JSON.stringify(c[k])}`);
  const chars = c.characters.map((ch) => JSON.stringify(ch));
  // Id entries leave out nulls, empty test lists and the class's reference count (in `classes`).
  const drop = (k: string, v: unknown): unknown => (v === null || k === 'refFrames' || (k === 'tests' && Array.isArray(v) && v.length === 0) ? undefined : v);
  const ids = Object.keys(c.ids).map((id) => `${JSON.stringify(id)}:${JSON.stringify(c.ids[id], drop)}`);
  return `{${head.join(',\n')},\n"characters":[\n${chars.join(',\n')}\n],\n"ids":{\n${ids.join(',\n')}\n}}\n`;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  // Quiet the sprite generators' own warnings (placeholders still show in spriteErrors()).
  const warn = console.warn;
  console.warn = () => {};
  const c = await extract();
  console.warn = warn;
  const json = contractJson(c);
  const md = toMarkdown(c);
  if (check) {
    const same = (p: string, s: string): boolean => existsSync(p) && readFileSync(p, 'utf8') === s;
    const ok = same(CONTRACT_JSON, json) && same(CONTRACT_MD, md);
    console.log(ok ? 'contract: up to date' : 'contract: OUT OF DATE (run npm run art40-contract)');
    process.exit(ok ? 0 : 1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(CONTRACT_JSON, json);
  writeFileSync(CONTRACT_MD, md);
  console.log(`contract: ${c.totals.characters} characters, ${c.totals.ids} ids, ${c.totals.frames} frames, ${c.totals.staleRefs} stale refs`);
  console.log(`wrote ${relative(ROOT, CONTRACT_JSON)} (${(json.length / 1024).toFixed(0)} KB), ${relative(ROOT, CONTRACT_MD)} (${(md.length / 1024).toFixed(0)} KB)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
