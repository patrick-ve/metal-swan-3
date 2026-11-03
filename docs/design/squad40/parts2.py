# VINCENT parts at 2x (the 768x432 grid). Baseline: each 1x part through Scale2x with anchors mapped
# to the 2x pixel centres (2a + 0.5); then hand-drawn 2x versions replace the parts that carry the look.
import parts as P1
from rig import scale2x


def up2(ra):
    rows, an = ra
    w = max(len(r) for r in rows)
    g = scale2x([list(r.ljust(w, '.')) for r in rows])
    return [''.join(r) for r in g], {k: (2 * x + 0.5, 2 * y + 0.5) for k, (x, y) in an.items()}


def shear2(part, top):
    return P1.shear(part, top)


HEADS = {k: up2(v) for k, v in P1.HEADS.items()}
TORSOS = {'up': up2(P1.TORSOS['up'])}
TORSOS['lean'] = shear2(TORSOS['up'], 4)
TORSOS['lean2'] = shear2(TORSOS['up'], 6)
TORSOS['back'] = shear2(TORSOS['up'], -4)
SHOES = {k: up2(v) for k, v in P1.SHOES.items()}
GUNS = {k: up2(v) for k, v in P1.GUNS.items()}
FISTS = {k: up2(v) for k, v in P1.FISTS.items()}
HANDS = {k: up2(v) for k, v in P1.HANDS.items()}
ITEMS = {k: up2(v) for k, v in P1.ITEMS.items()}
FX = {}
for k, (rows, an) in P1.FX.items():
    if k.startswith('slash'):
        continue
    FX[k] = up2((rows, {'a': an}))
    FX[k] = (FX[k][0], FX[k][1]['a'])
FX['slash0'] = P1.arc(0, 0, 29, 31, -100, -40, 3.6)
FX['slash1'] = P1.arc(0, 0, 31, 34, -100, 30, 6.8)
FX['slash2'] = P1.arc(0, 0, 32, 34, -40, 60, 6.0)
FX['slash3'] = P1.arc(0, 0, 32, 32, 15, 65, 3.2)

# ---------------------------------------------------------------- 2x detail on the heads
def _g(rows):
    return [list(r) for r in rows]


def detail_head(rows):
    """Rules that add the detail a 2x head can hold: dark pupils, stubble fading into the skin,
    combed-back hair strands, a lit cheekbone."""
    g = _g(rows)
    h, w = len(g), len(g[0])
    at = lambda x, y: g[y][x] if 0 <= x < w and 0 <= y < h else '.'
    out = _g(rows)
    for y in range(h):
        for x in range(w):
            c = g[y][x]
            nb = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)]
            if c == 'Q' and 'w' in nb and x > w // 2:
                out[y][x] = 'K'                                        # pupil
            elif c == 'b' and any(n in 'Ss' for n in nb) and (x + y) % 2 == 0:
                out[y][x] = 's'                                        # stubble edge
            elif c == 'B' and (x * 3 + y * 5) % 7 == 0 and all(n in 'bB' for n in nb):
                out[y][x] = 'b'                                        # beard grain
            elif c == 'b' and (x * 5 + y * 3) % 9 == 0 and all(n in 'bB' for n in nb):
                out[y][x] = 'B'
            elif c == 'H' and (x + 2 * y) % 7 == 0 and at(x, y - 1) in 'HA' and at(x - 1, y) in 'Hh':
                out[y][x] = 'h'                                        # strand
            elif c == 'H' and (x + 2 * y) % 7 == 3 and at(x + 1, y - 1) == 'A':
                out[y][x] = 'A'                                        # strand light
    return [''.join(r) for r in out]


def edit(rows, changes):
    g = _g(rows)
    for y, x, s in changes:
        for i, ch in enumerate(s):
            if ch != '_':
                g[y][x + i] = ch
    return [''.join(r) for r in g]


for k in list(HEADS):
    HEADS[k] = (detail_head(HEADS[k][0]), HEADS[k][1])

# per-expression hand edits at 2x (x, y in the 28 x 26 head)
_fwd_face = [(13, 24, 'S_'), (14, 26, 'LL'), (15, 26, 'SS'), (16, 25, 'zss'), (17, 25, 'ss'),
             (14, 18, 'LLL'), (15, 19, 'LL'),
             (20, 17, 'z'), (21, 18, 'zwwwwz'), (22, 19, 'ssss')]
