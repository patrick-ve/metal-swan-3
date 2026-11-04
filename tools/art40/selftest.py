"""Proof that tools/art40/kit is a faithful production copy of the frozen spikes.

  python3 tools/art40/selftest.py            VINCENT's 47 groups (every step of the squad page) and
                                             the cast spike's handhaver sample
  python3 tools/art40/selftest.py --heroes   also THOM, DIRK, BOB and PATRICK (47 groups each)

Each side renders in a process of its own (the rig patches its tables in place): the spike from
docs/design/squad40 and docs/design/cast40 (read only, no bytecode written), the kit from
tools/art40/kit with another PYTHONHASHSEED. The renders go to tmp/ams40-found-bake/selftest/ as
JSON (+ a contact sheet of the kit's handhaver and VINCENT's first groups) and must be identical,
pixel for pixel and colour for colour. Exit 1 on any difference.
"""
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SQUAD = os.path.join(ROOT, 'docs', 'design', 'squad40')
CAST = os.path.join(ROOT, 'docs', 'design', 'cast40')
OUT = os.path.join(ROOT, 'tmp', 'ams40-found-bake', 'selftest')


# ------------------------------------------------------------------------------- dump (child side)
def dump_squad(side, name, path):
    if side == 'spike':
        sys.path.insert(0, SQUAD)
        os.environ['HERO'] = name
        import build
        import comp
        G = build.groups()
        bad = build.check_groups(G)
    else:
        sys.path.insert(0, HERE)
        import art40  # noqa: F401  (puts the kit on sys.path)
        import hero
        hero.load(name)
        import groups
        import comp
        G = groups.groups()
        bad = groups.check_groups(G)
    import rig
    frames, used = [], set()
    for g in G:
        rows = [comp.step_rows(s) for s in g['steps']]
        for r in rows:
            used.update(ch for line in r for ch in line if ch != '.')
        frames.append({'cat': g.get('cat', ''), 'title': g['title'], 'steps': g['steps'], 'rows': rows})
    data = {'hero': name, 'bad': bad, 'pal': {k: rig.PAL[k] for k in sorted(used)}, 'groups': frames}
    with open(path, 'w') as f:
        json.dump(data, f, sort_keys=True, separators=(',', ':'))


def dump_cast(side, path):
    if side == 'spike':
        sys.path.insert(0, CAST)
        import castkit as K
        import importlib
        mod = importlib.import_module('chars.handhaver')
    else:
        sys.path.insert(0, HERE)
        import art40  # noqa: F401
        import castkit as K
        from samples import handhaver as mod
    rows, root = mod.frame()
    used = sorted({ch for r in rows for ch in r if ch != '.'})
    data = {'rows': rows, 'root': list(root), 'pal': {k: K.PAL[k] for k in used}, 'info': mod.INFO}
    with open(path, 'w') as f:
        json.dump(data, f, sort_keys=True, separators=(',', ':'))


# ------------------------------------------------------------------------------ compare (parent)
def child(args, seed):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', PYTHONHASHSEED=str(seed))
    env.pop('HERO', None)
    r = subprocess.run([sys.executable, os.path.abspath(__file__), '--dump'] + args, env=env, cwd=OUT,
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f'selftest: the {args[0]} render failed:\n{r.stdout}{r.stderr}')
    if r.stderr.strip():
        raise SystemExit(f'selftest: the {args[0]} render warned (a module was skipped?):\n{r.stderr}')


