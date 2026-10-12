/**
 * THE BA-DUM BEHEMOTH (GDD §10.2) — the boss of m2: a giant drum kit on crimson treads; Colonel
 * Rimshot sits on the throne and tells awful jokes. Entity id `ba-dum-behemoth`.
 *
 * Spawn: `ctx.spawn('ba-dum-behemoth', x, 'ground')` after the camera lock (`LOCK 1600–1984`).
 * Spawned right of its patrol it rolls in to a drum fill (the intro, invulnerable), then patrols
 * the anchor's view x 230…290 at 0.4 px/tick. Params: `arenaLeft` (the locked view's left x;
 * default the camera's left at the intro), `hpScale` (part HP × this; tests and the arena).
 * The mission shows the subtitle: `ctx.bossIntro('THE BA-DUM BEHEMOTH', { subtitle: BEHEMOTH_SUBTITLE })`.
 *
 * Parts (GDD §15.4): `crash-shield` 1,000 (optional; while it is in front, shots at the bass drum
 * hit it), `hihat-arm` 1,200 (knifeable while it is down), `tom-left` 800, `tom-right` 800,
 * `bass-drum` 2,000 (the required core), and the `tread` (no HP: shots ping). Phase 1 needs 2 of
 * the 3 arm / tom parts: the boss bar counts the HP still needed for that plus the bass drum.
 *
 * Phase 1 "Warm-Up": A Hi-Hat Crush, B Tom Volley, A, C Rimshot Taunt (the bass drum only pings).
 * Intermission (60): THAT'S MY WARM-UP ACT! — rimshot, one cricket.
 * Phase 2 "Drum Solo": D Kick Boom, E Drum-Roll Charge, D, B (if a tom lives).
 * Phase 3 "Big Finish" (bass drum < 1,000): Rimshot stands, the shield stays aside; F Stick
 * Storm, G Cymbal Saw, D; recoveries × 0.8.
 * Death (240 ticks): tom, tom, bass, crash explode like a drum fill; 60 ticks of silence;
 * Rimshot crawls out of the bass drum: TOUGH CROWD. The wreck stays.
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { PAL, INK } from '../../../../engine/palette';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import { getFrame } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { debris, drawShadow, dust, explosion, smokeTrail, tumble } from '../../../fx';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { RIM, TOM_ANCHORS, TOM_MUZZLE } from './art-behemoth';
import { BEHEMOTH as G } from './geom';
import { CymbalSaw, Drumstick, GroundWave, TomShell } from './shots';

const ART = 'boss/ba-dum-behemoth';
export const BEHEMOTH_NAME = 'THE BA-DUM BEHEMOTH';
export const BEHEMOTH_SUBTITLE = 'COLONEL RIMSHOT IS HERE ALL WEEK';

/** The jokes of the Rimshot Taunt (GDD §10.2), in turn: set-up and punchline (one bubble each). */
export const JOKES: readonly (readonly [string, string])[] = [
  ["KNOCK KNOCK! WHO'S THERE?", 'A TANK MADE OF DRUMS!'],
  ["I TOLD THE ARMY I'D BEAT THEM.", 'NOW I BEAT DRUMS!'],
  ['MY FAVOURITE DESSERT?', 'A DRUM ROLL!'],
  ["I'M NOT LOUD.", "I'M PERCUSSIVE!"],
];

const ARMS: readonly string[] = ['hihat-arm', 'tom-left', 'tom-right'];
const RIMSHOT_SFX = ['env', 'rimshot'].join('/');
const CRICKET_SFX = ['env', 'cricket'].join('/');
const BOSS_HIT: readonly string[] = ['boss'];

const opts: DrawOpts = {};
const tintOpts: DrawOpts = { alpha: 0.55 };
const flashOpts: DrawOpts = { alpha: 0.7 };

/** Part indices (the order of addPart). */
const P_SHIELD = 0;
const P_HIHAT = 1;
const P_TOM_L = 2;
const P_TOM_R = 3;
const P_BASS = 4;

type Move = 'patrol' | 'hold' | 'script';

export class BaDumBehemoth extends Boss {
  /** World x of the locked view's left edge (set by the intro). */
  arenaLeft = 0;
  move: Move = 'hold';
  private patrolDir: 1 | -1 = -1;
  private treadPos = 0;
  private treadSpin = 0;
  /** Crash shield frame (0 front … 3 aside, 4 thrown) and where it is going. */
  shieldK = 0;
  shieldTarget = 0;
  private shieldTick = 0;
  /** Hi-hat head (bottom of the lower cymbal), world coordinates; attached = follows the tank at rest. */
  hhX = 0;
  hhY = 0;
  hhAttached = true;
  hhOpen = 0;
  /** The head is dropping (crush zone live). */
  hhSlamming = false;
  hhDown = false;
  /** Shadow under the hi-hat during the telegraph (0…1) and its ground y. */
  hhShadow = 0;
  hhGround = 0;
  private hhSolid: SolidBox | null = null;
  beaterK = 0;
  private flexT = 0;
  tomFlash = 0;
  private readonly tomRecoil = [0, 0];
  /** Drum-roll dust line (ticks left). */
  dustLine = 0;
  /** Rimshot: frame, standing (phase 3), the crawl after the fight. */
  rimFrame: number = RIM.sit;
  private rimTalkT = 0;
  standing = false;
  private rimOut = false;
  private rimX = 0;
  private rimY = 0;
  private jokeIndex = 0;
  /** Death: which drums have exploded (tom-left, tom-right, bass, crash). */
  private readonly blown = [false, false, false, false];
  /** The spare cymbal in Rimshot's hands (G with the shield destroyed). */
  private spareUp = false;
  private readonly contactRects: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private readonly contactList: Rect[] = [];
  private lastPing = 0;
  private skipped = false;

