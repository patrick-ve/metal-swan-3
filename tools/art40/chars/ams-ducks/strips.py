# The strips of the mallards (contract: docs/design/ams40/contract.md "mallards (drake and hen)").
# AmsDucks (src/game/content/missions/ams/ambient.ts) draws every duck at the canal surface (the root
# row is the water line, plan rule 10): even ducks are drakes, odd ducks hens.
#
# paddle        the contract strip: two blocks of DUCK_PADDLE_N = 12 frames (drake, then hen), each
#               a 32-tick paddle cycle (the old 4 steps of 8 ticks): the body settles 1 px into the
#               water and rises, the head nods forward with the stroke, the tail ticks, the crest of
#               the ripple ring runs back along the body and the wake dash streams behind.
# drake-hurry,  startled (a player close: the code paddles 3x faster): the neck stretched forward,
# hen-hurry     the wings beating half open (3 beats in 18 ticks), spray at the breast and the tail.
# drake-dabble, the idle fidget: the head dips, the duck tips up tail-first (RotSprite tilt of the
# hen-dabble    drawn bird), the feet kick at the surface, it rights itself with the drops flying
#               and shakes its head (43 ticks; the code plays it now and then while calm).
#
# Events: DUCK_DRAKE, DUCK_HEN (the paddle blocks), DUCK_PADDLE_N, DUCK_UP / DUCK_DOWN (the paddle
# frames of a block the old 4-frame strip npc/ams/ams-ducks is composed from in
# src/game/content/missions/ams/npc.art.ts).
import art40 as X

from . import parts as P

PADDLE_T = [3, 3, 2] * 4                  # 32 ticks: the old paddle cycle (4 steps x 8 ticks)
HURRY_T = [2, 1, 2, 1] * 3                # 18 ticks: 3 wingbeats
DABBLE_T = [4, 3, 3, 6, 5, 6, 3, 4, 4, 5]  # 43 ticks

BOB = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]
NOD = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0]
TAIL = [0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0]


def frame(bird, ripple=0, wake=(), splash=(), smear=False, **kw):
    g, joints = P.compose(bird, **kw)
    rows = P.finish(g, ripple, wake, splash)
    return X.Frame(rows, (P.RX, P.RY), pts={}, smear=smear, joints=joints)


def paddle(bird):
    out = []
    for k in range(12):
        wake = (-10 - k // 2,)
        out.append(frame(bird, ripple=k, wake=wake, by=BOB[k], hx=NOD[k], tail=TAIL[k]))
    return out


WINGBEAT = ['up', 'mid', 'down', 'mid']


def hurry(bird):
    out = []
    for k in range(12):
        beat = k % 4
        sp = [(-9 - beat, -1, 'W'), (-10 - beat, -2, 'i')] if beat % 2 == 0 else [(-9, -1, 'i'), (8, -1, 'W')]
        if beat == 0:
            sp.append((7 + (k // 4) % 2, -2, 'i'))
        out.append(frame(bird, ripple=2 * k, wake=(-11 - k % 4,), splash=sp, by=1 if beat == 2 else 0,
                         hx=2, hy=1, tail=-1, wing=WINGBEAT[beat]))
    return out


def dabble(bird):
    poses = [
        dict(hy=-1),                                                       # neck up: anticipation
        dict(dip=True, hx=2, hy=2, splash=[(6, -1, 'W')]),                 # the bill to the water
        dict(dip=True, hx=2, hy=3, by=1, tilt=-30, splash=[(7, -1, 'W'), (5, -2, 'i')]),
        dict(head=False, by=3, tilt=-55, feet=[(-1, 0), (-3, 0)]),         # tail up, the feet kick
        dict(head=False, by=3, tilt=-55, tail=-1, feet=[(0, 0), (-2, 0)]),
        dict(head=False, by=3, tilt=-55, feet=[(-1, 0), (-3, 0)], splash=[(-4, -1, 'i')]),
        dict(dip=True, hx=2, hy=3, by=1, tilt=-30, splash=[(6, -1, 'W'), (4, -1, 'i')]),
        dict(hx=1, hy=-1, splash=[(5, -11, 'i'), (2, -10, 'W'), (7, -9, 'i')]),  # up, the drops fly
        dict(hx=-1, tail=1, splash=[(4, -12, 'i'), (8, -8, 'i')]),         # the head shake
        dict(),                                                            # settle
    ]
    out = []
    for k, p in enumerate(poses):
        sp = p.pop('splash', ())
        out.append(frame(bird, ripple=k, splash=sp, **p))
    return out


def build(s):
    P.install()
    s.strip('paddle', paddle('drake') + paddle('hen'), PADDLE_T * 2, cls='locomotion')
    for bird in ('drake', 'hen'):
        s.strip(f'{bird}-hurry', hurry(bird), HURRY_T, cls='locomotion')
    for bird in ('drake', 'hen'):
        s.strip(f'{bird}-dabble', dabble(bird), DABBLE_T, loop=False, cls='idle-fidget')
    s.event('DUCK_DRAKE', 0)
    s.event('DUCK_HEN', 12)
    s.event('DUCK_PADDLE_N', 12)
    s.event('DUCK_UP', 0)                 # the paddle frame of a block: the body up
    s.event('DUCK_DOWN', 5)               # the paddle frame of a block: the body down
