# THOM's own versions of the extension families (heavy melee, the pistol diagonals, the full-body
# moves, the deaths, the ride cheer, Helium Head). Imported by heroes/thom.py; the heads are added at
# import time (so Helium Head derives balloons from them), the poses in after_ext(), the hand-touched
# balloon heads in after_derive().
import math
import parts as P
import pose
import anims as A
import ext
from anims import up, gun, hand
from heroes import thom_parts as TP
from heroes import thom_anims as TA

edit = TP.edit
DY = pose.PEL_DY
_H = TP._HEAD
_NK = {'neck': (8, 12)}

# ---------------------------------------------------------------- new heads (17 x 13, neck (8, 12))
# happy: the squint turns into a laughing arc, the jaw drops in a big open laugh
P.HEADS['happy'] = (edit(_H, [(5, 13, 'QQ'), (6, 12, 'QSSQ'), (9, 9, 'Qzzzzzs'), (10, 10, 'Qwwwwz'),
                              (11, 11, 'zQssz'), (12, 8, 'zssSzz')]), _NK)
# panic: the eye pops open (white, small pupil), the grin collapses into a round 'O'
P.HEADS['panic'] = (edit(_H, [(5, 13, 'ww'), (6, 13, 'wQ'), (7, 13, 'SS'), (9, 9, 'sSzzzSs'),
                              (10, 10, 'SzQQz'), (11, 11, 'zQQz'), (12, 8, 'zssSzz')]), _NK)
# yawn: the eye squeezed shut, the jaw drops into a tall open mouth (one row longer)
P.HEADS['yawn'] = (edit(_H + ["................."], [(5, 13, 'zz'), (6, 12, 'zQQz'), (9, 9, 'sSzzzzs'),
                                                      (10, 10, 'zwwwwz'), (11, 10, 'zQQQQz'), (12, 7, 'QzszQsQz'),
                                                      (13, 8, 'Qzzzzz')]), {'neck': (8, 13)})
# sleep: the eye shut (a low lid line), the grin relaxed into a small open smile
P.HEADS['sleep'] = (edit(_H, [(5, 13, 'HH'), (6, 12, 'SSSS'), (7, 12, 'zQQz'), (9, 9, 'sSSSSSs'),
                              (10, 10, 'SSSzQ'), (11, 11, 'SSQz')]), _NK)
# bored: a heavy lid over the slit, a flat line of a mouth
P.HEADS['bored'] = (edit(_H, [(5, 13, 'QQ'), (6, 13, 'wQ'), (9, 9, 'sSSSSSs'), (10, 10, 'SSzzzz'),
                              (11, 11, 'SSSz')]), _NK)
# soot: the blast lifts the cap off the scalp (singed blond tufts show under it), the eye pops
# white, the jaw hangs open over the teeth (the soot pass blackens everything except the whites)
_SOOT = _H[:5] + ["...A.H.AH.HA.A...", "...HAHHAHHAHAH..."] + _H[5:]
_SOOT = edit(_SOOT, [(7, 4, 'HH'), (7, 13, 'ww'), (8, 13, 'wQ'), (11, 9, 'Qzzzzzs'), (12, 10, 'QwwwwQ'),
                     (13, 11, 'zQQQz'), (14, 8, 'zssSzz')])
P.HEADS['soot'] = (_SOOT, {'neck': (8, 14)})
P.HEADS['sootblink'] = (edit(_SOOT, [(7, 13, 'SS'), (8, 13, 'QQ')]), {'neck': (8, 14)})


# ---------------------------------------------------------------- pelvis-relative items
# A pose may carry 'pitems': [(item, (dx, dy), z)] placed relative to the pelvis (+ the torso offset),
# so a tucked pistol rides with the body on the sheet AND in the export (plain 'items' are relative
# to the ground point, which the sheet and the export treat differently for a crouched upper).
def _post(cv, X, p, layer, meta):
    if layer == 'lower' or not p.get('pitems'):
        return
    pel, to = meta['pel'], p.get('tor', (0, 0))
    for name, (dx, dy), z in p['pitems']:
        pose.place(cv, X, X.P.ITEMS[name], 'c', (pel[0] + to[0] + dx, pel[1] + to[1] + dy), z, 'item:' + name)


