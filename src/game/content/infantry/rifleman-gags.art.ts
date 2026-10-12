/**
 * The rifleman's comedy gags (GDD §9.0 "Gags", §15.6 `gag-<name>`): one strip per gag for
 * `enemy/rifleman[-<outfit>]/`, registered by ./art.ts with `defineRiflemanGags(id, style)`.
 *
 * | strip | frames | what he does |
 * |---|---|---|
 * | `gag-cards` | 6 | squints at a fan of cards, slaps one down, grins (the cards fly up on alert) |
 * | `gag-kazoo` | 6 | practises a scale on a kazoo, squeaks the top note, glares at the kazoo |
 * | `gag-shine` | 6 | polishes his shako with a rag and admires his reflection |
 * | `gag-rehearse` | 6 | practises a salute, knocks his shako over his eyes, pushes it back |
 * | `gag-nap` | 6 | asleep on his feet, leaning on his rifle; a snore bubble grows and pops |
 * | `gag-newspaper` | 6 | reads THE DAILY FANFARONI (masthead bar, columns, a photo), turns the page |
 * | `gag-ice-cream` | 5 | licks a stolen cone (m2) |
 * | `gag-snowman` | 6 | builds a snowman of Fanfaroni (red shako, coal moustache) (m3) |
 * | `gag-queue` | 6 | waits in line with a coin: taps a foot, sighs, cranes his neck (m4) |
 *
 * Props left behind when a gag ends (the game spawns them, see Soldier.onGagEnd): `snowman`
 * (0 whole, 1 headless) and `snowman-head` (4 rolling frames), `cone` (4 tumbling
 * frames). Everything is drawn from the rig plus outlined pieces in palette ramps.
 *
 * Note: this module and ./art.ts import each other. `defineRiflemanGags` (called by ./art.ts at
 * load time) touches only hoisted functions, so either module may be imported first.
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { withPieces, type Piece } from '../../art/human-fx';
import { renderHuman, type HumanStyle, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { coinArt, handPiece, handsOf, HAND_WRIST, headgearArt, hatFrames, outlined, pieceAt } from './art';

/** Rifle slung on the far side (the near hand free). */
const SLUNG: Pose = { weapon: 'rifle', gunHand: 'far', gunAngle: 70 };
/** Leaning on the rifle like a walking stick (the nap). */
const CANE: Pose = { weapon: 'rifle', gunHand: 'far', gunAngle: 95 };

// ---------------------------------------------------------------------------------------------
// Pieces (built lazily, once)
// ---------------------------------------------------------------------------------------------

let cache: Record<string, PixelBuffer> | null = null;

function pieces(): Record<string, PixelBuffer> {
  if (cache) return cache;
  cache = {
    fan: cardFan(),
    card: outlined(rect(3, 4, PAL.snow[3], [[1, 1, PAL.red[2]], [1, 2, PAL.red[2]]])),
    kazoo: outlined(rect(6, 2, PAL.red[2], [[0, 0, PAL.red[3]], [1, 0, PAL.red[3]], [4, 0, PAL.gold[3]], [5, 0, PAL.gold[2]], [4, 1, PAL.gold[2]], [5, 1, PAL.gold[1]]])),
    rag: outlined(rect(4, 3, PAL.snow[2], [[0, 0, PAL.snow[3]], [3, 2, PAL.snow[1]]])),
    paper: newspaper(false),
    paperTurn: newspaper(true),
    cone: coneArt(),
    snowman: snowmanArt(true),
    snowmanBody: snowmanArt(false),
    snowHead: snowHeadArt(),
    coin: coinArt(),
    note: noteArt(),
    squeak: squeakArt(),
    sparkle: sparkleArt(),
  };
  return cache;
}

function rect(w: number, h: number, c: number, px: ReadonlyArray<readonly [number, number, number]> = []): PixelBuffer {
  const b = new PixelBuffer(w, h);
  b.rect(0, 0, w, h, c);
  for (const [x, y, k] of px) b.set(x, y, k);
  return b;
}

/** A fan of three cards (white faces, red pips), 8×6. */
function cardFan(): PixelBuffer {
  const b = new PixelBuffer(9, 7);
  b.rect(0, 2, 3, 5, PAL.snow[2]);
  b.rect(3, 1, 3, 5, PAL.snow[3]);
  b.rect(6, 0, 3, 5, PAL.snow[3]);
  b.set(1, 4, PAL.red[2]);
  b.set(4, 3, PAL.ink[0]);
  b.set(7, 2, PAL.red[2]);
  b.vline(3, 1, 5, PAL.snow[1]);
  b.vline(6, 0, 4, PAL.snow[1]);
  return outlined(b);
}

