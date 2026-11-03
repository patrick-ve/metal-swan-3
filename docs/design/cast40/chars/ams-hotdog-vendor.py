# The hot-dog vendor on the Museumplein (ams): a heavy, friendly man in a red-white-blue striped cap,
# a sky-blue shirt, a white waist apron with a mustard smear, slate trousers, black boots and a big
# moustache. The salute that goes with "HOWDY, SOLDIER!": elbow out front, the flat hand at the peak.
# Heavy = wider, not taller: a broader torso with a belly, thicker limb tubes, wider hips.
# Facing right while drawn; cast.py mirrors him (face=-1).
import castkit as K

INFO = dict(
    name='HOT-DOG VENDOR', mission=['ams'], role='npc', kind='HUMANOID', face=-1,
    pose='the salute: elbow out front, the flat hand at the cap peak, a broad smile',
    note='Heavy build (wider torso and belly, thick arms and legs, same height), the tricolour cap '
         '(red crown, white band, blue peak), a bushy moustache, the white apron with a mustard smear; '
         'the forearm passes behind the face so the eye and the moustache stay clear.',
    old='npc/ams/ams-hotdog-vendor/salute#0', air=0,
)

PAL = {
    # dark brown hair, brows and the big moustache; the belt shares the browns
    'A': '#8a5c3c', 'H': '#5a3622', 'h': '#38200f', 'Q': '#1e120c',
    # ruddy skin
    'L': '#ffe0c6', 'S': '#f2ae8a', 's': '#d68468', 'z': '#94483a', 'w': '#fffaf0',
    # sky-blue shirt (J lit, j mid, q shade); T / t = the cuffs of the stock hand parts
    'J': '#a8d8f4', 'j': '#6ea8da', 'q': '#3e70a6', 'T': '#a8d8f4', 't': '#3e70a6',
    # cap: red crown (C E U), white band (a k), blue band and peak (R r)
    'C': '#ee5450', 'E': '#c02c36', 'U': '#721a26',
    'R': '#4058a0', 'r': '#242f62',
    # white apron (a lit, k mid, l shade) and the mustard smear (Y V)
    'a': '#fbf8f0', 'k': '#d8d4ce', 'l': '#a8a4ac',
    'Y': '#f2c430', 'V': '#b8861c',
    # slate trousers, black boots
    'P': '#7c8494', 'p': '#5a6274', 'o': '#3e4456', 'O': '#242f62',
    'X': '#4a4652', 'x': '#2c2a33', 'v': '#1b1a20',
}
DARK = {'J': 'q', 'j': 'q', 'q': 'q', 'T': 't', 't': 't', 'C': 'U', 'E': 'U', 'U': 'U', 'R': 'r',
        'r': 'r', 'a': 'l', 'k': 'l', 'l': 'l', 'Y': 'V', 'V': 'V'}

# head 18 x 15, neck at (6, 14): the striped cap with its peak out front, a bushy brow, a big nose,
# the big moustache with curled tips, a broad smile, a heavy jaw
HEAD = K.grid("""
    .......UEEEEU.....
    .....UECCCCCCEU...
    ....UECCCCCCCCCE..
    ...lkkaaaaaaaaaaak
    ..hrrrRRRRRRRRRRRRRR
    ..hhHHHsSSSShhhhSS.
    .QhHHHsSSSSSwQQSSL.
    .QhHHszsSSSSSSSSSLL
    ..QhHzsSSSSHHHAAHHs
    ..QhssSSSSHHHHHHHHH
    ...QzsSSSSHhSzzzhSH
    ...QzsSSSSSSzwwwzs.
    ....zzzssssszzzs...
""")
NECK = {'neck': (6, 12)}

# a broad torso with a belly: the sky shirt with a placket, a brown belt with a brass buckle
TORSO = K.grid("""
    ..qjjJJJJJJJ....
    .qjjjJJJJJJJJ...
    qjjjjJJJJJJJJJ..
    qjjjjJJJJJJJqJJ.
    qjjqjjJJJJJJJqJ.
    qjjqjjJJJJJJJqJJ
    qjjjqjjJJJJJJJqJ
    qjjjqjjjJJJJJJqJ
    qqjjjqjjjJJJJqJj
    qqjjjjqjjjjJJqjj
    hHHHHHHHHHHHYVHh
    .hhhhhhhhhhhhhh.
""")
TAN = {'neck': (7, -2), 'pelvis': (7, 10), 'shN': (8, 2.5), 'shF': (4.5, 3.0)}

# the white waist apron to mid thigh, lit at the front, a mustard smear, a shaded hem
APRON = K.grid("""
    lkkkaaaaaaaaa
    lkkkaaaaaaaaa
    lkkkkaaaaaaaa
    lkkkkaaaYVaaa
    lkkkkaaaaYaaa
    llkkkkaaaaaaa
    llkkkkkaaaaak
    .lllllllllkkk
""")
APRON_AT = (-6, 0)
SALUTE_K = 0.8


def _apron(cv, X, p, layer, meta):
    if layer not in ('lower', 'full'):
        return
    px, py = meta['pel']
    cv.grid(int(round(px + APRON_AT[0])), int(round(py + APRON_AT[1])), APRON, 3.6, 'apron')


# the salute hand: flat, fingers to the back over the peak, the wrist low at the front
SALUTE = (K.grid("""
    SS....
    LSS...
    .sSS..
    ..sSS.
    ...sSS
"""), {'wrist': (4.5, 4.5)})


def frame():
    K.palette(PAL, dark=DARK)
    K.P.HEADS['fwd'] = (HEAD, NECK)
    K.P.TORSOS['up'] = (TORSO, TAN)
    K.P.HANDS['salute'] = SALUTE
    K.pose.RAMP['arm'] = ['J', 'J', 'j', 'q']
    K.pose.RAMP['armF'] = ['j', 'j', 'q', 'q']
    K.pose.CUT['arm'] = (0.62, 0.30, 0.04)
    K.pose.HOOKS['post'] = _apron
    # heavy build: every limb tube a quarter thicker
    tube = K.pose.tube

    def fat(cv, X, a, b, ra, rb, ramp, z, part, cut, u0=0.0):
        k = SALUTE_K if part == 'armN' else 1.25     # the saluting arm is narrowed to keep the face clear
        return tube(cv, X, a, b, ra * k, rb * k, ramp, z, part, cut, u0)
    K.pose.tube = fat
    # salute: the upper arm forward from the shoulder, the forearm up behind the face (z 4.5: in front
    # of the torso, behind the head), the flat hand drawn over the peak
    K.pose.UPPER, K.pose.FORE = 7.0, 6.5     # the NPC arm length (the crew uses it too)
    upper = K.A.up(near=K.A.hand((9, -7.5), 'salute', 'hand', bend=-1, sh=(3, -1)),
                   far=K.A.hand((2, 7.5), 'inside', 'hand', bend=-1))
    lower = dict(pelvis=(0, -17), legF=dict(ank=(-6, -4), hip=(-3, 0), shoe='flat', bend=1),
                 legN=dict(ank=(6, -4), hip=(3, 0), shoe='flat', bend=1))
    return K.humanoid(upper, lower)
