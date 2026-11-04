# THOM on the select screen (docs/design/select40.md): his 64 x 120 portrait in three states, drawn
# with the portrait kit (tools/art40/chars/_portrait). Traits: the navy cap worn backwards and low
# (a small light patch on its panel, the brim sticking out behind his right ear), a shaved head
# with a light blond buzz at the temples, a wide face with full cheeks over a narrow, pointed
# chin, fair rosy skin, a broad nose with a pink tip, prominent ears, a huge toothy grin with a
# happy squint and crow's feet, light thin brows; the head tilts to the viewer's left and turns a
# little that way. Costume as the 40 px hero: the Dutch multi-colour camo (sand, olive, brown and
# black blotches), cut as a crew-neck tee; one shoulder rides higher (he leans in). The miserable
# version: the grin strained, deep bags under the squint, bloodshot corners, a sunburnt flush,
# sparse stubble, sweat. His gag (select-pick): the cap pops off his shaved head with the brim
# jolting up, lands crooked, and the grin turns into a wince.
import math

import art40 as X

PK = X.char('_portrait')
C, P = PK.core, PK.parts

RAMPS = {
    'skin': ['#1e0a0e', '#3a1418', '#5a2222', '#7c3830', '#a05244', '#c06e5a', '#d88c74', '#eaa98e', '#f6c6ae', '#fde0cc'],
    'blush': ['#2a0c14', '#6a2230', '#c45a5c', '#ee9890', '#fdd8d0'],
    'hair': ['#4e3a1e', '#866a3c', '#b89a5c', '#dcc48a'],
    'white': ['#5a4846', '#8f7c74', '#c7b8a6', '#ece2cf'],
    'iris': ['#1a242e', '#3a5262', '#6a8898'],
    'red': ['#b8463c'],
    'teeth': ['#5e4a3a', '#a08a6c', '#d2c19e', '#f0e6c8'],
    'mouth': ['#1c0a0a', '#4a1814', '#7a2c22'],
    'lip': ['#6a2a2a', '#94403c', '#ba5e54'],
    'cap': ['#090c18', '#121a30', '#1d2848', '#2b3b64', '#3f5384'],
    'camo': ['#3e3a28', '#6c6648', '#9e9676', '#c8be9c'],
    'olive': ['#262c14', '#46522a', '#6c783e'],
    'camb': ['#2a1c12', '#4e3622', '#7a5a3a'],
}

# The head: wide over the cheeks, the chin narrow; the cap's band sits low (BAND under the brow line).
HEAD = dict(cx=36, pivot=96, top=14, brow=43, eye=50, nose=62, mouth=72, chin=92, cran=26.0, temple=26.5,
            cheek=27.5, jaw=21.5, chinw=10.5, cap=10, tilt=-10, eye_dx=12.5, nose_w=4.2, mouth_w=15)
EYES = dict(w=6.2, up=2.6, lo=1.6, droop=0.5, ir=2.2, pupil=0.45, lid=1.4, bag=1.4, red=0.3, socket=0.18, fold=2.4,
            crow=1)
BROWS = dict(pts=[(-5.0, -6.6), (0.0, -7.8), (5.0, -7.6), (8.0, -6.0)], w0=1.9, w1=1.1)
NOSE = dict(w=3.8, bridge=5)
MOUTH = dict(w=14.0, open=3.2, smile=2.2, teeth='upper', teeth_h=3.2, teeth_lo=1.6, lip_u=0.9, lip_l=1.8, gap=2.9,
             upper_arc=0.8, asym=0.25)
BAND = -5.5          # the cap band's lower edge at the centre, relative to the brow line (v)


def band(hd, u, q):
    """The cap band's lower edge (head space v) at u: low and curved round the skull."""
    return hd.brow + BAND + 0.011 * u * u - q.get('capup', 0.0) + q.get('capcant', 0.0) * u * 0.06

# ------------------------------------------------------------------------------------------ hooks


