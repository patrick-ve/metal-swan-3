# DIRK on the select screen (docs/design/select40.md): his 64 x 120 portrait in three states, drawn
# with the portrait kit (tools/art40/chars/_portrait). Stage 2: framed like VINCENT (the head fills
# the window, the eyes near y 51, the collar near y 100), a head-on bust seen a little from below.
# Traits: messy spiky light-brown hair pushed up and to the viewer's right with short sides, a broad
# forehead, narrow squinting eyes, a thick ginger-brown mustache curving down past the mouth corners,
# a closed-mouth smirk, a strip of stubble under the lower lip and light stubble on the chin and the
# jaw, a round full face with rosy cheeks and ears that stand out a little. Costume as the 40 px
# hero: the plumber's dark work top (a stand-up zip collar) under a hi-vis vest.
# The miserable version: the smirk gone pained and lopsided, the squint weary with deep bags and
# bloodshot corners, worried brows, sweat on the broad forehead.
# His gag (select-pick): the mustache bristles like a brush, then droops limp.
#
# Hero parts (this folder only, the kit is shared): spikes (the hair tufts as tapered lit locks),
# the mustache region (bristle 0..1, droop 0..1, a one-sided twitch), the collar and the vest.
import math

import art40 as X

PK = X.char('_portrait')
C, P = PK.core, PK.parts

RAMPS = {
    'skin': ['#2a1311', '#46201b', '#673228', '#8a4838', '#ab604b', '#c77c62', '#dd9a7f', '#ecb89e', '#f7d6c0'],
    'blush': ['#9a3e3a', '#bc5a50', '#d6766a'],
    'hair': ['#150b06', '#2c190c', '#4a2c16', '#6a4322', '#8d5f33', '#b07f4a', '#d0a46c'],
    'stache': ['#2a1409', '#4f280f', '#7a4219', '#a35f28', '#c47f3c', '#dda15a'],
    'white': ['#6a5650', '#a8968a', '#e2d6c2'],
    'iris': ['#1f2a2e', '#3f5658', '#6a8584'],
    'red': ['#b8463c'],
    'teeth': ['#6a5442', '#ad9878', '#ddcdaa'],
    'mouth': ['#1c0a0a', '#5a1e18'],
    'lip': ['#6e2c26', '#9c4a3e', '#c26a58'],
    'polo': ['#16110f', '#2a221d', '#40352c'],
    'vest': ['#4c5612', '#7c8e16', '#a8bd1e', '#cfe332', '#eef870'],
}

HEAD = dict(cx=32, pivot=104, top=12, brow=42, eye=51, nose=66, mouth=76, chin=99, cran=27.5, temple=27.5,
            cheek=28.5, jaw=27.5, chinw=15.0, cap=9, tilt=1.2, eye_dx=12.5, nose_w=3.8, mouth_w=10)
EYES = dict(w=6.0, up=3.3, lo=1.8, droop=0.8, ir=2.1, pupil=0.45, lid=1.5, bag=1.6, red=0.5, socket=0.3, fold=2.4)
BROWS = dict(pts=[(-5.5, -6.0), (0.0, -6.9), (5.0, -6.8), (8.2, -5.4)], w0=2.6, w1=1.6)
NOSE = dict(w=3.6, bridge=4)
MOUTH = dict(w=8.6, open=0.0, smile=0.35, asym=0.7, teeth='none', teeth_h=2.0, teeth_lo=1.6, lip_u=0.8, lip_l=1.8,
             upper_arc=0.1, gap=2.6, lip_glint=True)

# ------------------------------------------------------------------------------------------ helpers


def near(px, py, pts):
    """Nearest point of a polyline: (distance, arc parameter 0..1, the nearest point, segment index)."""
    total = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1)) or 1.0
    best, acc = None, 0.0
    for i in range(len(pts) - 1):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        seg = math.hypot(bx - ax, by - ay)
        d, t, q = C.seg_dist(px, py, ax, ay, bx, by)
        if best is None or d < best[0]:
            best = (d, (acc + t * seg) / total, q, i)
        acc += seg
    return best


