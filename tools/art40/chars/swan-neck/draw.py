# One neck-strip picture of the Swan (stage 2, slug 'swan-neck'): the free neck with its face, the
# ammunition belt on the drum, the barrel on the drum's hub at one of the 9 aim angles, and the
# effects that belong to the gun (the muzzle flash, smoke, the spent case, the drum's recoil).
#
# The game draws a neck strip LAST, on the body frame's `neck` socket (swan.ts draw, step 5), so
# every picture is drawn relative to the socket of the posture's rest body:
#   land    the standing body (every ridden ground strip; the swim strips: the same body, lower)
#   crouch  the body pressed flat (sy 0.75: crouch, waddle, slide)
#   duck    the body ducked in the water (water-duck): the surface DUCK_SURFACE px under the socket
# The drum and the barrel are on her near flank: the barrel turns on the drum's hub, which lies at
# hub_rel(posture) from the socket (the rest body's own geometry, so the hub bolt sits on the body
# strip's drum). When the gun fires, the drum's face plate is redrawn round the hub, pushed back
# along the barrel and turned one notch (the rivets), and the belt advances one link; the plate
# leaves out the cells of the rider's leg window (frames.leg_window), so his knee stays in front.
import math

import art40 as X

S = X.char('swan')
B = S.B
F = S.F
SP = S.palette
PO = S.PO

# The water ramp of the swan-water set (the same letters and colours: tools/art40/chars/
# swan-water/palette.py): the ducked barrel under the surface
WATER = {'A': '#a4cfee', 'B': '#6a9fd2', 'C': '#3b65a3', 'E': '#1a2452'}
UNDER = {}
for _c in 'WwSYOR':
    UNDER[_c] = 'A'
for _c in 'vusygoLr':
    UNDER[_c] = 'B'
for _c in 'UNnGhZqlmMx':
    UNDER[_c] = 'C'
UNDER['K'] = 'E'
WATER_P2 = {'A': '#5b86bb', 'B': '#3a5f96'}

# The shared FX ramp letters this set uses (tools/art40/rules.json fxRamp; outside the budget):
# the flash (white, cream, yellow, gold, orange, red), the two blues, the smoke greys
FX_COLOURS = {'c': '#ffffff', 'e': '#fffbd8', 'f': '#ffe070', 'i': '#ffd040', 'j': '#ff8a24', 'k': '#e0401c',
              'd': '#bfe4ff', 't': '#7fb4e8', 'a': '#7a6e70', 'b': '#4a4046'}
FX = ''.join(sorted(FX_COLOURS))


def colours(variant=None):
    pal = SP.colours(variant)
    pal.update(WATER)
    if variant:
        pal.update(WATER_P2)
    pal.update(FX_COLOURS)
    return pal


# The body transform of each posture's rest body (squash sy; the crouch strips press her flat)
POSTURE_SY = {'land': 1.0, 'swim': 1.0, 'crouch': 0.75, 'duck': 1.0}
AFLOAT = ('swim', 'duck')  # the swim and ducked necks: the drum rides high (body.drum_s, sw.afloat)


def _swan(posture):
    """The rest body of a posture: its squash, and afloat in the water (the drum strapped high)."""
    sw = B.Swan(sy=POSTURE_SY[posture])
    sw.afloat = posture in AFLOAT
    return sw
DUCK_SURFACE = 5          # rows under the socket where the water starts (water-duck: socket 5 px over it)
CROUCH_SEAT_DY = F.CROUCH_SEAT_DY


def _r(v):
    return int(math.floor(v + 0.5))


def socket_of(posture):
    sw = _swan(posture)
    p = sw.T(B.NECK_BASE_S)
    return (_r(p[0]), _r(p[1]))


def hub_rel(posture):
    """The drum's hub relative to the (rounded) socket, as the body strips draw it."""
    sw = _swan(posture)
    h = B.hub(sw)
    s = socket_of(posture)
    return (h[0] - s[0], h[1] - s[1])


BARREL_L = sum(B.BARREL) + 0.5            # the hub to the muzzle point (17.5 px)


