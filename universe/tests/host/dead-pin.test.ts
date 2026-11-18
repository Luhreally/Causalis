// One pinned or followed who dies is dead everywhere, at once (asked 2026-11-17: "their tab keeps running their age and acts as
// if they're alive"): every reading the candle, their years stopped at their death, no act of the living offered; and one gone who
// did not die (stood down, on the seat itself) is said to be so, never "died".
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  courtOf,
  deathNotesOf,
  handOf,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import type { BarPerson, PageModel } from "../../src/bridge/index.ts";
import { barOf } from "../../src/host/bar.ts";
import { courtRef } from "../../src/host/court.ts";
import { townRoster } from "../../src/host/roster.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { fateOf } from "../../src/host/inspect/barread.ts";
import { universeWorld } from "./worlds.ts";

type W = ReturnType<typeof universeWorld>;
const chipOf = (world: W, ref: string, name?: string): BarPerson =>
  barOf(world, {
    cell: null,
    town: null,
    pins: [{ ref, name: name ?? pageOf(world, ref, undefined, true).title }],
    followed: [],
  }).people[0]!;
const allGone = (p: BarPerson) =>
  [p.readings.mood, p.readings.doing, p.readings.health].every(
    (r) => r.glyph === "🕯️" && r.short === "gone",
  );
const ageOf = (page: PageModel) =>
  page.stats
    .find((s) => s.label === "Age")
    ?.value.map((x) => (typeof x === "string" ? x : x.text))
    .join("");
const toolsOf = (page: PageModel) =>
  page.tabs.flatMap((t) => t.blocks).flatMap((b) => (b.type === "tool" ? [b.tool] : []));
const titlesOf = (page: PageModel) =>
  page.tabs.flatMap((t) => t.blocks).flatMap((b) => ("title" in b && b.title ? [b.title] : []));

/** One dead, checked: the chip, the page, and that nothing of it moves as the years go on. */
function deadEverywhere(world: W, ref: string, name?: string): void {
  const chip = chipOf(world, ref, name);
  assert.ok(chip.gone && chip.pinned, `${ref}: gone, and still kept`);
  assert.ok(allGone(chip), `${ref}: every reading the candle: ${JSON.stringify(chip.readings)}`);
  assert.match(chip.why, /^Died: /, `${ref}: ${chip.why}`);
  assert.ok(chip.died, `${ref}: how they died, in a line`);
  const page = pageOf(world, chip.ref);
  assert.ok(!toolsOf(page).includes("acts.god-person"), `${ref}: no act of the living`);
  assert.ok(
    titlesOf(page).includes("How they died"),
    `${ref}: the path of their death on their page`,
  );
}

test("one of a court who died, and one of a town's line who died, are dead in every reading; their years stop", () => {
  const world = universeWorld(EARTH, "first light", 100),
    ctx = populationContext(world);
  let courts = 0;
  for (const r of politiesOf(world).all())
    for (const g of courtOf(world)?.of(r.ref)?.gone ?? []) {
      if (g.how !== "died" || courts >= 3) continue;
      deadEverywhere(world, courtRef(r.ref, g.id));
      courts++;
    }
  assert.ok(courts > 0);
  // A line's holder before the one who holds it now.
  let held: string | null = null;
  for (const p of ctx.provinces.all())
    for (const t of ctx.settlements.seenIn(p.cell)) {
      if (held || t.population < 40) continue;
      const roster = townRoster(world, t.ref);
      for (let l = 0; l < 30 && !held; l++) {
        const now = roster.holder(l);
        for (let i = 0; i < 4 && !held; i++) {
          const h = roster.holderOf(l, i);
          if (h && now && h.ref !== now.ref && fateOf(world, h.ref, pageOf(world, h.ref))?.dead)
            held = h.ref;
        }
      }
    }
  assert.ok(held, "a holder dead");
  deadEverywhere(world, held);
  const age = ageOf(pageOf(world, held));
  assert.match(age ?? "", /^died at \d+, year -?\d+$/);
  world.runTo(105 * YEAR);
  assert.equal(ageOf(pageOf(world, held)), age, "five years on, the dead are no older");
  assert.ok(allGone(chipOf(world, held)));
});

test("one who left a court and lives is gone, and not said to have died", () => {
  const world = universeWorld(EARTH, "first light", 100);
  let seen = 0;
  for (const r of politiesOf(world).all())
    for (const g of courtOf(world)?.of(r.ref)?.gone ?? []) {
      if (g.how === "died" || seen >= 4) continue;
      const chip = chipOf(world, courtRef(r.ref, g.id));
      assert.ok(chip.gone && allGone(chip));
      assert.equal(chip.died, undefined, `${g.how}: no death told`);
      assert.match(chip.why, /not dead, as far as history says/);
      seen++;
    }
  assert.ok(seen > 0);
});

test("a group's head kept on the bar, gone: how they went, under the pin that kept them", () => {
  const world = universeWorld(EARTH, "first light", 100),
    notes = deathNotesOf(world)!;
  let told = 0;
  for (const r of politiesOf(world).living()) {
    if (told) break;
    for (const ref of new Set(
      world.events
        .all()
        .filter((e) => e.type.endsWith(".leader") && e.subjects.includes(r.ref))
        .flatMap((e) =>
          e.causes.filter((c) => c.role === "enabler").map((c) => `boss:${r.ref}:${c.ref}`),
        ),
    )) {
      const n = notes.headsOf(ref).find((x) => x.how !== "taken");
      if (!n) continue;
      const chip = chipOf(world, ref, n.name);
      assert.ok(chip.key.startsWith(`${ref}|`), "taken off the bar by the pin it was kept by");
      assert.ok(chip.gone && allGone(chip));
      assert.match(chip.why, /^Died: /);
      told++;
      break;
    }
  }
  assert.ok(told > 0, "a head of a group gone");
});

test("one under the hand who dies: the candle in every reading at once, no acts, and no older a year on", () => {
  const world = universeWorld(EARTH, "first light", 60),
    ctx = populationContext(world),
    v = ctx.provinces
      .all()
      .flatMap((p) => [...ctx.settlements.seenIn(p.cell)])
      .filter((x) => x.population > 20)
      .sort((a, b) => a.population - b.population)[0]!;
  world.submit("hand.lay", { village: v.ref });
  world.runTo(60 * YEAR + 1);
  const a = handOf(world).resting!.agents[0]!,
    ref = `agent:${a.id}`,
    name = pageOf(world, ref, undefined, true).title,
    living = chipOf(world, ref, name);
  assert.ok(!living.gone && !allGone(living), "living, they read as the living");
  // Struck down: dead at that moment.
  world.submit("act.person", { ref, kind: "smite", name });
  world.runTo(60 * YEAR + 2);
  deadEverywhere(world, ref, name);
  const age = ageOf(pageOf(world, ref));
  assert.match(age ?? "", /^died at \d+/);
  world.runTo(62 * YEAR);
  assert.equal(ageOf(pageOf(world, ref)), age);
  // (And the same read from a save taken up again: still gone.)
  assert.ok(chipOf(world, ref, name).gone);
});
