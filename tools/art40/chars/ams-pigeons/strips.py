# The strips of the pigeon flock (contract: docs/design/ams40/contract.md "pigeon flock"). One bird,
# drawn per bird by AmsPigeons (src/game/content/missions/ams/ambient.ts) with a flip.
#
# idle     4 frames, breathing: the head turns a little, a blink, the tail ticks (48 t loop).
# peck     the 16-tick peck act (logic time: the act timer 16): the head pulls back (anticipation),
#          drives down in 2 fast frames, hits the floor with the tail up as the counterweight, a
#          second quick peck, then up and a swallow (settle).
# walk     12 frames, 32 ticks (the old 8-tick step alternation: one step per 16 ticks): the pigeon's
#          head-bob (the head holds still in the world while the body walks under it, then thrusts
#          forward), the tail ticking with each step; 'plant' on the planted foot for the foot gate
#          at 0.125 px / tick (0.5 px every 4 ticks).
# takeoff  the startle and take-off in the 6 logic ticks of the old crouch + push-off: crouch with the
#          head up, the wings flick open, the wings up with the legs pushing, the first downstroke
#          (smear), the wings down with the legs dangling, the recovery; then the fly cycle.
# fly      the wingbeat, 8 frames of 1 tick (the old 8-tick flap cycle: 4 up + 4 down), the body
#          lifting on the downstroke.
#
# Events (frame indices the game composes the old 5-role strip npc/ams/ams-pigeons from, in
# src/game/content/missions/ams/npc.art.ts): PIGEON_STAND (idle), PIGEON_PECK (peck), PIGEON_STEP
# (walk), PIGEON_FLAP_A / PIGEON_FLAP_B (fly: wings up, wings down).
import art40 as X

from . import parts as P

PECK_TICKS = 16          # ambient.ts: the peck act's timer (logic time)
TAKEOFF_TICKS = 6        # ambient.ts: the take-off before the flap (logic time)
FLAP_TICKS = 8           # ambient.ts: the old flap cycle (4 + 4 ticks)


def F(smear=False, **kw):
    rows, root, joints = P.frame_rows(**kw)
    pts = {}
    return X.Frame(rows, root, pts=pts, smear=smear, joints=joints)


STAND_LEGS = (('far', -2, 0), ('near', 0, 0))


def idle():
    poses = [
        dict(head='head', hx=0, hy=0, tail='level'),
        dict(head='head', hx=1, hy=0, tail='level'),
        dict(head='blink', hx=1, hy=0, tail='level'),
        dict(head='head', hx=0, hy=0, tail='down'),
    ]
    return [F(legs=STAND_LEGS, **p) for p in poses], [16, 10, 6, 16]


def peck():
    poses = [
        (dict(head='head', hx=-1, hy=-1, tail='level'), 2),            # anticipation: up and back
        (dict(head='head', hx=1, hy=2, tail='level'), 1),              # drive
        (dict(head='down', hx=2, hy=4, tail='up'), 1),                 # drive
        (dict(head='down', hx=3, hy=5, tail='up'), 3),                 # contact
        (dict(head='down', hx=3, hy=3, tail='up'), 2),                 # rebound
        (dict(head='down', hx=3, hy=5, tail='up', tdy=-1), 2),         # second peck
        (dict(head='head', hx=1, hy=1, tail='level'), 2),              # up
        (dict(head='head', hx=0, hy=-1, tail='level'), 3),             # the swallow, settle
    ]
    frames = [F(legs=STAND_LEGS, **p) for p, _ in poses]
    durs = [d for _, d in poses]
    assert sum(durs) == PECK_TICKS
    return frames, durs


# The foot track of one leg over the 12 frames: (kind, dx, dy). Stance 7 frames (11, 0..5) while the
# body walks 2.25 px, the swing 5 frames lifted 1 px.
NEAR_TRACK = [('near', 1, 0), ('near', 1, 0), ('near', 0, 0), ('near', 0, 0), ('near', 0, 0), ('near', -1, 0),
              ('up', -1, -1), ('up', 0, -1), ('up', 0, -1), ('up', 1, -1), ('up', 1, -1), ('near', 1, 0)]
