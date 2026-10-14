/**
 * Scene audio (2026-10-14, step 2 fixes): the intro card voices Gusto's briefing lines through
 * `AudioOut.say` (one at a time), and gameplay silences its loops under the pause menu and stops
 * them when it is left (pause QUIT, game over, mission end).
 */
import { describe, expect, it } from 'vitest';
import { NullAudio, type AudioOut } from '../../src/engine/audio';
import { InputManager, ScriptedSource, timeline, type InputTimeline } from '../../src/engine/input';
import type { SayOpts } from '../../src/engine/samples';
import { SoftRenderer } from '../../src/engine/render-soft';
import { MemoryStore } from '../../src/engine/storage';
import { terrain } from '../../src/engine/terrain';
import { createApp, newCampaign, type GameApp } from '../../src/game/app';
import type { MissionDef } from '../../src/game/mission/index';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { defineMission } from '../../src/game/registry';
import { GameplayScene, PauseScene, startNewGame, TitleScene } from '../../src/game/scenes/index';
import { BRIEFING_SPEAKER, defineMissionCard } from '../../src/game/scenes/flow-data';
import { briefingStarts, MissionIntroScene } from '../../src/game/scenes/mission-intro';
import { FLOOR } from './helpers';

const ID = 'scene-audio';
const t = terrain(1200, 216);
t.ground().at(0, FLOOR).flat(1200);
const MISSION: MissionDef = {
  id: ID,
  name: 'SCENE AUDIO',
  music: 'm1',
  start: 'a',
  sections: {
    a: {
      id: 'a',
      width: 1200,
      height: 216,
      scroll: 'right',
      background: { sky: 0x102030ff, layers: [] },
      terrain: t.build(),
      terrainStyle: { ground: 'dirt' },
      playerStart: { x: 40, y: FLOOR },
      ambience: 'env/test-ambience',
      script: function* idle() {
        for (;;) yield 1000;
      },
    },
  },
};
defineMission(MISSION);
const CARD = defineMissionCard({
  id: ID,
  label: 'MISSION 1',
  name: 'SCENE AUDIO',
  place: 'NOWHERE',
  briefing: ['FIRST LINE OF THE BRIEFING.', 'SECOND LINE. GO!'],
  headline: 'TESTED',
});

/** NullAudio plus the optional speech and loop members, recorded. */
class SceneAudio extends NullAudio implements AudioOut {
  readonly said: [string, string | undefined, SayOpts | undefined][] = [];
  readonly calls: string[] = [];
  busy = false;
  say(text: string, speaker?: string, o?: SayOpts): void {
    this.said.push([text, speaker, o]);
  }
  speaking(): boolean {
    return this.busy;
  }
  pauseLoops(): void {
    this.calls.push('pauseLoops');
  }
  resumeLoops(): void {
    this.calls.push('resumeLoops');
  }
}

function harness(tl: InputTimeline = timeline().idle(1)): { app: GameApp; audio: SceneAudio; step: (n: number) => void } {
  const input = new InputManager();
  input.addSource(new ScriptedSource(tl, 0));
  const audio = new SceneAudio();
  const app = createApp({ input, audio, store: new MemoryStore(), params: { ...DEFAULT_PARAMS } });
  const r = new SoftRenderer();
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
      r.begin();
      app.scenes.draw(r);
      r.end();
    }
  };
  return { app, audio, step };
}

describe('intro card: Gusto voices the briefing', () => {
  it('says each line as its typing starts, the next only once he has finished the one before', () => {
    const { app, audio, step } = harness();
    app.campaign = newCampaign();
    app.scenes.reset(new MissionIntroScene(app, ID));
    const starts = briefingStarts(CARD);
    expect(starts).toEqual([0, CARD.briefing[0].length]);
    // Typing starts after 24 ticks (2 characters per tick).
    step(20);
    expect(audio.said).toEqual([]);
    step(8);
    expect(audio.said).toEqual([[CARD.briefing[0], BRIEFING_SPEAKER, { important: true }]]);
    // The second line's typing has started, but the first line still plays: it waits.
    audio.busy = true;
    step(30);
    expect(audio.said).toHaveLength(1);
    audio.busy = false;
    step(1);
    expect(audio.said.map((s) => s[0])).toEqual([...CARD.briefing]);
    expect(audio.said[1][1]).toBe('gusto');
    step(60);
    expect(audio.said).toHaveLength(2);
    // say is no NullAudio log entry.
    expect(audio.log.some((e) => e.startsWith('say'))).toBe(false);
  });
});

describe('gameplay loops: silent under the pause menu, stopped when gameplay is left', () => {
  it('pause silences the loops, resume restores them; QUIT stops the ambience and restores the bus', () => {
    const { app, audio, step } = harness(timeline().idle(40).tap('start').idle(10).tap('start'));
    startNewGame(app, { mission: ID });
    step(45);
    expect(app.scenes.top).toBeInstanceOf(PauseScene);
    expect(audio.log).toContain('loop:ambience:env/test-ambience');
    expect(audio.calls).toEqual(['pauseLoops']);
    step(15);
    expect(app.scenes.top).toBeInstanceOf(GameplayScene);
    expect(audio.calls).toEqual(['pauseLoops', 'resumeLoops']);
    // Pause again and leave for the title (what QUIT TO TITLE does).
    app.scenes.push(new PauseScene(app, app.scenes.top as GameplayScene));
    step(2);
    expect(audio.calls.at(-1)).toBe('pauseLoops');
    expect(audio.log).not.toContain('stopLoop:ambience');
    app.scenes.reset(new TitleScene(app));
    step(2);
    expect(audio.log).toContain('stopLoop:ambience');
    expect(audio.calls.at(-1)).toBe('resumeLoops');
  });

  it('leaving gameplay without a pause stops the loops too (game over, mission end)', () => {
    const { app, audio, step } = harness();
    startNewGame(app, { mission: ID });
    step(40);
    expect(audio.log).toContain('loop:ambience:env/test-ambience');
    app.scenes.reset(new TitleScene(app));
    step(2);
    expect(audio.log).toContain('stopLoop:ambience');
    expect(audio.calls).toEqual([]);
  });
});
