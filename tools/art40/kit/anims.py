# VINCENT animation set at reference fidelity. Poses per frame + hold time in 60 Hz ticks.
# LOWER = legs sprites (carry the pelvis point), UPPER = upper-body sprites (anchored at the pelvis),
# FULL = one-piece sprites (death). The player joins one UPPER and one LOWER frame at the pelvis.
import math

STAND_LEGS = dict(legF=dict(ank=(-5, -4)), legN=dict(ank=(5, -4)))
GUN_HAND = (8, 4)          # near hand target from the near shoulder, pistol forward
SUPPORT = (9, 5)           # far hand target from the far shoulder (under the grip)


def legs(pel, far, near, fs='flat', ns='flat', fb=1, nb=1):
    return dict(pelvis=pel, legF=dict(ank=far, shoe=fs, bend=fb), legN=dict(ank=near, shoe=ns, bend=nb))


# ------------------------------------------------------------------ LOWER
def run_foot(ph):
    ph %= 1.0
    if ph < 0.42:                       # stance: the foot plants in front and slides back
        s = ph / 0.42
        x = 9 - 17 * s
        shoe = 'heel' if s < 0.1 else 'flat' if s < 0.72 else 'toe'
        return (x, -4), shoe
    s = (ph - 0.42) / 0.58              # swing: lift behind, knee drives forward, reach
    x = -8 + 17 * (1 - math.cos(math.pi * s)) / 2
    y = -4 - 8 * math.sin(math.pi * min(1.0, s * 1.15)) ** 0.9
    shoe = 'back' if s < 0.3 else 'hang' if s < 0.8 else 'flat'
    return (x, y), shoe


def run_lower(i, n=12):
    ph = i / n
    (na, ns) = run_foot(ph)
    (fa, fs) = run_foot(ph + 0.5)
    bob = 1 if math.cos(4 * math.pi * (ph - 0.12)) > 0.2 else 0
    return legs((0, -17 + bob), fa, na, fs, ns)



def crawl_foot(ph):
    ph %= 1.0
    if ph < 0.6:
        s = ph / 0.6
        return (5 - 9 * s, -4), 'flat'
    s = (ph - 0.6) / 0.4
    return (-4 + 9 * (1 - math.cos(math.pi * s)) / 2, -4 - 3 * math.sin(math.pi * s)), 'toe' if s < 0.4 else 'flat'


def crawl_lower(i, n=7):
    ph = i / n
    na, ns = crawl_foot(ph)
    fa, fs = crawl_foot(ph + 0.5)
    bob = 1 if (i % 7) in (2, 5) else 0
    return legs((0, -11 + bob), fa, na, fs, ns)


CROUCH = legs((0, -11), (-6, -3), (5, -4), 'toe', 'flat')

LOWER = {
  'stand': [(legs((0, -17), (-5, -4), (5, -4)), 60)],
  'run': [(run_lower(i), 3) for i in range(12)],
  # standing jump: squat, push, rise (knees up), apex tuck, fall (reach down), land squat
  'jump': [
    (legs((0, -14), (-5, -4), (5, -4)), 3),
    (legs((0, -18), (-3, -1), (3, -1), 'hang', 'hang'), 4),
    (legs((0, -17), (-4, -6), (4, -5), 'hang', 'hang'), 6),
    (legs((0, -17), (-2, -9), (6, -9), 'hang', 'flat'), 8),
    (legs((0, -17), (-4, -4), (4, -3), 'hang', 'hang'), 6),
    (legs((0, -13), (-5, -4), (5, -4)), 5),
  ],
  # running jump: a split stride in the air
  'jumprun': [
    (legs((0, -16), (-7, -3), (6, -4), 'toe', 'flat'), 3),
    (legs((0, -17), (-9, -6), (7, -7), 'back', 'flat'), 5),
    (legs((0, -17), (-8, -8), (8, -8), 'back', 'flat'), 8),
    (legs((0, -17), (-6, -7), (8, -6), 'back', 'heel'), 6),
    (legs((0, -17), (-5, -4), (7, -3), 'hang', 'heel'), 5),
    (legs((0, -14), (-6, -4), (6, -4)), 5),
  ],
  'crouchdown': [(legs((0, -15), (-5, -4), (5, -4)), 2), (legs((0, -13), (-6, -3), (5, -4), 'toe', 'flat'), 2)],
  'crouch': [(CROUCH, 60)],
  'crawl': [(crawl_lower(i), 5) for i in range(7)],
}

# ------------------------------------------------------------------ UPPER
def up(torso='up', head='fwd', tor=(0, 0), hd=(0, 0), near=None, far=None, fx=None, items=None):
    p = dict(torso=torso, head=head, tor=tor, hd=hd)
    if near:
        p['armN'] = near
    if far:
        p['armF'] = far
    if fx:
        p['fx'] = fx
    if items:
        p['items'] = items
    return p


