/**
 * REPORT FOR DUTY at 1× (docs/design/select40.md): the furniture is 1× art in palette colours
 * (no dense art left for the redrawn ids; the other stencil titles and the menu bolt keep theirs),
 * the shutter rise eases out with a bounce, the drop lands with a squash, a shake and dust; the
 * portraits follow the portrait contract (select-grey unlit, select the lit loop from its key pose,
 * select-pick once with a white flash at its start, the shutter drops when it ends); 1 and 2
 * players, the timer, back, a pad claiming a player; every other screen with ui/mil art draws it.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { InputManager, ScriptedSource, type Button } from '../../src/engine/input';
import type { Color } from '../../src/engine/color';
import { inPalette, PAL } from '../../src/engine/palette';
import { PAD, PadSource, type GamepadLike } from '../../src/engine/pads';
import type { DrawOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { clearSpriteCache, defineSprite, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, type GameApp } from '../../src/game/app';
import { loadContent } from '../../src/game/content/index';
import { MIL_PANELS, MIL_SHUTTER_FRAMES, MIL_SHUTTER_OFFSETS, milShutterFrame, STENCIL_GOLD, STENCIL_TITLES, stencilId } from '../../src/game/content/ui/military.art';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { getCharacter } from '../../src/game/registry';
import {
  CharacterSelectScene,
  CONFIRM_HOLD,
  DROP_TICKS,
  FLASH_TICKS,
  MIL_ART,
  pickTicks,
  SELECT_SECONDS,
  SHAKE,
  SHUTTER_DELAY,
  SHUTTER_DROP,
  SHUTTER_RISE,
  SHUTTER_STAGGER,
  SHUTTER_TICKS,
  SLAM_TICKS,
  BIO_TOP,
  bioText,
  stripFrameAt,
  stripTotal,
} from '../../src/game/scenes/character-select';
import { HighScoresScene } from '../../src/game/scenes/high-scores';
import { HowToPlayScene } from '../../src/game/scenes/how-to-play';
import { MissionIntroScene } from '../../src/game/scenes/mission-intro';
import { ModeSelectScene } from '../../src/game/scenes/mode-select';
import { NameEntryScene } from '../../src/game/scenes/name-entry';
import { OptionsScene } from '../../src/game/scenes/options';
import { TitleScene } from '../../src/game/scenes/title';
import { GameSession } from '../../src/game/session';

await loadContent();

/** The redrawn select-screen ids: 1× only. */
const ONE_X = [
  'ui/mil/frame',
  'ui/mil/shutter',
  'ui/mil/shutter-slam',
  'ui/mil/dust',
  'ui/mil/hazard',
  'ui/mil/badge-off',
  'ui/mil/badge-p1',
  'ui/mil/badge-p2',
  'ui/mil/glow-p1',
  'ui/mil/glow-p2',
  'ui/mil/plate',
  'ui/mil/preview',
  'ui/mil/preview-glare',
  'ui/mil/emblem',
  stencilId('REPORT FOR DUTY'),
];
/** Sizes (w × h) of the redrawn ids (top-left anchored). */
const SIZE: Record<string, [number, number]> = {
  'ui/mil/frame': [384, 216],
  'ui/mil/shutter': [68, 128],
  'ui/mil/shutter-slam': [68, 128],
  'ui/mil/dust': [24, 12],
  'ui/mil/hazard': [64, 6],
  'ui/mil/badge-off': [28, 10],
  'ui/mil/badge-p1': [28, 10],
  'ui/mil/badge-p2': [28, 10],
  'ui/mil/glow-p1': [36, 18],
  'ui/mil/glow-p2': [36, 18],
  'ui/mil/plate': [64, 14],
  'ui/mil/preview': [44, 52],
  'ui/mil/preview-glare': [44, 52],
  'ui/mil/emblem': [40, 36],
};

