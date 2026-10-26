import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, hashString, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import {
  EMPTY_MOST,
  LINE,
  ROSTER_YEARS,
  clearRosters,
  folkWork,
  lineShape,
  rosterOf,
  townRoster,
  workOf,
  type Holder,
  type Roster,
} from "../../src/host/roster.ts";
import { parseTownsfolkRef } from "../../src/bridge/index.ts";
import { HUMANLIKE, OCC, bandOf } from "../../src/rules/index.ts";
import {
  LOCAL_ACT_EVENTS,
  citiesOf,
  fighting,
  lifeOf,
  populationContext,
  warsOf,
  type Battle,
} from "../../src/sim/index.ts";

// Phase 55 M225: a town keeps its people by line, one of every twelve, each holder for a natural
// term. Its battles levy the eligible men of its lines by twelves of the men its tally sent, its
// fallen leave their lines empty a while, and a fire's dead come off its lines from the next year.
// Read from the record, never drawn: these are relations that hold whatever the record's numbers.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes());
const Y = Math.floor(world.now / YEAR),
  ctx = populationContext(world),
  life = lifeOf(world),
  shape = lineShape(life),
  fought = warsOf(world)
    .all()
    .flatMap((war) => war.battles.map((b) => ({ war, b }))),
  byEvent = new Map(fought.map(({ b }) => [b.event as string, b])),
  // ("Recent": its town tallies are kept.)
  recent = fought.filter(({ b }) => b.fell && b.year >= Y - ROSTER_YEARS);

// Each town's men in each recent battle side, as the record tells them: `${event}:${side}` → tally.
const tallies = new Map<string, Map<string, [number, number, number]>>(),
  rows: { ref: string; dead: number }[] = [];
for (const { b } of recent)
  for (const side of [0, 1] as const)
    for (const p of levyPlaces(world, b, side, Infinity)) {
      if (p.kind !== "town" || p.ref === null) continue;
      const of = tallies.get(p.ref) ?? new Map<string, [number, number, number]>();
      of.set(`${b.event}:${side}`, [p.sent, p.dead, p.hurt]);
      tallies.set(p.ref, of);
      if (p.dead > 0) rows.push({ ref: p.ref, dead: p.dead });
    }
// The towns: those of the town rows with dead among recent battles, most dead first, at most 300.
rows.sort((p, q) => q.dead - p.dead);
const towns: string[] = [];
for (const r of rows) if (!towns.includes(r.ref) && towns.length < 300) towns.push(r.ref);
const linesOf = (town: string) =>
  Math.ceil((ctx.settlements.get(town as Ref)?.population ?? 0) / LINE);

/** Grown, and of a band that fights (sim's rule). */
const fights = (age: number) => age >= life.adulthood && fighting(life, bandOf(age, life));
/** A roster battle's men as they can be compared across rosters: line, ref, fate. */
const menOf = (r: Roster, event: string) =>
  JSON.stringify(r.battle(event)?.men.map((m) => [m.line, m.holder.ref, m.fate]) ?? null);

test("there are towns that sent men to recent battles", () => {
  assert.ok(towns.length >= 20, `${towns.length} towns`);
});

test("the levy: eligible men, by twelves, the dead and wounded among them", () => {
  let fell = 0,
    dead = 0,
    levied = 0;
  for (const town of towns) {
    const r = townRoster(world, town),
      expected = tallies.get(town)!;
    // Every recent battle side it sent men to is folded, its tally the record's.
    assert.equal(r.battles.length, expected.size, `${town} battles`);
    let last = -Infinity;
    for (const rb of r.battles) {
      const at = `${town} ${rb.event}:${rb.side}`;
      assert.deepEqual(rb.tally, expected.get(`${rb.event}:${rb.side}`), `${at} tally`);
      assert.ok(rb.year >= last, `${at} oldest first`);
      last = rb.year;
      assert.equal(r.battle(rb.event)?.event, rb.event, `${at} found`);
      const [sent, d, hurt] = rb.tally,
        count = (fate: string) => rb.men.filter((m) => fate.includes(m.fate)).length;
      assert.ok(rb.men.length <= rb.eligible && rb.eligible <= rb.lines, `${at} eligible`);
      assert.ok(rb.men.length <= Math.ceil(sent / LINE), `${at} at most its twelves`);
      assert.ok(
        rb.men.length >= Math.min(rb.eligible, Math.floor(sent / LINE)),
        `${at} as many as it has`,
      );
      assert.ok(count("fell") <= Math.ceil(d / LINE), `${at} fell`);
      assert.ok(count("hurt maimed") <= Math.ceil(hurt / LINE), `${at} hurt`);
      if (!(byEvent.get(rb.event)!.maimed?.[rb.side] ?? 0))
        assert.equal(count("maimed"), 0, `${at} none maimed`);
      for (let i = 0; i < rb.men.length; i++) {
        const m = rb.men[i]!,
          age = rb.year - m.holder.born;
        assert.ok(i === 0 || rb.men[i - 1]!.line < m.line, `${at} by line, one a line`);
        assert.ok(m.line < rb.lines, `${at} a line of that day`);
        assert.equal(m.holder.sex, 1, `${at} a man`);
        assert.ok(age >= life.adulthood && fights(age), `${at} grown and fighting (${age})`);
        assert.ok(
          m.holder.fates.some((f) => f.event === rb.event && f.fate === m.fate),
          `${at} his fate told`,
        );
      }
      fell += count("fell");
      dead += d;
      levied += rb.men.length;
    }
  }
  assert.ok(levied > 0, "some men levied");
  // (By twelves: the fallen lines stand for about the dead.)
  if (dead >= 1200)
    assert.ok(Math.abs((fell * LINE) / dead - 1) <= 0.25, `${fell} fallen lines for ${dead} dead`);
});

