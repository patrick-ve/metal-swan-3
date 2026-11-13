# DE RATTENJONG's throws (fx/sewers-rattenjong): the bike (spinning in its high arc), its two
# bouncing parts, the shopping cart (rolling), the e-scooter (tumbling flat), the scrap bits. The
# slug rule would name this folder after the prefix (sewers-rattenjong), which is the king's set:
# this set shares the prefix name (SET.shares_prefix). Centre anchors (shots.ts draws them at the
# projectile's centre). Drawn facing right; shots.ts mirrors them by the flight direction.
import math

import art40 as X
import castkit as K
import rig

SET = X.Set(prefix='fx/sewers-rattenjong', budget=28, face=1, outline='K', hl='SY')
SET.shares_prefix = True

PAL = {
    'K': '#140c0e',
    'R': '#e8503c', 'r': '#a82a2c', 'Q': '#5e1620',               # the red bike frame, the cart's handle
    'S': '#eef1f4', 's': '#a6aeb8', 'z': '#646a78', 'Z': '#3c404c',  # steel
    'X': '#4a4652', 'x': '#26222a',                                # rubber
    'N': '#56c8bc', 'n': '#2a8a84', 'B': '#1a5450',                # the teal scooter deck
    'W': '#7a5440', 'w': '#4a3024',                                # the saddle
    'Y': '#ffa030',                                                # reflectors
}
DARK = {'R': 'r', 'r': 'Q', 'Q': 'Q', 'S': 'z', 's': 'z', 'z': 'Z', 'Z': 'Z', 'X': 'x', 'x': 'x',
        'N': 'n', 'n': 'B', 'B': 'B', 'W': 'w', 'w': 'w', 'Y': 'r'}

SZ = 48          # the work canvas (centre at SZ / 2)
C = SZ // 2


class Pic:
    def __init__(self):
        self.cv = K.Canvas(SZ, SZ)

    def px(self, x, y, ch, z=0, part='a'):
        self.cv.px(C + x, C + y, ch, z, part)

    def line(self, a, b, r, ramp, z=0, part='a'):
        self.cv.tube((C + a[0], C + a[1]), (C + b[0], C + b[1]), r, r, ramp, z, part)

    def wheel(self, cx, cy, rad, z=0, part='w', spin=0.0, bent=0.0):
        for y in range(int(cy - rad - 2), int(cy + rad + 3)):
            for x in range(int(cx - rad - 2), int(cx + rad + 3)):
                dx, dy = x + 0.5 - cx, (y + 0.5 - cy) * (1 + bent)
                d = math.hypot(dx, dy)
                if d <= rad:
                    if d > rad - 1.2:
                        ch = 'X' if dy < -dx * 0.3 else 'x'
                    elif d > rad - 2.0:
                        ch = 'S' if dy < 0 else 's'
                    else:
                        a = math.atan2(dy, dx) - spin
                        ch = 'z' if abs(math.sin(a * 2)) < 0.28 or d < 1.0 else None
                        if d < 1.0:
                            ch = 'S'
                    if ch:
                        self.px(x, y, ch, z, part)

    def rows(self, outline=True):
        return self.cv.finish(outline=outline)


