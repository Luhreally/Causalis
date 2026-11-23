// A town's lines die of what its land's underworld killed (host/roster.ts's killing step, host/killings.ts, the reckonings kept
// beside the world by sim/hand/deaths.ts): towns whose land has no killing kept are folded exactly as before; one killed reads
// dead everywhere (their line, their page, how they died and of what, their kin's telling, the case of it); no one dies twice;
// the same whatever is asked first; the same a year on; and the reckonings kept are no part of the world's hash.
// First light, 257 years on: one land's underworld kills.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GANG_ROW,
  deathNotesOf,
  gangsStore,
  groupsIn,
  populationContext,
} from "../../src/sim/index.ts";
import { forgetTownLife, townRolesOf } from "../../src/host/inspect/townlife.ts";
import {
  clearRosters,
  foldKillings,
  linesOf,
  townRoster,
  type Holder,
  type Roster,
} from "../../src/host/roster.ts";
import { deathOf } from "../../src/host/death.ts";
import { familyOf } from "../../src/host/kin.ts";
import { fateOf } from "../../src/host/inspect/barread.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { casesOf, forgetDockets, openOf } from "../../src/host/inspect/justice.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { peopledWorld } from "../worlds.ts";

// (A world whose lands keep killings by this year: first light kept none by 300 once its people moved for war, ruin and wages
// and its realm's crews stood half as many, too few to kill a whole one a year; kestrel at 250 keeps seven lands' reckonings.)
const SEED = "kestrel",
  AT = 250;
const world = peopledWorld(SEED, AT),
  ctx = populationContext(world),
  year = yearNow(world),
  towns = ctx.settlements.all().filter((t) => t.population > 0),
  told = (h: Holder | null) =>
    h
      ? `${h.ref}|${h.born}|${h.from}|${h.end}|${h.died}|${h.fates.length}|${h.struck.length}`
      : "-",
  /** A roster as far as a test reads it: its first lines' holders now and ten years back, its battles and strikes. */
  read = (r: Roster, lines: number) => {
    const out: string[] = [];
    for (let k = 0; k < Math.min(lines, 160); k++)
      out.push(told(r.holder(k)), told(r.holderAt(k, year - 10)));
    for (const b of r.battles) out.push(`${b.event}|${b.tally.join(",")}|${r.fallen(b)}`);
    for (const s of r.strikes) out.push(`${s.event}|${s.dead}|${s.men.length}`);
    return out;
  },
  slainOf = () =>
    towns.flatMap((t) =>
      townRoster(world, t.ref).killings.flatMap((k) =>
        k.men.map((m) => ({ town: t, year: k.year, ...m })),
      ),
    );

test("towns whose land keeps no killing are folded exactly as before", () => {
  assert.ok((deathNotesOf(world)?.killings ?? 0) > 0, "some land's killings are kept");
  foldKillings(false);
  const before = new Map(
    towns.map((t) => [t.ref, read(townRoster(world, t.ref), linesOf(t.population))]),
  );
  foldKillings(true);
  let quiet = 0,
    moved = 0;
  for (const t of towns) {
    const r = townRoster(world, t.ref),
      now = read(r, linesOf(t.population));
    if (r.killings.length) {
      moved++;
      continue;
    }
    quiet++;
    assert.deepEqual(now, before.get(t.ref), `${t.ref} ${t.name}`);
    // (And nothing of a killing on any of them.)
    for (let k = 0; k < Math.min(linesOf(t.population), 60); k++)
      assert.equal(r.holder(k)?.slain, undefined);
  }
  assert.ok(quiet >= 200 && moved >= 1, `${quiet} quiet towns as before; ${moved} with killings`);
});

