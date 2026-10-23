/**
 * The results (FIELD, wave B; docs/design/rally.md §7.6): a HUD part (`defineRallyHud` 'results')
 * that draws UITSLAG over the whole frame once the race is over (phases 'finish' and 'done') while the
 * camera circles the player's estate (the runner's orbit): all eight cars by place with their team
 * names (the players in their colours), the race time (a projected time in grey with a star), the
 * best lap and the fines (RULES counts them in `CarState.fines`; the euros from the score book).
 * Dutch labels; the game's font; readable at 1×. Cosmetic.
 */
import type { Renderer } from '../../../../engine/render';
import { PLAYER_COLORS, uiText, UI_GOLD, UI_GREY, UI_WHITE, centerText } from '../../../app';
import type { CarState } from '../../../rally/api';
import type { RallyHudPart } from '../../../rally/registry';
import type { RallyRunner } from '../../../rally/runner';
import { bestLapTicks, eurosText, raceClock } from '../../../rally/score';

/** The panel's columns (logical px of the 384 × 216 frame). */
export const RESULT_COLS = { x0: 26, place: 40, team: 48, time: 222, best: 274, fines: 358 } as const;
const ROW = 10;
const REBUILD = 15;
const PANEL = { screen: true, alpha: 0.78 } as const;

/** One result row's texts (pure: the tests read them). */
export interface ResultRow {
  readonly place: string;
  readonly team: string;
  readonly time: string;
  readonly best: string;
  readonly fines: string;
  readonly slot: number;
  readonly projected: boolean;
}

/** The rows of the results, by place. */
export function resultRows(runner: RallyRunner): ResultRow[] {
  return runner.race.order.map((c: CarState) => {
    const best = bestLapTicks(c);
    const euros = runner.book.peek(c.id)?.finesEuros ?? 0;
    return {
      place: `${c.place}`,
      team: c.slot >= 0 ? `P${c.slot === 1 ? 2 : 1} ${c.team}` : c.team,
      time: c.finishTicks >= 0 ? `${raceClock(c.finishTicks)}${c.projected ? '*' : ''}` : '-',
      best: best >= 0 ? raceClock(best) : '-',
      fines: c.fines > 0 ? `${c.fines}X EUR ${eurosText(euros)}` : '-',
      slot: c.slot,
      projected: c.projected,
    };
  });
}

/** The results part: drawn over the frame once the race is over. */
export function createResults(runner: RallyRunner): RallyHudPart {
  // The rows change slowly (a projected time, a finish): rebuilt every `REBUILD` race ticks, not per frame.
  let rows: ResultRow[] = [];
  let at = -Infinity;
  return {
    draw() {},
    drawFrame(r: Renderer) {
      if (runner.phase !== 'finish' && runner.phase !== 'done') return;
      if (runner.race.tick - at >= REBUILD || rows.length !== runner.race.order.length) {
        rows = resultRows(runner);
        at = runner.race.tick;
      }
      const C = RESULT_COLS;
      const top = Math.max(14, 108 - ((rows.length * ROW + 34) >> 1));
      r.rect(C.x0 - 6, top - 4, 384 - 2 * (C.x0 - 6), rows.length * ROW + 34, 0x05060aff, PANEL);
      centerText(r, 'UITSLAG', top, UI_GOLD, 'big');
      const hy = top + 15;
      uiText(r, 'POS', C.place, hy, UI_GREY, 'right');
      uiText(r, 'TEAM', C.team, hy, UI_GREY);
      uiText(r, 'TIJD', C.time, hy, UI_GREY, 'right');
      uiText(r, 'BESTE', C.best, hy, UI_GREY, 'right');
      uiText(r, 'BOETES', C.fines, hy, UI_GREY, 'right');
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const y = hy + 11 + i * ROW;
        const col = row.slot >= 0 ? PLAYER_COLORS[row.slot === 1 ? 1 : 0] : row.projected ? UI_GREY : UI_WHITE;
        uiText(r, row.place, C.place, y, col, 'right');
        uiText(r, row.team, C.team, y, col);
        uiText(r, row.time, C.time, y, col, 'right');
        uiText(r, row.best, C.best, y, row.slot >= 0 ? col : UI_GREY, 'right');
        uiText(r, row.fines, C.fines, y, row.fines === '-' ? UI_GREY : UI_WHITE, 'right');
      }
    },
  };
}