test("a battle's own roster tells its men as today's does", () => {
  for (const town of towns) {
    const r = townRoster(world, town);
    for (const rb of r.battles)
      assert.equal(
        menOf(townRoster(world, town, rb.year + 1), rb.event),
        menOf(r, rb.event),
        `${town} ${rb.event}`,
      );
  }
});

test("a fallen holder is gone", () => {
  let fallen = 0;
  for (const town of towns) {
    const r = townRoster(world, town);
    for (const rb of r.battles)
      for (const m of rb.men) {
        if (m.fate !== "fell") continue;
        fallen++;
        const at = rb.year,
          h = m.holder,
          e = 1 + (h.key % EMPTY_MOST);
        assert.equal(h.died, at, `${h.ref} died`);
        assert.equal(h.end, at + 1, `${h.ref} end`);
        assert.notEqual(r.holder(m.line)?.ref, h.ref, `${h.ref} no longer holds it`);
        assert.equal(townRoster(world, town, at + 1).holder(m.line), null, `${h.ref} empty after`);
        if (at + e + 1 <= Y) {
          const next = townRoster(world, town, at + e + 1).holder(m.line);
          assert.ok(next && next.ref !== h.ref, `${h.ref} another holds it after ${e} years`);
          assert.equal(next.from, at + e + 1, `${h.ref} taken when the line is held again`);
        }
      }
  }
  assert.ok(fallen > 0, "some holder fell");
});

test("holders age; refs and names are their line's", () => {
  // (Upright apes hold a line thirty years, from four; a people of half the span half as long; the
  // longest-lived no more than 36.)
  assert.deepEqual(lineShape(HUMANLIKE), { span: 70, term: 30, youngest: 4 });
  assert.deepEqual(
    lineShape({ ...HUMANLIKE, bands: [0, 3, 5, 8, 10, 15, 20, 25, 30, 35], adulthood: 8 }),
    { span: 35, term: 15, youngest: 2 },
  );
  assert.equal(lineShape({ ...HUMANLIKE, bands: [0, 7, 13, 20, 26, 39, 53, 66, 79, 92] }).term, 36);
  let lines = 0,
    young = 0,
    men = 0;
  for (const town of towns) {
    const r = townRoster(world, town),
      past = townRoster(world, town, Y - 1),
      fresh = rosterOf(world, town, Y, fought),
      work = folkWork(world, ctx.settlements.get(town as Ref)!.cell),
      kinds = new Set(work.kinds);
    for (let k = 0; k < linesOf(town); k++) {
      const h = r.holder(k),
        was = past.holder(k);
      lines++;
      if (!h) continue;
      const at = `${town} line ${k}`,
        tau = Math.floor((h.n - 1) / 16),
        phi = hashString(`folk ${town} ${k}`) % shape.term,
        age = Y - h.born;
      if (age < life.adulthood) young++;
      else if (h.sex === 1 && fights(age)) men++;
      // (Their own line's, by their number: its key, its terms, their age on taking it.)
      assert.deepEqual(parseTownsfolkRef(h.ref), { town, line: k, n: h.n }, `${at} ref`);
      assert.equal(r.holderOf(k, h.n), h, `${at} the same holder by number`);
      assert.equal(h.key, hashString(`folk ${town} ${k} ${h.n}`), `${at} key`);
      assert.equal(h.sex, (h.key >>> 5) & 1, `${at} sex`);
      assert.equal(h.died, null, `${at} alive`);
      assert.equal(h.end, (tau + 1) * shape.term - phi, `${at} the end of the term`);
      assert.ok(h.from <= Y && Y < h.end, `${at} holds it now`);
      const took = h.from - h.born;
      assert.ok(took >= shape.youngest && took <= shape.span - shape.term, `${at} took at ${took}`);
      if (was?.ref === h.ref) assert.equal(was.born, h.born, `${at} the same born a year on`);
      // (Named in the land's tongue: given and family, the same however often asked.)
      const name = r.nameOf(h);
      assert.equal(name.split(" ").length, 2, `${at} two words: ${name}`);
      assert.equal(fresh.nameOf(fresh.holderOf(k, h.n)!), name, `${at} the same name again`);
      if (age >= life.adulthood) assert.ok(kinds.has(workOf(h.key, work)), `${at} work`);
    }
  }
  // (About an eighth children, about a third men of fighting age.)
  assert.ok(young / lines > 0.08 && young / lines < 0.2, `children ${young} of ${lines}`);
  assert.ok(men / lines > 0.28 && men / lines < 0.45, `fighting men ${men} of ${lines}`);
  // (Work by the land's mix: a farmer where it has none.)
  const none = { kinds: [OCC.forager, OCC.farmer], counts: [0, 0], total: 0 },
    foragers = { kinds: [OCC.forager, OCC.farmer], counts: [5, 0], total: 5 };
  for (let key = 0; key < 50; key++) {
    assert.equal(workOf(key * 7919, none), OCC.farmer);
    assert.equal(workOf(key * 7919, foragers), OCC.forager);
  }
});