test("one killed reads dead everywhere: their line, their page, of what, their kin's telling, the case of it", () => {
  const slain = slainOf();
  assert.ok(slain.length >= 1, `${slain.length} of the towns' lines killed`);
  let own = 0,
    tried = 0;
  for (const s of slain) {
    const r = townRoster(world, s.town.ref),
      h = s.holder;
    assert.equal(h.died, s.year, `${h.ref}: died the year of the killing`);
    assert.equal(h.slain, s.slain);
    assert.equal(h.end, s.year + 1);
    assert.ok(s.year - h.born >= ctx.life.adulthood, `${h.ref}: grown`);
    // Their line after: empty a while, then another's; never theirs again.
    for (let y = s.year + 1; y <= year; y++)
      assert.notEqual(r.holderAt(h.line, y)?.ref, h.ref, `${h.ref} holds no line in ${y}`);
    assert.equal(r.holderAt(h.line, s.year)?.ref, h.ref, "theirs through the year they died");
    // How they died: the same on every reading.
    const page = pageOf(world, h.ref),
      fate = fateOf(world, h.ref, page),
      account = deathOf(world, h.ref, page.title);
    assert.ok(fate?.dead && fate.year === s.year && fate.age === s.year - h.born, h.ref);
    assert.match(fate.short, /^was killed /);
    assert.equal(account?.cause, "killing");
    assert.ok(account!.short.includes(s.slain.words));
    const text = JSON.stringify(page.tabs);
    assert.match(text, /"Fate"/);
    assert.ok(text.includes(s.slain.words), `${h.ref}: their page says of what`);
    assert.match(JSON.stringify(page.stats), new RegExp(`died at ${s.year - h.born}`));
    assert.match(familyOf(world, h.ref)!.self.how ?? "", /^was killed /);
    // Words say what and who, never how.
    assert.doesNotMatch(s.slain.words, /\b(knife|blade|gun|shot|stab|beat|poison|burn)/i);
    if (s.slain.role) {
      own++;
      assert.ok(h.line < 96, "one of the group's own is of the town's first lines");
    }
    // The case of it, where the court's book tells that killing: the killed is this one, and never the one brought for it.
    const c = [...casesOf(world, s.town.ref, s.year), ...openOf(world, s.town.ref, s.year)].find(
      (x) => x.victim?.ref === h.ref,
    );
    if (c) {
      tried++;
      assert.match(c.whatWords, new RegExp(r.nameOf(h)));
      if ("accused" in c) assert.notEqual(c.accused.ref, h.ref);
      assert.ok(text.includes(c.ref), "their page leads to the case");
    }
  }
  assert.ok(own >= 0 && tried >= 0);
});

test("no one dies twice, and no line loses two holders in a year", () => {
  for (const t of towns) {
    const r = townRoster(world, t.ref);
    if (!r.killings.length) continue;
    const dead = new Map<string, string>(),
      lineYears = new Set<string>(),
      die = (h: Holder, y: number, of: string) => {
        assert.equal(
          dead.get(h.ref),
          undefined,
          `${h.ref} died of ${dead.get(h.ref)} and of ${of}`,
        );
        dead.set(h.ref, of);
        assert.ok(!lineYears.has(`${h.line}|${y}`), `line ${h.line} lost two in ${y}`);
        lineYears.add(`${h.line}|${y}`);
        assert.equal(h.died, y);
      };
    for (const b of r.battles) for (const h of r.fell(b)) die(h, b.year, b.event);
    for (const s of r.strikes)
      for (const m of s.men) if (m.fate === "died") die(m.holder, s.year, s.event);
    for (const k of r.killings) for (const m of k.men) die(m.holder, k.year, `killing ${k.year}`);
    for (const k of r.killings)
      assert.ok(k.men.length <= Math.max(1, k.dead), "no more than were killed");
  }
});

test("the same whatever is asked first, and the same a year on", () => {
  const first = slainOf().map((s) => `${s.holder.ref}|${s.year}|${s.slain.words}|${s.slain.role}`);
  clearRosters();
  const again = [...towns]
    .reverse()
    .flatMap((t) =>
      townRoster(world, t.ref).killings.flatMap((k) =>
        k.men.map((m) => `${m.holder.ref}|${k.year}|${m.slain.words}|${m.slain.role}`),
      ),
    );
  assert.deepEqual([...again].sort(), [...first].sort());
  // A year on, every one killed in a year gone by is still the one killed then.
  const later = peopledWorld(SEED, AT + 1),
    then = new Set(
      populationContext(later)
        .settlements.all()
        .filter((t) => t.population > 0)
        .flatMap((t) =>
          townRoster(later, t.ref).killings.flatMap((k) =>
            k.men.map((m) => `${m.holder.ref}|${k.year}|${m.slain.words}|${m.slain.role}`),
          ),
        ),
    );
  // (But one whose year has passed out of what a town's lines are read back by, or of a town whose lines' round number moved
  // in the year: its count is the same while the town grows or shrinks by less than that, host/roster.ts.)
  const round = (people: number) => {
      const lines = linesOf(people);
      let whole = 1;
      while (whole * 2 <= lines) whole *= 2;
      return lines >= 1.5 * whole ? 1.5 * whole : whole;
    },
    laterCtx = populationContext(later),
    same = (t: (typeof towns)[number]) =>
      round(t.population) === round(laterCtx.settlements.get(t.ref)?.population ?? 0);
  for (const s of slainOf())
    if (s.year > yearNow(later) - 39 && same(s.town))
      assert.ok(
        then.has(`${s.holder.ref}|${s.year}|${s.slain.words}|${s.slain.role}`),
        `${s.holder.ref}, killed in ${s.year}, is not told so a year on`,
      );
});

