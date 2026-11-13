# Mission sewers' two hostages at 40 px (content/sewers/street/hostages.ts): the stag-party guy in a
# banana costume (a look of the tourist: the same frame roles, his phone instead of the flash camera)
# and the sewer worker (orange overalls, the helmet with its dead head-lamp, tangled in wet wipes).
# Both are drawn with the tied tourist's animation code (chars/hostage-tourist/strips.py: the chair,
# the sack, the mast, freed, walk, run, gag, give, bow), with their own parts and palettes; the frame
# roles the game reads stay: the tourist's TIED_* order (8) for the banana, rest / blink / struggle
# for the worker's tied and mast strips, the gag flash on tick 24 (the banana), the worker's gag
# frames 0-1 (line 1) and 2-3 (line 2), the gift from the 'hand' point at tick 12.
import art40 as X
import castkit as K

from . import looks

P = K.P
pose = K.pose
tourist = X.char('hostage-tourist')
TS = tourist.strips

# The tourist's head names -> the street face expressions (looks.EXPR)
EXPR_OF = {
    'fwd': 'fwd', 'blink': 'blink', 'in': 'dazed', 'peek': 'sly', 'mmf': 'grit', 'strain': 'hurt',
    'sigh': 'down', 'oh': 'panic', 'happy': 'happy', 'cheese': 'happy', 'yay': 'shout', 'aim': 'blink',
    'puff': 'shout',
}

# ------------------------------------------------------------------------------------ the banana
# letters (the tourist's scheme): J j q the banana yellow (the suit, the hood, the sleeves), V Y the
# brown stalk and the spots, P p o O the burlap (the sack), X x v the brown shoes and the chair, G g N
# the phone, i its screen, D d the rope, R r the gift, h hair, Q darkest, w white, skin a
BANANA_PAL = dict(looks.SKIN['a'], **{
    'K': '#140c0e', 'Q': '#1e140e', 'h': '#6a4a30', 'w': '#fffaf0',
    'J': '#fff07a', 'j': '#f2c832', 'q': '#b48a1c',
    'V': '#8a5a2a', 'Y': '#4e3218',
    'P': '#e2cc8e', 'p': '#bca068', 'o': '#8a7046', 'O': '#55432a',
    'X': '#a8703c', 'x': '#744a26', 'v': '#40281a',
    'G': '#5a5e6c', 'g': '#363844', 'N': '#1c1c24', 'i': '#bfe4ff',
    'D': '#c89858', 'd': '#7a5a2e', 'R': '#d83a34', 'r': '#8c1e22', 'E': '#d83a34',
    'F': '#fffbd8', 'f': '#ffd040', 'W': '#ffffff', 'y': '#ffe070',
})
# the banana hood: the stalk and the curved tip over the head (4 rows over the 15-row head)
BANANA_TOP = K.grid("""
    ........VY.......
    .......VY........
    ......qJq........
    .....qjJJq.......
    .....qjjJJq......
    ...qqjjjjJJq.....
    ..qjjjjjjjJJJq...
    .qjjjjjjjjjJJJq..
    .qjjjVjjjjjjJJJq.
    .qjjjjjjjjjjjJJq.
""")
BANANA_SIDE = [(y + 4, x, t) for y, x, t in looks.HOOD_SIDE]
BANANA_SIDE[0] = (10, 1, 'qqjjjjJQss')
BANANA_TORSO = K.grid("""
    .qjJJq......
    qjjJJJq.....
    qjjjJJJJJJ..
    qjjVJJJJJJJ.
    qjjjjJJJJJJJ
    qjjjjJJJJVJJ
    qjjqjjJJJJJJ
    qjjqjjJJJJJj
    qjVjqjJJJJJj
    qjjjqjjJJJJj
    qqjjjqjjjJjq
    Qqjjjjqjjjjq
    .Qqqqqqqqqq.
""")
BANANA_HANDS = {
    # the phone held up to take the picture (the back with the flash LED w forward)
    'cam': (K.grid("""
        ..Nw.
        ..Ng.
        ..NN.
        jSSN.
        jSSs.
        .ss..
    """), {'wrist': (0.5, 4)}),
    # the phone low at the chest, the screen lit
    'camlow': (K.grid("""
        .NNN
        .NiN
        jSSN
        jSSs
        .ss.
    """), {'wrist': (0.5, 3)}),
    # the bow: no hat to sweep, a wave with the open hand
    'hat': (["S.S.", "SSSs", "SSSs", "SSs.", "jj.."], {'wrist': (0.5, 4)}),
    'hatlow': (["jSSSS", "jSSSs", ".sss."], {'wrist': (0, 1)}),
}