/**
 * THE DAILY FANFARONI, held open (13×10): an ink masthead bar, a red headline, grey columns of
 * type and a small photo block. `turning`: the page folds over (narrower, the back showing).
 */
function newspaper(turning: boolean): PixelBuffer {
  const w = turning ? 8 : 13;
  const b = new PixelBuffer(w, 10);
  b.rect(0, 0, w, 10, PAL.snow[2]);
  b.rect(0, 0, w, 1, PAL.snow[3]);
  if (!turning) {
    b.hline(1, w - 2, 1, PAL.ink[1]);
    b.hline(2, w - 3, 3, PAL.red[2]);
    b.rect(1, 5, 4, 3, PAL.stone[1]);
    for (let y = 5; y < 9; y += 2) b.hline(6, w - 2, y, PAL.stone[2]);
    b.vline(Math.floor(w / 2), 0, 9, PAL.snow[1]);
  } else {
    for (let y = 2; y < 9; y += 2) b.hline(1, w - 2, y, PAL.stone[2]);
    b.vline(w - 1, 0, 9, PAL.snow[1]);
  }
  return outlined(b);
}

/** A stolen ice-cream cone: a pink scoop on a waffle cone (5×8). */
function coneArt(): PixelBuffer {
  const b = new PixelBuffer(5, 8);
  b.ellipse(0, 0, 5, 4, PAL.pink[2]);
  b.set(1, 0, PAL.snow[3]);
  b.set(1, 1, PAL.snow[3]);
  b.hline(0, 4, 3, PAL.pink[1]);
  for (let y = 4; y < 8; y++) {
    const inset = Math.floor((y - 4) / 2);
    b.hline(inset, 4 - inset, y, (y & 1) === 0 ? PAL.sand[2] : PAL.sand[1]);
  }
  return outlined(b);
}

/** The snowman of Fanfaroni (with or without his head): two snowballs, a tiny red shako. */
function snowmanArt(withHead: boolean): PixelBuffer {
  const b = new PixelBuffer(13, 21);
  // Body (bottom ball) and chest (middle ball), lit from the top-left.
  b.ellipse(0, 11, 13, 10, PAL.snow[2]);
  b.ellipse(2, 11, 6, 4, PAL.snow[3]);
  b.ellipse(2, 5, 9, 8, PAL.snow[2]);
  b.ellipse(3, 5, 4, 3, PAL.snow[3]);
  b.hline(1, 11, 20, PAL.snow[1]);
  // Coal buttons.
  b.set(6, 8, PAL.ink[1]);
  b.set(6, 10, PAL.ink[1]);
  b.set(6, 14, PAL.ink[1]);
  if (withHead) b.blit(snowHeadRaw(), 3, 0);
  const t = b.trimBounds();
  const out = t ? b.crop(t.x, t.y, t.w, t.h) : b;
  return outlined(out);
}

/** The snowman's head: a 7 px snowball with coal eyes, a twig moustache and a red shako. */
function snowHeadRaw(): PixelBuffer {
  const b = new PixelBuffer(7, 8);
  b.ellipse(0, 2, 7, 6, PAL.snow[2]);
  b.set(1, 3, PAL.snow[3]);
  b.set(4, 4, PAL.ink[1]);
  b.set(6, 4, PAL.ink[1]);
  b.hline(3, 6, 6, PAL.brown[1]);
  // The tiny red shako with a gold plume.
  b.rect(2, 0, 4, 2, PAL.red[2]);
  b.set(2, 0, PAL.red[3]);
  b.set(4, 0, PAL.gold[3]);
  return b;
}

function snowHeadArt(): PixelBuffer {
  return outlined(snowHeadRaw());
}

/** A small gold music note (the kazoo scale). */
function noteArt(): PixelBuffer {
  const b = new PixelBuffer(4, 5);
  b.vline(2, 0, 3, PAL.gold[3]);
  b.set(3, 0, PAL.gold[3]);
  b.rect(0, 3, 3, 2, PAL.gold[2]);
  return outlined(b);
}