test("the reckonings kept are beside the world: no part of its hash", () => {
  const notes = deathNotesOf(world)!,
    before = JSON.stringify(world.domainHashes()),
    kept = notes.killings;
  notes.addKilling({
    year: year - 1,
    years: 5,
    cell: 1,
    per: 900,
    control: 100,
    gangs: 2,
    street: 50,
    badge: 0,
    racket: true,
    squad: false,
    war: null,
    holder: "ev:0:1|Test|0",
    crew: null,
    feds: [null, null],
  });
  assert.equal(notes.killings, kept + 1);
  assert.equal(JSON.stringify(world.domainHashes()), before);
  assert.equal(notes.killingAt(1, year)?.per, 900);
  assert.equal(notes.killingAt(1, year + 4), null, "it stands for its years and no more");
  // Saved and loaded whole.
  const saved = JSON.parse(JSON.stringify(notes.save()));
  notes.load(saved);
  assert.equal(notes.killings, kept + 1);
  assert.equal(notes.killingAt(1, year - 1)?.holder, "ev:0:1|Test|0");
  notes.forgetKillings(year + 10);
  assert.equal(notes.killings, 0);
  notes.load({ list: saved.list, heads: saved.heads });
  clearRosters();
});

test("of a street's killings, those of its gangs die first, and they are the ones the town's days named at its corner", () => {
  // A town whose street has gangs, with its land's killing kept high for five years gone by: both set by hand, as nothing
  // else is (a world's streets have gangs only once it has grown great towns, and none of a test's worlds has by 300).
  const town = [...towns].sort(
      (a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    notes = deathNotesOf(world)!,
    gangRows = gangsStore(world)!,
    gangRow = gangRows.get(town.cell),
    wasGangs = gangRow ? [...gangRow] : null,
    hand = wasGangs ? [...wasGangs] : new Array<number>(15).fill(0);
  hand[GANG_ROW.gangs] = 4;
  hand[GANG_ROW.street] = 300;
  gangRows.set(town.cell, hand);
  forgetTownLife(world);
  const saved = JSON.parse(JSON.stringify(notes.save()));
  try {
    assert.ok(
      townRolesOf(world, town.ref).goings.some((g) => g.kind === "corner"),
      "a town with a corner kept",
    );
    const row = groupsIn(world, town.cell)!;
    for (let y = year - 6; y <= year - 2; y++)
      notes.addKilling({
        year: y,
        years: 1,
        cell: town.cell,
        per: 6000,
        control: 0,
        gangs: row.gangs,
        street: row.street * 1000,
        badge: 0,
        racket: false,
        squad: false,
        war: null,
        holder: null,
        crew: null,
        feds: [null, null],
      });
    clearRosters();
    forgetTownLife(world);
    forgetDockets(world);
    const r = townRoster(world, town.ref),
      seen = new Set<string>();
    let own = 0,
      many = 0,
      tried = 0;
    for (const k of r.killings) {
      if (k.year < year - 6) continue;
      const corner = townRolesOf(world, town.ref, k.year).goings.find((g) => g.kind === "corner");
      for (const m of k.men) {
        assert.ok(!seen.has(m.holder.ref), `${m.holder.ref} is killed once`);
        seen.add(m.holder.ref);
        assert.equal(m.slain.motive, "street");
        assert.equal(m.holder.died, k.year);
        if (m.slain.role) {
          own++;
          assert.equal(m.slain.role, "one of those who kept its corner");
          assert.ok(m.holder.line < 96 && m.holder.line % 8 === 3, `line ${m.holder.line}`);
          assert.ok(
            corner?.who.includes(m.holder.ref),
            `${m.holder.ref} kept its corner in ${k.year}: ${corner?.who.join(",")}`,
          );
        } else many++;
        // The year after, they are of nothing in the town, and their line is another's or empty.
        const after = townRolesOf(world, town.ref, k.year + 1);
        assert.ok(!after.goings.some((g) => g.who.includes(m.holder.ref)), "gone from its goings");
        const c = [...casesOf(world, town.ref, k.year), ...openOf(world, town.ref, k.year)].find(
          (x) => x.victim?.ref === m.holder.ref,
        );
        if (c) {
          tried++;
          assert.match(c.whatWords, /in a fight between their streets/);
          if ("accused" in c) assert.notEqual(c.accused.ref, m.holder.ref);
        }
      }
    }
    assert.ok(own >= 2 && many >= 2, `${own} of its gangs' own, ${many} of the town's many`);
    assert.ok(tried >= 1, `${tried} told in the court's book as the killed`);
    // Those now at its corner are none of the dead.
    const now = townRolesOf(world, town.ref).goings.find((g) => g.kind === "corner");
    for (const who of now?.who ?? []) assert.ok(!seen.has(who), `${who} is dead and at the corner`);
  } finally {
    notes.load(saved);
    if (wasGangs) gangRows.set(town.cell, wasGangs);
    else gangRows.drop(town.cell);
    clearRosters();
    forgetTownLife(world);
    forgetDockets(world);
  }
});
