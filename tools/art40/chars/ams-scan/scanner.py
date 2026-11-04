# SCANAUTO: the scanner (boss/ams-scan/scanner-<state>, scanner-gone) - the big, thick white box on
# a black roof rack (the cast sample's box: a lit lid face, the seam round the lid, sides that slope
# in underneath, slanted ends, two smoked camera windows on the side with the lens behind the middle
# one, a window on each end, the grey number band; never a light bar). Car anchor.
#
# Frame roles (car.ts reads the named constants):
#   0 SCAN_DOWN, 1 SCAN_LIFT1, 2 SCAN_LIFT2  the box rises on its lift struts (the intro)
#   3..6 SCAN_ON + the sweep                  the windows glow red, a bright scan bar sweeps from
#                                             the rear window to the front one, the lens pulses
#   7, 8 SCAN_LOCK                            the lens heats to white, the front window glares
#   9 SCAN_FIRE                               the printer kicks: the lid jumps 1 px, a flash at
#                                             the slot, the strip's tongue
#   10 SCAN_RECOIL                            the lid drops back, a puff from the slot
# Damage: 1 a cracked window and a dented lid; 2 the box askew (its rear end dropped), both windows
# cracked, soot; gone: the bent bar, the sheared struts, a dangling cable.
import math

from . import geo as G

N_SWEEP = 4
ROLES = dict(SCAN_DOWN=0, SCAN_LIFT1=1, SCAN_LIFT2=2, SCAN_ON=3, SCAN_SWEEP_N=N_SWEEP, SCAN_LOCK=7,
             SCAN_FIRE=9, SCAN_RECOIL=10)
# (rise, mode, k): mode idle / sweep / lock / fire / recoil
MODES = [(0, 'idle', 0), (1, 'idle', 0), (2, 'idle', 0)] + [(2, 'sweep', k) for k in range(N_SWEEP)] + \
        [(2, 'lock', 0), (2, 'lock', 1), (2, 'fire', 0), (2, 'recoil', 0)]
BOX_DENT = (-7.5, -38.4)


def _rot(x, y, a, piv):
    """Inverse turn of a point about piv by a (radians, clockwise on screen)."""
    c, s = math.cos(-a), math.sin(-a)
    dx, dy = x - piv[0], y - piv[1]
    return piv[0] + dx * c - dy * s, piv[1] + dx * s + dy * c


def rack(r, state, bent=False):
    for Y in range(-34, -28):
        for X in range(-21, 4):
            x, y = X + 0.5, Y + 0.5
            if bent and x < -6:
                y -= (x + 6) * -0.16                             # the rear half of the bar bent down
            if -19.8 <= x < 2.6 and -33.6 <= y < -32.4:
                r.put(X, Y, 'P' if y < -33.0 else 'p', -1.5, 'rack')
            elif -32.4 <= y < -28.0 and any(f0 + 0.2 <= x < f1 - 0.2 for f0, f1 in ((-19.4, -16.2), (-1.4, 1.8))):
                # the feet reach 1 px into the roof (drawn behind the body: no gap when it pitches)
                r.put(X, Y, 'p' if x < -17.6 or x < 0.2 else 'o', -1.5, 'rack')


