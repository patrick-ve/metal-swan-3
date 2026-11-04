# The stage 1 strips of the Swan (slug 'swan', prefix vehicle/swan, P2 vehicle/swan-mute): the
# ground and the riderless strips, their -front overlays, the egg and the scuffs decal.
#
# EVERY body frame is chosen by the game (swan.ts show(name, frame) with a held Animator): the
# odometer for run / move (RUN_PX px a frame) and waddle (WADDLE_PX), the strip's own durations
# for the timed strips (frameAt / the loop over the baked durations), named frames for the roles.
# So the durations below are the game's timing: the logic times stay (plan rule 4): squat 4 ticks,
# land 4, stomp 4, honk 20 (the ring at tick 10 = frame HONK_BLAST), hiss 6, bash 6, tumble 8,
# right 12, shake 8, empty-lay 110 (the egg at tick 52 = frame LAY_EGG_FRAME).
from . import body as B
from . import frames as F
from . import palette
from . import poses as PO

RIDDEN_FRONT = True


def _strip(s, name, poses, durations, cls, why=None, loop=True, front=False, contained=False, seat_dy=0,
           bubble=False, egg_from=None, defer=False):
    rs = [F.render(p) for p in poses]
    kw = lambda i: dict(seat_dy=seat_dy, bubble=bubble, egg=egg_from is not None and i >= egg_from)
    s.strip(name, [F.body_frame(r, contained=contained, **kw(i)) for i, r in enumerate(rs)], durations, loop=loop,
            cls=cls, why=why, defer=defer)
    if front:
        s.strip(name + '-front', [F.front_frame(r, contained=contained, **kw(i)) for i, r in enumerate(rs)], durations,
                loop=loop, cls='overlay', defer=defer)
    return rs


# ------------------------------------------------------------------ props
EGG = ["...KKK...",
       "..KWWwK..",
       ".KWWWwvK.",
       ".KWWwwvK.",
       "KWWwwwvuK",
       "KWwwwvvuK",
       "KwwwvvuuK",
       "KwwvvvuuK",
       ".KvvuuuK.",
       "..KKKKK.."]


def _egg_frames():
    import rig
    out = []
    # 0: it lands (squashed 1 px), 1: a wobble back, 2: a wobble forward and the crack, 3: the lid
    # pops off (the bombs jump out: egg.ts POP_AT 26)
    squash = EGG[:4] + EGG[5:]
    squash = [r[:1] + r[1:-1] + r[-1:] for r in squash]
    squash = ['.' + r + '.' if i < 2 else r[:4] + r[4] + r[4:] for i, r in enumerate(squash)]
    w = max(len(r) for r in squash)
    out.append([r.center(w, '.') for r in squash])
    pad = lambda g: ['.' * 15] * 3 + ['...' + r.ljust(12, '.') for r in g] + ['.' * 15] * 2
    rot = lambda g, d: rig.rotsprite(pad(g), (7.5, 12.5), d)
    out.append(rot(EGG, 12))
    cracked = [r for r in EGG]
    cracked[4] = 'KWKwKwvuK'
    cracked[5] = 'KWwKwKvuK'
    out.append(rot(cracked, -12))
    # the lid lifted 3 px and tipped back one step, the dark inside of the shell below it
    lid = ["....KKK....",
           "...KWWwK...",
           "..KWWWwvK..",
           "..KKKKKKK..",
           "...........",
           "...........",
           "..KK...KK..",
           "..KwKKKuK..",
           "..KwMMMuK..",
           ".KwwwvvuuK.",
           ".KwwvvvuuK.",
           "..KvvuuuK..",
           "...KKKKK..."]
    out.append(lid)
    frames = []
    for g in out:
        g = [r for r in g]
        h = len(g)
        w = max(len(r) for r in g)
        g = [r.ljust(w, '.') for r in g]
        # the anchor: the bottom centre (under the shell)
        low = max(y for y, r in enumerate(g) if r.strip('.'))
        xs = [x for x, ch in enumerate(g[low]) if ch != '.']
        cx = (min(xs) + max(xs) + 1) // 2
        frames.append((g, (cx, low + 1)))
    return frames


SCUFFS = [
    # <= 2 cells: two soot smudges and a scraped, ruffled patch of feathers
    (["....a.......",
      "...aba.....a",
      "....a.....ab",
      "......v.....",
      ".a...vv.....",
      "ab.........."], (6, 3)),
    # <= 1 cell: soot everywhere, a torn feather standing out
    ([".....a........",
      "...aaba....aa.",
      "..abbba...abb.",
      "...aba.v...a..",
      ".a....vuv.....",
      "abb....v...ab.",
      ".a........abb."], (7, 3)),
]


