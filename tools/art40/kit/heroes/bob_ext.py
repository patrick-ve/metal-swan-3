# BOB in the extension families: his own new faces, his own cape in every new pose (cape modes in
# heroes/bob_cape.py), his own victory, bored and second fidget, and the balloon-head touch-up.
# bob.py imports this module at the end and hands over after_ext() / after_derive().
import math
import parts as P
import anims as A
import ext

NK = {'neck': (5, 13)}


def _edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            out[y][x + i] = ch
    return [''.join(r) for r in out]


# ---------------------------------------------------------------- heads (on the approved 'fwd')
#   0  ......hAA.A...      brow row 7 (x10-11), eye row 8 (x10 white, x11 blue),
#   7  hhHHHHsSSSHHL.      nose x11 row 10, mouth rows 11-13 (x7-12)
#   8  QhhHszsSSSwUSL
#  11  ...bsSSzwwwwz.
#  12  ...bbSSszBBz..
#  13  ....zbbbbb....
def heads():
    base = P.HEADS['fwd'][0]
    H = {}
    # happy: brows up, the eye squeezed into an arc, the big grin opens (teeth and a dark mouth)
    H['happy'] = (_edit(base, [(6, 10, 'hh'), (7, 10, 'SS'), (8, 10, 'hSh'),
                               (11, 7, 'zwwwwz'), (12, 7, 'zQssQ'), (13, 5, 'bzBBzb')]), NK)
    # panic: brows jump up, the eye wide open, the mouth a tall dark 'O'
    H['panic'] = (_edit(base, [(6, 10, 'hh'), (7, 10, 'ww'), (8, 10, 'wU'),
                               (11, 7, 'SzQQz'), (12, 7, 'szQQz'), (13, 5, 'bbzzbb')]), NK)
    # yawn: eyes shut tight, the jaw drops (one row longer), the mouth a tall dark oval
    yb = base + ["." * 14]
    H['yawn'] = (_edit(yb, [(7, 10, 'Hh'), (8, 10, 'zz'),
                            (11, 7, 'SzBBz.'), (12, 6, 'bzQQQz'), (13, 5, 'bbzQsQz'), (14, 5, '.zbBBz')]),
                 {'neck': (5, 14)})
    # sleep: the lid line low, the mouth hangs a little open
    H['sleep'] = (_edit(base, [(7, 10, 'SS'), (8, 10, 'zz'), (11, 7, 'SSzBzS'), (12, 7, 'sSSzS')]), NK)
    # bored: a heavy lid over the eye, a flat line for a mouth
    H['bored'] = (_edit(base, [(7, 10, 'hh'), (8, 10, 'hU'), (11, 7, 'SSzzzz'), (12, 7, 'sSSSz')]), NK)
    # soot: the swept-up hair frazzled into spikes, the eye wide and white, the mouth agape
    # (the soot pass blackens every letter but the whites 'w')
    top = ["...h..A.hA....",
           "..hH.hAhAAh.A."]
    soot = top + _edit(base, [(6, 10, 'hh'), (7, 10, 'ww'), (8, 10, 'wQ'),
                              (11, 7, 'zQQQQz'), (12, 7, 'zwwwz'), (13, 5, 'bbzzbb')])
    H['soot'] = (soot, {'neck': (5, 15)})
    H['sootblink'] = (_edit(soot, [(9, 10, 'SS'), (10, 10, 'zz')]), {'neck': (5, 15)})
    H['smug'] = P.HEADS['grin']            # VINCENT's 'smug' face must never show on BOB
    return H


P.HEADS.update(heads())

