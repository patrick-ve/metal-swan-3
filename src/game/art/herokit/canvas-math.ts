/** Number rules of the reference drawings, so a port gives the same pixels. */

/** Round half to even. */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** Modulo with the sign of the divisor. */
export function pyMod(a: number, b: number): number {
  const m = a % b;
  return m !== 0 && m < 0 !== b < 0 ? m + b : m;
}

/** Whole numbers lo, lo + step, … below hi. */
export function range(lo: number, hi: number, step = 1): number[] {
  const out: number[] = [];
  if (step > 0) for (let i = lo; i < hi; i += step) out.push(i);
  else for (let i = lo; i > hi; i += step) out.push(i);
  return out;
}
