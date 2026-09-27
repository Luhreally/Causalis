import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { folkRef, spine, why } from "../../src/causal/index.ts";
import { cradleCell } from "../cradle.ts";

/** Where the first people of "first light" began. */
const CRADLE = cradleCell("first light");

const world = EARTH.build(seedFromText("first light"));
world.runTo(260 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;

type History = {
  years: { year: number; population: number; fed: number }[];
  prices: { year: number; food: number; tools: number }[];
};
type Chronicle = {
  events: { ref: string; year: number; importance: number; claim: string }[];
  population: { year: number; people: number }[];
};

test("a province's years come back in order, one line a year, for the charts", () => {
  const h = ask<History>("province.history", { cell: CRADLE });
  // Every year for the last century; one year in ten before that.
  const recent = h.years.filter((y) => y.year >= 160),
    older = h.years.filter((y) => y.year < 160);
  recent.forEach((y, i) => assert.equal(y.year, 160 + i));
  assert.equal(recent.length, 100);
  // (Thinned a decade at a time: the decade just before the century is whole still.)
  assert.ok(h.years.filter((y) => y.year < 150).every((y) => y.year % 10 === 0));
  assert.ok(older.length >= 15);
  assert.ok(h.years.every((y) => y.population > 0 && y.fed >= 0 && y.fed <= 100));
  assert.ok(h.prices.length >= 100 && h.prices.every((p) => p.food > 0 && p.tools > 0));
});

test("the chronicle is newest first, in words, and adds up the world's people by year", () => {
  const c = ask<Chronicle>("chronicle", { limit: 40 });
  assert.ok(c.events.length > 10);
  for (let i = 1; i < c.events.length; i++) assert.ok(c.events[i - 1]!.year >= c.events[i]!.year);
  for (const e of c.events) {
    assert.ok(e.importance >= 4);
    assert.doesNotMatch(e.claim, /\(t=\d+\)|^[a-z]+\.[a-z-]+ /, `said in words: ${e.claim}`);
  }
  // The world's people every year for a century, one year in ten before that.
  const years = c.population.map((y) => y.year);
  for (let i = 1; i < years.length; i++) assert.ok(years[i]! > years[i - 1]!);
  assert.equal(years.at(-1), 259);
  assert.deepEqual(
    years.filter((y) => y >= 160),
    Array.from({ length: 100 }, (_, k) => 160 + k),
  );
  assert.ok(years.filter((y) => y < 150).every((y) => y % 10 === 0));
  assert.ok(years.length >= 115);
  const last = c.population.at(-1)!,
    map = ask<{ people: number }[]>("people.map");
  assert.ok(Math.abs(last.people - map.reduce((s, p) => s + p.people, 0)) < last.people * 0.05);
});

test("the people of a province explain themselves, back to the first people and the land", () => {
  const node = why(world, folkRef(CRADLE));
  assert.equal(node.basis, "recorded");
  assert.match(
    node.claim,
    /^[\d,]+ people live in the .*, peopled since year 0; in the last ten years [\d,]+ were born and [\d,]+ died/,
  );
  const kinds = spine(world, folkRef(CRADLE)).map((e) => e.ref.split(":")[0]);
  assert.equal(kinds.at(-1), "star", kinds.join(" ← "));
  const facts = ask<{ folk: Ref }>("province", { cell: CRADLE });
  assert.equal(facts.folk, folkRef(CRADLE));
});

test("a century of watching a village meets its families through the observer and never changes history", () => {
  const quiet = EARTH.build(seedFromText("first light")),
    busy = EARTH.build(seedFromText("first light"));
  quiet.runTo(240 * YEAR);
  busy.runTo(240 * YEAR);
  const ref = (EARTH.queries.settlements!(busy, { cell: CRADLE }) as { ref: string }[])[0]!.ref;
  type Plan = {
    people: { ref: string; home: number }[];
    homes: { household: string | null }[];
    era: string;
  };
  const first = EARTH.queries["village.plan"]!(busy, { ref }) as Plan;
  assert.ok(first.people.length >= 10, `${first.people.length} watched`);
  // A village of farmers (or on), dressed as its land's era.
  assert.ok(["farm", "metal", "industry", "modern"].includes(first.era), first.era);
  assert.ok(first.people.every((p) => first.homes[p.home]!.household !== null));
  for (let year = 241; year <= 340; year++) {
    quiet.runTo(year * YEAR);
    busy.runTo(year * YEAR);
    const again = EARTH.queries["village.plan"]!(busy, { ref }) as Plan;
    assert.ok(again.people.length <= first.people.length + 60);
    // And look closer at someone each decade: their whole life, told.
    if (year % 10 === 0 && again.people[0])
      EARTH.queries["observe.person"]!(busy, { ref: again.people[0].ref });
  }
  assert.deepEqual(
    busy.checkpoints().map((c) => c.chain),
    quiet.checkpoints().map((c) => c.chain),
    "the watched village's history is the unwatched one's",
  );
});

test("a village's plan says what lives about it: the land's game and hunters as they stand, and its flocks", () => {
  const before = JSON.stringify(world.domainHashes());
  const ref = (EARTH.queries.settlements!(world, { cell: CRADLE }) as { ref: string }[])[0]!.ref;
  type Plan = {
    pasture: { x: number; z: number; r: number };
    road: { x: number; z: number };
    wild: number;
    fields: { x: number; z: number }[];
    fauna: {
      wild: { name: string; niche: string; stock: number; size: number }[];
      flock: { name: string; herders: number } | null;
      raided: boolean;
    };
  };
  const plan = EARTH.queries["village.plan"]!(world, { ref }) as Plan,
    folk = ask<{
      herding: string | null;
      wild: { name: string; tame: boolean; niche: string }[];
      ecology: {
        wild: number;
        hunters: { name: string; stock: number } | null;
        flocksTaken: string | null;
      };
    }>("province", { cell: CRADLE });
  // Its game and its hunters, each as much of it as the land's living world still holds.
  // (The land's game on foot; the water's life and the scavengers go by their own.)
  const game = plan.fauna.wild.filter(
      (s) => s.niche !== "hunter" && s.niche !== "swimmer" && s.niche !== "scavenger",
    ),
    hunters = plan.fauna.wild.filter((s) => s.niche === "hunter");
  assert.ok(game.length >= 1, "game lives about the cradle's village");
  assert.ok(hunters.length >= 1, "and the hunters that live on it");
  for (const s of game) assert.equal(s.stock, folk.ecology.wild);
  assert.equal(hunters[0]!.name, folk.ecology.hunters!.name);
  assert.equal(hunters[0]!.stock, folk.ecology.hunters!.stock);
  // Its flocks, where the land keeps them: of a beast that can be tamed, kept by its herders.
  assert.equal(!!plan.fauna.flock, !!folk.herding);
  if (plan.fauna.flock) assert.ok(plan.fauna.flock.herders >= 1);
  assert.equal(plan.fauna.raided, !!folk.ecology.flocksTaken);
  // The flocks graze off the road, and the wild begins past the fields.
  const angle = (p: { x: number; z: number }) => Math.atan2(p.z, p.x),
    apart = Math.abs(
      ((angle(plan.pasture) - angle(plan.road) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI,
    );
  assert.ok(apart > 0.5, `the pasture ${apart.toFixed(2)} rad off the road`);
  for (const f of plan.fields) assert.ok(Math.hypot(f.x, f.z) < plan.wild);
  assert.equal(JSON.stringify(world.domainHashes()), before, "looking changes nothing");
});

test("a village's plan sets its land's works where they stand: its mine by what it digs, clear of its fields, road and pasture", () => {
  const before = JSON.stringify(world.domainHashes());
  type Plan = {
    era: string;
    districts: unknown;
    road: { x: number; z: number };
    pasture: { x: number; z: number; r: number };
    fields: { x: number; z: number }[];
    works: {
      mine: { x: number; z: number; kind: string; what: string; ref: string | null } | null;
      well: unknown;
      factory: unknown;
    };
  };
  // Lands that dig (they make copper or coal) and some that do not.
  const lands = ask<{ cell: number }[]>("people.map").map((l) => l.cell),
    digs = (cell: number) =>
      (ask<{ goods: { id: string; made: number }[] } | null>("market", { cell })?.goods ?? []).some(
        (g) => (g.id === "copper" || g.id === "coal") && g.made > 0,
      ),
    sample = [...lands.filter(digs).slice(0, 6), ...lands.filter((c) => !digs(c)).slice(0, 4)];
  let seen = 0;
  for (const cell of sample) {
    const towns = EARTH.queries.settlements!(world, { cell }) as { ref: string }[];
    if (!towns[0]) continue;
    const plan = EARTH.queries["village.plan"]!(world, { ref: towns[0].ref }) as Plan,
      facts = ask<{ industry: { mine: string | null }; house: unknown }>("province", { cell }),
      goods =
        ask<{ goods: { id: string; made: number }[] } | null>("market", { cell })?.goods ?? [],
      copper = (goods.find((g) => g.id === "copper")?.made ?? 0) > 0,
      mine = plan.works.mine;
    // A mine where the land digs coal, an ore pit where it smelts copper; none where it does neither and builds in no stone.
    if (facts.industry.mine) assert.equal(mine?.what, "coal");
    else if (copper) assert.equal(mine?.what, "ore");
    if (!mine) continue;
    seen++;
    assert.ok(["pit", "shaft", "quarry"].includes(mine.kind));
    assert.equal(
      mine.kind === "shaft",
      ["industry", "modern"].includes(plan.era) && mine.what !== "stone",
    );
    // Clear of the pasture and the fields, off the road.
    assert.ok(Math.hypot(mine.x - plan.pasture.x, mine.z - plan.pasture.z) > plan.pasture.r);
    for (const f of plan.fields) assert.ok(Math.hypot(mine.x - f.x, mine.z - f.z) > 20);
    // (A city's road runs through it both ways.)
    const way = (a: number) =>
        Math.abs(
          ((a - Math.atan2(plan.road.z, plan.road.x) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI,
        ),
      at = Math.atan2(mine.z, mine.x),
      apart = plan.districts ? Math.min(way(at), way(at + Math.PI)) : way(at);
    assert.ok(apart > 0.4, `the mine ${apart.toFixed(2)} rad off the road`);
  }
  assert.ok(seen >= 1, "some land about the cradle digs by year 260");
  assert.equal(JSON.stringify(world.domainHashes()), before, "looking changes nothing");
});

test("a hunter's page names the game it hunts, and its game's page names the hunter", () => {
  const before = JSON.stringify(world.domainHashes());
  type Kin = { name: string; ref: string; lands: number }[];
  type Page = {
    name: string;
    niche: string;
    hunts: Kin;
    huntedBy: Kin;
    raids: number;
    lands: number;
  };
  const folk = ask<{ ecology: { hunters: { ref: string } | null } }>("province", { cell: CRADLE }),
    hunter = ask<Page>("species.page", { ref: folk.ecology.hunters!.ref });
  assert.equal(hunter.niche, "hunter");
  assert.ok(hunter.hunts.length >= 1 && hunter.huntedBy.length === 0, "a hunter hunts");
  assert.ok(
    hunter.hunts.every(
      (k, i) =>
        k.lands >= 1 &&
        k.lands <= hunter.lands &&
        (i === 0 || hunter.hunts[i - 1]!.lands >= k.lands),
    ),
  );
  const prey = ask<Page>("species.page", { ref: hunter.hunts[0]!.ref });
  assert.ok(["grazer", "browser", "great beast"].includes(prey.niche));
  assert.ok(
    prey.huntedBy.some((k) => k.name === hunter.name && k.lands === hunter.hunts[0]!.lands),
    "and is hunted by it, in as many lands",
  );
  assert.equal(JSON.stringify(world.domainHashes()), before, "looking changes nothing");
});

test("a lineage, a realm, a deposit, a plate and the deep ages each have a page, and asking changes nothing", () => {
  const before = JSON.stringify(world.domainHashes());
  type Folk = { wild: { ref: string }[]; realm: { ref: string } | null };
  const folk = ask<Folk>("province", { cell: CRADLE });
  const s = ask<{ name: string; lands: number; arose: { ref: string } }>("species.page", {
    ref: folk.wild[0]!.ref,
  });
  assert.ok(s.name && s.lands >= 1, "a lineage lives somewhere");
  assert.equal(why(world, s.arose.ref as Ref).basis, "generated");
  const realmRef =
    folk.realm?.ref ?? world.events.all().find((e) => e.type === "polity.formed")?.subjects[0];
  assert.ok(realmRef, "a realm to look at");
  const r = ask<{
    lands: number;
    people: number;
    ruler: { event: string };
    known: { year: number }[];
  }>("realm.page", { ref: realmRef });
  assert.ok(r.lands >= 1 && r.people > 0 && r.ruler.event);
  // What they know, in the order they came to know it.
  assert.ok(r.known.every((k, i) => i === 0 || r.known[i - 1]!.year <= k.year));
  const d = ask<{ ref: string; cell: number }[]>("deposits")[0]!;
  const page = ask<{ plate: { ref: string } | null; land: number }>("deposit.page", {
    ref: d.ref,
  });
  assert.ok(page.plate, "a deposit lies on a plate");
  const plate = ask<{ share: number; deposits: { kind: string }[] }>("plate.page", {
    ref: page.plate.ref,
  });
  assert.ok(plate.share > 0 && plate.share < 1 && plate.deposits.length >= 1);
  const ages = ask<{ claim: string }[]>("deep.ages");
  assert.ok(ages.length >= 4 && ages.every((a) => a.claim.includes("million years ago")));
  assert.equal(JSON.stringify(world.domainHashes()), before, "a page is a pure read");
});

test("history is told in words: no event's claim shows a raw ref", () => {
  const leaks = new Map<string, string>();
  for (const e of world.events.all()) {
    const claim = why(world, e.id).claim;
    if (/\b[a-z]{2,6}:\d+:\d+\b/.test(claim) && !leaks.has(e.type)) leaks.set(e.type, claim);
  }
  assert.equal(leaks.size, 0, [...leaks].map(([t, c]) => `${t}: ${c}`).join("\n"));
});
