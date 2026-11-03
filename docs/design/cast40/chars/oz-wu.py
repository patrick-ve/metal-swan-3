# MENEER WU, the owner of the snack bar in the haunted town: a hard-working middle-aged man, black
# hair with grey at the temples, a teal short-sleeved shirt with the sleeves rolled up, a long white
# bib apron, a tea towel with blue stripes over the shoulder, the steel fry scoop. One frame: he
# holds out the paper tray of the meal (fries, mayo, two frikandellen) on his palm, the scoop in the
# other hand, a warm, tired smile. Our own design: a person, drawn with the same care as the heroes.
import castkit as K

INFO = dict(
  name='MENEER WU', mission=['oldenzaal'], role='npc', kind='HUMANOID', face=-1,
  pose='holds out the meal tray on his palm, the fry scoop in the other hand, smiling',
  note='white bib apron to the knee, striped towel on the shoulder, rolled teal sleeves and the '
       'grey temples read at 1x; the tray and the scoop show his job in one glance',
  old='npc/oz-wu/toss#0',
  air=0,
)

K.palette({
  # black hair with a cool sheen; Q = the darkest line tone (brows, pupils, hair shade)
  'A': '#55607a', 'H': '#2b2f3d', 'h': '#1b1d26', 'Q': '#100f15',
  # skin (warm, light-medium)
  'L': '#fbe0c4', 'S': '#eab68e', 's': '#c98b66', 'z': '#8c5541',
  'w': '#fffaf0',
  # teal shirt
  'J': '#4fa69c', 'j': '#2e7b76', 'q': '#1d4f4f',
  # white apron and towel (T t), a fold grey U
  'T': '#f6f6f2', 't': '#c3c7d2',
  # towel stripes (blue)
  'R': '#3f7ccc', 'r': '#25508f',
  # black trousers and shoes
  'P': '#5e616d', 'p': '#40434e', 'o': '#2b2d36', 'O': '#16151a',
  'X': '#4d4b55', 'x': '#2b2d36', 'v': '#16151a',
  # steel scoop (and the grey temples: g, t)
  'G': '#e2e6ef', 'g': '#9297aa', 'n': '#535769', 'N': '#2b2d36',
  # fries and frikandel
  'Y': '#f4c84a', 'V': '#c88a2a', 'C': '#a4502e', 'E': '#66301e',
}, dark={'Y': 'V', 'V': 'E', 'C': 'E', 'E': 'Q'})

# rolled short sleeves: the upper arm is the shirt, the forearm is bare skin
K.pose.RAMP.update({
  'arm': ['J', 'j', 'q', 'Q'], 'armF': ['j', 'q', 'Q', 'Q'],
  'arm2': ['L', 'S', 's', 'z'], 'armF2': ['S', 's', 'z', 'z'],
})
K.rig.DARK.update({'L': 'z', 'S': 'z', 's': 'z'})

# ---------------------------------------------------------------- head (14 x 13, neck (5, 12))
HEAD = K.grid("""
  ....hhHHHh....
  ..hhHAAAHHh...
  .hhHAAHHAAAHh.
  hhHHHHHHHHAHHh
  hhHHHgtHHHSLL.
  hhHHgtsSSQQSL.
  QhhHgzsSSwQSL.
  QhhHszsSSSSSLL
  .QhHssSSSsSSSs
  .QhhsSSSSSSzs.
  ..QhSSSzzzSL..
  ...zsSSSLss...
  ....zsssss....
""")
K.P.HEADS['fwd'] = (HEAD, {'neck': (5, 12)})

# ---------------------------------------------------------------- torso (13 wide): shirt, bib
# apron with its neck strap, the striped towel over the shoulder; the apron skirt hangs below the
# pelvis to the knees (it is part of the upper sprite, so it covers the legs)
TORSO = K.grid("""
  .TtjJJJJtJ...
  TTtjjJJJJtJ..
  TTtjjJJJTTTJ.
  RRrjjjJTTTTTJ
  TTtjjjJTTTTTT
  RRrjjjJTTTTTT
  TTtjjjJtTTTTt
  TtgjjjjtTTTTt
  tgjjjjjjTTTTt
  qqgtttttTTTTt
  .qtTTTTTTTTTt
  .tTTTTTTTtTTt
  .tTTTtTTTtTTt
  .tTTTtTTTtTTt
  .tTTTttTTtTTt
  .tTTTtTTTtTtg
  .ttTTtTTttTtg
  .gttttttttttg
""")
K.P.TORSOS['up'] = (TORSO, {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)})

# ---------------------------------------------------------------- hands
# the tray on the open palm: paper tray (T t), fries (Y V), a dab of mayo (T), two frikandellen
K.P.HANDS['tray'] = (K.grid("""
  ..Y.Y.......
  .YVYVYT.CCCC
  .YYVYTTCCCCE
  tTTTTTTTTTTt
  .tttttttttt.
  ..SSSs......
  ..sSs.......
"""), {'wrist': (2.5, 6)})
# the steel fry scoop full of fries, held by its handle
K.P.HANDS['scoop'] = (K.grid("""
  ..Y.Y.Y.
  ..YVYVYY
  .GGGGGGg
  .gGGGGgn
  ..ggggn.
  SSn.....
  Ss......
"""), {'wrist': (0.5, 5.5)})


def _pat(part, u, v, k, ch):
    """The rolled cuff: a lighter band of the shirt just above the elbow."""
    if part in ('armN', 'armF') and K.pose.UPPER - 1.4 <= u <= K.pose.UPPER + 0.2:
        return (['J', 'J', 'j', 'q'] if part == 'armN' else ['J', 'j', 'q', 'Q'])[k]
    return ch


K.pose.HOOKS['pat'] = _pat


def frame():
    up = K.A.up(torso='up', head='fwd',
                near=K.A.hand((10, 0), 'tray', 'hand', bend=-1),
                far=K.A.hand((6, 9.5), 'scoop', 'hand', z=5))
    lo = K.A.legs((0, -17), (-5, -4), (4, -4))
    return K.humanoid(up, lo)
