# The hot-dog vendor's strips: poses per frame and the holds in 60 Hz ticks. Every logic time the
# game reads stays (docs/design/ams40/contract.md "hot-dog vendor"); the frame counts follow the
# plan's action classes. Drawn facing right (the game's unflipped person faces right; the entity
# flips him to face the player).
#
# He stands in the box of his stand: only his head, his shoulders and his raised hands show over
# the counter (plan rule 10), so the motion of every strip lives up there: the breathing in the
# shoulders and the cap, the talking hand at the chest, the wave and the salute over the cap.
import math

import art40 as X
import castkit as K

from . import parts

P = K.P
A = K.A


# ------------------------------------------------------------------------------------ helpers
def hand(h, kind='fist', bend=-1, sh=(0, 0), z=None):
    return A.hand(h, kind, 'hand', bend=bend, sh=sh, z=z)


def legs(pel, far, near, fs='flat', ns='flat'):
    return A.legs(pel, far, near, fs, ns)


# The stance in the box: the feet a little apart under the wide hips.
STAND = legs((0, -17), (-5, -4), (5, -4))
REST = hand((3.5, 8.5), 'rest', bend=1)            # the near hand resting on the belly
INSIDE = hand((2, 7.5), 'inside', bend=-1)         # the far hand on the belly, behind it


def game_pts(j):
    """The points the game had on every frame: hand (the near hand), head (the head centre), hip."""
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 2, nk[1] - 7), 'hip': j['pel']}


def fig(upper, lower=STAND, thin=False):
    """One frame: the upper pose on the lower pose, the game points and every joint. thin: the
    near arm is drawn narrower (the salute: it must not hide the face; the cast sample)."""
    parts.fat.thin = 'armN' if thin else None
    try:
        rows, root, j = X.humanoid(upper, lower)
    finally:
        parts.fat.thin = None
    return X.Frame(rows, root, pts=game_pts(j), joints=j)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


# ------------------------------------------------------------------------------------ idle (4)
IDLE_TOR = [0, 0, 1, 1]          # the chest settles a row on the out-breath
IDLE_HEAD = [0, 1, 1, 0]         # the head follows a frame late (the cap nods with him)
IDLE_TORSO = ['up', 'in', 'in', 'up']


def idle_pose(k):
    by, hy = IDLE_TOR[k], IDLE_HEAD[k]
    return A.up(torso=IDLE_TORSO[k], head='fwd', tor=(0, by), hd=(0, hy - by),
                near=hand((3.5, 8.5 - 0.5 * by), 'rest', bend=1), far=INSIDE)


def idle():
    return [fig(idle_pose(k)) for k in range(4)]


# ------------------------------------------------------------------------------------ talk (8)
# A vendor's pitch: the near hand talks (presents with the palm up, rises, the finger goes up:
# 'one moment!', comes down again), the head nods on the stressed words, the mouth opens and shuts,
# the brows go up on the punch line. An eased loop: the hand slows at the top and the bottom.
TALK = [
    # (near hand target, hand kind, head, torso, tor, hd): the hand stays over the counter line,
    # in front of the chin (beyond the moustache), so the pitch reads in the hatch
    ((10.5, 1.0), 'palm', 'talkA', 'up', (0, 0), (0, 0)),
    ((12.0, -0.5), 'palm', 'talkB', 'up', (0, 0), (0, 0)),
    ((13.0, -2.0), 'palm', 'talkU', 'back1', (0, 0), (0, 0)),
    ((13.0, -2.5), 'palm', 'talkO', 'back1', (0, 0), (0, 0)),
    ((13.0, -3.5), 'pointup', 'talkC', 'up', (0, 0), (0, 0)),
    ((13.0, -3.0), 'pointup', 'talkA', 'lean1', (0, 0), (0, 1)),
    ((12.5, -1.0), 'palm', 'talkB', 'up', (0, 0), (0, 1)),
    ((11.0, 0.5), 'palm', 'talkC', 'up', (0, 0), (0, 0)),
]


def talk_pose(k):
    h, kind, head, torso, tor, hd = TALK[k]
    return A.up(torso=torso, head=head, tor=tor, hd=hd, near=hand(h, kind, bend=1), far=INSIDE)


def talk():
    return [fig(talk_pose(k)) for k in range(8)]


