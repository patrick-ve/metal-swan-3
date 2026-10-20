/**
 * The play controls both play scenes share (GameplayScene and the ring's RingScene; GDD §4.9,
 * docs/design/ams-extras.md §10, docs/design/ring.md §9), extracted from gameplay.ts:
 *
 * - the lost-pad pause (`LostPadScene`): the pad of a player in play dropped out;
 * - joins and pad claims: player 2 joins a 1-player game at any time with START on a free pad or
 *   the keyboard key 2 (a credit; the next squad hero; the input switches to 2 players); in a
 *   2-player game START on a free pad takes a slot without a pad; START on a slot's own pad joins
 *   an empty slot or continues one that is out;
 * - the pause (`PauseScene`): Esc / P, START of a player in play, a lost window focus;
 * - the keyboard-split notice (P1 KEYS / P2 KEYS) and the P2 corner's PRESS START (`joinOpen`).
 *
 * The scene owns a `PlayControls` and calls, every tick: `trackDevice()` first, then (in play,
 * no scene change running) `interrupt()` — true when it pushed a scene (the tick ends there) —
 * then `watchKeySplit()`. Behaviour is exactly the former GameplayScene code
 * (tests/game/pads-scenes.test.ts).
 */
import type { Bindings } from '../../engine/input';
import { PAD } from '../../engine/pads';
import type { GameApp } from '../app';
import type { HudState } from '../context';
import { hasCharacter } from '../registry';
import type { GameSession, SlotIndex } from '../session';
import { keyName } from './controls';
import { ROSTER } from './flow-data';
import { LostPadScene, PauseScene, type PauseHost } from './pause';

/** The keyboard key that makes player 2 join a 1-player game (GDD §4.9; arcade style: 1 / 2 start). */
export const JOIN_KEY = 'Digit2';

/**
 * The character of a player who joins mid-game: the first roster Cygnet the other player is not
 * using (GDD §13.5: two players never share a character), else the other player's, else `recruit`.
 */
export function joinCharacter(other: string): string {
  for (const id of ROSTER) if (id !== other && hasCharacter(id)) return id;
  return other || 'recruit';
}

/** One 2-player key set in a line: `P1 KEYS: WASD F G H` (directions, fire, jump, bomb). */
export function keySetLine(b: Bindings, set: 'p1' | 'p2', who: string): string {
  const k = b[set];
  const n = (codes: readonly string[]): string => (codes.length ? keyName(codes[0]) : '-');
  const dirs = [n(k.up), n(k.left), n(k.down), n(k.right)];
  const arrows = dirs.join('') === '↑←↓→';
  const pad = dirs.every((d) => d.length === 1) ? dirs.join('') : dirs.join(' ');
  return `${who}: ${arrows ? 'ARROWS' : pad} ${n(k.fire)} ${n(k.jump)} ${n(k.bomb)}`;
}

/** What the play controls read from the running play (a MissionRunner or a RingRunner). */
export interface PlayHostRunner {
  readonly hud: HudState;
  readonly players: readonly { readonly index: number; readonly state: string }[];
  readonly continueTicks: readonly number[];
  player(slot: number): { readonly state: string } | undefined;
  continuePlayer(slot: SlotIndex): boolean;
  joinPlayer(slot: SlotIndex, character: string): unknown;
}

/** The scene that hosts the play controls. */
export interface PlayHost extends PauseHost {
  readonly app: GameApp;
  readonly session: GameSession;
  /** The attract demo: no joins, no pause, no split notice. */
  readonly demo: boolean;
  readonly runner: PlayHostRunner;
  /** A player joined: the scene's art preload follows the new hero (tier 4: the working set). */
  preloadArtNow(): void;
  /**
   * A cut scene owns the players' START (the ring's boarding: START skips it): a player's START
   * does not pause while this is true (Esc / P and a lost focus still do). Absent: never.
   */
  startReserved?(): boolean;
}

type Device = 'none' | 'keys' | 'pad';

export class PlayControls {
  private readonly host: PlayHost;
  /** The keyboard split last tick (null: not seen yet; the split notice shows on a change in play). */
  private splitSeen: boolean | null = null;
  /** The device of the last press in play (the menus' presses do not count), and before this tick. */
  private playDevice: Device = 'none';
  private deviceBefore: Device = 'none';

  constructor(host: PlayHost) {
    this.host = host;
  }

  /** Each tick first: the device of the last press in play, before this tick's presses (the join rule asks it). */
  trackDevice(): void {
    this.deviceBefore = this.playDevice;
    const raw = this.host.app.input.rawPressed;
    if (raw.length > 0) this.playDevice = raw[raw.length - 1].startsWith('Gamepad') ? 'pad' : 'keys';
  }

  /**
   * In play (the runner plays, no scene change running): the lost-pad pause, then joins and pad
   * claims, then the pause. Returns true when it pushed a scene (the tick ends there).
   */
  interrupt(): boolean {
    const host = this.host;
    const app = host.app;
    const input = app.input;
    // The pad of a player in play dropped out: the lost-pad pause.
    const lost = this.lostSlot();
    if (lost >= 0) {
      app.scenes.push(new LostPadScene(app, host, lost as 0 | 1));
      return true;
    }
    // Joins first: the START that joins (or claims a pad) never pauses.
    const join = this.handleJoin();
    // Pause: Esc / P, start on the pad of a player who is in the game, or a lost window focus.
    let pause = input.pausePressed || app.focusLost || join === 'pause';
    app.focusLost = false;
    if (join === 'none' && !host.startReserved?.()) for (const p of host.runner.players) if (p.state !== 'out' && input.pad(p.index as SlotIndex).pressed('start')) pause = true;
    if (pause) {
      app.scenes.push(new PauseScene(app, host));
      return true;
    }
    return false;
  }

