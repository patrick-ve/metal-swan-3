# Line-ups: every rendered sample (out/*.json) standing on one ground line in 384-px-wide strips, the
# game's view width, with VINCENT first for scale. One PNG per mission (or for a given list of ids).
#   python3 lineup.py                 out/lineup_<mission>.png for every mission, 3x
#   python3 lineup.py id1 id2 ...     out/lineup_pick.png with just those (and VINCENT)
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import castkit as K  # noqa: E402

OUT = os.path.join(HERE, 'out')
VIEW_W = 384


def load():
    d = {}
    for f in sorted(os.listdir(OUT)):
        if f.endswith('.json') and not f.startswith('_'):
            j = json.load(open(os.path.join(OUT, f)))
            if 'rows' in j:
                d[j['id']] = j
    return d


def strips(group, ref):
    """Pack the samples left to right into 384-px strips; VINCENT starts every strip."""
    rows, cur, x = [], [], 0
    for g in [ref] + [g for g in group if g['id'] != 'vincent']:
        if cur and x + g['w'] + 6 > VIEW_W:
            rows.append(cur)
            cur, x = [(ref, 4)], ref['w'] + 6
        cur.append((g, x + 4))
        x += g['w'] + 6
    if cur:
        rows.append(cur)
    return rows


def draw(group, ref, path, scale=3):
    from PIL import Image
    ims = []
    for strip in strips(group, ref):
        top = max(g['h'] + g.get('air', 0) for g, _ in strip)
        h = top + 14
        gy = h - 8
        items = [(g['rows'], g['pal'], x, gy - g['ay'] - g.get('air', 0)) for g, x in strip]
        ims.append(K.render(items, VIEW_W, h, scale=scale, ground=gy))
    W = VIEW_W * scale
    H = sum(i.size[1] for i in ims) + 6 * (len(ims) - 1)
    sheet = Image.new('RGB', (W, H), (20, 12, 14))
    y = 0
    for im in ims:
        sheet.paste(im, (0, y))
        y += im.size[1] + 6
    sheet.save(path)
    print(path, len(group), 'samples')


if __name__ == '__main__':
    d = load()
    ref = d.get('vincent')
    if not ref:
        raise SystemExit('run python3 cast.py vincent first')
    if len(sys.argv) > 1:
        draw([d[i] for i in sys.argv[1:] if i in d], ref, os.path.join(OUT, 'lineup_pick.png'))
    else:
        ms = sorted({m for g in d.values() for m in g['mission'] if m != 'all'})
        for m in ms:
            draw([g for g in d.values() if m in g['mission']], ref, os.path.join(OUT, f'lineup_{m}.png'))
