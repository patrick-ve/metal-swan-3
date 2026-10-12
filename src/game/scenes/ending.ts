/**
 * The ending (GDD §2.6, §13.12), played in-engine after the last mission's tally:
 *
 * 1. THE LAST NOTE (600 ticks, music `ending`): over the night sea the Grand Organ breaks in two.
 *    Its pipes fall like bowling pins and each plays one note as it hits the water: the anthem
 *    with every note wrong except the one wrong note, which is finally right. Fanfaroni floats
 *    down under his bicorne hat.
 * 2. SPLASHDOWN (300 ticks): the Cygnets glide down on the Trumpeter (one on her seat, the others
 *    hanging on to her neck, legs and tail). Swan Mk1 surfaces under Fanfaroni; he lands on its
 *    head, soaking wet.
 * 3. THE PARADE (at least 900 ticks, music `credits`, no control): Lowmere's victory parade, with
 *    the credits scrolling up over it at 0.5 px/tick. The freed critics march with `5 ★`
 *    placards; Blare directs traffic, Rimshot's joke dies (rimshot), Puffington gives a speech to
 *    a pigeon, Pizzicata sings to the parade horses. At the end Fanfaroni plays his one triangle
 *    note at the wrong time, and everybody cheers anyway.
 * 4. CAPTIONS (big, C, y 96, 180 ticks each) over the lake at dusk.
 * 5. Each chosen character's victory pose with their ending line, then the final tally (14.6).
 *
 * Start skips to the next part (after 60 ticks of it). Everything is drawn from the cast in
 * content/ui/ending.art.ts plus the characters, hostages and the Swan; missing art is skipped.
 */
import type { Color } from '../../engine/color';
import { measure } from '../../engine/font';
import { INK, PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Renderer, SrcRect } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { getFrame, hasSprite } from '../../engine/sprites';
import { getBgGenerator, hasBgGenerator } from '../art/art-registry';
import { centerText, PLAYER_COLORS, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { wrapText } from '../context';
import { getCharacter, hasCharacter } from '../registry';
import { CHARACTER_TEXTS, CREDITS, ENDING_CAPTIONS, ROSTER } from './flow-data';
import { FinalTallyScene } from './final-tally';
import { drawLake, drawRiddenSwan, drawSwanRig, LAKE_SURFACE, veil } from './lake';

export type EndingPhase = 'last-note' | 'splashdown' | 'parade' | 'captions' | 'poses';

/** Phase lengths (GDD §2.6). The parade lasts at least 900 ticks and until the credits are done. */
export const LAST_NOTE_TICKS = 600;
export const SPLASHDOWN_TICKS = 300;
export const PARADE_TICKS = 900;
export const CAPTION_TICKS = 180;
/** Each chosen character's victory pose with their ending line (GDD is silent: 240 ticks). */
export const POSE_TICKS = 240;
/** Credits scroll speed (GDD §13.12) and the start skip delay. */
const CREDITS_SPEED = 0.5;
const SKIP_AFTER = 60;

/** The sea's waterline in the first two parts. */
const WATER_Y = 176;
const W = 384;
const H = 216;
/** The parade street: the house fronts stand on this line, the pavement and the road below it. */
const STREET_Y = 166;

const plain: DrawOpts = { screen: true };
const clipped: DrawOpts = { screen: true };
const flipped: DrawOpts = { screen: true, flipX: true };
const src: SrcRect = { x: 0, y: 0, w: 0, h: 0 };

// ---------------------------------------------------------------------------------------------
// The falling pipes (cosmetic, a fixed table: no RNG needed)
// ---------------------------------------------------------------------------------------------

interface Pipe {
  /** Release tick in THE LAST NOTE, start point, velocity, turn speed (frames per 8 ticks), length 0–2. */
  at: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  spin: number;
  len: number;
  /** Playback pitch of its note. */
  pitch: number;
}

const PIPE_GRAVITY = 0.035;

/**
 * The anthem's opening as semitones from the tonic. In the game the 7th note is always played a
 * semitone flat (GDD §2.5); the falling pipes play every note a semitone off instead, except the
 * 7th, which comes out right at last.
 */
const ANTHEM: readonly number[] = [0, 0, 4, 7, 7, 4, 9, 7, 5, 4, 2, 0];
const PIPES: readonly Pipe[] = ANTHEM.map((semi, i) => {
  // A tiny integer hash spreads them over the organ's width.
  const h = (i * 7919 + 13) % 97;
  const fromLeft = i % 2 === 0;
  const wrong = i === 6 ? 0 : h % 2 === 0 ? 1 : -1;
  return {
    at: 110 + i * 34,
    x0: 192 + (fromLeft ? -1 : 1) * (14 + (h % 40)),
    y0: 40 + (h % 20),
    vx: (fromLeft ? -1 : 1) * (0.25 + (h % 5) * 0.1),
    vy: -0.9 - (h % 3) * 0.25,
    spin: 1 + (h % 3),
    len: h % 3,
    pitch: Math.pow(2, (semi + wrong) / 12),
  };
});

/** Where a pipe is `dt` ticks after its release. */
function pipeAt(p: Pipe, dt: number, out: { x: number; y: number }): void {
  out.x = p.x0 + p.vx * dt;
  out.y = p.y0 + p.vy * dt + 0.5 * PIPE_GRAVITY * dt * dt;
}

/** Ticks from a pipe's release until it hits the water. */
function pipeLandsAfter(p: Pipe): number {
  // y0 + vy t + g t² / 2 = WATER_Y
  const a = 0.5 * PIPE_GRAVITY;
  const c = p.y0 - WATER_Y;
  return Math.ceil((-p.vy + Math.sqrt(p.vy * p.vy - 4 * a * c)) / (2 * a));
}

const PIPE_LAND: readonly number[] = PIPES.map((p) => p.at + pipeLandsAfter(p));

// ---------------------------------------------------------------------------------------------
// Backdrops (built once)
// ---------------------------------------------------------------------------------------------

let nightSea: PixelBuffer | null = null;
let dawnSea: PixelBuffer | null = null;
let streetSky: PixelBuffer | null = null;
let streetCity: PixelBuffer | null = null;
let streetFront: PixelBuffer | null = null;

function seaBackdrop(sky: Color[], water: Color[], sun: { x: number; y: number; r: number } | null, stars: number, seed: number, moon = false): PixelBuffer {
  const b = new PixelBuffer(W, H);
  if (hasBgGenerator('sky-gradient')) b.blit(getBgGenerator('sky-gradient')(W, WATER_Y + 2, { colors: sky, dither: 0.35, stars, y1: WATER_Y, moon, ...(sun ? { sun } : {}) }, seed), 0, 0);
  else b.gradient(0, 0, W, WATER_Y + 2, sky);
  if (hasBgGenerator('sea')) b.blit(getBgGenerator('sea')(W, H, { ramp: water, y: WATER_Y, sparkle: 0.6, foam: water[water.length - 1] }, seed + 1), 0, 0);
  else b.gradient(0, WATER_Y, W, H - WATER_Y, water);
  return b;
}

function nightBackdrop(): PixelBuffer {
  nightSea ??= seaBackdrop([PAL.ink[1], PAL.navy[0], PAL.navy[0], PAL.navy[1], PAL.purple[0]], [PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1]], { x: 0.18, y: 34, r: 7 }, 40, 3, true);
  return nightSea;
}

