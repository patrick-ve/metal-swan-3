// Synth sounds of mission ring, area 'scenery' (docs/design/ring.md §7.3, §11): the ambience the
// view asks for (src/game/ring/view.ts `ambience`, played by RingRunner.setAmbience under the
// audio key 'ambience'). Spread into SFX in sfx/index.ts. Synth recipes only (no samples, no
// generated audio).
//
// - 'ring/tunnel-bed' (loop, 2.4 s): inside the Coentunnel, the Zeeburgertunnel and under the
//   buildings at Bos en Lommer: a low boomy road roar in the tube, the jet fans' hum, a slow
//   swell of passing tyres and a soft slap echo of the joints.
// - 'ring/bridge-rumble' (loop, 1.6 s): on a bridge deck: a hollow low rumble and the two thumps
//   of the expansion joints, the wind through the railing.
//
// The tremolo and LFO rates make whole cycles in the loop, so the seam is clean.
import { BP, HP, hits, LP, loopRecipe, noise, tone, type Recipes } from './kit';

const TUNNEL_LEN = 2.4;
const BRIDGE_LEN = 1.6;

export const RING_SCENERY: Recipes = {
  'ring/tunnel-bed': loopRecipe(
    TUNNEL_LEN,
    0.7,
    [
      // The roar of the tube: low noise, swelling as tyres pass.
      { wave: 'noise', vol: 0.55, filter: LP(260), tremolo: { rate: 2 / TUNNEL_LEN, depth: 0.35 } },
      { wave: 'noise', vol: 0.18, filter: BP(700, undefined, 1.2), tremolo: { rate: 3 / TUNNEL_LEN, depth: 0.5 } },
      // The jet fans' hum (two close tones beating).
      { wave: 'sine', freq: 55, vol: 0.12 },
      { wave: 'sine', freq: 55 + 5 / TUNNEL_LEN, vol: 0.08 },
      { wave: 'noise', vol: 0.05, filter: HP(3200), tremolo: { rate: 4 / TUNNEL_LEN, depth: 0.6 } },
    ],
    // Joint slaps with their echo off the walls.
    hits(4, 0.2, TUNNEL_LEN / 4).flatMap((t) => [noise(0.05, 0.3, BP(520, undefined, 2), { delay: t }), noise(0.05, 0.12, BP(520, undefined, 2), { delay: t + 0.11 })]),
  ),
  'ring/bridge-rumble': loopRecipe(
    BRIDGE_LEN,
    0.6,
    [
      { wave: 'noise', vol: 0.45, filter: LP(180), tremolo: { rate: 2 / BRIDGE_LEN, depth: 0.3 } },
      { wave: 'sine', freq: 42, vol: 0.14, tremolo: { rate: 4 / BRIDGE_LEN, depth: 0.4 } },
      // Wind through the railing.
      { wave: 'noise', vol: 0.08, filter: BP(1800, undefined, 3), tremolo: { rate: 1 / BRIDGE_LEN, depth: 0.7 } },
    ],
    // Expansion joints: ta-dum.
    [0.3, 0.42].flatMap((t) => [noise(0.07, 0.5, LP(300), { delay: t }), tone('sine', 70, 45, 0.08, 0.35, { delay: t })]),
  ),
};
