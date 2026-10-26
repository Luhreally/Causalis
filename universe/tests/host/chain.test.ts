import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  designsOf,
  politiesOf,
  populationContext,
  toolMetal,
  townsOf,
} from "../../src/sim/index.ts";
import { bedrockOf } from "../../src/host/inspect/ground.ts";
import {
  hostWords,
  landStone,
  makerAt,
  seatsOf,
  toolMade,
  type Made,
} from "../../src/host/chain.ts";
import { STONES } from "../../src/rules/index.ts";
import { townDay, villageSolids } from "../../src/view/index.ts";
import type { Block, Line, PageModel, VillagePlan } from "../../src/bridge/index.ts";

// Phase 50 M212: the chain from the ground to a thing — every made thing made by someone, of what
// its land holds (or its road brings), traced from where it was dug to who made it and where. The
// first light's world at 700: its towns work copper, bronze, iron and steel.
const world = EARTH.build(seedFromText("first light"));
world.runTo(700 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });
const ctx = populationContext(world),
  now = 700,
  lands = [...ask<{ cell: number; people: number }[]>("people.map")].sort(
    (a, b) => b.people - a.people,
  );
const refsOf = (lines: readonly Line[]): string[] =>
  lines.flatMap((l) => l.flatMap((s) => (typeof s === "string" || !s.ref ? [] : [s.ref])));
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const lists = (p: PageModel) =>
  p.tabs
    .flatMap((t) => t.blocks)
    .filter((b): b is Extract<Block, { type: "list" }> => b.type === "list");

test("a land's stone is the keenest its own rocks give, and its stone tools are named for it", () => {
  for (const { cell } of lands.slice(0, 12)) {
    const { rock, stone } = landStone(world, cell),
      rocks = bedrockOf(world, cell).flatMap(([r, k]) => (k >= 0.04 ? [r] : []));
    assert.ok(rocks.includes(rock), `${rock} is one of its land's rocks`);
    for (const r of rocks) assert.ok((STONES[r]?.keen ?? 0) <= stone.keen, `${r} no keener`);
    // (In its first years, before any metal: its tools of its own stone.)
    const made = toolMade(world, cell, `test:${cell}`, 1, false);
    assert.equal(made.stuff, stone.name);
    assert.match(words(made.chain[0]!), new RegExp(`^${stone.name}`, "i"));
    assert.match(words(made.chain.at(-1)!), /^Knapped to an edge and hafted by .+, a knapper/);
  }
});

test("a metal tool traced from the ground: its ore, its smelting, the smithy and the smith who made it", () => {
  const seen = new Set<string>();
  for (const { cell } of lands) {
    const metal = toolMetal(ctx, cell);
    if (metal === "stone" || seen.has(metal)) continue;
    seen.add(metal);
    const made: Made = toolMade(world, cell, `test:${cell}`, now, false),
      refs = refsOf(made.chain);
    assert.equal(made.stuff, metal);
    assert.ok(made.quality >= 5 && made.quality <= 99);
    assert.ok(["rough", "plain", "good", "fine", "masterly"].includes(made.grade));
    // Dug: the ore's mineral, its page; smelted: the reaction's page.
    assert.ok(
      refs.some((r) => r.startsWith("subst:")),
      `${metal}: its ore's page — ${made.chain.map(words).join(" | ")}`,
    );
    assert.ok(
      refs.some((r) => r.startsWith("rxn:")),
      `${metal}: its smelting's page`,
    );
    // Worked: by a smith named, so many years at it, at the smithy where one stands.
    assert.ok(made.maker && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(made.maker.name), made.maker?.name);
    assert.match(words(made.chain.at(-1)!), / at .+ by .+, (a smith|a hand at the works) /);
    if (made.workshop.ref) assert.ok(refs.includes(made.workshop.ref), "its smithy linked");
    if (metal === "bronze")
      assert.ok(
        made.chain.some((l) => /tin/i.test(words(l))),
        "bronze names its tin",
      );
  }
  assert.ok(seen.size >= 2, `metals met: ${[...seen].join(", ")}`);
  // Better stuff, better things: steel's edge over copper's.
  const of = (m: "copper" | "steel") =>
    lands.find((l) => toolMetal(ctx, l.cell) === m)?.cell ?? null;
  const copper = of("copper"),
    steel = of("steel");
  if (copper !== null && steel !== null)
    assert.ok(
      toolMade(world, steel, "q", now, false).edge.keen >
        toolMade(world, copper, "q", now, false).edge.keen,
    );
});

