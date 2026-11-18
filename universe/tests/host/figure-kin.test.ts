// A group's head and one who holds an office have a family and a body (host/kin.ts figureFamily, host/inspect/kin.ts): a small
// family of their own key, the same every read; a great house's head with as many living brothers and sisters as its record's
// heirs; each of their household a page of their own, drawn under their roof; one of them dead reads dead everywhere; and no
// one is named as who follows a head before history names them. Juniper sixty years on.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref } from "../../src/kernel/index.ts";
import { housesOf, politiesOf, populationContext } from "../../src/sim/index.ts";
import {
  familyOf,
  figureHousehold,
  figureSelf,
  bodyOf,
  kinOfFigure,
  parseKinRef,
} from "../../src/host/kin.ts";
import { notablesIn } from "../../src/host/inspect/notables.ts";
import { fateOf } from "../../src/host/inspect/barread.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { leadersOfTown, withFigures } from "../../src/host/leaders.ts";
import { villagePlan } from "../../src/host/village.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 60, { start: "spread" }),
  ctx = populationContext(world),
  year = yearNow(world),
  towns = ctx.settlements.all().filter((t) => t.population > 0 && t.founded < year),
  figures = towns
    .slice(0, 160)
    .flatMap((t) => leadersOfTown(world, t.ref))
    .filter((l) => /^(boss|note):/.test(l.ref));

test("a head and an office-holder have a family of their own key and a body, the same every read", () => {
  assert.ok(figures.length >= 8, `some to read: ${figures.length}`);
  let wed = 0,
    young = 0;
  for (const l of figures.slice(0, 60)) {
    const f = familyOf(world, l.ref),
      b = bodyOf(world, l.ref);
    assert.ok(f && b, `${l.ref}: a family and a body`);
    assert.deepEqual(familyOf(world, l.ref), f, `${l.ref}: the same every read`);
    assert.equal(f.self.name, l.name);
    assert.equal(f.self.died, null);
    assert.equal(b.sex, f.self.sex);
    assert.ok(b.frame.members.length > 0);
    assert.equal(f.parents.length, 2, `${l.ref}: parents living or dead`);
    assert.match(f.kept, /not kept|none of them kept/, `${l.ref}: says it is read, not kept`);
    // Children by age, born when a parent could have had them; each of the household a page of their own.
    const born = f.children.map((k) => k.born);
    assert.deepEqual(
      born,
      [...born].sort((a, c) => a - c),
    );
    for (const k of [...f.parents, ...f.children, ...(f.spouse ? [f.spouse] : [])]) {
      assert.ok(k.ref && parseKinRef(k.ref)?.of === l.ref, `${l.ref}: ${k.name} has a page`);
      assert.equal(kinOfFigure(world, k.ref!)?.kin.name, k.name);
    }
    for (const k of f.children) assert.ok(k.born > f.self.born + 10, `${k.name} born after`);
    if (f.spouse) wed++;
    young += f.children.length;
    // Their page: Family and Body tabs, after the overview.
    const page = pageOf(world, l.ref),
      ids = page.tabs.map((t) => t.id);
    assert.ok(ids.includes("family") && ids.includes("body"), `${l.ref}: ${ids.join(",")}`);
    assert.ok(ids.indexOf("family") < ids.indexOf("body"));
  }
  assert.ok(wed > 0 && young > 0, `some wed (${wed}), some with children (${young})`);
});

test("a great house's head has as many living brothers and sisters as the heirs its record keeps, less themselves", () => {
  let read = 0;
  for (const t of towns.slice(0, 400))
    for (const n of notablesIn(world, t.ref)) {
      if (n.kind !== "house") continue;
      const m = /^note:house:(pol:\d+:\d+):(.+)$/.exec(n.ref)!,
        h = housesOf(world)
          ?.of(m[1] as Ref)
          ?.houses.find((x) => x.event === m[2]),
        who = figureSelf(world, n.ref),
        f = familyOf(world, n.ref);
      assert.ok(h && who && f);
      if (h.generation === 0) {
        assert.equal(who.heirs, undefined);
        continue;
      }
      read++;
      assert.equal(who.heirs, Math.max(1, h.heirs));
      // (A people that pairs for life keeps the keyed rule's family whole; whatever their kind, the brothers and sisters stand.)
      assert.equal(
        f.siblings.filter((k) => k.died === null).length,
        who.heirs! - 1,
        `${n.ref}: ${h.heirs} heirs`,
      );
      assert.match(f.kept, /^Read from the house, not kept/);
    }
  assert.ok(read > 0, `houses past their first head: ${read}`);
});

test("their household is drawn under their roof, each a page that leads to them; a dead one reads dead everywhere", () => {
  let drawn = 0,
    dead = 0;
  const seen = new Set<string>();
  for (const l of figures) {
    if (!l.town || seen.has(l.town) || seen.size >= 6) continue;
    seen.add(l.town);
    const plan = withFigures(world, villagePlan(world, l.town)!);
    for (const g of plan.figures ?? []) {
      if (!/^(boss|note):/.test(g.ref)) continue;
      for (const k of figureHousehold(world, g.ref)) {
        const p = plan.people.find((x) => x.ref === k.ref);
        if (year - k.born < 3) {
          assert.equal(p, undefined, "a babe is not on the street");
          continue;
        }
        assert.ok(p, `${k.ref}: drawn`);
        assert.equal(p.home, g.home, `${k.ref}: under their roof`);
        const page = pageOf(world, k.ref!);
        assert.equal(page.title, k.name);
        assert.deepEqual(page.place, { scale: "village", town: l.town, person: k.ref });
        assert.ok(page.tabs.some((t) => t.id === "body"));
        assert.equal(fateOf(world, k.ref!, page), null, `${k.ref}: among the living`);
        drawn++;
      }
      const f = familyOf(world, g.ref)!;
      for (const k of [...f.parents, ...f.children]) {
        if (k.died === null) continue;
        const page = pageOf(world, k.ref!),
          fate = fateOf(world, k.ref!, page);
        assert.ok(fate?.dead, `${k.ref}: dead by fateOf`);
        assert.equal(fate.year, k.died);
        assert.equal(page.place, null, "no one to go to");
        assert.ok(!plan.people.some((x) => x.ref === k.ref), "not drawn");
        assert.match(JSON.stringify(page.stats), /died at/);
        dead++;
      }
    }
    // No one is drawn twice.
    assert.equal(new Set(plan.people.map((x) => x.ref)).size, plan.people.length);
  }
  assert.ok(drawn > 0 && dead > 0, `${drawn} drawn, ${dead} dead read`);
});

test("a head's page names no one as who follows before history does", () => {
  const boss = figures.find((l) => l.ref.startsWith("boss:"));
  assert.ok(boss);
  const page = pageOf(world, boss.ref),
    text = JSON.stringify(page.tabs[0]!.blocks);
  assert.match(text, /Who follows/);
  assert.match(text, /in the year they take it, and no one before/);
  const f = familyOf(world, boss.ref)!;
  for (const k of f.children) assert.doesNotMatch(k.note ?? "", /heir/);
});