def gun(hand=GUN_HAND, aim='fwd', bend=-1, sh=(0, 0), z=None):
    a = dict(hand=hand, end=('gun', aim), bend=bend, sh=sh)
    if z is not None:
        a['z'] = z
    return a


def hand(h=SUPPORT, kind='fist', lib='fist', bend=-1, sh=(0, 0), z=None):
    a = dict(hand=h, end=(lib, kind), bend=bend, sh=sh)
    if z is not None:
        a['z'] = z
    return a


def idle_upper(k):
    by = [0, 0, 1, 1][k]
    hy = [0, 1, 1, 0][k]
    return up(tor=(0, by), hd=(0, hy - by), near=gun((8, 4)), far=hand((9, 5)))


def run_upper(i, n=12):
    """Run: the body tilts forward as one straight block; both hands stay on the pistol (a free arm
    pumping behind the back read as a hump)."""
    ph = i / n
    sway = round(0.7 * math.sin(4 * math.pi * ph))
    hd = (0, 1 if (i % 6) in (1, 2) else 0)
    return up(torso='lean', hd=hd, near=gun((9, 3 + sway)), far=hand((10 + 0.6 * math.cos(2 * math.pi * ph), 4.5 + sway)))


MZ = ('armN', 'muzzle', 0, 0)


def shoot_set(torso='up', hd=(0, 0), base=(8, 4)):
    bx, by = base
    seq = [((bx + 1, by), 'ff0', 'shout', 2), ((bx, by - 0.5), 'ff1', 'shout', 2), ((bx - 1.5, by - 1), 'ff2', 'shout', 2),
           ((bx - 1, by - 0.5), 'fsm', 'fwd', 3), ((bx - 0.5, by), None, 'fwd', 3), ((bx, by), None, 'fwd', 3),
           ((bx, by), None, 'fwd', 4), ((bx, by), None, 'fwd', 4), ((bx, by), None, 'fwd', 4), ((bx, by), None, 'fwd', 4)]
    out = []
    for k, (hnd, f, head, t) in enumerate(seq):
        fx = [(f, MZ if f != 'fsm' else ('armN', 'muzzle', -1 + k // 2, -1 - k // 3))] if f else None
        out.append((up(torso=torso, head=head, hd=hd, near=gun(hnd), far=hand((hnd[0] + 1, hnd[1] + 1.5)), fx=fx), t))
    return out


def shootup_set():
    U0 = (7.5, -6.5)   # the shoulder lifts forward (sh) so the arm passes in front of the chin, not the face
    seq = [(U0, 'fu0', 'up', 2), ((7.5, -6), 'fu1', 'up', 2), ((7.5, -5.5), 'fu2', 'up', 2), ((7.5, -5.5), 'fusm', 'up', 3),
           ((7.5, -6), None, 'up', 3), (U0, None, 'up', 3), (U0, None, 'up', 4), (U0, None, 'up', 4),
           (U0, None, 'up', 4), (U0, None, 'up', 4)]
    out = []
    for k, (hnd, f, head, t) in enumerate(seq):
        fx = [(f, MZ)] if f else None
        out.append((up(head=head, near=gun(hnd, 'up', sh=(3.5, -1.5)), far=hand((8, 4), 'fist')), t))
        if fx:
            out[-1][0]['fx'] = fx
    return out


def shootdown_set():
    seq = [((2, 8), 'fd0', 2), ((2, 7.5), 'fd1', 2), ((2, 7), 'fd2', 2), ((2, 7), None, 3), ((2, 7.5), None, 3),
           ((2, 8), None, 3), ((2, 8), None, 4), ((2, 8), None, 4), ((2, 8), None, 4), ((2, 8), None, 4)]
    out = []
    for hnd, f, t in seq:
        p = up(torso='lean', head='down', near=gun(hnd, 'down'), far=hand((7, 1), 'fist'))
        if f:
            p['fx'] = [(f, MZ)]
        out.append((p, t))
    return out


def jump_upper():
    fars = [(9, 6), (4, 7), (6, 3), (7, 1), (8, 3), (9, 5)]
    near = [(8, 5), (8, 3), (8, 3), (8, 4), (8, 4), (8, 5)]
    tor = ['lean', 'up', 'up', 'up', 'up', 'lean']
    ts = [3, 4, 6, 8, 6, 5]
    return [(up(torso=tor[k], near=gun(near[k]), far=hand(fars[k], bend=1 if fars[k][1] < 0 else -1)), ts[k]) for k in range(6)]


def grenade_set():
    S = []
    low = gun((6, 6), 'low')
    S.append((up(torso='up', head='fwd', near=low, far=hand((-3, 6), 'grenade', 'hand')), 3))
    S.append((up(torso='back', head='shout', near=low, far=hand((-7, 1), 'grenade', 'hand')), 5))
    S.append((up(torso='back', head='shout', near=low, far=hand((-6, -4), 'grenade', 'hand', bend=1)), 2))
    S.append((up(torso='lean', head='shout', near=low, far=hand((9, -3), 'open', 'hand', bend=1, z=6.5)), 3))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((9, 1), 'open', 'hand', z=6.5)), 5))
    S.append((up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), 6))
    return S


