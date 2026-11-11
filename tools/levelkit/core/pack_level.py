# Packs the tiles of each section and tier into a few sheets (shelf packing, 4096 x 4096 at most), so the page has
# few files: work/<mission>/site/l1/meta-<sec>-u<U>.json tile entries become [x0, w, sheet, ax, ay]. Run after
# export_level.py.  Usage: python3 tools/levelkit/lk.py <mission> pack
import glob, json, os
from PIL import Image
from lkpath import work_dir
SITE = os.path.join(work_dir(), 'site')
S = 4096
for mp in sorted(glob.glob(os.path.join(SITE, 'l1', 'meta-*-u*.json'))):
    M = json.load(open(mp))
    if M.get('packed'):
        continue
    stem = os.path.basename(mp)[5:-5]
    pieces = []
    for li, ly in enumerate(M['layers']):
        for ti, t in enumerate(ly['tiles']):
            if t[2]:
                pieces.append((li, ti, Image.open(os.path.join(SITE, t[2])).convert('RGBA')))
    pieces.sort(key=lambda p: -p[2].height)
    sheets, cur, x, y, sh = [], None, 0, 0, 0
    place = {}
    for (li, ti, im) in pieces:
        w, h = im.size
        if cur is None or x + w > S:
            x, y, sh = 0, y + sh, 0
        if cur is None or y + h > S:
            cur = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sheets.append(cur); x, y, sh = 0, 0, 0
        cur.paste(im, (x, y)); place[(li, ti)] = (len(sheets) - 1, x, y)
        x += w; sh = max(sh, h)
    names = []
    for i, im in enumerate(sheets):
        bb = im.getbbox() or (0, 0, 1, 1)
        im = im.crop((0, 0, bb[2], bb[3]))
        fn = 'l1/%s-s%d.webp' % (stem, i)
        im.save(os.path.join(SITE, fn), 'WEBP', lossless=True, quality=80, method=4)
        names.append(fn)
    for li, ly in enumerate(M['layers']):
        for ti, t in enumerate(ly['tiles']):
            if t[2]:
                os.remove(os.path.join(SITE, t[2]))
                si, ax, ay = place[(li, ti)]
                ly['tiles'][ti] = [t[0], t[1], names[si], ax, ay]
    M['packed'] = True
    json.dump(M, open(mp, 'w'), separators=(',', ':'))
    print(stem, len(pieces), 'tiles ->', len(sheets), 'sheets')
