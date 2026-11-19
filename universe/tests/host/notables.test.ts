// Those who hold a town's offices and head its great things (host/inspect/notables.ts): read from the thing itself, one stable
// person each, at the right town and nowhere else, absent where the world has none of the thing; a key figure with a body, a
// page that leads to them, and one before them who reads as gone. Juniper sixty years on.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref } from "../../src/kernel/index.ts";
import { politiesOf, populationContext, warsOf } from "../../src/sim/index.ts";
import {
  forgetNotables,
  goneNotable,
  notableLeader,
  notableOf,
  notablesIn,
} from "../../src/host/inspect/notables.ts";
import { fateOf, readingsOf } from "../../src/host/inspect/barread.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { courtFormOf } from "../../src/host/inspect/justice.ts";
import { leadersOf, leadersOfTown, seatTownOf, withFigures } from "../../src/host/leaders.ts";
import { villagePlan } from "../../src/host/village.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { dayTold, momentOf } from "../../src/view/index.ts";
import { courtRole } from "../../src/view/court.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 60, { start: "spread" }),
  ctx = populationContext(world),
  year = yearNow(world),
  towns = ctx.settlements.all().filter((t) => t.population > 0 && t.founded < year),
  realms = [...politiesOf(world).living()],
  seats = new Map(
    realms.flatMap((r) => {
      const s = seatTownOf(world, r);
      return s ? [[s.ref, r] as const] : [];
    }),
  );

