import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { encodeBakedIndices } from '../../src/engine/baked';

/**
 * The art40 bake (tools/art40/bake.py) on its fixture set _probe. Needs python3 (offline tool):
 * skipped where there is none (CI reads the checked-in generated files only).
 */
const ROOT = join(__dirname, '..', '..');
const BAKE = join(ROOT, 'tools', 'art40', 'bake.py');
const FIX = join(ROOT, 'tests', 'fixtures', 'art40');
const FILES = ['_probe.gen.ts', '_probe.joints.json', '_probe.render.json'];
const hasPython = spawnSync('python3', ['-c', 'import sys; sys.exit(0)']).status === 0;
const dirs: string[] = [];

function bake(args: string[], seed = '0'): { code: number | null; out: string } {
  const r = spawnSync('python3', [BAKE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, PYTHONHASHSEED: seed, PYTHONDONTWRITEBYTECODE: '1' },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'art40-bake-'));
  dirs.push(d);
  return d;
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe.skipIf(!hasPython)('art40 bake (python3)', () => {
  it('--check passes on the checked-in probe', () => {
    const r = bake(['_probe', '--check']);
    expect(r.out).toMatch(/^ok _probe: 2 strips, 5 frames/);
    expect(r.code).toBe(0);
  });

  it('--check fails when one byte of a generated file changed (or the file is missing)', () => {
    for (const name of FILES) {
      const d = tempDir();
      for (const f of FILES) copyFileSync(join(FIX, f), join(d, f));
      expect(bake(['_probe', '--check', '--out', d]).code).toBe(0);
      const text = readFileSync(join(d, name), 'utf8');
      const i = text.indexOf('"_probe"');
      expect(i).toBeGreaterThan(0);
      writeFileSync(join(d, name), `${text.slice(0, i + 2)}P${text.slice(i + 3)}`);
      const r = bake(['_probe', '--check', '--out', d]);
      expect(r.code).toBe(1);
      expect(r.out).toContain(`${name} differs from the set`);
    }
    const empty = tempDir();
    const r = bake(['_probe', '--check', '--out', empty]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('is missing');
  });

  it('is deterministic: byte-identical across runs and PYTHONHASHSEED values, and equal to the fixture', () => {
    const outs = ['1', '2', '31337'].map((seed) => {
      const d = tempDir();
      expect(bake(['_probe', '--out', d], seed).code).toBe(0);
      return FILES.map((f) => readFileSync(join(d, f), 'utf8'));
    });
    const fixture = FILES.map((f) => readFileSync(join(FIX, f), 'utf8'));
    for (const o of outs) expect(o).toEqual(fixture);
  });

  it('the generated file has the header, the format fields and one export per event', () => {
    const ts = readFileSync(join(FIX, '_probe.gen.ts'), 'utf8');
    expect(ts.split('\n')[0]).toMatch(/^\/\/ GENERATED - do not edit/);
    expect(ts).toContain("import type { BakedSet } from '../../../src/engine/baked';");
    expect(ts).toContain('export const SET: BakedSet = {');
    expect(ts).toContain('export const SWING_HIT = 1;');
    expect(ts).toContain('  v: 2,');
    expect(ts).toContain('  face: 1,');
    expect(ts).toContain('      face: -1,');
  });

  it('the joint sidecar holds every joint and point of the joint-tracked strips, mirrored like the frames', () => {
    const j = JSON.parse(readFileSync(join(FIX, '_probe.joints.json'), 'utf8')) as { slug: string; strips: Record<string, Array<Record<string, [number, number]>>> };
    expect(j.slug).toBe('_probe');
    expect(Object.keys(j.strips)).toEqual(['swing']);
    expect(j.strips.swing.length).toBe(3);
    for (const f of j.strips.swing) expect(Object.keys(f).sort()).toEqual(['grip', 'hand', 'tip']);
    // face -1: x mirrored like the points
    expect(j.strips.swing[0].tip).toEqual(j.strips.swing[0].hand);
    expect(j.strips.swing[0].grip[0]).toBeLessThan(0);
  });

  it('the Python and TypeScript encoders write the same pixel stream', () => {
    const py = `
import sys
sys.path.insert(0, ${JSON.stringify(join(ROOT, 'tools', 'art40'))})
import art40 as X
rows = [[0] * 100 + [1, 2, 2, 90] + [5] * 200]
print(X.encode(rows))
print(X.decode(X.encode(rows), 304) == rows[0])
`;
    const r = spawnSync('python3', ['-c', py], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    const [px, ok] = r.stdout.trim().split('\n');
    const idx = [...new Array<number>(100).fill(0), 1, 2, 2, 90, ...new Array<number>(200).fill(5)];
    expect(px).toBe(encodeBakedIndices(idx));
    expect(ok).toBe('True');
  });

  it('normalize enforces the rules: budget, class count or why, smears, the slug rule, letters', () => {
    const py = `
import sys
sys.path.insert(0, ${JSON.stringify(join(ROOT, 'tools', 'art40'))})
import art40 as X
def attempt(slug, prefix, fn, budget=28):
    s = X.Set(prefix=prefix, budget=budget, colours={'K': '#140c0e', **{chr(65 + i): '#%02x2040' % (i * 8) for i in range(26)}, 'a': '#ffffff', 'b': '#fefefe', 'c': '#fdfdfd'})
    s.slug = slug
    fn(s)
    try:
        X.normalize(s)
        print('OK')
    except X.SetError as e:
        print('ERR', str(e).replace('\\n', ' '))
f = lambda rows: X.Frame(rows, (1, len(rows)))
attempt('x', 'enemy/x', lambda s: s.strip('idle', [f(['KA'])] * 4, 6, cls='idle'))
attempt('x', 'enemy/x', lambda s: s.strip('idle', [f(['KA'])] * 3, 6, cls='idle'))
attempt('x', 'enemy/x', lambda s: s.strip('idle', [f(['K' + ''.join(chr(65 + i) for i in range(26)) + 'abc'])] * 4, 6, cls='idle'))
attempt('x', 'enemy/x', lambda s: s.strip('kick', [X.Frame(['KA'], (1, 1), smear=True)] * 6, 2, cls='melee'))
attempt('y', 'enemy/x', lambda s: s.strip('idle', [f(['KA'])] * 4, 6, cls='idle'))
attempt('ams-staff-0', 'npc/ams/ams-staff/0', lambda s: s.strip('idle', [f(['KZ?'])] * 4, 6, cls='idle'))
attempt('x', 'enemy/x', lambda s: s.strip('idle', [f(['KA'])] * 4, 6, cls='walking'))
attempt('x', 'enemy/x', lambda s: s.strip('idle', [f(['KA'])] * 4, 6, cls='idle'), budget=40)
attempt('beer-bike', 'vehicle/beer-bike', lambda s: s.strip('idle', [f(['KA'])] * 4, 6, cls='idle'), budget=40)
def fxs(s):
    s.fx = ['a', 'B']
    s.strip('idle', [f(['KAaB'])] * 4, 6, cls='idle')
attempt('x', 'enemy/x', fxs)
attempt('x', 'enemy/x', lambda s: s.strip('turn', [f(['KA'])] * 2, 6, cls='turn'))
attempt('x', 'enemy/x', lambda s: s.strip('odd', [f(['KA'])] * 2, 6, cls='other'))
`;
    const r = spawnSync('python3', ['-c', py], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    const lines = r.stdout.trim().split('\n');
    expect(lines[0]).toBe('OK');
    expect(lines[1]).toMatch(/3 frames, class idle-breathing needs 4: give why/);
    expect(lines[2]).toMatch(/29 colours, the budget is 28/);
    expect(lines[3]).toMatch(/6 smear frames \(at most 2\)/);
    expect(lines[4]).toMatch(/needs chars\/x\//);
    expect(lines[5]).toMatch(/letters without a colour: \?/);
    expect(lines[6]).toMatch(/cls 'walking' is not an action class/);
    expect(lines[7]).toMatch(/budget 40 is only for beer-bike/);
    expect(lines[8]).toBe('OK');
    expect(lines[9]).toMatch(/fx letter 'B': #082040 is not a colour of the shared FX ramp/);
    expect(lines[10]).toBe('OK');
    expect(lines[11]).toMatch(/class other always needs a logged reason/);
  });

  it('reports a broken set instead of writing it', () => {
    const r = bake(['no-such-set']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('unknown set');
  });
});