pose.HOOKS['post'] = _post     # ext_moves chains its own hook after this one


def _pitems(p):
    """Turn the tucked pistol of a core pose (root-relative item) into a pelvis-relative one."""
    q = dict(p)
    its = q.pop('items', [])
    keep = [it for it in its if it[0] != 'tuck']
    tk = [('tuck', (x, y + 17 - DY), z) for n, (x, y), z in its if n == 'tuck']
    if keep:
        q['items'] = keep
    if tk:
        q['pitems'] = tk
    return q


# ---------------------------------------------------------------- pistol diagonals (up)
# The generic turn lifts the far pistol (the high one of his akimbo) up against the cap. Here the
# far pistol is the LOWER one on the diagonal: both barrels parallel at 45 degrees, the far one
# offset down-forward (perpendicular to the barrels), so they read as two guns clear of the face.
DUN, DUF = (7.5, -2.5), (9.5, 0.5)        # near / far hand targets from the (shifted) shoulders
SHN_D, SHF_D = (1.5, -0.5), (3, 0)


def _rot(v, deg):
    a = math.radians(deg)
    return (v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a))


def diagup_sets():
    def kick(k):
        r = _rot(k, -45)
        return r[0] * 0.8, r[1] * 0.8

    def make(kn, kf, firing):
        a, b = kick(kn), kick(kf)
        return up(head='shout' if firing else 'fwd',
                  near=gun((DUN[0] + a[0], DUN[1] + a[1]), 'dup', sh=SHN_D),
                  far=gun((DUF[0] + b[0], DUF[1] + b[1]), 'dupF', sh=SHF_D))
    shoot = TA.alt_set(make, ['fq0', 'fq1', 'fq2', 'fsm'])
    ready = TA.akimbo()
    half = up(near=gun(_rot(TA.NB, -22), 'fwd', sh=(0.8, -0.3)), far=gun(_rot(TA.FB, -10), 'fwdF', sh=(1.5, 0)))
    aim = make((0, 0), (0, 0), False)
    return [(half, 2), (aim, 2)], shoot


# ---------------------------------------------------------------- heavy melee: both hands on the gun
# The gun turned round (stock forward): the part is mirrored, then the hand inside it is mirrored
# back in place, so the cuff still faces the arm. 'tip' = the end of the stock (the striking point).
HAND = set('jSsL')


def _rev(name, tip):
    rows, an = TP.flip(P.GUNS[name])
    w = len(rows[0])
    g = [list(r) for r in rows]
    pts = [(x, y) for y, r in enumerate(g) for x, ch in enumerate(r) if ch in HAND]
    x0, x1 = min(x for x, _ in pts), max(x for x, _ in pts)
    val = {(x, y): g[y][x] for x, y in pts}
    for x, y in pts:
        g[y][x] = '.'
    for (x, y), ch in sorted(val.items()):
        g[y][x0 + x1 - x] = ch
    an = dict(an)
    an['wrist'] = (x0 + x1 - an['wrist'][0], an['wrist'][1])
    an['tip'] = (w - 1 - tip[0], tip[1])
    return [''.join(r) for r in g], an


def heavy_parts():
    P.GUNS['h_rfwd'] = _rev('h_fwd', (-1, 3))       # stock forward, level
    P.GUNS['h_r22'] = _rev('h_u22', (-1, 8.5))      # stock forward and a little down (the jab)
    P.GUNS['h_r45'] = _rev('h_u45', (-1, 12))       # stock down-forward (the end of the chop)
    P.GUNS['h_r135'] = _rev('h_d45', (1.5, -1))     # stock up-forward (the top of the chop)