HEAD_BOB = [2, 1, 1, 0, 1, 2]           # per step: the hold (the body walks under the head), the thrust
TAIL_TICK = ['level', 'level', 'down', 'down', 'level', 'level']
WALK_T = [3, 3, 2] * 4


def walk():
    frames = []
    for i in range(12):
        near = NEAR_TRACK[i]
        f = NEAR_TRACK[(i + 6) % 12]
        far = ('far' if f[0] == 'near' else 'upf', f[1] - 2, f[2])
        legs = [far, near]
        k = i % 6
        fr = F(legs=legs, head='head', hx=HEAD_BOB[k], hy=1 if k == 5 else 0, tail=TAIL_TICK[k])
        # the planted foot (stance) for the foot gate; with both down the one planted before
        if near[0] == 'near' and i != 11:
            fr.pts['plant'] = fr.joints['footN']
        else:
            fr.pts['plant'] = fr.joints['footF']
        frames.append(fr)
    return frames, WALK_T


def takeoff():
    legs_down = STAND_LEGS
    poses = [
        dict(body='low', head='head', hx=-1, hy=-1, tail='up', legs=legs_down),
        dict(body='low', head='head', hx=0, hy=-1, tail='fan', legs=legs_down, wing='fold'),
        dict(body='stand', by=-1, head='fwd', hx=1, hy=0, tail='fan', legs=(('extf', -1, 1), ('ext', 0, 1)), wing='up', far='up'),
        dict(body='fly', by=-1, head='fwd', hx=1, hy=1, tail='fan', legs=(('extf', -2, 1), ('ext', -1, 1)), wing='mid', smear=True),
        dict(body='fly', by=-2, head='fwd', hx=1, hy=1, tail='fan', legs=(('extf', -3, 0), ('ext', -2, 0)), wing='down'),
        dict(body='fly', by=-2, head='fwd', hx=1, hy=1, tail='fan', legs=(('tuck', -3, -1),), wing='back'),
    ]
    frames = [F(**p) for p in poses]
    return frames, [1] * TAKEOFF_TICKS


FLY = [('up', 'up', 0, 0), ('upmid', 'upmid', 0, 0), ('mid', None, -1, 0), ('down', None, -1, 0),
       ('down', None, -2, 1), ('back', None, -1, 0), ('fold', 'fold', 0, 0), ('fold', 'up', 0, -1)]


def fly():
    frames = [F(body='fly', by=by, head='fwd', hx=1, hy=1, tail='fan', legs=(('tuck', -3, -1),), wing=w, far=fw, wdy=wdy,
                smear=(w == 'mid'))           # the downstroke's fast middle: a smear
              for w, fw, by, wdy in FLY]
    return frames, [1] * FLAP_TICKS


def build(s):
    P.install()
    fr, d = idle()
    s.strip('idle', fr, d, cls='idle-breathing')
    fr, d = peck()
    s.strip('peck', fr, d, loop=False, cls='idle-fidget')
    fr, d = walk()
    s.strip('walk', fr, d, cls='locomotion')
    fr, d = takeoff()
    s.strip('takeoff', fr, d, loop=False, cls='jump')
    fr, d = fly()
    s.strip('fly', fr, d, cls='ride',
            why='the pigeon wingbeat keeps the old 8-tick cycle (4 up + 4 down, about 7.5 beats a second): 8 frames of 1 tick; 12 would slow the beat to a big bird')
    s.event('PIGEON_STAND', 0)          # idle frame: the plain standing bird
    s.event('PIGEON_PECK', 3)           # peck frame: the beak on the floor
    s.event('PIGEON_STEP', 9)           # walk frame: one foot lifted
    s.event('PIGEON_FLAP_A', 0)         # fly frame: wings up
    s.event('PIGEON_FLAP_B', 3)         # fly frame: wings down
