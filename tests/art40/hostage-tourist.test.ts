/**
 * The tied tourist (the hostage of mission ams) and the camera flash at 40 px (docs/design/ams40.md
 * wave 3): the baked set `hostage-tourist` (src/game/content/art40/hostage-tourist.gen.ts, drawn by
 * tools/art40/chars/hostage-tourist/) keeps the strip contract of docs/design/ams40/contract.md
 * "tied tourist": the 15 ids (item/hostage/tourist/* and item/hostage/flash), the frame counts of
 * the plan's class table, the state times (freed 20, give 24 with the gift at tick 12, bow 12, the
 * gag 40 with the flash at tick 24), the feet anchor and the points hand / head / hip (+ flash on the
 * gag) on every figure frame, 1x pixels at every art tier (rule 7), 28 colours (D1); the chair and the
 * sack are inside the strips (rule 10). The code picks the tied frame (hostages.ts touristTiedFrame)
 * and the gag frame (the strip's own durations); the real update loop draws an existing frame at
 * every tick of every state, and the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { frameCount, getFrame, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/hostage-tourist.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import { FxEntity } from '../../src/game/fx';
import { Hostage } from '../../src/game/hostage';
import { frameAtTick, touristTiedFrame, TurningHostage } from '../../src/game/content/items/hostages';
import { TUNING } from '../../src/game/tuning';
import { TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const T = 'item/hostage/tourist';

interface ContractEntry {
  character: string;
  set: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  totalTicks?: number;
  anchorKind?: string;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT)
  .filter((id) => CONTRACT[id].character === 'hostage-tourist' && !id.startsWith('item/bind/'))
  .sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Frame counts (the plan's class table), durations and loop flags. */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, cls: string]>> = {
  'tourist/tied': [8, [12, 11, 11, 12, 11, 11, 11, 11], true, 'idle-fidget'],
  'tourist/caged': [8, [12, 11, 11, 12, 11, 11, 11, 11], true, 'idle-fidget'],
  'tourist/mast': [8, [12, 11, 11, 12, 11, 11, 11, 11], true, 'idle-fidget'],
  'tourist/sack': [8, [3, 3, 3, 3, 4, 3, 4, 3], true, 'idle-fidget'],
  'tourist/sack-turn': [2, [2, 2], true, 'turn'],
  'tourist/dangle': [8, [4, 3, 4, 3, 4, 3, 4, 3], true, 'idle-fidget'],
  'tourist/chute': [8, [5, 5, 5, 5, 5, 5, 5, 5], true, 'idle-fidget'],
  'tourist/freed': [8, [3, 3, 2, 2, 3, 3, 3, 1], false, 'victory'],
  'tourist/walk': [12, Array(12).fill(3), true, 'locomotion'],
  'tourist/run': [12, Array(12).fill(2), true, 'locomotion'],
  'tourist/gag': [8, [6, 6, 6, 6, 3, 3, 6, 4], true, 'idle-fidget'],
  'tourist/give': [6, [3, 3, 3, 4, 5, 6], false, 'victory'],
  'tourist/bow': [6, [2, 2, 2, 2, 2, 2], false, 'victory'],
  'tourist/turn': [2, [2, 2], true, 'turn'],
  flash: [3, [2, 3, 3], false, 'prop'],
};

/**
 * Loop lengths that changed on purpose (the old contract total -> the new one, and why). Every
 * other strip keeps its old total in ticks. None of them is a logic time: the code reads the
 * speeds (TUNING.hostage) and picks the gag frames by tick.
 */
const CHANGED: Readonly<Record<string, readonly [old: number, now: number, why: string]>> = {
  'tourist/walk': [48, 36, '12 x 3 at 0.8 px/tick: a 28.8 px stride on the 40 px legs (the baker and the handhaver walk)'],
  'tourist/run': [32, 24, '12 x 2 at 2 px/tick: a 48 px stride with a flight phase'],
  'tourist/gag': [32, 40, 'the gag strip is timed by tick over the whole gag (TOURIST.gagTicks 40); the old 4 frames looped every 32'],
};

/** Strips without the game points (the whole figure is inside the sack; the flash is an effect). */
const NO_POINTS = new Set(['tourist/sack', 'tourist/sack-turn', 'flash']);
/** Strips whose anchor is not the floor under the feet. */
const CUSTOM_ANCHOR = new Set(['tourist/sack', 'tourist/sack-turn', 'tourist/dangle', 'flash']);

