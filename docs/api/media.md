# Media API — pixel art, palette, sprites, fonts, rendering, audio

Owner: media-core agent. Source files: `src/engine/{color,pixel,ascii,palette,sprites,font,render,render-common,render-soft,render-canvas.browser,display.browser,synth,music,audio,audio.browser,voice.browser}.ts`, `tools/sprites.ts`, `tools/lib/*`.
Everything except `*.browser.ts` is pure TypeScript (no DOM), deterministic, and runs in node.

Quick look at the toolkit: `npm run sprites -- demo --marks` → `tmp/sprites/demo.png`;
`npm run sprites -- --palette` → `tmp/sprites/palette.png`.

---

## 1. Colours — `color.ts`

`type Color = number` packed **0xRRGGBBAA** (alpha 0 = transparent).

| Export | Notes |
|---|---|
| `rgba(r,g,b,a=255)`, `hex('#rgb' \| '#rrggbb' \| '#rrggbbaa')` | build colours |
| `chR/chG/chB/chA(c)`, `withAlpha(c,a)`, `toCss(c)`, `toHex(c)`, `luma(c)` | channels & formatting |
| `lerpColor(a,b,t)` | channel-wise blend |
| `blendOver(dst,src,alpha=1)`, `blendAdd(dst,src,alpha=1)`, `div255(x)` | compositing maths (what the renderers use) |
| `TRANSPARENT`, `WHITE`, `BLACK`, `MAGENTA` (placeholder only) | constants |

## 2. Palette — `palette.ts` (all art uses it)

64 colours in named ramps, **dark → light**. Look at `tmp/sprites/palette.png`.

```ts
import { PAL, INK, shade, ramp, stepShade } from '../engine/palette';
PAL.steel[2]            // a Color (index into a ramp)
shade('olive', 9)       // clamped → PAL.olive[3]
ramp('khaki')           // aliases: khaki→sand, leather/wood→brown, gunmetal/metal→steel,
                        // grey/concrete→stone, foliage→green, yellow→gold, magenta→pink, ice→snow, skin→skinA
stepShade(PAL.red[1], +1) // PAL.red[2] (moves along the colour's home ramp)
INK                     // PAL.ink[0], the standard outline colour
```

| Ramp | Use | Ramp | Use |
|---|---|---|---|
| `ink` (2) | outlines, deepest shadow | `fire` (7) | explosions: deep red → white-hot |
| `steel` (5) | gunmetal, armour, machines | `green` (5) | foliage (darkest leans teal) |
| `stone` (4) | warm grey: concrete, ruins | `teal` (4) | water, tech, ends in bright cyan |
| `olive` (4) | uniforms, tanks, crates | `sky` (4) | skies, glass |
| `sand` (4) | khaki, desert | `navy` (3) | night, deep water |
| `brown` (4) | leather, wood, earth | `purple` (3), `pink` (3) | accents, energy |
| `rust` (4) | rusty metal | `snow` (4) | snow/ice, ends in white |
| `red` (4), `orange` (4), `gold` (4) | warm colours, coins, flashes | `skinA/B/C` (4) | fair / tan / deep skin |
| `hairA/B/C` (3) | black / brown / blond hair | `ui` (4) | menu panels, selection glow |

Also: `SWATCHES` (`{name,color}[]`, 64 unique), `PALETTE` (flat), `RAMP_NAMES`, `nearest(c)`, `inPalette(c)`.

## 3. PixelBuffer toolkit — `pixel.ts`

`new PixelBuffer(w, h)`; fields `w`, `h`, `data: Uint32Array` (0xRRGGBBAA, row-major), `version`.
**Shape methods paint** (write the colour as-is; `TRANSPARENT` erases); compositing is done by
`blit` / `blendRect` / `blendPixel`. Coordinates are rounded. All drawing methods return `this`.

| Method | Notes |
|---|---|
| `get(x,y)`, `set(x,y,c)`, `inBounds`, `fill(c)`, `clear()` | |
| `rect(x,y,w,h,c)`, `strokeRect(x,y,w,h,c)` | 1-px stroke inside the box |
| `hline(x0,x1,y,c)`, `vline(x,y0,y1,c)`, `line(x0,y0,x1,y1,c)` | inclusive ends; `line` is Bresenham and direction-independent |
| `polyline(pts,c,closed?)` | |
| `thickLine(x0,y0,x1,y1,width,c)` = `capsule(...)` | round caps, analytic & clean; ends equal discs |
| `taper(x0,y0,x1,y1,w0,w1,c)` | limb whose width goes w0 → w1 (thigh → ankle) |
| `circle(cx,cy,r,c,fill=true)` | diameter 2r+1, classic pixel shapes (r=1 is a plus) |
| `ellipse(x,y,w,h,c,fill=true)` | inscribed in the box, any size incl. even; `fill=false` → clean 1-px ring |
| `roundRect(x,y,w,h,r,c,fill=true)` | corners from `circle(r)` |
| `sphere(cx,cy,r,ramp,{light,dither,ambient})` | shaded ball (bands + dithered borders) |
| `poly(pts,c)`, `tri(...)` | even-odd scanline fill, concave OK; vertices are pixel centres; edges always drawn so slivers never break |
| `blit(src,dx,dy,{flipX,flipY,map,alpha,blend:'over'\|'add'\|'copy',solid,sx,sy,sw,sh})` | `map`: `Map<Color,Color>` or fn; `solid`: silhouette colour |
| `blitFrame(frame,x,y,blitOpts,density=1)` | place a sprite Frame by its anchor (flips mirror like the renderers) — compose parts: legs + torso, hull + turret. `density` = this buffer's density (2 when composing 2× art; x, y in its pixels): a frame of the same density is copied exactly, a 1× part into a 2× buffer is doubled, a 2× part into a 1× buffer is reduced like `downsampled` |
| `downsampled(n)` | nearest reduction by an integer factor: pixel (x, y) = this (x·n, y·n), the top-left of each n × n block (what the renderers draw for a 2× frame at res 1) |
| `blendRect(x,y,w,h,c,alpha,mode)`, `blendPixel(x,y,c,alpha,mode)` | translucent overlays |
| `outline(c,{corners,inside,only})` | see margin rule below |
| `bevel(ramp,{light='tl',depth=1,base,only})` | auto-shading: lit edge lighter, far edge darker |
| `dither(x,y,w,h,c,level,{pattern:'bayer'\|'checker',only})` | level 0..1 (17 Bayer steps), pattern anchored to buffer coords |
| `gradient(x,y,w,h,ramp,{vertical=true,reverse,dither=true\|false\|0..0.5,only})` | banded ramp with dithered band borders |
| `noise(rand,{colors,density,x,y,w,h,only})` | `rand` = seeded `() => [0,1)` (`seededRand(seed)` or `rng.next.bind(rng)`) |
| `replace(from,to)`, `recolor(map)`, `silhouette(c)`, `mirror('x'\|'y')` | palette swaps, symmetric art |
| `trimBounds()`, `crop(x,y,w,h)`, `padded(n \| l,t,r,b)`, `clone()`, `scaled(n)`, `flipped(x,y)` | new buffers |
| `rotated(rad, {quality:'smooth'\|'fast', align?})` | clockwise about the centre; smooth = RotSprite-style (Scale2x×3 then nearest), quarter turns exact; output keeps the source parity so centres align (`align: 2` for 2× art: each side grows by a multiple of 4, so the size stays whole logical px and the centre stays put). Pre-render directions at generation time — renderers never rotate |
| `scale2x()`, `resized(w,h)` | EPX upscale (rounds stair-steps, no new colours); nearest-neighbour resize |
| `countOpaque()`, `toRGBA()`, `PixelBuffer.from(...)`, `PixelBuffer.fromRGBA(...)`, `touch()` | |