function dawnBackdrop(): PixelBuffer {
  dawnSea ??= seaBackdrop([PAL.navy[1], PAL.purple[1], PAL.pink[1], PAL.orange[2], PAL.gold[3]], [PAL.navy[0], PAL.navy[1], PAL.purple[1], PAL.pink[1], PAL.orange[2]], { x: 0.7, y: WATER_Y - 2, r: 14 }, 6, 5);
  return dawnSea;
}

/** The parade street: a day sky, a far skyline, and a wrapping row of Lowmere house fronts. */
function buildStreet(): void {
  const sky = new PixelBuffer(W, H);
  const skyCols = [PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.snow[2]];
  if (hasBgGenerator('sky-gradient')) sky.blit(getBgGenerator('sky-gradient')(W, H, { colors: skyCols, dither: 0.3 }, 9), 0, 0);
  else sky.gradient(0, 0, W, H, skyCols);
  streetSky = sky;
  streetCity = hasBgGenerator('city') ? getBgGenerator('city')(W, 150, { ramp: [PAL.sky[0], PAL.sky[1], PAL.steel[2], PAL.steel[3], PAL.snow[1]], y: 0.6, height: 0.4, night: false, lit: 0.2 }, 21) : new PixelBuffer(W, 150);
  streetFront = houseFronts();
}

