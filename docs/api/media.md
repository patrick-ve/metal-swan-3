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
| `blitFrame(frame,x,y,blitOpts)` | place a sprite Frame by its anchor (flips mirror like the renderers) — compose parts: legs + torso, hull + turret |
| `blendRect(x,y,w,h,c,alpha,mode)`, `blendPixel(x,y,c,alpha,mode)` | translucent overlays |
| `outline(c,{corners,inside,only})` | see margin rule below |
| `bevel(ramp,{light='tl',depth=1,base,only})` | auto-shading: lit edge lighter, far edge darker |
| `dither(x,y,w,h,c,level,{pattern:'bayer'\|'checker',only})` | level 0..1 (17 Bayer steps), pattern anchored to buffer coords |
| `gradient(x,y,w,h,ramp,{vertical=true,reverse,dither=true\|false\|0..0.5,only})` | banded ramp with dithered band borders |
| `noise(rand,{colors,density,x,y,w,h,only})` | `rand` = seeded `() => [0,1)` (`seededRand(seed)` or `rng.next.bind(rng)`) |
| `replace(from,to)`, `recolor(map)`, `silhouette(c)`, `mirror('x'\|'y')` | palette swaps, symmetric art |
| `trimBounds()`, `crop(x,y,w,h)`, `padded(n \| l,t,r,b)`, `clone()`, `scaled(n)`, `flipped(x,y)` | new buffers |
| `rotated(rad, {quality:'smooth'\|'fast'})` | clockwise about the centre; smooth = RotSprite-style (Scale2x×3 then nearest), quarter turns exact; output keeps the source parity so centres align. Pre-render directions at generation time — renderers never rotate |
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
//         ticksPerFrame?: number, durations?: number[], loop?: boolean, trim?: boolean }
getFrames(id) / getFrame(id, i) / frameCount(id) / hasSprite(id) / listSprites(prefix?)
spriteAnim(id) / spriteErrors() / clearSpriteCache(id?) / placeholderFrames()
await preloadSprites(prefixes?, (done, total) => …, { batch?, yieldFn? })  // never rejects
framePoint(frame, name, flipX?, flipY?, out?)
```
- Generated lazily on first use, then cached. Unknown id or a throwing generator → magenta
  placeholder (12×12, feet anchor) and **one** `console.warn` per id.
- **Anchors.** `Frame = { buf, ox, oy, pts? }`. Drawing at (x, y) puts buffer pixel (ox, oy) on
  (x, y). `'feet'` = (floor(w/2), h): the frame stands **on** line y (lowest pixel row is y−1).
  `'center'` = (floor(w/2), floor(h/2)).
- **Flips** mirror around the anchor pixel: left = x − (w − 1 − ox). A point at +dx becomes −dx.
- **Points** (`hip`, `muzzle`, `hand`, `head`, `seat`, …) are relative to the anchor of the
  unflipped frame. Frames returned by the generator keep their own `pts`; otherwise `opts.pts`
  applies (one record for all frames, or an array cycled per frame).
- `trim: true` crops transparent margins per frame and keeps anchors/points correct.

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
r.sprite(anim.id, anim.index, x, y, { flipX: facing < 0 });
anim.done; anim.changed; anim.loops; anim.length; anim.point('muzzle', facing < 0, scratch);
```
A non-looping strip stops on the last frame; `done` turns true after that frame's duration.

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
`parallax(buf,fx,fy,offX,offY,{repeatX=true,repeatY,alpha})`, `fade(c,alpha)`. (Game background
layers — `BgLayerDef` with `alpha`, `repeatY`, `driftX/Y`, `front` — are drawn with `parallax`; sizing
rules for tall sections: `docs/ART_GUIDE.md` §7.)
`DrawOpts`: `flipX`, `flipY`, `flash` (white silhouette), `tint` (silhouette in any colour;
overrides `flash`), `alpha`, `screen`, `blend:'add'`, `src: {x,y,w,h}` (draw only that part of
the unflipped image, exactly where it would land in the full drawing).
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

- Placement rules live in `render-common.ts` and are shared, so both renderers give the same
  pixels: world → screen is `Math.round(x) − camX`; parallax origin is
  `Math.round(offset − cam × factor)`, tiled from `firstTile(origin, size)`.
- `new SoftRenderer(w?, h?)` → `.target` is a PixelBuffer (node tools, tests, screenshots).
- `new CanvasRenderer(w?, h?, canvas?)` (browser) → `.canvas` backbuffer. Caches one canvas
  per buffer variant (normal / flipped / flash / tint colour) in a WeakMap; a buffer whose `version` changed
  is re-uploaded (call `buf.touch()` after writing `buf.data` directly), `forget(buf)` drops it.
