// What each of the town mode's sheets, tabs and pages is, in plain words (town mode, G2): every sheet at the foot, every
// tab of a person's page and every kind of page has its own, each saying what it is; a page of the inspector's, read as
// any is, its ref the one it is asked by; and words of no number, the same for every town. And the game's words (U6),
// each in one plain line, a page of its own opened at any of them; a help page names a few it uses, no more.
import assert from "node:assert/strict";
import { test } from "node:test";
import { GLOSSARY, HELP, helpTopic, placeHelp } from "../../src/host/placehelp.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import {
  placeHelpRef,
  placeTownRef,
  type PlaceInspectHelp,
  type PlaceInspectTown,
} from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

const SHEETS = ["people", "stocks", "work", "build", "dangers", "log"],
  TABS = ["now", "mood", "health", "skills", "social", "gear", "life", "work"],
  PAGES = [
    "person",
    "lot",
    "inside",
    "item",
    "fields",
    "below",
    "work",
    "legends",
    "gate",
    "family",
    "bound",
    "faith",
    "dead",
    "character",
    "body",
    "making",
    "civic",
    "whatnow",
    "why",
    "levels",
    "beasts",
    "townpages",
  ];

test("every sheet, tab and page has its own words: what it is, and what you can do", (t) => {
  for (const topic of [
    ...SHEETS.map((x) => `sheet:${x}`),
    ...TABS.map((x) => `tab:${x}`),
    ...PAGES.map((x) => `page:${x}`),
  ]) {
    assert.equal(helpTopic(topic), topic, `${topic} has its own`);
    const h = HELP[topic]!;
    assert.ok(h.what.length > 20 && h.what.length < 260, `${topic}: said shortly`);
    for (const [a, b] of h.numbers) assert.ok(a && b.length > 8);
  }
  assert.equal(helpTopic("page:nothing"), "town", "anything else: the town's");
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 600, least: 100 }) ?? noTown(t, "of a hundred");
  if (!s) return;
  const x = placeInspect(w, s.ref, placeHelpRef(s.ref, "sheet:log")) as PlaceInspectHelp;
  assert.equal(x.kind, "help");
  assert.equal(x.ref, placeHelpRef(s.ref, "sheet:log"));
  assert.match(x.name, /Log/);
  // (The town's own pages listed, U3: the eight and its ground level by level, each opening its own page.)
  const list = placeInspect(w, s.ref, placeTownRef(s.ref)) as PlaceInspectTown;
  assert.equal(list.kind, "townpages");
  assert.equal(list.ref, placeTownRef(s.ref));
  assert.equal(list.pages.length, 9, "the eight and the ground level by level");
  const kinds = list.pages.map((p) => placeInspect(w, s.ref, p.ref)?.kind);
  assert.deepEqual(kinds, [
    "below",
    "levels",
    "legends",
    "gate",
    "bound",
    "faith",
    "making",
    "civic",
    "beasts",
  ]);
});

test("the game's words: each in one plain line, A to Z, opened at any; a help page names a few it uses (U6)", () => {
  assert.equal(helpTopic("glossary"), "glossary");
  assert.ok(GLOSSARY.length >= 25, `${GLOSSARY.length} words`);
  assert.equal(new Set(GLOSSARY.map((g) => g.key)).size, GLOSSARY.length, "each its own key");
  for (const g of GLOSSARY) {
    assert.ok(
      g.word.length >= 3 && g.line.length > 20 && g.line.length <= 170,
      `${g.word}: one plain line`,
    );
    assert.ok(!/[\r\n]/.test(g.line), `${g.word}: one line`);
  }
  // (The words a player meets on the town's pages, each there.)
  for (const word of [
    "full",
    "priorities",
    "bills",
    "drafted",
    "bound",
    "head",
    "lot",
    "townpages",
    "overlay",
    "mood",
    "needs",
  ])
    assert.ok(
      GLOSSARY.some((g) => g.key === word),
      `${word} in the glossary`,
    );
  const town = "town:x",
    x = placeHelp(town, "glossary");
  assert.equal(x.kind, "help");
  assert.equal(x.ref, placeHelpRef(town, "glossary"));
  assert.equal(x.words?.length, GLOSSARY.length);
  const words = x.words!.map((w) => w.word);
  assert.deepEqual(
    words,
    [...words].sort((a, b) => a.localeCompare(b)),
    "A to Z",
  );
  assert.equal(x.lit, null);
  // (Opened at a word: that word lit, and its ref the one asked by; a word it has not, opened at none.)
  const at = placeHelp(town, "glossary#bills");
  assert.equal(at.lit, "bills");
  assert.equal(at.ref, placeHelpRef(town, "glossary#bills"));
  assert.equal(placeHelp(town, "glossary#nothing").lit, null);
  // (A help page names a few of the words it uses, each one of the glossary's, three at most; the glossary none.)
  let named = 0;
  for (const topic of Object.keys(HELP)) {
    const h = placeHelp(town, topic);
    assert.ok((h.glossed ?? []).length <= 3, `${topic}: kept light`);
    for (const g of h.glossed ?? [])
      assert.ok(GLOSSARY.some((q) => q.key === g.key && q.word === g.word));
    named += (h.glossed ?? []).length;
  }
  assert.equal(placeHelp(town, "glossary").glossed, undefined);
  assert.ok(
    placeHelp(town, "sheet:work").glossed?.some((g) => g.key === "priorities"),
    "Work names priorities",
  );
  assert.ok(named > 10, `words named across the help pages: ${named}`);
});