for k in ('fwd', 'blink', 'smug'):
    HEADS[k] = (edit(HEADS[k][0], _fwd_face), HEADS[k][1])
HEADS['shout'] = (edit(HEADS['shout'][0], [(13, 24, 'S_'), (14, 26, 'LL'), (15, 26, 'SS'), (16, 25, 'zss'), (14, 18, 'LLL')]), HEADS['shout'][1])
HEADS['hurt'] = (edit(HEADS['hurt'][0], [(14, 26, 'LL'), (16, 25, 'zss'), (14, 18, 'LLL')]), HEADS['hurt'][1])
HEADS['down'] = (edit(HEADS['down'][0], [(12, 18, 'SQQQQQSS'), (13, 18, 'SSSSzzzS'), (14, 18, 'SSSSwKKS'), (15, 18, 'SSSSSzzS'), (17, 25, 'zs')]), HEADS['down'][1])
HEADS['read'] = (edit(HEADS['read'][0], [(12, 18, 'SQQQQQSS'), (13, 18, 'SSSSzzzS'), (14, 18, 'SSSSwKKS'), (15, 18, 'SSSSSzzS')]), HEADS['read'][1])
HEADS['read2'] = (edit(HEADS['read2'][0], [(12, 18, 'SQQQQQSS'), (13, 18, 'SSSSzzzS'), (14, 18, 'SSSKKwSS'), (15, 18, 'SSSSzzSS')]), HEADS['read2'][1])
HEADS['up'] = (edit(HEADS['up'][0], [(6, 22, 'LLQQQL'), (7, 22, 'LSSSSS'), (8, 22, 'SzwKKS'), (9, 22, 'SSzwSS'), (13, 26, 'zL')]), HEADS['up'][1])

# ---------------------------------------------------------------- 2x torso detail: tweed grain, lapels, button
def detail_torso(rows):
    g = _g(rows)
    h, w = len(g), len(g[0])
    out = _g(rows)
    for y in range(h):
        for x in range(w):
            c = g[y][x]
            if c == 'j' and (x * 7 + y * 3) % 11 == 0:
                out[y][x] = 'q'                                        # tweed fleck
            elif c == 'J' and (x * 5 + y * 7) % 13 == 0:
                out[y][x] = 'j'
            elif c == 'q' and (x * 3 + y * 5) % 9 == 0 and 0 < y < h - 3:
                out[y][x] = 'j'
    return [''.join(r) for r in out]


_t = detail_torso(TORSOS['up'][0])
if len(_t[0]) == 28:      # the first (rounded-back) torso
    _t = edit(_t, [(14, 22, 'QQ'), (15, 22, 'QJ'),                  # button
                   (0, 18, 'TT'), (1, 17, 'tTT'), (2, 19, 'tT'),     # shirt collar points
                   (3, 22, 'R'), (4, 23, 'rr')])
else:                     # the straight-backed torso (24 wide)
    _t = edit(_t, [(14, 18, 'QQ'), (15, 18, 'QJ'),
                   (0, 11, 'tTT'), (1, 12, 'T'), (1, 17, 'T'), (2, 15, 'r'),
                   (3, 16, 'R'), (4, 17, 'rr')])
TORSOS['up'] = (_t, TORSOS['up'][1])
TORSOS['lean'] = shear2(TORSOS['up'], 4)
TORSOS['lean2'] = shear2(TORSOS['up'], 6)
TORSOS['back'] = shear2(TORSOS['up'], -4)

# ---------------------------------------------------------------- 2x pistol, drawn once, turned offline
import math as _m
from rig import rotsprite as _rot

_GUN_FWD = [
  "......gGGGGGGGGGGGGGGGg.",
  ".....gnGnGngggggggggggGn",
  "TT.SSSSgggggNNNggggggggn",
  "TTSSSSSSnnnnnnnnnnnnnnnN",
  "TTSSLSSSsNnnnnnnN.......",
  "TTSSSSSSsN..N...........",
  ".sSSSSSsNNNN............",
  "..sssss.................",
]
_GA = {'wrist': (0.5, 3.5), 'muzzle': (24, 1.5)}