- `createDisplay(visibleCanvas, { scanlines })` (browser) → `present(renderer.canvas)` each
  frame, `setScanlines(on)`, `toggleFullscreen()`, `toGame(clientX, clientY)`, `scale`.
  Largest integer scale in device pixels, black letterbox, best-fit fallback when tiny.

```ts
// main.ts (browser)
const r = new CanvasRenderer();
const display = createDisplay(document.getElementById('game') as HTMLCanvasElement);
function draw() { r.begin(bg.sky); /* … */ r.end(); display.present(r.canvas); }
```

## 8. Tools

`npm run sprites -- [prefix] [--marks] [--scale 3] [--palette] [--out dir]`: loads the art
modules (`ART_MODULE_IDS`), generates every sprite (or those matching `prefix`), writes one
contact sheet per top-level group to `tmp/sprites/<group>.png` (split into `-2`, `-3` … when
tall). Frames of one sprite are aligned by anchor. `--marks`: anchors cyan, points magenta.
Prints counts and generation errors (exit code 1 if any). Demo sprites: `demo/shapes`,
`demo/font`, `demo/anim`, `demo/rotations`; `npm run sprites -- demo/broken` shows how a
failing generator is reported.

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
duckMusic?(factor), setMuted?(m), suspend?(), resume?() }` and `NullAudio` (headless, keeps a `log`
such as `sfx:ui/move`, the last 256 entries). It also re-exports `defineSfx/hasSfx/listSfx/renderSfx`
and `defineSong/hasSong/listSongs` for one-stop imports. Unknown sfx/song ids play nothing and
warn once; an unknown or broken song never silences the song that is playing (fail soft).

- **Loops** (engines, rotors, drones, a held laser): `sfxLoop(key, id, opts)` starts the sound under
  `key`, or updates vol / pitch / pan when the same key already plays the same id (call it every tick);
  a new id replaces it. `stopSfx(key)` fades it out. Owners stop their loops when they die or leave
  (`onRemove`). Optional methods: call them as `audio.sfxLoop?.(…)`.
- **Ducking**: `duckMusic(0.5)` lowers the music on top of its volume (the pause menu); `duckMusic(1)` restores.
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
- Graph: sfx/music/voice buses → master → gentle compressor → output. Defaults: master 0.8,
  music 0.6, sfx 0.8, voice 1.
- Sfx: cached AudioBuffers, per-id voice limit (recipe `voices`, default 4; the oldest instance
  is stopped with a 10 ms fade), global limit 24, min gap per id, pitch = playbackRate,
  StereoPanner.
- Music: 25 ms look-ahead timer, ~120 ms horizon, sample-exact note times → seamless loops;
  fixed mix headroom; crossfades; pause/resume; suspends while the tab is hidden
  (`autoSuspend`). Very late notes after timer throttling are dropped, not bunched.
- `renderSongOffline(id, seconds)` renders through the same instrument graph into an
  OfflineAudioContext (tests, previews, exports).
- `sfxLoop` / `stopSfx` / `duckMusic` as in §9; `currentSong` = the loaded song id (or null).

### 9.4 Announcer — `voice.browser.ts`

`createAnnouncer({rate, pitch, lang})` → `{ available, enabled, volume, say(line), cancel() }`:
speechSynthesis with a punchy rate (1.15), low pitch (0.7), an English voice, at most one queued
line (newer replaces it), a watchdog for engines that never fire `end`. `WebAudioOut.voice(line)`
uses it and falls back to the `ui/announce` jingle when speech is unavailable or disabled
(`new WebAudioOut({ speech: false })`). Write original announcer lines.

## 10. Tests

`tests/media/*.test.ts` — exact pixels for primitives, outline, poly, blit, bevel, dither,
gradient; ascii; palette sanity; sprite registry (lazy, cache, placeholder, preload); Animator
timing; soft renderer (camera, flips, flash, alpha, add, parallax, text); font coverage; synth
(length, finite, peak); song parser and scheduler; PNG encoder. `tests/media/browser.test.ts`
bundles the browser code with Vite and runs it in headless Chromium: canvas vs software
renderer parity (exact for opaque drawing, ±3 for blends), display scaling at DPR 1 and 2,
offline song rendering (level and pitch) and a live WebAudioOut smoke run. It skips with a
warning when Chromium cannot start.