`only` filters: a Color (only pixels of exactly that colour), `'opaque'`, or `'empty'`.
`light`: `'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br'` or `[dx, dy]` — where the light comes FROM.

**Outline margin rule:** `outline()` draws on transparent pixels *inside* the buffer. Leave a 1-px
transparent margin around art you will outline (or call `buf.padded(1)` first); shape pixels on
the buffer edge get no outline beyond it. `{inside: true}` recolours the shape's own edge instead.

Helpers: `traceLine(x0,y0,x1,y1,plot)`, `bayer4(x,y)`, `bandIndex(...)`, `seededRand(seed)`.

### Drawing a sprite with the toolkit

```ts
import { PixelBuffer } from '../../engine/pixel';
import { PAL, INK } from '../../engine/palette';

function crate(): PixelBuffer {
  const b = new PixelBuffer(20, 20);                    // 1-px margin for the outline
  b.rect(1, 1, 18, 18, PAL.olive[2])
    .bevel(PAL.olive, { depth: 1 })                     // lit top-left, dark bottom-right
    .line(3, 3, 16, 16, PAL.olive[1]).line(16, 3, 3, 16, PAL.olive[1])
    .outline(INK);
  return b;
}
const grenade = new PixelBuffer(12, 12).sphere(5, 6, 4, PAL.olive).outline(INK);
const arm = new PixelBuffer(16, 24).taper(4, 2, 9, 20, 5, 3, PAL.skinA[2]).bevel(PAL.skinA, { light: 'l' }).outline(INK);
```

## 4. `ascii(rows, key)` — `ascii.ts`

```ts
const eye = ascii(['.##.', '#ow#', '.##.'], { '#': INK, o: PAL.sky[2], w: PAL.snow[3] });
const icon = ascii(`
  ..kk..
  .kook.
`, { k: INK, o: PAL.gold[2] });   // template string: blank edge lines + common indent removed
```
`.` and space are transparent (unless the key defines them); unknown characters → magenta + one warning.

## 5. Sprites & animation — `sprites.ts`

```ts
defineSprite(id, gen, opts?)  // gen: () => Frame | PixelBuffer | (Frame | PixelBuffer)[]
// opts: { anchor?: 'feet' | 'center' | 'top-left' | [ox, oy],   (default 'feet')
//         pts?: FramePoints | FramePoints[],                        (relative to the anchor)
//         ticksPerFrame?: number, durations?: number[], loop?: boolean, trim?: boolean,
//         hi?: gen2x,                                               (= defineHiSprite(id, gen2x))
//         hi4?: gen4x,                                              (= defineHiSprite(id, gen4x, 4))
//         hd?: (d) => frames,                  (= defineHdSprite(id, hd): one generator for d 2 and 4)
//         defer?: boolean }       (rare cosmetic strip: not in the boot preload, last in the others)
getFrames(id, density?) / getFrame(id, i, density?) / frameCount(id) / hasSprite(id) / listSprites(prefix?)
spriteAnim(id) / spriteErrors() / clearSpriteCache(id?) / placeholderFrames()
await preloadSprites(prefixes?, (done, total) => …, { batch?, timeBudgetMs?, now?, first?, last?, yieldFn?, density?, skipDeferred? })  // never rejects
//   batch: ids per slice (default 24); timeBudgetMs: generate until this much time has passed,
//   then yield (at least one id per slice); first / last: id prefixes generated first / last, in order;
//   deferred ids (SpriteOpts.defer) come after the `last` ids; skipDeferred leaves them out (the boot)
isDeferredSprite(id) / preloadOrder(ids, first, last)   // defer flag; the preload's id order
framePoint(frame, name, flipX?, flipY?, out?)
frameW(f) / frameH(f) / frameDensity(f)          // logical size and density (also in render.ts)
defineHiSprite(id, gen, d = 2) / defineHdSprite(id, (d) => frames, densities = [4, 2])   // dense art
hasHiSprite(id, d = 2) / listHiSprites(prefix?, d = 2)   // either argument order: listHiSprites(4, 'enemy/')
defineDenseAlias(id, target, densities = [4, 2])   // id's dense art IS target's (the same frames, held once)
denseTarget(id, d = 4) → the id whose dense frames id shows / listDenseAliases(d = 4) → [[alias, target], …]
setArtDensity(d) → previous / artDensity() / withArtDensity(d, fn) / setHiArt(on) → previous / hiArtOn()
toArtDensity(n) → 1 | 2 | 4 / HI_DENSITY (2) / MAX_DENSITY (4) / DENSE_DENSITIES ([4, 2])
// Art tier (UHD art, docs/ARCHITECTURE.md §3): the highest density the display draws (default 2).
artTier() → 1 | 2 | 4 / setArtTier(t) → previous
// Tier 4 in the browser: never generate 4× frames on the main thread; queue them for the art pool.
setDeferDense(on) → previous / denseDeferred() / takeDenseQueue() → ids / pendingDense()
hasFramesAt(id, d) → built at exactly d? / framesDensityAt(id, d) → the density getFrames would return, no generation
releaseDense(ids, d = 4) → bytes freed / denseBytes(d = 4)   // working set; each buffer counted once
// 2× art jobs (non-sprite 2× work such as 2× scenery, run in the same per-frame budget):
setDeferHiArt(on) → previous / hiArtDeferred() / queueArtJob(key, run) / hasArtJob(key)
cancelArtJobs(prefix) / pendingArtJobs() / runArtJobs(budgetMs, now?) → jobs run
artPreloadActive() / HI_ART_FRAME_BUDGET_MS (8)
// Sprite cache (docs/ARCHITECTURE.md §5.4): read and fill the registry without generating.
readyFrames(id, d = 1) → frames | null / generatedSprites(d = 1, prefix?) → ids
installFrames(id, d, frames) → true when the id (registered, without frames) took them
```
`sprite-pack.ts`: `await encodeSpritePack(tag, density, [[id, frames], …], yieldFn?)` → gzip bytes;
`await decodeSpritePack(bytes)` → `{ tag, density, sprites }` (throws on a broken pack, another
`SPRITE_PACK_VERSION` or byte order). `byte-store.ts`: `ByteStore { get, put, delete }`,
`MemoryByteStore`; `byte-store.browser.ts`: `idbByteStore(name)` (IndexedDB, opened on first
use; without IndexedDB an empty store). `new PixelBuffer(w, h, data?)` wraps `data` without a copy.

**Art pool** (`art-pool.ts`, worker entry `src/game/art-worker.ts`): `browserArtPool(size =
poolSize())` starts min(cores − 1, 8) module workers (at least 1). `pool.build(ids, d,
onProgress?)` → `Promise<ArtPoolReport>` sends the ids of one family (`familyOf(id)`) to the same
worker; the worker sends back raw packs (`buildRawPack(ids, d)`) as transferred ArrayBuffers (no
SharedArrayBuffer), and the main thread installs them with `installFrames`. The frames are
byte-identical to `getFrames`. A dense alias is built, sent and installed as its target, once
(`buildIds(ids, d)`). Without Worker, or after a worker fails, the pool warns once and
builds on the main thread with the budgeted preload. Node tools and tests use `nodeArtPool(n)`
(worker_threads through tsx) or `inProcessPort(createArtWorkerHandler(load))`. Also `reset()`,
`close()`, `pending`, `workers`, `packFrames` / `unpackFrames` / `installRawPack`.
- Generated lazily on first use, then cached. Unknown id or a throwing generator → magenta
  placeholder (12×12, feet anchor) and **one** `console.warn` per id.
