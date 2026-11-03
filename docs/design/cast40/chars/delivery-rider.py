# The meal-delivery courier on his city bike (ams; a stand-in in oat): riding hard, the near thumb
# on the bell (TRING TRING), the near pedal down. Slate jacket with green trim, black helmet, the
# big green cube backpack with a plain burger shape, a stone-grey city bike.
import importlib
import math
import castkit as K

kit = importlib.import_module('chars.delivery-rider_kit')
P, pose = K.P, K.pose

INFO = dict(
    name='DELIVERY RIDER', mission=['ams', 'oat'], role='enemy', kind='MACHINE', face=-1,
    pose='rides hard, the near thumb ringing the bell (TRING TRING), the near pedal down',
    note='Reads by the big green cube with a plain burger, the black helmet and the slate jacket with green collar and cuffs; the gloved thumb on a chrome bell with ring marks. Changed: the green trim sits on the collar and cuffs (the arm hides the zip); no phone on the bar.',
    old='enemy/delivery-rider/tell#1',
)

PAL = {
    'L': '#f2c995', 'S': '#d9a36e', 's': '#b07d55', 'z': '#85583c',      # skin b
    'w': '#fffaf0',
    'Q': '#1c1f2b',                                                      # lines, deepest slate
    'J': '#7d8aa0', 'j': '#58657a', 'q': '#3b4457',                      # slate jacket
    'A': '#6c7180', 'P': '#4f5360', 'p': '#3a3d48', 'o': '#282a33', 'O': '#1b1c23',   # black gear
    'C': '#93c94f', 'E': '#529a38', 'U': '#2f6d2f', 'V': '#1b4529',      # green trim + cube
    'G': '#beb1a2', 'g': '#8e827a', 'n': '#635857', 'N': '#3d3437',      # stone bike frame
    'T': '#eef1f5', 't': '#a9b0bd',                                      # chrome (bell, rims)
    'Y': '#f6c537', 'Z': '#c98c22',                                      # burger bun
    'H': '#4f5360', 'h': '#282a33',                                      # helmet = black gear
    'X': '#4f5360', 'x': '#282a33', 'v': '#1b1c23',                      # shoes
}
DARK = {'C': 'U', 'E': 'U', 'U': 'V', 'V': 'V', 'G': 'n', 'g': 'n', 'n': 'N', 'N': 'N', 'T': 't',
        't': 'n', 'Y': 'Z', 'Z': 'z', 'A': 'h', 'H': 'h', 'h': 'h', 'J': 'Q', 'j': 'Q', 'q': 'Q'}

# ---------------------------------------------------------------- head (14 x 13, neck (5, 12))
# black bike helmet with a lit dome and two vents, a peak over the brow; the strap runs under the ear
HEAD = K.grid('''
    ....hhHHHHh...
    ..hhHHAAAAHH..
    .hHHhAAAHAAHH.
    hHHHHhHHHhHHHH
    hhHHHHHHHHHHHHh
    hhhhhhhhhhhhhhh
    .hhhzsSSSQQQS.
    .hhhszsSSwQSSL
    ..hhzsSSSSSSSs
    ...hhsSSSSSss.
    ....hsSSzQQQs.
    .....hsSSSSs..
    ......zssssz..
    .....hzsz.....
''')
SHOUT = K.grid('''
    ....hhHHHHh...
    ..hhHHAAAAHH..
    .hHHhAAAHAAHH.
    hHHHHhHHHhHHHH
    hhHHHHHHHHHHHHh
    hhhhhhhhhhhhhhh
    .hhhzsSSQQQSS.
    .hhhszsSSwQSSL
    ..hhzsSSSSSSSs
    ...hhsSSSzzzs.
    ....hsSSzwwwQ.
    .....hsSSQQQ..
    ......zssssz..
    .....hzsz.....
''')

# ---------------------------------------------------------------- torso (12 x 11): slate jacket
# green collar, green piping down the zip, the jacket hem
TORSO = K.grid('''
    .qjjJECCCCC.
    qjjjJJEECJJ.
    qjjjjJJJJEJJ
    qjjjjjJJJEJJ
    qjjqjjJJJEJJ
    qjjqjjjJJEJJ
    qjjjqjjjJEJj
    qjjjqjjjJEJj
    qqjjjqjjjEjq
    Qqjjjjqjjjjq
    .QqqqqqqqqQ.
''')
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

