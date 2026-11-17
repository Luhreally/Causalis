// The god's acts reaching past death (asked 2026-11-16: "close the narrower parts"): a blessing and a curse on a ruler's battles,
// office and line; whispers to their laws, trade, wars' aims, peace and house; the heads of groups as people with pages, acts and
// deaths told by their draws; a smiting at the act's own moment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  courtOf,
  deathNotesOf,
  luckBy,
  orgsOf,
  personActProblem,
  politiesOf,
  populationContext,
  rulerHazard,
  rulerLuck,
  underworldOf,
  whisperIn,
  whispersFor,
} from "../../src/sim/index.ts";
import { courtRef } from "../../src/host/court.ts";
import { deathOf, riskOf } from "../../src/host/death.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { universeWorld } from "./worlds.ts";

const toolOf = (world: ReturnType<typeof universeWorld>, ref: string) => {
  const b = pageOf(world, ref)
    .tabs.flatMap((t) => t.blocks)
    .find((x) => x.type === "tool" && x.tool === "acts.god-person");
  return b && b.type === "tool" ? (b.args as Record<string, unknown>) : null;
};

test("a blessing on a ruler doubles their fortunes and halves what goes against them; a curse the other way; none, exactly 1", () => {
  const world = universeWorld(EARTH, "first light", 60),
    r = politiesOf(world).living()[0]!,
    ref = `rule:${r.ref}`;
  assert.equal(rulerLuck(world, r.ref, r.ruler.event, 60), 1);
  assert.equal(rulerHazard(world, r.ref, r.ruler.event, 60), 1);
  world.submit("act.person", { ref, kind: "bless", name: r.ruler.name });
  world.runTo(60 * YEAR + 1);
  assert.equal(rulerLuck(world, r.ref, r.ruler.event, 60), 2);
  assert.equal(rulerHazard(world, r.ref, r.ruler.event, 60), 0.5);
  world.submit("act.person", { ref, kind: "curse", name: r.ruler.name });
  world.runTo(60 * YEAR + 2);
  assert.equal(rulerLuck(world, r.ref, r.ruler.event, 60), 0.5);
  assert.equal(rulerHazard(world, r.ref, r.ruler.event, 60), 2);
  // (Another ruler is untouched.)
  const o = politiesOf(world).living()[1]!;
  assert.equal(luckBy(world, `rule:${o.ref}`, o.ruler.event, 60), 1);
  // (The page says what it lays.)
  const held = toolOf(world, ref)!.held as { kind: string; does: string }[];
  assert.match(held.find((h) => h.kind === "curse")!.does, /host in battle ×0\.5/);
});

test("a ruler is whispered one choice of each kind at a time, of the choices their realm makes", () => {
  const world = universeWorld(EARTH, "first light", 60),
    r = politiesOf(world).living()[0]!,
    ref = `rule:${r.ref}`,
    c = populationContext(world),
    aims = whispersFor(world, "ruler", ref);
  for (const a of [
    "war",
    "peace",
    "goal:land",
    "terms:truce",
    "law:hold",
    "tariff:raise",
    "bar:ban",
  ])
    assert.ok(aims.includes(a), a);
  assert.match(personActProblem(c, { ref, kind: "whisper", aim: "sing" }) ?? "", /one of/);
  world.submit("act.person", { ref, kind: "whisper", aim: "law:hold", name: r.ruler.name });
  world.runTo(60 * YEAR + 1);
  assert.ok(whisperIn(world, ref, r.ruler.event, 60, "law"));
  assert.equal(whisperIn(world, ref, r.ruler.event, 60, "tariff"), null);
  assert.match(
    personActProblem(c, { ref, kind: "whisper", aim: "law:reform" }) ?? "",
    /holds on them already/,
  );
  assert.equal(personActProblem(c, { ref, kind: "whisper", aim: "tariff:lower" }), null);
});

