# SCANAUTO: the small strips - the print marks (text), the lamp glows (blink), the SCAN LOCK reticle
# and the printed fine strip (ticket).
import math

import art40 as X
import castkit as K

from . import geo as G

# ------------------------------------------------------------------------------------- text
# Letter-like marks, never readable (the approved look): the game draws them unmirrored at the
# lettering spots (geometry.ts SCAN.text, textFlip). Centre anchor = the block's centre px.
# 0: the long print over the front door's bars (two rows of glyph strokes: caps and stems);
# 1: two short red lines on the rear door, set against the crosses on their right (car facing
# right); 3: the same set against the crosses on their left (car facing left); 2: the box number.
PRINT = ['pp.p.pp.pp..pp.p.pp.p.pp.p',
         'p.pp.p.pp.p.p.pp.p.pp.p.pp']
CITY = ['rr.rrr.rr.rr',
        '............',
        'rr.rr.rr.rrr.rr']
NUMBER = ['4.44', '4.44']


def _mk(rows, align='c'):
    w = max(len(r) for r in rows)
    if align == 'r':
        rows = [r.rjust(w, '.') for r in rows]
    else:
        rows = [r.ljust(w, '.') for r in rows]
    return rows


def text_frames():
    out = []
    for rows in (_mk(PRINT), _mk(CITY, 'r'), _mk(NUMBER), _mk([r[::-1] for r in CITY], 'l')):
        w, h = len(rows[0]), len(rows)
        out.append(X.Frame(rows, (w // 2, h // 2)))
    return out


# ------------------------------------------------------------------------------------- blink
def blink_frames():
    """0 the amber hazard glow, 1 the white reversing lamp, 2 the red brake glow (centre anchor)."""
    shapes = []
    for core, mid, rim in (('W', 'y', 'A'), ('W', 'F', 'i'), ('w', 'O', 'r')):
        rows = ['.' + rim + mid + rim + '.',
                rim + mid + mid + mid + rim,
                mid + mid + core + mid + mid,
                rim + mid + mid + mid + rim,
                '.' + rim + mid + rim + '.']
        shapes.append(X.Frame(rows, (2, 2)))
    return shapes


# ------------------------------------------------------------------------------------- reticle
def _reticle(r_br, cross=False, ring=0.0, dot=True, smear=False):
    n = 19
    c = 9
    g = [['.'] * n for _ in range(n)]

    def put(x, y, ch):
        if 0 <= x < n and 0 <= y < n:
            g[y][x] = ch
    # four corner brackets at radius r_br (3 px arms)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x0, y0 = c + sx * r_br, c + sy * r_br
            for k in range(3):
                put(x0 - sx * k, y0, 'O' if k else 'w')
                put(x0, y0 - sy * k, 'O')
            if smear:                                    # the snap: a trail behind each bracket
                for k in range(1, 3):
                    put(x0 + sx * k, y0 + sy * k, 'E')
    if cross:
        for k in range(2, 4):
            for ch_, (x, y) in (('O', (c + k, c)), ('O', (c - k, c)), ('O', (c, c + k)), ('O', (c, c - k))):
                put(x, y, ch_)
    if ring:
        for a in range(0, 360, 6):
            x = c + int(round(ring * math.cos(math.radians(a))))
            y = c + int(round(ring * math.sin(math.radians(a))))
            if g[y][x] == '.':
                put(x, y, 'E' if ring > 7 else 'O')
    if dot:
        put(c, c, 'w')
    rows = [''.join(r) for r in g]
    # the one outline round every mark (it reads on the white car and the sky)
    out = [list(r) for r in rows]
    for y in range(n):
        for x in range(n):
            if rows[y][x] == '.' and any(0 <= x + dx < n and 0 <= y + dy < n and rows[y + dy][x + dx] != '.'
                                         for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    return X.Frame([''.join(r) for r in out], (c, c), smear=smear)


def reticle_frames():
    """0..3 tracking (the brackets breathe in and out, the centre dot blinks), 4 the snap (the
    brackets slam in, a trail), 5 locked (the crosshair in a ring), 6 locked with the ring pulsed."""
    return [_reticle(8), _reticle(7, dot=False), _reticle(6), _reticle(7, dot=False),
            _reticle(4, smear=True, dot=False),
            _reticle(5, cross=True),
            _reticle(5, cross=True, ring=8.0)]


RETICLE = dict(RETICLE_TRACK=0, RETICLE_TRACK_N=4, RETICLE_SNAP=4, RETICLE_LOCK=5, RETICLE_PULSE=6)


# ------------------------------------------------------------------------------------- ticket
def ticket_frames():
    """The printed fine strip flying LEFT (the game flips it when it flies right): a long thin
    receipt with a red header and print rows that flutters - its tail waves up, flat, down."""
    out = []
    L = 13
    for k in range(3):
        amp = (1, 0, -1)[k]
        pix = {}
        for i in range(L):
            # the head (left, the leading end) stays level, the tail waves
            t = i / (L - 1)
            dy = int(round(amp * math.sin(t * math.pi) * 1.4 + amp * t * 0.8))
            for j, ch in enumerate(('1', '2')):
                if i < 2:
                    ch = 'R' if j == 0 else 'r'
                elif j == 1 and i % 3 == 0:
                    ch = 'p'
                elif j == 0 and i > 2 and i % 4 == 1:
                    ch = '3'
                pix[(i, 3 + dy + j)] = ch
        w, h = L + 2, 9
        g = [['.'] * w for _ in range(h)]
        for (x, y), ch in pix.items():
            if 0 <= y < h:
                g[y][x + 1] = ch
        rows = [''.join(r) for r in g]
        out_rows = [list(r) for r in rows]
        for y in range(h):
            for x in range(w):
                if rows[y][x] == '.' and any(0 <= x + dx < w and 0 <= y + dy < h and rows[y + dy][x + dx] != '.'
                                             for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out_rows[y][x] = 'K'
        out.append(X.Frame([''.join(r) for r in out_rows], (7, 4)))
    return out