def bust(cv, hd, q, h):
    """The crew-neck tee in the Dutch camo (one shoulder higher: he leans in) and the cap's brim
    behind the head (the cap is on backwards), jolting up in the pick."""
    dy = q.get('dy', 0)
    sh = q.get('shrug', 0)
    tee = [(-2, 121), (-2, 104 - sh), (6, 99 - sh), (20, 94 + dy - sh), (46, 92 + dy - sh), (57, 93 - sh), (66, 96 - sh),
           (66, 121)]
    P.cloth(cv, P.poly(tee), 'camo', 'body', cx=32, rx=34, top=90, gain=0.78, bias=-0.04)
    camo(cv, 'body', 0)
    # the shoulder seams and a fold of the sleeve over the higher shoulder
    folds = [([(10, 99), (4, 108), (2, 121)], 0.25), ([(55, 94), (59, 104), (61, 121)], 0.22),
             ([(24, 108), (31, 113), (40, 111)], 0.18)]
    for pts, dep in folds:
        C.crease(cv, pts, depth=dep, lit=0.08, groups=('body',), width=0.5)
    # the brim: out from behind the head's right side under the band, down past the ear
    brim(cv, hd, q)


def brim(cv, hd, q):
    """The brim (group 'cloth', so the dome's seam over it can be found): its dark underside faces
    the viewer, its upper edge catches the rim light. jolt (q['brim']) swings it up about its root."""
    cran = hd.p['cran']
    jolt = q.get('brim', 0.0)
    b0 = band(hd, cran - 2, q)
    root = (cran - 3.5, b0 - 2.0)
    pts = [(cran - 5, b0 - 4.0), (cran + 4.0, b0 - 4.5), (cran + 10.5, b0 + 1.5), (cran + 10.0, b0 + 8.5),
           (cran + 2.0, b0 + 5.0)]
    a = math.radians(-16.0 * jolt)
    ca, sa = math.cos(a), math.sin(a)
    rot = [(root[0] + (u - root[0]) * ca - (v - root[1]) * sa, root[1] + (u - root[0]) * sa + (v - root[1]) * ca)
           for u, v in pts]
    sp = hd.pts(rot)
    edge = sp[1:3]                 # the upper outer edge (lit)
    inside = P.poly(sp)
    for y in range(0, 96):
        for x in range(24, 64):
            if not inside(x + 0.5, y + 0.5):
                continue
            d, _, _ = C.poly_dist(x + 0.5, y + 0.5, edge)
            val = 0.22 + 0.4 * C.smooth(1.8, 0.4, d)
            cv.put(x, y, 'cap', C.clamp(val), 'cloth', 0.7 if d < 1.0 else 0.0)


def camo(cv, g, seed):
    """The Dutch multi-colour camo on a cloth group: olive and brown blotches and black spots over
    the sand base, each keeping the cloth's light value."""
    for y in range(80, 120):
        for x in range(64):
            i = y * 64 + x
            if cv.g[i] != g or cv.fx[i] is not None:
                continue
            a = P.vnoise(x * 1.1 + y * 0.35, y, 6.0, 41 + seed)
            b = P.vnoise(x + 23, y * 1.2, 5.0, 43 + seed)
            k = P.vnoise(x + 7, y + 11, 3.0, 47 + seed)
            if b > 0.66:
                cv.m[i] = 'camb'
                cv.v[i] = C.clamp(cv.v[i] * 0.9)
            elif a > 0.56:
                cv.m[i] = 'olive'
            elif k > 0.8:
                cv.m[i] = 'camb'
                cv.v[i] = C.clamp(cv.v[i] * 0.25)
            else:
                cv.v[i] = C.clamp(cv.v[i] * 0.92 + 0.02)


def collar(cv, hd, q, h):
    """The ribbed crew neck round the neck: a lit band with a dark shadow on the neck over it."""
    dy = q.get('dy', 0)
    nk = [(22, 93.6 + dy), (28, 97.2 + dy), (35, 98.4 + dy), (42, 96.8 + dy), (47, 92.6 + dy)]
    for k in range(2):
        pts = [(x, y + k) for x, y in nk]
        C.line(cv, pts, 'camo', 0.62 - 0.32 * k, g='body', width=0.55)