test("a ruler's realm whispered to hold its laws moves none of them while it holds", () => {
  const world = universeWorld(EARTH, "first light", 60),
    living = politiesOf(world).living();
  for (const r of living)
    world.submit("act.person", {
      ref: `rule:${r.ref}`,
      kind: "whisper",
      aim: "law:hold",
      name: r.ruler.name,
    });
  // (Year by year: a law moved in a realm whose ruler is still the one whispered to, at the year's end, is one the whisper let pass.)
  const whispered = new Map(living.map((r) => [r.ref as string, r.ruler.event as string])),
    moved: string[] = [];
  for (let y = 61; y <= 70; y++) {
    world.runTo(y * YEAR);
    for (const e of world.events.all())
      if (e.type === "order.law" && e.t > (y - 1) * YEAR && e.t <= y * YEAR)
        for (const x of e.subjects)
          if (whispered.get(x) === politiesOf(world).get(x as Ref)?.ruler.event) moved.push(e.id);
  }
  assert.equal(moved.length, 0, "no law of a whispered ruler moved");
  // (Untouched, the same realms move dozens in those years.)
  const untouched = universeWorld(EARTH, "first light", 70).events.all();
  assert.ok(untouched.filter((e) => e.type === "order.law" && e.t > 60 * YEAR).length > 10);
});

test("a boss and a group's leader have pages: their name, birth and group, what could take them now, and the god's acts", () => {
  const world = universeWorld(EARTH, "first light", 100);
  let orgs = 0,
    mobs = 0;
  for (const r of politiesOf(world).living()) {
    for (const g of (orgsOf(world)?.of(r.ref)?.orgs ?? []).slice(0, 2)) {
      const ref = `boss:${r.ref}:${g.event}`,
        page = pageOf(world, ref);
      assert.equal(page.title, g.leader.name);
      assert.ok(page.tabs[0]!.blocks.some((b) => b.type === "text" && b.title === "At risk now"));
      const t = toolOf(world, ref)!,
        kinds = (t.acts as { kind: string; aim?: string }[]).map((a) => a.aim ?? a.kind);
      assert.ok(kinds.includes("smite") && kinds.includes("protect"));
      assert.ok(
        kinds.some((k) => k.startsWith("aim:")),
        "a leader can be whispered an aim",
      );
      assert.equal(t.atOnce, false, "a head is struck at their group's reckoning");
      orgs++;
    }
    for (const g of underworldOf(world)?.of(r.ref)?.groups ?? []) {
      const ref = `boss:${r.ref}:${g.event}`,
        page = pageOf(world, ref);
      assert.equal(page.title, g.boss.name);
      assert.ok(riskOf(world, ref));
      mobs++;
    }
  }
  assert.ok(orgs > 0 && mobs > 0, `${orgs} leaders, ${mobs} bosses`);
});

test("a group's head gone is told by the draw kept as it stood: their years, the realm's hand, and which decided it", () => {
  const world = universeWorld(EARTH, "first light", 100),
    notes = deathNotesOf(world)!;
  let told = 0;
  for (const r of politiesOf(world).all())
    for (const g of [
      ...(orgsOf(world)?.of(r.ref)?.orgs ?? []),
      ...(underworldOf(world)?.of(r.ref)?.groups ?? []),
    ]) {
      const head = `boss:${r.ref}:${g.event}`;
      for (const n of notes.headsOf(head).slice(-2)) {
        const a = deathOf(world, `${head}:${n.year}`);
        assert.ok(a, `${head}:${n.year}`);
        assert.ok(n.draw! < n.chance!, "the draw fell inside the chance");
        assert.match(a.draw ?? "", /The draw was 0\.\d{4}/);
        assert.ok(a.decided.length > 0);
        told++;
      }
    }
  assert.ok(told > 0);
});

test("a smiting ends one of a court at the act's moment; their page says protection does not reach them, and why", () => {
  const world = universeWorld(EARTH, "first light", 60),
    r = politiesOf(world)
      .living()
      .find((p) => (courtOf(world)?.of(p.ref)?.figures.length ?? 0) > 0)!,
    f = courtOf(world)!.of(r.ref)!.figures[0]!,
    ref = courtRef(r.ref, f.id),
    t = toolOf(world, ref)!;
  assert.match(String(t.help), /No protection for one of a court/);
  world.submit("act.person", { ref, kind: "smite", name: f.name });
  world.runTo(60 * YEAR + 1);
  const gone = courtOf(world)!
    .of(r.ref)!
    .gone.find((g) => g.id === f.id);
  assert.ok(gone && gone.how === "died", "gone from the court, dead");
  assert.equal(deathOf(world, ref)?.cause, "struck");
});
