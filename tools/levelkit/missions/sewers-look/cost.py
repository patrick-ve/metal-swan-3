# What the flashlight costs, measured on the look sample (a proposal for the spec, not engine work):
#   U=4 python3 tools/levelkit/lk.py sewers-look run cost v1
# For each layer of the ambient and the lit stack: tile pixels (columns of 128 logical px cropped to their opaque
# rows, as the bake cuts them), the bytes of 8-bit palette PNGs (zlib 9; RGBA when > 256 colours), and whether one
# index image can serve both lights: the number of (ambient, lit) colour pairs per layer (<= 256: two palettes).
import io
import sys
import numpy as np
from PIL import Image
from level import *
import sw_d


def tiles_px(a):
    n = 0
    cw = 128 * U
    for x0 in range(0, a.shape[1], cw):
        al = a[:, x0:x0 + cw, 3] > 0
        rows = np.where(al.any(axis=1))[0]
        if rows.size:
            n += (rows[-1] - rows[0] + 1) * al.shape[1]
    return n


def png_bytes(a):
    rows = np.where((a[..., 3] > 0).any(axis=1))[0]
    if not rows.size:
        return 0
    a = a[rows[0]:rows[-1] + 1]
    m = a[..., 3] > 0
    cols = np.unique(a[..., :3][m], axis=0)
    buf = io.BytesIO()
    if len(cols) <= 255:
        lut = {tuple(c): i + 1 for i, c in enumerate(cols)}
        idx = np.zeros(a.shape[:2], np.uint8)
        flat = a[..., :3][m]
        key = flat[:, 0].astype(np.int64) << 16 | flat[:, 1].astype(np.int64) << 8 | flat[:, 2]
        ck = cols[:, 0].astype(np.int64) << 16 | cols[:, 1].astype(np.int64) << 8 | cols[:, 2]
        order = np.argsort(ck)
        idx[m] = (order[np.searchsorted(ck[order], key)] + 1).astype(np.uint8)
        im = Image.fromarray(idx, 'P')
        pal = [0, 0, 0] + [int(v) for c in cols for v in c]
        im.putpalette(pal + [0] * (768 - len(pal)))
        im.save(buf, 'PNG', optimize=True, compress_level=9, transparency=0)
    else:
        Image.fromarray(a, 'RGBA').save(buf, 'PNG', optimize=True, compress_level=9)
    return buf.tell()


def stack(sec):
    out = {}
    for l in sec.layers:
        ims = [l['img']] if l.get('img') is not None else list(l['frames'])
        out[l['id']] = [im.a for im in ims]
    return out


if __name__ == '__main__':
    var = (sys.argv[1:] or ['v1'])[0]
    A = stack(sw_d.build(var, 'amb'))
    L = stack(sw_d.build(var, 'lit'))
    tot = dict(px=0, ba=0, bl=0, pairs_ok=0, n=0)
    worst = []
    print('%-9s %9s %9s %9s %6s %6s %6s' % ('layer', 'tile px', 'amb B', 'lit B', 'amb c', 'lit c', 'pairs'))
    for k in A:
        for fa, fl in zip(A[k], L[k]):
            same = np.array_equal(fa[..., 3] > 0, fl[..., 3] > 0)
            m = fa[..., 3] > 0
            pa = fa[..., :3][m].astype(np.int64)
            pl = fl[..., :3][m].astype(np.int64)
            ka = pa[:, 0] << 16 | pa[:, 1] << 8 | pa[:, 2]
            kl = pl[:, 0] << 16 | pl[:, 1] << 8 | pl[:, 2]
            ca, cl = len(np.unique(ka)), len(np.unique(kl))
            pairs = len(np.unique(ka << 24 | kl)) if same else -1
            px = tiles_px(fa)
            ba, bl = png_bytes(fa), png_bytes(fl)
            tot['px'] += px; tot['ba'] += ba; tot['bl'] += bl; tot['n'] += 1
            tot['pairs_ok'] += (0 < pairs <= 256)
            worst.append((pairs, k))
            print('%-9s %9d %9d %9d %6d %6d %6d%s' % (k, px, ba, bl, ca, cl, pairs, '' if same else '  (alpha differs)'))
    print('total tile px %.2f M (one stack), png amb %.0f KB, lit %.0f KB; layers whose (amb, lit) pairs fit 256: %d of %d'
          % (tot['px'] / 1e6, tot['ba'] / 1e3, tot['bl'] / 1e3, tot['pairs_ok'], tot['n']))
    print('most pairs:', sorted(worst)[-4:])
    # per tile (128 logical px columns, as the bake cuts them): the most (ambient, lit) pairs in one tile
    for k in ('far', 'water', 'floor', 'vault'):
        mx = 0
        for fa, fl in zip(A[k], L[k]):
            for x0 in range(0, fa.shape[1], 128 * U):
                a_, l_ = fa[:, x0:x0 + 128 * U], fl[:, x0:x0 + 128 * U]
                m = a_[..., 3] > 0
                if not m.any():
                    continue
                pa = a_[..., :3][m].astype(np.int64); pl = l_[..., :3][m].astype(np.int64)
                ka = pa[:, 0] << 16 | pa[:, 1] << 8 | pa[:, 2]; kl = pl[:, 0] << 16 | pl[:, 1] << 8 | pl[:, 2]
                mx = max(mx, len(np.unique(ka << 24 | kl)))
        print('per tile, most (amb, lit) pairs in %s: %d' % (k, mx))
