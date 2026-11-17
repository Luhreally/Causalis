// A realm's Culture tab read as a life (2026-11-16): its portrait, what is striking about it against its world, a day, how its food
// tastes, its music and customs, its words, feasts, works and years. Every line must be backed by what the world keeps, and a realm
// with nothing kept gets a short page, never empty blocks. One small world of forty years, its blocks built by name.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Block, Line } from "../../src/bridge/index.ts";
import { kindName, languagesOf, politiesOf, type Polity } from "../../src/sim/index.ts";
import { theirLifeBlocks, realmCultureBlocks } from "../../src/host/inspect/folkways.ts";
import { worldLives, lifeOf } from "../../src/host/inspect/lifeways.ts";
import {
  MOST_FACTS,
  TIMELINE_MOST,
  didYouKnowBlock,
  portraitBlock,
  timelineBlock,
  wordsBlock,
  workDays,
} from "../../src/host/inspect/theirlife.ts";
import { musicBlocks, musicOf, musicVoice } from "../../src/host/inspect/customs.ts";
import { firstsNow } from "../../src/host/inspect/alerts.ts";
import { realmPageModel } from "../../src/host/inspect/realm.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 40, { start: "spread" }),
  realms = [...politiesOf(world).living()],
  said = (line: Line) => line.map((s) => (typeof s === "string" ? s : s.text)).join("");

/** A block with nothing in it. */
function empty(b: Block): boolean {
  return (
    (b.type === "facts" && !b.rows.length) ||
    (b.type === "list" && !b.items.length) ||
    (b.type === "text" && (!b.lines.length || b.lines.every((l) => !said(l).trim())))
  );
}

test("every realm's Culture tab reads its life, with no empty block, and its page keeps the tab", () => {
  assert.ok(realms.length >= 3, "a world of several realms");
  for (const r of realms) {
    const blocks = theirLifeBlocks(world, r);
    assert.ok(blocks.length >= 6, `${r.ref} reads its life`);
    for (const b of blocks) assert.ok(!empty(b), `${r.ref}: an empty ${b.type}`);
    const titles = blocks.map((b) => ("title" in b ? b.title : undefined));
    assert.ok(titles.includes("Their life") && titles.includes("Their customs"), r.ref);
  }
  const page = realmPageModel(world, realms[0]!.ref, new Set(["culture"]));
  assert.ok(page.tabs.some((t) => t.id === "culture" && t.blocks.length > 6));
});

test("the portrait's numbers are its realm's own", () => {
  for (const r of realms) {
    const l = lifeOf(world, r),
      p = portraitBlock(world, r);
    if (!p || p.type !== "text" || !l.rest) continue;
    const words = said(p.lines[0]!);
    assert.ok(
      words.includes(`They work ${workDays(l.rest.holy, l.rest.feasts)} days a year`),
      `${r.ref}: ${words}`,
    );
    assert.ok(words.includes(`${l.rest.hours.toFixed(1)} hours a day`), r.ref);
    if (l.faith) assert.ok(words.includes(l.faith.name), r.ref);
  }
});

