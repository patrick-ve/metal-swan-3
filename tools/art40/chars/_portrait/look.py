# The portrait kit's review writer: zooms of a select set's frames (1x row + a zoom row, the hold in
# ticks under each frame) and a before / after board with the old portraits, written under tmp/
# for review only (never shipped). The pipeline's own sheet is `npm run art40 -- <slug> --sheet`.
#
#   python3 tools/art40/chars/_portrait/look.py select-vincent [--z 4] [--out tmp/<label>/x.png]
#           [--strips select-grey,select,select-pick] [--frames 0,3]
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART40 = os.path.dirname(os.path.dirname(HERE))
sys.path[:0] = [ART40, os.path.join(ART40, 'kit')]

BG = (40, 42, 52)


def rgb(v):
    return tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))


def paint(im, rows, pal, x0, y0, z):
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            c = pal[ch]
            for yy in range(z):
                for xx in range(z):
                    px[x0 + x * z + xx, y0 + y * z + yy] = c


def board(cells, pal, path, z=4, gap=6, labels=None):
    """cells: [rows]; one 1x row on top, the zoomed row under it (labels under each zoom)."""
    from PIL import Image, ImageDraw
    w, h = 64, 120
    n = len(cells)
    W = gap + n * (w * z + gap)
    Hh = gap + h + gap + h * z + gap + 12
    im = Image.new('RGB', (W, Hh), BG)
    for i, rows in enumerate(cells):
        paint(im, rows, pal, gap + i * (w + gap), gap, 1)
        paint(im, rows, pal, gap + i * (w * z + gap), gap * 2 + h, z)
    if labels:
        d = ImageDraw.Draw(im)
        for i, t in enumerate(labels):
            d.text((gap + i * (w * z + gap), Hh - 12), str(t), fill=(200, 200, 210))
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    im.save(path)
    return path


def main(argv=None):
    import art40 as X
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--z', type=int, default=4)
    ap.add_argument('--out')
    ap.add_argument('--strips', default='select-grey,select,select-pick')
    ap.add_argument('--frames', default='')
    a = ap.parse_args(argv)
    s = X.build(a.slug)
    pal = {k: rgb(v) for k, v in s.colours.items()}
    want = [int(f) for f in a.frames.split(',')] if a.frames else None
    cells, labels = [], []
    for name in a.strips.split(','):
        st = s.strips[name]
        for i, f in enumerate(st.frames):
            if want is not None and i not in want:
                continue
            rows = f.rows if hasattr(f, 'rows') else f[0]
            cells.append(rows)
            labels.append(f'{name} {i} ({st.durations[i]}t)')
    out = a.out or os.path.join(X.ROOT, 'tmp', 'select40-kit-vincent', f'{a.slug}.png')
    print(board(cells, pal, out, a.z, labels=labels))


if __name__ == '__main__':
    main()
