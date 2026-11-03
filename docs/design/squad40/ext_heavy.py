# Extension set: the heavy machine gun (a torso set with the 45-degree sweep), the pistol diagonals and
# the crouched throw and melee (pistol and heavy). All keys are UPPER sprites that pair with the core legs.
#
# Built from the hero's CURRENT tables wherever possible (this module runs in every hero's process,
# after the hero module): the diagonal pistol sets are the hero's own 'shoot' set with the gun arms
# turned; the throw and melee sets are the hero's own 'grenade' / 'slash' / 'stab' with the near hand
# swapped to the heavy gun; the cape / pattern tags of a hero ride along in the pose dicts.
#
# Parts: the heavy gun per angle (ext_heavy_guns.py, gun ramp G g n N only, the hand letters are mapped
# to the hero's own hand colours), heavy muzzle flashes per angle, diagonal pistol flashes, a shell
# casing; one torso 'hback' (the hero's own 'up' torso, sheared 1 px back: the lean against the recoil).
import math
import anims as A
import parts as P
import pose
import rig
import ext
from ext_heavy_guns import GUNS as HGUNS

# ------------------------------------------------------------------ parts
# VINCENT's pistol 'fwd' as drawn in parts.py: comparing a hero's 'fwd' with it gives the hero's
# hand / cuff letters (THOM's cuff is 'j', BOB wears gloves, DIRK's cuff is 'R' ...)
_V_FWD = [
  "..ngGGGGGGg.",
  "TSSngnnnnnnN",
  "TSSSNNnN....",
  ".sssNN......",
]


def _hand_map():
    rows = P.GUNS.get('fwd', (None,))[0]
    m = {}
    if rows and len(rows) == len(_V_FWD):
        for a, b in zip(_V_FWD, rows):
            for ca, cb in zip(a, b):
                if ca in 'TSsL' and cb not in '.' and ca not in m:
                    m[ca] = cb
    return str.maketrans({k: v for k, v in m.items() if k != v})


def _rot_fx(rows, an, deg):
    """Turn an effect grid around its anchor with RotSprite (positive = counter-clockwise), crop."""
    pad = max(len(rows), max(len(r) for r in rows)) + 2
    w = max(len(r) for r in rows) + 2 * pad
    g = ['.' * w] * pad + [('.' * pad + r).ljust(w, '.') for r in rows] + ['.' * w] * pad
    out = rig.rotsprite(g, (an[0] + pad, an[1] + pad), deg)
    ys = [y for y, r in enumerate(out) if r.strip('.')]
    xs = [x for r in out for x, ch in enumerate(r) if ch != '.']
    x0, y0 = min(xs), min(ys)
    return [r[x0:max(xs) + 1] for r in out[y0:max(ys) + 1]], (an[0] + pad - x0, an[1] + pad - y0)


def _flip_v(rows, an):
    return rows[::-1], (an[0], len(rows) - 1 - an[1])


def _transpose(rows, an):
    w = max(len(r) for r in rows)
    rr = [r.ljust(w, '.') for r in rows]
    return [''.join(rr[y][x] for y in range(len(rr))) for x in range(w)], (an[1], an[0])


# heavy muzzle flashes, forward (anchor = the base at the muzzle); two big shapes alternate
HF0 = (["....c.........",
        "..c.fc..c.....",
        ".cfFFfcfFc....",
        "fFWWWFFfFfcc..",
        "FWWWWWWWFFFfcc",
        "fFWWWFFfFfcc..",
        ".cfFFfcfFc....",
        "..c.fc..c.....",
        "....c........."], (0, 4))
HF1 = (["..c.........",
        ".cfc...c....",
        "cFWFfcfFc...",
        "FWWWWWFFFFfc",
        "cFWFfcfFc...",
        ".cfc...c....",
        "..c........."], (0, 3))
HSM = ([".dD.", "dDDd", ".dd."], (0, 1))
SHELL = (["y", "c"], (0, 0))
SHELL2 = (["yc"], (0, 0))


