import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { landStone } from "../../src/host/chain.ts";
import { METALS, ORES, SUBSTANCE, SUBSTANCES } from "../../src/rules/index.ts";
import { populationContext, toolMetal } from "../../src/sim/index.ts";
import { dayTold, furnaceOf, rackNow, townDay, villageSolids } from "../../src/view/index.ts";
import type { Line, PageModel, VillagePlan } from "../../src/bridge/index.ts";

// Phase 51 M213: things seen being made — the furnace by the diggings where a town smelts its own
// ore, the copper carried to the yard and from it to the forge, and the day's tools hung on the
// rack before the smithy, each tapped to its page and traced from the ground to the rack. The
// first light's world at 300: its towns work copper, some of their own ore.
const world = EARTH.build(seedFromText("first light"));
world.runTo(300 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const DAY = 86_400,
  HOUR = 3_600;
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const refsOf = (lines: readonly Line[]): string[] =>
  lines.flatMap((l) => l.flatMap((s) => (typeof s === "string" || !s.ref ? [] : [s.ref])));
const plans = ask<{ ref: string }[]>("towns.map")
  .slice(0, 40)
  .map((t) => ask<VillagePlan>("village.plan", { ref: t.ref, folk: 220 }));
// The greatest town that digs its own copper ore and smelts it.
const smelting = plans.find((p) => p.works?.mine?.what === "ore" && p.stuff?.ore)!;
const days = Array.from({ length: 8 }, (_, d) => 300 * 365 + 120 + d);

test("a town that digs its own ore smelts it at the furnace by its diggings, its smiths at the forge with the copper", () => {
  assert.ok(smelting, "a town smelting its own ore");
  assert.ok(furnaceOf(smelting.works!.mine), "its furnace stands by its diggings");
  const ground = villageSolids(smelting),
    ore = smelting.stuff!.ore!.name;
  let worked = 0;
  for (const day of days) {
    const roles = townDay(smelting, day, ground).roles,
      smelters = roles.flatMap((r, i) => (r.kind === "smelt" ? [i] : [])),
      smiths = roles.flatMap((r, i) => (r.kind === "smith" ? [i] : [])),
      miners = roles.flatMap((r, i) => (r.kind === "mine" ? [i] : []));
    if (!smiths.length) continue;
    worked++;
    // One of its diggers at the furnace each working day: charged, the bellows worked, the copper drawn.
    assert.equal(smelters.length, 1, `day ${day}: one at the furnace`);
    const told = dayTold(smelting, smelters[0]!, day)
      .map((l) => l.words)
      .join(" | ");
    assert.match(told, new RegExp(`Charging the furnace with ${ore} and charcoal of`), told);
    assert.match(told, /working the bellows/i);
    assert.match(told, /drawing the copper from the furnace/i);
    // Its diggers heap the ore by the furnace, for it.
    for (const i of miners.slice(0, 2))
      assert.match(
        dayTold(smelting, i, day)
          .map((l) => l.words)
          .join(" | "),
        /heaping it by the furnace/i,
      );
    // Its smiths take copper, not ore, to the forge, and hang what they make on the rack.
    for (const i of smiths.slice(0, 2)) {
      const theirs = dayTold(smelting, i, day)
        .map((l) => l.words)
        .join(" | ");
      // (Their errand told in one line, its steps run on: "Taking copper to melt; casting …".)
      assert.match(theirs, /Taking copper to melt/, theirs);
      assert.match(theirs, /casting a copper [a-z ]+, hammering its edge hard/i, theirs);
      assert.match(theirs, /hanging the new [a-z ]+ on the rack by /i, theirs);
    }
  }
  assert.ok(worked >= 4, `${worked} working days`);
});

test("the day's tools are hung on the rack as they are made, each one's page tracing it from the ground", () => {
  const ground = villageSolids(smelting),
    day = days.find((d) => townDay(smelting, d, ground).roles.some((r) => r.kind === "smith"))!,
    at = (h: number) => rackNow(smelting, ground, day * DAY + h * HOUR)!;
  assert.equal(at(5).hung.length, 0, "nothing on it before the day's work");
  assert.ok(at(11).hung.length > 0, "tools on it by the late morning");
  assert.ok(at(16).hung.length >= at(11).hung.length, "more as the day goes");
  const roles = townDay(smelting, day, ground).roles;
  for (const h of at(16).hung) {
    assert.equal(roles[h.index]!.kind, "smith", "hung by one at the forge today");
    const p = smelting.people[h.index]!,
      page = ask<PageModel>("page", {
        ref: `made:${smelting.ref}:${day}:smith:${p.trade!.seat}:${h.n}:${h.form}`,
      }),
      blocks = page.tabs.flatMap((t) => t.blocks),
      facts = blocks.find((b) => b.type === "facts"),
      chain = blocks.find((b) => b.type === "list" && b.title === "From the ground to the rack");
    assert.equal(page.title, `A copper ${h.form}`);
    // Made by the very smith who hung it, at their trade so many years.
    assert.ok(facts?.type === "facts");
    const by = facts.rows.find((r) => r.label === "By")!;
    assert.ok(
      words(typeof by.value === "string" ? [by.value] : by.value).startsWith(
        `${p.name}, a smith of`,
      ),
      `${p.name} made it`,
    );
    assert.ok(chain?.type === "list");
    const refs = refsOf(chain.items.map((i) => i.line));
    assert.ok(
      refs.some((r) => r.startsWith("subst:")),
      "its ore's page",
    );
    assert.ok(
      refs.some((r) => r.startsWith("rxn:")),
      "its smelting's page",
    );
  }
  // Cleared overnight, taken to market.
  assert.equal(rackNow(smelting, ground, (day + 1) * DAY + 5 * HOUR)!.hung.length, 0);
});

test("a town's tools and ore are drawn in their own stuff, and a smithy with nothing forged stands idle", () => {
  const ctx = populationContext(world);
  for (const p of plans) {
    const s = p.stuff!,
      // (Its tools are headed with what its land's crafters made most of; its smiths forge the
      // best metal any were headed with — Phase 52 M217.)
      tools = toolMetal(ctx, p.cell!);
    if (tools === "stone")
      assert.deepEqual(
        s.tool.colour,
        landStone(world, p.cell!).stone.colour,
        `${p.name}: its stone`,
      );
    else
      assert.deepEqual(
        s.tool.colour,
        METALS[tools as keyof typeof METALS].colour,
        `${p.name}: its ${tools}`,
      );
    if (p.metal === "stone") assert.equal(s.metal, null, `${p.name}: its smiths forge nothing`);
    else
      assert.deepEqual(
        s.metal?.colour,
        METALS[p.metal as keyof typeof METALS].colour,
        `${p.name}: its smiths forge ${p.metal}`,
      );
    // Its own ore (copper's, or since Phase 52 tin's or iron's) in its mineral's colour.
    if (s.ore) {
      const ore = Object.values(ORES[s.ore.yields ?? "copper"] ?? {}).find(
        (o) => o.name === s.ore!.name,
      );
      assert.ok(ore, `${p.name}: ${s.ore.name} an ore of ${s.ore.yields}`);
      assert.deepEqual(s.ore.colour, SUBSTANCES[SUBSTANCE[ore.mineral]!]!.colour, s.ore.name);
    }
  }
  // Its smiths named, but nothing forged in its land this year: none at the anvil.
  const idle = plans.find(
    (p) => p.metal === "stone" && p.people.some((x) => x.trade?.kind === "smith"),
  );
  assert.ok(idle, "a town keeping smiths with nothing forged");
  const ground = villageSolids(idle);
  for (const day of days)
    assert.ok(
      !townDay(idle, day, ground).roles.some((r) => r.kind === "smith"),
      `${idle.name}: no one forging on day ${day}`,
    );
});
