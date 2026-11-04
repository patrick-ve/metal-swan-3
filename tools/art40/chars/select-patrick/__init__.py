# PATRICK on the select screen (docs/design/select40.md): his 64 x 120 portrait in three states,
# drawn with the portrait kit (tools/art40/chars/_portrait). Traits: slick swept-back black hair with
# a side part on the lit side, volume on top and short faded sides; strong straight thick brows set
# low over dark brown almond eyes; a broad face with full cheeks and a wide jaw; a broad nose with a
# round tip; a closed-mouth smile with a full lower lip; a thin trimmed mustache and light chin
# stubble; light tan skin; the head turned a little to the viewer's right, so the far ear hides.
# Costume as the 40 px hero: the black zip jacket with its soft collar standing round the neck over
# a white tee. The miserable version: the closed smile pressed into a strained, forced one, deep eye
# bags, bloodshot corners, a sweaty shine on the broad forehead, sweat beads. His gag
# (select-pick): the eyes pop, a vein throbs on his brow and one strand of the slick hair springs up
# and falls onto his forehead while the smile cracks into a clenched grimace.
import math

import art40 as X

PK = X.char('_portrait')
C, P = PK.core, PK.parts

RAMPS = {
    'skin': ['#1b0e0b', '#311a12', '#4a2a1b', '#653d27', '#805234', '#9a6743', '#b27d54', '#c69367', '#d6aa7e', '#e5c299'],
    'hair': ['#050508', '#0c0c12', '#16171f', '#22252f', '#363b4a', '#566078', '#8a98b4'],
    'white': ['#5a4846', '#8f7c74', '#c7b8a6', '#ece2cf'],
    'iris': ['#140a06', '#3a2010', '#62401f'],
    'red': ['#b8463c'],
    'teeth': ['#5e4a3a', '#a08a6c', '#d2c19e', '#efe4c6'],
    'mouth': ['#1c0a0a', '#4a1814', '#7a2c22'],
    'lip': ['#4e2a20', '#77402f', '#97594a', '#b07462'],
    'stub': ['#2a1d18', '#45332a', '#62493b', '#7e604c', '#9a7860'],
    'jacket': ['#07070b', '#0f1018', '#191b26', '#262a38', '#3a4052'],
    'tee': ['#8a8e98', '#c0c4cc', '#e8eaee'],
}

HEAD = dict(cx=33, pivot=100, top=10, brow=39, eye=47.5, nose=64, mouth=76.5, chin=95, cran=27.8, temple=28.2,
            cheek=29.0, jaw=28.0, chinw=18.0, cap=5, tilt=1.0, eye_dx=11.8, nose_w=4.2, mouth_w=12)
EYES = dict(w=5.8, up=3.3, lo=1.7, droop=0.5, ir=2.2, pupil=0.45, lid=1.4, bag=1.5, red=0.28, socket=0.3, fold=2.0)
BROWS = dict(pts=[(-5.4, -5.0), (0.0, -5.9), (5.0, -5.8), (8.2, -4.4)], w0=3.6, w1=2.6)
NOSE = dict(w=4.4, bridge=4)
MOUTH = dict(w=11.0, open=0.0, smile=1.0, asym=0.3, teeth='none', lip_u=1.2, lip_l=2.4, upper_arc=0.15, lip_glint=False,
             teeth_h=2.2, teeth_lo=1.6, gap=2.6)

TURN = 2.0          # the head turns a little to the viewer's right: the features shift that way


# ------------------------------------------------------------------------------------------ hooks


