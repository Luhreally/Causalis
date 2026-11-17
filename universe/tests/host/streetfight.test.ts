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
import {
  BODY,
  standsClear,
  blowsAt,
  streetBattle,
  streetBattleNow,
  castAt,
  streetCast,
  streetView,
  fallenBy,
  fightSpots,
  streetAt,
  streetEye,
  streetScript,
} from "../../src/view/index.ts";
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

test("what is drawn about it: carriers, lamps, the eye's clear stand, those caught between, the watch and the crowd", () => {
  const w = written();
  try {
    const plan = villagePlan(world, w.town as Ref, undefined, 120),
      slots = 56,
      turf = streetScript(streetFightOf(world, w.start)!, plan, slots),
      army = streetScript(streetFightOf(world, w.clash)!, plan, slots);
    // (Both groups' means say armoured carriers: a car behind each side's men while they are there, and a fire lit at the place.)
    assert.deepEqual(turf.carriers, [true, true]);
    const mid = streetAt(turf, slots, turf.clashes[0]!.from + 2);
    assert.ok((mid.cars?.length ?? 0) >= 2, `${mid.cars?.length} cars`);
    assert.ok(mid.camp.length >= 1);
    assert.equal(streetAt(turf, slots, -100).cars?.length, 0);
    // (The eye on every place of both: no block or wall under its line.)
    for (const c of [...turf.clashes, ...army.clashes]) {
      const v = streetView(plan, c.spot, 46);
      assert.ok(v.clear, `${c.spot.why} at ${Math.round(c.spot.x)},${Math.round(c.spot.z)}`);
      assert.ok(v.pitch <= -32 && v.pitch >= -80);
    }
    // (The clash's three caught between, at the figures' scale: each stands by it, then lies fallen.)
    assert.ok(army.bystanders.length >= 1);
    const cast = streetCast(plan, army, world.now),
      before = castAt(cast, 0),
      after = castAt(cast, army.end);
    assert.equal(before.downed.size, 0);
    assert.equal(after.downed.size, army.bystanders.length);
    // (Soldiers are their own watch; after a war of gangs four of the town come as its watch, then a crowd.)
    assert.equal(cast.watch.length, 0);
    const street = streetCast(plan, turf, world.now),
      late = castAt(street, turf.end);
    assert.equal(street.watch.length, 4);
    assert.equal(late.folk.filter((x) => x.why === "Of the watch, come after it").length, 4);
    assert.ok(late.folk.filter((x) => x.why === "Come out to the fallen").length >= 4);
    assert.equal(new Set(late.folk.map((x) => x.index)).size, late.folk.length);
  } finally {
    w.restore();
  }
});

test("a crew of the realm's own found out is a fight of its own: the crew in the realm's darker colours, those it hunted its dead", () => {
  const w = written();
  try {
    const { realm, cell } = { realm: w.realm, cell: w.cell },
      prov = populationContext(world).provinces.get(cell)!,
      ev = world.events.emit({
        type: "underworld.exposed",
        subjects: [realm.ref],
        place: prov.ref,
        data: { realm: "", group: "Ash", kind: "badge", gids: [9], squad: 1, killed: 14 },
      }),
      f = streetFightOf(world, ev)!;
    assert.equal(f.kind, "badge");
    assert.deepEqual(
      f.sides.map((x) => [x.as, x.fallen]),
      [
        ["badge", 0],
        ["street", 14],
      ],
    );
    assert.match(f.words.what, /death squad/);
    const plan = villagePlan(world, w.town as Ref, undefined, 120),
      script = streetScript(f, plan, 56);
    assert.equal(fallenBy(script, script.end)[1], script.falls[1]);
    assert.ok(script.falls[1] > 0 && script.falls[0] === 0);
  } finally {
    w.restore();
  }
});

test("no two of them in one place, and none in a wall, a stall or a stone: every half second of both kinds", () => {
  const w = written();
  try {
    const plan = villagePlan(world, w.town as Ref, undefined, 120),
      slots = 56;
    for (const ref of [w.start, w.clash]) {
      const f = streetFightOf(world, ref)!,
        script = streetScript(f, plan, slots),
        cast = streetCast(plan, script, world.now);
      let nearest = Infinity,
        seen = 0;
      for (let t = 0; t <= script.end; t += 0.5) {
        const there = streetAt(script, slots, t, plan).soldiers.filter((q) => q.size > 0.5);
        seen = Math.max(seen, there.length);
        for (let i = 0; i < there.length; i++) {
          const a = there[i]!;
          assert.ok(
            standsClear(plan, a, 0.12),
            `${f.kind} at ${t}s: one ${a.doing} at ${a.x.toFixed(1)},${a.z.toFixed(1)} stands in something`,
          );
          for (let j = i + 1; j < there.length; j++) {
            const b = there[j]!,
              d = Math.hypot(a.x - b.x, a.z - b.z);
            nearest = Math.min(nearest, d);
            assert.ok(
              d >= (a.doing === "fallen" || b.doing === "fallen" ? BODY : 2 * BODY) - 0.08,
              `${f.kind} at ${t}s: ${a.doing} and ${b.doing} ${d.toFixed(2)} m apart`,
            );
          }
        }
        // (Those of the town in it: clear of what stands there, and of one another once they stand.)
        const folk = castAt(cast, t, plan).folk;
        for (const x of folk) assert.ok(standsClear(plan, x, 0.12), `${f.kind} at ${t}s: ${x.why}`);
      }
      assert.ok(seen >= 10, `${seen} seen at once`);
      assert.ok(nearest < 3, "they do meet");
      // (Those who fight stand an arm's length from their man: never nearer than a body's width, never a knot.)
      const mid = streetAt(script, slots, script.clashes[0]!.from + 5, plan).soldiers.filter(
        (q) => q.doing === "fight",
      );
      for (const a of mid)
        for (const b of mid)
          if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2 * BODY, "fighters apart");
    }
  } finally {
    w.restore();
  }
});