def aim_deg(i):
    return B.AIM_DEG[i]


def rest_tip(posture, i):
    """The muzzle point at aim step i (the barrel at rest), relative to the socket: the point the
    game fires from (`muzzle` = `cannon`), the same on every phase of that aim."""
    h = hub_rel(posture)
    th = math.radians(aim_deg(i))
    return (h[0] + math.cos(th) * BARREL_L, h[1] + math.sin(th) * BARREL_L)


# ------------------------------------------------------------------ canvases
def _blank():
    return [['.'] * B.CW for _ in range(B.CH)]


def _put(g, x, y, ch):
    if 0 <= y < B.CH and 0 <= x < B.CW:
        g[y][x] = ch


def _over(base, rows):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                base[y][x] = ch


# ------------------------------------------------------------------ the neck
_MASK = {}


def _body_mask(posture):
    """The cells (relative to the socket) where the rest body covers the neck's root."""
    if posture in _MASK:
        return _MASK[posture]
    pose = {'land': PO.IDLE[0], 'swim': PO.IDLE[0], 'crouch': PO.CROUCH[0], 'duck': PO.IDLE[0]}[posture]
    r = F.render(pose)
    sock = r['pts']['neck']
    sx, sy = _r(B.OX + sock[0]), _r(B.OY + sock[1])
    cells = set()
    for layer in ('b', 'f'):
        for y, row in enumerate(r['rows'][layer]):
            for x, ch in enumerate(row):
                if ch != '.' and ch != 'K':
                    cells.add((x - sx, y - sy))
    _MASK[posture] = cells
    return cells


def _clip_root(rows, posture):
    """Drop the neck's outline pixels that lie on the body near the root: the white neck runs into
    the white breast without a line (the collar keeps its own)."""
    s = socket_of(posture)
    sx, sy = B.OX + s[0], B.OY + s[1]
    mask = _body_mask(posture)
    out = [list(r) for r in rows]
    for y, row in enumerate(out):
        for x, ch in enumerate(row):
            if ch == 'K' and (x - sx, y - sy) in mask and (y - sy) >= -3 and abs(x - sx) <= 8:
                row[x] = '.'
    return [''.join(r) for r in out]


def neck_rows(posture, nk):
    """The neck and the head on their own canvas (selout and the one outline), clipped where they
    enter her breast. nk: c1, c2, head relative to the socket; ang; face; flip; r0, r1."""
    sw = _swan(posture)
    s = socket_of(posture)
    p0 = sw.T(B.NECK_BASE_S)
    at = lambda q: (s[0] + q[0], s[1] + q[1])
    pts = B.neck_head(sw, at(nk['c1']), at(nk['c2']), at(nk['head']), nk.get('ang', 0.0), z=4.0,
                      r0=nk.get('r0', 4.2), r1=nk.get('r1', 2.5), face=nk.get('face', 'n'), flip=nk.get('flip', False),
                      base=p0, layer='n')
    rows = _clip_root(sw.cv['n'].finish(), posture)
    return rows, {'head': sw.pts['head'], 'neckmid': pts[8]}


# ------------------------------------------------------------------ the drum's face plate and the belt
PLATE_R = B.DRUM_R - 1.6                   # the plate: the face, the rivets and the rim's inner half


def _leg_cells(posture):
    """The rider's leg window in canvas cells (frames.leg_window round this posture's seat)."""
    sw = _swan(posture)
    st = sw.T(B.SEAT_S)
    dy = CROUCH_SEAT_DY if posture == 'crouch' else 0
    sx, sy = _r(B.OX + st[0]), _r(B.OY + st[1] + dy)
    return {(sx + x, sy + y) for (x, y) in F.leg_window()}


