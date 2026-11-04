# The face and bust parts of the portrait kit (docs/design/select40.md): the backdrop of the photo
# booth, eyes (bags, strain, blink, bulge, squeeze, dart, bloodshot corners), brows, the nose's
# nostrils and glint, the mouth from grin to grimace (lips, teeth, the dark inside), stubble,
# sweat beads and runs, veins, wrinkles, hair masses with strands, and the bust (neck, shoulders,
# collars). Every part draws in head space (hd.each / hd.pts) so a tilt or a shift moves it with the
# skull. Pure Python, deterministic (hash noise only).
import math

from . import core as C
from .core import KEY, RIM, HALF, W, H, clamp, dot, gauss, hsh, norm3, smooth, poly_dist, in_poly, tube, crease

# ------------------------------------------------------------------------------------------ backdrop


def backdrop(cv, mat='bg', cx=40, cy=30, spread=58, lo=0.08, hi=0.78, seed=5):
    """The photo booth behind the shutter: a dark wall with a soft pool of light behind the head
    (upper right, the rim light's side) and a darker floor band at the bottom; a faint vertical
    fold of the booth curtain every 11 px."""
    for y in range(cv.h):
        for x in range(cv.w):
            d = math.hypot((x - cx) / 1.0, (y - cy) / 1.25) / spread
            v = lo + (hi - lo) * clamp(1 - d) ** 1.6
            fold = math.sin((x + 3) * 2 * math.pi / 11.0)
            v += 0.05 * fold * clamp(1 - d)
            v -= 0.25 * smooth(80, 120, y)
            cv.put(x, y, mat, clamp(v), 'bg')

# ------------------------------------------------------------------------------------------ eyes


def eye_shape(hd, side, e, q):
    """The open eye of one side: centre (u, v), half width, upper / lower opening at an offset."""
    ex = hd.p['eye_dx']
    cu = side * ex + hd.turn * 0.45 + e.get('du', 0.0)
    cv0 = hd.eye + e.get('dv', 0.0) + q.get('eye_dv', 0.0)
    ew = e.get('w', 5.0) * (1 + 0.12 * q.get('bulge', 0.0))
    up = e.get('up', 3.2) * (1 + 0.45 * q.get('bulge', 0.0)) * (1 - 0.55 * q.get('squeeze', 0.0))
    lo = e.get('lo', 1.8) * (1 + 0.35 * q.get('bulge', 0.0)) * (1 - 0.5 * q.get('squeeze', 0.0))
    smug = q.get('smug_' + ('l' if side < 0 else 'r'), q.get('smug', 0.0))
    up *= 1 - 0.45 * smug
    blink = q.get('blink', 0.0)
    if q.get('wink') == side:
        blink = 1.0
    up *= 1 - blink
    lo *= 1 - blink * 0.85
    droop = e.get('droop', 0.6)          # the outer corner hangs (weary)
    return cu, cv0, ew, up, lo, droop


def _open(du, ew, up, lo, droop, side):
    """The top and bottom of the opening at du (u offset from the centre; side: +outer = side)."""
    t = du / ew
    if abs(t) >= 1:
        return None
    k = math.sqrt(1 - t * t)
    outer = t * side                       # +1 at the outer corner
    tilt = droop * outer
    top = -up * (k ** 0.8) + tilt - 0.25 * max(0.0, -outer) * up * 0.3
    bot = lo * (k ** 1.1) + tilt * 0.5
    return top, bot


