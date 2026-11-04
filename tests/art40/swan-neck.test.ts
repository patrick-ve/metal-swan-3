/**
 * The Swan at 40 px, stage 2, the neck and the gun (docs/design/ams40.md wave 7, "The Swan", D3):
 * the baked set `swan-neck` (src/game/content/art40/swan-neck.gen.ts, drawn by
 * tools/art40/chars/swan-neck/) draws every neck strip as aims × phases: the free neck with its
 * face and the barrel on the drum's hub at the aim (θ = +45° − 22.5°·i); `muzzle` = `cannon` = the
 * resting barrel's tip on every phase of an aim. The code (swan.ts pickNeck, neck.ts) picks an
 * existing frame at every tick, the faces keep their logic time, and the shots leave from the
 * barrel tip; the gameplay numbers stay (plan D7).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import { buttonMask, VirtualPad, type Button } from '../../src/engine/input';
import { frameCount, framePoint, getFrame, getFrames, hasHiSprite, hasSprite, spriteAnim, type Frame } from '../../src/engine/sprites';
import { Terrain, terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import * as GEN from '../../src/game/content/art40/swan-neck.gen';
import '../../src/game/content/characters/index';
import { MUZZLE_REL, SWAN } from '../../src/game/content/vehicles/swan/constants';
import '../../src/game/content/vehicles/swan/index';
import type { Swan } from '../../src/game/content/vehicles/swan/index';
import { NECK_REST_AIM, NECK_REST_FRAME, restFrame, neckAims, neckFaceTicks, neckFrame, neckPhaseAt, neckPhases, relaxFrame } from '../../src/game/content/vehicles/swan/neck';
import '../../src/game/content/weapons/index';
import { attachGame, HudState } from '../../src/game/context';
import { Player } from '../../src/game/player/player';
import { gameEntityFactory } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { applyTuning } from '../../src/game/tuning';

applyTuning();
const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[art]')) return;
  warn(...args);
});

const SET: BakedSet = GEN.SET;
const P1 = 'vehicle/swan';
const P2 = 'vehicle/swan-mute';
const CONTRACT: Record<string, { frames: number; readPoints?: string[] }> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;

const rep = (d: readonly number[], n: number): number[] => Array.from({ length: n }, () => d).flat();
const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Phase durations of one aim per face (the face's logic time in the game). */
const FACE: Readonly<Record<string, readonly number[]>> = {
  '': [30],
  '-blink': [6],
  '-fire': [1, 1, 3],
  '-shell': [1, 2, 3],
  '-hurt': [2, 4, 6],
};
/** strip -> [aims, phase durations of one aim, loop]. */
const STRIPS: Record<string, readonly [number, readonly number[], boolean]> = {};
for (const [post, aims] of [['neck', 9], ['swim-neck', 9], ['crouch-neck', 1], ['duck-neck', 1]] as const) {
  for (const [face, d] of Object.entries(FACE)) STRIPS[`${post}${face}`] = [aims, d, false];
}
STRIPS['neck-relax'] = [9, [6, 180], true];
STRIPS['swim-neck-relax'] = [9, [6, 180], true];
STRIPS['neck-honk'] = [9, [4, 3, 3, 2, 2, 6], false];
// the honk on the water (verifier, wave 7): the same neck on the swim posture, the drum strapped high
STRIPS['swim-neck-honk'] = [9, [4, 3, 3, 2, 2, 6], false];
const NECKS = Object.keys(STRIPS);
/** The barrel: the hub to the muzzle point (draw.py BARREL_L). */
const BARREL = 17.5;
const theta = (i: number): number => ((45 - 22.5 * i) * Math.PI) / 180;

const pt = (f: Frame, n: string): readonly [number, number] => {
  const p = f.pts?.[n];
  expect(p, n).toBeDefined();
  return p as readonly [number, number];
};
const fxCount = (st: string, i: number): number => {
  const fx = new Set(SET.fx ?? []);
  return decodeBakedIndices(SET.strips[st].frames[i]).filter((k) => fx.has(k)).length;
};

beforeAll(async () => {
  await import('../../src/game/content/vehicles/swan/art');
});

