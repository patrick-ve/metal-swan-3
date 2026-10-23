/**
 * The grid order (FIELD, wave B; docs/design/rally.md §2, §10; docs/api/rally.md "B.F"): where the
 * player estates stand among the rivals. 1P starts 6th of 8; 2P the two estates start 5th and 6th
 * (P1 ahead); `RallyOpts.gridBack` (the sims' overtaking gate) puts them behind every rival. The
 * runner builds `cars` in this order (cars[i] stands on `track.grid[i]`). Pure.
 */

/** The grid index (0 = pole) of each player estate by the number of players. */
export const PLAYER_GRID: Readonly<Record<1 | 2, readonly number[]>> = { 1: [5], 2: [4, 5] };

/**
 * The grid as a list of kinds: 'p' = the next player estate (P1 first), 'r' = the next rival (in the
 * teams' grid order). `players` 1 or 2, `rivals` the rivals of the race.
 */
export function gridPlan(players: number, rivals: number, gridBack = false): ('p' | 'r')[] {
  const out: ('p' | 'r')[] = [];
  if (gridBack) {
    for (let i = 0; i < rivals; i++) out.push('r');
    for (let i = 0; i < players; i++) out.push('p');
    return out;
  }
  const want = PLAYER_GRID[players > 1 ? 2 : 1];
  const n = players + rivals;
  let p = 0;
  for (let g = 0; g < n; g++) {
    // A player estate on its grid slot (or at the back when the field is short), else a rival.
    const rivalsLeft = rivals - (g - p);
    if (p < players && (g >= want[p] || rivalsLeft <= 0)) {
      out.push('p');
      p++;
    } else out.push('r');
  }
  return out;
}
