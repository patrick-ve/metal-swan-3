# BOB on the select screen (docs/design/select40.md): his 64 x 120 portrait in three states, drawn
# with the portrait kit (tools/art40/chars/_portrait). Traits: a long oval face with high
# cheekbones and a tapered chin, tousled brown hair swept up into tall tufts on top with short
# sides, straight brows, blue eyes, a straight nose, pale skin with rosy cheeks, ears that stand
# out, a wide grin that shows the upper teeth; the head a little turned and tilted. Costume as the
# 40 px hero (Captain Climate): the leaf-green suit with a crew neck and the white leaf on the
# chest, the white flag cape with the blue stripes and the blue star behind his shoulders. The
# miserable version: the grin forced and strained, deep eye bags, bloodshot corners, hollow
# cheeks, sweat. His gag (select-pick): the brave chin-up, then a gust snaps the cape up behind
# his shoulders like a flag while he clenches his teeth.
import math

import art40 as X

PK = X.char('_portrait')
C, P = PK.core, PK.parts

RAMPS = {
    'skin': ['#220e10', '#3e1c1a', '#602e28', '#844438', '#a65e4c', '#c47a64', '#dc987e', '#eeb8a0', '#fadac8'],
    'blush': ['#5e2422', '#94403a', '#c25e52', '#de8474'],
    'hair': ['#140a07', '#2c160d', '#4a2716', '#6c3c20', '#90562e', '#b47844'],
    'white': ['#5a4846', '#8f7c74', '#c7b8a6', '#ece2cf'],
    'iris': ['#122048', '#2e5ca4', '#6c9ad6'],
    'red': ['#b8463c'],
    'teeth': ['#5e4a3a', '#a08a6c', '#d2c19e', '#f0e6c8'],
    'mouth': ['#1c0a0a', '#4a1814', '#7a2c22'],
    'lip': ['#6a2a2a', '#984440', '#bc6252', '#d8826c'],
    'suit': ['#0a1c0e', '#143218', '#1e4c22', '#2c6a2e', '#428c3c', '#62ac4e'],
    'cape': ['#464c62', '#7a8298', '#b2b9cb', '#e6e9ec'],
    'blue': ['#0e1c4c', '#1c3c8e', '#2f63d2'],
}

HEAD = dict(cx=32, pivot=104, top=15, brow=39, eye=48, nose=64, mouth=77, chin=99, cran=28.0, temple=27.5,
            cheek=25.5, jaw=19.0, chinw=8.5, cap=8, tilt=1.5, eye_dx=12.5, nose_w=2.8, mouth_w=12.0)
EYES = dict(crow=1, w=6.2, up=3.2, lo=2.1, droop=0.7, ir=2.4, pupil=0.45, lid=1.3, bag=1.45, red=0.45, socket=0.24, fold=2.8)
BROWS = dict(pts=[(-5.5, -8.4), (0.0, -9.2), (5.0, -9.0), (8.0, -7.6)], w0=2.8, w1=1.6)
NOSE = dict(w=2.9, bridge=5)
MOUTH = dict(w=12.0, open=2.2, smile=1.9, teeth='upper', teeth_h=2.6, teeth_lo=1.8, lip_u=0.9, lip_l=1.9, gap=2.7,
             upper_arc=0.7)

CX = 32

# ------------------------------------------------------------------------------------------ cape


