# Builds the review page cast-40px.html from out/*.json (the samples), old/out/ (the game's current
# frames, optional) and cast_notes.json (texts, optional).
#   python3 castpage.py
import base64, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
OLD = os.path.join(HERE, 'old', 'out')
ORDER_ROLE = ['hero', 'enemy', 'boss', 'npc', 'ally', 'animal']


def b64(path):
    with open(path, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


def main():
    samples = []
    for f in sorted(os.listdir(OUT)):
        if f.endswith('.json') and not f.startswith('_'):
            try:
                d = json.load(open(os.path.join(OUT, f)))
            except ValueError:
                print('skipped (being written?):', f)
                continue
            if 'rows' in d:
                samples.append(d)
    old = {}
    idx = os.path.join(OLD, 'index.json')
    if os.path.isfile(idx):
        for k, v in json.load(open(idx)).items():
            o = dict(v)
            for tag in ('1x', 'hd'):
                p = os.path.join(OLD, f'{k}@{tag}.png')
                if os.path.isfile(p):
                    o['png' + tag] = b64(p)
            old[k] = o
    notes = {}
    np_ = os.path.join(HERE, 'cast_notes.json')
    if os.path.isfile(np_):
        notes = json.load(open(np_))
    order = notes.get('order', [])
    for k in notes.get('old_skip', []):          # a current frame that would mislead (one part of a multi-part boss)
        old.pop(k, None)

    def key(d):
        r = ORDER_ROLE.index(d['role']) if d['role'] in ORDER_ROLE else 9
        o = order.index(d['id']) if d['id'] in order else 999
        return (0 if d['id'] == 'vincent' else 1, o, r, d['name'])
    samples.sort(key=key)
    keep = ('id', 'name', 'mission', 'role', 'kind', 'face', 'pose', 'note', 'air', 'w', 'h', 'ax', 'ay', 'colours', 'rows', 'pal', 'group')
    data = dict(samples=[{k: d[k] for k in keep if k in d} for d in samples], old=old, notes=notes)
    tpl = open(os.path.join(HERE, 'cast.tpl.html')).read()
    js = open(os.path.join(HERE, 'cast.js')).read()
    html = tpl.replace('/*DATA*/', 'const DATA = ' + json.dumps(data, separators=(',', ':')) + ';').replace('/*JS*/', js)
    path = os.path.join(HERE, 'cast-40px.html')
    open(path, 'w').write(html)
    print(path, f'{len(html) / 1e6:.2f} MB', len(samples), 'samples', len(old), 'old frames')


if __name__ == '__main__':
    main()
