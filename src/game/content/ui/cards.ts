/**
 * Mission cards (GDD §2.4, §12.3, §13.6, §13.11): for m0–m5, ams and the ring the intro card label,
 * name, place and time, Gusto's two briefing lines, the announcer line of the start banner and the
 * newspaper headline of the tally. m0–m5 share one line map of Lowmere and Crescendia; each card
 * puts its blinking dot on its own region; ams has its own map of the Amsterdam canal ring; the
 * ring (MISSION 2, docs/design/ring.md §1) a map of the A10 ring road with its dot on the on-ramp
 * at A10 Oost; oldenzaal (MISSION 4, docs/design/oldenzaal.md §1) a map of the flight east to Twente
 * with its dot on the town.
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
// The ams map: Amsterdam's canal ring (its own small map; the mission is a prologue abroad)
// ---------------------------------------------------------------------------------------------

/** A polyline arc round (cx, cy) from angle a0 to a1 (degrees, 0 = east, 90 = south). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, step = 15): MapLine {
  const out: number[] = [];
  for (let a = a0; a <= a1 + 0.01; a += step) {
    const t = (a * Math.PI) / 180;
    out.push(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r * 0.8));
  }
  return out;
}

/** The IJ waterfront in the north, the three canal rings, the Amstel from the south, the Singel. */
const AMS_CX = 186;
const AMS_CY = 68;
const AMS_LINES: readonly MapLine[] = [
  [96, 68, 140, 66, 186, 68, 232, 66, 280, 68],
  arc(AMS_CX, AMS_CY, 20, 0, 180),
  arc(AMS_CX, AMS_CY, 34, 0, 180),
  arc(AMS_CX, AMS_CY, 48, 0, 180),
  arc(AMS_CX, AMS_CY, 60, 0, 180),
  [212, 118, 206, 106, 202, 96, 198, 86],
];
const AMS_LABELS: readonly (readonly [string, number, number])[] = [
  ['AMSTERDAM', 252, 100],
  ['IJ', 102, 72],
];

// ---------------------------------------------------------------------------------------------
// The ring map: the A10 ring road round Amsterdam (mission ring, docs/design/ring.md §1, §4)
// ---------------------------------------------------------------------------------------------

/**
 * The A10 clockwise from A10 Oost (the on-ramp, the dot): Amstel, Zuid, De Nieuwe Meer, West,
 * Sloterdijk, Westpoort and the Coentunnel under the water, Noord, the Zeeburgertunnel, back to
 * Oost. A closed polyline, drawn in segment by segment.
 */
const RING_ROAD: MapLine = [258, 92, 250, 104, 232, 110, 196, 113, 160, 110, 136, 102, 126, 89, 130, 78, 146, 69, 170, 64, 200, 63, 228, 65, 250, 72, 258, 82, 258, 92];
/** The water (the IJ and the Noordzeekanaal) that the two tunnels pass under. */
const RING_WATER: MapLine = [96, 79, 128, 78, 160, 77, 196, 78, 232, 76, 266, 78, 292, 80];
/** The motorways that meet the ring: A2 (Amstel), A4 (De Nieuwe Meer), A8 (Coenplein), A1 (Oost). */
const RING_SPURS: readonly MapLine[] = [
  [232, 110, 238, 119],
  [160, 110, 150, 119],
  [146, 69, 139, 62],
  [258, 92, 272, 98],
];
/**
 * Revision R (docs/design/ring.md §R.1): the level drives only the south-east arc — S113 at A10 Oost
 * (the dot) clockwise past Amstel to the Zuidas — drawn as a second line just inside the ring (a
 * bold arc), and the blockade at the Zuidas as a cross.
 */
const RING_SHORT: MapLine = [256, 91, 248, 102, 231, 107, 199, 110];
const RING_BLOCKADE: readonly MapLine[] = [
  [192, 108, 198, 114],
  [192, 114, 198, 108],
];
const RING_LINES: readonly MapLine[] = [RING_ROAD, RING_WATER, ...RING_SPURS, RING_SHORT, ...RING_BLOCKADE];
const RING_LABELS: readonly (readonly [string, number, number])[] = [
  ['A10', 192, 92],
  ['IJ', 106, 82],
];

