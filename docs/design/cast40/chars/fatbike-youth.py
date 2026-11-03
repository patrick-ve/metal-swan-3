# The fatbike youth, look 0 (ams): black cap, red hoodie, black trackpants with a white side stripe,
# white sneakers, on a gold fat-tyre e-bike (long bench seat, battery, a small speaker on the rear
# rack). The frame: his tell, a wheelie with both hands on the riser bar, shouting OI!.
import importlib
import math
import castkit as K

kit = importlib.import_module('chars.delivery-rider_kit')
P, pose = K.P, K.pose

INFO = dict(
    name='FATBIKE YOUTH', mission=['ams'], role='enemy', kind='MACHINE', face=-1,
    pose='pulls a wheelie on the fat-tyre e-bike, shouting OI!',
    note="Reads by the fat knobbly tyres (4 px of rubber, 17-18 px wheels), the chunky gold down tube with a battery block, the speaker box on the rack and the open OI mouth under a black cap. Kept the game's look 0 (black cap, red hoodie); dropped a trackpants stripe (it read as a frame tube).",
    old='enemy/fatbike-youth/tell#2',
)

PAL = {
    'L': '#ffe4cc', 'S': '#f6c39e', 's': '#dc9670', 'z': '#a8522e',      # skin a
    'w': '#fffaf0',
    'Q': '#26150f',                                                      # lines, hair dark
    'H': '#4a3a40', 'h': '#2a2028',                                      # dark hair
    'J': '#f06045', 'j': '#c62f30', 'q': '#861a2e', 'r': '#4a0f1f',      # red hoodie
    'A': '#6c7180', 'P': '#4f5360', 'p': '#3a3d48', 'o': '#282a33', 'O': '#1b1c23',   # black cap, pants, tyres
    'T': '#f8fbff',                                                      # drawstrings
    'a': '#8c93a6', 'b': '#686e80', 'B': '#4b5062',                      # mid-grey trackpants
    'X': '#f8fbff', 'x': '#c9dbea', 'v': '#8694a6',                      # white sneakers
    'G': '#fff184', 'g': '#f6c537', 'n': '#c98c22', 'N': '#8c5a17',      # gold frame
    't': '#a9b0bd',                                                      # rims, speaker cone
}
DARK = {'J': 'r', 'j': 'r', 'q': 'r', 'r': 'r', 'H': 'h', 'h': 'h', 'A': 'o', 'T': 'x',
        'X': 'v', 'x': 'v', 'G': 'n', 'g': 'n', 'n': 'N', 'N': 'N', 't': 'o',
        'a': 'B', 'b': 'B', 'B': 'o'}

# ---------------------------------------------------------------- head (16 x 13, neck (5, 12))
# black cap, peak forward; angry brows, eyes wide, the mouth a big open OI
HEAD = K.grid('''
    .................
    ....ooppppPo.....
    ..oppPPAAPPPPo...
    .oppPPPPPPPPPPp..
    oopppppppppppAAAA
    hhhoooooooooopPPp
    hhhhzsSSQQQSSL..
    QhhhszsSwQSSSL..
    .QhhzssSSSSSSSs.
    .QhhsSSSSSQQQs..
    ..QhsSSSSzQrQ...
    ...QzsSSSSQQs...
    ....zzsSSSsz....
    .....zsz........
''')

# ---------------------------------------------------------------- torso (12 x 13): red hoodie
# the hood bunched behind the neck, drawstrings, the pouch pocket, a ribbed hem
TORSO = K.grid('''
    .qjJq.......
    qjjJJq......
    qjjjJJJJJJ..
    qjjjJJJTJJJ.
    qjjjjJJJTJJJ
    qjjjjJJJJJJJ
    qjjqjjJJJJJJ
    qjjqjjJJJJJj
    qjjjqjqqqqqj
    qjjjqjjJJJJj
    qqjjjqjjjJjq
    Qqjjjjqjjjjq
    .rqqqqqqqqr.
''')
TAN = {'neck': (6, 0), 'pelvis': (6, 11), 'shN': (6.5, 4.5), 'shF': (3.5, 5.0)}

