# Builds the four scenes at the art tier U (env), measures them the same way as the reference screenshots,
# and writes the layer images to site/a/ and the layer table to site/meta-u<U>.json.
import io, json, os, sys, time
import numpy as np
from PIL import Image
from build import *
import scene1, scene2, scene3, scene4

OUT = 'site/a'
os.makedirs(OUT, exist_ok=True)


def write(arr, name):
    Image.fromarray(arr, 'RGBA').save(os.path.join(OUT, name), 'WEBP', lossless=True, quality=80, method=4)
    return os.path.getsize(os.path.join(OUT, name))


def hsv(a):
    r, g, b = [a[..., i] / 255 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn
    m = d > 1e-6
    dd = np.where(m, d, 1)
    hr = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4))
    return np.where(m, hr * 60, 0), np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0), mx


def keyhue(rgb):
    h, s, v = hsv(rgb.astype(float))
    hist, _ = np.histogram(h[s > 0.12], bins=36, range=(0, 360), weights=s[s > 0.12])
    top = int(np.argmax(hist))
    share = sum(hist[(top + d) % 36] for d in (-2, -1, 0, 1, 2)) / max(hist.sum(), 1)
    return top * 10, float(share)


def plane(layer):
    m = layer.a[..., 3] > 0
    px = layer.a[..., :3][m].astype(float)
    L = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]) / 255
    mx = px.max(1) / 255; mn = px.min(1) / 255
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return dict(lo=round(float(np.percentile(L, 5)), 2), hi=round(float(np.percentile(L, 95)), 2), sat=round(float(s.mean()), 2))


def crop_rows(a):
    """Drop empty rows at the top and the bottom, in whole logical rows. Returns (array, logical y offset)."""
    rows = np.where(a[..., 3].any(axis=1))[0]
    if len(rows) == 0:
        return a[:U], 0
    y0 = (rows[0] // U) * U; y1 = -(-(rows[-1] + 1) // U) * U
    return a[y0:y1], int(y0 // U)


run, idle = hero_frames()
meta = dict(u=U, view=[VIEW_W, VIEW_H], world=WORLD, cam=CAM, scenes=[])
total = 0
for mod in (scene1, scene2, scene3, scene4):
    t0 = time.time()
    sc = mod.build()
    fr = compose(sc, 288, 0, None)
    hue, share = keyhue(fr.a[..., :3])
    S = dict(key=sc.key, name=sc.name, hour=sc.hour, walk=sc.walk, shadow=list(sc.notes.get('shadow', (40, 44, 66))), layers=[],
             m=dict(colors=fr.ncolors(), hue=hue, share=round(share, 2)))
    for ly in sc.layers:
        d = dict(id=ly['id'], kind=ly['kind'], speed=ly['speed'], y=ly['y'])
        name = f"{sc.key}-{ly['id']}-u{U}.webp"
        if ly['kind'] == 'vista':                                     # the side canal: strips and numbers for the perspective draw
            v3 = ly['v3']
            v = dict(v3['v'])
            v['hr'] = 1 if U == 1 else U // 2                           # strip pixels per logical pixel along the depth
            v['imgs'] = {}
            for k, im in v3['imgs'].items():
                arr = im.a
                if k in ('wallL', 'wallR') and U > 1:                 # the fronts are always seen squeezed: half the width is enough
                    a = arr.astype(float)
                    al = a[..., 3:4] / 255
                    w2 = (a.shape[1] // 2) * 2
                    pm = (a[:, :w2, :3] * al[:, :w2]).reshape(a.shape[0], w2 // 2, 2, 3).mean(2)
                    am = al[:, :w2].reshape(a.shape[0], w2 // 2, 2, 1).mean(2)
                    rgb = np.where(am > 0, pm / np.maximum(am, 1e-6), 0)
                    arr = np.concatenate([rgb, am * 255], 2).round().astype(np.uint8)
                fn = f"{sc.key}-vista-{k}-u{U}.webp"
                total += write(arr, fn)
                v['imgs'][k] = 'a/' + fn
            d['v'] = v
            S['layers'].append(d)
            continue
        if ly['kind'] in ('rows', 'frames'):
            fs = ly['frames']
            arr = np.concatenate([f.a for f in fs], 0)                # frames stacked top to bottom
            d['n'] = len(fs); d['w'], d['h'] = fs[0].pw, fs[0].ph
            if ly['kind'] == 'rows':
                d['s0'], d['s1'] = ly['s0'], ly['s1']
        else:
            arr, dy = crop_rows(ly['img'].a)
            d['y'] = ly['y'] + dy; d['w'], d['h'] = arr.shape[1], arr.shape[0]
            if ly['kind'] == 'tile':
                d['drift'] = ly.get('drift', 0)
        d['src'] = 'a/' + name
        total += write(arr, name)
        if ly['id'] in ('skyline', 'far', 'near'):
            S['m'][ly['id']] = plane(ly['img'])
        S['layers'].append(d)
    meta['scenes'].append(S)
    for i, cx in enumerate((0, 288, 576)):
        save(compose(sc, cx, 0, run[i * 3]), f'out/final-{sc.key}-{i}-u{U}.png', 1)
    print(sc.key, sc.name, S['m'], '%.0f s' % (time.time() - t0), flush=True)
json.dump(meta, open(f'site/meta-u{U}.json', 'w'), separators=(',', ':'), default=int)
print('tier', U, 'bytes', total)