/** Eight narrow house fronts (wrapping tile, 384 wide): plaster, roofs, windows, flower boxes, bunting. */
function houseFronts(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const walls: readonly (readonly Color[])[] = [PAL.sand, PAL.gold, PAL.teal, PAL.snow, PAL.orange, PAL.sky, PAL.red, PAL.stone];
  const ground = STREET_Y;
  let x = 0;
  for (let i = 0; i < 8; i++) {
    const w = 48;
    const top = 112 + ((i * 37) % 3) * 6;
    const ramp = walls[i];
    // Wall with a lit left edge, a gable roof, a door and two rows of windows.
    b.rect(x, top, w, ground - top, ramp[2]);
    b.rect(x, top, 2, ground - top, ramp[3]);
    b.rect(x + w - 2, top, 2, ground - top, ramp[1]);
    b.poly([x - 2, top, x + w / 2, top - 18, x + w + 2, top], PAL.red[1]);
    b.line(x - 2, top, x + w / 2, top - 18, PAL.red[2]);
    b.rect(x - 2, top, w + 4, 2, PAL.brown[1]);
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 2; c++) {
        const wx = x + 8 + c * 22;
        const wy = top + 10 + row * 28;
        if (row === 1 && c === 1) continue;
        b.rect(wx - 1, wy - 1, 12, 14, INK);
        b.rect(wx, wy, 10, 12, PAL.navy[1]);
        b.rect(wx, wy, 10, 1, PAL.sky[2]);
        b.rect(wx + 4, wy, 1, 12, ramp[3]);
        // A flower box under the window.
        b.rect(wx - 1, wy + 13, 12, 3, PAL.brown[1]);
        for (let f = 0; f < 4; f++) b.set(wx + 1 + f * 3, wy + 12, f % 2 ? PAL.red[3] : PAL.gold[3]);
      }
    }
    b.rect(x + 30, ground - 22, 12, 22, INK);
    b.rect(x + 31, ground - 21, 10, 21, PAL.brown[1]);
    b.set(x + 39, ground - 11, PAL.gold[3]);
    b.rect(x + w, top + 4, 1, ground - top - 4, PAL.ink[1]);
    x += w;
  }
  // Bunting across the street: crimson, gold and white flags on a string.
  for (let bx = 0; bx < W; bx += 6) {
    const sag = Math.round(Math.sin((bx / W) * Math.PI * 4) * 3) + 100;
    b.set(bx, sag, PAL.ink[1]);
    const c = [PAL.red[2], PAL.gold[3], PAL.snow[3]][(bx / 6) % 3];
    b.rect(bx + 1, sag + 1, 4, 1, c);
    b.rect(bx + 2, sag + 2, 2, 2, c);
  }
  // Pavement and kerb, then the road.
  b.rect(0, ground, W, 8, PAL.stone[2]);
  for (let px = 0; px < W; px += 12) b.rect(px, ground, 1, 8, PAL.stone[1]);
  b.rect(0, ground + 8, W, 2, PAL.stone[3]);
  b.rect(0, ground + 10, W, H - ground - 10, PAL.stone[1]);
  for (let px = 4; px < W; px += 32) b.rect(px, 194, 14, 2, PAL.snow[1]);
  return b;
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

/** One laid-out credits line: text, font, colour and its y inside the roll. */
interface RollLine {
  text: string;
  font: 'small' | 'big';
  color: Color;
  y: number;
}

/** The credits roll laid out top to bottom (headings big with space around them). */
export function creditsRoll(): { lines: RollLine[]; height: number } {
  const lines: RollLine[] = [];
  let y = 0;
  for (const c of CREDITS) {
    if (c.style !== 'line') y += 8;
    const font = c.style === 'line' ? 'small' : 'big';
    for (const part of wrapPx(c.text, font, 360)) {
      lines.push({ text: part, font, color: c.style === 'title' ? UI_GOLD : c.style === 'heading' ? PAL.sky[3] : UI_WHITE, y });
      y += font === 'big' ? 12 : 10;
    }
    if (c.style !== 'line') y += 4;
  }
  return { lines, height: y };
}

/** Word-wrap to a pixel width in a font. */
export function wrapPx(text: string, font: 'small' | 'big', width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, font) <= width || !line) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** The credits window: lines appear at its bottom and leave at its top. */
const ROLL_TOP = 6;
const ROLL_BOTTOM = 92;
/** The last line stops here. */
const ROLL_STOP = 40;

export class EndingScene implements Scene {
  private readonly app: GameApp;
  private phaseIndex = 0;
  /** Ticks into the current part. */
  private t = 0;
  private done = false;
  private readonly heroes: string[];
  private readonly roll = creditsRoll();
  private readonly paradeTicks: number;
  private readonly pt = { x: 0, y: 0 };
  /** Caption lines per caption (wrapped once). */
  private readonly captions: string[][];
  /** The four Cygnets, the first chosen hero first (they all ride home together). */
  private readonly crewIds: string[];

  constructor(app: GameApp) {
    this.app = app;
    const chosen = app.session?.slots.filter((s) => s.joined).map((s) => s.character) ?? [];
    this.heroes = chosen.filter((id) => hasCharacter(id));
    if (this.heroes.length === 0) this.heroes.push(hasCharacter('grace') ? 'grace' : 'recruit');
    // The roll ends when its last line reaches ROLL_STOP.
    const travel = ROLL_BOTTOM - ROLL_STOP + this.roll.height;
    this.paradeTicks = Math.max(PARADE_TICKS, Math.ceil(travel / CREDITS_SPEED) + 120);
    this.captions = ENDING_CAPTIONS.map((c) => wrapPx(c, 'big', 360));
    this.crewIds = [this.heroes[0]];
    for (const id of ROSTER) if (hasCharacter(id) && !this.crewIds.includes(id)) this.crewIds.push(id);
  }