  /** Part HP with the debug / test spawn param `hpScale` (default 1). */
  private partHp(base: number): number {
    return Math.max(1, Math.round(base * paramNum(this.params, 'hpScale', 1)));
  }

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: BEHEMOTH_NAME, hp: 2000, score: 40000 });
    this.facing = 1; // drawn facing left; never mirrored
    this.addPart('crash-shield', { box: { x: -124, y: -74, w: 20, h: 60 }, hp: this.partHp(1000) });
    this.addPart('hihat-arm', { box: { x: -170, y: -110, w: 40, h: 32 }, hp: this.partHp(1200), knifeable: true });
    this.addPart('tom-left', { box: G.tomLeft, hp: this.partHp(800) });
    this.addPart('tom-right', { box: G.tomRight, hp: this.partHp(800) });
    this.addPart('bass-drum', { box: G.bassBox, hp: this.partHp(2000), required: true });
    this.addPart('tread', { box: G.tread });
    this.contactDamage = { amount: 10, kind: 'impact', dirX: -1, tags: BOSS_HIT };
    this.removeOnDeath = false;
    this.deathTicks = 240;
    this.phaseIntermission = 60;
    this.hhX = x + G.hihatRest[0];
    this.hhY = y + G.hihatRest[1];
    this.phases = [
      {
        at: 1,
        name: 'warm-up',
        pattern: (b) => b.sequence([(c) => c.hihatCrush(), (c) => c.tomVolley(), (c) => c.hihatCrush(), (c) => c.taunt()], b.recoveryFor(24)),
      },
      {
        when: (b) => b.brokenCount(ARMS) >= 2,
        name: 'drum-solo',
        onEnter: (b) => b.warmUpGag(),
        pattern: (b) => b.sequence([(c) => c.kickBoom(1), (c) => c.charge(), (c) => c.kickBoom(1), (c) => c.tomVolley()], b.recoveryFor(24)),
      },
      {
        when: (b) => b.phase >= 1 && b.bassFrac() < 0.5,
        name: 'big-finish',
        onEnter: (b) => b.bigFinish(),
        pattern: (b) => b.sequence([(c) => c.stickStorm(), (c) => c.cymbalSaw(), (c) => c.kickBoom(0.8)], b.recoveryFor(20)),
      },
    ];
  }

  // ------------------------------------------------------------------------------- HP model

  /** Fraction of the bass drum's HP left. */
  bassFrac(): number {
    const p = this.parts[P_BASS];
    return p ? Math.max(0, p.hp) / p.maxHp : 1;
  }

  /**
   * Boss HP = the bass drum + the HP still needed to break 2 of the 3 arm / tom parts (the
   * weakest ones), so the bar moves in phase 1 too and only reaches 0 when the fight is won.
   */
  protected override refreshRequiredHp(): void {
    super.refreshRequiredHp();
    let broken = 0;
    const alive: number[] = [];
    const maxes: number[] = [];
    for (const n of ARMS) {
      const p = this.part(n);
      if (!p) continue;
      maxes.push(p.maxHp);
      if (p.destroyed) broken++;
      else alive.push(Math.max(0, p.hp));
    }
    alive.sort((a, b) => a - b);
    maxes.sort((a, b) => a - b);
    const need = Math.max(0, 2 - broken);
    for (let i = 0; i < need && i < alive.length; i++) this.hp += alive[i];
    for (let i = 0; i < 2 && i < maxes.length; i++) this.maxHp += maxes[i];
  }

  /** Is the crash shield in front of the bass drum right now? */
  shieldInFront(): boolean {
    const s = this.parts[P_SHIELD];
    return !s.destroyed && this.shieldK <= 1;
  }

  override onHit(d: Damage, part = 0): boolean {
    if (part === P_BASS && this.state === 'fight' && this.invulnTicks <= 0) {
      // GDD §10.2: while the shield is in front, shots at the bass drum hit the shield.
      if (this.shieldInFront()) return this.onHit(d, P_SHIELD);
      if (this.phase < 1) {
        // Warm-up: the drum is damped (Rimshot is not done with his act yet).
        if (this.world.tick - this.lastPing >= 4) {
          this.lastPing = this.world.tick;
          this.world.audio.sfx('hit/drum', { vol: 0.5 });
        }
        this.parts[P_BASS].flash = 2;
        return true;
      }
    }
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      const name = this.parts[part]?.name;
      this.world.audio.sfx(name === 'crash-shield' || name === 'hihat-arm' ? 'hit/shield' : name === 'tread' ? 'hit/metal' : 'hit/drum', { vol: 0.5 });
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    if (p.index === P_HIHAT) this.releaseHihat();
    if (p.index === P_SHIELD && this.shieldK >= 4) this.shieldK = 3;
    const r = this.partRect(p);
    debris(this.world, r.x + r.w / 2, r.y + r.h / 2, 'metal', 6);
    this.checkPhases();
  }

  // ------------------------------------------------------------------------------- view helpers

  /** World x for a view x of the arena. */
  viewX(view: number): number {
    return this.arenaLeft + view;
  }

  private target(): { x: number; y: number; onGround: boolean } | null {
    const t = this.world.nearestPlayer(this.x - 100, this.y - 40);
    if (!t) return null;
    const onGround = (t.body?.onGround ?? true) === true;
    return { x: t.x, y: t.y, onGround };
  }

  /** The floor under x near a player's feet y (platforms count), else the boss's floor. */
  private floorUnder(x: number, nearY: number): number {
    const f = this.world.terrain.surfaceY(x, nearY - 24, this.y + 40);
    return Number.isFinite(f) ? f : this.y;
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
    this.move = 'script';
    this.rimFrame = RIM.sitPlay;
    let t = 0;
    while (this.x > this.viewX(G.patrolMax)) {
      this.trackArena();
      this.x = Math.max(this.viewX(G.patrolMax), this.x - 2);
      this.treadPos -= 2;
      if (t % 6 === 0) this.world.audio.sfx('drum/tom', { vol: 0.7, pitch: 1.4 - ((t / 6) % 4) * 0.12 });
      if (t % 4 === 0) dust(this.world, this.x - 96 + this.world.fxRng.range(0, 190), this.y, 1);
      this.rimFrame = (t >> 3) % 2 ? RIM.sitPlay : RIM.sitPlayB;
      t++;
      yield;
    }
    // The fill: tom, tom, tom … crash!
    for (let i = 0; i < 6; i++) {
      this.world.audio.sfx('drum/tom', { vol: 0.8, pitch: 1.5 - i * 0.12 });
      this.rimFrame = i % 2 ? RIM.sitPlay : RIM.sitPlayB;
      this.tomRecoil[i % 2] = 4;
      yield 6;
    }
    this.world.audio.sfx('drum/crash');
    this.world.audio.sfx('drum/kick');
    this.flexT = 8;
    this.world.camera.shake(2, 10);
    this.rimFrame = RIM.sitTalk;
    this.say('TESTING... ONE, TWO... BA-DUM!', { at: G.speech, ticks: 90 });
    yield 30;
    this.rimFrame = RIM.sit;
    this.move = 'patrol';
  }

  /**
   * Debug / screenshot param `skip`: 1 = start at phase 2 (the hi-hat arm and the left tom are
   * gone), 2 = start at phase 3 (the bass drum at 49 %).
   */
  private applySkip(): void {
    const skip = paramNum(this.params, 'skip', 0);
    if (skip <= 0) return;
    const d: Damage = { amount: 1e9, kind: 'explosion', dirX: 0, owner: -1 };
    this.onHit(d, P_HIHAT);
    this.onHit(d, P_TOM_L);
    if (skip >= 2) {
      const bass = this.parts[P_BASS];
      this.invulnTicks = 0;
      this.shieldK = this.shieldTarget = 3;
      this.onHit({ ...d, amount: Math.ceil(bass.maxHp * 0.51) }, P_BASS);
    }
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    this.trackArena();
    if (!this.skipped && this.phase === 0) {
      this.skipped = true;
      this.applySkip();
    }
    this.animateParts();
    if (this.move === 'patrol') {
      const lo = this.viewX(G.patrolMin);
      const hi = this.viewX(G.patrolMax);
      this.x += this.patrolDir * G.patrolSpeed;
      this.treadPos += this.patrolDir * G.patrolSpeed;
      if (this.x <= lo) {
        this.x = lo;
        this.patrolDir = 1;
      } else if (this.x >= hi) {
        this.x = hi;
        this.patrolDir = -1;
      }
      if (this.world.tick % 90 === 0) this.world.audio.sfx('machine/tank-move', { vol: 0.25 });
    }
  }

  /** Per-tick animation and part boxes (also during the intro and the death). */
  private animateParts(): void {
    if (this.flexT > 0) this.flexT--;
    if (this.tomFlash > 0) this.tomFlash--;
    if (this.dustLine > 0) this.dustLine--;
    for (let i = 0; i < 2; i++) if (this.tomRecoil[i] > 0) this.tomRecoil[i]--;
    if (this.treadSpin > 0) {
      this.treadSpin--;
      this.treadPos -= 3;
    }
    if (this.rimTalkT > 0 && --this.rimTalkT % 10 === 0) this.rimFrame = this.rimFrame === RIM.sitTalk ? RIM.sit : this.rimFrame === RIM.standTalk ? RIM.stand : this.standing ? RIM.standTalk : RIM.sitTalk;
    // Crash shield swings one frame every 4 ticks toward its target (4 = thrown stays).
    if (this.shieldK !== this.shieldTarget && this.shieldK < 4 && this.shieldTarget < 4 && ++this.shieldTick >= 4) {
      this.shieldTick = 0;
      this.shieldK += Math.sign(this.shieldTarget - this.shieldK);
    }
    const sh = this.parts[P_SHIELD];
    if (this.shieldK >= 4) sh.enabled = false;
    else {
      sh.enabled = true;
      const aside = this.shieldK >= 2;
      const [cx, cy] = aside ? G.shieldAside : G.shieldFront;
      const bw = aside ? G.shieldAsideBox.w : G.shieldFrontBox.w;
      const bh = aside ? G.shieldAsideBox.h : G.shieldFrontBox.h;
      sh.box.x = cx - bw / 2;
      sh.box.y = cy - bh / 2;
      sh.box.w = bw;
      sh.box.h = bh;
    }
    // Hi-hat head: follows the tank at rest; its hurtbox follows the head.
    if (this.hhAttached) {
      this.hhX = this.x + G.hihatRest[0];
      this.hhY = this.y + G.hihatRest[1];
    }
    const hh = this.parts[P_HIHAT];
    hh.box.x = this.hhX - this.x - G.hihatBox.w / 2;
    hh.box.y = this.hhY - this.y - G.hihatBox.h;
  }

  // ------------------------------------------------------------------------------- A Hi-Hat Crush

  *hihatCrush(): ScriptGen {
    if (!this.partAlive('hihat-arm')) {
      yield 10;
      return;
    }
    const tele = this.telegraphFor(45);
    const moveT = Math.max(12, Math.round(tele * 0.66));
    this.hhAttached = false;
    const restY = this.y + G.hihatRest[1];
    let tx = this.hhX;
    let ty = this.y;
    // Move over the nearest player's x (tracking), then open the cymbals: "chick".
    for (let i = 0; i < tele; i++) {
      if (!this.partAlive('hihat-arm')) return this.releaseHihat();
      if (i < moveT) {
        const t = this.target();
        if (t) {
          tx = Math.max(this.viewX(G.slamMinView), Math.min(this.x + G.slamMaxLocal, t.x));
          ty = this.floorUnder(tx, t.onGround ? t.y : this.y);
        }
        const k = 1 / Math.max(1, moveT - i);
        this.hhX += (tx - this.hhX) * k;
        this.hhY += (restY - 10 - this.hhY) * k;
      } else if (i === moveT) {
        this.hhOpen = 1;
        this.world.audio.sfx('boss/hihat-open');
      }
      this.hhGround = ty;
      this.hhShadow = Math.min(1, i / tele);
      yield;
    }
    // Slam: the head drops onto the shadow (crush zone 40 × 20).
    this.hhOpen = 0;
    this.hhSlamming = true;
    let vy = 2;
    while (this.hhY < ty) {
      if (!this.partAlive('hihat-arm')) return this.releaseHihat();
      vy = Math.min(10, vy + 1.5);
      this.hhY = Math.min(ty, this.hhY + vy);
      yield;
    }
    this.hhSlamming = false;
    this.hhShadow = 0;
    this.hhDown = true;
    this.world.audio.sfx('drum/hat', { vol: 1, pitch: 0.7 });
    this.world.audio.sfx('hit/metal', { vol: 0.8 });
    this.world.camera.shake(2, 8);
    dust(this.world, this.hhX - 14, ty, 3);
    dust(this.world, this.hhX + 14, ty, 3);
    // The closed hi-hat stays down 30 ticks; its top is a platform.
    this.hhSolid = this.world.addSolid(new SolidBox(this.hhX - G.hihat.w / 2, ty - G.hihat.h + 6, G.hihat.w, 4, true, this));
    for (let i = 0; i < 30; i++) {
      if (!this.partAlive('hihat-arm')) return this.releaseHihat();
      yield;
    }
    this.removeHihatSolid();
    this.hhDown = false;
    // Recovery: lift back to the rest pose.
    const rec = this.recoveryFor(30);
    for (let i = 0; i < rec; i++) {
      if (!this.partAlive('hihat-arm')) return this.releaseHihat();
      const k = 1 / Math.max(1, rec - i);
      this.hhX += (this.x + G.hihatRest[0] - this.hhX) * k;
      this.hhY += (this.y + G.hihatRest[1] - this.hhY) * k;
      yield;
    }
    this.hhAttached = true;
  }

  private removeHihatSolid(): void {
    if (this.hhSolid) {
      this.world.removeSolid(this.hhSolid);
      this.hhSolid = null;
    }
  }

  /** The arm stops (destroyed or the attack cancelled): back to rest at once. */
  private releaseHihat(): void {
    this.removeHihatSolid();
    this.hhSlamming = false;
    this.hhDown = false;
    this.hhShadow = 0;
    this.hhOpen = 0;
    this.hhAttached = true;
  }

  /** Contact: the tread and the deck; the hi-hat head while it drops. */
  override contactBoxes(): readonly Rect[] {
    const out = this.contactList;
    out.length = 0;
    if (this.state !== 'fight') return out;
    const [a, b, c] = this.contactRects;
    a.x = this.x + G.tread.x;
    a.y = this.y + G.tread.y;
    a.w = G.tread.w;
    a.h = G.tread.h;
    out.push(a);
    b.x = this.x + G.deck.x;
    b.y = this.y + G.deck.y;
    b.w = G.deck.w;
    b.h = G.deck.h;
    out.push(b);
    if (this.hhSlamming) {
      c.x = this.hhX - G.hihat.w / 2;
      c.y = this.hhY - G.hihat.h;
      c.w = G.hihat.w;
      c.h = G.hihat.h;
      out.push(c);
    }
    return out;
  }

  // ------------------------------------------------------------------------------- B Tom Volley

  *tomVolley(): ScriptGen {
    const left = this.partAlive('tom-left');
    const right = this.partAlive('tom-right');
    if (!left && !right) {
      yield 10;
      return;
    }
    const tele = this.telegraphFor(30);
    this.tomFlash = tele;
    this.world.audio.sfx('enemy/drumroll');
    this.rimFrame = this.standing ? RIM.stand : RIM.sitPlay;
    yield tele;
    const n = this.volleySize(2);
    const offL = [-32, 32, -64];
    const offR = [0, 64, 96];
    for (let i = 0; i < n; i++) {
      const t = this.target();
      const px = t ? t.x : this.viewX(80);
      const py = t ? t.y : this.y;
      if (this.partAlive('tom-left')) this.fireTom(0, px + offL[i % 3], py);
      if (this.partAlive('tom-right')) this.fireTom(1, px + offR[i % 3], py);
      this.rimFrame = i % 2 ? RIM.sitPlay : RIM.sitPlayB;
      yield 12;
    }
    this.rimFrame = this.standing ? RIM.stand : RIM.sit;
    yield this.recoveryFor(50);
  }

  private fireTom(i: 0 | 1, tx: number, py: number): void {
    const a = i === 0 ? TOM_ANCHORS.left : TOM_ANCHORS.right;
    const mx = this.x + a[0] + TOM_MUZZLE[0];
    const my = this.y + a[1] + TOM_MUZZLE[1];
    const x = Math.max(this.viewX(8), Math.min(this.viewX(376), tx));
    const ty = this.floorUnder(x, py);
    TomShell.lob(this.world, mx, my, x, ty, 30, this);
    this.tomRecoil[i] = 6;
    this.world.audio.sfx('drum/tom', { vol: 1, pitch: i === 0 ? 1 : 0.85 });
    explosion(this.world, mx, my - 2, 's', { damage: 0, silent: true, shake: 0, debris: null, lift: 0 });
  }

  // ------------------------------------------------------------------------------- C Rimshot Taunt

  *taunt(): ScriptGen {
    const joke = JOKES[this.jokeIndex % JOKES.length];
    this.jokeIndex++;
    this.say(joke[0], { at: G.speech, ticks: 44 });
    this.rimFrame = this.standing ? RIM.standTalk : RIM.sitTalk;
    this.rimTalkT = 80;
    yield 44;
    this.say(joke[1], { at: G.speech, ticks: 50 });
    yield 46;
    this.rimTalkT = 0;
    this.rimFrame = RIM.sitPlay;
    this.world.audio.sfx('drum/snare');
    yield 8;
    this.rimFrame = RIM.sitPlayB;
    this.world.audio.sfx('drum/snare');
    yield 8;
    this.world.audio.sfx(RIMSHOT_SFX);
    this.rimFrame = RIM.sit;
    yield 20;
  }

  // ------------------------------------------------------------------------------- phase changes

  warmUpGag(): void {
    const self = this;
    this.releaseHihat();
    this.move = 'hold';
    this.world.scripts.run(
      (function* gag(): ScriptGen {
        self.rimFrame = RIM.sitTalk;
        self.rimTalkT = 30;
        self.say("THAT'S MY WARM-UP ACT!", { at: G.speech, ticks: 50 });
        yield 34;
        self.world.audio.sfx(RIMSHOT_SFX);
        self.rimFrame = RIM.sit;
        yield 14;
        // Nobody laughs. One cricket chirps.
        self.world.audio.sfx(CRICKET_SFX);
        yield 12;
        self.move = 'patrol';
      })(),
      { owner: this, name: 'behemoth.warmup' },
    );
  }

  bigFinish(): void {
    const self = this;
    this.move = 'hold';
    this.shieldTarget = 3;
    this.world.scripts.run(
      (function* finish(): ScriptGen {
        self.standing = true;
        self.rimFrame = RIM.standTalk;
        self.rimTalkT = 30;
        self.say('FOR MY BIG FINISH...', { at: G.speech, ticks: 50 });
        yield 40;
        self.world.audio.sfx('drum/crash');
        self.rimFrame = RIM.stand;
        yield 20;
        self.move = 'patrol';
      })(),
      { owner: this, name: 'behemoth.finish' },
    );
  }

  // ------------------------------------------------------------------------------- D Kick Boom

  *kickBoom(cool: number): ScriptGen {
    const tele = this.telegraphFor(40);
    this.beaterK = 1;
    this.shieldTarget = 3;
    this.world.audio.sfx('boss/beater-pull');
    yield tele;
    const n = this.volleySize(1);
    for (let i = 0; i < n; i++) {
      this.beaterK = 0;
      this.flexT = 10;
      this.world.audio.sfx('drum/kick', { vol: 1, pitch: 0.7 });
      this.world.audio.sfx('explosion/m', { vol: 0.6 });
      this.world.camera.shake(3, 10);
      const wy = this.y;
      GroundWave.launch(this.world, { x: this.x + G.tread.x - 6, y: wy, dir: -1, speed: 3, height: 12, range: 420, sprite: `${ART}/wave`, shooter: this });
      GroundWave.launch(this.world, { x: this.x + G.tread.x + G.tread.w + 6, y: wy, dir: 1, speed: 3, height: 12, range: 420, sprite: `${ART}/wave`, shooter: this });
      dust(this.world, this.x - 100, this.y, 6);
      if (i < n - 1) {
        yield 8;
        this.beaterK = 1;
        this.world.audio.sfx('boss/beater-pull', { vol: 0.6 });
        yield 16;
      }
    }
    // Recovery: the shield stays aside — the window to hit the bass drum.
    yield Math.round(this.recoveryFor(40) * cool);
    if (!this.standing) this.shieldTarget = 0;
  }

  // ------------------------------------------------------------------------------- E Drum-Roll Charge

  *charge(): ScriptGen {
    const tele = this.telegraphFor(40);
    this.move = 'script';
    this.shieldTarget = 3;
    this.treadSpin = tele;
    this.dustLine = tele + 60;
    this.world.audio.sfx('machine/tank-charge');
    this.world.audio.sfx('enemy/drumroll');
    for (let i = 0; i < tele; i++) {
      if (i % 3 === 0) dust(this.world, this.x - 90 + this.world.fxRng.range(0, 180), this.y, 1);
      yield;
    }
    const start = this.x;
    const stop = this.viewX(G.chargeLine) - G.tread.x;
    this.world.audio.sfx('machine/tank-move');
    while (this.x > stop) {
      this.x = Math.max(stop, this.x - G.chargeSpeed);
      this.treadPos -= G.chargeSpeed;
      if (this.world.tick % 3 === 0) dust(this.world, this.x - 96, this.y, 2);
      if (this.world.tick % 8 === 0) this.world.audio.sfx('drum/snare', { vol: 0.5 });
      this.dustLine = Math.max(this.dustLine, 2);
      yield;
    }
    this.world.camera.shake(2, 8);
    this.world.audio.sfx('drum/crash', { vol: 0.7 });
    // Recovery: back off at 1 px/tick.
    yield 10;
    const back = Math.max(start, this.viewX(G.patrolMin + 10));
    while (this.x < back) {
      this.x = Math.min(back, this.x + G.backSpeed);
      this.treadPos += G.backSpeed;
      yield;
    }
    if (!this.standing) this.shieldTarget = 0;
    this.move = 'patrol';
  }

  // ------------------------------------------------------------------------------- F Stick Storm

  *stickStorm(): ScriptGen {
    const tele = this.telegraphFor(40);
    this.rimFrame = RIM.throwUp;
    const hx = this.x + G.rimshotHands[0];
    const hy = this.y + G.rimshotHands[1];
    for (let k = 0; k < 4; k++) tumble(this.world, `${ART}/drumstick`, hx, hy, -1 + k * 0.6, -6 - k * 0.4, { life: 30, gravity: 0.05 });
    this.world.audio.sfx('enemy/whistle', { vol: 0.5 });
    const t = this.target();
    const px = t ? t.x : this.viewX(80);
    const py = t ? t.y : this.y;
    const n = this.volleySize(6);
    const jitter = this.world.rng.int(-6, 6);
    for (let k = 0; k < n; k++) {
      const x = Math.max(this.viewX(8), Math.min(this.x - 110, px + (k - 2) * 28 + jitter));
      Drumstick.drop(this.world, x, this.floorUnder(x, py), tele + k * 4, this);
    }
    yield tele;
    this.rimFrame = RIM.stand;
    // The sticks fall (4 px/tick from above the view) — wait for the last one.
    yield Math.round((this.y - this.world.camera.top + 20) / 4) + n * 4;
    yield Math.round(this.recoveryFor(40) * 0.8);
  }

  // ------------------------------------------------------------------------------- G Cymbal Saw

  *cymbalSaw(): ScriptGen {
    const tele = this.telegraphFor(30);
    const own = this.partAlive('crash-shield');
    this.spareUp = !own;
    if (own) this.shieldTarget = 3;
    this.rimFrame = RIM.throwUp;
    for (let i = 0; i < tele; i++) {
      if (i % 6 === 0) this.world.audio.sfx('enemy/cymbal-raise', { vol: 0.5, pitch: 1 + i / tele });
      yield;
    }
    this.spareUp = false;
    const usedShield = this.partAlive('crash-shield');
    if (usedShield) {
      this.shieldK = 4;
      this.shieldTarget = 4;
    }
    let home = false;
    const sx = usedShield ? this.x + G.shieldAside[0] : this.x + G.rimshotHands[0];
    const saw = CymbalSaw.throwSaw(this.world, sx, this.y, this.viewX(8), this.x - 104, this);
    saw.onHome = () => {
      home = true;
    };
    this.world.audio.sfx('drum/crash');
    this.rimFrame = RIM.stand;
    for (let i = 0; i < 600 && !home && !saw.removed; i++) yield;
    if (usedShield) {
      this.shieldK = this.partAlive('crash-shield') ? 3 : 3;
      this.shieldTarget = 3;
      this.world.audio.sfx('hit/shield', { vol: 0.6 });
    }
    yield Math.round(this.recoveryFor(40) * 0.8);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.releaseHihat();
    this.hush();
    this.tomFlash = 0;
    this.treadSpin = 0;
    this.dustLine = 0;
    this.move = 'hold';
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    const w = this.world;
    return (function* drumFill(): ScriptGen {
      // "boom, boom, BOOM, tssss" — 240 ticks in all.
      const tl = TOM_ANCHORS.left;
      const tr = TOM_ANCHORS.right;
      yield 20;
      self.blown[0] = true;
      explosion(w, self.x + tl[0], self.y + tl[1] - 12, 'm', { debris: 'metal' });
      w.audio.sfx('drum/tom', { pitch: 1.2 });
      yield 18;
      self.blown[1] = true;
      explosion(w, self.x + tr[0], self.y + tr[1] - 12, 'm', { debris: 'metal' });
      w.audio.sfx('drum/tom', { pitch: 0.9 });
      yield 24;
      self.blown[2] = true;
      explosion(w, self.x + G.skinC[0], self.y + G.skinC[1], 'l', { debris: 'metal' });
      w.audio.sfx('drum/kick', { pitch: 0.6 });
      w.camera.shake(5, 20);
      yield 26;
      self.blown[3] = true;
      explosion(w, self.x + G.shieldFront[0], self.y + G.shieldFront[1], 'm', { debris: 'metal', silent: true });
      w.audio.sfx('drum/crash', { vol: 1, pitch: 0.8 });
      self.shieldK = 4;
      yield 32;
      // 60 ticks of silence (smoke only).
      yield 60;
      // Rimshot crawls out of the burst bass drum and dusts himself off.
      self.rimOut = true;
      self.rimX = self.x + G.skinC[0] + 4;
      self.rimY = self.y + G.skinC[1] + 20;
      for (let i = 0; i < 36; i++) {
        self.rimX -= 0.6;
        self.rimY = Math.min(self.y, self.rimY + (i < 20 ? 0.6 : 1.4));
        self.rimFrame = (i >> 3) % 2 ? RIM.crawlB : RIM.crawlA;
        yield;
      }
      self.rimY = self.y;
      for (let i = 0; i < 16; i++) {
        self.rimFrame = (i >> 2) % 2 ? RIM.dustB : RIM.dustA;
        if (i % 4 === 0) dust(w, self.rimX, self.rimY - 10, 1);
        yield;
      }
      self.rimFrame = RIM.standTalk;
      self.say('TOUGH CROWD.', { at: [self.rimX - self.x, -40], ticks: 90 });
      w.audio.sfx(RIMSHOT_SFX);
      yield 24;
      self.rimFrame = RIM.stand;
    })();
  }

  override update(): void {
    // Drawn facing left and never mirrored: a spawn param `facing` must not flip the part boxes.
    this.facing = 1;
    super.update();
    if (this.state === 'dying' || this.state === 'done') {
      this.animateParts();
      if (this.world.tick % 6 === 0) smokeTrail(this.world, this.x + G.skinC[0] + this.world.fxRng.range(-20, 20), this.y - 100, true);
    }
  }

  override onRemove(): void {
    this.removeHihatSolid();
    super.onRemove?.();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const dead = this.state === 'dying' || this.state === 'done';
    opts.flipX = false;
    opts.flash = false;
    opts.tint = undefined;
    opts.alpha = undefined;
    // Shadows and the charge's dust line first (on the ground).
    if (this.hhShadow > 0) drawShadow(r, Math.round(this.hhX), this.hhGround, 12 + Math.round(this.hhShadow * 28), 0.3 + 0.3 * this.hhShadow);
    if (this.dustLine > 0) {
      const lx = Math.round(this.viewX(G.chargeLine));
      const blink = this.dustLine % 8 < 5;
      for (let k = 0; k < 6; k++) r.rect(lx - 1 + (k % 2), y - 4 - k * 5, 3, 3, blink ? PAL.sand[3] : PAL.sand[1]);
      r.rect(lx - 6, y - 2, 13, 2, PAL.sand[2]);
    }
    // Tread.
    const tf = (((Math.floor(-this.treadPos) % 3) + 3) % 3) as number;
    r.sprite(`${ART}/tread`, tf, x, y, opts);
    if (this.blown[2]) {
      tintOpts.tint = INK;
      tintOpts.alpha = 0.45;
      r.sprite(`${ART}/tread`, tf, x, y, tintOpts);
    }
    // Hull and the bass drum.
    const bass = this.parts[P_BASS];
    if (this.blown[2]) r.sprite(`${ART}/wreck`, 0, x, y, opts);
    else r.sprite(this.partSpriteId(bass), 0, x, y, opts);
    if (!dead && bass.flash >= 3) r.sprite(`${ART}/skin-flash`, 0, x, y, flashOpts);
    if (this.flexT > 0) r.sprite(`${ART}/skin-flex`, this.flexT > 5 ? 1 : 0, x, y, opts);
    // Beater pedal behind the drum's rear skin.
    if (!this.blown[2]) r.sprite(`${ART}/beater`, this.beaterK, x + G.beater[0], y + G.beater[1], opts);
    // Colonel Rimshot.
    this.drawRimshot(r, x, y);
    // Toms.
    this.drawTom(r, P_TOM_L, 0, x, y);
    this.drawTom(r, P_TOM_R, 1, x, y);
    // Hi-hat arm.
    this.drawHihat(r, x, y, dead);
    // Crash shield.
    const sh = this.parts[P_SHIELD];
    if (!this.blown[3] && !sh.destroyed) {
      opts.flash = !dead && sh.flash >= 3;
      const k = this.shieldK;
      r.sprite(this.partSpriteId(sh), k, x + G.shieldPivot[0], y + G.shieldPivot[1], opts);
      opts.flash = false;
    }
    if (this.spareUp) r.sprite(`${ART}/cymbal-saw`, (this.world.tick >> 1) & 3, x + G.rimshotHands[0], y + G.rimshotHands[1] - 6, opts);
  }

  private drawTom(r: Renderer, idx: number, i: 0 | 1, x: number, y: number): void {
    const p = this.parts[idx];
    const a = i === 0 ? TOM_ANCHORS.left : TOM_ANCHORS.right;
    const ax = x + a[0];
    const ay = y + a[1];
    // The bracket from the drum's top hoop to the tom.
    tubeLine(r, x + G.skinC[0] + 6, y + G.skinC[1] - G.skinR[1] + 1, ax, ay + 3, 3);
    if (p.destroyed || this.blown[i]) {
      r.sprite(`${ART}/tom-stump`, 0, ax, ay, opts);
      return;
    }
    opts.flash = p.flash >= 3 && this.state === 'fight';
    const id = this.partSpriteId(p);
    r.sprite(id, this.tomRecoil[i] > 0 ? 1 : 0, ax, ay, opts);
    opts.flash = false;
    if (this.tomFlash > 0 && this.tomFlash % 8 < 4) {
      tintOpts.tint = this.tomFlash % 16 < 8 ? PAL.gold[3] : PAL.snow[3];
      tintOpts.alpha = 0.55;
      r.sprite(id, 0, ax, ay, tintOpts);
    }
  }

  private drawRimshot(r: Renderer, x: number, y: number): void {
    const id = `${ART}/rimshot`;
    if (this.rimOut) {
      r.sprite(id, this.rimFrame, Math.round(this.rimX), Math.round(this.rimY), opts);
      return;
    }
    if (this.blown[2]) return; // inside the drum, about to crawl out
    const [tx, ty] = G.throne;
    if (this.standing) {
      r.sprite(id, this.rimFrame, x + tx, y + ty - 1, opts);
      return;
    }
    const f = getFrame(id, this.rimFrame);
    const hip = f?.pts?.hip;
    const hx = hip ? hip[0] : 0;
    const hy = hip ? hip[1] : -14;
    r.sprite(id, this.rimFrame, x + tx - hx, y + ty - hy - 2, opts);
  }

  private drawHihat(r: Renderer, x: number, y: number, dead: boolean): void {
    const p = this.parts[P_HIHAT];
    const rx = x + G.armRoot[0];
    const ry = y + G.armRoot[1];
    if (p.destroyed || dead) {
      // A limp, broken boom.
      tubeLine(r, rx, ry, rx - 34, ry - 10, 5);
      tubeLine(r, rx - 34, ry - 10, rx - 44, ry + 12, 3);
      r.rect(rx - 3, ry - 3, 7, 7, PAL.steel[1]);
      return;
    }
    const hx = Math.round(this.hhX);
    const hy = Math.round(this.hhY);
    const wx = hx;
    const wy = hy - G.hihatRod;
    const ex = Math.round(wx + 0.35 * (rx - wx));
    const ey = Math.round(Math.min(ry, wy) - 24);
    tubeLine(r, rx, ry, ex, ey, 5);
    tubeLine(r, ex, ey, wx, wy, 3);
    r.rect(ex - 3, ey - 3, 7, 7, INK);
    r.rect(ex - 2, ey - 2, 5, 5, PAL.gold[2]);
    r.rect(ex - 1, ey - 2, 2, 2, PAL.gold[3]);
    r.rect(rx - 4, ry - 4, 9, 9, INK);
    r.rect(rx - 3, ry - 3, 7, 7, PAL.steel[2]);
    r.rect(rx - 3, ry - 3, 7, 2, PAL.steel[4]);
    opts.flash = p.flash >= 3;
    r.sprite(this.partSpriteId(p), this.hhOpen, hx, hy, opts);
    opts.flash = false;
  }
}

/** A shaded tube between two points (an odd `w` of 3 or 5): outline, light top, dark bottom. */
function tubeLine(r: Renderer, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const flat = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  const h = w >> 1;
  for (let o = -h - 1; o <= h + 1; o++) {
    const c = o === -h - 1 || o === h + 1 ? INK : o < 0 ? PAL.steel[4] : o === 0 ? PAL.steel[2] : PAL.steel[1];
    if (flat) r.line(x0, y0 + o, x1, y1 + o, c);
    else r.line(x0 + o, y0, x1 + o, y1, c);
  }
}

defineEntity('ba-dum-behemoth', (w, x, y, p) => new BaDumBehemoth(w, x, y, p), {
  category: 'boss',
  score: 40000,
  description: 'm2 boss: a drum kit on treads (hi-hat arm, two tom mortars, crash shield, bass drum core); Colonel Rimshot tells jokes.',
});
