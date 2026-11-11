# The brainstorm — from an idea to an approved level card

Phase 1 of `docs/LEVEL_GUIDE.md`. You and the user decide what the level IS before anyone writes a spec or
paints a pixel. A new level can be anything: another city, a village, a ship, an interior, a night, a storm, a
dream. Nothing of level 1 is a default. The user wants this done **meticulously**: every branch below gets an
answer from the user or is written down as open. You propose, the user picks.

Earlier brainstorms of this project, for tone and depth: `docs/design/amsterdam-2/brainstorm.md` and
`level-2.md` (eight proposal rounds, every user choice marked *(user)*), `docs/design/proposals/`.

## How to ask

- **Grill, one branch at a time.** Walk the branches in order: a later branch depends on the earlier ones. One
  `AskUserQuestion` call per branch, one to four questions in it. Wait for the answers before the next branch.
- **Offer, never interview blank.** Each question has two to four concrete options that differ in kind, not in
  degree. Each option says what the player sees and does, and what it costs (new art, new code, more agents).
  Put the one you recommend first and say why in its description. The user can always type something else.
- **Each question stands alone.** The user may see only the dialog. Name the level, the section and the thing you
  ask about inside the question.
- **Show, when words are not enough.** For a place, an hour or an atmosphere, put the choices in front of the
  user's eyes: existing frames (`docs/design/canal-look/ref/`, game shots with `npm run shot`), or quick tier-1
  thumbnails from the kit on a private artifact page (Phase 2 makes the real look sample; a thumbnail here is a
  sketch and says so).
- **Follow the answer.** An answer that opens a new question gets that question next, before you move on. An
  answer that contradicts an earlier one: say so and ask which one holds.
- **Write it down at once.** After every round, add the answers to the decisions table of the level card (below)
  with the user's own words in quotes. A choice you make yourself is marked `lead` and is listed for the user at
  the stop. A point without an answer is `open`: you never fill it in silently.
- **Stay inside the fence.** Before you offer an option, check it against `docs/ORIGINALITY.md` (no look-alike of
  an existing game's level, boss, character, name or set piece; real people and brands only as that file allows)
  and against what the game already has (`docs/GAME_DESIGN.md` §11 and §18–§20, the specs in `docs/design/`), so
  you do not offer a level that exists.

## Before the first question

Read: `docs/GAME_DESIGN.md` §1 (what the game is), §2 (story so far), the list of missions and their order; the
auto-memory index (levels in progress, the user's standing likes and rules); the user's own words for this level,
if they gave any. Then say in three lines what you understood and which branches are already answered.

## The branches

Each branch ends when its line of the level card is filled and marked.

1. **Direction.** The pitch in one sentence: where are we, what happens, why is it fun or funny. If the user has
   no idea yet, offer three or four pitches that differ radically (place, tone, the joke). If they have one,
   sharpen it: what is the one picture a player remembers afterwards?
   Ask also: where does it sit in the campaign (which level number, what comes before and after), is it a
   replacement, a new mission or a test level beside an old one.
2. **Tone and target.** What does the level laugh at, and how hard? What is the mood under the joke (sunny,
   eerie, hectic, melancholy)? Language of bubbles and signs. What must never be in it (the user's own limits,
   people, brands, sensitive subjects). Each "never" becomes a gate later.
3. **The player's new thing.** One twist that this level has and no other: a mechanic, a vehicle, a rule, a
   set-piece fight. What stays as it is (the heroes, the weapons, the budget, the Swan). Say what each twist
   costs in engine work.
4. **The journey.** The route from the first screen to the last: three to six sections, each with a name, a
   place, an hour, and the reason the player moves on. Where the route splits, if it does. Where the level ends
   and what the last picture is. Length: minutes of play, compared with level 1.
5. **The scene, per section.** This is the branch the user cares most about. For each section: the place the
   player must recognise; the hour, the weather and the season; the key colour of the light; the one set piece;
   what the ground is (street, quay, sand, deck, floor) and what lies beside it (water, a wall, a drop, a
   field); what stands far away; five or more things that belong only there; what moves. For a place the game
   has never drawn: the building grammar (what a front, a roof, a door looks like there), the materials, the
   street furniture, the plants, the vehicles. Ask for photos or links if the user has a real place in mind
   (photos are for likeness only: never traced, never shipped).
6. **The cast.** Enemies: which existing ones return, which are new (each new one is an art job of its own),
   what each one does to the player. Locals, hostages, gags in windows and on the street. A mini-boss, a boss:
   what it is, how the fight reads, how it ends. Names.
7. **Sound.** The music of each part (mood, tempo, instruments), the voices, the announcer lines, the one sound
   the place must have. Generated audio or the synth, and the budget for it.
8. **Scope and the way of working.** How big (sections, new enemies, new mechanics) against how many agents and
   tokens the user wants to spend. Which stops the user wants to see (the guide has four; more is fine). How the
   user wants to review: a private page, the running game, both. Deadlines, if any.

## The level card

Write it as the top of `docs/design/<id>/brainstorm.md` while you go (create the folder at the first answer;
`<id>` is a short lower-case mission id the user agrees to).

```
# <LEVEL NAME> — level card (brainstorm, <date>)

Pitch:        <one sentence>
The picture:  <the one image a player remembers>
Place in the campaign: <level number, before / after, new | replaces | test level>
Tone:         <what it laughs at, the mood, the language>
Never:        <each limit the user gave>
The new thing: <the twist> — stays: <what does not change>
Journey:      <section 1 name, place, hour> → <section 2> → … → <the ending>; <minutes>
Scenes:       one block per section:
                place / hour, weather, season / key colour / set piece / ground and what lies beside it /
                far side / five local things / what moves / building grammar and materials (new places)
Cast:         <returning enemies> · <new enemies, one line each> · <locals, gags> · <mini-boss> · <boss>
Sound:        <music per part> · <voices> · <the sound of the place>
Scope:        <sections, new enemies, new mechanics> · <agents and review stops the user wants>

## Decisions
| # | Decision | The user's words | By | Date |
|---|---|---|---|---|

## Open
- <every point without an answer>
```

## Done when

1. Every line of the card is filled. Every decision row is marked `user` or `lead`. The Open list is empty, or
   the user said which open points may wait and until which stop.
2. You read the whole card back to the user in the chat (short, in their writing style) with the `lead` choices
   listed apart, and the user said in their own words that this is the level. A silence, a "looks fine so far"
   in the middle of a round, or your own summary is not that approval.
3. The card is saved, and one line in the auto-memory index points to it.

Then stop asking and go to Phase 2. New ideas that come later go through the user as a change to the card.