def star(cv, cx, cy, r, mat, v, g):
    """The cape's six-pointed star (two triangles), r = outer radius in px."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            px, py = x + 0.5 - cx, y + 0.5 - cy
            ins = False
            for rot in (0.0, math.pi):
                # a triangle pointing up (rot 0) or down (rot pi): three half planes
                ok = True
                for k in range(3):
                    a = rot + math.pi / 2 + k * 2 * math.pi / 3
                    if px * math.cos(a) - py * math.sin(a) > r * 0.5:
                        ok = False
                        break
                ins = ins or ok
            if ins and cv.grp(x, y) == g:
                cv.put(x, y, mat, v, g)


def cape_back(cv, hd, q):
    """The white flag cape behind the shoulders. snap 0..1 (+ overshoot): a gust lifts both halves
    up behind the shoulders, to cheek height at 1; flut: the flutter phase of the hem. The flag
    motif of the hero's cape: two blue stripes along the hem and the blue star."""
    snap = q.get('snap', 0.0)
    flut = q.get('flut', 0.0)
    dy = q.get('dy', 0)
    rise = 7 + 48 * snap
    for s in (-1, 1):
        def edge(t, s=s):
            # the hem (the top edge when it is up), t: 0 at the neck -> 1 at the frame's side
            amp = 0.5 + 1.8 * snap
            wave = math.sin(t * 8.0 + s * 1.3 + flut * 1.7) * amp * t
            return 100 + dy - rise * C.smooth(0.0, 0.8, t) * (0.5 + 0.5 * t) + wave

        def tt(x, s=s):
            return (s * (x + 0.5 - CX) - 9) / 23.0

        def inside(x, y, s=s, edge=edge, tt=tt):
            t = tt(x - 0.5)
            return t >= 0 and y >= edge(min(t, 1.4))
        P.cloth(cv, inside, 'cape', 'cape', cx=CX - 12, rx=44, top=60 if snap > 0.3 else 94,
                bias=0.1 if s < 0 else -0.1, box=(0, 30, 64, 120))
        # the folds: long creases from the shoulders up into the hem's wave
        if snap > 0.25:
            for k, t0 in enumerate((0.35, 0.62, 0.9)):
                xa = CX + s * (9 + 23 * t0)
                pts = [(xa - s * 2.5, 110), (xa - s * 0.8, edge(t0) + 14), (xa, edge(t0) + 2)]
                C.crease(cv, pts, depth=0.2, lit=0.1, groups=('cape',), width=0.6)
        # two blue stripes along the hem
        for x in range(64):
            t = tt(x)
            if t < 0.08:
                continue
            e = edge(min(t, 1.4))
            for y0, h0 in ((2.0 + 0.5 * snap, 1.6 + 1.2 * snap), (6.0 + 3.0 * snap, 1.2 + 0.8 * snap)):
                for y in range(int(math.ceil(e + y0)), int(math.ceil(e + y0 + h0))):
                    if cv.grp(x, y) == 'cape':
                        cv.put(x, y, 'blue', cv.val(x, y) * 0.75 + 0.05, 'cape')
        # the stripe at the shoulders (the cape's root): it shows beside the neck when the cape is up
        if snap > 0.3:
            for x in range(64):
                t = tt(x)
                if t < 0.0:
                    continue
                e = edge(min(t, 1.4))
                root = 106 + dy - 3 * t
                for y in range(int(e), 112):
                    f = (root - y - 0.5) / max(1.0, root - e)
                    if 0.2 <= f <= 0.2 + 3.2 / max(8.0, root - e) and cv.grp(x, y) == 'cape':
                        cv.put(x, y, 'blue', cv.val(x, y) * 0.75 + 0.05, 'cape')
        # the star on the viewer's left half, where it shows beside the neck
        if s < 0 and snap > 0.5:
            star(cv, 6.5, 80.5 + dy + (1 - snap) * 8, 4.6, 'blue', 0.62, 'cape')


# ------------------------------------------------------------------------------------------ hooks


def bust(cv, hd, q, h):
    """The cape behind, the leaf-green suit over the shoulders and the white leaf on the chest."""
    dy = q.get('dy', 0)
    sh = q.get('shrug', 0)
    cape_back(cv, hd, q)
    suit = [(-2, 121), (-2, 110 - sh), (5, 105 - sh), (16, 101 + dy - sh), (48, 101 + dy - sh), (59, 105 - sh),
            (66, 110 - sh), (66, 121)]
    P.cloth(cv, P.poly(suit), 'suit', 'body', cx=30, rx=36, top=94,
            folds=[([(13, 121), (16, 112), (20, 106 + dy)], 0.16), ([(51, 121), (48, 113), (45, 107 + dy)], 0.14)])
    # the cape's edge over the shoulder tops (it hangs from the back of the shoulders)
    for s in (-1, 1):
        lip = [(CX + s * 25, 104 - sh), (CX + s * 34, 108 - sh), (CX + s * 34, 112 - sh), (CX + s * 27, 107 - sh)]
        P.cloth(cv, P.poly(lip), 'cape', 'cape', cx=CX - 10, rx=40, top=94, bias=0.1 if s < 0 else -0.05)
    leaf(cv, CX + 10.0, 113.5 + dy, -0.75)