describe('the Swan neck set at 40 px (stage 2)', () => {
  it('registers exactly the neck contract ids in P1 and P2 (beak-flash P1 only); every id is a contract id', () => {
    const names = Object.keys(SET.strips).sort();
    expect(names).toEqual([...NECKS, 'beak-flash'].sort());
    for (const n of names) {
      expect(CONTRACT[`${P1}/${n}`], `${P1}/${n} is a contract id`).toBeDefined();
      expect(hasSprite(`${P1}/${n}`), `${P1}/${n}`).toBe(true);
      if (n === 'beak-flash') expect(hasSprite(`${P2}/${n}`), `${P2}/${n} not registered`).toBe(false);
      else {
        expect(CONTRACT[`${P2}/${n}`], `${P2}/${n} is a contract id`).toBeDefined();
        expect(hasSprite(`${P2}/${n}`), `${P2}/${n}`).toBe(true);
      }
    }
    // every neck id of the contract is drawn by this set
    const want = Object.keys(CONTRACT).filter((id) => /^vehicle\/swan(-mute)?\/(.*-)?neck(-|$)/.test(id));
    for (const id of want) expect(SET.strips[id.slice(id.indexOf('/', 8) + 1)], id).toBeDefined();
    expect(Object.keys(SET.variants ?? {})).toEqual([P2]);
    expect(SET.prefix).toBe(P1);
    expect(SET.budget).toBe(40);
  });

  it('aims x phases: frame counts, durations and loop flags; one aim takes the face time of the game', () => {
    for (const [n, [aims, d, loop]] of Object.entries(STRIPS)) {
      const st = SET.strips[n];
      expect(st.frames.length, n).toBe(aims * d.length);
      expect([...st.durations], n).toEqual(rep(d, aims));
      expect(st.loop, n).toBe(loop);
      expect(st.frames.every((f) => !f.smear), `${n}: no smear frames`).toBe(true);
      for (const pre of [P1, P2]) {
        expect(frameCount(`${pre}/${n}`), `${pre}/${n}`).toBe(st.frames.length);
        expect(spriteAnim(`${pre}/${n}`).durations, `${pre}/${n}`).toEqual(rep(d, aims));
      }
    }
    // the logic times (plan rule 4): the shell face 6, the hurt 12, the honk 20 with the ring at 10
    expect(sum(FACE['-shell'])).toBe(SWAN.shellFaceTicks);
    expect(sum(FACE['-hurt'])).toBe(SWAN.hurtTicks);
    expect(sum(STRIPS['neck-honk'][1])).toBe(SWAN.honk.stripTicks);
    expect(sum(STRIPS['neck-honk'][1].slice(0, GEN.NECK_HONK_BLAST))).toBe(SWAN.honk.windup);
    // the fire face covers the gun's cadence: a burst never shows the rest frame between rounds
    expect(sum(FACE['-fire'])).toBeGreaterThanOrEqual(SWAN.gun.cooldown);
    expect(SET.strips['beak-flash'].frames.length).toBe(2);
    expect([...SET.strips['beak-flash'].durations]).toEqual([2, 2]);
  });

  it('every frame decodes: w*h indices inside the palette; at most 40 colours (both palettes, FX outside)', () => {
    const fx = new Set(SET.fx ?? []);
    for (const pal of [SET.pal, ...Object.values(SET.variants ?? {})]) {
      expect(pal.length).toBe(SET.pal.length);
      const used = new Set<string>();
      for (const [n, st] of Object.entries(SET.strips)) {
        for (const f of st.frames) {
          const idx = decodeBakedIndices(f);
          expect(idx.length, n).toBe(f.w * f.h);
          for (const i of idx) {
            expect(i, n).toBeLessThan(pal.length);
            if (i && !fx.has(i)) used.add(pal[i]);
          }
        }
      }
      expect(used.size).toBeLessThanOrEqual(40);
      expect(used.size).toBeGreaterThan(15);
    }
  });

  it('P2 (the black swan) is the same pixels and points in other colours', () => {
    for (const n of NECKS) {
      const a = getFrames(`${P1}/${n}`);
      const b = getFrames(`${P2}/${n}`);
      expect(b.length, n).toBe(a.length);
      a.forEach((f, i) => {
        expect([b[i].buf.w, b[i].buf.h, b[i].ox, b[i].oy], `${n} ${i}`).toEqual([f.buf.w, f.buf.h, f.ox, f.oy]);
        expect(b[i].pts, `${n} ${i}`).toEqual(f.pts);
      });
    }
    // the plumage of the neck turns dark: fewer light pixels in P2
    const light = (f: Frame): number => [...f.buf.data].filter((c) => (c & 255) !== 0 && ((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255) > 600).length;
    expect(light(getFrames(`${P2}/neck`)[2])).toBeLessThan(light(getFrames(`${P1}/neck`)[2]) / 3);
  });

  it('muzzle = cannon = the resting barrel tip of the aim on every phase; head on every frame', () => {
    for (const n of NECKS) {
      const fr = getFrames(`${P1}/${n}`);
      const ph = neckPhases(n);
      const aims = neckAims(n);
      for (let a = 0; a < aims; a++) {
        const m0 = pt(fr[a * ph], 'muzzle');
        for (let k = 0; k < ph; k++) {
          const f = fr[a * ph + k];
          expect(pt(f, 'cannon'), `${n} #${a * ph + k}`).toEqual(pt(f, 'muzzle'));
          expect(pt(f, 'muzzle'), `${n} #${a * ph + k} same tip on every phase`).toEqual(m0);
          pt(f, 'head');
        }
      }
    }
  });

  it('the barrel turns on one hub: θ = +45° − 22.5°·i, 17.5 px; the water aims 0-1 shoot level; MUZZLE_REL agrees', () => {
    const tips = (n: string): (readonly [number, number])[] => {
      const ph = neckPhases(n);
      return getFrames(`${P1}/${n}`).filter((_, i) => i % ph === 0).map((f) => pt(f, 'muzzle'));
    };
    const land = tips('neck');
    const hubs = land.map((m, i) => [m[0] - BARREL * Math.cos(theta(i)), m[1] - BARREL * Math.sin(theta(i))]);
    for (const h of hubs) {
      expect(Math.abs(h[0] - hubs[2][0])).toBeLessThanOrEqual(1);
      expect(Math.abs(h[1] - hubs[2][1])).toBeLessThanOrEqual(1);
    }
    // the hub is the drum on her near flank: behind and below the neck socket
    expect(hubs[2][0]).toBeLessThan(-8);
    expect(hubs[2][1]).toBeGreaterThan(4);
    const water = tips('swim-neck');
    // afloat the drum rides AFLOAT_UP px higher on her flank (body.py drum_s: the barrel over the water line)
    const AFLOAT_UP = 9;
    const up = (p: readonly [number, number]): number[] => [p[0], p[1] - AFLOAT_UP];
    expect(water.slice(0, 3)).toEqual([up(land[2]), up(land[2]), up(land[2])]);
    expect(water.slice(3)).toEqual(land.slice(3).map(up));
    for (const n of ['neck-fire', 'neck-shell', 'neck-hurt', 'neck-blink', 'neck-relax', 'neck-honk']) expect(tips(n), n).toEqual(land);
    for (const n of ['swim-neck-fire', 'swim-neck-shell', 'swim-neck-relax', 'swim-neck-honk']) expect(tips(n), n).toEqual(water);
    expect(land).toEqual(MUZZLE_REL.land.map((p) => [...p]));
    expect(water).toEqual(MUZZLE_REL.water.map((p) => [...p]));
    expect(tips('crouch-neck')).toEqual(MUZZLE_REL.crouch.map((p) => [...p]));
    expect(tips('duck-neck')).toEqual(MUZZLE_REL.duck.map((p) => [...p]));
  });

  it('the gun fire has craft: the flash on the shot, smoke after it, the recoil; every phase differs from the rest', () => {
    for (const post of ['neck', 'swim-neck', 'crouch-neck']) {
      const rest = SET.strips[post];
      const aims = neckAims(post);
      for (let a = 0; a < aims; a++) {
        const f0 = 3 * a;
        // the shot: a big flash (FX pixels); the recoil phase still burns; the return is smoke
        expect(fxCount(`${post}-fire`, f0), `${post}-fire aim ${a} flash`).toBeGreaterThan(25);
        expect(fxCount(`${post}-fire`, f0 + 1), `${post}-fire aim ${a} recoil`).toBeGreaterThan(5);
        expect(fxCount(`${post}-fire`, f0), `${post}-fire aim ${a}: the shot burns brightest`).toBeGreaterThan(fxCount(`${post}-fire`, f0 + 2));
        // the shell's ring flash is bigger than a round's
        expect(fxCount(`${post}-shell`, f0), `${post}-shell aim ${a}`).toBeGreaterThan(fxCount(`${post}-fire`, f0));
        for (let k = 0; k < 3; k++) {
          for (const face of ['-fire', '-shell', '-hurt']) {
            expect(SET.strips[`${post}${face}`].frames[f0 + k].px, `${post}${face} #${f0 + k} differs from the rest`).not.toBe(rest.frames[a].px);
          }
        }
      }
    }
    // the ducked gun fires under the water: a spout breaks the surface (FX), no flash under it
    expect(fxCount('duck-neck-fire', 0)).toBeGreaterThan(4);
    // the honk: the snap forward has speed streaks, the draw-back none
    expect(fxCount('neck-honk', 2 * 6 + GEN.NECK_HONK_BLAST)).toBeGreaterThan(5);
    expect(fxCount('neck-honk', 2 * 6)).toBe(0);
    // the hurt knocks a feather loose (the snap and the drift differ)
    expect(SET.strips['neck-hurt'].frames[6].px).not.toBe(SET.strips['neck-hurt'].frames[7].px);
  });

  it('1× pixels at every tier: getFrames(id, 2) and (id, 4) are the 1× frames; no 2× / 4× generator', () => {
    for (const n of [...NECKS, 'beak-flash']) {
      for (const pre of n === 'beak-flash' ? [P1] : [P1, P2]) {
        const id = `${pre}/${n}`;
        expect(hasHiSprite(id), id).toBe(false);
        const one = getFrames(id, 1);
        expect(getFrames(id, 2), id).toBe(one);
        expect(getFrames(id, 4), id).toBe(one);
      }
    }
  });
});

describe('the Swan code reads the neck set (plan rule 4)', () => {
  it('the events exist and match the strips', () => {
    expect(GEN.NECK_AIMS).toBe(9);
    expect(GEN.NECK_FIRE_PHASES).toBe(FACE['-fire'].length);
    expect(GEN.NECK_SHELL_PHASES).toBe(FACE['-shell'].length);
    expect(GEN.NECK_HURT_PHASES).toBe(FACE['-hurt'].length);
    expect(GEN.NECK_RELAX_PHASES).toBe(2);
    expect(GEN.NECK_HONK_PHASES).toBe(STRIPS['neck-honk'][1].length);
    expect(GEN.NECK_HONK_BLAST).toBeGreaterThan(0);
    expect(GEN.NECK_HONK_BLAST).toBeLessThan(GEN.NECK_HONK_PHASES);
    expect([GEN.NECK_RELAX_BLINK, GEN.NECK_RELAX_OPEN].sort()).toEqual([0, 1]);
    for (const n of NECKS) expect(neckPhases(n) * neckAims(n), n).toBe(SET.strips[n].frames.length);
    for (const [n, [, d]] of Object.entries(STRIPS)) expect(neckFaceTicks(n), n).toBe(sum(d));
  });

  it('neckFrame gives an existing frame of the right aim and phase at every tick of every face', () => {
    for (const n of NECKS) {
      const total = SET.strips[n].frames.length;
      const ph = neckPhases(n);
      const d = STRIPS[n][1];
      for (let aim = -1; aim <= 9; aim++) {
        for (let t = -2; t <= sum(d) + 3; t++) {
          const f = neckFrame(n, aim, t);
          expect(Number.isInteger(f), `${n} ${aim} ${t}`).toBe(true);
          expect(f, `${n} ${aim} ${t}`).toBeGreaterThanOrEqual(0);
          expect(f, `${n} ${aim} ${t}`).toBeLessThan(total);
          const a = neckAims(n) === 1 ? 0 : Math.min(8, Math.max(0, aim));
          expect(Math.floor(f / ph), `${n} aim`).toBe(a);
        }
      }
      // the phase follows the durations: phase k starts at the sum of the ones before it
      let start = 0;
      d.forEach((len, k) => {
        expect(neckPhaseAt(n, start), `${n} phase ${k}`).toBe(k);
        expect(neckPhaseAt(n, start + len - 1), `${n} phase ${k} end`).toBe(k);
        start += len;
      });
    }
    expect(neckPhaseAt('neck-honk', SWAN.honk.windup)).toBe(GEN.NECK_HONK_BLAST);
    for (let a = 0; a < 9; a++) {
      expect(relaxFrame(a, true)).toBe(a * 2 + GEN.NECK_RELAX_BLINK);
      expect(relaxFrame(a, false)).toBe(a * 2 + GEN.NECK_RELAX_OPEN);
    }
    expect(relaxFrame(NECK_REST_AIM, false)).toBe(5);
    // the scenes that draw one still neck (the lake, the swan jet) get the open eye, the gun level
    expect(NECK_REST_FRAME).toBe(5);
    expect(restFrame('neck-relax')).toBe(5);
    expect(restFrame('swim-neck-relax')).toBe(5);
    expect(restFrame('neck')).toBe(NECK_REST_AIM);
    expect(restFrame('crouch-neck')).toBe(0);
    expect(pt(getFrames(`${P1}/neck-relax`)[NECK_REST_FRAME], 'muzzle')).toEqual(MUZZLE_REL.land[NECK_REST_AIM].map((v) => v));
  });

  it('the gameplay numbers stay (plan D7): the gun, the shell, the honk, the aim and the face timers', () => {
    expect({ ...SWAN.gun }).toEqual({ damage: 10, speed: 8, cooldown: 4, burst: 5, jitter: 1, maxOnScreen: 24, life: 60 });
    expect({ ...SWAN.shell }).toEqual({ speed: 4.0, gravity: 0.06, direct: 200, splash: 100, radius: 24, cooldown: 30, inheritVx: 1, maxOnScreen: 3, life: 240 });
    expect({ ...SWAN.honk }).toEqual({ windup: 10, radius: 128, growTicks: 16, damage: 80, stunTicks: 60, cost: 3, cooldown: 240, stripTicks: 20 });
    expect([SWAN.neckMin, SWAN.neckMax, SWAN.neckStep, SWAN.neckStepTicks, SWAN.neckRelaxTicks]).toEqual([Math.PI / 4, (-3 * Math.PI) / 4, Math.PI / 8, 2, 40]);
    expect([SWAN.hurtTicks, SWAN.fireFaceTicks, SWAN.shellFaceTicks, SWAN.shells]).toEqual([12, 2, 6, 10]);
  });
});

// ------------------------------------------------------------------------------------------ headless

const FLOOR = 176;

interface SwanView {
  anim: { id: string; index: number };
  neckName: string;
  neckFrame: number;
  facing: number;
  x: number;
  y: number;
  neckIndex: number;
  hurtT: number;
  beakTip(name: 'muzzle' | 'cannon', out: [number, number]): [number, number];
  colorId(name: string): string;
}

class Rig {
  readonly pad = new VirtualPad();
  readonly world: World;
  mask = 0;
  readonly p: Player;
  readonly swan: Swan;
  /** neck strip name -> the frames shown. */
  readonly seen = new Map<string, Set<number>>();

  constructor(mute = false) {
    const t = terrain(6000, 216);
    t.ground().at(0, FLOOR).flat(6000);
    this.world = new World({ terrain: new Terrain(t.build()), seed: 7, factory: gameEntityFactory });
    attachGame(this.world, new GameSession({ characters: ['recruit', 'recruit'], seed: 7 }), new HudState());
    this.p = new Player(this.world, 140, FLOOR, { pad: this.pad, index: 0 });
    this.world.add(this.p);
    this.p.placeAt(140, FLOOR, 0);
    this.swan = this.world.spawn('swan', 200, FLOOR, mute ? { variant: 'mute' } : {}) as Swan;
    this.world.flush();
    this.world.camera.follow(this.world.players);
    this.run(1);
  }

  get view(): SwanView {
    return this.swan as unknown as SwanView;
  }

  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pad.update(this.mask);
      this.world.update();
      this.check();
    }
    return this;
  }

  hold(...b: Button[]): this {
    this.mask = b.length ? buttonMask(...b) : 0;
    return this;
  }

  tap(...b: Button[]): this {
    const keep = this.mask;
    this.mask = keep | buttonMask(...b);
    this.run(1);
    this.mask = keep;
    return this;
  }

  /** The neck the Swan picked this tick: registered, the frame in range; the tip on the barrel. */
  check(): void {
    const s = this.view;
    if (!s.neckName) return;
    const id = s.colorId(s.neckName);
    expect(hasSprite(id), `${id} registered`).toBe(true);
    expect(Number.isInteger(s.neckFrame), `${id} frame`).toBe(true);
    expect(s.neckFrame, id).toBeGreaterThanOrEqual(0);
    expect(s.neckFrame, id).toBeLessThan(frameCount(id));
    // the aim of the frame is the Swan's aim (the one-aim crouch and duck necks: 0)
    const aims = neckAims(s.neckName);
    if (aims > 1 && !s.neckName.endsWith('relax')) expect(Math.floor(s.neckFrame / neckPhases(s.neckName)), id).toBe(s.neckIndex);
    // beakTip = the body's neck socket + the neck frame's muzzle (flipped when she faces left)
    const body = getFrame(s.anim.id, s.anim.index);
    const sock = framePoint(body, 'neck', s.facing < 0, false, [0, 0]);
    const m = framePoint(getFrame(id, s.neckFrame), 'muzzle', s.facing < 0, false, [0, 0]);
    if (sock && m) {
      const tip = s.beakTip('muzzle', [0, 0]);
      expect(tip[0], `${id} tip x`).toBeCloseTo(s.x + sock[0] + m[0], 6);
      expect(tip[1], `${id} tip y`).toBeCloseTo(s.y + sock[1] + m[1], 6);
    }
    let set = this.seen.get(s.neckName);
    if (!set) this.seen.set(s.neckName, (set = new Set()));
    set.add(s.neckFrame);
  }
}