# ------------------------------------------------------------------ build
def build(s):
    # the strips the game rides on the ground (rider + -front overlay)
    _strip(s, 'idle', PO.IDLE, 12, 'idle-breathing', front=True)
    run = _strip(s, 'run', PO.RUN, 3, 'locomotion', front=True)
    _strip(s, 'move', PO.RUN, 3, 'locomotion', front=True)
    _strip(s, 'squat', PO.SQUAT, [2, 2], 'jump', loop=False, front=True,
           why='the 4-tick anticipation of the jump (SWAN.squatTicks); the jump class spans squat 2 + jump 3')
    _strip(s, 'jump', PO.JUMP, [4, 6, 54], 'jump', loop=False, front=True,
           why='push-off, the beat and the held tuck (64 ticks, the old total); squat 2 + jump 3 = the class count')
    _strip(s, 'fall', PO.FALL, 6, 'fall', front=True)
    _strip(s, 'land', PO.LAND, [2, 1, 1], 'land', loop=False, front=True)
    _strip(s, 'stomp', PO.STOMP, [2, 2], 'melee', loop=False, front=True,
           why='SWAN stompT: 4 ticks of the bounce off a head (the slam, the spring)')
    _strip(s, 'skid', PO.SKID, [3, 30, 30], 'land', loop=False, front=True)
    _strip(s, 'crouch', PO.CROUCH, 12, 'idle-breathing', front=True, seat_dy=F.CROUCH_SEAT_DY)
    _strip(s, 'waddle', PO.WADDLE, 4, 'crouch-walk', front=True, seat_dy=F.CROUCH_SEAT_DY)
    _strip(s, 'slide', PO.SLIDE, 3, 'locomotion', front=True, seat_dy=F.CROUCH_SEAT_DY,
           why='a belly slide (no floor contact): a 4-frame chatter the game loops while she slides')
    _strip(s, 'honk', PO.HONK, 2, 'shoot', loop=False, front=True)
    _strip(s, 'wreck', PO.WRECK, 6, 'death-shot', front=True, contained=True,
           why='a held loop while she is doomed (the stagger); the game holds it, no death strip')
    # the riderless strips (the neck, the head and the gun in the picture)
    _strip(s, 'hiss', PO.HISS, [2, 2, 2], 'telegraph', loop=False, contained=True)
    _strip(s, 'bash', PO.BASH, [2, 2, 2], 'melee', loop=False, contained=True,
           why='SWAN.dive.bashTicks: the 6-tick impact (smear), squash and recoil; the tumble follows')
    _strip(s, 'tumble', PO.TUMBLE, [2, 2, 2, 2], 'death-shot', loop=False, contained=True,
           why='SWAN.dive.tumbleTicks: the 8-tick backward roll onto her back (2 smears); no death')
    _strip(s, 'dazed', PO.DAZED, 8, 'idle-fidget', contained=True,
           why='dazed is a 180-tick lying loop (the dizzy feathers are drawn by code), not a death: the fidget class')
    _strip(s, 'right', PO.RIGHT, PO.RIGHT_D, 'respawn', loop=False, contained=True, bubble=True)
    _strip(s, 'shake', PO.SHAKE, PO.SHAKE_D, 'respawn', loop=False, contained=True)
    # parked
    _strip(s, 'empty', PO.EMPTY, 15, 'idle-breathing', contained=True, bubble=True)
    _strip(s, 'empty-look', PO.EMPTY_LOOK, 30, 'roles', contained=True, bubble=True,
           why='frame roles the game picks: behind / ahead x low / high, blink (swan.ts showParked)')
    _strip(s, 'empty-lay', PO.EMPTY_LAY, list(B_LAY), 'respawn', loop=False, contained=True, bubble=True,
           egg_from=PO.LAY_EGG_FRAME)
    # props
    s.strip('egg', [g for g in _egg_frames()], [6, 10, 10, 20], loop=False, cls='prop')
    s.strip('scuffs', [(rows, an) for rows, an in SCUFFS], 6, loop=False, cls='prop')

    s.event('RUN_PX', PO.RUN_PX)
    s.event('RUN_CONTACT_A', PO.RUN_CONTACT_A)
    s.event('RUN_CONTACT_B', PO.RUN_CONTACT_B)
    s.event('WADDLE_PX', PO.WADDLE_PX)
    s.event('HONK_BLAST', PO.HONK_BLAST)
    s.event('LAY_EGG_FRAME', PO.LAY_EGG_FRAME)
    s.event('SKID_CHATTER', 2)
    s.variant(palette_prefix(), palette.P2)


B_LAY = (20, 10, 10, 6, 6, 8, 20, 30)     # constants.ts SWAN.layDurations (the egg at tick 52)


def palette_prefix():
    return 'vehicle/swan-mute'
