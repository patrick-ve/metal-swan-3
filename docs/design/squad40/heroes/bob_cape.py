# BOB's cape: a BACK sprite drawn behind the legs and the body (pose.HOOKS['back']).
# The cape is a ribbon hung from the torso's 'cape' anchor (the back of the shoulders). Its centre line
# (the spine) is integrated from a start angle, a curl and a travelling wave; the width grows toward
# the hem. The flag motif sits in ribbon coordinates: a white field, a blue stripe near the shoulders
# and one near the hem; the six-pointed star is a hand-drawn stamp that is placed only where the
# cape is wide enough and not covered by the body, so it never breaks up into noise.
# Each pose carries p['cape'] = (mode, phase); params() turns it into the ribbon shape.
import math
from rig import Canvas, RY
import pose

STAR7 = [
  "...U...",
  "..U.U..",
  "UUUUUUU",
  ".U...U.",
  ".U...U.",
  "UUUUUUU",
  "..U.U..",
  "...U...",
]
STAR5 = [
  "..U..",
  "UUUUU",
  ".U.U.",
  "UUUUU",
  "..U..",
]
STRIPES = ((0.17, 0.27), (0.79, 0.89))


def params(mode, ph, p):
    d = dict(phi=101, curl=6, L=21, w0=4, w1=8, amp=3, waves=0.8, wph=0.0, hem=1.0, gnd=17, fold=0.0,
             world=False, lift=0.0, flat=False, ripple=False, taper=0.8, stripes=STRIPES, plain=False)
    k = int(round(ph)) if isinstance(ph, (int, float)) else 0
    if mode == 'hang':
        d.update(phi=101 + 2.5 * math.sin(2 * math.pi * ph), amp=4, wph=ph, fold=0.3 * ph)
    elif mode == 'run':
        d.update(phi=128 + 3 * math.sin(4 * math.pi * ph), curl=30, L=24, w0=3, w1=12, amp=12, waves=1.4,
                 wph=2 * ph, hem=2.0, gnd=None, fold=ph, ripple=True, taper=1.0)
    elif mode in ('shoot', 'cshoot'):
        kick = [16, 10, 5, 2, 1, 0, 0, 0, 0, 0][min(k, 9)]
        d.update(phi=101 + kick, curl=6 + kick, amp=4 + 0.5 * kick, wph=0.12 * k, w1=8 + kick / 8,
                 ripple=kick > 4)
        if mode == 'cshoot':
            d.update(phi=d['phi'] + 12, gnd=11, L=23)
    elif mode == 'crouch':
        d.update(phi=116 + 1.5 * math.sin(2 * math.pi * ph), curl=0, w1=8, gnd=11, wph=ph, amp=3, L=23)
    elif mode == 'jump':
        T = [  # phi, curl, w1, amp, gnd
            (100, 4, 8, 3, 14), (94, -6, 7, 3, None), (104, 14, 8, 6, None),
            (128, 36, 12, 12, None), (160, 44, 12, 14, None), (118, -14, 9, 8, 13)]
        a, c, w, am, g = T[min(k, 5)]
        d.update(phi=a, curl=c, w1=w, amp=am, gnd=g, wph=0.2 * k, waves=1.0, hem=1.6, w0=3, taper=1.0,
                 ripple=k in (3, 4))
    elif mode == 'float':
        d.update(phi=156 + 3 * math.sin(math.pi * 0.4 * k), curl=40, w0=3, w1=12, amp=12, waves=1.1,
                 wph=0.13 * k, gnd=None, hem=1.6, ripple=True, taper=1.0)
    elif mode == 'grenade':
        a = [101, 94, 96, 124, 116, 104][min(k, 5)]
        d.update(phi=a, curl=6 + (a - 101) * 0.8, w1=8 + max(0, a - 104) / 6, amp=6, wph=0.2 * k)
    elif mode == 'slash':
        a = [104, 96, 124, 138, 134, 118, 104][min(k, 6)]
        d.update(phi=a, curl=6 + (a - 101) * 0.9, w1=8 + max(0, a - 104) / 7, amp=7, wph=0.2 * k, waves=1.1,
                 ripple=a > 120)
    elif mode == 'stab':
        a = [102, 112, 122, 120, 110, 103][min(k, 5)]
        d.update(phi=a, curl=6 + (a - 101) * 0.8, w1=8 + max(0, a - 104) / 7, amp=6, wph=0.2 * k)
    elif mode == 'settle':                 # the wind drops: between billow and hang
        d.update(phi=112, curl=14, w1=9, amp=6, wph=0.3)
    elif mode == 'billow':
        d.update(phi=124 + 6 * math.sin(2 * math.pi * ph), curl=30, w0=3, w1=12, amp=13, waves=1.2, wph=ph,
                 hem=2.0, gnd=None, fold=ph, ripple=True, taper=1.0, L=22)
    elif mode == 'death':
        T = [  # world phi, curl, w1, amp, lift, flat
            (110, 10, 8, 6, 0, False), (126, 18, 10, 8, 0, False), (160, 20, 11, 10, 0, False),
            (190, 4, 11, 8, 0, False), (100, -40, 10, 6, 0, False),
            (2, 0, 10, 4, -6, True), (0, 0, 10, 3, -6, True), (2, 0, 10, 2, -6, True),
            (0, 0, 10, 1, -6, True), (0, 0, 10, 1, -6, True)]
        a, c, w, am, lf, fl = T[min(k, 9)]
        d.update(phi=a, curl=c, w1=w, amp=am, wph=0.15 * k, world=True, gnd='abs', waves=1.0, lift=lf,
                 flat=fl, w0=4 if not fl else 6, ripple=k in (2, 3))
    # ---- the extension wave (heroes/bob_ext.py sets these per pose)
    elif mode == 'heavy':                  # continuous heavy fire: a steady push back, a small flutter
        d.update(phi=108 + (2 if k % 2 == 0 else 0), curl=10, amp=5, wph=0.25 * k, w1=8.5)
    elif mode == 'droop':                  # bored: the cape hangs limp and narrow
        d.update(phi=93 + ph, curl=-2, w0=4, w1=7, amp=1.5, wph=0.1 * ph, L=21)
    elif mode == 'ride':                   # on the Swan: straight down into the Swan's body (hidden)
        d.update(phi=96, curl=0, L=15, w1=7, amp=1, wph=ph, stripes=((0.55, 0.65),))
    elif mode == 'ridewind':               # on the Swan at speed: it streams back over the far wing
        d.update(phi=184 + 4 * math.sin(2 * math.pi * ph), curl=-8, L=19, w0=3, w1=10, amp=9, waves=1.3,
                 wph=ph, hem=1.6, gnd=None, fold=ph, ripple=True, taper=1.0)
    elif mode in ('flip', 'blast'):        # tumbling: the cape trails the flight path in the world, so
        sp = p.get('spin', (0, (0, 0)))[0]  # it is drawn against the body's turn (the spin comes after)
        if mode == 'flip':
            world, s = 135 + 90 * min(k, 7) / 7, 1
        else:
            world, s = [128, 53, 31, -31, -68, -90][min(k, 5)], 1
        d.update(phi=world + s * sp, curl=-18, L=22, w0=3, w1=12, amp=10, waves=1.2, wph=0.25 * k, hem=2.0,
                 gnd=None, ripple=True, taper=1.0, fold=0.25 * k)
        if mode == 'flip':
            d.update(L=25)
    elif mode == 'drown':                  # hangs to the water and floats on the surface behind him
        d.update(phi=100, curl=0, amp=2, wph=0.2 * k, L=26, w1=8)
    elif mode == 'flat':                   # the pancake: a long cape that lies on the floor behind him
        d.update(phi=99, curl=0, amp=1, L=27, w1=8)
    elif mode == 'sit':                    # sitting on the floor: down the back, then along the floor
        d.update(phi=102 + 1.5 * math.sin(2 * math.pi * ph), curl=0, amp=2, wph=ph, L=24)
    if isinstance(p.get('cape'), tuple) and len(p['cape']) > 2:
        d.update(p['cape'][2])             # per-pose overrides: gnd, phi, plain (soot), ...
    return d


