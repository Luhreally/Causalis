import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, yearOfMoment, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import { LINE, ROSTER_YEARS, townRoster } from "../../src/host/roster.ts";
import {
  battleWords,
  battlesOfYear,
  burialOf,
  townTally,
  townWarDead,
  warRests,
} from "../../src/host/burials.ts";
import { strikesOn } from "../../src/host/town.ts";
import { FOLK_PER, healerOf } from "../../src/host/village.ts";
import {
  WAR_BURIAL,
  parseTownsfolkRef,
  type VillagePlan,
  type WarRest,
} from "../../src/bridge/index.ts";
import { OCC } from "../../src/rules/index.ts";
import { citiesOf, lifeOf, loreOf, populationContext, warsOf } from "../../src/sim/index.ts";
import { meetHousehold, observer, settleAll } from "../../src/causal/index.ts";

// Phase 55 M225: the village through the roster. A town's folk are the holders of its lines — named,
// aged and fated as its roster has them, none who fell or died since — its healer sits where its
// land knows herb-lore, and its year's dead are told less its fallen of the battles at the year's
// turn and those a strike killed, each buried with their own. Relations, whatever the record holds.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes());
const Y = Math.floor(world.now / YEAR),
  ctx = populationContext(world),
  life = lifeOf(world),
  lore = loreOf(world),
  ledger = observer(world),
  ask = <T>(type: string, args: unknown) => EARTH.queries[type]!(world, args) as T,
  planOf = (ref: string) => ask<VillagePlan>("village.plan", { ref, folk: 480 }),
  settlement = (ref: string) => ctx.settlements.get(ref as Ref)!,
  knowsHerbs = (cell: number) => (lore.get(cell, "herbalism")?.year ?? Infinity) <= Y,
  byRef = (p: { ref: string }, q: { ref: string }) => (p.ref < q.ref ? -1 : p.ref > q.ref ? 1 : 0);

// The towns: those of the town rows with dead ≥ 12 among recent battles (their tallies kept), the
// most dead first, at most 8; those that buried men of the battles at this year's turn — three where
// one of their line holders fell, one where none did — and one whose dead lie on the field; and the
// greatest town of a land that knows herb-lore.
const towns: string[] = [],
  add = (ref: string, most = Infinity) => {
    if (!towns.includes(ref) && towns.length < most) towns.push(ref);
  },
  heavy: { ref: string; dead: number }[] = [];
for (const war of warsOf(world).all())
  for (const b of war.battles) {
    if (!b.fell || b.year < Y - ROSTER_YEARS) continue;
    for (const side of [0, 1] as const)
      for (const p of levyPlaces(world, b, side, Infinity))
        if (p.kind === "town" && p.ref && p.dead >= 12) heavy.push({ ref: p.ref, dead: p.dead });
  }
heavy.sort((p, q) => q.dead - p.dead || byRef(p, q));
for (const r of heavy) add(r.ref, 8);
const lately: { ref: string; dead: number; named: boolean; field: boolean }[] = [];
for (const { b } of battlesOfYear(world, Y - 1))
  for (const side of [0, 1] as const)
    for (const p of levyPlaces(world, b, side, Infinity)) {
      if (p.kind !== "town" || !p.ref || p.dead <= 0) continue;
      const rb = townRoster(world, p.ref).battles.find(
        (x) => x.event === b.event && x.side === side,
      );
      lately.push({
        ref: p.ref,
        dead: p.dead,
        named: !!rb?.men.some((m) => m.fate === "fell"),
        field: burialOf(world, b.land, p.cell) === "field",
      });
    }
lately.sort((p, q) => q.dead - p.dead || byRef(p, q));
const buriedNamed = lately.filter((r) => r.named && !r.field);
for (const r of buriedNamed.slice(0, 3)) add(r.ref);
for (const r of lately.filter((r) => !r.named && !r.field).slice(0, 1)) add(r.ref);
for (const r of lately.filter((r) => r.field).slice(0, 1)) add(r.ref);
const herbLands = ctx.provinces
  .all()
  .filter((p) => p.total() > 0 && knowsHerbs(p.cell))
  .map((p) => p.cell)
  .sort((a, b) => a - b);
