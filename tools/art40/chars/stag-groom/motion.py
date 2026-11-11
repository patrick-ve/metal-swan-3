# The groom's secondary motion: the veil (angle at the comb, curl at the hem, flutter phase) and
# the tutu (0 rest, 1 lifted, 2 hanging long, 3 trailing back, 4 swinging forward) for every frame
# of every strip of the stag kit (chars/stag-partier/strips.py), chosen from what the body does in
# that frame: the veil and the frills lag the body by a frame, overshoot and settle.
#
# kit.Look.dress(p, role) calls `dress` with the pose dict of each frame before it is drawn: role =
# (strip, frame index, kind), kind 'stand' | 'seat' | 'dead' | 'cower'. Deaths: the veil is gone
# (the game tumbles enemy/stag-groom/veil off his head on the death's first tick); the cower: the
# shirt is over his head (no veil, as before).
import math

from . import parts

TAU = 2 * math.pi
# the angle the stiff tulle stands out from the back at rest (added to every table angle)
STIFF = 14


def _wave(i, n, turns=1.0):
    return TAU * turns * i / n


# (ang, curl, wave) per frame; None = no veil
def _walk(i):
    # two steps per 12-frame cycle; the body is lowest on frames 0 and 6 (the heel strike): the
    # veil lifts a frame later, the ripple travels down the sheet twice a cycle
    b = math.cos(_wave(i - 1, 6))
    return (30 + 7 * b, 14 + 6 * b, _wave(i, 12, 2))


VEIL = {
    'idle': [(10, 4, 0.0), (12, 3, 1.4), (15, 2, 2.8), (13, 4, 4.4)],
    'walk': [_walk(i) for i in range(12)],
    'turn': [(10, 4, 0.0)],
    # caught napping: he jolts upright, the veil flips up behind him
    'alert': [(48, 26, 1.0)],
    # the shake: the veil whips with each jerk of the bottle, a frame behind
    'tell': [(22, -8, 0.0), (10, 10, 1.2), (30, -6, 2.4), (14, 14, 3.6), (8, 6, 4.8), (28, -10, 6.0)],
    # aim (still), POP: the veil flies back with the recoil, then floats down and settles
    'fire': [(16, 4, 0.0), (14, 2, 0.6), (64, 34, 1.4), (78, 28, 2.4), (72, 18, 3.4), (58, 10, 4.4),
             (42, 4, 5.2), (28, 0, 6.0), (18, 2, 6.6), (13, 4, 7.2)],
    # raise, the wind-up, CLINK (thrust: the veil trails), the bounce, to the mouth, the swig (the
    # head back: the veil falls against his back), aah
    'gag-toast': [(12, 4, 0.0), (6, 10, 0.8), (34, 16, 1.6), (24, -4, 2.4), (14, 4, 3.2), (4, 2, 4.0),
                  (2, 6, 4.8), (10, 4, 5.6)],
    'gag-selfie': [(12, 4, 0.0), (16, 6, 0.8), (18, 4, 1.6), (20, 8, 2.4), (10, 2, 3.2), (12, 4, 4.0),
                   (14, 6, 4.8), (12, 4, 5.6)],
    # SAY CHEESE: the chest out, the bottle up: the veil swings back and floats
    'photo-pose': [(12, 4, 0.0), (22, 10, 1.0), (26, 12, 2.0), (24, 8, 3.0), (20, 6, 4.0), (16, 4, 5.0)],
    # the group selfie bounce
    'gloat': [(14, 4, 0.0), (20, 8, 1.0), (22, 6, 2.0), (16, 2, 3.0), (10, 6, 4.0), (12, 4, 5.0)],
}
# on the moving beer bike the veil streams back (the ride's wind) on top of what the body does
RIDE = 22
VEIL['sit'] = [(34 + 5 * math.cos(_wave(i, 8, 2)), 16 + 5 * math.sin(_wave(i, 8, 2)), _wave(i, 8, 2)) for i in range(8)]
for name in ('tell', 'fire', 'gloat'):
    VEIL['sit-' + name] = [(a + RIDE, c + 6, w + 0.5) for a, c, w in VEIL[name]]

TUTU = {
    'idle': [0, 0, 2, 0],
    # the hem lifts after each heel strike (0, 6), hangs on the rise, trails back on the push-off
    'walk': [3, 1, 0, 2, 2, 3, 3, 1, 0, 2, 2, 3],
    'turn': [0],
    'alert': [1],
    'tell': [1, 0, 2, 1, 0, 2],
    # the pop pushes him back: the frills swing on forward, then back past rest, then settle
    'fire': [0, 3, 4, 4, 0, 3, 0, 2, 0, 0],
    'gag-toast': [0, 4, 3, 4, 0, 4, 0, 2],
    'gag-selfie': [0, 0, 2, 0, 1, 0, 2, 0],
    'photo-pose': [0, 1, 2, 0, 1, 0],
    'gloat': [0, 2, 0, 1, 2, 0],
    'cower': [1, 2, 1, 2],
    'sit': [3, 3, 1, 3, 3, 3, 1, 3],
    'sit-tell': [1, 3, 2, 1, 3, 2],
    'sit-fire': [3, 3, 4, 4, 0, 3, 0, 3, 3, 3],
    'sit-gloat': [3, 2, 3, 1, 2, 3],
    'sit-cower': [1, 2, 1, 2],
    # deaths: the frills fly with the fall and land last
    'die': [4, 4, 3, 3, 0, 1, 2, 0, 1, 0],
    'die-knife': [0, 2, 2, 1, 0, 0, 3, 1, 0, 0],
    'die-blast': [1, 1, 3, 3, 3, 3, 1, 1, 0, 0],
    'die-burn': [1, 1, 2, 0, 0, 3, 3, 1],
    'die-crush': [1, 1, 1, 0, 1, 0],
    'die-stool': [1, 4, 4, 3, 3, 1, 1, 0, 0, 0],
}


NUDGE = {
    ('tell', 5, 'armN'): (0, -0.6),
    ('die-burn', 6, 'armN'): (-2.5, -1),
}


def dress(p, role):
    name, i, kind = role
    t = TUTU.get(name)
    state = t[i % len(t)] if t else 0
    torso = p.get('torso', 'up')
    if state:
        p['torso'] = f'{torso}~{state}'
    v = VEIL.get(name)
    if v and kind in ('stand', 'seat'):
        a, c, w = v[i % len(v)]
        # stiff tulle: the veil stands out from his back even at rest
        p['veil'] = (a + STIFF, c, w)
        p['head'] = p.get('head', 'fwd') + '@v'
    # his normal build (thinner, shorter arms than look 0): two hand keys of the shared strips
    # moved a pixel so no joint jumps more than 3 px a tick (the smoothness gate)
    for (sn, k, arm), d in NUDGE.items():
        if sn == name and k == i and p.get(arm):
            hx, hy = p[arm]['hand']
            p[arm] = dict(p[arm], hand=(hx + d[0], hy + d[1]))
    # three corks: the jet fans into three streams
    if 'fire' in name and p.get('fx'):
        p['fx'] = [(parts.JET_SWAP.get(n, n), at) for n, at in p['fx']]
    return p