# ------------------------------------------------------------------------------------ wave (6)
# The near arm high over the cap, the forearm swinging from the elbow; the hand trails the swing
# (tipped back on the way forward, forward on the way back) and overshoots at the ends. A big
# laugh, the body sways a pixel with the arm. Ticks [4, 3, 3, 4, 3, 3]: the ends held, the passes fast.
WAVE = [
    # (hand target, hand kind, head, tor x): from the shrugged shoulder (WAVE_SH)
    ((10.5, -12.0), 'wavefwd', 'laugh', 0),     # back end (over the peak, the hand tipped over)
    ((12.0, -11.5), 'waveback', 'laugh', 0),    # swinging forward: the hand trails
    ((13.5, -10.0), 'waveback', 'chuckle', 1),  # nearly forward
    ((14.0, -9.0), 'wave', 'chuckle', 1),       # forward end, past the peak: the palm square
    ((13.0, -10.5), 'wavefwd', 'laugh', 1),     # swinging back: the hand trails the other way
    ((11.5, -12.0), 'wavefwd', 'laugh', 0),     # nearly back
    # (the hand keeps 1.5 px in front of the nose line, so the cuff never lies on the face)
]
WAVE_SH = (2, -2)          # the shoulder lifts with the raised arm
BEHIND_HEAD = 4.5          # the raised arm between the torso and the head (the face stays clear)


def wave_pose(k):
    h, kind, head, tx = WAVE[k]
    return A.up(torso='back1', head=head, tor=(tx, 0), near=hand(h, kind, bend=-1, sh=WAVE_SH, z=BEHIND_HEAD), far=INSIDE)


def wave():
    return [fig(wave_pose(k)) for k in range(6)]


# ------------------------------------------------------------------------------------ salute (8)
# 'HALLO DAAR!' as one 70-tick performance (the mode's logic time: entities.ts setMode('salute', 70)),
# so the loop never restarts inside the mode and the mode ends on a lowered arm, not mid-chuckle:
# the hand comes up past the chest (anticipation, the shoulder dips), the elbow lifts it by the
# cheek, the salute snaps in (the hand a little high and open, the chest puffs, the chin up), the
# flat hand hits the peak, he laughs and chuckles under it (the belly bounces, the eyes squint),
# holds it proudly, then lowers the hand toward the rest pose of the idle.
SALUTE = [
    # (hand target, hand kind, head, torso, tor, hd, z behind the head)
    ((8.0, 1.5), 'open', 'fwd', 'in', (0, 0), (0, 0), False),
    ((9.5, -5.0), 'saluteup', 'proud', 'up', (0, 0), (0, 0), True),
    ((10.0, -9.5), 'saluteup', 'proud', 'puffback', (0, -1), (0, 0), True),
    ((9.0, -7.5), 'salute', 'proud', 'puff', (0, -1), (0, 0), True),
    ((9.0, -8.0), 'salute', 'laugh', 'in', (0, -1), (0, 0), True),
    ((9.0, -7.0), 'salute', 'chuckle', 'up', (0, 0), (0, 1), True),
    ((9.0, -7.5), 'salute', 'fwd', 'in', (0, 0), (0, 0), True),
    ((10.0, -1.5), 'open', 'fwd', 'up', (0, 0), (0, 0), False),
]


def salute_pose(k):
    h, kind, head, torso, tor, hd, behind = SALUTE[k]
    sh = (3, -1) if behind else (1, 0)
    return A.up(torso=torso, head=head, tor=tor, hd=hd,
                near=hand(h, kind, bend=-1, sh=sh, z=BEHIND_HEAD if behind else None), far=INSIDE)


def salute():
    return [fig(salute_pose(k), thin=True) for k in range(len(SALUTE))]


# ------------------------------------------------------------------------------------ in-<mode> (2)
def inbetween(a, b, t, near_kind, head, elbow_up=False):
    """An in-between of two upper poses: the torso offset and the near hand eased from a to b."""
    na, nb = a['armN'], b['armN']
    h = lerp(na['hand'], nb['hand'], t)
    sh = lerp(na.get('sh', (0, 0)), nb.get('sh', (0, 0)), t)
    tor = lerp(a.get('tor', (0, 0)), b.get('tor', (0, 0)), t)
    hd = lerp(a.get('hd', (0, 0)), b.get('hd', (0, 0)), t)
    bend = -1 if elbow_up else nb.get('bend', -1)
    return A.up(torso=(a if t < 0.5 else b)['torso'], head=head, tor=(round(tor[0]), round(tor[1])),
                hd=(round(hd[0]), round(hd[1])), near=hand(h, near_kind, bend=bend, sh=sh), far=INSIDE)


def in_talk():
    a, b = idle_pose(0), talk_pose(0)
    return [fig(inbetween(a, b, 0.35, 'rest', 'fwd')), fig(inbetween(a, b, 0.72, 'palm', 'talkC'))]


def in_wave():
    a, b = idle_pose(0), wave_pose(0)
    # the hand comes up past the chest, then the elbow lifts it over the cap (a straight arm held
    # out at shoulder height read as an odd reach)
    f0 = A.up(torso='up', head='fwd', near=hand((8.0, 1.5), 'open', bend=-1), far=INSIDE)
    f1 = A.up(torso='back1', head='laugh', near=hand((8.5, -5.5), 'wave', bend=-1, sh=(1, -1), z=BEHIND_HEAD), far=INSIDE)
    return [fig(f0), fig(f1)]


