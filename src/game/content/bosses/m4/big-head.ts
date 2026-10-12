/**
 * THE BIG HEAD (GDD §9.4) — the mini-boss at the end of m4-a: a propaganda blimp shaped like
 * Fanfaroni's head. Entity id `big-head`.
 *
 * Spawn (m4-a, `LOCK 2416–2800`): `ctx.spawn('big-head', 2900, 72, { arenaLeft: 2416 })` — it floats
 * in from the right to view x 250 (the intro), then drifts left and right at 0.5 px/tick (anchor view
 * x 90–294) while its top edge bobs between y 4 and y 20 (the chin stays 36–52 px over the plaza:
 * players walk under it; touching it does not hurt). Params: `arenaLeft` (default the camera's left),
 * `statueX` (world x of the Fanfaroni statue it lands on when it dies; default view x 330, drawn by
 * the boss; `statue: false` = the mission draws its own), `hpScale` (tests).
 *
 * Parts (GDD §15.4): `moustache-left` 500, `moustache-right` 500 (the gun pods), `mouth-speaker` 800,
 * `head` 1,500 (the required core; half damage while the speaker lives).
 * Cycle A Moustache Volley, B Propaganda Drop, C ATTENTION! (skipped without the speaker), 50 ticks
 * apart; D Paratroopers [N]: every 600 ticks 3 `rifleman` parachute from the gondola.
 * Death: it deflates with a long raspberry, loops around the screen twice and lands draped over the
 * statue like a rubber mask. Score 20,000 (+ 1,000 per destroyed part).
 */