test("cached, and the same when built again", () => {
  const seen = (r: Roster) =>
    JSON.stringify({
      holders: Array.from({ length: linesOf(r.town) }, (_, k): Holder | null => r.holder(k)),
      battles: r.battles,
      strikes: r.strikes,
    });
  for (const town of towns.slice(0, 40)) {
    const r = townRoster(world, town),
      json = seen(r);
    assert.equal(townRoster(world, town), r, `${town} cached`);
    assert.equal(seen(rosterOf(world, town, Y, fought)), json, `${town} folded from the battles`);
    clearRosters();
    const again = townRoster(world, town);
    assert.notEqual(again, r, `${town} let go`);
    assert.equal(seen(again), json, `${town} the same again`);
  }
});

test("old saves fold nothing", () => {
  // (Before Phase 55 a battle has no record of its men; an old one has let its towns go.)
  const older = fought.map(({ war, b }) => {
      const { fell, ...old } = b;
      void fell;
      return { war, b: old as Battle };
    }),
    letGo = fought.map(({ war, b }) => ({
      war,
      b: b.fell
        ? {
            ...b,
            fell: [
              b.fell[0].map(([c, s, d, h]) => [c, s, d, h] as const),
              b.fell[1].map(([c, s, d, h]) => [c, s, d, h] as const),
            ] as const,
          }
        : b,
    }));
  for (const town of towns) {
    const r = rosterOf(world, town, Y, older),
      killed = new Set(
        r.strikes.flatMap((s) => s.men.filter((m) => m.fate === "died").map((m) => m.line)),
      );
    assert.deepEqual(r.battles, [], `${town} no battles`);
    assert.deepEqual(rosterOf(world, town, Y, letGo).battles, [], `${town} towns let go`);
    for (let k = 0; k < linesOf(town); k++) {
      if (killed.has(k)) continue;
      const h = r.holder(k);
      assert.ok(h && (h.n - 1) % 16 === 0 && h.fates.length === 0, `${town} line ${k} natural`);
    }
  }
});

test("looking changes no history", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("a fire's dead come off its lines from the next year", () => {
  // (A fire kills a hundredth of a town, so a line's holder dies about as often: fires on several
  // cities, that some lines die.)
  const cities = citiesOf(world).all().slice(0, 12);
  assert.ok(cities.length > 0, "cities stand at 125 years");
  for (const city of cities) world.submit("act.fire", { village: city.town });
  world.runTo((Y + 1) * YEAR + 1);
  clearRosters();
  let died = 0,
    hurt = 0;
  for (const { town } of cities) {
    const sent = world.events
        .all()
        .filter((e) => e.type === LOCAL_ACT_EVENTS.fire.type && e.subjects[0] === town)
        .at(-1)!,
      told = (sent.data as { dead: number }).dead,
      r = townRoster(world, town, Y + 1),
      fire = r.strikes.find((s) => s.event === sent.id);
    assert.ok(told > 0, `${town} the fire killed`);
    assert.ok(fire && fire.kind === "fire" && fire.year === Y, `${town} the fire is folded`);
    assert.ok(fire.lines > 0, `${town} on its lines`);
    assert.equal(fire.dead, told, `${town} its dead as told`);
    // (Not in its own year: a roster never goes stale while its year runs.)
    assert.equal(
      townRoster(world, town, Y).strikes.some((s) => s.event === sent.id),
      false,
      `${town} not folded in its own year`,
    );
    for (const m of fire.men) {
      const at = `${town} line ${m.line}`;
      assert.ok(m.line < fire.lines, `${at} struck`);
      assert.ok(
        m.holder.struck.some((s) => s.event === sent.id && s.fate === m.fate),
        `${at} told`,
      );
      if (m.fate === "died") {
        died++;
        assert.equal(m.holder.died, Y, `${at} died`);
        assert.equal(r.holder(m.line), null, `${at} empty the next year`);
      } else {
        hurt++;
        assert.equal(m.holder.died, null, `${at} hurt, alive`);
      }
    }
  }
  assert.ok(died > 0 && hurt > 0, `${died} died, ${hurt} hurt`);
});
