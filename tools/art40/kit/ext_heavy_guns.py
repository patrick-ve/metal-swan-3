# The heavy machine gun at 1x, held in the near hand (VINCENT's hand letters T S s; ext_heavy maps them
# to each hero's own hand colours). An original design: a short stock, a boxy receiver with a carry
# handle, a box magazine, a fore-grip and a cooling shroud with slots, a muzzle brake. Gun ramp G g n N.
# Anchors: 'wrist' (the near hand's cuff), 'grip' (where the far hand's wrist goes, under the fore-grip),
# 'muzzle' (first pixel past the brake), 'eject' (the shell port on top of the receiver).
# The forward, 22.5 up, 45 up and low (hip, one hand) guns are drawn by hand (pixel-art angles 2:1 and
# 1:1); up and down are exact 90-degree turns of the forward gun, 67.5 up is the low gun turned 90
# degrees, 45 down is the 45-up gun turned 90 degrees (exact turns lose no pixels).

H_FWD = ([
  "...gGGg...........",
  "...N..N...........",
  "nGGGGGGGGGGGGGGGgG",
  "ngggggggNgNgNgNggn",
  "NnnnnnnnNnNnNnNnnN",
  ".NNNNNNN.nn.....NN",
  ".TSSgnn..nn.......",
  ".Tssgnn..NN.......",
  "....gnn...........",
  "....NNN...........",
], {'wrist': (1, 6.5), 'grip': (9.5, 8), 'muzzle': (18, 3.5), 'eject': (7.5, 1.5)})

H_U22 = ([
  "..............GG.",
  "............GGggN",
  "..........GGgNgnN",
  "...GG...GGgNgNnn.",
  "..G..NGGgNgNnn...",
  ".N..GGggNgnn.....",
  ".GGGggggnnn......",
  "GggnnnnnnnnN.....",
  "NnnnnnNnn.nN.....",
  "NnnnSSnnN........",
  ".NTSSsgnN........",
  "..TTs.NN.........",
], {'wrist': (2, 10.5), 'grip': (8.5, 8.5), 'muzzle': (17, 0.5), 'eject': (6, 4)})

H_U45 = ([
  "...........GG..",
  "..........GggN.",
  "..........GgnN.",
  ".........GNgn..",
  "........GgNn...",
  ".......GNgn....",
  "...G..GgNnnN...",
  "..G.NGgnnnN....",
  ".G.GGggnnNN....",
  ".NGggnnNnnN....",
  ".GggnnnnnN.....",
  "GggnnnnNN......",
  "NgnnnSSn.......",
  ".NnTSSs........",
  "...TTs.........",
], {'wrist': (3.5, 14), 'grip': (9, 8.5), 'muzzle': (13.5, -0.5), 'eject': (6, 7)})

H_LOW = ([
  "...GGG...........",
  "..N..GG..........",
  "NgGGGgnG.........",
  "NgggggGGG........",
  "TnngggggGG.......",
  "TSSnngggNgGG.....",
  "sSSgNnnnNgNgGG...",
  ".ssgnnN.nnNgNgGG.",
  "...gnn..nn..nnggG",
  "...Nnn..NN....nng",
  "....N.........NN.",
], {'wrist': (0, 4.5), 'grip': (7.5, 8.5), 'muzzle': (17, 9), 'eject': (5, 1.5)})


def ccw(part):
    """Exact 90-degree turn, counter-clockwise on screen (forward -> up)."""
    rows, an = part
    w = max(len(r) for r in rows)
    rr = [r.ljust(w, '.') for r in rows]
    out = [''.join(r[x] for r in rr) for x in range(w)][::-1]
    return out, {k: (y, w - 1 - x) for k, (x, y) in an.items()}


def cw(part):
    """Exact 90-degree turn, clockwise on screen (forward -> down)."""
    rows, an = part
    w = max(len(r) for r in rows)
    h = len(rows)
    rr = [r.ljust(w, '.') for r in rows]
    out = [''.join(r[x] for r in rr)[::-1] for x in range(w)]
    return out, {k: (h - 1 - y, x) for k, (x, y) in an.items()}


GUNS = {
  'h_fwd': H_FWD,
  'h_u22': H_U22,
  'h_u45': H_U45,
  'h_u67': ccw(H_LOW),
  'h_up': ccw(H_FWD),
  'h_d45': cw(H_U45),
  'h_down': cw(H_FWD),
  'h_low': H_LOW,
}