// ---------------------------------------------------------------------------------------------
// The oldenzaal map: the flight east to Twente (mission oldenzaal, docs/design/oldenzaal.md §1)
// ---------------------------------------------------------------------------------------------

/** A dashed polyline: two dashes per leg (the flight path, the border). */
function dashed(pts: readonly number[]): MapLine[] {
  const out: MapLine[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const [x0, y0, x1, y1] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
    out.push([x0, y0, Math.round(x0 + (x1 - x0) * 0.35), Math.round(y0 + (y1 - y0) * 0.35)]);
    out.push([Math.round(x0 + (x1 - x0) * 0.6), Math.round(y0 + (y1 - y0) * 0.6), Math.round(x0 + (x1 - x0) * 0.9), Math.round(y0 + (y1 - y0) * 0.9)]);
  }
  return out;
}

/** Oldenzaal (the dot), east in Twente, near the border. */
const OZ_DOT: readonly [number, number] = [290, 90];
/** The A1 from the west to Twente (Hengelo, then up to Oldenzaal). */
const OZ_A1: MapLine = [70, 84, 110, 86, 150, 90, 190, 92, 226, 96, 254, 98, 274, 96, 290, 90];
/** The IJsselmeer's south shore in the west, the river IJssel crossing the A1. */
const OZ_SHORE: MapLine = [60, 64, 74, 70, 92, 68, 104, 72, 112, 66];
const OZ_IJSSEL: MapLine = [176, 62, 172, 74, 178, 86, 174, 100, 180, 114];
/** The border east of the town (dashed). */
const OZ_BORDER: readonly number[] = [340, 62, 334, 74, 338, 86, 332, 98, 336, 110];
/** The Swan's flight path (dashed, a gentle arc over the land). */
const OZ_FLIGHT: readonly number[] = [80, 78, 130, 70, 180, 68, 230, 72, 268, 80, 288, 88];
/** Twente's towns: little squares (Hengelo, Enschede) south-west of the dot. */
const OZ_TOWNS: readonly MapLine[] = [
  [262, 100, 266, 100, 266, 104, 262, 104, 262, 100],
  [280, 106, 285, 106, 285, 111, 280, 111, 280, 106],
];
const OZ_LINES: readonly MapLine[] = [OZ_A1, OZ_SHORE, OZ_IJSSEL, ...dashed(OZ_BORDER), ...dashed(OZ_FLIGHT), ...OZ_TOWNS];
const OZ_LABELS: readonly (readonly [string, number, number])[] = [
  ['AMSTERDAM', 82, 92],
  ['TWENTE', 246, 110],
  ['OLDENZAAL', 300, 70],
];

// ---------------------------------------------------------------------------------------------
// The cards
// ---------------------------------------------------------------------------------------------

/** The speaker of the briefing lines (defined next to the cards' type in scenes/flow-data.ts). */
export { BRIEFING_SPEAKER } from '../../scenes/flow-data';

