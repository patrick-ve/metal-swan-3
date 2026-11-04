# REPORT FOR DUTY at 40 px: the select screen redesign

Status: kicked off 2026-11-03 (workflow `.claude/workflows/select40.mjs`, a third lane beside the
ams40 lanes). Not committed until the user says "commit".

## The request (user, 2026-11-03)

"Redesign the player select screen before the first mission starts. Port the graphics fidelity
of the reference select sheet and apply it to the players (Vincent, Dirk, Thom, Bob and Patrick).
Create the same miserable look for them, laid out as a parody of the photos of the players."

The reference is a private select-screen sheet of a 1990s arcade game (`tmp/refs/select-sheet/`,
ignored by git). It is used ONLY for the level of craft: portrait size and framing, the three
portrait states, light and shading, palette discipline, the haggard caricature style and the
mechanics of the screen furniture. Nothing is traced, copied or colour-sampled, and the game,
its studio and its characters are never named in files (docs/ORIGINALITY.md).

## What changes

- **The portraits.** Each friend becomes a head-and-shoulders caricature in a 64 x 120 window, at
  1x only (pixel grid path B), up to 64 colours per hero: a parody of a portrait photo, drawn as a
  miserable, haggard arcade soldier (deep eye bags, sweat, strained eyes, heavy shadow, rough
  stubble, gaunt cheeks) while each friend stays recognisable by the traits of the approved squad
  (docs/design/squad40/, the 40 px heroes in the game) and of today's portraits
  (`src/game/content/characters/select.art.ts`). Costume as the 40 px hero.
- **Three states per hero** (ids keep `char/<id>/select` and `char/<id>/select-grey`; one new id):
  - `select-grey`: not highlighted - a dark, low-key steel-grey monochrome, eyes heavy, gloomy.
  - `select`: highlighted - full colour, a short nervous idle loop (blink, sweat drop, twitch,
    eye dart, long holds).
  - `select-pick` (new): the confirm reaction, played once - the miserable grimace (eyes bulge,
    teeth, sweat burst, a signature gag per hero), held on its last frame until the shutter
    drops.
- **The furniture at 1x with the same craft.** The rust-brown riveted steel frame, the olive
  shutters with the squad emblem (heavier mechanics: a rise with a bounce, a drop with an impact
  squash and dust), the P1 / P2 lamps (off, on, blink, glow), the stencil nameplates, the glass
  preview window and the hazard strip. The title stays our own text, REPORT FOR DUTY, in a
  sprayed, chipped stencil. Their 2x / 4x / HD drawers go (1x only); every other screen that
  uses this art keeps working.
- **The sequence** stays (shutters rise one by one, grey to colour on highlight, confirm, the
  shutter drops, the preview shows the 40 px hero), with the pick reaction between the confirm
  and the drop. The 2-player rules, the timer, the pads and the back key stay.

## Privacy

The friends' photos are for likeness only: never stored, traced, copied or embedded in the repo
or in pages, never described in files, and never sent anywhere. The user sent one photo of each
friend for this work (2026-11-03); they stay outside the repo, and their paths reach only the
agents that need them through the workflow's run arguments. Each portrait parodies its photo:
the framing, head angle, face, hair and expression of the photo, turned into the miserable
arcade soldier; the clothing is the 40 px hero's costume, cut like the photo where both agree.

## How it runs

One workflow run, 9 agents, all Opus 5.5 at high effort (ports 5571-5579): stage 1 the portrait
kit with VINCENT and the furniture with the scene code; stage 2 THOM, DIRK, BOB and PATRICK; two
reviewers (likeness and craft; game, code and tests); one verifier with every gate, thorough tests
and a review page update. Snapshot `.claude/snapshots/select40-post.tgz` after the run.
