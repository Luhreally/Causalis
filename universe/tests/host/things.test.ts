import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { politiesOf, populationContext } from "../../src/sim/index.ts";
import type { Block, PageModel } from "../../src/bridge/index.ts";

// Phase 15 M125: a household's and a person's things, watched. The first light's world at 300,
// families met in its most peopled land's first towns.
const world = EARTH.build(seedFromText("first light"));
world.runTo(300 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });
const blocks = (p: PageModel, tab: string) => p.tabs.find((t) => t.id === tab)?.blocks ?? [];
const of = <K extends Block["type"]>(list: readonly Block[], type: K) =>
  list.filter((b): b is Extract<Block, { type: K }> => b.type === type);
const map = ask<{ cell: number; people: number }[]>("people.map"),
  land = [...map].sort((a, b) => b.people - a.people)[0]!,
  towns = populationContext(world).settlements.inProvince(land.cell).slice(0, 4);
const met = towns.flatMap((t) =>
  [0, 1, 2].map(() =>
    ask<{ ref: string; members: { ref: string }[] }>("observe.meet", {
      cell: land.cell,
      village: t.ref,
    }),
  ),
);

test("a household's things: its pots, each of its people's things, what they are made of, its food", () => {
  const h = met[0]!,
    p = page(h.ref),
    things = blocks(p, "things");
  const keeps = of(things, "list").find((b) => b.title === "What it keeps")!;
  assert.ok(keeps.items.length >= 1, "a pot at least");
  assert.ok(keeps.items.every((i) => i.ref?.startsWith(`thing:${h.ref}:pot`)));
  const food = of(things, "composition").find((b) => b.title === "Its store of food");
  assert.ok(
    food && food.parts.some((x) => String((x.name[0] as { text: string }).text) === "starch"),
  );
  assert.match(food!.note ?? "", /months of food for its \d+/);
});

test("a worker's tools: made in a year, of the metal their land knew then, worn over their life", () => {
  // A farmer, herder or crafter among those met.
  const ledgerPages = met.flatMap((h) => h.members.map((m) => page(m.ref)));
  const worker = ledgerPages.find((p) =>
    of(blocks(p, "things"), "list").some((b) =>
      b.items.some((i) => /hoe|shears|hammer/.test(String((i.line[0] as { text?: string }).text))),
    ),
  )!;
  assert.ok(worker, "a worker among those met");
  const held = of(blocks(worker, "things"), "list").find((b) => b.title === "What they hold")!,
    tool = held.items.find((i) =>
      /hoe|shears|hammer/.test(String((i.line[0] as { text?: string }).text)),
    )!;
  const t = page(tool.ref!);
  assert.equal(t.kind, "thing");
  const facts = of(blocks(t, "overview"), "facts")[0];
  if (facts) {
    const made = Number(String(facts.rows.find((r) => r.label === "In the year")!.value));
    assert.ok(made <= 300 && made > 300 - 20, `made in year ${made}`);
    assert.match(
      String(facts.rows.find((r) => r.label === "Worn")!.value),
      /^\d+% \(\d+ of its \d+ years\)$/,
    );
    const makeup = of(blocks(t, "overview"), "composition")[0]!;
    assert.ok(Math.abs(makeup.parts.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
    assert.ok(
      makeup.parts.some((x) => String((x.name[0] as { text: string }).text) === "wood fibre"),
    );
  } else
    assert.match(String(of(blocks(t, "overview"), "text")[0]!.lines[0]![0]), /^There is none: /);
  // The same thing, the same page: watched, not drawn anew.
  assert.deepEqual(page(tool.ref!), t);
});

test("a person: what they eat in a day, against their need; what their body is made of", () => {
  const p = page(met[0]!.members[0]!.ref),
    things = blocks(p, "things"),
    parts = of(things, "composition");
  const day = parts.find((b) => b.title === "What they eat in a day")!;
  assert.match(day.note ?? "", /about [\d,]+ kcal, against the [\d,]+ kcal a body of/);
  const body = parts.find((b) => b.title === "What their body is made of")!;
  assert.ok(Math.abs(body.parts.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
  assert.ok(body.parts[0]!.share > 0.5, "mostly water");
});

test("every link on a household's and its people's things opens a page", () => {
  const refs = new Set<string>();
  const walk = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (typeof o.ref === "string") refs.add(o.ref);
      Object.values(o).forEach(walk);
    }
  };
  for (const h of met.slice(0, 3)) {
    walk(blocks(page(h.ref), "things"));
    for (const m of h.members) walk(blocks(page(m.ref), "things"));
  }
  for (const r of [...refs].filter((x) => x.startsWith("thing:"))) walk(page(r).tabs);
  assert.ok(refs.size > 10);
  for (const r of refs) assert.notEqual(page(r).kind, "unknown", `${r} opens a page`);
});

test("a village watched: its workers carry their own tools, told as made where and when", () => {
  const plan = ask<{ people: { ref: string; occupation: number; tool?: string }[] }>(
      "village.plan",
      {
        ref: towns[0]!.ref,
      },
    ),
    tooled = plan.people.filter((p) => p.tool);
  assert.ok(tooled.length >= 1, "someone carries their own tool");
  for (const p of tooled) assert.match(p.tool!, /^a [a-z]+ [a-z]+, made in year \d+$/);
});

test("natures in the god's hand, on their pages: a person's ways of being, a realm's ways, a beast's tameness", () => {
  type Tool = { type: "tool"; tool: string; args: Record<string, unknown> };
  const tool = (p: PageModel, name: string) =>
    p.tabs.flatMap((t) => t.blocks).find((b) => b.type === "tool" && (b as Tool).tool === name) as
      Tool | undefined;
  // A person met: their five ways of being, each the god's to push.
  const person = met[0]!.members[0]!.ref,
    natures = () =>
      tool(page(person), "acts.person")!.args.natures as [string, string, string, number][],
    boldness = natures().find(([t]) => t === "boldness")![3];
  world.submit("act.nature", { ref: person, trait: "boldness", sign: 1 });
  world.runTo(world.now + 2);
  const bolder = natures().find(([t]) => t === "boldness")![3];
  assert.ok(Math.abs(bolder - Math.min(1, boldness + 0.25)) < 1e-9, `${boldness} → ${bolder}`);
  assert.equal(tool(page(person), "acts.person")!.args.village !== undefined, true);
  // A realm: its ways, the mean of its lands'.
  const realm = politiesOf(world)
      .all()
      .find((r) => r.ended === null && r.members.length > 1)!,
    ways = () => tool(page(realm.ref), "acts.realm-ways")!.args.ways as [string, number][],
    trade = ways().find(([w]) => w === "trade")![1];
  world.submit("act.realm-ways", { realm: realm.ref, way: "trade", sign: 1 });
  world.runTo(world.now + 2);
  assert.ok(ways().find(([w]) => w === "trade")![1] > trade + 0.1, "more given to trade");
  // A beast: tamer.
  const beast = populationContext(world).generated.life.species.find(
      (x) => x.died === null && x.niche === "grazer",
    )!,
    tame = () => tool(page(beast.ref), "acts.lineage")!.args.docility as number,
    was = tame();
  world.submit("act.nature", { ref: beast.ref, trait: "docility", sign: 1 });
  world.runTo(world.now + 2);
  assert.ok(Math.abs(tame() - Math.min(1, was + 0.25)) < 1e-9);
});
