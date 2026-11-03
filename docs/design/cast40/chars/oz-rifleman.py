# oz-rifleman: the dead rifleman, bare rotting head, tunic; one slow aimed shot from a rusty bolt rifle.
import castkit as K
from chars import oz_kit as Z

INFO = dict(
  name='DEAD RIFLEMAN', mission=['oldenzaal'], role='enemy', kind='HUMANOID', face=-1,
  pose='fires one slow aimed shot from a rusty bolt rifle',
  note='bare rotting head with hair wisps, cheek on the stock; tunic, Y-strap, jackboots, red band',
  old='enemy/oz-rifleman/tunic/fire#0', air=0,
)


def frame():
    Z.install()
    up = K.A.up(torso='tunic', head='bare', hd=(1, 0),
                near=K.A.gun((6, 1), 'rifle'),
                far=K.A.hand((10.5, 3), 'fist', 'fist', sh=(4, 0)),
                fx=[('ff1', ('armN', 'muzzle', 0, 0))])
    lo = K.A.legs((0, -17), (-5, -4), (5, -4))
    return K.humanoid(up, lo)