# ------------------------------------------------------------------------------------ turn (2)
def outline(rows):
    """Outline a figure: every empty pixel next to a filled one becomes K."""
    g = [list(r) for r in rows]
    res = [r[:] for r in g]
    h, w = len(g), len(g[0])
    for y in range(h):
        for x in range(w):
            if g[y][x] == '.':
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X_, Y_ = x + dx, y + dy
                    if 0 <= X_ < w and 0 <= Y_ < h and g[Y_][X_] not in '.K':
                        res[y][x] = 'K'
                        break
    return [''.join(r) for r in res]


def squeeze_rows(rows, rx, k):
    """The rows narrowed to k of their width around column rx (outline taken off first)."""
    rows = [r.replace('K', '.') for r in rows]
    w = len(rows[0])
    out = []
    for r in rows:
        line = []
        for x in range(w):
            sx = rx + (x - rx) / k
            i = int(math.floor(sx + 0.5))
            line.append(r[i] if 0 <= i < w else '.')
        out.append(''.join(line))
    return out


def paste(rows, part, at):
    """Paste part (rows, anchor name -> point) with its 'neck' anchor at the point at."""
    g, an = part
    nx, ny = an['neck']
    x0, y0 = int(round(at[0] - nx)), int(round(at[1] - ny))
    out = [list(r) for r in rows]
    for j, r in enumerate(g):
        for i, ch in enumerate(r):
            if ch != '.' and 0 <= y0 + j < len(out) and 0 <= x0 + i < len(out[0]):
                out[y0 + j][x0 + i] = ch
    return [''.join(r) for r in out]


def turn():
    """The turn (played: narrowing in the old facing 0, 1, then widening in the new one 1, 0):
    frame 0 the 3/4 view (the body narrowed, the 3/4 head), frame 1 the front view (drawn: the
    broad chest, both arms at the sides, the front head with the wide peak, the boots to us)."""
    # 0: three quarters: the side body without its head, narrowed, the 3/4 head on its neck
    up = A.up(torso='up', head='none', near=hand((2, 9), 'rest', bend=1), far=INSIDE)
    rows, root, j = X.humanoid(up, legs((0, -17), (-4, -4), (4, -4)))
    rx, k = root[0], 0.9
    body = squeeze_rows(rows, rx, k)
    nk = j['torso.neck']
    nk = (rx + (nk[0] - rx) * k, nk[1])
    f0 = X.Frame(outline(paste(body, P.HEADS['q34'], nk)), root,
                 pts={'hand': (rx + (j['armN.wrist'][0] - rx) * k, j['armN.wrist'][1]),
                      'head': (nk[0] + 2, nk[1] - 7), 'hip': j['pel']})
    # 1: front: drawn as one symmetric figure
    upf = A.up(torso='front', head='front', near=hand((0.5, 12.5), 'fist', bend=1),
               far=hand((-0.5, 12.5), 'fist', bend=-1))
    lo = legs((0, -17), (-4, -4), (4, -4), 'front', 'front')
    lo['legF']['hip'] = (-3, 0)
    lo['legN']['hip'] = (3, 0)
    lo['view'] = 'front'
    f1 = fig(upf, lo)
    f1.joints = {}
    return [f0, f1]


# ------------------------------------------------------------------------------------ build
# Logic time (the contract): idle 60, in-talk 6, in-wave 6, salute 70 (the salute mode's own 70
# ticks, one pass; the old 40-tick strip looped inside it and cut mid-chuckle), talk 32, turn 4,
# wave 20. The transitions and the turn keep 2 frames at
# PERSON_TR_TICKS 3 and PERSON_TURN_TICKS 2 (entities.ts indexes them by those constants).
DURATIONS = {
    'idle': [16, 14, 16, 14],
    'in-talk': [3, 3],
    'in-wave': [3, 3],
    'salute': [4, 3, 4, 6, 12, 12, 17, 12],     # 70 ticks = the mode
    'talk': [4] * 8,
    'turn': [2, 2],
    'wave': [4, 3, 3, 4, 3, 3],
}

# How much lower his feet stand in the stand's box than the old 38-px figure's (G - 8): the new
# figure is 43 px tall, so the cap top stays in the hatch (top at G - 46, the hatch's inner top
# row; the counter front hides him from G - 28 down). The section's hook reads it (B_VENDOR).
STAND_DY = 5


def build(s):
    s.strip('idle', idle(), DURATIONS['idle'], cls='idle')
    s.strip('in-talk', in_talk(), DURATIONS['in-talk'], loop=False, cls='turn')
    s.strip('in-wave', in_wave(), DURATIONS['in-wave'], loop=False, cls='turn')
    s.strip('salute', salute(), DURATIONS['salute'], cls='victory')
    s.strip('talk', talk(), DURATIONS['talk'], cls='idle-fidget')
    s.strip('turn', turn(), DURATIONS['turn'], cls='turn')
    s.strip('wave', wave(), DURATIONS['wave'], cls='victory')
    s.event('STAND_DY', STAND_DY)
