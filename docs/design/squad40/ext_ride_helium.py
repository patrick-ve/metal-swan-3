# Helium Head: the hero's head inflates like a balloon (about twice the size) and he floats on his
# jumps. Balloon heads 'he_<expr>' are made from EACH hero's current heads (any hero, any expression):
# a smooth 2x upscale (Scale2x), inflated toward a round silhouette (the concave spots fill with the
# neighbouring colour), shaded as a sphere lit from the upper front (one ramp step lighter on the
# lit cap, one darker on the shadow rim), with a small white glint. The 'neck' anchor stays at the
# bottom. Then the helium sets are copies of the upper sets with the head swapped (no crouch), and
# the FULL bored / victory of the moves module when they exist.
import math
import re
import rig
from rig import scale2x, LIGHT3
import parts as P
import anims as A
import ext

BASE_KEYS = ['idle', 'run', 'jump', 'shoot', 'aimup', 'shootup', 'aimdown', 'shootdown', 'grenade', 'slash', 'stab']
HEAVY_KEYS = ['h_idle', 'h_run', 'h_jump', 'h_shoot']
FULL_KEYS = ['bored', 'victory']


def _rgb(ch):
    v = rig.PAL.get(ch, '#000000')
    return int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16)


def _ramps(used):
    """Letter -> (lighter, darker) along its colour ramp: the head letters that share a selout dark
    tone, sorted by brightness, the dark tone ends the ramp. A step to a letter of another hue (two
    ramps that share a dark tone) is refused, so hair never turns into a cap colour."""
    lum = lambda ch: (lambda r, g, b: 0.3 * r + 0.59 * g + 0.11 * b)(*_rgb(ch))

    def hue_ok(a, b):
        ra, rb = _rgb(a), _rgb(b)
        sa, sb = sum(ra) or 1, sum(rb) or 1
        return sum(abs(x / sa - y / sb) for x, y in zip(ra, rb)) < 0.22
    groups = {}
    for ch, d in rig.DARK.items():
        if ch in rig.HERO and ch != d and ch in used:
            groups.setdefault(d, set()).add(ch)
    out = {}
    for d, chs in groups.items():
        ramp = sorted(chs, key=lum, reverse=True) + [d]
        for i, ch in enumerate(ramp[:-1]):
            hi = ramp[i - 1] if i > 0 else ch
            lo = ramp[i + 1]
            out[ch] = (hi if hue_ok(ch, hi) else ch, lo if hue_ok(ch, lo) else ch)
    return out


def balloon(part, pad=3):
    rows, an = part
    w = max(len(r) for r in rows)
    g = [['.'] * (w + 2 * pad) for _ in range(pad)] + [list('.' * pad + r.ljust(w, '.') + '.' * pad) for r in rows] + \
        [['.'] * (w + 2 * pad) for _ in range(pad)]
    g = scale2x(g)
    H, W = len(g), len(g[0])
    pts = [(x, y) for y in range(H) for x in range(W) if g[y][x] != '.']
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 - 0.5
    rx, ry = (x1 - x0 + 1) / 2 + 1.0, (y1 - y0 + 1) / 2 + 0.5
    inell = lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0
    # inflate: fill the empty pixels inside the ellipse (above the chin) from their filled neighbours
    chin = y1 - 4
    front = [(x, y) for (x, y) in pts]
    seen = set(pts)
    while front:
        nxt = []
        for x, y in front:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if (X, Y) in seen or not (0 <= X < W and 0 <= Y < H) or Y > chin or not inell(X, Y):
                    continue
                seen.add((X, Y))
                g[Y][X] = g[y][x]
                nxt.append((X, Y))
        front = nxt
    # sphere shading
    R = _ramps(set(''.join(rows)))
    lx, ly, lz = LIGHT3
    out = [r[:] for r in g]
    for y in range(H):
        for x in range(W):
            ch = g[y][x]
            if ch == '.' or ch not in R:
                continue
            nx, ny = (x - cx) / rx, (y - cy) / ry
            d = math.hypot(nx, ny)
            if d > 1:
                nx, ny = nx / d, ny / d
            nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
            l = nx * lx + ny * ly + nz * lz
            if l > 0.9:
                out[y][x] = R[ch][0]
            elif l < 0.0 and d > 0.78:
                out[y][x] = R[ch][1]
    # the glint: a small oval of white on the lit cap, plus one dot
    gx, gy = cx + 0.42 * rx, cy - 0.62 * ry
    for dx, dy in ((0, 0), (1, 0), (0, 1)):
        X, Y = int(round(gx + dx)), int(round(gy + dy))
        if 0 <= X < W and 0 <= Y < H and out[Y][X] != '.':
            out[Y][X] = 'w'
    nx, ny = an['neck']
    rows2 = [''.join(r) for r in out]
    # crop
    ys2 = [y for y, r in enumerate(rows2) if r.strip('.')]
    xs2 = [x for r in rows2 for x, ch in enumerate(r) if ch != '.']
    X0, Y0 = min(xs2), min(ys2)
    rows2 = [r[X0:max(xs2) + 1] for r in rows2[Y0:max(ys2) + 1]]
    return rows2, {'neck': (2 * (nx + pad) + 0.5 - X0, 2 * (ny + pad) + 1 - Y0)}


