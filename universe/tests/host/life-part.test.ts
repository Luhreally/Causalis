// A part played for a group of one's town, in a life lived (rules/part.ts, sim/hand/life.ts `life.part`, host/inspect/townlife.ts
// roleOffers): each part is offered only to the one who is that for the thing; reading them moves nothing; playing one writes
// on the life alone (coin, standing with the group, a wound) and moves no part of the world but the hand's own; its words say
// what, who, cost and effect, never how. Juniper sixty years on, where a family collects and a head's house is guarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JUDGE_SENTENCES,
  PARTS,
  PARTS_OF,
  PART_IDS,
  judgeCame,
  partOutcome,
  type PartFacts,
  type PartId,
} from "../../src/rules/index.ts";
import {
  handOf,
  makePopulationWorld,
  politiesOf,
  populationContext,
  underworldOf,
} from "../../src/sim/index.ts";
import { deserialize, serialize } from "node:v8";
import { loadWorld, saveWorld, seedFromText, type SaveDocument } from "../../src/kernel/index.ts";
import { LIFE_QUERIES } from "../../src/host/life.ts";
import { linesWere, roleOffers, townLifeOf } from "../../src/host/inspect/townlife.ts";
import { EARTH } from "../../src/host/planet.ts";
import { notablesIn } from "../../src/host/inspect/notables.ts";
import { casesOf, courtFormOf, heldCaseOf } from "../../src/host/inspect/justice.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import type { LifeCard, LifeNow } from "../../src/bridge/index.ts";
import { peopledWorld } from "../worlds.ts";

const facts = (more: Partial<PartFacts> = {}): PartFacts => ({
  n: 5,
  hold: 0.4,
  share: 0.2,
  strength: 0.3,
  war: false,
  soldiers: false,
  crew: false,
  takes: false,
  bread: 1,
  ...more,
});
const draws = (seed: number) => (n: number) =>
  (((seed * 2654435761 + n * 40503) >>> 0) % 1000) / 1000;
/** No word of how a thing is done, and no ware's name: what, who, cost and effect only. */
const HOW =
  /\b(knife|knives|blade|gun|pistol|club|beat|beaten|stab|shot|shoot|poison|threat|burn|arson|wine|beer|spirits?|poppy|opium|leaf|smoke|powder|drug)\b/i;

test("a part's outcome is the same for the same draws, its coin adds up, and its words never say how", () => {
  for (const id of PART_IDS) {
    if (id === "judge") continue;
    for (let seed = 1; seed <= 40; seed++) {
      const f = facts({
          war: seed % 2 === 0,
          soldiers: seed % 3 === 0,
          crew: seed % 5 === 0,
          takes: seed % 4 === 0,
        }),
        a = partOutcome(id, "the Bothaath family", f, draws(seed), 50, false),
        b = partOutcome(id, "the Bothaath family", f, draws(seed), 50, false);
      assert.deepEqual(a, b, `${id} ${seed}`);
      assert.ok(a.words.length > 20 && /^[A-Z]/.test(a.words) && /\.$/.test(a.words), a.words);
      assert.doesNotMatch(a.words, HOW, `${id}: ${a.words}`);
      assert.ok(Number.isInteger(a.coin), `${id}: whole coin`);
      // (Never more taken from a purse than it holds.)
      assert.ok(50 + a.coin >= 0, `${id}: ${a.coin}`);
      // What is said to be theirs is what reaches the purse.
      const said = /(\d+) (?:yours|to the house|coin came to you)/.exec(a.words);
      if (said && id !== "patrol") assert.equal(Number(said[1]), a.coin, a.words);
      if (a.wound) assert.match(a.words, /hurt/);
    }
  }
  // A collector's round: what is taken is what those who paid gave, shared as it says.
  const r = partOutcome("rounds", "the Bothaath family", facts(), draws(7), 0, false),
    m = /(\d+) of 5 paid.* (\d+) coin taken: (\d+) for the Bothaath family, (\d+) yours/.exec(
      r.words,
    );
  assert.ok(m, r.words);
  assert.equal(Number(m[3]) + Number(m[4]), Number(m[2]));
  assert.equal(Number(m[2]) % Number(m[1]), 0, "each who paid gave the same");
  // No rival, no answer; the watch paid is not paid twice; soldiers about, a round may lose what it carried.
  assert.match(partOutcome("answer", "x", facts(), draws(1), 9, false).words, /at war with no one/);
  assert.equal(partOutcome("paywatch", "x", facts(), draws(1), 500, true).coin, 0);
  assert.ok(partOutcome("paywatch", "x", facts(), draws(1), 500, false).paid === 30);
  let taken = 0;
  for (let seed = 1; seed <= 200; seed++)
    if (
      /was taken/.test(
        partOutcome("rounds", "x", facts({ soldiers: true }), draws(seed), 0, false).words,
      )
    )
      taken++;
  assert.ok(taken > 20 && taken < 120, `${taken} rounds in 200 stopped while soldiers are posted`);
  for (const [form, list] of Object.entries(JUDGE_SENTENCES))
    for (const s of list) {
      const c = judgeCame(s, "Ana Vor", 1);
      assert.match(c.words, /^You heard the case of Ana Vor/, `${form} ${s}`);
      assert.equal(c.coin > 0, s === "bribe");
    }
});

