/**
 * Sprites of mission sewers' street cast (docs/design/sewers.md §3; owner P5 STREET): baked 40 px sets
 * (drawn offline by tools/art40/chars/sewers-street/, `npm run art40 -- <slug> --out
 * src/game/content/sewers/art40`), loaded with the lazy sewers chunk only. Every id carries the
 * `sewers-` segment (missions/sewers/ids.ts `isSewersSpriteId`).
 *
 * Looks (behaviours, not groups: the skin tones are spread over every crook, no costume is tied to
 * one skin tone):
 * - `enemy/sewers-dealer-a`: a grey zip hoodie, the hood up, jeans (skin a);
 *   `enemy/sewers-dealer-b`: an olive bomber jacket with the orange lining, a black beanie (skin b);
 *   `enemy/sewers-dealer-c`: a long camel coat, a tweed flat cap, a short beard (skin c);
 * - `enemy/sewers-pimp-a`: the purple suit and wide hat with the gold band (skin a), and its palette
 *   variant `enemy/sewers-pimp-b`: the white suit and hat with the red band (skin b); gold chains,
 *   rings, the cane, the gold pistol;
 * - `enemy/sewers-bodyguard-a`: big, the black suit, sunglasses, the earpiece, bald (skin b), and its
 *   palette variant `enemy/sewers-bodyguard-b`: a black buzz cut (skin c).
 *
 * Strips (the game reads them by time; the logic times stay):
 * - every crook: `idle` 4, `walk` 12 (the stride matched to his speed: dealer 12 × 2 ticks at 1.2
 *   px/tick, pimp 12 × 3 at 1.0, bodyguard 12 × 3 at 0.9), `run` 12 × 2 (the flee at 2.6), `cower` 4,
 *   `photo-pose` 6, `die` 10 (the swoon onto his back, 56 ticks: person.ts starts the crawl at its
 *   end), `crawl` 7;
 * - the dealer: `lurk` 4 (looking away), `tell` 5 (20 ticks: looks left, right, opens the coat - the
 *   lining full of mint tins - the knife out), `jab` 6 (15 ticks), `gloat` 6 (a mint tin tossed);
 * - the pimp: `tell` 5 (24: the hat, the cane under the arm, the pistol up; point `muzzle`), `shoot` 4
 *   (10 ticks a shot, the flash; point `muzzle`), `tell-whistle` 4 (30), `whistle` 4, `gloat` 6
 *   (counts his money);
 * - the bodyguard: `tell` 6 (24: cracks his knuckles, plants his feet), `charge` 8, `stun` 4, `gloat`
 *   6 (a word into the earpiece).
 * Small parts: `enemy/sewers-pimp/bullet` (the gold shot), `enemy/sewers-pimp/hat` and `hat-b`, and
 * `enemy/sewers-bodyguard/shades` (they tumble off in the swoon, 5 and 4 frames), `item/sewers-mints`
 * (the gag pickup: a tin of mints; the pickup's id has no strip segment, so it draws the baked
 * `item/sewers-mints/tin`).
 */
import { defineBakedSet } from '../../../../engine/baked';
import { defineSprite, getFrames, spriteAnim } from '../../../../engine/sprites';
import { SET as BODYGUARD_PARTS } from '../art40/sewers-bodyguard.gen';
import { SET as BODYGUARD } from '../art40/sewers-bodyguard-a.gen';
import { SET as DEALER_A } from '../art40/sewers-dealer-a.gen';
import { SET as DEALER_B } from '../art40/sewers-dealer-b.gen';
import { SET as DEALER_C } from '../art40/sewers-dealer-c.gen';
import { SET as MINTS } from '../art40/sewers-mints.gen';
import { SET as PIMP_PARTS } from '../art40/sewers-pimp.gen';
import { SET as PIMP } from '../art40/sewers-pimp-a.gen';

for (const set of [DEALER_A, DEALER_B, DEALER_C, PIMP, PIMP_PARTS, BODYGUARD, BODYGUARD_PARTS, MINTS]) defineBakedSet(set);

/** The pickup's sprite (mints.ts `item/sewers-mints`): the baked tin's frames. */
const TIN = `${MINTS.prefix}/tin`;
defineSprite('item/sewers-mints', () => getFrames(TIN, 1), { durations: spriteAnim(TIN).durations });
