# DIRK in the extension sets: his own new heads, hand parts (pipe wrench, thermos cup), and the
# fixes to the generic families (heavy weapon, full body, deaths, Swan ride, Helium Head).
# dirk.py imports this module; hero.py / ext.py call after_ext() and after_derive().
import math
import rig
import pose
import parts as P
import anims as A
from anims import gun, hand
from rig import rotsprite
from heroes import dirk_heads as DH

P.HEADS.update(DH.HEADS)


# ------------------------------------------------------------------ helpers
def crop(rows):
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    xs = [x for r in rows for x, c in enumerate(r) if c != '.']
    x0, y0 = min(xs), min(ys)
    return [r[x0:max(xs) + 1] for r in rows[y0:max(ys) + 1]], (x0, y0)


def held(item, grip, deg=0, fist='grip', pad=12):
    """A hand part: DIRK's fist closed round the item's grip point, the item turned by deg
    (RotSprite around the grip, positive = counter-clockwise). Returns (rows, {'wrist', 'tip'})."""
    rows = item
    w = max(len(r) for r in rows)
    n = 2 * pad + max(w, len(rows))
    g = [['.'] * n for _ in range(n)]
    ox, oy = pad - int(grip[0]), pad - int(grip[1])
    piv = (pad + grip[0] - int(grip[0]), pad + grip[1] - int(grip[1]))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                g[oy + y][ox + x] = ch
    g = [''.join(r) for r in g]
    if deg:
        g = rotsprite(g, piv, deg)
    g = [list(r) for r in g]
    # the fist: the fingers wrap the grip, the cuff behind (wrist at the left)
    F = FIST[fist]
    for y, r in enumerate(F[0]):
        for x, ch in enumerate(r):
            if ch != '.':
                g[pad - F[1][1] + y][pad - F[1][0] + x] = ch
    rows2, (x0, y0) = crop([''.join(r) for r in g])
    wx, wy = pad - F[1][0] + F[2][0] - x0, pad - F[1][1] + F[2][1] - y0
    return rows2, {'wrist': (wx, wy)}


# a fist round a grip: rows, the grip point in it, the wrist point in it
FIST = {
  'grip': (["RSS", "RSs", ".s."], (1, 1), (0, 1)),
}

# pipe wrench: a steel hooked jaw and adjusting nut (gun greys) on a red-painted handle (the
# plunger's rubber red), so it does not read as a second pistol; grip point = low on the handle
WRENCH = [
  "gGGGg",
  "NnnnN",
  ".N...",
  "gGGg.",
  "NgnN.",
  ".CE..",
  ".CE..",
  ".CE..",
  ".CE..",
  ".EE..",
]
WR_GRIP = (1.5, 8)       # between the two handle columns

# steel thermos cup (gun greys), seen from the side; grip point = its middle at the back
CUP = [
  "gGGGn",
  "gGGgN",
  "gGGgN",
  "ngggN",
  ".nnN.",
]
CUP_GRIP = (0, 2)
# tipped toward the mouth (the rim up and back), drawn by hand
CUP_SIP = [
  ".gGn.",
  "gGGGn",
  ".gGGgN",
  "..ngggN",
  "...nnN.",
]
CUP_SIP_GRIP = (2, 3)

HP = {}
for nm, deg in (('wr_up', 0), ('wr_fwd', -90), ('wr_dn', 180), ('wr_back', 90), ('wr_tilt', -40),
                ('wr_q1', -45), ('wr_q3', -135), ('wr_q5', 135), ('wr_q7', 45)):
    HP[nm] = held(WRENCH, WR_GRIP, deg)
HP['cup'] = held(CUP, CUP_GRIP, 0)
HP['cup_sip'] = held(CUP_SIP, CUP_SIP_GRIP, 0)
P.HANDS.update(HP)

# steam from the cup (warm smoke letters, no outline)
P.FX['stm0'] = (["..D", ".d.", "..d"], (1, 2))
P.FX['stm1'] = ([".D.", "..d", ".d."], (1, 2))


