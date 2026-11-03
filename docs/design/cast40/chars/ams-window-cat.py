# The window cat (ams): a ginger tabby sitting on the sill of the same canal-house window as the
# waver (chars/ams-window-waver.py, window_back / window_front), facing the street, the striped tail
# hanging over the sill and down past the tulip box. Real size: a sitting cat is about 0.45 m with
# the ears, 10-11 px next to a 40 px man.
import importlib

import castkit as K

INFO = dict(
    name='WINDOW CAT', mission=['ams'], role='animal', kind='CREATURE', face=-1,
    pose='sits on the sill facing the street, eyes to the hero, the tail hanging over the sill',
    note='Ginger tabby with forehead and flank stripes, cream muzzle, chest and paws, pink nose and '
         'ears, green eyes; same window as the waver; the tail now hangs over the sill instead of '
         'swishing inside the room.',
    old='npc/ams/ams-window-waver/cat#0', air=30,
)

WIN = importlib.import_module('chars.ams-window-waver')

CAT_PAL = {
    # ginger fur (C lit, E mid, U stripes and shade)
    'C': '#f8ae5c', 'E': '#d87a30', 'U': '#8e4a1e',
    # cream muzzle, chest and paws; pink nose and inner ears; green eyes with dark slits
    'L': '#fff0d6', 'S': '#f4a0a4', 'Z': '#9ad84a', 'Q': '#1e140e',
}
CAT_DARK = {'C': 'U', 'E': 'U', 'U': 'U', 'L': 'E', 'S': 'E', 'Z': 'U'}

# front view, light from the upper front; the pupils look toward the hero (right here, left after
# the mirror)
CAT = K.grid("""
    .U....U.
    .CS..SE.
    CCUCCUCE
    CLZQCZQE
    CCLSSLCE
    .CLLLLE.
    .CCLLCE.
    CCULLCUE
    CCCLLCEE
    CUCLLCUE
    .LL..LL.
""")
CAT_AT = (8, WIN.SILL_Y - 11)        # top-left of the cat in window coordinates (paws on the sill)


def _tail(cv):
    """The striped tail from the cat's hip, over the sill's front edge, hanging down with a hook."""
    ox, oy = WIN.OX, WIN.OY
    x0 = ox + CAT_AT[0] + 8
    pts = [(x0 - 1.5, oy + WIN.SILL_Y - 2.5), (x0 + 0.5, oy + WIN.SILL_Y - 0.5),
           (x0 + 1, oy + WIN.SILL_Y + 3), (x0 + 0.5, oy + WIN.SILL_Y + 7), (x0 + 2, oy + WIN.SILL_Y + 8.5)]
    u = 0.0

    def pat(uu, v, k, ch):
        return 'U' if int(uu) % 4 == 3 else ch
    for a, b, ra, rb in zip(pts, pts[1:], (1.2, 1.1, 1.0, 0.9), (1.1, 1.0, 0.9, 0.8)):
        cv.tube(a, b, ra, rb, ['C', 'C', 'E', 'U'], 40, 'tail', pat=pat, u0=u)
        u += ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
    return x0


def frame():
    K.palette({**WIN.WINDOW_PAL, **CAT_PAL}, dark={**WIN.WINDOW_DARK, **CAT_DARK})
    cv = WIN.canvas()
    WIN.window_back(cv)
    cv.grid(WIN.OX + CAT_AT[0], WIN.OY + CAT_AT[1], CAT, 20, 'cat')
    tx = _tail(cv) - WIN.OX
    WIN.window_front(cv, skip=[x for x, _ in WIN.TULIPS if abs(x - tx) <= 2])
    return K.finish(cv, WIN.root())