# gloved fists: round a grip, and with the thumb up on the bell lever
GRIP = (K.grid('''
    PPP
    PPp
    .op
'''), {'wrist': (0, 1), 'grip': (1.5, 1)})
THUMB = (K.grid('''
    ...A
    PPPp
    PPp.
    .op.
'''), {'wrist': (0, 1.5), 'grip': (1.5, 2)})

SHOE = (K.grid('''
    xxxx....
    xxxXXx..
    xxxxxXXx
    vvvvvvvv
'''), {'ankle': (2, 0)})
SHOE_TOE = (K.grid('''
    xxx....
    xxxX...
    xxxxXx.
    .vxxxXx
    ..vvvvv
'''), {'ankle': (1, 0)})

# the green cube backpack (13 x 13): lit top face, the side with a plain burger shape, straps
CUBE = K.grid('''
    ..CCCCCCCCCCC
    .CCCCCCCCCCCE
    EEEEEEEEEEEEU
    EEEEEEEEEEEEU
    EEEUUUUUUEEEU
    EEUZYYYYZUEEU
    EEUCECECCUEEU
    EEUzzzzzzUEEU
    EEUZZYYZZUEEU
    EEEUUUUUUEEEU
    EEEEEEEEEEEEU
    EEEEEEEEEEEUU
    UUUUUUUUUUUV.
''')


def setup():
    K.palette(PAL, dark=DARK)
    P.HEADS['fwd'] = (HEAD, {'neck': (5, 12)})
    P.HEADS['shout'] = (SHOUT, {'neck': (5, 12)})
    P.TORSOS['up'] = (TORSO, TAN)
    P.TORSOS['lean'] = P.shear(P.TORSOS['up'], 4)
    P.HANDS['grip'] = GRIP
    P.HANDS['thumb'] = THUMB
    P.SHOES['flat'] = SHOE
    P.SHOES['toe'] = SHOE_TOE
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    pose.HOOKS['pat'] = cuff


def cuff(part, u, v, k, ch):
    """The green trim: a band round each jacket cuff."""
    if part.startswith('arm') and u > pose.UPPER + pose.FORE - 1.6:
        return ['C', 'E', 'U', 'V'][min(3, k + (1 if part.endswith('F') else 0))]
    return ch


