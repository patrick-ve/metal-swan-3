# The Swan (SWAN-3): the hero's ride, a riveted ivory robot swan, here without a rider.
# Built on the squad rig's Swan (ext_ride_swan: the hull polygon, the far-wing arch, the folded near
# wing, the S neck, the head and beak placement, the backward-bending legs, the webbed feet and the
# handle grips), restyled to her design (docs/design/swan-mount/look.md): ivory enamel plates with
# panel seams, a navy waterline stripe and navy plate tips, gold rivets, a ringed neck on a steel hose
# with a navy collar, a lens eye, the orange beak that is the gun (a steel muzzle ring), steel legs
# with a hip bearing and a piston sleeve, big orange paddles, a quilted navy seat pad and two brass
# handles on a clean deck. One canvas, drawn back to front; cv.finish() does selout and the outline.
import math
import castkit as K
import ext_ride_swan as SW

INFO = dict(
    name='THE SWAN', mission=['ams', 'oat', 'oldenzaal'], role='ally', kind='MACHINE', face=1,
    pose='standing idle, the neck in a tall S, no rider (seat pad and handles on a clean deck)',
    note='the rig Swan rebuilt as the robot: ivory plates, navy stripe and plate tips, gold rivets, '
         'ringed neck, lens eye, beak gun with a steel muzzle, steel legs, quilted seat pad',
    old='vehicle/swan/idle#0', air=0)

PAL = {
    'a': '#fffcf1', 'b': '#e9e4d6', 'C': '#b8bccb', 'E': '#7c849e',   # ivory enamel
    'n': '#4a5ca8', 'N': '#2b3670', 'V': '#161b3e',                   # navy trim
    'G': '#ffd866', 'g': '#b98426',                                   # gold rivets, brass
    's': '#d4d8e4', 'S': '#949ab0', 't': '#5a6078',                   # steel
    'o': '#ffb24c', 'O': '#f07a22', 'r': '#a2441a',                   # orange beak and paddles
    'L': '#a8f2ff',                                                   # the lens glint
}
DARK = {'a': 'C', 'b': 'C', 'C': 'E', 'E': 't', 'n': 'N', 'N': 'V', 'V': 'V', 'G': 'g', 'g': 'r',
        's': 'S', 'S': 't', 't': 'V', 'o': 'O', 'O': 'r', 'r': 'r', 'L': 'n'}

IVORY = ['a', 'b', 'C', 'E']
IV_FAR = ['b', 'C', 'C', 'E']
NAVY = ['n', 'N', 'N', 'V']
STEEL = ['s', 'S', 't', 't']
STEEL_F = ['S', 't', 't', 'V']
CUT = (0.55, 0.12, -0.25)

CW, CH = 120, 96
OX, OY = 62, 86