describe('hostage-tourist: the set', () => {
  it('registers exactly the contract ids (docs/design/ams40/contract.json), no variants', () => {
    expect(CONTRACT_IDS.length).toBe(15);
    expect([...bakedSetIds(SET)].sort()).toEqual(CONTRACT_IDS);
    expect(SET.prefix).toBe('item/hostage');
    expect(SET.variants ?? {}).toEqual({});
    for (const id of CONTRACT_IDS) expect(hasSprite(id), id).toBe(true);
  });

  it('frame counts, durations, loop and defer flags: the class table and the contract logic time', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [name, [n, d, loop, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[name];
      const c = CONTRACT[`item/hostage/${name}`];
      expect(st.frames.length, name).toBe(n);
      expect(st.durations, name).toEqual(d);
      expect(st.loop, name).toBe(loop);
      expect(st.loop, `${name} loop = contract`).toBe(c.loop);
      expect(st.defer ?? false, name).toBe(false);
      expect(st.cls, name).toBe(cls);
      const ch = CHANGED[name];
      if (ch) {
        expect(c.totalTicks, `${name} old total`).toBe(ch[0]);
        expect(sum(st.durations), `${name}: ${ch[2]}`).toBe(ch[1]);
      } else expect(sum(st.durations), `${name} logic time`).toBe(c.totalTicks);
      expect(frameCount(`item/hostage/${name}`), name).toBe(n);
      expect(spriteAnim(`item/hostage/${name}`).durations, name).toEqual(d);
      expect(spriteAnim(`item/hostage/${name}`).loop, name).toBe(loop);
    }
    // the state times the strips fit (TUNING.hostage): freed 20, give 24, bow 12
    expect(sum(SET.strips['tourist/freed'].durations)).toBe(TUNING.hostage.freedTicks);
    expect(sum(SET.strips['tourist/give'].durations)).toBe(TUNING.hostage.giveTicks);
    expect(sum(SET.strips['tourist/bow'].durations)).toBe(TUNING.hostage.bowTicks);
  });

  it('every frame decodes: w*h pixels, palette indices in range, 28 colours (FX outside), the one outline', () => {
    expect(SET.budget).toBe(28);
    const fx = new Set(SET.fx ?? []);
    const body = SET.pal.slice(1).filter((_, i) => !fx.has(i + 1));
    expect(body.length).toBeLessThanOrEqual(28);
    expect(new Set(SET.pal.slice(1)).size).toBe(SET.pal.length - 1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    // the FX letters are the shared FX ramp (the click burst, the camera flash)
    for (const i of fx) expect(['#ffffff', '#fffbd8', '#ffe070', '#ffd040']).toContain(SET.pal[i]);
    for (const [name, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const idx = decodeBakedIndices(f);
        expect(idx.length, `${name}#${i}`).toBe(f.w * f.h);
        let max = 0;
        let solid = 0;
        for (const v of idx) {
          if (v > max) max = v;
          if (v) solid++;
        }
        expect(max, `${name}#${i}`).toBeLessThan(SET.pal.length);
        const min = name === 'flash' ? 20 : name.endsWith('turn') ? 120 : 300;
        expect(solid, `${name}#${i} has pixels`).toBeGreaterThan(min);
        // the flash is light only: every pixel an FX colour
        if (name === 'flash') for (const v of idx) if (v) expect(fx.has(v), `flash#${i} index ${v}`).toBe(true);
      });
    }
  });

  it('the anchor and every contract point on every frame; no smear frames', () => {
    for (const [name, st] of Object.entries(SET.strips)) {
      const c = CONTRACT[`item/hostage/${name}`];
      st.frames.forEach((f, i) => {
        expect(f.ox, `${name}#${i}`).toBeGreaterThanOrEqual(0);
        expect(f.ox, `${name}#${i}`).toBeLessThan(f.w);
        if (name === 'flash') {
          // centre anchor
          expect(Math.abs(f.ox - (f.w - 1) / 2), `flash#${i}`).toBeLessThanOrEqual(0.5);
          expect(Math.abs(f.oy - (f.h - 1) / 2), `flash#${i}`).toBeLessThanOrEqual(0.5);
        } else if (!CUSTOM_ANCHOR.has(name)) {
          // feet: the line under the soles (the run's flight and the freed hop lift him over it)
          expect(f.oy, `${name}#${i}`).toBeGreaterThanOrEqual(f.h);
          if (!['tourist/run', 'tourist/freed', 'tourist/chute'].includes(name)) expect(f.oy, `${name}#${i}`).toBe(f.h);
        } else expect(f.oy, `${name}#${i}`).toBeGreaterThanOrEqual(f.h - (name === 'tourist/dangle' ? 20 : 0));
        const want = c.framePoints[Math.min(i, c.framePoints.length - 1)];
        if (NO_POINTS.has(name)) expect(want, `${name}#${i}`).toEqual([]);
        else for (const p of ['hand', 'head', 'hip']) expect(want, `${name}#${i}`).toContain(p);
        for (const p of want) {
          const pt = f.pts?.[p];
          expect(pt, `${name}#${i} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${name}#${i} ${p}`).toBe(true);
          expect(pt![1], `${name}#${i} ${p}`).toBeLessThan(0);
        }
        expect(f.smear ?? false, `${name}#${i} smear`).toBe(false);
      });
    }
    // the gag carries the flash point on every frame (the contract reads it)
    for (const f of SET.strips['tourist/gag'].frames) expect(f.pts?.flash).toBeDefined();
  });

  it('one pixel size: getFrames(id, 2) and getFrames(id, 4) are the 1x frames (no dense art left)', () => {
    for (const id of bakedSetIds(SET)) {
      expect(hasHiSprite(id, 2), id).toBe(false);
      expect(hasHiSprite(id, 4), id).toBe(false);
      const one = getFrames(id, 1);
      for (const d of [2, 4]) {
        const hi = getFrames(id, d);
        expect(hi.length, id).toBe(one.length);
        hi.forEach((f, i) => {
          expect(f.density ?? 1, `${id}@${d}`).toBe(1);
          expect(f.buf, `${id}@${d}#${i}`).toBe(one[i].buf);
        });
      }
    }
  });
});

