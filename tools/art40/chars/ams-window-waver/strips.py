# The strips of npc/ams/ams-window-waver (contract: docs/design/ams40/contract.md "window waver and
# the cat"). Every frame is the whole window (the entity draws nothing else) with the waver or the
# cat in it, inside the 20 x 26 box above the sill (plan rule 10).
#
# person    the frame roles the game picks (ambient.ts AmsWindowWaver): EMPTY, IDLE, BLINK, the arm
#           RAISE (anticipation, then the hand shoots up past the wave), the WAVE cycle (6 frames,
#           16 ticks: eased holds at both ends, the bob's ends trailing the hand); the game lowers
#           the arm by playing RAISE backwards. The logic windows stay (100 / 130 / 250 / 280 ticks
#           of the period); the 8-tick alternation of the old 2-frame wave is now one 16-tick cycle.
# lean      she rises out of the room into the window in 9 ticks (the old LEAN 3 x 3): the crown, the
#           rise, an overshoot over the sill, the contact squash; played backwards to sink out.
# cat-swish the cat on the sill, its tail hanging over the edge in a pendulum swish with the tip
#           trailing the middle, an ear flick and a slow blink (48 ticks, the old cycle).
# cat       the calm cat (registered, not drawn by the entity): it looks to the street and back.
import math

import art40 as X
import castkit as K

from . import parts as P

FIG = ('head', 'torso', 'armF', 'armF:hand', 'armN', 'armN:hand', 'cat', 'tail')
CLIP = P.SILL - 1                   # the waver is behind the sill: nothing of her below this row


def _figure_outline(cv, rows):
    """The one outline colour around the figure where it lies over the window (the window pixel next
    to a nearer figure pixel turns K), like the exterior outline the finish pass draws."""
    out = [list(r) for r in rows]
    for y in range(cv.H):
        for x in range(cv.W):
            part = cv.p[y][x]
            if rows[y][x] == '.' or part is None or part.split(':')[0] in FIG or part in FIG:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X_, Y_ = x + dx, y + dy
                if 0 <= X_ < cv.W and 0 <= Y_ < cv.H:
                    q = cv.p[Y_][X_]
                    if q is not None and (q in FIG or q.split(':')[0] in FIG) and cv.z[Y_][X_] > cv.z[y][x] + 0.4:
                        out[y][x] = 'K'
                        break
    return [''.join(r) for r in out]


def _finish(cv):
    rows = cv.finish(outline=True)
    rows = _figure_outline(cv, rows)
    # never larger, never cut: every pixel inside the window box
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and not (P.PAD <= x < P.PAD + P.WW and P.PAD <= y < P.PAD + P.WH):
                raise ValueError(f'ams-window-waver: pixel {ch!r} at window ({x - P.PAD}, {y - P.PAD}) is outside the 20 x 26 box')
    return rows


def _canvas():
    return K.Canvas(P.WW + 2 * P.PAD, P.WH + 2 * P.PAD)


def _w(pt):
    """A window point -> canvas coordinates (for joints and points)."""
    return (pt[0] + P.PAD, pt[1] + P.PAD)


def _clipped_grid(cv, x0, y0, rows, z, part, clip=CLIP):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ' and y0 + j <= clip:
                P.px(cv, x0 + i, y0 + j, ch, z, part)


def _tube(cv, a, b, ra, rb, ramp, z, part, clip=CLIP, pat=None, u0=0.0):
    """A shaded tube in window coordinates, clipped at the sill."""
    tmp = K.Canvas(cv.W, cv.H)
    tmp.tube(_w(a), _w(b), ra, rb, ramp, z, part, pat=pat, u0=u0)
    for y in range(tmp.H):
        if y - P.PAD > clip:
            continue
        for x in range(tmp.W):
            if tmp.c[y][x] != '.':
                cv.px(x, y, tmp.c[y][x], z, part, proc=True)


# ------------------------------------------------------------------------------------- the waver
def _head(cv, x0, y0, kind='fwd', swing=0, z=15):
    rows = [list(r) for r in P.HEADS[kind]]
    _clipped_grid(cv, x0, y0, [''.join(r) for r in rows], z, 'head')
    for dx, dy, ch in P.HAIR_SWING[swing]:
        if y0 + dy > CLIP:
            continue
        if ch == '.':
            x, y = P.PAD + x0 + dx, P.PAD + y0 + dy
            if cv.p[y][x] == 'head':
                cv.c[y][x], cv.p[y][x], cv.z[y][x] = '.', None, -9.0
        else:
            P.px(cv, x0 + dx, y0 + dy, ch, z, 'head')