  /** The part playing now. */
  get phase(): EndingPhase {
    return PHASES[Math.min(this.phaseIndex, PHASES.length - 1)];
  }

  /** Length of the current part. */
  private get length(): number {
    switch (this.phase) {
      case 'last-note':
        return LAST_NOTE_TICKS;
      case 'splashdown':
        return SPLASHDOWN_TICKS;
      case 'parade':
        return this.paradeTicks;
      case 'captions':
        return CAPTION_TICKS * this.captions.length;
      case 'poses':
        return POSE_TICKS * this.heroes.length;
    }
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    app.pointerPressed = false;
    app.audio.duckMusic?.(1);
    app.audio.music('ending', { fadeTicks: 30 });
  }

  update(): void {
    if (this.done) return;
    this.t++;
    const app = this.app;
    const input = app.input;
    const skip = input.pad(0).pressed('start') || input.pad(1).pressed('start') || input.keyPressed('Enter');
    this.sounds();
    if (this.t >= this.length || (skip && this.t > SKIP_AFTER)) this.nextPhase();
  }

  private nextPhase(): void {
    this.phaseIndex++;
    this.t = 0;
    if (this.phaseIndex >= PHASES.length) {
      this.done = true;
      this.app.scenes.replace(new FinalTallyScene(this.app), { fade: 40 });
      return;
    }
    if (this.phase === 'parade') this.app.audio.music('credits', { fadeTicks: 30 });
  }

  /** The sound cues of each part. */
  private sounds(): void {
    const a = this.app.audio;
    const t = this.t;
    switch (this.phase) {
      case 'last-note':
        if (t === 30 || t === 60) a.sfx('explosion/m');
        if (t === 96) a.sfx('explosion/l');
        for (let i = 0; i < PIPES.length; i++) if (t === PIPE_LAND[i]) a.sfx('enemy/triangle', { pitch: PIPES[i].pitch, vol: 0.8, pan: (PIPES[i].x0 - 192) / 192 });
        if (t === 300 || t === 330) a.sfx('env/water-splash', { vol: 0.7 });
        break;
      case 'splashdown':
        if (t === SPLASH_LAND) a.sfx('env/water-splash');
        break;
      case 'parade':
        if (t === RIMSHOT_AT) a.sfx('env/rimshot');
        if (t === this.paradeTicks - TING_BEFORE) a.sfx('enemy/triangle', { pitch: 1.06 });
        if (t === this.paradeTicks - TING_BEFORE + 20) a.sfx('env/applause');
        break;
      case 'captions':
        break;
      case 'poses':
        if (t % POSE_TICKS === 1) a.voice(getCharacter(this.heroes[Math.floor(t / POSE_TICKS)] ?? this.heroes[0]).voice ?? '');
        break;
    }
  }

  draw(r: Renderer): void {
    switch (this.phase) {
      case 'last-note':
        this.drawLastNote(r);
        break;
      case 'splashdown':
        this.drawSplashdown(r);
        break;
      case 'parade':
        this.drawParade(r);
        break;
      case 'captions':
        this.drawCaptions(r);
        break;
      case 'poses':
        this.drawPoses(r);
        break;
    }
  }

  // ------------------------------------------------------------------------------- THE LAST NOTE

  private drawLastNote(r: Renderer): void {
    const t = this.t;
    r.begin(PAL.ink[0]);
    r.image(nightBackdrop(), 0, 0, plain);
    // The two halves: shaking together, then the crack, then drifting apart, tilting and sinking.
    const shake = t < 96 && t % 4 < 2 ? 1 : 0;
    const k = Math.max(0, t - 96);
    const drift = Math.min(60, k * 0.35);
    const fall = k > 120 ? 0.5 * 0.012 * (k - 120) * (k - 120) : 0;
    const tilt = Math.min(3, Math.floor(k / 30));
    const y = 66 + Math.round(fall);
    this.sinking(r, 'ui/ending-organ', tilt, 192 - 35 - Math.round(drift) + shake, y);
    this.sinking(r, 'ui/ending-organ', 4 + tilt, 192 + 35 + Math.round(drift) - shake, y + Math.round(fall * 0.15));
    // Explosions while it breaks up.
    if (t < 140) this.burst(r, t, 30, 150, 60);
    if (t >= 96 && t < 130 && hasSprite('fx/explosion-l')) r.sprite('fx/explosion-l', Math.floor((t - 96) / 4), 192, 70, plain);
    // The pipes and their notes.
    for (let i = 0; i < PIPES.length; i++) {
      const p = PIPES[i];
      const dt = t - p.at;
      if (dt < 0) continue;
      pipeAt(p, dt, this.pt);
      const land = PIPE_LAND[i] - p.at;
      if (dt < land + 12) this.sinking(r, 'ui/ending-pipe', p.len * 8 + (Math.floor((dt * p.spin) / 8) % 8), Math.round(this.pt.x), Math.round(this.pt.y));
      if (dt >= land) this.splashAndNote(r, Math.round(this.pt.x), dt - land);
    }
    // Fanfaroni floats down under his hat, swaying.
    if (t > 200) {
      const ft = t - 200;
      const fx = 250 + Math.round(Math.sin(ft / 40) * 10);
      const fy = -10 + Math.round(ft * 0.22);
      if (hasSprite('ui/fanfaroni')) r.sprite('ui/fanfaroni', Math.floor(ft / 20) % 2, fx, fy, plain);
    }
  }