def plate(g, hub, shift=(0, 0), turn=0.0, skip=frozenset()):
    """The drum's face plate round the hub (canvas coordinates), moved by shift: the lit inner rim,
    the rim's shadow, the recessed face, four rivets turned by `turn` degrees (the drum turns one
    notch as it feeds). Cells in `skip` stay the body strip's (the rider's leg is over them)."""
    cx, cy = hub[0] + shift[0], hub[1] + shift[1]
    R = B.DRUM_R
    lx, ly = 0.55, -0.83
    for y in range(int(cy - R - 1), int(cy + R + 2)):
        for x in range(int(cx - R - 1), int(cx + R + 2)):
            if (x, y) in skip:
                continue
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > PLATE_R or math.hypot(x - hub[0], y - hub[1]) > R - 1.0:
                continue
            l = (dx * lx + dy * ly) / (d or 1)
            if d > R - 2.6:
                ch = 'S' if l > 0.55 else 's' if l > -0.1 else 'g' if l > -0.7 else 'G'
            elif d > R - 3.4 and l < 0.2:
                ch = 'h'
            else:
                ch = 's' if -l > 0.5 else 'g' if -l > -0.5 else 'G'
            _put(g, x, y, ch)
    for a in (45, 135, 225, 315):
        a = math.radians(a + turn)
        r = R - 1.8
        x, y = _r(cx + r * math.cos(a)), _r(cy - r * math.sin(a))
        if (x, y) not in skip:
            _put(g, x, y, 'y' if math.sin(a) > 0 else 'Z')


def belt(g, hub, feed=0, shift=(0, 0)):
    """The ammunition belt: it rises from the drum's lower rim into the receiver on the hub, a
    2-px band of brass rounds (lit / shaded) and dark links; `feed` moves it up one row a shot."""
    hx, hy = _r(hub[0] + shift[0]), _r(hub[1] + shift[1])
    for k in range(2, 5):
        row = (k + feed) % 2
        a, b = ('Y', 'y') if row == 0 else ('Z', 'Z')
        _put(g, hx - 1, hy + k, a)
        _put(g, hx, hy + k, b)


# ------------------------------------------------------------------ the barrel
def barrel_rows(posture, i, kick=0.0):
    """The barrel at aim step i pushed `kick` px back along its axis (recoil), on its own canvas
    with its outline. Returns rows, the drawn tip (canvas) and the hub (canvas)."""
    sw = _swan(posture)
    tip = B.barrel(sw, i, z=9.0, kick=kick, layer='n')
    rows = sw.cv['n'].finish()
    hub = B.hub(sw)
    return rows, (B.OX + tip[0], B.OY + tip[1]), (B.OX + hub[0], B.OY + hub[1])


# ------------------------------------------------------------------ effects (FX letters, no outline)
def flash(g, tip, deg, length, width, prongs=True, ring=False):
    """A hard-edged muzzle flash along the aim: a white-hot core, a yellow body, an orange edge, two
    short side prongs (the flash hider's slots) and, for the shell, a ring of fire at the muzzle."""
    th = math.radians(deg)
    ux, uy = math.cos(th), math.sin(th)
    nx, ny = -uy, ux
    x0, y0 = tip
    R = int(length + width + 3)
    for y in range(int(y0) - R, int(y0) + R + 1):
        for x in range(int(x0) - R, int(x0) + R + 1):
            px, py = x - x0, y - y0
            t = px * ux + py * uy
            s = px * nx + py * ny
            ch = None
            if 0 <= t <= length:
                w = width * (1 - t / length) ** 0.8 + 0.35
                q = abs(s) / w
                if q <= 1:
                    hot = t / length
                    ch = 'c' if (q < 0.45 and hot < 0.55) else 'e' if (q < 0.7 and hot < 0.75) else 'f' if q < 0.9 else 'j'
            if ch is None and prongs and 0.5 <= t <= length * 0.45:
                for sg in (-1, 1):
                    if abs(s - sg * t * 1.43) <= 0.55 and abs(s) <= width + 1.6:
                        ch = 'i'
            if ch is None and ring:
                d = math.hypot(px, py)
                if width + 0.6 <= d <= width + 1.7 and t > -1.5:
                    ch = 'j' if t > 0 else 'k'
            if ch:
                _put(g, x, y, ch)