test("each fun fact is backed: a realm said to have the most has the most, the only realm is the only one", () => {
  const lives = [...worldLives(world).values()];
  let told = 0;
  for (const r of realms) {
    const b = didYouKnowBlock(world, r);
    if (!b) continue;
    assert.equal(b.type, "list");
    if (b.type !== "list") continue;
    assert.ok(b.items.length <= MOST_FACTS);
    const l = lifeOf(world, r),
      others = lives.filter((x) => x.r.ref !== r.ref);
    for (const it of b.items) {
      told++;
      assert.ok(it.ref, `${r.ref}: a fact opens its page`);
      const words = said(it.line);
      if (words.includes("The most feast days of any realm"))
        assert.ok(
          others.every((x) => (x.rest?.feasts ?? -1) < l.rest!.feasts),
          words,
        );
      if (words.includes("The fewest feast days of any realm"))
        assert.ok(
          others.every((x) => (x.rest?.feasts ?? Infinity) > l.rest!.feasts),
          words,
        );
      if (words.includes("The longest-reigning ruler of any realm")) {
        assert.ok(words.includes(r.ruler.name), words);
        assert.ok(
          others.every((x) => x.r.ruler.since > r.ruler.since),
          words,
        );
      }
      if (words.includes("The oldest ruling house of any realm"))
        assert.ok(
          others.every((x) => !x.crown || x.crown.since > l.crown!.since),
          words,
        );
      if (words.includes("More works kept than any other realm"))
        assert.ok(
          others.every((x) => (x.art?.works ?? 0) < l.art!.works),
          words,
        );
      const only = /The only realm with an? (.+?): /.exec(words);
      if (only) {
        const kind = only[1]!,
          holders = lives.filter((x) => x.groups.some((g) => kindName(g) === kind));
        assert.deepEqual(
          holders.map((x) => x.r.ref),
          [r.ref],
          words,
        );
      }
      if (words.startsWith("🥇 First in all the world")) {
        const f = firstsNow(world).find((x) => x.ref === it.ref);
        assert.ok(f && f.land !== null && r.members.includes(f.land), words);
      }
      // (Its middle is the world's: said in every comparison.)
      if (/^\S+ The (most|fewest|longest|shortest|oldest)/.test(words))
        assert.ok(words.includes("(the middle"), words);
    }
  }
  assert.ok(told > 0, "some realm of the world has something striking about it");
});

test("their words are their tongue's, the same each time; their years run oldest first and are bounded", () => {
  for (const r of realms.slice(0, 8)) {
    const a = wordsBlock(world, r),
      b = wordsBlock(world, r);
    assert.deepEqual(a, b);
    if (a?.type === "facts") {
      const tongue = languagesOf(world).of(r.seat)!;
      assert.equal(said(a.rows[0]!.value), tongue.name);
    }
    const t = timelineBlock(world, r);
    assert.ok(t && t.type === "list");
    if (t?.type !== "list") continue;
    assert.ok(t.items.length <= TIMELINE_MOST);
    const years = t.items.map((x) => x.year!);
    assert.deepEqual(
      years,
      [...years].sort((x, y) => x - y),
    );
    assert.ok(years.every((y) => y >= 0 && y <= 40));
  }
});

test("their music is read from their sense, land and ways, and played the same each time", () => {
  const r = realms[0]!,
    mu = musicOf(world, r)!;
  assert.ok(mu);
  // (Earth's upright apes hear: their music is sound, and it is played.)
  assert.equal(mu.heard, true);
  const blocks = musicBlocks(world, r);
  assert.ok(blocks.some((b) => b.type === "tool" && b.tool === "culture.music"));
  const v = musicVoice(r, mu),
    again = musicVoice(r, musicOf(world, r)!);
  assert.deepEqual(v, again);
  assert.ok(v.tempo >= 60 && v.tempo <= 140);
  assert.ok(v.scale.length >= 5);
  for (const i of mu.instruments)
    assert.ok(i.from.length > 0, `${i.what} says what it is read from`);
});

test("a realm with nothing kept of its people gets a short honest page, not empty blocks", () => {
  const r = realms[0]!,
    // (A realm whose lands hold no one now: none of its people's rows are read.)
    bare: Polity = { ...r, ref: "pol:0:9999" as Polity["ref"], members: [] };
  const l = lifeOf(world, bare);
  assert.equal(l.people, 0);
  assert.equal(l.table, null);
  assert.equal(l.rest, null);
  const blocks = theirLifeBlocks(world, bare);
  for (const b of blocks) assert.ok(!empty(b), `an empty ${b.type}`);
  const titles = blocks.map((b) => ("title" in b ? b.title : ""));
  for (const none of [
    "Their life",
    "Did you know?",
    "A day in their life",
    "How their food tastes",
    "Their customs",
  ])
    assert.ok(!titles.includes(none), `${none} left out`);
  assert.ok(blocks.length <= 4, "a short page");
  // (And the whole tab still reads.)
  assert.ok(realmCultureBlocks(world, bare).every((b) => !empty(b)));
});