  /** Small explosions popping over the organ between t0 and t1, `n` px around its centre. */
  private burst(r: Renderer, t: number, t0: number, t1: number, n: number): void {
    if (t < t0 || t >= t1 || !hasSprite('fx/explosion-m')) return;
    for (let i = 0; i < 3; i++) {
      const life = (t - t0 + i * 11) % 24;
      const cycle = Math.floor((t - t0 + i * 11) / 24);
      const x = 192 + (((cycle * 37 + i * 53) % (n * 2)) - n);
      const y = 50 + ((cycle * 23 + i * 31) % 50);
      r.sprite('fx/explosion-m', Math.floor(life / 3), x, y, plain);
    }
  }

  /** A sprite that sinks into the sea: only the part above the waterline is drawn. */
  private sinking(r: Renderer, id: string, frame: number, x: number, y: number, flip = false): void {
    if (!hasSprite(id)) return;
    const f = getFrame(id, frame);
    const top = y - f.oy;
    const visible = WATER_Y + 1 - top;
    if (visible <= 0) return;
    if (visible >= f.buf.h) {
      r.sprite(id, frame, x, y, flip ? flipped : plain);
      return;
    }
    src.x = 0;
    src.y = 0;
    src.w = f.buf.w;
    src.h = visible;
    clipped.src = src;
    clipped.flipX = flip;
    r.sprite(id, frame, x, y, clipped);
    clipped.src = undefined;
    clipped.flipX = false;
  }

  /** A splash ring and a music note rising from where a pipe went in. */
  private splashAndNote(r: Renderer, x: number, age: number): void {
    if (age < 18 && hasSprite('fx/splash')) r.sprite('fx/splash', Math.floor(age / 3), x, WATER_Y + 2, plain);
    if (age < 70 && hasSprite('fx/music-note')) {
      const ny = WATER_Y - 6 - Math.round(age * 0.6);
      const nx = x + Math.round(Math.sin(age / 8) * 3);
      r.sprite('fx/music-note', 0, nx, ny, age > 50 && age % 4 < 2 ? clipped : plain);
    }
  }

  // ------------------------------------------------------------------------------- SPLASHDOWN

  private drawSplashdown(r: Renderer): void {
    const t = this.t;
    r.begin(PAL.navy[1]);
    r.image(dawnBackdrop(), 0, 0, plain);
    // Swan Mk1 surfaces under Fanfaroni; he drifts down and lands on its head.
    const mk1X = 262;
    const rise = Math.max(0, Math.min(1, (t - 70) / 50));
    if (hasSprite('ui/ending-mk1')) {
      const f = getFrame('ui/ending-mk1', 0);
      const sink = Math.round((1 - rise) * f.oy);
      if (sink < f.oy) {
        src.x = 0;
        src.y = 0;
        src.w = f.buf.w;
        src.h = f.oy - sink + 1;
        clipped.src = src;
        r.sprite('ui/ending-mk1', 0, mk1X, WATER_Y + 3 + sink, clipped);
        clipped.src = undefined;
      }
    }
    // Fanfaroni sits on the dome of Mk1's head.
    const headY = WATER_Y + 3 - (hasSprite('ui/ending-mk1') ? getFrame('ui/ending-mk1', 0).oy : 30) + 12;
    if (hasSprite('ui/fanfaroni')) {
      if (t < SPLASH_LAND) {
        const fy = 122 + Math.round((t / SPLASH_LAND) * (headY - 122));
        const fx = mk1X + Math.round(Math.sin(t / 30) * 6 * (1 - t / SPLASH_LAND));
        r.sprite('ui/fanfaroni', Math.floor(t / 20) % 2, fx, fy, plain);
      } else {
        // Soaked, sitting on Mk1's head; drips fall off him.
        r.sprite('ui/fanfaroni', 2, mk1X - 1, headY, plain);
        const d = (t - SPLASH_LAND) % 30;
        r.rect(mk1X - 8, headY - 12 + d, 1, 2, PAL.sky[3], plain);
        r.rect(mk1X + 9, headY - 20 + ((d + 13) % 30), 1, 2, PAL.sky[3], plain);
      }
    }
    if (t >= SPLASH_LAND && t < SPLASH_LAND + 18 && hasSprite('fx/splash')) r.sprite('fx/splash', Math.floor((t - SPLASH_LAND) / 3), mk1X, WATER_Y + 2, plain);
    this.drawFlyer(r, t);
  }

