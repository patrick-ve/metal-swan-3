"""The art40 bake: renders a set and writes its generated TypeScript file.

  npm run art40 -- <slug> [<slug> ...]   bake those sets (src/game/content/art40/<slug>.gen.ts and
                                         the joint sidecar tools/art40/joints/<slug>.json; '_'
                                         fixture sets: tests/fixtures/art40/<slug>.gen.ts,
                                         <slug>.joints.json and <slug>.render.json)
  npm run art40 -- --all                 every set in tools/art40/chars/
  ... --check                            render in memory; exit 1 when a checked-in file differs
  ... --sheet                            also tmp/art40/<slug>/sheet.png and <strip>.gif
  ... --out <dir>                        read / write the generated files in <dir> instead
  ... --list                             print the set slugs
  (the action classes, budgets and FX ramp come from tools/art40/rules.json, written by
   npm run art40-check -- --write-rules from tools/art40/check/rules.ts)

Every set runs in a process of its own (set modules patch the shared rig tables in place). The
output is byte-identical across runs and PYTHONHASHSEED values.
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import art40 as X  # noqa: E402


def outputs(slug, baked, render, out=None):
    """{absolute path: text} of one baked set."""
    d = out or X.canonical_out(slug)
    files = {os.path.join(d, slug + '.gen.ts'): X.to_ts(baked)}
    if slug.startswith('_'):
        files[os.path.join(d, slug + '.render.json')] = X.to_render_json(render)
    j = X.to_joints_json(baked, render)
    if j is not None:
        files[X.joints_out(slug, out)] = j
    return files


def one(slug, check=False, sheet=False, out=None):
    """Bake one set in this process. Returns (ok, message)."""
    try:
        s = X.build(slug)
        baked, render = X.normalize(s)
    except X.SetError as e:
        return False, f'FAIL {e}'
    files = outputs(slug, baked, render, out)
    nframes = sum(len(st['frames']) for st in baked['strips'].values())
    ts = next(t for p, t in files.items() if p.endswith('.gen.ts'))
    size = len(ts.encode())
    info = (f"{slug}: {len(baked['strips'])} strips, {nframes} frames, {len(baked['pal']) - 1} palette entries "
            f"(budget {baked['budget']}), {size // 1024} KB")
    bad = []
    for p, text in files.items():
        if check:
            try:
                with open(p, encoding='utf-8', newline='') as f:
                    have = f.read()
            except OSError:
                have = None
            if have != text:
                bad.append(os.path.relpath(p, X.ROOT) + (' is missing' if have is None else ' differs from the set'))
        else:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w', encoding='utf-8', newline='') as f:
                f.write(text)
    if sheet:
        import sheet as SH
        sd = os.path.join(X.ROOT, 'tmp', 'art40', slug)
        SH.sheet(render, baked, os.path.join(sd, 'sheet.png'))
        for name, frames in render['strips'].items():
            SH.gif(frames, baked['strips'][name]['durations'], render['pal'],
                   os.path.join(sd, name.replace('/', '_') + '.gif'))
        info += f'; sheet tmp/art40/{slug}/'
    if bad:
        return False, 'STALE ' + info + '\n  ' + '\n  '.join(bad) + f'\n  run: npm run art40 -- {slug}'
    return True, ('ok ' if check else 'baked ') + info


def main(argv):
    flags = {a for a in argv if a.startswith('--')}
    out = None
    if '--out' in argv:
        i = argv.index('--out')
        out = os.path.abspath(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    names = [a for a in argv if not a.startswith('--')]
    if '--classes' in flags:
        print('the class table is tools/art40/rules.json now: npm run art40-check -- --write-rules')
        return 2
    if '--list' in flags:
        print('\n'.join(X.slugs()))
        return 0
    if '--one' in flags:                         # internal: one set, this process
        ok, msg = one(names[0], '--check' in flags, '--sheet' in flags, out)
        print(msg)
        return 0 if ok else 1
    if '--all' in flags:
        names = X.slugs()
    if not names:
        print(__doc__)
        return 2
    unknown = [n for n in names if n not in X.slugs()]
    if unknown:
        print('unknown set(s): ' + ', '.join(unknown) + ' (see npm run art40 -- --list)')
        return 2
    if len(names) == 1:
        ok, msg = one(names[0], '--check' in flags, '--sheet' in flags, out)
        print(msg)
        return 0 if ok else 1
    extra = [f for f in ('--check', '--sheet') if f in flags] + (['--out', out] if out else [])

    def run(slug):
        r = subprocess.run([sys.executable, os.path.abspath(__file__), '--one', slug] + extra,
                           capture_output=True, text=True, cwd=X.ROOT)
        return r.returncode, (r.stdout + r.stderr).strip()

    with ThreadPoolExecutor(max_workers=min(4, len(names))) as ex:
        res = list(ex.map(run, names))
    failed = [n for n, (code, _) in zip(names, res) if code]
    for code, msg in res:
        print(msg)
    print(f"{len(names) - len(failed)} of {len(names)} sets {'checked' if '--check' in flags else 'baked'}"
          + (f"; FAILED: {', '.join(failed)}" if failed else ''))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