def lock(cv, hd, uv, w0, w1, mat='hair', g='hair', depth=0.0, gain=0.95, amb=0.05, rimk=0.9, up=0.45, seed=1, lane=0.9):
    """One tapered lock of hair along head-space points uv (root -> tip): a round lit tube, its
    normal tipped up (the top of the head faces the key light), strand lanes along it, the rim on
    the right; depth darkens the locks further back."""
    pts = hd.pts(uv)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    m = max(w0, w1) / 2 + 1
    for y in range(max(1, int(min(ys) - m)), min(119, int(max(ys) + m) + 2)):
        for x in range(max(1, int(min(xs) - m)), min(63, int(max(xs) + m) + 2)):
            d, t, q, i = near(x + 0.5, y + 0.5, pts)
            half = (w0 + (w1 - w0) * t ** 0.8) / 2
            if d > half or half < 0.3:
                continue
            ox, oy = (x + 0.5 - q[0]) / max(half, 0.01), (y + 0.5 - q[1]) / max(half, 0.01)
            o = C.clamp(math.hypot(ox, oy))
            nz = math.sqrt(max(0.0, 1 - o * o))
            n = C.norm3(ox * 0.9, oy * 0.9 - up, nz + 0.2)
            (ax, ay), (bx, by) = pts[i], pts[i + 1]
            dl = math.hypot(bx - ax, by - ay) or 1.0
            across = ((x + 0.5 - ax) * -(by - ay) + (y + 0.5 - ay) * (bx - ax)) / dl
            s = C.hsh(int(math.floor(across / lane + 20)), int(t * 4), seed)
            val = amb + gain * max(0.0, C.dot(n, C.KEY)) ** 1.15 + rimk * max(0.0, C.dot(n, C.RIM)) ** 2
            val += 0.22 * (s - 0.5) + 0.12 * t - depth
            cv.put(x, y, mat, C.clamp(val), g, max(0.0, C.dot(n, C.RIM)))


# ------------------------------------------------------------------------------------------ hooks


def bust(cv, hd, q, h):
    """The dark work top over the shoulders and the hi-vis vest's straps and panels over it."""
    dy = q.get('dy', 0)
    sh = q.get('shrug', 0)
    body = P.poly([(-2, 121), (-2, 107 - sh), (6, 102 - sh), (18, 99 + dy - sh), (46, 99 + dy - sh), (58, 102 - sh),
                   (66, 107 - sh), (66, 121)])
    P.cloth(cv, body, 'polo', 'body', cx=30, rx=36, top=96, bias=0.05)
    for s in (-1, 1):
        # the vest: a wide strap over the shoulder, the front panel down to the window's edge
        pts = [(32 + s * 14, 100 + dy - sh), (32 + s * 24, 100 + dy - sh), (32 + s * 36, 106 - sh), (32 + s * 36, 121),
               (32 + s * 12, 121), (32 + s * 11, 110 + dy)]
        P.cloth(cv, P.poly(pts), 'vest', 'cloth', cx=30, rx=34, top=98, bias=0.12 if s < 0 else 0.04)
        # the panel's inner edge: a seam (binding) one step darker
        C.line(cv, [(32 + s * 14, 100.5 + dy - sh), (32 + s * 11.2, 110 + dy), (32 + s * 12.2, 121)], 'vest', 0.25,
               g='cloth', width=0.5)
    # the reflective band across both panels: a cold grey strip with a bright upper edge
    for y in range(113, 117):
        for x in range(1, 63):
            if cv.grp(x, y) == 'cloth':
                k = y - 113
                cv.put(x, y, 'refl', (0.95, 0.7, 0.55, 0.3)[k] - 0.004 * abs(x - 22), 'cloth')


def collar(cv, hd, q, h):
    """The stand-up zip collar round the thick neck: two dark flaps open at the throat, the zip."""
    dy = q.get('dy', 0)
    for s in (-1, 1):
        pts = [(32 + s * 15.5, 90 + dy), (32 + s * 4.0, 96.5 + dy), (32 + s * 2.0, 104 + dy), (32 + s * 13, 103 + dy),
               (32 + s * 18.5, 99 + dy)]
        P.cloth(cv, P.poly(pts), 'polo', 'body', cx=32 - s * 6, rx=14, top=92, bias=0.32 if s < 0 else 0.12)
        C.line(cv, [(32 + s * 15.5, 90.3 + dy), (32 + s * 4.0, 96.8 + dy)], 'polo', 0.95 if s < 0 else 0.6, g='body', width=0.45)
    # the zip: a cold metal line down the middle with a pull tab
    C.line(cv, [(32.2, 103 + dy), (32.6, 121)], 'refl', 0.55, g='body', width=0.45)
    cv.put(32, 104 + dy, 'refl', 0.95, 'body')
    cv.put(32, 105 + dy, 'refl', 0.7, 'body')


