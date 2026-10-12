/**
 * Mission cards (GDD §2.4, §12.3, §13.6, §13.11): for m0–m5 the intro card label, name, place
 * and time, Gusto's two briefing lines, the announcer line of the start banner and the newspaper
 * headline of the tally. All six share one line map of Lowmere and Crescendia; each card puts its
 * blinking dot on its own region.
 *
 * Mission modules may replace a card with their own `defineMissionCard` (the last one wins).
 */
import { defineMissionCard, type MapLine, type MissionCard } from '../../scenes/flow-data';

// ---------------------------------------------------------------------------------------------
// The line map (screen px; the intro card draws it in teal, segment by segment)
// ---------------------------------------------------------------------------------------------

/** The west coast (the sea is left of it) and the south shore. */
const COAST: MapLine = [52, 60, 58, 68, 54, 76, 62, 84, 58, 92, 66, 100, 62, 106, 74, 112, 96, 114, 118, 112, 140, 116];

/** The river Wend: from the hills in the north, through Puddlewick, to the sea. */
const RIVER: MapLine = [168, 60, 160, 68, 150, 72, 146, 80, 132, 86, 122, 92, 110, 96, 100, 104, 88, 110, 76, 112];

/** The border between Lowmere (west) and Crescendia (east): a dashed line. */
function border(): MapLine[] {
  const pts = [192, 60, 188, 72, 194, 84, 190, 96, 196, 108, 194, 116];
  const out: MapLine[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const [x0, y0, x1, y1] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
    // Two dashes per leg.
    out.push([x0, y0, Math.round(x0 + (x1 - x0) * 0.35), Math.round(y0 + (y1 - y0) * 0.35)]);
    out.push([Math.round(x0 + (x1 - x0) * 0.6), Math.round(y0 + (y1 - y0) * 0.6), Math.round(x0 + (x1 - x0) * 0.9), Math.round(y0 + (y1 - y0) * 0.9)]);
  }
  return out;
}

/** Mount Murmur and its range. */
const PEAKS: MapLine = [222, 82, 230, 74, 236, 80, 246, 66, 254, 76, 262, 62, 272, 78, 280, 72, 288, 82];
const SKI_LIFT: MapLine = [240, 84, 262, 64];

/** Rattlebone Flats: three dune ripples. */
const DUNES: MapLine[] = [
  [210, 104, 216, 100, 222, 104, 228, 100, 234, 104],
  [226, 110, 232, 106, 238, 110, 244, 106, 250, 110],
  [244, 100, 250, 96, 256, 100],
];

/** Fanfaroni City: a walled square with towers and the opera dome. */
const CITY: MapLine[] = [
  [292, 96, 292, 86, 316, 86, 316, 96, 292, 96],
  [296, 86, 296, 80],
  [304, 86, 304, 78, 306, 76, 308, 78, 308, 86],
  [312, 86, 312, 82],
];

/** The road that links the regions. */
const ROAD: MapLine = [84, 72, 104, 78, 122, 92, 150, 98, 190, 100, 214, 96, 250, 90, 292, 92];

/** A cloud bank above the capital (the Grand Organ flies over it). */
const CLOUD: MapLine = [282, 74, 286, 70, 292, 70, 296, 66, 304, 66, 308, 70, 316, 70, 320, 74, 282, 74];

/** The proving grounds: a little target ring. */
const RANGE: MapLine = [80, 70, 84, 66, 88, 70, 84, 74, 80, 70];

const MAP_LINES: readonly MapLine[] = [COAST, RIVER, ...border(), PEAKS, SKI_LIFT, ...DUNES, ...CITY, ROAD, CLOUD, RANGE];

/** Region names in the map (small, dim). */
const MAP_LABELS: readonly (readonly [string, number, number])[] = [
  ['LOWMERE', 132, 64],
  ['CRESCENDIA', 236, 108],
  ['SEA', 34, 104],
];

function map(dot: readonly [number, number]): NonNullable<MissionCard['map']> {
  return { lines: MAP_LINES, dot, labels: MAP_LABELS };
}

// ---------------------------------------------------------------------------------------------
// The cards
// ---------------------------------------------------------------------------------------------

