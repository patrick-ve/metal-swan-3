# WIELKLEM: the wheel clamp the tow truck tosses (boss/ams-scan/clamp, clamp-foot) at 40 px (plan
# docs/design/ams40.md wave 6). The look is the cast spike's approved sample
# (docs/design/cast40/chars/ams-wheel-clamp.py): two yellow jaw arms with steel teeth on their inner
# edges over a steel foot plate, the round steel lock disc with its keyhole. One set of the shared
# prefix boss/ams-scan (the scan car and the tow truck are other slugs of it).
#
# The clamp is a hopping jaw: its frames are ROLES the code picks (adds.ts AmsWheelClamp.draw) by
# state; the roles 0..3 keep their old meaning (shut, open, twitch, squat), the new in-betweens give
# the hop its anticipation (half squat, a trembling squat), the launch stretch, the wide-open jaws in
# the air and the landing squash, and the idle twitch a real snap (open, half, shut, half, open).
# clamp-foot: the clamp locked on a hero's boot: still, rattling, and the bite (jaws wide, snap shut).
# Every frame faces right (the hop direction; the code mirrors for a hop to the left).
import art40 as X
import castkit as K

SET = X.Set(prefix='boss/ams-scan', budget=40, face=1, outline='K', hl='W')
SET.shares_prefix = True

PAL = {
    'K': '#140c0e',                                                       # the warm near-black outline
    'J': '#ffe068', 'j': '#f0b628', 'X': '#b87c14', 'x': '#6c4410',       # clamp yellow
    'S': '#eef1f6', 's': '#a8afbd', 'z': '#6c7384', 'Z': '#3e4352',       # steel
    'o': '#1e1c23',                                                       # the keyhole
    'W': '#ffffff',                                                       # the glint of a snap
}
DARK = {}
for grp, d in [('JjXx', 'x'), ('SszZ', 'Z'), ('o', 'o'), ('W', 's')]:
    for ch in grp:
        DARK[ch] = d

# ------------------------------------------------------------------------------------------ clamp
# Hand-drawn grids, 13 px wide, the foot plate's bottom row last. The near (right) arm's outer edge is
# lit (J), the far arm's outer edge dark (X); teeth (S) on the inner edges; the lock disc (s/S/z) with
# its keyhole (o).
DISC = [
    '...xjsSSsjX..',
    '...zssoSSs...',
    '...zssoSss...',
    '....zzzsz....',
]
PLATE = [
    '.zsssssssSSs.',
    '.ZzzzzzzzzzZ.',
]
G = {}
# 1 OPEN: the armed rest (the approved sample): the jaws up in a U
G['open'] = [
    '..XjS...SjJ..',
    '.Xj.......jJ.',
    '.XjS.....SjJ.',
    '.Xj.......jJ.',
    '.XjS.....SjJ.',
    '..xjj...jjJ..',
] + DISC + PLATE
# 2 HALF: the twitch on its way shut (tips bent in)
G['half'] = [
    '...XjS.SjJ...',
    '..Xj.....jJ..',
    '.XjS.....SjJ.',
    '.Xj.......jJ.',
    '.XjS.....SjJ.',
    '..xjj...jjJ..',
] + DISC + PLATE
# 0 SHUT: in the air after the toss: the jaws closed into a ring
G['shut'] = [
    '....XjjjJ....',
    '...Xj.S.jJ...',
    '..XjS...SjJ..',
    '..Xj.....jJ..',
    '..XjS...SjJ..',
    '..xjj...jjJ..',
] + DISC + PLATE
# 8 SNAP: the twitch's peak on the ground: shut hard, the arms pressed down a row, a glint
G['snap'] = [
    '......W......',
    '....XjjjJ....',
    '...XjSSSjJ...',
    '..XjS...SjJ..',
    '..xjj...jjJ..',
] + DISC + PLATE
# 9 HALF SQUAT: into the hop tell (the arms sink a row, the disc presses)
G['dip'] = [
    '.XjS.....SjJ.',
    '.Xj.......jJ.',
    '.XjS.....SjJ.',
    '.Xj.......jJ.',
    '..xjj...jjJ..',
    '...xjsSSsjX..',
    '...zssoSSs...',
    '...zssoSss...',
    '....zzzsz....',
] + PLATE
# 3 SQUAT: the hop tell: coiled low and wide, the jaws pressed shut, the disc squashed flat, the
#   plate spread full width (it reads apart from the wide-open V of the hop)
G['squat'] = [
    '....XjSjJ....',
    '...XjS.SjJ...',
    '..Xj.....jJ..',
    '..xjj...jjJ..',
    '..xjsSSSsjX..',
    '..zssoSSSs...',
    '...zzzzsz....',
    'zsssssssssSSs',
    'ZzzzzzzzzzzzZ',
]
# 4 SQUAT B: the tell trembles (the tips quiver open a pixel)
G['squat2'] = [
    '...XjS.SjJ...',
    '...Xj...jJ...',
    '..Xj.....jJ..',
    '..xjj...jjJ..',
    '..xjsSSSsjX..',
    '..zssoSSSs...',
    '...zzzzsz....',
    'zsssssssssSSs',
    'ZzzzzzzzzzzzZ',
]
# 6 LAUNCH: the push-off: stretched tall and narrow, the jaws drawn in, the plate tucked
G['launch'] = [
    '....XjS.SjJ..',
    '....Xj...jJ..',
    '...XjS..SjJ..',
    '...Xj...jJ...',
    '...XjS.SjJ...',
    '...xjj.jjJ...',
    '...xjsSSsjX..',
    '...zssoSSs...',
    '...zssoSss...',
    '...zssoSss...',
    '....zzzsz....',
    '..zssssssSs..',
    '..ZzzzzzzzZ..',
]
# 7 WIDE: in the air, the jaws flung wide open at the hero (a V)
G['wide'] = [
    'XjS.......SjJ',
    'Xj.........jJ',
    '.XjS.....SjJ.',
    '.Xj.......jJ.',
    '..XjS...SjJ..',
    '..Xj.....jJ..',
    '...xjj.jjJ...',
] + DISC + PLATE
# 5 LAND: the touch-down squash: short, splayed, the plate spread full width
G['land'] = [
    'XjS.......SjJ',
    '.XjS.....SjJ.',
    '..Xj.....jJ..',
    '..xjj...jjJ..',
    '...xjsSSsjX..',
    '...zssoSSs...',
    '....zzzsz....',
    'zsssssssssSSs',
    'ZzzzzzzzzzzzZ',
]

