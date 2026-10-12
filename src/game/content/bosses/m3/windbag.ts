/**
 * THE WINDBAG (Wing Commander Puffington) — the boss of mission m3 (GDD §10.3).
 *
 * A bagpipe airship: the patched tartan bag is the balloon, three drone pipes are cannons, the
 * chanter that hangs under the front of the bag is the main gun, and Puffington talks in his
 * wooden gondola the whole time. It faces left and never flips.
 *
 * Spawn: `ctx.spawn('windbag', x, 'ground')` in the locked `m3-c` arena (LOCK 896–1280). The boss
 * flies in VIEW coordinates (GDD: "floats at view x 180–360, y 10–120"): x follows the locked
 * view's left edge (unlocked: the view's left edge at spawn; spawn param `left` pins it to a world
 * x), y is measured from the floor under the spawn point (the deck, view y 176). It rises from below the summit edge (intro).
 *
 * Parts (required-parts model, GDD §10.0; HP × difficulty × co-op): `drone-1`, `drone-2`,
 * `drone-3` 800 each (required) · `chanter` 1,500 (optional) · `bag` 2,500 (required core; shots
 * and blasts bounce off it with a "boing" while a drone is left).
 *
 * - Phase 1 "The Speech" (drones alive): A Gust, B Drone Bolts, C Sheet-Music Mines, B …; the
 *   speech ticker never ends.
 * - Intermission (60): Puffington drops his notes, the pages scatter in the wind, he starts again
 *   from page one; the airship sinks.
 * - Phase 2 "The Chanter" (drones gone): D Reel (skipped without the chanter), E Pendulum
 *   Gondola, A Gust.
 * - Phase 3 "Hot Air" (bag < 1,000): a patch pops, the bag leaks; F Leak Dash, C, F.
 * - Death (300): the bag deflates with a dying drone chord, loops round the screen three times
 *   and wraps itself round a far-off peak; Puffington parachutes into a snow drift, still talking.
 * Every attack is telegraph (≥ 18 ticks, `telegraphFor`) → attack → recovery (`recoveryFor`).
 * Spawn param `hpScale` (default 1) scales every part's HP (tests, sandbox).
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import { pushX } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { hudOf } from '../../../context';
import { debris, drawShadow, dust, explosion, hitSpark, musicNotes, smokeTrail, snowPuff, steamPuff, tumble } from '../../../fx';
import { isPlayer } from '../../../player/player';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { BAG, CHANTER, CRUISE, DRONES, GONDOLA, GROUND_VY, HOME, WINDBAG } from './layout';
import { BOSS_TAGS, floorAt, HomingNote, ReelNote, SheetMine } from './shots';

const ART = 'boss/windbag';
const DEG = Math.PI / 180;
export const DRONE_NAMES = ['drone-1', 'drone-2', 'drone-3'] as const;
export const WINDBAG_NAME = 'THE WINDBAG';
export const WINDBAG_SUBTITLE = 'WING COMMANDER PUFFINGTON HAS A FEW WORDS';

const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = { alpha: 0.55 };
const lineOpts: DrawOpts = { alpha: 0.75 };

/** The speech that never ends (GDD §10.3), shown as a ticker 18 characters wide. */
const SPEECH =
  'LADIES, GENTLEMEN, CYGNETS... I SHALL BE BRIEF. ' +
  'POINT THE FIRST: THE WIND. I AM IN FAVOUR OF IT. ' +
  'POINT THE SECOND: THE MOUNTAIN, WHICH I SHALL NOW FLY ROUND AT SOME LENGTH. ' +
  'POINT THE THIRD... WHERE WAS I? AH YES... AND FURTHERMORE... ';
const TICKER_W = 18;
const TICKER: readonly string[] = (() => {
  const s = SPEECH + SPEECH.slice(0, TICKER_W);
  const out: string[] = [];
  for (let i = 0; i < SPEECH.length; i++) out.push(s.slice(i, i + TICKER_W));
  return out;
})();
/** Ticks per ticker step. */
const TICKER_STEP = 6;

/** The contact damage of the Pendulum Gondola and the Leak Dash (a boss hit: 1 vehicle cell). */
const CONTACT: Damage = { amount: 10, kind: 'impact', dirX: -1, tags: BOSS_TAGS };

const STREAKS = 20;

type Mode = 'drift' | 'hold' | 'script';
type Contact = 'none' | 'gondola' | 'all';

interface DashPlan {
  kind: 'flat' | 'dive';
  /** View coords: the path line's start and end, the shadow x (dive). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The anchor's end point (dive). */
  ex: number;
  ey: number;
}

export class Windbag extends Boss {
  /** Anchor (the bag centre) in VIEW coordinates. */
  ax: number = 195;
  ay: number = HOME.introFromY;
  /** The deck height under the arena (world y = view y 176). */
  readonly groundY: number;
  private readonly fixedLeft: number | null;
  /** The view's left edge when it spawned (used while the camera is not locked). */
  private readonly spawnLeft: number;
  mode: Mode = 'script';
  /** Where 'hold' glides to (view). */
  homeX: number = HOME.p1.x0;
  homeY: number = HOME.p1.y;
  private driftT = HOME.p1.period / 4;

