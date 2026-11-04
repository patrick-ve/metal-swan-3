# MECHA HASLEMA: the small pieces of the fight. The spring the head boings on at the death
# (boss/ams-mayor/spring: 4 heights, bottom anchor = the neck top, drawn by mayor.ts at dy - 112)
# and the floor shadow of the stamp target / the stomp landing (boss/ams-mayor/shadow: 56 and 52 px
# wide, centre anchor; mayor.ts pulses its alpha).
import math

from .cv import Layer, ellmask
from .pal import step

SPRING_H = (6, 14, 22, 30)          # layout.ts SPRING_H
SHADOW_W = (56, 52)                 # layout.ts SHADOW_W
TURNS = 3.0
COIL_R = 4.6


def spring(h):
    """A steel coil spring h px tall standing on (0, 0): 3 turns of a 2 px wire (1 px behind), the front of
    each turn lit (it runs down to the right, toward the light), the back of each turn in shade; a
    collar plate at the bottom, the mounting cup at the top. Squashed, the turns stack into rings."""
    L = Layer('spring')
    cx = 1.0
    top = -h + 2.0
    n = 360
    for i in range(n + 1):
        t = i / n * TURNS
        a = 2 * math.pi * t
        x = cx + COIL_R * math.cos(a)
        y = -2.0 + (top + 2.0) * (t / TURNS) * 1.0
        front = math.sin(a) > 0
        # the wire: 2 px thick; lit on its upper edge where it faces the light
        for dy, k in ((0, 0), (1, 1)):
            if front:
                ch = ('1' if math.cos(a) > -0.3 else '2') if k == 0 else '4'
                z = 2.0 + math.sin(a)
            else:
                if k == 1:
                    continue                                  # the back wire: 1 px, in shade
                ch = '5' if math.cos(a) > 0 else '6'
                z = -2.0 + math.sin(a)
            L.put(x, y + dy, ch, z, 'wire' if front else 'wire-back')
    # the highlight where each front turn crosses the middle (the specular)
    for j in range(int(TURNS) + 1):
        t = j + 0.3
        if t > TURNS:
            break
        y = -2.0 + (top + 2.0) * (t / TURNS)
        L.put(cx + 1, y, '0', 3.2, 'wire')
    # the collar plate at the bottom and the cup at the top (they hold the spring in the neck and the head)
    for x in range(-6, 9):
        L.put(x, -1, '3' if x < 5 else '4', 4.0, 'plate')
        L.put(x, 0, '5', 4.0, 'plate')
    L.put(-6, -1, '2', 4.0, 'plate')
    for x in range(-4, 7):
        L.put(x, -h, '2' if x < 3 else '3', 4.0, 'cup')
        L.put(x, -h + 1, '4', 4.0, 'cup')
    return L


def shadow(w):
    """The floor target: a flat dark oval with a dashed crimson warning ring (it reads on grass,
    brick and paving at the code's 50 / 75 % alpha), a darker heart. Centre anchor."""
    L = Layer('shadow')
    rx, ry = w / 2.0, 4.0
    m = ellmask(0.0, 0.0, rx, ry)
    for (x, y) in sorted(m):
        u = math.hypot((x + 0.5) / rx, (y + 0.5) / ry)
        a = math.atan2((y + 0.5) / ry, (x + 0.5) / rx)
        if u > 0.74:
            dash = int((a + math.pi) / (2 * math.pi) * 16) % 2 == 0
            ch = ('S' if y < 0 else 'T') if dash else 'U'
        elif u > 0.42:
            ch = 'z'
        else:
            ch = 'V'
        L.put(x, y, ch, 0.0, 'shadow')
    return L
