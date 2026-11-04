#!/usr/bin/env python3
"""The Swan look sample (wave 1 pilot): renders the review images with VINCENT riding.

    python3 tools/art40/chars/swan/look.py [--out tmp/ams40-looks/swan]

Writes look.png (idle on the street, 1x + 4x), run.png (the 12-frame run cycle), aim.png + aim-debug.png (the barrel
at 5 of the 9 aim steps; the debug copy marks muzzle / seat / socket), aim9-debug.png (all 9),
swim.png (on the water line), p2.png (P1 and the two P2 candidates), lineup.png (384x216 at 1x:
the old Swan, VINCENT on foot, the new Swan) and lineup-3x.png. Deterministic (no random, no time).
"""
import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART40 = os.path.abspath(os.path.join(HERE, '..', '..'))
ROOT = os.path.abspath(os.path.join(ART40, '..', '..'))
for p in (ART40, os.path.join(ART40, 'kit')):
    if p not in sys.path:
        sys.path.insert(0, p)

from PIL import Image, ImageDraw  # noqa: E402
import art40  # noqa: E402,F401  (puts the kit on the path the same way the bake does)
import hero  # noqa: E402
import rig  # noqa: E402
import pose  # noqa: E402
import anims as A  # noqa: E402

S = art40.char('swan')
B, PO, SP = S.B, S.PO, S.palette

OLD = os.path.join(ROOT, 'tmp', 'ams40-old')
BG = {'wall': (74, 82, 104), 'wall2': (64, 71, 92), 'mortar': (56, 62, 80), 'pave': (128, 118, 110),
      'pave2': (108, 99, 93), 'kerb': (156, 148, 138), 'water': (46, 92, 126), 'water2': (70, 124, 160),
      'foam': (196, 224, 240), 'label': (235, 235, 235)}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rows_img(rows, pal):
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                px[x, y] = hexrgb(pal[ch]) + (255,)
    return im


def rnd(v):
    return int(math.floor(v + 0.5))


# ------------------------------------------------------------------ the rider (VINCENT, kit)
def rider_img(key, i):
    up = dict(A.UPPER[key][i][0])
    up['pelvis'] = (0, -17)
    layers = []
    back = pose.compose(up, 'back')[0]
    if back:
        layers.append(back)
    layers.append(pose.compose(up, 'upper')[0])
    out = Image.new('RGBA', (pose.W, pose.H), (0, 0, 0, 0))
    for rows in layers:
        out.alpha_composite(rows_img(rows, rig.PAL))
    return out, (pose.RX, pose.RY - 17)       # the pelvis in the rider's rows


def rider_leg(ank=(-2, -5), shoe='hang', bend=-1):
    """The rider's near leg over the Swan's flank (wave 1 verify: the thigh, the knee and the boot
    show over the saddle flap, the drum sits under the knee). The kit's lower body with both legs on
    the same place (the far leg is hidden behind the Swan); the pelvis on the seat like the rider."""
    lo = A.legs((0, -17), ank, ank, shoe, shoe, bend, bend)
    rows = pose.compose(lo, 'lower')[0]
    return rows_img(rows, rig.PAL), (pose.RX, pose.RY - 17)


def vincent_on_foot():
    import castkit as K
    rows, root = K.humanoid(A.UPPER['idle'][0][0], A.LOWER['stand'][0][0])
    return rows_img(rows, rig.PAL), (root[0], root[1] + 1)


# ------------------------------------------------------------------ the Swan with the rider
def swan_img(name, aim=2, variant=None, rider=True, ride=None):
    """The composite on a B.CW x B.CH canvas (feet anchor at B.OX, B.OY): b, rider, f, n."""
    r = S.render(name, aim)
    pal = SP.colours(variant)
    im = Image.new('RGBA', (B.CW, B.CH), (0, 0, 0, 0))
    im.alpha_composite(rows_img(r['rows']['b'], pal))
    if rider:
        key = ride or r['rider']
        rim, pel = rider_img(*key)
        st = r['pts']['seat']
        im.alpha_composite(rim, (rnd(B.OX + st[0] - pel[0]), rnd(B.OY + st[1] - pel[1])))
    im.alpha_composite(rows_img(r['rows']['f'], pal))
    if rider and r.get('water') is None:
        lim, pel = rider_leg()
        st = r['pts']['seat']
        im.alpha_composite(lim, (rnd(B.OX + st[0] - pel[0]), rnd(B.OY + st[1] - pel[1])))
    im.alpha_composite(rows_img(r['rows']['n'], pal))
    return im, r