def _rot(pel, deg):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    def to_local(q):                       # inverse of the rotsprite turn: world -> local
        dx, dy = q[0] - pel[0], q[1] - pel[1]
        return (pel[0] + dx * ca - dy * sa, pel[1] + dx * sa + dy * ca)
    def to_world(q):
        dx, dy = q[0] - pel[0], q[1] - pel[1]
        return (pel[0] + dx * ca + dy * sa, pel[1] - dx * sa + dy * ca)
    return to_local, to_world


def _body_mask(X, p, pel):
    """Pixels the body covers (plus the 1 px outline), so the star is never half hidden."""
    cv = Canvas(cv_w := 80 * X.S, 76 * X.S)
    pose.draw_upper(cv, X, p, pel, 0, {})
    if 'legN' in p:
        pose.draw_lower(cv, X, p, pel, (36, 70))
    m = set()
    for y in range(cv.H):
        for x in range(cv.W):
            if cv.c[y][x] != '.':
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        m.add((x + dx, y + dy))
    if 'legN' not in p:                    # an upper pose: keep the star off the legs' box
        for y in range(int(pel[1]) - 1, int(pel[1]) + 19):
            for x in range(int(pel[0]) - 7, int(pel[0]) + 9):
                m.add((x, y))
    return m


def draw(cv, X, p, meta, z):
    mode, ph = p.get('cape', ('hang', 0))[:2]
    d = params(mode, ph, p)
    pel = meta['pel']
    if 'legN' in p and d['gnd'] not in (None, 'abs'):
        # a full-body pose knows its floor: a squat or a seat never pushes the cape through it
        d['gnd'] = min(d['gnd'], meta['root'][1] - pel[1])
    rot = p.get('rot', 0) if d['world'] else 0
    to_local, to_world = _rot(pel, rot)
    an = meta['torso']['cape']
    if d['gnd'] == 'abs':
        gnd = RY - 1
    elif d['gnd'] is None:
        gnd = None
    else:
        gnd = pel[1] + d['gnd']
    L, ds = d['L'], 0.2
    x, y = to_world(an)
    y += d['lift']
    cnt = {}
    spine = []
    n = int(L / ds)
    for i in range(n + 1):
        s = i * ds
        f = s / L
        phi = math.radians(d['phi'] + d['curl'] * f + d['amp'] * math.sin(2 * math.pi * (d['waves'] * f - d['wph'])) * f)
        dx, dy = math.cos(phi), math.sin(phi)
        w = d['w0'] + (d['w1'] - d['w0']) * f ** d['taper']
        cy = y
        lying = gnd is not None and not d['flat'] and y >= gnd - 1.5
        if lying:                                   # the rest lies flat on the floor, trailing back
            dx, dy = (-1.0 if dx < 0.35 else 1.0), 0.0
            w = min(w, 3.0)
            cy = gnd - 1.0
        spine.append((x, cy, f))
        nx, ny = -dy, dx
        steps = int(w / 0.2)
        for j in range(steps + 1):
            u = -w / 2 + j * 0.2
            uf = u / w + 0.5
            hem = d['hem'] * (0.5 + 0.5 * math.sin(2 * math.pi * (uf * 1.5) + 2 * math.pi * d['wph']))
            if s > L - hem:
                continue
            qx, qy = x + nx * u, cy + ny * u
            if gnd is not None and qy > gnd + 0.45:
                continue
            blue = not d['plain'] and any(a <= f < b for a, b in d['stripes'])
            fl = (uf * 1.5 + d['fold'] + 0.15 * f) % 1.0
            shade = 0.42 < fl < 0.58 and 0.05 < uf < 0.95
            if d['ripple'] and f > 0.3:
                rp = math.cos(2 * math.pi * (d['waves'] * f - d['wph']))
                shade = shade or (rp > 0.82 and uf > 0.3)
            ch = ('V' if shade else 'U') if blue else ('t' if shade else 'T')
            if lying and not blue:
                ch = 't' if uf < 0.34 else 'T'
            lx, ly = to_local((qx, qy))
            c = X.m((lx, ly))
            key = (int(round(c[0])), int(round(c[1])))
            cnt.setdefault(key, {})
            cnt[key][ch] = cnt[key].get(ch, 0) + 1
        y += dy * ds
        x += dx * ds
        if lying:
            y = gnd - 1.0
    mid = min(spine, key=lambda q: abs(q[2] - 0.5))
    meta['cape_mid'] = (mid[0], mid[1], 0 if d['plain'] else d['w1'])
    px = {k: max(v.items(), key=lambda kv: kv[1])[0] for k, v in cnt.items()}
    # clean the silhouette: drop spikes, fill pinholes
    for _ in range(2):
        nb = lambda k: sum((k[0] + a, k[1] + b) in px for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        for k in [k for k in px if nb(k) <= 1]:
            del px[k]
        holes = {}
        for (kx, ky) in list(px):
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                h = (kx + a, ky + b)
                if h not in px and nb(h) >= 3:
                    holes[h] = px[(kx, ky)]
        px.update(holes)
    # tones: a lone fold pixel joins its neighbours
    out = dict(px)
    for (kx, ky), ch in px.items():
        ns = [px.get((kx + a, ky + b)) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        ns = [c for c in ns if c]
        if len(ns) >= 3 and ch not in ns:
            out[(kx, ky)] = max(sorted(set(ns)), key=ns.count)   # sorted: the same tie-break in every process
    px = out
    _star(px, X, p, meta, d, spine, to_local)
    for (kx, ky), ch in px.items():
        cv.px(kx, ky, ch, z, 'cape')


def _star(px, X, p, meta, d, spine, to_local):
    """Stamp the star near the middle of the cape when a clean white field holds it."""
    if X.S != 1 or not spine or p.get('rot') or p.get('spin') or d['w1'] < 11 or d['plain']:
        return
    mask = _body_mask(X, p, meta['pel'])
    cand = sorted((q for q in spine if 0.36 <= q[2] <= 0.66), key=lambda q: abs(q[2] - 0.5))
    for q in cand[::5]:
        cx, cy = to_local((q[0], q[1]))
        if _stamp(px, cx, cy, mask, reach=1):
            return


def _stamp(px, cx, cy, mask, reach=3):
    """The star's own pixels and their 8 neighbours must sit on plain white cape, clear of the body
    and of the stripes; the white cells inside the star are cleaned to T."""
    for star in (STAR7, STAR5):
        h, w = len(star), len(star[0])
        cells = [(xx, yy) for yy in range(h) for xx in range(w) if star[yy][xx] == 'U']
        need = set()
        for xx, yy in cells:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    need.add((xx + dx, yy + dy))
        ring = set()
        for xx, yy in cells:
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    ring.add((xx + dx, yy + dy))
        best = None
        for oy in range(-reach, reach + 1):
            for ox in range(-reach, reach + 1):
                x0, y0 = int(round(cx - (w - 1) / 2)) + ox, int(round(cy - (h - 1) / 2)) + oy
                if all(px.get((x0 + a, y0 + b)) in ('T', 't') and (x0 + a, y0 + b) not in mask for a, b in need) \
                        and not any(px.get((x0 + a, y0 + b)) in ('U', 'V') for a, b in ring):
                    if best is None or ox * ox + oy * oy < best[0]:
                        best = (ox * ox + oy * oy, x0, y0)
        if best:
            _, x0, y0 = best
            for a, b in need:
                px[(x0 + a, y0 + b)] = 'T'
            for a, b in cells:
                px[(x0 + a, y0 + b)] = 'U'
            return True
    return False


def post(cv, X, p, layer, meta):
    """Death frames turn the cape with the body (rotsprite); the star goes on after the turn, in
    screen space, so it stays a clean upright stamp."""
    if layer != 'full' or not p.get('rot') or 'cape_mid' not in meta or X.S != 1:
        return
    cx, cy, w1 = meta['cape_mid']
    if w1 < 10:
        return
    px, mask = {}, set()
    for y in range(cv.H):
        for x in range(cv.W):
            ch = cv.c[y][x]
            if ch == '.':
                continue
            if cv.p[y][x] == 'back':
                px[(x, y)] = ch
            else:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        mask.add((x + dx, y + dy))
    before = dict(px)
    _stamp(px, cx, cy, mask)
    for (x, y), ch in px.items():
        if before.get((x, y)) != ch:
            cv.c[y][x] = ch


def post_spin(cv, X, p, layer, meta):
    """A tumbling pose ('spin', turned after every hook): the star goes on after the turn, at the
    turned middle of the cape, so it stays a clean upright stamp. Runs after the spin hook."""
    if layer != 'full' or not p.get('spin') or 'cape_mid' not in meta or X.S != 1:
        return
    cx, cy, w1 = meta['cape_mid']
    if w1 < 10:
        return
    deg, (ox, oy) = p['spin']
    R = meta['root']
    _, to_world = _rot((R[0] + ox, R[1] + oy), deg)
    cx, cy = to_world((cx, cy))
    px, mask = {}, set()
    for y in range(cv.H):
        for x in range(cv.W):
            ch = cv.c[y][x]
            if ch == '.':
                continue
            if cv.p[y][x] in ('back', 'cape'):
                px[(x, y)] = ch
            else:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        mask.add((x + dx, y + dy))
    before = dict(px)
    _stamp(px, cx, cy, mask)
    for (x, y), ch in px.items():
        if before.get((x, y)) != ch:
            cv.c[y][x] = ch
