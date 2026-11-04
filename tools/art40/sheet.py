# Contact sheets of a baked set: tmp/art40/<slug>/sheet.png (every strip at 1x and at a 4x zoom,
# the hold in ticks under each frame, the variants' first frames) and tmp/art40/<slug>/<strip>.gif
# (4x, at the real timing). Reads the render of art40.normalize (letters per frame).
import os

BG = (153, 217, 234)          # the squad page's sky
INK = (20, 12, 14)
DIM = (70, 80, 96)
ZOOM = 4
GAP = 3


def _rgb(v):
    return tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))


def _paint(im, f, pal, x0, y0, scale):
    px = im.load()
    for y, r in enumerate(f['rows']):
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            c = pal[ch]
            for yy in range(scale):
                for xx in range(scale):
                    px[x0 + x * scale + xx, y0 + y * scale + yy] = c


def _font():
    from PIL import ImageFont
    return ImageFont.load_default()


def sheet(render, baked, path):
    from PIL import Image, ImageDraw
    pal = {k: _rgb(v) for k, v in render['pal'].items()}
    strips = render['strips']
    font = _font()
    # layout: per strip one label line, one 1x row (shared baseline at the anchor), one 4x row + ticks
    rows = []
    width = 0
    for name, frames in strips.items():
        up = max(f['oy'] for f in frames)
        down = max(f['h'] - f['oy'] for f in frames)
        left = max(f['ox'] for f in frames)
        right = max(f['w'] - f['ox'] for f in frames)
        cw, ch = left + right, up + down
        n = len(frames)
        w1 = n * (cw + GAP)
        w4 = n * (cw * ZOOM + GAP * 2)
        rows.append((name, frames, left, up, cw, ch))
        width = max(width, w1, w4, 420)
    vnames = list(render.get('variants', {}))
    height = 6
    for name, frames, left, up, cw, ch in rows:
        height += 14 + ch + GAP + ch * ZOOM + 14 + 8 + (12 if baked['strips'][name].get('why') else 0)
    if vnames:
        height += 14 + 60 * len(vnames)
    width += 12
    im = Image.new('RGB', (width, height), BG)
    dr = ImageDraw.Draw(im)
    y = 6
    for name, frames, left, up, cw, ch in rows:
        st = baked['strips'][name]
        total = sum(st['durations'])
        label = (f"{name}  [{st['cls']}]  {len(frames)} fr  {total} t  {'loop' if st['loop'] else 'once'}"
                 + ('  defer' if st.get('defer') else ''))
        dr.text((6, y), label, fill=INK, font=font)
        y += 14
        if st.get('why'):
            dr.text((6, y - 2), 'why: ' + st['why'], fill=DIM, font=font)
            y += 12
        for i, f in enumerate(frames):
            _paint(im, f, pal, 6 + i * (cw + GAP) + left - f['ox'], y + up - f['oy'], 1)
        y += ch + GAP
        for i, f in enumerate(frames):
            x0 = 6 + i * (cw * ZOOM + GAP * 2)
            _paint(im, f, pal, x0 + (left - f['ox']) * ZOOM, y + (up - f['oy']) * ZOOM, ZOOM)
            sm = '~' if baked['strips'][name]['frames'][i].get('smear') else ''
            dr.text((x0, y + ch * ZOOM + 1), f'{i}:{st["durations"][i]}t{sm}', fill=DIM, font=font)
        y += ch * ZOOM + 14 + 8
    if vnames:
        dr.text((6, y), 'variants (first frame of every strip)', fill=INK, font=font)
        y += 14
        for v in vnames:
            vp = {k: _rgb(c) for k, c in render['variants'][v].items()}
            dr.text((6, y), v, fill=DIM, font=font)
            x = 6
            for name, frames, left, up, cw, ch in rows:
                f = frames[0]
                if x + f['w'] > width or f['h'] > 46:
                    continue
                _paint(im, f, vp, x, y + 12 + 46 - f['h'], 1)
                x += f['w'] + GAP
            y += 60
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


def gif(frames, durations, pal_hex, path):
    """One strip as an animated GIF at 4x and the real timing (60 Hz ticks -> 10 ms GIF units, the
    rounding carried so the total time stays right)."""
    from PIL import Image
    pal = {k: _rgb(v) for k, v in pal_hex.items()}
    left = max(f['ox'] for f in frames)
    right = max(f['w'] - f['ox'] for f in frames)
    up = max(f['oy'] for f in frames)
    down = max(f['h'] - f['oy'] for f in frames)
    W, H = (left + right + 4) * ZOOM, (up + down + 4) * ZOOM
    ims, delays = [], []
    acc = 0.0
    done = 0
    for f, d in zip(frames, durations):
        im = Image.new('RGB', (W, H), BG)
        _paint(im, f, pal, (2 + left - f['ox']) * ZOOM, (2 + up - f['oy']) * ZOOM, ZOOM)
        ims.append(im)
        acc += d * 1000 / 60
        ms = int(round(acc / 10)) * 10 - done
        ms = max(ms, 20)
        done += ms
        delays.append(ms)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=delays, loop=0, disposal=1)
