# VINCENT on the select screen (docs/design/select40.md): his 64 x 120 portrait in three states,
# drawn with the portrait kit (tools/art40/chars/_portrait). Traits: short dark-brown hair with a
# receding hairline and short sides, straight dark brows, brown eyes, a straight nose, a wide toothy
# grin, a short dark stubble beard and mustache; the head tilts a little. Costume as the 40 px hero:
# a brown tweed jacket, a white shirt and a thin maroon tie. The miserable version: the grin gone
# weary and strained, deep eye bags, bloodshot corners, sweat. His gag (select-pick): the raised
# eyebrow and a smug grin that turns into panic.
import math

import art40 as X

PK = X.char('_portrait')
C, P = PK.core, PK.parts

RAMPS = {
    'skin': ['#1e0e0c', '#341a15', '#4e281e', '#6a3828', '#874c35', '#a26244', '#ba7a56', '#cf946c', '#e0ae86', '#eec8a4'],
    'hair': ['#0e0807', '#1c110d', '#2d1b13', '#45291c', '#63402c'],
    'white': ['#5a4846', '#8f7c74', '#c7b8a6', '#ece2cf'],
    'iris': ['#2a1a10', '#5b3a1e', '#8a6232'],
    'red': ['#b8463c'],
    'teeth': ['#5e4a3a', '#a08a6c', '#d2c19e', '#f0e6c8'],
    'mouth': ['#1c0a0a', '#4a1814', '#7a2c22'],
    'lip': ['#5a2219', '#8a3b2b', '#b45a43', '#d28064'],
    'stub': ['#1a1210', '#2c201b', '#433128', '#5c4536', '#765a46'],
    'tweed': ['#1e140e', '#35241a', '#523726', '#6e4c33', '#8d6745', '#ad875d'],
    'shirt': ['#6b7078', '#9ea4ab', '#cfd3d6', '#f1f1ee'],
    'tie': ['#2a0a0e', '#4e1218', '#721c24', '#962c34'],
}

HEAD = dict(cx=32, pivot=104, top=4, brow=34, eye=44, nose=62, mouth=76, chin=100, cran=27.0, temple=26.5,
            cheek=26.0, jaw=21.5, chinw=11.5, cap=8, tilt=-1.5, eye_dx=14.0, nose_w=3.2, mouth_w=12.5)
EYES = dict(w=7.0, up=4.0, lo=2.6, droop=0.9, ir=2.4, pupil=0.5, lid=1.4, bag=1.4, red=0.45, socket=0.24, fold=3.0)
BROWS = dict(pts=[(-5.5, -8.4), (0.5, -9.4), (6.0, -8.8), (9.0, -7.2)], w0=3.4, w1=2.0)
NOSE = dict(w=3.4, bridge=5)
MOUTH = dict(w=12.0, open=2.4, smile=1.5, teeth='upper', teeth_h=2.8, teeth_lo=2.0, lip_u=1.1, lip_l=2.2, gap=3.0, upper_arc=0.6)


# ------------------------------------------------------------------------------------------ hooks