def leaf(cv, lx, ly, ang, n=6.5):
    """The white leaf on the chest: a pointed leaf (round at the stem, a sharp tip up-right) with a
    dark midrib, two vein pairs and a short stem; lit from the upper left."""
    ca, sa = math.cos(ang), math.sin(ang)
    for y in range(int(ly - n - 2), int(ly + n + 2)):
        for x in range(int(lx - n - 2), int(lx + n + 2)):
            px, py = x + 0.5 - lx, y + 0.5 - ly
            a, b = px * ca + py * sa, -px * sa + py * ca
            t = (a + n) / (2 * n)
            if not 0 <= t <= 1 or cv.grp(x, y) != 'body':
                continue
            half = 3.0 * math.sin(math.pi * t) ** 0.8 * (1.15 - 0.45 * t)
            if abs(b) <= half:
                v = 0.92 - 0.25 * (b > 0.4) - 0.1 * t
                cv.put(x, y, 'cape', v, 'body')
    on = lambda x, y: cv.mat(x, y) == 'cape' and cv.grp(x, y) == 'body'  # noqa: E731
    pt = lambda a, b: (lx + a * ca - b * sa, ly + a * sa + b * ca)  # noqa: E731
    C.line(cv, [pt(-n + 0.8, 0), pt(n - 1.5, 0)], 'cape', 0.3, g='body', width=0.4, clip=on)
    for a0 in (-2.0, 1.2):
        for sb in (-1, 1):
            C.line(cv, [pt(a0, 0.3 * sb), pt(a0 + 1.8, 2.0 * sb)], 'cape', 0.55, g='body', width=0.3, clip=on)
    C.line(cv, [pt(-n - 0.2, 0), pt(-n - 2.2, 0.6)], 'cape', 0.6, g='body', width=0.45)


def collar(cv, hd, q, h):
    """The suit's crew neck (a ribbed band) over the neck's lower end."""
    dy = q.get('dy', 0)

    def neckline(x):
        t = (x + 0.5 - CX) / 12.5
        return 99.5 + dy + 3.2 * (1 - t * t) if abs(t) < 1 else None

    # the suit covers everything of the neck under the neckline
    for y in range(92, 120):
        for x in range(14, 50):
            nl = neckline(x)
            if nl is not None and y + 0.5 > nl + 1.6 and cv.grp(x, y) == 'neck':
                cv.put(x, y, 'suit', 0.42 - 0.02 * (y - nl), 'body')
    # the ribbed band: a lit roll with a dark seam under it
    for x in range(17, 48):
        nl = neckline(x)
        if nl is None:
            continue
        t = (x + 0.5 - CX) / 12.5
        lit = 0.62 - 0.32 * C.clamp(t + 0.3) + 0.08 * (x % 2 == 0)
        cv.put(x, int(nl), 'suit', lit, 'body')
        cv.put(x, int(nl) + 1, 'suit', lit - 0.12, 'body')
        cv.put(x, int(nl) + 2, 'suit', 0.12, 'body')


