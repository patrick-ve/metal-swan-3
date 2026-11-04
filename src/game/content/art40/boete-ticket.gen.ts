// GENERATED - do not edit. Made by `npm run art40 -- boete-ticket` from tools/art40/chars/boete-ticket/
// (docs/api/media.md "Baked sets"). Edit the set module and bake again.
import type { BakedSet } from '../../../engine/baked';

/** Pixel streams of more than one frame. */
const P: readonly string[] = [
  "##+$###$*%#&$$#'')$'#($$('$&#($$)($*#$##+$##",
  "##+$###$#()'#(#$##+$##",
  "##+$###$*'#($$)'$($$('%($$((%*#$##+$##",
];

export const SET: BakedSet = {
  v: 2,
  slug: "boete-ticket",
  prefix: "enemy/boete-ticket",
  budget: 28,
  face: 1,
  pal: ["#000000", "#140c0e", "#d83a34", "#8e2228", "#fbfbf6", "#c8ccd6", "#5c6276", "#9aa0b4"],
  outline: 1,
  strips: {
    "fly": {
      frames: [
        { w: 11, h: 8, ox: 5, oy: 4, px: "$#*$$##$)%#&$$*'#($$#'')$'#($$('$&#($$$'$)$'$&#($$)(#*#$$#*$$#" },
        { w: 11, h: 6, ox: 5, oy: 3, px: P[0] },
        { w: 11, h: 3, ox: 5, oy: 1, px: P[1] },
        { w: 11, h: 6, ox: 5, oy: 3, px: P[2] },
        { w: 11, h: 8, ox: 5, oy: 4, px: "$#*$$##$)'#($$)'$($$)'$($$('%($$''%(#*$$(($*#$$#*$$#" },
        { w: 11, h: 6, ox: 5, oy: 3, px: P[2] },
        { w: 11, h: 3, ox: 5, oy: 1, px: P[1] },
        { w: 11, h: 6, ox: 5, oy: 3, px: P[0] },
      ],
      durations: [2, 2, 2, 2, 2, 2, 2, 2],
      loop: true,
      cls: "prop",
    },
  },
  events: { TICKET_FLAT: 1, TICKET_FRAMES: 8, TICKET_TPF: 2 },
};

export const TICKET_FLAT = 1;
export const TICKET_FRAMES = 8;
export const TICKET_TPF = 2;
