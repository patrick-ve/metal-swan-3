# THE CORK (enemy/cork/fly): the stag partiers' fizzy-wine cork in flight (a prop, 9 x 9, centre
# anchor). The beer bike's cannon fires the same cork (vehicle/beer-bike/cork: chars/beer-bike/ calls
# frames()). A mushroom cork with a brass cap and a steel wire cage, tumbling end over end: 8 steps
# of 45 degrees (the projectile plays them at 3 ticks a frame, partier.ts fireCork: a 24-tick turn).
# The light stays on the upper front while the cork turns (each pixel is shaded by its screen
# normal), so the tumble reads.
import math

import art40 as X

SET = X.Set(prefix='enemy/cork', budget=28, face=1, outline='K', hl='t')

PAL = {
    'K': '#140c0e',
    'C': '#f2d29a', 'c': '#d0a468', 'k': '#9c7044', '4': '#5b3828',     # cork (hi, base, shade, deep)
    'G': '#fff184', 'g': '#f6c537', 'n': '#c98c22',                     # the brass cap
    't': '#c9d0da', 'A': '#7a8090',                                     # the wire cage
}
STEPS = 8
TPF = 3


def _shape(u, v):
    """Local shape (u along the cork, the cap end at +u; v across). Returns the material or None."""
    if -3.4 <= u < 0.6 and abs(v) <= 1.55:            # the stem
        return 'stem'
    if 0.6 <= u <= 3.2:                               # the mushroom head, rounded at its top
        w = 2.35 if u < 2.4 else 2.35 * math.sqrt(max(0.0, 1 - ((u - 2.4) / 0.95) ** 2))
        if abs(v) <= w:
            return 'cap' if u >= 2.5 else 'head'
    return None


def frame_rows(i):
    """Step i: the cork turned i * 45 degrees clockwise (the cap starts pointing up-forward)."""
    a = math.radians(i * 45 - 60)
    ca, sa = math.cos(a), math.sin(a)
    n = 9
    rows = []
    for y in range(n):
        r = ''
        for x in range(n):
            dx, dy = x + 0.5 - 4.5, y + 0.5 - 4.5
            u = dx * ca + dy * sa
            v = -dx * sa + dy * ca
            m = _shape(u, v)
            if not m:
                r += '.'
                continue
            # screen-space light: the normal across the cork (v) or at the cap end (u)
            nx, ny = -sa * (1 if v > 0 else -1), ca * (1 if v > 0 else -1)
            if m == 'cap' and u > 2.9:
                nx, ny = ca, sa
            l = nx * 0.55 + ny * -0.83
            edge = abs(v) > (1.0 if m == 'stem' else 1.7)
            if m == 'cap':
                ch = 'G' if l > 0.4 else ('g' if l > -0.3 else 'n')
            else:
                k = (0 if l > 0.35 else 1) if not edge else (1 if l > 0.2 else 2 if l > -0.4 else 3)
                ch = ['C', 'c', 'k', '4'][k]
                if m == 'head' and abs(u - 1.5) < 0.5 and abs(v) < 2.0:
                    ch = 'A' if l > 0 else 'k'                     # the wire round the neck
                    if l > 0.5:
                        ch = 't'
            r += ch
        rows.append(r)
    return rows


def outlined(rows):
    """One K outline round the cork (4-neighbours)."""
    n = len(rows) + 2
    g = ['.' * n] + ['.' + r + '.' for r in rows] + ['.' * n]
    out = [list(r) for r in g]
    for y in range(n):
        for x in range(n):
            if g[y][x] == '.' and any(0 <= x + dx < n and 0 <= y + dy < n and g[y + dy][x + dx] != '.'
                                      for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    return [''.join(r) for r in out]


def frames():
    """The 8 tumble frames as X.Frame (centre anchor)."""
    out = []
    for i in range(STEPS):
        rows = outlined(frame_rows(i))
        out.append(X.Frame(rows, (5, 5)))
    return out


def build(s):
    s.colours = dict(PAL)
    s.strip('fly', frames(), TPF, cls='prop')
    s.event('CORK_STEPS', STEPS)
    s.event('CORK_TPF', TPF)