- **Anchors.** `Frame = { buf, ox, oy, pts? }`. Drawing at (x, y) puts buffer pixel (ox, oy) on
  (x, y). `'feet'` = (floor(w/2), h): the frame stands **on** line y (lowest pixel row is y−1).
  `'center'` = (floor(w/2), floor(h/2)).
- **Flips** mirror around the anchor pixel: left = x − (w − 1 − ox). A point at +dx becomes −dx.
- **Points** (`hip`, `muzzle`, `hand`, `head`, `seat`, …) are relative to the anchor of the
  unflipped frame. Frames returned by the generator keep their own `pts`; otherwise `opts.pts`
  applies (one record for all frames, or an array cycled per frame).
- `trim: true` crops transparent margins per frame and keeps anchors/points correct (for a
  frame of density d the box widens to whole logical pixels).
- **2× art (frame density, `docs/ARCHITECTURE.md` §3; rules in `docs/ART_GUIDE.md` "2x art
  (mission ams)").** `Frame.density` d (default 1) = buffer px per logical px. A 2× frame has a
  (2w) × (2h) buffer for a logical w × h frame; `ox`, `oy`, `pts` stay logical. Outside art code
  read sizes with `frameW(f)` / `frameH(f)`, never `buf.w` / `buf.h`. `defineHiSprite(id, gen2x)`
  adds a 2× generator to an id: it returns as many frames as the 1× generator, each a
  PixelBuffer of twice the size (anchored by the sprite's `anchor` on the logical size) or a
  Frame with logical `ox` / `oy` (and `pts`, which must equal the 1× ones). The registry
  re-frames each 2× frame to the 1× frame's rectangle (pixels outside are cut, with one warning),
  copies the 1× points, and on a wrong count, an odd size, other points or an error falls back
  to the 1× frames (`spriteErrors()` lists `id@2x`). `getFrames(id)` uses the art density
  (`setArtDensity`, 1 unless a mission with `MissionDef.artDensity: 2` is drawing — the runner
  wraps `draw` and the HUD in `withArtDensity`); `getFrames(id, 2)` asks for the 2× frames
  explicitly (the 1× ones when the id has none). Generators always run at density 1: a 2×
  generator that composes 2× parts asks for them with `getFrames(part, 2)` and places them with
  `blitFrame(f, x, y, o, 2)`. `setHiArt(false)` turns 2× art off everywhere (tools, tests).
  `preloadSprites(…, { density: 2 })` generates only the 2× frames of the ids that have them
  (`preloadMissionArt` in scenes/gameplay.ts at a 2× mission's start: `MISSION_ART_BUDGET_MS`
  (8 ms) of generation per browser frame, the joined players' characters first, then the
  mission's `preloadFirst` prefixes, its `preloadLast` prefixes last (`missionArtOrder`);
  browser app only via `GameApp.preloadArt`; boot stays 1×).
- **Art jobs.** 2× work that is not a sprite id (the 2× background layers and terrain chunks
  of the section on screen) goes through a small queue: `queueArtJob(key, run)` (a key already
  queued keeps its first job), `runArtJobs(budgetMs)` runs the oldest jobs until the budget is
  spent (at least one), `cancelArtJobs(prefix)` drops some. A budgeted 2× preload
  (`preloadSprites` with `density: 2` and `timeBudgetMs`) runs queued jobs before its next id
  in the same slice budget, and `artPreloadActive()` is true while it runs. `setDeferHiArt(true)`
  (set by `preloadMissionArt`, browser only) tells the scenery to queue its 2× work instead of
  doing it on the spot; off (default, headless tools and tests) it is built when first drawn.
- **4× art and tiers (UHD art).** A density-generic generator (`defineHdSprite(id, (d) => …)`)
  is called with d 2 and d 4 and returns buffers d times the 1× logical size; per-density
  generators (`defineHiSprite(id, gen, 4)`) work too. `getFrames(id, d)` returns the highest
  density ≤ d that the id has (4 → 2 → 1, never an upscale); validation and re-framing are the
  2× rules at any d, failures labelled `id@<d>x` fall back to the next lower frames. The mission
  runner sets the art density to min(`MissionDef.artDensity`, `artTier()`). With
  `setDeferDense(true)` (main.ts at tier 4) a missing 4× frame gives the 2× frame and the id is
  queued (`takeDenseQueue()`); `installFrames(id, 4, frames)` installs the pool's result.
  `preloadSprites(…, { density: 4 })` makes each matching id at the highest density it has
  (deferred 4× ids queued, their 2× frames made). Sprite packs carry any density.
- **Dense aliases.** `defineDenseAlias(id, target)` (default at 2× and 4×) makes an id whose
  dense art is the same picture as another id's (a fatbike pair set's rider-only strips, a bike
  per skin, a second name of a pickup or shot) show the target's frames — the same objects, never
  a copy — and drops its own dense generator there (a later `defineHiSprite` / `hd` replaces the
  alias; chains collapse). The 1× frames stay the id's own. Only the target is ever built,
  installed, queued (`takeDenseQueue`), counted (`denseBytes`), released, sent by the art pool or
  saved in a pack (`readyFrames` / `generatedSprites` list own frames only); `listHiSprites` and
  `hasHiSprite` include aliases, `denseTarget(id, d)` names the target. Geometry is law: on first
  use getFrames checks that the alias has its target's 1× geometry (frame count, logical size,
  anchor, points); one that does not fit draws its next lower frames (`spriteErrors()`: `id@<d>x`).

```ts
defineSprite('enemy/grunt/shoot', () => {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(40, 40);
    // … draw body, gun recoil by i …
    return { buf: b.outline(INK), ox: 20, oy: 40, pts: { muzzle: [17 - i, -22] } };
  });
}, { ticksPerFrame: 4 });
```

`Animator` (driven by ticks):
```ts
const anim = new Animator();
anim.play('enemy/grunt/run');                  // no restart if already playing
anim.play('enemy/grunt/die', { loop: false, restart: true, ticksPerFrame: 5 });
anim.update();                                 // once per tick
anim.update(strideRate(speed, nominalSpeed));  // or a float rate (math.ts), e.g. a walk that follows the speed
r.sprite(anim.id, anim.index, x, y, { flipX: facing < 0 });
anim.done; anim.changed; anim.loops; anim.length; anim.point('muzzle', facing < 0, scratch);
```
A non-looping strip stops on the last frame; `done` turns true after that frame's duration.
`update(rate = 1)`: `tick` grows by `rate` (a float); when it reaches the frame's duration the
remainder carries to the next frame, and at most one frame advances per update (a 1-tick frame is
never skipped). Rate 1 is exactly the integer behaviour. `strideRate(speed, nominal, min = 0.5,
max = 1.6)` (`math.ts`) = `|speed| / nominal` clamped; `easeOutBack(t)` eases with a small
overshoot (follow-through). Rates are draw-side only: gameplay never reads a rate-driven index.