def eye(cv, hd, side, e, q, mats):
    """One eye. e: the hero's eye (w, up, lo, droop, iris radius ir, iris material, lid weight, bag
    depth, red corners); q: the pose (look (du, dv), blink, bulge, squeeze, smug_l / smug_r, wink).
    mats: {'white', 'iris', 'red'} ramp names. Pixels: the white (darker under the lid), the iris
    ring with a dark rim and a lit lower arc, the pupil, the glint (W), the heavy upper lid line (K),
    the lid fold and the eye bags (creases in the skin)."""
    cu, cv0, ew, up, lo, droop = eye_shape(hd, side, e, q)
    lu, lv = q.get('look', (0.0, 0.0))
    ir = e.get('ir', 2.3) * (1 - 0.25 * q.get('bulge', 0.0))
    iu, iv = cu + lu + e.get('iris_du', 0.0) * side, cv0 + lv - 0.2
    closed = up + lo < 0.9
    # the socket's darkness around the eye (the tired, sunken look); on the shadow side (the
    # viewer's right, away from the key) it stays lighter so it reads as tired, not as a black eye
    shade_side = side * KEY[0] > 0
    sock = e.get('socket', 0.12) * (0.2 if shade_side else 1.0)
    for x, y, u, v in hd.each(cu - ew - 3, cv0 - up - 4, cu + ew + 3, cv0 + lo + 6):
        if cv.grp(x, y) != 'skin':
            continue
        g = gauss(u, v, cu + side * 0.6, cv0 + lo + 1.2, ew + 0.8, 2.4)
        cv.shift(x, y, -sock * g)
    if not closed:
        for x, y, u, v in hd.each(cu - ew - 1, cv0 - up - 2, cu + ew + 1, cv0 + lo + 2):
            r = _open(u - cu, ew, up, lo, droop, side)
            if r is None:
                continue
            top, bot = r
            dv = v - cv0
            if dv < top or dv > bot:
                continue
            # the white: shaded by the lid's shadow (top) and the eyeball's roundness
            t = (u - cu) / ew
            sh = clamp((dv - top) / 2.2)
            val = 0.25 + 0.55 * sh * (1 - 0.55 * t * t) + 0.12 * (-t * side < 0)
            cv.put(x, y, mats['white'], clamp(val), 'eyew')
            # bloodshot corners
            if e.get('red', 0.0) and abs(t) > 0.55 and hsh(int(u * 2 + 50), int(v * 2), 7 + side) < e['red'] * abs(t):
                cv.put(x, y, mats['red'], 0.5, 'eyew')
            # the iris and the pupil
            di = math.hypot(u - iu, (v - iv) * 1.08)
            if di <= ir:
                if di <= ir * e.get('pupil', 0.42):
                    cv.fix(x, y, 'K', 'eyei')
                else:
                    lit = clamp(0.25 + 0.6 * clamp((v - iv) / ir + 0.3) - 0.35 * clamp((di - ir + 0.9) / 0.9))
                    lit -= 0.35 * clamp((top + 1.6 - dv) / 1.6)     # the lid's shadow
                    cv.put(x, y, mats['iris'], clamp(lit), 'eyei')
        # the glint: one white pixel up-left of the pupil (two when bulging)
        gx, gy = hd.xy(iu - ir * 0.45, iv - ir * 0.5)
        r = _open(iu - ir * 0.45 - cu, ew, up, lo, droop, side)
        if r is not None and r[0] < iv - ir * 0.5 - cv0 + 0.5:
            cv.fix(int(gx), int(gy), 'W', 'eyeg')
    # the upper lid: a heavy dark line (thicker at the outer corner), lashes at the outer end
    lid = e.get('lid', 1.1)
    for x, y, u, v in hd.each(cu - ew - 1.5, cv0 - up - 3, cu + ew + 1.8, cv0 + lo + 2.5):
        du = u - cu
        r = _open(du * 0.985, ew + 0.6, up, lo, droop, side)
        if r is None:
            # the corners: a short dark tail at the outer corner
            if side * du > ew - 0.2 and side * du < ew + 1.6 and abs(v - (cv0 + droop + 0.3)) < 0.6 + 0.25 * lid:
                cv.fix(x, y, 'K')
            continue
        top, bot = r
        dv = v - cv0
        outer = clamp(du * side / ew, 0, 1)
        w = lid * (0.75 + 0.6 * outer)
        if closed:
            if abs(dv - (bot * 0.6)) < 0.6 + 0.2 * lid:
                cv.fix(x, y, 'K')
            continue
        if top - w <= dv < top:
            cv.fix(x, y, 'K')
        elif bot < dv <= bot + 0.75 and abs(du) < ew * 0.92:
            # the lower lid: a dark skin edge, not the outline
            cv.unfix(x, y)
            if cv.grp(x, y) in ('skin', 'eyew', 'eyei'):
                cv.put(x, y, 'skin', 0.16, 'skin')
    # the lid fold (the heavy tired lid above the line) and the bags under the eye
    fold = e.get('fold', 2.4) + q.get('bulge', 0.0) * 0.8 - q.get('squeeze', 0.0) * 1.2
    lift = q.get('brow_' + ('l' if side < 0 else 'r'), q.get('brow', 0.0))
    fold += lift * 0.4
    pts = [(cu - ew * 0.95 + 0.2, cv0 - up * 0.6 - fold * 0.5), (cu - ew * 0.3, cv0 - up - fold),
           (cu + ew * 0.4, cv0 - up - fold + 0.1), (cu + ew * 1.05, cv0 - up * 0.3 - fold * 0.35 + droop)]
    crease(cv, hd.pts(pts), depth=0.3, lit=0.1, width=0.5)
    bag = e.get('bag', 1.0) * (1 + 0.4 * q.get('squeeze', 0.0))
    for k, (dy, dep) in enumerate(((lo + 2.0, 0.34), (lo + 3.9, 0.22))):
        if k and bag < 0.7:
            break
        pts = [(cu - ew * 0.75, cv0 + dy * 0.75 + droop * -0.3), (cu - ew * 0.1, cv0 + dy + 0.4),
               (cu + ew * 0.6, cv0 + dy + 0.1 + droop * 0.4), (cu + ew * 1.0, cv0 + dy * 0.6 + droop)]
        crease(cv, hd.pts(pts), depth=dep * bag * (0.75 if shade_side else 1.0), lit=0.08 * bag * (2.0 if shade_side else 1.0), width=0.55)
    # the pocket of the bag: a little darker and a little purple through the skin ramp's low end
    for x, y, u, v in hd.each(cu - ew, cv0 + lo, cu + ew + 1, cv0 + lo + 4):
        if cv.grp(x, y) == 'skin':
            cv.shift(x, y, -0.1 * bag * (0.5 if shade_side else 1.0) * gauss(u, v, cu + side * 0.8, cv0 + lo + 1.7, ew * 0.7, 1.2))
    # squeeze: crow's feet at the outer corner
    if q.get('squeeze', 0.0) > 0.3 or e.get('crow', 0):
        for k in (-1, 0, 1):
            a = (cu + side * (ew + 1.0), cv0 + droop + k * 1.6)
            b = (cu + side * (ew + 3.6), cv0 + droop + k * 2.6 - 0.4)
            crease(cv, hd.pts([a, b]), depth=0.22, lit=0.06, width=0.45)


