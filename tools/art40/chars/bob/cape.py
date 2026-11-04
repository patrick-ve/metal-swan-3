# BOB's cape follow-through (wave 2 stage 2): the kit cape (kit/heroes/bob_cape.py) draws a ribbon
# from the pose's (mode, phase) at once, so a strip that changes mode (hang -> slash, droop ->
# billow, shoot -> hang) snapped the cape from one shape to the next in a single frame. Here the
# ribbon's shape numbers follow their targets as a damped spring over the strip's real ticks: the
# cape lags behind the body, overshoots a little and settles (the reference's secondary motion of
# cloth). The result goes into the pose as the cape's per-pose overrides (the third element of
# p['cape'], which bob_cape.params applies last), so the kit draws it unchanged.
#
# Loops run three cycles and keep the last (the spring state wraps). One-shots start at rest on
# their first target (the strip before them ends on that hang). Modes whose numbers live in the
# world (deaths turned with the body, the flip and blast tumbles, the drown, the pancake, the Swan
# ride) keep their own drawing: the spring restarts at rest after them.
import math

import heroes.bob_cape as BC

SPRUNG = ('phi', 'curl', 'w1', 'w0', 'amp', 'L', 'hem')
SKIP = ('death', 'blast', 'flip', 'drown', 'flat', 'ride', 'ridewind')
OMEGA = 2 * math.pi / 15         # the cloth's own swing: about 15 ticks
ZETA = 0.42                      # under-damped: one small overshoot, then it settles


def _target(p):
    c = p.get('cape')
    if not isinstance(c, tuple) or c[0] in SKIP or p.get('rot') or p.get('spin'):
        return None
    return BC.params(c[0], c[1], p)


def follow(steps, loop, start=None):
    """steps [(pose, ticks, *tags)] -> the same steps with the cape numbers sprung. start='last':
    a one-shot that starts from the pose it ends on (a shot, a punch, a throw: the strip before
    it is the aim pose its tail settles back to), so the cape is at rest there, not on the first
    frame's flare."""
    tg = [_target(st[0]) for st in steps]
    if not any(tg):
        return steps
    ticks = [max(1, int(st[1])) for st in steps]
    total = sum(ticks)
    cycles = 3 if loop else 1
    x = v = None
    seen = {}
    for c in range(cycles):
        t0 = 0
        for i, st in enumerate(steps):
            T = tg[i]
            if T is None:
                x = v = None
                t0 += ticks[i]
                continue
            if x is None:
                S0 = T
                if start == 'last' and c == 0 and i == 0 and tg[-1] is not None:
                    S0 = tg[-1]
                x = {k: float(S0[k]) for k in SPRUNG}
                v = {k: 0.0 for k in SPRUNG}
            mid = ticks[i] // 2
            for k in range(ticks[i]):
                if k == mid and c == cycles - 1:
                    seen[i] = dict(x)
                for key in SPRUNG:
                    a = OMEGA * OMEGA * (T[key] - x[key]) - 2 * ZETA * OMEGA * v[key]
                    v[key] += a
                    x[key] += v[key]
            t0 += ticks[i]
    if not loop:
        # a one-shot lands on its last target (the next strip starts there): the last third of the
        # strip's ticks blends the spring into the targets
        start = total - max(1, total // 3)
        t = 0
        for i in range(len(steps)):
            if i in seen and tg[i] is not None and t + ticks[i] // 2 >= start:
                w = 1.0 if i == len(steps) - 1 else (t + ticks[i] // 2 - start) / max(1, total - start)
                seen[i] = {k: seen[i][k] + (tg[i][k] - seen[i][k]) * min(1.0, w) for k in SPRUNG}
            t += ticks[i]
    out = []
    for i, st in enumerate(steps):
        if i not in seen:
            out.append(st)
            continue
        p = dict(st[0])
        c = p['cape']
        ov = dict(c[2]) if len(c) > 2 else {}
        s = seen[i]
        for key in SPRUNG:
            ov[key] = round(s[key], 2)
        ov['w0'] = max(2.5, ov['w0'])
        ov['w1'] = max(ov['w0'], ov['w1'])
        ov['L'] = max(12.0, ov['L'])
        ov['hem'] = max(0.5, ov['hem'])
        p['cape'] = (c[0], c[1], ov)
        out.append((p,) + tuple(st[1:]))
    return out