def swan_colours(variants=(None, 'black')):
    """Distinct colours over every look render of the Swan layers, per palette."""
    out = {}
    for v in variants:
        pal = SP.colours(v)
        used = set()
        for name in PO.POSES:
            for i in range(9):
                r = S.render(name, i)
                for rows in r['rows'].values():
                    for row in rows:
                        used.update(ch for ch in row if ch != '.')
        out[v or 'p1'] = (len({pal[c] for c in used}), sorted(used))
    return out


# ------------------------------------------------------------------ backgrounds
def street(w, h, ground):
    im = Image.new('RGBA', (w, h), BG['wall'] + (255,))
    d = ImageDraw.Draw(im)
    for y in range(0, ground - 6, 6):                       # a brick wall
        d.line([(0, y), (w, y)], fill=BG['mortar'])
        off = 0 if (y // 6) % 2 == 0 else 7
        for x in range(off, w, 14):
            d.line([(x, y), (x, y + 5)], fill=BG['mortar'])
    d.rectangle([0, ground - 6, w, ground - 1], fill=BG['wall2'])
    d.rectangle([0, ground, w, h], fill=BG['pave'] + (255,))
    d.line([(0, ground), (w, ground)], fill=BG['kerb'])
    for y in range(ground + 4, h, 5):
        d.line([(0, y), (w, y)], fill=BG['pave2'])
        off = 0 if ((y - ground) // 5) % 2 == 0 else 5
        for x in range(off, w, 10):
            d.line([(x, y - 4), (x, y - 1)], fill=BG['pave2'])
    return im


def water(w, h, surface):
    im = Image.new('RGBA', (w, h), BG['wall'] + (255,))
    d = ImageDraw.Draw(im)
    for y in range(0, surface - 10, 6):
        d.line([(0, y), (w, y)], fill=BG['mortar'])
        off = 0 if (y // 6) % 2 == 0 else 7
        for x in range(off, w, 14):
            d.line([(x, y), (x, y + 5)], fill=BG['mortar'])
    d.rectangle([0, surface - 10, w, surface - 1], fill=BG['wall2'])
    return im


def water_front(w, h, surface, x0, x1):
    """The water in front of the swimmer: translucent under the surface, a lit surface line and
    two ripple rings at her breast and tail."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, surface, w, h], fill=BG['water'] + (210,))
    d.line([(0, surface), (w, surface)], fill=BG['water2'] + (255,))
    for x in range(0, w, 9):
        d.line([(x, surface + 3 + (x // 9) % 3), (x + 3, surface + 3 + (x // 9) % 3)], fill=BG['water2'] + (255,))
    for x in (x0, x1):
        d.line([(x - 3, surface), (x + 3, surface)], fill=BG['foam'] + (255,))
        d.point([(x - 5, surface + 1), (x + 5, surface + 1)], fill=BG['foam'] + (255,))
    return im


# ------------------------------------------------------------------ sheets
def zoom(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def crop_box(ims, m=3):
    xs0, ys0, xs1, ys1 = [], [], [], []
    for im in ims:
        b = im.getbbox()
        if b:
            xs0.append(b[0]); ys0.append(b[1]); xs1.append(b[2]); ys1.append(b[3])
    return (max(0, min(xs0) - m), max(0, min(ys0) - m), min(B.CW, max(xs1) + m), min(B.CH, max(ys1) + m))


def on(bg, im):
    out = bg.copy()
    out.alpha_composite(im)
    return out


def strip(cells, gap=4, k=1, bgc=(30, 32, 40, 255)):
    w = sum(c.width for c in cells) * k + gap * (len(cells) + 1)
    h = max(c.height for c in cells) * k + gap * 2
    out = Image.new('RGBA', (w, h), bgc)
    x = gap
    for c in cells:
        out.alpha_composite(zoom(c, k), (x, gap))
        x += c.width * k + gap
    return out


def stack(rows, gap=4, bgc=(30, 32, 40, 255)):
    w = max(r.width for r in rows)
    h = sum(r.height for r in rows) + gap * (len(rows) - 1)
    out = Image.new('RGBA', (w, h), bgc)
    y = 0
    for r in rows:
        out.alpha_composite(r, (0, y))
        y += r.height + gap
    return out


def mark(im, p, col):
    x, y = rnd(B.OX + p[0]), rnd(B.OY + p[1])
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), col)


def scene(ims, bg_fn, gap=6):
    """1x cells on one background, cropped to their common box."""
    box = crop_box(ims)
    cells = []
    for im in ims:
        bg = bg_fn(B.CW, B.CH)
        cells.append(on(bg, im).crop(box))
    return cells, box


# ------------------------------------------------------------------ old frames (before)
def old_frame(sid, i=0):
    meta = json.load(open(os.path.join(OLD, 'index.json')))['sprites'].get(sid)
    if not meta:
        return None
    x1 = meta['x1']
    im = Image.open(os.path.join(OLD, x1['png'])).convert('RGBA')
    c = x1['cell']
    fr = im.crop((i * c['w'], 0, (i + 1) * c['w'], c['h']))
    return fr, (c['ax'], c['ay']), x1['frames'][i].get('pts', {})


def old_swan():
    """The old Swan with the old VINCENT: body idle 0, the rider at 'seat', the front overlay, the
    neck at aim step 2 (0 deg) on 'neck'. Returns (image, anchor)."""
    W_, H_ = 140, 120
    ax, ay = 60, 112
    out = Image.new('RGBA', (W_, H_), (0, 0, 0, 0))
    body, ban, bpts = old_frame('vehicle/swan/idle')
    out.alpha_composite(body, (ax - ban[0], ay - ban[1]))
    rid = old_frame('char/vincent/ride-sit')
    if rid:
        rim, ran, _ = rid
        out.alpha_composite(rim, (ax + bpts['seat'][0] - ran[0], ay + bpts['seat'][1] - ran[1]))
    fr = old_frame('vehicle/swan/idle-front')
    if fr:
        fim, fan, _ = fr
        out.alpha_composite(fim, (ax - fan[0], ay - fan[1]))
    nk = old_frame('vehicle/swan/neck', 2)
    if nk:
        nim, nan, _ = nk
        out.alpha_composite(nim, (ax + bpts['neck'][0] - nan[0], ay + bpts['neck'][1] - nan[1]))
    return out, (ax, ay)


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'tmp', 'ams40-looks', 'swan'))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    hero.load('vincent', only=['ride'])
    out = lambda n: os.path.join(a.out, n)

    # look.png: idle (two breaths) on the street, 1x and 4x
    ims = [swan_img('stand0')[0], swan_img('stand1')[0]]
    cells, _ = scene(ims, lambda w, h: street(w, h, B.OY))
    one = strip([cells[0]], gap=6)
    big = strip([cells[0]], gap=6, k=4)
    pair = strip(cells, gap=6, k=3)
    stack([one, big, pair], gap=6).save(out('look.png'))

    # run.png: the 12-frame run cycle at 1x, then 2x in two rows of six
    ims = [swan_img('run%d' % k)[0] for k in range(PO.RUN_N)]
    cells, _ = scene(ims, lambda w, h: street(w, h, B.OY))
    stack([strip(cells, gap=6), strip(cells[:6], gap=6, k=2), strip(cells[6:], gap=6, k=2)], gap=6).save(out('run.png'))

    # aim.png + aim-debug.png: 5 of the 9 steps (0 +45, 2 0, 4 -45, 6 -90, 8 -135 deg)
    steps = [0, 2, 4, 6, 8]
    rs = [swan_img('stand0', i, ride=PO.aim_rider(i)) for i in steps]
    cells, box = scene([r[0] for r in rs], lambda w, h: street(w, h, B.OY))
    stack([strip(cells, gap=6), strip(cells, gap=6, k=3)], gap=6).save(out('aim.png'))
    dbg = []
    for (im, r), c in zip(rs, cells):
        d = on(street(B.CW, B.CH, B.OY), im)
        mark(d, r['pts']['muzzle'], (255, 0, 255, 255))
        mark(d, r['pts']['seat'], (0, 255, 255, 255))
        mark(d, r['pts']['neck'], (255, 255, 0, 255))
        dbg.append(d.crop(box))
    stack([strip(dbg, gap=6), strip(dbg, gap=6, k=3)], gap=6).save(out('aim-debug.png'))
    rs9 = [swan_img('stand0', i, ride=PO.aim_rider(i)) for i in range(9)]
    dbg9 = []
    box9 = crop_box([r[0] for r in rs9])
    for im, r in rs9:
        d = on(street(B.CW, B.CH, B.OY), im)
        mark(d, r['pts']['muzzle'], (255, 0, 255, 255))
        dbg9.append(d.crop(box9))
    strip(dbg9, gap=4, k=2).save(out('aim9-debug.png'))

    # swim.png: on the water line (the surface 16 px above the feet anchor)
    im, r = swan_img('swim')
    surf = B.OY + r['water']
    bg = water(B.CW, B.CH, surf)
    sc = on(bg, im)
    sc.alpha_composite(water_front(B.CW, B.CH, surf, B.OX + 20, B.OX - 22))
    box = crop_box([im])
    box = (box[0], box[1], box[2], min(B.CH, surf + 10))
    sc = sc.crop(box)
    stack([strip([sc], gap=6), strip([sc], gap=6, k=4)], gap=6).save(out('swim.png'))

    # p2.png: P1 and P2, the black swan (the same pixels)
    ims = [swan_img('stand0', variant=v)[0] for v in (None, 'black')]
    cells, _ = scene(ims, lambda w, h: street(w, h, B.OY))
    stack([strip(cells, gap=6), strip(cells, gap=6, k=3)], gap=6).save(out('p2.png'))

    # lineup.png: 384x216 at 1x, the ground at y 200: the old Swan, VINCENT on foot, the new Swan
    lw, lh, gy = 384, 216, 200
    ln = street(lw, lh, gy)
    old, oan = old_swan()
    ln.alpha_composite(old, (80 - oan[0], gy - oan[1]))
    vin, van = vincent_on_foot()
    ln.alpha_composite(vin, (170 - van[0], gy - van[1]))
    new, _ = swan_img('stand0')
    ln.alpha_composite(new, (270 - B.OX, gy - B.OY))
    ln.save(out('lineup.png'))
    zoom(ln, 3).save(out('lineup-3x.png'))

    cc = swan_colours()
    with open(out('colours.json'), 'w') as f:
        json.dump({k: {'count': v[0], 'letters': ''.join(v[1])} for k, v in cc.items()}, f, indent=1, sort_keys=True)
    for k, v in cc.items():
        print(f'{k}: {v[0]} colours ({"".join(v[1])})')
    r = S.render('stand0', 2)
    print('points (stand0, aim 2):', {k: (round(v[0], 1), round(v[1], 1)) for k, v in r['pts'].items()})
    for i in range(9):
        r = S.render('stand0', i)
        m, n = r['pts']['muzzle'], r['pts']['neck']
        print(f'aim {i} ({B.AIM_DEG[i]:+.1f} deg): muzzle {rnd(m[0])},{rnd(m[1])}  rel. socket {rnd(m[0] - n[0])},{rnd(m[1] - n[1])}')


if __name__ == '__main__':
    main()
