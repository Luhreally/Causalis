// Those of a group the realm's soldiers took, and the collector killed as a land is taken over (host/inspect/grave.ts,
// host/roster.ts's killing step, host/killings.ts). Kestrel 380 years on, spread: a realm's soldiers were sent against a group
// in 374–379, and some of those the court holds for it are still held, one of them where the town's lines would have them at
// its head's door now (by 397 none is: a guard grows past the young, and is drawn no longer).
import { test } from "node:test";
import assert from "node:assert/strict";
import { deathNotesOf, politiesOf, populationContext, underworldOf } from "../../src/sim/index.ts";
// (The court's reading first: its grave matters are read by it, and entered alone they meet it half made.)
import { casesOf, forgetDockets, heldCaseOf, heldWords } from "../../src/host/inspect/justice.ts";
import { cameOfGrave, type CourtRead, type Draft } from "../../src/host/inspect/grave.ts";
import { forgetTownLife, townLifeOf, townRolesOf } from "../../src/host/inspect/townlife.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { clearRosters, townRoster } from "../../src/host/roster.ts";
import { takeoverOf } from "../../src/host/killings.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 380, { start: "spread" }),
  ctx = populationContext(world),
  year = yearNow(world),
  towns = ctx.settlements.all().filter((t) => t.population > 0),
  text = (x: unknown): string => JSON.stringify(x);

test("one of a group the soldiers took stands in the court's book, is held as given, and another has their part", () => {
  const ops = [...politiesOf(world).living()].flatMap((r) =>
    (underworldOf(world)?.of(r.ref)?.ops ?? []).map((o) => ({ r, o })),
  );
  const fought = ops.filter(
    ({ r, o }) =>
      o.taken >= 1 &&
      underworldOf(world)!
        .of(r.ref)!
        .groups.some((g) => g.id === o.target),
  );
  assert.ok(
    fought.length >= 1,
    `${ops.length} sendings of soldiers, ${fought.length} with any taken`,
  );
  const inLands = new Set(fought.flatMap(({ o }) => o.lands));
  let named = 0,
    held = 0,
    drawn = 0,
    outside = 0;
  // (A group's own are at something in few of a land's towns, its head's above all: those towns first, then others of the
  // land, where whoever was taken is of the group and of none of the town's lines. A land has hundreds of towns.)
  const theirs = (t: (typeof towns)[number], y: number) =>
    townRolesOf(world, t.ref, y).goings.some((g) => /^(mob|boss):/.test(g.of.ref));
  for (const { o } of fought) {
    const last = Math.min(o.ended ?? year, year),
      inLand = towns.filter((x) => o.lands.includes(x.cell)),
      own = inLand.filter((t) => theirs(t, last));
    for (const t of [...own, ...inLand.filter((t) => !own.includes(t))].slice(0, 12))
      for (let y = Math.max(o.since, year - 30); y <= last; y++) {
        const cs = casesOf(world, t.ref, y).filter((c) => c.offence === "taken");
        assert.ok(cs.length <= 1, `${t.ref} ${y}: one for each sending`);
        for (const c of cs) {
          // Held as given: at the realm's works or shut in, for years, whoever sits.
          assert.ok(c.sentence === "labour" || c.sentence === "cell", c.sentence);
          assert.ok(c.days >= 2 * 365, `${c.days} days`);
          assert.match(
            c.came,
            /bound to the realm's works|shut in by the realm|sealed in the realm's holding/,
          );
          assert.match(c.whatWords, /^was taken by the soldiers .+ sent against /);
          assert.ok(c.group, "the group it is of");
          if (c.accused.outside) {
            outside++;
            continue;
          }
          named++;
          // One of the group's own in the town, by the town's lines.
          const roles = townRolesOf(world, t.ref, y);
          assert.ok(
            roles.goings.some((g) => g.who.includes(c.accused.ref)),
            `${c.accused.name} was of the group here in ${y}`,
          );
          if (c.day + c.days < year * 365) continue;
          held++;
          assert.equal(heldCaseOf(world, t.ref, c.accused.ref)?.ref, c.ref);
          assert.match(heldWords(world, t.ref, c.accused.ref) ?? "", /locked up|set to labour/);
          assert.match(text(pageOf(world, c.accused.ref)), /Locked up|Set to labour/);
          assert.match(text(pageOf(world, c.ref)), /taken by the soldiers/);
          // (One the town's lines would have at it now, were they not held: one their years have taken off it since, as
          // a guard grown past the young, is at nothing of it now, held or not.)
          if (!townRolesOf(world, t.ref, year).goings.some((g) => g.who.includes(c.accused.ref)))
            continue;
          drawn++;
          // Off what they were at, another in their place, and told as who they were for it.
          const life = townLifeOf(world, t.ref);
          assert.ok(
            life.goings.every((g) => !g.who.includes(c.accused.ref)),
            "the one held is off what they were at",
          );
          assert.ok(life.past.some((p) => p.ref === c.accused.ref && p.case.ref === c.ref));
        }
      }
  }
  assert.ok(
    named >= 1 && held >= 1 && drawn >= 1,
    `${named} named of the town's lines, ${held} held now (${drawn} of a part now), ${outside} not of them`,
  );
  // A town in no such land has no such case.
  let quiet = 0;
  for (const t of towns.filter((x) => !inLands.has(x.cell)).slice(0, 150)) {
    quiet++;
    for (const y of [year - 1, year])
      assert.ok(
        casesOf(world, t.ref, y).every((c) => c.offence !== "taken"),
        t.ref,
      );
  }
  assert.ok(quiet >= 100);
});