def face(cv, hd, q, h):
    """The full cheeks' folds, the crow's feet of the squint, the sunburnt flush, the pink nose tip,
    the cap's shadow on the forehead, the sparse stubble."""
    sq = q.get('squeeze', 0.0)
    for s in (-1, 1):
        P.smile_fold(cv, hd, s, dict(top=5.0, mid=12.0, end=15.5, drop=10.5 + q.get('smile_add', 0) * -1.2,
                                         depth=0.26 if s < 0 else 0.16))
        # extra crow's feet fanned out from the outer corner (more as the squint tightens)
        cu = s * hd.p['eye_dx'] + hd.turn * 0.45
        for k, dv in enumerate((-2.2, 0.4, 2.8)[:3 if s < 0 else 2]):
            a = (cu + s * 7.0, hd.eye + dv * 0.5)
            b = (cu + s * (10.0 + 0.6 * sq), hd.eye + dv * 1.3 - 0.6)
            C.crease(cv, hd.pts([a, b]), depth=0.16 + 0.12 * sq, lit=0.06, width=0.45)
        # the cheek apple's lower edge (the grin pushes them up)
        if s < 0:
            pts = [(cu - s * 1.0, hd.eye + 9.0), (cu + s * 3.5, hd.eye + 10.0), (cu + s * 7.5, hd.eye + 8.0)]
            C.crease(cv, hd.pts(pts), depth=0.12, lit=0.1, width=0.5)
    P.blush(cv, hd, amount=0.04, du=13.5, dv=9.0)
    # the nose tip: pink
    t = hd.turn
    for x, y, u, v in hd.each(t - 4, hd.nose - 5, t + 4, hd.nose + 1):
        if cv.grp(x, y) == 'skin' and cv.fx[y * 64 + x] is None and C.gauss(u, v, t, hd.nose - 2.2, 2.8, 2.2) > 0.5:
            cv.m[y * 64 + x] = 'blush'
    # the cap's cast shadow on the forehead under the band (the key light is high)
    for x, y, u, v in hd.each(-30, hd.top, 30, hd.brow + 2):
        if cv.grp(x, y) != 'skin':
            continue
        d = v - band(hd, u, q)
        if 0 <= d < 3.5:
            cv.shift(x, y, -0.32 * (1 - d / 3.5))
    # the forehead strain lines between the band and the brows
    lift = max(q.get('brow', 0.0), 0.0)
    for dv in (-3.4,):
        pts = [(-9, hd.brow + dv + 0.6), (-3, hd.brow + dv - 0.4), (4, hd.brow + dv - 0.3), (10, hd.brow + dv + 0.7)]
        C.crease(cv, hd.pts(pts), depth=0.1 + 0.08 * lift, lit=0.05, width=0.45)
    # sparse stubble: dark specks on the jaw, the chin and the upper lip (a day unshaven)
    reg = P.beard_region(hd, top=hd.nose + 5.0, mouth_w=14.0)
    for x, y, u, v in hd.each(-30, hd.nose + 3, 30, hd.chin + 1):
        i = y * 64 + x
        if cv.g[i] != 'skin' or cv.m[i] != 'skin' or cv.fx[i] is not None:
            continue
        w = reg(u, v)
        if w > 0.3 and C.hsh(x, y, 37) < 0.15 * w:
            cv.v[i] = C.clamp(cv.v[i] - 0.16)

