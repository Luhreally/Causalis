// The device tier (docs/architecture §37–38): presentation only, never the simulation. A
// phone can draw the same world and crowds as a desktop. Multisample smoothing is off on
// phones: its extra colour and depth buffers cost memory, and WebKit can fail to resolve
// them, leaving a blank scene. The quality, Auto unless chosen, sets the rest of its budgets.
import type { DeviceTier } from "../render/index.ts";

/**
 * ?tier=phone or ?tier=desktop overrides the guess (testing); ?aa=0 or ?aa=1 overrides
 * multisample smoothing (a picture read pixel by pixel, or a device checked with it on).
 */
export function deviceTier(): DeviceTier {
  const coarse = globalThis.matchMedia?.("(pointer: coarse)").matches ?? false,
    small = Math.min(globalThis.screen?.width ?? 1024, globalThis.screen?.height ?? 768) < 820,
    apple = /iPhone|iPad|iPod/.test(globalThis.navigator?.userAgent ?? "");
  const params = new URLSearchParams(globalThis.location?.search ?? ""),
    forced = params.get("tier");
  const phone = forced ? forced === "phone" : (coarse && small) || apple;
  return {
    name: phone ? "phone" : "desktop",
    maxPixelRatio: 3,
    antialias: params.get("aa") === "1" || (!phone && params.get("aa") !== "0"),
    crowdCap: 80,
  };
}