const world = peopledWorld("juniper", 60, { start: "spread" }),
  ctx = populationContext(world),
  year = yearNow(world),
  towns = ctx.settlements.all().filter((t) => t.population > 0 && t.founded < year),
  partsOf = (town: string, ref: string, name?: string): PartId[] =>
    roleOffers(world, town, ref, name).flatMap((o) => (o.part ? [o.part.what] : []));

test("each part is offered only to the one who is that for the thing, and reading them moves nothing", () => {
  const hash = JSON.stringify(world.domainHashes()),
    seen = new Set<string>();
  for (const t of towns.slice(0, 1500)) {
    const life = townLifeOf(world, t.ref);
    if (!life.goings.length) continue;
    const mine = new Map<string, Set<PartId>>();
    for (const g of life.goings) {
      const of = g.kind === "posted" ? null : (g.kind as keyof typeof PARTS_OF);
      for (const who of g.who) {
        if (!who.startsWith("folk:town:") || !of) continue;
        const set = mine.get(who) ?? new Set<PartId>();
        for (const p of PARTS_OF[of]) set.add(p);
        mine.set(who, set);
      }
    }
    for (const [who, set] of mine) {
      const got = partsOf(t.ref, who);
      assert.deepEqual([...new Set(got)].sort(), [...set].sort(), `${t.ref} ${who}`);
      for (const p of got) seen.add(p);
    }
    // One of the town who is of nothing in it, and one who only pays or is given to: no part.
    const of = new Set(life.goings.flatMap((g) => g.who)),
      payer = life.goings.flatMap((g) => g.to ?? []).find((r) => !of.has(r)),
      other = life.named.find((p) => !of.has(p.ref));
    if (payer) assert.deepEqual(partsOf(t.ref, payer), [], `${t.ref}: one who pays plays no part`);
    if (other) assert.deepEqual(partsOf(t.ref, other.ref), []);
    assert.deepEqual(partsOf(t.ref, "folk:town:none:0:0"), []);
    // Its heads, by the name they are known by: a lawful group's leads its meeting; one outside the law has a head's parts.
    for (const h of life.heads) {
      const got = partsOf(t.ref, "agent:1", h.name);
      if (life.goings.some((g) => g.who[0] === h.ref)) assert.ok(got.includes("lead"), h.ref);
      if (life.goings.some((g) => g.kind === "guard" && g.to?.includes(h.ref))) {
        for (const p of ["receive", "settle", "paywatch"] as const)
          assert.ok(got.includes(p), `${h.ref}: ${p}`);
        assert.ok(!got.includes("rounds") && !got.includes("watch"));
      }
      for (const p of got) seen.add(p);
      // (No one else is offered a head's.)
      assert.deepEqual(partsOf(t.ref, "agent:1", `${h.name} the other`), []);
    }
    // Its judge, by name: what the court's form allows on the next small wrong, and nothing to anyone else.
    const judge = notablesIn(world, t.ref).find((n) => n.kind === "judge");
    if (judge) {
      const offers = roleOffers(world, t.ref, "agent:1", judge.name).filter(
          (o) => o.part?.what === "judge",
        ),
        form = courtFormOf(world, t),
        waits = casesOf(world, t.ref, year).some((c) => !c.grave && c.day * 86400 > world.now);
      assert.deepEqual(
        offers.map((o) => o.part!.sentence),
        waits ? [...JUDGE_SENTENCES[form]!] : [],
        `${t.ref} ${form}`,
      );
      if (offers.length) seen.add("judge");
      assert.ok(!partsOf(t.ref, "agent:1", "No One").includes("judge"));
    }
  }
  for (const p of ["rounds", "lielow", "door", "sell", "attend", "lead", "receive"])
    assert.ok(seen.has(p), `${p} was offered to someone: ${[...seen].join(", ")}`);
  for (const o of towns
    .slice(0, 300)
    .flatMap((t) =>
      townLifeOf(world, t.ref).goings.flatMap((g) => roleOffers(world, t.ref, g.who[0]!)),
    )) {
    assert.doesNotMatch(o.words, HOW, o.words);
    if (o.part) assert.equal(o.label, PARTS[o.part.what].label);
  }
  assert.equal(JSON.stringify(world.domainHashes()), hash, "reading moves nothing");
});