# ------------------------------------------------------------------ lighting of the far arm
# The far polo sleeve is dark; a far arm brought in front of the torso (z >= 4 RELATIVE to the
# layer base, so full-body poses keep their depth) gets the near arm's ramp. dirk.py's first patch
# compared the absolute z, which lit every far arm in the full-body poses (base 10).
_ZU = [0]
_draw_upper = pose.draw_upper


def _draw_upper_zu(cv, X, p, pel, zu, meta):
    _ZU[0] = zu
    try:
        return _draw_upper(cv, X, p, pel, zu, meta)
    finally:
        _ZU[0] = 0


_arm0 = None


def _arm_rel(cv, X, sh, hnd, bend, ramp, z, part, end=None):
    if ramp == 'armF' and z - _ZU[0] >= 4:
        ramp = 'arm'
    return _arm0(cv, X, sh, hnd, bend, ramp, z, part, end)


def install_light():
    global _arm0
    import heroes.dirk as D
    _arm0 = D._arm                      # the original pose.arm (before dirk.py's patch)
    pose.arm = _arm_rel
    pose.draw_upper = _draw_upper_zu


# ------------------------------------------------------------------ full-body pose helpers
def fp(*a, **k):
    import ext_moves as EM
    return EM.fp(*a, **k)


ST = ((0, -17), (-5, -4), (5, -4))
LOW = gun((6, 7), 'low')
# DIRK's pistol-to-the-sky arm (as his own shoot-up: the sleeve passes under the chin, the
# mustache stays clear)
SKY = gun((8.5, -6), 'up', sh=(2.5, -1))
PL = lambda h, kind, b=-1, z=None, sh=(0, 0): hand(h, kind, 'hand', bend=b, z=z, sh=sh)


def victory_set():
    """Pistol to the sky, the plunger raised high behind his head like a trophy; a hop."""
    S = []
    sky = gun((10, -3.5), 'dup', sh=(1.5, -0.5))      # up and forward: the grin stays clear
    top = PL((-5, -8), 'pl_up', b=1)
    mid = PL((-6, -5), 'pl_up', b=1)
    S.append((fp(*ST, head='happy', armN=sky, armF=top), 6))
    S.append((fp((0, -15), (-6, -4), (5, -4), head='happy', armN=sky, armF=mid), 6))
    S.append((fp((0, -18), (-5, -2), (4, -2), 'toe', 'toe', head='shout', armN=sky, armF=top), 5))
    S.append((fp((0, -18), (-5, -4), (3, -6), 'hang', 'hang', head='happy', armN=sky, armF=top), 6))
    S.append((fp((0, -17), (-5, -3), (5, -4), 'toe', 'flat', head='happy', armN=sky, armF=top), 4))
    S.append((fp((0, -15), (-6, -4), (5, -4), head='shout', armN=sky, armF=mid), 6))
    S.append((fp(*ST, head='happy', armN=sky, armF=top), 6))
    S.append((fp(*ST, head='happy', armN=sky, armF=mid), 6))
    return S


