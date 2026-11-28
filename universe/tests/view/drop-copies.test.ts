// The drop's numbers and small rules Live a Line's chunk keeps its own copies of (view/line.ts), and the meadow's rule of
// who hunts whom (app/line-creature.ts prey): copied so the god game's page need not export them for the mode, held here to
// the originals word for word, so that a change to one that is not made to the other fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
/** A declaration's text as written, its spaces closed up (prettier may wrap one copy and not the other). */
const decl = (src: string, name: string): string => {
  const at = src.search(new RegExp(`(const|function) ${name}[^A-Za-z0-9_]`));
  assert.ok(at >= 0, `${name} found`);
  const from = src.slice(at),
    end = from.startsWith("const") ? from.indexOf(";") : from.indexOf("\n}") + 2;
  return from.slice(0, end).replace(/\s+/g, "").replace(/,}/g, "}");
};

test("Live a Line's copies of the drop's numbers and rules are the drop's own, word for word", () => {
  const drop = read("view/drop.ts"),
    line = read("view/line.ts");
  for (const name of [
    "MOST",
    "SPEED",
    "UPKEEP",
    "SUN",
    "ROCK",
    "ROCK_REACH",
    "MOTE",
    "DIGEST",
    "DRIFT",
    "normal",
    "lightAt",
    "wrap",
    "gapY",
    "placeY",
  ])
    assert.equal(decl(line, name), decl(drop, name), name);
  assert.equal(decl(read("app/line-creature.ts"), "prey"), decl(read("view/meadow.ts"), "prey"));
});