test("what is laid on one taken is as given, whatever the court's draws", () => {
  const court: CourtRead = {
      form: "magistrate",
      reach: 1,
      convicts: true,
      strict: true,
      far: false,
      grips: true,
      coined: true,
      bread: 1,
      food: "bread",
      places: [],
    },
    d: Draft = {
      offence: "taken",
      key: "k",
      gravity: 4,
      stands: { kind: "outside", ref: "mob:pol:0:1:ev:0:1", name: "one of the family's own" },
      wronged: null,
      what: () => ["was taken"],
      why: [],
      // (Held and paid as far as can be: nothing of it undoes what the realm's soldiers did.)
      hold: 1,
      paid: 1,
      brought: true,
      forced: { sentence: "labour", years: 3 },
    };
  for (let h = 0; h < 400; h++) {
    const c = cameOfGrave(court, d, 1, (h * 2654435761) >>> 0, false);
    assert.equal(c.outcome, "labour");
    assert.equal(c.days, 3 * 365);
    assert.equal(c.came, "was bound to the realm's works for three years");
    const cell = cameOfGrave(
      { ...court, form: "elders" },
      { ...d, forced: { sentence: "cell", years: 2 } },
      0,
      h,
      true,
    );
    assert.equal(cell.sentence, "cell");
    assert.equal(cell.days, 2 * 365);
  }
});

test("a land taken over: the one who collected for the group that lost it is the first killed of that year", () => {
  const notes = deathNotesOf(world)!;
  // A land whose reckonings name one holder and then another, and its greatest town.
  let found: { cell: number; y: number; realm: string } | null = null;
  for (const cell of new Set(towns.map((t) => t.cell))) {
    const realm = politiesOf(world).of(cell)?.ref;
    for (let y = year - 40; realm && y < year && !found; y++) {
      const k = notes.killingAt(cell, y);
      if (k && takeoverOf(k, notes.killingAt(cell, y - 1), y, realm)) found = { cell, y, realm };
    }
    if (found) break;
  }
  assert.ok(found, "a land was taken over in these forty years");
  const { cell, y, realm } = found,
    town = towns.filter((t) => t.cell === cell).sort((a, b) => b.population - a.population)[0]!,
    k = notes.killingAt(cell, y)!,
    over = takeoverOf(k, notes.killingAt(cell, y - 1), y, realm)!;
  // The same year reckoned bloodier (the years after told again, in their order): some of its lines die of it. No run of
  // these worlds has a takeover in a year bloody enough to fall on a town's lines, so the year is made so here.
  const later = [];
  for (let z = y + 1; z < year; z++) {
    const n = notes.killingAt(cell, z);
    if (n && n.year === z) later.push(n);
  }
  notes.addKilling({ ...k, per: 30_000, racket: true });
  for (const n of later) notes.addKilling(n);
  clearRosters();
  forgetDockets(world);
  forgetTownLife(world);
  const roster = townRoster(world, town.ref),
    killing = roster.killings.find((x) => x.year === y);
  assert.ok(killing && killing.men.length >= 1, `${town.ref} ${y}: some of its lines killed`);
  const first = killing.men.find((m) => m.slain.j === 0);
  assert.ok(first, "the first of the year's killings fell on one of its lines");
  assert.equal(first.slain.role, "its collector");
  assert.equal(first.slain.of?.event, over.lost.event);
  assert.equal(first.slain.by?.event, over.took.event);
  assert.equal(first.slain.words, `when ${over.took.name} took this land from ${over.lost.name}`);
  // No other of the year is told so.
  for (const m of killing.men)
    if (m !== first) assert.doesNotMatch(m.slain.words, /took this land/);
  // Their page says of what, and the case of it names them as the one killed and never as the one brought.
  assert.match(text(pageOf(world, first.holder.ref)), /took this land from/);
  const c = casesOf(world, town.ref, y).find((x) => x.victim?.ref === first.holder.ref);
  if (c) {
    assert.match(c.whatWords, /who collected for .+, when .+ took this land from it/);
    assert.notEqual(c.accused.ref, first.holder.ref);
  }
});