export const MISSION_CARDS: readonly MissionCard[] = [
  {
    id: 'm0',
    label: 'MISSION 0',
    name: 'TEST RANGE',
    place: 'LOWMERE PROVING GROUNDS - 0600 HOURS',
    briefing: ['MORNING, CYGNETS. THIS IS ONLY THE PROVING GROUNDS.', 'SHOOT THE CRATES. NOT THE INSTRUCTOR. NOT AGAIN.'],
    headline: 'CRATE COLOSSUS FLATTENED! RANGE OPEN AGAIN!',
    announce: 'TEST RANGE. WARM UP, CYGNETS!',
    startSub: 'START!',
    map: map([84, 70]),
  },
  {
    id: 'm1',
    label: 'MISSION 1',
    name: 'BRASS ON THE RIVERBANK',
    place: 'PUDDLEWICK, LOWMERE - 0900 HOURS',
    briefing: ['THE LEGION HIJACKED THE PUDDLEWICK DUCK REGATTA.', 'FREE THE CRITICS, SINK THEIR FLAGSHIP, MIND THE DUCKS.'],
    headline: 'RIVERBOAT SUNK! REGATTA RESUMES!',
    announce: 'MISSION ONE. LOOK SHARP, CYGNETS!',
    startSub: 'START!',
    map: map([122, 92]),
  },
  {
    id: 'm2',
    label: 'MISSION 2',
    name: 'DUNE BUGLE',
    place: 'RATTLEBONE FLATS, CRESCENDIA - 1200 HOURS',
    briefing: ['THEIR DRUM CORPS IS TESTING A DRUM THE SIZE OF A HOUSE.', "STOP IT. AND DO NOT LAUGH AT THE COLONEL'S JOKES."],
    headline: "DRUM TANK SILENCED! COLONEL'S JOKES STILL BAD!",
    announce: 'MISSION TWO. STAY HYDRATED, CYGNETS!',
    startSub: 'START!',
    map: map([232, 104]),
  },
  {
    id: 'm3',
    label: 'MISSION 3',
    name: 'THE HIGH NOTE',
    place: 'MOUNT MURMUR, CRESCENDIA - 1700 HOURS',
    briefing: ['THE WOODWINDS HAVE TAKEN MOUNT MURMUR AND ITS SKI LIFT.', 'SOMETHING HUGE AND TARTAN FLOATS AT THE TOP. DEFLATE IT.'],
    headline: 'WINDBAG DEFLATED ON MOUNT MURMUR!',
    announce: 'MISSION THREE. WRAP UP WARM, CYGNETS!',
    startSub: 'START!',
    map: map([262, 64]),
  },
  {
    id: 'm4',
    label: 'MISSION 4',
    name: 'OPENING NIGHT',
    place: 'FANFARONI CITY - 2100 HOURS',
    briefing: ['TONIGHT FANFARONI REHEARSES THE ANTHEM AT THE OPERA.', 'CRASH THE DRESS REHEARSAL. FORMAL WEAR OPTIONAL.'],
    headline: 'PREMIERE CANCELLED! PIANO "UNPLAYABLE"!',
    announce: 'MISSION FOUR. BREAK A LEG, CYGNETS!',
    startSub: 'START!',
    map: map([306, 82]),
  },
  {
    id: 'm5',
    label: 'FINAL MISSION',
    name: 'SWAN SONG',
    place: 'ABOVE THE CLOUDS - 2330 HOURS',
    briefing: ['THE GRAND ORGAN FLIES. THE ANTHEM STARTS AT MIDNIGHT.', 'GRAMPS SAYS THE SWAN CAN FLY NOW. ...SINCE WHEN, GRAMPS?'],
    headline: 'ANTHEM STOPPED! WORLD STAYS FREE TO SLOUCH!',
    announce: 'FINAL MISSION. FLY GRACEFULLY, CYGNETS!',
    startSub: 'START!',
    map: map([300, 62]),
  },
];

/** Register the six cards. */
export function defineMissionCards(): void {
  for (const card of MISSION_CARDS) defineMissionCard(card);
}
