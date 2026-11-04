# MECHA HASLEMA: the projectiles of the fight (shots.ts; centre anchors, drawn moving LEFT: the
# code flips them when they fly right). They share the set's palette (no colour of their own).
#   noise-letter (4): 0 the envelope bursting open while it rises, 1-3 the tumble while it flutters
#                     (shots.ts: 1 + floor(t / 6) % 3: a loop face -> turning -> back)
#   shield-shot (4):  a small enamel shield spinning about its long axis (face, three-quarter, edge,
#                     the steel back), 4 ticks a frame
#   stamp-wave (4):   a curl of red stamp ink rolling along the floor, the crest lifts, curls over
#                     and throws drops, dust behind it; 3 ticks a frame
import math

from .cv import Layer, polymask, ellmask, line


def _rot(p, c, a):
    x, y = p[0] - c[0], p[1] - c[1]
    ca, sa = math.cos(a), math.sin(a)
    return (c[0] + x * ca - y * sa, c[1] + x * sa + y * ca)


# ----------------------------------------------------------------------------------- noise letter
def noise_letter(k):
    """Frame k of the complaint letter. (0, 0) = the centre (anchor (8, 7) of the old 16 x 14 box)."""
    L = Layer('letter')
    c = (0.0, 0.0)
    if k == 0:
        # bursting open: the flap thrown up and back, the letter half out with its red mark
        flap = polymask([(-6, -1), (0, -6.5), (6, -1)])
        for (x, y) in sorted(flap):
            L.put(x, y, 'D' if (x, y + 1) in flap else 'E', 1.0, 'flap')
        paper = polymask([(-4, -5), (4, -6), (5, 2), (-3, 3)])
        for (x, y) in sorted(paper):
            ch = 'A' if (x, y - 1) not in paper or (x - 1, y) not in paper else 'B'
            L.put(x, y, ch, 2.0, 'paper')
        for (x, y) in line(Layer('t'), [(-2, -3), (2, -4)], 'x', 0, '') + line(Layer('t'), [(-2, -1), (3, -2)], 'x', 0, ''):
            if L.sub(x, y) == 'paper':
                L.over(x, y, 'D')                                   # the written lines
        body = polymask([(-7, 0), (7, 0), (7, 6), (-7, 6)])
        for (x, y) in sorted(body):
            ch = 'B' if y < 2 else 'C'
            if (x, y + 1) not in body:
                ch = 'D'
            L.put(x, y, ch, 3.0, 'env')
        for (x, y) in line(Layer('t'), [(-7, 0), (0, 4), (7, 0)], 'x', 0, ''):
            if L.sub(x, y) == 'env':
                L.over(x, y, 'E')                                   # the folds of the pocket
        L.put(2, 2, 'S', 3.1, 'seal')
        L.put(3, 2, 'T', 3.1, 'seal')
        L.put(2, 3, 'T', 3.1, 'seal')
        return L
    # the tumble: 1 face-on tilted back, 2 turning (foreshortened, the flap side), 3 the back tilted on
    tilt = {1: -0.32, 2: 0.0, 3: 0.32}[k]
    hgt = {1: 4.0, 2: 2.0, 3: 3.4}[k]
    pts = [(-7, -hgt), (7, -hgt), (7, hgt), (-7, hgt)]
    pts = [_rot(p, c, tilt) for p in pts]
    env = polymask(pts)
    for (x, y) in sorted(env):
        top = (x, y - 1) not in env
        bot = (x, y + 1) not in env
        if k == 1:
            ch = 'A' if top else 'D' if bot else 'B'
        elif k == 2:
            ch = 'B' if top else 'E' if bot else 'C'
        else:
            ch = 'B' if top else 'E' if bot else 'C'
        L.put(x, y, ch, 1.0, 'env')
    if k == 1:
        # the face: the address lines and the red NOISE stamp (a crossed-out speaker)
        for (a, b) in (((-5, -1), (0, -1)), ((-5, 1), (-1, 1))):
            for (x, y) in line(Layer('t'), [_r(a, tilt), _r(b, tilt)], 'x', 0, ''):
                if L.sub(x, y) == 'env':
                    L.over(x, y, 'D')
        sx, sy = _r((3.5, -0.5), tilt)
        for (dx, dy, ch) in ((0, 0, 'S'), (1, 0, 'S'), (0, 1, 'T'), (1, 1, 'S'), (2, 1, 'T'), (-1, 1, 'T'), (1, 2, 'U'),
                             (0, 2, 'T')):
            if L.sub(int(sx) + dx, int(sy) + dy) == 'env':
                L.over(int(sx) + dx, int(sy) + dy, ch)
    elif k == 3:
        # the back: the flap's V and the red wax seal where it meets
        for (x, y) in line(Layer('t'), [_r((-7, -3), tilt), _r((0, 1), tilt), _r((7, -3), tilt)], 'x', 0, ''):
            if L.sub(x, y) == 'env':
                L.over(x, y, 'E')
        sx, sy = _r((0, 1), tilt)
        for (dx, dy, ch) in ((0, 0, 'S'), (1, 0, 'T'), (0, 1, 'T'), (1, 1, 'U')):
            L.over(int(sx) + dx - 1, int(sy) + dy, ch)
    return L