def _swap(p, back=True):
    """The pose with the balloon head. When the near hand goes up in front of the face (aim up, the
    up diagonal, a raised fist), the balloon leans back so the gun or fist clears the face."""
    q = dict(p)
    h = p.get('head', 'fwd')
    q['head'] = h if h.startswith('he_') else 'he_' + h
    a = p.get('armN')
    end = (a or {}).get('end') or ('', '')
    if back and a and a.get('hand') and (a['hand'][1] < -4 or end[1] in ('up', 'dup')):
        hx, hy = a['hand']
        lean = (-10, 2) if hx < 6 and end[1] != 'dup' else (-8, 1)
        hd = p.get('hd', (0, 0))
        q['hd'] = (hd[0] + lean[0], hd[1] + lean[1])
        a = dict(a)
        so = a.get('sh', (0, 0))
        a['sh'] = (so[0] + 2, so[1])          # the near arm reaches a little further forward
        q['armN'] = a
    return q


def derive():
    for name in [k for k in P.HEADS if not k.startswith('he_')]:
        ext.add(P.HEADS, 'he_' + name, balloon(P.HEADS[name]))
    for name in ext.HEAD_FALLBACK:                 # a missing expression: the balloon of its fallback
        if 'he_' + name not in P.HEADS and name not in P.HEADS:
            pass                                    # pose.head_part falls back to he_<fallback>
    keys = [k for k in BASE_KEYS + HEAVY_KEYS if k in A.UPPER]
    keys += [k for k in A.UPPER if re.search(r'diag', k) and not k.startswith(('he_', 'ride_', 'h_')) and 'crouch' not in k
             and k not in keys]
    for k in keys:
        ext.add(A.UPPER, 'he_' + k, [(_swap(p), t) for p, t in A.UPPER[k]])
    for k in FULL_KEYS:
        if k in A.FULL:
            ext.add(A.FULL, 'he_' + k, [(_swap(p), t) for p, t in A.FULL[k]])


FLOAT = [  # (jump frame, oy, ticks): a slow rise, a long hang at the top, a slow sink
  (0, 0, 3), (1, -6, 4), (2, -16, 6), (2, -26, 6), (3, -34, 8), (3, -38, 10), (3, -39, 12), (3, -38, 10),
  (4, -33, 8), (4, -25, 8), (4, -16, 8), (4, -8, 6), (5, 0, 5)]


def groups():
    U, L = A.UPPER, A.LOWER
    if 'he_idle' not in U:
        return []
    S = []
    S += [{'u': ['he_idle', k], 'l': ['stand', 0], 't': U['he_idle'][k][1]} for k in range(len(U['he_idle']))]
    nj = len(U['he_jump'])
    S += [{'u': ['he_jump', min(f, nj - 1)], 'l': ['jump', f], 't': t, 'oy': oy} for f, oy, t in FLOAT]
    nr, nl = len(U['he_run']), len(L['run'])
    S += [{'u': ['he_run', k % nr], 'l': ['run', k % nl], 't': 3} for k in range(max(nr, nl))]
    S += [{'u': ['he_shoot', k], 'l': ['stand', 0], 't': U['he_shoot'][k][1]} for k in range(len(U['he_shoot']))]
    S += [{'u': ['he_aimup', k], 'l': ['stand', 0], 't': U['he_aimup'][k][1]} for k in range(len(U['he_aimup']))]
    S += [{'u': ['he_shootup', k], 'l': ['stand', 0], 't': U['he_shootup'][k][1]} for k in range(len(U['he_shootup']))]
    return [{'cat': 'Status', 'title': 'Helium Head', 'ref': '–', 'steps': S}]
