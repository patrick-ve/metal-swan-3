// GENERATED - do not edit. Made by `npm run art40 -- _probe` from tools/art40/chars/_probe/
// (docs/api/media.md "Baked sets"). Edit the set module and bake again.
import type { BakedSet } from '../../../src/engine/baked';

export const SET: BakedSet = {
  v: 2,
  slug: "_probe",
  prefix: "test/_probe",
  budget: 28,
  face: 1,
  pal: ["#000000", "#140c0e", "#ffe040", "#e0b018", "#fffaf0", "#9a700e", "#4c64a4", "#33467c", "#222f56", "#fffbd8"],
  outline: 1,
  hl: [4],
  fx: [9],
  variants: {
    "test/_probe-b": ["#000000", "#140c0e", "#ffe040", "#e0b018", "#fffaf0", "#9a700e", "#a4384c", "#7c2638", "#4a1626", "#fffbd8"],
  },
  strips: {
    "idle": {
      frames: [
        { w: 8, h: 8, ox: 4, oy: 8, px: "$#&$%##$%%#&#$###$$%#'$%#&$$&%#&#($$#&$%$&#(#$###$$)$*#$$##$#)$*#+#$%#&$$#" },
        { w: 8, h: 8, ox: 4, oy: 9, px: "$#&$%##$%%#&#$###$'%#&$$&%#&#($$#&$%$&#(#$###$$)$*#$$##$#)$*#+#$%#&$$#" },
      ],
      durations: [20, 12],
      loop: true,
      cls: "idle",
      why: "probe set: two frames are enough to test the loader",
    },
    "swing": {
      frames: [
        { w: 11, h: 15, ox: 3, oy: 15, px: "*##$+##$#)#$)##$$)#*#$'##$%)#+#$&##$$)#*#+#$'##$$)#*#+#$&##$$)#*$+#$%##$$)$*#+#$&##$$)#*$+#$%##$$)$*#+#$%##$%)%+#$%##$$*#+#&$%#$%##$#+#*#+$(#&#$&##$%+$$(#%$(#", pts: { "hand": [5, -13] } },
        { w: 12, h: 15, ox: 7, oy: 15, px: "$##$,##$#)#$*##$$)#*#$)##$&*#$)#%,#*#+#$(##$&*#$(##$#+&*#$(##$&*#+#$'##$#+&*#$(##$'*#$'##$#+%*$+#$'##$$*#+#&$%#$&##$#+#*#+$(#&#$'##$%+$$)#%$%#", pts: { "hand": [-5, -13] }, smear: true },
        { w: 17, h: 8, ox: 12, oy: 8, px: "$#&$.##$&)*$%##$.)#*#$$##$$+(*&)$+#$$#$$'+&*#+#&$%#$%#&$(+$(#&#$)#&$%+$$.#%$%#", pts: { "hand": [-10, -6] } },
      ],
      durations: [3, 2, 6],
      loop: false,
      defer: true,
      cls: "melee",
      why: "probe set: three frames test the smear flag, the face flip and the points",
      face: -1,
    },
  },
  events: { SWING_HIT: 1 },
};

export const SWING_HIT = 1;