def waver(cv, drop=0, dx=0, head='fwd', swing=0, near='rest', far='rest', wrist=None, elbow=None,
          hand=None, nearlift=0):
    """The waver over the sill. drop / dx move the whole figure (rows down / columns right) from the
    idle place (head top at row 2, collar at row 15). near: 'rest' (the forearm on the sill), 'grip'
    (the hand on the sill's edge), None. far: 'rest' (the elbow on the sill), 'up' (the raised arm:
    wrist, elbow and the hand part), None. Returns the joints (window coordinates)."""
    j = {}
    tx, ty = 5 + dx, 15 + drop                       # the torso's top-left
    neck = (tx + P.TORSO_NECK[0], ty + P.TORSO_NECK[1])
    hx, hy = neck[0] - P.HEAD_NECK[0], neck[1] - P.HEAD_NECK[1]
    _head(cv, hx, hy, head, swing)
    j['head'] = (hx + 6, hy + 6)
    _clipped_grid(cv, tx, ty, P.TORSO, 14, 'torso')
    shF = (tx + P.SH_F[0], ty + P.SH_F[1])
    shN = (tx + P.SH_N[0], ty + P.SH_N[1])
    if far == 'rest':
        # the far elbow on the sill, left of the chest (the hand is under the near arm)
        _tube(cv, (shF[0] - 3.2, P.SILL - 1.6), (shF[0] + 1, P.SILL - 1.4), 1.6, 1.5, P.ARM_F, 12, 'armF')
        j['hand'] = (shF[0] - 3, P.SILL - 1.5)
    elif far == 'up':
        ex, ey = elbow
        # the upper arm goes behind the head and the chest; the forearm and the hand in front of
        # the bob's back (she holds the hand up beside her head)
        _tube(cv, (shF[0], shF[1] + 0.5), (ex, ey), 2.0, 1.8, P.ARM_F, 12, 'armF')
        _tube(cv, (ex, ey), wrist, 1.8, 1.5, P.ARM_F, 16, 'armF')
        rows, (ax, ay) = hand
        _clipped_grid(cv, round(wrist[0] - ax), round(wrist[1] - ay), rows, 16.5, 'armF:hand')
        j['hand'] = wrist
        j['elbow'] = elbow
    if near in ('rest', 'grip'):
        lift = nearlift
        wy = P.SILL - 1.5 - lift
        if near == 'rest':
            _tube(cv, (shN[0] - 3, wy + 0.2), (shN[0] - 0.2, wy), 1.7, 1.5, P.ARM_N, 18, 'armN')
            rows, _ = P.HAND_REST
            _clipped_grid(cv, round(shN[0]), round(wy - 1), rows, 18.5, 'armN:hand')
            j['handN'] = (shN[0] + 1, wy)
        else:
            rows, _ = P.HAND_REST
            _clipped_grid(cv, round(shN[0] - 1), P.SILL - 2, rows, 18.5, 'armN:hand')
            j['handN'] = (shN[0], P.SILL - 1.5)
    return j


def person_frame(empty=False, curtain=0, **kw):
    cv = _canvas()
    P.window_back(cv, curtain=curtain)
    j = {} if empty else waver(cv, **kw)
    P.window_front(cv)
    rows = _finish(cv)
    joints = {k: _w(v) for k, v in j.items()}
    return X.Frame(rows, P.ROOT, joints=joints)


# The wave: the far wrist swings around the elbow beside her head, eased (long holds at both ends),
# the hand tilts with the swing, the bob's ends trail the hand by a frame.
WAVE = [
    # wrist,      elbow,       hand (the fingers trail the swing), hair swing
    ((4.6, 7.0), (5.0, 12.6), P.HAND_OUT, 1),      # out: the fingers flop past the turn
    ((5.2, 6.5), (5.2, 12.5), P.HAND_OUT, 0),      # going in: the fingers still trail out
    ((6.3, 6.4), (5.5, 12.5), P.HAND_UP, -1),
    ((7.2, 6.9), (5.7, 12.6), P.HAND_IN, -1),      # in: the fingers flop past the turn
    ((6.4, 6.4), (5.5, 12.5), P.HAND_IN, 0),       # going out: the fingers still trail in
    ((5.3, 6.5), (5.2, 12.5), P.HAND_UP, 1),
]
WAVE_TICKS = [4, 2, 2, 4, 2, 2]                      # 16 ticks: the old 8 + 8 alternation


