# TEMPLATE section module of the level kit (tools/levelkit/README.md). Copy it into your mission folder as
# l<n><id>.py (or any name), set SID / NAME / HOUR, and paint. Every layer is a plain kit Layer; the order of the
# sec.add / sec.put calls is the draw order (far to near), and Sec.flush turns the depth planes into layers.
#
# Run it (from the repo root):
#   U=1 python3 tools/levelkit/lk.py sample preview tools/levelkit/template/section.py      (the stub: no game mission)
#   U=1 python3 tools/levelkit/lk.py sample check tools/levelkit/template/section.py
#   LK_SECTION=d LK_HOUR=sunset U=1 python3 tools/levelkit/lk.py ams check tools/levelkit/template/section.py
# (LK_SECTION / LK_HOUR exist only so this one file runs on any layout; a real section names its own id and hour.)
import os
import random
from level import *                      # Sec, s_d, sky_layers, skyline_layer, floor_layer, Layer, grader, VIEW_W, ...
from game_sprites import sprites         # noqa: F401  (the bake's hook: paintings of things the game draws as entities)
import street                            # LAMP_D: the depth of the kerbside lamps (the far pavement)

SID = os.environ.get('LK_SECTION', 'a')  # the section id in the layout (the game's section, or the stub's 'a')
NAME = 'Template'
HOUR = os.environ.get('LK_HOUR', 'day')  # a key of the mission's HOURS (mission.py)

# The fidelity cameras of the game bake: (camera x, the screen x the tier-2 / tier-4 crops centre on), five or more.
# Pick the screens that matter (a set piece, a bridge, the last screen); here: evenly over the section.
GAME_CAMS = [(round((LAY[SID]['width'] - VIEW_W) * i / 4), 192) for i in range(5)]

ROW_DEPTH = 14.0                         # the street's house row: 14 px behind the walk line (the game's house boxes)
STOREY = 40                              # px per storey at speed 1 (13 px per metre, a storey as tall as the hero)


def house_row(sec, depth, rng):
    """One TILED house row on the plane at `depth`: fronts side by side from the plane's left edge to its right edge,
       no gap, no overlap (the house-fit gate checks sec.notes['fronts']). Returns the plane depth."""
    Lp, k = sec.plane(depth)
    sp = s_d(k)                                    # the plane's speed = its scale: storeys shrink with depth
    yb = GY - k                                    # the row's feet: screen y 176 - depth
    fronts, x = [], 0
    while x < Lp.w:
        w = rng.randint(30, 46)
        if Lp.w - (x + w) < 20:                    # the last front takes the rest (no sliver)
            w = Lp.w - x
        H, info = house(rng, w, q_(STOREY * sp) * 2, rng.choice(['neck', 'bell', 'step', 'cornice']),
                        rng.choice(BRICKS), sc=sp, seed=x)
        Lp.blit(H, x, yb - H.h)
        fronts.append((x, w))
        x += w
    sec.notes['fronts'] = fronts
    return k


def build():
    sec = Sec(SID, NAME, HOUR)
    rng = random.Random(1)
    # ---- far planes: the sky (speed 0), the clouds (a drifting tile), the skyline (speed 0.10)
    sky_layers(sec)
    skyline_layer(sec, speed=0.10, yb=118)
    # ---- a far row (speed 0.30): low roofs that take the air of the hour (lighter and bluer than the near planes)
    W1 = sec.lw(0.30)
    F = Layer(W1, VIEW_H)
    far_roofs(F, 0, W1, BACKY, random.Random(5), 18, 40)
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], 0.30, 0.30)))
    sec.add('far', F, 0.30)
    # ---- the floor: one strip row per screen row from y 146 down, painted from the layout's floor (kerbs, street)
    floor_layer(sec)
    # ---- the house row on its depth plane (graded with the key of the hour by sec.flush)
    house_row(sec, ROW_DEPTH, rng)
    # ---- street furniture: a kerbside lamp every 240 px on the far pavement (the game's 72 px lamp height) and a
    #      bench on the near pavement (depth < 0: drawn over the hero; it holds the darkest tones of the frame)
    for x in range(120, sec.W, 240):
        sec.put(lamp(72), x, street.LAMP_D)
    for x in range(240, sec.W, 320):
        sec.put(bench(), x, -20.0)
    # ---- the walk plane (depth 0): decks, the art under platforms and the breakables (game_sprites.entity) go here
    sec.plane(0)
    sec.flush()
    return sec


def checks(sec):
    """The section's own gates (check_level.py adds them to the generic ones): here the house fit."""
    fr = sec.notes['fronts']
    ov = [a[0] + a[1] - b[0] for (a, b) in zip(fr, fr[1:])]
    Lp = [l for l in sec.layers if l.get('depth') == ROW_DEPTH][0]['img']
    return [
        ('house fronts tile: no front hides another, no gap (overlap 0 px)', all(o == 0 for o in ov),
         'max overlap %g, max gap %g over %d party lines' % (max(ov + [0]), max([-o for o in ov] + [0]), len(ov))),
        ('the house row covers its plane end to end', fr[0][0] == 0 and fr[-1][0] + fr[-1][1] == Lp.w,
         '%g .. %g of %g' % (fr[0][0], fr[-1][0] + fr[-1][1], Lp.w)),
    ]


if __name__ == '__main__':
    sec = build()
    preview(sec, tag='tpl-' + sec.id)            # work/<mission>/out/l1tpl-<id>-<i>-u<U>.png and a layout frame
    print('template %s: %d layers, previews in %s/out' % (sec.id, len(sec.layers), os.getcwd()))
