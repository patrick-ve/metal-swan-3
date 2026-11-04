# SCANAUTO: the alloy wheel (boss/ams-scan/wheel, 4 turn steps, centre anchor; the car and the tow
# truck share it): a black tyre lit on its upper front, a bright lip, five lit spokes over a dark
# dish, a small hub. The game turns one step per 1.9 px of travel (wheelDist): one step = 1/4 of the
# 72 degrees between two spokes, so the spokes roll without slipping (r 6: 37.7 px a turn).
import math

from . import geo as G

SPOKES = 5
STEPS = 4
R_OUT, R_TYRE, R_LIP, R_HUB = 6.2, 4.2, 3.35, 1.1


def wheel(k):
    """Step k (0..3): the spokes turned clockwise on screen (the car rolls forward, facing right)."""
    r = G.Raster()
    ph = k * (2 * math.pi / SPOKES / STEPS)
    for Y in range(-7, 8):
        for X in range(-7, 8):
            dx, dy = X + 0.5 - 0.5, Y + 0.5 - 0.5
            d = math.hypot(dx, dy)
            if d > R_OUT:
                continue
            lit = (dx * 0.6 - dy * 0.8) / max(d, 0.01)
            if d > R_TYRE:
                ch = 'P' if lit > 0.55 else 'p' if lit > -0.35 else 'o'
                if d > R_TYRE + 1.2 and lit > 0.8:
                    ch = 'P'
            elif d > R_LIP:
                ch = 'S' if lit > 0.3 else 's' if lit > -0.5 else 'z'
            elif d < R_HUB:
                ch = 'z'
            else:
                a = math.atan2(dy, dx) - ph
                spoke = math.cos(SPOKES * (a + 0.3)) > 0.05
                ch = ('S' if lit > 0.2 else 's') if spoke else ('Z' if lit > -0.2 else 'o')
            r.put(X, Y, ch, 0, 'wheel')
    r.put(0, 0, 'S', 0.1, 'wheel')
    return r