def puff(g, c, r, light=True):
    """A round puff of gun smoke: a pale body, a warm grey lower edge, a white top front
    (light=False: an older, greyer puff)."""
    cx, cy = c
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x - cx, y - cy)
            if d <= r:
                low = (y - cy) > r * 0.3
                ch = ('a' if low else 'd') if light else ('b' if (y - cy) > r * 0.5 else 'a')
                if light and d < r * 0.55 and (y - cy) < 0 and (x - cx) > -0.5:
                    ch = 'c'
                _put(g, x, y, ch)


def burst(g, c, r):
    """The round white-hot core of a flash at the muzzle: white, a cream ring, a yellow rim."""
    cx, cy = c
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x - cx, y - cy)
            if d <= r:
                _put(g, x, y, 'c' if d < r * 0.5 else 'e' if d < r * 0.8 else 'f')


def case(g, at, stage, big=False):
    """The spent case (hot brass): stage 0 in the ejection port, 1 thrown up and back, 2 tumbling.
    big: the shell's fat case (one row more)."""
    x, y = _r(at[0]), _r(at[1])
    # hot brass in the FX ramp (gold lit, orange shade): it flies free of the outline
    cells = {0: [(0, 0, 'i'), (1, 0, 'j')], 1: [(0, 0, 'i'), (0, 1, 'j')], 2: [(0, 0, 'i'), (1, 1, 'j')]}[stage]
    if big:
        cells = cells + [(c[0] + (1 if stage == 1 else 0), c[1] + (0 if stage == 1 else 1), 'j') for c in cells[:1]]
    for dx, dy, ch in cells:
        _put(g, x + dx, y + dy, ch)


FEATHER = (
    [".KKK.",
     "KWwvK",
     ".KKK."],
    ["KK...",
     "KWwK.",
     ".KwvK",
     "..KK."],
)


def feather(g, at, stage):
    """A loose neck feather knocked out by a hit: it flicks out flat, then tips and drifts."""
    rows = FEATHER[min(stage, 1)]
    x0, y0 = _r(at[0]) - 2, _r(at[1]) - 1
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch != '.':
                _put(g, x0 + dx, y0 + dy, ch)


SPOUT = (
    ["..c..", ".cdc.", "cdtdc"],                       # the shot breaks the surface: a white spout
    [".c.c.", "..d..", "c.t.c", ".dtd."],             # it falls apart in drops
    ["c...c", ".....", ".d.d.", "..t.."],             # the last drops, a ring on the water
)


def spout(g, x, surf, stage, big=False):
    """The water over the ducked gun's muzzle when it fires (FX letters, no outline): the spout
    stands on the surface row `surf` (its last row is the row above the surface)."""
    rows = SPOUT[stage]
    if big:
        rows = [r.replace('.', '.') for r in rows]
        rows = ['.' + r[1:-1] + '.' for r in rows[:1]] + rows
    x0 = _r(x) - 2
    y0 = surf - len(rows)
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch != '.':
                _put(g, x0 + dx, y0 + dy, ch)


def streak(g, a, b, ch='d'):
    """A straight speed streak from a to b (the honk's snap)."""
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for k in range(n):
        t = k / max(1, n - 1)
        _put(g, _r(a[0] + (b[0] - a[0]) * t), _r(a[1] + (b[1] - a[1]) * t), ch)


