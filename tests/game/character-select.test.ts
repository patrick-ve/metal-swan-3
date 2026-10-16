/**
 * REPORT FOR DUTY and the military menus (docs/design/squad.md §3, §6): the shutters open one by
 * one, the highlight and the P1 / P2 lamps follow the cursors, a confirm drops the shutter and
 * shows the preview window, a taken soldier is refused, the timer picks at 0, back leaves before
 * a pick, two players start a 2-player campaign; the boot, title and mode select texts; no banned
 * name or copied reference line in any new text.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { InputManager, ScriptedSource, type Button } from '../../src/engine/input';
import type { DrawOpts, TextOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { hasSprite } from '../../src/engine/sprites';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, GameAudio, type GameApp } from '../../src/game/app';
import { loadContent } from '../../src/game/content/index';
import { MIL_PANELS, MIL_SHUTTER_FRAMES, STENCIL_GOLD, STENCIL_TITLES, stencilId } from '../../src/game/content/ui/military.art';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { BootScene } from '../../src/game/scenes/boot';
import {
  bioText,
  CharacterSelectScene,
  CONFIRM_TICKS,
  DROP_DONE,
  SELECT_SECONDS,
  SHUTTER_DELAY,
  SHUTTER_STAGGER,
  SHUTTER_TICKS,
  wrapSmall,
} from '../../src/game/scenes/character-select';
import { DIFFICULTY_INFO, HOW_TO_PLAY, TAGLINES } from '../../src/game/scenes/flow-data';
import { MissionIntroScene } from '../../src/game/scenes/mission-intro';
import { ModeSelectScene } from '../../src/game/scenes/mode-select';
import { TitleScene } from '../../src/game/scenes/title';
import { measure } from '../../src/engine/font';

await loadContent();

/** A software renderer that remembers the text and sprites drawn. */
class Recorder extends SoftRenderer {
  texts: string[] = [];
  sprites: { id: string; frame: number; x: number; y: number }[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    this.texts.push(s);
    super.text(s, x, y, o);
  }
  override sprite(id: string, frame: number, x: number, y: number, o?: DrawOpts): void {
    this.sprites.push({ id, frame, x, y });
    super.sprite(id, frame, x, y, o);
  }
  reset(): void {
    this.texts = [];
    this.sprites = [];
  }
}

interface Harness {
  app: GameApp;
  r: Recorder;
  step: (n: number) => void;
  tap: (b: Button, slot?: 0 | 1) => void;
  log: () => string[];
  /** Draw one frame and return what was drawn. */
  frame: () => Recorder;
}

function harness(): Harness {
  const input = new InputManager();
  const held: Button[][] = [[], []];
  input.addSource(new ScriptedSource(() => held[0], 0));
  input.addSource(new ScriptedSource(() => held[1], 1));
  const app = createApp({ input, audio: new NullAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS } });
  const r = new Recorder();
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
    }
  };
  const tap = (b: Button, slot: 0 | 1 = 0): void => {
    held[slot] = [b];
    step(1);
    held[slot] = [];
    step(1);
  };
  const log = (): string[] => ((app.audio as GameAudio).inner as NullAudio).log;
  const frame = (): Recorder => {
    r.reset();
    r.begin();
    app.scenes.draw(r);
    r.end();
    return r;
  };
  return { app, r, step, tap, log, frame };
}

function select(players: 1 | 2 = 1): Harness & { scene: CharacterSelectScene } {
  const h = harness();
  const scene = new CharacterSelectScene(h.app, players);
  h.app.scenes.reset(scene);
  h.step(1);
  return { ...h, scene };
}

/** Ticks until every shutter of the roster is fully raised. */
const ALL_OPEN = SHUTTER_DELAY + (MIL_PANELS - 1) * SHUTTER_STAGGER + (MIL_SHUTTER_FRAMES - 1) * SHUTTER_TICKS + 2;

