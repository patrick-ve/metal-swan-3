# The house fit of section b (tmp/l1/port/HOUSE-FIT-BRIEF.md, step 1): every house row of the section on every plane,
# each front's left edge and painted width on its plane and the overlap with the next front (> 0: the next front is
# drawn over this one; < 0: a gap). The numbers come from the painters (PAINTED), so they are the ones painted.
# Usage: python3 tools/levelkit/lk.py ams run fit_l1b [-v]   (-v: every front of the far rows too)
import sys
import l1b
from parts_l1b import PAINTED

sec = l1b.build()
names = {p0: x for (x, p0, w, wv) in PAINTED['fronts']}
worst = 0
for (name, r) in l1b.front_rows():
    ov = [a[0] + a[1] - b[0] for (a, b) in zip(r, r[1:])]
    print('%s: %d fronts, %g .. %g, overlap max %+g min %+g' % (name, len(r), r[0][0], r[-1][0] + r[-1][1], max(ov), min(ov)))
    worst = max([worst] + ov)
    if not name.startswith('street') and '-v' not in sys.argv:
        continue
    for j, (p0, w) in enumerate(r):
        nxt = r[j + 1][0] if j + 1 < len(r) else None
        o = p0 + w - nxt if nxt is not None else None
        worst = max(worst, o or 0)
        tag = ('  box x %d' % names[p0]) if name.startswith('street') else ''
        print('  left %7.2f  width %3d  overlap %s%s' % (p0, w, '%+g' % o if o is not None else 'row end', tag))
for (lbl, ok, v) in l1b.front_checks(sec):
    print('%s %s: %s' % ('PASS' if ok else 'FAIL', lbl, v))
print('max overlap %g px' % worst)
