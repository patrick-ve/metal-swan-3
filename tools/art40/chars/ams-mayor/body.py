# MECHA HASLEMA: the body piece (game id boss/ams-mayor/body-<stage>, 62 x 84 at the anchor (31, 119)
# today): the tailored cream boucle jacket with the shawl collar, the crimson blouse, the steel neck
# with its cables and its collar ring. The stamp arm's sleeve, the far arm, the chain and the
# medallion are their own pieces (the game draws them over the body).
import math

from .cv import Layer, polymask, ellmask, line, seam, rivet, pick, LX, LZ
from .pal import JACK, CRIM, STEEL, GOLD, step

# tailored: square shoulders, a nipped waist, a hem that flares and curves, a cutaway at the front
JACKET = [(-11, -108), (13, -108), (27, -101), (29, -93), (27, -83), (24, -72), (25, -63), (28, -55),
          (31, -49), (30, -46), (22, -44), (12, -44), (6, -46), (4, -50), (2, -50), (0, -46), (-6, -44),
          (-18, -44), (-28, -45), (-32, -48), (-29, -55), (-25, -63), (-24, -72), (-27, -82), (-30, -91),
          (-29, -100)]
LAPEL_N = [(-21, -109), (-8, -107), (-5, -96), (-2, -78), (0, -64), (-6, -66), (-14, -73), (-21, -85), (-24, -98)]
LAPEL_F = [(21, -109), (12, -107), (9, -96), (6, -78), (5, -64), (9, -67), (15, -75), (20, -87), (23, -99)]
BLOUSE = [(-9, -108), (12, -108), (8, -90), (3, -64), (-2, -80), (-6, -96)]
Z = 5.0


