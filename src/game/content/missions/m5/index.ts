/**
 * Mission m5 — SWAN SONG (GDD §11.5), the final mission. The sky above the clouds from dusk to
 * night, then the inside of the flying Grand Organ:
 *
 * - `a` Above the Clouds (shoot-em-up in the Trumpeters, auto-scroll 1.0) → final boss stage 1
 *   THE GRAND ORGAN → the landing hatch
 * - `b` The Pipe Works (vertical, scroll down) → the brass door
 * - `c` The Console: final boss stages 2 THE CONSOLE and 3 THE MAESTRO → the ending
 *
 * The three boss stages (`grand-organ`, `organ-console`, `maestro`, prop `wreck-block`) are built
 * in bosses/m5. Files: `bg.ts` (custom generators organ-deep, organ-pipes, console-room),
 * `backgrounds.ts` (the layer stacks), `art.ts` (decor), `entities.ts` (organ-distant, m5-dusk,
 * m5-door, m5-console-tier), `finale.ts` (m5-gramps-ship + the auto-run), `helpers.ts`, `section-*.ts`.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './bg';
import './art';
import './entities';
import './finale';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';

export const M5: MissionDef = {
  id: 'm5',
  name: 'SWAN SONG',
  subtitle: 'FINAL MISSION',
  music: 'm5-sky',
  bossMusic: 'boss-final',
  start: 'a',
  bossSection: 'c',
  // BOSS SPEED BONUS: stage 1 (a) and stages 2 + 3 (c) add up; the walk through b does not.
  bossSections: ['a', 'c'],
  startBanner: { text: 'FINAL MISSION', sub: 'START!' },
  announce: 'FINAL MISSION. FLY GRACEFULLY, CYGNETS!',
  sections: { a: sectionA, b: sectionB, c: sectionC },
  // GDD §11.5: 6 (a 2 on balloons, b 4 incl. the composer).
  hostages: { a: 2, b: 4, c: 0 },
};

defineMission(M5);