describe('REPORT FOR DUTY: art', () => {
  it('registers the military ui ids (frame, 8 shutter frames, hazard, badges, plate, preview, stencil titles)', async () => {
    const { getFrame, getFrames } = await import('../../src/engine/sprites');
    for (const id of ['ui/mil/frame', 'ui/mil/shutter', 'ui/mil/hazard', 'ui/mil/badge-off', 'ui/mil/badge-p1', 'ui/mil/badge-p2', 'ui/mil/plate', 'ui/mil/preview', 'ui/mil/emblem']) {
      expect(hasSprite(id), id).toBe(true);
    }
    for (const t of [...STENCIL_TITLES, ...STENCIL_GOLD]) expect(hasSprite(stencilId(t)), t).toBe(true);
    expect(getFrames('ui/mil/shutter')).toHaveLength(MIL_SHUTTER_FRAMES);
    const frame = getFrame('ui/mil/frame', 0).buf;
    expect([frame.w, frame.h]).toEqual([384, 216]);
    // The five windows are transparent; the frame between them is not.
    for (let i = 0; i < MIL_PANELS; i++) {
      const x = 14 + i * 74;
      expect(frame.get(x + 32, 100) & 255, `window ${i}`).toBe(0);
      expect(frame.get(x - 5, 100) & 255, `pillar ${i}`).not.toBe(0);
    }
    expect(stencilId('REPORT FOR DUTY')).toBe('ui/mil/stencil-report-for-duty');
    const sh = getFrame('ui/mil/shutter', 0).buf;
    expect([sh.w, sh.h]).toEqual([68, 128]);
    // Frame 0 is the closed door; the last frame is empty (fully raised).
    expect(sh.countOpaque()).toBe(68 * 128);
    expect(getFrame('ui/mil/shutter', MIL_SHUTTER_FRAMES - 1).buf.countOpaque()).toBe(0);
  });
});

