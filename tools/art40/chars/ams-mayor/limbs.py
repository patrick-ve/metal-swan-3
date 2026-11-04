# MECHA HASLEMA: the limb pieces and her attack sequences (wave 6 stage 2). The strips follow the
# game's part split, all on the one shared anchor ((0, 0) = the floor point between her feet), drawn
# facing RIGHT:
#   legs              LEG_ROLES (23): stand, the stomp hop (half squat, squat, push-off, tuck, reach,
#                     land), the death (give, sit), the stagger (reel, brace) and a 12-frame walk.
#                     Every frame has the point `hip` (the pelvis): mayor.ts lowers the upper body
#                     by the hip's drop, so a squat really squats.
#   stamp-arm-<stage> ARM_ROLES (20) facing right + the same 20 PRE-MIRRORED (the GESLOTEN label
#                     always reads): the slam wind-up (dip, coil, rise in 5 steps, overshoot, the
#                     trembling hold), the 2-frame smear, the impact squash with the shock lines,
#                     the recoil and settle, the lift back to low.
#   stamp-arm-gone    the torn stump with sparking cut cables (2 frames).
#   arm-back          BACK_ROLES (24): rest behind the body, the chain flail whirled high / low in
#                     8 steps of 45 degrees (link smears), the wind-up, the release, the yank back
#                     and the catch.
#   lash              LASH_ROLES (6): the chain shooting out (a wave runs along it), the snap at full
#                     reach (a crack at the tip), the slack pull back. mayor.ts shows the last
#                     (lashLen + 4) px of the frame, so the tip weight always leads.
# The arms are 2-bone IK limbs of fixed length (no stretching), the stamp a rigid prop turned by a
# three-shear rotation about the fist (the label stays crisp at these small angles). Hitboxes are the
# game's own boxes in geometry.ts (decision D7): these are art numbers only.
import math

import art40 as X

from . import cv
from .cv import Layer, polymask, ellmask, sphere_l, pick, tube, ball, line, rivet, catmull, STEEL_CUTS
from .pal import NAVY, STEEL, JACK, WOOD, FX, step

STAMP_SHOULDER = (24, -97)
FAR_SHOULDER = (-24, -97)
UPPER, FORE = 32.0, 34.0          # the stamp arm's bones (shoulder-elbow, elbow-fist)
F_UPPER, F_FORE = 30.0, 32.0      # the far arm's bones
THIGH, SHIN = 20.0, 18.0          # hip-knee, knee-ankle
HANDLE = 44                       # fist (the knob) to the rubber face of the stamp
HEM = -17                         # the trouser hem row (the boot cuff shows below it)
HIPS = (-10, 8)                   # far / near hip x
STAND_HIP = -40

PIECE_WHY = 'a piece of the composed boss rig: the code picks the frame by role (named constants)'


def fr(L, pts=None, smear=False):
    """A finished piece -> a Frame on the shared anchor; pts in local coordinates."""
    rows, root = cv.to_rows(cv.finish(L, fx=FX))
    p = {k: (v[0] + root[0], v[1] + root[1]) for k, v in (pts or {}).items()}
    return X.Frame(rows, root, pts=p, smear=smear)


def fr_pic(pic, pts=None, smear=False):
    rows, root = cv.to_rows(pic)
    p = {k: (v[0] + root[0], v[1] + root[1]) for k, v in (pts or {}).items()}
    return X.Frame(rows, root, pts=p, smear=smear)


def ik(S, H, l1, l2, bend=1):
    """Two-bone IK: the elbow (knee) for root S and end H; bend +1 puts the joint on the clockwise
    side of S->H (y down: below a forward reach, in front of a raised one). Returns (E, H) with H
    pulled in when it is out of reach."""
    dx, dy = H[0] - S[0], H[1] - S[1]
    d = math.hypot(dx, dy) or 1e-6
    a = math.atan2(dy, dx)
    dd = max(abs(l1 - l2) + 0.01, min(l1 + l2 - 0.01, d))
    c = (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd)
    b = math.acos(max(-1.0, min(1.0, c)))
    ang = a + bend * b
    E = (S[0] + l1 * math.cos(ang), S[1] + l1 * math.sin(ang))
    if dd < d:
        H = (S[0] + dx / d * dd, S[1] + dy / d * dd)
    return E, H


def rotate_layer(T, cx, cy, deg):
    """Turn a layer about the integer point (cx, cy) by deg (positive = counter-clockwise on the
    screen) with three shears: every cell lands on exactly one cell (no holes, crisp edges)."""
    if not deg:
        return T
    th = -math.radians(deg)
    a, b = -math.tan(th / 2), math.sin(th)
    out = Layer(T.name)
    for (x, y), (ch, z, sub) in sorted(T.c.items()):
        rx, ry = x - cx, y - cy
        x1 = rx + round(a * ry)
        y2 = ry + round(b * x1)
        x3 = x1 + round(a * y2)
        out.c[(cx + x3, cy + y2)] = (ch, z, sub)
    return out


def merge(L, T):
    for (x, y), (ch, z, sub) in sorted(T.c.items()):
        L.put(x, y, ch, z, sub)


def hull(pts):
    """Convex hull (monotone chain), counter-clockwise."""
    P = sorted(set(pts))
    if len(P) < 3:
        return P

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in P:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