def face(cv, hd, q, h):
    """The weary folds: the smile folds of the forced grin, the hollows under the cheekbones, the
    forehead lines and the rosy cheeks."""
    sa = q.get('smile_add', 0.0)
    for s in (-1, 1):
        P.smile_fold(cv, hd, s, dict(top=4.6, mid=10.0, end=13.2, drop=11.0 - sa * 1.2, depth=0.3))
    lift = max(q.get('brow', 0.0), q.get('brow_l', 0.0), q.get('brow_r', 0.0)) - min(0.0, q.get('furrow', 0.0))
    for k, dv in enumerate((-15.5, -19.5)):
        pts = [(-11, hd.eye + dv + 0.8), (-4, hd.eye + dv - 0.5), (4, hd.eye + dv - 0.3), (11, hd.eye + dv + 0.9)]
        C.crease(cv, hd.pts(pts), depth=0.06 + 0.06 * lift, lit=0.05, width=0.45)
    # the hollow under each cheekbone: a soft dark line from the ear down to the mouth's corner
    for s in (-1, 1):
        pts = [(s * 22.5, hd.nose - 2), (s * 19.0, hd.nose + 5), (s * 15.5, hd.mouth + 3)]
        C.crease(cv, hd.pts(pts), depth=0.07, lit=0.05, width=0.8)
    # the rosy cheeks: full on the lit cheek, faint on the shadow side (a clean patch, no speckle)
    for x, y, u, v in hd.each(-26, hd.eye, 26, hd.mouth):
        i = y * cv.w + x
        if cv.g[i] != 'skin' or cv.m[i] != 'skin' or cv.fx[i] is not None:
            continue
        for sd, amt in ((-1, 1.0), (1, 0.55)):
            g = C.gauss(u, v, sd * 14.0 + hd.turn * 0.4, hd.eye + 10.5, 4.6, 3.4) * amt
            if g > 0.5 or (g > 0.32 and C.hsh(x, y, 21) < (g - 0.32) * 5.5):
                cv.m[i] = 'blush'
                cv.v[i] = C.clamp(cv.v[i] + 0.04)
    # the ears stand out and catch the key light (BOB's ears stand out)
    for i in range(len(cv.g)):
        if cv.g[i] == 'ear' and cv.fx[i] is None:
            cv.v[i] = C.clamp(cv.v[i] + 0.2)


def beard(cv, hd, q, h):
    """He is clean-shaven: only a sleepless shadow on the jaw and the chin, a sparse grain of the
    skin's own darker steps (no stubble colours)."""
    reg = P.beard_region(hd, top=hd.mouth - 1.0, mouth_w=11.5, cheek=hd.p['cheek'] - 3)
    for x, y, u, v in hd.each(-30, hd.mouth - 4, 30, hd.chin + 2):
        i = y * cv.w + x
        if cv.g[i] != 'skin' or cv.m[i] != 'skin' or cv.fx[i] is not None:
            continue
        w = reg(u, v)
        if w > 0.3 and hd.noise(u, v, 37) < 0.3 * w:
            cv.shift(x, y, -0.09)


