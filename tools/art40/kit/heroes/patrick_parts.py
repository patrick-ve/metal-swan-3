# PATRICK's hand-drawn parts at 1x (facing right, light from the upper front, no outline).
import math


def _edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            out[y][x + i] = ch
    return [''.join(r) for r in out]


def _check(name, rows):
    w = len(rows[0])
    for r in rows:
        assert len(r) == w, (name, rows)


# ---------------------------------------------------------------- heads (14 x 13, neck at (5, 12))
# slick swept-back black top with volume, short dark sides, straight dark brows, a thin mustache,
# light chin stubble, a strong square jaw, a calm closed-mouth smile
_HEAD = [
  ".....qqjjjjq..",
  "...qqjjJJAAJjq",
  "..qjjjJJAAjjjq",
  ".qjjjJAAjjjjjq",
  "qjjjAAjjjjqSL.",
  "qqjjjjjqqsSLL.",
  "QqqqqqsSSQQQL.",
  ".QqqszsSSwQSS.",
  ".QqqszsSSSSSSL",
  "..QqzssSSSSSsS",
  "..zzssSSSSzSbb",
  "...zsSSSSSSzzS",
  "...zbsSSSbbbb.",
  "....zzbbbbbb..",
]
# rows: 6 brows (cols 9-11), 7 eye (9-10), 8 nose tip (13), 10 thin mustache, 11 mouth, 12-13 chin

HN = {'neck': (5, 13)}

HEADS = {}


def build_heads():
    H = HEADS
    F = _HEAD
    H['fwd'] = (F, HN)
    H['blink'] = (_edit(F, [(7, 9, 'zz')]), HN)
    H['shout'] = (_edit(F, [(6, 9, 'QQQ'), (10, 10, 'zbbS'), (11, 10, 'Bwww'), (12, 9, 'bBQQ'), (13, 6, 'bbbbbb')]), HN)
    H['hurt'] = (_edit(F, [(5, 10, 'QS'), (6, 9, 'QQs'), (7, 9, 'zzS'), (10, 11, 'bBB'), (11, 10, 'zwwB'), (12, 9, 'bbBb')]), HN)
    H['up'] = ([
      ".....qqjjjjq..",
      "...qqjjJJAAJjq",
      "..qjjjJJAAjjjq",
      ".qjjjJAAjjjqSL",
      "qjjjAAjjjqSLLL",
      "qqjjjjqsSQQQSL",
      "QqqqqqszSwQSSL",
      ".QqqszsSSSSSSL",
      ".QqqszsSSSSSSL",
      "..QqzssSSSSSbb",
      "..zzssSSSSSzBB",
      "...zsSSSSbbbbb",
      "...zzsssbbbz..",
      "....zsszz.....",
    ], HN)
    H['down'] = ([
      ".....qqjjjjq..",
      "...qqjjJJAAJj.",
      "..qjjjJJAAjjjq",
      ".qjjjJAAjjjjjq",
      "qjjjAAjjjjjjjq",
      "qqjjjjjjjjqSL.",
      "QqqqqjjqsSSLL.",
      ".QqqqqsSSQQQS.",
      ".QqqszsSSwQSS.",
      ".QqqszsSSSSSSL",
      "..QqzssSSSSSs.",
      "..zzssSSSSbB..",
      "...zsSSSSzBs..",
      "....zzbbbbb...",
    ], HN)
    # fidget faces
    H['bite'] = (_edit(F, [(10, 11, 'bBB'), (11, 10, 'zQQQ'), (12, 10, 'wwQ.'), (13, 6, 'bbbbb.')]), HN)
    H['chew'] = (_edit(F, [(9, 10, 'L'), (11, 10, 'zBBS'), (12, 9, 'sbbb')]), HN)
    H['chew2'] = (_edit(F, [(9, 10, 'L'), (10, 12, 'bb'), (11, 10, 'SzBs'), (12, 9, 'bbbb'), (13, 6, 'bbbbbb.')]), HN)
    H['happy'] = (_edit(F, [(7, 9, 'zz'), (9, 10, 'L'), (11, 10, 'zwwB')]), HN)
    for k, (r, _) in H.items():
        _check('head ' + k, r)


# ---------------------------------------------------------------- torso (12 x 11)
# black zip jacket, a raised collar round the white t-shirt neckline, a metal zip, a blue lanyard
# down to a white badge on the chest
_TORSO = [
  ".qjJJJJJTTT.",
  "qjjjJJJJRTTJ",
  "qjjjjJJJJRgJ",
  "qjjjjJJJJRgJ",
  "qjjqjjJJJJRg",
  "qjjqjjjJJJRg",
  "qjjjqjjjJTTg",
  "qjjjqjjjjTRg",
  "qqjjjqjjjttq",
  "Qqjjjjqjjjgq",
  ".QqqqqqqqqQ.",
]
_TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

# ---------------------------------------------------------------- sneakers: dark uppers, white soles
SHOES = {
 'flat': ([
  "xxxx....",
  "xxxXXx..",
  "xxxxxXXx",
  "tTTTTTTT",
 ], {'ankle': (2, 0)}),
 'toe': ([
  "xxx....",
  "xxxX...",
  "xxxxXx.",
  ".txxxXx",
  "..tTTTT",
 ], {'ankle': (1, 0)}),
 'hang': ([
  "xxx..",
  "xxxX.",
  "xxxXx",
  ".xxxX",
  "..tTT",
 ], {'ankle': (1, 0)}),
 'heel': ([
  "......XT",
  "xxxx.XXT",
  "xxxxXXxT",
  "tTTTTT..",
 ], {'ankle': (2, 1)}),
 'back': ([
  ".xxx",
  "xxXx",
  "xxXx",
  "xxxT",
  "xxT.",
  "tT..",
 ], {'ankle': (2, 0)}),
 'lie': ([
  "x...",
  "xX..",
  "xXx.",
  "xxXT",
  "txxT",
  "tTT.",
 ], {'ankle': (2, 4)}),
}