def hair(cv, hd, q, h):
    """The shaved head: a light blond buzz at the temples and over the ears (and on the scalp the
    pick's cap pop shows), then the cap over it: the dome with its seams and top button, the patch,
    the band low on the brow."""
    top, cran = hd.top, hd.p['cran']
    cup = q.get('capup', 0.0)
    # the buzz: specks of the hair ramp over the skin of the scalp and the temples
    for x, y, u, v in hd.each(-cran - 1, top - 1, cran + 1, hd.eye):
        if cv.grp(x, y) != 'skin' or cv.fx[y * 64 + x] is not None:
            continue
        au = abs(u)
        scalp = v < band(hd, u, {}) - 0.6
        temple = au > cran - 5.5 and v < hd.eye - 4.0 - (cran - au) * 0.6
        if not (scalp or temple):
            continue
        if C.hsh(x, y, 13) < 0.55:
            cv.put(x, y, 'hair', C.clamp(cv.v[y * 64 + x] * 0.85 + 0.05), 'skin')
    # the cap: the dome down to the band (lifted by capup, canted by capcant)
    lift = 4.5

    def cap(u, v):
        if v > band(hd, u, q):
            return False
        vv = v + cup
        vc = hd.vc
        if vv < vc:
            t = (vc - vv) / (vc - top + lift)
            if t >= 1:
                return False
            return abs(u) <= (cran + 1.8) * math.sqrt(1 - t * t)
        return abs(u) <= hd.width(vv) + 1.8
    P.hair_mass(cv, hd, cap, 'cap', dome=(-4.0, top + 10 - cup, cran + 5, 21), lane=3.0, length=30, seed=7,
                gain=1.0, amb=0.03, rimk=0.75, g='cap', clump=0.05, sheen=0.3)
    # the six panels' seams down from the top button
    for k in (-1, 1):
        pts = [(k * 1.0, top - 3.6 - cup), (k * 8.0, top + 5 - cup), (k * 12.0, band(hd, k * 12.0, q) - 1)]
        C.crease(cv, hd.pts(pts), depth=0.22, lit=0.1, groups=('cap',), width=0.45)
    for k in (-1, 1):
        pts = [(k * 2.0, top - 3.4 - cup), (k * 17.0, top + 6 - cup), (k * 23.0, band(hd, k * 23.0, q) - 1.5)]
        C.crease(cv, hd.pts(pts), depth=0.18, lit=0.08, groups=('cap',), width=0.45)
    bx, by = hd.xy(0.0, top - 3.8 - cup)
    cv.put(int(bx), int(by), 'cap', 0.7, 'cap')
    cv.put(int(bx) + 1, int(by), 'cap', 0.45, 'cap')
    # the small light patch on the panel over the band (left of the centre)
    pv = band(hd, -4.0, q) - 4.2
    for x, y, u, v in hd.each(-8.5, pv - 1.5, 0.5, pv + 2.5):
        if cv.grp(x, y) != 'cap':
            continue
        if -8.0 <= u <= 0.0 and pv - 1.2 <= v <= pv + 2.2:
            edge = u < -7.2 or u > -0.8 or v < pv - 0.5 or v > pv + 1.5
            cv.put(x, y, 'teeth', 0.32 if edge else 0.88 - 0.05 * (u + 4) ** 2 / 4, 'cap')
            if not edge and -5.2 < u < -2.6 and pv < v < pv + 1:
                cv.put(x, y, 'cap', 0.35, 'cap')
    # the band: a darker stitched strip along the cap's lower edge, its edge lit a little
    for x, y, u, v in hd.each(-cran - 3, top, cran + 3, hd.brow + 2):
        if cv.grp(x, y) != 'cap':
            continue
        d = band(hd, u, q) - v
        if d < 2.4:
            cv.shift(x, y, -0.18 if d > 0.9 else 0.1)

    # the seam where the dome meets the brim behind it
    seam = [(x, y) for y in range(1, 119) for x in range(1, 63) if cv.grp(x, y) == 'cap' and
            any(cv.grp(x + dx, y + dy) == 'cloth' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in seam:
        cv.fix(x, y, 'K')

def extra(cv, hd, q, h):
    """The left ear hides behind the cheek (the head turns that way): only its rim shows."""
    ex = hd.p['eye_dx']
    for x, y, u, v in hd.each(-hd.p['cran'] - 6, hd.eye - 4, -ex, hd.nose + 3):
        if cv.grp(x, y) != 'ear':
            continue
        if u < -hd.width(v) - 1.4:
            cv.fix(x, y, 'K', 'bg') if u > -hd.width(v) - 2.4 else _bg(cv, x, y)


_BACK = []


def _bg(cv, x, y):
    """Put the booth's backdrop back on a pixel (the same light as the backdrop pass)."""
    if not _BACK:
        b = C.Canvas()
        P.backdrop(b)
        _BACK.append(b)
    b = _BACK[0]
    i = y * 64 + x
    cv.unfix(x, y)
    cv.put(x, y, b.m[i], b.v[i], 'bg')



class Thom(PK.Hero):
    """THOM's rig: the kit's Hero with a brighter grey curve (his fair, rosy skin has a low luma in
    red, so the kit's default curve sinks his unlit face into the booth's dark)."""

    def grey(self, cv, rows, curve=0.95, gain=1.14, **k):
        return super().grey(cv, rows, curve, gain, **k)


HERO = Thom('thom', RAMPS, HEAD, EYES, BROWS, NOSE, MOUTH, neck=(80, 100, 9),
               hooks=dict(bust=bust, collar=collar, face=face, hair=hair, extra=extra),
               rest=dict(gaunt=1.1, sunk=0.9, gloom=0.7, look=(0.6, 0.0), squeeze=0.6, smug_r=0.3, furrow=-1.3,
                         smile_add=-0.55, asym=-0.4, smile=0.8, turn=-2.0, ears=dict(out=3.8)),
               dith={'skin': 0.14, 'cap': 0.2, 'camo': 0.25, 'olive': 0.2, 'camb': 0.2, 'blush': 0.2, 'bg': 0.5})

HERO.pal.alias('brow', HERO.pal['hair'][:3])

SET = X.Set(prefix='char/thom', budget=64, face=1, hl='W', colours=HERO.colours())
SET.shares_prefix = True     # char/thom: the hero set's strips and these three, disjoint


def poses():
    """The three strips: (grey, loop, pick) of the portrait contract."""
    p = HERO.pose
    sw = [('bead', -19.0, 45.0, 2), ('bead', 6.0, 39.5, 1), ('bead', 20.0, 46.0, 1), ('bead', -3.0, 40.0, 1)]
    grey = [p(sweat=sw, gloom=1.0, smile_add=-0.5, eye_dv=0.2)]
    loop = PK.rig.loop_poses(p, sw, -19.0, 45.0, dart=1.4, twitch={'smile_add': 0.2, 'asym': 0.6, 'smug_r': 0.6})
    wince = dict(squeeze=1.0, blink=0.7, furrow=1.6, brow=-0.8, teeth='clench', smile_add=-2.7, open=2.6, wide=0.45,
                 stretch=1.0, smug_r=0.0, asym=-0.5, look=(0.0, 0.0))
    jolt = dict(bulge=1.0, squeeze=0.0, smug_r=0.0, brow=2.6, furrow=-0.4, teeth='both', open=2.4, smile_add=0.1)
    burst = sw + [('bead', -9.0, 39.5, 2), ('bead', 13.0, 40.5, 2), ('bead', 23.0, 52.0, 1), ('bead', -5.0, 67.5, 1)]
    drops1 = [(6, 20), (58, 16), (2, 40)]
    drops2 = [(4, 14), (61, 10), (1, 34), (62, 40)]
    pick = [
        (p(sweat=sw, smile_add=0.3, squeeze=0.8), 2),                                      # the grin widens
        (p(sweat=sw, smile_add=0.4, squeeze=1.0, capup=1.0, brim=0.6), 2),
        (p(sweat=burst, dy=-2, capup=5.0, capcant=-1.0, brim=2.0, **jolt), 4),             # POP: the cap jumps, the brim jolts
        (p(sweat=burst, dy=-1, capup=6.0, capcant=-1.5, brim=2.4, drops=drops1, **jolt), 3),
        (p(sweat=burst, dy=0, capup=2.0, capcant=1.2, brim=0.8, drops=drops2, **wince), 2),  # it lands crooked: the wince
        (p(sweat=burst, dy=1, capup=0.5, capcant=1.6, brim=-0.6, drops=drops2, **wince), 2),
        (p(sweat=burst, capup=1.0, capcant=1.6, brim=0.3, dx=1, **wince), 2),              # the brim bounces, tremble
        (p(sweat=burst, capup=1.0, capcant=1.6, brim=0.0, **wince), 2),
        (p(sweat=burst, capup=1.0, capcant=1.6, dx=1, **wince), 2),
        (p(sweat=burst, capup=1.0, capcant=1.6, **dict(wince, squeeze=0.8)), 3),
        (p(sweat=burst + [('run', -19.0, 45.0, 53.0)], capup=1.0, capcant=1.6, **wince), 8),  # held
    ]
    return grey, loop, pick


def build(s):
    grey, loop, pick = poses()
    PK.make(s, HERO, grey, loop, pick)
