# Composes one page step (see ext.py for the step format) into rows on a padded canvas, the same
# way the page draws it: stage sprites behind, the back layer (cape), the legs, the upper body (its
# pelvis on the legs' pelvis), stage sprites in front. Used by sheet.py.
from rig import W, H, RX, RY
from pose import compose
import anims as A
import parts as P

PADX, PADT, PADB = 30, 46, 12
CW, CH = W + 2 * PADX, H + PADT + PADB
GX, GY = RX + PADX, RY + PADT          # the ground point on the padded canvas


def blank():
    return [['.'] * CW for _ in range(CH)]


def blit(cv, rows, x0, y0):
    for j, r in enumerate(rows):
        y = y0 + j
        if 0 <= y < CH:
            for i, ch in enumerate(r):
                x = x0 + i
                if ch != '.' and 0 <= x < CW:
                    cv[y][x] = ch


def hero_layers(s):
    """The hero of one step as canvas-sized rows (root at RX, RY), back to front, each with an offset.
    The upper body is composed at the standing pelvis and then moved onto the legs' pelvis, exactly as
    build.py exports it and the page draws it (loose items and effects move with the upper body)."""
    if s.get('f'):
        k, i = s['f']
        return [(compose(A.FULL[k][i][0], 'full')[0], 0, 0)]
    out = []
    lp = A.LOWER[s['l'][0]][s['l'][1]][0] if s.get('l') else None
    up = None
    if s.get('u'):
        up = dict(A.UPPER[s['u'][0]][s['u'][1]][0])
        up['pelvis'] = (0, -17)
        lx, ly = lp['pelvis'] if lp else (0, -17)
        dx, dy = round(lx), round(ly + 17)
        br = compose(up, 'back')[0]
        if br:
            out.append((br, dx, dy))
    if lp:
        out.append((compose(lp, 'lower')[0], 0, 0))
    if up:
        out.append((compose(up, 'upper')[0], dx, dy))
    return out


def step_rows(s):
    cv = blank()
    ox, oy = s.get('ox', 0), s.get('oy', 0)
    st = s.get('st', [])

    def stage(front):
        for key, i, dx, dy, z in st:
            if (z > 0) != front:
                continue
            rows, an = P.STAGE[key][i]
            blit(cv, rows, GX + ox + dx - round(an['c'][0]), GY + oy + dy - round(an['c'][1]))
    stage(False)
    if not s.get('hide'):
        for rows, dx, dy in hero_layers(s):
            if s.get('pal') == 'flash':
                rows = [''.join('W' if ch != '.' else '.' for ch in r) for r in rows]
            blit(cv, rows, PADX + ox + dx, PADT + oy + dy)
    stage(True)
    return [''.join(r) for r in cv]


def union_crop(frames, m=1):
    xs, ys = [], []
    for f in frames:
        for y, r in enumerate(f):
            if r.strip('.'):
                ys.append(y)
                xs += [x for x, ch in enumerate(r) if ch != '.']
    if not xs:
        return frames
    x0, x1, y0, y1 = max(0, min(xs) - m), min(CW, max(xs) + 1 + m), max(0, min(ys) - m), min(CH, max(ys) + 1 + m)
    return [[r[x0:x1] for r in f[y0:y1]] for f in frames]
