// The Years' search as the page reads what is typed (2026-11-16): the syntax, the folding of words, the marks.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  askAnything,
  filterText,
  fold,
  holds,
  holdsWhole,
  joinAsks,
  keyOfRef,
  marksIn,
  parseAsk,
} from "../../src/bridge/index.ts";
import { typingNow } from "../../src/ui/years-search.ts";

test("words fold without case or accents, and a term holds at the start of a word", () => {
  assert.equal(fold("Ástrid ÆTHEL’s"), "astrid æthel's");
  assert.ok(holds(fold("A cartel of salt"), "cart"));
  assert.ok(holds(fold("Smuggling grew"), fold("SMÚGG")));
  assert.ok(!holds("decartel", "cart"));
  assert.ok(holdsWhole("the war of asha upon kirath", "asha"));
  assert.ok(!holdsWhole("the war of ashara", "asha"));
});

test("the syntax: free words, keys, quoted names, ranks, years and ranges", () => {
  const a = parseAsk('plague realm:Asha town:"New Kirath" kind:war only firsts 1200-1500');
  assert.deepEqual(a.words, ["plague"]);
  assert.deepEqual(a.filters, [
    { key: "realm", value: "Asha" },
    { key: "town", value: "New Kirath" },
    { key: "kind", value: "war" },
  ]);
  assert.deepEqual(a.only, [1]);
  assert.equal(a.from, 1200);
  assert.equal(a.to, 1500);

  assert.deepEqual(parseAsk("only:wars only:sorrows").only, [0, 2]);
  assert.deepEqual(parseAsk("1250"), { words: [], filters: [], only: [], from: 1250, to: 1250 });
  const r = parseAsk("from:30 to:12");
  assert.deepEqual([r.from, r.to], [12, 30]);
  assert.deepEqual([parseAsk("-1500").from, parseAsk("-1500").to], [null, 1500]);
  assert.deepEqual([parseAsk("-50..30").from, parseAsk("-50..30").to], [-50, 30]);
  assert.deepEqual([parseAsk("1500-1200").from, parseAsk("1500-1200").to], [1200, 1500]);
  // (Aliases, and what is no key stays words.)
  assert.deepEqual(parseAsk("city:Kir family:Dena").filters, [
    { key: "town", value: "Kir" },
    { key: "house", value: "Dena" },
  ]);
  assert.deepEqual(parseAsk("note:this 12:30").words, ["note:this", "12:30"]);
  assert.deepEqual(parseAsk('"intoxicants forbidden"').words, ["intoxicants forbidden"]);
  // ("only" alone is a word.)
  assert.deepEqual(parseAsk("only").words, ["only"]);
});

test("an ask is anything asked; chips and words join, the typed years last", () => {
  assert.ok(!askAnything(parseAsk("   ")));
  assert.ok(!askAnything(parseAsk(",,")));
  assert.ok(askAnything(parseAsk("1200-")));
  const j = joinAsks(
    {
      words: [],
      filters: [{ key: "realm", value: "Asha", ref: "pol:0:1" }],
      only: [2],
      from: 5,
      to: null,
    },
    parseAsk("war 10-20"),
  );
  assert.deepEqual(j.words, ["war"]);
  assert.equal(j.filters.length, 1);
  assert.deepEqual([j.from, j.to, j.only], [10, 20, [2]]);
  assert.equal(filterText({ key: "town", value: "New Kirath" }), 'town:"New Kirath"');
  assert.equal(keyOfRef("pol:0:4"), "realm");
  assert.equal(keyOfRef("court:pol:0:4:9"), "person");
  assert.equal(keyOfRef("cell:0:12"), "land");
  assert.equal(keyOfRef("ev:0:3"), "about");
});

test("marks lie on the line's own letters, accents and all, and never over one another", () => {
  const text = "Ástrid's cartel and the Cartel of Ásh";
  const marks = marksIn(text, ["cart", "astrid", "ash"]);
  assert.deepEqual(
    marks.map(([a, b]) => text.slice(a, b)),
    ["Ástrid", "cart", "Cart", "Ásh"],
  );
  assert.deepEqual(marksIn("warwar war", ["war", "wa"]), [
    [0, 3],
    [7, 10],
  ]);
  assert.deepEqual(marksIn("nothing here", []), []);
});

test("the word being typed, and the key before it, for suggestions", () => {
  assert.deepEqual(typingNow("plague realm:As"), { key: "realm", part: "As", at: 7 });
  assert.deepEqual(typingNow("kir"), { key: null, part: "kir", at: 0 });
  assert.deepEqual(typingNow("war "), { key: null, part: "", at: 4 });
  assert.equal(typingNow("nokey:x"), null);
});
