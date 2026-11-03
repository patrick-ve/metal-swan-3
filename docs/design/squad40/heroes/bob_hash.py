# dev helper: a hash per animation key of every composed frame (back, upper, lower, full), to see
# which keys a change touches.   HERO=bob python3 -m heroes.bob_hash out/bob/hash_a.json
import sys, json, hashlib
import hero
import anims as A
from pose import compose

out = {}
for tab, layers in ((A.UPPER, ('back', 'upper')), (A.LOWER, ('lower',)), (A.FULL, ('full',))):
    for k, seq in tab.items():
        h = hashlib.md5()
        for p, t in seq:
            for L in layers:
                q = dict(p)
                if L in ('back', 'upper'):
                    q.setdefault('pelvis', (0, -17))
                rows = compose(q, L)[0]
                h.update(('\n'.join(rows or []) + '|%s' % t).encode())
        out[k] = h.hexdigest()[:10]
json.dump(out, open(sys.argv[1], 'w'), indent=0, sort_keys=True)
print(len(out))
