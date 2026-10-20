# Input API — keyboard, gamepads (2 players, Bluetooth), touch, scripted

Owner: input (wave "ams extras", 2026-10-20; spec: [`docs/design/ams-extras.md`](../design/ams-extras.md) §10).
Source: `src/engine/input.ts` (buttons, `VirtualPad`, bindings, `InputManager`, `ScriptedSource`),
`src/engine/pads.ts` (pure gamepad logic: identity, profiles, labels, slots, rumble),
`src/engine/input.browser.ts` (`KeyboardSource`, `GamepadSource`, `TouchSource`),
`src/engine/input-actions.ts` (the first-person actions, docs/api/fps.md).
Game side: `src/game/scenes/pad-prompt.ts` (labels in menus), `src/game/scenes/rumble.ts`,
`src/game/content/ui/pad.art.ts` (glyphs). Tests: `tests/engine/input.test.ts`,
`tests/engine/pads.test.ts`, `tests/game/pads-scenes.test.ts`, `tests/media/pads-browser.test.ts`.

Everything but `*.browser.ts` is pure TS and runs headless. The headless sims have no pads: none
of this changes a sim.

## 1. Boot (main.ts)

```ts
const input = new InputManager(parseBindings(store.get('bindings')));
input.addSource(new KeyboardSource(window, { isBound: (c) => input.isBound(c) }));
input.useGamepads(new GamepadSource());          // registers the one PadSource (input.gamepads)
// every tick: input.update(); then input.pad(0).pressed('jump') …
```

`GamepadSource` is `PadSource` (pads.ts) polling `navigator.getGamepads()` once per tick (hot-plug
works), plus a console line per connect / disconnect. Tests build `new PadSource(() => fakePads)`
with plain objects (`GamepadLike`: `id`, `index`, `connected`, `mapping`, `buttons[{pressed,
value}]`, `axes`, optional `vibrationActuator` / `hapticActuators`).

## 2. Standard indices and the positional default

After the profile step (§3) every pad is read in the W3C standard layout, **by position**
(`PAD` in pads.ts):

| index | button | PlayStation | Xbox | Nintendo (Switch Pro, 8BitDo) | generic |
|---|---|---|---|---|---|
| 0 `south` | jump, menu OK | ✕ (glyph) | A | B | position glyph |
| 1 `east` | bomb, menu back | ○ (glyph) | B | A | position glyph |
| 2 `west` | fire, menu OK | □ (glyph) | X | Y | position glyph |
| 3 `north` | — | △ (glyph) | Y | X | position glyph |
| 4 / 5 / 6 / 7 | (fps: 7 fires, 5 / 4 weapons) | L1 R1 L2 R2 | LB RB LT RT | L R ZL ZR | L1 R1 L2 R2 |
| 8 `select` | pause | SHARE / CREATE | VIEW | − | SELECT |
| 9 `start` | start: pause, join, claim | OPTIONS | MENU | + | START |
| 10 / 11 | (fps: 10 runs) | L3 R3 | LS RS | LS RS | L3 R3 |
| 12–15 | D-pad up / down / left / right | ↑ ↓ ← → | | | |
| 16 / 17 | — | PS / PAD | XBOX / SHARE | HOME / CAPTURE | HOME |

The gameplay buttons sit in the same physical place on every pad (south jump, west fire, east
bomb, START start; the D-pad and the left stick move); only the labels differ. Raw codes for
menus and rebinding are `GamepadB<standard index>` (`padButtonCode`).

## 3. Identity, families, profiles (pads.ts)