describe('hostage-tourist: the frame roles the code reads', () => {
  it('TIED_*: eight roles inside the tied, caged and mast strips, in the baked order', () => {
    const roles = [GEN.TIED_REST, GEN.TIED_BREATH, GEN.TIED_BLINK, GEN.TIED_LOOK, GEN.TIED_STRUGGLE, GEN.TIED_STRUGGLE_B, GEN.TIED_STRAIN, GEN.TIED_SLUMP];
    expect(roles).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const s of ['tourist/tied', 'tourist/caged', 'tourist/mast']) for (const r of roles) expect(r).toBeLessThan(SET.strips[s].frames.length);
  });

  it('touristTiedFrame: breathing, the blink (7 of 150 ticks), the look, the struggle while shaking, then the strain and the slump', () => {
    const seen = new Set<number>();
    for (let t = 0; t < 1200; t++) {
      for (const shaking of [false, true]) {
        const f = touristTiedFrame(t, shaking);
        expect(Number.isInteger(f), `t ${t}`).toBe(true);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(8);
        seen.add(f);
        if (shaking) expect([GEN.TIED_STRUGGLE, GEN.TIED_STRUGGLE_B]).toContain(f);
      }
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // the old blink rule: frame BLINK on 7 of every 150 ticks (outside the wriggle)
    expect(touristTiedFrame(150, false)).toBe(GEN.TIED_BLINK);
    expect(touristTiedFrame(156, false)).toBe(GEN.TIED_BLINK);
    expect(touristTiedFrame(1, false)).toBe(GEN.TIED_BLINK);
    expect(touristTiedFrame(20, false)).toBe(GEN.TIED_REST);
    expect(touristTiedFrame(50, false)).toBe(GEN.TIED_BREATH);
    // the wriggle at stateT % 120 === 60: the struggle, then the strain and the slump
    expect(touristTiedFrame(60, true)).toBe(GEN.TIED_STRUGGLE);
    expect(touristTiedFrame(65, false)).toBe(GEN.TIED_STRAIN);
    expect(touristTiedFrame(80, false)).toBe(GEN.TIED_SLUMP);
    expect(touristTiedFrame(110, false)).not.toBe(GEN.TIED_SLUMP);
  });

  it('GAG_*: the click frame starts at the flash tick 24 (the contract), the frames by tick over the 40-tick gag', () => {
    const d = SET.strips['tourist/gag'].durations;
    expect(GEN.GAG_FLASH_TICK).toBe(24);
    expect(sum(d.slice(0, GEN.GAG_FLASH))).toBe(GEN.GAG_FLASH_TICK);
    expect(sum(d)).toBe(40);
    expect(frameAtTick(d, GEN.GAG_FLASH_TICK)).toBe(GEN.GAG_FLASH);
    expect(frameAtTick(d, GEN.GAG_FLASH_TICK - 1)).toBe(GEN.GAG_FLASH - 1);
    expect(GEN.GAG_CARD).toBe(0);
    expect(GEN.GAG_RAISE).toBeLessThan(GEN.GAG_FLASH);
    expect(GEN.GAG_AFTER).toBeGreaterThan(GEN.GAG_FLASH);
    expect(GEN.GAG_AFTER).toBeLessThan(d.length);
    for (let t = -2; t < 60; t++) {
      const f = frameAtTick(d, t);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(d.length);
    }
    expect(frameAtTick(undefined, 5)).toBe(0);
    // the flash point is the camera's flash cube, up at the face on the click frame
    const click = SET.strips['tourist/gag'].frames[GEN.GAG_FLASH];
    expect(click.pts!.flash[1]).toBeLessThan(click.pts!.hip[1] - 12);
  });

  it('GIVE_*: the gift is in the hand on the frame drawn at the handover tick 12 (giveTicks / 2)', () => {
    const d = SET.strips['tourist/give'].durations;
    expect(GEN.GIVE_HANDOVER).toBe(Math.floor(TUNING.hostage.giveTicks / 2));
    expect(frameAtTick(d, GEN.GIVE_HANDOVER)).toBe(GEN.GIVE_HAND_FRAME);
    // the gift box (red) next to the hand point on that frame, and gone from the next one
    const red = (i: number): number => {
      const f = SET.strips['tourist/give'].frames[i];
      const idx = decodeBakedIndices(f);
      let n = 0;
      for (const v of idx) if (SET.pal[v] === '#d83a34') n++;
      return n;
    };
    expect(red(GEN.GIVE_HAND_FRAME)).toBeGreaterThan(10);
    // the gift pops where it always did (the old give frame 2's hand at tick 12): the item's path and
    // the bot's route (the sims) stay the same (D7; a moved point changed the ams sim by 1300 ticks)
    expect(SET.strips['tourist/give'].frames[GEN.GIVE_HAND_FRAME].pts!.hand).toEqual([12, -23]);
    expect(red(GEN.GIVE_HAND_FRAME + 1)).toBe(0);
  });
});