  /** The Cygnets gliding in on the Trumpeter (or the stand-in flyer): one on her seat, three hanging on. */
  private drawFlyer(r: Renderer, t: number): void {
    const real = hasSprite('vehicle/trumpeter/move') ? 'vehicle/trumpeter/move' : hasSprite('vehicle/trumpeter/idle') ? 'vehicle/trumpeter/idle' : null;
    const id = real ?? (hasSprite('ui/ending-flyer') ? 'ui/ending-flyer' : null);
    if (!id) return;
    // A long, gentle descent from the upper left to a glide over the water.
    const k = Math.min(1, t / 260);
    const x = Math.round(-60 + k * 230);
    const y = Math.round(40 + k * 90 + Math.sin(t / 25) * 2);
    const fi = Math.floor(t / 12);
    const f = getFrame(id, fi);
    const crew = this.crewIds;
    // Hangers first (behind the wing), the seat rider on top.
    const hangPts: readonly (readonly [number, number])[] = [f.pts?.neck ?? [24, -12], f.pts?.legs ?? [-26, 8], f.pts?.tail ?? [-30, -8]];
    for (let i = 1; i < crew.length && i <= 3; i++) this.drawHanger(r, crew[i], x + hangPts[i - 1][0], y + hangPts[i - 1][1], t + i * 7);
    r.sprite(id, fi, x, y, plain);
    const seat = f.pts?.seat ?? [0, -10];
    const art = getCharacter(crew[0]).art;
    const pose = hasSprite(`${art}/ride-cheer`) ? `${art}/ride-cheer` : hasSprite(`${art}/ride-sit`) ? `${art}/ride-sit` : null;
    if (pose) r.sprite(pose, Math.floor(t / 8), x + seat[0], y + seat[1], plain);
  }


  /** A Cygnet hanging on by the hands: the `spawn` drop pose if there is one, else `mount`. */
  private drawHanger(r: Renderer, char: string, hx: number, hy: number, t: number): void {
    const art = getCharacter(char).art;
    const id = hasSprite(`${art}/mount`) ? `${art}/mount` : null;
    if (!id) return;
    const f = getFrame(id, 0);
    const hand = f.pts?.hand ?? [0, -28];
    // Hang so the hand is at the point; legs swing a little.
    const swing = Math.round(Math.sin(t / 10) * 1);
    r.sprite(id, 0, hx - hand[0] + swing, hy - hand[1], plain);
  }

  // ------------------------------------------------------------------------------- THE PARADE

  private drawParade(r: Renderer): void {
    const t = this.t;
    if (!streetFront) buildStreet();
    r.begin(PAL.sky[2]);
    if (streetSky) r.image(streetSky, 0, 0, plain);
    const cam = Math.round(t * PARADE_SPEED);
    r.setCamera(cam, 0);
    if (streetCity) r.parallax(streetCity, 0.3, 0, 0, 0);
    if (streetFront) r.parallax(streetFront, 1, 0, 0, 0);
    r.setCamera(0, 0);
    // The roadside stations pass by (world x − camera): the leaders' community service.
    this.drawStations(r, cam, t);
    this.drawColumn(r, t);
    this.drawRoll(r, t);
    // The finale: the TING, confetti and cheering.
    const ting = t - (this.paradeTicks - TING_BEFORE);
    if (ting >= 20) this.confetti(r, ting - 20);
  }

