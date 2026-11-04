# A rig canvas with the Swan's own selout table (the kit Canvas reads the hero table rig.DARK).
import rig
from . import palette as SP


class SCanvas(rig.Canvas):
    def finish(s, outline=True):
        """rig.Canvas.finish with the Swan's DARK: clean-up, selout, the one outline K."""
        s.clean()
        c = s.c
        out = [r[:] for r in c]
        dark = SP.DARK
        for y in range(s.H):
            for x in range(s.W):
                ch = c[y][x]
                if ch == '.' or ch not in dark or s.p[y][x] == 'fx':
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < s.W and 0 <= Y < s.H and c[Y][X] != '.' and s.p[Y][X] != 'fx' \
                            and s.p[Y][X].split(':')[0] != s.p[y][x].split(':')[0] and s.z[Y][X] > s.z[y][x] + 0.4:
                        out[y][x] = dark[ch]
                        break
        if outline:
            for y in range(s.H):
                for x in range(s.W):
                    if c[y][x] == '.':
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            X, Y = x + dx, y + dy
                            if 0 <= X < s.W and 0 <= Y < s.H and c[Y][X] != '.' and s.p[Y][X] != 'fx':
                                out[y][x] = 'K'
                                break
        return [''.join(r) for r in out]