def slash_set():
    low = gun((5, 8), 'low')
    S = []
    S.append((up(torso='up', head='shout', near=low, far=hand((6, -5), 'knifeup', 'hand', z=6.5)), 3))
    S.append((up(torso='back', head='shout', near=low, far=hand((4, -7), 'knifeup', 'hand', z=6.5)), 3))
    S.append((up(torso='lean', head='shout', near=low, far=hand((9, -3), 'knife', 'hand', bend=1, z=6.5),
                 fx=[('slash1', (3, -26))]), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((9, 4), 'knifedown', 'hand', bend=-1, z=6.5),
                 fx=[('slash2', (3, -26))]), 3))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((8, 6), 'knife', 'hand', bend=-1, z=6.5),
                 fx=[('slash3', (3, -26))]), 4))
    S.append((up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), 6))
    return S


def stab_set():
    low = gun((5, 8), 'low')
    S = []
    S.append((up(torso='back', head='fwd', near=low, far=hand((1, 5), 'knife', 'hand')), 4))
    S.append((up(torso='lean', head='shout', near=low, far=hand((9, 1), 'knife', 'hand', z=6.5)), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((10, 0.5), 'knife', 'hand', z=6.5),
                 fx=[('stab', ('armF', 'tip', 1, 0))]), 3))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((10, 0.5), 'knife', 'hand', z=6.5)), 4))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((6, 4), 'knife', 'hand', z=6.5)), 4))
    S.append((up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), 6))
    return S


def fidget_set():
    low = gun((6, 7), 'low')
    F = []
    def f(far, head='fwd', hd=(0, 0), t=8, torso='up'):
        F.append((up(torso=torso, head=head, hd=hd, near=low, far=far), t))
    f(hand((7, 2), 'inside', 'hand', z=6.5), t=8)
    f(hand((7, 1), 'inside', 'hand', z=6.5), 'down', t=6)
    f(hand((8, 0), 'paper', 'hand', z=6.5), 'down', t=6)
    f(hand((9, 4), 'paper', 'hand', z=6.5), 'down', t=8)
    f(hand((9, 4), 'plan', 'hand', z=6.5), 'read', t=12)
    f(hand((9, 4), 'plan', 'hand', z=6.5), 'read2', t=16)
    f(hand((9, 4), 'plan', 'hand', z=6.5), 'read', t=16)
    f(hand((9, 4), 'plan', 'hand', z=6.5), 'smug', t=14)
    f(hand((9, 4), 'plan', 'hand', z=6.5), 'smug', (0, 1), t=8)
    f(hand((9, 4), 'plan', 'hand', z=6.5), 'smug', t=10)
    f(hand((9, 4), 'paper', 'hand', z=6.5), 'fwd', t=8)
    f(hand((7, 1), 'inside', 'hand', z=6.5), 'fwd', t=8)
    f(hand((9, 5)), 'blink', t=6)
    F[-1] = (up(head='blink', near=gun((8, 4)), far=hand((9, 5))), 6)
    F.append((up(head='fwd', near=gun((8, 4)), far=hand((9, 5))), 10))
    return F