def person_strip(s):
    frames, durs = [], []
    roles = {}

    def add(role, f, d):
        roles.setdefault(role, len(frames))
        frames.append(f)
        durs.append(d)

    add('EMPTY', person_frame(empty=True), 10)
    add('IDLE', person_frame(), 18)
    add('BLINK', person_frame(head='blink', swing=1), 4)
    # the raise: anticipation (she dips, the far hand comes up half open past her chin), then the
    # hand shoots up past the wave (overshoot) as she calls out
    add('RAISE', person_frame(drop=1, far='up', wrist=(4.2, 11.5), elbow=(4.0, 15.6), hand=P.HAND_HALF), 3)
    add('RAISE2', person_frame(drop=-1, head='call', swing=1, far='up', wrist=(4.0, 5.6), elbow=(4.4, 11.6),
                               hand=P.HAND_UP), 3)
    for i, (wr, el, hand, sw) in enumerate(WAVE):
        add('WAVE%d' % i, person_frame(drop=-1, swing=sw, far='up', wrist=wr, elbow=el, hand=hand), WAVE_TICKS[i])
    s.strip('person', frames, durs, loop=True, cls='roles')
    s.event('WAVER_EMPTY', roles['EMPTY'])
    s.event('WAVER_IDLE', roles['IDLE'])
    s.event('WAVER_BLINK', roles['BLINK'])
    s.event('WAVER_RAISE', roles['RAISE'])
    s.event('WAVER_RAISE_N', 2)
    s.event('WAVER_WAVE_A', roles['WAVE0'])          # the hand out (first frame of the cycle)
    s.event('WAVER_WAVE_B', roles['WAVE3'])          # the hand in (the other end)
    s.event('WAVER_WAVE_N', len(WAVE))


def lean_strip(s):
    # crown (deep in the room), the rise (the hands find the sill), the overshoot, the contact squash
    f0 = person_frame(drop=10, dx=-2, near=None, far=None)
    f1 = person_frame(drop=5, dx=-1, near='grip', far=None)
    f2 = person_frame(drop=-1, dx=0, head='call', swing=1, nearlift=1)
    f3 = person_frame(drop=1, swing=-1, head='blink')
    s.strip('lean', [f0, f1, f2, f3], [2, 3, 2, 2], loop=False, cls='idle-fidget',
            why='the rise into the window lasts 9 logic ticks (the old LEAN 3 x 3): 4 frames of 2-3 ticks; '
                'the game plays it backwards to sink out')


# ------------------------------------------------------------------------------------- the cat
def _cat(cv, eyes='hero', ears='up', tip=0.0, mid=0.0, curl=0.0):
    x0, y0 = P.CAT_AT
    rows = [list(r) for r in P.CAT]
    rows[0], rows[1] = [list(r) for r in P.CAT_EARS[ears]]
    rows[3] = list(P.CAT_EYES[eyes])
    _clipped_grid(cv, x0, y0, [''.join(r) for r in rows], 20, 'cat', clip=P.WH)
    # the striped tail: from the hip over the sill's front edge, hanging down past the box
    hip = (x0 + 7.0, y0 + 9.2)
    pts = [hip, (x0 + 8.6, P.SILL - 0.2), (x0 + 9.0 + mid, P.SILL + 2.6), (x0 + 9.0 + tip + curl, P.BOX + 1.4)]
    u = 0.0

    def pat(uu, v, k, ch):
        return 'h' if int(uu) % 3 == 2 else ch

    for a, b, ra, rb in zip(pts, pts[1:], (1.0, 1.1, 1.0), (1.1, 1.0, 0.8)):
        _tube(cv, a, b, ra, rb, ['C', 'C', 'E', 'h'], 40, 'tail', clip=P.WH - 2, pat=pat, u0=u)
        u += math.hypot(b[0] - a[0], b[1] - a[1])
    # the tip: a dark ring
    tx, ty = pts[-1]
    P.px(cv, round(tx), round(ty + 0.3), 'h', 41, 'tail')
    return {'tail': pts[-1], 'tailmid': pts[2]}


def cat_frame(**kw):
    cv = _canvas()
    P.window_back(cv)
    j = _cat(cv, **kw)
    P.window_front(cv, skip=[16])
    return X.Frame(_finish(cv), P.ROOT, joints={k: _w(v) for k, v in j.items()})


def cat_strips(s):
    # the swish: a pendulum with the tip trailing the middle (follow-through), eased at both ends;
    # the near ear flicks, then the slow blink
    sw = []
    for i in range(8):
        a = math.radians(i * 45)
        tip = 2.0 * math.sin(a - math.radians(40))
        mid = 0.9 * math.sin(a)
        eyes = {4: 'half', 5: 'shut'}.get(i, 'hero')
        ears = 'flick' if i == 1 else 'up'
        sw.append(cat_frame(eyes=eyes, ears=ears, tip=tip, mid=mid))
    s.strip('cat-swish', sw, [6, 5, 8, 5, 6, 5, 8, 5], loop=True, cls='idle-fidget')
    # the calm cat: a lazy sway, it looks to the street and back
    calm = []
    looks = ['hero', 'hero', 'half', 'away', 'away', 'away', 'half', 'hero']
    for i in range(8):
        a = math.radians(i * 45)
        calm.append(cat_frame(eyes=looks[i], ears='flick' if i == 4 else 'up',
                              tip=0.9 * math.sin(a - math.radians(45)), mid=0.4 * math.sin(a)))
    s.strip('cat', calm, 6, loop=True, cls='idle-fidget')


def build(s):
    P.install()
    person_strip(s)
    lean_strip(s)
    cat_strips(s)