SLH = (6, -24 + DY)       # the chop arc centre (root-relative)


def heavy_melee():
    import ext_heavy as EH
    hv = EH.hv
    hi = A.UPPER['h_idle'][0][0]
    S = []
    # rising butt stroke: the gun dips back at the hip, then the stock swings up and forward to
    # chin height while the barrel drops down and back past his legs (the face stays clear)
    S.append((hv('h_low', (1, 0), torso='back', head='fwd', sN=(0, 0), sF=(4, 2)), 4))
    S.append((hv('h_d45', (4, -4), torso='up', head='shout', sN=(0.5, 0), sF=(5, 1)), 2))
    S.append((hv('h_down', (6, -7), torso='lean', head='shout', sN=(1, 0), sF=(5, 1),
                 fx=[('slash1', SLH)]), 2))
    S.append((hv('h_r135', (9.5, -8), torso='lean2', head='shout', sN=(1, -0.5), sF=(6, 0),
                 fx=[('slash2', SLH)]), 3))
    S.append((hv('h_r135', (9, -7), torso='lean', head='fwd', sN=(1, 0), sF=(6, 0),
                 fx=[('slash3', SLH)]), 4))
    S.append((dict(hi), 6))
    J = []
    # stock jab: the gun turned round, level at the chest, pulled back, then rammed forward stock first
    J.append((hv('h_rfwd', (3, 0), torso='back', head='fwd', sN=(0, 0), sF=(3, 1)), 4))
    J.append((hv('h_rfwd', (7, 0), torso='lean', head='shout', sN=(1, 0), sF=(5, 1)), 2))
    J.append((hv('h_rfwd', (10, 0), torso='lean2', head='shout', sN=(1.5, 0), sF=(6, 1),
                 fx=[('stab', ('armN', 'tip', 1, 0))]), 3))
    J.append((hv('h_rfwd', (10, 0), torso='lean2', head='shout', sN=(1.5, 0), sF=(6, 1)), 4))
    J.append((hv('h_rfwd', (6, 0), torso='lean', head='fwd', sN=(1, 0), sF=(5, 1)), 4))
    J.append((dict(hi), 6))
    hc = A.UPPER['h_crouchidle'][0][0]
    C = [((dict(hc) if p is hi or k == len(S) - 1 else EH.crouched(p)), t) for k, (p, t) in enumerate(S)]
    return S, J, C


# ---------------------------------------------------------------- full body: helpers
def g(h, aim='fwd', bend=-1, sh=(0, 0), z=None):
    return gun(h, aim, bend, sh, z)


def fg(h, aim='fwd', bend=-1, sh=(0, 0), z=None):
    return gun(h, aim + 'F', bend, sh, z)


def setarm(p, key, a):
    q = dict(p)
    q[key] = a
    return q


def give(p, key, aim, hand_=None, bend=None, sh=None):
    """Swap the hand of an arm for a pistol (keeps the arm's target unless a new one is given)."""
    a = dict(p[key])
    a['end'] = ('gun', aim)
    if hand_ is not None:
        a['hand'] = hand_
    if bend is not None:
        a['bend'] = bend
    if sh is not None:
        a['sh'] = sh
    q = dict(p)
    q[key] = a
    return q


ST = ((0, -17), (-5, -4), (5, -4))
SKY_N = g(TA.UN, 'up', sh=TA.SHU_N)
SKY_F = fg(TA.UF, 'up', sh=TA.SHU_F)
PUMP_N = g((TA.UN[0], TA.UN[1] + 2.5), 'up', sh=TA.SHU_N)
PUMP_F = fg((TA.UF[0] + 1, TA.UF[1] + 2.5), 'up', sh=TA.SHU_F)
RDY_N, RDY_F = g(TA.NB), fg(TA.FB)
LOW_N, LOW_F = g((6, 7), 'low'), fg((6, 6), 'low')


