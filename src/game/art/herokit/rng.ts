/**
 * The kit's seeded generator (docs/design/ams2-contract.md). A faithful port of the generator the
 * reference scenes used (PCG64 XSL-RR 128/64 seeded by the standard seed-sequence hash), so a part
 * drawn with the same seed gives the same pixels as its reference. Deterministic in every thread:
 * no clock and no `Math.random`.
 */

const INIT_A = 0x43b0d7e5;
const MULT_A = 0x931e8875;
const INIT_B = 0x8b51f9dd;
const MULT_B = 0x58f38ded;
const MIX_MULT_L = 0xca01f9dd;
const MIX_MULT_R = 0x4973f715;
const POOL = 4;

/** The 128-bit multiplier as 16-bit limbs, low first. */
const M0 = 0xf645, M1 = 0x9fcc, M2 = 0xdf64, M3 = 0x4385, M4 = 0x5da4, M5 = 0x1fc6, M6 = 0xed05, M7 = 0x2360;

/** The 32-bit words of the entropy of a whole-number seed. */
function entropyWords(seed: number): number[] {
  let x = Math.floor(seed);
  if (!(x > 0)) return [0];
  const out: number[] = [];
  while (x > 0) {
    out.push(x % 4294967296);
    x = Math.floor(x / 4294967296);
  }
  return out;
}

/** The eight 32-bit state words of a seed: the seed-sequence hash, as the reference generator seeds. */
function seedWords(seed: number): number[] {
  const entropy = entropyWords(seed);
  const mixer = new Uint32Array(POOL);
  let hc = INIT_A;
  const hashmix = (v: number): number => {
    let value = (v ^ hc) >>> 0;
    hc = Math.imul(hc, MULT_A) >>> 0;
    value = Math.imul(value, hc) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  };
  const mix = (x: number, y: number): number => {
    const r = (Math.imul(MIX_MULT_L, x) - Math.imul(MIX_MULT_R, y)) >>> 0;
    return (r ^ (r >>> 16)) >>> 0;
  };
  for (let i = 0; i < POOL; i++) mixer[i] = hashmix(i < entropy.length ? entropy[i] : 0);
  for (let s = 0; s < POOL; s++) {
    for (let d = 0; d < POOL; d++) if (s !== d) mixer[d] = mix(mixer[d], hashmix(mixer[s]));
  }
  for (let s = POOL; s < entropy.length; s++) {
    for (let d = 0; d < POOL; d++) mixer[d] = mix(mixer[d], hashmix(entropy[s]));
  }
  const words: number[] = [];
  let h = INIT_B;
  for (let i = 0; i < 8; i++) {
    let v = (mixer[i % POOL] ^ h) >>> 0;
    h = Math.imul(h, MULT_B) >>> 0;
    v = Math.imul(v, h) >>> 0;
    words.push((v ^ (v >>> 16)) >>> 0);
  }
  return words;
}

/** A seeded generator. Same seed, same numbers, on every platform and in every thread. */
export class KitRng {
  /** The state and the increment as 16-bit limbs, low first. */
  private readonly s = new Float64Array(8);
  private readonly c = new Float64Array(8);
  /** The result of the last `next64`. */
  private rh = 0;
  private rl = 0;
  private spare = 0;
  private hasSpare = false;

  constructor(seed: number) {
    const w = seedWords(seed);
    // [low word, high word] pairs: the initial state is (w0, w1) over (w2, w3), the sequence (w4, w5) over (w6, w7).
    const stateHi = [w[0], w[1]];
    const stateLo = [w[2], w[3]];
    const seqHi = [w[4], w[5]];
    const seqLo = [w[6], w[7]];
    // inc = (seq << 1) | 1
    const seq = [seqLo[0], seqLo[1], seqHi[0], seqHi[1]];
    let carry = 1;
    for (let i = 0; i < 4; i++) {
      const v = seq[i];
      const top = v >>> 31;
      const nv = ((v << 1) | carry) >>> 0;
      this.c[i * 2] = nv & 0xffff;
      this.c[i * 2 + 1] = nv >>> 16;
      carry = top;
    }
    this.step();
    const st = [stateLo[0], stateLo[1], stateHi[0], stateHi[1]];
    let add = 0;
    for (let i = 0; i < 8; i++) {
      const part = i % 2 === 0 ? st[i >> 1] & 0xffff : st[i >> 1] >>> 16;
      const v = this.s[i] + part + add;
      this.s[i] = v % 65536;
      add = v >= 65536 ? 1 : 0;
    }
    this.step();
  }

