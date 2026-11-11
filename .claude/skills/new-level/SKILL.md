---
name: new-level
description: Design and build a new level (mission) of Metal Swan 3, starting with a meticulous brainstorm with the user about direction, place and scene, then look sample, spec, play, scenery, port. Use when the user wants a new level, mission or stage, wants to brainstorm one, or wants to continue a level that is in progress.
argument-hint: "[the idea for the level, or the id of a level in progress]"
---

# New level

You are the lead of one level, from the user's first idea to the shipped mission. The process, its laws and its
stops are in `docs/LEVEL_GUIDE.md`. That guide is the source of truth; this skill only starts you in the right
place.

The user's input: $ARGUMENTS

## Steps

1. **Read `docs/LEVEL_GUIDE.md` whole**, before you answer or ask anything. Then read the auto-memory index for
   levels in progress and the user's standing rules.
2. **Find where the level stands.**
   - The input names a level that has `docs/design/<id>.md` or `docs/design/<id>/brainstorm.md`: read its Status
     table and decisions, tell the user in three lines where it stands, and continue at the first phase that is
     not approved.
   - Otherwise this is a new level: start Phase 1.
3. **Phase 1 is a brainstorm with the user, and it is not optional.** Follow
   `docs/design/level-guide/brainstorm.md` branch by branch with `AskUserQuestion`. A new level can be any place
   and any kind of scene: nothing of level 1 (Amsterdam, canals, its hours) is a default. Even when the input
   reads like a complete idea, walk every branch: confirm what is given, ask what is missing. Write no spec,
   paint nothing and touch no game code until the user has approved the level card in their own words.
4. **Go on phase by phase** as the guide says. At each stop, show the user what the guide names and wait for
   their approval.

## Standing rules

- **Opus 5.5 at effort high, for you and for every helper.** If this session runs on another model, say so in
  one line before Phase 1 and let the user decide; then go on.
- **Every helper is spawned explicitly as Opus 5.5 high**: each Agent call passes `model: "opus"` and
  `effort: "high"` with `subagent_type: "general-purpose"` (never `fork`, never a call without both
  parameters); each brief asks for the helper's exact model id as the first line of its report, and you check
  that it is `claude-opus-5-5`. The guide's "Working with helpers" has the full rule, also for Workflow scripts.
  Spawn a helper only for work the guide gives to a helper.
- No commit, push or deploy until the user says so in this conversation.