/** FNV-1a of an id's 1× frames. */
function hash(id: string): string {
  let h = 2166136261;
  const fnv = (v: number): void => {
    h = Math.imul(h ^ v, 16777619) >>> 0;
  };
  for (const f of getFrames(id, 1)) {
    fnv(f.buf.w);
    fnv(f.buf.h);
    fnv(f.ox);
    fnv(f.oy);
    for (const c of f.buf.data) fnv(c);
  }
  return h.toString(16);
}

class Recorder extends SoftRenderer {
  texts: string[] = [];
  sprites: { id: string; frame: number; x: number; y: number; o?: DrawOpts }[] = [];
  override text(s: string, x: number, y: number, o?: Parameters<SoftRenderer['text']>[3]): void {
    this.texts.push(s);
    super.text(s, x, y, o);
  }
  override sprite(id: string, frame: number, x: number, y: number, o?: DrawOpts): void {
    this.sprites.push({ id, frame, x, y, o: o ? { ...o } : undefined });
    super.sprite(id, frame, x, y, o);
  }
  rects: { x: number; y: number; w: number; h: number; c: Color }[] = [];
  override rect(x: number, y: number, w: number, h: number, c: Color, o?: DrawOpts): void {
    this.rects.push({ x, y, w, h, c });
    super.rect(x, y, w, h, c, o);
  }
}
/** The ticker's fill (character-select.ts drawBio). */
const TICKER_FILL = PAL.ink[1];

interface FakePad extends GamepadLike {
  index: number;
  connected: boolean;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
}

function fakePad(index: number): FakePad {
  return {
    id: 'Generic (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
    index,
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  } as FakePad;
}

interface H {
  app: GameApp;
  scene: CharacterSelectScene;
  pads: FakePad[];
  step: (n: number) => void;
  tap: (b: Button, slot?: 0 | 1) => void;
  padTap: (p: FakePad, button: number) => void;
  draw: () => Recorder;
  log: () => string[];
}

function select(players: 1 | 2 = 1): H {
  const input = new InputManager();
  input.players = players;
  const pads: FakePad[] = [];
  input.useGamepads(new PadSource(() => pads));
  const held: Button[][] = [[], []];
  input.addSource(new ScriptedSource(() => held[0], 0));
  input.addSource(new ScriptedSource(() => held[1], 1));
  const audio = new NullAudio();
  const app = createApp({ input, audio, store: new MemoryStore(), params: { ...DEFAULT_PARAMS, players } });
  const scene = new CharacterSelectScene(app, players);
  app.scenes.reset(scene);
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
    }
  };
  step(1);
  const tap = (b: Button, slot: 0 | 1 = 0): void => {
    held[slot] = [b];
    step(1);
    held[slot] = [];
    step(1);
  };
  const padTap = (p: FakePad, button: number): void => {
    p.buttons[button] = { pressed: true, value: 1 };
    step(1);
    p.buttons[button] = { pressed: false, value: 0 };
    step(1);
  };
  const draw = (): Recorder => {
    const r = new Recorder();
    r.begin();
    app.scenes.draw(r);
    r.end();
    return r;
  };
  const log = (): string[] => ((app.audio as unknown as { inner: NullAudio }).inner ?? audio).log;
  return { app, scene, pads, step, tap, padTap, draw, log };
}

const ALL_OPEN = SHUTTER_DELAY + (MIL_PANELS - 1) * SHUTTER_STAGGER + (SHUTTER_RISE.length - 1) * SHUTTER_TICKS + 1;
const artOf = (id: string): string => getCharacter(id).art;

