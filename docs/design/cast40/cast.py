# Renders one cast member (chars/<id>.py) to out/<id>.json and previews.
#   python3 cast.py <id> [zoom]     out/<id>.json, out/<id>.png (zoom, default 8),
#                                   out/<id>_vs.png (next to VINCENT on a ground line, 4x)
#   python3 cast.py --all           every chars/*.py, each in its own process (modules patch the rig)
#   python3 cast.py --check <id>    renders, prints size and colours, writes nothing
# Each module runs in its own process because it patches the shared rig tables in place.
import importlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
sys.path.insert(0, HERE)
OUT = os.path.join(HERE, 'out')
REQ = ('name', 'mission', 'role', 'kind', 'pose')
CAP = {'boss': 40}     # colour cap per role, outline included (VINCENT idle uses 28); everything else 30


def ids():
    d = os.path.join(HERE, 'chars')     # a sample module defines INFO; shared kits (no INFO) are skipped
    return sorted(f[:-3] for f in os.listdir(d) if f.endswith('.py') and not f.startswith('_')
                  and 'INFO = ' in open(os.path.join(d, f)).read())


def run(cid, zoom=8, write=True):
    import castkit as K
    mod = importlib.import_module('chars.' + cid)
    info = dict(getattr(mod, 'INFO', {}))
    miss = [k for k in REQ if k not in info]
    if miss:
        raise SystemExit(f'{cid}: INFO lacks {miss}')
    rows, root = mod.frame()
    x0, y0, x1, y1 = K.bbox(rows)
    rows = [r[x0:x1] for r in rows[y0:y1]]
    ax, ay = root[0] - x0, root[1] - y0
    face = info.get('face', -1)
    if face < 0:
        rows = K.mirror(rows)
        ax = (x1 - x0) - 1 - ax
    used = sorted({ch for r in rows for ch in r if ch != '.'})
    unknown = [ch for ch in used if ch not in K.PAL]
    if unknown:
        raise SystemExit(f'{cid}: letters without a colour: {unknown}')
    pal = {ch: K.PAL[ch] for ch in used}
    ncol = len(set(pal.values()))
    cap = CAP.get(info['role'], 30)
    data = dict(id=cid, **{**info, 'face': face}, w=x1 - x0, h=y1 - y0, ax=ax, ay=ay, colours=ncol, rows=rows, pal=pal)
    msg = f'{cid}: {data["w"]}x{data["h"]} px, ground ({ax},{ay}), {ncol} colours (cap {cap})'
    if ncol > cap:
        msg += '  OVER THE CAP'
    print(msg)
    if not write:
        return data
    with open(os.path.join(OUT, cid + '.json'), 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    K.render([(rows, pal, 2, 2)], data['w'] + 4, data['h'] + 4, scale=zoom, path=os.path.join(OUT, cid + '.png'))
    vs(data, K)
    return data


def vs(d, K):
    """The sample next to VINCENT (idle) on a ground line, so the scale reads."""
    items, x, h = [], 6, 0
    ref = os.path.join(OUT, 'vincent.json')
    group = [d]
    if d['id'] != 'vincent' and os.path.isfile(ref):
        group = [json.load(open(ref)), d]
    h = max(g['h'] + g.get('air', 0) for g in group) + 16
    g_y = h - 6
    for g in group:
        items.append((g['rows'], g['pal'], x, g_y - g['ay'] - g.get('air', 0)))
        x += g['w'] + 8
    K.render(items, x, h, scale=4, ground=g_y, path=os.path.join(OUT, d['id'] + '_vs.png'))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        print(__doc__ or 'usage: cast.py <id> [zoom] | --all | --check <id>')
    elif a[0] == '--all':
        bad = []
        for cid in ['vincent'] + [i for i in ids() if i != 'vincent']:
            r = subprocess.run([sys.executable, 'cast.py', cid], cwd=HERE)
            if r.returncode:
                bad.append(cid)
        print('failed:', bad or 'none')
        sys.exit(1 if bad else 0)
    elif a[0] == '--check':
        run(a[1], write=False)
    else:
        run(a[0], int(a[1]) if len(a) > 1 else 8)
