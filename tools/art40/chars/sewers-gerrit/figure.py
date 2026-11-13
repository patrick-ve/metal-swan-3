# GOUDEN GERRIT himself: the squad rig with his own drawn parts (the head with slicked hair and
# sunglasses in five expressions, the gold suit torso with the white fur collar and the chains, the
# gold pump shotgun in three holds, the gold hand mirror, the swung chain), the poses in the sunroof
# by frame role (limo.ts G_*) and the flee across the bridge.
#
# Game numbers (limo.ts): MUZZLE (17, -31) and HAND (6, -40) relative to his feet anchor, facing
# right; his hurtbox x -8..8 round him, 30 px over the roof. The figure stands with its feet 15 px
# under the roof line (GERRIT.sun.hip), so only the rows from the belt up show above the roof.
import math

import art40 as X
import castkit as K
import pose
import rig

P = K.P
A = K.A


def _rows(t):
    return K.grid(t)


def _edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            if ch != ' ':
                out[y][x + i] = ch
    return [''.join(r) for r in out]


# ------------------------------------------------------------------------------------ heads
# 14 x 13, neck (5, 12), facing right: slicked-back black hair with a gel shine, wraparound
# sunglasses, the tan, a gold stud in the ear, a smug grin with one gold tooth.
HEAD = _rows("""
    ...hhHHHHh....
    ..hHHAAAAHHh..
    .hHHAHHHHAAHH.
    hHHHHHHHHHHSL.
    hHHHHHHHHsSLL.
    hhHHHHHHsSSSL.
    hhHHHHNNNNNNm.
    .hhHszsNNNNNNL
    .hhHszYSSSSSSs
    ..hhssSSSSSzs.
    ..hhsSSSSrYrs.
    ...zsSSSSSss..
    ....zzssss....
""")
HEADS = {
    'fwd': HEAD,
    # GOUD IS GOUD! / the panic: the mouth wide open, the gold tooth, the tongue
    'shout': _edit(HEAD, [(9, 6, 'SSSSrrs'), (10, 5, 'SSSrRYr'), (11, 5, 'SSSSrrs'), (12, 4, 'zzssss')]),
    # the gloat: the grin wide, every tooth gold
    'grin': _edit(HEAD, [(9, 6, 'SSSSzzs'), (10, 5, 'SSSYYYY'), (11, 5, 'SSSzzs')]),
    # MIJN LIMO!!: brows up over the shades, the mouth a round O
    'shock': _edit(HEAD, [(5, 8, 'zSSz'), (9, 6, 'SSSSrr'), (10, 5, 'SSSSrrr'), (11, 5, 'SSSSrr')]),
    # knocked out: the shades knocked askew, the tongue out
    'ko': _edit(HEAD, [(6, 6, 'sSSNNNm'), (7, 6, 'sNNNNSL'), (10, 5, 'SSSSrRR'), (11, 5, 'SSSSSRs')]),
}

# ------------------------------------------------------------------------------------ torso
# 14 x 11, the gold suit: the back in shade, the lit front, a white fur collar round the neck and
# down the lapel, the black shirt open at the chest with two gold chains and a medallion.
TORSO = _rows("""
    ..321121121...
    .32111111112..
    .3211111112x..
    qg321111x2xY..
    qggg3212xxYx..
    qgggG322xYxG..
    qgggGG32xYYYG.
    qqgggGG3YgYYG.
    qqgggGGGGYYGq.
    Qqqgggggggggq.
    .QqqqqqqqqqqQ.
""")
TORSO_AN = {'neck': (6, -1), 'pelvis': (6, 9), 'shN': (7, 2.5), 'shF': (4, 3.0)}