# ---------------------------------------------------------------- hand items (gloves = hair ramp)
P.HANDS['phone'] = ([          # a phone held flat at the chest, the lit screen up toward his eyes
  "tUUU",
  "QQQQ",
  "AHH.",
  "AHh.",
  ".hh.",
], {'wrist': (0, 3)})
P.HANDS['phonelit'] = ([       # a message: the screen lights up
  "TTTU",
  "QQQQ",
  "AHH.",
  "AHh.",
  ".hh.",
], {'wrist': (0, 3)})
P.HANDS['cup'] = ([            # a reusable bamboo cup: white lid, pale wood, a green silicone band
  ".tTTt",
  ".AAAH",
  "HHJJj",
  "HhJJj",
  ".hAAH",
  "..AHH",
], {'wrist': (0, 2.5)})
P.HANDS['cupsip'] = ([         # the cup tipped up to the lips (the lid toward the mouth)
  "tAAA.",
  "TAJJH",
  "tAJJH",
  "HHHH.",
  "Ahh..",
], {'wrist': (0, 3.5)})
P.FISTS['thumb'] = ([          # thumbs-up (glove): the thumb stands on the fist
  ".A..",
  ".H..",
  ".HH.",
  "AHHH",
  "AHHh",
  ".hhh",
], {'wrist': (0, 4)})


# ---------------------------------------------------------------- poses
gun, hand = A.gun, A.hand
LOW = (6, 7)
ST = ((0, -17), (-5, -4), (5, -4))


def _cape(seq, fn):
    """Re-tag a pose list: fn(k, pose) -> the cape tuple (or None to keep the pose's own)."""
    out = []
    for k, (p, t) in enumerate(seq):
        c = fn(k, p)
        out.append((dict(p, cape=c) if c else p, t))
    return out


def victory_set(fp):
    """The flying-hero salute: a little crouch, a spring onto the toes with the near fist punched
    forward and up, the far fist on the hip, chin up, the cape billowing; he lands and holds it."""
    S = []
    sky = hand((9, -6.5), 'fistup', 'fist', bend=-1, sh=(3, -1.5), z=6.5)
    hip = hand((-0.5, 5.5), 'hip', 'fist', bend=1)
    chest = hand((8, 0), 'fist', 'fist', bend=-1, z=6.5)
    S.append((fp(*ST, head='proud', armN=chest, armF=hip, cape=('settle', 0)), 6))
    S.append((fp((0, -15), (-6, -4), (5, -4), head='happy', armN=hand((5, 3), 'fist', 'fist', z=6.5),
                 armF=hip, cape=('billow', 0.1)), 6))
    S.append((fp((0, -18), (-5, -2), (4, -2), 'toe', 'toe', torso='back', head='happy', armN=sky, armF=hip,
                 cape=('billow', 0.3)), 5))
    S.append((fp((0, -18), (-5, -4), (3, -6), 'hang', 'hang', torso='back', head='happy', armN=sky, armF=hip,
                 cape=('billow', 0.5)), 6))
    S.append((fp((0, -17), (-5, -3), (5, -4), 'toe', 'flat', torso='back', head='proud', armN=sky, armF=hip,
                 cape=('billow', 0.65)), 4))
    for k, ph in enumerate((0.8, 0.0, 0.25)):
        S.append((fp(*ST, torso='back', head='proud' if k != 1 else 'happy', armN=sky, armF=hip,
                     cape=('billow', ph)), 6))
    return S


