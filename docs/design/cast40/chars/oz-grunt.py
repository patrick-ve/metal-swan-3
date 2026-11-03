# oz-grunt: the common dead soldier. Tunic, the plain steel helmet, a rusty trench shovel raised for
# an overhead blow; the near arm (with the plain red band) reaches out with a bony claw.
import castkit as K
from chars import oz_kit as Z

INFO = dict(
  name='DEAD GRUNT', mission=['oldenzaal'], role='enemy', kind='HUMANOID', face=-1,
  pose='winds up a trench-shovel blow, the other claw reaching',
  note='field-grey tunic, Y-strap, jackboots, plain helmet; rotting face with a dim eye glow',
  old='enemy/oz-grunt/tunic/tell#1', air=0,
)

_SHOVEL = Z.g("""
  .gGGGg...........
  gGGYGGgn......ss.
  GGGGGGgnNaaaasssz
  gGgYgggnNkkkkzsz.
  .ggnnnn.......z..
""")
SHOVEL = Z.rot_part(_SHOVEL, {'wrist': (16, 2.5)}, -40)


def frame():
    Z.install()
    K.P.HANDS['shovel'] = SHOVEL
    up = K.A.up(torso='tunic', head='helm',
                near=K.A.hand((9, 1.5), 'claw', 'hand'),
                far=K.A.hand((-7, -8), 'shovel', 'hand', bend=1))
    lo = K.A.legs((0, -17), (-6, -4), (6, -4))
    return K.humanoid(up, lo)