# ---------------------------------------------------------------- the keyboard (melee) and frikandel
# a light-grey keyboard, about 11 px long: a row of dark key pixels on top, a dark side face, one
# blue key (the lanyard colour) so it reads as a gadget and not a plank. Wrist at the near end.
KB = {
 'kb': ([            # held flat, pointing forward
  "...GGGGGGGGGGg",
  ".SSGnGnGnGnRnN",
  "SSSGGnGnGnGnGN",
  ".ssgNNNNNNNNNN",
 ], {'wrist': (0, 2), 'tip': (14, 1.5)}),
 'kbup': ([          # raised, pointing up
  ".gGGg",
  ".GnGN",
  ".GGnN",
  ".GnGN",
  ".GGnN",
  ".GRGN",
  ".GGnN",
  ".GnGN",
  ".GGnN",
  ".SSSN",
  "SSSs.",
  ".ss..",
 ], {'wrist': (1.5, 11), 'tip': (2.5, -1)}),
 'kbdiag': ([        # swinging forward and up (45 degrees)
  "........gGG.",
  ".......GnGGN",
  "......GGGnN.",
  ".....GnGGN..",
  "....GGGRN...",
  "...GnGGN....",
  "..GGGnN.....",
  ".SSnGGN.....",
  "SSSsN.......",
  ".ss.........",
 ], {'wrist': (0.5, 8.5), 'tip': (11, -1)}),
 'kbdown': ([        # smashed down and forward (45 degrees down)
  ".ss.........",
  "SSSsN.......",
  ".SSGGN......",
  "..NGGnG.....",
  "...NnGGG....",
  "....NGGnG...",
  ".....NnGGG..",
  "......NGGRG.",
  ".......NnGGg",
  "........NNg.",
 ], {'wrist': (0.5, 1), 'tip': (11, 9)}),
}
KB['kbback'] = ([r[::-1] for r in KB['kbdiag'][0]], {'wrist': (10.5, 8.5), 'tip': (0, -1)})

FRIK = {
 'frik': ([          # the whole frikandel, held up (light top edge, dark underside)
  ".......sC",
  "......sCE",
  ".....sCCE",
  "....sCCE.",
  "...sCCE..",
  "..sCCE...",
  ".SSCE....",
  "SSSsE....",
  "JJs......",
 ], {'wrist': (0.5, 7.5)}),
 'frikbit': ([       # after the bite: shorter, the bitten end shows the lighter inside
  ".....ss",
  "....sCE",
  "...sCCE",
  "..sCCE.",
  ".SSCE..",
  "SSSsE..",
  "JJs....",
 ], {'wrist': (0.5, 5.5)}),
 'frikbit2': ([      # after the second bite: a stub
  "...ss",
  "..sCE",
  ".SSCE",
  "SSSs.",
  "JJs..",
 ], {'wrist': (0.5, 3.5)}),
 'frikflat': ([      # held flat at the mouth for the bite
  "...sssssss",
  "JSSCCCCCCC",
  "JSSEEEEEE.",
  ".ss.......",
 ], {'wrist': (0, 1.5)}),
}


def _cuff(rows):
    """VINCENT's hands have a white shirt cuff ('T' 't'); PATRICK's are black jacket cuffs."""
    return [r.replace('T', 'J').replace('t', 'j') for r in rows]


FXK = {
 # keycaps flying off the board at the smash: 2 x 2 light caps with a dark key face, one blue
 'caps0': ([
  "....WG.......",
  "....gn.....WG",
  "...........gn",
  "WG...........",
  "gn....WR.....",
  "......gr.....",
 ], (6, 5)),
 'caps1': ([
  ".......WG.......",
  ".......gn.......",
  "..............WG",
  "WG............gn",
  "gn..............",
  "...........WR...",
  "...........gr...",
 ], (8, 6)),
 'caps2': ([
  ".........G.......",
  "G.........n.....G",
  "n...............n",
  ".................",
  "..............R..",
 ], (8, 4)),
 'bonk': ([
  "...W...",
  ".W.I.W.",
  "..IWI..",
  "WIWWWIW",
  "..IWI..",
  ".W.I.W.",
  "...W...",
 ], (3, 3)),
}


def install(P):
    build_heads()
    P.HEADS.update(HEADS)
    P.TORSOS['up'] = (_TORSO, _TAN)
    P.TORSOS['lean'] = P.shear(P.TORSOS['up'], 2)
    P.TORSOS['lean2'] = P.shear(P.TORSOS['up'], 3)
    P.TORSOS['back'] = P.shear(P.TORSOS['up'], -2)
    P.SHOES.update(SHOES)
    for lib in (P.GUNS, P.FISTS, P.HANDS):
        for k, (rows, an) in list(lib.items()):
            lib[k] = (_cuff(rows), an)
    P.HANDS.update(KB)
    P.HANDS.update(FRIK)
    P.FX.update(FXK)
    # keyboard swing trails: centred on the far shoulder, just outside the keyboard's far end
    P.FX['kslash1'] = P.arc(0, 0, 26, 27, -112, -38, 2.2)
    P.FX['kslash2'] = P.arc(0, 0, 26.5, 26.5, -50, 26, 2.6)
    P.FX['kslash3'] = P.arc(0, 0, 26, 26, -5, 30, 1.6)
    for k, (r, _) in list(KB.items()) + list(FRIK.items()) + list(P.TORSOS.items()) + list(SHOES.items()):
        _check(k, r)