# ------------------------------------------------------------------------------------ the worker
WORKER_PAL = dict(looks.SKIN['b'], **{
    'K': '#140c0e', 'Q': '#1c1218', 'h': '#2c221e', 'H': '#4a3a34', 'A': '#6a564a', 'w': '#fffaf0',
    'J': '#ff9a3c', 'j': '#e0661c', 'q': '#9a3c14',                 # orange overalls
    'V': '#ffe070', 'Y': '#c89a20',                                 # the yellow helmet
    'P': '#a89a7a', 'p': '#7a6e54', 'o': '#54483a', 'O': '#332a20', # burlap (the sack)
    'X': '#4a4852', 'x': '#2a2830', 'v': '#140c0e',                 # black rubber boots, the chair
    'G': '#d8dee8', 'g': '#8a93a6', 'N': '#2a2830', 'i': '#d8dee8', # the reflective bands, the dead lamp
    'D': '#f4f2ea', 'd': '#b8bcc4',                                 # the wet wipes (the coils)
    'R': '#d83a34', 'r': '#8c1e22', 'E': '#d83a34',
    'F': '#fffbd8', 'f': '#ffd040', 'W': '#ffffff', 'y': '#ffe070',
})
# the helmet: yellow, the brim, the dead head-lamp (grey glass, no glow) at the front
HELMET = K.grid("""
    ................
    .....YVVVVY.....
    ...YVVVVVVVVY...
    ..YVVVVVVVVVVgN.
    ..YVVVVVVVVVVNg.
    .YYYYYYYYYYYYYY.
""")
HAIR = looks.TOPS['hair']
WORKER_EXTRA = [(11, 10, 'hhhh'), (12, 9, 'h')]                   # a big moustache
WORKER_TORSO = K.grid("""
    .qjJq.......
    qjjJJq......
    qjjDJJJJJJ..
    qjDdDJJGGJJ.
    qjjjdJJJJJJJ
    qjjjjJJJJJJJ
    qGGGGGGGGGGG
    qjjqjjJJDJJJ
    qjjqjjJDdJJj
    qjjjqjjJDJJj
    qGGGGGGGGGGq
    Qqjjjjqjjjjq
    .Qqqqqqqqqq.
""")
WORKER_HANDS = {
    # the bow: the helmet taken off and held by its brim, then swept low
    'hat': (K.grid("""
        ...YVVY..
        ..YVVVVY.
        .YYYYYYYY
        jSSs.....
        jSs......
    """), {'wrist': (0, 3.5)}),
    'hatlow': (K.grid("""
        ..YY.
        .YVV.
        YVVV.
        YVVVY
        jSSY.
        jSs..
    """), {'wrist': (0, 4.5)}),
    'cam': (["jSS", "jSs", ".ss"], {'wrist': (0, 1)}),
    'camlow': (["jSS", "jSs", ".ss"], {'wrist': (0, 1)}),
}


def install_heads(top, side, extra, bare_top, pad=0, neck=(6, 14)):
    nk = {'neck': (neck[0] + pad, neck[1])}
    for e in looks.EXPR:
        P.HEADS[e] = (looks.head_rows(top, e, side, extra, False, pad), nk)
    for name, e in EXPR_OF.items():
        P.HEADS[name] = (looks.head_rows(top, e, side, extra, False, pad), nk)
        P.HEADS['bare_' + name] = (looks.head_rows(bare_top, e, None if bare_top is not top else side, extra, False, pad), nk)