test("struck and bleeding as a battle's men are: every one who falls struck where he stands, as the blood setting shows", () => {
  const w = written();
  try {
    const plan = villagePlan(world, w.town as Ref, undefined, 120),
      slots = 56,
      f = streetFightOf(world, w.start)!,
      script = streetScript(f, plan, slots);
    assert.ok(f.figure, "its people's figure is told");
    const b = streetBattle(f, script)!,
      k = b.frame.scale;
    // (One blow for each who falls, in the order they fall, where the script has him.)
    assert.equal(b.blows.hits.filter((h) => !h.back).length, script.falls[0] + script.falls[1]);
    // (And its wounded who lived, shown and not told: some, never more than a third of those of a side still standing; each
    // struck where he fights, while he fights, and gone back the way he came, no further than nine metres.)
    const hurt = b.blows.hits.filter((h) => h.back);
    assert.ok(
      hurt.length > 0 && b.wounded[0] + b.wounded[1] === hurt.length,
      `${hurt.length} wounded`,
    );
    for (const i of [0, 1] as const)
      assert.ok(b.wounded[i] <= (script.drawn[i] - script.falls[i]) / 3);
    for (const h of hurt) {
      const g = script.figures[h.id]!,
        at = g.meet ?? g.path[g.path.length - 1]!;
      assert.equal(g.falls, null);
      assert.ok(g.fight && h.at > g.fight[0] && h.at < g.fight[1], `struck at ${h.at}`);
      assert.ok(Math.hypot(h.x * k - at.x, h.z * k - at.z) < 1e-6);
      assert.ok(h.back!.far * k <= 9.01 && h.back!.helper === -1);
    }
    for (let i = 1; i < b.blows.hits.length; i++)
      assert.ok(b.blows.hits[i]!.at >= b.blows.hits[i - 1]!.at, "in the order they land");
    b.blows.hits.forEach((h, i) => assert.equal(b.blows.of[h.id], i));
    for (const h of b.blows.hits.filter((x) => !x.back)) {
      const g = script.figures[h.id]!,
        at = g.meet ?? g.path[g.path.length - 1]!;
      assert.equal(h.at, g.falls);
      assert.ok(Math.hypot(h.x * k - at.x, h.z * k - at.z) < 1e-6);
      if (h.lie) assert.ok(Math.hypot(h.lie.x * k - at.x, h.lie.z * k - at.z) <= 1.21);
    }
    const at = (t: number, gore: "full" | "less" | "none") =>
      blowsAt(
        b.field,
        b.blows,
        streetBattleNow(b, script, streetAt(script, slots, t, plan), slots, t),
        gore,
      );
    const none = at(0, "full");
    assert.equal(none.wounds?.length ?? 0, 0);
    assert.equal(none.blood.length, 0);
    const full = at(script.end, "full"),
      less = at(script.end, "less"),
      bare = at(script.end, "none");
    // (At the end as many lie as history's dead at the scene's scale, each with his wound; blood under them.)
    assert.deepEqual(full.fallen, [...script.falls]);
    assert.equal(
      full.troopers.filter(
        (t) => t.act === "fall" && t.size > 0.5 && !b.blows.hits[b.blows.of[t.id]!]?.back,
      ).length,
      6 + 23,
    );
    assert.ok((full.wounds?.length ?? 0) >= 6 + 23, `${full.wounds?.length} wounds`);
    // (The wounded on their way: staggering, kneeling, limping, crawling or sat down at some moment, each near where he fought.)
    const acts = new Set<string>();
    for (let t = 0; t <= script.end; t += 0.25)
      for (const tr of at(t, "full").troopers) {
        if (tr.hit === undefined || tr.act === "fall" || tr.size < 0.5) continue;
        acts.add(tr.crawl ? "crawl" : tr.act);
        const g = script.figures[tr.id]!,
          home = g.meet ?? g.path[g.path.length - 1]!;
        assert.ok(
          Math.hypot(tr.x * k - home.x, tr.z * k - home.z) < 12,
          `${tr.act} far from his place`,
        );
      }
    assert.ok(acts.has("stagger"), `acts seen: ${[...acts].join(", ")}`);
    assert.ok(
      [...acts].some((x) => ["limp", "crawl", "kneel", "sit"].includes(x)),
      [...acts].join(", "),
    );
    assert.ok(full.blood.length > 0);
    // (Less: wounds, nothing cut off; none: neither wounds nor blood.)
    assert.equal(less.limbs?.length ?? 0, 0);
    assert.ok((less.wounds?.length ?? 0) > 0);
    assert.equal(bare.wounds?.length ?? 0, 0);
    assert.equal(bare.blood.length, 0);
    // (Each of the fallen lies within a body's length of where he was struck, and no one is anywhere but the town.)
    for (const t of full.troopers)
      if (t.size > 0.5)
        assert.ok(Number.isFinite(t.x) && Number.isFinite(t.z) && Math.hypot(t.x, t.z) * k < 2000);
  } finally {
    w.restore();
  }
});

test("a people with no figure known: no battle's field is made of it, and the town's own drawing has every man", () => {
  const w = written();
  try {
    const plan = villagePlan(world, w.town as Ref, undefined, 120),
      { figure: _figure, ...bare } = streetFightOf(world, w.start)!,
      script = streetScript(bare, plan, 56);
    void _figure;
    assert.equal(streetBattle(bare, script), null);
    const end = streetAt(script, 56, script.end, plan);
    assert.equal(end.soldiers.filter((q) => q.doing === "fallen").length, 6 + 23);
  } finally {
    w.restore();
  }
});