def brow(cv, hd, side, b, q, mat='brow'):
    """One brow: a lit tube over the eye (b: inner / mid / outer points relative to the eye centre,
    width w0 -> w1). q: brow / brow_l / brow_r (lift px, + up), furrow (inner ends down), arch."""
    ex = hd.p['eye_dx']
    cu = side * ex + hd.turn * 0.45
    cv0 = hd.eye
    lift = q.get('brow_' + ('l' if side < 0 else 'r'), q.get('brow', 0.0))
    fur = q.get('furrow', 0.0)
    arch = q.get('arch_' + ('l' if side < 0 else 'r'), 0.0)
    pts = []
    for i, (du, dv) in enumerate(b['pts']):
        k = i / (len(b['pts']) - 1)                   # 0 inner -> 1 outer
        v = cv0 + dv - lift * (0.6 + 0.4 * k) + fur * (1 - k) * 1.6 - arch * math.sin(k * math.pi) * 1.2
        pts.append((cu + side * du, v))
    tube(cv, hd.pts(pts), b.get('w0', 2.6), b.get('w1', 1.6), mat, 'brow', gain=0.55, amb=0.08)
    # the furrow between the brows and the brow lift's forehead lines
    if fur > 0.2 and side < 0:
        for s in (-1, 1):
            a = (hd.turn * 0.45 + s * 1.3, cv0 + b['pts'][0][1] - 2.5)
            c = (hd.turn * 0.45 + s * 0.9, cv0 + b['pts'][0][1] + 1.0)
            crease(cv, hd.pts([a, c]), depth=0.3 * fur, lit=0.08, width=0.5)

