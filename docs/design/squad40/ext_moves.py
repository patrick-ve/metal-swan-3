# Extension set "moves": the extra legs (fall, land, crouch-up, dangle), the comic deaths (burn,
# blast, drown, crushed flat), the full-body moves (victory, respawn, bored, second fidget, the
# time-out yawn and sleep, mount, Swan hop, somersault) and the intro parachute (canopy, fold).
#
# Generic by design: every pose is built from the hero's own parts and limb lengths, so the other
# heroes inherit the set with their own heads, torsos, guns, shoes and colours. Three pose keys are
# handled by a chained 'post' hook (it only acts on poses that carry them, so no core frame changes):
#   'spin': (deg, (x, y))   turn the WHOLE body (legs, shoes, cape too) around a point relative to
#                           the ground point (rotsprite, positive = counter-clockwise), then clean
#   'squash': (sy, sx)      squash the figure toward the ground (pancake), widen it by sx
#   'soot': 1               the figure turns soot-black (digits 0 1 2), the eye whites stay
import math, os, sys
import rig
import pose
import parts as P
import anims as A
import ext
from rig import Canvas, rotsprite

# ------------------------------------------------------------------ shared letters (digits 0-4)
rig.PAL.update({
  '0': '#1d1a1f',     # soot black
  '1': '#3d383c',     # soot dark grey (also the chute lines)
  '2': '#686063',     # soot grey (lit edges)
  '3': '#2f69a8',     # blue: water body, canopy fabric
  '4': '#1b3462',     # navy: deep water, canopy underside and seams
})
rig.DARK.update({'0': '0', '1': '0', '2': '0', '3': '4', '4': '4'})


def _hero_name():
    h = sys.modules.get('hero')
    return getattr(h, 'NAME', None) or os.environ.get('HERO', 'vincent').strip().lower() or 'vincent'


ext.HEAD_FALLBACK.setdefault('sootblink', 'blink')     # the soot statue blinks once


def _edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            out[y][x + i] = ch
    return [''.join(r) for r in out]


# ------------------------------------------------------------------ VINCENT's new heads
def _vincent_heads():
    base = P.HEADS['fwd'][0]
    nk = {'neck': (5, 12)}
    H = {}
    # happy: brows up, eyes squeezed into arcs, a wide open grin
    H['happy'] = (_edit(base, [(4, 10, 'zz'), (5, 9, 'SQQS'), (6, 9, 'QSSQ'), (9, 7, 'bBBBBB'),
                               (10, 7, 'BwwwwB'), (11, 7, 'BQssQB'), (12, 5, 'BBBBBB')]), nk)
    # yawn: eyes shut tight, the jaw drops into a tall open mouth
    H['yawn'] = (_edit(base + ["....zBBB....."], [(5, 9, 'sQQ'), (6, 9, 'SzzS'), (9, 8, 'BBBB'),
                                                  (10, 8, 'BQQQB'), (11, 8, 'BQsQB'), (12, 4, 'bBBQsQB'),
                                                  (13, 4, '.zBBBBB.')]), {'neck': (5, 13)})
    # sleep: eyes shut (a low lid line), the mouth hangs a little open
    H['sleep'] = (_edit(base, [(5, 9, 'SSS'), (6, 9, 'SQQS'), (10, 8, 'BBQBB'), (11, 8, 'bBBBb')]), nk)
    # bored: heavy half-shut lids, a flat mouth
    H['bored'] = (_edit(base, [(5, 9, 'QQQ'), (6, 10, 'zQ'), (10, 8, 'bBBBb')]), nk)
    # soot: frazzled hair standing up, wide white eyes, the mouth agape (the soot pass blackens the rest)
    top = ["...hH.Hh.hH...",
           "..hHHhHHhHHh.."]
    soot = top + _edit(base, [(4, 9, 'sSww'), (5, 9, 'Swww'), (6, 9, 'SwQw'), (10, 8, 'BQQQB'),
                              (11, 8, 'BwwwB')])
    H['soot'] = (soot, {'neck': (5, 14)})
    H['sootblink'] = (_edit(soot, [(6, 9, 'SSSS'), (7, 9, 'SQQQ'), (8, 9, 'SSSS')]), {'neck': (5, 14)})
    for k, v in H.items():
        ext.add(P.HEADS, k, v)


# ------------------------------------------------------------------ effects (glow, no outline)
FX = {
  'fl0': ([
    "..e..",
    ".ec..",
    ".cfc.",
    "cfFfc",
    ".cfc.",
  ], (2, 4)),
  'fl1': ([
    "..e.....",
    "..ce..e.",
    ".ecfc.c.",
    ".cfFfcc.",
    "ecfFFfce",
    "cfFWWFfc",
    ".cfFFfc.",
    "..cffc..",
  ], (4, 7)),
  'fl2': ([
    "....e.....",
    "...ec...e.",
    "..ecf..ec.",
    "..cfFc.cf.",
    ".ecfFfcfc.",
    ".cfFWFfFce",
    "ecfFWWFFfc",
    "cfFWWWWFfc",
    "cfFWWWWFfc",
    ".cfFWWFfc.",
    "..ccffcc..",
  ], (5, 10)),
  'smk0': ([".dd.", "dDDd", ".dd."], (1, 2)),
  'smk1': (["..ddd..", ".dDDDd.", "dDDdDDd", ".dDDDd.", "..dd..."], (3, 4)),
  'smk2': (["...dd", "..dD.", ".dd..", "dD...", ".d..."], (1, 4)),
  'star': ([".y.", "yWy", ".y."], (1, 1)),
  'drop': (["I", "i"], (0, 1)),
}


# ------------------------------------------------------------------ stage sprites
def _outlined(rows, keep_line=None):
    """The stage outline of build.py (one 'K' ring via rig.Canvas.finish), with optional thin lines
    drawn AFTER the outline (risers) so they stay 1 px."""
    w = max(len(r) for r in rows) + 4
    cv = Canvas(w, len(rows) + 4)
    cv.grid(2, 2, rows, 1, 'x')
    return cv.finish()


def _stage(rows, c, lines=(), pts=None):
    """rows on a padded canvas: outline, then the 1 px lines on top of empty pixels; returns
    (rows, anchors) with the anchor shifted by the 2 px pad."""
    r = [list(s) for s in _outlined(rows)]
    for (x0, y0, x1, y1, ch, bow) in lines:
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            t = k / n
            x = x0 + (x1 - x0) * t + bow * 4 * t * (1 - t)
            y = y0 + (y1 - y0) * t
            X, Y = int(round(x)) + 2, int(round(y)) + 2
            if 0 <= Y < len(r) and 0 <= X < len(r[0]) and r[Y][X] == '.':
                r[Y][X] = ch
    an = {'c': (c[0] + 2, c[1] + 2)}
    for k, v in (pts or {}).items():
        an[k] = (v[0] + 2, v[1] + 2)
    return [''.join(s) for s in r], an