for (const cell of herbLands.slice(0, 2)) {
  const greatest = ctx.settlements
    .inProvince(cell)
    .filter((s) => s.population > 0)
    .sort((a, b) => b.population - a.population || byRef(a, b))[0];
  if (greatest) add(greatest.ref);
}
const plans = new Map(towns.map((ref) => [ref, planOf(ref)] as const));

/** Its holders who fell, and the people met of it who fell, in a battle's side. */
function fallenIn(ref: string, event: string, side: 0 | 1) {
  return {
    holders: townRoster(world, ref)
      .battles.filter((rb) => rb.event === event && rb.side === side)
      .flatMap((rb) => rb.men.filter((m) => m.fate === "fell").map((m) => m.holder)),
    met: [...ledger.persons.values()].filter(
      (q) =>
        q.village === ref &&
        !!q.wars?.some((w) => w.event === event && w.side === side && w.fate === "fell"),
    ),
  };
}

/**
 * A plan's year of dead (Phase 55 M225), in `year`: told as its land's dead of the year before at the
 * town's share, less its fallen of the battles at the year's turn and those a strike killed (never
 * below none); its fallen borne from its square but those who lie on the field; their names its line
 * holders who fell there, then the people met who fell there. How many funerals and names it told.
 */
function funerals(ref: string, plan: VillagePlan, year: number): { rests: number; named: number } {
  const s = settlement(ref),
    rest = plan.rest!,
    last = ctx.history.yearsOf(s.cell).at(-1),
    share = last && last.population > 0 ? Math.min(1, s.population / last.population) : 0,
    whole = share * ctx.history.deathsIn(s.cell, year - 1),
    war = townWarDead(world, ref, year - 1),
    struck = strikesOn(world, ref as Ref, ctx.provinces.get(s.cell)?.ref ?? null).reduce(
      (n, k) => n + (yearOfMoment(k.at) === year - 1 ? (k.dead ?? 0) : 0),
      0,
    );
  assert.equal(rest.year, year, `${ref} its year`);
  if (rest.perYear > 0)
    assert.ok(Math.abs(rest.perYear + war + struck - whole) < 1e-9, `${ref} its year's dead`);
  else assert.ok(whole - war - struck <= 1e-9, `${ref} none left of its year's dead`);
  // Its fallen of the battles at the year's turn: borne from its square, or lying on the field.
  let field = 0;
  const sides: { event: string; side: 0 | 1 }[] = [];
  for (const { b } of battlesOfYear(world, year - 1))
    for (const side of [0, 1] as const) {
      const dead = townTally(world, b, side, ref)?.[1] ?? 0;
      if (dead <= 0) continue;
      if (burialOf(world, b.land, s.cell) === "field") field += dead;
      else sides.push({ event: b.event, side });
    }
  const rests = rest.war ?? [],
    strip = (ws: readonly WarRest[]) =>
      ws.map((w) => {
        const { named, ...told } = w;
        void named;
        return told;
      });
  assert.equal(rests.reduce((n, w) => n + w.dead, 0) + field, war, `${ref} its fallen`);
  assert.deepEqual(strip(rests), strip(warRests(world, ref, year)), `${ref} its war funerals`);
  assert.equal(rests.length, sides.length, `${ref} a funeral for each side's fallen`);
  let named = 0;
  const seen = new Map<string, number>();
  for (const w of rests) {
    // (A battle's sides in order, as its funerals are: the attacker's first.)
    const k = seen.get(w.event) ?? 0;
    seen.set(w.event, k + 1);
    const { holders, met } = fallenIn(
      ref,
      w.event,
      sides.filter((x) => x.event === w.event)[k]!.side,
    );
    assert.equal(
      w.named.length,
      Math.min(WAR_BURIAL.named, holders.length + met.length),
      `${ref} ${w.event} named`,
    );
    let wasMet = false;
    for (const n of w.named) {
      named++;
      const t = parseTownsfolkRef(n.ref);
      if (t) {
        assert.ok(!wasMet, `${n.ref} the line holders first`);
        const h = townRoster(world, ref).holderOf(t.line, t.n!)!;
        assert.ok(holders.includes(h), `${n.ref} fell at ${w.event}`);
        assert.equal(n.name, townRoster(world, ref).nameOf(h), `${n.ref} name`);
        assert.equal(n.age, h.died! - h.born, `${n.ref} age`);
      } else {
        wasMet = true;
        const q = ledger.person(n.ref as Ref)!;
        assert.ok(met.includes(q), `${n.ref} met, fell at ${w.event}`);
        assert.equal(n.name, `${q.name} ${q.surname}`, `${n.ref} name`);
        assert.equal(n.age, q.diedYear! - q.birthYear, `${n.ref} age`);
      }
    }
  }
  // (One met who fell is told with their battle's fallen, never among the year's other dead.)
  for (const q of ledger.persons.values())
    if (q.village === ref && q.wars?.some((w) => w.fate === "fell" && w.year === q.diedYear))
      assert.ok(
        !rest.named.some((n) => n.name === `${q.name} ${q.surname}` && n.year === q.diedYear),
        `${q.ref} fell, not among the other dead`,
      );
  return { rests: rests.length, named };
}