def face(cv, hd, q, h):
    """The weary folds: the smile folds into the mustache, the worried forehead lines, the full chin;
    the seam where the ears stand out from the head."""
    C.contour(cv, ('ear',), ('skin',), dv=-0.4)
    for s in (-1, 1):
        P.smile_fold(cv, hd, s, dict(top=5.2, mid=9.8, end=11.6, drop=10.5, depth=0.3))
    P.blush(cv, hd, amount=0.06, du=15.5, dv=9.5)
    lift = max(q.get('brow', 0.0), q.get('brow_l', 0.0), q.get('brow_r', 0.0))
    worry = max(0.0, -q.get('furrow', 0.0))
    for k, dv in enumerate((-17.5, -21.5, -25.5)):
        if k == 2 and lift < 1.0:
            break
        pts = [(-13, hd.eye + dv + 1.2), (-5, hd.eye + dv - 0.4 - worry * 0.8), (5, hd.eye + dv - 0.2 - worry * 0.8),
               (13, hd.eye + dv + 1.2)]
        C.crease(cv, hd.pts(pts), depth=0.07 + 0.05 * lift + 0.03 * worry, lit=0.05, width=0.45)
    # the round chin's fold over the full jaw (seen from below)
    C.crease(cv, hd.pts([(-9, hd.chin - 3.2), (0, hd.chin - 2.2), (9, hd.chin - 3.2)]), depth=0.12, lit=0.05, width=0.5)


def beard(cv, hd, q, h):
    """The strip under the lower lip and light, rough stubble on the chin and the jaw."""
    m = hd.mouth + hd.jaw * 0.6
    cu = hd.turn * 0.6

    def region(u, v):
        au = abs(u - cu)
        if not hd.inside(u, v):
            return 0.0
        if m + 2.6 < v < m + 8.0 and au < 2.0 + (v - m) * 0.08:
            return 1.0
        # light stubble on the chin (broken, the skin shows through: only the strip under the lip
        # is dense) and the jaw from the sideburn down (sparse)
        line = m + 3.0 if au < 12 else m + 3.0 - (au - 12) * 1.1
        if v <= line:
            return 0.0
        chin = 1.0 - C.smooth(7.0, 11.0, au + 0.35 * max(0.0, hd.chin - 3 - v))
        return max(0.32 * chin * C.smooth(line + 1.0, line + 4, v), 0.18 + 0.1 * C.smooth(18, 26, au))
    P.stubble(cv, hd, region, edge=0.85, speck=0.18, seed=37, keep=0.97, lift=0.02)
    for x, y, u, v in hd.each(cu - 2.5, m + 2.0, cu + 2.5, m + 8.5):
        au = abs(u - cu)
        if cv.grp(x, y) == 'skin' and m + 2.6 < v < m + 8.0 - au * 0.6 and au < 1.8 + (v - m) * 0.08:
            cv.put(x, y, 'stache', C.clamp(cv.v[y * cv.w + x] * 0.62 - 0.04 * (au > 1.2)), 'skin')


