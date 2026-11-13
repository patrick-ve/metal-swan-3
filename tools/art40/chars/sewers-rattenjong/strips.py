# DE RATTENJONG's strips (king.ts setPose names) and their eyes-only strips.
import math

import art40 as X
import rig

from . import body as B
from . import poses as PO

TPF = 6
WHY_TIME = 'king.ts plays the pose by time at 6 ticks a frame and wraps it; the hold is {} ticks'


def frame(pic):
    rows, root, eyes = B.finish(pic)
    return X.Frame(rows, root), eyes


def eyes_frame(rows, root, eyes):
    g = [['.'] * len(rows[0]) for _ in rows]
    for x, y, ch in eyes:
        g[y][x] = ch
    return X.Frame([''.join(r) for r in g], root)


def glint_shift(f, eyes):
    """On odd frames the eye's glint sits one pixel on (the eye glistens; an eyes strip never
    holds two identical frames in a row)."""
    rows = [list(r) for r in f.rows]
    at = {(x, y): ch for x, y, ch in eyes}
    for (x, y), ch in list(at.items()):
        if ch == 'E' and at.get((x + 1, y)) == 'R':
            at[(x, y)], at[(x + 1, y)] = 'R', 'E'
            rows[y][x], rows[y][x + 1] = 'R', 'E'
            break
    return X.Frame([''.join(r) for r in rows], f.root), [(x, y, ch) for (x, y), ch in at.items()]


def add(s, name, pics, cls, why=None, loop=True, eyes=True):
    frames, eyel = [], []
    for i, pic in enumerate(pics):
        f, e = frame(pic)
        if i % 2:
            f, e = glint_shift(f, e)
        frames.append(f)
        eyel.append(eyes_frame(f.rows, f.root, e))
    s.strip(name, frames, TPF, loop=loop, cls=cls, why=why)
    if eyes:
        s.strip(name + '-eyes', eyel, TPF, loop=loop, cls='overlay',
                why='the eyes alone of the pose strip, frame for frame (king.ts drawEyes: emitters in the dark)')
    return frames


def gait(ph, stance=0.5, reach=11.0, lift=4.0):
    """One foot over a cycle: on the ground moving back for `stance`, then swung forward."""
    ph %= 1.0
    if ph < stance:
        return (reach - 2 * reach * ph / stance, 0)
    s = (ph - stance) / (1 - stance)
    return (-reach + 2 * reach * (1 - math.cos(math.pi * s)) / 2, lift * math.sin(math.pi * s))


def tail_wave(k, n, amp=3.0, base=None, cr=0):
    base = base or [(-30, -24), (-44, -19), (-56, -14), (-66, -9), (-74, -6), (-80, -4)]
    out = []
    for i, (x, y) in enumerate(base):
        w = amp * (i / (len(base) - 1)) * math.sin(2 * math.pi * k / n - i * 0.9)
        out.append((x, y + w + (cr if i < 3 else 0)))
    return out


