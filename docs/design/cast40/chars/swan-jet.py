# The jet Swan of the Oldenzaal finale: the same robot Swan (chars/swan.py) in flight, two rocket
# units strapped under her wings (ivory tubes with navy bands and nose cones, steel nozzle bells,
# gold rivets), blue-white flames out of the nozzles, the far wing raised, the near wing folded over
# the near unit's pylon, the legs and paddles tucked back, the neck stretched forward.
import importlib
import math
import castkit as K

S = importlib.import_module('chars.swan')
SW = S.SW

INFO = dict(
    name='THE JET SWAN', mission=['oldenzaal'], role='ally', kind='MACHINE', face=1,
    pose='flying, rockets lit: far wing up, neck stretched forward, legs tucked, two blue-white jets',
    note='the Swan sample in flight with two strapped-on rocket units (navy bands and nose, steel '
         'nozzle, gold rivets) and blue-white flames; no rider',
    old='vehicle/swan/glide#0', air=20)

TILT = -6          # nose up a little: she climbs away


def rocket(pen, c, L, r, z, part, far=False):
    """A rocket unit centred at c (body-attached), nozzle back (-x), nose forward (+x)."""
    ramp = S.IVORY if not far else S.IV_FAR
    navy = S.NAVY if not far else ['N', 'N', 'V', 'V']
    x0, x1 = c[0] - L / 2, c[0] + L / 2
    y = c[1]
    # body cylinder
    pen.tube((x0 + 2, y), (x1 - 3, y), r, r, ramp, z, part, body=True, cut=(0.62, 0.1, -0.3))
    # nose cone (navy)
    pen.tube((x1 - 3, y), (x1 - 0.5, y), r - 0.2, 0.7, navy, z + 0.01, part, body=True)
    # navy bands near both ends and gold rivets between them
    for bx in (x0 + 3, x1 - 4.5):
        pen.line((bx, y - r), (bx, y + r), 'N' if not far else 'V', z + 0.02, part, only=(part,))
    for bx in range(int(x0 + 5), int(x1 - 5), 3):
        pen.dot((bx, y - r + 1.2), 'G' if not far else 'g', z + 0.03, part)
    # steel nozzle bell, flaring backward, dark inside
    pen.poly([(x0 + 2.2, y - r + 0.6), (x0 - 0.2, y - r - 0.4), (x0 - 0.2, y + r + 0.4), (x0 + 2.2, y + r - 0.6)],
             S.STEEL if not far else S.STEEL_F, z + 0.01, part, R=1.2)
    pen.dot((x0 - 0.2, y), 'V', z + 0.04, part)
    return (x0 - 0.8, y)


def flame(pen, at, L, w, z):
    """A blue-white jet going backward (-x in body space), no outline (effect letters)."""
    a = pen.T(at)
    b = pen.T((at[0] - L, at[1]))
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    c0 = pen.C(a)
    for Y in range(int(c0[1] - w - 2), int(c0[1] + w + 3)):
        for X in range(int(c0[0] - L - 2), int(c0[0] + 2)):
            px, py = X + 0.0 - c0[0], Y + 0.0 - c0[1]
            s = px * ux + py * uy           # along the jet
            q = -px * uy + py * ux          # across it
            if s < -0.3 or s > L:
                continue
            t = s / L
            wd = w * (1 - t) ** 0.8 + 0.35
            if abs(q) > wd:
                continue
            heat = (1 - abs(q) / wd) * (1 - t * 0.9)
            ch = 'I' if heat > 0.45 else 'i' if heat > 0.22 else 'm'
            pen.cv.px(X, Y, ch, z, 'fx')


def frame():
    K.palette(S.PAL, dark=S.DARK)
    pen = S.Pen(140, 110, 84, 92, tilt=TILT)
    neckpose = dict(c1=(23, -27), c2=(21, -33), head=(28, -36), ang=2)

    def extra(pen, stage):
        if stage == 'mid':
            # the far rocket unit: behind the hull, lower and further back, in the shade
            pen.far_nozzle = rocket(pen, (-11, -2.5), 15, 2.4, 0.6, 'rkF', far=True)
            # legs tucked back under the hull, paddles folded and trailing
            for near, hip, z in ((False, (-3, -15), 0.9), (True, (-1, -14), 2.9)):
                ramp = S.STEEL if near else S.STEEL_F
                kn = (-7, -11.5)
                ft = (-14, -13)
                kn = (kn[0] - (0 if near else 1.5), kn[1])
                ft = (ft[0] - (0 if near else 1.5), ft[1] - (0 if near else 1))
                pen.tube(hip, kn, 1.6, 1.3, ramp, z, 'tuck' + str(near), body=True)
                pen.tube(kn, ft, 1.2, 0.8, ramp, z + 0.01, 'tuck' + str(near), body=True)
                pen.grid("""
                    .oo.
                    oOOO
                    OOrO
                    .rO.
                """ if near else """
                    .OO.
                    OOOO
                    OrrO
                    .rO.
                """, (ft[0] - 1, ft[1]), (3, 1), z + 0.02, 'tuck' + str(near))
        if stage == 'front':
            pass

    # the far wing up, the near wing folded
    S.far_wing(pen, 1.0, 0.0, 'up')
    S.handles(pen)
    S.tail(pen, 2.0, 0.0)
    S.hull(pen, 3.0)
    S.seat_pad(pen, 3.5)
    extra(pen, 'mid')
    S.near_wing(pen, 6.0, 0.0)
    # the near rocket unit on a short steel pylon under the folded wing, in front of the hull
    for x in (-4, 1):
        pen.line((x, -12), (x, -8), 't', 6.4, 'pylon')
    near_noz = rocket(pen, (-1, -6), 17, 2.8, 6.5, 'rkN')
    S.neck(pen, neckpose['c1'], neckpose['c2'], neckpose['head'], 4.0)
    S.head(pen, neckpose['head'], neckpose['ang'], 5.0)
    rows = [list(r) for r in S.despeckle(pen.cv.finish())]
    # flames after the outline (they glow): drawn on a fresh canvas layer and pasted
    fl = S.Pen(140, 110, 84, 92, tilt=TILT)
    flame(fl, (near_noz[0], near_noz[1]), 20, 3.0, 1.0)
    flame(fl, (pen.far_nozzle[0], pen.far_nozzle[1]), 15, 2.4, 0.5)
    for y in range(fl.cv.H):
        for x in range(fl.cv.W):
            ch = fl.cv.c[y][x]
            if ch != '.' and rows[y][x] == '.':
                rows[y][x] = ch
    rows = [''.join(r) for r in rows]
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    return rows, pen.C((0, 0))[:1] + (max(ys) + 1,)

