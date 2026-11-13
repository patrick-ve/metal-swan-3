# DE RATTENJONG's poses: seated on the throne and on all fours, the strips by king.ts pose name.
# king.ts plays every pose strip by time at 6 ticks a frame (`(tick - poseT) / 6`, wrapped), so the
# frame counts follow the plan's classes where the hold allows; the durations are 6 for the GIFs.
import math

import rig

from . import body as B

SIT_TAIL = [(-17, -5), (-28, -2), (-38, -4), (-45, -11), (-46, -20), (-42, -27)]


def sit(p):
    """Seated upright on the pile, facing right. p: br (breath px), lean, arms ('rest', 'up',
    'grab', 'out', 'push', 'clutch'), arm offsets, mouth, look, flash, tail (points), crouch."""
    pic = B.Pic()
    br = p.get('br', 0)
    lean = p.get('lean', 0)
    cr = p.get('crouch', 0)
    tail_pts = p.get('tail', SIT_TAIL)
    B.tail(pic, tail_pts, 0)
    arms = p.get('arms', 'rest')
    ax, ay = p.get('arm', (0, 0))
    # where the shoulders are
    shN = (5 + lean, -38 - br + cr)
    shF = (1 + lean, -40 - br + cr)
    hands = {
        'rest': ((15, -26), (12, -27)),
        'grab': ((19, -62), (13, -63)),
        'up': ((18, -68), (11, -69)),
        'out': ((27, -34), (24, -37)),
        'push': ((25, -24), (22, -26)),
        'clutch': ((14, -46), (10, -48)),
    }[arms]
    hN = (hands[0][0] + ax, hands[0][1] + ay + cr)
    hF = (hands[1][0] + ax, hands[1][1] + ay + cr)
    # the far arm and hind foot (behind the body)
    raised = arms in ('up', 'grab')
    seg = 13.0 if raised else 9.5
    elF, _ = rig.ik(shF, hF, seg, seg, 1 if arms in ('up', 'grab', 'clutch') else -1)
    pic.limb(shF, elF, hF, 3.6, 3.0, 2.2, B.FURF, 1, 'armF')
    B.paw(pic, hF, 1.5, 'armF', open_=arms in ('up', 'grab', 'out'), far=True)
    B.foot(pic, (-8, -3), (6, -2), 0.5, 'footF', far=True)
    # the body, the haunch, the near foot
    pic.blob(-3 + lean * 0.4, -29 - br * 0.5 + cr * 0.7, 16, 19 + br * 0.5 - cr * 0.4, 2, 'body', B.FUR,
             ang=lean * 1.5, seed=3, belly=(8 + lean * 0.6, -25 + cr * 0.7, 7, 13))
    pic.mange(-11 + lean * 0.3, -34 + cr * 0.6, 3.6, 51)
    pic.mange(-3, -16 + cr, 2.2, 52)
    pic.blob(-7, -13 + cr * 0.3, 15, 11.5, 4, 'body:haunch', B.FUR, seed=4)
    pic.mange(-13, -12, 2.6, 53, 'body:haunch')
    B.foot(pic, (-3, -3), (13, -2), 5, 'foot')
    # Gerrit's chain on the neck
    B.chain(pic, (-6 + lean, -43 - br + cr), (11 + lean, -41 - br + cr), 4, 6)
    # the head
    hx, hy = p.get('hx', 0), p.get('hy', 0)
    if raised:
        hx, hy = hx - 4, hy + 2            # the head ducks under the raised paws
    B.head(pic, 5 + lean + hx, -51 - br + cr + hy, 8, p, look=p.get('look', 0))
    # the near arm in front
    elN, _ = rig.ik(shN, hN, seg, seg, 1 if arms in ('up', 'grab', 'clutch') else -1)
    za = 10        # raised paws go up behind the head, beside the ears
    pic.limb(shN, elN, hN, 4.0, 3.4, 2.5, B.FUR, za, 'arm')
    B.paw(pic, hN, za + 0.5, 'arm', open_=arms in ('up', 'grab', 'out', 'push'))
    return pic


def leg_ik(a, b, l1, l2, bend):
    j, e = rig.ik(a, b, l1, l2, bend)
    return j, e