def _heavy_fx():
    fx = {}
    for nm, base in (('h0', HF0), ('h1', HF1)):
        fx['hf' + nm[1]] = base
        fx['hq' + nm[1]] = _rot_fx(base[0], base[1], 45)          # diagonal up
        fx['hu' + nm[1]] = _flip_v(*_transpose(*base))            # up
        fx['he' + nm[1]] = _rot_fx(base[0], base[1], -45)         # diagonal down
        # down: a shorter flame (the muzzle is close to the bottom of the sprite canvas)
        fx['hd' + nm[1]] = _transpose(*(([r[:10] for r in HF1[0]], HF1[1]) if nm == 'h0' else P.FX['ff0']))
    fx['hsm'] = HSM
    fx['hshell'] = SHELL
    fx['hshell2'] = SHELL2
    # the pistol's diagonal flashes (from the core flash shapes of parts.FX)
    for src, up_, dn in (('ff0', 'fq0', 'fe0'), ('ff1', 'fq1', 'fe1'), ('ff2', 'fq2', 'fe2')):
        rows, an = P.FX[src]
        fx[up_] = _rot_fx(rows, an, 45)
        fx[dn] = _rot_fx(rows, an, -45)
    return fx


def PARTS():
    m = _hand_map()
    for k, (rows, an) in HGUNS.items():
        ext.add(P.GUNS, k, ([r.translate(m) for r in rows], dict(an)))
    for k, v in _heavy_fx().items():
        ext.add(P.FX, k, v)
    ext.add(P.TORSOS, 'hback', P.shear(P.TORSOS['up'], -1))


# ------------------------------------------------------------------ pose helpers
STD = {'torso', 'head', 'tor', 'hd', 'armN', 'armF', 'fx', 'items', 'pelvis', 'rot'}


def extra(src):
    """The hero's own tags of a pose (BOB's cape mode ...), to carry into a derived pose."""
    return {k: v for k, v in (src or {}).items() if k not in STD}


def tagged(p, src):
    p.update(extra(src))
    return p


def torso_pts(torso, tor=(0, 0)):
    """The torso anchors relative to the pelvis, rounded exactly as pose.place() does."""
    rows, an = P.TORSOS[torso]
    pel = (rig.RX, rig.RY - 17 + pose.PEL_DY)
    ax, ay = an['pelvis']
    x0, y0 = int(round(pel[0] + tor[0] - ax)), int(round(pel[1] + tor[1] - ay))
    return {k: (x0 + v[0] - pel[0], y0 + v[1] - pel[1]) for k, v in an.items()}


def gun_pt(aim, wrist, name):
    """Where a gun part's anchor lands when its wrist sits on 'wrist' (pelvis-relative)."""
    rows, an = P.GUNS[aim]
    ax, ay = an['wrist']
    pel = (rig.RX, rig.RY - 17 + pose.PEL_DY)
    x0, y0 = int(round(pel[0] + wrist[0] - ax)), int(round(pel[1] + wrist[1] - ay))
    gx, gy = an[name]
    return (x0 + gx - pel[0], y0 + gy - pel[1])


WARN = []


def hv(aim='h_fwd', w=(5, -1.5), torso='hback', tor=(0, 0), head='fwd', hd=(0, 0), sN=(0, 0), sF=(7, 2),
       fx=None, nb=-1, fb=-1, far='grip', src=None):
    """A heavy-gun pose: the near hand on the rear grip with its wrist at w (pelvis-relative), the far
    hand under the fore-grip (far='grip'), or a given far arm dict."""
    T = torso_pts(torso, tor)
    shn = (T['shN'][0] + sN[0], T['shN'][1] + sN[1])
    near = dict(hand=(w[0] - shn[0], w[1] - shn[1]), end=('gun', aim), bend=nb, sh=sN)
    p = A.up(torso=torso, head=head, tor=tor, hd=hd, near=near)
    if far == 'grip':
        g = gun_pt(aim, w, 'grip')
        shf = (T['shF'][0] + sF[0], T['shF'][1] + sF[1])
        reach = pose.UPPER + pose.FORE - 0.1
        d = math.hypot(g[0] - shf[0], g[1] - shf[1])
        if d > reach:                 # out of reach (a short-armed hero, a steep aim): the far hand
            for k in range(1, 21):    # slides back along the gun towards the near hand
                q = (g[0] + (w[0] - g[0]) * k / 20, g[1] + (w[1] - g[1]) * k / 20)
                if math.hypot(q[0] - shf[0], q[1] - shf[1]) <= reach:
                    break
            WARN.append((aim, w, round(d, 2), round(math.hypot(g[0] - q[0], g[1] - q[1]), 1)))
            g = q
        p['armF'] = dict(hand=(g[0] - shf[0], g[1] - shf[1]), end=('fist', 'fist'), bend=fb, sh=sF)
    elif far:
        p['armF'] = far
    if fx:
        p['fx'] = fx
    return tagged(p, src)