def bust(cv, hd, q, h):
    """The tweed jacket, the white shirt's collar, the thin maroon tie."""
    dy = q.get('dy', 0)
    sh = q.get('shrug', 0)
    jacket = [(-2, 121), (-2, 110 - sh), (6, 105 - sh), (18, 102 + dy - sh), (46, 102 + dy - sh), (58, 105 - sh), (66, 110 - sh), (66, 121)]
    inside = P.poly(jacket)

    def tweed(x, y):
        return inside(x, y)
    P.cloth(cv, tweed, 'tweed', 'body', cx=30, rx=36, top=92)
    # the herringbone grain: alternating diagonal ribs, one step apart
    for y in range(88, 120):
        for x in range(64):
            if cv.grp(x, y) == 'body':
                rib = ((x + (y if (x // 3) % 2 else -y)) % 3 == 0)
                cv.shift(x, y, 0.07 if rib else -0.03)
    # the shirt between the lapels
    v = P.poly([(21, 101 + dy), (43, 101 + dy), (39, 121), (25, 121)])
    P.cloth(cv, v, 'shirt', 'shirt', cx=33, rx=16, top=92, bias=0.12)
    # the lapels: the jacket folds back from the collar to the button line
    for s in (-1, 1):
        lap = [(32 + s * 11.5, 102 + dy), (32 + s * 16, 105 + dy), (32 + s * 10.5, 115), (32 + s * 7.4, 121), (32 + s * 6.6, 121), (32 + s * 8.6, 112)]
        P.cloth(cv, P.poly(lap), 'tweed', 'body', cx=30, rx=30, top=98, bias=0.1 if s < 0 else -0.05)
        C.line(cv, [(32 + s * 16, 105 + dy), (32 + s * 10.5, 115), (32 + s * 7.4, 121)], 'tweed', 0.0, g='body', width=0.45)


def collar(cv, hd, q, h):
    """The white collar points round the neck and the tie: the knot and the thin blade."""
    dy = q.get('dy', 0)
    for s in (-1, 1):
        pts = [(32 + s * 11.5, 98 + dy), (32 + s * 1.5, 105 + dy), (32 + s * 4.5, 109 + dy), (32 + s * 12, 104 + dy)]
        P.cloth(cv, P.poly(pts), 'shirt', 'shirt', cx=32 - s * 4, rx=12, top=90, bias=0.2 if s < 0 else 0.0)
    # the gag: tie_up (0..1) flings the blade up and over to the viewer's right; tight (0..1)
    # pinches the knot (the choke gulp)
    up = q.get('tie_up', 0.0)
    kw = 2.8 - 0.9 * q.get('tight', 0.0)
    knot = P.poly([(32 - kw, 104 + dy), (32 + kw, 104 + dy), (32 + kw - 1.0, 108.5 + dy), (32 - kw + 1.0, 108.5 + dy)])
    ang = math.radians(-115 * up)
    def tip(px, py):
        ox, oy = px - 32, py - (108.5 + dy)
        return (32 + ox * math.cos(ang) - oy * math.sin(ang), 108.5 + dy + ox * math.sin(ang) + oy * math.cos(ang))
    blade = P.poly([(30.4, 108.5 + dy), (33.6, 108.5 + dy), tip(35, 121), tip(32, 123), tip(29, 121)])
    P.cloth(cv, lambda x, y: knot(x, y) or blade(x, y), 'tie', 'shirt', cx=31, rx=5, top=100, bias=0.1)
    C.line(cv, [(30.2, 108.7 + dy), (33.8, 108.7 + dy)], 'tie', 0.05, g='shirt', width=0.5)


def face(cv, hd, q, h):
    """The weary folds: the smile folds, the forehead lines, the cheek hollows' edge."""
    for s in (-1, 1):
        P.smile_fold(cv, hd, s, dict(top=5.0, mid=11.5, end=14.0, drop=11.0 + q.get('smile_add', 0) * -1.0, depth=0.36))
    lift = max(q.get('brow', 0.0), q.get('brow_l', 0.0), q.get('brow_r', 0.0))
    for k, dv in enumerate((-17.0, -21.5)):
        pts = [(-13, hd.eye + dv + 0.8), (-5, hd.eye + dv - 0.6), (5, hd.eye + dv - 0.3), (13, hd.eye + dv + 0.9)]
        C.crease(cv, hd.pts(pts), depth=0.08 + 0.06 * lift, lit=0.05, width=0.45)


def beard(cv, hd, q, h):
    reg = P.beard_region(hd, top=hd.nose + 4.5, mouth_w=12.5)

    def region(u, v):
        w = reg(u, v)
        # the mustache: thick over the upper lip, the soul patch under the lower lip
        au = abs(u - hd.turn * 0.7)
        if hd.mouth - 5.0 < v < hd.mouth - 0.8 and au < 13:
            w = max(w, 1.5 * (1.0 - smooth(10.5, 13.5, au)))
        return w
    # short stubble: the skin shows through the grain (only the mustache is dense)
    P.stubble(cv, hd, region, edge=1.35, speck=0.4, seed=31, keep=0.8, lift=0.1)


def smooth(a, b, x):
    return C.smooth(a, b, x)


def hair(cv, hd, q, h):
    """Short dark-brown hair, a receding hairline with a short peak in front, short sides."""
    top, cran = hd.top, hd.p['cran']
    vc = hd.vc

    def hairline(u):
        au = abs(u)
        hl = top + 15.5 - 6.0 * C.gauss(au, 0, 12.5, 0, 3.8, 1) + 1.8 * C.gauss(au, 0, 0, 0, 3.6, 1)
        if au > 18:
            hl += (au - 18) * 1.9
        return hl

    def inside(u, v):
        au = abs(u)
        if v < vc:
            t = (vc - v) / (vc - top + 2.8)
            if t >= 1:
                return False
            w = (cran + 0.5) * math.sqrt(1 - t * t)
            fuzz = 1.0 * C.hsh(int((u + 40) // 2), 0, 3)
            if au > w - fuzz * 0.6:
                return False
            if v < top - 2.8 + fuzz * 1.4:
                return False
        else:
            w = hd.width(v)
            if au > w + 1.2:
                return False
        if v < hairline(u):
            return True
        # the short sides down to the sideburns (in front of the ears)
        if au > cran - 2.6 and v < hd.eye - 5.5 + (au - cran + 2.6) * 1.2:
            return True
        return False
    P.hair_mass(cv, hd, inside, 'hair', dome=(-2.0, top + 11, cran + 4, 18), ang=lambda u, v: -math.pi / 2 + u * 0.045,
                lane=1.0, length=3.5, seed=17, gain=0.85, amb=0.04, rimk=1.0, clump=0.42, sheen=0.45)
    # the hairline's edge: a darker fringe of single hairs onto the forehead
    for x, y, u, v in hd.each(-20, top + 5, 20, top + 18):
        if cv.grp(x, y) == 'skin' and v < hairline(u) + 1.2 and C.hsh(x, y, 9) < 0.45:
            cv.put(x, y, 'hair', 0.18, 'hair')


HERO = PK.Hero('vincent', RAMPS, HEAD, EYES, BROWS, NOSE, MOUTH, neck=(90, 112, 13),
               hooks=dict(bust=bust, collar=collar, face=face, beard=beard, hair=hair),
               rest=dict(gaunt=1.3, sunk=1.0, gloom=0.8, look=(0.3, 0.1), furrow=-1.3, smile_add=-0.75, asym=-0.45,
                         ears=dict(out=4.6, v0=41.0, v1=65.0)),
               dith={'skin': 0.3, 'hair': 0.3, 'tweed': 0.2, 'stub': 0.2, 'bg': 0.5})

SET = X.Set(prefix='char/vincent', budget=64, face=1, hl='W', colours=HERO.colours())
SET.shares_prefix = True     # char/vincent: the hero set's strips and these three, disjoint


def poses():
    """The three strips: (grey, loop, pick) of the portrait contract."""
    p = HERO.pose
    sw0 = [('bead', -18.0, 24.0, 2), ('bead', 16.0, 20.0, 1), ('bead', 7.0, 25.0, 1)]
    key = p(sweat=sw0)
    grey = [p(sweat=sw0, gloom=1.0, eye_dv=0.2, smile_add=-0.3)]
    loop = [
        (key, 44),
        (p(sweat=sw0, dy=-1), 16),                                      # breath in
        (p(sweat=sw0, dy=-1, blink=0.5), 3),                            # blink
        (p(sweat=sw0, dy=-1, blink=1.0), 4),
        (p(sweat=sw0, dy=0, blink=0.4), 3),
        (p(sweat=sw0[1:] + [('run', -18.0, 25.0, 29.0)], look=(-1.6, 0.2)), 26),   # eye dart, the drop runs
        (p(sweat=sw0[1:] + [('run', -18.2, 25.0, 33.0)], look=(-1.6, 0.2), smile_add=0.25, asym=0.35), 10),  # the twitch
        (p(sweat=sw0[1:] + [('run', -18.4, 25.0, 37.0)], look=(0.3, 0.1)), 22),
        (p(sweat=sw0[1:] + [('bead', -18.0, 25.5, 1)], dy=0), 20),
    ]
    smug = dict(brow_l=4.6, arch_l=1.6, brow_r=-1.2, smug_r=0.6, smug_l=0.0, asym=1.4, smile_add=0.5, look=(1.4, 0.0))
    panic = dict(brow=3.2, furrow=-0.2, bulge=1.0, look=(0.0, -0.3), teeth='both', open=2.6, smile_add=-0.9, wide=0.25)
    # the held grimace: the eyes squeezed, the brows knitted, the teeth clenched, the corners pulled down
    grim = dict(brow=0.6, furrow=1.4, bulge=0.0, squeeze=0.7, teeth='clench', open=2.4, smile_add=-2.6, asym=0.0, wide=0.4,
                stretch=1.0, look=(0.0, 0.0), tight=1.0)
    burst = [('bead', -15.0, 26.0, 2), ('bead', 13.0, 22.5, 2), ('bead', 6.0, 28.0, 2), ('bead', -6.0, 24.0, 1), ('bead', 18.0, 33.0, 1)]
    drops1 = [(6, 18), (58, 20), (3, 40)]
    drops2 = [(4, 13), (60, 15), (1, 36), (62, 44)]
    pick = [
        (p(sweat=sw0, **dict(smug, brow_l=2.4, asym=0.8)), 2),
        (p(sweat=sw0, **smug), 3),
        (p(sweat=sw0, **dict(smug, brow_l=5.4, arch_l=2.0, asym=1.7)), 6),           # the smug grin, one brow up high
        (p(sweat=sw0, **dict(brow=2.0, look=(0.0, -0.2), bulge=0.4, smile_add=0.1, tie_up=0.25)), 2),   # it dawns on him
        (p(sweat=burst, dy=-2, tie_up=1.0, **panic), 2),                  # PANIC: the jaw drops, the tie flies up
        (p(sweat=burst, dy=-1, drops=drops1, jaw=1.5, tie_up=0.7, **panic), 2),
        (p(sweat=burst, dy=0, drops=drops2, **dict(grim, tie_up=0.25, tight=0.5)), 3),   # the grimace, the tie drops back
        (p(sweat=burst, dy=0, dx=1, drops=drops2, **grim), 2),            # tremble
        (p(sweat=burst, dy=0, dx=0, **grim), 2),
        (p(sweat=burst, dy=0, dx=1, **grim), 2),
        (p(sweat=burst, dy=0, dx=0, **dict(grim, squeeze=0.9)), 3),
        (p(sweat=burst + [('run', 6.0, 28.0, 33.0)], **grim), 7),          # held
    ]
    return grey, loop, pick


def build(s):
    grey, loop, pick = poses()
    PK.make(s, HERO, grey, loop, pick)
