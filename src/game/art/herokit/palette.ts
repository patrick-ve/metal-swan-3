/**
 * The kit's palette (docs/design/ams2.md §1, docs/design/ams2-contract.md): ramps of about 4 tones
 * spaced about 0.2 in lightness, hard clusters, one near-black outline. A canvas holds palette ids;
 * the light of the time of day is a table from id to colour, so one drawing serves every light.
 *
 * Ids are stable while no ramp is added: the base ids come first (in the order of registration),
 * then per tier the new tones of the long ramps (hi.ts). A section may add its own ramps with
 * `ramp()` at import time, before anything is drawn.
 */
import { pyRound } from './canvas-math';

/** The colours by id. Id 0 is empty. */
export const COL: (string | null)[] = [null];
/** The dark tone of a ramp by id (selout). */
export const DARK = new Map<number, number>();
/** The ramps by name: ids, light to dark. */
export const R: Record<string, number[]> = {};

function reg(h: string): number {
  COL.push(h);
  return COL.length - 1;
}

/** Add a ramp, light to dark. Returns its ids. */
export function ramp(name: string, ...hexes: string[]): number[] {
  const ids = hexes.map(reg);
  for (const i of ids) DARK.set(i, ids[ids.length - 1]);
  R[name] = ids;
  return ids;
}

/** The heroes' outline colour: the near plane. */
export const K = reg('#140c0e');
DARK.set(K, K);
/** The outline of the middle plane: dark, a little softer. */
export const KM = reg('#2c1a26');
DARK.set(KM, KM);

export function hexrgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

// Ramps: hi, base, shade, dark. Lightness about .2 apart, as on a hero.
ramp('brickr', '#e08a5c', '#bd4f34', '#83292a', '#4b1522');
ramp('brickd', '#a57a68', '#6f4a46', '#472c33', '#271822');
ramp('bricko', '#f0c978', '#c9913f', '#8d5a28', '#4f2e1c');
ramp('brickb', '#b58654', '#8a5634', '#5c3526', '#331c1c');
ramp('brickn', '#90a2ad', '#5f7284', '#3d4a5e', '#212a3c');
ramp('plastc', '#fbedc4', '#dfc88c', '#ac8e5e', '#6c5240');
ramp('plastw', '#fffdf2', '#d9dcd8', '#a2a9b6', '#616780');
ramp('plastg', '#a9d6a5', '#58a06e', '#2f6e4e', '#173f36');
ramp('plastp', '#fbd2c0', '#dc8f84', '#a4525c', '#5e2c3e');
ramp('white', '#fffdf4', '#d4d6d4', '#8f94a8', '#4c5068');
ramp('stone', '#ece4cc', '#b9ae97', '#7f776f', '#47424a');
ramp('kerb', '#f2efe2', '#b8b5ae', '#77757c', '#3f3e48');
ramp('roof', '#8c8a94', '#5a5966', '#383845', '#1e1e2a');
ramp('glass', '#d6f2ee', '#6aa2b8', '#27436a', '#121c38');
ramp('dgreen', '#82bc84', '#3a8058', '#1c5240', '#0e2e28');
ramp('dred', '#ec8c64', '#b83c34', '#721c28', '#3e0e1c');
ramp('navy', '#a0bedc', '#4c6ca8', '#28386c', '#141c40');
ramp('iron', '#94c09c', '#4a8064', '#245040', '#102c26');
ramp('wood', '#ecc98e', '#b98a50', '#7c5532', '#43291e');
ramp('bark', '#b89a7a', '#7c5e48', '#4c3630', '#2a1c1e');
ramp('leaf', '#c6de66', '#6fae3c', '#2f7a34', '#154a2e');
ramp('leaf2', '#e2ec8a', '#98c64c', '#4a9438', '#1e5c30');
ramp('moss', '#a0b45c', '#607c3a', '#34502c', '#1a3022');
ramp('bollard', '#e0906a', '#ac4a34', '#6e2626', '#3e1420');
ramp('xw', '#fffaf0', '#c3c7d2');
ramp('pave', '#dfd5ba', '#bdb198', '#918672', '#5c5350');
ramp('cobble', '#b4a68c', '#8a7c68', '#5e534c', '#30282c');
ramp('lane', '#d07a58', '#a84836', '#782c28', '#46181e');
ramp('paint', '#fffff4', '#c8c8c4', '#8c8c90');
ramp('gravel', '#efe0bc', '#c8b48c', '#907c60', '#5a4a3e');
ramp('grass', '#b8d860', '#6ca83c', '#357a34', '#1a4e2c');
ramp('water', '#d8f2e0', '#5cc0b0', '#1e8488', '#0e5060', '#082c40');
ramp('waterw', '#f0c888', '#b47a4c', '#74443a', '#3c2430');
ramp('hull', '#8a7e7a', '#54494c', '#2e2830', '#17141c');
ramp('cloth', '#fffdf4', '#d6d3cc', '#9a97a0');
ramp('tulip', '#ffa8c4', '#e03c7c', '#8c1c50');
ramp('yellow', '#fff08c', '#f6c43c', '#b07c18');
ramp('glow', '#fffde4', '#ffe67c', '#f0b030', '#a86a18');
ramp('lit', '#fff0a0', '#f6c048', '#b87020');
ramp('pole', '#f0f2ee', '#a8acb4', '#62687a', '#2e3140');
ramp('brass', '#f8e488', '#d0a030', '#8a5e18', '#4c2e0c');
ramp('blue', '#94c8ec', '#3e88c4', '#1e5088', '#0e2c54');
ramp('marble', '#fffdf2', '#e0ded4', '#aaaab0', '#6a6c80');
ramp('cloud', '#ffffff', '#e8eef2', '#b4c6dc', '#84a0c4');
ramp('far', '#d4c0ac', '#b09c98', '#8e8290');
ramp('farr', '#9a9cb0', '#7c8098');
ramp('skin', '#ffe4cc', '#f4b896', '#d4886c', '#94503e');

