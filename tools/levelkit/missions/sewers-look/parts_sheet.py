# Each sewer part alone on a plain ground (daylight colours, no grade), for the look check at tier 1 and tier 4:
#   U=1 python3 tools/levelkit/lk.py sewers-look run parts_sheet ; U=4 ...   -> tmp/sewers/look/parts-u<U>.png
import os
import random
from level import *
from lkpath import repo_path
from parts_sewers import *

L = Layer(384, 216)
L.rect(0, 0, 384, 216, (92, 96, 100))
info = dict(eyes=[], carriers=[], pours=[], mshafts=[], grates_far=[], tunnels=[], bays=[], signs=[])
B = SR['sbrick']
W = Layer(BAY * 3, 140)
brickfill(W, 0, YSPRING, BAY * 3, YWALL - YSPRING, B, 3, streaks=True)
recess(W, 0, 'plain', 5, B, SR['sbrick_b'])
pipe_mouth(W, 35, 106, 4.2, B, 2, info=info)
outfall(W, 28, 122, 3.4, 4, info)
recess(W, BAY, 'manhole', 7, B, SR['sbrick_b'])
manhole(W, BAY + 29, B, 8, info)
sign_exit(W, BAY + 37, 98)
recess(W, 2 * BAY, 'mouth', 9, B, SR['sbrick_b'])
tunnel_mouth(W, 2 * BAY + 35, B, 10, info)
cornice(W, 0, BAY * 3, 11, SR['granite'])
far_walkway(W, 0, BAY * 3, 12)
L.blit(W, 4, -60)
L.blit(fatberg(120, 120, seed=7, kind='front', eye=[(255, 236, 140), (255, 64, 40), (150, 18, 28)])[0], 200, 0)
L.blit(bike_sunk(random.Random(2)), 330, 20)
rng = random.Random(3)
for i, p in enumerate((fg_bucket(rng), fg_hose(rng), fg_pallet(rng))):
    L.blit(p, 200 + i * 60, 150)
L.blit(fatberg(80, 60, seed=3, kind='mid')[0], 4, 150)
far_lights(W, info, __import__('mission').HOURS['v1'])
L2 = Layer(384, 216); L2.a = L.a.copy()
L2.blit(W, 4, 20)
out = repo_path('tmp/sewers/look/parts-u%d.png' % U)
os.makedirs(os.path.dirname(out), exist_ok=True)
save(L2, out)
print(out)
