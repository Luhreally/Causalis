// A fight of the underworld watched (2026-11-16): written by hand — two groups' war over a rent and its peace, a year of clashes
// between the realm's soldiers and a group — it is read off its events and the records kept of its groups as history has it (who,
// how many of their men in that land, how many died, who came out holding it), its page and its groups' pages carry the button
// that plays it, and the scene drawn of it in its town ends where history ended: the same fallen, the same side holding it, the
// same every time it is played.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Block } from "../../src/bridge/index.ts";
import type { Ref } from "../../src/kernel/index.ts";
import {
  politiesOf,
  populationContext,
  underworldOf,
  type CrimeGroup,
  type Polity,
  type RealmUnderworld,
} from "../../src/sim/index.ts";
import { streetFightOf } from "../../src/host/inspect/streetfight.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { groupRef, opRef } from "../../src/host/underworld.ts";
import { villagePlan } from "../../src/host/village.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { fallenBy, fightSpots, streetAt, streetEye, streetScript } from "../../src/view/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 60, { start: "spread" });

/** The most peopled living realm, and its most peopled land with a town. */
function chosen(): { realm: Polity; cell: number; town: string } {
  const ctx = populationContext(world),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    realm = [...politiesOf(world).living()].sort(
      (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    cell = [...realm.members]
      .filter((c) => ctx.settlements.inProvince(c).some((t) => t.population > 0))
      .sort(
        (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0),
      )[0]!,
    town = [...ctx.settlements.inProvince(cell)]
      .filter((t) => t.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0]!;
  return { realm, cell, town: town.ref as string };
}

const group = (
  id: number,
  name: string,
  event: Ref,
  lands: number[],
  members: number,
): CrimeGroup => ({
  id,
  name,
  kind: 0,
  since: 40,
  event,
  home: lands[0]!,
  lands,
  boss: { name: `Old ${name}`, born: 10, since: 40 },
  bosses: 1,
  members,
  wealth: 900,
  income: 300,
  share: 500,
  power: 600,
  rackets: 1,
  violence: 3,
  bribes: 0,
  means: { arms: 900, armour: 400, hidden: 0, word: 0, cost: 50 },
});

/** The records and events written by hand: Varro (40 men here) and Grey (20, over two lands) at war, its peace; soldiers and a clash. */
function written() {
  const { realm, cell, town } = chosen(),
    prov = populationContext(world).provinces.get(cell)!,
    under = underworldOf(world)!,
    year = yearNow(world),
    rose = world.events.at(0).id,
    rose2 = world.events.at(1).id,
    at = { subjects: [realm.ref], place: prov.ref },
    start = world.events.emit({
      type: "underworld.war",
      ...at,
      data: { realm: "", group: "Varro", against: "Grey", kind: "protection", gids: [7, 8] },
    }),
    peace = world.events.emit({
      type: "underworld.pax",
      ...at,
      causes: [{ ref: start, role: "trigger", weight: 1 }],
      data: { realm: "", group: "Varro", kind: "protection", gids: [7, 8], fallen: 30 },
    }),
    sent = world.events.emit({
      type: "underworld.operation",
      ...at,
      data: { realm: "", group: "Grey", kind: "protection", gids: [8], oids: [1], soldiers: 600 },
    }),
    clash = world.events.emit({
      type: "underworld.clash",
      ...at,
      causes: [{ ref: sent, role: "trigger", weight: 1 }],
      data: {
        realm: "",
        group: "Grey",
        kind: "protection",
        gids: [8],
        oids: [1],
        dead: 12,
        soldiers: 3,
      },
    }),
    was = under.of(realm.ref),
    u: RealmUnderworld = {
      ...(was
        ? (structuredClone(was) as RealmUnderworld)
        : {
            last: 0,
            next: 0,
            want: 0,
            supply: 0,
            pool: 0,
            veterans: 0,
            protectRent: 0,
            banRent: 0,
            tariffRent: 0,
            borderRent: 0,
            captured: 0,
            smuggleRent: 0,
            bites: 0,
            cost: 0,
            seized: 0,
            killings: 0,
            street: 0,
            badge: 0,
            extortion: 0,
            badgePull: 0,
            crackEvent: null,
            pactEvent: null,
            told: 0,
            crackdown: 0,
            collusion: 0,
            feds: [],
            gone: [],
          }),
      groups: [group(7, "Varro", rose, [cell], 40), group(8, "Grey", rose2, [cell, cell + 1], 20)],
      wars: [
        {
          a: 7,
          b: 8,
          names: ["Varro", "Grey"],
          kind: 0,
          since: year,
          event: start,
          ended: year,
          fallen: 30,
        },
      ],
      ops: [
        {
          id: 1,
          target: 8,
          name: "Grey",
          kind: 0,
          lands: [cell, cell + 1],
          since: year,
          event: sent,
          soldiers: 600,
          fallen: 3,
          taken: 9,
          bystanders: 3,
          displaced: 0,
          spent: 0,
          bosses: 0,
          clashes: 1,
          ended: null,
        },
      ],
    };
  under.put(realm.ref, u);
  return {
    realm,
    cell,
    town,
    start,
    peace,
    sent,
    clash,
    rose,
    restore: () => was && under.put(realm.ref, was),
  };
}

const tools = (blocks: readonly Block[]) =>
  blocks.flatMap((b) =>
    b.type === "tool" && b.tool === "watch.fight" ? [b.args.event as string] : [],
  );

test("a war between two groups, written by hand, is read as history has it: who, their men here, its dead, who held it", () => {
  const w = written();
  try {
    for (const ref of [w.start, w.peace]) {
      const f = streetFightOf(world, ref)!;
      assert.ok(f, ref);
      assert.equal(f.kind, "turf");
      assert.equal(f.town, w.town);
      assert.deepEqual(
        f.sides.map((s) => [s.name, s.as, s.men]),
        [
          ["The Varro family", "gang", 40],
          ["The Grey family", "gang", 10],
        ],
      );
      // (History counts its dead together; each side's share as the other's men were to its own.)
      assert.equal(f.sides[0].fallen + f.sides[1].fallen, 30);
      assert.deepEqual([f.sides[0].fallen, f.sides[1].fallen], [6, 24]);
      assert.equal(f.won, 0);
      assert.equal(f.open, false);
      assert.equal(f.words.cost, "Some 30 dead, all told");
      assert.equal(f.words.effect, "The Varro family came to hold the rent");
      assert.match(f.sides[0].gear, /arms as good as the realm's soldiers|better/);
    }
    // (Its event's page, and its groups' pages, carry the button.)
    const page = pageOf(world, w.start);
    assert.ok(tools(page.tabs.flatMap((t) => t.blocks)).includes(w.start));
    const varro = pageOf(world, groupRef(w.realm.ref, w.rose));
    assert.ok(tools(varro.tabs.flatMap((t) => t.blocks)).includes(w.start));
  } finally {
    w.restore();
  }
});

test("a clash of the realm's soldiers with a group: its soldiers' dead, the group's, those caught between", () => {
  const w = written();
  try {
    const f = streetFightOf(world, w.clash)!;
    assert.equal(f.kind, "army");
    assert.equal(f.page, opRef(w.realm.ref, w.sent));
    assert.deepEqual(
      f.sides.map((s) => [s.as, s.men, s.fallen]),
      [
        ["soldiers", 300, 3],
        ["gang", 10, 6],
      ],
    );
    assert.equal(f.others, 3);
    assert.equal(f.won, null);
    // (The operation's page plays its latest clash.)
    const op = pageOf(world, opRef(w.realm.ref, w.sent));
    assert.deepEqual(tools(op.tabs.flatMap((t) => t.blocks)), [w.clash]);
    // (Not a fight: nothing to watch.)
    assert.equal(streetFightOf(world, w.rose), null);
  } finally {
    w.restore();
  }
});

test("the scene in its town: its places read off the town, its fallen and its holder history's, the same every time", () => {
  const w = written();
  try {
    const f = streetFightOf(world, w.start)!,
      plan = villagePlan(world, w.town as Ref, undefined, 120),
      slots = 56,
      script = streetScript(f, plan, slots),
      again = streetScript(f, plan, slots);
    assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(script)));
    // (Its places: apart, and by what they are in the town.)
    const spots = fightSpots(plan, 1);
    assert.ok(spots.length >= 2);
    for (const a of spots)
      for (const b of spots)
        if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 14, `${a.why} by ${b.why}`);
    assert.ok(spots.some((s) => s.why === "border"));
    // (Its figures: history's men and dead at one scale; at the end, its fallen as many, and only the holder's still there.)
    // (Those who were in it: 40 living and 6 dead, 10 and 24, at the 44 a side the town draws.)
    assert.deepEqual(script.drawn, [44, 33]);
    assert.deepEqual(script.falls, [6, 23]);
    assert.ok(script.clashes.length >= 3, `${script.clashes.length} clashes`);
    assert.deepEqual(fallenBy(script, script.end), [6, 23]);
    assert.deepEqual(fallenBy(script, 0), [0, 0]);
    const end = streetAt(script, slots, script.end),
      left = [0, 1].map(
        (side) =>
          end.soldiers.filter((q) => q.side === side && q.size > 0.5 && q.doing !== "fallen")
            .length,
      ),
      lying = [0, 1].map(
        (side) => end.soldiers.filter((q) => q.side === side && q.doing === "fallen").length,
      );
    assert.deepEqual(lying, [6, 23]);
    assert.equal(left[1], 0);
    assert.ok(left[0]! > 0);
    // (No lines: at the height of it, no more than a few of a side in one place.)
    const mid = streetAt(script, slots, script.clashes[1]!.from + 2);
    assert.ok(mid.soldiers.filter((q) => q.size > 0.5).length < 44 + 33);
    assert.ok(streetEye(script, script.clashes[1]!.from + 2));
    // A clash of the soldiers: posts left standing where they go in.
    const army = streetScript(streetFightOf(world, w.clash)!, plan, slots),
      posts = streetAt(army, slots, army.end);
    assert.ok(army.posts.length >= 1);
    assert.equal(posts.tents.length, army.posts.length);
    assert.deepEqual(fallenBy(army, army.end), [...army.falls]);
  } finally {
    w.restore();
  }
});