# ------------------------------------------------------------------------------------------ nose


def nose(cv, hd, n, mats=None):
    """The nostrils (dark pixels under the bulb), a glint on the tip and the wing creases."""
    t = hd.turn
    nv = hd.nose + n.get('dv', 0.0)
    nw = n.get('w', 3.0)
    for s in (-1, 1):
        u0 = t + s * nw * 0.7
        for x, y, u, v in hd.each(u0 - 1.5, nv - 1, u0 + 1.5, nv + 1.5):
            if math.hypot((u - u0) / 1.2, (v - (nv + 0.3)) / 0.7) < 1.0:
                cv.put(x, y, 'skin', 0.04 if s > 0 else 0.1, 'skin')
        # the wing crease
        a = (t + s * (nw + 0.9), nv - 2.6)
        c = (t + s * (nw + 1.5), nv - 0.4)
        d = (t + s * (nw * 0.8), nv + 0.6)
        crease(cv, hd.pts([a, c, d]), depth=0.25, lit=0.0, width=0.5)
    # the tip glint (sweaty) and the bridge glint
    gx, gy = hd.xy(t - 0.9, nv - 2.6)
    cv.fix(int(gx), int(gy), 'W', 'skin')
    for k in range(n.get('bridge', 3)):
        bx, by = hd.xy(t - 1.0 + k * 0.1, nv - 7.5 - k * 1.5)
        cv.shift(int(bx), int(by), 0.18)

# ------------------------------------------------------------------------------------------ mouth


def mouth_curves(hd, m, q):
    """The mouth opening's top and bottom edge (v) at u, its half width and centre."""
    cu = hd.turn * 0.7 + m.get('du', 0.0) + q.get('mouth_du', 0.0)
    mv = hd.mouth + m.get('dv', 0.0)
    w = m.get('w', 8.0) * (1 + 0.15 * q.get('wide', 0.0))
    opn = m.get('open', 1.6) + q.get('open', 0.0)
    smile = m.get('smile', 1.0) + q.get('smile_add', 0.0)
    asym = m.get('asym', 0.0) + q.get('asym', 0.0)       # + lifts the viewer's right corner
    drop = hd.jaw

    def edges(u):
        t = (u - cu) / w
        if abs(t) >= 1:
            return None
        k = 1 - t * t
        lift = smile * 2.2 * t * t + asym * t * 1.2
        top = mv - lift - opn * 0.35 * k ** 0.5 - m.get('upper_arc', 0.4) * k
        bot = mv - lift + (opn + drop) * k ** 0.7 - smile * 0.4 * t * t
        return top, bot
    return cu, mv, w, edges