test("a part played writes on the life alone: the world's other parts hash as they did, and none is played unasked", () => {
  // The town a family collects in: the hand laid, its collector lived.
  const town = towns.find((t) =>
    townLifeOf(world, t.ref).goings.some((g) => g.kind === "collect"),
  )!;
  assert.ok(town, "a town where a family collects");
  world.runTo(world.submit("hand.lay", { village: town.ref }).t);
  const ask = <T>(type: string, args?: unknown) => LIFE_QUERIES[type]!(world, args) as T,
    life = townLifeOf(world, town.ref),
    g = life.goings.find((x) => x.kind === "collect")!,
    who = g.who.find((r) => r.startsWith("agent:"))!;
  assert.ok(who, `its collector is one under the hand: ${g.who.join(",")}`);
  const id = Number(who.slice(6));
  assert.ok(ask<LifeCard[]>("life.pick").length > 0);
  world.runTo(world.submit("life.begin", { agent: id, home: 1 }).t);
  world.runTo(world.now + 3600 * 9);
  const now = ask<LifeNow>("life.now")!,
    rounds = now.offers.find((o) => o.part?.what === "rounds")!;
  assert.ok(rounds, now.offers.map((o) => o.label).join(", "));
  assert.equal(now.offers.filter((o) => o.part).length, 2, "rounds, and lying low: no one else's");
  assert.equal(
    handOf(world).resting!.life!.part,
    undefined,
    "nothing of a part kept until one is played",
  );
  const before = new Map(world.domainHashes()),
    purse = handOf(world).resting!.life!.purse;
  world.runTo(world.submit("life.part", rounds.part).t);
  const after = new Map(world.domainHashes()),
    l = handOf(world).resting!.life!,
    moved = [...after.keys()].filter((k) => after.get(k) !== before.get(k));
  assert.ok(l.part && l.part.done === 1);
  assert.match(l.log.at(-1)!.words, /rounds for /);
  assert.equal(l.doing?.what, "part");
  assert.ok(l.purse >= purse - 1, "what a round brings reaches the purse, or nothing does");
  // Only what the hand itself keeps has moved (its own state, and the clock the command was told by).
  assert.deepEqual([...moved].sort(), ["commands", "hand", "kernel"], `moved: ${moved.join(", ")}`);
  // A part no one is: refused. A sentence the court's form does not allow: refused.
  assert.throws(() => world.submit("life.part", { what: "nothing", of: "x", name: "x", n: 1 }));
  assert.throws(() =>
    world.submit("life.part", {
      what: "judge",
      of: "x",
      name: "x",
      n: 1,
      form: "bench",
      sentence: "banish",
      accused: "Ana",
      case: `case:${town.ref}:${yearNow(world)}:1`,
    }),
  );
});

