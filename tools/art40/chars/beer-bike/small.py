# BIERFIETS: the small strips (centre anchors): the wheels (4 mechanical turn steps), the rolled keg
# (4 steps), the foam spray (the special: one 20-tick pass), the wreck debris (4 pieces).
import math

from . import kit as T
from . import pal as C


def _sq(n):
    return T.Body(n, n, n // 2, n // 2)


# --------------------------------------------------------------------------------------- the wheels
WHEEL_R = 7.4
WHEEL_STEP = math.pi / 8      # 22.5 degrees a step: 3 px of roll on a r 7 wheel turn it 24.6 degrees


def wheel(k, far=False):
    """Step k (0..3), the spokes turned clockwise on screen (the bike rolls forward, facing right).
    Two spoke bars crossing (four spokes): the pattern repeats every 90 degrees = 4 steps, so the
    wheel turns on without a jump. Near: a dark tyre lit on its upper front, a bright steel rim,
    steel spokes, a red hub cap; far: one ramp darker, a dark hub."""
    b = _sq(19)
    c = (0.5, 0.5)
    ph = k * WHEEL_STEP
    tyre = C.TYRE if far else ['A', 'P', 'o', 'O']
    rim = ['P', 'o', 'o', 'O'] if far else ['t', 't', 'A', 'P']
    T.hole(b, c, 4.0, 0.6, 'wheel')
    T.disc(b, c, WHEEL_R, tyre, 1.0, 'wheel', r_in=5.0)
    T.disc(b, c, 5.0, rim, 1.0, 'wheel', r_in=4.0)
    # the spokes: 4-connected bands (no lone diagonal pixels), lit on the upper front
    for y in range(-5, 5):
        for x in range(-5, 5):
            dx, dy = x + 0.5 - c[0], y + 0.5 - c[1]
            d = math.hypot(dx, dy)
            if not 1.5 < d < 4.1:
                continue
            for s in range(2):
                a = ph + s * math.pi / 2 + 0.15
                if abs(-dx * math.sin(a) + dy * math.cos(a)) < 0.62:
                    lit = (dx * T.L2[0] + dy * T.L2[1]) / d > -0.2
                    ch = ('o' if lit else 'O') if far else ('A' if lit else 'P')
                    b.px(x, y, ch, 0.9, 'wheel')
    T.disc(b, c, 1.6, (['P', 'P', 'o', 'o'] if far else ['J', 'J', 'q', 'q']), 1.1, 'wheel')
    return T.finish(b)


# --------------------------------------------------------------------------------------- the keg
def keg(i):
    """The rolled keg seen from its end, step i (45 degrees clockwise a step: 4 px of roll on its
    r 5.5 chime): a steel chime, oak staves between two dark joints, a red band painted across the
    end (it shows the roll), the brass bung in the middle with the lit fuse (it flickers)."""
    b = _sq(13)
    c = (0.5, 0.5)
    rot = i * math.pi / 4
    T.disc(b, c, 5.6, C.STEEL, 1.0, 'keg', r_in=4.3)

    def face(x, y, d, a, ch):
        u = math.cos(a - rot) * d
        v = math.sin(a - rot) * d
        if abs(v) < 1.0:
            return 'j' if ch in ('1', '2') else 'q'       # the painted band
        if abs(abs(v) - 2.6) < 0.5:
            return '4'                                     # a stave joint
        return ch
    T.disc(b, c, 4.3, C.OAK, 1.1, 'keg', tone=face)
    T.disc(b, c, 1.3, C.BRASS, 1.2, 'keg')
    fx = [(0, -1, 'y' if i % 2 == 0 else 'x'), (0 if i % 2 else 1, -2, 'F' if i % 2 == 0 else 'f')]
    return T.finish(b, fx)


# --------------------------------------------------------------------------------------- the foam
FOAM_W, FOAM_H = 68, 32
FOAM_DUR = [2, 3, 3, 4, 4, 4]     # 20 ticks, the old pass (logic time: the cone erases for 16)


def _blob(b, x, y, r, z, ramp, part):
    T.disc(b, (x, y), r, ramp, z, part, cut=(0.35, -0.1, -0.55))


def foam(i):
    """The foam spray from the nozzle (anchor: the left middle). 0 the burst at the mouth (a ring
    of froth), 1 the jet shoots out, 2 the full cone, 3 the cone breaks into blobs, 4 the blobs
    swell and sag, 5 the last bubbles drop and pop."""
    b = T.Body(FOAM_W + 4, FOAM_H, 4, FOAM_H // 2)
    foam_r = ['5', '5', '6', '7']
    head = ['5', '6', '7', '7']
    beer = ['g', 'n', 'N', 'N']
    reach = [12, 40, 62, 64, 60, 52][i]
    n = [8, 22, 34, 30, 20, 12][i]
    sag = [0, 0, 0.5, 1.5, 3.5, 6][i]
    grow = [1.0, 0.9, 1.0, 1.1, 1.15, 0.8][i]
    fx = []
    for k in range(n):
        t = (k + 0.5) / n
        x = 2 + t * reach
        spread = 1.0 + t * (9.0 if i >= 2 else 5.0)
        y = math.sin(k * 2.39996 + i * 0.7) * spread + sag * t * t
        r = (1.4 + t * 2.8) * grow
        if i >= 3 and k % 4 == 1:
            continue                                  # gaps open in the cone
        if i == 5 and k % 2 == 0:
            r *= 0.6
        ramp = beer if (k % 7 == 3 and i < 4) else (head if k % 3 == 0 else foam_r)
        _blob(b, x, y, r, 1 + t + (k % 3) * 0.1, ramp, f'f{k}')
        if k % 5 == 0 and i in (2, 3, 4):
            fx.append((round(x), round(y - r * 0.6), 'W'))    # wet glints
    if i == 0:
        # the burst: a froth ring round the mouth
        for a in range(10):
            ang = a * math.pi / 5
            _blob(b, 2.5 + math.cos(ang) * 3.0, math.sin(ang) * 3.0, 1.5, 2.0, foam_r, f'ring{a}')
    if i >= 4:
        # drips falling from the cone
        for k in range(4 if i == 4 else 6):
            x = 14 + k * 9 + (i - 4) * 2
            y = 6 + (k % 3) * 2 + (i - 4) * 4
            if y < FOAM_H // 2 - 1:
                _blob(b, x, y, 1.0, 3.0, head, f'drip{k}')
    return T.finish(b, fx)


# --------------------------------------------------------------------------------------- debris
def debris(i):
    """Wreck debris (the code picks a frame per piece): 0 a broken plank, 1 a keg hoop, 2 a stool
    cushion, 3 a beer glass."""
    b = _sq(11)
    if i == 0:
        T.grid(b, -4, -2, ['1112221..', '22233332.', '.3334443.'], 1.0, 'plank')
    elif i == 1:
        T.disc(b, (0.5, 0.5), 4.0, C.STEEL, 1.0, 'hoop', r_in=2.6)
    elif i == 2:
        T.grid(b, -3, -2, ['.JJJJ.', 'jJJjjq', 'jjjjqq', '.qqqq.'], 1.0, 'cushion')
    else:
        T.grid(b, -1, -3, ['565', 'Wgn', 'ggn', 'gnN', 'tPo'], 1.0, 'glass')
    return T.finish(b)
