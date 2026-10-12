/**
 * Seeded pseudo-random numbers (docs/ARCHITECTURE.md §5.1).
 *
 * Generator: sfc32 (128-bit state, passes PractRand), seeded through splitmix32.
 * Same seed → same sequence on every platform. Gameplay uses `world.rng`; purely cosmetic
 * effects use `world.fxRng`, so adding a spark never changes gameplay.
 */

export type Salt = number | string;

/** 32-bit FNV-1a hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** splitmix32 finaliser: a strong 32-bit integer mix. */
export function mix32(x: number): number {
  let z = (x + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

function saltToInt(salt: Salt): number {
  if (typeof salt === 'string') return hashString(salt);
  // 32-bit integers are used as they are; other numbers are folded into 32 bits.
  if (Number.isInteger(salt) && salt >= -2147483648 && salt <= 4294967295) return salt >>> 0;
  const lo = salt | 0;
  const hi = Math.floor(salt / 4294967296) | 0;
  return (mix32(lo) ^ mix32(hi + 0x632be5ab)) >>> 0;
}

export type RngState = [number, number, number, number];

export class Rng {
  /** The 32-bit seed this generator started from (a 32-bit integer seed is kept as is). */
  readonly seed: number;
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed: Salt = 1) {
    this.seed = saltToInt(seed);
    let s = this.seed;
    this.a = s = mix32(s);
    this.b = s = mix32(s);
    this.c = s = mix32(s);
    this.d = mix32(s);
    // Warm up so that similar seeds diverge fully.
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  /** Next raw unsigned 32-bit integer. */
  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    if (max < min) {
      const s = min;
      min = max;
      max = s;
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** `v` plus a random offset in [-amount, amount). */
  jitter(v: number, amount: number): number {
    return v + (this.next() * 2 - 1) * amount;
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** -1 or 1 with equal probability. */
  sign(): 1 | -1 {
    return this.nextU32() & 1 ? 1 : -1;
  }

  /** Random element. Throws on an empty array (a programming error). */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('Rng.pick: empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Index chosen with probability proportional to its weight (weights >= 0). -1 if all are 0. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return i;
      r -= w;
    }
    return weights.length - 1;
  }

  /** Fisher–Yates shuffle in place; returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /**
   * A new independent generator derived from this generator's current state and `salt`.
   * Forking does not advance this generator. Same state + same salt → same child sequence,
   * so use distinct salts (for example an entity id) for distinct streams.
   */
  fork(salt: Salt): Rng {
    let h = mix32(saltToInt(salt) ^ 0x5bd1e995);
    h = mix32(h ^ this.a);
    h = mix32(h ^ this.b);
    h = mix32(h ^ this.c);
    h = mix32(h ^ this.d);
    return new Rng(h);
  }

  /** Snapshot of the internal state (for replays and save states). */
  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(s: Readonly<RngState>): void {
    this.a = s[0] | 0;
    this.b = s[1] | 0;
    this.c = s[2] | 0;
    this.d = s[3] | 0;
  }
}