def reoutline(rows):
    g = [list(r) for r in rows]
    h, w = len(g), len(g[0])
    at = lambda x, y: g[y][x] if 0 <= x < w and 0 <= y < h else '.'
    for _ in range(2):
        for y in range(h):
            for x in range(w):
                ch = g[y][x]
                if ch == '.':
                    continue
                nb = [at(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
                if ch in nb or ch in 'SY':
                    continue
                opaque = [q for q in nb if q != '.']
                g[y][x] = '.' if len(opaque) < 3 else max(sorted(set(opaque)), key=opaque.count)
    out = [r[:] for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] == '.' and any(at(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    return [''.join(r) for r in out]


def spun(pic, n, step):
    """n frames of the picture turned by step degrees each (clockwise), centre anchor."""
    bare = pic.rows(outline=False)
    out = []
    for k in range(n):
        r = bare if k == 0 else rig.rotsprite(bare, (C, C), -step * k)
        out.append(X.Frame(reoutline(r), (C, C)))
    return out


def bike():
    p = Pic()
    p.wheel(-7, 3, 5.5, 0, 'wb')
    p.wheel(8, 3, 5.5, 0, 'wf')
    red = ['R', 'R', 'r', 'r']
    hub_r, hub_f, bb, seat, head = (-7, 3), (8, 3), (0, 3), (-3, -4), (6, -4)
    p.line(hub_r, bb, 0.8, red, 2, 'f')
    p.line(hub_r, seat, 0.8, red, 2, 'f')
    p.line(seat, bb, 1.0, red, 2, 'f')
    p.line(seat, head, 1.0, red, 2, 'f')
    p.line(bb, head, 1.0, red, 2, 'f')
    p.line(head, hub_f, 0.8, ['s', 's', 'z', 'z'], 2.5, 'fork')
    p.line((6, -4), (5, -7), 0.7, ['s', 's', 'z', 'z'], 2, 'stem')
    for x, ch in ((4, 'x'), (5, 'X'), (6, 'X'), (7, 'x'), (8, 'x')):
        p.px(x, -8, ch, 3, 'bar')
    for x, ch in ((-6, 'w'), (-5, 'W'), (-4, 'W'), (-3, 'W'), (-2, 'w')):
        p.px(x, -6, ch, 3, 'saddle')
    p.px(-4, -5, 'z', 3, 'saddle')
    p.px(0, 4, 'z', 3, 'crank')
    p.px(1, 5, 'Z', 3, 'crank')
    p.px(-12, 0, 'Y', 3, 'refl')
    return p


def bike_part():
    p = Pic()
    p.wheel(0, 0, 5.0, 0, 'w', bent=0.35)
    p.line((0, 0), (5, -6), 0.8, ['s', 's', 'z', 'z'], 2, 'fork')
    p.line((5, -6), (7, -7), 0.8, ['R', 'R', 'r', 'r'], 2, 'tube')
    return p


def cart(k):
    p = Pic()
    steel = ['s', 's', 'z', 'z']
    top, bot = -6, 2
    for x in range(-9, 11):
        p.px(x, top, 'S' if x % 3 else 's', 1, 'rail')
    for x in range(-7, 10):
        p.px(x, bot, 'z', 1, 'rail')
    for i, x in enumerate(range(-9, 11, 3)):
        x1 = x + (2 if x < 0 else 1)
        for y in range(top + 1, bot):
            t = (y - top) / (bot - top)
            p.px(int(round(x + (x1 - x) * t)), y, 's' if i % 2 else 'z', 0.5, 'wire')
    for x in range(-8, 10):
        p.px(x, -2, 'z', 0.4, 'wire')
    p.line((-10, -6), (-13, -9), 0.7, steel, 1, 'h')
    for x, y, ch in ((-15, -10, 'R'), (-14, -10, 'R'), (-13, -10, 'r'), (-15, -9, 'r'), (-14, -9, 'r')):
        p.px(x, y, ch, 2, 'grip')
    p.line((-7, 2), (-7, 5), 0.6, steel, 1, 'leg')
    p.line((8, 2), (8, 5), 0.6, steel, 1, 'leg')
    p.line((-8, 5), (9, 5), 0.6, steel, 1, 'base')
    for wx in (-7, 8):
        for dx in (-1, 0, 1):
            for dy in (0, 1, 2):
                if abs(dx) + abs(dy - 1) <= 1 or (dx, dy) == (0, 1):
                    p.px(wx + dx, 6 + dy, 'x', 2, 'wheel')
        p.px(wx + (1 if k else -1), 6, 'X', 2.5, 'wheel')
        p.px(wx, 7, 's', 2.5, 'wheel')
    p.px(9, -6, 'Y', 2, 'tag')
    return p


def scooter():
    p = Pic()
    for x in range(-8, 8):
        p.px(x, 2, 'N' if x < 6 else 'n', 1, 'deck')
        p.px(x, 3, 'n', 1, 'deck')
    for x in range(-6, 6, 4):
        p.px(x, 2, 'B', 1.1, 'deck')
    p.line((7, 2), (4, -8), 0.8, ['s', 's', 'z', 'z'], 1.5, 'stem')
    for x, ch in ((1, 'x'), (2, 'X'), (3, 'z'), (4, 'z'), (5, 'X'), (6, 'x')):
        p.px(x, -9, ch, 2, 'bar')
    p.px(5, -6, 'Y', 2, 'lamp')
    p.wheel(-8, 5, 2.4, 2, 'wr')
    p.wheel(8, 5, 2.4, 2, 'wf')
    p.line((-10, 3), (-7, 2), 0.6, ['n', 'n', 'B', 'B'], 1.5, 'fender')
    return p


def scrap(k):
    p = Pic()
    if k == 0:
        p.line((-3, 2), (0, -1), 0.8, ['R', 'R', 'r', 'r'], 1, 'tube')
        p.line((0, -1), (3, -1), 0.8, ['R', 'R', 'r', 'r'], 1, 'tube')
    else:
        p.wheel(0, 0, 2.6, 1, 'gear')
        p.line((1, 1), (3, 3), 0.6, ['s', 's', 'z', 'z'], 1.2, 'arm')
    return p


def build(s):
    K.palette(PAL, dark=DARK, letters=''.join(k for k in PAL if k != 'K'))
    s.colours = dict(PAL)
    s.strip('bike', spun(bike(), 8, 45), 5, cls='piece', why='a spinning throw (look anim, 5 ticks a frame)')
    s.strip('bike-part', spun(bike_part(), 3, 120), 4, cls='piece',
            why='3 turns of a bent wheel: shots.ts cycles (look2 + t / 6) % 3')
    s.strip('cart', [X.Frame(cart(k).rows(), (C, C)) for k in (0, 1)], 4, cls='mechanical',
            why='the rolling cart: 2 wheel steps (look anim, 4 ticks a frame)')
    s.strip('scooter', spun(scooter(), 8, 45), 4, cls='piece', why='the tumbling scooter (look anim, 4 ticks a frame)')
    s.strip('scrap', [X.Frame(scrap(k).rows(), (C, C)) for k in (0, 1)], 6, cls='piece',
            why='two different bits: shots.ts picks one per scrap (look2)')
