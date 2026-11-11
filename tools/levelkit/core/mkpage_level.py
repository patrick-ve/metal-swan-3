# Writes the page of a mission's sections: work/<mission>/site/page.html (the body, as the artifact host wants it) and
# work/<mission>/site/index.html (a full page to look at on this computer: serve site/ on 127.0.0.1). The layer tiles
# and tables are in site/l1/ (export_level.py, pack_level.py). The sections, labels and title: mission.py PAGE.
# Usage: python3 tools/levelkit/lk.py <mission> page
import json, os, shutil
import mission as _M
from lkpath import CORE, work_dir
from level import LAY

SITE = os.path.join(work_dir(), 'site')
PAGE = getattr(_M, 'PAGE', {})
SECS = PAGE.get('sections') or [(k, k, '') for k in LAY if k != 'sprites']
have = [s for s in SECS if os.path.exists(os.path.join(SITE, 'l1', 'meta-%s-u1.json' % s[0]))]
pack = dict(sections=[dict(id=i, label=n, hour=h, width=LAY[i]['width']) for (i, n, h) in have],
            hero=dict(ax=18, ay=46, runN=12, idleN=4))
shutil.copy(os.path.join(CORE, 'vin', 'run.png'), os.path.join(SITE, 'l1', 'vin-run.png'))
shutil.copy(os.path.join(CORE, 'vin', 'idle.png'), os.path.join(SITE, 'l1', 'vin-idle.png'))
js = json.dumps(pack, separators=(',', ':'))
page = open(os.path.join(CORE, 'level.tpl.html')).read().replace('/*PACK*/', js)
if PAGE.get('title'):
    page = page.replace('Level 1 Repainted', PAGE['title'])
if PAGE.get('header') is not None:            # the HTML inside <header> (level 1's own text otherwise)
    a, b = page.index('<header>') + len('<header>'), page.index('</header>')
    page = page[:a] + '\n' + PAGE['header'] + '\n' + page[b:]
if PAGE.get('route') is not None:             # the line under the strip (level 1's route otherwise)
    a = page.index('<span class="route">') + len('<span class="route">')
    page = page[:a] + PAGE['route'] + page[page.index('</span>', a):]
open(os.path.join(SITE, 'page.html'), 'w').write(page)
open(os.path.join(SITE, 'index.html'), 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + page + '</body></html>')
print('sections', [s[0] for s in have], 'page bytes', len(page), '->', SITE)
