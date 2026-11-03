# Writes old/list.json for old/dump.ts from the samples' INFO['old'] ('<sprite id>#<frame>').
#   python3 old/mklist.py        (run from cast40/ after cast.py --all)
import json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = []
for f in sorted(os.listdir(os.path.join(HERE, 'out'))):
    if f.endswith('.json') and not f.startswith('_'):
        d = json.load(open(os.path.join(HERE, 'out', f)))
        if d.get('old'):
            sid, _, k = d['old'].partition('#')
            out.append(dict(key=d['id'], id=sid, frame=int(k) if k else 0))
json.dump(out, open(os.path.join(HERE, 'old', 'list.json'), 'w'), indent=0)
print(len(out), 'current frames listed')
