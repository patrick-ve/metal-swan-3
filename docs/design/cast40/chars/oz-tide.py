# oz-tide: a slice of the horde that fills the tower in the finale. Three packed ranks of dead
# soldiers (helmets, caps, bare rotting heads, field-grey shoulders), reaching claws over the heads;
# each rank further back is one shade darker, only the eye glow stays bright.
import castkit as K
from chars import oz_kit as Z

INFO = dict(
  name='THE HORDE TIDE', mission=['oldenzaal'], role='enemy', kind='HUMANOID', face=-1,
  pose='a packed mass of the dead climbing up, claws reaching',
  note='three ranks, darker toward the back, eye glow kept; the mass runs on below the frame',
  old='enemy/oz-tide/mass#0', air=0,
)

W, H = 90, 50
CLAWUP = (Z.g("""
  S...S.
  S.S.S.
  SSSSSs
  .SSSs.
  ..ss..
"""), {'wrist': (2.5, 4)})


def flip(part):
    rows, an = part
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.')[::-1] for r in rows], {k: (w - 1 - x, y) for k, (x, y) in an.items()}


def dark(part, k):
    rows, an = part
    return Z.shade(rows, k), dict(an)


def frame():
    Z.install()
    K.pose.HOOKS['pat'] = None
    X = K.pose.Ctx(1)
    cv = K.Canvas(W + 20, H + 24)
    ox, oy = 10, 14                                # the 90 x 50 slice starts here on the canvas
    ramps = [['J', 'j', 'q', 'Q'], ['j', 'q', 'Q', 'Q'], ['q', 'Q', 'Q', 'Q']]
    heads = ['helm', 'bare', 'helm', 'cap', 'helm', 'bare', 'helm', 'helm', 'cap']
    # rank: (shade, neck y, first x, step, z, flips)
    ranks = [(2, 21, 2, 10, 1, (1, 4, 6)), (1, 32, 7, 11, 3, (2, 5)), (0, 45, 0, 12, 5, (3, 7))]
    jit = [0, -3, 2, -1, -4, 2, -2, 3, -3]
    for r, (k, ny, x0, step, z, flips) in enumerate(ranks):
        i = 0
        x = x0
        while x < W + 4:
            name = heads[(i * 3 + r * 2) % len(heads)]
            hp = Z.HEADS[name]
            tp = Z.TORSOS['coat' if (i + r) % 3 == 0 else 'tunic']
            if i in flips:
                hp, tp = flip(hp), flip(tp)
            neck = (ox + x, oy + ny + jit[(i + r * 4) % len(jit)])
            K.pose.place(cv, X, dark(tp, k), 'neck', neck, z, 'torso%d%d' % (r, i))
            K.pose.place(cv, X, dark(hp, k), 'neck', (neck[0], neck[1] + 1), z + 0.6, 'head%d%d' % (r, i))
            i += 1
            x += step
    # reaching arms: (rank, shoulder x, shoulder y, hand dx, hand dy, bend)
    arms = [(0, 9, 21, 2, -19, 1), (0, 37, 20, -2, -19, -1), (0, 71, 21, 3, -19, 1),
            (1, 54, 33, 2, -18, 1), (1, 20, 34, -2, -17, -1), (2, 86, 46, -3, -17, -1)]
    K.pose.UPPER, K.pose.FORE = 8.5, 8.0
    for n, (r, sx, sy, dx, dy, b) in enumerate(arms):
        k = max(0, ranks[r][0] - 1)
        K.pose.RAMP['t%d' % k] = ramps[k]
        K.pose.CUT['t%d' % k] = K.pose.CUT['arm']
        K.P.HANDS['cu%d' % k] = dark(CLAWUP, k)
        sh = (ox + sx, oy + sy)
        Z._arm(cv, X, sh, (sh[0] + dx, sh[1] + dy), b, 't%d' % k, ranks[r][4] + 0.8, 'arm%d' % n, ('hand', 'cu%d' % k))
    # the mass is solid: the deep shade of more bodies fills every gap below the heads' line
    for x in range(ox, ox + W):
        top = next((y for y in range(cv.H) if cv.c[y][x] != '.' and not cv.p[y][x].startswith('arm')), None)
        if top is None:
            continue
        for y in range(top, oy + H):
            if cv.c[y][x] == '.':
                cv.px(x, y, 'Q', 0, 'mass')
    # the slice: cut everything outside the 90 x 50 box (the mass runs on below)
    for y in range(cv.H):
        for x in range(cv.W):
            if not (ox <= x < ox + W and y < oy + H):
                cv.c[y][x] = '.'
    return K.finish(cv, (ox + W // 2, oy + H))