  /** The Section Leaders at their posts along the street (world x), each doing their gag when on screen. */
  private drawStations(r: Renderer, cam: number, t: number): void {
    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      const x = s.x - cam;
      if (x < -40 || x > W + 40) continue;
      const id = `ui/leader-${s.who}`;
      // Walk frames 0–5 idle-shuffle, 6–7 their gag (while the parade passes in front).
      const gag = x < 330 && x > 40;
      const frame = gag ? 6 + (Math.floor(t / 16) % 2) : Math.floor(t / 20) % 2;
      if (hasSprite(id)) r.sprite(id, frame, x, PAVE_Y, s.flip ? flipped : plain);
      if (s.who === 'puffington' && hasSprite('ui/pigeon')) r.sprite('ui/pigeon', Math.floor(t / 30) % 2, x + 16, PAVE_Y, flipped);
      if (s.who === 'rimshot') {
        // His audience: three unimpressed townsfolk.
        for (let k = 0; k < 3; k++) {
          const who = AUDIENCE[k];
          const sid = `item/hostage/${who}/give`;
          if (hasSprite(sid)) r.sprite(sid, 0, x + 18 + k * 13, PAVE_Y, flipped);
        }
        if (gag && t > RIMSHOT_AT && t < RIMSHOT_AT + 90) uiText(r, 'BA-DUM TSS.', x + 30, PAVE_Y - 46, PAL.snow[3], 'center');
        else if (gag) uiText(r, '...SO THE TUBA SAYS...', x, PAVE_Y - 46, PAL.snow[3], 'center');
      }
      if (s.who === 'pizzicata' && gag) uiText(r, 'LA LA LAAA!', x, PAVE_Y - 46, PAL.pink[2], 'center');
      if (s.who === 'blare' && gag) uiText(r, 'KEEP IT MOVING!', x, PAVE_Y - 46, PAL.gold[3], 'center');
      if (s.who === 'puffington' && gag) uiText(r, 'FELLOW PIGEON...', x + 8, PAVE_Y - 46, PAL.snow[3], 'center');
    }
  }

  /** The parade column marching right with the camera (screen x fixed, legs moving). */
  private drawColumn(r: Renderer, t: number): void {
    const step = Math.floor(t / 8);
    // Head of the parade: two horses.
    if (hasSprite('ui/horse')) {
      r.sprite('ui/horse', step % 2, 356, ROAD_Y, plain);
      r.sprite('ui/horse', (step + 1) % 2, 324, ROAD_Y + 2, plain);
    }
    // The freed critics with their 5-star placards (and Mrs. Dollop).
    const kinds = MARCHERS;
    for (let i = 0; i < kinds.length; i++) {
      const x = 296 - i * 22;
      const id = `item/hostage/${kinds[i]}/walk`;
      if (!hasSprite(id)) continue;
      const bob = (step + i) % 2;
      r.sprite(id, step + i, x, ROAD_Y + (i % 2), plain);
      if (kinds[i] === 'critic' && hasSprite('ui/placard')) r.sprite('ui/placard', 0, x + 4, ROAD_Y - 22 - bob + (i % 2), plain);
    }
    // The SWAN-3 as the parade's float, the first hero on her back, cheering.
    drawSwanRig(r, 200, ROAD_Y + 2, t, { anim: 'move', neck: 'neck-relax', char: this.heroes[0], pose: 'ride-cheer', bodyTicks: 10, riderTicks: 8 });
    // The other Cygnets march behind her.
    const crew = this.crewIds;
    for (let i = 1; i < crew.length; i++) this.drawMarcher(r, crew[i], 148 - (i - 1) * 22, ROAD_Y + (i % 2), step + i);
    // The band, and Fanfaroni at the very end with his triangle.
    const band = BAND;
    for (let i = 0; i < band.length; i++) if (hasSprite(band[i])) r.sprite(band[i], step + i, 76 - i * 22, ROAD_Y + (i % 2), plain);
    if (hasSprite('ui/fanfaroni')) {
      const ting = t - (this.paradeTicks - TING_BEFORE);
      const frame = ting >= 0 && ting < 30 ? 5 : 3 + (step % 2);
      r.sprite('ui/fanfaroni', frame, 26, ROAD_Y, plain);
      if (ting >= 0 && ting < 30) uiText(r, 'TING!', 26, ROAD_Y - 52, PAL.gold[3], 'center');
    }
  }

  /** A Cygnet marching: running legs at a walk with the torso on the hip point. */
  private drawMarcher(r: Renderer, char: string, x: number, y: number, step: number): void {
    const art = getCharacter(char).art;
    const legs = `${art}/legs-run`;
    const torso = `${art}/torso-pistol-idle`;
    if (!hasSprite(legs) || !hasSprite(torso)) return;
    const lf = getFrame(legs, step);
    const hip = lf.pts?.hip ?? [0, -14];
    r.sprite(legs, step, x, y, plain);
    r.sprite(torso, 0, x + hip[0], y + hip[1], plain);
  }

  /** The credits roll over the parade (0.5 px/tick), clipped to the sky. */
  private drawRoll(r: Renderer, t: number): void {
    const travel = Math.min(t * CREDITS_SPEED, ROLL_BOTTOM - ROLL_STOP + this.roll.height);
    const y0 = ROLL_BOTTOM - Math.round(travel);
    for (const line of this.roll.lines) {
      const y = y0 + line.y;
      if (y < ROLL_TOP || y > ROLL_BOTTOM) continue;
      centerText(r, line.text, y, line.color, line.font);
    }
  }

  /** Confetti raining down after the TING (cosmetic, from the tick). */
  private confetti(r: Renderer, age: number): void {
    const cols = CONFETTI;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + Math.round(Math.sin((age + i * 13) / 12) * 6)) % W;
      const y = ((age * (1 + (i % 3) * 0.5) + i * 29) % (H + 10)) - 10;
      r.rect(x, Math.round(y), 2, (age + i) % 10 < 5 ? 2 : 1, cols[i % cols.length], plain);
    }
  }

  // ------------------------------------------------------------------------------- CAPTIONS, POSES

  private drawCaptions(r: Renderer): void {
    const t = this.t;
    r.begin(PAL.navy[0]);
    drawLake(r, t);
    // The SWAN-3 swims home across the lake.
    drawRiddenSwan(r, Math.round(-60 + t * 0.4), LAKE_SURFACE + 16, t, this.heroes[0]);
    veil(r, 0.45);
    const i = Math.min(this.captions.length - 1, Math.floor(t / CAPTION_TICKS));
    const ct = t - i * CAPTION_TICKS;
    // Each caption fades in and out (dimmer colour for the first and last 12 ticks).
    const edge = ct < 12 || ct > CAPTION_TICKS - 12;
    const lines = this.captions[i];
    const y = lines.length > 1 ? 90 : 96;
    for (let k = 0; k < lines.length; k++) centerText(r, lines[k], y + k * 12, edge ? PAL.snow[1] : i === this.captions.length - 1 ? UI_GOLD : UI_WHITE, 'big');
  }

  private drawPoses(r: Renderer): void {
    const t = this.t;
    r.begin(PAL.ink[0]);
    drawLake(r, LAST_NOTE_TICKS + t);
    veil(r, 0.65);
    const i = Math.min(this.heroes.length - 1, Math.floor(t / POSE_TICKS));
    const pt = t - i * POSE_TICKS;
    const id = this.heroes[i];
    const def = getCharacter(id);
    // A spotlight on a little stage.
    r.rect(152, 150, 80, 3, PAL.stone[1], plain);
    // The beam widens from 12 px at the top to 72 px on the stage floor.
    for (let y = 44; y < 150; y += 2) {
      const half = 6 + Math.round(((y - 44) / 106) * 30);
      r.rect(192 - half, y, half * 2, 2, PAL.gold[3], LIGHT);
    }
    const vic = `${def.art}/victory`;
    if (hasSprite(vic)) r.sprite(vic, Math.floor(pt / 8), 192, 150, plain);
    const slot = this.app.session?.slots.find((s) => s.joined && s.character === id);
    centerText(r, def.fullName ?? def.name, 30, slot ? PLAYER_COLORS[slot.index] : UI_GOLD, 'big');
    const line = def.endingLine ?? CHARACTER_TEXTS[id]?.endingLine ?? '';
    // The line types in at 2 characters per tick.
    let left = Math.max(0, (pt - 20) * 2);
    let y = 164;
    for (const part of wrapText(line, 58, 3)) {
      if (left <= 0) break;
      centerText(r, part.slice(0, left), y, UI_WHITE);
      left -= part.length;
      y += 10;
    }
  }
}