/** The squeak of the top note: a jagged white burst. */
function squeakArt(): PixelBuffer {
  const b = new PixelBuffer(7, 7);
  for (const [x, y] of [[3, 0], [3, 1], [0, 3], [1, 3], [5, 3], [6, 3], [3, 5], [3, 6], [1, 1], [5, 1], [1, 5], [5, 5]] as const) b.set(x, y, PAL.snow[3]);
  b.rect(2, 2, 3, 3, PAL.gold[3]);
  return b.outline(INK);
}

/** A 4-point sparkle (the shine). */
function sparkleArt(): PixelBuffer {
  const b = new PixelBuffer(5, 5);
  b.hline(0, 4, 2, PAL.snow[3]);
  b.vline(2, 0, 4, PAL.snow[3]);
  b.set(2, 2, PAL.gold[3]);
  return b;
}

/** A snore bubble of radius r (white, a 'z' when big; r = 0: the pop burst). */
function bubble(r: number): PixelBuffer {
  if (r <= 0) return pieces().squeak;
  const n = r * 2 + 1;
  const b = new PixelBuffer(n, n);
  b.circle(r, r, r, PAL.snow[3]);
  if (r >= 3) {
    b.hline(r - 1, r + 1, r - 1, PAL.navy[1]);
    b.set(r, r, PAL.navy[1]);
    b.hline(r - 1, r + 1, r + 1, PAL.navy[1]);
  }
  return b.outline(INK);
}

// ---------------------------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------------------------

/** What to add to one gag frame (resolved against the rendered frame's head and hands). */
interface Extra {
  /** A piece at the near / far hand (pixel `at` of the piece on the wrist), or by the head. */
  near?: readonly [string, number, number];
  far?: readonly [string, number, number];
  face?: readonly [string, number, number, number, number];
  /** The shako (headgear art) in the near hand, upside down or upright. */
  hatInHand?: boolean;
  /** A piece standing on the ground in front of him (x offset from the anchor). */
  ground?: readonly [string, number];
  bubble?: number;
  /** A salute hand at the brow. */
  salute?: boolean;
}

type GagPose = Pose & { x?: Extra };

function frame(style: HumanStyle, p: GagPose, hat: PixelBuffer | null): Frame {
  const f = renderHuman(style, p, 'full');
  const x = p.x;
  if (!x) return f;
  const pc = pieces();
  const list: Piece[] = [];
  const head = f.pts?.head ?? [2, -30];
  const hands = handsOf(f, p);
  const glove = style.gloves ?? style.skin;
  if (x.ground) {
    const g = pc[x.ground[0]];
    list.push(pieceAt(g, [x.ground[1], 0], g.w >> 1, g.h));
  }
  if (x.far) list.push(pieceAt(pc[x.far[0]], hands.far, x.far[1], x.far[2]));
  if (x.near) list.push(pieceAt(pc[x.near[0]], hands.near, x.near[1], x.near[2]));
  if (x.hatInHand && hat) list.push(pieceAt(hat, hands.near, hat.w >> 1, hat.h - 1));
  if (x.face) {
    const b = pc[x.face[0]];
    list.push(pieceAt(b, [head[0] + x.face[1], head[1] + x.face[2]], x.face[3], x.face[4]));
  }
  if (x.salute) list.push(pieceAt(handPiece('open', glove, 2), [head[0] + 6, head[1] - 2 + (p.hunch ?? 0)], HAND_WRIST[0], HAND_WRIST[1]));
  if (x.bubble !== undefined) {
    const b = bubble(x.bubble);
    list.push(pieceAt(b, [head[0] + 7 + x.bubble, head[1] - 4 - x.bubble], b.w >> 1, b.h >> 1));
  }
  return withPieces(f, list);
}

const S = P.STAND;

/** cards: squints at the fan, picks, slaps a card down, grins. */
const CARDS: GagPose[] = [
  { ...S, ...SLUNG, armN: { to: [6, -2], hand: 'grip' }, head: { tilt: 8 }, x: { near: ['fan', 4, 5] } },
  { ...S, ...SLUNG, armN: { to: [6, -3], hand: 'grip' }, head: { tilt: 10 }, expr: 'blink', x: { near: ['fan', 4, 5] } },
  { ...S, ...SLUNG, armN: { to: [6, -2], hand: 'grip' }, head: { tilt: 6 }, expr: 'chew', x: { near: ['fan', 4, 5] } },
  { ...S, ...SLUNG, lean: 8, armN: { to: [10, 3], hand: 'open' }, expr: 'shout', x: { near: ['card', 1, 2] } },
  { ...S, ...SLUNG, armN: { to: [6, 6], hand: 'fist' }, expr: 'happy' },
  { ...S, ...SLUNG, armN: { to: [6, 6], hand: 'fist' }, expr: 'happy', bob: 1 },
];

