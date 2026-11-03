# oz-crawler: a legless dead soldier dragging himself along the floor. The far arm pulls (the claw
# flat on the ground), the near arm with the plain red band reaches forward low for a hero's feet.
# The tunic ends in a frayed, torn hem at the waist (no gore).
import math
import castkit as K
from chars import oz_kit as Z

INFO = dict(
  name='DEAD CRAWLER', mission=['oldenzaal'], role='enemy', kind='HUMANOID', face=-1,
  pose='drags itself with one arm, the other claw reaching for the feet',
  note='a legless torso in a torn tunic, helmet, glowing eye; the frayed hem trails behind',
  old='enemy/oz-crawler/tunic/drag#2', air=0,
)

RAGS = Z.g("""
  ....qq.
  ..Qqjq.
  .qjQjq.
  QqjqQq.
  .QQ.qQ.
  Q...Q..
""")


def frame():
    Z.install()
    X = K.pose.Ctx(1)
    cv = K.Canvas(60, 34)
    RY = 30                                      # the ground point; the body ends on row RY - 1
    waist, shou = (12, RY - 4.2), (24, RY - 7.5)
    ramp = ['J', 'j', 'q', 'Q']
    cv.tube(waist, shou, 3.2, 3.8, ramp, 4, 'torso', cut=K.pose.CUT['arm'],
            pat=lambda u, v, k, ch: Z.cloth('torso', u, v, k, ch))
    # the belt across the waist end, black leather by the tube's own tone
    ax, ay = shou[0] - waist[0], shou[1] - waist[1]
    L = math.hypot(ax, ay)
    lea = {'J': 'X', 'j': 'x', 'q': 'x', 'Q': 'v', 's': 'x', 'z': 'v'}
    for y in range(cv.H):
        for x in range(cv.W):
            if cv.p[y][x] == 'torso':
                u = ((x - waist[0]) * ax + (y - waist[1]) * ay) / L
                if 1.2 <= u <= 2.6 and cv.c[y][x] in lea:
                    cv.c[y][x] = lea[cv.c[y][x]]
                    cv.proc[y][x] = False
    cv.grid(int(waist[0]) - 8, RY - 7, RAGS, 3.5, 'rags')
    # the far arm pulls: the claw flat on the floor ahead
    shF = (shou[0] - 1, shou[1] + 0.5)
    K.pose.arm(cv, X, shF, (shF[0] + 8, RY - 3.2), 1, 'armF', 1, 'armF', ('hand', 'clawF'))
    # the head, raised, over the shoulders
    an = K.pose.place(cv, X, K.P.HEADS['bare'], 'neck', (shou[0] + 3, shou[1] - 1), 5, 'head')
    # the near arm reaches forward low, for the feet
    shN = (shou[0] + 1, shou[1] - 0.5)
    info = K.pose.arm(cv, X, shN, (shN[0] + 10.3, shN[1] + 3.2), -1, 'arm', 6, 'armN', ('hand', 'claw'))
    Z.BAND_AT[0] = 0.8
    Z.band(cv, {'armN': {}}, {'torso': {'shN': shN}, 'armN': info})
    return K.finish(cv, (shou[0] - 4, RY))