def bored_set(fp):
    """The next flight: he checks his phone, nothing, the cape droops with his shoulders, a long
    sigh; the phone lights up: a new flight! a guilty grin and the cape lifts again."""
    S = []
    low = gun(LOW, 'low')
    ph = lambda h, kind='phone': hand(h, kind, 'hand', bend=-1, z=6.5)
    S.append((fp(*ST, head='fwd', armN=low, armF=hand((9, 5))), 12))
    S.append((fp(*ST, head='down', armN=low, armF=ph((7, 5))), 6))
    S.append((fp(*ST, head='read', armN=low, armF=ph((9, 2))), 16))
    S.append((fp(*ST, head='read2', armN=low, armF=ph((9, 2)), cape=('droop', 0)), 12))
    S.append((fp(*ST, head='bored', tor=(0, 1), armN=low, armF=ph((9, 3)), cape=('droop', 1)), 10))
    S.append((fp(*ST, head='sleep', tor=(0, 1), hd=(0, 1), armN=low, armF=ph((8, 4)), cape=('droop', 2)), 16))
    S.append((fp(*ST, head='bored', tor=(0, 1), armN=low, armF=ph((8, 4)), cape=('droop', 1)), 8))
    ding = [('star', ('armF', 'wrist', 3, -5))]
    S.append((fp(*ST, head='read', armN=low, armF=ph((9, 2), 'phonelit'), fx=ding, cape=('settle', 0)), 6))
    S.append((fp(*ST, head='grin', armN=low, armF=ph((9, 1), 'phonelit'), cape=('billow', 0.0)), 8))
    S.append((fp(*ST, head='grin', armN=low, armF=ph((9, 1), 'phonelit'), cape=('billow', 0.3)), 8))
    S.append((fp(*ST, head='proud', armN=low, armF=ph((7, 5)), cape=('billow', 0.6)), 6))
    S.append((fp(*ST, head='blink', armN=gun((8, 4)), armF=hand((9, 5)), cape=('settle', 0)), 6))
    return S