  /** A slot whose player is in play and whose pad dropped out (−1: none). */
  private lostSlot(): number {
    const input = this.host.app.input;
    for (let i = 0; i < 2; i++) {
      const s = i as 0 | 1;
      if (!input.padLost(s)) continue;
      const p = this.host.runner.player(s);
      if (p && p.state !== 'out') return i;
    }
    return -1;
  }

  /**
   * Joins and pad claims (GDD §4.9, docs/design/ams-extras.md §10). Returns 'join' when a START
   * was used for them (it does not pause), 'pause' when a free pad's START is player 1's pause
   * after all (no join possible and player 1 has no pad: the pad becomes player 1's), else 'none'.
   *
   * - 1 player: START on a free pad (any pad but player 1's) or the keyboard key 2 (or player 2's
   *   own START keys outside the solo set) makes player 2 join.
   * - 2 players: START on a free pad takes the first slot without a pad (and joins it when it is
   *   empty); START on a slot's own pad (or keys) joins an empty slot or continues one that is out.
   */
  private handleJoin(): 'join' | 'pause' | 'none' {
    const host = this.host;
    const input = host.app.input;
    const s = host.session;
    const gp = input.freePadPressed(PAD.start);
    if (input.players === 1) {
      if (gp >= 0) {
        // Player 1 has no pad yet and the keyboard does not drive him (a direct start, the first
        // press in play): the pad is player 1's own, and its START his pause.
        if (this.padIsP1s()) {
          input.claimPad(0, gp);
          return 'pause';
        }
        if (this.joinSecond(gp)) return 'join';
        if (!input.slotHasPad(0) && !input.padLost(0)) {
          input.claimPad(0, gp);
          return 'pause';
        }
        return 'join';
      }
      return this.keyboardJoinPressed() && this.joinSecond(-1) ? 'join' : 'none';
    }
    let used: 'join' | 'none' = 'none';
    if (gp >= 0) {
      const slot: SlotIndex | null = !input.slotHasPad(0) ? 0 : !input.slotHasPad(1) ? 1 : null;
      if (slot !== null) {
        input.claimPad(slot, gp);
        if (!s.slots[slot].joined) this.joinSlot(slot);
        used = 'join';
      }
    }
    for (let i = 0; i < 2; i++) {
      const slot = s.slots[i];
      const pad = input.pad(i as 0 | 1);
      if (!pad.pressed('start')) continue;
      if (!slot.joined) {
        if (this.joinSlot(i as SlotIndex)) used = 'join';
      } else if (slot.gameOver && host.runner.continueTicks[i] < 0) {
        if (host.runner.continuePlayer(i as SlotIndex)) host.app.audio.sfx('ui/confirm');
        used = 'join';
      }
    }
    return used;
  }

  /**
   * 1 player, no pad on slot 0 (none claimed, none lost) and no key pressed in play before this
   * tick (the keyboard does not drive player 1): every pad drives player 1, so a pad's START is his
   * (it claims slot 0), never player 2's join.
   */
  private padIsP1s(): boolean {
    const input = this.host.app.input;
    return input.players === 1 && !input.slotHasPad(0) && !input.padLost(0) && this.deviceBefore !== 'keys';
  }

  /** The P2 HUD corner's PRESS START: a free pad that would join player 2 (never player 1's own). */
  joinOpen(): boolean {
    const input = this.host.app.input;
    return !this.host.demo && input.players === 1 && input.freePads() > 0 && !this.padIsP1s();
  }

  /**
   * The keyboard split into the 2-player key sets in mid-play (player 2 joined on the keyboard, or
   * took the keyboard after a lost pad): a notice with both sets, so player 1 knows his new keys.
   */
  watchKeySplit(): void {
    const host = this.host;
    const split = host.app.input.keySplit;
    if (split && this.splitSeen === false && !host.demo) {
      const b = host.app.input.bindings;
      host.runner.hud.callout(keySetLine(b, 'p1', 'P1 KEYS'), { ticks: 300 });
      host.runner.hud.callout(keySetLine(b, 'p2', 'P2 KEYS'), { ticks: 300 });
    }
    this.splitSeen = split;
  }

  /** An empty slot joins (a credit when credits are limited): the next squad hero, near the others. */
  private joinSlot(i: SlotIndex): boolean {
    const host = this.host;
    const s = host.session;
    if (s.slots[i].joined || !s.payCredit()) return false;
    host.runner.joinPlayer(i, joinCharacter(s.slots[1 - i].character));
    host.app.audio.sfx('ui/coin');
    // Tier 4: the working set follows the new hero and the second player.
    host.preloadArtNow();
    return true;
  }

  /**
   * Player 2 joins a 1-player game: with pad `gp` (−1: on the keyboard). The input switches to 2
   * players (a pad join keeps the keyboard whole for player 1; a keyboard join splits it into the
   * 2-player key sets), then the slot joins (credit, hero, HUD, the tier-4 working set).
   */
  private joinSecond(gp: number): boolean {
    const s = this.host.session;
    const input = this.host.app.input;
    if (s.slots[1].joined || !s.canPay) return false;
    input.players = 2;
    if (gp >= 0) {
      input.keySplit = false;
      input.claimPad(1, gp);
    }
    return this.joinSlot(1);
  }

  /** Player 2's keyboard START in a 1-player game: the key 2, or a 2-player START key the solo set does not use. */
  private keyboardJoinPressed(): boolean {
    const input = this.host.app.input;
    if (input.keyPressed(JOIN_KEY)) return true;
    const b = input.bindings;
    for (const code of b.p2.start) if (!b.solo.start.includes(code) && input.keyPressed(code)) return true;
    return false;
  }
}
