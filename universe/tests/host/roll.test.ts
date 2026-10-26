import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { battleNear, nearCounts } from "../../src/host/battle.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import { ROSTER_YEARS, townRoster } from "../../src/host/roster.ts";
import {
  decodeLevy,
  encodeLevy,
  levyName,
  resolveLevyMan,
  rollOf,
  type Lot,
} from "../../src/host/roll.ts";
import {
  ROLL_DEFAULT,
  ROLL_MOST,
  battleFigures,
  parseLevyManRef,
  parseTownsfolkRef,
  type BattleRoll,
  type RollEntry,
  type RollSide,
} from "../../src/bridge/index.ts";
import { meetHousehold, observer } from "../../src/causal/index.ts";
import { lifeOf, politiesOf, populationContext, warsOf, type Battle } from "../../src/sim/index.ts";

// Phase 55 M225: a battle's roll names every figure it is drawn as — each side's fallen, its wounded
// who lived and the rest, place by place: the town's line holders the battle levied first, then the
// people met who went, then the rest of its levy named for the roll from their refs alone. Read
// from the record and the observer's ledger, never drawn: relations that hold whatever the numbers.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes());
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const Y = Math.floor(world.now / YEAR),
  ctx = populationContext(world),
  life = lifeOf(world),
  number = (event: string) => Number(event.split(":")[2]),
  fought = [...warsOf(world).all()].flatMap((war) => war.battles.map((b) => ({ war, b }))),
  // ("Recent": its town tallies are kept. The newest first.)
  recent = fought
    .filter(({ b }) => b.fell && b.year >= Y - 39)
    .sort((p, q) => q.b.year - p.b.year || number(q.b.event) - number(p.b.event))
    .slice(0, 40);

const LOTS = ["fell", "hurt", "stood"] as const;
const sideOf = (roll: BattleRoll, s: 0 | 1): RollSide => (s === 0 ? roll.attacker : roll.defender);
const lotOfFate = (fate: string): Lot => (fate === "fell" ? 0 : fate === "stood" ? 2 : 1);

// People met where the newest battles' men came from — the countrysides and the towns that lost the
// most — so the roll has met men to name (their past wars drawn as they are met).
for (const { b } of recent.slice(0, 12))
  for (const s of [0, 1] as const) {
    const places = levyPlaces(world, b, s, Infinity);
    for (const p of [
      ...places.filter((x) => x.kind === "countryside").slice(0, 3),
      ...places.filter((x) => x.kind === "town").slice(0, 2),
    ])
      for (let k = 0; k < 3; k++)
        try {
          meetHousehold(world, p.cell, p.kind === "town" ? (p.ref as Ref) : null);
        } catch {
          // (No one left to meet there.)
        }
  }
const rolls = recent.map(({ war, b }) => ({
  war,
  b,
  roll: ask<BattleRoll | null>("battle.roll", { event: b.event, most: 360 }),
}));

test("there are recent battles to roll, and people met who went to them", () => {
  assert.ok(recent.length >= 20, `${recent.length} recent battles`);
  assert.ok(
    [...observer(world).persons.values()].some((p) => (p.wars?.length ?? 0) > 0),
    "a man met went to war",
  );
});