def _r(p, a):
    q = _rot(p, (0.0, 0.0), a)
    return (round(q[0]), round(q[1]))


# ------------------------------------------------------------------------------------ shield shot
SHIELD_W = (3.6, 2.6, 0.9, 2.6)       # half widths of the spin (face, three-quarter, edge, back)


def shield_shot(k):
    """Frame k of the small enamel shield (a heater shield 7 x 8: a gold frame, the crimson enamel,
    a white saltire; its back is steel). (0, 0) = the centre (anchor (5, 5) of the old box)."""
    L = Layer('shield')
    hw = SHIELD_W[k]
    back = k == 3
    pts = [(-hw, -4), (hw, -4), (hw, 1), (hw * 0.5, 3.4), (0, 4.6), (-hw * 0.5, 3.4), (-hw, 1)]
    m = polymask([(x + 0.5, y + 0.5) for (x, y) in pts])
    for (x, y) in sorted(m):
        rim = any((x + dx, y + dy) not in m for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        upper_left = (x - 1, y) not in m or (x, y - 1) not in m
        if back:
            ch = '2' if upper_left else '5' if rim else '3' if x <= 0 else '4'
        elif k == 2:
            ch = 'h' if x <= 0 else 'j'                               # the gold edge seen side-on
        elif rim:
            ch = 'g' if upper_left else 'j'
        else:
            ch = 'R' if (x <= -1 and y <= -1) else 'S' if x <= 0 else 'T'
        L.put(x, y, ch, 1.0, 'shield')
    if k in (0, 1):
        # the white saltire (narrowed with the turn) and its shade
        for (x, y) in ((-1, -2), (1, -2), (0, -1), (-1, 0), (1, 0)) if k == 0 else ((0, -2), (0, -1), (0, 0)):
            if L.sub(x, y) == 'shield':
                L.over(x, y, 'A')
        if k == 0:
            L.over(1, 1, 'T')
        L.over(-1 if k == 0 else -1, -3, '0')                         # the glint on the enamel
    if back:
        L.over(0, -1, '1')                                            # the rivet of the strap
        L.over(0, 0, '4')
    return L


# ------------------------------------------------------------------------------------- stamp wave
def stamp_wave(k):
    """Frame k of the ink wave (front at the LEFT, it runs left): a low breaking wave of red stamp
    ink, its crest rolls forward into a hooked lip over a hollow, drops fly ahead, dust drifts
    behind. (0, 0) = the centre (anchor (10, 10) of the old 20 x 18 box); the ink's last row is
    y = 6, its outline the floor row y = 7."""
    L = Layer('wave')
    lift = (0, 1, 2, 1)[k]                 # the crest rises and falls
    reach = (0, 1, 2, 3)[k]                # how far the lip has rolled forward
    tip = (-7 - reach, -3 - lift + reach)  # the lip's tip curls down as it rolls
    body = [(9.5, 6.5), (6, 3), (3, -1 - lift * 0.5), (0, -4 - lift), (-3, -5.5 - lift), (-6, -5 - lift),
            (tip[0], tip[1] - 1.5), (tip[0] + 0.5, tip[1] + 0.8), (-5.5 + reach * 0.3, -2.5 - lift * 0.5),
            (-3.5, -0.5), (-4.5, 3), (-8, 5.5), (-10, 6.5)]
    m = polymask(body)
    for (x, y) in sorted(m):
        top = (x, y - 1) not in m
        under = (x, y + 1) not in m and y < 5                 # the underside of the lip (in shade)
        face = x < -2 and y > -3                              # the hollow's back wall, facing the run
        if top:
            ch = 'R'
        elif under:
            ch = 'V'
        elif face:
            ch = 'U' if x > -5 else 'T'
        elif y < -2:
            ch = 'S'
        else:
            ch = 'T' if x < 4 else 'U'
        L.put(x, y, ch, 1.0, 'ink')
    # the glossy streak along the crest and a glint
    for (x, y) in line(Layer('t'), [(4, -1 - lift // 2), (0, -3 - lift), (-4, -4 - lift)], 'x', 0, ''):
        if L.sub(x, y + 1) == 'ink':
            L.over(x, y + 1, 'R')
    L.put(-2, -4 - lift, '0' if k % 2 == 0 else 'A', 1.1, 'ink')
    # ink drops thrown ahead of the lip (each lives two frames, falling)
    for (x, y, born) in ((-11, -4, 0), (-12, 0, 1), (-10, -7, 2), (-13, -3, 3)):
        age = (k - born) % 4
        if age < 2:
            L.put(x - age, y + age * 2, 'S', 3.0, 'drop')
            L.put(x - age, y + age * 2 + 1, 'U', 3.0, 'drop')
    # the dust kicked up behind it (the warm greys of the FX ramp), drifting back and up
    for (x, y, r) in ((8 + k, 3 - k, 1.6 + 0.3 * (k % 2)), (11 + k, 1 - k, 1.2), (6 + k // 2, 5, 1.4)):
        for (px, py) in sorted(ellmask(x, y, r, r * 0.9)):
            if (px, py) not in m:
                L.put(px, py, '8' if py < y else '9', 0.5, 'dust')
    # the floor line of ink the wave leaves behind it
    for x in range(-9, 11):
        L.put(x, 6, 'U' if x > -6 else 'T', 0.9, 'ink')
    return L
