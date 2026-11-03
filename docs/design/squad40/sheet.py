# Contact sheets per page group (core + extension sets), composed like the page (comp.py).
#   HERO=x python3 sheet.py [title-substring] [scale] [--cat Heavy]   -> out/<hero>/g_<title>.png
#   EXT_ONLY=heavy python3 sheet.py heavy 6    (only one extension module; fast, isolated)
import re, sys
import hero
import build
from comp import step_rows, union_crop
from pose import to_png

args = [a for a in sys.argv[1:] if not a.startswith('--')]
cat = sys.argv[sys.argv.index('--cat') + 1] if '--cat' in sys.argv else ''
if cat in args:
    args.remove(cat)
nums = [a for a in args if a.isdigit()]          # a bare number is the scale, any other word the title filter
words = [a for a in args if not a.isdigit()]
sel = words[0] if words else ''
scale = int(nums[0]) if nums else 5
for g in build.groups():
    title = g['title']
    if sel and sel.lower() not in title.lower():
        continue
    if cat and cat.lower() not in g.get('cat', '').lower():
        continue
    frames = union_crop([step_rows(s) for s in g['steps']])
    name = re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')
    to_png(frames, f'{hero.outdir()}/g_{name}.png', scale=scale, cols=min(len(frames), 8))
    print(g.get('cat', ''), '|', name, len(frames))
