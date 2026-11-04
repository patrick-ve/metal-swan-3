# PATRICK's own versions of the extension-family poses. Runs after the families are built
# (after_ext) and at the very end (after_derive: the hand-made balloon eyes).
#
# His black sleeve reads as a dark beard where it crosses his face, so every new pose that lifted
# an arm across the face keeps the arm below the chin or in front of it here. The keyboard swings
# of the heavy melee hit flat at chest height, above the heavy gun at the hip.
import anims as A
import parts as P
import ext_moves as EM
from heroes import patrick_balloon

fp, gun, hand = EM.fp, A.gun, A.hand
LOW = (6, 7)
ST = ((0, -17), (-5, -4), (5, -4))

# ------------------------------------------------------------------ parts (gadgets)
PARTS_HANDS = {
  # his phone, held up in the far hand: a dark slab, the blue screen with white chat bubbles
  'phone': ([
    ".NNNN",
    ".NRRN",
    ".NRRN",
    ".NTRN",
    "SSRRN",
    "SSSsN",
    "JJs..",
  ], {'wrist': (0.5, 5.5)}),
  'phonetype': ([      # typing: his question grows at the bottom, the thumb on the screen
    ".NNNN",
    ".NRRN",
    ".NRRN",
    ".NRTN",
    "SSSTN",
    "SSSsN",
    "JJs..",
  ], {'wrist': (0.5, 5.5)}),
  'phonewait': ([      # sent: three dots while the answer comes
    ".NNNN",
    ".NRRN",
    ".NRTN",
    ".NRRN",
    "SSTRN",
    "SSSsN",
    "JJs..",
  ], {'wrist': (0.5, 5.5)}),
  'phoneans': ([       # the answer: a long white reply fills the screen
    ".NNNN",
    ".NTTN",
    ".NTTN",
    ".NTRN",
    "SSRTN",
    "SSSsN",
    "JJs..",
  ], {'wrist': (0.5, 5.5)}),
  # a tiny handheld game in both hands (the near hand on the left grip, wrist anchor)
  'game': ([
    "..ggggggg.",
    ".gGRRRRGn.",
    ".gGRwRRGn.",
    "SSGRRRRGnS",
    "SSSnGGGnSS",
    "JJs.....JJ",
  ], {'wrist': (0.5, 5)}),
  'game2': ([          # the little hero jumps on the screen
    "..ggggggg.",
    ".gGRRwRGn.",
    ".gGRRRRGn.",
    "SSGRRRRGnS",
    "SSSnGGGnSS",
    "JJs.....JJ",
  ], {'wrist': (0.5, 5)}),
  'gamewin': ([        # a win: the screen flashes white
    "..ggggggg.",
    ".gGTTTTGn.",
    ".gGTwTTGn.",
    "SSGTTTTGnS",
    "SSSnGGGnSS",
    "JJs.....JJ",
  ], {'wrist': (0.5, 5)}),
}
PARTS_ITEMS = {
  # the second frikandel peeks out of the inner jacket pocket (anchor = where it leaves the jacket)
  'frikpeek0': (["sC", "CE"], {'c': (0, 1)}),
  'frikpeek1': (["...sC", "..sCE", ".sCE.", "sCE.."], {'c': (0, 3)}),
}


