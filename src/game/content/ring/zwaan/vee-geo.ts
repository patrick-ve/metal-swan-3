/**
 * The livestock trailer `ring-zwaan-vee` (ZWAAN VEETRANSPORT): geometry and sprite ids shared by
 * its logic (vee.ts, vee-animals.ts) and art (vee-art.ts, vee-animals-art.ts). LOCAL coordinates:
 * x 0 = the rear end, + forward; y 0 = the road line, − up. It always faces right.
 *
 * - the box: x 2 … 162, y −20 … −62, aluminium with ventilation slats on two decks (cows below,
 *   pigs above, seen through the slats), a rust-red band with `LEVEND VEE`, the `ZWAAN` panel with
 *   the swan at the front top;
 * - the rear gate: hinged at (2, −20), up = closed, down = a ramp onto the road at x −34;
 * - the roof hatch (x 104 … 122): the farmhand stands in it (his hip at the roof line);
 * - wheels: the rear bogie (x 22, 38, 54); the front runs on the kit's converter dolly (kit.ts).
 */
import { RING_ZWAAN } from '../../../ring/ids';
import { zwaanArt } from './api';

export const VEE_ID = RING_ZWAAN.vee;
export const VEE_ART = zwaanArt(VEE_ID);

export const VEE = {
  length: 164,
  height: 64,
  deck: -18,
  box: { x0: 2, x1: 162, top: -62, bottom: -20, mid: -41 },
  hinge: [2, -20] as const,
  gateLen: 40,
  gateFoot: -34,
  /** The hatch on the roof (x range) and the farmhand's hip point (local). */
  hatch: [104, 122] as const,
  farmhand: [113, -60] as const,
  wheels: [22, 38, 54] as const,
  lampAt: [0, -16] as const,
} as const;

/** Gate angles of the `gate` frames (degrees from upright, turning back over the rear). */
export const GATE_ANGLES = [0, 40, 80, 115] as const;

export const VEE_SPR = {
  body: (s: number) => `${VEE_ART}/body-${s}`,
  gate: `${VEE_ART}/gate`,
  gateFall: `${VEE_ART}/gate-fall`,
  hatch: `${VEE_ART}/hatch`,
  farmhand: (pose: 'stand' | 'lift' | 'lift-churn' | 'throw' | 'duck') => `${VEE_ART}/farmhand-${pose}`,
  bale: `${VEE_ART}/bale`,
  churn: `${VEE_ART}/churn`,
  cow: (gait: 'walk' | 'trot' | 'graze') => `${VEE_ART}/cow-${gait}`,
  pig: (gait: 'walk' | 'trot' | 'graze') => `${VEE_ART}/pig-${gait}`,
  lamps: `${VEE_ART}/lamps`,
} as const;

/** The gate's surface y at local x when it lies on the road (the ramp). */
export function gateY(x: number): number {
  const [hx, hy] = VEE.hinge;
  if (x >= hx) return hy;
  if (x <= VEE.gateFoot) return 0;
  return hy * ((x - VEE.gateFoot) / (hx - VEE.gateFoot));
}
