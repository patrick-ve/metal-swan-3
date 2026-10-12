/**
 * THE MAESTRO (GDD §10.5 stage 3, m5-c after THE CONSOLE): Grand Marshal Bombastian Fanfaroni in
 * his personal flying conductor's podium — a tiny target with a giant voice. Entity id `maestro`.
 *
 * Spawn: `ctx.spawn('maestro', 322, 84, { left: 0 })` (on the wrecked console's bench). Room
 * coordinates: `left` = the room's left world x (default x − 192), the floor = the terrain under
 * the spawn point (room y 176). Params: `wrecks` (default true: when the room has no
 * `wreck-block` after the first tick, the boss drops the three at room x 72, 192, 312 — the
 * sandbox), `hpScale` (tests).
 *
 * Parts: `speaker-left` 600 · `speaker-right` 600 (optional; C fires from the living ones) ·
 * `podium` 2,400 (the required core, the gem; ×1.5 damage and knifeable while he coughs after
 * BRAVISSIMO!). Intro (≈ 110 ticks, the GDD gag): he drops into his podium, his hat is on fire, he
 * blows it out, the plumes are black. Movement: a figure-eight over the room (360 ticks a loop,
 * y 40–120); he stops for each attack. Attacks: A Baton Lash, C Speaker Volley, B Tempo!, A, C;
 * D BRAVISSIMO! replaces the next attack when the podium < 1,200 (at most every 600 ticks).
 * Death (360): `BRAVISSI—` cracks into a `*squeak*`, the podium sputters down, every pipe plays a
 * note on its own, the room starts to fall apart and Fanfaroni floats up and away under his
 * bicorne. Score 100,000. (The players' auto-run to Gramps's Trumpeter is the mission's.)
 */
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { debris, dust, explosion, musicNotes, smokeTrail } from '../../../fx';
import { defineEntity, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { POSE } from './art-console';
import { BossBeam, noteShot, playSong, Scream, SHOT } from './common';
import { MAESTRO, ROOM, SPEAKER_NAMES } from './geom';

const ART = 'boss/maestro';
export const MAESTRO_NAME = 'THE MAESTRO';
export const MAESTRO_SUBTITLE = 'GRAND MARSHAL BOMBASTIAN FANFARONI';
const DEG = Math.PI / 180;
const SCREAM_TEXT = 'BRAVISSIMO...';

const drawOpts: DrawOpts = {};
const hitOpts: DrawOpts = { tint: PAL.snow[3], alpha: 0.35 };
const glowOpts: DrawOpts = { alpha: 0.35, blend: 'add' };

type Mode = 'intro' | 'fly' | 'hold' | 'dying';

export class Maestro extends Boss {
  readonly roomLeft: number;
  readonly roomTop: number;
  readonly podium: BossPart;
  readonly wings: BossPart[] = [];
  mode: Mode = 'intro';
  /** Podium centre (room coordinates). */
  ax: number;
  ay: number;
  /** Figure-eight phase (radians). */
  theta = 0;
  pose: number = POSE.dangleA;
  /** Fanfaroni's feet offset over the podium (intro drop, death). */
  manDY = 0;
  manGone = false;
  chute = false;
  /** Speaker cone pulse ticks per wing. */
  readonly pulse = [0, 0];
  /** Baton Lash preview arc (radians) while > 0 ticks. */
  arcT = 0;
  arcA0 = 0;
  arcA1 = 0;
  /** Tempo! ticks left (cooldowns × 0.8, the fast song). */
  tempoT = 0;
  /** BRAVISSIMO! telegraph: letters shown (0 = none) and the safe-floor glow. */
  screamLetters = 0;
  safeGlow = 0;
  /** Coughing (D recovery): the podium takes ×1.5 and is knifeable. */
  hoarse = false;
  lastD = -100000;
  /** Attacks done (tests). */
  readonly done: Record<string, number> = { lash: 0, tempo: 0, volley: 0, bravissimo: 0 };
  private readonly wantWrecks: boolean;
  private turn = 0;
  private speech: string | null = null;
  private speechT = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: MAESTRO_NAME, hp: 1, score: MAESTRO.score });
    this.facing = 1;
    this.z = 34;
    const left = paramNum(p, 'left', NaN);
    this.roomLeft = Number.isFinite(left) ? left : x - 192;
    const floor = world.terrain.surfaceY(x, y - 8, Infinity);
    this.roomTop = (Number.isFinite(floor) ? floor : y + 92) - ROOM.floor;
    this.wantWrecks = paramBool(p, 'wrecks', true);
    const k = Math.max(0.01, paramNum(p, 'hpScale', 1));
    const P = MAESTRO.parts;
    for (const n of SPEAKER_NAMES) this.wings.push(this.addPart(n, { box: P[n], hp: MAESTRO.hp.speaker * k }));
    this.podium = this.addPart('podium', { box: P.podium, hp: MAESTRO.hp.podium * k, required: true });
    this.ax = Math.max(40, Math.min(ROOM.w - 40, x - this.roomLeft));
    this.ay = Math.max(40, Math.min(130, y - this.roomTop - 14));
    this.phaseIntermission = 0;
    this.phases = [{ at: 1, name: 'solo', pattern: (b) => b.solo() }];
    this.place();
  }

  place(): void {
    this.facing = 1;
    this.x = this.roomLeft + this.ax;
    this.y = this.roomTop + this.ay;
  }

  rx(x: number): number {
    return this.roomLeft + x;
  }

  ry(y: number): number {
    return this.roomTop + y;
  }

  /** The baton tip / mouth in world coordinates (approximate frame points). */
  private faceDir(): number {
    const t = this.world.nearestPlayer(this.x, this.y);
    return t && t.x < this.x ? -1 : 1;
  }

  mouth(out: [number, number]): [number, number] {
    out[0] = this.x + this.faceDir() * 4;
    out[1] = this.y + MAESTRO.mouthDY + this.manDY;
    return out;
  }

  private readonly tmpPt: [number, number] = [0, 0];

  // ------------------------------------------------------------------------------- intro

  override *intro(): ScriptGen {
    this.mode = 'intro';
    yield 1;
    if (this.wantWrecks) {
      let any = false;
      for (const e of this.world.entities) if (e.type === 'wreck-block' && !e.removed) any = true;
      if (!any) for (const wx of [72, 192, 312]) this.world.spawn('wreck-block', this.rx(wx), this.ry(ROOM.floor), { drop: true });
    }
    // He drops into his podium from above.
    this.manDY = -120;
    for (let t = 0; t < 26; t++) {
      this.manDY = Math.min(0, this.manDY + 5);
      this.pose = (t >> 2) & 1 ? POSE.dangleA : POSE.dangleB;
      yield;
    }
    this.manDY = 0;
    this.world.audio.sfx('hit/drum', { vol: 0.7, pitch: 0.7 });
    this.world.camera.shake(2, 8);
    // The gag: his hat is on fire; he blows it out; the plumes are black now.
    this.say('MY HAT! MY MAGNIFICENT HAT!', { at: [0, -60], ticks: 60 });
    for (let t = 0; t < 46; t++) {
      this.pose = (t >> 2) & 1 ? POSE.fireA : POSE.fireB;
      if (t % 6 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-8, 8), this.y - 50, true);
      yield;
    }
    this.pose = POSE.blow;
    this.world.audio.sfx('player/helium-deflate', { vol: 0.6 });
    smokeTrail(this.world, this.x, this.y - 52, true);
    smokeTrail(this.world, this.x + 4, this.y - 56, true);
    yield 20;
    this.pose = POSE.glint;
    this.say('NOW... THE SOLO!', { at: [0, -60], ticks: 70 });
    yield 20;
    this.pose = POSE.stand;
    this.mode = 'fly';
  }

  // ------------------------------------------------------------------------------- attack loop

  private get cool(): number {
    return this.tempoT > 0 ? 0.8 : 1;
  }

  private podiumLow(): boolean {
    return this.podium.hp < (this.podium.maxHp * MAESTRO.dBelow) / MAESTRO.hp.podium;
  }

  *solo(): ScriptGen {
    const order: Array<() => ScriptGen> = [() => this.batonLash(), () => this.speakerVolley(), () => this.tempo(), () => this.batonLash(), () => this.speakerVolley()];
    yield 40;
    for (;;) {
      // Fly between attacks (the figure-eight).
      this.mode = 'fly';
      yield Math.round(this.recoveryFor(70) * this.cool);
      this.mode = 'hold';
      if (this.podiumLow() && this.world.tick - this.lastD >= MAESTRO.dEvery) {
        this.lastD = this.world.tick;
        yield* this.bravissimo();
      } else yield* order[this.turn++ % order.length]();
    }
  }

  /** A — Baton Lash: the baton glints and an arc previews the sweep (T 30), a 120° beam sweep. */
  *batonLash(): ScriptGen {
    const tel = this.telegraphFor(30);
    const o = this.lashOrigin();
    const t = this.world.nearestPlayer(o[0], o[1]);
    const c = t ? Math.atan2(t.y - 16 - o[1], t.x - o[0]) : Math.PI / 2;
    const dir = t && t.x < o[0] ? -1 : 1;
    // Sweep from above the player down through him (the baton comes down like a downbeat).
    this.arcA0 = c - dir * 60 * DEG;
    this.arcA1 = c + dir * 60 * DEG;
    this.arcT = tel;
    this.pose = POSE.glint;
    this.world.audio.sfx('enemy/whistle', { vol: 0.5, pitch: 1.8 });
    yield tel;
    this.arcT = 0;
    this.pose = POSE.lash;
    const beam = this.world.add(new BossBeam(this.world, 'baton', 30));
    this.world.audio.sfx('weapon/laser', { vol: 0.7, pitch: 0.7 });
    for (let k = 0; k <= 30; k++) {
      const a = this.arcA0 + ((this.arcA1 - this.arcA0) * k) / 30;
      const q = this.lashOrigin();
      beam.setSegment(q[0], q[1], q[0] + Math.cos(a) * 120, q[1] + Math.sin(a) * 120);
      yield;
    }
    this.done.lash++;
    this.pose = POSE.stand;
    yield Math.round(this.recoveryFor(40) * this.cool);
  }

  lashOrigin(): [number, number] {
    this.tmpPt[0] = this.x + this.faceDir() * 10;
    this.tmpPt[1] = this.y + MAESTRO.feet[1] - 30;
    return this.tmpPt;
  }

  /** B — Tempo!: 4 taps (T 60), then the fast song for 300 ticks and cooldowns × 0.8. */
  *tempo(): ScriptGen {
    const tel = this.telegraphFor(60);
    const step = Math.max(4, Math.floor(tel / 4));
    for (let t = 0; t < tel; t++) {
      this.pose = t % step < step / 2 ? POSE.tap : POSE.stand;
      if (t % step === 0) this.world.audio.sfx(t / step < 3 ? 'machine/metronome-tick' : 'machine/metronome-tock', { vol: 0.8 });
      yield;
    }
    this.pose = POSE.glint;
    this.say('TEMPO!', { at: [0, -60], ticks: 50 });
    if (this.tempoT <= 0) playSong(this.world, 'boss-final-fast', 10);
    this.tempoT = 300;
    this.done.tempo++;
    yield 20;
    this.pose = POSE.stand;
  }

  /** C — Speaker Volley: each living cone pulses (T 24), 5 note-bullets at the player, 2 px/tick. */
  *speakerVolley(): ScriptGen {
    for (let i = 0; i < 2; i++) {
      const w = this.wings[i];
      if (w.destroyed) continue;
      const tel = this.telegraphFor(24);
      this.pulse[i] = tel;
      this.pose = POSE.point;
      this.world.audio.sfx('machine/anthem-crackle', { vol: 0.4, pitch: 1.4 });
      yield tel;
      if (w.destroyed || this.dead) continue;
      const sx = this.x + w.box.x + w.box.w / 2 + (i === 0 ? -4 : 4);
      const sy = this.y + w.box.y + w.box.h / 2;
      const t = this.world.nearestPlayer(sx, sy);
      const base = t ? Math.atan2(t.y - 16 - sy, t.x - sx) : Math.PI / 2;
      const n = this.volleySize(5);
      for (let k = 0; k < n; k++) {
        const a = base + (n > 1 ? (k / (n - 1) - 0.5) * 50 * DEG : 0);
        noteShot(this.world, this, sx, sy, a, 2, { sprite: SHOT.note, type: 'note-bullet' });
      }
      this.world.audio.sfx('enemy/shot', { vol: 0.6, pitch: 1.5 });
      this.done.volley++;
      yield 10;
    }
    this.pose = POSE.stand;
    yield Math.round(this.recoveryFor(30) * this.cool);
  }

  /**
   * D — BRAVISSIMO!: he flies to (192, 50), takes a gigantic breath, his hat lifts and the word
   * grows letter by letter while the floor glows behind the outer wreck blocks (T 60); the scream
   * hits every player whose head he can see. Then he coughs and sinks (R 90: ×1.5, knifeable).
   */
  *bravissimo(): ScriptGen {
    const [tx, ty] = MAESTRO.screamAt;
    for (let t = 0; t < 90; t++) {
      const dx = tx - this.ax;
      const dy = ty - this.ay;
      const d = Math.hypot(dx, dy);
      if (d < 2) break;
      this.ax += (dx / d) * Math.min(3, d);
      this.ay += (dy / d) * Math.min(3, d);
      this.place();
      yield;
    }
    this.ax = tx;
    this.ay = ty;
    this.place();
    const tel = this.telegraphFor(60);
    this.world.audio.sfx('enemy/tuba-inhale', { vol: 0.9, pitch: 0.7 });
    for (let t = 0; t < tel; t++) {
      this.pose = t < tel * 0.45 ? POSE.breath : POSE.scream;
      this.screamLetters = Math.max(1, Math.ceil((t / tel) * SCREAM_TEXT.length));
      this.safeGlow = tel - t;
      yield;
    }
    this.screamLetters = 0;
    this.safeGlow = 0;
    const m = this.mouth(this.tmpPt);
    this.world.add(new Scream(this.world, m[0], m[1]));
    this.world.audio.sfx('boss/scream', { vol: 1 });
    this.world.camera.shake(5, 40);
    this.speech = 'BRAVISSIMO!';
    this.speechT = 48;
    this.done.bravissimo++;
    yield 48;
    // Recovery: he coughs and sinks; the podium is weak.
    this.setHoarse(true);
    const rec = Math.max(90, this.recoveryFor(90));
    const sinkTo = MAESTRO.sinkY - 13;
    for (let t = 0; t < rec; t++) {
      this.pose = POSE.cough;
      if (this.ay < sinkTo) this.ay = Math.min(sinkTo, this.ay + 1.6);
      this.place();
      if (t % 30 === 0) {
        this.world.audio.sfx('swan/squeak', { vol: 0.5, pitch: 0.6 });
        this.say(t === 0 ? '*COUGH* *COUGH*' : '...ahem...', { at: [0, -56], ticks: 26 });
      }
      yield;
    }
    this.setHoarse(false);
    this.pose = POSE.stand;
    // Back up to the figure-eight.
    for (let t = 0; t < 40 && this.ay > 90; t++) {
      this.ay -= 1.5;
      this.place();
      yield;
    }
  }

  setHoarse(on: boolean): void {
    this.hoarse = on;
    this.podium.multiplier = on ? 1.5 : 1;
    this.podium.knifeable = on;
    if (on) this.addTag('soft');
    else this.removeTag('soft');
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    if (this.mode === 'fly') {
      const e = MAESTRO.eight;
      this.theta += (Math.PI * 2) / e.loop;
      const tx = e.cx + Math.sin(this.theta) * e.ax;
      const ty = e.cy + Math.sin(this.theta * 2) * e.ay;
      // Ease toward the curve (he may have stopped elsewhere for an attack).
      this.ax += Math.max(-1.6, Math.min(1.6, tx - this.ax));
      this.ay += Math.max(-1.6, Math.min(1.6, ty - this.ay));
    }
    this.place();
    if (this.arcT > 0) this.arcT--;
    for (let i = 0; i < 2; i++) if (this.pulse[i] > 0) this.pulse[i]--;
    if (this.speechT > 0) this.speechT--;
    if (this.tempoT > 0 && --this.tempoT === 0 && !this.dead) playSong(this.world, 'boss-final', 20);
    if (this.mode !== 'intro' && this.ay > 96 && this.world.tick % 4 === 0) dust(this.world, this.x, this.ry(ROOM.floor), 1);
  }

  protected override onPartBroken(p: BossPart): void {
    if (p.name.startsWith('speaker')) {
      this.world.audio.sfx('machine/anthem-crackle', { vol: 0.8, pitch: 0.5 });
      this.say('MY SPEAKER!', { at: [0, -60], ticks: 50 });
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.mode = 'dying';
    this.arcT = 0;
    this.screamLetters = 0;
    this.safeGlow = 0;
    this.setHoarse(false);
    this.hush();
    if (this.tempoT > 0) this.tempoT = 0;
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    return (function* finale(): ScriptGen {
      const w = self.world;
      self.pose = POSE.scream;
      self.say('BRAVISSI-', { at: [0, -60], ticks: 50 });
      w.audio.sfx('boss/scream', { vol: 0.8, pitch: 1.1 });
      yield 50;
      self.pose = POSE.squeak;
      w.audio.sfx('boss/voice-crack', { vol: 1 });
      self.say('*squeak*', { at: [0, -50], ticks: 60 });
      playSong(w, null, 60);
      yield 40;
      // The podium sputters down; every pipe plays one note on its own; the room comes apart.
      let vy = 0;
      const floorY = self.restY();
      for (let t = 0; t < 170; t++) {
        if (t % 12 === 0) {
          const px = self.rx(w.fxRng.range(8, 376));
          w.audio.sfx('boss/organ-chord', { vol: 0.35, pitch: 0.5 + w.fxRng.range(0, 1.2) });
          musicNotes(w, px, self.ry(w.fxRng.range(40, 120)), 2);
        }
        if (t % 9 === 0) debris(w, self.rx(w.fxRng.range(8, 376)), self.ry(4), w.fxRng.range(0, 1) < 0.5 ? 'wood' : 'metal', 3);
        if (t % 20 === 0) w.camera.shake(3, 12);
        if (t % 5 === 0) smokeTrail(w, self.x, self.y + 10, true);
        // Sputter: little hops while sinking.
        vy = t % 24 === 0 ? -0.9 : Math.min(1.6, vy + 0.12);
        self.ay = Math.min(floorY, self.ay + vy);
        self.place();
        yield;
      }
      explosion(w, self.x, self.y, 'l', { debris: 'metal' });
      w.audio.sfx('machine/piano-crash', { vol: 0.8 });
      // Out he pops, opens his bicorne like a parachute, and an organ gust carries him away.
      self.chute = true;
      self.pose = POSE.dangleA;
      self.say('THIS IS NOT THE END! IT IS... AN INTERMISSION!', { at: [0, -80], ticks: 90 });
      for (let t = 0; t < 100; t++) {
        self.manDY -= 0.6 + t * 0.03;
        self.pose = (t >> 3) & 1 ? POSE.dangleA : POSE.dangleB;
        if (t === 10) w.audio.sfx('env/wind', { vol: 0.7 });
        yield;
      }
      self.manGone = true;
    })();
  }

  /** Where the dying podium comes to rest (room y of its centre): the floor or a wreck block's top. */
  restY(): number {
    let top: number = ROOM.floor;
    for (const e of this.world.entities) {
      if (e.type !== 'wreck-block' || e.removed) continue;
      const r = (e as { solidRect?: { x: number; y: number; w: number } | null }).solidRect;
      if (r && this.x + 22 > r.x && this.x - 22 < r.x + r.w) top = Math.min(top, r.y - this.roomTop);
    }
    return top - 14;
  }

  // ------------------------------------------------------------------------------- draw

  private piece(r: Renderer, id: string, frame: number, x: number, y: number, flash = false): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(id, frame, Math.round(x), Math.round(y), drawOpts);
    if (flash) r.sprite(id, frame, Math.round(x), Math.round(y), hitOpts);
  }

  override draw(r: Renderer): void {
    if (this.state === 'done') return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const tick = this.world.tick;
    // Safe-floor glow behind the outer wreck blocks (BRAVISSIMO! telegraph).
    if (this.safeGlow > 0) {
      for (const [a, b] of MAESTRO.safe) {
        const gx = this.rx(a);
        const fy = this.ry(ROOM.floor);
        r.rect(gx, fy - 40, b - a, 40, PAL.gold[2], glowOpts);
        r.rect(gx, fy - 2, b - a, 2, (tick >> 2) & 1 ? PAL.gold[3] : PAL.snow[3]);
      }
    }
    // Baton Lash preview: a dotted arc at the beam's reach.
    if (this.arcT > 0 && (tick >> 1) & 1) {
      const o = this.lashOrigin();
      for (let k = 0; k <= 24; k++) {
        const a = this.arcA0 + ((this.arcA1 - this.arcA0) * k) / 24;
        r.rect(Math.round(o[0] + Math.cos(a) * 120) - 1, Math.round(o[1] + Math.sin(a) * 120) - 1, 2, 2, PAL.gold[3]);
      }
      r.line(Math.round(o[0]), Math.round(o[1]), Math.round(o[0] + Math.cos(this.arcA0) * 120), Math.round(o[1] + Math.sin(this.arcA0) * 120), PAL.gold[1]);
    }
    const dying = this.mode === 'dying';
    // Jet, wings, podium.
    if (!(dying && this.chute)) {
      const sputter = dying && (tick >> 2) % 3 === 0;
      if (!sputter) this.piece(r, `${ART}/jet`, (tick >> 2) % 3, x, y + 12);
    }
    for (let i = 0; i < 2; i++) {
      const p = this.wings[i];
      const b = p.box;
      if (p.destroyed) this.piece(r, `${ART}/${p.name}-2`, 2, x + b.x, y + b.y);
      else this.piece(r, this.partSpriteId(p), this.pulse[i] > 0 && (tick >> 2) & 1 ? 1 : 0, x + b.x, y + b.y, p.flash > 2);
    }
    const pod = this.podium;
    const glow = this.hoarse || (tick >> 4) & 1 ? 1 : 0;
    this.piece(r, `${ART}/podium-${this.dead ? 2 : this.partState(pod)}`, glow, x, y, pod.flash > 2);
    // Fanfaroni on top.
    if (!this.manGone) {
      const fx = x;
      const fy = y + MAESTRO.feet[1] + Math.round(this.manDY);
      const flip = this.faceDir() < 0;
      if (this.chute) r.sprite(`${ART}/hat-chute`, 0, fx, fy - 26, {});
      r.sprite(`${ART}/fanfaroni`, this.pose, fx, fy, { flipX: flip });
    }
    // BRAVISSIMO... growing letter by letter, and the scream word.
    if (this.screamLetters > 0) {
      r.text(SCREAM_TEXT.slice(0, this.screamLetters), x, Math.max(this.ry(12), y - 78), { font: 'big', color: (tick >> 2) & 1 ? PAL.gold[3] : PAL.red[3], align: 'center', screen: false, shadow: PAL.ink[0] });
    } else if (this.speech && this.speechT > 0) {
      r.text(this.speech, x, Math.max(this.ry(4), y - 82 - (48 - this.speechT) * 0.3), { font: 'big', color: PAL.snow[3], align: 'center', screen: false, shadow: PAL.red[1] });
    }
  }
}

defineEntity('maestro', (w, x, y, p) => new Maestro(w, x, y, p), {
  category: 'boss',
  score: MAESTRO.score,
  description: 'THE MAESTRO (m5 final boss stage 3): Fanfaroni in his flying podium; param left = room x. Parts speaker-left/right, podium. Needs the three wreck blocks (drops them when missing).',
});