def boucle(x, y, k):
    """Sparse boucle knots: a 2 px tick one tone darker on the lit and the mid cloth."""
    if k <= 2 and y % 3 == 0 and (x + 3 * (y // 3)) % 7 in (0, 1) and ((x // 7) + (y // 3)) % 2 == 0:
        return k + 1
    return k


def jacket(L):
    m = polymask(JACKET)
    for (x, y) in sorted(m):
        nx = max(-1.0, min(1.0, (x + 0.5 - 1) / 31.0))
        uz = math.sqrt(max(0.0, 1 - nx * nx))
        l = nx * LX * 1.2 + uz * LZ - 0.004 * (y + 108)
        if -82 < y < -62 and x > 19:
            l -= 0.25                                   # the waist turns away under the chest
        if y < -100 and x > 10:
            l += 0.12                                   # the shoulder roll catches the light
        k = JACK.index(pick(l, (0.88, 0.66, 0.40, 0.12, -0.2), JACK))
        if (x, y + 2) not in m:
            k = min(5, k + 1)                           # the hem turns under
        if (x, y + 1) not in m:
            k = min(5, k + 1)
        L.put(x, y, JACK[boucle(x, y, k)], Z, 'jacket')
    # princess seams: they follow the waist in and flare out to the hem (a dark line, a lit lip)
    for y in range(-92, -47):
        t = (y + 92) / 44.0
        w = math.sin(min(1.0, t * 1.3) * math.pi) * 2.5
        for x, side in ((round(19 - w + max(0, t - 0.6) * 8), -1), (round(-17 + w - max(0, t - 0.6) * 8), 1)):
            if (x, y) in m and (x, y + 1) in m:
                L.over(x, y, step(L.get(x, y), 2))
                if (x + side, y) in m:
                    L.over(x + side, y, step(L.get(x + side, y), -1))
    # tension folds from the nipped waist up to the shoulders (a fold line with a lit crest above)
    for pts in ([(19, -70), (22, -79), (24, -88)], [(16, -68), (18, -76)], [(-20, -70), (-19, -79), (-21, -88)],
                [(-14, -67), (-15, -74)]):
        for (x, y) in line(Layer('t'), pts, 'x', 0, ''):
            if (x, y) in m:
                L.over(x, y, step(L.get(x, y), 2))
                if (x + 1, y) in m:
                    L.over(x + 1, y, step(L.get(x + 1, y), -1))
    # the front opening below the medallion, curving out to the cutaway
    for y in range(-64, -49):
        L.over(2, y, 'D')
        L.over(3, y, 'E')
        L.over(1, y, step(L.get(1, y), -1))
    # flap pockets: a seam, the lit flap, the shadow under its edge, a gold button
    for (x0, x1, y0, near) in ((-25, -12, -63, True), (10, 22, -64, False)):
        for x in range(x0, x1 + 1):
            if (x, y0) in m:
                L.over(x, y0, 'A' if near and x < x1 - 3 else 'C')
                L.over(x, y0 + 1, 'B' if near else 'C')
                L.over(x, y0 + 3, 'E' if near else 'F')
                L.over(x, y0 + 4, step(L.get(x, y0 + 4), 1))
        for y in (y0 + 1, y0 + 2):
            L.over(x0, y, 'D')
            L.over(x1, y, 'E' if near else 'F')
        button(L, (x0 + x1) // 2, y0 + 2)
    # front buttons on the overlapping panel
    for y in (-60, -53):
        button(L, -2, y)
    return m


def button(L, x, y):
    """A 3 x 3 gold button in relief: lit upper-left, its shade lower-right, a shadow under it."""
    for (dx, dy, ch) in ((0, 0, 'g'), (1, 0, 'h'), (2, 0, 'i'), (0, 1, 'h'), (1, 1, 'i'), (2, 1, 'j'),
                         (0, 2, 'i'), (1, 2, 'j'), (2, 2, 'k')):
        L.put(x + dx, y + dy, ch, Z + 0.2, 'button')
    for dx in (1, 2, 3):
        if L.get(x + dx, y + 3) in JACK:
            L.over(x + dx, y + 3, step(L.get(x + dx, y + 3), 2))


def blouse(L):
    bl = polymask(BLOUSE)
    for (x, y) in sorted(bl):
        l = 0.4 + 0.05 * x - 0.01 * (y + 108)
        ch = pick(l, (0.85, 0.45, 0.05, -0.4), CRIM)
        if y < -104:
            ch = 'V' if x < 4 else 'U'                  # the neckline in the shadow of the chin
        L.put(x, y, ch, Z + 0.5, 'blouse')
    # soft folds of the blouse (a dark fold, a lit crest)
    for pts in ([(1, -101), (3, -93), (4, -86)], [(6, -99), (7, -92)], [(-3, -98), (-1, -90)]):
        for (x, y) in line(Layer('t'), pts, 'x', 0, ''):
            if (x, y) in bl:
                L.over(x, y, step(L.get(x, y), 1))
                if (x + 1, y) in bl:
                    L.over(x + 1, y, step(L.get(x + 1, y), -1))


def lapels(L):
    """The rolled shawl collar: the roll's crest lit along the inner edge, the outer edge folds over the
    body (its shadow falls on the jacket), the far lapel a step darker."""
    for pts, near in ((LAPEL_N, True), (LAPEL_F, False)):
        lm = polymask(pts)
        for (x, y) in sorted(lm):
            e_in = next((i for i in range(4) if (x + (i + 1 if near else -i - 1), y) not in lm), 9)
            e_out = (x - 1, y) not in lm if near else (x + 1, y) not in lm
            if near:
                k = 0 if e_in <= 1 else 1 if e_in == 2 else 1 if y < -84 else 2
            else:
                k = 1 if e_in == 0 else 2 if e_in <= 2 else 3
            if e_out:
                k = 3 if near else 4
            L.put(x, y, JACK[k], Z + 1.0, 'lapel')
        # the shadow the roll casts on the jacket beside its outer edge
        for (x, y) in sorted(lm):
            q = (x - 1, y) if near else (x + 1, y)
            if q not in lm and L.sub(*q) == 'jacket':
                L.over(q[0], q[1], step(L.get(*q), 2))
        # the crest line of the roll (the stitched edge)
        if near:
            for y in range(-104, -70, 1):
                xs = [x for (x, yy) in lm if yy == y]
                if xs:
                    L.over(max(xs) - 2, y, 'B' if y % 4 else 'C')


def neck(L, stage=0):
    """A ribbed steel column with two cables and a riveted collar ring at its base."""
    for y in range(-115, -104):
        for x in range(-5, 10):
            nx = (x + 0.5 - 2.5) / 8.0
            l = nx * LX * 1.3 + math.sqrt(max(0.0, 1 - nx * nx)) * LZ
            ch = pick(l, (0.95, 0.80, 0.62, 0.40, 0.15), STEEL)
            if y % 3 == 0:
                ch = step(ch, 2)                          # the groove between two rings
            elif y % 3 == 1:
                ch = step(ch, -1)                         # the lit lip under the groove
            L.put(x, y, ch, Z - 0.5, 'neck')
    # the cables: a red one behind the jaw, a gold one at the front
    for pts, ramp in (([(-4, -116), (-6, -111), (-7, -105)], ('S', 'T', 'U')), ([(8, -116), (10, -111), (10, -105)], ('h', 'i', 'k'))):
        for (x, y) in line(Layer('t'), pts, 'x', 0, ''):
            L.put(x, y, ramp[0], Z - 0.3, 'cable')
            L.put(x + 1, y, ramp[1], Z - 0.3, 'cable')
            L.put(x - 1, y, ramp[2], Z - 0.3, 'cable')
    # the collar ring the neck sits in
    for y in (-106, -105, -104):
        for x in range(-9, 14):
            ch = '2' if y == -106 else '4' if y == -105 else '6'
            if x > 6 and y == -106:
                ch = '1'
            L.put(x, y, ch, Z - 0.2, 'collar')
    L.put(9, -106, '0', Z - 0.19, 'collar')
    for x in (-7, 0, 7):
        rivet(L, x, -105)


def damage(L, stage):
    """Soot and a torn seam (stage 1), more tears down to the steel ribs (stage 2)."""
    if stage <= 0:
        return
    # the tears open on the steel frame under the cloth: a dark gap with lit ribs, the frayed cloth
    # edge one tone down; stage 1 one long rip, stage 2 three (they read at real size)
    tears = [[(-25, -90), (-20, -84), (-23, -78), (-19, -72)]]
    if stage >= 2:
        tears += [[(19, -66), (24, -60), (21, -53), (24, -48)], [(-13, -58), (-8, -52), (-10, -46)]]
    for ti, pts in enumerate(tears):
        w = 1 if stage == 1 or ti > 0 else 2
        for (x, y) in line(Layer('t'), pts, 'x', 0, ''):
            for dx in range(-w, w + 1):
                if L.sub(x + dx, y) not in ('jacket', 'tear'):
                    continue
                if abs(dx) == w:
                    ch = L.get(x + dx, y)
                    if ch in JACK:
                        L.over(x + dx, y, JACK[min(len(JACK) - 1, JACK.index(ch) + 2)], 'tear')
                else:
                    L.over(x + dx, y, '4' if y % 3 == 0 and dx <= 0 else '6' if dx < 0 else '7', 'tear')
    soots = [(-18, -60, 5.5, 3.4), (15, -78, 4.0, 2.6)]
    if stage >= 2:
        soots += [(16, -96, 4.5, 3.0), (-6, -72, 4.0, 2.6), (-22, -100, 3.5, 2.4)]
    for (cx, cy, rx, ry) in soots:
        for (x, y) in sorted(ellmask(cx, cy, rx, ry)):
            ch = L.get(x, y)
            if ch in JACK:
                inner = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 0.4
                L.over(x, y, '9' if inner and stage >= 2 else '8' if inner or JACK.index(ch) < 3 else '9')


def body(stage=0):
    L = Layer('body')
    neck(L, stage)
    jacket(L)
    blouse(L)
    lapels(L)
    damage(L, stage)
    return L
