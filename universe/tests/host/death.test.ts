// How one died, rebuilt from the rule that decided it (asked 2026-11-16: "reconstruct the causalistic path with all the probabilities
// and however u determine death"): every ruler's death drawn again from the world's seed falls under the chance it faced; every one
// of a court who died of their years likewise; a line holder who fell is told by the battle and its share; the living get this
// year's chance; and the god's acts on one person keep a world no one touches exactly as it was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  courtOf,
  handOf,
  personActsOf,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import { courtRef } from "../../src/host/court.ts";
import { townRoster } from "../../src/host/roster.ts";
import { deathOf, riskOf, rulerDeath } from "../../src/host/death.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { universeWorld } from "./worlds.ts";

const YEARS = 100;

test("every ruler's death, drawn again from the world's seed at its moment, fell under the chance their age gave them", () => {
  const world = universeWorld(EARTH, "first light", YEARS);
  let told = 0;
  for (const e of world.events.all()) {
    if (e.type !== "polity.succession") continue;
    const a = rulerDeath(world, e);
    assert.ok(a, `${e.id}: the draw rebuilt falls under the chance`);
    assert.equal(a.cause, "age");
    assert.match(a.draw ?? "", /chance of dying \(\d/);
    told++;
  }
  assert.ok(told > 0, "some ruler died in a hundred years");
});

test("one of a court who died of their years is told by the draw rebuilt; the living by this year's chance", () => {
  const world = universeWorld(EARTH, "first light", YEARS);
  let died = 0,
    living = 0;
  for (const r of politiesOf(world).all()) {
    const c = courtOf(world)?.of(r.ref);
    for (const g of c?.gone ?? []) {
      const a = deathOf(world, courtRef(r.ref, g.id));
      assert.ok(a, `${g.name}: an account`);
      if (g.how === "died" && a.cause === "age") {
        assert.match(a.draw ?? "", /inside it, so they died/);
        died++;
      }
    }
    for (const f of r.ended === null ? (c?.figures ?? []) : []) {
      const k = riskOf(world, courtRef(r.ref, f.id));
      assert.ok(k && /This year they face/.test(k.draw ?? ""));
      living++;
    }
  }
  assert.ok(died > 0 && living > 0, `${died} dead, ${living} living`);
});

test("a line holder who fell is told by their battle, their town's fallen share and their place in its order", () => {
  const world = universeWorld(EARTH, "first light", YEARS),
    ctx = populationContext(world);
  let found = 0;
  for (const p of ctx.provinces.all())
    for (const s of ctx.settlements.seenIn(p.cell)) {
      const roster = townRoster(world, s.ref);
      for (const b of roster.battles)
        for (const h of roster.fell(b, 2)) {
          const a = deathOf(world, h.ref);
          assert.ok(a && a.cause === "battle", h.ref);
          assert.equal(a.event, b.event);
          assert.match(a.draw ?? "", /fell \(/);
          found++;
        }
      if (found > 6) break;
    }
  assert.ok(found > 0, "a holder fell in a hundred years");
});

test("a ruler's page says what could take them now, and the god's acts are offered on it", () => {
  const world = universeWorld(EARTH, "first light", YEARS),
    r = politiesOf(world).living()[0]!,
    page = pageOf(world, `rule:${r.ref}`),
    blocks = page.tabs.flatMap((t) => t.blocks);
  assert.ok(blocks.some((b) => b.type === "text" && b.title === "At risk now"));
  assert.ok(blocks.some((b) => b.type === "tool" && b.tool === "acts.god-person"));
  // (Reading a page acts on no one.)
  assert.ok(!personActsOf(world)?.all().length);
});

test("a blessing on a ruler halves their chance; smiting them ends their reign at the year's turn, told as struck by the god", () => {
  const world = universeWorld(EARTH, "first light", 60),
    r = politiesOf(world).living()[0]!,
    name = r.ruler.name,
    before = riskOf(world, `rule:${r.ref}`)!;
  world.submit("act.person", { ref: `rule:${r.ref}`, kind: "bless", name });
  world.runTo(60 * YEAR + 1);
  const after = riskOf(world, `rule:${r.ref}`)!;
  assert.notEqual(after.draw, before.draw, "the chance told changes");
  world.submit("act.person", { ref: `rule:${r.ref}`, kind: "smite", name });
  world.runTo(62 * YEAR);
  const now = politiesOf(world).get(r.ref as Ref)!;
  assert.notEqual(now.ruler.name, name, "the seat has passed");
  const a = deathOf(world, `rule:${r.ref}`, name);
  assert.ok(a, "how they died");
  assert.equal(a.cause, "struck");
  assert.ok(world.events.all().some((e) => e.type === "person.struck"));
});

test("one under the hand who died is told by the month's draw kept at it: the chance, its parts, and the part but for which they'd have lived", () => {
  const world = universeWorld(EARTH, "first light", 60),
    ctx = populationContext(world),
    v = ctx.provinces
      .all()
      .flatMap((p) => [...ctx.settlements.seenIn(p.cell)])
      .filter((x) => x.population > 20)
      .sort((a, b) => a.population - b.population)[0]!;
  world.submit("hand.lay", { village: v.ref });
  world.runTo(80 * YEAR);
  const w = handOf(world).resting!,
    gone = w.gone ?? [];
  assert.ok(gone.length > 0, "someone under the hand died in twenty years");
  let told = 0;
  for (const g of gone.slice(-12)) {
    const a = deathOf(world, `agent:${g.id}`);
    assert.ok(a, `agent:${g.id}: an account`);
    if (a.cause !== "month") continue;
    assert.match(a.draw ?? "", /chance of dying \(.*The draw was 0\.\d{4}: inside it/);
    assert.ok(a.parts.length >= 1 && a.decided.length >= 1);
    const page = pageOf(world, `agent:${g.id}`);
    assert.ok(page.tabs[0]!.blocks.some((b) => b.type === "text" && b.title === "How they died"));
    told++;
  }
  assert.ok(told > 0);
  // (The living: this month's chance, and the acts.)
  const a = w.agents[0]!,
    risk = riskOf(world, `agent:${a.id}`);
  assert.ok(risk && /This month they face|blessing spares/.test(risk.draw ?? ""));
});
