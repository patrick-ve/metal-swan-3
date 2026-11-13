# THE SPITTER'S SLIME (mission sewers, wave P5 RATS; src/game/content/sewers/rats/spitter.ts): the
# green slime ball in flight, its splat on the floor and the puddle that only looks wet. Drawn with
# the rat rig's shaded ellipsoids (sewers-rat-runner/ratrig.py), lit from the upper front, one warm
# near-black outline, a white glint (FX ramp).
#
#   blob 2      the ball in flight (centre anchor; the projectile's look 'anim', 4 ticks a frame)
#   splat 4     12 ticks (the stand-in's 3 x 4): the ball hits, a crown of slime, the drops fall,
#               it spreads into the puddle (feet anchor: the floor point)
#   puddle 2    looped (30 ticks a frame) for the 120-tick puddle: two glints that move
import math

import art40 as X
import rig

RUN = X.char('sewers-rat-runner')
R = RUN.ratrig

PAL = {'K': '#140c0e', 'G': '#b8f05a', 'g': '#5cae2e', 'h': '#2a6420', 'd': '#17401a', 'W': '#ffffff', 'X': '#fffbd8'}
RAMP = ['G', 'g', 'g', 'h']

SET = X.Set(prefix='fx/sewers-rat-slime', budget=28, face=1, outline='K', hl='G', fx='WX', colours=PAL)


def canvas(w, h):
    rig.DARK.update({'G': 'g', 'g': 'h', 'h': 'd', 'd': 'd'})
    return R.Cv(w, h)


def ell(cv, cx, cy, rx, ry, z=5.0, ramp=RAMP, part='slime'):
    cv.blob(R.Xf((0, 0)), (cx, cy), rx, ry, 0.0, ramp, z, part)


def finish(cv, glints=()):
    rows = [list(r) for r in cv.finish(outline=True)]
    for x, y, ch in glints:
        if rows[y][x] not in '.K':
            rows[y][x] = ch
    W, H = cv.W, cv.H
    R.tidy(rows, W, H, set('GWX'))
    return [''.join(r) for r in rows]


def blob():
    out = []
    for k in range(2):
        cv = canvas(14, 14)
        ell(cv, 7, 7, 3.4 + 0.3 * k, 3.4 - 0.3 * k)
        # the trailing drip (back and down) and a small drop behind
        cv.tube((5.0, 8.5), (2.6 - k * 0.6, 10.8 + k * 0.4), 1.4, 0.6, RAMP, 4.0, 'slime')
        ell(cv, 2.0 - k, 12.0, 0.9, 0.9, 3.9)
        rows = finish(cv, glints=[(8, 5, 'W'), (9, 5 + k, 'X')])
        out.append(X.Frame(rows, (7, 7)))
    return out


def drop(cv, x, y, r=0.9):
    ell(cv, x, y, r, r, 6.0)


def splat():
    W, H, RX, RY = 44, 22, 22, 20
    out = []
    # 0: the ball squashed on the floor, two drops out
    cv = canvas(W, H)
    ell(cv, RX, RY - 3, 6.0, 2.8)
    drop(cv, RX - 8, RY - 7)
    drop(cv, RX + 8, RY - 8)
    out.append(finish(cv, [(RX + 1, RY - 5, 'W')]))
    # 1: the crown: a wide low pool with fingers up and drops high
    cv = canvas(W, H)
    ell(cv, RX, RY - 3, 11.0, 2.2)
    for dx, h in ((-7, 5), (-3, 7), (2, 6), (6, 8), (9, 4)):
        cv.tube((RX + dx, RY - 3), (RX + dx * 1.25, RY - 3 - h), 1.3, 0.7, RAMP, 5.5, 'slime')
    drop(cv, RX - 12, RY - 11)
    drop(cv, RX + 13, RY - 13)
    drop(cv, RX + 2, RY - 15, 1.1)
    out.append(finish(cv, [(RX - 2, RY - 3, 'W'), (RX + 6, RY - 9, 'X')]))
    # 2: the drops fall, the pool spreads
    cv = canvas(W, H)
    ell(cv, RX, RY - 3, 15.0, 2.0)
    for dx, h in ((-6, 3), (5, 4)):
        cv.tube((RX + dx, RY - 3), (RX + dx * 1.2, RY - 3 - h), 1.1, 0.6, RAMP, 5.5, 'slime')
    drop(cv, RX - 15, RY - 6)
    drop(cv, RX + 17, RY - 7)
    drop(cv, RX + 3, RY - 9, 1.0)
    out.append(finish(cv, [(RX - 4, RY - 3, 'W')]))
    # 3: flat, the last drops landing
    cv = canvas(W, H)
    ell(cv, RX, RY - 3, 16.5, 1.7)
    drop(cv, RX - 18, RY - 2)
    drop(cv, RX + 19, RY - 3)
    out.append(finish(cv, [(RX - 6, RY - 3, 'W'), (RX + 7, RY - 3, 'X')]))
    return [X.Frame(r, (RX, RY)) for r in out]


def puddle():
    W, H, RX, RY = 40, 8, 20, 6
    out = []
    for k in range(2):
        cv = canvas(W, H)
        ell(cv, RX, RY - 3, 16.0, 1.6, ramp=['g', 'g', 'h', 'h'])
        ell(cv, RX - 4 + 6 * k, RY - 3.4, 6.0, 0.8, 5.5, ramp=['G', 'G', 'g', 'g'])
        rows = finish(cv, [(RX - 9 + 15 * k, RY - 4, 'W'), (RX + 6 - 13 * k, RY - 3, 'X')])
        out.append(X.Frame(rows, (RX, RY)))
    return out


def build(s):
    s.strip('blob', blob(), 4, cls='prop')
    s.strip('splat', splat(), 3, loop=False, cls='prop')
    s.strip('puddle', puddle(), 30, cls='prop')