def build(s):
    # ---- seated on the throne
    br = [0, 1, 1, 2, 2, 1, 1, 0]
    sway = [0, 1, 2, 2, 1, 0, -1, -1]
    sit = []
    for k in range(8):
        tl = [(x + (sway[k] * i * 0.35 if i > 2 else 0), y - (sway[k] * i * 0.25 if i > 2 else 0)) for i, (x, y) in enumerate(PO.SIT_TAIL)]
        sit.append(PO.sit(dict(br=br[k], tail=tl, mouth=1 if k in (3, 4) else 0)))
    add(s, 'sit', sit, 'idle-breathing')
    add(s, 'lift', [PO.sit(dict(arms='grab', mouth=1, look=8, br=1)), PO.sit(dict(arms='up', mouth=1, look=10, br=2, arm=(0, -1)))],
        'telegraph', why=WHY_TIME.format('the tell (bike 30, scooter 24)'))
    add(s, 'shove', [PO.sit(dict(arms='push', lean=3, mouth=1)), PO.sit(dict(arms='push', lean=4, mouth=2, arm=(1, 1)))],
        'telegraph', why=WHY_TIME.format('the tell (24)'))
    add(s, 'throw', [PO.sit(dict(arms='out', lean=5, mouth=2)), PO.sit(dict(arms='out', lean=4, mouth=2, arm=(2, 2))),
                     PO.sit(dict(arms='push', lean=2, mouth=1, arm=(-4, 0)))],
        'throw', why=WHY_TIME.format('14 (the release, the follow-through, the settle)'), loop=False)
    add(s, 'squeak', [PO.sit(dict(arms='clutch', mouth=2, look=14, flash=True, br=2, arm=(1, 2))), PO.sit(dict(arms='clutch', mouth=2, look=20, br=2, arm=(0, -1))),
                      PO.sit(dict(arms='clutch', mouth=2, look=16, br=1, hy=-1, arm=(1, 1))), PO.sit(dict(arms='clutch', mouth=1, look=12, br=1))],
        'telegraph', why=WHY_TIME.format('the tell (40) and the intro (70)'))
    add(s, 'crouch', [PO.sit(dict(crouch=5, lean=3, mouth=2, flash=True, arms='push', arm=(-3, 4))),
                      PO.sit(dict(crouch=7, lean=4, mouth=2, arms='push', arm=(-3, 5)))],
        'telegraph', why=WHY_TIME.format('the tell (40): coiled to jump down'))
    # ---- on all fours
    walk = []
    for k in range(8):
        ph = k / 8
        legs = {'FN': gait(ph), 'HF': gait(ph), 'FF': gait(ph + 0.5), 'HN': gait(ph + 0.5)}
        bob = 1 if k % 4 in (1, 2) else 0
        walk.append(PO.fours(dict(legs=legs, bob=bob, tail=tail_wave(k, 8, cr=bob), mouth=0)))
    add(s, 'walk', walk, 'locomotion', why=WHY_TIME.format('8 x 6 = 48 (a 48 px stride at 1 px/tick)'))
    charge = []
    for k in range(6):
        ph = k / 6
        legs = {'FN': gait(ph, 0.4, 14, 6), 'FF': gait(ph + 0.12, 0.4, 14, 6),
                'HN': gait(ph + 0.5, 0.4, 14, 6), 'HF': gait(ph + 0.62, 0.4, 14, 6)}
        bob = [0, -2, -3, -1, 1, 0][k]
        charge.append(PO.fours(dict(legs=legs, bob=bob, low=8, mouth=1, tilt=[0, 3, 4, 1, -3, -2][k],
                                    tail=tail_wave(k, 6, amp=4, cr=bob))))
    add(s, 'charge', charge, 'locomotion', why=WHY_TIME.format('6 x 6 = 36: a gallop at 3.2 px/tick'))
    add(s, 'rear', [PO.fours(dict(tilt=38, mouth=2, flash=True)), PO.fours(dict(tilt=46, mouth=2, look=40)),
                    PO.fours(dict(tilt=44, mouth=2, look=48, legs={'FN': (2, 2), 'FF': (1, 3)}))],
        'telegraph', why=WHY_TIME.format('the tell (30): he rears and screeches'))
    add(s, 'daze', [PO.fours(dict(daze=k + 1, crouch=2 + (k % 2), mouth=1, look=-6)) for k in range(4)],
        'reaction', why=WHY_TIME.format('60: dazed after a charge, stars round his crown'))
    up_tail = [(-30, -24), (-40, -28), (-44, -40), (-40, -52), (-32, -58), (-26, -56)]
    add(s, 'tail-up', [PO.fours(dict(tail=up_tail, flash=True, mouth=1)),
                       PO.fours(dict(tail=[(x + (i > 2), y - (i > 3)) for i, (x, y) in enumerate(up_tail)], mouth=1)),
                       PO.fours(dict(tail=[(x - (i > 2), y + (i > 4)) for i, (x, y) in enumerate(up_tail)], mouth=1, crouch=1))],
        'telegraph', why=WHY_TIME.format('the tell (24): the tail rises'))
    sw = []
    for k in range(6):
        reach = [66, 78, 80, 76, 70, 58][k]
        pts = [(-30, -22), (-30 - reach * 0.25, -10), (-30 - reach * 0.5, -6), (-30 - reach * 0.75, -4), (-30 - reach, -3)]
        pic = PO.fours(dict(tail=pts, crouch=2, mouth=1, look=-4))
        if 1 <= k <= 3:
            # the dust the tail whips up along the floor (FX soot, no outline)
            x1 = -30 - reach
            for x in range(int(x1) + 2, int(x1) + 28 + 6 * k):
                y = -2 - (1 if (x * 7 + k) % 5 == 0 else 0)
                pic.fxo.append((x, y, 'D' if (x + k) % 3 else 'd'))
                if (x * 3 + k) % 4 == 0:
                    pic.fxo.append((x, y - 1, 'd'))
        sw.append(pic)
    add(s, 'sweep', sw, 'melee', why=WHY_TIME.format('12 live + 26 recovery'))
    add(s, 'bite-tell', [PO.fours(dict(tilt=8, mouth=2, flash=True, lunge=-3)), PO.fours(dict(tilt=10, mouth=2, lunge=-4)),
                         PO.fours(dict(tilt=9, mouth=2, lunge=-4, crouch=1))],
        'telegraph', why=WHY_TIME.format('the tell (20): the jaws wide, drawn back'))
    add(s, 'bite', [PO.fours(dict(low=4, lunge=8, mouth=2)), PO.fours(dict(low=4, lunge=9, mouth=0)),
                    PO.fours(dict(low=3, lunge=6, mouth=0)), PO.fours(dict(low=2, lunge=3, mouth=1)),
                    PO.fours(dict(low=1, lunge=1, mouth=0))],
        'melee', why=WHY_TIME.format('6 live + 24 recovery: the snap, the hold, the pull back'), loop=False)
    jl = [
        dict(crouch=4, tilt=6, mouth=2, legs={'FN': (4, 0), 'FF': (2, 0), 'HN': (-2, 0), 'HF': (-4, 0)}),
        dict(tilt=16, mouth=2, legs={'FN': (8, 6), 'FF': (6, 5), 'HN': (-10, 2), 'HF': (-12, 1)}),
        dict(tilt=8, mouth=2, legs={'FN': (10, 8), 'FF': (8, 8), 'HN': (-12, 6), 'HF': (-14, 5)}),
        dict(tilt=0, mouth=2, legs={'FN': (8, 9), 'FF': (7, 9), 'HN': (-6, 8), 'HF': (-8, 7)}),
        dict(tilt=-8, mouth=2, legs={'FN': (10, 4), 'FF': (8, 5), 'HN': (-4, 8), 'HF': (-6, 8)}),
        dict(tilt=-4, crouch=3, mouth=1, legs={'FN': (6, 0), 'FF': (4, 0), 'HN': (-4, 2), 'HF': (-6, 2)}),
    ]
    add(s, 'jump', [PO.fours(p) for p in jl], 'jump', why=WHY_TIME.format('36: the leap off the pile'), loop=False)
    tumble(s)


