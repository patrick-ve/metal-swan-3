import sys, os, json, hashlib, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); BASE = HERE+'/..'
sys.path.insert(0, HERE); sys.path.insert(0, BASE+'/study')
import numpy as np
from PIL import Image
from kit import *
import kit
import scenes as SC
from parts import lane, cobbles, kerb
from preview import compose, _spr
from metrics import metrics
U = kit.U
SITE = HERE+'/site'; os.makedirs(SITE, exist_ok=True); shutil.rmtree(f'{SITE}/u{U}', ignore_errors=True)
t = SC.Scene('a', 'morning'); fl = S(400, 216); lane(fl, 194, 209, 1); cobbles(fl, 166, 190, 1); kerb(fl, 190, 4, 1); tg = S(400, 216)
for foot, what in ((200, 'bicycle lane'), (178, 'road')):
    try:
        SC.kerb_posts(t, tg, fl, [50], foot, False, 'test'); raise SystemExit('RULE NOT ENFORCED: post accepted on '+what)
    except SC.PostOnWrongGround: print('rule holds, refused on', what)
SC.kerb_posts(t, tg, fl, [50], 191, False, 'test'); print('rule holds, accepted on a kerbstone')
seen = {}; total = 0
def save(a, name):
    global total
    key = (a.shape, hashlib.sha1(a.tobytes()).hexdigest())
    if key in seen: return seen[key]
    p = f'{SITE}/{name}'; os.makedirs(os.path.dirname(p), exist_ok=True)
    Image.fromarray(a, 'RGBA').save(p, 'WEBP', lossless=True, quality=100, method=5, exact=False)
    total += os.path.getsize(p); seen[key] = name
    return name
def trim(a):
    rows = np.nonzero(a[..., 3].any(axis=1))[0]
    return (a[rows[0]:rows[-1]+1], int(rows[0])) if len(rows) else (a[:1], 0)
man = {}; sm = {}
for p in 'abcd':
    sc = getattr(SC, 'part_'+p)()
    its = []
    for i, it in enumerate(sc.items):
        tt = it['t']
        if tt == 'actors': its.append(dict(t='actors')); continue
        o = dict(t=tt, n=it['n'], s=it['s'], x=it.get('x', 0), y=it.get('y', 0))
        if tt in ('img', 'drift'):
            a, dy = trim(it['a']); o['f'] = save(a, f'u{U}/{p}/{i}.webp'); o['dy'] = dy
            if tt == 'drift': o['v'] = it['v']; o['wrap'] = it['a'].shape[1]
        elif tt in ('bob', 'blink'):
            o['f'] = save(it['a'], f'u{U}/{p}/{i}.webp')
            for k in ('amp', 'ph', 'period'):
                if k in it: o[k] = it[k]
        else:
            trs = [trim(a) for a in it['fr']]
            o['fr'] = [save(a, f'u{U}/{p}/{i}_{j}.webp') for j, (a, _) in enumerate(trs)]
            o['dy'] = [dy for _, dy in trs]; o['fps'] = it['fps']
            if tt == 'mover': o['v'] = it['v']; o['span'] = it['span']
        its.append(o)
    cols = set()
    for cam in (0, 140, 280, 420): cols |= set(map(tuple, compose(sc, cam, actors=False)[..., :3].reshape(-1, 3)))
    frame = compose(sc, 60, actors=False)
    sm[p] = metrics(frame[:216*U, :384*U] if U < 4 else frame[0:432, 0:768], 'scene '+p)   # at 4x one quarter is measured: it takes a long time otherwise
    man[p] = dict(items=its, colours=len(cols), posts=len(sc.posts))
    if U == 4:
        Image.fromarray(compose(sc, 60)[..., :3]).resize((768, 432), Image.LANCZOS).save(f'{SITE}/thumb-{p}.webp', 'WEBP', quality=90, method=6)
    print(p, 'U', U, 'items', len(its), 'colours', len(cols), 'posts', len(sc.posts), {k: sm[p][k] for k in ('hard_edge_pct','soft_edge_pct','edge_contrast','dark_pct')}, flush=True)
# the hero at the same pixel, for a fair comparison
os.chdir(BASE+'/study')
from look import hero
h_ = np.repeat(np.repeat(hero(), U, axis=0), U, axis=1)
hm = metrics(h_, 'hero')
os.chdir(HERE)
json.dump(dict(U=U, parts=man, bytes=total, scene=sm, hero=hm), open(f'{HERE}/man{U}.json', 'w'), separators=(',', ':'))
print('U', U, 'bytes', total, 'files', len(seen), 'hero', {k: hm[k] for k in ('hard_edge_pct','soft_edge_pct','edge_contrast','dark_pct')})