Motion helpers for the animation wave live in the game layer (docs/ART_GUIDE.md "Motion"):
`tween` / `inbetween` (`src/game/art/tween.ts`), `poseJoints` (`humanoid.ts`), the smoothness gate
(`tests/art/motion.ts`), and creature turns: `turnSquash(frame, widths = [0.66, 0.33])`
(`creatures/draw.ts`, squeezed frames on the same ground line and anchor column) timed by
`new Turner(facing, widths, ticksPerFrame, dist, hold)` (`creatures/common.ts`: `update(dx)` is
true on the flip tick, `frame()` is −1 when not turning, `snap(f)` cancels).

## 6. Fonts — `font.ts`

Fonts `'small'` (proportional 5×7 caps, lower case with descenders, tabular 5-px digits,
punctuation, `← ↑ → ↓ ∞ © × · ° … ♥ ★`) and `'big'` (8-px chunky arcade caps, digits,
punctuation, arrows, `× © ♥ ★`; lower case maps to caps). Line height 10 for both.

```ts
measure('SCORE 100', 'big')             // width in px of the widest line (3rd arg: scale)
measureText(s, { font, outline, shadow, scale }) // { w, h } including outline/shadow
drawText(buf, 'MISSION 1', 192, 40, { font: 'big', color: PAL.gold[2], outline: INK, shadow: PAL.red[1], align: 'center' })
```
(x, y) = top-left of the first line's cap height; `align` applies per line; `\n` breaks lines.
Layers: shadow (+1,+1; the outlined silhouette when an outline is set) → outline (8-neighbour) → fill.
Internals shared by renderers: `getFont`, `layoutText`, `textPasses`, `drawGlyph`, `glyphAtlas`.

## 7. Rendering — `render.ts`, `render-soft.ts`, `render-canvas.browser.ts`, `display.browser.ts`

`Renderer` (see `render.ts`): `begin(clear = black | null)`, `end()`, `setCamera(x,y)` (rounded),
`sprite(id,i,x,y,o)`, `frame(f,x,y,o)`, `image(buf,x,y,o)` (top-left), `rect(x,y,w,h,c,o)`,
`line(x0,y0,x1,y1,c,o)` (Bresenham), `text(s,x,y,o)` (screen space unless `screen:false`),
`parallax(buf,fx,fy,offX,offY,{repeatX=true,repeatY,alpha,density})`, `fade(c,alpha)`. (Game background
layers — `BgLayerDef` with `alpha`, `repeatY`, `driftX/Y`, `front` — are drawn with `parallax`; sizing
rules for tall sections: `docs/ART_GUIDE.md` §7.) `ParallaxOpts.density` d (default 1): the
buffer has d px per logical px; the layer covers and tiles by its logical size (buf.w / d), so
offsets, factors and drift stay logical and sub-pixel scrolling is the same; with d > res the
renderers draw `lowRes(buf, d)`. A 2× terrain chunk is drawn with `frame()` as a density-2 frame.