/** kazoo: do-re-mi, the squeak, the glare. */
const KAZOO: GagPose[] = [
  { ...S, ...SLUNG, armN: { to: [7, -6], hand: 'grip' }, head: { tilt: -4 }, expr: 'blink', x: { face: ['kazoo', 5, 3, 0, 1] } },
  { ...S, ...SLUNG, armN: { to: [7, -6], hand: 'grip' }, head: { tilt: -8 }, expr: 'blink', x: { face: ['kazoo', 5, 2, 0, 1] } },
  { ...S, ...SLUNG, armN: { to: [7, -7], hand: 'grip' }, head: { tilt: -12 }, expr: 'blink', x: { near: ['kazoo', -1, 1], face: ['note', 10, -6, 2, 2] } },
  { ...S, ...SLUNG, armN: { to: [7, -7], hand: 'grip' }, head: { tilt: -16 }, dy: -1, expr: 'panic', x: { face: ['squeak', 12, -2, 3, 3] } },
  { ...S, ...SLUNG, armN: { to: [9, -2], hand: 'grip' }, head: { tilt: 10 }, expr: 'shout', x: { near: ['kazoo', 1, 1] } },
  { ...S, ...SLUNG, armN: { to: [9, -2], hand: 'grip' }, head: { tilt: 14 }, expr: 'hurt', x: { near: ['kazoo', 1, 1] } },
];

/** shine: the shako off, polished with a rag, held up, admired. */
const SHINE: GagPose[] = [
  { ...S, ...SLUNG, hat: false, armN: { to: [7, 3], hand: 'grip' }, head: { tilt: 10 }, x: { hatInHand: true, near: ['rag', 0, 3] } },
  { ...S, ...SLUNG, hat: false, armN: { to: [8, 2], hand: 'grip' }, head: { tilt: 10 }, expr: 'chew', x: { hatInHand: true } },
  { ...S, ...SLUNG, hat: false, armN: { to: [7, 3], hand: 'grip' }, head: { tilt: 12 }, x: { hatInHand: true, near: ['rag', 2, 3] } },
  { ...S, ...SLUNG, hat: false, armN: { to: [9, -5], hand: 'grip' }, head: { tilt: -4 }, expr: 'happy', x: { hatInHand: true, face: ['sparkle', 10, -10, 2, 2] } },
  { ...S, ...SLUNG, hat: false, armN: { to: [9, -5], hand: 'grip' }, head: { tilt: -6 }, expr: 'blink', x: { hatInHand: true } },
  { ...S, ...SLUNG, hat: false, armN: { to: [9, -5], hand: 'grip' }, head: { tilt: -4 }, expr: 'happy', x: { hatInHand: true, face: ['sparkle', 8, -12, 2, 2] } },
];

/** rehearse: attention, salute, attention, salute too hard (shako over the eyes), push it up. */
const REHEARSE: GagPose[] = [
  { ...S, ...SLUNG, legN: { hip: 5, knee: 2 }, legF: { hip: -3, knee: 2 }, armN: { sh: 0, el: 0, hand: 'open' }, expr: 'normal' },
  { ...S, ...SLUNG, legN: { hip: 5, knee: 2 }, legF: { hip: -3, knee: 2 }, armN: { to: [5, -11], hand: 'open' }, lean: -2, expr: 'shout', x: { salute: true } },
  { ...S, ...SLUNG, legN: { hip: 5, knee: 2 }, legF: { hip: -3, knee: 2 }, armN: { sh: 0, el: 0, hand: 'open' }, expr: 'normal' },
  { ...S, ...SLUNG, legN: { hip: 5, knee: 2 }, legF: { hip: -3, knee: 2 }, armN: { to: [5, -11], hand: 'open' }, lean: -4, hatDy: 4, expr: 'hurt', x: { salute: true } },
  { ...S, ...SLUNG, armN: { to: [6, -10], hand: 'open' }, hatDy: 3, head: { tilt: 6 }, expr: 'hurt' },
  { ...S, ...SLUNG, armN: { to: [6, -11], hand: 'open' }, hatDy: 0, head: { tilt: -4 }, expr: 'blink' },
];

