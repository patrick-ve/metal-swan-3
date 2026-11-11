import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'study'))
import numpy as np
from PIL import Image
from kit import *
import kit
import scenes as SC
HERE = os.path.dirname(os.path.abspath(__file__)); SPR = os.path.join(HERE, '..', 'sprites')
def _spr(name, strip, i):
    d = json.load(open(f'{SPR}/{name}.json')); f = d['strips'][strip][i]; pal = [hexrgb(c) for c in d['pal']]
    idx = np.array(f['idx']).reshape(f['h'], f['w']); a = np.zeros((f['h'], f['w'], 4), np.uint8)
    for j in np.unique(idx):
        if j: a[idx == j, :3] = pal[j]; a[idx == j, 3] = 255
    return a, f['ox'], f['oy']
def compose(sc, cam=60, actors=True, tick=0):
    U = kit.U
    im = np.zeros((216*U, 384*U, 4), np.uint8); im[..., 3] = 255
    up = lambda a: np.repeat(np.repeat(a, U, axis=0), U, axis=1)
    for it in sc.items:
        t = it['t']
        if t == 'actors':
            if actors:
                l, lx, ly = _spr('vincent', 'legs-idle', 0); tr, tx, ty = _spr('vincent', 'torso-pistol-idle', 0)
                over(im, up(l), (150-lx)*U, (176-ly)*U); over(im, up(tr), (150-tx)*U, (176-18-ty)*U)
                h, hx, hy = _spr('handhaver', 'idle', 0); over(im, up(h[:, ::-1]), (250-(h.shape[1]-hx))*U, (176-hy)*U)
            continue
        off = int(round(cam*it['s']*U))
        if t == 'frames': over(im, it['fr'][0], int(it['x'])*U-off, int(it['y'])*U)
        elif t == 'mover': over(im, it['fr'][0], (int((it['x']+it['v']*tick) % it['span'])-40)*U-off, int(it['y'])*U)
        elif t == 'blink': continue
        elif t == 'drift': over(im, it['a'], -off, 0)
        else: over(im, it['a'], int(it['x'])*U-off, int(it['y'])*U)
    return im
if __name__ == '__main__':
    out = HERE+'/out'; os.makedirs(out, exist_ok=True)
    for p in sys.argv[1].split(','):
        sc = getattr(SC, 'part_'+p)(); f = compose(sc, int(sys.argv[2]) if len(sys.argv) > 2 else 60)
        Image.fromarray(f[..., :3]).save(f'{out}/{p}-u{kit.U}.png')
        print(p, 'U', kit.U, 'colours', len(np.unique(f[..., :3].reshape(-1, 3), axis=0)), 'posts', len(sc.posts), flush=True)