2× scenery registry (`src/game/art/art-registry.ts`; rules: `docs/ART_GUIDE.md` "2x backgrounds
and terrain (mission ams)", design: `docs/ARCHITECTURE.md` §3):
```ts
defineBgGenerator(id, gen, { hi?: gen2x }) / defineHiBgGenerator(id, gen2x)   // gen2x(w, h, params, seed) → (2w)×(2h)
hasHiBgGenerator(id) / listHiBgGenerators()
makeHiBgLayer(id, w, h, params, seed) → PixelBuffer | null          // null: no 2× generator, or it failed
setHiTerrainPainter(paint, supports) / hasHiTerrain(style)
makeHiTerrain(sample, style, x0, y0, w, h) → PixelBuffer | null     // (2w)×(2h), null: nothing finer here
hiSceneryErrors() → [{ id: 'bg:<id>@2x' | 'terrain@2x', error }]
// terrain-art.ts
defineHiTerrainMaterial(kind: 'ground'|'edge'|'platform'|'solid', id, (p: Px, sx, sy) => Color)
defineHiTerrainHang(platform, (x, k, seed, sx, sy) => Color)   // 2× hangers under a platform band
hasHiTerrainMaterial(kind, id) / styleHasHiTerrain(style) / paintTerrainHi
```
`SectionView(section, terrain, seed, density = 1)` (game/mission/view.ts) draws them for a view
of density 2 at res ≥ 2; `view.dispose()` drops its queued jobs.
`DrawOpts`: `flipX`, `flipY`, `flash` (white silhouette), `tint` (silhouette in any colour;
overrides `flash`), `alpha`, `screen`, `blend:'add'`, `src: {x,y,w,h}` (draw only that part of
the unflipped image, exactly where it would land in the full drawing; in LOGICAL px of the
frame, which are its buffer px at density 1, so the same slice works for 1× and 2× art),
`stream: true` (contents change most frames; never cached as a texture, see **Streamed buffers**).
`TextOpts`: `font`, `color`, `align`, `screen` (default true), `shadow`, `outline`, `alpha`,
`scale` (integer; like drawing at 1× and enlarging). Constants `VIEW_W = 384`, `VIEW_H = 216`.

```ts
r.sprite(id, i, x, y, { flipX: facing < 0 });                      // normal
r.sprite(id, i, x, y, { flash: true });                            // hit flash (white)
r.sprite(id, i, x, y); r.sprite(id, i, x, y, { tint: PAL.red[3], alpha: 0.5 }); // red telegraph flash
for (let row = 0; row < h; row += 2)                              // heat haze: shifted slices
  r.sprite(id, i, x + Math.round(Math.sin(t / 8 + row) * 2), y, { src: { x: 0, y: row, w, h: 2 } });
r.text('METAL SWAN', 192, 36, { font: 'big', scale: 2, align: 'center', outline: INK });
```

- **Resolution** (`docs/ARCHITECTURE.md` §3). Every renderer has `res` (k: backbuffer px per
  logical px, integer ≥ 1), `mode` (`UpscaleMode`: `'pixel' | 'smooth' | 'xbr'`, `setMode(m)`)
  and `subpixel` (`SubpixelMode`: `'off' | 'parallax' | 'camera' | 'all'`, `setSubpixel(s)`,
  default `DEFAULT_SUBPIXEL` = `'all'`: the camera and world draws in 1/k steps; pass world
  positions unrounded so the parts of one entity share one fractional position). `w`, `h` (384 × 216), `camX`, `camY` and every draw
  coordinate stay logical; the backbuffer is (w·k) × (h·k). Rects, lines, text and buffers
  without a sprite id draw as crisp k × k blocks; registered sprites are filtered by
  `upscale(buf, m)` with m = `spriteFilter(spriteIdOf(buf), mode, k)` (render-common.ts) and
  cover exactly their logical footprint × k. Frames of density d > 1 are never filtered: exact
  (k / d)-px blocks when d | k, nearest enlargement by k / d otherwise, and at k < d the
  reduction to `drawDensity(d, k)` (the highest density ≤ k that divides d: a 4× frame at k 2
  or 3 draws its 2× image, at k 1 its 1× image; `reducedFor(buf, d, k)` = `lowRes(buf, d / that)`,
  `lowRes` = `buf.downsampled(n)`, cached). `spriteFilter` gives `'pixel'` for buffers that
  `filtersId` rejects (`UNFILTERED_PREFIXES` `['ui/']` minus `FILTERED_UI_PREFIXES`, plus the
  exact ids in `UNFILTERED_IDS`), `'smooth'` for `XBR_AS_SMOOTH_PREFIXES` (`['decor/']`) in
  `'xbr'` mode, and else `modeAtRes(mode, k)` (a filter whose factor is above k steps down:
  `'xbr'` → `'smooth'` → `'pixel'`). `spriteIdOf(buf)` (sprites.ts) tells which buffers are
  sprite frames. Pass the camera unrounded: `r.setCamera(camera.viewX, camera.viewY)`.
- Placement rules live in `render-common.ts` and are shared, so both renderers give the same
  pixels (in backbuffer px; logical px at k = 1): camera `cameraPx(x, k, subpixel)` (whole
  logical px, or 1/k with `'camera'` / `'all'`); world → screen `toPx(x, k, fine) − camera`
  (`Math.round(x) · k`, or `Math.round(x · k)` for world draws with `'all'`); anchored top-left
  `anchorTopLeft(…)` = anchor − (flipX ? w − 1 − ox : ox) · k; parallax origin
  `parallaxOrigin(offset, layerCam(…), factor, k, fine)` = `Math.round(offset − cam × factor)`
  (in 1/k steps with a sub-pixel policy; `'parallax'` and `'all'` use the unrounded camera for
  factors ≠ 1), tiled from `firstTile(origin, size · k)`; `src` slices stay in logical px of the
  frame (`placePart(…, k)` with the logical size; × d addresses a 2× buffer). `chooseRes(scale, kmax = KMAX, factor = 1)` picks k for a display scale
  and filter factor: the scale itself up to kmax, else the largest k ≤ kmax that the factor
  divides (so filtered pixels land as a direct nearest-neighbour scale would put them).
  Art tiers: `chooseTier(scale, want = 0)` (AUTO 0: 4 when the integer scale ≥ `TIER4_MIN_SCALE`
  8, 2 from 2, else 1; `want` 1 / 2 / 4 forces), `kmaxForTier(t)` (`KMAX_TIER4` = 8 at tier 4,
  else `KMAX` = 6), `tierAtRes(t, k)` (4 needs 4 | k, 2 needs k ≥ 2) and
  `chooseTierRes(scale, want, factor, kmaxCap?, out?)` → `{ tier, k }` (4K AUTO → tier 4, k 8; a
  forced 4× at scale 5–7 → k 4; a `?kmax` cap below 8 keeps AUTO at tier 2). `FrameGovernor`
  (`sample(ms, now, tier)` → true once when tier-4 frames average more than
  `GOVERNOR_LIMIT_MS` = 8 over `GOVERNOR_WINDOW_MS` = 2000; main.ts then caps the tier at 2).
- `new SoftRenderer(w?, h?, target?, { res?, mode?, subpixel? })` → `.target` is a PixelBuffer
  of (w·res) × (h·res) (node tools, tests, screenshots). Defaults: res 1, `'pixel'` — the
  classic image. Upscaled sprites are cached in a WeakMap (no budget), so headless PNGs show
  the browser look (exactly when k is a multiple of the filter factor; else up to 0.1 % of the
  pixels differ on nearest-neighbour ties, `tests/media/browser.test.ts`). `PixelBuffer.blitScaled(src, dx, dy, num, den, opts)` is its
  nearest-neighbour enlargement (pixel-centre sampling; at ratios that are not integers a few
  tie columns may differ from Chromium).
- `new CanvasRenderer(w?, h?, canvas?, { res?, mode?, subpixel?, budgetPx?, scaleBudgetMs?, uploadBudgetMs? })`
  (browser) → `.canvas` backbuffer; `setRes(k)` re-sizes it. Caches one canvas per buffer
  variant (normal / flipped / flash / tint colour, and the same of the upscaled copy) in one LRU
  cache with a pixel budget (default `textureBudgetFor(k)`: `TEXTURE_BUDGET_PX` = 48 M px, 96 M
  (`TEXTURE_BUDGET_PX_K8`) at k ≥ 8; it follows `setRes` unless `budgetPx` was given). Uploads
  swizzle 32-bit words into one reused ImageData; dense frames (d > 1) have an upload budget
  (`UPLOAD_BUDGET_MS` = 6 ms per frame): once spent, a dense frame without its texture draws its
  1× reduction that frame and uploads later (`textureStats().uploadMs` / `uploadDeferred`); upscaling is lazy, at most
  `SCALE_BUDGET_MS` = 4 ms per frame (a sprite not scaled yet draws from 1× that frame). A buffer
  whose `version` changed is re-uploaded (call `buf.touch()` after writing `buf.data` directly),
  `forget(buf)` drops it, `clearUpscaled()` drops every upscaled copy (`setMode` does it),
  `textureStats()` reports entries, pixels, scales / deferrals and time of the last frame,
  plus `streams` (live stream slots) and `streamUploads` (stream uploads so far).
- **Streamed buffers** (`DrawOpts.stream`). Use it for a buffer that changes most frames (the
  first-person view: `r.image(view.buf, 0, 0, { screen: true, stream: true })`). The canvas
  renderer then skips the texture cache: it keeps one slot per buffer (one canvas, one
  `ImageData` and a `Uint32Array` view of its bytes). On a `version` change it converts
  `0xRRGGBBAA` to canvas byte order (checks little-endian once; transparent pixels become 0) and
  calls `putImageData`; an unchanged buffer is drawn without an upload. Placement and scaling
  are the same as a normal draw, so `alpha` and `blend` still apply. Slots are outside the pixel
  budget and are dropped after `STREAM_IDLE_FRAMES` = 120 frames without a draw (or by
  `forget(buf)`). The flag applies only to plain draws: with `tint`, `flash`, `flipX`, `flipY`,
  `src`, a sprite filter or density > res the draw uses the texture cache as before. The stream
  path allocates nothing per frame. `SoftRenderer` ignores the flag: the pixels are identical
  (`tests/media/browser.test.ts`, res 1 and 3). Call `buf.touch()` after writing `buf.data`.
- `createDisplay(visibleCanvas, { scanlines, kmax })` (browser) → `present(renderer.canvas)`
  each frame (any backbuffer size), `setScanlines(on)`, `toggleFullscreen()`,
  `toGame(clientX, clientY)` (logical px), `scale` (device px per logical px),
  `tierRes(factor, want = 0)` → `{ tier, k }` (`chooseTierRes`, the object is reused), `resFor(factor)`
  (the backbuffer resolution for that scale and the filter's `upscaleFactor`) and `res`
  (= `resFor(1)`). Largest integer scale in device pixels, black letterbox, best-fit fallback
  when tiny; the backbuffer is presented by nearest neighbour at any ratio.

```ts
// main.ts (browser)
const display = createDisplay(document.getElementById('game') as HTMLCanvasElement);
const r = new CanvasRenderer(undefined, undefined, undefined, { res: display.resFor(2), mode: 'smooth' });
function draw() {
  const k = display.resFor(upscaleFactor(r.mode));
  if (r.res !== k) r.setRes(k); // resize / DPR change
  r.begin(bg.sky); /* … */ r.end(); display.present(r.canvas);
}
```

**Upscalers** — `upscale.ts`: `UpscaleMode`, `UPSCALE_MODES`, `upscaleFactor(mode)` (integer),
`upscale(buf, mode)` (pure, deterministic, mirror-symmetric; `'pixel'` returns `buf`).

## 8. Tools

`npm run sprites -- [prefix] [--marks] [--scale 3] [--palette] [--density 2|4 [--all]] [--out dir]`: loads the art
modules (`ART_MODULE_IDS`), generates every sprite (or those matching `prefix`), writes one
contact sheet per top-level group to `tmp/sprites/<group>.png` (split into `-2`, `-3` … when
tall). Frames of one sprite are aligned by anchor. `--marks`: anchors cyan, points magenta.
Prints counts and generation errors (exit code 1 if any). Demo sprites: `demo/shapes`,
`demo/font`, `demo/anim`, `demo/rotations`; `npm run sprites -- demo/broken` shows how a
failing generator is reported. `--density 2` draws the 2× frames at 2 sheet px per logical px
(only ids with 2× art, `--all` for every id with 1× ones doubled) to `<group>@2x.png` (default
scale 2); marks cover the whole logical pixel where the game reads the point. `demo/anim` has a
2× version. `npm run shot -- --mission ams …` draws ams with its 2× art like the browser;
`--art 1` shows the 1× art for comparison. `--density 4` draws the ids with 4× or 2× art at 4
sheet px per logical px, each at the highest density it has (to `<group>@4x.png`, default scale
1; the summary counts frames per density). `npm run shot -- --mission ams --res 8 --art 4` (and
`npm run arena -- --res 8 --art 4`) draws art tier 4 as on a 4K screen (a res that cannot show
4× uses the browser's lower tier); `npm run perf -- --art auto,4,2` compares tiers.

`npm run shot` / `npm run arena` take `--res k` (backbuffer resolution, default 1) and
`--gfx pixel|smooth|xbr` (sprite filter at res > 1, default pixel as in the browser; `tools/lib/gfx.ts`: a filter
that needs a larger res steps down as in the browser, with a warning on stderr and the filter
drawn in the sheet title); the PNG scale then defaults to 1. `npm run smoke` takes `--viewport WxH` and `--dpr n`. `npm run perf` measures browser
frame times of the production build per viewport and mode (`docs/ARCHITECTURE.md` §9).

`npm run anim-bench -- [prefix] [--density 1|2] [--runs 3] [--json out]`: generation ms (median
of `--runs`, each group from an empty sprite cache) and frame counts per hero (`hero:<id>@1x/2x`),
per rider set (`enemy/fatbike-youth`, `enemy/delivery-rider`), for the boot list (`boot@1x`:
`bootArt` of the default launch, deferred sprites left out) and the ams 2× set (`ams-hi@2x`: every
id with 2× art). The baseline of the animation wave is `tmp/anim-baseline.json`.

`npm run geometry-fixture -- <ids…> [--dry-run]`: rewrites only the named ids in
`tests/engine/fixtures/sprite-geometry.json` (the geometry test, `tests/engine/hires.test.ts`) with
their current digest (`spriteGeometrySample`); `--dry-run` prints the diff only. Verifiers only.

`tools/lib/png.ts`: `encodePNG(w, h, rgba)`, `crc32`. `tools/lib/image.ts`: `savePNG(buf, file, scale)`,
`composeSheets(items, opts)`, `drawChecker(...)`.

**Audio report** (nobody can listen, so check the numbers):
`npx tsx tools/lib/audio-report.ts [prefix] [--wav] [--songs] [--seconds 30] [--out tmp/audio]`
renders every sfx (node) and, with `--songs`, every song through the real Web Audio graph in
headless Chromium; prints length, peak, RMS dB, attack, audible length, a brightness hint and
flags (`SILENT`, `HOT`, `LONG`, `DC`; invalid songs with their parse error). `--wav` writes
`tmp/audio/{sfx,music}/*.wav` for a human to listen to. Exit code 1 when something is flagged.
Guide levels: sfx peaks 0.4–0.9, RMS −24…−12 dB; a full song mix peaks below 1.
`tools/lib/wav.ts`: `encodeWAV(channels, rate)`, `audioStats(samples, rate)`.

## 9. Audio

`audio.ts` is the contract: `AudioOut { sfx(id, {vol, pitch, pan}), music(id | null, {fadeTicks,
restart, from}), voice(line), setVolume('master'|'music'|'sfx'|'voice', v), stopAll(), update?(),
pauseMusic?(), resumeMusic?(), sfxLoop?(key, id, {vol, pitch, pan}), stopSfx?(key, fadeTicks = 4),
duckMusic?(factor), setMuted?(m), suspend?(), resume?(), loadSamples?(group, onProgress?),
say?(text, speaker?, {important}), speaking?(), pauseLoops?(), resumeLoops?() }` and `NullAudio`
(headless, keeps a `log` such as `sfx:ui/move`, the last 256 entries; it has no `loadSamples` /
`say` / `speaking` / `pauseLoops`, so samples and these calls never change a log). It also re-exports `defineSfx/hasSfx/listSfx/renderSfx`
and `defineSong/hasSong/listSongs` for one-stop imports. Unknown sfx/song ids play nothing and
warn once; an unknown or broken song never silences the song that is playing (fail soft).

- **Loops** (engines, rotors, drones, a held laser): `sfxLoop(key, id, opts)` starts the sound under
  `key`, or updates vol / pitch / pan when the same key already plays the same id (call it every tick);
  a new id replaces it. `stopSfx(key)` fades it out. Owners stop their loops when they die or leave
  (`onRemove`). Optional methods: call them as `audio.sfxLoop?.(…)`.
- **Ducking**: `duckMusic(0.5)` lowers the music on top of its volume (the pause menu); `duckMusic(1)` restores.
- **Loop pause**: `pauseLoops()` silences every `sfxLoop` (a gain between the loops and the sfx
  bus; the loops keep running) and `resumeLoops()` brings them back. `GameplayScene` calls them
  when a scene opens on top (pause menu, continue screen); leaving gameplay calls
  `runner.stopLoops()` (the ambience and the 'stopLoops' event) and restores the loop bus.
  `stopAll` restores it too.
- `music(sameId)` keeps the song going and resumes it when it was paused (`restart: true` starts over).
- **Start index**: `music(id, { from: n })` starts a new song at slot `n` of its order list (clamped;
  `orderTime(song, n)` = its start in seconds, from `ParsedSong.orderRows`); the song then loops as usual.
  Ignored when the same song keeps playing (pass `restart: true` too). `NullAudio` logs `music:<id>@<n>`.
- **Sfx jitter**: the browser output plays each sfx at `jitterPitch(pitch, sfxJitter(id), r)` =
  pitch × (1 ± jitter), r from `Math.random()` (cosmetic, never the simulation rng; recipe `jitter`,
  clamped to 0.5).

### 9.1 Sound effects — `synth.ts`

A recipe is plain data rendered by a deterministic TS synth (mono, 44.1 kHz, cached per id).
Noise is seeded by the id, so the same id always sounds the same; output is soft-limited (≤ 0.98).

```ts
defineSfx('weapon/pistol', {
  vol: 0.8,
  voices: 6, gap: 0.03,                       // playback limits (defaults 4 voices, 15 ms)
  layers: [
    { wave: 'square', freq: 900, to: 180, sweep: 0.08, env: { a: 0.001, d: 0.09 }, vol: 0.6 },
    { wave: 'noise', env: { a: 0.001, d: 0.06 }, filter: { type: 'highpass', freq: 1500 }, vol: 0.7 },
  ],
});
defineSfx('explosion/m', {
  layers: [
    { wave: 'noise', freq: 9000, to: 600, env: { a: 0.002, d: 0.7 }, filter: { type: 'lowpass', freq: 3000, to: 300 }, drive: 1.5 },
    { wave: 'sine', freq: 90, to: 35, env: { a: 0.002, d: 0.5 }, vol: 0.9 },
  ],
  echo: { delay: 0.11, feedback: 0.3, mix: 0.3 },
});
```

| Layer field | Meaning |
|---|---|
| `wave` | `'sine' \| 'square' \| 'pulse' \| 'saw' \| 'triangle' \| 'noise'` (white, sample-and-hold at `freq`) `\| 'metal'` (short-LFSR periodic noise) |
| `freq`, `to`, `sweep`, `curve` | pitch sweep start → end over `sweep` s (default: whole layer); curve `'exp'` (default) / `'linear'` / power k |
| `duty`, `dutyTo` | pulse width and PWM sweep |
| `vibrato: {rate, depth (semitones), delay}`, `arp: [semitones…], arpTime` | |
| `env: {a, d, s, hold, r}` | seconds; `s` defaults to 0 when `d` is set (pluck), else 1 with `hold` 0.1 |
| `filter: {type: 'lowpass'\|'highpass'\|'bandpass', freq, to, time, q}` | swept biquad |
| `drive`, `crush` (bits), `delay` (start offset s), `vol` | |

Recipe level: `vol` (0.8), `length` cap, `seed`, `filter`, `drive`, `crush`, `downsample`,
`echo: {delay, feedback, mix}`, `voices`, `gap`. Helpers: `renderRecipe(r)`, `recipeLength(r)`,
`renderSfx(id)` (cached `Float32Array | null`), `sfxLimits(id)`, `getSfxRecipe(id)`.
Default sounds: `ui/move`, `ui/confirm`, `ui/cancel`, `ui/pause`, `ui/announce` (voice fallback
jingle); drum hits `drum/kick|snare|hat|ohat|crash|tom|clap|rim` (used by songs). Redefine freely.

### 9.2 Songs — `music.ts`

```ts
defineSong('m1', {
  bpm: 150, rowsPerBeat: 4,            // a row is a 16th note
  order: ['intro', 'a', 'a', 'b'],     // pattern names in play order
  loop: 1,                             // after the last slot continue at order[1]; null = play once
  swing: 0,                            // 0..0.5 delays odd rows (shuffle)
  channels: [
    { inst: 'lead', vol: 0.9, patterns: {
        intro: '. . . . | . . . . | . . . . | . . . .',
        a:     'E5 - - . | G5 - A5 . | B5 - - - | A5 . G5 .',
        b:     'C6! - - - | B5 - A5 - | G5 - - - | - - . .' } },
    { inst: 'bass', patterns: { intro: 'E2 . E2 . | E2 . E2 . | G2 . G2 . | A2 . B2 .',
        a: 'E2 . E3 . | E2 . E3 . | G2 . G3 . | A2 . A3 .', b: 'C3 - - - | D3 - - - | E3 - - - | - - - -' } },
    { inst: 'drums', patterns: { intro: 'k . h . s . h . k . h . s . h h',
        a: 'k . h . s . h . k k h . s . h .', b: 'k+c . h . s . h . k . h . S . o .' } },
    { inst: 'pad', vol: 0.6, pan: -0.2, patterns: { a: 'E4+G4+B4 - - - - - - - - - - - - - - -', b: 'C4+E4+G4 - - - - - - - D4+F#4+A4 - - - - - - -' } },
  ],
});
```

Pattern tokens (whitespace separated; `|` is decoration): `C4`, `F#3`, `Bb2` (octave 0–8;
suffix `!` accent, `:1`–`:9` velocity), `~E4` slide into E4 from the previous held note,
`C4+E4+G4` chord, `-` hold one more row (also across pattern boundaries), `.` empty row (the
note is released). Drum channels: `k` kick, `s` snare, `h` hat, `o` open hat, `c` crash, `t` tom,
`p` clap, `r` rim; upper case = accent; `k+h` together. A drum channel's `kit` maps extra
lower-case letters to **any sfx id** (`kit: { x: 'env/thunder' }`) or replaces default ones.
Order entries `'A+2'` / `'A-12'` transpose the melodic channels of that slot (drums unchanged) —
handy for "same block, a whole step higher". All channels that define a pattern must give it
the same number of rows; a channel without that pattern is silent for the slot. 6/8 at a
dotted-quarter tempo: `rowsPerBeat: 6` (sixteenths) or `3` (eighths).

Instruments (`INSTRUMENTS`, or pass your own `InstrumentDef`): `pulse12`, `pulse25`, `pulse50`
(= `square`), `triangle`, `bass` (triangle), `saw`, `lead` (detuned saws, filter, delayed
vibrato), `sine`, `bell` (FM, rings through its decay), `pad` (3 detuned saws, slow attack,
low-pass), `drums`. Presets are level-balanced (melodic voices ≈ equal loudness, bass and
drums a bit stronger). `InstrumentDef = { kind: 'pulse'|'triangle'|'saw'|'sine'|'fm'|'pad'|'drums',
duty?, env: {a, d, s, r}, vol?, detune? (cents: two voices ±detune/2, e.g. a "squeezebox" from
two detuned 50 % pulses), vibrato?: {rate, depth (cents), delay}, tremolo?: {rate, depth 0..1},
filter?: {type, freq, q?, env?}, fm?: {ratio, index, decay}, octave?, oneShot?, glide? (s,
automatic portamento between legato single notes; also the `~` slide time, default 0.06) }`.
Channels add `vol`, `pan`, `transpose`, `kit`. Example — octave saw bass:
`{ kind: 'saw', octave: -1, env: { a: 0.005, d: 0.1, s: 0.8, r: 0.05 }, vol: 0.3 }`.

Pure, unit-tested scheduler: `parseSong(def, id)` (throws `SongError` with messages like
`song "m1": channel 0 pattern "a" row 5: "H4" is not a note …`), `songEvents(parsed, t0, t1, out?)`
→ notes starting in [t0, t1) with loops unrolled, `rowTime`, `localRow`, `songLength`,
`noteToMidi`, `midiToFreq`. `defineSong` never throws: an invalid song warns once and plays as
silence (`songError(id)` gives the message). **Compose original melodies only.**

### 9.3 Web Audio output — `audio.browser.ts` (browser only)

```ts
const audio = new WebAudioOut();          // installs the first-gesture unlock hook
audio.music('title');                     // remembered until the context is unlocked
audio.sfx('ui/confirm', { vol: 0.8, pitch: 1.1, pan: -0.5 });
audio.music('boss', { fadeTicks: 60 });   // 1 s crossfade
audio.pauseMusic(); audio.resumeMusic();  // keeps the song position
audio.setVolume('music', 0.5); audio.setMuted(true); audio.stopAll();
audio.preload(listSfx());                 // render buffers during the loading screen
```
- `unlock()` creates/resumes the shared AudioContext (call it in a gesture handler);
  `installUnlockHook(target?)` does it on the first pointer/key/touch; `getAudioContext()`.
- Graph: sfx/voice buses → master, music bus → dialogue duck → master; master → gentle
  compressor → output. Defaults: master 0.8, music 0.6, sfx 0.8, voice 1.
- Sfx: cached AudioBuffers, per-id voice limit (recipe `voices`, default 4; the oldest instance
  is stopped with a 10 ms fade), global limit 24, min gap per id, pitch = playbackRate,
  StereoPanner.
- Music: 25 ms look-ahead timer, ~120 ms horizon, sample-exact note times → seamless loops;
  fixed mix headroom; crossfades; pause/resume; suspends while the tab is hidden
  (`autoSuspend`). Very late notes after timer throttling are dropped, not bunched.
- `renderSongOffline(id, seconds)` renders through the same instrument graph into an
  OfflineAudioContext (tests, previews, exports).
- `sfxLoop` / `stopSfx` / `duckMusic` as in §9; `currentSong` = the loaded song id (or null);
  `songSource` = 'sample' or 'synth'.
- Samples: §9.5 (`loadSamples`, `releaseSamples`, `say`, the `samples` bank).

### 9.4 Announcer — `voice.browser.ts`

`createAnnouncer({rate, pitch, lang})` → `{ available, enabled, volume, say(line), cancel() }`:
speechSynthesis with a punchy rate (1.15), low pitch (0.7), an English voice, at most one queued
line (newer replaces it), a watchdog for engines that never fire `end`. `WebAudioOut.voice(line)`
uses it and falls back to the `ui/announce` jingle when speech is unavailable or disabled
(`new WebAudioOut({ speech: false })`). Write original announcer lines. A line with a loaded voice
sample (§9.5) plays the sample instead.

### 9.5 Samples — `samples.ts`, `samples.browser.ts` (start screens and mission `ams`)

Exception of 2026-10-14 (docs/ARCHITECTURE.md rule 2, docs/ORIGINALITY.md): the start screens
and mission `ams` ship ElevenLabs-generated MP3 files under `public/audio/`. A sample is an
optional skin over an existing id; the ids, the game code and the headless outputs do not change.

```ts
// src/game/content/samples/manifest.ts (written by tools/audio/ship.ts)
export const SAMPLE_MANIFEST: Readonly<Record<string, SampleGroup>> = {
  boot: {
    sfx: { 'ui/move': { files: ['boot/sfx/ui-move-1.mp3', 'boot/sfx/ui-move-2.mp3'] } },
    music: { title: { file: 'boot/music/title-1.mp3', loopStart: 3.2, loopEnd: 64.8, duration: 66 } },
    voice: { 'time-up': { files: ['boot/voice/time-up-1.mp3'], duration: 0.9 } },
  },
  'mission:ams': { /* … */ },
};
```

- `samples.ts` (pure): types `SampleSfx { files, vol?, voices?, gap?, loopStart?, loopEnd? }`,
  `SampleSong { file, vol?, loopStart (null = once), loopEnd?, duration, marks? }`,
  `SampleVoice { files, vol?, duration }`, `SampleGroup { sfx?, music?, voice? }`;
  `defineSampleGroup(name, g)`, `getSampleGroup`, `listSampleGroups`; `voiceKey(text)` (the key of
  a spoken line: lower-case slug, '\n' → space, a leading `SPEAKER: ` dropped, punctuation and
  accents dropped, ≤ 64 characters: `'HOI! WELKOM BIJ\nFABEL FRIET!'` → `'hoi-welkom-bij-fabel-friet'`);
  pure helpers `pickTake`, `foldLoopPosition`, `songLoopEnd`, `SpeechLane` (unit-tested).
- Groups: `'boot'` (title, select and briefing music, menu sounds, start-screen lines) is
  awaited by the boot scene (progress 90–100 %, at most 20 s); `'mission:ams'`
  (`MissionDef.audioGroup`) loads on the intro card (`preloadMissionAudio`), or in the boot scene
  for a direct `?mission=ams` start, or when gameplay starts. The attract demo stays silent
  (NullAudio).
- `samples.browser.ts` `SampleBank`: fetches `audio/<file>` against `document.baseURI` (6 in
  parallel), decodes with the live AudioContext or, before the first gesture, an
  OfflineAudioContext; state per key 'loading' | 'ready' | 'failed' (a failed file warns once);
  random take, never the same twice in a row (Math.random, browser only); `release(group)`.
  Memory: decoded PCM is about 21 MB per minute of stereo audio; `WebAudioOut.releaseSamples(group)`
  frees a group.
- Fallback: a sound effect, song or line plays its sample only when it is ready; otherwise the
  synth sound, the synth song, or the speech announcer / `ui/announce` jingle plays. `say(text)`
  (speech bubbles) has no fallback: no sample, no sound.
- Sound effects: same voice limits (manifest `voices` / `gap` override the recipe's), pitch,
  jitter, volume (× manifest `vol`) and pan as the synth. An alias id (same recipe) uses the
  sample of its target. `sfxLoop` loops between `loopStart` / `loopEnd` (never the raw MP3 ends).
- Music: one buffer source plays the intro once and then loops between `loopStart` and `loopEnd`
  seamlessly; one-shots (`loopStart: null`) end by themselves. Pause folds the position into the
  loop; fades, crossfades (`fadeTicks`), the same-id rule and fail-soft stay as for the synth.
  `from` uses `marks[from]` (else the top). When a group finishes loading while the synth version
  of the same song plays, it crossfades to the sample (same position within the first 3 s,
  else from the loop start).
- Voice samples: one line at a time (`SpeechLane`): the same line again is ignored. A new bubble
  line replaces a playing bubble line when the same speaker says it (like their bubble on screen),
  or when it is important (`say(text, speaker, { important: true })`: hint and radio bubbles,
  Gusto's briefing) and the playing line is a gag bark. A gag bark never cuts off another
  speaker, and nothing cuts off an announcer line. Other lines wait in a queue of one (newest
  wins; a bubble never pushes out a waiting announcer line, a gag line never pushes out a waiting
  important line; a bubble waits at most 1.5 s, an announcer line 3 s). `speaking()` is true while
  a line plays or waits. While a voice sample plays, the music ducks to 0.4 on its own gain node
  (it multiplies with `duckMusic`), and comes back 150 ms after the last line. With the voice
  volume at 0 (or muted) `voice` and `say` do nothing at all: no sample, no speech, no jingle, no
  duck.
- Speech bubbles: `HudState.onBubble` (set by the mission runner) calls `audio.say(text, speaker)`
  for bubbles that show (gag bubbles stay silent with SPEECH BUBBLES OFF; hint and radio bubbles
  pass `important`). `BubbleOpts.voice: false` never voices a line: ROBO-HALSEMA's lines stay
  text-only. The mission intro card says each of Gusto's briefing lines (`BRIEFING_SPEAKER`)
  when its typing starts, the next one only when `speaking()` is false. `GameAudio` gates
  `voice` with ANNOUNCER and `say` with VOICE VOLUME > 0; VOICE VOLUME (0–10, default 10) sets
  the voice bus.

## 10. Tests

`tests/media/*.test.ts` — exact pixels for primitives, outline, poly, blit, bevel, dither,
gradient; ascii; palette sanity; sprite registry (lazy, cache, placeholder, preload); Animator
timing; soft renderer (camera, flips, flash, alpha, add, parallax, text); font coverage; synth
(length, finite, peak); song parser and scheduler; PNG encoder. `tests/media/browser.test.ts`
bundles the browser code with Vite and runs it in headless Chromium: canvas vs software
renderer parity (exact for opaque drawing, ±3 for blends), display scaling at DPR 1 and 2,
offline song rendering (level and pitch) and a live WebAudioOut smoke run. It skips with a
warning when Chromium cannot start.
