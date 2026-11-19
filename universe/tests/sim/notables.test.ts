// Notable people (sim/notable/notables.ts; rules/notables.ts): who a people notice, their kind read off what they did.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import {
  ACTS,
  DOMAIN,
  DOMAINS,
  NOTE,
  arisesChance,
  commandTerm,
  fieldGain,
  gainKept,
  keepsPersons,
  namesHeld,
  talentOf,
} from "../../src/rules/index.ts";
import {
  NOTABLE_EVENTS,
  commandAfter,
  commandIn,
  favourNotable,
  firstField,
  notableCommands,
  notableRef,
  notableTargets,
  notablesOf,
  notablesYear,
  politiesOf,
  populationContext,
  strikeNotable,
} from "../../src/sim/index.ts";
import { notableTitle, why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

test("the rules: a heavy tail from the line up, more doers and a readier land make more, a crowd of names fewer", () => {
  assert.equal(talentOf(0), NOTE.line);
  assert.ok(talentOf(0.5) > NOTE.line && talentOf(0.5) < 2 * NOTE.line);
  assert.ok(talentOf(0.999) > 5 * NOTE.line && talentOf(1) <= NOTE.most);
  const d = DOMAIN.making,
    base = arisesChance(d, 2000, 0.5, 0.5, 1, 0, 8);
  assert.ok(base > 0 && base < 1, `${base}`);
  assert.ok(arisesChance(d, 20000, 0.5, 0.5, 1, 0, 8) > base);
  assert.ok(arisesChance(d, 2000, 1, 0.5, 1, 0, 8) > base);
  assert.ok(arisesChance(d, 2000, 0.5, 1, 1, 0, 8) > base);
  assert.ok(arisesChance(d, 2000, 0.5, 0.5, 1, 3, 8) < base);
  // (No one is a commander without a battle: war has no doers' draw.)
  assert.equal(arisesChance(DOMAIN.war, 1e6, 1, 1, 1, 0, 8), 0);
  // (A commander of the line's standing changes nothing; none adds or takes more than the bound.)
  assert.equal(commandTerm(NOTE.line), 1);
  assert.ok(commandTerm(NOTE.most) <= 1 + ACTS.command && commandTerm(0) >= 1 - ACTS.command);
  assert.ok(fieldGain(1000, 5000, 9000, true) > fieldGain(1000, 9000, 5000, true));
  assert.ok(fieldGain(1000, 5000, 5000, false) < 0);
  assert.ok(gainKept(0) === 1 && gainKept(4000) < 0.5);
  assert.deepEqual([50, 1e3, 1e4, 1e6, 1e9].map(namesHeld), [0, 2, 3, 5, NOTE.keepLand]);
  assert.ok(keepsPersons(0.5) && !keepsPersons(0.95));
});

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world),
  store = notablesOf(world)!;

test("a peopled world keeps people by name, of more than one domain, each with a deed and within what its lands hold", () => {
  const all = store.all();
  assert.ok(all.length >= 5, `${all.length} kept at 400`);
  const fields = new Set(all.map((n) => DOMAINS[firstField(n)]));
  assert.ok(fields.size >= 3, [...fields].join(","));
  for (const n of all) {
    assert.ok(n.deeds.length >= 1 && n.deeds.length <= NOTE.deeds);
    assert.ok(n.standing >= NOTE.line / 2 || n.post, `${n.name} ${n.standing}`);
    assert.ok(n.born < n.since);
    assert.equal(
      n.standing,
      Math.min(
        NOTE.most,
        n.by.reduce((s, x) => s + x, 0),
      ),
    );
    assert.match(notableTitle(world, n), /\w/);
  }
  const perLand = new Map<number, number>();
  for (const n of all) if (!n.post) perLand.set(n.home, (perLand.get(n.home) ?? 0) + 1);
  for (const [cell, k] of perLand)
    assert.ok(k <= Math.max(1, namesHeld(ctx.provinces.get(cell)!.total())), `land ${cell}: ${k}`);
  assert.ok(all.length <= NOTE.keepWorld + politiesOf(world).living().length);
});

test("a rising told has its causes, and the dead are kept as short records", () => {
  const told = world.events.all().filter((e) => e.type === NOTABLE_EVENTS.arose.type);
  for (const e of told.slice(-3)) {
    assert.ok(e.subjects[0]!.startsWith("nota:"));
    assert.match(why(world, e.id).claim, /came to be known/);
  }
  for (const g of store.gone()) {
    assert.ok(g.died >= g.since && g.deeds.length <= 2);
    assert.ok(
      ["age", "ills", "battle", "taken", "sickness", "purge", "struck", "killed"].includes(g.how),
    );
  }
});