class Pen:
    """Swan-local drawing on one canvas: x forward, y down, (0, 0) = the ground under the body."""
    def __init__(s, w=CW, h=CH, ox=OX, oy=OY, tilt=0.0, dx=0.0, dy=0.0):
        s.cv = K.Canvas(w, h)
        s.ox, s.oy = ox, oy
        a = math.radians(tilt)
        s.ca, s.sa = math.cos(a), math.sin(a)
        s.dx, s.dy = dx, dy
        s.fx = []

    def T(s, p):
        """Body-attached point -> local point (tilt about the body centre, then the offset)."""
        x, y = p[0] - SW.PIVOT[0], p[1] - SW.PIVOT[1]
        return (SW.PIVOT[0] + x * s.ca - y * s.sa + s.dx, SW.PIVOT[1] + x * s.sa + y * s.ca + s.dy)

    def C(s, p):
        return (s.ox + p[0], s.oy + p[1])

    def poly(s, pts, ramp, z, part, R=3.0, cut=CUT, lift=0.0, body=True):
        if body:
            pts = [s.T(p) for p in pts]
        cp = [s.C(p) for p in pts]
        xs, ys = [p[0] for p in cp], [p[1] for p in cp]
        lx, ly, lz = K.rig.LIGHT3
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
                if not SW.inside(cp, x, y):
                    continue
                d, (nx, ny) = SW.edge_info(cp, x, y)
                k = max(0.0, 1 - d / R)
                nx, ny = nx * k, ny * k
                nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                l = nx * lx + ny * ly + nz * lz + lift
                t = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
                s.cv.px(x, y, ramp[t], z, part, proc=True)

    def tube(s, a, b, ra, rb, ramp, z, part, cut=CUT, body=False):
        if body:
            a, b = s.T(a), s.T(b)
        s.cv.tube(s.C(a), s.C(b), ra, rb, ramp, z, part, cut=cut)

    def dot(s, p, ch, z, part, body=True):
        if body:
            p = s.T(p)
        c = s.C(p)
        s.cv.px(round(c[0]), round(c[1]), ch, z, part)

    def line(s, a, b, ch, z, part, body=True, only=None):
        """A 1 px line; 'only' limits it to pixels already painted with one of those parts."""
        if body:
            a, b = s.T(a), s.T(b)
        a, b = s.C(a), s.C(b)
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for i in range(n + 1):
            t = i / max(1, n)
            x, y = round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t)
            if 0 <= x < s.cv.W and 0 <= y < s.cv.H:
                if only is None or (s.cv.p[y][x] or '').split(':')[0] in only:
                    s.cv.px(x, y, ch, max(z, s.cv.z[y][x]), s.cv.p[y][x] if only else part)

    def grid(s, rows, at, anchor, z, part, body=True):
        if body:
            at = s.T(at)
        c = s.C(at)
        s.cv.grid(int(round(c[0] - anchor[0])), int(round(c[1] - anchor[1])), K.grid(rows) if isinstance(rows, str) else rows, z, part)

    def recolour(s, part, frm, to):
        for y in range(s.cv.H):
            for x in range(s.cv.W):
                if s.cv.p[y][x] == part and s.cv.c[y][x] in frm:
                    s.cv.c[y][x] = to[frm.index(s.cv.c[y][x])]


def plate(pen, root, tip, w, ramp, z, part, tip_len=3.0, tipramp=NAVY, R=1.6):
    """A stiff wing plate (a slat): straight parallel sides, a rounded end; the last tip_len px navy."""
    dx, dy = tip[0] - root[0], tip[1] - root[1]
    L = math.hypot(dx, dy) or 1e-9
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    def quad(a, b, w0, w1, rnd):
        pts = [(a[0] + nx * w0, a[1] + ny * w0), (b[0] + nx * w1, b[1] + ny * w1)]
        if rnd:
            pts.append((b[0] + ux * 1.0, b[1] + uy * 1.0))
        pts += [(b[0] - nx * w1, b[1] - ny * w1), (a[0] - nx * w0, a[1] - ny * w0)]
        return pts
    mid = (tip[0] - ux * tip_len, tip[1] - uy * tip_len)
    pen.poly(quad(root, mid, w, w, False), ramp, z, part, R=R, lift=0.2)
    pen.poly(quad(mid, tip, w, w * 0.8, True), tipramp, z + 0.01, part, R=R, lift=0.2)


FOOT = """
    ..oo.....
    .oOOOo...
    OOOOOOOO.
    rOrOrOrOr
"""


def leg(pen, hip, foot, near, z, lens=(6.0, 6.5), state='S'):
    """Steel leg: thigh strut, backward ankle joint, a shin piston in a sleeve, the orange paddle."""
    ramp = STEEL if near else STEEL_F
    hip = pen.T(hip)
    knee, end = K.rig.ik(hip, foot, lens[0], lens[1], -1)
    if knee[0] > hip[0] and knee[0] > end[0]:
        knee, end = K.rig.ik(hip, foot, lens[0], lens[1], 1)
    p = 'leg' + ('N' if near else 'F')
    pen.tube(hip, knee, 1.8, 1.4, ramp, z, p + ':t')
    # the shin: a thick sleeve on the upper half, the thinner bright piston rod below it
    m = (knee[0] + (end[0] - knee[0]) * 0.55, knee[1] + (end[1] - knee[1]) * 0.55)
    pen.tube(knee, m, 1.4, 1.3, ramp, z + 0.02, p + ':t')
    pen.tube(m, end, 0.8, 0.8, ['s', 's', 'S', 't'] if near else ['S', 'S', 't', 't'], z + 0.01, p + ':t')
    pen.tube(knee, knee, 1.5, 1.5, ['s', 'S', 't', 't'] if near else ['S', 't', 't', 'V'], z + 0.03, p + ':t')
    rows = K.grid(FOOT) if state == 'S' else K.grid(state)
    if not near:
        rows = [r.replace('o', 'O').replace('O', 'O') for r in rows]
    pen.grid(rows, end, (3, 1), z + 0.05, p + ':f', body=False)
    return end, knee


