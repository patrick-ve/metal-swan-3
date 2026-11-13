# The white stretch limo (boss/sewers-gerrit/limo, door, door-bit): the stand-in's numbers kept
# (art.ts P1b, limo.ts, numbers.ts GERRIT.limo): 120 px solid, roof at y -28 over the floor (the
# platform), the anchor the floor point under the middle, nose at +x. Light from the upper front:
# the roof, the hood and the belt crease lit, the skirts in shade; tinted glass with glints; the
# gold trim line, gold rims, gold bumpers and grille, red tail lights. Stages: 0 clean, 1 dented,
# 2 battered, 3 the wreck (sags 2 px, the hood bent up, the doors gone, flat tyres, soot).
import math

import castkit as K

WHEELS = (-43, 41)
WY = -7.5             # wheel centre (the tyre's lowest row is y -2, its outline y -1)
TYRE, RIM, ARCH = 5.6, 3.3, 7.6


class R(dict):
    """{(x, y): (letter, z, part)} in local pixels."""

    def put(self, x, y, ch, z=0.0, part='body'):
        old = self.get((x, y))
        if old is None or z >= old[1]:
            self[(x, y)] = (ch, z, part)

    def recolour(self, x, y, ch):
        v = self.get((x, y))
        if v:
            self[(x, y)] = (ch, v[1], v[2])


def inpoly(x, y, poly):
    c = False
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def h(n):
    """A small deterministic hash 0..1 (no random in a set)."""
    v = (n * 374761393 + 668265263) & 0xffffffff
    v = ((v ^ (v >> 13)) * 1274126177) & 0xffffffff
    return ((v ^ (v >> 16)) & 0xffffffff) / 4294967296.0


def profile(sag, wreck):
    s = sag
    hood_up = wreck
    pts = [(-61, -4.5), (-61.5, -17 + s), (-60, -19.5 + s), (-57, -21 + s), (-50, -21.5 + s), (-47.5, -26 + s),
           (-45.5, -28 + s), (33.5, -28 + s), (35.5, -27 + s), (43.5, -21.5 + s)]
    if hood_up:
        pts += [(47, -23), (53, -26.5), (58.5, -28.5), (60.5, -26), (59, -21), (61.5, -16.5)]
    else:
        pts += [(56, -20.5 + s), (59.5, -19.5 + s), (61.5, -17 + s)]
    pts += [(62, -5), (60.5, -3), (-59.5, -3)]
    return pts


