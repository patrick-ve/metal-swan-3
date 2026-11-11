# THE GUIDE (enemy/stag-beer-bike): the sober guide who pedals and steers the stag party's beer bike
# at 40 px (plan docs/design/ams40.md wave 3). The approved look is the cast spike's sample
# (docs/design/cast40/chars/beer-bike.py): red cap and red polo, black trousers and shoes.
#
# driver       12 frames: one turn of the cranks (locomotion class, pedalling). The code picks the
#              frame by the distance the bike rolled (PEDAL_PX px a frame: one crank turn per
#              PEDAL_FRAMES * PEDAL_PX = 24 px, 40 ticks at the enemy's 0.6 px/tick), so the feet
#              keep pace with the bike; a stopped bike keeps its frame. The anchor is the floor
#              under his saddle (the bike draws him at BEER_BIKE.driver x, the bike's floor y): the
#              hip 18 px over it on the saddle, the hands on the grips (geometry.ts bar), the feet on
#              the pedals round the hub ahead of the saddle (+4, -7), crank radius 3. He pushes on
#              each down-stroke: the torso dips 1 px and the head nods a frame later.
# driver-flee  12 frames: the run he leaves on (`MIJN FIETS!`: a tumble fx, beer-bike.ts
#              driverRuns), arms flailing over his cap, mouth open; feet anchor.
# Points (contract): hand (the near hand), head (the head's middle), hip on every frame.
import math

import art40 as X
import castkit as K

bike = X.char('beer-bike')
T = bike.kit
P, pose, A = K.P, K.pose, K.A

SET = X.Set(prefix='enemy/stag-beer-bike', budget=28, face=1, outline='K', hl='w')

PAL = {
    'K': '#140c0e',
    'J': '#f06045', 'j': '#c62f30', 'q': '#861a2e', 'r': '#4a0f1f',      # red cap and polo
    'A': '#7a8090', 'P': '#4f5360', 'o': '#2f323c', 'O': '#1b1c23',      # black trousers, shoes, cranks
    't': '#c9d0da',                                                      # steel glint (cranks)
    'L': '#ffe4cc', 'S': '#f6c39e', 's': '#dc9670', 'z': '#a8522e',      # skin
    'Q': '#26150f',                                                      # hair, brows, lines
    'w': '#fff4dc',                                                      # eye white, teeth
}
DARK = {'J': 'q', 'j': 'r', 'q': 'r', 'r': 'r', 'A': 'o', 'P': 'o', 'o': 'O', 'O': 'O', 't': 'A',
        'L': 'z', 'S': 'z', 's': 'z', 'z': 'z', 'Q': 'Q', 'w': 's'}

PEDAL_FRAMES = 12
PEDAL_PX = 2              # px of roll a frame: one crank turn per 24 px
SEAT_HIP = 18
HUB = (4, -7)             # body.py DRIVER_HUB: ahead of the saddle, clear of the front wheel
CRANK_R = 3.0
GRIP = (12, -25)          # the near grip (beer-bike body.py BAR (35, -25) - driver (22, 0) - 1)
FLEE_TPF = 2

HEAD = K.grid('''
    .................
    ....qjjjjJq......
    ..qjjJJJJJJjq....
    .qjjjJJJJJJJJj...
    qqjjjjjjjjjjjJJJJ
    QQqqqqqqqqqqqjjjr
    QQQQzsSSSQQSSL...
    QQQszsSSwQSSSL...
    .QQQzssSSSSSSSs..
    .QQQsSSSSSSSSs...
    ..QQsSSSSSzzzs...
    ...QzsSSSSSSs....
    ....zzsSSSsz.....
    .....zsz.........
''')
# panic: brows up, eye wide, the mouth open (MIJN FIETS!)
HEAD_PANIC = K.grid('''
    .................
    ....qjjjjJq......
    ..qjjJJJJJJjq....
    .qjjjJJJJJJJJj...
    qqjjjjjjjjjjjJJJJ
    QQqqqqqqqqqqqjjjr
    QQQQzsSSQQSSSL...
    QQQszsSwwQSSSL...
    .QQQzssSwwSSSSs..
    .QQQsSSSSSSzzs...
    ..QQsSSSSzrrrz...
    ...QzsSSSzrrz....
    ....zzsSSSsz.....
    .....zsz.........
''')
TORSO = K.grid('''
    .qjjJJqqJJ..
    qjjjJJJqwJ..
    qjjjJJJJqJJ.
    qjjjjJJJwJJJ
    qjjqjjJJJJJJ
    qjjqjjjJJJJJ
    qjjjqjjjJJJj
    qqjjjqjjjJjj
    Qqjjjjqjjjjq
    .AAAAAAAAAA.
''')
TAN = {'neck': (6, -2), 'pelvis': (6, 8), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}
FIST = (K.grid('''
    SSS
    SSs
    .ss
'''), {'wrist': (0, 1), 'grip': (1.5, 1)})
OPEN = (K.grid('''
    .S.S
    SSSS
    SSSs
    .ss.
'''), {'wrist': (0, 3), 'grip': (1.5, 2)})
SHOE = (K.grid('''
    oooo....
    oooAAo..
    oooooAAo
    OOOOOOOO
'''), {'ankle': (2, 0)})