def bust(cv, hd, q, h):
    """The black zip jacket on broad shoulders (the near shoulder on the left is fuller) and the
    white tee in the opening, a little right of the middle (the body turns with the head)."""
    dy = q.get('dy', 0)
    sh = q.get('shrug', 0)
    body = P.poly([(-2, 121), (-2, 102 - sh), (6, 97 - sh), (16, 93 + dy - sh), (48, 93 + dy - sh), (58, 97 - sh),
                   (66, 101 - sh), (66, 121)])
    P.cloth(cv, body, 'jacket', 'body', cx=28, rx=38, top=92, bias=0.06,
            folds=[([(8, 106), (13, 112), (15, 121)], 0.22), ([(55, 104), (52, 112), (52, 121)], 0.18)])
    tee = P.poly([(25, 94 + dy), (43, 94 + dy), (40, 107 + dy), (35, 113 + dy)])
    P.cloth(cv, tee, 'tee', 'shirt', cx=33, rx=10, top=94, bias=0.14)
    # the tee's round neck band: a thin shade along its edge
    C.crease(cv, [(28, 96.5 + dy), (34, 99.5 + dy), (41, 96.5 + dy)], depth=0.25, lit=0.0, groups=('shirt',), width=0.5)
    # the zip: from the tee's point down the jacket, its teeth catching the light, the pull
    for y in range(int(110 + dy), 121):
        x = 35 + (y - 110) * 0.18
        cv.put(int(x), y, 'jacket', 0.75 if y % 2 else 0.35, 'body')
    cv.put(35, int(111 + dy), 'tee', 0.6, 'body')
    cv.put(35, int(112 + dy), 'tee', 0.3, 'body')


def collar(cv, hd, q, h):
    """The soft collar standing round the neck, folded over: the near flap (left) broad and lit on
    its fold, the far flap narrow; then the near ear, the far one half hidden by the turn."""
    dy = q.get('dy', 0)
    near = [(12, 92 + dy), (18, 85 + dy), (22, 86 + dy), (30, 101 + dy), (33, 106 + dy), (27, 103 + dy), (17, 96 + dy)]
    far = [(52, 92 + dy), (47, 85 + dy), (44, 86 + dy), (41, 96 + dy), (38, 104 + dy), (45, 101 + dy), (51, 96 + dy)]
    P.cloth(cv, P.poly(near), 'jacket', 'cloth', cx=24, rx=14, top=84, bias=0.22)
    P.cloth(cv, P.poly(far), 'jacket', 'cloth', cx=46, rx=10, top=84, bias=0.1)
    # the fold lines of the collar (lit edge on the near flap, a dark seam under both)
    C.line(cv, [(18.5, 86 + dy), (24, 94 + dy), (30, 101 + dy)], 'jacket', 0.85, g='cloth', width=0.45)
    C.line(cv, [(13, 92 + dy), (17, 96 + dy), (27, 103 + dy)], 'jacket', 0.0, g='cloth', width=0.45)
    C.line(cv, [(51, 96 + dy), (45, 101 + dy), (38.5, 104 + dy)], 'jacket', 0.0, g='cloth', width=0.45)


def ears(cv, hd, q, h):
    """Trim the far ear (viewer's right): the turned head hides most of it (back to the booth)."""
    bg = C.Canvas()
    P.backdrop(bg)
    for x, y, u, v in hd.each(18, hd.eye - 6, 40, hd.nose + 6):
        i = y * cv.w + x
        if cv.g[i] == 'ear' and u > hd.width(v) + 1.2:
            cv.m[i], cv.v[i], cv.g[i], cv.fx[i], cv.r[i] = bg.m[i], bg.v[i], 'bg', None, 0.0