def _blank(w, h):
    return [['.'] * w for _ in range(h)]


def _wing(span, tilt, sag, thick, drop=0, sway=0, slack=0, droop=0.0):
    """The intro wing chute, seen from behind/below: a flat arc of cells (navy underside, blue
    fabric, a lit top edge, a white centre cell, orange tip cells) with lines to the harness.
    Returns a stage frame with 'c' = the harness point (shoulders)."""
    W, Hh = 76, 52
    cx, hy = 38, 46                       # the harness on this grid
    g = _blank(W, Hh)
    rim = hy - 30 + drop                  # the arc's centre bottom, 30 px above the harness
    half = span / 2
    cols = {}
    for xi in range(W):
        u = (xi - cx - sway) / half
        if abs(u) > 1:
            continue
        yb = rim + sag * u * u + droop * u ** 4 * 10 - tilt * u
        th = thick * (1 - 0.5 * u * u)
        yt = yb - th
        cols[xi] = (u, yt, yb)
        cell = int(math.floor((u + 1) * 4.5))           # 9 cells
        for y in range(int(math.floor(yt)), int(math.ceil(yb)) + 1):
            if not (0 <= y < Hh):
                continue
            v = (yb - y) / max(th, 1)                   # 0 at the bottom, 1 at the top
            if cell == 4:
                ch = 'W' if v > 0.55 else 'I' if v > 0.25 else 'i'
            elif cell in (0, 8):
                ch = 'f' if v > 0.75 else 'c' if v > 0.25 else 'e'
            else:
                ch = 'm' if v > 0.78 else '3' if v > 0.22 else '4'
            g[y][xi] = ch
    # cell seams on the fabric (navy) and openings along the bottom edge
    for xi, (u, yt, yb) in cols.items():
        f = (u + 1) * 4.5
        if abs(f - round(f)) < 0.5 / (half / 4.5) and 0 < round(f) < 9:
            for y in range(int(math.floor(yt)) + 1, int(math.ceil(yb)) + 1):
                if 0 <= y < Hh and g[y][xi] not in '.':
                    g[y][xi] = '4' if g[y][xi] not in 'WIice f' else ('i' if g[y][xi] in 'WI' else 'e')
    rows = [''.join(r) for r in g]
    lines = []
    for u in (-0.92, -0.62, -0.3, 0.3, 0.62, 0.92):
        xi = int(round(cx + sway + u * half))
        if xi in cols:
            yb = cols[xi][2]
            lines.append((xi, int(math.ceil(yb)) + 1, cx + (-1 if u < 0 else 1), hy - 1, '1', slack * (1 if u < 0 else -1) * abs(u)))
    return _stage(rows, (cx, hy), lines, {'harness': (cx, hy)})


def _heap(params, lines=()):
    """A fallen canopy: columns of fabric (x, top, bottom) on the chute grid, with folds."""
    W, Hh = 76, 52
    cx, hy = 38, 46
    g = _blank(W, Hh)
    for xi, yt, yb, kind in params:
        for y in range(int(round(yt)), int(round(yb)) + 1):
            if 0 <= y < Hh and 0 <= xi < W:
                v = (yb - y) / max(yb - yt, 1)
                if kind == 'w':
                    ch = 'W' if v > 0.6 else 'I' if v > 0.3 else 'i'
                elif kind == 'o':
                    ch = 'f' if v > 0.7 else 'c' if v > 0.3 else 'e'
                elif kind == 's':
                    ch = '4'
                else:
                    ch = 'm' if v > 0.8 else '3' if v > 0.3 else '4'
                g[y][xi] = ch
    rows = [''.join(r) for r in g]
    return _stage(rows, (cx, hy), lines)


