# PATRICK's balloon heads (Helium Head): the shared balloon step blows his 1x head up 2x, and the
# straight brow plus the small eye merge into one dark blob. Here the eyes, brows, the thin mustache
# and the calm mouth are drawn again by hand on each balloon, at the balloon's own 2x scale.
import parts as P

PAD = 3     # the balloon step pads the 1x head by 3 px before the 2x upscale

# eye patches, 2x px. Origin = the 1x brow pixel (col 9, brow row) mapped to the balloon.
# '.' keeps the balloon pixel. Rows: brow (1 row), a skin row, the eye (2 rows).
EYES = {
  'open':  ["SQQQQQS",
            "SSSSSSS",
            "SwwQQSS",
            "SwwQQSS"],
  'shut':  ["SQQQQQS",
            "SSSSSSS",
            "SSSSSSS",
            "SzQQQSS"],
  'arc':   ["SSQQQQS",
            "SSSSSSS",
            "SSQQSSS",
            "SQSSQSS"],
  'lid':   ["SQQQQQS",
            "SSSSSSS",
            "SQQQQSS",
            "SwwQQSS"],
  'wide':  ["SQQQQQS",
            "SSSSSSS",
            "SwwwwSS",
            "SwwQQSS",
            "SwwQQSS",
            "SSwwSSS"],
  'squint': ["SSSQQSS",
             "SQQQQss",
             "SSSSSSS",
             "SQQQQSS"],
}

# per balloon head: (eye style, 1x brow row, lower-face fix)
HEADS = {
  'fwd': ('open', 6, 'calm'), 'blink': ('shut', 6, 'calm'), 'shout': ('open', 6, None),
  'hurt': ('squint', 5, None), 'up': ('open', 5, None), 'down': ('open', 7, None),
  'bite': ('open', 6, None), 'chew': ('open', 6, None), 'chew2': ('open', 6, None),
  'happy': ('arc', 6, None), 'grin': ('arc', 6, None), 'panic': ('wide', 5, None),
  'yawn': ('shut', 6, None), 'sleep': ('shut', 6, None), 'bored': ('lid', 6, None),
  'look': ('open', 7, None), 'lookblink': ('shut', 7, None), 'lookgrin': ('arc', 7, None),
  'wow': ('open', 6, None), 'smirk': ('open', 6, None),
  'read': ('open', 7, None), 'read2': ('shut', 7, None), 'smug': ('open', 6, None),
}

# the calm closed-mouth smile and the thin mustache, 2x, origin = the 1x pixel (col 10, row 10)
CALM = ["SSSSBBBB.",
        "SSSSSSSS.",
        "SSSSSSs..",
        "SzzBBz...",
        ]


def _paint(rows, at, patch):
    g = [list(r) for r in rows]
    x0, y0 = at
    for j, pr in enumerate(patch):
        for i, ch in enumerate(pr):
            X, Y = x0 + i, y0 + j
            if ch != '.' and 0 <= Y < len(g) and 0 <= X < len(g[Y]) and g[Y][X] != '.':
                g[Y][X] = ch
    return [''.join(r) for r in g]


def fix_all():
    for name, (style, brow, low) in HEADS.items():
        key = 'he_' + name
        if key not in P.HEADS or name not in P.HEADS:
            continue
        rows, an = P.HEADS[key]
        nx, ny = P.HEADS[name][1]['neck']
        ax, ay = an['neck']
        X0 = 2 * (nx + PAD) + 0.5 - ax
        Y0 = 2 * (ny + PAD) + 1 - ay
        m = lambda x, y: (int(round(2 * (x + PAD) - X0)), int(round(2 * (y + PAD) - Y0)))
        rows = _paint(rows, (m(9, brow)[0] - 1, m(9, brow)[1]), EYES[style])
        if low == 'calm':
            rows = _paint(rows, m(10, 10), CALM)
        # light chin stubble: the sphere shading darkened it into a beard band; lighten it again
        y0 = m(0, 12)[1]
        bot = max(y for y, r in enumerate(rows) if r.strip('.'))
        rows = [r.replace('B', 'b') if y0 <= y < bot - 1 else r for y, r in enumerate(rows)]
        P.HEADS[key] = (rows, an)
