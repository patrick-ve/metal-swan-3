# Extension family 'ride': the nine Swan rider poses with a Swan to sit on (category 'Swan ride'),
# and Helium Head (balloon heads + the helium sets, category 'Status').
#
# Rider keys (UPPER, hip anchor, no weapon): ride_sit 2, ride_lean 2, ride_up 1, ride_hunch 1,
# ride_hold 2, ride_brace 1, ride_duck 1, ride_ears 2, ride_cheer 2. The hands land on the handle
# grips at hip + (9, -5) near and (10, -5) far (folded for the duck: (12, -3) / (13, -3)). The arm
# targets are computed from each hero's own torso anchors, so every hero's hands reach the grips.
# The Swan: shared stage sprites parts.STAGE['swan_b'] (behind the rider) and ['swan_f'] (in front),
# one frame per Swan pose (ext_ride_swan.ORDER), anchor 'c' = the seat (the rider's hip); exported
# points: feet, gripN, gripF, neck, head, beak, footN, footF.
# Letters: 5 6 7 8 9 (white, light grey, blue-grey, orange, dark), stage only.
import math
import rig
from rig import rotsprite
import parts as P
import anims as A
import ext
import ext_ride_swan as SW
import ext_ride_helium as HE

PEL = (0, -17)          # an upper with no lower is drawn with its pelvis here (comp.py)


# ------------------------------------------------------------------ parts
def _transpose_up(part):
    """An open hand turned so the fingers point up (a palm over the ear)."""
    rows, an = part
    h, w = len(rows), max(len(r) for r in rows)
    rr = [r.ljust(w, '.') for r in rows]
    out = [''.join(rr[y][x] for y in range(h)) for x in range(w)][::-1]
    wx, wy = an['wrist']
    return out, {'wrist': (wy, w - 1 - wx)}


def rot_part(part, deg, pivot='pelvis', pad=8):
    """Turn a hand-drawn part with rotsprite (positive = counter-clockwise) and carry its anchors."""
    rows, an = part
    w = max(len(r) for r in rows)
    g = ['.' * (w + 2 * pad)] * pad + ['.' * pad + r.ljust(w, '.') + '.' * pad for r in rows] + ['.' * (w + 2 * pad)] * pad
    px, py = an[pivot][0] + pad, an[pivot][1] + pad
    out = rotsprite(g, (px, py), deg)
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    an2 = {}
    for k, (x, y) in an.items():
        dx, dy = x + pad - px, y + pad - py
        an2[k] = (px + ca * dx + sa * dy, py - sa * dx + ca * dy)
    ys = [y for y, r in enumerate(out) if r.strip('.')]
    xs = [x for r in out for x, ch in enumerate(r) if ch != '.']
    x0, y0 = min(xs), min(ys)
    out = [r[x0:max(xs) + 1] for r in out[y0:max(ys) + 1]]
    return out, {k: (v[0] - x0, v[1] - y0) for k, v in an2.items()}


def PARTS():
    rig.PAL.update(SW.PAL)
    rig.DARK.update(SW.DARKS)
    # VINCENT's 'panic' head: brows jump up, both eyes wide open, the mouth an open 'O'
    if 'panic' not in P.HEADS and P.HEADS['fwd'][0] is P._HEAD:     # VINCENT only
        ext.add(P.HEADS, 'panic', (P._edit(P.HEADS['fwd'][0], [
            (4, 10, 'QQ'), (5, 9, 'Swww'), (6, 9, 'SwQS'),
            (9, 9, 'BBBB'), (10, 8, 'BBQQB'), (11, 8, 'bBQQB'), (12, 5, 'zBBBBBB')]), {'neck': (5, 12)}))
    # a fist closed round a handle grip, from the hero's own fist (gloves and cuffs stay his)
    rows, an = P.FISTS['fist']
    w = max(len(r) for r in rows)
    ext.add(P.HANDS, 'grip', (rows, dict(an, grip=(an['wrist'][0] + (w - 1) / 2 + 0.5, an['wrist'][1]))))
    # an open hand turned fingers-up, cupped over an ear
    ext.add(P.HANDS, 'ear', _transpose_up(P.HANDS['open']))
    # torsos turned forward for the hunch and the flat duck, from the hero's own upright torso
    ext.add(P.TORSOS, 'ride_h', rot_part(P.TORSOS['up'], -30))
    ext.add(P.TORSOS, 'ride_d', rot_part(P.TORSOS['up'], -62))
    B, F = SW.build_stage()
    P.STAGE['swan_b'] = B
    P.STAGE['swan_f'] = F


# ------------------------------------------------------------------ rider poses
def _shoulders(torso, tor):
    an = P.TORSOS[torso][1]
    pa = an['pelvis']
    x0 = round(PEL[0] + tor[0] - pa[0])
    y0 = round(PEL[1] + tor[1] - pa[1])
    f = lambda k: (x0 + an[k][0] - PEL[0], y0 + an[k][1] - PEL[1])
    return f('shN'), f('shF'), f('neck')


def _to(target, sh, part='grip', lib=None):
    """Arm 'hand' vector (from the shoulder) that puts the part's grip point on the hip-relative
    target (the wrist anchor is where the IK ends)."""
    lib = lib or P.HANDS
    an = lib[part][1]
    gx, gy = an.get('grip', an['wrist'])
    wx, wy = an['wrist']
    return (target[0] - (gx - wx) - sh[0], target[1] - (gy - wy) - sh[1])


