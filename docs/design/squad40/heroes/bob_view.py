# dev helper: BOB's heads and torso at zoom (python3 -m heroes.bob_view [names])
import os, sys
os.environ['HERO'] = 'bob'
import hero
import parts as P
from pose import to_png
from rig import Canvas
names = sys.argv[1].split(',') if len(sys.argv) > 1 else \
    ['fwd', 'blink', 'shout', 'hurt', 'up', 'down', 'read2', 'proud', 'grin',
     'happy', 'panic', 'yawn', 'sleep', 'bored', 'soot', 'sootblink']
fr = []
for n in names:
    rows = P.HEADS[n][0]
    cv = Canvas(max(len(r) for r in rows) + 4, len(rows) + 4)
    cv.grid(2, 2, rows, 1, 'h')
    fr.append(cv.finish())
w = max(len(f[0]) for f in fr); h = max(len(f) for f in fr)
fr = [[r.ljust(w, '.') for r in f] + ['.' * w] * (h - len(f)) for f in fr]
to_png(fr, 'out/bob/heads.png', scale=12, cols=8)
