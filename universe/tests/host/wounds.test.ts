import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { anatomyOf, lastingOf } from "../../src/rules/index.ts";
import { parseTownsfolkRef, type VillagePlan, type Wound } from "../../src/bridge/index.ts";
import { LOCAL_ACT_EVENTS, citiesOf, populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { healerOf, villagePlan } from "../../src/host/village.ts";
import { clearRosters, townRoster } from "../../src/host/roster.ts";
import {
  BATTLE_HOUR,
  HOME_HOUR,
  hospitalOf,
  withWounds,
  woundedTowns,
} from "../../src/host/wounds.ts";

// Phase 55 M226 (T19): a town's wounds laid over its plan from the record — each one a fate the
// roster keeps or one of this year's strikes, its days, who tended it — and the towns whose levy
// comes home wounded. Relations that hold whatever the record's numbers; reading moves nothing.

const HOUR = 3600;
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes());
const Y = Math.floor(world.now / YEAR),
  ctx = populationContext(world),
  body = anatomyOf(ctx.generated.life.people?.body ?? null),
  rows = woundedTowns(world, 20),
  plans = new Map<string, VillagePlan>();
const planOf = (ref: string): VillagePlan => {
  let p = plans.get(ref);
  if (!p) plans.set(ref, (p = withWounds(world, villagePlan(world, ref as Ref, undefined, 480))));
  return p;
};
const looked = rows.slice(0, 6);
const wounded = (p: VillagePlan["people"][number]) => p.wounds ?? [];

test("the towns whose levy comes home wounded, the most borne first", () => {
  assert.ok(rows.length >= 1, "no town's levy comes home wounded at 125 years");
  for (const r of rows) {
    assert.ok(r.wounded >= 1 && r.borne <= r.wounded && r.maimed <= r.wounded, r.name);
    assert.ok(r.at >= Y * YEAR && r.at < (Y + 1) * YEAR, `${r.name} comes home in year ${Y}`);
  }
  for (let k = 1; k < rows.length; k++) {
    const a = rows[k - 1]!,
      b = rows[k]!;
    assert.ok(
      a.borne > b.borne ||
        (a.borne === b.borne &&
          (a.wounded > b.wounded ||
            (a.wounded === b.wounded &&
              (a.population > b.population || (a.population === b.population && a.ref < b.ref))))),
      `${a.name} before ${b.name}`,
    );
  }
});

test("each wound is one the roster keeps: a fate hurt or maimed, or a strike's hurt", () => {
  let told = 0;
  for (const r of looked) {
    const plan = planOf(r.ref),
      roster = townRoster(world, r.ref);
    for (const p of plan.people) {
      if (!p.folk || p.trade || p.healer) continue;
      const at = parseTownsfolkRef(p.ref)!,
        h = at.n === null ? roster.holder(at.line) : roster.holderOf(at.line, at.n);
      if (!h) continue;
      const fates =
        h.fates.filter((f) => f.fate === "hurt" || f.fate === "maimed").length +
        h.struck.filter((s) => s.fate === "hurt").length;
      assert.equal(wounded(p).length, fates, p.ref);
      told += fates;
    }
  }
  assert.ok(told >= 1, "no wound told in the towns looked at");
});

test("a wound's body, its days, who tended it", () => {
  let n = 0;
  for (const r of looked) {
    const s = ctx.settlements.get(r.ref as Ref)!;
    for (const p of planOf(r.ref).people)
      for (const w of wounded(p)) {
        n++;
        assert.ok(body.members.includes(w.member), `${w.member} is a member`);
        if (w.outcome === "lost") assert.ok(body.losable.includes(w.member), `${w.member} losable`);
        assert.equal(w.lasting, lastingOf(body, w.member, w.outcome));
        assert.ok(w.words.length > 0 && w.where.length > 0);
        assert.ok(w.at <= w.home && w.up > w.at && w.mended > w.up, JSON.stringify(w));
        if (w.from === "battle") {
          assert.equal(w.at, (w.year + 1) * YEAR + BATTLE_HOUR * HOUR);
          assert.equal((w.home - (w.year + 1) * YEAR) % DAY, HOME_HOUR * HOUR);
          assert.ok([0, 3, 9].includes(Math.floor((w.home - (w.year + 1) * YEAR) / DAY)));
        } else assert.equal(w.home, w.at);
        if (w.borne) assert.ok(w.home < w.up, "borne home abed");
        const year = w.from === "battle" ? w.year + 1 : w.year;
        if (w.tended === "hospital") assert.ok(hospitalOf(world, r.ref, year));
        if (w.tended === "healer") {
          const healer = healerOf(world, s, year);
          assert.ok(healer && w.by.includes(healer.name), w.by);
        }
      }
  }
  assert.ok(n >= 1);
});