/** Every sprite drawn, through a recording renderer. */
function recorder(): { r: SoftRenderer; calls: Array<[string, number]> } {
  const r = new SoftRenderer();
  const calls: Array<[string, number]> = [];
  const own = r.sprite.bind(r);
  r.sprite = (id: string, i: number, x: number, y: number, o?: DrawOpts) => {
    calls.push([id, i]);
    own(id, i, x, y, o);
  };
  return { r, calls };
}

function expectValid(calls: Array<[string, number]>): void {
  for (const [id, i] of calls) {
    if (!id.startsWith('item/hostage/tourist/') && id !== 'item/hostage/flash') continue;
    expect(hasSprite(id), id).toBe(true);
    expect(Number.isInteger(i), `${id} index ${i}`).toBe(true);
    expect(i, id).toBeGreaterThanOrEqual(0);
    expect(i, id).toBeLessThan(frameCount(id));
  }
}

describe('hostage-tourist: behaviour (the real update loop, headless)', () => {
  it('the gameplay numbers stay (D7): body 14 x 26, hitbox (-8, -26, 16, 26), the state times and speeds', () => {
    const tw = new TestWorld({ playerX: null });
    const h = tw.spawn('hostage', 300, { kind: 'tourist', bind: 'chair' }) as Hostage;
    expect(h).toBeInstanceOf(TurningHostage);
    expect(h.art).toBe(T);
    expect(h.hitbox).toEqual({ x: -8, y: -26, w: 16, h: 26 });
    expect([h.body!.w, h.body!.h]).toEqual([14, 26]);
    expect(TUNING.hostage).toMatchObject({ freedTicks: 20, walkSpeed: 0.8, giveTicks: 24, bowTicks: 12, runSpeed: 2 });
  });

  it('chair: tied -> freed -> walk -> gag (the flash at tick 24) -> give (the gift from the hand at 12) -> bow -> run, an existing frame at every tick', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const h = tw.spawn('hostage', 260, { kind: 'tourist', bind: 'chair', gives: 'bombs' }) as Hostage;
    const { r, calls } = recorder();
    const len = new Map<string, number>();
    const seenTied = new Set<number>();
    let flash: { x: number; y: number } | null = null;
    let flashAt: { x: number; y: number } | null = null;
    let gift: { x: number; y: number; frame: number } | null = null;
    tw.world.events.on('hostageGift', (e) => {
      gift = e.item ? { x: e.item.x, y: e.item.y, frame: h.anim.index } : null;
    });
    let maxWalk = 0;
    let maxRun = 0;
    for (let t = 0; t < 900 && !h.removed; t++) {
      if (t === 400) h.free(0);
      const before = h.state;
      tw.run(1);
      if (h.removed) break;
      // the update that ran gag tick 24 (stateT 25 now): the frame drawn is the click (GAG_FLASH)
      if (h.state === 'gag' && h.stateT === 25) {
        expect(h.frameToDraw()).toBe(GEN.GAG_FLASH);
        const p = { x: 0, y: 0 };
        flashAt = h.pointOf('flash', p) ? { ...p } : null;
      }
      len.set(h.state, (len.get(h.state) ?? 0) + 1);
      if (h.state === 'tied') seenTied.add(h.frameToDraw());
      if (h.state === 'walk') maxWalk = Math.max(maxWalk, Math.abs(h.vx));
      if (h.state === 'run') maxRun = Math.max(maxRun, Math.abs(h.vx));
      if (!flash) {
        const fx = tw.ofType('fx').find((e) => e instanceof FxEntity && e.sprite === 'item/hostage/flash');
        if (fx) {
          flash = { x: fx.x, y: fx.y };
          // it fired on gag tick GAG_FLASH_TICK (24): the update that left stateT at 25
          expect([h.state, h.stateT]).toEqual(['gag', GEN.GAG_FLASH_TICK + 1]);
        }
      }
      expect(hasSprite(h.anim.id), `${before}->${h.state} ${h.anim.id}`).toBe(true);
      const i = h.frameToDraw();
      expect(i, `${h.state} t ${h.stateT}`).toBeGreaterThanOrEqual(0);
      expect(i, `${h.state} t ${h.stateT}`).toBeLessThan(frameCount(h.anim.id));
      expect(getFrame(h.anim.id, i), h.anim.id).toBeTruthy();
      h.draw(r);
    }
    expectValid(calls);
    // the tied roles the code picked in 400 ticks (rest, breath, blink, the wriggle when on screen)
    expect(seenTied.has(GEN.TIED_REST) && seenTied.has(GEN.TIED_BREATH) && seenTied.has(GEN.TIED_BLINK)).toBe(true);
    // the state times (ticks counted after the state change)
    // (free() ran between two ticks: its tick 0 is not one of the counted updates)
    expect((len.get('freed') ?? 0) + 1).toBe(TUNING.hostage.freedTicks);
    expect(len.get('gag')).toBe(40);
    expect(len.get('give')).toBe(TUNING.hostage.giveTicks);
    expect(len.get('bow')).toBe(TUNING.hostage.bowTicks);
    expect(len.get('walk') ?? 0).toBeGreaterThan(0);
    expect(maxWalk).toBeCloseTo(TUNING.hostage.walkSpeed, 5);
    expect(maxRun).toBeCloseTo(TUNING.hostage.runSpeed, 5);
    // SAY CHEESE: the flash spawns at the click frame's flash point
    expect(flashAt).not.toBeNull();
    expect(flash).not.toBeNull();
    expect(flash!.x).toBeCloseTo(flashAt!.x, 5);
    expect(flash!.y).toBeCloseTo(flashAt!.y, 5);
    // the gift leaves the hand on GIVE_HAND_FRAME
    expect(gift).not.toBeNull();
    expect(gift!.frame).toBe(GEN.GIVE_HAND_FRAME);
  });

  it('sack: the blind hop (0.3 px/tick inside its band, drawing offset only), then the touch frees it; every drawn frame exists', () => {
    const tw = new TestWorld({ playerX: null });
    const h = tw.spawn('hostage', 300, { kind: 'tourist', bind: 'sack' }) as Hostage;
    const { r, calls } = recorder();
    let maxVx = 0;
    for (let t = 0; t < 300; t++) {
      tw.run(1);
      maxVx = Math.max(maxVx, Math.abs(h.vx));
      expect(h.anim.id).toBe(`${T}/sack`);
      expect(h.x).toBeGreaterThanOrEqual(300 - 24 - 1);
      expect(h.x).toBeLessThanOrEqual(300 + 24 + 1);
      h.draw(r);
    }
    expect(maxVx).toBeCloseTo(0.3, 5);
    expect(h.hitbox).toEqual({ x: -8, y: -26, w: 16, h: 26 });
    h.free(0);
    for (let t = 0; t < 400 && !h.removed; t++) {
      tw.run(1);
      if (h.removed) break;
      expect(h.frameToDraw()).toBeLessThan(frameCount(h.anim.id));
      h.draw(r);
    }
    expectValid(calls);
    expect(calls.some(([id]) => id === `${T}/sack-turn`) || calls.some(([id]) => id === `${T}/sack`)).toBe(true);
  });
});