# ------------------------------------------------------------------ one picture
def picture(posture, aim, nk, gun=None, level=False, fx=None, water=None):
    """One neck-strip frame: the neck (pose nk), the belt (and on a shot the face plate), the barrel
    at aim (level: drawn at 0 deg, the swimming aims 0-1), then the effects (fx(g, ctx)).
    gun: kick (px back along the axis), plate (px the plate moves back), turn (degrees), feed.
    water: rows under the socket where the surface is (the ducked swan: her gun under it is
    repainted in the water ramp, the effects stop at the surface).
    Returns an art40.Frame anchored on the socket with `muzzle` = `cannon` (the resting barrel's
    tip: the shot leaves there on every phase), `head`, and the joint track (socket, head, the
    neck's middle, hub, `tip<aim>`: one tip joint per aim, so the gate measures the recoil inside
    an aim, not the code's jump from one aim to the next)."""
    gun = dict(gun or {})
    ai = 2 if level else aim
    s = socket_of(posture)
    S0 = (B.OX + s[0], B.OY + s[1])
    nrows, npts = neck_rows(posture, nk)
    brow, tip, hub = barrel_rows(posture, ai, kick=gun.get('kick', 0.0))
    deg = aim_deg(ai)
    ux, uy = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    pb = gun.get('plate', 0.0)
    shift = (_r(-ux * pb), _r(-uy * pb))
    g = _blank()
    _over(g, nrows)
    if pb or gun.get('turn'):
        plate(g, hub, shift=shift, turn=gun.get('turn', 0.0), skip=_leg_cells(posture))
    belt(g, hub, feed=gun.get('feed', 0), shift=shift)
    _over(g, brow)
    rt = rest_tip(posture, ai)
    ctx = {'tip': tip, 'rest': (S0[0] + rt[0], S0[1] + rt[1]), 'hub': hub, 'deg': deg, 'u': (ux, uy), 'socket': S0,
           'head': (B.OX + npts['head'][0], B.OY + npts['head'][1]),
           'neckmid': (B.OX + npts['neckmid'][0], B.OY + npts['neckmid'][1])}
    surf = None if water is None else S0[1] + water
    ctx['surf'] = surf
    if surf is not None:
        for y in range(surf, B.CH):
            g[y] = [UNDER.get(ch, ch) for ch in g[y]]
    if fx:
        fg = _blank()
        fx(fg, ctx)
        for y, row in enumerate(fg):
            if surf is not None and y >= surf:
                continue
            for x, ch in enumerate(row):
                if ch != '.':
                    g[y][x] = ch
    rows = drop_halos(clean(drop_halos([''.join(r) for r in g])))
    pts = {'muzzle': ctx['rest'], 'cannon': ctx['rest'], 'head': ctx['head']}
    joints = {'socket': S0, 'head': ctx['head'], 'neckmid': ctx['neckmid'], 'hub': hub, 'tip%d' % ai: tip}
    return X.Frame(rows, S0, pts=pts, joints=joints)


def drop_halos(rows):
    """The plate and the belt are drawn without an outline (they lie on the body strip's drum): a
    cell of theirs that touches transparency with only outline round it would read as a halo in
    the neck strip alone; it goes, and the body strip's drum shows there (the same tones)."""
    g = [list(r) for r in rows]
    H, W = len(g), max((len(r) for r in g), default=0)
    at = lambda x, y: g[y][x] if 0 <= x < W and 0 <= y < H else '.'
    for _ in range(6):
        drop = []
        for y in range(H):
            for x in range(W):
                ch = g[y][x]
                if ch == '.' or ch in 'KE' or ch in FX:
                    continue
                nb = [at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                opaque = [c for c in nb if c != '.']
                if len(opaque) < 4 and opaque and all(c == 'K' for c in opaque):
                    drop.append((x, y))
        if not drop:
            break
        for x, y in drop:
            g[y][x] = '.'
    return [''.join(r) for r in g]


KEEP = set('YyZ') | set(FX)          # hl and FX letters may stand alone (the check exempts them)


def clean(rows):
    """The core's orphan clean-up (frames.clean_orphans) with this set's FX letters kept: an edge
    pixel with no 8-neighbour of its own colour goes (outline) or takes its commonest neighbour."""
    g = [list(r) for r in rows]
    H, W = len(g), max((len(r) for r in g), default=0)
    at = lambda x, y: g[y][x] if 0 <= x < W and 0 <= y < H else '.'
    for _ in range(4):
        changed = False
        for y in range(H):
            for x in range(W):
                ch = g[y][x]
                if ch == '.' or ch in KEEP:
                    continue
                if all(at(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    continue
                nb = [at(x + dx, y + dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy]
                if ch in nb:
                    continue
                opaque = [c for c in nb if c != '.' and c not in KEEP]
                if ch in 'KE' or not opaque:
                    g[y][x] = '.'
                else:
                    g[y][x] = max(sorted(set(opaque)), key=opaque.count)
                changed = True
        if not changed:
            break
    return [''.join(r) for r in g]