def mouth(cv, hd, m, q, mats):
    """The mouth: the opening (teeth: 'upper' / 'both' / 'clench' / 'none', the dark inside, the
    gums), the lips around it (upper darker, lower lit with a glint), the corner creases."""
    cu, mv, w, edges = mouth_curves(hd, m, q)
    teeth = q.get('teeth', m.get('teeth', 'upper'))
    tu_h = m.get('teeth_h', 2.4)
    for x, y, u, v in hd.each(cu - w - 1, mv - 6, cu + w + 1, mv + 8 + hd.jaw):
        r = edges(u)
        if r is None:
            continue
        top, bot = r
        if bot - top < 0.6:
            continue
        if not (top <= v <= bot):
            continue
        t = (u - cu) / w
        shade = 1 - 0.75 * abs(t) ** 1.5
        upper_edge = top + tu_h * (1 - 0.3 * t * t)
        lower_edge = bot - m.get('teeth_lo', 1.8) * (1 - 0.4 * t * t)
        if teeth == 'clench':
            mid = (top + bot) / 2 + 0.2
            if abs(v - mid) < 0.5:
                cv.put(x, y, mats['mouth'], 0.15, 'teeth')
                continue
            is_tooth = True
        elif teeth == 'both':
            is_tooth = v <= upper_edge or v >= lower_edge
        elif teeth == 'upper':
            is_tooth = v <= upper_edge
        else:
            is_tooth = False
        if is_tooth:
            gap = m.get('gap', 2.6)
            tu = (u - cu) / gap
            ph = tu - math.floor(tu)
            val = 0.25 + 0.7 * shade - 0.25 * clamp((v - top) / 3) * (v < (top + bot) / 2)
            if (ph < 0.18 and abs(t) < 0.85) and not (teeth == 'clench' and abs(v - (top + bot) / 2) < 0.2):
                val -= 0.45
            if v <= top + 0.6:
                val -= 0.2                          # the gum shadow line under the upper lip
            cv.put(x, y, mats['teeth'], clamp(val), 'teeth')
        else:
            val = 0.15 + 0.5 * shade * clamp((v - top) / max(0.5, bot - top))
            cv.put(x, y, mats['mouth'], clamp(val), 'teeth')
    # the edge of the opening: the outline-dark inside rim at the corners
    for x, y, u, v in hd.each(cu - w - 1.5, mv - 6, cu + w + 1.5, mv + 8 + hd.jaw):
        r = edges(u)
        if r is None:
            continue
        top, bot = r
        t = (u - cu) / w
        if abs(t) > 0.82 and top - 0.4 <= v <= bot + 0.4 and cv.grp(x, y) in ('teeth',):
            cv.fix(x, y, 'K')
    # the lips: upper (faces down: dark) over the top edge, lower (faces up: lit) under the bottom
    lu = m.get('lip_u', 1.2)
    ll = m.get('lip_l', 1.8) * (1 - 0.35 * q.get('stretch', 0.0))
    for x, y, u, v in hd.each(cu - w - 2, mv - 7, cu + w + 2, mv + 10 + hd.jaw):
        r = edges(clamp(u, cu - w + 0.2, cu + w - 0.2))
        if r is None or cv.grp(x, y) == 'teeth':
            continue
        top, bot = r
        t = (u - cu) / w
        if abs(t) > 1.08:
            continue
        k = math.sqrt(max(0.0, 1 - min(1.0, t * t)))
        if top - lu * k - 0.5 <= v < top:
            cv.put(x, y, mats['lip'], clamp(0.18 + 0.25 * k), 'lip')
        elif bot < v <= bot + ll * k + 0.3:
            d = (v - bot) / max(0.5, ll * k)
            cv.put(x, y, mats['lip'], clamp(0.35 + 0.5 * k * (1 - abs(d - 0.45) * 1.6)), 'lip')
    # the line between the lips and the opening (dark) and the lower lip's glint
    for x, y, u, v in hd.each(cu - w - 1, mv - 6, cu + w + 1, mv + 8 + hd.jaw):
        r = edges(u)
        if r is None:
            continue
        top, bot = r
        if bot - top < 0.6 and abs(v - top) < 0.7:
            t = abs((u - cu) / w)
            cv.put(x, y, mats['mouth'], 0.05 + 0.45 * (1 - t) * (u < cu + w * 0.3), 'teeth')
    gx, gy = hd.xy(cu - w * 0.25, edges(cu - w * 0.25)[1] + m.get('lip_l', 1.8) * 0.5 + 0.3)
    if m.get('lip_glint', True):
        cv.fix(int(gx), int(gy), 'W', 'lip')
    # the corner creases (the weary grin: the cheeks push up and fold)
    for s in (-1, 1):
        a = edges(cu + s * (w - 0.3))
        if a is None:
            continue
        cy = (a[0] + a[1]) / 2
        p0 = (cu + s * (w + 0.4), cy)
        p1 = (cu + s * (w + 1.6), cy - 1.6)
        p2 = (cu + s * (w + 1.1), cy + 1.8)
        crease(cv, hd.pts([p1, p0, p2]), depth=0.3, lit=0.06, width=0.5)


