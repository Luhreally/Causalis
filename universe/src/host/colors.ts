// A realm as a colour (the realms lens, a war's sides): its own hue, keyed by its ref.
import { finish, hashString, mix } from "../kernel/index.ts";

export function realmColor(ref: string): [number, number, number] {
  const h = finish(mix(0x2ea1, hashString(ref)), 7) / 4294967296,
    k = (n: number) => (n + h * 6) % 6,
    f = (n: number) => 0.62 - 0.32 * Math.max(-1, Math.min(k(n), 4 - k(n), 1));
  return [f(5), f(3), f(1)];
}
