import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { landClay, landCloth } from "../../src/host/chain.ts";
import { burnsCharcoal } from "../../src/view/errands.ts";
import { restDay } from "../../src/view/seasons.ts";
import {
  CLAMP_DAYS,
  type Ground,
  type Role,
  boardsNow,
  clampNow,
  clampStage,
  dayTold,
  legsTold,
  loomsNow,
  townDay,
  villageSolids,
  wheelsNow,
} from "../../src/view/index.ts";
import type { Line, PageModel, VillagePlan } from "../../src/bridge/index.ts";

// Phase 51 M214: things seen being made — the potters at their wheels and their pots drying on the
// boards by the kiln, the weavers at their looms before the workshop, and the charcoal clamp in the
// woodlot through its round of working days. The first light's world at 300: its towns keep their
// own potters, weavers and colliers.
const world = EARTH.build(seedFromText("first light"));
world.runTo(300 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const DAY = 86_400,
  HOUR = 3_600;
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const refsOf = (lines: readonly Line[]): string[] =>
  lines.flatMap((l) => l.flatMap((s) => (typeof s === "string" || !s.ref ? [] : [s.ref])));
const plans: VillagePlan[] = ask<{ ref: string }[]>("towns.map")
  .slice(0, 40)
  .map((t) => ask<VillagePlan>("village.plan", { ref: t.ref, folk: 220 }));
const days: number[] = Array.from({ length: 8 }, (_, d) => 300 * 365 + 120 + d);
const at = (day: number, hours: number): number => day * DAY + hours * HOUR;
// A charcoal clamp as it stands at a moment: where, and how far through its round.
type ClampNow = NonNullable<ReturnType<typeof clampNow>>;

test("a town's potters throw at their wheels, set each pot on the boards to dry, and take the day before's off them to fire in the morning", () => {
  const potting = plans.find((p: VillagePlan) => {
    if (!p.people.some((x) => x.trade?.kind === "potter")) return false;
    const ground: Ground = villageSolids(p);
    return days.some((d) => townDay(p, d, ground).roles.some((r) => r.kind === "kiln"));
  })!;
  assert.ok(potting, "a town whose potters work at a kiln on the days scanned");
  const ground: Ground = villageSolids(potting);
  let working = 0,
    dawns = 0,
    sample: { index: number; n: number; form: string; day: number } | undefined;
  for (const day of days) {
    const roles: readonly Role[] = townDay(potting, day, ground).roles,
      potters: number[] = roles.flatMap((r, i) => (r.kind === "kiln" ? [i] : [])),
      kilns: number[] = [
        ...new Set(roles.flatMap((r) => (r.kind === "kiln" && r.place >= 0 ? [r.place] : []))),
      ];
    if (!potters.length) continue;
    working++;
    for (const i of potters) {
      const name = potting.people[i]!.name,
        text = dayTold(potting, i, day)
          .map((l) => l.words)
          .join(" | "),
        // (A day a rite broke into — a funeral, a fire — cut out what it took the place of.)
        broken = legsTold(potting, i, day).some((l) => l.why === "Back to their day");
      assert.match(text, /Throwing (a|an) [a-z ]+ on the wheel/i, `${name} on day ${day}: ${text}`);
      assert.match(
        text,
        /setting the new [a-z ]+ on the boards to dry/i,
        `${name} on day ${day}: ${text}`,
      );
      // Their first errand, before their first throw: the pots dried overnight taken off the boards to fire.
      if (broken) continue;
      const first = text.slice(0, text.search(/Throwing/i));
      assert.match(
        first,
        /Taking the dried pots off the boards/i,
        `${name} on day ${day}, first errand: ${text}`,
      );
      assert.match(first, /firing/i, `${name} on day ${day}, first errand: ${text}`);
    }
    // By 11h and by 16h: each kiln's boards hold the day's pots only, and more of them by 16h.
    const at11 = boardsNow(potting, ground, at(day, 11)),
      at16 = boardsNow(potting, ground, at(day, 16));
    for (const k of kilns) {
      assert.ok(
        at16[k]!.pots.length > at11[k]!.pots.length,
        `${day}: kiln ${k}'s boards at 16h against 11h`,
      );
      for (const pot of at16[k]!.pots)
        assert.equal(pot.day, day, `${day}: a pot on the boards is of the day`);
    }
    sample ??= at16.flatMap((b) => b.pots)[0];
    // At 5h, before the morning's firing: a kiln whose potters threw the day before holds those pots.
    const yesterday: readonly Role[] = townDay(potting, day - 1, ground).roles,
      threw = new Set(
        yesterday.flatMap((r, i) =>
          r.kind === "kiln" &&
          r.place >= 0 &&
          legsTold(potting, i, day - 1).some((l) => l.why?.startsWith("Setting the new "))
            ? [r.place]
            : [],
        ),
      ),
      at5 = boardsNow(potting, ground, at(day, 5));
    for (const k of kilns.filter((k) => threw.has(k))) {
      dawns++;
      assert.ok(at5[k]!.pots.length > 0, `${day}: kiln ${k} holds the day before's pots at 5h`);
      for (const pot of at5[k]!.pots)
        assert.equal(pot.day, day - 1, `${day}: at 5h a pot of the day before`);
    }
    // Scanning from 9h to 17h in five minutes: some wheel turns with its pot part thrown.
    let turning = false;
    for (let s = 9 * HOUR; s <= 17 * HOUR && !turning; s += 300)
      turning = wheelsNow(potting, ground, day * DAY + s).some(
        (w) => w.turning && !!w.pot && w.pot.grown > 0 && w.pot.grown < 1,
      );
    assert.ok(turning, `${day}: a wheel turning with its pot part thrown`);
  }
  assert.ok(working >= 4, `${working} working days`);
  assert.ok(dawns > 0, "a kiln whose potters threw the day before, seen at dawn");
  // A pot on the boards at 16h: its made page, named for its potter and its clay.
  assert.ok(sample, "a pot on the boards at 16h");
  const potter = potting.people[sample.index]!,
    ware = potting.stuff!.clay.ware,
    page = ask<PageModel>("page", {
      ref: `made:${potting.ref}:${sample.day}:potter:${potter.trade!.seat}:${sample.n}:${sample.form}`,
    }),
    blocks = page.tabs.flatMap((t) => t.blocks),
    facts = blocks.find((b) => b.type === "facts"),
    chain = blocks.find((b) => b.type === "list" && b.title === "From the ground to the boards");
  assert.match(page.title, new RegExp(`^(A|An) ${ware} ${sample.form}$`), page.title);
  assert.ok(facts?.type === "facts");
  const by = facts.rows.find((r) => r.label === "By")!;
  assert.ok(
    words(typeof by.value === "string" ? [by.value] : by.value).startsWith(
      `${potter.name}, a potter`,
    ),
    `${potter.name} made it`,
  );
  assert.ok(chain?.type === "list");
  const refs = refsOf(chain.items.map((i) => i.line));
  assert.ok(
    refs.some((r) => r.startsWith("subst:")),
    "its clay's page",
  );
  assert.ok(
    refs.some((r) => r.startsWith("rxn:")),
    "its firing's page",
  );
});

test("a town's weavers cut the day before's length from their looms and weave the next, the cloth growing on the loom through the day", () => {
  const weaves = (p: VillagePlan): boolean => {
    if (!p.people.some((x) => x.trade?.kind === "weaver")) return false;
    const ground: Ground = villageSolids(p);
    return days.some((d) =>
      townDay(p, d, ground).roles.some(
        (r, i) => r.kind === "workshop" && p.people[i]!.trade?.kind === "weaver",
      ),
    );
  };
  // (A town keeps weavers where it has a workshop: four hundred people, a market, and carpentry
  // known in its land. Which towns those are is history's: since Phase 55's deaths the first of
  // them in this world at 300 lies past the forty the other tests scan, so this one looks on
  // through the towns until it finds one.)
  let found = plans.find(weaves);
  for (const t of ask<{ ref: string }[]>("towns.map").slice(plans.length)) {
    if (found) break;
    const p = ask<VillagePlan>("village.plan", { ref: t.ref, folk: 220 });
    if (weaves(p)) found = p;
  }
  assert.ok(found, "a town whose weavers work at a loom on the days scanned");
  const weaving: VillagePlan = found;
  const ground: Ground = villageSolids(weaving),
    weavers: number[] = weaving.people.flatMap((p, i) => (p.trade?.kind === "weaver" ? [i] : []));
  let working = 0;
  for (const day of days) {
    const roles: readonly Role[] = townDay(weaving, day, ground).roles,
      looms = loomsNow(weaving, ground, at(day, 5));
    // Before the morning's cutting, every loom holds the day before's length, whole.
    assert.equal(looms.length, weavers.length, `${day}: a loom for each weaver`);
    for (const l of looms) assert.equal(l.woven, 1, `${day}: loom ${l.index} at 5h`);
    for (const i of weavers.filter((w) => roles[w]!.kind === "workshop")) {
      working++;
      const name = weaving.people[i]!.name,
        told = dayTold(weaving, i, day)
          .map((l) => l.words)
          .join(" | ");
      // (A day a rite broke into — a funeral, a fire — may lose the cutting: the loom is cut
      // then before they first weave.)
      const legs = legsTold(weaving, i, day),
        broken = legs.some((l) => l.why === "Back to their day");
      if (!broken)
        assert.match(told, /Cutting the finished length/i, `${name} on day ${day}: ${told}`);
      const cut =
        legs.find((l) => l.why?.startsWith("Cutting the finished length"))?.to ??
        legs.find((l) => l.task === "weave")?.from;
      assert.ok(cut !== undefined, `${name} on day ${day}: no cut, nor weaving`);
      // From 6h in ten minutes: whole until the cut, then first below half, growing to above eight in ten by 17h.
      const seen: { s: number; woven: number; weaving: boolean }[] = [];
      for (let s = 6 * HOUR; s <= 17 * HOUR; s += 600) {
        const l = loomsNow(weaving, ground, day * DAY + s).find((x) => x.index === i)!;
        seen.push({ s, woven: l.woven, weaving: l.weaving });
      }
      const before = seen.filter((x) => x.s < cut),
        after = seen.filter((x) => x.s >= cut);
      for (const x of before)
        assert.equal(
          x.woven,
          1,
          `${name} on day ${day}: loom whole before the cut, at ${x.s / HOUR}h`,
        );
      assert.ok(
        after.length > 0 && after[0]!.woven < 0.5,
        `${name} on day ${day}: loom just cut is below half`,
      );
      after
        .slice(1)
        .forEach((x, j) =>
          assert.ok(
            x.woven >= after[j]!.woven,
            `${name} on day ${day}: cloth grows, at ${x.s / HOUR}h`,
          ),
        );
      assert.ok(after.at(-1)!.woven > 0.8, `${name} on day ${day}: cloth above 0.8 by 17h`);
      assert.ok(
        seen.some((x) => x.weaving),
        `${name} on day ${day}: seen weaving at the loom`,
      );
      // The length on the loom, as its page has it: named for its cloth and its weaver.
      const cloth = ask<PageModel>("page", {
          ref: `made:${weaving.ref}:${day}:weaver:${weaving.people[i]!.trade!.seat}:0:length`,
        }),
        cblocks = cloth.tabs.flatMap((t) => t.blocks),
        cfacts = cblocks.find((b) => b.type === "facts"),
        clist = cblocks.find((b) => b.type === "list" && b.title === "From the ground to the loom");
      assert.equal(cloth.title, `A length of ${weaving.stuff!.cloth.name}`);
      assert.ok(cfacts?.type === "facts");
      const cby = cfacts.rows.find((r) => r.label === "By")!;
      assert.ok(
        words(typeof cby.value === "string" ? [cby.value] : cby.value).startsWith(
          `${name}, a weaver`,
        ),
        `${name} wove it`,
      );
      assert.ok(clist?.type === "list" && clist.items.length > 0, "its fibre's chain");
    }
  }
  assert.ok(working >= 4, `${working} working weaver-days`);
});

test("a town that burns charcoal keeps its clamp through a round of working days: its collier stacks, turfs, lights, watches and opens it, and a day of rest leaves it as it was", () => {
  // Three weeks: each seven days has one day of rest, and six working days on the round.
  const weeks: number[] = Array.from({ length: 21 }, (_, d) => 300 * 365 + 120 + d);
  const burning = plans.find((p: VillagePlan) => {
    if (!burnsCharcoal(p)) return false;
    const ground: Ground = villageSolids(p),
      colliers: number[] = weeks.filter((d) =>
        townDay(p, d, ground).roles.some((r) => r.kind === "collier"),
      );
    return (
      clampNow(p, ground, at(weeks[0]!, 12)) !== null &&
      colliers.some((d) => clampStage(p, d) === 0) &&
      colliers.some((d) => clampStage(p, d) === 5)
    );
  })!;
  assert.ok(
    burning,
    "a town that burns charcoal, its collier at the clamp on a stage-0 and a stage-5 day",
  );
  // The clamp stands only where the town burns charcoal: none where it does not.
  for (const p of plans)
    assert.equal(
      clampNow(p, villageSolids(p), at(weeks[0]!, 12)) !== null,
      burnsCharcoal(p),
      `${p.name}: a clamp where it burns charcoal`,
    );
  const ground: Ground = villageSolids(burning),
    clamp = (d: number, h: number): ClampNow => clampNow(burning, ground, at(d, h))!;
  // The round counts the working days: a working day stands one stage on from the day before, and a
  // day of rest stands as the day before left it.
  for (const d of weeks) {
    const stage: number = clampStage(burning, d),
      before: number = clampStage(burning, d - 1);
    assert.equal(
      stage,
      restDay(burning, d) ? before : (before + 1) % CLAMP_DAYS,
      `day ${d - weeks[0]!}: its stage on the round`,
    );
  }
  // Each seven days holds every stage once over its six working days.
  for (let j = 0; j + 7 <= weeks.length; j++)
    assert.deepEqual(
      [...new Set(weeks.slice(j, j + 7).map((d) => clampStage(burning, d)))].sort((a, b) => a - b),
      [0, 1, 2, 3, 4, 5],
      `the seven days from day ${weeks[j]! - weeks[0]!}`,
    );
  let stacked = 0,
    covered = 0,
    watched = 0,
    raked = 0,
    bare = 0;
  for (const d of weeks) {
    const stage: number = clampStage(burning, d),
      roles: readonly Role[] = townDay(burning, d, ground).roles,
      collier: number = roles.findIndex((r) => r.kind === "collier"),
      off: number = d - weeks[0]!;
    // Stages 2 to 4 smoulder, whether or not a collier tends the clamp that day.
    if (stage >= 2 && stage <= 4)
      for (const h of [6, 12, 17])
        assert.equal(clamp(d, h).lit, true, `day ${off} at ${h}h, stage ${stage}: lit`);
    if (collier < 0) {
      // A day without its collier, a day of rest or a lean one: the clamp as the day before left it.
      bare++;
      for (const h of [6, 12, 17]) {
        const c = clamp(d, h);
        assert.equal(c.built, 1, `day ${off} at ${h}h, stage ${stage}: built`);
        if (stage >= 1) assert.equal(c.covered, 1, `day ${off} at ${h}h, stage ${stage}: covered`);
        if (stage === 5) assert.equal(c.heap, 0, `day ${off} at ${h}h: heap opened`);
      }
      continue;
    }
    const told = dayTold(burning, collier, d)
      .map((l) => l.words)
      .join(" | ");
    if (stage === 0) {
      // Stacked from below a tenth at six to above a half by 17h.
      assert.match(told, /Stacking the billets about the clamp's flue/i, told);
      assert.ok(clamp(d, 6).built < 0.1, `day ${off}: built at 6h ${clamp(d, 6).built}`);
      assert.ok(clamp(d, 17).built > 0.5, `day ${off}: built at 17h ${clamp(d, 17).built}`);
      stacked++;
    } else if (stage === 1) {
      assert.match(told, /Covering the clamp with turf and earth/i, told);
      covered++;
    } else if (stage < 5) {
      assert.match(told, /Watching over the smouldering clamp/i, told);
      watched++;
    } else {
      // Opened: its charcoal carried off, so the heap at 17h is below the heap at 9h.
      assert.match(told, /Raking open the clamp/i, told);
      assert.ok(
        clamp(d, 17).heap < clamp(d, 9).heap,
        `day ${off}: heap at 17h ${clamp(d, 17).heap} below 9h ${clamp(d, 9).heap}`,
      );
      raked++;
    }
  }
  assert.ok(
    stacked > 0 && covered > 0 && watched > 0 && raked > 0 && bare > 0,
    `stacked ${stacked}, covered ${covered}, watched ${watched}, raked ${raked}, without collier ${bare}`,
  );
});

test("a town's clay and cloth are those its land yields", () => {
  for (const p of plans) {
    assert.ok(p.stuff && p.cell !== undefined, `${p.name}: its stuff and its land`);
    assert.equal(p.stuff!.clay.ware, landClay(world, p.cell!).ware, `${p.name}: its clay`);
    assert.equal(p.stuff!.cloth.name, landCloth(world, p.cell!).name, `${p.name}: its cloth`);
  }
});
