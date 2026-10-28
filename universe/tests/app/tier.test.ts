import { test } from "node:test";
import assert from "node:assert/strict";
import { deviceTier } from "../../src/app/tier.ts";

test("phones avoid multisample buffers by default, with explicit overrides for checking a device", () => {
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  const tier = (search: string) => {
    Object.defineProperty(globalThis, "location", { configurable: true, value: { search } });
    return deviceTier();
  };
  try {
    assert.equal(tier("?tier=phone").antialias, false);
    assert.equal(tier("?tier=phone&aa=1").antialias, true);
    assert.equal(tier("?tier=desktop").antialias, true);
    assert.equal(tier("?tier=desktop&aa=0").antialias, false);
    assert.equal(tier("?tier=phone").maxPixelRatio, tier("?tier=desktop").maxPixelRatio);
  } finally {
    if (location) Object.defineProperty(globalThis, "location", location);
    else delete (globalThis as { location?: unknown }).location;
  }
});