MZ = ('armN', 'muzzle', 0, 0)
EJ = ('armN', 'eject', 0, 0)


def U(key, i=0):
    seq = A.UPPER.get(key) or [({}, 4)]
    return seq[min(i, len(seq) - 1)][0]


# ------------------------------------------------------------------ the heavy stance
W0 = (4, -0.5)          # near wrist (rear grip), pelvis-relative: hip height, the gun level
WC = (5, -0.5)          # crouched (torso lean2)


def h_idle():
    out = []
    for k in range(4):
        by = [0, 0, 1, 1][k]
        hy = [0, 1, 1, 0][k]
        out.append((hv(w=(W0[0], W0[1] + by), tor=(0, by), hd=(0, hy - by), src=U('idle', k)), 9))
    return out


def h_run(n=12):
    out = []
    for i in range(n):
        ph = i / n
        sway = round(0.7 * math.sin(4 * math.pi * ph))
        hd = (0, 1 if (i % 6) in (1, 2) else 0)
        out.append((hv(w=(W0[0] + 1, W0[1] + sway), torso='lean', hd=hd, src=U('run', i)), 3))
    return out


def h_jump():
    tor = ['lean', 'up', 'up', 'up', 'up', 'lean']
    dy = [1, -1, -1, 0, 0, 1]
    ts = [3, 4, 6, 8, 6, 5]
    return [(hv(w=(W0[0] + (1 if tor[k] == 'lean' else 0), W0[1] + dy[k]), torso=tor[k], src=U('jump', k)), ts[k])
            for k in range(6)]