test("each office is held by one person, the same every read, in the town the thing is in and no other", () => {
  let judges = 0,
    generals = 0,
    merchants = 0;
  for (const t of towns.slice(0, 120)) {
    const a = notablesIn(world, t.ref);
    forgetNotables(world);
    assert.deepEqual(notablesIn(world, t.ref), a, `${t.ref}: the same every read`);
    assert.equal(new Set(a.map((n) => n.ref)).size, a.length);
    const form = courtFormOf(world, t),
      judge = a.filter((n) => n.kind === "judge");
    // A judge only where the court's form has one.
    assert.equal(
      judge.length,
      form === "magistrate" || form === "bench" ? 1 : 0,
      `${t.ref} ${form}`,
    );
    judges += judge.length;
    // A host's commander only at a realm's seat; the richest merchant only in a market town.
    assert.equal(a.filter((n) => n.kind === "general").length, seats.has(t.ref) ? 1 : 0, t.ref);
    assert.equal(a.filter((n) => n.kind === "merchant").length, t.market !== null ? 1 : 0, t.ref);
    generals += a.filter((n) => n.kind === "general").length;
    merchants += a.filter((n) => n.kind === "merchant").length;
    for (const n of a) {
      assert.equal(n.town, t.ref);
      assert.equal(notableOf(world, n.ref)?.name, n.name, `${n.ref} found by its ref`);
      assert.ok(
        n.name.split(" ").length >= 2 && year - n.born >= 14,
        `${n.ref}: a name and an age`,
      );
      assert.doesNotMatch(n.ref, /[|#]/);
    }
  }
  assert.ok(
    generals > 0 && merchants > 0,
    `some of each: ${judges} judges, ${generals} commanders, ${merchants} merchants`,
  );
});

test("one who holds an office is one of their town's key figures: one body, a page that leads to them, the acts' card; the one before reads as gone", () => {
  const [seat, realm] = [...seats].find(([ref]) => notablesIn(world, ref).some((n) => !n.away))!,
    all = notablesIn(world, seat).filter((n) => !n.away),
    plan = withFigures(world, villagePlan(world, seat as Ref, undefined, 120));
  assert.ok(all.length > 0);
  for (const n of all) {
    const drawn = plan.people.filter((p) => p.figure === n.ref);
    assert.equal(drawn.length, 1, `${n.ref}: one body`);
    assert.equal(drawn[0]!.name, n.name);
    const page = pageOf(world, n.ref),
      tools = page.tabs.flatMap((t) =>
        t.blocks.flatMap((b) => (b.type === "tool" ? [b.tool] : [])),
      );
    assert.equal(page.title, n.name);
    assert.deepEqual(page.place, { scale: "village", town: seat, person: n.ref });
    assert.ok(tools.includes("leader.card"), `${n.ref}: the card the acts and Live as are on`);
    assert.match(JSON.stringify(page), /read from/, "says what of them is read and not kept");
    assert.equal(fateOf(world, n.ref, page), null, "living, and holding it");
    assert.ok(leadersOfTown(world, seat).some((l) => l.ref === n.ref && l.as?.name === n.name));
    // Their life is read as any seated person's is.
    assert.ok(
      page.tabs.some((t) => t.id === "self"),
      `${n.ref}: Their life`,
    );
    // The one before: by name, gone from it when their term was out; then another, further back, and not the same one.
    if (n.before) {
      const was = goneNotable(world, n.before.ref)!;
      assert.equal(was.name, n.before.name);
      assert.equal(was.year, n.since);
      assert.notEqual(was.name, n.name);
      const old = pageOf(world, n.before.ref),
        fate = fateOf(world, n.before.ref, old)!;
      assert.equal(old.title, n.before.name);
      assert.equal(old.place, null);
      assert.deepEqual([fate.dead, fate.short, fate.year], [false, "left the office", n.since]);
      assert.equal(readingsOf(world, n.before.ref, old)!.doing.short, "gone");
    }
  }
  // On the realm's leaders: its host's commander.
  assert.ok(
    leadersOf(world, realm.ref)!.leaders.some(
      // (As themselves, where the world keeps the commander by name.)
      (l) => l.ref === notablesIn(world, seat).find((n) => n.kind === "general")!.ref,
    ),
  );
  // A day of theirs: the one who keeps a temple is at it of a morning; a house's head and the commander are at court.
  const day = Math.floor(world.now / 86_400) + 1;
  for (const n of all) {
    const i = plan.people.findIndex((p) => p.figure === n.ref),
      told = dayTold(plan, i, day).map((l) => l.words);
    if (n.kind === "priest")
      assert.ok(
        told.some((w) => /Keeping the temple/.test(w)),
        told.join(" | "),
      );
    if (n.kind === "general" || n.kind === "house")
      assert.ok(
        told.some((w) => /At court before/.test(w)),
        `${n.kind}: ${told.join(" | ")}`,
      );
  }
});

test("a court's judge sits first on its sitting days; a host's commander at war is with the host, and says where", () => {
  // The judge: among those drawn, and judging when it sits.
  const sat = towns
    .slice(0, 200)
    .map((t) => ({ t, judge: notablesIn(world, t.ref).find((n) => n.kind === "judge") }))
    .find((x) => x.judge);
  if (sat) {
    const plan = withFigures(world, villagePlan(world, sat.t.ref as Ref, undefined, 120)),
      i = plan.people.findIndex((p) => p.figure === sat.judge!.ref),
      sitting = plan.court?.sittings.find((s) => s.day > Math.floor(world.now / 86_400));
    assert.equal(plan.court?.judge, sat.judge!.ref);
    assert.ok(i >= 0);
    if (sitting) {
      assert.equal(courtRole(plan, i, sitting.day)?.kind, "judge", "the judge judges");
      const m = momentOf(plan, i, sitting.day * 86_400 + 11 * 3600);
      assert.match(m.why ?? "", /^Judging at /);
      assert.equal(m.of?.ref, sitting.ref);
    }
  }
  // The commander: of a realm at war, away; of one at peace, at the seat.
  for (const [seat, r] of seats) {
    const n = notablesIn(world, seat).find((x) => x.kind === "general")!,
      war = warsOf(world)
        .fighting(r.ref)
        .some((w) => w.ended === null),
      l = notableLeader(world, n),
      page = pageOf(world, n.ref);
    assert.equal(!!n.away, war, `${r.ref}: away only while at war`);
    if (war) {
      assert.equal(l.as, null);
      assert.match(l.cannot ?? "", /^With the host/);
      assert.equal(page.place?.scale, "region");
      assert.match(JSON.stringify(page), /With the host, in the war against/);
      const plan = withFigures(world, villagePlan(world, seat as Ref, undefined, 120));
      assert.equal(plan.people.filter((p) => p.figure === n.ref).length, 0, "not at the seat");
    } else assert.deepEqual(page.place, { scale: "village", town: seat, person: n.ref });
  }
});