test("away with the levy: from the battle's turn till they come home with it", () => {
  let n = 0;
  for (const r of looked) {
    const roster = townRoster(world, r.ref);
    for (const p of planOf(r.ref).people) {
      if (!p.away?.length || !p.folk) continue;
      const at = parseTownsfolkRef(p.ref)!,
        h = at.n === null ? roster.holder(at.line)! : roster.holderOf(at.line, at.n)!;
      for (const a of p.away) {
        n++;
        assert.equal(a.from, Y * YEAR);
        assert.equal((a.until - a.from) % DAY, HOME_HOUR * HOUR);
        assert.ok([0, 3, 9].includes(Math.floor((a.until - a.from) / DAY)));
        assert.ok(
          h.fates.some((f) => f.event === a.event && f.fate !== "fell" && f.year === Y - 1),
        );
      }
    }
  }
  assert.ok(n >= 1, "no one away with the levy in the towns looked at");
});

test("the hand's town and the seats' holders carry none", () => {
  const plan = planOf(looked[0]!.ref),
    hand = { ...plan, hand: true };
  assert.equal(withWounds(world, hand), hand);
  for (const r of looked)
    for (const p of planOf(r.ref).people)
      if (p.trade || p.healer) assert.ok(!p.wounds && !p.away && p.gone === undefined, p.name);
});

test("the same read, the same plan; and cheap", () => {
  const ref = looked[0]!.ref as Ref,
    plain = villagePlan(world, ref, undefined, 480);
  assert.equal(JSON.stringify(withWounds(world, plain)), JSON.stringify(withWounds(world, plain)));
  const times: number[] = [];
  for (let k = 0; k < 5; k++) {
    const t0 = performance.now();
    withWounds(world, plain);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  assert.ok(times[2]! <= 50, `withWounds took ${times[2]} ms`);
});

test("no history moved by the reads", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

// (Last: it sends fires, and runs the world on.)
test("this year's strikes as next year's roster will fold them", () => {
  const cities = citiesOf(world).all().slice(0, 12);
  for (const c of cities) world.submit("act.fire", { village: c.town });
  world.runTo(Y * YEAR + 2 * DAY);
  let died = 0,
    hurt = 0;
  for (const { town } of cities) {
    const sent = world.events
      .all()
      .filter((e) => e.type === LOCAL_ACT_EVENTS.fire.type && e.subjects[0] === town)
      .at(-1);
    if (!sent) continue;
    const plan = withWounds(world, villagePlan(world, town as Ref, undefined, 480));
    clearRosters();
    const fire = townRoster(world, town, Y + 1).strikes.find((s) => s.event === sent.id),
      men = new Set((fire?.men ?? []).map((m) => `${m.holder.ref}|${m.fate}`));
    for (const p of plan.people) {
      if (!p.folk || p.trade || p.healer) continue;
      const gone: boolean = p.gone === sent.t,
        struck: boolean = (p.wounds ?? []).some((w: Wound) => w.event === sent.id);
      assert.equal(gone, men.has(`${p.ref}|died`), `${p.ref} died`);
      assert.equal(struck, men.has(`${p.ref}|hurt`), `${p.ref} hurt`);
      if (gone) died++;
      if (struck) hurt++;
    }
  }
  assert.ok(died + hurt > 0, "the fires killed or hurt none of the lines drawn");
});
