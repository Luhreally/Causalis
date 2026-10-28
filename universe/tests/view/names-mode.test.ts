import { test } from "node:test";
import assert from "node:assert/strict";
import { namesMode, namesThings } from "../../src/ui/names.ts";

test("names respect the explicit address, remembered choice and kind of world", () => {
  assert.equal(namesMode("earth", null, null, false), "real");
  assert.equal(namesMode("alien", null, null, false), "theirs");
  assert.equal(namesMode("alien", null, "real", false), "real");
  assert.equal(namesMode("earth", "theirs", "real", true), "theirs");
  assert.equal(namesMode("alien", null, null, true), "real");
  assert.equal(namesMode("alien", "auto", null, true), "theirs");
  assert.ok(namesThings("subst:iron", ""));
  assert.ok(namesThings("town:1", '{"ref":"subst:iron"}'));
  assert.equal(namesThings("town:1", "no materials"), false);
});
