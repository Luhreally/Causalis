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

/** A faith as a colour, keyed by its ref (the old beliefs are left uncoloured). */
export function faithColor(ref: string): [number, number, number] {
  return realmColor(`${ref}:faith`);
}

/** A language as a colour: its family's hue, each language of the family a shade of it. */
export function languageColor(family: number, index: number): [number, number, number] {
  const hue = (family * 0.61803398875 + 0.13) % 1,
    v = finish(mix(0x1a96, index), 3) / 4294967296,
    light = 0.4 + 0.24 * v,
    sat = 0.5 + 0.35 * ((v * 7) % 1);
  const a = sat * Math.min(light, 1 - light),
    f = (n: number) => {
      const k = (n + hue * 12) % 12;
      return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
  return [f(0), f(8), f(4)];
}
