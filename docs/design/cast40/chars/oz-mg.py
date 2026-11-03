# oz-mg: the brute. A big dead soldier (taller and wider) in the greatcoat and the plain helmet,
# firing a burst from a heavy machine gun planted on its tall bipod; the ammo belt hangs from the gun.
import castkit as K
from chars import oz_kit as Z

INFO = dict(
  name='DEAD MG BRUTE', mission=['oldenzaal'], role='enemy', kind='HUMANOID', face=-1,
  pose='fires a burst from the heavy machine gun planted on its bipod',
  note='a big build (thick limbs, broad greatcoat), plain helmet; perforated barrel jacket, rusty belt',
  old='enemy/oz-mg/coat/fire#0', air=0,
)

_COAT_BIG = Z.g("""
  ....qjjQqQJJj....
  ..qjjjjjQjjqJj...
  .qjjjjjjjjjjjJj..
  qjjjqjjjjjjjjjGj.
  qjjjqjjjjjjqqjjj.
  qjjjqjjjjjjjjjGjj
  qjjjjqjjjjjjjjjjj
  qjjjjqjjjjjjjjGjj
  qjjjjqjjjjjqqjjjj
  qqjjjjqjjjjjjjGjq
  Qqqjjjjqjjjjjjjjq
  vxxxxxxxxxxxXxxXv
  qjjjjjqjjjjjJJJJj
  qjjjjjqjjjjjJqJJjj
  qjjqjjjqjjjjjJqJJj
  qjjqjjjqjjjjjJqJJj
  qjjqjjjjqjjjjjJqJJj
  qjqjjjjjqjjjjjjqJJj
  Qqjqjjjjjqjjjjjjqjjj
  .Qqqqqqqqqqqqqqqqqqq
""")
_CAN = {'neck': (8, -2), 'pelvis': (8, 11), 'shN': (9, 3), 'shF': (5, 3.5)}

# the heavy machine gun, level, facing right: stock, receiver with the feed cover, the pistol grip,
# a perforated barrel jacket, the muzzle; the rusty ammo belt hangs from the feed on the left
_MG = Z.g("""
  ........nnnnnnnnn.................
  .......nGGGGGGGGGn................
  ....Nn.ngggggggggnGnGnGnGnGnGnGn..
  ....NnnngnnnnnnnngNgNgNgNgNgNgNnGn
  ....NNNnnnNNNnSSsnnnnnnnnnnnnnnnnN
  .......lkl..sSSSs.................
  ......lkl....sSs..................
  ......klk....sz...................
  .....lkl..........................
  .....kl...........................
""")
GROUND = [0]


def bipod(cv, X, p, layer, meta):
    if layer != 'upper' or 'armN' not in meta or 'muzzle' not in meta['armN']:
        return
    mx, my = meta['armN']['muzzle']
    top = (mx - 8, my + 1.5)
    gy = GROUND[0]
    cv.tube(top, (top[0] + 3.5, gy - 1.9), 0.7, 0.9, ['g', 'n', 'N', 'N'], 7, 'bipod')
    cv.tube((top[0] - 1, top[1]), (top[0] - 4, gy - 1.9), 0.6, 0.8, ['n', 'N', 'N', 'N'], 1, 'bipodF')


def frame():
    Z.install()
    K.palette({'l': '#a08a4c'}, dark={'l': 'k'})
    Z.big(1.35, 1.15)
    K.pose.W, K.pose.H, K.pose.RX, K.pose.RY = 96, 84, 40, 78
    K.pose.THIGH, K.pose.SHIN = 8.5, 8.0
    K.pose.UPPER, K.pose.FORE = 6.5, 6.0
    K.P.TORSOS['coat'] = (_COAT_BIG, _CAN)
    K.P.GUNS['mg'] = (_MG, {'wrist': (13, 5), 'muzzle': (34, 3)})
    pel = (0, -21)
    GROUND[0] = K.pose.RY - 1 - (pel[1] + 17) + 0.4
    Z.POST_EXTRA.append(bipod)
    Z.BAND_AT[0] = 0.3
    up = K.A.up(torso='coat', head='helm', hd=(1, 0),
                near=K.A.gun((7, 8), 'mg', bend=-1, sh=(-1.5, 0)),
                far=K.A.hand((12, 5), 'fist', 'fist', sh=(2, 0)),
                fx=[('ff0', ('armN', 'muzzle', 0, 0))])
    lo = K.A.legs(pel, (-7, -4), (7, -4))
    return K.humanoid(up, lo)
