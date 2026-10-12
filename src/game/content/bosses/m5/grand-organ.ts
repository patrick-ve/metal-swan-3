/**
 * THE GRAND ORGAN (GDD §10.5 stage 1, end of m5-a, a shoot-em-up fight in the Trumpeters): a
 * flying cathedral organ with rotors, bellows for lungs, a rose window and a gold loudspeaker
 * horn behind shutters. Entity id `grand-organ`; it never flips.
 *
 * Spawn (m5-a, `LOCK 4016–4400`): `ctx.spawn('grand-organ', 4366, 108, { left: 4016 })`. It flies
 * in VIEW coordinates: the face's left edge at view x 200, its top at view y 8 (drifting ±24 px at
 * 0.3 px/tick). `left` = the arena's left world x (default: the locked view's left edge, else the
 * view's left edge at spawn); the view top is `top` (default the camera top). It enters from the
 * right (≈ 120 ticks, invulnerable). Spawn param `hpScale` (tests, sandbox) scales every part.
 *
 * Parts: `pipes-top`, `pipes-mid`, `pipes-low` 1,000 each (2 of 3 required) · `bellows` 1,500
 * (optional, +5,000 instead of 1,000) · `speaker` 1,200 (required; its shutters open after 2 pipe
 * clusters are destroyed) · `hull` (the casework right of the parts: armoured, contact). The boss
 * bar shows the two weakest living clusters still needed + the speaker.
 *
 * Phase 1 "Rehearsal": A Chord Spray, B Bellows Breath, A; C Kazoo Escort (NORMAL / HARD) every
 * 480 ticks from the hatch. Intermission (60): the shutters creak open. Phase 2 "Dress
 * Rehearsal": D Anthem Beam, A, B. Death (180): the speaker squawks and blows out, the anthem stops
 * on its wrong note, the organ lurches and its blown-out horn becomes the landing hatch: `hatch`
 * (world point) is where the Trumpeters fly in. The wreck stays (removeOnDeath false).
 */
import type { Damage } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import { pushX } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { difficultyOf } from '../../../context';
import { awardScore } from '../../../events';
import { debris, explosion, musicNotes, smokeTrail } from '../../../fx';
import { isPlayer } from '../../../player/player';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { BOSS_TAGS, noteShot, playSong, spawnRectBeam } from './common';
import { ORGAN, PIPE_NAMES } from './geom';

const ART = 'boss/grand-organ';
export const ORGAN_NAME = 'THE GRAND ORGAN';
export const ORGAN_SUBTITLE = "TONIGHT'S PROGRAMME: YOU";
const DEG = Math.PI / 180;

const drawOpts: DrawOpts = {};
const hitOpts: DrawOpts = { tint: PAL.snow[3], alpha: 0.35 };
const glowOpts: DrawOpts = { alpha: 0.5 };
const stripeOpts: DrawOpts = { alpha: 0.35, blend: 'add' };

type Mode = 'enter' | 'drift' | 'hold' | 'wreck';

