# MEVROUW WINKEL, the ghost of the haunted town: a middle-aged woman, dark grey hair pinned up in a
# bun, an old-fashioned long dark dress with a high collar, a pale shawl, an old iron lantern with a
# green flame. She floats; no feet, the skirt thins into a trail of mist. See-through ('#rrggbbaa'),
# but with a solid enough core and the outline so she reads at 1x. One frame: she glides at the
# hero, the lantern held out, the other hand a claw, the mouth wide open in a shriek.
import castkit as K

INFO = dict(
  name='MEVROUW WINKEL', mission=['oldenzaal'], role='npc', kind='HUMANOID', face=-1,
  pose='glides at the hero, the lantern held out, a claw raised, shrieking',
  note='see-through dark dress and pale shawl over a solid outline; the bun, the high collar and the '
       'green lantern flame read at 1x; the skirt thins into mist instead of feet',
  old='npc/oz-winkel/glide#1',
  air=6,
)

K.palette({
  # dark grey hair (cold ghost tint); Q = the darkest line tone (sockets, mouth, brows)
  'A': '#8f9b9de0', 'H': '#616d72e0', 'h': '#3e4a50e0', 'Q': '#141c1ef0',
  # pale ghost skin (a cold green-white)
  'L': '#f4fff6ee', 'S': '#cfe6d8ee', 's': '#98b8a8ea', 'z': '#5c7e72ea',
  'w': '#e8fff0',                                     # the glowing eyes
  # the long dark dress (a cold violet-grey near-black)
  'J': '#4c5a68c8', 'j': '#303a48c8', 'q': '#1c2230d0',
  # the lower skirt, fading out
  'a': '#4c5a6890', 'k': '#303a4890', 'l': '#1c223098',
  # the pale shawl
  'T': '#b8d2c4c4', 't': '#7c9a8ec4',
  # the iron lantern (opaque)
  'G': '#b8bea4', 'g': '#7c826c', 'n': '#464a3e', 'N': '#262820',
  # the green flame and its glow (fx: no outline)
  'Y': '#f2ffe0', 'V': '#86f5a0', 'C': '#2fcf74', 'E': '#5ef0a05c',
  # the mist trail (fx)
  'U': '#9cd8c070', 'Z': '#78b8a448',
}, dark={'a': 'l', 'k': 'l', 'l': 'l', 'T': 't', 't': 'q', 'J': 'q', 'j': 'q', 'q': 'Q', 'G': 'N', 'g': 'N', 'n': 'N', 'N': 'Q',
         'Y': 'C', 'V': 'C', 'C': 'C', 'E': 'E', 'U': 'Z', 'Z': 'Z'})

K.pose.RAMP.update({'arm': ['J', 'j', 'q', 'Q'], 'armF': ['j', 'q', 'Q', 'Q']})
K.pose.CUT.update({'arm': (0.62, 0.30, 0.04)})

# ---------------------------------------------------------------- head (14 x 13, neck (5, 12))
HEAD = K.grid("""
  .hHHh.........
  hHAAHh........
  hHAHHhhHHHh...
  .hhhHHAAAAHHh.
  ...hHAHHHAHHHh
  ...hHHHHHHHSLL
  ...hHHHsSQQQSL
  ...QhHszSQwQSL
  ...QhHzsSSzSSL
  ....QhsSSSSSSL
  .....hsSSzQQQ.
  .....zsSQQQQQ.
  ......zSSQQQz.
  .......zsSs...
""")

# ---------------------------------------------------------------- bodice (12 x 12), high collar,
# the shawl over the shoulders crossing in front, a brooch at the collar
BODICE = K.grid("""
  .....jJJG...
  ....jjJJJ...
  ..TTTTTtTTT.
  .TTTTTTTtTTT
  tTTttTTTTtTt
  tTtjjtTTTtt.
  .tjjjjJtTt..
  .qjjjjJJJt..
  .qjjjjjJJJ..
  .qqjjjjjJJ..
  .qqjjjjjJJJ.
  ..qqjjjjjJJ.
""")