def first_diff(a, b):
    if a.get('pal') != b.get('pal'):
        ka, kb = a.get('pal', {}), b.get('pal', {})
        diff = sorted(k for k in set(ka) | set(kb) if ka.get(k) != kb.get(k))
        return f'palette letters differ: {diff[:10]}'
    if 'groups' in a:
        if len(a['groups']) != len(b['groups']):
            return f"{len(a['groups'])} groups against {len(b['groups'])}"
        for ga, gb in zip(a['groups'], b['groups']):
            if ga['title'] != gb['title'] or ga['steps'] != gb['steps']:
                return f"group {ga['title']!r}: the steps differ"
            for i, (ra, rb) in enumerate(zip(ga['rows'], gb['rows'])):
                if ra != rb:
                    if len(ra) != len(rb) or any(len(la) != len(lb) for la, lb in zip(ra, rb)):
                        return f"group {ga['title']!r} step {i}: the frame sizes differ"
                    for y, (la, lb) in enumerate(zip(ra, rb)):
                        if la != lb:
                            x = next(k for k in range(len(la)) if la[k] != lb[k])
                            return f"group {ga['title']!r} step {i}: first pixel difference at ({x}, {y})"
            if len(ga['rows']) != len(gb['rows']):
                return f"group {ga['title']!r}: step counts differ"
    for k in ('rows', 'root', 'bad'):
        if a.get(k) != b.get(k):
            return f'{k} differs'
    return None


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def look(kit_cast, kit_vincent):
    """Contact sheets of the kit's renders (8x handhaver, 4x VINCENT's first six groups)."""
    try:
        sys.path.insert(0, HERE)
        import art40  # noqa: F401
        import castkit as K
    except Exception:
        return
    c = json.load(open(kit_cast))
    K.render([(c['rows'], c['pal'], 2, 2)], len(c['rows'][0]) + 4, len(c['rows']) + 4, scale=8,
             path=os.path.join(OUT, 'kit-handhaver.png'))
    v = json.load(open(kit_vincent))
    items, x, y, W, rowh = [], 2, 2, 0, 0
    for g in v['groups'][:6]:
        for r in g['rows']:
            items.append((r, v['pal'], x, y))
            x += len(r[0]) + 2
            rowh = max(rowh, len(r))
        W = max(W, x)
        x, y = 2, y + rowh + 2
        rowh = 0
    K.render(items, W, y, scale=3, path=os.path.join(OUT, 'kit-vincent-core.png'))


def main(argv):
    if argv and argv[0] == '--dump':
        kind, side = argv[1], argv[2]
        if kind == 'squad':
            dump_squad(side, argv[3], argv[4])
        else:
            dump_cast(side, argv[3])
        return 0
    os.makedirs(OUT, exist_ok=True)
    heroes = ['vincent'] + (['thom', 'dirk', 'bob', 'patrick'] if '--heroes' in argv else [])
    fails = 0
    jobs = [('cast', None)] + [('squad', h) for h in heroes]
    for kind, h in jobs:
        tag = 'handhaver' if kind == 'cast' else h
        a = os.path.join(OUT, f'spike-{tag}.json')
        b = os.path.join(OUT, f'kit-{tag}.json')
        extra = [h] if h else []
        child([kind, 'spike'] + extra + [a], 0)
        child([kind, 'kit'] + extra + [b], 4242)
        A, B = json.load(open(a)), json.load(open(b))
        d = first_diff(A, B)
        if not d and digest(a) != digest(b):
            d = 'the dumps differ (sha256), but no pixel difference was found'
        n = sum(len(g['rows']) for g in A['groups']) if 'groups' in A else 1
        what = f"{len(A['groups'])} groups, {n} steps" if 'groups' in A else f"sample {len(A['rows'][0])}x{len(A['rows'])} px"
        if d:
            fails += 1
            print(f'DIFF {tag}: {what}: {d}')
        else:
            print(f'same {tag}: {what}, {len(A["pal"])} letters, sha {digest(b)} (identical to the spike: {digest(a) == digest(b)})')
    look(os.path.join(OUT, 'kit-handhaver.json'), os.path.join(OUT, 'kit-vincent.json'))
    print('selftest:', 'FAILED' if fails else 'the kit renders pixel-identical to the frozen spikes',
          f'(renders in {os.path.relpath(OUT, ROOT)}/)')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