def paint_body(r, st):
    wreck = st == 3
    sag = 2 if wreck else 0
    poly = profile(sag, wreck)
    for y in range(-31, 0):
        for x in range(-63, 64):
            cx, cy = x + 0.5, y + 0.5
            if not inpoly(cx, cy, poly):
                continue
            # wheel arches are cut out of the body
            if any(math.hypot(cx - wx, cy - WY) < ARCH and cy > WY - ARCH for wx in WHEELS):
                continue
            yy = y - sag
            if yy <= -27:
                ch = '1' if yy == -28 else '2'
            elif yy <= -22:
                ch = 'glass'
            elif yy == -21:
                ch = '3'
            elif yy == -20:
                ch = '1'
            elif yy <= -16:
                ch = '2'
            elif yy <= -14:
                ch = '2'
            elif yy == -13:
                ch = 'trim'
            elif yy <= -10:
                ch = '2'
            elif yy <= -6:
                ch = '3'
            elif yy <= -4:
                ch = '4'
            else:
                ch = '5'
            if x >= 44 and yy >= -22 and yy <= -19:
                ch = '1'                                    # the hood top
            if x <= -50 and yy >= -22 and yy <= -20:
                ch = '2'                                    # the boot lid
            if x >= 60 and -16 <= yy <= -6:
                ch = '1' if yy < -12 else '2'               # the lit nose face
            if x <= -60 and ch in '12':
                ch = '3'                                    # the tail in shade
            r.put(x, y, ch, 0, 'body')
    # windows, pillars, the rear window slope (paint) and the windscreen (glass)
    for (x, y), (ch, z, part) in list(r.items()):
        yy = y - sag
        if ch != 'glass':
            continue
        g = 'N'
        if yy == -26:
            g = 'n'
        if x <= -46 or x in (-31, -30, -15, 0, 1, 21, 22) or (x >= 34 and not inpoly(x + 0.5, y + 0.5, [(33.5, -27 + sag), (35.6, -27 + sag), (42.5, -21.5 + sag), (40, -21.5 + sag)])):
            g = '2' if x not in (-31, -15, 1, 22) else '3'
            if x <= -46:
                g = '2' if yy > -27 else '1'
        r[(x, y)] = (g, 0, 'body')
    # glints on the glass: short slanted streaks
    if not wreck:
        for gx in (-40, -24, -8, 8, 27, 38):
            for k in range(4):
                x, y = gx + k, -23 - k + sag
                v = r.get((x, y))
                if v and v[0] in 'Nn':
                    r.recolour(x, y, 'm')
            v = r.get((gx + 1, -23 + sag))
    # the sunroof: the opening's dark lip on the roof
    for x in range(-17, 1):
        r.recolour(x, -28 + sag, '4' if x in (-17, 0) else '3')
    # the gold trim line, its sparkle
    for (x, y), (ch, z, part) in list(r.items()):
        if ch == 'trim':
            r[(x, y)] = ('Y' if (x % 14 == 3 and not wreck) else 'G', 1, 'trim')
    # door seams and handles, the mirror
    if not wreck:
        for dx in (0, 21, 36):
            for y in range(-20, -4):
                if (dx, y) in r and r[(dx, y)][0] in '1234':
                    r.recolour(dx, y, '4' if r[(dx, y)][0] in '34' else '3')
        for hx in (15, 31):
            r.put(hx, -17, 'G', 2, 'trim')
            r.put(hx + 1, -17, 'Y', 2, 'trim')
            r.put(hx + 2, -17, 'q', 2, 'trim')
        r.put(37, -22, '2', 2, 'mirror')
        r.put(38, -22, '1', 2, 'mirror')
        r.put(37, -21, 'g', 2, 'mirror')
    # bumpers, the grille, lights, the hood ornament
    rear = [(x, y) for x in (-62, -61) for y in range(-9, -5)]
    for x, y in rear:
        r.put(x, y, 'g' if y > -8 else 'G', 3, 'bumper')
    if st < 2:
        for x in (61, 62):
            for y in range(-10, -5):
                r.put(x, y, 'Y' if y == -10 else 'G' if y < -7 else 'g', 3, 'bumper')
        for y in range(-15, -11):
            r.put(61, y, 'q' if y % 2 else 'G', 2, 'grille')
        r.put(61, -18 + sag, '1', 2, 'lamp')
        r.put(61, -17 + sag, 'Y', 2, 'lamp')
        r.put(60, -17 + sag, '1', 2, 'lamp')
        r.put(55, -22, 'G', 2, 'orn')
        r.put(55, -23, 'Y', 2, 'orn')
    else:
        # the bumper hangs, the lamp is out
        for i, x in enumerate((60, 61, 62)):
            for y in range(-8 + i, -5 + i):
                if y < 0:
                    r.put(x, y, 'g' if y > -7 + i else 'G', 3, 'bumper')
        r.put(61, -17 + sag, 'x', 2, 'lamp')
        r.put(60, -17 + sag, 'm', 2, 'lamp')
    for y in range(-18, -14):
        r.put(-61, y + sag, 'R' if y < -16 else 'r', 3, 'lamp')
    r.put(-62, -17 + sag, 'R', 3, 'lamp')


