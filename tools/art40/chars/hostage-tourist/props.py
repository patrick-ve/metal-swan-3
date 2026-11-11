# The props the tourist's strips and the bind set (tools/art40/chars/bind/) share, drawn once so the
# release animations fit the strips exactly (plan rule 10): the burlap sack, the hanging cage, the
# parachute canopy, loose chair sticks. Every function returns letter rows of the tourist palette
# (parts.PAL), outlined with the one outline K by the rig's finish pass.
import math

import rig

from . import parts


def finish(rows, outline=True):
    """Outline (and selout) a hand-built picture: rows -> rows one px larger on every side."""
    h, w = len(rows), max(len(r) for r in rows)
    cv = rig.Canvas(w + 2, h + 2)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                cv.px(x + 1, y + 1, ch, 1, 'prop')
    return cv.finish(outline=outline)


def paint(cv, rows, x0, y0, z, part):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and 0 <= x0 + x < cv.W and 0 <= y0 + y < cv.H:
                cv.px(x0 + x, y0 + y, ch, z, part)


# ------------------------------------------------------------------------------------ the sack
def sack(h=30, w=18, tilt=0.0, feet=(0, 0), knee=0, bulge=0, lift=0):
    """The burlap sack with the tourist inside, the bottom on row h-1 of the body (before the outline).
    h, w: the sack's height and widest width; tilt: px the top leans forward (+) or back; feet: how far
    the two shoes hang under the hem (0 = only the toes peep out); knee: px the front of the hem kicks
    forward; bulge: 0..2, the elbow pushing the back of the burlap out (fidget). Light from the upper
    front: the front (right) side lit P, the body p, the back o, the deep folds O.
    Returns (rows, root): root = the floor point under the sack's centre (lift px under the shoes)."""
    pad = 6
    W = w + 2 * pad
    H = h + 8
    cv = rig.Canvas(W, H)
    cx = W / 2
    top = 1
    for y in range(h):
        v = y / (h - 1)
        if v < 0.10:                                   # the tuft over the tie
            hw = 1.5 + v * 12
        elif v < 0.16:                                 # the tied neck
            hw = 2.0
        elif v < 0.38:                                 # the shoulders: the head inside fills them
            t = (v - 0.16) / 0.22
            hw = 2.0 + (w / 2 - 2.0) * math.sin(t * math.pi / 2) ** 0.8
        else:                                          # the body, a little fuller low down
            hw = w / 2 + 0.6 * math.sin((v - 0.38) / 0.62 * math.pi)
        if v > 0.93:
            hw -= (v - 0.93) * 20                      # the round bottom corners
        off = tilt * (1 - v)
        front = 0
        if 0.22 < v < 0.36:
            front = 1                                  # the nose and the hat brim push the burlap
        if 0.75 < v and knee:
            front += knee * (v - 0.75) / 0.25          # the knees kick the hem forward
        back = bulge if 0.46 < v < 0.62 else 0
        x0 = int(round(cx + off - hw - back))
        x1 = int(round(cx + off + hw + front))
        for x in range(x0, x1):
            u = (x + 0.5 - (cx + off)) / max(1.0, hw)  # -1 back .. +1 front
            if v < 0.10:
                ch = 'p' if u > 0 else 'o'
            elif v < 0.16:
                ch = 'D' if (x + y) % 2 == 0 else 'd'   # the rope round the neck, twisted
            elif u > 0.45 and v < 0.85:
                ch = 'P'
            elif u > -0.45:
                ch = 'p'
            else:
                ch = 'o'
            if v > 0.86 and ch == 'P':
                ch = 'p'
            if v > 0.92 and ch == 'p' and u < 0.2:
                ch = 'o'
            cv.px(x, top + y, ch, 1, 'sack')
    # folds: two creases that run down from the tie, and one under the shoulders
    for (u0, v0, v1) in ((-0.15, 0.20, 0.48), (0.25, 0.42, 0.70), (-0.55, 0.62, 0.88)):
        for y in range(int(v0 * (h - 1)), int(v1 * (h - 1))):
            v = y / (h - 1)
            hw = w / 2
            x = int(round(cx + tilt * (1 - v) + u0 * hw + 0.6 * math.sin(y * 0.7)))
            if cv.c[top + y][x] in 'pP':
                cv.c[top + y][x] = 'o'
    # the red stamp (two bars) on the lit front, the sewn patch at the back, its stitches
    sy = int(0.30 * (h - 1)) + top
    sx = int(round(cx + tilt * 0.7 + w * 0.12))
    for dy in (0, 2):
        for dx in range(3):
            if cv.c[sy + dy][sx + dx] != '.':
                cv.c[sy + dy][sx + dx] = 'R' if dx < 2 else 'r'
    py = int(0.58 * (h - 1)) + top
    px = int(round(cx + tilt * 0.4 - w * 0.30))
    for dy in range(4):
        for dx in range(4):
            if cv.c[py + dy][px + dx] != '.':
                cv.c[py + dy][px + dx] = 'D' if (dx in (0, 3) and dy in (0, 3)) else 'O' if dy == 3 else 'o'
    # the knot's bow ends sticking out at the front
    ky = int(0.12 * (h - 1)) + top
    kx = int(round(cx + tilt * 0.9 + 2))
    for dx, dy, ch in ((0, 0, 'D'), (1, -1, 'D'), (2, -1, 'd'), (1, 1, 'd')):
        cv.px(kx + dx, ky + dy, ch, 2, 'knot')
    # the shoes under the hem: the near one in front, the far one behind
    bot = top + h
    for i, (dx, hang) in enumerate(((-3.5, feet[1]), (1.5 + knee * 0.5, feet[0]))):
        x = int(round(cx + dx))
        y = bot - 2 + hang
        shoe = ['xxXX.', 'xXXXx', 'vvvvv'] if i == 1 else ['xxX.', 'xxXx', 'vvvv']
        paint(cv, shoe, x, y, 0.5 if i == 0 else 0.8, f'shoe{i}')
    rows = cv.finish()
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    return rows, (int(cx), max(ys) + 1 + lift)