/** nap: asleep on his feet, leaning on the rifle, a snore bubble grows and pops. */
const NAP_BASE: GagPose = { legN: { hip: 12, knee: 8 }, legF: { hip: -12, knee: 6 }, lean: 6, head: { tilt: 16, dy: 1 }, ...CANE, armN: { to: [7, 4], hand: 'open' }, expr: 'blink' };
const NAP: GagPose[] = [1, 2, 3, 4, 0, -1].map((z, k) => ({ ...NAP_BASE, bob: k % 2, x: z < 0 ? {} : { bubble: z } }));

/** newspaper: reads (head bobbing), chuckles, turns the page. */
const PAPER_ARMS: Pose = { weapon: 'none', armN: { to: [9, -4], hand: 'grip' }, armF: { to: [8, -5], hand: 'grip' } };
const NEWSPAPER: GagPose[] = [
  { ...S, ...PAPER_ARMS, head: { tilt: 6 }, x: { near: ['paper', 9, 6] } },
  { ...S, ...PAPER_ARMS, head: { tilt: 8, dy: 1 }, x: { near: ['paper', 9, 6] } },
  { ...S, ...PAPER_ARMS, head: { tilt: 4 }, expr: 'happy', bob: 1, x: { near: ['paper', 9, 6] } },
  { ...S, ...PAPER_ARMS, head: { tilt: 4 }, expr: 'happy', x: { near: ['paper', 9, 6] } },
  { ...S, ...PAPER_ARMS, armN: { to: [7, -6], hand: 'grip' }, head: { tilt: 2 }, x: { near: ['paperTurn', 5, 6] } },
  { ...S, ...PAPER_ARMS, head: { tilt: 6 }, expr: 'blink', x: { near: ['paper', 9, 6] } },
];

/** ice-cream: licks the cone, savours it. */
const ICE_CREAM: GagPose[] = [
  { ...S, ...SLUNG, armN: { to: [7, -5], hand: 'grip' }, head: { tilt: 4 }, expr: 'chew', x: { near: ['cone', 2, 5] } },
  { ...S, ...SLUNG, armN: { to: [6, -7], hand: 'grip' }, head: { tilt: 10 }, expr: 'chew', x: { near: ['cone', 2, 5] } },
  { ...S, ...SLUNG, armN: { to: [7, -5], hand: 'grip' }, head: { tilt: 0 }, expr: 'happy', x: { near: ['cone', 2, 5] } },
  { ...S, ...SLUNG, armN: { to: [6, -7], hand: 'grip' }, head: { tilt: 10 }, expr: 'chew', bob: 1, x: { near: ['cone', 2, 5] } },
  { ...S, ...SLUNG, armN: { to: [8, 0], hand: 'grip' }, head: { tilt: -4 }, expr: 'blink', x: { near: ['cone', 2, 5] } },
];

/** snowman: pats the snowman (it stands 14 px in front of him), adjusts its shako, admires it. */
const SNOW_X = 15;
const SNOWMAN: GagPose[] = [
  { ...P.CROUCH, crouch: 0.6, ...SLUNG, armN: { to: [10, 4], hand: 'open' }, expr: 'happy', x: { ground: ['snowman', SNOW_X] } },
  { ...P.CROUCH, crouch: 0.6, ...SLUNG, armN: { to: [10, 1], hand: 'open' }, expr: 'chew', x: { ground: ['snowman', SNOW_X] } },
  { ...S, ...SLUNG, armN: { to: [9, -10], hand: 'open' }, lean: 6, expr: 'chew', x: { ground: ['snowman', SNOW_X] } },
  { ...S, ...SLUNG, armN: { to: [9, -11], hand: 'grip' }, lean: 6, expr: 'happy', x: { ground: ['snowman', SNOW_X] } },
  { ...S, ...SLUNG, armN: { sh: 0, el: 30, hand: 'fist' }, lean: -4, expr: 'happy', x: { ground: ['snowman', SNOW_X] } },
  { ...S, ...SLUNG, armN: { sh: 0, el: 30, hand: 'fist' }, lean: -4, expr: 'blink', x: { ground: ['snowman', SNOW_X] } },
];

