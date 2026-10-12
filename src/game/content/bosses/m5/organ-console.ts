/**
 * THE CONSOLE (GDD §10.5 stage 2, m5-c, on foot): Fanfaroni plays the organ console himself. The
 * three keyboards are three tiers of one-way platforms (the mission's `m5-console-tier`s) and a
 * giant sheet-music screen above the room SHOWS THE SCORE of the next attacks: the telegraph is
 * the sheet music. Entity id `organ-console`; it never moves or flips.
 *
 * Spawn (m5-c, a single 384×216 screen): `ctx.spawn('organ-console', 232, 176, { left: 0 })` — at
 * the console's foot. Room coordinates: `left` = the room's left world x (default x − 232), the
 * floor = the terrain under the spawn point (room y 176). Params: `tiers` (default true: when no
 * `m5-console-tier` exists after the first tick and the type is registered, the boss builds the
 * three tiers itself — the sandbox), `wrecks` (default true: the death drops the three
 * `wreck-block`s unless the room already has some), `hpScale` (tests).
 *
 * Parts: `pipe-bank-left` 1,500 · `pipe-bank-right` 1,500 (one bank required) · `console` 3,000
 * (the music stand; required; shots ping off it until one bank is destroyed). The bar shows the
 * weaker living bank (until one is gone) + the console.
 *
 * THE SCORE runs all stage: one symbol per 32-tick beat; notes appear 128 px right of the NOW bar
 * and scroll left (2 px/tick, 3 in phase 2); at NOW the lane is blasted across the room for 20
 * ticks (`lane-blast`). Phase 1 "Overture": phrases 1, 2, 1, 3 + A Pedal Notes (a floor shockwave,
 * never on a floor-note beat). Intermission (60): he rips the page out and starts a fugue.
 * Phase 2 "Fugue": phrases 2, 3, 4, 3 at 3 px/tick + B Stop Pull (TRUMPET / FLUTE / PICCOLO /
 * BOMBARDE). Death (150): the console explodes and throws Fanfaroni through the roof; the tiers
 * fall away; three wreck blocks land at room x 72, 192, 312. Score 40,000. The wreck stays.
 */