def face(cv, hd, q, h):
    """The weary folds, the sweaty shine of the broad forehead and the gag's vein."""
    ears(cv, hd, q, h)
    for s in (-1, 1):
        P.smile_fold(cv, hd, s, dict(top=5.2, mid=9.6, end=11.0 + 0.6 * s, drop=10.0 - 2.0 * q.get('smile_add', 0.0), depth=0.3))
    # the cheeks' heavy lower edge (full cheeks gone tired): a soft crease from the fold outwards
    for s in (-1, 1):
        pts = [(hd.turn * 0.5 + s * 12.5, hd.mouth + 4.0), (hd.turn * 0.4 + s * 17.0, hd.mouth + 1.5), (s * 21.0, hd.mouth - 3.0)]
        C.crease(cv, hd.pts(pts), depth=0.12, lit=0.04, width=0.55)
    # the forced smile: the chin tensed into a dimpled knot, a dent at each pressed corner
    cu = hd.turn * 0.6
    for x, y, u, v in hd.each(cu - 7, hd.mouth + 5, cu + 7, hd.chin - 1):
        if cv.grp(x, y) == 'skin':
            g = C.gauss(u, v, cu, hd.mouth + 10.5, 4.0, 2.4)
            cv.shift(x, y, -0.12 * g * (C.hsh(x, y, 13) < 0.5))
    if q.get('teeth', 'none') == 'none':
        mw = h.mouth['w']
        for sd in (-1, 1):
            cx_, cy_ = hd.xy(hd.turn * 0.7 + sd * (mw + 0.8), hd.mouth - 1.6 - 0.3 * sd)
            cv.shift(int(cx_), int(cy_), -0.22)
            cv.shift(int(cx_) + sd, int(cy_) - 1, 0.1)
    # the forehead's sweaty shine: a lit patch on the brow's lit side, a smaller one on the other
    for x, y, u, v in hd.each(-20, hd.top + 8, 20, hd.brow):
        if cv.grp(x, y) == 'skin':
            g = C.gauss(u, v, -5.5, hd.brow - 9.5, 6.0, 3.2) + 0.5 * C.gauss(u, v, 9.0, hd.brow - 8.0, 3.0, 2.0)
            cv.shift(x, y, 0.1 * g)
    # one worried line across the forehead (deeper when the brows lift)
    lift = max(q.get('brow', 0.0), q.get('brow_l', 0.0), q.get('brow_r', 0.0))
    pts = [(-12, hd.brow - 6.0), (-4, hd.brow - 7.4 - 0.2 * lift), (5, hd.brow - 7.1 - 0.2 * lift), (12, hd.brow - 5.6)]
    C.crease(cv, hd.pts(pts), depth=0.06 + 0.08 * lift, lit=0.05, width=0.45)
    if lift > 1.0 and not q.get('vein'):
        pts = [(-10, hd.brow - 10.5), (-2, hd.brow - 11.8), (6, hd.brow - 11.4), (11, hd.brow - 10.0)]
        C.crease(cv, hd.pts(pts), depth=0.05 * lift, lit=0.04, width=0.45)
    vein = q.get('vein', 0.0)
    if vein:
        brow_vein(cv, hd, vein)


def brow_vein(cv, hd, k):
    """The gag's vein on the lit temple: a forked worm raised off the bright skin (a core one step
    darker than the skin around it between two dark edges, the lower one deeper); k swells it."""
    b = hd.brow
    trunk = hd.pts([(-11.8, b - 15.0), (-10.6, b - 11.0), (-10.9, b - 7.0), (-9.8, b - 3.0)])
    fork = hd.pts([(-10.8, b - 10.0), (-8.6, b - 11.6), (-7.4, b - 14.6)])
    core = 0.3 + 0.35 * k
    edge = core + 0.75
    xs = [p[0] for p in trunk + fork]
    ys = [p[1] for p in trunk + fork]
    for y in range(int(min(ys)) - 3, int(max(ys)) + 3):
        for x in range(int(min(xs)) - 3, int(max(xs)) + 3):
            if cv.grp(x, y) != 'skin' or cv.fx[y * cv.w + x] is not None:
                continue
            d0, _, s0 = C.poly_dist(x + 0.5, y + 0.5, trunk)
            d1, _, s1 = C.poly_dist(x + 0.5, y + 0.5, fork)
            d, side = (d0, s0) if d0 <= d1 + 0.3 else (d1 * 1.15, s1)
            if d <= core:
                cv.shift(x, y, -0.04 - 0.04 * k)
            elif d <= edge:
                cv.shift(x, y, -(0.18 + 0.12 * k) * (1.25 if side < 0 else 0.8))


def beard(cv, hd, q, h):
    """Light stubble: a darker patch under the lower lip, the chin, a faint shadow along the jaw."""
    cu = hd.turn * 0.6

    def region(u, v):
        if not hd.inside(u, v):
            return 0.0
        au = abs(u - cu)
        w = 0.0
        # the patch under the lower lip and the chin
        if v > hd.mouth + 3.4:
            w = max(w, (0.85 - 0.45 * C.smooth(3.0, 9.0, au)) * C.smooth(hd.mouth + 3.4, hd.mouth + 5.0, v))
        # the jaw line: a band along the lower edge of the face
        edge = hd.width(v) - au
        if v > hd.mouth - 2 and edge < 3.0:
            w = max(w, 0.5 * C.smooth(hd.mouth - 2, hd.mouth + 5, v) * (1 - edge / 3.0))
        return w
    P.stubble(cv, hd, region, edge=0.8, speck=0.25, seed=43, keep=0.97, lift=0.05)