def paint_wheels(r, st):
    wreck = st == 3
    for i, wx in enumerate(WHEELS):
        for y in range(-16, 0):
            for x in range(wx - 10, wx + 11):
                cx, cy = x + 0.5, y + 0.5
                d = math.hypot(cx - wx, cy - WY)
                if wreck:
                    # flat: a squashed tyre on the floor
                    e = math.hypot((cx - wx) / 6.6, (cy - (WY + 2.2)) / 3.8)
                    if e <= 1.0:
                        ch = 'x' if cy > WY + 1.2 or cx < wx - 2 else 'X'
                        if abs(cx - wx) < 2.2 and abs(cy - (WY + 1.8)) < 1.4:
                            ch = 'q'
                        r.put(x, y, ch, 1, 'wheel')
                    elif d < ARCH and cy < WY + 1 and (x, y) not in r:
                        r.put(x, y, 'v', -1, 'arch')
                    continue
                if d <= TYRE:
                    ang = math.atan2(cy - WY, cx - wx)
                    lit = d > TYRE - 1.3 and -2.6 < ang < -0.5
                    ch = 'X' if lit else 'x'
                    if d <= RIM:
                        gone = st >= 2 and i == 1
                        if gone:
                            ch = 'X' if d > 1.5 else 'v'
                        else:
                            ch = 'G'
                            if d > RIM - 0.9:
                                ch = 'g' if ang > 0.3 or ang < -2.8 else 'Y' if -2.4 < ang < -0.6 else 'G'
                            if abs(cx - wx) < 0.6 or abs(cy - WY) < 0.6:
                                ch = 'q' if d > 1.0 else 'Y'
                    r.put(x, y, ch, 1, 'wheel')
                elif d < ARCH and cy < WY + 1.5 and (x, y) not in r:
                    r.put(x, y, 'v', -1, 'arch')
        # the arch lip: one shaded row round the cut
        for a in range(181):
            t = math.radians(180 + a)
            x, y = int(math.floor(wx + (ARCH + 0.4) * math.cos(t))), int(math.floor(WY + (ARCH + 0.4) * math.sin(t)))
            v = r.get((x, y))
            if v and v[2] == 'body' and v[0] in '12345':
                r.recolour(x, y, '4' if v[0] in '345' else '3')


DENTS1 = [(-34, -17), (10, -11), (46, -17)]
DENTS2 = [(-52, -10), (-8, -16), (28, -9), (54, -12), (-24, -10)]


def dent(r, x, y, big=False):
    w, hh = (4, 3) if big else (3, 2)
    for dx in range(w):
        for dy in range(hh):
            v = r.get((x + dx, y + dy))
            if v and v[2] == 'body':
                edge = dy == 0 or dx == 0
                r.recolour(x + dx, y + dy, '4' if (big and not edge) else '3')
    for dx in range(1, w + 1):
        v = r.get((x + dx, y + hh))
        if v and v[2] == 'body':
            r.recolour(x + dx, y + hh, '1')


def crack(r, x0, y0, n, seed):
    x, y = x0, y0
    for k in range(n):
        v = r.get((x, y))
        if v and v[0] in 'Nn':
            r.recolour(x, y, 'm')
        x += 1 if h(seed + k) > 0.35 else 0
        y += 1 if h(seed * 3 + k) > 0.45 else -1 if h(seed * 7 + k) > 0.8 else 0


def vnoise(x, y, seed, cell=3.0):
    """Smooth value noise 0..1 (bilinear over a hashed grid): blotches, never a dither."""
    gx, gy = x / cell, y / cell
    x0, y0 = math.floor(gx), math.floor(gy)
    fx, fy = gx - x0, gy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    v = lambda i, j: h(seed + (x0 + i) * 7919 + (y0 + j) * 104729)
    return (v(0, 0) * (1 - fx) + v(1, 0) * fx) * (1 - fy) + (v(0, 1) * (1 - fx) + v(1, 1) * fx) * fy