export const MISSION_CARDS: readonly MissionCard[] = [
  {
    id: 'ams',
    label: 'MISSION 1',
    name: 'THE FRYING DUTCHMAN',
    place: 'AMSTERDAM - 1100 HOURS',
    briefing: ['SHORE LEAVE IN AMSTERDAM. THE CYGNETS WANT FRIES.', 'THE BEST FRY SHOP IN TOWN NEEDS HELP. GO!'],
    headline: 'ROBO-MAYOR SCRAPPED! THE FRYER STAYS ON!',
    announce: 'MISSION ONE. VLIEG OP, ZWAAN!',
    startSub: 'START!',
    map: { lines: AMS_LINES, dot: [AMS_CX - 30, 90], labels: AMS_LABELS },
  },
  {
    id: 'ring',
    label: 'MISSION 2',
    name: 'DE RING',
    place: 'A10 RING ROAD, AMSTERDAM - 1400 HOURS',
    briefing: ['THE FRIES ARE SAFE. NOW THE A10: ONE LAP, CLOCKWISE, FULL THROTTLE.', 'A FRIEND DRIVES. YOU HANG OUT OF THE WINDOW. MIND THE SPEED CAMERAS.'],
    headline: 'WAGON LAPS THE RING! TRAFFIC MOVES AGAIN!',
    announce: 'MISSION TWO. HOU JE VAST!',
    startSub: 'START!',
    map: { lines: RING_LINES, dot: [258, 92], labels: RING_LABELS },
  },
  {
    // Level 4 (docs/design/oldenzaal.md §1): after the first-person floors and the story card.
    id: 'oldenzaal',
    label: 'MISSION 4',
    name: 'A HAUNTING IN OTOWN',
    place: 'OLDENZAAL, TWENTE - 2030 HOURS',
    briefing: ['OLDENZAAL CALLED. SOMETHING WALKS THEIR STREETS AFTER DARK.', 'FIND DE SMULHOEK ON THE CORNER. THE OWNER KNOWS MORE. STAY TOGETHER.'],
    headline: 'SAINT FREED! THE DEAD REST! SNACK BAR STILL OPEN!',
    announce: 'MISSIE VIER. BLIJF BIJ ELKAAR, ZWAANTJES!',
    startSub: 'START!',
    map: { lines: OZ_LINES, dot: OZ_DOT, labels: OZ_LABELS },
  },
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
    label: 'MISSION 2',
    name: 'BRASS ON THE RIVERBANK',
    place: 'PUDDLEWICK, LOWMERE - 0900 HOURS',
    briefing: ['THE LEGION HIJACKED THE PUDDLEWICK DUCK REGATTA.', 'FREE THE CRITICS, SINK THEIR FLAGSHIP, MIND THE DUCKS.'],
    headline: 'RIVERBOAT SUNK! REGATTA RESUMES!',
    announce: 'MISSION TWO. LOOK SHARP, CYGNETS!',
    startSub: 'START!',
    map: map([122, 92]),
  },
  {
    id: 'm2',
    label: 'MISSION 3',
    name: 'DUNE BUGLE',
    place: 'RATTLEBONE FLATS, CRESCENDIA - 1200 HOURS',
    briefing: ['THEIR DRUM CORPS IS TESTING A DRUM THE SIZE OF A HOUSE.', "STOP IT. AND DO NOT LAUGH AT THE COLONEL'S JOKES."],
    headline: "DRUM TANK SILENCED! COLONEL'S JOKES STILL BAD!",
    announce: 'MISSION THREE. STAY HYDRATED, CYGNETS!',
    startSub: 'START!',
    map: map([232, 104]),
  },
  {
    id: 'm3',
    label: 'MISSION 4',
    name: 'THE HIGH NOTE',
    place: 'MOUNT MURMUR, CRESCENDIA - 1700 HOURS',
    briefing: ['THE WOODWINDS HAVE TAKEN MOUNT MURMUR AND ITS SKI LIFT.', 'SOMETHING HUGE AND TARTAN FLOATS AT THE TOP. DEFLATE IT.'],
    headline: 'WINDBAG DEFLATED ON MOUNT MURMUR!',
    announce: 'MISSION FOUR. WRAP UP WARM, CYGNETS!',
    startSub: 'START!',
    map: map([262, 64]),
  },
  {
    id: 'm4',
    label: 'MISSION 5',
    name: 'OPENING NIGHT',
    place: 'FANFARONI CITY - 2100 HOURS',
    briefing: ['TONIGHT FANFARONI REHEARSES THE ANTHEM AT THE OPERA.', 'CRASH THE DRESS REHEARSAL. FORMAL WEAR OPTIONAL.'],
    headline: 'PREMIERE CANCELLED! PIANO "UNPLAYABLE"!',
    announce: 'MISSION FIVE. BREAK A LEG, CYGNETS!',
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

/** Register the cards. */
export function defineMissionCards(): void {
  for (const card of MISSION_CARDS) defineMissionCard(card);
}