  // Look state (read by draw).
  /** Bag frame: 0 rest, 1 swell, 2 big swell. */
  swell = 0;
  /** Drone glowing for a Drone Bolt (index) and the ticks left of its telegraph. */
  glowDrone = -1;
  glowT = 0;
  private glowTotal = 1;
  /** Finger holes lit (0..6, the Reel telegraph). */
  holesLit = 0;
  hatchOpen = false;
  /** Gondola top centre relative to the anchor, and the rope (pivot → gondola top). */
  gdx: number = GONDOLA.pivot[0];
  gdy: number = GONDOLA.pivot[1] + GONDOLA.rope;
  /** Puffington's pose (puffington strip frame) and whether he is still aboard. */
  pilotPose = 0;
  pilotAboard = true;
  /** Ticks left of the Gust push. */
  gustT = 0;
  leak = false;
  spurt = 0;
  dash: DashPlan | null = null;
  contact: Contact = 'none';
  /** Death: deflate frame (−1 = the whole airship), gondola gone. */
  deflate = -1;
  gondolaGone = false;
  private propT = 0;
  private nextDrone = 2;
  private dashCount = 0;
  private talkPause = 0;
  private tickerI = 0;
  private lastBoing = -99;
  private readonly loopKey: string;
  private readonly streaks = new Float32Array(STREAKS * 3);
  private readonly cboxes: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private readonly cview: Rect[] = [];
  private readonly bagPart: BossPart;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: WINDBAG_NAME, hp: 1, score: WINDBAG.score });
    this.facing = 1;
    this.z = 28;
    const g = Number.isFinite(y) ? floorAt(world, x, y - 40, y + 40) : Infinity;
    this.groundY = Number.isFinite(g) ? g : Number.isFinite(y) ? y : world.camera.top + GROUND_VY;
    const left = paramNum(p, 'left', NaN);
    this.fixedLeft = Number.isFinite(left) ? left : null;
    this.spawnLeft = world.camera.left;
    this.loopKey = `windbag-${world.tick}-${Math.round(x)}`;
    const k = Math.max(0.01, paramNum(p, 'hpScale', 1));
    for (const d of DRONES) this.addPart(d.name, { box: d.box, hp: WINDBAG.hp.drone * k, required: true });
    this.addPart('chanter', { box: CHANTER.box, hp: WINDBAG.hp.chanter * k });
    this.bagPart = this.addPart('bag', { box: BAG.box, hp: WINDBAG.hp.bag * k, required: true });
    this.phaseIntermission = 0;
    this.phases = [
      { at: 1, name: 'speech', pattern: (b) => b.speechPhase() },
      { name: 'chanter', when: (b) => b.brokenCount(DRONE_NAMES) >= 3, pattern: (b) => b.chanterPhase() },
      { name: 'hot-air', when: (b) => b.phase >= 1 && b.bagHp() < b.bagHotAir(), pattern: (b) => b.hotAirPhase() },
    ];
    this.place();
  }

  // ------------------------------------------------------------------------------- geometry

  /**
   * The arena's left edge: the `left` param, else the locked view's left edge (the m3-c lock eases
   * in, the airship flies with it), else the view's left edge when it spawned (a free camera, e.g.
   * the sandbox: the airship then stays put in the world).
   */
  viewLeft(): number {
    if (this.fixedLeft !== null) return this.fixedLeft;
    const cam = this.world.camera;
    return cam.locked ? cam.left : this.spawnLeft;
  }

  /** World x / y of a view point. */
  wx(vx: number): number {
    return this.viewLeft() + vx;
  }

  wy(vy: number): number {
    return this.groundY - (GROUND_VY - vy);
  }

  /** Move the entity to the anchor (view → world). */
  place(): void {
    // The airship never flips (a spawn `facing` param would mirror the part boxes).
    this.facing = 1;
    this.x = this.wx(this.ax);
    this.y = this.wy(this.ay);
  }

  bagHp(): number {
    return this.bagPart.hp;
  }

  /** The bag HP under which phase 3 starts (GDD: 1,000 of 2,500, scaled like the bag). */
  bagHotAir(): number {
    return (this.bagPart.maxHp * WINDBAG.hotAirBelow) / WINDBAG.hp.bag;
  }

  /** Gondola box (world) at the current swing. */
  private gondolaRect(out: Rect): Rect {
    out.x = this.x + this.gdx - GONDOLA.w / 2;
    out.y = this.y + this.gdy;
    out.w = GONDOLA.w;
    out.h = GONDOLA.h;
    return out;
  }

  /** The lowest point of the airship (view y): the chanter bell or the gondola bottom. */
  bottomVY(): number {
    const g = this.gdy + GONDOLA.h;
    const c = this.partAlive('chanter') ? CHANTER.muzzle[1] : CHANTER.y + 14;
    return this.ay + Math.max(g, c);
  }

  // ------------------------------------------------------------------------------- talk

  private sayLine(text: string, ticks = 90): void {
    this.talkPause = ticks;
    this.say(text, { at: this.speakAt(), ticks });
  }

  private readonly speakPt: [number, number] = [0, 0];

  private speakAt(): readonly [number, number] {
    this.speakPt[0] = this.gdx + GONDOLA.pilotX;
    this.speakPt[1] = this.gdy - 22;
    return this.speakPt;
  }

  /** Back to page one of the speech. */
  restartSpeech(): void {
    this.tickerI = 0;
  }

  // ------------------------------------------------------------------------------- intro

  /** Rises from below the summit edge to its phase 1 spot, tapping the microphone. */
  override *intro(): ScriptGen {
    const total = WINDBAG.intro;
    const x0 = (HOME.p1.x0 + HOME.p1.x1) / 2;
    this.ax = x0;
    this.mode = 'script';
    for (let t = 0; t < total; t++) {
      const k = Math.min(1, t / (total - 20));
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      this.ay = HOME.introFromY + (HOME.p1.y - HOME.introFromY) * e;
      if (t === 10) this.world.audio.sfx('env/wind', { vol: 0.5 });
      if (t === 40) this.sayLine('AHEM! IS THIS THING ON?', 70);
      if (t === 110) this.sayLine('A FEW WORDS, IF I MAY...', 60);
      if (t % 6 === 0 && k < 1) snowPuff(this.world, this.wx(this.ax + this.world.fxRng.range(-80, 80)), this.groundY, 2);
      yield;
    }
    this.restartSpeech();
    this.mode = 'drift';
  }

  // ------------------------------------------------------------------------------- phase 1

  *speechPhase(): ScriptGen {
    this.mode = 'drift';
    yield 20;
    yield* this.sequence([(b) => b.gust(), (b) => b.droneBolts(), (b) => b.mines(), (b) => b.droneBolts()], 20);
  }

  /** A — Gust: the bag swells (T 60, "hoooo"), then exhales: players pushed left for 90 ticks. */
  *gust(): ScriptGen {
    const tele = this.telegraphFor(WINDBAG.gust.tele);
    this.world.audio.sfx('enemy/tuba-inhale', { pitch: 0.7 });
    for (let t = 0; t < tele; t++) {
      this.swell = t < tele * 0.45 ? 1 : 2;
      yield;
    }
    this.swell = 0;
    this.pilotPose = 2;
    this.world.audio.sfx('env/wind');
    this.startGust(WINDBAG.gust.ticks);
    yield WINDBAG.gust.ticks;
    this.pilotPose = 0;
    yield this.recoveryFor(WINDBAG.gust.rec);
  }

  /** Start the wind: streaks across the whole view, `ticks` of push. */
  startGust(ticks: number): void {
    this.gustT = ticks;
    const rng = this.world.fxRng;
    const s = this.streaks;
    for (let i = 0; i < STREAKS; i++) {
      s[i * 3] = rng.range(0, 400);
      s[i * 3 + 1] = rng.range(20, GROUND_VY - 4);
      s[i * 3 + 2] = rng.range(3.5, 6);
    }
  }

  /** B — Drone Bolts: one drone tip glows and hums (T 40; they take turns), 3 homing notes. */
  *droneBolts(): ScriptGen {
    let i = -1;
    for (let k = 0; k < 3; k++) {
      const c = (this.nextDrone + 3 - k) % 3;
      if (this.partAlive(DRONE_NAMES[c])) {
        i = c;
        break;
      }
    }
    if (i < 0) return;
    this.nextDrone = (i + 2) % 3;
    const tele = this.telegraphFor(WINDBAG.bolts.tele);
    this.glowDrone = i;
    this.glowT = this.glowTotal = tele;
    yield tele;
    const n = this.volleySize(WINDBAG.bolts.n);
    const g = DRONES[i];
    for (let k = 0; k < n; k++) {
      if (!this.partAlive(g.name)) break;
      const tx = this.x + g.tx;
      const ty = this.y + g.ty;
      // No off-screen fire (GDD §4.11 rule 3).
      if (this.world.camera.containsPoint(tx, ty, 8)) {
        HomingNote.fire(this.world, tx, ty, this);
        musicNotes(this.world, tx, ty, 1, 4, 30);
        this.world.audio.sfx('enemy/piccolo-shot', { pitch: 0.6, vol: 0.7 });
      }
      this.glowT = 6;
      if (k < n - 1) yield WINDBAG.bolts.gap;
    }
    this.glowDrone = -1;
    this.glowT = 0;
    yield this.recoveryFor(WINDBAG.bolts.rec);
  }

  /** C — Sheet-Music Mines: the hatch flaps (T 20), 4 pages flutter down. */
  *mines(): ScriptGen {
    const tele = this.telegraphFor(WINDBAG.mines.tele);
    this.world.audio.sfx('enemy/fumble');
    for (let t = 0; t < tele; t++) {
      this.hatchOpen = (t >> 2) % 2 === 1;
      yield;
    }
    this.hatchOpen = true;
    this.pilotPose = 2;
    const n = this.volleySize(WINDBAG.mines.n);
    for (let k = 0; k < n; k++) {
      const hx = this.x + this.gdx + GONDOLA.hatchX;
      const hy = this.y + this.gdy + GONDOLA.h + 2;
      // Spread over the arena: from a long drift toward the players to a short one backwards.
      const f = n > 1 ? k / (n - 1) : 0.5;
      const vx = -1.9 + 2.3 * f + this.world.rng.range(-0.15, 0.15);
      SheetMine.toss(this.world, hx, hy, vx, this);
      this.world.audio.sfx('weapon/grenade-throw', { vol: 0.4, pitch: 1.4 });
      yield 6;
    }
    this.hatchOpen = false;
    this.pilotPose = 0;
    yield this.recoveryFor(WINDBAG.mines.rec);
  }

  // ------------------------------------------------------------------------------- phase 2

  *chanterPhase(): ScriptGen {
    this.resetLooks();
    // Intermission gag: the notes go, the pages scatter in the wind, back to page one.
    this.intermission(WINDBAG.intermission);
    this.pilotPose = 3;
    this.sayLine('MY NOTES! ...OH, BOTHER. FROM THE TOP: PAGE ONE!', WINDBAG.intermission + 30);
    this.scatterPages();
    this.homeX = HOME.p2.x;
    this.homeY = HOME.p2.y;
    this.mode = 'hold';
    yield WINDBAG.intermission;
    this.pilotPose = 0;
    this.restartSpeech();
    yield* this.sequence([(b) => b.reel(), (b) => b.pendulum(), (b) => b.gust()], 20);
  }

  private scatterPages(): void {
    const w = this.world;
    const px = this.x + this.gdx + GONDOLA.pilotX;
    const py = this.y + this.gdy - 14;
    for (let i = 0; i < 10; i++) {
      tumble(w, `${ART}/page`, px + w.fxRng.range(-6, 6), py + w.fxRng.range(-4, 4), -w.fxRng.range(0.6, 3.2), w.fxRng.range(-2.4, -0.4), { gravity: 0.03, life: 150, z: 60 });
    }
    this.startGust(40);
    this.gustT = 0;
    w.audio.sfx('env/wind', { vol: 0.6 });
  }

  /** D — Reel: the finger holes light up (T 30), a stream of notes sweeps a line across the deck. */
  *reel(): ScriptGen {
    if (!this.partAlive('chanter')) return;
    yield* this.waitHome(90);
    const tele = this.telegraphFor(WINDBAG.reel.tele);
    this.world.audio.sfx('enemy/piccolo-whistle', { pitch: 0.8 });
    const holes = CHANTER.holes.length;
    for (let t = 0; t < tele; t++) {
      this.holesLit = Math.min(holes, Math.floor(((t + 1) * (holes + 1)) / tele));
      yield;
    }
    this.holesLit = holes;
    const sweep = WINDBAG.reel.sweep;
    const flight = WINDBAG.reel.flight;
    this.pilotPose = 2;
    for (let t = 0; t <= sweep - WINDBAG.reel.every; t += WINDBAG.reel.every) {
      if (!this.partAlive('chanter')) break;
      const bx = this.x + CHANTER.muzzle[0];
      const by = this.y + CHANTER.muzzle[1];
      // The impact line: far left → toward the airship's front.
      const l = 8;
      const r = this.ax + CHANTER.muzzle[0] - 26;
      const tx = this.wx(l + ((r - l) * t) / sweep);
      const f = floorAt(this.world, tx, this.groundY - 48, this.groundY + 24);
      ReelNote.lob(this.world, bx, by, tx, Number.isFinite(f) ? f : this.groundY, flight, this);
      if (t % 8 === 0) this.world.audio.sfx('enemy/piccolo-shot', { vol: 0.35, pitch: 1.2 + t / 120 });
      this.holesLit = (t >> 2) % 2 === 0 ? holes : holes - 2;
      yield WINDBAG.reel.every;
    }
    this.holesLit = 0;
    this.pilotPose = 0;
    yield flight;
    yield this.recoveryFor(WINDBAG.reel.rec);
  }

  /** E — Pendulum Gondola: the ropes creak and it pulls back (T 40), then swings across. */
  *pendulum(): ScriptGen {
    yield* this.waitHome(90);
    const sw = HOME.swing;
    const tele = this.telegraphFor(WINDBAG.pendulum.tele);
    const [px, py] = GONDOLA.pivot;
    this.mode = 'script';
    this.world.audio.sfx('machine/brake', { pitch: 0.45, vol: 0.7 });
    const sx = this.ax;
    const sy = this.ay;
    // Telegraph: rise to the swing height, pay out the rope, pull the gondola back.
    for (let t = 0; t < tele; t++) {
      const k = (t + 1) / tele;
      const e = k * k * (3 - 2 * k);
      this.ax = sx + (sw.x0 - sx) * e;
      this.ay = sy + (sw.y - sy) * e;
      const rope = GONDOLA.rope + (sw.rope - GONDOLA.rope) * e;
      const th = sw.deg * DEG * e;
      this.gdx = px + rope * Math.sin(th);
      this.gdy = py + rope * Math.cos(th);
      if (t % 10 === 0) this.world.audio.sfx('machine/brake', { pitch: 0.35 + k * 0.2, vol: 0.4 });
      yield;
    }
    // The swing: the anchor crosses the arena while the gondola swings through its lowest point.
    this.contact = 'gondola';
    this.contactDamage = CONTACT;
    this.pilotPose = 3;
    for (let t = 0; t <= sw.ticks; t++) {
      const k = t / sw.ticks;
      this.ax = sw.x0 + (sw.x1 - sw.x0) * k;
      this.ay = sw.y;
      const th = sw.deg * DEG * Math.cos(Math.PI * k);
      this.gdx = px + sw.rope * Math.sin(th);
      this.gdy = py + sw.rope * Math.cos(th);
      if (t === Math.floor(sw.ticks / 2)) this.world.audio.sfx('env/wind', { vol: 0.5 });
      if (t % 4 === 0 && Math.abs(th) < 20 * DEG) snowPuff(this.world, this.x + this.gdx, this.groundY, 2);
      yield;
    }
    this.contact = 'none';
    this.contactDamage = null;
    this.pilotPose = 0;
    // Reel the rope in while recovering.
    const rec = this.recoveryFor(WINDBAG.pendulum.rec);
    const gx = this.gdx;
    const gy = this.gdy;
    for (let t = 0; t < rec; t++) {
      const k = Math.min(1, (t + 1) / Math.min(rec, 30));
      this.gdx = gx + (px - gx) * k;
      this.gdy = gy + (py + GONDOLA.rope - gy) * k;
      yield;
    }
    this.gdx = px;
    this.gdy = py + GONDOLA.rope;
    this.mode = 'hold';
  }

  // ------------------------------------------------------------------------------- phase 3

  *hotAirPhase(): ScriptGen {
    this.resetLooks();
    this.intermission(WINDBAG.intermission);
    const lx = this.x + BAG.leak[0];
    const ly = this.y + BAG.leak[1];
    explosion(this.world, lx, ly, 's', { team: 'neutral', damage: 0, debris: 'cloth' });
    this.world.audio.sfx('boss/deflate');
    this.world.camera.shake(3, 16);
    this.leak = true;
    this.spurt = 30;
    this.pilotPose = 3;
    this.sayLine('PFFT! A MERE PUNCTURE. NOW, WHERE WAS I?', WINDBAG.intermission + 30);
    this.homeX = HOME.p3.x;
    this.homeY = HOME.p3.y;
    this.mode = 'hold';
    yield WINDBAG.intermission;
    this.pilotPose = 0;
    yield* this.sequence([(b) => b.leakDash(), (b) => b.mines(), (b) => b.leakDash()], 20);
  }

  /**
   * F — Leak Dash: the leak spurts and a dotted line shows the path (T 30): a level dash with the
   * airship's bottom above standing heads, or a dive at a marked shadow on the deck. It dashes
   * at 4 px/tick (contact hurts), bounces once (view edge / deck) and stops.
   */
  *leakDash(): ScriptGen {
    yield* this.waitHome(120);
    this.mode = 'script';
    const flat = this.dashCount++ % 2 === 0;
    const bell = CHANTER.muzzle;
    const low = this.bottomVY() - this.ay;
    if (flat) {
      const y = this.ay + low + 2;
      this.dash = { kind: 'flat', x0: this.ax + bell[0] - 6, y0: y, x1: 0, y1: y, ex: BAG.rx + 2, ey: this.ay };
    } else {
      // The dive meets the deck at a shadow under the nearest player, never so far left that the
      // footprint traps a player against the view edge.
      const t = this.world.nearestPlayer(this.x, this.groundY);
      const pvx = t ? t.x - this.viewLeft() : 120;
      const s = Math.max(110, Math.min(this.ax - 70, pvx));
      const ey = GROUND_VY - low;
      this.dash = { kind: 'dive', x0: this.ax + bell[0], y0: this.ay + low, x1: s, y1: GROUND_VY, ex: s - bell[0], ey };
    }
    const tele = this.telegraphFor(WINDBAG.dash.tele);
    this.spurt = tele;
    this.pilotPose = 3;
    this.world.audio.sfx('boss/deflate', { vol: 0.8 });
    yield tele;
    // Wind-up: leans back a little.
    for (let t = 0; t < WINDBAG.dash.windup; t++) {
      this.ax += 0.75;
      yield;
    }
    const plan = this.dash;
    this.contact = 'all';
    this.contactDamage = CONTACT;
    const sp = WINDBAG.dash.speed;
    if (plan.kind === 'flat') {
      // Left until the bag's front meets the view edge, bounce, coast back and stop.
      while (this.ax - BAG.rx > 2) {
        this.ax -= sp;
        this.dashTrail();
        yield;
      }
      this.bounceFx(this.x - BAG.rx, this.y);
      let v = sp;
      while (v > 0) {
        this.ax += v;
        v -= sp / WINDBAG.dash.after;
        this.dashTrail();
        yield;
      }
    } else {
      const dx = plan.ex - this.ax;
      const dy = plan.ey - this.ay;
      const len = Math.max(1, Math.hypot(dx, dy));
      const steps = Math.max(1, Math.ceil(len / sp));
      const vx = dx / steps;
      const vy = dy / steps;
      for (let t = 0; t < steps; t++) {
        this.ax += vx;
        this.ay += vy;
        this.dashTrail();
        yield;
      }
      this.ax = plan.ex;
      this.ay = plan.ey;
      // Off the deck: straight up, slowing to a stop.
      this.bounceFx(this.x + plan.x1 - plan.ex, this.groundY);
      let v = sp;
      while (v > 0) {
        this.ay -= v;
        v -= sp / WINDBAG.dash.after;
        this.dashTrail();
        yield;
      }
    }
    this.dash = null;
    this.contact = 'none';
    this.contactDamage = null;
    this.pilotPose = 0;
    yield this.recoveryFor(WINDBAG.dash.rec);
    this.mode = 'hold';
  }

  private dashTrail(): void {
    if (this.world.tick % 2 === 0) steamPuff(this.world, this.x + BAG.leak[0] + 4, this.y + BAG.leak[1] - 2, 1.2, -0.4);
  }

  private bounceFx(x: number, y: number): void {
    this.world.camera.shake(4, 14);
    this.world.audio.sfx('hit/drum', { pitch: 0.5 });
    this.world.audio.sfx('weapon/mine-bounce', { pitch: 0.6 });
    snowPuff(this.world, x, y, 8);
    dust(this.world, x, y, 4);
  }

  /** Glide to the 'hold' home first (at most `max` ticks), so attacks start from their spot. */
  *waitHome(max: number): ScriptGen {
    this.mode = 'hold';
    for (let t = 0; t < max; t++) {
      if (Math.abs(this.ax - this.homeX) < 2 && Math.abs(this.ay - this.homeY) < 4) return;
      yield;
    }
  }

  private resetLooks(): void {
    this.swell = 0;
    this.glowDrone = -1;
    this.glowT = 0;
    this.holesLit = 0;
    this.hatchOpen = false;
    this.gustT = 0;
    this.dash = null;
    this.contact = 'none';
    this.contactDamage = null;
    this.gdx = GONDOLA.pivot[0];
    this.gdy = GONDOLA.pivot[1] + GONDOLA.rope;
  }

  // ------------------------------------------------------------------------------- per tick

  protected override think(): void {
    const w = this.world;
    this.propT++;
    if (this.glowT > 0) this.glowT--;
    if (this.spurt > 0) this.spurt--;
    if (this.talkPause > 0) this.talkPause--;
    // Movement: phase 1 drifts, 'hold' glides home; both bob a little.
    if (this.state === 'fight' && this.mode !== 'script') {
      let tx = this.homeX;
      let ty = this.homeY;
      if (this.mode === 'drift') {
        const d = HOME.p1;
        this.driftT++;
        tx = d.x0 + (d.x1 - d.x0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * this.driftT) / d.period));
        ty = d.y;
      }
      ty += Math.sin(w.tick / 40) * 2;
      const dx = tx - this.ax;
      const dy = ty - this.ay;
      const dist = Math.hypot(dx, dy);
      if (dist <= CRUISE) {
        this.ax = tx;
        this.ay = ty;
      } else {
        this.ax += (dx / dist) * CRUISE;
        this.ay += (dy / dist) * CRUISE;
      }
    }
    this.place();
    this.updateWind();
    this.updateSound();
    // The speech ticker (it never ends; lines and intermissions pause it).
    if ((this.state === 'fight' || this.state === 'intro') && this.talkPause <= 0 && this.pilotAboard && w.tick % TICKER_STEP === 0) {
      this.say(TICKER[this.tickerI], { at: this.speakAt(), ticks: TICKER_STEP + 2 });
      this.tickerI = (this.tickerI + 1) % TICKER.length;
    }
    // The leak hisses steam; a spurt before a dash.
    if (this.leak && w.tick % (this.spurt > 0 ? 2 : 7) === 0) {
      steamPuff(w, this.x + BAG.leak[0] + 2, this.y + BAG.leak[1] - 2, w.fxRng.range(0.3, this.spurt > 0 ? 1.6 : 0.8), -w.fxRng.range(0.2, 0.7));
    }
    // Part damage looks: smoke at ≤ 50 %, sparks at ≤ 25 %, a smoking stump when gone.
    if (w.tick % 8 === 0) {
      for (let i = 0; i < 4; i++) {
        const p = this.parts[i];
        const st = this.partState(p);
        if (st === 0) continue;
        if (st === 1 && w.tick % 16 !== 0) continue;
        let cx: number;
        let cy: number;
        if (i < 3) {
          const g = DRONES[i];
          const k = p.destroyed ? 0.25 : w.fxRng.range(0.4, 0.9);
          cx = this.x + g.bx + (g.tx - g.bx) * k;
          cy = this.y + g.by + (g.ty - g.by) * k;
        } else {
          cx = this.x + CHANTER.x;
          cy = this.y + CHANTER.y + (p.destroyed ? 14 : w.fxRng.range(12, 46));
        }
        smokeTrail(w, cx, cy, true);
        if (st === 2 && !p.destroyed) hitSpark(w, cx, cy, 1);
      }
      if (this.partState(this.bagPart) === 2) smokeTrail(w, this.x + w.fxRng.range(-60, 60), this.y + w.fxRng.range(-10, 30), true);
    }
  }

  /** The Gust: push every player (or the vehicle they ride) to the left; draw streaks. */
  private updateWind(): void {
    const s = this.streaks;
    const anyStreak = this.gustT > 0 || s[0] > -100;
    if (anyStreak) {
      for (let i = 0; i < STREAKS; i++) {
        s[i * 3] -= s[i * 3 + 2];
        if (this.gustT > 0 && s[i * 3] < -30) s[i * 3] += 430;
      }
      if (this.gustT <= 0 && s[0] < -100) for (let i = 0; i < STREAKS; i++) s[i * 3] = -200;
    }
    if (this.gustT <= 0) return;
    this.gustT--;
    const players = this.world.byTag('player');
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!isPlayer(p) || !p.alive) continue;
      const riding = p.state === 'mounted' && p.vehicle !== null && p.vehicle.alive;
      if (p.state !== 'play' && !riding) continue;
      const mover = riding && p.vehicle ? p.vehicle : p;
      if (mover !== p) {
        // Push a shared vehicle once (the first rider pushes it).
        let first = true;
        for (let j = 0; j < i; j++) {
          const q = players[j];
          if (isPlayer(q) && q.vehicle === p.vehicle) first = false;
        }
        if (!first) continue;
      }
      pushX(mover, -WINDBAG.gust.push, this.world.terrain, this.world);
    }
  }

  private updateSound(): void {
    const a = this.world.audio;
    const drones = 3 - this.brokenCount(DRONE_NAMES);
    if ((this.state === 'fight' || this.state === 'intro') && drones > 0) {
      const tele = this.glowT > 0 && this.glowDrone >= 0 ? 1 - this.glowT / this.glowTotal : 0;
      a.sfxLoop?.(this.loopKey, 'boss/bagpipe-drone', { vol: 0.16 + 0.05 * drones + tele * 0.3, pitch: 1 + tele * 0.35 });
    } else a.stopSfx?.(this.loopKey, 20);
  }

  override contactBoxes(): readonly Rect[] {
    const out = this.cview;
    out.length = 0;
    if (this.contact === 'none') return out;
    out.push(this.gondolaRect(this.cboxes[0]));
    if (this.contact === 'all') {
      const b = this.cboxes[1];
      b.x = this.x + BAG.box.x;
      b.y = this.y + BAG.box.y;
      b.w = BAG.box.w;
      b.h = BAG.box.h;
      out.push(b);
      if (this.partAlive('chanter')) {
        const c = this.cboxes[2];
        c.x = this.x + CHANTER.box.x;
        c.y = this.y + CHANTER.box.y;
        c.w = CHANTER.box.w;
        c.h = CHANTER.box.h;
        out.push(c);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------------------- damage

  override onHit(d: Damage, part = 0): boolean {
    const p = this.parts[part];
    if (p === this.bagPart && this.state === 'fight' && this.invulnTicks <= 0 && this.brokenCount(DRONE_NAMES) < 3) {
      // GDD: shots bounce off the bag with a "boing" until all three drones are gone.
      if (this.world.tick - this.lastBoing >= 6) {
        this.lastBoing = this.world.tick;
        this.world.audio.sfx('weapon/mine-bounce', { pitch: 0.8, vol: 0.6 });
        const src = d.source as Entity | undefined;
        if (src) hitSpark(this.world, src.x, src.y, -(d.dirX || 1));
      }
      return true;
    }
    return super.onHit(d, part);
  }

  protected override onPartBroken(p: BossPart): void {
    this.world.camera.shake(4, 20);
    if (p.name.startsWith('drone')) {
      if (this.glowDrone >= 0 && DRONE_NAMES[this.glowDrone] === p.name) {
        this.glowDrone = -1;
        this.glowT = 0;
      }
      const left = 3 - this.brokenCount(DRONE_NAMES);
      if (left > 0) this.sayLine(left === 2 ? 'MY TENOR DRONE! THE IMPUDENCE!' : 'THAT WAS MY BASS DRONE!', 70);
    } else if (p.name === 'chanter') {
      this.holesLit = 0;
      this.world.audio.sfx('machine/sad-notes', { vol: 0.6 });
      this.sayLine('MY CHANTER! A FAMILY HEIRLOOM!', 80);
    }
  }

  protected override onDamageState(): void {
    // Every part carries its own damage looks (think, draw).
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.resetLooks();
    this.hush();
    this.leak = true;
    this.world.audio.stopSfx?.(this.loopKey, 10);
  }

  protected override deathSequence(): ScriptGen | null {
    return this.deflateShow();
  }

  /** 300 ticks: deflate, three loops round the screen, off to a far peak; Puffington bails out. */
  *deflateShow(): ScriptGen {
    const w = this.world;
    const total = WINDBAG.death;
    w.audio.sfx('boss/bagpipe-die');
    const loops = 3;
    const l0 = 30;
    const l1 = 210;
    const sx = this.ax;
    const sy = this.ay;
    const cx = 192;
    const cy = 80;
    let lastX = sx;
    let lastY = sy;
    for (let t = 0; t < total; t++) {
      // Patches burst.
      if (t < 24 && t % 6 === 0) {
        const p = this.randomPoint();
        explosion(w, p[0], p[1], t % 12 === 0 ? 'm' : 's', { silent: t % 12 !== 0, shake: 3, debris: 'cloth' });
      }
      if (t === 12) {
        this.pilotPose = 4;
        this.sayLine('...AND IN CONCLUSION-', 40);
      }
      if (t === 24) {
        // Puffington bails out with his parachute.
        this.pilotAboard = false;
        this.hush();
        const px = this.x + this.gdx + GONDOLA.pilotX;
        const py = this.y + this.gdy;
        const landX = this.viewLeft() + Math.max(80, Math.min(300, this.ax));
        w.spawn('windbag-puffington', px, py, { landX, floorY: this.groundY });
      }
      if (t === l0) {
        // The empty gondola drops off.
        this.gondolaGone = true;
        explosion(w, this.x + this.gdx, this.y + this.gdy + 10, 'm', { debris: 'wood' });
        debris(w, this.x + this.gdx, this.y + this.gdy + 10, 'wood', 8);
      }
      if (t < l0) {
        this.ax = sx + Math.sin(t * 0.9) * 2;
        this.ay = sy;
      } else if (t < l1) {
        // Three loops round the screen, the bag shrinking as it goes.
        const k = (t - l0) / (l1 - l0);
        const a = Math.PI + k * loops * Math.PI * 2;
        const rx = 150 - 40 * k;
        const ry = 58 - 14 * k;
        const blend = Math.min(1, (t - l0) / 20);
        const lx = cx + Math.cos(a) * rx;
        const ly = cy + Math.sin(a) * ry * (a % (Math.PI * 2) < Math.PI ? 1 : 0.8);
        this.ax = sx + (lx - sx) * blend;
        this.ay = sy + (ly - sy) * blend;
        this.deflate = Math.min(3, Math.floor(k * 4));
      } else if (t < 270) {
        // Off to the far peak, smaller and smaller.
        const k = (t - l1) / 60;
        this.ax = lastX + (322 - lastX) * k;
        this.ay = lastY + (68 - lastY) * k;
        this.deflate = k < 0.5 ? 3 : 4;
      } else if (t === 270) {
        // Wrapped round the peak.
        this.deflate = -2;
        const wreck = w.spawn('windbag-wreck', this.wx(322), this.wy(98), {});
        wreck.z = -20;
        w.audio.sfx('hit/ground', { vol: 0.3 });
      }
      if (t === l1 - 1) {
        lastX = this.ax;
        lastY = this.ay;
      }
      // The jet of air out of the leak.
      if (t >= l0 && t < 270 && t % 2 === 0) {
        const dx = this.ax - lastX;
        steamPuff(w, this.x + w.fxRng.range(-4, 4), this.y, -Math.sign(dx || 1) * 0.6, 0.2);
      }
      if (t < l1) {
        lastX = this.ax;
        lastY = this.ay;
      }
      this.place();
      yield;
    }
  }

  override onRemove(): void {
    this.world.audio.stopSfx?.(this.loopKey, 10);
    this.hush();
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  private piece(r: Renderer, id: string, frame: number, x: number, y: number, flash = false): void {
    drawOpts.flipX = false;
    drawOpts.flash = flash;
    r.sprite(id, frame, Math.round(x), Math.round(y), drawOpts);
  }

  private glow(r: Renderer, id: string, frame: number, x: number, y: number, color: number): void {
    tintOpts.tint = color;
    tintOpts.flipX = false;
    r.sprite(id, frame, Math.round(x), Math.round(y), tintOpts);
  }

  override draw(r: Renderer): void {
    if (this.state === 'done') return;
    const w = this.world;
    const x = this.x;
    const y = this.y;
    if (this.deflate === -2) return;
    if (this.deflate >= 0) {
      this.piece(r, `${ART}/deflate`, this.deflate, x, y);
      this.drawOverlays(r);
      return;
    }
    // Drones (their roots hide behind the bag).
    for (let i = 0; i < 3; i++) {
      const p = this.parts[i];
      const g = DRONES[i];
      if (p.destroyed) {
        this.piece(r, `${ART}/${g.name}-2`, 1, x + g.bx, y + g.by);
        continue;
      }
      const id = `${ART}/${g.name}-${this.partState(p)}`;
      this.piece(r, id, 0, x + g.bx, y + g.by, p.flash >= 3);
      if (this.glowDrone === i && this.glowT > 0) {
        if (this.glowT % 6 < 4) this.glow(r, id, 0, x + g.bx, y + g.by, this.glowT % 12 < 6 ? PAL.orange[1] : PAL.pink[1]);
        // The tip itself glows, growing as the hum rises.
        const k = 1 - this.glowT / this.glowTotal;
        const s = 2 + Math.round(k * 4);
        r.rect(Math.round(x + g.tx - s / 2), Math.round(y + g.ty - s / 2), s, s, (w.tick >> 1) % 2 === 0 ? PAL.gold[3] : PAL.orange[2]);
      }
    }
    // Chanter.
    const ch = this.parts[3];
    const cx = x + CHANTER.x;
    const cy = y + CHANTER.y;
    if (ch.destroyed) this.piece(r, `${ART}/chanter-2`, 1, cx, cy);
    else {
      this.piece(r, `${ART}/chanter-${this.partState(ch)}`, 0, cx, cy, ch.flash >= 3);
      for (let i = 0; i < this.holesLit; i++) r.rect(Math.round(cx) - 1, Math.round(cy) + CHANTER.holes[i], 2, 2, i % 2 === 0 ? PAL.gold[3] : PAL.orange[2]);
    }
    // Ropes (bag → gondola corners).
    if (!this.gondolaGone) {
      const gx = x + this.gdx;
      const gy = y + this.gdy;
      const rope = PAL.brown[1];
      r.line(Math.round(x + GONDOLA.ropeL[0]), Math.round(y + GONDOLA.ropeL[1]), Math.round(gx - GONDOLA.w / 2 + 3), Math.round(gy), rope);
      r.line(Math.round(x + GONDOLA.ropeL[0] + 6), Math.round(y + GONDOLA.ropeL[1]), Math.round(gx - 6), Math.round(gy), rope);
      r.line(Math.round(x + GONDOLA.ropeR[0] - 6), Math.round(y + GONDOLA.ropeR[1] + 2), Math.round(gx + 6), Math.round(gy), rope);
      r.line(Math.round(x + GONDOLA.ropeR[0]), Math.round(y + GONDOLA.ropeR[1]), Math.round(gx + GONDOLA.w / 2 - 3), Math.round(gy), rope);
    }
    // Bag.
    const bag = this.bagPart;
    this.piece(r, `${ART}/bag-${this.dead ? 2 : this.partState(bag)}`, this.swell, x, y, bag.flash >= 3);
    if (this.leak) this.piece(r, `${ART}/leak`, (w.tick >> 2) & 1, x + BAG.leak[0], y + BAG.leak[1]);
    // Puffington behind the gondola rail, then the gondola and the propeller.
    if (!this.gondolaGone) {
      const gx = x + this.gdx;
      const gy = y + this.gdy;
      if (this.pilotAboard) {
        drawOpts.flipX = true;
        drawOpts.flash = false;
        const talk = this.pilotPose === 0 ? (w.tick >> 3) & 1 : this.pilotPose;
        r.sprite(`${ART}/puffington`, talk, Math.round(gx + GONDOLA.pilotX), Math.round(gy + 10), drawOpts);
      }
      this.piece(r, `${ART}/gondola`, this.hatchOpen ? 1 : 0, gx, gy);
      this.piece(r, `${ART}/prop`, (this.propT >> 1) & 3, gx + GONDOLA.prop[0], gy + GONDOLA.prop[1]);
    }
    this.drawOverlays(r);
  }

  /** Wind streaks and the Leak Dash path. */
  private drawOverlays(r: Renderer): void {
    const s = this.streaks;
    if (s[0] > -150) {
      for (let i = 0; i < STREAKS; i++) {
        const sx = this.wx(s[i * 3]);
        const sy = Math.round(this.wy(s[i * 3 + 1]));
        const len = Math.round(s[i * 3 + 2] * 4);
        r.line(Math.round(sx), sy, Math.round(sx + len), sy, i % 3 === 0 ? PAL.snow[3] : PAL.snow[1], lineOpts);
      }
    }
    const d = this.dash;
    if (!d || this.contact !== 'none') return;
    const on = (this.world.tick >> 2) % 2 === 0;
    const col = on ? PAL.red[3] : PAL.gold[3];
    const x0 = d.x0;
    const y0 = d.y0;
    const x1 = d.x1;
    const y1 = d.y1;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.floor(len / 6);
    for (let i = 0; i <= n; i++) {
      const k = i / Math.max(1, n);
      const px = this.wx(x0 + (x1 - x0) * k);
      const py = this.wy(y0 + (y1 - y0) * k);
      r.rect(Math.round(px) - 1, Math.round(py), 4, 2, col);
    }
    if (d.kind === 'dive') {
      // The shadow: the airship's footprint on the deck.
      const gy = this.groundY;
      for (let k = -1; k <= 2; k++) drawShadow(r, this.wx(x1 + 6 + k * 40), gy, 48, on ? 0.55 : 0.4);
      const sx = Math.round(this.wx(x1));
      r.line(sx - 3, gy - 6, sx + 3, gy, col);
      r.line(sx - 3, gy, sx + 3, gy - 6, col);
    }
  }
}

defineEntity('windbag', (w, x, y, p) => new Windbag(w, x, y, p), {
  category: 'boss',
  score: WINDBAG.score,
  description: 'THE WINDBAG (m3 boss): Wing Commander Puffington\'s bagpipe airship. Flies in view coordinates over the floor under (x, y); parts drone-1..3, chanter, bag.',
});

// ---------------------------------------------------------------------------------------------
// Puffington after the fall, and the bag on the far peak
// ---------------------------------------------------------------------------------------------

/**
 * Wing Commander Puffington under his parachute: drifts down to `landX` still talking, lands
 * head-first in a snow drift (legs kicking) and keeps going: `...MMF... AND FURTHERMORE...`.
 * Cosmetic; stays until the section ends.
 */
export class Puffington extends Entity {
  private t = 0;
  private landed = false;
  private readonly landX: number;
  private readonly floorY: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.landX = paramNum(p, 'landX', x);
    const f = paramNum(p, 'floorY', NaN);
    const g = floorAt(world, this.landX, y, y + 400);
    this.floorY = Number.isFinite(f) ? f : Number.isFinite(g) ? g : y + 60;
    this.z = 34;
    // Tall while under the canopy (his bubble floats over it), short in the drift.
    this.hitbox = { x: -10, y: -66, w: 20, h: 66 };
    this.despawnMargin = Infinity;
    this.vy = -2.2;
  }

  override update(): void {
    const t = ++this.t;
    const hud = hudOf(this.world);
    if (!this.landed) {
      // A hop out of the gondola, then the chute opens: a slow, swaying drift.
      if (t < 20) this.vy += 0.15;
      else this.vy = Math.min(0.55, this.vy + 0.05);
      this.x += (this.landX - this.x) * 0.02 + Math.sin(t / 20) * 0.3;
      this.y += this.vy;
      if (t === 24) this.world.audio.sfx('swan/flap', { pitch: 0.7, vol: 0.6 });
      if (t === 30) hud.bubble(this, '...WHICH BRINGS ME, BRIEFLY, TO MY NEXT POINT...', { kind: 'gag', ticks: 140 });
      if (this.y >= this.floorY) {
        this.y = this.floorY;
        this.landed = true;
        this.t = 0;
        this.hitbox.y = -34;
        this.hitbox.h = 34;
        snowPuff(this.world, this.x, this.y - 6, 14);
        this.world.audio.sfx('player/land', { pitch: 0.7 });
        this.world.camera.shake(1, 6);
        hud.clearBubble(this);
      }
      return;
    }
    if (t === 20 || (t > 20 && t % 240 === 20)) hud.bubble(this, '...MMF... AND FURTHERMORE...', { kind: 'gag', ticks: 150, dy: -6 });
    if (t % 30 === 0) snowPuff(this.world, this.x + this.world.fxRng.range(-6, 6), this.y - 16, 2);
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = true;
    drawOpts.flash = false;
    if (!this.landed) r.sprite(`${ART}/puff-chute`, (this.t >> 4) & 1, Math.round(this.x), Math.round(this.y), drawOpts);
    else r.sprite(`${ART}/puff-drift`, (this.t >> 3) & 1, Math.round(this.x), Math.round(this.y), drawOpts);
  }

  override onRemove(): void {
    hudOf(this.world).clearBubble(this);
  }
}

defineEntity('windbag-puffington', (w, x, y, p) => new Puffington(w, x, y, p), {
  category: 'fx',
  description: 'THE WINDBAG: Puffington parachuting into a snow drift after the fight (params landX, floorY).',
});

/** The empty bag wrapped round a far-off peak (cosmetic; the end of the death sequence). */
export class WindbagWreck extends Entity {
  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.z = -20;
    this.hitbox = { x: -22, y: -30, w: 44, h: 30 };
    this.despawnMargin = Infinity;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(`${ART}/peak-rag`, 0, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

defineEntity('windbag-wreck', (w, x, y) => new WindbagWreck(w, x, y), { category: 'fx', description: 'THE WINDBAG: the deflated bag wrapped round a far peak.' });
