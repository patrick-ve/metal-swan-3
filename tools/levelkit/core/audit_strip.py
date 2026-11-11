# Audit strips: every section from start to finish, camera steps of 336 px, the lower part of the frame (y 96..216).
# Usage: U=2 python3 tools/levelkit/lk.py <mission> strip l1a [<outdir>]   (default outdir: work/<mission>/strips)
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from level import *
from lkpath import load_module, work_dir

mod = load_module(sys.argv[1])
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(work_dir(), 'strips')
os.makedirs(out, exist_ok=True)
sec = mod.build()
run, idle = hero_frames()
Y0 = 96
frames = []
cx = 0
while True:
    c = min(cx, sec.cam)
    fr = compose_level(sec, c, 0, run[0])
    a = fr.a[Y0 * U:, :, :3].copy()
    im = Image.fromarray(a)
    ImageDraw.Draw(im).text((4, 2), '%s cam %d (x %d..%d)' % (sec.id, c, c, c + 384), fill=(255, 255, 0))
    frames.append(im)
    if cx >= sec.cam:
        break
    cx += 336
per = 4
for i in range(0, len(frames), per):
    grp = frames[i:i + per]
    W, H = grp[0].size
    sh = Image.new('RGB', (W, H * len(grp) + 4 * (len(grp) - 1)), (255, 0, 255))
    for j, f in enumerate(grp):
        sh.paste(f, (0, j * (H + 4)))
    sh.save(os.path.join(out, 'audit-%s-%02d.png' % (sec.id, i // per)))
print(sec.id, len(frames), 'frames')