def bored_set():
    """Long idle: a steel thermos cup from the tool belt, a blow on the hot coffee, a long sip with
    the head tipped back (the mustache dips in), a contented sigh, a bored foot tap, cup away."""
    S = []
    F = lambda h, kind, z=6.5, b=-1: hand(h, kind, 'hand', bend=b, z=z)
    cup = lambda h=(7, 2): F(h, 'cup')
    steam = lambda k: [('stm%d' % k, ('armF', 'wrist', 4, -4))]
    S.append((fp(*ST, head='fwd', armN=LOW, armF=hand((9, 5))), 12))
    S.append((fp(*ST, head='down', armN=LOW, armF=hand((-2, 8), 'fist', z=1)), 6))
    S.append((fp(*ST, head='down', armN=LOW, armF=cup((7, 3)), fx=steam(0)), 8))
    S.append((fp(*ST, head='blink', armN=LOW, armF=cup((8, 0)), fx=steam(1)), 8))
    S.append((fp(*ST, head='up', hd=(-1, 0), armN=LOW, armF=F((8.5, -3.5), 'cup_sip')), 18))
    S.append((fp(*ST, head='smug', armN=LOW, armF=cup(), fx=steam(0)), 12))
    S.append((fp(*ST, head='bored', tor=(0, 1), armN=LOW, armF=cup((7, 3)), fx=steam(1)), 12))
    S.append((fp((0, -17), (-5, -4), (5, -5), 'flat', 'heel', head='bored', armN=LOW, armF=cup((7, 3)), fx=steam(0)), 6))
    S.append((fp(*ST, head='bored', armN=LOW, armF=cup((7, 3)), fx=steam(1)), 6))
    S.append((fp((0, -17), (-5, -4), (5, -5), 'flat', 'heel', head='bored', armN=LOW, armF=cup((7, 3)), fx=steam(0)), 6))
    S.append((fp(*ST, head='down', armN=LOW, armF=hand((-2, 8), 'fist', z=1)), 6))
    S.append((fp(*ST, head='blink', armN=gun((8, 4)), armF=hand((9, 5))), 6))
    return S


