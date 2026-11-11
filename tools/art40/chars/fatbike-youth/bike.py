# The fat-tyre e-bike of the fatbike youths (the shared fatbike kit): the approved cast look
# (docs/design/cast40/chars/fatbike-youth.py): fat knobbly tyres (4 px of rubber, 18 px wheels), small
# silver rims, one chunky down tube with the battery block, a long bench seat, a riser bar, a lamp,
# the speaker box on the rear rack. Drawn facing right on a ridekit canvas.
#
# Parameters a frame can move: tilt (the wheelie: the front lifted round the rear contact), crank
# (degrees), roll (the tyre knobs turn with the ground speed), yaw (the turn: 1 side view .. 0 head
# on; the far side shows when negative), lie (on its side, the wreck), and the frame ramp FRAME
# (the looks of stage 2 swap it: gold, sky, stone, green).
import math

from . import ridekit as RK

WR = 8.7            # wheel radius (18 px wheels)
AX = 13.5           # half the wheelbase
AY = 9.0            # axle height above the ground
KNOBS = 11          # knobs round the tyre
FRAME = ['G', 'g', 'n', 'N']        # the frame ramp (look 0: gold)
TYRE = ['p', 'o', 'O', 'O']
DARK = ['A', 'P', 'o', 'O']
RIM = ['t', 't', 'A', 'P']
LAMP = ['X', 'X', 'x', 'v']


