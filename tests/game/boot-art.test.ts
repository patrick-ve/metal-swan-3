/**
 * The boot preload (docs/ARCHITECTURE.md §5.4): `bootArt` lists the sprite id prefixes the boot
 * generates (the start screens, the select roster, the first mission's `art`), and everything the
 * start screens (with the attract loop) and mission ams draw at 1× is in that list — so a normal
 * game never generates a sprite while it plays. A sprite outside the list still works (it is made
 * on first use); this test only keeps the list complete.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { InputManager, ScriptedSource, timeline, type Button } from '../../src/engine/input';
import { SoftRenderer } from '../../src/engine/render-soft';
import { clearSpriteCache, generatedSprites } from '../../src/engine/sprites';
import { MemoryStore } from '../../src/engine/storage';
import { createApp } from '../../src/game/app';
import { isLazyContent, loadContent } from '../../src/game/content/index';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { getMission } from '../../src/game/registry';
import { bootArt, START_ART } from '../../src/game/scenes/boot';
import { selectRoster } from '../../src/game/scenes/character-select';
import { CharacterSelectScene } from '../../src/game/scenes/character-select';
import { TitleScene } from '../../src/game/scenes/title';
import { createHeadlessGame } from '../../src/sim/index';

await loadContent((id) => !isLazyContent(id));

/** Ids generated so far that no prefix of `art` covers. */
function outside(art: readonly string[]): string[] {
  return generatedSprites(1).filter((id) => !art.some((p) => id.startsWith(p)));
}

describe('bootArt', () => {
  it('lists the start screens, the roster and the art of ams; a direct start only its character', () => {
    const ams = getMission('ams')?.art ?? [];
    expect(ams.length).toBeGreaterThan(0);
    const roster = selectRoster().map((c) => `char/${c}/`);
    expect(bootArt(DEFAULT_PARAMS)).toEqual([...START_ART, ...roster, ...ams]);
    expect(bootArt({ ...DEFAULT_PARAMS, mission: 'ams' })).toEqual([...START_ART, 'char/recruit/', ...ams]);
    expect(bootArt({ ...DEFAULT_PARAMS, mission: 'ams', char: 'dirk' })).toEqual([...START_ART, 'char/dirk/', ...ams]);
    expect(bootArt({ ...DEFAULT_PARAMS, mode: 'fps' })).toEqual([...START_ART, 'char/recruit/', ...ams]);
  });

  it('is everything (undefined) for a mission without an art list', () => {
    expect(getMission('m2')?.art).toBeUndefined();
    expect(bootArt({ ...DEFAULT_PARAMS, mission: 'm2' })).toBeUndefined();
  });

  it('covers what the start screens, the attract loop and every part of ams draw', async () => {
    clearSpriteCache();
    const art = bootArt(DEFAULT_PARAMS) ?? [];

    // The start screens: the title with its attract loop, mode select, every select panel, the card.
    const input = new InputManager();
    input.addSource(new ScriptedSource(timeline().idle(1), 0));
    const held: Button[] = [];
    input.addSource(new ScriptedSource(() => held, 0));
    const app = createApp({ input, audio: new NullAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS } });
    const r = new SoftRenderer();
    const step = (n: number): void => {
      for (let i = 0; i < n; i++) {
        input.update();
        app.scenes.update();
        if (i % 2 === 0) {
          r.begin();
          app.scenes.draw(r);
          r.end();
        }
      }
    };
    const tap = (b: Button): void => {
      held.push(b);
      step(1);
      held.length = 0;
      step(1);
    };
    app.scenes.reset(new TitleScene(app));
    step(2500); // idle: demo play, HOW TO PLAY, high scores, back to the title
    tap('start');
    step(30);
    tap('fire'); // 1 PLAYER
    step(30);
    expect(app.scenes.top).toBeInstanceOf(CharacterSelectScene);
    for (let i = 0; i < 6; i++) {
      tap('right');
      step(20);
    }
    tap('fire');
    step(200); // the intro card
    expect(outside(art)).toEqual([]);

    // Mission ams: the bot in every section and at the boss, drawn every third tick.
    const parts: Array<{ sectionId?: string; bossRush?: boolean }> = [{ sectionId: 'a' }, { sectionId: 'b' }, { sectionId: 'c' }, { sectionId: 'd' }, { bossRush: true }];
    for (const part of parts) {
      const g = await createHeadlessGame({ missionId: 'ams', ...part, seed: 3, bot: true, god: true, characterId: selectRoster()[0], loadContent: false });
      for (let t = 0; t < 1500 && !g.done; t++) {
        g.step(1);
        if (t % 3 === 0) g.renderFrame();
      }
      g.dispose();
    }
    // The runs really drew the mission (the 1× frames under the 2× art included).
    expect(generatedSprites(1, 'enemy/').length).toBeGreaterThan(100);
    expect(generatedSprites(1, 'boss/ams-mayor/').length).toBeGreaterThan(10);
    expect(outside(art)).toEqual([]);
  });
});
