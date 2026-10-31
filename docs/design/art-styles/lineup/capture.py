#!/usr/bin/env python3
"""Capture one art-direction style of VINCENT (src/game/content/characters/styles/).

usage: python3 docs/design/art-styles/lineup/capture.py <style|vincent> [--res 4] [--street] [--every 1]

<style> is a style id (arcade, chibi, ...) → character vincent-<style>; `vincent` = the game today.
1. The arena clip (tools/arena.ts, 4× art): stand, run right, jump, shoot, aim up and shoot,
   crouch and shoot, run on. One PNG per tick (or per --every ticks), cropped around the player:
   tmp/styles/out/<style>/fNNN.png.
2. With --street: one still in ams section a (tools/shot.ts, tick 150, fire held: the gun out) → tmp/styles/out/<style>-street.png.
"""
import argparse
import os
import subprocess
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
BG = (0x15, 0x12, 0x1B)
CHUNK = 48
TICKS = 168
# Buttons per tick range (1-based ticks): idle 1-24, run 25-56, jump, shoot, up + shoot, crouch + shoot, run on.
PRESS = ';'.join([
    '25-56:right', '57:right,jump', '58-70:right',
    '84:fire', '92:fire',
    '100-126:up', '106:up,fire', '114:up,fire',
    '132-150:down', '140:down,fire',
    '151-168:right',
])
# Logical crop around the player's path (x 80 → ~190).
REGION = (40, 70, 260, 190)


def cells(im):
    W, H = im.size
    px = im.load()
    y_probe = None
    for y in range(H):
        if px[200, y] != BG and px[200, y + 40] != BG:
            y_probe = y + 40
            break
    row = [px[x, y_probe] != BG for x in range(W)]
    xs = [(x, e) for x in range(W) if row[x] and (x == 0 or not row[x - 1])
          for e in [next(k for k in range(x, W) if k == W - 1 or not row[k + 1])]]
    x_probe = xs[0][0] + 40
    col = [px[x_probe, y] != BG for y in range(H)]
    ys = [(y, e) for y in range(H) if col[y] and (y == 0 or not col[y - 1])
          for e in [next(k for k in range(y, H) if k == H - 1 or not col[k + 1])]]
    fw = xs[0][1] - xs[0][0] + 1
    ys = [(a, b) for a, b in ys if b - a + 1 > fw * 0.4]
    return [(x0, y0, x1 - x0 + 1, y1 - y0 + 1) for (y0, y1) in ys for (x0, x1) in xs]


def char_of(style):
    if style.startswith('_'):
        return style[1:]
    return 'vincent' if style == 'vincent' else f'vincent-{style}'


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout[-2000:] + r.stderr[-3000:])
        sys.exit(1)
    return r


def arena(style, res, every):
    out_dir = os.path.join(ROOT, 'tmp', 'styles', 'out', style)
    os.makedirs(out_dir, exist_ok=True)
    k = res
    x0, y0, x1, y1 = REGION
    ticks = list(range(1, TICKS + 1, every))
    n = 0
    for start in range(0, len(ticks), CHUNK):
        part = ticks[start:start + CHUNK]
        sheet = os.path.join(ROOT, 'tmp', 'styles', 'out', f'{style}-sheet-{start}.png')
        run(['npx', 'tsx', 'tools/arena.ts', '--char', char_of(style), '--spawn', 'rifleman@+200', '--press', PRESS,
             '--ticks', str(part[0]), '--every', str(every), '--count', str(len(part)), '--res', str(res),
             '--art', '4' if res >= 4 else '2', '--cols', '8', '--god', '--out', sheet])
        im = Image.open(sheet).convert('RGB')
        for i, (cx, cy, cw, ch) in enumerate(cells(im)[:len(part)]):
            assert cw == 384 * k and ch == 216 * k, (cw, ch)
            im.crop((cx + x0 * k, cy + y0 * k, cx + x1 * k, cy + y1 * k)).save(os.path.join(out_dir, f'f{start + i:03d}.png'))
            n += 1
        os.remove(sheet)
    print(f'{style}: {n} frames -> {out_dir}')


def street(style, res):
    out = os.path.join(ROOT, 'tmp', 'styles', 'out', f'{style}-street.png')
    run(['npx', 'tsx', 'tools/shot.ts', '--mission', 'ams', '--section', 'a', '--x', '260', '--ticks', '150', '--hold', 'fire',
         '--char', char_of(style), '--res', str(res), '--art', '4' if res >= 4 else '2', '--god', '--out', out])
    print(f'{style}: street -> {out}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('style')
    ap.add_argument('--res', type=int, default=4)
    ap.add_argument('--every', type=int, default=1)
    ap.add_argument('--street', action='store_true')
    ap.add_argument('--no-arena', action='store_true')
    a = ap.parse_args()
    if not a.no_arena:
        arena(a.style, a.res, a.every)
    if a.street:
        street(a.style, a.res)


if __name__ == '__main__':
    main()
