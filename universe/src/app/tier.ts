// The device tier (docs/architecture §37–38): presentation only, never the simulation. A
// phone of today (an iPhone 15 Plus; asked for 2026-10-25: "dont limit the game anymore") draws
// as much as a desktop — as many pixels, smoothed edges, as many in a crowd; only its screen's
// size and its touch set it apart. (The quality, Auto unless chosen, still steps a device down
// that cannot keep its frames.)
import type { DeviceTier } from "../render/index.ts";

/**
 * ?tier=phone or ?tier=desktop overrides the guess (testing); ?aa=0 draws with no smoothing of
 * edges (a picture read pixel by pixel).
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
    antialias: params.get("aa") !== "0",
    crowdCap: 80,
  };
}