# ------------------------------------------------------------------------------------ the cage
CAGE_W, CAGE_H = 20, 30
BARS_BACK = (4, 10, 16)
BARS_FRONT = (1, 7, 13, 19)


def _dome_y(x):
    """The roof line of the dome over column x (0..19): 0 at the centre, 5 at the sides."""
    u = (x + 0.5 - CAGE_W / 2) / (CAGE_W / 2)
    return int(round(5 * (1 - math.sqrt(max(0.0, 1 - u * u)))))


def cage(cv, x0, y0, layer, sway=0):
    """The hanging bird cage (20 x 30, the floor plate on rows 28-29) drawn on a rig canvas at
    (x0, y0) = its top-left: layer 'back' (the back bars and the back of the dome, z 0) or 'front'
    (the front bars, the dome ring, the floor plate and the hook, z 20)."""
    if layer == 'back':
        for bx in BARS_BACK:
            for y in range(_dome_y(bx) + 1, CAGE_H - 2):
                cv.px(x0 + bx, y0 + y, 'g', 0, 'cageB')
        for x in range(2, CAGE_W - 2):
            cv.px(x0 + x, y0 + _dome_y(x) + 1, 'N', 0, 'cageB')
        return
    for bx in BARS_FRONT:
        for y in range(_dome_y(bx), CAGE_H - 2):
            cv.px(x0 + bx, y0 + y, 'G' if bx < 10 else 'g', 20, 'cageF')
    for x in range(CAGE_W):                            # the dome ring and the band half way
        cv.px(x0 + x, y0 + _dome_y(x), 'G' if x < 12 else 'g', 20, 'cageF')
        if 1 <= x <= CAGE_W - 2:
            cv.px(x0 + x, y0 + 13, 'g', 20, 'cageF')
    for x in range(-1, CAGE_W + 1):                    # the floor plate
        cv.px(x0 + x, y0 + CAGE_H - 2, 'G', 20, 'cageF')
        cv.px(x0 + x, y0 + CAGE_H - 1, 'g' if x < CAGE_W - 3 else 'N', 20, 'cageF')
    for dx, dy in ((0, -1), (0, -2), (-1, -3), (1, -3), (0, -4)):   # the hook ring on top
        cv.px(x0 + CAGE_W // 2 + dx, y0 + dy, 'g', 20, 'cageF')


# ------------------------------------------------------------------------------------ the canopy
def canopy(cv, cx, top, phase=0.0):
    """The red and white parachute canopy (28 px wide) breathing with phase (0..1), and its four
    lines down to the harness. Drawn on a rig canvas, centre column cx, top row top. Returns the
    two points where the lines meet the shoulders' risers (left, right)."""
    breathe = math.sin(phase * 2 * math.pi)
    hw = 13.5 + 0.6 * breathe
    hgt = 9 - 0.5 * breathe
    for y in range(int(hgt) + 1):
        v = y / hgt
        half = hw * math.sqrt(max(0.0, 1 - (1 - v) ** 2))
        for x in range(int(round(cx - half)), int(round(cx + half)) + 1):
            u = (x - cx) / hw
            gore = int(math.floor((u + 1) * 3.5))      # 7 gores, red and white
            ch = 'R' if gore % 2 == 0 else 'w'
            if y >= hgt - 1:                           # the scalloped hem, in shade
                ch = 'r' if ch == 'R' else 'D'
            elif u < -0.55 and ch == 'R':
                ch = 'r'
            elif u < -0.55 and ch == 'w':
                ch = 'D'
            cv.px(x, top + y, ch, 0, 'canopy')
    hem = top + int(hgt)
    return hem, hw


def lines(cv, a, b, z=0.5):
    """A thin dark line (the parachute lines, a balloon string)."""
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for i in range(n + 1):
        t = i / n
        x = int(round(a[0] + (b[0] - a[0]) * t))
        y = int(round(a[1] + (b[1] - a[1]) * t))
        if cv.c[y][x] == '.':
            cv.px(x, y, 'O', z, 'line')


# ------------------------------------------------------------------------------------ sticks
def stick(length, deg, w=2):
    """A loose plank of the folding chair (lit top X, the shaded side x, the cut ends v), turned by
    deg (0 = flat, positive = counter-clockwise). Returns (rows, centre)."""
    S = int(length + 6)
    rows = [['.'] * S for _ in range(S)]
    c = (S - 1) / 2
    a = math.radians(deg)
    ux, uy = math.cos(a), -math.sin(a)
    nx, ny = -uy, ux
    for i in range(int(length * 3)):
        t = i / (length * 3 - 1) - 0.5
        for k in range(w * 2):
            s = (k / (w * 2 - 1) - 0.5) * (w - 0.6)
            x = int(round(c + ux * t * length + nx * s))
            y = int(round(c + uy * t * length + ny * s))
            end = abs(t) > 0.5 - 1.0 / length
            ch = 'v' if end else ('X' if s < 0 else 'x')
            if 0 <= x < S and 0 <= y < S:
                rows[y][x] = ch
    rows = [''.join(r) for r in rows]
    return rows, (c, c)