def victory_set(fp):
    """Both pistols to the sky, a hop, a pump, a shot into the air from each pistol."""
    S = []
    S.append((fp(*ST, head='happy', armN=SKY_N, armF=SKY_F), 6))
    S.append((fp((0, -15), (-6, -4), (5, -4), head='happy', armN=PUMP_N, armF=PUMP_F), 6))
    S.append((fp((0, -18), (-5, -2), (4, -2), 'toe', 'toe', head='shout', armN=SKY_N, armF=SKY_F), 5))
    S.append((fp((0, -18), (-5, -4), (3, -6), 'hang', 'hang', head='happy', armN=SKY_N, armF=SKY_F,
                 fx=[('fu0', ('armN', 'muzzle', 0, 0))]), 6))
    S.append((fp((0, -17), (-5, -3), (5, -4), 'toe', 'flat', head='happy', armN=SKY_N, armF=SKY_F,
                 fx=[('fusm', ('armN', 'muzzle', 0, -1))]), 4))
    S.append((fp((0, -15), (-6, -4), (5, -4), head='shout', armN=PUMP_N, armF=PUMP_F,
                 fx=[('fu0', ('armF', 'muzzle', 0, 0))]), 6))
    S.append((fp(*ST, head='happy', armN=SKY_N, armF=SKY_F, fx=[('fusm', ('armF', 'muzzle', 0, -1))]), 6))
    S.append((fp(*ST, head='smug', armN=SKY_N, armF=SKY_F), 6))
    return S


def spawn_set(fp):
    S = []
    S.append((fp((0, -18), (-3, -2), (3, -3), 'hang', 'hang', head='shout', armN=SKY_N, armF=SKY_F), 4))
    S.append((fp((0, -17), (-4, -3), (4, -4), 'hang', 'heel', head='shout', armN=SKY_N, armF=PUMP_F), 4))
    S.append((fp((0, -11), (-6, -3), (6, -4), 'toe', 'flat', torso='lean2', head='fwd', hd=(1, 0),
                 armN=g((9, 3)), armF=fg((10.5, -2))), 4))
    S.append((fp((0, -13), (-6, -4), (5, -4), torso='lean', head='fwd', armN=g((9, 3.5)), armF=fg((10, -1.5))), 3))
    S.append((fp((0, -16), (-5, -4), (5, -4), head='smug', armN=RDY_N, armF=RDY_F), 3))
    S.append((fp(*ST, head='fwd', armN=RDY_N, armF=RDY_F), 6))
    return S


TW = (8.5, 2)
TWF = (9.5, 0)
BELT = [('tuck', (2, 0), 14.6), ('tuck', (-3, 0), 13.0)]     # the two grips in his belt (full layer z)


def bored_set(fp):
    """Spin both pistols, slide them into the belt, fold the arms, tap a boot, a big sigh, draw again."""
    S = []
    fold = dict(armN=dict(hand=(-0.5, 4.5), end=('fist', 'fist'), bend=1),
                armF=dict(hand=(6, 4), end=('hand', 'openF'), bend=-1, z=5.5), pitems=BELT)
    S.append((fp(*ST, head='fwd', armN=RDY_N, armF=RDY_F), 10))
    for an, af in (('down', 'back'), ('back', 'fwd'), ('fwd', 'down')):
        S.append((fp(*ST, head='smug', armN=g(TW, an), armF=fg(TWF, af)), 3))
    S.append((fp(*ST, head='down', armN=g((2.5, 7.5), 'down'), armF=fg((4, 7), 'down')), 6))
    S.append((fp(*ST, head='smug', **fold), 8))
    S.append((fp(*ST, head='bored', **fold), 12))
    S.append((fp((0, -17), (-5, -4), (5, -5), 'flat', 'heel', head='bored', **fold), 6))
    S.append((fp(*ST, head='bored', **fold), 6))
    S.append((fp((0, -17), (-5, -4), (5, -5), 'flat', 'heel', head='bored', **fold), 6))
    S.append((fp(*ST, head='sleep', tor=(0, 1), **fold), 16))
    S.append((fp(*ST, head='smug', armN=RDY_N, armF=RDY_F), 6))
    return S