def tumble(s):
    """Washed away: the seated king curled up, rolled round in 8 steps (no eyes strip). The anchor
    is the roll's centre plus 20 px (the stand-in's). The rotation runs on the figure without its
    outline; stray pixels are folded into their neighbours and the outline is drawn again."""
    pic = PO.sit(dict(mouth=2, flash=True, arms='clutch', crouch=4))
    bare = pic.cv.finish(outline=False)
    ys = [y for y, r in enumerate(bare) if r.strip('.')]
    xs = [x for r in bare for x, ch in enumerate(r) if ch != '.']
    c = ((min(xs) + max(xs)) // 2, (min(ys) + max(ys)) // 2)
    out = []
    for k in range(8):
        r = rig.rotsprite(bare, c, -45 * k)
        out.append(X.Frame(reoutline(r), (c[0], c[1] + 20)))
    s.strip('tumble', out, TPF, cls='death-shot', why=WHY_TIME.format('the wash: he rolls off down the channel'))


def reoutline(rows):
    g = [list(r) for r in rows]
    h, w = len(g), len(g[0])
    at = lambda x, y: g[y][x] if 0 <= x < w and 0 <= y < h else '.'
    for _ in range(2):
        for y in range(h):
            for x in range(w):
                ch = g[y][x]
                if ch == '.':
                    continue
                nb = [at(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
                if ch in nb:
                    continue
                opaque = [q for q in nb if q != '.']
                if len(opaque) < 3:
                    g[y][x] = '.'
                else:
                    g[y][x] = max(sorted(set(opaque)), key=opaque.count)
    out = [r[:] for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] == '.' and any(at(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    return [''.join(r) for r in out]
