# The small parts of the set: the shotgun pellet, the lobbed gold chain, the hood flames of the
# wreck, the gold glint (the pump tell, the headlight flash).
import math

import art40 as X

from .limo import R, finish, h


def pellet():
    """5 x 5 with the outline: a gold ball, a white-hot core (reads on the lit windows); centre anchor."""
    r = R()
    for x in range(-1, 2):
        for y in range(-1, 2):
            r.put(x, y, 'G', 0, 'p')
    r.put(0, 0, '1', 1, 'p')
    r.put(-1, -1, 'Y', 1, 'p')
    r.put(1, 1, 'g', 1, 'p')
    rows, root = finish(r, margin=1)
    return X.Frame(rows, root)


def chain():
    """The gold chain spinning in the air: a loop of lit links with its medallion, 4 turns."""
    out = []
    for k in range(4):
        th = math.radians(k * 45)
        r = R()
        n = 18
        for i in range(n):
            a = 2 * math.pi * i / n
            ex, ey = 4.6 * math.cos(a), 2.6 * math.sin(a)
            x = ex * math.cos(th) - ey * math.sin(th)
            y = ex * math.sin(th) + ey * math.cos(th)
            px, py = int(math.floor(x + 0.5)), int(math.floor(y + 0.5))
            ch = 'Y' if i % 3 == 0 else 'G' if i % 3 == 1 else 'g'
            if py > 1:
                ch = 'g' if ch != 'Y' else 'G'
            r.put(px, py, ch, 0, 'c')
            # the links are 2 px thick: a shaded inner pixel toward the loop's centre
            ix, iy = int(math.floor(x * 0.72 + 0.5)), int(math.floor(y * 0.72 + 0.5))
            if (ix, iy) != (px, py):
                r.put(ix, iy, 'q' if ch == 'g' else 'g', -0.5, 'c')
        # the medallion hangs at the loop's lowest point
        lx, ly = max(r, key=lambda p: (p[1], -abs(p[0])))
        for dx, dy, ch in ((0, 1, 'G'), (1, 1, 'Y'), (0, 2, 'g'), (1, 2, 'G')):
            r.put(lx + dx, ly + dy, ch, 1, 'm')
        rows, root = finish(r, margin=1)
        out.append(X.Frame(rows, root))
    return out


def flame():
    """3 steps of the hood fire, foot anchor (limo.ts draws two of them side by side)."""
    out = []
    for k in range(3):
        rows = [['.'] * 11 for _ in range(15)]
        for y in range(15):
            u = (14 - y) / 14.0                      # 0 at the foot, 1 at the top
            for x in range(11):
                c = x - 5 + 0.6 * math.sin(u * 5.0 + k * 2.1) * u * 2.2
                tongue = 1.0 + 0.55 * math.sin(c * 1.7 + k * 1.9 + u * 3)
                hw = 4.6 * (1 - u) ** 0.8 * (0.75 + 0.25 * tongue) + (0.8 if u < 0.15 else 0)
                if u > 0.55 and abs(c - (1.5 - k)) < 1.0 and u < 0.62 + 0.25 * h(k * 5 + 3):
                    hw = max(hw, 1.0)                # a loose tongue at the top
                if abs(c) > hw:
                    continue
                t = abs(c) / max(hw, 0.6)
                if u < 0.35 and t < 0.45:
                    ch = 'F'
                elif u < 0.55 and t < 0.6:
                    ch = 'y'
                elif t < 0.75 and u < 0.8:
                    ch = 'f'
                elif u < 0.9 and t < 0.95:
                    ch = 'c'
                else:
                    ch = 'e'
                rows[y][x] = ch
        out.append(X.Frame([''.join(r) for r in rows], (5, 15)))
    return out


def glint():
    """A four-point gold star: small, full, fading; centre anchor."""
    out = []
    for rad in (1, 3, 2):
        g = [['.'] * 9 for _ in range(9)]
        for i in range(-rad, rad + 1):
            g[4][4 + i] = 'y' if abs(i) < rad else 'f'
            g[4 + i][4] = 'y' if abs(i) < rad else 'f'
        if rad >= 2:
            for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                g[4 + dy][4 + dx] = 'f'
        g[4][4] = 'O'
        if rad == 3:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                g[4 + dy][4 + dx] = 'F'
        out.append(X.Frame([''.join(r) for r in g], (4, 4)))
    return out