def hair(cv, hd, q, h):
    """Tousled brown hair: a full mass, short at the sides over the ears, a medium hairline; the
    front swept up and back into a tall top that breaks into a few loose tufts leaning to the
    viewer's right; lit locks on the key side, dark partings between the locks."""
    top = hd.top
    up = q.get('hair_up', 0.0)
    # uneven lifted clumps (the tallest swept up at the front right of the parting), not a smooth dome
    tips = [(-17.0, 2.4, 1.3), (-11.5, 6.0, 1.4), (-6.0, 3.2, 1.2), (0.5, 8.5, 1.7), (6.5, 4.2, 1.2), (11.5, 7.5, 1.5),
            (16.5, 3.8, 1.2)]

    def crest(u):
        c = (3.0 + up) * C.gauss(u, 0, 1.0, 0, 26.0, 1) ** 0.5
        for tu, th, tw in tips:
            c += (th + up * 0.5) * C.gauss(u, 0, tu, 0, tw, 1)
        return c + 1.5 * C.hsh(int((u + 40) // 2), 3, 23)

    def hairline(u):
        # a medium hairline, a little higher at the temples, broken by the roots of the locks
        root = 1.3 * (C.hsh(int(math.floor((u + 40) / 1.5)), 5, 7) - 0.5)
        return top + 13.5 - 3.6 * C.gauss(abs(u), 0, 12.5, 0, 3.6, 1) + 1.2 * C.gauss(u, 0, -3.0, 0, 5.0, 1) + root
    cran = hd.p['cran']
    side_v = lambda au: hd.eye - 13.0 + (au - cran + 4.0) * 0.8  # noqa: E731
    inside = P.hair_region(hd, hairline, lift=3.0, ext=1.5, fuzz=1.4, crest=crest, side_w=4.0, side_v=side_v, seed=19)

    def ang(u, v):
        # swept up and back, leaning to the viewer's right; the short sides comb back and up
        if abs(u) > cran - 4.5 and v > hairline(u) - 2:
            return -math.pi / 2 + (0.5 if u > 0 else -0.5)
        return -math.pi / 2 + 0.38 + 0.01 * u
    P.hair_mass(cv, hd, inside, 'hair', dome=(-4.0, top + 6, 31, 21), ang=ang, lane=1.3, length=3.5, seed=41,
                gain=1.0, amb=0.05, rimk=1.0, clump=0.26, sheen=0.3)
    clip = lambda x, y: cv.grp(x, y) == 'hair'  # noqa: E731
    # the partings between the locks: curved dark lines from the hairline up and to the right
    for gu, dh in ((-9.5, 0.0), (-1.5, 1.0), (6.0, 0.5), (12.5, 0.0)):
        hl = hairline(gu) - 1.2
        pts = [(gu - 1.5, hl), (gu - 0.4, hl - 6), (gu + 1.5, top - 1 - dh), (gu + 3.2, top - 4.5 - dh - up * 0.5)]
        C.line(cv, hd.pts(pts), 'hair', 0.05, g='hair', width=0.42, clip=clip)
    # the lit locks on the key side of each parting
    for lu, v, wd in ((-12.5, 0.95, 0.7), (-5.0, 0.9, 0.6), (2.5, 0.72, 0.45), (9.0, 0.55, 0.35)):
        hl = hairline(lu) - 2.5
        pts = [(lu - 1.0, hl), (lu, hl - 6), (lu + 1.6, top - 1), (lu + 2.6, top - 3.0 - up * 0.5)]
        C.line(cv, hd.pts(pts), 'hair', v, g='hair', width=wd, clip=clip)
    # the front of the swept-up locks faces the camera and the key light: a lit band over the roots
    for x, y, u, v in hd.each(-24, top - 8, 24, top + 18):
        if cv.grp(x, y) == 'hair' and cv.fx[y * cv.w + x] is None:
            d = hairline(u) - v
            if 1.5 < d < 7.5:
                cv.shift(x, y, 0.16 * (1 - abs(d - 4.0) / 3.5) * (1.0 - 0.6 * C.clamp((u + 6) / 24)))
    # the roots: the darkest hair where it leaves the skin (the locks rise from there)
    for x, y, u, v in hd.each(-24, top + 4, 24, top + 18):
        if cv.grp(x, y) == 'hair' and cv.grp(x, y + 1) == 'skin':
            cv.shift(x, y, -0.25)
    # dark gaps between the lifted clumps at the crest (where the tufts part)
    for gu in (-8.8, -3.0, 3.6, 9.0, 14.0):
        for x, y, u, v in hd.each(gu - 1.2, top - 10, gu + 1.2, top + 3):
            if cv.grp(x, y) == 'hair' and cv.fx[y * cv.w + x] is None and abs(u - gu - (v - top) * -0.25) < 0.6:
                cv.shift(x, y, -0.3)
    # one loose lock falls onto the forehead over the brow on the key side (the tousled edge)
    hl = hairline(-8.0)
    C.line(cv, hd.pts([(-9.0, hl - 2.0), (-8.0, hl + 1.5), (-6.6, hl + 3.2)]), 'hair', 0.4, g='hair', width=0.45)


def extra(cv, hd, q, h):
    """Last: the head's cast shadow on the cape behind it (the key light from the upper left) and
    the outline where the head and the hair stand in front of the cape."""
    C.cast(cv, ('skin', 'hair', 'ear', 'neck', 'body'), ('cape',), [(-k, -k) for k in range(1, 5)], -0.22)
    C.outline(cv, ('skin', 'hair', 'ear', 'neck'), back=('cape',))


HERO = PK.Hero('bob', RAMPS, HEAD, EYES, BROWS, NOSE, MOUTH, neck=(86, 108, 9.5),
               hooks=dict(bust=bust, collar=collar, face=face, beard=beard, hair=hair, extra=extra),
               rest=dict(smile=0.6, gaunt=1.2, sunk=1.0, gloom=0.7, look=(0.2, 0.1), furrow=-1.4, smile_add=-0.85, asym=-0.4, turn=-0.8,
                         stretch=0.3, ears=dict(out=3.4), snap=0.0),
               dith={'skin': 0.28, 'hair': 0.3, 'suit': 0.22, 'cape': 0.22, 'bg': 0.5})

SET = X.Set(prefix='char/bob', budget=64, face=1, hl='W', colours=HERO.colours())
SET.shares_prefix = True     # char/bob: the hero set's strips and these three, disjoint


def poses():
    """The three strips: (grey, loop, pick) of the portrait contract."""
    p = HERO.pose
    sw0 = [('bead', 15.0, 24.0, 2), ('bead', -16.0, 27.0, 1), ('bead', 4.0, 23.0, 1)]
    grey = [p(sweat=sw0, gloom=1.0, eye_dv=0.2, smile_add=-0.7)]
    loop = [
        (p(sweat=sw0), 44),                                              # the key pose
        (p(sweat=sw0, dy=-1, flut=0.5), 16),                             # breath in, the cape stirs
        (p(sweat=sw0, dy=-1, blink=0.5, flut=0.5), 3),                   # blink
        (p(sweat=sw0, dy=-1, blink=1.0, flut=0.5), 4),
        (p(sweat=sw0, blink=0.4), 3),
        (p(sweat=sw0[1:] + [('run', 15.0, 25.0, 29.0)], look=(1.6, 0.2)), 26),            # eye dart, the drop runs
        (p(sweat=sw0[1:] + [('run', 15.2, 25.0, 33.0)], look=(1.6, 0.2), smile_add=-0.2, asym=-0.4), 10),  # twitch
        (p(sweat=sw0[1:] + [('run', 15.4, 25.0, 37.0)], look=(0.2, 0.1), flut=1.0), 22),
        (p(sweat=sw0[1:] + [('bead', 15.0, 25.5, 1)], flut=0.5), 20),
    ]
    brave = dict(brow=1.6, furrow=-0.2, smile_add=0.25, look=(0.0, -0.4), tilt=-1.0)
    # the held grimace: the eyes squeezed, the brows knitted, the teeth clenched, the corners pulled down
    grim = dict(brow=0.6, furrow=1.4, squeeze=0.65, teeth='clench', open=2.4, smile_add=-2.5, asym=0.0, wide=0.35, stretch=1.0,
                look=(0.0, 0.0))
    gasp = dict(brow=3.0, furrow=-0.4, bulge=1.0, teeth='both', open=3.6, smile_add=-1.1, jaw=1.6, look=(0.0, -0.3))
    burst = [('bead', 14.0, 25.0, 2), ('bead', -15.0, 27.0, 2), ('bead', 4.0, 22.0, 2), ('bead', -6.0, 25.0, 1),
             ('bead', 20.0, 36.0, 1)]
    drops1 = [(5, 30), (59, 28), (2, 50)]
    drops2 = [(3, 24), (61, 22), (1, 44), (62, 52)]
    pick = [
        (p(sweat=sw0, snap=0.05, **brave), 3),                                   # chin up: the brave hero
        (p(sweat=sw0, snap=0.1, dy=-1, **dict(brave, smile_add=0.45)), 4),
        (p(sweat=burst, snap=0.55, hair_up=1.0, dy=-2, **gasp), 2),              # the gust: the cape snaps up
        (p(sweat=burst, snap=1.1, hair_up=2.0, dy=-1, drops=drops1, **gasp), 2),
        (p(sweat=burst, snap=0.95, hair_up=1.5, drops=drops2, flut=1.0, **grim), 3),   # the clenched grimace
        (p(sweat=burst, snap=1.05, hair_up=2.0, dx=1, drops=drops2, flut=2.0, **grim), 2),
        (p(sweat=burst, snap=0.92, hair_up=1.5, flut=3.0, **grim), 2),
        (p(sweat=burst, snap=1.02, hair_up=2.0, dx=1, flut=4.0, **grim), 2),
        (p(sweat=burst, snap=0.96, hair_up=1.5, flut=5.0, **dict(grim, squeeze=0.9)), 3),
        (p(sweat=burst + [('run', 4.0, 23.0, 28.0)], snap=1.0, hair_up=1.5, flut=6.0, **grim), 9),   # held
    ]
    return grey, loop, pick


def build(s):
    grey, loop, pick = poses()
    PK.make(s, HERO, grey, loop, pick)
