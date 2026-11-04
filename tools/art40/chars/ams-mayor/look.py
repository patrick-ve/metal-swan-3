# MECHA HASLEMA: the look renders for the user's review (wave 1 pilot; nothing in the game changes).
#
#   python3 tools/art40/chars/ams-mayor/look.py [--out tmp/ams40-looks/mayor]
#
# Writes look.png, stamp.png, damage.png, before-after.png, lineup.png (+ lineup@3x.png) and prints
# the checks (colour count, outline, edge orphans, height). Deterministic: same bytes every run.
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.abspath(os.path.join(HERE, '..', '..'))
ROOT = os.path.abspath(os.path.join(TOOLS, '..', '..'))
sys.path.insert(0, TOOLS)

import art40 as X  # noqa: E402

M = X.char('ams-mayor')
cv, pal = M.cv, M.pal

BG = (153, 217, 234)          # the cast page's sky
BG2 = (92, 104, 128)          # a dark stage, to judge the outline
CAST = os.path.join(ROOT, 'docs', 'design', 'cast40', 'out', 'ams-mayor.json')


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def to_image(pic, colours, bg=BG, pad=4):
    from PIL import Image
    x0, y0, x1, y1 = cv.bbox(pic)
    im = Image.new('RGB', (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), bg)
    for (x, y), ch in pic.items():
        im.putpixel((x - x0 + pad, y - y0 + pad), rgb(colours[ch]))
    return im


def rows_pic(rows):
    return {(x, y): ch for y, r in enumerate(rows) for x, ch in enumerate(r) if ch != '.'}


def zoom(im, n):
    from PIL import Image
    return im.resize((im.size[0] * n, im.size[1] * n), Image.NEAREST)


def row(images, bg=BG, gap=8, align='bottom'):
    from PIL import Image
    w = sum(i.size[0] for i in images) + gap * (len(images) - 1)
    h = max(i.size[1] for i in images)
    out = Image.new('RGB', (w, h), bg)
    x = 0
    for i in images:
        out.paste(i, (x, h - i.size[1] if align == 'bottom' else 0))
        x += i.size[0] + gap
    return out


def column(images, bg=BG, gap=8):
    from PIL import Image
    w = max(i.size[0] for i in images)
    h = sum(i.size[1] for i in images) + gap * (len(images) - 1)
    out = Image.new('RGB', (w, h), bg)
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.size[1] + gap
    return out


def label(im, text, bg=BG):
    """A caption strip over an image (PIL's default bitmap font)."""
    from PIL import Image, ImageDraw
    out = Image.new('RGB', (max(im.size[0], 8 * len(text)), im.size[1] + 14), bg)
    ImageDraw.Draw(out).text((2, 1), text, fill=(20, 12, 14))
    out.paste(im, (0, 14))
    return out


