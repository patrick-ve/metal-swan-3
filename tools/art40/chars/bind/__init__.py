# THE BINDS of the hostages (item/bind/*) at 40 px (plan docs/design/ams40.md wave 3), in the tied
# tourist's palette and drawn from the same props (tools/art40/chars/hostage-tourist/props.py), so the
# release animations start exactly where the strips leave off (plan rule 10):
#
#   rope         8 rope segments 1..8 px long (binds.ts drawRope stacks them; frame = length - 1)
#   rope-bit     a cut rope end tumbling (4 frames, the code loops it)
#   rope-band    the parade float's rope bands: across the chest (16 px), across the knees (12 px)
#   chair-break  the folding chair of the tied strip bursts: the post, the seat, the legs and the
#                brace fly apart, bounce and lie on the street (45 ticks, once)
#   sack-off     the burlap sack splits at the tie and slides down round his ankles to a pile (51)
#   cage-break   the hanging cage lands and breaks open: the dome pops off, the bars spring out (53)
#   mast         the parade float's striped pole with its pennant (one held frame: the code draws 0)
#   balloon      the weather balloon (two frames: the code picks stateT / 16 % 2)
import math

import art40 as X
import rig

T = X.char('hostage-tourist')
TP = T.parts
PR = T.props

LETTERS = 'KQXxvDdGgNRrwPpoO'
SET = X.Set(prefix='item/bind', budget=28, face=1, outline='K', hl='w',
            colours={k: TP.PAL[k] for k in LETTERS})

GRAV = 0.35


# ------------------------------------------------------------------------------------ helpers
class Stage:
    """A rig canvas with the anchor at (ox, oy): put pieces at anchor-relative positions."""

    def __init__(self, w, h, ox, oy):
        self.cv = rig.Canvas(w, h)
        self.ox, self.oy = ox, oy

    def put(self, rows, at, centre, z, part):
        x0 = int(round(self.ox + at[0] - centre[0]))
        y0 = int(round(self.oy + at[1] - centre[1]))
        PR.paint(self.cv, rows, x0, y0, z, part)

    def frame(self, outline=True):
        rows = self.cv.finish(outline=outline)
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        # a piece lying on the street whose outline reaches the anchor line: the picture rises the
        # 1 px (rule 2: 'feet' is the ground contact, nothing below it)
        return X.Frame(rows, (self.ox, max(self.oy, max(ys) + 1)))


def fly(p0, v0, spin, deg0, t, floor=0.0, half=0.0, rest=0.0, bounce=0.35):
    """A piece thrown from p0 with velocity v0 (px/tick) and spin (deg/tick) at tick t: gravity,
    one damped bounce on the floor (its centre stops half px over the floor line), then it lies,
    turned to its rest angle. Returns ((x, y), deg)."""
    x, y = p0
    vx, vy = v0
    deg = deg0
    landed = False
    for _ in range(int(t)):
        vy += GRAV
        x += vx
        y += vy
        deg += spin
        if y > floor - half:
            y = floor - half
            if not landed and abs(vy) > 1:
                vy = -vy * bounce
                vx *= 0.5
                spin *= 0.4
                landed = True
            else:
                vy, vx, spin = 0, vx * 0.6, 0
                deg = rest
    return (x, y), deg


def plank(length, deg, w=2, lit='X', shade='x', end='v'):
    rows, c = PR.stick(length, deg, w)
    return [r.replace('X', '#').replace('x', '%').replace('v', '&').replace('#', lit).replace('%', shade).replace('&', end)
            for r in rows], c


# ------------------------------------------------------------------------------------ rope
def rope():
    out = []
    for n in range(1, 9):
        rows = []
        for y in range(n):
            tw = y % 3 == 0
            rows.append('K' + ('D' if tw else 'd') + ('d' if tw else 'D') + 'K')
        if n == 1:
            rows = ['KKKK']                              # a 1 px end: the cut, all outline
        out.append(X.Frame(rows, (2, 0)))
    return out


def rope_bit():
    out = []
    for i in range(4):
        rows, c = PR.stick(6, 180 - i * 45, 2)
        rows = [r.replace('X', 'D').replace('x', 'd').replace('v', 'O') for r in rows]
        out.append(X.Frame(PR.finish(rows), (int(c[0]) + 1, int(c[1]) + 1)))
    return out