def smile_fold(cv, hd, side, f):
    """A nasolabial fold from the nose wing towards the mouth corner (deep on a weary face)."""
    t = hd.turn
    a = (t + side * f.get('top', 4.8), hd.nose - 1.2)
    b = (t + side * f.get('mid', 8.6), hd.nose + f.get('drop', 5.5) * 0.45)
    c = (t + side * f.get('end', 9.8), hd.nose + f.get('drop', 5.5))
    crease(cv, hd.pts([a, b, c]), depth=f.get('depth', 0.32), lit=0.14, width=0.6)

# ------------------------------------------------------------------------------------------ stubble


def stubble(cv, hd, region, mat='stub', edge=0.55, speck=0.2, seed=11, groups=('skin',), keep=0.92, lift=0.0):
    """Rough stubble as a clean cluster: where region(u, v) (0..1) is above edge the skin turns to
    the stubble ramp at the skin's light value (keep scales it); the soft edge below it breaks up by
    hash; a speck share of the stubble pixels drops one step darker (the rough grain)."""
    for x, y, u, v in hd.each(-34, hd.nose - 8, 34, hd.chin + 3, pad=2):
        i = y * cv.w + x
        if cv.g[i] not in groups or cv.fx[i] is not None:
            continue
        wgt = region(u, v)
        if wgt <= 0:
            continue
        hv = hd.noise(u, v, seed)
        if wgt >= edge or hv < wgt / edge * 0.75:
            val = cv.v[i] * keep + lift
            if hd.noise(u, v, seed + 3) < speck:
                val -= 0.22
            cv.put(x, y, mat, C.clamp(val), 'skin')


def beard_region(hd, top=None, cheek=None, mouth_w=None, lip_gap=1.6, jaw_line=0.0, soul=True):
    """The usual stubble region: the jaw and chin, the cheeks under a line from the ear to the
    mouth corner, the upper lip (mustache) and under the lower lip; the lips themselves stay bare."""
    top = hd.nose + 2.5 if top is None else top
    cheek = hd.p['cheek'] if cheek is None else cheek
    mw = mouth_w or 8.0

    def f(u, v):
        if not hd.inside(u, v):
            return 0.0
        au = abs(u - hd.turn * 0.5)
        # the cheek line: from the sideburn (high at the side) down to the mouth corner
        line = top + (hd.mouth - top) * clamp(1 - (au - mw) / max(1.0, cheek - mw)) - 6.0 * clamp((au - cheek + 6) / 6)
        if v < line:
            return 0.0
        w = smooth(line, line + 2.5, v)
        return w * (0.9 if au < mw + 2 else 1.0)
    return f

# ------------------------------------------------------------------------------------------ sweat


def bead(cv, hd, u, v, size=1, mat='skin', g='sweat'):
    """A sweat bead (head space): the lit body, a dark rim under it, one white glint on top. size 1:
    a 1 x 2 drop; size 2: a 2 x 3 drop."""
    x, y = hd.xy(u, v)
    x, y = int(x), int(y)
    w = 1 if size <= 1 else 2
    for dx in range(w):
        cv.shift(x + dx, y + 1, 0.3)
        if size > 1:
            cv.shift(x + dx, y + 2, 0.18)
        cv.shift(x + dx, y + size + 1, -0.4)
    if size > 1:
        cv.shift(x - 1, y + 1, -0.2)
    cv.fix(x, y, 'W', g)