- `parsePadId(id)` → `{ vendor, product, name }` from the Chrome format
  (`DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)`), the Firefox /
  Safari format (`054c-0ce6-Name`, also without leading zeros: `54c-ce6-Name`) or a plain name
  (Safari's GameController pads, XInput pads in Chrome on Windows): ids null.
- `padInfo(id, mapping)` → `PadInfo` (cached): `family` ('playstation' | 'xbox' | 'nintendo' |
  'generic'; the name first — `dualsense`, `dualshock`, `xbox`, `xinput`, `pro controller`,
  `joy-con`, `8bitdo` … — then the vendor: Sony 054c, Microsoft 045e, Nintendo 057e, 8BitDo 2dc8,
  Logitech 046d, PDP 0e6f, PowerA 24c6), `model` ('DUALSENSE', 'DUALSHOCK 4', 'XBOX', 'SWITCH PRO',
  'JOY-CON', '8BITDO', 'GAMEPAD'), `standard`, `create` (a DualSense: select says CREATE),
  `profile`.
- **Profiles** apply only when `mapping !== 'standard'` (`PAD_PROFILES`; raw button per standard
  index): `ps-hid` (Square 0, Cross 1, Circle 2, Triangle 3, …, PS 12, touchpad 13),
  `xbox-hid` (A 0, B 1, X 3, Y 4, LB 6, RB 7, View 10, Menu 11, Guide 12, LS 13, RS 14),
  `switch-hid` (by position, identity), `8bitdo-dinput` (A 0, B 1, X 3, Y 4, L 6, R 7, L2 8, R2 9,
  Select 10, Start 11, Home 12, LS 13, RS 14), `generic` (identity). These are the usual HID
  orders (SDL controller database); Chrome and Safari give the standard mapping for these pads on
  macOS and Firefox remaps most of them itself, so the profiles are a fallback. `switch-hid` and
  `xbox-hid` are **unverified** with real pads; CONTROLS rebinds whatever a profile gets wrong.
- **Hat D-pad**: on a non-standard pad an axis (index ≥ 2) that ever reads > 1.1 is its hat
  switch (it rests at 9/7); `hatBits(v)` turns its 8 directions (−1 up … in steps of 2/7 … 1
  up-left) into the D-pad buttons 12–15. A hat is only read after it was seen at rest, so a stick
  or trigger never becomes a D-pad.
- `padLabel(family, index, create?)` → `PadLabel { text, glyph?: 'ps' | 'pos', frame? }`.

## 4. Player slots (PadSource, InputManager)

A slot **claims** a pad (`input.claimPad(slot, padIndex)`): it remembers the pad's `id` and index.
The buttons the pad holds at that moment are hidden from the slot until released (the START that
claimed does not also pause or confirm).

- **Sticky.** A claimed pad that disconnects leaves the claim `lost` (`input.padLost(slot)`). The
  same pad (same id; the same index first, else any index the other slot does not hold) takes the
  claim back by itself: a reconnect never swaps the players. Two pads with the SAME id (two
  DualSense) cannot be told apart by the Gamepad API: if both drop out, the one back first at
  player 1's old index becomes player 1's.
- **1 player** (`input.players === 1`): every connected pad drives player 1, through `bindings.pad`.
  The first pad that presses anything but START while player 1 has no claim becomes player 1's
  (a direct `?mission=` start); the title and the mode select claim player 1 for the pad that
  confirms. With `input.joinWatch` (GameplayScene sets it while a game plays) the START of every
  pad that is not player 1's is held back from slot 0: it asks to join (§5).
- **2 players**: slot 0 is driven by its claimed pad through `bindings.pad` (P1 PAD), slot 1 by its
  claimed pad through `bindings.pad2` (P2 PAD). A pad without a claim drives nobody in play (a
  third pad), but its presses still reach the menus as raw codes; with `input.menuPads` (PauseScene
  sets it while it is open, OPTIONS and CONTROLS on top included) it drives slot 0 too, so any pad
  navigates the pause menus.
- **Keyboard.** `input.keySplit` (set to `players === 2` whenever `players` is set): split = the
  2-player key sets P1 WASD + F / G / H + 1, P2 arrows + , . / + Enter; not split = the solo set
  drives player 1 (a player 2 who joined with a pad leaves the keyboard whole).
  `keySetFor(slot, players, split?)`.
- Helpers (all answer "no pad" without a PadSource): `slotPad(slot)` (`PadInfo` of the claim,
  live or lost), `slotHasPad(slot)` (live), `padLost(slot)`, `freePads()` (connected pads that are
  free: 1 player — not player 1's; 2 players — nobody's), `freePadPressed(b0, b1?, b2?)` and
  `padPressed(b0, b1?, b2?)` (the pad index that pressed one of these up to 3 standard buttons
  this tick, −1; fixed arity: no allocation per tick),
  `releasePad(slot)`, `lastDevice` ('none' | 'keys' | 'pad'), `lastPadInfo()`.

## 5. Scenes (game side)

- **Title / mode select**: the pad whose START (south, west) leaves the screen claims player 1. The
  title names the connected pads (`DUALSENSE + XBOX READY`, y 194).
- **Character select (2 players)**: START or the south button on a free pad claims the first
  player without a pad; each pad drives its own cursor; a player without a pad blinks
  `PRESS START` in the bottom row while a free pad is connected.
- **Join at any time** (GameplayScene, GDD §4.9): in a 1-player game START on a free pad, or the
  keyboard key 2 (`JOIN_KEY`; or a 2-player START key the solo set does not use), makes player 2
  join: a credit (free on FREE PLAY; `session.payCredit()`), the next squad hero not in use
  (`joinCharacter`), `input.players = 2` (a pad join keeps the keyboard whole), the HUD panel, the
  tier-4 working set (`preloadMissionArt`, two players). The P2 corner blinks `PRESS START`
  while a free pad is connected (`HudInput.joinOpen`). No credits: nothing happens (a pad with no
  owner while player 1 has no pad becomes player 1's and pauses). While player 1 has no pad (none
  claimed, none lost) and no key was pressed in play before this tick (`padIsP1s`: the keyboard
  does not drive him), a pad's START is player 1's own: it claims slot 0 and pauses (no join, no
  credit), and that pad gets no `PRESS START` invitation. When the keyboard splits in mid-play (a
  keyboard join, or the lost-pad keyboard resume of player 2), two callouts show both key sets
  for 300 ticks (`keySetLine`: `P1 KEYS: WASD F G H`, `P2 KEYS: ARROWS , . /`). In a 2-player
  game START on a free pad takes the first slot without a pad (and joins it when it is empty).
- **Lost pad** (`LostPadScene`, pause.ts; GameplayScene and FpsScene): the pad of a player in
  play drops out → `CONTROLLER 2 LOST` / `RECONNECT OR PRESS START` / the model. Resume: the same
  pad back, START on a free pad (it takes the slot), or a keyboard START / pause key (the slot
  forgets its pad; for player 2 the keyboard splits).
- **Labels** (`pad-prompt.ts`): `drawHelpLine(r, input, keysText, padText, y, color)` shows the
  pad text with the labels of the pad used last (the keyboard text after a key);
  `drawPadLine(r, text, x, y, info, map, color, align)` expands `{FIRE}` `{JUMP}` `{BOMB}`
  `{START}` `{OK}` `{BACK}` `{PAUSE}` into labels (glyph sprites `ui/pad-ps`, `ui/pad-pos` at the
  screen tier; Xbox A B X Y in their button colours). Used by the mode select, CONTROLS (P1 PAD /
  P2 PAD rows with each player's own pad and model), the pause help line; `HOW_TO_PLAY_PAD`
  (flow-data.ts) is the pad version of the HOW TO PLAY card.
- **CONTROLS**: rows `1 PLAYER`, `2 PLAYERS - 1P`, `2 PLAYERS - 2P`, `P1 PAD`, `P2 PAD`; a pad row
  rebinds FIRE, JUMP, BOMB, START of that player's pad map (`bindPad(b, button, index, slot)`),
  saved with the bindings (`pad2` added 2026-10-20; an older save copies `pad`).
- **Rumble** (rumble.ts, OPTIONS `RUMBLE` ON / OFF, default ON): `input.rumble(slot, strong, weak,
  ms)` on the slot's pad (1 player without a claim: the pad used last); a weaker effect does not
  cut a stronger one short. `RumbleWatch`: the player's death (0.6 / 0.45, 260 ms), a size l / xl
  explosion within its radius + 40 px (0.45 / 0.55, 180 ms), a boss part break (every player in
  play, 0.55 / 0.35, 220 ms), a hit on the player's vehicle (0.25 / 0.45, 110 ms).
  `playRumble(gp, …)`: `vibrationActuator.playEffect('dual-rumble')`, else
  `hapticActuators[0].pulse`; feature-detected, never throws (a rejected promise is caught).

## 6. Browser notes and limits (to verify with real pads)

- Chrome / Edge are expected to give the standard mapping for DualShock 4, DualSense, Xbox and
  Switch Pro pads and to rumble through `vibrationActuator`. Safari (macOS) reads pads through
  GameController.framework: standard mapping, the id is the plain product name (no vendor ids: the
  family comes from the name); rumble only where Safari exposes `vibrationActuator`. Firefox may
  report some pads as non-standard (profiles and the hat D-pad then apply) and mostly has no
  rumble. Where rumble is missing nothing happens.
- Browsers expose a pad only after a button press on it while the page has focus.
- Joy-Cons: a single Joy-Con held sideways is a non-standard pad with few buttons; the pair
  (`Joy-Con (L/R)`) is one standard pad.
- The report of this wave (tmp/extras-pads-report.md) lists the checks for real pads.