UPPER = {
  'idle': [(idle_upper(k), 9) for k in range(4)],
  'fidget': fidget_set(),
  'run': [(run_upper(i), 3) for i in range(12)],
  'jump': jump_upper(),
  'shoot': shoot_set(),
  'aimup': [(up(head='fwd', near=gun((8, -3), 'dup', sh=(1.5, -0.5)), far=hand((9, 3))), 2), (up(head='up', near=gun((7.5, -6.5), 'up', sh=(3.5, -1.5)), far=hand((8, 4))), 2)],
  'shootup': shootup_set(),
  'aimdown': [(up(torso='lean', head='down', near=gun((6, 6), 'ddown'), far=hand((8, 3))), 2),
              (up(torso='lean', head='down', near=gun((2, 8), 'down'), far=hand((7, 1))), 2)],
  'shootdown': shootdown_set(),
  'crouchidle': [(up(torso='lean2', tor=(0, k // 2), hd=(1, [0, 1, 0, 0][k]), near=gun((9, 3)), far=hand((10, 4))), 9) for k in range(4)],
  'crouchshoot': shoot_set(torso='lean2', hd=(1, 0), base=(9, 3)),
  'grenade': grenade_set(),
  'slash': slash_set(),
  'stab': stab_set(),
}

# ------------------------------------------------------------------ FULL (death)
def death_set():
    D = []
    def d(rot, pel, far, near, fs, ns, head='hurt', armN=(4, -3), armF=(-3, -4), t=4, items=None, aim='fwd', torso='up'):
        p = dict(pelvis=pel, rot=rot, torso=torso, head=head,
                 legF=dict(ank=far, shoe=fs), legN=dict(ank=near, shoe=ns),
                 armN=dict(hand=armN, end=('gun', aim) if aim else ('fist', 'fist'), bend=1),
                 armF=dict(hand=armF, end=('hand', 'open'), bend=1))
        if items:
            p['items'] = items
        D.append((p, t))
    d(0, (0, -17), (-5, -4), (5, -4), 'flat', 'flat', 'hurt', (7, 3), (-6, -1), 4, torso='back')
    d(12, (-2, -16), (-6, -4), (5, -4), 'flat', 'toe', 'hurt', (7, 0), (-6, -3), 4)
    d(28, (-4, -14), (-7, -4), (4, -6), 'toe', 'hang', 'hurt', (6, -4), (-5, -4), 4)
    d(48, (-6, -11), (-8, -4), (3, -9), 'toe', 'hang', 'hurt', (1, -9), (-6, -2), 4, aim=None,
      items=[('pistol', (8, -16), 20)])
    d(70, (-8, -7), (-4, -6), (6, -11), 'hang', 'heel', 'hurt', (-2, -8), (-6, 0), 4, aim=None,
      items=[('pistol', (11, -9), 20)])
    d(88, (-10, -4), (2, -9), (8, -12), 'heel', 'heel', 'hurt', (-5, -5), (-5, 2), 3, aim=None,
      items=[('pistol', (13, -3), 20)])
    d(90, (-10, -3), (5, -5), (10, -6), 'lie', 'lie', 'hurt', (-6, -2), (-5, 3), 4, aim=None,
      items=[('pistol', (15, -2), 20)])
    d(86, (-10, -4), (4, -7), (9, -8), 'lie', 'lie', 'hurt', (-6, -3), (-5, 2), 4, aim=None,
      items=[('pistol', (15, -2), 20)])
    d(90, (-10, -3), (6, -3), (11, -3), 'lie', 'lie', 'hurt', (-6, -1), (-5, 3), 6, aim=None,
      items=[('pistol', (15, -2), 20)])
    d(90, (-10, -3), (6, -3), (11, -3), 'lie', 'lie', 'blink', (-6, -1), (-5, 3), 40, aim=None,
      items=[('pistol', (15, -2), 20)])
    return D


FULL = {'death': death_set()}

# the melee group's name on the page (a hero with another melee weapon renames it); the melee
# animations keep the keys 'slash' and 'stab' so the demo state machine stays the same
MELEE_TITLE = 'Knife'
# muzzle flashes that start a shot: the page spawns one bullet per such effect, at that muzzle
SHOT_FX = {'ff0', 'fu0', 'fd0'}
# the bullet direction of each first flash (degrees, 0 = forward, -90 = up, 90 = down); the page
# uses it for the bullet (a flash with no entry fires along the current aim)
SHOT_DIR = {'ff0': 0, 'fu0': -90, 'fd0': 90}

# reference frame counts per group, for the page (sheet.py); 'Knife' shows as MELEE_TITLE
GROUPS = [
  ('Idle', [('idle', 'stand')], 4),
  ('Idle fidget', [('fidget', 'stand')], None),
  ('Run', [('run', 'run')], 12),
  ('Jump', [('jump', 'jump'), ('jump', 'jumprun')], 6),
  ('Crouch', [(None, 'crouchdown'), ('crouchidle', 'crouch'), ('crouchidle', 'crawl')], 7),
  ('Shoot forward', [('shoot', 'stand')], 10),
  ('Shoot up', [('aimup', 'stand'), ('shootup', 'stand')], 10),
  ('Shoot down in jump', [('aimdown', 'jump'), ('shootdown', 'jump')], None),
  ('Crouch shoot', [('crouchshoot', 'crouch')], 10),
  ('Grenade throw', [('grenade', 'stand')], 6),
  ('Knife', [('slash', 'stand'), ('stab', 'stand')], 6),
  ('Death', [('death', None)], None),
]