def fat_bike(cv, R, tilt=0.0, crank=0.0, roll=0.0, yaw=1.0, z0=0.0, frame=None, lamp=True, speaker=True, rack_box=True):
    """Draw the bike. R = the ground point under the bottom bracket of the level bike (canvas px).
    tilt: degrees, the front lifted round the REAR AXLE (positive = wheelie). roll: the
    tyre turn in knobs (1.0 = one knob forward). Returns the key points (canvas px): seat, grip,
    gripF (the far grip), pn / pf (near / far pedal), bb, rear, front, rack (the passenger's seat on
    the rack), spk (the speaker cone), lamp, T (bike-local -> canvas)."""
    FR = frame or FRAME
    gx, gy = R
    th = math.radians(tilt)
    piv = (gx - AX * yaw, gy - AY)           # the rear axle (the rear tyre stays on the road)

    def T(x, y):
        """Bike-local (x forward, y up from the ground under the bottom bracket) -> canvas."""
        dx, dy = (x + AX) * yaw, AY - y
        return (piv[0] + dx * math.cos(th) + dy * math.sin(th), piv[1] - dx * math.sin(th) + dy * math.cos(th))

    rear, front = T(-AX, AY), T(AX, AY)
    bb = T(0, AY)
    sx = abs(yaw) ** 0.5 if abs(yaw) < 1 else 1.0

    def tread(phase):
        def tone(x, y, d, a, ch):
            # 4 px of rubber; the outer ring is cut into knobs (notches in the silhouette)
            seg = ((a - th + math.pi) / (2 * math.pi) * KNOBS * 3 - phase * 3)
            knob = int(math.floor(seg)) % 3 != 0
            if d > WR - 0.9:
                return ch if knob else ''
            if d > WR - 1.9 and knob:
                return {'p': 'P', 'o': 'p', 'O': 'o'}[ch]       # the knob faces catch a little light
            return ch
        return tone

    for c, zz in ((rear, 1.0), (front, 1.05)):
        RK.disc(cv, c, WR, TYRE, z0 + zz, 'wheel', r_in=4.6, tone=tread(roll), sx=sx)        # the fat tyre
        RK.disc(cv, c, 4.6, RIM, z0 + zz + 0.02, 'wheel', r_in=3.4, sx=sx)                   # small silver rim
        RK.disc(cv, c, 3.3, ['o', 'O', 'O', 'O'], z0 + zz + 0.01, 'wheel', sx=sx)            # dark rim well
        # two spokes of the rim (they turn with the wheel)
        a = -roll * 2 * math.pi / KNOBS + th
        for s in (0, math.pi / 2):
            for k in (-1, 1):
                p = (c[0] + k * 2.6 * math.cos(a + s) * sx, c[1] - k * 2.6 * math.sin(a + s))
                cv.px(round(p[0]), round(p[1]), 'P', z0 + zz + 0.03, 'wheel')
        RK.disc(cv, c, 1.3, ['t', 'A', 'P', 'P'], z0 + zz + 0.05, 'wheel', sx=sx)            # hub
    head_lo, head_hi = T(10.5, 18), T(9.5, 22)
    RK.rod(cv, bb, rear, 0.9, FR, z0 + 2.4, 'frame')                       # chain stay
    RK.rod(cv, bb, T(-5, 18), 1.1, FR, z0 + 2.45, 'frame')                 # seat tube
    RK.rod(cv, T(-5, 18), rear, 0.7, FR, z0 + 2.42, 'frame')               # seat stay
    RK.rod(cv, bb, head_lo, 2.3, FR, z0 + 2.5, 'frame')                    # the chunky down tube
    RK.poly(cv, [T(3.4, 16.4), T(8.6, 20.6), T(10.0, 18.6), T(4.8, 14.4)], 'P', z0 + 2.55, 'battery')
    RK.line(cv, T(3.8, 16.6), T(8.4, 20.3), 'A', z0 + 2.56, 'battery')
    RK.line(cv, T(5.2, 14.6), T(9.8, 18.4), 'o', z0 + 2.56, 'battery')
    RK.rod(cv, head_lo, head_hi, 1.3, FR, z0 + 2.5, 'frame')               # head tube
    RK.rod(cv, head_lo, front, 1.2, FR, z0 + 2.45, 'frame')                # fork
    lp = T(12.5, 19.5)
    if lamp:
        RK.disc(cv, lp, 1.2, LAMP, z0 + 2.7, 'lamp', sx=sx)
    # bench seat; behind it the rack with the speaker box (a gap between them)
    seat = T(-6, 20.5)
    RK.rod(cv, T(-10, 20.5), T(-3, 21), 1.2, DARK, z0 + 2.7, 'seat')
    RK.rod(cv, T(-12, 18), rear, 0.6, ['P', 'o', 'O', 'O'], z0 + 2.2, 'rack')
    RK.rod(cv, T(-19, 18), T(-12, 18), 0.6, ['A', 'P', 'o', 'O'], z0 + 2.3, 'rack')
    spk = T(-16.5, 20.6)
    if speaker and rack_box:
        RK.poly(cv, [T(-19.5, 18), T(-13.5, 18), T(-13.5, 23.5), T(-19.5, 23.5)], 'p', z0 + 2.35, 'speaker')
        RK.poly(cv, [T(-19.5, 23), T(-13.5, 23), T(-13.5, 23.5), T(-19.5, 23.5)], 'A', z0 + 2.36, 'speaker')
        RK.disc(cv, spk, 1.7, ['t', 'P', 'O', 'O'], z0 + 2.37, 'speaker', sx=sx)
        RK.disc(cv, spk, 0.6, ['O', 'O', 'O', 'O'], z0 + 2.38, 'speaker')
    # riser bar
    stem = T(8.5, 27)
    RK.rod(cv, head_hi, stem, 0.7, DARK, z0 + 2.6, 'bar')
    grip = T(5.5, 27.5)
    RK.rod(cv, stem, grip, 0.7, DARK, z0 + 2.6, 'bar')
    # cranks
    a = math.radians(crank) - th
    pn = (bb[0] + 4 * math.cos(a) * yaw, bb[1] + 4 * math.sin(a))
    pf = (bb[0] - 4 * math.cos(a) * yaw, bb[1] - 4 * math.sin(a))
    RK.disc(cv, bb, 2.2, ['t', 'P', 'o', 'O'], z0 + 2.8, 'ring', sx=sx)
    RK.rod(cv, bb, pf, 0.6, ['P', 'o', 'O', 'O'], z0 + 1.6, 'crankF')
    RK.rod(cv, bb, pn, 0.6, ['t', 'P', 'o', 'O'], z0 + 3.5, 'crankN')
    for p, z in ((pf, z0 + 1.7), (pn, z0 + 3.6)):
        RK.grid(cv, round(p[0]) - 1, round(p[1]), ['OOO'], z, 'pedal')
    return dict(seat=seat, grip=grip, gripF=(grip[0] + 1 * yaw, grip[1]), pn=pn, pf=pf, bb=bb, rear=rear, front=front,
                rack=T(-14, 20), spk=spk, lamp=lp, T=T)