describe('REPORT FOR DUTY: sequence', () => {
  it('opens with every shutter closed; they rise one after another with a rattle each', () => {
    const { scene, step, log } = select();
    for (let i = 0; i < MIL_PANELS; i++) expect(scene.shutterFrame(i), `panel ${i}`).toBe(0);
    step(SHUTTER_DELAY + 2 * SHUTTER_TICKS);
    expect(scene.shutterFrame(0)).toBeGreaterThan(0);
    expect(scene.shutterFrame(1)).toBe(0);
    step(ALL_OPEN);
    for (let i = 0; i < scene.roster.length; i++) expect(scene.shutterFrame(i), `panel ${i}`).toBe(MIL_SHUTTER_FRAMES - 1);
    expect(log().filter((e) => e === 'sfx:ui/mil-shutter')).toHaveLength(Math.min(MIL_PANELS, scene.roster.length));
  });

  it('the highlight and P1 lamp follow the cursor (colour portrait, grey others, ui/move)', () => {
    const { scene, step, tap, log, frame } = select();
    step(ALL_OPEN);
    expect(scene.highlighted(0)).toBe(true);
    expect(scene.highlighted(1)).toBe(false);
    expect(scene.badgeLit(0, 0)).toBe(true);
    tap('right');
    expect(scene.cursorIndex(0)).toBe(1);
    expect(scene.highlighted(0)).toBe(false);
    expect(scene.highlighted(1)).toBe(true);
    expect(scene.badgeLit(0, 1)).toBe(true);
    expect(scene.badgeLit(0, 0)).toBe(false);
    expect(log()).toContain('sfx:ui/move');
    const r = frame();
    const ids = r.sprites.map((s) => s.id);
    expect(ids).toContain('ui/mil/frame');
    expect(ids).toContain('ui/mil/badge-p1');
    expect(ids).toContain(stencilId('REPORT FOR DUTY'));
    expect(ids.filter((id) => id === 'ui/mil/plate')).toHaveLength(MIL_PANELS);
    const art = (id: string): string => `char/${id}`;
    const [a, b] = scene.roster;
    if (hasSprite(`${art(b)}/select`)) {
      expect(ids).toContain(`${art(b)}/select`);
      if (hasSprite(`${art(a)}/select-grey`)) expect(ids).toContain(`${art(a)}/select-grey`);
    }
    expect(r.texts).toContain('STAND BY');
  });

  it('confirm: name callout, flash, the shutter drops, the preview window shows, then the campaign starts', () => {
    const { app, scene, step, tap, log, frame } = select();
    step(ALL_OPEN);
    tap('right');
    tap('fire');
    const id = scene.roster[1];
    expect(scene.choices).toEqual([id]);
    expect(log()).toContain('sfx:ui/select-confirm');
    expect(log().some((e) => e.startsWith('voice:') && e.endsWith('!'))).toBe(true);
    expect(scene.previewShown(0)).toBe(false);
    step(DROP_DONE);
    expect(scene.shutterFrame(1)).toBe(0);
    expect(scene.previewShown(0)).toBe(true);
    expect(log()).toContain('sfx:ui/mil-clank');
    const r = frame();
    expect(r.sprites.map((s) => s.id)).toContain('ui/mil/preview');
    expect(r.sprites.map((s) => s.id)).toContain('ui/mil/hazard');
    expect(r.texts).toContain('READY!');
    step(CONFIRM_TICKS + 30);
    expect(app.scenes.top).toBeInstanceOf(MissionIntroScene);
    expect(app.session?.slots[0].character).toBe(id);
  });

  it('a soldier the other player took is refused (ui/cancel); two players start a 2-player campaign', () => {
    const { app, scene, step, tap, log } = select(2);
    expect(scene.cursorIndex(0)).toBe(0);
    expect(scene.cursorIndex(1)).toBe(1);
    step(ALL_OPEN);
    expect(scene.badgeLit(1, 1)).toBe(true);
    tap('fire', 0);
    tap('left', 1);
    expect(scene.cursorIndex(1)).toBe(0);
    tap('fire', 1);
    expect(scene.choices).toEqual([scene.roster[0], null]);
    expect(log()).toContain('sfx:ui/cancel');
    tap('right', 1);
    tap('right', 1);
    tap('fire', 1);
    expect(scene.choices).toEqual([scene.roster[0], scene.roster[2]]);
    step(CONFIRM_TICKS + 30);
    expect(app.scenes.top).toBeInstanceOf(MissionIntroScene);
    expect(app.session?.slots.map((s) => s.character)).toEqual([scene.roster[0], scene.roster[2]]);
  });

  it('the timer ticks a warning each second from 5 and picks the highlighted soldier at 0', () => {
    const { scene, step, tap, log } = select();
    tap('right');
    step(SELECT_SECONDS * 60 - 10);
    expect(scene.choices).toEqual([null]);
    expect(scene.secondsLeft).toBe(1);
    step(12);
    expect(scene.choices).toEqual([scene.roster[1]]);
    expect(log().filter((e) => e === 'sfx:ui/timer-warn')).toHaveLength(5);
  });

  it('back (bomb) before any pick returns to the mode select; after a pick it does nothing', () => {
    const a = select();
    a.step(10);
    a.tap('bomb');
    a.step(20);
    expect(a.app.scenes.top).toBeInstanceOf(ModeSelectScene);
    const b = select(2);
    b.tap('fire', 0);
    b.tap('bomb', 1);
    b.step(20);
    expect(b.app.scenes.top).toBeInstanceOf(CharacterSelectScene);
  });

  it('the bio box: callsign and bio wrapped inside the panel (long words hyphenated), shown after a beat', () => {
    for (const s of ['A supernerd with a keen appetite for AI and master of eating frikandellen.', 'EXCEPTIONAL FRIKANDELLEN']) {
      for (const line of wrapSmall(s, 60)) expect(measure(line, 'small'), line).toBeLessThanOrEqual(60);
    }
    const { scene, step, frame } = select();
    const b = bioText(scene.roster[0]);
    expect(b.lines.length).toBeGreaterThan(0);
    step(ALL_OPEN + 40);
    const r = frame();
    for (const s of b.callsign) expect(r.texts).toContain(s);
  });
});

