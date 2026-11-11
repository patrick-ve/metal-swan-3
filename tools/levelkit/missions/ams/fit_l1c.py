# House-fit measure for sections c and c1 (HOUSE-FIT-BRIEF.md step 1): every house front built from `house`,
# `golden_house` or `mansion` and blitted onto a layer is recorded (the layer, its x on that layer, its painted width);
# per layer the fronts are sorted by x and the overlap with the next front is printed.
# Usage: python3 tools/levelkit/lk.py ams run fit_l1c l1c [l1c1 ...]
import importlib, sys
import parts_l1c
from level import Layer

REC = []
_blit = Layer.blit


def _tag(fn, kind):
    def w(*a, **k):
        r = fn(*a, **k)
        L = r[0] if isinstance(r, tuple) else r
        L._front = kind
        return r
    return w


def _rec_blit(self, part, x, y, *a, **k):
    kind = getattr(part, '_front', None)
    if kind:
        REC.append((id(self), self, kind, float(x), float(part.w)))
    return _blit(self, part, x, y, *a, **k)


parts_l1c.house = _tag(parts_l1c.house, 'house')
parts_l1c.mansion = _tag(parts_l1c.mansion, 'mansion')
Layer.blit = _rec_blit


def rows(sec):
    names = {}
    for l in sec.layers:
        names[id(l['img'])] = l['id']
    by = {}
    for (lid, L, kind, x, w) in REC:
        by.setdefault(lid, []).append((x, w, kind))
    out = []
    for lid, fr in by.items():
        fr.sort()
        ov = [round(fr[i][0] + fr[i][1] - fr[i + 1][0], 2) for i in range(len(fr) - 1)]
        out.append((names.get(lid, 'depth plane (cropped at flush)'), fr, ov))
    return out


if __name__ == '__main__':
    for mod in sys.argv[1:]:
        REC.clear()
        M = importlib.import_module(mod)
        sec = M.build()
        for name, fr, ov in rows(sec):
            kinds = sorted(set(f[2] for f in fr))
            print('%s layer %s (%s): %d fronts, max overlap %.2f px' % (mod, name, '/'.join(kinds), len(fr), max(ov + [0])))
            if name.startswith('depth') or max(ov + [0]) > 0:
                for i, (x, w, k) in enumerate(fr):
                    print('   x %8.2f  w %6.2f  ..%8.2f  overlap next %s' % (x, w, x + w, ov[i] if i < len(ov) else '-'))