describe('the Swan plays the neck strips headless (ride, aim, fire, shell, hurt, crouch, honk, relax)', () => {
  for (const mute of [false, true]) {
    it(`${mute ? 'P2 black swan' : 'P1'}: every neck pick is an existing frame at the aim; the phases are reached`, () => {
      const r = new Rig(mute);
      const s = r.swan;
      r.run(30);
      s.mount(r.p);
      r.run(SWAN.riseTicks + 10);
      r.hold('fire').run(40);                              // a burst at aim 2: shot, recoil, return
      r.hold('fire', 'up').run(40);                        // the aim climbs while firing
      r.hold('up').run(10).hold().run(10);
      r.tap('bomb').run(12);                               // a shell at the up aim
      r.hold().run(40);
      r.hold('up').run(8).tap('fire', 'bomb').run(30);     // HONK, aiming up (the barrel stays at the aim)
      r.hold().run(10);
      r.view.hurtT = SWAN.hurtTicks;                       // a hit (the hurt face)
      r.run(14);
      r.hold('down').run(20).hold('down', 'fire').run(20); // crouch: one aim, the fire phases
      r.hold().run(SWAN.neckRelaxTicks + 30);              // the relaxed S
      const fire = r.seen.get('neck-fire') ?? new Set();
      const phases = new Set([...fire].map((f) => f % GEN.NECK_FIRE_PHASES));
      expect([...phases].sort(), 'fire phases shown').toEqual([0, 1, 2]);
      const aims = new Set([...fire].map((f) => Math.floor(f / GEN.NECK_FIRE_PHASES)));
      expect(aims.size, 'fire at several aims').toBeGreaterThanOrEqual(3);
      expect(r.seen.get('neck-shell')?.size ?? 0, 'shell phases').toBeGreaterThanOrEqual(3);
      const honk = [...(r.seen.get('neck-honk') ?? [])];
      expect(new Set(honk.map((f) => f % GEN.NECK_HONK_PHASES)).size, 'honk phases').toBe(GEN.NECK_HONK_PHASES);
      expect(honk.every((f) => Math.floor(f / GEN.NECK_HONK_PHASES) > 2), 'the honk at the up aim').toBe(true);
      expect(r.seen.get('neck-hurt')?.size ?? 0, 'hurt phases').toBe(GEN.NECK_HURT_PHASES);
      expect(r.seen.get('crouch-neck-fire')?.size ?? 0, 'crouch fire phases').toBe(GEN.NECK_FIRE_PHASES);
      expect(r.seen.get('neck-relax')?.size ?? 0, 'relaxed neck').toBeGreaterThanOrEqual(1);
      expect(r.seen.has('neck')).toBe(true);
    });
  }

  it('the rounds leave from the barrel tip: a bullet spawns at the socket + the muzzle of the aim', () => {
    const r = new Rig();
    r.run(30);
    r.swan.mount(r.p);
    r.run(SWAN.riseTicks + 10);
    const before = new Set(r.world.entities);
    r.hold('fire').run(1);
    const shots = r.world.entities.filter((e) => !before.has(e) && e.type === 'beak-bullet');
    expect(shots.length).toBeGreaterThan(0);
    const s = r.view;
    const body = getFrame(s.anim.id, s.anim.index);
    const sock = framePoint(body, 'neck', s.facing < 0, false, [0, 0]) as [number, number];
    const rel = MUZZLE_REL.land[s.neckIndex];
    const b = shots[0] as unknown as { x: number; y: number; w?: number; h?: number };
    // the round starts within its jitter and one step of the tip (the bullet moves on its spawn tick)
    const tx = s.x + sock[0] + rel[0] * s.facing;
    const ty = s.y + sock[1] + rel[1];
    expect(Math.abs(b.y + (b.h ?? 0) / 2 - ty)).toBeLessThanOrEqual(SWAN.gun.jitter + 3);
    expect(Math.abs(b.x + (b.w ?? 0) / 2 - tx)).toBeLessThanOrEqual(SWAN.gun.speed + 4);
  });
});