# ------------------------------------------------------------------------------------ the shotgun
# The gold pump shotgun, short barrel (wrist on the grip): stock (wood), receiver, the pump (wood)
# forward or slid back, the barrel and the magazine tube. 'muzzle' the first pixel past the barrel.
SG = _rows("""
    ...qGYYYYYYYYYYYYYYY.
    W.qgGGGGGGGGGGGGGGGGg
    WWWgGgqWWWWWqqqqqqqqq
    wWWWTSgqwwwwwq.......
    .wwwTSSs.............
""")
SG_BACK = _rows("""
    ...qGYYYYYYYYYYYYYYY.
    W.qgGGGGGGGGGGGGGGGGg
    WWWgGWWWWWqqqqqqqqqqq
    wWWWTSwwwwwq.........
    .wwwTSSs.............
""")
SG_UP = _rows("""
    .Y..
    .Gq.
    .Gq.
    .Gq.
    .Gq.
    .GqW
    .GqW
    .GqW
    .GqW
    .Gq.
    qGgq
    SSGg
    SSsw
    TTWW
    .wWw
    ..ww
""")

# ------------------------------------------------------------------------------------ hand items
# The gold hand mirror (the gloat: he admires his teeth), the gold chain swung over his head.
MIRROR = _rows("""
    .gGGq.
    gYmmGq
    GmY1Gq
    GmmmGq
    .gGGq.
    ..TS..
    ..SSs.
    ...ss.
""")
CHAIN_UP = _rows("""
    ..YGg..gGY..
    .G.......g..
    g.........G.
    .Gg.....gG..
    ...gG.Gg....
    .....SS.....
    ....SSSs....
    .....Ts.....
""")
# a fist on the pump, an open hand (the shock, the throw)
FIST = (["TSS", "TSs", ".ss"], {'wrist': (0, 1)})

# the muzzle flash of the frame (FX letters only, no outline): a short gold burst
FLASH = (_rows("""
    ..f.....
    .fFf.c..
    fFOOFfc.
    FOOOOFFc
    fFOOFfc.
    .fFf.c..
    ..f.....
"""), (0, 3))


def turned(rows, an, about, deg, m=8):
    """A part turned by deg (counter-clockwise on screen) about one of its anchors, the RotSprite
    way (rig.rotsprite); every anchor turns with it."""
    w = max(len(r) for r in rows)
    pad = ['.' * (w + 2 * m)] * m
    g = pad + ['.' * m + r.ljust(w, '.') + '.' * m for r in rows] + pad
    px, py = an[about][0] + m, an[about][1] + m
    out = rig.rotsprite(g, (px, py), deg)
    a = math.radians(deg)

    def turn(p):
        dx, dy = p[0] + m - px, p[1] + m - py
        return (px + dx * math.cos(a) + dy * math.sin(a), py - dx * math.sin(a) + dy * math.cos(a))
    return out, {k: turn(v) for k, v in an.items()}


