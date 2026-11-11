# THE CAMERA FLASH of SAY CHEESE! (item/hostage/flash): hostages.ts sayCheese spawns it at the gag
# frame's 'flash' point (the flash cube of the camera). A white-hot burst with long rays and short warm
# diagonals, shrinking to a twinkle: colours of the shared FX ramp only (it glows: no outline).
# Centre anchor. 8 ticks, once.
import math

import art40 as X


def burst(r, core, diag, ring):
    """One flash picture of radius r: the round core (W, its rim F), four long rays tapering to one
    px, four short diagonals (y, gold tips f), a faint ring (y) at the ring radius."""
    n = 2 * r + 1
    g = [['.'] * n for _ in range(n)]

    def put(x, y, ch, over=True):
        if 0 <= x < n and 0 <= y < n and (over or g[y][x] == '.'):
            g[y][x] = ch
    c = r
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if d <= core:
                put(x, y, 'W')
            elif d <= core + 1.1:
                put(x, y, 'F')
            elif ring and abs(d - ring) < 0.5 and (x + y) % 2 == 0:
                put(x, y, 'y', False)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for k in range(int(core) + 1, r + 1):
            t = (k - core) / max(1, r - core)
            put(c + dx * k, c + dy * k, 'W' if t < 0.45 else 'F' if t < 0.8 else 'y')
            if t < 0.3:                                 # the ray is 3 px wide near the core
                put(c + dx * k + dy, c + dy * k + dx, 'F')
                put(c + dx * k - dy, c + dy * k - dx, 'F')
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        for k in range(int(core * 0.7) + 1, diag + 1):
            put(c + sx * k, c + sy * k, 'y' if k < diag else 'f')
    return [''.join(row) for row in g], (c, c)


def frames():
    return [X.Frame(rows, root) for rows, root in (burst(10, 3.2, 6, 8.5), burst(7, 2.0, 4, 6.0), burst(4, 0.8, 0, 0))]