test("each side's roll is its figures, lot by lot, place by place", () => {
  for (const { war, b, roll } of rolls) {
    assert.ok(roll, b.event);
    const figs = battleFigures(nearCounts(b), 360);
    assert.deepEqual(
      [roll.event, roll.war, roll.year, roll.per, roll.most],
      [b.event, war.ref, b.year, figs.per, 360],
    );
    for (const s of [0, 1] as const) {
      const side = sideOf(roll, s),
        f = figs.sides[s],
        at = `${b.event}:${s}`;
      assert.equal(side.realm, s === 0 ? war.attacker : war.defender, `${at} realm`);
      assert.deepEqual(side.figures, f, `${at} figures`);
      assert.deepEqual(
        [side.fell.length, side.hurt.length, side.stood.length],
        [f.falls, f.hurt, f.stood],
        `${at} lengths`,
      );
      // (Its places are where its men came from, each with its share of every lot.)
      assert.deepEqual(
        side.towns.map(({ figures, ...p }) => (void figures, p)),
        levyPlaces(world, b, s, Infinity),
        `${at} places`,
      );
      LOTS.forEach((lot, l) => {
        const list = side[lot];
        assert.equal(
          side.towns.reduce((n, p) => n + p.figures[l]!, 0),
          list.length,
          `${at} ${lot} shared out`,
        );
        let last = 0,
          lv = false;
        list.forEach((e, k) => {
          assert.ok(e.place >= 0 && e.place < side.towns.length, `${at} ${lot} ${k} in range`);
          assert.ok(e.place >= last, `${at} ${lot} place by place`);
          if (e.place !== last) lv = false;
          last = e.place;
          // (Within a place, those history keeps before those named for the roll.)
          if (!e.kept) lv = true;
          else assert.ok(!lv, `${at} ${lot} ${k} kept first`);
          // (The maimed are of the wounded who lived.)
          if (e.maimed) assert.equal(l, 1, `${at} ${lot} ${k} maimed`);
        });
        side.towns.forEach((p, i) =>
          assert.equal(
            list.filter((e) => e.place === i).length,
            p.figures[l],
            `${at} ${lot} at ${p.name}`,
          ),
        );
      });
    }
  }
});

test("the kept are its towns' levied line holders, by line, then the people met who went", () => {
  const people = observer(world);
  let folk = 0,
    met = 0;
  for (const { b, roll } of rolls)
    for (const s of [0, 1] as const) {
      const side = sideOf(roll!, s);
      side.towns.forEach((p, i) => {
        if (p.figures[0] + p.figures[1] + p.figures[2] === 0) return;
        // What its line holders give each lot: the first of each lot's levied men, by line.
        const roster =
            p.kind === "town" && p.ref !== null && b.year >= Y - ROSTER_YEARS
              ? townRoster(world, p.ref, b.year + 1)
              : null,
          rb = roster?.battles.find((x) => x.event === b.event && x.side === s);
        LOTS.forEach((lot, l) => {
          const here = side[lot].filter((e) => e.place === i),
            mine = (rb?.men ?? []).filter((m) => lotOfFate(m.fate) === l).slice(0, p.figures[l]),
            holders = here.filter((e) => e.ref.startsWith("folk:")),
            persons = here.filter((e) => e.ref.startsWith("prsn:"));
          // (Every one of the town's levied men a lot has room for, none skipped.)
          assert.deepEqual(
            holders.map((e) => e.ref),
            mine.map((m) => m.holder.ref),
            `${b.event}:${s} ${p.name} ${lot} holders`,
          );
          assert.deepEqual(
            here.slice(0, holders.length),
            holders,
            `${b.event}:${s} ${p.name} ${lot} holders first`,
          );
          holders.forEach((e, k) => {
            const m = mine[k]!,
              ref = parseTownsfolkRef(e.ref);
            assert.deepEqual(ref, { town: p.ref, line: m.line, n: m.holder.n }, e.ref);
            assert.equal(e.kept, true);
            assert.equal(e.name, roster!.nameOf(m.holder), `${e.ref} name`);
            assert.equal(e.age, b.year - m.holder.born, `${e.ref} age`);
            assert.equal(!!e.maimed, m.fate === "maimed", `${e.ref} maimed`);
            folk++;
          });
          // (The people met who went from here, the first met first, as their war fates tell it.)
          let seq = -1;
          for (const e of persons) {
            const q = people.person(e.ref as Ref)!,
              w = q.wars?.find((x) => x.event === b.event && x.side === s);
            assert.ok(w, `${e.ref} went to ${b.event}`);
            assert.equal(lotOfFate(w.fate), l, `${e.ref} ${lot}`);
            assert.equal(!!e.maimed, w.fate === "maimed", `${e.ref} maimed`);
            assert.equal(w.cell, p.cell, `${e.ref} from ${p.name}`);
            if (p.kind === "town")
              assert.equal(
                ctx.settlements.inProvince(w.cell)[w.town ?? -1]?.ref,
                p.ref,
                `${e.ref} of its town`,
              );
            if (p.kind === "countryside") assert.equal(w.town, null, `${e.ref} of the countryside`);
            assert.deepEqual(
              [e.name, e.age, e.kept],
              [`${q.name} ${q.surname}`, w.year - q.birthYear, true],
              e.ref,
            );
            assert.ok(q.seq > seq, `${e.ref} the first met first`);
            seq = q.seq;
            met++;
          }
          assert.deepEqual(
            here.slice(holders.length, holders.length + persons.length),
            persons,
            `${b.event}:${s} ${p.name} ${lot} the met next`,
          );
        });
      });
    }
  assert.ok(folk > 0, "some line holders named");
  assert.ok(met > 0, "some people met named");
});