# ------------------------------------------------------------------ full-body sets
def bored_set():
    """Long idle: the pistol goes in the waistband, out comes a tiny handheld game. He plays, leans
    in, wins (a little hop), loses interest ... and spots a second frikandel peeking out of his
    jacket. A happy look, then back to the pistol."""
    S = []
    tuck = gun((3, 8), 'low')
    G = lambda kind='game', h=(6, 1): hand(h, kind, 'hand', bend=-1, z=6.5)
    farb = hand((2, 7), 'inside', 'hand')  # the far hand rests behind the body (only the cuff)
    S.append((fp(*ST, head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 12))
    S.append((fp(*ST, head='down', armN=tuck, armF=farb), 6))                         # gun away
    S.append((fp(*ST, head='look', armN=G('game', (6, 1)), armF=farb), 10))           # game out
    S.append((fp(*ST, head='look', armN=G('game2', (6, 1.5)), armF=farb), 6))         # thumbs
    S.append((fp(*ST, head='look', armN=G('game', (6, 1)), armF=farb), 6))
    S.append((fp(*ST, torso='lean', head='wow', hd=(1, 0), armN=G('game2', (6, 0.5)), armF=farb), 8))  # leans in
    S.append((fp((0, -18), (-5, -3), (5, -3), 'toe', 'toe', head='lookgrin', armN=G('gamewin', (6, 1.5)),
                 armF=farb), 8))                                                         # a win, a hop
    S.append((fp(*ST, head='bored', armN=G('game', (5, 3)), armF=farb), 12))            # meh
    S.append((fp(*ST, head='bored', tor=(0, 1), armN=G('game', (2, 9)), armF=farb,
                 items=[('frikpeek0', (4, -22), 17.5)]), 10))                              # it peeks
    S.append((fp(*ST, head='down', armN=G('game', (2, 9)), armF=farb,
                 items=[('frikpeek1', (4, -22), 17.5)]), 10))                              # he sees it
    S.append((fp(*ST, head='happy', armN=G('game', (2, 9)), armF=farb,
                 items=[('frikpeek1', (4, -22), 17.5)]), 16))
    S.append((fp(*ST, head='blink', armN=gun((8, 4)), armF=hand((9, 5))), 6))
    return S


def fidgetb_set():
    """Second fidget: he asks his AI something on his phone, waits, reads the answer, grins and
    nods (it agrees with him), and the phone goes back in."""
    S = []
    low = gun(LOW, 'low')
    Ph = lambda kind='phone', h=(9, 1): hand(h, kind, 'hand', bend=-1, z=6.5)
    S.append((fp(*ST, head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 10))
    S.append((fp(*ST, head='down', armN=low, armF=hand((7, 2), 'inside', 'hand', z=6.5)), 6))
    S.append((fp(*ST, head='look', armN=low, armF=Ph('phone')), 8))
    S.append((fp(*ST, head='look', armN=low, armF=Ph('phonetype', (9, 0.5))), 5))       # types
    S.append((fp(*ST, head='look', armN=low, armF=Ph('phone')), 5))
    S.append((fp(*ST, head='lookblink', armN=low, armF=Ph('phonewait')), 12))             # waits
    S.append((fp(*ST, head='look', armN=low, armF=Ph('phoneans')), 14))                  # reads
    S.append((fp(*ST, head='lookgrin', armN=low, armF=Ph('phoneans')), 10))              # grins
    S.append((fp(*ST, head='lookgrin', hd=(0, 1), armN=low, armF=Ph('phoneans', (9, 1.5))), 5))  # nod
    S.append((fp(*ST, head='lookgrin', armN=low, armF=Ph('phoneans')), 5))
    S.append((fp(*ST, head='smirk', armN=low, armF=hand((7, 1), 'inside', 'hand', z=6.5)), 8))
    S.append((fp(*ST, head='fwd', armN=gun((8, 4)), armF=hand((9, 5))), 10))
    return S


# ------------------------------------------------------------------ pose edits
def _arm(p, key, **kw):
    a = dict(p[key])
    a.update(kw)
    p[key] = a


def _edit(table, key, i, fn):
    seq = table[key]
    p, t = seq[i]
    q = dict(p)
    fn(q)
    seq[i] = (q, t)


DUP = lambda h: gun(h, 'dup', sh=(1.5, -0.5))


def fix_full():
    F = A.FULL
    # victory: the pistol raised on the diagonal (the arm stays below the face), a big grin
    for i, (p, t) in enumerate(F['victory']):
        q = dict(p)
        q['armN'] = DUP((9, -3) if i % 2 == 0 else (9, -2.5))
        if q.get('head') == 'happy':
            q['head'] = 'grin'
        F['victory'][i] = (q, t)
    # respawn: the same diagonal pistol on the way down
    for i in (0, 1):
        _edit(F, 'spawn', i, lambda q: q.update(armN=DUP((9, -3))))
    # burn: the jolt and the hop keep the pistol arm under the chin
    _edit(F, 'death_burn', 0, lambda q: q.update(armN=DUP((9, -2.5))))
    _edit(F, 'death_burn', 1, lambda q: q.update(armN=DUP((9, -3))))
    _edit(F, 'death_burn', 2, lambda q: q.update(armN=gun((9, -1))))
    # yawn: the stretch goes forward and up on the diagonal, the far arm high behind the head
    _edit(F, 'yawn', 1, lambda q: q.update(armN=DUP((9, -2.5))))
    _edit(F, 'yawn', 2, lambda q: q.update(armN=DUP((9, -3.5))))
    # drown: the flailing near hand stays in front of the face, not across it
    op = lambda h: hand(h, 'open', 'hand', bend=1)
    _edit(F, 'death_drown', 1, lambda q: q.update(armN=op((10, -3))))
    _edit(F, 'death_drown', 3, lambda q: q.update(armN=op((10, -3.5))))
    _edit(F, 'death_drown', 0, lambda q: q.update(armN=op((10, -2))))
    wave = lambda h: hand(h, 'wave', 'hand', bend=-1)
    _edit(F, 'death_drown', 4, lambda q: q.update(armN=wave((11, -3))))
    _edit(F, 'death_drown', 5, lambda q: q.update(armN=wave((10, -4))))
    # blast: the flung near arm stays in front of the face while he tumbles
    for i in range(6):
        def f(q):
            a = q.get('armN')
            if a and a['hand'][1] < -3:
                _arm(q, 'armN', hand=(10, -3))
        _edit(F, 'death_blast', i, f)
    # mount: the fists come up in front of the chest, not the chin
    fist = lambda h, z=None: hand(h, 'fist', 'fist', bend=1, z=z)
    _edit(F, 'mount', 1, lambda q: q.update(armN=fist((10, -1.5)), armF=fist((10, -2), 6.5)))
    _edit(F, 'mount', 2, lambda q: q.update(armN=fist((9, 0)), armF=fist((9, -1))))
    _edit(F, 'mounthop', 1, lambda q: q.update(armN=fist((9.5, -0.5)), armF=fist((9, -1))))
    F['bored'] = bored_set()
    F['fidgetb'] = fidgetb_set()


def fix_upper():
    U = A.UPPER
    # throws: the release (frame 3) goes forward at shoulder height, below the chin
    for k in ('crouchgrenade', 'h_grenade', 'h_crouchgrenade'):
        _edit(U, k, 3, lambda q: _arm(q, 'armF', hand=(10, -0.5)))
    # melee: the swing over the top passes BEHIND the head (the board shows above it), so the
    # black sleeve and the board never cover his face
    for k in ('crouchslash', 'h_crouchslash', 'h_slash'):
        _edit(U, k, 2, lambda q: _arm(q, 'armF', hand=(10.5, -1), end=('hand', 'kbdiag'), bend=-1, z=6.5))
    # heavy melee: the keyboard hits flat at chest height, above the heavy gun at the hip
    for k in ('h_slash', 'h_crouchslash'):
        _edit(U, k, 3, lambda q: _arm(q, 'armF', hand=(10, 0), end=('hand', 'kb'), bend=-1))
        _edit(U, k, 4, lambda q: _arm(q, 'armF', hand=(10, 1), end=('hand', 'kb'), bend=-1))
        _edit(U, k, 5, lambda q: _arm(q, 'armF', hand=(8, 2), end=('hand', 'kb'), bend=-1))
        # the effects follow the flat board (bonk at the end, the keycaps fly up off it)
        _edit(U, k, 3, lambda q: q.update(fx=[f if f[0] != 'bonk' else ('bonk', ('armF', 'tip', 1, 0)) for f in q['fx']]))
    # ride cheer: the 'yes!' fist pumps in front of the chest, the grin stays clear
    _edit(U, 'ride_cheer', 0, lambda q: (_arm(q, 'armN', hand=(11.5, -1)), q.update(head='grin')))
    _edit(U, 'ride_cheer', 1, lambda q: _arm(q, 'armN', hand=(10.5, 0.5)))


def after_ext():
    P.HANDS.update(PARTS_HANDS)
    P.ITEMS.update(PARTS_ITEMS)
    fix_full()
    fix_upper()


def after_derive():
    patrick_balloon.fix_all()