def wreck(cv, R, k, frame=None):
    """The riderless bike on its side (the wreck): k = 0 tips (the bike leaning 35 degrees, both
    wheels still round), 1 lying, the wheels squeezed into ellipses seen from above, the bar and the
    seat flat; the near wheel still spinning (k changes the knob phase)."""
    FR = frame or FRAME
    gx, gy = R
    if k == 0:
        # the lean: the bike drawn upright, then pushed over into a parallelogram (the top moves back)
        return fat_bike(cv, R, tilt=-6, crank=40, roll=0.4)
    # lying flat: seen from the side but squashed to 9 px high (the frame lies on the road)
    cy = gy - 4.0

    def tone(phase):
        def t(x, y, d, a, ch):
            seg = (a + math.pi) / (2 * math.pi) * KNOBS * 3 - phase * 3
            if d > WR - 0.9 and int(math.floor(seg)) % 3 == 0:
                return ''
            return ch
        return t

    def ell(c, r, ramp, z, rin=0.0, tn=None):
        cx, cy_ = c
        for y in range(int(cy_ - r * 0.45) - 1, int(cy_ + r * 0.45) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                dx, dy = x - cx, (y - cy_) / 0.45
                d = math.hypot(dx, dy)
                if rin < d <= r:
                    l = RK.lit(dx / (d or 1), dy / (d or 1))
                    kk = 0 if l > 0.45 else 1 if l > 0.05 else 2 if l > -0.45 else 3
                    ch = ramp[kk]
                    if tn:
                        ch = tn(x, y, d, math.atan2(dy, dx), ch)
                    if ch:
                        cv.px(x, y, ch, z, 'wheel')
    rear, front = (gx - AX, cy), (gx + AX, cy)
    ell(front, WR, TYRE, 1.0, 4.6, tone(k * 0.7))
    ell(front, 4.6, RIM, 1.02, 3.4)
    ell(front, 3.3, ['o', 'O', 'O', 'O'], 1.01)
    RK.rod(cv, (gx - 11, cy - 2), (gx + 10, cy - 3), 1.6, FR, 2.5, 'frame')          # the down tube on its side
    RK.poly(cv, [(gx - 2, cy - 5), (gx + 6, cy - 5), (gx + 6, cy - 2), (gx - 2, cy - 2)], 'P', 2.55, 'battery')
    RK.rod(cv, (gx - 14, cy - 5), (gx - 6, cy - 5.5), 1.1, DARK, 2.7, 'seat')
    RK.rod(cv, (gx + 11, cy - 3), (gx + 17, cy - 7), 0.7, DARK, 2.6, 'bar')
    RK.poly(cv, [(gx - 22, cy - 4), (gx - 16, cy - 4), (gx - 16, cy + 1), (gx - 22, cy + 1)], 'p', 2.35, 'speaker')
    RK.disc(cv, (gx - 19, cy - 1.5), 1.5, ['t', 'P', 'O', 'O'], 2.37, 'speaker')
    ell(rear, WR, TYRE, 3.0, 4.6, tone(k * 1.3))
    ell(rear, 4.6, RIM, 3.02, 3.4)
    ell(rear, 3.3, ['o', 'O', 'O', 'O'], 3.01)
    ell(rear, 1.3, ['t', 'A', 'P', 'P'], 3.05)
    return dict(rear=rear, front=front)
