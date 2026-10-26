import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { NO_LOOK, type Block, type PageModel, type Wound } from "../../src/bridge/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { healerOf } from "../../src/host/village.ts";
import { townWounded, woundedTowns } from "../../src/host/wounds.ts";
import {
  healerPage,
  healerRef,
  lookOf,
  woundBlock,
  woundedTab,
} from "../../src/host/inspect/wounds.ts";

// Phase 55 M226, M229 (T41): wounds told — a person's, a town's wounded, its healer's page. On the
// Earth seed at 125 years and twenty days, the levy of the year's turn home and abed.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const Y = Math.floor(world.now / YEAR);
world.runTo(Y * YEAR + 20 * DAY);
const before = JSON.stringify(world.domainHashes());
const ctx = populationContext(world),
  towns = ctx.settlements.all(),
  healed = towns.filter((s) => healerOf(world, s, Y) !== null),
  hurt = [
    ...new Set([...woundedTowns(world, 20).map((r) => r.ref), ...healed.map((s) => s.ref)]),
  ].filter((ref) => townWounded(world, ref).length > 0);
const words = (b: Block | null | undefined): string[] =>
  !b
    ? []
    : b.type === "list"
      ? b.items.map((i) => i.line.map((x) => (typeof x === "string" ? x : x.text)).join(""))
      : b.type === "text"
        ? b.lines.map((l) => l.map((x) => (typeof x === "string" ? x : x.text)).join(""))
        : b.type === "facts"
          ? b.rows.map(
              (r) =>
                `${r.label}: ${r.value.map((x) => (typeof x === "string" ? x : x.text)).join("")}`,
            )
          : [];
const pageWords = (p: PageModel) => p.tabs.flatMap((t) => t.blocks.flatMap(words));

test("a healer's page: who, how long, what the craft knows, whom they tend", () => {
  assert.ok(healed.length >= 1, "no land knows herb-lore at 125 years");
  for (const s of healed.slice(0, 4)) {
    const h = healerOf(world, s, Y)!,
      page = healerPage(world, healerRef(s.ref)),
      all = pageWords(page).join(" | ");
    assert.equal(page.kind, "person");
    assert.equal(page.title, h.name);
    assert.ok(all.includes("Binds wounds with linen"), all);
    assert.ok(all.includes(`At it: ${h.years}`), all);
    assert.deepEqual(page.place, { scale: "village", town: s.ref });
  }
  const none = towns.find((s) => healerOf(world, s, Y) === null)!;
  assert.equal(healerPage(world, healerRef(none.ref)).kind, "unknown");
  assert.equal(healerPage(world, "heal:town:0:99999999").kind, "unknown");
});

test("a town's wounded: those healing now and those marked for good, and its healer", () => {
  assert.ok(hurt.length >= 1, "no town with wounded twenty days on");
  for (const ref of hurt.slice(0, 6)) {
    const s = ctx.settlements.get(ref as Ref)!,
      tab = woundedTab(world, s.ref)!,
      list = townWounded(world, s.ref),
      facts = tab.blocks.find((b) => b.type === "facts"),
      healing = tab.blocks.find((b) => b.type === "list" && b.title === "Healing now"),
      marked = tab.blocks.find((b) => b.type === "list" && b.title === "Marked for good"),
      n = (b: Block | undefined) => (b?.type === "list" ? b.items.length : 0);
    assert.equal(tab.id, "wounded");
    assert.equal(n(healing) + n(marked), list.length);
    const refs = [healing, marked].flatMap((b) =>
      b?.type === "list" ? b.items.map((i) => i.ref) : [],
    );
    assert.deepEqual([...refs].sort(), list.map((w) => w.ref).sort());
    const healerRow = words(facts).find((w) => w.startsWith("Healer: "))!,
      h = healerOf(world, s, Y);
    assert.ok(
      h ? healerRow === `Healer: ${h.name}` : healerRow.includes("no herb-lore"),
      healerRow,
    );
  }
});

test("their wounds told: how one is now, then each, opening what dealt it", () => {
  const w: Wound = townWounded(world, hurt[0]!)[0]!.wounds[0]!,
    t = world.now,
    b = woundBlock([w], 1, t)!;
  assert.equal(b.type, "list");
  if (b.type !== "list") return;
  assert.equal(b.title, "Their wounds");
  const last = b.items.at(-1)!;
  assert.equal(last.ref, w.event);
  const healing = w.at <= t && t < w.mended;
  assert.equal(b.items.length, healing ? 2 : 1);
  if (healing) assert.ok(words(b)[0]!.startsWith("Now: "), words(b)[0]);
  assert.equal(woundBlock([{ ...w, at: t + 1 }], 1, t), null);
  assert.deepEqual(lookOf([], t), {});
  assert.deepEqual(lookOf([{ ...w, at: t + 1 }], t), {});
  const l = lookOf([w], t).look;
  assert.ok(!l || l !== NO_LOOK);
});

test("no history moved by the pages", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
