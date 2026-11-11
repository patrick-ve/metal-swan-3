# Builds the sections of a mission at the art tier U (env) and writes their layers as tiles for the page:
#   work/<mission>/site/l1/<sec>-<layer>-u<U>-<i>.webp  and  .../site/l1/meta-<sec>-u<U>.json
# Usage:  U=4 python3 tools/levelkit/lk.py <mission> export l1a l1b ...   (no names: the mission's SECTIONS)
# (the page's data folder keeps its first name, l1/, for every mission: level.tpl.html reads it)
import json
import os
import sys
import time
import numpy as np
from PIL import Image
from level import *
from check import keyhue
from lkpath import load_module, work_dir
import mission as _M

SITE = os.path.join(work_dir(), 'site')
OUT = os.path.join(SITE, 'l1')
TILE = 2048                      # real pixels per tile (browsers keep large images and canvases below 16384)
os.makedirs(OUT, exist_ok=True)


def crop_rows(a):
    rows = np.where(a[..., 3].any(axis=1))[0]
    if len(rows) == 0:
        return a[:U], 0
    y0 = (rows[0] // U) * U
    y1 = -(-(rows[-1] + 1) // U) * U
    return a[y0:y1], int(y0 // U)


def write_tiles(arr, stem):
    tiles = []
    for x0 in range(0, arr.shape[1], TILE):
        part = arr[:, x0:x0 + TILE]
        if not part[..., 3].any():
            tiles.append([x0, part.shape[1], None])
            continue
        fn = '%s-%d.webp' % (stem, x0 // TILE)
        Image.fromarray(np.ascontiguousarray(part), 'RGBA').save(os.path.join(OUT, fn), 'WEBP', lossless=True, quality=80, method=4)
        tiles.append([x0, part.shape[1], 'l1/' + fn])
    return tiles


def lum_range(a):
    px = a[..., :3][a[..., 3] > 0].astype(float)
    if len(px) == 0:
        return dict(lo=0, hi=0)
    lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]) / 255
    return dict(lo=round(float(np.percentile(lum, 5)), 2), hi=round(float(np.percentile(lum, 95)), 2))


def export(mod):
    t0 = time.time()
    sec = mod.build()
    fr = compose_level(sec, sec.cam // 2)
    hue, share = keyhue(fr.a[..., :3])
    t = sec.L['terrain']
    M = dict(id=sec.id, name=sec.name, hour=sec.hour, u=U, width=sec.W, cam=sec.cam, shadow=list(sec.H['shadow']),
             heroDeck=sec.hero_deck, terrain=dict(ground=t['ground'], platforms=t['platforms'], hazards=t['hazards'], solids=t['solids']),
             m=dict(colors=fr.ncolors(), hue=hue, share=round(share, 2)), layers=[], note=getattr(mod, 'NOTE', ''))
    nbytes = 0
    for ly in sec.layers:
        d = dict(id=ly['id'], kind=ly['kind'], speed=ly['speed'], y=ly['y'], over=bool(ly.get('over')))
        stem = '%s-%s-u%d' % (sec.id, ly['id'].replace('.', '_'), U)
        if ly['kind'] in ('rows', 'frames'):
            fs = ly['frames']
            arr = np.concatenate([f.a for f in fs], 0)
            d['n'] = len(fs); d['h'] = fs[0].ph; d['w'] = fs[0].pw
            if ly['kind'] == 'rows':
                d['s0'], d['s1'] = ly['s0'], ly['s1']
        else:
            arr, dy = crop_rows(ly['img'].a)
            d['y'] = ly['y'] + dy; d['h'] = arr.shape[0]; d['w'] = arr.shape[1]; d['n'] = 1
            if ly['kind'] == 'tile':
                d['drift'] = ly.get('drift', 0)
        d['tiles'] = write_tiles(arr, stem)
        for tl in d['tiles']:
            if tl[2]:
                nbytes += os.path.getsize(os.path.join(SITE, tl[2]))
        if ly['id'] in ('skyline', 'far'):
            M['m'][ly['id']] = lum_range(ly['img'].a)
        M['layers'].append(d)
    json.dump(M, open(os.path.join(OUT, 'meta-%s-u%d.json' % (sec.id, U)), 'w'), separators=(',', ':'), default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    print('%s %s  %d layers  %.1f MB  colours %d  key %d deg %.2f  %.0f s' % (sec.id, sec.name, len(sec.layers), nbytes / 1e6, M['m']['colors'], hue, share, time.time() - t0), flush=True)
    return nbytes


if __name__ == '__main__':
    names = sys.argv[1:] or list(_M.SECTIONS)
    tot = 0
    for n in names:
        tot += export(load_module(n))
    print('tier', U, 'total %.1f MB' % (tot / 1e6))
