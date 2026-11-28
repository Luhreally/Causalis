// What each of the town mode's sheets, tabs and pages is, in plain words (town mode, G2): every sheet at the foot, every
// tab of a person's page and every kind of page has its own, each saying what it is; a page of the inspector's, read as
// any is, its ref the one it is asked by; and words of no number, the same for every town.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HELP, helpTopic } from "../../src/host/placehelp.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeHelpRef, type PlaceInspectHelp } from "../../src/bridge/index.ts";
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
});
