// A realm as a colour (the realms lens, a war's sides): its own hue, keyed by its ref.
import { finish, hashString, mix } from "../kernel/index.ts";

export function realmColor(ref: string): [number, number, number] {
  return hueColor(realmHue(ref));
}

/** A realm's own hue, of one whole turn. */
export function realmHue(ref: string): number {
  return finish(mix(0x2ea1, hashString(ref)), 7) / 4294967296;
}

/** A hue of one whole turn as a colour: how light, and how far from grey. */
export function hueColor(h: number, light = 0.62, strength = 0.32): [number, number, number] {
  const k = (n: number) => (n + h * 6) % 6,
    f = (n: number) => light - strength * Math.max(-1, Math.min(k(n), 4 - k(n), 1));
  return [f(5), f(3), f(1)];
}