def _fold_frames():
    F = []
    # 0: the wing loses pressure: the tips droop, the lines go slack
    F.append(_wing(54, 0, 7, 7, drop=4, slack=2, droop=0.9))
    # 1: it sags and slides down behind him (he faces right)
    F.append(_wing(44, -5, 10, 6, drop=16, sway=-13, slack=3, droop=1.4))
    # 2-4: the fabric settles in a heap on the ground behind him (ground = harness + 22)
    gy = 46 + 22 - 1
    for x0, x1, hm, nlines in ((-34, 2, 12, 2), (-36, 0, 7, 1), (-37, -1, 4, 0)):
        W, Hh = 76, 70
        g = _blank(W, Hh)
        for xi in range(38 + x0, 38 + x1 + 1):
            t = (xi - 38 - x0) / max(1, x1 - x0)
            h = hm * math.sin(math.pi * t) ** 0.55 + 1
            yt = gy - h
            kind = 'w' if abs(t - 0.52) < 0.07 else 'o' if t < 0.1 or t > 0.92 else 'f'
            fold = round(t * 7) != round(t * 7 + 0.07)
            for y in range(int(round(yt)), gy + 1):
                v = (gy - y) / max(h, 1)
                if kind == 'w':
                    ch = 'W' if v > 0.55 else 'I' if v > 0.25 else 'i'
                elif kind == 'o':
                    ch = 'f' if v > 0.7 else 'c' if v > 0.3 else 'e'
                else:
                    ch = 'm' if v > 0.85 else '4' if fold and v < 0.8 else '3' if v > 0.25 else '4'
                g[y][xi] = ch
        lines = [(38 + x1 - 3 - 4 * k, gy - hm // 2, 38 - 1 + k, 46 + 6, '1', -2) for k in range(nlines)]
        F.append(_stage([''.join(r) for r in g], (38, 46), lines, {'harness': (38, 46)}))
    return F




def _water_frames():
    """A water band seen from the side: 'c' = the surface at the band's centre."""
    F = []
    W, Hh = 60, 46
    for k in range(3):
        g = _blank(W, Hh)
        for x in range(W):
            edge = min(x, W - 1 - x)
            crest = 1 if math.sin((x + k * 3) * 0.55) > 0.35 else 0
            y0 = 1 - crest
            for y in range(y0, Hh):
                if edge < 2 and y > Hh - 3 + edge:
                    continue
                d = y - y0
                if d == 0:
                    ch = 'I' if crest else 'i'
                elif d == 1:
                    ch = 'm'
                elif d < 4:
                    ch = 'm' if (x + y + k) % 5 == 0 else '3'
                else:
                    ch = '3' if d < 14 else '4'
                    if d < 20 and (x * 3 + d * 5 + k * 7) % 23 == 0:
                        ch = 'm'
                    if d >= 14 and (x + d * 2 + k) % 11 == 0:
                        ch = '3'
                g[y][x] = ch
        F.append(_stage([''.join(r) for r in g], (W // 2, 1)))
    return F


def _splash_frames():
    """A splash on the surface ('c' = the surface point where he hit the water)."""
    pts = [
        [(-6, -2), (-4, -4), (-2, -5), (2, -5), (4, -4), (6, -2), (-8, -1), (8, -1), (0, -3)],
        [(-9, -5), (-6, -8), (-3, -10), (3, -10), (6, -8), (9, -5), (-11, -2), (11, -2), (0, -7)],
        [(-11, -4), (-7, -7), (-3, -8), (3, -8), (7, -7), (11, -4), (-13, 0), (13, 0)],
        [(-12, -1), (-8, -3), (8, -3), (12, -1)],
    ]
    F = []
    for k, P_ in enumerate(pts):
        W, Hh = 34, 16
        cx, cy = 17, 14
        g = _blank(W, Hh)
        for (x, y) in P_:
            X, Y = cx + x, cy + y
            g[Y][X] = 'I'
            if k < 2:
                g[Y + 1][X] = 'i'
                if Y + 2 < Hh:
                    g[Y + 2][X] = 'm'
        if k == 0:
            for x in range(-5, 6):
                g[cy][cx + x] = 'i' if abs(x) < 4 else 'm'
                if abs(x) < 3:
                    g[cy - 1][cx + x] = 'I'
        F.append(_stage([''.join(r) for r in g], (cx, cy)))
    return F


def _bubble_frames():
    """Bubbles rising to the surface ('c' = the surface point above the hero)."""
    F = []
    sets = [[(0, 6), (-3, 10)], [(1, 2), (-2, 6), (3, 9)], [(-1, -1), (2, 4), (-3, 7)], [(2, 0), (-2, 3)]]
    for k, bs in enumerate(sets):
        W, Hh = 14, 16
        cx, cy = 7, 3
        g = _blank(W, Hh)
        for i, (x, y) in enumerate(bs):
            X, Y = cx + x, cy + y
            if (i + k) % 2 == 0:
                g[Y][X] = 'I'; g[Y][X + 1] = 'i'; g[Y + 1][X] = 'i'; g[Y + 1][X + 1] = 'm'
            else:
                g[Y][X] = 'I'
        if k == 3:                                   # one pops on the surface: a ring
            for x in (-2, -1, 0, 1, 2):
                g[cy][cx + x] = 'i' if abs(x) == 2 else 'I'
        F.append(_stage([''.join(r) for r in g], (cx, cy)))
    return F


_Z = {
  's': ["WWW", "..W", ".W.", "WWW"],
  'b': ["WWWW", "...W", "..W.", ".W..", "WWWW"],
}


def _snore_frames():
    """Z letters drifting up and to the right of the head ('c' = the top of the head)."""
    F = []
    layouts = [[('s', 2, -4)], [('s', 2, -4), ('b', 6, -11)], [('s', 3, -5), ('b', 7, -12), ('b', 12, -19)]]
    for lay in layouts:
        W, Hh = 22, 24
        cx, cy = 2, 22
        g = _blank(W, Hh)
        for kind, x, y in lay:
            for j, r in enumerate(_Z[kind]):
                for i, ch in enumerate(r):
                    if ch != '.':
                        g[cy + y + j][cx + x + i] = ch
        F.append(_stage([''.join(r) for r in g], (cx, cy)))
    return F


def PARTS():
    if _hero_name() == 'vincent':
        _vincent_heads()
    for k, v in FX.items():
        ext.add(P.FX, k, v)
    # the far hand with a wrist watch (the hero's own fist, a light watch face on the wrist)
    rows, an = P.FISTS['fist']
    w = [list(r) for r in rows]
    wy = int(round(an['wrist'][1]))
    w[wy][0] = 'G'
    if wy - 1 >= 0:
        w[wy - 1][0] = 'n'
    if wy + 1 < len(w):
        w[wy + 1][0] = 'n'
    ext.add(P.HANDS, 'watch', ([''.join(r) for r in w], dict(an)))
    # the open hand turned fingers-up (a wave for help), from the hero's own open hand
    rows, an = P.HANDS['open']
    wd = max(len(r) for r in rows)
    rr = [r.ljust(wd, '.') for r in rows]
    up_ = [''.join(r[i] for r in rr) for i in reversed(range(wd))]
    ext.add(P.HANDS, 'wave', (up_, {'wrist': (an['wrist'][1], wd - 1 - an['wrist'][0])}))
    ext.add(P.STAGE, 'chute', [
        _wing(56, 0, 4, 8, 0, 0), _wing(55, 1.5, 4, 8, 1, 1), _wing(54, 2.5, 5, 8, 1, 1),
        _wing(55, 1.0, 4, 8, 0, 0), _wing(56, -1.5, 4, 8, 1, -1), _wing(55, -2.5, 5, 8, 1, -1)])
    ext.add(P.STAGE, 'chute_fold', _fold_frames())
    ext.add(P.STAGE, 'water', _water_frames())
    ext.add(P.STAGE, 'splash', _splash_frames())
    ext.add(P.STAGE, 'bubbles', _bubble_frames())
    ext.add(P.STAGE, 'snore', _snore_frames())
    _hook()


# ------------------------------------------------------------------ the post hook (spin, squash, soot)
def _spin(cv, deg, piv):
    rows = [''.join(r) for r in cv.c]
    out = rotsprite(rows, piv, deg)
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    px, py = piv
    P_, Z_, R_ = cv.p, cv.z, cv.proc
    np_ = [[None] * cv.W for _ in range(cv.H)]
    nz = [[-9.0] * cv.W for _ in range(cv.H)]
    nr = [[False] * cv.W for _ in range(cv.H)]
    for y in range(cv.H):
        for x in range(cv.W):
            if out[y][x] == '.':
                continue
            dx, dy = x - px, y - py
            sx, sy = int(math.floor(px + dx * ca - dy * sa + 0.5)), int(math.floor(py + dx * sa + dy * ca + 0.5))
            sx, sy = max(0, min(cv.W - 1, sx)), max(0, min(cv.H - 1, sy))
            if P_[sy][sx] is None:                     # sampled an empty source: take a neighbour
                for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    X, Y = sx + ddx, sy + ddy
                    if 0 <= X < cv.W and 0 <= Y < cv.H and P_[Y][X] is not None:
                        sx, sy = X, Y
                        break
            np_[y][x], nz[y][x], nr[y][x] = P_[sy][sx] or 'x', Z_[sy][sx], False
    cv.c = [list(r) for r in out]
    cv.p, cv.z, cv.proc = np_, nz, nr
    _tidy(cv)


def _tidy(cv):
    """Rotation clean-up: drop pixels that stick out alone, fill one-pixel notches."""
    for _ in range(2):
        c, p0, z0 = cv.c, [r[:] for r in cv.p], [r[:] for r in cv.z]
        out = [r[:] for r in c]
        for y in range(1, cv.H - 1):
            for x in range(1, cv.W - 1):
                nb = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                full = [(X, Y) for X, Y in nb if c[Y][X] != '.']
                if c[y][x] != '.' and len(full) <= 1:
                    out[y][x] = '.'
                    cv.p[y][x] = None
                elif c[y][x] == '.' and len(full) >= 3:
                    chs = [c[Y][X] for X, Y in full]
                    best = max(sorted(set(chs)), key=chs.count)
                    X, Y = next((X, Y) for X, Y in full if c[Y][X] == best)
                    out[y][x] = best
                    cv.p[y][x], cv.z[y][x] = p0[Y][X] or 'x', z0[Y][X]
        cv.c = out


def _squash(cv, sy, sx, root):
    """Squash the figure toward its lowest row by sy and widen it by sx around the root. Every
    target row samples a band of source rows; the eye whites / teeth ('w') win, so the face reads."""
    rx, ry = root
    ys = [y for y in range(cv.H) if any(ch != '.' for ch in cv.c[y])]
    if not ys:
        return
    bot = max(ys)
    c, P_, Z_ = cv.c, cv.p, cv.z
    nc = [['.'] * cv.W for _ in range(cv.H)]
    np_ = [[None] * cv.W for _ in range(cv.H)]
    nz = [[-9.0] * cv.W for _ in range(cv.H)]
    for y in range(cv.H):
        if y > bot:
            continue
        a = bot - (bot - y + 1) / sy + 1
        b = bot - (bot - y) / sy
        y0, y1 = max(0, int(math.ceil(a - 0.01))), min(cv.H - 1, int(math.floor(b + 0.01)))
        if y1 < y0:
            y0 = y1 = max(0, min(cv.H - 1, int(round((a + b) / 2))))
        mid = (y0 + y1) // 2
        for x in range(cv.W):
            X = int(math.floor(rx + (x - rx) / sx + 0.5))
            if not (0 <= X < cv.W):
                continue
            band = [Y for Y in range(y0, y1 + 1) if c[Y][X] != '.']
            if not band:
                continue
            pick = next((Y for Y in band if c[Y][X] == 'w'), None)
            if pick is None:
                pick = mid if c[mid][X] != '.' else band[len(band) // 2]
            nc[y][x], np_[y][x], nz[y][x] = c[pick][X], P_[pick][X] or 'x', Z_[pick][X]
    cv.c, cv.p, cv.z = nc, np_, nz
    cv.proc = [[False] * cv.W for _ in range(cv.H)]
    _tidy(cv)




def _lum(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.3 * r + 0.55 * g + 0.15 * b


def _soot(cv):
    m = {}
    for ch in rig.HERO:
        if ch in ('K', 'w') or ch not in rig.PAL:
            continue
        l = _lum(rig.PAL[ch])
        m[ch] = '2' if l > 0.62 else '1' if l > 0.34 else '0'
    for y in range(cv.H):
        for x in range(cv.W):
            ch = cv.c[y][x]
            if ch in m:
                cv.c[y][x] = m[ch]


def _hook():
    prev = pose.HOOKS.get('post')
    if prev is not None and getattr(prev, '_moves', False):
        return

    def post(cv, X, p, layer, meta):
        if prev:
            prev(cv, X, p, layer, meta)
        if layer != 'full' or X.S != 1:
            return
        if p.get('spin'):
            deg, (ox, oy) = p['spin']
            R = meta['root']
            _spin(cv, deg, (R[0] + ox, R[1] + oy))
        if p.get('squash'):
            sy, sx = p['squash']
            _squash(cv, sy, sx, meta['root'])
        if p.get('soot'):
            _soot(cv)
    post._moves = True
    pose.HOOKS['post'] = post


# ------------------------------------------------------------------ pose helpers
legs = A.legs
gun, hand = A.gun, A.hand


def fp(pel, far, near, fs='flat', ns='flat', fb=1, nb=1, torso='up', head='fwd', armN=None, armF=None,
       rot=0, tor=(0, 0), hd=(0, 0), fx=None, items=None, cape=None, **kw):
    """A full-body pose (legs + upper)."""
    p = legs(pel, far, near, fs, ns, fb, nb)
    p.update(torso=torso, head=head, tor=tor, hd=hd)
    if rot:
        p['rot'] = rot
    if armN:
        p['armN'] = armN
    if armF:
        p['armF'] = armF
    if fx:
        p['fx'] = fx
    if items:
        p['items'] = items
    if cape:
        p['cape'] = cape                    # a hint for a caped hero's back hook (mode, phase)
    p.update(kw)
    return p


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


# ------------------------------------------------------------------ LOWER
def lower_sets():
    L = {}
    L['fall'] = [
        (legs((0, -17), (-6, -6), (3, -3), 'back', 'hang'), 8),
        (legs((0, -17), (-5, -4), (4, -4), 'hang', 'hang'), 8),
    ]
    L['land'] = [
        (legs((0, -12), (-6, -3), (6, -4), 'toe', 'flat'), 2),
        (legs((0, -13), (-6, -4), (5, -4)), 3),
        (legs((0, -15), (-5, -4), (5, -4)), 4),
    ]
    cd = A.LOWER.get('crouchdown') or [(legs((0, -15), (-5, -4), (5, -4)), 2)]
    L['crouchup'] = [(dict(p), 2) for p, _ in reversed(cd)]
    keys = [((2, -4), (-3, -5)), ((0, -4), (0, -4.5)), ((-2, -4), (2, -5))]
    D = []
    for k in range(3):
        a, b = keys[k], keys[(k + 1) % 3]
        for t in (0, 0.5):
            n = lerp(a[0], b[0], t); f = lerp(a[1], b[1], t)
            D.append((legs((0, -17), f, n, 'hang', 'hang'), 6))
    L['dangle'] = D
    return L


# ------------------------------------------------------------------ FULL: deaths
LOW = (6, 7)


def burn_set():
    S = []
    op = lambda h, b=1, z=None: hand(h, 'open', 'hand', bend=b, z=z)
    dup = lambda h: gun(h, 'dup', sh=(1.5, -0.5))
    # 0: it catches: a jolt, the arms fly out, a flame on his seat
    S.append((fp((0, -18), (-5, -4), (5, -5), 'flat', 'toe', head='panic', torso='back',
                 armN=dup((8, -4)), armF=op((-8, -5)),
                 fx=[('fl0', (-5, -16)), ('fl1', (-6, -20))], cape=('billow', 0)), 5))
    # 1-2: the hot-foot hop, the arms flail, the flames climb up his back
    S.append((fp((0, -19), (-6, -8), (4, -6), 'back', 'hang', head='panic',
                 armN=dup((8, -6)), armF=op((-9, -2)),
                 fx=[('fl1', (-6, -18)), ('fl2', (-5, -26)), ('fl0', (3, -14))], cape=('billow', 1)), 5))
    S.append((fp((0, -18), (-4, -4), (6, -9), 'flat', 'hang', head='shout',
                 armN=gun((9, -2)), armF=op((-7, -7)),
                 fx=[('fl2', (-4, -22)), ('fl2', (1, -34)), ('fl1', (-3, -12))], cape=('billow', 2)), 6))
    # 3-5: soot statue, the last flames go out, white eyes, a blink
    statue = dict(head='soot', armN=gun((5, 7), 'low'), armF=hand((-2, 9), 'open', 'hand'), soot=1)
    S.append((fp((0, -17), (-5, -4), (5, -4), fx=[('fl0', (-2, -44)), ('fl0', (3, -43)), ('smk1', (-3, -49))], **statue), 8))
    S.append((fp((0, -17), (-5, -4), (5, -4), fx=[('smk1', (0, -49)), ('smk2', (-4, -55))], **statue), 12))
    st2 = dict(statue, head='sootblink')
    S.append((fp((0, -17), (-5, -4), (5, -4), fx=[('smk2', (1, -53)), ('smk0', (-3, -59))], **st2), 10))
    # 6: stiff as a board, he tips over backwards
    S.append((fp((-3, -15), (-6, -4), (4, -6), 'toe', 'hang', rot=40, head='soot', soot=1,
                 armN=gun((6, 3), 'fwd'), armF=hand((-3, 7), 'open', 'hand'),
                 fx=[('smk1', (-10, -40))]), 6))
    # 7-8: flat on his back in a puff of smoke
    lie = dict(rot=90, head='sootblink', soot=1, armN=dict(hand=(-6, -1), end=('hand', 'open'), bend=1),
               armF=dict(hand=(-5, 3), end=('hand', 'open'), bend=1), items=[('pistol', (15, -2), 20)])
    S.append((fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', fx=[('smk1', (-10, -10)), ('smk1', (2, -9)), ('smk0', (-4, -14))], **lie), 6))
    S.append((fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', fx=[('smk2', (-6, -12)), ('smk0', (-2, -18))], **lie), 40))
    return S




def tumble(pose_, deg):
    p = dict(pose_)
    p['spin'] = (deg, (0, -21))
    return p


BLAST_PATH = [(-2, -4), (-8, -14), (-14, -22), (-19, -25), (-24, -22), (-28, -12), (-26, 0), (-26, -5), (-26, 0), (-26, 0)]
GUN_PATH = [None, (2, -40), (0, -52), (-2, -57), (-3, -52), (-4, -40), (-5, -22), (-6, -8), (-6, -2), (-6, -2)]


def blast_set():
    S = []
    op = lambda h, b=1: hand(h, 'open', 'hand', bend=b)

    def gun_at(k):
        g = GUN_PATH[k]
        if not g:
            return None
        ox, oy = BLAST_PATH[k]
        return [('pistol', (g[0] - ox, g[1] - oy), 20)]
    star = fp((0, -18), (-7, -6), (6, -7), 'back', 'heel', torso='back', head='panic',
              armN=op((9, -5)), armF=op((-8, -5)), cape=('billow', 0))
    curl = fp((0, -18), (-3, -10), (4, -11), 'hang', 'hang', torso='up', head='panic',
              armN=op((8, -6)), armF=op((-7, -5)), cape=('billow', 1))
    first = dict(star, armN=gun((9, -4), 'dup', sh=(1.5, -0.5)), fx=[('smk1', (-13, -20)), ('smk1', (-9, -6))])
    S.append((tumble(first, 15), 3))
    for k, (body, deg) in enumerate(((star, 70), (curl, 150), (curl, 230), (curl, 310), (star, 375)), 1):
        p = tumble(body, deg)
        p['items'] = gun_at(k)
        S.append((p, 4))
    lie = dict(rot=90, armN=dict(hand=(-6, -2), end=('hand', 'open'), bend=1), armF=dict(hand=(-5, 3), end=('hand', 'open'), bend=1))
    # 6: slams down on his back
    S.append((fp((-10, -3), (5, -5), (10, -6), 'lie', 'lie', head='hurt', items=gun_at(6), **lie), 4))
    # 7: bounces: knees and arms up
    S.append((fp((-10, -6), (3, -11), (8, -13), 'heel', 'heel', head='hurt', rot=82,
                 armN=dict(hand=(-5, -6), end=('hand', 'open'), bend=1), armF=dict(hand=(-3, -6), end=('hand', 'open'), bend=1),
                 items=gun_at(7)), 4))
    # 8-9: down again, the limbs flop, eyes shut, a wisp of smoke
    S.append((fp((-10, -3), (5, -4), (10, -5), 'lie', 'lie', head='hurt', items=gun_at(8), **lie), 5))
    S.append((fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='blink', items=gun_at(9),
                 fx=[('smk2', (-14, -9)), ('smk0', (-12, -15))], **lie), 14))
    return S




def drown_set():
    S = []
    op = lambda h, b=1, sh=(0, 0): hand(h, 'open', 'hand', bend=b, sh=sh)
    wave = lambda h, sh=(1, -2): hand(h, 'wave', 'hand', bend=-1, sh=sh)
    lg = ((0, -17), (-4, -5), (4, -6), 'hang', 'hang')
    lg2 = ((0, -17), (-3, -7), (5, -5), 'hang', 'hang')
    # the depth (feet below the surface) goes in the steps (oy); the poses move the arms
    S.append((fp(*lg, head='panic', armN=op((9, -5)), armF=op((-8, -5))), 4))
    S.append((fp(*lg2, head='shout', armN=op((8, -7)), armF=op((-9, -2))), 6))
    S.append((fp(*lg, head='panic', armN=op((10, -2)), armF=op((-7, -6))), 6))
    S.append((fp(*lg2, head='shout', armN=op((8, -7)), armF=op((-8, -1))), 6))
    # one arm waves for help as he goes down
    S.append((fp(*lg, head='hurt', armN=wave((10, -5), (0, 0)), armF=op((-5, 3))), 8))
    S.append((fp(*lg, head='hurt', hd=(0, 1), armN=wave((9, -7), (0, 0)), armF=op((-5, 3))), 8))
    # the head under, only the hand above the surface (the head drops into the collar, unseen)
    S.append((fp(*lg, head='blink', hd=(0, 5), armN=wave((2, -11), (1, -3)), armF=op((-4, 4))), 8))
    S.append((fp(*lg, head='blink', hd=(0, 5), armN=wave((-1, -11), (1, -3)), armF=op((-4, 4))), 14))
    return S




def flat_set():
    S = []
    stand = fp((0, -17), (-5, -4), (5, -4), head='hurt', armN=gun((8, 4)), armF=hand((9, 5)))
    splay = fp((0, -17), (-7, -4), (7, -4), head='hurt', armN=dict(hand=(10, 0), end=('hand', 'open'), bend=-1),
               armF=dict(hand=(-10, 1), end=('hand', 'open'), bend=1))
    S.append((dict(stand, squash=(0.55, 1.15)), 3))
    S.append((dict(stand, squash=(0.2, 1.45)), 6))
    S.append((dict(splay, squash=(0.22, 1.4)), 14))
    S.append((dict(splay, squash=(0.3, 1.3), fx=[('star', (-6, -12)), ('star', (5, -14))]), 6))
    S.append((dict(splay, head='blink', squash=(0.22, 1.4), fx=[('star', (-3, -14)), ('star', (8, -11))]), 30))
    return S


# ------------------------------------------------------------------ FULL: the rest
def victory_set():
    S = []
    sky = gun((7.5, -6.5), 'up', sh=(3.5, -1.5))           # the shoot-up pose: pistol to the sky
    up_ = hand((-6, -8), 'fistup', 'fist', bend=1)        # the far fist punches the air behind his head
    dn_ = hand((-7, -2), 'fist', 'fist', bend=1)
    st = ((0, -17), (-5, -4), (5, -4))
    S.append((fp(*st, head='happy', armN=sky, armF=up_, cape=('billow', 0)), 6))
    S.append((fp((0, -15), (-6, -4), (5, -4), head='happy', armN=sky, armF=dn_, cape=('billow', 1)), 6))
    S.append((fp((0, -18), (-5, -2), (4, -2), 'toe', 'toe', head='shout', armN=sky, armF=up_, cape=('billow', 2)), 5))
    S.append((fp((0, -18), (-5, -4), (3, -6), 'hang', 'hang', head='happy', armN=sky, armF=up_, cape=('billow', 3)), 6))
    S.append((fp((0, -17), (-5, -3), (5, -4), 'toe', 'flat', head='happy', armN=sky, armF=up_, cape=('billow', 4)), 4))
    S.append((fp((0, -15), (-6, -4), (5, -4), head='shout', armN=sky, armF=dn_, cape=('billow', 5)), 6))
    S.append((fp(*st, head='happy', armN=sky, armF=up_, cape=('billow', 6)), 6))
    S.append((fp(*st, head='happy', armN=sky, armF=dn_, cape=('billow', 7)), 6))
    return S




def spawn_set():
    S = []
    sky = gun((7.5, -6.5), 'up', sh=(3.5, -1.5))
    S.append((fp((0, -18), (-3, -2), (3, -3), 'hang', 'hang', head='shout', armN=sky,
                 armF=hand((-8, -4), 'open', 'hand', bend=1), cape=('float', 0)), 4))
    S.append((fp((0, -17), (-4, -3), (4, -4), 'hang', 'heel', head='shout', armN=sky,
                 armF=hand((-8, -1), 'open', 'hand', bend=1), cape=('float', 1)), 4))
    S.append((fp((0, -11), (-6, -3), (6, -4), 'toe', 'flat', torso='lean2', head='fwd', armN=gun((9, 3)),
                 armF=hand((-5, 5), 'open', 'hand'), cape=('crouch', 0)), 4))
    S.append((fp((0, -13), (-6, -4), (5, -4), torso='lean', head='fwd', armN=gun((9, 3)), armF=hand((10, 4)), cape=('crouch', 0.5)), 3))
    S.append((fp((0, -16), (-5, -4), (5, -4), torso='up', head='happy', armN=gun((8, 4)), armF=hand((9, 5))), 3))
    S.append((fp((0, -17), (-5, -4), (5, -4), torso='up', head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 6))
    return S




def bored_set():
    S = []
    low = gun(LOW, 'low')
    W = lambda h, b=-1: hand(h, 'watch', 'hand', bend=b, z=6.5)
    st = ((0, -17), (-5, -4), (5, -4))
    S.append((fp(*st, head='fwd', armN=low, armF=hand((9, 5))), 12))
    S.append((fp(*st, head='fwd', armN=low, armF=W((7, 0))), 6))
    S.append((fp(*st, head='down', armN=low, armF=W((7, -3))), 16))       # looks at his watch
    S.append((fp(*st, head='bored', armN=low, armF=W((7, -3))), 10))
    S.append((fp(*st, head='down', armN=low, armF=W((8, -4))), 5))        # a shake of the wrist
    S.append((fp(*st, head='down', armN=low, armF=W((7, -3))), 10))
    S.append((fp(*st, head='bored', tor=(0, 1), armN=low, armF=hand((8, 6))), 14))      # a sigh
    S.append((fp((0, -17), (-5, -4), (5, -5), 'flat', 'heel', head='bored', armN=low, armF=hand((8, 6))), 6))   # foot tap
    S.append((fp(*st, head='bored', armN=low, armF=hand((8, 6))), 6))
    S.append((fp((0, -17), (-5, -4), (5, -5), 'flat', 'heel', head='bored', armN=low, armF=hand((8, 6))), 6))
    S.append((fp(*st, head='bored', armN=low, armF=hand((8, 6))), 10))
    S.append((fp(*st, head='blink', armN=gun((8, 4)), armF=hand((9, 5))), 6))
    return S




def fidgetb_set():
    """VINCENT straightens his tie: pinch the knot, chin up, a tug left and right, smooth it down,
    a pat on the chest, a smug look."""
    S = []
    low = gun(LOW, 'low')
    F = lambda h, kind='fist', lib='fist': hand(h, kind, lib, bend=-1, z=6.5)
    st = ((0, -17), (-5, -4), (5, -4))
    S.append((fp(*st, head='fwd', armN=low, armF=hand((9, 5))), 10))
    S.append((fp(*st, head='down', armN=low, armF=F((5, 0))), 6))
    S.append((fp(*st, head='up', armN=low, armF=F((5, -2))), 8))
    S.append((fp(*st, head='up', hd=(1, 0), armN=low, armF=F((6, -2.5))), 4))
    S.append((fp(*st, head='up', hd=(-1, 0), armN=low, armF=F((4, -2))), 4))
    S.append((fp(*st, head='up', hd=(1, 0), armN=low, armF=F((6, -2.5))), 4))
    S.append((fp(*st, head='down', armN=low, armF=F((5, 3), 'open', 'hand')), 8))
    S.append((fp(*st, head='smug', armN=low, armF=F((5, 2), 'open', 'hand')), 5))
    S.append((fp(*st, head='smug', armN=low, armF=F((5, 3), 'open', 'hand')), 5))
    S.append((fp(*st, head='smug', armN=low, armF=hand((9, 5))), 16))
    S.append((fp(*st, head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 10))
    return S


SIT = ((0, -5), (8, -3), (11, -3), 'flat', 'flat', 1, 1)


def yawn_set():
    S = []
    st = ((0, -17), (-5, -4), (5, -4))
    # the stretch: the arms wide and up, leaning back, up on the toes
    fore = lambda h: gun(h, 'dup', sh=(1.5, -0.5))
    S.append((fp(*st, head='blink', armN=gun(LOW, 'low'), armF=hand((8, 6))), 8))
    S.append((fp((0, -18), (-5, -3), (5, -3), 'toe', 'toe', torso='back', head='yawn',
                 armN=fore((8, -5)), armF=hand((-8, -5), 'open', 'hand', bend=1)), 8))
    S.append((fp((0, -19), (-5, -2), (5, -2), 'toe', 'toe', torso='back', head='yawn', hd=(0, -1),
                 armN=fore((7, -7)), armF=hand((-8, -6), 'fistup', 'fist', bend=1)), 16))
    S.append((fp(*st, head='blink', armN=gun((5, 8), 'low'), armF=hand((2, 10), 'open', 'hand')), 6))
    S.append((fp((0, -13), (-5, -4), (6, -4), torso='lean', head='blink', armN=gun((5, 8), 'low'), armF=hand((3, 9), 'open', 'hand')), 5))
    S.append((fp((0, -9), (-2, -3), (8, -3), 'toe', 'flat', torso='lean', head='blink', armN=gun((5, 8), 'low'), armF=hand((-2, 9), 'open', 'hand')), 5))
    S.append((fp(*SIT, torso='lean', head='blink', hd=(0, 1), armN=gun((6, 6), 'low'), armF=hand((6, 6), 'open', 'hand')), 6))
    S.append((fp(*SIT, torso='lean', head='sleep', hd=(0, 2), armN=gun((6, 6), 'low'), armF=hand((6, 6), 'open', 'hand')), 10))
    return S




def sleep_set():
    S = []
    for k in range(4):
        tor = (0, [0, 1, 1, 0][k])
        hd = (0, [2, 2, 3, 3][k] - tor[1])
        S.append((fp(*SIT, torso='lean', head='sleep', tor=tor, hd=hd, armN=gun((6, 6 - tor[1]), 'low'),
                     armF=hand((6, 6 - tor[1]), 'open', 'hand')), 12))
    return S


def mount_set():
    S = []
    S.append((fp((0, -12), (-6, -3), (6, -4), 'toe', 'flat', torso='lean2', armN=hand((-2, 8), 'fist', 'fist', bend=1),
                 armF=hand((-4, 7), 'fist', 'fist', bend=1), cape=('crouch', 0)), 6))
    S.append((fp((0, -19), (-3, -1), (3, -1), 'toe', 'toe', torso='up', head='shout', armN=hand((9, -4), 'fist', 'fist', bend=1),
                 armF=hand((9, -5), 'fist', 'fist', bend=1, z=6.5), cape=('jump', 1)), 6))
    S.append((fp((0, -17), (-3, -9), (4, -10), 'hang', 'hang', torso='up', armN=hand((8, -2), 'fist', 'fist', bend=1),
                 armF=hand((8, -3), 'fist', 'fist', bend=1), cape=('jump', 2)), 6))
    S.append((fp((0, -17), (8, -13), (10, -13), 'hang', 'hang', torso='lean', head='down', hd=(1, 1), armN=hand((5, 9), 'fist', 'fist'),
                 armF=hand((5, 8), 'fist', 'fist'), cape=('jump', 3)), 6))
    S.append((fp((0, -17), (7, -12), (9, -12), 'hang', 'hang', torso='lean', head='down', armN=hand((6, 8), 'fist', 'fist'),
                 armF=hand((6, 7), 'fist', 'fist'), cape=('jump', 4)), 6))
    return S


def mounthop_set():
    S = []
    S.append((fp((0, -12), (-6, -3), (6, -4), 'toe', 'flat', torso='lean2', armN=hand((-2, 8), 'fist', 'fist', bend=1),
                 armF=hand((-4, 7), 'fist', 'fist', bend=1), cape=('crouch', 0)), 3))
    S.append((fp((0, -19), (-4, -1), (2, -1), 'toe', 'toe', torso='lean', armN=hand((8, -2), 'fist', 'fist', bend=1),
                 armF=hand((7, -3), 'fist', 'fist', bend=1), cape=('jump', 1)), 3))
    S.append((fp((0, -17), (-3, -9), (5, -11), 'hang', 'hang', torso='lean', armN=hand((8, 0), 'fist', 'fist'),
                 armF=hand((7, -1), 'fist', 'fist'), cape=('jump', 2)), 3))
    # over the seat: the near leg swings forward high, the far leg trails
    S.append((fp((0, -17), (-7, -8), (10, -14), 'back', 'flat', torso='lean', armN=hand((9, 1), 'fist', 'fist'),
                 armF=hand((8, 1), 'fist', 'fist'), cape=('jump', 3)), 3))
    # settle: seated astride, knees bent, hands forward on the grips
    S.append((fp((0, -17), (4, -8), (6, -7), 'hang', 'hang', torso='lean', armN=hand((9, 1), 'fist', 'fist'),
                 armF=hand((9, 0), 'fist', 'fist'), cape=('hang', 0)), 4))
    return S


# the tuck: knees up in front of the chest, the hands on the shins (the legs are drawn behind the
# torso in a full sprite, so the knees come forward past the jacket to show)
TUCK = fp((0, -17), (8, -13), (10, -13), 'hang', 'hang', torso='lean', head='down', hd=(1, 1),
          armN=hand((5, 9), 'fist', 'fist'), armF=hand((5, 8), 'fist', 'fist'), cape=('jump', 3))


def flip_set():
    return [(dict(TUCK, spin=(-45 * k, (3, -24))), 3) for k in range(8)]


def BUILD():
    for k, v in lower_sets().items():
        ext.add(A.LOWER, k, v)
    for k, fn in (('death_burn', burn_set), ('death_blast', blast_set), ('death_drown', drown_set),
                  ('death_flat', flat_set), ('victory', victory_set), ('spawn', spawn_set),
                  ('bored', bored_set), ('fidgetb', fidgetb_set), ('yawn', yawn_set), ('sleep', sleep_set),
                  ('mount', mount_set), ('mounthop', mounthop_set), ('flip', flip_set)):
        ext.add(A.FULL, k, fn())


def DERIVE():
    _hook()          # a hero that set its own post hook in after_ext() still gets the chain


# ------------------------------------------------------------------ page groups
def _f(k, i, t=None, **kw):
    s = {'u': None, 'l': None, 'f': [k, i], 't': A.FULL[k][i][1] if t is None else t}
    s.update(kw)
    return s


def _ul(u, ui, l, li, t, **kw):
    s = {'u': [u, ui] if u else None, 'l': [l, li] if l else None, 't': t}
    s.update(kw)
    return s


SURF = -26          # the drown page: the water surface sits this far above the ground point


def GROUPS():
    G = []
    F, L, U = A.FULL, A.LOWER, A.UPPER
    nf = lambda k: len(F[k])
    nu = lambda k: len(U[k])
    nl = lambda k: len(L[k])
    # ---- Moves
    steps = [_ul('jump', 4 % nu('jump'), 'fall', k % nl('fall'), 4, oy=-30 + 5 * k) for k in range(6)]
    steps += [_ul('idle', 0, 'land', k, L['land'][k][1]) for k in range(nl('land'))]
    steps += [_ul('idle', 0, 'stand', 0, 16)]
    G.append({'cat': 'Moves', 'title': 'Fall and land', 'ref': '2 + 3', 'steps': steps})
    steps = [_ul('crouchidle', 0, 'crouchdown', k, 3) for k in range(nl('crouchdown'))]
    steps += [_ul('crouchidle', k, 'crouch', 0, U['crouchidle'][k][1]) for k in range(nu('crouchidle'))]
    steps += [_ul('crouchidle' if k == 0 else 'idle', 0, 'crouchup', k, 3) for k in range(nl('crouchup'))]
    steps += [_ul('idle', 0, 'stand', 0, 16)]
    G.append({'cat': 'Moves', 'title': 'Crouch and stand up', 'ref': '2 / – / 2', 'steps': steps})
    arc = [-8, -14, -18, -20, -20, -18, -14, -8]
    steps = [_ul('jump', 0, 'jumprun', 0, 3)]
    steps += [_f('flip', k, oy=arc[k], ox=4 + 3 * k) for k in range(nf('flip'))]
    steps += [_ul('idle', 0, 'land', k, L['land'][k][1], ox=30) for k in range(nl('land'))]
    steps += [_ul('idle', 0, 'stand', 0, 12, ox=30)]
    G.append({'cat': 'Moves', 'title': 'Somersault', 'ref': '8', 'steps': steps})
    oys = [0, -6, -16, -22, -18]
    steps = [_ul('idle', 0, 'stand', 0, 10)] + [_f('mount', k, oy=oys[k], ox=2 * k) for k in range(nf('mount'))]
    G.append({'cat': 'Moves', 'title': 'Mount', 'ref': '5–6', 'steps': steps})
    oys = [0, -4, -9, -7, -3]
    steps = [_ul('idle', 0, 'stand', 0, 10)] + [_f('mounthop', k, oy=oys[k], ox=3 * k) for k in range(nf('mounthop'))]
    steps += [_f('mounthop', nf('mounthop') - 1, 20, oy=oys[-1], ox=12)]
    G.append({'cat': 'Moves', 'title': 'Swan hop', 'ref': '5', 'steps': steps})
    # the parachute: down under the swaying canopy, land, the canopy folds behind him
    steps = []
    N = 20
    nch = len(ext.P.STAGE['chute'])
    for k in range(N):
        oy = round(-52 * (1 - k / N))
        steps.append(_ul('idle', k % nu('idle'), 'dangle', k % nl('dangle'), 6, oy=oy,
                         st=[['chute', (k * 6 // 8) % nch, 0, -22, -1]]))
    fold = len(ext.P.STAGE['chute_fold'])
    for k in range(fold):
        if k < nl('land'):
            steps.append(_ul('idle', 0, 'land', k, 4, st=[['chute_fold', k, 0, -22, -1]]))
        else:
            steps.append(_ul('idle', k % nu('idle'), 'stand', 0, 6 if k < fold - 1 else 30, st=[['chute_fold', k, 0, -22, -1]]))
    steps.append(_ul('idle', 0, 'stand', 0, 20))
    G.append({'cat': 'Moves', 'title': 'Parachute drop', 'ref': '6 + 6 / 5', 'steps': steps})
    # ---- Deaths
    hop = [0, -4, -3, 0, 0, 0, 0, 0, 0]
    G.append({'cat': 'Deaths', 'title': 'Burn death', 'ref': '≈ 7',
              'steps': [_f('death_burn', k, oy=hop[k] if k < len(hop) else 0) for k in range(nf('death_burn'))]})
    path = BLAST_PATH
    G.append({'cat': 'Deaths', 'title': 'Blast death', 'ref': '10',
              'steps': [_f('death_blast', k, ox=path[k][0], oy=path[k][1]) for k in range(nf('death_blast'))]})
    depth = [11, 8, 9, 10, 15, 22, 35, 37]
    steps = []
    for k in range(nf('death_drown')):
        oy = depth[k] + SURF
        st = [['water', k % 3, 0, SURF - oy, 1]]
        if k < 2:
            st.append(['splash', k, 0, SURF - oy, 2])
        if k >= 4:
            st.append(['bubbles', (k - 4) % 4, -5, SURF - oy, 2])
        steps.append(_f('death_drown', k, oy=oy, st=st))
    for k in range(2):
        steps.append({'u': None, 'l': None, 'hide': 1, 't': 12, 'oy': 0,
                      'st': [['water', k % 3, 0, SURF, 1], ['bubbles', (k + 2) % 4, 2, SURF, 2]]})
    G.append({'cat': 'Deaths', 'title': 'Drown', 'ref': '≈ 8', 'steps': steps})
    G.append({'cat': 'Deaths', 'title': 'Crushed flat', 'ref': '≈ 5', 'steps': [_f('death_flat', k) for k in range(nf('death_flat'))]})
    # ---- Full body
    vo = [0, 0, -3, -6, -2, 0, 0, 0]
    G.append({'cat': 'Full body', 'title': 'Victory', 'ref': '6–8',
              'steps': [_f('victory', k, oy=vo[k] if k < len(vo) else 0) for k in range(nf('victory'))]})
    so = [-56, -22, 0, 0, 0, 0]
    G.append({'cat': 'Full body', 'title': 'Respawn', 'ref': '6',
              'steps': [_f('spawn', k, oy=so[k] if k < len(so) else 0) for k in range(nf('spawn'))]})
    G.append({'cat': 'Full body', 'title': 'Bored', 'ref': '6+', 'steps': [_f('bored', k) for k in range(nf('bored'))]})
    G.append({'cat': 'Full body', 'title': 'Second fidget', 'ref': '≈ 10', 'steps': [_f('fidgetb', k) for k in range(nf('fidgetb'))]})
    G.append({'cat': 'Full body', 'title': 'Time out: yawn', 'ref': '8', 'steps': [_f('yawn', k) for k in range(nf('yawn'))]})
    steps = []
    for r in range(2):
        for k in range(nf('sleep')):
            steps.append(_f('sleep', k, st=[['snore', (r * nf('sleep') + k) % 3, 9, -30, 1]]))
    G.append({'cat': 'Full body', 'title': 'Time out: sleep', 'ref': '2–4', 'steps': steps})
    return G