# --------------------------------------------------------------------------------------------- legs
def boot(L, ax, ground, z, sub, dk):
    """A heavy robot boot, toe to the right: a riveted steel cuff, the leather shaft, a steel toe cap
    with its glint, a thick treaded sole plate."""
    g = ground
    pts = [(ax - 6, g - 17), (ax + 6, g - 17), (ax + 7, g - 11), (ax + 12, g - 9), (ax + 16, g - 6), (ax + 17, g - 3),
           (ax - 7, g - 3), (ax - 7, g - 11)]
    m = polymask(pts)
    tc = (ax + 11.5, g - 5.5)
    for (x, y) in sorted(m):
        if y >= g - 3:
            continue
        if y <= g - 15:                                           # the cuff ring
            ch = pick(sphere_l(x, 0, ax + 0.5, 0, 7.5, 7.5), (0.9, 0.75, 0.55, 0.3), ['1', '2', '3', '4', '5'])
            if y == g - 15:
                ch = step(ch, 2)
        elif x > ax + 5 and ((x + 0.5 - tc[0]) / 6.5) ** 2 + ((y + 0.5 - tc[1]) / 4.6) ** 2 <= 1:
            ch = pick(sphere_l(x, y, tc[0], tc[1], 6.5, 4.6), STEEL_CUTS, STEEL)   # the toe cap
        else:
            nx = (x + 0.5 - ax) / 7.0
            ch = 'X' if nx > 0.15 else 'Y' if nx > -0.55 else 'Z'
            if y == g - 14:
                ch = 'Z'                                          # the shadow under the cuff
        L.put(x, y, step(ch, dk) if dk else ch, z, sub)
    if not dk:
        L.put(ax + 10, g - 9, '0', z + 0.01, sub)                 # the toe cap's glint
        L.put(ax + 11, g - 9, '1', z + 0.01, sub)
    for x in range(ax + 3, ax + 7):
        L.over(x, g - 10 + (x - ax - 3) // 2, 'Y' if dk else 'X')
    for x in range(ax - 6, ax + 6):
        L.over(x, g - 8, 'Z' if dk else 'Y')
    L.over(ax + 2, g - 9, '4' if dk else '2')
    L.over(ax + 2, g - 8, '5' if dk else '3')
    for rx in (ax - 4, ax + 1):
        if L.get(rx, g - 17) is not None:
            rivet(L, rx, g - 17)
    for x in range(ax - 8, ax + 18):
        for y, ch in ((g - 3, '3'), (g - 2, '5'), (g - 1, '6')):
            if y == g - 1 and (x - ax) % 3 == 0:
                ch = '7'
            if x == ax + 17 and y == g - 3:
                continue
            L.put(x, y, step(ch, dk) if dk else ch, z, sub)
    for x in range(ax - 8, ax - 2):
        L.over(x, g - 3, '2' if not dk else '4')


# The legs strip. Each role: (hip y, far ankle, near ankle) with the ankle = the boot's top centre
# (the sole is 6 px under it); None = a hand-placed pose (sit).
WALK_N = 12
WALK_STRIDE = 10.0      # px per step: the intro walks 0.625 px/tick, one footfall every 16 ticks
LEG_ROLES = ['STAND', 'AIR', 'LAND', 'SQUAT', 'SIT', 'REACH', 'GIVE', 'REEL', 'BRACE', 'HALF_SQUAT',
             'PUSH_OFF'] + [f'WALK{i}' for i in range(WALK_N)]
LEGS_WALK = LEG_ROLES.index('WALK0')
LEG_POSE = {
    'STAND': (-40, (-17, -6), (15, -6)),                # an A-stance: the feet apart, the knees soft
    # The fight's squats drop the hips at most 2 px: the upper body follows the hip (mayor.ts) and
    # her part hurtboxes do not (D7), so the drawn medallion, head and stamp stay on their boxes. The
    # squash reads in the knees: the ankles go wide, the knees bend out.
    'HALF_SQUAT': (-39, (-19, -6), (17, -6)),
    'SQUAT': (-38, (-21, -6), (19, -6)),
    'LAND': (-38, (-23, -6), (21, -6)),                 # the landing squash: knees far out, hips low
    'PUSH_OFF': (-42, (-13, -6), (11, -6)),             # hips up, the legs straight
    'AIR': (-41, (-15, -15), (12, -13)),                # tucked in the hop
    'REACH': (-42, (-14, -7), (11, -6)),                # reaching down for the landing
    'GIVE': (-30, (-16, -6), (14, -6)),                 # the knees give (the death sit)
    'REEL': (-38, (-21, -6), (19, -6)),                 # the stagger: braced wide
    'BRACE': (-39, (-20, -6), (18, -6)),
}


def walk_pose(i):
    """Walk frame i of 12 over 32 ticks (2 footfalls): the near foot lands on frame 5, the far one on
    frame 11 (mayor.ts thuds on ticks 15 and 31). The planted foot moves back WALK_STRIDE over the
    6 frames of its stance, exactly the body's travel, so it does not slide."""
    u = ((i - 5) % WALK_N) / WALK_N

    def foot(base, u):
        if u < 0.5:                                         # stance: planted, moving back
            return (base + WALK_STRIDE / 2 - WALK_STRIDE * (u / 0.5), -6.0)
        s = (u - 0.5) / 0.5                                 # swing: eased forward, lifted
        e = s * s * (3 - 2 * s)
        return (base - WALK_STRIDE / 2 + WALK_STRIDE * e, -6.0 - 5.0 * math.sin(math.pi * s))
    near = foot(12, u)
    far = foot(-14, (u + 0.5) % 1.0)
    hip = -40 - (1 if (u * 2) % 1.0 > 0.15 and (u * 2) % 1.0 < 0.65 else 0) + (1 if (u * 2) % 1.0 < 0.1 else 0)
    return hip, far, near


def leg_pose(role):
    if role.startswith('WALK'):
        return walk_pose(int(role[4:]))
    return LEG_POSE[role]


def leg_joints(role):
    """(far, near): each (hip, knee, ankle)."""
    if role == 'SIT':
        return ([(-6, -16), (14, -12), (34, -8)], [(2, -14), (22, -10), (42, -6)])
    hip, fa, na = leg_pose(role)
    out = []
    for hx, ank in ((HIPS[0], fa), (HIPS[1], na)):
        H = (hx, hip)
        K, A = ik(H, ank, THIGH, SHIN, bend=-1)              # the knee forward
        out.append([H, K, A])
    return out[0], out[1]


def legs(f=0):
    role = LEG_ROLES[f] if isinstance(f, int) else f
    L = Layer('legs')
    far, near = leg_joints(role)
    hipY = min(far[0][1], near[0][1])
    if role == 'SIT':
        hipY = -40
    # the seat of the trousers (the jacket hem covers its top); it follows the hips
    sd = hipY + 40 if role != 'SIT' else 24
    seat = polymask([(-17, -48 + sd), (15, -48 + sd), (15, -41 + sd), (4, -35 + sd), (-4, -35 + sd), (-17, -41 + sd)])
    for (x, y) in sorted(seat):
        L.put(x, y, NAVY[2] if x > -2 else NAVY[3], 2.4, 'seat')
    for (hip, knee, ank), z, sub, dk in ((far, 2.0, 'legF', 1), (near, 3.0, 'legN', 0)):
        ramp = NAVY[dk:] + [NAVY[-1]] * dk
        hem = HEM + (ank[1] + 6)
        T = Layer('t')
        tube(T, hip, knee, 7.5, 6.6, ramp, z, sub, cuts=(0.80, 0.55, 0.25, -0.05))
        tube(T, knee, (ank[0], hem), 6.6, 6.2, ramp, z + 0.1, sub, cuts=(0.80, 0.55, 0.25, -0.05))
        for (x, y), (ch, zz, s) in sorted(T.c.items()):
            if y <= hem:
                L.put(x, y, ch if y < hem else step(ch, 1), zz, s)
        # the pressed crease down the front of the leg
        for (x, y) in line(Layer('t'), [(hip[0] + 3, hip[1] + 4), (knee[0] + 3, knee[1]), (ank[0] + 3, hem - 1)], 'x', 0, ''):
            if L.sub(x, y) == sub:
                L.over(x, y, step(L.get(x, y), -1))
                if L.sub(x + 1, y) == sub:
                    L.over(x + 1, y, step(L.get(x + 1, y), 1))
        # a bent knee pulls a fold across the back of the knee
        bendk = abs((knee[0] - hip[0]) * (ank[1] - knee[1]) - (knee[1] - hip[1]) * (ank[0] - knee[0]))
        if bendk > 90:
            for d in (-2, -1, 0, 1):
                x, y = math.floor(knee[0] - 4), math.floor(knee[1] + d)
                if L.sub(x, y) == sub:
                    L.over(x, y, step(L.get(x, y), 1))
        ball(L, knee[0] + 0.5, knee[1] + 0.5, 3.4, STEEL, z + 0.3, sub + 'K', spec='0' if not dk else None, dk=dk)
        L.put(math.floor(knee[0]), math.floor(knee[1]), '6' if not dk else '7', z + 0.31, sub + 'K')
        boot(L, round(ank[0]), round(ank[1]) + 5, z - 0.05 + 0.5, sub + 'B', dk)   # the sole's outline on row -1
    return L


def hip_point(role):
    if role == 'SIT':
        return (-1, -16)
    hip, _, _ = leg_pose(role)
    return (-1, round(hip))


# ---------------------------------------------------------------------------------------- the arms
def sleeve_pat(far, ln=None):
    """The sleeve cloth: the jacket's sparse, irregular boucle knots (2 px ticks one tone down,
    hashed so they never line up in a grid) and, with the tube length ln, two creases where the
    cloth bunches at the elbow (a dark fold line with a lit lip above it)."""
    def pat(u, v, ch, l):
        k = JACK.index(ch)
        if far:
            k = min(5, k + 1)
        iu, iv = int(u), int(v + 10)
        if k <= 2 and (iu * 7 + iv * 13 + (iu // 2) * 5) % 17 in (0, 1) and (iu // 2 + iv) % 3 != 0:
            k += 1                                      # boucle knots that follow the sleeve
        if ln is not None and abs(v) < 4.2:
            for c in (ln - 3.5, ln - 7.0):              # the elbow creases (bent diagonally)
                d = u - (c + 0.45 * v)
                if 0 <= d < 1:
                    k = min(5, k + 2)
                elif -1 <= d < 0 and k > 0:
                    k -= 1
        return JACK[k]
    return pat


def forearm(L, E, H, z, sub, dk=0, stage=0):
    """The steel forearm: two riveted armour plates over a hydraulic piston, cables at the wrist."""
    dx, dy = H[0] - E[0], H[1] - E[1]
    ln = math.hypot(dx, dy) or 1
    ux, uy = dx / ln, dy / ln
    px, py = -uy, ux
    side = 1 if py > 0 or (py == 0 and px > 0) else -1
    ramp = ['1', '2', '4', '5', '6'][dk:dk + 4]
    W = Layer('t')
    tube(W, E, (E[0] + dx * 0.86, E[1] + dy * 0.86), 4.2, 3.6, ramp, z, sub, cuts=(0.82, 0.52, 0.18))
    for (x, y), v in sorted(W.c.items()):
        u = ((x + 0.5 - E[0]) * ux + (y + 0.5 - E[1]) * uy) / ln
        ch = v[0]
        if abs(u - 0.42) < 0.04 or abs(u - 0.74) < 0.04:
            ch = '6' if dk else '5'
        elif abs(u - 0.47) < 0.03 or abs(u - 0.79) < 0.03:
            ch = step(ch, -1)
        if stage >= 2 and 0.5 < u < 0.72:
            ch = '7' if (x + y) % 3 else 'T'
        L.put(x, y, ch, v[1], v[2])
    a = (E[0] + px * 4.0 * side + ux * 3, E[1] + py * 4.0 * side + uy * 3)
    mid = (a[0] + dx * 0.4, a[1] + dy * 0.4)
    end = (a[0] + dx * 0.78, a[1] + dy * 0.78)
    tube(L, a, mid, 1.9, 1.9, ['4', '5', '6', '7'] if not dk else ['5', '6', '7', '7'], z + 0.6, sub + 'P', cuts=(0.7, 0.3, -0.1))
    tube(L, mid, end, 1.0, 1.0, ['0', '2', '4'] if not dk else ['2', '4', '5'], z + 0.55, sub + 'R', cuts=(0.75, 0.3))
    for t in (0.25, 0.62):
        cx, cy = E[0] + dx * t - px * 1.5 * side, E[1] + dy * t - py * 1.5 * side
        if L.sub(math.floor(cx), math.floor(cy)) == sub:
            rivet(L, math.floor(cx), math.floor(cy))
    for i, ch in enumerate(('S', 'i', 'q')):
        t = 0.88 + 0.03 * i
        for s in (-2, 0, 2):
            x, y = E[0] + dx * t + px * (s + i - 1) * 0.8, E[1] + dy * t + py * (s + i - 1) * 0.8
            L.put(math.floor(x), math.floor(y), ch if s != 2 else step(ch, 1), z - 0.1, sub + ':cable')
    return a


FIST = [
    '.2221.',
    '211110',
    '211223',
    '322334',
    '334445',
    '.4455.',
]


def fist(L, H, z, sub, dk=0, flip=False):
    hx, hy = math.floor(H[0]), math.floor(H[1])
    for j, r in enumerate(FIST):
        for i, ch in enumerate(r):
            if ch != '.':
                c = step(ch, dk) if dk else ch
                L.put(hx - 3 + (5 - i if flip else i), hy - 3 + j, c, z, sub)
    for j in (1, 3):
        L.over(hx - 2 + (0 if not flip else 3), hy - 3 + j + 1, step(L.get(hx - 2, hy - 2 + j) or '3', 1))


FONT = {
    'G': ['.##', '#..', '#.#', '#.#', '.##'],
    'E': ['###', '#..', '##.', '#..', '###'],
    'S': ['.##', '#..', '.#.', '..#', '##.'],
    'L': ['#..', '#..', '#..', '#..', '###'],
    'O': ['.#.', '#.#', '#.#', '#.#', '.#.'],
    'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'N': ['#..#', '##.#', '#.##', '#..#', '#..#'],
}


def stamp(L, H, bottom, z, mirror_text, stage=0, squash=0):
    """The GESLOTEN stamp hanging from the fist: the knob, the turned handle with a steel ferrule, the
    bevelled block with wood grain, the paper label, the crimson rubber. squash > 0: the impact (the
    block lands squashed by that many rows and 1 px wider each side, the rubber bulges)."""
    hx, hy = H
    by = bottom - 20 + squash
    wide = 2 if squash else 0
    bx0, bx1 = hx - 22 - wide, hx + 22 + wide
    ball(L, hx + 0.5, hy + 0.5, 4.2, WOOD, 13.8, 'knob', cuts=(0.75, 0.42, 0.1))
    for y in range(hy + 3, by - 2):
        for x in range(hx - 2, hx + 3):
            k = 0 if x == hx + 1 else 1 if x >= hx - 1 else 2
            if (y - hy) % 7 == 0:
                k = min(3, k + 1)
            L.put(x, y, WOOD[k], z - 0.2, 'handle')
    for y, row in ((by - 2, ('2', '1', '0', '2', '3', '4', '5')), (by - 1, ('4', '3', '2', '3', '4', '5', '6'))):
        for i, ch in enumerate(row):
            L.put(hx - 3 + i, y, ch, z - 0.1, 'ferrule')
    for y in range(by, bottom - 3):
        for x in range(bx0, bx1 + 1):
            if (x, y) in ((bx0, by), (bx1, by)):
                continue
            if y == by:
                ch = 'l'
            elif y == by + 1:
                ch = 'l' if x > bx0 + 2 else 'm'
            elif x >= bx1 - 1:
                ch = 'n' if x == bx1 - 1 else 'o'
            elif x == bx0:
                ch = 'm'
            elif y >= bottom - 5:
                ch = 'o' if y == bottom - 4 else 'n'
            else:
                ch = 'm'
                if (x * 3 + y * 7) % 11 == 0 or (y - by) % 5 == 3 and (x // 4) % 3 == 0:
                    ch = 'n'
            L.put(x, y, ch, z, 'block')
    lx0, ly0, lw, lh = bx0 + 3 + wide, by + (4 if not squash else 2), (bx1 - bx0) - 5 - 2 * wide, 9
    for y in range(ly0, ly0 + lh):
        for x in range(lx0, lx0 + lw):
            ch = 'A' if y < ly0 + lh - 1 and x < lx0 + lw - 1 else 'C'
            if y == ly0:
                ch = 'B'
            L.put(x, y, ch, z + 0.1, 'label')
    for x in range(lx0 + 1, lx0 + lw + 1):
        L.over(x, ly0 + lh, 'o')
    text = 'GESLOTEN'
    tw = sum(len(FONT[c][0]) for c in text) + len(text) - 1
    if mirror_text:
        x = lx0 + (lw - tw) // 2 + tw - 1
        for c in text:
            g = FONT[c]
            for j, r in enumerate(g):
                for i, ch in enumerate(r):
                    if ch == '#':
                        L.put(x - i, ly0 + 2 + j, 'T', z + 0.2, 'label')
            x -= len(g[0]) + 1
    else:
        x = lx0 + (lw - tw) // 2
        for c in text:
            g = FONT[c]
            for j, r in enumerate(g):
                for i, ch in enumerate(r):
                    if ch == '#':
                        L.put(x + i, ly0 + 2 + j, 'T', z + 0.2, 'label')
            x += len(g[0]) + 1
    for y, ch in ((bottom - 3, 'R'), (bottom - 2, 'S'), (bottom - 1, 'U')):
        for x in range(bx0 + 1 - wide, bx1 + wide):
            L.put(x, y, 'T' if (ch == 'R' and x > bx1 - 4) else ch, z - 0.05, 'rubber')
    if stage >= 1:
        for (x, y) in sorted(ellmask(bx1 - 6.5, by + 3.5, 5.5, 3.2)):
            if L.sub(x, y) in ('block', 'label'):
                inner = ((x + 0.5 - (bx1 - 6.5)) / 5.5) ** 2 + ((y + 0.5 - (by + 3.5)) / 3.2) ** 2 < 0.45
                L.over(x, y, '9' if stage >= 2 or inner else '8')
        # a dent knocked out of the block's top right corner (the bare wood inside), a crack under it
        for (x, y) in ((bx1, by + 1), (bx1 - 1, by), (bx1, by + 2), (bx1 - 2, by), (bx1 - 1, by + 1)):
            L.erase(x, y)
        for (x, y) in ((bx1 - 1, by + 2), (bx1 - 2, by + 1), (bx1, by + 3), (bx1 - 3, by)):
            if L.sub(x, y) == 'block':
                L.over(x, y, 'l')
        for (x, y) in line(Layer('t'), [(bx1 - 2, by + 3), (bx1 - 4, by + 7), (bx1 - 3, by + 11)], 'x', 0, ''):
            if L.sub(x, y) in ('block', 'label'):
                L.over(x, y, 'o')
        if stage >= 2:                                    # a split in the block, a chipped corner
            for (x, y) in line(Layer('t'), [(bx0 + 6, by + 1), (bx0 + 8, by + 5), (bx0 + 7, by + 9)], 'x', 0, ''):
                if L.sub(x, y) in ('block', 'label'):
                    L.over(x, y, 'o')
            for (x, y) in ((bx0 + 1, by), (bx0 + 2, by), (bx0 + 1, by + 1)):
                L.erase(x, y)


def smear_block(L, a, b, z, taper=0.3):
    """The block's silhouette swept from bottom-centre a to b: a tapered streak in the wood tones,
    its lines running along the motion (the leading end is the real block, drawn over it), the
    crimson of the rubber dragged along its leading edge."""
    ca = [(a[0] - 22 * taper, a[1] - 20 * taper), (a[0] + 22 * taper, a[1] - 20 * taper),
          (a[0] + 22 * taper, a[1] - 3), (a[0] - 22 * taper, a[1] - 3)]
    cb = [(b[0] - 22, b[1] - 20), (b[0] + 23, b[1] - 20), (b[0] + 23, b[1]), (b[0] - 22, b[1])]
    m = polymask(hull(ca + cb))
    mx, my = b[0] - a[0], b[1] - a[1]
    ml = math.hypot(mx, my) or 1
    px, py = -my / ml, mx / ml
    for (x, y) in sorted(m):
        v = (x + 0.5 - b[0]) * px + (y + 0.5 - b[1] + 10) * py
        u = ((x + 0.5 - a[0]) * mx + (y + 0.5 - a[1]) * my) / (ml * ml)
        # across the streak: lit edge, body, a mid line, the shaded edge (the width shrinks
        # toward the tail with the taper)
        w = 22 * (taper + (1 - taper) * max(0.0, min(1.0, u)))
        vv = v / max(1.0, w)
        ch = 'l' if vv < -0.72 else 'n' if vv > 0.72 else 'l' if abs(vv - 0.1) < 0.08 else 'm'
        L.put(x, y, ch, z - 3.0, 'smear')


def shock(L, x0, x1, big=True):
    """The impact: shock lines along the floor out of both ends of the block (two rows, white hot at
    the block, cooling outward), strokes up from its corners, dust spat out sideways (the shared FX
    ramp: no outline). big=False: the small echo of the recoil."""
    ramp = (('+', 4), ('*', 5), ('^', 4), ('~', 3)) if big else (('*', 3), ('^', 3))
    off = 0
    for ch, n in ramp:
        for k in range(n):
            for (x, d) in ((x0 - 2, -1), (x1 + 2, 1)):
                L.put(x + d * (off + k), -1, ch, 30, 'fx')
                if big and off + k < 9:
                    L.put(x + d * (off + k + 1), -2, ch, 30, 'fx')
        off += n
    n = 5 if big else 3
    for k in range(n):
        for (x, d) in ((x0 - 1, -1), (x1 + 1, 1)):
            ch = '+' if k < 2 else '*' if k < 4 else '^'
            L.put(x + d * k, -4 - 2 * k, ch, 30, 'fx')
            L.put(x + d * k, -5 - 2 * k, ch, 30, 'fx')
            if big:
                L.put(x + d * (k + 1), -4 - 2 * k, ch, 30, 'fx')
    if big:
        for (x, d) in ((x0 + 3, -1), (x1 - 3, 1)):
            for k in range(4):
                L.put(x + d * k, -27 - 3 * k, '*' if k < 2 else '^', 30, 'fx')
                L.put(x + d * k, -28 - 3 * k, '+' if k < 2 else '*', 30, 'fx')
        for (cx, d) in ((x0 - 8, -1), (x1 + 8, 1)):            # the dust spat out
            for (dx, dy, ch) in ((0, -4, '8'), (1, -4, '8'), (2 * d, -5, '8'), (d, -5, '9'), (0, -5, '8'),
                                 (3 * d, -3, '8'), (-d, -3, '8'), (0, -3, '9'), (d, -3, '8'), (2 * d, -3, '8')):
                L.put(cx + dx, dy, ch, 29, 'fx')


def steam(L, x, y, k=0):
    """A small puff of hydraulic steam (FX ramp)."""
    for (dx, dy, ch) in ((0, 0, '='), (1, 0, '+'), (-1, -1, '='), (0, -1, '+'), (1, -1, '+'), (2, -1, '='),
                         (0, -2, '='), (1, -2, '+'), (2 + k, -3, '='), (1 + k, -3, '-')):
        L.put(x + dx, y + dy, ch, 30, 'fx')


# The stamp arm roles: (fist, tilt in degrees (+ = cocked back, the rubber facing forward), squash,
# extra). Roles 0-5 keep the game's old meanings.
ARM_ROLES = ['LOW', 'RAISED', 'SLAM', 'ANTICIPATION', 'SMEAR', 'RECOIL', 'COIL', 'RISE_A', 'RISE_B',
             'OVERSHOOT', 'TREMBLE', 'SMEAR_LOW', 'IMPACT', 'SETTLE', 'LIFT', 'LOWER', 'SAG',
             'RISE_LOW', 'RISE_MID', 'RISE_HIGH']
ARM_POSE = {
    'LOW': ((54, -58), 0, 0),              # idle: the stamp at her hip, ready
    'ANTICIPATION': ((49, -52), -7, 0),    # the dip: it sinks and the front end drops
    'COIL': ((42, -55), -12, 0),           # pulled back against her hip, the elbow out behind
    'RISE_LOW': ((53, -69), -2, 0),        # the raise in seven steps along the arc (in-betweens:
    'RISE_A': ((62, -84), 8, 0),           #   about 16 px each), swinging up in front
    'RISE_MID': ((65, -100), 12, 0),
    'RISE_B': ((66, -115), 16, 0),
    'RISE_HIGH': ((63, -132), 21, 0),
    'OVERSHOOT': ((58, -147), 26, 0),      # the top of the swing: highest, cocked furthest back
    'RAISED': ((62, -139), 19, 0),         # the hold (the telegraph)
    'TREMBLE': ((63, -138), 16, 0),        # the hold's other frame: straining, steam from the piston
    'SMEAR': ((73, -106), 5, 0),           # the swing down (smear 1)
    'SMEAR_LOW': ((63, -66), -3, 0),       # just above the floor (smear 2)
    'IMPACT': ((57, -40), 0, 4),           # the slam: squashed, the shock lines
    'SLAM': ((57, -44), 0, 0),             # on the floor
    'RECOIL': ((58, -53), -5, 0),          # the bounce
    'SETTLE': ((57, -47), 2, 0),           # back down, the last wobble
    'LIFT': ((53, -54), -9, 0),            # dragged up off the floor
    'LOWER': ((53, -62), 4, 0),            # a little past low, then it settles
    'SAG': ((57, -69), -6, 0),             # the death: she sits (24 px down), the stamp comes to rest on the floor
}
SMEAR_FROM = {'SMEAR': 'RAISED', 'SMEAR_LOW': 'SMEAR'}


def stamp_arm(pose=0, stage=0, mirror_text=False):
    """The stamp arm in role ARM_ROLES[pose] (an int, or the role name)."""
    role = ARM_ROLES[pose] if isinstance(pose, int) else pose
    H0, tilt, squash = ARM_POSE[role]
    S = STAMP_SHOULDER
    E, H = ik(S, H0, UPPER, FORE, bend=1)
    hx, hy = round(H[0]), round(H[1])
    L = Layer('stamp-arm')
    T = Layer('stamp')
    stamp(T, (hx, hy), hy + HANDLE - 1 - squash, 15.0, mirror_text, stage, squash)   # the outline row lands on -1
    if role in SMEAR_FROM:
        (ax, ay), _, _ = ARM_POSE[SMEAR_FROM[role]]
        smear_block(T, (ax, ay + HANDLE - 1), (hx, hy + HANDLE - 1), 15.0)
    merge(L, rotate_layer(T, hx, hy, tilt))
    tube(L, S, E, 6.8, 5.6, JACK, 12.0, 'sleeve', cuts=(0.82, 0.62, 0.38, 0.12, -0.15), pat=sleeve_pat(False, math.hypot(E[0] - S[0], E[1] - S[1])))
    ex, ey = E
    sx, sy = S
    ln = math.hypot(ex - sx, ey - sy)
    ux, uy = (ex - sx) / ln, (ey - sy) / ln
    for d in (-2, -1, 0, 1, 2):
        x, y = math.floor(ex - ux * 5.5 - uy * d), math.floor(ey - uy * 5.5 + ux * d)
        if L.sub(x, y) == 'sleeve':
            L.over(x, y, 'B' if d < 0 else 'D')
    for d in (2, 3):
        x, y = math.floor(ex - ux * 9 + uy * d), math.floor(ey - uy * 9 - ux * d)
        if L.sub(x, y) == 'sleeve':
            L.over(x, y, 'E')
    if stage >= 1:                                         # soot on the sleeve, a burst seam; a tear at stage 2
        cx, cy = sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55
        for (x, y) in sorted(ellmask(cx, cy, 3.4, 2.6)):
            if L.sub(x, y) == 'sleeve':
                L.over(x, y, '9' if stage >= 2 and (x + y) % 2 else '8')
        # the seam along the sleeve's back burst open: the steel shows through a 2 px slit
        for k in range(4, 11 if stage >= 2 else 8):
            u = k / 14
            x, y = math.floor(sx + (ex - sx) * u + uy * 2.5), math.floor(sy + (ey - sy) * u - ux * 2.5)
            for (qx, qy, ch) in ((x, y, '6'), (x + (1 if uy > 0 else -1), y, '4' if k % 3 == 0 else '7')):
                if L.sub(qx, qy) == 'sleeve':
                    L.over(qx, qy, ch)
    piston = forearm(L, E, (hx, hy), 12.6, 'fore', stage=stage)
    ball(L, ex + 0.5, ey + 0.5, 4.6, STEEL, 13.4, 'elbow', spec='0', cuts=(0.88, 0.7, 0.45, 0.15, -0.2))
    L.put(math.floor(ex), math.floor(ey), '5', 13.41, 'elbow')
    L.put(math.floor(ex) + 1, math.floor(ey), '6', 13.41, 'elbow')
    if stage >= 2:                                         # the elbow joint shorts out: it glows hot inside
        for (dx, dy, ch) in ((-1, -2, '*'), (0, -2, '+'), (-2, -1, '^'), (-1, -1, '*'), (0, -1, '*'),
                             (-2, 0, '~'), (-1, 0, '^')):
            x, y = math.floor(ex) + dx, math.floor(ey) + dy
            if L.sub(x, y) == 'elbow':
                L.over(x, y, ch)
    fist(L, (hx, hy), 14.0, 'fist')
    if role == 'TREMBLE':
        steam(L, math.floor(piston[0]) - 2, math.floor(piston[1]) - 3)
    if role == 'IMPACT':
        shock(L, hx - 26, hx + 26)
    if role == 'RECOIL':
        shock(L, hx - 25, hx + 25, big=False)
    return L


def stump(k=0, stage=2):
    """stamp-arm-gone: the shoulder with a torn sleeve stub, a broken steel stub, cut cables that
    spark (k: 0 / 1, the cables sway and the spark flickers)."""
    L = Layer('stump')
    S = STAMP_SHOULDER
    E = (S[0] + 7, S[1] + 13)
    tube(L, S, E, 6.8, 6.2, JACK, 12.0, 'sleeve', cuts=(0.82, 0.62, 0.38, 0.12, -0.15), pat=sleeve_pat(False, math.hypot(E[0] - S[0], E[1] - S[1])))
    # the torn hem: a ragged edge, the lining dark inside
    for (x, y), v in sorted(list(L.c.items())):
        rel = (x + 0.5 - S[0]) * 7 / 14.8 + (y + 0.5 - S[1]) * 13 / 14.8
        cut = 11.5 + (2 if (x * 7) % 5 < 2 else 0) - (1 if (x * 3) % 4 == 0 else 0)
        if rel > cut:
            L.erase(x, y)
        elif rel > cut - 1.5:
            L.over(x, y, 'F')
    # the steel stub: a cracked ball joint
    ball(L, E[0] - 1 + 0.5, E[1] - 1 + 0.5, 3.8, STEEL, 11.5, 'stub', spec='0')
    L.put(E[0] - 1, E[1] - 1, '7', 11.6, 'stub')
    L.put(E[0], E[1] + 1, '7', 11.6, 'stub')
    # the cut cables (red, gold, blue) hanging out of it, swaying
    sway = (0, 1)[k]
    for i, (ch, dk) in enumerate((('S', 'U'), ('i', 'k'), ('q', 'r'))):
        x0, y0 = E[0] - 2 + i * 2, E[1] + 2
        pts = [(x0, y0), (x0 + (i - 1) + sway, y0 + 4), (x0 + (i - 1) * 2 + sway * (1 + i % 2), y0 + 7 + i)]
        for (x, y) in line(Layer('t'), [tuple(map(round, p)) for p in pts], 'x', 0, ''):
            L.put(x, y, ch, 11.2, 'cable%d' % i)
            L.put(x + 1, y, dk, 11.1, 'cable%d' % i)
    # the spark at the red cable's end
    tip = (E[0] - 3 + sway, E[1] + 9)
    if k == 0:
        for (dx, dy, ch) in ((0, 0, '+'), (1, 0, '*'), (-1, 0, '*'), (0, 1, '*'), (0, -1, '+'), (2, -1, '^'), (-2, 1, '^'),
                             (1, 2, '^')):
            L.put(tip[0] + dx, tip[1] + dy, ch, 30, 'fx')
    else:
        for (dx, dy, ch) in ((0, 1, '*'), (1, 2, '^'), (-1, 3, '~')):
            L.put(tip[0] + dx, tip[1] + dy, ch, 30, 'fx')
    return L


# --------------------------------------------------------------------------------- the chain flail
RING = [(0, 0, 'g'), (1, 0, 'h'), (2, 0, 'i'), (0, 1, 'h'), (2, 1, 'j'), (0, 2, 'i'), (1, 2, 'j'), (2, 2, 'k'), (1, 1, 'k')]

WEIGHT = [
    '.hhhhh.',
    'hgRRSSi',
    'hRSSSTj',
    'hSS0TTj',
    'iSTTTUj',
    '.jTTUj.',
    '..jUj..',
    '...k...',
]


def chain_curve(L, pts, z, sub, phase=0, dim=0):
    """Gold links along a dense centre line: a lit ring face-on every other link, an edge-on link
    between (one step darker when dim)."""
    out, acc, last = [pts[0]], 0.0, pts[0]
    for p in pts[1:]:
        acc += math.hypot(p[0] - last[0], p[1] - last[1])
        last = p
        if acc >= 2.0:
            out.append(p)
            acc = 0.0
    for i, (x, y) in enumerate(out):
        x0, y0 = math.floor(x) - 1, math.floor(y) - 1
        if (i + phase) % 2 == 0:
            for (dx, dy, ch) in RING:
                L.put(x0 + dx, y0 + dy, step(ch, dim) if dim else ch, z + 0.1, sub)
        else:
            for (dx, dy, ch) in ((1, 0, 'i'), (1, 1, 'j'), (1, 2, 'k')):
                L.put(x0 + dx, y0 + dy, step(ch, dim) if dim else ch, z, sub)
    return out


def weight(L, cx, cy, z, sub='weight'):
    for j, r in enumerate(WEIGHT):
        for i, ch in enumerate(r):
            if ch != '.':
                L.put(cx - 3 + i, cy - 3 + j, ch, z, sub)


def smear_arc(L, c, r, a0, a1, z, sub='arc'):
    """A link smear: the arc the weight swept (a0 -> a1, radians), 2 px wide near the weight and
    breaking into a thin trail behind it."""
    n = 18
    for i in range(n + 1):
        t = i / n
        a = a0 + (a1 - a0) * t
        x, y = c[0] + r * math.cos(a), c[1] + r * math.sin(a)
        ch = 'h' if t > 0.7 else 'i' if t > 0.35 else 'j'
        if t < 0.35 and i % 2:
            continue
        L.put(math.floor(x), math.floor(y), ch, z, sub)
        if t > 0.45:
            L.put(math.floor(x - 0.6 * math.cos(a)), math.floor(y - 0.6 * math.sin(a)), step(ch, 1), z - 0.01, sub)


def far_arm(L, E, H, z, dk=0):
    S = FAR_SHOULDER
    tube(L, S, E, 6.0, 5.2, JACK, z, 'sleeveF', cuts=(0.82, 0.62, 0.38, 0.12, -0.15), pat=sleeve_pat(dk > 0, math.hypot(E[0] - S[0], E[1] - S[1])))
    forearm(L, E, H, z + 0.6, 'foreF', dk=dk)
    ball(L, E[0] + 0.5, E[1] + 0.5, 4.0, STEEL, z + 1.6, 'elbowF', dk=dk, cuts=(0.88, 0.7, 0.45, 0.15, -0.2))
    fist(L, H, z + 2.2, 'fistF', dk=dk, flip=True)


# the whirl. HIGH: the far arm raised at the back of her head, the weight orbiting an ellipse over
# the wig (a lasso seen from the side: the far half one step darker). LOW: the far arm down at her
# back hip swinging the flail in an underhand windmill (drawn behind the body, as the rest arm).
LASH_LANE_Y = {'HIGH': -30, 'LOW': -7}       # geometry.ts whip lanes: the centre of high [22, 38], low [0, 14]
LASH_ROOT_X = 28
WHIRL_BEHIND = ('LOW', 'WIND_LOW')           # + every WHIRL_LOW_* frame: mayor.ts draws them behind the body


def whirl_frame(lane, p):
    """The chain flail at step p of 8 (45 degrees each): the fist circles a little ahead of the
    weight, the chain bows back against the turn, a link smear trails the weight."""
    L = Layer('arm-back')
    if lane == 'HIGH':
        th = p * math.pi / 4 + math.pi / 2                  # p 0: the weight in front, nearest
        # the lasso circles at the crown of the wig, not over it: the whole circle stays at most
        # 168 px over the floor point (the Stopera view is 176 px tall over her floor)
        H = (-21 + 2 * math.cos(th + 0.9), -146 + math.sin(th + 0.9))
        E, H = ik(FAR_SHOULDER, H, F_UPPER, F_FORE, bend=-1)
        far_arm(L, E, H, 16.0)
        C, rx, ry = (H[0] + 10, H[1] - 12), 24.0, 7.0
        W = (C[0] + rx * math.cos(th), C[1] + ry * math.sin(th))
        near = math.sin(th) > -0.2
        mid = ((H[0] + W[0]) / 2 - 3 * math.cos(th + math.pi / 2), (H[1] + W[1]) / 2 - 3)
        chain_curve(L, catmull([H, mid, W], 0.25), 18.5 if near else 15.0, 'flail', phase=p, dim=0 if near else 1)
        for i in range(14):                                 # the link smear along the ellipse
            t = i / 13
            a = th - 1.3 + 1.05 * t
            x, y = C[0] + rx * math.cos(a), C[1] + ry * math.sin(a)
            ch = 'h' if t > 0.7 else 'i' if t > 0.35 else 'j'
            if t < 0.35 and i % 2:
                continue
            L.put(math.floor(x), math.floor(y), ch if math.sin(a) > -0.2 else step(ch, 1), 18.4, 'arc')
        weight(L, math.floor(W[0]), math.floor(W[1]), 19.0 if near else 15.2)
        return L
    th = math.pi / 2 - p * math.pi / 4                      # p 0: the weight at the bottom, sweeping forward
    H = (-40 + 2 * math.cos(th - 0.9), -62 + 2 * math.sin(th - 0.9))
    E, H = ik(FAR_SHOULDER, H, F_UPPER, F_FORE, bend=-1)
    far_arm(L, E, H, 1.0, dk=1)
    R = 17.0
    W = (H[0] + R * math.cos(th), H[1] + R * math.sin(th))
    mid = ((H[0] + W[0]) / 2 + 4 * math.cos(th + math.pi / 2), (H[1] + W[1]) / 2 + 4 * math.sin(th + math.pi / 2))
    chain_curve(L, catmull([H, mid, W], 0.25), 3.5, 'flail', phase=p)
    smear_arc(L, H, R, th + 1.25, th + 0.25, 3.4)
    weight(L, math.floor(W[0]), math.floor(W[1]), 4.0)
    return L


def wind_frame(lane):
    """The anticipation: the arm swings back, the chain trailing behind it, the weight hanging."""
    L = Layer('arm-back')
    if lane == 'HIGH':
        H, mid, W = (-34, -146), (-44, -136), (-47, -122)
        E, H = ik(FAR_SHOULDER, H, F_UPPER, F_FORE, bend=-1)
        far_arm(L, E, H, 16.0)
        chain_curve(L, catmull([H, mid, W], 0.25), 15.5, 'flail')
        weight(L, W[0], W[1], 15.8)
    else:
        H, mid, W = (-46, -74), (-54, -64), (-56, -50)
        E, H = ik(FAR_SHOULDER, H, F_UPPER, F_FORE, bend=-1)
        far_arm(L, E, H, 1.0, dk=1)
        chain_curve(L, catmull([H, mid, W], 0.25), 3.5, 'flail')
        weight(L, W[0], W[1], 4.0)
    return L


def release_frame(lane, pull=False):
    """The throw (the arm thrust out, the chain running taut from the fist down into the lash line)
    or the yank back (pull: the elbow back, the chain slack)."""
    ly = LASH_LANE_Y[lane]
    if not pull:
        H = (36, -88) if lane == 'HIGH' else (33, -68)
    else:
        H = (10, -100) if lane == 'HIGH' else (6, -72)
    E, H = ik(FAR_SHOULDER, H, F_UPPER, F_FORE, bend=1)
    L = Layer('arm-back')
    far_arm(L, E, H, 16.0)
    end = (LASH_ROOT_X + 6, ly)
    if not pull:
        mid = (H[0] + 6, (H[1] + ly) / 2 + 2)
        knee = (end[0] - 2, ly - 5)
    else:
        mid = (H[0] + 10, (H[1] + ly) / 2 + 9)
        knee = (end[0] - 4, ly - 2)
    chain_curve(L, catmull([H, mid, knee, end], 0.25), 18.5, 'flail')
    return L


def catch_frame():
    """After the whip: the arm comes back down in front, the chain gathered in a loop in the fist."""
    H = (-10, -64)
    E, H = ik(FAR_SHOULDER, H, F_UPPER, F_FORE, bend=-1)
    L = Layer('arm-back')
    far_arm(L, E, H, 16.0)
    loop = [H, (H[0] + 5, H[1] + 7), (H[0] + 2, H[1] + 13), (H[0] - 4, H[1] + 9), (H[0] - 1, H[1] + 3)]
    chain_curve(L, catmull(loop, 0.25), 15.5, 'flail')
    weight(L, H[0] + 2, H[1] + 16, 15.8)
    return L


def arm_back(f=0):
    """Frame f of BACK_ROLES (0: the far arm at rest, hanging behind the body, one tone darker)."""
    role = BACK_ROLES[f] if isinstance(f, int) else f
    if role == 'REST':
        L = Layer('arm-back')
        S, E, H = FAR_SHOULDER, (-33, -75), (-38, -54)
        tube(L, S, E, 6.0, 5.2, JACK, 1.0, 'sleeveF', cuts=(0.82, 0.62, 0.38, 0.12, -0.15), pat=sleeve_pat(True, math.hypot(E[0] - S[0], E[1] - S[1])))
        forearm(L, E, H, 1.6, 'foreF', dk=1)
        ball(L, E[0] + 0.5, E[1] + 0.5, 4.0, STEEL, 2.6, 'elbowF', dk=1, cuts=(0.88, 0.7, 0.45, 0.15, -0.2))
        fist(L, (H[0], H[1] + 3), 3.2, 'fistF', dk=1)
        return L
    if role in ('HIGH', 'LOW'):
        return whirl_frame(role, 0)
    if role.startswith('WHIRL_'):
        lane, p = role[6:].split('_')
        return whirl_frame(lane, int(p))
    if role.startswith('WIND_'):
        return wind_frame(role[5:])
    if role.startswith('RELEASE_'):
        return release_frame(role[8:])
    if role.startswith('PULL_'):
        return release_frame(role[5:], pull=True)
    return catch_frame()


WHIRL_STEPS = 8
BACK_ROLES = (['REST', 'HIGH', 'LOW'] + [f'WHIRL_HIGH_{p}' for p in range(1, WHIRL_STEPS)]
              + [f'WHIRL_LOW_{p}' for p in range(1, WHIRL_STEPS)]
              + ['WIND_HIGH', 'WIND_LOW', 'RELEASE_HIGH', 'RELEASE_LOW', 'PULL_HIGH', 'PULL_LOW', 'CATCH'])


# ---------------------------------------------------------------------------------------- the lash
LASH_W = 136                    # the chain's length in the strip (the game shows lashLen + 4 <= 128 px)
LASH_ROLES = ['OUT_A', 'OUT_B', 'SNAP_A', 'SNAP_B', 'BACK_A', 'BACK_B']


def lash(role):
    """The flung chain, root at x 0, the tip weight at the right end; y 0 = the lane centre."""
    tip = LASH_W - 5
    if role.startswith('OUT'):
        k = 0 if role == 'OUT_A' else 1
        # a wave runs out along the chain: big near the root, dying out toward the leading tip
        def yv(x):
            return math.sin((x + k * 9) / 9.0) * 3.2 * max(0.0, 1 - x / (tip * 0.8))
    elif role.startswith('SNAP'):
        k = 0 if role == 'SNAP_A' else 1
        def yv(x):                                         # taut; the crack ripples back from the tip
            r = x / tip
            return (1.4 if k else 0.0) * math.sin(r * 18) * max(0.0, r - 0.6) * 2.5
    else:
        k = 0 if role == 'BACK_A' else 1
        def yv(x):                                         # slack: it sags as it is dragged back
            r = x / tip
            return (3.5 + k) * math.sin(math.pi * r) + math.sin(r * 11 + k * 2) * 1.2
    pts = [(x / 2, yv(x / 2)) for x in range(0, 2 * tip + 1)]
    L = Layer('lash')
    chain_curve(L, pts, 10.0, 'lash', phase=k)
    # enamel shields along it (as on her chain of office)
    for j, x in enumerate(range(22, tip - 10, 27)):
        col = [('p', 'q', 'r'), ('S', 'T', 'U'), ('s', 't', 't')][j % 3]
        sx, sy = x, round(yv(x))
        for jj, r in enumerate(['hhhhi', 'h12.j', 'h223j', 'i233j', '.j3j.', '..k..']):
            for ii, ch in enumerate(r):
                if ch == '.':
                    if (ii, jj) != (3, 1):
                        continue
                    ch = '0'
                c = {'1': col[0], '2': col[1], '3': col[2]}.get(ch, ch)
                L.put(sx - 2 + ii, sy - 2 + jj, c, 10.5, 'shield%d' % j)
    ty = round(yv(tip))
    weight(L, tip, ty, 11.0)
    if role == 'SNAP_A':                                   # the crack: a starburst round the weight
        for a in range(8):
            ang = a * math.pi / 4 + 0.2
            for r, ch in ((6, '+'), (7, '+'), (8, '+'), (9, '*'), (10, '*'), (11, '^'), (12, '~')):
                if a % 2 and r > 9:
                    continue
                L.put(math.floor(tip + 0.5 + r * math.cos(ang)), math.floor(ty + 0.5 + r * math.sin(ang)), ch, 30, 'fx')
    elif role == 'SNAP_B':
        for a in range(4):
            ang = a * math.pi / 2 + 0.6
            for r, ch in ((7, '*'), (8, '^')):
                L.put(math.floor(tip + 0.5 + r * math.cos(ang)), math.floor(ty + 0.5 + r * math.sin(ang)), ch, 30, 'fx')
    return L


def lash_frame(role):
    """The lash frame (root at x 0; mayor.ts shows its last lashLen + 4 px, measured from the frame's
    right edge, so the leading tip is always in view)."""
    return fr(lash(role))


# ----------------------------------------------------------------------------------------- strips
def strips(s):
    """Every limb strip and its events (called by build())."""
    # legs: the roles, then the 12-frame walk; the point 'hip' on every frame (mayor.ts body drop)
    # (SIT holds 10 and SQUAT 8: in the strip they sit next to roles the game never plays after
    # them; the smoothness gate reads the strip's own order)
    s.strip('legs', [fr(legs(r), pts={'hip': hip_point(r)}) for r in LEG_ROLES],
            [10 if r == 'SIT' else 8 if r == 'SQUAT' else 6 for r in LEG_ROLES], cls='piece', why=PIECE_WHY)
    for i, r in enumerate(LEG_ROLES[:LEGS_WALK]):
        s.event(f'LEGS_{r}', i)
    s.event('MAYOR_WALK', LEGS_WALK)                       # the first walk frame (12 follow in order)
    s.event('LEGS_WALK_FRAMES', WALK_N)
    s.event('LEGS_WALK_TICKS', 32)                         # one walk cycle: two footfalls (16 ticks each)
    # the stamp arm at the three damage stages: 20 roles facing right, the same 20 pre-mirrored
    n = len(ARM_ROLES)
    for st in (0, 1, 2):
        frames = []
        for mirror_text in (False, True):
            for p in range(n):
                pic = cv.finish(stamp_arm(p, st, mirror_text), fx=FX)
                if mirror_text:
                    pic = cv.mirror(pic)
                frames.append(fr_pic(pic, smear=ARM_ROLES[p] == 'SMEAR_LOW'))
        s.strip(f'stamp-arm-{st}', frames, 6, cls='piece', why=PIECE_WHY)
    s.event('ARM_FRAMES', n)
    for i, r in enumerate(ARM_ROLES):
        s.event(f'ARM_{r}', i)
    s.strip('stamp-arm-gone', [fr(stump(k)) for k in (0, 1)], 6, cls='piece', why=PIECE_WHY)
    s.event('STUMP_FRAMES', 2)
    # the far arm and the chain flail
    s.strip('arm-back', [fr(arm_back(r)) for r in BACK_ROLES], 2, cls='piece', why=PIECE_WHY)
    s.event('BACK_REST', BACK_ROLES.index('REST'))
    s.event('BACK_HIGH', BACK_ROLES.index('HIGH'))
    s.event('BACK_LOW', BACK_ROLES.index('LOW'))
    s.event('BACK_WHIRL_HIGH', BACK_ROLES.index('WHIRL_HIGH_1'))
    s.event('BACK_WHIRL_LOW', BACK_ROLES.index('WHIRL_LOW_1'))
    s.event('BACK_WHIRL_STEPS', WHIRL_STEPS)
    for r in ('WIND_HIGH', 'WIND_LOW', 'RELEASE_HIGH', 'RELEASE_LOW', 'PULL_HIGH', 'PULL_LOW', 'CATCH'):
        s.event(f'BACK_{r}', BACK_ROLES.index(r))
    # the lash
    s.strip('lash', [lash_frame(r) for r in LASH_ROLES], 2, cls='piece', why=PIECE_WHY)
    for i, r in enumerate(LASH_ROLES):
        s.event(f'LASH_{r}', i)