def fidgetb_set(fp):
    """Polish: rub the near pistol on his sleeve, hold it up to admire it, a gleam runs along the
    barrel, a smug grin, back to the ready pose."""
    S = []
    rub = lambda dx, hd='down': fp(*ST, head=hd, armN=g((1.5 + dx, 4), 'back', bend=1), armF=LOW_F)
    adm = g((6.5, -4.5), 'dup', sh=(1.5, -0.5))
    S.append((fp(*ST, head='fwd', armN=RDY_N, armF=RDY_F), 10))
    S.append((rub(0), 6))
    for dx in (1.5, -0.5, 1.5, -0.5):
        S.append((rub(dx), 4))
    S.append((fp(*ST, head='up', armN=adm, armF=LOW_F), 8))
    S.append((fp(*ST, head='up', armN=adm, armF=LOW_F, fx=[('star', ('armN', 'muzzle', -2, 2))]), 5))
    S.append((fp(*ST, head='up', armN=adm, armF=LOW_F, fx=[('star', ('armN', 'muzzle', -4, 4))]), 5))
    S.append((fp(*ST, head='smug', armN=adm, armF=LOW_F), 14))
    S.append((fp(*ST, head='fwd', armN=RDY_N, armF=RDY_F), 8))
    return S


def _fists_to_guns(seq):
    """Mount, Swan hop, somersault: he keeps both pistols in his hands (a fist becomes a pistol;
    hands down / on the shins hold it pointing forward-down, hands forward hold it level)."""
    out = []
    for p, t in seq:
        q = dict(p)
        for key, suf in (('armN', ''), ('armF', 'F')):
            a = q.get(key)
            if not a or a.get('end', ('', ''))[0] != 'fist':
                continue
            hx, hy = a['hand']
            aim = 'up' if a['end'][1] == 'fistup' else ('low' if hy > 5 or hx < 0 else 'fwd')
            q = give(q, key, aim + suf)
            if suf and aim == 'fwd':          # the far pistol a little higher: two guns, not one blob
                q = give(q, key, aim + suf, hand_=(hx + 1, hy - 3))
        out.append((q, t))
    return out


def yawn_fix(seq):
    S = [list(x) for x in seq]
    S[0][0] = setarm(S[0][0], 'armF', fg((7, 6), 'low'))
    S[1][0] = setarm(S[1][0], 'armF', fg((-6, -7), 'up', bend=1))
    S[2][0] = setarm(S[2][0], 'armF', fg((-5, -8.5), 'up', bend=1))
    S[3][0] = give(S[3][0], 'armF', 'downF', hand_=(2, 9))
    S[4][0] = give(S[4][0], 'armF', 'downF', hand_=(3, 8.5))
    S[5][0] = give(S[5][0], 'armF', 'downF', hand_=(-1, 9))
    for k in (6, 7):
        S[k][0] = give(S[k][0], 'armF', 'lowF', hand_=(6, 5))
    return [tuple(x) for x in S]


def sleep_fix(seq):
    out = []
    for p, t in seq:
        h = p['armF']['hand']
        out.append((give(p, 'armF', 'lowF', hand_=(h[0], h[1] - 1)), t))
    return out


def burn_fix(seq):
    S = [list(x) for x in seq]
    S[0][0] = give(S[0][0], 'armF', 'backF')
    S[1][0] = give(S[1][0], 'armF', 'backF')
    S[2][0] = give(S[2][0], 'armF', 'upF', hand_=(-6, -8))
    for k in (3, 4, 5, 6):
        S[k][0] = give(S[k][0], 'armF', 'downF')
    for k in (7, 8):
        q = dict(S[k][0])
        q['items'] = list(q.get('items', [])) + [('pistolF', (22, -3), 19)]
        S[k][0] = q
    return [tuple(x) for x in S]