def stache_region(hd, q):
    """inside(u, v) of the thick horseshoe mustache and the strand angle at (u, v).
    q: bristle (0..1: the hairs stand out like a brush, the tips flare up and out), droop (0..1: the
    tips sag and the band hangs over the lip), stache_tw (-1..1: one side twitches up)."""
    br = q.get('bristle', 0.0)
    dr = q.get('droop', 0.0)
    tw = q.get('stache_tw', 0.0)
    m, n = hd.mouth, hd.nose
    cu = hd.turn * 0.7
    tip = 11.8 + br * 2.2 - dr * 0.6

    def lift(u):
        s = 1 if u > cu else -1
        return tw * s * C.smooth(0, 9, abs(u - cu)) * 1.6 if tw * s > 0 else 0.0

    def tips(s):
        # the drooping horseshoe tip of one side: root at the band's end, tip down past the corner
        ty = m + 4.8 + dr * 6.2 - br * 3.4
        tx = s * (tip - 0.4 + br * 1.2)
        return [(cu + s * 7.5, m - 1.6 + dr * 0.6), (cu + s * 10.0, m + 0.6 + dr * 1.2 - br * 1.4), (cu + tx, ty)]

    tpts = {s: tips(s) for s in (-1, 1)}

    def inside(u, v):
        au = abs(u - cu)
        s = 1 if u > cu else -1
        k = math.floor((u - cu) * 1.4)
        jag = br * (0.6 + 1.6 * C.hsh(k, 0, 41)) * C.smooth(0.5, 3.0, au)
        sag = dr * 1.6 * C.smooth(3.0, 8.0, au)
        top = n + 2.4 + 0.03 * au * au - lift(u) - jag * 0.8 + dr * 0.4
        if au < 0.9:
            top += 0.7
        bot = m + 0.5 - 0.015 * au * au - lift(u) + jag + sag
        if au <= 9.0 and top <= v <= bot:
            return True
        d, t, _, _ = near(u, v, tpts[s])
        w = (4.6 - 2.6 * t) / 2 + br * 0.5 * C.hsh(int(v * 1.4), s, 43)
        return d <= w

    def ang(u, v):
        s = 1 if u > cu else -1
        a = 0.95 - br * 0.6 + dr * 0.35
        return math.pi / 2 - s * (math.pi / 2 - a)
    return inside, ang


def whiskers(cv, hd, q, h):
    """The thick ginger mustache over the upper lip, its cast shadow on the lip and the chin, its
    dark lower edge (selout)."""
    inside, ang = stache_region(hd, q)
    cu = hd.turn * 0.7
    P.hair_mass(cv, hd, inside, 'stache', dome=(cu - 2.5, hd.nose + 5, 11, 6), ang=ang, lane=0.8, length=2.6, seed=19,
                gain=1.0, amb=0.05, rimk=0.6, g='beard', clump=0.34, sheen=0.25)
    idx = [i for i in range(cv.w * cv.h) if cv.m[i] == 'stache']
    on = set(idx)
    w = cv.w
    for i in idx:
        below = i + w
        if below < len(cv.m) and below not in on:
            cv.v[i] = C.clamp(cv.v[i] - 0.3)
    for i in idx:
        for k, dv in ((1, -0.34), (2, -0.16)):
            j = i + k * w
            if j < len(cv.m) and j not in on and cv.g[j] in ('skin', 'lip', 'teeth'):
                cv.v[j] = C.clamp(cv.v[j] + dv)
                cv.fx[j] = None
    bristles(cv, hd, q)


def bristles(cv, hd, q):
    """The gag: single stiff hairs stick out of the mustache's edges like a brush (bristle > 0.3):
    up off the top edge, down over the lip, out of the tips; lit and dark hairs by turns."""
    br = q.get('bristle', 0.0)
    if br < 0.3:
        return
    cu = hd.turn * 0.7
    m, n = hd.mouth, hd.nose
    hairs = []
    for k in range(-5, 6):
        u = cu + k * 1.55
        au = abs(u - cu)
        if au < 1.0:
            continue
        s = 1 if u > cu else -1
        top = n + 2.4 + 0.03 * au * au - br * 1.2
        bot = m + 0.5 - 0.015 * au * au + br * 1.4
        ln = br * (1.6 + 1.6 * C.hsh(k, 1, 47))
        hairs.append(((u, top + 0.4), (u + s * 0.5 * ln, top - ln), k % 2))
        if au < 7:
            hairs.append(((u, bot - 0.4), (u + s * 0.4 * ln, bot + ln * 0.9), (k + 1) % 2))
    for s in (-1, 1):
        root = (cu + s * 11.0, m + 1.0)
        for j, a in enumerate((-0.9, -0.4, 0.1, 0.6)):
            ln = br * (2.2 + 1.2 * C.hsh(j, s, 53))
            hairs.append((root, (root[0] + s * math.cos(a) * ln * 1.3, root[1] + math.sin(a) * ln), j % 2))
    for a, b, lit in hairs:
        C.line(cv, hd.pts([a, b]), 'stache', 0.85 if lit else 0.3, g='beard', width=0.42)