test("every link along a thing's chain, a realm's arms and a workshop opens a page", () => {
  const refs = new Set<string>();
  for (const { cell } of lands.slice(0, 20))
    for (const r of refsOf(toolMade(world, cell, `links:${cell}`, now, false).chain)) refs.add(r);
  for (const p of politiesOf(world)
    .all()
    .filter((r) => r.ended === null)
    .slice(0, 12)) {
    const d = designsOf(world).of(p.ref);
    if (!d) continue;
    for (const l of lists(page(d.ref)))
      for (const i of l.items) for (const r of refsOf([i.line])) refs.add(r);
  }
  assert.ok(refs.size > 20, `${refs.size} links`);
  for (const r of refs) assert.notEqual(page(r).kind, "unknown", `${r} opens a page`);
});

test("a town's makers are named, kept at their trades, and the ones its buildings' pages name", () => {
  // The most peopled land's first town that keeps a smithy.
  const town = lands
    .flatMap((l) => ctx.settlements.inProvince(l.cell))
    .find((s) =>
      townsOf(world)
        .get(s.ref)
        ?.civics.some((c) => c.kind === "smithy" && c.fell === null && c.end <= now),
    );
  assert.ok(town, "a town with a smithy");
  const plan = ask<VillagePlan>("village.plan", { ref: town.ref, folk: 240 }),
    folk = plan.people.filter((p) => p.folk),
    smiths = plan.people.filter((p) => p.trade?.kind === "smith");
  // Every one of its many named in its tongue, not "A crafter of …".
  assert.ok(folk.length > 20);
  for (const p of folk) assert.match(p.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/, p.name);
  // Its smiths: as many as it keeps seats, each who holds that seat this year.
  assert.equal(smiths.length, seatsOf(town));
  for (const p of smiths)
    assert.equal(p.name, makerAt(world, town.cell, town, "smith", p.trade!.seat, now).name);
  // The smithy's page names the same smiths at work there.
  const smithy = townsOf(world)
      .get(town.ref)!
      .civics.find((c) => c.kind === "smithy" && c.fell === null && c.end <= now)!,
    bp = page(`bldg:${town.ref}:${smithy.at}:${smithy.start}`),
    who = lists(bp).find((b) => b.title === "Who works here");
  assert.ok(who, "who works at the smithy");
  for (const p of smiths)
    assert.ok(
      who.items.some((i) => words(i.line).startsWith(`${p.name}, a smith of`)),
      `${p.name} on the smithy's page`,
    );
  // A thing made there this year: one of them made it.
  const here = lists(bp).find((b) => b.title?.startsWith("Made here this year"));
  assert.ok(here, "a thing made at the smithy this year");
  assert.ok(smiths.some((p) => here.items.some((i) => words(i.line).includes(p.name))));
  // On working days with ore in, its smiths are at the forge; its potters, at the kilns.
  const ground = villageSolids(plan);
  let forging = 0;
  for (let day = now * 365 + 120; day < now * 365 + 140; day++) {
    const roles = townDay(plan, day, ground).roles;
    plan.people.forEach((p, i) => {
      if (p.trade?.kind === "smith" && roles[i]!.kind === "smith") forging++;
      if (p.trade?.kind === "potter" && roles[i]!.kind !== "as-ever")
        assert.ok(["kiln", "forage"].includes(roles[i]!.kind), `a potter at ${roles[i]!.kind}`);
    });
  }
  assert.ok(forging > 0, "its smiths at the forge on some day of twenty");
});

test("a realm's arms in its own land's stone, or traced from its ore to its smithy", () => {
  let stone = 0,
    metal = 0;
  for (const p of politiesOf(world)
    .all()
    .filter((r) => r.ended === null)) {
    const d = designsOf(world).of(p.ref),
      arm = d?.parts.find((x) => x.role === "arm");
    if (!d || !arm) continue;
    const said = hostWords(world, p.ref, d.parts),
      chain = lists(page(d.ref)).find((b) =>
        /: (rough|plain|good|fine|masterly) \(\d+ of 100\)$/.test(b.title ?? ""),
      );
    if (arm.material === "stone") {
      const s = landStone(world, p.seat).stone.name;
      assert.ok(said.startsWith(`${s}-tipped`), `${said}: of ${s}`);
      assert.ok(chain && words(chain.items[0]!.line).toLowerCase().startsWith(s));
      stone++;
    } else if (["copper", "bronze", "iron", "steel"].includes(arm.material)) {
      assert.ok(chain, `${said}: its chain`);
      const refs = refsOf(chain.items.map((i) => i.line));
      assert.ok(
        refs.some((r) => r.startsWith("rxn:")),
        `${said}: smelted`,
      );
      assert.match(words(chain.items.at(-1)!.line), / by .+, a (smith|hand at the works) of /);
      metal++;
    }
  }
  assert.ok(stone + metal > 4, `${stone} of stone, ${metal} of metal`);
});