def blast_fix(seq):
    import ext_moves as EM
    S = [list(x) for x in seq]
    S[0][0] = give(S[0][0], 'armF', 'backF')
    path = EM.BLAST_PATH
    # the far pistol flies a lower, shorter arc and lands behind the first one
    far = [None, (-6, -30), (-9, -40), (-12, -43), (-14, -38), (-15, -27), (-16, -12), (-16, -2), (-16, -2), (-16, -2)]
    for k in range(1, len(S)):
        if far[k] is None:
            continue
        ox, oy = path[k]
        q = dict(S[k][0])
        q['items'] = list(q.get('items') or []) + [('pistolF', (far[k][0] - ox, far[k][1] - oy), 19)]
        S[k][0] = q
    return [tuple(x) for x in S]


def drown_fix(seq):
    """He goes down flailing with both pistols and keeps the near one up out of the water to the end."""
    S = [list(x) for x in seq]
    for k in range(4):
        p = S[k][0]
        S[k][0] = give(give(p, 'armN', 'dup', sh=(1.5, -0.5)), 'armF', 'backF' if p['armF']['hand'][1] > -4 else 'upF')
    for k in range(4, len(S)):
        p = S[k][0]
        h = p['armN']['hand']
        S[k][0] = give(give(p, 'armN', 'up', hand_=(h[0] - 1, h[1] + 1)), 'armF', 'lowF')
    return [tuple(x) for x in S]


def flat_fix(seq):
    out = []
    for p, t in seq:
        if p['armF']['end'] == ('fist', 'fist'):
            p = setarm(p, 'armF', fg(TA.FB))
        else:
            p = give(give(p, 'armN', 'fwd'), 'armF', 'backF')
        out.append((p, t))
    return out


def cheer_fix(seq):
    """The ride cheer: the near fist pumps a pistol instead (the far hand stays on the grip)."""
    out = []
    for p, t in seq:
        a = dict(p['armN'])
        a['end'] = ('gun', 'up')
        a['hand'] = (a['hand'][0] + 3, a['hand'][1] + 0.5)
        out.append((setarm(p, 'armN', a), t))
    return out


def ears_set():
    """The honk: palms over his ears. THOM's ear sits at the back of his head (2 px behind and
    1 px higher than the generic spot), so the hands go there, not over his cheek."""
    import ext_ride as ER
    out = []
    for head, t in (('blink', 6), ('panic', 6)):
        tor = (0, 1)
        shN, shF, neck = ER._shoulders('up', tor)
        ear = (neck[0] - 2, neck[1] - 5)
        near = dict(hand=ER._to(ear, shN, 'ear'), end=('hand', 'ear'), bend=1, z=6.5)
        far = dict(hand=ER._to((ear[0] - 3, ear[1] - 1), shF, 'ear'), end=('hand', 'ear'), bend=1, z=4.5)
        out.append((ER.rider('up', head, tor, near=near, far=far, cape=('settle', 0)), t))
    return out


def after_ext():
    import ext_moves as EM
    fp = EM.fp
    F = A.FULL
    F['victory'] = victory_set(fp)
    F['spawn'] = spawn_set(fp)
    F['bored'] = bored_set(fp)
    F['fidgetb'] = fidgetb_set(fp)
    F['yawn'] = yawn_fix(F['yawn'])
    F['sleep'] = sleep_fix(F['sleep'])
    for k in ('mount', 'mounthop', 'flip'):
        F[k] = _fists_to_guns(F[k])
    F['death_burn'] = burn_fix(F['death_burn'])
    F['death_blast'] = blast_fix(F['death_blast'])
    F['death_drown'] = drown_fix(F['death_drown'])
    F['death_flat'] = flat_fix(F['death_flat'])
    A.UPPER['ride_cheer'] = cheer_fix(A.UPPER['ride_cheer'])
    A.UPPER['ride_ears'] = ears_set()
    U = A.UPPER
    heavy_parts()
    U['h_slash'], U['h_stab'], U['h_crouchslash'] = heavy_melee()
    U['crouchgrenade'] = [(_pitems(p), t) for p, t in U['crouchgrenade']]
    U['diagup'], U['shootdiagup'] = diagup_sets()