def whiskers(cv, hd, q, h):
    """The thin trimmed mustache right over the lip: thin in the middle, a little fuller towards
    the corners, the skin of the philtrum showing through."""
    cu = hd.turn * 0.7
    for x, y, u, v in hd.each(cu - 11, hd.mouth - 5, cu + 11, hd.mouth + 1):
        au = abs(u - cu)
        if au > 9.6:
            continue
        bot = hd.mouth - 2.0 - 0.12 * au + (au / 9.0) ** 3 * 1.6
        th = 1.0 + 0.7 * C.smooth(1.0, 5.0, au) - 0.6 * C.smooth(7.5, 9.6, au)
        if bot - th <= v <= bot and cv.grp(x, y) in ('skin', 'lip'):
            if au < 1.2 and C.hsh(x, y, 5) < 0.6:
                continue
            cv.put(x, y, 'stub', 0.02 + 0.14 * (u < cu) + 0.1 * C.hsh(x, y, 5), 'skin')


def hairline(hd, u):
    """The front edge of the hair (v): a broad forehead, the corner receding a little on the part's
    side (the lit side), the swept volume coming down over the far temple."""
    hl = hd.top + 9.5 + 1.2 * C.gauss(u, 0, 1.0, 0, 7.0, 1) - 0.03 * u - 3.4 * C.gauss(u, 0, -14.5, 0, 3.4, 1) - 1.6 * C.gauss(u, 0, 14.5, 0, 3.6, 1)
    if u < -19:
        hl += (-19 - u) * 1.9
    if u > 18:
        hl += (u - 18) * 1.6
    return hl


def hair_inside(hd, q):
    top, cran = hd.top, hd.p['cran']
    vc = hd.vc

    def lift(u):           # the slick volume: highest over the middle-right, flat on the part side
        return 3.5 + 4.0 * C.gauss(u, 0, 3.0, 0, 11.0, 1)

    def inside(u, v):
        au = abs(u - 0.5)
        if v < vc:
            lt = lift(u)
            t = (vc - v) / (vc - top + lt)
            if t >= 1:
                return False
            w = (cran + 1.3) * math.sqrt(1 - t * t)
            if au > w:
                return False
        elif abs(u) > hd.width(v) + 1.0:
            return False
        if v < hairline(hd, u):
            return True
        # the short sides down to the top of the ears
        side = cran - 3.0
        return abs(u) > side and v < hd.eye - 5.0 + (abs(u) - side) * 0.6
    return inside