GRIP = (K.grid('''
    SSS
    SSs
    .ss
'''), {'wrist': (0, 1), 'grip': (1.5, 1)})

SHOE = (K.grid('''
    xXXX....
    xXXXXX..
    xXXXXXXX
    vvvvvvvv
'''), {'ankle': (2, 0)})
SHOE_TOE = (K.grid('''
    xXX....
    xXXX...
    xXXXXX.
    .vxXXXX
    ..vvvvv
'''), {'ankle': (1, 0)})


def ribs(part, u, v, k, ch):
    """The hoodie cuff is ribbed (a darker band at the wrist)."""
    if part.startswith('arm') and u > pose.UPPER + pose.FORE - 1.2:
        return ['j', 'q', 'r', 'r'][min(3, k)]
    return ch


def setup():
    K.palette(PAL, dark=DARK)
    P.HEADS['shout'] = (HEAD, {'neck': (5, 12)})
    P.TORSOS['up'] = (TORSO, TAN)
    P.TORSOS['back'] = P.shear(P.TORSOS['up'], -2)
    P.HANDS['grip'] = GRIP
    P.SHOES['flat'] = SHOE
    P.SHOES['toe'] = SHOE_TOE
    pose.RAMP['arm'] = ['J', 'j', 'q', 'r']
    pose.RAMP['armF'] = ['j', 'q', 'r', 'r']
    pose.RAMP['leg'] = ['a', 'b', 'B', 'B']
    pose.RAMP['legF'] = ['b', 'B', 'B', 'o']
    pose.HOOKS['pat'] = ribs


