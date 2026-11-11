# The house rows of section a, measured (tmp/l1/port/HOUSE-FIT-BRIEF.md step 1): every front's left edge and painted
# width on its plane and the overlap with the next front of its row, at this tier's real pixels.
# Usage: U=1 python3 tools/levelkit/lk.py ams run fronts_l1a
from level import *
import l1a

sec = l1a.build()
slots = sec.notes['fronts']
print('the street fronts, plane of depth 14 (s = %.4f), U = %d: row, front, left, width, overlap with the next (px)' % (s_d(14), U))
for i, (r, look, left, w) in enumerate(slots):
    nx = slots[i + 1] if i + 1 < len(slots) and slots[i + 1][0] == r else None
    ov = '' if nx is None else '%g' % ((P(left) + w * U - P(nx[2])) / U)
    print('  %d  %-10s %9.2f %4d  %s' % (r + 1, look, P(left) / U, w, ov or 'row end'))
infos = sec.notes['scale']['far']['infos']
ovs = [(a['x'] + a['w'] - b['x']) for a, b in zip(infos, infos[1:])]
print('the far bank row, plane 0.5: %d fronts %d..%d, widths %d-%d, overlap max %g min %g' % (
    len(infos), infos[0]['x'], infos[-1]['x'] + infos[-1]['w'], min(i['w'] for i in infos), max(i['w'] for i in infos),
    max(ovs), min(ovs)))
print('anchors (margin to the slot edges, px):')
for a in l1a.anchor_fit(slots):
    print('  %-18s %s' % (a[0], 'in %s (%.2f / %.2f)' % a[1:] if a[1] is not None else 'NOT IN ONE FRONT'))
for (name, ok, v) in l1a.checks(sec)[-2:]:
    print('%s  %s  %s' % ('PASS' if ok else 'FAIL', name, v))