# The strip order = the frame roles the game reads (constants below).
CLAMP_ROLES = ['shut', 'open', 'half', 'squat', 'squat2', 'land', 'launch', 'wide', 'snap', 'dip']
# Display ticks of each role in its code path (the gates measure travel per tick with them).
CLAMP_TICKS = [6, 34, 2, 6, 2, 4, 4, 8, 2, 3]

# ------------------------------------------------------------------------------------- clamp-foot
# The clamp locked on a hero's boot (drawn over the hero at his feet, facing his way): the arch over
# the instep with teeth biting down, the two jaws round toe and heel, the lock disc on the near side,
# the plate under the sole.
F = {}
F['still'] = [
    '..XjjjjjjJ..',
    '.Xj.S.S.SjJ.',
    '.Xj.zsSs.jJ.',
    '.Xj.sozS.jJ.',
    '.xj.zszs.jJ.',
    '.xjj.zz.jjX.',
    '.ZzzzzzzzzzZ',
]
# 1 RATTLE: working loose: the arch lifted a row, the disc askew, the plate a pixel forward
F['rattle'] = [
    '..XjjjjjjJ..',
    '.Xj......jJ.',
    '.Xj.S.S.SjJ.',
    '.Xj.zsSs.jJ.',
    '.xj.sozS.jJ.',
    '.xjj.zss.jX.',
    '..ZzzzzzzzzZ',
]
# 2 BITE: the jaws come down wide round the boot
F['bite'] = [
    'XjS......SjJ',
    '.Xj.....jJ..',
    '.Xj.zsSs.jJ.',
    '.Xj.sozS.jJ.',
    '.xj.zszs.jJ.',
    '.xjj.zz.jjX.',
    '.ZzzzzzzzzzZ',
]
# 3 SNAP: shut hard (pressed a row lower, the glint)
F['snap'] = [
    '.....W......',
    '..XjjjjjjJ..',
    '.XjSSSSSSjJ.',
    '.Xj.zsSs.jJ.',
    '.xj.sozS.jJ.',
    '.xjj.zz.jjX.',
    'ZzzzzzzzzzzZ',
]
# 4 POP: springing open as it falls apart
F['pop'] = [
    'J..........J',
    'jX........Xj',
    '.jX.zsSs.Xj.',
    '..j.sozS.j..',
    '.xj.zszs.jX.',
    '.xjj.zz.jjX.',
    '.ZzzzzzzzzzZ',
]
FOOT_ROLES = ['still', 'rattle', 'bite', 'snap', 'pop']
FOOT_TICKS = [10, 2, 3, 3, 3]


def piece(rows, rx):
    """A grid on a canvas with the selout + outline pass; the root under its plate (feet anchor)."""
    w = max(len(r) for r in rows)
    cv = K.Canvas(w + 4, len(rows) + 4)
    cv.grid(2, 2, [r.replace('W', '.') for r in rows], 0, 'clamp')
    for y, r in enumerate(rows):                 # glints: no outline, no selout
        for x, ch in enumerate(r):
            if ch == 'W':
                cv.px(2 + x, 2 + y, 'W', 5, 'fx')
    return K.finish(cv, (2 + rx, 2 + len(rows) + 1))   # the outline under the plate stands on the floor


def jaw_points(rows, root):
    """The tracked points (smoothness gate): the two arm tips and the disc centre."""
    left = right = None
    for y, r in enumerate(rows):
        xs = [x for x, ch in enumerate(r) if ch in 'JjXx']
        if xs:
            left = left or (min(xs), y)
            right = right or (max(xs), y)
        if 'o' in r:
            disc = (r.index('o'), y)
    return {'tip.l': left, 'tip.r': right, 'disc': disc}


def frame(rows, rx):
    out, root = piece(rows, rx)
    return X.Frame(out, root, joints=jaw_points(out, root))


def build(s):
    K.palette(PAL, dark=DARK, letters=''.join(PAL))
    s.colours = dict(PAL)
    s.strip('clamp', [frame(G[k], 6) for k in CLAMP_ROLES], CLAMP_TICKS, cls='mechanical')
    s.strip('clamp-foot', [frame(F[k], 6) for k in FOOT_ROLES], FOOT_TICKS, cls='mechanical')
    for i, k in enumerate(CLAMP_ROLES):
        s.event('CLAMP_' + k.upper().replace('2', '_B'), i)
    for i, k in enumerate(FOOT_ROLES):
        s.event('CLAMP_FOOT_' + k.upper(), i)