def h_crouchidle():
    return [(hv(w=(WC[0], WC[1] + k // 2), torso='lean2', tor=(0, k // 2), hd=(1, [0, 1, 0, 0][k]),
                src=U('crouchidle', k)), 9) for k in range(4)]


def fire_loop(aim, w, kick, fl, torso='hback', head='shout', hd=(0, 0), tor=(0, 0), sN=(0, 0), sF=(7, 2),
              src='shoot', smoke=True):
    """Continuous fire, 4 frames x 2 ticks: big flash + recoil on frames 0 and 2 (two shapes), the gun
    settles and a shell flies on frames 1 and 3."""
    out = []
    for k in range(4):
        r = 1 if k in (0, 2) else 0
        ww = (w[0] + kick[0] * r, w[1] + kick[1] * r)
        if k in (0, 2):
            fx = [(fl + ('0' if k == 0 else '1'), MZ)]
        else:
            fx = [('hshell' if k == 1 else 'hshell2', ('armN', 'eject', -1 - k // 2, -1 - k // 2))]
        out.append((hv(aim, ww, torso=torso, tor=tor, head=head, hd=hd, sN=sN, sF=sF, fx=fx,
                       src=U(src, k)), 2))
    return out


# the sweep: forward -> 22.5 -> 45 -> 67.5 -> up (wrist, near and far shoulder shifts, head)
SWEEP = [('h_fwd', W0, (0, 0), (7, 2), 'fwd'),
         ('h_u22', (5, -2), (0.5, -0.5), (4.5, 1), 'fwd'),
         ('h_u45', (7.5, -3.5), (1.5, -1), (6.5, 0.5), 'up'),
         ('h_u67', (11, -4.5), (3, -1), (8.5, 0), 'up'),
         ('h_up', (14, -5), (4.5, -1), (8.5, -0.5), 'up')]
DOWN = [('h_fwd', (W0[0] + 1, W0[1]), (0, 0), (7, 2), 'fwd'),
        ('h_d45', (3, -2), (0, 0), (5, 3), 'down'),
        ('h_down', (3, -5), (0, 0), (5, 1), 'down')]


def sweep_pose(s, src, head=None, fx=None, torso='hback', kick=(0, 0)):
    aim, w, sn, sf, hdn = s
    return hv(aim, (w[0] + kick[0], w[1] + kick[1]), torso=torso, head=head or hdn, sN=sn, sF=sf, fx=fx, src=src)


def h_aimup():
    return [(sweep_pose(s, U('aimup', min(k, 1))), 2) for k, s in enumerate(SWEEP)]


def h_aimdown():
    return [(sweep_pose(s, U('aimdown', min(k, 1)), torso='lean'), 2) for k, s in enumerate(DOWN)]


def sweep_fire(s, fl, kick, torso='hback', src='shootup'):
    aim, w, sn, sf, hdn = s
    return fire_loop(aim, w, kick, fl, torso=torso, head='shout' if hdn == 'fwd' else hdn, sN=sn, sF=sf, src=src)


# ------------------------------------------------------------------ pistol diagonals (from the hero's own shoot set)
def _rot(v, deg):
    a = math.radians(deg)
    return (v[0] * math.cos(a) - v[1] * math.sin(a), v[0] * math.sin(a) + v[1] * math.cos(a))


FLASH_UP = {'ff0': 'fq0', 'ff1': 'fq1', 'ff2': 'fq2'}
FLASH_DN = {'ff0': 'fe0', 'ff1': 'fe1', 'ff2': 'fe2'}


def turn_pose(p, up_, frac=1.0):
    """The hero's forward pistol pose turned to the diagonal: every arm with a forward pistol gets the
    diagonal pistol and its hand target turned around the shoulder; a support hand follows a little."""
    q = dict(p)
    gdeg, sdeg = (-47, -22) if up_ else (18, 8)
    for key in ('armN', 'armF'):
        a = p.get(key)
        if not a:
            continue
        a = dict(a)
        end = a.get('end')
        if end and end[0] == 'gun' and end[1] in ('fwd', 'fwdF'):
            suf = end[1][3:]
            tgt = ('dup' if up_ else 'ddown') + suf
            if frac >= 0.75 and tgt in P.GUNS:
                a['end'] = ('gun', tgt)
            a['hand'] = _rot(a['hand'], gdeg * frac)
            if up_:
                so = a.get('sh', (0, 0))
                a['sh'] = (so[0] + 1.5 * frac, so[1] - 0.5 * frac)
        else:
            a['hand'] = _rot(a['hand'], sdeg * frac)
        q[key] = a
    if not up_:
        q['torso'] = 'lean' if q.get('torso', 'up') == 'up' else q.get('torso')
        q['head'] = 'down'
    fmap = FLASH_UP if up_ else FLASH_DN
    if p.get('fx'):
        q['fx'] = [(fmap.get(n, n), at) for n, at in p['fx']]
    return q


def diag_sets():
    shoot = A.UPPER['shoot']
    ready = shoot[-1][0]
    out = {}
    out['diagup'] = [(turn_pose(ready, True, 0.5), 2), (turn_pose(ready, True, 1.0), 2)]
    out['shootdiagup'] = [(turn_pose(p, True), t) for p, t in shoot]
    out['diagdown'] = [(turn_pose(ready, False, 0.5), 2), (turn_pose(ready, False, 1.0), 2)]
    out['shootdiagdown'] = [(turn_pose(p, False), t) for p, t in shoot]
    return out


# ------------------------------------------------------------------ throw and melee (from the hero's own sets)
CROUCH_TORSO = {'back': 'up', 'up': 'lean', 'lean': 'lean2', 'lean2': 'lean2', 'hback': 'lean'}


def _is_ready(p):
    """The recovery frame of a core throw / melee set: the near hand on a forward pistol, no effect."""
    a = p.get('armN') or {}
    return a.get('end') == ('gun', 'fwd') and not p.get('fx')


def _melee_arm(seq):
    """'armF' when the near hand only holds a low gun (the far hand does the melee), else 'armN'."""
    lows = [p for p, _ in seq if not _is_ready(p)]
    if all((p.get('armN') or {}).get('end', ('', ''))[1].startswith('low') for p in lows):
        return 'armF'
    return 'armN'


def _pel_fx(p):
    """Root-relative effect points -> pelvis-relative (torso anchor), so they move with a crouch."""
    out = []
    to = p.get('tor', (0, 0))
    for n, at in p.get('fx', []):
        if not isinstance(at[0], str):
            ta = torso_pts(p.get('torso', 'up'), to)['pelvis']
            at = ('torso', 'pelvis', at[0] - ta[0], at[1] + 17 - pose.PEL_DY - ta[1])
        out.append((n, at))
    return out


def crouched(p):
    q = dict(p)
    t = q.get('torso', 'up')
    q['torso'] = CROUCH_TORSO.get(t, t)
    hd = q.get('hd', (0, 0))
    if q['torso'] == 'lean2':
        q['hd'] = (hd[0] + 1, hd[1])
    if p.get('fx'):
        q['fx'] = _pel_fx(p)
    return q


HLOW = (3.5, 6.5)     # the near hand from the near shoulder, the heavy gun hanging at the hip


def heavy_swap(seq, crouch=False, ready=None):
    """The hero's throw / melee set with the heavy gun: the hand that only held a low pistol now holds
    the heavy gun low at the hip; the recovery frame becomes the heavy ready pose."""
    arm = _melee_arm(seq)
    other = 'armN' if arm == 'armF' else 'armF'
    out = []
    for p, t in seq:
        if _is_ready(p):
            out.append((dict(ready or U('h_idle'), **extra(p)), t))
            continue
        q = dict(p)
        if q.get('fx'):
            q['fx'] = _pel_fx(q)
        q['items'] = [it for it in p.get('items', []) if it[0].startswith('gren')]
        if not q['items']:
            q.pop('items')
        a = dict(q.get(other) or {})
        a.update(hand=HLOW, end=('gun', 'h_low'), bend=-1)
        a.pop('sh', None)
        if other == 'armF':
            a['z'] = 3.5          # the melee pistol is in the near hand: the heavy gun hangs in front of the hip
        q[other] = a
        if crouch:
            q = crouched(q)
        out.append((q, t))
    return out


def crouch_set(seq, ready):
    return [((dict(ready, **extra(p)) if _is_ready(p) else crouched(p)), t) for p, t in seq]


# ------------------------------------------------------------------ BUILD
def BUILD():
    add = lambda k, v: ext.add(A.UPPER, k, v)
    for k, v in diag_sets().items():
        add(k, v)
    add('crouchgrenade', crouch_set(A.UPPER['grenade'], U('crouchidle')))
    add('crouchslash', crouch_set(A.UPPER['slash'], U('crouchidle')))

    add('h_idle', h_idle())
    add('h_run', h_run())
    add('h_jump', h_jump())
    add('h_crouchidle', h_crouchidle())
    add('h_shoot', fire_loop('h_fwd', W0, (-1, 0), 'hf'))
    add('h_crouchshoot', fire_loop('h_fwd', WC, (-1, 0), 'hf', torso='lean2', hd=(1, 0), src='crouchshoot'))
    add('h_aimup', h_aimup())
    add('h_diagup', [(sweep_pose(SWEEP[2], U('aimup', 1)), 4)])
    add('h_shootdiagup', sweep_fire(SWEEP[2], 'hq', (-0.7, 0.7)))
    add('h_shootup', sweep_fire(SWEEP[4], 'hu', (0, 1)))
    add('h_aimdown', h_aimdown())
    add('h_diagdown', [(sweep_pose(DOWN[1], U('aimdown', 0), torso='lean'), 4)])
    add('h_shootdiagdown', sweep_fire(DOWN[1], 'he', (-0.7, -0.7), torso='lean', src='shootdown'))
    add('h_shootdown', sweep_fire(DOWN[2], 'hd', (0, -1), torso='lean', src='shootdown'))
    hi = U('h_idle')
    add('h_grenade', heavy_swap(A.UPPER['grenade'], ready=hi))
    add('h_slash', heavy_swap(A.UPPER['slash'], ready=hi))
    add('h_stab', heavy_swap(A.UPPER['stab'], ready=hi))
    hc = U('h_crouchidle')
    add('h_crouchgrenade', heavy_swap(A.UPPER['grenade'], crouch=True, ready=hc))
    add('h_crouchslash', heavy_swap(A.UPPER['slash'], crouch=True, ready=hc))

    A.SHOT_FX.update({'fq0', 'fe0', 'hf0', 'hf1', 'hq0', 'hq1', 'hu0', 'hu1', 'he0', 'he1', 'hd0', 'hd1'})
    A.SHOT_DIR.update({'fq0': -45, 'fe0': 45, 'hf0': 0, 'hf1': 0, 'hq0': -45, 'hq1': -45,
                       'hu0': -90, 'hu1': -90, 'he0': 45, 'he1': 45, 'hd0': 90, 'hd1': 90})


# ------------------------------------------------------------------ GROUPS
def GROUPS():
    Up, Lo = A.UPPER, A.LOWER

    def s(u, ui, l=None, li=0, t=None):
        return {'u': [u, ui], 'l': [l, li] if l else None, 't': t if t is not None else Up[u][ui][1]}

    def run(u, l=None, li=0, loops=1, rev=False):
        idx = list(range(len(Up[u])))
        if rev:
            idx = idx[::-1]
        return [s(u, i, l, li) for _ in range(loops) for i in idx]

    stand = lambda u, **k: run(u, 'stand', **k)
    G = []
    P_, H_ = 'Pistol extras', 'Heavy weapon'
    G.append((P_, 'Shoot diagonal', '2 + 10', stand('diagup') + stand('shootdiagup') + stand('diagup', rev=True) +
              run('diagdown', 'jump', 3) + run('shootdiagdown', 'jump', 3) + run('diagdown', 'jump', 3, rev=True)))
    G.append((P_, 'Crouch throw', 6, run('crouchgrenade', 'crouch')))
    G.append((P_, 'Crouch melee', 6, run('crouchslash', 'crouch')))

    G.append((H_, 'Heavy idle', 4, stand('h_idle')))
    nr, nl = len(Up['h_run']), len(Lo['run'])
    G.append((H_, 'Heavy run', '12 + 12', [s('h_run', k % nr, 'run', k % nl) for k in range(max(nr, nl))]))
    nj = len(Up['h_jump'])
    G.append((H_, 'Heavy jump', 6, [s('h_jump', k % nj, 'jump', k, Lo['jump'][k][1]) for k in range(len(Lo['jump']))] +
              [s('h_idle', 0, 'stand', 0, 12)] +
              [s('h_jump', k % nj, 'jumprun', k, Lo['jumprun'][k][1]) for k in range(len(Lo['jumprun']))] +
              [s('h_idle', 0, 'stand', 0, 12)]))
    nc, nw = len(Up['h_crouchidle']), len(Lo['crawl'])
    G.append((H_, 'Heavy crouch', '4 / 7', run('h_crouchidle', 'crouch') +
              [s('h_crouchidle', k % nc, 'crawl', k % nw, Lo['crawl'][k % nw][1]) for k in range(2 * nw)]))
    G.append((H_, 'Heavy shoot forward', '4 (loop)', stand('h_shoot', loops=3)))
    G.append((H_, 'Heavy sweep up', '5 / 1 / 4 / 4',
              [s('h_aimup', k, 'stand') for k in range(3)] + stand('h_diagup') + stand('h_shootdiagup', loops=2) +
              [s('h_aimup', k, 'stand') for k in range(3, 5)] + stand('h_shootup', loops=2) +
              stand('h_aimup', rev=True)))
    G.append((H_, 'Heavy shoot down', '3 / 1 / 4 / 4',
              [s('h_aimdown', k, 'jump', 3) for k in range(2)] + run('h_diagdown', 'jump', 3) +
              run('h_shootdiagdown', 'jump', 3, loops=2) + [s('h_aimdown', 2, 'jump', 3)] +
              run('h_shootdown', 'jump', 3, loops=2)))
    G.append((H_, 'Heavy crouch shoot', '4 (loop)', run('h_crouchshoot', 'crouch', loops=3)))
    G.append((H_, 'Heavy throw', '6 + 6', stand('h_grenade') + run('h_crouchgrenade', 'crouch')))
    G.append((H_, 'Heavy melee', '6 + 6 + 6', stand('h_slash') + stand('h_stab') + run('h_crouchslash', 'crouch')))
    return [{'cat': c, 'title': t, 'ref': str(r), 'steps': st} for c, t, r, st in G]
