"""Both versions of the four stages (now, proposed) as layer lists with inline lossless WebP, for the showcase page."""
import sys, os, json, hashlib, base64, io
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
import kit, scenes as SC, atmo
from preview import compose, _spr
U = kit.U
store = {}; order = []
def save(a):
    key = hashlib.sha1(a.tobytes()+str(a.shape).encode()).hexdigest()[:12]
    if key not in store:
        b = io.BytesIO(); Image.fromarray(a, 'RGBA').save(b, 'WEBP', lossless=True, quality=100, method=6, exact=False)
        store[key] = base64.b64encode(b.getvalue()).decode(); order.append(key)
    return key
def trim(a):
    rows = np.nonzero(a[..., 3].any(axis=1))[0]
    return (a[rows[0]:rows[-1]+1], int(rows[0])) if len(rows) else (a[:1], 0)
def pack(sc):
    its = []
    for it in sc.items:
        tt = it['t']
        if tt == 'actors': its.append(dict(t='actors')); continue
        o = dict(t=tt, n=it['n'], s=it['s'], x=it.get('x', 0), y=it.get('y', 0))
        if tt in ('img', 'drift'):
            a, dy = trim(it['a']); o['f'] = save(a); o['dy'] = dy
            if tt == 'drift': o['v'] = it['v']; o['wrap'] = it['a'].shape[1]
        elif tt in ('bob', 'blink'):
            o['f'] = save(it['a'])
            for k in ('amp', 'ph', 'period'):
                if k in it: o[k] = it[k]
        else:
            trs = [trim(a) for a in it['fr']]
            o['fr'] = [save(a) for a, _ in trs]; o['dy'] = [dy for _, dy in trs]; o['fps'] = it['fps']
            if tt == 'mover': o['v'] = it['v']; o['span'] = it['span']
        its.append(o)
    return its
def ncol(sc):
    cols = set()
    for cam in (0, 140, 280, 420): cols |= set(map(tuple, compose(sc, cam, actors=False)[..., :3].reshape(-1, 3)))
    return len(cols)
man = dict(U=U, parts={})
os.makedirs(HERE+'/out', exist_ok=True)
for p in 'abcd':
    now = getattr(SC, 'part_'+p)(); new = atmo.build(p)
    man['parts'][p] = dict(now=pack(now), new=pack(new), cnow=ncol(now), cnew=ncol(new))
    for nm, sc in (('now', now), ('new', new)):
        Image.fromarray(compose(sc, 60, actors=False)[..., :3]).save(f'{HERE}/out/{p}-{nm}-u{U}.png')
    print(p, man['parts'][p]['cnow'], man['parts'][p]['cnew'], flush=True)
# two figures for scale and for the reading test
def fig(parts):
    a = np.zeros((60, 60, 4), np.uint8)
    for name, strip, x, y in parts:
        s, ox, oy = _spr(name, strip, 0); atmo.over(a, s, x-ox, y-oy)
    return a
v = fig([('vincent', 'legs-idle', 30, 58), ('vincent', 'torso-pistol-idle', 30, 40)])
h = fig([('handhaver', 'idle', 30, 58)])[:, ::-1]
man['fig'] = dict(v=save(np.ascontiguousarray(v)), h=save(np.ascontiguousarray(h)))
man['img'] = {k: store[k] for k in order}
json.dump(man, open(f'{HERE}/pack{U}.json', 'w'), separators=(',', ':'))
print('U', U, 'images', len(order), 'bytes', os.path.getsize(f'{HERE}/pack{U}.json'))