def hair(cv, hd, q, h):
    """Slick swept-back black hair: combed up and back from the part on the lit side, a glossy roll
    over the forehead, comb lines catching the light, short faded sides above the ears; the gag's
    strand (q['strand']: 0 in place, 0.3 springs up, 1 hangs on the forehead)."""
    inside = hair_inside(hd, q)

    def ang(u, v):
        # combed up and back, fanning out from the part (left) to the far side
        return -math.pi / 2 + 0.32 + 0.012 * u - 0.03 * max(0.0, -u - 12)
    P.hair_mass(cv, hd, inside, 'hair', dome=(-2.0, hd.top + 6, 33, 20), ang=ang, lane=1.0, length=10.0,
                seed=47, gain=0.42, amb=0.0, rimk=1.0, clump=0.14, sheen=0.25)
    # the front roll: the hair lifts off the forehead (a dark root band, a lit crest above it)
    for x, y, u, v in hd.each(-22, hd.top - 8, 24, hd.top + 16):
        if cv.grp(x, y) != 'hair':
            continue
        hl = hairline(hd, u)
        d = hl - v
        if 0 <= d < 1.6:
            cv.shift(x, y, -0.18)
        elif 2.5 <= d < 5.5 and -16 < u < 20:
            cv.shift(x, y, 0.1 * (1 - abs(d - 4.0) / 1.5))
    # comb lines: sharp broken streaks of gloss along the sweep where the key light reaches (the
    # pomade), dark grooves between them
    for x, y, u, v in hd.each(-34, hd.top - 10, 34, hd.eye):
        i = y * cv.w + x
        if cv.g[i] != 'hair':
            continue
        a = ang(u, v)
        st = P.strands(u, v, a, length=8.0, width=1.3, seed=71)
        lit = cv.v[i]
        if st > 0.76 and lit > 0.22:
            cv.shift(x, y, 0.18 + 0.4 * (st - 0.76) / 0.24 + 0.3 * C.smooth(0.3, 0.6, lit))
        elif st < 0.22:
            cv.shift(x, y, -0.1)
    # the part: a thin dark line on the lit side, from the hairline up and back
    hl = hairline(hd, -12.0)
    C.line(cv, hd.pts([(-12.0, hl - 0.5), (-12.4, hl - 3.5), (-13.2, hl - 6.5)]), 'skin', 0.2, g='hair', width=0.4,
           clip=lambda x, y: cv.grp(x, y) == 'hair')
    # the faded sides: speckled short hair over the skin above and in front of the ears
    cran = hd.p['cran']
    for x, y, u, v in hd.each(-cran - 2, hd.brow - 8, cran + 2, hd.eye + 6):
        if cv.grp(x, y) not in ('skin', 'ear'):
            continue
        side = cran - 3.0
        if abs(u) < side or abs(u) > hd.width(v) + 1.0:
            continue
        lo = hd.eye - 5.0 + (abs(u) - side) * 0.6
        if v < lo:
            continue
        f = 1 - (v - lo) / 6.0
        if f > 0 and C.hsh(x, y, 29) < f * 0.85:
            cv.put(x, y, 'hair', 0.18 + 0.12 * C.hsh(x, y, 31), 'hair')
    # the single hairs at the forehead's edge (the line is never a clean cut)
    for x, y, u, v in hd.each(-20, hd.top + 4, 20, hd.top + 16):
        if cv.grp(x, y) == 'skin' and v < hairline(hd, u) + 1.0 and C.hsh(x, y, 9) < 0.4:
            cv.put(x, y, 'hair', 0.12, 'hair')
    strand(cv, hd, q)


def strand(cv, hd, q, late=False):
    """The gag's lock: rooted at the roll's front a little left of the middle; it springs up out of
    the slick hair (0.3), whips over (0.6) and hangs down onto the forehead in a curl (1.0)."""
    s = q.get('strand', 0.0)
    if not s or (s <= 0.35) != late:
        return
    u0 = -4.0
    hl = hairline(hd, u0)
    root = (u0, hl - 3.0)
    if s <= 0.35:            # it springs up and out of the top-left of the slick hair
        k = s / 0.35
        pts = [root, (u0 - 2.0, hl - 9 - 2 * k), (u0 - 6.0, hl - 14 - 3 * k), (u0 - 11.0 - 2 * k, hl - 16 - 3 * k),
               (u0 - 14.0 - 3 * k, hl - 14 - 2 * k)]
        w0, w1 = 3.0, 1.2
    elif s < 0.8:            # it whips over the front
        pts = [root, (u0 - 3.0, hl - 5.0), (u0 - 6.5, hl - 3.5), (u0 - 8.5, hl + 0.5), (u0 - 8.0, hl + 3.0)]
        w0, w1 = 3.4, 1.4
    else:                    # it hangs on the forehead in a limp curl
        pts = [root, (u0 - 1.6, hl - 0.5), (u0 - 2.8, hl + 3.5), (u0 - 2.2, hl + 7.0), (u0 - 0.4, hl + 8.6), (u0 + 0.6, hl + 7.4)]
        w0, w1 = 3.6, 1.3
    sp = hd.pts(pts)
    if late:
        # out against the booth (after the outline pass): a glossy lock with a dark under edge
        C.tube(cv, [(x + 0.6, y + 0.8) for x, y in sp], w0, w1, 'hair', 'hair', base=0.0, gain=0.0, amb=0.02)
        C.tube(cv, sp, w0 - 0.6, w1, 'hair', 'hair', base=0.6, gain=0.8, amb=0.15)
        C.line(cv, sp[1:-1], 'hair', 1.0, g='hair', width=0.3)
        return
    # its shadow on the forehead first (below-right of the lock)
    if s >= 0.8:
        for x, y, u, v in hd.each(u0 - 6, hl - 1, u0 + 4, hl + 12):
            if cv.grp(x, y) == 'skin':
                d, _, _ = C.poly_dist(x - 0.5, y - 1.0, sp)
                if d < w0 / 2:
                    cv.shift(x, y, -0.3)
    C.tube(cv, sp, w0, w1, 'hair', 'hair', base=0.4, gain=0.7, amb=0.04)
    C.line(cv, sp[1:-1], 'hair', 0.9, g='hair', width=0.28)