def bez(p0, p1, p2, p3, t):
    return SW.bez(p0, p1, p2, p3, t)


def neck(pen, c1, c2, head, z=4.0, r0=3.7, r1=2.3, base=SW.NECK_BASE, rings=5):
    """The ringed neck: ivory rings on a steel hose (steel gaps between the rings), a navy collar."""
    p0 = pen.T(base)
    N = 28
    pts = [bez(p0, c1, c2, head, i / N) for i in range(N + 1)]
    # arc length positions of the ring gaps
    acc = [0.0]
    for i in range(N):
        acc.append(acc[-1] + math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]))
    total = acc[-1]
    for i in range(N):
        ra = r0 + (r1 - r0) * (i / N)
        rb = r0 + (r1 - r0) * ((i + 1) / N)
        pen.tube(pts[i], pts[i + 1], ra, rb, IVORY, z + 0.001 * i, 'neck', cut=(0.42, -0.05, -0.45))
    # ring gaps: short steel bands across the neck (perpendicular to it)
    gaps = [total * (k + 1) / (rings + 1) for k in range(rings)]
    for gpos in gaps:
        i = max(0, min(N - 1, next(j for j in range(N) if acc[j + 1] >= gpos)))
        a, b = pts[i], pts[i + 1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1e-9
        nx, ny = -dy / L, dx / L
        r = r0 + (r1 - r0) * (i / N)
        for k in range(-8, 9):
            q = (a[0] + nx * k * r / 8, a[1] + ny * k * r / 8)
            c = pen.C(q)
            x, y = round(c[0]), round(c[1])
            if pen.cv.p[y][x] == 'neck':
                # lit side of the gap a little lighter than the shade side
                pen.cv.c[y][x] = 'C' if pen.cv.c[y][x] in 'ab' else 'E'
    # navy collar at the base with two gold rivets
    a, b = pts[0], pts[2]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-9
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    for s in (0.0, 0.7, 1.4):
        for k in range(-10, 11):
            q = (a[0] + ux * s + nx * k * r0 / 10, a[1] + uy * s + ny * k * r0 / 10)
            c = pen.C(q)
            x, y = round(c[0]), round(c[1])
            if pen.cv.p[y][x] in ('neck',):
                pen.cv.c[y][x] = 'n' if k < -3 else 'N'
    for k in (-0.45, 0.35):
        q = (a[0] + ux * 0.7 + nx * k * r0, a[1] + uy * 0.7 + ny * k * r0)
        c = pen.C(q)
        pen.cv.c[round(c[1])][round(c[0])] = 'G'
    return pts


def head(pen, at, ang, z=5.0, part='head'):
    """The dome head, the navy face patch with the lens eye, the orange beak with the steel muzzle."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    back = (at[0] - ux * 1.2, at[1] - uy * 1.2)
    front = (at[0] + ux * 1.0, at[1] + uy * 1.0)
    pen.tube(back, front, 3.1, 2.8, IVORY, z, part)
    vx, vy = -uy, ux                       # toward the chin
    # beak: from the face, 7 px, upper mandible 2 px, lower 1 px; the last px a steel muzzle ring
    b0 = (at[0] + ux * 2.2, at[1] + uy * 2.2)
    for i in range(8):
        c = (b0[0] + ux * i, b0[1] + uy * i)
        rows = [(-1.0, 'o'), (0.0, 'O'), (1.0, 'r')] if i < 3 else [(-0.6, 'o'), (0.4, 'O')] if i < 6 else [(-0.4, 'O'), (0.5, 'r')]
        for sft, ch in rows:
            if i >= 6:
                ch = 's' if sft < 0 else 'S'
            pen.dot((c[0] + vx * sft, c[1] + vy * sft), ch, z + 0.2, part + ':beak', body=False)
    tip = (b0[0] + ux * 8.0, b0[1] + uy * 8.0)
    pen.dot((tip[0] + vx * 0.0, tip[1] + vy * 0.0), 'V', z + 0.3, part + ':beak', body=False)
    # navy face patch: from the eye down to the beak base (the knob)
    for p in ((0.4, -0.6), (1.4, -0.4), (1.4, 0.6), (2.0, 0.0), (2.2, 1.0)):
        q = (at[0] + ux * p[0] + vx * p[1], at[1] + uy * p[0] + vy * p[1])
        pen.dot(q, 'N', z + 0.25, part, body=False)
    eye = (at[0] + ux * 0.7 - vx * 0.9, at[1] + uy * 0.7 - vy * 0.9)
    pen.dot(eye, 'L', z + 0.3, part, body=False)
    return tip


def handles(pen, z=1.4):
    """Two brass handle grips on short stalks in front of the seat (the far one darker)."""
    seat = SW.SEAT
    for g, ramp, zz in ((SW.GRIP_F, ('g', 'r'), z), (SW.GRIP_N, ('G', 'g'), z + 0.1)):
        gx, gy = seat[0] + g[0], seat[1] + g[1]
        y = gy + 2
        while y <= -25:
            pen.dot((gx, y), 't', zz, 'handle')
            y += 1
        for k in range(-2, 2):
            pen.dot((gx, gy + k), ramp[0], zz + 0.01, 'handle')
            pen.dot((gx + 1, gy + k), ramp[1], zz + 0.01, 'handle')


def seat_pad(pen, z=3.5):
    """The quilted navy seat pad on the deck (2 px high), with a lit top edge and quilt dimples."""
    pen.grid("""
        .nnnnnnnnnn.
        NNnNNnNNnNNN
    """, (-9, -27), (0, 0), z, 'seat')


def far_wing(pen, z=1.0, lift=0.0, kind='arch'):
    """The far wing: a covert plate from the shoulder over the wrist and a fan of slats behind the
    seat, the tips navy, all one shade darker (it is in the shade of the body)."""
    if kind == 'arch':
        sh, wr = (4, -25), (-10, -32 - lift)
        tips = [(-29, -35 - lift), (-29, -31.5 - lift), (-27, -28 - lift), (-23.5, -25.5 - lift)]
    else:                                   # 'up': raised high (flight)
        sh, wr = (4, -25), (-5, -38 - lift)
        tips = [(-24, -48 - lift), (-26, -44 - lift), (-27, -39.5 - lift), (-26, -35 - lift), (-23, -30.5 - lift)]
    n = len(tips)
    for i, tp in enumerate(tips):
        root = SW.lerp(wr, sh, 0.18 * i)
        plate(pen, root, tp, 1.6, IV_FAR, z + 0.01 * (n - i), 'wf:p%d' % i, tip_len=3.2)
    # covert plate on top: the arm from the shoulder to the wrist
    m = SW.lerp(sh, wr, 0.5)
    pen.poly([(sh[0] + 1, sh[1] - 1.5), (m[0], m[1] - 2.2), (wr[0], wr[1] - 1.8), (wr[0] - 3.5, wr[1] + 0.5),
              (wr[0] - 1, wr[1] + 3.5), (m[0] - 1, m[1] + 3.8), (sh[0] - 2, sh[1] + 2.5)], IV_FAR, z + 0.2, 'wf:c', R=2.6)
    return sh, wr


def near_wing(pen, z=6.0, lift=0.0):
    """The near wing folded flush on the flank: three slats whose navy tips cross over the tail, a big
    covert plate with a panel seam and rivets on top."""
    slats = [((3, -23.5), (-28, -23.5 - lift)), ((1, -21), (-26.5, -20.5 - lift * 0.8)), ((-1, -18.5), (-23, -17.5 - lift * 0.6))]
    for i, (r, t) in enumerate(slats):
        plate(pen, r, t, 1.7, IVORY, z + 0.02 * i, 'wn:p%d' % i, tip_len=3.5)
    cov = [(13, -21.5), (11, -24.5), (6, -25), (-6, -25), (-12, -24.5 - lift * 0.3), (-15, -22.5 - lift * 0.3),
           (-11, -19.5), (-2, -17.5), (7, -17.5), (11, -19)]
    pen.poly(cov, IVORY, z + 0.5, 'wn:c', R=3.2, cut=(0.74, 0.12, -0.25))
    # panel seam along the covert plate and its gold rivets
    pen.line((10, -20.5), (-11, -21.0), 'C', z + 0.6, 'wn:c', only=('wn',))
    for x in (8, 3, -2, -7):
        pen.dot((x, -23.2), 'G', z + 0.61, 'wn:c')


def tail(pen, z=2.0, lift=0.0):
    """Three upturned tail blades and a navy rudder fin."""
    base = (-19, -24)
    pen.poly([(-25, -30.5 - lift), (-28, -36 - lift), (-30.5, -35 - lift), (-29.5, -29.5 - lift)], NAVY, z - 0.1, 'fin', R=1.4)
    for i, tp in enumerate([(-29.5, -30.5 - lift), (-30.5, -28 - lift), (-29, -25.5 - lift)]):
        plate(pen, base, tp, 1.5, IVORY, z + 0.02 * i, 'tail:%d' % i, tip_len=0.01, tipramp=IVORY)


def hull(pen, z=3.0):
    pen.poly(SW.HULL, IVORY, z, 'body', R=6.0, cut=(0.76, 0.2, -0.2))
    # navy waterline stripe below the folded wing, gold rivets above it, the shaded keel band
    for y, ch in ((-15, 'n'), (-14, 'N')):
        pen.line((-21, y), (17.3, y), ch, z + 0.05, 'body', only=('body',))
    for x in range(-17, 17, 4):
        pen.dot((x, -15), 'G', z + 0.06, 'body')
    # bow: a panel seam and the two round jet vents
    pen.line((12.5, -24), (12.5, -16), 'C', z + 0.05, 'body', only=('body',))
    for x in (14.5, 16.5):
        pen.dot((x, -19), 'V', z + 0.06, 'body')
    # hull seams below the stripe
    for x in (-12, 0, 9):
        pen.dot((x, -12), 'C', z + 0.05, 'body')


def hip_bearing(pen, at, z):
    """A steel disc with a gold rivet at the near hip."""
    c = pen.T(at)
    pen.tube(c, c, 2.4, 2.4, ['s', 'S', 't', 't'], z, 'hip')
    pen.dot(c, 'G', z + 0.01, 'hip', body=False)


def build(pen, neck_pose, legs=None, far='arch', lift=0.0, extra=None, nw_lift=0.0):
    far_wing(pen, 1.0, lift, far)
    handles(pen)
    feet = {}
    if legs:
        (fF, sF), (fN, sN) = legs
        feet['F'] = leg(pen, SW.HIPS['F'], fF, False, 1.2, state=sF)
    tail(pen, 2.0, lift * 0.5)
    hull(pen, 3.0)
    seat_pad(pen, 3.5)
    if extra:
        extra(pen, 'mid')
    if legs:
        feet['N'] = leg(pen, SW.HIPS['N'], fN, True, 6.8, state=sN)
        hip_bearing(pen, (-1, -14), 6.9)
    near_wing(pen, 6.0, nw_lift)
    nk = neck_pose
    neck(pen, nk['c1'], nk['c2'], nk['head'], 4.0)
    tip = head(pen, nk['head'], nk['ang'], 5.0)
    if extra:
        extra(pen, 'front')
    return feet, tip


def despeckle(rows, letters='abCEnNsSt'):
    """Drop lone shading specks: a ramp pixel whose 4 neighbours hold 3 or 4 of one other tone takes
    that tone (rivets, the lens, the bore, the quilting and the web toes are not ramp specks)."""
    out = [list(r) for r in rows]
    h, w = len(rows), len(rows[0])
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = rows[y][x]
            if c not in letters:
                continue
            nb = [rows[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if c in nb:
                continue
            for t in sorted(set(nb)):
                if t in letters and nb.count(t) >= 3:
                    out[y][x] = t
    return [''.join(r) for r in out]


STAND = dict(c1=(25, -28), c2=(7, -37), head=(17, -44), ang=8)
STAND_LEGS = (((-6, -3), 'S'), ((4, -3), 'S'))


def frame():
    K.palette(PAL, dark=DARK)
    pen = Pen()
    build(pen, STAND, legs=STAND_LEGS)
    rows = despeckle(pen.cv.finish())
    return rows, pen.C((0, 0))