def fidgetb_set():
    """Second fidget: the pipe wrench from the tool belt, a slap into the open palm, a twirl, back."""
    S = []
    F = lambda h, kind, z=6.5, b=-1: hand(h, kind, 'hand', bend=b, z=z)
    palm = hand((7, 3), 'open', 'hand', z=5)
    S.append((fp(*ST, head='fwd', armN=LOW, armF=hand((9, 5))), 10))
    S.append((fp(*ST, head='down', armN=LOW, armF=hand((-2, 8), 'fist', z=1)), 6))
    S.append((fp(*ST, head='down', armN=LOW, armF=F((7, 3), 'wr_fwd')), 6))
    S.append((fp(*ST, head='smug', armN=palm, armF=F((7.5, -1.5), 'wr_q1')), 6))
    S.append((fp(*ST, head='smug', hd=(0, 1), armN=palm, armF=F((7, 1.5), 'wr_fwd')), 8))
    for k in ('wr_dn', 'wr_back', 'wr_up', 'wr_fwd'):            # the twirl, a full turn
        S.append((fp(*ST, head='fwd', armN=LOW, armF=F((9, 2), k)), 3))
    S.append((fp(*ST, head='smug', armN=LOW, armF=F((8, 3), 'wr_fwd')), 12))
    S.append((fp(*ST, head='down', armN=LOW, armF=hand((-2, 8), 'fist', z=1)), 6))
    S.append((fp(*ST, head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 10))
    return S


def set_arm(key, i, which, **kw):
    """Edit one arm of one FULL frame in place."""
    p, t = A.FULL[key][i]
    p = dict(p)
    a = dict(p[which])
    a.update(kw)
    p[which] = a
    A.FULL[key][i] = (p, t)


def fix_deaths():
    F = A.FULL
    # the sky arm everywhere a full pose raises the pistol straight up
    for key in ('spawn', 'death_burn', 'death_blast'):
        for i, (p, t) in enumerate(F[key]):
            a = p.get('armN') or {}
            if a.get('end') == ('gun', 'up'):
                set_arm(key, i, 'armN', **SKY)
    # respawn: he drops in with the pistol up and forward (as in his victory), the face clear
    for i in (0, 1):
        set_arm('spawn', i, 'armN', **gun((10, -3.5), 'dup', sh=(1.5, -0.5)))
    # burn: the jolt and the hop keep the pistol in front of the chest, not over the mustache
    set_arm('death_burn', 0, 'armN', hand=(10, -2))
    set_arm('death_burn', 1, 'armN', hand=(10, -3.5))
    # drown: the arms slap the water forward and back below the chin
    op = lambda h, b=1, sh=(0, 0): dict(hand=h, end=('hand', 'open'), bend=b, sh=sh)
    for i, h in enumerate([(10, 2), (9, 1.5), (10, 3.5), (9, 1.5)]):
        set_arm('death_drown', i, 'armN', **op(h))
    # the wave for help goes up in front of the chest, then high (the head is under by then)
    set_arm('death_drown', 4, 'armN', hand=(11, -1))
    set_arm('death_drown', 5, 'armN', hand=(10, -3))
    # the time-out stretch: the pistol arm goes up and forward, clear of the yawning mouth
    set_arm('yawn', 1, 'armN', hand=(10, -2.5))
    set_arm('yawn', 2, 'armN', hand=(10, -4))
    # mount and Swan hop: the fists reach forward below the chin, not across the mustache
    set_arm('mount', 1, 'armN', hand=(10, -1))
    set_arm('mount', 1, 'armF', hand=(10, -2))
    set_arm('mount', 2, 'armN', hand=(10, 2))
    set_arm('mount', 2, 'armF', hand=(10, 1))
    set_arm('mounthop', 1, 'armN', hand=(10, 2))
    set_arm('mounthop', 1, 'armF', hand=(9, 1))
    # blast: the arms fly out below the chin (the tumble turns the whole figure)
    set_arm('death_blast', 0, 'armN', hand=(10, -1.5))
    for i in (1, 5):
        set_arm('death_blast', i, 'armN', hand=(10, -1.5))
    for i in (2, 3, 4):
        set_arm('death_blast', i, 'armN', hand=(9, -2.5))


# ------------------------------------------------------------------ heavy weapon
NEAR_SH = {'h_fwd': (3.5, 0.5), 'h_d45': (2, 0), 'h_down': (1.5, 0), 'h_u22': (1.5, 0), 'h_u45': (0.5, 0)}


def fix_heavy():
    """The near shoulder rolls forward over the gun (DIRK only), so his dark polo sleeve no longer
    covers the whole hi-vis vest front; then the heavy sets are rebuilt from the patched helper."""
    import ext_heavy as EH
    hv0 = EH.hv

    def hv(aim='h_fwd', w=(5, -1.5), torso='hback', tor=(0, 0), head='fwd', hd=(0, 0), sN=(0, 0), sF=(7, 2), **k):
        d = NEAR_SH.get(aim, (0, 0))
        return hv0(aim, w, torso, tor, head, hd, (sN[0] + d[0], sN[1] + d[1]), sF, **k)
    EH.hv = hv
    U = A.UPPER
    U['h_idle'] = EH.h_idle()
    U['h_run'] = EH.h_run()
    U['h_jump'] = EH.h_jump()
    U['h_crouchidle'] = EH.h_crouchidle()
    U['h_shoot'] = EH.fire_loop('h_fwd', EH.W0, (-1, 0), 'hf')
    U['h_crouchshoot'] = EH.fire_loop('h_fwd', EH.WC, (-1, 0), 'hf', torso='lean2', hd=(1, 0), src='crouchshoot')
    U['h_aimup'] = EH.h_aimup()
    U['h_diagup'] = [(EH.sweep_pose(EH.SWEEP[2], EH.U('aimup', 1)), 4)]
    U['h_shootdiagup'] = EH.sweep_fire(EH.SWEEP[2], 'hq', (-0.7, 0.7))
    U['h_shootup'] = EH.sweep_fire(EH.SWEEP[4], 'hu', (0, 1))
    U['h_aimdown'] = EH.h_aimdown()
    U['h_diagdown'] = [(EH.sweep_pose(EH.DOWN[1], EH.U('aimdown', 0), torso='lean'), 4)]
    U['h_shootdiagdown'] = EH.sweep_fire(EH.DOWN[1], 'he', (-0.7, -0.7), torso='lean', src='shootdown')
    U['h_shootdown'] = EH.sweep_fire(EH.DOWN[2], 'hd', (0, -1), torso='lean', src='shootdown')
    hi, hc = EH.U('h_idle'), EH.U('h_crouchidle')
    U['h_grenade'] = EH.heavy_swap(U['grenade'], ready=hi)
    U['h_crouchgrenade'] = EH.heavy_swap(U['grenade'], crouch=True, ready=hc)
    # the plunger melee with the heavy gun hanging at the hip: the smack goes forward at chest
    # height (the core smack goes down, right into the heavy barrel)
    sl = heavy_slash_src()
    U['h_slash'] = EH.heavy_swap(sl, ready=hi)
    U['h_crouchslash'] = EH.heavy_swap(sl, crouch=True, ready=hc)
    U['h_stab'] = EH.heavy_swap(heavy_stab_src(), ready=hi)
    # the crouched pistol melee: the same forward smack (the core one goes down into the knees)
    U['crouchslash'] = EH.crouch_set(sl, EH.U('crouchidle'))
    EH.hv = hv0


def heavy_slash_src():
    from heroes import dirk_anims as DA
    S = list(DA.slash_set())
    low = gun((5, 8), 'low')
    pl = lambda h, kind, **k: hand(h, kind, 'hand', z=6.5, **k)
    up = A.up
    S[4] = (up(torso='lean2', head='shout', near=low, far=pl((10, -0.5), 'pl_fwd', bend=1),
               fx=[('pswing3', DA.SW), ('plop0', ('armF', 'tip', 0, 0))]), 3)
    S[5] = (up(torso='lean', head='fwd', near=low, far=pl((9, 0.5), 'pl_fwd'),
               fx=[('plop1', ('armF', 'tip', 0, 0))]), 4)
    return S


def heavy_stab_src():
    from heroes import dirk_anims as DA
    S = list(DA.stab_set())
    low = gun((5, 8), 'low')
    pl = lambda h, kind, **k: hand(h, kind, 'hand', z=6.5, **k)
    up = A.up
    S[0] = (up(torso='back', head='fwd', near=low, far=pl((2, 2), 'pl_fwd')), 4)
    S[4] = (up(torso='lean', head='fwd', near=low, far=pl((8, 0.5), 'pl_fwd'), fx=[('plop2', ('armF', 'tip', 1, 0))]), 4)
    return S


# ------------------------------------------------------------------ Swan ride
def fix_ride():
    """Ears: the palms on DIRK's own ears (his torso is bigger, so the generic ear point sat low on
    the jaw). Cheer: the fist pumps out in front of the face, so his grin and mustache show."""
    import ext_ride as ER

    def ears(head, tor=(0, 1)):
        shN, shF, neck = ER._shoulders('up', tor)
        ear = (neck[0] - 0.5, neck[1] - 4.5)
        near = dict(hand=ER._to(ear, shN, 'ear'), end=('hand', 'ear'), bend=1, z=6.5)
        far = dict(hand=ER._to((ear[0] - 4, ear[1] - 1), shF, 'ear'), end=('hand', 'ear'), bend=1, z=4.5)
        return ER.rider('up', head, tor, near=near, far=far, cape=('settle', 0))

    def cheer(k):
        shN, _, _ = ER._shoulders('up', (0, 0))
        wrist = [(13, -9), (12, -6)][k]
        near = dict(hand=(wrist[0] - shN[0], wrist[1] - shN[1]), end=('fist', 'fistup'), bend=-1, z=6.5)
        return ER.rider('up', ['happy', 'shout'][k], (0, 0), near=near, cape=('billow', 0.25 * k))
    if 'ride_ears' in A.UPPER:
        A.UPPER['ride_ears'] = [(ears('blink'), 6), (ears('panic'), 6)]
        A.UPPER['ride_cheer'] = [(cheer(0), 8), (cheer(1), 8)]


# ------------------------------------------------------------------ hooks
def after_ext():
    fix_ride()
    fix_heavy()
    A.FULL['victory'] = victory_set()
    A.FULL['bored'] = bored_set()
    A.FULL['fidgetb'] = fidgetb_set()
    fix_deaths()


# ------------------------------------------------------------------ Helium Head (balloon heads)
def _grid(rows):
    w = max(len(r) for r in rows)
    return [list(r.ljust(w, '.')) for r in rows]


def _chin(g):
    """The sphere shading turns his whole stubbled chin dark ('B'): below the mustache, keep 'B'
    only on the shadow rim (lower left) and give the rest back its light stubble 'b'."""
    H, W = len(g), len(g[0])
    must = [y for y in range(H) if sum(ch in 'hH' for ch in g[y][W // 2:]) >= 4]
    y0 = (max(must) + 1) if must else H - 6
    out = [r[:] for r in g]
    for y in range(y0, H):
        for x in range(W):
            if g[y][x] != 'B':
                continue
            rim = any(not (0 <= x + dx < W and 0 <= y + dy < H) or g[y + dy][x + dx] == '.'
                      for dx, dy in ((-1, 0), (0, 1), (-1, 1)))
            rim2 = any(0 <= x + dx < W and 0 <= y + dy < H and g[y + dy][x + dx] == '.'
                       for dx, dy in ((-2, 0), (0, 2)))
            if not rim and not (rim2 and x < W // 2):
                out[y][x] = 'b'
    return out


# spiky tufts above the balloon's crown: (x as a fraction of the width, height, lean)
TUFTS = [(0.30, 2, -1), (0.42, 3, 0), (0.55, 4, 1), (0.68, 3, 1), (0.80, 2, 1)]


def _tufts(g, an):
    """DIRK's messy spiky hair and quiff poking up out of the round balloon."""
    H, W = len(g), len(g[0])
    pad = 5
    g = [['.'] * W for _ in range(pad)] + g
    for fx, h, lean in TUFTS:
        x = int(round(fx * (W - 1)))
        top = next((y for y in range(len(g)) if g[y][x] != '.'), None)
        if top is None:
            continue
        for k in range(1, h + 1):
            xx = x + int(round(lean * k / 2.0))
            if 0 <= xx < W:
                g[top - k][xx] = 'A' if k < h else 'A'
                if k < h and 0 <= xx - 1 < W and g[top - k][xx - 1] == '.':
                    g[top - k][xx - 1] = 'H'
    rows = [''.join(r) for r in g]
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    y0 = min(ys)
    return rows[y0:], {'neck': (an['neck'][0], an['neck'][1] + pad - y0)}


def _turn_ball(rows, an, deg, pad=4):
    """Look up / down: the round balloon turns around its centre (the silhouette stays round)."""
    w = max(len(r) for r in rows)
    g = ['.' * (w + 2 * pad)] * pad + ['.' * pad + r.ljust(w, '.') + '.' * pad for r in rows] + ['.' * (w + 2 * pad)] * pad
    c = (pad + (w - 1) / 2, pad + (len(rows) - 1) / 2)
    out = rotsprite(g, c, deg)
    out, (x0, y0) = crop(out)
    return out, {'neck': (an['neck'][0] + pad - x0, an['neck'][1] + pad - y0)}


def balloon_fix():
    import ext_ride_helium as HE
    names = [k for k in P.HEADS if not k.startswith('he_')]
    base = {}
    for n in names:
        if n in ('up', 'down'):
            continue
        rows, an = HE.balloon(P.HEADS[n])
        base[n] = ([''.join(r) for r in _chin(_grid(rows))], an)
    # up / down: DIRK's 'up' head is a bigger, tilted grid that inflates lopsided; turn the
    # finished front balloon instead (the face slides up or down the sphere)
    base['up'] = _turn_ball(*base['shout'], 14)
    base['down'] = _turn_ball(*base['fwd'], -12)
    for n, (rows, an) in base.items():
        P.HEADS['he_' + n] = _tufts(_grid(rows), an)


def after_derive():
    balloon_fix()
