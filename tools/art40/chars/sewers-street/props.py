# The street crooks' small sprites: the pimp's gold bullet and his two hats tumbling off in the swoon,
# the bodyguard's sunglasses tumbling off, the dealer's tin of mints (the gag pickup NEP!). Hand-drawn
# 1x pictures outlined by the rig's finish pass; the tumbles are the picture turned (rotsprite).
import art40 as X
import rig

# letters: K outline, Q darkest; the purple hat B b n with the gold band E; the white hat C c N with
# the red band R; gold Y V U; steel G g; mint M m; the label white w
COLOURS = {
    'K': '#140c0e', 'Q': '#1c1218',
    'B': '#c47ee6', 'b': '#8442b0', 'n': '#4e1f72', 'E': '#ffd040',
    'C': '#fbfaf6', 'c': '#cfcac0', 'N': '#8a857c', 'R': '#d83a34',
    'Y': '#ffe070', 'V': '#e8b028', 'U': '#9a6a12',
    'G': '#e2e8f0', 'g': '#8a93a6', 'i': '#9ec8e8',
    'M': '#7ee0b0', 'm': '#2f9a72', 'w': '#fffaf0',
}

HAT = [
    '....nbBBBb....',
    '...nbbBBBBb...',
    '...nbbBBBBBb..',
    '...nEEEEEEEE..',
    '.nnbbbBBBBBBBb',
    'nnnnbbbbbbbbnn',
]
SHADES = [
    'QQQQ.QQQQ',
    'QiQQQQiQQ',
    'QQQQ.QQQQ',
    '.QQ...QQ.',
]
BULLET = [
    'VYYYY',
    'UVVVV',
]
TIN = [
    '.gGGGGGg.',
    'gGMMMMMGg',
    'gMMwwwMMg',
    'gMMMMMMmg',
    'gGmmmmmGg',
    '.ggggggg.',
]


def outline(rows):
    h, w = len(rows), max(len(r) for r in rows)
    cv = rig.Canvas(w + 2, h + 2)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                cv.px(x + 1, y + 1, ch, 1, 'p')
    return cv.finish()


def crop(rows):
    xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    return [r[min(xs):max(xs) + 1] for r in rows[min(ys):max(ys) + 1]]


def turned(rows, deg):
    """The picture turned by deg about its centre (rotsprite), cropped, then outlined."""
    w = max(len(r) for r in rows)
    pad = w
    big = ['.' * (w + 2 * pad)] * pad + ['.' * pad + r.ljust(w, '.') + '.' * pad for r in rows] + ['.' * (w + 2 * pad)] * pad
    if deg:
        big = rig.rotsprite(big, (pad + w / 2 - 0.5, pad + len(rows) / 2 - 0.5), deg)
    return outline(crop(big))


def centred(rows):
    return X.Frame(rows, (len(rows[0]) // 2, len(rows) // 2))


def feet(rows):
    return X.Frame(rows, (len(rows[0]) // 2, len(rows)))


def hat_frames(white=False):
    rows = HAT
    if white:
        rows = [r.translate(str.maketrans('Bbn E', 'CcN R')) for r in rows]
    return [centred(turned(rows, d)) for d in (0, 50, 140, 230, 310)]


def shades_frames():
    return [centred(turned(SHADES, d)) for d in (0, 70, 160, 250)]


def bullet_frames():
    return [centred(outline(BULLET))]


def tin_frames():
    return [feet(outline(TIN))]