def setup():
    K.palette(PAL, dark=DARK, letters=''.join(k for k in PAL if k != 'K'))
    P.HEADS['drv'] = (HEAD, {'neck': (5, 12)})
    P.HEADS['drvp'] = (HEAD_PANIC, {'neck': (5, 12)})
    P.TORSOS['drv'] = P.shear((TORSO, TAN), 3)
    P.TORSOS['drvu'] = P.shear((TORSO, TAN), 1)
    P.HANDS['grip'] = FIST
    P.HANDS['wave'] = OPEN
    for k in list(P.SHOES):
        P.SHOES[k] = SHOE
    R = pose.RAMP
    R['arm'], R['armF'] = ['J', 'j', 'q', 'r'], ['j', 'q', 'r', 'r']
    R['arm2'], R['armF2'] = ['S', 'S', 's', 'z'], ['s', 's', 'z', 'z']
    R['leg'], R['legF'] = ['A', 'P', 'o', 'O'], ['P', 'o', 'O', 'O']
    R.pop('leg2', None)
    R.pop('legF2', None)


def pts_of(j, rx, ry, head):
    """The contract points (hand, head, hip) and every joint, in rows coordinates."""
    hd = j['head']['neck']
    return {'hand': j['armN']['wrist'], 'head': (hd[0] + 1, hd[1] - 7), 'hip': j['pel']}


def pedal_frame(i):
    """Frame i of the crank turn (clockwise on screen: the bike rolls to the right)."""
    cv = K.Canvas(48, 64)
    rx, ry = 20, 58                                   # the anchor (the floor under the saddle)
    th = 2 * math.pi * i / PEDAL_FRAMES + math.radians(-20)
    hub = (rx + HUB[0], ry + HUB[1])
    pn = (hub[0] + CRANK_R * math.cos(th), hub[1] + CRANK_R * math.sin(th))
    pf = (hub[0] - CRANK_R * math.cos(th), hub[1] - CRANK_R * math.sin(th))
    # the push: the torso dips on each down-stroke (twice a turn), the head nods a frame later
    dip = 1 if math.sin(2 * th + 0.6) > 0.35 else 0
    nod = 1 if math.sin(2 * (th - 2 * math.pi / PEDAL_FRAMES) + 0.6) > 0.35 else 0
    pel = (rx, ry - SEAT_HIP)
    # the cranks, the pedals, the chain ring
    cv.tube(hub, pf, 0.5, 0.5, ['P', 'o', 'O', 'O'], 1.5, 'crankF', cut=(0.62, 0.2, -0.2))
    for x in (-1, 0, 1):
        cv.px(round(pf[0]) + x, round(pf[1]), 'o', 1.6, 'pedalF')
    j = T.rider(cv, pel, 'drv', 'drv', {
        'legN': (T.foot_on(pn), 'flat', 1), 'legF': (T.foot_on(pf), 'flat', 1),
    }, {
        'armN': ((rx + GRIP[0], ry + GRIP[1] + dip * 0), ('hand', 'grip'), -1),
        'armF': ((rx + GRIP[0] + 1, ry + GRIP[1]), ('hand', 'grip'), -1),
    }, z=0.5, tor=(-2, dip), hd=(1, nod - dip))
    for a in range(12):                                # the chain ring (near side)
        ang = a * math.pi / 6
        x, y = hub[0] + 2.2 * math.cos(ang), hub[1] + 2.2 * math.sin(ang)
        cv.px(round(x), round(y), 'A' if math.cos(ang) * 0.55 - math.sin(ang) * 0.83 > 0 else 'P', 3.4, 'ring')
    cv.px(hub[0], hub[1], 't', 3.45, 'ring')
    cv.tube(hub, pn, 0.55, 0.55, ['t', 'A', 'P', 'o'], 3.6, 'crankN', cut=(0.62, 0.2, -0.2))
    for x in (-1, 0, 1):
        cv.px(round(pn[0]) + x, round(pn[1]), 'O', 3.55, 'pedalN')
    rows = cv.finish()
    jj = T.joints(j)
    jj['pedalN'], jj['pedalF'] = pn, pf
    return X.Frame(rows, (rx, ry), pts=pts_of(j, rx, ry, 'drv'), joints=jj)


def flee_frame(i):
    """Frame i of the panicked run: the rig's 12-frame run legs, arms flailing over the cap."""
    ph = i / 12
    s = math.sin(2 * math.pi * ph)
    c = math.cos(2 * math.pi * ph)
    # the near arm pumps wildly at chest height (never over the face); the far arm waves high
    # behind his head, the open hand shaking over the back of the cap
    near = A.hand((5 + 4 * s, 1 - 2 * c), kind='grip', lib='hand', bend=-1)
    far = A.hand((-6 - 2 * s, -9 - 2 * c), kind='wave', lib='hand', bend=1)
    bob = 1 if (i % 6) in (1, 2) else 0
    up = A.up(torso='drvu', head='drvp', tor=(0, 0), hd=(0 if i % 6 < 3 else -1, bob), near=near, far=far)
    rows, root, j = X.humanoid(up, A.run_lower(i))
    pts = {'hand': j['armN.wrist'], 'head': (j['head.neck'][0] + 1, j['head.neck'][1] - 7), 'hip': j['pel']}
    return X.Frame(rows, root, pts=pts, joints=j)


def build(s):
    s.colours = dict(PAL)
    setup()
    s.strip('driver', [pedal_frame(i) for i in range(PEDAL_FRAMES)], 3, cls='locomotion')
    s.strip('driver-flee', [flee_frame(i) for i in range(12)], FLEE_TPF, cls='locomotion', defer=True)
    s.event('PEDAL_FRAMES', PEDAL_FRAMES)
    s.event('PEDAL_PX', PEDAL_PX)
    s.event('DRIVER_HIP', SEAT_HIP)
