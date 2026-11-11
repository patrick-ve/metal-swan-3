# The delivery rider's stone-grey city bike (the cast sample's bike), drawn by geometry so it can
# pedal (the crank angle), roll (the spoke angle), tilt about the rear wheel's ground contact
# (a rock, a lift) and lie down (a vertical squash: the wreck on its side), always without a
# rotated resample.
import math

from . import kit

FR = ['G', 'g', 'n', 'n']          # the stone frame ramp
TY = ['P', 'p', 'o', 'O']          # the black tyres
RIM = ['T', 't', 'g', 'n']         # chrome rims
BAR = ['T', 't', 'n', 'n']
WR = 7.4                           # tyre radius (15 px wheels)
CR = 4.0                           # crank radius


class Geo:
    """Every key point of the bike for one frame: canvas px, after the tilt and squash."""

    def __init__(self, R, rot=0.0, sy=1.0, dx=0.0):
        self.R = R
        self.rot = rot
        self.sy = sy
        gx, gy = R
        self.gx, self.gy = gx + dx, gy
        self.pivot = (self.gx - 13, gy)            # the rear wheel's ground contact
        a = math.radians(rot)
        self.ca, self.sa = math.cos(a), math.sin(a)

    def T(self, p):
        """Body point (x right, y down, relative to the ground point) -> canvas px."""
        x, y = self.gx + p[0], self.gy + p[1]
        px, py = self.pivot
        dx, dy = x - px, y - py
        x, y = px + dx * self.ca - dy * self.sa, py + dx * self.sa + dy * self.ca
        return (x, self.gy + (y - self.gy) * self.sy)


# body-space key points (relative to the ground point under the bottom bracket)
REAR, FRONT = (-13, -8), (14, -8)
BB = (0, -7.5)
SEAT = (-7, -19)
HEAD_LO, HEAD_HI = (11, -15), (10, -19)
STEM = (9, -23)
GRIP = (5.5, -23.5)
BELL = (8, -25)


def points(g, crank):
    """The points the rider uses: saddle, grip, bell, the near / far pedals (canvas px)."""
    a = math.radians(crank)
    bb = g.T(BB)
    pn = (bb[0] + CR * math.cos(a), bb[1] + CR * math.sin(a) * g.sy)
    pf = (bb[0] - CR * math.cos(a), bb[1] - CR * math.sin(a) * g.sy)
    return dict(seat=g.T(SEAT), grip=g.T(GRIP), bell=g.T(BELL), bb=bb, pn=pn, pf=pf,
                rear=g.T(REAR), front=g.T(FRONT))


def draw(cv, g, crank=112, spin=0.0, bell=True, z0=0.0, light=False):
    """The city bike, facing right. crank = the near crank's angle (deg, screen: 90 = straight
    down), spin = the spokes' angle (deg). light: the red tail light lit. Returns points()."""
    sy = g.sy
    T = g.T
    rear, front = T(REAR), T(FRONT)
    for c, z in ((rear, 1.0), (front, 1.0)):
        z += z0
        kit.hole(cv, c, 5.6, z - 0.5, 'wheel', sy=sy)
        kit.disc(cv, c, WR, TY, z, 'wheel', r_in=5.6, sy=sy)           # tyre
        kit.disc(cv, c, 5.6, RIM, z, 'wheel', r_in=4.7, sy=sy)         # rim
        for k in range(3):                                             # three spokes
            a = math.radians(spin + 23 + 60 * k)
            dx, dy = 4.6 * math.cos(a), 4.6 * math.sin(a) * sy
            kit.line(cv, (c[0] - dx, c[1] - dy), (c[0] + dx, c[1] + dy), 'g', z - 0.1, 'wheel')
        kit.disc(cv, c, 1.2, ['T', 't', 'n', 'n'], z + 0.05, 'wheel', sy=max(sy, 0.8))
    bb = T(BB)
    seat = T(SEAT)
    head_lo, head_hi = T(HEAD_LO), T(HEAD_HI)
    z = z0
    # frame: chain stay, seat stay, seat tube, down tube, the low step-through top tube, fork
    kit.rod(cv, bb, rear, 0.75, FR, z + 2.4, 'frame')
    kit.rod(cv, seat, rear, 0.75, FR, z + 2.4, 'frame')
    kit.rod(cv, bb, seat, 0.95, FR, z + 2.5, 'frame')
    kit.rod(cv, bb, head_lo, 1.0, FR, z + 2.5, 'frame')
    kit.rod(cv, T((-3.5, -16)), head_hi, 0.8, FR, z + 2.5, 'frame')
    kit.rod(cv, head_hi, front, 0.8, FR, z + 2.45, 'frame')
    # the rear rack and its stay, the red tail light at its end
    kit.rod(cv, T((-18, -16)), T((-6, -16)), 0.6, ['g', 'n', 'N', 'N'], z + 2.3, 'rack')
    kit.line(cv, T((-17, -16)), rear, 'n', z + 2.2, 'rack')
    tl = T((-19, -15))
    cv.px(round(tl[0]), round(tl[1]), 'R' if light else 'z', z + 2.35, 'rack')
    # the stem and the swept-back bar
    stem = T(STEM)
    kit.rod(cv, head_hi, stem, 0.7, BAR, z + 2.6, 'bar')
    kit.rod(cv, stem, T((6, -23.5)), 0.7, BAR, z + 2.6, 'bar')
    if bell:
        b = T(BELL)
        kit.grid(cv, b[0] - 1, b[1] - 1, ['.TT.', 'TTtt'], z + 7.4, 'bell')
    # the saddle
    kit.grid(cv, seat[0] - 3, seat[1] - 2, ['.ooooA.', 'oooopPA', '..oo...'], z + 2.7, 'saddle')
    # the cranks and the chainring
    p = points(g, crank)
    pn, pf = p['pn'], p['pf']
    kit.disc(cv, bb, 2.4, ['t', 'g', 'n', 'N'], z + 2.8, 'ring', sy=max(sy, 0.6))
    kit.line(cv, (bb[0], bb[1] - 2.3 * sy), (rear[0] + 1, rear[1] - 1.5 * sy), 'N', z + 2.35, 'chain')
    kit.rod(cv, bb, pf, 0.6, ['g', 'n', 'N', 'N'], z + 1.6, 'crankF')
    kit.rod(cv, bb, pn, 0.6, ['t', 'g', 'n', 'N'], z + 3.5, 'crankN')
    for q, zz in ((pf, 1.7), (pn, 3.6)):
        kit.grid(cv, round(q[0]) - 1, round(q[1]), ['NNN'], z + zz, 'pedal')
    return p