# ------------------------------------------------------------------------------------------- checks
def check(pic, name):
    """The look's own gates: colours <= 64, the exterior edge is the one outline, edge orphans."""
    used = sorted({ch for ch in pic.values()})
    body = sorted({pal.PAL[ch].lower() for ch in used if ch not in pal.FX})
    bad_edge, orphans = 0, 0
    for (x, y), ch in pic.items():
        nb = [pic.get((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        if ch != pal.OUTLINE and ch not in pal.FX and any(n is None for n in nb):
            bad_edge += 1                      # a body colour touching transparency (no AA against it)
        if ch not in pal.HL and ch not in pal.FX and ch != pal.OUTLINE and None not in nb and all(n != ch for n in nb):
            orphans += 1                       # a lone interior pixel (info: details and knots)
    x0, y0, x1, y1 = cv.bbox(pic)
    res = {'piece': name, 'colours': len(body), 'edge_not_outline': bad_edge, 'interior_singles': orphans,
           'w': x1 - x0, 'h': y1 - y0}
    assert len(body) <= 64, res
    assert bad_edge == 0, res
    return res


def vincent():
    """VINCENT's first idle frame from the kit, in a process of its own (the kit's tables are global)."""
    code = ('import sys,json; sys.path.insert(0, %r); import art40, hero; hero.load("vincent"); '
            'import groups, comp, rig; G = groups.groups(); g = [g for g in G if g["title"] == "Idle"][0]; '
            'r = comp.step_rows(g["steps"][0]); used = {c for l in r for c in l if c != "."}; '
            'print(json.dumps({"rows": r, "pal": {k: rig.PAL[k] for k in sorted(used)}}))') % TOOLS
    out = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, cwd=ROOT, check=True)
    d = json.loads(out.stdout)
    return rows_pic(d['rows']), d['pal']


def main(argv):
    out = os.path.join(ROOT, 'tmp', 'ams40-looks', 'mayor')
    if '--out' in argv:
        out = os.path.abspath(argv[argv.index('--out') + 1])
    os.makedirs(out, exist_ok=True)
    P = pal.PAL
    stats = []

    # look.png: the whole boss at stage 0 facing left (as in the fight), 1x and 3x
    idle = M.figure(stage=0, arm=0, face='smile', facing=-1)
    stats.append(check(idle, 'figure stage 0 (stamp low)'))
    im = to_image(idle, P)
    row([label(im, '1x'), label(zoom(im, 3), '3x  MECHA HASLEMA, stage 0')]).save(os.path.join(out, 'look.png'))

    # stamp.png: the stamp arm raised (pose 1, the telegraph), the figure and the arm piece alone
    raised = M.figure(stage=0, arm=1, face='shout', facing=-1)
    stats.append(check(raised, 'figure stage 0 (stamp raised)'))
    arm = cv.mirror(cv.finish(M.limbs.stamp_arm(1, 0, True), fx=pal.FX))
    stats.append(check(arm, 'stamp-arm pose 1'))
    im2, ima = to_image(raised, P), to_image(arm, P)
    row([label(im2, '1x'), label(zoom(im2, 3), '3x  stamp raised (pose 1)'),
         label(zoom(ima, 3), '3x  the stamp-arm piece')]).save(os.path.join(out, 'stamp.png'))

    # damage.png: head and medallion at damage stages 0, 1, 2 (1x row, then 4x)
    heads, meds = [], []
    for s in (0, 1, 2):
        h = cv.mirror(cv.finish(M.head.head(s, 'smile'), fx=pal.FX))
        m = cv.mirror(cv.finish(M.jewel.medallion(s, 0), fx=pal.FX))
        stats.append(check(h, f'head-{s}'))
        stats.append(check(m, f'medallion-{s}'))
        heads.append(to_image(h, P))
        meds.append(to_image(m, P))
    one = row(heads + meds)
    big_h = row([label(zoom(i, 4), f'head-{s} 4x') for s, i in enumerate(heads)])
    big_m = row([label(zoom(i, 6), f'medallion-{s} 6x') for s, i in enumerate(meds)])
    column([label(one, '1x: head-0 head-1 head-2 medallion-0 medallion-1 medallion-2'), big_h, big_m]).save(
        os.path.join(out, 'damage.png'))

    # before-after.png: the cast sample (stamp wind-up) next to the new look (stamp raised)
    with open(CAST) as f:
        cast = json.load(f)
    old = to_image(rows_pic(cast['rows']), cast['pal'])
    new = to_image(raised, P)
    row([label(old, f"cast {cast['colours']} col"), label(new, f"new {stats[1]['colours']} col"),
         label(zoom(old, 3), '3x cast sample'), label(zoom(new, 3), '3x new look')]).save(os.path.join(out, 'before-after.png'))

    # lineup.png: next to VINCENT at 1x on a 384 x 216 strip (and a 3x copy to view)
    from PIL import Image
    strip = Image.new('RGB', (384, 216), BG)
    ground = 200
    for y in range(ground, 216):
        for x in range(384):
            strip.putpixel((x, y), (96, 112, 92) if y == ground else (128, 140, 118))
    vpic, vpal = vincent()
    vx0, vy0, vx1, vy1 = cv.bbox(vpic)
    for (x, y), ch in vpic.items():
        strip.putpixel((120 + x - vx0, ground - (vy1 - y)), rgb(vpal[ch]))
    for (x, y), ch in idle.items():
        strip.putpixel((262 + x, ground + y), rgb(P[ch]))
    strip.save(os.path.join(out, 'lineup.png'))
    zoom(strip, 3).save(os.path.join(out, 'lineup@3x.png'))
    stats.append({'piece': 'VINCENT idle (kit)', 'w': vx1 - vx0, 'h': vy1 - vy0})

    for s in stats:
        print(json.dumps(s))
    used = sorted({ch for pic in (idle, raised) for ch in pic.values()} |
                  {ch for s in (0, 1, 2) for pic in (cv.finish(M.head.head(s), fx=pal.FX),
                                                    cv.finish(M.jewel.medallion(s), fx=pal.FX)) for ch in pic.values()})
    body = sorted({P[c].lower() for c in used if c not in pal.FX})
    print(json.dumps({'palette_body_colours': len(pal.body_colours()), 'used_body_colours': len(body),
                      'fx_letters_used': ''.join(c for c in used if c in pal.FX)}))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