def rider(torso='up', head='fwd', tor=(0, 0), hd=(0, 0), grips=(SW.GRIP_N, SW.GRIP_F), near=None, far=None,
          cape=('hang', 0)):
    shN, shF, _ = _shoulders(torso, tor)
    p = A.up(torso=torso, head=head, tor=tor, hd=hd)
    p['armN'] = near or dict(hand=_to(grips[0], shN), end=('hand', 'grip'), bend=-1)
    p['armF'] = far or dict(hand=_to(grips[1], shF), end=('hand', 'grip'), bend=-1)
    p['cape'] = cape            # read only by a hero with a cape hook (mode, phase); ignored otherwise
    return p


def ears(head, tor=(0, 1)):
    shN, shF, neck = _shoulders('up', tor)
    ear = (neck[0], neck[1] - 3.5)             # the ear sits about 4 px above the neck point
    near = dict(hand=_to(ear, shN, 'ear'), end=('hand', 'ear'), bend=1, z=6.5)
    far = dict(hand=_to((ear[0] - 4, ear[1] - 1), shF, 'ear'), end=('hand', 'ear'), bend=1, z=4.5)
    return rider('up', head, tor, near=near, far=far, cape=('settle', 0))


def cheer(k):
    shN, _, _ = _shoulders('up', (0, 0))
    # the arm is too short to clear the big head upward: a 'yes!' pump, elbow down, the fist up in
    # front of the chin (a raised arm would cross the face)
    wrist = [(10, -11), (9, -8)][k]
    near = dict(hand=(wrist[0] - shN[0], wrist[1] - shN[1]), end=('fist', 'fistup'), bend=-1, z=6.5)
    return rider('up', ['happy', 'shout'][k], (0, 0), hd=(0, 0), near=near, cape=('billow', 0.25 * k))


def BUILD():
    U = A.UPPER
    add = lambda k, v: ext.add(U, k, v)
    add('ride_sit', [(rider('up', 'fwd', (0, 0), cape=('hang', 0)), 20),
                     (rider('up', 'fwd', (0, 1), hd=(0, 0), cape=('hang', 0.5)), 20)])
    add('ride_lean', [(rider('lean', 'fwd', (0, 0), hd=(1, 0), cape=('run', 0)), 6),
                      (rider('lean2', 'fwd', (0, 1), hd=(1, 0), cape=('run', 0.5)), 6)])
    add('ride_up', [(rider('back', 'up', (-1, 0), hd=(-1, 0), cape=('billow', 0.2)), 30)])
    add('ride_hunch', [(rider('ride_h', 'panic', (0, 1), hd=(1, 1), cape=('settle', 0)), 30)])
    add('ride_hold', [(rider('lean', 'shout', (0, 1), cape=('billow', 0)), 4),
                      (rider('lean', 'panic', (0, 1), hd=(0, 1), cape=('billow', 0.5)), 4)])
    add('ride_brace', [(rider('lean2', 'hurt', (0, 2), hd=(0, 0), cape=('crouch', 0)), 30)])
    add('ride_duck', [(rider('ride_d', 'shout', (0, 2), hd=(1, 0), grips=(SW.GRIP_NF, SW.GRIP_FF),
                             cape=('run', 0.3)), 30)])
    add('ride_ears', [(ears('blink'), 6), (ears('panic'), 6)])
    add('ride_cheer', [(cheer(0), 8), (cheer(1), 8)])


def DERIVE():
    HE.derive()


# ------------------------------------------------------------------ page groups
def _st(name, extra_oy=0):
    i = SW.IDX[name]
    seat = SW.SEATS[name]
    oy = 17 + round(seat[1]) + extra_oy
    return {'st': [['swan_b', i, 0, -17, -1], ['swan_f', i, 0, -17, 1]], 'oy': oy, 'ox': 0}


def step(key, i, swan, t):
    s = {'u': [key, i], 'l': None, 't': t}
    s.update(_st(swan))
    return s


def GROUPS():
    G = []
    sit = [step('ride_sit', 0, 'stand0', 20), step('ride_sit', 1, 'stand1', 20)] * 2
    run = [step('ride_lean', k % 2, 'run%d' % k, 6) for k in range(4)] * 2
    G.append({'cat': 'Swan ride', 'title': 'Ride: sit and run', 'ref': '2 + 2', 'steps': sit + run})
    G.append({'cat': 'Swan ride', 'title': 'Ride: up, hunch, duck', 'ref': '1 + 1 + 1',
              'steps': [step('ride_sit', 0, 'stand0', 12), step('ride_up', 0, 'skid', 30),
                        step('ride_sit', 0, 'stand0', 12), step('ride_hunch', 0, 'arch', 30),
                        step('ride_sit', 0, 'stand0', 12), step('ride_duck', 0, 'duck', 30)]})
    hold = [step('ride_hold', k % 2, 'flap', 4) for k in range(4)] + [step('ride_brace', 0, 'land', 30)]
    honk = [step('ride_ears', 0, 'honk0', 10)] + [step('ride_ears', 1, 'honk1', 6), step('ride_ears', 0, 'honk1', 6)] * 2
    chr_ = [step('ride_cheer', k % 2, 'stand0', 8) for k in range(4)]
    G.append({'cat': 'Swan ride', 'title': 'Ride: hold, brace, honk, cheer', 'ref': '2 + 1 + 2 + 2',
              'steps': hold + honk + chr_})
    G.extend(HE.groups())
    return G