function hue(h: string, a: number, v: number): string {
  const c = hexrgb(h);
  const m = (c[0] + c[1] + c[2]) / 3;
  const d = [c[0] - m, c[1] - m, c[2] - m];
  const q = [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a), d[2]];
  const out = q.map((x) => Math.trunc(Math.max(0, Math.min(255, (x + m) * v))));
  return `#${out.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** The colour variants of the wall ramps: a house picks one per storey block (tiers 2 and 4). */
export const VARIANTS: Record<string, string[]> = {};
for (const n of ['brickr', 'brickd', 'bricko', 'brickb', 'brickn', 'plastc', 'plastw', 'plastg', 'plastp']) {
  VARIANTS[n] = [n];
  const shifts: readonly (readonly [number, number])[] = [
    [0.1, 1.04],
    [-0.12, 0.96],
    [0.05, 0.92],
    [-0.06, 1.07],
  ];
  shifts.forEach(([a, v], i) => {
    const nm = `${n}_${i}`;
    ramp(nm, ...R[n].map((id) => hue(COL[id] as string, a, v)));
    VARIANTS[n].push(nm);
  });
}

// The skies and the sun of the four lights.
ramp('sky_m', '#2a66bc', '#3a7ccb', '#5094d6', '#6eaee0', '#92c6e8', '#bcdcec');
ramp('sky_n', '#1c58b4', '#2c70c4', '#4088d2', '#5ca2dc', '#80bce6', '#a8d4ee');
ramp('sky_g', '#3a6aa8', '#6a8cb0', '#a0a8ac', '#d0bc98', '#f0d08c', '#fce2a8');
ramp('sky_s', '#1e1650', '#3c1e6c', '#6c2a7c', '#a83c7a', '#dc5c6c', '#f48c58', '#fcb85c');
ramp('cloud_g', '#fff4d0', '#fcd89c', '#d4a07c', '#94707c');
ramp('cloud_s', '#ffe0a4', '#f8a06c', '#c44c74', '#6c3070');
ramp('sun', '#fffde4', '#ffe67c', '#f6b048');

/** The light of a section. */
export type LightName = 'morning' | 'noon' | 'golden' | 'sunset';

export interface LightDef {
  readonly hi: readonly [number, number, number];
  readonly lo: readonly [number, number, number];
  readonly amt: number;
  /** The sky ramp and the cloud ramp: never graded. */
  readonly sky: string;
  readonly cloud: string;
}

export const LIGHTS: Readonly<Record<LightName, LightDef>> = {
  morning: { hi: [255, 246, 222], lo: [34, 40, 92], amt: 0.05, sky: 'sky_m', cloud: 'cloud' },
  noon: { hi: [255, 252, 236], lo: [30, 38, 96], amt: 0.03, sky: 'sky_n', cloud: 'cloud' },
  golden: { hi: [255, 214, 150], lo: [56, 36, 88], amt: 0.2, sky: 'sky_g', cloud: 'cloud_g' },
  sunset: { hi: [255, 182, 128], lo: [48, 22, 88], amt: 0.3, sky: 'sky_s', cloud: 'cloud_s' },
};

/** One colour through a light (hard table, no blending at draw time). */
export function gradeColour(c: readonly [number, number, number], L: LightDef): [number, number, number] {
  const v = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
  const t = v > 0.4 ? L.hi : L.lo;
  const a = v > 0.4 ? L.amt * v * 1.1 : L.amt * (1 - v);
  return [pyRound(c[0] + (t[0] - c[0]) * a), pyRound(c[1] + (t[1] - c[1]) * a), pyRound(c[2] + (t[2] - c[2]) * a)];
}