/** No one dead drawn: its holders who fell or a strike killed are gone from its plan. */
function noneDead(ref: string, plan: VillagePlan): number {
  const roster = townRoster(world, ref),
    refs = new Set(plan.people.map((p) => p.ref));
  let gone = 0;
  for (const p of plan.people) {
    if (!p.folk) continue;
    const t = parseTownsfolkRef(p.ref)!;
    assert.equal(roster.holderOf(t.line, t.n!)?.died, null, `${p.ref} alive`);
  }
  for (const rb of roster.battles)
    for (const m of rb.men)
      if (m.fate === "fell") {
        gone++;
        assert.ok(!refs.has(m.holder.ref), `${m.holder.ref} fell at ${rb.event}`);
      }
  for (const s of roster.strikes)
    for (const m of s.men)
      if (m.fate === "died") {
        gone++;
        assert.ok(!refs.has(m.holder.ref), `${m.holder.ref} died of ${s.event}`);
      }
  return gone;
}

test("there are towns that fought, and lately", () => {
  assert.ok(heavy.length > 0 && towns.length >= 8, `${towns.length} towns`);
  assert.ok(
    lately.some((r) => !r.field),
    "a town buried men of the battles at the year's turn",
  );
  assert.equal(FOLK_PER, LINE);
});