def fours(p):
    """On all fours, facing right. p: tilt (deg, + the front up), crouch, low (the head lowered),
    lunge (px), legs: {'FN','FF','HN','HF': (dx, lift)} ground offsets, mouth, look, flash, daze,
    tail (points), bob."""
    pic = B.Pic()
    tilt = p.get('tilt', 0)
    cr = p.get('crouch', 0) + p.get('bob', 0)
    low = p.get('low', 0)
    lg = p.get('legs', {})
    t = math.radians(tilt)
    # body axis: hips at (-20, ...) to shoulders at (14, ...), turned about the hips
    hip = (-20, -26 + cr)
    shl = (hip[0] + 34 * math.cos(t), hip[1] - 34 * math.sin(t) - 2)
    mid = ((hip[0] + shl[0]) / 2, (hip[1] + shl[1]) / 2)
    # the tail
    B.tail(pic, p.get('tail', [(-30, -24 + cr), (-44, -19 + cr), (-56, -14 + cr), (-66, -9 + cr), (-74, -6 + cr), (-80, -4)]), 0)
    # far legs
    def front(key, z, ramp, far):
        dx, lift = lg.get(key, (0, 0))
        s = (shl[0] - (3 if far else 0), shl[1] + 4)
        g = (shl[0] + 4 + dx - (3 if far else 0), -3 - lift)
        if tilt > 15:
            g = (shl[0] + 9 + dx, shl[1] + 6 - lift)
        el, end = leg_ik(s, g, 12, 12, 1)
        pic.limb(s, el, end, 4.6 if not far else 4.0, 3.6, 2.4, ramp, z, key)
        B.paw(pic, (end[0] + 1, end[1] - 0.5), z + 0.4, key, open_=tilt > 15, far=far)

    def hind(key, z, ramp, far):
        dx, lift = lg.get(key, (0, 0))
        s = (hip[0] - (3 if far else 0), hip[1] + 3)
        heel = (hip[0] - 6 + dx - (3 if far else 0), -4 - lift)
        kn, end = leg_ik(s, heel, 11, 12, -1)
        pic.limb(s, kn, end, 5.2 if not far else 4.4, 3.4, 2.4, ramp, z, key)
        B.foot(pic, end, (end[0] + 10, end[1] + 1.5 - (lift > 2) * 1.5), z + 0.3, key + 'f', far=far)

    front('FF', 1, B.FURF, True)
    hind('HF', 1, B.FURF, True)
    # body volumes
    pic.blob(mid[0], mid[1] - 1, 25, 13 - cr * 0.15, 3, 'body', B.FUR, ang=-tilt, seed=5,
             belly=(mid[0] + 6, mid[1] + 9, 16, 5))
    pic.blob(hip[0], hip[1] + 1, 13, 12.5, 4, 'body:haunch', B.FUR, seed=6)
    pic.blob(shl[0], shl[1] + 1, 11, 11, 4.5, 'body:shoulder', B.FUR, ang=-tilt, seed=7, belly=(shl[0] + 7, shl[1] + 7, 5, 6))
    pic.mange(mid[0] - 4, mid[1] - 6, 3.4, 61)
    pic.mange(hip[0] - 4, hip[1] - 2, 2.4, 62, 'body:haunch')
    # the head
    hx = shl[0] + 14 + p.get('lunge', 0)
    hy = shl[1] - 8 + low
    look = p.get('look', tilt * 0.7 - low * 1.2)
    B.chain(pic, (shl[0] + 1, shl[1] - 9), (shl[0] + 10, shl[1] - 2 + low * 0.5), 3, 7)
    B.head(pic, hx, hy, 8, p, look=look)
    front('FN', 9, B.FUR, False)
    hind('HN', 9, B.FUR, False)
    if p.get('daze'):
        stars(pic, hx - 2, hy - 18, p['daze'])
    return pic


def stars(pic, cx, cy, k):
    for i in range(3):
        a = k * 1.05 + i * 2 * math.pi / 3
        x, y = int(round(cx + math.cos(a) * 11)), int(round(cy + math.sin(a) * 3))
        for dx, dy, ch in ((0, 0, 'T'), (-1, 0, 'G'), (1, 0, 'G'), (0, -1, 'G'), (0, 1, 'g')):
            pic.px(x + dx, y + dy, ch, 20, 'star%d' % i)