/** queue: waits with a coin, taps a foot, sighs, cranes his neck to see the front. */
const QUEUE_GAG: GagPose[] = [
  { ...S, ...SLUNG, armN: { to: [6, 2], hand: 'grip' }, x: { near: ['coin', 3, 3] } },
  { ...S, ...SLUNG, legN: { hip: 20, knee: 14, foot: 20 }, armN: { to: [6, 2], hand: 'grip' }, x: { near: ['coin', 3, 3] } },
  { ...S, ...SLUNG, armN: { to: [6, 2], hand: 'grip' }, expr: 'yawn', hunch: 1, x: { near: ['coin', 3, 3] } },
  { ...S, ...SLUNG, legN: { hip: 20, knee: 14, foot: 20 }, armN: { to: [6, 2], hand: 'grip' }, expr: 'blink', x: { near: ['coin', 3, 3] } },
  { ...S, ...SLUNG, lean: 8, dy: -1, legN: { hip: 10, knee: 4, foot: -20 }, legF: { hip: -8, knee: 4, foot: -20 }, armN: { to: [6, 2], hand: 'grip' }, head: { dx: 1, tilt: -4 }, x: { near: ['coin', 3, 3] } },
  { ...S, ...SLUNG, armN: { to: [5, -2], hand: 'grip' }, expr: 'chew', x: { near: ['coin', 3, 3] } },
];

/**
 * Ticks per frame of every rifleman gag strip. A function declaration with literals only: it is
 * hoisted, so `defineRiflemanGags` works even while this module is still evaluating (./art.ts
 * imports this module and calls it at load time; if this module is imported first, the cycle
 * runs ./art.ts before the `const`s below exist).
 */
function gagDurations(): Record<string, number[]> {
  return {
    cards: [24, 20, 16, 8, 20, 12],
    kazoo: [14, 14, 14, 18, 24, 24],
    shine: [10, 10, 10, 24, 12, 20],
    rehearse: [24, 18, 24, 20, 16, 16],
    nap: [20, 16, 16, 16, 6, 24],
    newspaper: [30, 20, 10, 10, 12, 24],
    'ice-cream': [16, 12, 24, 12, 30],
    snowman: [14, 14, 16, 16, 30, 12],
    queue: [30, 8, 24, 8, 30, 24],
  };
}

/** The poses of every gag strip (read lazily, when a strip is first drawn). */
function gagPoses(name: string): readonly GagPose[] {
  const table: Record<string, readonly GagPose[]> = {
    cards: CARDS,
    kazoo: KAZOO,
    shine: SHINE,
    rehearse: REHEARSE,
    nap: NAP,
    newspaper: NEWSPAPER,
    'ice-cream': ICE_CREAM,
    snowman: SNOWMAN,
    queue: QUEUE_GAG,
  };
  return table[name];
}

/** Every rifleman gag strip and its timing (ticks per frame). */
export const RIFLEMAN_GAG_STRIPS: Readonly<Record<string, { poses: readonly GagPose[]; durations: number[] }>> = Object.fromEntries(
  Object.entries(gagDurations()).map(([name, durations]) => [name, { poses: gagPoses(name), durations }]),
);

/** The props a finished gag leaves behind (feet anchor). */
function propFrames(name: 'snowman' | 'snowman-head' | 'cone'): Frame[] {
  const pc = pieces();
  if (name === 'snowman') return [pc.snowman, pc.snowmanBody].map((buf) => ({ buf, ox: buf.w >> 1, oy: buf.h }));
  return hatFrames(name === 'cone' ? pc.cone : pc.snowHead);
}

/**
 * Register `gag-<name>` for every rifleman gag, plus the leftover props (`snowman`,
 * `snowman-head`, `cone`), for `enemy/<id>/` with one style (an outfit).
 */
export function defineRiflemanGags(id: string, style: HumanStyle): void {
  const pre = `enemy/${id}/`;
  // Only hoisted functions run here (see gagDurations); the poses are read when drawn.
  for (const [name, durations] of Object.entries(gagDurations())) {
    defineSprite(`${pre}gag-${name}`, () => {
      const hat = headgearArt(style);
      return gagPoses(name).map((p) => frame(style, p, hat));
    }, { durations });
  }
  defineSprite(`${pre}snowman`, () => propFrames('snowman'), { ticksPerFrame: 30 });
  defineSprite(`${pre}snowman-head`, () => propFrames('snowman-head'), { ticksPerFrame: 5 });
  defineSprite(`${pre}cone`, () => propFrames('cone'), { ticksPerFrame: 4 });
}

/** Where the snowman stands relative to a soldier in the `snowman` gag (facing right). */
export const SNOWMAN_X = SNOW_X;