def fat_bike(cv, R, tilt=18.0, crank=0):
    """The compact fat-tyre e-bike, facing right, the front lifted by 'tilt' degrees round the rear
    axle. R = ground point under the bottom bracket of the level bike. Returns the key points."""
    gx, gy = R
    WR = 8.7                                  # 17-18 px wheels
    rear0 = (gx - 13.5, gy - 9)
    th = math.radians(tilt)

    def T(x, y):
        """Bike-local (x forward, y up from the ground under the bottom bracket) -> canvas."""
        dx, dy = gx + x - rear0[0], gy - y - rear0[1]
        return (rear0[0] + dx * math.cos(th) + dy * math.sin(th), rear0[1] - dx * math.sin(th) + dy * math.cos(th))

    rear, front = T(-13.5, 9), T(13.5, 9)
    bb = T(0, 9)
    FR = ['G', 'g', 'n', 'N']
    TY = ['p', 'o', 'O', 'O']
    DK = ['A', 'P', 'o', 'O']

    def tread(x, y, d, a, ch):
        # 4 px of rubber; the outer pixel ring is cut into 11 knobs (notches in the silhouette)
        seg = (a - th + math.pi) / (2 * math.pi) * 33
        knob = int(math.floor(seg)) % 3 != 0
        if d > WR - 0.9:
            return ch if knob else ''
        if d > WR - 1.9 and knob:
            return {'p': 'P', 'o': 'p', 'O': 'o'}[ch]     # the knob faces catch a little light
        return ch

    for c in (rear, front):
        kit.disc(cv, c, WR, TY, 1.0, 'wheel', r_in=4.6, tone=tread)          # the fat tyre
        kit.disc(cv, c, 4.6, ['t', 't', 'A', 'P'], 1.02, 'wheel', r_in=3.4)   # small silver rim
        kit.disc(cv, c, 3.3, ['o', 'O', 'O', 'O'], 1.01, 'wheel')            # dark rim well
        kit.disc(cv, c, 1.3, ['t', 'A', 'P', 'P'], 1.05, 'wheel')            # hub
    # frame: one thick down tube with the battery block, a short seat tube, a chain stay, the fork
    head_lo, head_hi = T(10.5, 18), T(9.5, 22)
    seat = T(-6, 19)
    kit.rod(cv, bb, rear, 0.9, FR, 2.4, 'frame')
    kit.rod(cv, bb, T(-5, 18), 1.1, FR, 2.45, 'frame')
    kit.rod(cv, bb, head_lo, 2.3, FR, 2.5, 'frame')
    kit.poly(cv, [T(3.4, 16.4), T(8.6, 20.6), T(10.0, 18.6), T(4.8, 14.4)], 'P', 2.55, 'battery')
    kit.line(cv, T(3.8, 16.6), T(8.4, 20.3), 'A', 2.56, 'battery')
    kit.line(cv, T(5.2, 14.6), T(9.8, 18.4), 'o', 2.56, 'battery')
    kit.rod(cv, head_lo, head_hi, 1.3, FR, 2.5, 'frame')
    kit.rod(cv, head_lo, front, 1.2, FR, 2.45, 'frame')
    kit.disc(cv, T(12.5, 19.5), 1.2, ['X', 'X', 'x', 'v'], 2.7, 'lamp')
    # bench seat; behind it the rack with the speaker box (a gap between them)
    kit.rod(cv, T(-10, 20.5), T(-3, 21), 1.2, DK, 2.7, 'seat')
    kit.rod(cv, T(-12, 18), rear, 0.6, ['P', 'o', 'O', 'O'], 2.2, 'rack')
    kit.poly(cv, [T(-19.5, 18), T(-13.5, 18), T(-13.5, 23.5), T(-19.5, 23.5)], 'p', 2.35, 'speaker')
    kit.poly(cv, [T(-19.5, 23), T(-13.5, 23), T(-13.5, 23.5), T(-19.5, 23.5)], 'A', 2.36, 'speaker')
    kit.disc(cv, T(-16.5, 20.6), 1.7, ['t', 'P', 'O', 'O'], 2.37, 'speaker')
    kit.disc(cv, T(-16.5, 20.6), 0.6, ['O', 'O', 'O', 'O'], 2.38, 'speaker')
    # riser bar
    stem = T(8.5, 27)
    kit.rod(cv, head_hi, stem, 0.7, DK, 2.6, 'bar')
    grip = T(5.5, 27.5)
    kit.rod(cv, stem, grip, 0.7, DK, 2.6, 'bar')
    # cranks
    a = math.radians(crank - tilt)
    pn = (bb[0] + 4 * math.cos(a), bb[1] + 4 * math.sin(a))
    pf = (bb[0] - 4 * math.cos(a), bb[1] - 4 * math.sin(a))
    kit.disc(cv, bb, 2.2, ['t', 'P', 'o', 'O'], 2.8, 'ring')
    kit.rod(cv, bb, pf, 0.6, ['P', 'o', 'O', 'O'], 1.6, 'crankF')
    kit.rod(cv, bb, pn, 0.6, ['t', 'P', 'o', 'O'], 3.5, 'crankN')
    for p, z in ((pf, 1.7), (pn, 3.6)):
        kit.grid(cv, round(p[0]) - 1, round(p[1]), ['OOO'], z, 'pedal')
    return dict(seat=seat, grip=grip, pn=pn, pf=pf)


def frame():
    setup()
    cv = kit.canvas(110, 90)
    R = (57, 84)
    b = fat_bike(cv, R, tilt=18, crank=100)
    pel = (b['seat'][0] + 0, b['seat'][1] - 1.5)
    legs = {
        'legN': (kit.foot_on(b['pn']), 'flat', 1),
        'legF': (kit.foot_on(b['pf']), 'toe', 1),
    }
    arms = {
        'armF': ((b['grip'][0] + 1, b['grip'][1]), ('hand', 'grip'), -1),
        'armN': (b['grip'], ('hand', 'grip'), -1),
    }
    kit.rider(cv, pel, 'back', 'shout', legs, arms, hd=(-1, 0), tor=(-3, 0))
    return kit.finish(cv, R)