describe('REPORT FOR DUTY furniture at 1×', () => {
  it('registers every ui/mil id; the redrawn ones at their sizes, top-left anchored', () => {
    for (const id of [...ONE_X, 'ui/mil/bolt', ...[...STENCIL_TITLES, ...STENCIL_GOLD].map(stencilId)]) expect(hasSprite(id), id).toBe(true);
    for (const [id, [w, h]] of Object.entries(SIZE)) {
      for (const f of getFrames(id, 1)) {
        expect([f.buf.w, f.buf.h], id).toEqual([w, h]);
        expect([f.ox, f.oy], id).toEqual([0, 0]);
      }
    }
    expect(getFrames('ui/mil/shutter', 1)).toHaveLength(MIL_SHUTTER_FRAMES);
    expect(getFrames('ui/mil/shutter-slam', 1)).toHaveLength(2);
    expect(getFrames('ui/mil/dust', 1)).toHaveLength(6);
    expect(getFrames('ui/mil/badge-p1', 1)).toHaveLength(2);
    expect(getFrames('ui/mil/badge-p2', 1)).toHaveLength(2);
    expect(getFrames(stencilId('REPORT FOR DUTY'), 1)[0].buf.w).toBeGreaterThan(200);
  });

  it('is 1× only: no 2× / 4× art, getFrames at 2 and 4 gives the 1× frames; the bolt and the other titles keep theirs', () => {
    for (const id of ONE_X) {
      expect(hasHiSprite(id, 2), id).toBe(false);
      expect(hasHiSprite(id, 4), id).toBe(false);
      const one = getFrames(id, 1);
      for (const d of [2, 4]) {
        const fs = getFrames(id, d);
        expect(fs.length, id).toBe(one.length);
        fs.forEach((f, k) => expect(f.buf, `${id} @${d}`).toBe(one[k].buf));
      }
    }
    expect(hasHiSprite('ui/mil/bolt', 4)).toBe(true);
    for (const t of [...STENCIL_TITLES, ...STENCIL_GOLD]) if (t !== 'REPORT FOR DUTY') expect(hasHiSprite(stencilId(t), 4), t).toBe(true);
    // The select screen's furniture group is exactly the redrawn ids (the emblem is sprayed on the shutter).
    expect([...MIL_ART].sort()).toEqual(ONE_X.filter((id) => id !== 'ui/mil/emblem').sort());
  });

  it('uses palette colours only, fully opaque or empty', () => {
    for (const id of ONE_X) {
      for (const f of getFrames(id, 1)) {
        let bad = 0;
        for (const c of f.buf.data) if ((c & 255) !== 0 && ((c & 255) !== 255 || !inPalette(c))) bad++;
        expect(bad, id).toBe(0);
      }
    }
  });

  it('is deterministic (the same bytes when built again)', () => {
    const before = ONE_X.map(hash);
    for (const id of ONE_X) clearSpriteCache(id);
    expect(ONE_X.map(hash)).toEqual(before);
  });

  it('the frame: five transparent windows, a solid frame round them, a lit top edge on its plates', () => {
    const f = getFrames('ui/mil/frame', 1)[0].buf;
    for (let i = 0; i < MIL_PANELS; i++) {
      const x = 14 + i * 74;
      let open = 0;
      for (let y = 46; y < 166; y++) for (let xx = x; xx < x + 64; xx++) if ((f.get(xx, y) & 255) === 0) open++;
      expect(open, `window ${i}`).toBe(64 * 120);
      expect(f.get(x - 1, 100) & 255, `ink edge ${i}`).toBe(255);
    }
    let opaque = 0;
    for (const c of f.data) if (c & 255) opaque++;
    expect(opaque).toBe(384 * 216 - 5 * 64 * 120);
  });

  it('the shutter: frame k is the door raised by MIL_SHUTTER_OFFSETS[k]; closed solid, the last empty; the slam bunches the door', () => {
    expect(MIL_SHUTTER_OFFSETS[0]).toBe(0);
    expect(MIL_SHUTTER_OFFSETS[MIL_SHUTTER_OFFSETS.length - 1]).toBe(128);
    for (let k = 1; k < MIL_SHUTTER_OFFSETS.length; k++) expect(MIL_SHUTTER_OFFSETS[k]).toBeGreaterThan(MIL_SHUTTER_OFFSETS[k - 1]);
    const fs = getFrames('ui/mil/shutter', 1);
    expect(fs[0].buf.countOpaque()).toBe(68 * 128);
    expect(fs[fs.length - 1].buf.countOpaque()).toBe(0);
    MIL_SHUTTER_OFFSETS.forEach((d, k) => {
      expect(milShutterFrame(d)).toBe(k);
      // Raised by d: the bottom d rows are empty, the row above them is the door's last row.
      if (d > 0 && d < 128) {
        expect(fs[k].buf.get(30, 127 - d + 1) & 255, `frame ${k}`).toBe(0);
        expect(fs[k].buf.get(30, 127 - d), `frame ${k}`).toBe(fs[0].buf.get(30, 127));
      }
    });
    // Every rise and drop step has its own frame.
    for (const d of [...SHUTTER_RISE, ...SHUTTER_DROP]) expect(MIL_SHUTTER_OFFSETS, `offset ${d}`).toContain(d);
    const [s3, s1] = getFrames('ui/mil/shutter-slam', 1);
    const emptyTop = (b: (typeof s3)['buf']): number => {
      let n = 0;
      while (n < b.h && b.get(30, n) === 0) n++;
      return n;
    };
    expect(emptyTop(s3.buf)).toBe(3);
    expect(emptyTop(s1.buf)).toBe(1);
  });

  it('the dust thins out; the lit lamps glow in their colour; the glow is empty where the lamp sits', () => {
    const dust = getFrames('ui/mil/dust', 1).map((f) => f.buf.countOpaque());
    expect(dust[0]).toBeGreaterThan(0);
    expect(dust[5]).toBeLessThan(Math.max(...dust));
    for (const g of ['ui/mil/glow-p1', 'ui/mil/glow-p2']) {
      const b = getFrames(g, 1)[0].buf;
      for (let y = 4; y < 14; y++) for (let x = 4; x < 32; x++) expect(b.get(x, y) & 255, `${g} ${x},${y}`).toBe(0);
      expect(b.countOpaque()).toBeGreaterThan(20);
    }
    // The blink's bright frame is lighter than the steady one.
    const sum = (id: string, k: number): number => {
      let s = 0;
      for (const c of getFrames(id, 1)[k].buf.data) s += ((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255);
      return s;
    };
    expect(sum('ui/mil/badge-p1', 1)).toBeGreaterThan(sum('ui/mil/badge-p1', 0));
    expect(sum('ui/mil/badge-p2', 1)).toBeGreaterThan(sum('ui/mil/badge-p2', 0));
  });
});

describe('REPORT FOR DUTY: the strip helpers', () => {
  it('stripTotal and stripFrameAt read the sprite durations (loop and once)', () => {
    if (!hasSprite('test/select40/strip')) defineSprite('test/select40/strip', () => getFrames('ui/mil/dust', 1).slice(0, 3), { durations: [5, 2, 3], loop: false });
    expect(stripTotal('test/select40/strip')).toBe(10);
    expect(stripTotal('test/select40/none')).toBe(0);
    expect([0, 4, 5, 6, 7, 9, 10].map((t) => stripFrameAt('test/select40/strip', t))).toEqual([0, 0, 1, 1, 2, 2, 0]);
    expect([0, 6, 9, 10, 50].map((t) => stripFrameAt('test/select40/strip', t, true))).toEqual([0, 1, 2, 2, 2]);
  });
});

describe('REPORT FOR DUTY: the rise, the portraits and the pick', () => {
  it('the shutters rise one by one, ease out into a bounce at the top and settle fully raised', () => {
    const h = select();
    const seen: number[] = [];
    for (let t = 0; t < ALL_OPEN; t++) {
      seen.push(h.scene.shutterOffset(0));
      h.step(1);
    }
    // Panel 0's path: closed until SHUTTER_DELAY, then up to 128, down again (the bounce), up to 128.
    expect(seen.slice(0, SHUTTER_DELAY - 1).every((d) => d === 0)).toBe(true);
    const top = seen.indexOf(128);
    expect(top).toBeGreaterThan(SHUTTER_DELAY);
    const after = seen.slice(top);
    expect(Math.min(...after)).toBeLessThan(128);
    expect(Math.min(...after)).toBeGreaterThanOrEqual(100);
    expect(after[after.length - 1]).toBe(128);
    // Easing out: the steps get smaller toward the top.
    const steps = SHUTTER_RISE.slice(1, SHUTTER_RISE.indexOf(128) + 1).map((d, k) => d - SHUTTER_RISE[k]);
    expect(steps[steps.length - 1]).toBeLessThan(Math.max(...steps));
    for (let i = 0; i < h.scene.roster.length; i++) expect(h.scene.shutterFrame(i)).toBe(MIL_SHUTTER_FRAMES - 1);
    // Panel 1 starts SHUTTER_STAGGER later.
    const h2 = select();
    h2.step(SHUTTER_DELAY + 4 * SHUTTER_TICKS);
    expect(h2.scene.shutterOffset(0)).toBeGreaterThan(0);
    expect(h2.scene.shutterOffset(1)).toBe(0);
  });

  it('unlit panels show select-grey; the highlighted one plays its select loop from frame 0', () => {
    const h = select();
    h.step(ALL_OPEN);
    h.tap('right');
    const [a, b] = h.scene.roster;
    const at0 = h.scene.portraitAt(1);
    expect(at0?.id).toBe(`${artOf(b)}/select`);
    expect(at0?.frame).toBe(0);
    expect(h.scene.portraitAt(0)?.id).toBe(`${artOf(a)}/select-grey`);
    // The loop runs and comes back round.
    const id = `${artOf(b)}/select`;
    const total = stripTotal(id);
    const frames = new Set<number>();
    // The loop's clock starts at the highlight (the tap's press tick; its release step ran since).
    for (let t = 0; t < total; t++) {
      const f = h.scene.portraitAt(1)?.frame ?? -1;
      expect(f, `tick ${t}`).toBe(stripFrameAt(id, t + 1));
      frames.add(f);
      h.step(1);
    }
    expect(frames.size).toBe(getFrames(id, 1).length);
    expect(h.scene.portraitAt(1)?.frame).toBe(stripFrameAt(id, total));
    // Drawn: the lit loop for panel 1, grey for the others.
    const r = h.draw();
    const drawn = r.sprites.map((s) => s.id);
    expect(drawn).toContain(id);
    expect(drawn).toContain(`${artOf(a)}/select-grey`);
    expect(drawn.filter((s) => s.endsWith('/select-pick'))).toEqual([]);
  });

  it('confirm: a white flash on the pick frame 0, select-pick once and held, then the drop, the slam, the shake, dust, the preview', () => {
    const h = select();
    h.step(ALL_OPEN);
    h.tap('right');
    h.tap('fire');
    const id = h.scene.roster[1];
    const pick = `${artOf(id)}/select-pick`;
    const pt = pickTicks(id);
    expect(h.scene.pickTicksOf(0)).toBe(pt);
    expect(h.scene.dropStart(0)).toBe(Math.max(FLASH_TICKS, pt));
    expect(h.scene.dropDone(0)).toBe(h.scene.dropStart(0) + DROP_TICKS);
    // Ticks since the confirm (the tap's release step ran after it).
    let ct = (h.scene as unknown as { cursors: { chosenT: number }[] }).cursors[0].chosenT;
    const flashAt = (r: Recorder): boolean => r.sprites.some((s) => s.o?.flash === true && s.x === 88);
    {
      expect(hasSprite(pick), pick).toBe(true);
      expect(pt).toBeGreaterThanOrEqual(24);
      expect(pt).toBeLessThanOrEqual(40);
      expect(h.scene.portraitAt(1)?.id).toBe(pick);
      expect(flashAt(h.draw())).toBe(ct < FLASH_TICKS);
      const seen: number[] = [];
      for (; ct < pt + 10; ct++) {
        const at = h.scene.portraitAt(1);
        seen.push(at?.frame ?? -1);
        // The door stays raised while the reaction plays.
        if (ct < h.scene.dropStart(0)) expect(h.scene.shutterOffset(1), `tick ${ct}`).toBe(128);
        if (ct === FLASH_TICKS) expect(flashAt(h.draw())).toBe(false);
        h.step(1);
      }
      const n = getFrames(pick, 1).length;
      // Every frame once, in order, then the last held.
      expect([...new Set(seen)]).toEqual(Array.from({ length: n }, (_, k) => k));
      expect(seen[seen.length - 1]).toBe(n - 1);
      expect(spriteAnim(pick).loop).toBe(false);
    }
    // The drop: offsets fall along SHUTTER_DROP until the door lands.
    while (ct < h.scene.dropStart(0)) {
      h.step(1);
      ct++;
    }
    const falling: number[] = [];
    while (ct < h.scene.dropDone(0)) {
      falling.push(h.scene.shutterOffset(1));
      expect(h.scene.previewShown(0)).toBe(false);
      h.step(1);
      ct++;
    }
    for (let k = 1; k < falling.length; k++) expect(falling[k]).toBeLessThanOrEqual(falling[k - 1]);
    expect(h.log().filter((e) => e === 'sfx:ui/mil-clank')).toHaveLength(1);
    expect(h.scene.shutterOffset(1)).toBe(0);
    expect(h.scene.previewShown(0)).toBe(true);
    // Landed: the slam frames with the shake, dust puffs both sides, the preview figure behind glare.
    const r0 = h.draw();
    const slam = r0.sprites.find((s) => s.id === 'ui/mil/shutter-slam');
    expect(slam?.frame).toBe(0);
    expect(slam?.y).toBe(46 - 4 + SHAKE[0]);
    expect(r0.sprites.filter((s) => s.id === 'ui/mil/dust')).toHaveLength(2);
    expect(r0.sprites.some((s) => s.id === 'ui/mil/dust' && s.o?.flipX)).toBe(true);
    for (const s of ['ui/mil/preview', 'ui/mil/preview-glare', `${artOf(id)}/legs-idle`]) expect(r0.sprites.map((x) => x.id), s).toContain(s);
    h.step(SLAM_TICKS);
    expect(h.draw().sprites.find((s) => s.id === 'ui/mil/shutter-slam')?.frame).toBe(1);
    h.step(SLAM_TICKS);
    const r2 = h.draw();
    expect(r2.sprites.some((s) => s.id === 'ui/mil/shutter-slam')).toBe(false);
    // The dust plays on at its own speed.
    expect(r2.sprites.find((s) => s.id === 'ui/mil/dust')?.frame).toBe(stripFrameAt('ui/mil/dust', 2 * SLAM_TICKS, true));
    expect(stripFrameAt('ui/mil/dust', 2 * SLAM_TICKS, true)).toBeGreaterThan(0);
    expect(r2.sprites.find((s) => s.id === 'ui/mil/shutter' && s.x === 86)).toMatchObject({ frame: 0, y: 42 });
    h.step(30);
    expect(h.draw().sprites.some((s) => s.id === 'ui/mil/dust')).toBe(false);
    // The campaign starts CONFIRM_HOLD ticks after the landing.
    h.step(CONFIRM_HOLD - 2 * SLAM_TICKS - 30 - 2);
    expect(h.app.scenes.top).toBe(h.scene);
    h.step(40);
    expect(h.app.scenes.top).toBeInstanceOf(MissionIntroScene);
  });

  it('a soldier without a pick reaction keeps the old timing (flash, then the drop)', () => {
    const h = select();
    h.step(ALL_OPEN);
    (h.scene as unknown as { pickT: number[] }).pickT.fill(0);
    h.tap('fire');
    expect(h.scene.dropStart(0)).toBe(FLASH_TICKS);
    expect(h.scene.dropDone(0)).toBe(FLASH_TICKS + DROP_TICKS);
    h.step(FLASH_TICKS + DROP_TICKS);
    expect(h.scene.previewShown(0)).toBe(true);
  });

  it('the lamps: off, lit with a glow halo (additive) and a short blink', () => {
    const h = select(2);
    h.step(ALL_OPEN);
    const r = h.draw();
    const glows = r.sprites.filter((s) => s.id.startsWith('ui/mil/glow-'));
    expect(glows.map((s) => s.id).sort()).toEqual(['ui/mil/glow-p1', 'ui/mil/glow-p2']);
    for (const g of glows) expect(g.o?.blend).toBe('add');
    expect(r.sprites.filter((s) => s.id === 'ui/mil/badge-off')).toHaveLength(2 * MIL_PANELS - 2);
    const frames = new Set<number>();
    for (let t = 0; t < 80; t++) {
      frames.add(h.scene.lampFrame(0));
      h.step(1);
    }
    expect([...frames].sort()).toEqual([0, 1]);
  });

  it('two players: a taken soldier is refused; both pick reactions play; the campaign starts when both doors are down', () => {
    const h = select(2);
    h.step(ALL_OPEN);
    h.tap('fire', 0);
    h.tap('left', 1);
    h.tap('fire', 1);
    expect(h.scene.choices).toEqual([h.scene.roster[0], null]);
    expect(h.log()).toContain('sfx:ui/cancel');
    // P2 takes a while: P1's door is down and held long before.
    h.step(h.scene.dropDone(0) + CONFIRM_HOLD + 20);
    expect(h.app.scenes.top).toBe(h.scene);
    h.tap('right', 1);
    h.tap('right', 1);
    h.tap('fire', 1);
    expect(h.scene.choices).toEqual([h.scene.roster[0], h.scene.roster[2]]);
    expect(h.scene.portraitAt(2)?.id).toBe(`${artOf(h.scene.roster[2])}/select-pick`);
    h.step(h.scene.dropDone(1) + CONFIRM_HOLD - 3);
    expect(h.app.scenes.top).toBe(h.scene);
    h.step(40);
    expect(h.app.scenes.top).toBeInstanceOf(MissionIntroScene);
    expect(h.app.session?.slots.map((s) => s.character)).toEqual([h.scene.roster[0], h.scene.roster[2]]);
  });

  it('the timer picks the highlighted soldier at 0 and plays its reaction; back before a pick leaves', () => {
    const h = select();
    h.tap('right');
    h.step(SELECT_SECONDS * 60);
    expect(h.scene.choices).toEqual([h.scene.roster[1]]);
    expect(h.scene.portraitAt(1)?.id).toBe(`${artOf(h.scene.roster[1])}/select-pick`);
    const b = select();
    b.step(5);
    b.tap('bomb');
    b.step(20);
    expect(b.app.scenes.top).toBeInstanceOf(ModeSelectScene);
  });

  it('a free pad claims the first player without a pad (P1 first, then P2; that press picks nobody)', () => {
    const h = select(2);
    const pad = fakePad(0);
    h.pads.push(pad);
    h.step(2);
    expect(h.scene.wantsPad(0)).toBe(true);
    h.padTap(pad, PAD.start);
    expect(h.app.input.slotHasPad(0)).toBe(true);
    expect(h.app.input.slotHasPad(1)).toBe(false);
    expect(h.scene.choices).toEqual([null, null]);
    expect(h.log()).toContain('sfx:ui/move');
    // A second pad goes to P2.
    const pad2 = fakePad(1);
    h.pads.push(pad2);
    h.step(2);
    expect(h.scene.wantsPad(1)).toBe(true);
    h.padTap(pad2, PAD.start);
    expect(h.app.input.slotHasPad(1)).toBe(true);
    expect(h.scene.wantsPad(0)).toBe(false);
    expect(h.scene.wantsPad(1)).toBe(false);
    expect(h.scene.choices).toEqual([null, null]);
  });

  it('every roster soldier has the three portrait strips (no fallback on this screen)', () => {
    const h = select();
    expect(h.scene.roster.length).toBe(MIL_PANELS);
    for (const id of h.scene.roster) for (const s of ['select', 'select-grey', 'select-pick']) expect(hasSprite(`${artOf(id)}/${s}`), `${id} ${s}`).toBe(true);
  });

  it('the bio ticker: under the face only (panel rows from BIO_TOP >= 100), never on a chosen panel, every line in turn', () => {
    expect(BIO_TOP).toBeGreaterThanOrEqual(100);
    const h = select(2);
    const hold = (): void => {
      (h.scene as unknown as { left: number }).left = SELECT_SECONDS * 60;
    };
    // P2 rests on panel 0 long enough for its ticker; then P1 picks panel 0: no ticker over the pick.
    h.tap('left', 1);
    h.step(ALL_OPEN);
    expect(h.scene.bioAt(0)).not.toBeNull();
    h.tap('fire', 0);
    for (let t = 0; t < h.scene.dropDone(0) + 10; t++) {
      expect(h.scene.bioAt(0), `pick tick ${t}`).toBeNull();
      h.step(1);
    }
    // P2 goes back to panel 1 and stays there.
    h.tap('right', 1);
    const b = bioText(h.scene.roster[1]);
    const want = [...b.callsign, ...b.lines];
    const seen = new Set<string>();
    let shown = 0;
    for (let t = 0; t < 3000; t++) {
      // P2's cursor rests on panel 1 (a chosen panel 0 plays its pick and never shows the ticker).
      expect(h.scene.bioAt(0), `tick ${t}`).toBeNull();
      const at = h.scene.bioAt(1);
      if (at) {
        shown++;
        expect(at.y, `tick ${t}`).toBeGreaterThanOrEqual(46 + BIO_TOP);
      }
      if (t % 4 === 0) {
        const r = h.draw();
        for (const x of r.texts) if (want.includes(x)) seen.add(x);
        // Nothing of the ticker is drawn above its top row inside the window.
        for (const q of r.rects) if (q.c === TICKER_FILL && q.x === 88 && q.w === 64) expect(q.y, `tick ${t}`).toBeGreaterThanOrEqual(46 + BIO_TOP);
      }
      hold();
      h.step(1);
    }
    expect(h.scene.choices[1]).toBeNull();
    expect(shown).toBeGreaterThan(0);
    expect([...seen].sort()).toEqual([...new Set(want)].sort());
    // P2's cursor on P1's chosen panel: no ticker over its pick reaction.
    h.tap('left', 1);
    expect(h.scene.cursorIndex(1)).toBe(0);
    for (let t = 0; t < 400; t++) {
      expect(h.scene.bioAt(0), `tick ${t}`).toBeNull();
      hold();
      h.step(1);
    }
  });
});

describe('every other screen with ui/mil art still draws it', () => {
  it('title, mode select, options, how to play, high scores, name entry, mission intro: no missing ui/mil sprite', () => {
    const h = select();
    const app = h.app;
    app.session = new GameSession({ characters: ['vincent'], seed: 7 });
    const scenes = [
      new TitleScene(app),
      new ModeSelectScene(app),
      new OptionsScene(app),
      new HowToPlayScene(app),
      new HighScoresScene(app, { mode: 'attract' }),
      new NameEntryScene(app, [app.session.slots[0]], true),
      new MissionIntroScene(app, 'ams'),
    ];
    // The stencil title each screen draws (the title blinks PRESS START: drawn on some ticks).
    const want: Record<string, string> = {
      TitleScene: stencilId('PRESS START'),
      ModeSelectScene: stencilId('SELECT OPERATION'),
      OptionsScene: stencilId('OPTIONS'),
      HowToPlayScene: stencilId('HOW TO PLAY'),
      HighScoresScene: stencilId('HALL OF FAME'),
      NameEntryScene: stencilId('ENTER YOUR INITIALS'),
    };
    for (const s of scenes) {
      app.scenes.reset(s);
      const ids = new Set<string>();
      for (let k = 0; k < 40; k++) {
        h.step(1);
        for (const sp of h.draw().sprites) if (sp.id.startsWith('ui/mil/')) ids.add(sp.id);
      }
      for (const id of ids) expect(hasSprite(id), `${s.constructor.name}: ${id}`).toBe(true);
      const w = want[s.constructor.name];
      if (w) expect([...ids], s.constructor.name).toContain(w);
    }
  });
});