def city_bike(cv, R, crank=112):
    """The city bike, facing right. R = ground point under the bottom bracket. Returns the key
    points (saddle, grips, pedals)."""
    gx, gy = R
    wy = gy - 8                          # wheel centres (15 px wheels)
    rear, front = (gx - 13, wy), (gx + 14, wy)
    bb = (gx, wy + 0.5)
    seat = (gx - 7, gy - 19)             # top of the seat tube
    head_lo, head_hi = (gx + 11, gy - 15), (gx + 10, gy - 19)
    FR = ['G', 'g', 'n', 'n']
    TY = ['P', 'p', 'o', 'O']
    for c, z in ((rear, 1.0), (front, 1.0)):
        kit.hole(cv, c, 5.6, 0.5, 'wheel')
        kit.disc(cv, c, 7.4, TY, z, 'wheel', r_in=5.6)           # tyre
        kit.disc(cv, c, 5.6, ['T', 't', 'g', 'n'], z, 'wheel', r_in=4.7)   # rim
        for a in (0.4, 1.45, 2.5):                                # three spokes, suggested
            dx, dy = 4.6 * math.cos(a), 4.6 * math.sin(a)
            kit.line(cv, (c[0] - dx, c[1] - dy), (c[0] + dx, c[1] + dy), 'g', z - 0.1, 'wheel')
        kit.disc(cv, c, 1.2, ['T', 't', 'n', 'n'], z + 0.05, 'wheel')
    # frame: chain stay, seat stay, seat tube, top tube (a low step-through), down tube, fork
    kit.rod(cv, bb, rear, 0.75, FR, 2.4, 'frame')
    kit.rod(cv, seat, rear, 0.75, FR, 2.4, 'frame')
    kit.rod(cv, bb, seat, 0.95, FR, 2.5, 'frame')
    kit.rod(cv, bb, head_lo, 1.0, FR, 2.5, 'frame')
    kit.rod(cv, (gx - 3.5, gy - 16), head_hi, 0.8, FR, 2.5, 'frame')
    kit.rod(cv, head_hi, front, 0.8, FR, 2.45, 'frame')
    # rear rack
    kit.rod(cv, (gx - 18, gy - 16), (gx - 6, gy - 16), 0.6, ['g', 'n', 'N', 'N'], 2.3, 'rack')
    kit.line(cv, (gx - 17, gy - 16), rear, 'n', 2.2, 'rack')
    # stem and swept-back bar
    stem = (gx + 9, gy - 23)
    kit.rod(cv, head_hi, stem, 0.7, ['T', 't', 'n', 'n'], 2.6, 'bar')
    kit.rod(cv, stem, (gx + 6, gy - 23.5), 0.7, ['T', 't', 'n', 'n'], 2.6, 'bar')
    grip = (gx + 5.5, gy - 23.5)
    # the bell on the bar, in front of the near grip
    kit.grid(cv, gx + 7, gy - 26, '''
        .TT.
        TTtt
        ''', 7.4, 'bell')
    # saddle
    kit.grid(cv, seat[0] - 3, seat[1] - 2, '''
        .ooooA.
        oooopPA
        ..oo...
        ''', 2.7, 'saddle')
    # cranks and chainring
    a = math.radians(crank)
    pn = (bb[0] + 4 * math.cos(a), bb[1] + 4 * math.sin(a))
    pf = (bb[0] - 4 * math.cos(a), bb[1] - 4 * math.sin(a))
    kit.disc(cv, bb, 2.4, ['t', 'g', 'n', 'N'], 2.8, 'ring')
    kit.line(cv, (bb[0], bb[1] - 2.3), (rear[0] + 1, rear[1] - 1.5), 'N', 2.35, 'chain')
    kit.rod(cv, bb, pf, 0.6, ['g', 'n', 'N', 'N'], 1.6, 'crankF')
    kit.rod(cv, bb, pn, 0.6, ['t', 'g', 'n', 'N'], 3.5, 'crankN')
    for p, z in ((pf, 1.7), (pn, 3.6)):
        kit.grid(cv, round(p[0]) - 1, round(p[1]), ['NNN'], z, 'pedal')
    return dict(seat=seat, grip=grip, bell=(gx + 8, gy - 25), pn=pn, pf=pf)


def cube_back(cv, out):
    an = out['torso']
    # the cube rides high on the back, its front edge on the shoulder blades
    x0 = round(an['shF'][0]) - 13
    y0 = round(an['neck'][1]) + 1
    kit.grid(cv, x0, y0, CUBE, 4.4, 'cube')
    # the near shoulder strap over the jacket
    kit.line(cv, (an['shF'][0] - 1, an['shF'][1] - 1), (an['shF'][0] + 1, an['shF'][1] + 5), 'o', 5.5, 'torso:strap')


def frame():
    setup()
    cv = kit.canvas(110, 90)
    R = (55, 84)
    b = city_bike(cv, R, crank=70)
    pel = (b['seat'][0] + 1, b['seat'][1] - 1)
    legs = {
        'legN': (kit.foot_on(b['pn']), 'flat', 1),
        'legF': (kit.foot_on(b['pf']), 'toe', 1),
    }
    arms = {
        'armF': (b['grip'], ('hand', 'grip'), -1),
        'armN': ((b['grip'][0] + 0.5, b['grip'][1] - 0.5), ('hand', 'thumb'), -1),
    }
    kit.rider(cv, pel, 'lean', 'shout', legs, arms, hd=(1, 0), back=cube_back)
    bx, by = b['bell']
    fx = [(bx + 3, by - 3, 'y'), (bx + 4, by - 2, 'y'), (bx + 5, by - 1, 'y'),
          (bx + 2, by - 5, 'y'), (bx + 3, by - 6, 'y'), (bx + 5, by - 5, 'y'), (bx + 6, by - 4, 'y')]
    return kit.finish(cv, R, fx)