def soot(r, x0, x1, y0, y1, p, seed, tones='45'):
    """Soot blotches: where the noise is under p; the blotch core one tone darker."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            v = r.get((x, y))
            if not v or v[2] not in ('body', 'trim'):
                continue
            n = vnoise(x, y, seed)
            if n < p:
                r.recolour(x, y, tones[-1] if (n < p * 0.45 and len(tones) > 1) else tones[0])


def damage(r, st):
    if st >= 1:
        for x, y in DENTS1:
            dent(r, x, y)
        crack(r, -20, -26, 7, 11)
        for x in (-44, -43, 25):
            v = r.get((x, -13))
            if v and v[2] == 'trim':
                r.recolour(x, -13, 'q')
    if st >= 2:
        for x, y in DENTS2:
            dent(r, x, y, big=True)
        crack(r, 4, -26, 6, 23)
        crack(r, 36, -26, 5, 31)
        crack(r, -40, -26, 6, 41)
        soot(r, 40, 63, -22, -9, 0.38, 5)
        for x in (-10, -9, 8, 9, 10, 47):
            v = r.get((x, -13))
            if v and v[2] == 'trim':
                r.recolour(x, -13, 'q' if x % 2 else '4')


def wreck(r):
    sag = 2
    # the doors fell off: dark holes into the cabin, a seat inside
    for x in range(1, 36):
        if x == 21:
            continue
        for y in range(-19 + sag, -4):
            v = r.get((x, y))
            if v:
                seat = (x in range(4, 14) or x in range(24, 32)) and -12 < y < -6
                r[(x, y)] = ('X' if seat and y == -11 else 'x' if seat else 'v', 0.5, 'hole')
    # smashed windows: dark glass, shards at the frame
    for (x, y), (ch, z, part) in list(r.items()):
        if ch in 'Nnm':
            top = (x, y - 1) not in r or r[(x, y - 1)][0] not in 'Nnm'
            r.recolour(x, y, 'm' if (top and vnoise(x, y, 5, 2.0) > 0.55) else 'v')
    # the trim broken in pieces, soot everywhere, the bent hood darkened
    for (x, y), (ch, z, part) in list(r.items()):
        if part == 'trim' and (h(x * 13) < 0.35 or 1 <= x <= 35):
            r[(x, y)] = ('4' if part == 'trim' and not (1 <= x <= 35) else 'v', z, 'body' if not (1 <= x <= 35) else 'hole')
    soot(r, -62, 63, -32, 0, 0.22, 77)
    soot(r, 38, 63, -32, -8, 0.6, 91, '45')
    for x, y in DENTS1 + DENTS2:
        dent(r, x, y + 2, big=True)


def finish(r, margin=2):
    xs = [p[0] for p in r]
    ys = [p[1] for p in r]
    x0, y0 = min(xs) - margin, min(ys) - margin
    w, hh = max(xs) - x0 + 1 + margin, max(ys) - y0 + 1 + margin
    cv = K.Canvas(w, hh)
    for (x, y), (ch, z, part) in sorted(r.items()):
        cv.px(x - x0, y - y0, ch, z, part)
    rows, _ = K.finish(cv, (0, 0))
    return rows, (-x0, -y0)


def limo(st):
    r = R()
    paint_body(r, st)
    paint_wheels(r, st)
    if st == 3:
        wreck(r)
    else:
        damage(r, st)
    return finish(r)


def limo_frames():
    import art40 as X
    return [X.Frame(*limo(st)) for st in range(4)]


def door_frame():
    """The back door swung open toward the camera (hinged at its front edge x 20), the dark opening
    behind it with the seat."""
    import art40 as X
    r = R()
    for x in range(1, 21):
        for y in range(-20, -4):
            seat = 4 <= x <= 15 and -12 <= y <= -7
            ch = 'v'
            if seat:
                ch = 'X' if y == -12 else 'x'
            if y == -20 or x == 1:
                ch = '4'
            r.put(x, y, ch, 0, 'hole')
    # the door: a foreshortened panel x 21..29, its window, the gold handle, the inner trim
    for x in range(21, 30):
        t = (x - 21) / 8.0
        top = int(round(-21 - 3 * t))
        bot = int(round(-5 + 1.5 * t))
        for y in range(top, bot):
            if y < top + 6:
                ch = 'n' if y > top else '2'
                if x in (21, 29):
                    ch = '2'
                if y == top + 1 and x in (24, 25):
                    ch = 'm'
            elif y == top + 6:
                ch = '1'
            else:
                ch = '2' if x < 27 else '1'
                if y >= bot - 3:
                    ch = '3'
            r.put(x, y, ch, 2, 'door')
    for x in (26, 27):
        r.put(x, -14, 'G' if x == 26 else 'Y', 3, 'door')
    r.put(22, -10, 'g', 3, 'door')
    r.put(22, -9, 'g', 3, 'door')
    return X.Frame(*finish(r))


def door_bit():
    """The door that flies off (tumble turns it): a white panel with its window and gold handle;
    the anchor is its centre."""
    import art40 as X
    r = R()
    for x in range(-8, 9):
        for y in range(-6, 6):
            if y < -1:
                ch = 'N' if -7 < x < 7 and y > -6 else '2'
                if ch == 'N' and x == y + 1:
                    ch = 'm'
            elif y == -1:
                ch = '1'
            elif y >= 4:
                ch = '3'
            else:
                ch = '2'
            r.put(x, y, ch, 0, 'door')
    for x in (3, 4, 5):
        r.put(x, 1, 'G' if x < 5 else 'q', 1, 'trim')
    r.recolour(4, 1, 'Y')
    rows, root = finish(r)
    return X.Frame(rows, root)
