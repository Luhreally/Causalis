// The device tier (docs/architecture §37–38): presentation budgets only. A phone
// draws fewer figures and fewer pixels; it never simulates less.
import type { DeviceTier } from "../render/index.ts";

/** ?tier=phone or ?tier=desktop overrides the guess (testing). */
export function deviceTier(): DeviceTier {
  const coarse = globalThis.matchMedia?.("(pointer: coarse)").matches ?? false,
    small = Math.min(globalThis.screen?.width ?? 1024, globalThis.screen?.height ?? 768) < 820,
    apple = /iPhone|iPad|iPod/.test(globalThis.navigator?.userAgent ?? "");
  const forced = new URLSearchParams(globalThis.location?.search ?? "").get("tier");
  const phone = forced ? forced === "phone" : (coarse && small) || apple;
  return phone
    ? { name: "phone", maxPixelRatio: 2, antialias: false, crowdCap: 40 }
    : { name: "desktop", maxPixelRatio: 2, antialias: true, crowdCap: 80 };
}
