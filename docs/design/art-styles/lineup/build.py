#!/usr/bin/env python3
"""Build the player art-direction lineup page from the style captures (capture.py, next to this file).

usage: python3 docs/design/art-styles/lineup/build.py [--capture] [--only arcade,chibi]
  --capture   (re)capture the given styles first (arena clip + street still)
→ tmp/styles/page/site/index.html (git-ignored) + clips/<id>-wide.mp4, clips/<id>-close.mp4, stills/<id>-street.webp

The close-up follows the player: its box per frame comes from player-boxes.json (next to this file) (the
pixels that differ between VINCENT and BOB in the same clip), the left edge + 15 logical px, the
feet at the box bottom, smoothed over ±3 frames.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
SITE = os.path.join(ROOT, 'tmp', 'styles', 'page', 'site')
OUT = os.path.join(ROOT, 'tmp', 'styles', 'out')
STYLES = ['vincent', 'arcade', 'chibi', 'comic', 'gritty', 'painted', 'clay']
FRAMES = 168
K = 4
# Close-up window (logical px): width, height, feet row from the top.
CW, CH, FEET = 72, 64, 57
PLAY = 'http://127.0.0.1:5520/?mission=ams&char='
BASE = {'name': 'NOW IN THE GAME', 'blurb': 'Vincent as he is drawn today: the rig\'s lit volumes, a dark outline and soft bands.'}


def style_text(sid):
    if sid == 'vincent':
        return BASE
    src = open(os.path.join(ROOT, 'src/game/content/characters/styles', f'{sid}.ts')).read()

    def field(k):
        m = re.search(k + r":\s*'((?:[^'\\]|\\.)*)'", src)
        return m.group(1).replace("\\'", "'") if m else sid
    return {'name': field('name'), 'blurb': field('blurb')}


def follow_windows():
    boxes = json.load(open(os.path.join(HERE, 'player-boxes.json')))
    raw = []
    for i in range(FRAMES):
        b = boxes[str(i)]
        raw.append((b[0] / K + 15, b[3] / K))
    out = []
    for i in range(FRAMES):
        win = raw[max(0, i - 3):i + 4]
        cx = sum(p[0] for p in win) / len(win)
        fy = sum(p[1] for p in win) / len(win)
        x0 = round(cx - CW / 2)
        y0 = round(fy - FEET)
        out.append((x0, y0))
    return out


def encode(frames_dir, pattern, out, crop=None):
    tmp = tempfile.mkdtemp(prefix='clip-')
    try:
        for i in range(FRAMES):
            im = Image.open(os.path.join(frames_dir, f'f{i:03d}.png')).convert('RGB')
            if crop:
                x0, y0 = crop[i]
                W, H = im.size
                tile = Image.new('RGB', (CW * K, CH * K), (0, 0, 0))
                tile.paste(im.crop((x0 * K, y0 * K, x0 * K + CW * K, y0 * K + CH * K)), (0, 0))
                im = tile
            im.save(os.path.join(tmp, f'f{i:03d}.png'))
        src = os.path.join(tmp, 'f%03d.png')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '60', '-i', src,
                        '-c:v', 'libx264', '-g', '15', '-crf', '12', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], check=True)
        # VP9 too (open-source Chromium builds have no H.264): the page offers WebM first.
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '60', '-i', src,
                        '-c:v', 'libvpx-vp9', '-g', '15', '-crf', '18', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p', out[:-4] + '.webm'], check=True)
    finally:
        shutil.rmtree(tmp)
    return os.path.getsize(out) + os.path.getsize(out[:-4] + '.webm')


def street(sid, out):
    src = os.path.join(OUT, f'{sid}-street.png')
    im = Image.open(src).convert('RGB')
    # The shot sheet: a title bar on top, a label row below; the frame is 384×216 logical at K.
    W, H = im.size
    fw, fh = 384 * K, 216 * K
    x0 = (W - fw) // 2
    px = im.load()
    y0 = next(y for y in range(H) if px[W // 2, y] != px[W // 2, 2] and y > 20)
    im.crop((x0, y0, x0 + fw, y0 + fh)).save(out, 'WEBP', quality=92, method=6)
    return os.path.getsize(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--capture', action='store_true')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    only = set(filter(None, a.only.split(',')))
    os.makedirs(os.path.join(SITE, 'clips'), exist_ok=True)
    os.makedirs(os.path.join(SITE, 'stills'), exist_ok=True)
    if a.capture:
        for sid in STYLES:
            if only and sid not in only:
                continue
            r = subprocess.run([sys.executable, os.path.join(HERE, 'capture.py'), sid, '--street'], cwd=ROOT)
            if r.returncode != 0:
                sys.exit(f'capture failed: {sid}')
    windows = follow_windows()
    looks = []
    for sid in STYLES:
        d = os.path.join(OUT, sid)
        if not os.path.isfile(os.path.join(d, f'f{FRAMES - 1:03d}.png')) or not os.path.isfile(os.path.join(OUT, f'{sid}-street.png')):
            print(f'{sid}: no capture yet, skipped')
            continue
        if not only or sid in only or not os.path.isfile(os.path.join(SITE, 'clips', f'{sid}-close.mp4')):
            n1 = encode(d, 'f%03d.png', os.path.join(SITE, 'clips', f'{sid}-wide.mp4'))
            n2 = encode(d, 'f%03d.png', os.path.join(SITE, 'clips', f'{sid}-close.mp4'), windows)
            n3 = street(sid, os.path.join(SITE, 'stills', f'{sid}-street.webp'))
            print(f'{sid}: wide {n1 // 1024} KB, close {n2 // 1024} KB, street {n3 // 1024} KB')
        t = style_text(sid)
        looks.append({'id': sid, 'name': t['name'], 'blurb': t['blurb'],
                      'url': PLAY + ('vincent' if sid == 'vincent' else f'vincent-{sid}'),
                      'char': 'vincent' if sid == 'vincent' else f'vincent-{sid}'})
    data = {'frames': FRAMES, 'looks': looks,
            'views': [{'id': 'close', 'label': 'Close-up', 'w': CW * K, 'h': CH * K},
                      {'id': 'wide', 'label': 'Arena', 'w': 220 * K, 'h': 120 * K},
                      {'id': 'street', 'label': 'Street', 'w': 384 * K, 'h': 216 * K}]}
    html = open(os.path.join(HERE, 'template.html')).read().replace('/*DATA*/null', json.dumps(data))
    open(os.path.join(SITE, 'index.html'), 'w').write(html)
    print(f"{os.path.join(SITE, 'index.html')}: {len(looks)} looks")


if __name__ == '__main__':
    main()