def fidgetb_set(fp):
    """Green credentials: the pistol goes in the belt, a slow sip from the reusable bamboo cup,
    'aah', a thumbs-up to the camera, the pistol comes back out."""
    S = []
    hip = hand((-0.5, 5.5), 'hip', 'fist', bend=1)
    cup = lambda h, kind='cup': hand(h, kind, 'hand', bend=-1, z=6.5)
    thumb = lambda h: hand(h, 'thumb', 'fist', bend=-1, z=7)
    side = hand((1, 9), 'cup', 'hand', bend=1)          # the cup lowered at his side, behind the body
    S.append((fp(*ST, head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 10))
    S.append((fp(*ST, head='down', armN=hip, armF=cup((9, 3))), 8))
    S.append((fp(*ST, head='up', armN=hip, armF=cup((6, -1), 'cupsip')), 14))
    S.append((fp(*ST, head='blink', hd=(0, -1), armN=hip, armF=cup((6, -2), 'cupsip')), 12))
    S.append((fp(*ST, head='happy', armN=hip, armF=cup((9, 3))), 10))
    S.append((fp(*ST, head='grin', armN=thumb((9, 3)), armF=side, cape=('settle', 0)), 4))
    S.append((fp(*ST, head='happy', armN=thumb((10, 1)), armF=side, cape=('billow', 0.2)), 6))
    S.append((fp(*ST, head='grin', armN=thumb((10, 1)), armF=side, cape=('billow', 0.45)), 14))
    S.append((fp(*ST, head='fwd', armN=hip, armF=side, cape=('settle', 0)), 6))
    S.append((fp(*ST, head='blink', armN=gun((8, 4)), armF=hand((9, 5))), 6))
    S.append((fp(*ST, head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 10))
    return S


DROWN_DEPTH = [11, 8, 9, 10, 15, 22, 35, 37]   # ext_moves' drown page: feet below the surface per frame
CROUCH_KEYS = ('crouchgrenade', 'crouchslash', 'h_crouchidle', 'h_crouchgrenade', 'h_crouchslash')


def after_ext():
    import ext_moves as M
    U, F = A.UPPER, A.FULL
    fp = M.fp
    # ---- full body: his own
    F['victory'] = victory_set(fp)
    F['bored'] = bored_set(fp)
    F['fidgetb'] = fidgetb_set(fp)
    # ---- deaths
    burn = []
    for k, (p, t) in enumerate(F['death_burn']):
        if k < 3:
            c = ('billow', k / 3)
        elif p.get('rot', 0) >= 80:
            c = ('death', 9, {'plain': True})
        else:
            c = ('hang', 0.25 * k, {'plain': True, 'L': 18, 'hem': 2.5})
        burn.append((dict(p, cape=c), t))
    F['death_burn'] = burn
    F['death_blast'] = _cape(F['death_blast'], lambda k, p: ('blast', k) if p.get('spin') else ('death', 9))
    F['death_drown'] = _cape(F['death_drown'], lambda k, p: ('drown', k, {'gnd': 17 - DROWN_DEPTH[min(k, 7)] - 1}))
    F['death_flat'] = _cape(F['death_flat'], lambda k, p: ('flat', k))
    # ---- moves
    F['flip'] = _cape(F['flip'], lambda k, p: ('flip', k))
    F['yawn'] = _cape(F['yawn'], lambda k, p: ('sit', 0.2 * k) if p['pelvis'][1] > -12 else None)
    F['sleep'] = _cape(F['sleep'], lambda k, p: ('sit', 0.25 * k))
    sp = F['spawn']
    F['spawn'] = _cape(sp, lambda k, p: ('settle', 0) if k == len(sp) - 2 else None)
    # ---- the heavy fire loops: a calm mode of their own (the 10-frame shoot tags fluttered at 2 ticks)
    for key in ('h_shoot', 'h_shootdiagup', 'h_shootup'):
        U[key] = _cape(U[key], lambda k, p: ('heavy', k))
    U['h_crouchshoot'] = _cape(U['h_crouchshoot'], lambda k, p: ('heavy', k, {'gnd': 11, 'phi': 120 + 2 * (k % 2 == 0), 'L': 23}))
    # ---- crouched throws and melee: the cape lies on the floor of the crouch, not under it
    for key in CROUCH_KEYS:
        U[key] = _cape(U[key], lambda k, p: tuple(p.get('cape', ('crouch', 0))[:2]) + ({'gnd': 11},))
    # ---- shooting down in a jump: the cape floats (as the core 'shoot down')
    for key in ('diagdown', 'shootdiagdown'):
        U[key] = _cape(U[key], lambda k, p: ('float', k))
    # ---- the Swan ride
    for key in ('ride_sit', 'ride_hunch', 'ride_brace', 'ride_ears', 'ride_duck', 'ride_hold'):
        U[key] = _cape(U[key], lambda k, p: ('ride', 0.5 * k))
    U['ride_lean'] = _cape(U['ride_lean'], lambda k, p: ('ridewind', 0.5 * k))
    U['ride_up'] = _cape(U['ride_up'], lambda k, p: ('ridewind', 0.2, {'phi': 196, 'curl': -12}))
    U['ride_cheer'] = _cape(U['ride_cheer'], lambda k, p: ('ridewind', 0.5 * k, {'phi': 178}))


TUFT = [                     # the swept-up front of his hair, on top of every balloon head
  "................hA.A..",
  "..............hhAAAH..",
  "...........hhhHAAHAAA.",
]


def _balloon_touch(part):
    """BOB's balloon heads: the swept-up hair tuft on the dome, and the big pale forehead patch of
    the sphere shading cut back to a thin rim light, so the face keeps its skin tone."""
    rows, an = part
    w = max(len(r) for r in rows)
    g = [list(r.ljust(w, '.')) for r in rows]
    for r in g:
        xs = [x for x, ch in enumerate(r) if ch != '.']
        right = max(xs) if xs else 0
        for x, ch in enumerate(r):
            if ch == 'L' and x < right - 1:
                r[x] = 'S'
    top = [list(t.ljust(w, '.')[:w]) for t in TUFT]
    # the tuft only fills empty pixels above the dome and joins it
    out = top + g
    return [''.join(r) for r in out], {k: (v[0], v[1] + len(TUFT)) for k, v in an.items()}


def after_derive():
    for k in [k for k in P.HEADS if k.startswith('he_')]:
        P.HEADS[k] = _balloon_touch(P.HEADS[k])
    import pose
    from heroes import bob_cape
    chain = pose.HOOKS['post']
    if not getattr(chain, '_bob_spin', False):
        def post(cv, X, p, layer, meta):
            chain(cv, X, p, layer, meta)
            bob_cape.post_spin(cv, X, p, layer, meta)
        post._bob_spin = True
        post._moves = getattr(chain, '_moves', False)
        pose.HOOKS['post'] = post