const PHASES: readonly EndingPhase[] = ['last-note', 'splashdown', 'parade', 'captions', 'poses'];

/** Splashdown: the tick Fanfaroni lands on Mk1's head. */
const SPLASH_LAND = 150;
/** The parade: the camera's speed, the road and pavement lines, Rimshot's punchline, the TING. */
const PARADE_SPEED = 0.75;
const ROAD_Y = 208;
const PAVE_Y = STREET_Y + 6;
const RIMSHOT_AT = 470;
const TING_BEFORE = 140;
const LIGHT: DrawOpts = { screen: true, alpha: 0.08, blend: 'add' };
/** Rimshot's unimpressed audience, the marching townsfolk, the band, the confetti colours. */
const AUDIENCE: readonly string[] = ['tourist', 'tea-lady', 'roadie'];
const MARCHERS: readonly string[] = ['critic', 'dollop', 'critic'];
const BAND: readonly string[] = ['enemy/oompah-trooper/walk', 'enemy/rifleman/walk'];
const CONFETTI: readonly Color[] = [PAL.red[3], PAL.gold[3], PAL.sky[3], PAL.snow[3], PAL.pink[2]];

/** The leaders' posts along the street (world x; the camera passes 0.75 px per tick). */
const STATIONS: readonly { who: string; x: number; flip?: boolean }[] = [
  { who: 'blare', x: 360, flip: true },
  { who: 'rimshot', x: 600 },
  { who: 'puffington', x: 820, flip: true },
  { who: 'pizzicata', x: 1040, flip: true },
];
