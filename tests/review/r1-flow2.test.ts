/**
 * Review round 1 (part 2): app / mission flow. Regression tests: each asserts the correct
 * behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import type { World } from '../../src/engine/world';
import type { Boss } from '../../src/game/boss';
import { PauseScene } from '../../src/game/scenes/pause';
import { createHeadlessGame } from '../../src/sim/index';

describe('review r1: flow (2)', () => {
  // R1-21: GameplayScene.resume() (and PauseScene.enter()) call input.suppress(), which hides
  // EVERY held button until it is released — directions too. A player who keeps holding right
  // through pause → resume stands still until he lets go and presses right again.
  it('R1-21: a direction held through pause and resume keeps moving the player', async () => {
    let held: Button[] = [];
    const g = await createHeadlessGame({ missionId: 'm0', seed: 1, bot: false, god: true, input: () => held });
    try {
      g.step(5);
      held = ['right'];
      g.step(60);
      held = ['right', 'start'];
      g.step(1);
      held = ['right'];
      g.step(20);
      expect(g.app.scenes.top).toBeInstanceOf(PauseScene);
      held = ['right', 'start']; // RESUME
      g.step(1);
      held = ['right'];
      g.step(2);
      const x1 = g.player(0)!.x;
      g.step(60);
      expect(g.player(0)!.x - x1).toBeGreaterThan(60); // today: 0 px
    } finally {
      g.dispose();
    }
  });

  // R1-22: SectionContext.bossIntro() shows the WARNING banner and switches the music but never
  // pauses (or refills) the section timer. GDD 10.0 / 4.7: "The timer resets to 60 and is paused
  // during the intro".
  it('R1-22: the section timer is paused during the boss intro', async () => {
    const g = await createHeadlessGame({ missionId: 'm0', bossRush: true, seed: 1, bot: false, god: true });
    try {
      let checked = 0;
      let running = 0;
      for (let t = 0; t < 300; t++) {
        g.step(1);
        const boss = g.world!.byTag('boss')[0] as Boss | undefined;
        if (boss?.state === 'intro') {
          checked++;
          if (g.runner!.timerRunning) running++;
        }
      }
      expect(checked).toBeGreaterThan(30);
      expect(running).toBe(0); // today: the timer runs through the whole intro
    } finally {
      g.dispose();
    }
  });

  // R1-23: m0 places soldiers over pits. ctx.enter('rifleman', 'right') 50 ticks after
  // waitCamera(760) spawns at cam.right + 24 ≈ 1243 — inside the pit 1240–1296 — at the floorY()
  // fallback height (camera.bottom − 46); b1's ctx.enter('rifleman', 'top', { x: centerX + 150 })
  // drops at x ≈ 700 into the pit 666–714. Seen in every bot run (seeds 1–6, both routes).
  it('R1-23: every m0 rifleman spawns above a floor', async () => {
    const g = await createHeadlessGame({ missionId: 'm0', seed: 1, bot: { route: 'upper' }, god: true });
    try {
      const bad: string[] = [];
      let last: World | null = null;
      for (let t = 0; t < 12000 && !g.done; t++) {
        const w = g.world;
        if (w && w !== last) {
          last = w;
          const sec = g.runner?.section.id;
          w.events.on('spawn', (e: Entity) => {
            if (e.type !== 'rifleman') return;
            if (!Number.isFinite(w.terrain.surfaceY(e.x, e.y - 4, Infinity))) bad.push(`${sec}@${Math.round(e.x)}`);
          });
        }
        g.step(1);
      }
      expect(g.missionComplete).toBe(true);
      expect(bad).toEqual([]); // today: ['a@1243', 'b1@700']
    } finally {
      g.dispose();
    }
  });
});