import type { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { debris, explosion, musicNotes, smokeTrail } from '../../../fx';
import { defineEntity, hasEntity, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { HomingNote, isHard, NoteBomb, PedalWave, spawnRectBeam } from './common';
import { POSE } from './art-console';
import { BANK_NAMES, BEAT, CONSOLE, NOTE_LEAD, PHRASE_LOOP, PHRASES, ROOM } from './geom';

const ART = 'boss/organ-console';
export const CONSOLE_NAME = 'THE CONSOLE';
export const CONSOLE_SUBTITLE = 'HIS LOUDNESS WILL NOW PERFORM';
export const STOPS = ['TRUMPET', 'FLUTE', 'PICCOLO', 'BOMBARDE'] as const;
export type StopLabel = (typeof STOPS)[number];

const drawOpts: DrawOpts = {};
const hitOpts: DrawOpts = { tint: PAL.snow[3], alpha: 0.35 };
const cueOpts: DrawOpts = { alpha: 0.3, blend: 'add' };

/** A note on the sheet screen. */
interface Note {
  active: boolean;
  /** Lane bit mask (1 floor, 2 tier 1, 4 tier 2, 8 tier 3). */
  mask: number;
  age: number;
  speed: number;
}

const NOTES = 16;

export class OrganConsole extends Boss {
  readonly roomLeft: number;
  readonly roomTop: number;
  readonly banks: BossPart[] = [];
  readonly stand: BossPart;
  readonly notes: Note[] = [];
  /** Beat clock of the score (counts down to the next beat). */
  beatT = 0;
  phraseI = 0;
  beatI = 0;
  noteSpeed = 2;
  /** The score is playing (false before the fight and during intermissions). */
  scoreOn = false;
  /** Lane blasts fired (tests). */
  blasts = 0;
  lastFloorBlast = -1000;
  pose: number = POSE.playA;
  poseT = 0;
  pedalDown = 0;
  /** Stop knob: label and how far it is out (0..2). */
  knobLabel: StopLabel | null = null;
  knobOut = 0;
  private stopTurn = 0;
  /** Fanfaroni during the death: flung (room coords) or gone. */
  private flung = false;
  private flingX = 0;
  private flingY = 0;
  private flingVy = 0;
  private wrecked = false;
  private readonly wantTiers: boolean;
  private readonly wantWrecks: boolean;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: CONSOLE_NAME, hp: 1, score: CONSOLE.score });
    this.facing = 1;
    this.z = 24;
    const left = paramNum(p, 'left', NaN);
    this.roomLeft = Number.isFinite(left) ? left : x - CONSOLE.spawnX;
    const floor = world.terrain.surfaceY(x, y - 24, y + 64);
    this.roomTop = (Number.isFinite(floor) ? floor : y) - ROOM.floor;
    this.wantTiers = paramBool(p, 'tiers', true);
    this.wantWrecks = paramBool(p, 'wrecks', true);
    const k = Math.max(0.01, paramNum(p, 'hpScale', 1));
    const P = CONSOLE.parts;
    for (const n of BANK_NAMES) this.banks.push(this.addPart(n, { box: P[n], hp: CONSOLE.hp.bank * k }));
    this.stand = this.addPart('console', { box: P.console, hp: CONSOLE.hp.console * k, required: true, armored: true });
    this.refreshRequiredHp();
    for (let i = 0; i < NOTES; i++) this.notes.push({ active: false, mask: 0, age: 0, speed: 2 });
    this.phaseIntermission = 60;
    this.phases = [
      { at: 1, name: 'overture', onEnter: (b) => b.startScore(0), pattern: (b) => b.overture() },
      {
        name: 'fugue',
        when: (b) => b.brokenCount(BANK_NAMES) >= 1,
        onEnter: (b) => b.toFugue(),
        pattern: (b) => b.fugue(),
      },
    ];
    this.x = this.roomLeft;
    this.y = this.roomTop;
  }

  /** World x / y of a room point. */
  rx(x: number): number {
    return this.roomLeft + x;
  }

  ry(y: number): number {
    return this.roomTop + y;
  }

  protected override refreshRequiredHp(): void {
    if (!this.banks || this.banks.length < 2 || !this.parts[2]) {
      super.refreshRequiredHp();
      return;
    }
    const st = this.parts[2];
    let hp = Math.max(0, st.hp);
    const a = this.banks[0];
    const b = this.banks[1];
    if (!a.destroyed && !b.destroyed) hp += Math.min(a.hp, b.hp);
    this.hp = hp;
    this.maxHp = a.maxHp + st.maxHp;
  }

  // ------------------------------------------------------------------------------- intro

  override *intro(): ScriptGen {
    yield 1;
    this.ensureTiers();
    // He turns on his bench, cracks his knuckles and plays the opening chord.
    for (let t = 0; t < 90; t++) {
      this.pose = t < 40 ? POSE.flourish : t < 60 ? POSE.playA : POSE.playB;
      if (t === 60) {
        this.world.audio.sfx('boss/organ-chord', { vol: 0.9, pitch: 0.75 });
        musicNotes(this.world, this.rx(320), this.ry(50), 4);
        this.world.camera.shake(2, 20);
      }
      yield;
    }
  }

  /** Build the three tiers in a room without them (sandbox, tests). */
  ensureTiers(): void {
    if (!this.wantTiers || !hasEntity('m5-console-tier')) return;
    for (const e of this.world.entities) if (e.type === 'm5-console-tier' && !e.removed) return;
    CONSOLE.tiers.forEach((t, i) => this.world.spawn('m5-console-tier', this.rx(t.x), this.ry(t.y), { w: t.w, level: i }));
  }

  // ------------------------------------------------------------------------------- the score

  startScore(phase: 0 | 1): void {
    this.phraseI = 0;
    this.beatI = 0;
    this.beatT = 1;
    this.noteSpeed = phase === 0 ? 2 : 3;
    this.scoreOn = true;
  }

  /** Phase 2: the console can be hurt, the notes speed up, the score restarts after the gag. */
  toFugue(): void {
    for (const n of this.notes) n.active = false;
    this.scoreOn = false;
    this.stand.armored = false;
    this.knobLabel = null;
    this.say('ENOUGH OVERTURE. A FUGUE!', { at: [CONSOLE.seat[0] - 6, CONSOLE.seat[1] - 44], ticks: 90 });
    this.world.audio.sfx('crate/break', { vol: 0.5, pitch: 1.6 });
  }

  private updateScore(): void {
    if (!this.scoreOn || this.invulnTicks > 0 || this.state !== 'fight') return;
    if (--this.beatT <= 0) {
      this.beatT = BEAT;
      const loop = PHRASE_LOOP[this.noteSpeed === 2 ? 0 : 1];
      const phrase = PHRASES[loop[this.phraseI % loop.length]];
      const sym = phrase[this.beatI];
      if (sym.length > 0) {
        let mask = 0;
        for (const l of sym) mask |= 1 << l;
        // HARD: a third lane on chords (one lane always stays safe).
        if (sym.length === 2 && isHard(this.world)) {
          const free: number[] = [];
          for (let l = 0; l < 4; l++) if (!(mask & (1 << l))) free.push(l);
          mask |= 1 << this.world.rng.pick(free);
        }
        this.addNote(mask);
      }
      if (++this.beatI >= phrase.length) {
        this.beatI = 0;
        this.phraseI++;
      }
    }
    for (const n of this.notes) {
      if (!n.active) continue;
      n.age++;
      if (n.age * n.speed >= NOTE_LEAD) {
        n.active = false;
        this.blastLanes(n.mask);
      }
    }
  }

  private addNote(mask: number): void {
    for (const n of this.notes) {
      if (n.active) continue;
      n.active = true;
      n.mask = mask;
      n.age = 0;
      n.speed = this.noteSpeed;
      return;
    }
  }

  /** Ticks until the next floor note fires (Infinity: none queued). */
  nextFloorBlast(): number {
    let best = Infinity;
    for (const n of this.notes) if (n.active && n.mask & 1) best = Math.min(best, Math.ceil((NOTE_LEAD - n.age * n.speed) / n.speed));
    return best;
  }

  blastLanes(mask: number): void {
    for (let l = 0; l < 4; l++) {
      if (!(mask & (1 << l))) continue;
      const [y0, y1] = CONSOLE.bands[l];
      spawnRectBeam(this.world, 'lane', this.rx(0), this.ry(y0), ROOM.w, y1 - y0, 20);
      this.world.audio.sfx('boss/organ-chord', { vol: 0.55, pitch: 0.7 + l * 0.18 });
      this.blasts++;
      if (l === 0) this.lastFloorBlast = this.world.tick;
    }
    this.pose = this.pose === POSE.playA ? POSE.playB : POSE.playA;
    this.poseT = 10;
  }

  // ------------------------------------------------------------------------------- phase 1

  *overture(): ScriptGen {
    yield 60;
    for (;;) {
      yield* this.pedalNotes();
      yield this.recoveryFor(90);
    }
  }

  /** A — Pedal Notes: his feet slam the pedals (T 30), a floor shockwave runs to the left wall. */
  *pedalNotes(): ScriptGen {
    // Never on the same beat as a floor note.
    for (let i = 0; i < 120; i++) {
      const next = this.nextFloorBlast();
      const since = this.world.tick - this.lastFloorBlast;
      const tel = this.telegraphFor(30);
      if ((next < tel - BEAT / 2 || next > tel + BEAT) && since > 24) break;
      yield 4;
    }
    const tel = this.telegraphFor(30);
    for (let t = 0; t < tel; t++) {
      this.pose = POSE.kick;
      this.poseT = 2;
      this.pedalDown = t % 10 < 5 ? 1 : 0;
      if (t % 10 === 0) this.world.audio.sfx('hit/drum', { vol: 0.5, pitch: 0.6 });
      yield;
    }
    this.pedalDown = 1;
    const pd = CONSOLE.pedals;
    this.world.add(new PedalWave(this.world, this.rx(pd.x - 4), this.ry(ROOM.floor), -2.5, this.rx(40)));
    this.world.audio.sfx('boss/organ-chord', { vol: 0.8, pitch: 0.4 });
    this.world.camera.shake(3, 12);
    yield 8;
    this.pedalDown = 0;
    yield this.recoveryFor(30);
  }

  // ------------------------------------------------------------------------------- phase 2

  *fugue(): ScriptGen {
    this.startScore(1);
    yield 90;
    for (;;) {
      yield* this.stopPull(STOPS[this.stopTurn++ % STOPS.length]);
      yield this.recoveryFor(60);
    }
  }

  /** B — Stop Pull: he pulls a big labelled stop knob (T 40), then the stop plays. */
  *stopPull(label: StopLabel): ScriptGen {
    const tel = this.telegraphFor(40);
    this.knobLabel = label;
    this.world.audio.sfx('boss/trombone-pull', { vol: 0.6, pitch: 1.3 });
    for (let t = 0; t < tel; t++) {
      this.pose = POSE.pull;
      this.poseT = 2;
      this.knobOut = Math.min(2, Math.floor((t / tel) * 3));
      yield;
    }
    this.knobOut = 2;
    this.world.audio.sfx('boss/organ-chord', { vol: 0.7, pitch: label === 'BOMBARDE' ? 0.5 : label === 'PICCOLO' ? 1.6 : 1 });
    switch (label) {
      case 'TRUMPET':
        for (let i = 0; i < 2; i++) {
          if (this.countType('rifleman') < 4) this.world.spawn('rifleman', this.rx(8), this.ry(ROOM.floor), { facing: 1, enter: 'left' });
          yield 24;
        }
        break;
      case 'FLUTE': {
        const n = this.volleySize(3);
        const sx = this.rx(CONSOLE.parts.console.x + 4);
        const sy = this.ry(CONSOLE.parts.console.y + 14);
        for (let i = 0; i < n; i++) {
          HomingNote.fire(this.world, this, sx, sy, Math.PI + (i - (n - 1) / 2) * 0.5);
          yield 6;
        }
        break;
      }
      case 'PICCOLO':
        if (this.countType('piccolo') === 0) {
          const t3 = CONSOLE.tiers[2];
          const y = this.tierSolidAt(this.rx(200)) ?? this.ry(ROOM.floor);
          this.world.spawn('piccolo', this.rx(200), y, { facing: -1 });
          debris(this.world, this.rx(200), this.ry(t3.y - 20), 'wood', 4);
        }
        break;
      case 'BOMBARDE': {
        const n = this.volleySize(4);
        const t = this.world.nearestPlayer(this.rx(192), this.ry(120));
        const px = t ? t.x : this.rx(120);
        for (let i = 0; i < n; i++) {
          const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * (28 + ((i - 1) >> 1) * 36) + this.world.rng.range(-6, 6);
          const bx = Math.max(this.rx(48), Math.min(this.rx(336), px + off));
          NoteBomb.drop(this.world, this, bx, this.landingY(bx), this.telegraphFor(40));
          yield 8;
        }
        break;
      }
    }
    yield 20;
    this.knobOut = 0;
    this.knobLabel = null;
  }

  private countType(type: string): number {
    let n = 0;
    for (const e of this.world.entities) if (e.type === type && e.alive) n++;
    return n;
  }

  /** Top of a one-way tier solid over x (null: none). */
  private tierSolidAt(x: number): number | null {
    let best: number | null = null;
    for (const s of this.world.solids) {
      if (!s.enabled || x < s.x || x > s.x + s.w) continue;
      if (s.y < this.ry(40) || s.y > this.ry(ROOM.floor - 4)) continue;
      if (best === null || s.y < best) best = s.y;
    }
    return best;
  }

  /** Where a falling bomb lands at x: the highest tier or wreck over x, else the floor. */
  landingY(x: number): number {
    const t = this.tierSolidAt(x);
    if (t !== null) return t;
    const g = this.world.terrain.surfaceY(x, this.ry(40), this.ry(ROOM.floor + 40));
    return Number.isFinite(g) ? g : this.ry(ROOM.floor);
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    this.x = this.roomLeft;
    this.y = this.roomTop;
    this.updateScore();
    if (this.poseT > 0) this.poseT--;
    else if (this.state === 'fight' || this.state === 'waiting') {
      const fast = this.scoreOn ? 8 : 16;
      this.pose = (this.world.tick / fast) & 1 ? POSE.playA : POSE.playB;
    }
    if (this.state === 'fight' && this.world.tick % 50 === 0) musicNotes(this.world, this.rx(318), this.ry(60), 1);
  }

  protected override onPartBroken(p: BossPart): void {
    if (p.name.startsWith('pipe-bank')) {
      this.world.audio.sfx('boss/organ-chord', { vol: 0.8, pitch: 0.45 });
      const r = p.box;
      for (let i = 0; i < 4; i++) debris(this.world, this.rx(r.x + r.w / 2), this.ry(r.y + 20 + i * 30), 'metal', 4);
      this.refreshRequiredHp();
      this.checkPhases();
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.scoreOn = false;
    for (const n of this.notes) n.active = false;
    this.knobLabel = null;
    this.removeOnDeath = false;
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    return (function* consoleDown(): ScriptGen {
      const w = self.world;
      const cx = self.rx(316);
      const cy = self.ry(64);
      for (let t = 0; t < 40; t++) {
        if (t % 6 === 0) explosion(w, cx + w.rng.range(-24, 24), cy + w.rng.range(-20, 50), t % 18 === 0 ? 'm' : 's', { silent: t % 12 !== 0, shake: 2 });
        yield;
      }
      // The big blast throws him through the roof.
      explosion(w, cx, cy, 'l', { debris: 'wood' });
      w.audio.sfx('boss/organ-chord', { vol: 1, pitch: 0.42 });
      self.wrecked = true;
      self.flung = true;
      self.flingX = CONSOLE.seat[0];
      self.flingY = CONSOLE.seat[1];
      self.flingVy = -5;
      self.say('MY CONSOLE! MY BEAUTIFUL CONSOLE!', { at: [CONSOLE.seat[0], CONSOLE.seat[1] - 50], ticks: 70 });
      for (let t = 0; t < 110; t++) {
        if (self.flung) {
          self.flingY += self.flingVy;
          self.flingVy += 0.05;
          self.flingX -= 0.6;
          if (self.flingY < -60) self.flung = false;
        }
        if (t === 20) self.collapseTiers();
        if (t === 40 && self.wantWrecks) self.dropWrecks();
        if (t % 8 === 0) smokeTrail(w, self.rx(300 + w.fxRng.range(0, 40)), self.ry(60 + w.fxRng.range(0, 100)), true);
        if (t % 15 === 0) musicNotes(w, self.rx(w.fxRng.range(10, 370)), self.ry(w.fxRng.range(40, 120)), 1);
        yield;
      }
    })();
  }

  /** The keyboard tiers fall away (duck-typed `collapse()` of the mission's tiers). */
  collapseTiers(): void {
    for (const e of this.world.entities) {
      if (e.type !== 'm5-console-tier' || e.removed) continue;
      const c = (e as Entity & { collapse?: () => void }).collapse;
      if (typeof c === 'function') c.call(e);
    }
  }

  /** The three wreck blocks land (unless the room already has some). */
  dropWrecks(): void {
    for (const e of this.world.entities) if (e.type === 'wreck-block' && !e.removed) return;
    for (const x of CONSOLE.wrecks) this.world.spawn('wreck-block', this.rx(x), this.ry(ROOM.floor), { drop: true });
  }

  protected override onDefeated(): void {
    this.removeTag('enemy');
    this.removeTag('shootable');
    this.removeTag('boss');
  }

  // ------------------------------------------------------------------------------- draw

  private piece(r: Renderer, id: string, frame: number, x: number, y: number, flash = false, flip = false): void {
    drawOpts.flipX = flip;
    drawOpts.flash = false;
    r.sprite(id, frame, Math.round(x), Math.round(y), drawOpts);
    if (flash) {
      // Hit flash: a white wash over the part (never a solid white block).
      hitOpts.flipX = drawOpts.flipX;
      r.sprite(id, frame, Math.round(x), Math.round(y), hitOpts);
    }
  }

  override draw(r: Renderer): void {
    const L = this.roomLeft;
    const T = this.roomTop;
    const tick = this.world.tick;
    const cb = CONSOLE.cabinet;
    if (!this.wrecked) {
      this.piece(r, `${ART}/cabinet`, 0, L + cb.x, T + cb.y);
      const pd = CONSOLE.pedals;
      this.piece(r, `${ART}/pedal`, this.pedalDown, L + pd.x, T + pd.y);
    }
    // Pipe banks.
    for (const p of this.banks) {
      const b = p.box;
      if (p.destroyed) this.piece(r, `${ART}/${p.name}-2`, 1, L + b.x, T + b.y);
      else this.piece(r, this.partSpriteId(p), 0, L + b.x, T + b.y, p.flash > 2);
    }
    this.drawScreen(r);
    // Bench, Fanfaroni, the music stand.
    const [sx, sy] = CONSOLE.seat;
    const st = this.stand;
    const b = st.box;
    if (!this.wrecked) this.piece(r, `${ART}/bench`, 0, L + sx - 18, T + sy + 1);
    if (this.wrecked || st.destroyed) this.piece(r, `${ART}/console-2`, 1, L + b.x, T + b.y);
    else this.piece(r, this.partSpriteId(st), 0, L + b.x, T + b.y, st.flash > 2);
    // Fanfaroni sits behind the right edge of his music stand, facing the room.
    if (!this.wrecked) r.sprite('boss/maestro/fanfaroni', this.pose, Math.round(L + sx + 6), Math.round(T + sy), { flipX: true });
    else if (this.flung) {
      r.sprite('boss/maestro/fanfaroni', (tick >> 3) & 1 ? POSE.thrown : POSE.dangleA, Math.round(L + this.flingX), Math.round(T + this.flingY), { flipX: (tick >> 2) & 1 ? true : false });
    }
    // The stop knob and its label.
    if (this.knobLabel) {
      const [kx, ky] = CONSOLE.knob;
      this.piece(r, `${ART}/knob`, this.knobOut, L + kx, T + ky);
      const col = (tick >> 2) & 1 ? PAL.gold[3] : PAL.snow[3];
      r.rect(L + kx - 66, T + ky + 3, 50, 11, PAL.ink[0]);
      r.text(this.knobLabel, L + kx - 41, T + ky + 5, { color: col, align: 'center', screen: false });
      // The stop's name on the sheet screen too (top right).
      const s = CONSOLE.screen;
      r.text(this.knobLabel, L + s.x + s.w - 30, T + s.y + 3, { color: PAL.red[1], align: 'center', screen: false });
    }
    // In-room cue: the lane about to blast flickers along its edges (last 12 ticks).
    for (const n of this.notes) {
      if (!n.active) continue;
      const left = (NOTE_LEAD - n.age * n.speed) / n.speed;
      if (left > 12 || (tick >> 1) & 1) continue;
      for (let l = 0; l < 4; l++) {
        if (!(n.mask & (1 << l))) continue;
        const [y0, y1] = CONSOLE.bands[l];
        r.rect(L, T + y0, ROOM.w, y1 - y0, PAL.red[2], cueOpts);
      }
    }
  }

  private drawScreen(r: Renderer): void {
    const L = this.roomLeft;
    const T = this.roomTop;
    const s = CONSOLE.screen;
    const tick = this.world.tick;
    this.piece(r, `${ART}/screen`, 0, L + s.x, T + s.y);
    if (this.wrecked) {
      r.line(L + s.x + 20, T + s.y + 2, L + s.x + 120, T + s.y + s.h - 2, PAL.ink[0]);
      r.line(L + s.x + 140, T + s.y + 4, L + s.x + 90, T + s.y + s.h - 3, PAL.ink[0]);
      return;
    }
    // The NOW bar.
    const nx = L + CONSOLE.nowX;
    r.rect(nx, T + s.y + 2, 2, s.h - 3, (tick >> 3) & 1 ? PAL.red[3] : PAL.red[2]);
    // Notes: a black head on each lane's staff line; red in their last 24 px.
    for (const n of this.notes) {
      if (!n.active) continue;
      const d = NOTE_LEAD - n.age * n.speed;
      const x = Math.round(nx + d);
      const hot = d < 24;
      for (let l = 0; l < 4; l++) {
        if (!(n.mask & (1 << l))) continue;
        const y = T + CONSOLE.laneY[l];
        r.rect(x - 2, y - 1, 5, 3, hot ? PAL.red[2] : PAL.ink[0]);
        r.rect(x - 1, y - 2, 3, 5, hot ? PAL.red[2] : PAL.ink[0]);
        r.rect(x + 2, y - 7, 1, 7, hot ? PAL.red[2] : PAL.ink[0]);
      }
    }
  }
}

defineEntity('organ-console', (w, x, y, p) => new OrganConsole(w, x, y, p), {
  category: 'boss',
  score: CONSOLE.score,
  description: 'THE CONSOLE (m5 final boss stage 2): spawn at the console foot (room 232, 176), param left = room x. Parts pipe-bank-left/right, console. The sheet-music screen telegraphs the lane blasts.',
});
