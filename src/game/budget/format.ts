/**
 * The euro notation (docs/design/oat.md §7.5): `€ 1.234,56` — a dot for thousands, a comma for the
 * cents, a space after `€`, the hyphen as minus (`-€ 12,34`); the pop-ups are compact (`+€0,15`,
 * `-€95`). Owner: BUDGET (CORE wrote this first version with the contract; integer maths only).
 * The `€` is one glyph in each 1× font (engine/font.ts; the HD glyphs follow).
 */
import { DISPLAY_MAX_CENTS, type Cents, type EuroTextOpts } from './types';

/** Thousands with dots: 1234567 → '1.234.567'. */
function grouped(n: number): string {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '.';
    out += s[i];
  }
  return out;
}

/**
 * The text of an amount in cents: `euroText(123456)` → `€ 1.234,56`, `euroText(-1234)` →
 * `-€ 12,34`, `euroText(15, { plus: true, compact: true })` → `+€0,15`,
 * `euroText(-9500, { compact: true })` → `-€95`. Non-integer input is truncated toward zero.
 */
export function euroText(cents: Cents, o: EuroTextOpts = {}): string {
  let c = Math.trunc(Number.isFinite(cents) ? cents : 0);
  if (o.clamp ?? true) c = Math.max(-DISPLAY_MAX_CENTS, Math.min(DISPLAY_MAX_CENTS, c));
  const neg = c < 0;
  const a = Math.abs(c);
  const euros = Math.floor(a / 100);
  const rest = a % 100;
  const sign = neg ? '-' : o.plus && c > 0 ? '+' : '';
  const body = o.compact && rest === 0 ? grouped(euros) : `${grouped(euros)},${rest < 10 ? '0' : ''}${rest}`;
  return `${sign}€${o.compact ? '' : ' '}${body}`;
}