# The spiky hair: tufts (root u, root v from the skull's top, lean (rad, + to the viewer's right),
# length, root width) pushed up and to the viewer's right. The crown row rises over the skull (the
# spiky silhouette); the front row grows up from the hairline (the hair pushed up off the broad
# forehead); the last ones fall over the right temple. Back row first (darker), then the front.
# (u, dv, lean, length, width): uneven tufts, all swept up and over to the viewer's right (the
# longest over the right brow), shorter and flatter on the left side
TUFTS_CROWN = [(-24, 9, 0.35, 5, 6.0), (-16, 4, 0.45, 7, 7.0), (-11, 2, 0.3, 6, 5.0), (-6, 0, 0.6, 11, 8.0),
               (1, -1, 0.75, 14, 8.5), (6, 1, 0.55, 8, 5.0), (11, 1, 0.95, 14, 8.0), (18, 4, 1.25, 12, 7.0),
               (24, 10, 1.8, 9, 6.0)]
TUFTS_FRONT = [(-21, 11.5, 0.0, 8, 6.0), (-13, 10.5, 0.3, 10, 6.5), (-4, 10.0, 0.5, 11, 6.5), (5, 10.0, 0.7, 10, 6.0),
               (13, 11.0, 0.95, 10, 5.5), (20, 12.5, 1.4, 9, 5.0), (25, 16.0, 2.1, 7, 4.0)]


def hair(cv, hd, q, h):
    """Messy spiky light-brown hair: a short base mass (the sides cut short) under tapered tufts
    that rise and lean to the viewer's right; single hairs onto the broad forehead."""
    top = hd.top
    ruffle = q.get('ruffle', 0.0)

    def hairline(u):
        au = abs(u)
        return top + 11.5 + 0.006 * u * u + 2.4 * C.gauss(au, 0, 15, 0, 3.5, 2.5) - 0.6 * (u > 4)

    inside = P.hair_region(hd, hairline, lift=2.5, ext=1.0, fuzz=1.2, side_w=2.6, seed=13,
                           side_v=lambda au: hd.eye - 7 + (au - hd.p['cran'] + 2.6) * 1.2)
    P.hair_mass(cv, hd, inside, 'hair', dome=(-3.0, top + 9, 30, 16), ang=lambda u, v: -math.pi / 2 + 0.45 + u * 0.02,
                lane=1.0, length=3.0, seed=29, gain=0.75, amb=0.03, rimk=0.9, clump=0.4, sheen=0.1)
    for row, depth, gain in ((TUFTS_CROWN, 0.18, 1.0), (TUFTS_FRONT, 0.0, 1.05)):
        for k, (u0, dv, lean, ln, wd) in enumerate(row):
            v0 = top + dv
            ln = ln * (1 + 0.14 * ruffle * (C.hsh(k, 3, 5) - 0.2))
            a = -math.pi / 2 + lean + ruffle * 0.16 * (C.hsh(k, 7, 5) - 0.5)
            bend = 0.18 if lean < 1.4 else -0.25
            mid = (u0 + math.cos(a - bend) * ln * 0.5, v0 + math.sin(a - bend) * ln * 0.5)
            tip = (u0 + math.cos(a) * ln, v0 + math.sin(a) * ln)
            lock(cv, hd, [(u0, v0), mid, tip], wd, 1.1, depth=depth, gain=gain, seed=31 + k + 20 * (depth > 0), up=0.35)
    P.fringe(cv, hd, hairline, share=0.3)


def extra(cv, hd, q, h):
    """A twitch line under the eye on the nervous frames (the lower lid jumps)."""
    if q.get('tic'):
        s = q['tic']
        ex = hd.p['eye_dx']
        pts = [(s * ex - 3, hd.eye + 4.6), (s * ex + 2, hd.eye + 4.2)]
        C.crease(cv, hd.pts(pts), depth=0.2, lit=0.0, width=0.45)


HERO = PK.Hero('dirk', RAMPS, HEAD, EYES, BROWS, NOSE, MOUTH, neck=(88, 101, 15),
               hooks=dict(bust=bust, collar=collar, face=face, beard=beard, whiskers=whiskers, hair=hair, extra=extra),
               rest=dict(gaunt=0.8, sunk=0.9, gloom=0.75, look=(0.4, 0.2), squeeze=0.55, furrow=-1.3, smile_add=-0.45, asym=-0.3,
                         turn=0.6, ears=dict(out=5.0), sheen=0.5),
               dith={'skin': 0.22, 'hair': 0.3, 'vest': 0.2, 'blush': 0.2, 'stache': 0.25, 'bg': 0.5})