# ---------------------------------------------------------------- the skirt: long, flaring and
# trailing back as she glides; its hem is ragged and thins into the mist (drawn as fx below)
SKIRT = K.grid("""
  ...qjjjjjJJJ....
  ..qqjjjjjJJJ....
  ..qjjjjqjJJJJ...
  .qqjjjjqjjJJJ...
  .qjjjqjjqjJJJJ..
  qqjjjqjjqjjJJJ..
  qjjjqjjjqjjJJJJ.
  qjjjqjjjjqjjJJJ.
  qjjjqjjjjqjjJJJJ
  lqkkqkkkkqkkkaaa
  .lkkqkkkkqkkkaa.
  .llklkkklkkkkka.
  ..llkklklkk.ka..
  ...lkll.lk...k..
  ....l....l......
""")

# ---------------------------------------------------------------- hands
LANTERN = K.grid("""
  ..SSs..
  ..Sss..
  ...n...
  ..nGn..
  .nGGgN.
  .GYVCn.
  .gVYCN.
  .gCVCN.
  .nGgnN.
  ..nNN..
""")
CLAW = K.grid("""
  S.S.S
  SsSsS
  .SSSs
  ..Ss.
""")
K.P.HANDS['lantern'] = (LANTERN, {'wrist': (2.5, 0.5), 'flame': (3, 6)})
K.P.HANDS['claw'] = (CLAW, {'wrist': (2, 3.5)})
K.P.HANDS['clawb'] = (K.grid('''
  s..s.
  S.sS.
  SSS.s
  .SSSS
  .sS..
'''), {'wrist': (4, 3)})

MIST = K.grid("""
  ........UUUUUU......
  .....ZZUUUUUUUZ.....
  ...ZZUUUZZUUUZZ..Z..
  .ZZZUZZ..ZUUZ.ZZ....
  ZZ..ZZ.....ZZ.......
  Z.......Z...........
""")
GLOW = [''.join('E' if (x - 7) ** 2 + (y - 7) ** 2 <= 7.4 ** 2 else '.' for x in range(15)) for y in range(15)]


def frame():
    X = K.pose.Ctx(1)
    cv = K.Canvas(70, 64)
    pel = (30, 30)
    body = K.P.shear((BODICE, {'pelvis': (6, 11), 'neck': (7, 0), 'shN': (7, 3), 'shF': (4, 3.5)}), 3)
    an = K.pose.place(cv, X, body, 'pelvis', pel, 4, 'torso')
    K.pose.place(cv, X, K.P.shear((SKIRT, {'waist': (7, 0)}), 5), 'waist', (pel[0], pel[1] + 1), 3, 'skirt')
    K.pose.place(cv, X, (HEAD, {'neck': (8, 13)}), 'neck', (an['neck'][0] + 1, an['neck'][1] + 1), 5, 'head')
    # the far arm: a claw raised forward and up; the near arm holds the lantern out
    sF, sN = an['shF'], an['shN']
    K.pose.arm(cv, X, sF, (sF[0] - 8, sF[1] - 4), 1, 'armF', 1, 'armF', ('hand', 'clawb'))
    info = K.pose.arm(cv, X, sN, (sN[0] + 10, sN[1] + 3), -1, 'arm', 6, 'armN', ('hand', 'lantern'))
    rows = [list(r) for r in cv.finish()]
    # effects on top, no outline: the mist under the hem, the lantern's glow ring
    def fx(g, x0, y0, under=True):
        for j, r in enumerate(g):
            for i, ch in enumerate(r):
                x, y = x0 + i, y0 + j
                if ch != '.' and 0 <= x < cv.W and 0 <= y < cv.H and (not under or rows[y][x] == '.'):
                    rows[y][x] = ch
    fx(MIST, int(pel[0] - 17), int(pel[1] + 12))
    fl = info['flame']
    fx(GLOW, int(round(fl[0])) - 7, int(round(fl[1])) - 7)
    return [''.join(r) for r in rows], (pel[0], pel[1] + 20)