def run(cv, hd, u, v0, v1, mat='skin'):
    """A sweat run: a thin lit trail with a dark edge, from v0 down to v1, ending in a bead."""
    for k in range(int(v1 - v0)):
        x, y = hd.xy(u + 0.15 * math.sin(k * 0.9), v0 + k)
        cv.shift(int(x), int(y), 0.16)
        cv.shift(int(x) + 1, int(y), -0.12)
    bead(cv, hd, u, v1, 2)


def drop(cv, x, y):
    """A flying drop in screen space (the sweat burst): a W glint over a light-blue body pixel."""
    cv.fix(int(x), int(y), 'W', 'fx')
    cv.fix(int(x), int(y) + 1, 'S', 'fx')

# ------------------------------------------------------------------------------------------ veins


def vein(cv, hd, pts, depth=0.22, lit=0.24, width=0.6):
    """A raised vein (temple, brow): a lit ridge with its shadow below-right (head space points)."""
    sp = hd.pts(pts)
    xs = [p[0] for p in sp]
    ys = [p[1] for p in sp]
    for y in range(int(min(ys)) - 2, int(max(ys)) + 3):
        for x in range(int(min(xs)) - 2, int(max(xs)) + 3):
            if cv.grp(x, y) != 'skin':
                continue
            d, _, _ = poly_dist(x + 0.5, y + 0.5, sp)
            if d <= width:
                cv.shift(x, y, lit)
            else:
                d2, _, _ = poly_dist(x - 0.5, y - 0.5, sp)
                if d2 <= width:
                    cv.shift(x, y, -depth)

# ------------------------------------------------------------------------------------------ hair


def strands(u, v, ang, length=6.0, width=0.8, seed=3):
    """Strand texture: 0..1, lanes along the angle ang (radians) with hash breaks along them."""
    ca, sa = math.cos(ang), math.sin(ang)
    a = u * ca + v * sa                    # along
    b = -u * sa + v * ca                   # across
    lane = math.floor(b / width)
    off = hsh(lane, 0, seed) * length
    seg = math.floor((a + off) / length)
    return hsh(lane, seg, seed + 1)


def hair_mass(cv, hd, inside, mat, dome=None, ang=None, lane=1.1, length=7.0, seed=3, gain=0.95, amb=0.05,
              rimk=0.7, g='hair', clump=0.22, sheen=0.0):
    """A hair mass: inside(u, v) -> bool (head space). Shaded as a dome (centre du, dv, radii) under
    the key light, broken into strands along ang(u, v) with dark gaps, rimmed on the right."""
    dome = dome or (0.0, hd.top + 10, 30.0, 22.0)
    du0, dv0, ru, rv = dome
    for x, y, u, v in hd.each(-40, hd.top - 18, 40, hd.chin, pad=2):
        if not inside(u, v):
            continue
        nx = clamp((u - du0) / ru, -0.98, 0.98)
        ny = clamp((v - dv0) / rv, -0.98, 0.98)
        nz = math.sqrt(max(0.02, 1 - nx * nx - ny * ny))
        n = norm3(nx, ny, nz)
        a = ang(u, v) if ang else -math.pi / 2
        s = strands(u, v, a, length, lane, seed)
        val = amb + gain * max(0.0, dot(n, KEY)) ** 1.2 + rimk * max(0.0, dot(n, RIM)) ** 2
        val += clump * (s - 0.5)
        if sheen:
            val += sheen * max(0.0, dot(n, HALF)) ** 12
        cv.put(x, y, mat, clamp(val), g, max(0.0, dot(n, RIM)))

# ------------------------------------------------------------------------------------------ bust


