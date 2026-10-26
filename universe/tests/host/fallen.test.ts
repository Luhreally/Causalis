import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { LEVY_SHOWN, levyPlaces } from "../../src/host/fallen.ts";
import { strikesOn } from "../../src/host/town.ts";
import { BLOW_OF, strikeHurt } from "../../src/rules/index.ts";
import { citiesOf, populationContext, warsOf } from "../../src/sim/index.ts";
import type {
  BattleNear,
  BattleSideNear,
  Campaign,
  LevyPlace,
  WarsMap,
} from "../../src/bridge/index.ts";

// Phase 55 M224: the host shows the record. A battle seen near tells its wounded, its maimed
// and where its men came from (by town, countryside and land); a war's course and the ledger's wars
// tell the wounded; a fire tells the hurt it left with its dead.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const before = JSON.stringify(world.domainHashes());
const wars = [...warsOf(world).all()],
  battles = wars.flatMap((w) => w.battles.map((b) => ({ war: w, b })));

/** Of some places, the men they sent, their fallen and their wounded who lived. */
const sumOf = (places: readonly LevyPlace[]): [number, number, number] =>
  places.reduce<[number, number, number]>(
    (t, p) => [t[0] + p.sent, t[1] + p.dead, t[2] + p.hurt],
    [0, 0, 0],
  );

test("there are battles to watch", () => {
  assert.ok(battles.length >= 10, `${battles.length} battles`);
});

test("every battle seen near tells its wounded, its maimed and where its men came from", () => {
  const Y = Math.floor(world.now / YEAR),
    ctx = populationContext(world);
  for (const { b } of battles) {
    const n = ask<BattleNear | null>("battle.near", { event: b.event });
    assert.ok(n, b.event);
    for (const i of [0, 1] as const) {
      const s: BattleSideNear = i === 0 ? n.attacker : n.defender;
      assert.equal(s.wounded, b.wounded![i], `${b.event} wounded`);
      assert.equal(s.maimed, b.maimed![i], `${b.event} maimed`);
      assert.ok(s.maimed! <= s.wounded!, `${b.event} maimed within wounded`);
      // (Every place's men add up: those sent to the field, the fallen, the wounded who lived.)
      const all = levyPlaces(world, b, i, Infinity);
      assert.deepEqual(sumOf(all), [s.fielded, b.fallen[i], b.wounded![i]], `${b.event} sums`);
      // (Seen near, the most dead first and at most LEVY_SHOWN of them; the first of the whole.)
      assert.ok(s.levy!.length <= LEVY_SHOWN, `${b.event} levy shown`);
      assert.deepEqual(s.levy, all.slice(0, LEVY_SHOWN), `${b.event} levy is the first of all`);
      assert.deepEqual(levyPlaces(world, b, i, 2), all.slice(0, 2), `${b.event} most`);
      for (let k = 1; k < s.levy!.length; k++)
        assert.ok(s.levy![k - 1]!.dead >= s.levy![k]!.dead, `${b.event} by dead`);
      for (const p of all)
        if (p.kind === "town")
          assert.ok(
            ctx.settlements.inProvince(p.cell).some((t) => t.ref === p.ref),
            `${b.event} ${p.name} is a town of its land`,
          );
      // (The town tallies are kept for FELL_TOWN_YEARS: an old battle is told by its lands whole,
      // a recent one by its towns and countryside.)
      if (b.year < Y - 41)
        assert.ok(
          all.every((p) => p.kind === "land"),
          `${b.event} old: lands whole`,
        );
      if (b.year >= Y - 39)
        assert.ok(
          all.every((p) => p.kind !== "land"),
          `${b.event} recent: towns kept`,
        );
    }
  }
});

test("a battle with no record of its men (before Phase 55) lists none", () => {
  const { fell, ...old } = battles[0]!.b;
  void fell;
  assert.deepEqual(levyPlaces(world, old, 0), []);
});

test("a war's course and the ledger's wars tell each battle's wounded", () => {
  for (const w of wars) {
    const c = ask<Campaign | null>("war.campaign", { ref: w.ref });
    assert.ok(c, w.ref);
    c.battles.forEach((cb, k) => assert.deepEqual(cb.wounded, w.battles[k]!.wounded, w.ref));
  }
  const byEvent = new Map(battles.map(({ b }) => [b.event as string, b] as const));
  let seen = 0;
  for (const wr of ask<WarsMap>("wars.map").wars)
    for (const mb of wr.battles) {
      const b = byEvent.get(mb.event)!;
      assert.equal(mb.wounded, b.wounded![0] + b.wounded![1], `${mb.event} wounded`);
      seen++;
    }
  assert.ok(seen > 0, "a battle of the last two years is on the globe");
});

test("reading the record changes no domain hash", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("an alien people's record: the same sums, the proportion kept, every arm given a blow", () => {
  const alien = ALIEN.build(seedFromText("alien 16"));
  alien.runTo(150 * YEAR);
  const askAlien = <T>(type: string, args: unknown = {}) => ALIEN.queries[type]!(alien, args) as T;
  const fought = [...warsOf(alien).all()].flatMap((w) => w.battles);
  assert.ok(fought.length >= 10, `${fought.length} battles`);
  let mandibles = false;
  for (const b of fought) {
    const n = askAlien<BattleNear | null>("battle.near", { event: b.event });
    assert.ok(n, b.event);
    for (const i of [0, 1] as const) {
      const s: BattleSideNear = i === 0 ? n.attacker : n.defender,
        fallen = b.fallen[i],
        wounded = b.wounded![i]!;
      assert.deepEqual(sumOf(levyPlaces(alien, b, i, Infinity)), [s.fielded, fallen, wounded]);
      // (Unless capped, when every man who came back from the field is counted wounded. Rounding
      // to whole men moves the ratio by at most 0.5 / fallen: 0.05 at ten fallen.)
      if (fallen >= 10 && wounded < s.fielded - fallen) {
        const ratio = wounded / fallen;
        assert.ok(
          ratio >= 1.2 - 0.05 && ratio <= 4.5 + 0.05,
          `${b.event} ${i}: ${wounded} of ${fallen} fallen`,
        );
      }
      const bore = b.bore?.[i];
      if (bore) {
        assert.ok(Object.hasOwn(BLOW_OF, bore[0]), `${bore[0]} has no blow`);
        if (bore[0] === "mandibles") mandibles = true;
      }
    }
  }
  assert.ok(mandibles, "some side bore mandibles");
});

test("a fire sent on a town tells the hurt it left with its dead", () => {
  const ctx = populationContext(world),
    city = citiesOf(world).all()[0];
  assert.ok(city, "a city stands at 125 years");
  const cell = ctx.settlements.get(city.town)!.cell,
    land = ctx.provinces.get(cell)!.ref;
  world.submit("act.fire", { village: city.town });
  world.runTo(world.now + 1);
  const fires = strikesOn(world, city.town, land).filter(
    (s) => s.kind === "fire" && (s.dead ?? 0) > 0,
  );
  assert.ok(fires.length > 0, "a fire with dead");
  for (const f of fires) assert.equal(f.hurt, strikeHurt("fire", f.dead!), `${f.event} hurt`);
});
