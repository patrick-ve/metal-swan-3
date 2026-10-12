/**
 * THE GOLDEN GOOSE (GDD §9.4) — the mini-boss at the end of m2-b: Swan Mk2, caught by the Legion,
 * painted gold and renamed. Entity id `golden-goose`.
 *
 * Spawn: `ctx.spawn('golden-goose', B_W - 8, G, { facing: -1 })` after `LOCK 3216–3600`: it
 * walks in from the right edge to view x 300 and honks (the intro). Params: `dropMaxX` (death: the
 * goose staggers left until its last egg lands left of this x), `arenaLeft` (the
 * locked view's left x; default the camera's left at the intro). Faces left; between attacks it
 * turns to face the nearest player.
 *
 * Parts: `neck` 800 (optional; destroying it ends Neck Lash and Honk Ring) and `hull` 2,000 (the
 * required core, 60 × 36). Touching the body or the legs hurts.
 * Cycle A Egg Drop, B Neck Lash, C Goose Step (only when a player is on the ground within
 * 160 px), D Honk Ring — 60 ticks between attacks.
 * Death: it sits down, sighs, lays one last golden egg; the egg cracks and a `pickup-repair` and a
 * `pickup-bombs` pop out; the pilot runs off. Score 15,000 (+ 1,000 per destroyed part).
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { hudOf } from '../../../context';
import { debris, dust, explosion, smokeTrail, tinFeathers } from '../../../fx';
import { isPlayer } from '../../../player/player';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { GOOSE_BODY_DY, GOOSE_LEGS } from './art-goose';
import { GOOSE as G } from './geom';
import { GoldenEgg, GroundWave, gooseNote, goosePellet } from './shots';

const ART = 'boss/golden-goose';
export const GOOSE_NAME = 'THE GOLDEN GOOSE';
const DEG = Math.PI / 180;
const BOSS_HIT: readonly string[] = ['boss'];

const opts: DrawOpts = {};
const nestOpts: DrawOpts = {};
const P_NECK = 0;
const P_HULL = 1;

type Mode = 'hold' | 'home' | 'script';

export class GoldenGoose extends Boss {
  arenaLeft = 0;
  mode: Mode = 'hold';
  legs: number = GOOSE_LEGS.stand;
  private stepT = 0;
  /** Neck angle (degrees, − = up) and the beak. */
  neckDeg: number = G.neckRest;
  beakOpen = false;
  puff = 0;
  /** Wiggle offset of the body (Egg Drop telegraph). */
  private wiggle = 0;
  /** Death props: the last egg, the pilot running off. */
  private eggX = 0;
  private eggY = 0;
  private eggK = -1;
  private pilotX = 0;
  private pilotY = 0;
  private pilotOn = false;
  private canopyOpen = false;
  /** The crate nest at home (world x, ground y; 0 = not placed yet). */
  private nestX = 0;
  private nestY = 0;
  private readonly contactRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly contactList: Rect[] = [];
  private lastPing = 0;
  private readonly beakPt: [number, number] = [0, 0];

  /** Part HP with the debug / test spawn param `hpScale` (default 1). */
  private partHp(base: number): number {
    return Math.max(1, Math.round(base * paramNum(this.params, 'hpScale', 1)));
  }

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: GOOSE_NAME, hp: 2000, score: 15000 });
    // Standard facing (−1 = left). The art and the GOOSE geometry face left; part boxes are given
    // mirrored (right-facing), the base mirrors them back while the goose faces left.
    this.facing = -1;
    this.addPart('neck', { box: { x: 52 - G.neckBox.w, y: -98, w: G.neckBox.w, h: G.neckBox.h }, hp: this.partHp(800) });
    this.addPart('hull', { box: { ...G.hull, x: -G.hull.x - G.hull.w }, hp: this.partHp(2000), required: true });
    this.contactDamage = { amount: 10, kind: 'impact', dirX: -1, tags: BOSS_HIT };
    this.removeOnDeath = false;
    this.phases = [
      {
        at: 1,
        name: 'goose',
        pattern: (b) => b.sequence([(c) => c.eggDrop(), (c) => c.neckLash(), (c) => c.gooseStep(), (c) => c.honkRing()], 60),
      },
    ];
  }

  /** +1 while the goose faces left (as drawn), −1 while it faces right. */
  get fx(): 1 | -1 {
    return this.facing < 0 ? 1 : -1;
  }

  viewX(v: number): number {
    return this.arenaLeft + v;
  }

  /** The ground under x near the goose's feet (never the one-way ramp above it). */
  private groundAt(x: number): number {
    const f = this.world.terrain.surfaceY(x, this.y - 16, this.y + 40, { platforms: false });
    return Number.isFinite(f) ? f : this.y;
  }

  /** Head (beak tip) point in world space. */
  beak(): [number, number] {
    const t = this.neckDeg * DEG;
    const len = G.neckLen + 18;
    this.beakPt[0] = this.x + (G.neckRoot[0] - Math.cos(t) * len) * this.fx;
    this.beakPt[1] = this.y + G.neckRoot[1] + this.bodyDy() + Math.sin(t) * len;
    return this.beakPt;
  }

  private bodyDy(): number {
    return GOOSE_BODY_DY[this.legs] ?? 0;
  }

  private nearestPlayer(): { x: number; y: number; onGround: boolean } | null {
    const t = this.world.nearestPlayer(this.x, this.y - 40);
    if (!t) return null;
    return { x: t.x, y: t.y, onGround: (t.body?.onGround ?? true) === true };
  }

  // ------------------------------------------------------------------------------- intro

  /**
   * The arena's left x: the spawn param `arenaLeft`, else the camera's left — followed while the
   * camera is locked (it may still be settling onto the lock during the intro).
   */
  private trackArena(): void {
    if (this.params.arenaLeft !== undefined) return;
    const cam = this.world.camera;
    if (cam.locked || this.state === 'intro') this.arenaLeft = Math.round(cam.left);
  }

  override *intro(): ScriptGen {
    this.arenaLeft = paramNum(this.params, 'arenaLeft', Math.round(this.world.camera.left));
    this.mode = 'script';
    while (Math.abs(this.x - this.viewX(G.homeView)) > 0.6) {
      this.trackArena();
      this.walkToward(this.viewX(G.homeView), 1);
      yield;
    }
    // The crate nest at home.
    this.nestX = this.viewX(G.homeView) + 6;
    const ny = this.world.terrain.surfaceY(this.nestX, this.y - 40, this.y + 60, { platforms: false });
    this.nestY = Number.isFinite(ny) ? ny : this.y;
    this.legs = GOOSE_LEGS.stand;
    // It honks.
    this.neckDeg = -45;
    this.beakOpen = true;
    this.world.audio.sfx('boss/goose-honk');
    tinFeathers(this.world, this.x - 30, this.y - 80, 3, -1);
    yield 24;
    this.beakOpen = false;
    this.neckDeg = G.neckRest;
    this.grampsLines();
    yield 12;
    this.mode = 'home';
  }

  /** GDD §9.4: Gramps (if playing) has words about this "goose". */
  private grampsLines(): void {
    const hud = hudOf(this.world);
    const ps = this.world.players;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!isPlayer(p) || p.character.id !== 'gramps' || !p.alive) continue;
      hud.bubble(p, 'THAT IS A SWAN, YOU PHILISTINES!', { ticks: 110 });
      const self = this;
      this.world.scripts.run(
        (function* second(): ScriptGen {
          yield 120;
          if (p.alive) hud.bubble(p, 'MK2 HAD A CANOPY. IT FOGGED UP.', { ticks: 110 });
        })(),
        { owner: self, name: 'goose.gramps' },
      );
      break;
    }
  }

  /** One walking tick toward x at `speed` (the legs step, the feet follow the ground). */
  private walkToward(x: number, speed: number): void {
    const d = x - this.x;
    const s = Math.sign(d) * Math.min(Math.abs(d), speed);
    this.x += s;
    this.y = this.groundAt(this.x);
    this.stepT += Math.abs(s);
    this.legs = ((this.stepT / 8) | 0) % 2 ? GOOSE_LEGS.stepA : GOOSE_LEGS.stepB;
    if (Math.abs(s) > 0 && (this.stepT | 0) % 16 === 0) this.world.audio.sfx('swan/step', { vol: 0.6, pitch: 0.7 });
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    this.trackArena();
    if (this.puff > 0) this.puff--;
    if (this.mode === 'home') {
      // Between attacks it turns to face the nearest player .
      const t = this.world.nearestPlayer(this.x, this.y - 40);
      if (t) {
        const want: 1 | -1 = t.x > this.x + 24 ? 1 : t.x < this.x - 24 ? -1 : this.facing;
        if (want !== this.facing) {
          this.facing = want;
          this.world.audio.sfx('swan/step', { vol: 0.5, pitch: 0.8 });
        }
      }
      const home = this.viewX(G.homeView);
      if (Math.abs(this.x - home) > 0.6) this.walkToward(home, 0.8);
      else if (this.legs !== GOOSE_LEGS.stand) this.legs = GOOSE_LEGS.stand;
    }
    this.syncNeck();
  }

  /** The neck hurtbox follows the head. */
  private syncNeck(): void {
    const t = this.neckDeg * DEG;
    const hx = G.neckRoot[0] - Math.cos(t) * G.neckLen;
    const hy = G.neckRoot[1] + this.bodyDy() + Math.sin(t) * G.neckLen;
    const nb = this.parts[P_NECK].box;
    nb.x = -hx - G.neckBox.w / 2; // right-facing local box (see the constructor)
    nb.y = hy - G.neckBox.h / 2;
    const hb = this.parts[P_HULL].box;
    hb.y = G.hull.y + this.bodyDy();
  }

  override contactBoxes(): readonly Rect[] {
    const out = this.contactList;
    out.length = 0;
    if (this.state !== 'fight') return out;
    const r = this.contactRect;
    r.x = this.fx > 0 ? this.x + G.body.x : this.x - G.body.x - G.body.w;
    r.y = this.y + G.body.y + this.bodyDy();
    r.w = G.body.w;
    r.h = G.body.h - this.bodyDy();
    out.push(r);
    return out;
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      this.world.audio.sfx('hit/metal', { vol: 0.45, pitch: 1.3 });
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    if (p.index === P_NECK) {
      this.beakOpen = false;
      const [bx, by] = this.beak();
      debris(this.world, bx, by, 'metal', 8);
      tinFeathers(this.world, bx, by, 5, -1);
      this.world.audio.sfx('boss/goose-honk', { pitch: 0.6, vol: 0.7 });
    }
  }

  // ------------------------------------------------------------------------------- A Egg Drop

  *eggDrop(): ScriptGen {
    this.mode = 'hold';
    const tele = this.telegraphFor(40);
    this.legs = GOOSE_LEGS.squat;
    this.world.audio.sfx('boss/goose-wiggle');
    for (let i = 0; i < tele; i++) {
      this.wiggle = (i >> 2) % 2 ? 1 : -1;
      yield;
    }
    this.wiggle = 0;
    const n = this.volleySize(3);
    for (let i = 0; i < n; i++) {
      const t = this.nearestPlayer();
      const ex = this.x + G.eggPort[0] * this.fx;
      const dir: 1 | -1 = t && t.x > ex ? 1 : -1;
      GoldenEgg.lay(this.world, ex, this.y + G.eggPort[1] + this.bodyDy(), dir, this);
      this.world.audio.sfx('hit/metal', { vol: 0.4, pitch: 1.8 });
      yield 12;
    }
    this.legs = GOOSE_LEGS.stand;
    yield this.recoveryFor(40);
    this.mode = 'home';
  }

  // ------------------------------------------------------------------------------- B Neck Lash

  *neckLash(): ScriptGen {
    if (!this.partAlive('neck')) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(30);
    // The neck pulls back.
    for (let i = 0; i < tele; i++) {
      if (!this.partAlive('neck')) return;
      this.neckDeg += (-75 - this.neckDeg) * 0.2;
      yield;
    }
    const n = this.volleySize(6);
    const sweep = 40;
    let fired = 0;
    this.beakOpen = true;
    for (let i = 0; i <= sweep; i++) {
      if (!this.partAlive('neck')) return;
      this.neckDeg = -60 + (80 * i) / sweep;
      while (fired < n && i >= Math.round((sweep * fired) / Math.max(1, n - 1))) {
        const [bx, by] = this.beak();
        const a = this.neckDeg * DEG;
        goosePellet(this.world, bx, by, Math.atan2(Math.sin(a), -Math.cos(a) * this.fx), 2.5, this);
        this.world.audio.sfx('swan/fire', { vol: 0.6, pitch: 0.8 });
        fired++;
      }
      yield;
    }
    this.beakOpen = false;
    for (let i = 0; i < 12; i++) {
      this.neckDeg += (G.neckRest - this.neckDeg) * 0.25;
      yield;
    }
    this.neckDeg = G.neckRest;
    yield Math.max(1, this.recoveryFor(40) - 12);
  }

  // ------------------------------------------------------------------------------- C Goose Step

  *gooseStep(): ScriptGen {
    const t = this.nearestPlayer();
    if (!t || !t.onGround || Math.abs(t.x - this.x) > 160 + 40) {
      yield 1;
      return;
    }
    this.mode = 'script';
    for (let s = 0; s < 3; s++) {
      // Lift a leg high (the first lift is the telegraph).
      this.legs = GOOSE_LEGS.lift;
      this.world.audio.sfx('swan/jump', { vol: 0.5, pitch: 0.7 });
      yield s === 0 ? this.telegraphFor(20) : 14;
      const p = this.nearestPlayer();
      const dir = p ? Math.sign(p.x - this.x) || -1 : -1;
      const to = Math.max(this.viewX(G.minView), Math.min(this.viewX(G.maxView), this.x + dir * 32));
      for (let i = 0; i < 8; i++) {
        this.x += (to - this.x) / (8 - i);
        this.y = this.groundAt(this.x);
        yield;
      }
      // STOMP: a shockwave 32 px each way, 8 px tall.
      this.legs = GOOSE_LEGS.stand;
      this.world.camera.shake(2, 8);
      this.world.audio.sfx('swan/stomp', { vol: 0.9, pitch: 0.7 });
      dust(this.world, this.x - 10, this.y, 3);
      dust(this.world, this.x + 10, this.y, 3);
      for (const d of [-1, 1] as const) GroundWave.launch(this.world, { x: this.x + d * 22, y: this.y, dir: d, speed: 2, height: 8, range: 32, sprite: `${ART}/wave`, shooter: this });
      yield 8;
    }
    yield this.recoveryFor(40);
    this.mode = 'home';
  }

  // ------------------------------------------------------------------------------- D Honk Ring

  *honkRing(): ScriptGen {
    if (!this.partAlive('neck')) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(50);
    this.world.audio.sfx('boss/goose-wiggle');
    for (let i = 0; i < tele; i++) {
      if (!this.partAlive('neck')) return;
      this.puff = 2 + (i > tele / 2 ? 4 : 0);
      this.neckDeg += (-30 - this.neckDeg) * 0.1;
      yield;
    }
    this.puff = 0;
    this.beakOpen = true;
    this.world.audio.sfx('boss/goose-honk');
    const [bx, by] = this.beak();
    const n = this.volleySize(8);
    const t = this.nearestPlayer();
    // A gap points at the player (clear gaps between the notes).
    const aim = t ? Math.atan2(t.y - 16 - by, t.x - bx) : Math.PI;
    for (let i = 0; i < n; i++) gooseNote(this.world, bx, by, aim + Math.PI / n + (i * Math.PI * 2) / n, 1.5, this);
    yield 20;
    this.beakOpen = false;
    this.neckDeg = G.neckRest;
    yield Math.max(1, this.recoveryFor(40) - 20);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.mode = 'hold';
    this.beakOpen = false;
    this.puff = 0;
    this.wiggle = 0;
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    const w = this.world;
    return (function* sitDown(): ScriptGen {
      explosion(w, self.x, self.y - 50, 'm', { debris: 'metal' });
      yield 20;
      // `dropMaxX`: the egg (and the pickups in it) must land left of that x — in m2-b the route
      // exits sit at the arena's right edge, and a pickup there would drag a player into one. The
      // goose staggers left, smoking, until its egg port is clear (at most 240 ticks).
      const maxX = paramNum(self.params, 'dropMaxX', Infinity);
      if (Number.isFinite(maxX)) {
        self.facing = -1;
        for (let i = 0; i < 240 && self.x + (G.eggPort[0] + 18) * self.fx > maxX; i++) {
          self.walkToward(-1e9, 1);
          if (i % 20 === 0) dust(w, self.x + 10, self.y, 2);
          yield;
        }
        self.legs = GOOSE_LEGS.stand;
      }
      // It sits down and sighs.
      self.legs = GOOSE_LEGS.squat;
      yield 10;
      self.legs = GOOSE_LEGS.sit;
      self.neckDeg = 10;
      dust(w, self.x - 20, self.y, 4);
      dust(w, self.x + 20, self.y, 4);
      w.audio.sfx('boss/goose-honk', { pitch: 0.5, vol: 0.6 });
      yield 40;
      // One last golden egg.
      self.eggX = self.x + (G.eggPort[0] + 18) * self.fx;
      self.eggY = self.y;
      self.eggK = 0;
      w.audio.sfx('hit/metal', { pitch: 1.6, vol: 0.5 });
      yield 30;
      self.eggK = 1;
      w.audio.sfx('hit/metal', { pitch: 2, vol: 0.4 });
      yield 14;
      self.eggK = 2;
      w.audio.sfx('hit/metal', { pitch: 2.2, vol: 0.4 });
      yield 14;
      self.eggK = 3;
      w.audio.sfx('item/crate-break');
      w.spawn('pickup-repair', self.eggX - 6, self.eggY - 10, { dropped: true });
      w.spawn('pickup-bombs', self.eggX + 6, self.eggY - 10, { dropped: true });
      yield 16;
      // The pilot pops the canopy and runs off.
      self.canopyOpen = true;
      self.pilotOn = true;
      self.pilotX = self.x + G.canopy[0] * self.fx;
      self.pilotY = self.y + G.canopy[1] + 22;
      w.audio.sfx('enemy/panic');
      let vy = -3;
      for (let i = 0; i < 26; i++) {
        vy += 0.3;
        self.pilotX += 1.2 * self.fx;
        self.pilotY = Math.min(self.groundAt(self.pilotX), self.pilotY + vy);
        yield;
      }
    })();
  }

  override update(): void {
    super.update();
    if (this.state === 'dying' || this.state === 'done') {
      if (this.world.tick % 9 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-20, 20), this.y - 40, true);
      if (this.pilotOn) {
        this.pilotX += 2 * this.fx;
        this.pilotY = this.groundAt(this.pilotX);
        if (!this.world.camera.containsPoint(this.pilotX, this.pilotY - 10, 32)) this.pilotOn = false;
      }
    }
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x + this.wiggle);
    const y = Math.round(this.y);
    const dead = this.state === 'dying' || this.state === 'done';
    const dy = this.bodyDy();
    opts.flipX = this.fx < 0;
    opts.flash = false;
    const neck = this.parts[P_NECK];
    const hull = this.parts[P_HULL];
    if (this.nestX !== 0) r.sprite(`${ART}/nest`, 0, Math.round(this.nestX), Math.round(this.nestY) + 2, nestOpts);
    r.sprite(`${ART}/legs`, this.legs, x, y, opts);
    // The neck behind the body's breast collar.
    const nx = x + G.neckRoot[0] * this.fx;
    const ny = y + G.neckRoot[1] + dy;
    if (neck.destroyed) r.sprite(`${ART}/stump`, 0, nx, ny, opts);
    else {
      opts.flash = !dead && neck.flash >= 3;
      r.sprite(this.partSpriteId(neck), this.neckFrame(), nx, ny, opts);
    }
    opts.flash = !dead && hull.flash >= 3;
    r.sprite(this.canopyOpen ? `${ART}/hull-open` : this.partSpriteId(hull), 0, x, y + dy, opts);
    opts.flash = false;
    if (this.puff > 0) r.sprite(`${ART}/puff`, this.puff > 4 ? 1 : 0, x, y + dy, opts);
    if (this.eggK >= 0) r.sprite(`${ART}/big-egg`, this.eggK, Math.round(this.eggX), Math.round(this.eggY), opts);
    if (this.pilotOn) {
      opts.flipX = this.fx < 0;
      r.sprite(`${ART}/pilot-run`, (this.world.tick >> 2) & 3, Math.round(this.pilotX), Math.round(this.pilotY), opts);
    }
  }

  private neckFrame(): number {
    const a = G.neckAngles;
    let best = 0;
    for (let i = 1; i < a.length; i++) if (Math.abs(a[i] - this.neckDeg) < Math.abs(a[best] - this.neckDeg)) best = i;
    return best + (this.beakOpen ? a.length : 0);
  }
}

defineEntity('golden-goose', (w, x, y, p) => new GoldenGoose(w, x, y, p), {
  category: 'boss',
  score: 15000,
  description: 'm2 mini-boss: Swan Mk2 painted gold (neck, hull); Egg Drop, Neck Lash, Goose Step, Honk Ring.',
});