HERO.pal.alias('refl', HERO.pal['grey'][5:9])
HERO.pal.alias('stub', HERO.pal['stache'][1:6] + HERO.pal['skin'][7:8])

SET = X.Set(prefix='char/dirk', budget=64, face=1, hl='W', colours=HERO.colours())
SET.shares_prefix = True     # char/dirk: the hero set's strips and these three, disjoint


def poses():
    """The three strips: (grey, loop, pick) of the portrait contract."""
    p = HERO.pose
    sw = [('bead', -15.0, 29.0, 2), ('bead', 13.0, 26.0, 1), ('bead', 3.0, 30.5, 1), ('bead', 21.0, 40.0, 1)]
    grey = [p(sweat=sw, gloom=1.0, smile_add=-0.35, eye_dv=0.2)]
    rest = sw[1:]
    twitch = dict(stache_tw=1.0, asym=1.4, tic=1)
    # The loop (9 frames, 150 ticks): the key pose, a breath, the blink after the breath (his
    # dense hair and stubble make a blink on the raised head too big a change), an eye dart while
    # a sweat drop runs down the forehead, the one-sided mustache twitch, the drop gone.
    loop = [
        (p(sweat=sw), 44),
        (p(sweat=sw, dy=-1), 24),                                              # breath in
        (p(sweat=sw, blink=0.5), 3),                                           # blink
        (p(sweat=sw, blink=1.0), 4),
        (p(sweat=sw, blink=0.4), 3),
        (p(sweat=rest + [('run', -15.0, 29.0, 33.0)], look=(-1.3, 0.2)), 26),   # eye dart, the drop runs
        (p(sweat=rest + [('run', -15.2, 29.0, 37.0)], look=(-1.3, 0.2), **twitch), 10),   # the twitch
        (p(sweat=rest + [('run', -15.4, 29.0, 40.0)]), 22),
        (p(sweat=rest + [('bead', -15.0, 29.5, 1)]), 20),
    ]
    grim = dict(squeeze=1.0, furrow=0.9, teeth='clench', open=3.0, jaw=1.0, smile_add=-0.7, wide=0.35, stretch=1.0, asym=0.0,
                look=(0.0, 0.0))
    burst = sw + [('bead', -5.0, 27.0, 2), ('bead', 18.0, 33.0, 2), ('bead', -21.0, 37.0, 1)]
    d1 = [(6, 16), (57, 19), (3, 38)]
    d2 = [(4, 11), (59, 13), (1, 33), (62, 40)]
    pick = [
        (p(sweat=sw, asym=1.3, stache_tw=0.6, bristle=0.15), 3),                         # a nervous smirk
        (p(sweat=sw, bristle=0.6, bulge=0.6, squeeze=0.0, brow=1.6, furrow=-1.0), 2),   # the eyes snap open
        (p(sweat=burst, bristle=1.0, bulge=1.0, squeeze=0.0, brow=2.6, furrow=-1.0, dy=-2, ruffle=1.0, drops=d1), 3),  # BRISTLE
        (p(sweat=burst, bristle=1.0, bulge=1.0, squeeze=0.0, brow=2.4, furrow=-1.0, dy=-1, dx=1, ruffle=1.0, drops=d2), 2),
        (p(sweat=burst, bristle=0.9, bulge=0.9, squeeze=0.0, brow=2.4, furrow=-1.0, dy=-1, ruffle=1.0, drops=d2), 2),
        (p(sweat=burst, bristle=0.4, droop=0.5, **dict(grim, squeeze=0.5)), 3),           # it gives up
        (p(sweat=burst, droop=1.0, **grim), 3),                                          # the mustache droops
        (p(sweat=burst, droop=1.0, dx=1, **grim), 2),                                    # tremble
        (p(sweat=burst, droop=1.0, **grim), 2),
        (p(sweat=burst, droop=1.0, dx=1, **grim), 2),
        (p(sweat=burst + [('run', -15.0, 29.0, 37.0)], droop=1.0, **grim), 8),           # held
    ]
    return grey, loop, pick


def build(s):
    grey, loop, pick = poses()
    PK.make(s, HERO, grey, loop, pick)