HERO = PK.Hero('patrick', RAMPS, HEAD, EYES, BROWS, NOSE, MOUTH, neck=(86, 104, 13.0),
               hooks=dict(bust=bust, collar=collar, face=face, beard=beard, whiskers=whiskers, hair=hair,
                          extra=lambda cv, hd, q, h: strand(cv, hd, q, late=True)),
               rest=dict(gaunt=1.2, sunk=1.2, gloom=0.9, look=(-0.4, 0.1), furrow=-1.5, turn=TURN, smile_add=-0.45, asym=0.55,
                         sheen=0.6, ears=dict(out=2.8)),
               dith={'skin': 0.28, 'hair': 0.3, 'jacket': 0.25, 'stub': 0.2, 'bg': 0.5})

SET = X.Set(prefix='char/patrick', budget=64, face=1, hl='W', colours=HERO.colours())
SET.shares_prefix = True     # char/patrick: the hero set's strips and these three, disjoint


def poses():
    """The three strips: (grey, loop, pick) of the portrait contract."""
    p = HERO.pose
    sw = [('bead', 11.0, 24.0, 2), ('bead', -15.0, 26.0, 1), ('bead', 2.0, 22.0, 1), ('bead', 19.0, 40.0, 1)]
    grey = [p(sweat=sw, gloom=1.0, eye_dv=0.2, smile_add=-0.35)]
    loop = PK.rig.loop_poses(p, sw, 11.0, 24.0, dart=-1.4, twitch={'asym': 0.9, 'smile_add': 0.05, 'vein': 0.4})
    # the strained smile cracks: the grimace with the teeth clenched, the eyes squeezed
    grim = dict(squeeze=0.75, furrow=1.5, teeth='clench', open=3.2, smile_add=-2.4, asym=0.0, wide=0.45, stretch=1.0, look=(0.0, 0.0))
    pop = dict(bulge=1.0, brow=2.6, furrow=-0.6, look=(0.0, -0.2), smile_add=0.1)
    burst = sw + [('bead', -6.0, 21.0, 2), ('bead', 15.0, 30.0, 1), ('bead', -19.0, 34.0, 1)]
    drops1 = [(7, 17), (57, 19)]
    drops2 = [(4, 12), (60, 14), (2, 34), (61, 42)]
    pick = [
        (p(sweat=sw, vein=0.5, bulge=0.4, brow=1.2, smile_add=0.0), 2),            # it hits him
        (p(sweat=sw, vein=1.0, dy=-1, **pop), 2),                                   # the eyes pop
        (p(sweat=burst, vein=1.6, strand=0.3, dy=-1, drops=drops1, **pop), 3),      # THROB: the strand springs up
        (p(sweat=burst, vein=0.9, strand=0.6, drops=drops2, **dict(grim, squeeze=0.2)), 2),   # it whips over
        (p(sweat=burst, vein=1.6, strand=1.0, drops=drops2, **grim), 3),            # THROB: it hangs on the brow
        (p(sweat=burst, vein=0.9, strand=1.0, dx=1, **grim), 2),                    # tremble
        (p(sweat=burst, vein=1.6, strand=1.0, **grim), 3),                          # THROB
        (p(sweat=burst, vein=0.9, strand=1.0, **grim), 2),                          # (only the vein changes)
        (p(sweat=burst, vein=1.6, strand=1.0, dx=1, **grim), 3),                    # THROB, tremble
        (p(sweat=burst, vein=1.0, strand=1.0, **dict(grim, squeeze=0.4)), 2),
        (p(sweat=burst + [('run', 11.0, 24.0, 31.0)], vein=1.4, strand=1.0, **grim), 8),   # held
    ]
    return grey, loop, pick


def build(s):
    grey, loop, pick = poses()
    PK.make(s, HERO, grey, loop, pick)
