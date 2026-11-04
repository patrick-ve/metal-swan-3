# THOM's own full-body moves (the shared module's versions are for an empty-handed hero): the
# salute with a pistol (the gunslinger's salute: the barrel up beside the face, the far pistol
# hanging at his side).
import ext_moves as EM
from anims import gun

ST = ((0, -17), (-5, -4), (5, -4))
FAR = gun((1, 9), 'lowF')


def salute():
    """The salute (68 ticks, once, the last frame holds; contract 'salute'): at ease with both
    pistols down, the near pistol swings up past the chest, snaps up beside the face with the chest
    out, overshoots a pixel, settles, the proud hold with the smug grin."""
    def f(near, head='fwd', tor=(0, 0), hd=(0, 0), far=FAR):
        return EM.fp(*ST, 'flat', 'flat', torso='up', head=head, tor=tor, hd=hd, armN=near, armF=far)
    return [
        (f(gun((3, 8.5), 'low'), far=gun((1.5, 9), 'lowF')), 4),
        (f(gun((7.5, 0), 'dup', bend=-1)), 3),
        (f(gun((6, -6.5), 'up', bend=-1, sh=(1, 0)), head='shout', tor=(0, -1)), 2),
        (f(gun((5.5, -8), 'up', bend=-1, sh=(1, 0)), head='shout', tor=(0, -1), hd=(0, -1)), 3),
        (f(gun((6, -7), 'up', bend=-1, sh=(1, 0)), tor=(0, -1)), 4),
        (f(gun((6, -7), 'up', bend=-1, sh=(1, 0)), head='smug', tor=(0, -1)), 52),
    ]


def apply(H):
    import importlib
    import anims as A
    import parts as P
    M = importlib.import_module(H.__name__ + '.moves')
    M.salute = salute
    P.ITEMS.update(CAP_ITEMS)
    A.FULL['death_blast'] = capless(A, P, 'death_blast')


# ------------------------------------------------------------------------------- the cap flies off
# The blast death: the backwards cap pops off his head on the blast and tumbles after him (his gear's
# secondary motion; the pistols already fly). Heads without the cap: short blond hair on top.
CAP_LETTERS = set('UECw')
CAP_ITEMS = {
    'cap0': ([
        "....UEEEEU...",
        "..UECCCCCCEU.",
        ".UECCCCCwwCE.",
        "UUEEEEEEEEEEU",
    ], {'c': (6, 2)}),
    # tumbling: the crown down, the brim up
    'cap1': ([
        "UEEEEEEEEEEUU",
        ".ECCCCCCCCEU.",
        "..UECCCCEU...",
    ], {'c': (6, 1)}),
    'cap2': ([
        "..UU",
        ".UEE",
        "UECE",
        "UECE",
        "UECw",
        ".UEE",
        "..UU",
    ], {'c': (2, 3)}),
}
# the cap's flight (root-relative, before the figure's own path offset) per blast frame, and its pose
# (frame 8: the bounce lands beside the head, not on the face)
CAP_PATH = [None, (-3, -46), (-8, -55), (-14, -60), (-21, -60), (-28, -55), (-35, -44), (-43, -29), (-59, -9), (-57, -2)]
CAP_TURN = [None, 'cap0', 'cap2', 'cap1', 'cap2', 'cap0', 'cap2', 'cap1', 'cap2', 'cap0']


def nocap(rows):
    band = max(y for y, r in enumerate(rows) if r.count('E') >= 6)
    g = [list(r) for r in rows]
    for y, r in enumerate(g):
        for x, ch in enumerate(r):
            if y < band - 1 and ch in CAP_LETTERS:
                g[y][x] = '.'
            elif y == band - 1 and ch in CAP_LETTERS:
                g[y][x] = 'A' if 5 <= x <= 14 else '.'
            elif y == band and ch in CAP_LETTERS:
                g[y][x] = 'H' if 3 <= x <= 15 else '.'
            elif y > band and ch == 'U':
                g[y][x] = '.' if x < 3 else 'H'
    return [''.join(r) for r in g]


def capless(A, P, key):
    """The strip `key` of A.FULL with the cap flying off from frame 1 on."""
    import ext_moves as EM
    path = EM.BLAST_PATH
    out = []
    for k, (p, t) in enumerate(A.FULL[key]):
        if k == 0 or CAP_PATH[k] is None:
            out.append((p, t))
            continue
        h = p.get('head', 'fwd')
        if h == 'blink':
            h = 'hurt'          # the capless blink head lost its face (nocap): keep the eye and mouth
        nm = h + '_nocap'
        if nm not in P.HEADS:
            import pose
            rows, an = pose.head_part(type('X', (), {'P': P})(), h)
            P.HEADS[nm] = (nocap(rows), dict(an))
        ox, oy = path[k]
        cx, cy = CAP_PATH[k]
        q = dict(p, head=nm)
        q['items'] = list(q.get('items') or []) + [(CAP_TURN[k], (cx - ox, cy - oy), 19)]
        out.append((q, t))
    return out
