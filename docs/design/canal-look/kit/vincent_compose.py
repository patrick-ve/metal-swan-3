# Joins the legs and torso pieces of the existing Vincent set into full-body frames (run 12, idle 4).
import sys, os, json
sys.dont_write_bytecode = True
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))   # the repository root
sys.path.insert(0, os.path.join(ROOT, "tools", "art40"))
import art40 as X
from PIL import Image
s = X.build("vincent"); baked, render = X.normalize(s)
pal = {k: tuple(int(v[i:i+2], 16) for i in (1, 3, 5)) for k, v in render["pal"].items()}
CW, CH, AX, AY = 48, 48, 18, 46          # cell and feet anchor
def put(im, f, x0, y0):
    for y, r in enumerate(f["rows"]):
        for x, c in enumerate(r):
            if c != ".":
                im.putpixel((x0 - f["ox"] + x, y0 - f["oy"] + y), pal[c] + (255,))
def strip(legs, torso, n, out):
    L = render["strips"][legs]; T = render["strips"][torso]
    sh = Image.new("RGBA", (CW * n, CH), (0, 0, 0, 0))
    for i in range(n):
        lf = L[i % len(L)]; tf = T[i % len(T)]
        hx, hy = lf["pts"]["hip"]
        hx -= 0; 
        # render pts are in rows coordinates; make them relative to the anchor
        bx = baked["strips"][legs]["frames"][i % len(L)]["pts"]["hip"]
        put(sh, lf, i * CW + AX, AY)
        put(sh, tf, i * CW + AX + bx[0], AY + bx[1])
    sh.save(out)
strip("legs-run", "torso-pistol-run", 12, "vin/run.png")
strip("legs-idle", "torso-pistol-idle", 4, "vin/idle.png")
json.dump({"cw": CW, "ch": CH, "ax": AX, "ay": AY, "run": {"n": 12, "ticks": 3}, "idle": {"n": 4, "ticks": 9}}, open("vin/meta.json", "w"))
a = Image.open("vin/run.png"); b = Image.open("vin/idle.png")
bg = Image.new("RGBA", (CW * 12, CH * 2), (150, 190, 215, 255)); bg.alpha_composite(a, (0, 0)); bg.alpha_composite(b, (0, CH))
bg.resize((CW * 12 * 3, CH * 2 * 3), Image.NEAREST).save("vin/preview.png")