export class GrandOrgan extends Boss {
  /** View origin (world). */
  readonly fixedLeft: number | null;
  readonly spawnLeft: number;
  readonly fixedTop: number | null;
  mode: Mode = 'enter';
  /** Face top-left in view coordinates. */
  ax = 420;
  ay: number = ORGAN.homeVY;
  driftT = 0;
  /** Shutters 0 closed … 3 open. */
  shutterK = 0;
  private shutterGoal = 0;
  /** Cluster index lit for the Chord Spray telegraph (−1 none). */
  glowCluster = -1;
  glowT = 0;
  /** Bellows frame override (−1 = idle pump). */
  bellowsK = -1;
  /** Speaker glow + the flickering stripe (D telegraph) ticks left. */
  stripeT = 0;
  stripeY = 0;
  speakerGlow = 0;
  hatchOpenT = 0;
  /** Bellows Breath wind ticks left. */
  windT = 0;
  kazooT = 480;
  /** Death: the lurch (px) and the blown-out speaker. */
  lurch = 0;
  private readonly hatchPt = { x: 0, y: 0 };
  readonly pipeParts: BossPart[] = [];
  readonly bellows: BossPart;
  readonly horn: BossPart;
  private clusterTurn = 0;
  private lastOwner = -1;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: ORGAN_NAME, hp: 1, score: ORGAN.score });
    this.facing = 1;
    this.z = 26;
    const left = paramNum(p, 'left', NaN);
    this.fixedLeft = Number.isFinite(left) ? left : null;
    this.spawnLeft = world.camera.left;
    const top = paramNum(p, 'top', NaN);
    this.fixedTop = Number.isFinite(top) ? top : null;
    const k = Math.max(0.01, paramNum(p, 'hpScale', 1));
    const P = ORGAN.parts;
    for (const n of PIPE_NAMES) this.pipeParts.push(this.addPart(n, { box: P[n], hp: ORGAN.hp.pipes * k, contact: true }));
    this.bellows = this.addPart('bellows', { box: P.bellows, hp: ORGAN.hp.bellows * k, contact: true });
    this.horn = this.addPart('speaker', { box: P.speaker, hp: ORGAN.hp.speaker * k, required: true, enabled: false, contact: true });
    this.addPart('hull', { box: P.hull, armored: true, contact: true });
    this.refreshRequiredHp();
    this.contactDamage = { amount: 10, kind: 'impact', dirX: -1, tags: BOSS_TAGS };
    this.removeOnDeath = false;
    this.phaseIntermission = 60;
    this.phases = [
      { at: 1, name: 'rehearsal', pattern: (b) => b.sequence([(o) => o.chordSpray(), (o) => o.bellowsBreath(), (o) => o.chordSpray()], o0(b)) },
      {
        name: 'dress-rehearsal',
        when: (b) => b.brokenCount(PIPE_NAMES) >= 2,
        onEnter: (b) => b.openShutters(),
        pattern: (b) => b.sequence([(o) => o.anthemBeam(), (o) => o.chordSpray(), (o) => o.bellowsBreath()], o0(b)),
      },
    ];
    this.place();
  }

  // ------------------------------------------------------------------------------- geometry

  viewLeft(): number {
    if (this.fixedLeft !== null) return this.fixedLeft;
    const cam = this.world.camera;
    return cam.locked ? cam.left : this.spawnLeft;
  }

  viewTop(): number {
    return this.fixedTop ?? this.world.camera.top;
  }

  place(): void {
    this.facing = 1;
    this.x = this.viewLeft() + this.ax;
    this.y = this.viewTop() + this.ay + this.lurch;
  }

  /** The landing hatch (the blown-out speaker) in world coordinates. */
  get hatch(): { x: number; y: number } {
    const r = ORGAN.parts.speaker;
    this.hatchPt.x = this.x + r.x + r.w / 2 - 6;
    this.hatchPt.y = this.y + r.y + r.h / 2;
    return this.hatchPt;
  }

  /** Bar / phase HP: the speaker + the weakest living clusters still needed (2 of 3). */
  protected override refreshRequiredHp(): void {
    const sp = this.parts[4];
    if (!sp || !this.pipeParts || this.pipeParts.length < 3) {
      super.refreshRequiredHp();
      return;
    }
    let broken = 0;
    const alive: number[] = [];
    for (const p of this.pipeParts) {
      if (p.destroyed) broken++;
      else alive.push(Math.max(0, p.hp));
    }
    alive.sort((a, b) => a - b);
    let hp = Math.max(0, sp.hp);
    for (let i = 0; i < Math.max(0, 2 - broken) && i < alive.length; i++) hp += alive[i];
    this.hp = hp;
    this.maxHp = this.pipeParts[0].maxHp * 2 + sp.maxHp;
  }

  // ------------------------------------------------------------------------------- intro

  override *intro(): ScriptGen {
    this.mode = 'enter';
    const total = 120;
    for (let t = 0; t < total; t++) {
      const k = Math.min(1, t / (total - 10));
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      this.ax = 420 + (ORGAN.homeVX - 420) * e;
      if (t === 20) this.world.audio.sfx('machine/copter', { vol: 0.5, pitch: 0.6 });
      if (t === 50) this.say('TESTING... ONE, TWO... ONE, TWO, THREE, FOUR!', { at: ORGAN.bell, ticks: 90, kind: 'radio' });
      yield;
    }
    this.ax = ORGAN.homeVX;
    this.mode = 'drift';
  }

  // ------------------------------------------------------------------------------- attacks

  private livingClusters(): number[] {
    const out: number[] = [];
    for (let i = 0; i < 3; i++) if (!this.pipeParts[i].destroyed) out.push(i);
    return out;
  }

  /** A — Chord Spray: one cluster lights up (T 30, they take turns), 3 fans of 5 notes. */
  *chordSpray(): ScriptGen {
    const alive = this.livingClusters();
    if (alive.length === 0) {
      yield 10;
      return;
    }
    const c = alive[this.clusterTurn++ % alive.length];
    const name = PIPE_NAMES[c];
    const tel = this.telegraphFor(30);
    this.glowCluster = c;
    this.glowT = tel;
    this.world.audio.sfx('boss/organ-chord', { vol: 0.7, pitch: 0.8 + c * 0.15 });
    yield tel;
    this.glowCluster = -1;
    for (let f = 0; f < 3; f++) {
      if (this.pipeParts[c].destroyed) break;
      const m = ORGAN.mouths[name];
      const sx = this.x + m[0];
      const sy = this.y + m[1];
      const t = this.world.nearestPlayer(sx, sy);
      const base = t ? Math.atan2(t.y - 16 - sy, t.x - sx) : Math.PI;
      const n = this.volleySize(5);
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i / (n - 1) - 0.5) * 40 * DEG : 0);
        noteShot(this.world, this, sx, sy, a, 1.8);
      }
      musicNotes(this.world, sx, sy - 6, 2);
      this.world.audio.sfx('boss/organ-chord', { vol: 0.45, pitch: 1 + f * 0.12 + c * 0.1 });
      yield 20;
    }
    yield this.recoveryFor(40);
  }

  /** B — Bellows Breath: the bellows pull open (T 45), a wind pushes the players left for 60 ticks. */
  *bellowsBreath(): ScriptGen {
    if (this.bellows.destroyed) {
      yield 10;
      return;
    }
    const tel = this.telegraphFor(45);
    for (let t = 0; t < tel; t++) {
      this.bellowsK = Math.min(3, Math.floor((t / tel) * 4));
      if (t === 0) this.world.audio.sfx('enemy/tuba-inhale', { vol: 0.7, pitch: 0.5 });
      if (this.bellows.destroyed) {
        this.bellowsK = -1;
        return;
      }
      yield;
    }
    this.bellowsK = 0;
    this.windT = 60;
    this.world.audio.sfx('env/wind', { vol: 0.8 });
    const n = this.volleySize(6);
    for (let i = 0; i < n; i++) {
      const bx = this.x + ORGAN.parts.bellows.x + 4;
      const by = this.viewTop() + 24 + ((i * 37 + this.world.rng.int(0, 20)) % 168);
      noteShot(this.world, this, bx, by, Math.PI, 1.2, { life: 400 });
      yield 10;
    }
    yield Math.max(0, 60 - n * 10);
    this.bellowsK = -1;
    yield this.recoveryFor(30);
  }

  /** D — Anthem Beam: the speaker glows and a 24 px stripe flickers (T 50), then the beam (40). */
  *anthemBeam(): ScriptGen {
    if (this.horn.destroyed || !this.horn.enabled) {
      yield 10;
      return;
    }
    this.mode = 'hold';
    const tel = this.telegraphFor(50);
    this.stripeT = tel;
    this.speakerGlow = tel;
    this.stripeY = this.y + ORGAN.bell[1];
    this.world.audio.sfx('machine/anthem-crackle', { vol: 0.8 });
    yield tel;
    const bx = this.x + ORGAN.parts.speaker.x + 6;
    const left = this.viewLeft() - 16;
    spawnRectBeam(this.world, 'anthem', left, this.stripeY - 12, bx - left, 24, 40);
    this.world.audio.sfx('env/anthem-sting', { vol: 0.9 });
    this.world.camera.shake(2, 40);
    yield 40;
    this.mode = 'drift';
    yield this.recoveryFor(50);
  }

  /** C — Kazoo Escort: a formation of 5 drones leaves the hatch (NORMAL / HARD, phase 1). */
  kazooEscort(): void {
    this.hatchOpenT = 40;
    this.world.spawn('kazoo-drone', this.x + ORGAN.hatch[0] - 4, this.y + ORGAN.hatch[1] + 6, { formation: 'sine', facing: -1 });
    this.world.audio.sfx('creature/kazoo', { vol: 0.6 });
  }

  openShutters(): void {
    this.shutterGoal = 3;
    this.say('AND NOW... FROM THE TOP. WITH FEELING!', { at: ORGAN.bell, ticks: 100, kind: 'radio' });
    this.world.audio.sfx('machine/brake', { vol: 0.6, pitch: 0.6 });
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    if (this.mode === 'drift') {
      this.driftT++;
      this.ay = ORGAN.homeVY + Math.sin(this.driftT * (ORGAN.driftSpeed / ORGAN.drift)) * ORGAN.drift;
    }
    this.place();
    if (this.glowT > 0) this.glowT--;
    if (this.stripeT > 0) this.stripeT--;
    if (this.speakerGlow > 0) this.speakerGlow--;
    if (this.hatchOpenT > 0) this.hatchOpenT--;
    if (this.shutterK < this.shutterGoal && this.world.tick % 12 === 0) {
      this.shutterK++;
      this.world.audio.sfx('hit/metal', { vol: 0.4, pitch: 0.6 + this.shutterK * 0.1 });
      if (this.shutterK >= 3) this.horn.enabled = true;
    }
    if (this.state === 'fight' && this.phase === 0 && difficultyOf(this.world).id !== 'easy') {
      if (--this.kazooT <= 0) {
        this.kazooT = 480;
        this.kazooEscort();
      }
    }
    this.updateWind();
  }

  private updateWind(): void {
    if (this.windT <= 0) return;
    this.windT--;
    const players = this.world.players;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!isPlayer(p) || !p.alive) continue;
      const v = p.vehicle && p.vehicle.alive ? p.vehicle : null;
      if (v) {
        let first = true;
        for (let j = 0; j < i; j++) if ((players[j] as typeof p).vehicle === v) first = false;
        if (!first) continue;
        if (v.body) pushX(v, -1, this.world.terrain, this.world);
        else v.x -= 1;
      } else if (p.state === 'play') pushX(p, -1, this.world.terrain, this.world);
    }
  }

  // ------------------------------------------------------------------------------- damage

  protected override onPartBroken(p: BossPart): void {
    if (p === this.bellows) {
      // GDD: the bellows are worth 5,000 instead of 1,000.
      const r = this.partRectOf(p);
      awardScore(this.world, this.lastOwner, 4000, r.x + r.w / 2, r.y);
      this.bellowsK = -1;
      this.windT = 0;
      this.world.audio.sfx('boss/deflate', { vol: 0.8 });
    }
    if (PIPE_NAMES.includes(p.name as (typeof PIPE_NAMES)[number])) {
      if (this.glowCluster === p.index) this.glowCluster = -1;
      this.world.audio.sfx('boss/organ-chord', { vol: 0.6, pitch: 0.5 });
      this.refreshRequiredHp();
      this.checkPhases();
    }
  }

  private partRectOf(p: BossPart): { x: number; y: number; w: number; h: number } {
    return { x: this.x + p.box.x, y: this.y + p.box.y, w: p.box.w, h: p.box.h };
  }

  override onHit(d: Damage, part = 0): boolean {
    if (d.owner !== undefined) this.lastOwner = d.owner;
    return super.onHit(d, part);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.glowCluster = -1;
    this.stripeT = 0;
    this.windT = 0;
    this.bellowsK = -1;
    this.mode = 'hold';
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    return (function* organDown(): ScriptGen {
      const w = self.world;
      const h = self.hatch;
      // The squawk, the wrong note, the music stops.
      w.audio.sfx('boss/voice-crack', { vol: 1, pitch: 0.6 });
      explosion(w, h.x, h.y, 'l', { debris: 'metal' });
      self.say('THAT WAS... A WRONG NOTE?!', { at: ORGAN.bell, ticks: 100, kind: 'radio' });
      yield 20;
      w.audio.sfx('boss/organ-chord', { vol: 1, pitch: 0.47 });
      playSong(w, null, 40);
      for (let t = 0; t < 160; t++) {
        // The lurch: down 10 px with a wobble, then steady.
        self.lurch = Math.min(10, t * 0.25) + (t < 80 ? Math.sin(t * 0.6) * 2 : 0);
        self.place();
        if (t % 9 === 0) {
          const c = self.randomPoint();
          explosion(w, c[0], c[1], t % 27 === 0 ? 'm' : 's', { silent: t % 18 !== 0, shake: 2, debris: null });
        }
        if (t % 5 === 0) smokeTrail(w, self.x + 30 + w.fxRng.range(0, 140), self.y + w.fxRng.range(20, 190), true);
        if (t === 60) debris(w, h.x, h.y, 'wood', 10);
        if (t === 100) {
          w.audio.sfx('machine/brake', { vol: 0.7, pitch: 0.5 });
          self.say('...PLEASE MIND THE GAP.', { at: ORGAN.bell, ticks: 80, kind: 'radio' });
        }
        yield;
      }
    })();
  }

  // ------------------------------------------------------------------------------- draw

  private piece(r: Renderer, id: string, frame: number, x: number, y: number, flash = false): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(id, frame, Math.round(x), Math.round(y), drawOpts);
    if (flash) {
      // Hit flash: a white wash over the part (never a solid white block).
      hitOpts.flipX = drawOpts.flipX;
      r.sprite(id, frame, Math.round(x), Math.round(y), hitOpts);
    }
  }

  override draw(r: Renderer): void {
    if (this.state === 'done' && !this.defeated) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const tick = this.world.tick;
    const rot = (tick >> 1) & 3;
    for (const [hx, hy] of ORGAN.rotors) this.piece(r, `${ART}/rotor`, rot, x + hx, y + hy);
    this.piece(r, `${ART}/body`, 0, x, y);
    this.piece(r, `${ART}/hatch`, this.hatchOpenT > 0 ? 1 : 0, x + ORGAN.hatch[0], y + ORGAN.hatch[1]);
    // Pipe clusters.
    for (let i = 0; i < 3; i++) {
      const p = this.pipeParts[i];
      const b = p.box;
      if (p.destroyed) {
        this.piece(r, `${ART}/${p.name}-2`, 1, x + b.x, y + b.y);
        continue;
      }
      const id = this.partSpriteId(p);
      this.piece(r, id, 0, x + b.x, y + b.y, p.flash > 2);
      if (this.glowCluster === i && this.glowT % 6 < 4) {
        glowOpts.tint = this.glowT % 12 < 6 ? PAL.gold[3] : PAL.pink[2];
        glowOpts.flipX = false;
        r.sprite(id, 0, x + b.x, y + b.y, glowOpts);
      }
    }
    // Speaker and shutters.
    const sp = this.horn;
    const sb = sp.box;
    if (sp.destroyed || this.dead) this.piece(r, `${ART}/speaker-2`, 1, x + sb.x, y + sb.y);
    else {
      const id = this.partSpriteId(sp);
      this.piece(r, id, 0, x + sb.x, y + sb.y, sp.flash > 2);
      if (this.speakerGlow > 0 && this.speakerGlow % 6 < 4) {
        glowOpts.tint = PAL.gold[3];
        glowOpts.flipX = false;
        r.sprite(id, 0, x + sb.x, y + sb.y, glowOpts);
      }
      if (this.shutterK < 3) this.piece(r, `${ART}/shutters`, this.shutterK, x + sb.x, y + sb.y);
    }
    // Bellows.
    const bl = this.bellows;
    const bb = bl.box;
    if (bl.destroyed) this.piece(r, `${ART}/bellows-2`, 4, x + bb.x, y + bb.y);
    else {
      const k = this.bellowsK >= 0 ? this.bellowsK : [0, 1, 2, 1][(tick >> 4) & 3];
      this.piece(r, this.partSpriteId(bl), k, x + bb.x, y + bb.y, bl.flash > 2);
    }
    // D telegraph: a flickering 24 px stripe across the view at the bell's height.
    if (this.stripeT > 0 && (tick >> 1) % 3 !== 0) {
      const vl = this.viewLeft();
      const sy = Math.round(this.stripeY - 12);
      r.rect(vl, sy, x + sb.x - vl, 24, PAL.gold[2], stripeOpts);
      r.rect(vl, sy, x + sb.x - vl, 1, PAL.snow[3]);
      r.rect(vl, sy + 23, x + sb.x - vl, 1, PAL.snow[3]);
    }
    // Wind streaks while the bellows blow.
    if (this.windT > 0) {
      const vl = this.viewLeft();
      const vt = this.viewTop();
      for (let i = 0; i < 14; i++) {
        const sx = vl + ((i * 97 + (60 - this.windT) * 7 * (1 + (i % 3))) % 400);
        const sy = vt + 12 + ((i * 53) % 190);
        r.line(Math.round(400 + vl - (sx - vl)), sy, Math.round(400 + vl - (sx - vl)) + 14, sy, i % 3 === 0 ? PAL.snow[3] : PAL.snow[1]);
      }
    }
  }
}

/** Phase gap: a short beat between attacks (× difficulty). */
function o0(b: GrandOrgan): number {
  return Math.round(b.recoveryFor(24));
}


defineEntity('grand-organ', (w, x, y, p) => new GrandOrgan(w, x, y, p), {
  category: 'boss',
  score: ORGAN.score,
  description: 'THE GRAND ORGAN (m5 final boss stage 1, shoot-em-up): flies in view coordinates (param left = arena x). Parts pipes-top/mid/low, bellows, speaker.',
});