# ---------------------------------------------------------------- Helium Head: THOM's balloon
# The generic balloon inflates the backwards brim into the back of the balloon (the cap fills it)
# and turns the cap patch + the glint into a stair-step. Here: the balloon is made from the head
# WITHOUT the brim and patch, the dark jaw line is softened, then a clean patch and a short brim
# that sticks out behind at the band are drawn on by hand.
CAP = set('UCE')


def _balloon(name):
    import ext_ride_helium as HE
    rows, an = P.HEADS[name]
    nx, ny = an['neck']
    band = max(y for y, r in enumerate(rows) if r.count('E') >= 6)          # the cap band row
    g = [list(r) for r in rows]
    for y, r in enumerate(g):
        for x, ch in enumerate(r):
            if ch in CAP and (x < 3 or (y > band and x <= 3)):
                g[y][x] = '.' if x < 3 else 'H'                             # no brim: hair behind
            elif ch == 'w' and y < band:
                g[y][x] = 'C'                                               # no patch
            elif ch == 'Q' and y > band + 3 and x <= 7:
                g[y][x] = 'z'                                               # the jaw: no beard
    rb, ab = HE.balloon(([''.join(r) for r in g], dict(an)))
    out = [list(r) for r in rb]
    bx, by = ab['neck']
    to = lambda sx, sy: (int(round(bx + 2 * (sx - nx))), int(round(by + 2 * (sy - ny) - 0.5)))
    H, W = len(out), len(out[0])
    yb = to(0, band)[1]
    for y in range(min(H, yb)):                                             # drop the sphere glint
        for x in range(W):
            if out[y][x] == 'w':
                out[y][x] = 'C'
    # the patch: a small plain 3 x 2 plate on the cap
    px, py = to(12.5, band - 1.5)
    for dx, dy in ((-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1)):
        X, Y = px + dx, py + dy
        if 0 <= Y < H and 0 <= X < W and out[Y][X] in CAP:
            out[Y][X] = 'w'
    # the brim: sticks out behind the balloon at the band, lit on top, dark below
    xl = min(x for x in range(W) if out[yb][x] != '.')
    pad = 5
    out = [['.'] * pad + r for r in out]
    for x in range(0, xl + pad + 2):
        out[yb][x] = 'E' if x > 1 else 'U'
        out[yb + 1][x] = 'U'
    out[yb][0] = '.'
    rows2 = [''.join(r) for r in out]
    return rows2, {'neck': (bx + pad, by)}


def after_derive():
    for name in [k for k in list(P.HEADS) if not k.startswith('he_')]:
        P.HEADS['he_' + name] = _balloon(name)
    # shooting up with the balloon head: the far pistol can not clear the big balloon behind the
    # head, so it comes forward next to the near one (lower, so the two barrels read apart)
    for key in ('he_aimup', 'he_shootup'):
        out = []
        for p, t in A.UPPER.get(key, []):
            a = p.get('armF')
            if a and a.get('end') == ('gun', 'upF'):
                a = dict(a)
                so = a.get('sh', (0, 0))
                a['sh'] = (so[0] + 3, so[1] + 1.5)
                a['hand'] = (a['hand'][0] + 7, a['hand'][1] + 4.5)
                a['z'] = 5.5                  # in front of the balloon, behind the near arm
                p = dict(p, armF=a)
            out.append((p, t))
        A.UPPER[key] = out