def cloth(cv, inside, mat, g, cx=32.0, rx=34.0, top=90.0, bias=0.0, folds=(), amb=0.06, gain=0.9, box=(0, 80, 64, 120)):
    """A cloth area on the round torso: inside(x, y) -> bool; the torso is a cylinder around cx
    (radius rx) leaning back with height; folds: [(points, depth)] creases in screen space."""
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not inside(x + 0.5, y + 0.5):
                continue
            nx = clamp((x + 0.5 - cx) / rx, -0.98, 0.98)
            ny = -0.35 + 0.25 * clamp((y - top) / 30)
            n = norm3(nx, ny, math.sqrt(max(0.05, 1 - nx * nx)))
            val = amb + gain * max(0.0, dot(n, KEY)) ** 1.1 + 0.45 * max(0.0, dot(n, RIM)) ** 2 + bias
            val -= 0.12 * smooth(100, 120, y)
            cv.put(x, y, mat, clamp(val), g, max(0.0, dot(n, RIM)))
    for pts, dep in folds:
        crease(cv, pts, depth=dep, lit=0.1, groups=(g,), width=0.55)


def poly(pts):
    """inside(x, y) of a screen polygon."""
    return lambda x, y: in_poly(x, y, pts)


def hair_region(hd, hairline, lift=2.8, ext=1.0, fuzz=1.0, crest=None, side_w=2.6, side_v=None, seed=3):
    """inside(u, v) of a haircut (head space): the skull's dome grown by ext at the sides and lift on
    top (plus crest(u) px more: spikes, a quiff), fuzzed by hash tufts; down to hairline(u) on the
    face; the short sides (au > cran - side_w) down to side_v(au) (default: 5 px over the eyes)."""
    top, cran = hd.top, hd.p['cran']
    vc = hd.vc
    side_v = side_v or (lambda au: hd.eye - 5.5 + (au - cran + side_w) * 1.2)

    def inside(u, v):
        au = abs(u)
        extra = crest(u) if crest else 0.0
        if v < vc:
            t = (vc - v) / (vc - top + lift + extra)
            if t >= 1:
                return False
            w = (cran + ext) * math.sqrt(1 - t * t)
            f = fuzz * hsh(int((u + 40) // 2), 0, seed)
            if au > w - f * 0.6:
                return False
            if v < top - lift - extra + f * 1.4:
                return False
        elif au > hd.width(v) + ext:
            return False
        if v < hairline(u):
            return True
        return au > cran - side_w and v < side_v(au)
    return inside


def fringe(cv, hd, hairline, mat='hair', v=0.18, share=0.45, seed=9, span=20):
    """Single hairs onto the skin along the hairline (the edge is never a clean cut)."""
    for x, y, u, vv in hd.each(-span, hd.top - 2, span, hd.brow + 2):
        if cv.grp(x, y) == 'skin' and vv < hairline(u) + 1.2 and hsh(x, y, seed) < share:
            cv.put(x, y, mat, v, 'hair')


def blush(cv, hd, amount=0.08, du=13.0, dv=7.0, mat='blush'):
    """Rosy cheeks: the skin pixels of the cheek apples move to the blush ramp at their light."""
    for x, y, u, v in hd.each(-26, hd.eye, 26, hd.mouth):
        i = y * cv.w + x
        if cv.g[i] != 'skin' or cv.m[i] != 'skin' or cv.fx[i] is not None:
            continue
        for s in (-1, 1):
            # on the shadow side only the lit part of the apple flushes (a dark flush reads as a bruise)
            if s * KEY[0] > 0 and cv.v[i] < 0.42:
                continue
            g = gauss(u, v, s * du + hd.turn * 0.4, hd.eye + dv, 4.5, 3.2)
            if g > 0.45 and hsh(x, y, 21) < (g - 0.3) * 2.2:
                cv.m[i] = mat
                cv.v[i] = clamp(cv.v[i] + amount)


def vnoise(x, y, scale, seed=0):
    """Smooth value noise in [0, 1): bilinear between hash values on a grid of the given scale."""
    gx, gy = x / scale, y / scale
    x0, y0 = math.floor(gx), math.floor(gy)
    fx, fy = gx - x0, gy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = hsh(x0, y0, seed), hsh(x0 + 1, y0, seed)
    c, d = hsh(x0, y0 + 1, seed), hsh(x0 + 1, y0 + 1, seed)
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