test("folk are the holders of the town's lines, named, aged and fated as its roster has them", () => {
  let drawnAll = 0,
    veterans = 0;
  for (const [ref, plan] of plans) {
    const s = settlement(ref),
      roster = townRoster(world, ref),
      lines = Math.ceil(s.population / LINE),
      watched = plan.people.filter((p) => !p.folk),
      more = Math.min(480, Math.max(0, Math.ceil(s.population / FOLK_PER) - watched.length)),
      held: number[] = [];
    for (let k = 0; k < lines; k++) if (roster.holder(k) !== null) held.push(k);
    const folk = plan.people.filter((p) => p.folk),
      drawn = folk.map((p) => parseTownsfolkRef(p.ref)?.line ?? -1);
    // As many as the eye is given, the first of its lines that are held, in their order.
    assert.equal(folk.length, Math.min(more, held.length), `${ref} drawn`);
    assert.deepEqual(drawn, held.slice(0, folk.length), `${ref} its first lines held`);
    for (const p of folk) {
      const at = `${ref} ${p.ref}`,
        t = parseTownsfolkRef(p.ref);
      assert.ok(t && t.town === ref && t.n !== null, `${at} a line holder's ref`);
      const h = roster.holder(t.line);
      assert.ok(h && h.ref === p.ref, `${at} holds the line`);
      const age = Y - h.born;
      assert.equal(p.sex, h.sex, `${at} sex`);
      assert.equal(p.child, age < life.adulthood, `${at} child`);
      if (p.child) assert.equal(p.occupation, OCC.dependent, `${at} a child depends`);
      if (!p.trade && !p.healer) {
        assert.equal(p.name, roster.nameOf(h), `${at} named by the roster`);
        assert.equal(p.age, age, `${at} age`);
      } else assert.ok(p.age >= age, `${at} at least their age`);
      // (Home from their last battle, as their line tells it: a seat's holder, drawn in their place
      // under the seat's name, is not told their line's battles.)
      const last = h.fates.at(-1);
      if (p.trade || p.healer) assert.equal(p.war, undefined, `${at} a seat's holder`);
      else if (last && last.fate !== "fell") {
        veterans++;
        assert.deepEqual(
          p.war,
          {
            event: last.event,
            year: last.year,
            where: battleWords(world, last.land),
            fate: last.fate,
          },
          `${at} war`,
        );
        assert.ok(last.year >= Y - ROSTER_YEARS && last.year < Y, `${at} within the years kept`);
      } else assert.equal(p.war, undefined, `${at} no war`);
      drawnAll++;
    }
    // Four lines to a home, and to a family's name (a seat's holder named as the seat's).
    for (const p of folk)
      for (const q of folk) {
        const [a, b] = [parseTownsfolkRef(p.ref)!.line, parseTownsfolkRef(q.ref)!.line];
        if (a >= b || Math.floor(a / 4) !== Math.floor(b / 4)) continue;
        assert.equal(p.home, q.home, `${ref} lines ${a} and ${b} share a home`);
        if (!p.trade && !p.healer && !q.trade && !q.healer)
          assert.equal(p.name.split(" ")[1], q.name.split(" ")[1], `${ref} ${a} ${b} family`);
      }
    // The people met: home from their last battle these years, as their own lives tell it.
    for (const p of watched) {
      const q = ledger.person(p.ref as Ref)!,
        w = q.wars?.findLast((x) => x.fate !== "fell" && x.year >= Y - ROSTER_YEARS);
      if (w && w.fate !== "fell")
        assert.deepEqual(
          p.war,
          { event: w.event, year: w.year, where: battleWords(world, w.land), fate: w.fate },
          `${p.ref} war`,
        );
      else assert.equal(p.war, undefined, `${p.ref} no war`);
    }
  }
  assert.ok(drawnAll > 100, `${drawnAll} folk`);
  assert.ok(veterans > 0, `${veterans} folk home from war`);
});

test("no one dead is drawn: the fallen and the struck are gone from a later plan", () => {
  let gone = 0;
  for (const [ref, plan] of plans) gone += noneDead(ref, plan);
  assert.ok(gone > 0, "some holder fell");
});

test("funerals: last year's dead less its fallen and its struck; its fallen borne from the square", () => {
  let rests = 0,
    named = 0;
  for (const [ref, plan] of plans) {
    const told = funerals(ref, plan, Y);
    rests += told.rests;
    named += told.named;
  }
  assert.ok(rests > 0, "a town buries its fallen of the battles at the year's turn");
  if (buriedNamed.length) assert.ok(named > 0, "and names some of them");
});