test("every one of the levy named for the roll is read back from his ref alone", () => {
  let men = 0;
  for (const { war, b, roll } of rolls)
    for (const s of [0, 1] as const) {
      const side = sideOf(roll!, s),
        places = levyPlaces(world, b, s, Infinity);
      LOTS.forEach((lot, l) => {
        const next = new Map<number, number>();
        for (const e of side[lot] as readonly RollEntry[]) {
          if (e.kept) continue;
          const ref = parseLevyManRef(e.ref),
            j = ref && decodeLevy(ref.j),
            man = resolveLevyMan(world, e.ref);
          assert.ok(ref && j && man, e.ref);
          assert.deepEqual([ref.event, ref.side], [b.event, s], e.ref);
          // (Each place's men of the lot numbered from the first named for it.)
          assert.deepEqual(j, { place: e.place, lot: l, i: next.get(e.place) ?? 0 }, e.ref);
          next.set(e.place, j.i + 1);
          assert.deepEqual(
            [man.name, man.age, man.event, man.war, man.side, man.year, man.land],
            [e.name, e.age, b.event, war.ref, s, b.year, b.land],
            e.ref,
          );
          assert.equal(man.realm, side.realm);
          assert.deepEqual(man.place, places[e.place], `${e.ref} place`);
          assert.equal(
            man.fate,
            l === 0 ? "fell" : l === 2 ? "stood" : e.maimed ? "maimed" : "hurt",
            `${e.ref} fate`,
          );
          // (Grown, and of the ages that fight.)
          assert.ok(e.age >= life.adulthood && e.age < life.bands[7]!, `${e.ref} age ${e.age}`);
          assert.equal(e.name.split(" ").length, 2, `${e.ref} ${e.name}`);
          men++;
        }
      });
    }
  assert.ok(men > 0, "some levy men named");
  // (Maimed as often as the side's wounded were.)
  const wounded = rolls.flatMap(({ roll }) =>
    [roll!.attacker, roll!.defender].flatMap((x) => x.hurt.filter((e) => !e.kept)),
  );
  assert.ok(wounded.some((e) => e.maimed) && wounded.some((e) => !e.maimed), "some maimed");
  // Not one of the levy: no battle, a place it does not tell, no number.
  const { b, roll } = rolls[0]!,
    places = roll!.attacker.towns.length;
  assert.equal(resolveLevyMan(world, `lv:ev:0:999999999:0:${encodeLevy(0, 0, 0)}`), null);
  assert.equal(resolveLevyMan(world, `lv:${b.event}:0:${encodeLevy(places, 0, 0)}`), null);
  assert.equal(resolveLevyMan(world, `lv:${b.event}:0:${encodeLevy(-1, 2, 0)}`), null);
  assert.equal(resolveLevyMan(world, `lv:${b.event}:2:0`), null);
  assert.equal(resolveLevyMan(world, `folk:${b.event}:0:0`), null);
});