test("a case ruled by one lived as the court's judge reads as ruled in the court's book, once, and holds whom it holds", () => {
  const w2 = peopledWorld("juniper", 60, { start: "spread" }),
    y = yearNow(w2),
    court = populationContext(w2)
      .settlements.all()
      .filter((t) => t.population > 0 && t.founded < y)
      .slice(0, 600)
      .find((t) => casesOf(w2, t.ref, y).some((c) => !c.grave && !c.accused.outside))!;
  assert.ok(court, "a court with a small wrong before it this year");
  w2.runTo(w2.submit("hand.lay", { village: court.ref }).t);
  const card = (LIFE_QUERIES["life.pick"]!(w2, undefined) as LifeCard[]).find(
    (c) => c.kind !== "child",
  )!;
  w2.runTo(w2.submit("life.begin", { agent: card.id, home: 1 }).t);
  // (Under the hand the town's people are the hand's, and its book is drawn of them.)
  const c0 = casesOf(w2, court.ref, y).find((c) => !c.grave && !c.accused.outside)!,
    part = {
      what: "judge",
      of: `note:judge:${court.ref}`,
      name: `the court of ${court.name}`,
      n: 1,
      form: "magistrate",
      sentence: "cell",
      accused: c0.accused.name,
      case: c0.ref,
    },
    others = casesOf(w2, court.ref, y)
      .filter((c) => c.ref !== c0.ref)
      .map((c) => `${c.ref}|${c.sentence}|${c.came}`);
  w2.runTo(w2.submit("life.part", part).t);
  const c = casesOf(w2, court.ref, y).find((x) => x.ref === c0.ref)!,
    l = handOf(w2).resting!.life!;
  assert.equal(c.sentence, "cell");
  assert.equal(c.days, 90);
  assert.match(c.came, /was locked in the town's cell for three months, by .+'s word/);
  assert.equal(c.accused.ref, c0.accused.ref);
  assert.match(l.log.at(-1)!.words, /^You heard the case of /);
  assert.equal(handOf(w2).resting!.rulings?.length, 1);
  // Its page reads it as ruled from then, though the book had set it for a later day; and what was laid runs from the ruling.
  const page = JSON.stringify(pageOf(w2, c0.ref));
  assert.doesNotMatch(page, /still to be heard|being heard today/);
  assert.match(page, /was locked in the town's cell for three months, by /);
  assert.ok(c.day <= Math.floor(w2.now / 86_400), "heard the day it was ruled");
  assert.equal(heldCaseOf(w2, court.ref, c.accused.ref)?.ref, c.ref);
  // The rest of the year's book is as it was.
  assert.deepEqual(
    casesOf(w2, court.ref, y)
      .filter((x) => x.ref !== c0.ref)
      .map((x) => `${x.ref}|${x.sentence}|${x.came}`),
    others,
  );
  // Heard once; a sentence the court's form does not allow, a case of another town or year: refused.
  assert.throws(() => w2.submit("life.part", part));
  assert.throws(() =>
    w2.submit("life.part", { ...part, case: `${c0.ref}9`, form: "bench", sentence: "banish" }),
  );
  assert.throws(() => w2.submit("life.part", { ...part, case: `case:town:9:9:${y}:1` }));
  assert.throws(() => w2.submit("life.part", { ...part, case: `case:${court.ref}:${y - 1}:1` }));
});

test("one the hand is laid from keeps what they were for their group, by name, and is offered its part", () => {
  const w3 = peopledWorld("juniper", 60, { start: "spread" }),
    y = yearNow(w3),
    town = populationContext(w3)
      .settlements.all()
      .filter((t) => t.population > 0 && t.founded < y)
      .find((t) => townLifeOf(w3, t.ref).goings.some((g) => g.kind === "collect"))!,
    before = townLifeOf(w3, town.ref),
    g = before.goings.find((x) => x.kind === "collect")!,
    who = before.named.find((p) => p.ref === g.who[0])!;
  assert.ok(who, "its collector, by the town's lines");
  // Laid from them, as their page's Live as them lays it.
  w3.runTo(
    w3.submit("hand.lay", {
      village: town.ref,
      as: { name: who.name, age: who.age, occupation: 5, sex: who.sex },
    }).t,
  );
  const under = townLifeOf(w3, town.ref),
    now = under.goings.find((x) => x.kind === "collect")!,
    me = under.named.find((p) => p.name === who.name);
  assert.ok(me && me.ref.startsWith("agent:"), `${who.name} is one of the hand's, by name`);
  assert.ok(now.who.includes(me.ref), `${who.name} still collects: ${now.who.join(",")}`);
  assert.equal(now.who.length, g.who.length, "and no more collect than did");
  const parts = roleOffers(w3, town.ref, me.ref, me.name).flatMap((o) =>
    o.part ? [o.part.what] : [],
  );
  assert.deepEqual(parts, ["rounds", "lielow"]);
});

test("the hand is told who was what when it is laid, and keeps it: a save loaded with the hand resting has the lived one at their part", () => {
  // One who took a part up from another the court holds: no reading of the town's lines alone says they are of it. Kestrel at
  // 400, a town of the lands the chiefdom of Groris sent its soldiers into, where two of the cartel's guards were taken.
  const make = () => peopledWorld("kestrel", 400, { start: "spread" }),
    build = () => makePopulationWorld(seedFromText("kestrel"), { start: "spread" }),
    reload = (w: ReturnType<typeof make>) =>
      loadWorld(deserialize(serialize(saveWorld(w, "r"))) as SaveDocument, build, "r").world,
    w4 = make(),
    lands = new Set(
      [...politiesOf(w4).living()].flatMap((r) =>
        (underworldOf(w4)?.of(r.ref)?.ops ?? [])
          .filter((o) => o.taken >= 1)
          .flatMap((o) => o.lands),
      ),
    ),
    town = populationContext(w4)
      .settlements.all()
      .filter((t) => t.population > 0 && lands.has(t.cell))
      .find((t) => townLifeOf(w4, t.ref).goings.some((g) => Object.keys(g.took ?? {}).length))!;
  assert.ok(town, "a town where one took a part up from another held");
  const before = townLifeOf(w4, town.ref),
    g = before.goings.find((x) => Object.keys(x.took ?? {}).length)!,
    who = before.named.find((p) => p.ref === Object.keys(g.took!)[0])!,
    asked = {
      village: town.ref,
      as: { name: who.name, age: who.age, occupation: 5, sex: who.sex },
    },
    at = (w: ReturnType<typeof make>) => {
      const under = townLifeOf(w, town.ref),
        me = under.named.find((p) => p.name === who.name);
      return {
        me,
        of: !!me && !!under.goings.find((x) => x.key === g.key)?.who.includes(me.ref),
      };
    };
  // As the host lays it for any page: told who of the town was of each thing, by name, read before the hand is on it.
  const told = EARTH.told!(w4, "hand.lay", asked) as typeof asked & {
    was: { key: string; names: string[] }[];
  };
  assert.deepEqual(told.was, linesWere(w4, town.ref));
  assert.ok(told.was.find((x) => x.key === g.key)?.names.includes(who.name));
  // (Nothing else is told anything, and a hand told already is left as told.)
  assert.equal(EARTH.told!(w4, "hand.lift", {}), undefined);
  assert.equal(EARTH.told!(w4, "hand.lay", told), undefined);
  w4.runTo(w4.submit("hand.lay", told).t);
  assert.deepEqual(handOf(w4).resting?.was, told.was);
  assert.ok(at(w4).of, `${who.name} is of it under the hand`);
  // Saved and loaded: another world in memory, with nothing read of the town before the hand.
  const back = reload(w4);
  assert.deepEqual(handOf(back).resting?.was, told.was);
  const kept = at(back);
  assert.ok(kept.me?.ref.startsWith("agent:"), `${who.name} is one of the hand's, by name`);
  assert.ok(kept.of, `${who.name} is of it still after the load`);
  assert.ok(
    roleOffers(back, town.ref, kept.me!.ref, kept.me!.name).some((o) => o.part),
    "and is offered its part",
  );
  // Laid untold, the hand is as it ever was: of it while this world is in memory, and not after a load.
  const w5 = make();
  townLifeOf(w5, town.ref);
  w5.runTo(w5.submit("hand.lay", asked).t);
  assert.equal("was" in handOf(w5).resting!, false);
  assert.ok(at(w5).of);
  assert.equal(at(reload(w5)).of, false, "untold, a load forgets it");
  // What it is told is refused when it is not names by key.
  const w6 = make();
  for (const was of [
    "all",
    [{ key: "", names: [] }],
    [{ key: "k", names: [7] }],
    Array.from({ length: 65 }, (_, i) => ({ key: `k${i}`, names: ["a"] })),
  ])
    assert.throws(() => w6.submit("hand.lay", { ...asked, was }), /was must be/);
});