def rope_band():
    out = []
    for w in (16, 12):
        rows = ['.' * w, ''.join('D' if x % 2 else 'd' for x in range(w)), 'd' * w]
        k = w - 5                                        # the knot at the front
        rows[0] = rows[0][:k] + 'dD' + rows[0][k + 2:]
        rows = PR.finish(rows)
        out.append(X.Frame(rows, ((w + 2) // 2, 3)))
    return out


# ------------------------------------------------------------------------------------ chair-break
# The chair of the tied strip: its grid's top-left is at (CHAIR_AT + chair 'c' offset) from the
# hostage's feet anchor. Each piece starts where it was drawn and flies.
CX0 = TP.CHAIR_AT[0] - TP.CHAIR_C[0]                     # -9: the chair grid's left column
CY0 = TP.CHAIR_AT[1] - TP.CHAIR_C[1] - 1                 # -25: its top row (the feet anchor is the line under row -1)
CHAIR_DUR = [3, 3, 4, 5, 10, 20]


def chair_pieces(t):
    """(rows, centre, z) of every piece at tick t after the burst."""
    P = [
        # name, length, width, start centre (anchor-relative), velocity, spin, start deg, rest deg
        ('post', 14, 3, (CX0 + 1, CY0 + 6.5), (-1.1, -2.2), 9, 90, 180),
        ('seat', 12, 2, (CX0 + 6, CY0 + 14.5), (0.9, -2.8), -11, 0, 0),
        ('legB', 8, 2, (CX0 + 1.5, CY0 + 19.5), (-1.5, -1.6), 16, 90, 180),
        ('legF', 8, 2, (CX0 + 9.5, CY0 + 19.5), (1.6, -1.9), -15, 90, 0),
        ('brace', 6, 2, (CX0 + 5.5, CY0 + 19), (0.2, -3.2), 22, 35, 0),
    ]
    out = []
    for i, (name, ln, w, p0, v0, spin, d0, rest) in enumerate(P):
        pos, deg = fly(p0, v0, spin, d0, t, floor=-1.5, half=w / 2, rest=rest)
        rows, c = plank(ln, deg, w)
        out.append((rows, pos, c, 2 + i * 0.1, name))
    return out


def chair_break():
    out = []
    starts = [0, 2, 6, 10, 16, 26]
    for k, t in enumerate(starts):
        st = Stage(64, 44, 32, 40)
        for rows, pos, c, z, name in chair_pieces(t):
            st.put(rows, pos, c, z, name)
        out.append(st.frame())
    return out


# ------------------------------------------------------------------------------------ sack-off
# The sack of the tourist's sack strip (frame 0: h 31, w 18) splits at the tie and slides down.
SACK_DUR = [3, 3, 4, 5, 36]


def sack_off():
    out = []
    for h, w, open_ in ((24, 19, 2), (16, 21, 3), (10, 23, 3), (6, 25, 2), (5, 25, 2)):
        rows, root = pile(h, w, open_)
        out.append(X.Frame(rows, root))
    return out


def pile(h, w, open_):
    """The sack sliding down / lying as a pile: the bottom h rows of the sack body (w wide), the
    ragged open mouth on top (the dark inside O), the cut rope tie lying on the front."""
    W = w + 8
    cv = rig.Canvas(W, h + 6)
    cx = W / 2
    top = 3
    for y in range(h):
        v = y / max(1, h - 1)
        hw = w / 2 * (0.75 + 0.25 * math.sin(min(1, v * 1.4) * math.pi / 2))
        if v > 0.85:
            hw -= (v - 0.85) * 6
        rag = (1 if (y == 0 and int(cx) % 2) else 0)
        for x in range(int(round(cx - hw)), int(round(cx + hw))):
            u = (x + 0.5 - cx) / hw
            if y < open_:                                # the open mouth: the inside in shade
                ch = 'O' if abs(u) < 0.75 else 'o'
                if y == 0 and (x * 7) % 3 == 0:
                    continue                             # ragged burlap edge
            elif u > 0.45:
                ch = 'P'
            elif u > -0.45:
                ch = 'p'
            else:
                ch = 'o'
            if v > 0.7 and ch == 'P' and (x + y) % 5 == 0:
                ch = 'p'                                 # creases where it crumples
            cv.px(x, top + y + rag * 0, ch, 1, 'sack')
    # the red stamp half hidden in the folds, the cut tie lying on the front
    sy = top + max(open_ + 1, h // 3)
    for dx in range(2):
        if cv.c[sy][int(cx + 2 + dx)] != '.':
            cv.c[sy][int(cx + 2 + dx)] = 'R'
    for dx, ch in enumerate('dDdD'):
        cv.px(int(cx + w / 2 - 5 + dx), top + h - 2, ch, 2, 'tie')
    rows = cv.finish()
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    return rows, (int(cx), max(ys) + 1)


# ------------------------------------------------------------------------------------ cage-break
# The cage of the tourist's caged strip (20 x 30, the floor plate on the anchor line) lands: it
# squashes, the dome pops off, the front bars spring out and fall, the dome lands beside the plate.
CAGE_DUR = [3, 3, 4, 4, 6, 33]


def dome_rows():
    rows = []
    for y in range(6):
        line = ''
        for x in range(20):
            top = PR._dome_y(x)
            line += ('G' if x < 12 else 'g') if top <= y and (y == top or y == 5 or x in (1, 7, 13, 18)) else '.'
        rows.append(line)
    rows[0] = rows[0][:9] + 'gg' + rows[0][11:]
    return rows


def cage_break():
    out = []
    starts = [0, 3, 6, 10, 14, 20]
    for k, t in enumerate(starts):
        st = Stage(96, 60, 48, 54)
        # the floor plate stays on the street
        plate = ['G' * 22, 'g' * 19 + 'NNN']
        st.put(plate, (0, -3), (11, 0), 1, 'plate')
        if k == 0:                                       # the landing squash: the whole cage, 2 px lower
            PR.cage(st.cv, st.ox - 10, st.oy - 29, 'back')
            PR.cage(st.cv, st.ox - 10, st.oy - 29, 'front')
            out.append(st.frame())
            continue
        dpos, ddeg = fly((0, -28), (0.7, -2.4), 7, 0, t, floor=-1.5, half=3, rest=8)
        drows = dome_rows()
        if ddeg:
            drows = rig.rotsprite(PR.finish(drows, outline=False), (11, 4), ddeg)
        st.put(drows, dpos, (10, 3), 3, 'dome')
        for i, bx in enumerate((-9, -3, 3, 9)):
            side = -1 if bx < 0 else 1
            p0 = (bx, -16)
            pos, deg = fly(p0, (side * (0.5 + 0.3 * abs(bx) / 9), -1.0), side * -9, 90, t, floor=-1.5, half=1, rest=0 if side > 0 else 180)
            rows, c = plank(24, deg, 1, 'G' if bx < 0 else 'g', 'g', 'N')
            st.put(rows, pos, c, 2 + i * 0.1, f'bar{i}')
        out.append(st.frame())
    return out


# ------------------------------------------------------------------------------------ mast
def mast():
    """The parade float's pole: red and white bands, the gilt knob (D), a red pennant, the socket."""
    rows = []
    rows.append('.dDd..........')
    rows.append('.DDd..........')
    for y in range(42):
        band = 'R' if (y // 4) % 2 == 0 else 'w'
        shade = 'r' if band == 'R' else 'P'
        line = '.' + band + band + shade
        if 1 <= y <= 7:                                  # the pennant, fluttering to the right
            n = int(9 - abs(y - 4) * 2.4)
            line += ''.join('R' if x < n - 2 else 'r' for x in range(n))
        rows.append(line)
    rows += ['XXXXx', 'xxxxv']
    w = max(len(r) for r in rows)
    rows = PR.finish([r.ljust(w, '.') for r in rows])
    return [X.Frame(rows, (3, len(rows)))]


# ------------------------------------------------------------------------------------ balloon
def balloon():
    out = []
    for k in range(2):
        rx, ry = (11, 11.5) if k == 0 else (11.5, 11)
        W, H = 25, 27
        cv = rig.Canvas(W, H)
        cx, cy = 12, 12
        for y in range(H):
            for x in range(W):
                u, v = (x + 0.5 - cx - 0.5) / rx, (y + 0.5 - cy - 0.5) / ry
                d = u * u + v * v
                if d <= 1:
                    light = -0.55 * u - 0.6 * v
                    ch = 'w' if light > 0.25 else 'G' if light > -0.35 else 'g'
                    if abs(v - 0.15) < 0.09:
                        ch = 'R' if light > -0.35 else 'r'
                    cv.px(x, y, ch, 1, 'balloon')
        bot = cy + int(ry) + 1
        for dx, dy, ch in ((0, 0, 'g'), (-1, 1, 'G'), (0, 1, 'g'), (1, 1, 'g'), (0, 2, 'g')):
            cv.px(cx + dx, bot + dy, ch, 2, 'knot')
        rows = cv.finish()
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        out.append(X.Frame(rows, (cx, max(ys) + 1)))
    return out


def build(s):
    TP.install()                       # the tourist palette's selout tones (rig.DARK)
    s.strip('rope', rope(), 60, cls='prop')
    s.strip('rope-bit', rope_bit(), 4, cls='prop')
    s.strip('rope-band', rope_band(), 60, cls='prop')
    s.strip('chair-break', chair_break(), CHAIR_DUR, loop=False, cls='prop')
    s.strip('sack-off', sack_off(), SACK_DUR, loop=False, cls='prop')
    s.strip('cage-break', cage_break(), CAGE_DUR, loop=False, cls='prop')
    s.strip('mast', mast(), 60, cls='prop')
    s.strip('balloon', balloon(), 16, cls='prop')
