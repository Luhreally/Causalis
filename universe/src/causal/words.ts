// Numbers in words for explanations (docs/architecture §31: plain words). The
// causal layer is deterministic code, so it formats by hand rather than through
// the platform's locale.

/** 12,345 */
export function count(n: number): string {
  const digits = String(Math.abs(Math.round(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return n < 0 ? `-${out}` : out;
}
