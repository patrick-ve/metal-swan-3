# Joins the layer tables of the three tiers and the images into one page file.
import base64, json
def b64(p): return base64.b64encode(open(p, 'rb').read()).decode()
tiers = {}
for u in (1, 2, 4):
    m = json.load(open(f'site/meta-u{u}.json'))
    for sc in m['scenes']:
        for ly in sc['layers']:
            if 'v' in ly:
                ly['v']['imgs'] = {k: b64('site/' + p) for k, p in ly['v']['imgs'].items()}
            else:
                ly['src'] = b64('site/' + ly['src'])
    tiers[str(u)] = dict(scenes=m['scenes'])
m1 = json.load(open('site/meta-u1.json'))
pack = dict(view=m1['view'], cam=m1['cam'], tiers=tiers,
            names=[dict(key=s['key'], name=s['name'], hour=s['hour'], walk=s['walk'], shadow=s['shadow']) for s in m1['scenes']],
            hero=dict(run=b64('vin/run.png'), idle=b64('vin/idle.png'), ax=18, ay=46, runN=12, idleN=4))
js = json.dumps(pack, separators=(',', ':'))
assert '</script' not in js
t = open('page.tpl.html').read()
page = t.replace('/*PACK*/', js)
open('four-canals.html', 'w').write(page)                 # the body of the page, as the artifact host wants it
# a full page to look at on this computer: serve out/ on 127.0.0.1 and open index.html
open('out/index.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + page)
open('out/page.js', 'w').write(t.split('<script>')[1].split('</script>')[0])
print('page bytes', len(t) + len(js))