def box(state, rise, mode='idle', k=0):
    r = G.Raster()
    rack(r, state)
    askew = G.ASKEW if state == 2 else 0.0
    lid = 1 if mode == 'fire' else 0
    for Y in range(-46, -28):
        for X in range(-26, 10):
            x, y = X + 0.5, Y + 0.5
            if askew:
                x, y = _rot(x, y, askew, G.PIVOT)
            # the lift struts
            if -33.6 - rise <= y < -33.6 and any(sx <= x < sx + 1.1 for sx in (-14, -4)):
                r.put(X, Y, 's', -1.4, 'rack')
            v = y + rise
            vl = v + lid if v < -37.1 else v                         # the lid jumps when it prints
            inside = G.inpoly(x, vl, G.SHELL) if v < -37.1 else G.inpoly(x, v, G.SHELL)
            if lid and -38.2 <= v < -37.1 and G.inpoly(x, v, G.SHELL):
                inside = True
            if not inside:
                continue
            vv = vl
            ch = '2'
            if vv < -38.25:
                ch = '1'                                             # the lid's top face
            elif abs(v - -37.1) < 0.5 or (lid and -38.25 <= vv < -37.1 and abs(v - -37.1) < 1.0):
                ch = '3' if not lid else ('4' if abs(v - -37.1) < 0.5 else '3')   # the seam round the lid
            elif v > -34.6:
                ch = '3'                                             # the sides slope in underneath
            elif x > 5.0:
                ch = '1'                                             # the front end faces the light
            elif x < -21.8:
                ch = '3'
            win = -1
            for wi, (x0, x1) in enumerate(G.SIDE_WIN):
                if x0 <= x < x1 and -36.7 <= v < -34.2:
                    win = wi
                    ch = _window(mode, k, x, v, x0, x1)
            if G.inpoly(x, v, G.FRONT_WIN):
                ch = {'idle': 'N', 'sweep': 'O', 'lock': 'w' if k else 'O', 'fire': 'O', 'recoil': 'E'}[mode]
            if G.inpoly(x, v, G.REAR_WIN):
                ch = 'N' if mode == 'idle' else 'Q'
            t = (v + 39.4) / 5.8
            bx0 = -1.9 + (-2.5 - -1.9) * t
            if bx0 <= x < bx0 + 3.6 and vv > -38.25 and abs(v - -37.1) >= 0.5 and win < 0:
                ch = 'q'
            r.put(X, Y, ch, -1, 'scan')
    _lens(r, state, rise, mode, k, askew)
    if state >= 1:
        _dent(r, rise, askew)
        _crack_window(r, G.SIDE_WIN[0], rise, askew)
    if state >= 2:
        _crack_window(r, G.SIDE_WIN[1], rise, askew)
        for (X, Y), (ch, z, part) in list(r.items()):
            if part == 'scan' and ch in '123' and ((X * 5 + Y * 3) % 7 < 2) and X < -12:
                r[(X, Y)] = ({'1': '3', '2': '3', '3': '4'}[ch], z, part)
    return r


def _window(mode, k, x, v, x0, x1):
    if mode == 'idle':
        return 'g' if v < -36.0 else 'N' if v > -34.9 else 'n'
    base = 'E' if v > -35.2 else 'Q'
    if mode == 'sweep':
        # the bright bar runs over both windows, rear to front (16 px in N_SWEEP steps)
        bx = -20.6 + (k + 0.5) * (16.0 / N_SWEEP)
        if abs(x - bx) < 1.2:
            return 'O' if abs(x - bx) < 0.6 or v > -35.6 else 'w'
        if abs(x - bx) < 2.4:
            return 'r' if v < -35.2 else 'E'
        return base
    if mode == 'lock':
        return 'r' if v > -35.6 else ('E' if k == 0 else 'r')
    if mode == 'fire':
        return 'O' if v > -35.6 else 'r'
    return base


def _lens(r, state, rise, mode, k, askew):
    lx, ly = G.LENS
    pts = []
    if mode == 'idle':
        pts = [(0, 0, 'Z'), (1, 0, 'z'), (0, 1, 'o')]
    elif mode == 'sweep':
        big = k % 2 == 0
        pts = [(0, 0, 'w'), (1, 0, 'O'), (-1, 0, 'O'), (0, 1, 'O')] + ([(0, -1, 'O')] if big else [])
    elif mode == 'lock':
        pts = [(0, 0, 'W' if k else 'w'), (1, 0, 'w' if k else 'O'), (-1, 0, 'O'), (0, 1, 'w' if k else 'O'),
               (0, -1, 'O'), (1, 1, 'O')]
    elif mode == 'fire':
        pts = [(0, 0, 'w'), (1, 0, 'O'), (-1, 0, 'O'), (0, 1, 'O')]
    else:
        pts = [(0, 0, 'O'), (1, 0, 'E'), (0, 1, 'E')]
    for dx, dy, ch in pts:
        x, y = lx + dx, ly + dy - rise
        if askew:
            x, y = _fwd(x, y, askew)
        X, Y = int(math.floor(x)), int(math.floor(y))
        if (X, Y) in r and r[(X, Y)][2] == 'scan':
            r.put(X, Y, ch, -0.9, 'scan')


