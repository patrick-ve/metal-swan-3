# BOETE TICKET: the handhaver's thrown fine (enemy/boete-ticket/fly): a white paper slip with a red
# header and grey fine print that tumbles end over end as it flutters (it turns about its long
# axis: front, edge-on, the plain back, edge-on), a little tilt each half turn. Centre anchor (the
# projectile's position). Also the gloat's torn page (GloatPage, TICKET_FLAT on the ground) and the
# death confetti tumble. No letters: the ticket is drawn mirrored when it flies left.
import math

import art40 as X
import castkit as K
import rig

SET = X.Set(prefix='enemy/boete-ticket', budget=28, face=1, outline='K')

PAL = {
    'K': '#140c0e',                                   # the one warm near-black outline
    'T': '#fbfbf6', 't': '#c8ccd6', 'u': '#9aa0b4',   # paper: lit, shade, the back in shadow
    'E': '#d83a34', 'r': '#8e2228',                   # the red header, its shade
    'n': '#5c6276',                                   # fine print
}

W, H = 9, 6
FRONT = [
    'EEEEEEEEr',
    'TTTTTTTTt',
    'TnnnnnTTt',
    'TTTTTTrrt',
    'TnnnTTrrt',
    'tttttttuu',
]
BACK = [
    'TTTTTTTTt',
    'TTTTTTTTt',
    'TTTTTTTtt',
    'TTTTTTttt',
    'tTTTTtttu',
    'ttttttuuu',
]
N = 8
TILT = [6, 0, -6, 0, 6, 0, -6, 0]
TPF = 2
FLAT = 1          # the frame of the slip lying on the ground (GloatPage): front up, no tilt


def slip(k):
    a = 2 * math.pi * k / N
    c = math.cos(a)
    h = max(1, round(H * abs(c)))
    src = FRONT if c >= 0 else BACK
    if k % 4 == 2:                  # edge-on: one bright line with the shaded edge
        rows = ['tTTTTTTTt']
    else:
        rows = [src[min(H - 1, int((j + 0.5) * H / h))] for j in range(h)]
    pad = 6
    w = W + 2 * pad
    g = ['.' * w] * pad + ['.' * pad + r + '.' * pad for r in rows] + ['.' * w] * pad
    if TILT[k]:
        g = rig.rotsprite(g, ((w - 1) / 2, (len(g) - 1) / 2), TILT[k])
    out = [list(r) for r in g]
    for y in range(len(g)):
        for x in range(w):
            if g[y][x] == '.' and any(0 <= x + dx < w and 0 <= y + dy < len(g) and g[y + dy][x + dx] != '.'
                                      for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    rows = [''.join(r) for r in out]
    x0, y0, x1, y1 = K.bbox(rows)
    root = (x0 + (x1 - x0) // 2, y0 + (y1 - y0) // 2)
    # the joint track (smoothness gate): the slip's two ends and its middle
    return X.Frame(rows, root, joints={'end.l': (x0 + 1, root[1]), 'mid': root, 'end.r': (x1 - 2, root[1])})


def build(s):
    K.palette(PAL, dark={'T': 't', 't': 'u', 'u': 'n', 'E': 'r', 'r': 'r', 'n': 'n'}, letters='TtuErn')
    s.colours = dict(PAL)
    s.strip('fly', [slip(k) for k in range(N)], TPF, cls='prop')
    s.event('TICKET_FLAT', FLAT)
    s.event('TICKET_FRAMES', N)
    s.event('TICKET_TPF', TPF)