test("a healer sits where its land knows herb-lore, and nowhere else", () => {
  let healers = 0;
  for (const [ref, plan] of plans) {
    const s = settlement(ref),
      folk = plan.people.filter((p) => p.folk),
      sat = folk.filter((p) => p.healer);
    if (!knowsHerbs(s.cell)) {
      assert.equal(sat.length, 0, `${ref} no healer`);
      assert.equal(healerOf(world, s, Y), null, `${ref} no seat`);
      continue;
    }
    assert.equal(sat.length, 1, `${ref} one healer`);
    healers++;
    const p = sat[0]!,
      m = healerOf(world, s, Y)!;
    assert.ok(p.role?.startsWith("the healer of"), p.role);
    assert.equal(p.role, `the healer of ${s.name}`);
    assert.equal(p.name, m.name, `${ref} named as the seat's holder`);
    assert.deepEqual(p.healer, { years: m.years });
    assert.ok(!p.child && !p.trade && p.occupation !== OCC.crafter, `${ref} grown, at no trade`);
    assert.ok(p.age >= life.adulthood + m.years, `${ref} old enough for their years at it`);
    // (The first of its folk who could be: those before it children, makers or builders.)
    for (const q of folk.slice(0, folk.indexOf(p)))
      assert.ok(q.child || !!q.trade || q.occupation === OCC.crafter, `${ref} ${q.ref} first`);
  }
  if (herbLands.length) assert.ok(healers > 0, "a town of a land that knows herb-lore");
  else assert.equal(healers, 0);
});

test("the same plan twice; looking changes no history", () => {
  for (const [ref, plan] of plans)
    assert.equal(JSON.stringify(planOf(ref)), JSON.stringify(plan), ref);
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("a year on: a fire's dead and the year's fallen are buried with their own", () => {
  // (These last change history. The people met are followed into the battles at the year's turn.)
  const fired = citiesOf(world).all()[0]!.town;
  world.submit("act.fire", { village: fired });
  world.runTo((Y + 1) * YEAR + 1);
  for (const ref of [fired, ...towns.filter((t) => t !== fired)]) {
    const plan = planOf(ref);
    funerals(ref, plan, Y + 1);
    noneDead(ref, plan);
  }
  const struck = strikesOn(world, fired, ctx.provinces.get(settlement(fired).cell)?.ref ?? null);
  assert.ok(
    struck.some((k) => yearOfMoment(k.at) === Y && (k.dead ?? 0) > 0),
    `${fired}: the fire killed, last year`,
  );
});

test("years on: one met who fell is named with his battle's fallen, not among the other dead", () => {
  // (More of the people of the towns that fight most are met, and followed year by year into the
  // battles at each year's turn, until one of them falls in a battle his town buries at home.)
  for (const ref of towns.slice(0, 8))
    for (let k = 0; k < 24; k++)
      try {
        meetHousehold(world, settlement(ref).cell, ref as Ref);
      } catch {
        break;
      }
  let found: string | null = null,
    year = Y + 1;
  while (found === null && year < Y + 16) {
    year++;
    world.runTo(year * YEAR + 1);
    settleAll(world);
    for (const q of [...ledger.persons.values()].sort((a, b) => a.seq - b.seq)) {
      const w = q.wars?.find((x) => x.fate === "fell" && x.year === year - 1);
      if (!w || w.town === null || !q.village) continue;
      const town = q.village as string;
      if (burialOf(world, w.land, settlement(town).cell) === "field") continue;
      const plan = planOf(town),
        rest = plan.rest?.war?.find((x) => x.event === w.event);
      funerals(town, plan, year);
      assert.ok(rest, `${town} buries its fallen of ${w.event}`);
      if (fallenIn(town, w.event, w.side).holders.length < WAR_BURIAL.named)
        assert.ok(
          rest.named.some((n) => n.ref === q.ref),
          `${q.ref} named at ${w.event}`,
        );
      assert.ok(!plan.people.some((p) => p.ref === q.ref), `${q.ref} not drawn`);
      found = q.ref;
      break;
    }
  }
  assert.ok(found, "a man met fell in a battle his town buries at home");
});