def _fwd(x, y, a):
    c, s = math.cos(a), math.sin(a)
    dx, dy = x - G.PIVOT[0], y - G.PIVOT[1]
    return G.PIVOT[0] + dx * c - dy * s, G.PIVOT[1] + dx * s + dy * c


def _dent(r, rise, askew):
    x, y = BOX_DENT
    for dx, dy, ch in ((0, 0, '4'), (1, 0, '3'), (-1, 0, '3'), (0, 1, '3'), (-1, -1, '2')):
        px, py = x + dx, y + dy - rise
        if askew:
            px, py = _fwd(px, py, askew)
        X, Y = int(math.floor(px)), int(math.floor(py))
        if (X, Y) in r and r[(X, Y)][2] == 'scan':
            r.put(X, Y, ch, -0.9, 'scan')


def _crack_window(r, win, rise, askew):
    x0, x1 = win
    cx, cy = x0 + (x1 - x0) * 0.4, -35.6 - rise
    for dx, dy, ch in ((0, 0, '2'), (1, -1, '3'), (2, -1, '3'), (-1, 1, '3'), (1, 1, '3'), (-1, -1, '3'), (-2, 0, '4')):
        px, py = cx + dx, cy + dy
        if askew:
            px, py = _fwd(px, py, askew)
        X, Y = int(math.floor(px)), int(math.floor(py))
        if (X, Y) in r and r[(X, Y)][2] == 'scan':
            r.put(X, Y, ch, -0.9, 'scan')


def glow(mode, k, rise):
    """FX pixels over the finished frame: the lock glare, the printer's flash and puff (local px)."""
    out = {}
    fx_, fy_ = 7, -36 - (rise - 2)
    if mode == 'lock' and k == 1:
        for dx, dy, ch in ((0, 0, 'W'), (1, 0, 'F'), (2, 0, 'y'), (0, -1, 'F'), (0, 1, 'F'), (1, -1, 'y'), (1, 1, 'y')):
            out[(fx_ - 1 + dx, fy_ + dy)] = ch
    if mode == 'fire':
        for dx, dy, ch in ((0, 0, '1'), (1, 0, '1'), (2, 0, '2'), (1, 1, '3'), (2, 1, '3'),
                           (3, -1, 'F'), (3, 0, 'W'), (4, 0, 'F'), (3, 1, 'y'), (4, -1, 'y'), (5, 0, 'y'), (2, -1, 'F')):
            out[(fx_ + dx, fy_ + dy)] = ch
    if mode == 'recoil':
        for dx, dy, ch in ((1, -1, 'D'), (2, -1, 'D'), (1, 0, 'D'), (2, -2, 'd'), (3, -1, 'd')):
            out[(fx_ + dx, fy_ + dy)] = ch
    return out


def gone():
    """The scanner shot off: the bar bent down at the rear, sheared strut stubs, a cable dangling."""
    r = G.Raster()
    rack(r, 2, bent=True)
    for X, Y, ch in ((-14, -34, 's'), (-4, -34, 's'), (-4, -35, 'z'),
                     (-9, -34, 'r'), (-10, -33, 'r'), (-10, -32, 'Q'), (-11, -31, 'r'), (-11, -30, 'Q'),
                     (-8, -34, 'p'), (-7, -33, 'p')):
        r.put(X, Y, ch, -1.2, 'wire')
    return r
