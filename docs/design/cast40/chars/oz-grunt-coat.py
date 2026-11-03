# oz-grunt-coat: the dead grunt in the long greatcoat and the plain field cap, swinging a rusty
# rifle by its barrel like a club (the butt comes down at the hero).
import castkit as K
from chars import oz_kit as Z

INFO = dict(
  name='DEAD GRUNT (GREATCOAT)', mission=['oldenzaal'], role='enemy', kind='HUMANOID', face=-1,
  pose='swings a rifle by the barrel like a club, the butt high',
  note='long double-breasted greatcoat to the knees, plain field cap; rot face with a dim eye glow',
  old='enemy/oz-grunt/coat/strike#0', air=0,
)


def club():
    rows = K.mirror(Z.RIFLE)                       # butt right, muzzle left
    w = len(rows[0])
    # the hands close round the barrel near the muzzle
    rows = Z.edit(rows, [(1, 2, 'SSs'), (2, 1, 'SSSs'), (3, 1, 'sss')])
    return Z.rot_part(rows, {'wrist': (2.5, 2.5)}, 38)


def frame():
    Z.install()
    K.P.HANDS['club'] = club()
    Z.BAND_AT[0] = 0.8
    K.P.HANDS['none'] = (['.'], {'wrist': (0, 0)})
    up = K.A.up(torso='coat', head='cap',
                near=K.A.hand((9, -1), 'club', 'hand', bend=-1),
                far=K.A.hand((11, -1), 'none', 'hand', bend=-1))
    lo = K.A.legs((0, -17), (-6, -4), (6, -4))
    return K.humanoid(up, lo)