def head_rows_tall(top, expr, side):
    """A head with a top taller than 6 rows (the banana's stalk): the face under it."""
    face = list(looks.FACE)
    rows = [r.ljust(16, '.')[:max(16, len(r))] for r in top] + [r.ljust(len(top[0]), '.') for r in face]
    off = len(top) - 6
    rows = looks.edit(rows, [(y + off, x, s) for y, x, s in looks.EXPR[expr]])
    rows = looks.edit(rows, [(y, x, s) for y, x, s in side])
    return rows


def install_banana():
    tourist.parts.install()
    K.palette(BANANA_PAL, dark=dict(tourist.parts.DARK, J='j', j='q', q='Q', E='Q'), letters=''.join(BANANA_PAL))
    n = len(BANANA_TOP)
    nk = {'neck': (6, n + 8)}
    for e in looks.EXPR:
        P.HEADS[e] = (head_rows_tall(BANANA_TOP, e, BANANA_SIDE), nk)
    for name, e in EXPR_OF.items():
        rows = head_rows_tall(BANANA_TOP, e, BANANA_SIDE)
        P.HEADS[name] = (rows, nk)
        P.HEADS['bare_' + name] = (rows, nk)
    tan = dict(tourist.parts.TAN)
    for nm in ('up', 'in', 'nocam'):
        rows = BANANA_TORSO
        if nm == 'in':
            rows = [r + ('J' if 3 <= y <= 6 else '.') for y, r in enumerate(rows)]
        P.TORSOS[nm] = (rows, tan)
        for k, sh in (('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3)):
            P.TORSOS[k if nm == 'up' else f'{nm}_{k}'] = P.shear(P.TORSOS[nm], sh)
    for k, v in BANANA_HANDS.items():
        P.HANDS[k] = v
    TS.CAM_FLASH.update({'cam': (3, 0), 'camlow': (2, 0)})
    pose.RAMP['leg'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['legF'] = ['j', 'q', 'Q', 'Q']
    pose.HOOKS['pat'] = None


def install_worker():
    tourist.parts.install()
    K.palette(WORKER_PAL, dark=dict(tourist.parts.DARK, J='j', j='q', q='Q', E='Q', H='h', V='Y', Y='Q'),
              letters=''.join(WORKER_PAL))
    install_heads(HELMET, looks.SIDEBURN, WORKER_EXTRA, HAIR)
    tan = dict(tourist.parts.TAN)
    for nm in ('up', 'in', 'nocam'):
        rows = WORKER_TORSO
        if nm == 'in':
            rows = [r + ('J' if 3 <= y <= 6 else '.') for y, r in enumerate(rows)]
        P.TORSOS[nm] = (rows, tan)
        for k, sh in (('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3)):
            P.TORSOS[k if nm == 'up' else f'{nm}_{k}'] = P.shear(P.TORSOS[nm], sh)
    for k, v in WORKER_HANDS.items():
        P.HANDS[k] = v
    pose.RAMP['leg'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['legF'] = ['j', 'q', 'Q', 'Q']
    pose.HOOKS['pat'] = None


# The stand-ins' give frames held the gift at (11, -24) from the feet (hostage.ts hands it over at
# tick 12 from the frame shown then, the tourist's GIVE_HAND_FRAME 3): the same point on that frame,
# so the gift lands where it always did (play unchanged).
GIVE_PT = (11, -24)


def give():
    out = TS.give()
    rx, ry = X.feet_root()
    for k in (TS.GIVE_HAND_FRAME,):
        out[k].pts['hand'] = (rx + GIVE_PT[0], ry + GIVE_PT[1])
    return out


def _hooks():
    pose.draw_lower = TS._draw_lower
    pose.HOOKS['post'] = TS._post
    P.FX['click'] = (['....W....', '.W..F..W.', '..FyFyF..', '.WyFWFyW.', 'WFWWWWWFW', '.WyFWFyW.',
                      '..FyFyF..', '.W..F..W.', '....W....'], (4, 4))


def build_banana(s):
    install_banana()
    _hooks()
    s.strip('tied', TS.tied(), TS.TIED_DUR, cls='idle-fidget')
    s.strip('mast', TS.mast(), TS.TIED_DUR, cls='idle-fidget')
    s.strip('sack', TS.sack(), TS.SACK_DUR, cls='idle-fidget')
    s.strip('freed', freed_wave(), TS.FREED_DUR, loop=False, cls='victory')
    s.strip('walk', TS.walk(), [TS.WALK_TPF] * TS.WALK_N, cls='locomotion')
    s.strip('run', TS.run(), [TS.RUN_TPF] * TS.RUN_N, cls='locomotion')
    s.strip('gag', TS.gag(), TS.GAG_DUR, loop=False, cls='idle-fidget')
    s.strip('give', give(), TS.GIVE_DUR, loop=False, cls='victory')
    s.strip('bow', TS.bow(), TS.BOW_DUR, loop=False, cls='victory')
    for i, name in enumerate(TS.TIED_ORDER):
        s.event('BANANA_TIED_' + name.upper(), i)
    s.event('BANANA_GAG_FLASH_TICK', sum(TS.GAG_DUR[:TS.GAG_FLASH]))


def freed_wave():
    """Freed: the tourist's jump for joy, then he waves at the rescuer (the last frames)."""
    out = TS.freed()
    for k, (nh, fh, fk) in ((6, ((5, -8), (1, -4), 'open')), (7, ((6, -9), (1.5, 0), 'fist'))):
        up = TS.stand('up', 'happy', near=TS.hand(nh, 'wave', bend=-1, z=5.5), far=TS.hand(fh, fk, bend=-1))
        out[k] = TS.fig(up, TS.lower((0, -17), (-4, -4), (4, -4)))
    return out


WORKER_TIED = [0, 2, 4]       # rest, blink, struggle (the plain struggle bind: hostage.ts frameToDraw)


def worker_gag():
    """Line 1 (EINDELIJK LICHT!): he taps his dead head-lamp (frames 0, 1); line 2 (the battery): he
    points at the rescuer and holds out the open hand (frames 2, 3). The kind picks the frame."""
    out = []
    st = TS.lower((0, -17), (-4, -4), (4, -4))
    out.append(TS.fig(TS.stand('up', 'shout', near=TS.hand((5, -10), 'fist', bend=-1, z=5.5)), st))
    out.append(TS.fig(TS.stand('back1', 'grit', near=TS.hand((5.5, -11), 'point', bend=-1, z=5.5)), st))
    out.append(TS.fig(TS.stand('lean1', 'happy', near=TS.hand((9, 0), 'point', bend=-1)), st))
    out.append(TS.fig(TS.stand('lean1', 'shout', near=TS.hand((8, 3), 'open', bend=-1)), st))
    return out


def build_worker(s):
    install_worker()
    _hooks()
    tied = TS.tied()
    mast = TS.mast()
    for f in mast:      # tangled in the wipes on the mast too (two coils round the chest and the hips)
        ny = f.joints['torso.neck'][1]
        f.rows = tourist.parts.rope(f.rows, [int(round(ny + 5)), int(round(ny + 11))])
    s.strip('tied', [tied[i] for i in WORKER_TIED], [30, 7, 4], cls='idle-fidget', why='the kind picks rest / blink / struggle (the plain struggle bind reads frames 0-2)')
    s.strip('mast', [mast[i] for i in WORKER_TIED], [30, 7, 4], cls='idle-fidget', why='the kind picks rest / blink / struggle (the plain struggle bind reads frames 0-2)')
    s.strip('sack', TS.sack(), TS.SACK_DUR, cls='idle-fidget')
    s.strip('freed', TS.freed(), TS.FREED_DUR, loop=False, cls='victory')
    s.strip('walk', TS.walk(), [TS.WALK_TPF] * TS.WALK_N, cls='locomotion')
    s.strip('run', TS.run(), [TS.RUN_TPF] * TS.RUN_N, cls='locomotion')
    s.strip('gag', worker_gag(), [8, 8, 8, 8], cls='idle-fidget', why='the kind picks the frame by its line (hostages.ts WORKER gagFrame: 0-1, 2-3)')
    s.strip('give', give(), TS.GIVE_DUR, loop=False, cls='victory')
    s.strip('bow', TS.bow(), TS.BOW_DUR, loop=False, cls='victory')