describe('military menu texts (docs/design/squad.md §3)', () => {
  it('boot: LOADING AMMUNITION with the percentage', () => {
    const h = harness();
    const boot = new BootScene(h.app);
    const r = new Recorder();
    r.begin();
    boot.draw(r);
    r.end();
    expect(r.texts.some((s) => /^LOADING AMMUNITION\.\.\. \d+%$/.test(s))).toBe(true);
  });

  it('title: the military taglines and a stencil PRESS START', () => {
    expect(TAGLINES).toEqual(['THE SWAN HAS LANDED. THE ENEMY HAS NOT.', 'ONE SWAN. FIVE IDIOTS. ZERO RETREAT.', 'LOCK. LOAD. HONK.', 'OPERATION FRIKANDEL IS A GO.']);
    const h = harness();
    const t = new TitleScene(h.app);
    h.app.scenes.reset(t);
    h.step(2);
    const r = h.frame();
    expect(TAGLINES).toContain(t.tagline);
    expect(r.texts).toContain(t.tagline);
    expect(r.sprites.map((s) => s.id)).toContain(stencilId('PRESS START'));
  });

  it('mode select: SELECT OPERATION, soldiers, the military difficulty nicknames, HALL OF FAME', () => {
    expect(DIFFICULTY_INFO.easy.nick).toBe('"RECRUIT"');
    expect(DIFFICULTY_INFO.normal.nick).toBe('"VETERAN"');
    expect(DIFFICULTY_INFO.hard.nick).toBe('"COMMANDO"');
    expect([DIFFICULTY_INFO.easy.hint, DIFFICULTY_INFO.normal.hint, DIFFICULTY_INFO.hard.hint]).toEqual(['MORE LIVES. SLOWER BULLETS.', 'THE REAL WAR.', 'NO MERCY. NO MEDALS.']);
    const h = harness();
    h.app.scenes.reset(new ModeSelectScene(h.app));
    h.step(2);
    const r = h.frame();
    for (const s of ['1 SOLDIER', '2 SOLDIERS', 'OPTIONS', 'HALL OF FAME']) expect(r.texts).toContain(s);
    expect(r.sprites.map((s) => s.id)).toContain(stencilId('SELECT OPERATION'));
  });

  it('no banned name and no copied reference menu line in any new text', () => {
    const doc = readFileSync(new URL('../../docs/ORIGINALITY.md', import.meta.url), 'utf8');
    const names = /\*\*Names:\*\*([\s\S]*?)\n- \*\*/.exec(doc)?.[1] ?? '';
    const banned = names
      .replace(/or any[\s\S]*$/, '')
      .split(',')
      .map((s) => s.replace(/\s+/g, ' ').trim().replace(/\.$/, ''))
      .filter((s) => s.length > 2);
    expect(banned.length).toBeGreaterThan(30);
    const copied = ['SOLDIER SELECT', 'PLEASE WAIT', 'MISSION START'];
    const texts = [
      ...TAGLINES,
      ...Object.values(DIFFICULTY_INFO).flatMap((d) => [d.name, d.nick, d.hint]),
      ...HOW_TO_PLAY.flat(),
      ...STENCIL_TITLES,
      ...STENCIL_GOLD,
      'LOADING AMMUNITION...',
      'STAND BY',
      'READY!',
      '1 SOLDIER',
      '2 SOLDIERS',
    ];
    for (const t of texts) {
      for (const b of banned) expect(t.toUpperCase().includes(b.toUpperCase()), `"${t}" contains "${b}"`).toBe(false);
      for (const c of copied) expect(t.toUpperCase().includes(c), `"${t}" copies "${c}"`).toBe(false);
    }
  });
});