  private step(): void {
    const s = this.s;
    const c = this.c;
    const a0 = s[0], a1 = s[1], a2 = s[2], a3 = s[3], a4 = s[4], a5 = s[5], a6 = s[6], a7 = s[7];
    let t = a0 * M0 + c[0];
    s[0] = t % 65536;
    t = Math.floor(t / 65536) + a0 * M1 + a1 * M0 + c[1];
    s[1] = t % 65536;
    t = Math.floor(t / 65536) + a0 * M2 + a1 * M1 + a2 * M0 + c[2];
    s[2] = t % 65536;
    t = Math.floor(t / 65536) + a0 * M3 + a1 * M2 + a2 * M1 + a3 * M0 + c[3];
    s[3] = t % 65536;
    t = Math.floor(t / 65536) + a0 * M4 + a1 * M3 + a2 * M2 + a3 * M1 + a4 * M0 + c[4];
    s[4] = t % 65536;
    t = Math.floor(t / 65536) + a0 * M5 + a1 * M4 + a2 * M3 + a3 * M2 + a4 * M1 + a5 * M0 + c[5];
    s[5] = t % 65536;
    t = Math.floor(t / 65536) + a0 * M6 + a1 * M5 + a2 * M4 + a3 * M3 + a4 * M2 + a5 * M1 + a6 * M0 + c[6];
    s[6] = t % 65536;
    t = Math.floor(t / 65536) + a0 * M7 + a1 * M6 + a2 * M5 + a3 * M4 + a4 * M3 + a5 * M2 + a6 * M1 + a7 * M0 + c[7];
    s[7] = t % 65536;
  }

  /** The next 64 bits, in `rh` and `rl`. */
  private next64(): void {
    this.step();
    const s = this.s;
    const hi1 = (s[7] * 65536 + s[6]) >>> 0;
    const hi0 = (s[5] * 65536 + s[4]) >>> 0;
    const lo1 = (s[3] * 65536 + s[2]) >>> 0;
    const lo0 = (s[1] * 65536 + s[0]) >>> 0;
    const xh = (hi1 ^ lo1) >>> 0;
    const xl = (hi0 ^ lo0) >>> 0;
    const rot = hi1 >>> 26;
    if (rot === 0) {
      this.rh = xh;
      this.rl = xl;
    } else if (rot < 32) {
      this.rl = ((xl >>> rot) | (xh << (32 - rot))) >>> 0;
      this.rh = ((xh >>> rot) | (xl << (32 - rot))) >>> 0;
    } else if (rot === 32) {
      this.rl = xh;
      this.rh = xl;
    } else {
      const q = rot - 32;
      this.rl = ((xh >>> q) | (xl << (32 - q))) >>> 0;
      this.rh = ((xl >>> q) | (xh << (32 - q))) >>> 0;
    }
  }

  private next32(): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare;
    }
    this.next64();
    this.hasSpare = true;
    this.spare = this.rh;
    return this.rl;
  }

  /** A float in [0, 1). */
  random(): number {
    this.next64();
    return (this.rh * 2097152 + (this.rl >>> 11)) * 1.1102230246251565e-16;
  }

  /** A float in [a, b). */
  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  /** A whole number in [lo, hi) (hi not included). */
  int(lo: number, hi: number): number {
    const excl = hi - lo;
    const rng = excl - 1;
    if (rng <= 0) return lo;
    const al = excl & 0xffff;
    const ah = excl >>> 16;
    let n = this.next32();
    let top = 0;
    let left = 0;
    const scale = (): void => {
      const bl = n & 0xffff;
      const bh = n >>> 16;
      const ll = al * bl;
      const m1 = ah * bl + (ll >>> 16 > 0 ? Math.floor(ll / 65536) : 0);
      const m2 = al * bh + (m1 % 65536);
      top = ah * bh + Math.floor(m1 / 65536) + Math.floor(m2 / 65536);
      left = ((m2 % 65536) * 65536 + (ll % 65536)) >>> 0;
    };
    scale();
    if (left < excl) {
      const threshold = (4294967295 - rng) % excl;
      while (left < threshold) {
        n = this.next32();
        scale();
      }
    }
    return lo + top;
  }

  /** One of the items. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length)];
  }

  /** `k` different whole numbers in [0, n), in the reference generator's order only for small `n`. */
  sample(n: number, k: number): number[] {
    const pool = Array.from({ length: n }, (_, i) => i);
    const out: number[] = [];
    for (let i = 0; i < k && pool.length > 0; i++) out.push(pool.splice(this.int(0, pool.length), 1)[0]);
    return out;
  }
}

/** A generator for a seed (the reference's `rngf`). */
export function rngf(seed: number): KitRng {
  return new KitRng(seed);
}