import type { Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { PAL } from '../../../../engine/palette';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { difficultyOf } from '../../../context';
import { debris, dust, explosion, smokeTrail, steamPuff } from '../../../fx';
import { defineEntity, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { HEAD as H } from './geom';
import { Leaflet, LeafletBomb, SonicCone, moustacheBullet } from './shots';

const ART = 'boss/big-head';
export const BIG_HEAD_NAME = 'THE BIG HEAD';

const P_ML = 0;
const P_MR = 1;
const P_SPEAKER = 2;
const P_HEAD = 3;

type Mode = 'hold' | 'drift' | 'script';

const opts: DrawOpts = {};
const flashOpts: DrawOpts = { tint: 0xffffffff, alpha: 0.6 };
const coneOpts: DrawOpts = { alpha: 0.8 };

export class BigHead extends Boss {
  arenaLeft = 0;
  mode: Mode = 'hold';
  dir: 1 | -1 = -1;
  /** Bob phase (ticks). */
  bobT = 0;
  curl = false;
  mouthOpen = false;
  hatchOpen = false;
  attention = false;
  /** Ticks until the next paratrooper drop ([N]). */
  paraT = 600;
  statueX = 0;
  showStatue = true;
  /** Death: deflate frame (−1 = none) and the mask on the statue. */
  deflateK = -1;
  masked = false;
  private lastPing = 0;
  private readonly mouthPt: [number, number] = [0, 0];

  private partHp(base: number): number {
    return Math.max(1, Math.round(base * paramNum(this.params, 'hpScale', 1)));
  }

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: BIG_HEAD_NAME, hp: 1500, score: 20000 });
    this.facing = 1;
    this.addPart('moustache-left', { box: { ...H.moustacheLeft }, hp: this.partHp(500) });
    this.addPart('moustache-right', { box: { ...H.moustacheRight }, hp: this.partHp(500) });
    this.addPart('mouth-speaker', { box: { ...H.speaker }, hp: this.partHp(800) });
    this.addPart('head', { box: { ...H.head }, hp: this.partHp(1500), required: true, multiplier: 0.5 });
    this.removeOnDeath = false;
    this.showStatue = paramBool(p, 'statue', true);
    this.phases = [
      {
        at: 1,
        name: 'blimp',
        pattern: (b) => b.sequence([(c) => c.moustacheVolley(), (c) => c.propagandaDrop(), (c) => c.attentionCone()], 50),
      },
    ];
  }

  viewX(v: number): number {
    return this.arenaLeft + v;
  }

  /** Anchor y for the bob: the top edge between y 4 and y 20. */
  private bobY(): number {
    const mid = (H.topMin + H.topMax) / 2;
    const amp = (H.topMax - H.topMin) / 2;
    return this.world.camera.top + mid + amp * Math.sin(this.bobT / 50) + H.size.h / 2;
  }

  mouth(): [number, number] {
    this.mouthPt[0] = this.x + H.mouth[0];
    this.mouthPt[1] = this.y + H.mouth[1] + 6;
    return this.mouthPt;
  }

  private trackArena(): void {
    if (this.params.arenaLeft !== undefined) return;
    const cam = this.world.camera;
    if (cam.locked || this.state === 'intro') this.arenaLeft = Math.round(cam.left);
  }

  override *intro(): ScriptGen {
    this.arenaLeft = paramNum(this.params, 'arenaLeft', Math.round(this.world.camera.left));
    this.statueX = paramNum(this.params, 'statueX', this.viewX(330));
    this.mode = 'script';
    const home = this.viewX(H.homeView);
    let i = 0;
    while (this.x > home + 0.5 && i++ < 900) {
      this.trackArena();
      this.x = Math.max(home, this.x - 1.2);
      this.bobT++;
      this.y = this.bobY();
      yield;
    }
    this.world.audio.sfx('machine/anthem-crackle');
    this.say('ATTENTION, CITIZENS!', { at: [0, -70], ticks: 90, kind: 'radio' });
    yield 40;
    this.mode = 'drift';
  }

  protected override think(): void {
    this.trackArena();
    this.bobT++;
    if (this.mode === 'drift') {
      this.x += this.dir * H.drift;
      if (this.x <= this.viewX(H.minView)) this.dir = 1;
      else if (this.x >= this.viewX(H.maxView)) this.dir = -1;
    }
    if (this.mode !== 'script') this.y = this.bobY();
    // The head takes half damage while the speaker lives.
    this.parts[P_HEAD].multiplier = this.partAlive('mouth-speaker') ? 0.5 : 1;
    // D Paratroopers [N]: every 600 ticks, 3 riflemen from the gondola.
    if (this.state === 'fight' && difficultyOf(this.world).normalRows && --this.paraT <= 0) {
      this.paraT = 600;
      this.paratroopers();
    }
    // Torn rubber hisses.
    if (this.damageState === 2 && this.world.tick % 20 === 0) steamPuff(this.world, this.x + 48, this.y - 10, 0.6, -0.2);
  }

  private paratroopers(): void {
    const self = this;
    this.world.scripts.run(
      (function* drop(): ScriptGen {
        for (let i = 0; i < 3; i++) {
          if (self.dead) return;
          let alive = 0;
          for (const e of self.world.byTag('enemy')) if (e.type === 'rifleman' && e.alive) alive++;
          if (alive >= 6) return;
          const gx = self.x + H.gondola[0] + (i - 1) * 6;
          const gy = self.y + H.gondola[1] + 12;
          self.world.spawn('rifleman', gx, gy, { entry: 'parachute', facing: -1 });
          self.world.audio.sfx('vehicle/exit', { vol: 0.5 });
          yield 20;
        }
      })(),
      { owner: this, name: 'big-head.paratroopers' },
    );
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      this.world.audio.sfx('hit/enemy', { vol: 0.4, pitch: part === P_HEAD ? 0.6 : 1.2 });
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    const r = this.partRect(p);
    debris(this.world, r.x + r.w / 2, r.y + r.h / 2, 'metal', 6);
    if (p.index === P_SPEAKER) {
      this.parts[P_HEAD].multiplier = 1;
      this.mouthOpen = false;
      this.attention = false;
      this.world.audio.sfx('machine/anthem-crackle', { pitch: 0.6 });
      this.say('*FWEEEE*', { at: [0, 40], ticks: 60 });
    } else if (p.index === P_ML || p.index === P_MR) {
      this.world.audio.sfx('enemy/fumble');
    }
  }

  // ------------------------------------------------------------------------------- A Moustache Volley

  *moustacheVolley(): ScriptGen {
    if (!this.partAlive('moustache-left') && !this.partAlive('moustache-right')) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(30);
    this.curl = true;
    this.world.audio.sfx('enemy/aim');
    yield tele;
    const n = this.volleySize(3);
    for (let i = 0; i < n; i++) {
      for (const [name, tip] of [
        ['moustache-left', H.tipLeft],
        ['moustache-right', H.tipRight],
      ] as const) {
        if (!this.partAlive(name)) continue;
        const mx = this.x + tip[0];
        const my = this.y + tip[1] + 4;
        if (!this.world.camera.containsPoint(mx, my, -8)) continue;
        const t = this.world.nearestPlayer(mx, my);
        const a = t ? Math.atan2(t.y - 18 - my, t.x - mx) : Math.PI / 2;
        moustacheBullet(this.world, mx, my, a, 2.5, this);
        this.world.audio.sfx('enemy/rifle', { vol: 0.6, pitch: 1.2 });
      }
      yield 8;
    }
    this.curl = false;
    yield this.recoveryFor(40);
  }

  // ------------------------------------------------------------------------------- B Propaganda Drop

  *propagandaDrop(): ScriptGen {
    const tele = this.telegraphFor(24);
    this.hatchOpen = true;
    this.world.audio.sfx('vehicle/exit', { pitch: 0.7 });
    yield tele;
    const bombs = this.volleySize(2);
    const total = 8 + bombs;
    const rng = this.world.rng;
    // The bombs sit at random places among the leaflets.
    const bombAt = new Set<number>();
    while (bombAt.size < bombs) bombAt.add(rng.int(0, total - 1));
    for (let i = 0; i < total; i++) {
      const hx = this.x + H.hatch[0] + rng.range(-6, 6);
      const hy = this.y + H.hatch[1] - 2;
      if (bombAt.has(i)) LeafletBomb.drop(this.world, hx, hy, rng.int(0, 60), this);
      else this.world.add(new Leaflet(this.world, hx, hy, rng.int(0, 60)));
      yield 3;
    }
    this.hatchOpen = false;
    yield this.recoveryFor(40);
  }

  // ------------------------------------------------------------------------------- C ATTENTION!

  *attentionCone(): ScriptGen {
    if (!this.partAlive('mouth-speaker')) {
      yield 1;
      return;
    }
    // It holds still for the telegraph and the cone (fair: the preview shows where it lands).
    const keep = this.mode;
    this.mode = 'hold';
    const tele = this.telegraphFor(40);
    this.mouthOpen = true;
    this.attention = true;
    this.world.audio.sfx('enemy/tuba-inhale');
    for (let i = 0; i < tele; i++) {
      if (!this.partAlive('mouth-speaker')) break;
      yield;
    }
    this.attention = false;
    if (this.partAlive('mouth-speaker')) {
      const [mx, my] = this.mouth();
      const ground = this.groundY(mx);
      const cone = this.world.add(new SonicCone(this.world, mx, my, ground, 30));
      cone.top = H.coneTop;
      cone.bottom = H.coneBottom;
      cone.follow = () => this.mouth();
      this.world.audio.sfx('enemy/tuba-blast', { pitch: 0.8 });
      this.world.camera.shake(2, 30);
      yield 30;
    }
    this.mouthOpen = false;
    this.mode = keep === 'script' ? 'drift' : keep;
    yield this.recoveryFor(50);
  }

  private groundY(x: number): number {
    const f = this.world.terrain.surfaceY(x, this.y + 40, Infinity, { platforms: false });
    return Number.isFinite(f) ? f : this.world.camera.top + 176;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.mode = 'script';
    this.curl = false;
    this.mouthOpen = false;
    this.hatchOpen = false;
    this.attention = false;
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    const w = this.world;
    return (function* deflate(): ScriptGen {
      explosion(w, self.x, self.y, 'm', { debris: 'metal' });
      w.audio.sfx('boss/deflate');
      yield 16;
      // Loops around the screen twice, shrinking, trailing smoke.
      const cx = self.viewX(192);
      const cy = w.camera.top + 82;
      const x0 = self.x;
      const y0 = self.y;
      const T = 200;
      for (let t = 0; t < T; t++) {
        const k = t / T;
        const a = k * Math.PI * 4;
        const rx = 150 * (1 - k * 0.3);
        const ry = 56 * (1 - k * 0.3);
        const lx = cx - Math.cos(a) * rx;
        const ly = cy - Math.sin(a) * ry;
        // Ease out of the starting point into the loop.
        const blend = Math.min(1, t / 30);
        self.x = x0 + (lx - x0) * blend;
        self.y = y0 + (ly - y0) * blend;
        self.deflateK = Math.min(3, Math.floor(k * 4));
        if (t % 4 === 0) smokeTrail(w, self.x, self.y, false);
        if (t === 100) w.audio.sfx('boss/deflate', { pitch: 1.3, vol: 0.7 });
        yield;
      }
      // Down onto the statue.
      const sx = self.statueX;
      const sy = self.groundY(sx) - 64;
      const fx = self.x;
      const fy = self.y;
      for (let t = 1; t <= 30; t++) {
        self.x = fx + ((sx - fx) * t) / 30;
        self.y = fy + ((sy - fy) * t) / 30;
        yield;
      }
      self.deflateK = -1;
      self.masked = true;
      dust(w, sx - 16, self.groundY(sx), 4);
      dust(w, sx + 16, self.groundY(sx), 4);
      w.audio.sfx('hit/drum', { pitch: 0.6 });
      yield 30;
    })();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    opts.flipX = false;
    opts.flash = false;
    const dead = this.state === 'dying' || this.state === 'done';
    if (this.showStatue && this.statueX !== 0) {
      const sy = this.groundY(this.statueX);
      r.sprite(this.masked ? `${ART}/mask` : `${ART}/statue`, 0, Math.round(this.statueX), Math.round(sy), opts);
    }
    if (this.masked) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.deflateK >= 0) {
      r.sprite(`${ART}/deflate`, this.deflateK, x, y, opts);
      return;
    }
    const head = this.parts[P_HEAD];
    this.drawPart(r, this.partSpriteId(head), 0, x, y, head, dead);
    for (const i of [P_ML, P_MR]) {
      const p = this.parts[i];
      if (p.destroyed) continue;
      this.drawPart(r, this.partSpriteId(p), this.curl ? 1 : 0, x, y, p, dead);
    }
    const sp = this.parts[P_SPEAKER];
    this.drawPart(r, this.partSpriteId(sp), this.mouthOpen && !sp.destroyed ? 1 : 0, x, y, sp, dead);
    r.sprite(`${ART}/hatch`, this.hatchOpen ? 1 : 0, x, y, opts);
    if (this.attention && (this.world.tick >> 3) % 2 === 0) r.sprite(`${ART}/attention`, 0, x, y - 6, opts);
    if (this.attention) {
      // The cone's preview: dotted edges down to the ground.
      const [mx, my] = this.mouth();
      const gy = this.groundY(mx);
      const top = H.coneTop / 2;
      const bot = H.coneBottom / 2;
      for (let yy = my; yy < gy; yy += 4) {
        const k = (yy - my) / Math.max(1, gy - my);
        const hw = Math.round(top + (bot - top) * k);
        if (((yy + this.world.tick) >> 2) % 2) continue;
        r.rect(Math.round(mx - hw), Math.round(yy), 1, 2, PAL.pink[2], coneOpts);
        r.rect(Math.round(mx + hw), Math.round(yy), 1, 2, PAL.pink[2], coneOpts);
      }
    }
  }

  /** A part's sprite; a hit flashes it with a white overlay (the detail stays readable). */
  private drawPart(r: Renderer, id: string, frame: number, x: number, y: number, p: BossPart, dead: boolean): void {
    r.sprite(id, frame, x, y, opts);
    if (dead || p.flash < 3) return;
    r.sprite(id, frame, x, y, flashOpts);
  }
}

defineEntity('big-head', (w, x, y, p) => new BigHead(w, x, y, p), {
  category: 'boss',
  score: 20000,
  description: 'm4 mini-boss: a Fanfaroni-head blimp (moustache-left/right, mouth-speaker, head); Moustache Volley, Propaganda Drop, ATTENTION!, Paratroopers.',
});