test("a man's number in his ref: his place, his lot, which of them", () => {
  for (const place of [-1, 0, 5, 731])
    for (const lot of [0, 1, 2] as const)
      for (const i of [0, 1, 359, ROLL_MOST, 65535])
        assert.deepEqual(decodeLevy(encodeLevy(place, lot, i)), { place, lot, i });
  assert.equal(decodeLevy(-1), null);
  assert.equal(decodeLevy(1.5), null);
  assert.equal(decodeLevy(2 ** 60), null);
});

test("the same roll when asked again; fewer figures by the same rule", () => {
  for (const { b, roll } of rolls.slice(0, 10)) {
    assert.deepEqual(ask("battle.roll", { event: b.event, most: 360 }), roll, b.event);
    const small = ask<BattleRoll>("battle.roll", { event: b.event, most: 120 }),
      figs = battleFigures(nearCounts(b), 120);
    assert.equal(small.most, 120);
    assert.equal(small.per, figs.per);
    for (const s of [0, 1] as const) {
      const side = sideOf(small, s),
        f = figs.sides[s];
      assert.deepEqual(
        [side.fell.length, side.hurt.length, side.stood.length],
        [f.falls, f.hurt, f.stood],
        `${b.event}:${s} at 120`,
      );
    }
  }
  // (Asked for too few, too many or none: one, ROLL_MOST, ROLL_DEFAULT.)
  const { b } = rolls[0]!;
  assert.equal(ask<BattleRoll>("battle.roll", { event: b.event, most: 0 }).most, 1);
  assert.equal(ask<BattleRoll>("battle.roll", { event: b.event, most: 1e6 }).most, ROLL_MOST);
  assert.equal(ask<BattleRoll>("battle.roll", { event: b.event, most: NaN }).most, ROLL_DEFAULT);
  assert.equal(ask<BattleRoll>("battle.roll", { event: b.event }).most, ROLL_DEFAULT);
});

test("its counts are the field's: the hosts as seen near", () => {
  for (const { b } of rolls) {
    const near = battleNear(world, b.event)!,
      c = nearCounts(b);
    assert.equal(c.won, near.won);
    for (const [x, n] of [
      [c.attacker, near.attacker],
      [c.defender, near.defender],
    ] as const) {
      assert.deepEqual(
        [x.fielded, x.fallen, x.risen, x.wounded, x.maimed],
        [n.fielded, n.fallen, n.risen ?? 0, n.wounded, n.maimed],
        b.event,
      );
      assert.equal(x.fielded, x.host + x.risen, b.event);
    }
  }
});

test("no battle, no roll; a battle with no record of its men names its levy from nowhere told", () => {
  assert.equal(ask("battle.roll", { event: "ev:0:999999999" }), null);
  assert.equal(ask("battle.roll", { event: recent[0]!.war.event }), null);
  for (const { war, b } of recent.slice(0, 5)) {
    const { fell, ...rest } = b;
    void fell;
    const old = rest as Battle,
      roll = rollOf(world, war, old, 360),
      figs = battleFigures(nearCounts(old), 360);
    for (const s of [0, 1] as const) {
      const side = sideOf(roll, s),
        realm = s === 0 ? war.attacker : war.defender,
        home = politiesOf(world).get(realm)?.seat ?? b.land;
      assert.deepEqual(side.towns, [], `${b.event}:${s} no places`);
      assert.deepEqual(side.figures, figs.sides[s]);
      LOTS.forEach((lot, l) =>
        side[lot].forEach((e, i) => {
          assert.equal(e.kept, false);
          assert.equal(e.place, -1);
          assert.deepEqual(decodeLevy(parseLevyManRef(e.ref)!.j), { place: -1, lot: l, i });
          // (Named in its realm's tongue, from its seat.)
          const named = levyName(world, e.ref, home);
          assert.deepEqual([e.name, e.age], [named.name, named.age], e.ref);
        }),
      );
    }
  }
});

test("looking changes no history", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