def _turn90(ra, ccw=True):
    rows, an = ra
    h, w = len(rows), max(len(r) for r in rows)
    g = [r.ljust(w, '.') for r in rows]
    if ccw:   # barrel to the top
        out = [''.join(g[y][w - 1 - x] for y in range(h)) for x in range(w)]
        an2 = {k: (y, w - 1 - x) for k, (x, y) in an.items()}
    else:     # barrel to the bottom
        out = [''.join(g[h - 1 - y][x] for y in range(h)) for x in range(w)]
        an2 = {k: (h - 1 - y, x) for k, (x, y) in an.items()}
    return out, an2


def _turn(ra, deg, pad=34):
    """RotSprite turn around the wrist; deg > 0 turns the barrel upwards."""
    rows, an = ra
    wx, wy = an['wrist']
    n = pad * 2
    g = [['.'] * n for _ in range(n)]
    ox, oy = int(pad - round(wx)), int(pad - round(wy))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            g[oy + y][ox + x] = ch
    piv = (wx + ox, wy + oy)
    out = _rot([''.join(r) for r in g], piv, deg)
    ys = [y for y, r in enumerate(out) if r.strip('.')]
    xs = [x for r in out for x, ch in enumerate(r) if ch != '.']
    x0, y0 = min(xs), min(ys)
    out = [r[x0:max(xs) + 1] for r in out[y0:max(ys) + 1]]
    a = _m.radians(deg)
    an2 = {}
    for k, (x, y) in an.items():
        dx, dy = x + ox - piv[0], y + oy - piv[1]
        rx = piv[0] + dx * _m.cos(a) + dy * _m.sin(a)
        ry = piv[1] - dx * _m.sin(a) + dy * _m.cos(a)
        an2[k] = (rx - x0, ry - y0)
    return out, an2


GUNS['fwd'] = (_GUN_FWD, dict(_GA))
GUNS['up'] = _turn90(GUNS['fwd'], True)
GUNS['down'] = _turn90(GUNS['fwd'], False)
GUNS['dup'] = _turn(GUNS['fwd'], 45)
GUNS['ddown'] = _turn(GUNS['fwd'], -45)
GUNS['low'] = _turn(GUNS['fwd'], -26)

# ---------------------------------------------------------------- 2x muzzle bursts
def _burst(L, Hh, seed):
    """A forward muzzle flash: a white-hot core, yellow body, orange rim and spikes."""
    w, h = L + 2, Hh * 2 + 1
    g = [['.'] * w for _ in range(h)]
    cy = Hh
    for y in range(h):
        for x in range(w):
            t = x / L
            half = Hh * (1 - abs(2 * t - 0.75) ** 1.6) if t <= 1 else -1
            d = abs(y - cy)
            jitter = ((x * 7 + y * 13 + seed * 5) % 5) / 5 - 0.4
            if d <= half + jitter:
                r = d / max(half, 0.5)
                g[y][x] = 'W' if (r < 0.35 and t < 0.75) else 'F' if r < 0.62 else 'f' if r < 0.88 else 'c'
    for k in range(3):                              # spikes
        yy = cy + (k - 1) * (Hh // 2 + 1)
        xx = L - 2 - (k % 2) * 3
        for i in range(3 + k % 2):
            if 0 <= xx + i < w and 0 <= yy < h and g[yy][xx + i] == '.':
                g[yy][xx + i] = 'c' if i < 2 else 'e'
    return [''.join(r) for r in g], (0, cy)


def _tp(ra, up):
    rows, (ax, ay) = ra
    h, w = len(rows), len(rows[0])
    t = [''.join(rows[y][x] for y in range(h)) for x in range(w)]   # flash points down
    if up:
        t = t[::-1]
        return t, (ay, w - 1 - ax)
    return t, (ay, ax)


FX['ff0'] = _burst(18, 6, 1)
FX['ff1'] = _burst(12, 4, 2)
FX['ff2'] = _burst(7, 3, 3)
for a, b in (('fu', True), ('fd', False)):
    for i in range(3):
        FX[f'{a}{i}'] = _tp(FX[f'ff{i}'], b)