def install():
    """Patch the kit tables for Gerrit (one set per process: bake.py)."""
    for k, rows in HEADS.items():
        P.HEADS[k] = (rows, {'neck': (5, 12)})
    P.TORSOS['g'] = (TORSO, TORSO_AN)
    P.TORSOS['g-lean'] = P.shear(P.TORSOS['g'], 2)
    P.TORSOS['g-lean2'] = P.shear(P.TORSOS['g'], 3)
    P.TORSOS['g-back'] = P.shear(P.TORSOS['g'], -2)
    P.GUNS['sg'] = (SG, {'wrist': (4, 3.5), 'muzzle': (21, 1)})
    P.GUNS['sgb'] = (SG_BACK, {'wrist': (4, 3.5), 'muzzle': (21, 1)})
    P.GUNS['sgk'] = turned(SG, {'wrist': (4, 3.5), 'muzzle': (21, 1)}, 'wrist', 10)
    P.GUNS['sgup'] = (SG_UP, {'wrist': (1.5, 12.5), 'muzzle': (1.5, -1)})
    P.HANDS['mirror'] = (MIRROR, {'wrist': (2.5, 6.5)})
    P.HANDS['chain'] = (CHAIN_UP, {'wrist': (5.5, 6.5)})
    P.FISTS['fist'] = FIST
    P.FX['gflash'] = FLASH
    # white loafers (the kit's black shoes with white letters)
    tr = str.maketrans({'x': '2', 'X': '1', 'v': '4'})
    for k, (rows, an) in list(P.SHOES.items()):
        P.SHOES[k] = ([r.translate(tr) for r in rows], an)
    pose.RAMP['arm'] = ['G', 'g', 'q', 'Q']
    pose.RAMP['armF'] = ['g', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['X', 'x', 'v', 'v']
    pose.RAMP['legF'] = ['x', 'v', 'v', 'v']


# ------------------------------------------------------------------------------------ poses
STAND = A.legs((0, -17), (-4, -4), (4, -4))


def fig(upper, lower=STAND, fx=None):
    rows, root, j = X.humanoid(upper, lower)
    if fx:
        rows = _fx(rows, fx)
    return X.Frame(rows, root, joints=j)


def _fx(rows, items):
    g = [list(r) for r in rows]
    for (fr, an), (x, y) in items:
        x0, y0 = int(round(x - an[0])), int(round(y - an[1]))
        for j, r in enumerate(fr):
            for i, ch in enumerate(r):
                if ch != '.' and 0 <= y0 + j < len(g) and 0 <= x0 + i < len(g[0]):
                    g[y0 + j][x0 + i] = ch
    return [''.join(r) for r in g]


def gun(hand, kind='sg', bend=-1):
    return dict(hand=hand, end=('gun', kind), bend=bend)


def hand(h, kind='fist', lib='fist', bend=-1, z=None):
    a = dict(hand=h, end=(lib, kind), bend=bend)
    if z is not None:
        a['z'] = z
    return a


def up(torso='g', head='fwd', tor=(0, 0), hd=(0, 0), near=None, far=None):
    return A.up(torso=torso, head=head, tor=tor, hd=hd, near=near, far=far)


# The sunroof figure stands LIFT px over its anchor (his feet are inside the car): the shoulders
# come up to the stand-in's height, the head top reaches the hurtbox top (30 px over the roof).
LIFT = 4
# limo.ts MUZZLE (17, -31) from the anchor = (17, -27) from his soles.
MUZZLE = (17, -31 + LIFT)


def lifted(fr):
    fr.root = (fr.root[0], fr.root[1] + LIFT)
    return fr


def aim(kind, far, torso='g', tor=(0, 0), hd=(0, 0), head='fwd', muzzle=MUZZLE):
    """A shouldered pose: the near hand solved so the barrel tip lands on the game's muzzle; the
    far hand at `far` from the grip (on the pump)."""
    hx, hy = 1.0, -2.0
    for _ in range(4):
        u = up(torso=torso, tor=tor, hd=hd, head=head, near=gun((hx, hy), kind))
        rows, root, j = X.humanoid(u, STAND)
        mz = j['armN.muzzle']
        dx = root[0] + muzzle[0] - mz[0]
        dy = root[1] + muzzle[1] - mz[1]
        hx, hy = hx + dx, hy + dy
        if abs(dx) < 0.3 and abs(dy) < 0.3:
            break
    w = j['armN.wrist']
    sh = j['armF.wrist'] if 'armF.wrist' in j else None
    # the far hand target is from the far shoulder: grip + far offset - far shoulder
    u0 = up(torso=torso, tor=tor, hd=hd, head=head, near=gun((hx, hy), kind), far=hand((0.0, 0.0)))
    _, _, j0 = X.humanoid(u0, STAND)
    fs = j0['armF.wrist']          # with hand (0, 0) the wrist sits on the far shoulder
    return up(torso=torso, tor=tor, hd=hd, head=head, near=gun((hx, hy), kind),
              far=hand((w[0] + far[0] - fs[0], w[1] + far[1] - fs[1])))


def sunroof():
    """The 10 poses by role (limo.ts G_IDLE .. G_SLUMP)."""
    out = []
    # G_IDLE: the shotgun at the hip, pointed forward and a little up; the smug grin
    out.append(fig(up(near=gun((5.5, 3.0), 'sg'), far=hand((10.0, 4.5)))))
    # G_PUMP_A: shouldered, the pump forward
    out.append(fig(aim('sg', (5.0, 0.5))))
    # G_PUMP_B: the pump slid back (the cha-chk), the shoulders drop a pixel
    out.append(fig(aim('sgb', (3.0, 0.5), tor=(0, 1))))
    # G_FIRE: the kick: leaning back, the barrel up, the flash at the muzzle
    f = aim('sgk', (4.5, 0.0), torso='g-back', hd=(-1, 0), head='shout', muzzle=(MUZZLE[0] - 1, MUZZLE[1] - 2))
    rows, root, j = X.humanoid(f, STAND)
    mz = j['armN.muzzle']
    rows = _fx(rows, [(FLASH, (mz[0] + 1, mz[1]))])
    out.append(X.Frame(rows, root, joints=j))
    # G_SHOUT: the shotgun held high in one fist, the other fist on the hip: GOUD IS GOUD!
    out.append(fig(up(head='shout', hd=(0, -1), near=dict(gun((-1.0, -5.0), 'sgup', bend=1), z=3), far=hand((5.0, 6.0)))))
    # G_SWING: the gold chain swung over his head (the lob tell)
    out.append(fig(up(head='shout', near=hand((-2.5, -10.0), 'chain', 'hand', bend=1, z=3), far=hand((5.0, 6.0)))))
    # G_THROW: the arm thrown forward after the release, leaning in
    out.append(fig(up(torso='g-lean', head='shout', hd=(1, 0), near=hand((10.0, -1.0), 'open', 'hand'), far=hand((2.0, 7.0)))))
    # G_GLOAT: he admires his gold teeth in a gold hand mirror held out at arm's length
    out.append(fig(up(head='grin', near=hand((8.5, -5.0), 'mirror', 'hand'), far=hand((5.0, 6.5)))))
    # G_SHOCK: both hands flung out: MIJN LIMO!!
    out.append(fig(up(head='shock', hd=(0, -1), tor=(0, -1), near=hand((8.5, -5.0), 'open', 'hand', bend=1), far=hand((7.0, -6.5), 'open', 'hand', bend=1))))
    # G_SLUMP: knocked out, folded over the sunroof's edge, the arms hanging
    lo = A.legs((0, -13), (-4, -4), (4, -4))
    out.append(fig(up(torso='g-lean2', head='ko', hd=(2, 2), near=hand((7.0, 9.0), 'open', 'hand'), far=hand((6.0, 9.5), 'open', 'hand')), lo))
    out = [lifted(f) for f in out]
    for i, f in enumerate(out):
        x0, y0, x1, y1 = K.bbox(f.rows)
        l, t, r = x0 - f.root[0], y0 - f.root[1], x1 - f.root[0]
        if l < -24 or r > 24 or t < -47:
            raise X.SetError(f'sunroof frame {i} leaves the 48 x 48 box of limo.ts gerritSrc: {l, t, r}')
    return out


def run():
    """The flee across the bridge: 6 frames (limo.ts reads fleeT / 4 % 6), arms up, mouth open."""
    out = []
    for i in range(6):
        lo = A.run_lower(i * 2)
        bob = 1 if i % 3 else 0
        sw = [0, 2, 3, 0, -2, -3][i]
        u = up(torso='g-lean', head='shout', tor=(0, bob), hd=(1, -bob),
               near=hand((3.0 + sw * 0.5, -9.0 + abs(sw) * 0.4), 'open', 'hand', bend=1),
               far=hand((4.0 - sw * 0.5, -8.5 + abs(sw) * 0.3), 'open', 'hand', bend=1))
        out.append(fig(u, lo))
    return out