test("a host has a commander when it fights; the day moves their standing; one who falls leaves it shaken", () => {
  const [a, b] = politiesOf(world).living();
  assert.ok(a && b);
  const t = world.now as SimTime,
    year = Math.floor(t / YEAR),
    ledA = commandIn(ctx, a, t)!,
    ledB = commandIn(ctx, b, t)!;
  assert.equal(commandIn(ctx, a, t)!.id, ledA.id, "the same one commands until they are gone");
  const na = store.get(ledA.id)!,
    nb = store.get(ledB.id)!,
    before = [na.by[DOMAIN.war]!, nb.by[DOMAIN.war]!],
    battle = world.events.emit({ type: "war.battle", subjects: [a.ref, b.ref], place: null });
  commandAfter(ctx, [ledA, ledB], [a, b], true, [4000, 6000], battle, "Somewhere", t);
  const wa = store.get(ledA.id),
    wb = store.get(ledB.id);
  if (wa) {
    assert.ok(wa.by[DOMAIN.war]! > before[0]!);
    assert.ok(notableCommands(world, a.ref, year) > 1);
    assert.match(notableTitle(world, wa, "the realm"), /victor of .*battle/);
  } else assert.ok(store.goneOf(ledA.id), "fell, and is kept among the dead");
  if (wb) {
    assert.ok(wb.by[DOMAIN.war]! < before[1]!);
    assert.ok(notableCommands(world, b.ref, year) < 1);
  } else {
    assert.ok(["battle", "taken"].includes(store.goneOf(ledB.id)!.how));
    assert.ok(notableCommands(world, b.ref, year) < 1, "its host is shaken");
  }
  // (The god's hand, and a group's: one struck is dead at once and their host shaken; a favour holds until its year.)
  const live = commandIn(ctx, a, t)!;
  assert.ok(favourNotable(world, live.id, "bless", year + 10, battle));
  assert.equal(store.get(live.id)!.favour!.kind, "bless");
  assert.ok(notableTargets(world, a.members).length >= 1);
  assert.ok(strikeNotable(ctx, live.id, "struck", battle, t));
  assert.equal(store.get(live.id), undefined);
  assert.equal(store.goneOf(live.id)!.how, "struck");
  assert.ok(notableCommands(world, a.ref, year) < 1);
  assert.equal(notableRef(live.id), `nota:0:${live.id}`);
});

test("a thing found has its finder, and a year's telling stays within its budget", () => {
  const cell = ctx.provinces.all().find((p) => p.total() > 500)!.cell,
    year = Math.floor(world.now / YEAR) + 1,
    before = store.in(cell).filter((n) => n.by[DOMAIN.knowledge]! > 0).length,
    told = world.events.count;
  let made = 0;
  for (let k = 0; k < 6; k++) {
    world.events.emit({
      type: "lore.found",
      importance: 5,
      place: ctx.provinces.get(cell)!.ref,
      data: { principle: "pottery" },
    });
    notablesYear(ctx, ((year + k) * YEAR) as SimTime);
    made = store.in(cell).filter((n) => n.by[DOMAIN.knowledge]! > 0).length;
    if (made > before) break;
  }
  assert.ok(made > before, "no one found it");
  const finder = store.in(cell).find((n) => n.deeds.some((d) => d.w === "lore.found"))!;
  assert.match(notableTitle(world, finder), /first came upon/);
  let risings = 0;
  for (let i = told; i < world.events.count; i++)
    if (world.events.at(i).type.startsWith("notable.")) risings++;
  assert.ok(risings <= 6 * NOTE.told, `${risings} told`);
});

test("the god's inspiring of a land makes someone of it known, and what the land then finds is theirs", () => {
  const p = ctx.provinces
      .all()
      .find((x) => x.total() > 500 && !store.in(x.cell).some((n) => n.by[DOMAIN.knowledge]! > 0))!,
    year = Math.floor(world.now / YEAR) + 1;
  world.events.emit({ type: "act.inspire", importance: 5, place: p.ref });
  world.events.emit({
    type: "lore.found",
    importance: 5,
    place: p.ref,
    data: { principle: "pottery" },
  });
  notablesYear(ctx, (year * YEAR) as SimTime);
  const shown = store.in(p.cell).find((n) => n.deeds.some((d) => d.w === "act.inspire"));
  assert.ok(shown, "no one was shown");
  assert.ok(
    shown.deeds.some((d) => d.w === "lore.found"),
    "the one shown is the one who found it",
  );
  assert.equal(firstField(shown), DOMAIN.knowledge);
});
